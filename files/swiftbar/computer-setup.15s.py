#!/usr/bin/python3
# <bitbar.title>computer-setup</bitbar.title>
# <bitbar.desc>Machine configuration: drift, sync health, and live run progress.</bitbar.desc>
# <bitbar.dependencies>python3</bitbar.dependencies>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
#
# A SwiftBar plugin. SwiftBar runs this every 15s and renders its stdout.
#
# IT ONLY READS. Four JSON files written by the engine's callback plugin, all in
# ~/.local/state/computer-setup. No Ansible is invoked on the refresh cycle: a
# check takes ~17s and the 10:00 agent already runs one, so polling it here
# would burn a CPU core and a network round trip every 15 seconds to re-learn
# something already on disk.
#
# Writes happen only when you click, and they open Terminal on purpose. An apply
# can take minutes, can prompt for sudo, and can print real errors — hiding that
# behind a spinner is how you get a UI that lies about what happened. The button
# starts the thing you would have typed.
#
# System python3 (/usr/bin/python3, from the Command Line Tools) rather than the
# engine's pinned interpreter: this must render even when the runtime is broken,
# which is exactly when someone looks at the menu bar.
import datetime
import json
import os
import subprocess
import sys
import time

STATE = os.path.expanduser("~/.local/state/computer-setup")
CLI = os.path.expanduser("~/.local/bin/computer-setup")
LOG_DIR = os.path.expanduser("~/Library/Logs/computer-setup")
UPGRADE_COMMAND = os.path.expanduser(
    "~/.local/share/computer-setup/swiftbar/upgrade.command")
STALE_DAYS = 14
# Past this with no new line, a run with no end marker was killed rather than
# still going. Matches `computer-setup progress`.
STALLED_SECONDS = 300


def read_json(name):
    try:
        with open(os.path.join(STATE, name)) as handle:
            return json.load(handle)
    except Exception:
        return None


def read_lines(name, limit=None):
    try:
        with open(os.path.join(STATE, name)) as handle:
            lines = [json.loads(l) for l in handle.read().splitlines() if l.strip()]
        return lines[-limit:] if limit else lines
    except Exception:
        return []


def age(name):
    try:
        return time.time() - os.path.getmtime(os.path.join(STATE, name))
    except Exception:
        return None


def days_since(stamp):
    """Whole days since an ISO timestamp, or None.

    `datetime` rather than `time.strptime` + `mktime`: struct_time carries no
    offset, so the parsed `%z` was discarded and the correction had to be
    guessed. It guessed wrong and reported "-1 days ago".
    """
    if not stamp:
        return None
    try:
        moment = datetime.datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%S%z")
        delta = datetime.datetime.now(datetime.timezone.utc) - moment
        return max(0, delta.days)
    except Exception:
        return None


def esc(text):
    """SwiftBar splits a line on `|`, so any in the text would truncate it."""
    return str(text).replace("|", "\u2502").replace("\n", " ")


def action(label, verb, **params):
    """A menu item that runs `computer-setup <verb>` in the background.

    Background is the right default here, and only became so once progress
    streaming existed: click, and the menu bar icon turns into a live progress
    indicator instead of a window appearing.

    Nothing here uses SwiftBar's `terminal=true`. That drives Terminal through
    AppleScript, and when a Terminal window already exists it sends a ⌘T
    keystroke via System Events — which needs Accessibility permission SwiftBar
    never requests. It fails silently after activating Terminal, so a window
    comes forward showing nothing. See open_in_terminal for the way round it.
    """
    opts = "bash=%s param1=%s terminal=false refresh=true" % (CLI, verb)
    extra = " ".join("%s=%s" % kv for kv in params.items())
    print("%s | %s %s" % (esc(label), opts, extra))


def open_in_terminal(label, command_file, **params):
    """A menu item that opens a .command file, which macOS runs in Terminal.

    `open` needs no permission; SwiftBar's own terminal support needs
    Accessibility. Used only for `upgrade`, which genuinely requires a TTY.
    """
    opts = "bash=/usr/bin/open param1=%s terminal=false refresh=false" % command_file
    extra = " ".join("%s=%s" % kv for kv in params.items())
    print("%s | %s %s" % (esc(label), opts, extra))


def open_file(label, path, **params):
    """A menu item that opens a file in whatever macOS uses for it.

    `href=file://…` rather than a command, so no Terminal window appears for
    something that is only being read.
    """
    extra = " ".join("%s=%s" % kv for kv in params.items())
    print("%s | href=file://%s %s" % (esc(label), path.replace(" ", "%20"), extra))


def main():
    status = read_json("last-run.json")
    # Each history entry now carries its own log, so a recent-runs list can
    # actually take you to the output that run produced.
    manifest = read_json("managed-paths.json")
    progress = read_lines("progress.jsonl")
    history = read_lines("history.jsonl", 10)
    # The newest run's own log, if it still exists (successful ones are pruned
    # past the retention window; failed ones are kept).
    latest_log = None
    for entry in reversed(history):
        candidate = entry.get("log")
        if candidate and os.path.exists(candidate):
            latest_log = candidate
            break

    # ── is a run happening right now? ────────────────────────────────────────
    running = None
    if progress:
        head, last = progress[0], progress[-1]
        progress_age = age("progress.jsonl")
        finished = last.get("event") == "end"
        if not finished and progress_age is not None and progress_age < STALLED_SECONDS:
            running = {"mode": head.get("mode", "?"),
                       "launching": head.get("event") == "launching",
                       "n": last.get("n", 0),
                       "total": head.get("total_estimate") or 0,
                       "task": last.get("task", "")}

    # ── the title: one glyph, at most one number ─────────────────────────────
    # A menu bar is not a dashboard. If the icon is ever ambiguous it gets
    # ignored, and then the stale-sync warning — the whole point — goes unread.
    # `changed` means two different things depending on the mode, and treating
    # them alike put an orange warning badge on a machine that had just been
    # successfully repaired. Under `check` it is "would change" — drift, worth
    # warning about. Under `apply` it is "did change" — the drift is gone.
    changed = len((status or {}).get("changed") or [])
    drift = changed if (status or {}).get("mode") == "check" else 0
    failed = len((status or {}).get("failed") or [])
    last_success = None
    for entry in reversed(history):
        if entry.get("result") == "ok":
            last_success = entry.get("finished")
            break
    stale_days = days_since(last_success)
    stale = stale_days is not None and stale_days >= STALE_DAYS

    if running:
        if running["launching"] or not running["total"]:
            print(":arrow.triangle.2.circlepath: | sfcolor=blue")
        else:
            pct = min(100, int(100 * running["n"] / running["total"]))
            print(":arrow.triangle.2.circlepath: %d%% | sfcolor=blue" % pct)
    elif status is None:
        print(":questionmark.circle: | sfcolor=gray")
    elif failed or (status or {}).get("result") == "failed":
        print(":exclamationmark.triangle.fill: | sfcolor=red")
    elif stale:
        print(":clock.badge.exclamationmark: | sfcolor=orange")
    elif drift:
        print(":circle.badge.exclamationmark: %d | sfcolor=orange" % drift)
    else:
        print(":checkmark.seal.fill: | sfcolor=green")

    print("---")

    # ── live run ─────────────────────────────────────────────────────────────
    if running:
        if running["launching"]:
            print("Starting %s — syncing layers | sfimage=hourglass" % esc(running["mode"]))
        else:
            label = "%s — task %d" % (running["mode"], running["n"])
            if running["total"]:
                label += " of %d" % running["total"]
            print("%s | sfimage=hourglass" % esc(label))
            print("%s | size=11 color=gray" % esc(running["task"]))
        print("---")

    # ── what the last run did ────────────────────────────────────────────────
    if status is None:
        print("No run recorded yet | color=gray")
        action("Run a check now", "check")
        print("---")
    else:
        when = (status.get("finished") or "")[:16].replace("T", " ")
        # macOS highlights every menu item on hover and SwiftBar has no
        # "disabled" parameter, so a row that looks clickable had better be.
        # These open the log rather than sitting inert under the cursor.
        label = "Last %s — %s" % (esc(status.get("mode", "?")),
                                  esc(status.get("result", "?")))
        if latest_log:
            open_file(label, latest_log, sfimage="clock",
                      tooltip="Open%20this%20run%27s%20log")
            print("%s · %ss | size=11 color=gray href=file://%s" % (
                esc(when), status.get("duration_seconds", "?"), latest_log))
        else:
            print("%s | sfimage=clock" % label)
            print("%s · %ss | size=11 color=gray" % (
                esc(when), status.get("duration_seconds", "?")))
        if status.get("partial"):
            print("partial run — only part of the machine was evaluated | size=11 color=gray")

        if failed:
            print("---")
            print("%d task(s) FAILED | color=red sfimage=xmark.octagon" % failed)
            for entry in (status.get("failed") or [])[:6]:
                print("--%s" % esc(entry.get("dest") or entry.get("item") or entry.get("task")))
            action("Open the log", "log")

        print("---")
        if changed:
            is_drift = status.get("mode") == "check"
            print("%d item(s) %s | color=%s sfimage=%s" % (
                changed,
                "would change" if is_drift else "were changed",
                "orange" if is_drift else "green",
                "circle.badge.exclamationmark" if is_drift else "checkmark.circle"))
            for entry in (status.get("changed") or [])[:10]:
                print("--%s" % esc(entry.get("dest") or entry.get("item") or entry.get("task")))
            if changed > 10:
                print("--… and %d more" % (changed - 10))
            if status.get("truncated"):
                print("--… list truncated")
        else:
            print("In sync — no drift | color=green sfimage=checkmark.circle")

    # ── sync health: the failure nothing else surfaces ───────────────────────
    if stale:
        print("NOT SYNCING — last clean run %d days ago | color=orange sfimage=clock.badge.exclamationmark"
              % stale_days)
    elif stale_days is not None:
        print("Syncing — last clean run %s | size=11 color=gray"
              % ("today" if stale_days == 0 else "%d day(s) ago" % stale_days))

    # ── what this system owns ────────────────────────────────────────────────
    if manifest:
        print("---")
        files = len(manifest.get("files") or [])
        orphans = manifest.get("orphans") or []
        print("Manages %d files | sfimage=folder" % files)
        if orphans:
            print("%d no longer managed, still on disk | color=orange" % len(orphans))
            for entry in orphans[:10]:
                print("--%s" % esc(entry.get("path")))
            print("--Nothing is deleted automatically | color=gray size=11")

    # ── actions ──────────────────────────────────────────────────────────────
    print("---")
    if not running:
        action("Check for drift", "check", sfimage="magnifyingglass",
               tooltip="Runs%20in%20the%20background")
        action("Apply now", "apply", sfimage="arrow.triangle.2.circlepath",
               tooltip="Runs%20in%20the%20background")
        # The one that must have a terminal: it asks for confirmation and for a
        # sudo password for casks, and refuses to run without a TTY.
        open_in_terminal("Upgrade packages…", UPGRADE_COMMAND,
                         sfimage="arrow.up.circle",
                         tooltip="Opens%20Terminal%20to%20confirm")
    else:
        print("A run is in progress | color=gray")
    if latest_log:
        open_file("Open this run's log", latest_log, sfimage="doc.plaintext")

    if history:
        print("Recent runs | sfimage=list.bullet")
        for entry in reversed(history):
            mark = "*" if entry.get("partial") else ""
            label = "%s%s  %s  %ss  (%s changed)" % (
                esc((entry.get("finished") or "")[:16].replace("T", " ")),
                mark, esc(entry.get("result", "?")),
                entry.get("duration_seconds", "?"), entry.get("changed", "?"))
            # Each run carries the path to its OWN log now. Runs older than
            # the retention window have had theirs pruned — unless they failed,
            # which are kept — so the row stays but stops being a link.
            entry_log = entry.get("log")
            if entry_log and os.path.exists(entry_log):
                print("--%s | font=Menlo size=11 href=file://%s"
                      % (label, entry_log.replace(" ", "%20")))
            else:
                print("--%s | font=Menlo size=11 color=gray" % label)

    print("Refresh | refresh=true sfimage=arrow.clockwise")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # A plugin that raises shows SwiftBar's own error glyph and nothing
        # about why. Render something legible instead.
        print(":exclamationmark.triangle: | sfcolor=red")
        print("---")
        print("computer-setup plugin error | color=red")
        print("%s | size=11 color=gray" % esc(exc))
        sys.exit(0)
