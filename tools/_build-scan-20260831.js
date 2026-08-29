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

const selected = ['BDX', 'RVTY', 'NWSA', 'HTGC', 'PCAR', 'GE', 'ELS', 'IGV', 'KBE'];
const meta = {
  BDX: ['Becton Dickinson', 'Medical Essentials, Connected Care, BioPharma Systems et Interventional', 'Healthcare', 'US', 'Momentum', false],
  RVTY: ['Revvity', 'Outils de diagnostic et sciences de la vie', 'Healthcare', 'US', 'Momentum', false],
  NWSA: ['News Corp', 'Information, édition et immobilier numérique', 'Communication Services', 'US', 'Momentum', false],
  HTGC: ['Hercules Capital', 'Financement spécialisé des entreprises technologiques et sciences de la vie', 'Financials', 'US', 'Breakout', false],
  PCAR: ['PACCAR', 'Camions, pièces et financement commercial', 'Industrials', 'US', 'Pullback', false],
  GE: ['GE Aerospace', 'Moteurs, services et équipements aéronautiques', 'Industrials', 'US', 'Pullback', false],
  ELS: ['Equity LifeStyle Properties', 'Immobilier résidentiel de loisirs et communautés préfabriquées', 'Real Estate', 'US', 'Pullback', false],
  IGV: ['iShares Expanded Tech-Software ETF', 'Logiciels cotés aux États-Unis', 'ETF-Factor', 'ETF', 'Breakout', false],
  KBE: ['SPDR S&P Bank ETF', 'Banques américaines diversifiées', 'ETF-Factor', 'ETF', 'Pullback', false],
};
const colors = {
  Industrials: ['#365314', '#a3e635'],
  'Consumer Discretionary': ['#7c2d12', '#fb923c'],
  Healthcare: ['#9f1239', '#fb7185'],
  Energy: ['#92400e', '#f59e0b'],
  'Communication Services': ['#155e75', '#38bdf8'],
  Financials: ['#3730a3', '#818cf8'],
  'Consumer Staples': ['#14532d', '#4ade80'],
  'Real Estate': ['#4a044e', '#e879f9'],
  'ETF-Factor': ['#1f2937', '#60a5fa'],
};

function results(file) {
  const payload = read(file);
  return (payload.data?.items || []).flatMap(x => x.results || []).concat(payload.results || []);
}

const screenBySymbol = new Map();
for (const strategy of ['momentum', 'breakout', 'pullback']) {
  const payload = read(`scanner/20260831/_data/screen_${strategy}_us.json`);
  for (const item of payload.data?.items || []) {
    for (const candidate of item.candidates || []) {
      screenBySymbol.set(`${strategy}:${candidate.symbol}`, {
        ...candidate,
        screen_snapshot_as_of: String(item.as_of || '').slice(0, 10),
      });
    }
  }
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
  const roundedHigh = round(high);
  // Never round a target above its governed ATR ceiling.
  const roundedTp1 = Math.floor(tp1 * 100) / 100;
  return {
    low: round(low), high: roundedHigh, midpoint: round(midpoint), stop: round(stop),
    tp1: roundedTp1, tp2: round(tp2), rrWorst: round(rrWorst, 2), targetAtrMultiple,
    publishedTp1AtrMultiple: round((roundedTp1 - roundedHigh) / atr, 3),
    stopPct: round((high - stop) / high * 100, 1),
  };
}

const thesis = {
  BDX: 'La tendance reste haussière, mais le titre est déjà à près de 15% de sa moyenne 50 jours. Il ne mérite une entrée que sur cassure tenue dans la zone; un gap sans retour VWAP est refusé.',
  RVTY: 'Le momentum santé est propre au-dessus des trois moyennes, avec une extension moins forte que BDX. La confirmation attendue est une reprise du haut de zone qui conserve le VWAP.',
  NWSA: 'La structure est haussière sans l’extension extrême des anciens leaders Momentum. Les dépôts SEC récents concernent des mises à jour d’entreprise, pas une nouvelle publication de résultats; le trade reste soumis à la tenue du VWAP.',
  HTGC: 'Le titre consolide au-dessus des moyennes 20, 50 et 200 jours. Son émission de 325 M$ de notes senior à 6,300% échéance 2031 est une dette, pas une offre d’actions, mais elle renforce la sensibilité aux taux. La cassure doit tenir; sous le VWAP, le plan reste désarmé.',
  PCAR: 'Le titre corrige vers ses moyennes tout en restant au-dessus de la moyenne 200 jours. Il faut reprendre l’EMA20 avant d’acheter: le repli seul n’est pas une confirmation.',
  GE: 'La tendance longue reste positive, mais le recul a cassé les moyennes courtes. Le plan attend une reprise de l’EMA20 et du VWAP; sans cette séquence, aucune entrée.',
  ELS: 'Le REIT conserve sa moyenne 200 jours mais travaille sous l’EMA20. Une reprise de cette moyenne et du VWAP est obligatoire, particulièrement avec le 10 ans américain à 4,72%.',
  IGV: 'Le logiciel a conservé l’essentiel de son gap après les résultats de la semaine. L’ETF réduit le risque spécifique, mais son extension impose une cassure propre ou un retour VWAP.',
  KBE: 'Les banques restent au-dessus de leur moyenne 200 jours mais sous leurs moyennes courtes. L’ETF évite le doublon avec une banque individuelle; il reste désarmé sans reprise de l’EMA20 et du VWAP.',
};

const selectedEarnings = read('scanner/20260831/_data2/earnings_selected.json');
const selectedSec = read('scanner/20260831/_data2/sec_selected_evidence.json');
const finalCorrelation = read('scanner/20260831/_data2/risk_correlation_final.json');
const finalSizing = read('scanner/20260831/_data2/risk_sizing_final.json');

const setups = selected.map(symbol => {
  const [name, description, sector, region, pattern, sharia] = meta[symbol];
  const rec = records.get(symbol);
  if (!rec?.quote || !rec?.tech) throw new Error(`Missing governed enrichment for ${symbol}`);
  const q = rec.quote, t = rec.tech;
  const price = Number(q.price), atr = Number(t.atr);
  const source = screenBySymbol.get(`${pattern.toLowerCase()}:${symbol}`);
  if (!source) throw new Error(`Missing archived ${pattern} screen row for ${symbol}`);
  if (source.screen_snapshot_as_of !== REF || !Number.isFinite(source.estimated_valid_bars) || source.estimated_valid_bars < 1) {
    throw new Error(`Stale or unbounded screen row for ${symbol}: snapshot=${source.screen_snapshot_as_of}, valid_bars=${source.estimated_valid_bars}`);
  }
  const L = levels(pattern, price, atr, rec.bars, t.ema20);
  const sec = region === 'ETF' ? null : selectedSec.coverage[symbol];
  if (region !== 'ETF' && !sec) throw new Error(`Missing exact SEC evidence for ${symbol}`);
  const score = round(Number(source.score), 1);
  if (!Number.isFinite(score) || score < 80 || score > 100) {
    throw new Error(`Governed screener score out of editorial range for ${symbol}: ${source.score}`);
  }
  const distance50 = q.fiftyDayAverage ? round((price / q.fiftyDayAverage - 1) * 100) : round((price / t.ema50 - 1) * 100);
  const lookthrough = symbol === 'IGV'
    ? { factor: 'us_software', clusters: ['enterprise_software', 'cybersecurity', 'interactive_media'] }
    : symbol === 'KBE'
      ? { factor: 'us_banks', clusters: ['banks', 'credit_cycle', 'yield_curve'] }
      : null;
  return {
    ticker: symbol, name, description, logo_gradient: colors[sector], price: round(price),
    change_pct: round(Number(q.changePercent) * 100), score, pattern, region,
    region_flag: region === 'ETF' ? 'ETF US' : 'US', region_label: region === 'ETF' ? 'ETF coté aux États-Unis' : 'États-Unis',
    sector, sharia, extra_badges: region === 'ETF' ? ['ETF US'] : [],
    radar_scores: {
      momentum: Math.max(45, Math.min(92, Math.round(58 + (Number(t.rsi) - 50) * 1.1))),
      fundamentals: 50,
      technical: Math.max(40, Math.min(90, 50 + (price > t.ema200 ? 12 : 0) + (t.ema20 > t.ema50 ? 10 : 0) + (t.ema50 > t.ema200 ? 8 : 0))),
      volume: Math.max(25, Math.min(90, Math.round(50 + ((Number(q.volume) / Number(source.avg_volume || q.volume)) - 1) * 25))),
      sentiment: 50,
      macro: 50,
    },
    radar_unavailable: ['fundamentals', 'sentiment', 'macro'],
    selection_evidence: {
      screen_snapshot_as_of: source.screen_snapshot_as_of,
      detected_at: source.detected_at,
      estimated_valid_bars: source.estimated_valid_bars,
      source_screen_score: round(source.score, 1),
      avg_daily_dollar_volume: round(Number(source.avg_volume) * price),
      score_note: 'Score technique exact du screener archivé; ce n’est pas une probabilité de gain.',
    },
    entry_low: L.low, entry_high: L.high,
    entry_display: `${L.low}–${L.high} $; gate min(open, VWAP), pullback VWAP seul si gap >2%`,
    stop: L.stop, tp1: L.tp1, tp2: L.tp2,
    rr: `1:${L.rrWorst.toFixed(2)}`, rr_entry: L.rrWorst, tp1_atr_multiple: L.publishedTp1AtrMultiple,
    execution: {
      status: 'conditional_next_session', observed_vwap: null, observed_at: null,
      ...( ['PCAR', 'GE'].includes(symbol) ? { max_intraday_chase_pct: 2 } : {}),
      gate: ['PCAR', 'GE'].includes(symbol)
        ? 'No order before 09:30–09:45 ET. Require price in zone and above observed VWAP; reject if price rallied more than 2% from the opening print before entering the zone.'
        : 'No order before the 09:30–09:45 ET window; require price in zone and above observed VWAP.',
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
      ...(['PCAR', 'GE'].includes(symbol) ? ['Hausse supérieure à 2% depuis l’ouverture avant l’entrée dans la zone: aucune poursuite'] : []),
      'Perte du VWAP avec pression vendeuse croissante',
      symbol === 'IGV'
        ? 'Aucune conservation overnight avant les résultats logiciels des 2–3 septembre sans nouvelle validation'
        : 'Donnée devenue stale, earnings surprise ou bascule du régime',
    ],
    market_cap: region === 'ETF' ? null : Number(q.marketCap) || null,
    extension: { rsi: round(t.rsi, 1), atr: round(atr, 4), distance_50dma_pct: distance50 },
    earnings_clear: region === 'ETF' ? null : true,
    dilution_clear: region === 'ETF' ? null : sec.equity_offering_hits.length === 0,
    earnings_source: region === 'ETF' ? 'n_a_etf' : sec.issuer_filing_regime === 'foreign_private_issuer' ? 'issuer_calendar_verified' : '8k_item_202',
    earnings_forward_evidence: {
      checked_at: selectedEarnings.as_of,
      days_ahead: selectedEarnings.query.days_ahead,
      result: selectedEarnings.coverage[symbol] || null,
      event_found: (selectedEarnings.events || []).some(event => event.symbol === symbol),
      source_artifact: 'scanner/20260831/_data2/earnings_selected.json',
    },
    ...(sec ? { issuer_filing_regime: sec.issuer_filing_regime } : {}),
    dilution_scope: region === 'ETF'
      ? 'n_a_etf; component-level event risk disclosed in calendar/look-through'
      : `official SEC/EDGAR filings reviewed over ${selectedSec.dilution_window.days} days; equity offering hits: ${sec.equity_offering_hits.length}; non-equity offerings are classified separately`,
    ...(sec ? {
      sec_evidence: {
        source_artifact: 'scanner/20260831/_data2/sec_selected_evidence.json',
        checked_at: selectedSec.as_of,
        pagination_exhausted: selectedSec.pagination_exhausted,
        latest_earnings_filing: sec.latest_earnings_filing,
        issuer_calendar_verified: sec.issuer_calendar_verified || false,
        dilution_window: selectedSec.dilution_window,
        equity_offering_hits: sec.equity_offering_hits,
        non_equity_offering_hits: sec.non_equity_offering_hits,
      },
    } : {}),
    ...(lookthrough ? { lookthrough } : {}),
  };
});

const riskGating = {
  systematic_regime_score: 0.79,
  marketdata_model: 'context_conditional',
  marketdata_engine: 'fallback_rule_based',
  ensemble_confidence: 0.5,
  crisis_prob_5d: 0.0829,
  regime_source: 'systematic DtxRegime is canonical; marketdata context_conditional output used its disclosed fallback_rule_based engine because TLT history was insufficient',
  max_pair_correlation: round(finalCorrelation.max_pair.correlation, 4),
  max_pair_symbols: [finalCorrelation.max_pair.symbol_a, finalCorrelation.max_pair.symbol_b],
  avg_off_diagonal_correlation: finalCorrelation.avg_off_diagonal,
  correlation_observations: finalCorrelation.n_observations,
  correlation_method: `${finalCorrelation.method} ${finalCorrelation.returns_type} returns; requested ${finalCorrelation.window_days_requested} sessions`,
  sizing: `MCP balanced inverse-ATR sizing returned ${finalSizing.gross_exposure_pct}% gross exposure and was rejected; candidates remain conditional and are not a simultaneous portfolio allocation`,
  sizing_endpoint_cash_reserve_pct: finalSizing.cash_reserve_pct,
  sizing_endpoint_expected_vol_pct: finalSizing.portfolio_expected_vol_pct,
  sizing_endpoint_max_correlation: finalSizing.portfolio_max_correlation,
  allocation_recommendation_pct: finalSizing.allocation_recommendation_pct,
};
const avgScore = round(setups.reduce((sum, x) => sum + x.score, 0) / setups.length, 1);
const data = {
  _comment: `Scanner ${SCAN_DATE}, clôture de référence ${REF}. Univers volontairement limité aux actions et ETF cotés aux États-Unis.`,
  date: SCAN_DATE, session_label: 'Séance du lundi 31 août 2026', url: '/scanner/20260831/',
  regime: 'RISK-ON', regime_score: 0.79, regime_color: '#16a34a',
  tags: ['us', 'etf', 'technique', 'trade-idea', 'momentum', 'pullback', 'industrials', 'healthcare', 'software'],
  kpis: {
    vix: { value: '14,43', label: 'volatilité contenue', color: '#16a34a' },
    spx: { value: '7 711,76', change_pct: -0.25, color: '#dc2626' },
    avg_score: avgScore, dominant_patterns: ['Momentum', 'Pullback'],
  },
  alerts: [
    { type: 'warning', title: 'Risk-on, mais largeur plus faible', text: 'Le S&P 500 a cédé 0,25% vendredi et le Russell 2000 1,39%. Le régime systématique reste RISK-ON à 0,79 avec VIX 14,43, mais les entrées du lundi restent conditionnées au VWAP.' },
    { type: 'warning', title: 'Allocation simultanée interdite', text: 'Le sizing portefeuille a été rejeté: l’exposition brute proposée dépassait le capital disponible. Allocation recommandée du panier complet: 0%. La corrélation maximale de 0,4998 repose sur seulement 26 observations; elle ne prouve pas une diversification robuste.' },
    { type: 'warning', title: 'Momentum plafonné', text: 'Momentum compte 30 propositions arrivées à horizon: 22 résolues et 8 jamais remplies. Les 22 résolues affichent un profit factor de 0,59. Le plafond temporaire est de 40%; le panier n’en garde que 3 sur 9.' },
    { type: 'info', title: 'Données optionnelles limitées', text: 'Les flux institutionnels optionnels ont été limités. Le contrôle secondaire context_conditional a utilisé son fallback rule-based, avec 50% de confiance, faute d’historique TLT suffisant; le régime systématique à 0,79 reste la source canonique.' },
  ],
  intro: 'Le régime systématique reste RISK-ON à 0,79, mais la séance de vendredi a été plus faible sous la surface: Nasdaq -0,52%, Russell 2000 -1,39%, or -3,43% et bitcoin -3,57%. Le panier du lundi garde sept actions US et deux ETF US, plafonne Momentum après sa mauvaise rétro récente et exige une confirmation VWAP. Une dixième ligne n’a pas été forcée après le rejet d’un ticker mal identifié.',
  strategy: 'Trois Momentum au maximum, seulement sur cassure tenue. Les Pullback exigent la reprise de l’EMA20 et du VWAP; ils sont mieux orientés dans la dernière rétro, mais leur échantillon reste limité. Un gap supérieur à 2% au-dessus de la zone annule l’entrée directe.',
  regime_prose: 'Le S&P 500 reste au-dessus de ses moyennes 50, 100 et 200 jours; le VIX est sous sa moyenne 14 jours et ne monte pas. En contrepoint, le dollar a gagné 0,52%, les taux 10 ans atteignent 4,72% et les actifs à bêta élevé ont corrigé. Le régime autorise le risque, pas le relâchement des gates.',
  regime_strategy_weights: { momentum: 0.33, breakout: 0.22, pullback: 0.45, presqueeze: 0 },
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
  score_methodology: 'Score technique exact du screener archivé. Ce nombre classe les candidats; il ne mesure pas une probabilité de gain. Les axes sans donnée vérifiée restent neutres à 50 et sont signalés comme indisponibles.',
  macro_calendar: [
    { date: '31 août', event: 'Inflation flash zone euro', impact: 'élevé', dir: 'flat', note: 'Risque dollar et taux avant la séance US' },
    { date: '1 septembre', event: 'ISM manufacturier; discours de Michael Barr', impact: 'moyen / élevé', dir: 'flat', note: '10h00 ET puis signal Fed séparé' },
    { date: '2–3 septembre', event: 'AVGO, SNOW, HPE, ZS et logiciels', impact: 'élevé', dir: 'flat', note: 'Risque de lecture croisée pour IGV' },
    { date: '3 septembre', event: 'Inscriptions chômage, discours Waller, ISM services', impact: 'moyen / élevé', dir: 'flat', note: '8h30–10h00 ET' },
    { date: '4 septembre', event: 'Rapport emploi américain', impact: 'élevé', dir: 'flat', note: 'Réduire la poursuite avant le chiffre' },
  ],
  sector_rotation: [
    { sector: 'Banques', perf: 'repli contrôlé', signal: 'reprise EMA20 requise', exposure: 'KBE', dir: 'flat' },
    { sector: 'Logiciels', perf: 'fort mais étendu', signal: 'gap de jeudi largement conservé', exposure: 'IGV', dir: 'up' },
    { sector: 'Santé', perf: 'sélectif', signal: 'momentum sur dispositifs et diagnostics', exposure: 'BDX, RVTY', dir: 'up' },
    { sector: 'Industrie', perf: 'repli dans tendance longue', signal: 'reclaim EMA20 obligatoire', exposure: 'PCAR, GE', dir: 'flat' },
    { sector: 'Crédit spécialisé', perf: 'constructif mais sensible aux taux', signal: 'cassure tenue requise', exposure: 'HTGC', dir: 'flat' },
    { sector: 'Immobilier coté', perf: 'sous pression des taux', signal: 'reprise EMA20 obligatoire', exposure: 'ELS', dir: 'flat' },
  ],
  macro_thesis: 'La structure de tendance reste favorable, mais vendredi a montré une contraction du risque: petites capitalisations, crypto et métaux ont reculé ensemble tandis que le dollar et les taux montaient. Le scanner réduit Momentum à trois lignes, privilégie des reclaims plutôt que des poursuites, garde IGV et KBE comme expositions diversifiées et accepte de publier neuf plans au lieu de forcer un substitut.',
  engine_meta: {
    generated_at: new Date().toISOString(), regime: 'RISK-ON', reference_close: REF,
    freshness: { marketdata_bars: REF, systematic_last_data_date: REF }, risk_gating: riskGating,
  },
  disclaimer_extra: "Ceci n'est pas un conseil en investissement. Les niveaux sont conditionnels et deviennent caducs si les données, l’événement ou le régime changent.",
  setups, scanDate: '20260831',
};

const signals = setups.map(s => ({
  ticker: s.ticker, name: s.name, score: s.score, scoreFamily: 'editorial',
  scoreSource: 'governed_screener_score', strategy: s.pattern,
  price: s.price, entry: s.entry_high, entry_low: s.entry_low, entry_high: s.entry_high,
  stop: s.stop, tp1: s.tp1, tp2: s.tp2, rr: s.rr, rr_entry: s.rr_entry,
  tp1_atr_multiple: s.tp1_atr_multiple, horizon: s.horizon_days, region: s.region,
  sector: s.sector, market_cap: s.market_cap, sharia: s.sharia, extension: s.extension,
  earnings_clear: s.earnings_clear, dilution_clear: s.dilution_clear,
  earnings_source: s.earnings_source, earnings_forward_evidence: s.earnings_forward_evidence,
  issuer_filing_regime: s.issuer_filing_regime,
  dilution_scope: s.dilution_scope, thesis: s.thesis,
  execution: s.execution, sec_evidence: s.sec_evidence, selection_evidence: s.selection_evidence,
  ...(s.lookthrough ? { lookthrough: s.lookthrough } : {}),
}));
const signalsJson = {
  scanDate: SCAN_DATE, regime: 'RISK-ON', regimeScore: 79,
  regimeScoreScale: '0-100 (higher = risk-on)',
  _pipelineOrder: {
    earnings_screened_at: '2026-08-28T21:51:01.000Z',
    enrichment_started_at: '2026-08-28T21:56:15.000Z', candidates_screened: 60,
    method: 'Earnings and open-position gates preceded SEC, technical, bars and correlation enrichment; final universe is 7 US stocks plus 2 US-listed ETFs. No tenth candidate was forced.',
  },
  _memoryImpact: {
    rules_applied: ['pit-cache-key-end-date', 'tp1-reachability', 'vwap-entry-gate', 'pullback-trend-structure-gate', 'recent-strategy-performance'],
    notes: 'The immutable audit has 30 horizon-complete Momentum proposals: 22 resolved (PF 0.59, average R -0.243) and 8 no-fills excluded from performance metrics. The cap is 40%; this basket uses 3/9. Pullback and Breakout remain conditional because their mature samples are small.',
  },
  _editorialNote: 'US-only run. Optional flow calls were unavailable after rate limiting; no substitute flow data was fabricated.',
  _scoreMethodology: 'Score technique exact du screener archivé; ce n’est pas une probabilité de gain. La provenance est conservée pour chaque signal.',
  exited_factors: [],
  signals,
  momentum: signals.filter(s => s.strategy === 'Momentum'),
  breakout: signals.filter(s => s.strategy === 'Breakout'),
  pullback: signals.filter(s => s.strategy === 'Pullback'),
  pre_squeeze: signals.filter(s => s.strategy === 'Pre-Squeeze'),
  tkl_pool: [], dtx_pool: [], fortress_pool: [],
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
      name: 'risk_sizing_final', as_of: finalSizing.as_of, data_through: REF,
      max_age_h: 24, required: true,
      note: 'marketdata.PortfolioRisk sizing final basket; artifact scanner/20260831/_data2/risk_sizing_final.json',
    },
    {
      name: 'risk_correlation_final', as_of: finalCorrelation.as_of, data_through: REF,
      max_age_h: 24, required: true,
      note: 'marketdata.PortfolioRisk correlation final basket; artifact scanner/20260831/_data2/risk_correlation_final.json',
    },
    {
      name: 'earnings_selected', as_of: selectedEarnings.as_of, data_through: REF,
      max_age_h: 72, required: true,
      note: 'Exact final-basket forward earnings query, 7 days; artifact scanner/20260831/_data2/earnings_selected.json',
    },
    {
      name: 'sec_selected_evidence', as_of: selectedSec.as_of, data_through: REF,
      max_age_h: 168, required: true,
      note: 'Exact final-basket SEC evidence with exhausted pagination and direct EDGAR supplement; artifact scanner/20260831/_data2/sec_selected_evidence.json',
    },
  ],
};

fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(DIR, 'signals.json'), JSON.stringify(signalsJson, null, 2));
fs.writeFileSync(path.join(DIR, 'harness.json'), JSON.stringify(harness, null, 2));
console.log(`wrote ${setups.length} setups, avg score ${avgScore}`);
for (const s of setups) console.log(`${s.ticker} ${s.pattern} ${s.entry_low}-${s.entry_high} stop=${s.stop} tp1=${s.tp1} rr=${s.rr}`);
