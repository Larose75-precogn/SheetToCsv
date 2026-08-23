#!/usr/bin/env bash
# Remet le Remote Control dans l'état décrit par sessions.json.
# Idempotent : relance uniquement ce qui n'est pas déjà vivant.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${RC_MANIFEST:-$HERE/sessions.json}"
SOCKET="claude-rc"
LOGDIR="${RC_LOGDIR:-$HOME/.local/state/claude-rc}"

log() { printf '[rc-up] %s\n' "$*"; }
die() { printf '[rc-up] ERREUR: %s\n' "$*" >&2; exit 1; }

command -v tmux >/dev/null || die "tmux absent. Installe-le: apt install tmux"
command -v claude >/dev/null || die "CLI claude absent du PATH."
command -v node  >/dev/null || die "node absent (requis pour lire le manifeste)."
[ -f "$MANIFEST" ] || die "manifeste introuvable: $MANIFEST"

mkdir -p "$LOGDIR"

# Le manifeste est aplati en lignes TSV: slug \t name \t cwd \t model \t effort \t perm
ROWS="$(node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const d = m.defaults || {};
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  for (const s of m.sessions || []) {
    if (!s.name || !s.cwd) continue;
    process.stdout.write([
      slug(s.name),
      s.name,
      s.cwd.replace(/^~/, process.env.HOME),
      s.model           || d.model           || "opus",
      s.effort          || d.effort          || "high",
      s.permission_mode || d.permission_mode || "acceptEdits",
    ].join("\t") + "\n");
  }
' "$MANIFEST")" || die "manifeste JSON invalide."

[ -n "$ROWS" ] || die "aucune session dans le manifeste."

tmux -L "$SOCKET" has-session -t rc 2>/dev/null || {
  log "démarrage du serveur tmux ($SOCKET)"
  tmux -L "$SOCKET" new-session -d -s rc -n _keepalive "sleep infinity"
}

started=0; alive=0; failed=0

while IFS=$'\t' read -r slug name cwd model effort perm; do
  [ -n "$slug" ] || continue

  if tmux -L "$SOCKET" list-panes -a -F '#{window_name}' 2>/dev/null | grep -qx "$slug"; then
    log "déjà vivant : $name"
    alive=$((alive + 1))
    continue
  fi

  if [ ! -d "$cwd" ]; then
    log "IGNORÉ : $name — répertoire inexistant: $cwd"
    failed=$((failed + 1))
    continue
  fi

  log "démarrage : $name  [$model / $effort / $perm]"
  tmux -L "$SOCKET" new-window -d -t rc -n "$slug" -c "$cwd" \
    "exec claude --remote-control '$name' \
       --model '$model' --effort '$effort' --permission-mode '$perm' \
       2>&1 | tee -a '$LOGDIR/$slug.log'"
  started=$((started + 1))
done <<< "$ROWS"

log "résultat : $started démarrée(s), $alive déjà vivante(s), $failed en échec"
[ "$failed" -eq 0 ]
