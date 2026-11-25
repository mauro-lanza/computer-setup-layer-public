#!/bin/bash
# Gate for the opencode plugins and scripts, the layer's executable content.
set -euo pipefail

cd "$(dirname "$0")/.."
PY=/usr/bin/python3

echo "==> opencode files are deployed"
# Tests and their cases stay in the layer; everything else must be a config src.
missing=""
while IFS= read -r f; do
    src="${f#files/}"
    grep -qF -- "src: $src" capabilities.yml || missing+="  $src"$'\n'
done < <(find files/opencode -type f ! -name '*.test.ts' ! -name cases.ts | sort)
if [[ -n "$missing" ]]; then
    echo "ERROR: files under files/opencode/ not referenced as a config src in capabilities.yml:" >&2
    printf '%s' "$missing" >&2
    exit 1
fi
echo "  ok  every opencode file has a config entry"

echo "==> Scripts"
command -v shellcheck >/dev/null || { echo "ERROR: shellcheck not found" >&2; exit 1; }
for f in files/scripts/*; do
    read -r shebang < "$f"
    if [[ "$shebang" == *python* ]]; then
        "$PY" -m py_compile "$f"
    else
        bash -n "$f"
        shellcheck "$f"
    fi
    echo "  ok  $f"
done
find files/scripts -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true

echo "==> Shell-policy, usage-report and context-indicator plugins"
bun test files/opencode/plugins/shell-policy files/opencode/plugins/usage-report files/opencode/plugins/context-indicator

echo
echo "Checks passed"
