#!/usr/bin/env node
'use strict';

/**
 * stockbox-scanner.js — StockBox Nasdaq index-rotation scanner (ISO port of systematic-tss).
 * MCP-PRIMARY.
 *
 * Reproduces engine.IndexRotationStrategy (internal/engine/strategy_index_rotation.go),
 * config config/portfolio_stockbox_nasdaq.yaml: the WH SelfInvest "Stock-Box Nasdaq" =
 * top-8 momentum Nasdaq-100 names, equal-weight, MONTHLY rebalance (21 trading days).
 *
 * WHAT THIS DOES (exact ISO of computeRanking + top-K selection)
 * -------------------------------------------------------------
 *   momentum(sym) = px[last] / px[last - lookback] - 1     (lookback = 84 trading bars)
 *   • skip "^..." index / vol tickers, skip symbols outside the NDX-100 whitelist, skip px<=0
 *   • rank momentum DESC, tie-break symbol ASC (deterministic — byte-for-byte the Go comparator)
 *   • hold the top-K (rotation_top_k = 8); rotation_abs_filter = 0 → the box ALWAYS holds 8,
 *     pure momentum RANK (no momentum>0 cash filter)
 * The strategy has NO per-name stops — rotation IS the exit (a name leaving the top-8 is sold
 * at the next monthly rebalance). So emitted signals carry entry + rank + weight, NOT SL/TP.
 *
 * Total-return parity: the Go reference ranks on TOTAL_RETURN=1 (dividend-adjusted) closes, so
 * the AGENT computes the 84d momentum on dividend-adjusted closes (QueryData bars_daily
 * adjusted=true) and writes it into the staging. `entry` is the raw last close (the tradable
 * order price). For the high-momentum semis that dominate the box adj vs raw are within rounding,
 * but adjusted is the faithful choice for the ranking.
 *
 * ─── VOIE UNIQUE : MCP (décret archi 2026-07-12 « le MCP fait foi ») ──────────────────────────────
 *   Le scanner stockbox est MCP-PRIMARY : le CHEMIN MCP (--ingest, staging produit par l'AGENT) est
 *   le SEUL chemin data. L'ancienne branche fetch local (Yahoo query1/allorigins + cache daté
 *   tools/lib/price-cache) a été RETIRÉE. Ce script NE FETCH RIEN (ni réseau, ni cache) : il PARSE
 *   le staging JSON écrit par l'agent — qui, LUI, a appelé mcp__marketdata__* (QueryData bars_daily
 *   ajusté sur la whitelist NDX-100) et calculé le momentum 84j par nom.
 *
 *   La WHITELIST NDX-100 (ISO de portfolio_stockbox_nasdaq.yaml) reste inlinée : elle ne sert PLUS à
 *   fetcher (l'agent choisit les noms) mais de GARDE-FOU d'intégrité — un candidat stagé hors
 *   whitelist est rejeté (le box ne détient QUE des membres du Nasdaq-100). Purge différée (phase
 *   suivante) — c'est une constante interne, aucun consommateur externe.
 *
 *   Pipeline de génération du staging (côté AGENT, PAS ce node) :
 *     WHITELIST NDX-100 (ci-dessous, ISO du yaml)
 *       → QueryData(types=bars_daily, adjusted=true, end_date=SCAN_DATE, >= lookback+1 barres)
 *         point-in-time (anti-look-ahead) par nom
 *       → momentum84 = adjClose[last] / adjClose[last-84] - 1 ; entry = raw close[last]
 *       → écrit /tmp/stockbox-stage.json.
 *   CE script PARSE le staging (jamais de fetch, jamais d'appel MCP — OAuth2, zéro token), applique
 *   le comparateur déterministe + la sélection top-K, et DÉRIVE le pool.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/stockbox-stage.json via mcp__marketdata__*
 *   node tools/stockbox-scanner.js --ingest /tmp/stockbox-stage.json --output signals --folder 20260711
 *   node tools/stockbox-scanner.js --ingest /tmp/stockbox-stage.json --dry-run          # rien écrit
 *   node tools/stockbox-scanner.js --ingest /tmp/stockbox-stage.json --output json --date 2026-07-11
 *
 * Codes de sortie : 0 = OK (0 signal légitime inclus) ; 3 = staging absent/vide/malformé/
 * mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ;
 * 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Strategy params — kept in sync (MANUALLY) with systematic-tss config ────
// Source of truth: systematic-tss/config/portfolio_stockbox_nasdaq.yaml
//   scanner_filters.params.rotation_lookback_days = 84   (optimizer-validated plateau)
//   scanner_filters.params.rotation_top_k         = 8    (the box holds exactly 8)
//   scanner_filters.params.rotation_rebalance_days = 21  (monthly rebalance)
//   scanner_filters.params.rotation_abs_filter    = 0    (always 8, momentum RANK only)
// articles stays INDEPENDENT of the Go engine — these are copied values, not a call.
const LOOKBACK_DAYS = 84;
const TOP_K = 8;
const REBALANCE_DAYS = 21;
const ABS_FILTER = false; // rotation_abs_filter = 0 → hold 8 regardless of sign

// Nasdaq-100 whitelist (2026 membership) — copied VERBATIM from
// portfolio_stockbox_nasdaq.yaml portfolios[0].allocations[0].whitelist. Do NOT invent.
// MCP-PRIMARY : ne sert PLUS à fetcher (l'agent stage les barres via mcp__marketdata__) — c'est le
// GARDE-FOU d'intégrité (un candidat stagé hors whitelist est rejeté). Purge différée (phase suivante).
const WHITELIST = 'NVDA,AAPL,MSFT,AMZN,AVGO,META,GOOGL,GOOG,TSLA,NFLX,COST,PLTR,ASML,CSCO,AMD,TMUS,AZN,LIN,INTU,PEP,ISRG,BKNG,ADBE,QCOM,TXN,AMGN,GILD,HON,CMCSA,AMAT,PANW,ADP,VRTX,MU,ADI,LRCX,MELI,KLAC,SBUX,INTC,CRWD,MDLZ,CTAS,CEG,CDNS,ORLY,MAR,SNPS,PYPL,MRVL,REGN,FTNT,DASH,ADSK,WDAY,MNST,NXPI,ROP,AEP,TTD,CPRT,PCAR,CHTR,PAYX,ROST,KDP,FANG,ODFL,FAST,EA,BKR,VRSK,CTSH,EXC,XEL,CCEP,GEHC,KHC,LULU,DDOG,TTWO,IDXX,CSGP,ANSS,ON,ZS,BIIB,ARM,MDB,GFS,WBD,ILMN,DXCM,MCHP,SMCI,STX,SNDK,ALAB,NBIS'
  .split(',').map(s => s.trim()).filter(Boolean);
const UNIVERSE = Array.from(new Set(WHITELIST)); // dedupe (GOOGL/GOOG both present, but distinct)
const WHITELIST_SET = new Set(UNIVERSE);

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const TOP_N = parseInt(getArg('top', String(TOP_K)), 10);
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
// ─── VOIE MCP (--ingest) — SEUL chemin data (MCP-PRIMARY) ───────────────────────────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache) : il PARSE un staging JSON écrit par l'AGENT (qui,
// LUI, a appelé mcp__marketdata__*). --ingest est OBLIGATOIRE.
const INGEST_PATH = getArg('ingest', null);

// ─── computeRanking — EXACT ISO of strategy_index_rotation.go computeRanking ─
// Opère désormais sur les candidats STAGÉS (momentum calculé par l'agent depuis les barres MCP
// ajustées) au lieu de barres locales — mais la LOGIQUE de tri/sélection est identique :
// momentum desc, tie-break symbole asc (byte-for-byte le comparateur Go), skip ^index / px<=0 /
// hors-whitelist. Aucune donnée n'est inventée : un champ manquant/non-fini fait tomber le nom.
function computeRanking(rows) {
  const ranked = [];
  for (const r of rows) {
    if (!r || !r.symbol) continue;
    if (r.symbol.startsWith('^')) continue;         // index / vol ticker, not investable
    if (!WHITELIST_SET.has(r.symbol)) continue;      // garde-fou : le box ne tient QUE des membres NDX-100
    if (!Number.isFinite(r.momentum)) continue;      // pas de momentum → skip (fail-closed)
    if (!(r.entry > 0)) continue;                    // px<=0 / manquant → skip
    ranked.push({ symbol: r.symbol, momentum: r.momentum, entry: r.entry, asOf: r.asOf || null });
  }
  // Deterministic: momentum desc, then symbol asc as tie-break (byte-for-byte the Go comparator).
  ranked.sort((a, b) => {
    if (a.momentum !== b.momentum) return b.momentum - a.momentum;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
  return ranked;
}

// ─── Build the pool objects (rotation = exit; NO per-name stops) ───────────────
function buildPool(targetList, weight) {
  return targetList.map((r, i) => ({
    ticker: r.symbol, name: r.symbol,
    rank: i + 1,
    score: +(r.momentum * 100).toFixed(2), // momentum % = the ranking score
    momentum: +r.momentum.toFixed(4),
    entry: +r.entry.toFixed(2),
    weight,
    stop: null, tp1: null, tp2: null, rr: 'n/a', // no per-name stops — rotation IS the exit
    horizon: REBALANCE_DAYS, region: 'US', universe: 'stockbox',
    strategy: 'IndexRotation', sharia: null,
    dataPath: 'mcp-ingest',
    thesis: `StockBox top-${TOP_N} rank #${i + 1}: 84d total-return momentum +${(r.momentum * 100).toFixed(1)}%, equal-weight, monthly rebalance`,
    extension: { momentum84: +r.momentum.toFixed(4), rank: i + 1, weight, lookbackDays: LOOKBACK_DAYS, rebalanceDays: REBALANCE_DAYS },
  }));
}

function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeStockboxIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude stockbox.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.stockbox = Object.assign({
    at: new Date().toISOString(), universe: 'stockbox', dataPath: 'mcp-ingest',
    ranked: 0, signals: 0, added: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['stockbox'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que factor-scanner.loadFactorStaging).
function loadStockboxStaging() {
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

// Un candidat stagé → row {symbol, momentum, entry, asOf} | null. N'INVENTE aucune donnée : tout
// champ manquant/non-fini fait tomber le candidat (fail-closed). Accepte momentum|momentum84.
function normalizeCandidate(c) {
  if (!c) return null;
  const symbol = c.ticker && String(c.ticker).trim();
  if (!symbol) return null;
  const momentum = Number.isFinite(c.momentum) ? c.momentum
    : (Number.isFinite(c.momentum84) ? c.momentum84 : NaN);
  const entry = Number.isFinite(c.entry) ? c.entry : NaN;
  return { symbol, momentum, entry, asOf: c.asOf || null };
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  // MCP-PRIMARY : --ingest (staging agent→MCP) est le SEUL chemin data. Il n'y a plus de fallback
  // local (Yahoo + cache daté retirés — décret archi 2026-07-12). Sans --ingest → erreur claire.
  if (!INGEST_PATH) {
    console.error('❌ stockbox-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (QueryData bars_daily ajusté sur la whitelist NDX-100),');
    console.error('   puis : node tools/stockbox-scanner.js --ingest /tmp/stockbox-stage.json --output signals --folder YYYYMMDD');
    process.exit(2);
  }

  console.log('📦 StockBox Nasdaq Scanner (index-rotation, systematic-tss port) — VOIE MCP (--ingest, MCP-PRIMARY)');

  const staged = loadStockboxStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging stockbox indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeStockboxIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const candidates = data.candidates;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : candidates.length;

  console.log(`   Univers whitelist: ${UNIVERSE.length} NDX names | lookback: ${LOOKBACK_DAYS}d | top-${TOP_N} | rebalance: ${REBALANCE_DAYS}d`);
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | universe: ${universeFetched}`);
  console.log(`   Date: ${SCAN_DATE} | abs_filter: ${ABS_FILTER ? 'on' : 'off (always holds K)'}`);

  const rows = candidates.map(normalizeCandidate).filter(Boolean);

  console.log('🔍 Ranking by relative strength (84d total-return momentum)...');
  const ranked = computeRanking(rows);
  if (!ranked.length) {
    console.error('❌ Aucun candidat rankable dans le staging (0 momentum valide / hors whitelist) — RIEN fabriqué.');
    writeStockboxIncompleteMarker('no_rankable_candidates', { ingestPath: INGEST_PATH, candidates: candidates.length });
    process.exit(3);
  }

  // Top-K selection. rotation_abs_filter = 0 → no momentum>0 gate (box always holds K).
  const targetList = [];
  for (const r of ranked) {
    if (targetList.length >= TOP_N) break;
    if (ABS_FILTER && r.momentum <= 0) continue; // slot stays in cash (OFF for stockbox)
    targetList.push(r);
  }

  const weight = +(1 / TOP_N).toFixed(4); // equal-weight

  console.log(`\n✅ Ranked ${ranked.length} names, holding top ${targetList.length} (equal-weight ${(weight * 100).toFixed(1)}%):`);
  targetList.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${r.symbol.padEnd(6)} mom84: ${(r.momentum * 100).toFixed(2).padStart(7)}%  px:${r.entry.toFixed(2)}`);
  });

  const pool = buildPool(targetList, weight);

  if (DRY_RUN) { console.log('\n🏷️  Dry run — no files written.'); return pool; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `stockbox-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      scanDate: SCAN_DATE, strategy: 'index-rotation', lookbackDays: LOOKBACK_DAYS,
      topK: TOP_N, rebalanceDays: REBALANCE_DAYS, universeSize: UNIVERSE.length,
      ranked: ranked.length, dataPath: 'mcp-ingest', candidates: pool,
    }, null, 2));
    console.log(`\n📁 Written to ${outPath}`);
    return pool;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} not found`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // Dedicated pool — self-contained top-8 targets (the box's holdings for this rebalance).
    signals.stockbox_pool = pool;

    // Also expose in the shared signals[] array for listing/visibility (dedup by ticker).
    const existing = new Set((signals.signals || []).map(s => s.ticker));
    if (!signals.signals) signals.signals = [];
    let added = 0;
    for (const p of pool) {
      if (existing.has(p.ticker)) continue;
      signals.signals.push({
        ticker: p.ticker, name: p.ticker, score: p.score, strategy: 'IndexRotation',
        entry: p.entry, stop: p.stop, tp1: p.tp1, tp2: p.tp2, rr: p.rr,
        horizon: p.horizon, region: p.region, universe: p.universe,
        sharia: null, thesis: p.thesis, extension: p.extension,
      });
      existing.add(p.ticker);
      added++;
    }

    // Scan marker — proof the stockbox scanner ran for this date (even with 0 signals).
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.stockbox = {
      at: new Date().toISOString(),
      universe: 'stockbox',
      dataPath: 'mcp-ingest',
      ranked: ranked.length,
      signals: pool.length,
      added,
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Wrote stockbox_pool (${pool.length}) + appended ${added} signals to ${sigPath}`);
  }

  return pool;
}

main();
