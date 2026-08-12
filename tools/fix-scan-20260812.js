#!/usr/bin/env node
'use strict';
/**
 * Corrections de fond du scan 20260812, après le BLOCK du panel.
 * Traite les points 1 à 4 de .claude/REPRISE.md — ceux qui touchent les chiffres,
 * pas la prose.
 */
const fs = require('fs');
const SIG = 'scanner/20260812/signals.json';
const SEL = 'scanner/20260812/_selection.json';

// Taux relevés le 2026-08-12 07:46 UTC. adv_m et market_cap arrivent en DEVISE
// DE COTATION : les comparer bruts revenait à opposer 37 zlotys à 23 euros et à
// 290 dollars comme si c'était la même unité. C'est ce qui a fait passer PGE.WA
// pour confortable alors qu'elle est la ligne la plus mince du panier.
const USD = { USD: 1, EUR: 1.1542013, PLN: 1 / 3.72877, GBP: 1.3506578, CHF: 1 / 0.81156 };
const DEVISE = { 'AMP.MI': 'EUR', 'CPR.MI': 'EUR', 'NEXI.MI': 'EUR', 'ISP.MI': 'EUR',
  'GRF.MC': 'EUR', 'SAB.MC': 'EUR', 'UNI.MC': 'EUR', 'PGE.WA': 'PLN', 'BCP.LS': 'EUR' };
const dev = t => DEVISE[t] || 'USD';
const enUSD = (v, t) => (v == null ? null : v * USD[dev(t)]);

// Le contrôle anti-dilution s'appuie sur les dépôts SEC. Hors de ce périmètre il
// n'a pas d'objet : déclarer « propre » revient à mettre un drapeau vert sur zéro
// observation — la leçon INDO prise à l'envers.
const HORS_SEC = new Set(['AMP.MI', 'PGE.WA', 'INFY', 'SCHD', 'FXI', 'CPR.MI']);
const MENTION_HORS_SEC = 'Aucun registre de placement américain à interroger pour cette cotation : le contrôle de structure du capital est sans objet ici, ni vert ni rouge.';

const sig = JSON.parse(fs.readFileSync(SIG, 'utf8'));
const sel = JSON.parse(fs.readFileSync(SEL, 'utf8'));
const rapport = [];

// ── 1. PGE.WA sort : 37 M PLN = 9,92 M$, sous le plancher de 10 M$ ──────────
const pge = sig.signals.find(s => s.ticker === 'PGE.WA');
if (pge) {
  const advUsd = enUSD(pge.adv_m, 'PGE.WA');
  rapport.push(`PGE.WA RETIRÉE — volume moyen ${pge.adv_m} M PLN = ${advUsd.toFixed(2)} M$, sous le plancher de 10 M$.`);
  sig.signals = sig.signals.filter(s => s.ticker !== 'PGE.WA');
  sel.selection = sel.selection.filter(s => s.ticker !== 'PGE.WA');
}

// ── 2. Remplacement : CPR.MI ────────────────────────────────────────────────
// Choisie sur trois critères vérifiables plutôt que sur le score : date de
// résultats CONFIRMÉE au 28/10 (les autres européennes disponibles rendent une
// date vide, et vide n'est pas propre), 39 M€ = 45 M$ de volume soit quatre fois
// le plancher, et un secteur neuf dans le panier. Elle reste une reprise du 11,
// ce qui ramène le compte à trois — le plafond, pas au-delà.
if (!sig.signals.some(s => s.ticker === 'CPR.MI')) {
  const atr = 0.1443;                                   // ATR14 relevé le 11/08
  const entry_low = 6.00, entry = 6.04, mid = (entry_low + entry) / 2;
  const stop = +(mid - 1.6 * atr).toFixed(2);
  const s = {
    ticker: 'CPR.MI', name: 'Davide Campari-Milano', score: 78, strategy: 'Momentum',
    price: 6.00, entry, entry_low, stop, tp1: +(entry + 1.5 * atr).toFixed(2),
    tp2: +(entry + 2.6 * atr).toFixed(2), rr: '1:1.02', horizon: 10, region: 'EU',
    sector: 'Staples', sharia: false,
    sharia_reason: 'producteur de spiritueux — activité exclue',
    earnings_source: 'calendrier par valeur', earnings_clear: true,
    next_earnings: '2026-10-28', dilution_clear: null,
    dilution_note: MENTION_HORS_SEC,
    extension: { rsi: 61.0, atr, distance_50dma_pct: 5.1 },
    tp1_atr_multiple: 1.5, stop_atr_multiple: 1.6,
    stop_pct: +(((mid - stop) / mid) * 100).toFixed(2),
    market_cap_usd: Math.round(7.2e9 * USD.EUR), adv_m: 39, adv_m_usd: +(39 * USD.EUR).toFixed(1),
    thesis: 'À COMPLÉTER',
  };
  sig.signals.push(s);
  sel.selection.push({ ticker: 'CPR.MI', score: 78, region: 'EU', sector: 'Staples',
    entry_low, entry, stop, tp1: s.tp1, tp2: s.tp2, rr: 1.02, sharia: false, reprise: true });
  rapport.push(`CPR.MI AJOUTÉE — 39 M€ = ${(39 * USD.EUR).toFixed(1)} M$, résultats confirmés au 28/10, secteur neuf. Thèse à écrire.`);
}

// ── 3. Volumes et capitalisations en dollars, pour que tout classement ait un sens
for (const s of sig.signals) {
  if (s.adv_m != null) { s.adv_m_local = s.adv_m; s.adv_m_currency = dev(s.ticker); s.adv_m_usd = +enUSD(s.adv_m, s.ticker).toFixed(1); }
  if (s.market_cap_usd != null && dev(s.ticker) !== 'USD') {
    const local = s.market_cap_usd;
    s.market_cap_local = local; s.market_cap_currency = dev(s.ticker);
    s.market_cap_usd = Math.round(enUSD(local, s.ticker));
    rapport.push(`${s.ticker} capitalisation : ${(local / 1e9).toFixed(1)} Md ${dev(s.ticker)} = ${(s.market_cap_usd / 1e9).toFixed(1)} Md$.`);
  }
}

// ── 4. Plafond de perte calé sur le HAUT de zone ────────────────────────────
// La zone haute est publiée, donc atteignable : un plafond qui ne tient qu'au
// milieu de zone cède précisément dans le cas où le lecteur est le plus exposé.
for (const s of sig.signals) {
  const hz = ((s.entry - s.stop) / s.entry) * 100;
  if (hz > 8) {
    const nouveau = +(s.entry * 0.92).toFixed(2);
    rapport.push(`${s.ticker} stop ${s.stop} → ${nouveau} : ${hz.toFixed(2)} % de perte depuis le haut de zone dépassait le plafond de 8 %.`);
    s.stop = nouveau;
    const mid = (s.entry_low + s.entry) / 2;
    s.stop_pct = +(((mid - s.stop) / mid) * 100).toFixed(2);
    s.stop_atr_multiple = +((mid - s.stop) / s.extension.atr).toFixed(2);
    s.rr = '1:' + (((s.tp1 - mid) / (mid - s.stop))).toFixed(2);
  }
}

// ── 5. dilution_clear hors périmètre SEC : null, pas true ───────────────────
for (const s of sig.signals) {
  if (HORS_SEC.has(s.ticker) && s.dilution_clear === true) {
    s.dilution_clear = null; s.dilution_note = MENTION_HORS_SEC;
    rapport.push(`${s.ticker} dilution_clear : true → null (hors périmètre SEC, zéro observation).`);
  }
}

// ── 6. Scores alignés sur la sélection figée ────────────────────────────────
for (const s of sig.signals) {
  const r = sel.selection.find(x => x.ticker === s.ticker);
  if (r && r.score !== s.score) { rapport.push(`${s.ticker} score ${s.score} → ${r.score} (alignement sur la sélection).`); s.score = r.score; }
}

sig.signals.sort((a, b) => b.score - a.score);
sel.gates_passes.devises = 'adv_m et capitalisation convertis en dollars au taux du 12/08 07:46 UTC (EURUSD 1,1542 · USDPLN 3,7288). PGE.WA retirée sur le plancher de liquidité, CPR.MI ajoutée.';
sel.gates_passes.dilution = 'Par ticker sur formulaires dilutifs pour les cotations américaines. CLF porte deux 424B5 d octobre 2025, hors fenêtre 90 j, à signaler. Hors périmètre SEC : dilution_clear = null, jamais true.';
sel.gates_passes.stop_cap = 'Plafond de 8 % calé sur le HAUT de zone, pas sur le milieu.';

fs.writeFileSync(SIG, JSON.stringify(sig, null, 2) + '\n');
fs.writeFileSync(SEL, JSON.stringify(sel, null, 2) + '\n');

console.log('CORRECTIONS APPLIQUÉES\n');
for (const r of rapport) console.log('  · ' + r);
console.log(`\n${sig.signals.length} lignes · régions ` +
  Object.entries(sig.signals.reduce((a, s) => (a[s.region] = (a[s.region] || 0) + 1, a), {})).map(([k, v]) => k + '=' + v).join(' '));
const worst = sig.signals.map(s => ({ t: s.ticker, hz: ((s.entry - s.stop) / s.entry) * 100 })).sort((a, b) => b.hz - a.hz)[0];
console.log(`perte maximale depuis le haut de zone : ${worst.t} ${worst.hz.toFixed(2)} %`);
console.log(`volume le plus mince : ` + sig.signals.map(s => ({ t: s.ticker, v: s.adv_m_usd })).sort((a, b) => a.v - b.v).slice(0, 2).map(x => x.t + ' ' + x.v + ' M$').join(' · '));
