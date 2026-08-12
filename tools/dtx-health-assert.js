#!/usr/bin/env node
'use strict';
/**
 * dtx-health-assert.js — juge la fraîcheur du moteur SANS croire son propre verdict.
 *
 * POURQUOI (incident du 2026-08-12). `GetHealth` a rendu `freshness_ok: true` alors que le moteur
 * était au 2026-08-11 et le marché au 2026-08-12. Ce n'est pas un mensonge : `sessions_behind` se
 * calcule contre `last_data_date`, c'est-à-dire contre lui-même. Un service en retard d'une séance
 * se déclare donc à jour, par construction. Le champ répond à « ma donnée est-elle cohérente avec
 * ce que je crois être aujourd'hui ? », jamais à « ma donnée atteint-elle la clôture que je veux
 * trader ? ».
 *
 * Second défaut du même incident : `prefetch.running: true` avec `last_attempt_utc` figé depuis
 * ~25 h. Un prefetch « en cours » depuis 25 heures ne tourne pas — le drapeau est resté armé (VM
 * réinitialisée le jour même). Conséquence : `DtxRefreshBars` répond `already_running` et refuse
 * de démarrer, DÉFINITIVEMENT. Le remède documenté contre les données périmées était lui-même
 * neutralisé, et rien ne le disait.
 *
 * Ce script tranche sur deux critères que le serveur ne peut pas s'appliquer à lui-même :
 *   1. `last_data_date` atteint-il la clôture EXIGÉE par l'appelant (et non celle qu'il suppose) ;
 *   2. le prefetch est-il réellement vivant, ou bloqué en « running » depuis trop longtemps.
 *
 * Usage :
 *   DTX_RO_TOKEN=<jeton> node tools/dtx-health-assert.js --expect-close 2026-08-12 [--json]
 *   node tools/dtx-health-assert.js --expect-close 2026-08-12 --from <health.json>
 *
 * Exit : 0 = moteur utilisable pour cette clôture · 1 = pas utilisable (raison nommée) · 2 = usage.
 */

const fs = require('fs');
const https = require('https');

const ENDPOINT = 'https://systematic.dailytickers.com/mcp';
// Un warm plein-univers dure ~4 min et se décante ~10 min. Au-delà de 45 min sans nouvelle
// tentative, « running » ne décrit plus un travail en cours mais un drapeau resté armé.
const STUCK_PREFETCH_MIN = 45;

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const EXPECT = flag('expect-close');
const FROM = flag('from');
const AS_JSON = argv.includes('--json');

function fetchHealth() {
  const token = process.env.DTX_RO_TOKEN;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'GetHealth', arguments: {} } });
  return new Promise((resolve, reject) => {
    const u = new URL(ENDPOINT);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let p = raw.trim();
        if (p.includes('\ndata:')) { const L = p.split('\n').filter((l) => l.startsWith('data:')); p = L[L.length - 1].slice(5).trim(); }
        try {
          const j = JSON.parse(p);
          if (j.error) return reject(new Error(JSON.stringify(j.error)));
          const c = j.result && j.result.content && j.result.content[0];
          resolve(c && c.text ? JSON.parse(c.text) : j.result);
        } catch (e) { reject(new Error(`réponse illisible (${res.statusCode}) — ${p.slice(0, 160)}`)); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function judge(h, expect) {
  const problems = [];
  const last = h && h.last_data_date ? String(h.last_data_date).slice(0, 10) : null;

  if (!last) problems.push({ code: 'no_data_date', msg: 'GetHealth ne rend aucun last_data_date — état indéterminable' });
  else if (expect && last < expect) {
    problems.push({
      code: 'behind_expected_close',
      msg: `le moteur est au ${last}, la clôture exigée est le ${expect} — freshness_ok:${h.freshness_ok} ne le voit pas, sessions_behind se calcule contre last_data_date, donc contre lui-même`,
    });
  }

  const pf = (h && h.prefetch) || {};
  if (pf.running === true) {
    const att = pf.last_attempt_utc ? Date.parse(pf.last_attempt_utc) : NaN;
    const ageMin = Number.isFinite(att) ? (Date.now() - att) / 60000 : Infinity;
    if (ageMin > STUCK_PREFETCH_MIN) {
      problems.push({
        code: 'prefetch_stuck',
        msg: `prefetch.running=true mais last_attempt_utc remonte à ${Number.isFinite(ageMin) ? Math.round(ageMin) + ' min' : 'jamais'} (> ${STUCK_PREFETCH_MIN} min) — le drapeau est resté armé, donc DtxRefreshBars répondra « already_running » et ne démarrera jamais`,
      });
    }
  }
  return { ok: problems.length === 0, last_data_date: last, expected_close: expect || null, problems };
}

async function main() {
  if (!EXPECT && !FROM) {
    console.error('Usage: dtx-health-assert.js --expect-close YYYY-MM-DD [--from health.json] [--json]');
    process.exit(2);
  }
  let h;
  try {
    h = FROM ? JSON.parse(fs.readFileSync(FROM, 'utf8')) : await fetchHealth();
  } catch (e) {
    // Ne pas savoir n'est pas une raison de continuer : un moteur injoignable est un moteur
    // inutilisable, pas un moteur présumé frais.
    console.error(`❌ moteur injoignable — ${e.message}`);
    process.exit(1);
  }

  const v = judge(h, EXPECT);
  if (AS_JSON) { console.log(JSON.stringify(v, null, 2)); process.exit(v.ok ? 0 : 1); }

  console.log(`moteur dtx — dernière séance ${v.last_data_date || '?'}${EXPECT ? ` · clôture exigée ${EXPECT}` : ''}`);
  if (v.ok) { console.log('✅ utilisable pour cette clôture.'); process.exit(0); }
  for (const p of v.problems) console.error(`❌ [${p.code}] ${p.msg}`);
  console.error('\n→ Le moteur ne peut pas servir cette séance. Les modes qui en dépendent doivent être');
  console.error('  écartés bruyamment, jamais servis sur la séance précédente « faute de mieux ».');
  process.exit(1);
}

main();
