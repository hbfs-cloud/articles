#!/usr/bin/env node
/**
 * flatten-fundamentals.js — aplatit une collecte MCP (fundamentals.json + instrument.json)
 * vers le format d'entrée de valuation-multi.js / value-quality-board.js.
 *
 * Usage: node tools/lib/flatten-fundamentals.js --dir data/analyses-data/_collect/CSGP --ticker CSGP [--out <file>]
 *
 * Fail-closed par construction : un champ introuvable reste ABSENT (les modules aval
 * marquent la méthode `na`) — jamais de valeur par défaut fabriquée.
 */
const fs = require('fs');
const path = require('path');

function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const dir = arg('--dir'); const ticker = arg('--ticker'); const out = arg('--out', path.join(dir || '.', '_fund_flat.json'));
if (!dir || !ticker) { console.error('usage: flatten-fundamentals.js --dir <collect_dir> --ticker <T>'); process.exit(1); }

function loadJSON(f) { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } }

// Parcours récursif : collecte la PREMIÈRE occurrence de chaque clé cherchée.
function harvest(obj, wanted, found) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (wanted.has(k) && found[k] === undefined && (typeof v === 'number' || typeof v === 'string')) {
      if (typeof v === 'number' && Number.isFinite(v)) found[k] = v;
    }
    if (v && typeof v === 'object') harvest(v, wanted, found);
  }
}

const WANTED = new Set([
  // valuation-multi
  'beta', 'capex', 'depreciation', 'earningsGrowth', 'ebit', 'ebitda', 'freeCashFlow', 'freeCashflow',
  'interestCoverage', 'interestExpense', 'netIncome', 'netIncomeToCommon', 'profitMargins', 'revenueGrowth',
  'totalCash', 'totalDebt', 'totalRevenue', 'workingCapitalChange', 'operatingCashflow',
  // marketCap / book
  'marketCap', 'sharesOutstanding', 'bookValue', 'enterpriseValue', 'enterpriseToEbitda',
  // quality board extras
  'grossMargins', 'operatingMargins', 'returnOnEquity', 'returnOnAssets', 'currentRatio',
  'debtToEquity', 'trailingPE', 'forwardPE', 'pegRatio', 'priceToBook', 'dividendYield', 'price',
]);

const found = {};
for (const f of ['fundamentals.json', 'instrument.json', 'technicals.json', 'status.json']) {
  const j = loadJSON(f); if (j) harvest(j, WANTED, found);
}

// Normalisations sans fabrication :
if (found.freeCashFlow === undefined && typeof found.freeCashflow === 'number') found.freeCashFlow = found.freeCashflow;
if (found.netIncome === undefined && typeof found.netIncomeToCommon === 'number') found.netIncome = found.netIncomeToCommon;
// marketCap dérivable UNIQUEMENT de deux champs réels de la même collecte :
if (found.marketCap === undefined && typeof found.price === 'number' && typeof found.sharesOutstanding === 'number') {
  found.marketCap = found.price * found.sharesOutstanding;
  found._marketCapDerived = 'price*sharesOutstanding (collecte de session)';
}
// bookEquity pour Residual Income :
if (typeof found.bookValue === 'number' && typeof found.sharesOutstanding === 'number') {
  found.bookEquity = found.bookValue * found.sharesOutstanding;
}

found.ticker = ticker;
found._source = 'flatten-fundamentals.js sur la collecte de session (fail-closed, zéro défaut)';
fs.writeFileSync(out, JSON.stringify(found, null, 2));
const have = Object.keys(found).filter(k => !k.startsWith('_') && typeof found[k] === 'number').length;
console.log(`[flatten] ${ticker}: ${have} champs numériques → ${out}`);
