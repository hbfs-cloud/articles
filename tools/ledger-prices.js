#!/usr/bin/env node
'use strict';
/**
 * ledger-prices — charnière entre la collecte de barres et `signals-ledger.js sweep`.
 *
 *   node tools/ledger-prices.js --in <bars.json> [--in <autre.json>] --out prices.json [--asof YYYY-MM-DD]
 *
 * `signals-ledger.js sweep` attend un fichier `{TICKER:{price,high,low}}`. Les barres
 * arrivent de `collect.js` sous la forme QueryData `{data:{items:[{results:[{symbols,data:[{bars}]}]}]}}`
 * (ou la forme plate `{results:[…]}`). Sans cette pièce, le passage de l'un à l'autre se
 * ferait à la main, ticker par ticker — exactement le transport de valeurs que la doctrine
 * llm-script-boundary interdit (cf. tools/extract-universe.js, même rôle côté vivier).
 *
 * Règles :
 *  - `price` = clôture de la DERNIÈRE barre servie pour le symbole ;
 *  - `high`/`low` = extrêmes sur la FENÊTRE, pour que le sweep voie la mèche qui a touché
 *    un stop ou une cible ;
 *  - `--since-ledger` borne la fenêtre, par ticker, à la date du signal non terminal le
 *    plus ancien. Sans ça, une date globale fait voir au sweep des barres ANTÉRIEURES au
 *    signal : le 2026-08-11, une fenêtre ouverte au 04/08 a scellé CP « stoppé » sur un
 *    point bas du 04/08 alors que le signal datait du 06/08 et que son stop n'a jamais
 *    été approché depuis. Un statut terminal est irréversible : la fenêtre se déduit, elle
 *    ne se choisit pas à la main ;
 *  - `open` n'est JAMAIS émis : il ne sert au sweep qu'à mesurer un trou de cotation sous
 *    le stop, information qu'une fenêtre multi-séances ne porte pas. Absent = pas de gap ;
 *  - un symbole sans barre est OMIS, jamais rempli par une valeur par défaut : le sweep
 *    saute un symbole absent, alors qu'un prix fabriqué scellerait un faux statut.
 *
 * Sort en 1 si aucun symbole n'a pu être extrait (collecte en échec) — jamais en silence.
 */
const fs = require('fs');

const path = require('path');
const TERMINAL = new Set(['tp2', 'stopped', 'expired', 'skipped']);

function args() {
  const a = process.argv.slice(2), ins = [];
  let out = null, since = null, fromLedger = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--in' && a[i + 1]) ins.push(a[++i]);
    else if (a[i] === '--out' && a[i + 1]) out = a[++i];
    else if (a[i] === '--since' && a[i + 1]) since = a[++i];
    else if (a[i] === '--since-ledger') fromLedger = true;
  }
  return { ins, out, since, fromLedger };
}

/** Date de début de fenêtre par ticker = signal NON TERMINAL le plus ancien. */
function ledgerWindows() {
  const p = path.resolve(__dirname, '..', 'data', 'signals-ledger.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const win = {}, multi = {};
  for (const s of j.signals || []) {
    if (TERMINAL.has(s.status) || !s.ticker || !s.date) continue;
    (multi[s.ticker] ||= new Set()).add(s.date);
    if (!win[s.ticker] || s.date < win[s.ticker]) win[s.ticker] = s.date;
  }
  for (const [t, dates] of Object.entries(multi)) {
    if (dates.size > 1) {
      console.error(`[ledger-prices] ⚠ ${t} porte ${dates.size} signaux ouverts de dates différentes `
        + `(${[...dates].sort().join(', ')}) — la fenêtre s'ouvre à la plus ancienne, donc les signaux `
        + `plus récents voient des barres antérieures à leur émission. Vérifier leur statut à la main.`);
    }
  }
  return win;
}

function barsFrom(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const roots = [];
  if (Array.isArray(j.results)) roots.push(...j.results);
  if (j.data && Array.isArray(j.data.items)) {
    for (const it of j.data.items) if (Array.isArray(it.results)) roots.push(...it.results);
  }
  const out = {};
  for (const r of roots) {
    if (r.data_type && r.data_type !== 'bars_daily') continue;
    const syms = r.symbols || [];
    (r.data || []).forEach((it, i) => {
      const sym = (it && (it.symbol || syms[i])) || null;
      if (!sym || !it || !Array.isArray(it.bars) || !it.bars.length) return;
      out[sym] = it.bars.map(b => ({ d: b[0], h: +b[2], l: +b[3], c: +b[4] }))
        .sort((x, y) => (x.d < y.d ? -1 : 1));
    });
  }
  return out;
}

const { ins, out, since, fromLedger } = args();
if (!ins.length || !out) {
  console.error('Usage: node tools/ledger-prices.js --in <bars.json> [--in …] --out <prices.json> [--since YYYY-MM-DD | --since-ledger]');
  process.exit(2);
}
const windows = fromLedger ? ledgerWindows() : {};

const merged = {};
for (const f of ins) {
  let b; try { b = barsFrom(f); }
  catch (e) { console.error(`[ledger-prices] ${f} illisible : ${e.message}`); continue; }
  for (const [s, rows] of Object.entries(b)) {
    if (!merged[s] || rows.at(-1).d >= merged[s].at(-1).d) merged[s] = rows;
  }
}

const prices = {};
for (const [s, rows] of Object.entries(merged)) {
  const from = windows[s] || since || null;
  const window = from ? rows.filter(r => r.d >= from) : [rows.at(-1)];
  const w = window.length ? window : [rows.at(-1)];
  prices[s] = {
    price: rows.at(-1).c,
    high: Math.max(...w.map(r => r.h)),
    low: Math.min(...w.map(r => r.l)),
    from: w[0].d,
    asof: rows.at(-1).d
  };
}

const n = Object.keys(prices).length;
if (!n) {
  console.error('[ledger-prices] aucune barre exploitable — collecte en échec, on ne sweepe pas sur du vide.');
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(prices, null, 2));
console.log(`[ledger-prices] ${n} symbole(s) → ${out} (dernière barre ${Object.values(prices)[0].asof})`);
