'use strict';
// Rédaction du dossier Hewlett Packard Enterprise (HPE) du 27 octobre 2026. Toute valeur de marché est recalculée depuis
// les barres certifiées et les artefacts collectés ; les chiffres d'entreprise viennent des dépôts SEC ouverts
// (static-hpe.cjs) et des données XBRL officielles ; les motifs de la dégradation de Barclays viennent de la presse citée.

function base(c) {
  const { pct, bars, N, close } = c;
  const cmp = c.raw.comparison_bars.data.items[0].results[0].data;
  const bar = d => { const b = bars.find(x => x[0] === d); if (!b) throw Error('barre absente ' + d); return b; };
  const chg = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('variation absente ' + d); return pct(bars[i][4], bars[i - 1][4]); };
  const gapOf = d => { const i = bars.findIndex(b => b[0] === d); if (i < 1) throw Error('écart absent ' + d); return pct(bars[i][1], bars[i - 1][4]); };
  const row = sym => { const r = cmp.find(x => x.symbol === sym); if (!r) throw Error('comparable absent ' + sym); return r.bars; };
  const dr = (sym, d) => { const b = row(sym), i = b.findIndex(x => x[0] === d); if (i < 1) throw Error('barre absente ' + sym + ' ' + d); return pct(b[i][4], b[i - 1][4]); };
  const span = (sym, d0, d1) => { const b = row(sym), a = b.find(x => x[0] === d0), z = b.find(x => x[0] === d1); if (!a || !z) throw Error('fenêtre absente ' + sym); return pct(z[4], a[4]); };
  const win = bars.slice(Math.max(0, N - 251), N + 1);
  let hi = -1, lo = 1e9, hiD, loD;
  for (const b of win) { if (b[2] > hi) { hi = b[2]; hiD = b[0]; } if (b[3] < lo) { lo = b[3]; loD = b[0]; } }
  if (hiD !== '2026-10-09' || loD !== '2026-02-24') throw Error('bornes annuelles inattendues ' + hiD + ' ' + loD);
  const med = a => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const avgVol = (from, n) => { const i = bars.findIndex(b => b[0] === from); return bars.slice(i - n, i).reduce((s, b) => s + b[5], 0) / n; };
  // Pire écart d'ouverture sur un an (ouverture / clôture de la veille), et les trois plus forts.
  const gaps = []; for (let i = Math.max(1, N - 251); i <= N; i++) gaps.push([bars[i][0], pct(bars[i][1], bars[i - 1][4])]);
  gaps.sort((x, y) => x[1] - y[1]);
  const ytdBase = bars.filter(b => b[0] < '2026-01-01').at(-1);
  return { cmp, bar, chg, gapOf, dr, span, hi, hiD, lo, loD, med, avgVol, gaps, ytdBase, fromHi: Math.abs(pct(close, hi)) };
}

// Les nombres d'entreprise utilisés dans plusieurs sections, calculés une fois.
function figures(c) {
  const { G$, g, close, marketCap, ev, peerStat } = c;
  const evEbitda = ev / G$.ebitda, evRev = ev / G$.rev;
  const niX = G$.ni - (444e6 - 118e6), peX = marketCap / niX, peTtm = marketCap / G$.ni;
  const eps26 = (3.75 + 3.85) / 2, pe26 = close / eps26, pe27lo = close / (eps26 * 1.20), pe27hi = close / (eps26 * 1.16);
  // Quatrième trimestre 2025 = exercice 2025 − neuf mois 2025 (parts XBRL de la somme glissante).
  const part = (k, s, e) => { const p = g[k].parts.find(x => x.start === s && x.end === e); if (!p) throw Error('part XBRL absente ' + k + ' ' + s + ' ' + e); return p.value; };
  const q4Rev = part('rev', '2024-11-01', '2025-10-31') - part('rev', '2024-11-01', '2025-07-31');
  const q4Ebit = part('ebit', '2024-11-01', '2025-10-31') - part('ebit', '2024-11-01', '2025-07-31');
  const ebit9m = part('ebit', '2025-11-01', '2026-07-31');
  const q4Lo = (13.9e9 / q4Rev - 1) * 100, q4Hi = (14.8e9 / q4Rev - 1) * 100;
  const peers = ['DELL', 'SMCI', 'CSCO', 'NTAP', 'IBM', 'HPQ'], pv = Object.fromEntries(peers.map(t => [t, peerStat(t, 'enterpriseToEbitda')]));
  const asmMed = (pv.DELL + pv.SMCI) / 2, MB = 13.8;
  if (Math.abs(asmMed - MB) > 0.05) throw Error('médiane des assembleurs inattendue ' + asmMed);
  const perShareAt = (m, lossUsd = 0) => (m * (G$.ebitda - lossUsd) - G$.debt + G$.cash) / c.shares;
  const netLev = (G$.debt - G$.cash) / G$.ebitda;
  const common = 1327464779, prefConv = 30e6 * 2.5352;
  const warrantPct = 4156466 / common * 100, prefPct = prefConv / common * 100, sipPct = 22e6 / common * 100;
  const capCommon = close * common, buybackPct = 3.2e9 / capCommon * 100;
  // Résultat des segments au troisième trimestre (10-Q, tableau des segments, M$) : 2026 et 2025.
  const seg = { net: 637, cai: 1539, total: 2109, net0: 365, cai0: 504, total0: 850, cai9: 3138, cai9p: 1465 };
  const caiShare = seg.cai / (seg.cai + seg.net) * 100, caiDeltaShare = (seg.cai - seg.cai0) / (seg.total - seg.total0) * 100;
  const caiGain9 = (seg.cai9 - seg.cai9p) * 1e6;
  // Flux libre : au moins 3,75 Md$ sur l'exercice, 2 581 M$ sur neuf mois ; au moins 75 % du quatrième trimestre rendu.
  const q4Return = (3.75e9 - 2581e6) * 0.75;
  return { evEbitda, evRev, niX, peX, peTtm, eps26, pe26, pe27lo, pe27hi, q4Rev, q4Ebit, ebit9m, q4Lo, q4Hi, pv, asmMed, MB, perShareAt, netLev, common, prefConv, warrantPct, prefPct, sipPct, buybackPct, capCommon, seg, caiShare, caiDeltaShare, caiGain9, q4Return, opm: G$.ebit / G$.rev * 100 };
}

module.exports = (c, save) => {
  const { fr, usd, pct, sgn, close, prev, bars, N, tech, st, M, marketCap, scn, lv, entry, stop, tp1, tp2, abandon, cap, raw, dfr, nb } = c;
  const B = base(c), F = figures(c);
  const trig = (Math.floor(entry * 100 + 1e-9) + 1) / 100, trigTxt = usd(trig);
  const stopOrd = Math.floor(stop * 100 + 1e-9) / 100, stopTxt = usd(stopOrd);
  const abTxt = usd(abandon);
  const c26 = pct(close, prev), vol26 = bars[N][5], avgVol26 = B.avgVol(bars[N][0], 20);
  const crash = B.span('DELL', '2026-10-09', '2026-10-16'), crashS = B.span('SMCI', '2026-10-09', '2026-10-16');
  const crashH = pct(B.bar('2026-10-16')[4], B.bar('2026-10-09')[4]);
  const runUp = B.hi / B.lo;
  // Chronologie de la chute : deux séances avant la dégradation de Barclays (12 et 13 octobre), puis la suite.
  const c13 = B.bar('2026-10-13')[4], preB = pct(c13, B.bar('2026-10-09')[4]), postB = pct(B.bar('2026-10-16')[4], c13);
  const out = {
    meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'tech', 'ai', 'hardware', 'trade-idea'], grade: 'C', date: '2026-10-27', dateDisplay: '27 octobre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: c.REF,
      description: 'HPE a perdu ' + fr(Math.abs(crashH), 0) + ' % du 9 au 16 octobre, dont ' + fr(Math.abs(postB), 0) + ' % depuis la veille de la dégradation de Barclays : la mémoire fait l’essentiel de ses profits. Achat seulement sur une clôture à ' + trigTxt + ' ou plus du 4 au 16 novembre ; tout vendu le 30.',
      ogDescription: 'HPE à ' + usd(close) + ' : ' + sgn(crashH, 0) + ' du 9 au 16 octobre, dont ' + sgn(postB, 0) + ' depuis la veille de Barclays. Achat seulement après une clôture à ' + trigTxt + ' ou plus, stop ' + stopTxt + '.',
      lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
      statusHistory: [...(c.archive.meta.statusHistory || []), { at: raw.status.captured_at, from: 'stopped', to: 'watch', note: 'refonte du 27 octobre 2026 sur la clôture du 26 octobre : nouveau plan, activation sur une clôture à ' + trigTxt + ' ou plus entre le 4 et le 16 novembre, aucune entrée', close }] },
    header: { ticker: 'HPE', name: 'Hewlett Packard Enterprise Company', exchange: 'NYSE', sector: 'Serveurs, réseau, stockage et financement d’équipements', price: close, changePct: c26,
      badges: [{ text: 'SURVEILLER — ACHAT SEULEMENT APRÈS UNE CLÔTURE À ' + fr(trig, 2) + ' $ OU PLUS', color: 'blue' }, { text: 'Profits portés par la mémoire', color: 'amber' }, { text: 'Réseau Juniper : marge stable', color: 'purple' }],
      metrics: { marketCap: fr(F.capCommon / 1e9, 1) + ' Md$', volume: fr(vol26 / 1e6, 2) + ' M', evEbitda: fr(F.evEbitda, 1) + '×' }, halalStatus: 'unknown' },
  };
  out.verdict = { score: 43, conviction: 'Low', bias: 'Neutral',
    confidence: 'Note C (score additif de 43 sur 100) : la grille crédite un trimestre record, un réseau relevé pour 2027 et un prix redevenu modéré, puis retranche une technique cassée, des profits que la mémoire porte pour l’essentiel, 30,4 Md$ d’engagements d’achat fermes et un calendrier chargé de résultats de pairs. Score éditorial non prédictif. Chiffres d’entreprise lus dans les dépôts SEC et les données XBRL officielles ; niveaux lus sur la clôture certifiée du 26 octobre.',
    summary: 'Hewlett Packard Enterprise vend des serveurs, du stockage et, depuis le rachat de Juniper en juillet 2025, du réseau. Le titre a été multiplié par ' + fr(runUp, 1) + ' entre son plus bas du 24 février (' + usd(B.lo) + ') et le 9 octobre (' + usd(B.hi) + ' en séance), puis a perdu ' + fr(Math.abs(crashH), 0) + ' % en cinq séances : ' + fr(Math.abs(preB), 1) + ' % les 12 et 13 octobre, avec le matériel d’IA, puis ' + fr(Math.abs(postB), 1) + ' % après la dégradation de Barclays du 14, qui visait aussi Dell et NetApp. Le 10-Q dit pourquoi : les serveurs ont progressé de 35,3 % « surtout grâce au prix moyen de vente », tiré par la mémoire et les SSD, et le segment Cloud et IA apporte ' + fr(F.caiDeltaShare, 0) + ' % de la hausse du résultat des segments. Le réseau ne compense pas : sa marge est stable à 22,0 %. À ' + usd(close) + ', le titre vaut ' + fr(F.pe26, 1) + ' fois le bénéfice ajusté visé pour 2026. Achat seulement sur une clôture à ' + trigTxt + ' ou plus entre le 4 et le 16 novembre, après les résultats de Super Micro, Arista et AMD ; tout vendre le 30 novembre, avant des résultats que la société n’a pas encore datés.',
    whyBuy: [
      'Un trimestre record : 12,2 Md$ de chiffre d’affaires (+34 %), marge opérationnelle GAAP de 11,4 % (+8,7 points), carnet de commandes record ; la prévision du quatrième trimestre, 13,9 à 14,8 Md$, représente ' + sgn(F.q4Lo, 0) + ' à ' + sgn(F.q4Hi, 0) + ' sur un an.',
      'Le réseau grandit : 2,9 Md$ au troisième trimestre (+74,9 %, Juniper compris) ; le 30 septembre, la société a relevé sa croissance de 2027, vise une marge du milieu au haut des vingt pour cent, contre 22,0 % aujourd’hui, et 800 M$ d’économies Juniper par an d’ici fin 2028.',
      'Un prix redevenu raisonnable : ' + fr(F.pe26, 1) + ' fois le bénéfice ajusté visé pour 2026 (3,75 à 3,85 $), ' + fr(F.pe27lo, 1) + ' à ' + fr(F.pe27hi, 1) + ' fois celui de 2027 si le cadre de +16 à +20 % tient ; EV/EBITDA GAAP de ' + fr(F.evEbitda, 1) + '×, entre Super Micro (' + fr(F.pv.SMCI, 1) + '×) et Dell (' + fr(F.pv.DELL, 1) + '×), sur des bases de calcul différentes.',
      'Une baisse de secteur plus que de société : du 9 au 16 octobre, HPE ' + sgn(crashH, 1) + ', Dell ' + sgn(crash, 1) + ', Super Micro ' + sgn(crashS, 1) + ' ; Barclays a gardé ses estimations et n’a réduit que le multiple, et au moins ' + fr(F.q4Return / 1e9, 2) + ' Md$ doivent revenir aux actionnaires au quatrième trimestre si la prévision de flux libre tient.'],
    whyAvoid: [
      'La mémoire fait les profits, pas seulement le chiffre : au troisième trimestre, le segment Cloud et IA a dégagé 1 539 M$ de résultat contre 637 M$ pour le réseau, et ' + fr(F.caiDeltaShare, 0) + ' % de la hausse du résultat des segments ; son coût des ventes n’a monté que de 5,9 % pour un chiffre d’affaires en hausse de 25,4 %.',
      'Des achats engagés au prix de la pénurie : engagements d’achat fermes de 30,4 Md$ au 31 juillet contre 3,3 Md$ en octobre 2025, stocks de 11,8 Md$ contre 6,4 Md$, fournisseurs de 13,7 Md$ contre 7,7 Md$.',
      'La société prévoit elle-même une compression : marge opérationnelle ajustée de 14 à 15 % visée pour 2027, contre 16,2 % au troisième trimestre ; la marge du réseau recule sur neuf mois (22,4 % contre 25,1 %).',
      'Une technique cassée : clôture sous la moyenne à vingt séances (' + usd(tech.ema20) + '), RSI à ' + fr(tech.rsi14, 0) + ', et une variation moyenne de ' + usd(tech.atr14) + ' par séance, ' + fr(tech.atr14 / close * 100, 1) + ' % du cours.',
      'Un calendrier serré : Super Micro, Arista et AMD le 3 novembre, Cisco le 12, Nvidia le 17 et Dell fin novembre (dates d’une seule source), puis les résultats de HPE, que la société n’a pas encore datés.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances certifiées', evidence: 'Série quotidienne certifiée au 26 octobre, sans séance manquante ; niveaux et indicateurs calculés sur cette seule série.', action: 'Aucune.' },
      { label: 'Capital et dilution', status: 'warn', statusLabel: 'Préférentielles et bon Oracle', evidence: '76,1 millions d’actions à naître des préférentielles le 1er septembre 2027 (' + fr(F.prefPct, 1) + ' % de plus), déjà comptées dans le bénéfice dilué ; 4 156 466 au plus pour Oracle (' + fr(F.warrantPct, 2) + ' %) ; 22 millions réservées aux salariés ; aucune émission d’actions au fil de l’eau.', action: 'Valeur d’entreprise calculée sur 1 403,5 millions d’actions ; capitalisation affichée sur les 1 327,5 millions d’actions ordinaires.' },
      { label: 'Point d’entrée', status: 'fail', statusLabel: 'Sous la base, résultats de pairs à venir', evidence: 'Clôture à ' + usd(close) + ' (' + sgn(c26, 1) + '), sous la moyenne à vingt séances (' + usd(tech.ema20) + ') ; ' + fr(vol26 / 1e6, 1) + ' millions d’actions échangées, ' + fr(vol26 / avgVol26, 1) + ' fois la moyenne des vingt séances précédentes : la hausse du 26 s’est faite sans volume.', action: 'Aucun achat avant une clôture à ' + trigTxt + ' ou plus, et pas avant celle du 4 novembre.' }] };
  out.timeline = {
    title: 'Ce qui peut bouger HPE', from: '2026-10-27', to: '2026-11-16',
    keyWindow: { from: '2026-11-03', to: '2026-11-04', label: 'Fenêtre clé · Super Micro, Arista, AMD : mar. 3 après 22 h → clôture du 4' },
    events: [
      { date: '2026-10-28', category: 'macro', impact: 'strong', label: 'Fed', detail: '19 h, taux', icon: 'bank', source: 'data/scheduled-events.json (fomc), calendrier de la Réserve fédérale', href: '#macro' },
      { date: '2026-10-28', category: 'earnings', impact: 'medium', label: 'Extreme', detail: 'réseau de campus', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-10-29', category: 'earnings', impact: 'medium', label: 'SanDisk, Intel', detail: 'SSD, processeurs', icon: 'chip', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source' },
      { date: '2026-11-03', category: 'earnings', impact: 'medium', label: 'Super Micro', detail: 'avec Arista et AMD', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables collecté, une seule source', href: '#blast-radius' },
      { date: '2026-11-04', category: 'plan', impact: 'strong', label: 'Activation possible', detail: 'clôture ≥ ' + fr(trig, 2) + ' $', icon: 'entry', source: 'plan de la fiche', href: '#trade' },
      { date: '2026-11-06', category: 'macro', impact: 'medium', label: 'Emploi US', detail: 'taux', icon: 'data', source: 'daily/20261022/primary-reference.json (bls_empsit), calendrier du BLS' },
      { date: '2026-11-10', category: 'macro', impact: 'strong', label: 'CPI US', detail: 'taux, technologie', icon: 'data', source: 'data/scheduled-events.json (cpi), calendrier du BLS' },
      { date: '2026-11-12', category: 'earnings', impact: 'medium', label: 'Cisco', detail: 'réseau', icon: 'company', uncertain: true, source: 'calendrier de résultats des comparables, une seule source' },
      { date: '2026-11-13', category: 'macro', impact: 'medium', label: 'PPI US', icon: 'data', source: 'data/scheduled-events.json (ppi), calendrier du BLS' },
      { date: '2026-11-16', category: 'plan', impact: 'strong', label: 'Dernière activation', detail: 'clôture du 16', icon: 'hourglass', source: 'plan de la fiche', href: '#trade' },
    ],
    chains: [
      { title: 'Si la mémoire se détend', steps: [{ label: 'Prix de la mémoire', icon: 'chip', tone: 'down' }, { label: 'Prix des serveurs', category: 'earnings', icon: 'company', tone: 'down' }, { label: 'Chiffre d’affaires HPE', category: 'earnings', icon: 'data', tone: 'down' }] },
      { title: 'Si les pairs rassurent', steps: [{ label: 'Super Micro, Arista', category: 'earnings', icon: 'company', tone: 'up' }, { label: 'Serveurs d’IA', category: 'earnings', icon: 'chip', tone: 'up' }, { label: 'HPE', category: 'earnings', icon: 'company', tone: 'up' }] },
    ],
    note: 'Activation sur une clôture à ' + trigTxt + ' ou plus, du 4 au 16 novembre. Nvidia (17 nov.), Dell (fin nov.) et la sortie du 30 nov. : au-delà de la frise.',
  };
  return save(Object.assign(out, require('./compose-hpe-body.cjs')(c, { B, F, trig, trigTxt, stopOrd, stopTxt, abTxt, c26, vol26, avgVol26, crash, crashS, crashH, runUp, preB, postB })));
};

module.exports.scenarios = c => {
  const trig = (Math.floor(c.entry * 100 + 1e-9) + 1) / 100, u = c.usd;
  return [
    { scenario: 'bullish', trigger: 'Super Micro et Arista publient le 3 novembre des commandes qui tiennent, et les prix de la mémoire ne reculent pas avant fin novembre.', firstOrder: 'HPE clôture à ' + u(trig) + ' ou plus, au-dessus de la base de sept séances, puis vise ' + u(c.tp1) + ', clôture du 13 octobre, point de départ de la chute.', secondOrder: 'Dell et Super Micro reprennent ensemble ; le marché reconsidère la dégradation de Barclays comme un excès de multiple.', confirmation: 'Une clôture à ' + u(trig) + ' ou plus à partir du 4 novembre ; un volume supérieur à la moyenne des vingt séances la renforce, sans être exigé.', contradiction: 'Une hausse de HPE pendant que Dell et Super Micro reculent : un rebond isolé sans relais du secteur.' },
    { scenario: 'mixed', trigger: 'Des résultats de pairs corrects mais une prudence générale sur la mémoire ; aucune nouvelle propre à HPE avant décembre.', firstOrder: 'Le titre oscille entre ' + u(c.abandon) + ' et ' + u(c.entry) + ', la base de sept séances, sans en sortir.', secondOrder: 'Les rachats d’actions (3,2 Md$ d’autorisation restante) soutiennent le cours sans le relancer.', confirmation: 'Des clôtures dans cette bande jusqu’au 16 novembre, puis l’expiration du plan.', contradiction: 'Une sortie franche de la bande, d’un côté ou de l’autre, en clôture.' },
    { scenario: 'bearish', trigger: 'SanDisk, Micron ou un assembleur annonce des prix moyens en baisse ou une marge de serveurs en recul, ou un autre analyste reprend l’argument de Barclays.', firstOrder: 'Clôture sous ' + u(c.abandon) + ', plancher de la base : le plan est abandonné et le titre cherche ' + u(c.lv('s2')) + ', plus bas du 2 septembre.', secondOrder: 'Les fournisseurs de mémoire et de SSD baissent avec les assembleurs ; le réseau, moins exposé, résiste mieux.', confirmation: 'Une clôture sous ' + u(c.abandon) + ' ; un volume supérieur à la moyenne la renforce, sans être exigé.', contradiction: 'Un plus bas en séance sous ' + u(c.abandon) + ' sans clôture dessous, suivi d’une reprise rapide.' }];
};

module.exports.contradictions = c => {
  const B = base(c), crashH = c.pct(B.bar('2026-10-16')[4], B.bar('2026-10-09')[4]);
  const preB = c.pct(B.bar('2026-10-13')[4], B.bar('2026-10-09')[4]);
  return [
    'La chute a commencé avant Barclays : ' + c.sgn(preB, 1) + ' les 12 et 13 octobre, avec Super Micro ' + c.sgn(B.span('SMCI', '2026-10-09', '2026-10-13'), 1) + ' et Micron ' + c.sgn(B.span('MU', '2026-10-09', '2026-10-13'), 1) + ' sur les mêmes séances. La note du 14 a amplifié un repli du matériel d’IA déjà engagé ; elle ne l’a pas déclenché.',
    'Les comptes battent des records pendant que le cours recule : chiffre d’affaires +34 %, prévisions 2026 et 2027 relevées le 2 septembre, réseau relevé le 30 septembre, et pourtant ' + c.sgn(crashH, 1) + ' du 9 au 16 octobre. Le marché ne conteste pas le niveau de la croissance, il en conteste la nature.',
    'La chute est sectorielle : Dell ' + c.sgn(B.span('DELL', '2026-10-09', '2026-10-16'), 1) + ', Super Micro ' + c.sgn(B.span('SMCI', '2026-10-09', '2026-10-16'), 1) + ', Ciena ' + c.sgn(B.span('CIEN', '2026-10-09', '2026-10-16'), 1) + ' sur la même fenêtre, quand IBM fait ' + c.sgn(B.span('IBM', '2026-10-09', '2026-10-16'), 1) + '. Barclays a gardé ses estimations et n’a baissé que son multiple : c’est une révision du prix payé, pas des chiffres.',
    'Les ventes des dirigeants ne disent rien du cours : les 500 000 actions du directeur général relèvent d’un plan adopté le 4 juin, à 53,69 $, et celles du patron du réseau d’un plan du 30 juin. Le seul fait qui pèse : aucun dirigeant n’a acheté après une baisse d’un quart.',
    'NetApp, dégradé par Barclays le même jour que HPE et Dell (' + c.sgn(B.dr('NTAP', '2026-10-14'), 1) + ' le 14), fait ' + c.sgn(c.M.NTAP.return21d, 1) + ' sur vingt et une séances quand HPE fait ' + c.sgn(c.ret(21), 1) + ' : la note n’a pas pesé de la même façon sur tout le groupe qu’elle visait.',
    'Oracle, seul client coté nommé, détient un bon de souscription d’actions HPE acquis selon ses achats de réseau : un succès commercial, et une remise payée en actions dont le 10-Q ne chiffre pas l’effet.'];
};

module.exports.missingData = c => [
  'Croissance du réseau hors Juniper non isolée : le 10-Q attribue la hausse de 74,9 % « surtout » au chiffre d’affaires de Juniper.',
  'Part de la hausse des serveurs due au prix de la mémoire, contre celle due aux volumes, non chiffrée par la société.',
  'Date des résultats du quatrième trimestre non annoncée par la société (4 décembre l’an dernier) ; prévision détaillée de 2027 attendue avec eux.',
  'Paliers d’achats d’Oracle qui déclenchent les tranches du bon de souscription non publiés, aucune tranche publiée comme acquise ; effet sur le chiffre d’affaires de cette rémunération en actions d’un client (norme de mai 2025) non chiffré par le 10-Q.',
  'Série FINRA des positions vendeuses lue dans la collecte complémentaire du run, non certifiée comme source exigée.',
  'Statistiques des pairs relevées en instantané, sans historique daté ; dates de résultats des pairs d’une seule source.',
  'Chaîne d’options relevée marché fermé, sans intérêt ouvert exploitable ; couverture officielle des formulaires 4 incomplète, compensée par l’ouverture directe des dépôts.',
  'Motifs de la dégradation de Barclays connus par la presse financière citée, pas par la note elle-même.'];

module.exports.base = base;
module.exports.figures = figures;
