#!/usr/bin/env node
'use strict';

/**
 * pead-scanner.js — Brique 1 (PEAD / Post-Earnings Announcement Drift), VOIE B (INGEST).
 *
 * Spec autoritaire : docs/specs/event-driven-scanners.md §2.1 + §3.1. SCOPE DUR : SIM-ONLY.
 * La seule sortie est un pool de signaux + perf simulée en aval (signals.json → sweep.js →
 * gen-status-page → gen-api). AUCUN ordre, AUCUN appel broker/sim (rb_paper_* / rb_live_* / sim_* ),
 * AUCUN concept paper/live/deploying/liquidated. Promotion draft→test→sim-live(=live) SEULEMENT.
 *
 * ─── VOIE B : pourquoi ce script ne fetch RIEN de propriétaire ─────────────────────────────────
 * Les données PEAD (EPS/guidance/gap/filings/Form 4) sont PROPRIÉTAIRES → accessibles UNIQUEMENT via
 * le MCP mcp__marketdata__*. Or un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token
 * en .env — règle mcp-only-data-path). Donc le câblage est, comme le refresh dtx :
 *
 *   AGENT (claude -p / /scanner) appelle mcp__marketdata__* :
 *     GetEarningsCalendarFiltered(days_ahead=7, min_expected_move_pct=4, include_implied_move=true)
 *     QueryData(earnings_quarterly / analyst_actions,financials / technicals,bars_daily,vwap /
 *               unusual_options / sec_filings,flags)  + GetMarketContext(facets="regime")
 *   → l'AGENT extrait par ticker les champs normalisés → écrit /tmp/pead-stage.json
 *     → node tools/pead-scanner.js --ingest /tmp/pead-stage.json --output signals ...
 *       → CE script PARSE le JSON stagé, applique la logique PEAD, écrit pead_pool + _scanRuns['pead'].
 *
 * ⛔ ZÉRO FABRICATION (MCP HARD STOP). Ce script n'invente jamais de donnée financière. Si le staging
 * est absent / vide / malformé / mcp_ok:false → il écrit _scanRuns['pead'] avec signals:0 + un flag
 * d'incomplétude, ne fabrique RIEN, et sort en code non-zéro (le pipeline alerte). Le shape attendu du
 * staging est documenté ci-dessous et par l'exemple docs/specs/examples/pead-stage.example.json.
 *
 * ─── Shape attendu du staging (docs/specs/examples/pead-stage.example.json) ─────────────────────
 * {
 *   "mcp_ok": true,                 // false ⇒ l'étape MCP de l'agent a échoué → run marqué incomplet
 *   "regime": "RISK-ON",            // régime global (sinon --regime) ; pilote seuil R/R + bonus score
 *   "regimeScore": 84,
 *   "asof": "2026-07-13",
 *   "universeFetched": 62,          // taille de l'univers earnings scanné par l'agent (preuve de run)
 *   "prints": [ {                   // un objet par ticker ayant imprimé un résultat
 *     "ticker","name","sector","market",        // market: 'us'|'eu' (défaut 'us')
 *     "print_date","sessions_since_print",       // ≤3 séances requis
 *     "eps_actual","eps_est","rev_actual","rev_est",
 *     "guidance_raised",            // bool — discriminant #1 (analyst_actions/financials)
 *     "beats_streak",               // int  — beats consécutifs (earnings_quarterly)
 *     "prev_close","open_print","close_now","high_gap_day","low_gap_day",
 *     "vol_print","avgvol20",
 *     "ema20","atr14","ext_ema20",  // ext_ema20 = extension % au-dessus EMA20
 *     "resistance_preprint","nearest_resistance","vwap","open_Dp1_est",
 *     "call_skew",                  // bool — flux options haussier (bonus, pas éliminatoire)
 *     "days_until_next_earnings",
 *     "sharia",                     // true|false|null (tag conformité, hérité)
 *     "dilution": { "dilution_risk_score", "atm_active", "shelf_active", "disqualify", "reason" }
 *   } ]
 * }
 *
 * ─── Logique node (spec §2.1 pseudo-code) ───────────────────────────────────────────────────────
 * pour chaque print ≤3 séances :
 *   drop si !(eps_actual>eps_est) || !guidance_raised || gap<3 || close_now<mid_gap
 *        || vol_print<1.5×avgvol20 || ext_ema20>8 || days_until_next_earnings<holdDays
 *        || dilution.disqualify
 *   score = 60 + beats_streak*4 + (guidance?10:0) + (call_skew?6:0) + regime_bonus - dilution_penalty  (cap 98)
 *   entry = min(open_Dp1_est, vwap) ; stop = min(low_gap_day, entry*0.95) clampé 3–8% & ≥1.5×ATR14
 *   tp1 = nearest_resistance ; rr = (tp1-entry)/(entry-stop) ; drop si rr < seuil_regime
 *   émettre {strategy:'PEAD', source:'pead_pool', market, catalyst:{...}}
 *
 * ─── Sortie ─────────────────────────────────────────────────────────────────────────────────────
 * Écrit `pead_pool` (fusion non destructive, dedup par ticker) + `_scanRuns['pead']` dans
 * scanner/YYYYMMDD/signals.json. Convention DURE (gen-status-page.signalsFor) : assetClass:"pead" ⇒
 * source:"pead_pool". Le pool N'EST PAS mergé dans signals[] (mode dédié, comme forex/crypto).
 *
 * Usage :
 *   node tools/pead-scanner.js --ingest /tmp/pead-stage.json --output signals \
 *     --date 20260713 --folder 20260713 --regime RISK-ON --top 10
 *   node tools/pead-scanner.js --ingest /tmp/pead-stage.json --dry-run        # aucun fichier écrit
 *
 * Codes de sortie : 0 = OK (y compris 0 signal légitime) ; 2 = usage/args ; 3 = staging
 * absent/vide/malformé/mcp_ok:false (run marqué incomplet, RIEN fabriqué) ; 1 = erreur inattendue.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_MAX_SCORE = 98;   // score_limits.max_score (data/scanner-filters.json) — jamais 100.
const STOP_MIN_PCT = 0.03;      // stop_loss floor 3% absolu (scanner-filters min stop)
const STOP_MAX_PCT = 0.08;      // maxStopPct 8% (modes-config.json modes.pead)
const STOP_ATR_MULT = 1.5;      // min_atr_multiple 1.5 (scanner-filters — Mar 27 retro)
const VOL_CONFIRM_MULT = 1.5;   // volume de confirmation ≥ 1.5× avgvol20
const GAP_MIN_PCT = 3;          // gap tenu ≥ +3%
const EXT_EMA20_MAX = 8;        // drift encore devant : extension EMA20 ≤ ~8%
const PENNY_MIN_PRICE = 5;      // penny < $5 rejeté (gate hérité)
const DEFAULT_HOLD_DAYS = 12;   // horizon PEAD (modes-config.json modes.pead.horizon)

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const INGEST_PATH = getArg('ingest', null);
const OUTPUT_MODE = getArg('output', 'stdout');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const CLI_REGIME = getArg('regime', null);
const TOP_N = parseInt(getArg('top', '10'), 10);
const HOLD_DAYS = parseInt(getArg('horizon', String(DEFAULT_HOLD_DAYS)), 10);
const MIN_SCORE = parseFloat(getArg('min-score', '0'));  // 0 = pas de gate ici (le mode minScore gate en sweep)
const DRY_RUN = hasFlag('dry-run');

// ─── Regime helpers (spec §2.1 : seuil R/R + bonus de score par régime) ─────────────────────────
function normRegime(r) {
  return String(r || '').toUpperCase().trim();
}
// R/R ≥ 1,5 (RISK-ON/NEUTRAL/RECOVERY) ou ≥ 2,0 (EARLY RISK-OFF/RISK-OFF).
function rrThreshold(regime) {
  const r = normRegime(regime);
  return (r === 'RISK-OFF' || r === 'EARLY RISK-OFF') ? 2.0 : 1.5;
}
// Un beat en régime hostile drift moins → pénalité ; en régime porteur → bonus.
function regimeBonus(regime) {
  switch (normRegime(regime)) {
    case 'RISK-ON': return 4;
    case 'RECOVERY': return 2;
    case 'NEUTRAL': return 0;
    case 'EARLY RISK-OFF': return -4;
    case 'RISK-OFF': return -8;
    default: return 0;
  }
}
// Pénalité de dilution graduée depuis flags.dilution_risk_score (0-100). disqualify=true droppe avant.
function dilutionPenalty(dil) {
  const s = dil && Number.isFinite(dil.dilution_risk_score) ? dil.dilution_risk_score : 0;
  if (s >= 60) return 20;
  if (s >= 40) return 12;
  if (s >= 25) return 6;
  return 0;
}

// ─── Marker writer (preuve de run + incomplétude) ───────────────────────────────────────────────
// Écrit _scanRuns['pead'] dans signals.json sans clobber les autres scanners. En dry-run ou si le
// fichier n'existe pas → no-op silencieux (mais retourne l'état pour le log/exit). JAMAIS de pool
// fabriqué : sur incomplet, signals:0 + incomplete:true.
function resolveSigPath() {
  const scanDir = SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
  return path.join(ROOT, 'scanner', scanDir, 'signals.json');
}
function writeMarkerOnly(reason, extra) {
  if (DRY_RUN || OUTPUT_MODE !== 'signals') return false;
  const sigPath = resolveSigPath();
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur d'incomplétude.`);
    return false;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.pead = Object.assign({
    at: new Date().toISOString(),
    signals: 0,
    universeFetched: 0,
    incomplete: true,
    reason,
  }, extra || {});
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
  console.error(`⚠️  Marqueur _scanRuns['pead'] écrit (incomplete=true, reason="${reason}") dans ${sigPath}`);
  return true;
}

// ─── Ingest + validation du staging ─────────────────────────────────────────────────────────────
function loadStaging() {
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
  // MCP hard-stop : l'agent signale explicitement l'échec de son étape MCP.
  if (data.mcp_ok === false) return { ok: false, reason: 'mcp_ok_false' };
  if (data.error) return { ok: false, reason: `staging_error:${String(data.error).slice(0, 120)}` };
  if (!Array.isArray(data.prints)) return { ok: false, reason: 'ingest_no_prints_array' };
  return { ok: true, data };
}

// ─── Cœur PEAD : un print → signal | null (avec raison de drop) ──────────────────────────────────
function evaluatePrint(p, regime) {
  const drop = reason => ({ signal: null, reason });
  const num = v => (Number.isFinite(v) ? v : NaN);

  const ticker = p.ticker && String(p.ticker).trim();
  if (!ticker) return drop('no_ticker');

  // Fenêtre : print ≤ 3 séances.
  if (Number.isFinite(p.sessions_since_print) && p.sessions_since_print > 3) return drop('print_too_old');

  // 1. Beat EPS (actual > estimate).
  if (!(num(p.eps_actual) > num(p.eps_est))) return drop('no_eps_beat');
  // 2. Guidance relevée (discriminant #1).
  if (!p.guidance_raised) return drop('no_guidance_raised');

  // 3. Gap tenu.
  const prevClose = num(p.prev_close), openPrint = num(p.open_print), closeNow = num(p.close_now);
  if (!(prevClose > 0) || !(openPrint > 0) || !(closeNow > 0)) return drop('missing_price_fields');
  const gap = (openPrint / prevClose - 1) * 100;
  if (gap < GAP_MIN_PCT) return drop(`gap_below_${GAP_MIN_PCT}`);
  const midGap = (prevClose + openPrint) / 2;
  if (closeNow < midGap) return drop('gap_refermé'); // close < mid-gap = gap refermé

  // 4. Volume de confirmation ≥ 1.5× avgvol20.
  const volPrint = num(p.vol_print), avgvol20 = num(p.avgvol20);
  if (!(avgvol20 > 0) || !(volPrint >= VOL_CONFIRM_MULT * avgvol20)) return drop('vol_below_1.5x');

  // 6. Drift encore devant : extension EMA20 ≤ ~8%.
  if (num(p.ext_ema20) > EXT_EMA20_MAX) return drop(`ext_ema20_above_${EXT_EMA20_MAX}`);

  // 5. Pas de re-print imminent dans la fenêtre de hold.
  if (Number.isFinite(p.days_until_next_earnings) && p.days_until_next_earnings < HOLD_DAYS) {
    return drop('earnings_reprint_within_hold');
  }

  // Anti-dilution (offering post-résultats = disqualifiant).
  const dil = p.dilution || {};
  if (dil.disqualify === true) return drop('dilution_disqualify');

  // ─── Niveaux ────────────────────────────────────────────────────────────────
  const vwap = num(p.vwap);
  if (!(vwap > 0)) return drop('no_vwap');
  const openDp1 = num(p.open_Dp1_est);
  const entry = Number.isFinite(openDp1) && openDp1 > 0 ? Math.min(openDp1, vwap) : vwap;
  if (!(entry >= PENNY_MIN_PRICE)) return drop('penny_under_5');

  const atr14 = num(p.atr14);
  if (!(atr14 > 0)) return drop('no_atr');
  const lowGap = num(p.low_gap_day);
  const rawStop = Math.min(Number.isFinite(lowGap) && lowGap > 0 ? lowGap : entry * 0.95, entry * 0.95);
  // Clamp distance ∈ [max(3%, 1.5×ATR), 8%]. Conflit 1.5×ATR > 8% ⇒ trop volatil → drop.
  const minDist = Math.max(entry * STOP_MIN_PCT, STOP_ATR_MULT * atr14);
  const maxDist = entry * STOP_MAX_PCT;
  if (minDist > maxDist) return drop('atr_too_wide_for_stop_band'); // 1.5×ATR dépasse le plafond 8%
  let stopDist = entry - rawStop;
  if (!(stopDist > 0)) stopDist = minDist;
  stopDist = Math.min(Math.max(stopDist, minDist), maxDist);
  const stop = +(entry - stopDist).toFixed(4);

  // tp1 = prochaine résistance. tp2 = mesure du gap (2× le gain tp1) pour cohérence order-form.
  const tp1 = num(p.nearest_resistance);
  if (!(tp1 > entry)) return drop('no_valid_resistance');
  const rr = +((tp1 - entry) / (entry - stop)).toFixed(2);
  if (rr < rrThreshold(regime)) return drop(`rr_below_${rrThreshold(regime)}`);
  const tp2 = +(entry + 2 * (tp1 - entry)).toFixed(2);

  // ─── Score (cap 98) ──────────────────────────────────────────────────────────
  const beatsStreak = Number.isFinite(p.beats_streak) ? Math.max(0, p.beats_streak) : 0;
  let score = 60
    + beatsStreak * 4
    + (p.guidance_raised ? 10 : 0)
    + (p.call_skew ? 6 : 0)
    + regimeBonus(regime)
    - dilutionPenalty(dil);
  score = Math.max(0, Math.min(SCANNER_MAX_SCORE, Math.round(score)));

  const market = (p.market === 'eu') ? 'eu' : 'us';
  const gapStr = `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%`;
  const detailBits = [
    'EPS beat',
    'guidance up',
    `gap ${gapStr} tenu`,
    p.call_skew ? 'call skew' : null,
    beatsStreak >= 5 ? `${beatsStreak} beats consécutifs` : null,
  ].filter(Boolean);

  const signal = {
    ticker,
    name: p.name || ticker,
    score,
    strategy: 'PEAD',
    source: 'pead_pool',
    market,
    region: market === 'eu' ? 'EU' : 'US',
    sector: p.sector || null,
    entry: +entry.toFixed(2),
    stop: +stop.toFixed(2),
    tp1: +tp1.toFixed(2),
    tp2,
    rr: `1:${rr.toFixed(2)}`,
    horizon: HOLD_DAYS,
    sharia: p.sharia != null ? p.sharia : null,
    catalyst: {
      type: 'earnings_beat',
      date: p.print_date || (SCAN_DATE.length === 8
        ? `${SCAN_DATE.slice(0, 4)}-${SCAN_DATE.slice(4, 6)}-${SCAN_DATE.slice(6, 8)}`
        : SCAN_DATE),
      detail: detailBits.join(', '),
    },
    thesis: `PEAD ${ticker}: ${detailBits.join(', ')}. Drift post-earnings, entrée ${entry.toFixed(2)} (min open D+1/VWAP), stop ${stop.toFixed(2)}, R/R ${rr.toFixed(2)}.`,
    extension: {
      gap_pct: +gap.toFixed(2),
      ext_ema20: Number.isFinite(p.ext_ema20) ? +p.ext_ema20.toFixed(2) : null,
      vol_ratio: +(volPrint / avgvol20).toFixed(2),
      beats_streak: beatsStreak,
      dilution_risk_score: Number.isFinite(dil.dilution_risk_score) ? dil.dilution_risk_score : null,
    },
  };
  return { signal, reason: null };
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────
function main() {
  if (OUTPUT_MODE !== 'signals' && OUTPUT_MODE !== 'stdout' && OUTPUT_MODE !== 'json') {
    console.error(`❌ --output inconnu: ${OUTPUT_MODE} (attendu: signals|stdout|json)`);
    process.exit(2);
  }

  const staged = loadStaging();
  if (!staged.ok) {
    // MCP HARD STOP : jamais de fabrication. Marqueur d'incomplétude + exit non-zéro (le pipeline alerte).
    console.error(`⛔ Staging PEAD indisponible/invalide (reason="${staged.reason}"). RIEN fabriqué.`);
    writeMarkerOnly(staged.reason, { ingestPath: INGEST_PATH || null });
    process.exit(3);
  }

  const data = staged.data;
  const regime = CLI_REGIME || data.regime || 'NEUTRAL';
  const prints = data.prints;
  const universeFetched = Number.isFinite(data.universeFetched) ? data.universeFetched : prints.length;

  console.log('📊 PEAD Scanner (Brique 1 — earnings-drift, VOIE B ingest)');
  console.log(`   Staging: ${INGEST_PATH} | prints: ${prints.length} | universe: ${universeFetched}`);
  console.log(`   Date: ${SCAN_DATE} | Regime: ${regime} | R/R seuil: ${rrThreshold(regime)} | hold: ${HOLD_DAYS}j`);

  const emitted = [];
  const dropStats = {};
  for (const p of prints) {
    const { signal, reason } = evaluatePrint(p, regime);
    if (signal) {
      if (signal.score >= MIN_SCORE) emitted.push(signal);
      else dropStats.min_score = (dropStats.min_score || 0) + 1;
    } else {
      dropStats[reason] = (dropStats[reason] || 0) + 1;
    }
  }

  emitted.sort((a, b) => b.score - a.score);
  const top = emitted.slice(0, TOP_N);

  console.log(`\n✅ ${emitted.length} signaux PEAD émis (top ${top.length}) sur ${prints.length} prints :`);
  for (const s of top) {
    console.log(`   ${s.ticker.padEnd(6)} score:${String(s.score).padStart(3)} entry:${s.entry} stop:${s.stop} tp1:${s.tp1} R/R:${s.rr}  ${s.catalyst.detail}`);
  }
  if (Object.keys(dropStats).length) {
    console.log('   drops:', Object.entries(dropStats).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return; }

  if (OUTPUT_MODE === 'json') {
    const outPath = path.join(ROOT, 'data', `pead-scan-${SCAN_DATE}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ scanDate: SCAN_DATE, regime, universeFetched, signals: top }, null, 2));
    console.log(`\n📁 Écrit dans ${outPath}`);
    return;
  }

  if (OUTPUT_MODE === 'signals') {
    const sigPath = resolveSigPath();
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} introuvable`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
    // pead_pool — modèle EXACT de forex_pool : source-tagué, fusion non destructive, dedup par ticker.
    // JAMAIS mergé dans signals[] (mode dédié). Convention DURE : source==='pead_pool' (assetClass 'pead').
    if (!Array.isArray(signals.pead_pool)) signals.pead_pool = [];
    const existing = new Set(signals.pead_pool.map(s => s.ticker));
    let added = 0;
    for (const s of top) {
      if (existing.has(s.ticker)) continue;
      signals.pead_pool.push(s);
      existing.add(s.ticker);
      added++;
    }
    // Marqueur de preuve de run (0 signal = légitime ; marqueur absent = crash silencieux côté qa-check).
    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.pead = {
      at: new Date().toISOString(),
      universeFetched,
      candidates: emitted.length,
      signals: top.length,
      added,
      regime,
      incomplete: false,
    };
    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 ${added} signaux PEAD ajoutés à pead_pool dans ${sigPath}`);
  }
}

try {
  main();
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
