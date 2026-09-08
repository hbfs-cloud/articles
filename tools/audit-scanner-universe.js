#!/usr/bin/env node
'use strict';
/** Offline preselection audit. Never certifies a trade or supplies missing evidence.
 * node tools/audit-scanner-universe.js build --dir scanner/YYYYMMDD --refdate YYYY-MM-DD [--regime RISK-ON]
 * node tools/audit-scanner-universe.js validate --dir scanner/YYYYMMDD --refdate YYYY-MM-DD
 * Inputs are read only. The sole output is <dir>/_audit/universe.json.
 * Formula families are isolated by the hash of the actual collected producer/score_expr.
 * Ranking is descriptive within each family; it is not a forecast or a portfolio allocation.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { rankWithinFamily, familyOf, checkSignal } = require('./lib/score-contract');
const { stableStringify } = require('./lib/workflow-contract');
const ROOT = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const r2 = n => Math.round(n * 100) / 100;
const date = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const day = s => typeof s === 'string' ? s.slice(0, 10) : null;
const finite = (n, key, positive = false) => { if (!Number.isFinite(n) || (positive && n <= 0)) throw Error(`${key}: missing/non-finite${positive ? '/non-positive' : ''}`); return n; };
const screenFile = f => /^autoscreen(?:_etf)?\.json$/.test(f) || /^(?:auto)?screen_.+_us\.json$/.test(f);
const strategies = { screen_momentum_us: 'Momentum', screen_breakout_us: 'Breakout', screen_pullback_us: 'Pullback', autoscreen_etf: 'Momentum' };
const canonStrategy = s => ({ momentum: 'Momentum', breakout: 'Breakout', pullback: 'Pullback', pre_squeeze: 'Pre-Squeeze', 'pre-squeeze': 'Pre-Squeeze' }[String(s).toLowerCase()] || null);

// Kept in parity with build-scan.js: single reference-close entry, noise-floor stop,
// first unbroken pivot resistance in the permitted ATR band, else configured ATR target.
function levels(bars, technical, filters) {
  if (!Array.isArray(bars) || bars.length < 40) throw Error('bars: fewer than 40');
  for (const b of bars) {
    if (!Array.isArray(b) || !date(b[0])) throw Error('bars: invalid date');
    for (let i = 1; i <= 5; i++) finite(b[i], `bars.${b[0]}.${i}`);
    if (b[1] <= 0 || b[2] < Math.max(b[1], b[3], b[4]) || b[3] > Math.min(b[1], b[2], b[4]) || b[3] <= 0 || b[5] < 0) throw Error('bars: invalid OHLCV');
  }
  for (let i = 1; i < bars.length; i++) if (bars[i][0] <= bars[i - 1][0]) throw Error('bars: duplicate/unsorted dates');
  const close = finite(bars.at(-1)[4], 'close', true), atr = finite(technical.atr, 'atr', true);
  const entry = r2(close), s = filters.stops, tp = filters.editorial_targets.tp1_reachability;
  const minDist = Math.max(entry * s.min_pct_from_entry / 100, s.min_atr_multiple * atr);
  if (minDist > entry * s.max_pct_from_entry / 100) throw Error('stop: noise floor exceeds maximum distance');
  const stop = Math.floor((entry - minDist) * 100) / 100;
  const w = bars.slice(-40), highs = [];
  for (let i = 2; i < w.length - 2; i++) if ([i - 2, i - 1, i + 1, i + 2].every(j => w[i][2] > w[j][2])) highs.push(w[i][2]);
  let tp1, tp1Basis;
  for (const hi of highs.sort((a, b) => a - b)) {
    if (hi < entry + tp.min_atr_multiple * atr || hi > entry + tp.max_atr_multiple * atr) continue;
    const formedAt = bars.findIndex(x => x[2] === hi);
    if (bars.slice(formedAt + 1).some(x => x[4] > hi)) continue;
    tp1 = r2(hi); tp1Basis = 'resistance'; break;
  }
  if (tp1 == null) { tp1 = r2(entry + tp.target_atr_multiple * atr); tp1Basis = 'configured_atr_target'; }
  return { close, atr, entry, entry_low: entry, entry_high: entry, stop, tp1, tp1_basis: tp1Basis,
    tp2: r2(entry + tp.max_atr_multiple * atr), stop_pct: r2((stop / entry - 1) * 100),
    stop_atr: r2((entry - stop) / atr), tp1_atr: Math.round((tp1 - entry) / atr * 1000) / 1000,
    rr_entry: r2((tp1 - entry) / (entry - stop)), invalidation_level: r2(bars.at(-1)[3]) };
}

function evaluate(row, technical, barSet, filters, regime, ref) {
  const gates = {}, metrics = {};
  const gate = (name, status, reason) => { gates[name] = { status, ...(reason ? { reason } : {}) }; };
  const requireNumber = (name, n, predicate) => {
    if (!Number.isFinite(n)) gate(name, 'unknown', 'missing/non-finite');
    else gate(name, predicate(n) ? 'passed' : 'failed');
  };
  gate('screen_date', day(row.as_of) === ref ? 'passed' : 'failed', day(row.as_of) === ref ? null : `expected ${ref}, received ${row.as_of}`);
  requireNumber('screen_validity', row.estimated_valid_bars, n => n >= 1);
  if (Number.isFinite(row.last_price) && Number.isFinite(row.avg_volume)) metrics.screen_adv_usd = row.last_price * row.avg_volume;
  requireNumber('screen_liquidity', metrics.screen_adv_usd, n => n >= filters.tickers.min_avg_daily_volume_usd);
  if (!technical || !barSet) {
    gate('enrichment', 'unknown', 'technicals or bars absent from the collected snapshot');
    return { gates, metrics };
  }
  if (barSet.served_completed_end !== ref || barSet.bars?.at(-1)?.[0] !== ref) {
    gate('bars_date', 'failed', `expected completed close ${ref}`); return { gates, metrics };
  }
  gate('bars_date', 'passed');
  if (technical.as_of != null && day(technical.as_of) !== ref) {
    gate('technical_date', 'failed', `expected ${ref}, received ${technical.as_of}`); return { gates, metrics };
  }
  gate('technical_date', technical.as_of == null ? 'unknown' : 'passed', technical.as_of == null ? 'technical as_of absent' : null);
  try {
    Object.assign(metrics, levels(barSet.bars, technical, filters));
    for (const k of ['rsi', 'ema50', 'ema200']) finite(technical[k], k, true);
    const oe = filters.overextension, s = filters.stops, tp = filters.editorial_targets.tp1_reachability;
    metrics.distance_50dma_pct = r2((metrics.close / technical.ema50 - 1) * 100);
    metrics.distance_200dma_pct = r2((metrics.close / technical.ema200 - 1) * 100);
    metrics.rsi = technical.rsi;
    metrics.consolidation_bars = technical.consolidation_bars != null ? technical.consolidation_bars
      : barSet.bars.slice(-16, -1).filter(b => b[2] - b[3] < 1.5 * technical.atr).length;
    metrics.adv20_usd = technical.adv20_usd != null ? technical.adv20_usd
      : barSet.bars.slice(-20).reduce((sum, b) => sum + b[4] * b[5], 0) / 20;
    const maxExt = oe.max_distance_50dma_pct_by_strategy[row.editorial_strategy];
    gate('strategy', maxExt == null ? 'unknown' : 'passed', maxExt == null ? 'no executable strategy policy' : null);
    if (maxExt != null) requireNumber('extension_50dma', metrics.distance_50dma_pct, n => n <= maxExt);
    requireNumber('extension_200dma', metrics.distance_200dma_pct, n => n <= oe.max_distance_200dma_pct);
    requireNumber('rsi', metrics.rsi, n => n <= oe.max_rsi14_daily);
    requireNumber('consolidation', metrics.consolidation_bars, n => n >= oe.min_consolidation_bars);
    requireNumber('liquidity', metrics.adv20_usd, n => n >= filters.tickers.min_avg_daily_volume_usd);
    requireNumber('stop_pct', Math.abs(metrics.stop_pct), n => n >= s.min_pct_from_entry - 1e-9 && n <= s.max_pct_from_entry + 1e-9);
    requireNumber('stop_atr', metrics.stop_atr, n => n >= s.min_atr_multiple - 1e-9);
    requireNumber('tp1_reachability', metrics.tp1_atr, n => n >= tp.min_atr_multiple && n <= tp.max_atr_multiple);
    const rrMin = filters.editorial_targets.rr_min_by_regime[regime];
    if (Number.isFinite(rrMin)) requireNumber('rr', metrics.rr_entry, n => n >= rrMin);
    else gate('rr', 'unknown', 'governing regime unavailable; no regime assumed');
    gate('target_above_entry', metrics.tp1 > metrics.entry ? 'passed' : 'failed');
    gate('invalidation', metrics.invalidation_level > metrics.stop && metrics.invalidation_level <= metrics.entry ? 'passed' : 'failed');
    gate('level_calculation', 'passed');
  } catch (e) {
    gate('level_calculation', /missing|non-finite|fewer than/.test(e.message) ? 'unknown' : 'failed', e.message);
  }
  return { gates, metrics };
}

function audit({ root = ROOT, dir, referenceClose: ref, regime, useDerived = false }) {
  if (!date(ref)) throw Error('Invalid --refdate (YYYY-MM-DD required)');
  const directory = path.resolve(root, dir), sources = [], errors = [], documents = new Map();
  const read = filename => {
    const absolute = path.resolve(filename);
    if (documents.has(absolute)) return documents.get(absolute);
    const bytes = fs.readFileSync(absolute), data = JSON.parse(bytes);
    sources.push({ path: path.relative(root, absolute), sha256: hash(bytes) }); documents.set(absolute, data); return data;
  };
  const filters = read(path.join(root, 'data/scanner-filters.json'));
  if (regime != null && !Number.isFinite(filters.editorial_targets.rr_min_by_regime[regime])) throw Error('Unknown --regime');
  const overlay = read(path.join(root, filters.audit_gates.recent_strategy_performance.source));
  const overlayEvidence = path.join(root, overlay.evidence_source);
  read(overlayEvidence);
  if (sources.find(s => s.path === path.relative(root, overlayEvidence))?.sha256 !== overlay.evidence_sha256) errors.push('overlay evidence hash mismatch');
  const positionsFile = path.join(root, filters.anti_duplicate.check_file);
  const positions = fs.existsSync(positionsFile) ? read(positionsFile) : null;
  const open = new Set((positions?.open_positions || []).map(x => x.ticker));
  const tech = new Map(), bars = new Map(), raw = [], families = new Map();
  const missingWaves = [];
  for (const sub of ['_data', '_data2']) {
    const folder = path.join(directory, sub);
    if (!fs.existsSync(folder)) { missingWaves.push(sub); continue; }
    let harness, collect;
    try {
      harness = read(path.join(folder, 'harness.json')); collect = read(path.join(folder, '_collect.json'));
      if (harness.reference_close !== ref || collect.reference_date !== ref) throw Error('harness/collector reference close mismatch');
      if (hash(stableStringify(collect.resolved_input)) !== collect.input_sha256 || harness.input_sha256 !== collect.input_sha256) throw Error('resolved input hash mismatch');
      if (collect.resolved_input.equity_reference_close !== ref) throw Error('resolved input reference close mismatch');
      const planFile = path.resolve(root, collect.plan); read(planFile);
      const planHash = sources.find(s => s.path === path.relative(root, planFile))?.sha256;
      if (planHash !== collect.plan_sha256 || harness.plan_sha256 !== planHash || harness.plan !== collect.plan) throw Error('plan hash/path mismatch');
      if (collect.workflow !== 'scanner' || harness.workflow !== 'scanner') throw Error('source workflow is not scanner');
    } catch (e) { errors.push(`${sub}: ${e.message}`); continue; }
    const calls = (collect.waves || []).flatMap(w => w.calls || []);
    const inputs = (collect.resolved_input.waves || []).flatMap(w => w.calls || []);
    for (const expected of inputs.filter(c => c.freshness?.required === true)) {
      if (!calls.some(c => c.as === expected.as && c.ok === true)) errors.push(`${sub}: required call ${expected.as} missing/failed`);
    }
    for (const file of fs.readdirSync(folder).sort()) {
      if (!(sub === '_data' ? screenFile(file) : /^(tech|bars)_b\d+\.json$/.test(file))) continue;
      const alias = file.slice(0, -5), filename = path.join(folder, file);
      let body, input;
      try {
        body = read(filename);
        const actual = sources.find(s => s.path === path.relative(root, filename)).sha256;
        const declared = harness.sources?.find(s => s.name === alias);
        const receipts = calls.filter(c => c.as === alias && c.ok === true && c.output_sha256 === actual);
        input = inputs.find(c => c.as === alias);
        if (!declared || declared.sha256 !== actual || receipts.length !== 1 || !input) throw Error('source hash/collector receipt mismatch');
      } catch (e) { errors.push(`${sub}/${file}: ${e.message}`); continue; }
      const source = path.relative(root, filename);
      if (sub === '_data') {
        const args = input.args || {};
        if (args.region !== 'US' || !['stock', 'etf'].includes(args.asset)) { errors.push(`${source}: source does not attest US stock/ETF universe`); continue; }
        for (const item of body.data?.items || []) for (const original of item.candidates || []) {
          const row = { ...original, ticker: original.symbol || original.ticker, editorial_strategy: strategies[alias] || canonStrategy(original.strategy) };
          if (!row.ticker || typeof row.ticker !== 'string') { errors.push(`${source}: missing ticker`); continue; }
          // A DSL family comes from the captured formula, NEVER from a numerical range or an editorial label.
          const dsl = row.strategy === 'custom_dsl';
          const producer = { server: input.server, tool: input.tool, score_expr: args.score_expr || null, asset: args.asset, timeframe: args.timeframe || null };
          const family = dsl ? (typeof args.score_expr === 'string' && args.score_expr.trim() ? `dsl:${hash(stableStringify(producer))}` : null) : familyOf(row);
          if (family && !families.has(family)) families.set(family, { family, producer, sources: [] });
          if (family && !families.get(family).sources.includes(source)) families.get(family).sources.push(source);
          raw.push({ row, source, family, dsl, region: args.asset === 'etf' ? 'ETF' : 'US' });
        }
      } else {
        for (const item of body.data?.items || []) for (const result of item.results || []) for (const value of result.data || []) {
          const map = result.data_type === 'technicals' ? tech : result.data_type === 'bars_daily' ? bars : null;
          if (!map || !value.symbol) continue;
          if (map.has(value.symbol)) { errors.push(`${value.symbol}: duplicate ${result.data_type}; last-write-wins forbidden`); continue; }
          map.set(value.symbol, { value, source });
        }
      }
    }
  }
  const historyRejected = new Map();
  if (useDerived) {
    try {
      const filename = path.join(directory, '_derived/technicals.json');
      const derived = read(filename);
      const recomputed = require('./derive-scanner-technicals').deriveAll({ root, dir, referenceClose: ref, sourceDir: '_data2' });
      if (stableStringify(derived) !== stableStringify(recomputed)) throw Error('deterministic derived recomputation mismatch');
      // A partial archive can reject individual symbols without discarding healthy ones.
      // Never fall back to unbound server technicals for a rejected history.
      tech.clear();
      for (const [symbol, value] of Object.entries(derived.symbols)) tech.set(symbol, { value, source: path.relative(root, filename) });
      for (const r of derived.rejected) historyRejected.set(r.symbol, r.reason);
    } catch (e) { errors.push(`derived technicals: ${e.message}`); tech.clear(); }
  }
  const rows = raw.map(({ row, source, family, dsl, region }) => {
    const result = evaluate(row, tech.get(row.ticker)?.value, bars.get(row.ticker)?.value, filters, regime, ref);
    const g = result.gates;
    if (useDerived) g.history_continuity = historyRejected.has(row.ticker)
      ? { status: 'failed', reason: historyRejected.get(row.ticker) }
      : { status: tech.has(row.ticker) ? 'passed' : 'unknown' };
    const scoreOK = family && (dsl ? Number.isFinite(row.score) : checkSignal(row).ok);
    g.score_family = { status: scoreOK ? 'passed' : 'unknown', ...(scoreOK ? {} : { reason: 'unknown producer/formula or invalid score' }) };
    const numeric = Object.values(g);
    const numericStatus = numeric.some(v => v.status === 'failed') ? 'failed' : numeric.some(v => v.status === 'unknown') ? 'unknown' : 'passed';
    g.us_listing = { status: 'passed', reason: 'US asset universe in hash-bound collector request; no domicile inference' };
    g.sector = { status: filters.diversification.sector_map[row.ticker] ? 'passed' : 'unknown' };
    g.market_cap = { status: region === 'ETF' ? 'not_applicable' : !Number.isFinite(row.market_cap) || row.market_cap <= 0 ? 'unknown' : row.market_cap >= filters.tickers.min_market_cap_usd ? 'passed' : 'failed' };
    g.open_position = { status: !positions ? 'unknown' : open.has(row.ticker) ? 'failed' : 'passed' };
    // Deliberately a preselection contract. Neither absence from a calendar response nor
    // an unreviewed SEC hit list is enough to release these mandatory gates.
    for (const name of ['sec_review', 'earnings_review', 'final_basket_review']) g[name] = { status: 'unknown', reason: 'separate current reviewed evidence required; this audit does not certify actionability' };
    if (region === 'ETF') g.lookthrough = { status: 'unknown', reason: 'current holdings/factor/correlation review required' };
    const failed = Object.entries(g).filter(([, v]) => v.status === 'failed').map(([name]) => name);
    const unknown = Object.entries(g).filter(([, v]) => v.status === 'unknown').map(([name]) => name);
    return { ticker: row.ticker, family, source_artifact: source, source_score: Number.isFinite(row.score) ? row.score : null,
      strategy: row.editorial_strategy, region, sector: filters.diversification.sector_map[row.ticker] || null,
      source_row: row, enrichment_sources: [tech.get(row.ticker)?.source, bars.get(row.ticker)?.source].filter(Boolean),
      ...result, numeric_status: numericStatus, status: failed.length ? 'rejected' : 'needs_verification', failed_gates: failed, missing_gates: unknown,
      family_rank: null, family_percentile: null, family_count: null, _rankable: !!scoreOK };
  });
  for (const family of [...families.keys()].sort()) {
    const group = rows.filter(r => r.family === family && r._rankable);
    const unique = new Map();
    for (const row of group) {
      if (unique.has(row.ticker)) { errors.push(`${row.ticker}: duplicate candidate within ${family}; no silent score selection`); continue; }
      unique.set(row.ticker, row);
    }
    // DSL rows intentionally have no invented registry scoreFamily; each invocation contains
    // exactly one captured formula. rankWithinFamily therefore cannot mix formula units.
    const ranked = rankWithinFamily([...unique.values()].map(r => ({ ticker: r.ticker, score: r.source_score, ...(family.startsWith('dsl:') ? {} : { scoreFamily: family }) })));
    for (const rank of ranked) Object.assign(unique.get(rank.signal.ticker), { family_rank: rank.rank, family_percentile: rank.pct, family_count: rank.ofN });
  }
  rows.sort((a, b) => String(a.family).localeCompare(String(b.family)) || (a.family_rank ?? Infinity) - (b.family_rank ?? Infinity) || a.ticker.localeCompare(b.ticker));
  for (const row of rows) { delete row._rankable; if (errors.length) row.status = 'blocked_source_integrity'; }
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return { schema_version: 1, product: 'scanner_universe_preselection', reference_close: ref, regime: regime ?? null, technical_basis: useDerived ? 'derived_300_completed_sessions' : 'server',
    status: errors.length ? 'blocked' : missingWaves.length ? 'not_ready' : 'preselection_only', missing_waves: missingWaves, actionability_certified: false,
    limitations: ['Ranks are within producer/formula families, never a cross-family return ranking.', 'SEC, earnings, ETF look-through and portfolio gates remain mandatory.', 'Missing data stay unknown. This artifact never releases a trade.'],
    errors, source_artifacts: sources.sort((a, b) => a.path.localeCompare(b.path)),
    filters_sha256: sources.find(s => s.path === 'data/scanner-filters.json')?.sha256,
    families: [...families.values()].sort((a, b) => a.family.localeCompare(b.family)), counts, candidates: rows,
    numerically_passed: errors.length ? [] : rows.filter(r => r.numeric_status === 'passed' && r.status !== 'rejected').map(r => ({ ticker: r.ticker, family: r.family, family_rank: r.family_rank })),
    eligible: [], selected_for_verify: [] };
}

function validate(snapshot, root, ref, dir = null) {
  const errors = [];
  if (!date(ref) || snapshot.reference_close !== ref) errors.push('audit reference close mismatch');
  if (snapshot.schema_version !== 1 || snapshot.product !== 'scanner_universe_preselection') errors.push('invalid audit schema');
  if (snapshot.actionability_certified !== false || snapshot.eligible?.length) errors.push('preselection must not certify actionability');
  if (snapshot.status === 'blocked' || snapshot.errors?.length) errors.push('source integrity blocked');
  if (snapshot.status === 'not_ready' || snapshot.missing_waves?.length) errors.push('required wave absent');
  if (!snapshot.source_artifacts?.length) errors.push('no source hashes');
  if (!['server', 'derived_300_completed_sessions'].includes(snapshot.technical_basis)) errors.push('unknown technical basis');
  for (const source of snapshot.source_artifacts || []) {
    const filename = path.resolve(root, source.path);
    if (!fs.existsSync(filename) || hash(fs.readFileSync(filename)) !== source.sha256) errors.push(`source hash mismatch: ${source.path}`);
  }
  // Source integrity is necessary but does not certify the decisions derived from it.
  // Rebuild the entire audit; a modified gate/status/rank/count must not inherit PASS.
  if (!errors.length) {
    try {
      const inferred = [...new Set(snapshot.source_artifacts
        .filter(s => /(?:^|\/)_data2?\/harness\.json$/.test(s.path))
        .map(s => path.dirname(path.dirname(s.path))))];
      if (dir == null) {
        if (inferred.length !== 1) throw Error('provide an explicit audit directory; source directory is ambiguous');
        dir = inferred[0];
      }
      if (inferred.length !== 1 || path.resolve(root, dir) !== path.resolve(root, inferred[0])) throw Error('audit directory does not match source provenance');
      const rebuilt = audit({ root, dir, referenceClose: ref, regime: snapshot.regime,
        useDerived: snapshot.technical_basis === 'derived_300_completed_sessions' });
      if (stableStringify(rebuilt) !== stableStringify(snapshot)) errors.push('deterministic audit recomputation mismatch');
    } catch (e) { errors.push(`audit recomputation failed: ${e.message}`); }
  }
  return errors;
}

if (require.main === module) {
  const argv = process.argv.slice(2), arg = key => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] : null; };
  if (argv.includes('--help') || !argv.length) {
    console.log('Offline preselection only. No network, no source mutations.\nUsage: node tools/audit-scanner-universe.js build --dir scanner/YYYYMMDD --refdate YYYY-MM-DD [--regime RISK-ON]\n       node tools/audit-scanner-universe.js validate --dir scanner/YYYYMMDD --refdate YYYY-MM-DD\nOutput: <dir>/_audit/universe.json. Without --regime, RR remains unknown. Exit 1 = integrity blocked or missing wave; needs_verification is expected before final proofs.');
  } else {
    try {
      const dir = arg('--dir'), ref = arg('--refdate');
      if (!dir || !['build', 'validate'].includes(argv[0])) throw Error('Use --help for required arguments');
      const file = path.resolve(ROOT, dir, '_audit/universe.json');
      if (argv[0] === 'build') {
        const result = audit({ dir, referenceClose: ref, regime: arg('--regime'), useDerived: argv.includes('--derived') });
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify({ file, status: result.status, counts: result.counts, numerically_passed: result.numerically_passed.length, errors: result.errors }));
        if (result.errors.length || result.missing_waves.length) process.exitCode = 1;
      } else {
        const errors = validate(JSON.parse(fs.readFileSync(file)), ROOT, ref, dir);
        console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', errors })); if (errors.length) process.exitCode = 1;
      }
    } catch (e) { console.error(e.message); process.exitCode = 1; }
  }
}
module.exports = { audit, evaluate, levels, validate };
