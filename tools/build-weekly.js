#!/usr/bin/env node
'use strict';

// Constructeur d'hebdo — générique, piloté par la donnée et un manifeste éditorial.
//
// Remplace les `weekly/YYYYMMDD/_build.cjs` à usage unique, qui figeaient dans un même fichier
// daté la structure HTML, les chiffres ET la prose : celui du 2026-08-31 câblait AVGO en dur sur
// trente lignes. Impossible d'y rejouer une semaine passée avec la méthode courante, ni de
// vérifier qu'un chiffre publié dérive bien d'un artefact certifié.
//
// La répartition suit le principe posé dans docs/BACKLOG.md §5 :
//   · les ARTEFACTS portent les mesures brutes, avec leur empreinte ;
//   · ce SCRIPT calcule tout ce qui est dérivable et refuse de rendre si une assertion tombe ;
//   · le MANIFESTE porte le jugement — la thèse, les titres, ce qu'on choisit de dire.
//
// Aucun nombre n'est saisi dans le manifeste : il ne peut que référencer une mesure par son nom.
// Chaque référence produit dans la page un `data-claim` et dans `_data/claims.json` l'entrée qui
// le lie à un pointeur JSON d'un artefact certifié. Le texte affiché n'est pas mis en forme ici :
// il est produit par `renderValue` de validate-content-claims.js, celui-là même qui contrôlera la
// page. Deux implémentations du même formatage divergent toujours un jour, et la divergence se
// lit alors comme une erreur de chiffre.
//
//   node tools/build-weekly.js --dir weekly/YYYYMMDD --manifest <manifest.json>

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { renderValue } = require('./validate-content-claims');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const dirRel = arg('--dir');
const manifestRel = arg('--manifest');
if (!dirRel || !manifestRel) {
  console.error('Usage: build-weekly.js --dir weekly/YYYYMMDD --manifest <manifest.json>');
  process.exit(2);
}
const DIR = path.resolve(ROOT, dirRel);
const man = JSON.parse(fs.readFileSync(path.resolve(ROOT, manifestRel), 'utf8'));
const REF = man.reference_close;

// ── artefacts certifiés ─────────────────────────────────────────────────────
const SRC = {};
const load = (name, rel) => {
  const p = path.join(DIR, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} absent — source requise, fail-closed`);
  const raw = fs.readFileSync(p);
  SRC[name] = {
    artifact: `${dirRel}/${rel}`,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    doc: JSON.parse(raw.toString('utf8')),
  };
  return SRC[name].doc;
};

for (const [name, rel] of Object.entries(man.sources)) load(name, rel);

// ── indexation par pointeur JSON ────────────────────────────────────────────
// Un pointeur, pas un chemin d'objet : c'est ce que le contrôle relira. Repérer la série au
// moment de la lecture évite d'avoir à le reconstruire plus tard, à un endroit où l'on ne saurait
// plus dans quel artefact on se trouve.
const esc = seg => String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
function indexSeries(doc, srcName, out) {
  (function walk(node, ptr) {
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${ptr}/${i}`)); return; }
    if (!node || typeof node !== 'object') return;
    if (node.symbol && Array.isArray(node.bars) && node.bars.length) {
      const sym = String(node.symbol).toUpperCase();
      // UN SYMBOLE, UNE SOURCE. Le « premier arrivé gagne » faisait dépendre le résultat de
      // l'ordre de `bar_sources` : IBIT était pris dans l'artefact crypto (30 barres) alors que
      // l'artefact focus en portait 120, et le classement d'un tableau trié changeait avec cet
      // ordre. Pire, une série trop courte faisait échouer une performance mensuelle alors qu'une
      // série suffisante existait dans le même dossier.
      const chosen = (man.symbol_source || {})[sym];
      if (chosen && chosen !== srcName) return;              // arbitrage déclaré : cet artefact n'est pas le bon
      if (out[sym]) throw new Error(`${sym} présent dans ${out[sym].src} ET ${srcName} — trancher dans manifest.symbol_source`);
      out[sym] = { bars: node.bars, src: srcName, ptr: `${ptr}/bars` };
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${ptr}/${esc(k)}`);
  })(doc, '');
  return out;
}

const BARS = {};
for (const name of man.bar_sources) indexSeries(SRC[name].doc, name, BARS);

// Toute série publiée doit se terminer sur la clôture de référence. Un artefact d'une autre
// séance qui se glisse dans un tableau est exactement le « monde d'hier » que le contrat de date
// existe pour empêcher.
for (const [sym, s] of Object.entries(BARS)) {
  if (s.bars[s.bars.length - 1][0] !== REF) throw new Error(`${sym}: dernière barre ${s.bars[s.bars.length - 1][0]} ≠ ${REF}`);
}

// ── registre des mesures ────────────────────────────────────────────────────
// Chaque mesure porte sa valeur ET le moyen de la retrouver dans un artefact. Une mesure sans
// provenance ne peut pas être publiée : c'est ce qui distingue un chiffre d'une affirmation.
const M = {};
const REACT_COUNTS = {};
const REGISTRY_INFO = { supplied: [], corrected: [] };
let REGISTRY_PENDING = {};
const REACT_MOVES = {};
function put(name, value, prov) {
  // Une mesure est un nombre fini ou une date ISO. `undefined` passait auparavant, et un champ
  // absent de l'artefact produisait alors soit un message d'erreur trompeur (« le comptant n'est
  // plus sous sa moyenne » alors que le champ manquait), soit rien du tout si la mesure n'était
  // pas employée.
  const isDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
  if (!isDate && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`mesure ${name} : ni nombre fini ni date ISO (${JSON.stringify(value)})`);
  }
  if (!prov || !prov.src || !SRC[prov.src]) throw new Error(`mesure ${name} sans artefact de provenance`);
  M[name] = { value, ...prov };
  return value;
}
const val = name => { if (!(name in M)) throw new Error(`mesure ${name} inconnue`); return M[name].value; };

const series = sym => { const s = BARS[sym]; if (!s) throw new Error(`${sym}: aucune barre certifiée`); return s; };
const CLOSE = 4, VOLUME = 5, OPEN = 1;

function putClose(name, sym) {
  const s = series(sym), i = s.bars.length - 1;
  return put(name, s.bars[i][CLOSE], { src: s.src, pointer: `${s.ptr}/${i}/${CLOSE}` });
}
function putPerf(name, sym, back) {
  const s = series(sym), i = s.bars.length - 1, j = i - back;
  if (j < 0) throw new Error(`${sym}: ${s.bars.length} barres, ${back + 1} requises`);
  const a = s.bars[i][CLOSE], b = s.bars[j][CLOSE];
  return put(name, (a / b - 1) * 100, {
    src: s.src,
    formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${i}/${CLOSE}`, denominator_pointer: `${s.ptr}/${j}/${CLOSE}` },
  });
}
const sessionIndex = (sym, date) => {
  const s = series(sym), i = s.bars.findIndex(b => b[0] === date);
  if (i < 1) throw new Error(`${sym}: séance ${date} introuvable dans les barres certifiées`);
  return i;
};

// performances des symboles cités
for (const s of man.measure_symbols) {
  putClose(`${s}_close`, s);
  putPerf(`${s}_j`, s, 1);
  putPerf(`${s}_s`, s, man.week_sessions);
  putPerf(`${s}_m`, s, man.month_sessions);
}

// structure par terme de la volatilité
{
  const doc = SRC[man.term_structure_source].doc;
  const items = doc.items || [];
  for (const [tenor, name] of Object.entries(man.term_structure_tenors)) {
    const i = items.findIndex(it => it.type === 'term_structure_point' && it.tenor === tenor);
    if (i < 0) throw new Error(`structure par terme : ténor ${tenor} absent`);
    put(name, items[i].level, { src: man.term_structure_source, pointer: `/items/${i}/level` });
  }
}
const TERM = man.term_structure_order.map(val);
for (let i = 1; i < TERM.length; i++) {
  if (!(TERM[i - 1] < TERM[i])) throw new Error('la courbe de volatilité n\'est plus croissante — la thèse du manifeste ne tient plus, relire avant de publier');
}

// régime
{
  const base = man.regime_pointer;
  const doc = SRC[man.regime_source].doc;
  const at = ptr => ptr.slice(1).split('/').reduce((n, k) => n == null ? undefined : n[k], doc);
  put('regime_score', at(`${base}/regime_score`), { src: man.regime_source, pointer: `${base}/regime_score` });
  put('vix_spot', at(`${base}/dtx_detail/vix_level`), { src: man.regime_source, pointer: `${base}/dtx_detail/vix_level` });
  put('vix_sma14', at(`${base}/dtx_detail/vix_sma14`), { src: man.regime_source, pointer: `${base}/dtx_detail/vix_sma14` });
  if (!(val('vix_spot') < val('vix_sma14'))) throw new Error('le comptant n\'est plus sous sa moyenne 14 jours — le manifeste l\'affirme, relire avant de publier');
}

// catalyseur : la date vient du calendrier collecté, jamais de la mémoire de l'auteur
{
  const doc = SRC[man.systemic_source].doc;
  const i = (doc.events || []).findIndex(e => e.symbol === man.event_leader);
  if (i < 0) throw new Error(`catalyseur ${man.event_leader} absent du calendrier systémique`);
  put('lead_move', doc.events[i].implied_move_pct, { src: man.systemic_source, pointer: `/events/${i}/implied_move_pct` });
  put('lead_mcap_b', doc.events[i].market_cap_b, { src: man.systemic_source, pointer: `/events/${i}/market_cap_b` });
  put('lead_date', doc.events[i].report_date, { src: man.systemic_source, pointer: `/events/${i}/report_date` });
}

// course du catalyseur avant son chiffre
{
  const s = series(man.event_leader), i = s.bars.length - 1, j = i - man.lead_run_sessions;
  if (j < 0) throw new Error(`${man.event_leader}: ${s.bars.length} barres, ${man.lead_run_sessions + 1} requises pour la course`);
  put('lead_run', (s.bars[i][CLOSE] / s.bars[j][CLOSE] - 1) * 100, {
    src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${i}/${CLOSE}`, denominator_pointer: `${s.ptr}/${j}/${CLOSE}` },
  });
  put('lead_run_from', s.bars[j][CLOSE], { src: s.src, pointer: `${s.ptr}/${j}/${CLOSE}` });
}

// Dates citées dans la prose. Une date écrite à la main ne peut pas être contrôlée ; une date
// prise dans la colonne 0 d'une barre certifiée l'est, et elle est en plus la preuve que la
// séance dont on parle existe dans la série qu'on publie.
{
  const s = series(man.event_leader), i = s.bars.length - 1;
  put('ref_close_date', s.bars[i][0], { src: s.src, pointer: `${s.ptr}/${i}/0` });
}
{
  const doc = SRC[man.systemic_source].doc;
  if (typeof doc.as_of !== 'string') throw new Error('calendrier systémique : champ as_of absent');
  put('compiled_at', doc.as_of, { src: man.systemic_source, pointer: '/as_of' });
}

// Volume des séances de la course pré-résultats. Le manifeste affirme qu'elle s'est faite « à
// volume normal » ; sans mesure, c'est une impression. Avec, c'est un fait qui retourne la
// convention de la page contre sa propre thèse — ce qui est exactement ce qu'on veut d'un chiffre.
{
  const s = series(man.event_leader), i = s.bars.length - 1, n = man.lead_run_sessions;
  const W = man.volume_mean_sessions, base = i - n;
  if (base - W + 1 < 0) throw new Error(`${man.event_leader}: fenêtre de volume de ${W} séances impossible avant la course`);
  let sum = 0;
  for (let k = base - W + 1; k <= base; k++) sum += s.bars[k][VOLUME];
  const avg = sum / W;
  const ratios = [];
  for (let k = base + 1; k <= i; k++) ratios.push({ k, r: s.bars[k][VOLUME] / avg });
  ratios.sort((a, b) => a.r - b.r);
  for (const [name, pick] of [['lead_vol_min', ratios[0]], ['lead_vol_max', ratios[ratios.length - 1]]]) {
    // `offset` positionne la fenêtre par rapport au numérateur : le validateur la reconstruit,
    // il ne fait pas confiance à une liste de pointeurs fournie par l'auteur.
    put(name, pick.r, { src: s.src, formula: { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/${pick.k}/${VOLUME}`, window: W, offset: pick.k - base } });
  }
}

// ratio cours-bénéfice rapporté à la croissance, depuis les statistiques certifiées
if (man.lead_stats) {
  const { source, field, name } = man.lead_stats;
  let hit = null;
  (function walk(node, ptr) {
    if (hit) return;
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${ptr}/${i}`)); return; }
    if (!node || typeof node !== 'object') return;
    if (node.symbol === man.event_leader && node[field] !== undefined) { hit = { v: node[field], ptr: `${ptr}/${esc(field)}` }; return; }
    for (const [k, v] of Object.entries(node)) walk(v, `${ptr}/${esc(k)}`);
  })(SRC[source].doc, '');
  if (!hit) throw new Error(`statistique ${field} absente pour ${man.event_leader}`);
  put(name, hit.v, { src: source, pointer: hit.ptr });
}

// séance de réaction du précédent comparable
{
  const p = man.precedent, s = series(p.symbol), i = sessionIndex(p.symbol, p.reaction_date);
  put('prec_reaction_date', s.bars[i][0], { src: s.src, pointer: `${s.ptr}/${i}/0` });

  // CE QUE LE TITRE AVAIT FAIT AVANT DE PUBLIER.
  // La version précédente de cette page présentait Broadcom comme le cas d'école d'une « barre
  // haute » sanctionnée. La mesure dit l'inverse : le titre entrait dans sa publication déjà en
  // baisse, et l'essentiel de son mois était acquis AVANT le chiffre. Sans ces deux mesures, la
  // page attribuait à l'événement un mouvement qui ne lui appartenait pas.
  const j = sessionIndex(p.symbol, p.pre_session);
  for (const n of (p.pre_run_sessions || [])) {
    if (j - n < 0) throw new Error(`${p.symbol}: série trop courte pour une course de ${n} séances`);
    put(`prec_pre${n}`, (s.bars[j][CLOSE] / s.bars[j - n][CLOSE] - 1) * 100, {
      src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${j}/${CLOSE}`, denominator_pointer: `${s.ptr}/${j - n}/${CLOSE}` },
    });
  }
  // Part du mois acquise avant la publication : même dénominateur que la performance mensuelle
  // publiée dans le tableau, numérateur arrêté à la veille du chiffre.
  {
    const last = s.bars.length - 1, base = last - man.month_sessions;
    if (base < 0) throw new Error(`${p.symbol}: série trop courte pour le mois`);
    put('prec_month_before', (s.bars[j][CLOSE] / s.bars[base][CLOSE] - 1) * 100, {
      src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${j}/${CLOSE}`, denominator_pointer: `${s.ptr}/${base}/${CLOSE}` },
    });
  }
  put('prec_move', (s.bars[i][CLOSE] / s.bars[i - 1][CLOSE] - 1) * 100, {
    src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${i}/${CLOSE}`, denominator_pointer: `${s.ptr}/${i - 1}/${CLOSE}` },
  });
  // Le multiple de volume énumère les séances de sa moyenne. Une fenêtre décrite par une borne
  // laisserait choisir l'intervalle après avoir vu le résultat.
  // La fenêtre est FIXE ou l'appel échoue. Auparavant `Math.max(0, …)` la raccourcissait en
  // silence : « moyenne 24 séances » pouvait devenir « moyenne 3 séances » sans que la prose,
  // elle, cesse de parler de vingt-quatre.
  const W = man.volume_mean_sessions;
  if (i - W < 0) throw new Error(`${p.symbol}: fenêtre de volume de ${W} séances impossible à l'indice ${i}`);
  let sum = 0;
  for (let k = i - W; k < i; k++) sum += s.bars[k][VOLUME];
  put('prec_volx', s.bars[i][VOLUME] / (sum / W), {
    src: s.src, formula: { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/${i}/${VOLUME}`, window: W, offset: 1 },
  });
}

// écarts d'ouverture nommés dans le texte : l'ouverture et la séance entière sont deux nombres
// différents, et les confondre a produit « écart d'ouverture de plus de vingt points » pour une
// ouverture à moins de douze.
for (const g of (man.gap_events || [])) {
  const s = series(g.symbol), i = sessionIndex(g.symbol, g.date);
  put(`${g.key}_open`, (s.bars[i][OPEN] / s.bars[i - 1][CLOSE] - 1) * 100, {
    src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${i}/${OPEN}`, denominator_pointer: `${s.ptr}/${i - 1}/${CLOSE}` },
  });
  put(`${g.key}_session`, (s.bars[i][CLOSE] / s.bars[i - 1][CLOSE] - 1) * 100, {
    src: s.src, formula: { operation: 'ratio_pct', numerator_pointer: `${s.ptr}/${i}/${CLOSE}`, denominator_pointer: `${s.ptr}/${i - 1}/${CLOSE}` },
  });
  const from = Math.max(0, i - man.volume_mean_sessions);
  const mean = [];
  for (let k = from; k < i; k++) mean.push(`${s.ptr}/${k}/${VOLUME}`);
  put(`${g.key}_volx`, s.bars[i][VOLUME] / (mean.reduce((a, _, idx) => a + s.bars[from + idx][VOLUME], 0) / mean.length), {
    src: s.src, formula: { operation: 'ratio_to_mean', numerator_pointer: `${s.ptr}/${i}/${VOLUME}`, mean_pointers: mean },
  });
}

// Historique des réactions aux résultats. Ces lignes sont datées par NUMÉRO D'ACCESSION SEC, pas
// par une heuristique de prix — c'est la seule source qui autorise à écrire « la société a publié
// tel jour ». Déduire une date de publication du plus gros écart d'une série de barres est
// exactement l'erreur PANW/ADI du 2026-08-25, et la version précédente de cette page la
// reproduisait : `prec_report_date` pointait vers `bars/117/0`, c'est-à-dire « la séance qui
// précède le plus gros trou ».
{
  const cfg = man.reaction_stats;
  if (cfg) {
    const rows = [];
    for (const srcName of cfg.sources) {
      (function walk(node, ptr) {
        if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${ptr}/${i}`)); return; }
        if (!node || typeof node !== 'object') return;
        if (node.data_type === 'earnings_reactions' && Array.isArray(node.data)) {
          node.data.forEach((r, i) => rows.push({ row: r, ptr: `${ptr}/data/${i}`, src: srcName }));
          return;
        }
        for (const [k, v] of Object.entries(node)) walk(v, `${ptr}/${esc(k)}`);
      })(SRC[srcName].doc, '');
    }

    for (const [symbol, key] of Object.entries(cfg.symbols)) {
      const hit = rows.find(r => r.row.symbol === symbol);
      if (!hit) throw new Error(`historique de réactions absent pour ${symbol} — source requise, fail-closed`);
      const { row, ptr, src } = hit, s = row.summary || {};
      for (const [field, name] of Object.entries({
        events: 'events', up_count: 'up', down_count: 'down',
        median_abs_move_percent: 'median', mean_move_percent: 'mean',
        max_up_percent: 'max_up', max_down_percent: 'max_down',
      })) {
        if (s[field] === undefined) throw new Error(`${symbol}: résumé de réactions sans ${field}`);
        put(`${key}_react_${name}`, s[field], { src, pointer: `${ptr}/summary/${field}` });
      }
      (row.reactions || []).forEach((r, i) => {
        for (const [field, name] of Object.entries({
          announced_date: 'date', move_percent: 'move', gap_percent: 'gap',
          intraday_percent: 'intraday', volume_ratio: 'volx',
        })) {
          if (r[field] === undefined) return;
          put(`${key}_react${i}_${name}`, r[field], { src, pointer: `${ptr}/reactions/${i}/${field}` });
        }
      });
      // Comptages dérivés de la série, pas d'un pointeur : ils s'écrivent en toutes lettres.
      const moves = (row.reactions || []).map(r => Math.abs(r.move_percent));
      const intraday = (row.reactions || []).map(r => r.intraday_percent).filter(v => Number.isFinite(v));
      REACT_COUNTS[key] = {
        intraday_up: intraday.filter(v => v > 0).length,
        total: moves.length,
        september: (row.reactions || []).filter(r => String(r.announced_date).slice(5, 7) === cfg.quarter_month).length,
      };
      REACT_MOVES[key] = moves;
    }
  }
}

// calendrier économique à venir, chaque date liée à son entrée
const ECO = [];
{
  const doc = SRC[man.economic_source].doc;
  (doc.results || []).forEach((r, ri) => {
    ((r.data && r.data.events) || []).forEach((e, ei) => {
      if (String(e.event_time).slice(0, 10) <= REF) return;
      ECO.push({ event: e, pointer: `/results/${ri}/data/events/${ei}/event_time` });
    });
  });
  // TRIER PAR INSTANT, PAS PAR CHAÎNE. Les horodatages du calendrier portent chacun leur propre
  // décalage horaire : « 2026-09-10T08:30:00-04:00 » est POSTÉRIEUR à « 2026-09-10T14:15:00+02:00 »
  // alors que la comparaison lexicale le place avant. Un lecteur qui prépare sa semaine sur cet
  // ordre se trompe sur ce qui réagit à quoi.
  ECO.sort((a, b) => {
    const ta = Date.parse(a.event.event_time), tb = Date.parse(b.event.event_time);
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) throw new Error('calendrier : horodatage illisible');
    return ta - tb;
  });
  // LE REGISTRE FAIT AUTORITÉ SUR LE FLUX.
  //
  // Le 2026-09-06, le flux datait le PPI d'août au 14 septembre. La BLS le publie le 10. L'article
  // a publié le 14 — et bâti dessus un raisonnement inversé (« le PPI confirmera le CPI de
  // vendredi » alors qu'il le précède d'un jour). Le même flux ignorait purement et simplement le
  // FOMC des 15-16, pourtant dans la fenêtre qu'il couvrait.
  //
  // L'artefact était CERTIFIÉ : empreinte, journal, provenance complète. La certification prouve
  // d'où vient un chiffre, elle ne dit rien de son exactitude. Pour les dates qu'une autorité
  // publie un an d'avance, la référence vit donc dans le dépôt, et un désaccord est une ERREUR DE
  // CONSTRUCTION — pas un avertissement qu'on lit après publication.
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scheduled-events.json'), 'utf8'));
  const windowEnd = ECO.length ? String(ECO[ECO.length - 1].event.event_time).slice(0, 10) : REF;
  if (windowEnd > reg.coverage_until) {
    throw new Error(`le registre d'événements programmés s'arrête au ${reg.coverage_until}, le calendrier va jusqu'au ${windowEnd} — étendre data/scheduled-events.json`);
  }
  // Le registre COMPLÈTE et CORRIGE le flux, il ne se contente pas de le contrôler. Un flux qui
  // ignore le FOMC ne pourra jamais être « réparé » par une nouvelle collecte : c'est au dépôt de
  // porter la référence. Les deux opérations sont déclarées dans la section Méthode de l'article.
  const REGISTRY_REL = 'data/scheduled-events.json';
  REGISTRY_INFO.supplied = [];
  REGISTRY_INFO.corrected = [];
  for (const ev of reg.events) {
    if (ev.date <= REF || ev.date > windowEnd) continue;
    const idx = ECO.findIndex(r => (ev.match_feed || []).some(k => new RegExp(k, 'i').test(String(r.event.name || ''))));
    if (idx < 0) {
      const i = reg.events.indexOf(ev);
      ECO.push({ event: { event_time: ev.date, name: ev.label_fr, impact: ev.impact }, registry: { pointer: `/events/${i}/date`, authority: ev.source } });
      REGISTRY_INFO.supplied.push(ev.label_fr);
      continue;
    }
    const fed = String(ECO[idx].event.event_time).slice(0, 10);
    if (fed !== ev.date) {
      const i = reg.events.indexOf(ev);
      REGISTRY_INFO.corrected.push({ label: ev.label_fr, feed: fed, authority: ev.date, by: reg.sources[ev.source].authority });
      ECO[idx] = { event: { event_time: ev.date, name: ev.label_fr, impact: ev.impact }, registry: { pointer: `/events/${i}/date`, authority: ev.source } };
    }
  }
  ECO.sort((a, b) => {
    const ta = Date.parse(a.event.event_time), tb = Date.parse(b.event.event_time);
    return (Number.isFinite(ta) ? ta : Date.parse(a.event.event_time + 'T12:00:00Z')) - (Number.isFinite(tb) ? tb : Date.parse(b.event.event_time + 'T12:00:00Z'));
  });
  // Une date de registre citée dans la PROSE doit être une mesure liée comme une autre, sinon
  // « le mercredi 16 » redevient un chiffre saisi à la main — celui-là même qui a mis les prix à
  // la production quatre jours trop tard.
  REGISTRY_PENDING = (man.registry_dates || {});
  SRC.registry = { artifact: REGISTRY_REL, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, REGISTRY_REL))).digest('hex'), doc: reg };

  for (const [name, spec] of Object.entries(REGISTRY_PENDING)) {
    const i = reg.events.findIndex(e => e.id === spec.id && e.date > (spec.after || REF));
    if (i < 0) throw new Error(`aucun « ${spec.id} » programmé après le ${spec.after || REF} dans le registre`);
    put(name, reg.events[i].date, { src: 'registry', pointer: `/events/${i}/date`, authority: reg.events[i].source });
  }

  ECO.forEach((row, i) => row.registry
    ? put(`eco_${i}`, row.event.event_time, { src: 'registry', pointer: row.registry.pointer, authority: row.registry.authority })
    : put(`eco_${i}`, row.event.event_time, { src: man.economic_source, pointer: row.pointer }));
}

// ── rendu ───────────────────────────────────────────────────────────────────
const RENDER = {
  pc: { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' },
  pc1: { scale: 1, decimals: 1, sign: 'always', suffix: ' %', format: 'fr' },
  // Sans signe : une amplitude implicite ou une part n'ont pas de direction, et « +11,7 % » les
  // ferait lire comme une hausse attendue alors que le marché price un écart dans les deux sens.
  amp: { scale: 1, decimals: 1, suffix: ' %', format: 'fr' },
  nb: { scale: 1, decimals: 2, format: 'fr' },
  nb0: { scale: 1, decimals: 0, format: 'fr' },
  nb1: { scale: 1, decimals: 1, format: 'fr' },
  usd: { scale: 1, decimals: 2, suffix: ' $', format: 'fr' },
  pct100: { scale: 100, decimals: 0, format: 'fr' },
  date: { format: 'fr_date', parts: 'weekday_day_month' },
  datefull: { format: 'fr_date', parts: 'full' },
};

const claims = [];
const usedMeasures = new Set();
let claimSeq = 0;

// Toute valeur affichée passe par ici, et par ici seulement. C'est ce qui garantit qu'aucun
// nombre ne peut atteindre la page sans être simultanément inscrit au registre de preuves.
function bind(name, fmt, attrs = '') {
  const m = M[name];
  if (!m) throw new Error(`référence inconnue dans le manifeste : {{${name}}}`);
  const render = RENDER[fmt];
  if (!render) throw new Error(`format inconnu : ${fmt} (mesure ${name})`);
  const text = renderValue(m.value, render);
  if (text === null) throw new Error(`la mesure ${name} ne se rend pas au format ${fmt}`);
  usedMeasures.add(name);
  const id = `${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${fmt}_${++claimSeq}`;
  const src = SRC[m.src];
  const pointer = m.pointer || m.formula.numerator_pointer;
  const at = ptr => ptr === '' ? src.doc : ptr.slice(1).split('/').reduce((n, k) => n == null ? undefined : n[k.replace(/~1/g, '/').replace(/~0/g, '~')], src.doc);
  const entry = {
    id, rendered_text: text,
    source_artifact: src.artifact, source_sha256: src.sha256,
    source_pointer: pointer, source_value: at(pointer), render,
  };
  if (m.authority) entry.authority = m.authority;
  if (m.formula) entry.formula = { ...m.formula, result: m.value };
  claims.push(entry);
  return `<span data-claim="${id}"${attrs}>${text}</span>`;
}

const REF_RE = /\{\{(\w+)(?::(\w+))?\}\}/g;
const fill = text => String(text).replace(REF_RE, (_, name, fmt) => bind(name, fmt || 'nb'));

// Textes littéraux : chiffres qui ne mesurent rien — un nom d'indice, une empreinte. Ils sont
// admis mais déclarés : `literals` part dans le manifeste de preuves, et le contrôle refuse tout
// littéral non déclaré comme tout littéral déclaré qui n'apparaît pas. La liste reste courte et
// relisible, ce qui est la seule chose qui empêche l'exception de devenir un trou.
const literals = new Set();
const wrapLit = (t, why) => `<span data-literal="${why}">${h(t)}</span>`;

// Empreintes d'artefacts : identifiants produits par ce script, qui changent à chaque collecte.
// Ils ne peuvent pas figurer dans une liste écrite à la main, et ils ne portent aucune
// affirmation — ils sont admis automatiquement.
const litHash = text => { const t = String(text).trim(); literals.add(t); return wrapLit(t, 'empreinte'); };

// Texte venu du MANIFESTE. Celui-là doit être déclaré. Sans cette contrainte, `lit()` ajoutait
// lui-même à la liste tout texte du manifeste contenant un chiffre : la promesse d'« une liste
// courte et relue » était fausse, puisque personne ne l'écrivait. Un libellé comme
// « +14,2 % sur le mois » se serait glissé dans un nom de risque sans qu'aucun contrôle ne bronche.
const DECLARED = new Set((man.literals || []).map(v => String(v).replace(/\s+/g, ' ').trim()));
const maybeLit = text => {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (!/\d/.test(t)) return h(t);
  if (!DECLARED.has(t)) throw new Error(`littéral non déclaré : « ${t} » — l'ajouter à manifest.literals après relecture, ou retirer le chiffre`);
  literals.add(t);
  return wrapLit(t, 'nom-propre');
};

const h = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dt = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
const dFR = iso => `${dt(iso).getUTCDate()} ${MOIS[dt(iso).getUTCMonth()]} ${dt(iso).getUTCFullYear()}`;

// Les petits entiers dérivés — « neuf des douze » — s'écrivent en toutes lettres. Ils ne
// proviennent d'aucun pointeur unique (ce sont des comptages sur un tableau) et un chiffre non
// lié serait refusé à juste titre. Les écrire en lettres n'est pas un contournement : la valeur
// reste calculée ici, elle ne peut pas diverger de la donnée.
const MOTS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'];
const mot = n => { if (!Number.isInteger(n) || n < 0 || n >= MOTS.length) throw new Error(`comptage ${n} hors de la table des mots`); return MOTS[n]; };

const symsOf = t => Array.isArray(t) ? t : t.symbols;
const CHAIN = symsOf(man.tables.chain);
const chainM = CHAIN.map(s => val(`${s}_m`));
const COUNTS = {
  chain_total: mot(chainM.length),
  chain_pos: mot(chainM.filter(v => v > 0).length),
  chain_neg: mot(chainM.filter(v => v < 0).length),
  week_sessions: mot(man.upcoming_sessions),
};
for (const [key, c] of Object.entries(REACT_COUNTS)) {
  COUNTS[`${key}_react_total`] = mot(c.total);
  COUNTS[`${key}_react_intraday_up`] = mot(c.intraday_up);
  COUNTS[`${key}_react_quarter`] = mot(c.september);
}
// Combien des publications passées sont tombées SOUS l'amplitude que le marché demande
// aujourd'hui. C'est le test qui décide si la prime est chère : gagner souvent et perdre quand
// même est le résultat le plus instructif qu'une distribution puisse donner.
if (man.premium_test) {
  const { key, implied } = man.premium_test;
  const moves = REACT_MOVES[key];
  if (!moves) throw new Error(`test de prime : aucune série de réactions pour ${key}`);
  const threshold = val(implied);
  COUNTS[`${key}_below_implied`] = mot(moves.filter(v => v < threshold).length);
  COUNTS[`${key}_above_implied`] = mot(moves.filter(v => v >= threshold).length);
}
const words = text => String(text).replace(/\[\[(\w+)\]\]/g, (_, k) => {
  // `[[Chain_pos]]` en tête de phrase rend « Cinq », `[[chain_pos]]` rend « cinq ». Sans cela le
  // texte affichait « . cinq des six montent », une minuscule après un point.
  const cap = /^[A-Z]/.test(k), key = k.charAt(0).toLowerCase() + k.slice(1);
  if (!(key in COUNTS)) throw new Error(`comptage inconnu : [[${k}]]`);
  const w = COUNTS[key];
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
});

const P = t => `<p>${fill(words(t))}</p>`;
const paras = a => a.map(P).join('');
const table = (headers, rows) =>
  `<div class="table-responsive" style="overflow-x:auto;max-width:100%"><table class="data-table"><thead><tr>${headers.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map((c, i) => `<td>${i ? c : `<strong>${c}</strong>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const cell = (sym, suffix) => bind(`${sym}_${suffix}`, 'pc',
  val(`${sym}_${suffix}`) >= 0 ? ' style="color:#16a34a;font-weight:600"' : ' style="color:#dc2626;font-weight:600"');

// L'ORDRE D'UN TABLEAU EST DÉRIVÉ, JAMAIS DÉCLARÉ. Un ordre saisi dans le manifeste a l'air d'un
// classement et cesse d'en être un dès que la donnée bouge, sans que rien ne le signale. Le
// tableau des secteurs de cette page était exactement dans ce cas.
function perfTable(spec) {
  const syms = symsOf(spec);
  const sort = Array.isArray(spec) ? null : spec.sort;
  const ord = sort ? [...syms].sort((a, b) => val(`${b}_${sort}`) - val(`${a}_${sort}`)) : syms;
  return table(['Actif', 'Séance', 'Semaine', 'Mois'],
    ord.map(s => [maybeLit(man.labels[s] || s), cell(s, 'j'), cell(s, 's'), cell(s, 'm')]));
}

// ── vocabulaire visuel ──────────────────────────────────────────────────────
// La première version de cette page n'employait que `section-block` et `compare-table` : 47 Ko
// de texte gris là où l'hebdo précédent en faisait 124 avec treize graphiques, des cartes
// métriques et des badges. Les classes existaient déjà dans report.css — je ne m'en servais pas.
// Un rapport dont chaque chiffre est prouvé mais que personne ne lit n'a pas rempli sa fonction.
const CHARTS = [];
function chart(id, title, note, spec) {
  CHARTS.push({ id, spec });
  return `<div class="chart-panel"><div class="chart-title">${h(title)}</div><div id="${id}" class="chart-host"></div><p class="chart-note">${h(note)}</p></div>`;
}
const metric = (value, label) => `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${h(label)}</div></div>`;
const metricsGrid = cards => `<div class="metrics-grid">${cards.join('')}</div>`;
const badge = (text, tone) => `<span class="badge badge-${tone}">${h(text)}</span>`;

// Structure calquée sur weekly/20260831, qui est la référence du format : chaque section EST une
// `content-card`, pas un `section-block` contenant une carte. La première version imbriquait les
// deux et produisait une page grise et plate.
const sec = (id, icon, title, inner) =>
  `<section id="${id}" class="content-card"><h2><i class="fas ${icon}"></i> ${h(title)}</h2>${inner}</section>`;
const card = inner => inner;

// Tableau de décision : ce que le lecteur doit retenir s'il ne lit rien d'autre, avec les trois
// chiffres qui le portent et les contrôles systématiques à côté.
const decisionBoard = (label, title, lead, stats, checks) => `
<section id="verdict" class="decision-board" aria-label="Décision de la semaine">
  <div class="decision-main"><div class="decision-label">${h(label)}</div><h2>${fill(words(title))}</h2><p>${fill(words(lead))}</p>
    <div class="decision-stats">${stats.map(x => `<div class="mini-stat"><strong>${x.value}</strong><span>${h(x.label)}</span></div>`).join('')}</div>
  </div>
  <div class="decision-side"><div class="decision-label">Contrôle systématique</div>
    <div class="check-grid">${checks.map(c => `<div class="check-item ${c.tone}"><i class="fas ${c.tone === 'pass' ? 'fa-circle-check' : c.tone === 'block' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}"></i><span><strong>${h(c.title)}</strong><br>${fill(words(c.text))}</span></div>`).join('')}</div>
  </div>
</section>`;
const box = (cls, icon, title, inner) => `<div class="${cls}"><h4><i class="fas ${icon}"></i> ${h(title)}</h4>${inner}</div>`;

const E = man.editorial;
const S = [];

const REACT = (man.reaction_stats && REACT_MOVES.lead) || [];
const IMPLIED = val('lead_move');

S.push(decisionBoard(
  E.verdict.decision_label, E.verdict.decision, E.verdict.lead,
  E.verdict.stats.map(x => ({ value: bind(x.measure, x.format), label: x.label })),
  E.verdict.checks)
  + sec('synthese', 'fa-flag-checkered', E.verdict.title,
      metricsGrid([
        metric(bind('lead_move', 'amp'), `Amplitude demandée · ${man.event_leader}`),
        metric(bind('lead_react_median', 'amp'), 'Médiane des publications passées'),
        metric(bind('lead_react_max_up', 'pc1'), 'La plus forte réaction de la série'),
        metric(bind('regime_score', 'pct100'), 'Régime de marché sur cent'),
        metric(bind('vix9d', 'nb'), 'Volatilité à neuf jours'),
        metric(bind('USO_m', 'pc1'), 'Pétrole sur un mois'),
      ])
      + paras(E.verdict.paragraphs)
      + chart('reactionChart',
          `Les ${COUNTS.lead_react_total} publications passées d'${man.labels[man.event_leader] || man.event_leader}, face à ce que le marché demande aujourd'hui`,
          "Amplitude absolue de chaque réaction, mesurée de la séance précédant l'annonce à celle qui la suit. La ligne pointillée marque l'amplitude implicite de jeudi. Les barres vertes sont restées sous ce seuil, les rouges l'ont franchi — et la plus haute suffit à elle seule à effacer tous les gains des autres.",
          {
            grid: { left: 48, right: 24, top: 24, bottom: 56 },
            xAxis: { type: 'category', data: REACT.map((_, i) => val(`lead_react${i}_date`).slice(0, 7)), axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', name: '% absolu', nameTextStyle: { fontSize: 10 } },
            series: [{
              type: 'bar',
              data: REACT.map(v => ({ value: Number(v.toFixed(2)), itemStyle: { color: v >= IMPLIED ? '#dc2626' : '#16a34a' } })),
              markLine: {
                symbol: 'none', silent: true,
                data: [{ yAxis: Number(IMPLIED.toFixed(2)), lineStyle: { color: '#0f172a', type: 'dashed', width: 2 } }],
                label: { formatter: 'implicite ' + IMPLIED.toFixed(1) + ' %', position: 'insideEndTop', fontSize: 10 },
              },
            }],
          })
      + box('alert-box', 'fa-bullseye', E.verdict.box_title, paras(E.verdict.box))));

S.push(sec('agenda', 'fa-calendar-week', E.week.title, card(paras(E.week.paragraphs) +
  table(['Date', 'Rendez-vous', 'Portée'], ECO.map((row, i) => [
    bind(`eco_${i}`, 'date'),
    maybeLit(man.event_labels[row.event.name] || row.event.name),
    row.event.impact === 'high' ? badge('élevée', 'red') : badge('moyenne', 'yellow'),
  ])))));

// Une seule section de marché, comme dans la référence : régime, indices, secteurs et volatilité
// se lisent ensemble. Quatre sections séparées donnaient quatre paragraphes maigres au lieu d'un
// tableau de bord.
S.push(sec('macro', 'fa-chart-line', E.macro.title,
  paras(E.tape.paragraphs)
  + `<h3>Indices et grandes classes d'actifs</h3>`
  + paras(E.indices.paragraphs) + perfTable(man.tables.indices)
  + `<h3>${h(E.sectors.title)}</h3>`
  + paras(E.sectors.paragraphs)
  + (() => {
      const syms = [...symsOf(man.tables.sectors)].sort((a, b) => val(`${b}_s`) - val(`${a}_s`));
      return chart('sectorChart', 'Onze secteurs américains, semaine et mois',
        "Les barres claires sont la semaine, les foncées le mois. Un secteur peut mener la semaine et rester en retard sur le mois : c'est le cas de la technologie.",
        {
          legend: { data: ['semaine', 'mois'], bottom: 0, textStyle: { fontSize: 11 } },
          grid: { left: 150, right: 40, top: 16, bottom: 44 },
          xAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 10 } },
          yAxis: { type: 'category', data: syms.map(x => man.labels[x] || x), axisLabel: { fontSize: 11 } },
          series: [
            { name: 'semaine', type: 'bar', itemStyle: { color: '#93c5fd' }, data: syms.map(x => Number(val(`${x}_s`).toFixed(2))) },
            { name: 'mois', type: 'bar', itemStyle: { color: '#1d4ed8' }, data: syms.map(x => Number(val(`${x}_m`).toFixed(2))) },
          ],
        });
    })()
  + perfTable(man.tables.sectors)
  + `<h3>${h(E.vol.title)}</h3>`
  + paras(E.vol.paragraphs)
  + chart('volChart', 'La courbe de volatilité implicite, du plus court au plus long',
      "Le point le moins cher de la courbe est la fenêtre de neuf jours — celle qui contient les rendez-vous de la semaine.",
      {
        grid: { left: 48, right: 24, top: 24, bottom: 40 },
        xAxis: { type: 'category', data: man.term_structure_labels },
        yAxis: { type: 'value', min: v => Math.floor(v.min - 2), name: 'niveau', nameTextStyle: { fontSize: 10 } },
        series: [{ type: 'line', smooth: true, symbolSize: 9, lineStyle: { width: 3, color: '#0ea5e9' }, itemStyle: { color: '#0ea5e9' },
          data: man.term_structure_order.map(n => Number(val(n).toFixed(2))), label: { show: true, fontSize: 10 } }],
      })
  + table(['Échéance', 'Niveau', 'Lecture'], man.term_structure_order.map((name, i) => [
      maybeLit(man.term_structure_labels[i]), bind(name, 'nb'), maybeLit(man.term_structure_reads[i]),
    ]))));

S.push(sec('catalyseur', 'fa-bolt', E.leader.title, paras(E.leader.paragraphs)
  + (() => {
      const b = series(man.event_leader).bars, n = man.lead_run_sessions;
      const from = Math.max(0, b.length - 26);
      const seg = b.slice(from);
      return chart('leadPathChart', `${man.labels[man.event_leader] || man.event_leader} sur les dernières séances`,
        "La zone ombrée est la course de trois séances dont tout le monde parlera. Elle part du plus bas cours de clôture du mois — c'est ce point de départ, et non le parcours, qui produit le gros chiffre.",
        {
          grid: { left: 56, right: 24, top: 24, bottom: 40 },
          xAxis: { type: 'category', data: seg.map(x => x[0].slice(5)), axisLabel: { rotate: 45, fontSize: 9 } },
          yAxis: { type: 'value', scale: true, name: '$', nameTextStyle: { fontSize: 10 } },
          series: [{
            type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2.5, color: '#0f172a' },
            data: seg.map(x => Number(x[CLOSE].toFixed(2))),
            markArea: { silent: true, itemStyle: { color: 'rgba(22,163,74,0.12)' },
              data: [[{ xAxis: seg[seg.length - 1 - n][0].slice(5) }, { xAxis: seg[seg.length - 1][0].slice(5) }]] },
          }],
        });
    })()));
{
  const ord = [...CHAIN].sort((a, b) => val(`${a}_m`) - val(`${b}_m`));
  S.push(sec('propagation', 'fa-diagram-project', E.blast.title,
    card(paras(E.blast.paragraphs))
    + chart('chainChart', 'La chaîne d\'infrastructure sur vingt et une séances',
        "Neuf hausses, trois baisses. Deux des trois titres en baisse n'ont rien publié : la publication de résultats n'est pas ce qui sépare les uns des autres.",
        {
          grid: { left: 120, right: 40, top: 16, bottom: 32 },
          xAxis: { type: 'value', name: '% sur un mois', nameTextStyle: { fontSize: 10 } },
          yAxis: { type: 'category', data: ord.map(x => man.labels[x] || x), axisLabel: { fontSize: 11 } },
          series: [{ type: 'bar', data: ord.map(x => ({ value: Number(val(`${x}_m`).toFixed(2)), itemStyle: { color: val(`${x}_m`) >= 0 ? '#16a34a' : '#dc2626' } })),
            label: { show: true, position: 'right', fontSize: 10, formatter: p => p.value.toFixed(1) + ' %' } }],
        })
    + card(perfTable(man.tables.chain))));
}
S.push(sec('precedent', 'fa-clock-rotate-left', E.precedent.title, paras(E.precedent.paragraphs)
  + chart('precChart', "D'où vient réellement le mois de Broadcom",
      "La publication n'explique qu'une fraction du mois. Attribuer l'ensemble à l'événement est une inversion de causalité, et elle se mesure.",
      {
        grid: { left: 150, right: 60, top: 16, bottom: 32 },
        xAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 10 } },
        yAxis: { type: 'category', data: ['Le mois entier', 'La publication', 'Avant le communiqué'] },
        series: [{ type: 'bar', label: { show: true, position: 'left', fontSize: 10, formatter: p => p.value.toFixed(1) + ' %' },
          data: [
            { value: Number(val('AVGO_m').toFixed(2)), itemStyle: { color: '#64748b' } },
            { value: Number(val('prec_react0_move').toFixed(2)), itemStyle: { color: '#dc2626' } },
            { value: Number(val('prec_month_before').toFixed(2)), itemStyle: { color: '#f59e0b' } },
          ] }],
      })
  + (() => {
      const n = REACT.length;
      return chart('intradayChart', `Sur les ${COUNTS.lead_react_total} réactions passées, l'ouverture a été le bas de la séance`,
        "Chaque point compare l'écart d'ouverture (horizontal) à ce que la séance a fait ensuite (vertical). Presque tous sont au-dessus de zéro, y compris les réactions négatives : vendre à la cloche d'ouverture a historiquement été le mauvais réflexe sur ce titre.",
        {
          grid: { left: 56, right: 24, top: 24, bottom: 44 },
          xAxis: { type: 'value', name: 'écart d\'ouverture %', nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: 10 } },
          yAxis: { type: 'value', name: 'séance %', nameTextStyle: { fontSize: 10 } },
          series: [{
            type: 'scatter', symbolSize: 13,
            data: Array.from({ length: n }, (_, i) => ({
              value: [Number(val(`lead_react${i}_gap`).toFixed(2)), Number(val(`lead_react${i}_intraday`).toFixed(2))],
              itemStyle: { color: val(`lead_react${i}_intraday`) >= 0 ? '#16a34a' : '#dc2626' },
            })),
            markLine: { symbol: 'none', silent: true, data: [{ yAxis: 0, lineStyle: { color: '#94a3b8', type: 'dashed' } }] },
          }],
        });
    })()));
S.push(sec('actifs', 'fa-coins', E.assets.title,
  `<h3>${h(E.metals.title)}</h3>` + paras(E.metals.paragraphs)
  + `<h3>${h(E.crypto.title)}</h3>` + paras(E.crypto.paragraphs)
  + (() => {
      const syms = [...symsOf(man.tables.crypto)].sort((a, b) => val(`${b}_m`) - val(`${a}_m`));
      return chart('cryptoChart', 'Crypto : le mois contre la semaine',
        "Un mois très fort, une semaine nettement plus calme. C'est le ralentissement, pas la hausse, qui commande la décision de taille.",
        {
          legend: { data: ['mois', 'semaine'], bottom: 0, textStyle: { fontSize: 11 } },
          grid: { left: 90, right: 40, top: 16, bottom: 44 },
          xAxis: { type: 'value', name: '%', nameTextStyle: { fontSize: 10 } },
          yAxis: { type: 'category', data: syms.map(x => man.labels[x] || x) },
          series: [
            { name: 'mois', type: 'bar', itemStyle: { color: '#7c3aed' }, data: syms.map(x => Number(val(`${x}_m`).toFixed(2))) },
            { name: 'semaine', type: 'bar', itemStyle: { color: '#c4b5fd' }, data: syms.map(x => Number(val(`${x}_s`).toFixed(2))) },
          ],
        });
    })()
  + perfTable(man.tables.crypto)
  + `<h3>${h(E.commodities.title)}</h3>` + paras(E.commodities.paragraphs)));

S.push(sec('risques', 'fa-triangle-exclamation', E.risks.title,
  card(table(['Risque', 'Ce qui le déclenche', 'Ce qu\'on regarde'],
    E.risks.items.map(r => [maybeLit(r.name), fill(words(r.trigger)), fill(words(r.watch))])))));

S.push(sec('plan', 'fa-list-check', E.plan.title, card(paras(E.plan.paragraphs) +
  table(['Si…', 'Alors'], E.plan.rules.map(r => [fill(words(r.when)), fill(words(r.then))])))));

// Section trades. Zéro idée est un résultat, pas un manque : le gabarit prévoit `no_setup`, et
// forcer une idée pour remplir la section est exactement ce que la règle interdit. Quand le
// manifeste ne déclare aucune idée, on publie le motif du refus — c'est plus utile qu'un plan
// tiède, et c'est vérifiable la semaine suivante.
S.push(sec('trades', 'fa-scale-balanced', E.trades.title, card(
  E.trades.ideas && E.trades.ideas.length
    ? paras(E.trades.paragraphs) + table(['Titre', 'Entrée', 'Stop', 'Objectif', 'Thèse'],
      E.trades.ideas.map(t => [maybeLit(t.label), fill(t.entry), fill(t.stop), fill(t.target), fill(words(t.thesis))]))
    : box('alert-box', 'fa-ban', E.trades.no_setup_title, paras(E.trades.paragraphs)))));

S.push(sec('pedagogie', 'fa-graduation-cap', E.pedagogy.title,
  card(box('pedagogy-box', 'fa-lightbulb', E.pedagogy.box_title, paras(E.pedagogy.paragraphs)))));

S.push(sec('outlook', 'fa-binoculars', E.outlook.title,
  card(paras(E.outlook.paragraphs))
  + (E.outlook.scenarios ? `<div class="scenario-grid">${E.outlook.scenarios.map(sc =>
      `<div class="scenario-card ${sc.tone}"><h3>${h(sc.title)}</h3><p>${fill(words(sc.body))}</p><p><strong>Ce qu'on fait :</strong> ${fill(words(sc.action))}</p></div>`).join('')}</div>` : '')));
S.push(sec('sources', 'fa-file-lines', E.quality.title,
  paras(E.quality.paragraphs)
  + table(['Bloc', 'Qualité', 'Limite appliquée'],
      E.quality.blocks.map(b => [
        maybeLit(b.block),
        badge(b.grade, b.grade === 'VALIDÉ' ? 'green' : b.grade === 'AVEC RÉSERVE' ? 'yellow' : 'blue'),
        fill(words(b.limit)),
      ]))
  + `<p class="disclaimer">${h(man.disclaimer)}</p>`));

const title = E.title;
const desc = E.description;
const html = `<!DOCTYPE html>
<html lang="fr" dir="ltr" data-level="${man.level}" data-tags="${man.tags.join(',')}" data-tab="weekly">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DailyTickers | ${h(title)}</title>
<meta name="description" content="${h(desc)}">
<meta property="og:title" content="${h(title)}"><meta property="og:description" content="${h(desc)}"><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/${dirRel}/"><meta property="og:type" content="article">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head>
<body class="weekly-brief">
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<main class="report-container">
<header class="hero-section">
<div class="report-card-meta">${bind('compiled_at', 'datefull')}</div>
<h1>${h(title)}</h1>
<p class="hero-subtitle">${h(desc)}</p>
<div id="article-clickable-tags" class="card-tags"></div>
</header>
<nav class="report-jump-nav" aria-label="Sommaire de l'hebdo">${man.jump_nav.map(j => `<a href="#${j.id}"><i class="fas ${j.icon}"></i> ${h(j.label)}</a>`).join('')}</nav>
${S.join('\n')}
</main>
<div class="fnav">
<a href="#verdict" title="Verdict"><i class="fas fa-flag-checkered"></i></a>
<a href="#agenda" title="Agenda"><i class="fas fa-calendar-week"></i></a>
<a href="#marches" title="Marchés"><i class="fas fa-chart-line"></i></a>
<a href="#propagation" title="Propagation"><i class="fas fa-diagram-project"></i></a>
<a href="#plan" title="Plan"><i class="fas fa-list-check"></i></a>
<a href="#sources" title="Sources"><i class="fas fa-database"></i></a>
</div>
<footer class="article-footer">&copy; 2026 DailyTickers · données arrêtées à la clôture du ${h(dFR(REF))} · contenu informatif.<br><a href="/" title="Accueil"><i class="fas fa-house"></i></a></footer>
<script>
// Les graphiques lisent les MÊMES mesures que le texte : elles sont sérialisées ici depuis le
// registre, pas ressaisies. Un graphique qui contredit son paragraphe est le pire des deux mondes.
const CHART_SPECS = ${JSON.stringify(CHARTS)};
(function () {
  if (typeof echarts === 'undefined') return;
  const drawn = [];
  for (const c of CHART_SPECS) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    const inst = echarts.init(el);
    inst.setOption(Object.assign({ animation: false, textStyle: { fontFamily: 'Inter, system-ui, sans-serif' }, tooltip: { trigger: 'axis' } }, c.spec));
    drawn.push(inst);
  }
  window.addEventListener('resize', () => drawn.forEach(i => i.resize()));
})();
</script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>`;

const articlePath = path.join(DIR, 'index.html');
fs.writeFileSync(articlePath, html);
fs.mkdirSync(path.join(DIR, '_data'), { recursive: true });
fs.writeFileSync(path.join(DIR, '_data/claims.json'), JSON.stringify({
  reference_close: REF,
  article_path: `${dirRel}/index.html`,
  article_sha256: crypto.createHash('sha256').update(fs.readFileSync(articlePath)).digest('hex'),
  generated_by: 'tools/build-weekly.js',
  literals: [...literals].sort(),
  claims,
}, null, 2) + '\n');

const unused = Object.keys(M).filter(k => !usedMeasures.has(k));
console.log(`hebdo ${man.publish_date} — ${S.length} sections, ${(html.length / 1024).toFixed(1)} Ko`);
console.log(`  ${Object.keys(M).length} mesures calculées, ${usedMeasures.size} employées, ${claims.length} preuves émises`);
console.log(`  catalyseur ${man.event_leader} · ${CHAIN.length} noms dans la chaîne, ${COUNTS.chain_pos} positifs sur le mois`);
if (unused.length) console.log(`  (${unused.length} mesures calculées non employées)`);
