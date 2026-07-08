# Managed by computer-setup (layer: public) — do not edit manually
# cs:requires-capability: nvm
# Only deployed when the `nvm` capability is selected (see catalog.yml). Without
# this directive the snippet would be deployed to every machine.
# Sourcing nvm.sh eagerly costs ~700ms per shell. Instead we:
#   1. Resolve the *default* Node version by walking the alias chain and put
#      only its bin/ on PATH (a few cheap file reads) so node/npm/npx work
#      instantly in interactive shells and subprocesses.
#   2. Defer the expensive nvm.sh source until `nvm` itself is first invoked.
export NVM_DIR="$HOME/.nvm"

# ─── 1. Fast default-version PATH injection ───────────────────────────────────
() {
  emulate -L zsh
  local ver="default" hops=0 bindir
  # Follow the alias chain (e.g. default -> lts/* -> lts/<name> -> vX.Y.Z).
  while [[ "$ver" != v* && $hops -lt 10 ]]; do
    [[ -r "$NVM_DIR/alias/$ver" ]] || break
    ver="$(<"$NVM_DIR/alias/$ver")"
    (( hops++ ))
  done
  bindir="$NVM_DIR/versions/node/$ver/bin"
  if [[ "$ver" == v* && -d "$bindir" && ":$PATH:" != *":$bindir:"* ]]; then
    export PATH="$bindir:$PATH"
  fi
}

# ─── 2. Lazy nvm command ──────────────────────────────────────────────────────
# The first `nvm ...` call sources the real nvm.sh, replaces this stub, then
# re-runs with the original arguments.
nvm() {
  unset -f nvm
  [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
  [ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
  nvm "$@"
}
