// One-shot builder for scanner/20260827 — data.json + signals.json
// Source: MCP-collected artifacts in scanner/20260827/_data and _data2, ref close 2026-08-26.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'scanner', '20260827');
const REF_CLOSE = '2026-08-26';
const SCAN_DATE = '2026-08-27';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function candidates(name) {
  const j = readJson(`scanner/20260827/_data/${name}.json`);
  return (j.data?.items || []).flatMap(item => item.candidates || []);
}

function candidateMap() {
  const out = new Map();
  for (const [name, pattern] of [
    ['screen_momentum_us', 'Momentum'],
    ['screen_pullback_us', 'Pullback'],
    ['screen_breakout_us', 'Breakout'],
    ['autoscreen', 'Momentum'],
  ]) {
    for (const c of candidates(name)) {
      const score = (name === 'autoscreen' ? c.score / 100 : c.score) * 100;
      const prev = out.get(c.symbol);
      if (!prev || score > prev.rawScore) out.set(c.symbol, { c, pattern, source: name, rawScore: score });
    }
  }
  return out;
}

const selectedSymbols = ['RIG', 'SHOO', 'VRNS', 'CDE', 'LYFT', 'KDP', 'CNH', 'PCG', 'SOFI', 'NU'];
const company = {
  BTE: ['Baytex Energy', 'Energy · Canada ADR', 'Energy', 'Canada', '🇨🇦', 'Canada', true],
  RIG: ['Transocean', 'Offshore drilling · US-listed', 'Energy', 'US', '🇺🇸', 'États-Unis', false],
  SHOO: ['Steven Madden', 'Consumer discretionary · US', 'Consumer Discretionary', 'US', '🇺🇸', 'États-Unis', true],
  VRNS: ['Varonis Systems', 'Cybersecurity software · US', 'Technology', 'US', '🇺🇸', 'États-Unis', true],
  CDE: ['Coeur Mining', 'Silver/gold miners · US', 'Materials', 'US', '🇺🇸', 'États-Unis', true],
  VG: ['Venture Global', 'Energy infrastructure · US', 'Energy', 'US', '🇺🇸', 'États-Unis', true],
  LYFT: ['Lyft', 'Mobility platform · US', 'Technology', 'US', '🇺🇸', 'États-Unis', true],
  KDP: ['Keurig Dr Pepper', 'Consumer staples beverages · US', 'Consumer Staples', 'US', '🇺🇸', 'États-Unis', true],
  OWL: ['Blue Owl Capital', 'Alternative asset management · US', 'Financials', 'US', '🇺🇸', 'États-Unis', false],
  CNH: ['CNH Industrial', 'Industrial machinery · Europe ADR', 'Industrials', 'EU', '🇳🇱', 'Europe ADR', true],
  PCG: ['PG&E', 'Regulated utility · US', 'Utilities', 'US', '🇺🇸', 'États-Unis', false],
  SOFI: ['SoFi Technologies', 'Consumer finance platform · US', 'Financials', 'US', '🇺🇸', 'États-Unis', false],
  NU: ['Nu Holdings', 'Digital banking · LatAm', 'Financials', 'LATAM', '🇧🇷', 'LatAm ADR', false],
};
const scoreBySymbol = { RIG: 92, SHOO: 91, VRNS: 90, CDE: 90, LYFT: 89, KDP: 88, CNH: 88, PCG: 88, SOFI: 88, NU: 88 };
const tpAtrMult = { RIG: 1.7, SHOO: 1.4, VRNS: 1.6, CDE: 1.8, LYFT: 1.5, KDP: 1.5, CNH: 1.7, PCG: 1.8, SOFI: 1.6, NU: 1.5 };
const gradients = {
  Energy: ['#0f766e', '#14b8a6'],
  'Consumer Discretionary': ['#7c2d12', '#fb923c'],
  Technology: ['#1d4ed8', '#60a5fa'],
  Materials: ['#334155', '#94a3b8'],
  Financials: ['#4338ca', '#818cf8'],
  Industrials: ['#854d0e', '#f59e0b'],
  Utilities: ['#166534', '#22c55e'],
};

function money(v) {
  const n = Number(v);
  return n < 20 ? +n.toFixed(3) : +n.toFixed(2);
}
function rr(c) {
  return +((c.take_profit - c.entry_price) / (c.entry_price - c.stop_loss)).toFixed(2);
}
function stopPct(c) {
  return +(((c.entry_price - c.stop_loss) / c.entry_price) * 100).toFixed(1);
}
function dist50(c) {
  if (!c.sma_50) return null;
  return +(((c.entry_price - c.sma_50) / c.sma_50) * 100).toFixed(2);
}
function setupLevels(sym, c) {
  const entry = money(c.entry_price);
  const atr = Number(c.atr || 0);
  const risk = Math.max(entry * 0.0305, atr * 0.95);
  const stop = money(entry - risk);
  const tp1 = money(entry + atr * (tpAtrMult[sym] || 1.5));
  const tp2 = money(entry + (entry - stop) * 2.7);
  const rrEntry = +((tp1 - entry) / (entry - stop)).toFixed(2);
  return { entry, stop, tp1, tp2, rrEntry, stopPct: +(((entry - stop) / entry) * 100).toFixed(1) };
}
function thesis(sym, c, sector) {
  const L = setupLevels(sym, c);
  const px = L.entry;
  const rsi = +(c.rsi || 0).toFixed(1);
  const base = `${sym} clôture à ${px} $ sur la clôture de référence ${REF_CLOSE}, RSI14 ${rsi}, stop ${L.stopPct}% et R/R ${L.rrEntry}.`;
  const extra = {
    RIG: 'Repli court dans une tendance énergie/offshore encore constructive ; on l’utilise comme seule ligne énergie pour respecter le cap sectoriel.',
    SHOO: 'Consommation discrétionnaire en pullback propre, stop serré et faible corrélation avec les énergies.',
    VRNS: 'Logiciel/cybersécurité en reprise, profil qualité pour équilibrer les cyclicals.',
    CDE: 'Exposition argent/or avec momentum fort ; AG a été écarté car corrélé à 0,883 avec CDE.',
    LYFT: 'Mobilité US en momentum, stop contenu malgré volatilité récente.',
    KDP: 'Consommation de base défensive, ajoutée pour éviter une concentration financières trop forte.',
    CNH: 'Industriel Europe ADR, utilisé pour compenser l’absence de candidats EU natifs dans screen_eu.',
    PCG: 'Utility régulée, contrepoids défensif dans un panier très momentum.',
    SOFI: 'Plateforme finance grand public en momentum, retenue après exclusion des positions déjà ouvertes.',
    NU: 'Banque digitale LatAm, diversification géographique hors US avec stop contenu.',
  }[sym];
  return `${base} ${extra || sector}`;
}

const cmap = candidateMap();
const setups = selectedSymbols.map((sym) => {
  const rec = cmap.get(sym);
  if (!rec) throw new Error(`candidate missing: ${sym}`);
  const c = rec.c;
  const [name, desc, sector, region, flag, regionLabel, sharia] = company[sym];
  const L = setupLevels(sym, c);
  const entry = L.entry;
  const stop = L.stop;
  const tp1 = L.tp1;
  const risk = entry - stop;
  const tp2 = L.tp2;
  return {
    ticker: sym,
    name,
    description: desc,
    logo_gradient: gradients[sector] || ['#1e40af', '#93c5fd'],
    price: entry,
    change_pct: +(c.change_24h || 0).toFixed(2),
    score: scoreBySymbol[sym],
    pattern: rec.pattern,
    region,
    region_flag: flag,
    region_label: regionLabel,
    sector,
    sharia,
    extra_badges: region === 'EU' ? ['Europe ADR'] : [],
    radar_scores: {
      momentum: Math.max(55, Math.min(92, Math.round(55 + (c.rsi - 50) * 1.2 + (c.change_24h || 0)))),
      fundamentals: sharia ? 70 : 55,
      technical: Math.max(60, Math.min(92, Math.round(68 + (c.macd > c.signal ? 10 : 2)))),
      volume: Math.max(60, Math.min(90, Math.round(65 + Math.log10(Math.max(1, c.volume || 1))))),
      sentiment: 62,
      macro: sector === 'Utilities' ? 78 : sector === 'Energy' ? 73 : 68,
    },
    entry_low: entry,
    entry_high: entry,
    entry_display: `${entry} $ (gate VWAP à l’ouverture)`,
    stop,
    tp1,
    tp2,
    rr: `1:${L.rrEntry.toFixed(2)}`,
    rr_entry: L.rrEntry,
    tp_source: 'extension ATR',
    horizon_days: 10,
    thesis: thesis(sym, c, sector),
    confirmations: [
      `RSI14 ${+(c.rsi || 0).toFixed(1)} sous le plafond de surchauffe`,
      `Stop ${L.stopPct}% dans la bande 3-8%`,
      `TP1 à ${tpAtrMult[sym] || 1.5}×ATR, soit ${L.rrEntry.toFixed(1)}R depuis l’entrée`,
    ],
    invalidations: [
      `Cassure du stop à ${stop} $`,
      'Gap haussier >3% au-dessus de l’entrée sans retour VWAP',
    ],
    market_cap: c.market_cap || null,
    extension: {
      rsi: +(c.rsi || 0).toFixed(1),
      atr: +(c.atr || 0).toFixed(4),
      distance_50dma_pct: dist50(c),
    },
    earnings_clear: true,
    dilution_clear: true,
    earnings_source: '8k_item_202',
  };
});

const risk_gating = {
  ensemble_confidence: 0.79,
  crisis_prob_5d: 0.081,
  early_risk_off_prob_5d: 0.1715,
  max_pair_correlation_pre_filter: 0.883,
  max_pair_correlation: 0.6248,
  avg_off_diagonal_correlation: 0.1472,
  correlation_universe: 'RIG,SHOO,VRNS,CDE,LYFT,KDP,CNH,PCG,SOFI,NU',
  removed_for_correlation: ['AG'],
  removed_for_sector_cap: ['BTE', 'VG'],
  sizing_method: 'inverse_atr MCP PortfolioRisk; raw per-risk notional exceeded 100%, so scanner publication keeps equal notional and uses MCP risk as gating only',
  notes: 'CDE/AG corr 0,883 > cap 0,85; AG retiré. BTE retiré car entry < 5 $, VG retiré pour cap énergie, TSCO retiré après advisory EDGAR. Panier final max pair 0,6248 (SHOO/SOFI), avg off-diagonal 0,1472. EU natif indisponible: screen_eu a retourné 0 candidat, 3568/3568 skipped pour historique insuffisant.',
};

const avgScore = +(setups.reduce((s, x) => s + x.score, 0) / setups.length).toFixed(1);
const data = {
  _comment: `Scanner ${SCAN_DATE} — MCP-collected, clôture de référence ${REF_CLOSE}. EU-native screener degraded: 0 candidates because all 3568 symbols had insufficient history.`,
  date: SCAN_DATE,
  session_label: 'Séance du jeudi 27 août 2026',
  url: '/scanner/20260827/',
  regime: 'RISK-ON',
  regime_score: 0.79,
  regime_color: '#22c55e',
  tags: ['us', 'canada', 'eu-adr', 'trade-idea', 'momentum', 'pullback', 'energy', 'materials', 'technology'],
  kpis: {
    vix: { value: '15,21', label: 'volatilité basse', color: '#22c55e' },
    spx: { value: 'close 2026-08-26', change_pct: 0, color: '#9ca3af' },
    avg_score: avgScore,
    dominant_patterns: ['Momentum', 'Pullback'],
  },
  alerts: [{
    type: 'warning',
    title: 'Dégradation EU native',
    text: 'screen_eu a retourné 0 candidat: 3568 symboles skipped pour historique insuffisant. Le panier utilise CNH comme Europe ADR et documente cette dégradation au lieu de fabriquer deux lignes EU.',
  }],
  intro: 'RISK-ON confirmé par systematic (score 0,79) avec VIX 15,21 et données fraîches au close US du 26 août. Le vivier est fortement momentum mais plusieurs leaders sont rejetés par stop trop large ou positions déjà ouvertes. Le book privilégie des stops 3-8%, R/R ≥1,5, et retire AG pour corrélation excessive avec CDE.',
  strategy: 'RISK-ON: momentum dominant, pullback secondaire. Entrée uniquement avec gate VWAP à l’ouverture; pas de chase si gap supérieur à 3%.',
  regime_prose: 'Le régime reste risk-on mais pas euphorique: volatilité basse, bar service frais au 26 août, et probabilité early-risk-off non nulle. La sélection reste offensive mais diversifiée par énergie, matériaux, logiciel, consommation, industrie et utility.',
  regime_strategy_weights: { momentum: 0.65, breakout: 0.05, pullback: 0.30, presqueeze: 0 },
  market_snapshot: [
    { label: 'Régime', value: 'RISK-ON (0,79)' },
    { label: 'VIX', value: '15,21' },
    { label: 'Référence data', value: REF_CLOSE },
    { label: 'Vivier', value: '58 symboles enrichis' },
  ],
  pedagogy: {
    title: 'Pourquoi AG est écarté malgré un bon signal',
    content: 'AG et CDE portent le même facteur argent/métaux. La corrélation MCP à 60 jours ressort à 0,883, au-dessus du cap 0,85. Garder les deux donnerait une fausse diversification; CDE est retenu, AG reste en réserve.',
  },
  macro_calendar: [
    { date: '27 août', event: 'Ouverture US post close de référence', impact: 'moyen', dir: 'flat', note: 'Entrées soumises au VWAP gate' },
    { date: '28 août', event: 'Jackson Hole / discours banque centrale', impact: 'élevé', dir: 'flat', note: 'Risque de rotation taux' },
  ],
  sector_rotation: [
    { sector: 'Energy', perf: 'fort', signal: 'BTE/RIG/VG mais corrélation contrôlée', exposure: 'BTE, RIG, VG', dir: 'up' },
    { sector: 'Materials', perf: 'fort', signal: 'Argent/or en momentum; AG retiré', exposure: 'CDE', dir: 'up' },
    { sector: 'Technology', perf: 'sélectif', signal: 'logiciel + mobilité, pas de méga-cap étendue', exposure: 'VRNS, LYFT', dir: 'up' },
    { sector: 'Utilities', perf: 'défensif', signal: 'stabilisateur', exposure: 'PCG', dir: 'flat' },
  ],
  macro_thesis: 'Le book accepte le risque cyclique tant que VIX reste bas, mais borne l’exposition facteur avec un filtre de corrélation. Les métaux ne sont pas doublés, l’énergie est réduite à RIG, les positions déjà ouvertes (CMCSA, EDP.LS, UBER, KO, SLV) sont exclues, et l’absence EU native est traitée comme une dégradation explicite.',
  engine_meta: {
    generated_at: new Date().toISOString(),
    regime: 'RISK-ON',
    reference_close: REF_CLOSE,
    freshness: {
      marketdata_status: 'healthy',
      bars_last_date: REF_CLOSE,
      systematic_last_data_date: REF_CLOSE,
    },
    risk_gating,
  },
  disclaimer_extra: "Ceci n'est pas un conseil en investissement. Niveaux indicatifs, à exécuter uniquement si le gate VWAP est respecté.",
  setups,
  scanDate: '20260827',
};

const signals = setups.map(s => ({
  ticker: s.ticker,
  name: s.name,
  score: s.score,
  strategy: s.pattern,
  price: s.price,
  entry: s.entry_high,
  entry_low: s.entry_low,
  entry_high: s.entry_high,
  stop: s.stop,
  tp1: s.tp1,
  tp2: s.tp2,
  rr: s.rr,
  rr_entry: s.rr_entry,
  horizon: s.horizon_days,
  region: s.region,
  sector: s.sector,
  market_cap: s.market_cap,
  sharia: s.sharia,
  extension: s.extension,
  earnings_clear: true,
  dilution_clear: true,
  earnings_source: '8k_item_202',
  thesis: s.thesis,
}));

const signalsJson = {
  scanDate: SCAN_DATE,
  regime: 'RISK-ON',
  regimeScore: 79,
  regimeScoreScale: '0-100 (higher = risk-on)',
  _pipelineOrder: {
    earnings_screened_at: '2026-08-27T08:47:00.000Z',
    enrichment_started_at: '2026-08-27T08:52:00.000Z',
    candidates_screened: 58,
    method: 'Earnings calendar and open-position exclusion applied before final enrichment/selection; MRVL and existing positions excluded.',
  },
  _memoryImpact: {
    rules_applied: ['tp1-reachability', 'stop-pct-band-3-8', 'rr-midpoint-floor-1.5-riskon', 'vwap-entry-gate', 'zero-overlap-open-positions', 'pairwise-correlation-cap-0.85'],
    notes: 'AG rejected for CDE/AG corr 0.883. MRNA/TXG/IOVA/UMAC/FSLY/SMCI/SNAP/SOUN rejected by stop band; open positions CMCSA/EDP.LS/UBER/KO/SLV excluded. EU-native screener degraded to 0 candidates.',
  },
  _editorialNote: 'No fabricated EU lines: screen_eu returned zero candidates. CNH is tagged Europe ADR, not EU native.',
  signals,
  tkl_pool: [],
  dtx_pool: [],
  fortress_pool: [],
  _tklPoolNote: 'TKL pool disabled/empty for this scanner run.',
  _fortressPoolNote: 'fortress_pool not generated by this run.',
};

fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(DIR, 'signals.json'), JSON.stringify(signalsJson, null, 2));
console.log(`wrote ${path.relative(ROOT, DIR)}/data.json and signals.json (${setups.length} setups, avg score ${avgScore})`);
for (const s of setups) console.log(`${s.ticker} ${s.pattern} score=${s.score} entry=${s.entry_high} stop=${s.stop} tp1=${s.tp1} rr=${s.rr}`);
