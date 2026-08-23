#!/usr/bin/env bash
# Installe le Remote Control comme service permanent sur un hôte TOUJOURS ALLUMÉ.
# À lancer sur le VPS, en tant qu'utilisateur normal (pas root).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude-rc"
UNITS="$HOME/.config/systemd/user"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m[!] %s\033[0m\n' "$*"; }
die() { printf '\033[31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "Ne pas lancer en root : le service tourne en user."

say "Vérification des prérequis"
for c in tmux node systemctl; do
  command -v "$c" >/dev/null || die "$c manquant."
  echo "  ok  $c"
done
command -v claude >/dev/null || die "CLI claude absent. Installe-le d'abord."
echo "  ok  claude ($(claude --version 2>/dev/null | head -1))"

say "Vérification de l'hôte"
echo "  hostname : $(hostname)"
echo "  uptime   : $(uptime -p 2>/dev/null || uptime)"
warn "Cet hôte doit rester allumé 24/7. Si c'est un laptop, arrête ici."

say "Copie des scripts vers $DEST"
mkdir -p "$DEST"
cp "$HERE"/rc-up.sh "$HERE"/rc-down.sh "$HERE"/rc-status.sh "$DEST"/
chmod +x "$DEST"/rc-*.sh
if [ -f "$DEST/sessions.json" ] && grep -q CHANGEME "$DEST/sessions.json"; then
  cp "$DEST/sessions.json" "$DEST/sessions.json.bak"
  cp "$HERE/sessions.json" "$DEST/"
  warn "sessions.json contenait des CHANGEME (version périmée) — remplacé."
  warn "L'ancien est sauvegardé dans $DEST/sessions.json.bak"
elif [ -f "$DEST/sessions.json" ]; then
  warn "sessions.json existe déjà dans $DEST — conservé (ton état de référence)."
else
  cp "$HERE/sessions.json" "$DEST/"
  echo "  sessions.json copié (les chemins projets sont détectés automatiquement)."
fi

say "Capture de l'environnement pour systemd"
# Un service systemd user démarre avec un PATH minimal : sans ça il ne
# retrouve ni claude ni node (nvm, ~/.local/bin...).
CLAUDE_BIN="$(command -v claude)"
NODE_BIN="$(command -v node)"
TMUX_BIN="$(command -v tmux)"

# Chemins absolus figés : le service ne dépend plus du PATH.
printf 'CLAUDE_BIN=%s\nNODE_BIN=%s\nTMUX_BIN=%s\nPATH=%s\n' \
  "$CLAUDE_BIN" "$NODE_BIN" "$TMUX_BIN" \
  "$(dirname "$CLAUDE_BIN"):$(dirname "$NODE_BIN"):$(dirname "$TMUX_BIN"):/usr/local/bin:/usr/bin:/bin" \
  > "$DEST/env"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> "$DEST/env"
fi
chmod 600 "$DEST/env"
echo "  claude : $CLAUDE_BIN"
echo "  node   : $NODE_BIN"
echo "  tmux   : $TMUX_BIN"

say "Installation des units systemd"
mkdir -p "$UNITS"
cp "$HERE"/claude-remote-control.service \
   "$HERE"/claude-remote-control-reconcile.service \
   "$HERE"/claude-remote-control.timer "$UNITS"/
systemctl --user daemon-reload

say "Activation du linger (survie à la déconnexion SSH et au reboot)"
if loginctl enable-linger "$USER" 2>/dev/null; then
  echo "  ok  linger activé pour $USER"
else
  warn "linger non activable sans droits. Lance : sudo loginctl enable-linger $USER"
  warn "SANS ÇA, tout s'arrête quand ta session SSH se ferme."
fi

say "Authentification longue durée"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "  ok  ANTHROPIC_API_KEY présente"
elif [ -s "$HOME/.claude/.credentials.json" ]; then
  echo "  ok  identifiants Claude présents ($HOME/.claude/.credentials.json)"
  echo "      (si les sessions retombent en 'worker_auth_expired', lance: claude setup-token)"
else
  warn "Aucun identifiant détecté."
  warn "Lance : claude setup-token"
  warn "Sans ça, les sessions tomberont en 'worker_auth_expired'."
fi

say "Activation du service"
systemctl --user enable claude-remote-control.service
systemctl --user enable claude-remote-control.timer
# RemainAfterExit peut laisser l'unité "active" après un échec : on force.
systemctl --user restart claude-remote-control.service || true
systemctl --user restart claude-remote-control.timer || true

say "État"
"$DEST/rc-status.sh" || true

want=$("$NODE_BIN" -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((m.sessions||[]).length)' "$DEST/sessions.json" 2>/dev/null || echo 0)
got=$("$TMUX_BIN" -L claude-rc list-windows -t rc -F '#{window_name}' 2>/dev/null | grep -vc '^_keepalive' || echo 0)
if [ "$got" -lt "$want" ]; then
  warn "$got session(s) sur $want. Motifs des sessions ignorées :"
  journalctl --user -u claude-remote-control -n 60 --no-pager 2>/dev/null \
    | grep -E 'IGNORÉ|ERREUR|plusieurs|aucun dossier' | sed 's/.*rc-up.sh\[[0-9]*\]: //' | sed 's/^/    /' \
    || echo "    (journal indisponible)"
  echo
  echo "  Corrige en renseignant cwd : \$EDITOR $DEST/sessions.json"
  echo "  Puis : systemctl --user restart claude-remote-control"
fi

cat <<EOF

Terminé.

  Remettre le Remote Control : systemctl --user start claude-remote-control
  Voir l'état                : $DEST/rc-status.sh
  Arrêter                    : systemctl --user stop claude-remote-control
  Modifier les sessions      : \$EDITOR $DEST/sessions.json

Le timer repasse toutes les 5 min et relance toute session tombée.
EOF
