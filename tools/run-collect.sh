#!/usr/bin/env bash
# run-collect — enveloppe unique de collecte MCP pour tous les skills.
#
#   bash tools/run-collect.sh <plan> <out> [--var k=v ...]
#
# Fait les trois choses que chaque skill refaisait à la main :
#   1. exige un jeton (et dit COMMENT en obtenir un s'il manque) ;
#   2. lance la collecte parallèle ;
#   3. passe le gate de fraîcheur — exit 1 = collecte inexploitable, on ne publie pas.
set -euo pipefail
PLAN="${1:?usage: run-collect.sh <plan> <out> [--var k=v ...]}"; OUT="${2:?}"; shift 2
[ -f plans/"$PLAN".json ] && PLAN="plans/$PLAN.json"

if [ -z "${MCP_TOKEN_MARKETDATA:-}${MCP_ACCESS_TOKEN:-}" ]; then
  cat >&2 <<'MSG'
[run-collect] Aucun jeton MCP dans l'environnement.
  L'AGENT doit en émettre un puis relancer :
    marketdata → GetReadOnlyToken(minutes=60)        (max 60 min)
    systematic → DtxMintReadOnlyToken(ttl_minutes)   (max 1440 min)
  Un jeton NE PEUT PAS se renouveler lui-même : à expiration, réémettre depuis une
  session authentifiée. Le chemin historique --ingest reste valide.
MSG
  exit 3
fi

node tools/collect.js --plan "$PLAN" --out "$OUT" "$@"
rc=$?

if [ -f "$OUT/harness.json" ]; then
  echo "[run-collect] gate de fraîcheur…"
  node tools/check-freshness.js "$OUT/harness.json" || {
    echo "[run-collect] FRAÎCHEUR REFUSÉE — publication interdite. Recollecter, jamais estimer." >&2
    exit 1
  }
fi
exit $rc
