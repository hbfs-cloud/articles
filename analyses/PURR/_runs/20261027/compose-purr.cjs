'use strict';
// Rédaction du dossier Hyperliquid Strategies (PURR) du 27 octobre 2026, clôture de référence du 26 octobre.
// Toute valeur de marché est recalculée depuis les barres certifiées (titre, comparables, HYPE en clôture UTC) ;
// les chiffres d'entreprise viennent des dépôts SEC ouverts et hachés (static-purr.cjs) et sont repris ci-dessous
// avec leur dépôt d'origine. Deuxième base, après relecture : le relevé hebdomadaire publié par la société sur son site,
// canal désigné par le 424B3 (« updated weekly with a one-week data delay »), haché dans _primary/ir/, non audité,
// toujours attribué et daté dans le texte publié.

// --- Dépôts SEC (index des documents de static-purr.cjs entre crochets) ------------------------------------------
const F = {
  HYPE_0630: 29275085, HYPE_FV_0630: 1904052e3, HYPE_COST_0630: 1363333e3, CASH_0630: 137917e3, TL_0630: 187137e3, DTL_0630: 183475e3, // [0]
  REV_FY: 9460e3, NI_FY: 305542e3, UNREAL_FY: 709875e3, OPEX_FY: 13951e3, COMMON_0630: 200550458, OPINC_FY: 500623e3, CONTRIB_LOSS: 169156e3, // [0]
  WARR_TOTAL: 28658614, WARR_TRANCHE: 9131600, WARR_625: 1237334, WARR_OTHER: 26480, WARR_SONNET: 1263814, ADV_WARR: 27394800, ADV_SH: 7761860, // [0]
  BB_SH_0630: 3067097, BB_USD_0630: 10.5e6, BB_SH_POST: 2.7e6, BB_USD_POST: 17.3e6, ISS_SH_POST: 10.7e6, ISS_USD_POST: 117.1e6, AF_HYPE: 46.7e6, // [0]
  UNLOCK_HYPE: 238e6, CIRC_HYPE: 235.0e6,                                                                                               // [0]
  HYPE_0908: 33.2e6, COMMON_0908: 237919288, PREF_CONV: 26587647, SOLD_0908: 112952100, RECV_0908: 1.1e9, LEFT_0908: 1.4e9, REG_NEW: 160e6, // [1]
  COMMON_0930: 278271288, EXCH_CAP: 42641847, MIN_PRICE: 12.02,                                                                         // [2], [5]
  BB_TOTAL: 100e6, BB_AVAIL: 72e6, BB_OLD: 30e6, BB_OLD_LEFT: 2e6,                                                                      // [3], [4]
  CHEF_TOTAL: 2.5e9, CHEF_INIT: 1.0e9, RAISED_FY: 647e6,                                                                                // [5], [7]
};
const IR_INPUTS = 'analyses/PURR/_primary/ir/dashboard-inputs.json', IR_HISTORY = 'analyses/PURR/_primary/ir/dashboard-history.json';
const grp = (n, d = 0) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };
// Relevé de la société : « Date of last update » = date de publication ; données hebdomadaires arrêtées sept jours plus tôt.
const irDataDate = upd => { const [m, d, y] = upd.split('/').map(Number); return new Date(Date.UTC(y, m - 1, d) - 7 * 864e5).toISOString().slice(0, 10); };

// Valeurs communes, calculées une seule fois et partagées par le corps du dossier.
function base(c) {
  const { pct, bars, N, close, prev, extra } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const cr = extra.crypto.results[0].data;
  const ser = sym => { const s = cr.find(x => x.symbol === sym); if (!s || s.served_completed_end !== c.REF) throw Error('série crypto non certifiée ' + sym); return s.bars; };
  const HY = ser('HYPE-USD'), BT = ser('BTC-USD'), ET = ser('ETH-USD');
  const px = (b, d) => { const x = b.find(y => y[0] === d); if (!x) throw Error('clôture crypto absente ' + d); return x[4]; };
  const hype = d => px(HY, d), hypeChg = d => { const i = HY.findIndex(x => x[0] === d); return pct(HY[i][4], HY[i - 1][4]); };
  let hyLow = Infinity, hyLowD = ''; for (const b of HY) if (b[3] < hyLow) { hyLow = b[3]; hyLowD = b[0]; }
  if (hyLowD !== '2026-10-24') throw Error('plus bas HYPE inattendu ' + hyLowD);
  const hyMinClose = Math.min(...HY.map(b => b[4])), hyMaxClose = Math.max(...HY.map(b => b[4]));
  const D0 = bars[N - 21][0]; if (D0 !== '2026-09-25') throw Error('fenêtre de vingt et une séances inattendue ' + D0);
  const hNow = hype(c.REF), h0925 = hype(D0), h0930 = hype('2026-09-30'), hWeekend = pct(hNow, hype('2026-10-23'));
  // Base 1, dépôt SEC (424B3, 8 septembre) : jetons ÷ (ordinaires + préférentielles converties).
  const hps = F.HYPE_0908 / (F.COMMON_0908 + F.PREF_CONV), hps0630 = F.HYPE_0630 / (F.COMMON_0630 + F.PREF_CONV);
  const valPs = hNow * hps, mult = close / valPs, val0925 = h0925 * hps, mult0925 = bar(D0)[4] / val0925, implied = close / hps;
  // Base 2, relevé hebdomadaire de la société (non audité) : dernière mise à jour du 22 octobre, données au 15 octobre.
  const IRI = c.K.read(IR_INPUTS).inputs, IRH = c.K.read(IR_HISTORY).snapshots.map(s => s.inputs);
  if (IRI.effectiveDate !== '10/22/2026') throw Error('relevé de la société inattendu ' + IRI.effectiveDate);
  const snap = upd => { const s = IRH.find(x => x.effectiveDate === upd); if (!s) throw Error('relevé absent ' + upd); return s; };
  const s0924 = snap('10/01/2026'), s0910 = snap('09/17/2026'), s1008 = snap('10/15/2026');
  const irD = irDataDate(IRI.effectiveDate), irHps = IRI.hypeHeld / IRI.basicShares, irVal = irHps * hNow, irMult = close / irVal, irImplied = close / irHps;
  const irHypeUsd = IRI.hypeHeld * 1e6 * hNow, irDtl = IRI.taxRate / 100 * (irHypeUsd - IRI.taxBasis * 1e6), irNav = (irHypeUsd + IRI.cash * 1e6 - irDtl) / (IRI.basicShares * 1e6), irNavMult = close / irNav;
  const ir0924Hps = s0924.hypeHeld / s0924.basicShares, irMult0925 = bar(D0)[4] / (ir0924Hps * h0925);
  const irHps0910 = s0910.hypeHeld / s0910.basicShares, irHpsGain = pct(irHps, irHps0910);
  const sepSh = (s1008.basicShares - s0910.basicShares) * 1e6, sepUsd = (s1008.cashFromFin - s0910.cashFromFin) * 1e6, sepPx = sepUsd / sepSh;
  const capLeft = F.LEFT_0908 - sepUsd, capShares = capLeft / (close * 0.985);
  const fv0630 = F.HYPE_FV_0630 / F.HYPE_0630, reval = pct(h0930, fv0630), since0930 = pct(hNow, h0930);
  const newSh = F.COMMON_0930 - F.COMMON_0908, newShPct = newSh / F.COMMON_0908 * 100, since0630 = F.COMMON_0930 - F.COMMON_0630;
  const mcap = close * F.COMMON_0930, mcapConv = close * (F.COMMON_0930 + F.PREF_CONV), bbPct = F.BB_AVAIL / mcap * 100, bbSh = F.BB_AVAIL / close;
  const fi = (((extra.quote || {}).data || { items: [] }).items || []).find(x => x.type === 'instrument_short_interest');
  if (!fi || !fi.shortInterest) throw Error('relevé FINRA absent');
  const siPct = fi.shortInterest / F.COMMON_0930 * 100, siFloat = fi.shortInterest / c.st.floatShares * 100, finraD = fi.date.slice(0, 10);
  const r21 = c.ret(21), r5 = c.ret(5), h21 = pct(hNow, h0925), b21 = pct(px(BT, c.REF), px(BT, D0)), e21 = pct(px(ET, c.REF), px(ET, D0));
  const win = bars.slice(Math.max(0, N - 251), N + 1); let hi = -1, hiD = ''; for (const b of win) if (b[2] > hi) { hi = b[2]; hiD = b[0]; }
  // Écarts depuis la cotation (décembre 2025) : pire ouverture, pire ouverture d'un lundi, pire plus bas de séance.
  const dow = d => new Date(d + 'T12:00:00Z').getUTCDay(); let wo = { g: 0 }, wm = { g: 0 }, wl = { g: 0 };
  for (let i = 1; i <= N; i++) { const g = bars[i][1] / bars[i - 1][4] - 1, l = bars[i][3] / bars[i - 1][4] - 1; if (g < wo.g) wo = { g, d: bars[i][0] }; if (dow(bars[i][0]) === 1 && g < wm.g) wm = { g, d: bars[i][0] }; if (l < wl.g) wl = { g: l, d: bars[i][0] }; }
  return { cmp, bar, chg, dr, HY, hype, hypeChg, hyLow, hyLowD, hyMinClose, hyMaxClose, D0, hNow, h0925, h0930, hWeekend, hps, hps0630, valPs, mult, val0925, mult0925, implied,
    IRI, irD, irHps, irVal, irMult, irImplied, irNav, irNavMult, irDtl, irMult0925, irHps0910, irHpsGain, sepSh, sepUsd, sepPx, capLeft, capShares,
    fv0630, reval, since0930, newSh, newShPct, since0630, mcap, mcapConv, bbPct, bbSh, fi, siPct, siFloat, finraD, r21, r5, h21, b21, e21, hi, hiD, wo, wm, wl, close0925: bar(D0)[4], prevClose: prev };
}

// Conférence de résultats : calendrier collecté (événement du titre), confirmée par le communiqué de la société du
// 23 octobre (titre relevé dans le flux d'actualités collecté). Une divergence bloque la construction.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'PURR');
  const items = (((c.extra || {}).news || {}).results || []).flatMap(r => (r.data || []).flatMap(d => d.data || []));
  const pr = items.find(n => /Webcast to Discuss Results for the Quarter Ended September 30, 2026/.test(n.title || ''));
  if (!ev || ev.report_date !== '2026-11-05' || !pr) throw Error('date de résultats non confirmée');
  return { date: ev.report_date, prUrl: pr.url, prDate: pr.publishedAt.slice(0, 10) };
}

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb } = c;
  const B = base(c), E = earningsDate(c);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig), stopTxt = usd(stop), abTxt = usd(abandon);
  const c26 = pct(close, prev), shareCeil = B.IRI.basicShares * 1.01;
  const rule = 'achat seulement si, au moment de l’ordre, PURR a clôturé à ' + trigTxt + ' ou plus après les résultats, si toutes les clôtures UTC du HYPE depuis sont à ' + usd(B.hyLow) + ' ou plus, et si le relevé hebdomadaire de la société ne compte pas plus de ' + fr(shareCeil, 1) + ' millions d’actions';
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'crypto', 'financials', 'speculative', 'trade-idea'], grade: 'C-', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'PURR se paie environ ' + fr(B.irMult, 2) + ' fois le HYPE qu’il détient par action (relevé de la société au ' + dfr(B.irD) + ', non audité ; ' + fr(B.mult, 2) + ' fois sur le dépôt du 8 septembre). Vote sur la dilution le 4 novembre, résultats le 5 : rien avant.',
      ogDescription: 'PURR à ' + usd(close) + ' : environ ' + fr(B.irMult, 2) + ' fois le HYPE détenu par action. Vote le 4 novembre, résultats le 5. Pas d’achat avant.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: c.archive.meta.status, to: 'watch', note: 'refonte du 27 octobre au gabarit du jour : titre à ' + fr(B.irMult, 2) + ' fois la valeur du HYPE par action (relevé de la société, non audité), plan de surveillance activable après les résultats du 5 novembre au-dessus de ' + usd(entry) + ', sous double condition titre et HYPE', close }] },
    header: { ticker: 'PURR', name: 'Hyperliquid Strategies Inc', exchange: 'NASDAQ', sector: 'Trésorerie d’actifs numériques (jeton HYPE)', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 6 NOVEMBRE', color: 'blue' }, { text: 'Achat : titre > ' + usd(entry) + ' et HYPE ≥ ' + usd(B.hyLow), color: 'amber' }, { text: 'Vote sur la dilution le 4 novembre', color: 'red' }],
      metrics: { marketCap: grp(B.mcap / 1e6, 0) + ' M$ (ordinaires)', volume: fr(bars[N][5] / 1e6, 2) + ' M', shortInterest: fr(B.siPct, 1) + ' % des actions (FINRA, ' + dfr(B.finraD) + ')' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 36, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C− (score additif de 36 sur 100) : la grille crédite un actif liquide sans dette et une autorisation de rachat, mais retranche la tendance, la capacité de dilution et un calendrier chargé (vote le 4 novembre, résultats le 5). Score éditorial non prédictif. HYPE détenus : dépôt SEC au 8 septembre et relevé hebdomadaire de la société au ' + dfr(B.irD) + ', non audité ; cours du titre et du jeton lus sur les clôtures du 26 octobre.',
    summary: 'Hyperliquid Strategies ne produit rien : la société émet des actions et achète du HYPE, le jeton de la bourse décentralisée Hyperliquid. Son relevé hebdomadaire, non audité, compte ' + fr(B.IRI.hypeHeld, 2) + ' millions d’unités au ' + dfr(B.irD) + ' pour ' + fr(B.IRI.basicShares, 2) + ' millions d’actions, soit ' + fr(B.irHps, 4) + ' HYPE par action. Au cours du HYPE du 26 octobre (' + usd(B.hNow) + '), cela fait ' + usd(B.irVal) + ' de jeton par action ; le titre a clôturé à ' + usd(close) + ', ' + fr(B.irMult, 2) + ' fois ce contenu (' + fr(B.mult, 2) + ' fois sur le dernier dépôt SEC, au 8 septembre), contre ' + fr(B.irMult0925, 2) + ' fois le 25 septembre. En un mois, le HYPE a perdu ' + fr(Math.abs(B.h21), 1) + ' % et l’action ' + fr(Math.abs(B.r21), 1) + ' % : la prime a disparu. Le 23 octobre, la société a relevé son autorisation de rachat à 100 M$, dont environ 72 M$ disponibles ; aucun rachat n’est encore prouvé. Le 4 novembre, un vote peut lever le plafond des ventes d’actions sous 12,02 $ ; les résultats suivent le 5. Rien à acheter avant ; ensuite, seulement au-dessus de ' + usd(entry) + ' avec un HYPE qui tient ' + usd(B.hyLow) + '.',
    whyBuy: [
      'Le titre se paie moins que le jeton qu’il détient : ' + fr(B.irMult, 2) + ' fois la valeur du HYPE par action le 26 octobre sur le relevé de la société (non audité), ' + fr(B.mult, 2) + ' fois sur le dépôt du 8 septembre, contre ' + fr(B.irMult0925, 2) + ' fois le 25 septembre. Le cours suppose un HYPE à ' + usd(B.irImplied) + ', il cote ' + usd(B.hNow) + '.',
      'Une autorisation de rachat de 100 M$ dont environ 72 M$ disponibles, ' + fr(B.bbPct, 1) + ' % de la capitalisation au cours du 26 octobre ; le 10-K prévoit de racheter quand le titre cote nettement sous l’actif et exclut toute vente d’actions pendant un rachat actif.',
      'Aucune dette financière au 30 juin, ' + fr(F.CASH_0630 / 1e6, 1) + ' M$ de trésorerie alors, ' + fr(B.IRI.cash, 1) + ' M$ au ' + dfr(B.irD) + ' selon la société, et des jetons mis en staking : ' + fr(F.REV_FY / 1e6, 2) + ' M$ de revenus sur l’exercice clos le 30 juin.',
      'Les ventes d’actions de septembre ont enrichi l’actionnaire : environ ' + fr(B.sepSh / 1e6, 1) + ' millions d’actions vendues autour de ' + usd(B.sepPx) + ', au-dessus de la valeur du jeton, et le HYPE par action a gagné ' + fr(B.irHpsGain, 1) + ' % (relevés de la société, non audités).',
      fr(B.siPct, 1) + ' % des actions étaient vendues à découvert au règlement FINRA du ' + dfr(B.finraD) + ' ; une reprise du HYPE pourrait pousser ces vendeurs à racheter, même si ' + fr(B.fi.daysToCover, 2) + ' jour de volume suffit à couvrir.'],
    whyAvoid: [
      'Un seul jeton, aucun amortisseur : depuis le 25 septembre, le HYPE a perdu ' + fr(Math.abs(B.h21), 1) + ' % et le titre ' + fr(Math.abs(B.r21), 1) + ' %. La variation moyenne d’une séance atteint ' + usd(tech.atr14) + ', ' + fr(tech.atr14 / close * 100, 0) + ' % du cours.',
      'La capacité de dilution reste énorme : le 424B3 du 23 septembre enregistre jusqu’à 160 millions d’actions nouvelles, ' + fr(F.REG_NEW / F.COMMON_0930 * 100, 1) + ' % des ' + nb(F.COMMON_0930) + ' actions au 30 septembre. Le risque n’est pas ce qui a été vendu, mais ce qui peut l’être sous 10 $.',
      'Le vote du 4 novembre lèverait le plafond des ventes à Chardan sous 12,02 $. À ' + usd(close) + ', sous la valeur du jeton détenu, chaque action vendue réduirait le HYPE par action ; la règle du 10-K l’exclut pendant un rachat actif, mais elle reste révisable.',
      'Le résultat du trimestre, publié le 5 novembre, portera la réévaluation du HYPE : ' + usd(B.fv0630) + ' au 30 juin, ' + usd(B.h0930) + ' à la clôture du 30 septembre (' + sgn(B.reval, 1) + '). Depuis, le jeton a cédé ' + fr(Math.abs(B.since0930), 1) + ' % : le chiffre sera périmé le jour de sa publication.',
      'Le verrou des titres du conseiller tombe au plus tard le 2 décembre : ' + nb(F.ADV_SH) + ' actions et ' + nb(F.ADV_WARR) + ' bons, dont ' + nb(F.WARR_TRANCHE) + ' à 9,375 $, juste au-dessus du cours. Ces bons diluent précisément si le titre remonte.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'warn', statusLabel: nb(bars.length) + ' séances depuis décembre 2025', evidence: 'Série quotidienne continue et certifiée au 26 octobre, sans séance manquante. La moyenne à deux cents séances reste à peine amorcée.', action: 'Niveaux et indicateurs calculés sur cette seule série ; moyenne longue non retenue.' },
      { label: 'Valeur du HYPE détenu', status: 'warn', statusLabel: 'Relevé de la société, non audité', evidence: fr(B.IRI.hypeHeld, 2) + ' millions de HYPE et ' + fr(B.IRI.basicShares, 2) + ' millions d’actions au ' + dfr(B.irD) + ' selon le site de la société ; le dernier dépôt SEC s’arrête au 8 septembre (33,2 millions). Les deux bases donnent ' + fr(B.irMult, 2) + ' et ' + fr(B.mult, 2) + ' fois.', action: 'Relire le relevé hebdomadaire avant tout ordre ; le 10-Q du trimestre clos le 30 septembre donnera le chiffre officiel.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Tendance baissière, vote et résultats à venir', evidence: 'Clôture à ' + usd(close) + ' sous les moyennes à vingt (' + usd(tech.ema20) + ') et cinquante séances (' + usd(tech.ema50) + '), RSI à ' + fr(tech.rsi14, 0) + ' ; vote le 4 novembre, résultats le 5.', action: 'Aucun achat avant la clôture du 6 novembre ; ensuite, ' + rule + '.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger PURR', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-11-04', to: '2026-11-06', label: 'Fenêtre clé · mer. 20 h (vote) → ven. 22 h (clôture)' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux et jetons', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Strategy, Coinbase', detail: 'multiple des trésoreries', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-04', category: 'market', impact: 'strong', label: 'Vote des actionnaires', detail: '20 h (19 h selon une mention), dilution', icon: 'vote', source: 'circulaire définitive DEF 14A du 2 octobre 2026 : 14 h à New York dans l’avis de convocation, 13 h dans la rubrique de questions', href: '#capital' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Conférence résultats', detail: '23 h 15, trimestre au 30 sept.', icon: 'company', source: 'communiqué de la société du 23 octobre 2026 (conférence à 17 h 15, heure de New York) et calendrier de résultats collecté', href: '#earnings' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: '14 h 30, taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: '14 h 30, taux et jetons', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si le vote passe et que la société vend', steps: [{ label: 'Vote approuvé', icon: 'vote' }, { label: 'Ventes sous l’actif', category: 'market', icon: 'alert', tone: 'down' }, { label: 'HYPE par action', category: 'earnings', icon: 'coin', tone: 'down' }] },
      { title: 'Si la société rachète', steps: [{ label: 'Rachats d’actions', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Décote', category: 'market', icon: 'coin', tone: 'down' }, { label: 'PURR', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Rien avant la clôture du 6 novembre ; sous ' + abTxt + ', plan abandonné. Hors frise : verrou du conseiller levé le 2 décembre au plus tard, sortie le 1er. Heures de Paris.',
  };
  return save(Object.assign(out, require('./compose-purr-body.cjs')(c, { B, E, F, grp, trig, trigTxt, stopTxt, abTxt, c26, rule, shareCeil })));
};

module.exports.F = F;
module.exports.base = base;
module.exports.IR_INPUTS = IR_INPUTS;
module.exports.IR_HISTORY = IR_HISTORY;

module.exports.scenarios = c => {
  const B = base(c), u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'Le HYPE repasse au-dessus de ses niveaux de début octobre et la société montre, le 5 novembre, qu’elle rachète au lieu de vendre.', firstOrder: 'Le titre clôture au-dessus de ' + u(c.entry) + ', sommet de la base de deux semaines, puis vise ' + u(c.tp1) + ' et ' + u(c.tp2) + '.', secondOrder: 'La décote sur le jeton détenu se referme, puis une prime réapparaît ; les vendeurs à découvert, ' + c.fr(B.siPct, 1) + ' % des actions, rachètent.', confirmation: 'Une clôture au-dessus de ' + u(c.entry) + ' après les résultats, avec Hyperion DeFi et le HYPE en hausse le même jour.', contradiction: 'Un rebond du titre sans le HYPE : il ne tiendrait que le temps des rachats.' },
    { scenario: 'mixed', trigger: 'Le vote passe, la société ne vend pas sous l’actif et le HYPE oscille autour de son plus bas d’octobre.', firstOrder: 'Le titre reste entre ' + u(c.abandon) + ' et ' + u(c.entry) + ', la base des deux dernières semaines.', secondOrder: 'Les trésoreries en ether et en solana gardent leur propre décote, sans entraîner PURR.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances après le 5 novembre.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Le HYPE clôture en UTC sous ' + u(B.hyLow) + ', plus bas de séance du ' + c.dfr(B.hyLowD) + ', ou le relevé de la société montre de nouvelles actions vendues sous la valeur du jeton.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plus bas du 22 octobre : le prochain repère est le plus bas du 19 août, ' + u(c.lv('s2')) + '.', secondOrder: 'Les trésoreries cotées reculent ensemble et la défiance envers le modèle s’étend à Hyperion DeFi, l’autre détenteur de HYPE.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' avec une clôture UTC du HYPE sous ' + u(B.hyLow) + '.', contradiction: 'Un nouveau plus bas en séance effacé à la clôture, avec le HYPE stable.' }];
};

module.exports.contradictions = c => {
  const B = base(c), fr = c.fr, sgn = c.sgn;
  return [
    'Le titre a baissé presque deux fois plus que son actif : ' + sgn(B.r21, 1) + ' en vingt et une séances, contre ' + sgn(B.h21, 1) + ' pour le HYPE, ' + sgn(B.e21, 1) + ' pour l’ether et ' + sgn(B.b21, 1) + ' pour le bitcoin. La différence est le prix que le marché met désormais sur le modèle de trésorerie, pas sur le jeton.',
    'Lundi 26 octobre, première séance après l’annonce du rachat, PURR a gagné ' + fr(B.chg(c.REF), 1) + ' %, Hyperion DeFi ' + fr(B.dr('HYPD', c.REF), 1) + ' % et le HYPE ' + fr(B.hWeekend, 1) + ' % de la clôture UTC de vendredi à celle de lundi : environ ' + fr(B.chg(c.REF) - B.dr('HYPD', c.REF), 1) + ' point d’écart attribuable au rachat, sur une seule séance. Les trésoreries en ether ont baissé avec leur jeton.',
    'Le 10-K exclut toute vente d’actions pendant un rachat actif, et le rachat court jusqu’au 31 octobre 2027 ; la société demande pourtant le 4 novembre le droit de vendre sous 12,02 $. En juillet et août, elle a racheté 2,7 millions d’actions pour 17,3 M$, puis en a émis 10,7 millions pour 117,1 M$ : la règle se lit « pas en même temps ».',
    'Le résultat net du trimestre au 30 septembre devrait être fortement positif grâce à la réévaluation du HYPE (' + sgn(B.reval, 1) + ' sur le trimestre), alors que le jeton a perdu ' + fr(Math.abs(B.since0930), 1) + ' % depuis : un bon chiffre, une mauvaise nouvelle déjà en cours.'];
};

module.exports.missingData = c => {
  const B = base(c);
  return [
    'HYPE détenus après le 8 septembre connus seulement par le relevé hebdomadaire du site de la société, non audité ; le 10-Q du trimestre clos le 30 septembre donnera le chiffre officiel.',
    'Le relevé de la société compte ' + c.fr(B.IRI.basicShares, 2) + ' millions d’actions préférentielles converties comprises au ' + c.dfr(B.irD) + ', contre ' + c.fr((F.COMMON_0930 + F.PREF_CONV) / 1e6, 2) + ' millions selon la circulaire au 30 septembre : écart de ' + c.fr((F.COMMON_0930 + F.PREF_CONV) / 1e6 - B.IRI.basicShares, 1) + ' millions, à rapprocher dans le 10-Q ; chaque base est utilisée avec son propre décompte de HYPE.',
    'Prix moyen des ventes de septembre et capacité restante de la facilité estimés sur les relevés de la société, pas sur un dépôt.',
    'Statistiques des pairs (cours sur valeur comptable) relevées en instantané, sur des bilans de dates différentes, sans historique daté.',
    'Clôtures du HYPE certifiées seulement depuis le 24 septembre : aucune corrélation quotidienne longue entre le titre et le jeton n’est calculée.',
    'Chaîne d’options et coût d’emprunt non retenus : sources facultatives, non certifiées.'];
};
