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
if [ -f "$DEST/sessions.json" ]; then
  warn "sessions.json existe déjà dans $DEST — conservé (ton état de référence)."
else
  cp "$HERE/sessions.json" "$DEST/"
  echo "  sessions.json copié (les chemins projets sont détectés automatiquement)."
fi

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
else
  warn "Aucun token long terme détecté."
  warn "Lance : claude setup-token"
  warn "Sans ça, l'auth expire et les sessions tombent en 'worker_auth_expired'."
fi

say "Activation du service"
systemctl --user enable --now claude-remote-control.service
systemctl --user enable --now claude-remote-control.timer

say "État"
"$DEST/rc-status.sh" || true

cat <<EOF

Terminé.

  Remettre le Remote Control : systemctl --user start claude-remote-control
  Voir l'état                : $DEST/rc-status.sh
  Arrêter                    : systemctl --user stop claude-remote-control
  Modifier les sessions      : \$EDITOR $DEST/sessions.json

Le timer repasse toutes les 5 min et relance toute session tombée.
EOF
