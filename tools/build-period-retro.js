#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decideFill } = require('./lib/fill-policy');
const { isUSTradingDay } = require('./lib/market-calendar');

const ROOT = path.join(__dirname, '..');
const [startCompact, endCompact, referenceClose = endCompact] = process.argv.slice(2);
if (![startCompact, endCompact, referenceClose].every(v => /^\d{8}$/.test(v || ''))) {
  console.error('Usage: node tools/build-period-retro.js YYYYMMDD YYYYMMDD YYYYMMDD');
  process.exit(2);
}

const iso = compact => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
const startDate = iso(startCompact);
const endDate = iso(endCompact);
const refDate = iso(referenceClose);
const outputDir = path.join(ROOT, 'scanner', 'retrospective', referenceClose);
const overridePath = path.join(outputDir, '_data', 'marketdata-overrides.json');
const openingBarsPath = path.join(outputDir, '_data', 'opening-bars-15m.json');
const marketdataOverrides = fs.existsSync(overridePath)
  ? JSON.parse(fs.readFileSync(overridePath, 'utf8')).bars || {}
  : {};
const openingSessions = fs.existsSync(openingBarsPath)
  ? JSON.parse(fs.readFileSync(openingBarsPath, 'utf8')).sessions || {}
  : {};

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function addTradingDays(dateStr, days, region, ticker) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const next = date.toISOString().slice(0, 10);
    const day = date.getUTCDay();
    const isEuropeanListing = region === 'EU' && ticker.includes('.');
    const isSession = isEuropeanListing ? day !== 0 && day !== 6 : isUSTradingDay(next);
    if (isSession) added++;
  }
  return date.toISOString().slice(0, 10);
}

function loadBars(ticker) {
  const flat = path.join(ROOT, 'data', '.price-cache', `${ticker}.json`);
  const ohlcv = path.join(ROOT, 'data', '.price-cache', `${ticker}_ohlcv.json`);
  const file = fs.existsSync(flat) ? flat : ohlcv;
  if (!fs.existsSync(file) && !marketdataOverrides[ticker]) return { file: null, bars: [] };
  if (!fs.existsSync(file)) return { file: overridePath, bars: marketdataOverrides[ticker] || [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bars = Array.isArray(raw)
    ? raw.map(b => [b.date, b.open, b.high, b.low, b.close, b.volume ?? null])
    : Object.entries(raw).map(([date, b]) => [date, b.open, b.high, b.low, b.close, b.volume ?? null]);
  const merged = new Map(bars.map(bar => [bar[0], bar]));
  for (const bar of marketdataOverrides[ticker] || []) merged.set(bar[0], bar);
  return {
    file,
    bars: [...merged.values()]
      .filter(b => b[0] <= refDate && b.slice(1, 5).every(Number.isFinite))
      .filter(b => b[2] >= b[3] && b[1] > 0 && b[3] > 0 && b[4] > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
  };
}

const scanDirs = fs.readdirSync(path.join(ROOT, 'scanner'))
  .filter(d => /^\d{8}$/.test(d) && d >= startCompact && d <= endCompact)
  .filter(d => fs.existsSync(path.join(ROOT, 'scanner', d, 'signals.json')))
  .filter(d => fs.existsSync(path.join(ROOT, 'scanner', d, 'index.html')))
  .sort();

const sourceFiles = [];
const signals = [];
for (const scanDir of scanDirs) {
  const file = path.join(ROOT, 'scanner', scanDir, 'signals.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  sourceFiles.push(file);
  sourceFiles.push(path.join(ROOT, 'scanner', scanDir, 'index.html'));
  const dataFile = path.join(ROOT, 'scanner', scanDir, 'data.json');
  if (fs.existsSync(dataFile)) sourceFiles.push(dataFile);
  const payloadDate = /^\d{8}$/.test(payload.scanDate || '') ? iso(payload.scanDate) : payload.scanDate;
  for (const signal of payload.signals || []) {
    signals.push({ ...signal, scan_date: payloadDate || iso(scanDir), scan_dir: scanDir, regime: payload.regime || 'UNKNOWN' });
  }
}

const barsCache = new Map();
for (const ticker of new Set(signals.map(s => s.ticker))) {
  const loaded = loadBars(ticker);
  barsCache.set(ticker, loaded.bars);
  if (loaded.file) sourceFiles.push(loaded.file);
}
if (fs.existsSync(overridePath)) sourceFiles.push(overridePath);
if (fs.existsSync(openingBarsPath)) sourceFiles.push(openingBarsPath);

function evaluate(signal) {
  const horizon = signal.horizon || 10;
  const horizonEnd = addTradingDays(signal.scan_date, horizon, signal.region, signal.ticker);
  const cutoff = horizonEnd < refDate ? horizonEnd : refDate;
  const bars = (barsCache.get(signal.ticker) || []).filter(b => b[0] >= signal.scan_date && b[0] <= cutoff);
  const base = {
    scan_date: signal.scan_date,
    ticker: signal.ticker,
    name: signal.name || signal.ticker,
    strategy: signal.strategy || 'Unknown',
    region: signal.region || 'UNKNOWN',
    regime: signal.regime,
    score: signal.score ?? null,
    published_entry: signal.entry,
    published_entry_low: Number.isFinite(signal.entry_low) ? signal.entry_low : signal.entry,
    published_entry_high: Number.isFinite(signal.entry_high) ? signal.entry_high : signal.entry,
    stop: signal.stop,
    tp1: signal.tp1,
    tp2: signal.tp2 ?? null,
    horizon,
    horizon_end: horizonEnd
  };
  if (!bars.length || bars[0][0] !== signal.scan_date) return { ...base, status: 'data_error', reason: 'missing_D0_bar' };

  const opening = openingSessions[signal.scan_date]?.[signal.ticker] || null;
  if (!opening) return { ...base, status: 'data_error', reason: 'missing_opening_15m_bar' };
  const openPrice = opening.open;
  const ratio = openPrice / signal.entry;
  if (ratio < 0.5 || ratio > 2) return { ...base, status: 'data_error', reason: 'price_series_mismatch', observed_open: openPrice };
  if (openPrice <= signal.stop) return { ...base, status: 'no_fill', reason: 'gap_down_through_stop', observed_open: openPrice };

  const lowBound = base.published_entry_low;
  const highBound = base.published_entry_high;
  const intersectsZone = opening.low <= highBound && opening.high >= lowBound;
  const openPolicy = decideFill(highBound, openPrice);
  let fillPrice;
  let fillPolicy;
  if (openPrice >= lowBound && openPrice <= highBound) {
    fillPrice = openPrice;
    fillPolicy = 'opening_in_zone';
  } else if (openPrice > highBound && openPolicy.status === 'chase') {
    fillPrice = openPrice;
    fillPolicy = 'chase';
  } else if (intersectsZone) {
    fillPrice = openPrice < lowBound ? lowBound : highBound;
    fillPolicy = 'opening_window_zone_touch';
  } else {
    return {
      ...base,
      status: 'no_fill',
      reason: 'opening_window_missed',
      observed_open: openPrice,
      observed_high: opening.high,
      observed_low: opening.low,
      opening_bar_timestamp: opening.timestamp,
      fill_deviation_pct: openPolicy.deviationPct
    };
  }

  const risk = fillPrice - signal.stop;
  if (!(risk > 0)) return { ...base, status: 'data_error', reason: 'non_positive_risk', observed_open: openPrice };
  let status = horizonEnd <= refDate ? 'expired' : 'pending';
  let exitDate = bars.at(-1)[0];
  let exitPrice = bars.at(-1)[4];
  let minLow = fillPrice;
  let maxHigh = fillPrice;
  let tp1Date = null;
  let runnerStatus = null;
  let rMultiple = null;
  let ambiguousBar = false;

  for (const [date, open, high, low] of bars) {
    minLow = Math.min(minLow, low);
    maxHigh = Math.max(maxHigh, high);

    if (!tp1Date) {
      if (low <= signal.stop) {
        ambiguousBar = high >= signal.tp1;
        status = 'stopped';
        exitDate = date;
        exitPrice = date > signal.scan_date ? Math.min(signal.stop, open) : signal.stop;
        rMultiple = (exitPrice - fillPrice) / risk;
        break;
      }
      if (high < signal.tp1) continue;

      tp1Date = date;
      const tp1R = (signal.tp1 - fillPrice) / risk;
      if (Number.isFinite(signal.tp2) && high >= signal.tp2) {
        status = 'tp2';
        runnerStatus = 'tp2';
        exitDate = date;
        exitPrice = (signal.tp1 + signal.tp2) / 2;
        rMultiple = 0.5 * tp1R + 0.5 * ((signal.tp2 - fillPrice) / risk);
        break;
      }
      if (low <= fillPrice) {
        status = 'tp1_be';
        runnerStatus = 'breakeven';
        exitDate = date;
        exitPrice = (signal.tp1 + fillPrice) / 2;
        rMultiple = 0.5 * tp1R;
        ambiguousBar = true;
        break;
      }
      continue;
    }

    if (low <= fillPrice) {
      const runnerExit = Math.min(fillPrice, open);
      status = 'tp1_be';
      runnerStatus = runnerExit < fillPrice ? 'gap_below_breakeven' : 'breakeven';
      exitDate = date;
      exitPrice = (signal.tp1 + runnerExit) / 2;
      rMultiple = 0.5 * ((signal.tp1 - fillPrice) / risk) + 0.5 * ((runnerExit - fillPrice) / risk);
      break;
    }
    if (Number.isFinite(signal.tp2) && high >= signal.tp2) {
      status = 'tp2';
      runnerStatus = 'tp2';
      exitDate = date;
      exitPrice = (signal.tp1 + signal.tp2) / 2;
      rMultiple = 0.5 * ((signal.tp1 - fillPrice) / risk) + 0.5 * ((signal.tp2 - fillPrice) / risk);
      break;
    }
  }

  if (rMultiple == null) {
    if (tp1Date) {
      status = horizonEnd <= refDate ? 'tp1_expired' : 'tp1_pending';
      runnerStatus = status === 'tp1_expired' ? 'horizon_close' : 'marked_to_market';
      exitPrice = (signal.tp1 + exitPrice) / 2;
      rMultiple = 0.5 * ((signal.tp1 - fillPrice) / risk) + 0.5 * (((2 * exitPrice - signal.tp1) - fillPrice) / risk);
    } else {
      rMultiple = (exitPrice - fillPrice) / risk;
    }
  }

  return {
    ...base,
    status,
    reason: status === 'pending' ? 'horizon_not_elapsed' : null,
    effective_entry: round(fillPrice, 4),
    fill_policy: fillPolicy,
    fill_time: opening.timestamp,
    opening_bar: opening,
    fill_deviation_pct: round(((fillPrice - base.published_entry_high) / base.published_entry_high) * 100, 2),
    tp1_date: tp1Date,
    runner_status: runnerStatus,
    exit_date: exitDate,
    exit_price: round(exitPrice, 4),
    r_multiple: round(rMultiple),
    return_pct: round(((exitPrice - fillPrice) / fillPrice) * 100, 2),
    mae_pct: round(((minLow - fillPrice) / fillPrice) * 100, 2),
    mfe_pct: round(((maxHigh - fillPrice) / fillPrice) * 100, 2),
    ambiguous_bar: ambiguousBar,
    observed_bars: bars.length
  };
}

const outcomes = signals.map(evaluate);
const isWinner = outcome => outcome.status === 'tp2' || outcome.status.startsWith('tp1');
const filled = outcomes.filter(o => !['no_fill', 'data_error'].includes(o.status));
const resolved = filled.filter(o => o.status !== 'pending');
const fullyClosed = resolved.filter(o => o.status !== 'tp1_pending');
const winners = resolved.filter(isWinner);
const stopped = resolved.filter(o => o.status === 'stopped');
const gains = fullyClosed.filter(o => o.r_multiple > 0).reduce((sum, o) => sum + o.r_multiple, 0);
const losses = Math.abs(fullyClosed.filter(o => o.r_multiple < 0).reduce((sum, o) => sum + o.r_multiple, 0));

function groupBy(key) {
  const groups = new Map();
  for (const o of outcomes) {
    const value = o[key] || 'UNKNOWN';
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(o);
  }
  return [...groups.entries()].map(([name, rows]) => {
    const ok = rows.filter(o => !['no_fill', 'data_error'].includes(o.status));
    const done = ok.filter(o => o.status !== 'pending');
    const closed = done.filter(o => o.status !== 'tp1_pending');
    const hits = done.filter(isWinner);
    const positive = closed.filter(o => o.r_multiple > 0).reduce((s, o) => s + o.r_multiple, 0);
    const negative = Math.abs(closed.filter(o => o.r_multiple < 0).reduce((s, o) => s + o.r_multiple, 0));
    return {
      name,
      proposed: rows.length,
      filled: ok.length,
      resolved: done.length,
      fully_closed: closed.length,
      open_runners: done.length - closed.length,
      pending: ok.length - done.length,
      tp_hits: hits.length,
      stopped: done.filter(o => o.status === 'stopped').length,
      hit_rate_pct: done.length ? round((hits.length / done.length) * 100, 1) : null,
      average_r: closed.length ? round(closed.reduce((s, o) => s + o.r_multiple, 0) / closed.length) : null,
      average_return_pct: closed.length ? round(closed.reduce((s, o) => s + o.return_pct, 0) / closed.length, 2) : null,
      profit_factor: negative ? round(positive / negative, 2) : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

const averageReturn = fullyClosed.length ? fullyClosed.reduce((sum, o) => sum + o.return_pct, 0) / fullyClosed.length : 0;
const summary = {
  period_start: startDate,
  period_end: endDate,
  reference_close: refDate,
  generated_at: new Date().toISOString(),
  scans: scanDirs.length,
  proposed: outcomes.length,
  filled: filled.length,
  resolved: resolved.length,
  fully_closed: fullyClosed.length,
  open_runners: resolved.length - fullyClosed.length,
  pending: filled.length - resolved.length,
  no_fill: outcomes.filter(o => o.status === 'no_fill').length,
  data_error: outcomes.filter(o => o.status === 'data_error').length,
  tp1_or_better: winners.length,
  stopped: stopped.length,
  hit_rate_pct: resolved.length ? round((winners.length / resolved.length) * 100, 1) : null,
  stop_rate_pct: resolved.length ? round((stopped.length / resolved.length) * 100, 1) : null,
  average_r: fullyClosed.length ? round(fullyClosed.reduce((sum, o) => sum + o.r_multiple, 0) / fullyClosed.length) : null,
  average_return_pct: round(averageReturn, 2),
  profit_factor: losses ? round(gains / losses, 2) : null,
  resolution_rate_pct: outcomes.length ? round((resolved.length / outcomes.length) * 100, 1) : null,
  filled_resolution_rate_pct: filled.length ? round((resolved.length / filled.length) * 100, 1) : null
};

const ranked = resolved.slice().sort((a, b) => b.r_multiple - a.r_multiple);
const output = {
  methodology: 'published primary signals[] only; fill must be demonstrated in the first regular 15-minute bar, with the shared 2% chase tolerance; gap-down through stop is no-fill; stop-first daily OHLC; 50% exits at TP1 and the runner moves to breakeven for TP2; overnight stop gaps execute at the open; expiry at scan_date plus N business days; unresolved runners are marked at the reference close',
  summary,
  scan_dates: scanDirs.map(iso),
  by_scan: groupBy('scan_date'),
  by_strategy: groupBy('strategy'),
  by_region: groupBy('region'),
  top: ranked.slice(0, 5),
  bottom: ranked.slice(-5).reverse(),
  outcomes
};

const snapshot = {
  generated_at: summary.generated_at,
  reference_close: refDate,
  symbols: [...barsCache.keys()].sort(),
  bars: Object.fromEntries([...barsCache.entries()].map(([ticker, bars]) => [ticker, bars.filter(b => b[0] >= startDate && b[0] <= refDate)])),
  sources: sourceFiles.map(file => ({ path: path.relative(ROOT, file), sha256: sha256(file) }))
};

fs.mkdirSync(path.join(outputDir, '_data'), { recursive: true });
fs.writeFileSync(path.join(outputDir, 'retro-results.json'), JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, '_data', 'bars-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`${path.relative(ROOT, outputDir)}: ${summary.scans} scans, ${summary.proposed} setups, ${summary.resolved} resolved, HR ${summary.hit_rate_pct}%, PF ${summary.profit_factor}`);
