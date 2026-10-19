# cs:requires-capability: docker-cli
# Stays `.zsh`: `{{.Server.Version}}` is Go template syntax, which Jinja would parse.
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
