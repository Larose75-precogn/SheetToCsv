#!/usr/bin/env bash
# Lance une session Remote Control en reprenant son historique quand c'est possible.
# Si --continue échoue rapidement, on relance sans historique : une session
# repart toujours, même si la reprise n'est pas possible.
#
# Usage: rc-launch.sh <claude_bin> <name> <model> <effort> <perm> <try_continue 0|1>
set -u

CLAUDE_BIN="$1"; NAME="$2"; MODEL="$3"; EFFORT="$4"; PERM="$5"; TRY="${6:-0}"
FALLBACK_WINDOW="${RC_FALLBACK_WINDOW:-25}"   # secondes

run() {
  "$CLAUDE_BIN" "$@" --remote-control "$NAME" \
    --model "$MODEL" --effort "$EFFORT" --permission-mode "$PERM"
}

if [ "$TRY" = "1" ]; then
  start=$(date +%s)
  run --continue
  rc=$?
  elapsed=$(( $(date +%s) - start ))

  [ "$rc" -eq 0 ] && exit 0

  # Échec rapide => --continue n'est pas utilisable ici. On repart à vide.
  if [ "$elapsed" -lt "$FALLBACK_WINDOW" ]; then
    echo "[rc-launch] '--continue' a échoué en ${elapsed}s (code $rc) — redémarrage sans historique"
    run
    exit $?
  fi

  # Échec tardif => la session a vécu puis s'est arrêtée. Pas de repli.
  echo "[rc-launch] session terminée après ${elapsed}s (code $rc)"
  exit "$rc"
fi

run
