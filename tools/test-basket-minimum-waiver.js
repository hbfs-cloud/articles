#!/usr/bin/env node
'use strict';
// La dérogation au plancher 6 actions + 2 ETF est fermée, datée et tracée ; elle ne désactive pas le
// contrôle (décision du propriétaire du 2026-09-24).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { validateWaiver, effectiveFloors } = require('./lib/basket-minimum-waiver');

const filters = { diversification: { min_us_count: 6, min_etf_count: 2 } };
const good = {
  date: '20260924', refdate: '2026-09-23', min_us_count: 6, min_etf_count: 1,
  user_instruction: 'Dérogation pour le seul scan du 24/09.', provenance: 'réponse du propriétaire, 2026-09-24 vers 10:00',
  reason: 'choc de taux', public_notice: 'seuls 7 plans passent nos filtres', all_other_gates_required: true,
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'waiver-'));
try {
  fs.mkdirSync(path.join(root, 'scanner/20260924'), { recursive: true });
  const at = rel => path.join(root, rel);
  // Sans fichier : planchers normaux.
  assert.deepStrictEqual(effectiveFloors({ root, dirRel: 'scanner/20260924', date: '20260924', refdate: '2026-09-23', filters }),
    { min_us_count: 6, min_etf_count: 2, waiver: null });
  // Fichier valide : planchers abaissés, dérogation tracée avec son empreinte.
  fs.writeFileSync(at('scanner/20260924/_basket-minimum-waiver.json'), JSON.stringify(good));
  const f = effectiveFloors({ root, dirRel: 'scanner/20260924', date: '20260924', refdate: '2026-09-23', filters });
  assert.strictEqual(f.min_etf_count, 1); assert.strictEqual(f.min_us_count, 6);
  // Le fichier réel du 24/09 (3 actions + 1 ETF) est valide pour sa séance.
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, '../scanner/20260924/_basket-minimum-waiver.json'), 'utf8'));
  assert.deepStrictEqual(validateWaiver(real, { date: '20260924', refdate: '2026-09-23', filters }), []);
  assert.strictEqual(real.min_us_count, 3); assert.strictEqual(real.min_etf_count, 1);
  assert.match(f.waiver.sha256, /^[0-9a-f]{64}$/); assert.deepStrictEqual(f.waiver.normal_floors, { min_us_count: 6, min_etf_count: 2 });
  // Une séance hors liste fermée est refusée même avec un fichier bien formé à sa date.
  fs.mkdirSync(path.join(root, 'scanner/20260925'), { recursive: true });
  fs.writeFileSync(at('scanner/20260925/_basket-minimum-waiver.json'), JSON.stringify({ ...good, date: '20260925', refdate: '2026-09-24' }));
  assert.throws(() => effectiveFloors({ root, dirRel: 'scanner/20260925', date: '20260925', refdate: '2026-09-24', filters }), /closed list/);
  // Une autre séance ne peut pas réutiliser la dérogation.
  assert.throws(() => effectiveFloors({ root, dirRel: 'scanner/20260924', date: '20260925', refdate: '2026-09-24', filters }), /date/);
  // Schéma fermé, provenance obligatoire, pas de plancher relevé déguisé, autres gates maintenus.
  for (const [label, mutate] of [
    ['clé en trop', d => { d.valid_until = '2027-01-01'; }],
    ['provenance absente', d => { d.provenance = ''; }],
    ['mention publique absente', d => { delete d.public_notice; }],
    ['plancher relevé', d => { d.min_us_count = 9; }],
    ['plancher négatif', d => { d.min_etf_count = -1; }],
    ['autres gates levés', d => { d.all_other_gates_required = false; }],
  ]) {
    const d = { ...good }; mutate(d);
    assert(validateWaiver(d, { date: '20260924', refdate: '2026-09-23', filters }).length > 0, `dérogation acceptée malgré ${label}`);
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('basket minimum waiver: PASS — fermée, datée, tracée ; le contrôle de composition reste actif');
