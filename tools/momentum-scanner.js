#!/usr/bin/env node
'use strict';

/**
 * momentum-scanner.js — Momentum Rotation Scanner (exact port of systematic-tss)
 *
 * Momentum ranking scanner: MA50>MA200 uptrend, positive momentum 20/50/100d,
 * weighted scoring, consistency bonus. Used by Casablanca (MA) and EU configs.
 *
 * ─── MCP-PRIMARY (décret archi 2026-07-12 « le MCP fait foi ») ─────────────────────────────────
 * Pour les univers COUVERTS par le MCP marketdata (americanbull=US, metals, forex, eu), la voie
 * --ingest (staging produit par l'AGENT via mcp__marketdata__* — OAuth2, zéro token) est le SEUL
 * chemin data. Le fetch Yahoo (query1.finance.yahoo.com) et la lecture data/*-universe.json ont
 * été RETIRÉS : le node ne fetch plus rien pour ces univers.
 * SEULE EXCEPTION : casablanca (BVC) N'EST PAS couvert par le MCP marketdata (COVERED_STALE — ATW/
 * IAM figés 2022-03) → conserve sa voie publique BVC légitime (bvc-fetcher, tickers depuis l'API
 * BVC, pas d'univers local ni de Yahoo). Ce n'est PAS du legacy à virer.
 *
 * Usage:
 *   node tools/momentum-scanner.js --universe americanbull --ingest /tmp/momentum-stage.json --output signals --folder 20260629
 *   node tools/momentum-scanner.js --universe casablanca --output signals --folder 20260629   # voie BVC publique
 */

const fs = require('fs');
const path = require('path');
const {
  calcSMA, calcRSI, calcATR, calcVolatility, calcMomentum,
  calcAvgVolume, calcMedianVolume, calcDollarVolumePercentile,
} = require('./lib/fractal-indicators');
const { batchFetchBVC } = require('./lib/bvc-fetcher');

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE_NAME = getArg('universe', 'americanbull');
const CUSTOM_TICKERS = getArg('tickers', '').split(',').filter(Boolean);
const MIN_SCORE = parseFloat(getArg('min-score', '5'));
const TOP_N = parseInt(getArg('top', '20'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));
// ─── VOIE MCP (--ingest) — SEUL chemin data pour les univers couverts (MCP-PRIMARY) ─────────────
// Quand --ingest est fourni, le scanner NE FETCH RIEN : il PARSE un staging JSON écrit par l'AGENT
// (qui, LUI, a appelé mcp__marketdata__* — OAuth2, zéro token) : RunScreener (pool US/EU/metals/forex)
// + QueryData bars_daily → momentum scoré côté agent. Modèle factor-scanner.js / top-10.
// Pour americanbull/metals/forex/eu, --ingest est OBLIGATOIRE : le fetch Yahoo local a été supprimé.
const INGEST_PATH = getArg('ingest', null);
// Univers effectif de la voie MCP (résolu depuis le staging dans ingestMain — défaut = --universe).
let INGEST_UNIVERSE = UNIVERSE_NAME;

// ─── Gates hérités (voie --ingest) — mêmes seuils que pead-scanner / scanner-filters ──────────
const PENNY_MIN_PRICE = 5;      // penny < $5 rejeté (gate hérité)
const STOP_MIN_PCT = 0.03;      // stop floor 3% absolu (scanner-filters min stop)
const STOP_MAX_PCT = 0.08;      // maxStopPct 8% (modes-config.json)
const STOP_ATR_MULT = 1.5;      // min_atr_multiple 1.5× ATR14 (retro Mar 27)

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.momentum) ───
// partialTPGain=10 → the mode's REAL partial-TP trigger is +10% price gain (not entry+2R).
// disableTP2=true → no live second target; tp2 kept as 2x TP1 gain for display/order-form
// consistency only (sweep.js gates the actual TP2 check on cfg.disableTP2 independently of
// this field, so this is informational, not a behavior change to the simulation).
// rr computed per-ticker from the actual stop distance, replacing the previous hardcoded
// '1:2.0' (audit finding: uniform R/R disconnected from each signal's real risk).
const PARTIAL_TP_GAIN_PCT = 10; // modes-config.json modes.momentum.partialTPGain

const IS_BVC = UNIVERSE_NAME === 'casablanca';

// MIN_BARS : 120 (BVC, historiques plus courts) sinon 200 (nécessaire pour MA200). Utilisé par
// scoreSymbol (voie BVC casablanca) et hérité par les gates ; la voie MCP --ingest score côté agent.
const MIN_BARS = IS_BVC ? 120 : 200;

// NOTE MCP-PRIMARY : le fetch Yahoo (fetchOHLCV/batchFetch), son cache prix daté (price-cache) et le
// loader d'univers local (loadUniverse + data/*-universe.json) ont été RETIRÉS. Les univers couverts
// par le MCP passent par --ingest (staging agent→mcp__marketdata__) ; casablanca passe par batchFetchBVC
// (API BVC publique, tickers résolus par bvc-fetcher.loadInstruments — hors périmètre MCP).

// ─── Momentum Rotation Scoring (exact port of scanner_momentum_rotation.go) ─

function scoreSymbol(bars, regime) {
  const n = bars.length;
  if (n < MIN_BARS) return null;
  const price = bars[n - 1].close;
  if (price <= 0 || !isFinite(price)) return null;

  const mom20 = calcMomentum(bars, 20);
  const mom50 = calcMomentum(bars, 50);
  const mom100 = calcMomentum(bars, 100);
  const ma50 = calcSMA(bars, 50);
  const ma200 = calcSMA(bars, 200);
  const ma20 = calcSMA(bars, 20);
  const atr = calcATR(bars, 14);
  const rsi = calcRSI(bars, 14);

  // Match Go scanner_momentum_rotation.go:245 — require ma200 > 0 (>=200 bars).
  if (ma50 <= 0 || ma200 <= 0 || atr <= 0) return null;

  const atrPct = atr / price;

  // FILTER 1: Uptrend (MA50 > MA200). Unconditional, mirrors Go line 254.
  if (ma50 <= ma200) return null;

  // FILTER 2: Positive momentum 20d
  if (mom20 < 0) return null;

  // FILTER 3: ATR% between 1-10%
  if (atrPct < 0.01 || atrPct > 0.10) return null;

  // FILTER 4: RSI 30-80
  if (rsi < 30 || rsi > 80) return null;

  // SCORING: Weighted momentum combination
  let score = mom20 * 50 + mom50 * 30 + mom100 * 20;

  // Consistency bonus (all 3 momentum periods positive)
  if (mom20 > 0 && mom50 > 0 && mom100 > 0) {
    score *= 1.2;
  }

  score = Math.round(score * 100) / 100;

  if (score < MIN_SCORE) return null;

  const distMA20 = ma20 > 0 ? (price - ma20) / ma20 : 0;
  const distMA50 = (price - ma50) / ma50;
  const distMA200 = (price - ma200) / ma200;
  const avgVol20 = calcAvgVolume(bars, 20);
  const volRatio = avgVol20 > 0 ? (bars[n - 1].volume || 0) / avgVol20 : 0;

  const stopLoss = price - 2 * atr;

  return {
    score, price, entry: price,
    stop: +stopLoss.toFixed(4),
    atr, atrPct, rsi,
    mom20, mom50, mom100,
    volRatio: +volRatio.toFixed(2),
    distMA20: +distMA20.toFixed(4),
    distMA50: +distMA50.toFixed(4),
    distMA200: +distMA200.toFixed(4),
    sma20: ma20, sma50: ma50, sma200: ma200,
    strategy: 'momentum-rotation',
  };
}

// ─── VOIE MCP : --ingest (voie optionnelle data-path MCP, modèle factor-scanner.js) ────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* (RunScreener US + QueryData bars_daily),
// score le momentum 20/50/100 comme scoreSymbol() et écrit /tmp/momentum-stage.json. CE script PARSE
// le staging (jamais de fetch réseau, jamais d'appel MCP — OAuth2, zéro token), applique les gates
// hérités (stop/rr/penny/sharia) et construit le pool du mode + _scanRuns[...] dans signals.json.
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP, fail-closed) : staging absent / vide / malformé / mcp_ok:false /
// error / candidates non-array → marqueur _scanRuns[...] {incomplete:true, signals:0} + exit 3, RIEN
// fabriqué. Aucun champ manquant/non-fini n'est inventé : le candidat tombe (comme pead/factor).
//
// Shape staging attendu : { mcp_ok:true, asof, regime?, universe?, universeFetched?,
//   candidates:[ { ticker, name?, score, entry, stop?, sharia?, region?, universe?, horizon?,
//                  metrics:{ mom20, mom50, mom100, rsi, atr, ... } } ] }
function normRegime(r) { return String(r || '').toUpperCase().trim(); }
// R/R ≥ 1,5 (RISK-ON/NEUTRAL/RECOVERY) ou ≥ 2,0 (EARLY RISK-OFF/RISK-OFF) — hérité (cf pead/factor).
function rrThreshold(regime) {
  const r = normRegime(regime);
  return (r === 'RISK-OFF' || r === 'EARLY RISK-OFF') ? 2.0 : 1.5;
}
// Clé _scanRuns : 'momentum' (americanbull) | 'momentum:<universe>' — MÊME convention que la voie locale.
function scanRunKey(universe) { return universe === 'americanbull' ? 'momentum' : `momentum:${universe}`; }
function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeMomentumIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude momentum.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns[scanRunKey(INGEST_UNIVERSE)] = Object.assign({
    at: new Date().toISOString(), universe: INGEST_UNIVERSE, dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['${scanRunKey(INGEST_UNIVERSE)}'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que pead/factor loadStaging).
function loadMomentumStaging() {
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

// Un candidat stagé → signal complet (shape identique à la voie locale) | null (+ raison de drop).
// N'INVENTE aucune donnée : tout champ manquant/non-fini fait tomber le candidat (fail-closed).
// Gates hérités : penny < $5 ; stop clampé ∈ [max(3%, 1.5×ATR14), 8%] (drop si 1.5×ATR > 8%) ;
// rr ≥ seuil régime ; sharia passé tel quel (tag hérité).
function evaluateMomentumCandidate(c, regime) {
  const drop = reason => ({ sig: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  const m = c.metrics || {};
  const entry = num(c.entry);
  const score = num(c.score);
  const atr = num(m.atr);
  const mom20 = num(m.mom20), mom50 = num(m.mom50), mom100 = num(m.mom100), rsi = num(m.rsi);
  if (!(entry > 0) || !Number.isFinite(score)
      || !Number.isFinite(mom20) || !Number.isFinite(mom50) || !Number.isFinite(mom100) || !Number.isFinite(rsi))
    return drop('missing_momentum_fields');
  // Gate penny (< $5).
  if (!(entry >= PENNY_MIN_PRICE)) return drop('penny_under_5');
  // Gate stop : bande [max(3%, 1.5×ATR14), 8%] (hérité pead/scanner-filters). momentum = trade PAR
  // LIGNE (contrairement à factor/rotation) → le stop-band de trade S'APPLIQUE bel et bien.
  if (!(atr > 0)) return drop('no_atr');
  const minDist = Math.max(entry * STOP_MIN_PCT, STOP_ATR_MULT * atr);
  const maxDist = entry * STOP_MAX_PCT;
  if (minDist > maxDist) return drop('atr_too_wide_for_stop_band'); // 1.5×ATR dépasse le plafond 8%
  const rawStop = num(c.stop);
  let stopDist = Number.isFinite(rawStop) ? entry - rawStop : NaN;
  if (!(stopDist > 0)) stopDist = minDist;
  stopDist = Math.min(Math.max(stopDist, minDist), maxDist);
  const stop = +(entry - stopDist).toFixed(4);
  // tp1/tp2 : modèle partial-TP momentum (mirrors modes-config.json modes.momentum.partialTPGain).
  const tp1 = +(entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
  const tp2 = +(entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
  // Gate rr ≥ seuil régime.
  const rr = +((tp1 - entry) / (entry - stop)).toFixed(2);
  if (rr < rrThreshold(regime)) return drop(`rr_below_${rrThreshold(regime)}`);
  const region = c.region || (INGEST_UNIVERSE === 'americanbull' ? 'US' : String(INGEST_UNIVERSE).toUpperCase());
  return {
    sig: {
      ticker, name: c.name || ticker, score: +score, strategy: 'MomentumRotation',
      entry: +entry.toFixed(2), stop: +stop.toFixed(2), tp1, tp2, rr: `1:${rr.toFixed(2)}`,
      horizon: Number.isFinite(num(c.horizon)) ? c.horizon : 21,
      region, universe: c.universe || INGEST_UNIVERSE,
      sharia: c.sharia != null ? c.sharia : null,
      thesis: `MomRot score ${score.toFixed(1)}: Mom20=${(mom20 * 100).toFixed(1)}%, Mom50=${(mom50 * 100).toFixed(1)}%, Mom100=${(mom100 * 100).toFixed(1)}%, RSI=${rsi.toFixed(0)}`,
      extension: { mom20: +mom20.toFixed(4), mom50: +mom50.toFixed(4), mom100: +mom100.toFixed(4) },
      dataPath: 'mcp-ingest',
    },
    reason: null,
  };
}

// Branche --ingest : parse le staging, applique les gates hérités, trie par score, garde top-N, et
// construit le pool du mode (signals.signals[]) + _scanRuns[...] (fusion NON destructive, dedup ticker).
function ingestMain() {
  if (OUTPUT_MODE !== 'signals' && OUTPUT_MODE !== 'stdout' && OUTPUT_MODE !== 'json') {
    console.error(`❌ --output inconnu: ${OUTPUT_MODE} (attendu: signals|stdout|json)`); process.exit(1);
  }
  const staged = loadMomentumStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging momentum indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeMomentumIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = REGIME || data.regime || 'NEUTRAL';
  const candidates = data.candidates;
  INGEST_UNIVERSE = data.universe || (candidates[0] && candidates[0].universe) || UNIVERSE_NAME;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : candidates.length;

  console.log('🔄 Momentum Rotation Scanner — VOIE MCP (--ingest, data-path MCP optionnel)');
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | universe: ${universeFetched} (${INGEST_UNIVERSE})`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime} | rr seuil: ${rrThreshold(regime)} | top: ${TOP_N}`);

  const sigs = [];
  const dropStats = {};
  for (const c of candidates) {
    const { sig, reason } = evaluateMomentumCandidate(c, regime);
    if (sig) sigs.push(sig);
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }
  sigs.sort((a, b) => b.score - a.score);
  const top = sigs.slice(0, TOP_N);

  console.log(`\n✅ ${sigs.length} signaux momentum (gates hérités passés), top ${top.length} :`);
  for (const s of top) {
    console.log(`  ${s.ticker.padEnd(8)} score:${s.score.toFixed(1).padStart(6)} entry:${s.entry} stop:${s.stop} tp1:${s.tp1} R/R:${s.rr}`);
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return top; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `momentum-scan-${INGEST_UNIVERSE}-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime, universe: INGEST_UNIVERSE, dataPath: 'mcp-ingest', candidates: top }, null, 2));
    console.log(`\n📁 Écrit dans ${outPath}`);
    return top;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} introuvable`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // Fusion NON DESTRUCTIVE, dedup par ticker (identique à la voie locale) : on préserve le reste du
    // fichier (autres scanners + _scanRuns) et on n'écrase pas un ticker déjà présent (coexistence local).
    if (!Array.isArray(signals.signals)) signals.signals = [];
    const existing = new Set(signals.signals.map(s => s.ticker));
    let added = 0;
    for (const s of top) {
      if (existing.has(s.ticker)) continue;
      signals.signals.push(s);
      existing.add(s.ticker);
      added++;
    }
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns[scanRunKey(INGEST_UNIVERSE)] = {
      at: new Date().toISOString(), universe: INGEST_UNIVERSE, dataPath: 'mcp-ingest',
      candidates: sigs.length, signals: top.length, added, regime, incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 ${added} signaux momentum ajoutés (voie MCP) dans ${sigPath}`);
  }
  return top;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // VOIE MCP (--ingest) : on PARSE le staging agent→MCP et on NE FETCH RIEN. SEUL chemin data pour les
  // univers couverts (americanbull/metals/forex/eu).
  if (INGEST_PATH) { ingestMain(); return; }

  // MCP-PRIMARY (« le MCP fait foi », décret 2026-07-12) : pour un univers COUVERT par le MCP
  // marketdata, --ingest est OBLIGATOIRE. Le fetch Yahoo local et la lecture data/*-universe.json ont
  // été RETIRÉS — le node ne fetch plus rien pour ces univers. RIEN n'est fabriqué : on sort en erreur.
  if (!IS_BVC) {
    console.error(`❌ momentum est MCP-PRIMARY pour l'univers « ${UNIVERSE_NAME} » : fournir --ingest <staging.json>.`);
    console.error(`   Le staging est produit par l'AGENT via mcp__marketdata__* (RunScreener + QueryData bars_daily).`);
    console.error(`   Le fetch Yahoo/query1 + la lecture data/*-universe.json ont été supprimés (MCP = référence).`);
    process.exit(1);
  }

  // casablanca : NON couvert par le MCP marketdata (COVERED_STALE, ATW/IAM figés 2022-03) → voie
  // publique BVC légitime (bvc-fetcher : tickers résolus depuis l'API BVC, aucun univers local, aucun
  // Yahoo). Ce n'est PAS du legacy à retirer — c'est le seul flux data disponible pour Casablanca.
  console.log(`🔄 Momentum Rotation Scanner (casablanca / BVC — hors périmètre MCP marketdata)`);
  console.log(`   minScore: ${MIN_SCORE} | top: ${TOP_N} | Date: ${SCAN_DATE} | Regime: ${REGIME || 'auto'}`);
  console.log(`📡 Fetching OHLCV data via BVC API...`);
  const priceData = await batchFetchBVC(CONCURRENCY, { date: SCAN_DATE });
  if (!priceData.size) { console.error('❌ No OHLCV data — aborting.'); process.exit(1); }

  console.log('🔍 Scoring candidates (momentum ranking)...');
  const candidates = [];
  const scanDateNorm = SCAN_DATE.replace(/-/g, '');

  for (const [ticker, rawBars] of priceData) {
    const cutIdx = rawBars.findIndex(b => b.date.replace(/-/g, '') > scanDateNorm);
    const bars = cutIdx > 0 ? rawBars.slice(0, cutIdx) : rawBars;

    const result = scoreSymbol(bars, REGIME);
    if (!result) continue;

    const risk = result.entry - result.stop;
    if (risk <= 0) continue;

    const tp1 = +(result.entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
    const tp2 = +(result.entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
    const rr = +((tp1 - result.entry) / risk).toFixed(2);

    candidates.push({
      ticker, score: result.score,
      entry: +result.entry.toFixed(2), stop: +result.stop.toFixed(2), tp1, tp2,
      rr: `1:${rr.toFixed(2)}`, metrics: result,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  console.log(`\n✅ Found ${candidates.length} signals (passed all filters), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    const icon = c.score >= 30 ? '🚀' : c.score >= 15 ? '📈' : '  ';
    const consistent = c.metrics.mom20 > 0 && c.metrics.mom50 > 0 && c.metrics.mom100 > 0 ? '★' : ' ';
    console.log(`  ${icon} ${c.ticker.padEnd(8)} score:${c.score.toFixed(1).padStart(6)} ${consistent} Mom20:${(c.metrics.mom20 * 100).toFixed(1)}% Mom50:${(c.metrics.mom50 * 100).toFixed(1)}% Mom100:${(c.metrics.mom100 * 100).toFixed(1)}% RSI:${c.metrics.rsi.toFixed(0)}`);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `momentum-scan-${UNIVERSE_NAME}-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime: REGIME, universe: UNIVERSE_NAME, candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
  } else if (OUTPUT_MODE === 'signals') {
    const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.signals.push({
        ticker: c.ticker, name: c.ticker, score: c.score, strategy: 'MomentumRotation',
        entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2, rr: c.rr,
        horizon: 21, region: UNIVERSE_NAME === 'americanbull' ? 'US' : UNIVERSE_NAME.toUpperCase(), universe: UNIVERSE_NAME,
        sharia: null,
        thesis: `MomRot score ${c.score.toFixed(1)}: Mom20=${(c.metrics.mom20 * 100).toFixed(1)}%, Mom50=${(c.metrics.mom50 * 100).toFixed(1)}%, Mom100=${(c.metrics.mom100 * 100).toFixed(1)}%, RSI=${c.metrics.rsi.toFixed(0)}`,
        extension: { mom20: +c.metrics.mom20.toFixed(4), mom50: +c.metrics.mom50.toFixed(4), mom100: +c.metrics.mom100.toFixed(4) },
      });
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the momentum scanner actually ran for this universe (even with 0 signals).
    // Key: 'momentum' (americanbull default) | 'momentum:<universe>' — merged into the shared
    // _scanRuns object without clobbering other scanners' entries.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns[UNIVERSE_NAME === 'americanbull' ? 'momentum' : `momentum:${UNIVERSE_NAME}`] = {
      at: new Date().toISOString(),
      universe: UNIVERSE_NAME,
      candidates: candidates.length,
      signals: topCandidates.length,
      added,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} momentum signals to ${sigPath}`);
  }

  return topCandidates;
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
