'use strict';
// Gabarit commun des fiches v3 du lot R04 (FTNT, NOW, DELL, HPE, MDB), refonte du 24 septembre 2026.
// Dérivé du gabarit R03 (inchangé). Deux ajouts : (1) le plan de repli par ordre limité est rejoué avec
// ses bornes (annulé après une clôture sous le déclencheur, jamais actif sur une ouverture sous le stop,
// retiré si le stop est touché avant exécution) ; (2) un pair qui a sa propre fiche publiée au même close
// est cité avec le multiple publié dans cette fiche (même base, même date), lu dans son JSON et relié au
// manifeste primaire haché de ce pair.
// Chaque générateur de titre (analyses/TICKER/_runs/20260924/build-*.cjs) fournit son contenu
// éditorial et ses choix de niveaux ; ce module calcule tout le reste depuis des artefacts hachés :
// barres certifiées, agrégats GAAP lus dans les données XBRL officielles de la SEC, extraits textuels
// des dépôts ouverts, et la provenance de chaque nombre du dossier. Il ne touche ni index.html ni
// l'index du site : il écrit le JSON canonique, le sidecar de preuves et un aperçu local.
const fs = require('fs'), path = require('path');
const K = require('./analysis-v3-kit.cjs');
const X = require('./xbrl-ttm.cjs');
const { sha, bytes, read, write, esc, get, fr, usd, pct, sgn, findPath, at } = K;
const TEMPLATE = 'tools/lib/analysis-v3-r04.cjs', XBRL_LIB = 'tools/lib/xbrl-ttm.cjs';

// Rendu texte déterministe d'un dépôt HTML/iXBRL : balises retirées, entités décodées, espaces
// normalisés. Sert uniquement de support aux vérifications textuelles ; l'original reste haché.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', bull: '•', reg: '®', trade: '™', copy: '©' };
function htmlText(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/ /g, ' ').replace(/[ \t\r\n]+/g, ' ').trim() + '\n';
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dfr = d => { const [y, m, j] = d.split('-').map(Number); return (j === 1 ? '1er' : j) + ' ' + MOIS[m - 1]; };

function build(cfg) {
  const T = cfg.ticker, REF = '2026-09-23', run = `analyses/${T}/_runs/20260924`, data = `analyses/${T}/_data`, rev = run + '/revision', prim = `analyses/${T}/_primary`;
  const OUT_JSON = `data/analyses-data/${T}.json`, OUT_EVIDENCE = `data/analyses-evidence/${T}.json`, GEN = cfg.generator;

  // ------------------------------------------------------------ données de marché
  const raw = K.loadRun(data, ['bars', 'fundamentals', 'comparison_bars', 'rank_beta', 'status', 'insiders', 'short_squeeze', 'comparison_earnings', 'earnings_risk', 'sec_evidence']);
  const S = K.mainSeries(raw.bars, T, REF), { bars, N, B, idx, close, prev } = S;
  const tech = K.technicals(bars);
  const STP = findPath(raw.fundamentals, 'instrument_comprehensive_stats'), st = at(raw.fundamentals, STP);
  const TXP = findPath(raw.insiders, 'instrument_insider_transactions'), tx = TXP == null ? { transactions: [] } : at(raw.insiders, TXP);
  const cmpRows = raw.comparison_bars.data.items[0].results[0].data;
  // Client coté documenté (branche applicable) : série collectée à part, même format que les comparables.
  const cliRows = cfg.clientBars ? read(data + '/comparison_client_bars.json').data.items[0].results[0].data : [];
  const CI = t => { const i = cmpRows.findIndex(x => x.symbol === t); if (i >= 0) return ['comparison', '/data/items/0/results/0/data/' + i + '/bars']; const j = cliRows.findIndex(x => x.symbol === t); if (j >= 0) return ['client', '/data/items/0/results/0/data/' + j + '/bars']; throw Error('comparable absent ' + t); };
  const C = t => CI(t)[1];
  const { M, firstCommon } = K.comparables(cmpRows.concat(cliRows.filter(r => !cmpRows.some(x => x.symbol === r.symbol))), bars);
  const adv = K.dollarAdv(bars), ret = k => pct(close, bars[N - k][4]);
  const archivePath = run + '/original/' + T + '.json', archive = read(archivePath);

  // ------------------------------------------------------------ agrégats GAAP (XBRL officiel SEC)
  const XBRL = prim + '/companyfacts.json', cf = read(XBRL);
  const g = {};
  for (const [k, tags] of Object.entries(cfg.xbrl.ttm)) { const r = X.ttm(cf, tags, REF); if (!r) throw Error(`${T}: agrégat XBRL introuvable ${k}`); g[k] = r; }
  for (const [k, tags] of Object.entries(cfg.xbrl.instant)) { const r = X.instant(cf, tags, REF); if (!r) throw Error(`${T}: valeur de bilan XBRL introuvable ${k}`); g[k] = r; }
  const sum = keys => keys.reduce((s, k) => s + (g[k] ? g[k].value : 0), 0);
  const G$ = { rev: g.rev.value, ebit: g.ebit.value, ebitda: g.ebit.value + sum(cfg.xbrl.da), ni: g.ni.value, ocf: g.ocf ? g.ocf.value : null, capex: g.capex ? g.capex.value : null,
    debt: sum(cfg.xbrl.debt), cash: sum(cfg.xbrl.cash) };
  if (G$.ocf != null && G$.capex != null) G$.fcf = G$.ocf - G$.capex;
  // cfg.shares : nombre d'actions lu dans un dépôt quand le snapshot statistique est antérieur à ce dépôt.
  const shares = cfg.shares ? cfg.shares.value : st.sharesOutstanding, marketCap = close * shares, ev = marketCap + G$.debt - G$.cash;
  // Les faits XBRL retenus sont recopiés dans le manifeste primaire (avec leur accession et leur pointeur dans
  // companyfacts, fichier haché) : la provenance des agrégats pointe vers ce manifeste.
  const gaapFacts = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { tag: v.tag, value: v.value, parts: (v.parts || [{ value: v.value, end: v.end, form: v.form, accn: v.accn, pointer: v.pointer }]).map(q => ({ value: q.value, start: q.start, end: q.end, form: q.form, accn: q.accn, companyfacts_pointer: q.pointer })) }]));
  const xptr = k => gaapFacts[k].parts.map((q, i) => '/gaap_facts/' + k + '/parts/' + i + '/value');
  // cfg.scenarioBasis : 'ebitda' (défaut, comme R02) ou 'revenue' (multiple appliqué aux revenus GAAP douze mois).
  const basis = cfg.scenarioBasis || 'ebitda';
  const scn = { multiple: cfg.scenarioMultiple, ebitda: G$.ebitda, revenue: G$.rev, debt: G$.debt, cash: G$.cash, shares, close };
  scn.enterprise_value = scn.multiple * (basis === 'revenue' ? scn.revenue : scn.ebitda); scn.equity_value = scn.enterprise_value - scn.debt + scn.cash; scn.price = scn.equity_value / scn.shares; scn.downside_pct = (scn.price / close - 1) * 100;

  // ------------------------------------------------------------ niveaux (barres certifiées, par date)
  const L = cfg.levels;
  const lv = k => bars[idx(L[k].d)][L[k].c], lvPtr = k => `${B}/${idx(L[k].d)}/${L[k].c}`;
  const mode = cfg.mode;
  let entry, stop, tp1, tp2, abandon = L.abandon ? lv('abandon') : null, cap = null, capRr = null, rr1, rr2, range = null, sizeExample = null;
  if (mode === 'archived') {
    const t0 = archive.tradeIdea; entry = t0.entry; stop = t0.stop; tp1 = t0.tp1; tp2 = t0.tp2;
  } else {
    entry = lv('trigger'); stop = lv('stop');
    const tp = cfg.targets({ lv, entry, stop, abandon }); tp1 = +tp.tp1.toFixed(2); tp2 = +tp.tp2.toFixed(2); range = tp.range ?? null;
    // Plafond d'ouverture : cours le plus haut qui garde un R/R ≥ 1,5 vers TP1, arrondi au cent INFÉRIEUR et
    // vérifié en flottant (un arrondi au plus proche pouvait donner 1,4997 ou 1,49999…).
    cap = Math.floor((tp1 + 1.5 * stop) / 2.5 * 100) / 100;
    while ((tp1 - cap) / (cap - stop) < 1.5) cap = +(cap - 0.01).toFixed(2);
    capRr = (tp1 - cap) / (cap - stop);
    // Exemple de taille calculé au pire prix exécutable (le plafond), pas au déclencheur.
    sizeExample = Math.floor(100 / (cap - stop));
  }
  rr1 = (tp1 - entry) / (entry - stop); rr2 = tp2 != null ? (tp2 - entry) / (entry - stop) : null;
  const riskAtr = (entry - stop) / tech.atr14;

  // ------------------------------------------------------------ dépôts primaires + extraits texte
  const EDGAR = `https://www.sec.gov/Archives/edgar/data/${cfg.cik}/`;
  const docs = cfg.docs.map(([date, form, accession, file, local, finding, cik]) => {
    const base = cik ? `https://www.sec.gov/Archives/edgar/data/${cik}/` : EDGAR;
    const p = `${prim}/${local}`, tp = `${prim}/text/${local}.txt`;
    fs.mkdirSync(path.join(K.root, prim, 'text'), { recursive: true });
    fs.writeFileSync(path.join(K.root, tp), htmlText(bytes(p).toString('utf8')));
    return { date, form, accession, url: `${base}${accession.replace(/-/g, '')}/${file}`, finding, path: p, sha256: sha(bytes(p)), text_path: tp, text_sha256: sha(bytes(tp)) };
  });
  const semantic = {};
  for (const [id, [i, needles]] of Object.entries(cfg.needles)) {
    const text = bytes(docs[i].text_path).toString('utf8');
    for (const n of needles) if (!text.includes(n)) throw Error(`${T}: extrait absent ${id}: ${n}`);
    semantic[id] = { source_path: docs[i].text_path, source_sha256: docs[i].text_sha256, source_needles: needles, raw_document: docs[i].path, raw_sha256: docs[i].sha256 };
  }
  const primary = { kind: 'primary_sec_manifest_v1', ticker: T, as_of: '2026-09-24', inventory_count: cfg.inventory, inventory_screened_count: cfg.inventory,
    opened_count: docs.length, reviewed_count: docs.length, decision_relevant_count: docs.length, local_primary_count: docs.length,
    review_scope: cfg.reviewScope, text_rendering: 'Balises retirées, entités décodées, espaces normalisés par ' + TEMPLATE + ' (htmlText) ; les vérifications textuelles portent sur ce rendu, le document brut reste haché.',
    documents: docs, semantic_findings: semantic,
    xbrl_companyfacts: { path: XBRL, sha256: sha(bytes(XBRL)), url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(cfg.cik).padStart(10, '0') + '.json', method: 'Douze mois glissants = cumul de l’exercice au dernier 10-Q + dernier exercice annuel − cumul de même durée de l’exercice précédent ; bilan = dernière valeur publiée au plus tard à la clôture de référence (' + XBRL_LIB + ').' },
    gaap_facts: gaapFacts };
  write(rev + '/primary-manifest.json', primary);

  // Fréquence des écarts d'ouverture : sur les 250 dernières séances, ouvertures au-dessus de la clôture de la
  // veille de plus que `buf`, et écart absolu médian. Sert à chiffrer le risque d'annulation par le plafond.
  const gapStats = buf => { const g = []; for (let i = N - 249; i <= N; i++) g.push(bars[i][1] - bars[i - 1][4]); const abs = g.map(Math.abs).sort((x, y) => x - y); return { up: g.filter(x => x > buf).length, total: g.length, medAbs: abs[Math.floor(abs.length / 2)] }; };
  // Cassures passées d'un plus haut de vingt séances : part des clôtures de cassure tombées à moins de `pctBuf` (en %
  // du niveau cassé) au-dessus de ce niveau, puis part de celles-ci dont l'ouverture suivante est restée sous le même
  // seuil. Mesure descriptive, relative au prix, de la fenêtre d'achat laissée par le plafond, sur toute la série.
  const breakoutStats = pctBuf => { let n = 0, inBand = 0, buyable = 0;
    for (let i = 21; i < N; i++) { let lvl = -Infinity; for (let j = i - 20; j < i; j++) lvl = Math.max(lvl, bars[j][2]);
      if (bars[i][4] > lvl && bars[i - 1][4] <= lvl) { n++; const lim = lvl * (1 + pctBuf / 100); if (bars[i][4] <= lim) { inBand++; if (bars[i + 1][1] <= lim) buyable++; } } }
    return { n, inBand, buyable }; };
  // Repli borné, rejoué séance par séance sur les cassures d'un plus haut de vingt séances non achetables à
  // l'ouverture (clôture de cassure ou ouverture suivante au-delà du seuil `pctBuf`, en % du niveau cassé) :
  // l'ordre limité est retiré avant toute ouverture sous le stop (`pctStop` % sous le niveau), exécuté à
  // l'ouverture si elle est sous le seuil, sinon si le plus bas l'atteint ; il est annulé après une clôture
  // sous le niveau cassé ; `k` séances au plus. `stopSame` compte les exécutions dont la séance touche aussi
  // le stop ; `fillCloseUnder` celles dont la séance d'exécution clôture sous le niveau cassé. Une clôture sous
  // le niveau implique un plus bas sous le seuil, donc une exécution préalable dans la même séance : la borne
  // « annulé après une clôture sous le déclencheur » ne peut jamais agir seule et n'est pas comptée à part.
  // Définition de la cassure identique au gabarit R03 : première clôture au-dessus du plus haut des vingt
  // séances précédentes, la veille ayant clôturé à ce niveau ou dessous.
  const retestStats = (pctBuf, pctStop, k = 3) => { const pb = pctBuf / 100, ps = pctStop / 100; let miss = 0, back = 0, stopSame = 0, gapUnder = 0, fillCloseUnder = 0;
    for (let i = 21; i < N - k; i++) { let lvl = -Infinity; for (let j = i - 20; j < i; j++) lvl = Math.max(lvl, bars[j][2]);
      if (!(bars[i][4] > lvl && bars[i - 1][4] <= lvl)) continue; const lim = lvl * (1 + pb), sl = lvl * (1 - ps);
      if (bars[i][4] <= lim && bars[i + 1][1] <= lim) continue; miss++;
      for (let q = i + 1; q <= i + k; q++) { const [, o, , l, cl] = bars[q];
        if (o < sl) { gapUnder++; break; }
        if (o <= lim || l <= lim) { back++; if (l <= sl) stopSame++; if (cl < lvl) fillCloseUnder++; break; } } }
    return { miss, back, stopSame, gapUnder, fillCloseUnder, k }; };
  const peerRaw = cfg.peers ? read(data + '/comparison_context.json') : null, peerPtr = {};
  if (peerRaw) (function walk(o, q) { if (o && typeof o === 'object') { if (o.type === 'instrument_comprehensive_stats' && o.symbol) peerPtr[o.symbol] = q; for (const [k, v] of Object.entries(o)) walk(v, q + '/' + k); } })(peerRaw, '');
  const peerStat = (sym, field = 'enterpriseToEbitda') => { const q = peerPtr[sym]; if (q == null) throw Error('pair absent ' + sym); const v = at(peerRaw, q)[field]; if (typeof v !== 'number') throw Error('multiple absent ' + sym + ' ' + field); return v; };
  const peerEv = sym => peerStat(sym);
  // Pairs dotés d'une fiche publiée au même close : multiple repris tel que publié (même libellé de ligne).
  // La fiche du pair est hachée à la lecture : son sha256 doit égaler celui épinglé dans le générateur
  // (cfg.peerFicheSha), sinon la construction échoue ; chaque lecture est consignée dans l'artefact de calcul.
  const peerFicheLog = [];
  const peerFiche = (sym, metric) => { const fp = 'data/analyses-data/' + sym + '.json', h = sha(bytes(fp));
    const pin = (cfg.peerFicheSha || {})[sym]; if (pin !== h) throw Error('fiche pair ' + sym + ' non épinglée ou modifiée : ' + h);
    const f = read(fp);
    if (f.meta.levelsCloseDate !== REF || f.meta.version !== 3) throw Error('fiche pair non alignée ' + sym);
    const i = f.fundamentals.rows.findIndex(r => r.metric === metric); if (i < 0) throw Error('multiple absent de la fiche ' + sym + ' : ' + metric);
    const row = f.fundamentals.rows[i]; peerFicheLog.push({ symbol: sym, path: fp, sha256: h, pointer: '/fundamentals/rows/' + i + '/value', metric, value: row.value });
    return { value: row.value, signal: row.signal }; };
  const peerManifest = sym => { const d = fs.readdirSync(path.join(K.root, 'analyses', sym, '_runs')).filter(x => x === '20260924'); if (!d.length) throw Error('manifeste pair absent ' + sym); return 'analyses/' + sym + '/_runs/20260924/revision/primary-manifest.json'; };
  const extra = Object.fromEntries((cfg.extraInputs || []).map(x => [x.name, read(x.path)]));
  const nb = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const ctx = { nb, peerFiche, gapStats, breakoutStats, retestStats, peerEv, peerStat, extra, T, REF, K, fr, usd, pct, sgn, dfr, close, prev, bars, N, tech, st, M, adv, ret, G$, g, shares, marketCap, ev, scn, lv, entry, stop, tp1, tp2, abandon, cap, capRr, rr1, rr2, riskAtr, range, sizeExample,
    archive, docs, raw, tx, EDGAR, evidenceUrl: K.evidenceUrl(T),
    ref: i => ({ name: cfg.shortName + ' ' + docs[i].form, url: docs[i].url, date: docs[i].date }),
    market: name => ({ name: 'Données de marché datées (provenance hashée) : ' + name, url: K.evidenceUrl(T), date: '2026-09-24' }) };
  const a = cfg.compose(ctx);

  // ------------------------------------------------------------ blast radius
  const evNote = (t, cls) => (cfg.eventRisk && cfg.eventRisk[t]) || cfg.eventDefault[cls];
  a.blastRadius = {
    asOf: REF, observationTime: raw.status.captured_at,
    window: 'Rendements quotidiens communs du ' + firstCommon + ' au ' + REF,
    methodology: 'Les séries sont alignées sur les mêmes dates de clôture et converties en rendements logarithmiques journaliers communs, depuis la fin mars. La corrélation mesure le co-mouvement ; le bêta mesure la sensibilité du rendement de ' + cfg.shortName + ' à celui du comparable ; le R² est la corrélation au carré. Les rendements à cinq et vingt et une séances sont des rendements simples de clôture à clôture, sans dividendes. Les groupes sont définis par le lien économique, pas par la corrélation.',
    groups: cfg.groups.map(gr => ({ name: gr.name, order: gr.order, transmission: gr.transmission,
      symbols: gr.rows.map(([ticker, relationClass, role, readThrough]) => { if (!M[ticker]) throw Error('comparable sans série ' + ticker); return { ticker, role, relationClass, confidence: relationClass === 'sector_proxy' ? 'medium' : 'low', readThrough, eventRisk: evNote(ticker, relationClass), ...M[ticker] }; }) })),
    scenarios: cfg.scenarios(ctx), contradictions: cfg.contradictions(ctx), missingData: cfg.missingData(ctx),
    sourceRefs: [ctx.market('barres comparables et classement statistique'), ctx.ref(cfg.blastDoc)] };
  a.performance = { windowReturns: { label: 'Rendements de prix sur vingt et une séances, sans dividendes réinvestis', startDate: bars[N - 21][0], endDate: bars[N][0],
    rows: [{ ticker: T, returnPct: +ret(21).toFixed(2) }, ...Object.entries(M).map(([ticker, x]) => ({ ticker, returnPct: x.return21d }))] },
    sourceRefs: [ctx.market('barres quotidiennes comparées')] };

  // ------------------------------------------------------------ jugements éditoriaux
  const scoreValue = Object.values(cfg.score).reduce((s, x) => s + x, 0);
  if (a.verdict.score !== scoreValue) throw Error('score incohérent');
  const judgments = { ticker: T, score_components: cfg.score, judgments: {
    'meta.version': { value: 3, reason: 'Version du schéma de dossier individualisé, non une observation financière.' },
    'meta.date': { value: a.meta.date, reason: 'Date de construction éditoriale, distincte de la clôture de référence.' },
    'meta.dateDisplay': { value: a.meta.dateDisplay, reason: 'Date éditoriale en français, non une observation financière.' },
    'verdict.score': { value: scoreValue, reason: 'Score additif : métier, technique, capital, calendrier, dilution et base de risque.' },
    'risks.riskScore': { value: a.risks.riskScore, reason: cfg.riskScoreReason } } };
  a.blastRadius.groups.forEach((gr, i) => { judgments.judgments['blastRadius.groups.' + i + '.order'] = { value: gr.order, reason: 'Classement économique éditorial du mécanisme de transmission, pas une causalité mesurée.' }; });
  write(rev + '/editorial-judgments.json', judgments);

  // ------------------------------------------------------------ preuves
  const inputs = [];
  for (const [name, file] of [['bars', 'bars'], ['fund', 'fundamentals'], ['comparison', 'comparison_bars'], ['rank', 'rank_beta'], ['status', 'status'], ['insiders', 'insiders'], ['earn', 'comparison_earnings'], ['erisk', 'earnings_risk'], ['sec', 'sec_evidence']])
    inputs.push(K.input(name, data + '/' + file + '.json'));
  if (cfg.clientBars) inputs.push(K.input('client', data + '/comparison_client_bars.json'));
  inputs.push(K.input('primary', rev + '/primary-manifest.json', 'primary_sec_manifest_v1'), K.input('judgments', rev + '/editorial-judgments.json', 'editorial_judgment'));
  if (mode === 'archived' || (archive.meta.statusHistory || []).length || archive.meta.lastEvent) inputs.push(K.input('archive', archivePath, 'archived_analysis'));
  if (cfg.rates) inputs.push(K.input('rates', 'daily/20260924/primary-reference.json'));
  if (cfg.peers) inputs.push(K.input('context', data + '/comparison_context.json'));
  for (const x of cfg.extraInputs || []) inputs.push(K.input(x.name, x.path));
  const peerFicheSyms = [...new Set(a.fundamentals.rows.flatMap(r => r._peerFiches || []))];
  for (const sym of peerFicheSyms) inputs.push(K.input('peer_' + sym, peerManifest(sym), 'primary_sec_manifest_v1'));
  const { dep, prov } = K.provenance(inputs);
  const P = i => prov('primary', '/documents/' + i, 'Chiffre lu dans le dépôt SEC ouvert et haché.');
  const Pm = (i, extra) => prov('primary', '/documents/' + i, 'Chiffres lus dans les dépôts SEC ouverts et hachés.', (extra || []).map(j => dep('primary', '/documents/' + j)));
  const lvlProv = k => prov('bars', lvPtr(k), 'Niveau lu sur la barre certifiée du ' + L[k].d + '.');
  const gaapKeys = ['rev', 'ebit', 'ni', ...cfg.xbrl.da, ...cfg.xbrl.debt, ...cfg.xbrl.cash];
  const gaap = () => prov('primary', xptr('rev')[0], 'Agrégats GAAP lus dans les données XBRL officielles (companyfacts SEC) : douze mois glissants = cumul de l’exercice au dernier 10-Q + dernier exercice annuel − cumul de la même période de l’exercice précédent ; EBITDA = résultat opérationnel + amortissements ; dette et trésorerie = valeurs de bilan à la dernière date publiée.', gaapKeys.flatMap(k => xptr(k)).map(p => dep('primary', p)));
  const marketMath = () => prov('bars', B + '/' + N + '/4', 'Capitalisation = close × actions en circulation ; EV = capitalisation + dette − trésorerie ; ratios sur agrégats GAAP douze mois.', [cfg.shares ? dep('primary', '/documents/' + cfg.shares.doc) : dep('fund', STP + '/sharesOutstanding'), ...gaapKeys.flatMap(k => xptr(k)).map(p => dep('primary', p))]);
  const geoDeps = ['stop', 'abandon', 'r1', 'r2', 'r3', 's1', 's2', 's3'].filter(k => L[k]).map(k => dep('bars', lvPtr(k)));
  const levelsGeo = () => mode === 'archived'
    ? { ...dep('archive', '/tradeIdea'), input_name: 'archive', method: 'Géométrie du plan archivé : pourcentages depuis l’entrée archivée, R/R = gain / risque.', derivation: 'archived_trade_geometry' }
    : prov('bars', lvPtr('trigger'), cfg.levelsMethod, geoDeps);
  const byClass = r => r;

  function sourceFor(p) {
    if (cfg.route) { const r = cfg.route(p, { prov, dep, P, Pm, gaap, marketMath, lvlProv, B, N, lvPtr, STP, TXP, C, docs }); if (r) return r; }
    if (/^meta\.(lastMcpRefresh|levelsVerifiedAt)$/.test(p) || p === 'blastRadius.observationTime') return prov('status', '/captured_at', 'Horodatage exact de la collecte.');
    const sh = p.match(/^meta\.statusHistory\.(\d+)\.(.+)$/);
    const hist = archive.meta.statusHistory || [];
    if (sh && +sh[1] < hist.length) return prov('archive', '/meta/statusHistory/' + sh[1] + '/' + sh[2].split('.').map(esc).join('/'), 'Historique de cycle de vie conservé de la version précédente.');
    if (sh) return sh[2] === 'at' ? prov('status', '/captured_at', 'Horodatage de la refonte.') : prov('bars', B + '/' + N + '/4', 'Clôture de référence et date de la refonte.', [dep('bars', B + '/' + N + '/0')]);
    if (p.startsWith('meta.lastEvent.')) return prov('archive', '/meta/lastEvent/' + p.split('.')[2], 'Dernier événement de cycle de vie conservé.');
    if (judgments.judgments[p]) return prov('judgments', '/judgments/' + esc(p) + '/value', judgments.judgments[p].reason);
    const r = p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
    if (r) { const x = get(a, r[1] + '.sourceRefs.' + r[2]); if (x.url === K.evidenceUrl(T)) return prov('status', '/captured_at', 'Date de collecte, non date de cours.'); const i = docs.findIndex(d => d.url === x.url); if (i < 0) throw Error('référence inconnue ' + p); return P(i); }
    if (p === 'meta.levelsCloseDate' || p === 'blastRadius.asOf' || p === 'macro.indicators.0.value') return prov('bars', B + '/' + N + '/0', 'Dernière séance complète.');
    if (p === 'header.price' || p === 'macro.indicators.0.signal') return prov('bars', B + '/' + N + '/4', 'Clôture complète de référence.');
    if (p === 'header.changePct') return prov('bars', B + '/' + N + '/4', '100 × (close / close précédent − 1).', [dep('bars', B + '/' + (N - 1) + '/4')]);
    if (p === 'header.metrics.volume') return prov('bars', B + '/' + N + '/5', 'Volume de la séance, en millions.');
    if (p.startsWith('header.metrics.')) return marketMath();
    if (p.startsWith('macro.indicators.')) return prov('bars', B, 'Rendements simples cinq et vingt et une séances depuis les clôtures certifiées.');
    if (p === 'macro.impact') return cfg.rates ? prov('rates', '/facts/curve/y10', 'Rendement du Trésor à 10 ans lu dans la courbe officielle du Trésor américain (référence primaire du daily du 24 septembre).', [dep('bars', B + '/' + N + '/0')]) : prov('bars', B + '/' + N + '/0', 'Date de la clôture de référence.');
    if (p.startsWith('technicals.') && !/supports|resistances|setupNote|badges/.test(p)) return prov('bars', B, tech.convention + '.');
    if (p.startsWith('technicals.badges')) return prov('bars', B, 'Couloir et moyennes calculés sur les barres certifiées.', geoDeps);
    const sr = p.match(/^technicals\.(supports|resistances)\.(\d+)$/);
    if (sr) return lvlProv(cfg[sr[1]][+sr[2]]);
    if (p === 'technicals.setupNote') return prov('bars', B + '/' + N + '/4', 'Clôture, niveaux, supports et résistances lus sur les barres certifiées.', Object.keys(L).map(k => dep('bars', lvPtr(k))));
    if (p.startsWith('performance.windowReturns.')) { const m = p.match(/rows\.(\d+)/), tk = m ? a.performance.windowReturns.rows[+m[1]].ticker : T; return tk === T ? prov('bars', B, 'Rendement simple vingt et une séances.') : prov(...CI(tk), 'Rendement simple vingt et une séances, sans dividendes.'); }
    if (p === 'blastRadius.window') return prov('comparison', C(cfg.groups[0].rows[0][0]), 'Première et dernière date communes aux séries alignées.', [dep('bars', B)]);
    const bm = p.match(/^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\./);
    if (bm && /eventRisk$/.test(p)) return prov('earn', '/events', 'Calendrier de résultats des comparables sur quatorze jours ; seules les publications datées y figurent.');
    if (bm) { const row = a.blastRadius.groups[+bm[1]].symbols[+bm[2]]; return prov(...CI(row.ticker), 'Rendements log communs ; corrélation de Pearson ; bêta ' + T + ' sur comparable = covariance / variance du comparable ; R² = corrélation au carré ; rendements simples cinq et vingt et une séances.', [dep('bars', B)]); }
    if (p.startsWith('blastRadius.scenarios.')) return prov('bars', B + '/' + N + '/4', 'Niveaux lus sur les barres certifiées ; prévisions lues dans les dépôts.', [...geoDeps, dep('primary', '/documents/0')]);
    if (p.startsWith('blastRadius.')) return prov('rank', '', 'Contrôle de couverture statistique et relations économiques documentées.', [dep('primary', '/documents/0')]);
    if (mode === 'archived' && /^tradeIdea\.(entry|stop|tp1|tp2)$/.test(p)) return prov('archive', '/tradeIdea/' + p.split('.')[1], 'Niveau du plan archivé, conservé à l’identique.');
    if (mode === 'archived' && p === 'tradeIdea.archiveReferenceClose') return prov('archive', '/meta/levelsCloseDate', 'Clôture de référence du plan archivé.');
    if (/^tradeIdea\.(entry|stop)$/.test(p)) return lvlProv(p.split('.')[1] === 'entry' ? 'trigger' : 'stop');
    if (/^tradeIdea\.(tp1|tp2|stopPct|tp1Pct|tp2Pct|rr)$/.test(p)) return levelsGeo();
    if (p.startsWith('tradeIdea.')) return prov('bars', B + '/' + N + '/4', 'Niveaux lus sur les barres certifiées ; plafond, objectifs et taille calculés ; liquidité = médiane close × volume sur vingt séances.', [...geoDeps, dep('bars', B), dep('primary', '/documents/0')]);
    if (p.startsWith('shortInterest.')) return prov('fund', STP, 'Positions vendeuses et jours de couverture du snapshot statistique ; aucune date de règlement inférée.');
    if (p.startsWith('insiders.')) return prov('insiders', TXP == null ? '' : TXP + '/transactions', 'Formulaires 4 relevés ; cumuls par dirigeant ; couverture officielle partielle.', [dep('sec', '')]);
    const fm = p.match(/^fundamentals\.rows\.(\d+)\./);
    if (fm) { const row = a.fundamentals.rows[+fm[1]]; return row._src === 'gaap' ? gaap() : row._src === 'market' ? marketMath() : Pm(row._src, row._also); }
    if (/^filingsReview\.filings\.\d+\./.test(p)) return P(+p.split('.')[2]);
    const sec = p.split('.')[0];
    const secDoc = (cfg.sectionDocs && cfg.sectionDocs[sec]) || [0];
    return Pm(secDoc[0], secDoc.slice(1));
  }
  // Les champs techniques internes (_src/_also) servent à la provenance et sont retirés du dossier publié.
  const srcMap = a.fundamentals.rows.map(r => ({ _src: r._src, _also: r._also, _peers: r._peers, _peerField: r._peerField || 'enterpriseToEbitda', _peerFiches: r._peerFiches }));
  const FIELD_LABEL = { enterpriseToEbitda: 'EV/EBITDA', enterpriseToRevenue: 'EV/revenus' };
  const withPeers = (base, peers, field) => peers && peers.length ? { ...base, method: base.method + ' Pairs : ' + (FIELD_LABEL[field] || field) + ' courant des statistiques du 24 septembre (non point-in-time).', additional_inputs: [...(base.additional_inputs || []), ...peers.map(sym => dep('context', peerPtr[sym] + '/' + field))] } : base;
  const aOut = JSON.parse(JSON.stringify(a)); aOut.fundamentals.rows.forEach(r => { delete r._src; delete r._also; delete r._peers; delete r._peerField; delete r._peerFiches; });
  const withPeerFiches = (base, syms) => syms && syms.length ? { ...base, method: base.method + ' Pairs à fiche publiée (' + syms.join(', ') + ') : multiple repris tel que publié dans leur propre fiche au close du ' + REF + ', même base ; dépôts et, s’il existe, agrégat de revenus GAAP de ces pairs lus dans leur manifeste primaire haché.', additional_inputs: [...(base.additional_inputs || []), ...syms.map(sym => dep('peer_' + sym, (read(peerManifest(sym)).gaap_facts || {}).rev ? '/gaap_facts/rev/value' : '/documents'))] } : base;
  const sourceForOut = p => { const fm = p.match(/^fundamentals\.rows\.(\d+)\./); if (fm) { const s = srcMap[+fm[1]]; return withPeerFiches(withPeers(s._src === 'gaap' ? gaap() : s._src === 'market' ? marketMath() : Pm(s._src, s._also), s._peers, s._peerField), s._peerFiches); } return sourceFor(p); };
  // Enregistrement du scénario : le validateur rejoue le multiple sur sa base déclarée (`metric`), EBITDA ou revenus.
  // Aucun multiple d'EBITDA « équivalent » n'est écrit : le champ `multiple` est toujours le multiple réellement retenu.
  const valuationRecord = { basis: cfg.valuationBasis, metric: basis, ...scn };
  const res = K.writeEvidence({ ticker: T, ref: REF, outJson: OUT_JSON, outEvidence: OUT_EVIDENCE, calcPath: rev + '/numeric-evidence.json', generator: GEN, a: aOut, inputs, sourceFor: sourceForOut, score: cfg.score,
    valuation: valuationRecord,
    extra: { template_path: TEMPLATE, template_sha256: sha(bytes(TEMPLATE)), xbrl_lib_path: XBRL_LIB, xbrl_lib_sha256: sha(bytes(XBRL_LIB)),
      gaap_ttm_usd: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { tag: v.tag, value: v.value, parts: v.parts || [{ value: v.value, end: v.end, form: v.form, accn: v.accn, pointer: v.pointer }] }])), derived: G$,
      technicals_recomputed: tech, levels: { mode, entry, stop, abandon, range, tp1, tp2, rr1, rr2, cap, capRr, riskAtr, sizeExample, adv },
      peer_fiches: peerFicheLog, limitations: cfg.limitations } });
  K.renderPreview(aOut, run + '/preview/index.html');
  console.log(`[${T}] claims=${res.claims} score=${scoreValue} close=${close} mode=${mode} entry=${entry} stop=${stop} tp1=${tp1} tp2=${tp2} rr1=${rr1.toFixed(2)} cap=${cap} riskATR=${riskAtr.toFixed(2)} ev/rev=${(ev / G$.rev).toFixed(2)} ev/ebitda=${(ev / G$.ebitda).toFixed(1)} pe=${(marketCap / G$.ni).toFixed(1)} scn=${scn.price.toFixed(2)}`);
  return { a: aOut, ctx };
}

module.exports = { build, htmlText, dfr };
