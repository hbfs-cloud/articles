'use strict';
// Rédaction du dossier CrowdStrike (CRWD) du 27 octobre 2026. Toute valeur de marché est recalculée depuis les barres
// certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts (static-crwd.cjs) ;
// les causes des séances sectorielles viennent de la presse financière citée.
const { fr, pct, sgn, usd } = require('../../../../tools/lib/analysis-v3-kit.cjs');

// Chiffres lus dans les dépôts primaires (pièces 0, 1, 2, 3 et 6 de static-crwd.cjs), recopiés une fois ici.
const ARR_Q2 = 5841.421, NNARR_Q2 = 332.8, NNARR_Q3FY26 = 265.3;            // M$ ; 10-Q et communiqués
const GUIDE_ARR_Q3 = [6184.4, 6188.4], GUIDE_ARR_FY = [6603.0, 6611.9];     // M$ ; communiqué du 26 août
const K144 = { shares: 620000, value: 140981800 };                          // avis 144 du 19 octobre
const REPO_H1 = { shares: 1920e3, usd: 175.622e6 };                         // 10-Q, rachats du semestre
// Séances qui suivent une publication de résultats (8-K 2.02 du 2 décembre 2025, des 3 mars, 3 juin et 26 août 2026).
const EARNINGS_SESSIONS = ['2025-12-03', '2026-03-04', '2026-06-04', '2026-08-27'];

function base(c) {
  const { bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const dr = (sym, d) => { const row = cmp.find(x => x.symbol === sym); if (!row) throw Error('comparable absent ' + sym); const b = row.bars, i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-10-06') throw Error('plus haut annuel inattendu ' + hiD);
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Pire écart d'ouverture sur un an hors lendemains de résultats (le plan est vendu avant la publication).
  let wg = 0, wgD = '';
  for (let i = N - 251; i <= N; i++) { if (EARNINGS_SESSIONS.includes(bars[i][0])) continue; const g = bars[i][1] / bars[i - 1][4] - 1; if (g < wg) { wg = g; wgD = bars[i][0]; } }
  let eg = 0, egD = '';
  for (const d of EARNINGS_SESSIONS) { const i = bars.findIndex(b => b[0] === d); if (i < 1) continue; const g = bars[i][1] / bars[i - 1][4] - 1; if (g < eg) { eg = g; egD = d; } }
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); return (bars[i][1] / bars[i - 1][4] - 1) * 100; };
  return { cmp, bar, chg, dr, hi, hiD, lo, loD, avgVol, wg, wgD, eg, egD, gapOf, fromHi: pct(close, hi) };
}

// Prochaine publication : bloc calendrier de l'instrument (une seule source), jamais confirmé par la société ici.
function earningsDate(c) {
  const cal = (((c.extra || {}).quote || {}).data || { items: [] }).items.find(x => x.type === 'instrument_calendar');
  if (cal && /^\d{4}-\d{2}-\d{2}/.test(cal.nextEarningsDate || '')) return { date: cal.nextEarningsDate.slice(0, 10), source: 'bloc calendrier de l’instrument (' + cal.earningsCalendarSource + ')' };
  return null;
}

// Ventes d'initiés relevées (formulaires 4, couverture officielle incomplète) : cumul par nom et fenêtre.
function insiderSales(c) {
  const tx = (c.tx.transactions || []).filter(t => t.type_code === 'S' && t.eligible_common_equity);
  const sum = (pred) => tx.filter(pred).reduce((a, t) => ({ shares: a.shares + t.shares, usd: a.usd + (t.value_usd || 0), n: a.n + 1 }), { shares: 0, usd: 0, n: 0 });
  const buys = (c.tx.transactions || []).filter(t => t.type_code === 'P' && t.date_transaction >= '2025-10-27').length;
  const podbere = sum(t => /^Podbere/.test(t.insider_name) && t.date_transaction === '2026-09-24');
  const kurtz = sum(t => /^Kurtz/.test(t.insider_name) && t.date_transaction >= '2026-08-27' && t.date_transaction <= c.REF);
  const all = sum(t => t.date_transaction >= '2026-08-27' && t.date_transaction <= c.REF);
  const names = new Set(tx.filter(t => t.date_transaction >= '2026-08-27' && t.date_transaction <= c.REF).map(t => t.insider_name));
  if (podbere.shares !== 480000) throw Error('ventes du directeur financier inattendues ' + podbere.shares);
  if (buys !== 0) throw Error('achats d’initiés relevés : ' + buys);
  const pod = tx.filter(t => /^Podbere/.test(t.insider_name) && t.date_transaction === '2026-09-24').map(t => t.price);
  const kOct = tx.filter(t => /^Kurtz/.test(t.insider_name) && t.date_transaction >= '2026-10-15' && t.date_transaction <= c.REF).map(t => t.price);
  return { podbere, kurtz, all, names: names.size, buys, kOctLo: Math.min(...kOct), kOctHi: Math.max(...kOct), podLo: Math.min(...pod), podHi: Math.max(...pod) };
}

function numbers(c) {
  const { close, G$, g, ev, marketCap, peerStat, shares } = c;
  // Flux libre au plus près de la définition de la société : flux opérationnel − équipements − logiciels immobilisés
  // (les placements de rémunération différée, quelques millions par semestre, ne sont pas retranchés).
  const fcf = G$.fcf - g.capsw.value;
  const evRev = ev / G$.rev, evFcf = ev / fcf, peFwd = close / 1.255;
  const pv = Object.fromEntries(['PANW', 'ZS', 'FTNT', 'NET', 'S', 'OKTA'].map(t => [t, peerStat(t, 'enterpriseToRevenue')]));
  const MP = 27.8; if (Math.abs(pv.PANW - MP) > 0.05) throw Error('multiple de Palo Alto inattendu ' + pv.PANW);
  const sv = Object.values(pv).sort((a, b) => a - b), medPeers = (sv[2] + sv[3]) / 2, rankPanw = sv.length - sv.indexOf(pv.PANW);
  const s8post = (5067266 + 2533633) * 4; // pièce 107 du S-8 du 5 mars, ajustée d'office du fractionnement de quatre pour une
  const perShareAt = m => (m * G$.rev - G$.debt + G$.cash) / shares;
  const nnQ3 = GUIDE_ARR_Q3.map(x => x - ARR_Q2), nnQ3g = nnQ3.map(x => (x / NNARR_Q3FY26 - 1) * 100);
  const nnQ4 = [GUIDE_ARR_FY[0] - GUIDE_ARR_Q3[1], GUIDE_ARR_FY[1] - GUIDE_ARR_Q3[0]], nnQ4mid = (GUIDE_ARR_FY[0] + GUIDE_ARR_FY[1]) / 2 - (GUIDE_ARR_Q3[0] + GUIDE_ARR_Q3[1]) / 2;
  const nnQ2g = 51; // croissance publiée du net new ARR du deuxième trimestre, communiqué du 26 août
  const sbc = g.sbc.value, opMargin = G$.ebit / G$.rev * 100, netCash = G$.cash - G$.debt;
  const k144avg = K144.value / K144.shares, repoAvg = REPO_H1.usd / REPO_H1.shares;
  return { medPeers, rankPanw, s8post, fcf, evRev, evFcf, peFwd, pv, MP, perShareAt, nnQ3, nnQ3g, nnQ4, nnQ4mid, nnQ2g, sbc, opMargin, netCash, k144avg, repoAvg, mcap: marketCap };
}

const dfrY = d => { const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; const [y, m, j] = d.split('-').map(Number); return (j === 1 ? '1er' : j) + ' ' + M[m - 1]; };

module.exports = (c, save) => {
  const { close, prev, bars, N, tech, M, G$, lv, entry, stop, tp1, tp2, abandon, cap, capRr, rr1, rr2, raw, dfr, nb, ret } = c;
  const B = base(c), { bar, chg, dr, hi, lo, loD, fromHi } = B;
  const E = earningsDate(c);
  if (!E || E.date !== '2026-12-01') throw Error('date de résultats inattendue ' + JSON.stringify(E));
  const I = insiderSales(c), X = numbers(c);
  const eDate = dfrY(E.date);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd), stopLvl = usd(stop), capTxt = usd(cap), entryTxt = usd(entry), gateTxt = usd(lv('gate'));
  const c26 = pct(close, prev), vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const c1014 = chg('2026-10-14'), c1016 = chg('2026-10-16'), c1021 = chg('2026-10-21'), c1023 = chg('2026-10-23'), c0914 = chg('2026-09-14');
  const r5 = ret(5), r21 = ret(21), r63 = ret(63), cibr5 = M.CIBR.return5d, sector5 = M.CIBR.beta * cibr5, own5 = r5 - sector5;
  const lowOct = lv('abandon'), fromLowOct = pct(close, lowOct), drawOct = pct(lowOct, lv('r3'));
  // Fenêtre du plus haut du 6 octobre à la clôture de référence, et rendement que le bêta au panier annonçait sur 21 séances.
  const winRet = (sym, d0, d1) => { const x = sym === 'CRWD' ? bars : B.cmp.find(z => z.symbol === sym).bars; return pct(x.find(z => z[0] === d1)[4], x.find(z => z[0] === d0)[4]); };
  const w6 = Object.fromEntries(['CRWD', 'CIBR', 'BUG', 'ZS'].map(t => [t, winRet(t, '2026-10-06', c.REF)]));
  const beta21 = M.CIBR.beta * M.CIBR.return21d;
  const c0220 = chg('2026-02-20'), c0223 = chg('2026-02-23');
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'software', 'tech', 'ai', 'momentum', 'trade-idea'], grade: 'C+', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'CrowdStrike a repris ' + fr(fromLowOct, 0) + ' % depuis le 20 octobre avec tout le panier de cybersécurité, mais reste à la traîne depuis le 6. Rien à acheter à ' + usd(close) + ' : ordre sur repli à ' + entryTxt + ' à partir du 29 octobre, stop ' + stopTxt + ', vente au plus tard le 16 novembre.',
      ogDescription: 'CrowdStrike à ' + usd(close) + ' : rebond sectoriel, retard sur le panier depuis le 6 octobre. Achat seulement sur repli à ' + entryTxt + ', stop ' + stopTxt + ', sortie le 16 novembre.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'stopped', to: 'watch', note: 'refonte v3 du 27 octobre sur la clôture du 26 : le plan de septembre, arrêté au stop le 15 octobre, est clos ; nouveau plan de surveillance, achat seulement sur un repli à ' + fr(entry, 2) + ' $, vente au plus tard le 16 novembre', close }] },
    header: { ticker: 'CRWD', name: 'CrowdStrike Holdings, Inc.', exchange: 'NASDAQ', sector: 'Cybersécurité en nuage', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — ACHAT SUR REPLI SEULEMENT', color: 'blue' }, { text: 'ARR sous demandes du DOJ et de la SEC', color: 'red' }, { text: 'Suit le panier de cybersécurité', color: 'amber' }],
      metrics: { marketCap: fr(X.mcap / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evRevenue: fr(X.evRev, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 48, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C+ (score additif de 48 sur 100) : la grille crédite une croissance récurrente rare et un bilan sans dette nette, mais retranche un prix qui suppose une exécution parfaite, un titre en retard sur son panier, la dilution (rémunération en actions, émission pour XM Cyber, réserve S-8) et un calendrier chargé (Fortinet et Microsoft le 28 octobre, Palo Alto le 19 novembre, CrowdStrike le 1er décembre, une seule source chacun). Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'CrowdStrike traverse octobre comme une action de secteur, et comme la traînarde du panier. Du plus haut sur un an (' + usd(hi) + ', le 6 octobre) au 26, le titre perd ' + fr(Math.abs(w6.CRWD), 1) + ' % quand le panier CIBR fait ' + sgn(w6.CIBR, 1) + ' et BUG ' + sgn(w6.BUG, 1) + ' ; sur vingt et une séances, son bêta de ' + fr(M.CIBR.beta, 2) + ' au panier annonçait ' + sgn(beta21, 1) + ', il a fait ' + sgn(r21, 1) + '. Le rebond des cinq dernières séances (' + sgn(r5, 1) + ', dont ' + sgn(c1023, 2) + ' le 23 sur une enquête d’Evercore ISI, selon la presse) n’est que la part du secteur. Le métier accélère : net new ARR record de ' + fr(NNARR_Q2, 1) + ' M$ (+51 %), prévision annuelle relevée, mais seulement ' + fr(X.nnQ3[0], 0) + ' à ' + fr(X.nnQ3[1], 0) + ' M$ attendus au troisième trimestre et environ ' + fr(X.nnQ4mid, 0) + ' M$ au quatrième. Ce chiffre, l’ARR, fait l’objet de demandes d’information du ministère de la Justice et de la SEC. À ' + usd(close) + ', la valeur d’entreprise vaut ' + fr(X.evRev, 1) + ' fois les revenus. Rien à acheter au cours actuel : ordre sur repli à ' + entryTxt + ' à partir du 29 octobre, stop sous ' + stopLvl + ', vente au plus tard le 16 novembre, avant Palo Alto et avant les résultats de la société.',
    whyBuy: [
      'La croissance récurrente accélère : ' + fr(NNARR_Q2, 1) + ' M$ de net new ARR au deuxième trimestre, un record en hausse de 51 %, et plus de 2,29 Md$ d’ARR chez les clients passés à l’offre groupée Falcon Flex (+101 %).',
      'La direction a relevé le 26 août de 630 points de base, à +34 %, la croissance du net new ARR visée sur l’exercice : 5 991,1 à 6 011,1 M$ de revenus et un ARR de 6 603,0 à 6 611,9 M$ fin janvier.',
      'Un bilan sans dette nette : ' + fr(G$.cash / 1e9, 2) + ' Md$ de trésorerie au 31 juillet contre ' + fr(c.g.ltDebt.value / 1e9, 2) + ' Md$ d’obligations à 3,00 % échéance 2029, ' + fr(X.fcf / 1e9, 2) + ' Md$ de flux de trésorerie libre sur douze mois, et aucun client ni partenaire à 10 % des revenus.',
      'La tendance de fond tient : clôture au-dessus des moyennes exponentielles à vingt (' + usd(tech.ema20) + '), cinquante (' + usd(tech.ema50) + ') et deux cents séances (' + usd(tech.ema200) + '), ' + sgn(r63, 0) + ' en trois mois, et une correction d’octobre arrêtée à ' + usd(lowOct) + '.'],
    whyAvoid: [
      'Le prix suppose une exécution parfaite : ' + fr(X.evRev, 1) + ' fois les revenus GAAP des douze derniers mois, contre ' + fr(X.pv.PANW, 1) + ' fois pour Palo Alto Networks, ' + fr(X.pv.NET, 1) + ' fois pour Cloudflare et ' + fr(X.medPeers, 1) + ' fois en médiane pour six pairs de sécurité (statistiques relevées le 27 octobre).',
      'Le titre suit son secteur, et le suit mal : corrélation de ' + fr(M.CIBR.correlation, 2) + ' avec le panier CIBR depuis le 9 février, mais ' + sgn(w6.CRWD, 1) + ' depuis le 6 octobre contre ' + sgn(w6.CIBR, 1) + ' pour CIBR et ' + sgn(w6.ZS, 1) + ' pour Zscaler.',
      'L’intelligence artificielle est aussi une menace : l’annonce de Claude Code Security par Anthropic a coûté ' + fr(Math.abs(c0220), 1) + ' % le 20 février puis ' + fr(Math.abs(c0223), 1) + ' % le 23, jusqu’au plus bas de l’année (' + usd(lo) + ') ; la rumeur OpenAI, ' + fr(Math.abs(c1014), 1) + ' % le 14 octobre.',
      'L’ARR fait l’objet de demandes d’information du ministère de la Justice et de la SEC sur la comptabilisation des revenus et la déclaration de l’ARR de certaines transactions (10-Q, note 11) ; le procès de Delta sur l’incident du 19 juillet 2024 est en phase de preuves.',
      'La dilution ne se limite pas à la rémunération en actions (' + fr(X.sbc / 1e9, 2) + ' Md$ sur douze mois, ' + fr(X.sbc / X.fcf * 100, 0) + ' % du flux libre) : 2 118 022 actions émises le 8 septembre pour XM Cyber, revendables, et une réserve S-8 d’environ ' + fr(X.s8post / 1e6, 1) + ' millions d’actions en base ajustée.',
      'Les dirigeants vendent par plans programmés : ' + nb(I.podbere.shares) + ' actions pour environ ' + fr(I.podbere.usd / 1e6, 0) + ' M$ cédées par le directeur financier le 24 septembre, au lendemain du record de clôture, et ' + nb(K144.shares) + ' actions déclarées à vendre par le directeur général d’ici mi-janvier.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, déjà ajustée du fractionnement de quatre pour une du 1er juillet ; aucune séance manquante face au panier QQQ.', action: 'Niveaux et indicateurs calculés sur cette seule série.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Rebond de ' + fr(r5, 0) + ' % en cinq séances', evidence: 'Clôture à ' + usd(close) + ', ' + fr(pct(close, tech.ema20), 1) + ' % au-dessus de la moyenne exponentielle à vingt séances, après ' + sgn(c1023, 1) + ' le 23 octobre sur ' + fr(bar('2026-10-23')[5] / 1e6, 1) + ' millions d’actions ; le bêta au panier CIBR rend compte de ' + fr(sector5, 1) + ' points des ' + fr(r5, 1) + ' de la semaine.', action: 'Aucun achat au cours actuel ; ordre limité à ' + entryTxt + ' à partir du 29 octobre, après les résultats de Fortinet et de Microsoft.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Pairs le 28 octobre, Palo Alto le 19 novembre', evidence: 'Fortinet, Microsoft et Tenable publient le 28 octobre, Palo Alto le 19 novembre, Zscaler le 24, CrowdStrike le ' + eDate + ' (une seule source chacun, non confirmées) ; CrowdStrike a publié son troisième trimestre le 26 novembre 2024 et le 2 décembre 2025.', action: 'Vente au plus tard à la clôture du lundi 16 novembre.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger CrowdStrike', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-10-28', to: '2026-10-29', label: 'Fenêtre clé · Fed le 28 à 19 h, réaction aux pairs le 29' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, multiples des logiciels', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'strong', label: 'Fortinet', detail: 'budgets de sécurité', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Microsoft', detail: 'Defender, Azure', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'plan', impact: 'medium', label: 'Ordre ouvert', detail: 'achat limité sur repli', icon: 'entry', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'Amazon', detail: 'hébergement', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-02', category: 'earnings', impact: 'medium', label: 'Check Point', detail: 'pare-feu', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-05', category: 'earnings', impact: 'medium', label: 'Cloudflare', detail: 'multiple de croissance', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux longs', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-06', category: 'plan', impact: 'strong', label: 'Fin de l’ordre', detail: 'dernier achat possible', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, logiciels', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Sortie obligatoire', detail: 'clôture, avant Palo Alto', icon: 'exit', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si Fortinet rassure', steps: [{ label: 'Budgets sécurité', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Panier CIBR', category: 'market', icon: 'data', tone: 'up' }, { label: 'CrowdStrike', category: 'earnings', icon: 'company', tone: 'up' }] },
      { title: 'Si un labo d’IA vend de la sécurité', steps: [{ label: 'OpenAI, Anthropic', icon: 'chip' }, { label: 'Panier CIBR', category: 'market', icon: 'data', tone: 'down' }, { label: 'CrowdStrike', category: 'earnings', icon: 'company', tone: 'down' }] },
    ],
    note: 'Hors frise : Palo Alto le 19 novembre, Zscaler le 24, CrowdStrike le 1er décembre (une seule source chacun) ; en 2024, CrowdStrike avait publié le 26 novembre.',
  };
  return save(Object.assign(out, require('./compose-crwd-body.cjs')(c, { w6, beta21, c0220, c0223, B, E, I, X, eDate, stopOrd, stopTxt, stopLvl, capTxt, entryTxt, gateTxt, c26, vol26, avgVol26, c1014, c1016, c1021, c1023, c0914, r5, r21, r63, cibr5, sector5, own5, lowOct, fromLowOct, drawOct, consts: { ARR_Q2, NNARR_Q2, NNARR_Q3FY26, GUIDE_ARR_Q3, GUIDE_ARR_FY, K144, REPO_H1, EARNINGS_SESSIONS } })));
};

module.exports.scenarios = c => {
  const cap = c.cap;
  return [
    { scenario: 'bullish', trigger: 'Fortinet et Microsoft confirment le 28 octobre des budgets de sécurité en hausse, et le titre revient tester ' + usd(c.entry) + ', haut de la base de septembre, sans clôturer sous ' + usd(c.stop) + '.', firstOrder: 'L’ordre s’exécute à ' + usd(c.entry) + ', puis le titre repasse ' + usd(c.lv('r1')) + ' et vise ' + usd(c.tp1) + ', le plus haut du 12 octobre.', secondOrder: 'Le panier de cybersécurité entier reprend, Zscaler et Okta en tête, comme le 23 octobre.', confirmation: 'Une clôture au-dessus de ' + usd(c.tp1) + ' avec le panier CIBR en hausse le même jour.', contradiction: 'Une hausse de CrowdStrike seul pendant que le panier CIBR recule.' },
    { scenario: 'mixed', trigger: 'Résultats des pairs sans surprise ; le secteur digère son rebond de fin octobre.', firstOrder: 'Le titre oscille entre ' + usd(c.lv('s1')) + ' et ' + usd(c.lv('r1')) + ' sans revenir à ' + usd(c.entry) + '.', secondOrder: 'L’ordre expire le 6 novembre sans exécution ; aucune perte, aucune position.', confirmation: 'Des clôtures dans cette bande jusqu’au 6 novembre.', contradiction: 'Une sortie franche de la bande, vers le haut ou vers le prix d’achat.' },
    { scenario: 'bearish', trigger: 'Fortinet déçoit, ou un laboratoire d’intelligence artificielle annonce une offre de sécurité, ou les taux remontent après la Fed.', firstOrder: 'Clôture sous ' + usd(c.stop) + ', plus bas du 23 octobre : l’ordre est annulé avant d’avoir servi, ou la position sort au stop.', secondOrder: 'Tout le panier rend son rebond, les petits pairs plus vite que les leaders, comme le 16 octobre.', confirmation: 'Une clôture sous ' + usd(c.abandon) + ', le plus bas du 20 octobre, avec le panier CIBR en baisse.', contradiction: 'Un plus bas en séance sous ' + usd(c.stop) + ' repris à la clôture.' }];
};

module.exports.contradictions = c => {
  const b = base(c), X = numbers(c);
  const r5 = c.ret(5), sector5 = c.M.CIBR.beta * c.M.CIBR.return5d;
  return [
    'Le trimestre est un record et la prévision annuelle a été relevée à +34 % de net new ARR, mais le troisième trimestre n’en attend que ' + c.fr(X.nnQ3[0], 0) + ' à ' + c.fr(X.nnQ3[1], 0) + ' M$ (' + sgn(X.nnQ3g[0], 0) + ' à ' + sgn(X.nnQ3g[1], 0) + ', face à un troisième trimestre 2025 qui avait gagné 73 %) : l’effort repose sur un quatrième trimestre à environ ' + c.fr(X.nnQ4mid, 0) + ' M$.',
    (() => { const w = (sym) => { const x = sym === 'CRWD' ? c.bars : b.cmp.find(z => z.symbol === sym).bars; return c.pct(x.find(z => z[0] === c.REF)[4], x.find(z => z[0] === '2026-10-06')[4]); }; return 'Le rebond de cinq séances est sectoriel (' + sgn(r5, 1) + ', dont ' + c.fr(sector5, 1) + ' points rendus par le bêta au panier CIBR), mais sur vingt et une séances le titre a fait ' + sgn(c.ret(21), 1) + ' quand ce bêta annonçait ' + sgn(c.M.CIBR.beta * c.M.CIBR.return21d, 1) + ' ; depuis le 6 octobre, ' + sgn(w('CRWD'), 1) + ' contre ' + sgn(w('CIBR'), 1) + ' pour CIBR, ' + sgn(w('BUG'), 1) + ' pour BUG et ' + sgn(w('ZS'), 1) + ' pour Zscaler.'; })(),
    (() => { const I = insiderSales(c); return 'La société a racheté ses actions à ' + usd(X.repoAvg) + ' en moyenne au premier trimestre (base ajustée), puis plus rien au deuxième, 1,3 Md$ restant autorisés ; son directeur général vendait encore entre ' + usd(I.kOctLo) + ' et ' + usd(I.kOctHi) + ' du 15 au 22 octobre.'; })(),
    'Le même récit porte et frappe le titre : les mises en garde de deux patrons de laboratoires d’intelligence artificielle l’ont fait gagner ' + c.fr(b.chg('2026-09-14'), 1) + ' % le 14 septembre ; Claude Code Security, d’Anthropic, lui a fait perdre ' + c.fr(Math.abs(b.chg('2026-02-20')), 1) + ' % le 20 février et ' + c.fr(Math.abs(b.chg('2026-02-23')), 1) + ' % le 23, la rumeur OpenAI ' + c.fr(Math.abs(b.chg('2026-10-14')), 1) + ' % le 14 octobre.'];
};

module.exports.missingData = () => [
  'Chaîne d’options relevée marché fermé, non retenue ; aucun mouvement implicite aux résultats, la publication étant hors de la fenêtre de quatorze jours.',
  'Formulaires 4 : couverture officielle incomplète ; les ventes du directeur général du 1er au 14 octobre ne sont connues que par la liste de l’avis 144.',
  'Date des résultats du troisième trimestre connue par une seule source, non confirmée par la société.',
  'Statistiques et multiples des pairs relevés en instantané le 27 octobre, sans historique daté.',
  'Contenu de l’enquête d’Evercore ISI et de la rumeur OpenAI connu par la presse financière citée, pas par un document primaire.',
  'Prix total payé pour les actifs de XM Cyber (145,0 M$ annoncés au 10-Q, plus des actions en nombre fixé à la clôture) non publié dans un dépôt postérieur au 8 septembre ; seules les 2 118 022 actions émises le sont.',
  'Issue du procès de Delta et des demandes du ministère de la Justice et de la SEC non chiffrée par la société ; aucune provision lue dans les pièces ouvertes.',
  'Dates de résultats de Palo Alto (19 novembre) et Zscaler (24 novembre) lues dans leurs blocs calendrier, une seule source chacune.'];

module.exports.base = base;
module.exports.numbers = numbers;
