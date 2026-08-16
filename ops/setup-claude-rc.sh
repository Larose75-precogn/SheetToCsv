#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# setup-claude-rc.sh
#
# Rend les sessions Claude Code du VPS Ubuntu joignables depuis smartphone / tablette
# (app Claude -> onglet Code) via Remote Control.
#
# Usage :
#   ./setup-claude-rc.sh --check                      # diagnostic seul, ne modifie rien
#   ./setup-claude-rc.sh ~/projets/precogn ~/projets/structory
#   ./setup-claude-rc.sh --no-systemd ~/projets/precogn   # tmux seulement, sans service
#
# Ce que ça fait :
#   1. vérifie les prérequis qui font échouer Remote Control silencieusement
#   2. active Remote Control automatiquement pour toute nouvelle session
#   3. crée un service systemd user par projet, qui lance un serveur
#      `claude remote-control` dans un tmux (survit au reboot et au SSH qui tombe)
#
# Ce que ça NE fait PAS : récupérer vos sessions déjà en cours. Pour celles-là,
# tapez `/remote-control <nom>` dedans, l'historique est conservé.
# -----------------------------------------------------------------------------
set -euo pipefail

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
ok()   { printf '%s  ok %s %s\n' "$GRN" "$OFF" "$*"; }
warn() { printf '%s  !! %s %s\n' "$YEL" "$OFF" "$*"; }
bad()  { printf '%s  XX %s %s\n' "$RED" "$OFF" "$*"; PROBLEMS=$((PROBLEMS+1)); }
step() { printf '\n%s== %s%s\n' "$DIM" "$*" "$OFF"; }

PROBLEMS=0
CHECK_ONLY=0
USE_SYSTEMD=1
DIRS=()

for arg in "$@"; do
  case "$arg" in
    --check)       CHECK_ONLY=1 ;;
    --no-systemd)  USE_SYSTEMD=0 ;;
    -h|--help)     sed -n '2,26p' "$0"; exit 0 ;;
    -*)            echo "option inconnue : $arg" >&2; exit 2 ;;
    *)             DIRS+=("$arg") ;;
  esac
done

# --- 1. prérequis -------------------------------------------------------------
step "Prérequis"

CLAUDE_BIN="$(command -v claude || true)"
if [[ -z "$CLAUDE_BIN" ]]; then
  bad "binaire 'claude' introuvable dans le PATH"
else
  ok "claude : $CLAUDE_BIN"
  VER="$("$CLAUDE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [[ -z "$VER" ]]; then
    warn "version illisible, Remote Control demande >= 2.1.51 (2.1.200+ conseillé)"
  else
    # comparaison numérique sans dépendance externe
    IFS=. read -r a b c <<<"$VER"
    if (( a*1000000 + b*1000 + c < 2*1000000 + 1*1000 + 200 )); then
      warn "version $VER — fonctionne dès 2.1.51, mais --continue/--session-id demandent 2.1.200+"
    else
      ok "version $VER"
    fi
  fi
fi

command -v tmux >/dev/null || bad "tmux absent : sudo apt install tmux"
command -v tmux >/dev/null && ok "tmux présent"

# Variables qui désactivent Remote Control (l'échec est silencieux sans ça)
step "Variables d'environnement bloquantes"
ENV_PROBLEMS=$PROBLEMS
KILLERS=(DISABLE_TELEMETRY DO_NOT_TRACK CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC DISABLE_GROWTHBOOK)
for v in "${KILLERS[@]}"; do
  if [[ -n "${!v:-}" ]]; then
    bad "$v est définie (=${!v}) — elle coupe l'évaluation des feature flags dont dépend Remote Control"
  fi
done
if [[ -n "${ANTHROPIC_BASE_URL:-}" && "$ANTHROPIC_BASE_URL" != *"api.anthropic.com"* ]]; then
  bad "ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL — Remote Control est désactivé derrière un proxy/gateway"
fi
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  warn "ANTHROPIC_API_KEY définie — Remote Control exige une connexion claude.ai (/login), pas une clé API"
fi
(( PROBLEMS == ENV_PROBLEMS )) && ok "aucune variable bloquante dans ce shell"
echo "     ${DIM}(vérifiez aussi le bloc \"env\" de ~/.claude/settings.json et vos ~/.bashrc, ~/.profile,"
echo "      /etc/environment, et les Environment= de vos services systemd existants)${OFF}"

if [[ -f "$HOME/.claude/settings.json" ]] && command -v python3 >/dev/null; then
  python3 - "$HOME/.claude/settings.json" "${KILLERS[@]}" <<'PY' || true
import json, sys
path, killers = sys.argv[1], sys.argv[2:]
try:
    env = (json.load(open(path)) or {}).get("env") or {}
except Exception as e:
    print(f"     (settings.json illisible : {e})"); sys.exit(0)
hits = [k for k in killers + ["ANTHROPIC_BASE_URL"] if k in env]
print("     settings.json -> variables bloquantes trouvées : " + ", ".join(hits) if hits
      else "     settings.json -> bloc env propre")
PY
fi

if (( CHECK_ONLY )); then
  echo
  (( PROBLEMS == 0 )) && echo "${GRN}Diagnostic OK.${OFF}" || echo "${RED}$PROBLEMS problème(s) à corriger avant que ça marche.${OFF}"
  exit $(( PROBLEMS > 0 ))
fi
(( PROBLEMS > 0 )) && { echo; echo "${RED}Corrigez les points XX ci-dessus d'abord.${OFF}"; exit 1; }

# --- 2. auto-connexion pour toute nouvelle session -----------------------------
step "Auto-connexion (remoteControlAtStartup)"
SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"
[[ -f "$SETTINGS" ]] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$SETTINGS" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path)) or {}
data["remoteControlAtStartup"] = True
json.dump(data, open(path, "w"), indent=2, ensure_ascii=False)
print("     remoteControlAtStartup = true  (sauvegarde .bak créée)")
PY
ok "toute nouvelle session interactive se connectera d'elle-même"

# --- 3. un serveur par projet, persistant --------------------------------------
if (( ${#DIRS[@]} == 0 )); then
  echo
  warn "aucun répertoire projet passé en argument — rien d'autre à faire."
  echo "     Relancez p.ex. : $0 ~/projets/precogn ~/projets/structory"
  exit 0
fi

step "Serveurs Remote Control par projet"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
NAMES=()

for raw in "${DIRS[@]}"; do
  dir="$(cd "$raw" 2>/dev/null && pwd)" || { bad "répertoire introuvable : $raw"; continue; }
  name="$(basename "$dir")"
  sess="claude-$name"

  # Workspace trust : doit être accepté une fois, depuis le répertoire projet.
  if [[ ! -d "$dir/.claude" ]]; then
    warn "$name : lancez une fois \`cd $dir && claude\` pour accepter le workspace trust"
  fi

  if (( USE_SYSTEMD )); then
    cat > "$UNIT_DIR/claude-rc-$name.service" <<EOF
[Unit]
Description=Claude Code Remote Control - $name
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$dir
Environment=TERM=xterm-256color
ExecStart=$(command -v tmux) new-session -d -s $sess -c $dir '$CLAUDE_BIN remote-control --name "$name"'
ExecStop=$(command -v tmux) kill-session -t $sess

[Install]
WantedBy=default.target
EOF
    NAMES+=("$name")
    ok "unité écrite : claude-rc-$name.service  (tmux: $sess)"
  else
    tmux has-session -t "$sess" 2>/dev/null && tmux kill-session -t "$sess"
    tmux new-session -d -s "$sess" -c "$dir" "$CLAUDE_BIN remote-control --name \"$name\""
    ok "tmux $sess démarré dans $dir"
  fi
done

if (( USE_SYSTEMD )); then
  systemctl --user daemon-reload
  # sans lingering, les services user meurent à la déconnexion SSH
  ME="${USER:-$(id -un)}"
  if loginctl show-user "$ME" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    ok "lingering déjà actif"
  else
    if loginctl enable-linger "$ME" 2>/dev/null; then
      ok "lingering activé (les services survivent à la déconnexion et au reboot)"
    else
      warn "lingering non activé — lancez : sudo loginctl enable-linger $ME"
    fi
  fi
  for name in "${NAMES[@]:-}"; do
    [[ -n "$name" ]] || continue
    systemctl --user enable --now "claude-rc-$name.service" && ok "démarré : claude-rc-$name"
  done
fi

cat <<EOF

${GRN}Terminé.${OFF}

Sur le téléphone / la tablette : app Claude -> onglet ${DIM}Code${OFF} -> les sessions
apparaissent par nom, icône ordinateur + pastille verte. Ou claude.ai/code.

Commandes utiles sur le VPS :
  tmux attach -t claude-<projet>          voir le serveur et son QR code (barre espace)
  systemctl --user status claude-rc-*     état des services
  systemctl --user restart claude-rc-<projet>
  journalctl --user -u claude-rc-<projet> -f
EOF
