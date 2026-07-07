# Managed by computer-setup (layer: public) — do not edit manually
# PATH extras + Homebrew settings.
for _cs_p in /opt/homebrew/bin /opt/homebrew/sbin "$HOME/.local/bin"; do
  [[ ":$PATH:" != *":$_cs_p:"* ]] && export PATH="$_cs_p:$PATH"
done
unset _cs_p

# Homebrew: disable anonymous analytics collection
export HOMEBREW_NO_ANALYTICS=1
