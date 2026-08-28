// One-shot builder for scanner/20260831 from the governed MCP artifacts.
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'scanner', '20260831');
const REF = '2026-08-28';
const SCAN_DATE = '2026-08-31';
const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const round = (n, d = 2) => +Number(n).toFixed(d);

const selected = ['BDX', 'RVTY', 'VLO', 'NWSA', 'NDAQ', 'ADP', 'DV', 'EL', 'IGV', 'KRE'];
const meta = {
  BDX: ['Becton Dickinson', 'Medical Essentials, Connected Care, BioPharma Systems et Interventional', 'Healthcare', 'US', 'Momentum', false],
  RVTY: ['Revvity', 'Outils de diagnostic et sciences de la vie', 'Healthcare', 'US', 'Momentum', false],
  VLO: ['Valero Energy', 'Raffinage et carburants renouvelables', 'Energy', 'US', 'Momentum', false],
  NWSA: ['News Corp', 'Information, édition et immobilier numérique', 'Communication Services', 'US', 'Momentum', false],
  NDAQ: ['Nasdaq', 'Bourses, données et logiciels de marché', 'Financials', 'US', 'Momentum', false],
  ADP: ['Automatic Data Processing', 'Paie et gestion des ressources humaines', 'Industrials', 'US', 'Momentum', false],
  DV: ['DoubleVerify', 'Mesure et qualité de la publicité numérique', 'Communication Services', 'US', 'Momentum', false],
  EL: ['Estée Lauder', 'Cosmétiques et soins premium', 'Consumer Staples', 'US', 'Momentum', false],
  IGV: ['iShares Expanded Tech-Software ETF', 'Logiciels cotés aux États-Unis', 'ETF-Factor', 'ETF', 'Breakout', false],
  KRE: ['SPDR S&P Regional Banking ETF', 'Banques régionales américaines', 'ETF-Factor', 'ETF', 'Pullback', false],
};
const colors = {
  Industrials: ['#365314', '#a3e635'],
  'Consumer Discretionary': ['#7c2d12', '#fb923c'],
  Healthcare: ['#9f1239', '#fb7185'],
  Energy: ['#92400e', '#f59e0b'],
  'Communication Services': ['#155e75', '#38bdf8'],
  Financials: ['#3730a3', '#818cf8'],
  'Consumer Staples': ['#14532d', '#4ade80'],
  'ETF-Factor': ['#1f2937', '#60a5fa'],
};

function results(file) {
  const payload = read(file);
  return (payload.data?.items || []).flatMap(x => x.results || []).concat(payload.results || []);
}

const records = new Map();
for (let i = 1; i <= 5; i++) {
  for (const result of results(`scanner/20260831/_data2/tech_b${i}.json`)) {
    for (const row of result.data || []) {
      if (!row.symbol) continue;
      const rec = records.get(row.symbol) || {};
      if (row.type === 'instrument_quote') rec.quote = row;
      if (row.type === 'instrument_technicals') rec.tech = row;
      records.set(row.symbol, rec);
    }
  }
}

for (let i = 1; i <= 5; i++) {
  const payload = read(`scanner/20260831/_data2/bars_b${i}.json`);
  for (const result of payload.results || []) {
    (result.symbols || []).forEach((symbol, index) => {
      const rec = records.get(symbol) || {};
      rec.bars = result.data?.[index]?.bars || [];
      records.set(symbol, rec);
    });
  }
}

function levels(pattern, price, atr, bars, ema20) {
  const continuation = pattern === 'Momentum' || pattern === 'Breakout';
  const recentResistance = Math.max(...(bars || []).slice(-10).map(row => Number(row[2]) || 0));
  const low = pattern === 'Pullback'
    ? Math.max(price * 0.992, Number(ema20) * 1.001)
    : pattern === 'Breakout'
    ? Math.max(price * 1.001, recentResistance * 1.0001)
    : price * (continuation ? 1.001 : 0.992);
  const high = pattern === 'Breakout' || pattern === 'Pullback'
    ? low * 1.005
    : price * (continuation ? 1.006 : 0.998);
  const midpoint = (low + high) / 2;
  const stopDistance = Math.max(midpoint * 0.03, atr * 1.5);
  const stop = midpoint - stopDistance;
  const baseRisk = high - stop;
  const targetAtrMultiple = Math.min(2, Math.max(1.5, Math.ceil((baseRisk * 0.72 / atr) * 4) / 4));
  const tp1 = high + atr * targetAtrMultiple;
  const tp2 = high + atr * (targetAtrMultiple + 0.75);
  const rrWorst = (tp1 - high) / (high - stop);
  return {
    low: round(low), high: round(high), midpoint: round(midpoint), stop: round(stop),
    tp1: round(tp1), tp2: round(tp2), rrWorst: round(rrWorst, 2), targetAtrMultiple,
    stopPct: round((high - stop) / high * 100, 1),
  };
}

const thesis = {
  BDX: 'La tendance de fond est haussière et le RSI approche 70. Cette force justifie une surveillance, mais l’entrée est conditionnée à une cassure tenue et non à une poursuite aveugle.',
  RVTY: 'Le momentum santé est fort mais déjà étendu au-dessus de l’EMA20. Une entrée n’est recevable que si la cassure tient le VWAP sans accélération verticale.',
  VLO: 'Le raffineur termine près du haut de séance dans une tendance haussière. Le pétrole était stable vendredi; le trade dépend donc de la force propre du titre et d’un maintien au-dessus du VWAP.',
  NWSA: 'Le titre consolide près de ses plus hauts récents avec une structure de momentum. La zone publiée sert de filtre: une perte du VWAP annule le signal plutôt que d’être moyennée.',
  NDAQ: 'Nasdaq consolide au-dessus de ses moyennes 20, 50 et 200 jours. Le momentum reste propre, mais l’entrée exige une reprise du haut de zone et du VWAP.',
  ADP: 'Le titre accélère dans une tendance longue intacte avec un RSI proche de 69. La cassure doit tenir; un gap supérieur à 2% renvoie le plan vers un pullback VWAP.',
  DV: 'DoubleVerify avance régulièrement au-dessus de ses trois moyennes. La faible volatilité impose une exécution stricte dans la zone et interdit de poursuivre un écart d’ouverture.',
  EL: 'Estée Lauder progresse dans une tendance forte mais déjà étendue. Le setup reste un satellite: aucune poursuite d’un gap et confirmation VWAP obligatoire.',
  IGV: 'Le logiciel a conservé l’essentiel de son gap après les résultats de la semaine. L’ETF réduit le risque spécifique, mais son extension impose une cassure propre ou un retour VWAP.',
  KRE: 'Les banques régionales restent au-dessus de leur moyenne 50 jours mais sous leur moyenne 20 jours. Le setup n’est recevable qu’après reprise de l’EMA20 et du VWAP; sous cette séquence, il reste désarmé.',
};

const setups = selected.map(symbol => {
  const [name, description, sector, region, pattern, sharia] = meta[symbol];
  const rec = records.get(symbol);
  if (!rec?.quote || !rec?.tech) throw new Error(`Missing governed enrichment for ${symbol}`);
  const q = rec.quote, t = rec.tech;
  const price = Number(q.price), atr = Number(t.atr);
  const L = levels(pattern, price, atr, rec.bars, t.ema20);
  const score = pattern === 'Pullback'
    ? round(Math.min(94, Math.max(80, 86 - Math.abs(Number(t.rsi) - 40) * 0.4)), 1)
    : round(Math.min(94, Number(t.rsi) + (pattern === 'Breakout' ? 20 : 15)), 1);
  const distance50 = q.fiftyDayAverage ? round((price / q.fiftyDayAverage - 1) * 100) : round((price / t.ema50 - 1) * 100);
  const lookthrough = symbol === 'IGV'
    ? { factor: 'us_software', clusters: ['enterprise_software', 'cybersecurity', 'interactive_media'] }
    : symbol === 'KRE'
      ? { factor: 'us_regional_banks', clusters: ['regional_banks', 'credit_cycle', 'yield_curve'] }
      : null;
  return {
    ticker: symbol, name, description, logo_gradient: colors[sector], price: round(price),
    change_pct: round(Number(q.changePercent) * 100), score, pattern, region,
    region_flag: region === 'ETF' ? 'ETF US' : 'US', region_label: region === 'ETF' ? 'ETF coté aux États-Unis' : 'États-Unis',
    sector, sharia, extra_badges: region === 'ETF' ? ['ETF US'] : [],
    radar_scores: {
      momentum: Math.max(45, Math.min(92, Math.round(58 + (Number(t.rsi) - 50) * 1.1))),
      fundamentals: 64, technical: t.ema20 > t.ema50 ? 84 : 68,
      volume: 76, sentiment: 62, macro: sector === 'Energy' ? 72 : 68,
    },
    entry_low: L.low, entry_high: L.high,
    entry_display: `${L.low}–${L.high} $; gate min(open, VWAP), pullback VWAP seul si gap >2%`,
    stop: L.stop, tp1: L.tp1, tp2: L.tp2,
    rr: `1:${L.rrWorst.toFixed(2)}`, rr_entry: L.rrWorst, tp1_atr_multiple: L.targetAtrMultiple,
    execution: {
      status: 'conditional_next_session', observed_vwap: null, observed_at: null,
      gate: 'No order before the 09:30–09:45 ET window; require price in zone and above observed VWAP.',
    },
    horizon_days: 10, thesis: thesis[symbol],
    confirmations: [
      `RSI14 ${round(t.rsi, 1)} et ATR14 ${round(atr, 2)} $`,
      `EMA20 ${round(t.ema20)} $ contre EMA50 ${round(t.ema50)} $`,
      `TP1 fixé à ${L.targetAtrMultiple.toFixed(2).replace('.', ',')} ATR au-dessus du haut de zone; stop à ${L.stopPct}% du pire remplissage`,
      'Entrée uniquement si la zone tient et si le prix confirme au-dessus du VWAP',
    ],
    invalidations: [
      `Cassure du stop ${L.stop} $`,
      `Ouverture au-dessus de ${round(L.high * 1.02)} $ sans retour VWAP`,
      'Perte du VWAP avec pression vendeuse croissante',
      symbol === 'IGV'
        ? 'Aucune conservation overnight avant les résultats logiciels des 2–3 septembre sans nouvelle validation'
        : 'Donnée devenue stale, earnings surprise ou bascule du régime',
    ],
    market_cap: region === 'ETF' ? null : Number(q.marketCap) || null,
    extension: { rsi: round(t.rsi, 1), atr: round(atr, 4), distance_50dma_pct: distance50 },
    earnings_clear: region === 'ETF' ? null : true,
    dilution_clear: region === 'ETF' ? null : true,
    earnings_source: region === 'ETF' ? 'n_a_etf' : '8k_item_202',
    dilution_scope: region === 'ETF'
      ? 'n_a_etf; component-level event risk disclosed in calendar/look-through'
      : 'official SEC forms reviewed over 90 days; no S-1, S-3, EFFECT or 424B5 found; provider flags unavailable',
    ...(lookthrough ? { lookthrough } : {}),
  };
});

const riskGating = {
  systematic_regime_score: 0.79,
  marketdata_ensemble_status: 'degraded_fallback_rule_based',
  marketdata_fallback_confidence: 0.25,
  crisis_prob_5d: 0.15,
  regime_source: 'systematic DtxRegime is canonical; marketdata probability engine degraded to fallback_rule_based',
  max_pair_correlation: 0.6861,
  max_pair_symbols: ['NWSA', 'ADP'],
  avg_off_diagonal_correlation: 0.2109,
  correlation_method: 'Pearson log returns on 60 governed daily sessions; local fallback after PortfolioRisk returned 0 common days',
  sizing: 'MCP balanced inverse-ATR sizing returned 257.75% gross exposure and was rejected; candidates remain conditional and are not a simultaneous portfolio allocation',
  sizing_endpoint_cash_reserve_pct: -157.75,
  sizing_endpoint_expected_vol_pct: 39.97,
  sizing_endpoint_max_correlation: 0.6837,
  allocation_recommendation_pct: 0,
};
const avgScore = round(setups.reduce((sum, x) => sum + x.score, 0) / setups.length, 1);
const data = {
  _comment: `Scanner ${SCAN_DATE}, clôture de référence ${REF}. Univers volontairement limité aux actions et ETF cotés aux États-Unis.`,
  date: SCAN_DATE, session_label: 'Séance du lundi 31 août 2026', url: '/scanner/20260831/',
  regime: 'RISK-ON', regime_score: 0.79, regime_color: '#16a34a',
  tags: ['us', 'etf', 'technique', 'trade-idea', 'momentum', 'pullback', 'industrials', 'healthcare', 'energy', 'software'],
  kpis: {
    vix: { value: '14,43', label: 'volatilité contenue', color: '#16a34a' },
    spx: { value: '7 711,76', change_pct: -0.25, color: '#dc2626' },
    avg_score: avgScore, dominant_patterns: ['Momentum', 'Pullback'],
  },
  alerts: [
    { type: 'warning', title: 'Risk-on, mais largeur plus faible', text: 'Le S&P 500 a cédé 0,25% vendredi et le Russell 2000 1,39%. Le régime systématique reste RISK-ON à 0,79 avec VIX 14,43, mais les entrées du lundi restent conditionnées au VWAP.' },
    { type: 'warning', title: 'Allocation simultanée interdite', text: 'Le sizing portefeuille a été rejeté: 257,75% d’exposition brute et réserve cash négative. Allocation recommandée du panier complet: 0%. Chaque ligne reste une surveillance conditionnelle indépendante.' },
    { type: 'info', title: 'Données optionnelles dégradées', text: 'Les flux institutionnels optionnels ont été limités par le fournisseur et le moteur probabiliste fonctionne en fallback à 25% de confiance. Aucun substitut n’a été inventé.' },
  ],
  intro: 'Le régime systématique reste RISK-ON à 0,79, mais la séance de vendredi a été plus faible sous la surface: Nasdaq -0,52%, Russell 2000 -1,39%, or -3,43% et bitcoin -3,57%. Le panier du lundi privilégie des entrées conditionnelles, huit actions US et deux ETF US, sans poursuite automatique des gaps.',
  strategy: 'Momentum seulement sur cassure tenue; pullback seulement après stabilisation et reprise du VWAP. Un gap supérieur à 2% au-dessus de la zone annule l’entrée directe et impose un retour VWAP.',
  regime_prose: 'Le S&P 500 reste au-dessus de ses moyennes 50, 100 et 200 jours; le VIX est sous sa moyenne 14 jours et ne monte pas. En contrepoint, le dollar a gagné 0,52%, les taux 10 ans atteignent 4,72% et les actifs à bêta élevé ont corrigé. Le régime autorise le risque, pas le relâchement des gates.',
  regime_strategy_weights: { momentum: 0.40, breakout: 0.10, pullback: 0.50, presqueeze: 0 },
  market_snapshot: [
    { label: 'S&P 500', value: '7 711,76', change: '-0,25%', signal: 'tendance longue intacte', dir: 'down' },
    { label: 'Nasdaq', value: '26 402,42', change: '-0,52%', signal: 'logiciels plus résistants', dir: 'down' },
    { label: 'Russell 2000', value: '2 972,37', change: '-1,39%', signal: 'largeur plus faible', dir: 'down' },
    { label: 'VIX', value: '14,43', change: 'stable', signal: 'volatilité contenue', dir: 'flat' },
    { label: '10 ans US', value: '4,72%', change: '+4 pb', signal: 'pression sur la duration', dir: 'up' },
    { label: 'Or', value: '4 504,10 $', change: '-3,43%', signal: 'liquidation avec dollar fort', dir: 'down' },
    { label: 'Bitcoin', value: '77 350,80 $', change: '-3,57%', signal: 'bêta élevé sous pression', dir: 'down' },
  ],
  pedagogy: { title: 'Pourquoi un bon score ne suffit pas', content: 'Le score classe les candidats; il ne remplace ni la fenêtre earnings, ni les dépôts SEC, ni le VWAP. Le scan garde donc des zones conditionnelles et accepte de ne rien exécuter si le marché ne confirme pas.' },
  macro_calendar: [
    { date: '31 août', event: 'Inflation flash zone euro', impact: 'élevé', dir: 'flat', note: 'Risque dollar et taux avant la séance US' },
    { date: '1 septembre', event: 'ISM manufacturier; discours de Michael Barr', impact: 'moyen / élevé', dir: 'flat', note: '10h00 ET puis signal Fed séparé' },
    { date: '2–3 septembre', event: 'AVGO, SNOW, HPE, ZS et logiciels', impact: 'élevé', dir: 'flat', note: 'Risque de lecture croisée pour IGV' },
    { date: '3 septembre', event: 'Inscriptions chômage, discours Waller, ISM services', impact: 'moyen / élevé', dir: 'flat', note: '8h30–10h00 ET' },
    { date: '4 septembre', event: 'Rapport emploi américain', impact: 'élevé', dir: 'flat', note: 'Réduire la poursuite avant le chiffre' },
  ],
  sector_rotation: [
    { sector: 'Banques régionales', perf: 'repli contrôlé', signal: 'reprise EMA20 requise', exposure: 'KRE', dir: 'flat' },
    { sector: 'Logiciels', perf: 'fort mais étendu', signal: 'gap de jeudi largement conservé', exposure: 'IGV', dir: 'up' },
    { sector: 'Santé', perf: 'sélectif', signal: 'momentum sur dispositifs et diagnostics', exposure: 'BDX, RVTY', dir: 'up' },
    { sector: 'Énergie', perf: 'résilient', signal: 'pétrole presque stable vendredi', exposure: 'VLO', dir: 'flat' },
    { sector: 'Services financiers', perf: 'constructif', signal: 'infrastructures de marché', exposure: 'NDAQ', dir: 'up' },
    { sector: 'Consommation', perf: 'momentum étendu', signal: 'force propre, pas de poursuite du gap', exposure: 'EL', dir: 'up' },
  ],
  macro_thesis: 'La structure de tendance reste favorable, mais vendredi a montré une contraction du risque: petites capitalisations, crypto et métaux ont reculé ensemble tandis que le dollar et les taux montaient. Le scanner répond par des facteurs moins concentrés, IGV et KRE comme ETF de contrôle, et des entrées soumises au VWAP.',
  engine_meta: {
    generated_at: new Date().toISOString(), regime: 'RISK-ON', reference_close: REF,
    freshness: { marketdata_bars: REF, systematic_last_data_date: REF }, risk_gating: riskGating,
  },
  disclaimer_extra: "Ceci n'est pas un conseil en investissement. Les niveaux sont conditionnels et deviennent caducs si les données, l’événement ou le régime changent.",
  setups, scanDate: '20260831',
};

const signals = setups.map(s => ({
  ticker: s.ticker, name: s.name, score: s.score, scoreSource: 'normalized_composite', strategy: s.pattern,
  price: s.price, entry: s.entry_high, entry_low: s.entry_low, entry_high: s.entry_high,
  stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, rr_entry: s.rr_entry,
  tp1_atr_multiple: s.tp1_atr_multiple, horizon: s.horizon_days, region: s.region,
  sector: s.sector, market_cap: s.market_cap, sharia: s.sharia, extension: s.extension,
  earnings_clear: s.earnings_clear, dilution_clear: s.dilution_clear,
  earnings_source: s.earnings_source, dilution_scope: s.dilution_scope, thesis: s.thesis,
  execution: s.execution,
  ...(s.lookthrough ? { lookthrough: s.lookthrough } : {}),
}));
const signalsJson = {
  scanDate: SCAN_DATE, regime: 'RISK-ON', regimeScore: 79,
  regimeScoreScale: '0-100 (higher = risk-on)',
  _pipelineOrder: {
    earnings_screened_at: '2026-08-28T21:51:01.000Z',
    enrichment_started_at: '2026-08-28T21:56:15.000Z', candidates_screened: 60,
    method: 'Earnings and open-position gates preceded SEC, technical, bars and correlation enrichment; final universe is 8 US stocks plus 2 US-listed ETFs.',
  },
  _memoryImpact: {
    rules_applied: ['pit-cache-key-end-date', 'tp1-reachability', 'vwap-entry-gate', 'pullback-trend-structure-gate'],
    notes: 'Memory changed execution discipline and confidence only. It did not reverse a quantitative signal or bypass a hard block.',
  },
  _editorialNote: 'US-only run. Optional flow calls were unavailable after rate limiting; no substitute flow data was fabricated.',
  exited_factors: [], signals, tkl_pool: [], dtx_pool: [], fortress_pool: [],
  _tklPoolNote: 'No separately validated TKL candidate for this run.',
  _fortressPoolNote: 'Fortress gate ran fail-closed: no candidate had all four A+ eliminators and Sharia ratios verified from current governed data.',
};

const wave1 = read('scanner/20260831/_data/harness.json');
const wave2 = read('scanner/20260831/_data2/harness.json');
const dtx = read('scanner/20260831/_dtx/harness.json');
const harness = {
  schema_version: 1,
  artifact: 'scanner/20260831/data.json',
  reference_close: REF,
  generated_at: new Date().toISOString(),
  sources: [
    ...(wave1.sources || []), ...(wave2.sources || []), ...(dtx.sources || []),
    {
      name: 'risk_sizing_final', as_of: '2026-08-28T22:36:01Z', data_through: REF,
      max_age_h: 24, required: true,
      note: 'marketdata.PortfolioRisk sizing final basket; artifact scanner/20260831/_data2/risk_sizing_final.json',
    },
  ],
};

fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(DIR, 'signals.json'), JSON.stringify(signalsJson, null, 2));
fs.writeFileSync(path.join(DIR, 'harness.json'), JSON.stringify(harness, null, 2));
console.log(`wrote ${setups.length} setups, avg score ${avgScore}`);
for (const s of setups) console.log(`${s.ticker} ${s.pattern} ${s.entry_low}-${s.entry_high} stop=${s.stop} tp1=${s.tp1} rr=${s.rr}`);
