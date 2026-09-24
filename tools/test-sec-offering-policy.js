#!/usr/bin/env node
'use strict';
// Règle durable du propriétaire (2026-09-24) : un S-8 seul passe ; S-3, ATM, 424B*, convertible,
// 8-K 3.02/3.03 et PIPE bloquent toujours ; une forme inconnue bloque par défaut.
const assert = require('assert');
const { loadPolicy, classifyHit, blockingHits } = require('./lib/sec-offering-policy');
const policy = loadPolicy();

// Un S-8 seul passe.
assert.strictEqual(classifyHit({ form: 'S-8', date: '2026-09-10' }, policy), 'non_blocking');
assert.strictEqual(classifyHit({ form: 'S-8', kind: 'employee_plan' }, policy), 'non_blocking');
assert.deepStrictEqual(blockingHits([{ form: 'S-8' }, { form: 'S-8 POS' }], policy), [], 'des S-8 seuls ne doivent rien bloquer');

// Un S-3 ou un ATM bloque toujours, y compris à côté d'un S-8.
assert.strictEqual(classifyHit({ form: 'S-3ASR' }, policy), 'blocking');
assert.strictEqual(classifyHit({ form: 'S-3' }, policy), 'blocking');
assert.strictEqual(classifyHit({ form: '424B5', kind: 'atm_program' }, policy), 'blocking');
assert.strictEqual(classifyHit({ form: 'S-8', kind: 'atm_program' }, policy), 'blocking', 'un S-8 requalifié ATM bloque');
assert.strictEqual(blockingHits([{ form: 'S-8' }, { form: 'S-3ASR' }], policy).length, 1, 'le S-3 bloque même accompagné d’un S-8');

// Les autres canaux restent bloquants.
for (const hit of [{ form: '424B2' }, { form: '424B7' }, { form: 'F-3' }, { form: '8-K', items: '3.02,9.01' },
  { form: '8-K', items: '3.03' }, { form: '6-K', kind: 'convertible' }, { form: '8-K', kind: 'pipe' }, { form: 'X-UNKNOWN' }, {}]) {
  assert.strictEqual(classifyHit(hit, policy), 'blocking', `${JSON.stringify(hit)} doit bloquer`);
}
console.log('sec offering policy: PASS — S-8 seul non bloquant ; S-3, ATM, 424B, convertibles, 3.02/3.03, PIPE et inconnu bloquants');
