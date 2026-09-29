#!/usr/bin/env node
'use strict';
// Instantané de marché tracé pour l'éditorial d'un scan : la réponse brute de QueryData est écrite dans
// <dir>/_market/ avec son empreinte, et les chiffres cités dans la prose (clôture, plus haut de séance,
// variations) sont recalculés depuis cette réponse, jamais saisis à la main.
// Limite déclarée : les indices et taux n'ont pas de calendrier de session certifiable côté serveur
// (`asset_calendar_unavailable`) ; ils sont lus par `end_date` et marqués certified:false. Ils servent de
// contexte éditorial, jamais de niveau d'ordre ni de preuve de clôture.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const client = require('./lib/mcp-client');
const ROOT = path.resolve(__dirname, '..');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const dir = arg('--dir'), refdate = arg('--refdate'), symbols = (arg('--symbols') || '').split(',').filter(Boolean);
if (!dir || !/^\d{4}-\d{2}-\d{2}$/.test(refdate || '') || !symbols.length) {
  console.error('Usage: scanner-market-snapshot.js --dir scanner/YYYYMMDD --refdate YYYY-MM-DD --symbols ^TNX[,...]'); process.exit(2);
}
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
(async () => {
  if (!client.canCallDirectly('marketdata')) throw new Error('jeton marketdata absent : aucune valeur de repli');
  const args = { types: 'bars_daily', symbols: symbols.join(','), end_date: refdate, limit: 8 };
  const init = await client.callToolWithRetry('marketdata', 'QueryData', args);
  const jid = init && (init.job_id || (init.data && init.data.job_id));
  const res = jid ? await client.awaitJob('marketdata', jid) : init;
  const raw = JSON.stringify({ captured_at: new Date().toISOString(), args, response: res }, null, 2) + '\n';
  const out = path.join(ROOT, dir, '_market'); fs.mkdirSync(out, { recursive: true });
  const rawFile = path.join(out, 'bars_raw.json'); fs.writeFileSync(rawFile, raw);
  const series = {};
  (function walk(o) { if (!o || typeof o !== 'object') return; if (o.symbol && Array.isArray(o.bars)) series[o.symbol] = o.bars; for (const v of Object.values(o)) walk(v); })(res);
  const rows = {};
  for (const s of symbols) {
    const b = series[s];
    if (!b || b.length < 6) throw new Error(`${s}: moins de six barres, instantané refusé`);
    const last = b[b.length - 1];
    if (last[0] !== refdate) throw new Error(`${s}: dernière barre ${last[0]} ≠ refdate ${refdate}`);
    rows[s] = { date: last[0], open: last[1], high: last[2], low: last[3], close: last[4],
      prev_close: b[b.length - 2][4], close_4_sessions_ago: b[b.length - 5][4], date_4_sessions_ago: b[b.length - 5][0],
      day_change_pct: +((last[4] / b[b.length - 2][4] - 1) * 100).toFixed(2), change_4_sessions: +(last[4] - b[b.length - 5][4]).toFixed(3) };
  }
  fs.writeFileSync(path.join(out, 'snapshot.json'), JSON.stringify({ schema: 'scanner-market-snapshot.v1', refdate, certified: false,
    certification_note: 'Séries sans calendrier de session certifiable côté serveur : contexte éditorial uniquement.',
    definitions: { day_change_pct: 'clôture / clôture précédente − 1', change_4_sessions: 'clôture − clôture de la 5e barre avant la dernière (quatre séances écoulées)' },
    source: { file: `${dir}/_market/bars_raw.json`, sha256: sha(raw) }, symbols: rows }, null, 2) + '\n');
  console.log(`[market-snapshot] ${symbols.length} symbole(s) -> ${dir}/_market/snapshot.json`);
  for (const [s, r] of Object.entries(rows)) console.log(`  ${s} ${r.date} clôture ${r.close} plus haut ${r.high} jour ${r.day_change_pct}% | ${r.change_4_sessions >= 0 ? '+' : ''}${r.change_4_sessions} depuis ${r.date_4_sessions_ago}`);
})().catch(e => { console.error(e.message); process.exit(1); });
