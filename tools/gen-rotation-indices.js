#!/usr/bin/env node
'use strict';
/** Rotation dans les grands indices : S&P 500, Nasdaq 100, Dow Jones, plus les places étrangères
 * cotées à New York (Kospi via EWY, Euro Stoxx 50 via FEZ...). Collecte scriptée, sans LLM.
 *
 *   REFDATE=YYYY-MM-DD [AS_OF_TIMESTAMP=...] [EVENT_BASE=YYYY-MM-DD EVENT_LABEL="..."] \
 *     node tools/gen-rotation-indices.js [--catalogue] [--snapshot chemin.json]
 *
 * Sorties : data/rotation-indices.json (lu par /rotation/), journal brut dans .agent/rotation-indices/.
 * Fiabilité :
 *  - toutes les barres passent marketdata-bars-contract (calendrier US, clôture REFDATE certifiée) ;
 *    les indices étrangers bruts (^KS11, ^STOXX50E...) n'ont pas de calendrier certifiable côté
 *    serveur : on publie leurs ETF cotés à New York, en dollars, et on le dit ;
 *  - un membre sans barre valide est exclu et compté ; sous 97 % de couverture d'un indice, on bloque ;
 *  - capitalisation = quote à la clôture REFDATE ; pondération = nombre d'actions actuel (buy and hold),
 *    donc un niveau de groupe se rebase exactement sur n'importe quelle date ;
 *  - appartenance aux indices, secteurs et thèmes = instantané courant du fournisseur, pas d'historique.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mcp = require('./lib/mcp-client');
const calendar = require('./lib/market-calendar');
const barsContract = require('./lib/marketdata-bars-contract');

const ROOT = path.resolve(__dirname, '..');
const CALENDAR = 'us_equity_exchange_sessions';
const MIN_COVERAGE = 0.97;
const UNI = 'stockanalysis_current_snapshot:us:';
const sha = v => crypto.createHash('sha256').update(v).digest('hex');

const INDICES = [
  { key: 'sp500', label: 'S&P 500', id: UNI + 'index:sp500', proxy: 'SPY', minTheme: 5 },
  { key: 'ndx', label: 'Nasdaq-100', id: UNI + 'index:nasdaq100', proxy: 'QQQ', minTheme: 3 },
  { key: 'dow', label: 'Dow Jones', id: UNI + 'index:dow30', proxy: 'DIA', minTheme: 2 },
];
const SECTORS = [
  ['technology', 'Technologie', 'growth'], ['communication_services', 'Communication', 'growth'],
  ['consumer_discretionary', 'Conso. discrétionnaire', 'cyclical'], ['financials', 'Financières', 'cyclical'],
  ['industrials', 'Industrie', 'cyclical'], ['materials', 'Matériaux', 'cyclical'], ['energy', 'Énergie', 'cyclical'],
  ['healthcare', 'Santé', 'defensive'], ['consumer_staples', 'Conso. de base', 'defensive'],
  ['utilities', 'Services aux collectivités', 'defensive'], ['real_estate', 'Immobilier', 'defensive'],
];
const STYLES = { growth: 'Croissance et technologie', cyclical: 'Cycliques', defensive: 'Défensives' };
// Thèmes du fournisseur retenus, libellés français. Un slug absent du catalogue est ignoré et journalisé.
const THEMES = {
  ai: 'Intelligence artificielle', semiconductors: 'Semi-conducteurs', semiconductor_equipment: 'Équipements de semi-conducteurs',
  software: 'Logiciel', cloud_computing: 'Cloud', cybersecurity: 'Cybersécurité', data_centers: 'Data centers', hardware: 'Matériel informatique',
  banking: 'Banques', insurance: 'Assurance', fintech: 'Fintech', investment_management: 'Gestion d’actifs', capital_markets: 'Marchés de capitaux',
  payment_processing: 'Paiements', pharma: 'Pharmacie', biotech: 'Biotechnologie', medtech: 'Technologies médicales',
  health_insurance: 'Assurance santé', hospital_management: 'Hôpitaux', defense: 'Défense', aerospace: 'Aéronautique',
  oil_gas_exploration: 'Pétrole et gaz', oil_refining: 'Raffinage', natural_gas: 'Gaz naturel', utilities: 'Services aux collectivités',
  nuclear_energy: 'Nucléaire', power_generation: 'Production d’électricité', renewable_energy: 'Énergies renouvelables', solar_energy: 'Solaire',
  homebuilding: 'Constructeurs de maisons', construction_materials: 'Matériaux de construction', retail: 'Distribution', ecommerce: 'Commerce en ligne',
  restaurant: 'Restauration', travel_leisure: 'Voyages et loisirs', airlines: 'Compagnies aériennes', luxury: 'Luxe', automotive: 'Automobile',
  trucking: 'Transport routier', rail_transport: 'Ferroviaire', logistics: 'Logistique', reit: 'Foncières (REIT)', gold: 'Or', copper: 'Cuivre',
  mining: 'Mines', chemicals: 'Chimie', telecom: 'Télécoms', media: 'Médias', streaming: 'Streaming', advertising: 'Publicité',
  robotics: 'Robotique', quantum_computing: 'Informatique quantique', space: 'Spatial', food_beverage: 'Alimentation et boissons', grocery: 'Épiceries',
};
// ETF cotés à New York : régions, tailles, styles, facteurs de risque, autres actifs.
const ETFS = [
  ['SPY', 'S&P 500', 'region', 'États-Unis'], ['DIA', 'Dow Jones', 'region', 'États-Unis'], ['QQQ', 'Nasdaq-100', 'region', 'États-Unis'],
  ['IWM', 'Russell 2000', 'region', 'États-Unis'], ['FEZ', 'Euro Stoxx 50', 'region', 'Europe'], ['VGK', 'Europe (FTSE Developed)', 'region', 'Europe'],
  ['EWG', 'Allemagne (MSCI)', 'region', 'Europe'], ['EWQ', 'France (MSCI)', 'region', 'Europe'], ['EWU', 'Royaume-Uni (MSCI)', 'region', 'Europe'],
  ['EWI', 'Italie', 'region', 'Europe'], ['EWP', 'Espagne', 'region', 'Europe'], ['EWL', 'Suisse', 'region', 'Europe'],
  ['EWY', 'Corée du Sud (MSCI Korea)', 'region', 'Asie'], ['EWJ', 'Japon (MSCI)', 'region', 'Asie'], ['EWT', 'Taïwan', 'region', 'Asie'],
  ['MCHI', 'Chine', 'region', 'Asie'], ['EWH', 'Hong Kong', 'region', 'Asie'], ['INDA', 'Inde', 'region', 'Asie'],
  ['EWZ', 'Brésil', 'region', 'Amériques'], ['EWW', 'Mexique', 'region', 'Amériques'], ['EWC', 'Canada', 'region', 'Amériques'],
  ['EEM', 'Émergents', 'region', 'Monde'], ['ACWX', 'Monde hors États-Unis', 'region', 'Monde'],
  ['OEF', 'S&P 100 (méga-capitalisations)', 'size', 'Taille'], ['RSP', 'S&P 500 équipondéré', 'size', 'Taille'],
  ['MDY', 'Moyennes capitalisations (S&P 400)', 'size', 'Taille'], ['IJR', 'Petites capitalisations (S&P 600)', 'size', 'Taille'],
  ['IWF', 'Croissance (Russell 1000 Growth)', 'style', 'Style'], ['IWD', 'Valeur (Russell 1000 Value)', 'style', 'Style'],
  ['SPHB', 'Bêta élevé (S&P 500 High Beta)', 'risk', 'Risque'], ['SPLV', 'Faible volatilité (S&P 500 Low Vol)', 'risk', 'Risque'],
  ['MTUM', 'Momentum', 'risk', 'Risque'], ['QUAL', 'Qualité', 'risk', 'Risque'], ['USMV', 'Volatilité minimale', 'risk', 'Risque'],
  ['SCHD', 'Dividendes', 'risk', 'Risque'],
  ['TLT', 'Obligations du Trésor 20 ans et +', 'cross', 'Autres actifs'], ['HYG', 'Obligations à haut rendement', 'cross', 'Autres actifs'],
  ['LQD', 'Obligations d’entreprise notées', 'cross', 'Autres actifs'], ['GLD', 'Or', 'cross', 'Autres actifs'],
  ['SLV', 'Argent', 'cross', 'Autres actifs'], ['USO', 'Pétrole (WTI)', 'cross', 'Autres actifs'], ['UUP', 'Dollar (DXY)', 'cross', 'Autres actifs'],
  ['IBIT', 'Bitcoin (ETF au comptant)', 'cross', 'Autres actifs'],
  ['XLK', 'Technologie', 'sector', 'Secteurs SPDR'], ['XLC', 'Communication', 'sector', 'Secteurs SPDR'], ['XLY', 'Conso. discrétionnaire', 'sector', 'Secteurs SPDR'],
  ['XLF', 'Financières', 'sector', 'Secteurs SPDR'], ['XLI', 'Industrie', 'sector', 'Secteurs SPDR'], ['XLB', 'Matériaux', 'sector', 'Secteurs SPDR'],
  ['XLE', 'Énergie', 'sector', 'Secteurs SPDR'], ['XLV', 'Santé', 'sector', 'Secteurs SPDR'], ['XLP', 'Conso. de base', 'sector', 'Secteurs SPDR'],
  ['XLU', 'Services aux collectivités', 'sector', 'Secteurs SPDR'], ['XLRE', 'Immobilier', 'sector', 'Secteurs SPDR'],
].map(([symbol, label, kind, family]) => ({ symbol, label, kind, family }));
const DUAL_CLASS = [['GOOG', 'GOOGL'], ['FOX', 'FOXA'], ['NWS', 'NWSA']];
const CAP_BUCKETS = [[500e9, 'Méga (≥ 500 Md$)'], [200e9, 'Très grandes (200-500 Md$)'], [50e9, 'Grandes (50-200 Md$)'], [20e9, 'Moyennes (20-50 Md$)'], [0, 'Plus petites (< 20 Md$)']];

function args(argv, env, now) {
  const o = { catalogue: false, snapshot: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--catalogue') o.catalogue = true;
    else if (argv[i] === '--snapshot' && argv[i + 1]) o.snapshot = argv[++i];
    else throw Error(`argument inconnu ${argv[i]}`);
  }
  o.refdate = env.REFDATE; o.asof = env.AS_OF_TIMESTAMP || now.toISOString();
  if (!o.catalogue) {
    if (!o.refdate || !calendar.isUSTradingDay(o.refdate)) throw Error('REFDATE doit être une séance US terminée');
    if (calendar.latestCompletedUSClose(new Date(o.asof)) !== o.refdate) throw Error('AS_OF_TIMESTAMP ne désigne pas REFDATE comme dernière clôture US');
  }
  o.event = env.EVENT_BASE ? { base: env.EVENT_BASE, label: env.EVENT_LABEL || 'Depuis l’événement', short: env.EVENT_SHORT || 'Événement' } : null;
  // Fenêtre événement active (data/rotation/event.json : base, label, until) tant que REFDATE <= until.
  const evFile = path.join(ROOT, 'config', 'rotation', 'event.json');
  if (!o.event && !o.catalogue && fs.existsSync(evFile)) {
    const ev = JSON.parse(fs.readFileSync(evFile, 'utf8'));
    if (ev.base && ev.until && ev.base < o.refdate && o.refdate <= ev.until) o.event = { base: ev.base, label: ev.label, short: ev.short || ev.label };
  }
  if (o.event && !calendar.isUSTradingDay(o.event.base)) throw Error('EVENT_BASE doit être une séance US');
  return o;
}
function walk(value, pred, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (!Array.isArray(value) && pred(value)) { out.push(value); return out; }
  for (const v of Object.values(value)) walk(v, pred, out);
  return out;
}
const barSymbol = s => String(s).replace(/\./g, '-');

async function main() {
  const now = new Date();
  const o = args(process.argv.slice(2), process.env, now);
  if (!mcp.canCallDirectly('marketdata')) throw Error('jeton marketdata absent ou expiré');
  const runDir = path.join(ROOT, '.agent', 'rotation-indices', `${o.refdate || 'catalogue'}-${now.toISOString().replace(/[:.]/g, '')}`);
  fs.mkdirSync(runDir, { recursive: true });
  const sources = [];
  const save = (name, payload) => { const b = JSON.stringify(payload) + '\n'; fs.writeFileSync(path.join(runDir, name), b); const h = sha(b); sources.push({ file: name, sha256: h }); return h; };
  let n = 0;
  async function call(tool, a, name) {
    let p = await mcp.callToolWithRetry('marketdata', tool, a, { timeoutMs: 120000 });
    if (p && p.job_id && ['pending', 'running'].includes(p.status)) p = await mcp.awaitJob('marketdata', p.job_id, { maxMs: 300000 });
    save(`${String(++n).padStart(3, '0')}-${name}.json`, p);
    return p;
  }
  // Pagination par octets (pagination_token) et par curseur métier (next_cursor).
  async function paged(tool, base, name) {
    const pages = []; let a = { ...base }, guard = 0;
    for (;;) {
      if (++guard > 60) throw Error(`${name}: pagination sans fin`);
      const p = await call(tool, a, name); pages.push(p);
      const pg = p.pagination || (p.data && p.data.pagination) || {};
      if (pg.has_next && pg.pagination_token) { a = { pagination_token: pg.pagination_token, page: (pg.page || 1) + 1, maxsize: base.maxsize }; continue; }
      if (pg.has_next && pg.next_cursor) { a = { ...base, cursor: pg.next_cursor }; continue; }
      return pages;
    }
  }

  if (o.catalogue) {
    const pages = await paged('ListMarketUniverses', { kinds: 'theme', region: 'US', limit: 100, maxsize: 262144 }, 'catalogue');
    const rows = walk(pages, x => typeof x.universe_id === 'string' && x.kind === 'theme');
    const uniq = new Map(rows.map(r => [r.slug, r.constituent_count]));
    console.log(JSON.stringify([...uniq].sort((a, b) => b[1] - a[1])));
    return;
  }

  // 0. Santé : clôture US certifiée = REFDATE.
  const status = await call('GetStatus', {}, 'status');
  const ready = barsContract.validateOperationReadiness(status, { equityReferenceClose: o.refdate, minimumBuild: barsContract.MIN_MARKETDATA_BUILD });
  if (ready.errors.length) throw Error('GetStatus : ' + ready.errors.join(' | '));

  // 1. Appartenances : indices, secteurs, thèmes.
  // MEMBERS_FROM=<journal d'un passage du même jour> : relit les appartenances déjà servies au lieu de
  // repaginer (le serveur limite à 32 instantanés paginés par utilisateur, puis bloque plusieurs heures).
  const membersFrom = process.env.MEMBERS_FROM ? path.resolve(ROOT, process.env.MEMBERS_FROM) : null;
  async function members(id, name) {
    let pages;
    if (membersFrom) {
      const files = fs.readdirSync(membersFrom).filter(f => f.endsWith(`-${name}.json`)).sort();
      if (!files.length) throw Error(`${name} absent de ${process.env.MEMBERS_FROM}`);
      pages = files.map(f => { const b = fs.readFileSync(path.join(membersFrom, f)); sources.push({ file: path.relative(ROOT, path.join(membersFrom, f)), sha256: sha(b) }); return JSON.parse(b); });
    } else pages = await paged('GetMarketUniverseConstituents', { universe_ids: id, limit: 2000, maxsize: 262144 }, name);
    const rows = walk(pages, x => x.universe_id === id && typeof x.canonical_symbol === 'string');
    return [...new Set(rows.filter(r => r.asset_type === 'stock' || !r.asset_type).map(r => r.canonical_symbol))].sort();
  }
  // Cache des compositions (config/rotation/membership.json, hors du site publié) : 7 jours au plus, FORCE_MEMBERS=1 pour
  // forcer. Les compositions changent rarement ; repaginer chaque soir épuiserait le quota serveur.
  const cacheFile = path.join(ROOT, 'config', 'rotation', 'membership.json');
  let cached = null;
  if (!membersFrom && !process.env.FORCE_MEMBERS && fs.existsSync(cacheFile)) {
    const b = fs.readFileSync(cacheFile), c = JSON.parse(b);
    const age = (now - Date.parse(c.fetched_at)) / 864e5;
    if (age >= 0 && age <= 7 && INDICES.every(ix => c.indices[ix.key])) { cached = c; sources.push({ file: path.relative(ROOT, cacheFile), sha256: sha(b) }); }
  }
  let indexMembers = {}, sectorOf = {}, themeMembers = {}, missingThemes = [], membersFetchedAt;
  if (cached) {
    ({ indices: indexMembers, sector_of: sectorOf, themes: themeMembers, missing_themes: missingThemes } = cached);
    membersFetchedAt = cached.fetched_at;
  } else {
    for (const ix of INDICES) indexMembers[ix.key] = await members(ix.id, `members-${ix.key}`);
    const inU = new Set(Object.values(indexMembers).flat());
    for (const [slug] of SECTORS) for (const s of await members(UNI + 'sector:' + slug, `sector-${slug}`)) if (inU.has(s)) sectorOf[s] = slug;
    const catalogue = membersFrom
      ? fs.readdirSync(membersFrom).filter(f => f.endsWith('-catalogue.json')).map(f => JSON.parse(fs.readFileSync(path.join(membersFrom, f))))
      : await paged('ListMarketUniverses', { kinds: 'theme', region: 'US', limit: 100, maxsize: 262144 }, 'catalogue');
    const themeSlugs = new Set(walk(catalogue, x => x.kind === 'theme' && typeof x.slug === 'string').map(x => x.slug));
    for (const slug of Object.keys(THEMES)) {
      if (!themeSlugs.has(slug)) { missingThemes.push(slug); continue; }
      const m = (await members(UNI + 'theme:' + slug, `theme-${slug}`)).filter(x => inU.has(x));
      if (m.length) themeMembers[slug] = m;
    }
    membersFetchedAt = membersFrom ? new Date(fs.statSync(membersFrom).mtimeMs).toISOString() : now.toISOString();
  }
  for (const ix of INDICES) if (indexMembers[ix.key].length < { sp500: 495, ndx: 98, dow: 30 }[ix.key]) throw Error(`${ix.label} : ${indexMembers[ix.key].length} membres seulement`);
  const universe = [...new Set(Object.values(indexMembers).flat())].sort();
  if (!cached) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ schema: 'rotation-membership.v1', fetched_at: membersFetchedAt, indices: indexMembers, sector_of: sectorOf, themes: themeMembers, missing_themes: missingThemes }) + '\n');
  }

  // 2. Capitalisations à la clôture REFDATE.
  const mcap = {}, quoteIssues = [];
  for (let i = 0; i < universe.length; i += 50) {
    const batch = universe.slice(i, i + 50);
    const p = await call('QueryData', { types: 'quote', symbols: batch.map(barSymbol).join(',') }, `quotes-${i / 50 + 1}`);
    const rows = walk(p, x => x.type === 'instrument_quote' && typeof x.symbol === 'string');
    const by = new Map(rows.map(r => [r.symbol, r]));
    for (const s of batch) {
      const r = by.get(barSymbol(s)) || by.get(s);
      const day = r && String(r.marketCapAsOf || r.timestamp || '').slice(0, 10);
      if (!r || !(r.marketCap > 0)) { quoteIssues.push(`${s}: capitalisation absente`); continue; }
      if (day !== o.refdate) { quoteIssues.push(`${s}: capitalisation datée ${day || 'inconnue'}`); continue; }
      mcap[s] = { cap: r.marketCap, price: r.price, hi52: r.fiftyTwoWeekHigh, lo52: r.fiftyTwoWeekLow };
    }
  }

  // 3. Barres quotidiennes certifiées (base YTD = dernière séance de l'année précédente).
  // Fenêtre de 72 séances par défaut. L'archive serveur a un trou du 21 au 24 juillet 2026 sur ~130 titres :
  // le validateur rejette toute série qui le traverse, on ne le comble pas, on démarre après.
  const start = process.env.SERIES_START || calendar.addUSTradingDays(o.refdate, -71);
  if (!calendar.isUSTradingDay(start)) throw Error('SERIES_START doit être une séance US');
  const barsOf = {}, barIssues = [];
  const want = [...new Set([...ETFS.map(e => e.symbol), ...universe.map(barSymbol)])];
  for (let i = 0; i < want.length; i += 40) {
    const batch = want.slice(i, i + 40);
    const a = { types: 'bars_daily', symbols: batch.join(','), start_date: start, end_date: o.refdate, limit: 260, force_async: true, as_of_timestamp: o.asof, completion_policy: 'completed_only' };
    const p = await call('QueryData', a, `bars-${i / 40 + 1}`);
    const rep = barsContract.validateQueryData(p, { symbols: batch.join(','), assetCalendar: CALENDAR, expectedCompletedEnd: o.refdate });
    for (const e of rep.errors) barIssues.push(e);
    for (const c of rep.healthyCells) if (c.row && Array.isArray(c.row.bars)) {
      const m = new Map(c.row.bars.filter(b => b[0] <= o.refdate && b[4] > 0).map(b => [b[0], b[4]]));
      if (m.get(o.refdate)) barsOf[c.id] = m;
    }
  }
  const spy = barsOf.SPY;
  if (!spy) throw Error('SPY sans barres certifiées : calendrier de référence absent');
  const dates = [...spy.keys()].filter(d => d >= start).sort();
  if (dates[0] !== start) throw Error(`SPY ne commence pas au ${start}`);
  if (dates[dates.length - 1] !== o.refdate) throw Error('SPY ne finit pas à REFDATE');
  const at = k => dates[Math.max(0, dates.length - 1 - k)];
  const windows = [];
  if (o.event) windows.push({ key: 'event', label: o.event.label, base: o.event.base });
  windows.push({ key: '1w', label: '1 semaine', base: at(5) }, { key: '1m', label: '1 mois', base: at(21) }, { key: '3m', label: '3 mois', base: at(63) });
  for (const w of windows) if (!dates.includes(w.base)) throw Error(`base ${w.base} absente du calendrier`);

  // 4. Calculs par titre : rendements, volatilité réalisée, momentum 3 mois avant la base événement.
  const r2 = x => Math.round(x * 100) / 100;
  const ret = (m, a, b) => (m.get(a) && m.get(b)) ? m.get(b) / m.get(a) - 1 : null;
  // Volatilité réalisée annualisée. Le bêta contre SPY a été écarté : sur 71 séances de forte rotation, les
  // corrélations au S&P 500 sont trop faibles (AAPL 0,09) pour qu'un bêta classe les titres de façon stable.
  // Mesurée sur les 41 premières séances seulement : une mesure qui recouvrirait la fenêtre lue classerait
  // « volatil » un titre parce qu'il vient de chuter (relecture contradictoire du 5 novembre 2026).
  const volDates = dates.slice(0, 41);
  function vol(m) {
    const ys = [];
    for (let i = 1; i < volDates.length; i++) { const a = m.get(volDates[i - 1]), b = m.get(volDates[i]); if (a && b) ys.push(Math.log(b / a)); }
    if (ys.length < 35) return null;
    const my = ys.reduce((s, v) => s + v, 0) / ys.length;
    return Math.sqrt(ys.reduce((s, v) => s + (v - my) ** 2, 0) / (ys.length - 1) * 252);
  }
  const momBase = o.event ? o.event.base : windows.find(w => w.key === '1w').base;
  const momStart = dates[Math.max(0, dates.indexOf(momBase) - 63)];
  const stock = {}, splitSuspects = [];
  for (const s of universe) {
    const m = barsOf[barSymbol(s)], q = mcap[s];
    if (!m || !q) continue;
    // Garde-fou fractionnement : une clôture de la fenêtre hors de la fourchette 52 semaines de la cotation
    // (±3 %) trahit une série non ajustée (MNST divisé par deux le 10 août 2026). On exclut et on nomme.
    if (q.hi52 > 0 && q.lo52 > 0 && dates.some(d => m.get(d) && (m.get(d) > q.hi52 * 1.03 || m.get(d) < q.lo52 * 0.97))) { splitSuspects.push(s); continue; }
    const last = m.get(o.refdate);
    stock[s] = { s, m, cap: q.cap, companyCap: q.cap, shares: q.cap / last, fullShares: q.cap / last, sector: sectorOf[s] || null, vol: vol(m), mom: ret(m, momStart, momBase) };
  }
  // Deux catégories d'actions d'une même société : chaque cotation renvoie la capitalisation de toute la
  // société. Liste explicite (une règle « même nombre d'actions » fusionnait à tort HON et HONA, scission 1 pour 1).
  // Contrôle : même nombre implicite d'actions à ±1 %, sinon on bloque plutôt que de deviner.
  const dual = [];
  for (const [a, b] of DUAL_CLASS) {
    if (!stock[a] || !stock[b]) continue;
    if (Math.abs(stock[a].shares / stock[b].shares - 1) >= 0.01) throw Error(`${a}/${b} : capitalisations non liées, vérifier`);
    dual.push(`${a}/${b}`);
  }
  // Le partage se fait INDICE PAR INDICE : le Dow ne contient que GOOGL, qui doit y peser tout Alphabet
  // (diviser partout faisait peser Alphabet moitié trop peu dans le Dow, relecture du 5 novembre 2026).
  let issuerOf = {};
  const issuer = s => issuerOf[s] || s;
  function shareFor(covered) {
    const inIx = new Set(covered);
    issuerOf = {};
    for (const s of Object.keys(stock)) { stock[s].shares = stock[s].fullShares; stock[s].cap = stock[s].companyCap; }
    for (const [a, b] of DUAL_CLASS) {
      if (!stock[a] || !stock[b] || !inIx.has(a) || !inIx.has(b)) continue;
      for (const k of [a, b]) { stock[k].shares = stock[k].fullShares / 2; stock[k].cap = stock[k].companyCap / 2; }
      issuerOf[a] = issuerOf[b] = `${b}/${a}`;
    }
  }

  // 5. Agrégation : niveau capi-pondéré à actions constantes (rebasable), équipondéré et médiane par fenêtre.
  function group(key, label, syms, total) {
    const rows = syms.map(s => stock[s]).filter(Boolean);
    if (!rows.length) return null;
    const full = rows.filter(r => dates.every(d => r.m.get(d)));
    const series = dates.map(d => full.reduce((t, r) => t + r.shares * r.m.get(d), 0));
    const base0 = series[0];
    const g = { key, label, n: rows.length, n_series: full.length, series: series.map(v => r2(v / base0 * 100)), ret: {}, top: [...new Set(rows.slice().sort((a, b) => b.cap - a.cap).map(r => issuer(r.s)))].slice(0, 5) };
    for (const w of windows) {
      const ok = rows.filter(r => r.m.get(w.base));
      const rr = ok.map(r => r.m.get(o.refdate) / r.m.get(w.base) - 1);
      const wts = ok.map(r => r.shares * r.m.get(w.base));
      const cw = wts.reduce((t, v, i) => t + v * rr[i], 0) / wts.reduce((t, v) => t + v, 0);
      const sorted = rr.slice().sort((a, b) => a - b), mid = sorted.length >> 1;
      const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const contrib = total ? wts.reduce((t, v, i) => t + v * rr[i], 0) / total[w.key] : null;
      g.ret[w.key] = { cw: r2(cw * 100), ew: r2(rr.reduce((t, v) => t + v, 0) / rr.length * 100), med: r2(med * 100), up: r2(rr.filter(v => v > 0).length / rr.length * 100), n: ok.length, contrib: contrib == null ? null : r2(contrib * 100) };
    }
    return g;
  }
  function quintiles(syms, field, labeller) {
    const rows = syms.map(s => stock[s]).filter(r => r && Number.isFinite(r[field])).sort((a, b) => a[field] - b[field]);
    const out = [];
    for (let q = 0; q < 5; q++) {
      const part = rows.slice(Math.floor(q * rows.length / 5), Math.floor((q + 1) * rows.length / 5));
      if (part.length) out.push({ key: `q${q + 1}`, syms: part.map(r => r.s), label: labeller(q, part[0][field], part[part.length - 1][field]) });
    }
    return out;
  }
  const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const frd = iso => `${+iso.slice(8, 10)}${iso.slice(8, 10) === '01' ? 'er' : ''} ${MO[+iso.slice(5, 7) - 1]}`;
  const fr = (v, d = 2) => v.toFixed(d).replace('.', ',').replace('-', '−');
  const indices = {};
  for (const ix of INDICES) {
    const syms = indexMembers[ix.key], covered = syms.filter(s => stock[s]);
    const coverage = covered.length / syms.length;
    if (coverage < MIN_COVERAGE) throw Error(`${ix.label} : couverture ${(coverage * 100).toFixed(1)} % < ${MIN_COVERAGE * 100} %`);
    shareFor(covered);
    const total = {};
    for (const w of windows) total[w.key] = covered.filter(s => stock[s].m.get(w.base)).reduce((t, s) => t + stock[s].shares * stock[s].m.get(w.base), 0);
    const mk = (list) => list.map(x => group(x.key, x.label, x.syms, total)).filter(Boolean);
    const dims = {
      sector: mk(SECTORS.map(([slug, label]) => ({ key: slug, label, syms: covered.filter(s => stock[s].sector === slug) }))),
      style: mk(Object.entries(STYLES).map(([k, label]) => ({ key: k, label, syms: covered.filter(s => (SECTORS.find(x => x[0] === stock[s].sector) || [])[2] === k) }))),
      cap: mk(CAP_BUCKETS.map(([min, label], i) => ({ key: `c${i + 1}`, label, syms: covered.filter(s => stock[s].companyCap >= min && (i === 0 || stock[s].companyCap < CAP_BUCKETS[i - 1][0])) }))),
      vol: mk(quintiles(covered, 'vol', (q, lo, hi) => `${['Volatilité très faible', 'Volatilité faible', 'Volatilité moyenne', 'Volatilité élevée', 'Volatilité très élevée'][q]} (${fr(lo * 100, 0)} à ${fr(hi * 100, 0)} %)`)),
      momentum: mk(quintiles(covered, 'mom', (q, lo, hi) => `${['Grands perdants', 'Perdants', 'Milieu', 'Gagnants', 'Grands gagnants'][q]} (${fr(lo * 100, 0)} à ${fr(hi * 100, 0)} %)`)),
      theme: mk(Object.entries(themeMembers).map(([slug, m]) => ({ key: slug, label: THEMES[slug], syms: m.filter(s => syms.includes(s) && stock[s]) })).filter(x => x.syms.length >= ix.minTheme)),
    };
    // Fusion des doublons de libellé (deux slugs pour un même thème) : on garde le plus large.
    const seen = new Map(); dims.theme = dims.theme.sort((a, b) => b.n - a.n).filter(g => !seen.has(g.label) && seen.set(g.label, 1));
    const contributors = {};
    for (const w of windows) {
      // Regroupées par société : GOOG et GOOGL forment une seule ligne (Alphabet était sinon sous-classé).
      const by = new Map();
      for (const s of covered.filter(x => stock[x].m.get(w.base))) {
        const r = stock[s], k = issuer(s), v0 = r.shares * r.m.get(w.base), v1 = r.shares * r.m.get(o.refdate);
        const acc = by.get(k) || { s: k, v0: 0, v1: 0, sector: r.sector };
        acc.v0 += v0; acc.v1 += v1; by.set(k, acc);
      }
      const rows = [...by.values()].map(x => ({ s: x.s, ret: r2((x.v1 / x.v0 - 1) * 100), contrib: Math.round((x.v1 - x.v0) / total[w.key] * 1e4) / 1e4 * 100, sector: x.sector }))
        .map(x => ({ ...x, contrib: Math.round(x.contrib * 100) / 100 })).sort((a, b) => b.contrib - a.contrib);
      contributors[w.key] = { top: rows.slice(0, 10), bottom: rows.slice(-10).reverse() };
    }
    indices[ix.key] = { label: ix.label, proxy: ix.proxy, members: syms.length, covered: covered.length, excluded: syms.filter(s => !stock[s]), split_suspects: syms.filter(s => splitSuspects.includes(s)),
      total: group('all', ix.label + ' (capi-pondéré)', covered, total), dims, contributors };
  }
  const etfs = [], etfMissing = [];
  for (const e of ETFS) {
    const m = barsOf[e.symbol];
    if (!m || !dates.every(d => m.get(d))) { etfMissing.push(e.symbol); continue; }
    // Garde-fou fractionnement des ETF (MTUM et QUAL divisés par quatre le 5 novembre 2026, cours non
    // ajustés) : aucun de ces fonds ne perd 40 % ni ne gagne 67 % en une séance.
    if (dates.some((d, i) => i && (m.get(d) / m.get(dates[i - 1]) < 0.6 || m.get(d) / m.get(dates[i - 1]) > 1.67))) { splitSuspects.push(e.symbol); etfMissing.push(e.symbol); continue; }
    const ret = {}; for (const w of windows) ret[w.key] = r2((m.get(o.refdate) / m.get(w.base) - 1) * 100);
    etfs.push({ ...e, last: r2(m.get(o.refdate)), series: dates.map(d => r2(m.get(d) / m.get(dates[0]) * 100)), ret });
  }
  if (['SPY', 'QQQ', 'DIA', 'EWY', 'FEZ'].some(s => etfMissing.includes(s))) throw Error(`ETF indispensables manquants : ${etfMissing.join(', ')}`);

  const out = {
    schema: 'rotation-indices.v1', updated: now.toISOString(), asof: o.refdate, event: o.event, dates, windows,
    method: {
      weighting: 'Capi-pondéré avec le nombre d’actions actuel, constant sur la fenêtre (rachats et émissions ignorés), équipondéré et médiane. Contribution : part de la variation de l’indice capi-pondéré due à chaque société, en points de pourcentage.',
      vol: `Volatilité réalisée annualisée du ${frd(volDates[0])} au ${frd(volDates[volDates.length - 1])}, avant les fenêtres d’une semaine et d’un mois (elle recoupe celle de trois mois) ; quintiles au sein de chaque indice.`,
      dual_class: dual.length ? `Sociétés à deux catégories d’actions (${dual.join(', ')}) : dans un indice qui contient les deux, une seule capitalisation dans les pondérations, les contributions et le classement par taille ; chaque catégorie compte comme un titre dans l’équipondéré, la médiane et la part en hausse.` : null,
      splits: splitSuspects.length ? `Exclus faute de cours ajustés d’un fractionnement : ${splitSuspects.join(', ')}.` : null,
      momentum: `Momentum mesuré du ${frd(momStart)} au ${frd(momBase)} : seules les séances qui suivent le ${frd(momBase)} se lisent hors de la période de mesure.`,
      foreign: 'Places étrangères mesurées par leur ETF coté à New York, en dollars, sur les séances américaines. FEZ suit l’Euro Stoxx 50 ; EWY, EWG, EWQ, EWU et EWJ suivent les indices MSCI du pays, proches mais distincts du Kospi, du DAX, du CAC 40, du FTSE 100 et du Nikkei. Nous ne disposons pas de clôtures vérifiées des indices locaux eux-mêmes.',
      membership: `Composition actuelle des indices, secteurs et thèmes (relevée le ${frd(membersFetchedAt.slice(0, 10))}), appliquée à toute la fenêtre : un léger biais en faveur des sociétés restées dans l’indice.`,
      prices: 'Cours de clôture, dividendes exclus.',
    },
    indices, etfs,
    issues: { excluded_bars: barIssues.length, quotes: quoteIssues, missing_themes: missingThemes, etf_missing: etfMissing },
    provenance: { members_fetched_at: membersFetchedAt, equity_reference_close: o.refdate, as_of_timestamp: o.asof, collector_sha256: sha(fs.readFileSync(__filename)), source_count: sources.length, sources_sha256: sha(sources.map(x => x.sha256).join('\n')) },
  };
  fs.writeFileSync(path.join(runDir, 'bar-issues.json'), JSON.stringify(barIssues, null, 1));
  const bytes = JSON.stringify(out) + '\n';
  const target = path.join(ROOT, 'data', 'rotation-indices.json'), tmp = target + '.tmp';
  fs.writeFileSync(tmp, bytes); fs.renameSync(tmp, target);
  if (o.snapshot) fs.writeFileSync(path.resolve(ROOT, o.snapshot), bytes);
  fs.writeFileSync(path.join(runDir, 'sources.json'), JSON.stringify(sources, null, 1));
  console.log(`[gen-rotation-indices] OK ${o.refdate} · exclus fractionnement ${splitSuspects.join(',') || 'aucun'} · ${Object.values(indices).map(i => `${i.label} ${i.covered}/${i.members}`).join(' · ')} · ETF ${etfs.length}/${ETFS.length} · thèmes ${Object.keys(themeMembers).length} · ${(bytes.length / 1024).toFixed(0)} Ko · sha256 ${sha(bytes).slice(0, 12)}`);
}
module.exports = { ETFS, SECTORS, THEMES, INDICES };
if (require.main === module) main().catch(e => { console.error(`[gen-rotation-indices] BLOQUÉ : ${mcp.redactSecrets(e.message)}`); process.exitCode = 1; });
