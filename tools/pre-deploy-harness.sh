#!/usr/bin/env bash
# pre-deploy-harness.sh — Pre-merge validation for PRs A, B, C, P1
# Run from repo root. Exit 1 on any failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0
ok()  { echo "  PASS: $*"; PASS=$((PASS+1)); }
fail(){ echo "  FAIL: $*"; FAIL=$((FAIL+1)); }

echo "=== GATE 1: qa-check.js exits 0 with 0 errors ==="
QA_OUT=$(node tools/qa-check.js 2>&1)
echo "$QA_OUT" | tail -5
if echo "$QA_OUT" | grep -q '❌ 0' && [ $? -eq 0 ]; then
  ok "qa-check 0 errors"
else
  ERRORS=$(echo "$QA_OUT" | grep -oP '❌ \K[0-9]+' || echo "?")
  fail "qa-check reported $ERRORS errors — must be 0"
fi
node tools/qa-check.js > /dev/null 2>&1 && ok "qa-check exit 0" || fail "qa-check non-zero exit"

echo ""
echo "=== GATE 2: sweep.js baseline metrics (proposed config) ==="
# --config flag patch required (see section below).
# After patching sweep.js, run:
SWEEP_OUT=$(MODES_CFG_OVERRIDE="$ROOT/data/modes-config-proposed.json" \
  node tools/sweep.js --from=2025-03-22 2>&1)
echo "$SWEEP_OUT" | grep -E 'winRate|maxDD|sharpe|trades' | head -30

# Extract turbo WR (baseline 60d = 44.8%)
TURBO_WR=$(echo "$SWEEP_OUT" | grep -A5 '"turbo"' | grep -oP 'winRate[": ]+\K[0-9.]+' | head -1)
if [ -n "$TURBO_WR" ]; then
  node -e "const w=$TURBO_WR; process.exit(w>=0.30&&w<=0.60?0:1)" \
    && ok "turbo WR $TURBO_WR in [0.30, 0.60]" \
    || fail "turbo WR $TURBO_WR outside [0.30, 0.60]"
fi

echo ""
echo "=== GATE 3: backtest-trades closed-count == hero trades per mode ==="
node -e "
const fs=require('fs');
const bt=require('./data/backtest-trades.json');
const html=fs.readFileSync('./scanner/status/index.html','utf8');
let allMatch=true;
Object.keys(bt).forEach(mode=>{
  const trades=Array.isArray(bt[mode])?bt[mode]:[];
  const closed=trades.filter(x=>x.exitDate&&x.status!='open'&&x.status!='pending'&&x.exitReason!='premature');
  const re=new RegExp(mode+'[\\s\\S]{0,500}Closed Trades[\\s\\S]{0,200}ps-v[^>]*>([0-9]+)');
  const m=html.match(re);
  if(!m){ console.log('WARN: could not parse hero for',mode); return; }
  const hero=parseInt(m[1]);
  if(hero===closed.length){ console.log('PASS',mode,'hero='+hero+' bt='+closed.length); }
  else{ console.log('FAIL',mode,'hero='+hero+' bt='+closed.length+' MISMATCH'); allMatch=false; }
});
process.exit(allMatch?0:1);
" && ok "hero trades == backtest-trades closed count all modes" \
  || fail "hero/backtest-trades mismatch — re-run gen-status-page.js"

echo ""
echo "=== GATE 4: gen-status-page.js renders without error ==="
node tools/gen-status-page.js > /dev/null 2>&1 \
  && ok "gen-status-page exit 0" \
  || fail "gen-status-page failed"

echo ""
echo "=== GATE 5: no UU merge-conflict markers in changed files ==="
CONFLICT=$(git diff --name-only --diff-filter=U 2>/dev/null | wc -l | tr -d ' ')
[ "$CONFLICT" -eq 0 ] && ok "no merge conflicts" || fail "$CONFLICT files with merge conflicts"

echo ""
echo "=== SUMMARY ==="
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] && echo "GO — all gates passed" && exit 0
echo "NO-GO — $FAIL gate(s) failed" && exit 1
