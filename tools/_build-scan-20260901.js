// One-shot builder for scanner/20260901 from governed MCP artifacts.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'scanner', '20260901');
const REF = '2026-08-31';
const SCAN_DATE = '2026-09-01';
const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const round = (n, d = 2) => +Number(n).toFixed(d);
const hash = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

const selected = ['AAPL', 'NVDA', 'WMT', 'AMZN', 'CRWD', 'TSLA', 'IWM', 'XLB'];
const meta = {
  AAPL: ['Apple', 'Matériel, services et écosystème grand public', 'Tech', 'US', 'Breakout'],
  NVDA: ['NVIDIA', 'Semi-conducteurs et infrastructure de calcul accéléré', 'Semis', 'US', 'Momentum'],
  WMT: ['Walmart', 'Distribution généraliste et consommation de base', 'Staples', 'US', 'Momentum'],
  AMZN: ['Amazon', 'Commerce, publicité et services cloud', 'Consumer', 'US', 'Breakout'],
  PFE: ['Pfizer', 'Médicaments et vaccins', 'Healthcare', 'US', 'Pullback'],
  F: ['Ford', 'Automobile et mobilité', 'Consumer', 'US', 'Pullback'],
  CRWD: ['CrowdStrike', 'Cybersécurité cloud et protection des terminaux', 'Cybersecurity', 'US', 'Breakout'],
  TSLA: ['Tesla', 'Véhicules électriques, énergie et logiciels embarqués', 'Consumer', 'US', 'Momentum'],
  IWM: ['iShares Russell 2000 ETF', 'Petites capitalisations américaines', 'ETF-Factor', 'ETF', 'Breakout'],
  XLB: ['Materials Select Sector SPDR Fund', 'Grandes capitalisations américaines des matériaux', 'Materials', 'ETF', 'Pullback'],
};
const sourceBySymbol = {
  AAPL: 'scanner/20260901/_data/screen_breakout_us.json',
  NVDA: 'scanner/20260901/_data/screen_momentum_us.json',
  WMT: 'scanner/20260901/_data/screen_momentum_us.json',
  AMZN: 'scanner/20260901/_data/screen_breakout_us.json',
  PFE: 'scanner/20260901/_data/screen_pullback_us.json',
  F: 'scanner/20260901/_data/screen_pullback_us.json',
  CRWD: 'scanner/20260901/_data/screen_breakout_us.json',
  TSLA: 'scanner/20260901/_data/screen_momentum_us.json',
  IWM: 'scanner/20260901/_data_etf/screen_etf_us.json',
  XLB: 'scanner/20260901/_data_etf/screen_etf_us.json',
};
const colors = {
  Tech: ['#172554', '#60a5fa'], Semis: ['#312e81', '#a78bfa'], Staples: ['#14532d', '#4ade80'],
  Consumer: ['#7c2d12', '#fb923c'], Healthcare: ['#881337', '#fb7185'], Materials: ['#713f12', '#facc15'],
  'ETF-Factor': ['#1f2937', '#38bdf8'], Cybersecurity: ['#164e63', '#22d3ee'],
};

function queryResults(rel) {
  const payload = read(rel);
  return (payload.data?.items || []).flatMap(item => item.results || []).concat(payload.results || []);
}

function screenRows(rel) {
  const payload = read(rel);
  const out = [];
  for (const item of payload.data?.items || []) {
    for (const row of item.candidates || []) out.push({ ...row, screen_snapshot_as_of: String(row.as_of || item.as_of || '').slice(0, 10) });
  }
  return out;
}

const screen = new Map();
for (const rel of [...new Set(Object.values(sourceBySymbol))]) {
  for (const row of screenRows(rel)) screen.set(`${rel}:${row.symbol}`, row);
}

const records = new Map();
for (const staging of ['_data2', '_data2_candidates']) for (let i = 1; i <= 5; i++) {
  for (const result of queryResults(`scanner/20260901/${staging}/tech_b${i}.json`)) {
    for (const row of result.data || []) {
      if (!row.symbol) continue;
      const rec = records.get(row.symbol) || {};
      if (row.type === 'instrument_technicals') rec.tech = row;
      if (row.type === 'instrument_support_resistance') rec.support = row;
      records.set(row.symbol, rec);
    }
  }
  for (const result of queryResults(`scanner/20260901/${staging}/bars_b${i}.json`)) {
    for (const row of result.data || []) {
      if (!row.symbol || !Array.isArray(row.bars)) continue;
      const rec = records.get(row.symbol) || {};
      rec.bars = row.bars;
      rec.coverage = row.coverage;
      records.set(row.symbol, rec);
    }
  }
}

for (const symbol of selected) {
  const rec = records.get(symbol);
  if (!rec?.tech || !rec?.bars?.length || rec.coverage?.served_end !== REF || rec.coverage?.complete !== true) {
    throw new Error(`Missing exact-close technical evidence for ${symbol}`);
  }
}

const rawScoresByFamily = new Map();
for (const symbol of selected) {
  const family = meta[symbol][4];
  const row = screen.get(`${sourceBySymbol[symbol]}:${symbol}`);
  if (!row) throw new Error(`Missing screener row for ${symbol}`);
  const values = rawScoresByFamily.get(family) || [];
  values.push(Number(row.score));
  rawScoresByFamily.set(family, values);
}
function editorialScore(symbol) {
  const family = meta[symbol][4];
  const raw = Number(screen.get(`${sourceBySymbol[symbol]}:${symbol}`).score);
  const values = rawScoresByFamily.get(family);
  const lo = Math.min(...values), hi = Math.max(...values);
  return round(hi === lo ? 86 : 80 + 12 * (raw - lo) / (hi - lo), 1);
}

function levels(pattern, price, atr, bars, ema20) {
  const recent = bars.slice(-8, -1);
  const resistance = Math.max(...recent.map(row => Number(row[2]) || price));
  let low;
  if (pattern === 'Pullback') low = Math.max(price * 0.994, Number(ema20) * 1.001);
  else if (pattern === 'Breakout') {
    // A breakout zone must clear both the prior resistance and the full reference
    // candle.  The 1% buffer also keeps a 1.5 ATR stop inside the hard 8% cap
    // for high-volatility names such as CRWD without weakening the stop rule.
    const referenceHigh = Number(bars[bars.length - 1]?.[2]) || price;
    low = Math.max(price * 1.01, referenceHigh * 1.0001, resistance * 1.0001);
  }
  else low = price * 1.001;
  const high = low * 1.005;
  const stopDistance = Math.max(high * 0.03, atr * 1.5);
  if (stopDistance / high > 0.08) throw new Error(`${pattern} stop exceeds 8% at ${price}`);
  const stop = high - stopDistance;
  const needed = stopDistance * 0.72 / atr;
  const targetAtr = Math.min(2, Math.max(1.5, Math.ceil(needed * 4) / 4));
  const roundedHigh = round(high);
  const roundedStop = round(stop);
  const roundedTp1 = Math.floor((high + atr * targetAtr) * 100) / 100;
  const roundedTp2 = round(high + atr * Math.min(2.75, targetAtr + 0.75));
  const rr = (roundedTp1 - roundedHigh) / (roundedHigh - roundedStop);
  if (rr < 0.7) throw new Error(`R/R below 0.7 for ${pattern} at ${price}: ${rr}`);
  return {
    low: round(low), high: roundedHigh, stop: roundedStop, tp1: roundedTp1, tp2: roundedTp2,
    rr: round(rr, 2), tp1Atr: round((roundedTp1 - roundedHigh) / atr, 3), targetAtr,
    stopPct: round((roundedHigh - roundedStop) / roundedHigh * 100, 1),
  };
}

const secCoverage = {
  AAPL: { latest_earnings_filing: { form: '8-K', accession: '0000320193-26-000018', date: '2026-07-30', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
  NVDA: { latest_earnings_filing: { form: '8-K', accession: '0001045810-26-000073', date: '2026-08-26', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [
    { form: '424B5', accession: '0001193125-26-273139', date: '2026-06-17', classification: 'senior_unsecured_notes', security: 'debt', source: 'https://www.sec.gov/Archives/edgar/data/1045810/000119312526273139/d118718d424b5.htm' },
    { form: '424B5', accession: '0001193125-26-270302', date: '2026-06-15', classification: 'senior_unsecured_notes', security: 'debt', source: 'https://www.sec.gov/Archives/edgar/data/1045810/000119312526270302/d118718d424b5.htm' },
  ] },
  WMT: { latest_earnings_filing: { form: '8-K', accession: '0000104169-26-000145', date: '2026-08-20', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
  AMZN: { latest_earnings_filing: { form: '8-K', accession: '0001018724-26-000024', date: '2026-07-30', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [
    { form: '424B5', accession: '0001104659-26-081786', date: '2026-07-08', classification: 'senior_unsecured_notes', security: 'debt', source: 'https://www.sec.gov/Archives/edgar/data/1018724/000110465926081786/tm2619352-2_424b5.htm' },
    { form: '424B5', accession: '0001104659-26-072332', date: '2026-06-10', classification: 'senior_unsecured_notes', security: 'debt', source: 'https://www.sec.gov/Archives/edgar/data/1018724/000110465926072332/tm2613616-2_424b5.htm' },
    { form: '424B5', accession: '0001104659-26-071190', date: '2026-06-08', classification: 'senior_unsecured_notes', security: 'debt', source: 'https://www.sec.gov/Archives/edgar/data/1018724/000110465926071190/tm2613616-1_424b5.htm' },
  ] },
  PFE: { latest_earnings_filing: { form: '8-K', accession: '0000078003-26-000094', date: '2026-08-04', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
  F: { latest_earnings_filing: { form: '8-K', accession: '0000037996-26-000155', date: '2026-07-28', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
  CRWD: { latest_earnings_filing: { form: '8-K', accession: '0001535527-26-000029', date: '2026-08-26', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
  TSLA: { latest_earnings_filing: { form: '8-K', accession: '0001628280-26-049213', date: '2026-07-22', items: '2.02,9.01' }, equity_offering_hits: [], non_equity_offering_hits: [] },
};
const secEvidence = {
  schema_version: 1, as_of: '2026-09-01T01:21:21Z', reference_close: REF,
  pagination_exhausted: true, dilution_window: { days: 90, start: '2026-06-02', end: REF },
  method: 'MCP sec_filings,flags exact final basket; offering prospectuses classified from primary SEC documents.',
  coverage: Object.fromEntries(Object.entries(secCoverage).map(([symbol, row]) => [symbol, { issuer_filing_regime: 'domestic_issuer', issuer_calendar_verified: false, ...row }])),
};
fs.writeFileSync(path.join(DIR, '_final', 'sec_selected_evidence.json'), JSON.stringify(secEvidence, null, 2));

const broadEarnings = read('scanner/20260901/_data/earnings_7d.json');
const exactEarnings = read('scanner/20260901/_final/earnings_selected.json');
const earningsCoverage = {};
for (const symbol of selected) earningsCoverage[symbol] = meta[symbol][3] === 'ETF' ? 'no issuer earnings (ETF)' : 'no earnings found in next 7 days';
const earningsEvidence = {
  schema_version: 1, as_of: broadEarnings.as_of, reference_close: REF,
  query: { days_ahead: 7, universe: 'SP500+NDX exhaustive default universe', selected_symbols: selected.filter(s => meta[s][3] === 'US') },
  coverage: earningsCoverage,
  events: (broadEarnings.events || []).filter(event => selected.includes(event.symbol)),
  exact_query_status: exactEarnings.status,
  exact_query_warnings: exactEarnings.warnings || [],
  evidence_note: 'The exhaustive SP500+NDX run returned the full seven-day event set and no selected symbol. The narrower provider lookup returned no events but warned that issuer dates were unavailable; it is retained as a limitation, not used alone as proof.',
};
if (earningsEvidence.events.length) throw new Error(`Selected earnings event: ${earningsEvidence.events.map(x => x.symbol).join(',')}`);
fs.writeFileSync(path.join(DIR, '_final', 'earnings_selected_evidence.json'), JSON.stringify(earningsEvidence, null, 2));

const SEC_REL = 'scanner/20260901/_final/sec_selected_evidence.json';
const EARN_REL = 'scanner/20260901/_final/earnings_selected_evidence.json';
const SEC_HASH = hash(SEC_REL), EARN_HASH = hash(EARN_REL);

const thesis = {
  AAPL: 'La cassure reste conditionnelle: le titre doit reprendre la résistance récente et conserver le VWAP. Un départ vertical au-dessus de la zone annule la poursuite.',
  NVDA: 'Le momentum reste positif après la publication du 26 août. Les 424B5 de juin portent sur des obligations senior, pas sur des actions; le plan exige néanmoins une tenue au-dessus du VWAP.',
  WMT: 'Le rebond est encore fragile sous les moyennes longues. L’entrée n’est autorisée qu’au-dessus de la zone et du VWAP; sans confirmation, le signal reste inactif.',
  AMZN: 'Le titre consolide près de ses moyennes courtes. Les prospectus récents concernent de la dette senior; la cassure doit reprendre la résistance sans gap excessif.',
  PFE: 'Le repli conserve une structure quotidienne positive. Le plan attend une reprise confirmée de la zone et du VWAP, sans acheter une simple baisse.',
  F: 'Le titre travaille autour de ses moyennes courtes mais reste au-dessus de la moyenne 200 jours. La reprise de l’EMA20 et du VWAP est obligatoire.',
  CRWD: 'Le momentum reste fort après la publication du 26 août, mais l’extension approche la limite admise. L’entrée exige la zone et le VWAP; aucun achat sur accélération verticale.',
  TSLA: 'Le rebond reste volatil et la moyenne 200 jours demeure au-dessus du cours. Le plan n’est valide que sur confirmation de la zone et du VWAP, sans poursuite après gap.',
  IWM: 'L’ETF petites capitalisations apporte une exposition plus large que les mégacaps. Il reste conditionné à une reprise propre de la zone, sans poursuite après gap.',
  XLB: 'Le secteur matériaux diversifie le panier, mais sa semaine est restée faible. Le signal n’est actif qu’après confirmation au-dessus du VWAP.',
};

const setups = selected.map(symbol => {
  const [name, description, sector, region, pattern] = meta[symbol];
  const rec = records.get(symbol), t = rec.tech;
  const sourceRel = sourceBySymbol[symbol], source = screen.get(`${sourceRel}:${symbol}`);
  if (source.screen_snapshot_as_of !== REF || Number(source.estimated_valid_bars) < 1) throw new Error(`Stale screen row for ${symbol}`);
  const lastBar = rec.bars[rec.bars.length - 1];
  const price = Number(lastBar[4]);
  const atr = Number(t.atr);
  const L = levels(pattern, price, atr, rec.bars, t.ema20);
  const isEtf = region === 'ETF';
  const sec = isEtf ? null : secEvidence.coverage[symbol];
  const lookthrough = symbol === 'IWM'
    ? { factor: 'us_small_caps', clusters: ['small_caps', 'regional_banks'] }
    : symbol === 'XLB' ? { factor: 'us_materials', clusters: ['materials', 'chemicals'] } : null;
  const distance50 = round((price / Number(t.ema50) - 1) * 100, 1);
  return {
    ticker: symbol, name, description, logo_gradient: colors[sector], price: round(price),
    change_pct: round(Number(source.change_24h)), score: editorialScore(symbol), pattern, region,
    region_flag: isEtf ? 'ETF US' : 'US', region_label: isEtf ? 'ETF coté aux États-Unis' : 'États-Unis', sector,
    sharia: false, extra_badges: isEtf ? ['ETF US'] : [],
    radar_scores: {
      momentum: Math.max(35, Math.min(90, Math.round(50 + (Number(t.rsi) - 50)))),
      fundamentals: 50,
      technical: Math.max(35, Math.min(90, 50 + (price > t.ema200 ? 12 : 0) + (t.ema20 > t.ema50 ? 8 : 0))),
      volume: Math.max(30, Math.min(90, Math.round(50 + (Number(source.volume) / Number(source.avg_volume) - 1) * 20))),
      sentiment: 50, macro: 50,
    },
    radar_unavailable: ['fundamentals', 'sentiment', 'macro'],
    selection_evidence: {
      source_artifact: sourceRel, source_sha256: hash(sourceRel), screen_snapshot_as_of: source.screen_snapshot_as_of,
      detected_at: source.detected_at, estimated_valid_bars: source.estimated_valid_bars,
      source_screen_score: round(source.score, 3), avg_daily_dollar_volume: round(Number(source.avg_volume) * Number(source.last_price)),
      score_note: 'Score éditorial normalisé linéairement de 80 à 92 au sein de la famille source; ce n’est pas une probabilité de gain.',
    },
    entry_low: L.low, entry_high: L.high,
    entry_display: `${L.low}–${L.high} $; confirmation au-dessus du VWAP, sans poursuite après gap`,
    stop: L.stop, tp1: L.tp1, tp2: L.tp2, rr: `1:${L.rr.toFixed(2)}`, rr_entry: L.rr,
    tp1_atr_multiple: L.tp1Atr, execution: {
      status: 'conditional_next_session', observed_vwap: null, observed_at: null,
      gate: 'Aucun ordre avant 09:30–09:45 ET; prix dans la zone et au-dessus du VWAP observé. Annuler si le gap dépasse 2% au-dessus de la zone sans retour.',
    },
    horizon_days: 10, thesis: thesis[symbol],
    confirmations: [`RSI14 ${round(t.rsi, 1)}; ATR14 ${round(atr, 2)} $`, `EMA20 ${round(t.ema20)} $; EMA50 ${round(t.ema50)} $; EMA200 ${round(t.ema200)} $`, `TP1 à ${L.tp1Atr.toFixed(2)} ATR du haut de zone; stop à ${L.stopPct}% du pire remplissage`, 'Validation obligatoire au-dessus du VWAP'],
    invalidations: [`Cassure du stop ${L.stop} $`, `Gap au-dessus de ${round(L.high * 1.02)} $ sans retour dans la zone`, 'Perte du VWAP avec accélération vendeuse', 'Donnée devenue stale, événement nouveau ou bascule du régime'],
    market_cap: isEtf ? null : Number(source.market_cap), extension: { rsi: round(t.rsi, 1), atr: round(atr, 4), distance_50dma_pct: distance50 },
    earnings_clear: isEtf ? null : true, dilution_clear: isEtf ? null : true,
    earnings_source: isEtf ? 'n_a_etf' : '8k_item_202',
    earnings_forward_evidence: { checked_at: earningsEvidence.as_of, days_ahead: 7, result: earningsCoverage[symbol], event_found: false, source_artifact: EARN_REL, source_sha256: EARN_HASH },
    ...(sec ? { issuer_filing_regime: 'domestic_issuer', sec_evidence: { source_artifact: SEC_REL, source_sha256: SEC_HASH, checked_at: secEvidence.as_of, pagination_exhausted: true, latest_earnings_filing: sec.latest_earnings_filing, issuer_calendar_verified: false, dilution_window: secEvidence.dilution_window, equity_offering_hits: sec.equity_offering_hits, non_equity_offering_hits: sec.non_equity_offering_hits } } : {}),
    dilution_scope: isEtf ? 'n_a_etf; risque composants traité par look-through' : 'Dépôts SEC officiels revus sur 90 jours; dette classée séparément des offres d’actions.',
    ...(lookthrough ? { lookthrough } : {}),
  };
});

const correlation = read('scanner/20260901/_final/risk_correlation_final.json');
const sizingRel = 'scanner/20260901/_final/risk_sizing_final.json';
const sizing = fs.existsSync(path.join(ROOT, sizingRel)) ? read(sizingRel) : null;
const avgScore = round(setups.reduce((sum, row) => sum + row.score, 0) / setups.length, 1);
const absPairs = [];
for (let i = 0; i < correlation.symbols.length; i++) for (let j = i + 1; j < correlation.symbols.length; j++) absPairs.push({ a: correlation.symbols[i], b: correlation.symbols[j], c: correlation.matrix[i][j] });
absPairs.sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
const maxAbs = absPairs[0];

const data = {
  _comment: `Scanner du ${SCAN_DATE}, fondé sur la clôture US complète du ${REF}.`,
  date: SCAN_DATE, session_label: 'Séance du mardi 1er septembre 2026', url: '/scanner/20260901/',
  regime: 'RISK-ON', regime_score: 0.8, regime_color: '#16a34a',
  tags: ['us', 'etf', 'technique', 'trade-idea', 'risk-on'],
  kpis: { vix: { value: '14,92', label: 'sous sa moyenne 14 jours', color: '#16a34a' }, spx: { value: '7 686,14', change_pct: null, color: '#64748b' }, avg_score: avgScore, dominant_patterns: ['Momentum', 'Breakout', 'Pullback'] },
  alerts: [
    { type: 'warning', title: 'DTX désarmé', text: 'Aucun ordre DTX actionnable: la décision a été refusée pour réutilisation d’une clé avec une empreinte différente, et le book certifié s’arrête au 27 août au lieu du 31 août. Le panneau reste informatif et vide.' },
    { type: 'warning', title: 'Résultats à surveiller', text: 'Le balayage large S&P 500 + Nasdaq-100 ne signale aucun des six émetteurs dans les sept prochains jours. La requête étroite n’a cependant pas obtenu les dates fournisseur; toute nouvelle confirmation d’émetteur annule le plan.' },
    { type: 'info', title: 'Corrélations sur historique court', text: `La corrélation absolue maximale vaut ${Math.abs(maxAbs.c).toFixed(2)} entre ${maxAbs.a} et ${maxAbs.b}, sur ${correlation.n_observations} observations. XLB ne dispose que de 29 barres; le sizing reste indicatif.` },
    { type: 'warning', title: 'Sizing MCP non retenu', text: `L’optimiseur a proposé ${round(100 - sizing.cash_reserve_pct, 1).toFixed(1)}% de capital engagé et ${sizing.portfolio_expected_vol_pct.toFixed(1)}% de volatilité attendue malgré une cible de 12%. Aucune taille proposée n’est publiée comme allocation actionnable.` },
  ],
  intro: 'Le régime systématique reste RISK-ON à 0,80, avec un S&P 500 au-dessus de ses moyennes 50, 100 et 200 jours et un VIX à 14,92. Le panier retient volontairement six actions US et deux ETF US: aucune huitième action n’a été forcée après les rejets SEC, earnings, bruit ATR et concentration.',
  strategy: 'Momentum et Breakout exigent une reprise de la zone au-dessus du VWAP. Les Pullback exigent la reprise de l’EMA20 et du VWAP. Un gap supérieur à 2% au-dessus de la zone sans retour annule l’entrée.',
  regime_prose: 'La tendance agrégée autorise le risque, mais la qualité prime sur la quantité. Les ETF IWM et XLB diversifient les mégacapitalisations; aucun plan n’est un ordre au marché.',
  regime_strategy_weights: { momentum: 0.375, breakout: 0.5, pullback: 0.125, presqueeze: 0 },
  market_snapshot: [
    { label: 'S&P 500', value: '7 686,14', change: 'clôture du 31 août', signal: 'au-dessus des moyennes 50/100/200', dir: 'up' },
    { label: 'VIX', value: '14,92', change: 'sous SMA14 15,06', signal: 'volatilité contenue', dir: 'flat' },
    { label: 'Technologie', value: '+3,58%', change: '1 semaine', signal: 'secteur leader', dir: 'up' },
    { label: 'Matériaux', value: '-1,66%', change: '1 semaine', signal: 'confirmation requise', dir: 'down' },
  ],
  pedagogy: { title: 'Pourquoi seulement huit lignes', content: 'Le scanner vise dix lignes, mais son minimum honnête est six actions et deux ETF. GOOG a été rejeté pour une offre d’actions récente; plusieurs autres candidats échouent le stop ATR, la tendance ou la preuve événementielle.' },
  score_methodology: 'Scores normalisés par famille source sur une plage 80–92 afin de comparer la conviction éditoriale sans présenter les scores bruts hétérogènes comme des probabilités.',
  macro_calendar: [{ date: '1 septembre', event: 'ISM manufacturier américain', impact: 'élevé', dir: 'flat', note: 'Volatilité possible après 10h00 ET' }, { date: '4 septembre', event: 'Rapport emploi américain', impact: 'élevé', dir: 'flat', note: 'Réduire la poursuite avant la publication' }],
  sector_rotation: [{ sector: 'Technologie', perf: '+3,58% sur 1 semaine', signal: 'leader', exposure: 'AAPL, NVDA', dir: 'up' }, { sector: 'Petites capitalisations', perf: 'diversification', signal: 'cassure conditionnelle', exposure: 'IWM', dir: 'flat' }, { sector: 'Matériaux', perf: '-1,66% sur 1 semaine', signal: 'reprise requise', exposure: 'XLB', dir: 'down' }],
  macro_thesis: 'Le régime reste constructif mais les plans sont strictement conditionnels. La corrélation sert de garde-fou; le sizing suralloué est rejeté et le défaut DTX interdit toute action systématique.',
  engine_meta: { generated_at: new Date().toISOString(), regime: 'RISK-ON', reference_close: REF, freshness: { marketdata_bars: REF, systematic_last_data_date: REF }, risk_gating: { systematic_regime_score: 0.8, crisis_prob_5d: 0.0825, max_pair_correlation: round(Math.abs(maxAbs.c), 4), max_abs_pair_correlation: round(Math.abs(maxAbs.c), 4), max_abs_pair_symbols: [maxAbs.a, maxAbs.b], avg_off_diagonal_correlation: correlation.avg_off_diagonal, correlation_observations: correlation.n_observations, correlation_method: 'pearson log returns', sizing_status: sizing ? 'rejected_overallocated' : 'pending', sizing_actionable: false, sizing_cash_reserve_pct: sizing?.cash_reserve_pct ?? null, sizing_expected_vol_pct: sizing?.portfolio_expected_vol_pct ?? null, sizing_target_vol_pct: 12, dtx_actionable_orders: 0, dtx_fault: 'idempotency key reused with different input fingerprint; certified book ends 2026-08-27, expected 2026-08-31' } },
  disclaimer_extra: "Ceci n'est pas un conseil en investissement. Les niveaux sont conditionnels et deviennent caducs si les données, l’événement ou le régime changent.",
  setups, scanDate: '20260901',
};

const signals = setups.map(s => ({
  ticker: s.ticker, name: s.name, score: s.score, scoreFamily: 'editorial_normalized', scoreSource: 'governed_family_normalization', strategy: s.pattern,
  price: s.price, entry: s.entry_high, entry_low: s.entry_low, entry_high: s.entry_high, stop: s.stop, tp1: s.tp1, tp2: s.tp2,
  rr: s.rr, rr_entry: s.rr_entry, tp1_atr_multiple: s.tp1_atr_multiple, horizon: s.horizon_days, region: s.region,
  sector: s.sector, market_cap: s.market_cap, sharia: s.sharia, extension: s.extension, earnings_clear: s.earnings_clear,
  dilution_clear: s.dilution_clear, earnings_source: s.earnings_source, earnings_forward_evidence: s.earnings_forward_evidence,
  issuer_filing_regime: s.issuer_filing_regime, dilution_scope: s.dilution_scope, thesis: s.thesis, execution: s.execution,
  sec_evidence: s.sec_evidence, selection_evidence: s.selection_evidence, ...(s.lookthrough ? { lookthrough: s.lookthrough } : {}),
}));
const signalsJson = {
  scanDate: SCAN_DATE, regime: 'RISK-ON', regimeScore: 80, regimeScoreScale: '0-100 (higher = risk-on)',
  _pipelineOrder: { earnings_screened_at: broadEarnings.captured_at, enrichment_started_at: read('scanner/20260901/_data2/harness.json').generated_at, candidates_screened: 31, method: 'Le calendrier large et les positions ouvertes ont été contrôlés avant l’enrichissement technique final.' },
  _memoryImpact: { rules_applied: ['us-only', 'pit-close', 'tp1-reachability', 'vwap-entry-gate', 'sec-primary-classification', 'strategy-concentration'], notes: 'Minimum honnête de six actions et deux ETF; aucune ligne de remplissage.' },
  _editorialNote: 'US-only. Flux optionnels retirés après surcharge du serveur; aucune donnée de remplacement fabriquée. DTX vide et désarmé avec faute exacte publiée.',
  _scoreMethodology: data.score_methodology, exited_factors: [], signals,
  momentum: signals.filter(s => s.strategy === 'Momentum'), breakout: signals.filter(s => s.strategy === 'Breakout'),
  pullback: signals.filter(s => s.strategy === 'Pullback'), pre_squeeze: [], tkl_pool: [], dtx_pool: [], fortress_pool: [],
  _tklPoolNote: 'Aucun candidat TKL séparément validé.', _fortressPoolNote: 'Aucun candidat Fortress avec toutes les preuves requises.',
};

const wave1 = read('scanner/20260901/_data/harness.json');
const wave2 = read('scanner/20260901/_data2/harness.json');
const dtx = read('scanner/20260901/_dtx/harness.json');
const finalEvidence = read('scanner/20260901/_final/harness.json');
const harness = {
  schema_version: 1, artifact: 'scanner/20260901/data.json', reference_close: REF, generated_at: new Date().toISOString(),
  sources: [...(wave1.sources || []), ...(wave2.sources || []), ...(dtx.sources || []), ...(finalEvidence.sources || []),
    { name: 'risk_correlation_final', sha256: hash('scanner/20260901/_final/risk_correlation_final.json'), as_of: correlation.as_of, data_through: REF, max_age_h: 24, required: true, note: 'marketdata.PortfolioRisk correlation final basket' },
    { name: 'earnings_selected_evidence', sha256: EARN_HASH, as_of: earningsEvidence.as_of, data_through: REF, max_age_h: 24, required: true, note: 'Derived exact selected coverage from exhaustive SP500+NDX seven-day run' },
    { name: 'sec_selected_evidence', sha256: SEC_HASH, as_of: secEvidence.as_of, data_through: REF, max_age_h: 168, required: true, note: 'Exact final-basket SEC evidence with primary-filing classification' },
    { name: 'sec_crwd_direct', sha256: hash('scanner/20260901/_final/sec_crwd_direct.json'), as_of: '2026-09-01T01:43:50.206577141Z', data_through: REF, max_age_h: 168, required: true, note: 'Direct current-only SEC filings/flags capture for CRWD, exact accessions retained' },
    ...(sizing ? [{ name: 'risk_sizing_final', sha256: hash(sizingRel), as_of: sizing.as_of, data_through: REF, max_age_h: 24, required: true, note: 'Raw marketdata sizing response retained but rejected: overallocated capital and volatility target breach' }] : []),
  ],
};

fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(DIR, 'signals.json'), JSON.stringify(signalsJson, null, 2));
fs.writeFileSync(path.join(DIR, 'harness.json'), JSON.stringify(harness, null, 2));
console.log(`wrote ${setups.length} setups; avg score ${avgScore}; sizing=${sizing ? sizing.status : 'pending'}`);
for (const s of setups) console.log(`${s.ticker} ${s.pattern} ${s.entry_low}-${s.entry_high} stop=${s.stop} tp1=${s.tp1} rr=${s.rr}`);
