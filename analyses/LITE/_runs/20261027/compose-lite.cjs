'use strict';
// Prix au format français avec séparateur de milliers (« 1 133,40 $ ») : le formateur du gabarit commun n'en met pas,
// et Lumentum a coté au-dessus de 1 000 $ en octobre.
const usdG = (n, d = 2) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '') + ' $'; };
const frG = (n, d = 1) => { const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (f ? ',' + f : ''); };
// Rédaction du dossier Lumentum (LITE) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-lite.cjs) ;
// les causes des séances d'octobre viennent de la presse financière citée.
const S = require('./static-lite.cjs');

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); return pct(bars[i][1], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d0, d1) => { const b = row(sym); const a = b.find(x => x[0] === d0), z = b.find(x => x[0] === d1); if (!a || !z) throw Error('barre absente ' + sym); return pct(z[4], a[4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, hiD, hiC = -1, hiCD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[4] > hiC) { hiC = b[4]; hiCD = b[0]; } }
  if (hiD !== '2026-10-09' || hiCD !== '2026-10-06') throw Error('plus haut annuel inattendu ' + hiD + ' ' + hiCD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  const dec31 = bar('2025-12-31')[4];
  return { cmp, bar, chg, gapOf, dr, since, hi, hiD, hiC, hiCD, med, avgVol, dec31, ytd: pct(close, dec31), fromHiC: Math.abs(pct(close, hiC)) };
}

// Prochaine publication : calendrier collecté (une seule source) recoupé par le communiqué de la société du 5 octobre
// (copie hachée dans _primary) : la date est confirmée par l'émetteur.
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'LITE');
  return ev ? { date: ev.report_date, source: 'communiqué de Lumentum du 5 octobre 2026 (« after the market closes »), recoupé par le calendrier de résultats collecté' } : null;
}

// Dilution des obligations convertibles au cours du jour : principal remboursé en numéraire, excédent en actions
// (choix de la société, hypothèse la plus dilutive), option d'achat plafonnée sur les obligations 2032 jusqu'à 268,24 $.
function dilution(P) {
  let gross = 0, net = 0, cash = 0, capOffset = 0; const rows = [];
  for (const n of S.NOTES) {
    const under = n.principal / n.conv; // millions d'actions sous-jacentes
    const excess = under * Math.max(0, 1 - n.conv / P);
    const off = n.cap ? under * (Math.min(P, n.cap) - n.conv) / P : 0;
    gross += under; net += excess - off; cash += n.principal; capOffset += off;
    rows.push({ ...n, under, excess, off });
  }
  return { gross, net, cash, capOffset, rows };
}

module.exports = (c, save) => {
  const usd = usdG;
  const { fr, pct, sgn, close, prev, bars, N, tech, st, M, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat, shares } = c;
  const B = base(c), { bar, chg, dr, since, med } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2026-11-05') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), lo26 = bars[N][3], hi26 = bars[N][2], vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const c1012 = chg('2026-10-12'), c1022 = chg('2026-10-22'), c0812 = chg('2026-08-12'), c1105 = chg('2025-11-05'), c0204 = chg('2026-02-04'), c0506 = chg('2026-05-06');
  const dd = pct(bar('2026-10-22')[4], B.hiC), ddLow = pct(bar('2026-10-23')[3], B.hi);
  const runRate = 1.25e9 * 4, evRev = ev / G$.rev, evRun = ev / runRate, evEbitda = ev / G$.ebitda, peAdjFwd = close / (4.20 * 4), peAdjFy = close / 8.67;
  const opMargin = G$.ebit / G$.rev * 100;
  const pv = Object.fromEntries(['COHR', 'CIEN', 'AAOI', 'MTSI', 'CRDO', 'MRVL'].map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const optMed = med([pv.COHR, pv.CIEN, pv.AAOI]);
  if (Math.abs(optMed - 8.0) > 0.05) throw Error('médiane des pairs optiques inattendue ' + optMed);
  const D = dilution(close), dilPct = D.net * 1e6 / shares * 100;
  const r32 = D.rows.find(r => r.serie === '2032'), net2032 = r32.excess - r32.off, dilLo = net2032, dilLoPct = dilLo * 1e6 / shares * 100;
  const dilRange = fr(dilLo, 1) + ' à ' + fr(D.net, 1) + ' millions';
  const c1014 = chg('2026-10-14');
  const s6 = t => since(t, '2026-10-06', '2026-10-22');
  const eDate = dfr(E.date);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'semis', 'ai', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Lumentum a perdu un tiers de sa valeur en douze séances sans mauvaise nouvelle propre, avec toute l’optique de l’IA. Rien à acheter avant les résultats du 5 novembre, puis seulement sur une clôture à ' + trigTxt + ' ou plus ; une clôture sous ' + abTxt + ' abandonne le plan.',
      ogDescription: 'Lumentum à ' + usd(close) + ' (' + sgn(c26, 1) + ') après ' + sgn(dd, 1) + ' en douze séances : demande supérieure à l’offre, mais ' + fr(evRev, 0) + ' fois ses revenus. Résultats le 5 novembre.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'no-trade', to: 'watch', note: 'refonte du 27 octobre sur la clôture du 26 : plan de surveillance, activation après les résultats du 5 novembre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'LITE', name: 'Lumentum Holdings Inc.', exchange: 'NASDAQ', sector: 'Lasers et modules optiques pour les centres de données de l’IA', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RIEN AVANT LE 5 NOVEMBRE', color: 'blue' }, { text: 'Chaîne optique de l’IA', color: 'purple' }, { text: 'Convertibles dans la monnaie', color: 'amber' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evRevenue: fr(evRev, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 50, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 50 sur 100) : la grille crédite une croissance rare et un client sous contrat, mais retranche une valorisation hors norme, la dilution des convertibles, une technique cassée et des résultats à huit séances. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Lumentum fabrique les lasers et les modules optiques qui relient les puces des grappes de calcul de l’IA. Son chiffre d’affaires a doublé en un an : 1 006,3 M$ au quatrième trimestre de l’exercice clos fin juin, et une prévision de 1,225 à 1,275 Md$ pour le trimestre suivant, dont les résultats tombent le jeudi ' + eDate + ' au soir, date confirmée par la société. NVIDIA s’est engagé sur plusieurs milliards d’achats et a investi 2 Md$. Le titre a pourtant perdu ' + fr(Math.abs(dd), 1) + ' % entre sa clôture record du 6 octobre (' + usd(B.hiC) + ') et celle du 22, sans nouvelle propre : Coherent et Applied Optoelectronics ont baissé davantage, Microsoft et Amazon presque pas. La presse cite la peur du financement de l’IA, pas un recul des commandes. Lundi, rebond de ' + fr(c26, 1) + ' % à ' + usd(close) + '. À ce prix, Lumentum vaut ' + fr(evRev, 0) + ' fois son chiffre d’affaires des douze derniers mois, contre 6 à 10 fois pour ses pairs optiques sur la même base (' + fr(evRun, 0) + ' fois sur la prévision annualisée), et ses obligations convertibles créeraient ' + dilRange + ' d’actions. Rien à acheter avant le ' + eDate + ' ; ensuite, seulement sur une clôture à ' + trigTxt + ' ou plus.',
    whyBuy: [
      'Une croissance rare : 3 014,0 M$ de chiffre d’affaires sur l’exercice clos le 27 juin (+83,2 %), 1 006,3 M$ au seul quatrième trimestre (+109,3 %), et une prévision de 1,225 à 1,275 Md$ pour le premier trimestre de l’exercice 2027, soit un rythme de 5 Md$ par an.',
      'Une rentabilité qui monte avec le volume : marge opérationnelle GAAP de 27,8 % au quatrième trimestre (36,6 % hors rémunérations en actions et autres ajustements), prévision ajustée de 39,5 à 40,5 %, et ' + frG(G$.fcf / 1e6, 1) + ' M$ de flux de trésorerie libre sur l’exercice après ' + frG(G$.capex / 1e6, 1) + ' M$ d’investissements.',
      'Un client sous contrat : NVIDIA s’est engagé en mars sur plusieurs milliards de dollars d’achats et un accès réservé à la capacité laser future, et a investi 2 Md$ ; le 10-K dit que la demande dépasse l’offre et oblige la société à répartir ses livraisons.',
      'Un bilan solide aujourd’hui : ' + frG(G$.cash / 1e6, 1) + ' M$ de trésorerie et placements au 27 juin pour ' + frG(G$.debt / 1e6, 1) + ' M$ de dette, une ligne de crédit de 400,0 M$ non tirée. La croissance a pourtant été financée par 1,265 Md$ de convertibles et 2 Md$ de NVIDIA en douze mois, sans aucun prospectus.',
      'Le titre recule de ' + fr(B.fromHiC, 1) + ' % depuis sa clôture record, et sur vingt et une séances il fait ' + sgn(c.ret(21), 1) + ' contre ' + sgn(M.COHR.return21d, 1) + ' pour Coherent et ' + sgn(M.AAOI.return21d, 1) + ' pour Applied Optoelectronics.'],
    whyAvoid: [
      'Un prix hors norme : ' + fr(evRev, 1) + ' fois le chiffre d’affaires des douze derniers mois et ' + fr(evRun, 1) + ' fois celui de la prévision annualisée, contre ' + fr(pv.COHR, 1) + ' fois pour Coherent, ' + fr(pv.CIEN, 1) + ' pour Ciena et ' + fr(pv.AAOI, 1) + ' pour Applied Optoelectronics ; ' + fr(peAdjFwd, 1) + ' fois le bénéfice ajusté annualisé de la prévision.',
      'Une dilution qui suit le cours : 1 554,3 M$ d’obligations convertibles restaient au 27 juin, toutes dans la monnaie ; au cours du 26 octobre, l’excédent de leur valeur de conversion représente ' + dilRange + ' d’actions nouvelles (' + fr(dilLoPct, 1) + ' à ' + fr(dilPct, 1) + ' %), après la couverture des obligations 2032 ; environ 10,6 millions d’actions ont déjà été remises au quatrième trimestre en échange d’obligations.',
      'Deux clients non nommés font 41,6 % du chiffre d’affaires (26,6 % et 15,0 % sur l’exercice 2026) : une commande décalée se voit dans le trimestre.',
      'Un titre qui bouge de ' + usd(tech.atr14) + ' par séance en moyenne (ATR sur quatorze séances) et qui a réagi de ' + sgn(c1105, 1) + ', ' + sgn(c0204, 1) + ', ' + sgn(c0506, 1) + ' et ' + sgn(c0812, 1) + ' aux quatre dernières publications : un stop ne protège pas d’un écart d’ouverture.',
      'Le financement des grappes d’IA devient la question : les patrons de Broadcom et d’Intel en ont parlé le 12 octobre, et le 14 la presse y a relié la chute de l’optique (Lumentum ' + sgn(c1014, 1) + ') ; Microsoft et Alphabet publient le 28 octobre, Amazon le 29 (dates d’une seule source).'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, sans trou ; vingt-six comparables alignés sur les mêmes dates.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Structure du capital', status: 'warn', statusLabel: 'Convertibles dans la monnaie', evidence: '93 459 271 actions au 24 septembre, préférence de NVIDIA comptée comme convertie ; 1 554,3 M$ d’obligations convertibles au 27 juin, prix de conversion de 69,54 $ à 187,77 $ ; ' + dilRange + ' d’actions de plus au cours du 26 octobre.', action: 'Compter la dilution dans la valorisation ; l’absence de prospectus n’exclut pas une nouvelle émission privée, convertible ou préférence.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Tendance cassée, résultats dans huit séances', evidence: 'Clôture à ' + usd(close) + ', sous les moyennes exponentielles à vingt (' + usd(tech.ema20) + ') et cinquante séances (' + usd(tech.ema50) + '), au-dessus de celle à deux cents (' + usd(tech.ema200) + ') ; ' + fr(vol26 / 1e6, 2) + ' millions d’actions échangées lundi, ' + fr(vol26 / avgVol26, 1) + ' fois la moyenne des vingt séances précédentes.', action: 'Aucun achat avant les résultats du ' + eDate + ' ; ensuite seulement sur une clôture à ' + trigTxt + ' ou plus.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Lumentum', from: '2026-10-27', to: '2026-11-12',
    keyWindow: { from: E.date, to: '2026-11-06', label: 'Fenêtre clé · résultats après 22 h, clôture du 6 à 22 h' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Microsoft', detail: '+ Alphabet, budgets', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'earnings', impact: 'strong', label: 'Amazon', detail: 'centres de données', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-04', category: 'earnings', impact: 'medium', label: 'Coherent', detail: 'pair optique', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats LITE', detail: 'prévision du 2e trimestre', icon: 'company', source: E.source, href: '#earnings' },
      { date: '2026-11-06', category: 'macro', impact: 'strong', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-12', category: 'plan', impact: 'strong', label: 'Fin du plan', detail: 'dernière activation', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si les budgets montent', steps: [{ label: 'Budgets du cloud', category: 'earnings', icon: 'chip', tone: 'up' }, { label: 'Commandes optiques', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Lumentum', category: 'earnings', icon: 'company', tone: 'up' }] },
      { title: 'Si le crédit se resserre', steps: [{ label: 'Financement de l’IA', icon: 'bank', tone: 'down' }, { label: 'Nouveaux clouds', category: 'earnings', icon: 'chip', tone: 'down' }, { label: 'Fournisseurs optiques', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'Rien avant le 5 novembre ; une clôture sous ' + abTxt + ' abandonne le plan. NVIDIA publie à la mi-novembre, date non annoncée : hors frise. « ? » : date d’une seule source.',
  };
  return save(Object.assign(out, require('./compose-lite-body.cjs')(c, { B, E, D, dilPct, dilLo, dilLoPct, dilRange, c1014, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, lo26, hi26, vol26, avgVol26, c1012, c1022, c0812, c1105, c0204, c0506, dd, ddLow, runRate, evRev, evRun, evEbitda, peAdjFwd, peAdjFy, opMargin, pv, optMed, s6, eDate })));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Microsoft, Alphabet et Amazon maintiennent ou relèvent leurs budgets d’investissement, puis Lumentum publie le 5 novembre un trimestre dans le haut de sa prévision et une nouvelle hausse pour le suivant.', firstOrder: 'Le titre clôture à ' + usdG(trig) + ' ou plus, au-dessus du plus haut du 26 octobre, puis vise ' + usdG(c.tp1) + ' et ' + usdG(c.tp2) + '.', secondOrder: 'Coherent et Applied Optoelectronics, qui publient le 4 et le 5 novembre, suivent ; la peur du financement recule chez les fournisseurs.', confirmation: 'Une clôture à ' + usdG(trig) + ' ou plus après la publication, avec un volume supérieur à la moyenne et Coherent en hausse la même séance.', contradiction: 'Un saut le soir de la publication qui s’efface dès la première séance complète, ou un écart d’ouverture au-dessus du plafond d’achat.' },
    { scenario: 'mixed', trigger: 'Trimestre conforme, prévision du deuxième trimestre à peine au-dessus du premier ; les hyperscalers ne disent rien de neuf.', firstOrder: 'Le titre oscille entre ' + usdG(c.abandon) + ' et ' + usdG(trig) + ', sous ses moyennes exponentielles à vingt et cinquante séances.', secondOrder: 'La prime de valorisation se réduit sans casse : le marché attend la capacité de la nouvelle usine.', confirmation: 'Des clôtures dans cette bande pendant plusieurs séances après le 5 novembre.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Un hyperscaler réduit son budget, ou Lumentum prévoit un deuxième trimestre en recul, ou le financement des nouveaux clouds se grippe.', firstOrder: 'Clôture sous ' + usdG(c.abandon) + ', le creux du 23 octobre ; la moyenne exponentielle à deux cents séances, vers ' + usdG(c.tech.ema200) + ', est le dernier repère proche.', secondOrder: 'Les fournisseurs les plus chers reculent plus que les acheteurs, comme du 6 au 22 octobre ; les obligations convertibles diluent moins quand le cours baisse.', confirmation: 'Une clôture sous ' + usdG(c.abandon) + ' sur un volume supérieur à la moyenne, avec Coherent en baisse.', contradiction: 'Un nouveau plus bas en séance sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const b = base(c), s6 = t => b.since(t, '2026-10-06', '2026-10-22');
  return [
    'Les acheteurs n’ont presque pas baissé, les fournisseurs si : du 6 au 22 octobre, Lumentum fait ' + c.sgn(c.pct(b.bar('2026-10-22')[4], b.hiC), 1) + ', Coherent ' + c.sgn(s6('COHR'), 1) + ', Applied Optoelectronics ' + c.sgn(s6('AAOI'), 1) + ', mais Microsoft ' + c.sgn(s6('MSFT'), 1) + ', Amazon ' + c.sgn(s6('AMZN'), 1) + ' et NVIDIA ' + c.sgn(s6('NVDA'), 1) + '. Le marché a vendu la chaîne d’approvisionnement, pas la demande finale.',
    'Le lien économique avec les hyperscalers est fort, la corrélation quotidienne presque nulle : ' + c.fr(c.M.MSFT.correlation, 2) + ' avec Microsoft, ' + c.fr(c.M.GOOGL.correlation, 2) + ' avec Alphabet et ' + c.fr(c.M.AMZN.correlation, 2) + ' avec Amazon sur ' + c.M.MSFT.observations + ' séances. Leurs budgets se lisent dans les carnets de Lumentum avec retard, pas dans le cours du jour.',
    'La perte nette GAAP de 6 935,1 M$ sur l’exercice n’est pas une perte d’exploitation : elle vient d’une charge non monétaire de 7 756,6 M$ née de l’échange d’obligations contre actions, quand le résultat opérationnel atteint ' + c.fr(c.G$.ebit / 1e6, 1) + ' M$.',
    'Plus le titre monte, plus il dilue : les obligations convertibles créent des actions à chaque hausse du cours, et la couverture achetée sur les obligations 2032 cesse de jouer au-delà de 268,24 $, très loin sous le cours actuel.'];
};

module.exports.missingData = c => [
  'Les deux clients à plus de 10 % du chiffre d’affaires ne sont pas nommés dans le 10-K ; seul NVIDIA est documenté comme client, par le communiqué du 2 mars, sans montant annuel.',
  'Montant et calendrier de l’engagement d’achat de NVIDIA non publiés au-delà de « plusieurs milliards ».',
  'Conversions d’obligations réglées après le 27 juin non publiées avant le 10-Q du premier trimestre ; dilution calculée sur les principaux du 27 juin.',
  'Mouvement implicite des options autour des résultats indisponible à la collecte (marché fermé).',
  'Date des résultats de NVIDIA non annoncée à la collecte ; dates de résultats des comparables connues par une seule source.',
  'Causes des séances du 12, du 22 et du 26 octobre connues par la presse financière citée, sans dépôt de la société.',
  'Statistiques des pairs relevées en instantané, sans historique daté.'];

module.exports.base = base;
module.exports.dilution = dilution;
