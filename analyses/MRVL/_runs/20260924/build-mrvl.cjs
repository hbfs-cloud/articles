'use strict';
// Dossier MRVL v3 au close du 2026-09-23. Écrit le JSON canonique, le sidecar de preuves, les
// artefacts de calcul et un aperçu LOCAL. Ne touche ni analyses/MRVL/index.html ni l'index du site.
const K = require('../../../../tools/lib/analysis-v3-kit.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at, frDate } = K;
const T = 'MRVL', REF = '2026-09-23';
const run = 'analyses/MRVL/_runs/20260924', data = run + '/_data', rev = run + '/revision', prim = 'analyses/MRVL/_primary';
const OUT_JSON = 'data/analyses-data/MRVL.json', OUT_EVIDENCE = 'data/analyses-evidence/MRVL.json', GEN = run + '/build-mrvl.cjs';

// ---------------------------------------------------------------- données collectées
const raw = K.loadRun(data, ['bars', 'fundamentals', 'comparison_bars', 'comparison_client_bars', 'rank_beta', 'status', 'insiders', 'comparison_earnings', 'sec_evidence']);
const S = K.mainSeries(raw.bars, T, REF), { bars, N, B, idx, close, prev } = S;
const tech = K.technicals(bars);
const STP = findPath(raw.fundamentals, 'instrument_comprehensive_stats'), st = at(raw.fundamentals, STP);
const TXP = findPath(raw.insiders, 'instrument_insider_transactions'), tx = at(raw.insiders, TXP);
const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
const C = t => { const i = cmpRows.findIndex(x => x.symbol === t); if (i < 0) throw Error('comparable absent ' + t); return '/data/items/0/results/0/data/' + i + '/bars'; };
const { M, firstCommon } = K.comparables(cmpRows, bars);
const adv = K.dollarAdv(bars), ret = k => pct(close, bars[N - k][4]);
const archive = read(run + '/original/MRVL.json');
const cb = t => cmpRows.find(x => x.symbol === t).bars;
const winRet = (b, d0, d1) => pct(b.find(x => x[0] === d1)[4], b.find(x => x[0] === d0)[4]);
const W = { g819: ['2026-08-18', '2026-08-19'], e828: ['2026-08-27', '2026-08-28'], since: ['2026-08-28', REF] };
const move = Object.fromEntries(Object.entries(W).map(([k, [d0, d1]]) => [k, { MRVL: winRet(bars, d0, d1), SMH: winRet(cb('SMH'), d0, d1), AVGO: winRet(cb('AVGO'), d0, d1), ALAB: winRet(cb('ALAB'), d0, d1) }]));
const junePeak = bars[idx('2026-06-18')][2], julyLow = bars[idx('2026-07-29')][4], atrPct = tech.atr14 / close * 100;

// Formulaires 4 : ventes de marché (S) relevées dans la fenêtre collectée, aucun achat (P).
const sells = tx.transactions.filter(x => x.type_code === 'S'), buys = tx.transactions.filter(x => x.type_code === 'P');
if (buys.length) throw Error('achat d’initié relevé : revoir le texte');
const sOf = n => { const x = sells.find(s => s.insider_name === n); return { ...x, value: x.shares * x.price }; };
const murphy = sOf('MURPHY MATTHEW J'), koop = sOf('Koopmans Chris');

// GAAP douze mois glissants au 01/08/2026 = exercice 2026 (10-K) − S1 FY26 + S1 FY27 (10-Q), en millions.
// Amortissements = dépréciation + amortissement des incorporels acquis.
const K10 = { rev: [8194.6, 3901.4, 5157.1], ebit: [1322.9, 560.7, 799.1], da: [348.6 + 942.0, 168.3 + 489.4, 188.5 + 440.1], ni: [2670.1, 372.7, 342.5], ocf: [1750.5, 794.5, 1244.3], capex: [354.1, 166.3, 282.4] };
const ttm = k => K10[k][0] - K10[k][1] + K10[k][2];
const BAL = { cash: 3932.8, debt: 4962.9, common: 876.9e6, preferredShares: 21.8e6, googleWarrant: 58970907, celestialEarnout: 24.4e6, timeBased: 1360867,
  q2Rev: 2739.3, q2RevPrior: 2006.1, dc: 2171.5, dcPrior: 1490.5, q3Guide: 3150, contingentH1: 433.7, sbcH1: 533.8, dilNow: 921.2, dilPrior: 870.4, gainFY26: 1926.3 };
const G$ = { rev: ttm('rev') * 1e6, ebit: ttm('ebit') * 1e6, ebitda: (ttm('ebit') + ttm('da')) * 1e6, ni: ttm('ni') * 1e6,
  fcf: (ttm('ocf') - ttm('capex')) * 1e6, debt: BAL.debt * 1e6, cash: BAL.cash * 1e6 };
const shares = BAL.common + BAL.preferredShares, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
const potential = BAL.googleWarrant + BAL.preferredShares + BAL.celestialEarnout, dilutionPct = potential / BAL.common * 100;
// Base unique annoncée au lecteur : les 876,9 M d'actions ordinaires au 21 août.
const warrantPct = BAL.googleWarrant / BAL.common * 100, prefPct = BAL.preferredShares / BAL.common * 100, earnPct = BAL.celestialEarnout / BAL.common * 100, fullVestPurchases = 240 * 500e6;
const tranche = (BAL.googleWarrant - BAL.timeBased) / 240, trancheIntrinsic = tranche * (close - 206.58), rebatePct = trancheIntrinsic / 500e6 * 100;
const q3Seq = pct(BAL.q3Guide, BAL.q2Rev), dcShare = BAL.dc / BAL.q2Rev * 100;
const EPS_RUN = 1.10 * 4; // bénéfice ajusté guidé du troisième trimestre, annualisé (hypothèse de lecture, pas une guidance)
const scn = { multiple: ev / G$.ebitda * 0.7, ebitda: G$.ebitda, debt: G$.debt, cash: G$.cash, shares, close };
scn.enterprise_value = scn.multiple * scn.ebitda; scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

// Niveaux lus sur des barres certifiées, par date. Objectifs : plus hauts de fin juin et début juillet.
const L = { trigger: { d: '2026-09-22', c: 2 }, stop: { d: '2026-09-22', c: 3 }, abandon: { d: '2026-09-21', c: 3 },
  s3: { d: '2026-09-18', c: 3 }, r1: { d: '2026-07-01', c: 2 }, r2: { d: '2026-06-30', c: 2 }, r0: { d: '2026-07-02', c: 2 }, r3: { d: '2026-06-18', c: 2 } };
const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
const entry = lv('trigger'), stop = lv('stop'), abandon = lv('abandon');
const tp1 = lv('r1'), tp2 = lv('r2');
const rr1 = (tp1 - entry) / (entry - stop), rr2 = (tp2 - entry) / (entry - stop);
const RR_MIN = 1.5, cap = Math.floor((tp1 + RR_MIN * stop) / (1 + RR_MIN) * 100) / 100, capRr = (tp1 - cap) / (cap - stop);
const sizeExample = Math.floor(100 / (entry - stop)), extension = pct(close, tech.ema20);
const X = K.execStats(bars, entry, cap, tech.atr14), r0 = lv('r0'), rrR0 = (r0 - entry) / (entry - stop), r0OverCap = pct(r0, cap);

// ---------------------------------------------------------------- sources primaires
const EDGAR = 'https://www.sec.gov/Archives/edgar/data/1835632/';
const docs = [
  ['2026-08-27', '8-K / Exhibit 99.1', '0001835632-26-000022', 'q227_8kx812026ex-991.htm', 'q2fy27-ex991.htm',
    'Communiqué du deuxième trimestre de l’exercice 2027 : revenus de 2,739 Md$ (+37 %), centres de données en hausse de 46 %, bénéfice GAAP de 0,33 $ et ajusté de 0,94 $ par action. Prévision de 3,150 Md$ de revenus au troisième trimestre, journée investisseurs annoncée pour le 6 octobre.'],
  ['2026-08-28', '10-Q', '0001835632-26-000025', 'mrvl-20260801.htm', 'q2fy27-10q.htm',
    'Rapport trimestriel : un distributeur, qui revend à des clients finaux variés, écoule 44 % des revenus du trimestre, et un client direct en pèse 16 % ; 876,9 millions d’actions au 21 août ; jusqu’à 24,4 millions d’actions supplémentaires dues au titre de Celestial AI ; 433,7 M$ de réévaluation de ce complément de prix sur le semestre.'],
  ['2026-08-19', '8-K', '0001193125-26-356217', 'd412696d8k.htm', 'aug19-8k.htm',
    'Accord commercial du 29 juillet avec Google pour des puces sur mesure autour de l’écosystème TPU, et bon de souscription de 58 970 907 actions à 206,58 $ émis le 18 août, acquis par tranches liées aux achats de Google jusqu’à l’exercice 2033.'],
  ['2026-03-31', '8-K', '0001193125-26-134462', 'd113606d8k.htm', 'mar31-8k.htm',
    'Émission à NVIDIA de 2 millions d’actions de préférence de série A pour 2 Md$, convertibles au prix initial d’environ 91,84 $ en 21 778 000 actions ordinaires au maximum, sans droit de vote pour l’élection des administrateurs.'],
  ['2026-02-02', '8-K/A', '0001193125-26-032861', 'd45933d8ka.htm', 'feb02-8ka.htm',
    'Clôture de l’acquisition de Celestial AI : 24 601 976 actions émises, et jusqu’à 2,25 Md$ d’actions supplémentaires, valeur à la signature, si Celestial atteint des paliers de revenus cumulés d’ici l’exercice 2029.'],
  ['2026-03-11', '10-K', '0001835632-26-000011', 'mrvl-20260131.htm', 'fy26-10k.htm',
    'Rapport annuel de l’exercice clos le 31 janvier 2026 : revenus de 8,195 Md$, résultat opérationnel GAAP de 1,323 Md$, flux opérationnel de 1,751 Md$ ; le résultat net de 2,670 Md$ inclut 1,926 Md$ d’autres produits.'],
  ['2026-04-15', '8-K', '0001193125-26-157134', 'd123910d8k.htm', 'apr15-8k.htm',
    'Émission de 1 Md$ d’obligations à 5,30 % échéance 2036, destinée notamment au remboursement des obligations à 1,65 % arrivant à échéance en 2026 : la dette est refinancée, plus chère, sans hausse notable du montant.'],
  ['2026-06-11', '8-K', '0001193125-26-267688', 'd151562d8k.htm', 'jun11-8k.htm',
    'Démission du directeur financier Willem Meintjes, sans désaccord déclaré, et nomination de Daniel Durn, ancien directeur financier d’Adobe et jusque-là président du comité d’audit de Marvell, au 15 juin 2026.'],
  ['2026-07-09', '424B7', '0001193125-26-299840', 'd82164d424b7.htm', 'jul09-424b7.htm',
    'Prospectus de revente de 146 504 actions émises lors de l’acquisition de XConn par des actionnaires vendeurs ; Marvell ne reçoit aucun produit et l’effet sur le nombre d’actions est négligeable.'],
  ['2026-08-27', '8-K', '0001835632-26-000022', 'mrvl-20260827.htm', 'q2fy27-8k.htm',
    'Formulaire de couverture du communiqué trimestriel (item 2.02), qui rattache l’Exhibit 99.1 au dépôt du 27 août. Il n’ajoute aucun chiffre, mais date officiellement la publication des résultats et de la prévision.'],
].map(([date, form, accession, file, local, finding]) => ({ date, form, accession, url: `${EDGAR}${accession.replace(/-/g, '')}/${file}`, finding, path: `${prim}/${local}`, sha256: sha(bytes(`${prim}/${local}`)) }));
const needle = (id, i, needles) => { const text = bytes(docs[i].path).toString('utf8'); for (const n of needles) if (!text.includes(n)) throw Error(`needle absent ${id}: ${n}`); return [id, { source_path: docs[i].path, source_sha256: docs[i].sha256, source_needles: needles }]; };
const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: 40, inventory_screened_count: 40, opened_count: docs.length, reviewed_count: docs.length, decision_relevant_count: docs.length, local_primary_count: docs.length,
  review_scope: 'Dépôts EDGAR de Marvell du 1er février au 23 septembre 2026, formulaires de détention des dirigeants exclus. Quarante dépôts inventoriés ; la gouvernance (DEF 14A, DEFA14A, ARS, SD), les S-8, les 13G, les formulaires D, le FWP, les 424B2 et 424B5 repris par le 8-K du 15 avril et les 8-K sans chiffre décisionnel sont écartés.',
  documents: docs,
  semantic_findings: Object.fromEntries([
    needle('q2_results', 0, ['$2.739 billion', '37%', '46%', '$3.150 billion', '$1.10', '$0.94', '$0.33', 'October 6', 'fiscal 2028', '$39.0&#160;million']),
    needle('q2_income', 1, ['2,739.3', '2,006.1', '5,157.1', '3,901.4', '799.1', '560.7', '188.5', '168.3', '440.1', '489.4', '1,244.3', '794.5', '282.4', '166.3', '342.5', '372.7', '921.2', '870.4', '533.8', '433.7']),
    needle('q2_balance', 1, ['3,932.8', '4,962.9', '499.8', '876.9', '24.4 million', '91.84', 'shares authorized', '1.3 billion']),
    needle('q2_concentration', 1, ['Customer A', 'Distributor A', '16%', '44%', '2,171.5', '1,490.5', 'sales to diverse end customers and geographies']),
    needle('google_warrant', 2, ['58,970,907', '$206.58', '1,360,867', '240 equal tranches', '$500&#160;million', 'fiscal year 2033']),
    needle('nvidia_preferred', 3, ['21,778,000', '$91.8355', '$2,000,000,000.00']),
    needle('celestial', 4, ['24,601,976', '$2.25 billion']),
    needle('fy26', 5, ['8,194.6', '1,322.9', '348.6', '942.0', '1,750.5', '354.1', '2,670.1', '1,926.3']),
    needle('notes', 6, ['$1,000,000,000', '5.300%', '1.650%']),
    needle('cfo', 7, ['Daniel Durn', 'Willem Meintjes']),
    needle('xconn', 8, ['146,504', 'XConn']),
    needle('cover_q2', 9, ['2.02']),
  ]) };
write(rev + '/primary-manifest.json', primary);
const ref = i => ({ name: 'Marvell ' + docs[i].form, url: docs[i].url, date: docs[i].date });
const market = name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' });

// ---------------------------------------------------------------- le dossier
const score = { business: 28, technical: 3, capital: 2, calendar: -2, dilution: -5, valuation: -10, risk: 36 };
const scoreValue = Object.values(score).reduce((a, b) => a + b, 0);
const a = {
  meta: { lang: 'fr', dir: 'ltr', level: 'intermediate', tags: ['us', 'equities', 'ai-chain', 'semis', 'technology'], grade: 'B-', date: '2026-09-24', dateDisplay: '24 septembre 2026', version: 3, status: 'watch', assetType: 'stock', levelsCloseDate: REF,
    description: 'Marvell : +37 % de croissance, un accord avec Google payé en bons de souscription et près de 12 % de dilution potentielle. Dossier au close du 23 septembre 2026, statut surveiller.',
    ogDescription: 'Marvell : les centres de données accélèrent, le capital se dilue au profit de Google, NVIDIA et Celestial ; niveaux à surveiller.',
    lastMcpRefresh: raw.status.captured_at, levelsVerifiedAt: raw.status.captured_at,
    statusHistory: [{ at: raw.status.captured_at, from: archive.meta.status, to: 'watch', note: 'refonte v3 du 24 septembre : nouveau scénario, clôture de référence du 2026-09-23', close }] },
  header: { ticker: T, name: 'Marvell Technology, Inc.', exchange: 'NASDAQ', sector: 'Semi-conducteurs pour centres de données', price: close, changePct: pct(close, prev),
    badges: [{ text: 'SURVEILLER — NE PAS POURSUIVRE LA HAUSSE', color: 'blue' }, { text: 'Chaîne IA — puces sur mesure et connectivité', color: 'purple' }],
    metrics: { marketCap: fr(marketCap / 1e9, 1) + ' Md$', volume: fr(bars[N][5] / 1e6, 2) + ' M', evRevenue: fr(ev / G$.rev, 1) + '×' }, halalStatus: 'unknown' },
  verdict: { score: scoreValue, conviction: 'Moderate', bias: 'Neutral',
    confidence: 'Score éditorial non prédictif. Les chiffres d’entreprise viennent des dépôts SEC ; les niveaux, du close certifié du 23 septembre.',
    summary: 'Le 28 août, au lendemain de ses résultats, Marvell a perdu ' + fr(-move.e828.MRVL, 1) + ' % quand le panier des semi-conducteurs SMH perdait ' + fr(-move.e828.SMH, 1) + ' % ; depuis, le titre a regagné ' + fr(move.since.MRVL, 1) + ' %, contre ' + fr(move.since.SMH, 1) + ' % pour le panier. Le trimestre était solide : 2,739 Md$ de revenus, +37 %, dont +46 % dans les centres de données, et une prévision de 3,15 Md$ pour le trimestre suivant. Le marché a d’abord vendu la nouvelle, puis racheté le titre avec son secteur. Le point faible est ailleurs, dans le capital. Google a reçu en août un bon de souscription sur près de 59 millions d’actions à 206,58 $ ; NVIDIA détient des actions de préférence convertibles en 21,8 millions de titres ; Celestial AI peut encore coûter 24,4 millions d’actions. Au total, ' + fr(dilutionPct, 1) + ' % des 876,9 millions d’actions ordinaires, un plafond pluriannuel : le bon de Google ne s’acquiert en entier qu’après 120 Md$ d’achats. À plus de ' + fr(Math.floor(ev / G$.ebitda / 10) * 10, 0) + ' fois l’EBITDA GAAP, le titre ne laisse aucune marge. Pas d’entrée au cours actuel : le signal serait une clôture au-dessus de ' + usd(entry) + ' ; une clôture sous ' + usd(abandon) + ' ferait abandonner le scénario.',
    whyBuy: [
      'Les revenus du trimestre atteignent 2,739 Md$, en hausse de 37 % ; les centres de données progressent de 46 % et pèsent ' + fr(dcShare, 0) + ' % du total.',
      'La prévision du troisième trimestre, 3,150 Md$ à 5 % près, suppose ' + fr(q3Seq, 1) + ' % de croissance d’un trimestre sur l’autre au milieu de la fourchette.',
      'L’accord avec Google couvre accélérateurs d’inférence, contrôleurs de stockage, cartes réseau et calcul proche de la mémoire, autour de l’écosystème TPU.',
      'NVIDIA a investi 2 Md$ en actions de préférence convertibles : le leader du secteur est entré au capital en mars.',
      'Le flux opérationnel du semestre atteint 1,244 Md$, contre 794,5 M$ un an plus tôt.'],
    whyAvoid: [
      'Le bon de Google, les actions de préférence de NVIDIA et le complément de prix de Celestial représentent ' + fr(potential / 1e6, 1) + ' millions d’actions potentielles, soit ' + fr(dilutionPct, 1) + ' % des 876,9 millions en circulation.',
      'Un distributeur, qui revend à de nombreux clients finaux, écoule 44 % des revenus du trimestre : un déstockage dans ce canal se lirait immédiatement dans les ventes ; un client direct pèse en outre 16 %.',
      'Au close du 23 septembre, le titre vaut ' + fr(ev / G$.ebitda, 0) + ' fois l’EBITDA GAAP sur douze mois et ' + fr(close / EPS_RUN, 0) + ' fois le bénéfice ajusté guidé du troisième trimestre annualisé.',
      'Le titre est passé de ' + usd(junePeak) + ' le 18 juin à ' + usd(julyLow) + ' le 29 juillet, puis a remonté de plus de moitié : l’ATR représente ' + fr(atrPct, 1) + ' % du cours par séance.',
      'Le directeur général et le directeur des opérations ont vendu des actions en septembre, et aucun dirigeant n’a acheté.',
      'Au-dessus du déclencheur, la zone du décrochage du 2 juillet culmine à ' + usd(r0) + ' : jusque-là, le R/R n’est que de ' + fr(rrR0, 2) + '.'],
    controlChecklist: [
      { label: 'Historique de cours', status: 'pass', statusLabel: 'Trois cents séances continues', evidence: 'Série certifiée au close du 23 septembre, sans séance manquante.', action: 'Niveaux et indicateurs recalculés sur cette seule série.' },
      { label: 'Extension', status: 'warn', statusLabel: 'Au-dessus de la moyenne à vingt séances', evidence: 'Titre revenu près de son plus haut de septembre, loin de sa moyenne à vingt séances.', action: 'Ne pas poursuivre ; attendre le déclencheur de clôture.' },
      { label: 'Calendrier', status: 'warn', statusLabel: 'Journée investisseurs le 6 octobre', evidence: 'Journée investisseurs annoncée par Marvell ; prochains résultats non confirmés ; Micron publie le 30 septembre selon deux calendriers de données, date non confirmée ici par Micron.', action: 'Aucun achat à l’ouverture du 5 ni du 6 octobre, même après une clôture de déclenchement.' }] },
  business: { theme: 'Puces sur mesure, connectivité optique et électrique pour les centres de données d’IA',
    overview: '<p>Marvell conçoit des puces pour déplacer et traiter les données dans les centres de données : processeurs de signal pour les liaisons optiques, commutateurs, contrôleurs de stockage et puces sur mesure pour les grands clouds. Au trimestre clos le 1er août 2026, les centres de données ont apporté 2,172 Md$ sur 2,739 Md$ de revenus, en hausse de 46 %.</p><p>La croissance tient à deux moteurs. La connectivité suit la construction des grappes de calcul : chaque accélérateur ajouté demande des liaisons plus rapides. Les puces sur mesure, elles, dépendent de quelques clients. L’accord signé avec Google le 29 juillet élargit ce second moteur, et la direction annonce une accélération nette de l’activité sur mesure au second semestre de l’exercice.</p><p>Le prix de cette croissance se lit dans le capital. Google est payé en bons de souscription à mesure qu’il achète, NVIDIA a pris 2 Md$ d’actions de préférence convertibles, et l’acquisition de Celestial AI peut encore coûter 24,4 millions d’actions. Le résultat GAAP en porte la trace : 433,7 M$ de réévaluation du complément de prix de Celestial sur le semestre.</p>',
    moat: 'L’avantage de Marvell tient à son savoir-faire en liaisons à très haut débit et en conception sur mesure : un grand cloud qui lance une puce avec lui s’engage pour plusieurs générations. Broadcom reste le concurrent de référence sur le sur-mesure, et les clients peuvent internaliser la conception.',
    segments: [
      { name: 'Centres de données', revenue: '2,172 Md$ au trimestre', pct: fr(dcShare, 0) + ' %', description: 'En hausse de 46 % sur un an ; connectivité, stockage et puces sur mesure.' },
      { name: 'Communications et autres', revenue: '568 M$ au trimestre', pct: fr(100 - dcShare, 0) + ' %', description: 'Réseaux d’entreprise, opérateurs et autres marchés.' }],
    sourceRefs: [ref(0), ref(1)],
    coverageMatrix: [
      { facet: 'Cours et historique', status: 'COUVERT', decision: 'Trois cents séances continues, close certifié ; base des niveaux.' },
      { facet: 'Résultats et prévision', status: 'COUVERT — PRIMAIRE', decision: 'Communiqué du 27 août et 10-Q ; prochaine date de résultats non confirmée.' },
      { facet: 'Capital et dilution', status: 'COUVERT — PRIMAIRE', decision: 'Bon de Google, préférence de NVIDIA, complément Celestial chiffrés depuis les dépôts.' },
      { facet: 'Client documenté', status: 'COUVERT — PRIMAIRE', decision: 'Google nommé dans le 8-K du 19 août ; les autres grands clients restent anonymes.' },
      { facet: 'Comparables et transmission', status: 'COUVERT — LOCAL', decision: 'Corrélations recalculées sur barres certifiées depuis la fin mars.' },
      { facet: 'Initiés', status: 'PARTIEL', decision: 'Ventes relevées, couverture officielle incomplète : aucun solde net affirmé.' },
      { facet: 'Options, sentiment et tendances de recherche', status: 'NON EXPLOITABLE', decision: 'Chaîne relevée marché fermé ; aucune mesure qualifiée de sentiment.' }] },
  news: [
    { date: '2026-08-27', title: 'Deuxième trimestre : +37 %, prévision à 3,15 Md$', impact: 'neutral', detail: 'Le trimestre dépasse le milieu de la prévision de 39 M$, mais le titre perd plus de dix pour cent le lendemain, bien plus que son secteur.', source: 'Marvell — SEC', sourceUrl: docs[0].url },
    { date: '2026-08-19', title: 'Accord avec Google et bon de souscription', impact: 'positive', detail: 'Le titre gagne près de dix pour cent le jour du dépôt, alors que le panier des semi-conducteurs recule ; Google est payé en actions à mesure qu’il achète.', source: 'Marvell — SEC', sourceUrl: docs[2].url },
    { date: '2026-06-11', title: 'Changement de directeur financier', impact: 'neutral', detail: 'Daniel Durn, ancien directeur financier d’Adobe et président du comité d’audit, remplace Willem Meintjes, parti sans désaccord déclaré.', source: 'Marvell — SEC', sourceUrl: docs[7].url },
    { date: '2026-03-31', title: 'NVIDIA investit 2 Md$ en actions de préférence', impact: 'positive', detail: 'Conversion possible en 21,8 millions d’actions au prix d’environ 91,84 $, très en dessous du cours actuel : la dilution est acquise.', source: 'Marvell — SEC', sourceUrl: docs[3].url }],
  fundamentals: { rows: [
      { metric: 'Chiffre d’affaires du trimestre', value: '2,739 Md$', signal: '+37 % sur un an, communiqué du 27 août', signalColor: 'green' },
      { metric: 'Revenus des centres de données', value: '2,172 Md$', signal: '+46 % sur un an, ' + fr(dcShare, 0) + ' % du total', signalColor: 'green' },
      { metric: 'Prévision de revenus du troisième trimestre', value: '3,150 Md$ ± 5 %', signal: fr(q3Seq, 1) + ' % au-dessus du deuxième trimestre au milieu de la fourchette', signalColor: 'green' },
      { metric: 'Bénéfice par action du trimestre', value: '0,33 $ GAAP / 0,94 $ ajusté', signal: 'Communiqué du 27 août', signalColor: 'amber' },
      { metric: 'Réestimation du complément de prix Celestial', value: '433,7 M$ au semestre', signal: 'Charge non monétaire incluse dans le résultat GAAP, 10-Q', signalColor: 'red' },
      { metric: 'Rémunération en actions du semestre', value: '533,8 M$', signal: 'Contre 295,7 M$ un an plus tôt, 10-Q', signalColor: 'amber' },
      { metric: 'Concentration des revenus du trimestre', value: '44 % / 16 %', signal: 'Premier distributeur (revente à des clients finaux variés) et premier client direct, anonymes, 10-Q', signalColor: 'red' },
      { metric: 'Flux libre sur douze mois', value: fr(G$.fcf / 1e9, 2) + ' Md$', signal: 'Flux opérationnel − investissements corporels, douze mois au 1er août 2026', signalColor: 'green' },
      { metric: 'Revenus GAAP sur douze mois', value: fr(G$.rev / 1e9, 2) + ' Md$', signal: 'Douze mois glissants au 1er août 2026 (10-K + 10-Q)', signalColor: 'blue' },
      { metric: 'EBITDA GAAP sur douze mois', value: fr(G$.ebitda / 1e9, 2) + ' Md$', signal: 'Résultat opérationnel + dépréciation + amortissement des incorporels acquis, douze mois au 1er août 2026', signalColor: 'blue' },
      { metric: 'Résultat net GAAP sur douze mois', value: fr(G$.ni / 1e9, 2) + ' Md$', signal: 'Douze mois au 1er août 2026, dont 1,926 Md$ d’autres produits de l’exercice 2026', signalColor: 'amber' },
      { metric: 'Dette et trésorerie au 1er août', value: fr(G$.debt / 1e9, 2) + ' / ' + fr(G$.cash / 1e9, 2) + ' Md$', signal: 'Obligations à 1,65 % remboursées, 1 Md$ émis à 5,30 % en avril', signalColor: 'blue' },
      { metric: 'Actions diluées moyennes du trimestre', value: fr(BAL.dilNow, 1) + ' M', signal: 'Contre ' + fr(BAL.dilPrior, 1) + ' M un an plus tôt, actions de préférence converties', signalColor: 'red' },
      { metric: 'EV/revenus GAAP', value: fr(ev / G$.rev, 1) + '×', signal: 'Enterprise value au close du 2026-09-23, actions de préférence converties, sur revenus GAAP douze mois au 2026-08-01', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus une croissance de 37 % : le multiple paie déjà plusieurs années d’accélération.' },
      { metric: 'EV/EBITDA GAAP', value: fr(ev / G$.ebitda, 0) + '×', signal: 'Enterprise value au close du 2026-09-23 sur EBITDA GAAP douze mois au 2026-08-01', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le scénario ci-dessous : l’écart mesure la prime accordée aux puces sur mesure.' },
      { metric: 'P/E forward sur prévision non-GAAP annualisée', value: fr(close / EPS_RUN, 0) + '×', signal: 'Forward : close du 2026-09-23 sur 4 × 1,10 $, bénéfice ajusté guidé du troisième trimestre de l’exercice 2027', signalColor: 'red', source: 'Clôture certifiée et communiqué du 27 août', comparison: 'Versus une annualisation simple : si la croissance séquentielle se poursuit, le multiple réel sera plus bas ; si elle cale, plus haut.' },
      { metric: 'Scénario EV/EBITDA × 0,7 : valeur d’entreprise −30 % (hypothèse éditoriale)', value: fr(scn.price, 2) + ' $ par action', signal: 'Scénario : valeur d’entreprise réduite de 30 % par hypothèse, dette et trésorerie du 2026-08-01 inchangées, soit ' + fr(scn.downside_pct, 0) + ' % sous le close du 2026-09-23', signalColor: 'red', source: 'Clôture certifiée, 10-K et 10-Q', comparison: 'Versus le close : ce que coûterait un retour partiel du multiple ; le titre a déjà fait pire entre juin et juillet. Ce n’est pas un objectif.' }],
    sourceRefs: [ref(0), ref(1), ref(5), market('fondamentaux et statistiques')] },
  earnings: { quarters: [],
    beatNote: 'Deuxième trimestre de l’exercice 2027 : 2,739 Md$ de revenus, 39 M$ au-dessus du milieu de la prévision, marge brute GAAP de 53,1 %, bénéfice GAAP de 0,33 $ et ajusté de 0,94 $ par action. La guidance du troisième trimestre vise 3,150 Md$ de revenus à 5 % près et 1,10 $ de bénéfice ajusté, à 5 cents près ; la direction relève aussi ses perspectives de revenus pour les exercices 2027 et 2028 sans les chiffrer dans le communiqué. Aucune date de prochaine publication n’est confirmée par l’émetteur à ce jour ; la journée investisseurs est fixée au 6 octobre.',
    nextEarnings: 'Date non confirmée par l’émetteur ; journée investisseurs annoncée pour le 6 octobre 2026.',
    sourceRefs: [ref(0)] },
  capitalStructure: { sharesOutstanding: '876,9 millions d’actions ordinaires au 21 août 2026 (page de garde du 10-Q), plus 2 millions d’actions de préférence convertibles en 21,8 millions d’actions au maximum',
    sharesAuthorized: '1,3 milliard d’actions ordinaires et 8 millions d’actions de préférence autorisées (10-Q).',
    dilutionRisk: 'moderate',
    shareHistory: 'Le nombre d’actions monte : ' + fr(BAL.dilNow, 1) + ' millions d’actions diluées au deuxième trimestre, contre ' + fr(BAL.dilPrior, 1) + ' millions un an plus tôt, après 24,6 millions d’actions émises pour Celestial AI et la conversion théorique des actions de préférence de NVIDIA. Les rachats, 400 M$ sur le semestre, ne compensent pas. Restent le bon de Google et le complément de prix de Celestial, soit ' + fr((BAL.googleWarrant + BAL.celestialEarnout) / 1e6, 1) + ' millions d’actions possibles en plus des 921,2 millions d’actions diluées du trimestre, qui comptent déjà NVIDIA. Toutes les parts de ce tableau sont exprimées sur les 876,9 millions d’actions ordinaires du 21 août ; le bon de Google suppose 120 Md$ d’achats pour être acquis en entier. Le nombre d’actions entièrement dilué à une date donnée n’est pas calculable, car ces deux instruments dépendent de revenus futurs.',
    warrants: [
      { series: 'Bon de souscription Google', type: 'Client, acquisition liée aux achats', strike: 206.58, shares: '58 970 907', issued: '2026-08-18', expiration: '2033-08-18', dilutionPct: fr(warrantPct, 1) + ' % des actions ordinaires si entièrement acquis', status: 'ITM', note: '1 360 867 actions acquises en un an ; le reste par 240 tranches, une par 500 M$ de produits sur mesure achetés.' },
      { series: 'Actions de préférence de série A (NVIDIA)', type: 'Préférence convertible', strike: 91.84, shares: '21 778 000 au maximum', issued: '2026-03-31', expiration: 'Sans échéance', dilutionPct: fr(prefPct, 1) + ' % des actions ordinaires', status: 'ITM', note: 'Déjà comptées dans les actions diluées ; conversion au gré du porteur.' },
      { series: 'Complément de prix Celestial AI', type: 'Actions liées à des paliers de revenus', shares: '24,4 millions au maximum', issued: '2026-02-02', expiration: 'Fin de l’exercice 2029', dilutionPct: fr(earnPct, 1) + ' % des actions ordinaires au maximum', note: 'Dû si les revenus cumulés de Celestial atteignent les paliers fixés.' }],
    atm: { active: false, authorized: 'Aucun programme d’émission d’actions relevé', used: 'Sans objet', remaining: 'Sans objet' },
    sourceRefs: [ref(1), ref(2), ref(3), ref(4)] },
  filingsReview: { summary: 'Dix documents décisionnels ouverts et hachés. Ils montrent une croissance réelle et rapide dans les centres de données, et un capital qui se dilue pour la financer : un bon de souscription accordé à Google, des actions de préférence vendues à NVIDIA, un complément de prix en actions pour Celestial AI.',
    filings: docs.map(d => ({ date: d.date, form: d.form, accession: d.accession, finding: d.finding, url: d.url })),
    contrarianRisks: [
      'Chaque tranche de 500 M$ achetée par Google lui donne environ ' + fr(tranche / 1e3, 0) + ' 000 actions ; au cours actuel, leur valeur intrinsèque équivaut à ' + fr(rebatePct, 1) + ' % de ces revenus, une remise payée en capital.',
      'Un distributeur écoule 44 % des revenus pour de nombreux clients finaux : un déstockage de ce canal se lirait immédiatement dans le trimestre.',
      'Le titre a perdu plus de moitié entre le 18 juin et le 29 juillet : la volatilité d’un titre à ce multiple joue dans les deux sens.',
      'Le 6 octobre, la journée investisseurs peut fixer des objectifs que le cours a déjà en partie intégrés.',
      'Broadcom et la conception interne des grands clouds limitent le pouvoir de prix de Marvell sur le sur-mesure.'] },
  technicals: { rsi14: +tech.rsi14.toFixed(2), macd: +tech.macd.toFixed(2), macdSignal: +tech.macdSignal.toFixed(2), ema20: +tech.ema20.toFixed(2), ema50: +tech.ema50.toFixed(2), ema200: +tech.ema200.toFixed(2),
    ma50Type: 'EMA', ma200Type: 'EMA', ma50Available: true, ma200Available: true, atr14: +tech.atr14.toFixed(2),
    badges: ['Plus haut de septembre le 22', 'Zone de juillet juste au-dessus', 'Titre étendu'],
    supports: [stop, abandon, lv('s3')],
    resistances: [r0, tp1, tp2],
    setupNote: 'Le titre clôture à ' + usd(close) + ', ' + fr(extension, 1) + ' % au-dessus de sa moyenne à vingt séances, juste sous le plus haut du 22 septembre. Avant activation, aucune entrée ; une clôture sous ' + usd(abandon) + ', le bas du 21 septembre, abandonne le scénario. Activation sur une clôture au-dessus de $' + entry.toFixed(2) + ', le plus haut du 22 septembre. Après activation, stop sous $' + stop.toFixed(2) + ', le bas de la même séance, à moins d’un ATR de l’entrée. Supports : ' + usd(stop) + ', ' + usd(abandon) + ' et ' + usd(lv('s3')) + '. Résistances : ' + usd(r0) + ', plus haut du 2 juillet, à ' + fr(r0OverCap, 1) + ' % au-dessus du plafond, puis ' + usd(tp1) + ' et ' + usd(tp2) + '. Jusqu’à ' + usd(r0) + ', le R/R n’est que de ' + fr(rrR0, 2) + ' : TP1 suppose d’absorber la zone du décrochage de juillet.',
    wyckoff: 'Non utilisé : le profil de volume n’est pas exploité dans ce dossier.',
    sourceRefs: [market('barres quotidiennes et indicateurs recalculés')] },
  performance: { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
      rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [market('barres quotidiennes comparées')] },
  options: { callOI: 'Non exploitable', putOI: 'Non exploitable', cpRatio: 'Non exploitable', maxPain: 'Non exploitable', ivMean: 'Non exploitable', skew: 'Chaîne relevée marché fermé', unusual: 'Aucune activité inhabituelle qualifiée', sourceRefs: [market('options')] },
  shortInterest: { siPct: fr(st.shortPercentOfFloat * 100, 2) + ' % du flottant', daysToCover: fr(st.shortRatio, 2) + ' jours, date de règlement non précisée par le snapshot', ctb: 'Coût d’emprunt bas, sans tension', trend: 'Positions vendeuses modérées pour un titre aussi volatil ; aucun potentiel de squeeze qualifié.', squeezeScore: 'Faible', sourceRefs: [market('positions vendeuses')] },
  insiders: { signal: 'Ventes de marché uniquement dans la fenêtre relevée, aucun achat. Matthew Murphy, président-directeur général, a vendu ' + fr(murphy.shares, 0) + ' actions le ' + frDate(murphy.date_transaction) + ' pour environ ' + fr(murphy.value / 1e6, 2) + ' M$ ; Chris Koopmans, directeur des opérations, ' + fr(koop.shares, 0) + ' actions le ' + frDate(koop.date_transaction) + ' pour environ ' + fr(koop.value / 1e6, 2) + ' M$. Couverture officielle partielle : aucun solde net publié, et aucun plan de cession programmé n’est affirmé faute de mention relevée.',
    recentTransactions: [
      { date: murphy.date_transaction, insider: 'Matthew Murphy — direction générale', type: 'sell', shares: fr(murphy.shares, 0), value: fr(murphy.value / 1e6, 2) + ' M$' },
      { date: koop.date_transaction, insider: 'Chris Koopmans — direction des opérations', type: 'sell', shares: fr(koop.shares, 0), value: fr(koop.value / 1e6, 2) + ' M$' }],
    sourceRefs: [market('formulaires 4')] },
  blastRadius: {},
  macro: { indicators: [{ name: 'Clôture de référence', value: REF, signal: usd(close) + ', séance complète' }, { name: 'Rendement cinq séances', value: sgn(ret(5)), signal: 'Descriptif' }, { name: 'Rendement vingt et une séances', value: sgn(ret(21)), signal: 'Descriptif' }],
    regime: 'neutral', impact: 'Le 10 ans américain a clôturé à 5,11 % le 23 septembre, plus haut depuis juillet 2007. Un titre valorisé sur plusieurs années de croissance y est sensible ; le moteur de court terme reste toutefois le budget d’investissement des grands clouds, lisible dans les résultats de Micron annoncés pour le 30 septembre par les calendriers de données, date non confirmée par Micron.' },
  risks: { riskScore: 7, riskProfile: 'High',
    riskSummary: 'Trois fragilités se cumulent. Le multiple suppose que l’accélération annoncée se matérialise ; le capital se dilue à mesure que les grands clients achètent ; et un seul distributeur écoule 44 % des revenus, si bien qu’un déstockage du canal toucherait le trimestre avant la demande finale. Une déception sur l’un de ces trois points suffit à rejouer la chute de l’été.',
    riskCards: [
      { title: 'Dilution liée aux partenaires', severity: 'high', icon: 'fa-money-bill-trend-up', points: ['Bon de Google sur près de 59 millions d’actions à 206,58 $.', 'Complément Celestial jusqu’à 24,4 millions d’actions.'], verdict: 'La croissance avec Google se paie en actions : plus il achète, plus le capital se dilue.' },
      { title: 'Valorisation et volatilité', severity: 'high', icon: 'fa-rocket', points: ['Plus de quatre-vingts fois l’EBITDA GAAP sur douze mois.', 'Chute de plus de moitié entre juin et juillet.'], verdict: 'Le multiple ne laisse aucune place à un trimestre simplement conforme aux attentes.' },
      { title: 'Canal de distribution et client direct', severity: 'medium', icon: 'fa-building', points: ['Un distributeur à 44 % des revenus du trimestre, qui revend à des clients finaux variés.', 'Un client direct à 16 %.'], verdict: 'Le risque est un déstockage du distributeur ; signal à suivre : une hausse des stocks du canal ou des créances sur ce distributeur.' }],
    pedagogy: 'Le titre a perdu ' + fr(-move.e828.MRVL, 1) + ' % au lendemain de ses résultats et gagné ' + fr(move.g819.MRVL, 1) + ' % le jour d’un simple dépôt. Sur ' + fr(adv / 1e9, 1) + ' Md$ échangés par séance, le slippage ordinaire reste de quelques cents ; le gap est une autre affaire : il peut faire sortir sous le stop de ' + usd(stop) + ', et la perte dépasse alors le risque prévu. Micron le 30 septembre et la journée investisseurs du 6 octobre en sont deux occasions. Le stop est à moins d’un ATR : taille limitée à l’exemple, ' + sizeExample + ' actions pour 100 $. Ne pas poursuivre ; attendre la clôture de déclenchement.' },
  tradeIdea: { status: 'watch', statusNote: 'Surveiller. Avant activation : aucune entrée ; une clôture sous ' + usd(abandon) + ' abandonne le scénario. Activation : clôture au-dessus de ' + usd(entry) + ', puis achat à l’ouverture suivante seulement sous ' + usd(cap) + '. Après activation : stop sous ' + usd(stop) + '.',
    entry, stop, tp1, tp2,
    stopPct: pct(stop, entry).toFixed(1) + '%', tp1Pct: '+' + pct(tp1, entry).toFixed(1) + '%', tp2Pct: '+' + pct(tp2, entry).toFixed(1) + '%',
    rr: '1:' + rr1.toFixed(2) + ' TP1 / 1:' + rr2.toFixed(2) + ' TP2',
    entryNote: 'Déclencheur sur clôture au-dessus du plus haut du 22 septembre, pas sur un franchissement en séance. Entrée à l’ouverture suivante uniquement sous ' + usd(cap) + ' : au-delà, le R/R vers TP1 tomberait sous 1,5 avec le même stop. Une clôture de déclenchement déjà au-dessus de ' + usd(cap) + ', ou une ouverture au-delà, annule l’entrée. La marge vaut ' + usd(cap - entry) + ', ' + fr(X.bufAtr, 2) + ' ATR : ' + fr(X.gap60, 0) + ' % des soixante dernières séances ont ouvert plus haut que la veille d’au moins cet écart, et sur ' + X.breakouts + ' clôtures au-dessus du plus haut de la veille, ' + X.exec + ' auraient permis l’achat, à peu près une sur quatre. Pas d’achat à l’ouverture du 5 ni du 6 octobre. Objectifs : TP1 au plus haut du 1er juillet, TP2 au plus haut du 30 juin, deux séances du reflux de l’été. Le stop est à moins d’un ATR : il peut sauter sur le bruit d’une séance. Liquidité : environ ' + fr(adv / 1e9, 2) + ' Md$ échangés par séance, médiane des vingt dernières. Exemple de taille, non personnalisé : pour 100 $ de perte au stop, ' + usd(entry - stop) + ' par action, ' + sizeExample + ' actions, hors gap.',
    horizon: 'Dix séances après activation',
    thesis: 'La croissance des centres de données est réelle et le titre a repris le terrain perdu après ses résultats, plus vite que son secteur. Avant activation, le dossier reste en surveillance et une clôture sous ' + usd(abandon) + ' l’abandonne. Une clôture au-dessus de $' + entry.toFixed(2) + ' montrerait que les acheteurs absorbent les ventes près du plus haut de septembre ; l’entrée n’a lieu qu’à l’ouverture suivante et sous ' + usd(cap) + '. Après activation, le stop sous $' + stop.toFixed(2) + ' limite le risque à la séance du 22 septembre. TP1 à ' + usd(tp1) + ' et TP2 à ' + usd(tp2) + ' visent la zone perdue en juillet, mais il faut d’abord franchir ' + usd(r0) + '. Taille limitée à ' + sizeExample + ' actions pour 100 $ de risque : dilution, multiple et journée investisseurs du 6 octobre pèsent sur le trade.',
    catalysts: ['Une clôture au-dessus du plus haut du 22 septembre, sur volume au moins égal à la médiane récente.', 'La journée investisseurs du 6 octobre, où la direction doit présenter sa stratégie à long terme.', 'Les résultats de Micron le 30 septembre, date tirée de deux calendriers de données : lecture des budgets de mémoire et d’infrastructure d’IA, et risque de gap.'],
    invalidation: ['Avant activation : une clôture sous ' + usd(abandon) + ', bas du 21 septembre, abandonne le scénario.', 'Après activation : une clôture sous ' + usd(stop) + ' invalide le trade.', 'Ouverture au-dessus de ' + usd(cap) + ' après la clôture de déclenchement : pas d’achat, le R/R deviendrait insuffisant.', 'Un nouveau dépôt de bons ou d’actions accordés à un client annule la thèse avant activation.'] },
  globalScore: { profile: 'Croissance réelle, capital dilué, multiple tendu',
    keyTakeawaysPositive: ['Centres de données en hausse de 46 %.', 'Accord élargi avec Google sur le sur-mesure.', 'NVIDIA entré au capital.'],
    keyTakeawaysNegative: ['Jusqu’à 12 % de dilution sur plusieurs années.', 'Un distributeur à 44 % des revenus, exposé au déstockage.', 'Multiple et volatilité extrêmes.'],
    mindsetTip: 'Quand un client est payé en actions pour acheter, lisez la croissance et la dilution ensemble : l’une finance l’autre.' },
  social: { platforms: [], sourceRefs: [market('sentiment non retenu faute de mesure qualifiée')] },
  disclaimer: 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Statut surveiller : aucun ordre actif.',
};

// ---------------------------------------------------------------- blast radius
const G = [
  { name: 'Leaders des puces pour l’IA', order: 1, transmission: 'Ils fixent le rythme des grappes de calcul et le prix du sur-mesure.', rows: [
    ['NVDA', 'leader', 'Leader des accélérateurs, actionnaire de préférence', 'Ses grappes de calcul demandent la connectivité de Marvell, et NVIDIA détient 2 Md$ de ses actions de préférence.'],
    ['AVGO', 'leader', 'Leader des puces sur mesure', 'Concurrent de référence sur le sur-mesure des grands clouds ; ses gains de contrats se font souvent au détriment de Marvell.']] },
  { name: 'Pairs directs de la connectivité', order: 1, transmission: 'Même demande de liaisons rapides dans les centres de données, mêmes clients.', rows: [
    ['ALAB', 'direct_peer', 'Connectivité électrique des serveurs', 'Concurrent direct sur les liaisons de proximité ; le pair le plus corrélé à Marvell sur la fenêtre.'],
    ['CRDO', 'direct_peer', 'Câbles et liaisons électriques actives', 'Concurrent sur les liaisons de courte distance ; son recul récent montre la dispersion du secteur.'],
    ['COHR', 'direct_peer', 'Modules optiques pour centres de données', 'Client et concurrent partiel : ses modules embarquent des processeurs de signal comme ceux de Marvell.'],
    ['LITE', 'direct_peer', 'Lasers et composants optiques', 'Même cycle de l’optique pour l’IA ; ses commandes signalent le rythme des liaisons optiques.'],
    ['MTSI', 'direct_peer', 'Composants analogiques et optiques', 'Concurrent sur certains composants de liaison ; sensible au même cycle d’investissement.']] },
  { name: 'Amont : fabrication et mémoire', order: 1, transmission: 'Marvell ne fabrique pas ses puces : fonderie, assemblage et mémoire fixent ses coûts et ses délais.', rows: [
    ['TSM', 'upstream', 'Fonderie des puces avancées', 'Ses capacités en gravure avancée et en assemblage fixent les volumes livrables par Marvell.'],
    ['AMKR', 'upstream', 'Assemblage et test des puces', 'Ses capacités d’assemblage avancé comptent pour les puces sur mesure de grande taille.'],
    ['MU', 'upstream', 'Mémoire à haute bande passante', 'Les contrôleurs de mémoire et le calcul proche de la mémoire de Marvell dépendent de cette génération de mémoire.']] },
  { name: 'Aval : client documenté', order: 1, transmission: 'Google est nommé comme client dans un dépôt primaire ; ses achats déclenchent aussi la dilution.', rows: [
    ['GOOGL', 'downstream', 'Client des puces sur mesure', 'Chaque tranche de 500 M$ achetée par Google fait croître les revenus de Marvell et lui acquiert des actions.']] },
  { name: 'Second ordre : dépenses d’IA et réseaux', order: 2, transmission: 'Les budgets des grands clouds et des équipementiers réseau décident du volume de liaisons et de puces.', rows: [
    ['AMZN', 'second_order', 'Grand cloud, client potentiel du sur-mesure', 'Son budget d’infrastructure pèse sur la demande de puces sur mesure ; aucun lien client n’est affirmé ici.'],
    ['MSFT', 'second_order', 'Grand cloud et concepteur de puces', 'Ses dépenses d’infrastructure d’IA nourrissent la demande de connectivité du secteur.'],
    ['META', 'second_order', 'Grand acheteur d’infrastructure d’IA', 'Ses annonces de dépenses d’investissement déplacent tout le panier des semi-conducteurs.'],
    ['AMD', 'second_order', 'Accélérateurs et processeurs concurrents', 'Ses grappes de calcul demandent aussi des liaisons rapides ; il concurrence NVIDIA, pas Marvell.'],
    ['ANET', 'second_order', 'Commutateurs de centres de données', 'Ses commutateurs utilisent des liaisons optiques ; ses commandes mesurent la construction des réseaux d’IA.'],
    ['CIEN', 'second_order', 'Réseaux optiques longue distance', 'Lecture du trafic entre centres de données, un débouché des processeurs de signal optiques.']] },
  { name: 'Contrôles sectoriels', order: 2, transmission: 'Paniers de référence pour séparer le mouvement du titre de celui de son secteur.', rows: [
    ['SMH', 'sector_proxy', 'Panier des semi-conducteurs', 'Un écart de performance avec ce panier isole ce qui est propre à Marvell.'],
    ['SOXX', 'sector_proxy', 'Panier des semi-conducteurs, autre pondération', 'Confirme le signal du premier panier avec une pondération moins concentrée.'],
    ['QQQ', 'sector_proxy', 'Panier des grandes valeurs du Nasdaq', 'Contrôle du marché de croissance : un mouvement commun n’a rien de spécifique.']] },
];
const EV = {
  NVDA: 'Aucune publication dans les quatorze jours collectés ; ses annonces de produits déplacent le secteur',
  AVGO: 'Aucune publication dans les quatorze jours collectés ; ses gains de contrats sur mesure sont le signal concurrent',
  ALAB: 'Aucune publication dans les quatorze jours collectés ; très réactif aux nouvelles du secteur',
  CRDO: 'Aucune publication dans les quatorze jours collectés ; dispersion récente avec Marvell',
  COHR: 'Aucune publication dans les quatorze jours collectés ; ses commandes de modules valent pour l’optique',
  LITE: 'Aucune publication dans les quatorze jours collectés ; même cycle optique',
  MTSI: 'Aucune publication dans les quatorze jours collectés ; même cycle d’investissement',
  TSM: 'Aucune publication dans les quatorze jours collectés ; ses chiffres mensuels mesurent la demande',
  AMKR: 'Aucune publication dans les quatorze jours collectés ; capacités d’assemblage à suivre',
  MU: 'Résultats confirmés le 30 septembre ; lecture directe des budgets de mémoire pour l’IA',
  GOOGL: 'Aucune publication dans les quatorze jours collectés ; ses achats déclenchent les tranches du bon',
  AMZN: 'Aucune publication dans les quatorze jours collectés ; budget d’infrastructure à suivre',
  MSFT: 'Aucune publication dans les quatorze jours collectés ; dépenses d’infrastructure à suivre',
  META: 'Aucune publication dans les quatorze jours collectés ; dépenses d’investissement à suivre',
  AMD: 'Aucune publication dans les quatorze jours collectés ; lecture indirecte des grappes de calcul',
  ANET: 'Aucune publication dans les quatorze jours collectés ; commandes de commutateurs à suivre',
  CIEN: 'Aucune publication dans les quatorze jours collectés ; trafic optique à suivre',
  SMH: 'Panier sans publication propre ; dominé par les plus grandes valeurs du secteur',
  SOXX: 'Panier sans publication propre ; pondération moins concentrée',
  QQQ: 'Panier sans publication propre ; reflète le marché de croissance' };
const evNote = t => { if (!EV[t]) throw Error('eventRisk manquant ' + t); return EV[t]; };
a.blastRadius = {
  asOf: REF, observationTime: raw.status.captured_at,
  window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
  methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement de Marvell à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont simples, sans dividendes. Les groupes sont définis par le lien économique, pas par la corrélation.',
  groups: G.map(g => ({ name: g.name, order: g.order, transmission: g.transmission,
    symbols: g.rows.map(([ticker, relationClass, role, readThrough]) => ({ ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : relationClass === 'downstream' ? 'high' : 'low', readThrough, eventRisk: evNote(ticker), ...M[ticker] })) })),
  scenarios: [
    { scenario: 'bullish', trigger: 'La journée investisseurs du 6 octobre chiffre une accélération du sur-mesure au-delà de ce que le cours intègre.', firstOrder: 'Le titre franchit le plus haut du 22 septembre et vise la zone perdue en juillet.', secondOrder: 'Les pairs de la connectivité suivent, la fonderie et l’assemblage en profitent.', confirmation: 'Une clôture au-dessus du plus haut du 22 septembre sur volume soutenu.', contradiction: 'Un nouveau bon de souscription accordé à un client.' },
    { scenario: 'mixed', trigger: 'Les objectifs présentés confirment la trajectoire sans la relever, et les budgets des clouds restent stables.', firstOrder: 'Le titre oscille entre le bas du 21 septembre et le plus haut du 22 septembre.', secondOrder: 'Le secteur reste porté par la demande générale d’infrastructure d’IA.', confirmation: 'Aucune clôture hors de la zone entre le bas du 21 septembre et le plus haut du 22 septembre.', contradiction: 'Une annonce de Micron qui change la lecture des budgets.' },
    { scenario: 'bearish', trigger: 'Une pause de commandes chez un grand client ou une hausse des taux comprime le multiple.', firstOrder: 'Le titre rejoue une partie de la chute de juin à juillet.', secondOrder: 'Les valeurs de connectivité les plus valorisées reculent ensemble.', confirmation: 'Une clôture sous le bas du 21 septembre et un recul du panier des semi-conducteurs.', contradiction: 'Une prévision relevée malgré la pause d’un client.' }],
  contradictions: ['Le 19 août, Marvell a gagné ' + fr(move.g819.MRVL, 1) + ' % quand le panier des semi-conducteurs perdait ' + fr(-move.g819.SMH, 1) + ' % : l’accord avec Google est un mouvement propre, qui porte pourtant la dilution.', 'Le 28 août, le titre a perdu ' + fr(-move.e828.MRVL, 1) + ' % quand le panier perdait ' + fr(-move.e828.SMH, 1) + ' %, puis a regagné ' + fr(move.since.MRVL, 1) + ' % contre ' + fr(move.since.SMH, 1) + ' % : la réaction aux résultats a été effacée sans nouvelle publication.'],
  missingData: ['Chaîne d’options relevée marché fermé, inexploitable ; sentiment et tendances de recherche indisponibles.', 'Identité du distributeur à 44 % et du client direct à 16 % non publiée ; stocks du canal non publiés.', 'Perspectives relevées des exercices 2027 et 2028 non chiffrées dans le communiqué.'],
  sourceRefs: [market('barres comparables et classement statistique'), ref(2), ref(1)] };

// ---------------------------------------------------------------- jugements éditoriaux
const judgments = { ticker: T, score_components: score, judgments: {
  'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
  'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
  'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
  'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution, valorisation et base de risque.' },
  'risks.riskScore': { value: 7, reason: 'Jugement qualitatif sur dix : dilution liée aux partenaires, valorisation, volatilité et concentration.' } } };
a.blastRadius.groups.forEach((g, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: g.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
write(rev + '/editorial-judgments.json', judgments);

// ---------------------------------------------------------------- preuves
const inputs = [];
for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['client', 'comparison_client_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['sec', 'sec_evidence']])
  inputs.push(K.input(name, data + '/' + file + '.json'));
inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'));
const { dep, prov } = K.provenance(inputs);
const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
const gaap = () => prov('primary', '/documents/5', 'GAAP douze mois glissants au 01/08/2026 = exercice 2026 (10-K) − premier semestre FY26 + premier semestre FY27 (10-Q) ; EBITDA = résultat opérationnel + dépréciation + amortissement des incorporels acquis ; flux libre = flux opérationnel − investissements corporels.', [dep('primary', '/documents/1'), dep('primary', '/documents/6')]);
const dilution = () => prov('primary', '/documents/1', 'Actions potentielles = bon de Google (58 970 907, 8-K du 19 août) + actions de préférence (21,8 M, 10-Q) + complément Celestial (24,4 M, 10-Q) ; part = actions potentielles / 876,9 M ordinaires ; dilution par instrument = instrument / 876,9 M ordinaires (base unique) ; acquisition complète du bon = 240 tranches × 500 M$ = 120 Md$ d’achats ; tranche = (bon − 1 360 867) / 240 ; valeur intrinsèque = tranche × (close − 206,58 $), rapportée à 500 M$.', [dep('primary', '/documents/2'), dep('primary', '/documents/3'), dep('primary', '/documents/4'), dep('bars', B + '/' + N + '/4')]);
const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × (876,9 M d’actions ordinaires au 21 août + 21,8 M d’actions issues des préférences) ; EV = capitalisation + dette − trésorerie au 01/08 ; ratios sur agrégats douze mois ; P/E forward = close / (4 × 1,10 $) ; extension = close / EMA20 − 1.', [dep('primary', '/documents/1'), dep('primary', '/documents/5'), dep('primary', '/documents/0')]);
const moveProv = () => prov('bars', B, 'Rendements simples de Marvell et du panier SMH sur les mêmes séances (18→19 août, 27→28 août, 28 août→23 septembre), barres certifiées.', [dep('comparison', C('SMH'))]);
const insiderProv = () => prov('insiders', TXP + '/transactions', 'Formulaires 4 relevés, code S (ventes de marché), aucun code P ; valeurs = actions × prix ; couverture officielle partielle.', [dep('sec', '')]);
const levelsGeo = () => prov('bars', lvPtr('trigger'), 'Déclencheur = plus haut du 22 septembre ; stop = plus bas du 22 septembre ; TP1 = plus haut du 1er juillet ; TP2 = plus haut du 30 juin ; plafond = (TP1 + 1,5 × stop) / 2,5 ; pourcentages depuis l’entrée ; R/R = gain / risque.', [dep('bars', lvPtr('stop')), dep('bars', lvPtr('r1')), dep('bars', lvPtr('r2'))]);
const techRange = () => prov('bars', lvPtr('r3'), 'Plus haut du 18 juin, clôture du 29 juillet et ATR de Wilder sur quatorze séances rapporté au close.', [dep('bars', B + '/' + idx('2026-07-29') + '/4'), dep('bars', B + '/' + N + '/4')]);

function sourceFor(p) {
  if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
  const sh = p.match(/^meta\.statusHistory\.(\d+)\.(.+)$/);
  if (sh) return sh[2] === 'at' ? prov('status', '/captured_at', 'Horodatage de la refonte.') : prov('bars', B + '/' + N + '/4', 'Clôture de référence et date de la refonte.', [dep('bars', B + '/' + N + '/0')]);
  if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
  const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
  if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === K.evidenceUrl(T)) return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
  if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
  if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
  if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
  if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
  if (p === 'meta.description' || p === 'meta.ogDescription' || p === 'verdict.whyAvoid.0' || p.startsWith('globalScore.keyTakeawaysNegative')) return dilution();
  if (p.startsWith('header.metrics.') || p === 'verdict.whyAvoid.2') return marketMath();
  if (p === 'verdict.whyAvoid.3') return techRange();
  if (p === 'verdict.whyAvoid.4') return insiderProv();
  if (p === 'verdict.whyAvoid.5') return prov('bars', lvPtr('r0'), 'Plus haut du 2 juillet ; R/R = (plus haut du 2 juillet − déclencheur) / (déclencheur − stop).', [dep('bars', lvPtr('trigger')), dep('bars', lvPtr('stop'))]);
  if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
  if (p === 'macro.impact') return prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence ; rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (daily/20260924/primary-reference.json) ; date de Micron lue dans le calendrier collecté.', [dep('earn', '/events')]);
  if (p === 'verdict.summary') return prov('bars', B + '/' + N + '/4', 'Rendements de Marvell et du panier SMH sur barres certifiées ; revenus, prévision et instruments dilutifs lus dans les dépôts ; multiple calculé ; niveaux lus par date.', [dep('comparison', C('SMH')), dep('bars', lvPtr('trigger')), dep('bars', lvPtr('abandon')), dep('primary', '/documents/0'), dep('primary', '/documents/1'), dep('primary', '/documents/2'), dep('primary', '/documents/3'), dep('primary', '/documents/5')]);
  if (p === 'verdict.whyBuy.1') return prov('primary', '/documents/0', 'Croissance séquentielle = 3 150 M$ / 2 739,3 M$ − 1.', [dep('primary', '/documents/1')]);
  if (p === 'verdict.whyBuy.2') return P(2);
  if (p === 'verdict.whyBuy.3') return P(3);
  if (p === 'verdict.whyBuy.4' || p === 'verdict.whyAvoid.1') return P(1);
  if (p.startsWith('verdict.whyBuy.') || p.startsWith('earnings.')) return prov('primary', '/documents/0', 'Chiffres du communiqué ; part des centres de données = 2 171,5 / 2 739,3 M$ (10-Q).', [dep('primary', '/documents/1')]);
  if (p.startsWith('verdict.controlChecklist.')) return prov('bars', B, 'Continuité vérifiée sur les barres certifiées ; calendrier collecté ; journée investisseurs lue dans le communiqué.', [dep('earn', '/events'), dep('primary', '/documents/0')]);
  if (p.startsWith('news.0.')) return prov('primary', '/documents/0', 'Communiqué du 27 août ; réaction du 28 août sur barres certifiées.', [dep('bars', B + '/' + idx('2026-08-28') + '/4')]);
  if (p.startsWith('news.1.')) return prov('primary', '/documents/2', 'Dépôt du 19 août ; réaction du jour comparée au panier SMH.', [dep('bars', B + '/' + idx('2026-08-19') + '/4'), dep('comparison', C('SMH'))]);
  if (p.startsWith('news.2.')) return P(7);
  if (p.startsWith('news.3.')) return P(3);
  if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
  if (p.startsWith('technicals.badges')) return prov('bars', B, 'Plus haut, MACD et extension calculés sur les barres certifiées.', [dep('bars', lvPtr('trigger'))]);
  const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
  if (sr) return lvlProv({ supports: ['stop', 'abandon', 's3'], resistances: ['r0', 'r1', 'r2'] }[sr[1]][+sr[2]]);
  if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, déclencheur, stop, abandon, supports et résistances lus sur les barres certifiées ; extension = close / EMA20 − 1 ; ATR de Wilder.', ['trigger', 'stop', 'abandon', 's3', 'r0', 'r1', 'r2'].map(k => dep('bars', lvPtr(k))));
  if (p.startsWith('business.segments.') || p === 'business.overview') return prov('primary', '/documents/1', 'Revenus par marché, complément Celestial et réévaluation lus dans le 10-Q ; prévision et commentaires du communiqué ; accord Google et préférence NVIDIA lus dans les 8-K ; parts = marché / revenus totaux.', [dep('primary', '/documents/0'), dep('primary', '/documents/2'), dep('primary', '/documents/3')]);
  if (p.startsWith('business.coverageMatrix.')) return prov('bars', B, 'Matrice de couverture de la collecte.');
  const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
  if (fm) { const i = +fm[1]; if (i === 1 || i === 2) return prov('primary', '/documents/0', 'Communiqué ; revenus par marché et du trimestre lus dans le 10-Q ; croissance séquentielle = 3 150 / 2 739,3 − 1.', [dep('primary', '/documents/1')]); if (i <= 3) return P(0); if (i <= 6) return P(1); if (i <= 11) return gaap(); if (i === 12) return P(1); return marketMath(); }
  if (p.startsWith('capitalStructure.warrants.')) return dilution();
  if (p.startsWith('capitalStructure.sharesOutstanding') || p.startsWith('capitalStructure.sharesAuthorized')) return prov('primary', '/documents/1', 'Actions ordinaires au 21 août (page de garde), actions de préférence et autorisations lues dans le 10-Q.', [dep('primary', '/documents/3')]);
  if (p.startsWith('capitalStructure.')) return prov('primary', '/documents/1', 'Actions diluées, rachats et complément Celestial lus dans le 10-Q ; actions émises pour Celestial lues dans le 8-K/A ; bon de Google lu dans le 8-K du 19 août.', [dep('primary', '/documents/4'), dep('primary', '/documents/2')]);
  if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
  if (p === 'filingsReview.contrarianRisks.0') return dilution();
  if (p === 'filingsReview.contrarianRisks.2') return techRange();
  if (p.startsWith('filingsReview.')) return prov('primary', '/documents/1', 'Concentration, dilution et calendrier lus dans les dépôts.', [dep('primary', '/documents/0'), dep('primary', '/documents/2')]);
  if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
  if (p.startsWith('insiders.')) return insiderProv();
  if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov('comparison', C(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
  if (p === 'blastRadius.window') return prov('comparison', C('SMH'), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
  const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
  if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
  if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; if (/readThrough$/.test(p) && row.ticker === 'GOOGL') return P(2); if (/readThrough$/.test(p) && row.ticker === 'NVDA') return P(3); return prov('comparison', C(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta MRVL sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
  if (p.startsWith('blastRadius.contradictions.')) return moveProv();
  if (p.startsWith('blastRadius.scenarios.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; journée investisseurs lue dans le communiqué.', [dep('bars', lvPtr('abandon')), dep('primary', '/documents/0')]);
  if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.', [dep('client', '')]);
  if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
  if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
  if (p.startsWith('tradeIdea.')) return prov('bars', lvPtr('trigger'), 'Niveaux lus sur les barres certifiées ; plafond, objectifs et taille calculés ; liquidité = médiane close × volume sur vingt séances ; date de Micron tirée des calendriers de données, journée investisseurs annoncée par l’émetteur ; exécutabilité : ' + X.method, [dep('bars', lvPtr('r0')), dep('bars', lvPtr('stop')), dep('bars', lvPtr('abandon')), dep('bars', lvPtr('r1')), dep('bars', lvPtr('r2')), dep('bars', B), dep('earn', '/events'), dep('primary', '/documents/0')]);
  if (p.startsWith('risks.')) return prov('primary', '/documents/1', 'Concentration et complément Celestial lus dans le 10-Q ; bon de Google lu dans le 8-K ; multiple, gaps et liquidité calculés sur les barres certifiées.', [dep('primary', '/documents/2'), dep('bars', B), dep('bars', lvPtr('r3'))]);
  if (p.startsWith('verdict.')) return P(0);
  if (p.startsWith('globalScore.') || p.startsWith('meta.') || p.startsWith('business.') || p === 'disclaimer') return P(0);
  throw Error('provenance manquante ' + p);
}
const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a, inputs, sourceFor, score,
  valuation: { basis: 'GAAP douze mois au 2026-08-01, actions de préférence converties ; valeur d’entreprise réduite de 30 % = hypothèse éditoriale (multiple courant × 0,7)', ...scn },
  extra: { gaap_inputs_millions: { K10, BAL }, technicals_recomputed: tech, levels: { exec: X, r0, rrR0, r0OverCap, fullVestPurchases, entry, stop, abandon, tp1, tp2, rr1, rr2, cap, capRr, sizeExample, adv, extension, junePeak, julyLow, atrPct },
    derived: { potential, dilutionPct, warrantPct, prefPct, earnPct, tranche, trancheIntrinsic, rebatePct, q3Seq, dcShare, ev, marketCap, move }, insiders: { murphy, koop },
    limitations: ['Options inexploitables, marché fermé.', 'Couverture officielle des formulaires 4 partielle.', 'Distributeur et client direct principaux anonymes.'] } });
K.renderPreview(a, run + '/preview/index.html');
console.log(`[MRVL] claims=${res.claims} score=${scoreValue} close=${close} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} rr2=${rr2.toFixed(2)} cap=${cap} capRr=${capRr.toFixed(2)} ev/rev=${(ev / G$.rev).toFixed(1)} ev/ebitda=${(ev / G$.ebitda).toFixed(0)} pe=${(close / EPS_RUN).toFixed(0)} scn=${scn.price.toFixed(2)} (${scn.downside_pct.toFixed(0)}%) dil=${dilutionPct.toFixed(1)} rebate=${rebatePct.toFixed(2)} tranche=${tranche.toFixed(0)} q3seq=${q3Seq.toFixed(1)} ext=${extension.toFixed(1)} atr%=${atrPct.toFixed(1)}`);
