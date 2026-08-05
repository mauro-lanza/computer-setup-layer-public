# Managed by computer-setup (layer: public) — do not edit manually
# cs:requires-capability: docker-cli
#
# DO NOT rename this file to .zsh.j2. It contains Go template syntax
# (`{{.Server.Version}}`) for `docker --format`, which Jinja would try to parse
# as its own expression and fail on. It stays a verbatim `files/` snippet for
# that reason; anything needing `homebrew_prefix` belongs in a different file.
## Only deployed when the `docker-cli` capability is active. Without the
# directive these functions were deployed to every machine, including ones that
# selected neither docker-cli nor colima — the `command -v docker` guard below
# hid that, but the snippet was still installed and sourced on every shell.
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
