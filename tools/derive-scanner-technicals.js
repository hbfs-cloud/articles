#!/usr/bin/env node
'use strict';
/** Offline, reproducible scanner technicals from hash-bound completed US daily bars.
 * node tools/derive-scanner-technicals.js --dir scanner/YYYYMMDD --refdate YYYY-MM-DD
 * node tools/derive-scanner-technicals.js --dir scanner/YYYYMMDD --refdate YYYY-MM-DD --validate
 * Add --source-dir _data2 for scanner-wave2 bars_bN; default _verify uses history_bN.
 * Writes only <dir>/_derived/technicals.json. No network or capture modification.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { stableStringify } = require('./lib/workflow-contract');
const { isUSTradingDay, usTradingDaysBetween, nextUSTradingDay } = require('./lib/market-calendar');
const ROOT = path.resolve(__dirname, '..');
const SOURCE_CONTRACTS = Object.freeze({
  _verify: Object.freeze({ plan: 'plans/scanner-verify-candidates.json', alias: /^history_b\d+$/ }),
  _data2: Object.freeze({ plan: 'plans/scanner-wave2.json', alias: /^bars_b\d+$/ }),
});
const WINDOW = 300, ROUNDING_EPS = 0.001;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const isoDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const FORMULAS = Object.freeze({
  window: 'Exactly the last 300 completed, contiguous US equity sessions ending at reference_close; fewer bars rejected.',
  price_basis: 'Archived raw OHLCV, no dividend adjustment, no rounding or silent repair of input values.',
  atr: 'ATR14 Wilder: TR[i]=max(H[i]-L[i],abs(H[i]-C[i-1]),abs(L[i]-C[i-1])) for i>=1. Seed=mean(first 14 TR); thereafter ATR=(13*previous+TR)/14.',
  rsi: 'RSI14 Wilder: gains=max(deltaClose,0), losses=max(-deltaClose,0). Seed=mean(first 14 changes); Wilder recurrence thereafter. RSI=100-100/(1+avgGain/avgLoss); zero loss=>100, both zero=>50.',
  ema: 'EMA20/50/200: first archived close is the seed; alpha=2/(period+1); recurse over all 300 closes. This is a declared finite-window initialization, not a claim of server initialization parity.',
  macd: 'MACD=EMA12(close)-EMA26(close), both seeded at first close. Signal=EMA9 of the complete MACD series, seeded at its first value (0).',
  adv20_usd: 'Arithmetic mean of close*volume over last 20 sessions, including reference close; US USD listing contract required.',
  consolidation_bars: 'Count among 15 sessions immediately preceding reference close whose high-low range is strictly below 1.5*final ATR14; identical to build-scan.js fallback.',
  rounding_anomalies: 'OHLC bounds exceeded by <=0.001 absolute price units may be diagnosed and retained unchanged, matching the documented upstream rounding policy. Larger anomalies, inverted high/low, nonpositive prices or negative volumes reject.',
  server_comparison: 'Diagnostic deltas only. Undated/current server technicals cannot certify the derived as_of; the completed bar window does.'
});
function emaSeries(values, period) {
  if (!values.length || !Number.isInteger(period) || period <= 0 || !values.every(Number.isFinite)) throw Error('EMA invalid input');
  const alpha = 2 / (period + 1), out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
  return out;
}
function wilder(values, period = 14) {
  if (values.length < period || !values.every(Number.isFinite)) throw Error('Wilder insufficient/non-finite input');
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) value = (value * (period - 1) + values[i]) / period;
  return value;
}
function deriveOne(record, ref) {
  if (!isoDate(ref) || !isUSTradingDay(ref)) throw Error('invalid US reference close');
  if (!record || typeof record.symbol !== 'string' || !record.symbol) throw Error('symbol absent');
  for (const [key, value] of Object.entries({ status: 'completed', served_completed_end: ref, expected_completed_end: ref, sessions_complete: true, current_bar_included: false, asset_calendar: 'us_equity_exchange_sessions' })) {
    if (record[key] !== value) throw Error(`${record.symbol}: ${key} is not ${value}`);
  }
  const raw = record.bars;
  if (!Array.isArray(raw) || raw.length < WINDOW) throw Error(`${record.symbol}: fewer than ${WINDOW} bars`);
  if (record.coverage?.complete !== true || record.coverage.served_end !== ref || record.coverage.expected_session_end !== ref || !Array.isArray(record.coverage.missing_ranges) || record.coverage.missing_ranges.length) throw Error(`${record.symbol}: incomplete coverage metadata`);
  if (record.coverage.observations !== raw.length || record.coverage.served_start !== raw[0]?.[0]) throw Error(`${record.symbol}: coverage observations/start mismatch`);
  const anomalies = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    if (!Array.isArray(b) || b.length < 6 || !isoDate(b[0]) || !isUSTradingDay(b[0]) || b[0] > ref || (i && b[0] <= raw[i - 1][0])) throw Error(`${record.symbol}: invalid/nontrading/duplicate/unsorted bar date`);
    if (!b.slice(1, 6).every(Number.isFinite) || b.slice(1, 5).some(n => n <= 0) || b[5] < 0) throw Error(`${record.symbol}: invalid/non-finite OHLCV`);
    const [d, open, high, low, close] = b;
    if (high < low) throw Error(`${record.symbol}: high below low at ${d}`);
    const excess = Math.max(low - Math.min(open, close), Math.max(open, close) - high, 0);
    if (excess > ROUNDING_EPS + 1e-12) throw Error(`${record.symbol}: OHLC bounds exceeded at ${d} by ${excess}`);
    if (excess > 0) anomalies.push({ symbol: record.symbol, date: d, open, high, low, close, maximum_excess: excess, tolerance: ROUNDING_EPS, treatment: 'retained_unchanged' });
  }
  if (raw.at(-1)[0] !== ref) throw Error(`${record.symbol}: final bar is not reference close ${ref}`);
  if (usTradingDaysBetween(raw[0][0], ref) + 1 !== raw.length) {
    const observed = new Set(raw.map(b => b[0])), missing = [];
    for (let d = raw[0][0]; d <= ref; d = nextUSTradingDay(d)) if (!observed.has(d)) missing.push(d);
    throw Error(`${record.symbol}: noncontiguous bars; missing US sessions: ${missing.join(', ')}`);
  }
  const bars = raw.slice(-WINDOW), closes = bars.map(b => b[4]);
  const tr = bars.slice(1).map((b, i) => Math.max(b[2] - b[3], Math.abs(b[2] - bars[i][4]), Math.abs(b[3] - bars[i][4])));
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const atr = wilder(tr), gain = wilder(changes.map(n => Math.max(n, 0))), loss = wilder(changes.map(n => Math.max(-n, 0)));
  const rsi = loss === 0 ? gain === 0 ? 50 : 100 : 100 - 100 / (1 + gain / loss);
  const em12 = emaSeries(closes, 12), em26 = emaSeries(closes, 26);
  const macd = em12.map((v, i) => v - em26[i]);
  const technicals = { symbol: record.symbol, as_of: ref, reference_close: ref, temporal_mode: 'derived_completed_window',
    close: closes.at(-1), atr, rsi, ema20: emaSeries(closes, 20).at(-1), ema50: emaSeries(closes, 50).at(-1), ema200: emaSeries(closes, 200).at(-1),
    macd: macd.at(-1), signal: emaSeries(macd, 9).at(-1),
    adv20_usd: bars.slice(-20).reduce((sum, b) => sum + b[4] * b[5], 0) / 20,
    consolidation_bars: bars.slice(-16, -1).filter(b => b[2] - b[3] < 1.5 * atr).length, bars_used: WINDOW };
  if (!Object.values(technicals).filter(v => typeof v === 'number').every(Number.isFinite)) throw Error(`${record.symbol}: non-finite derived result`);
  if (atr <= 0) throw Error(`${record.symbol}: nonpositive ATR; trading ratios undefined`);
  return { ...technicals, window: { start: bars[0][0], end: ref, observations: WINDOW, input_observations: raw.length, calendar: 'us_equity', contiguous: true },
    diagnostics: { upstream_rounding_anomalies: anomalies }, bars };
}
function compareServer(derived, server) {
  if (!server) return { status: 'unavailable', reason: 'No certified collected server technicals for this symbol.' };
  const fields = {};
  for (const key of ['atr', 'rsi', 'ema20', 'ema50', 'ema200', 'macd', 'signal', 'adv20_usd', 'consolidation_bars']) {
    const value = server.data[key];
    fields[key] = Number.isFinite(value) ? { derived: derived[key], server: value, difference: derived[key] - value,
      relative_difference_pct: value === 0 ? null : (derived[key] - value) / Math.abs(value) * 100 } : { derived: derived[key], server: null, difference: null, reason: 'server field unavailable/non-finite' };
  }
  return { status: 'diagnostic_only', source_artifact: server.path, source_sha256: server.sha256, server_as_of: server.data.as_of ?? null,
    server_temporal_mode: server.temporalMode ?? null, server_bars_used: server.data.bars_used ?? null, fields,
    note: 'No server parity or timestamp certification is inferred. Derived date is certified from input bars.' };
}
function deriveAll({ root = ROOT, dir, referenceClose: ref, sourceDir = '_verify' }) {
  if (!Object.hasOwn(SOURCE_CONTRACTS, sourceDir)) throw Error('Unsupported --source-dir; use exactly _verify or _data2');
  const contract = SOURCE_CONTRACTS[sourceDir];
  if (!isoDate(ref) || !isUSTradingDay(ref)) throw Error('Invalid --refdate');
  const directory = path.resolve(root, dir), sources = new Map();
  const read = file => {
    const bytes = fs.readFileSync(file), relative = path.relative(root, file);
    const source = { path: relative, sha256: sha(bytes) };
    const prior = sources.get(relative); if (prior && prior.sha256 !== source.sha256) throw Error(`source changed during read: ${relative}`);
    sources.set(relative, source); return { data: JSON.parse(bytes), ...source };
  };
  function certifiedFolder(sub, expectedPlan) {
    const folder = path.join(directory, sub), h = read(path.join(folder, 'harness.json')).data, c = read(path.join(folder, '_collect.json')).data;
    if (h.workflow !== 'scanner' || c.workflow !== 'scanner' || h.reference_close !== ref || c.reference_date !== ref || c.resolved_input?.equity_reference_close !== ref) throw Error(`${sub}: workflow/reference mismatch`);
    if (!c.finished_at) throw Error(`${sub}: collection not finished`);
    const digest = sha(stableStringify(c.resolved_input));
    if (h.input_sha256 !== digest || c.input_sha256 !== digest) throw Error(`${sub}: resolved input hash mismatch`);
    if (expectedPlan && c.plan !== expectedPlan) throw Error(`${sub}: required source plan is ${expectedPlan}`);
    const plan = read(path.resolve(root, c.plan));
    if (h.plan !== c.plan || h.plan_sha256 !== plan.sha256 || c.plan_sha256 !== plan.sha256) throw Error(`${sub}: plan hash mismatch`);
    const inputs = c.resolved_input.waves.flatMap(w => w.calls || []), receipts = c.waves.flatMap(w => w.calls || []);
    function source(alias) {
      const file = read(path.join(folder, alias + '.json'));
      const hs = h.sources.filter(s => s.name === alias), rs = receipts.filter(r => r.as === alias && r.ok === true && r.output_sha256 === file.sha256);
      const args = inputs.filter(i => i.as === alias);
      if (hs.length !== 1 || hs[0].sha256 !== file.sha256 || rs.length !== 1 || args.length !== 1) throw Error(`${sub}/${alias}: source hash/receipt/input mismatch`);
      return { ...file, input: args[0] };
    }
    return { folder, inputs, source };
  }
  const history = certifiedFolder(sourceDir, contract.plan);
  for (const call of history.inputs) {
    if (String(call.args?.types || '').split(',').includes('bars_daily') && !contract.alias.test(call.as)) {
      throw Error(`${sourceDir}: unexpected history alias ${call.as}`);
    }
  }
  const inputs = history.inputs.filter(c => contract.alias.test(c.as));
  if (!inputs.length) throw Error('No registered history calls');
  const techs = new Map(), comparisonWarnings = [];
  if (fs.existsSync(path.join(directory, '_data2'))) {
    // Comparisons are optional; broken provenance remains visible and cannot become data.
    try {
      const server = certifiedFolder('_data2', 'plans/scanner-wave2.json');
      for (const call of server.inputs.filter(c => /^tech_b\d+$/.test(c.as))) {
        const file = server.source(call.as);
        for (const item of file.data.data?.items || []) for (const result of item.results || []) if (result.data_type === 'technicals') for (const data of result.data || []) {
          if (techs.has(data.symbol)) throw Error(`duplicate server technicals ${data.symbol}`);
          techs.set(data.symbol, { data, path: file.path, sha256: file.sha256, temporalMode: result.cells?.find(c => c.symbol === data.symbol)?.temporal_mode });
        }
      }
    } catch (e) { techs.clear(); comparisonWarnings.push(`Server comparison unavailable: ${e.message}`); }
  }
  const symbols = {}, rejected = [], seen = new Set(), expected = [];
  for (const input of inputs) {
    const a = input.args || {};
    if (input.server !== 'marketdata' || input.tool !== 'QueryData' || a.types !== 'bars_daily' || a.limit !== WINDOW || a.completion_policy !== 'completed_only') throw Error(`${input.as}: unsupported history input contract`);
    const requested = typeof a.symbols === 'string' ? a.symbols.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!requested.length || new Set(requested).size !== requested.length) throw Error(`${input.as}: invalid symbols`);
    expected.push(...requested);
    const file = history.source(input.as), found = new Set();
    for (const item of file.data.data?.items || []) for (const result of item.results || []) if (result.data_type === 'bars_daily') for (const record of result.data || []) {
      if (!requested.includes(record.symbol) || found.has(record.symbol) || seen.has(record.symbol)) throw Error(`${input.as}: unexpected/duplicate symbol ${record.symbol}`);
      found.add(record.symbol); seen.add(record.symbol);
      try {
        const value = deriveOne(record, ref);
        symbols[record.symbol] = { ...value, source_artifact: file.path, source_sha256: file.sha256, server_comparison: compareServer(value, techs.get(record.symbol)) };
      } catch (e) { rejected.push({ symbol: record.symbol, source_artifact: file.path, source_sha256: file.sha256, reason: e.message }); }
    }
    for (const symbol of requested) if (!found.has(symbol)) rejected.push({ symbol, source_artifact: file.path, source_sha256: file.sha256, reason: 'requested symbol absent from response' });
  }
  if (new Set(expected).size !== expected.length) throw Error('duplicate requested symbol across history batches');
  // Calendar and implementation are dependencies of every derived number.
  const calendar = read(path.join(root, 'config/us-market-calendar.json'));
  const implementation = { path: path.relative(root, __filename), sha256: sha(fs.readFileSync(__filename)) };
  return { schema_version: 1, product: 'scanner_derived_technicals', reference_close: ref,
    source_directory: sourceDir, source_plan: contract.plan,
    status: rejected.length ? 'partial' : 'ready', actionability_certified: false,
    source_artifacts: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path)), implementation,
    calendar_sha256: calendar.sha256, formulas: FORMULAS, minimum_bars: WINDOW, rounding_tolerance: ROUNDING_EPS,
    counts: { requested: expected.length, derived: Object.keys(symbols).length, rejected: rejected.length },
    comparison_warnings: comparisonWarnings, rejected,
    symbols: Object.fromEntries(Object.entries(symbols).sort(([a], [b]) => a.localeCompare(b))) };
}
function validateArtifact(artifact, root, ref, expectedSourceDir) {
  const errors = [];
  const contract = SOURCE_CONTRACTS[artifact.source_directory];
  if (!contract || contract.plan !== artifact.source_plan || (expectedSourceDir != null && artifact.source_directory !== expectedSourceDir)) errors.push('artifact source directory/plan mismatch');
  if (artifact.product !== 'scanner_derived_technicals' || artifact.schema_version !== 1 || artifact.reference_close !== ref || artifact.actionability_certified !== false) errors.push('artifact schema/reference mismatch');
  if (artifact.status !== 'ready' || artifact.rejected?.length) errors.push('derived artifact incomplete');
  for (const s of [...(artifact.source_artifacts || []), artifact.implementation].filter(Boolean)) {
    const file = path.resolve(root, s.path);
    if (!fs.existsSync(file) || sha(fs.readFileSync(file)) !== s.sha256) errors.push(`source hash mismatch: ${s.path}`);
  }
  return errors;
}
if (require.main === module) {
  const args = process.argv.slice(2), arg = key => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
  if (args.includes('--help')) console.log('Offline derive of 300 completed US daily bars.\nUsage: node tools/derive-scanner-technicals.js --dir scanner/YYYYMMDD --refdate YYYY-MM-DD [--source-dir _verify|_data2] [--validate]\nDefault: _verify/history_b*.json bound to plans/scanner-verify-candidates.json.\nAlternative: _data2/bars_b*.json bound to plans/scanner-wave2.json. Both require limit=300.\nOptional _data2 technicals comparisons.\nWrites only: _derived/technicals.json. Exit 1 for missing/invalid input, rejected symbols or validation failure.');
  else try {
    const dir = arg('--dir'), ref = arg('--refdate'), sourceDir = arg('--source-dir') || '_verify'; if (!dir || !ref) throw Error('Provide --dir and --refdate; see --help');
    const file = path.resolve(ROOT, dir, '_derived/technicals.json');
    if (args.includes('--validate')) {
      const artifact = JSON.parse(fs.readFileSync(file)), errors = validateArtifact(artifact, ROOT, ref, sourceDir);
      if (!errors.length) {
        const recomputed = deriveAll({ dir, referenceClose: ref, sourceDir });
        if (stableStringify(recomputed) !== stableStringify(artifact)) errors.push('deterministic recomputation mismatch');
      }
      console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', errors })); if (errors.length) process.exitCode = 1;
    } else {
      const result = deriveAll({ dir, referenceClose: ref, sourceDir }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify({ file, status: result.status, counts: result.counts, rejected: result.rejected, comparison_warnings: result.comparison_warnings }));
      if (result.status !== 'ready') process.exitCode = 1;
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { FORMULAS, emaSeries, wilder, deriveOne, deriveAll, compareServer, validateArtifact };
