#!/usr/bin/env bash
# État courant du Remote Control.
set -uo pipefail
SOCKET="claude-rc"
LOGDIR="${RC_LOGDIR:-$HOME/.local/state/claude-rc}"

if ! tmux -L "$SOCKET" has-session -t rc 2>/dev/null; then
  echo "Remote Control : ARRÊTÉ (aucun serveur tmux)"
  exit 1
fi

echo "Remote Control : ACTIF"
echo
printf '%-42s %s\n' "SESSION" "DEPUIS"
tmux -L "$SOCKET" list-windows -t rc \
  -F '#{window_name}|#{t:window_activity}' | grep -v '^_keepalive|' |
while IFS='|' read -r w t; do printf '%-42s %s\n' "$w" "$t"; done

echo
echo "Logs : $LOGDIR"
echo "Attacher : tmux -L $SOCKET attach -t rc"
