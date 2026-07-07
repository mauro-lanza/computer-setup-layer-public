# Managed by computer-setup (layer: public) — do not edit manually

# ─── Docker runtime switching ─────────────────────────────────────────────────
# Defined only when a Docker CLI is present. Each switches the active context.
if command -v docker >/dev/null 2>&1; then
    use-docker-desktop() {
        if ! docker --context desktop-linux version --format 'Server: {{.Server.Version}}' &>/dev/null; then
            echo "Error: Docker Desktop is not running. Please start Docker Desktop first."
            return 1
        fi
        unset DOCKER_HOST
        docker context use desktop-linux
        echo "Switched to Docker Desktop"
        docker version --format 'Server: {{.Server.Version}}'
    }

    use-colima() {
        if ! colima status &>/dev/null; then
            echo "Error: Colima is not running. Start it with: colima start"
            return 1
        fi
        unset DOCKER_HOST
        docker context use colima
        echo "Switched to Colima"
        docker version --format 'Server: {{.Server.Version}}'
    }
fi

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
