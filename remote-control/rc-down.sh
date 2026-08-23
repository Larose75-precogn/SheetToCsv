#!/usr/bin/env bash
# Arrête toutes les sessions Remote Control.
set -uo pipefail
SOCKET="claude-rc"
[ -f "$HOME/.claude-rc/env" ] && . "$HOME/.claude-rc/env"
TMUX_BIN="${TMUX_BIN:-$(command -v tmux || echo /usr/bin/tmux)}"
if "$TMUX_BIN" -L "$SOCKET" has-session -t rc 2>/dev/null; then
  "$TMUX_BIN" -L "$SOCKET" kill-server
  echo "[rc-down] Remote Control arrêté."
else
  echo "[rc-down] déjà arrêté."
fi
