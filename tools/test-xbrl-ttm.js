'use strict';
// Tests de tools/lib/xbrl-ttm.cjs : départage des lignes XBRL à même date de fin et agrégat douze mois.
const assert = require('assert');
const X = require('./lib/xbrl-ttm.cjs');
const row = (start, end, val, form, filed) => ({ start, end, val, form, filed, accn: 'x' });
const cf = rows => ({ facts: { 'us-gaap': { Revenues: { units: { USD: rows } } } } });

// 1. Le trimestre seul et le cumul finissent le même jour : le cumul (période la plus longue) gagne,
//    quel que soit l'ordre des lignes dans le fichier.
for (const rows of [
  [row('2026-01-01', '2026-06-30', 60, '10-Q', '2026-08-01'), row('2026-04-01', '2026-06-30', 35, '10-Q', '2026-08-01')],
  [row('2026-04-01', '2026-06-30', 35, '10-Q', '2026-08-01'), row('2026-01-01', '2026-06-30', 60, '10-Q', '2026-08-01')],
]) {
  const u = X.units(cf(rows), 'Revenues');
  const p = X.pick(u, r => r.form === '10-Q' && r.start);
  assert.strictEqual(p.value, 60, 'le cumul semestriel doit primer sur le trimestre seul');
}

// 2. À période égale, le dépôt le plus récent gagne (retraitement).
{
  const u = X.units(cf([row('2026-01-01', '2026-06-30', 60, '10-Q', '2026-08-01'), row('2026-01-01', '2026-06-30', 61, '10-Q/A', '2026-09-01')]), 'Revenues');
  assert.strictEqual(X.pick(u, () => true).value, 61);
}

// 3. Douze mois glissants : cumul 2026 + exercice 2025 − cumul 2025, trimestres seuls présents et mélangés.
{
  const rows = [
    row('2025-04-01', '2025-06-30', 30, '10-Q', '2025-08-01'), row('2025-01-01', '2025-06-30', 50, '10-Q', '2025-08-01'),
    row('2025-01-01', '2025-12-31', 110, '10-K', '2026-02-15'),
    row('2026-04-01', '2026-06-30', 35, '10-Q', '2026-08-01'), row('2026-01-01', '2026-06-30', 60, '10-Q', '2026-08-01'),
  ];
  const r = X.ttm(cf(rows), ['Revenues'], '2026-09-23');
  assert.strictEqual(r.value, 60 + 110 - 50);
}

// 4. Une étiquette dont le dernier exercice a plus de deux cents jours et sans cumul récent est refusée.
{
  const r = X.ttm(cf([row('2024-01-01', '2024-12-31', 100, '10-K', '2025-02-15')]), ['Revenues'], '2026-09-23');
  assert.strictEqual(r, null);
}
console.log('ok test-xbrl-ttm');
