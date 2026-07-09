# Managed by computer-setup (layer: public) — do not edit manually
# cs:requires-capability: gcloud
# Google Cloud SDK (installed via Homebrew cask). Self-guards on presence.
if [ -d '/opt/homebrew/share/google-cloud-sdk/bin' ]; then
    [[ ":$PATH:" != *":/opt/homebrew/share/google-cloud-sdk/bin:"* ]] && \
        export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
fi
if [ -f '/opt/homebrew/share/google-cloud-sdk/completion.zsh.inc' ]; then
    source '/opt/homebrew/share/google-cloud-sdk/completion.zsh.inc'
fi
