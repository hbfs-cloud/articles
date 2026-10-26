#!/usr/bin/env node
'use strict';
// Tests de l'échéancier (`tools/lib/event-timeline.cjs`) : rendu, placement, garde-fous.
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { renderEventTimeline } = require('./lib/event-timeline.cjs');
const { renderCalendarLabel, parisDateOf } = require('./lib/fr-calendar');

const base = () => ({
  asof: '2026-10-26', from: '2026-10-26', to: '2026-11-03',
  keyWindow: { from: '2026-10-28', to: '2026-10-29', label: 'Fenêtre clé' },
  events: [
    { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', icon: 'bank', proof: '<span data-claim="fed">19h00</span>' },
    { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Microsoft', icon: 'chip', proof: '<span data-claim="msft">mercredi 28 octobre</span>', proofHidden: true },
    { date: '2026-11-01', category: 'geo', impact: 'medium', label: 'OPEP+', icon: 'oil', uncertain: true },
  ],
  chains: [{ steps: [{ label: 'Fed dure', icon: 'bank' }, { label: 'Tech', category: 'earnings', tone: 'down' }] }],
});
const dom = html => new JSDOM(`<main>${html}</main>`).window.document;

// 1. Structure : un jour par date, étiquettes conformes au rendu partagé, semaines étiquetées.
{
  const doc = dom(renderEventTimeline(base()));
  const days = [...doc.querySelectorAll('[data-calendar-day]')];
  assert.strictEqual(days.length, 9);
  for (const label of doc.querySelectorAll('[data-calendar-date]')) {
    const text = label.textContent.replace(/\s+/g, ' ').trim();
    assert.strictEqual(text, renderCalendarLabel(label.getAttribute('data-calendar-date'), label.getAttribute('data-calendar-format')));
  }
  const weeks = [...doc.querySelectorAll('.evt-tl-week > .evt-tl-section-label')].map(e => e.textContent);
  assert.deepStrictEqual(weeks, ['Cette semaine', 'Semaine suivante']);
  // le dimanche 1er novembre appartient à la semaine du 26 (semaine boursière lundi → dimanche)
  assert(doc.querySelector('[data-calendar-day="2026-11-01"]').classList.contains('wd-7'));
  assert(doc.querySelector('[data-calendar-day="2026-11-02"]').closest('.evt-tl-week').textContent.startsWith('Semaine suivante'));
  // chaque événement est dans la colonne de sa date
  assert.strictEqual(doc.querySelectorAll('[data-calendar-day="2026-10-28"] [data-calendar-event]').length, 2);
  // fenêtre clé : bandeau au-dessus de mer.→jeu., jours marqués
  const keylabel = doc.querySelector('.evt-tl-keylabel');
  assert(keylabel.classList.contains('ks-3') && keylabel.classList.contains('ke-4'));
  assert.strictEqual(doc.querySelectorAll('.evt-tl-day.is-key').length, 2);
  // la preuve cachée reste lisible par un lecteur d'écran
  assert(doc.querySelector('[data-claim="msft"]').parentElement.classList.contains('evt-tl-sr'));
  // légende : seulement les familles présentes, dans l'ordre fixe
  assert.deepStrictEqual([...doc.querySelectorAll('.evt-tl-legend-cat')].map(e => e.textContent), ['Taux et macro', 'Résultats', 'Géopolitique et matières premières']);
  // la semaine suivante sans rendez-vous est masquable sur mobile
  assert(doc.querySelectorAll('.evt-tl-week')[1].classList.contains('is-empty'));
}

// 2. Côtés : deux pastilles le même jour se répartissent au-dessus et au-dessous de l'axe.
{
  const doc = dom(renderEventTimeline(base()));
  const day = doc.querySelector('[data-calendar-day="2026-10-28"]');
  assert.strictEqual(day.querySelectorAll('.evt-tl-top [data-calendar-event]').length, 1);
  assert.strictEqual(day.querySelectorAll('.evt-tl-bottom [data-calendar-event]').length, 1);
}

// 3. Garde-fous : chaque erreur de spécification est un refus explicite.
const refuse = (mutate, pattern) => {
  const spec = base(); mutate(spec);
  assert.throws(() => renderEventTimeline(spec), pattern);
};
refuse(s => { s.events[0].date = '2026-11-20'; }, /hors de la fenêtre/);
refuse(s => { s.events[0].category = 'crypto'; }, /catégorie inconnue/);
refuse(s => { s.events[0].impact = 'low'; }, /impact/);
refuse(s => { s.events[0].icon = 'rocket'; }, /icône inconnue/);
refuse(s => { s.to = '2026-12-31'; }, /au plus trois semaines/);
refuse(s => { s.keyWindow = { from: '2026-10-30', to: '2026-11-02' }; }, /deux semaines/);
refuse(s => { s.requireProof = true; }, /preuve de date absente/);
refuse(s => { s.events[0].href = 'javascript:alert(1)'; }, /lien interne/);
refuse(s => { s.chains[0].steps = [{ label: 'seul' }]; }, /deux à quatre/);
refuse(s => { s.events[0].date = '2026-02-30'; }, /date ISO invalide/);

// 4. Échappement : un libellé ne peut pas injecter de balise.
{
  const spec = base(); spec.events[2].label = '<img src=x onerror=alert(1)>';
  const html = renderEventTimeline(spec);
  assert(!html.includes('<img'));
}

// 5. Jour de Paris d'un instant : 20:00 à New York le 28 tombe le 29 à Paris.
assert.strictEqual(parisDateOf('2026-10-28T20:00:00-04:00'), '2026-10-29');
assert.strictEqual(parisDateOf('2026-10-28'), '2026-10-28');
assert.strictEqual(parisDateOf('28 octobre'), null);
assert.strictEqual(renderCalendarLabel('2026-11-01', 'axis'), '1 dim.');
assert.strictEqual(renderCalendarLabel('2026-11-01', 'day_month_year'), '1er novembre 2026');

console.log('event timeline tests: PASS');
