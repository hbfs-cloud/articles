#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const dirRel = arg('--dir');
if (!dirRel) {
  console.error('Usage: finalize-scanner-fortress.js --dir scanner/YYYYMMDD');
  process.exit(2);
}

const dir = path.resolve(ROOT, dirRel);
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const signals = read('signals.json');
const technicals = read('_derived/verified-technicals.json');
const selectionRows = read('_final/selection_rows.json');
const review = read('_final/fortress-review.json');
if (review.reference_close !== signals.referenceClose) throw new Error('Fortress: clôture de référence incohérente');
if (!Array.isArray(review.fortress_pool)) throw new Error('Fortress: fortress_pool absent');

const rows = selectionRows.data?.items?.[0]?.candidates || [];
const byTicker = Object.fromEntries(rows.map(x => [x.ticker, x]));
const published = new Set((signals.signals || []).map(x => x.ticker));
const watch = Object.entries(review.watch || {}).map(([ticker, manual]) => {
  if (!published.has(ticker)) throw new Error(`Fortress: ${ticker} absent du panier publié`);
  const tech = technicals.symbols?.[ticker];
  const row = byTicker[ticker];
  if (!tech || !row) throw new Error(`Fortress: preuves numériques absentes pour ${ticker}`);
  const ext = Math.round((tech.close / tech.ema20 - 1) * 10000) / 100;
  const cap = Number(row.market_cap);
  if (!(cap >= 2e9 && cap <= 20e9)) throw new Error(`Fortress: ${ticker} hors univers mid-cap`);
  return {
    ticker,
    grade: 'A',
    strategy: 'FortressA+_candidate',
    score: null,
    scoreSource: 'none',
    scoreFamily: 'fortress_watchlist',
    compliance_status: manual.compliance_status,
    sharia: null,
    sharia_reason: manual.sharia_reason,
    market_cap: cap,
    market_cap_basis: 'sharesOutstanding collecté × clôture Webull vérifiée du 18 septembre',
    in_fortress_universe: true,
    close: tech.close,
    rsi: Math.round(tech.rsi * 100) / 100,
    ext_ema20_pct: ext,
    ema_stack_rising: tech.ema20 > tech.ema50 && tech.ema50 > tech.ema200,
    next_earnings: signals.signals.find(x => x.ticker === ticker)?.earnings_forward_evidence?.next_earnings || null,
    eliminators_failed: manual.eliminators_failed,
    missing_proofs: manual.missing_proofs,
    note: 'Entrée de surveillance uniquement. Ne produit jamais d’ordre.'
  };
});

signals.fortress_pool = review.fortress_pool;
signals.fortress_watch_pool = watch;
signals._fortressPoolNote = {
  reviewed_at: review.reviewed_at,
  reference_close: review.reference_close,
  reviewed_published_candidates: published.size,
  watch_count: watch.length,
  excluded: review.excluded,
  contrarian_note: review.contrarian_note,
  source: `${dirRel}/_final/fortress-review.json`
};
fs.writeFileSync(path.join(dir, 'signals.json'), JSON.stringify(signals, null, 2) + '\n');
console.log(`[fortress] ${review.fortress_pool.length} A+, ${watch.length} surveillance, ${Object.keys(review.excluded || {}).length} exclus explicites`);
