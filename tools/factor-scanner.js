#!/usr/bin/env node
'use strict';

/**
 * factor-scanner.js — Low-turnover multi-factor scanner (SIM-ONLY, US universe). MCP-PRIMARY.
 *
 * Builds a monthly-rebalanced, equal-weight factor portfolio on the US stock universe. Three
 * price-derived factors are z-scored cross-sectionally and summed into a composite; the top-N by
 * composite are held equal-weight and the MONTHLY ROTATION is the exit — there are NO per-name
 * SL/TP in the strategy (same shape as stockbox-scanner.js / IndexRotation). Emits a self-contained
 * `factor_pool` into scanner/YYYYMMDD/signals.json, consumed by sweep.js (assetClass 'us_factor')
 * and rendered on scanner/status like the other scripted modes.
 *
 * ─── FACTORS (computed by the AGENT from real MCP bars — zero fabrication) ────────────────────────
 *   1. momentum_12_1  = adjClose[t-21] / adjClose[t-252] - 1          (Jegadeesh-Titman 12-1,
 *      skips the last month to avoid short-term reversal). Needs >= 253 bars.               [REAL]
 *   2. low_vol        = stdev(daily returns, 120) * sqrt(252)         (6-month realized vol,
 *      annualized). Ranked ASC (less vol = better), so contributes -z(vol).                 [REAL]
 *   3. quality_proxy  = -maxDrawdown(252)                             (a PRICE-BASED robustness
 *      proxy — shallower drawdown = steadier equity = higher "quality" score).              [PROXY]
 *
 *   ⚠️ SCOPE / HONESTY: factor #3 is a *price-based robustness proxy*, NOT the academic
 *   FUNDAMENTAL quality factor (ROE / gross margin / leverage / earnings stability). Fundamental
 *   quality is OUT OF SCOPE for this v1 and left as a documented TODO. We do NOT invent
 *   ROE/margins. See docs/specs/factor-scanners-lowturnover.md §2.1-C.
 *
 * composite(sym) = z(momentum_12_1) + z(-low_vol) + z(quality_proxy)   (equal-weighted z-sum)
 *   • cross-sectional z over the ELIGIBLE universe of the scan (recomputed each rebalance)
 *   • rank composite DESC, tie-break symbol ASC (deterministic, byte-for-byte)
 *   • hold the top-N equal-weight (1/N); rotation IS the exit (no per-name stops)
 *
 * ─── LOW-TURNOVER MECHANICS ─────────────────────────────────────────────────────────────────────
 *   The scan runs daily inside /scanner, but the portfolio only CHANGES on a rebalance day
 *   (every 21 trading days since the mode's statusSince). On non-rebalance days the scanner
 *   RE-EMITS the last committed basket verbatim (rebalance_day:false, holdings frozen) so the
 *   sim doesn't churn the book daily — that is what makes turnover low and tax-efficient.
 *
 * ─── SIM-ONLY BORNE ─────────────────────────────────────────────────────────────────────────────
 *   Output stops at simulation + signals (a factor_pool). NO paper, NO live broker, NO order
 *   execution. Disaster-stop fields (stop = entry×0.75, tp1 far) are INFORMATIONAL only — they
 *   exist so sweep.js can simulate a downstream safety net, they are NOT part of the strategy.
 *
 * ─── VOIE UNIQUE : MCP (décret archi 2026-07-12 « le MCP fait foi ») ──────────────────────────────
 *   Le scanner factor est MCP-PRIMARY : le CHEMIN MCP (--ingest, staging produit par l'AGENT) est
 *   le SEUL chemin data. L'ancienne branche fetch local (Yahoo query1/allorigins) et la lecture
 *   d'univers local (data/tkl-universe.json) ont été RETIRÉES. Ce script NE FETCH RIEN (ni réseau,
 *   ni cache) et NE LIT AUCUN univers local : il PARSE le staging JSON écrit par l'agent — qui, LUI,
 *   a appelé mcp__marketdata__* (RunScreener US + QueryData bars_daily) et calculé le composite.
 *
 *   Pipeline de génération du staging (côté AGENT, PAS ce node) :
 *     RunScreener(region=us, asset=stock, pass_expr="vol>1500000 && close>10", force_async → Jobs)
 *       → univers US énuméré (post-filtre market_cap>=2e9 EN CODE côté agent — JAMAIS market_cap
 *         dans pass_expr, il s'évalue à 0 → 0 candidat silencieux ; cf scanner-pipeline §DSL)
 *     QueryData(types=bars_daily) 5y ajusté → momentum 12-1 + low-vol + maxDD par nom
 *       → l'agent z-score/winsorise le composite sur l'univers ÉLIGIBLE et écrit /tmp/factor-stage.json.
 *
 * Usage:
 *   # l'agent a d'abord écrit /tmp/factor-stage.json via mcp__marketdata__*
 *   node tools/factor-scanner.js --ingest /tmp/factor-stage.json --output signals --folder 20260711
 *   node tools/factor-scanner.js --ingest /tmp/factor-stage.json --dry-run   # aucun fichier écrit
 *   node tools/factor-scanner.js --ingest /tmp/factor-stage.json --output json --date 2026-07-11
 *
 * Codes de sortie : 0 = OK (0 signal légitime inclus) ; 3 = staging absent/vide/malformé/
 * mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 2 = --ingest manquant (voie MCP obligatoire) ;
 * 1 = inattendu.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Strategy params (FIGÉ — the factor definitions are academic, not tuned) ──────────────────
// Only the GUARD-RAILS (topN, disaster-stop) are optimizable (Mountain Plateau); the 252/21
// lookbacks and the factor formulae are NEVER tuned (anti data-snooping — see spec §4). The factor
// math itself runs AGENT-side (MCP bars) and is documented in the header; this node applies the
// downstream gates + basket construction only.
const REBALANCE_DAYS = 21;  // monthly rebalance
const DEFAULT_TOP_N = 15;   // equal-weight lines
const DISASTER_STOP_PCT = 25;     // informational downstream net (NOT a strategy stop)
const FAR_TP_PCT = 50;            // informational far target so sweep buildSetups keeps the row
// Hysteresis buffer (a GUARD-RAIL, not factor tuning): an incumbent is kept as long as it is
// still ranked within topN×BUFFER_MULT; only names that fall out of the buffer zone are sold.
// This is the standard low-turnover lever — it cuts rebalance churn well below the 40% tripwire
// without touching the factor definitions. Free slots are filled by the highest-ranked non-held.
const BUFFER_MULT = 1.5;
const PENNY_MIN_PRICE = 5;   // penny < $5 rejeté (gate hérité, cohérent avec les autres scanners)

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const TOP_N = parseInt(getArg('top', String(DEFAULT_TOP_N)), 10);
const OUTPUT_MODE = getArg('output', 'stdout');
const DRY_RUN = hasFlag('dry-run');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
// ─── VOIE MCP (--ingest) — SEUL chemin data (MCP-PRIMARY) ───────────────────────────────────────
// Le scanner NE FETCH RIEN (ni Yahoo, ni cache) et NE LIT AUCUN univers local : il PARSE un staging
// JSON écrit par l'AGENT (qui, LUI, a appelé mcp__marketdata__*). --ingest est OBLIGATOIRE.
const INGEST_PATH = getArg('ingest', null);
const CLI_REGIME = getArg('regime', null);

// ─── Hysteresis buffer: given the freshly-ranked eligible rows and the previously-held symbols,
// return the top-N to hold. Incumbents still inside the buffer zone (rank < N×BUFFER_MULT) are
// retained first; remaining slots go to the highest-ranked non-incumbents. Deterministic.
function applyBuffer(ranked, prevHold, topN) {
  if (!prevHold || !prevHold.size) return ranked.slice(0, topN);
  const bufferSize = Math.ceil(topN * BUFFER_MULT);
  const bufferZone = new Set(ranked.slice(0, bufferSize).map(r => r.symbol));
  const held = [], fresh = [];
  for (const r of ranked) {
    if (prevHold.has(r.symbol) && bufferZone.has(r.symbol)) held.push(r);
    else fresh.push(r);
  }
  const out = held.slice(0, topN);
  for (const r of fresh) { if (out.length >= topN) break; out.push(r); }
  // Preserve composite order for stable rank labels.
  out.sort((a, b) => (b.composite - a.composite) || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  return out;
}

// Display score in a sane [1,98] band, monotonic with the composite (rank is the real signal).
function displayScore(composite) {
  return Math.max(1, Math.min(98, Math.round(50 + composite * 12)));
}

// Find the most recent prior scanner/*/signals.json with a non-empty factor_pool (for freeze).
function lastCommittedPool(beforeDir) {
  const scanRoot = path.join(ROOT, 'scanner');
  let dirs;
  try { dirs = fs.readdirSync(scanRoot).filter(d => /^\d{8}$/.test(d)); } catch { return null; }
  dirs = dirs.filter(d => d < beforeDir).sort().reverse();
  for (const d of dirs) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(scanRoot, d, 'signals.json'), 'utf8'));
      if (Array.isArray(s.factor_pool) && s.factor_pool.length) return s.factor_pool;
    } catch { /* skip */ }
  }
  return null;
}

// ─── Build the factor_pool objects (rotation = exit; disaster-stop is informational only) ───────
function buildPool(top, weight, rebalanceDay) {
  return top.map((r, i) => {
    const entry = +r.entry.toFixed(2);
    const stop = +(entry * (1 - DISASTER_STOP_PCT / 100)).toFixed(2);
    const tp1 = +(entry * (1 + FAR_TP_PCT / 100)).toFixed(2);
    const rr = +((tp1 - entry) / Math.max(1e-6, entry - stop)).toFixed(2);
    return {
      ticker: r.symbol, name: r.symbol,
      rank: i + 1,
      score: displayScore(r.composite),
      weight,
      strategy: 'FactorComposite', region: 'US', universe: 'factor',
      entry, stop, tp1, tp2: null, rr: `1:${rr.toFixed(2)}`,
      horizon: REBALANCE_DAYS,
      rebalance_day: rebalanceDay,
      sharia: null,
      thesis: `Factor composite rank #${i + 1}: 12-1 mom ${(r.mom * 100).toFixed(1)}%, vol ${(r.vol * 100).toFixed(0)}%, maxDD ${(r.maxDD * 100).toFixed(0)}% — equal-weight, monthly rebalance`,
      extension: {
        composite: +r.composite.toFixed(3),
        momentum_12_1: +r.mom.toFixed(4),
        vol_annualized: +r.vol.toFixed(4),
        max_drawdown: +r.maxDD.toFixed(4),
        rank: i + 1, weight, rebalanceDays: REBALANCE_DAYS,
        factorsReal: ['momentum_12_1', 'low_vol'], factorProxy: ['quality=-maxDD (price-based)'],
      },
    };
  });
}

// ─── VOIE MCP : --ingest (SEUL chemin data) ─────────────────────────────────────────────────────
// L'AGENT (claude -p / /scanner) appelle mcp__marketdata__* :
//   RunScreener(region=us, asset=stock, pass_expr="vol>1500000 && close>10", force_async → Jobs)
//     → univers US énuméré (post-filtre market_cap>=2e9 EN CODE côté agent — JAMAIS market_cap
//       dans pass_expr, il s'évalue à 0 → 0 candidat silencieux ; cf scanner-pipeline §DSL)
//   QueryData(types=bars_daily[,technicals]) 5y ajusté → momentum 12-1 + low-vol + maxDD par nom
//   → l'agent z-score/winsorise le composite sur l'univers ÉLIGIBLE et écrit /tmp/factor-stage.json.
// CE script PARSE le staging (jamais de fetch réseau, jamais d'appel MCP — OAuth2, zéro token),
// applique les gates hérités, et DÉRIVE le pool via buildPool().
//
// ⛔ ZÉRO FABRICATION (MCP HARD STOP) : staging absent / vide / malformé / mcp_ok:false / error →
// marqueur _scanRuns['factor'] {incomplete:true, signals:0} + exit 3, RIEN fabriqué (comme pead).
//
// Gates hérités appliqués :
//   • penny < $5 → rejeté (entry < PENNY_MIN_PRICE)
//   • sharia : tag hérité, passé tel quel (null pour factor, facteurs prix-only)
//   • rr ≥ seuil régime : SANITY — le disaster-stop informationnel donne rr ≡ 2.0 par construction
//     (tp far = entry×1.5, stop = entry×0.75 → 0.5/0.25). Ne droppe jamais un panier sain ; garde-fou.
// ⚠️ NON APPLICABLE à factor — la bande « stop 3-8% & ≥1.5×ATR » : c'est un stop de trade PAR LIGNE
//   (logique PEAD/momentum). factor est une stratégie de ROTATION : la rotation mensuelle EST la
//   sortie, il n'y a AUCUN SL/TP par nom. Le stop = entry×0.75 (25%) est un filet disaster
//   INFORMATIONNEL downstream (sweep), PAS un stop de 3-8%. Le clamper à 3-8% rejetterait TOUT le
//   panier — donc volontairement non appliqué (spec factor-scanners-lowturnover.md + modes-config).
//
// Shape attendu (docs/specs/examples/factor-stage.example.json) :
//   { mcp_ok:true, asof, regime?, universeFetched, universeEligible?, rebalance_day?,
//     candidates:[ { ticker, name?, sector?, market_cap?, sharia?,
//                    momentum_12_1, realized_vol, max_drawdown, composite, entry, rebalance_day? } ] }
function normRegime(r) { return String(r || '').toUpperCase().trim(); }
// R/R ≥ 1,5 (RISK-ON/NEUTRAL/RECOVERY) ou ≥ 2,0 (EARLY RISK-OFF/RISK-OFF) — hérité (cf pead-scanner).
function rrThresholdFor(regime) {
  const r = normRegime(regime);
  return (r === 'RISK-OFF' || r === 'EARLY RISK-OFF') ? 2.0 : 1.5;
}

function resolveSigPathFactor() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}

// MCP HARD STOP : marqueur d'incomplétude sans fabriquer de pool. No-op en dry-run / hors signals.
function writeFactorIncompleteMarker(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPathFactor();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude factor.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.factor = Object.assign({
    at: new Date().toISOString(), universe: 'factor', dataPath: 'mcp-ingest',
    signals: 0, incomplete: true, reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['factor'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// Ingest + validation du staging (mêmes règles fail-closed que pead-scanner.loadStaging).
function loadFactorStaging() {
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

// Un candidat stagé → row {symbol, entry, composite, mom, vol, maxDD, sharia} | null (+ raison drop).
// N'INVENTE aucune donnée : tout champ manquant/non-fini fait tomber le candidat (fail-closed).
function evaluateCandidate(c, regime) {
  const drop = reason => ({ row: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);
  const ticker = c.ticker && String(c.ticker).trim();
  if (!ticker) return drop('no_ticker');
  const entry = num(c.entry);
  const composite = num(c.composite);
  const mom = num(c.momentum_12_1);
  const vol = num(c.realized_vol);
  const maxDD = num(c.max_drawdown);
  if (!(entry > 0) || !Number.isFinite(composite) || !Number.isFinite(mom)
      || !Number.isFinite(vol) || !Number.isFinite(maxDD)) return drop('missing_factor_fields');
  // Gate penny (< $5).
  if (!(entry >= PENNY_MIN_PRICE)) return drop('penny_under_5');
  // Gate rr ≥ seuil régime (sanity : disaster-stop → rr ≡ 2.0 par construction).
  const rr = (entry * (1 + FAR_TP_PCT / 100) - entry) / Math.max(1e-6, entry - entry * (1 - DISASTER_STOP_PCT / 100));
  if (rr < rrThresholdFor(regime)) return drop(`rr_below_${rrThresholdFor(regime)}`);
  return {
    row: {
      symbol: ticker, name: c.name || ticker, entry, composite, mom, vol, maxDD,
      sharia: c.sharia != null ? c.sharia : null,
    },
    reason: null,
  };
}

// Branche --ingest : parse le staging, applique les gates, DÉRIVE le pool via buildPool(), écrit
// factor_pool + _scanRuns['factor'] (fusion non destructive).
function ingestMain() {
  const staged = loadFactorStaging();
  if (!staged.ok) {
    console.error(`⛔ Staging factor indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeFactorIncompleteMarker(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }
  const data = staged.data;
  const regime = CLI_REGIME || data.regime || 'NEUTRAL';
  const candidates = data.candidates;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : candidates.length;
  // rebalance_day : honore le flag calculé par l'agent (top-level ou 1er candidat), défaut true (bootstrap).
  const rebalanceDay = (typeof data.rebalance_day === 'boolean')
    ? data.rebalance_day
    : (candidates[0] && typeof candidates[0].rebalance_day === 'boolean' ? candidates[0].rebalance_day : true);

  console.log('🧮 Factor Scanner — VOIE MCP (--ingest, MCP-PRIMARY, seul chemin data)');
  console.log(`   Staging: ${INGEST_PATH} | candidates: ${candidates.length} | universe: ${universeFetched} | eligible: ${data.universeEligible ?? 'n/a'}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime} | rr seuil: ${rrThresholdFor(regime)} | ${rebalanceDay ? 'REBALANCE' : 'frozen'}`);

  const rows = [];
  const dropStats = {};
  const shariaBySym = new Map();
  for (const c of candidates) {
    const { row, reason } = evaluateCandidate(c, regime);
    if (row) { rows.push(row); shariaBySym.set(row.symbol, row.sharia); }
    else dropStats[reason] = (dropStats[reason] || 0) + 1;
  }
  // Ordre déterministe : composite desc, symbole asc (comme applyBuffer).
  rows.sort((a, b) => (b.composite - a.composite) || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));

  // Mécaniques low-turnover (identiques à l'ancienne voie locale — aucune logique de signal changée) :
  //   • FREEZE (jour non-rebalance) : ré-émet le dernier panier committé verbatim (rebalance_day=false)
  //     — sinon le merge dedup-append ferait CROÎTRE le panier au lieu de le tenir (churn silencieux).
  //   • HYSTÉRÉSIS (jour rebalance) : applyBuffer garde les incumbents dans la buffer-zone (turnover < 40%).
  // lastCommittedPool lit les signals.json antérieurs (métadonnée PIT locale, PAS un fetch data).
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  const prior = lastCommittedPool(scanDir);

  let pool, top;
  if (!rebalanceDay && prior && prior.length) {
    // Jour frozen : hold verbatim. Aucun nouveau nom, aucun churn.
    top = [];
    pool = prior.map(p => ({ ...p, rebalance_day: false, dataPath: 'mcp-ingest' }));
    console.log(`   Frozen : ${pool.length} positions tenues verbatim (dernier panier committé, aucun rebalance).`);
  } else {
    // Jour rebalance (ou bootstrap sans prior) : hystérésis vs dernier panier, puis buildPool.
    const prevHold = new Set((prior || []).map(p => p.ticker));
    top = applyBuffer(rows, prevHold, TOP_N);
    const weight = +(1 / Math.max(1, top.length)).toFixed(4);
    // DÉRIVE le pool via buildPool(), puis ré-applique le tag sharia hérité du staging (buildPool
    // force null par défaut).
    pool = buildPool(top, weight, true).map(p => ({
      ...p,
      sharia: shariaBySym.has(p.ticker) ? shariaBySym.get(p.ticker) : null,
      dataPath: 'mcp-ingest',
    }));
  }

  if (top.length) {
    const w = pool[0] ? pool[0].weight : 0;
    console.log(`\n✅ ${top.length} lignes factor retenues (equal-weight ${(w * 100).toFixed(1)}%) sur ${candidates.length} candidats :`);
    top.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.symbol.padEnd(6)} comp:${r.composite.toFixed(2).padStart(6)}  mom:${(r.mom * 100).toFixed(1).padStart(6)}%  vol:${(r.vol * 100).toFixed(0).padStart(3)}%  maxDD:${(r.maxDD * 100).toFixed(0).padStart(3)}%`));
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return pool; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `factor-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, topN: TOP_N, rebalanceDays: REBALANCE_DAYS, rebalanceDay, dataPath: 'mcp-ingest', candidates: pool }, null, 2));
    console.log(`\n📁 Écrit dans ${outPath}`);
    return pool;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPathFactor();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} introuvable`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // Fusion NON DESTRUCTIVE, dedup par ticker (modèle pead_pool) : on préserve le reste du fichier
    // (autres pools + _scanRuns) et on n'écrase pas les lignes factor déjà présentes du même ticker.
    if (!Array.isArray(signals.factor_pool)) signals.factor_pool = [];
    const existing = new Set(signals.factor_pool.map(s => s.ticker));
    let added = 0;
    for (const p of pool) {
      if (existing.has(p.ticker)) continue;
      signals.factor_pool.push(p);
      existing.add(p.ticker);
      added++;
    }
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.factor = {
      at: new Date().toISOString(), universe: 'factor', dataPath: 'mcp-ingest',
      rebalanceDay, universeFetched, candidates: rows.length, signals: pool.length, added,
      regime, incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 ${added} lignes factor ajoutées à factor_pool (${rebalanceDay ? 'rebalance' : 'frozen'}, voie MCP) dans ${sigPath}`);
  }
  return pool;
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────
function main() {
  // MCP-PRIMARY : --ingest (staging agent→MCP) est le SEUL chemin data. Il n'y a plus de fallback
  // local (Yahoo + univers local retirés — décret archi 2026-07-12). Sans --ingest → erreur claire.
  if (!INGEST_PATH) {
    console.error('❌ factor-scanner est MCP-PRIMARY : --ingest <staging.json> est OBLIGATOIRE.');
    console.error('   L\'agent doit d\'abord écrire le staging via mcp__marketdata__* (RunScreener US + QueryData bars_daily),');
    console.error('   puis : node tools/factor-scanner.js --ingest /tmp/factor-stage.json --output signals --folder YYYYMMDD');
    process.exit(2);
  }
  ingestMain();
}

main();
