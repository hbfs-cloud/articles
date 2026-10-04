#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { renderValue } = require('../../tools/validate-content-claims');

const ROOT = path.resolve(__dirname, '../..');
const REL = 'weekly/20261005';
const DIR = path.join(ROOT, REL);
const read = rel => JSON.parse(fs.readFileSync(path.join(DIR, rel), 'utf8'));
const digest = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const esc = s => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const sources = {
  indices: '_data/bars_indices.json', sectors: '_data/bars_sectors.json', crypto: '_data/bars_crypto.json',
  regime: '_data/regime.json', options: '_data/options_sentiment.json',
  earnings: '_data/earnings_calendar.json', economic: '_data/economic_events.json',
  focus: '_focus/focus_bars.json', flows: '_focus/focus_flows.json', events: '_focus/focus_events.json',
  blastA: '_focus/blast_bars_a.json', blastB: '_focus/blast_bars_b.json'
};
const D = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, read(v)]));
const artifact = key => `${REL}/${sources[key]}`;
const REF = '2026-10-02';
const START = '2026-09-25';

function walk(node, pred, ptr = '') {
  if (pred(node)) return { node, ptr };
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) { const hit = walk(node[i], pred, `${ptr}/${i}`); if (hit) return hit; }
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { const hit = walk(v, pred, `${ptr}/${esc(k)}`); if (hit) return hit; }
  }
  return null;
}
function all(node, pred, ptr = '', out = []) {
  if (pred(node)) out.push({ node, ptr });
  if (Array.isArray(node)) node.forEach((v, i) => all(v, pred, `${ptr}/${i}`, out));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => all(v, pred, `${ptr}/${esc(k)}`, out));
  return out;
}
function barHit(symbol) {
  for (const key of ['indices', 'sectors', 'crypto', 'focus', 'blastA', 'blastB']) {
    const hit = walk(D[key], x => x && x.symbol === symbol && Array.isArray(x.bars) && x.bars.length);
    if (hit) return { ...hit, key };
  }
  throw new Error(`barres absentes: ${symbol}`);
}
function eventHit(symbol) {
  const hit = walk(D.earnings, x => x && x.symbol === symbol && x.report_date);
  if (!hit) throw new Error(`publication absente: ${symbol}`);
  return { ...hit, key: 'earnings' };
}
function econOn(name, day) {
  const hit = walk(D.economic, x => x && x.name === name && typeof x.event_time === 'string' && x.event_time.slice(0, 10) === day);
  if (!hit) throw new Error(`macro absent: ${name} ${day}`);
  return { ...hit, key: 'economic' };
}
function objectHit(key, pred, label) {
  const hit = walk(D[key], pred);
  if (!hit) throw new Error(`${label} absent`);
  return { ...hit, key };
}

const claims = [];
const literals = new Set();
let seq = 0;
function claim(key, pointer, value, render, stem = 'c', formula) {
  const rendered = renderValue(formula ? formula.result : value, render);
  if (rendered == null) throw new Error(`rendu impossible ${stem}: ${JSON.stringify(value)} ${JSON.stringify(render)}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const row = { id, rendered_text: rendered, source_artifact: artifact(key), source_sha256: digest(artifact(key)), source_pointer: pointer, source_value: value, render };
  if (formula) row.formula = formula;
  claims.push(row);
  return `<span data-claim="${id}">${rendered}</span>`;
}
const lit = value => { literals.add(String(value)); return `<span data-literal>${value}</span>`; };
function registryClaim(pointer, value, render, stem, authority) {
  const rel = 'data/scheduled-events.json';
  const rendered = renderValue(value, render);
  if (rendered == null) throw new Error(`rendu registre impossible ${stem}`);
  const id = `${stem}_${++seq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  claims.push({ id, rendered_text: rendered, source_artifact: rel, source_sha256: digest(rel), source_pointer: pointer, source_value: value, render, authority });
  return `<span data-claim="${id}">${rendered}</span>`;
}
const fomcDecision = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scheduled-events.json'), 'utf8')).events[6];
if (!fomcDecision || fomcDecision.date !== '2026-10-28' || fomcDecision.id !== 'fomc') throw new Error('registre FOMC décalé');
const n = (key, pointer, value, decimals = 1, suffix = '', stem = 'n', sign) => claim(key, pointer, value, { scale: 1, decimals, suffix, format: 'fr', ...(sign ? { sign: 'always' } : {}) }, stem);
const pct = (key, pointer, value, decimals = 1, stem = 'p') => claim(key, pointer, value, { scale: 100, decimals, suffix: ' %', format: 'fr' }, stem);
const dt = (key, pointer, value, parts = 'weekday_day_month', stem = 'date') => claim(key, pointer, value, { format: 'fr_date', parts }, stem);
const tm = (key, pointer, value, zone = 'America/New_York', stem = 'time') => claim(key, pointer, value, { format: 'fr_time', zone }, stem);

function perf(symbol, startDate, decimals = 1, stem = 'perf') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = b.findIndex(x => x[0] === startDate);
  if (b[i][0] !== REF) throw new Error(`${symbol}: dernière barre ${b[i][0]}`);
  if (j < 0 || j >= i) throw new Error(`${symbol}: base ${startDate} absente`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function perfBack(symbol, sessions, decimals = 1, stem = 'm') {
  const h = barHit(symbol), b = h.node.bars, i = b.length - 1, j = i - sessions;
  if (j < 0) throw new Error(`${symbol}: fenêtre ${sessions} impossible`);
  const value = (b[i][4] / b[j][4] - 1) * 100;
  return claim(h.key, `${h.ptr}/bars/${i}/4`, b[i][4], { scale: 1, decimals, suffix: ' %', sign: 'always', format: 'fr' }, `${stem}_${symbol}`, {
    operation: 'ratio_pct', numerator_pointer: `${h.ptr}/bars/${i}/4`, denominator_pointer: `${h.ptr}/bars/${j}/4`, result: value
  });
}
function close(symbol, decimals = 2) {
  const h = barHit(symbol), i = h.node.bars.length - 1, v = h.node.bars[i][4];
  return n(h.key, `${h.ptr}/bars/${i}/4`, v, decimals, ' $', `close_${symbol}`);
}
function barDate(symbol, date, parts = 'weekday_day_month', stem = 'bdate') {
  const h = barHit(symbol), b = h.node.bars, j = b.findIndex(x => x[0] === date);
  if (j < 0) throw new Error(`${symbol}: date ${date} absente`);
  return dt(h.key, `${h.ptr}/bars/${j}/0`, b[j][0], parts, `${stem}_${symbol}`);
}
const perfValue = (symbol, startDate = START) => {
  const b = barHit(symbol).node.bars, i = b.length - 1, j = b.findIndex(x => x[0] === startDate);
  return (b[i][4] / b[j][4] - 1) * 100;
};
const chartSeries = symbol => {
  const b = barHit(symbol).node.bars.filter(x => x[0] >= START);
  const base = b[0][4];
  return b.map(x => [x[0], +(x[4] / base * 100).toFixed(3)]);
};

const labels = {
  SPY: 'S&P', QQQ: 'Nasdaq', IWM: 'Russell', DIA: 'Dow', GLD: 'Or', SLV: 'Argent', TLT: 'Obligations longues', USO: 'Pétrole',
  XLK: 'Technologie', XLB: 'Matériaux', XLF: 'Finance', XLV: 'Santé', XLI: 'Industrie', XLY: 'Consommation discrétionnaire',
  XLP: 'Consommation de base', XLU: 'Services collectifs', XLC: 'Communication', XLRE: 'Immobilier',
  IBIT: 'Bitcoin', ETHA: 'Ethereum', SOLZ: 'Solana',
  PEP: 'PepsiCo', DAL: 'Delta', STZ: 'Constellation', RPM: 'RPM', JPM: 'JPMorgan', DHI: 'D.R. Horton', NEM: 'Newmont',
  BAC: 'Bank of America', GS: 'Goldman Sachs', MS: 'Morgan Stanley', SCHW: 'Charles Schwab', BLK: 'BlackRock', WFC: 'Wells Fargo',
  LEN: 'Lennar', PHM: 'Pulte', NVR: 'NVR', TOL: 'Toll', AEM: 'Agnico', FNV: 'Franco-Nevada'
};

const regimeRoot = objectHit('regime', x => x && x.dtx_regime && x.dtx_detail === undefined && x.probabilities, 'régime');
const regime = regimeRoot.node.dtx_regime;
const outerPtr = regimeRoot.ptr;
const term = all(D.options, x => x && x.tenor && typeof x.level === 'number').sort((a, b) => String(a.ptr).localeCompare(String(b.ptr), undefined, { numeric: true }));
if (term.length < 2) throw new Error('courbe de volatilité incomplète');

const earnMeta = {
  RPM: { when: 'avant ouverture', role: 'Revêtements' },
  STZ: { when: 'après clôture', role: 'Boissons' },
  PEP: { when: 'avant ouverture', role: 'Consommation de base' },
  DAL: { when: 'avant ouverture', role: 'Compagnie aérienne' }
};

function siHit(symbol) {
  const hit = walk(D.flows, x => x && x.symbol === symbol && x.type === 'instrument_short_interest_series' && Array.isArray(x.points) && x.points.length);
  if (!hit) throw new Error(`short absent: ${symbol}`);
  const i = hit.node.points.length - 1;
  return { ...hit, key: 'flows', i, point: hit.node.points[i], floatPtr: `${hit.ptr}/points/${i}/short_pct_float`, datePtr: `${hit.ptr}/points/${i}/settlement_date` };
}
function filingUnder(symbol, form) {
  const parents = all(D.events, x => x && x.symbol === symbol && x.data);
  for (const parent of parents) {
    const inner = walk(parent.node, x => x && x.form === form && typeof x.filingDate === 'string');
    if (inner) return { ...inner, key: 'events', ptr: `${parent.ptr}${inner.ptr}` };
  }
  throw new Error(`${form} absent: ${symbol}`);
}
const shelf = filingUnder('DAL', 'S-3ASR');
const siPep = siHit('PEP');
const siStz = siHit('STZ');

const macroCards = [
  ['2026-10-05', 'ISM Services PMI', 'Activité des services'],
  ['2026-10-06', 'Federal Reserve Speech - Vice Chair for Supervision Michelle W. Bowman: Modernizing Regulation and Supervision', 'Discours de Michelle Bowman'],
  ['2026-10-07', 'FOMC Minutes', 'Compte rendu du FOMC'],
  ['2026-10-08', 'Initial Jobless Claims', 'Inscriptions au chômage'],
  ['2026-10-08', 'Federal Reserve Speech - Governor Christopher J. Waller: Economic Outlook', 'Discours de Christopher Waller'],
  ['2026-10-08', 'ECB Monetary Policy Account', 'Compte rendu de la BCE'],
  ['2026-10-09', 'Michigan Consumer Sentiment (prelim)', 'Confiance Michigan, estimation']
].map(([day, name, label]) => ({ day, label, h: econOn(name, day) }));
const stamp = (card, kind) => kind === 'date'
  ? dt('economic', `${card.h.ptr}/event_time`, card.h.node.event_time, 'weekday_day_month', 'macro_date')
  : tm('economic', `${card.h.ptr}/event_time`, card.h.node.event_time, 'America/New_York', 'macro_time');
const fomc = macroCards.find(x => x.label.startsWith('Compte rendu du FOMC'));
const cpi = econOn('Consumer Price Index (CPI)', '2026-10-14');

function chart(id, title, note) {
  return `<figure class="chart-card"><h3>${title}</h3><div id="${id}" class="echart-box" style="width:100%;height:360px"></div><figcaption><strong>Lecture :</strong> ${note}</figcaption></figure>`;
}
function section(id, icon, title, body) { return `<section id="${id}" class="report-section"><h2><i class="fas ${icon}"></i> ${title}</h2>${body}</section>`; }
function card(body, cls = 'insight-card') { return `<div class="${cls}">${body}</div>`; }
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const badge = (text, tone = 'blue') => `<span class="badge badge-${tone}">${text}</span>`;
const weekRows = syms => syms.map(s => [s, perfValue(s)]);

const sections = [];
const scorePtr = `${outerPtr}/dtx_regime/regime_score`;
const vixPtr = `${outerPtr}/dtx_regime/dtx_detail/vix_level`;
const vixAvgPtr = `${outerPtr}/dtx_regime/dtx_detail/vix_sma14`;

sections.push(section('verdict', 'fa-flag-checkered', 'Verdict',
  `<div class="decision-banner" data-status="ATTENDRE"><div class="decision-label">DÉCISION</div><div class="decision-value">NE RIEN AJOUTER AVANT LE COMPTE RENDU DE MERCREDI</div><p>La semaine écoulée a laissé l’indice presque plat et a vendu la durée : obligations longues, or, argent, banques et logement. Le compte rendu du FOMC, ${stamp(fomc, 'date')} à ${stamp(fomc, 'time')} heure de New York, dit si cette vente était le bon prix. Le régime reste en reprise, score ${pct('regime', scorePtr, regime.regime_score, 0, 'regime_score')}, mais la confiance du scénario risk-on n’est que ${pct('regime', `${outerPtr}/current_state_confidence`, regimeRoot.node.current_state_confidence, 1, 'state_conf')}. Ajouter du risque avant le texte, c’est parier sur une phrase qu’on n’a pas lue.</p></div>`
  + `<div class="stats-grid">${card(`<span class="stat-label">Volatilité comptant</span><strong>${n('regime', vixPtr, regime.dtx_detail.vix_level, 2, '', 'vix_verdict')}</strong>`)}${card(`<span class="stat-label">S&P sur la semaine</span><strong>${perf('SPY', START)}</strong>`)}${card(`<span class="stat-label">Technologie sur la semaine</span><strong>${perf('XLK', START)}</strong>`)}</div>`));

sections.push(section('fab', 'fa-crosshairs', 'Ce qui mérite une action',
  `<div class="scenario-grid">${card(`<h3>Avant mercredi</h3><p>Garder le cash. Le complexe déjà vendu — banques, logement, or — peut encore s’écarter à la publication du compte rendu. La technologie, elle, a tenu : attendre a un coût de ce côté-là, et il faut le nommer.</p>`)}${card(`<h3>Après le texte</h3><p>Regarder si JPMorgan, D.R. Horton et l’or prolongent le mouvement ou le rendent. Une surprise accommodante dans un complexe déjà baisse serait le rattrapage. Un texte ferme qui ne fait plus baisser ces prix serait un non-événement.</p>`)}${card(`<h3>Jeudi, à part</h3><p>PepsiCo publie avant l’ouverture. C’est la lecture du consommateur de base, pas un substitut au compte rendu. On ne mélange pas ces décisions.</p>`)}</div>`));

sections.push(section('alerte', 'fa-triangle-exclamation', 'Alerte données',
  `<div class="alert-box" data-status="VALIDÉ"><strong>VALIDÉ.</strong> Les prix de cette édition sont les clôtures certifiées du ${barDate('SPY', REF, 'full', 'refdate')}. Les variations de la semaine partent de la clôture du ${barDate('SPY', START, 'full', 'start')}. Le filtre des très grandes publications d’entreprise est vide sur la semaine du ${lit('5 au 9 octobre 2026')}. Le compte rendu du FOMC apparaît en double dans le calendrier, au même horaire : une seule occurrence est retenue. L’intérêt vendeur est arrêté au ${dt('flows', siPep.datePtr, siPep.point.settlement_date, 'full', 'si_date')}, pas à la clôture de vendredi.</div>`));

sections.push(section('agenda', 'fa-calendar-week', 'Agenda de la semaine',
  `<p>Lundi, l’ISM des services ouvre. Mardi, RPM et Constellation publient, et Michelle Bowman parle. Mercredi à ${stamp(fomc, 'time')}, le compte rendu. Jeudi empile PepsiCo, les inscriptions au chômage, Christopher Waller et le compte de la BCE. Vendredi, Delta et l’estimation Michigan.</p>`
  + `<div class="scenario-grid" aria-label="Rendez-vous de la semaine">${macroCards.map(x => card(`<div class="stat-label">${stamp(x, 'date')} · ${stamp(x, 'time')}</div><h3>${x.label}</h3>`)).join('')}</div>`
  + chart('calendarChart', 'Où se concentrent les rendez-vous', 'Jeudi empile le plus de lectures. Mercredi n’en porte qu’un, et c’est celui qui peut déplacer tout le complexe de taux. Invalidation : un report officiel du compte rendu.')));

sections.push(section('executive-summary', 'fa-list-check', 'Synthèse exécutive',
  `<ul class="key-list"><li>L’indice large finit à ${perf('SPY', START)}, le Nasdaq à ${perf('QQQ', START)}, le Dow à ${perf('DIA', START)}. La technologie fait ${perf('XLK', START)} ; la santé ${perf('XLV', START)} et la finance ${perf('XLF', START)}.</li><li>La durée a été vendue : obligations longues ${perf('TLT', START)}, or ${perf('GLD', START)}, argent ${perf('SLV', START)}. Le pétrole, ${perf('USO', START)}, n’a pas suivi.</li><li>Le comptant de volatilité, ${n('regime', vixPtr, regime.dtx_detail.vix_level, 2, '', 'vix_spot')}, reste sous sa moyenne mobile, ${n('regime', vixAvgPtr, regime.dtx_detail.vix_sma14, 2, '', 'vix_avg')}, et ne monte pas. La courbe des échéances, elle, monte : ${n('options', `${term[0].ptr}/level`, term[0].node.level, 2, '', 'vc_short')} sur le plus court, ${n('options', `${term.at(-1).ptr}/level`, term.at(-1).node.level, 2, '', 'vc_long')} sur le plus long.</li><li>Sur ${lit('21 séances')}, la technologie fait ${perfBack('XLK', 21)} pendant que PepsiCo fait ${perfBack('PEP', 21)} et Constellation ${perfBack('STZ', 21)}. La hausse et la baisse ne sont pas dans les mêmes titres.</li></ul>`));

sections.push(section('bilan', 'fa-clock-rotate-left', 'Bilan de la semaine écoulée',
  `<p>L’édition précédente ne publiait aucun trade : la consigne était d’attendre l’inflation, l’activité et l’emploi. Ce dossier ne qualifie pas ces chiffres. Le calendrier donne leur date, pas l’écart au consensus, et le prix ne remplace pas la publication. Ce qui est mesuré, c’est la séance d’après.</p>`
  + `<p>Le S&P termine à ${perf('SPY', START)}, le Russell à ${perf('IWM', START)}. Le mouvement utile est ailleurs : le Dow à ${perf('DIA', START)}, les financières à ${perf('XLF', START)}, l’immobilier à ${perf('XLRE', START)}. Attendre n’a rien coûté sur l’indice. Attendre a évité d’être acheteur de durée. Attendre a coûté la poursuite de la technologie, à ${perf('XLK', START)} sur la semaine et ${perfBack('XLK', 21, 1, 'm2')} sur ${lit('21 séances')}.</p>`
  + chart('crossAssetChart', 'Semaine écoulée, base au vendredi précédent', 'Le Nasdaq tient, le Dow et la durée non. Invalidation de cette lecture : un rattrapage simultané du Dow, des obligations longues et de l’or dès lundi.')));

sections.push(section('macro', 'fa-landmark', 'Macro et taux',
  `<p>Le régime systématique est en reprise. Le score vaut ${pct('regime', scorePtr, regime.regime_score, 0, 'regime_score_b')}. L’état courant est risk-on avec une confiance de ${pct('regime', `${outerPtr}/current_state_confidence`, regimeRoot.node.current_state_confidence, 1, 'state_conf_b')}. Sur l'horizon de ${n('regime', `${outerPtr}/horizon_days`, regimeRoot.node.horizon_days, 0, ' j', 'horizon_macro')}, le modèle affiche un rendement attendu du S&P de ${n('regime', `${outerPtr}/expected_return_spy_pct`, regimeRoot.node.expected_return_spy_pct, 2, ' %', 'er_spy')} et un drawdown attendu de ${n('regime', `${outerPtr}/expected_drawdown_pct`, regimeRoot.node.expected_drawdown_pct, 2, ' %', 'dd_spy')}. Le rendement espéré est plus petit que le repli espéré : ce n’est pas une invitation à charger.</p>`
  + `<p>La transition que projette le modèle laisse ${pct('regime', `${outerPtr}/transition_5d/risk_on`, regimeRoot.node.transition_5d.risk_on, 1, 'tr_on')} sur le maintien du risk-on, ${pct('regime', `${outerPtr}/transition_5d/neutral`, regimeRoot.node.transition_5d.neutral, 1, 'tr_neu')} sur le neutre, ${pct('regime', `${outerPtr}/transition_5d/early_risk_off`, regimeRoot.node.transition_5d.early_risk_off, 1, 'tr_ero')} sur le début de risk-off et ${pct('regime', `${outerPtr}/transition_5d/crisis`, regimeRoot.node.transition_5d.crisis, 1, 'tr_cr')} sur la crise. Le libellé risk-on est donc mince.</p>`
  + `<div class="pedagogy-box"><h4>Ce que le compte rendu est, et n’est pas</h4><p>Le compte rendu décrit la réunion déjà tenue. Il ne fixe pas un nouveau taux. La prochaine décision de taux tombe le ${registryClaim('/events/6/date', fomcDecision.date, { format: 'fr_date', parts: 'weekday_day_month' }, 'fomc_decision', 'fomc')}, hors de cette semaine. On y cherche les désaccords, s’il y en a : qui voulait attendre, qui voulait serrer, et le poids de l’emploi et de l’inflation. Le marché a déjà voté avec les prix de la semaine écoulée. Le texte confirme ce vote, ou il le contredit. Dans le premier cas, la baisse de la durée peut continuer. Dans le second, le rattrapage part des prix déjà soldés, pas d’un sommet.</p></div>`
  + chart('volChart', 'Volatilité par échéance', 'Le court est bon marché, le long se paie. Cohérent avec un choc daté au milieu de la semaine, pas avec une panique déjà là. Invalidation : le comptant repasse au-dessus de sa moyenne, ou la courbe s’inverse.')));

sections.push(section('metaux', 'fa-coins', 'Métaux et matières premières',
  `<p>L’or finit la semaine à ${perf('GLD', START)}, clôture ${close('GLD')}. L’argent fait ${perf('SLV', START)}, clôture ${close('SLV')}. Le pétrole coté via le véhicule USO fait ${perf('USO', START)}. L’or et l’argent ont pris le mouvement de taux de plein fouet ; le pétrole non. Newmont, le producteur, fait ${perf('NEM', START)} et clôture à ${close('NEM')}. Agnico fait ${perf('AEM', START)}, Franco-Nevada ${perf('FNV', START)}.</p>`
  + chart('metalsChart', 'Or, argent, pétrole', 'L’or et l’argent baissent ensemble, le pétrole non. Invalidation : or et argent qui rebondissent ensemble jeudi sans que les obligations longues suivent, ou l’inverse.')));

sections.push(section('crypto', 'fa-bitcoin-sign', 'Crypto',
  `<p>Bitcoin, via son véhicule coté, fait ${perf('IBIT', START)}. Ethereum fait ${perf('ETHA', START)}, Solana ${perf('SOLZ', START)}. Sur ${lit('21 séances')}, Bitcoin fait ${perfBack('IBIT', 21)} et Solana ${perfBack('SOLZ', 21)}. La semaine n’a pas cassé la hiérarchie : le plus spéculatif a rendu, le plus gros a tenu. Ce n’est pas une confirmation du régime, c’est une dispersion.</p>`
  + `<div class="pedagogy-box"><h4>Pourquoi le crypto ne tranche pas mercredi</h4><p>Ces véhicules suivent le coût de l’argent et l’appétit pour le risque, avec plus de bruit que les banques. Un compte rendu ferme peut les faire baisser sans rien apprendre sur le crédit. On les lit après les banques et l’or, pas à la place.</p></div>`
  + chart('cryptoChart', 'Véhicules crypto, semaine écoulée', 'Bitcoin tient, Solana rend. Invalidation : Bitcoin, Ethereum et Solana sous leur clôture du vendredi précédent en même temps que le Nasdaq.')));

const earnOrder = ['PEP', 'DAL', 'STZ', 'RPM'];
const earnRows = earnOrder.map(s => {
  const h = eventHit(s);
  return [labels[s], dt('earnings', `${h.ptr}/report_date`, h.node.report_date, 'weekday_day_month', `earn_date_${s}`), earnMeta[s].when, n('earnings', `${h.ptr}/implied_move_pct`, h.node.implied_move_pct, 1, ' %', `earn_move_${s}`), n('earnings', `${h.ptr}/market_cap_b`, h.node.market_cap_b, 0, ' Md$', `earn_cap_${s}`)];
});
const pep = eventHit('PEP');
const dal = eventHit('DAL');
sections.push(section('earnings', 'fa-building', 'Résultats : PepsiCo, pas une mégacapitalisation',
  `<p>Aucune publication au-dessus du seuil des très grandes capitalisations n’est datée cette semaine. PepsiCo est la plus grosse du calendrier filtré : ${n('earnings', `${pep.ptr}/market_cap_b`, pep.node.market_cap_b, 0, ' Md$', 'pep_cap')}, jeudi avant l’ouverture, amplitude implicite ${n('earnings', `${pep.ptr}/implied_move_pct`, pep.node.implied_move_pct, 1, ' %', 'pep_move')}. Le titre clôture à ${close('PEP')}, soit ${perf('PEP', START)} sur la semaine et ${perfBack('PEP', 21, 1, 'mpep')} sur ${lit('21 séances')}. Constellation, plus petite, a rendu davantage sur la même fenêtre : ${perfBack('STZ', 21, 1, 'mstz')}.</p>`
  + `<p>Delta publie vendredi avant l’ouverture. Amplitude implicite ${n('earnings', `${dal.ptr}/implied_move_pct`, dal.node.implied_move_pct, 1, ' %', 'dal_move')}, capitalisation ${n('earnings', `${dal.ptr}/market_cap_b`, dal.node.market_cap_b, 0, ' Md$', 'dal_cap')}. Un enregistrement ${lit('S-3ASR')}, déposé le ${dt('events', `${shelf.ptr}/filingDate`, shelf.node.filingDate, 'full', 'dal_shelf')}, ouvre une capacité d’émission. Le snapshot n’en donne pas le montant restant. Ce n’est pas une dilution déjà constatée. C’est une capacité ouverte, non chiffrée ici, à ne pas oublier si le titre s’envole après les chiffres.</p>`
  + `<p>L’intérêt vendeur déclaré reste modeste. PepsiCo : ${n('flows', siPep.floatPtr, siPep.point.short_pct_float, 1, ' %', 'si_pep')} du flottant. Constellation, le plus élevé des relevés de ce dossier : ${n('flows', siStz.floatPtr, siStz.point.short_pct_float, 1, ' %', 'si_stz')}. Rien qui ressemble à un squeeze.</p>`
  + table(['Titre', 'Date', 'Moment', 'Mouvement attendu', 'Capitalisation'], earnRows)
  + chart('earningsChart', 'Amplitude implicite des publications datées', 'Delta et Constellation portent plus de mouvement attendu que PepsiCo. PepsiCo porte le poids. Invalidation : échéance d’options déplacée, ou date officielle modifiée.')));

sections.push(section('geopolitics', 'fa-globe', 'Géopolitique',
  `<p>Le calendrier collecté ne date aucun choc géopolitique sur la semaine. Le canal qui compterait, le pétrole, fait ${perf('USO', START, 1, 'uso2')}. Tant que ce prix ne bouge pas, un récit géopolitique ne pilote ni le scénario ni l’allocation. Les cotes de prédiction du snapshot sont des matchs et des élections. Elles ne disent rien sur la Fed.</p>`));

const sectorSyms = ['XLK', 'XLU', 'XLI', 'XLY', 'IWM', 'XLB', 'XLP', 'XLRE', 'XLC', 'XLF', 'XLV'].filter((s, i, a) => a.indexOf(s) === i);
const sectorOrder = ['XLK', 'XLB', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLC', 'XLRE'].slice().sort((a, b) => perfValue(a) - perfValue(b));
sections.push(section('rotation', 'fa-arrows-rotate', 'Rotation sectorielle',
  `<p>La technologie, à ${perf('XLK', START, 1, 'xlk2')}, et les services collectifs, à ${perf('XLU', START)}, sont les seuls grands secteurs verts. Le reste est rouge. La santé est dernière à ${perf('XLV', START, 1, 'xlv2')}, la finance juste devant à ${perf('XLF', START, 1, 'xlf2')}. Ce n’est pas une rotation large vers le cyclique. C’est une tenue de la technologie, et une vente de ce qui dépend du taux ou du consommateur.</p>`
  + `<div class="pedagogy-box"><h4>Lire la tenue de la technologie pour ce qu’elle est</h4><p>Un secteur qui monte pendant que les banques et l’or baissent n’annonce pas que « le marché » va bien. Il annonce que le marché est fendu. Acheter l’indice, c’est acheter la technologie et le reste en même temps. La semaine prochaine, le compte rendu parle au morceau taux. Il ne répare pas, à lui seul, le morceau qui a déjà monté.</p></div>`
  + chart('sectorChart', 'Secteurs, du plus faible au plus fort', 'La technologie est seule en haut. Invalidation : finance, santé et immobilier qui repassent verts ensemble sans que la technologie rende.')));

sections.push(section('risks', 'fa-shield-halved', 'Matrice des risques',
  table(['Risque', 'Signal actuel', 'Conséquence', 'Invalidation'], [
    ['Compte rendu du FOMC', `${stamp(fomc, 'date')} à ${stamp(fomc, 'time')}`, 'Écart possible sur banques, logement, or et obligations', 'Texte sans suite dans ces prix jeudi'],
    ['Durée déjà vendue', `TLT ${perf('TLT', START, 1, 'tlt2')}, or ${perf('GLD', START, 1, 'gld2')}`, 'Le rattrapage, s’il vient, part de prix bas', 'Nouvelle jambe de baisse après un texte ferme'],
    ['PepsiCo', `${perf('PEP', START, 1, 'pep2')} sur la semaine`, 'Lecture du consommateur, séparée du taux', 'Date ou amplitude officielle modifiée'],
    ['Confiance du régime', pct('regime', `${outerPtr}/current_state_confidence`, regimeRoot.node.current_state_confidence, 1, 'state_conf_c'), 'Ne pas traiter le libellé risk-on comme un feu vert', 'Confiance qui se resserre après les minutes'],
    ['Capacité Delta', lit('S-3ASR') + ' déposé, montant absent', 'Ne pas lire une hausse post-chiffres comme un bilan fermé', 'Montant résiduel publié par la société']
  ])));

sections.push(section('allocation', 'fa-chart-pie', 'Allocation tactique',
  `<div class="allocation-grid">${card(`<h3>Cash</h3><p>Prioritaire jusqu’après le compte rendu. Le drawdown attendu du modèle dépasse le rendement attendu sur l’horizon de ${n('regime', `${outerPtr}/horizon_days`, regimeRoot.node.horizon_days, 0, ' j', 'horizon')}.</p>`)}${card(`<h3>Actions</h3><p>La technologie a mené, et les services collectifs ont aussi fini verts. On ne poursuit ni la technologie ni les services collectifs avant le compte rendu. On ne vend pas la technologie sur un texte qui ne la concerne qu’à travers le taux.</p>`)}${card(`<h3>Durée et or</h3><p>Déjà en baisse. Ce sont les prix à regarder mercredi, pas des lignes à renforcer avant le texte. Aucune corrélation longue n’est revendiquée.</p>`)}</div>`
  + chart('regimeChart', 'Composantes du régime', 'La volatilité porte le score. Le reste est moyen. Invalidation : sortie du régime de reprise, ou comptant au-dessus de sa moyenne.')));

sections.push(section('trades', 'fa-scale-balanced', 'Trades de la semaine',
  `<h3>Bilan de la consigne précédente</h3><p>Aucun ordre n’avait été publié. Le résultat de cette attente est dans le bilan : indice plat, durée en baisse, technologie en hausse. Il n’y a pas de gain ou de perte de trade à comptabiliser.</p>`
  + `<div class="alert-box" data-status="no_setup"><strong>Pas de configuration exploitable.</strong> Aucun plan directionnel ne passe avant le compte rendu. Une entrée lundi ou mardi achète une phrase de mercredi. Les niveaux de clôture — JPMorgan ${close('JPM')}, D.R. Horton ${close('DHI')}, Newmont ${close('NEM')}, PepsiCo ${close('PEP', 2)} — sont des références, pas des ordres. L’action est d’attendre la clôture de jeudi, après le texte et après PepsiCo.</div>`));

const chain = [
  ['JPM', 'Banque, transmission directe du taux', 'focus'],
  ['BAC', 'Crédit à la consommation', 'blast'],
  ['WFC', 'Crédit immobilier des ménages', 'blast'],
  ['GS', 'Banque de marché', 'blast'],
  ['MS', 'Courtage et gestion', 'blast'],
  ['SCHW', 'Liquidités des clients retail', 'blast'],
  ['BLK', 'Valorisation des portefeuilles de durée', 'blast'],
  ['DHI', 'Constructeur, taux hypothécaire', 'focus'],
  ['LEN', 'Constructeur', 'blast'],
  ['PHM', 'Constructeur', 'blast'],
  ['NVR', 'Constructeur', 'blast'],
  ['TOL', 'Constructeur haut de gamme', 'blast'],
  ['NEM', 'Producteur d’or', 'focus'],
  ['AEM', 'Producteur d’or, pair', 'blast'],
  ['FNV', 'Redevances or', 'blast']
];
sections.push(section('themes', 'fa-diagram-project', 'Rayon de propagation',
  `<p>Le compte rendu ne se lit pas sur un seul titre. Les banques disent le crédit et la marge. Les constructeurs disent le taux hypothécaire. Les mineurs disent si la baisse de l’or était le métal ou un producteur. PepsiCo, à part, dit le consommateur jeudi matin.</p>`
  + table(['Titre', 'Lien avec le compte rendu', 'Semaine', lit('21 séances')], chain.map(([s, role]) => [labels[s], role, perf(s, START, 1, 'ch'), perfBack(s, 21, 1, 'chm')]))
  + `<div class="pedagogy-box"><h4>Ce que la chaîne a déjà fait</h4><p>Elle a baissé groupée. Bank of America fait ${perf('BAC', START)} sur la semaine et ${perfBack('BAC', 21, 1, 'mbac')} sur la fenêtre longue. D.R. Horton fait ${perf('DHI', START, 1, 'dhi2')}. Franco-Nevada fait ${perf('FNV', START, 1, 'fnv2')}, pire que Newmont. Quand les pairs baissent ensemble, le mouvement est le taux, pas une mauvaise nouvelle de société. C’est exactement ce qu’un compte rendu peut confirmer ou casser. Une divergence après le texte — une banque qui rebondit pendant que le logement continue de baisser — dirait que le canal n’est plus unique.</p></div>`
  + chart('blastChart', 'Banques, logement, or : semaine écoulée', 'Presque tout le complexe est rouge. Invalidation : reprise groupée jeudi, qui effacerait la vente de la semaine.')
  + chart('focusChart', 'PepsiCo, JPMorgan, Horton, Newmont, base commune', 'Chaque ligne pose une question différente. Invalidation : si ces lignes partent dans le même sens jeudi, le choc est celui de l’indice, pas seulement celui du taux.')));

sections.push(section('outlook', 'fa-binoculars', 'Perspectives',
  `<div class="scenario-grid">${card(`<h3>Scénario central</h3><p>Le compte rendu ressemble à ce que les prix ont déjà vendu. Banques, logement et or stabilisent. La technologie garde son avance sans accélérer. Action : rien avant jeudi, puis seulement si le complexe vendu a cessé de baisser.</p>`)}${card(`<h3>Scénario haussier pour la durée</h3><p>Le texte est plus souple que la vente de la semaine. Obligations, or et banques rattrapent. Action : le rattrapage se juge à la clôture de jeudi, pas à la première bougie de mercredi.</p>`)}${card(`<h3>Scénario baissier</h3><p>Le texte est plus dur, et les prix déjà bas cassent encore. Le comptant de volatilité repasse au-dessus de sa moyenne. Action, seulement si ce cas est confirmé jeudi : réduire ce qui dépend du taux, sans vendre la technologie sur ce seul motif.</p>`)}</div>`
  + `<div class="pedagogy-box"><h4>Ce qu’il faut surveiller</h4><p>Mercredi, le sens de JPMorgan, de D.R. Horton et de l’or dans l’heure qui suit ${stamp(fomc, 'time')}. Jeudi, si ce sens tient à la clôture, et ce que PepsiCo dit du consommateur à part. Vendredi, Delta est un titre, pas un régime. La semaine d’après, l’indice des prix à la consommation tombe le ${dt('economic', `${cpi.ptr}/event_time`, cpi.node.event_time, 'weekday_day_month', 'cpi_date')} : le compte rendu n’est pas le dernier mot sur l’inflation. Ces scénarios sont un ordre de lecture. Ils n’ont pas de fréquence.</p></div>`));

sections.push(section('sources', 'fa-database', 'Sources et qualité',
  table(['Bloc', 'Statut', 'Limite'], [
    ['Prix et secteurs', badge('VALIDÉ', 'green'), 'Clôture US du ' + barDate('SPY', REF, 'full', 'refdate2')],
    ['Crypto', badge('VALIDÉ', 'green'), 'Dernière clôture complétée du véhicule coté'],
    ['Compte rendu et calendrier', badge('VALIDÉ', 'green'), 'Dates du calendrier collecté ; une occurrence en double retirée'],
    ['Publications d’entreprise', badge('VALIDÉ', 'green'), 'Noms du calendrier filtré, amplitudes implicites comprises'],
    ['Intérêt vendeur', badge('PARTIEL', 'yellow'), 'Règlement au ' + dt('flows', siPep.datePtr, siPep.point.settlement_date, 'full', 'si_date2')],
    ['Shelf Delta', badge('PARTIEL', 'yellow'), 'Date du dépôt connue, montant résiduel absent'],
    ['Chiffres macro passés', badge('INDISPONIBLE', 'yellow'), 'Date connue, écart au consensus non collecté : non qualifié']
  ])
  + `<div class="source-links"><h3>Méthode</h3><p>Chaque variation de semaine part de la clôture du ${barDate('SPY', START, 'full', 'start2')} et finit à la clôture du ${barDate('SPY', REF, 'full', 'refdate3')}. La fenêtre de ${lit('21 séances')} est un décompte de barres, pas un mois civil. Les graphiques reprennent ces mêmes séries. Le catalyseur retenu est le compte rendu du FOMC, parce que le filtre des très grandes publications est vide. Le rayon de propagation sépare les banques, le logement et l’or. PepsiCo reste une lecture distincte, jeudi.</p><p>Une source partielle ne devient pas un zéro. Le montant du shelf Delta n’est pas inventé. L’écart des chiffres de la semaine passée au consensus non plus. Les scénarios n’ont pas de probabilité chiffrée.</p><h3>Références primaires</h3><p><a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm">Réserve fédérale — calendrier du FOMC</a></p><p><a href="https://www.federalreserve.gov/monetarypolicy/fomcminutes.htm">Réserve fédérale — comptes rendus</a></p><p><a href="https://www.pepsico.com/investors">PepsiCo — relations investisseurs</a></p><p><a href="https://www.sec.gov/edgar/browse/?CIK=0000027904">SEC — dépôts Delta Air Lines</a></p><p>Les prix viennent des séries de clôture certifiées arrêtées au ${barDate('SPY', REF, 'full', 'refdate4')}.</p></div><p class="disclaimer">Contenu informatif. Aucune recommandation personnalisée. Un fait qui contredit la thèse change la thèse.</p>`));

if (sections.length !== 18) throw new Error(`sections: ${sections.length}`);

const dayCounts = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map(day => {
  const macros = macroCards.filter(x => x.day === day).length;
  const earns = earnOrder.filter(s => eventHit(s).node.report_date === day).length;
  return macros + earns;
});
const barSpec = syms => ({
  grid: { left: 150, right: 48, top: 16, bottom: 36 },
  xAxis: { type: 'value', name: '%' },
  yAxis: { type: 'category', data: syms.map(s => labels[s]), axisLabel: { fontSize: 11 } },
  series: [{ type: 'bar', data: syms.map(s => ({ value: +perfValue(s).toFixed(2), itemStyle: { color: perfValue(s) >= 0 ? '#15803d' : '#b91c1c' } })), label: { show: true, position: 'right', formatter: '{c} %' } }]
});
const chartSpecs = [
  ['calendarChart', { grid: { left: 40, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.'] }, yAxis: { type: 'value', name: 'rendez-vous' }, series: [{ type: 'bar', data: dayCounts, itemStyle: { color: '#2563eb' } }] }],
  ['crossAssetChart', barSpec(['SPY', 'QQQ', 'IWM', 'DIA', 'TLT', 'GLD', 'SLV', 'USO'])],
  ['volChart', { grid: { left: 48, right: 16, top: 20, bottom: 36 }, xAxis: { type: 'category', data: term.map(x => x.node.tenor) }, yAxis: { type: 'value', scale: true }, series: [{ type: 'line', smooth: true, symbolSize: 8, data: term.map(x => x.node.level), lineStyle: { width: 3, color: '#7c3aed' } }] }],
  ['metalsChart', barSpec(['GLD', 'SLV', 'USO'])],
  ['cryptoChart', barSpec(['IBIT', 'ETHA', 'SOLZ'])],
  ['earningsChart', { grid: { left: 56, right: 36, top: 16, bottom: 36 }, xAxis: { type: 'value', name: '%' }, yAxis: { type: 'category', data: earnOrder }, series: [{ type: 'bar', data: earnOrder.map(s => +eventHit(s).node.implied_move_pct.toFixed(2)), itemStyle: { color: '#ea580c' }, label: { show: true, position: 'right', formatter: '{c} %' } }] }],
  ['sectorChart', barSpec(sectorOrder)],
  ['regimeChart', { radar: { indicator: Object.keys(regime.component_scores).map(k => ({ name: k.toUpperCase(), max: 1 })) }, series: [{ type: 'radar', data: [{ value: Object.values(regime.component_scores).map(x => +Number(x).toFixed(3)), areaStyle: { color: 'rgba(37,99,235,.2)' } }] }] }],
  ['blastChart', barSpec(['JPM', 'BAC', 'WFC', 'GS', 'MS', 'SCHW', 'BLK', 'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'NEM', 'AEM', 'FNV'])],
  ['focusChart', { grid: { left: 48, right: 16, top: 28, bottom: 36 }, legend: { data: ['PEP', 'JPM', 'DHI', 'NEM'] }, xAxis: { type: 'time' }, yAxis: { type: 'value', name: 'base 100', scale: true }, series: ['PEP', 'JPM', 'DHI', 'NEM'].map(s => ({ name: s, type: 'line', smooth: true, symbolSize: 6, data: chartSeries(s) })) }]
].map(([id, spec]) => ({ id, spec }));

const title = 'Le compte rendu de la Fed juge la vente de la durée';
const description = 'Banques, or et obligations ont déjà baissé. Mercredi, le compte rendu dit si ce prix tient. PepsiCo, jeudi, est une autre question.';
const html = `<!doctype html><html lang="fr" dir="ltr" data-level="intermediate" data-tags="us,macro,earnings,financials,gold,crypto,etf" data-tab="weekly"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DailyTickers | ${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20261005/"><meta property="og:type" content="article"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body class="weekly-brief"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">S&eacute;ries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav><main class="report-container"><header class="hero-section"><div class="report-card-meta">Semaine du ${lit('5 au 9 octobre 2026')} · données au ${barDate('SPY', REF, 'full', 'refdate_hero')}</div><h1>${title}</h1><p class="hero-subtitle">${description}</p><div id="article-clickable-tags" class="card-tags"></div></header><nav class="report-jump-nav" aria-label="Sommaire"><a href="#verdict">Verdict</a><a href="#agenda">Agenda</a><a href="#earnings">Résultats</a><a href="#rotation">Rotation</a><a href="#risks">Risques</a><a href="#outlook">Perspectives</a></nav>${sections.join('\n')}</main><div class="fnav"><a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a><a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a><a href="#earnings" title="Résultats"><i class="fas fa-building"></i></a><a href="#rotation" title="Rotation"><i class="fas fa-arrows-rotate"></i></a><a href="#outlook" title="Perspectives"><i class="fas fa-binoculars"></i></a><a href="#sources" title="Sources"><i class="fas fa-database"></i></a></div><footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Not financial advice.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer><script>const CHART_SPECS=${JSON.stringify(chartSpecs)};(function(){if(typeof echarts==='undefined')return;const xs=[];for(const c of CHART_SPECS){const el=document.getElementById(c.id);if(!el)continue;const x=echarts.init(el);x.setOption(Object.assign({animation:false,textStyle:{fontFamily:'Inter,system-ui,sans-serif'},tooltip:{trigger:'axis'}},c.spec));xs.push(x)}addEventListener('resize',()=>xs.forEach(x=>x.resize()))})();</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/echarts-responsive.js"></script></body></html>`;

fs.writeFileSync(path.join(DIR, 'index.html'), html);
const articleSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'index.html'))).digest('hex');
fs.writeFileSync(path.join(DIR, '_data/chart-data.json'), JSON.stringify({ reference_close: REF, start_close: START, chart_specs: chartSpecs }, null, 2) + '\n');
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({ reference_close: REF, article_path: `${REL}/index.html`, article_sha256: articleSha, generated_by: `${REL}/_build.cjs`, literals: [...literals].sort(), claims }, null, 2) + '\n');
console.log(`weekly rendu: ${sections.length} sections, ${chartSpecs.length} graphiques, ${claims.length} claims, ${(html.length / 1024).toFixed(1)} Ko`);
