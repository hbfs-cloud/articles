#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { replayPlan, conditionalTriggerWithoutDate } = require('./analyses-lifecycle');

// Cas réel du 29 octobre 2026 : plan NBIS « clôture ≥ 178,86 $ après les résultats », passé à tort
// en « active » sur la clôture du 28 octobre (182,34 $), avant la publication.
const nbis = {
  entry: 178.85, stop: 149.49, tp1: 234.16, tp2: 255.08, horizon: '20 séances',
  banner: 'Rien à acheter à 153,27 $ ni avant les résultats du 10 novembre. Ensuite seulement : clôture au-dessus de 178,85 $.',
  entryNote: 'Déclencheur : une clôture à 178,86 $ ou plus, survenue après la publication des résultats.',
};
const closes = [
  { date: '2026-10-27', close: 160.1 },
  { date: '2026-10-28', close: 182.34 },
  { date: '2026-10-29', close: 170.2 },
];

assert.strictEqual(conditionalTriggerWithoutDate(nbis), true);
assert.strictEqual(replayPlan(nbis, 153.27, closes, 20, 'watch'), null, 'condition en prose sans date : aucun déclenchement automatique');

const dated = { ...nbis, triggerNotBefore: '2026-11-12' };
assert.strictEqual(conditionalTriggerWithoutDate(dated), false);
assert.strictEqual(replayPlan(dated, 153.27, closes, 20, 'watch'), null, 'clôtures antérieures à triggerNotBefore ignorées');

const after = [...closes, { date: '2026-11-12', close: 181.0 }, { date: '2026-11-13', close: 185.5 }];
const res = replayPlan(dated, 153.27, after, 20, 'watch');
assert.strictEqual(res.status, 'active');
assert.strictEqual(res.event.date, '2026-11-12', 'première clôture éligible au-dessus du déclencheur');

// La fenêtre d'attente ne compte que les séances éligibles.
const shortWindow = replayPlan({ ...dated, horizon: '5' }, 153.27, closes, 5, 'watch');
assert.strictEqual(shortWindow, null, 'pas d\'expiration sur des séances antérieures à l\'événement');

// Plan sans condition : comportement inchangé (cassure déclenchée sur la première clôture au-dessus).
const plain = { entry: 178.85, stop: 149.49, tp1: 234.16, horizon: '20 séances', banner: 'Achat sur cassure.' };
const plainRes = replayPlan(plain, 153.27, closes, 20, 'watch');
assert.strictEqual(plainRes.status, 'active');
assert.strictEqual(plainRes.event.date, '2026-10-28');

// Une ligne déjà active est rejouée depuis sa publication : la prose ne bloque pas le stop.
const stopped = replayPlan(nbis, 153.27, [...closes, { date: '2026-11-02', close: 147.5 }], 20, 'active');
assert.strictEqual(stopped.status, 'stopped');
assert.strictEqual(stopped.event.date, '2026-11-02');

console.log('analyses lifecycle tests: PASS');
