#!/bin/bash
# Gate for this layer's only executable content: the SwiftBar plugin.
#
# The engine's check.sh cannot do this — it deliberately names no tool, and this
# plugin is layer data. So the layer carries its own gate.
#
# Every path in the plugin goes through os.path.expanduser, which honours $HOME.
# So a fixture HOME redirects the state directory, the CLI, the log directory
# and the upgrade action at once, with no test hook in the plugin itself.
#
# What this protects: a plugin that raises, or emits the wrong shape, shows
# SwiftBar's own error glyph and nothing about why. Every failure here has been
# silent in practice.
set -euo pipefail

cd "$(dirname "$0")/.."
PLUGIN="files/swiftbar/computer-setup.15s.py"
PY=/usr/bin/python3

echo "==> Plugin compiles"
"$PY" -m py_compile "$PLUGIN"
echo "  ok  $PLUGIN"

# Builds a fixture HOME and prints the plugin's output for it.
# $1 the JSON `computer-setup status --json` should return
# $2 optional progress.jsonl content
render() {
    local status_json="$1" progress="${2:-}"
    local home
    home="$(mktemp -d)"
    mkdir -p "$home/.local/state/computer-setup" "$home/.local/bin" \
             "$home/Library/Logs/computer-setup"

    # Stub CLI. The plugin shells out for status; everything else it reads.
    printf '#!/bin/bash\ncat <<'\''JSON'\''\n%s\nJSON\n' "$status_json" \
        > "$home/.local/bin/computer-setup"
    chmod +x "$home/.local/bin/computer-setup"

    printf '{"schema_version":1,"generated":"2026-09-18T10:00:00+0200","mode":"check","partial":false,"complete":true,"files":[{"path":"/a"},{"path":"/b"}],"directories":[],"backups":[],"orphans":[]}\n' \
        > "$home/.local/state/computer-setup/managed-paths.json"
    printf '{"schema_version":1,"finished":"2026-09-18T10:00:00+0200","mode":"check","result":"ok","changed":0,"failed":0,"ok":200,"tasks":216,"partial":false,"duration_seconds":18.1,"log":"%s/Library/Logs/computer-setup/20260918-100000-check.log"}\n' \
        "$home" > "$home/.local/state/computer-setup/history.jsonl"
    : > "$home/Library/Logs/computer-setup/20260918-100000-check.log"
    [[ -n "$progress" ]] && printf '%s\n' "$progress" \
        > "$home/.local/state/computer-setup/progress.jsonl"

    HOME="$home" "$PY" "$PWD/$PLUGIN"
    rm -rf -- "$home"
}

# A plugin that raises still exits 0 (it renders an error item instead), so the
# exit code proves nothing. Assert on what it printed.
expect() {
    local what="$1" out="$2" pattern="$3"
    if ! printf '%s\n' "$out" | grep -qE -- "$pattern"; then
        echo "ERROR: $what" >&2
        echo "       expected to match: $pattern" >&2
        printf '%s\n' "$out" >&2
        exit 1
    fi
}
refute() {
    local what="$1" out="$2" pattern="$3"
    if printf '%s\n' "$out" | grep -qE -- "$pattern"; then
        echo "ERROR: $what" >&2
        echo "       should NOT have matched: $pattern" >&2
        printf '%s\n' "$out" >&2
        exit 1
    fi
}

OK_STATUS='{"stale":false,"days_since_success":0,"last_run":{"mode":"check","result":"ok","finished":"2026-09-18T10:00:00+0200","duration_seconds":18.1,"partial":false,"changed":[],"failed":[],"totals":{"failed":0}}}'

echo "==> Converged"
out="$(render "$OK_STATUS")"
refute "the plugin raised" "$out" 'plugin error|Traceback'
expect "no title line" "$out" '^:checkmark'
expect "no separator"  "$out" '^---$'
echo "  ok  green, renders"

echo "==> Action contract"
# `shell=` is parsed but undocumented, and `terminal=true` needs an
# Accessibility grant SwiftBar never requests — it opens an empty window.
refute "an action used shell= instead of bash=" "$out" 'shell='
refute "an action asked SwiftBar to open a Terminal" "$out" 'terminal=true'
expect "check does not run in the background" "$out" 'param1=check terminal=false'
expect "apply does not run in the background" "$out" 'param1=apply terminal=false'
# `computer-setup log` prints to stdout. Run as a background action it produces
# nothing at all — which it did, on the failure branch, until this gate existed.
refute "an action runs a command whose output goes nowhere" "$out" 'param1=log'
expect "upgrade does not go through open" "$out" 'bash=/usr/bin/open .*upgrade\.command'
echo "  ok  bash=, background where it should be, no output sent nowhere"

echo "==> Drift"
out="$(render '{"stale":false,"days_since_success":0,"last_run":{"mode":"check","result":"ok","finished":"2026-09-18T10:00:00+0200","duration_seconds":18.1,"partial":false,"changed":[{"dest":"/Users/x/.zshrc"},{"dest":"/Users/x/.gitconfig"}],"failed":[],"totals":{"failed":0}}}')"
expect "drift is not badged in the title" "$out" '^:circle\.badge\.exclamationmark: 2'
expect "drift is not listed" "$out" 'would change'
echo "  ok  badge and list"

# A completed apply that changed things is GOOD news. Treating it like drift put
# an orange warning on a machine that had just been repaired.
echo "==> Apply that changed things is not drift"
out="$(render '{"stale":false,"days_since_success":0,"last_run":{"mode":"apply","result":"ok","finished":"2026-09-18T10:00:00+0200","duration_seconds":18.1,"partial":false,"changed":[{"dest":"/Users/x/.zshrc"}],"failed":[],"totals":{"failed":0}}}')"
expect "a successful apply did not report green" "$out" '^:checkmark'
expect "a successful apply was not described as applied" "$out" 'were changed'
echo "  ok  green, 'were changed'"

echo "==> Failure"
out="$(render '{"stale":false,"days_since_success":0,"last_run":{"mode":"apply","result":"failed","finished":"2026-09-18T10:00:00+0200","duration_seconds":9.0,"partial":false,"changed":[],"failed":[{"task":"Install Homebrew casks","item":"docker"}],"totals":{"failed":1}}}')"
expect "a failed run is not red" "$out" '^:exclamationmark\.triangle\.fill'
expect "the failed task is not named" "$out" 'docker'
expect "no way to reach the failing run's log" "$out" "Open the failing run's log.*href=file://"
echo "  ok  red, names the task, links its log"

echo "==> Stopped syncing"
out="$(render '{"stale":true,"days_since_success":21,"last_run":{"mode":"check","result":"ok","finished":"2026-08-28T10:00:00+0200","duration_seconds":18.1,"partial":false,"changed":[],"failed":[],"totals":{"failed":0}}}')"
expect "staleness is not surfaced" "$out" 'NOT SYNCING — last clean run 21 days ago'
echo "  ok  the failure nothing else reports"

echo "==> Run in progress"
out="$(render "$OK_STATUS" '{"schema_version":1,"event":"start","mode":"check","total_estimate":216,"started":"2026-09-18T10:00:00+0200"}
{"event":"task","n":108,"task":"Install casks without adoption","role":"homebrew"}')"
expect "a running check shows no progress" "$out" '^:arrow\.triangle\.2\.circlepath: 50%'
expect "the current task is not shown" "$out" 'task 108 of 216'
refute "actions are offered while a run is in progress" "$out" 'param1=apply'
echo "  ok  percentage, current task, actions withheld"

echo "==> A finished run is not reported as running"
out="$(render "$OK_STATUS" '{"schema_version":1,"event":"start","mode":"check","total_estimate":216,"started":"2026-09-18T10:00:00+0200"}
{"event":"task","n":216,"task":"last"}
{"event":"end","result":"ok","tasks":216,"changed":0,"failed":0,"finished":"2026-09-18T10:00:18+0200"}')"
refute "an ended run still showed a spinner" "$out" '^:arrow\.triangle\.2\.circlepath'
expect "actions were not restored after the run ended" "$out" 'param1=apply'
echo "  ok  end marker respected"

# The CLI is absent on a machine mid-bootstrap, and broken on one worth looking
# at. Neither may produce a stack trace in the menu bar.
echo "==> Degrades when the CLI is missing"
home="$(mktemp -d)"
mkdir -p "$home/.local/state/computer-setup"
out="$(HOME="$home" "$PY" "$PWD/$PLUGIN")"
rm -rf -- "$home"
refute "the plugin raised with no CLI present" "$out" 'plugin error|Traceback'
expect "no title line without a CLI" "$out" '^:questionmark'
echo "  ok  renders an unknown state rather than failing"

echo
echo "Checks passed"
