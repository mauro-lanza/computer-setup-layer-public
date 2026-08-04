# computer-setup-layer-public

Public content layer for [computer-setup](https://github.com/mauro-lanza/computer-setup).
Shareable baseline that any adopter can use as-is or fork.

## Contents

| File | Purpose |
|---|---|
| `layer.yml` | Manifest: `name: public`, `schema_version: 1` |
| `capabilities.yml` | Selectable capabilities — the optional-tools menu bootstrap prompts from, plus the `config:` bundles and `adopt_if_present` probes the engine derives from them |
| `vars.yml` | Baseline Homebrew formulae/casks + adopt list, git config, macOS `defaults`, upgrade policy |
| `templates/zshrc.j2` | `~/.zshrc`. The orchestrator ships none of its own — without this file no shell config is deployed at all |
| `files/shell/*.zsh[.j2]` | Snippets deployed into `~/.zsh/`, sourced by `zshrc` in filename order. A `# cs:requires-capability: <id>` line gates a snippet on a capability |
| `files/p10k.zsh` | Powerlevel10k prompt config |
| `templates/vscode/settings.json.j2` | VS Code user settings (resolved by the `vscode` role) |
| `templates/zed/settings.json.j2` | Zed settings — deployed by the `zed` capability's `config:` bundle |
| `templates/opencode.json.j2` | opencode CLI config — deployed by the `opencode` capability's `config:` bundle |
| `templates/scripts/*.j2` | Standalone scripts deployed to `~/.local/bin` by their capability |

There is no `zed` role, `opencode` role or `dbt` role — config-only tools are
data. A capability declares `config: [{ src, dest, kind }]` and the generic
`layer_configs` role deploys it, so adding one needs no orchestrator change.

### files/ vs templates/

A config file lives in `templates/<key>.j2` when it needs a value that is
decided elsewhere, and in `files/<key>` when it is verbatim content. **The
lookup key is the same either way** — `src: opencode.json` resolves
`templates/opencode.json.j2` if it exists, else `files/opencode.json`. Promoting
a file to a template is a rename; no capability or engine change.

Shell snippets are the one exception to the path: they stay in `files/shell/`
and take a `.zsh.j2` suffix, because they are globbed rather than looked up.

Values shared across templates live at the bottom of `vars.yml`
(`ai_default_model`, `ai_chat_model`, `ai_gitlens_model`). Anything derivable
from an existing list is derived in the template instead — e.g.
`files/shell/20-aliases.zsh.j2` reads the Python version out of
`homebrew_baseline_formulae` rather than restating it.

## How it's used

Cloned into `~/.local/share/computer-setup/layers/public/` and merged at the
lowest priority, so any other layer can override it. Priority is set in the
machine's layer manifest, not here. See the
[contract](https://github.com/mauro-lanza/computer-setup/blob/main/docs/architecture.md)
for the merge rules.

Two things in `vars.yml` worth knowing when editing:

- **`homebrew_adopt_casks`** is the allow-list of casks safe to `--adopt` when
  already installed manually. Casks with protected payloads (`docker-desktop`,
  `zed`) must not be added — adoption can leave no app installed at all.
- **`files/shell/10-path.zsh.j2`** owns PATH order, and puts `~/.local/bin` ahead of
  `{{ homebrew_prefix }}/bin`. A manually-installed binary there shadows the managed one.

Contains no secrets and no personal data — safe to keep public.
