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
  # Le code retour de l'enrichissement DOIT être testé. Sans ce garde, un
  # sous-shell dont l'avant-dernière commande échoue sort en 0 et écrivait « A OK » :
  # deux lots dilution sur cinq perdus (MCP capricieux, 429, job en timeout)
  # devenaient un scan réputé complet, sur lequel on publiait.
  node tools/collect.js --plan plans/scanner-wave2.json --out "$DIR/_data2" --quiet \
    --vars-file "$DIR/_data/vars.json" --var refdate="$REF" >> /tmp/A1.log 2>&1 \
    || { echo "A3 ÉCHEC — enrichissement incomplet (voir /tmp/A1.log)" > /tmp/A.status; exit 1; }
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
  # --quick : 1m27 contre 6m47 en complet, pour des stats frozen_* IDENTIQUES
  # (A/B du 2026-08-11, 14/14). 362 des 403 trades sont scellés et immuables par
  # règle projet — les re-simuler chaque soir ne change rien. Le sweep COMPLET
  # reste nécessaire une fois par semaine et après tout changement de config.
  SWEEP_MODE="${SWEEP_MODE:---quick}"
  node tools/sweep.js $SWEEP_MODE >> /tmp/C.log 2>&1
  echo "C rc=$?" > /tmp/C.status
) & PC=$!

log "3 chaînes lancées (A vivier+enrichissement · B dtx · C suivi+sweep)"
# Le verdict vient du CODE RETOUR de la chaîne, pas d'un grep dans un fichier de
# statut. Un fichier absent (sous-shell tué, /tmp purgé, deux scans concurrents
# qui se marchent dessus) faisait échouer le grep, donc passer le test : le
# chemin critique était déclaré sain par défaut. Un rc, lui, existe toujours.
wait $PA; ARC=$?; log "A terminée (rc=$ARC) — $(cat /tmp/A.status 2>/dev/null)"
wait $PB; BRC=$?; log "B terminée (rc=$BRC) — $(cat /tmp/B.status 2>/dev/null)"
wait $PC; CRC=$?; log "C terminée (rc=$CRC) — $(cat /tmp/C.status 2>/dev/null)"
if [ "$ARC" -ne 0 ] || grep -q "ÉCHEC" /tmp/A.status 2>/dev/null; then
  echo "Chemin critique en échec (rc=$ARC) — on ne poursuit PAS sur des données partielles." >&2
  exit 1
fi
# B et C ne sont pas le chemin critique du VIVIER, mais un dtx muet vide le pont
# de signaux et un sweep en échec fige les stats. On le dit fort au lieu de le
# laisser dans un log que personne ne rouvre.
[ "$BRC" -ne 0 ] && log "⚠ chaîne dtx en échec (rc=$BRC) — décisions du moteur absentes ce soir (voir /tmp/B.log)"
[ "$CRC" -ne 0 ] && log "⚠ chaîne suivi+sweep en échec (rc=$CRC) — stats non rafraîchies (voir /tmp/C.log)"
log "collecte complète — prêt pour sélection/génération"
