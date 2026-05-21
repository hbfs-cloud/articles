#!/usr/bin/env node
// Test execution-config variants (stops/BE) via production sweep.
// Reads REAL EQUITY (returnTotal) from backtest-results.json — not sum-pnl.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BT_PATH = path.join(ROOT, 'data', 'backtest-trades.json');
const BR_PATH = path.join(ROOT, 'data', 'backtest-results.json');
const MC_PATH = path.join(ROOT, 'data', 'modes-config.json');
const WORK_DIR = path.join(ROOT, '.omc/exec-test');
const CAND_DIR = path.join(WORK_DIR, 'candidates');
const RES_DIR = path.join(WORK_DIR, 'results');

fs.mkdirSync(CAND_DIR, { recursive: true });
fs.mkdirSync(RES_DIR, { recursive: true });

const clone = o => JSON.parse(JSON.stringify(o));

function applyDelta(modes, delta) {
  const m = clone(modes);
  for (const [path_, value] of Object.entries(delta)) {
    const parts = path_.split('.');
    let ref = m.modes;
    for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
    ref[parts[parts.length - 1]] = value;
  }
  return m;
}

const VARIANTS = [
  { id: 'V0_baseline', label: 'Baseline (OPTIM v1)', delta: {} },
  { id: 'V1_wider_atr', label: 'Wider ATR (×2.5 on turbo/dyn/secured/fortress)', delta: {
    'turbo.atrStopMult': 2.5,
    'dynamic.atrStopMult': 2.5,
    'secured.atrStopMult': 2.5,
    'fortress.atrStopMult': 2.5,
  }},
  { id: 'V2_be_relax', label: 'BE relax (turbo/dyn 1.5%, secured/fortress 2%)', delta: {
    'turbo.breakevenPct': 1.5,
    'dynamic.breakevenPct': 1.5,
    'secured.breakevenPct': 2.0,
    'fortress.breakevenPct': 2.0,
  }},
  { id: 'V3_both', label: 'ATR ×2.5 + BE relax (combo)', delta: {
    'turbo.atrStopMult': 2.5, 'turbo.breakevenPct': 1.5,
    'dynamic.atrStopMult': 2.5, 'dynamic.breakevenPct': 1.5,
    'secured.atrStopMult': 2.5, 'secured.breakevenPct': 2.0,
    'fortress.atrStopMult': 2.5, 'fortress.breakevenPct': 2.0,
  }},
  { id: 'V4_no_be', label: 'No BE lock + ATR ×2.5', delta: {
    'turbo.atrStopMult': 2.5, 'turbo.breakevenPct': 0,
    'dynamic.atrStopMult': 2.5, 'dynamic.breakevenPct': 0,
    'secured.atrStopMult': 2.5, 'secured.breakevenPct': 0,
    'fortress.atrStopMult': 2.5, 'fortress.breakevenPct': 0,
  }},
  { id: 'V5_wider_stop', label: 'maxStop +50% + ATR ×2', delta: {
    'turbo.maxStopPct': 6, 'turbo.atrStopMult': 2,
    'dynamic.maxStopPct': 6, 'dynamic.atrStopMult': 2,
    'secured.maxStopPct': 6, 'secured.atrStopMult': 2,
    'fortress.maxStopPct': 7, 'fortress.atrStopMult': 2,
  }},
];

const baselineMC = JSON.parse(fs.readFileSync(MC_PATH, 'utf8'));

console.log('=== Execution config bench — REAL EQUITY ===');
console.log(`Variants: ${VARIANTS.length}`);

const baselineBT = fs.readFileSync(BT_PATH, 'utf8');
const baselineBR = fs.readFileSync(BR_PATH, 'utf8');
fs.writeFileSync(path.join(WORK_DIR, 'baseline-bt.json'), baselineBT);
fs.writeFileSync(path.join(WORK_DIR, 'baseline-br.json'), baselineBR);

function runVariant(v) {
  const tradesOut = path.join(RES_DIR, `${v.id}-trades.json`);
  const resultsOut = path.join(RES_DIR, `${v.id}-results.json`);
  if (fs.existsSync(tradesOut) && fs.existsSync(resultsOut)) {
    console.log(`\n[${v.id}] SKIP cached`);
    return;
  }
  const patched = applyDelta(baselineMC, v.delta);
  const candCfgPath = path.join(CAND_DIR, `${v.id}.json`);
  fs.writeFileSync(candCfgPath, JSON.stringify(patched, null, 2));
  fs.writeFileSync(BT_PATH, '{}');
  console.log(`\n[${v.id}] ${v.label}`);
  const t0 = Date.now();
  try {
    execSync(`MODES_CFG_OVERRIDE=${candCfgPath} node tools/sweep.js`, {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    console.error(`  ❌ Sweep failed: ${e.message.split('\n')[0]}`);
    return;
  }
  fs.copyFileSync(BT_PATH, tradesOut);
  fs.copyFileSync(BR_PATH, resultsOut);
  console.log(`  ✅ Done in ${((Date.now()-t0)/1000).toFixed(0)}s`);
}

for (const v of VARIANTS) runVariant(v);

// Restore baseline
fs.writeFileSync(BT_PATH, baselineBT);
fs.writeFileSync(BR_PATH, baselineBR);
console.log('\n✅ Baseline restored.');

// Aggregate equity from backtest-results.json (REAL metric)
const modes = ['turbo', 'dynamic', 'balanced', 'secured', 'fortress', 'tkl'];

function getMetrics(id) {
  const p = path.join(RES_DIR, `${id}-results.json`);
  if (!fs.existsSync(p)) return null;
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = {};
  for (const m of modes) {
    const f = r[`frozen_${m}`];
    if (!f) { out[m] = null; continue; }
    out[m] = { ret: f.returnTotal, dd: f.maxDD, wr: f.winRate, pf: f.profitFactor, n: f.trades };
  }
  return out;
}

function getMayMetrics(id) {
  const p = path.join(RES_DIR, `${id}-trades.json`);
  if (!fs.existsSync(p)) return null;
  const bt = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = {};
  for (const m of modes) {
    const trades = (bt[m] || []).filter(t => t.entryDate >= '2026-05-01' && t.status && t.status !== 'pending');
    if (trades.length === 0) { out[m] = null; continue; }
    const wr = trades.filter(t => (t.pnlPct || 0) > 0).length / trades.length * 100;
    const sumPnl = trades.reduce((s, t) => s + (t.pnlPct || 0), 0);
    const sl = trades.filter(t => (t.status||'').startsWith('sl')).length;
    const be = trades.filter(t => t.status === 'breakeven').length;
    out[m] = { n: trades.length, wr: +wr.toFixed(1), sumPnl: +sumPnl.toFixed(2),
               slPct: +(sl/trades.length*100).toFixed(0), bePct: +(be/trades.length*100).toFixed(0) };
  }
  return out;
}

console.log('\n## LIFETIME equity (returnTotal from backtest-results.json)\n');
console.log(`| Variant | ${modes.join(' | ')} | Sum |`);
console.log(`|---|${modes.map(()=>'---:').join('|')}|---:|`);
const base = getMetrics('V0_baseline');
for (const v of VARIANTS) {
  const m = getMetrics(v.id);
  if (!m) continue;
  const row = [v.label];
  let sum = 0;
  for (const mode of modes) {
    const cur = m[mode]?.ret;
    const baseRet = base[mode]?.ret;
    if (cur == null) { row.push('—'); continue; }
    if (v.id === 'V0_baseline') row.push(`${cur.toFixed(1)}%`);
    else {
      const d = cur - (baseRet || 0);
      row.push(`${cur.toFixed(1)}% (${d>=0?'+':''}${d.toFixed(1)})`);
      sum += d;
    }
  }
  if (v.id === 'V0_baseline') {
    const totalBase = modes.reduce((s, mm) => s + (base[mm]?.ret || 0), 0);
    row.push(`${totalBase.toFixed(1)}%`);
  } else row.push(`**${sum>=0?'+':''}${sum.toFixed(1)}**`);
  console.log(`| ${row.join(' | ')} |`);
}

console.log('\n## MAY only (sum pnl + SL%/BE% per mode)\n');
console.log(`| Variant | turbo | dynamic | balanced | secured | fortress | tkl | Sum |`);
console.log(`|---|---:|---:|---:|---:|---:|---:|---:|`);
const baseMay = getMayMetrics('V0_baseline');
for (const v of VARIANTS) {
  const m = getMayMetrics(v.id);
  if (!m) continue;
  const row = [v.label];
  let sum = 0;
  for (const mode of modes) {
    const cur = m[mode];
    const b = baseMay[mode];
    if (!cur) { row.push('—'); continue; }
    const baseSum = b?.sumPnl ?? 0;
    if (v.id === 'V0_baseline') row.push(`${cur.sumPnl}% (SL${cur.slPct}%/BE${cur.bePct}%)`);
    else {
      const d = cur.sumPnl - baseSum;
      row.push(`${cur.sumPnl}% (${d>=0?'+':''}${d.toFixed(1)}, SL${cur.slPct}%/BE${cur.bePct}%)`);
      sum += d;
    }
  }
  if (v.id === 'V0_baseline') {
    const tot = modes.reduce((s, mm) => s + (baseMay[mm]?.sumPnl || 0), 0);
    row.push(`${tot.toFixed(1)}%`);
  } else row.push(`**${sum>=0?'+':''}${sum.toFixed(1)}**`);
  console.log(`| ${row.join(' | ')} |`);
}

fs.writeFileSync(path.join(WORK_DIR, 'summary.json'), JSON.stringify({
  variants: VARIANTS.reduce((acc, v) => { acc[v.id] = { label: v.label, metrics: getMetrics(v.id), may: getMayMetrics(v.id) }; return acc; }, {})
}, null, 2));
console.log(`\n✅ Summary: ${path.join(WORK_DIR, 'summary.json')}`);
