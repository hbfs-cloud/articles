'use strict';
// Relevés complémentaires du dossier NBIS du 2 novembre 2026, hors plan analyse, capturés par jeton read-only
// (MCP_TOKEN_FILE_MARKETDATA, voir .claude/skills/mcp-token-procedure.md). Usage :
//   node capture-supplement.cjs <étiquette> <outil...>
// Écrit capture-<étiquette>.json dans revision/ : réponses brutes horodatées, sans retraitement.
//  - calendar : GetEarningsCalendarFiltered sur 30 jours (Nebius, CoreWeave, Nvidia et comparables), car le plan
//    ne regarde que 14 jours et Nvidia publie le 17 novembre.
//  - options  : chaîne d'options NBIS (échéances 6, 13 et 20 novembre), à ±20 % du cours ; capturée pendant la séance
//    du 2 novembre, la chaîne relevée après la clôture pouvant être dépourvue de cotations.
const fs = require('fs'), path = require('path');
const { callTool, awaitJob } = require('../../../../tools/lib/mcp-client.js');
const label = process.argv[2];
const SYMS = 'NBIS,CRWV,IREN,NVDA,MSFT,META,DELL,SMCI,VRT,BE,LITE,COHR,MRVL,APLD,CIFR,WULF,CORZ,ORCL,PLTR';
const CALLS = {
  calendar: [['GetEarningsCalendarFiltered', { symbols: SYMS, days_ahead: 30, include_implied_move: true }]],
  options: [['QueryData', { types: 'options_chain', symbols: 'NBIS', expiries: '2026-11-06,2026-11-13,2026-11-20', moneyness_min: 0.8, moneyness_max: 1.2 }],
    ['QueryData', { types: 'quote', symbols: 'NBIS' }]],
  // Séance du 2 novembre en cours (cours non certifié) : cotation, puis chaîne d'options de l'échéance du 13 novembre.
  live: [['QueryData', { types: 'quote', symbols: 'NBIS' }],
    ['QueryData', { types: 'options_chain', symbols: 'NBIS', expiries: '2026-11-13', moneyness_min: 0.8, moneyness_max: 1.2 }]],
  // Endettement comparé des loueurs de calcul : bilans du fournisseur (current-only) et capitalisations du moment.
  leverage: [['QueryData', { types: 'financials,quote', symbols: 'NBIS,CRWV,IREN' }]],
};
(async () => {
  if (!CALLS[label]) throw Error('étiquette inconnue ' + label);
  const out = { kind: 'nbis_supplement_capture_v1', label, started_at: new Date().toISOString(), calls: [] };
  for (const [tool, args] of CALLS[label]) {
    let res = await callTool('marketdata', tool, args);
    if (res && res.job_id && res.status !== 'completed') res = await awaitJob('marketdata', res.job_id);
    out.calls.push({ tool, args, captured_at: new Date().toISOString(), response: res });
  }
  const dir = path.join(__dirname, 'revision'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'capture-' + label + '.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  console.log('écrit', path.relative(process.cwd(), f));
})().catch(e => { console.error(e.message); process.exit(1); });
