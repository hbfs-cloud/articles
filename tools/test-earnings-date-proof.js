#!/usr/bin/env node
'use strict';
// La preuve primaire de prochaine publication est fermée, datée et tracée ; sans elle, un calendrier
// indisponible reste un rejet (décision du propriétaire du 2026-11-07, séance du 9 novembre 2026).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { validateProof, proofFor } = require('./lib/earnings-date-proof');

const filing = (date, acc) => ({ date, accession: acc, url: `https://www.sec.gov/Archives/edgar/data/1/${acc.replace(/-/g, '')}/x.htm` });
const good = {
  date: '20261109', refdate: '2026-11-06', exclusion_window_start: '2026-11-04', exclusion_window_end: '2026-11-23',
  user_instruction: 'décision du propriétaire', rule: 'deux 8-K item 2.02', public_notice: 'titres réadmis sur preuve',
  all_other_gates_required: true,
  tickers: {
    OK: { recent_8k_202: filing('2026-11-02', '0000000001-26-000001'), prior_year_q4_8k_202: filing('2026-02-10', '0000000001-26-000002'),
      no_8k_202_between_2025_11_09_and_2025_11_23: true, conclusion: 'outside_exclusion_window' },
    NO: { recent_8k_202: filing('2026-11-02', '0000000001-26-000003'), prior_year_q4_8k_202: null, conclusion: 'unproven' },
  },
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edproof-'));
try {
  fs.mkdirSync(path.join(root, 'scanner/20261109'), { recursive: true });
  const args = t => ({ root, dirRel: 'scanner/20261109', date: '20261109', refdate: '2026-11-06', ticker: t });
  // Sans fichier : pas de preuve, le rejet fail-closed s'applique.
  assert.strictEqual(proofFor(args('OK')), null);
  fs.writeFileSync(path.join(root, 'scanner/20261109/_earnings-date-proof.json'), JSON.stringify(good));
  assert.strictEqual(proofFor(args('OK')).recent_8k_202.date, '2026-11-02');
  // Preuve incomplète : le nom reste écarté.
  assert.strictEqual(proofFor(args('NO')), null);
  assert.strictEqual(proofFor(args('ABSENT')), null);
  // Une séance hors liste fermée est refusée.
  assert.ok(validateProof({ ...good, date: '20261110', refdate: '2026-11-09' }, { date: '20261110', refdate: '2026-11-09' }).some(e => /closed list/.test(e)));
  // Schéma fermé, gates maintenus, preuves EDGAR complètes.
  for (const [label, mutate] of [
    ['clé en trop', d => { d.valid_until = '2027-01-01'; }],
    ['autres gates levés', d => { d.all_other_gates_required = false; }],
    ['mention publique absente', d => { d.public_notice = ''; }],
    ['8-K de l\'an dernier absent', d => { d.tickers.OK.prior_year_q4_8k_202 = null; }],
    ['url hors EDGAR', d => { d.tickers.OK.recent_8k_202.url = 'https://example.com/x'; }],
    ['8-K récent dans la fenêtre', d => { d.tickers.OK.recent_8k_202.date = '2026-11-05'; }],
    ['publication dans la fenêtre l\'an dernier', d => { d.tickers.OK.no_8k_202_between_2025_11_09_and_2025_11_23 = false; }],
  ]) {
    const d = JSON.parse(JSON.stringify(good)); mutate(d);
    assert.ok(validateProof(d, { date: '20261109', refdate: '2026-11-06' }).length > 0, label);
  }
  // Le fichier réel de la séance est valide.
  const real = path.join(__dirname, '../scanner/20261109/_earnings-date-proof.json');
  if (fs.existsSync(real)) assert.deepStrictEqual(validateProof(JSON.parse(fs.readFileSync(real, 'utf8')), { date: '20261109', refdate: '2026-11-06' }), []);
  console.log('earnings date proof: PASS — fermée, datée, tracée ; le rejet fail-closed reste la règle');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
