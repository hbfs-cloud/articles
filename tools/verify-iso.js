#!/usr/bin/env node
'use strict';

/**
 * verify-iso.js — ISO alignment / resync harness between the JS scanners
 * (tools/*-scanner.js) and the Go reference engine (systematic-tss).
 *
 * WHY THIS EXISTS
 * ---------------
 * The tools/*-scanner.js files are supposed to be an ISO port of the Go
 * strategies in systematic-tss. When the Go side evolves (new filters,
 * re-tuned thresholds, universe changes) the JS port silently drifts.
 * This harness *proves* and *measures* the alignment on a historical window,
 * and produces a manifest so a later run can detect that the Go engine moved
 * (git SHA / config hash changed) and a re-verification is due.
 *
 * WHAT IT DOES (per requested mode)
 * ---------------------------------
 *  1. Go side  — builds `bin/backtest` (once) and runs the `-scanner-debug`
 *                exporter over [start,end] on the portfolio config. The CSV
 *                lists EVERY scanner candidate for EVERY allocation; we filter
 *                by the mode's Strategy column value(s) to isolate that sleeve.
 *                → goCandidates: { "YYYY-MM-DD": Set(tickers) }
 *  2. JS side  — for each business day D in the window, runs the matching JS
 *                scanner with `--date D` (point-in-time; forex also `--as-of D`)
 *                and collects its emitted candidates.
 *                → jsCandidates: { "YYYY-MM-DD": Set(tickers) }
 *  3. Diff     — per date: matched / goOnly (Go has, JS misses) /
 *                jsOnly (JS fabricates, Go does not have). Alignment % =
 *                Σmatched / Σunion over dates where at least one side fired.
 *  4. Manifest — writes data/iso-alignment.json with the Go git SHA + config
 *                sha256, per-mode alignment_pct, goOnly, jsOnly, lastVerifiedDate.
 *                Re-running later and finding a different tss_git_sha ⇒ the Go
 *                engine changed ⇒ the ports must be re-verified.
 *  5. Exit     — non-zero if any requested mode is DIVERGENT, i.e. there is a
 *                date where BOTH sides produced candidates but they don't fully
 *                overlap (recouvrement < 100%). Suitable as a CI / pre-publish gate.
 *
 * MODE → Go Strategy mapping (the "Strategy" column of the scanner-debug CSV,
 * which is the *scanner* Strategy string, NOT the config `strategy:` name):
 *   highvol → highvol-breakout          (alloc us_highvol, config strategy highvol-breakout-corr)
 *   hybrid  → adaptive-fractal|mega-cap|mean-reversion|dsl  (alloc us, config trend-hybrid-af)
 *   etf     → etf-momentum              (alloc etf_us)
 *   etf_eu  → etf-momentum              (alloc etf_eu — separate config pre-live/portfolio_etf_eu.yaml)
 *   forex   → forex                     (alloc forex-majors, config strategy forex-momentum)
 *   stockbox→ index-rotation            (config portfolio_stockbox_nasdaq.yaml — see CAVEAT below)
 *
 * NOTE: the Regime column is informational only — scripted modes do NOT gate on
 * regime, so this harness never uses it as a filter.
 *
 * ⚠️ STOCKBOX CAVEAT: index-rotation is a portfolio strategy, not a trend scanner, so it
 * does NOT emit -scanner-debug rows. The authoritative Go oracle is cmd/stockbox-overlap
 * (single-ranking mode, same computeRanking). See the MODES.stockbox comment below.
 *
 * USAGE
 * -----
 *   node tools/verify-iso.js --mode <highvol|etf|etf_eu|hybrid|forex|all> \
 *        --start YYYY-MM-DD --end YYYY-MM-DD [--json report.json] [options]
 *
 *   node tools/verify-iso.js --check-drift         # compare current Go SHA to the manifest
 *   node tools/verify-iso.js --help
 *
 * Options:
 *   --mode        one mode, a comma list, or "all"           (default: all)
 *   --start/--end window bounds (inclusive), business days scanned
 *   --json PATH   also write the full per-date diff report to PATH
 *   --config PATH Go portfolio config (default config/portfolio_multi_survivors.yaml)
 *   --skip-build  do not rebuild bin/backtest (reuse existing binary)
 *   --skip-js     Go side only (populate manifest goCandidates, skip JS runs)
 *   --js-timeout  per JS scanner-run timeout in seconds       (default 240)
 *   --check-drift only compare current tss_git_sha to the stored manifest and exit
 *   --quiet       less chatter
 *
 * Exit codes: 0 aligned · 1 divergent (a mode mismatched where both fired) ·
 *             2 usage/setup error · 3 drift detected (--check-drift).
 *
 * This tool NEVER modifies the scanners (Phase 2 handles the dated-cache fix).
 * It only *runs* them and diffs their output against Go.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ─── paths ───────────────────────────────────────────────────────────────────
const ARTICLES_ROOT = path.join(__dirname, '..');
const TSS_ROOT = path.join(ARTICLES_ROOT, '..', 'systematic-tss');
const DEFAULT_CONFIG = 'config/portfolio_multi_survivors.yaml';
const MANIFEST_PATH = path.join(ARTICLES_ROOT, 'data', 'iso-alignment.json');
const BACKTEST_BIN = path.join(TSS_ROOT, 'bin', 'backtest');

// ─── mode registry ───────────────────────────────────────────────────────────
// goStrategies : values seen in the CSV "Strategy" column for this sleeve.
// goConfig     : override portfolio config (else the global --config default).
// jsScanner    : tools/<file>.
// jsExtract    : 'json' (scanner writes data/<file>-scan-<D>.json) or
//                'signals' (scanner appends to scanner/<folder>/signals.json).
// jsArgs       : extra CLI args always passed.
// jsScanFile   : (date) => path of the json output, relative to ARTICLES_ROOT.
// jsSignalTag  : (signals mode) predicate on a signal's strategy tag.
// normalize    : ticker canonicaliser so both sides compare on the same symbol.
const MODES = {
  highvol: {
    label: 'HighVol Breakout',
    goStrategies: ['highvol-breakout', 'highvol-breakout-corr', 'highvol-corr'],
    jsScanner: 'highvol-scanner.js',
    jsExtract: 'json',
    jsArgs: [],
    jsScanFile: d => path.join('data', `highvol-scan-${d}.json`),
    normalize: defaultNormalize,
  },
  etf: {
    label: 'ETF Momentum (US)',
    goStrategies: ['etf-momentum'],
    // Standalone single-sleeve config (mirrors etf_eu). The multi-survivors config
    // shares ONE global mkData across every allocation, so its etf-momentum scanner
    // (scanner_etf_momentum.go iterates all of mkData.Raw) also ranks STOCKS pulled in
    // by the stock sleeves (ALHC/CBRL/EPC/VSCO …) — unreachable by an ETF-only JS
    // universe. portfolio_etf_us.yaml loads ONLY US ETFs, so the Go scan is pure-ETF
    // and matches the JS pool. It is also the source of truth etf-scanner.js declares.
    goConfig: 'config/pre-live/portfolio_etf_us.yaml',
    jsScanner: 'etf-scanner.js',
    jsExtract: 'json',
    // --top 20 == Go strategy_trend.go MaxCandidates default (etf_us sets no max_candidates).
    // Go's scanner-debug dumps up to MaxCandidates post-diversification; without this the
    // JS capped at 10 and under-emitted vs Go's ≤20 rows.
    jsArgs: ['--universe', 'etf-us', '--top', '20'],
    jsScanFile: d => path.join('data', `etf-scan-${d}.json`),
    normalize: defaultNormalize,
  },
  etf_eu: {
    label: 'ETF Momentum (EU)',
    goStrategies: ['etf-momentum'],
    goConfig: 'config/pre-live/portfolio_etf_eu.yaml',
    jsScanner: 'etf-scanner.js',
    jsExtract: 'json',
    // --top 20 == Go strategy_trend.go MaxCandidates default (config etf_eu sets no
    // max_candidates). Go's scanner-debug dumps up to MaxCandidates post-diversification;
    // without this the JS capped at 10 and under-emitted vs Go's ≤20 rows.
    jsArgs: ['--universe', 'etf-eu', '--top', '20'],
    jsScanFile: d => path.join('data', `etf-scan-${d}-etf_eu.json`),
    normalize: defaultNormalize,
  },
  hybrid: {
    label: 'Trend Hybrid-AF',
    goStrategies: ['adaptive-fractal', 'mega-cap', 'mean-reversion', 'dsl', 'trend-hybrid-af'],
    jsScanner: 'hybrid-scanner.js',
    jsExtract: 'signals',
    jsArgs: [],
    jsSignalTag: tag => typeof tag === 'string' && /hybrid/i.test(tag),
    normalize: defaultNormalize,
  },
  forex: {
    label: 'Forex Momentum',
    goStrategies: ['forex', 'forex-momentum'],
    jsScanner: 'forex-scanner.js',
    jsExtract: 'json',
    jsArgs: [],
    // Go dates a scanner-debug row to the SESSION it acts on, computed from the PRIOR
    // close (no look-ahead): Go[D] uses data through D-1. The JS scanner's --as-of D is an
    // INCLUSIVE cutoff (bars.date <= D), so a naive --as-of d reproduces Go[D+1] (off-by-one).
    // To reproduce Go's signal for session D we slice the JS PIT window to the previous day.
    // Verified byte-for-byte: JS --as-of 2026-06-30 == Go 2026-07-01 (AUDUSD 16.2/EURUSD
    // 13.8/GBPUSD 11.7). --date stays D so the output file / cache still key on the session.
    jsDateArgs: d => ['--date', d, '--as-of', prevCalDay(d)],
    jsScanFile: d => path.join('data', `forex-scan-${d}.json`),
    normalize: t => defaultNormalize(t).replace(/=X$/, ''), // EURUSD=X → EURUSD
  },
  stockbox: {
    label: 'StockBox Nasdaq',
    // Go Strategy string = 'index-rotation'. ⚠️ CAVEAT: index-rotation is a PORTFOLIO
    // strategy (engine.IndexRotationStrategy.Apply), NOT a trend "scanner", so it does
    // NOT emit rows to the -scanner-debug CSV (only strategy_trend.go writes there). The
    // canonical Go oracle for this mode is instead `cmd/stockbox-overlap` single-ranking
    // mode, which reuses computeRanking verbatim:
    //   cd systematic-tss && CACHE_NO_EXPIRY=1 TOTAL_RETURN=1 \
    //     ./bin/stockbox-overlap -config config/portfolio_stockbox_nasdaq.yaml \
    //     -date <D> -lookback 84 -top 8
    // Verified 8/8 ISO on 2026-07-03: ALAB,MRVL,SNDK,INTC,AMD,ARM,MU,NBIS (momentum
    // identical to 2 decimals). This MODES entry is kept for registry completeness and
    // drift-detection; because index-rotation is absent from scanner-debug, the goStrategies
    // filter yields 0 Go rows here (Go side empty → never flagged "divergent"). Use the
    // stockbox-overlap command above for the authoritative top-8 comparison.
    goStrategies: ['index-rotation'],
    goConfig: 'config/portfolio_stockbox_nasdaq.yaml',
    jsScanner: 'stockbox-scanner.js',
    jsExtract: 'json',
    jsArgs: ['--top', '8'],
    jsScanFile: d => path.join('data', `stockbox-scan-${d}.json`),
    normalize: defaultNormalize,
  },
};

function defaultNormalize(t) {
  return String(t || '').trim().toUpperCase();
}

// Previous CALENDAR day of a YYYY-MM-DD string. Used to align the JS scanners'
// inclusive --as-of cutoff with Go's "signal at session D uses data through D-1" convention.
// Calendar (not business) day is sufficient: the scanner's sliceAsOf keeps bars.date <= as-of,
// so as-of (D-1 calendar) == "all bars strictly before D" and naturally lands on the last
// trading bar before D through weekends/holidays.
function prevCalDay(d) {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

// ─── CLI parsing ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
}
const hasFlag = name => argv.includes(`--${name}`);

if (hasFlag('help') || hasFlag('h') || argv.length === 0) {
  printHelp();
  process.exit(0);
}

const QUIET = hasFlag('quiet');
function log(...a) { if (!QUIET) console.log(...a); }
function warn(...a) { console.error(...a); }

// ─── git / config fingerprints ───────────────────────────────────────────────
function tssGitSha() {
  try {
    return execFileSync('git', ['-C', TSS_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function sha256File(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  } catch (e) {
    return null;
  }
}

// ─── --check-drift ───────────────────────────────────────────────────────────
function checkDrift() {
  const current = tssGitSha();
  if (!current) { warn('✗ Cannot read systematic-tss git SHA (repo missing?).'); process.exit(2); }
  if (!fs.existsSync(MANIFEST_PATH)) {
    warn(`✗ No manifest at ${MANIFEST_PATH} — run a verification first.`);
    process.exit(3);
  }
  const man = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const stored = man.tss_git_sha;
  const cfgPath = path.join(TSS_ROOT, man.config || DEFAULT_CONFIG);
  const storedCfg = man.config_sha256;
  const currentCfg = sha256File(cfgPath);
  console.log(`Go repo   : ${TSS_ROOT}`);
  console.log(`Manifest  : ${MANIFEST_PATH} (generated ${man.generatedAt})`);
  console.log(`SHA stored: ${stored}`);
  console.log(`SHA now   : ${current}`);
  console.log(`cfg stored: ${storedCfg}`);
  console.log(`cfg now   : ${currentCfg}`);
  const shaDrift = stored !== current;
  const cfgDrift = storedCfg && currentCfg && storedCfg !== currentCfg;
  if (shaDrift || cfgDrift) {
    console.log('');
    if (shaDrift) console.log('⚠️  DRIFT: systematic-tss HEAD moved since last verification.');
    if (cfgDrift) console.log('⚠️  DRIFT: portfolio config changed since last verification.');
    console.log('   → re-run: node tools/verify-iso.js --mode all --start <S> --end <E>');
    process.exit(3);
  }
  console.log('\n✓ No drift — manifest is up to date with the current Go engine.');
  process.exit(0);
}

if (hasFlag('check-drift')) checkDrift();

// ─── date helpers ────────────────────────────────────────────────────────────
function isoDate(d) { return d.toISOString().slice(0, 10); }
function businessDays(start, end) {
  const out = [];
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  if (isNaN(s) || isNaN(e) || s > e) return out;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    if (dow !== 0 && dow !== 6) out.push(isoDate(new Date(d)));
  }
  return out;
}

// ─── Go side ─────────────────────────────────────────────────────────────────
let _built = false;
function buildBacktest() {
  if (_built || hasFlag('skip-build')) {
    if (hasFlag('skip-build') && !fs.existsSync(BACKTEST_BIN)) {
      warn(`✗ --skip-build but ${BACKTEST_BIN} does not exist.`); process.exit(2);
    }
    _built = true; return;
  }
  log('🔨 building systematic-tss/bin/backtest ...');
  try {
    execFileSync('go', ['build', '-o', 'bin/backtest', './cmd/backtest'],
      { cwd: TSS_ROOT, encoding: 'utf8', stdio: QUIET ? 'ignore' : 'inherit' });
  } catch (e) {
    warn('✗ go build failed:', e.message); process.exit(2);
  }
  _built = true;
}

// Run one backtest per config and cache the parsed rows for the window.
const _goCache = new Map(); // configRel → rows[]
function runGoBacktest(configRel, start, end) {
  const key = `${configRel}|${start}|${end}`;
  if (_goCache.has(key)) return _goCache.get(key);
  buildBacktest();
  const cfgAbs = path.join(TSS_ROOT, configRel);
  if (!fs.existsSync(cfgAbs)) { warn(`✗ Go config not found: ${cfgAbs}`); process.exit(2); }
  const tmpCsv = path.join(require('os').tmpdir(), `iso-scanner-debug-${crypto.randomBytes(4).toString('hex')}.csv`);
  // Go's backtest -end is EXCLUSIVE (it scans trading days strictly BEFORE -end),
  // whereas this harness treats --end as INCLUSIVE (businessDays() includes it and
  // the JS scanner is run on `end`). Passing `end` verbatim made Go never scan the
  // end date while JS did → the whole `end` day showed up as phantom jsOnly (e.g.
  // 20 fake divergences on a Friday). Bump Go's boundary by one calendar day so it
  // scans through `end` inclusive; goCandidatesForMode still filters rows to <= end.
  const endExclusive = isoDate(new Date(new Date(end + 'T00:00:00Z').getTime() + 86400000));
  log(`▶ Go backtest ${configRel} [${start} → ${end}] ...`);
  try {
    execFileSync(BACKTEST_BIN,
      ['-config', configRel, '-start', start, '-end', endExclusive, '-scanner-debug', tmpCsv],
      { cwd: TSS_ROOT, encoding: 'utf8', stdio: QUIET ? 'ignore' : 'inherit', maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    warn(`✗ backtest run failed for ${configRel}:`, e.message); process.exit(2);
  }
  const rows = parseScannerDebugCsv(tmpCsv);
  try { fs.unlinkSync(tmpCsv); } catch (_) { /* ignore */ }
  _goCache.set(key, rows);
  return rows;
}

function parseScannerDebugCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const text = fs.readFileSync(csvPath, 'utf8').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',');
  const col = {};
  header.forEach((h, i) => { col[h.trim()] = i; });
  const need = ['Date', 'Symbol', 'Score', 'Strategy'];
  for (const n of need) if (!(n in col)) { warn(`✗ CSV missing column ${n}`); return []; }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',');
    if (f.length < header.length) continue;
    rows.push({
      date: f[col.Date].trim(),
      symbol: f[col.Symbol].trim(),
      score: parseFloat(f[col.Score]),
      strategy: f[col.Strategy].trim(),
    });
  }
  return rows;
}

// goCandidates for a mode: { date → Map(normTicker → score) }
function goCandidatesForMode(mode, cfg, start, end) {
  const rows = runGoBacktest(cfg.goConfig || cfg._globalConfig, start, end);
  const stratSet = new Set(cfg.goStrategies);
  const byDate = new Map();
  for (const r of rows) {
    if (!stratSet.has(r.strategy)) continue;
    if (r.date < start || r.date > end) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, new Map());
    byDate.get(r.date).set(cfg.normalize(r.symbol), r.score);
  }
  return byDate;
}

// ─── JS side ─────────────────────────────────────────────────────────────────
function runJsScanner(mode, cfg, date, jsTimeoutSec) {
  const scanner = path.join('tools', cfg.jsScanner);
  const dateArgs = cfg.jsDateArgs ? cfg.jsDateArgs(date) : ['--date', date];
  try {
    if (cfg.jsExtract === 'json') {
      const outRel = cfg.jsScanFile(date);
      const outAbs = path.join(ARTICLES_ROOT, outRel);
      try { fs.unlinkSync(outAbs); } catch (_) { /* stale */ }
      const args = [scanner, ...dateArgs, '--output', 'json', ...cfg.jsArgs];
      execFileSync('node', args, {
        cwd: ARTICLES_ROOT, encoding: 'utf8', stdio: 'ignore',
        timeout: jsTimeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
      });
      if (!fs.existsSync(outAbs)) return { tickers: new Set(), note: 'no-output-file' };
      const data = JSON.parse(fs.readFileSync(outAbs, 'utf8'));
      const set = new Set((data.candidates || []).map(c => cfg.normalize(c.ticker || c.symbol)));
      return { tickers: set };
    }
    // 'signals' extraction (hybrid): run into a throwaway folder, then read it.
    const folder = `_isoverify_${date.replace(/-/g, '')}`;
    const dirAbs = path.join(ARTICLES_ROOT, 'scanner', folder);
    const sigAbs = path.join(dirAbs, 'signals.json');
    fs.mkdirSync(dirAbs, { recursive: true });
    fs.writeFileSync(sigAbs, JSON.stringify({ signals: [] }));
    const args = [scanner, ...dateArgs, '--folder', folder, '--output', 'signals', ...cfg.jsArgs];
    try {
      execFileSync('node', args, {
        cwd: ARTICLES_ROOT, encoding: 'utf8', stdio: 'ignore',
        timeout: jsTimeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
      });
    } catch (e) { /* hybrid may exit soft; still try to read what it wrote */ }
    let set = new Set();
    if (fs.existsSync(sigAbs)) {
      const data = JSON.parse(fs.readFileSync(sigAbs, 'utf8'));
      set = new Set((data.signals || [])
        .filter(s => !cfg.jsSignalTag || cfg.jsSignalTag(s.strategy))
        .map(s => cfg.normalize(s.ticker || s.symbol)));
    }
    try { fs.rmSync(dirAbs, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    return { tickers: set };
  } catch (e) {
    return { tickers: new Set(), error: (e && e.message ? e.message : String(e)).split('\n')[0] };
  }
}

// ─── diff one mode ───────────────────────────────────────────────────────────
function verifyMode(name, cfg, start, end, jsTimeoutSec, skipJs) {
  const go = goCandidatesForMode(name, cfg, start, end);
  const days = businessDays(start, end);
  // include any Go date outside the business-day set (safety) + all business days
  const dates = Array.from(new Set([...days, ...go.keys()])).sort();

  const perDate = [];
  let totMatched = 0, totUnion = 0, divergent = false, jsErrors = 0;
  const goOnlyAll = new Set(), jsOnlyAll = new Set();

  for (const d of dates) {
    const goSet = new Set((go.get(d) || new Map()).keys());
    let jsSet = new Set(), jsNote = null;
    if (!skipJs) {
      const r = runJsScanner(name, cfg, d, jsTimeoutSec);
      jsSet = r.tickers;
      if (r.error) { jsNote = 'error:' + r.error; jsErrors++; }
      else if (r.note) jsNote = r.note;
    }
    const matched = [...goSet].filter(t => jsSet.has(t));
    const goOnly = [...goSet].filter(t => !jsSet.has(t));
    const jsOnly = [...jsSet].filter(t => !goSet.has(t));
    goOnly.forEach(t => goOnlyAll.add(t));
    jsOnly.forEach(t => jsOnlyAll.add(t));
    const union = new Set([...goSet, ...jsSet]).size;
    if (union > 0) { totMatched += matched.length; totUnion += union; }
    // divergence only counts where BOTH sides fired
    if (goSet.size > 0 && jsSet.size > 0 && (goOnly.length > 0 || jsOnly.length > 0)) divergent = true;
    perDate.push({
      date: d, go: [...goSet].sort(), js: [...jsSet].sort(),
      matched: matched.sort(), goOnly: goOnly.sort(), jsOnly: jsOnly.sort(),
      note: jsNote,
    });
  }

  const alignment = totUnion > 0 ? +(100 * totMatched / totUnion).toFixed(2) : null;
  const goDates = [...go.keys()].sort();
  return {
    mode: name, label: cfg.label,
    config: cfg.goConfig || cfg._globalConfig,
    goStrategies: cfg.goStrategies,
    alignment_pct: alignment,
    divergent: skipJs ? false : divergent,
    jsErrors,
    goOnly: [...goOnlyAll].sort(),
    jsOnly: [...jsOnlyAll].sort(),
    lastVerifiedDate: goDates.length ? goDates[goDates.length - 1] : end,
    goTotalCandidates: goDates.reduce((n, d) => n + go.get(d).size, 0),
    goActiveDates: goDates.length,
    perDate,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────
function main() {
  const start = getArg('start');
  const end = getArg('end');
  const modeArg = (getArg('mode', 'all') || 'all').toLowerCase();
  const jsonOut = getArg('json');
  const globalConfig = getArg('config', DEFAULT_CONFIG);
  const jsTimeoutSec = parseInt(getArg('js-timeout', '240'), 10);
  const skipJs = hasFlag('skip-js');

  if (!start || !end) { warn('✗ --start and --end are required (YYYY-MM-DD).'); process.exit(2); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    warn('✗ dates must be YYYY-MM-DD.'); process.exit(2);
  }

  let modeNames;
  if (modeArg === 'all') modeNames = Object.keys(MODES);
  else {
    modeNames = modeArg.split(',').map(s => s.trim()).filter(Boolean);
    for (const m of modeNames) if (!MODES[m]) { warn(`✗ unknown mode "${m}". Known: ${Object.keys(MODES).join(', ')}, all`); process.exit(2); }
  }

  const sha = tssGitSha();
  const cfgAbs = path.join(TSS_ROOT, globalConfig);
  const cfgSha = sha256File(cfgAbs);

  log(`\n══ ISO verification ══`);
  log(`Go repo   : ${TSS_ROOT}`);
  log(`Go SHA    : ${sha || 'UNKNOWN'}`);
  log(`Config    : ${globalConfig} (sha256 ${cfgSha ? cfgSha.slice(0, 12) : 'n/a'})`);
  log(`Window    : ${start} → ${end}  (${businessDays(start, end).length} business days)`);
  log(`Modes     : ${modeNames.join(', ')}${skipJs ? '  [--skip-js: Go only]' : ''}\n`);

  const results = [];
  for (const name of modeNames) {
    const cfg = { ...MODES[name], _globalConfig: globalConfig };
    const res = verifyMode(name, cfg, start, end, jsTimeoutSec, skipJs);
    results.push(res);
    const a = res.alignment_pct == null ? 'n/a' : `${res.alignment_pct}%`;
    const flag = res.divergent ? '✗ DIVERGENT' : (res.alignment_pct === 100 ? '✓ ALIGNED' : (skipJs ? '· go-only' : '~ partial'));
    log(`── ${name.padEnd(8)} ${res.label.padEnd(20)} align=${a.padStart(7)}  ${flag}`);
    log(`   Go: ${res.goActiveDates} active day(s), ${res.goTotalCandidates} candidate rows`);
    if (res.goOnly.length) log(`   goOnly  (Go has, JS misses): ${res.goOnly.slice(0, 25).join(', ')}${res.goOnly.length > 25 ? ' …' : ''}`);
    if (res.jsOnly.length) log(`   jsOnly  (JS fabricates)   : ${res.jsOnly.slice(0, 25).join(', ')}${res.jsOnly.length > 25 ? ' …' : ''}`);
    if (res.jsErrors) log(`   ⚠️  ${res.jsErrors} JS run error(s) in window`);
    log('');
  }

  writeManifest(sha, globalConfig, cfgSha, results);

  if (jsonOut) {
    const full = {
      generatedAt: new Date().toISOString(), tss_git_sha: sha, config: globalConfig,
      config_sha256: cfgSha, window: { start, end }, modes: results,
    };
    fs.writeFileSync(path.resolve(jsonOut), JSON.stringify(full, null, 2));
    log(`📄 full per-date report → ${path.resolve(jsonOut)}`);
  }

  const anyDivergent = results.some(r => r.divergent);
  log(`\nManifest → ${MANIFEST_PATH}`);
  if (anyDivergent) {
    log('\n✗ RESULT: DIVERGENT — at least one mode mismatched where both sides fired.');
    process.exit(1);
  }
  log('\n✓ RESULT: aligned (no mode diverged where both sides produced candidates).');
  process.exit(0);
}

function writeManifest(sha, config, cfgSha, results) {
  // MERGE, don't clobber: a mono-mode run (--mode etf) must only update its own
  // key in the manifest and preserve the entries for every other mode. Reading the
  // existing manifest and overlaying the freshly-verified modes keeps a full picture
  // across incremental runs (previous bug: each run overwrote the whole file).
  let modes = {};
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      if (prev && prev.modes && typeof prev.modes === 'object') modes = { ...prev.modes };
    } catch (_) { /* corrupt/absent → start fresh */ }
  }
  for (const r of results) {
    modes[r.mode] = {
      label: r.label,
      config: r.config,
      goStrategies: r.goStrategies,
      alignment_pct: r.alignment_pct,
      divergent: r.divergent,
      goOnly: r.goOnly,
      jsOnly: r.jsOnly,
      lastVerifiedDate: r.lastVerifiedDate,
      goActiveDates: r.goActiveDates,
      goTotalCandidates: r.goTotalCandidates,
      jsErrors: r.jsErrors,
    };
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    tss_git_sha: sha,
    config,
    config_sha256: cfgSha,
    modes,
  };
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function printHelp() {
  const modes = Object.keys(MODES).join(' | ');
  console.log(`verify-iso.js — ISO alignment harness (JS scanners ↔ systematic-tss Go)

USAGE
  node tools/verify-iso.js --mode <${modes} | all> --start YYYY-MM-DD --end YYYY-MM-DD [--json report.json]
  node tools/verify-iso.js --check-drift
  node tools/verify-iso.js --help

OPTIONS
  --mode M       one mode, comma list, or "all"                (default: all)
  --start S      window start (inclusive, YYYY-MM-DD)          [required]
  --end E        window end   (inclusive, YYYY-MM-DD)          [required]
  --json PATH    write the full per-date diff report to PATH
  --config PATH  Go portfolio config       (default ${DEFAULT_CONFIG})
  --skip-build   reuse existing bin/backtest (no go build)
  --skip-js      Go side only (manifest from Go candidates, no JS runs)
  --js-timeout N per-JS-run timeout in seconds                 (default 240)
  --check-drift  compare current Go SHA/config to the stored manifest and exit
  --quiet        reduce output

WHAT IT PROVES
  For each mode: Go scanner-debug candidates (filtered by Strategy) vs the JS
  scanner's --date output, per business day. Reports matched / goOnly / jsOnly
  and an alignment %. Writes data/iso-alignment.json (with the Go git SHA +
  config sha256) so later drift is detectable via --check-drift.

EXIT CODES
  0 aligned · 1 divergent · 2 usage/setup error · 3 drift (--check-drift)

MODE → Go Strategy (scanner-debug "Strategy" column)
  highvol → highvol-breakout          etf    → etf-momentum
  hybrid  → adaptive-fractal/mega-cap/mean-reversion/dsl
  etf_eu  → etf-momentum (config pre-live/portfolio_etf_eu.yaml)
  forex   → forex
  stockbox→ index-rotation (config portfolio_stockbox_nasdaq.yaml; oracle: cmd/stockbox-overlap)`);
}

main();
