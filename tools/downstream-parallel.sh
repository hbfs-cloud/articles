#!/usr/bin/env bash
# downstream-parallel — downstream de /scanner, parallélisé sur son vrai graphe.
#
#   bash tools/downstream-parallel.sh <DATE> <ASOF> [--no-push]
#
# --no-push : tout produire, ne rien rendre public. Obligatoire depuis /desk —
# la dernière étape (publish-daily-card) poussait sur main AVANT la barrière de
# fraîcheur, les gates et le panel, donc le contenu était déjà en ligne quand un
# gate le refusait.
#
# L'ordre historique était une file d'attente. Le graphe réel :
#
#   dtx-ingest ─┐
#               ├─► gen-status-page ──► gen-api ──► publish-daily-card
#   (sweep déjà)┘         │
#                         ├─► gen-mode-cards      (indépendants entre eux,
#                         └─► daily-synthesis      ne dépendent que du snapshot)
#
#   refresh-risk-metrics : indépendant, part dès le début
#
# Seul gen-api dépend vraiment de gen-status-page. Les cartes et la synthèse
# tournent en parallèle de lui.
set -uo pipefail
DATE="${1:?usage: downstream-parallel.sh <DATE> <ASOF> [--no-push]}"; ASOF="${2:?}"
NO_PUSH=""
shift 2
while [ $# -gt 0 ]; do case "$1" in --no-push) NO_PUSH="--no-push";; esac; shift; done
DIR="scanner/$DATE"
T0=$(date +%s); log(){ echo "[$(( $(date +%s) - T0 ))s] $*"; }
fail(){ echo "ÉCHEC: $*" >&2; exit 1; }

# 0. risk-metrics : indépendant de tout le reste, part immédiatement
( [ -f /tmp/risk-mcp.json ] && node tools/refresh-risk-metrics.js --ingest /tmp/risk-mcp.json > /tmp/d-risk.log 2>&1 \
    || echo "risk-mcp.json absent — l'AGENT doit le produire (jamais de VaR inventée)" > /tmp/d-risk.log ) & PR=$!

# 1. ingestion dtx (decide + replay OBLIGATOIRES : sans replay, metrics/equity vides
#    et le dashboard retombe sur un placeholder figé — incident du 23/07)
if [ -d "$DIR/_dtx" ]; then
  node tools/dtx-replay-cache.js --dir "$DIR/_dtx" --asof "$ASOF" > /tmp/d-cache.log 2>&1
  for d in "$DIR"/_dtx/decide_*.json; do
    [ -e "$d" ] || continue
    pf=$(basename "$d" .json); pf=${pf#decide_}
    r="$DIR/_dtx/replay_${pf}.json"
    [ -f "$r" ] && node tools/dtx-mcp-ingest.js --portfolio "$pf" --decide "$d" --replay "$r" --asof "$ASOF" >> /tmp/d-dtx.log 2>&1 \
      || echo "  $pf : replay manquant, ingestion SAUTÉE (decide seul = staging stateless)" >> /tmp/d-dtx.log
  done
  node tools/dtx-history-append.js >> /tmp/d-dtx.log 2>&1
  node tools/dtx-pool-bridge.js --folder "$DATE" --date "$ASOF" >> /tmp/d-dtx.log 2>&1
  log "ingestion dtx faite"
fi
wait $PR; log "risk-metrics fait"

# 2. snapshot du jour — point de convergence obligatoire
node tools/gen-status-page.js > /tmp/d-status.log 2>&1 || fail "gen-status-page"
log "status page faite"

# 3. les trois consommateurs du snapshot, EN PARALLÈLE
( node tools/gen-api.js        > /tmp/d-api.log   2>&1; echo $? > /tmp/d-api.rc   ) & P1=$!
( node tools/gen-mode-cards.js > /tmp/d-cards.log 2>&1; echo $? > /tmp/d-cards.rc ) & P2=$!
( node tools/daily-synthesis.js > /tmp/d-synth.log 2>&1; echo $? > /tmp/d-synth.rc ) & P3=$!
wait $P1 $P2 $P3
log "api / cartes / synthèse faits (rc: $(cat /tmp/d-api.rc) $(cat /tmp/d-cards.rc) $(cat /tmp/d-synth.rc))"

# 4. image + QA + (push, sauf --no-push) — le sweep a déjà tourné dans la chaîne C
bash tools/publish-daily-card.sh --no-sweep --no-telegram $NO_PUSH > /tmp/d-card.log 2>&1 || fail "publish-daily-card"
if [ -n "$NO_PUSH" ]; then log "downstream complet — artefacts locaux, aucun push"; else log "downstream complet"; fi
