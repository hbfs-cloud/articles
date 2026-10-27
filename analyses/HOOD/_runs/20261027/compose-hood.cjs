'use strict';
// Rédaction du dossier Robinhood Markets (HOOD) du 27 octobre 2026, clôture de référence du 26 octobre. Toute valeur de
// marché est recalculée depuis les barres certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des
// dépôts SEC ouverts (static-hood.cjs) ; les données mensuelles d'activité et la date des résultats viennent des communiqués
// de la société (texte conservé dans analyses/HOOD/_primary/ir/) ; décisions de justice et actions d'analystes : presse citée.
const fs = require('fs'), path = require('path');

// Communiqué mensuel du 10 septembre 2026 (août et juillet 2026) et communiqué du deuxième trimestre (8-K du 29 juillet).
// Valeurs recopiées telles que publiées ; les comparaisons sont calculées ici.
const AUG = { equity: 335.4, equityJul: 332.8, options: 292.5, optionsJul: 324.2, crypto: 17.5, cryptoJul: 10.9, cryptoYoY: -38,
  events: 4.7, eventsJul: 6.1, margin: 21.5, marginYoY: 72, funded: 28.6, tpa: 383.7, netDep: 4.0 };
const Q2 = { equity: 956, options: 774, crypto: 40, events: 13.6, margin: 21.6, rev: 1.31, evRev: 156, cryptoRev: 100, nii: 389, txRev: 776, otherRev: 143, gain: 129, epsGain: 0.14, eps: 0.62 };
const Q3FY25 = { rev: 1.27, eps: 0.61, cryptoRev: 268 };
const CONS = { rev: 1.42, eps: 0.56 }; // consensus cité par Benzinga le 26 octobre 2026 (presse, pas la société)
const EXP = { low: 2.675, high: 2.775 }; // prévision de charges ajustées et rémunération en actions 2026 (8-K du 29 juillet)
const BUYBACK_LEFT = 1373; // M$ disponibles au 30 juin (10-Q)
const CONV = { amount: 2.2, price: 174.42, cap: 237.85, shares: 12.6, noDilution: 303.95 };
const WARR = { shares: 8.74, strike: 26.6 };

const mAvg = (a, b) => (a + b) / 2, q = x => x / 3;
function volumes() {
  return { equity: pctf(mAvg(AUG.equity, AUG.equityJul), q(Q2.equity)), options: pctf(mAvg(AUG.options, AUG.optionsJul), q(Q2.options)),
    crypto: pctf(mAvg(AUG.crypto, AUG.cryptoJul), q(Q2.crypto)), events: pctf(mAvg(AUG.events, AUG.eventsJul), q(Q2.events)) };
}
function pctf(a, b) { return 100 * (a / b - 1); }

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const ix = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('séance absente ' + d); return i; };
  const chg = d => { const i = ix(d); return pct(bars[i][4], bars[i - 1][4]); };
  const gap = d => { const i = ix(d); return pct(bars[i][1], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const since = (sym, d) => { const b = cmp.find(x => x.symbol === sym).bars; return pct(b.at(-1)[4], b.find(x => x[0] === d)[4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2025-10-31') throw Error('plus haut annuel inattendu ' + hiD);
  // Dernière séance antérieure au 26 octobre dont le plus bas est sous celui du 26 octobre.
  let prevLowD = null; for (let i = N - 1; i >= 0; i--) if (bars[i][3] < bars[N][3]) { prevLowD = bars[i][0]; break; }
  if (prevLowD !== '2026-08-18') throw Error('plus bas antérieur inattendu ' + prevLowD);
  const avgVol = (from, n) => { const i = ix(from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Réactions aux quatre dernières publications (résultats publiés après la clôture : la séance suivante réagit).
  const RX = [['2025-11-06', 'novembre 2025'], ['2026-02-11', 'février'], ['2026-04-29', 'avril'], ['2026-07-30', 'juillet']].map(([d, m]) => ({ d, m, cc: chg(d), gap: gap(d) }));
  if (RX.some(r => r.cc >= 0)) throw Error('réaction positive inattendue');
  let worstGap = 0, worstGapD = ''; for (let i = N - 249; i <= N; i++) { const g = bars[i][1] / bars[i - 1][4] - 1; if (g < worstGap) { worstGap = g; worstGapD = bars[i][0]; } }
  if (worstGapD !== '2026-04-29') throw Error('pire écart inattendu ' + worstGapD);
  return { cmp, bar, chg, gap, dr, since, hi, hiD, lo, loD, prevLowD, avgVol, RX, worstGap, worstGapD, fromHi: Math.abs(pct(close, hi)) };
}

// Prochaine publication : calendrier collecté ET communiqué de la société du 1er octobre (date confirmée par l'émetteur).
function earningsDate(c) {
  const ev = ((c.raw.earnings_risk || {}).events || []).find(e => e.symbol === 'HOOD');
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  return { date: ev && ev.report_date, cal: cal && String(cal.nextEarningsDate || '').slice(0, 10) };
}

// Ventes d'initiés : formulaires 4 relevés (couverture officielle incomplète), codes S seulement.
function insiderStats(c) {
  const tx = c.tx.transactions || [];
  const S = tx.filter(x => x.type_code === 'S' && x.eligible_common_equity);
  const buys = tx.filter(x => x.type_code === 'P').length;
  const by = n => S.filter(x => x.insider_name === n);
  const sum = a => a.reduce((s, x) => s + x.shares, 0), val = a => a.reduce((s, x) => s + x.shares * x.price, 0);
  const tenev = by('Tenev Vladimir'), tenevSep = tenev.filter(x => x.date_transaction >= '2026-09-21');
  const bhatt = by('Bhatt Baiju'), verma = by('Verma Shiv');
  const people = new Set(S.map(x => x.insider_name)).size;
  const first = S.map(x => x.date_transaction).sort()[0], last = S.map(x => x.date_transaction).sort().at(-1);
  return { n: S.length, buys, people, first, last, total: val(S), tenevSh: sum(tenev), tenevVal: val(tenev), tenevSepSh: sum(tenevSep), tenevSepLo: Math.min(...tenevSep.map(x => x.price)), tenevSepHi: Math.max(...tenevSep.map(x => x.price)),
    bhattSh: sum(bhatt), bhattVal: val(bhatt), bhattLast: bhatt.map(x => x.date_transaction).sort().at(-1), vermaSh: sum(verma), vermaVal: val(verma), coverage: c.tx.coverage_status };
}

module.exports = (c, save) => {
  const { fr, pct, sgn, usd, close, prev, bars, N, tech, st, M, G$, g, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb, peerStat } = c;
  const B = base(c), { bar, chg, dr, since, RX } = B;
  const E = earningsDate(c);
  if (E.date !== '2026-10-27' || E.cal !== '2026-10-27') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const I = insiderStats(c);
  const V = volumes();
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), lo26 = bars[N][3], hi26 = bars[N][2], vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const sinceTop = pct(close, bar('2026-09-23')[4]);
  const c0828 = chg('2026-08-28'), c0903 = chg('2026-09-03'), c1014 = chg('2026-10-14');
  const evEbitda = ev / G$.ebitda, evEbitdaEx = ev / (G$.ebitda - Q2.gain * 1e6), pe = marketCap / G$.ni, peEx = marketCap / (G$.ni - Q2.gain * 1e6), pb = marketCap / g.equity.value;
  const ptiMargin = G$.ebit / G$.rev * 100;
  const exch = ['CME', 'NDAQ', 'CBOE', 'ICE'], pvE = Object.fromEntries([...exch, 'COIN', 'MIAX'].map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const pbPeers = ['CBOE', 'IBKR', 'CME', 'COIN', 'SCHW', 'FUTU', 'VIRT', 'SOFI'], pvB = Object.fromEntries(pbPeers.map(t => [t, peerStat(t, 'priceToBook')]));
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const exchMed = med(exch.map(t => pvE[t]));
  const trend = (((raw.fundamentals.data.items[0].results.find(r => r.data_type === 'analyst_trend') || {}).data || [])[0] || {});
  const target = (trend.price_target || {}).to;
  const analysts = (trend.analyst_count || {}).to;
  if (!target || !analysts) throw Error('consensus des analystes absent');
  const eDate = dfr(E.date);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'financials', 'crypto', 'earnings', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'Robinhood publie ses résultats du troisième trimestre ce soir, après la clôture de New York, à ' + usd(close) + ' (' + sgn(sinceTop, 0) + ' depuis le 23 septembre). Rien à acheter avant ; le plan ne s’active que sur une clôture à ' + trigTxt + ' ou plus, et une clôture sous ' + abTxt + ' l’abandonne.',
      ogDescription: 'Robinhood à ' + usd(close) + ', ' + sgn(sinceTop, 0) + ' depuis le 23 septembre, résultats ce soir. Pas d’achat avant ; activation sur une clôture à ' + trigTxt + ' ou plus.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'expired', to: 'watch', note: 'refonte du 27 octobre 2026 sur la clôture du 26 octobre : surveillance, activation après les résultats du troisième trimestre sur une clôture à ' + trigTxt + ' ou plus, aucune entrée', close }] },
    header: { ticker: 'HOOD', name: 'Robinhood Markets, Inc.', exchange: 'NASDAQ', sector: 'Courtage de détail, crypto et contrats événementiels', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — RÉSULTATS CE SOIR', color: 'blue' }, { text: 'Quatre baisses après résultats', color: 'amber' }, { text: 'Contrats sportifs devant les juges', color: 'red' }],
      metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evEbitda: fr(evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 42, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 42 sur 100) : la grille crédite la croissance, la rentabilité et un bilan sans dette nette, mais retranche la technique, un multiple de croissance et un calendrier qui commence ce soir. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les communiqués de la société ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Robinhood est le courtier des particuliers américains : 28,4 millions de comptes approvisionnés au 30 juin, des revenus tirés des options, des contrats sur événements, de la crypto et des intérêts sur 21,6 Md$ de prêts sur marge. Le titre a perdu ' + fr(Math.abs(sinceTop), 1) + ' % depuis le 23 septembre, à ' + usd(close) + ', alors que les volumes publiés pour juillet et août dépassent, en moyenne mensuelle, ceux du deuxième trimestre. Le marché vend autre chose que l’activité : ' + fr(pe, 0) + ' fois le bénéfice des douze derniers mois, des contrats sportifs que la cour d’appel du neuvième circuit a assimilés à des paris le 28 août, une crypto en recul de 38 % sur un an et quatre publications de suite suivies d’une baisse. Les résultats du troisième trimestre tombent ce soir, mardi ' + eDate + ', après la clôture de New York, soit après 21 h à Paris : date confirmée par la société. Rien à acheter avant. Le plan ne s’active que sur une clôture à ' + trigTxt + ' ou plus, au-dessus du rebond du 16 octobre ; une clôture sous ' + abTxt + ' l’abandonne.',
    whyBuy: [
      'L’activité accélère au troisième trimestre : en moyenne mensuelle, juillet et août dépassent le deuxième trimestre de ' + fr(V.options, 0) + ' % en contrats d’options, de ' + fr(V.events, 0) + ' % en contrats événementiels et de ' + fr(V.equity, 0) + ' % en volume d’actions, selon les communiqués mensuels.',
      'Une machine rentable : ' + fr(G$.rev / 1e9, 2) + ' Md$ de revenus et ' + fr(G$.ebit / 1e9, 2) + ' Md$ de résultat avant impôts sur douze mois, soit ' + fr(ptiMargin, 0) + ' % de marge ; revenus du deuxième trimestre en hausse de 32 %.',
      'Un bilan sans dette nette : ' + fr(G$.cash / 1e9, 2) + ' Md$ de trésorerie au 30 juin contre ' + fr(G$.debt / 1e9, 2) + ' Md$ d’obligations convertibles à 0 %, et ' + nb(BUYBACK_LEFT) + ' M$ encore disponibles au programme de rachat d’actions.',
      'Le cours a déjà beaucoup cédé : ' + fr(B.fromHi, 0) + ' % sous le plus haut sur un an (' + usd(B.hi) + ' le 31 octobre 2025) et ' + fr(Math.abs(pct(close, target)), 0) + ' % sous l’objectif moyen de ' + analysts + ' analystes (' + usd(target) + ').'],
    whyAvoid: [
      'Le marché vend après chaque publication : ' + RX.map(r => sgn(r.cc, 1) + ' en ' + r.m).join(', ') + ', à la séance qui suit les quatre derniers résultats.',
      'Un multiple de croissance : ' + fr(evEbitda, 1) + ' fois l’EBITDA (résultat avant impôts + amortissements) et ' + fr(pe, 1) + ' fois le bénéfice des douze derniers mois, ' + fr(peEx, 1) + ' fois hors gains non récurrents ; les bourses se paient ' + fr(Math.min(...exch.map(t => pvE[t])), 0) + ' à ' + fr(Math.max(...exch.map(t => pvE[t])), 0) + ' fois l’EBITDA.',
      'Les contrats sportifs sont devant les juges : le 28 août, la cour d’appel du neuvième circuit a jugé qu’ils relevaient du pari et rejeté la demande de Robinhood, qui a saisi la Cour suprême le 10 septembre ; le Wisconsin poursuit Robinhood, Kalshi et Coinbase. Les contrats événementiels ont rapporté 156 M$ au deuxième trimestre.',
      'La crypto recule : 100 M$ de revenus au deuxième trimestre (−38 % sur un an), contre ' + Q3FY25.cryptoRev + ' M$ au troisième trimestre 2025, la base de comparaison de ce soir.',
      'Les initiés vendent : ' + I.n + ' ventes et aucun achat relevés du ' + dfr(I.first) + ' au ' + dfr(I.last) + ', dont ' + nb(I.tenevSh) + ' actions (environ ' + fr(I.tenevVal / 1e6, 0) + ' M$) cédées par le directeur général Vlad Tenev, en partie au moins dans un plan de cession programmé ; couverture officielle incomplète.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre ; les séances du 21 et du 24 juillet, absentes de la source de cours, ont été rechargées et contrôlées, comme celles de quatre comparables.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Calendrier', status: 'fail', statusLabel: 'Résultats ce soir', evidence: 'Publication du troisième trimestre le ' + eDate + ' après la clôture de New York, confirmée par le communiqué de la société du 1er octobre ; appel avec les dirigeants à 22 h (Paris).', action: 'Aucun achat avant la clôture du 28 octobre, première séance après la publication.' },
      { label: 'Point d’entrée', status: 'warn', statusLabel: 'Sous les trois moyennes', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 2) + '), sous les moyennes à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + ') ; RSI à ' + fr(tech.rsi14, 0) + '.', action: 'Activation seulement sur une clôture à ' + trigTxt + ' ou plus après les résultats.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger Robinhood', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: E.date, to: '2026-10-28', label: 'Fenêtre clé · résultats mar. après 21 h, Fed mer. 19 h' },
    events: [
      { date: '2026-10-27', category: 'earnings', impact: 'medium', label: 'SoFi', detail: 'dépôts, fintech', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: E.date, category: 'earnings', impact: 'strong', label: 'Résultats HOOD', detail: 'après 21 h, appel 22 h', icon: 'company', source: 'communiqué de Robinhood du 1er octobre 2026 (GlobeNewswire) et calendrier de résultats collecté', href: '#earnings' },
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux courts', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Coinbase', detail: 'crypto, contrats', icon: 'coin', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, valeurs de croissance', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-13', category: 'geo', impact: 'medium', label: 'Cour suprême', detail: 'réponse du Nevada', icon: 'gavel', source: 'registre de la Cour suprême des États-Unis, dossier 26-338 (délai de réponse prolongé au 13 novembre 2026 le 9 octobre)' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Fin d’activation', detail: 'dernière clôture utile', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si les volumes tiennent', steps: [{ label: 'Options, contrats', category: 'earnings', icon: 'data', tone: 'up' }, { label: 'Revenus de transaction', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'HOOD', category: 'earnings', icon: 'company', tone: 'up' }] },
      { title: 'Si l’inflation résiste', steps: [{ label: 'Taux longs', icon: 'bank', tone: 'up' }, { label: 'Valeurs de croissance', category: 'market', icon: 'data', tone: 'down' }, { label: 'HOOD', category: 'earnings', icon: 'company', tone: 'down' }] },
      { title: 'Si les États gagnent', steps: [{ label: 'Contrats sportifs', category: 'geo', icon: 'gavel', tone: 'down' }, { label: 'Paris sportifs', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'HOOD', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'Rien ne s’achète avant la clôture du 28 octobre ; une clôture sous ' + abTxt + ' abandonne le plan. « ? » : date d’une seule source. Si/alors, pas une prévision.',
  };
  return save(Object.assign(out, require('./compose-hood-body.cjs')(c, { B, E, I, V, AUG, Q2, Q3FY25, CONS, EXP, BUYBACK_LEFT, CONV, WARR, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, lo26, hi26, vol26, avgVol26, sinceTop, c0828, c0903, c1014, evEbitda, evEbitdaEx, pe, peEx, pb, ptiMargin, exch, pvE, pbPeers, pvB, exchMed, target, analysts, eDate })));
};

module.exports.scenarios = c => {
  const usd = c.usd, trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100;
  return [
    { scenario: 'bullish', trigger: 'Les résultats de ce soir confirment l’accélération des volumes de juillet et août, et la société ne relève pas sa prévision de charges.', firstOrder: 'Le titre clôture à ' + usd(trig) + ' ou plus, au-dessus du rebond du 16 octobre et de la moyenne à vingt séances, au contact de celle à deux cents séances, puis vise ' + usd(c.tp1) + ' et ' + usd(c.tp2) + '.', secondOrder: 'Coinbase, SoFi et le panier des valeurs technologiques financières suivent ; les bourses, déjà en hausse, réagissent peu.', confirmation: 'Une clôture à ' + usd(trig) + ' ou plus après la publication, sur un volume supérieur à la moyenne.', contradiction: 'Un saut du soir qui s’efface dès la première séance complète, comme en juillet.' },
    { scenario: 'mixed', trigger: 'Revenus proches du consensus cité par la presse, crypto faible, contrats événementiels en ligne ; aucune nouvelle décision de justice.', firstOrder: 'Le titre oscille entre ' + usd(c.abandon) + ' et ' + usd(trig) + ' sans base nette.', secondOrder: 'Les rachats d’actions soutiennent le cours sans le relancer ; Coinbase donne le ton le 29 octobre.', confirmation: 'Plusieurs clôtures dans cette bande après la publication.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre.' },
    { scenario: 'bearish', trigger: 'Revenus sous ceux du deuxième trimestre, crypto en chute, ou nouvelle décision contre les contrats sportifs.', firstOrder: 'Clôture sous ' + usd(c.abandon) + ', plus bas depuis le 18 août : le plan est abandonné et le plus bas du 31 juillet devient le repère suivant.', secondOrder: 'DraftKings et Flutter montent sur toute mauvaise nouvelle judiciaire pour les contrats sportifs, comme le 28 août.', confirmation: 'Une clôture sous ' + usd(c.abandon) + ' sur un volume supérieur à la moyenne.', contradiction: 'Un plus bas en séance sous ce niveau, suivi d’une clôture au-dessus.' }];
};

module.exports.contradictions = c => {
  const b = base(c), V = volumes(), sgn = c.sgn;
  return [
    'L’activité monte pendant que le cours baisse : en moyenne mensuelle, juillet et août dépassent le deuxième trimestre de ' + c.fr(V.options, 0) + ' % en options et de ' + c.fr(V.events, 0) + ' % en contrats événementiels, et le titre fait ' + sgn(c.pct(c.close, b.bar('2026-09-23')[4]), 1) + ' depuis le 23 septembre. Le marché vend le multiple et le risque juridique, pas les volumes déjà publiés.',
    'Les bourses qui encaissent les mêmes volumes montent : en vingt et une séances, Cboe ' + sgn(c.M.CBOE.return21d, 1) + ', CME ' + sgn(c.M.CME.return21d, 1) + ', Nasdaq ' + sgn(c.M.NDAQ.return21d, 1) + ', contre ' + sgn(c.ret(21), 1) + ' pour Robinhood. Les courtiers baissent aussi, mais moins : Schwab ' + sgn(c.M.SCHW.return21d, 1) + ', Interactive Brokers ' + sgn(c.M.IBKR.return21d, 1) + '.',
    'Le 14 octobre, la dégradation de Wolfe Research et une inflation sous-jacente plus forte qu’attendu ont fait ' + sgn(b.chg('2026-10-14'), 1) + ' sur Robinhood, ' + sgn(b.dr('SOFI', '2026-10-14'), 1) + ' sur SoFi, ' + sgn(b.dr('IBKR', '2026-10-14'), 1) + ' sur Interactive Brokers, mais ' + sgn(b.dr('SCHW', '2026-10-14'), 1) + ' sur Schwab : la sanction frappe d’abord les valeurs financières de croissance, le courtage établi beaucoup moins.',
    'Quatre publications de suite ont été suivies d’une baisse alors que les revenus progressaient ; le marché attend plus que la croissance publiée.'];
};

module.exports.missingData = () => [
  'Données mensuelles de septembre non publiées au 27 octobre ; les données mensuelles sont des communiqués de la société, aucun 8-K ne les porte.',
  'Consensus du troisième trimestre connu par la presse (Benzinga, 26 octobre), pas par une source collectée ; il ne sert à aucun niveau ni à aucune invalidation.',
  'Mouvement implicite des options autour des résultats indisponible : chaîne relevée hors séance, sans cotation exploitable.',
  'Couverture officielle des formulaires 4 incomplète sur l’année ; les ventes d’initiés sont un minimum observé.',
  'Part des contrats sportifs dans les contrats événementiels non publiée dans les pièces ouvertes.',
  'Décision de la Cour suprême d’examiner ou non le recours de Robinhood (dossier 26-338) inconnue ; la réponse du Nevada est attendue le 13 novembre.',
  'Statistiques des pairs (multiples) relevées en instantané, sans historique daté.'];

module.exports.base = base;
