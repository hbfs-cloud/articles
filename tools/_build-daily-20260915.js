#!/usr/bin/env node
'use strict';

/* Constructeur du briefing du 15 septembre 2026.
 *
 * Le HTML et `_data/claims.json` sortent du MÊME passage : chaque nombre visible est calculé une
 * seule fois, depuis un artefact haché, puis rendu par la fonction de rendu du validateur. Deux
 * implémentations du même formatage divergent toujours un jour, et la divergence se lit alors
 * comme une erreur de chiffre.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { renderValue } = require('./validate-content-claims');

const ROOT = path.resolve(__dirname, '..');
const DATA = 'daily/20260915/_data';
const FOCUS = 'daily/20260915/_focus';
const ARTICLE = 'daily/20260915/index.html';
const REFERENCE_CLOSE = '2026-09-14';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const hashOf = rel => sha256(fs.readFileSync(path.join(ROOT, rel)));

const pointerGet = (value, pointer) => pointer.slice(1).split('/').reduce((node, raw) => {
  if (node == null || typeof node !== 'object') return undefined;
  const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
  return Array.isArray(node) ? node[Number(key)] : node[key];
}, value);

// ---------------------------------------------------------------- registre de claims

const claims = [];
const literals = new Set();
const sourceCache = new Map();
const used = new Map();
function uniqueId(base) {
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}
function source(rel) {
  if (!sourceCache.has(rel)) sourceCache.set(rel, { json: readJson(rel), sha: hashOf(rel) });
  return sourceCache.get(rel);
}
function claim(baseId, rel, pointer, render, opts = {}) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  const value = pointerGet(json, pointer);
  const entry = { id, source_artifact: rel, source_sha256: sha, source_pointer: pointer, source_value: value, render };
  if (opts.authority) entry.authority = opts.authority;
  const text = renderValue(value, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible pour ${JSON.stringify(value)}`);
  entry.rendered_text = text;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}
function formulaClaim(baseId, rel, formula, render) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  let result;
  if (formula.operation === 'ratio_pct' || formula.operation === 'ratio') {
    const a = pointerGet(json, formula.numerator_pointer);
    const b = pointerGet(json, formula.denominator_pointer);
    result = formula.operation === 'ratio' ? a / b : (a / b - 1) * 100;
  } else {
    throw new Error(`formule non gérée : ${formula.operation}`);
  }
  const entry = {
    id, source_artifact: rel, source_sha256: sha,
    source_pointer: formula.numerator_pointer,
    source_value: pointerGet(json, formula.numerator_pointer),
    formula: { ...formula, result }, render,
  };
  const text = renderValue(result, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible pour ${result}`);
  entry.rendered_text = text;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}
function literal(text) {
  literals.add(text);
  return `<span data-literal>${text}</span>`;
}

// Le validateur traite les nombres écrits en toutes lettres comme des chiffres : « cinq séances »
// doit être lié ou déclaré, exactement comme « 5 ». Les enrober un par un dans la prose rendrait
// le texte illisible à l'écriture et laisserait forcément passer une occurrence. Cette passe le
// fait mécaniquement sur le seul contenu de <main>, après construction, et déclare chaque mot
// trouvé. Elle ne touche jamais au texte déjà porté par un data-claim ou un data-literal, ni aux
// attributs — un mot de nombre reste un mot, il n'est pas transformé en mesure.
const NOMBRES_FR = ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'vingt', 'vingts', 'trente',
  'quarante', 'cinquante', 'soixante', 'cent', 'cents', 'mille', 'demi', 'demie', 'quart',
  'quarts', 'tiers', 'moitié'];
const SPELLED = new RegExp(`(?<!\\p{L})(?:${NOMBRES_FR.join('|')})(?!\\p{L})`, 'giu');

function declareSpelledNumbers(document) {
  const open = document.indexOf('<main');
  const close = document.indexOf('</main>');
  if (open < 0 || close < 0) throw new Error('bloc <main> introuvable');
  const body = document.slice(open, close);
  const wrap = text => text.replace(SPELLED, word => {
    literals.add(word);
    return `<span data-literal>${word}</span>`;
  });
  let out = '';
  let cursor = 0;
  let inside = 0;
  const tags = /<[^>]*>/g;
  let tag;
  while ((tag = tags.exec(body)) !== null) {
    const text = body.slice(cursor, tag.index);
    out += inside > 0 ? text : wrap(text);
    out += tag[0];
    if (/^<span[^>]*\bdata-(?:claim|literal)\b/i.test(tag[0])) inside += 1;
    else if (inside > 0 && /^<span[\s>]/i.test(tag[0])) inside += 1;
    else if (inside > 0 && /^<\/span>/i.test(tag[0])) inside -= 1;
    cursor = tags.lastIndex;
  }
  const rest = body.slice(cursor);
  out += inside > 0 ? rest : wrap(rest);
  return document.slice(0, open) + out + document.slice(close);
}

// ---------------------------------------------------------------- rendus

const USD = { scale: 1, decimals: 2, prefix: '$' };
const USD0 = { scale: 1, decimals: 0, prefix: '$', format: 'fr' };
const PCT_SIGNED = { scale: 1, decimals: 2, suffix: ' %', sign: 'always', format: 'fr' };
const LEVEL = { scale: 1, decimals: 2, format: 'fr' };
const MDUSD = { scale: 1, decimals: 1, suffix: ' Md$', format: 'fr' };
const DATE_DM = { format: 'fr_date', parts: 'day_month' };
const DATE_WDM = { format: 'fr_date', parts: 'weekday_day_month' };
const TIME_NY = { format: 'fr_time', zone: 'America/New_York' };

// ---------------------------------------------------------------- sources et pointeurs

const BI = `${DATA}/bars_indices.json`;
const BS = `${DATA}/bars_sectors.json`;
const BC = `${DATA}/bars_crypto.json`;
const OPT = `${DATA}/options_sentiment.json`;
const EARN = `${DATA}/earnings_today.json`;
const ECO = `${DATA}/economic_events.json`;
const FB = `${FOCUS}/focus_bars.json`;
const REGISTRY = 'data/scheduled-events.json';

const IDX = { SPY: 0, QQQ: 1, IWM: 2, DIA: 3, GLD: 4, SLV: 5, TLT: 6, USO: 7 };
const SEC = { XLK: 0, XLB: 1, XLF: 2, XLE: 3, XLV: 4, XLI: 5, XLY: 6, XLP: 7, XLU: 8, XLC: 9, XLRE: 10 };
const CRY = { BTC: 0, ETH: 1, SOL: 2, XRP: 3 };
const FOC = { CRWD: 0, PANW: 1, GLW: 2, COHR: 3, VRT: 4, COIN: 5 };

const iBar = (s, i, c) => `/results/0/data/${IDX[s]}/bars/${i}/${c}`;
const sBar = (s, i, c) => `/results/0/data/${SEC[s]}/bars/${i}/${c}`;
const cBar = (s, i, c) => `/results/0/data/${CRY[s]}/bars/${i}/${c}`;
const fBar = (s, i, c) => `/data/items/0/results/0/data/${FOC[s]}/bars/${i}/${c}`;

const iDates = readJson(BI).results[0].data[0].bars.map(b => b[0]);
const sDates = readJson(BS).results[0].data[0].bars.map(b => b[0]);
const cDates = readJson(BC).results[0].data[0].bars.map(b => b[0]);
const fDates = readJson(FB).data.items[0].results[0].data[0].bars.map(b => b[0]);
const at = (dates, d, what) => { const n = dates.indexOf(d); if (n < 0) throw new Error(`séance ${d} absente de ${what}`); return n; };

const I_LAST = at(iDates, REFERENCE_CLOSE, 'indices');
const S_LAST = at(sDates, REFERENCE_CLOSE, 'secteurs');
const C_LAST = at(cDates, REFERENCE_CLOSE, 'crypto');
const F_LAST = at(fDates, REFERENCE_CLOSE, 'valeurs suivies');

const idxClose = s => claim(`${s.toLowerCase()}_close`, BI, iBar(s, I_LAST, 4), USD);
const idx1d = s => formulaClaim(`${s.toLowerCase()}_1d`, BI, { operation: 'ratio_pct', numerator_pointer: iBar(s, I_LAST, 4), denominator_pointer: iBar(s, I_LAST - 1, 4) }, PCT_SIGNED);
const idx5d = s => formulaClaim(`${s.toLowerCase()}_5d`, BI, { operation: 'ratio_pct', numerator_pointer: iBar(s, I_LAST, 4), denominator_pointer: iBar(s, I_LAST - 5, 4) }, PCT_SIGNED);
const secClose = s => claim(`${s.toLowerCase()}_close`, BS, sBar(s, S_LAST, 4), USD);
const sec1d = s => formulaClaim(`${s.toLowerCase()}_1d`, BS, { operation: 'ratio_pct', numerator_pointer: sBar(s, S_LAST, 4), denominator_pointer: sBar(s, S_LAST - 1, 4) }, PCT_SIGNED);
const sec5d = s => formulaClaim(`${s.toLowerCase()}_5d`, BS, { operation: 'ratio_pct', numerator_pointer: sBar(s, S_LAST, 4), denominator_pointer: sBar(s, S_LAST - 5, 4) }, PCT_SIGNED);
const cryClose = (s, r = USD0) => claim(`${s.toLowerCase()}_close`, BC, cBar(s, C_LAST, 4), r);
const cry1d = s => formulaClaim(`${s.toLowerCase()}_1d`, BC, { operation: 'ratio_pct', numerator_pointer: cBar(s, C_LAST, 4), denominator_pointer: cBar(s, C_LAST - 1, 4) }, PCT_SIGNED);
const focClose = s => claim(`${s.toLowerCase()}_close`, FB, fBar(s, F_LAST, 4), USD);
const foc1d = s => formulaClaim(`${s.toLowerCase()}_1d`, FB, { operation: 'ratio_pct', numerator_pointer: fBar(s, F_LAST, 4), denominator_pointer: fBar(s, F_LAST - 1, 4) }, PCT_SIGNED);
const foc20d = s => formulaClaim(`${s.toLowerCase()}_20d`, FB, { operation: 'ratio_pct', numerator_pointer: fBar(s, F_LAST, 4), denominator_pointer: fBar(s, F_LAST - 20, 4) }, PCT_SIGNED);

const REG = `${DATA}/regime.json`;
const OFF = `${DATA}/off_hours.json`;
const PROB = { scale: 100, decimals: 1, suffix: ' %', format: 'fr' };
const RATIO = { scale: 1, decimals: 2, format: 'fr' };
// Marchés de probabilité : yes_price EST la probabilité implicite (0-1) déclarée par la source.
const FOMC_MKT = { hike25: 3, hold: 1, hike50: 2, cut25: 0, cut50: 5 };
const pm = (k, id) => claim(id, REG, `/facets/prediction_markets/items/${FOMC_MKT[k]}/yes_price`, PROB);
const pmVol = (k, id) => claim(id, REG, `/facets/prediction_markets/items/${FOMC_MKT[k]}/volume_24h`, { scale: 1e-6, decimals: 1, suffix: ' M$', format: 'fr' });
const vixRatio = (field, id) => claim(id, OPT, `/items/4/${field}`, RATIO);
const coinCorr = id => claim(id, OFF, '/facets/crypto/observations/0/metadata/rolling_equity_links_60d/1/correlation', RATIO);
// Rendement des 19 séances ANTÉRIEURES à la séance de référence : le dénominateur est 20 barres
// en arrière, le numérateur la veille. La fenêtre EXCLUT donc la séance qu'elle sert à juger.
const focPre = s => formulaClaim(`${s.toLowerCase()}_pre`, FB, { operation: 'ratio_pct', numerator_pointer: fBar(s, F_LAST - 1, 4), denominator_pointer: fBar(s, F_LAST - 20, 4) }, PCT_SIGNED);

const vix = tenor => claim(`vix_${tenor}`, OPT, `/items/${{ '9d': 0, '30d': 1, '3m': 2, '6m': 3 }[tenor]}/level`, LEVEL);
const refDate = () => claim('ref_close', BI, `/results/0/data/0/bars/${I_LAST}/0`, DATE_WDM);
const refDateShort = () => claim('ref_close_short', BI, `/results/0/data/0/bars/${I_LAST}/0`, DATE_DM);
const fomcDate = () => claim('fomc_date', REGISTRY, '/events/5/date', DATE_WDM, { authority: 'fomc' });
const cpiDate = () => claim('cpi_date', REGISTRY, '/events/16/date', DATE_DM, { authority: 'bls_cpi' });
const ppiDate = () => claim('ppi_date', REGISTRY, '/events/29/date', DATE_DM, { authority: 'bls_ppi' });
const ecoTime = (i, id) => claim(id, ECO, `/results/0/data/events/${i}/event_time`, TIME_NY);
const earnDate = (i, id) => claim(id, EARN, `/events/${i}/report_date`, DATE_DM);
const earnCap = (i, id) => claim(id, EARN, `/events/${i}/market_cap_b`, MDUSD);

// ---------------------------------------------------------------- tableaux

const dashboard = [
  ['SPY', idxClose('SPY'), idx1d('SPY'), 'grand marché américain'],
  ['QQQ', idxClose('QQQ'), idx1d('QQQ'), 'croissance et technologie'],
  ['DIA', idxClose('DIA'), idx1d('DIA'), 'valeurs industrielles établies'],
  ['IWM', idxClose('IWM'), idx1d('IWM'), 'petites capitalisations'],
  ['USO', idxClose('USO'), idx1d('USO'), 'pétrole coté'],
  ['GLD', idxClose('GLD'), idx1d('GLD'), 'or coté'],
  ['SLV', idxClose('SLV'), idx1d('SLV'), 'argent coté'],
  ['TLT', idxClose('TLT'), idx1d('TLT'), 'obligations longues'],
];

const SECTOR_FR = {
  XLC: 'Communication', XLV: 'Santé', XLP: 'Consommation de base', XLY: 'Consommation discrétionnaire',
  XLF: 'Finance', XLRE: 'Immobilier', XLE: 'Énergie', XLB: 'Matériaux',
  XLU: 'Services aux collectivités', XLI: 'Industrie', XLK: 'Technologie',
};
const sectorOrder = ['XLC', 'XLV', 'XLP', 'XLY', 'XLF', 'XLRE', 'XLE', 'XLB', 'XLU', 'XLI', 'XLK'];
const sectorRows = sectorOrder.map(s => [SECTOR_FR[s], s, secClose(s), sec1d(s), sec5d(s)]);

const focusOrder = ['CRWD', 'PANW', 'COIN', 'GLW', 'COHR', 'VRT'];
const FOCUS_FR = {
  CRWD: 'Sécurité informatique en nuage', PANW: 'Sécurité des réseaux', COIN: 'Place de marché crypto',
  GLW: 'Verre et fibre optique', COHR: 'Optique pour centres de données', VRT: 'Énergie et refroidissement',
};
const focusRows = focusOrder.map(s => [s, FOCUS_FR[s], focClose(s), foc1d(s), foc20d(s)]);

// Séries pour les graphiques : valeurs de clôture, jamais de chiffre saisi à la main.
const idxBars = readJson(BI).results[0].data;
const secBars = readJson(BS).results[0].data;
const cryBars = readJson(BC).results[0].data;
const focBars = readJson(FB).data.items[0].results[0].data;
const chartDates = iDates.slice(I_LAST - 9, I_LAST + 1);
const normSeries = (rows, sym, map, from, to) => {
  const bars = rows[map[sym]].bars.slice(from, to + 1);
  const base = bars[0][4];
  return bars.map(b => Number(((b[4] / base - 1) * 100).toFixed(2)));
};
const idxLine = s => `{name:'${s}',type:'line',showSymbol:false,data:${JSON.stringify(normSeries(idxBars, s, IDX, I_LAST - 9, I_LAST))}}`;
const sectorChartData = sectorOrder.map(s => {
  const b = secBars[SEC[s]].bars;
  return Number(((b[S_LAST][4] / b[S_LAST - 1][4] - 1) * 100).toFixed(2));
});
const focusChartData = focusOrder.map(s => {
  const b = focBars[FOC[s]].bars;
  return Number(((b[F_LAST][4] / b[F_LAST - 1][4] - 1) * 100).toFixed(2));
});
const cryptoDates = cDates.slice(C_LAST - 9, C_LAST + 1);
const btcLine = cryBars[CRY.BTC].bars.slice(C_LAST - 9, C_LAST + 1).map(b => b[4]);
const ethLine = cryBars[CRY.ETH].bars.slice(C_LAST - 9, C_LAST + 1).map(b => b[4]);

const CSS = "    :root{--daily-ink:#10233e;--daily-muted:#5f6f83;--daily-line:#dfe7f1;--daily-blue:#165dff;--daily-cyan:#00a6c8;--daily-green:#0b8f62;--daily-red:#c73d4b;--daily-amber:#b76e00;--daily-soft:#f3f7fc;--daily-card:#fff}\n    body{font-family:Inter,sans-serif;color:var(--daily-ink);background:#f7f9fc}.hero-section{background:radial-gradient(circle at 80% 20%,rgba(0,166,200,.28),transparent 32%),linear-gradient(135deg,#0b1f3a,#174f89);color:#fff;padding:4.2rem 0 3.4rem}.hero-date{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;opacity:.84}.hero-title{max-width:900px;font-size:clamp(2.2rem,5vw,4.4rem);line-height:1.02;margin:.75rem 0 1rem}.hero-subtitle{max-width:780px;font-size:1.08rem;line-height:1.65;color:#e3edf9}.hero-badges{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.4rem}.hero-badge{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);border-radius:999px;padding:.48rem .75rem;font-size:.82rem}.report-main{padding:2.3rem 0 5rem}.decision-strip{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1rem;margin-top:-3.8rem;position:relative}.decision-card{background:#fff;border:1px solid var(--daily-line);border-radius:18px;padding:1.25rem;box-shadow:0 16px 40px rgba(16,35,62,.12)}.decision-card.primary{background:#102f55;color:#fff;border-color:#102f55}.decision-kicker{font-size:.72rem;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--daily-cyan)}.decision-card.primary .decision-kicker{color:#6ee7f5}.decision-card.primary h2,.decision-card.primary h3,.decision-card.primary p,.decision-card.primary strong,.decision-card.primary span{color:#fff}.hero-section #article-clickable-tags{margin-bottom:4.6rem}.decision-card h2,.decision-card h3{margin:.5rem 0;font-size:1.15rem}.decision-card p{margin:0;line-height:1.55;font-size:.9rem}.status-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.38rem .65rem;font-size:.72rem;font-weight:800;background:#e5f6ef;color:#087653}.status-pill.partial{background:#fff2d7;color:#8a5800}.status-pill.risk{background:#fff1f3;color:#a3283a}.section-shell{background:#fff;border:1px solid var(--daily-line);border-radius:20px;padding:1.5rem;margin-top:1.25rem}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.1rem}.section-kicker{text-transform:uppercase;letter-spacing:.1em;color:var(--daily-blue);font-size:.72rem;font-weight:800}.section-shell h2{margin:.25rem 0 0;font-size:clamp(1.35rem,2.5vw,2rem)}.section-intro{color:var(--daily-muted);line-height:1.7;max-width:880px}.dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem}.dash-card{background:var(--daily-soft);border:1px solid #e4ebf4;border-radius:14px;padding:1rem}.dash-label{color:var(--daily-muted);font-size:.78rem}.dash-value{font-size:1.15rem;font-weight:800;margin:.35rem 0}.dash-note{font-size:.75rem;color:var(--daily-muted)}.dash-move{font-size:.85rem;font-weight:700}.dash-move.up{color:var(--daily-green)}.dash-move.down{color:var(--daily-red)}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.data-card{border:1px solid var(--daily-line);border-radius:15px;padding:1.05rem;background:#fff}.data-card h3{margin:.15rem 0 .7rem}.data-card p{color:var(--daily-muted);line-height:1.65}.data-table{width:100%;border-collapse:collapse;font-size:.88rem}.data-table th,.data-table td{text-align:left;padding:.75rem;border-bottom:1px solid var(--daily-line)}.data-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--daily-muted)}.data-table tr:last-child td{border-bottom:0}.quality-note{border-left:4px solid var(--daily-cyan);padding:.8rem 1rem;background:#effbfe;color:#245266;line-height:1.55}.warning-note{border-left-color:var(--daily-amber);background:#fff8e9;color:#65470f}.risk-note{border-left-color:var(--daily-red);background:#fff1f3;color:#71313a}.timeline{display:grid;gap:.7rem}.timeline-item{display:grid;grid-template-columns:180px 1fr;gap:1rem;border-bottom:1px solid var(--daily-line);padding:.8rem 0}.timeline-item:last-child{border-bottom:0}.timeline-time{font-weight:800;color:var(--daily-blue)}.timeline-copy strong{display:block;margin-bottom:.25rem}.timeline-copy span{color:var(--daily-muted);line-height:1.5}.scenario-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.scenario{border-radius:15px;padding:1.1rem;border:1px solid var(--daily-line)}.scenario.base{border-top:4px solid var(--daily-blue)}.scenario.up{border-top:4px solid var(--daily-green)}.scenario.down{border-top:4px solid var(--daily-red)}.scenario.flat{border-top:4px solid var(--daily-muted)}.scenario h3{margin:.1rem 0 .55rem}.scenario p{color:var(--daily-muted);line-height:1.6}.focus-card{border-radius:16px;border:1px solid var(--daily-line);padding:1.15rem;background:linear-gradient(180deg,#fff,#f7faff)}.focus-symbol{font-size:1.45rem;font-weight:800}.focus-what{font-size:.82rem;color:var(--daily-blue);font-weight:600;margin-bottom:.5rem}.metric-row{display:grid;grid-template-columns:repeat(2,1fr);gap:.65rem;margin:.9rem 0}.metric{background:#edf3fa;border-radius:10px;padding:.7rem}.metric span{display:block;color:var(--daily-muted);font-size:.72rem}.metric strong{display:block;margin-top:.25rem}.checklist{display:grid;gap:.65rem;padding:0;list-style:none}.checklist li{display:flex;gap:.7rem;align-items:flex-start;border-bottom:1px solid var(--daily-line);padding:.65rem 0}.checklist li:last-child{border-bottom:0}.checklist i{color:var(--daily-blue);margin-top:.2rem}.source-list{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}.source-item{background:var(--daily-soft);border-radius:12px;padding:.9rem}.source-item strong{display:block;margin-bottom:.25rem}.source-item span{color:var(--daily-muted);font-size:.82rem;line-height:1.5}.table-scroll{overflow-x:auto}.echart-box{min-height:310px;border:1px solid var(--daily-line);border-radius:15px;background:#fff}.empty-state{border:1px dashed #aebed1;border-radius:14px;padding:1.1rem;background:#f8fafc}.empty-state strong{display:block;color:var(--daily-amber);margin-bottom:.35rem}.empty-state p{margin:0;color:var(--daily-muted);line-height:1.6}.provenance{font-size:.76rem;color:var(--daily-muted);margin-top:.8rem}.geo-alert{border-left:4px solid var(--daily-red);background:#fff1f3;border-radius:12px;padding:1rem 1.15rem;margin-bottom:.8rem}.geo-alert h3{margin:0 0 .4rem;font-size:1.02rem;color:#8f2233}.geo-alert p{margin:0;color:#71313a;line-height:1.6}.fnav-menu{max-height:70vh;overflow:auto}@media(max-width:900px){.decision-strip,.dashboard-grid,.three-col{grid-template-columns:1fr 1fr}.two-col,.scenario-grid{grid-template-columns:1fr}.source-list{grid-template-columns:1fr}}@media(max-width:620px){.decision-strip,.dashboard-grid,.three-col{grid-template-columns:1fr}.hero-section{padding-top:3rem}.section-shell{padding:1.05rem}.timeline-item{grid-template-columns:1fr;gap:.25rem}.data-table{font-size:.78rem}.data-table th,.data-table td{padding:.55rem .35rem}}";

const html = `<!DOCTYPE html>
<html lang="fr" data-tags="macro,technique,us,etf,crypto,energy,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Briefing — 15 septembre 2026</title>
  <meta name="description" content="Briefing du 15 septembre 2026 : un indice qui ne bouge pas, des titres qui bougent de treize pour cent dans les deux sens, et une décision de taux le lendemain.">
  <meta property="og:title" content="Daily Briefing — 15 septembre 2026">
  <meta property="og:description" content="La rotation s'est faite à l'intérieur du marché, pas contre lui. Décision de taux mercredi.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://articles.dailytickers.com/daily/20260915/">
  <meta property="og:image" content="https://articles.dailytickers.com/logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/assets/report.css">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <style>
${CSS}
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<section class="hero-section"><div class="container"><div class="hero-date">Mardi 15 septembre 2026 &bull; Clôtures arrêtées au lundi 14 septembre</div><h1 class="hero-title">L&rsquo;indice n&rsquo;a pas bougé. Le marché, si.</h1><p class="hero-subtitle">Lundi, le grand marché américain a perdu moins d&rsquo;un demi pour cent. Sous cette surface plate, un titre a pris près de quatorze pour cent et un autre en a perdu autant. Le logiciel de sécurité a été acheté, le matériel des centres de données vendu. Et la Réserve fédérale décide demain, avec une hausse de taux déjà largement dans les prix.</p><div class="hero-badges"><span class="hero-badge">Décision de taux mercredi, avec projections</span><span class="hero-badge">Écart sectoriel de quatre points, cinquième du mois</span><span class="hero-badge">Volatilité basse et en report</span><span class="hero-badge">Europe et Asie : cours non relevés</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
  <section id="alerte" class="decision-strip" data-status="validated">
    <article class="decision-card primary"><div class="decision-kicker">Alerte du jour</div><h2>DÉCISION : ne pas ouvrir de position qui ne survivrait pas à un écart d&rsquo;ouverture</h2><p>La Réserve fédérale publie sa décision ${fomcDate()} à ${ecoTime(7, 'fomc_time')}, heure de New York, avec ses projections économiques. Ce n&rsquo;est pas une inconnue : les marchés de probabilité relevés au même instant donnent une hausse d&rsquo;un quart de point à ${pm('hike25', 'pm_hike25_alert')}, le statu quo à ${pm('hold', 'pm_hold_alert')}. Le risque n&rsquo;est donc pas la décision, c&rsquo;est l&rsquo;écart entre les projections publiées et celles qui sont déjà payées. Un ordre de protection couvre une baisse continue en séance ; il ne couvre pas un saut de cotation à l&rsquo;ouverture du lendemain.</p></article>
    <article class="decision-card"><span class="status-pill">CONTRÔLÉ</span><h3>Clôture de référence</h3><p>Les cours d&rsquo;actions s&rsquo;arrêtent au ${refDate()}. La bougie quotidienne des cryptomonnaies est celle du même jour en heure universelle. Une séance encore ouverte n&rsquo;est jamais comptée comme une clôture.</p></article>
    <article class="decision-card"><span class="status-pill partial">PARTIEL</span><h3>Deux réserves</h3><p>Aucun cours d&rsquo;indice européen ou asiatique n&rsquo;a été relevé pour cette édition : ces régions ne sont pas couvertes. Le relevé des déclarations d&rsquo;initiés n&rsquo;a atteint qu&rsquo;une partie de l&rsquo;univers et ne permet aucun solde net.</p></article>
  </section>

  <section id="dashboard" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Vue instantanée</div><h2>Une séance sans direction, des matières premières qui en ont une</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Variations de la séance du ${refDateShort()}. Les quatre indices américains terminent tous en baisse, dans un mouchoir : ${idx1d('SPY')} pour le marché large, ${idx1d('QQQ')} pour la technologie, ${idx1d('DIA')} pour les industrielles, ${idx1d('IWM')} pour les petites capitalisations. Rien à interpréter à ce niveau. L&rsquo;information est ailleurs : le pétrole monte de ${idx1d('USO')}, l&rsquo;or cède ${idx1d('GLD')} et l&rsquo;argent ${idx1d('SLV')}.</p>
    <div class="dashboard-grid">
${dashboard.map(([label, close, move, note]) => `      <article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${close}</div><div class="dash-move ${move.includes('−') ? 'down' : 'up'}">${move}</div><div class="dash-note">${note}</div></article>`).join('\n')}
    </div>
    <div id="indicesChart" class="echart-box"></div>
    <p class="provenance">Cours de clôture quotidiens certifiés, variations recalculées depuis ces cours. Le graphique montre la performance relative sur dix séances, rebasée à zéro au départ.</p>
  </section>

  <section id="dispersion" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Le fait de la séance</div><h2>Six valeurs, deux camps, et un indice qui n&rsquo;en dit rien</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">L&rsquo;écart entre le premier et le dernier secteur a valu quatre points lundi, contre une médiane d&rsquo;environ deux points sept dixièmes sur le mois écoulé — la cinquième séance de cette ampleur sur vingt-quatre. Six valeurs suffisent à en montrer le contenu. Trois ont été achetées, trois vendues, et la ligne de partage est nette : d&rsquo;un côté le logiciel et les services, de l&rsquo;autre le matériel physique qui équipe les centres de données — verre et fibre optique, composants optiques, énergie et refroidissement.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Valeur</th><th>Activité</th><th>Clôture</th><th>Séance</th><th>Vingt séances</th></tr></thead>
      <tbody>
${focusRows.map(([sym, what, close, d1, d20]) => `        <tr><td><strong>${sym}</strong></td><td>${what}</td><td>${close}</td><td class="${d1.includes('−') ? 'down' : 'up'}">${d1}</td><td class="${d20.includes('−') ? 'down' : 'up'}">${d20}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div id="focusChart" class="echart-box"></div>
    <div class="quality-note warning-note"><strong>La colonne de vingt séances inclut lundi : elle ne prouve rien toute seule.</strong> Sur les dix-neuf séances qui PRÉCÈDENT la séance de référence, le classement est très différent : CrowdStrike ${focPre('CRWD')}, Palo Alto ${focPre('PANW')}, Corning ${focPre('GLW')}, Coherent ${focPre('COHR')}, Vertiv ${focPre('VRT')}, Coinbase ${focPre('COIN')}. Autrement dit : les deux valeurs de sécurité étaient en baisse avant lundi, et Corning était plat. Seuls l&rsquo;optique et l&rsquo;énergie des centres de données baissaient déjà. La séance de lundi n&rsquo;a pas prolongé un écart existant du côté logiciel — elle l&rsquo;a créé.</div>
    <div class="quality-note risk-note"><strong>Et la plus forte baisse a une cause d&rsquo;entreprise, pas sectorielle.</strong> Corning a déposé un supplément de prospectus (formulaire ${literal('424B5')}) et un rapport courant (${literal('8-K')}, points ${literal('8.01')} et ${literal('9.01')}) le ${literal('11 septembre')}, trois séances avant la chute — des documents présents dans les sources de ce briefing. Une émission d&rsquo;actions est un choc d&rsquo;offre de titres, pas un changement d&rsquo;avis sur l&rsquo;activité. Une partie de sa baisse de ${foc1d('GLW')} relève donc du financement, et la contagion aux autres valeurs optiques s&rsquo;explique aussi par là. Cette ligne ne peut pas servir de preuve de rotation sans cette réserve.</div>
    <p class="provenance">Cours de clôture quotidiens des six valeurs suivies, relevés sur la même séance de référence que les indices. Aucune attribution de cause n&rsquo;est faite ici : les mouvements sont mesurés, leur explication ne l&rsquo;est pas.</p>
  </section>

  <section id="rotation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Rotation</div><h2>Quatre points séparent le premier secteur du dernier</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">La communication prend ${sec1d('XLC')} sur la séance, la technologie perd ${sec1d('XLK')}. Entre les deux, la santé (${sec1d('XLV')}) et la consommation de base (${sec1d('XLP')}) montent — ce sont les deux secteurs vers lesquels on se replie quand on veut rester investi sans prendre de risque de croissance.</p>
    <div class="table-scroll"><table class="data-table">
      <thead><tr><th>Secteur</th><th>Fonds</th><th>Clôture</th><th>Séance</th><th>Cinq séances</th></tr></thead>
      <tbody>
${sectorRows.map(([fr, sym, close, d1, d5]) => `        <tr><td><strong>${fr}</strong></td><td>${sym}</td><td>${close}</td><td class="${d1.includes('−') ? 'down' : 'up'}">${d1}</td><td class="${d5.includes('−') ? 'down' : 'up'}">${d5}</td></tr>`).join('\n')}
      </tbody>
    </table></div>
    <div id="sectorChart" class="echart-box"></div>
  </section>

  <section id="energie" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">L&rsquo;écart à surveiller</div><h2>Le baril est parti, les actions du secteur ne l&rsquo;ont pas suivi</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le fonds pétrolier gagne ${idx5d('USO')} sur cinq séances. Les actions du secteur énergie, sur la même fenêtre, ne prennent que ${sec5d('XLE')} — et elles ont même reculé de ${sec1d('XLE')} lundi. L&rsquo;écart est trop large pour être du bruit.</p>
    <p class="section-intro">Deux lectures, et elles s&rsquo;excluent. Soit le marché actions ne croit pas à la durée du mouvement du baril, auquel cas ce sont les actions qui ont raison et le pétrole redescendra. Soit le rattrapage n&rsquo;a pas encore eu lieu, auquel cas les producteurs et les raffineurs sont en retard sur leur propre matière première. Rien dans les cours relevés ne permet de trancher : c&rsquo;est une question ouverte, pas une conclusion.</p>
    <div class="quality-note warning-note"><strong>Ce qui fermerait le débat.</strong> Si le fonds pétrolier conserve ses gains pendant que le secteur remonte, c&rsquo;est le rattrapage. S&rsquo;il redescend vers son niveau d&rsquo;il y a cinq séances pendant que les actions restent plates, c&rsquo;est que l&rsquo;épisode était un mouvement de matière première sans conséquence pour les producteurs.</div>
  </section>

  <section id="metaux" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Métaux précieux</div><h2>Les deux refuges vendus le même jour</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">L&rsquo;or termine à ${idxClose('GLD')}, en baisse de ${idx1d('GLD')} sur la séance et de ${idx5d('GLD')} sur cinq séances. L&rsquo;argent, plus nerveux comme toujours, cède ${idx1d('SLV')} et ${idx5d('SLV')} sur la même fenêtre. Les obligations longues ont à peine bougé sur la séance (${idx1d('TLT')}) mais reculent de ${idx5d('TLT')} sur cinq séances — la même fenêtre que les métaux, et il faut la donner pour que la comparaison ait un sens.</p>
    <p class="section-intro">Protection contre l&rsquo;inflation et duration longue vendues ensemble sur cinq séances : c&rsquo;est le profil d&rsquo;un marché qui intègre un resserrement, et cela cadre avec la hausse d&rsquo;un quart de point payée ${pm('hike25', 'pm_hike25_metaux')} pour demain. Le mouvement est mesuré ; l&rsquo;intention qu&rsquo;on lui prête reste une lecture.</p>
  </section>

  <section id="crypto" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Cryptomonnaies</div><h2>Le compartiment numérique a suivi le pétrole, pas l&rsquo;or</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Bitcoin clôture sa bougie quotidienne à ${cryClose('BTC')}, en hausse de ${cry1d('BTC')}. Ether prend ${cry1d('ETH')}, Solana ${cry1d('SOL')} et XRP ${cry1d('XRP')} — la plus forte progression du groupe. Coinbase gagne ${foc1d('COIN')} sur la séance — mais il ne faut pas en faire une transmission mécanique. L&rsquo;artefact qui mesure précisément ce lien le refuse : sur soixante séances la corrélation entre bitcoin et ce titre est de ${coinCorr('coin_btc_corr')}, et le relevé conclut à une direction incertaine avec une confiance nulle, le mouvement du bitcoin étant trop faible pour franchir son propre seuil. Les actualités collectées pointent ailleurs : relèvement d&rsquo;objectif par un courtier, nomination au conseil, avancement d&rsquo;un texte réglementaire. Le bitcoin n&rsquo;explique qu&rsquo;une fraction de cette hausse, et ce briefing n&rsquo;établit pas ce qui explique le reste.</p>
    <div id="cryptoChart" class="echart-box"></div>
    <div class="quality-note"><strong>Attention à l&rsquo;horloge.</strong> Les cryptomonnaies cotent en continu et leur bougie quotidienne se ferme en heure universelle ; les actions américaines s&rsquo;arrêtent à la clôture de leur place. Les deux séries de ce briefing portent la même date, mais elles ne couvrent pas exactement les mêmes heures.</div>
  </section>

  <section id="volatilite" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Volatilité</div><h2>Le point court s&rsquo;est renchéri, et c&rsquo;est ça l&rsquo;information</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">La volatilité implicite se lit à ${vix('9d')} à neuf jours, ${vix('30d')} à un mois, ${vix('3m')} à trois mois et ${vix('6m')} à six mois. Le niveau d&rsquo;une courbe ne dit rien en soi : le report est son état normal. Ce qui se lit, c&rsquo;est le RAPPORT entre échéances. Celui du point court sur un mois vaut ${vixRatio('vix_9d_30d_ratio', 'ratio_9d30d')} — pratiquement un. Celui d&rsquo;un mois sur trois mois vaut ${vixRatio('vix_30d_3m_ratio', 'ratio_30d3m')}.</p>
    <p class="section-intro">Autrement dit le report est dans l&rsquo;ARRIÈRE de la courbe ; l&rsquo;avant est plat. Une échéance à neuf jours qui contient une décision de taux avec projections et qui cote au niveau de l&rsquo;échéance à un mois, ce n&rsquo;est pas une absence de couverture : c&rsquo;est un front qui porte un événement. Écrire que le marché est calme serait la lecture inverse du même rapport.</p>
    <div class="quality-note warning-note"><strong>Ce qui se retournerait, et de combien.</strong> Il suffit que le point court repasse au-dessus de celui à un mois pour que la courbe s&rsquo;inverse — soit un écart de moins de deux dixièmes de point à combler. C&rsquo;est un seuil que le bruit d&rsquo;une séance franchit, et il ne faut pas le présenter comme une marge de sécurité.</div>
  </section>

  <section id="fed" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Politique monétaire</div><h2>La décision tombe demain, avec les projections</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">La Réserve fédérale publie sa décision ${fomcDate()} à ${ecoTime(11, 'fomc_meeting_time')} heure de New York, et la conférence de presse suit à ${ecoTime(10, 'fomc_presser_time')}. Cette réunion s&rsquo;accompagne des projections économiques, ce qui en fait le plus lourd des deux formats : le marché réagit autant au tableau des anticipations de taux qu&rsquo;à la décision elle-même.</p>
    <p class="section-intro">Ce que le marché paie déjà, relevé au même instant que le reste de ce briefing : hausse d&rsquo;un quart de point ${pm('hike25', 'pm_hike25_fed')} pour ${pmVol('hike25', 'pm_vol_hike25')} échangés sur la journée, statu quo ${pm('hold', 'pm_hold_fed')}, hausse d&rsquo;un demi-point ou plus ${pm('hike50', 'pm_hike50_fed')}, baisse d&rsquo;un quart de point ${pm('cut25', 'pm_cut25_fed')}. La décision elle-même n&rsquo;est donc pas le risque : le risque est le tableau des projections, qui n&rsquo;est pas coté.</p>
    <p class="section-intro">Les ventes au détail sortent le même jour à ${ecoTime(6, 'retail_time')}, avant l&rsquo;ouverture. Deux chiffres sensibles dans la même journée, le second beaucoup plus lourd que le premier.</p>
    <div class="quality-note risk-note"><strong>Ce que cela implique pour une position ouverte.</strong> Un ordre de protection s&rsquo;exécute pendant la séance. Si le cours ouvre le lendemain sous ce niveau, l&rsquo;exécution se fait au prix d&rsquo;ouverture, pas au niveau demandé. La différence peut être large sur une réunion à projections. Réduire la taille est la seule protection réelle contre ce risque.</div>
  </section>

  <section id="agenda" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Agenda</div><h2>La semaine en quatre rendez-vous</h2></div><span class="status-pill partial">PARTIEL — CORRECTION APPLIQUÉE</span></div>
    <div class="timeline">
      <div class="timeline-item"><div class="timeline-time">Mercredi, ${ecoTime(6, 'retail_time_b')}</div><div class="timeline-copy"><strong>Ventes au détail américaines</strong><span>Avant l&rsquo;ouverture, et avant la décision de taux du même jour.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Mercredi, ${ecoTime(7, 'fomc_time_b')}</div><div class="timeline-copy"><strong>Décision de taux de la Réserve fédérale, avec projections</strong><span>Le rendez-vous de la semaine. Conférence de presse dans la foulée.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Jeudi, ${ecoTime(8, 'claims_time')}</div><div class="timeline-copy"><strong>Inscriptions hebdomadaires au chômage</strong><span>Lecture de routine, sauf écart marqué au lendemain de la décision.</span></div></div>
      <div class="timeline-item"><div class="timeline-time">Vendredi, ${ecoTime(9, 'bowman_time')}</div><div class="timeline-copy"><strong>Intervention sur les tests de résistance bancaires</strong><span>Vice-présidente chargée de la supervision. Sujet réglementaire, effet possible sur les valeurs financières.</span></div></div>
    </div>
    <div class="quality-note warning-note"><strong>Correction de date, et elle change l&rsquo;attribution de lundi.</strong> Le flux de calendrier que nous collectons datait les prix à la production du ${literal('14 septembre')}. Le calendrier officiel du Bureau of Labor Statistics les fixe au ${ppiDate()} — quatre jours plus tôt. La baisse des indices lundi ne peut donc pas être mise sur le compte d&rsquo;une publication de prix à la production ce jour-là : il n&rsquo;y en a pas eu. Les prix à la consommation, eux, sont bien sortis le ${cpiDate()}. Source : <a href="https://www.bls.gov/schedule/news_release/ppi.htm">calendrier officiel des publications</a>.</div>
  </section>

  <section id="earnings" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Résultats</div><h2>Deux publications, aucune de premier plan</h2></div><span class="status-pill partial">PARTIEL — SOURCE UNIQUE</span></div>
    <p class="section-intro">Trip.com, agence de voyages en ligne, publie le ${earnDate(0, 'tcom_date')} avant l&rsquo;ouverture, pour une capitalisation de ${earnCap(0, 'tcom_cap')}. Lennar, promoteur immobilier américain, suit le ${earnDate(1, 'len_date')} après la clôture, pour ${earnCap(1, 'len_cap')}. Aucune des deux ne pèse sur la direction des indices.</p>
    <div class="quality-note warning-note"><strong>Réserve de source.</strong> Ces deux dates viennent d&rsquo;un seul fournisseur de calendrier et ne sont pas recoupées par un dépôt officiel de l&rsquo;émetteur. Une date de publication annoncée se déplace régulièrement ; à traiter comme une indication, pas comme un fait établi. Aucun prix d&rsquo;option exploitable au moment du relevé, effectué en pleine nuit à New York alors que les marchés d&rsquo;options américains sont fermés : aucun mouvement anticipé n&rsquo;est publié. Ce n&rsquo;est pas un constat d&rsquo;illiquidité sur ces deux titres, c&rsquo;est une heure de capture.</div>
  </section>

  <section id="trade" class="section-shell" data-status="no_setup">
    <div class="section-head"><div><div class="section-kicker">Idées de trading</div><h2>Aucune idée de trade dans ce briefing</h2></div><span class="status-pill partial">no_setup</span></div>
    <p class="section-intro">Ce briefing ne publie aucun niveau d&rsquo;entrée, aucun ordre de protection et aucun objectif. Ce n&rsquo;est pas un oubli : à la veille d&rsquo;une décision de taux accompagnée de projections, un niveau d&rsquo;entrée publié la veille au soir a toutes les chances d&rsquo;être franchi par un écart d&rsquo;ouverture plutôt que par le mouvement qu&rsquo;on cherchait.</p>
    <p class="section-intro">Les propositions de position de la maison vivent dans le scan quotidien, qui passe ses propres contrôles de niveaux, de risque et d&rsquo;événements avant publication. Un briefing de marché explique ce qui s&rsquo;est passé ; il ne double pas cet outil.</p>
    <div class="quality-note warning-note"><strong>Conséquence pratique.</strong> ATTENDRE la décision et sa conférence de presse avant d&rsquo;ouvrir quoi que ce soit de nouveau.</div>
  </section>

  <section id="formation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Formation du jour</div><h2>Lire la dispersion plutôt que la clôture</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Un indice est une moyenne pondérée. Des mouvements opposés de même ampleur s&rsquo;y annulent. Une clôture à ${idx1d('SPY')} peut donc recouvrir une séance sans histoire comme une réallocation massive — et les deux situations n&rsquo;appellent pas du tout la même conduite.</p>
    <p class="section-intro">Trois indices permettent de faire la différence sans outil compliqué. D&rsquo;abord l&rsquo;écart entre le premier et le dernier secteur. Lundi il valait quatre points, contre une médiane d&rsquo;environ deux points sept dixièmes sur les vingt-quatre séances relevées ici — large, mais pas exceptionnel : c&rsquo;est la cinquième séance au-dessus de quatre points sur cette période. Ensuite l&rsquo;amplitude des extrêmes : quand les plus fortes hausses et les plus fortes baisses dépassent toutes les deux dix pour cent, le marché trie. Enfin la volatilité implicite : si elle reste basse alors que les titres bougent fort, la crainte n&rsquo;est pas une chute générale.</p>
    <p class="section-intro">L&rsquo;usage est direct. En séance de forte dispersion, la sélection compte davantage que l&rsquo;exposition : acheter l&rsquo;indice ne capte rien de ce qui s&rsquo;y passe, et se tromper de camp coûte cher même quand l&rsquo;indice ne bouge pas. C&rsquo;est aussi pourquoi un portefeuille construit ce jour-là gagne à répartir ses paris entre secteurs plutôt qu&rsquo;à se concentrer sur le thème gagnant de la veille : la dispersion dit que le marché est en train de choisir, pas qu&rsquo;il a choisi.</p>
  </section>

  <section id="scenarios" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Scénarios</div><h2>Ce qui peut se passer, et à quoi le reconnaître</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="scenario-grid">
      <article class="scenario base"><h3>Scénario de base — la rotation continue</h3><p>Le logiciel garde son avance sur le matériel, la volatilité reste basse, les indices continuent de ne rien faire. On le reconnaît à l&rsquo;écart entre secteurs : s&rsquo;il reste large, le tri continue. Conduite : sélectionner, ne pas ajouter d&rsquo;exposition d&rsquo;indice.</p></article>
      <article class="scenario down"><h3>Scénario contraire — la dispersion se referme</h3><p>Une décision de taux mal reçue efface la distinction entre gagnants et perdants : tout baisse ensemble et la corrélation remonte d&rsquo;un coup. On le reconnaît à la volatilité très courte repassant au-dessus de celle à un mois — moins de deux dixièmes de point à combler.</p></article>
      <article class="scenario up"><h3>Le rattrapage énergie a lieu</h3><p>Les actions du secteur comblent leur retard sur le baril. On le reconnaît à un secteur énergie qui repasse devant le marché large sur cinq séances pendant que le fonds pétrolier tient ses niveaux.</p></article>
      <article class="scenario flat"><h3>Invalidation datée</h3><p>Sur les vingt-quatre séances relevées ici, l&rsquo;écart entre le premier et le dernier secteur n&rsquo;est jamais descendu sous un point six, et son premier quartile est à deux points un. Le seuil retenu est celui-là : si, après la décision de demain, l&rsquo;écart passe deux séances consécutives sous deux points un, la thèse de dispersion de ce briefing est caduque et la sélection redevient secondaire.</p></article>
    </div>
    <p class="provenance">Aucun ordre, aucune position et aucune donnée de compte ne sont utilisés dans ce briefing.</p>
  </section>

  <section id="watch" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">À surveiller</div><h2>Ce qu&rsquo;il faut regarder aujourd&rsquo;hui</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <ul class="checklist">
      <li><i class="fas fa-arrows-left-right"></i><div><strong>L&rsquo;écart entre le premier et le dernier secteur</strong><br>C&rsquo;est le thermomètre de la rotation. Il se resserre : le tri s&rsquo;arrête. Il reste large : il continue.</div></li>
      <li><i class="fas fa-microchip"></i><div><strong>Le matériel des centres de données</strong><br>Optique, verre, énergie et refroidissement ont été vendus ensemble. Un rebond commun dirait que la séance de lundi était une purge et non un changement d&rsquo;avis durable.</div></li>
      <li><i class="fas fa-oil-well"></i><div><strong>L&rsquo;écart entre le baril et les actions du secteur</strong><br>${idx5d('USO')} contre ${sec5d('XLE')} sur cinq séances. Le premier des deux qui cède donne la réponse.</div></li>
      <li><i class="fas fa-wave-square"></i><div><strong>La volatilité à neuf jours par rapport à celle à un mois</strong><br>À ${vix('9d')} contre ${vix('30d')}, la courbe est calme. Une inversion avant la décision changerait la lecture.</div></li>
      <li><i class="fas fa-percent"></i><div><strong>Les projections de taux, pas seulement la décision</strong><br>C&rsquo;est le tableau des anticipations qui fait bouger les marchés sur ce format de réunion.</div></li>
      <li><i class="fab fa-bitcoin"></i><div><strong>Le compartiment numérique hors séance</strong><br>Utile comme mesure d&rsquo;appétit pour le risque pendant la nuit, sans valeur prédictive sur l&rsquo;ouverture américaine.</div></li>
    </ul>
  </section>

  <section id="sources" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Sources et limites</div><h2>Sur quoi repose ce briefing</h2></div><span class="status-pill partial">PARTIEL</span></div>
    <div class="source-list">
      <div class="source-item"><strong>Cours de clôture quotidiens</strong><span>Indices américains, secteurs, métaux, obligations, énergie, cryptomonnaies et six valeurs suivies. Les actions s&rsquo;arrêtent à la dernière clôture américaine terminée ; les cryptomonnaies à leur dernière journée complète en heure universelle.</span></div>
      <div class="source-item"><strong>Courbe de volatilité</strong><span>Quatre échéances relevées au même instant, après la clôture de la séance de référence.</span></div>
      <div class="source-item"><strong>Calendriers officiels</strong><span>Dates de politique monétaire et de publications de prix prises chez les organismes qui publient, avec leur date de relevé. Une divergence avec le flux de marché est signalée et corrigée dans le texte.</span></div>
      <div class="source-item"><strong>Calendrier de résultats</strong><span>Source unique, non recoupée par un dépôt officiel d&rsquo;émetteur. Traité comme une indication.</span></div>
    </div>
    <div class="quality-note warning-note"><strong>Limites.</strong> Les mouvements de cours sont mesurés ; leur cause ne l&rsquo;est pas. Aucune attribution d&rsquo;un mouvement à une annonce n&rsquo;est faite dans ce briefing sans que la date de cette annonce ait été vérifiée à sa source officielle. Le relevé des déclarations d&rsquo;initiés n&rsquo;a couvert qu&rsquo;une partie de l&rsquo;univers : aucun solde net n&rsquo;est publié.</div>
    <div class="two-col"><div class="empty-state" data-empty-state="true"><strong>Europe : INDISPONIBLE</strong><p>Aucun cours d&rsquo;indice européen n&rsquo;a été relevé pour cette édition. Ni niveau, ni palmarès, ni variation ne sont publiés pour cette région.</p></div><div class="empty-state" data-empty-state="true"><strong>Asie-Pacifique : INDISPONIBLE</strong><p>Même situation. Une dépêche ou un site web ne remplace pas un cours de clôture relevé.</p></div></div>
    <p class="section-intro">Ce contenu est informatif et pédagogique. Il ne constitue pas un conseil financier. Toute décision doit tenir compte de votre horizon, de votre tolérance au risque et du risque de perte en capital.</p>
  </section>
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Alerte</span></a><a href="#dashboard" class="fnav-item" data-section="dashboard"><i class="fas fa-gauge-high"></i><span>Tableau</span></a><a href="#dispersion" class="fnav-item" data-section="dispersion"><i class="fas fa-arrows-left-right"></i><span>Dispersion</span></a><a href="#fed" class="fnav-item" data-section="fed"><i class="fas fa-percent"></i><span>Taux</span></a><a href="#crypto" class="fnav-item" data-section="crypto"><i class="fab fa-bitcoin"></i><span>Crypto</span></a><a href="#formation" class="fnav-item" data-section="formation"><i class="fas fa-graduation-cap"></i><span>Formation</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>
(function(){
  var indices=echarts.init(document.getElementById('indicesChart'));
  indices.setOption({tooltip:{trigger:'axis',valueFormatter:function(v){return v.toFixed(2)+' %';}},legend:{data:['USO','SPY','QQQ','GLD']},grid:{left:52,right:20,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(chartDates)}},yAxis:{type:'value',scale:true},series:[${idxLine('USO')},${idxLine('SPY')},${idxLine('QQQ')},${idxLine('GLD')}]});
  var sectors=echarts.init(document.getElementById('sectorChart'));
  sectors.setOption({tooltip:{trigger:'axis',valueFormatter:function(v){return v.toFixed(2)+' %';}},grid:{left:55,right:24,top:25,bottom:92},xAxis:{type:'category',data:${JSON.stringify(sectorOrder.map(s => SECTOR_FR[s]))},axisLabel:{interval:0,rotate:38,fontSize:10}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(sectorChartData)}}]});
  var focus=echarts.init(document.getElementById('focusChart'));
  focus.setOption({tooltip:{trigger:'axis',valueFormatter:function(v){return v.toFixed(2)+' %';}},grid:{left:55,right:24,top:25,bottom:60},xAxis:{type:'category',data:${JSON.stringify(focusOrder)}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(focusChartData)}}]});
  var crypto=echarts.init(document.getElementById('cryptoChart'));
  crypto.setOption({tooltip:{trigger:'axis'},legend:{data:['Bitcoin','Ether']},grid:{left:66,right:24,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(cryptoDates)}},yAxis:[{type:'value',scale:true},{type:'value',scale:true}],series:[{name:'Bitcoin',type:'line',showSymbol:false,data:${JSON.stringify(btcLine)},lineStyle:{color:'#f59e0b'}},{name:'Ether',type:'line',yAxisIndex:1,showSymbol:false,data:${JSON.stringify(ethLine)},lineStyle:{color:'#7b61ff'}}]});
  window.addEventListener('resize',function(){indices.resize();sectors.resize();focus.resize();crypto.resize();});
})();
</script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body></html>
`;

// ---------------------------------------------------------------- écriture

const document = declareSpelledNumbers(html);
fs.writeFileSync(path.join(ROOT, ARTICLE), document);

const manifest = {
  schema_version: 1,
  reference_close: REFERENCE_CLOSE,
  article_path: ARTICLE,
  article_sha256: sha256(fs.readFileSync(path.join(ROOT, ARTICLE))),
  literals: [...literals],
  claims,
};
fs.writeFileSync(path.join(ROOT, `${DATA}/claims.json`), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[build-daily] ${ARTICLE} — ${html.length} octets, ${claims.length} claims, ${literals.size} littéraux`);
