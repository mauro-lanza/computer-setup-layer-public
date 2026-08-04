# Managed by computer-setup (layer: public) — do not edit manually

# ─── Auto-activate virtualenv on directory change ─────────────────────────────
auto_activate_venv() {
    if [[ -f "./.venv/bin/activate" ]]; then
        source "./.venv/bin/activate"
        return
    fi
    if [[ -f "./venv/bin/activate" ]]; then
        source "./venv/bin/activate"
        return
    fi
    # Deactivate if we left a venv directory
    if [[ -n "$VIRTUAL_ENV" ]]; then
        deactivate
    fi
}

autoload -U add-zsh-hook
add-zsh-hook chpwd auto_activate_venv
auto_activate_venv
