#!/usr/bin/env node
'use strict';
// La dérogation au plafond de 50 % par famille est fermée, datée et tracée ; elle ne désactive pas le
// contrôle (décision du propriétaire du 2026-10-24 pour la séance du 26 octobre 2026).
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { validateWaiver, effectiveDefaultShare } = require('./lib/family-cap-waiver');

const gate = { default_max_share_pct: 50 };
const good = {
  date: '20261026', refdate: '2026-10-23', max_share_pct: 100,
  user_instruction: 'Plafond levé pour le seul scan du 26/10.', provenance: 'réponse du propriétaire, 2026-10-24',
  reason: 'aucune ligne hors suivi de tendance', public_notice: 'que des suivis de tendance aujourd’hui', all_other_gates_required: true,
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-waiver-'));
try {
  fs.mkdirSync(path.join(root, 'scanner/20261026'), { recursive: true });
  const at = rel => path.join(root, rel);
  // Sans fichier : plafond normal.
  assert.deepStrictEqual(effectiveDefaultShare({ root, dirRel: 'scanner/20261026', date: '20261026', refdate: '2026-10-23', gate }),
    { default_max_share_pct: 50, waiver: null });
  // Fichier valide : plafond relevé, dérogation tracée avec son empreinte.
  fs.writeFileSync(at('scanner/20261026/_family-cap-waiver.json'), JSON.stringify(good));
  const f = effectiveDefaultShare({ root, dirRel: 'scanner/20261026', date: '20261026', refdate: '2026-10-23', gate });
  assert.strictEqual(f.default_max_share_pct, 100);
  assert.match(f.waiver.sha256, /^[0-9a-f]{64}$/); assert.strictEqual(f.waiver.normal_default_max_share_pct, 50);
  // Une séance hors liste fermée est refusée même avec un fichier bien formé à sa date.
  fs.mkdirSync(path.join(root, 'scanner/20261027'), { recursive: true });
  fs.writeFileSync(at('scanner/20261027/_family-cap-waiver.json'), JSON.stringify({ ...good, date: '20261027', refdate: '2026-10-26' }));
  assert.throws(() => effectiveDefaultShare({ root, dirRel: 'scanner/20261027', date: '20261027', refdate: '2026-10-26', gate }), /closed list/);
  // Une autre séance ne peut pas réutiliser la dérogation.
  assert.throws(() => effectiveDefaultShare({ root, dirRel: 'scanner/20261026', date: '20261027', refdate: '2026-10-26', gate }), /date/);
  // Schéma fermé, provenance obligatoire, pas de plafond abaissé déguisé, autres gates maintenus.
  for (const [label, mutate] of [
    ['clé en trop', d => { d.valid_until = '2027-01-01'; }],
    ['provenance absente', d => { d.provenance = ''; }],
    ['mention publique absente', d => { delete d.public_notice; }],
    ['plafond non relevé', d => { d.max_share_pct = 50; }],
    ['plafond au-delà de 100', d => { d.max_share_pct = 120; }],
    ['autres gates levés', d => { d.all_other_gates_required = false; }],
  ]) {
    const d = { ...good }; mutate(d);
    assert(validateWaiver(d, { date: '20261026', refdate: '2026-10-23', gate }).length > 0, `dérogation acceptée malgré ${label}`);
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('family cap waiver: PASS — fermée, datée, tracée ; les plafonds temporaires restent actifs');
