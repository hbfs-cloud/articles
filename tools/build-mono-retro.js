#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { decideFill } = require('./lib/fill-policy');

function usage() {
  console.error('Usage (forensic daily-only): node tools/build-mono-retro.js <scan-date> [horizon-end] --allow-daily-forensic');
  process.exit(2);
}

if (!process.argv.includes('--allow-daily-forensic')) {
  console.error('REFUSED: build-mono-retro uses daily OHLC and cannot prove intrabar event order. Use the active retro workflow with 15-minute bars.');
  process.exit(2);
}

const scanDate = process.argv[2];
if (!/^\d{8}$/.test(scanDate || '')) usage();
const root = path.join(__dirname, '..');
const scanDir = path.join(root, 'scanner', scanDate);
const signals = JSON.parse(fs.readFileSync(path.join(scanDir, 'signals.json'), 'utf8'));
const scanData = JSON.parse(fs.readFileSync(path.join(scanDir, 'data.json'), 'utf8'));
const barsPayload = JSON.parse(fs.readFileSync(path.join(scanDir, 'retro', '_data', 'bars_positions.json'), 'utf8'));
const result = barsPayload.results.find(r => r.data_type === 'bars_daily');
if (!result || !Array.isArray(result.symbols) || !Array.isArray(result.data)) {
  throw new Error('bars_positions.json: payload bars_daily non conforme');
}

const barsBySymbol = Object.fromEntries(result.symbols.map((symbol, index) => [symbol, result.data[index].bars]));
const start = signals.scanDate;
const configuredHorizon = Math.max(...signals.signals.map(s => s.horizon || 0));
const explicitHorizonEnd = process.argv[3] || null;

function addBusinessDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().slice(0, 10);
}

// Scanner horizons measure elapsed trading sessions after scan_date. D0 remains
// executable, but expiry is the close reached after N subsequent business days.
const horizonEnd = explicitHorizonEnd || addBusinessDays(start, configuredHorizon);

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function fillFor(signal, bars) {
  const isPullback = String(signal.strategy).toLowerCase() === 'pullback';
  for (let i = 0; i < bars.length; i++) {
    const [date, open, high, low] = bars[i];
    if (isPullback) {
      if (open <= signal.entry) return { index: i, date, price: open };
      if (low <= signal.entry && high >= signal.entry) return { index: i, date, price: signal.entry };
    } else {
      if (open >= signal.entry) return { index: i, date, price: open };
      if (high >= signal.entry) return { index: i, date, price: signal.entry };
    }
  }
  return null;
}

const outcomes = signals.signals.map(signal => {
  const signalHorizonEnd = explicitHorizonEnd || addBusinessDays(start, signal.horizon || configuredHorizon);
  const bars = (barsBySymbol[signal.ticker] || []).filter(b => b[0] >= start && b[0] <= signalHorizonEnd);
  if (!bars.length) throw new Error(`${signal.ticker}: aucune barre dans la fenetre`);
  const fill = fillFor(signal, bars);
  if (!fill) {
    return {
      ticker: signal.ticker, strategy: signal.strategy, status: 'no_fill',
      published_entry: signal.entry, stop: signal.stop, tp1: signal.tp1, tp2: signal.tp2,
      horizon_end: bars.at(-1)[0]
    };
  }

  const policy = decideFill(signal.entry, fill.price);
  if (policy.status === 'no_fill') throw new Error(`${signal.ticker}: fill hors politique partagee`);
  const risk = fill.price - signal.stop;
  const publishedSetup = (scanData.setups || []).find(s => s.ticker === signal.ticker);
  const sizeWeight = /demi-taille/i.test(JSON.stringify([signal, publishedSetup])) ? 0.5 : 1;
  const tp1R = (signal.tp1 - fill.price) / risk;
  const tp2R = (signal.tp2 - fill.price) / risk;
  let status = 'expired';
  let exitDate = bars.at(-1)[0];
  let exitPrice = bars.at(-1)[4];
  let finalR = null;
  let tp1Date = null;
  let tp2Date = null;
  let stopDate = null;
  let minLow = Infinity;
  let maxHigh = -Infinity;

  for (let i = fill.index; i < bars.length; i++) {
    const [date, , high, low] = bars[i];
    if (!tp1Date) {
      if (low <= signal.stop) {
        minLow = Math.min(minLow, signal.stop);
        status = 'stopped'; stopDate = date; exitDate = date; exitPrice = signal.stop; finalR = -1;
        break;
      }
      minLow = Math.min(minLow, low);
      if (high >= signal.tp1) {
        tp1Date = date;
        if (low <= fill.price) {
          maxHigh = Math.max(maxHigh, signal.tp1);
          status = 'tp1_be'; exitDate = date;
          exitPrice = (signal.tp1 + fill.price) / 2;
          finalR = tp1R / 2;
          break;
        }
        if (high >= signal.tp2) {
          maxHigh = Math.max(maxHigh, signal.tp2);
          tp2Date = date; status = 'tp2'; exitDate = date;
          exitPrice = (signal.tp1 + signal.tp2) / 2;
          finalR = (tp1R + tp2R) / 2;
          break;
        }
      }
      maxHigh = Math.max(maxHigh, high);
      continue;
    }

    // Après TP1, le reliquat porte un stop au point mort. En ambiguïté
    // quotidienne point-mort/TP2, la protection est traitée en premier.
    if (low <= fill.price) {
      minLow = Math.min(minLow, fill.price);
      status = 'tp1_be'; exitDate = date;
      exitPrice = (signal.tp1 + fill.price) / 2;
      finalR = tp1R / 2;
      break;
    }
    minLow = Math.min(minLow, low);
    if (high >= signal.tp2) {
      maxHigh = Math.max(maxHigh, signal.tp2);
      tp2Date = date; status = 'tp2'; exitDate = date;
      exitPrice = (signal.tp1 + signal.tp2) / 2;
      finalR = (tp1R + tp2R) / 2;
      break;
    }
    maxHigh = Math.max(maxHigh, high);
  }
  if (finalR === null) {
    if (tp1Date) {
      status = 'expired_after_tp1';
      finalR = (tp1R + ((exitPrice - fill.price) / risk)) / 2;
      exitPrice = (signal.tp1 + exitPrice) / 2;
    } else {
      finalR = (exitPrice - fill.price) / risk;
    }
  }

  return {
    ticker: signal.ticker,
    strategy: signal.strategy,
    status,
    size_weight: sizeWeight,
    published_entry: signal.entry,
    effective_entry: round(fill.price),
    fill_date: fill.date,
    fill_policy: policy.status,
    fill_deviation_pct: policy.deviationPct,
    stop: signal.stop,
    tp1: signal.tp1,
    tp2: signal.tp2,
    tp1_date: tp1Date,
    tp2_date: tp2Date,
    stop_date: stopDate,
    exit_date: exitDate,
    exit_price: round(exitPrice),
    r_multiple: round(finalR, 3),
    portfolio_contribution_pct: round(finalR * sizeWeight, 3),
    mae_pct: round(((minLow - fill.price) / fill.price) * 100, 2),
    mfe_pct: round(((maxHigh - fill.price) / fill.price) * 100, 2),
    horizon_end: bars.at(-1)[0],
    sessions: bars.length
  };
});

const filled = outcomes.filter(o => o.status !== 'no_fill');
const gains = filled.filter(o => o.portfolio_contribution_pct > 0).reduce((sum, o) => sum + o.portfolio_contribution_pct, 0);
const losses = Math.abs(filled.filter(o => o.portfolio_contribution_pct < 0).reduce((sum, o) => sum + o.portfolio_contribution_pct, 0));
const curveDates = (barsBySymbol[signals.signals[0].ticker] || [])
  .filter(b => b[0] >= start && b[0] <= horizonEnd)
  .map(b => b[0]);
const portfolioCurve = curveDates.map(date => {
  let totalR = 0;
  for (const outcome of filled) {
    if (date < outcome.fill_date) continue;
    if (date >= outcome.exit_date) {
      totalR += outcome.portfolio_contribution_pct;
      continue;
    }
    const bar = (barsBySymbol[outcome.ticker] || []).find(b => b[0] === date);
    if (bar) {
      const markR = (bar[4] - outcome.effective_entry) / (outcome.effective_entry - outcome.stop);
      const positionR = outcome.tp1_date && date >= outcome.tp1_date
        ? (((outcome.tp1 - outcome.effective_entry) / (outcome.effective_entry - outcome.stop)) + markR) / 2
        : markR;
      totalR += positionR * outcome.size_weight;
    }
  }
  return { date, equity: round(100 + totalR, 4), return_pct: round(totalR, 4) };
});
let peak = 100;
let maxDrawdownPct = 0;
for (const point of portfolioCurve) {
  peak = Math.max(peak, point.equity);
  maxDrawdownPct = Math.min(maxDrawdownPct, ((point.equity - peak) / peak) * 100);
}

const summary = {
  scan_date: signals.scanDate,
  calculated_at: new Date().toISOString(),
  horizon_sessions: configuredHorizon,
  horizon_end: outcomes[0]?.horizon_end,
  setups: outcomes.length,
  filled: filled.length,
  tp1_or_better: filled.filter(o => ['tp1', 'tp1_be', 'expired_after_tp1', 'tp2'].includes(o.status)).length,
  tp2: filled.filter(o => o.status === 'tp2').length,
  stopped: filled.filter(o => o.status === 'stopped').length,
  average_r: round(filled.reduce((sum, o) => sum + o.r_multiple, 0) / filled.length, 3),
  total_r: round(filled.reduce((sum, o) => sum + o.r_multiple, 0), 3),
  portfolio_return_pct_at_1pct_risk: round(portfolioCurve.at(-1).return_pct, 3),
  portfolio_max_drawdown_pct: round(maxDrawdownPct, 2),
  profit_factor: losses ? round(gains / losses, 2) : null
};

const output = { methodology: 'published levels; horizon expiry at scan_date plus N business days; D0 executable; shared fill policy; daily OHLC; stop-first on same-bar ambiguity; published full/half sizing; 50% at TP1 then breakeven stop on remainder', summary, portfolio_curve: portfolioCurve, outcomes };
const outPath = path.join(scanDir, 'retro', 'retro-results.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
console.log(`${outPath}: ${outcomes.length} setups, ${summary.total_r}R, PF ${summary.profit_factor}`);
