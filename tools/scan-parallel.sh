#!/usr/bin/env bash
# scan-parallel — lance EN PARALLÈLE les quatre chaînes indépendantes de /scanner.
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
# Le temps mural devient max(A, B, C, D) au lieu de A+B+C+D.
set -uo pipefail

cd "$(dirname "$0")/.." || { echo "ÉCHEC: racine du dépôt introuvable" >&2; exit 1; }

DATE="${1:?usage: scan-parallel.sh <DATE> <REFDATE> <ASOF>}"; REF="${2:?}"; ASOF="${3:?}"
DIR="scanner/$DATE"; mkdir -p "$DIR"
T0=$(date +%s)
AS_OF_TIMESTAMP=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
log(){ echo "[$(( $(date +%s) - T0 ))s] $*"; }
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/dailytickers-scanner-${DATE}.XXXXXX")
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM
A_LOG="$TMP_ROOT/A.log"; A_STATUS="$TMP_ROOT/A.status"
B_LOG="$TMP_ROOT/B.log"; B_CACHE_LOG="$TMP_ROOT/B-cache.log"; B_STATUS="$TMP_ROOT/B.status"
C_LOG="$TMP_ROOT/C.log"; C_STATUS="$TMP_ROOT/C.status"
D_LOG="$TMP_ROOT/D.log"; D_STATUS="$TMP_ROOT/D.status"

# shellcheck source=tools/lib/mcp-auth.sh
source tools/lib/mcp-auth.sh
mcp_require_token marketdata || exit $?
mcp_require_token systematic || exit $?

# Reuse one stable DTX request id across technical retries and process restarts.
REQ_FILE="$DIR/_dtx/request-id.txt"
mkdir -p "$DIR/_dtx"
if [ ! -s "$REQ_FILE" ]; then
  node -e 'require("fs").writeFileSync(process.argv[1], require("crypto").randomUUID()+"\n", {mode:0o600})' "$REQ_FILE"
fi
DTX_REQUEST_ID="$(tr -d '\r\n' < "$REQ_FILE")"

# ── A : vivier puis enrichissement (seule vraie dépendance) ──────────────────
(
  node tools/collect.js --plan plans/scanner-wave1.json --out "$DIR/_data" --quiet \
    --var date="$DATE" --var refdate="$REF" --var as_of_timestamp="$AS_OF_TIMESTAMP" > "$A_LOG" 2>&1 || { { echo "A1 ÉCHEC — vivier"; grep -E "✗|ÉCHEC" "$A_LOG"; } > "$A_STATUS"; exit 1; }
  node tools/check-freshness.js "$DIR/_data/harness.json" >> "$A_LOG" 2>&1 \
    && node tools/validate-workflows.js --run-plan plans/scanner-wave1.json "$DIR/_data" >> "$A_LOG" 2>&1 \
    || { echo "A1 ÉCHEC — contrat/fraîcheur" > "$A_STATUS"; exit 1; }
  node tools/extract-universe.js --in "$DIR/_data" --out "$DIR/_data/vars.json" --limit 60 \
    >> "$A_LOG" 2>&1 || { echo "A2 ÉCHEC — vivier vide" > "$A_STATUS"; exit 1; }
  # Le code retour de l'enrichissement DOIT être testé. Sans ce garde, un
  # sous-shell dont l'avant-dernière commande échoue sort en 0 et écrivait « A OK » :
  # deux lots dilution sur cinq perdus (MCP capricieux, 429, job en timeout)
  # devenaient un scan réputé complet, sur lequel on publiait.
  node tools/collect.js --plan plans/scanner-wave2.json --out "$DIR/_data2" --quiet \
    --vars-file "$DIR/_data/vars.json" --var date="$DATE" --var refdate="$REF" --var as_of_timestamp="$AS_OF_TIMESTAMP" >> "$A_LOG" 2>&1 \
    || { { echo "A3 ÉCHEC — enrichissement incomplet"; grep -E "✗|ÉCHEC" "$A_LOG"; } > "$A_STATUS"; exit 1; }
  node tools/check-freshness.js "$DIR/_data2/harness.json" >> "$A_LOG" 2>&1 \
    && node tools/validate-workflows.js --run-plan plans/scanner-wave2.json "$DIR/_data2" >> "$A_LOG" 2>&1 \
    || { echo "A3 ÉCHEC — contrat/fraîcheur" > "$A_STATUS"; exit 1; }
  echo "A OK" > "$A_STATUS"
) & PA=$!

# ── B : dtx (aucune dépendance au scan du jour) ──────────────────────────────
(
  # The systematic TTL token for scanner runs is minted with scope=refresh. This
  # call is a no-op when DTX already covers REF; otherwise it starts the bounded,
  # idempotent server refresh and polls health before any decision/replay call.
  node tools/dtx-refresh-if-stale.js --expected-close "$REF" > "$B_LOG" 2>&1 \
    || { echo "B rc=1 (DTX refresh/health blocked)" > "$B_STATUS"; exit 1; }
  # Le cache décide AVANT la collecte quels backtests méritent d'être rejoués.
  # Un DtxReplay coûte 300-348 s et n'avance que d'une séance par jour.
  # --plan : le cache doit connaître le portefeuille ATTENDU, pas seulement ceux
  # qui ont déjà un fichier dans le staging. Sans ça, un portefeuille jamais rejoué est
  # invisible, le compte tombe à « 0 à rejouer », on bascule en decide-only et il n'est
  # JAMAIS collecté (hvep et stockbox_pit, jusqu'au 2026-08-11).
  DTX_PLAN=plans/scanner-dtx.json
  node tools/dtx-replay-cache.js --dir "$DIR/_dtx" --asof "$ASOF" --refdate "$REF" --max-age-days 0 --plan "$DTX_PLAN" > "$B_CACHE_LOG" 2>&1 || true
  PLAN="$DTX_PLAN"
  if [ -f "$DIR/_dtx/_replay_needed.json" ] && [ "$(node -e "try{console.log((require('./$DIR/_dtx/_replay_needed.json').replay||[]).length)}catch(e){console.log(99)}")" = "0" ]; then
    PLAN=plans/scanner-dtx-decide-only.json   # tous les backtests sont à jour
  fi
  node tools/collect.js --plan "$PLAN" --out "$DIR/_dtx" --quiet \
    --var date="$DATE" --var refdate="$REF" --var asof="$ASOF" --var request_id="$DTX_REQUEST_ID" > "$B_LOG" 2>&1
  B_COLLECT_RC=$?
  if [ "$B_COLLECT_RC" -eq 0 ]; then
    node tools/check-freshness.js "$DIR/_dtx/harness.json" >> "$B_LOG" 2>&1 \
      && node tools/validate-workflows.js --run-plan "$PLAN" "$DIR/_dtx" >> "$B_LOG" 2>&1
    B_COLLECT_RC=$?
  fi
  node tools/dtx-replay-cache.js --dir "$DIR/_dtx" --asof "$ASOF" --refdate "$REF" --max-age-days 0 --plan "$DTX_PLAN" >> "$B_CACHE_LOG" 2>&1 || true
  echo "B rc=$B_COLLECT_RC (plan $PLAN)" > "$B_STATUS"
  exit "$B_COLLECT_RC"
) & PB=$!

# ── C : suivi + sweep (ne portent que sur des trades déjà scellés) ───────────
(
  C_RC=0
  echo "Legacy OHLC tracking disabled: no broker-certified ledger, no synthetic fills" > "$C_LOG"
  # --quick : 1m27 contre 6m47 en complet, pour des stats frozen_* IDENTIQUES
  # (A/B du 2026-08-11, 14/14). 362 des 403 trades sont scellés et immuables par
  # règle projet — les re-simuler chaque soir ne change rien. Le sweep COMPLET
  # reste nécessaire une fois par semaine et après tout changement de config.
  SWEEP_MODE="${SWEEP_MODE:---quick}"
  # Le sweep COMPLET (grille 24,7M combos, 120+ scans) dépasse le heap node par défaut (~4 Go)
  # depuis mi-août 2026 : OOM silencieux en pleine pré-sim (constaté le 16/08, exit masqué par un
  # pipe). 8 Go suffisent ; sans effet notable sur --quick.
  NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" node tools/sweep.js $SWEEP_MODE >> "$C_LOG" 2>&1
  SWEEP_RC=$?
  [ "$SWEEP_RC" -ne 0 ] && C_RC="$SWEEP_RC"
  # Cycle de vie des analyses (statuts sur clôtures + endpoint du garde-fou JS des pages).
  # Le cycle de vie est une sortie publiée du scanner : un échec bloque le run.
  node tools/analyses-lifecycle.js >> "$C_LOG" 2>&1
  LIFECYCLE_RC=$?
  [ "$LIFECYCLE_RC" -ne 0 ] && C_RC="$LIFECYCLE_RC"
  echo "C rc=$C_RC (tracking/sweep/lifecycle)" > "$C_STATUS"
  exit "$C_RC"
) & PC=$!

# ── D : rotations sectorielles + plus hauts beta par sous-jacent (page /rotation/) ──
# Indépendant du panier, mais publication-critical : RankBeta + barres sectorielles alimentent une
# sortie publique. Un échec ou une preuve stale bloque donc le run au même titre que les autres chaînes.
(
  REFDATE="$REF" node tools/gen-rotation-beta.js > "$D_LOG" 2>&1
  D_RC=$?
  echo "D rc=$D_RC" > "$D_STATUS"
  exit "$D_RC"
) & PD=$!

log "4 chaînes lancées (A vivier+enrichissement · B dtx · C suivi+sweep · D rotations/beta)"
# Le verdict vient du CODE RETOUR de la chaîne, pas d'un grep dans un fichier de
# statut. Un fichier absent (sous-shell tué, /tmp purgé, deux scans concurrents
# qui se marchent dessus) faisait échouer le grep, donc passer le test : le
# chemin critique était déclaré sain par défaut. Un rc, lui, existe toujours.
wait $PA; ARC=$?; log "A terminée (rc=$ARC) — $(cat "$A_STATUS" 2>/dev/null)"
wait $PB; BRC=$?; log "B terminée (rc=$BRC) — $(cat "$B_STATUS" 2>/dev/null)"
wait $PC; CRC=$?; log "C terminée (rc=$CRC) — $(cat "$C_STATUS" 2>/dev/null)"
wait $PD; DRC=$?; log "D terminée (rc=$DRC) — $(cat "$D_STATUS" 2>/dev/null)"
if [ "$ARC" -ne 0 ] || grep -q "ÉCHEC" "$A_STATUS" 2>/dev/null; then
  echo "Chemin critique en échec (rc=$ARC) — on ne poursuit PAS sur des données partielles." >&2
  exit 1
fi
# Chaque chaîne alimente une sortie publiée. Une seule chaîne stale interdit la publication.
if [ "$BRC" -ne 0 ] || [ "$CRC" -ne 0 ] || [ "$DRC" -ne 0 ]; then
  [ "$BRC" -ne 0 ] && log "chaîne dtx en échec (rc=$BRC) — décisions/replay absents ou invalides"
  [ "$CRC" -ne 0 ] && log "chaîne suivi+sweep+lifecycle en échec (rc=$CRC) — stats/statuts non rafraîchis"
  [ "$DRC" -ne 0 ] && log "chaîne rotations/beta en échec (rc=$DRC) — sortie non rafraîchie"
  trap - EXIT HUP INT TERM
  echo "Collecte incomplète : publication interdite. Journaux conservés dans $TMP_ROOT." >&2
  exit 1
fi
log "collecte complète — prêt pour sélection/génération"
