#!/usr/bin/env node
'use strict';

// trendline-scanner.js — Trend Momentum Scanner (faithful port of systematic-tss eu-trend)
//
// Aligned NATIVELY on systematic-tss/internal/engine/scanner_eu_trend.go (Cluster C4 "TREND
// MOMENTUM", the daily-bread trend cluster) + its position manager pm_eu_trend.go. This scanner
// produces the same BUY entry candidates as the Go backtest by replicating its gates and scoring:
//   - >= 200 bars, not a macro symbol, P80 daily $-volume >= threshold (liquidity)
//   - last-bar volume >= 1000
//   - DistMA200 >= 20% (strong uptrend, KEY discriminant)
//   - RSI in [50, 70] (healthy momentum, not overbought)
//   - ATR% in [4%, 12%] (enough vol, not excessive)
//   - additive score (base 50 + DistMA200/RSI/MA-alignment/pullback/ATR%/volume/momentum) >= 50
//   - global VIX gate: skip all entries when VIX > 35 (panic clusters handle it)
// Entry price = last close; stop = price - 2.5xATR; horizon = 25d (Go PM uses trailing, no fixed TP).
//
// articles STAYS INDEPENDENT of systematic-tss: this is a faithful JS re-implementation, it does NOT
// call the Go binary. tools/tss-orders.js is only a dev-time parity comparator.
//
// ─── MCP-PRIMARY (décret archi user 2026-07-12 « le MCP fait foi », cf dtx) ──────────────────────────
// Le SEUL chemin data est la voie MCP (--ingest). Le fetch Yahoo/allorigins + la lecture d'univers local
// (data/{americanbull,forex,metals,etf,eu}-universe.json) ont été RETIRÉS. Le node ne fetch plus rien :
// l'AGENT (claude -p / /scanner) appelle mcp__marketdata__* (RunScreener pour l'univers + QueryData
// bars_daily), applique la MÊME logique de signal trend-momentum (DistMA200/RSI/ATR%/MA-align) et écrit
// un staging JSON ; CE script le PARSE, applique les gates hérités (stop/rr/penny) et construit le pool.
//
// Usage (MCP-primary — --ingest OBLIGATOIRE) :
//   node tools/trendline-scanner.js --ingest /tmp/trendline-stage.json --dry-run
//   node tools/trendline-scanner.js --ingest /tmp/trendline-stage.json --output signals --folder 20260701

const fs = require('fs');
const path = require('path');
// MCP-PRIMARY : plus aucun fetch réseau ni lecture d'univers local. Les indicateurs (SMA/RSI/ATR/…)
// sont calculés par l'AGENT via mcp__marketdata__* et fournis dans le staging — le node ne les recalcule pas.

const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const UNIVERSE_NAME = getArg('universe', 'americanbull');
const MIN_SCORE = parseFloat(getArg('min-score', '50'));   // eu-trend MinScore default = 50
const TOP_N = parseInt(getArg('top', '15'));
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const CONCURRENCY = parseInt(getArg('concurrency', '10'));
const INTERVAL = getArg('interval', '1d'); // 1h, 4h, 1d
// ─── VOIE MCP (--ingest) — SEUL chemin data (modèle EXACT factor/momentum --ingest) ────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache, ni univers local) : il PARSE un staging JSON écrit par
// l'AGENT (qui, LUI, a appelé mcp__marketdata__* — OAuth2, zéro token). --ingest est OBLIGATOIRE ; sans
// lui, le scanner sort en erreur (plus de fallback local — MCP = référence).
const INGEST_PATH = getArg('ingest', null);
// Univers effectif de la voie MCP (résolu depuis le staging dans ingestMain — défaut = --universe).
let INGEST_UNIVERSE = UNIVERSE_NAME;

// ─── Gates hérités (voie --ingest) — mêmes seuils que momentum/pead-scanner / scanner-filters ──
const PENNY_MIN_PRICE = 5;      // penny < $5 rejeté (gate hérité)
const STOP_MIN_PCT = 0.03;      // stop floor 3% absolu (scanner-filters min stop)
const STOP_MAX_PCT = 0.08;      // maxStopPct 8% (modes-config.json)
const STOP_ATR_MULT = 1.5;      // min_atr_multiple 1.5× ATR14 (retro Mar 27)

// ─── tp1/tp2/rr exit model (mirrors data/modes-config.json modes.trendline) ───
// Despite the "no fixed take-profit, trailing only" Go eu-trend comment below, the LIVE
// mode config (modes-config.json v10.3+) sets partialTPGain=10 and disableTP2=false — sweep.js's
// gain-based partial-TP path (`if (partialTPGain > 0 ...)`) fires regardless of the separate
// partialTP=false boolean, so trendline DOES realize 50% at +10% gain and keeps TP2 live.
// The previous tp1=price+atr*3 / stop=price-atr*2.5 formula produced a CONSTANT rr=1.20 for
// every signal (atr cancels out) — the same "uniform R/R" bug as the other 5 scanners, just
// disguised as an ATR formula. Now aligned to the real trigger: tp1 = entry × (1+gain/100).
const PARTIAL_TP_GAIN_PCT = 10; // modes-config.json modes.trendline.partialTPGain

// ── eu-trend (scanner_eu_trend.go) faithful-port thresholds (CLI-overridable) ──
const MIN_DIST_MA200 = parseFloat(getArg('min-dist-ma200', '0.20')); // strong uptrend
const MIN_RSI = parseFloat(getArg('min-rsi', '50'));                 // momentum zone lo
const MAX_RSI = parseFloat(getArg('max-rsi', '70'));                 // momentum zone hi
const MIN_ATR_PCT = parseFloat(getArg('min-atr-pct', '0.04'));       // enough volatility
const MAX_ATR_PCT = parseFloat(getArg('max-atr-pct', '0.12'));       // not excessive
const MIN_P80_DVOL = parseFloat(getArg('min-p80-dvol', '100000'));   // P80 daily $-vol liquidity (US cfg = $100K)
const MAX_VIX = parseFloat(getArg('max-vix', '35'));                 // skip all entries above (panic clusters)

// ─── Region detection ───────────────────────────────────────────────────────

function detectRegion(ticker) {
  if (ticker.includes('=X')) return 'FX';
  if (ticker.startsWith('^') || ticker.includes('=F')) return 'IDX';
  return 'US';
}

// ─── VOIE MCP : --ingest (voie optionnelle data-path MCP, modèle EXACT factor/momentum) ─────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* (RunScreener US + QueryData bars_daily),
// score le trend-momentum comme scoreTicker() (DistMA200/RSI/ATR%/MA-align) et écrit
// /tmp/trendline-stage.json. CE script PARSE le staging (jamais de fetch réseau, jamais d'appel MCP —
// OAuth2, zéro token), applique les gates hérités (stop/rr/penny/sharia) et construit le pool du mode
// (signals.signals[], strategy='TrendlineBreakout') + _scanRuns[...] dans signals.json.
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP, fail-closed) : staging absent / vide / malformé / mcp_ok:false /
// error / candidates non-array → marqueur _scanRuns[...] {incomplete:true, signals:0} + exit 3, RIEN
// fabriqué. Aucun champ manquant/non-fini n'est inventé : le candidat tombe (comme pead/factor/momentum).
//
// Shape staging attendu : { mcp_ok:true, asof, regime?, universe?, universeFetched?,
//   candidates:[ { ticker, name?, score, entry, stop?, sharia?, region?, universe?, horizon?,
//                  metrics:{ distMA200, rsi, atrPct, atr?, volRatio?, maAligned? } } ] }
function normRegime(r) { return String(r || '').toUpperCase().trim(); }
// R/R ≥ 1,5 (RISK-ON/NEUTRAL/RECOVERY) ou ≥ 2,0 (EARLY RISK-OFF/RISK-OFF) — hérité (cf pead/factor/momentum).
function rrThreshold(regime) {
  const r = normRegime(regime);
  return (r === 'RISK-OFF' || r === 'EARLY RISK-OFF') ? 2.0 : 1.5;
}
// Clé _scanRuns : 'trendline' (americanbull) | 'trendline:<universe>' — MÊME convention que la voie locale.
function scanRunKey(universe) { return universe === 'americanbull' ? 'trendline' : `trendline:${universe}`; }
function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeTrendlineIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude trendline.`);
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

// Ingest + validation du staging (mêmes règles fail-closed que pead/factor/momentum loadStaging).
function loadTrendlineStaging() {
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
// rr ≥ seuil régime ; sharia passé tel quel (tag hérité). trendline = trade PAR LIGNE (comme momentum,
// contrairement à factor/rotation) → le stop-band de trade S'APPLIQUE bel et bien.
function evaluateTrendlineCandidate(c, regime) {
  const drop = reason => ({ sig: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  const m = c.metrics || {};
  const entry = num(c.entry);
  const score = num(c.score);
  const distMA200 = num(m.distMA200), rsi = num(m.rsi), atrPct = num(m.atrPct);
  if (!(entry > 0) || !Number.isFinite(score)
      || !Number.isFinite(distMA200) || !Number.isFinite(rsi) || !Number.isFinite(atrPct))
    return drop('missing_trend_fields');
  // Gate penny (< $5).
  if (!(entry >= PENNY_MIN_PRICE)) return drop('penny_under_5');
  // ATR14 : préfère m.atr, sinon dérive de atrPct×entry (aucune invention — atrPct est fourni/validé).
  let atr = num(m.atr);
  if (!(atr > 0)) atr = atrPct * entry;
  if (!(atr > 0)) return drop('no_atr');
  // Gate stop : bande [max(3%, 1.5×ATR14), 8%] (hérité momentum/pead/scanner-filters).
  const minDist = Math.max(entry * STOP_MIN_PCT, STOP_ATR_MULT * atr);
  const maxDist = entry * STOP_MAX_PCT;
  if (minDist > maxDist) return drop('atr_too_wide_for_stop_band'); // 1.5×ATR dépasse le plafond 8%
  const rawStop = num(c.stop);
  let stopDist = Number.isFinite(rawStop) ? entry - rawStop : NaN;
  if (!(stopDist > 0)) stopDist = minDist;
  stopDist = Math.min(Math.max(stopDist, minDist), maxDist);
  const stop = +(entry - stopDist).toFixed(4);
  // tp1/tp2 : modèle partial-TP trendline (même PARTIAL_TP_GAIN_PCT que la voie locale ci-dessus).
  const tp1 = +(entry * (1 + PARTIAL_TP_GAIN_PCT / 100)).toFixed(4);
  const tp2 = +(entry * (1 + (PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(4);
  // Gate rr ≥ seuil régime.
  const rr = +((tp1 - entry) / (entry - stop)).toFixed(2);
  if (rr < rrThreshold(regime)) return drop(`rr_below_${rrThreshold(regime)}`);
  const volRatio = num(m.volRatio);
  const maAligned = m.maAligned === true;
  const region = c.region || detectRegion(ticker);
  return {
    sig: {
      ticker, name: c.name || ticker, score: +score, strategy: 'TrendlineBreakout',
      entry: +entry.toFixed(6), stop: +stop.toFixed(6), tp1, tp2, rr: `1:${rr.toFixed(2)}`,
      horizon: Number.isFinite(num(c.horizon)) ? c.horizon : 25,
      region, universe: c.universe || INGEST_UNIVERSE,
      sharia: c.sharia != null ? c.sharia : null,
      thesis: `Trend momentum: DistMA200 +${(distMA200 * 100).toFixed(0)}%, RSI ${rsi.toFixed(0)}, ATR% ${(atrPct * 100).toFixed(1)}%` +
        (maAligned ? `, MA20>MA50>MA200 aligned` : ''),
      extension: {
        distMA200: +distMA200.toFixed(4), rsi: +rsi.toFixed(1), atrPct: +atrPct.toFixed(4),
        volRatio: Number.isFinite(volRatio) ? +volRatio.toFixed(2) : null, maAligned,
      },
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
  const staged = loadTrendlineStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging trendline indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeTrendlineIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = REGIME || data.regime || 'NEUTRAL';
  const candidates = data.candidates;
  INGEST_UNIVERSE = data.universe || (candidates[0] && candidates[0].universe) || UNIVERSE_NAME;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : candidates.length;

  console.log('📈 Trend-Momentum Scanner — VOIE MCP (--ingest, data-path MCP optionnel)');
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | universe: ${universeFetched} (${INGEST_UNIVERSE})`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime} | rr seuil: ${rrThreshold(regime)} | top: ${TOP_N}`);

  const sigs = [];
  const dropStats = {};
  for (const c of candidates) {
    const { sig, reason } = evaluateTrendlineCandidate(c, regime);
    if (sig) sigs.push(sig);
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }
  // Ordre déterministe : score desc, tie-break ticker asc (identique à la voie locale).
  sigs.sort((a, b) => (b.score - a.score) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));
  const top = sigs.slice(0, TOP_N);

  console.log(`\n✅ ${sigs.length} signaux trendline (gates hérités passés), top ${top.length} :`);
  for (const s of top) {
    console.log(`  ${s.ticker.padEnd(10)} score:${s.score.toFixed(1).padStart(6)} entry:${s.entry} stop:${s.stop} tp1:${s.tp1} R/R:${s.rr}`);
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return top; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `trendline-scan-${INGEST_UNIVERSE}-${SCAN_DATE.replace(/-/g, '')}.json`);
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
    console.log(`\n📁 ${added} signaux trendline ajoutés (voie MCP) dans ${sigPath}`);
  }
  return top;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  // MCP-PRIMARY (décret archi user 2026-07-12 « le MCP fait foi », cf dtx) : la voie MCP (--ingest) est
  // le SEUL chemin data. Plus AUCUN fetch Yahoo/allorigins ni lecture d'univers local — l'AGENT produit
  // le staging (mcp__marketdata__RunScreener + QueryData bars_daily + scoring trend-momentum) et le node
  // le PARSE. Sans --ingest, on sort en erreur (fail-closed, pas de fallback local).
  if (!INGEST_PATH) {
    console.error('❌ trendline est MCP-PRIMARY : --ingest <staging.json> est REQUIS (fetch/univers local retirés — MCP = référence).');
    console.error('   Produire le staging via l\'agent (mcp__marketdata__RunScreener + QueryData bars_daily) puis relancer avec --ingest.');
    process.exit(2);
  }
  ingestMain();
}

main();
