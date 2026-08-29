#!/usr/bin/env node
'use strict';

/**
 * Ingest a DtxBookEquity artifact into data/dtx/<portfolio>.json.
 *
 * The script is intentionally offline. DtxBookEquity is outside the scoped
 * DtxMintReadOnlyToken surface, so a subprocess must not pretend that a
 * readonly token can fetch it. The authenticated agent captures the MCP result,
 * and this script only validates and installs that evidence.
 *
 * Usage:
 *   node tools/dtx-book-equity-ingest.js --portfolio best \
 *     --book-file scanner/YYYYMMDD/_dtx/book_equity_best.json \
 *     --expected-close YYYY-MM-DD [--dry-run]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { bookCurveSha256 } = require('./lib/dtx-book-proof');

const ROOT = path.resolve(__dirname, '..');
const TOL = 0.05; // percentage point
const TRADING_DAYS_PER_YEAR = 252;

function parseArgs(argv) {
  const out = { portfolio: 'best', dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--portfolio') out.portfolio = argv[++i];
    else if (arg === '--book-file') out.bookFile = argv[++i];
    else if (arg === '--expected-close') out.expectedClose = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--dry-run') out.dryRun = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function readJson(file, label) {
  if (!file) throw new Error(`${label} is required`);
  const absolute = path.resolve(file);
  let raw;
  try { raw = fs.readFileSync(absolute); }
  catch (error) { throw new Error(`${label} unreadable (${file}): ${error.message}`); }
  let value;
  try { value = JSON.parse(raw.toString('utf8')); }
  catch (error) { throw new Error(`${label} invalid JSON (${file}): ${error.message}`); }
  return {
    value,
    absolute,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

function unwrapBook(payload, portfolio) {
  let value = payload;
  if (value && value.result) value = value.result;
  if (value && value.content && Array.isArray(value.content)) {
    const text = value.content.find(part => part && part.type === 'text' && typeof part.text === 'string');
    if (text) {
      try { value = JSON.parse(text.text); }
      catch { throw new Error('DtxBookEquity content is not JSON'); }
    }
  }
  const keyed = !!(value && Object.prototype.hasOwnProperty.call(value, portfolio));
  const directPortfolio = value && (value.portfolio_id || value.portfolio);
  const book = keyed ? value[portfolio] : value;
  const meta = (value && value._meta) || (payload && payload._meta) || null;
  return { book, meta, portfolioBound: keyed || directPortfolio === portfolio, directPortfolio };
}

function maxDrawdownPct(values) {
  let peak = -Infinity;
  let worst = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    if (peak > 0) worst = Math.max(worst, (peak - value) / peak * 100);
  }
  return worst;
}

function cagrPct(values, committed) {
  const years = values.length / TRADING_DAYS_PER_YEAR;
  if (!(years > 0) || !(committed > 0)) return null;
  return (Math.pow(values[values.length - 1] / committed, 1 / years) - 1) * 100;
}

function validateAndNormalizeBook(payload, portfolio, expectedClose) {
  const { book, meta, portfolioBound, directPortfolio } = unwrapBook(payload, portfolio);
  const errors = [];
  if (!book || typeof book !== 'object') return { errors: ['book payload missing'] };
  if (!portfolioBound) errors.push(`book payload is not bound to portfolio ${portfolio}`);
  if (directPortfolio && directPortfolio !== portfolio) errors.push(`book portfolio ${directPortfolio} != ${portfolio}`);

  const dates = Array.isArray(book.equity_dates) ? book.equity_dates.map(String) : [];
  const values = Array.isArray(book.equity_values) ? book.equity_values.map(Number) : [];
  if (dates.length < 2 || values.length < 2) errors.push('equity curve must contain at least two points');
  if (dates.length !== values.length) errors.push(`equity date/value length mismatch (${dates.length}/${values.length})`);
  if (values.some(value => !Number.isFinite(value) || value <= 0)) errors.push('equity values must be finite positive numbers');
  for (let i = 0; i < dates.length; i++) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dates[i]) || !Number.isFinite(Date.parse(`${dates[i]}T00:00:00Z`))) {
      errors.push(`invalid equity date at index ${i}`);
      break;
    }
    if (i && dates[i] <= dates[i - 1]) {
      errors.push(`equity dates must be strictly increasing (index ${i})`);
      break;
    }
  }
  if (book.resolution !== 'daily') errors.push(`resolution must be daily (got ${book.resolution || 'missing'})`);
  if (book.source && book.source !== 'book_served') errors.push(`source must be book_served (got ${book.source})`);

  const committed = Number(book.committed_capital);
  const initial = Number(book.initial_capital);
  const cagrServed = Number(book.cagr_pct);
  const ddServed = Number(book.max_dd_pct);
  if (!(committed > 0)) errors.push('committed_capital must be positive');
  if (!(initial > 0)) errors.push('initial_capital must be positive');
  if (!Number.isFinite(cagrServed)) errors.push('cagr_pct missing');
  if (!Number.isFinite(ddServed) || ddServed < 0) errors.push('max_dd_pct missing or negative');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(book.measured_at || ''))) errors.push('measured_at must be YYYY-MM-DD');
  const curveThrough = dates[dates.length - 1] || null;
  if (curveThrough && book.measured_at < curveThrough) errors.push('measured_at predates the curve');
  if (expectedClose) {
    if (curveThrough !== expectedClose) errors.push(`curve through ${curveThrough || 'missing'} != expected close ${expectedClose}`);
    if (book.measured_at !== expectedClose) errors.push(`measured_at ${book.measured_at || 'missing'} != expected close ${expectedClose}`);
  }
  if (values.length && committed > 0 && Math.abs(values[0] - committed) > 0.01) {
    errors.push(`first equity value ${values[0]} does not equal committed capital ${committed}`);
  }

  const ddCalculated = values.length ? maxDrawdownPct(values) : null;
  const cagrCalculated = values.length && committed > 0 ? cagrPct(values, committed) : null;
  if (Number.isFinite(ddCalculated) && Number.isFinite(ddServed) && Math.abs(ddCalculated - ddServed) > TOL) {
    errors.push(`curve MaxDD ${ddCalculated.toFixed(4)} does not reproduce served ${ddServed} within ${TOL}pp`);
  }
  if (Number.isFinite(cagrCalculated) && Number.isFinite(cagrServed) && Math.abs(cagrCalculated - cagrServed) > TOL) {
    errors.push(`curve CAGR ${cagrCalculated.toFixed(4)} does not reproduce served ${cagrServed} within ${TOL}pp`);
  }

  return {
    errors,
    book,
    meta,
    dates,
    values,
    committed,
    initial,
    cagrServed,
    ddServed,
    cagrCalculated,
    ddCalculated,
    portfolio,
    expectedClose: expectedClose || curveThrough,
  };
}

function buildBookSnapshot(staging, normalized, evidence) {
  const {
    book, meta, dates, values, committed, initial, cagrServed, ddServed,
    cagrCalculated, ddCalculated,
  } = normalized;
  const returnPct = (values[values.length - 1] / committed - 1) * 100;
  const metrics = {
    allocation: book.allocation || evidence.portfolio,
    cagr_pct: cagrServed,
    max_dd_pct: ddServed,
    sharpe: Number.isFinite(Number(book.sharpe)) ? Number(book.sharpe) : null,
    avg_exposure_pct: Number.isFinite(Number(book.avg_exposure_pct)) ? Number(book.avg_exposure_pct) : null,
    return_pct: +returnPct.toFixed(4),
    from: dates[0],
    to: dates[dates.length - 1],
    initial_capital: initial,
    committed_capital: committed,
    trading_days_per_year: TRADING_DAYS_PER_YEAR,
    measured_at: book.measured_at,
    engine_version: (meta && meta.engine) || null,
    basis: book.basis || null,
    source: 'DtxBookEquity same-vintage served book curve and metrics',
    note: `Verified from equity_values: CAGR ${cagrCalculated.toFixed(4)}%, MaxDD ${ddCalculated.toFixed(4)}%; tolerance ${TOL}pp. No DtxStats fields were merged.`,
  };

  return {
    ...staging,
    metrics,
    metricsSource: 'book_served_stats',
    equity: { dates, values },
    equityResolution: 'daily',
    equitySource: 'DtxBookEquity (same-vintage book curve, verified at ingestion)',
    equityVerifiedAt: evidence.verifiedAt,
    bookSnapshot: {
      portfolio: evidence.portfolio,
      expectedClose: normalized.expectedClose,
      measuredAt: book.measured_at,
      curveThrough: dates[dates.length - 1],
      points: dates.length,
      sourcePath: evidence.path,
      sourceSha256: evidence.sha256,
      curveSha256: bookCurveSha256(dates, values, metrics),
      sameVintage: true,
      scope: 'performance_only',
      decisionIndependent: true,
    },
    rejectedServedSnapshot: undefined,
  };
}

function main(argv = process.argv) {
  const opts = parseArgs(argv);
  if (!opts.bookFile) throw new Error('--book-file is required; network fetching is deliberately unsupported');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(opts.expectedClose || ''))) throw new Error('--expected-close YYYY-MM-DD is required');
  const source = readJson(opts.bookFile, '--book-file');
  const normalized = validateAndNormalizeBook(source.value, opts.portfolio, opts.expectedClose);
  if (normalized.errors.length) throw new Error(`DtxBookEquity rejected: ${normalized.errors.join('; ')}`);

  const outPath = path.resolve(opts.out || path.join(ROOT, 'data', 'dtx', `${opts.portfolio}.json`));
  const stagingSource = readJson(outPath, 'staging');
  const previousProof = stagingSource.value.bookSnapshot;
  const verifiedAt = previousProof && previousProof.sourceSha256 === source.sha256 && stagingSource.value.equityVerifiedAt
    ? stagingSource.value.equityVerifiedAt
    : new Date().toISOString();
  const next = buildBookSnapshot(stagingSource.value, normalized, {
    portfolio: opts.portfolio,
    path: path.relative(ROOT, source.absolute),
    sha256: source.sha256,
    verifiedAt,
  });
  const serialized = JSON.stringify(next, (key, value) => value === undefined ? undefined : value, 2) + '\n';

  console.log(`[dtx-book] ${opts.portfolio}: ${normalized.values.length} points ${normalized.dates[0]}..${normalized.dates.at(-1)}`);
  console.log(`[dtx-book] CAGR ${normalized.cagrServed}% / MaxDD ${normalized.ddServed}% reproduced within ${TOL}pp`);
  if (opts.dryRun) return next;
  fs.writeFileSync(outPath, serialized, 'utf8');
  console.log(`[dtx-book] wrote ${path.relative(ROOT, outPath)} from SHA-256 ${source.sha256}`);
  return next;
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`[dtx-book] ${error.message}`); process.exit(1); }
}

module.exports = {
  TOL,
  TRADING_DAYS_PER_YEAR,
  maxDrawdownPct,
  cagrPct,
  unwrapBook,
  validateAndNormalizeBook,
  buildBookSnapshot,
  main,
};
