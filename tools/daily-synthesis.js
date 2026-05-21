#!/usr/bin/env node
// daily-synthesis.js — Per-mode synthesis of the most recent trading session.
//
// Reads portfolio/v1/{mode}/trades.json, positions.json, equity.json and reports:
//   - Equity delta vs prior business day
//   - Entries today (new trades opened today)
//   - Exits today (closed trades with exitDate === today)
//   - Currently open positions with unrealized P&L
//
// CLI:
//   --date=YYYY-MM-DD     date to synthesize (default: today)
//   --format=text|json    output format (default: text)
//   --out=PATH            write JSON output to file
//   --modes=turbo,...     subset (default: all configured modes)

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

function parseArgs(argv) {
  const out = { format: 'text', modes: null };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'modes' && m[2]) out.modes = m[2].split(',').map(s => s.trim());
    else out[m[1]] = m[2] ?? true;
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));

function todayIso() { return new Date().toISOString().slice(0, 10); }
function prevBizDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) return d.toISOString().slice(0, 10);
  }
  return dateStr;
}
const TARGET = ARGS.date || todayIso();
const PRIOR = prevBizDay(TARGET);

const MODES_CFG = path.join(ROOT, 'data', 'modes-config.json');
const allModes = (() => {
  if (!fs.existsSync(MODES_CFG)) return [];
  const c = JSON.parse(fs.readFileSync(MODES_CFG, 'utf8'));
  return Object.keys(c.modes || c);
})();
const modesToProcess = ARGS.modes || allModes;

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

function modeFilePath(mode, name) {
  return path.join(ROOT, 'portfolio', 'v1', mode, name);
}

function equityValueOn(equityCurve, date) {
  if (!equityCurve) return null;
  // Two known shapes: { d: [...], v: [...] } or [{date, value}]
  if (Array.isArray(equityCurve.d) && Array.isArray(equityCurve.v)) {
    let idx = -1;
    for (let i = 0; i < equityCurve.d.length; i++) {
      if (equityCurve.d[i] <= date) idx = i; else break;
    }
    return idx >= 0 ? equityCurve.v[idx] : null;
  }
  if (Array.isArray(equityCurve)) {
    let last = null;
    for (const p of equityCurve) {
      if (p.date <= date) last = p.value; else break;
    }
    return last;
  }
  return null;
}

const STATUS_LABEL = {
  'tp1': '🎯 TP1',
  'tp1_partial': '🎯 TP1 partial',
  'tp1_partial_amb': '🎯 TP1 partial (amb)',
  'tp2': '🎯🎯 TP2',
  'sl': '🛑 SL',
  'sl_amb': '🛑 SL (amb)',
  'breakeven': '⚖️ Breakeven',
  'breakeven_amb': '⚖️ Breakeven (amb)',
  'trail': '📈 Trail',
  'trail_amb': '📈 Trail (amb)',
  'expired': '⏰ Expired',
  'rotated': '🔄 Rotated',
  'pending': '⏳ Pending',
};

function synthesizeMode(mode) {
  const trades = readJson(modeFilePath(mode, 'trades.json'));
  const positions = readJson(modeFilePath(mode, 'positions.json'));
  const equity = readJson(modeFilePath(mode, 'equity.json'));

  const allTrades = trades?.trades || [];

  // Equity
  const ecToday = equity ? equityValueOn(equity.equityCurve, TARGET) : null;
  const ecPrior = equity ? equityValueOn(equity.equityCurve, PRIOR) : null;
  const dayChange = (ecToday != null && ecPrior != null) ? +(ecToday - ecPrior).toFixed(2) : null;
  const dayChangePct = (ecToday != null && ecPrior > 0) ? +((ecToday - ecPrior) / ecPrior * 100).toFixed(2) : null;

  // Entries today
  const entries = allTrades.filter(t => t.entryDate === TARGET);

  // Exits today (closed trades with exitDate today and resolved status)
  const RESOLVED = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'breakeven', 'trail', 'rotated'];
  const exits = allTrades.filter(t => {
    if (t.exitDate !== TARGET) return false;
    const base = (t.status || '').replace(/_amb$/, '');
    return RESOLVED.includes(base);
  });

  // Currently open
  const openPositions = positions?.positions || [];

  return {
    mode,
    equity: { today: ecToday, prior: ecPrior, change: dayChange, changePct: dayChangePct },
    entries: entries.map(t => ({ ticker: t.ticker, entry: t.actualEntry || t.entry, strategy: t.strategy, score: t.score, scanDate: t.scanDate })),
    exits: exits.map(t => ({ ticker: t.ticker, status: t.status, pnlPct: t.pnlPct, exitPrice: t.exitPrice, holdDays: t.holdDays, strategy: t.strategy })),
    openPositions: openPositions.map(p => ({
      ticker: p.ticker, entry: p.entry, current: p.currentPrice, returnPct: p.returnPct,
      score: p.score, daysRemaining: p.daysRemaining,
    })),
  };
}

function formatText(syntheses) {
  const lines = [];
  lines.push(`\n📊 Synthèse session — ${TARGET} (vs ${PRIOR})\n`);
  for (const s of syntheses) {
    const eq = s.equity;
    const dayStr = (eq.change !== null)
      ? `${eq.change >= 0 ? '+' : ''}${eq.change} (${eq.changePct >= 0 ? '+' : ''}${eq.changePct}%)`
      : 'n/a';
    const eqStr = (eq.today != null && eq.prior != null) ? `${eq.prior} → ${eq.today}` : 'n/a';
    lines.push(`── ${s.mode.toUpperCase()} ──`);
    lines.push(`  Equity: ${eqStr}  | Jour: ${dayStr}`);

    if (s.entries.length) {
      lines.push(`  Entrées (${s.entries.length}):`);
      for (const e of s.entries) lines.push(`    + ${e.ticker.padEnd(6)} @ ${(e.entry || 0).toFixed(2)}  (${e.strategy}, score ${e.score})`);
    } else lines.push(`  Entrées: —`);

    if (s.exits.length) {
      lines.push(`  Sorties (${s.exits.length}):`);
      for (const x of s.exits) {
        const label = STATUS_LABEL[x.status] || x.status;
        const pnl = x.pnlPct != null ? `${x.pnlPct >= 0 ? '+' : ''}${x.pnlPct}%` : '?';
        lines.push(`    - ${x.ticker.padEnd(6)} ${label.padEnd(20)} ${pnl.padStart(8)}  (${x.holdDays}d)`);
      }
    } else lines.push(`  Sorties: —`);

    if (s.openPositions.length) {
      lines.push(`  Open (${s.openPositions.length}):`);
      for (const p of s.openPositions) {
        const pnl = p.returnPct != null ? `${p.returnPct >= 0 ? '+' : ''}${p.returnPct}%` : '?';
        const days = p.daysRemaining != null ? `${p.daysRemaining}d left` : '';
        lines.push(`    ● ${p.ticker.padEnd(6)} ${p.current?.toFixed(2).padStart(8)}  ${pnl.padStart(8)}  ${days}`);
      }
    } else lines.push(`  Open: —`);

    lines.push('');
  }
  return lines.join('\n');
}

const syntheses = modesToProcess.map(synthesizeMode);

if (ARGS.format === 'json') {
  const payload = { date: TARGET, prior: PRIOR, modes: syntheses };
  if (ARGS.out) fs.writeFileSync(ARGS.out, JSON.stringify(payload, null, 2));
  else console.log(JSON.stringify(payload, null, 2));
} else {
  const text = formatText(syntheses);
  if (ARGS.out) fs.writeFileSync(ARGS.out, text);
  else console.log(text);
}
