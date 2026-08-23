#!/usr/bin/env bash
# Arrête toutes les sessions Remote Control.
set -uo pipefail
SOCKET="claude-rc"
if tmux -L "$SOCKET" has-session -t rc 2>/dev/null; then
  tmux -L "$SOCKET" kill-server
  echo "[rc-down] Remote Control arrêté."
else
  echo "[rc-down] déjà arrêté."
fi
