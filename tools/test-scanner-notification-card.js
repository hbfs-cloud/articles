#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  CARD_HEIGHT,
  CARD_WIDTH,
  buildTelegramCaption,
  generateHTML,
  loadDtxProductNotice,
} = require('./generate-scanner-image');

const top3 = [
  {
    rank: 1, ticker: 'AAPL', name: 'Apple', strategy: 'Breakout', score: 92,
    entry: 324.01, stop: 313.15, tp1: 334.88, tp2: 340.31,
    rr: '1:1.00', horizon_days: 10, color: '#059669', chart: null,
  },
  {
    rank: 2, ticker: 'NVDA', name: 'NVIDIA', strategy: 'Momentum', score: 92,
    entry: 221.82, stop: 210.61, tp1: 233.04, tp2: 238.65,
    rr: '1:1.00', horizon_days: 10, color: '#2563eb', chart: null,
  },
  {
    rank: 3, ticker: 'CRWD', name: 'CrowdStrike', strategy: 'Breakout', score: 89.2,
    entry: 235.07, stop: 216.34, tp1: 253.8, tp2: 263.17,
    rr: '1:1.00', horizon_days: 10, color: '#7c3aed', chart: null,
  },
];
const regime = { label: 'RISK-ON', color: '#16a34a' };
const dtxNotice = loadDtxProductNotice();
const html = generateHTML({
  top3,
  regime,
  scanDir: '20260901',
  referenceClose: '2026-08-31',
  dtxNotice,
});

assert.strictEqual(CARD_WIDTH, 1080, 'Telegram card width drift');
assert.strictEqual(CARD_HEIGHT, 1350, 'Telegram card must remain portrait 4:5');
assert(html.includes('width:1080px;height:1350px'), 'card dimensions missing from rendered HTML');
assert(html.includes('DailyTickers') && html.includes('data:image/svg+xml;base64,'), 'official brand/logo missing');
assert.strictEqual((html.match(/class="pick-card"/g) || []).length, 3, 'card must render exactly three editorial picks');
for (const item of top3) {
  assert(html.includes(item.ticker), `${item.ticker}: ticker missing from card`);
  assert(html.includes(item.entry.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), `${item.ticker}: entry missing from card`);
  assert(html.includes(item.stop.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), `${item.ticker}: stop missing from card`);
  assert(html.includes(item.tp1.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), `${item.ticker}: TP1 missing from card`);
}
assert(html.includes('Aucune idée n’est exécutée'), 'card must state that editorial ideas are not executions');
assert(html.includes('Référence de calcul : 31 août 2026'), 'card must describe the bar date without claiming close certification');
assert(!/clôture certifiée/i.test(html), 'card must not claim Marketdata certification before the contract gate passes');
assert(html.includes('Produit distinct du Top 3 · suivi réel non démarré'), 'DTX separation banner missing');
assert(html.includes('89,2'), 'French score formatting missing');
assert(!html.includes('89.2'), 'dot-decimal score leaked into French card');
assert(!/backtest|simulation historique|CAGR|Sharpe|drawdown|rendement historique/i.test(html), 'DTX backtest leaked into editorial card');
assert(!/position ouverte/i.test(html), 'card must not render an open-position block');

const caption = buildTelegramCaption({ top3, regime, scanDir: '20260901', dtxNotice });
assert(caption.length <= 1024, 'Telegram caption exceeds sendPhoto limit');
for (const item of top3) {
  assert(caption.includes(`<b>${item.ticker}</b>`), `${item.ticker}: ticker missing from caption`);
  assert(caption.includes(`entrée ${item.entry.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`), `${item.ticker}: entry missing from caption`);
  assert(caption.includes(`stop ${item.stop.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`), `${item.ticker}: stop missing from caption`);
  assert(caption.includes(`TP ${item.tp1.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`), `${item.ticker}: TP1 missing from caption`);
  assert(caption.includes(`/ ${item.tp2.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`), `${item.ticker}: TP2 missing from caption`);
}
assert(/aucune position ouverte/i.test(caption), 'caption must explicitly disclose zero open positions');
assert(/VWAP \(prix moyen échangé pendant la séance\)/.test(caption), 'caption must explain VWAP in plain French');
assert(/gap &gt; 2 %/.test(caption), 'caption must carry the no-chase gap rule');
assert(/DTX Max<\/b> est un produit distinct/.test(caption), 'caption must separate DTX Max from editorial picks');
assert(/suivi réel n’a pas encore démarré/.test(caption), 'caption must disclose the forward tracking state');
assert(!/backtest|CAGR|Sharpe|drawdown/i.test(caption), 'DTX backtest leaked into caption');

console.log('scanner notification card: PASS');
