#!/usr/bin/env bash
# Scanner with a dated product scope that either requires DTX or records its explicit waiver.
# Usage: bash tools/scan-marketdata-only.sh <DATE> <REFDATE> <ASOF>
# A: collection/enrichment; B: DTX decision/replay; C: historic tracking/sweep; D: rotations/beta.
# Every in-scope source and quality gate remains mandatory.
set -uo pipefail

cd "$(dirname "$0")/.." || { echo "ÉCHEC: racine du dépôt introuvable" >&2; exit 1; }

DATE="${1:?usage: scan-marketdata-only.sh <DATE> <REFDATE> <ASOF>}"; REF="${2:?}"; ASOF="${3:?}"
DIR="scanner/$DATE"; mkdir -p "$DIR"
SYMBOL_ARGS=()
if [ -f "$DIR/_symbol-exclusions.json" ]; then
  SYMBOL_ARGS=("--symbol-exclusions=$DIR/_symbol-exclusions.json")
fi
DTX_REQUIRED=$(node - "$DATE" "$REF" <<'JS'
const date=process.argv[2],ref=process.argv[3];
const scope=require('./tools/lib/scanner-scope').loadScannerScope(process.cwd(),[`--scope=scanner/${date}/_scope.json`]);
if(!scope.provided||scope.audit.date!==date||scope.audit.refdate!==ref)throw Error('Missing exact run-bound scanner component policy');
console.log(scope.active ? '0' : '1');
JS
)
if [ "$?" -ne 0 ]; then exit 2; fi
# Fix the request instant and crypto completed day once for all chain C calls.
AS_OF_TIMESTAMP="${AS_OF_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
CRYPTO_REF=$(node -e 'const d=new Date(process.argv[1]);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-1);console.log(d.toISOString().slice(0,10))' "$AS_OF_TIMESTAMP")
T0=$(date +%s)
log(){ echo "[$(( $(date +%s) - T0 ))s] $*"; }
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/dailytickers-scanner-${DATE}.XXXXXX")
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM
A_LOG="$TMP_ROOT/A.log"; A_STATUS="$TMP_ROOT/A.status"
B_LOG="$TMP_ROOT/B.log"; B_STATUS="$TMP_ROOT/B.status"
C_LOG="$TMP_ROOT/C.log"; C_STATUS="$TMP_ROOT/C.status"
D_LOG="$TMP_ROOT/D.log"; D_STATUS="$TMP_ROOT/D.status"

# shellcheck source=tools/lib/mcp-auth.sh
source tools/lib/mcp-auth.sh
mcp_require_token marketdata || exit $?
if [ "$DTX_REQUIRED" = "1" ]; then mcp_require_token systematic || exit $?; fi


# ── A : vivier puis enrichissement (seule vraie dépendance) ──────────────────
(
  node tools/collect.js --plan plans/scanner-wave1-no-dtx.json --out "$DIR/_data" --quiet --no-cache \
    --var date="$DATE" --var refdate="$REF" > "$A_LOG" 2>&1 || { { echo "A1 ÉCHEC — vivier"; grep -E "✗|ÉCHEC" "$A_LOG"; } > "$A_STATUS"; exit 1; }
  node tools/check-freshness.js "$DIR/_data/harness.json" >> "$A_LOG" 2>&1 \
    && node tools/validate-workflows.js --run-plan plans/scanner-wave1-no-dtx.json "$DIR/_data" >> "$A_LOG" 2>&1 \
    || { echo "A1 ÉCHEC — contrat/fraîcheur" > "$A_STATUS"; exit 1; }
  node tools/regime-reconcile.js --dir "$DIR" --refdate "$REF" "--scope=$DIR/_scope.json" --json >> "$A_LOG" 2>&1 \
    || { echo "A1 ÉCHEC — autorité du régime" > "$A_STATUS"; exit 1; }
  HISTORY_ARGS=()
  if [ -f "$DIR/_history-rejections.json" ]; then
    HISTORY_EXCLUDES=$(node tools/scanner-history-rejections.js csv --file "$DIR/_history-rejections.json") \
      || { echo "A2 ÉCHEC — manifeste de rejets historiques invalide" > "$A_STATUS"; exit 1; }
    HISTORY_ARGS=(--exclude "$HISTORY_EXCLUDES")
  fi
  node tools/extract-universe.js --in "$DIR/_data" --out "$DIR/_data/vars.json" --limit 150 "${HISTORY_ARGS[@]}" \
    >> "$A_LOG" 2>&1 || { echo "A2 ÉCHEC — vivier vide" > "$A_STATUS"; exit 1; }
  # Le code retour de l'enrichissement DOIT être testé. Sans ce garde, un
  # sous-shell dont l'avant-dernière commande échoue sort en 0 et écrivait « A OK » :
  # deux lots dilution sur cinq perdus (MCP capricieux, 429, job en timeout)
  # devenaient un scan réputé complet, sur lequel on publiait.
  node tools/collect.js --plan plans/scanner-wave2.json --out "$DIR/_data2" --quiet --no-cache \
    --vars-file "$DIR/_data/vars.json" --var date="$DATE" --var refdate="$REF" >> "$A_LOG" 2>&1 \
    || { { echo "A3 ÉCHEC — enrichissement incomplet"; grep -E "✗|ÉCHEC" "$A_LOG"; } > "$A_STATUS"; exit 1; }
  node tools/check-freshness.js "$DIR/_data2/harness.json" >> "$A_LOG" 2>&1 \
    && node tools/validate-workflows.js --run-plan plans/scanner-wave2.json "$DIR/_data2" >> "$A_LOG" 2>&1 \
    || { echo "A3 ÉCHEC — contrat/fraîcheur" > "$A_STATUS"; exit 1; }
  echo "A OK" > "$A_STATUS"
) & PA=$!

# ── B : décision + replay DTX (information moteur, aucune exécution broker) ───
if [ "$DTX_REQUIRED" = "1" ]; then
(
  # request_id doit être un UUID v4 (tools/lib/workflow-contract.js). Dérivé du nom logique de la
  # séance : stable d'une relance à l'autre (idempotence DTX), conforme au contrat.
  REQUEST_ID=$(node -e 'const h=require("crypto").createHash("sha256").update(process.argv[1]).digest("hex");const v=((parseInt(h[16],16)&3)|8).toString(16);console.log(`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${v}${h.slice(17,20)}-${h.slice(20,32)}`)' "scanner-${DATE}-etf-us-evening-001")
  # Mode piloté par le catalogue (décision du propriétaire du 2026-09-24, jusqu'à nouvel ordre) :
  # compare_only tant qu'etf_us n'est pas eligible_for_live, décision Contract V2 sinon.
  DTX_MODE=$(node tools/dtx-live-mode.js --portfolio etf_us 2>> "$B_LOG") \
    || { echo "B ÉCHEC — lecture du catalogue DTX" > "$B_STATUS"; exit 1; }
  echo "[dtx] mode=$DTX_MODE (DtxCatalog eligible_for_live)" >> "$B_LOG"
  node tools/collect.js --plan plans/scanner-dtx.json --out "$DIR/_dtx" --quiet --no-cache \
    --var date="$DATE" --var refdate="$REF" --var request_id="$REQUEST_ID" --var dtx_mode="$DTX_MODE" >> "$B_LOG" 2>&1 \
    || { echo "B ÉCHEC — collecte DTX" > "$B_STATUS"; exit 1; }
  DECIDE_FILE="$DIR/_dtx/decide_etf_us.json"
  if [ "$DTX_MODE" = "compare_only" ]; then DECIDE_FILE="$DIR/_dtx/decide_etf_us_compare.json"; fi
  node tools/check-freshness.js "$DIR/_dtx/harness.json" >> "$B_LOG" 2>&1 \
    && node tools/validate-workflows.js --run-plan plans/scanner-dtx.json "$DIR/_dtx" >> "$B_LOG" 2>&1 \
    || { echo "B ÉCHEC — contrat/fraîcheur DTX" > "$B_STATUS"; exit 1; }
  node tools/dtx-mcp-ingest.js --portfolio etf_us \
    --decide "$DECIDE_FILE" --replay "$DIR/_dtx/replay_etf_us.json" \
    --asof "$REF" --expected-close "$REF" --from 2021-01-01 --to "$REF" >> "$B_LOG" 2>&1 \
    || { echo "B ÉCHEC — ingestion DTX" > "$B_STATUS"; exit 1; }
  node - "$DATE" >> "$B_LOG" 2>&1 <<'JS'
const date=process.argv[2];
const iso=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
const result=require('./tools/dtx-scan').writeStagingCompleteness(iso);
if(!result.complete) throw Error('DTX staging incomplete');
JS
  [ "$?" -eq 0 ] || { echo "B ÉCHEC — complétude staging DTX" > "$B_STATUS"; exit 1; }
  echo "B OK (DTX etf_us → best; information seulement)" > "$B_STATUS"
) & PB=$!
else
  echo "B WAIVED (DTX explicitement exclu par le scope daté)" > "$B_STATUS"
  PB=""
fi

# ── C : suivi + sweep (ne portent que sur des trades déjà scellés) ───────────
(
  node tools/update-tracking.js "${SYMBOL_ARGS[@]}" --refdate "$REF" --asof "$AS_OF_TIMESTAMP" > "$C_LOG" 2>&1 || { echo "C ÉCHEC — tracking" > "$C_STATUS"; exit 1; }
  # --quick : 1m27 contre 6m47 en complet, pour des stats frozen_* IDENTIQUES
  # (A/B du 2026-08-11, 14/14). 362 des 403 trades sont scellés et immuables par
  # règle projet — les re-simuler chaque soir ne change rien. Le sweep COMPLET
  # reste nécessaire une fois par semaine et après tout changement de config.
  SWEEP_MODE="${SWEEP_MODE:---quick}"
  # Le sweep COMPLET (grille 24,7M combos, 120+ scans) dépasse le heap node par défaut (~4 Go)
  # depuis mi-août 2026 : OOM silencieux en pleine pré-sim (constaté le 16/08, exit masqué par un
  # pipe). 8 Go suffisent ; sans effet notable sur --quick.
  NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" node tools/sweep.js $SWEEP_MODE "${SYMBOL_ARGS[@]}" --refdate "$REF" --crypto-refdate "$CRYPTO_REF" --asof "$AS_OF_TIMESTAMP" "--scope=$DIR/_scope.json" >> "$C_LOG" 2>&1
  SWEEP_RC=$?
  [ "$SWEEP_RC" -ne 0 ] && { echo "C ÉCHEC — sweep" > "$C_STATUS"; exit "$SWEEP_RC"; }
  # Cycle de vie des analyses (statuts sur clôtures + endpoint du garde-fou JS des pages).
  # Le cycle de vie est une sortie publiée du scanner : un échec bloque le run.
  node tools/analyses-lifecycle.js "${SYMBOL_ARGS[@]}" --refdate "$REF" --asof "$AS_OF_TIMESTAMP" >> "$C_LOG" 2>&1
  LIFECYCLE_RC=$?
  [ "$LIFECYCLE_RC" -ne 0 ] && { echo "C ÉCHEC — lifecycle" > "$C_STATUS"; exit "$LIFECYCLE_RC"; }
  echo "C rc=0 (tracking/sweep/lifecycle)" > "$C_STATUS"
  exit 0
) & PC=$!

# ── D : rotations sectorielles + plus hauts beta par sous-jacent (page /rotation/) ──
# Indépendant du panier, mais publication-critical : RankBeta + barres sectorielles alimentent une
# sortie publique. Un échec ou une preuve stale bloque donc le run au même titre que les autres chaînes.
(
  REFDATE="$REF" node tools/gen-rotation-beta.js --out-dir "$DIR/_rotation" > "$D_LOG" 2>&1
  D_RC=$?
  echo "D rc=$D_RC" > "$D_STATUS"
  exit "$D_RC"
) & PD=$!

log "chaînes lancées (A vivier+enrichissement · B DTX si requis · C suivi+sweep · D rotations/beta)"
# Le verdict vient du CODE RETOUR de la chaîne, pas d'un grep dans un fichier de
# statut. Un fichier absent (sous-shell tué, /tmp purgé, deux scans concurrents
# qui se marchent dessus) faisait échouer le grep, donc passer le test : le
# chemin critique était déclaré sain par défaut. Un rc, lui, existe toujours.
wait $PA; ARC=$?; log "A terminée (rc=$ARC) — $(cat "$A_STATUS" 2>/dev/null)"
if [ -n "$PB" ]; then wait $PB; BRC=$?; else BRC=0; fi
log "B terminée (rc=$BRC) — $(cat "$B_STATUS" 2>/dev/null)"
wait $PC; CRC=$?; log "C terminée (rc=$CRC) — $(cat "$C_STATUS" 2>/dev/null)"
wait $PD; DRC=$?; log "D terminée (rc=$DRC) — $(cat "$D_STATUS" 2>/dev/null)"
if [ "$ARC" -ne 0 ] || [ "$BRC" -ne 0 ] || grep -q "ÉCHEC" "$A_STATUS" "$B_STATUS" 2>/dev/null; then
  trap - EXIT HUP INT TERM
  echo "Journaux conservés dans $TMP_ROOT" >&2
  echo "Chemin critique en échec (A=$ARC B=$BRC) — on ne poursuit PAS sur des données partielles." >&2
  exit 1
fi
# Chaque chaîne alimente une sortie publiée. Une seule chaîne stale interdit la publication.
if [ "$CRC" -ne 0 ] || [ "$DRC" -ne 0 ]; then
  [ "$CRC" -ne 0 ] && log "chaîne suivi+sweep+lifecycle en échec (rc=$CRC) — stats/statuts non rafraîchis"
  [ "$DRC" -ne 0 ] && log "chaîne rotations/beta en échec (rc=$DRC) — sortie non rafraîchie"
  trap - EXIT HUP INT TERM
  echo "Collecte incomplète : publication interdite. Journaux conservés dans $TMP_ROOT." >&2
  exit 1
fi
log "collecte complète — prêt pour sélection/génération"
