#!/usr/bin/env node
/**
 * tools/rolling-walk-forward.js
 *
 * Rolling 10-day walk-forward analysis of mode parameters.
 *
 * For each scan date D in the trade history, computes:
 *   - IS window: trades with entryDate in [D-10, D-1] (10 prior trading days)
 *   - Test cohort: trades with entryDate = D
 *   - Per-mode WR / PF / total return on the IS window
 *   - Per-mode performance on the test cohort
 *
 * This exposes whether mode parameters degrade over rolling time windows,
 * without touching the core sweep.js grid-search logic.
 *
 * Usage:
 *   node tools/rolling-walk-forward.js [--days N]
 *
 * Outputs:
 *   data/rolling-walk-forward.json   — structured JSON for downstream tools
 *   stdout: markdown summary table
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROLLING_DAYS = parseInt((process.argv.find(a => a.startsWith('--days=')) || '--days=10').split('=')[1], 10);

const trades = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/backtest-trades.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/modes-config.json'), 'utf8'));

const MODES = Object.keys(cfg.modes || {});

function isWin(t) { return ['tp1', 'tp2', 'tp1_partial', 'tp1_partial_amb', 'trail'].includes(t.status); }
function isLoss(t) { return t.status === 'sl' || t.status === 'stopped'; }
function isClosed(t) { return t.status && t.status !== 'pending' && t.status !== 'open'; }

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.length > 10 ? s : s + 'T16:00:00Z');
  return isNaN(d) ? null : d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function metrics(arr) {
  const closed = arr.filter(isClosed);
  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);
  const resolved = wins.length + losses.length;
  const ret = closed.reduce((s, t) => s + (t.pnlPct || 0), 0);
  const wr = resolved > 0 ? wins.length / resolved * 100 : null;
  const grossWin = wins.reduce((s, t) => s + (t.pnlPct || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnlPct || 0), 0));
  const pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
  const expectancy = closed.length > 0 ? ret / closed.length : 0;
  return { closed: closed.length, wins: wins.length, losses: losses.length, resolved, ret, wr, pf, expectancy };
}

// Build full set of scan dates from all trades
const allTrades = [].concat(...Object.values(trades));
const scanDates = [...new Set(allTrades.map(t => t.scanDate).filter(Boolean))].sort();
if (!scanDates.length) {
  console.error('No scan dates found in backtest-trades.json');
  process.exit(1);
}

// Per-mode rolling series
const series = {};
for (const m of MODES) {
  series[m] = [];
  const modeTrades = trades[m] || [];
  for (const D of scanDates) {
    const Ddate = parseDate(D);
    if (!Ddate) continue;
    const startDate = new Date(Ddate);
    startDate.setDate(startDate.getDate() - ROLLING_DAYS);

    const isWindow = modeTrades.filter(t => {
      const e = parseDate(t.entryDate);
      return e && e >= startDate && e < Ddate;
    });
    const testCohort = modeTrades.filter(t => t.scanDate === D);

    const isM = metrics(isWindow);
    const testM = metrics(testCohort);

    series[m].push({
      scan_date: D,
      is_window_trades: isM.closed,
      is_window_resolved: isM.resolved,
      is_wr: isM.wr,
      is_pf: isM.pf === Infinity ? null : isM.pf,
      is_ret: isM.ret,
      test_trades: testM.closed,
      test_resolved: testM.resolved,
      test_wr: testM.wr,
      test_pf: testM.pf === Infinity ? null : testM.pf,
      test_ret: testM.ret,
    });
  }
}

// Aggregate trends
const aggregates = {};
for (const m of MODES) {
  const points = series[m];
  const validIS = points.filter(p => p.is_wr !== null);
  const validTest = points.filter(p => p.test_wr !== null);

  // First half vs second half WR drift
  if (validIS.length >= 4) {
    const half = Math.floor(validIS.length / 2);
    const first = validIS.slice(0, half);
    const second = validIS.slice(half);
    const firstAvg = first.reduce((s, p) => s + p.is_wr, 0) / first.length;
    const secondAvg = second.reduce((s, p) => s + p.is_wr, 0) / second.length;
    aggregates[m] = {
      first_half_avg_wr: firstAvg,
      second_half_avg_wr: secondAvg,
      drift_pp: secondAvg - firstAvg,
      n_periods: validIS.length,
      first_half_dates: [first[0]?.scan_date, first[first.length - 1]?.scan_date],
      second_half_dates: [second[0]?.scan_date, second[second.length - 1]?.scan_date],
    };
  } else {
    aggregates[m] = { error: 'insufficient_data', n_periods: validIS.length };
  }
}

// Output JSON
const outJson = {
  generated_at: new Date().toISOString(),
  rolling_window_days: ROLLING_DAYS,
  scan_dates: scanDates,
  series,
  aggregates,
};
const outPath = path.join(ROOT, 'data/rolling-walk-forward.json');
fs.writeFileSync(outPath, JSON.stringify(outJson, null, 2));
console.error(`Wrote ${outPath}`);

// Output Markdown summary to stdout
console.log(`# Rolling ${ROLLING_DAYS}-Day Walk-Forward Analysis`);
console.log('');
console.log(`**Generated:** ${outJson.generated_at}`);
console.log(`**Window:** rolling ${ROLLING_DAYS} trading days. Scan-date count: ${scanDates.length}.`);
console.log('');
console.log('## Aggregate Drift — First-Half vs Second-Half Mean Rolling WR');
console.log('');
console.log('| Mode | n Periods | First-Half WR | Second-Half WR | Drift (pp) | Verdict |');
console.log('|------|-----------|---------------|----------------|------------|---------|');
for (const m of MODES) {
  const a = aggregates[m];
  if (a.error) {
    console.log(`| ${m} | ${a.n_periods} | — | — | — | 🟡 ${a.error} |`);
    continue;
  }
  const verdict = a.drift_pp <= -10 ? '🔴 OOS degradation' : a.drift_pp >= 5 ? '🟢 OOS improving' : '🟡 stable';
  console.log(`| ${m} | ${a.n_periods} | ${a.first_half_avg_wr.toFixed(1)}% | ${a.second_half_avg_wr.toFixed(1)}% | ${a.drift_pp >= 0 ? '+' : ''}${a.drift_pp.toFixed(1)} | ${verdict} |`);
}

console.log('');
console.log(`## Detail Per Mode (last 10 scan dates)`);
console.log('');
for (const m of MODES) {
  console.log(`### ${m}`);
  console.log('');
  console.log('| Scan Date | IS Trades | IS Resolved | IS WR | IS Ret | Test Trades | Test Resolved | Test WR | Test Ret |');
  console.log('|-----------|-----------|-------------|-------|--------|-------------|---------------|---------|----------|');
  const recent = series[m].slice(-10);
  for (const p of recent) {
    const isWR = p.is_wr === null ? '—' : p.is_wr.toFixed(0) + '%';
    const testWR = p.test_wr === null ? '—' : p.test_wr.toFixed(0) + '%';
    console.log(`| ${p.scan_date} | ${p.is_window_trades} | ${p.is_window_resolved} | ${isWR} | ${p.is_ret >= 0 ? '+' : ''}${p.is_ret.toFixed(1)}% | ${p.test_trades} | ${p.test_resolved} | ${testWR} | ${p.test_ret >= 0 ? '+' : ''}${p.test_ret.toFixed(1)}% |`);
  }
  console.log('');
}

console.log('## How To Read');
console.log('');
console.log(`Each row shows the rolling-${ROLLING_DAYS}d window of trades CLOSED before that scan date (IS) and the trades OPENED on that scan date (Test cohort). If IS WR is consistently high but Test WR is consistently low, mode parameters may be overfit to the recent past. If both move together, the regime is just shifting.`);
console.log('');
console.log('**Caveat:** with only ~9 weeks of data, statistical power is low. Use this for direction-of-travel signal, not point estimates.');
