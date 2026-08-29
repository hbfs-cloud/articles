#!/usr/bin/env bash
# run-collect — validated MCP collection wrapper for content workflows.
set -euo pipefail

cd "$(dirname "$0")/.."

PLAN="${1:?usage: run-collect.sh <plan> <out> [--var k=v ...]}"
OUT="${2:?output directory required}"
shift 2
[ -f "plans/$PLAN.json" ] && PLAN="plans/$PLAN.json"

# shellcheck source=tools/lib/mcp-auth.sh
source "$(dirname "$0")/lib/mcp-auth.sh"

node tools/validate-workflows.js --plan "$PLAN"

PLAN_ONLY=0
COLLECT_ARGS=()
for argument in "$@"; do
  case "$argument" in
    --dry-run) ;; # workflow dry-run: collect and validate locally, no external effect exists here
    --plan-only) PLAN_ONLY=1; COLLECT_ARGS+=("$argument") ;;
    *) COLLECT_ARGS+=("$argument") ;;
  esac
done
if [ "$PLAN_ONLY" -eq 0 ]; then
  while IFS= read -r server; do
    [ -n "$server" ] && mcp_require_token "$server"
  done < <(jq -r '[.waves[].calls[]?.server] | unique[]' "$PLAN")
fi

if node tools/collect.js --plan "$PLAN" --out "$OUT" "${COLLECT_ARGS[@]}"; then
  rc=0
else
  rc=$?
fi
[ "$rc" -eq 0 ] || exit "$rc"
[ "$PLAN_ONLY" -eq 1 ] && exit 0

[ -f "$OUT/harness.json" ] || {
  echo "[run-collect] harnais absent — collecte inexploitable." >&2
  exit 1
}

node tools/check-freshness.js "$OUT/harness.json" || {
  echo "[run-collect] fraîcheur refusée — publication interdite." >&2
  exit 1
}
node tools/validate-workflows.js --run-plan "$PLAN" "$OUT"
