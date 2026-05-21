#!/usr/bin/env bash
# ab-simulation.sh — Retroactive A/B on last 60d WITHOUT touching prod
# Usage: bash tools/ab-simulation.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CUTOFF=$(node -e "console.log(new Date(Date.now()-60*864e5).toISOString().slice(0,10))")

echo "=== A/B Simulation: baseline vs proposed (last 60d from $CUTOFF) ==="

# Step 1: modes-config-proposed.json must already exist (hand-edited by analyst)
if [ ! -f "$ROOT/data/modes-config-proposed.json" ]; then
  cp "$ROOT/data/modes-config.json" "$ROOT/data/modes-config-proposed.json"
  echo "  Created modes-config-proposed.json — edit it with proposed params, then re-run."
  exit 0
fi

# Step 2: sweep baseline (prod config, last 60d)
echo ""
echo "--- Baseline (prod) ---"
node tools/sweep.js --from="$CUTOFF" 2>&1 \
  | grep -E '"(turbo|dynamic|balanced|secured|fortress|tkl)"' -A 12 \
  | grep -E 'winRate|maxDD|sharpe|trades|mode' \
  > /tmp/baseline_metrics.txt
cat /tmp/baseline_metrics.txt

# Step 3: sweep proposed (env-var override, requires 3-line patch in sweep.js)
echo ""
echo "--- Proposed ---"
MODES_CFG_OVERRIDE="$ROOT/data/modes-config-proposed.json" \
  node tools/sweep.js --from="$CUTOFF" 2>&1 \
  | grep -E '"(turbo|dynamic|balanced|secured|fortress|tkl)"' -A 12 \
  | grep -E 'winRate|maxDD|sharpe|trades|mode' \
  > /tmp/proposed_metrics.txt
cat /tmp/proposed_metrics.txt

# Step 4: delta computation + GO/NO-GO
echo ""
echo "--- Delta + GO/NO-GO ---"
node - <<'EOF'
const fs = require('fs');
// Parse helper: extract numeric value after key from a text block
function extract(text, mode, key) {
  const re = new RegExp('"'+mode+'"[\\s\\S]{0,300}'+key+'[":, ]+([0-9.\\-]+)');
  const m = text.match(re);
  return m ? parseFloat(m[1]) : null;
}
const b = fs.readFileSync('/tmp/baseline_metrics.txt','utf8');
const p = fs.readFileSync('/tmp/proposed_metrics.txt','utf8');
const modes = ['turbo','dynamic','balanced','secured','fortress','tkl'];
let go = true;
modes.forEach(mode => {
  const bWR   = extract(b, mode, 'winRate');
  const pWR   = extract(p, mode, 'winRate');
  const bDD   = extract(b, mode, 'maxDD');
  const pDD   = extract(p, mode, 'maxDD');
  const bSh   = extract(b, mode, 'sharpe');
  const pSh   = extract(p, mode, 'sharpe');
  const bCnt  = extract(b, mode, 'trades');
  const pCnt  = extract(p, mode, 'trades');
  const ddOk  = pDD !== null && bDD !== null && Math.abs(pDD) <= Math.abs(bDD);
  const shOk  = pSh !== null && bSh !== null && pSh >= bSh * 0.95;
  // Gate: min 5 closed trades per mode per 15d = 20 per 60d
  const cntOk = pCnt !== null && pCnt >= 20;
  const verdict = ddOk && shOk && cntOk ? 'GO' : 'NO-GO';
  if (verdict === 'NO-GO') go = false;
  console.log(`${mode.padEnd(10)} | MaxDD ${bDD}→${pDD} ${ddOk?'✓':'✗'} | Sharpe ${bSh}→${pSh} ${shOk?'✓':'✗'} | Trades ${bCnt}→${pCnt} ${cntOk?'✓':'✗'} | ${verdict}`);
});
console.log('');
console.log(go ? 'OVERALL: GO — all modes pass' : 'OVERALL: NO-GO — starvation or regression detected');
process.exit(go ? 0 : 1);
EOF
