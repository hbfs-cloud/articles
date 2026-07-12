#!/usr/bin/env node
'use strict';

/**
 * forex-scanner.js — Faithful port of systematic-tss ForexScanner.
 *
 * Source: internal/engine/scanner_forex.go (3-axis scoring: Momentum 40%,
 * Mean Reversion 30%, Relative Strength vs DXY 30%).
 *
 * ─── MCP-PRIMARY (décret archi 2026-07-12 « le MCP fait foi ») ─────────────────────────────────
 * L'univers forex (8 majors + DXY) est COUVERT par le MCP marketdata (bars_daily des paires =X +
 * DX-Y.NYB, frais ≤48h, cohérents — volume=0 est NORMAL en FX). La voie --ingest (staging produit
 * par l'AGENT via mcp__marketdata__* — OAuth2, zéro token) est désormais le SEUL chemin data de la
 * SCAN. Le fetch Yahoo (query1.finance.yahoo.com), son cache prix daté (lib/price-cache) et la
 * lecture de l'univers local (data/forex-universe.json) ont été RETIRÉS de la voie de scan : ce node
 * NE FETCH PLUS RIEN (ni réseau, ni cache) pour scanner.
 *
 * forex est dtx-backed : l'equity/les ordres du mode viennent DÉJÀ du MCP dtx (config forex, source
 * autoritative). Ce scanner JS ne produit qu'un MARQUEUR D'AFFICHAGE (le pool `forex_pool` +
 * `_scanRuns.forex`) rendu sur scanner/status. On bascule la SOURCE de ce marqueur du local/Yahoo
 * vers le MCP marketdata (cohérence du décret), SANS toucher au chemin dtx.
 *
 * Le pool MCP est produit par l'AGENT (modèle factor-scanner.js / highvol-scanner.js / top-10) :
 *   QueryData(types=bars_daily, symbols=<8 majors =X + DX-Y.NYB>, days≥250) → l'agent applique
 *     EXACTEMENT les filtres/scoring forex (scoreForexPair : momentum 40% / mean-reversion 30% /
 *     relative-strength 30% vs DXY, RSI band, ATR%, min_score) puis écrit /tmp/forex-stage.json.
 * CE script PARSE le staging (jamais d'appel MCP — OAuth2, zéro token), applique les gates hérités
 * (score gate, stop/rr dérivés de l'ATR) et construit le pool du mode + _scanRuns.forex.
 *
 * ⚠️ La logique de scoring (scoreForexPair) + les constantes/filtres restent EXPORTÉS et INTACTS :
 * seule la SOURCE des barres change (MCP au lieu de Yahoo). L'AGENT rejoue EXACTEMENT ce scoring
 * côté MCP et écrit les métriques dans le staging. La voie de scan MCP-primary n'appelle NI fetch
 * réseau NI lecture d'univers local.
 *
 * SCORING (scanner_forex.go:141-251) — rejoué par l'AGENT sur les barres MCP :
 *   MOMENTUM (40%)   : momRaw = ret30d*0.40 + ret14d*0.35 + ret7d*0.25 ; trendBonus 15/10/5/0 ;
 *                      momentumScore = clamp(momRaw*5 + 25 + trendBonus, 0, 50)
 *   MEAN REV (30%)   : bbPctB(20,2.0) + distMA20 ; mrScoreNorm = clamp(mrScore, -10, 40)
 *   REL STRENGTH(30%): pairMom(ret30d) vs dxyMom30 ; rsScoreNorm = min(rsScore, 30)
 *   FINAL = momentumScore*0.40 + mrScoreNorm*0.30 + rsScoreNorm*0.30
 *
 * FILTERS (forex-majors sleeve scanner_filters, config/portfolio_multi_survivors.yaml) :
 *   ≥200 bars ; atrPct ≥ 0.006 ; RSI ∈ [30,75] ; finalScore ≥ 8.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/forex-stage.json via mcp__marketdata__*
 *   node tools/forex-scanner.js --ingest /tmp/forex-stage.json --output signals --folder 20260713
 *   node tools/forex-scanner.js --ingest /tmp/forex-stage.json --dry-run --top 8
 *   node tools/forex-scanner.js --ingest /tmp/forex-stage.json --output json --date 2026-07-13
 *
 * Codes de sortie : 0 = OK (0 signal légitime inclus) ; 3 = staging absent/vide/malformé/
 * mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ;
 * 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');
const { calcSMA, calcRSI, calcATR, calcReturn, calcBBPctB } = require('./lib/forex-indicators');

const ROOT = path.join(__dirname, '..');

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

// forex-majors sleeve scanner_filters.min_score = 8 (config/portfolio_multi_survivors.yaml).
// Go effective gate = max(filters.MinScore=8, hard floor 5.0) = 8. Keep the JS default in sync.
const MIN_SCORE = parseFloat(getArg('min-score', '8'));
const TOP_N = parseInt(getArg('top', '10'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
// ─── VOIE MCP (--ingest) — SEUL chemin data de la scan (MCP-PRIMARY) ────────────────────────────
// Quand --ingest est fourni, le scanner NE FETCH RIEN : il PARSE un staging JSON écrit par l'AGENT
// (qui, LUI, a appelé mcp__marketdata__* — OAuth2, zéro token). --ingest est OBLIGATOIRE (le fetch
// Yahoo local + la lecture data/forex-universe.json ont été supprimés de la voie de scan).
const INGEST_PATH = getArg('ingest', null);

// Momentum weights (scanner_forex.go:147)
const MW30 = 0.40, MW14 = 0.35, MW7 = 0.25;
// Combined-axis weights (scanner_forex.go:239)
const W_MOM = 0.40, W_MR = 0.30, W_RS = 0.30;

// Scanner filters — MUST mirror the forex-majors sleeve scanner_filters in
// config/portfolio_multi_survivors.yaml (Go applies these via SetFilters). The bare
// scanner_forex.go defaults (RSI 20-80, ATR≥0.001, score≥5) are OVERRIDDEN per-sleeve;
// forex mode = forex-majors, so these are the authoritative ISO thresholds:
//   scanner_filters: { min_rsi: 30, max_rsi: 75, min_score: 8, min_atr_pct: 0.006 }
// EXPORTÉS + INTACTS : l'AGENT rejoue EXACTEMENT ces gates côté MCP avant d'écrire le staging.
const FILTER_MIN_RSI = 30.0;      // config min_rsi (scanner_forex.go default 20)
const FILTER_MAX_RSI = 75.0;      // config max_rsi (scanner_forex.go default 80)
const FILTER_MIN_ATR_PCT = 0.006; // config min_atr_pct (scanner_forex.go default 0.001)
const FILTER_MIN_SCORE = 8.0;     // config min_score (Go gates finalScore < 8 → nil)

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// ─── Scoring (port of scoreForexPair, scanner_forex.go:99-311) ──────────────
// EXPORTÉ + INTACT : la logique de signal est conservée telle quelle (parité systematic-tss). Elle
// N'EST PAS appelée par la voie de scan MCP-primary (l'AGENT la rejoue côté MCP sur les barres
// fraîches et écrit les métriques dans le staging) ; conservée comme source de vérité du scoring que
// l'agent doit reproduire + pour toute réutilisation PIT ultérieure. Seule la SOURCE des barres
// change (MCP au lieu de Yahoo) — les indicateurs/filtres/poids sont identiques.
function scoreForexPair(symbol, bars, dxyMom30) {
  const n = bars.length;
  const price = bars[n - 1].close;
  if (!(price > 0) || !Number.isFinite(price)) return null;          // scanner_forex.go:103-105

  // Technical indicators (scanner_forex.go:108-110)
  const rsi = calcRSI(bars, 14);
  const atr = calcATR(bars, 14);
  const atrPct = atr / price;

  // Filter: dead pairs (scanner_forex.go:113-119) — forex-majors config min_atr_pct
  if (atrPct < FILTER_MIN_ATR_PCT) return null;

  // RSI band filter (scanner_forex.go:122-134) — forex-majors config min_rsi/max_rsi
  if (rsi < FILTER_MIN_RSI || rsi > FILTER_MAX_RSI) return null;

  // Moving averages (scanner_forex.go:137-139)
  const sma20 = calcSMA(bars, 20);
  const sma50 = calcSMA(bars, 50);
  const sma200 = calcSMA(bars, 200);

  // === MOMENTUM SCORE (40%) === scanner_forex.go:141-172
  const ret30d = calcReturn(bars, 30);
  const ret14d = calcReturn(bars, 14);
  const ret7d = calcReturn(bars, 7);
  const momRaw = ret30d * MW30 + ret14d * MW14 + ret7d * MW7;        // scanner_forex.go:159

  let trendBonus = 0.0;                                              // scanner_forex.go:162-169
  if (price > sma20 && sma20 > sma50 && sma50 > sma200) trendBonus = 15.0;
  else if (price > sma50 && sma50 > sma200) trendBonus = 10.0;
  else if (price > sma200) trendBonus = 5.0;

  const momentumScore = clamp(momRaw * 5.0 + 25.0 + trendBonus, 0, 50); // scanner_forex.go:172

  // === MEAN REVERSION SCORE (30%) === scanner_forex.go:174-199
  const bbPctB = calcBBPctB(bars, 20, 2.0);                          // scanner_forex.go:176
  let distMA20 = 0.0;
  if (sma20 > 0) distMA20 = (price - sma20) / sma20;                 // scanner_forex.go:178-180

  let mrScore = 0.0;
  if (bbPctB < 0.3 && rsi < 40) {                                    // scanner_forex.go:184-186
    mrScore = (0.3 - bbPctB) * 100 + (40 - rsi) * 0.5;
  }
  if (bbPctB > 0.8 && rsi > 65) {                                    // scanner_forex.go:188-190
    mrScore = -10.0;
  }
  if (Math.abs(distMA20) > 0.05) {                                   // scanner_forex.go:192-197
    if (distMA20 < -0.03) mrScore += 10.0;
  }
  const mrScoreNorm = clamp(mrScore, -10, 40);                       // scanner_forex.go:199

  // === RELATIVE STRENGTH SCORE (30%) === scanner_forex.go:201-236
  let rsScore = 0.0;
  const pairMom = ret30d;                                            // scanner_forex.go:208
  const isUSDBase = symbol.startsWith('USD');                        // scanner_forex.go:209

  if (dxyMom30 !== 0) {                                              // scanner_forex.go:211-227
    if (isUSDBase) {
      if (dxyMom30 < 0 && pairMom < 0) rsScore = 15.0;
      else if (dxyMom30 > 0 && pairMom > 0) rsScore = 10.0;
    } else {
      if (dxyMom30 < 0 && pairMom > 0) rsScore = 15.0;
      else if (dxyMom30 > 0 && pairMom < 0) rsScore = 10.0;
    }
  }
  if (Math.abs(pairMom) > 3.0) rsScore += 10.0;                      // scanner_forex.go:230-234
  else if (Math.abs(pairMom) > 1.5) rsScore += 5.0;

  const rsScoreNorm = Math.min(rsScore, 30);                        // scanner_forex.go:236

  // === COMBINED SCORE === scanner_forex.go:239-251
  const finalScore = momentumScore * W_MOM + mrScoreNorm * W_MR + rsScoreNorm * W_RS;

  // Score gate (scanner_forex.go:255-263): config min_score=8 then hard floor 5 → effective 8.
  if (finalScore < FILTER_MIN_SCORE) return null;

  // Distances from MAs (scanner_forex.go:276-283)
  const distMA50 = sma50 > 0 ? (price - sma50) / sma50 : 0;
  const distMA200 = sma200 > 0 ? (price - sma200) / sma200 : 0;

  return {
    symbol,
    score: Math.round(finalScore * 100) / 100,                      // scanner_forex.go:287
    price,
    atr,
    atrPct,
    rsi,
    bbPctB,
    ret30d,
    ret14d,
    ret7d,
    momentumScore,
    mrScoreNorm,
    rsScoreNorm,
    sma20,
    sma50,
    sma200,
    distMA20,
    distMA50,
    distMA200,
  };
}

// ─── VOIE MCP : --ingest (SEUL chemin data de la scan) ──────────────────────────────────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* (QueryData bars_daily des 8 majors =X +
// DX-Y.NYB, ~250 barres), rejoue EXACTEMENT scoreForexPair (momentum/mean-rev/rel-strength vs DXY +
// RSI band + ATR% + min_score), et écrit /tmp/forex-stage.json. CE script PARSE le staging (jamais
// d'appel MCP, jamais de fetch réseau — OAuth2, zéro token), applique les gates hérités (score gate,
// stop/tp/rr dérivés de l'ATR) et construit le pool.
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP, fail-closed) : staging absent / vide / malformé / mcp_ok:false /
// error / candidates non-array → marqueur _scanRuns.forex {incomplete:true, signals:0} + exit 3,
// RIEN fabriqué. Aucun champ manquant/non-fini n'est inventé : le candidat tombe (comme highvol/factor).
//
// Shape staging attendu :
//   { mcp_ok:true, asof, dxyMom30?, dxySymbol?, universeFetched?,
//     candidates:[ { ticker, name?, score, price(|entry), atr, sharia?, region?, horizon?,
//         metrics:{ rsi, atrPct, bbPctB, ret30d, ret14d, ret7d,
//                   momentumScore, mrScore, rsScore, distMA20, distMA50, distMA200 } } ] }

function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeForexIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude forex.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.forex = Object.assign({
    at: new Date().toISOString(), universe: 'forex-majors', dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns.forex écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que highvol/factor/pead loadStaging).
function loadForexStaging() {
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
// Gates hérités : score gate (min_score) ; stop/tp/rr dérivés de l'ATR (SL=price-2*ATR, TP2=price+3*ATR,
// scanner_forex.go:273-274) — drop si risk ≤ 0. Formatage décimales identique (JPY vs non-JPY).
function evaluateForexCandidate(c, dxyMom30) {
  const drop = reason => ({ sig: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  const m = c.metrics || {};
  const price = num(c.price != null ? c.price : c.entry);
  const score = num(c.score);
  const atr = num(c.atr);
  const rsi = num(m.rsi);
  const atrPct = num(m.atrPct);
  const bbPctB = num(m.bbPctB);
  const ret30d = num(m.ret30d);
  const ret14d = num(m.ret14d);
  const ret7d = num(m.ret7d);
  const momentumScore = num(m.momentumScore);
  const mrScore = num(m.mrScore);
  const rsScore = num(m.rsScore);
  const distMA20 = num(m.distMA20);
  const distMA50 = num(m.distMA50);
  const distMA200 = num(m.distMA200);
  if (!(price > 0) || !Number.isFinite(score) || !(atr > 0)
      || !Number.isFinite(rsi) || !Number.isFinite(atrPct) || !Number.isFinite(bbPctB)
      || !Number.isFinite(ret30d) || !Number.isFinite(ret14d) || !Number.isFinite(ret7d)
      || !Number.isFinite(momentumScore) || !Number.isFinite(mrScore) || !Number.isFinite(rsScore)
      || !Number.isFinite(distMA20) || !Number.isFinite(distMA50) || !Number.isFinite(distMA200))
    return drop('missing_forex_fields');
  // Score gate (scanner_forex.go:255-263) — parité avec la voie locale (config min_score=8).
  if (score < FILTER_MIN_SCORE) return drop('below_min_score');

  // FX prices: 4-5 decimals for non-JPY, 2-3 for JPY crosses. Use price magnitude.
  const dec = price >= 50 ? 3 : 5;
  const entry = +price.toFixed(dec);
  // Stop / take-profit (scanner_forex.go:273-274): SL = price - 2*ATR, TP = price + 3*ATR.
  const stop = +(entry - atr * 2.0).toFixed(dec);
  const risk = entry - stop;
  if (!(risk > 0)) return drop('bad_stop');
  const tp1 = +(entry + risk * 1.5).toFixed(dec);                  // intermediate (1.5R)
  const tp2 = +(entry + atr * 3.0).toFixed(dec);                   // full target (scanner_forex.go:274)
  const rr = ((tp2 - entry) / risk).toFixed(1);

  return {
    sig: {
      ticker,
      name: c.name || ticker,
      score: +score,
      strategy: 'ForexMultiStrategy',
      entry,
      stop,
      tp1,
      tp2,
      rr: `1:${rr}`,
      horizon: Number.isFinite(num(c.horizon)) ? c.horizon : 14,
      region: c.region || 'FOREX',
      sharia: c.sharia != null ? c.sharia : null,
      assetClass: 'forex',
      thesis: `3-axis FX setup: mom ${momentumScore.toFixed(1)}/50 (${ret30d >= 0 ? '+' : ''}${ret30d.toFixed(1)}% 30d / ${ret14d >= 0 ? '+' : ''}${ret14d.toFixed(1)}% 14d / ${ret7d >= 0 ? '+' : ''}${ret7d.toFixed(1)}% 7d), mean-rev ${mrScore.toFixed(1)}/40 (BB%B ${bbPctB.toFixed(2)}, RSI ${rsi.toFixed(0)}), rel-strength ${rsScore.toFixed(1)}/30 vs DXY (${dxyMom30 >= 0 ? '+' : ''}${dxyMom30.toFixed(1)}% 30d).`,
      extension: {
        rsi: +rsi.toFixed(1),
        atr: +atr.toFixed(dec),
        distance_50dma_pct: +(distMA50 * 100).toFixed(1),
      },
      metrics: {
        return30d: +ret30d.toFixed(2),
        return14d: +ret14d.toFixed(2),
        return7d: +ret7d.toFixed(2),
        bbPctB: +bbPctB.toFixed(3),
        atrPct: +(atrPct * 100).toFixed(3),
        momentumScore: +momentumScore.toFixed(2),
        mrScore: +mrScore.toFixed(2),
        rsScore: +rsScore.toFixed(2),
        distance_20dma_pct: +(distMA20 * 100).toFixed(2),
        distance_200dma_pct: +(distMA200 * 100).toFixed(2),
      },
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
    console.error('❌ forex-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (QueryData bars_daily des 8 majors =X + DX-Y.NYB),');
    console.error('   puis : node tools/forex-scanner.js --ingest /tmp/forex-stage.json --output signals --folder YYYYMMDD');
    console.error('   Le fetch Yahoo/query1 + la lecture data/forex-universe.json ont été supprimés (MCP = référence).');
    process.exit(2);
  }

  if (OUTPUT_MODE !== 'signals' && OUTPUT_MODE !== 'stdout' && OUTPUT_MODE !== 'json') {
    console.error(`❌ --output inconnu: ${OUTPUT_MODE} (attendu: signals|stdout|json)`); process.exit(1);
  }

  const staged = loadForexStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging forex indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeForexIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const candidates = data.candidates;
  // dxyMom30 depuis le staging (source MCP : l'agent a lu DX-Y.NYB via QueryData). Absent → 0
  // (rsScore neutre côté agent — EXACTEMENT le comportement « DXY fetch failed » historique).
  const dxyMom30 = Number.isFinite(data.dxyMom30) ? data.dxyMom30 : 0.0;
  const dxySymbol = data.dxySymbol || 'DX-Y.NYB';

  console.log('💱  Forex Multi-Strategy Scanner — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)');
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | minScore: ${MIN_SCORE} | top: ${TOP_N} | DXY: ${dxySymbol}`);
  console.log(`   Date: ${SCAN_DATE} | DXY 30d momentum: ${dxyMom30 ? (dxyMom30 >= 0 ? '+' : '') + dxyMom30.toFixed(2) + '%' : 'N/A (rsScore neutral)'}`);

  console.log('🔍 Scoring 3 axes (momentum 40% / mean-reversion 30% / relative-strength 30%) — gates hérités...');
  const sigs = [];
  const dropStats = {};
  for (const c of candidates) {
    const { sig, reason } = evaluateForexCandidate(c, dxyMom30);
    if (sig) sigs.push(sig);
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }

  // Sort by score desc, tie-break by ticker (scanner_forex.go:85-90)
  sigs.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : 1));
  const topCandidates = sigs.slice(0, TOP_N);

  console.log(`\n✅ Found ${sigs.length} candidates (score≥${FILTER_MIN_SCORE}, valid stop), top ${topCandidates.length}:`);
  for (const c of topCandidates) {
    console.log(
      `  💱 ${c.ticker.padEnd(10)} score:${String(c.score).padStart(6)} ` +
      `30d:${c.metrics.return30d >= 0 ? '+' : ''}${c.metrics.return30d}% ` +
      `mom:${c.metrics.momentumScore} mr:${c.metrics.mrScore} rs:${c.metrics.rsScore} ` +
      `E:${c.entry} S:${c.stop} TP2:${c.tp2} RR:${c.rr} RSI:${c.extension.rsi} BB%B:${c.metrics.bbPctB}`
    );
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return topCandidates; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `forex-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, dxyMom30, dataPath: 'mcp-ingest', candidates: topCandidates }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
    return topCandidates;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // forex_pool — analogous to crypto_pool; consumed downstream by sweep for the forex mode.
    // Fusion NON DESTRUCTIVE, dedup par ticker (identique à la voie locale historique).
    if (!Array.isArray(signals.forex_pool)) signals.forex_pool = [];
    const existing = new Set(signals.forex_pool.map(s => s.ticker));
    let added = 0;
    for (const c of topCandidates) {
      if (existing.has(c.ticker)) continue;
      signals.forex_pool.push(c);
      existing.add(c.ticker);
      added++;
    }
    // Scan marker — proof the forex scanner actually ran (even with 0 signals, which is legitimate).
    // Merged into the shared _scanRuns object (keyed 'forex') without clobbering other scanners.
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.forex = {
      at: new Date().toISOString(),
      universe: 'forex-majors',
      dataPath: 'mcp-ingest',
      candidates: sigs.length,
      signals: topCandidates.length,
      added,
      dxyMom30,
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} forex signals (voie MCP) to forex_pool in ${sigPath}`);
  }

  return topCandidates;
}

// ─── Module exports ──────────────────────────────────────────────────────────
// scoreForexPair conservé + exporté INTACT (logique de signal — parité systematic-tss ; source de
// vérité du scoring que l'AGENT rejoue côté MCP). CLI inchangé quand lancé directement.
module.exports = { main, scoreForexPair };

if (require.main === module) {
  main();
}
