#!/usr/bin/env node
'use strict';

/**
 * highvol-scanner.js — HighVol Breakout Scanner (exact port of systematic-tss)
 *
 * Cluster-based high-volatility breakout scanner.
 * Key filters: ATR 7-10% sweet spot, DistMA20 ≥ 5%, VolRatio ≥ 1.5,
 * VIX regime gating (cluster V11-V13), Bollinger Band %B.
 *
 * ─── MCP-PRIMARY (décret archi 2026-07-12 « le MCP fait foi ») ─────────────────────────────────
 * L'univers de highvol (americanbull = actions US) est COUVERT par le MCP marketdata. La voie
 * --ingest (staging produit par l'AGENT via mcp__marketdata__* — OAuth2, zéro token) est désormais
 * le SEUL chemin data de la SCAN. Le fetch Yahoo (query1.finance.yahoo.com), son cache prix daté
 * (lib/price-cache) et la lecture de l'univers local (data/americanbull-universe.json) ont été
 * RETIRÉS de la voie de scan : ce node NE FETCH PLUS RIEN (ni réseau, ni cache) pour scanner.
 *
 * highvol est dtx-backed : l'equity/les ordres du mode viennent DÉJÀ du MCP dtx (us_highvol, source
 * autoritative). Ce scanner JS ne produit qu'un MARQUEUR D'AFFICHAGE (le pool `signals[]` +
 * `_scanRuns.highvol`) rendu sur scanner/status. On bascule la SOURCE de ce marqueur du local/Yahoo
 * vers le MCP marketdata (cohérence du décret), SANS toucher au chemin dtx.
 *
 * Le pool MCP est produit par l'AGENT (modèle factor-scanner.js / momentum-scanner.js / top-10) :
 *   RunScreener(region=us, asset=stock) → univers US énuméré (post-filtre market_cap≥$1B EN CODE
 *     côté agent — JAMAIS market_cap dans pass_expr, il s'évalue à 0 → 0 candidat silencieux)
 *   QueryData(types=bars_daily) 2y + ^VIX → l'agent applique EXACTEMENT les filtres/scoring highvol
 *     (ATR sweet-spot, DistMA20, VolRatio, RSI, BB %B, VIX cluster) puis écrit /tmp/highvol-stage.json.
 * CE script PARSE le staging (jamais d'appel MCP — OAuth2, zéro token), applique le VIX cluster gate
 * (logique de signal INTACTE, seule la source des données VIX change), les gates hérités (blacklist,
 * secteur/mcap métadonnée, stop/rr), et construit le pool du mode + _scanRuns.highvol.
 *
 * ⚠️ La logique de scoring (scoreSymbol) + les gates + les constantes restent EXPORTÉS et INTACTS :
 * tools/pit-backfill.js les require pour la parité PIT (rejoue le scoring EXACT sur bars ≤ D depuis
 * data/.price-cache). loadUniverse() est également conservé comme export UNIQUEMENT pour pit-backfill
 * (consommateur restant de data/americanbull-universe.json → la purge du fichier est différée à une
 * phase ultérieure, « après vérif 0 consommateur »). La voie de scan MCP-primary n'appelle NI
 * loadUniverse NI aucun fetch.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/highvol-stage.json via mcp__marketdata__*
 *   node tools/highvol-scanner.js --ingest /tmp/highvol-stage.json --output signals --folder 20260711 --regime RISK-ON
 *   node tools/highvol-scanner.js --ingest /tmp/highvol-stage.json --dry-run
 *   node tools/highvol-scanner.js --ingest /tmp/highvol-stage.json --output json --date 2026-07-11
 *
 * Codes de sortie : 0 = OK (0 signal légitime — VIX toxic/RISK_OFF — inclus) ; 3 = staging absent/
 * vide/malformé/mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP
 * obligatoire) ; 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile, calcStochastic,
} = require('./lib/fractal-indicators');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const MIN_SCORE = parseFloat(getArg('min-score', '50'));
const TOP_N = parseInt(getArg('top', '20'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
// ─── VOIE MCP (--ingest) — SEUL chemin data de la scan (MCP-PRIMARY) ────────────────────────────
// Quand --ingest est fourni, le scanner NE FETCH RIEN : il PARSE un staging JSON écrit par l'AGENT
// (qui, LUI, a appelé mcp__marketdata__* — OAuth2, zéro token). --ingest est OBLIGATOIRE (le fetch
// Yahoo local + la lecture data/americanbull-universe.json ont été supprimés de la voie de scan).
const INGEST_PATH = getArg('ingest', null);

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.highvol) ───
// partialTPGain=30 → the mode's REAL partial-TP trigger is +30% price gain (not a fixed
// R multiple). tp1 emitted here must match that trigger, else rr is disconnected from the
// actual exit model (audit finding: all specialist rows showed a uniform hardcoded "R/R 2.0").
// disableTP2=false → highvol keeps a live second target; tp2 = 2x the TP1 gain (convention
// also used by trendline; keeps tp2 > tp1 monotonically, unlike a flat entry+risk*3 which can
// invert below a small-ATR tp1 gain). rr is computed per-ticker from the REAL stop distance.
const PARTIAL_TP_GAIN_PCT = 30; // modes-config.json modes.highvol.partialTPGain

// ─── Parity constants (mirror config/portfolio_us_highvol.yaml scanner_filters) ──
// systematic-tss us_highvol allocation: strategy=highvol-breakout-corr.
// These MUST match the Go ScannerFilterConfig so JS produces the same BUY entries.
// EXPORTÉS + INTACTS : pit-backfill.js les require pour la parité PIT (scoreSymbol + gates).
const MIN_P80_DOLLAR_VOLUME = 5_000_000;   // scanner_filters.min_p80_dollar_volume ($5M, not $100K)
// Point-in-time established-liquidity gate (survivorship / look-ahead guard) — MEDIAN dollar
// volume over the trailing window (robust to the signal-day spike, unlike the P80 above) must
// exceed the threshold. Mirrors systematic-tss applyEstablishedLiquidityGate. Default = the
// CURRENT Go value for this strategy: portfolio_us_highvol.yaml min_established_dollar_volume
// = 3_000_000 (synced 2026-07-03 — the Go configs evolved; other strategies differ: portfolio_us
// $5M, de_highvol $2M). Each re-ported mode should pass its own --min-established-dollar-volume.
const MIN_ESTABLISHED_DOLLAR_VOLUME = parseFloat(getArg('min-established-dollar-volume', '3000000'));
const ESTABLISHED_LOOKBACK = parseInt(getArg('established-lookback', '60'));
const MAX_RSI = 85;                        // scanner_filters.max_rsi (Go rejects rsi > 85)
const MAX_VOLATILITY_INDEX = 28;           // scanner_filters.max_volatility_index (VIX > 28 => no scan)
// Allocation-level blacklist (toxic serial losers). In Go these symbols are excluded
// from the universe (cmd/backtest/main.go). Applied here as a pre-scan skip.
const BLACKLIST = new Set([
  'SKYT', 'ALAB', 'RERE', 'QBTS', 'ATAI', 'DQ', 'NTLA', 'LCID', 'TE',
  'IBRX', 'KOD', 'AUR', 'RXRX', 'TERN', 'NVAX', 'ASTS', 'DAWN', 'GLDD',
]);
// scanner_filters.excluded_sectors + allocation min_market_cap=$1B, appliqués en Go au niveau
// universe/secmaster. Le metadata secteur/mcap est dispo via data/ticker-metadata.json
// (port stockanalysis, tools/lib/stockanalysis-fetcher.js) + data/tickers-frozen.json (snapshot
// Go-authoritative). Ce sont des MÉTADONNÉES (secteur/mcap), PAS de la donnée prix : elles restent
// lues localement pour la parité du gate secteur/mcap (identique côté Go) — la voie MCP-primary ne
// retire QUE la donnée prix (Yahoo) et l'univers local (americanbull-universe.json).
const EXCLUDED_SECTORS = new Set(['Real Estate', 'Utilities', 'Materials', 'Communication Services']);
const MIN_MARKET_CAP = 1_000_000_000; // allocation min_market_cap = $1B
let TICKER_META = {};
try { TICKER_META = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ticker-metadata.json'), 'utf8')); } catch (_) { /* metadata absent → filtre secteur/mcap OFF (fail-open) */ }
// ISO-parity source de vérité pour secteur/mcap = LE MÊME snapshot gelé que Go lit pour bâtir
// l'univers US : systematic-tss cache/stockanalysis/stock/US/tickers-frozen.json (copie versionnée
// ici dans data/tickers-frozen.json — valeurs identiques). Go itère cet univers et rejette
// stock.MarketCap < min_market_cap ($1B) + excluded_sectors. Le ticker-metadata.json (fetch
// stockanalysis live) a dérivé : mcaps gonflés pour des noms limites (INDI 1.02B vs 580M réel,
// SLS 2.75B vs 889M, VPG 1.99B vs 567M) → le port JS fabriquait INDI/SLS/VPG que Go exclut sous
// le plancher $1B. On lit le frozen en PRIORITÉ (= exactement ce que Go filtre) et on retombe sur
// ticker-metadata seulement si le ticker est absent du frozen (fail-open préservé).
let FROZEN_META = {};
try {
  const fz = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tickers-frozen.json'), 'utf8'));
  FROZEN_META = (fz && fz.data && fz.data.data) ? fz.data.data : (fz.Data && fz.Data.Data ? fz.Data.Data : {});
} catch (_) { /* frozen absent → fallback ticker-metadata seul (comportement antérieur) */ }
// Rejette un ticker si son secteur est exclu OU mcap < $1B. Frozen (Go-authoritative) d'abord,
// puis ticker-metadata en fallback, puis fail-open si les deux sont muets (inconnu = gardé).
function passesSectorMcap(ticker) {
  const m = FROZEN_META[ticker] || TICKER_META[ticker];
  if (!m) return true; // metadata inconnue → ne pas rejeter (fail-open, comportement offline antérieur)
  if (m.sector && EXCLUDED_SECTORS.has(m.sector)) return false;
  if (m.marketCap && m.marketCap > 0 && m.marketCap < MIN_MARKET_CAP) return false;
  return true;
}

// ─── Universe loader (export PIT-parity uniquement — PAS utilisé par la voie de scan MCP) ───────
// Conservé UNIQUEMENT comme export pour tools/pit-backfill.js (qui rejoue le scoring EXACT sur
// data/.price-cache et énumère l'univers via hv.loadUniverse()). La voie de scan MCP-primary
// (main → ingest) N'APPELLE JAMAIS cette fonction : elle ne lit aucun univers local. Tant que
// pit-backfill reste un consommateur, data/americanbull-universe.json ne peut pas être purgé
// (purge différée « après vérif 0 consommateur »).
function loadUniverse() {
  const fp = path.join(ROOT, 'data', 'americanbull-universe.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return data.tickers || [];
}

// ─── StdDev for Bollinger Bands (export — utilisé par scoreSymbol / pit-backfill) ──────────────

function calcStdDev(bars, period) {
  const n = bars.length;
  if (n < period) return 0;
  let sum = 0;
  for (let i = n - period; i < n; i++) sum += bars[i].close;
  const mean = sum / period;
  let sumSq = 0;
  for (let i = n - period; i < n; i++) sumSq += (bars[i].close - mean) ** 2;
  return Math.sqrt(sumSq / period);
}

// ─── HighVol Breakout Scoring (exact port of scanner_highvol.go) ────────────
// EXPORTÉ + INTACT : tools/pit-backfill.js le require pour rejouer le scoring EXACT (parité PIT).
// La voie de scan MCP-primary n'appelle pas scoreSymbol : l'AGENT applique ces MÊMES filtres/scoring
// côté MCP (documenté dans l'en-tête) et écrit les métriques dans le staging.

function scoreSymbol(bars, regime, vixLevel, vixTrend) {
  const n = bars.length;
  if (n < 200) return null;
  const price = bars[n - 1].close;
  if (price < 1.0) return null;

  const atr = calcATR(bars, 14);
  const atrPct = atr / price;
  const ma200 = calcSMA(bars, 200);
  const ma20 = calcSMA(bars, 20);
  const ma50 = calcSMA(bars, 50);
  const rsi = calcRSI(bars, 14);
  const volatility = calcVolatility(bars, 20);
  const mom120 = calcMomentum(bars, 120);
  const avgVol20 = calcAvgVolume(bars, 20);

  let volRatio = 1.0;
  if (avgVol20 > 0) volRatio = (bars[n - 1].volume || 0) / avgVol20;

  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA200 = ma200 > 0 ? (price - ma200) / ma200 : 0;

  // BBPctB
  let bbPctB = 0.5;
  if (n >= 20) {
    const stdDev = calcStdDev(bars, 20);
    const upper = ma20 + 2.0 * stdDev;
    const lower = ma20 - 2.0 * stdDev;
    if (upper > lower) bbPctB = (price - lower) / (upper - lower);
  }

  // FILTER 1: Base filters
  if (price <= ma200) return null;
  if (rsi >= 90) return null;

  // Blowoff top filter
  if (rsi > 85 && distMA20 > 0.20) return null;

  // Volume minimum
  if ((bars[n - 1].volume || 0) < 1000) return null;

  // FILTER 2: ATR sweet spot (7-10%)
  if (atrPct < 0.07) return null;
  let maxATRPct = 0.10;
  if (vixLevel >= 22) maxATRPct = 0.15;
  if (atrPct > maxATRPct) return null;

  // RECOVERY + ATR >= 10% = TOXIC
  if (regime && regime.toUpperCase().includes('RECOVERY') && atrPct >= 0.10) return null;

  // FILTER 3: Breakout confirmed (DistMA20 ≥ 5%)
  if (distMA20 < 0.05) return null;
  if (distMA20 > 1.0) return null;

  // FILTER 4: Volume confirmation (VolRatio ≥ 1.5)
  let minVolRatio = 1.5;
  if (regime && regime.toUpperCase().includes('RECOVERY') && vixLevel >= 22) minVolRatio = 1.0;
  if (volRatio < minVolRatio) return null;

  // Max RSI filter (scanner_filters.max_rsi = 85) — Go rejects rsi > 85
  if (rsi > MAX_RSI) return null;

  // SCORING V9
  let score = 50.0;

  // VIX context bonus
  if (vixLevel >= 30) {
    score += vixTrend === 'rising' ? 40 : 25;
  } else if (vixLevel >= 22) {
    score += 20;
  }

  // ATR scoring
  if (atrPct < 0.05) score += 15;
  else if (atrPct < 0.07) score += 10;
  else if (atrPct < 0.08) score += 5;

  // Breakout strength (VIX-context aware)
  if (vixLevel >= 30) {
    if (distMA20 >= 0.05 && distMA20 < 0.10) score += 25;
    else if (distMA20 >= 0.10 && distMA20 < 0.15) score += 20;
    else if (distMA20 >= 0.15) score += 5;
  } else {
    if (distMA20 >= 0.15) score += 20;
    else if (distMA20 >= 0.10) score += 15;
    else if (distMA20 >= 0.05) score += 10;
  }

  // BBPctB
  if (bbPctB >= 1.1) score += 10;

  // Strong uptrend (DistMA200)
  if (distMA200 >= 0.50) score += 15;
  else if (distMA200 >= 0.30) score += 10;
  else if (distMA200 >= 0.20) score += 5;

  // Trend structure
  if (price > ma20 && ma20 > ma50 && ma50 > ma200) score += 10;

  // Volume confirmation
  if (volRatio >= 3.0) score += 15;
  else if (volRatio >= 2.0) score += 10;
  else if (volRatio >= 1.5) score += 5;

  // Momentum bonus
  if (mom120 > 0.30) score += 10;
  else if (mom120 > 0.15) score += 5;

  if (score < MIN_SCORE) return null;

  // Regime adjustment
  if (regime) {
    const r = regime.toUpperCase().replace(/[- ]/g, '_');
    if (r.includes('RISK_ON')) score *= 1.10;
    else if (r.includes('RECOVERY')) score *= 0.95;
    else if (r.includes('EARLY_RISK_OFF')) score *= 0.90;
  }

  const distMA50 = ma50 > 0 ? (price - ma50) / ma50 : 0;

  return {
    score: +score.toFixed(2), price, entry: price,
    stop: +(price - atr * 2.5).toFixed(4),
    atr, atrPct, rsi, volatility, mom120, volRatio: +volRatio.toFixed(2),
    distMA20: +distMA20.toFixed(4), distMA50: +distMA50.toFixed(4), distMA200: +distMA200.toFixed(4),
    bbPctB: +bbPctB.toFixed(3),
    sma20: ma20, sma50: ma50, sma200: ma200,
    strategy: 'highvol-breakout',
  };
}

// ─── VOIE MCP : --ingest (SEUL chemin data de la scan) ──────────────────────────────────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* (RunScreener US + QueryData bars_daily
// + ^VIX), applique EXACTEMENT les filtres/scoring highvol (scoreSymbol côté agent) + le VIX cluster
// gate, et écrit /tmp/highvol-stage.json. CE script PARSE le staging (jamais d'appel MCP, jamais de
// fetch réseau — OAuth2, zéro token), (ré)applique le VIX cluster gate (logique INTACTE, source VIX
// = staging), les gates hérités (blacklist, secteur/mcap métadonnée, stop/rr), et construit le pool.
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP, fail-closed) : staging absent / vide / malformé / mcp_ok:false /
// error / candidates non-array → marqueur _scanRuns.highvol {incomplete:true, signals:0} + exit 3,
// RIEN fabriqué. Aucun champ manquant/non-fini n'est inventé : le candidat tombe (comme factor/pead).
//
// Shape staging attendu (docs/specs/examples/highvol-stage.example.json) :
//   { mcp_ok:true, asof, regime?, vix:{ level, trend }, universeFetched?,
//     candidates:[ { ticker, name?, score, entry, stop, sharia?, region?, horizon?,
//         metrics:{ atrPct, distMA20, volRatio, rsi, bbPctB?, distMA200?, mom120? } } ] }

function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeHighvolIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude highvol.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.highvol = Object.assign({
    at: new Date().toISOString(), universe: 'americanbull', dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns.highvol écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Authentic 0-signal exit (VIX toxic cluster / RISK_OFF) : écrit le marqueur _scanRuns.highvol
// {signals:0, incomplete:false, note} pour prouver que le scanner a bien tourné (jour 0-signal
// LÉGITIME), puis retourne []. Idempotent : n'écrase que la clé highvol.
function earlyExit(note) {
  console.log(`\n❌ ${note}`);
  if (!DRY_RUN && OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (fs.existsSync(sigPath)) {
      const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
      if (!signals._scanRuns) signals._scanRuns = {};
      signals._scanRuns.highvol = {
        at: new Date().toISOString(), universe: 'americanbull', dataPath: 'mcp-ingest',
        candidates: 0, signals: 0, added: 0, incomplete: false, note,
      };
      fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
      console.log(`📁 Wrote highvol 0-signal marker to ${sigPath}`);
    }
  }
  return [];
}

// Ingest + validation du staging (mêmes règles fail-closed que factor/pead loadStaging).
function loadHighvolStaging() {
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

// Un candidat stagé → signal complet (shape identique à la voie locale historique) | null (+ raison
// de drop). N'INVENTE aucune donnée : tout champ manquant/non-fini fait tomber le candidat.
// Gates hérités : blacklist allocation ; secteur/mcap (métadonnée locale, parité Go) ; stop réel
// (drop si entry-stop ≤ 0) ; rr dérivé du modèle partial-TP (+30% / +60%).
function evaluateHighvolCandidate(c) {
  const drop = reason => ({ sig: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  if (BLACKLIST.has(ticker)) return drop('blacklist');
  if (!passesSectorMcap(ticker)) return drop('sector_mcap');
  const m = c.metrics || {};
  const entry = num(c.entry);
  const score = num(c.score);
  const stop = num(c.stop);
  const atrPct = num(m.atrPct);
  const distMA20 = num(m.distMA20);
  const volRatio = num(m.volRatio);
  const rsi = num(m.rsi);
  if (!(entry > 0) || !Number.isFinite(score)
      || !Number.isFinite(atrPct) || !Number.isFinite(distMA20)
      || !Number.isFinite(volRatio) || !Number.isFinite(rsi))
    return drop('missing_highvol_fields');
  if (!Number.isFinite(stop) || !(entry - stop > 0)) return drop('bad_stop');
  const risk = entry - stop;
  // tp1 = the real partial-TP trigger level (entry × (1 + partialTPGain/100)); tp2 = 2x that gain.
  // rr computed from tp1 vs THIS ticker's actual stop distance — varies per signal.
  const tp1 = +(entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
  const tp2 = +(entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
  const rr = +((tp1 - entry) / risk).toFixed(2);
  const bbPctB = num(m.bbPctB);
  return {
    sig: {
      ticker, name: c.name || ticker, score: +score, strategy: 'HighVolBreakout',
      entry: +entry.toFixed(2), stop: +stop.toFixed(2), tp1, tp2, rr: `1:${rr.toFixed(2)}`,
      horizon: Number.isFinite(num(c.horizon)) ? c.horizon : 21,
      region: c.region || 'US', universe: c.universe || 'americanbull',
      sharia: c.sharia != null ? c.sharia : null,
      thesis: `HV score ${score}: ATR%=${(atrPct * 100).toFixed(1)}%, DistMA20=${(distMA20 * 100).toFixed(1)}%, VolR=${volRatio}, RSI=${rsi.toFixed(0)}`,
      extension: { atrPct: +atrPct.toFixed(4), bbPctB: Number.isFinite(bbPctB) ? +bbPctB.toFixed(3) : null },
      dataPath: 'mcp-ingest',
    },
    reason: null,
  };
}

// ─── Main (VOIE MCP — ingest, SEUL chemin data) ───────────────────────────────────────────────

function main() {
  // MCP-PRIMARY : --ingest (staging agent→MCP) est le SEUL chemin data. Plus aucun fallback local
  // (Yahoo + univers local retirés — décret archi 2026-07-12). Sans --ingest → erreur claire.
  if (!INGEST_PATH) {
    console.error('❌ highvol-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (RunScreener US + QueryData bars_daily + ^VIX),');
    console.error('   puis : node tools/highvol-scanner.js --ingest /tmp/highvol-stage.json --output signals --folder YYYYMMDD --regime REGIME');
    console.error('   Le fetch Yahoo/query1 + la lecture data/americanbull-universe.json ont été supprimés (MCP = référence).');
    process.exit(2);
  }

  if (OUTPUT_MODE !== 'signals' && OUTPUT_MODE !== 'stdout' && OUTPUT_MODE !== 'json') {
    console.error(`❌ --output inconnu: ${OUTPUT_MODE} (attendu: signals|stdout|json)`); process.exit(1);
  }

  const staged = loadHighvolStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging highvol indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeHighvolIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = REGIME || data.regime || '';
  const candidates = data.candidates;
  // VIX depuis le staging (source MCP : l'agent a lu ^VIX via QueryData). Absent → cluster filters
  // désactivés (vixLevel=0), EXACTEMENT le comportement historique « No VIX data » (logique intacte).
  const vix = (data.vix && typeof data.vix === 'object') ? data.vix : {};
  const vixLevel = Number.isFinite(vix.level) ? vix.level : 0;
  const vixTrend = vix.trend || 'stable';

  console.log('⚡ HighVol Breakout Scanner — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)');
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | minScore: ${MIN_SCORE} | top: ${TOP_N}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime || 'auto'}`);
  if (vixLevel > 0) console.log(`   VIX: ${vixLevel.toFixed(1)} (${vixTrend})`);
  else console.log('   ⚠️ No VIX data in staging — cluster filters disabled');

  const regimeUp = String(regime).toUpperCase().replace(/[- ]/g, '_');

  // ─── VIX cluster gate (V11-V13) — logique de signal INTACTE (source VIX = staging MCP) ─────────
  // RISK_OFF = no new positions
  if (regimeUp === 'RISK_OFF') {
    return earlyExit('Regime RISK_OFF — no new positions.');
  }
  // Max volatility index (scanner_filters.max_volatility_index = 28): VIX above cap => no scan
  if (vixLevel > MAX_VOLATILITY_INDEX) {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} > ${MAX_VOLATILITY_INDEX} (max_volatility_index) — no signals.`);
  }
  // VIX 18-22 + not stable = toxic
  if (vixLevel >= 18 && vixLevel < 22 && vixTrend !== 'stable') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (18-22) + ${vixTrend} = TOXIC cluster, no signals.`);
  }
  // VIX 15-18 + falling = toxic
  if (vixLevel >= 15 && vixLevel < 18 && vixTrend === 'falling') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (15-18) + falling = TOXIC cluster, no signals.`);
  }
  // VIX < 15 + rising = toxic
  if (vixLevel > 0 && vixLevel < 15 && vixTrend === 'rising') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (<15) + rising = TOXIC cluster, no signals.`);
  }
  // VIX 22-30 + falling = toxic
  if (vixLevel >= 22 && vixLevel < 30 && vixTrend === 'falling') {
    return earlyExit(`VIX ${vixLevel.toFixed(1)} (22-30) + falling = TOXIC cluster, no signals.`);
  }
  // RECOVERY + VIX 18-22 = toxic
  if (regimeUp.includes('RECOVERY') && vixLevel >= 18 && vixLevel < 22) {
    return earlyExit(`RECOVERY + VIX ${vixLevel.toFixed(1)} (18-22) = TOXIC cluster, no signals.`);
  }

  // ─── Évaluation des candidats stagés (gates hérités, zéro fabrication) ─────────────────────────
  console.log('🔍 Scoring candidates (highvol breakout — gates hérités)...');
  const sigs = [];
  const dropStats = {};
  for (const c of candidates) {
    const { sig, reason } = evaluateHighvolCandidate(c);
    if (sig) sigs.push(sig);
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }
  sigs.sort((a, b) => b.score - a.score);
  const topCandidates = sigs.slice(0, TOP_N);

  console.log(`\n✅ Found ${sigs.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 100 ? '🔥' : c.score >= 70 ? '⚡' : '  ';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${String(c.score).padStart(6)} ATR%:${(c.extension.atrPct * 100).toFixed(1)}% entry:${c.entry} stop:${c.stop} R/R:${c.rr}`);
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `highvol-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime, vix: { level: vixLevel, trend: vixTrend }, dataPath: 'mcp-ingest', candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
    return topCandidates;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // Fusion NON DESTRUCTIVE, dedup par ticker (identique à la voie locale) : on préserve le reste
    // du fichier (autres scanners + _scanRuns) et on n'écrase pas un ticker déjà présent.
    if (!Array.isArray(signals.signals)) signals.signals = [];
    const existing = new Set(signals.signals.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push(c);
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the highvol scanner actually ran (even with 0 signals, which is legitimate).
    // Merged into the shared _scanRuns object (keyed 'highvol') without clobbering other scanners.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.highvol = {
      at: new Date().toISOString(),
      universe: 'americanbull',
      dataPath: 'mcp-ingest',
      candidates: sigs.length,
      signals: topCandidates.length,
      added,
      regime,
      vix: { level: vixLevel, trend: vixTrend },
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} highvol signals (voie MCP) to ${sigPath}`);
  }

  return topCandidates;
}

// ─── Module exports (for tools/pit-backfill.js — reuse EXACT scoring for PIT parity) ──
// Backward-compatible: CLI behavior unchanged when run directly; main() only fires as entrypoint.
// loadUniverse conservé UNIQUEMENT pour pit-backfill (consommateur restant de americanbull-universe.json).
module.exports = {
  scoreSymbol, calcStdDev, loadUniverse, passesSectorMcap,
  BLACKLIST,
  MIN_P80_DOLLAR_VOLUME, MIN_ESTABLISHED_DOLLAR_VOLUME, ESTABLISHED_LOOKBACK,
  PARTIAL_TP_GAIN_PCT, MAX_VOLATILITY_INDEX,
};

if (require.main === module) {
  main();
}
