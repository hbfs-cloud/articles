#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decideFill } = require('./lib/fill-policy');
const { isUSTradingDay } = require('./lib/market-calendar');
const { normalizeIntradayBars, sessionCoverageError, contractForTicker, isTradingDayForTicker, performancePopulation } = require('./lib/retro-intraday');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const { requireLevelsDiagnostic } = require('./lib/retro-execution-mode');
let executionMode;
try { executionMode = requireLevelsDiagnostic(args); }
catch (error) { console.error(error.message); process.exit(3); }
const [startCompact, endCompact, referenceClose = endCompact] = args;
const argValue = name => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const runCompact = argValue('--run-date') || referenceClose;
const cohortArg = argValue('--cohort');
if (![startCompact, endCompact, referenceClose].every(v => /^\d{8}$/.test(v || ''))) {
  console.error('Usage: node tools/build-period-retro.js YYYYMMDD YYYYMMDD YYYYMMDD --levels-only [--run-date YYYYMMDD[-suffix]] [--cohort path]');
  process.exit(2);
}
if (!/^\d{8}(?:-[a-z0-9]+)*$/.test(runCompact || '')) {
  console.error('--run-date must start YYYYMMDD and may use lowercase publication suffixes');
  process.exit(2);
}

const iso = compact => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
const startDate = iso(startCompact);
const endDate = iso(endCompact);
const refDate = iso(referenceClose);
const outputDir = path.join(ROOT, 'scanner', 'retrospective', runCompact);
const intradayBarsPath = path.join(outputDir, '_data', 'intraday-bars-15m.json');
const intradayPayload = fs.existsSync(intradayBarsPath) ? JSON.parse(fs.readFileSync(intradayBarsPath, 'utf8')) : {};
const intradaySessions = intradayPayload.sessions || {};
const intradaySources = intradayPayload.source_artifacts || [];
if (!intradaySources.length || intradaySources.some(source => {
  const file = path.resolve(ROOT, source.path || '');
  return path.relative(ROOT, file).startsWith('..') || !fs.existsSync(file) || sha256(file) !== source.sha256 || source.reference_close !== refDate;
})) {
  console.error('retro intraday input lacks valid hash-bound source provenance');
  process.exit(3);
}

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
    const contract = contractForTicker(ticker);
    const day = date.getUTCDay();
    const isSession = contract ? isTradingDayForTicker(next, ticker)
      : (region === 'EU' && ticker.includes('.') ? day !== 0 && day !== 6 : isUSTradingDay(next));
    if (isSession) added++;
  }
  return date.toISOString().slice(0, 10);
}

const cohortPath = cohortArg && path.resolve(ROOT, cohortArg);
const cohort = cohortPath && JSON.parse(fs.readFileSync(cohortPath, 'utf8'));
const cohortScanDirs = cohort?.certified_trade_cohort?.scan_folders;
if (cohortPath && (!Array.isArray(cohortScanDirs) || !cohortScanDirs.every(value => /^\d{8}$/.test(value)))) {
  console.error('cohort manifest lacks certified_trade_cohort.scan_folders');
  process.exit(3);
}
const scanDirs = (cohortScanDirs || fs.readdirSync(path.join(ROOT, 'scanner'))
  .filter(d => /^\d{8}$/.test(d) && d >= startCompact && d <= endCompact)
  .filter(d => fs.existsSync(path.join(ROOT, 'scanner', d, 'signals.json')))
  .filter(d => fs.existsSync(path.join(ROOT, 'scanner', d, 'index.html')))
  .sort()).filter(d => d >= startCompact && d <= endCompact);

const sourceFiles = [];
const signals = [];
for (const scanDir of scanDirs) {
  const file = path.join(ROOT, 'scanner', scanDir, 'signals.json');
  if (!fs.existsSync(file) || !fs.existsSync(path.join(ROOT, 'scanner', scanDir, 'index.html'))) {
    console.error('certified cohort source missing: scanner/' + scanDir);
    process.exit(3);
  }
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
if (cohort && signals.length !== cohort.certified_trade_cohort.proposals) {
  console.error('cohort denominator mismatch: manifest=' + cohort.certified_trade_cohort.proposals + ', signals=' + signals.length);
  process.exit(3);
}

if (fs.existsSync(intradayBarsPath)) sourceFiles.push(intradayBarsPath);
for (const source of intradaySources) sourceFiles.push(path.resolve(ROOT, source.path));
if (cohortPath) sourceFiles.push(cohortPath);

function expectedSessions(start, end, region, ticker) {
  const result = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const finish = new Date(`${end}T12:00:00Z`);
  while (cursor <= finish) {
    const date = cursor.toISOString().slice(0, 10);
    const day = cursor.getUTCDay();
    const contract = contractForTicker(ticker);
    const isSession = contract ? isTradingDayForTicker(date, ticker)
      : (region === 'EU' && ticker.includes('.') ? day !== 0 && day !== 6 : isUSTradingDay(date));
    if (isSession) result.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function evaluate(signal) {
  const contract = contractForTicker(signal.ticker);
  const horizon = signal.horizon || 10;
  const horizonEnd = addTradingDays(signal.scan_date, horizon, signal.region, signal.ticker);
  const cutoff = horizonEnd < refDate ? horizonEnd : refDate;
  const isMature = horizonEnd <= refDate;
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
    horizon_end: horizonEnd,
    measurement_calendar: contract?.id || 'non_us_listing_requires_exchange_specific_15m_contract'
  };
  if (signal.region === 'EU' && signal.ticker.includes('.') && !contract) {
    return {
      ...base,
      status: 'data_error',
      reason: 'intraday_calendar_not_supported_for_listing',
      measurement_calendar: 'non_us_listing_requires_exchange_specific_15m_contract'
    };
  }
  const requiredSessions = expectedSessions(signal.scan_date, cutoff, signal.region, signal.ticker);
  const sessions = requiredSessions.map(date => ({
    date,
    bars: normalizeIntradayBars(intradaySessions[date]?.[signal.ticker]),
  }));
  const missingSessions = sessions.map(session => ({ date: session.date, error: sessionCoverageError(session.bars, session.date, contract) }))
    .filter(session => session.error);
  if (missingSessions.length) {
    return {
      ...base,
      status: isMature ? 'data_error' : 'open_unverified',
      reason: isMature ? 'incomplete_intraday_15m_coverage' : 'horizon_not_elapsed_incomplete_intraday_15m_coverage',
      missing_sessions: missingSessions
    };
  }
  const eventBars = sessions.flatMap(session => session.bars.map(bar => ({ ...bar, date: session.date })));
  const opening = eventBars[0];
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
  let exitDate = eventBars.at(-1).date;
  let exitPrice = eventBars.at(-1).close;
  let minLow = fillPrice;
  let maxHigh = fillPrice;
  let tp1Date = null;
  let runnerStatus = null;
  let rMultiple = null;

  for (const bar of eventBars) {
    const { date, open, high, low } = bar;
    minLow = Math.min(minLow, low);
    maxHigh = Math.max(maxHigh, high);

    if (!tp1Date) {
      if (low <= signal.stop && high >= signal.tp1) {
        return {
          ...base,
          status: 'ambiguous',
          reason: 'stop_and_tp1_in_same_15m_bar',
          effective_entry: round(fillPrice, 4),
          fill_policy: fillPolicy,
          fill_time: opening.timestamp,
          ambiguous_timestamp: bar.timestamp,
        };
      }
      if (low <= signal.stop) {
        status = 'stopped';
        exitDate = date;
        exitPrice = date > signal.scan_date ? Math.min(signal.stop, open) : signal.stop;
        rMultiple = (exitPrice - fillPrice) / risk;
        break;
      }
      if (high < signal.tp1) continue;

      tp1Date = date;
      const tp1R = (signal.tp1 - fillPrice) / risk;
      if (low <= fillPrice) {
        return {
          ...base,
          status: 'ambiguous',
          reason: 'tp1_and_breakeven_level_in_same_15m_bar',
          effective_entry: round(fillPrice, 4),
          fill_policy: fillPolicy,
          fill_time: opening.timestamp,
          ambiguous_timestamp: bar.timestamp,
        };
      }
      if (Number.isFinite(signal.tp2) && high >= signal.tp2) {
        status = 'tp2';
        runnerStatus = 'tp2';
        exitDate = date;
        exitPrice = (signal.tp1 + signal.tp2) / 2;
        rMultiple = 0.5 * tp1R + 0.5 * ((signal.tp2 - fillPrice) / risk);
        break;
      }
      continue;
    }

    if (low <= fillPrice) {
      if (Number.isFinite(signal.tp2) && high >= signal.tp2) {
        return {
          ...base, status: 'ambiguous', reason: 'breakeven_and_tp2_in_same_15m_bar',
          effective_entry: round(fillPrice, 4), fill_policy: fillPolicy, fill_time: opening.timestamp,
          ambiguous_timestamp: bar.timestamp,
        };
      }
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
    ambiguous_bar: false,
    observed_bars: eventBars.length
  };
}

const outcomes = signals.map(evaluate);
const isWinner = outcome => outcome.status === 'tp2' || outcome.status.startsWith('tp1');
// A completed trade may be observed before its published horizon, but it must
// not enter performance diagnostics until that horizon has elapsed. This also
// keeps a TP1 runner open until its remaining half is deterministically closed.
const performance = performancePopulation(outcomes, refDate);
const { filled, resolved, fullyClosed, pending, openRunners, matureFilled, nonMatureFilled, performanceExclusions } = performance;
const isPerformanceResolved = outcome => resolved.includes(outcome);
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
    const ok = rows.filter(o => !['no_fill', 'data_error', 'open_unverified', 'ambiguous'].includes(o.status));
    const done = ok.filter(isPerformanceResolved);
    const closed = done;
    const hits = done.filter(isWinner);
    const positive = closed.filter(o => o.r_multiple > 0).reduce((s, o) => s + o.r_multiple, 0);
    const negative = Math.abs(closed.filter(o => o.r_multiple < 0).reduce((s, o) => s + o.r_multiple, 0));
    return {
      name,
      proposed: rows.length,
      filled: ok.length,
      resolved: done.length,
      fully_closed: closed.length,
      open_runners: ok.filter(o => o.status === 'tp1_pending').length,
      pending: ok.filter(o => o.status === 'pending').length,
      mature_filled: ok.filter(o => o.horizon_end <= refDate).length,
      non_mature_filled: ok.filter(o => o.horizon_end > refDate).length,
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
  period_end: refDate,
  scan_period_end: endDate,
  reference_close: refDate,
  generated_at: new Date().toISOString(),
  scans: scanDirs.length,
  proposed: outcomes.length,
  filled: filled.length,
  mature_filled: matureFilled.length,
  non_mature_filled: nonMatureFilled.length,
  resolved: resolved.length,
  fully_closed: fullyClosed.length,
  open_runners: openRunners.length,
  pending: pending.length,
  no_fill: performanceExclusions.no_fill,
  data_error: performanceExclusions.data_error,
  open_unverified: performanceExclusions.open_unverified,
  non_mature: performanceExclusions.non_mature,
  ambiguous: performanceExclusions.ambiguous,
  measurement_coverage_complete: performanceExclusions.data_error === 0 && performanceExclusions.open_unverified === 0,
  performance_exclusions: performanceExclusions,
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
  methodology: 'Published primary signals[] only. Complete regular-session 15-minute coverage is mandatory for every session in the published horizon: US listings use the New York 09:30–15:45 contract and .L listings use the LSE 08:00–16:15 London contract. Fill must be demonstrated in the first regular 15-minute bar with the shared 2% chase tolerance; gap-down through stop is no-fill; events are evaluated chronologically on 15-minute bars; bars containing incompatible stop/target events are ambiguous and excluded from performance statistics; 50% exits at TP1 and the runner moves to breakeven for TP2; overnight stop gaps execute at the open; expiry is scan_date plus N exchange trading sessions. Diagnostics include only fills whose full published horizon has elapsed; non-mature outcomes, including an early observed stop or target, remain reported but excluded. A non-US listing without an exchange-specific intraday contract is retained in the denominator as data_error.',
  summary,
  publication: {
    ...executionMode,
    type: 'coverage_review',
    cohort_performance_certified: false
  },
  measurement_input: {
    type: 'bars_15m',
    path: path.relative(ROOT, intradayBarsPath),
    sha256: sha256(intradayBarsPath),
    reference_close: refDate
  },
  cohort: cohort ? {
    path: path.relative(ROOT, cohortPath),
    sha256: sha256(cohortPath),
    certified_proposals: cohort.certified_trade_cohort.proposals,
    review_only_records_preserved: cohort.review_only_exclusion?.structured_records_preserved_not_trade_certified ?? 0
  } : null,
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
  symbols: [...new Set(signals.map(signal => signal.ticker))].sort(),
  intraday_sessions: intradaySessions,
  sources: [...new Set(sourceFiles)].map(file => ({ path: path.relative(ROOT, file), sha256: sha256(file) }))
};

fs.mkdirSync(path.join(outputDir, '_data'), { recursive: true });
fs.writeFileSync(path.join(outputDir, 'retro-results.json'), JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, '_data', 'bars-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log(`${path.relative(ROOT, outputDir)}: ${summary.scans} scans, ${summary.proposed} setups, ${summary.resolved} resolved, HR ${summary.hit_rate_pct}%, PF ${summary.profit_factor}`);
