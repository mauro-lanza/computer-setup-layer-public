# computer-setup-layer-public

Public content layer for [computer-setup](https://github.com/mauro-lanza/computer-setup).
Shareable baseline that any adopter can use as-is or fork.

## Contents

| File | Purpose |
|---|---|
| `layer.yml` | Manifest: `name: public`, `schema_version: 1` |
| `questions.yml` | Machine decisions with one answer — git identity, default editor, repositories directory, drift schedule. Prompted by bootstrap; answers stored in `~/.config/computer-setup/machine.yml` |
| `capabilities.yml` | Selectable capabilities — the optional-tools menu bootstrap prompts from, plus the `config:` bundles and `adopt_if_present` probes the engine derives from them |
| `vars.yml` | What every platform shares: zsh config files, git config, shared template values |
| `vars/Darwin.yml`, `vars/Linux.yml` | Per-platform values, merged only on that platform: package baselines, zsh paths, macOS `defaults`, scheduled jobs, the login shell. See "Platforms" below |
| `templates/zshrc.j2` | `~/.zshrc`. The orchestrator ships none of its own — without this file no shell config is deployed at all |
| `files/shell/*.zsh[.j2]` | Snippets deployed into `~/.zsh/`, sourced by `zshrc` in filename order. A `# cs:requires-capability: <id>` line gates a snippet on a capability |
| `presets.yml` | Named starting points (`full`, `minimal`) offered before the per-item prompts |
| `files/p10k.zsh` | Powerlevel10k prompt config. Runs in `nerdfont-v3` mode with segment icons on, so the Nerd Font (cask `font-meslo-lg-nerd-font`, pacman `ttf-meslo-nerd`) is a genuine baseline dependency — set MesloLGS NF as the terminal profile font once, or the icons render as tofu |
| `templates/vscode/settings.json.j2` | VS Code user settings, named by this layer's `extension_managers` entry (`settings_key`) |
| `templates/zed/settings.json.j2` | Zed settings — deployed by the `zed` capability's `config:` bundle |
| `templates/opencode.jsonc.j2` | opencode CLI config — deployed by the `opencode` capability's `config:` bundle |
| `templates/scripts/*.j2` | Standalone scripts deployed to `~/.local/bin` by their capability |
| `files/swiftbar/*` | The menu bar readout and its Terminal action — deployed by the `swiftbar` capability. See below |
| `scripts/check.sh` | This layer's gate. Runs the menu bar plugin against fixture machine states |

There is no `zed` role, `opencode` role or `dbt` role — config-only tools are
data. A capability declares `config: [{ src, dest }]` and the generic
`capability_configs` role deploys it, so adding one needs no orchestrator change.

### The menu bar readout

The `swiftbar` capability installs SwiftBar and deploys a plugin that renders
`computer-setup`'s state: drift, sync health, orphans, and live progress while a
run is happening.

It only **reads** — the four JSON files the engine already writes, every 15s. It
runs no Ansible on its refresh cycle: a check takes ~17s and the 10:00 agent
already runs one. The CLI stays the API, so anything the menu shows,
`computer-setup` can already tell you, and the plugin survives an engine change.

It runs on `/usr/bin/python3`, not the engine's pinned interpreter, so it still
renders when the runtime is broken — which is exactly when someone looks at it.

Three things about SwiftBar that are not obvious and cost a session each:

- **Only `bash`, `href` and `refresh` are action parameters.** Anything else is
  parsed and silently ignored.
- **`terminal=true` is the default, and it needs Accessibility permission.** It
  drives Terminal by AppleScript, and when a Terminal window already exists —
  including minimized or on another Space — it sends a ⌘T *keystroke* through
  System Events. SwiftBar never requests that permission and never mentions it;
  the script aborts after activating Terminal, so a window comes forward empty
  (SwiftBar issue #456). `upgrade` therefore goes through `open` on a `.command`
  file, which needs no permission at all. Everything else runs in the background.
- **Every file in the plugin directory is imported as a plugin and executed.**
  The `.command` file lived there briefly and appeared in the menu bar as a
  second, broken item. It is deployed to `~/.local/share/computer-setup/actions/`
  instead; the plugin directory holds plugins and nothing else.
- **`check` and `apply` run in the background**, so the menu bar icon becomes a progress indicator. Only `upgrade` opens a terminal, because it prompts and needs sudo.

### Running the gate

```bash
./scripts/check.sh
```

The engine's `check.sh` cannot cover this — it deliberately names no tool, and
the plugin is layer data. So the layer carries its own.

It renders the plugin against fixture machine states (converged, drift, failed,
stale, mid-run, finished, and no CLI at all) and asserts both the output shape
and the action contract: no `shell=`, no `terminal=true`, `check`/`apply` in the
background, `upgrade` through `open`, and no action running a command whose
output would go nowhere.

Fixtures work by pointing `$HOME` at a temporary directory — every path in the
plugin goes through `os.path.expanduser`, so one variable redirects the state
directory, the CLI, the logs and the upgrade action at once, and the plugin
needs no test hook of its own.

A plugin that raises still exits 0 — it renders an error item — so the exit code
proves nothing and every assertion is on the output. Every failure this catches
has happened for real and was silent each time.

### files/ vs templates/

A config file lives in `templates/<key>.j2` when it needs a value that is
decided elsewhere, and in `files/<key>` when it is verbatim content. **The
lookup key is the same either way** — `src: opencode.jsonc` resolves
`templates/opencode.jsonc.j2` if it exists, else `files/opencode.jsonc`. Promoting
a file to a template is a rename; no capability or engine change.

Shell snippets are the one exception to the path: they stay in `files/shell/`
and take a `.zsh.j2` suffix, because they are globbed rather than looked up.

Values shared across templates live at the bottom of `vars.yml`
(`ai_default_model`, `ai_title_model`, `ai_chat_model`, `ai_gitlens_model`, `terminal_font_family`).
Anything derivable
from an existing list is derived in the template instead — e.g.
`files/shell/20-aliases.zsh.j2` reads the Python version out of the `python@`
entry in `packages_baseline.brew` rather than restating it.

## How it's used

Cloned into `~/.local/share/computer-setup/layers/public/` and merged at the
lowest priority, so any other layer can override it. Priority is set in the
machine's layer manifest, not here. See the
[contract](https://github.com/mauro-lanza/computer-setup/blob/main/docs/architecture.md)
for the merge rules.

### Platforms

`vars.yml` holds what every platform shares (zsh config files, git, templates'
values). `vars/Darwin.yml` and `vars/Linux.yml` are merged after it, each only on
its own platform, and hold everything that differs:

| | `vars/Darwin.yml` | `vars/Linux.yml` |
|---|---|---|
| Packages | `packages_baseline.brew`/`.cask`, `packages_cask_adopt` | `packages_baseline.pacman` |
| zsh | `zsh_theme`, `zsh_plugins`, `zsh_path_prepend`, `zsh_env` (Homebrew paths) | `zsh_theme`, `zsh_plugins` (`/usr/share` paths) |
| Other | `extension_managers` (VS Code), `macos_defaults`, `scheduled_agents` | `shell_login_shell: /usr/bin/zsh` |

So `zshrc.j2` and the snippets carry no platform conditions: they render plain
values, and each machine gets a file naming only its own paths. A capability
spans platforms through its `packages:` keys (`opencode` has `brew` and
`pacman`); one with only `brew`/`cask` keys installs nothing on Linux.

Two things worth knowing when editing:

- **`packages_cask_adopt`** (`vars/Darwin.yml`) is the allow-list of casks safe
  to `--adopt` when already installed manually. Casks with protected payloads
  (`docker-desktop`, `zed`) must not be added — adoption can leave no app
  installed at all.
- **`files/shell/00-path.zsh.j2`** owns PATH order, and puts `~/.local/bin` ahead of
  the platform's `zsh_path_prepend` entries. A manually-installed binary there
  shadows the managed one. It is numbered `00-` so it loads before the snippets
  that prepend to PATH.

### mariadb-connector-c

The `mariadb-connector-c` capability is the MySQL/MariaDB C client library (headers
and `mysql_config`, no server), in no preset. It is keg-only, so `mysql_config` is
not on PATH; export it for the one command that builds `mysqlclient` from source:

```bash
PATH="$(brew --prefix)/opt/mariadb-connector-c/bin:$PATH" uv sync
```

No shell snippet ships for it: a permanent PATH entry for a build-only dependency
is impossible to attribute later.

### Shell snippet numbering

Snippets are sourced in lexical filename order, so the prefix *is* the
dependency declaration. Numbers are spaced by 10 to leave room to insert.

| Prefix | Snippet | Why here |
|---|---|---|
| `00` | `path` | Owns PATH order; must run first |
| `10` | `editor` | Needs `code`/`zed` on PATH to resolve `$EDITOR` |
| `20` | `aliases` | Plain definitions |
| `30` | `functions` | Plain definitions |
| `40` | `docker` | Gated on `docker-cli` |
| `50` | `gcloud` | Prepends to PATH |
| `60` | `nvm` | Prepends to PATH |

Two snippets must never share a prefix: ties are broken alphabetically, which
makes the order accidental rather than declared.

Contains no secrets and no personal data — safe to keep public.
