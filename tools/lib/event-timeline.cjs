'use strict';

// ÉCHÉANCIER — « ce qui peut bouger la Bourse », jour par jour, en heures de Paris.
//
// Format retenu par le propriétaire le 2026-10-26 pour décrire les échéances et le calendrier
// dans TOUS les contenus (daily, weekly, analyse, scanner…) : une frise par semaine, des pastilles
// au-dessus et au-dessous de l'axe, la couleur pour la famille d'événement, le plein ou le contour
// pour l'impact, une fenêtre clé surlignée, puis les chaînes de transmission « si/alors ».
// Spécification et règles éditoriales : `tools/templates/event-timeline.md`.
//
// Le module rend du HTML statique stylé par `/assets/report.css` (classes `evt-tl-*`), sans
// script ni style en ligne. Deux régimes de preuve :
//   - pages contrôlées par `validate-content-claims.js` (daily, weekly) : chaque événement reçoit
//     un `proof`, le HTML d'un claim de date ou d'heure ; le validateur refuse un événement posé
//     sur un jour que son claim ne confirme pas. `requireProof: true` fait échouer le rendu avant.
//   - pages rendues depuis un JSON déjà contrôlé (scanner, analyse) : les dates viennent de ce JSON.
// Dans les deux cas, les étiquettes de jours portent `data-calendar-date` et sont vérifiées.

const { parseIsoDate, renderCalendarLabel, JOURS_COURTS_FR } = require('./fr-calendar');

const CATEGORIES = {
  macro: 'Taux et macro',
  earnings: 'Résultats',
  geo: 'Géopolitique et matières premières',
  market: 'Séance',
  plan: 'Vos lignes',
};
// Liste close d'icônes Font Awesome 6.4 (chargé par toutes les pages). Une icône hors liste est un
// refus : elle n'existerait peut-être pas dans la version servie et laisserait un carré vide.
const ICONS = {
  bank: 'fa-building-columns', data: 'fa-chart-column', chip: 'fa-microchip', company: 'fa-building',
  vote: 'fa-check-to-slot', oil: 'fa-droplet', magnet: 'fa-magnet', ship: 'fa-ship', alert: 'fa-triangle-exclamation',
  hourglass: 'fa-hourglass-half', closed: 'fa-door-closed', exit: 'fa-flag-checkered', entry: 'fa-right-to-bracket',
  coin: 'fa-coins', gavel: 'fa-gavel', globe: 'fa-globe', bolt: 'fa-bolt', pill: 'fa-pills', cart: 'fa-cart-shopping',
};
const DEFAULT_ICON = { macro: 'data', earnings: 'company', geo: 'globe', market: 'hourglass', plan: 'exit' };
const IMPACTS = { strong: 'fort', medium: 'moyen' };
const TONES = { up: ['↑', 'en hausse'], down: ['↓', 'en baisse'] };

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isoOf = date => date.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = parseIsoDate(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
// Lundi = 1 … dimanche = 7 : la frise suit la semaine boursière, pas la semaine américaine.
const weekdayOf = iso => ((parseIsoDate(iso).getUTCDay() + 6) % 7) + 1;
const mondayOf = iso => addDays(iso, 1 - weekdayOf(iso));

function fail(message) { throw new Error(`[event-timeline] ${message}`); }

function calendarLabel(iso, format, inner) {
  const text = renderCalendarLabel(iso, format);
  if (text == null) fail(`date de calendrier invalide : ${iso}`);
  return `<time datetime="${iso}" data-calendar-date="${iso}" data-calendar-format="${format}">${inner || esc(text)}</time>`;
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') fail('spécification absente');
  const { from, to, asof } = spec;
  for (const [name, value] of [['from', from], ['to', to], ['asof', asof]]) {
    if (!parseIsoDate(value) || value.length !== 10) fail(`${name} doit être une date ISO AAAA-MM-JJ (reçu ${value})`);
  }
  if (to < from) fail(`fenêtre inversée : ${from} → ${to}`);
  const days = Math.round((parseIsoDate(to) - parseIsoDate(from)) / 864e5) + 1;
  // Au-delà de trois semaines, la frise devient un agenda illisible : c'est un tableau qu'il faut.
  if (days > 21) fail(`fenêtre de ${days} jours : au plus trois semaines`);
  if (!Array.isArray(spec.events)) fail('events doit être un tableau');
  spec.events.forEach((event, i) => {
    const where = `événement ${i} (${event && event.label})`;
    if (!event || (!event.label && !event.labelHtml)) fail(`${where} : libellé absent`);
    if (!parseIsoDate(event.date) || event.date.length !== 10) fail(`${where} : date ISO invalide`);
    if (event.date < from || event.date > to) fail(`${where} : ${event.date} hors de la fenêtre ${from} → ${to}`);
    if (!CATEGORIES[event.category]) fail(`${where} : catégorie inconnue « ${event.category} » (${Object.keys(CATEGORIES).join(', ')})`);
    if (!IMPACTS[event.impact]) fail(`${where} : impact « ${event.impact} » (strong ou medium ; un événement faible n'a pas sa place sur la frise)`);
    if (event.icon && !ICONS[event.icon]) fail(`${where} : icône inconnue « ${event.icon} »`);
    if (event.side && !['top', 'bottom'].includes(event.side)) fail(`${where} : side vaut top ou bottom`);
    if (spec.requireProof && !event.proof) fail(`${where} : preuve de date absente (claim de date ou d'heure exigé sur cette page)`);
    if (event.href && !/^(#|\/)[^\s"<>]*$/.test(event.href)) fail(`${where} : lien interne attendu (#section ou /chemin)`);
  });
  const key = spec.keyWindow;
  if (key) {
    if (!parseIsoDate(key.from) || !parseIsoDate(key.to) || key.from > key.to) fail('keyWindow : dates invalides');
    if (key.from < from || key.to > to) fail('keyWindow hors de la fenêtre');
    // Une fenêtre clé tient dans une semaine : au-delà, ce n'est plus une fenêtre mais la période.
    if (mondayOf(key.from) !== mondayOf(key.to)) fail('keyWindow à cheval sur deux semaines');
  }
  for (const [i, chain] of (spec.chains || []).entries()) {
    if (!Array.isArray(chain.steps) || chain.steps.length < 2 || chain.steps.length > 4) fail(`chaîne ${i} : de deux à quatre maillons`);
    for (const step of chain.steps) {
      if (!step.label) fail(`chaîne ${i} : maillon sans libellé`);
      if (step.category && !CATEGORIES[step.category]) fail(`chaîne ${i} : catégorie inconnue « ${step.category} »`);
      if (step.icon && !ICONS[step.icon]) fail(`chaîne ${i} : icône inconnue « ${step.icon} »`);
      if (step.tone && !TONES[step.tone]) fail(`chaîne ${i} : tone vaut up ou down`);
    }
  }
  if ((spec.chains || []).length > 4) fail('au plus quatre chaînes : au-delà, aucune ne se lit');
}

function chip(event) {
  const icon = ICONS[event.icon || DEFAULT_ICON[event.category]];
  const label = event.labelHtml || esc(event.label);
  const name = event.href ? `<a href="${esc(event.href)}">${label}</a>` : label;
  const detail = event.detailHtml || (event.detail ? esc(event.detail) : '');
  const proof = event.proof ? `<span class="${event.proofHidden ? 'evt-tl-sr' : 'evt-tl-when'}">${event.proof}</span>` : '';
  const uncertain = event.uncertain ? '<span class="evt-tl-sr">date non confirmée</span>' : '';
  const cls = ['evt-tl-chip', `cat-${event.category}`, `imp-${event.impact}`, event.uncertain ? 'is-uncertain' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" data-calendar-event><i class="fa-solid ${icon}" aria-hidden="true"></i>`
    + `<span class="evt-tl-text"><strong class="evt-tl-name">${name}</strong>${detail ? `<span class="evt-tl-detail">${detail}</span>` : ''}`
    + `${proof}${uncertain}</span><span class="evt-tl-sr">${CATEGORIES[event.category]}, impact ${IMPACTS[event.impact]}</span></div>`;
}

// Côté de chaque pastille. Sans consigne, on remplit le côté le moins chargé de la colonne, et à
// égalité celui que la colonne de gauche a laissé libre : deux pastilles voisines du même côté se
// chevauchent dès que leurs libellés dépassent la largeur d'un jour.
function assignSides(days) {
  let previous = { top: 0, bottom: 0 };
  for (const day of days) {
    day.top = []; day.bottom = [];
    for (const event of day.events) {
      let side = event.side;
      if (!side) {
        if (day.top.length !== day.bottom.length) side = day.top.length < day.bottom.length ? 'top' : 'bottom';
        else side = previous.top > previous.bottom ? 'bottom' : 'top';
      }
      day[side].push(event);
    }
    previous = day.events.length ? { top: day.top.length, bottom: day.bottom.length } : { top: 0, bottom: 0 };
  }
}

function weekLabel(monday, asofMonday) {
  if (monday === asofMonday) return 'Cette semaine';
  if (monday === addDays(asofMonday, 7)) return 'Semaine suivante';
  if (monday === addDays(asofMonday, -7)) return 'Semaine précédente';
  return `Semaine du ${calendarLabel(monday, 'day_month')}`;
}

function renderChains(spec) {
  const chains = spec.chains || [];
  if (!chains.length) return '';
  const step = s => {
    const category = s.category || 'macro';
    const icon = ICONS[s.icon || DEFAULT_ICON[category]];
    const tone = s.tone ? ` <span class="evt-tl-tone" aria-hidden="true">${TONES[s.tone][0]}</span><span class="evt-tl-sr">${TONES[s.tone][1]}</span>` : '';
    return `<li class="evt-tl-step cat-${category}${s.tone ? ` tone-${s.tone}` : ''}"><span class="evt-tl-step-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><span class="evt-tl-step-label">${esc(s.label)}${tone}</span></li>`;
  };
  return `<div class="evt-tl-chains"><p class="evt-tl-section-label">${esc(spec.chainsTitle || 'Les chaînes à surveiller')}</p><ul class="evt-tl-chain-list">`
    + chains.map(c => `<li class="evt-tl-chain">${c.title ? `<p class="evt-tl-chain-title">${esc(c.title)}</p>` : ''}<ol class="evt-tl-steps">${c.steps.map(step).join('')}</ol></li>`).join('')
    + '</ul></div>';
}

function renderEventTimeline(spec) {
  validateSpec(spec);
  const id = spec.id || 'echeancier';
  if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`id invalide : ${id}`);
  const byDate = new Map();
  for (const event of spec.events) {
    if (!byDate.has(event.date)) byDate.set(event.date, []);
    byDate.get(event.date).push(event);
  }
  // Ordre stable dans une journée : l'ordre fourni (chronologique par contrat), jamais un tri
  // alphabétique qui ferait passer la BCE après la Fed un jour où elle décide avant.
  const days = [];
  for (let iso = spec.from; iso <= spec.to; iso = addDays(iso, 1)) days.push({ iso, events: byDate.get(iso) || [] });
  assignSides(days);

  const key = spec.keyWindow;
  const inKey = iso => key && iso >= key.from && iso <= key.to;
  const asofMonday = mondayOf(spec.asof);
  const weeks = [];
  for (const day of days) {
    const monday = mondayOf(day.iso);
    if (!weeks.length || weeks[weeks.length - 1].monday !== monday) weeks.push({ monday, days: [] });
    weeks[weeks.length - 1].days.push(day);
  }

  const stack = (events, side) => {
    if (!events.length) return `<div class="evt-tl-${side}"></div>`;
    // Le pointillé prend la couleur de la pastille la plus proche de l'axe.
    const near = side === 'top' ? events[events.length - 1] : events[0];
    return `<div class="evt-tl-${side} has-events cat-${near.category}">${events.map(chip).join('')}</div>`;
  };
  const dayHtml = day => {
    const wd = weekdayOf(day.iso);
    const cls = ['evt-tl-day', `wd-${wd}`, wd >= 6 ? 'is-weekend' : '', day.events.length ? '' : 'is-empty',
      inKey(day.iso) ? 'is-key' : '', key && day.iso === key.from ? 'is-key-start' : '', key && day.iso === key.to ? 'is-key-end' : '']
      .filter(Boolean).join(' ');
    const date = parseIsoDate(day.iso);
    const node = calendarLabel(day.iso, 'axis', `<b>${date.getUTCDate()}</b> <span>${JOURS_COURTS_FR[date.getUTCDay()]}</span>`);
    return `<li class="${cls}" data-calendar-day="${day.iso}">${stack(day.top, 'top')}<div class="evt-tl-axis">${node}</div>${stack(day.bottom, 'bottom')}</li>`;
  };
  // Le bandeau de la fenêtre clé est un élément de la liste de la semaine, placé dans la grille au-
  // dessus des jours qu'il couvre : il peut ainsi passer à la ligne dans la largeur de la fenêtre au
  // lieu de déborder sur les colonnes voisines.
  const keyLabelHtml = week => {
    if (!key || mondayOf(key.from) !== week.monday) return '';
    return `<li class="evt-tl-keylabel ks-${weekdayOf(key.from)} ke-${weekdayOf(key.to)}">${key.labelHtml || esc(key.label || 'Fenêtre clé')}</li>`;
  };

  const categories = Object.keys(CATEGORIES).filter(c => spec.events.some(e => e.category === c));
  const impacts = [...new Set(spec.events.map(e => e.impact))];
  const legend = `<ul class="evt-tl-legend" aria-label="Légende">${categories.map(c => `<li class="evt-tl-legend-cat cat-${c}">${esc(CATEGORIES[c])}</li>`).join('')}`
    + `${impacts.includes('strong') ? '<li class="evt-tl-legend-imp imp-strong">fort</li>' : ''}${impacts.includes('medium') ? '<li class="evt-tl-legend-imp imp-medium">moyen</li>' : ''}</ul>`;
  const sameYear = spec.from.slice(0, 4) === spec.to.slice(0, 4);
  const period = `du ${calendarLabel(spec.from, sameYear ? 'day_month' : 'day_month_year')} au ${calendarLabel(spec.to, 'day_month_year')}`;
  const titleId = `${id}-titre`;
  // Une semaine sans rendez-vous garde sa frise sur grand écran (le vide est une information) mais
  // disparaît de l'agenda mobile, où elle ne serait qu'un titre suivi de rien.
  const weeksHtml = weeks.map(w => `<div class="evt-tl-week${w.days.some(d => d.events.length || inKey(d.iso)) ? '' : ' is-empty'}">`
    + `<p class="evt-tl-section-label">${weekLabel(w.monday, asofMonday)}</p>`
    + `<ol class="evt-tl-row">${keyLabelHtml(w)}${w.days.map(dayHtml).join('')}</ol></div>`).join('');
  const empty = spec.events.length ? '' : `<p class="evt-tl-empty">${esc(spec.emptyText || 'Aucun rendez-vous daté et vérifié dans la fenêtre.')}</p>`;
  const note = spec.noteHtml || esc(spec.note || 'Si/alors, pas une prévision.');
  return `<figure class="evt-tl" id="${id}" aria-labelledby="${titleId}">`
    + `<div class="evt-tl-head"><div><h3 class="evt-tl-title" id="${titleId}">${esc(spec.title || 'Ce qui peut bouger la Bourse')}</h3>`
    + `<p class="evt-tl-period">${period}</p></div><p class="evt-tl-zone">Heures de Paris</p></div>`
    + legend + empty + weeksHtml + renderChains(spec)
    + `<figcaption class="evt-tl-note">${note}</figcaption></figure>`;
}

module.exports = { renderEventTimeline, validateSpec, CATEGORIES, ICONS, mondayOf, addDays, weekdayOf };
