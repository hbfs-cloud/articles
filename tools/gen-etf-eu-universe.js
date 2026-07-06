#!/usr/bin/env node
'use strict';

/**
 * gen-etf-eu-universe.js — regenerate data/etf-eu-universe.json as an ISO dump of
 * the systematic-tss EU ETF universe (the pool the Go `etf-momentum` scanner sees
 * for allocation `etf_eu`).
 *
 * WHY: the JS etf-scanner previously read a HAND-CURATED list of 21 broad-index
 * UCITS trackers (EUNL.DE, SXR8.DE, VWCE.DE, …). Go, however, loads the FULL
 * secmaster for regions FR,DE,NL,IT,ES (~3100 ETPs incl. thematic + leveraged,
 * `pure:false`). The intersection of the two pools is ~empty, so `verify-iso`
 * reported matched=0 by construction (every Go candidate .MI/.DE/.PA/.AS was
 * absent from the curated list). This makes ISO parity impossible.
 *
 * This generator replicates the Go universe pipeline VERBATIM:
 *   staticdata.LoadEtfTickersMulti([FR,DE,NL,IT,ES])  → the frozen caches
 *     cache/stockanalysis/etf/<REGION>/tickers-frozen.json
 *   ConvertToYahooSymbol("epa/CW8") → "CW8.PA"        (exchange-suffix map)
 *   filterEtf: averageVolume >= 1000, not in staticdata.BLACKLIST, not Israel
 *   universe.go §4b: pure=false → KEEP leveraged ETPs
 *
 * Entries on unknown exchanges (fra/ham/mun/bst/duse — NOT in the Yahoo suffix
 * map) are dropped: Go keeps them in the asset map but they have no fetchable
 * Yahoo symbol, so they can NEVER become candidates → dropping them is
 * output-equivalent and keeps the fetch load sane.
 *
 * The config-level toxic blacklist (BTC.PA, 3OIL.MI, NUKL.DE, …) is NOT applied
 * here: Go keeps those in the universe and rejects them at SCORING time via
 * scanner_filters.params.blacklist. The JS scanner mirrors that with BLACKLIST_EU.
 *
 * USAGE: node tools/gen-etf-eu-universe.js [--tss <path>] [--out <path>] [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = args.includes('--dry-run');
const TSS_ROOT = path.resolve(getArg('tss', path.join(ARTICLES_ROOT, '..', 'systematic-tss')));
const OUT = path.resolve(getArg('out', path.join(ARTICLES_ROOT, 'data', 'etf-eu-universe.json')));
const REGIONS = ['FR', 'DE', 'NL', 'IT', 'ES']; // == universe.go LoadEtfTickersMulti order

// ── staticdata.ConvertToYahooSymbol exchange→suffix map (ported verbatim) ─────
const EXCHANGE_SUFFIX = {
  nasdaq: '', nyse: '', arca: '',
  tsx: '.TO', tsxv: '.V', cse: '.CN',
  lon: '.L',
  epa: '.PA',
  etr: '.DE',              // only Xetra maps to .DE (fra/ham/mun/bst/duse are dupes → dropped)
  bit: '.MI',
  bme: '.MC',
  ams: '.AS',
  bru: '.BR',
  six: '.SW', swx: '.SW',
  sto: '.ST', cph: '.CO', osl: '.OL', hel: '.HE',
  els: '.LS', eli: '.LS',
  wse: '.WA', bvmf: '.SA', bmv: '.MX', asx: '.AX', nze: '.NZ',
  tyo: '.T', jp: '.T', fkse: '.T', krx: '.KS', kosdaq: '.KQ',
  sha: '.SS', she: '.SZ', hkg: '.HK', nse: '.NS', bse: '.BO', bom: '.BO',
  tpe: '.TW', tpex: '.TWO', sgx: '.SI', set: '.BK', klse: '.KL', idx: '.JK',
  hose: '.VN', hnx: '.HNX', pse: '.PS', bist: '.IS', moex: '.ME',
  tadawul: '.SR', egx: '.CA', jse: '.JO', cbse: '.CS', difx: '.DU', tlv: '.TA',
  ath: '.AT', pra: '.PR', bud: '.BD', bvb: '.BU', ux: '.UX',
  aim: '.L', bkk: '.BK', ebr: '.BR', xngo: '.NE', neo: '.NE', xkon: '.KQ',
};

// staticdata.BLACKLIST (ported verbatim — US share-class dupes, harmless for EU)
const BLACKLIST = new Set([
  'TVAI', 'OYSE', 'MOG.A', 'CHPG', 'CRAC', 'BLUW', 'BRK.B', 'CWEN.A', 'BACC',
  'HEI.A', 'DGIC.A', 'IMKT.A', 'CCCX', 'KCHV', 'AACI', 'RUSH.A', 'CGCT', 'WENN',
  'PBR.A', 'BF.A', 'GTEN', 'BSAA', 'FWON.K', 'BHK.RT', 'GRP.U', 'AKO.B', 'CIG.C',
  'GTN.A', 'PACH', 'MKC.V', 'AXIN', 'AKO.A', 'CRD.A', 'BH.A', 'CRD.B',
]);

function convertToYahooSymbol(apiSymbol) {
  const parts = apiSymbol.split('/');
  if (parts.length !== 2) return null;              // unknown format
  const suf = EXCHANGE_SUFFIX[parts[0]];
  if (suf === undefined) return null;               // unknown exchange (fra/ham/mun/…)
  return parts[1] + suf;
}

function loadFrozen(region) {
  const fp = path.join(TSS_ROOT, 'cache', 'stockanalysis', 'etf', region, 'tickers-frozen.json');
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return (j.data && j.data.data) ? j.data.data : {};
}

function main() {
  const seen = new Map(); // yahooSym → { symbol, name, category, region }
  const stats = { perRegion: {}, dropUnknownEx: 0, dropLowVol: 0, dropBlacklist: 0, dropIsrael: 0, dupSkipped: 0 };

  for (const region of REGIONS) {
    let raw;
    try { raw = loadFrozen(region); }
    catch (e) { console.error(`✗ cannot read frozen cache for ${region}: ${e.message}`); process.exit(2); }
    let kept = 0;
    for (const [key, v] of Object.entries(raw)) {
      const sym = convertToYahooSymbol(key);
      if (sym === null) { stats.dropUnknownEx++; continue; }
      if ((v.averageVolume || 0) < 1000) { stats.dropLowVol++; continue; }      // filterEtf
      if (BLACKLIST.has(sym)) { stats.dropBlacklist++; continue; }              // filterEtf
      if (v.etfCountry === 'Israel' || v.etfCountry === 'IL') { stats.dropIsrael++; continue; } // filterEtf
      if (seen.has(sym)) { stats.dupSkipped++; continue; }                      // §4b: first region wins
      seen.set(sym, { symbol: sym, name: v.name || sym, category: v.etfCategory || '', region });
      kept++;
    }
    stats.perRegion[region] = kept;
  }

  const etfs = [...seen.values()]
    .map(e => ({ symbol: e.symbol, name: e.name, category: e.category || 'OTHER' }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const out = {
    updated: new Date().toISOString().slice(0, 10),
    source: `systematic-tss secmaster ETF frozen caches (regions ${REGIONS.join(',')}), pure:false`,
    method: 'ISO dump via tools/gen-etf-eu-universe.js — ConvertToYahooSymbol + filterEtf(avgVol>=1000, staticdata.BLACKLIST, !Israel). Matches universe.go GetAssets §4b for etf_eu. Config toxic blacklist applied at SCORING (BLACKLIST_EU in etf-scanner.js), not here.',
    note: 'Category = frozen etfCategory (drives diversifyByCategory, max 2/category — same source as Go etf.EtfCategory). Do NOT hand-edit: regenerate with `node tools/gen-etf-eu-universe.js`.',
    count: etfs.length,
    etfs,
  };

  console.error(`EU ETF universe: ${etfs.length} symbols`);
  console.error(`  per region kept: ${JSON.stringify(stats.perRegion)}`);
  console.error(`  dropped — unknownExchange:${stats.dropUnknownEx} lowVol:${stats.dropLowVol} blacklist:${stats.dropBlacklist} israel:${stats.dropIsrael} cross-region-dup:${stats.dupSkipped}`);

  if (DRY) { console.error('dry-run — not written.'); return; }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(`→ wrote ${OUT}`);
}

main();
