# computer-setup-layer-public

Public content layer for [computer-setup](https://github.com/mauro-lanza/computer-setup).
Shareable baseline that any adopter can use as-is or fork.

## Contents

| File | Purpose |
|---|---|
| `layer.yml` | Manifest: `name: public`, `schema_version: 1` |
| `capabilities.yml` | Selectable capabilities — the optional-tools menu bootstrap prompts from, plus the `config:` bundles and `adopt_if_present` probes the engine derives from them |
| `vars.yml` | Baseline Homebrew formulae/casks + adopt list, git config, macOS `defaults`, upgrade policy |
| `files/zshrc` | `~/.zshrc`. The orchestrator ships none of its own — without this file no shell config is deployed at all |
| `files/shell/*.zsh` | Snippets deployed into `~/.zsh/`, sourced by `zshrc` in filename order. A `# cs:requires-capability: <id>` line gates a snippet on a capability |
| `files/p10k.zsh` | Powerlevel10k prompt config |
| `files/vscode/settings.json` | VS Code user settings (resolved by the `vscode` role) |
| `files/zed/settings.json` | Zed settings — deployed by the `zed` capability's `config:` bundle |
| `files/opencode.json` | opencode CLI config — deployed by the `opencode` capability's `config:` bundle |
| `files/scripts/*` | Standalone scripts deployed to `~/.local/bin` by their capability |

There is no `zed` role, `opencode` role or `dbt` role — config-only tools are
data. A capability declares `config: [{ src, dest, kind }]` and the generic
`layer_configs` role deploys it, so adding one needs no orchestrator change.

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
- **`files/shell/10-path.zsh`** owns PATH order, and puts `~/.local/bin` ahead of
  `/opt/homebrew/bin`. A manually-installed binary there shadows the managed one.

Contains no secrets and no personal data — safe to keep public.
