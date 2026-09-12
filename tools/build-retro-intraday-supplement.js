#!/usr/bin/env node
'use strict';

// Rebuild only incomplete 15-minute retrospective sessions from an independently
// certified 5-minute MCP artifact.  This is deliberately a replacement tool:
// partial 15-minute data is never mixed with the rebuilt session.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateCollectedArtifact } = require('./lib/evidence-gates');
const {
  contractForTicker, dateTimeInZone, isTradingDayForTicker,
} = require('./lib/retro-intraday');

const ROOT = path.resolve(__dirname, '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const OHLC_ROUNDING_QUANTUM = 0.0001;
const OHLC_ROUNDING_EPSILON = 1e-9;

function isIsoDate(value) {
  return ISO_DATE.test(String(value || '')) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function strictNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || !ISO_UTC_SECONDS.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`timestamp must be an exact UTC ISO-second string: ${String(value)}`);
  }
  if (new Date(value).toISOString() !== value.replace('Z', '.000Z')) {
    throw new Error(`timestamp is not canonical UTC seconds: ${value}`);
  }
  return value;
}

function isEpochAligned(timestamp, milliseconds) {
  return Date.parse(timestamp) % milliseconds === 0;
}

// retro-intraday's exported formatter intentionally rejects non-15m timestamps.
// The supplement has to identify an in-session 5m row before rejecting a stray
// second, so it uses the same zone contract with a formatter that preserves it.
function localDateTime(timestamp, timeZone) {
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function normalizeBar(raw, label, onQuantumCorrection = null) {
  const row = rawRow(raw);
  if (!row) throw new Error(`${label}: bar is not an object or OHLCV row`);
  const timestamp = canonicalTimestamp(row.timestamp ?? row.datetime ?? row.time ?? row.date);
  const fields = ['open', 'high', 'low', 'close', 'volume'];
  if (!fields.every(field => strictNumber(row[field]))) throw new Error(`${label}: OHLCV is missing or non-numeric at ${timestamp}`);
  const { open, close, volume } = row;
  let { high, low } = row;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    throw new Error(`${label}: OHLCV bounds invalid at ${timestamp}`);
  }
  const upper = Math.max(open, low, close);
  const lower = Math.min(open, high, close);
  if (high < upper) {
    const delta = upper - high;
    if (delta > OHLC_ROUNDING_QUANTUM + OHLC_ROUNDING_EPSILON || !onQuantumCorrection) {
      throw new Error(`${label}: OHLCV bounds invalid at ${timestamp}`);
    }
    onQuantumCorrection({ field: 'high', from: high, to: upper, delta });
    high = upper;
  }
  if (low > lower) {
    const delta = low - lower;
    if (delta > OHLC_ROUNDING_QUANTUM + OHLC_ROUNDING_EPSILON || !onQuantumCorrection) {
      throw new Error(`${label}: OHLCV bounds invalid at ${timestamp}`);
    }
    onQuantumCorrection({ field: 'low', from: low, to: lower, delta });
    low = lower;
  }
  return { timestamp, open, high, low, close, volume };
}

function rawRow(raw) {
  return Array.isArray(raw) ? {
    timestamp: raw[0], open: raw[1], high: raw[2], low: raw[3], close: raw[4], volume: raw[5],
  } : raw;
}

function normalisedTicker(value) {
  return String(value || '').trim().toUpperCase();
}

// QueryData has appeared both as {symbol, bars} and as nested {symbol, data}
// records.  Only a row array under an identified ticker is accepted.
function collectRawSeries(value, inheritedTicker = null, output = []) {
  if (!value || typeof value !== 'object') return output;
  const ticker = normalisedTicker(value.ticker || value.symbol || inheritedTicker);
  const series = Array.isArray(value.bars) ? value.bars
    : Array.isArray(value.data) && value.data.every(Array.isArray) ? value.data : null;
  if (ticker && series) output.push({ ticker, series });
  for (const [key, child] of Object.entries(value)) {
    if (key === 'bars' || key === 'data') continue;
    collectRawSeries(child, ticker || inheritedTicker, output);
  }
  if (!series && value.data && typeof value.data === 'object') {
    collectRawSeries(value.data, ticker || inheritedTicker, output);
  }
  return output;
}

function expectedFiveMinuteTimes(contract) {
  const result = new Set();
  for (const time of contract.expectedTimes) {
    const [hour, minute] = time.split(':').map(Number);
    for (const offset of [0, 5, 10]) {
      const total = hour * 60 + minute + offset;
      result.add(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
    }
  }
  return result;
}

function emptySupplementIndex() {
  return { sessions: {}, outsideRthExcluded: 0, outsideRthByTicker: {} };
}

function addOutside(index, ticker) {
  index.outsideRthExcluded += 1;
  index.outsideRthByTicker[ticker] = (index.outsideRthByTicker[ticker] || 0) + 1;
}

function indexSupplement(input, requiredSessions = null) {
  const index = { ...emptySupplementIndex(), ohlcQuantumCorrections: [] };
  const seen = new Set();
  for (const { ticker, series } of collectRawSeries(input)) {
    const contract = contractForTicker(ticker);
    // An unsupported listing cannot repair a governed session.  Still validate
    // nothing from it rather than guessing a calendar or a time zone.
    if (!contract) continue;
    const expectedTimes = expectedFiveMinuteTimes(contract);
    for (const raw of series) {
      const row = rawRow(raw);
      if (!row || typeof row !== 'object') throw new Error(`supplement ${ticker}: bar is not an object or OHLCV row`);
      const rawTimestamp = canonicalTimestamp(row.timestamp ?? row.datetime ?? row.time ?? row.date);
      const local = localDateTime(rawTimestamp, contract.timeZone);
      const requiredKey = local && `${local.date}\u0000${ticker}`;
      if (requiredSessions && (!requiredKey || !requiredSessions.has(requiredKey))) continue;
      if (!local || !expectedTimes.has(local.time)) {
        addOutside(index, ticker);
        continue;
      }
      if (!isIsoDate(local.date) || !isTradingDayForTicker(local.date, ticker)) {
        addOutside(index, ticker);
        continue;
      }
      if (!isEpochAligned(rawTimestamp, 5 * 60 * 1000)) {
        throw new Error(`supplement ${ticker}: in-session timestamp is not on a 5m boundary: ${rawTimestamp}`);
      }
      const bar = normalizeBar(row, `supplement ${ticker}`, correction => {
        index.ohlcQuantumCorrections.push({ date: local.date, ticker, timestamp: rawTimestamp, ...correction });
      });
      const key = `${local.date}\u0000${ticker}\u0000${bar.timestamp}`;
      if (seen.has(key)) throw new Error(`supplement ${ticker}: duplicate 5m bar at ${bar.timestamp}`);
      seen.add(key);
      index.sessions[local.date] ||= {};
      index.sessions[local.date][ticker] ||= [];
      index.sessions[local.date][ticker].push(bar);
    }
  }
  for (const tickers of Object.values(index.sessions)) {
    for (const bars of Object.values(tickers)) bars.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  return index;
}

function fullSessionFiveMinuteBars(bars, date, contract, ticker) {
  if (!Array.isArray(bars)) return { ok: false, reason: 'no_supplemental_session' };
  const expectedTimes = expectedFiveMinuteTimes(contract);
  if (bars.length !== contract.expectedTimes.length * 3) {
    return { ok: false, reason: `expected_${contract.expectedTimes.length * 3}_5m_bars_got_${bars.length}` };
  }
  const byTime = new Map();
  for (const raw of bars) {
    const bar = normalizeBar(raw, `supplement ${ticker}`);
    if (!isEpochAligned(bar.timestamp, 5 * 60 * 1000)) {
      return { ok: false, reason: 'supplement_timestamp_not_on_5m_boundary' };
    }
    const local = dateTimeInZone(bar.timestamp, contract.timeZone);
    if (!local || local.date !== date || !expectedTimes.has(local.time)) {
      return { ok: false, reason: 'supplement_timestamp_outside_session_contract' };
    }
    if (byTime.has(local.time)) return { ok: false, reason: 'duplicate_5m_timestamp' };
    byTime.set(local.time, bar);
  }
  const aggregated = [];
  for (const start of contract.expectedTimes) {
    const [hour, minute] = start.split(':').map(Number);
    const componentTimes = [0, 5, 10].map(offset => {
      const total = hour * 60 + minute + offset;
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    });
    const components = componentTimes.map(time => byTime.get(time));
    if (components.some(bar => !bar)) return { ok: false, reason: `missing_5m_component_at_${start}` };
    aggregated.push({
      timestamp: components[0].timestamp,
      open: components[0].open,
      high: Math.max(...components.map(bar => bar.high)),
      low: Math.min(...components.map(bar => bar.low)),
      close: components[2].close,
      volume: components.reduce((total, bar) => total + bar.volume, 0),
    });
  }
  return { ok: true, bars: aggregated };
}

function validateBaseSession(session, date, contract, ticker) {
  if (!Array.isArray(session)) return { healthy: false, reason: 'base_session_not_an_array' };
  if (session.length !== contract.expectedTimes.length) {
    return { healthy: false, reason: `expected_${contract.expectedTimes.length}_15m_bars_got_${session.length}` };
  }
  const seen = new Set();
  for (let index = 0; index < session.length; index += 1) {
    let bar;
    try { bar = normalizeBar(session[index], `base ${ticker}`); }
    catch (error) { return { healthy: false, reason: error.message }; }
    if (!isEpochAligned(bar.timestamp, 15 * 60 * 1000)) {
      return { healthy: false, reason: 'base_timestamp_not_on_15m_boundary' };
    }
    const local = dateTimeInZone(bar.timestamp, contract.timeZone);
    if (!local || local.date !== date || local.time !== contract.expectedTimes[index]) {
      return { healthy: false, reason: 'base_timestamp_sequence_invalid' };
    }
    if (seen.has(bar.timestamp)) return { healthy: false, reason: 'base_duplicate_15m_timestamp' };
    seen.add(bar.timestamp);
  }
  return { healthy: true };
}

function overlapConflict(baseBars, rebuiltBars, date, contract, ticker) {
  if (!Array.isArray(baseBars)) return { matches: 0, conflicts: [], volumeMismatches: 0, maxAbs: 0, maxRel: 0 };
  const rebuiltByTimestamp = new Map(rebuiltBars.map(bar => [bar.timestamp, bar]));
  const conflicts = [];
  let matches = 0;
  let volumeMismatches = 0;
  let maxAbs = 0;
  let maxRel = 0;
  for (const raw of baseBars) {
    let base;
    try { base = normalizeBar(raw, `base ${ticker}`); }
    catch { continue; }
    const local = dateTimeInZone(base.timestamp, contract.timeZone);
    if (!local || local.date !== date || !contract.expectedTimes.includes(local.time)) continue;
    const replacement = rebuiltByTimestamp.get(base.timestamp);
    if (!replacement) continue;
    const priceDiffs = ['open', 'high', 'low', 'close'].map(field => Math.abs(base[field] - replacement[field]));
    const maxBarAbs = Math.max(...priceDiffs);
    if (maxBarAbs === 0) {
      matches += 1;
      if (base.volume !== replacement.volume) volumeMismatches += 1;
      continue;
    }
    maxAbs = Math.max(maxAbs, maxBarAbs);
    maxRel = Math.max(maxRel, ...['open', 'high', 'low', 'close'].map(field => Math.abs(base[field] - replacement[field]) / Math.abs(replacement[field])));
    conflicts.push(base.timestamp);
  }
  return { matches, conflicts, volumeMismatches, maxAbs, maxRel };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function relativeRepoPath(value) {
  const absolute = path.resolve(value);
  const relative = path.relative(ROOT, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`path must remain inside repository: ${value}`);
  return { absolute, relative };
}

function supplement(base, supplementInput, options = {}) {
  const referenceClose = options.referenceClose;
  if (!isIsoDate(referenceClose)) throw new Error(`invalid --reference-close: ${referenceClose}`);
  if (!base || typeof base !== 'object' || !base.sessions || typeof base.sessions !== 'object' || Array.isArray(base.sessions)) {
    throw new Error('base must contain a sessions object');
  }
  const output = clone(base);
  const requiredSessions = options.requiredSessions || null;
  const indexed = indexSupplement(supplementInput, requiredSessions);
  const diagnostics = {
    reference_close: referenceClose,
    repaired_sessions: [],
    non_repaired_sessions: [],
    healthy_sessions_preserved: [],
    overlap_price_conflicts: [],
    overlap_volume_mismatches: [],
    ohlc_quantum_corrections: indexed.ohlcQuantumCorrections,
    out_of_scope_sessions_preserved: [],
    outside_rth_excluded: indexed.outsideRthExcluded,
    outside_rth_excluded_by_ticker: indexed.outsideRthByTicker,
  };

  const baseByTarget = new Map();
  for (const [date, tickers] of Object.entries(base.sessions)) {
    if (!isIsoDate(date) || !tickers || typeof tickers !== 'object' || Array.isArray(tickers)) {
      diagnostics.non_repaired_sessions.push({ date, ticker: null, reason: 'base_session_shape_invalid' });
      continue;
    }
    for (const [ticker, bars] of Object.entries(tickers)) {
      const normalizedTicker = normalisedTicker(ticker);
      baseByTarget.set(`${date}\u0000${normalizedTicker}`, { date, ticker, normalizedTicker, bars });
    }
  }
  const targets = requiredSessions || new Set(baseByTarget.keys());
  for (const target of [...targets].sort()) {
    const [date, normalizedTicker] = target.split('\u0000');
    const existing = baseByTarget.get(target);
    if (requiredSessions && !existing) {
      // An absent session is incomplete and can be introduced only from a full,
      // certified 5m session; this is still an atomic session replacement.
    } else if (!requiredSessions && !existing) {
      continue;
    }
    if (requiredSessions === null) {
      // no scope note required: every base session is considered below
    }
    const contract = contractForTicker(normalizedTicker);
    if (!contract) {
      diagnostics.non_repaired_sessions.push({ date, ticker: normalizedTicker, reason: 'intraday_calendar_not_supported_for_listing' });
      continue;
    }
    if (!isTradingDayForTicker(date, normalizedTicker)) {
      diagnostics.non_repaired_sessions.push({ date, ticker: normalizedTicker, reason: 'non_trading_day_under_contract' });
      continue;
    }
    const baseBars = existing && existing.bars;
    const baseHealth = existing ? validateBaseSession(baseBars, date, contract, normalizedTicker) : { healthy: false, reason: 'base_session_absent' };
    if (baseHealth.healthy) {
      diagnostics.healthy_sessions_preserved.push({ date, ticker: normalizedTicker });
      continue;
    }
    const rebuilt = fullSessionFiveMinuteBars(
      indexed.sessions[date] && indexed.sessions[date][normalizedTicker], date, contract, normalizedTicker,
    );
    if (!rebuilt.ok) {
      diagnostics.non_repaired_sessions.push({ date, ticker: normalizedTicker, reason: rebuilt.reason, base_reason: baseHealth.reason });
      continue;
    }
    const overlap = overlapConflict(baseBars, rebuilt.bars, date, contract, normalizedTicker);
    if (overlap.conflicts.length) diagnostics.overlap_price_conflicts.push({
      date, ticker: normalizedTicker, timestamps: overlap.conflicts, max_abs: overlap.maxAbs, max_rel: overlap.maxRel,
    });
    if (overlap.volumeMismatches) diagnostics.overlap_volume_mismatches.push({ date, ticker: normalizedTicker, bars: overlap.volumeMismatches });
    output.sessions[date] ||= {};
    output.sessions[date][existing ? existing.ticker : normalizedTicker] = rebuilt.bars;
    diagnostics.repaired_sessions.push({ date, ticker: normalizedTicker, bars: rebuilt.bars.length, matching_base_bars: overlap.matches });
  }
  if (requiredSessions) {
    for (const [target, existing] of baseByTarget) {
      if (!requiredSessions.has(target)) diagnostics.out_of_scope_sessions_preserved.push({ date: existing.date, ticker: existing.normalizedTicker });
    }
  }
  return { output, diagnostics };
}

function parseArgs(argv) {
  const allowed = new Set(['--in', '--base', '--out', '--reference-close', '--required-sessions']);
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag) || !argv[index + 1] || args[flag]) throw new Error('Usage: build-retro-intraday-supplement.js --in MCPjson --base intraday-bars-15m.json --out new.json --reference-close YYYY-MM-DD');
    args[flag] = argv[index + 1];
    index += 1;
  }
  if (![args['--in'], args['--base'], args['--out']].every(Boolean) || !isIsoDate(args['--reference-close'])) {
    throw new Error('Usage: build-retro-intraday-supplement.js --in MCPjson --base intraday-bars-15m.json --out new.json --reference-close YYYY-MM-DD');
  }
  return { input: args['--in'], base: args['--base'], output: args['--out'], referenceClose: args['--reference-close'], requiredSessions: args['--required-sessions'] || null };
}

function requiredSessionSet(payload, referenceClose) {
  if (!payload || typeof payload !== 'object' || payload.reference_close !== referenceClose
    || !payload.sessions || typeof payload.sessions !== 'object' || Array.isArray(payload.sessions)) {
    throw new Error('required sessions manifest has an invalid reference close or sessions object');
  }
  const result = new Set();
  for (const [date, tickers] of Object.entries(payload.sessions)) {
    if (!isIsoDate(date) || !Array.isArray(tickers) || !tickers.length) throw new Error(`required sessions manifest has invalid session ${date}`);
    for (const ticker of tickers) {
      const normalized = normalisedTicker(ticker);
      if (!normalized || !contractForTicker(normalized)) throw new Error(`required sessions manifest has unsupported ticker ${ticker}`);
      result.add(`${date}\u0000${normalized}`);
    }
  }
  return result;
}

function loadRequiredSessions(value, referenceClose) {
  if (!value) return null;
  const manifestPath = relativeRepoPath(value);
  const bytes = fs.readFileSync(manifestPath.absolute);
  const payload = JSON.parse(bytes);
  if (payload.source_results && payload.source_results.path && payload.source_results.sha256) {
    const source = relativeRepoPath(payload.source_results.path);
    if (sha256(fs.readFileSync(source.absolute)) !== payload.source_results.sha256) {
      throw new Error('required sessions manifest source_results hash mismatch');
    }
  }
  return { set: requiredSessionSet(payload, referenceClose), path: manifestPath.relative, sha256: sha256(bytes) };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPath = relativeRepoPath(args.input);
  const basePath = relativeRepoPath(args.base);
  const outputPath = relativeRepoPath(args.output);
  const required = loadRequiredSessions(args.requiredSessions, args.referenceClose);
  if (outputPath.absolute === inputPath.absolute || outputPath.absolute === basePath.absolute) throw new Error('--out must be a new path');
  const inputBytes = fs.readFileSync(inputPath.absolute);
  const inputHash = sha256(inputBytes);
  const provenance = validateCollectedArtifact(inputPath.absolute, inputHash, args.referenceClose, ROOT);
  if (provenance.length) throw new Error(`supplement MCP provenance invalid: ${provenance.join('; ')}`);
  const baseBytes = fs.readFileSync(basePath.absolute);
  const base = JSON.parse(baseBytes);
  const { output, diagnostics } = supplement(base, JSON.parse(inputBytes), {
    referenceClose: args.referenceClose, requiredSessions: required && required.set,
  });
  output.generated_at = new Date().toISOString();
  output.source_artifacts = Array.isArray(output.source_artifacts) ? output.source_artifacts : [];
  const sourceArtifact = { path: inputPath.relative, sha256: inputHash, reference_close: args.referenceClose, timeframe: '5m' };
  if (!output.source_artifacts.some(item => item && item.path === sourceArtifact.path && item.sha256 === sourceArtifact.sha256)) {
    output.source_artifacts.push(sourceArtifact);
  }
  output.supplement_diagnostics = {
    ...diagnostics,
    inputs: {
      base: { path: basePath.relative, sha256: sha256(baseBytes) },
      supplement: sourceArtifact,
      ...(required ? { required_sessions: { path: required.path, sha256: required.sha256 } } : {}),
    },
  };
  fs.mkdirSync(path.dirname(outputPath.absolute), { recursive: true });
  const temp = `${outputPath.absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(output, null, 2)}\n`);
  fs.renameSync(temp, outputPath.absolute);
  console.log(`${outputPath.relative}: ${diagnostics.repaired_sessions.length} repaired, ${diagnostics.non_repaired_sessions.length} not repaired`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {
  canonicalTimestamp, isEpochAligned, localDateTime, normalizeBar, collectRawSeries, indexSupplement, fullSessionFiveMinuteBars,
  validateBaseSession, overlapConflict, supplement, parseArgs, requiredSessionSet, loadRequiredSessions, main,
};
