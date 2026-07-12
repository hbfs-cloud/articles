#!/usr/bin/env node
'use strict';

/**
 * etf-scanner.js — Regime-Adaptive ETF Momentum Scanner (exact port of systematic-tss)
 *
 * Cluster-based regime-adaptive scanner for ETFs.
 * Detects regime (RISK_OFF/NEUTRAL/RISK_ON/RECOVERY/EARLY_RISK_OFF) and applies
 * cluster-specific filters: mean reversion in bear markets, momentum in bull.
 * Market breadth (SPY/QQQ/IWM above MA50) + VIX ratio for trend.
 *
 * ⚠️ MCP-PRIMARY : la SEULE source de données est le staging MCP (--ingest) produit par l'agent.
 * Le fetch Yahoo + la lecture des univers locaux (data/etf-{us,eu}-universe.json) ont été retirés.
 *
 * Usage:
 *   node tools/etf-scanner.js --universe etf-us --ingest /tmp/etf-stage.json --output signals --folder 20260629
 *   node tools/etf-scanner.js --universe etf-eu --ingest /tmp/etf-eu-stage.json --output signals --folder 20260629
 *   node tools/etf-scanner.js --ingest /tmp/etf-stage.json --dry-run
 * (Sans --ingest : aucune source de données → MCP HARD STOP, marqueur incomplete + exit 3, rien fabriqué.)
 */

const fs = require('fs');
const path = require('path');
// js-yaml is OPTIONAL: it's only used to read the (tuned) systematic-tss config when that
// repo is present. Cloud routines clone only `articles` and may not have js-yaml installed —
// guard the require so the scanner never crashes with "missing module"; we fall back to the
// embedded DEFAULT_PARAMS_{US,EU} (verbatim copies of the tuned configs) in that case.
let yaml = null;
try { yaml = require('js-yaml'); } catch { /* absent → embedded DEFAULT_PARAMS used */ }
// ⚠️ MCP-PRIMARY (décret archi 2026-07-12 « le MCP fait foi ») : ce scanner NE FETCH PLUS aucune
// donnée marché (Yahoo/allorigins retiré) et NE LIT PLUS aucun univers local (data/etf-*-universe.json).
// L'UNIQUE source de données est le staging MCP produit par l'AGENT et passé via --ingest (cf. factor/
// top-10). Les requires `https`, `./lib/fractal-indicators` et `./lib/price-cache` ont donc été retirés :
// les indicateurs (mom20/rsi/atr/…) + le scoring cluster régime-adaptatif sont calculés côté AGENT
// (parité scanner_etf_momentum.go, source de vérité) AVANT de produire le staging. Le node se limite à
// ingérer + appliquer les gates hérités (blacklist/min_price/min_score/stop/rr) + diversifier + top-N.

const ROOT = path.join(__dirname, '..');

// ─── Scanner filter params — LOADED from the Go config (resync-friendly) ─────
// Root cause of the etf_eu ISO gap: scoreSymbol() hardcoded the *default* Go
// thresholds (getParamFloat64 defaults in scanner_etf_momentum.go), but the EU
// config OVERRIDES many of them via scanner_filters.params (tuned by backtest).
// We now read scanner_filters (+ .params) straight from the source-of-truth YAML,
// per universe, so the JS port stays aligned automatically when the Go side
// re-tunes. If the systematic-tss repo is absent (e.g. a cloud routine that only
// clones `articles`), we fall back to DEFAULT_PARAMS_{US,EU} — verbatim copies of
// the two configs — so the scanner still runs stand-alone.
//
// Source of truth:
//   US → systematic-tss/config/pre-live/portfolio_etf_us.yaml
//   EU → systematic-tss/config/pre-live/portfolio_etf_eu.yaml
// Both set allocation `pure` (US true = non-leveraged only; EU false = leveraged OK)
// and their own blacklist. These embedded defaults MUST mirror the YAML exactly.

// portfolio_etf_us.yaml → scanner_filters (+ .params). min_score removed in the
// config (per-regime params handle filtering) → treated as 0 here.
const DEFAULT_PARAMS_US = {
  min_price: 10,
  max_atr_ratio: 0.06,
  min_score: 0,
  blacklist: ['BITI', 'VXX', 'VXZ', 'COPJ', 'CTEX'],
  // RISK_ON
  riskon_max_atr: 0.045,
  riskon_min_mom: 0.02,
  riskon_rsi_boost_thresh: 60,
  riskon_rsi_boost_factor: 2.0,
  // RECOVERY
  recovery_max_rsi: 48,
  recovery_max_atr: 0.04,
  recovery_min_mom: 0.03,
  // RISK_OFF
  riskoff_deep_dip_dist: -0.05,
  riskoff_oversold_rsi: 40,
  riskoff_meanrev_rsi: 50,
  // NEUTRAL
  neutral_meanrev_rsi: 40,
  neutral_meanrev_dist: -0.03,
  neutral_lowvol_atr: 0.04,
  neutral_lowvol_mom: 0.05,
  // EARLY_RISK_OFF
  early_riskoff_max_rsi: 25,
  early_riskoff_min_dist: -0.10,
  // EXTREME fallback
  extreme_mom_thresh: 0.15,
  extreme_oversold_rsi: 30,
  extreme_oversold_dist: -0.05,
  extreme_min_dist_ma20: 0.0,
  // extreme_skip_* not set in US config → default 0 (fallback active)
};

// portfolio_etf_eu.yaml → scanner_filters (+ .params). These are the TUNED values
// that the old hardcoded JS ignored (recovery_max_rsi 45, neutral_lowvol_atr 0.035,
// neutral_lowvol_mom 0.08, riskon_min_mom 0.06, riskon_rsi_boost_thresh/factor 70/3,
// early_riskoff_max_rsi 18, extreme_skip_neutral / extreme_skip_early_riskoff 1.0).
const DEFAULT_PARAMS_EU = {
  min_price: 5,
  max_atr_ratio: 0.06,
  min_score: 80,
  blacklist: [
    'ZETH.DE', 'GDXJ.PA', 'BRE.PA', 'IQQH.DE', 'EXV7.DE', 'EXH2.DE', 'EXV2.DE',
    'ZPRR.DE', 'EXV4.DE', 'EXV5.DE', 'EXV6.DE', 'CC1.PA', 'BTC.PA', '3OIL.MI',
    'NUKL.DE', 'BNXG.DE', 'SLVR.DE', 'NGAS.MI', 'VVMX.DE', 'DAXLEV.MI', 'M9SD.DE',
    'GDXJ.MI', 'PHAU.AS', 'WDNA.MI', '3USS.MI', 'XCNA.MI', 'CURE.MI', 'REMX.MI',
  ],
  // RISK_ON
  riskon_max_atr: 0.045,
  riskon_min_mom: 0.06,
  riskon_rsi_boost_thresh: 70,
  riskon_rsi_boost_factor: 3.0,
  // RECOVERY
  recovery_max_rsi: 45,
  recovery_max_atr: 0.04,
  recovery_min_mom: 0.03,
  // RISK_OFF
  riskoff_deep_dip_dist: -0.05,
  riskoff_oversold_rsi: 40,
  riskoff_meanrev_rsi: 50,
  // NEUTRAL
  neutral_meanrev_rsi: 40,
  neutral_meanrev_dist: -0.03,
  neutral_lowvol_atr: 0.035,
  neutral_lowvol_mom: 0.08,
  // EARLY_RISK_OFF
  early_riskoff_max_rsi: 18,
  early_riskoff_min_dist: -0.10,
  // EXTREME fallback
  extreme_mom_thresh: 0.15,
  extreme_oversold_rsi: 30,
  extreme_oversold_dist: -0.05,
  extreme_min_dist_ma20: 0.0,
  extreme_skip_early_riskoff: 1.0,
  extreme_skip_neutral: 1.0,
};

// systematic-tss repo root (configurable via --tss-root / env TSS_ROOT; default
// sibling of the articles repo). Only used to READ the YAML source-of-truth.
function resolveTssRoot() {
  const cli = (() => { const i = process.argv.indexOf('--tss-root'); return i >= 0 ? process.argv[i + 1] : null; })();
  const cand = cli || process.env.TSS_ROOT || path.join(ROOT, '..', 'systematic-tss');
  return cand;
}

// Read scanner_filters (+ .params) from the Go portfolio YAML for the given universe.
// Returns { ...DEFAULTS, ...yamlOverrides }. Falls back to embedded DEFAULTS if the
// file is missing/unparseable (so the scanner is usable without systematic-tss).
function loadScannerParams(isEu) {
  const defaults = isEu ? DEFAULT_PARAMS_EU : DEFAULT_PARAMS_US;
  if (!yaml) return { params: { ...defaults }, source: 'embedded DEFAULT_PARAMS (js-yaml absent)' };
  const rel = isEu ? 'config/pre-live/portfolio_etf_eu.yaml' : 'config/pre-live/portfolio_etf_us.yaml';
  const fp = path.join(resolveTssRoot(), rel);
  try {
    const doc = yaml.load(fs.readFileSync(fp, 'utf8'));
    const alloc = doc?.portfolios?.[0]?.allocations?.[0];
    const sf = alloc?.scanner_filters;
    if (!sf) throw new Error('no scanner_filters');
    const out = { ...defaults };
    // scanner_filters-level scalars
    if (sf.min_price != null) out.min_price = sf.min_price;
    if (sf.max_atr_ratio != null) out.max_atr_ratio = sf.max_atr_ratio;
    // min_score may be absent (US) → 0
    out.min_score = sf.min_score != null ? sf.min_score : 0;
    // params.* overrides (numeric thresholds + blacklist)
    const p = sf.params || {};
    for (const [k, v] of Object.entries(p)) out[k] = v;
    if (Array.isArray(p.blacklist)) out.blacklist = p.blacklist;
    return { params: out, source: fp };
  } catch (e) {
    console.error(`⚠️  etf-scanner: could not read ${fp} (${e.message}) — using embedded DEFAULT_PARAMS_${isEu ? 'EU' : 'US'}.`);
    return { params: { ...defaults }, source: 'embedded-defaults' };
  }
}

// Read a numeric param with a Go getParamFloat64-style default (for optional
// filters absent from the embedded defaults, e.g. MA200/VIX filters = 0 → off).
function paramF(params, name, def) {
  const v = params[name];
  return (typeof v === 'number' && isFinite(v)) ? v : def;
}

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.etf / modes.etf_eu) ───
// Both modes share partialTPGain=10, disableTP2=true — identical values, so one constant
// covers etf-us and etf-eu. tp1 = entry × (1 + partialTPGain/100) is the REAL partial-TP
// trigger (not a fixed R multiple); rr is computed per-ticker from the actual stop distance
// instead of the previous hardcoded '1:2.0' (audit finding: uniform R/R across all signals).
// tp2 = 2x the TP1 gain (informational — disableTP2=true means sweep.js's own simulation
// never checks TP2 for this mode, gated on cfg.disableTP2 independently of this field; kept
// for display/gen-trading-plan.js consistency and to avoid a TP2<TP1 inversion at low ATR%).
const PARTIAL_TP_GAIN_PCT = 10; // modes-config.json modes.etf.partialTPGain / modes.etf_eu.partialTPGain
// Blacklist is now loaded from scanner_filters.params.blacklist (see loadScannerParams
// / DEFAULT_PARAMS_{US,EU}) and exposed as ACTIVE_BLACKLIST once the universe is resolved.

// ─── Established-liquidity gate (parity strategy_trend.go applyEstablishedLiquidityGate) ──
// Uniform point-in-time gate in Go: a candidate is only tradeable if its MEDIAN dollar
// volume over the trailing ESTABLISHED_LOOKBACK bars exceeds MIN_ESTABLISHED_DOLLAR_VOLUME.
// Go applies it AFTER diversifyByCategory (on the ≤MaxCandidates set), and does NOT backfill.
//
// ⚠️ OFF BY DEFAULT — this gate is NOT part of the ISO reference. The etf_us source of truth
// is config/pre-live/portfolio_etf_us.yaml (single-sleeve; the JS ETF-only universe can only
// be ISO with a single-sleeve Go config — the multi-survivors etf sleeve shares a global
// mkData and also ranks stocks). portfolio_etf_us.yaml sets NO min_established_dollar_volume,
// so applyEstablishedLiquidityGate is a no-op there. Applying it in JS therefore over-prunes
// vs the Go reference (drops liquid-but-sub-$5M-median ETFs Go keeps). The gate is kept as an
// opt-in (--established-gate) for anyone wanting the OLD multi-survivors parity (which HAD it,
// value 5_000_000 / lookback 60), but the DEFAULT is ISO with portfolio_etf_us.yaml (no gate).
const MIN_ESTABLISHED_DOLLAR_VOLUME = 5_000_000;
const ESTABLISHED_LOOKBACK_DAYS = 60;

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '0'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
// Established-liquidity gate is OFF by default (ISO with portfolio_etf_us.yaml which has none).
// Opt in with --established-gate for legacy multi-survivors parity. US-only regardless.
const ESTABLISHED_GATE = hasFlag('established-gate');
// ─── VOIE MCP (--ingest) — SEULE source de données (parité EXACTE avec factor-scanner.js --ingest) ──
// --ingest <path> (convention: /tmp/etf-stage.json) est désormais OBLIGATOIRE : le scanner NE FETCH
// RIEN (ni Yahoo, ni cache) et NE LIT AUCUN univers local. Il PARSE un staging JSON écrit par l'AGENT
// (qui, LUI, a appelé mcp__marketdata__* — OAuth2, zéro token dans un subprocess node). Sans --ingest,
// il n'existe PLUS aucune source de données → MCP HARD STOP (marqueur incomplete + exit 3, rien fabriqué).
const INGEST_PATH = getArg('ingest', null);

// Regime: CLI > signals.json > default
function resolveRegime() {
  const cliRegime = getArg('regime', null);
  if (cliRegime) return cliRegime;
  if (SCAN_FOLDER) {
    try {
      const sigPath = path.join(ROOT, 'scanner', SCAN_FOLDER, 'signals.json');
      const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
      if (signals.regime) return signals.regime;
    } catch {}
  }
  return 'recovery';
}
const REGIME = resolveRegime();

// ─── ETF Universe ────────────────────────────────────────────────────────────
// MCP-PRIMARY : le node ne lit PLUS data/etf-{us,eu}-universe.json. La LISTE de tickers (le
// "pool") est fournie par l'AGENT dans le staging --ingest (candidates[]). universe.go GetAssets
// (§2 core + §4 dynamic) reste la source de vérité côté agent (via RunScreener/QueryData MCP).
//
// ETF categories for diversification (max 2 per category) — carte STATIQUE de secours utilisée
// UNIQUEMENT quand le staging n'a pas fourni `category` pour un ticker (evaluateEtfCandidate lit
// `c.category` en priorité). Alignée VERBATIM sur systematic-tss `etfCategory` (staticdata frozen
// cache) pour que la diversification gate à l'identique du scanner Go (ex. XLV+XBI+IBB+ARKG = tous
// "Health"). Ce n'est PAS un univers/une source de données — juste une classification.
const ETF_CATEGORIES_FALLBACK = {
  SPY: 'Large Blend', QQQ: 'Large Growth', IWM: 'Small Blend', DIA: 'Large Value',
  XLK: 'Technology', XLE: 'Equity Energy', XLF: 'Financial', XLV: 'Health',
  XLI: 'Industrials', XLB: 'Natural Resources', XLC: 'Communications', XLY: 'Consumer Cyclical',
  XLP: 'Consumer Defensive', XLU: 'Utilities', XLRE: 'Real Estate',
  VTI: 'Large Blend', VOO: 'Large Blend', VEA: 'Foreign Large Blend', VWO: 'Diversified Emerging Mkts',
  EEM: 'Diversified Emerging Mkts', EFA: 'Foreign Large Blend',
  GDX: 'Equity Precious Metals', GDXJ: 'Equity Precious Metals',
  SLV: 'Commodities Focused', GLD: 'Commodities Focused', USO: 'Commodities Focused',
  TLT: 'Long Government', HYG: 'High Yield Bond', LQD: 'Corporate Bond',
  ARKK: 'Mid-Cap Growth', ARKG: 'Health', GBTC: 'Digital Assets', BITO: 'Digital Assets',
  FXI: 'China Region', EWJ: 'Japan Stock', INDA: 'India Equity', VPL: 'Diversified Pacific/Asia', KWEB: 'China Region',
  EWZ: 'Latin America Stock', EWN: 'Miscellaneous Region', VGK: 'Europe Stock', IEMG: 'Diversified Emerging Mkts',
  XBI: 'Health', IBB: 'Health', SMH: 'Technology', SOXX: 'Technology', TAN: 'Miscellaneous Sector',
};

// ─── Active universe resolution (US default | EU | custom file) ─────────────
// --universe etf-us (default) | etf-eu | <path-to-json>
// EU signals are tagged universe='etf_eu' / region='EU' so gen-status-page routes
// them to the dedicated "ETF Europe" mode (universeFilter='etf_eu'), keeping the
// US ETF pool (universe='etf') fully separate. Same momentum strategy on both.
const UNIVERSE_ARG = getArg('universe', 'etf-us');
const UNIVERSE_TAG_ARG = getArg('universe-tag', null);
const REGION_ARG = getArg('region', null);

// MCP-PRIMARY : resolveUniverse ne lit AUCUN fichier d'univers local. Il ne retourne QUE les
// métadonnées de routing (tag/region/label + carte de catégories de secours pour la diversification).
// La liste de tickers (le pool) vient exclusivement du staging --ingest (candidates[]).
function resolveUniverse(arg) {
  const a = (arg || 'etf-us').toLowerCase();
  if (a === 'etf-eu' || a === 'eu' || a === 'eu_etf' || a === 'europe') {
    return { categories: {}, tag: 'etf_eu', region: 'EU', label: 'EU' };
  }
  if (a === 'etf-us' || a === 'us' || a === 'etf' || a === 'us_etf') {
    return { categories: ETF_CATEGORIES_FALLBACK, tag: 'etf', region: 'US', label: 'US' };
  }
  // Univers "custom" : uniquement un TAG/REGION de routing (aucun fichier lu). Le pool reste le staging.
  return { categories: {}, tag: UNIVERSE_TAG_ARG || 'etf', region: REGION_ARG || 'US', label: 'CUSTOM' };
}

const ACTIVE = resolveUniverse(UNIVERSE_ARG);
// CLI overrides (allow re-tagging a custom run)
if (UNIVERSE_TAG_ARG) ACTIVE.tag = UNIVERSE_TAG_ARG;
if (REGION_ARG) ACTIVE.region = REGION_ARG;
// Parité Go par univers (portfolio_etf_us.yaml / portfolio_etf_eu.yaml):
// EU = min_score 80 (testé 50-100, 80 optimal) + stop 1.5xATR ; US = stop 2.5xATR.
const IS_EU = ACTIVE.tag === 'etf_eu';
const STOP_ATR_MULT = IS_EU ? 1.5 : 2.5;

// Load scanner_filters (+ .params) from the per-universe Go config (or embedded
// defaults). ALL scoring thresholds now come from here — no more hardcoded values.
const { params: PARAMS, source: PARAMS_SOURCE } = loadScannerParams(IS_EU);
// scanner_filters-level scalars (per-config: US min_price 10 / max_atr 0.06 / no min_score;
// EU min_price 5 / max_atr 0.06 / min_score 80).
const MAX_ATR_RATIO = paramF(PARAMS, 'max_atr_ratio', 0.06);
const EFFECTIVE_MIN_PRICE = paramF(PARAMS, 'min_price', IS_EU ? 5 : 10);
const CONFIG_MIN_SCORE = paramF(PARAMS, 'min_score', 0);
const EFFECTIVE_MIN_SCORE = MIN_SCORE > 0 ? MIN_SCORE : CONFIG_MIN_SCORE;
// Blacklist from scanner_filters.params.blacklist (per-config; the JS ETF-only
// universes never overlap so each config uses only its own list).
const ACTIVE_BLACKLIST = new Set(Array.isArray(PARAMS.blacklist) ? PARAMS.blacklist : []);

// ─── ETF Momentum Scoring — DÉPLACÉ CÔTÉ AGENT (MCP-primary) ───────────────────────────────────
// Le scoring cluster régime-adaptatif (mom20/rsi/atr + cluster + score + entry + stop=ATR×STOP_ATR_MULT)
// n'est PLUS calculé par le node. En MCP-primary, l'AGENT le calcule sur les barres MCP AVANT de produire
// le staging --ingest, en reproduisant le port exact de scanner_etf_momentum.go (SOURCE DE VÉRITÉ pour
// les seuils par régime et les formules de score). Le node ne fait plus qu'ingérer + appliquer les gates
// hérités (voir evaluateEtfCandidate ci-dessous) + diversifier (diversifyRowsByCategory) + top-N.
// La diversification catégorielle max-2/catégorie vit désormais UNIQUEMENT dans diversifyRowsByCategory.

// ─── VOIE MCP : --ingest (parité factor-scanner.js --ingest) ─────────────────────────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* :
//   RunScreener/QueryData(types=bars_daily[,technicals]) sur l'univers ETF (US ou EU) → il calcule
//   par ETF le cluster régime-adaptatif + score + entry + stop (ATR×STOP_ATR_MULT) + indicateurs
//   (mom20/rsi/atrPct) selon le port exact de scanner_etf_momentum.go (source de vérité), et écrit
//   /tmp/etf-stage.json. L'univers ETF lui-même est résolu par l'agent via MCP (RunScreener), plus
//   par un fichier local — le node ne connaît plus la liste de tickers.
// CE script PARSE le staging (jamais de fetch réseau, jamais d'appel MCP, jamais de fichier univers),
// applique les gates HÉRITÉS (blacklist, min_price/penny, min_score, stop valide, rr, sharia),
// diversifie (max 2 / catégorie) et tronque à top-N — c'est désormais l'UNIQUE assemblage de pool.
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP) : staging absent / vide / malformé / mcp_ok:false / error →
// marqueur _scanRuns[etf|etf:etf_eu] {incomplete:true, signals:0} + exit 3, RIEN fabriqué (comme factor).
//
// Gates hérités appliqués (les MÊMES seuils que le scoring agent-side, port scanner_etf_momentum.go) :
//   • blacklist (scanner_filters.params.blacklist) → rejeté
//   • penny : entry < min_price (US 10 / EU 5) → rejeté
//   • min_score : score < EFFECTIVE_MIN_SCORE (US 0 / EU 80) → rejeté
//   • stop : stop hérité du staging DOIT être un stop protecteur valide (0 < stop < entry, risk>0) →
//     sinon rejeté. tp1/tp2/rr sont RE-DÉRIVÉS du modèle d'exit du mode (PARTIAL_TP_GAIN_PCT), jamais
//     lus du staging (l'agent ne peut pas injecter un R/R arbitraire).
//   • rr : sanity — rr = (tp1-entry)/risk ; rr ≤ 0 (structure dégénérée) → rejeté (miroir de la garde-fou
//     rr de factor ; le modèle partial-TP 10% de l'ETF donne un rr>0 dès que le stop est sous l'entrée).
//   • sharia : tag hérité, passé tel quel (null pour ETF).
//
// Shape attendu ({ mcp_ok:true, asof?, regime?, universeFetched?, candidates:[...] }) — chaque candidat :
//   { ticker, name?, score, entry, stop, cluster?, mom20?, rsi?, atrPct?, category?, sharia?,
//     estDolVol?, estBars? }  (estDolVol/estBars requis SEULEMENT si --established-gate).
function resolveSigPathEtf() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}
// _scanRuns key: 'etf' (US default) | 'etf:etf_eu' (EU) — IDENTIQUE à la voie locale.
function etfScanRunKey() { return ACTIVE.tag === 'etf' ? 'etf' : `etf:${ACTIVE.tag}`; }

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de signal. No-op en dry-run / hors signals.
function writeEtfIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPathEtf();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude etf.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns[etfScanRunKey()] = Object.assign({
    at: new Date().toISOString(), universe: ACTIVE.tag, dataPath: 'mcp-ingest',
    candidates: 0, signals: 0, added: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['${etfScanRunKey()}'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que factor-scanner.loadFactorStaging).
function loadEtfStaging() {
  if (!INGEST_PATH) return { ok: false, reason: 'no_ingest_arg' };
  if (!fs.existsSync(INGEST_PATH)) return { ok: false, reason: 'ingest_file_missing' };
  let raw;
  try { raw = fs.readFileSync(INGEST_PATH, 'utf8'); }
  catch (e) { return { ok: false, reason: `ingest_read_error:${e.message}` }; }
  if (!raw || !raw.trim()) return { ok: false, reason: 'ingest_empty' };
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: `ingest_malformed_json:${e.message}` }; }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'ingest_not_object' };
  if (data.mcp_ok === false) return { ok: false, reason: 'mcp_ok_false' };
  if (data.error) return { ok: false, reason: `staging_error:${String(data.error).slice(0, 120)}` };
  if (!Array.isArray(data.candidates)) return { ok: false, reason: 'ingest_no_candidates_array' };
  return { ok: true, data };
}

// Un candidat stagé → row {ticker, name, score, entry, stop, tp1, tp2, rr, sharia, ...} | null (+ raison drop).
// N'INVENTE aucune donnée : tout champ requis manquant/non-fini fait tomber le candidat (fail-closed).
function evaluateEtfCandidate(c) {
  const drop = reason => ({ row: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  // Gate blacklist (scanner_filters.params.blacklist).
  if (ACTIVE_BLACKLIST.has(ticker)) return drop('blacklist');
  const entry = num(c.entry);
  const stop = num(c.stop);
  const score = num(c.score);
  if (!(entry > 0)) return drop('bad_entry');
  if (!Number.isFinite(score)) return drop('missing_score');
  // Gate penny (min_price per universe : US 10 / EU 5).
  if (!(entry >= EFFECTIVE_MIN_PRICE)) return drop('penny_under_min_price');
  // Gate min_score (scanner_filters.min_score : US 0 / EU 80).
  if (score < EFFECTIVE_MIN_SCORE) return drop('below_min_score');
  // Gate stop : stop protecteur valide sous l'entrée (risk>0). Le stop est hérité du staging (ATR×mult
  // côté agent) ; on ne le recalcule pas mais on le VALIDE.
  if (!(stop > 0) || !(stop < entry)) return drop('bad_stop');
  const risk = entry - stop;
  if (!(risk > 0)) return drop('nonpositive_risk');
  // Modèle d'exit du mode (RE-DÉRIVÉ, jamais lu du staging) — parité main() local.
  const tp1 = +(entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
  const tp2 = +(entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
  const rr = +((tp1 - entry) / risk).toFixed(2);
  // Gate rr (sanity — structure dégénérée uniquement ; miroir de la garde-fou rr de factor).
  if (!(rr > 0)) return drop('nonpositive_rr');
  return {
    row: {
      ticker, name: c.name || ticker, score: +score,
      entry: +entry.toFixed(2), stop: +stop.toFixed(2), tp1, tp2, rr: `1:${rr.toFixed(2)}`,
      sharia: c.sharia != null ? c.sharia : null,
      cluster: c.cluster || 'MCP', mom20: num(c.mom20), rsi: num(c.rsi), atrPct: num(c.atrPct),
      category: c.category || ACTIVE.categories[ticker] || 'OTHER',
      estDolVol: num(c.estDolVol), estBars: num(c.estBars),
    },
    reason: null,
  };
}

// Diversification catégorielle (max 2/catégorie) sur les rows stagées — même logique que
// diversifyByCategory local, mais lit r.category (staging-aware, fallback ACTIVE.categories).
function diversifyRowsByCategory(rows, limit) {
  const maxPerCategory = 2;
  const count = {};
  const out = [];
  for (const r of rows) {
    if (out.length >= limit) break;
    const cat = r.category || 'OTHER';
    if ((count[cat] || 0) >= maxPerCategory) continue;
    out.push(r);
    count[cat] = (count[cat] || 0) + 1;
  }
  return out;
}

// Branche --ingest : parse le staging, applique les gates hérités, diversifie + top-N, écrit
// signals.signals (tag universe=ACTIVE.tag) + _scanRuns[key] (fusion non destructive).
function ingestMain() {
  const staged = loadEtfStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging ETF indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeEtfIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = getArg('regime', null) || data.regime || REGIME;
  const candidates = data.candidates;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : candidates.length;

  console.log(`📊 ETF Momentum Scanner — VOIE MCP (--ingest) — ${ACTIVE.label} universe`);
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | universe: ${universeFetched} | tag: ${ACTIVE.tag}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime} | minPrice: ${EFFECTIVE_MIN_PRICE} | minScore: ${EFFECTIVE_MIN_SCORE} | maxATR: ${MAX_ATR_RATIO} | stop×ATR: ${STOP_ATR_MULT}`);
  console.log(`   Gate thresholds source: ${PARAMS_SOURCE === 'embedded-defaults' ? 'embedded defaults' : path.relative(ROOT, PARAMS_SOURCE)} (l'ATR gate maxATR est appliqué côté agent au scoring; ré-affiché ici pour provenance)`);

  const rows = [];
  const dropStats = {};
  for (const c of candidates) {
    const { row, reason } = evaluateEtfCandidate(c);
    if (row) rows.push(row);
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }
  // Ordre déterministe : score desc, ticker asc (comme le tri local / Go sort.Slice).
  rows.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));

  // Diversification (max 2/catégorie) puis top-N — parité voie locale.
  let top = diversifyRowsByCategory(rows, TOP_N);

  // Established-liquidity gate (US only, opt-in) — parité voie locale : appliqué APRÈS diversification,
  // droppe (jamais backfill) les noms sans médiane $-vol suffisante. Requiert estDolVol/estBars stagés ;
  // absents (NaN) → droppés (conservateur), car on ne peut pas VÉRIFIER le seuil sans les fabriquer.
  if (!IS_EU && ESTABLISHED_GATE) {
    const before = top.length;
    top = top.filter(r => Number.isFinite(r.estBars) && r.estBars >= ESTABLISHED_LOOKBACK_DAYS
      && Number.isFinite(r.estDolVol) && r.estDolVol >= MIN_ESTABLISHED_DOLLAR_VOLUME);
    const dropped = before - top.length;
    if (dropped > 0) console.log(`   Established-liquidity gate: dropped ${dropped} (median $-vol < $${(MIN_ESTABLISHED_DOLLAR_VOLUME / 1e6)}M over ${ESTABLISHED_LOOKBACK_DAYS}d)`);
  }

  console.log(`\n✅ ${rows.length} candidats retenus (gates), top ${top.length} (diversifié) :`);
  for (const r of top) {
    console.log(`  📊 ${r.ticker.padEnd(6)} score:${String(r.score).padStart(7)} [${r.cluster}] Mom20:${Number.isFinite(r.mom20) ? (r.mom20 * 100).toFixed(1) : 'n/a'}% RSI:${Number.isFinite(r.rsi) ? r.rsi.toFixed(0) : 'n/a'} ATR%:${Number.isFinite(r.atrPct) ? (r.atrPct * 100).toFixed(1) : 'n/a'}% (${r.category})`);
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return top; }

  if (OUTPUT_MODE === 'json') {
    const suffix = ACTIVE.tag === 'etf' ? '' : `-${ACTIVE.tag}`;
    const outPath = path.join(ROOT, 'data', `etf-scan-${SCAN_DATE}${suffix}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      scanDate: SCAN_DATE, regime, dataPath: 'mcp-ingest', candidates: top,
    }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
    return top;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPathEtf();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // Fusion NON DESTRUCTIVE, dedup par ticker : on préserve le reste du fichier (autres scanners +
    // _scanRuns) et on n'écrase pas un signal du même ticker déjà présent — modèle voie locale.
    if (!Array.isArray(signals.signals)) signals.signals = [];
    const existing = new Set(signals.signals.map(s => s.ticker));
    let added = 0;
    for (const r of top) {
      if (existing.has(r.ticker)) continue;
      signals.signals.push({
        ticker: r.ticker, name: r.name, score: r.score, strategy: 'ETFMomentum',
        entry: r.entry, stop: r.stop, tp1: r.tp1, tp2: r.tp2, rr: r.rr,
        horizon: 21, region: ACTIVE.region, universe: ACTIVE.tag,
        sharia: r.sharia,
        thesis: `ETF ${r.cluster}: Mom20=${Number.isFinite(r.mom20) ? (r.mom20 * 100).toFixed(1) : 'n/a'}%, RSI=${Number.isFinite(r.rsi) ? r.rsi.toFixed(0) : 'n/a'}, ATR%=${Number.isFinite(r.atrPct) ? (r.atrPct * 100).toFixed(1) : 'n/a'}%`,
        extension: { cluster: r.cluster, atrPct: Number.isFinite(r.atrPct) ? +r.atrPct.toFixed(4) : null },
        dataPath: 'mcp-ingest',
      });
      existing.add(r.ticker);
      added++;
    }
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns[etfScanRunKey()] = {
      at: new Date().toISOString(), universe: ACTIVE.tag, dataPath: 'mcp-ingest',
      candidates: rows.length, signals: top.length, added, regime, incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} ETF signals (voie MCP) to ${sigPath}`);
  }
  return top;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  // MCP-PRIMARY : le staging MCP (--ingest, produit par l'agent) est l'UNIQUE source de données.
  if (INGEST_PATH) { ingestMain(); return; }

  // Sans --ingest, il n'existe PLUS aucune source de données (la branche Yahoo/allorigins + la lecture
  // des univers locaux data/etf-{us,eu}-universe.json ont été RETIRÉES au profit du MCP « qui fait foi »).
  // → MCP HARD STOP : on écrit un marqueur d'incomplétude (si signals mode) et on sort en 3, RIEN fabriqué.
  console.error('⛔ etf-scanner est MCP-PRIMARY : --ingest <staging.json> (staging agent→MCP) est OBLIGATOIRE.');
  console.error('   Le fetch Yahoo + la lecture d\'univers local ont été supprimés.');
  console.error('   Produire le staging via l\'agent (RunScreener/QueryData mcp__marketdata__*) puis relancer avec --ingest.');
  writeEtfIncompleteMarker('no_ingest_arg (MCP-primary: local fetch/universe removed)', { ingestPath: null });
  process.exit(3);
}

main();
