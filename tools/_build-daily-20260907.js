#!/usr/bin/env node
'use strict';

/* Constructeur du briefing du 7 septembre 2026.
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
const DATA = 'daily/20260907/_data';
const FOCUS = 'daily/20260907/_focus';
const ARTICLE = 'daily/20260907/index.html';

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

// Un identifiant de claim vaut pour UNE occurrence visible. Le même chiffre cité deux fois dans
// l'article est donc déclaré deux fois, avec deux identifiants distincts : le validateur exige une
// correspondance un pour un entre le manifeste et le document, et c'est ce qui garantit qu'aucun
// `data-claim` orphelin ne traîne dans la page.
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

/** Claim direct : le pointeur EST la valeur publiée. */
function claim(baseId, rel, pointer, render, opts = {}) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  const value = pointerGet(json, pointer);
  const entry = {
    id,
    source_artifact: rel,
    source_sha256: sha,
    source_pointer: pointer,
    source_value: value,
    render,
  };
  if (opts.authority) entry.authority = opts.authority;
  const text = renderValue(value, render);
  if (text == null) throw new Error(`claim ${id}: rendu impossible pour ${JSON.stringify(value)}`);
  entry.rendered_text = text;
  claims.push(entry);
  return `<span data-claim="${id}">${text}</span>`;
}

/** Claim calculé : la formule est reconstruite par le validateur depuis les mêmes pointeurs. */
function formulaClaim(baseId, rel, formula, render) {
  const id = uniqueId(baseId);
  const { json, sha } = source(rel);
  let result;
  if (formula.operation === 'ratio_pct' || formula.operation === 'ratio') {
    const a = pointerGet(json, formula.numerator_pointer);
    const b = pointerGet(json, formula.denominator_pointer);
    result = formula.operation === 'ratio' ? a / b : (a / b - 1) * 100;
  } else if (formula.operation === 'ratio_to_mean') {
    const parts = formula.numerator_pointer.split('/');
    const column = parts[parts.length - 1];
    const index = Number(parts[parts.length - 2]);
    const prefix = parts.slice(0, -2).join('/');
    const off = formula.offset === undefined ? 1 : formula.offset;
    const last = index - off;
    const first = last - formula.window + 1;
    let sum = 0;
    for (let i = first; i <= last; i++) sum += pointerGet(json, `${prefix}/${i}/${column}`);
    result = pointerGet(json, formula.numerator_pointer) / (sum / formula.window);
  } else {
    throw new Error(`formule non gérée : ${formula.operation}`);
  }
  const entry = {
    id,
    source_artifact: rel,
    source_sha256: sha,
    source_pointer: formula.numerator_pointer,
    source_value: pointerGet(json, formula.numerator_pointer),
    formula: { ...formula, result },
    render,
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

// ---------------------------------------------------------------- rendus réutilisés

const USD = { scale: 1, decimals: 2, prefix: '$' };
const USD0 = { scale: 1, decimals: 0, prefix: '$', format: 'fr' };
const USD4 = { scale: 1, decimals: 4, prefix: '$' };
const PCT = { scale: 1, decimals: 2, suffix: ' %', format: 'fr' };
const PCT_SIGNED = { scale: 1, decimals: 2, suffix: ' %', sign: 'always', format: 'fr' };
const PROB = { scale: 100, decimals: 1, suffix: ' %', format: 'fr' };
const LEVEL = { scale: 1, decimals: 2, format: 'fr' };
const LEVEL0 = { scale: 1, decimals: 0, format: 'fr' };
const TIMES = { scale: 1, decimals: 1, suffix: ' fois', format: 'fr' };
const DAYS = { scale: 1, decimals: 1, suffix: ' j', format: 'fr' };
const MUSD = { scale: 1e-6, decimals: 1, suffix: ' M$', format: 'fr' };
const DATE_DM = { format: 'fr_date', parts: 'day_month' };
const DATE_WDM = { format: 'fr_date', parts: 'weekday_day_month' };

// ---------------------------------------------------------------- pointeurs de séries

const BI = `${DATA}/bars_indices.json`;
const BS = `${DATA}/bars_sectors.json`;
const BC = `${DATA}/bars_crypto.json`;
const OPT = `${DATA}/options_sentiment.json`;
const REG = `${DATA}/regime.json`;
const DTX = `${DATA}/regime_systematic.json`;
const EARN = `${DATA}/earnings_today.json`;
const REGISTRY = 'data/scheduled-events.json';
const FB = `${FOCUS}/focus_bars.json`;
const FT = `${FOCUS}/focus_technicals.json`;
const FF = `${FOCUS}/focus_flows.json`;

const IDX = { SPY: 0, QQQ: 1, IWM: 2, DIA: 3, GLD: 4, SLV: 5, TLT: 6, USO: 7 };
const SEC = { XLK: 0, XLB: 1, XLF: 2, XLE: 3, XLV: 4, XLI: 5, XLY: 6, XLP: 7, XLU: 8, XLC: 9, XLRE: 10 };
const CRY = { BTC: 0, ETH: 1, SOL: 2, XRP: 3 };

const iBar = (sym, i, col) => `/results/0/data/${IDX[sym]}/bars/${i}/${col}`;
const sBar = (sym, i, col) => `/results/0/data/${SEC[sym]}/bars/${i}/${col}`;
const cBar = (sym, i, col) => `/results/0/data/${CRY[sym]}/bars/${i}/${col}`;

// Index de séance dans chaque série (bornes vérifiées à la lecture, jamais devinées).
const iDates = readJson(BI).results[0].data[0].bars.map(b => b[0]);
const sDates = readJson(BS).results[0].data[0].bars.map(b => b[0]);
const cDates = readJson(BC).results[0].data[0].bars.map(b => b[0]);
const iAt = d => { const n = iDates.indexOf(d); if (n < 0) throw new Error(`séance ${d} absente des indices`); return n; };
const sAt = d => { const n = sDates.indexOf(d); if (n < 0) throw new Error(`séance ${d} absente des secteurs`); return n; };
const cAt = d => { const n = cDates.indexOf(d); if (n < 0) throw new Error(`bougie ${d} absente de la crypto`); return n; };

const I_LAST = iAt('2026-09-04');
const S_LAST = sAt('2026-09-04');
const C_LAST = cAt('2026-09-06');

const idxClose = sym => claim(`${sym.toLowerCase()}_close`, BI, iBar(sym, I_LAST, 4), USD);
const idx5d = sym => formulaClaim(`${sym.toLowerCase()}_5d`, BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar(sym, I_LAST, 4),
  denominator_pointer: iBar(sym, I_LAST - 5, 4),
}, PCT_SIGNED);
const idx1d = sym => formulaClaim(`${sym.toLowerCase()}_1d`, BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar(sym, I_LAST, 4),
  denominator_pointer: iBar(sym, I_LAST - 1, 4),
}, PCT_SIGNED);
const sec5d = sym => formulaClaim(`${sym.toLowerCase()}_5d`, BS, {
  operation: 'ratio_pct',
  numerator_pointer: sBar(sym, S_LAST, 4),
  denominator_pointer: sBar(sym, S_LAST - 5, 4),
}, PCT_SIGNED);
const sec1d = sym => formulaClaim(`${sym.toLowerCase()}_1d`, BS, {
  operation: 'ratio_pct',
  numerator_pointer: sBar(sym, S_LAST, 4),
  denominator_pointer: sBar(sym, S_LAST - 1, 4),
}, PCT_SIGNED);
const secClose = sym => claim(`${sym.toLowerCase()}_close`, BS, sBar(sym, S_LAST, 4), USD);

// ---------------------------------------------------------------- valeurs de la une

const refClose = () => claim('ref_close', BI, '/results/0/data/0/reference_close', DATE_WDM);
const refCloseShort = () => claim('ref_close_short', BS, '/results/0/data/0/reference_close', DATE_DM);
const cryptoRef = () => claim('crypto_ref', BC, '/results/0/data/0/reference_close', DATE_DM);

// Pétrole : le choc de la semaine.
const uso5d = () => formulaClaim('uso_5d', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('USO', I_LAST, 4),
  denominator_pointer: iBar('USO', I_LAST - 5, 4),
}, PCT_SIGNED);
const usoSep1 = () => formulaClaim('uso_sep1', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('USO', iAt('2026-09-01'), 4),
  denominator_pointer: iBar('USO', iAt('2026-08-31'), 4),
}, PCT_SIGNED);
const usoSep1Vol = () => formulaClaim('uso_sep1_vol', BI, {
  operation: 'ratio_to_mean',
  numerator_pointer: iBar('USO', iAt('2026-09-01'), 5),
  window: 8,
  offset: 1,
}, TIMES);
const usoSep1Close = () => claim('uso_sep1_close', BI, iBar('USO', iAt('2026-09-01'), 4), USD);
const usoAug31Close = () => claim('uso_aug31_close', BI, iBar('USO', iAt('2026-08-31'), 4), USD);
const usoSep1Date = () => claim('uso_sep1_date', BI, iBar('USO', iAt('2026-09-01'), 0), DATE_WDM);

// Métaux : la cassure du 28 août.
const gldAug28 = () => formulaClaim('gld_aug28', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('GLD', iAt('2026-08-28'), 4),
  denominator_pointer: iBar('GLD', iAt('2026-08-27'), 4),
}, PCT_SIGNED);
const slvAug28 = () => formulaClaim('slv_aug28', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('SLV', iAt('2026-08-28'), 4),
  denominator_pointer: iBar('SLV', iAt('2026-08-27'), 4),
}, PCT_SIGNED);
const gldAug28Vol = () => formulaClaim('gld_aug28_vol', BI, {
  operation: 'ratio_to_mean',
  numerator_pointer: iBar('GLD', iAt('2026-08-28'), 5),
  window: 8,
  offset: 1,
}, TIMES);
const slvAug28Vol = () => formulaClaim('slv_aug28_vol', BI, {
  operation: 'ratio_to_mean',
  numerator_pointer: iBar('SLV', iAt('2026-08-28'), 5),
  window: 8,
  offset: 1,
}, TIMES);
const gldAug28Date = () => claim('gld_aug28_date', BI, iBar('GLD', iAt('2026-08-28'), 0), DATE_WDM);

// Volatilité cotée.
const vixShort = () => claim('vix_short', OPT, '/items/0/level', LEVEL);
const vixSpot = () => claim('vix_spot', OPT, '/items/1/level', LEVEL);
const vixMid = () => claim('vix_mid', OPT, '/items/2/level', LEVEL);
const vixLong = () => claim('vix_long', OPT, '/items/3/level', LEVEL);
const vixRatioShort = () => claim('vix_ratio_short', OPT, '/items/4/vix_9d_30d_ratio', { scale: 1, decimals: 2, format: 'fr' });

// Régime.
const dtxScore = () => claim('syst_regime_score', DTX, '/regime_score', { scale: 1, decimals: 2, format: 'fr' });
const dtxSpx = () => claim('syst_spx', DTX, '/index_price', LEVEL0);
const dtxSma50 = () => claim('syst_sma50', DTX, '/sma50', LEVEL0);
const dtxSma200 = () => claim('syst_sma200', DTX, '/sma200', LEVEL0);
const dtxVix = () => claim('syst_vix', DTX, '/vix_level', LEVEL);
const dtxVixSma = () => claim('syst_vix_sma', DTX, '/vix_sma14', LEVEL);
const regRiskOn = () => claim('regime_risk_on', REG, '/facets/regime/probabilities/risk_on', PROB);
const regNeutral = () => claim('regime_neutral', REG, '/facets/regime/probabilities/neutral', PROB);
const regDd = () => claim('regime_dd', REG, '/facets/regime/expected_drawdown_pct', { scale: 1, decimals: 0, suffix: ' %', format: 'fr' });
const regTransCrisis = () => claim('regime_trans_crisis', REG, '/facets/regime/transition_5d/crisis', PROB);
const regTransRiskOff = () => claim('regime_trans_riskoff', REG, '/facets/regime/transition_5d/early_risk_off', PROB);

// Marchés de prédiction : l'indice le plus fort du dossier.
const PM = '/facets/prediction_markets/items';
const pmItems = readJson(REG).facets.prediction_markets.items;
const pmIndex = q => {
  const n = pmItems.findIndex(item => item.question === q);
  if (n < 0) throw new Error(`marché absent : ${q}`);
  return n;
};
const qHold = 'Will there be no change in Fed interest rates after the September 2026 meeting?';
const qHike25 = 'Will the Fed increase interest rates by 25 bps after the September 2026 meeting?';
const qCut25 = 'Will the Fed decrease interest rates by 25 bps after the September 2026 meeting?';
const qCut50 = 'Will the Fed decrease interest rates by 50+ bps after the September 2026 meeting?';
const qHike50 = 'Will the Fed increase interest rates by 50+ bps after the September 2026 meeting?';
const qCease = 'Israel x Iran ceasefire continues through September 30?';
const qAirspace = 'Israel closes its airspace by September 30?';

const pmHold = () => claim('pm_hold', REG, `${PM}/${pmIndex(qHold)}/yes_price`, PROB);
const pmHike25 = () => claim('pm_hike25', REG, `${PM}/${pmIndex(qHike25)}/yes_price`, PROB);
const pmCut25 = () => claim('pm_cut25', REG, `${PM}/${pmIndex(qCut25)}/yes_price`, PROB);
const pmCut50 = () => claim('pm_cut50', REG, `${PM}/${pmIndex(qCut50)}/yes_price`, PROB);
const pmHike50 = () => claim('pm_hike50', REG, `${PM}/${pmIndex(qHike50)}/yes_price`, PROB);
const pmHoldVol = () => claim('pm_hold_vol', REG, `${PM}/${pmIndex(qHold)}/volume`, MUSD);
const pmCease = () => claim('pm_cease', REG, `${PM}/${pmIndex(qCease)}/yes_price`, PROB);
const pmAirspace = () => claim('pm_airspace', REG, `${PM}/${pmIndex(qAirspace)}/yes_price`, PROB);

// Agenda officiel : registre autoritaire, pas le flux de marché.
const regEvents = readJson(REGISTRY).events;
const regAt = id => {
  const n = regEvents.findIndex(e => e.id === id && e.date >= '2026-09-07' && e.date <= '2026-09-30');
  if (n < 0) throw new Error(`événement ${id} absent du registre`);
  return n;
};
const registryFetched = () => claim('registry_fetched', REGISTRY, '/sources/bls_cpi/fetched_at', DATE_DM, { authority: 'bls_cpi' });
const dPpi = () => claim('date_ppi', REGISTRY, `/events/${regAt('ppi')}/date`, DATE_WDM, { authority: 'bls_ppi' });
const dCpi = () => claim('date_cpi', REGISTRY, `/events/${regAt('cpi')}/date`, DATE_WDM, { authority: 'bls_cpi' });
const dFomc = () => claim('date_fomc', REGISTRY, `/events/${regAt('fomc')}/date`, DATE_WDM, { authority: 'fomc' });
const dFomcShort = () => claim('date_fomc_short', REGISTRY, `/events/${regAt('fomc')}/date`, DATE_DM, { authority: 'fomc' });

// Crypto.
const cryClose = (sym, render) => claim(`${sym.toLowerCase()}_close`, BC, cBar(sym, C_LAST, 4), render);
const cry5d = sym => formulaClaim(`${sym.toLowerCase()}_5d`, BC, {
  operation: 'ratio_pct',
  numerator_pointer: cBar(sym, C_LAST, 4),
  denominator_pointer: cBar(sym, C_LAST - 5, 4),
}, PCT_SIGNED);

// Valeurs ciblées.
const fBars = readJson(FB).data.items[0].results.find(r => r.data_type === 'bars_daily').data;
const fRes = readJson(FB).data.items[0].results.findIndex(r => r.data_type === 'bars_daily');
const fIdx = sym => fBars.findIndex(e => e.symbol === sym);
const fLast = sym => fBars[fIdx(sym)].bars.length - 1;
const fPtr = (sym, i, col) => `/data/items/0/results/${fRes}/data/${fIdx(sym)}/bars/${i}/${col}`;

const tItems = readJson(FT).data.items[0].results;
const tRes = tItems.findIndex(r => r.data_type === 'technicals');
const tIdx = sym => tItems[tRes].data.findIndex(e => e.symbol === sym);
const tPtr = (sym, field) => `/data/items/0/results/${tRes}/data/${tIdx(sym)}/${field}`;

const flowItems = readJson(FF).data.items[0].results;
const siRes = flowItems.findIndex(r => r.data_type === 'short_interest');
const siIdx = sym => flowItems[siRes].data.findIndex(e => e.symbol === sym);
const siLast = sym => flowItems[siRes].data[siIdx(sym)].points.length - 1;
const siPtr = (sym, field) => `/data/items/0/results/${siRes}/data/${siIdx(sym)}/points/${siLast(sym)}/${field}`;
const siDatePtr = sym => `/data/items/0/results/${siRes}/data/${siIdx(sym)}/points/${siLast(sym)}/settlement_date`;

const earnEvents = readJson(EARN).events;
const eIdx = sym => earnEvents.findIndex(e => e.symbol === sym);
const ePtr = (sym, field) => `/events/${eIdx(sym)}/${field}`;

// Les champs sont PARESSEUX. Un claim déclaré mais non affiché fait échouer le validateur
// (« manifest claim absent from article »), et c'est une bonne chose : un manifeste ne doit pas
// prétendre couvrir un chiffre que le lecteur ne voit jamais. Rien ne s'enregistre donc avant
// d'être réellement appelé dans le gabarit.
function focusBlock(sym) {
  const low = sym.toLowerCase();
  return {
    close: () => claim(`${low}_price`, FB, fPtr(sym, fLast(sym), 4), USD),
    d20: () => formulaClaim(`${low}_20d`, FB, {
      operation: 'ratio_pct',
      numerator_pointer: fPtr(sym, fLast(sym), 4),
      denominator_pointer: fPtr(sym, fLast(sym) - 20, 4),
    }, PCT_SIGNED),
    rsi: () => claim(`${low}_rsi`, FT, tPtr(sym, 'rsi'), LEVEL),
    atr: () => claim(`${low}_atr`, FT, tPtr(sym, 'atr'), USD),
    ema20: () => claim(`${low}_ema20`, FT, tPtr(sym, 'ema20'), USD),
    implied: () => claim(`${low}_implied`, EARN, ePtr(sym, 'implied_move_pct'), { scale: 1, decimals: 0, suffix: ' %', format: 'fr' }),
    reportDate: () => claim(`${low}_date`, EARN, ePtr(sym, 'report_date'), DATE_WDM),
    mcap: () => claim(`${low}_mcap`, EARN, ePtr(sym, 'market_cap_b'), { scale: 1, decimals: 1, suffix: ' Md$', format: 'fr' }),
  };
}

const coo = focusBlock('COO');
const sunb = focusBlock('SUNB');
const sail = focusBlock('SAIL');
const casy = focusBlock('CASY');

const sailShort = () => claim('sail_short_pct', FF, siPtr('SAIL', 'short_pct_float'), PCT);
const sailDtc = () => claim('sail_dtc', FF, siPtr('SAIL', 'days_to_cover'), DAYS);
const sailSettle = () => claim('sail_settle', FF, siDatePtr('SAIL'), DATE_DM);
const casyShort = () => claim('casy_short_pct', FF, siPtr('CASY', 'short_pct_float'), PCT);
const sunbShort = () => claim('sunb_short_pct', FF, siPtr('SUNB', 'short_pct_float'), PCT);
const sunbDtc = () => claim('sunb_dtc', FF, siPtr('SUNB', 'days_to_cover'), DAYS);
const cooShort = () => claim('coo_short_pct', FF, siPtr('COO', 'short_pct_float'), PCT);


// ---------------------------------------------------------------- valeurs ajoutées après revue

const OFF = `${DATA}/off_hours.json`;
const ECO = `${DATA}/economic_events.json`;

const PTS = { scale: 100, decimals: 0, suffix: ' pts', sign: 'always', format: 'fr' };
const PRICE_PCT = { scale: 100, decimals: 0, suffix: ' %', format: 'fr' };

// Marchés de prédiction : le NIVEAU seul est trompeur. La dérive sur sept jours est dans le même
// objet que le prix, et elle va dans le sens inverse de ce qu'un niveau de 48,5 % suggère.
const offObs = readJson(OFF).facets.predictions.observations;
const offIndex = needle => {
  const n = offObs.findIndex(o => ((o.metadata || {}).question || '').includes(needle));
  if (n < 0) throw new Error(`observation hors séance absente : ${needle}`);
  return n;
};
const OFFP = '/facets/predictions/observations';
const iHold = offIndex('no change in Fed interest rates');
const iHike = offIndex('increase interest rates by 25 bps');

const pmHold7d = () => claim('pm_hold_7d', OFF, `${OFFP}/${iHold}/metadata/price_change_7d`, PTS);
const pmHike7d = () => claim('pm_hike25_7d', OFF, `${OFFP}/${iHike}/metadata/price_change_7d`, PTS);
const pmHike24h = () => claim('pm_hike25_24h', OFF, `${OFFP}/${iHike}/metadata/price_change_24h`, PTS);
const pmHoldBid = () => claim('pm_hold_bid', OFF, `${OFFP}/${iHold}/metadata/bid`, PRICE_PCT);
const pmHoldAsk = () => claim('pm_hold_ask', OFF, `${OFFP}/${iHold}/metadata/ask`, PRICE_PCT);
const pmHikeBid = () => claim('pm_hike_bid', OFF, `${OFFP}/${iHike}/metadata/bid`, PRICE_PCT);
const pmHikeAsk = () => claim('pm_hike_ask', OFF, `${OFFP}/${iHike}/metadata/ask`, PRICE_PCT);
const pmHoldVol24 = () => claim('pm_hold_vol24', REG, `${PM}/${pmIndex(qHold)}/volume_24h`, USD0);

// Le vendredi de référence était une séance d'emploi : le tape qu'on lit est une réaction à ce
// chiffre avant d'être quoi que ce soit d'autre.
const ecoEvents = readJson(ECO).results[0].data.events;
const iNfp = ecoEvents.findIndex(e => e.name.startsWith('Non-Farm Payrolls'));
const nfpDate = () => claim('nfp_date', ECO, `/results/0/data/events/${iNfp}/event_time`, DATE_WDM);

// Or : le décrochage du 28 août a été intégralement repris le 3 septembre.
const gldSep3 = () => formulaClaim('gld_sep3', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('GLD', iAt('2026-09-03'), 4),
  denominator_pointer: iBar('GLD', iAt('2026-08-28'), 4),
}, PCT_SIGNED);
const gldSep3Close = () => claim('gld_sep3_close', BI, iBar('GLD', iAt('2026-09-03'), 4), USD);
const gldAug28Close = () => claim('gld_aug28_close', BI, iBar('GLD', iAt('2026-08-28'), 4), USD);
const gldSep3Date = () => claim('gld_sep3_date', BI, iBar('GLD', iAt('2026-09-03'), 0), DATE_DM);

// Niveaux d'invalidation réellement observables, pris dans les barres.
const usoConsLow = () => claim('uso_cons_low', BI, iBar('USO', I_LAST, 3), USD);
const tltLow = () => claim('tlt_low', BI, iBar('TLT', 1, 3), USD);
const tltLowDate = () => claim('tlt_low_date', BI, iBar('TLT', 1, 0), DATE_DM);
const xlyClose = () => secClose('XLY');

// Régime : les deux champs appariés que la première version avait laissés de côté.
const regReturn = () => claim('regime_return', REG, '/facets/regime/expected_return_spy_pct', PCT);
const regTransRiskOn = () => claim('regime_trans_riskon2', REG, '/facets/regime/transition_5d/risk_on', PROB);
const dtxScoreAlt = () => claim('syst_score_alt', REG, '/facets/regime/dtx_regime/component_scores/vix', { scale: 1, decimals: 2, format: 'fr' });

const cooStraddle = () => claim('coo_straddle', EARN, ePtr('COO', 'atm_straddle_usd'), USD);

// Métaux : la seule référence honnête est le cours d'AVANT la chute. Mesurer la « reprise » depuis
// la clôture d'après-chute revient à choisir son dénominateur, et fait passer un métal encore en
// baisse de près de 4 % pour un métal revenu à l'équilibre.
const gldPreClose = () => claim('gld_pre_close', BI, iBar('GLD', iAt('2026-08-27'), 4), USD);
const gldPreMove = () => formulaClaim('gld_pre_move', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('GLD', I_LAST, 4),
  denominator_pointer: iBar('GLD', iAt('2026-08-27'), 4),
}, PCT_SIGNED);
const slvPreMove = () => formulaClaim('slv_pre_move', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('SLV', I_LAST, 4),
  denominator_pointer: iBar('SLV', iAt('2026-08-27'), 4),
}, PCT_SIGNED);
const gldLowClose = () => claim('gld_low_close', BI, iBar('GLD', iAt('2026-09-01'), 4), USD);
const gldLowDate = () => claim('gld_low_date', BI, iBar('GLD', iAt('2026-09-01'), 0), DATE_DM);

// Le brut lui-même, en cours courant hors séance — distinct d'une clôture arrêtée, donc horodaté.
const OFFF = '/facets/futures/observations/10';
const clPrice = () => claim('cl_price', OFF, `${OFFF}/price`, USD);
const cl72h = () => claim('cl_72h', OFF, `${OFFF}/returns/72h_pct`, PCT_SIGNED);
const cl24h = () => claim('cl_24h', OFF, `${OFFF}/returns/24h_pct`, PCT_SIGNED);
const btc24h = () => claim('btc_24h', OFF, '/facets/crypto/observations/0/returns/24h_pct', PCT_SIGNED);

// Déclarations d'initiés : publier aussi là où elles sont bruyantes, pas seulement là où elles
// sont vides. Le décompte et une opération datée suffisent; aucun solde net n'est calculé.
const IT = '/data/items/0/results/0/data';
const sailSells = () => claim('sail_sells', FF, `${IT}/2/sells_count`, LEVEL0);
const sailTxShares = () => claim('sail_tx_shares', FF, `${IT}/2/transactions/2/shares`, LEVEL0);
const sailTxPrice = () => claim('sail_tx_price', FF, `${IT}/2/transactions/2/price`, USD);
const sailTxDate = () => claim('sail_tx_date', FF, `${IT}/2/transactions/2/date_transaction`, DATE_DM);
const casySells = () => claim('casy_sells', FF, `${IT}/3/sells_count`, LEVEL0);
const casyBuys = () => claim('casy_buys', FF, `${IT}/3/buys_count`, LEVEL0);
const casyTxShares = () => claim('casy_tx_shares', FF, `${IT}/3/transactions/1/shares`, LEVEL0);
const casyTxPrice = () => claim('casy_tx_price', FF, `${IT}/3/transactions/1/price`, USD);
const casyTxDate = () => claim('casy_tx_date', FF, `${IT}/3/transactions/1/date_transaction`, DATE_DM);

// Niveau d'invalidation pour la consommation : le plus bas de la période, pas la clôture du jour.
const tltPreMove = () => formulaClaim('tlt_pre_move', BI, {
  operation: 'ratio_pct',
  numerator_pointer: iBar('TLT', I_LAST, 4),
  denominator_pointer: iBar('TLT', iAt('2026-08-27'), 4),
}, PCT_SIGNED);
const systScoreAlt2 = () => claim('syst_score_second', REG, '/facets/regime/dtx_regime/regime_score', { scale: 1, decimals: 2, format: 'fr' });
const sunbSells = () => claim('sunb_sells', FF, `${IT}/1/sells_count`, LEVEL0);
const sunbTxShares = () => claim('sunb_tx_shares', FF, `${IT}/1/transactions/34/shares`, LEVEL0);
const sunbTxPrice = () => claim('sunb_tx_price', FF, `${IT}/1/transactions/34/price`, USD);
const sunbTxDate = () => claim('sunb_tx_date', FF, `${IT}/1/transactions/34/date_transaction`, DATE_DM);
const xlyLow = () => claim('xly_low', BS, sBar('XLY', sAt('2026-09-01'), 4), USD);
const xlyLowDate = () => claim('xly_low_date', BS, sBar('XLY', sAt('2026-09-01'), 0), DATE_DM);

// Dates citées dans la prose : chacune vient de la barre, du calendrier officiel ou de la
// déclaration elle-même — jamais de la mémoire de l'auteur.
const usoSep1Short = () => claim('uso_sep1_short', BI, iBar('USO', iAt('2026-09-01'), 0), DATE_DM);
const gldAug28Short = () => claim('gld_aug28_short', BI, iBar('GLD', iAt('2026-08-28'), 0), DATE_DM);
const dCpiShort = () => claim('date_cpi_short', REGISTRY, `/events/${regAt('cpi')}/date`, DATE_DM, { authority: 'bls_cpi' });
const sunbInsiderDate = () => claim('sunb_insider_date', FF,
  `/data/items/0/results/0/data/1/recent_trades/1`, DATE_DM);

// ---------------------------------------------------------------- séries de graphiques

const chartDates = iDates.map(d => d.slice(5));
const lineSeries = (sym, color) => JSON.stringify({
  name: sym, type: 'line', showSymbol: false, smooth: true,
  data: readJson(BI).results[0].data[IDX[sym]].bars.map(b => b[4]),
  lineStyle: { width: 2, color },
});

// Les tickers de secteur ne disent rien à un lecteur non professionnel : l'axe porte des noms.
const SECTOR_FR = {
  XLK: 'Techno', XLB: 'Matériaux', XLF: 'Finance', XLE: 'Énergie', XLV: 'Santé',
  XLI: 'Industrie', XLY: 'Conso discrétionnaire', XLP: 'Conso de base',
  XLU: 'Services publics', XLC: 'Communication', XLRE: 'Immobilier',
};

const sectorOrder = Object.keys(SEC)
  .map(sym => {
    const bars = readJson(BS).results[0].data[SEC[sym]].bars;
    return { sym, pct: (bars[S_LAST][4] / bars[S_LAST - 5][4] - 1) * 100 };
  })
  .sort((a, b) => b.pct - a.pct);

const sectorChartData = sectorOrder.map(s => ({
  value: Number(s.pct.toFixed(2)),
  itemStyle: { color: Math.abs(s.pct) < 0.05 ? '#8a97a8' : (s.pct > 0 ? '#0b8f62' : '#c73d4b') },
}));

const cryptoDates = cDates.map(d => d.slice(5));
const btcLine = readJson(BC).results[0].data[CRY.BTC].bars.map(b => b[4]);
const ethLine = readJson(BC).results[0].data[CRY.ETH].bars.map(b => b[4]);

// ---------------------------------------------------------------- corps de l'article

const dashboard = [
  ['USO', idxClose('USO'), uso5d(), 'pétrole coté, cinq séances'],
  ['XLE', secClose('XLE'), sec5d('XLE'), 'actions pétrolières, cinq séances'],
  ['SPY', idxClose('SPY'), idx5d('SPY'), 'grand marché américain, cinq séances'],
  ['QQQ', idxClose('QQQ'), idx5d('QQQ'), 'croissance et technologie'],
  ['IWM', idxClose('IWM'), idx5d('IWM'), 'petites capitalisations'],
  ['DIA', idxClose('DIA'), idx5d('DIA'), 'valeurs industrielles établies'],
  ['GLD', idxClose('GLD'), idx5d('GLD'), 'or coté'],
  ['TLT', idxClose('TLT'), idx5d('TLT'), 'obligations longues'],
];

const html = `<!DOCTYPE html>
<html lang="fr" data-tags="macro,energy,geopolitique,crypto,earnings,formation" data-tab="daily">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Briefing — 7 septembre 2026</title>
  <meta name="description" content="Briefing du 7 septembre 2026 : le fonds pétrolier bondit, les actions du secteur n'en prennent qu'un quart, et la semaine apporte deux chiffres de prix puis une décision de taux jouée à pile ou face.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/assets/report.css">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <style>
    :root{--daily-ink:#10233e;--daily-muted:#5f6f83;--daily-line:#dfe7f1;--daily-blue:#165dff;--daily-cyan:#00a6c8;--daily-green:#0b8f62;--daily-red:#c73d4b;--daily-amber:#b76e00;--daily-soft:#f3f7fc;--daily-card:#fff}
    body{font-family:Inter,sans-serif;color:var(--daily-ink);background:#f7f9fc}.hero-section{background:radial-gradient(circle at 80% 20%,rgba(0,166,200,.28),transparent 32%),linear-gradient(135deg,#0b1f3a,#174f89);color:#fff;padding:4.2rem 0 3.4rem}.hero-date{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;opacity:.84}.hero-title{max-width:900px;font-size:clamp(2.2rem,5vw,4.4rem);line-height:1.02;margin:.75rem 0 1rem}.hero-subtitle{max-width:780px;font-size:1.08rem;line-height:1.65;color:#e3edf9}.hero-badges{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.4rem}.hero-badge{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);border-radius:999px;padding:.48rem .75rem;font-size:.82rem}.report-main{padding:2.3rem 0 5rem}.decision-strip{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:1rem;margin-top:-3.8rem;position:relative}.decision-card{background:#fff;border:1px solid var(--daily-line);border-radius:18px;padding:1.25rem;box-shadow:0 16px 40px rgba(16,35,62,.12)}.decision-card.primary{background:#102f55;color:#fff;border-color:#102f55}.decision-kicker{font-size:.72rem;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--daily-cyan)}.decision-card.primary .decision-kicker{color:#6ee7f5}.decision-card h2,.decision-card h3{margin:.5rem 0;font-size:1.15rem}.decision-card p{margin:0;line-height:1.55;font-size:.9rem}.status-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.38rem .65rem;font-size:.72rem;font-weight:800;background:#e5f6ef;color:#087653}.status-pill.partial{background:#fff2d7;color:#8a5800}.status-pill.risk{background:#fff1f3;color:#a3283a}.section-shell{background:#fff;border:1px solid var(--daily-line);border-radius:20px;padding:1.5rem;margin-top:1.25rem}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.1rem}.section-kicker{text-transform:uppercase;letter-spacing:.1em;color:var(--daily-blue);font-size:.72rem;font-weight:800}.section-shell h2{margin:.25rem 0 0;font-size:clamp(1.35rem,2.5vw,2rem)}.section-intro{color:var(--daily-muted);line-height:1.7;max-width:880px}.dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem}.dash-card{background:var(--daily-soft);border:1px solid #e4ebf4;border-radius:14px;padding:1rem}.dash-label{color:var(--daily-muted);font-size:.78rem}.dash-value{font-size:1.15rem;font-weight:800;margin:.35rem 0}.dash-note{font-size:.75rem;color:var(--daily-muted)}.dash-move{font-size:.85rem;font-weight:700}.dash-move.up{color:var(--daily-green)}.dash-move.down{color:var(--daily-red)}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.data-card{border:1px solid var(--daily-line);border-radius:15px;padding:1.05rem;background:#fff}.data-card h3{margin:.15rem 0 .7rem}.data-card p{color:var(--daily-muted);line-height:1.65}.data-table{width:100%;border-collapse:collapse;font-size:.88rem}.data-table th,.data-table td{text-align:left;padding:.75rem;border-bottom:1px solid var(--daily-line)}.data-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--daily-muted)}.data-table tr:last-child td{border-bottom:0}.quality-note{border-left:4px solid var(--daily-cyan);padding:.8rem 1rem;background:#effbfe;color:#245266;line-height:1.55}.warning-note{border-left-color:var(--daily-amber);background:#fff8e9;color:#65470f}.risk-note{border-left-color:var(--daily-red);background:#fff1f3;color:#71313a}.timeline{display:grid;gap:.7rem}.timeline-item{display:grid;grid-template-columns:180px 1fr;gap:1rem;border-bottom:1px solid var(--daily-line);padding:.8rem 0}.timeline-item:last-child{border-bottom:0}.timeline-time{font-weight:800;color:var(--daily-blue)}.timeline-copy strong{display:block;margin-bottom:.25rem}.timeline-copy span{color:var(--daily-muted);line-height:1.5}.scenario-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.scenario{border-radius:15px;padding:1.1rem;border:1px solid var(--daily-line)}.scenario.base{border-top:4px solid var(--daily-blue)}.scenario.up{border-top:4px solid var(--daily-green)}.scenario.down{border-top:4px solid var(--daily-red)}.scenario.flat{border-top:4px solid var(--daily-muted)}.scenario h3{margin:.1rem 0 .55rem}.scenario p{color:var(--daily-muted);line-height:1.6}.focus-card{border-radius:16px;border:1px solid var(--daily-line);padding:1.15rem;background:linear-gradient(180deg,#fff,#f7faff)}.focus-symbol{font-size:1.45rem;font-weight:800}.focus-what{font-size:.82rem;color:var(--daily-blue);font-weight:600;margin-bottom:.5rem}.metric-row{display:grid;grid-template-columns:repeat(2,1fr);gap:.65rem;margin:.9rem 0}.metric{background:#edf3fa;border-radius:10px;padding:.7rem}.metric span{display:block;color:var(--daily-muted);font-size:.72rem}.metric strong{display:block;margin-top:.25rem}.checklist{display:grid;gap:.65rem;padding:0;list-style:none}.checklist li{display:flex;gap:.7rem;align-items:flex-start;border-bottom:1px solid var(--daily-line);padding:.65rem 0}.checklist li:last-child{border-bottom:0}.checklist i{color:var(--daily-blue);margin-top:.2rem}.source-list{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}.source-item{background:var(--daily-soft);border-radius:12px;padding:.9rem}.source-item strong{display:block;margin-bottom:.25rem}.source-item span{color:var(--daily-muted);font-size:.82rem;line-height:1.5}.echart-box{min-height:310px;border:1px solid var(--daily-line);border-radius:15px;background:#fff}.empty-state{border:1px dashed #aebed1;border-radius:14px;padding:1.1rem;background:#f8fafc}.empty-state strong{display:block;color:var(--daily-amber);margin-bottom:.35rem}.empty-state p{margin:0;color:var(--daily-muted);line-height:1.6}.provenance{font-size:.76rem;color:var(--daily-muted);margin-top:.8rem}.geo-alert{border-left:4px solid var(--daily-red);background:#fff1f3;border-radius:12px;padding:1rem 1.15rem;margin-bottom:.8rem}.geo-alert h3{margin:0 0 .4rem;font-size:1.02rem;color:#8f2233}.geo-alert p{margin:0;color:#71313a;line-height:1.6}.fnav-menu{max-height:70vh;overflow:auto}@media(max-width:900px){.decision-strip,.dashboard-grid,.three-col{grid-template-columns:1fr 1fr}.two-col,.scenario-grid{grid-template-columns:1fr}.source-list{grid-template-columns:1fr}}@media(max-width:620px){.decision-strip,.dashboard-grid,.three-col{grid-template-columns:1fr}.hero-section{padding-top:3rem}.section-shell{padding:1.05rem}.timeline-item{grid-template-columns:1fr;gap:.25rem}.data-table{font-size:.78rem}.data-table th,.data-table td{padding:.55rem .35rem}}
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<section class="hero-section"><div class="container"><div class="hero-date">Lundi 7 septembre 2026 • Fête du Travail américaine, places fermées</div><h1 class="hero-title">Un bond du pétrole que les actions du secteur n&rsquo;ont pas suivi</h1><p class="hero-subtitle">Wall Street ne cote pas aujourd&rsquo;hui. Le fonds pétrolier coté a pris près de dix pour cent en cinq séances; les actions du secteur n&rsquo;en ont retenu qu&rsquo;un quart. C&rsquo;est le seul écart net d&rsquo;une cote actions américaine par ailleurs plate, et la semaine apporte deux chiffres de prix puis une décision de taux jouée à pile ou face.</p><div class="hero-badges"><span class="hero-badge">Clôtures arrêtées au 4 septembre</span><span class="hero-badge">Crypto : bougie du 6 septembre</span><span class="hero-badge">Séance de référence = jour de l&rsquo;emploi américain</span><span class="hero-badge">Couverture initiés incomplète</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>

<main class="report-main"><div class="container">
  <section id="alerte" class="decision-strip" data-status="validated">
    <article class="decision-card primary"><div class="decision-kicker">Alerte du jour</div><h2>DÉCISION : ne rien ajouter avant les deux chiffres de prix</h2><p>Le pétrole coté gagne ${uso5d()} en cinq séances; les actions pétrolières ${sec5d('XLE')} seulement. Conséquence : ne pas courir après l&rsquo;énergie, et ne pas monter en risque avant les deux publications de prix de jeudi et vendredi. Si vous détenez déjà de l&rsquo;énergie : le gain est acquis, sans que nous puissions en expliquer la cause. Alléger une partie avant les deux chiffres est un arbitrage défendable; le garder aussi, tant que le fonds tient ${usoAug31Close()}. C&rsquo;est un choix de confort, pas un signal.</p></article>
    <article class="decision-card"><span class="status-pill">CONTRÔLÉ</span><h3>Clôture de référence</h3><p>Les cours d&rsquo;actions s&rsquo;arrêtent au ${refClose()}, jour de la publication de l&rsquo;emploi américain. La prochaine clôture sera celle de mardi : aucune séance ne se tient aujourd&rsquo;hui.</p></article>
    <article class="decision-card"><span class="status-pill partial">DONNÉE INCOMPLÈTE</span><h3>Deux réserves</h3><p>La couverture officielle des déclarations d&rsquo;initiés est incomplète sur la période, et le relevé des marchés de probabilité ne couvre pas tous les contrats existants. Les deux réserves sont détaillées en fin d&rsquo;article.</p></article>
  </section>

  <section id="dashboard" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Vue instantanée</div><h2>Cinq séances, un seul mouvement</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Variations sur cinq séances, arrêtées au ${refCloseShort()}. La grille tient en une phrase : le pétrole bouge, le reste ne bouge pas. Les grands indices terminent la période à ${idx5d('SPY')} pour le marché large et ${idx5d('QQQ')} pour la technologie — l&rsquo;équivalent de rien.</p>
    <div class="dashboard-grid">
${dashboard.map(([label, close, move, note]) => `      <article class="dash-card"><div class="dash-label">${label}</div><div class="dash-value">${close}</div><div class="dash-move ${move.includes('−') ? 'down' : 'up'}">${move}</div><div class="dash-note">${note}</div></article>`).join('\n')}
    </div>
    <p class="provenance">Cours de clôture quotidiens. Une séance encore en cours n&rsquo;est jamais comptée comme une clôture; les variations sont recalculées depuis ces cours, jamais depuis un prix en direct.</p>
  </section>

  <section id="petrole" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Le fait de la semaine</div><h2>Une réévaluation en une séance, puis un silence</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="two-col"><div><p class="section-intro">Le ${usoSep1Date()}, le fonds pétrolier coté est passé de ${usoAug31Close()} à ${usoSep1Close()}, soit ${usoSep1()}, avec un volume de ${usoSep1Vol()} la moyenne des huit séances précédentes. Trois séances de consolidation ont suivi, sans rien rendre.</p>
      <p class="section-intro">Les actions du secteur pétrolier n&rsquo;ont pris que ${sec5d('XLE')} sur la même période, soit moins d&rsquo;un quart du mouvement du fonds, et elles ont reculé de ${sec1d('XLE')} sur la séance de référence pendant que le fonds faisait ${idx1d('USO')}. Ce sont ces actions qui valorisent la durée d&rsquo;un prix du pétrole; le fonds, lui, suit des contrats à terme qu&rsquo;il faut renouveler.</p>
      <div class="quality-note"><strong>Lecture.</strong> Ce matin, hors séance américaine, le brut lui-même se traite à ${clPrice()}, ${cl72h()} sur trois jours et ${cl24h()} sur vingt-quatre heures : le baril a donc encore progressé sur trois jours, mais ne va plus nulle part depuis hier. Ce cours-là est une lecture en direct, pas une clôture arrêtée. L&rsquo;hypothèse la plus simple est donc que le marché actions voit un problème d&rsquo;acheminement plutôt qu&rsquo;un palier de prix durable. Les deux chiffres de prix de cette semaine trancheront.</div>
      <div class="quality-note warning-note"><strong>Cause inconnue de nous.</strong> Les explications qui circulent pour ce bond relèvent de la presse et ne sont adossées à aucune de nos mesures. Ce briefing donne l&rsquo;ampleur du mouvement et s&rsquo;arrête là.</div></div>
      <div id="indicesChart" class="echart-box" style="width:100%;height:330px"></div></div>
    <p class="provenance">Graphique : cours de clôture des quinze dernières séances disponibles. Aucune donnée intraséance postérieure au ${refCloseShort()}.</p>
  </section>

  <section id="rotation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Rotation sectorielle</div><h2>Rotation sur cinq séances, et un chiffre d&rsquo;emploi au milieu</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="two-col"><div><p class="section-intro">Sur cinq séances, l&rsquo;énergie mène à ${sec5d('XLE')} devant la technologie ${sec5d('XLK')}. En bas de tableau : consommation discrétionnaire ${sec5d('XLY')}, matériaux ${sec5d('XLB')}, immobilier coté ${sec5d('XLRE')}.</p>
      <p class="section-intro">La tentation est d&rsquo;y lire une facture énergétique payée par le consommateur. Deux chiffres l&rsquo;empêchent. Les services publics, le secteur le plus sensible aux taux, terminent troisièmes à ${sec5d('XLU')} — s&rsquo;il y avait une pression durable sur les taux, ils seraient en bas de tableau. Et la finance, qui en profiterait, fait ${sec5d('XLF')}, exactement zéro. Un classement dont les deux secteurs les plus sensibles aux taux ne bougent pas ne raconte pas une histoire de taux.</p>
      <p class="section-intro">Un point de méthode, parce qu&rsquo;il change la lecture : la séance du ${nfpDate()} était celle du rapport sur l&rsquo;emploi américain. Ce jour-là, la technologie gagne ${sec1d('XLK')}, l&rsquo;industrie ${sec1d('XLI')} et les services publics ${sec1d('XLU')} — trois secteurs en hausse, pas un seul —, la consommation discrétionnaire cède ${sec1d('XLY')} et l&rsquo;énergie ${sec1d('XLE')}. Un tableau de secteurs pris le jour de l&rsquo;emploi mélange donc au moins deux causes, et nous n&rsquo;avons rien qui permette de les séparer.</p>
      <div class="quality-note"><strong>Conséquence.</strong> L&rsquo;écart à suivre est celui entre le fonds pétrolier et les actions du secteur, pas entre l&rsquo;énergie et la consommation. S&rsquo;il se referme parce que les actions montent, le marché valide la durée du mouvement. S&rsquo;il se referme parce que le fonds redescend, il n&rsquo;y avait rien à valider.</div></div>
      <div id="sectorChart" class="echart-box" style="width:100%;height:360px"></div></div>
  </section>

  <section id="fed" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Le dossier central</div><h2>Une décision serrée, jouée à pile ou face</h2></div><span class="status-pill partial">DONNÉE INCOMPLÈTE</span></div>
    <p class="section-intro">Sur les marchés de probabilité, la réunion du ${dFomc()} se répartit entre statu quo ${pmHold()} et hausse d&rsquo;un quart de point ${pmHike25()}. Les baisses ne sont plus cotées de façon exploitable. Avec des fourchettes achat-vente de ${pmHoldBid()} contre ${pmHoldAsk()} sur le statu quo et ${pmHikeBid()} contre ${pmHikeAsk()} sur la hausse, les deux issues sont indistinguables : à ce stade, c&rsquo;est pile ou face.</p>
    <div class="two-col">
      <div class="data-card"><h3>Le niveau, et le sens du mouvement</h3><table class="data-table"><thead><tr><th>Issue</th><th>Cote</th><th>Sept jours</th></tr></thead><tbody>
        <tr><td>Statu quo</td><td>${pmHold()}</td><td>${pmHold7d()}</td></tr>
        <tr><td>Hausse d&rsquo;un quart de point</td><td>${pmHike25()}</td><td>${pmHike7d()}</td></tr>
      </tbody></table><p>Le mouvement se poursuit sur les dernières vingt-quatre heures, dans le même sens. Échanges de la journée sur le contrat de statu quo : ${pmHoldVol24()}.</p></div>
      <div><p class="section-intro">Le niveau seul cache le sens du mouvement. Il y a une semaine, la hausse de taux était favorite; elle a perdu ${pmHike7d()} depuis, le statu quo en a gagné ${pmHold7d()}, et les deux viennent de se croiser. Une réserve, toutefois : cette fenêtre de sept jours contient la publication de l&rsquo;emploi du ${nfpDate()}. Là aussi, au moins deux causes se mélangent et nous n&rsquo;avons pas de quoi les départager. Sur vingt-quatre heures, le mouvement supplémentaire est d&rsquo;un point, à l&rsquo;intérieur de la fourchette de cotation et sans séance américaine : il ne prouve rien à lui seul.</p>
      <p class="section-intro">Un mot sur la volatilité, pour éviter un contresens répandu. La protection à très court terme se paie ${vixShort()} sur l&rsquo;indice de volatilité — un niveau de marché calme, sachant qu&rsquo;au-dessus de vingt on parle de marché nerveux. À un mois elle vaut ${vixSpot()}, à trois mois ${vixMid()}, à six mois ${vixLong()}. Cette pente montante est la forme habituelle de cette courbe et ne signale donc rien de particulier. Le seul point utile est de savoir ce que chaque échéance couvre : celle à neuf jours, la moins chère, couvre le chiffre des prix du ${dCpiShort()} mais expire avant la réunion du ${dFomcShort()}. Autrement dit, « la volatilité est basse » ne dit rien sur la réunion.</p>
      <div class="quality-note"><strong>À retenir.</strong> Une décision serrée, dont l&rsquo;issue la plus probable a changé de camp en une semaine, sur une fenêtre qui contient un rapport sur l&rsquo;emploi. C&rsquo;est assez d&rsquo;incertitude pour ne pas monter en risque avant les deux chiffres de prix, et trop peu de certitude pour parier sur l&rsquo;issue.</div></div>
    </div>
    <p class="provenance">Réserve : le relevé des marchés de probabilité ne couvre pas tous les contrats existants et se déclare incomplet. Les cotes ci-dessus sont des points milieux entre achat et vente, pas des prix auxquels on peut traiter.</p>
  </section>

  <section id="agenda" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Agenda officiel</div><h2>Deux prix, puis la décision</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Ces dates viennent des calendriers publiés par les organismes eux-mêmes. La précaution est utile : le calendrier de marché que nous recevons ne contient aujourd&rsquo;hui ni l&rsquo;indice des prix à la production, ni la réunion de la banque centrale.</p>
    <div class="timeline">
      <article class="timeline-item"><div class="timeline-time">Aujourd&rsquo;hui</div><div class="timeline-copy"><strong>Places américaines fermées</strong><span>Fête du Travail. Aucun cours de clôture d&rsquo;actions ne sera produit pour cette journée. Les contrats à terme et la crypto continuent de coter; ils ne remplacent pas une séance.</span></div></article>
      <article class="timeline-item"><div class="timeline-time">${dPpi()}</div><div class="timeline-copy"><strong>Prix à la production</strong><span>Les prix à la production sont le premier endroit où un choc de coûts se voit, avant qu&rsquo;il atteigne le consommateur. Le calendrier de marché place aussi la décision de la Banque centrale européenne ce jour-là; cette date ne figure pas dans les calendriers officiels que nous utilisons et reste donc à confirmer. Pour un portefeuille en euros, les deux événements portent sur le coût de l&rsquo;argent, pas sur les bénéfices. Nous ne publions aucun niveau européen, faute de cours arrêtés pour cette région.</span></div></article>
      <article class="timeline-item"><div class="timeline-time">${dCpi()}</div><div class="timeline-copy"><strong>Prix à la consommation</strong><span>La publication décisive. C&rsquo;est le dernier vendredi avant la décision : deux séances seulement les séparent, ce qui lui donne un poids inhabituel sur une issue aussi serrée.</span></div></article>
      <article class="timeline-item"><div class="timeline-time">${dFomcShort()}</div><div class="timeline-copy"><strong>Décision de taux, avec projections</strong><span>Réunion à projections : la banque centrale y révise sa trajectoire, pas seulement le taux du jour. C&rsquo;est le rendez-vous qui compte.</span></div></article>
    </div>
    <p class="provenance">Dates de prix et de politique monétaire : calendriers du Bureau of Labor Statistics et du Conseil des gouverneurs de la Réserve fédérale, relevés le ${registryFetched()}. Le calendrier de résultats vient d&rsquo;une seule source et reste à confirmer.</p>
  </section>

  <section id="metaux" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Métaux précieux</div><h2>Or et argent : une chute pas encore rattrapée</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Le ${gldAug28Date()}, l&rsquo;or coté a cédé ${gldAug28()} sur la séance avec ${gldAug28Vol()} son volume moyen des huit séances précédentes, et l&rsquo;argent ${slvAug28()} avec ${slvAug28Vol()} le sien.</p>
    <p class="section-intro">La baisse s&rsquo;est ensuite prolongée : l&rsquo;or a fait un plus bas le ${gldLowDate()} à ${gldLowClose()}, avant de remonter jusqu&rsquo;à ${gldSep3Close()} le ${gldSep3Date()}. Mais le compte se fait depuis le cours d&rsquo;avant la chute, ${gldPreClose()} : à l&rsquo;arrivée l&rsquo;or reste à ${gldPreMove()} et l&rsquo;argent à ${slvPreMove()}. Rien n&rsquo;a été rattrapé.</p>
    <div class="quality-note"><strong>Ce que cela vaut.</strong> Un métal qui recule de près de quatre pour cent pendant que le pétrole bondit ne ressemble pas à une peur de l&rsquo;inflation. C&rsquo;est le seul enseignement solide ici. L&rsquo;explication classique serait des taux réels plus élevés : un rendement sans risque qui dépasse la hausse des prix rend coûteux de détenir un métal qui ne verse rien. Les obligations longues vont dans ce sens, à ${tltPreMove()} depuis le même point de départ, mais la cote d&rsquo;une hausse de taux baisse sur la semaine, ce qui va dans l&rsquo;autre. Nous ne tranchons pas.</div>
  </section>

  <section id="geo" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Géopolitique</div><h2>Ce que les cotes disent, et ce qu&rsquo;elles ne disent pas</h2></div><span class="status-pill partial">DONNÉE INCOMPLÈTE</span></div>
    <div class="geo-alert"><h3>Israël et Iran : cessez-le-feu coté à ${pmCease()}</h3><p>Ce contrat se dénoue sur un critère précis : il tombe si Israël ou l&rsquo;Iran mène une frappe aérienne ou un tir de missile touchant directement l&rsquo;autre pays. À ${pmCease()}, le marché attend donc que la trêve tienne jusqu&rsquo;à la fin du mois. Ce contrat ne dit rien d&rsquo;un autre front, ni de l&rsquo;approvisionnement pétrolier.</p></div>
    <div class="geo-alert"><h3>Espace aérien israélien : ${pmAirspace()}, sans critère publié</h3><p>Une fermeture de l&rsquo;espace aérien israélien avant la fin du mois se traite à ${pmAirspace()}. Nous n&rsquo;avons pas le détail des conditions de dénouement de ce contrat : une fermeture brève ou programmée pourrait suffire, ce qui rendrait cette cote banale. Nous publions donc le chiffre sans l&rsquo;interpréter, et sans le croiser avec le précédent.</p></div>
    <p class="section-intro">Ce que nous ne faisons pas : relier ces cotes au bond du pétrole. Nos relevés ne contiennent aucune donnée sur l&rsquo;approvisionnement, les stocks ou le raffinage, et une cote sur un cessez-le-feu régional n&rsquo;est pas une mesure du risque d&rsquo;acheminement. Par ailleurs, le contexte des échanges hors séance ne permet pas de trancher sur le sens de la réouverture de mardi.</p>
  </section>

  <section id="crypto" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Crypto</div><h2>La seule cote continue du week-end</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="two-col"><div><table class="data-table"><thead><tr><th>Actif</th><th>Dernier cours complet</th><th>Cinq bougies</th></tr></thead><tbody>
      <tr><td>Bitcoin</td><td>${cryClose('BTC', USD0)}</td><td>${cry5d('BTC')}</td></tr>
      <tr><td>Ether</td><td>${cryClose('ETH', USD)}</td><td>${cry5d('ETH')}</td></tr>
      <tr><td>Solana</td><td>${cryClose('SOL', USD)}</td><td>${cry5d('SOL')}</td></tr>
      <tr><td>XRP</td><td>${cryClose('XRP', USD4)}</td><td>${cry5d('XRP')}</td></tr>
    </tbody></table>
      <div class="quality-note warning-note"><strong>Horloge séparée.</strong> La crypto cote en continu et change de journée à minuit heure universelle. Le cours du ${cryptoRef()} est le dernier arrêté au moment du relevé; celui du jour courait encore et reste exclu. Ces chiffres ne se comparent donc pas séance par séance avec les actions.</div></div>
      <div id="cryptoChart" class="echart-box" style="width:100%;height:340px"></div></div>
    <p class="section-intro">Sur cinq bougies le compartiment monte, mais le mouvement s&rsquo;est arrêté : ce matin le bitcoin fait ${btc24h()} sur vingt-quatre heures. La crypto renseigne sur la liquidité et le goût du risque; ici elle ne tranche rien, et les échanges hors séance de ce matin ne permettent pas d&rsquo;anticiper la réouverture américaine.</p>
  </section>

  <section id="sentiment" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Régime</div><h2>Un modèle favorable au risque, l&rsquo;autre sans avis</h2></div><span class="status-pill partial">DONNÉE INCOMPLÈTE</span></div>
    <div class="three-col">
      <article class="data-card"><h3>Premier modèle : favorable</h3><p>Score de régime ${dtxScore()} sur une échelle où le maximum vaut un. Le grand indice américain se tient à ${dtxSpx()}, au-dessus de sa moyenne à cinquante séances (${dtxSma50()}) et à deux cents séances (${dtxSma200()}). La volatilité mesurée est basse : ${dtxVix()}, sous sa moyenne à ${dtxVixSma()}.</p></article>
      <article class="data-card"><h3>Second modèle : sans avis</h3><p>Probabilité favorable au risque ${regRiskOn()}, contre ${regNeutral()} pour la neutralité. Un modèle à cinquante-cinquante ne rend pas de verdict. Il ne confirme donc pas le premier : il s&rsquo;abstient.</p></article>
      <article class="data-card"><h3>Ce que le modèle attend</h3><p>Sur cinq séances : ${regTransRiskOn()} de rester favorable au risque, ${regTransRiskOff()} d&rsquo;entrer en sortie de risque, ${regTransCrisis()} de crise. Gain attendu ${regReturn()}, repli de référence ${regDd()}. Des ordres de grandeur, pas des prévisions, et encore moins des limites de perte.</p></article>
    </div>
    <div class="quality-note warning-note"><strong>Réserve sur le premier modèle.</strong> Sa composante de volatilité a été calculée par une méthode de repli, faute d&rsquo;un historique assez long, et elle ressort au maximum de son échelle. Un second relevé du même modèle, pris dans la même série, donne ${dtxScoreAlt()} pour cette composante au lieu du maximum, et un score d&rsquo;ensemble de ${systScoreAlt2()} au lieu de ${dtxScore()}. L&rsquo;écart est faible, mais il montre que ce score n&rsquo;est pas une mesure stable au centième.</div>
    <div class="scenario-grid">
      <article class="scenario base"><h3>Scénario de base — rien ne se valide</h3><p>Les chiffres de jeudi et vendredi ressortent sans accélération, la cote de hausse de taux continue de s&rsquo;effriter, le fonds pétrolier redescend vers son point de départ. Action : ne rien faire, et ne pas rester sur l&rsquo;énergie en croyant détenir une couverture contre l&rsquo;inflation.</p></article>
      <article class="scenario down"><h3>Scénario contraire — les prix surprennent</h3><p>Les chiffres de jeudi et vendredi ressortent au-dessus des attentes, la cote de hausse de taux repasse devant le statu quo, les actions pétrolières rattrapent le fonds. Action dans ce cas : ne pas acheter l&rsquo;énergie sur la nouvelle, et regarder d&rsquo;abord ce qui, dans son propre portefeuille, paie la facture — consommation, immobilier, industrie.</p></article>
    </div>
    <div class="quality-note"><strong>Invalidation datée.</strong> Le test tombe le ${dCpi()} au soir, et il porte sur un seul chiffre : la cote d&rsquo;une hausse de taux, aujourd&rsquo;hui ${pmHike25()}. Si elle repasse au-dessus de celle du statu quo, ${pmHold()}, la lecture prudente de ce briefing est fausse et le sujet devient le rythme du resserrement. Si elle reste en dessous, la semaine se sera jouée sans réévaluation. Second repère, indépendant du premier : le fonds pétrolier sous ${usoAug31Close()}, son cours d&rsquo;avant le bond, signerait la fin de l&rsquo;épisode. À l&rsquo;inverse, la consommation discrétionnaire est déjà au bas de sa fourchette — plus bas de période à ${xlyLow()} le ${xlyLowDate()}, à moins d&rsquo;un demi-pour-cent du dernier cours — donc un nouveau plus bas y serait un signal faible, pas une confirmation.</div>
  </section>

  <section id="earnings" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Résultats à surveiller</div><h2>Quatre publications, mardi et mercredi</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <p class="section-intro">Ce sont les sociétés de plus de dix milliards de dollars qui publient dans les deux prochaines séances, classées par ampleur du mouvement attendu pondérée par leur taille. Notre relevé ne va pas au-delà de mercredi : d&rsquo;autres publications de jeudi et vendredi ne sont pas couvertes ici. Sur ces deux séances, ce sont les chiffres de prix qui mènent.</p>
    <div class="quality-note risk-note"><strong>À lire avant les quatre fiches.</strong> Le marché d&rsquo;options facture d&rsquo;avance un écart de cours le jour de la publication, dans un sens ou dans l&rsquo;autre — personne ne sait lequel. C&rsquo;est le prix de l&rsquo;incertitude, en aucun cas un objectif de cours. Autre chiffre qui revient plus bas : la part du flottant vendue à découvert, c&rsquo;est-à-dire la proportion des actions disponibles à l&rsquo;échange qui ont été empruntées et vendues par des investisseurs pariant sur la baisse. Sur COO par exemple, il faut payer ${cooStraddle()} pour couvrir l&rsquo;écart sur un titre à ${coo.close()}. Et un ordre stop ne protège pas d&rsquo;un écart à l&rsquo;ouverture : une fois déclenché, il devient un ordre au marché et s&rsquo;exécute où le marché veut. La seule variable qui compte vraiment ici est la taille de la position, choisie pour qu&rsquo;un écart défavorable de cette ampleur reste supportable.</div>
    <div class="two-col">
      <article class="focus-card"><div class="focus-symbol">COO</div><div class="focus-what">Santé — publication le ${coo.reportDate()}</div><p>Le plus gros écart attendu du lot, ${coo.implied()}, sur un titre qui aborde l&rsquo;événement sous ses trois moyennes mobiles, dont celle à vingt séances à ${coo.ema20()}.</p><div class="metric-row"><div class="metric"><span>Cours</span><strong>${coo.close()}</strong></div><div class="metric"><span>Vingt séances</span><strong>${coo.d20()}</strong></div><div class="metric"><span>${literal('Dynamique de 0 à 100')}</span><strong>${coo.rsi()}</strong></div><div class="metric"><span>Amplitude d&rsquo;un jour normal</span><strong>${coo.atr()}</strong></div></div><p>Aucune déclaration d&rsquo;initié n&rsquo;est disponible pour ce titre sur la période : la couverture officielle est incomplète, ce qui ne permet aucune conclusion sur ce que font les dirigeants.</p></article>
      <article class="focus-card"><div class="focus-symbol">SUNB</div><div class="focus-what">Location de matériel — publication le ${sunb.reportDate()}</div><p>Écart attendu ${sunb.implied()}, après ${sunb.d20()} en vingt séances. Un loueur paie l&rsquo;énergie sur sa flotte et les intérêts sur son parc : les deux sujets de la semaine le concernent directement.</p><div class="metric-row"><div class="metric"><span>Cours</span><strong>${sunb.close()}</strong></div><div class="metric"><span>Capitalisation</span><strong>${sunb.mcap()}</strong></div><div class="metric"><span>${literal('Dynamique de 0 à 100')}</span><strong>${sunb.rsi()}</strong></div><div class="metric"><span>Vendu à découvert</span><strong>${sunbShort()}</strong></div></div><p>La part vendue à découvert monte et il faudrait environ ${sunbDtc()} de volume habituel pour la racheter. Les déclarations d&rsquo;initiés les plus récentes, datées du ${sunbInsiderDate()}, sont des attributions d&rsquo;actions dont la fonction des bénéficiaires n&rsquo;est pas renseignée dans nos relevés, et aucun achat en Bourse n&rsquo;y figure. Des attributions ne renseignent sur aucune conviction. Plus tôt sur la période, ${sunbSells()} ventes sont déclarées, dont ${sunbTxShares()} titres cédés par le directeur des opérations à ${sunbTxPrice()} le ${sunbTxDate()}.</p></article>
      <article class="focus-card"><div class="focus-symbol">SAIL</div><div class="focus-what">Logiciel de sécurité des identités — publication le ${sail.reportDate()}</div><p>Environ ${sailShort()} des actions disponibles à l&rsquo;échange sont vendues à découvert au relevé du ${sailSettle()} — c&rsquo;est-à-dire empruntées et vendues par des investisseurs qui parient sur la baisse. Il leur faudrait à peu près ${sailDtc()} de volume habituel pour racheter. En face, un écart attendu de ${sail.implied()}.</p><div class="metric-row"><div class="metric"><span>Cours</span><strong>${sail.close()}</strong></div><div class="metric"><span>Vingt séances</span><strong>${sail.d20()}</strong></div><div class="metric"><span>${literal('Dynamique de 0 à 100')}</span><strong>${sail.rsi()}</strong></div><div class="metric"><span>Amplitude d&rsquo;un jour normal</span><strong>${sail.atr()}</strong></div></div><p>C&rsquo;est le seul des quatre à coter au-dessus de sa moyenne à vingt séances (${sail.ema20()}). Une position vendeuse importante amplifie le mouvement dans les deux sens, sans indiquer de direction. À noter de l&rsquo;autre côté : ${sailSells()} ventes d&rsquo;initiés sont déclarées sur la période et aucun achat n&rsquo;y figure, dont ${sailTxShares()} titres cédés par le directeur général à ${sailTxPrice()} le ${sailTxDate()}. La couverture officielle étant incomplète, ces opérations sont réelles et datées mais aucun solde net ne peut être établi.</p></article>
      <article class="focus-card"><div class="focus-symbol">CASY</div><div class="focus-what">Distribution de carburant et de proximité — publication le ${casy.reportDate()}</div><p>Écart attendu ${casy.implied()}, après ${casy.d20()} en vingt séances. Le titre cote sous sa moyenne à vingt séances (${casy.ema20()}).</p><div class="metric-row"><div class="metric"><span>Cours</span><strong>${casy.close()}</strong></div><div class="metric"><span>Capitalisation</span><strong>${casy.mcap()}</strong></div><div class="metric"><span>${literal('Dynamique de 0 à 100')}</span><strong>${casy.rsi()}</strong></div><div class="metric"><span>Vendu à découvert</span><strong>${casyShort()}</strong></div></div><p>Deutsche Bank, Evercore ISI et JPMorgan ont abaissé leur objectif de cours dans les séances qui ont précédé la publication, après des relèvements de recommandation de BMO et de Northcoast cet été. Côté dirigeants, ${casySells()} ventes et ${casyBuys()} achat sont déclarés sur la période, dont ${casyTxShares()} titres cédés par le directeur financier à ${casyTxPrice()} le ${casyTxDate()} — opérations réelles et datées, sur une couverture officielle incomplète qui interdit d&rsquo;en tirer un solde. Le consensus s&rsquo;est retourné en quelques semaines, ce qui ne dit rien du résultat à venir.</p></article>
    </div>
    <p class="provenance">Action, pour les quatre : ne rien faire avant la publication, puis laisser passer une séance complète. Si le titre tient le plus bas du lendemain de publication pendant deux séances, il y a une base de travail; sinon, il n&rsquo;y a rien à jouer.</p>
  </section>

  <section id="formation" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">Formation</div><h2>Comment savoir si une hausse du pétrole est sérieuse</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <div class="two-col"><div><p class="section-intro">Le baril et les actions pétrolières ne répondent pas à la même question. Le baril dit ce que vaut un chargement à livrer bientôt : il réagit à un navire bloqué, à une raffinerie à l&rsquo;arrêt, à une frayeur. Les actions pétrolières, elles, valent la somme des bénéfices futurs d&rsquo;une compagnie, sur des années. Elles ne montent donc que si le marché croit que le prix élevé va durer.</p>
      <p class="section-intro">D&rsquo;où un test simple et gratuit, utilisable à chaque flambée. On compare le mouvement du pétrole — ici celui du fonds coté, faute de mieux — à celui des actions du secteur sur la même période. Si les actions suivent largement, le marché achète un nouveau palier de prix. Si elles ne prennent qu&rsquo;une fraction du mouvement, le marché achète un incident : il pense que cela va se résorber.</p></div>
      <div><p class="section-intro">Cette semaine, le rapport est net : ${uso5d()} pour le fonds pétrolier coté, ${sec5d('XLE')} pour les actions du secteur, et ces mêmes actions ont reculé de ${sec1d('XLE')} sur la dernière séance. Moins d&rsquo;un quart du mouvement a été repris par ceux qui parient sur la durée.</p>
      <div class="quality-note"><strong>À retenir.</strong> Une flambée du baril que les actions du secteur ne suivent pas est une information sur l&rsquo;acheminement, pas sur l&rsquo;inflation. Le test ne dit pas qui a raison — les actions se trompent parfois, et parfois longtemps. Il dit seulement où placer son scepticisme, et il évite d&rsquo;acheter un secteur entier sur la foi d&rsquo;un seul chiffre.</div>
      <p class="section-intro">Deuxième réflexe, qui vaut pour tout choc de coûts : regarder ce qu&rsquo;on détient déjà et qui paie la facture. Consommation, transport, immobilier, industrie sont du côté des payeurs. Acheter du pétrole sans regarder le reste du portefeuille, c&rsquo;est souvent prendre deux paris opposés sur le même événement.</p></div></div>
  </section>

  <section id="trade" class="section-shell" data-status="no_setup">
    <div class="section-head"><div><div class="section-kicker">Idées de trading</div><h2>ATTENDRE : aucune position recommandée</h2></div><span class="status-pill partial">RIEN À JOUER</span></div>
    <p class="section-intro">Les seuls signaux techniques disponibles ne portent aucun niveau de protection, donc aucun point d&rsquo;entrée n&rsquo;a pu être validé. Ce briefing ne transforme donc ni le mouvement du pétrole ni les quatre publications en points d&rsquo;entrée, stops ou objectifs.</p>
    <div class="three-col">
      <article class="scenario base"><h3>Si vous ne détenez pas d&rsquo;énergie</h3><p>Le mouvement est fait et les actions du secteur n&rsquo;ont pas suivi. Acheter maintenant, c&rsquo;est parier sur une durée que les actions du secteur refusent pour l&rsquo;instant de valoriser. Attendre les deux chiffres de prix coûte trois séances.</p></article>
      <article class="scenario base"><h3>Si vous en détenez déjà</h3><p>Rien à faire d&rsquo;urgence. Le repère est ${usoAug31Close()}, le cours d&rsquo;avant le bond : en dessous, l&rsquo;épisode est terminé et la position ne se justifie plus par cette histoire.</p></article>
      <article class="scenario base"><h3>Sur l&rsquo;indice</h3><p>Deux chiffres de prix et une décision de taux dans la même semaine, avec des indices qui n&rsquo;ont pas bougé sur cinq séances. Le risque n&rsquo;est pas le point d&rsquo;entrée : c&rsquo;est d&rsquo;empiler des paris qui réagissent tous au même chiffre.</p></article>
    </div>
    <p class="provenance">Aucun ordre, aucune position et aucune donnée de compte ne sont utilisés dans ce briefing.</p>
  </section>

  <section id="watch" class="section-shell" data-status="validated">
    <div class="section-head"><div><div class="section-kicker">À surveiller</div><h2>Ce qu&rsquo;il faut surveiller</h2></div><span class="status-pill">CONTRÔLÉ</span></div>
    <ul class="checklist">
      <li><i class="fas fa-arrows-left-right"></i><div><strong>L&rsquo;écart entre le fonds pétrolier et les actions du secteur</strong><br>C&rsquo;est le thermomètre de la semaine. Les actions rattrapent : le marché valide la durée du mouvement. Le fonds redescend vers ${usoAug31Close()}, son cours d&rsquo;avant le bond : l&rsquo;épisode est clos.</div></li>
      <li><i class="fas fa-percent"></i><div><strong>La cote d&rsquo;une hausse de taux</strong><br>À ${pmHike25()}, en baisse de ${pmHike7d()} sur sept jours. Un retour au-dessus du statu quo, actuellement ${pmHold()}, est le signal le plus clair que le marché change d&rsquo;avis.</div></li>
      <li><i class="fas fa-wave-square"></i><div><strong>La volatilité à un mois, pas celle à très court terme</strong><br>C&rsquo;est l&rsquo;échéance à un mois (${vixSpot()}) qui couvre la réunion. Un retour de la volatilité très courte au-dessus de ce niveau dirait que le marché avance son inquiétude.</div></li>
      <li><i class="fas fa-industry"></i><div><strong>Les prix à la production avant ceux à la consommation</strong><br>Un choc de coûts se voit d&rsquo;abord chez le producteur. Le chiffre de jeudi est le meilleur indice avancé de celui de vendredi.</div></li>
      <li><i class="fas fa-building-columns"></i><div><strong>Les obligations longues</strong><br>Elles montent de ${idx1d('TLT')} sur la séance de référence mais reculent de ${tltPreMove()} depuis le point de départ des métaux : la lecture dépend de la fenêtre choisie. Sous ${tltLow()}, leur plus bas de période, elle ne dépendra plus de rien.</div></li>
      <li><i class="fab fa-bitcoin"></i><div><strong>Crypto hors séance</strong><br>Utile comme mesure d&rsquo;appétit pour le risque, sans valeur prédictive sur l&rsquo;ouverture américaine.</div></li>
    </ul>
  </section>

  <section id="sources" class="section-shell" data-status="partial">
    <div class="section-head"><div><div class="section-kicker">Sources et limites</div><h2>Sur quoi repose ce briefing</h2></div><span class="status-pill partial">DONNÉE INCOMPLÈTE</span></div>
    <div class="source-list">
      <div class="source-item"><strong>Cours de clôture quotidiens</strong><span>Indices américains, secteurs, métaux, obligations, énergie et crypto. Les actions s&rsquo;arrêtent à la dernière clôture américaine terminée; la crypto à sa dernière journée complète en heure universelle. Une séance encore en cours n&rsquo;est jamais comptée comme une clôture.</span></div>
      <div class="source-item"><strong>Régime, volatilité, marchés de probabilité</strong><span>Deux modèles de régime indépendants, la courbe de volatilité cotée et les cotes de probabilité, tous relevés à la même heure.</span></div>
      <div class="source-item"><strong>Calendriers officiels</strong><span>Dates de prix et de politique monétaire prises chez les organismes qui publient, avec leur date de relevé. Le calendrier de résultats vient d&rsquo;une seule source et reste à confirmer.</span></div>
      <div class="source-item"><strong>Les quatre sociétés suivies</strong><span>Cours, indicateurs techniques, positions vendeuses, déclarations d&rsquo;initiés et actualité. Aucun niveau de support ou de résistance n&rsquo;est publié, faute de calcul disponible.</span></div>
    </div>
    <div class="quality-note warning-note"><strong>Limites.</strong> La couverture officielle des déclarations d&rsquo;initiés est incomplète sur la période : les opérations citées sont réelles et datées, mais aucun solde net ni aucune direction d&rsquo;ensemble n&rsquo;est publié. Le relevé des marchés de probabilité ne couvre pas tous les contrats existants et se déclare incomplet. Le contrat sur l&rsquo;espace aérien israélien n&rsquo;a pas de conditions de dénouement dans nos relevés. Le seul contrat à terme sur la volatilité n&rsquo;était pas disponible chez notre fournisseur. Enfin, l&rsquo;attribution du mouvement du pétrole vient de la presse et n&rsquo;est pas mesurée ici.</div>
    <div class="two-col"><div class="empty-state" data-empty-state="true"><strong>Europe : cours absents</strong><p>Aucun cours d&rsquo;indice européen n&rsquo;a été relevé. Ni niveau, ni palmarès, ni variation ne sont publiés pour cette région, alors même qu&rsquo;une décision de la Banque centrale européenne est annoncée pour jeudi par le calendrier de marché.</p></div><div class="empty-state" data-empty-state="true"><strong>Asie-Pacifique : cours absents</strong><p>Même situation. Une dépêche ou un site web ne remplace pas un cours de clôture relevé.</p></div></div>
    <p class="section-intro">Ce contenu est informatif et pédagogique. Il ne constitue pas un conseil financier. Toute décision doit tenir compte de votre horizon, de votre tolérance au risque et du risque de perte en capital.</p>
  </section>
</div></main>

<div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"><a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Alerte</span></a><a href="#dashboard" class="fnav-item" data-section="dashboard"><i class="fas fa-gauge-high"></i><span>Tableau</span></a><a href="#fed" class="fnav-item" data-section="fed"><i class="fas fa-percent"></i><span>Taux</span></a><a href="#agenda" class="fnav-item" data-section="agenda"><i class="fas fa-calendar"></i><span>Agenda</span></a><a href="#crypto" class="fnav-item" data-section="crypto"><i class="fab fa-bitcoin"></i><span>Crypto</span></a><a href="#earnings" class="fnav-item" data-section="earnings"><i class="fas fa-chart-line"></i><span>Résultats</span></a></div><button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<footer class="article-footer">&copy; 2026 DailyTickers. Données arrêtées à la dernière clôture. Ceci n&rsquo;est pas un conseil financier.<br><a href="/" title="Home"><i class="fas fa-house"></i></a></footer>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>
(function(){
  var indices=echarts.init(document.getElementById('indicesChart'));
  indices.setOption({tooltip:{trigger:'axis'},legend:{data:['USO','SPY','QQQ','GLD']},grid:{left:52,right:20,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(chartDates)}},yAxis:{type:'value',scale:true},series:[${lineSeries('USO', '#b76e00')},${lineSeries('SPY', '#165dff')},${lineSeries('QQQ', '#00a6c8')},${lineSeries('GLD', '#7b61ff')}]});
  var sectors=echarts.init(document.getElementById('sectorChart'));
  sectors.setOption({tooltip:{trigger:'axis',valueFormatter:function(v){return v.toFixed(2)+' %';}},grid:{left:55,right:24,top:25,bottom:86},xAxis:{type:'category',data:${JSON.stringify(sectorOrder.map(s => SECTOR_FR[s.sym]))},axisLabel:{interval:0,rotate:38,fontSize:10}},yAxis:{type:'value'},series:[{type:'bar',data:${JSON.stringify(sectorChartData)}}]});
  var crypto=echarts.init(document.getElementById('cryptoChart'));
  crypto.setOption({tooltip:{trigger:'axis'},legend:{data:['Bitcoin','Ether']},grid:{left:62,right:20,top:48,bottom:42},xAxis:{type:'category',data:${JSON.stringify(cryptoDates)}},yAxis:[{type:'value',scale:true},{type:'value',scale:true}],series:[{name:'Bitcoin',type:'line',showSymbol:false,data:${JSON.stringify(btcLine)},lineStyle:{color:'#f59e0b'}},{name:'Ether',type:'line',yAxisIndex:1,showSymbol:false,data:${JSON.stringify(ethLine)},lineStyle:{color:'#7b61ff'}}]});
  window.addEventListener('resize',function(){indices.resize();sectors.resize();crypto.resize();});
})();
</script>
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body></html>
`;
// ---------------------------------------------------------------- écriture

fs.writeFileSync(path.join(ROOT, ARTICLE), html);

const manifest = {
  schema_version: 1,
  reference_close: '2026-09-04',
  article_path: ARTICLE,
  article_sha256: sha256(fs.readFileSync(path.join(ROOT, ARTICLE))),
  literals: [...literals],
  claims,
};
fs.writeFileSync(path.join(ROOT, `${DATA}/claims.json`), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[build-daily] ${ARTICLE} — ${html.length} octets, ${claims.length} claims, ${literals.size} littéraux`);
