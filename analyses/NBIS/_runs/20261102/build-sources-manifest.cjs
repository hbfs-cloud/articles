'use strict';
// Manifeste des sources hors EDGAR de Nebius (communiqués d'émetteurs relayés, presse attribuée) ouvertes le
// 2 novembre 2026 pour le dossier NBIS. Chaque pièce est enregistrée localement, hachée, et chaque extrait cité est
// vérifié dans le texte rendu (balises retirées) : une phrase absente fait échouer le script.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { htmlText } = require('../../../../tools/lib/analysis-v3-r08.cjs');
const DIR = path.join(__dirname, 'primary');
const rel = p => path.relative(path.join(__dirname, '../../../..'), p);
const SRC = [
  { id: 'nbis_q3_date', file: 'oct30-ir-q3-date.html', url: 'https://nebius.com/newsroom/nebius-group-announces-date-of-third-quarter-2026-results-and-conference-call',
    issuer: 'Nebius Group N.V. (communiqué, site de la société)', published: '2026-10-30', kind: 'issuer_release',
    needles: ['Amsterdam, October 30, 2026', 'will release its third quarter 2026 financial results on Thursday, November 12, 2026, before market open', '8:00 a.m. Eastern Time (5:00 a.m. Pacific Time / 2:00 p.m. Central European Time)'] },
  { id: 'crwv_q3_date', file: 'oct27-crwv-q3-date-businesswire.html', url: 'https://investingnews.com/coreweave-announces-date-of-third-quarter-2026-financial-results-and-conference-call/',
    issuer: 'CoreWeave, Inc. (communiqué Business Wire relayé)', published: '2026-10-27', kind: 'issuer_release',
    needles: ['will hold its quarterly conference call to discuss third quarter 2026 financial results on Tuesday, November 10, 2026 at 5:00 PM Eastern Time'] },
  { id: 'nvda_q3_date', file: 'nvda-q3fy27-call-globenewswire.html', url: 'https://investingnews.com/nvidia-sets-conference-call-for-third-quarter-financial-results-2678161468/',
    issuer: 'NVIDIA Corporation (communiqué GlobeNewswire relayé)', published: '2026-10-28', kind: 'issuer_release',
    needles: ['NVIDIA will host a conference call on Tuesday, November 17, at 2 p.m. PT (5 p.m. ET) to discuss its financial results for the third quarter of fiscal year 2027'] },
  { id: 'msft_capex_cnbc', file: 'oct29-cnbc-msft-capex.html', url: 'https://www.cnbc.com/2026/10/29/microsoft-google-ai-capex-estimates.html',
    issuer: 'CNBC (Jordan Novet)', published: '2026-10-29', kind: 'attributed_news',
    needles: ['Microsoft reduced its capex forecast for the year to $170 billion from $175 billion', 'third-party providers of graphics processing units had delays that will push out some available capacity until the first half of 2027', 'Microsoft relies on CoreWeave, IREN and Nebius, among others'] },
  { id: 'mrvl_lite_8k', file: 'nov02-lite-8k-ex991-marvell.htm', url: 'https://www.sec.gov/Archives/edgar/data/1633978/000119312526442758/d163169dex991.htm',
    issuer: 'Lumentum Holdings Inc., 8-K pièce 99.1 (accession 0001193125-26-442758)', published: '2026-11-02', kind: 'sec_primary_third_party',
    needles: ['November 2, 2026', 'fixed exchange ratio of 4.500 shares of Marvell common stock for each share of Lumentum common stock', 'implied enterprise value of $115 billion for Lumentum', 'first half of calendar year 2028'] },
  { id: 'mb_consensus', file: 'nov02-marketbeat-consensus.html', url: 'https://www.marketbeat.com/earnings/reports/2026-11-12-nebius-group-nv-stock/',
    issuer: 'MarketBeat (page des résultats de Nebius)', published: '2026-11-02', kind: 'attributed_news',
    needles: ['Nebius Group is expected to post earnings of -$0.7067 per share on revenue of $905.75 million'] },
];
const docs = SRC.map(s => {
  const p = path.join(DIR, s.file), buf = fs.readFileSync(p), text = htmlText(buf.toString('utf8'));
  for (const n of s.needles) if (!text.includes(n)) throw Error(s.id + ': extrait absent : ' + n);
  return { ...s, path: rel(p), sha256: crypto.createHash('sha256').update(buf).digest('hex'), retrieved_at: '2026-11-02' };
});
const out = { kind: 'nbis_non_edgar_sources_v1', ticker: 'NBIS', as_of: '2026-11-02',
  method: 'Pièces enregistrées le 2 novembre 2026 entre 18 h 20 et 20 h 20 UTC ; extraits vérifiés sur le texte rendu par htmlText (gabarit R08). Les communiqués de CoreWeave et de Nvidia sont lus dans leur reprise intégrale par un diffuseur, la page de l’émetteur étant rendue par script.',
  documents: docs };
fs.writeFileSync(path.join(__dirname, 'revision', 'sources-manifest.json'), JSON.stringify(out, null, 1));
console.log('sources', docs.length);
