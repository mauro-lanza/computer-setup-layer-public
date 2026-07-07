# computer-setup-layer-public

Public content layer for [computer-setup](https://github.com/mauro-lanza/computer-setup).
Shareable baseline that any adopter can use as-is or fork.

## Contents

| File | Purpose |
|---|---|
| `plugin.yml` | Manifest: `name: public`, `priority: 10`, `schema_version: 1` |
| `vars.yml` | Baseline Homebrew formulae/casks/adopt list + VS Code extensions |
| `catalog.yml` | Generic optional-tools menu merged into bootstrap's prompt |
| `files/p10k.zsh` | Powerlevel10k prompt config (shell role) |
| `files/vscode/settings.json` | VS Code user settings (vscode role) |
| `files/zed/settings.json` | Zed editor settings (zed role) |
| `files/opencode.json` | opencode CLI config (opencode role) |

## How it's used

The orchestrator clones this into `~/.local/share/computer-setup/plugins/public/`
and merges it lowest-priority (10). Its list vars append with the personal/work
layers; its files are overridable by a higher-priority layer that ships the same
key. See the [contract](https://github.com/mauro-lanza/computer-setup/blob/main/docs/architecture.md).

Contains no secrets and no personal data — safe to keep public.
