#!/usr/bin/env bash
# scan-parallel — lance EN PARALLÈLE les trois chaînes indépendantes de /scanner.
#
#   bash tools/scan-parallel.sh <DATE> <REFDATE> <ASOF>
#
# Le pipeline historique enchaînait tout en série alors que seul un lien est réel :
# le vivier doit précéder l'enrichissement. Le reste ne dépend de rien.
#
#   A  vivier ──► enrichissement          (chemin critique, ~200 s)
#   B  dtx : décisions + backtests        (indépendant du scan du jour)
#   C  suivi des cours ──► sweep          (ne traite que des trades passés)
#
# Le temps mural devient max(A, B, C) au lieu de A+B+C.
set -uo pipefail
DATE="${1:?usage: scan-parallel.sh <DATE> <REFDATE> <ASOF>}"; REF="${2:?}"; ASOF="${3:?}"
DIR="scanner/$DATE"; mkdir -p "$DIR"
T0=$(date +%s)
log(){ echo "[$(( $(date +%s) - T0 ))s] $*"; }

[ -z "${MCP_TOKEN_MARKETDATA:-}" ] && { echo "Aucun jeton — émettre GetReadOnlyToken puis relancer." >&2; exit 3; }

# ── A : vivier puis enrichissement (seule vraie dépendance) ──────────────────
(
  node tools/collect.js --plan plans/scanner-wave1.json --out "$DIR/_data" --quiet \
    --var refdate="$REF" > /tmp/A1.log 2>&1 || { echo "A1 ÉCHEC" > /tmp/A.status; exit 1; }
  node tools/extract-universe.js --in "$DIR/_data" --out "$DIR/_data/vars.json" --limit 60 \
    >> /tmp/A1.log 2>&1 || { echo "A2 ÉCHEC — vivier vide" > /tmp/A.status; exit 1; }
  node tools/collect.js --plan plans/scanner-wave2.json --out "$DIR/_data2" --quiet \
    --vars-file "$DIR/_data/vars.json" --var refdate="$REF" >> /tmp/A1.log 2>&1
  echo "A OK" > /tmp/A.status
) & PA=$!

# ── B : dtx (aucune dépendance au scan du jour) ──────────────────────────────
(
  # Le cache décide AVANT la collecte quels backtests méritent d'être rejoués.
  # Un DtxReplay coûte 300-348 s et n'avance que d'une séance par jour.
  node tools/dtx-replay-cache.js --dir "$DIR/_dtx" --asof "$ASOF" > /tmp/B-cache.log 2>&1 || true
  PLAN=plans/scanner-dtx.json
  if [ -f "$DIR/_dtx/_replay_needed.json" ] && [ "$(node -e "try{console.log((require('./$DIR/_dtx/_replay_needed.json').replay||[]).length)}catch(e){console.log(99)}")" = "0" ]; then
    PLAN=plans/scanner-dtx-decide-only.json   # tous les backtests sont à jour
  fi
  node tools/collect.js --plan "$PLAN" --out "$DIR/_dtx" --quiet \
    --var refdate="$REF" --var asof="$ASOF" > /tmp/B.log 2>&1
  node tools/dtx-replay-cache.js --dir "$DIR/_dtx" --asof "$ASOF" >> /tmp/B-cache.log 2>&1 || true
  echo "B rc=$? (plan $PLAN)" > /tmp/B.status
) & PB=$!

# ── C : suivi + sweep (ne portent que sur des trades déjà scellés) ───────────
(
  node tools/update-tracking.js > /tmp/C.log 2>&1
  node tools/sweep.js >> /tmp/C.log 2>&1
  echo "C rc=$?" > /tmp/C.status
) & PC=$!

log "3 chaînes lancées (A vivier+enrichissement · B dtx · C suivi+sweep)"
wait $PA; log "A terminée — $(cat /tmp/A.status 2>/dev/null)"
wait $PB; log "B terminée — $(cat /tmp/B.status 2>/dev/null)"
wait $PC; log "C terminée — $(cat /tmp/C.status 2>/dev/null)"
grep -q "ÉCHEC" /tmp/A.status 2>/dev/null && { echo "Chemin critique en échec — on ne poursuit PAS sur des données partielles." >&2; exit 1; }
log "collecte complète — prêt pour sélection/génération"
