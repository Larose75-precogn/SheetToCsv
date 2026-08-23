#!/usr/bin/env bash
# État courant du Remote Control.
set -uo pipefail
SOCKET="claude-rc"
[ -f "$HOME/.claude-rc/env" ] && . "$HOME/.claude-rc/env"
TMUX_BIN="${TMUX_BIN:-$(command -v tmux || echo /usr/bin/tmux)}"
LOGDIR="${RC_LOGDIR:-$HOME/.local/state/claude-rc}"

if ! "$TMUX_BIN" -L "$SOCKET" has-session -t rc 2>/dev/null; then
  echo "Remote Control : ARRÊTÉ (aucun serveur tmux)"
  echo
  echo "Pour savoir pourquoi :"
  echo "  systemctl --user status claude-remote-control --no-pager -l"
  echo "  journalctl --user -u claude-remote-control -n 30 --no-pager"
  exit 1
fi

echo "Remote Control : ACTIF"
echo
printf '%-42s %s\n' "SESSION" "DEPUIS"
"$TMUX_BIN" -L "$SOCKET" list-windows -t rc \
  -F '#{window_name}|#{t:window_activity}' | grep -v '^_keepalive|' |
while IFS='|' read -r w t; do printf '%-42s %s\n' "$w" "$t"; done

echo
echo "Logs : $LOGDIR"
echo "Attacher : $TMUX_BIN -L $SOCKET attach -t rc"
