'use strict';
// Prix au format français avec séparateur de milliers (« 1 133,40 $ »).
const usdG = (n, d = 2) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '') + ' $'; };
const frG = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : ''); };
// Rédaction du dossier Lumentum (LITE) du 2 novembre 2026. Clôture certifiée de référence : 30 octobre. Les cotations de la
// séance du 2 novembre (relevé horodaté, non certifié) servent à la section « Séance du 2 novembre en cours » et aux
// comparaisons d'options ; aucun niveau n'en dérive. Chiffres d'entreprise et termes de l'accord : dépôts SEC ouverts.
const S = require('./static-lite.cjs');

const RATIO = 4.5, FEE_REG = 3.2e9, DIL_SHARES = 101.7e6; // parité (doc 8), indemnité réglementaire (doc 8), actions diluées du T1 (doc 11)
const TARGET = '2028-06-30', NOW = '2026-11-02', LOWER = '2027-11-02'; // fin du S1 2028 (doc 10) ; bas de « 12-18 mois » (doc 12)
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const SCN = [-30, -15, 0, 15, 30];

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); return pct(bars[i][1], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const cl = (sym, d) => { const b = row(sym).find(x => x[0] === d); if (!b) throw Error('barre absente ' + sym + ' ' + d); return b[4]; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d0, d1) => pct(cl(sym, d1), cl(sym, d0));
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, hiD, hiC = -1, hiCD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[4] > hiC) { hiC = b[4]; hiCD = b[0]; } }
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  return { cmp, bar, chg, gapOf, row, cl, dr, since, hi, hiD, hiC, hiCD, med, avgVol, fromHiC: Math.abs(pct(close, hiC)) };
}

// Relevé de séance (non certifié) : cours temps réel et instantané de cotation, tels que servis.
function live(c) {
  const L = c.extra.live; const res = L.results;
  const rt = res.find(r => r.data_type === 'realtime_quote').data, qt = res.find(r => r.data_type === 'quote').data;
  const q = s => { const r = rt.find(x => x.symbol === s), k = qt.find(x => x.symbol === s); if (!r || !k) throw Error('cote absente ' + s); return { price: r.price, chg: r.change_percent, ts: r.timestamp, open: k.open, high: k.high, low: k.low, vol: r.day_volume, divYield: k.dividendYield }; };
  const ts = rt.find(x => x.symbol === 'LITE').timestamp; // horodatage du relevé de Lumentum
  const hh = ts.slice(11, 13), mm = ts.slice(14, 16), hP = String((+hh + 1) % 24).padStart(2, '0'); // Paris = UTC+1 le 2 novembre (heure d'hiver)
  return { q, ts, utc: hh + ' h ' + mm + ' UTC', paris: hP + ' h ' + mm + ' à Paris', capturedAt: L.captured_at };
}

// Arithmétique de l'offre : valeur = 4,5 × Marvell ; écart ; annualisation ; scénarios ; rupture.
function deal(c) {
  const B = base(c), V = live(c), { close } = c;
  const L28 = B.bar('2026-10-28')[4], M28 = B.cl('MRVL', '2026-10-28'), L30 = close, M30 = B.cl('MRVL', c.REF);
  const PL = V.q('LITE').price, PM = V.q('MRVL').price;
  const D = pm => RATIO * pm;
  const sp = (pl, pm) => D(pm) / pl - 1;
  const nT = days(NOW, TARGET), nL = days(NOW, LOWER);
  const ann = (s, n) => Math.pow(1 + s, 365 / n) - 1;
  const peers = ['COHR', 'AAOI'];
  const r30 = peers.map(s => B.since(s, '2026-10-28', c.REF) / 100), rLv = peers.map(s => V.q(s).price / B.cl(s, '2026-10-28') - 1);
  const m30 = B.med(r30), mLv = B.med(rLv);
  const brk30 = L28 * (1 + m30), brkLv = L28 * (1 + mLv), fee = FEE_REG / DIL_SHARES;
  const sess = { pl: PL, pm: PM, d: D(PM), s: sp(PL, PM), brk: brkLv, med: mLv, peerR: rLv };
  const cert = { pl: L30, pm: M30, d: D(M30), s: sp(L30, M30), brk: brk30, med: m30, peerR: r30 };
  for (const b of [sess, cert]) { b.annT = ann(b.s, nT); b.annL = ann(b.s, nL);
    b.keep = SCN.map(x => ({ x, v: RATIO * b.pm * (1 + x / 100), r: RATIO * b.pm * (1 + x / 100) / b.pl - 1 }));
    b.sw = SCN.map(x => ({ x, v: b.pl * (1 + x / 100), r: x / 100 }));
    b.brkR = b.brk / b.pl - 1; b.brkFeeR = (b.brk + fee) / b.pl - 1; }
  const prem = D(M28) / L28 - 1;
  // Plancher de valeur à 8 × le chiffre d'affaires des douze derniers mois (même base que les multiples des pairs), bilan du
  // 26 septembre (dette 1 360,3 + 39,3 M$, trésorerie et placements 1 272,2 + 707,4 M$, doc 11), actions de la circulaire.
  const revTTM = c.G$.rev + (1262.6 - 533.8) * 1e6; // douze mois au 26 septembre = exercice 2026 (10-K) + T1 2027 − T1 2026 (doc 11)
  const fTTM = (8.0 * revTTM - (1360.3 + 39.3) * 1e6 + (1272.2 + 707.4) * 1e6) / c.shares;
  return { fTTM, revTTM, B, V, L28, M28, L30, M30, PL, PM, sess, cert, fee, nT, nL, prem, D28: D(M28), peers };
}

module.exports = (c, save) => {
  const usd = usdG;
  const { fr, pct, sgn, close, prev, bars, N, tech, st, M, G$, marketCap, ev, raw, dfr, nb, peerStat, shares } = c;
  const X = deal(c), { B, V, sess: Se, cert: Ce } = X;
  const P = n => sgn(n * 100, 1);
  const c30 = pct(close, prev), c29 = B.chg('2026-10-29'), c28 = B.chg('2026-10-28');
  const m29 = B.dr('MRVL', '2026-10-29'), m30 = B.dr('MRVL', c.REF);
  const lq = V.q('LITE'), mq = V.q('MRVL');
  const evRev = ev / G$.rev;
  const lab = x => x === 0 ? 'Marvell inchangée' : 'Marvell ' + sgn(x, 0);
  const keepTxt = b => b.keep.map(k => lab(k.x) + ' : ' + usd(k.v) + ' (' + P(k.r) + ')').join(' ; ');
  const swTxt = b => b.sw.map(k => lab(k.x) + ' : ' + usd(k.v)).join(' ; ');
  const statusNote = 'Aucun ordre. Le plan du 27 octobre (achat après les résultats sur une clôture au-dessus de 840,47 $, soit 840,48 $ ou plus) est archivé : ses repères historiques ne sont plus exécutables, et le signal du 28 octobre était invalide (clôture antérieure aux résultats). Depuis l’accord du 1er novembre, Lumentum se négocie comme 4,5 actions Marvell moins un rabais ; il n’y a plus de plan d’achat directionnel. Les niveaux et les chiffres de séance seront recalculés sur la clôture certifiée du 2 novembre.';
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'semis', 'ai', 'earnings'], grade: 'C', date: '2026-11-02', dateDisplay: '2 novembre 2026', version: 3, status: 'no-trade', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Marvell rachète Lumentum contre 4,5 actions Marvell par action, clôture visée au premier semestre 2028. Garder Lumentum, c’est porter Marvell jusque-là avec un rabais pour risque de rupture. Aucun ordre ; trois options chiffrées.',
      ogDescription: 'Lumentum vendue à Marvell (4,5 actions MRVL par action). Garder, vendre ou passer en Marvell : les trois options chiffrées.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'watch', to: 'no-trade', note: 'refonte du 2 novembre sur la clôture certifiée du 30 octobre : accord de fusion avec Marvell signé le 1er novembre ; plus de plan d’achat directionnel ; repères du 27 octobre archivés, non exécutables', close }] },
    header: { ticker: 'LITE', name: 'Lumentum Holdings Inc.', exchange: 'NASDAQ', sector: 'Lasers et modules optiques pour les centres de données de l’IA', price: close, changePct: c30,
      badges: [{ text: 'RACHAT PAR MARVELL — 4,5 ACTIONS MRVL', color: 'red' }, { text: 'Aucun ordre', color: 'blue' }, { text: 'Clôture certifiée du 30 octobre', color: 'amber' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 44, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 44 sur 100) : la société publie un trimestre record, mais le titre n’est plus qu’une promesse de 4,5 actions Marvell livrable vers le premier semestre 2028. Chiffres d’entreprise et termes de l’accord lus dans les dépôts SEC ; niveaux sur la clôture certifiée du 30 octobre ; cours du 2 novembre relevés en séance, non certifiés.',
    summary: 'Voulez-vous porter Marvell jusqu’en 2028 ? C’est la seule question. Le 1er novembre, Lumentum a signé sa vente à Marvell : 4,5 actions Marvell par action, sans numéraire, clôture visée au premier semestre 2028 après deux votes et des autorisations dont la liste n’est pas publiée. Annoncée à 1 132 $ sur les cours du 28 octobre, l’offre ne vaut plus que ' + usd(Se.d) + ' à ' + V.utc + ' (' + V.paris + '), Marvell étant tombée à ' + usd(Se.pm) + '. Lumentum cote ' + usd(Se.pl) + ' (' + sgn(lq.chg, 1) + ' en séance, cours non certifié) : l’offre vaut ' + fr(Se.s * 100, 1) + ' % de plus que le cours, soit ' + fr(Se.annT * 100, 1) + ' % par an jusqu’au 30 juin 2028. Ce rabais n’est pas un gain : il paie le risque de rupture et vingt mois d’attente, et sans vente à découvert, que nous ne pratiquons pas, garder Lumentum revient à garder 4,5 Marvell un peu moins chères. Le trimestre publié le même matin est pourtant record : 1 262,6 M$ de chiffre d’affaires, +136,5 % sur un an. Aucun ordre ; choisissez entre garder, vendre ou passer sur Marvell.',
    whyBuy: [
      'Garder plutôt que passer sur Marvell : si l’opération se conclut, chaque action Lumentum à ' + usd(Se.pl) + ' devient 4,5 actions Marvell valant ' + usd(Se.d) + ' au cours de séance, ' + fr(Se.s * 100, 1) + ' % de plus que la même somme placée directement en Marvell, à cours de Marvell égal.',
      'Une protection partielle en cas de blocage : Marvell paie 3,2 Md$ à Lumentum si l’échec tient aux autorisations réglementaires, environ ' + usd(X.fee) + ' par action diluée, et 5,8 Md$ si son conseil se dédit ou signe une offre supérieure portant sur Marvell elle-même.',
      'Une société qui accélère seule : 1 262,6 M$ de chiffre d’affaires au premier trimestre (+136,5 % sur un an), 42,3 % de marge opérationnelle ajustée, prévision de 1,575 à 1,625 Md$ pour le deuxième trimestre et un deuxième grand contrat d’optique co-intégrée adossé à plus de 5 Md$ d’engagements d’achat.',
      'Un échange en actions prévu sans impôt aux États-Unis (réorganisation visée par la section 368(a) du code fiscal américain) ; pour un résident français, c’est à vérifier avec son conseil, l’accord ne le dit pas.'],
    whyAvoid: [
      'Le titre suit désormais Marvell : la valeur de l’offre est passée de 1 132 $ le 28 octobre à ' + usd(Se.d) + ' en séance le 2 novembre, Marvell ayant perdu ' + fr(Math.abs(pct(Se.pm, X.M28)), 1) + ' % entre-temps.',
      'Vingt mois d’attente au moins : clôture visée au premier semestre 2028, date butoir du 1er novembre 2027 prorogeable jusqu’au 1er août 2028, autorisations requises listées dans une annexe non publiée.',
      'Marvell n’est pas tenue d’accepter un remède réglementaire lourd (cession, licence, engagement de comportement) : un refus d’une autorité peut suffire à rompre.',
      'En cas de rupture, Lumentum reviendrait vers la valeur de ses pairs optiques : en appliquant au cours du 28 octobre la baisse médiane de Coherent et d’Applied Optoelectronics depuis, environ ' + usd(Ce.brk) + ' sur la clôture certifiée du 30 octobre (' + P(Ce.brkR) + ') ; payé huit fois ses revenus des douze mois à fin septembre comme ses pairs, bien moins (voir le plancher).'],
    controlChecklist: [
      { label: 'Clôture de référence', status: 'warn', statusLabel: 'Clôture certifiée du 30 octobre', evidence: 'Barres certifiées jusqu’au 30 octobre ; la séance du 2 novembre n’était pas close à la publication. Cours de séance relevés à ' + V.utc + ', non certifiés.', action: 'Aucun niveau n’est calculé sur un cours de séance ; recalcul sur la clôture certifiée du 2 novembre.' },
      { label: 'Accord de fusion', status: 'pass', statusLabel: 'Signé, publié, termes lus', evidence: '8-K du 2 novembre : 4,500 actions Marvell par action Lumentum, votes, délai HSR, date butoir du 1er novembre 2027, indemnités de 5,8 Md$, 2,9 Md$ et 3,2 Md$.', action: 'Raisonner en Marvell : la valeur de Lumentum suit 4,5 fois son cours tant que l’accord tient.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Aucun achat directionnel', evidence: 'En séance, l’offre vaut ' + fr(Se.s * 100, 1) + ' % de plus que le cours ; pas de couverture possible sans vente à découvert de Marvell, exclue ici.', action: 'Choisir entre garder, vendre ou passer sur Marvell ; ne pas acheter Lumentum pour l’écart.' }] };
  out.liveSession = {
    title: 'Séance du 2 novembre en cours', capturedAt: V.ts,
    capturedAtDisplay: 'Relevé du 2 novembre 2026 à ' + V.utc + ' (' + V.paris + '), New York ferme à 22 h à Paris.',
    status: 'Cours de séance, non certifiés : ils ne fixent aucun niveau ; la fiche sera recalculée sur la clôture certifiée du 2 novembre.',
    rows: ['LITE', 'MRVL', 'COHR', 'AAOI', 'SMH'].map(s => { const k = V.q(s); return { ticker: s, label: { LITE: 'Lumentum', MRVL: 'Marvell, l’acquéreur', COHR: 'Coherent, pair optique', AAOI: 'Applied Optoelectronics', SMH: 'Panier semi-conducteurs' }[s], price: usd(k.price), change: sgn(k.chg, 1), time: k.ts.slice(11, 16) + ' UTC' }; }),
    points: [
      'Voulez-vous porter Marvell jusqu’en 2028 ? Garder Lumentum revient à détenir 4,5 actions Marvell livrables vers le premier semestre 2028, avec un rabais pour le risque de rupture. Sans vente à découvert de Marvell, exclue pour un lecteur qui ne fait qu’acheter, l’écart n’est pas un gain, c’est une compensation de risque.',
      'Valeur de l’offre en séance : 4,5 × ' + usd(Se.pm) + ' = ' + usd(Se.d) + ' pour un cours de ' + usd(Se.pl) + ', l’offre vaut ' + fr(Se.s * 100, 1) + ' % de plus que le cours (le cours est ' + fr((1 - 1 / (1 + Se.s)) * 100, 1) + ' % sous l’offre), soit ' + fr(Se.annT * 100, 1) + ' % par an jusqu’au 30 juin 2028 (' + X.nT + ' jours) et ' + fr(Se.annL * 100, 1) + ' % par an si la clôture tombe dans douze mois. Sur la clôture certifiée du 30 octobre, avant l’annonce : 4,5 × ' + usd(Ce.pm) + ' = ' + usd(Ce.d) + ' pour ' + usd(Ce.pl) + ', écart de ' + fr(Ce.s * 100, 1) + ' %.',
      'Option 1, garder Lumentum, si l’opération se conclut, valeur par action selon Marvell à l’échéance (base séance) : ' + keepTxt(Se) + '. Même calcul sur la clôture du 30 octobre : ' + keepTxt(Ce) + '.',
      'Option 2, vendre maintenant : ' + usd(Se.pl) + ' en séance, ' + fr(Math.abs(pct(Se.pl, X.L30)), 1) + ' % sous la clôture du 30 octobre ; plus aucune exposition, ni à l’offre ni à une rupture.',
      'Option 3, remplacer tout de suite par Marvell (le produit de la vente, ' + usd(Se.pl) + ', rachète ' + fr(Se.pl / Se.pm, 2) + ' actions Marvell au lieu de 4,5) : à l’échéance, ' + swTxt(Se) + ' ; même rendement que Marvell, sans risque de rupture propre à Lumentum. Si l’accord se conclut, garder Lumentum fait mieux de ' + fr(Se.s * 100, 1) + ' % dans tous les scénarios ; Marvell verse un petit dividende (rendement d’environ 0,1 %), Lumentum aucun.',
      'En cas de rupture, repère de valeur sans l’offre, sur la clôture certifiée du 30 octobre : cours non affecté du 28 octobre (' + usd(X.L28) + ') × (1 + baisse médiane de Coherent et d’Applied Optoelectronics depuis, ' + P(Ce.med) + ') = ' + usd(Ce.brk) + ', soit ' + P(Ce.brkR) + ' pour qui a gardé depuis le 30 octobre ; avec l’indemnité réglementaire de 3,2 Md$, environ ' + usd(X.fee) + ' de plus par action diluée versés à la société, ' + P(Ce.brkFeeR) + '. Cette indemnité n’est due que si l’échec tient aux autorités et que les deux votes sont acquis ; un non des actionnaires de Marvell, sans changement de recommandation de son conseil, n’en déclenche en principe aucune. En séance, le même repère (' + usd(Se.brk) + ') dépasse le cours (' + usd(Se.pl) + ') : signe de sa fragilité, pas d’un gain en cas de rupture.',
      'Pour qui vend ou passe sur Marvell : rien ne presse ce soir ; ordres à cours limité, les deux opérations dans la même séance, en évitant la première demi-heure (15 h 30 à 16 h à Paris). Sur un compte-titres, vendre réalise la plus-value en 2026 ; garder jusqu’à l’échange peut permettre de la différer, à vérifier avec un conseil.',
      'Ce que le 2 novembre change : les résultats du premier trimestre sont sortis avant l’ouverture, pas le 5 novembre ; le plan d’achat du 27 octobre est archivé ; Lumentum a ouvert à ' + usd(lq.open) + ' puis glissé jusqu’à ' + usd(lq.low) + ' avec Marvell (' + sgn(mq.chg, 1) + ').'],
    note: 'Relevé unique à ' + V.utc + ' : un cours de fin de séance peut s’en écarter de plusieurs pour cent. Les options se comparent à cours de Marvell égal, sans frais, impôts ni change ; le résultat en euros dépend aussi du dollar.',
    sourceRefs: [c.market('cotations de séance du 2 novembre, non certifiées'), c.ref(8), c.ref(10)] };
  out.timeline = {
    title: 'Ce qui peut bouger Lumentum', from: '2026-11-02', to: '2026-11-20',
    keyWindow: { from: '2026-11-10', to: '2026-11-12', label: 'Fenêtre clé · inflation, CoreWeave, Nebius' },
    events: [
      { date: '2026-11-02', category: 'earnings', impact: 'strong', label: 'Accord Marvell', detail: '+ résultats T1', icon: 'gavel', source: '8-K de Lumentum du 2 novembre 2026 (accord de fusion et communiqué conjoint) et 8-K des résultats du premier trimestre', href: '#seance' },
      { date: '2026-11-04', category: 'earnings', impact: 'medium', label: 'Coherent', detail: 'pair optique', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-05', category: 'earnings', impact: 'medium', label: 'Applied Opto', detail: 'modules', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi US', detail: '14 h 30', icon: 'data', source: 'calendrier du BLS (Employment Situation d’octobre, 8 h 30 à New York)' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: '14 h 30', icon: 'data', source: 'calendrier du BLS et data/scheduled-events.json (cpi)' },
      { date: '2026-11-10', category: 'earnings', impact: 'strong', label: 'CoreWeave', detail: 'après 22 h', icon: 'chip', source: 'communiqué de CoreWeave du 27 octobre 2026 (conférence à 17 h à New York)' },
      { date: '2026-11-12', category: 'earnings', impact: 'strong', label: 'Nebius', detail: 'avant 15 h 30', icon: 'chip', source: 'communiqué de Nebius du 30 octobre 2026 (avant l’ouverture, conférence à 8 h à New York)' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', detail: '14 h 30', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-17', category: 'earnings', impact: 'strong', label: 'NVIDIA', detail: '23 h', icon: 'chip', source: 'page des relations investisseurs de NVIDIA (17 novembre, 17 h à New York)' },
    ],
    chains: [
      { title: 'Si Marvell remonte', steps: [{ label: 'Marvell', category: 'earnings', icon: 'chip', tone: 'up' }, { label: 'Valeur de l’offre', category: 'plan', icon: 'gavel', tone: 'up' }, { label: 'Lumentum', category: 'earnings', icon: 'company', tone: 'up' }] },
      { title: 'Si une autorité bloque', steps: [{ label: 'Autorisation refusée', category: 'geo', icon: 'gavel', tone: 'down' }, { label: 'Rupture de l’accord', category: 'plan', icon: 'alert', tone: 'down' }, { label: 'Lumentum seule', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'S-4, dépôt antitrust et votes : non datés. Marvell vers le 1er décembre, non confirmé. Date butoir : 1er novembre 2027. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-lite-body.cjs')(c, { X, B, V, Se, Ce, P, c30, c29, c28, m29, m30, lq, mq, evRev, statusNote, usdG, frG })));
};

module.exports.scenarios = c => {
  const X = deal(c), Se = X.sess;
  return [
    { scenario: 'bullish', trigger: 'Marvell remonte, porté par sa prévision ou par la demande de l’optique, et le calendrier réglementaire se précise sans demande de remède lourd.', firstOrder: 'La valeur de l’offre monte de 4,5 dollars par dollar de hausse de Marvell, et l’écart de ' + frG(Se.s * 100, 1) + ' % se resserre à mesure que la date de clôture approche.', secondOrder: 'Coherent et Applied Optoelectronics gardent une prime de rareté : la valeur de Lumentum sans l’offre remonte avec eux, ce qui adoucit le scénario de rupture.', confirmation: 'Dépôt du document S-4 et du dossier antitrust, votes fixés, et un écart qui se réduit pendant que Marvell tient.', contradiction: 'Un écart qui s’élargit alors que Marvell monte : le marché doute alors de l’accord, pas de Marvell.' },
    { scenario: 'mixed', trigger: 'Marvell stagne, l’instruction réglementaire s’étire vers la date butoir du 1er novembre 2027 et ses prorogations.', firstOrder: 'Lumentum dérive avec Marvell ; l’écart rapporte de moins en moins par an à mesure que la date de clôture recule.', secondOrder: 'Les pairs optiques publient les 4 et 5 novembre et fixent la valeur de repli de Lumentum, sans effet sur l’offre elle-même.', confirmation: 'Prorogation de la date butoir ou demande d’informations complémentaires des autorités.', contradiction: 'Une autorisation anticipée qui rapproche la clôture du début de 2028.' },
    { scenario: 'bearish', trigger: 'Une autorité bloque ou exige un remède que Marvell refuse, ou un vote échoue ; ou Marvell continue de baisser après sa chute des 29 et 30 octobre.', firstOrder: 'En cas de rupture, Lumentum retombe vers la valeur des pairs optiques, ' + usdG(X.cert.brk) + ' sur la clôture du 30 octobre selon le repère du 28 octobre ajusté, plus environ ' + usdG(X.fee) + ' par action si l’indemnité réglementaire est due.', secondOrder: 'Marvell rebondirait peut-être sans la dilution de l’opération ; les arbitragistes qui portent Lumentum vendraient en même temps.', confirmation: 'Annonce d’une enquête approfondie, d’un remède refusé ou d’un vote négatif.', contradiction: 'Une offre concurrente pour Lumentum, qui ferait payer 2,9 Md$ à Lumentum mais pourrait relever le prix.' }];
};

module.exports.contradictions = c => {
  const X = deal(c), Se = X.sess, b = X.B;
  return [
    'La valeur de Lumentum sans l’offre, estimée par la baisse médiane de deux pairs depuis le 28 octobre, dépasse le cours de séance (' + usdG(Se.brk) + ' contre ' + usdG(Se.pl) + ', non certifiés) : soit le marché juge Lumentum seule moins chère que ses pairs, soit il intègre un risque que cette méthode ne voit pas. Aucune probabilité de conclusion n’est déduite de ces chiffres.',
    'L’acquéreur a plus baissé que la cible : du 28 au 30 octobre, Marvell ' + c.sgn(b.since('MRVL', '2026-10-28', c.REF), 1) + ' et Lumentum ' + c.sgn(c.pct(c.close, X.L28), 1) + ' ; la parité fixe transmet ensuite chaque baisse de Marvell à Lumentum.',
    'Le trimestre de Lumentum est le meilleur de son histoire (1 262,6 M$, prévision de 1,6 Md$ au milieu de fourchette), et le titre perd pourtant ' + c.fr(Math.abs(X.V.q('LITE').chg), 1) + ' % en séance : le prix ne dépend plus des comptes de Lumentum mais de celui de Marvell.'];
};

module.exports.missingData = c => [
  'Clôture certifiée du 2 novembre indisponible à la publication : cours de séance relevés à une seule heure, non certifiés.',
  'Liste des autorisations réglementaires requises (section 7.1(c) d’une annexe non publiée) et calendrier des votes inconnus.',
  'Principal restant de chaque série d’obligations convertibles au 26 septembre non publié avant le 10-Q du premier trimestre.',
  'Dates de résultats de plusieurs comparables connues par une seule source ; date de Marvell non confirmée par la société.',
  'Statistiques des pairs relevées en instantané, sans historique daté.'];

module.exports.base = base;
module.exports.deal = deal;
module.exports.live = live;
