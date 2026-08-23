#!/usr/bin/env bash
# Remet le Remote Control dans l'état décrit par sessions.json.
# Idempotent : relance uniquement ce qui n'est pas déjà vivant.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${RC_MANIFEST:-$HERE/sessions.json}"
SOCKET="claude-rc"
LOGDIR="${RC_LOGDIR:-$HOME/.local/state/claude-rc}"
SEARCH_ROOTS="${RC_SEARCH_ROOTS:-$HOME}"
SEARCH_DEPTH="${RC_SEARCH_DEPTH:-4}"

log() { printf '[rc-up] %s\n' "$*"; }
die() { printf '[rc-up] ERREUR: %s\n' "$*" >&2; exit 2; }

# shellcheck source=/dev/null
[ -f "$HOME/.claude-rc/env" ] && . "$HOME/.claude-rc/env"

# Résout un binaire : variable figée à l'installation, sinon PATH,
# sinon emplacements habituels (nvm, ~/.local/bin, /usr/local/bin...).
resolve_bin() {
  local pinned="$1" name="$2" p
  if [ -n "$pinned" ] && [ -x "$pinned" ]; then printf '%s' "$pinned"; return 0; fi
  if p="$(command -v "$name" 2>/dev/null)"; then printf '%s' "$p"; return 0; fi
  for p in "$HOME/.local/bin/$name" "/usr/local/bin/$name" "/usr/bin/$name" "/bin/$name" \
           "$HOME/.claude/local/$name" "$HOME/.bun/bin/$name"; do
    [ -x "$p" ] && { printf '%s' "$p"; return 0; }
  done
  for p in "$HOME"/.nvm/versions/node/*/bin/"$name"; do
    [ -x "$p" ] && { printf '%s' "$p"; return 0; }
  done
  return 1
}

TMUX_BIN="$(resolve_bin "${TMUX_BIN:-}" tmux)"     || die "tmux introuvable. apt install tmux"
CLAUDE_BIN="$(resolve_bin "${CLAUDE_BIN:-}" claude)" || die "CLI claude introuvable (ni PATH, ni emplacements usuels)."
NODE_BIN="$(resolve_bin "${NODE_BIN:-}" node)"     || die "node introuvable (requis pour lire le manifeste)."
[ -f "$MANIFEST" ] || die "manifeste introuvable: $MANIFEST"

mkdir -p "$LOGDIR"

# Le manifeste est aplati en lignes TSV: slug \t name \t cwd \t model \t effort \t perm
ROWS="$("$NODE_BIN" -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const d = m.defaults || {};
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  for (const s of m.sessions || []) {
    if (!s.name) continue;
    process.stdout.write([
      slug(s.name),
      s.name,
      (s.cwd || "").replace(/^~/, process.env.HOME),
      s.model           || d.model           || "opus",
      s.effort          || d.effort          || "high",
      s.permission_mode || d.permission_mode || "acceptEdits",
    ].join("\x1f") + "\n");
  }
' "$MANIFEST")" || die "manifeste JSON invalide."

[ -n "$ROWS" ] || die "aucune session dans le manifeste."

"$TMUX_BIN" -L "$SOCKET" has-session -t rc 2>/dev/null || {
  log "démarrage du serveur tmux ($SOCKET)"
  "$TMUX_BIN" -L "$SOCKET" new-session -d -s rc -n _keepalive "sleep infinity"
}

started=0; alive=0; failed=0

while IFS=$'\x1f' read -r slug name cwd model effort perm; do
  [ -n "$slug" ] || continue

  if "$TMUX_BIN" -L "$SOCKET" list-panes -a -F '#{window_name}' 2>/dev/null | grep -qx "$slug"; then
    log "déjà vivant : $name"
    alive=$((alive + 1))
    continue
  fi

  # Chemin non renseigné ou disparu : on tente de le retrouver tout seul,
  # en cherchant un dossier dont le nom correspond au nom de la session.
  if [ ! -d "$cwd" ]; then
    token="${name##*/}"
    token="$(printf '%s' "$token" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed 's/-\+/-/g; s/^-//; s/-$//')"
    mapfile -t hits < <(
      find $SEARCH_ROOTS -maxdepth "$SEARCH_DEPTH" -type d \
        \( -name node_modules -o -name .git -o -name .cache \) -prune -o \
        -type d -iname "$token" -print 2>/dev/null | sort -u
    )
    case "${#hits[@]}" in
      1) cwd="${hits[0]}"
         log "chemin retrouvé pour '$name' : $cwd" ;;
      0) # Repli : essayer chaque mot du nom de session (>= 3 lettres).
         # "Structory investor deck narrative restructure" -> le dossier "deck".
         declare -A seen=(); words=()
         for w in $(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' ' '); do
           [ "${#w}" -ge 3 ] || continue
           for h in $(find $SEARCH_ROOTS -maxdepth "$SEARCH_DEPTH" -type d \
                        \( -name node_modules -o -name .git -o -name .cache \) -prune -o \
                        -type d -iname "$w" -print 2>/dev/null); do
             [ -n "${seen[$h]:-}" ] || { seen[$h]=1; words+=("$h"); }
           done
         done
         if [ "${#words[@]}" -eq 1 ]; then
           cwd="${words[0]}"
           log "chemin retrouvé pour '$name' (par mot-clé) : $cwd"
         else
           if [ "${#words[@]}" -eq 0 ]; then
             log "IGNORÉ : $name — aucun dossier correspondant sous: $SEARCH_ROOTS"
           else
             log "IGNORÉ : $name — plusieurs dossiers possibles, précise le cwd :"
             printf '           %s\n' "${words[@]}"
           fi
           failed=$((failed + 1)); continue
         fi ;;
      *) log "IGNORÉ : $name — plusieurs dossiers '$token' possibles, précise le cwd :"
         printf '           %s\n' "${hits[@]}"
         failed=$((failed + 1)); continue ;;
    esac
  fi

  log "démarrage : $name  [$model / $effort / $perm]"
  "$TMUX_BIN" -L "$SOCKET" new-window -d -t rc -n "$slug" -c "$cwd" \
    "exec '$CLAUDE_BIN' --remote-control '$name' \
       --model '$model' --effort '$effort' --permission-mode '$perm' \
       2>&1 | tee -a '$LOGDIR/$slug.log'"
  started=$((started + 1))
done <<< "$ROWS"

log "résultat : $started démarrée(s), $alive déjà vivante(s), $failed en échec"
[ "$failed" -eq 0 ]
