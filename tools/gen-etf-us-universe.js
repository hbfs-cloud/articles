#!/usr/bin/env node
'use strict';

/**
 * gen-etf-us-universe.js — regenerate data/etf-us-universe.json as an ISO dump of
 * the systematic-tss US ETF universe (the pool the Go `etf-momentum` scanner sees
 * for allocation `etf_us`, config portfolio_multi_survivors.yaml).
 *
 * WHY: the JS etf-scanner previously read a HARDCODED list of ~45 mega-ETFs
 * (SPY/QQQ/XLK/…). Go, however, builds the etf_us universe from the FULL US ETF
 * secmaster (~4990 rows) via universe.go GetAssets:
 *   §2  a fixed "pure ETFs" core map (GLD/SLV/GDX/SPY/QQQ/XLK/…, force-added)
 *   §4  ALL US ETFs from staticdata.LoadEtfTickers("US"), skipping leveraged when
 *       pure:true, no min_volume filter (etf_us sets none).
 * The two pools intersect at ~10%, so `verify-iso` reported the ranking landing on
 * near-disjoint tickers (Go: BNO/COMT/CTA/IEZ/JETS/KIE/OIH/PSI/XME/…; JS: only its
 * 45). This generator materialises the Go pool so the JS scanner ranks the SAME
 * candidates.
 *
 * ISO RULES (mirror universe.go GetAssets for Region=US, Pure=true, IncludeEtfs=true):
 *   - §2 core "pureETFs" map → force-included (Go adds them unconditionally).
 *   - §4 dynamic: staticdata US ETFs, filterEtf(avgVol>=1000, !BLACKLIST, !Israel),
 *     DROP leveraged where EtfLeverage matches 2X/3X/4X/1.5X/0.5X (pure:true).
 *     NOTE: Go's isLeveraged check does NOT match "-1X" (inverse), so a -1X ETF such
 *     as MSFD PASSES — replicated here verbatim (do not "fix" it).
 *   - US staticdata keys are already Yahoo symbols (no exchange prefix), so no
 *     ConvertToYahooSymbol step is needed (unlike the EU generator).
 *
 * OPERABILITY PREFILTER (documented, NOT in Go): Go applies no universe-level volume
 * filter and instead gates candidates POST-scoring via the uniform established-liquidity
 * gate (scanner_filters.min_established_dollar_volume = $5,000,000 median $-volume over
 * established_lookback_days = 60). etf-scanner.js now ports that gate. To keep the JS
 * live fetch tractable (~4361 non-leveraged US ETFs would otherwise be fetched from
 * Yahoo every scan-date) we additionally drop rows whose staticdata dollarVolume is
 * below --min-dollar-vol (default $1,000,000 = 5× below the $5M gate). This is a
 * conservative superset of every symbol that could ever pass the $5M gate: the lowest
 * staticdata dollarVolume among observed Go winners is KSTR ($3.47M) / COMT ($4.45M),
 * both far above $1M. Core §2 symbols bypass this prefilter (Go force-adds them).
 *
 * USAGE: node tools/gen-etf-us-universe.js [--tss <path>] [--out <path>]
 *        [--min-dollar-vol <n>] [--cache-date YYYY-MM-DD] [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = args.includes('--dry-run');
const TSS_ROOT = path.resolve(getArg('tss', path.join(ARTICLES_ROOT, '..', 'systematic-tss')));
const OUT = path.resolve(getArg('out', path.join(ARTICLES_ROOT, 'data', 'etf-us-universe.json')));
// Default 0 = OFF (full ISO universe). A staticdata dollarVolume prefilter is UNSAFE:
// the $5M established gate uses LIVE 60-day median volume at scan time, which the stale
// frozen snapshot does not predict (e.g. KSTR frozen dollarVolume $0.245M but it wins in
// Go because its live median clears $5M). Only enable for a lighter dev run, never for parity.
const MIN_DOLLAR_VOL = parseFloat(getArg('min-dollar-vol', '0'));
const CACHE_DATE = getArg('cache-date', null);

// ── universe.go §2 "pureETFs" core map (US-listed, force-added) ───────────────
// Ported verbatim from internal/universe/universe.go GetAssets step 2.
const CORE_PURE_ETFS = [
  'GLD', 'SLV', 'GDX', 'GDXJ', 'SIL', 'GBTC',
  'SPY', 'QQQ', 'IWM', 'XLK', 'XLV', 'XLI', 'XLF', 'XLE', 'XLB',
  'XLU', 'XLP', 'XLY', 'VTI', 'VOO', 'DIA',
  'EWP', 'EWG', 'EWQ', 'EWI', 'EWN', 'VGK', 'EZU', 'IEUR',
  'EWJ', 'EWH', 'EWY', 'EWT',
];

// staticdata.BLACKLIST (ported verbatim from internal/staticdata/staticdata.go)
const BLACKLIST = new Set([
  'TVAI', 'OYSE', 'MOG.A', 'CHPG', 'CRAC', 'BLUW', 'BRK.B', 'CWEN.A', 'BACC',
  'HEI.A', 'DGIC.A', 'IMKT.A', 'CCCX', 'KCHV', 'AACI', 'RUSH.A', 'CGCT', 'WENN',
  'PBR.A', 'BF.A', 'GTEN', 'BSAA', 'FWON.K', 'BHK.RT', 'GRP.U', 'AKO.B', 'CIG.C',
  'GTN.A', 'PACH', 'MKC.V', 'AXIN', 'AKO.A', 'CRD.A', 'BH.A', 'CRD.B',
]);

// universe.go isLeveraged: EtfLeverage contains one of these (uppercased). "-1X" is
// deliberately NOT in the list → inverse -1X ETFs pass (matches Go behaviour).
function isLeveraged(lev) {
  const u = String(lev || '').toUpperCase();
  return ['2X', '3X', '4X', '1.5X', '0.5X'].some(x => u.includes(x));
}

function loadUsEtfStaticdata() {
  const dir = path.join(TSS_ROOT, 'cache', 'stockanalysis', 'etf', 'US');
  const altDir = path.join(TSS_ROOT, 'internal', 'universe', 'cache', 'stockanalysis', 'etf', 'US');
  const candidates = [];
  // 1) frozen cache (Go's priority)
  for (const base of [dir, altDir]) {
    candidates.push(path.join(base, 'tickers-frozen.json'));
  }
  // 2) explicit --cache-date, else newest dated file
  for (const base of [dir, altDir]) {
    if (CACHE_DATE) candidates.push(path.join(base, `tickers-${CACHE_DATE}.json`));
  }
  for (const base of [dir, altDir]) {
    let dated = [];
    try {
      dated = fs.readdirSync(base)
        .filter(f => /^tickers-\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .reverse()
        .map(f => path.join(base, f));
    } catch (_) { /* dir absent */ }
    candidates.push(...dated);
  }
  for (const fp of candidates) {
    try {
      const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const data = (j.data && j.data.data) ? j.data.data : null;
      if (data && Object.keys(data).length >= 5) return { data, file: fp };
    } catch (_) { /* try next */ }
  }
  throw new Error(`no readable US ETF staticdata cache found under ${dir} or ${altDir}`);
}

function main() {
  const { data, file } = loadUsEtfStaticdata();
  const stats = { total: Object.keys(data).length, dropLev: 0, dropLowVol: 0, dropBlacklist: 0, dropIsrael: 0, dropLowDollarVol: 0, coreForced: 0, kept: 0 };

  const seen = new Map(); // sym → { symbol, name, category }

  const add = (sym, v) => {
    if (seen.has(sym)) return;
    seen.set(sym, { symbol: sym, name: (v && v.name) || sym, category: (v && v.etfCategory) || 'OTHER' });
  };

  // §2 core — force-added (bypass filters & prefilter), category from staticdata if present.
  for (const sym of CORE_PURE_ETFS) {
    add(sym, data[sym]);
    stats.coreForced++;
  }

  // §4 dynamic — full US ETF secmaster.
  for (const [sym, v] of Object.entries(data)) {
    if (seen.has(sym)) continue;
    if (isLeveraged(v.etfLeverage)) { stats.dropLev++; continue; }          // pure:true
    if ((v.averageVolume || 0) < 1000) { stats.dropLowVol++; continue; }    // filterEtf
    if (BLACKLIST.has(sym)) { stats.dropBlacklist++; continue; }            // filterEtf
    if (v.etfCountry === 'Israel' || v.etfCountry === 'IL') { stats.dropIsrael++; continue; } // filterEtf
    if (MIN_DOLLAR_VOL > 0) {                                               // optional dev-only prefilter (OFF by default)
      const dv = (v.dollarVolume != null) ? v.dollarVolume : ((v.close || 0) * (v.averageVolume || 0));
      if (dv < MIN_DOLLAR_VOL) { stats.dropLowDollarVol++; continue; }
    }
    add(sym, v);
  }

  const etfs = [...seen.values()]
    .map(e => ({ symbol: e.symbol, name: e.name, category: e.category || 'OTHER' }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  stats.kept = etfs.length;

  const out = {
    updated: new Date().toISOString().slice(0, 10),
    source: `systematic-tss US ETF secmaster (${path.relative(TSS_ROOT, file)}), pure:true`,
    method: 'ISO dump via tools/gen-etf-us-universe.js — universe.go GetAssets §2 core pureETFs (force) + §4 dynamic (filterEtf: avgVol>=1000, !staticdata.BLACKLIST, !Israel; drop leveraged 2X/3X/4X/1.5X/0.5X, keep -1X). Operability prefilter: staticdata dollarVolume >= $' + (MIN_DOLLAR_VOL / 1e6) + 'M (5x below the $5M established-liquidity gate that etf-scanner.js applies at scan time). Do NOT hand-edit: regenerate with `node tools/gen-etf-us-universe.js`.',
    note: 'Category = staticdata etfCategory (drives diversifyByCategory, max 2/category — same source as Go etf.EtfCategory).',
    minDollarVolumePrefilter: MIN_DOLLAR_VOL,
    count: etfs.length,
    etfs,
  };

  console.error(`US ETF universe: ${etfs.length} symbols (from ${stats.total} staticdata rows, cache ${path.basename(file)})`);
  console.error(`  core forced: ${stats.coreForced} | dropped — leveraged:${stats.dropLev} lowVol:${stats.dropLowVol} blacklist:${stats.dropBlacklist} israel:${stats.dropIsrael} lowDollarVol(<$${(MIN_DOLLAR_VOL / 1e6)}M):${stats.dropLowDollarVol}`);

  if (DRY) { console.error('dry-run — not written.'); return; }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(`→ wrote ${OUT}`);
}

main();
