# computer-setup-layer-public

Public content layer for [computer-setup](https://github.com/mauro-lanza/computer-setup).
Shareable baseline that any adopter can use as-is or fork.

## Contents

| File | Purpose |
|---|---|
| `plugin.yml` | Manifest: `name: public`, `priority: 10`, `schema_version: 1` |
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

The orchestrator clones this into `~/.local/share/computer-setup/plugins/public/`
and merges it lowest-priority (10). Its list vars append with the personal/work
layers; its files are overridable by a higher-priority layer that ships the same
key. See the [contract](https://github.com/mauro-lanza/computer-setup/blob/main/docs/architecture.md).

Contains no secrets and no personal data — safe to keep public.
