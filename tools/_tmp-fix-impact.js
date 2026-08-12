'use strict';
const fs = require('fs');
const path = require('path');

const t = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/backtest-trades.json'), 'utf8'));
const modes = ['turbo', 'dynamic', 'balanced', 'secured', 'fortress', 'tkl'];
const sizeMult = { 'RISK-ON': 1.0, 'NEUTRAL': 1.0, 'RECOVERY': 1.0, 'EARLY RISK-OFF': 0.75, 'RISK-OFF': 0.5, 'unknown': 1.0 };

// Build scanDate → regime map by reading scanner/*/signals.json
const scannerDir = path.join(__dirname, '../scanner');
const dateRegime = {};
for (const d of fs.readdirSync(scannerDir)) {
  if (!/^\d{8}$/.test(d)) continue;
  const sigP = path.join(scannerDir, d, 'signals.json');
  if (!fs.existsSync(sigP)) continue;
  try {
    const s = JSON.parse(fs.readFileSync(sigP, 'utf8'));
    const iso = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    dateRegime[iso] = s.regime || s.regimeLabel || null;
  } catch {}
}

function regimeFor(tr) {
  return tr.regime || dateRegime[tr.scanDate] || dateRegime[tr.entryDate] || 'unknown';
}

console.log('=== Trade regime coverage check ===');
let totalKnown = 0, totalUnknown = 0;
for (const m of modes) {
  let k = 0, u = 0;
  for (const tr of t[m] || []) {
    if (tr.status === 'pending') continue;
    if (regimeFor(tr) === 'unknown') u++;
    else k++;
  }
  totalKnown += k;
  totalUnknown += u;
  console.log(`${m.padEnd(9)} known=${String(k).padStart(3)}  unknown=${String(u).padStart(3)}`);
}
console.log(`TOTAL    known=${totalKnown}  unknown=${totalUnknown}`);
console.log();

// ============ FIX #1 — Regime size multiplier (live executor) ============
console.log('=== FIX #1 — regimeSizeMultiplier in live (0.75x EARLY RISK-OFF, 0.5x RISK-OFF) ===');
console.log('Mode      |  Current  |  Fix #1   |    Δ      | ERO trades | ERO PnL avg');
for (const m of modes) {
  const trades = (t[m] || []).filter(x => x.status !== 'pending');
  const curr = trades.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const fixed = trades.reduce((s, tr) => s + (tr.pnlPct || 0) * (sizeMult[regimeFor(tr)] || 1.0), 0);
  const eroTrades = trades.filter(tr => regimeFor(tr) === 'EARLY RISK-OFF');
  const eroPnL = eroTrades.length ? eroTrades.reduce((s, tr) => s + (tr.pnlPct || 0), 0) / eroTrades.length : 0;
  const delta = fixed - curr;
  console.log(
    `${m.padEnd(9)} | ${(curr >= 0 ? '+' : '') + curr.toFixed(2)}%`.padEnd(20) +
    ` | ${(fixed >= 0 ? '+' : '') + fixed.toFixed(2)}%`.padEnd(11) +
    ` | ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}pp`.padEnd(10) +
    ` | ${String(eroTrades.length).padStart(10)}` +
    ` | ${(eroPnL >= 0 ? '+' : '') + eroPnL.toFixed(2)}%`
  );
}
console.log();

// ============ FIX #2 — VIX kill at 22 on Turbo/Dynamic (skip EARLY RISK-OFF + RISK-OFF entries) ============
console.log('=== FIX #2 — Tighter vixKill (skip new entries when regime ∈ {EARLY RISK-OFF, RISK-OFF}) ===');
console.log('Apply only to: turbo, dynamic, secured');
console.log('Mode      |  Current  |  Fix #2   |    Δ      | Skipped trades | Avg pnl of skipped');
for (const m of modes) {
  const trades = (t[m] || []).filter(x => x.status !== 'pending');
  const curr = trades.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const apply = ['turbo', 'dynamic', 'secured'].includes(m);
  const skipRegimes = new Set(['EARLY RISK-OFF', 'RISK-OFF']);
  const skipped = apply ? trades.filter(tr => skipRegimes.has(regimeFor(tr))) : [];
  const kept = trades.filter(tr => !apply || !skipRegimes.has(regimeFor(tr)));
  const fixed = kept.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const skippedAvg = skipped.length ? skipped.reduce((s, tr) => s + (tr.pnlPct || 0), 0) / skipped.length : 0;
  const delta = fixed - curr;
  console.log(
    `${m.padEnd(9)} | ${(curr >= 0 ? '+' : '') + curr.toFixed(2)}%`.padEnd(20) +
    ` | ${(fixed >= 0 ? '+' : '') + fixed.toFixed(2)}%`.padEnd(11) +
    ` | ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}pp`.padEnd(10) +
    ` | ${String(skipped.length).padStart(14)}` +
    ` | ${(skippedAvg >= 0 ? '+' : '') + skippedAvg.toFixed(2)}%`
  );
}
console.log();

// ============ FIX #3 — Score lift +2 in EARLY RISK-OFF (skip trades with score < 92) ============
console.log('=== FIX #3 — Score lift +2pts in EARLY RISK-OFF (skip score<92 in that regime) ===');
console.log('Mode      |  Current  |  Fix #3   |    Δ      | Skipped trades | Avg pnl of skipped');
for (const m of modes) {
  const trades = (t[m] || []).filter(x => x.status !== 'pending');
  const curr = trades.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const skipped = trades.filter(tr => regimeFor(tr) === 'EARLY RISK-OFF' && (tr.score || 0) < 92);
  const kept = trades.filter(tr => !(regimeFor(tr) === 'EARLY RISK-OFF' && (tr.score || 0) < 92));
  const fixed = kept.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const skippedAvg = skipped.length ? skipped.reduce((s, tr) => s + (tr.pnlPct || 0), 0) / skipped.length : 0;
  const delta = fixed - curr;
  console.log(
    `${m.padEnd(9)} | ${(curr >= 0 ? '+' : '') + curr.toFixed(2)}%`.padEnd(20) +
    ` | ${(fixed >= 0 ? '+' : '') + fixed.toFixed(2)}%`.padEnd(11) +
    ` | ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}pp`.padEnd(10) +
    ` | ${String(skipped.length).padStart(14)}` +
    ` | ${(skippedAvg >= 0 ? '+' : '') + skippedAvg.toFixed(2)}%`
  );
}
console.log();

// ============ COMBINED — all 3 fixes together ============
console.log('=== COMBINED — Fix #1 + #2 + #3 ===');
console.log('Mode      |  Current  | Combined  |    Δ      | Trades kept / total');
for (const m of modes) {
  const trades = (t[m] || []).filter(x => x.status !== 'pending');
  const curr = trades.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const apply2 = ['turbo', 'dynamic', 'secured'].includes(m);
  const skipRegimes = new Set(['EARLY RISK-OFF', 'RISK-OFF']);
  const kept = trades.filter(tr => {
    const reg = regimeFor(tr);
    // Fix #2: skip if vixKill applies
    if (apply2 && skipRegimes.has(reg)) return false;
    // Fix #3: skip if EARLY RISK-OFF and score < 92
    if (reg === 'EARLY RISK-OFF' && (tr.score || 0) < 92) return false;
    return true;
  });
  // Fix #1: apply size mult on kept trades
  const fixed = kept.reduce((s, tr) => s + (tr.pnlPct || 0) * (sizeMult[regimeFor(tr)] || 1.0), 0);
  const delta = fixed - curr;
  console.log(
    `${m.padEnd(9)} | ${(curr >= 0 ? '+' : '') + curr.toFixed(2)}%`.padEnd(20) +
    ` | ${(fixed >= 0 ? '+' : '') + fixed.toFixed(2)}%`.padEnd(11) +
    ` | ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}pp`.padEnd(10) +
    ` | ${kept.length}/${trades.length}`
  );
}
console.log();

// ============ Recent 3 weeks impact (May 1 onwards) ============
console.log('=== RECENT 3 WEEKS (entries from 2026-05-01 onwards) — Combined fix impact ===');
for (const m of modes) {
  const trades = (t[m] || []).filter(x => x.status !== 'pending' && x.entryDate >= '2026-05-01');
  const curr = trades.reduce((s, tr) => s + (tr.pnlPct || 0), 0);
  const apply2 = ['turbo', 'dynamic', 'secured'].includes(m);
  const skipRegimes = new Set(['EARLY RISK-OFF', 'RISK-OFF']);
  const kept = trades.filter(tr => {
    const reg = regimeFor(tr);
    if (apply2 && skipRegimes.has(reg)) return false;
    if (reg === 'EARLY RISK-OFF' && (tr.score || 0) < 92) return false;
    return true;
  });
  const fixed = kept.reduce((s, tr) => s + (tr.pnlPct || 0) * (sizeMult[regimeFor(tr)] || 1.0), 0);
  const delta = fixed - curr;
  console.log(
    `${m.padEnd(9)} | curr ${(curr >= 0 ? '+' : '') + curr.toFixed(2)}%`.padEnd(20) +
    ` → fixed ${(fixed >= 0 ? '+' : '') + fixed.toFixed(2)}%`.padEnd(15) +
    ` | Δ ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}pp`.padEnd(12) +
    ` | kept ${kept.length}/${trades.length}`
  );
}
