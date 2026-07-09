# Managed by computer-setup (layer: public) — do not edit manually
# cs:requires-capability: opencode
# OpenCode: resolve the GitHub MCP token lazily, only when opencode is launched,
# instead of shelling out to `gh auth token` (~50-190ms) on every shell startup.
# The token is cached for the rest of the session after the first launch.
if command -v opencode >/dev/null 2>&1; then
  opencode() {
    export OC_GITHUB_PERSONAL_ACCESS_TOKEN="${OC_GITHUB_PERSONAL_ACCESS_TOKEN:-$(gh auth token 2>/dev/null)}"
    command opencode "$@"
  }
fi
