#!/bin/bash
# Opened by the SwiftBar menu item, via `open`.
#
# WHY A FILE RATHER THAN A MENU PARAMETER
# ---------------------------------------
# SwiftBar's `terminal=true` drives Terminal through AppleScript, and when any
# Terminal window already exists — including one minimized or on another Space —
# it sends a ⌘T *keystroke* via System Events. That needs Accessibility
# permission, which SwiftBar never requests and never mentions. Without it the
# script aborts, but Terminal has already been activated, so a window comes to
# the front showing nothing. (SwiftBar issue #456, closed without a fix to the
# Terminal path.)
#
# `open` on a .command file needs no permission at all: macOS binds the
# extension to Terminal and runs it. So the menu item opens this, and this runs
# the command.
#
# Upgrade is the only action that needs a terminal in the first place — it
# prompts for confirmation and for a sudo password for casks, and refuses to run
# without a TTY. Everything else the menu offers runs in the background.
exec "$HOME/.local/bin/computer-setup" upgrade
