#!/usr/bin/env node
'use strict';

/**
 * pit-backfill.js — Phase D PoC harness: point-in-time historical re-scan + track record.
 *
 * ⚠️  ISOLATED BACKFILL — DOES NOT TOUCH ANY SEALED STATE.
 *     - Reads ONLY from data/.price-cache/*_ohlcv.json (never writes to it).
 *     - Writes signals ONLY into a SEPARATE namespace (default data/pit-backfill/).
 *     - NEVER writes to real scanner/YYYYMMDD/ folders, backtest-results.json,
 *       backtest-trades.json, or trade-chain.json.
 *     - Comparison-only vs the Go scorecard. Nothing here can flip a mode draft→test.
 *
 * WHAT IT PROVES (Phase D loop, end-to-end, ONE mode = highvol, SHORT window):
 *   1. Re-run the highvol scanner in point-in-time for each trading day D of the window,
 *      using the EXACT scoring (require'd from highvol-scanner.js) against bars ≤ D and the
 *      established-liquidity $3M gate. No look-ahead: signals scored on close(≤D) are filed
 *      under the NEXT session and entered at that session's OPEN (mirrors the real pipeline
 *      "folder = prochaine séance" convention — see feedback_scanner_date.md).
 *   2. Feed those backfilled scans through the EXACT trade mechanics (require'd from
 *      pit-engine.js: openPosition / stepPosition / computePnl / buildCandidates) to build a
 *      backfilled track record for highvol over the window.
 *   3. Report return / maxDD / WR / #trades and compare DIRECTIONALLY to the Go scorecard.
 *
 * ZERO network fetch: the in-memory priceCache is seeded directly from the local *_ohlcv.json
 * arrays (bypassing sweep's shallow 12h-gated ${ticker}.json cache which is only ~120d deep
 * and mostly absent for this universe).
 *
 * Usage:
 *   node tools/pit-backfill.js --mode highvol --days 90
 *   node tools/pit-backfill.js --mode highvol --from 2026-02-24 --to 2026-07-02 --verbose
 */

const fs = require('fs');
const path = require('path');

const hv = require('./highvol-scanner.js');       // EXACT scoring (scoreSymbol + gates + constants)
const pe = require('./pit-engine.js');             // EXACT trade mechanics (open/step/pnl/candidates)
const sweep = require('./sweep.js');               // priceCache (by ref), regime/vix/corr helpers
const { calcSMA, calcDollarVolumePercentile } = require('./lib/fractal-indicators');
const ms = require('./lib/mode-status');

const ROOT = path.dirname(__dirname);
const CACHE_DIR = path.join(ROOT, 'data', '.price-cache');

// ─── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const hasFlag = n => argv.includes(`--${n}`);
const MODE_ID = getArg('mode', 'highvol');
const DAYS = parseInt(getArg('days', '90'), 10);
const FROM = getArg('from', null);
const TO = getArg('to', null);
const OUT_DIR = path.resolve(getArg('out-dir', path.join(ROOT, 'data', 'pit-backfill')));
// --config override (validation only): point at an isolated temp modes-config to A/B the
// entry model (vwapGate vs limit_markup) without mutating the real data/modes-config.json.
const CONFIG_PATH = path.resolve(getArg('config', path.join(ROOT, 'data', 'modes-config.json')));
const VERBOSE = hasFlag('verbose');
const log = (...a) => VERBOSE && console.log(...a);

if (MODE_ID !== 'highvol') {
  console.error(`PoC only supports --mode highvol (got ${MODE_ID}).`);
  process.exit(1);
}

// Namespace guard: refuse to write anywhere near the real scanner/ tree.
if (OUT_DIR.includes(`${path.sep}scanner${path.sep}`) || path.basename(OUT_DIR) === 'scanner') {
  console.error(`Refusing out-dir inside the real scanner/ tree: ${OUT_DIR}`);
  process.exit(1);
}

// ─── Load config + universe ────────────────────────────────────────────────
const cfgFile = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const CFG = (cfgFile.modes || cfgFile)[MODE_ID];
if (!CFG) { console.error(`No config for mode ${MODE_ID}`); process.exit(1); }
const TOP_N = CFG.topN || CFG.portfolioSize || 15;
const MIN_SCORE = CFG.minScore || 50;
const universe = hv.loadUniverse();

// ─── Regime label from PIT VIX (CLAUDE.md convention) ────────────────────────
// <15 Risk-On · 15-20 Neutral · 20-28 Early Risk-Off · >28 Risk-Off.
// Labels chosen so sweep's regimeSizeMultiplier / vixKillTriggered / normalizeRegime
// all resolve them correctly ("Early Risk-Off" -> "EARLY RISK-OFF" / "early_risk_off").
function regimeFromVix(vix) {
  if (vix <= 0) return 'Neutral';
  if (vix < 15) return 'Risk-On';
  if (vix < 20) return 'Neutral';
  if (vix < 28) return 'Early Risk-Off';
  return 'Risk-Off';
}

// ─── Scanner VIX cluster gate (mirror highvol-scanner.js main lines ~353-381) ─
// Returns true if the day is GATED (no signals at all).
function vixClusterGated(vixLevel, vixTrend, regime) {
  const regimeUp = (regime || '').toUpperCase().replace(/[- ]/g, '_');
  if (regimeUp === 'RISK_OFF') return true;
  if (vixLevel > hv.MAX_VOLATILITY_INDEX) return true;                        // >28
  if (vixLevel >= 18 && vixLevel < 22 && vixTrend !== 'stable') return true;
  if (vixLevel >= 15 && vixLevel < 18 && vixTrend === 'falling') return true;
  if (vixLevel > 0 && vixLevel < 15 && vixTrend === 'rising') return true;
  if (vixLevel >= 22 && vixLevel < 30 && vixTrend === 'falling') return true;
  if (regimeUp.includes('RECOVERY') && vixLevel >= 18 && vixLevel < 22) return true;
  return false;
}

// ─── Load *_ohlcv.json (array w/ volume) + seed sweep.priceCache (date-keyed) ─
console.log(`Loading local OHLCV cache for ${universe.length} tickers (zero fetch)...`);
const barsArr = {};   // ticker -> [{date,open,high,low,close,volume}] ascending
let loaded = 0, missing = 0;
for (const t of universe) {
  const fp = path.join(CACHE_DIR, `${t}_ohlcv.json`);
  if (!fs.existsSync(fp)) { missing++; continue; }
  try {
    const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!Array.isArray(arr) || arr.length < 60) { missing++; continue; }
    barsArr[t] = arr;
    // Seed sweep's module-scope priceCache (date-keyed) so pit-engine mechanics run
    // against local bars with ZERO network fetch.
    const dk = {};
    for (const b of arr) if (b && b.date) dk[b.date] = { open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    sweep.priceCache[t] = dk;
    loaded++;
  } catch { missing++; }
}
console.log(`  loaded ${loaded} tickers, ${missing} missing/thin.`);

// VIX calendar + series
const vixArr = (() => {
  for (const f of ['^VIX', '_VIX', 'VIX']) {
    const fp = path.join(CACHE_DIR, `${f}_ohlcv.json`);
    if (fs.existsSync(fp)) { try { const a = JSON.parse(fs.readFileSync(fp, 'utf8')); if (Array.isArray(a) && a.length) return a; } catch {} }
  }
  return null;
})();
if (!vixArr) { console.error('No VIX cache — cannot derive regime. HARD STOP.'); process.exit(1); }
const vixByDate = {};
for (const b of vixArr) vixByDate[b.date] = b.close;
const calendar = vixArr.map(b => b.date).sort();   // trading sessions

// ─── Window selection ─────────────────────────────────────────────────────
// Decisions on session D (scored on bars ≤ D); entry filed under the NEXT session.
let endIdx = calendar.length - 1;
if (TO) { const i = calendar.lastIndexOf(TO); if (i >= 0) endIdx = i; else { const j = calendar.findIndex(d => d > TO); endIdx = j > 0 ? j - 1 : endIdx; } }
let startIdx;
if (FROM) { const i = calendar.findIndex(d => d >= FROM); startIdx = i >= 0 ? i : Math.max(0, endIdx - DAYS); }
else startIdx = Math.max(0, endIdx - DAYS);
// decision days need a following session for entry → cap at endIdx-1
const decisionDays = calendar.slice(startIdx, endIdx);        // each has a next session
const windowLabel = `${decisionDays[0]} → ${calendar[endIdx]} (${decisionDays.length} decision sessions)`;
console.log(`PoC window: ${windowLabel}`);

// VIX PIT helpers
function vixAsOf(day) {
  const idx = calendar.indexOf(day);
  if (idx < 0) return { level: 0, trend: 'stable' };
  const level = vixByDate[day] || 0;
  const closes = [];
  for (let i = Math.max(0, idx - 13); i <= idx; i++) closes.push({ close: vixByDate[calendar[i]] || 0 });
  const sma14 = calcSMA(closes, Math.min(14, closes.length));
  let trend = 'stable';
  if (sma14 > 0) { const r = level / sma14; if (r < 0.90) trend = 'falling'; else if (r > 1.10) trend = 'rising'; }
  return { level, trend };
}

// ─── STEP 1+2: PIT re-scan per decision day, file under next session ─────────
const scanByEntryDate = new Map();   // entryDate(=next session) -> { scanDate, regime, setups }
const scanRunLog = [];               // per-day diagnostics
const nextSession = day => { const i = calendar.indexOf(day); return i >= 0 && i + 1 < calendar.length ? calendar[i + 1] : null; };

console.log(`\nSTEP 1/2 — point-in-time re-scan (${MODE_ID}) ...`);
for (const D of decisionDays) {
  const entryDay = nextSession(D);
  if (!entryDay) continue;
  const { level: vixLevel, trend: vixTrend } = vixAsOf(D);
  const regime = regimeFromVix(vixLevel);
  const dNorm = D.replace(/-/g, '');

  let candidates = [];
  const gated = vixClusterGated(vixLevel, vixTrend, regime);
  if (!gated) {
    for (const t of universe) {
      if (hv.BLACKLIST.has(t)) continue;
      if (!hv.passesSectorMcap(t)) continue;
      const raw = barsArr[t];
      if (!raw) continue;
      // Truncate to ≤ D (exact cutIdx logic from highvol-scanner main)
      const cutIdx = raw.findIndex(b => b.date.replace(/-/g, '') > dNorm);
      const bars = cutIdx > 0 ? raw.slice(0, cutIdx) : (raw[raw.length - 1].date.replace(/-/g, '') <= dNorm ? raw : []);
      if (!bars.length) continue;
      // P80 $5M liquidity + established-median $3M gate (point-in-time, bars already ≤ D)
      if (calcDollarVolumePercentile(bars, 20, 0.80) < hv.MIN_P80_DOLLAR_VOLUME) continue;
      if (hv.MIN_ESTABLISHED_DOLLAR_VOLUME > 0) {
        if (bars.length < hv.ESTABLISHED_LOOKBACK) continue;
        if (calcDollarVolumePercentile(bars, hv.ESTABLISHED_LOOKBACK, 0.50) < hv.MIN_ESTABLISHED_DOLLAR_VOLUME) continue;
      }
      const r = hv.scoreSymbol(bars, regime, vixLevel, vixTrend);
      if (!r || r.score < MIN_SCORE) continue;
      const risk = r.entry - r.stop;
      if (risk <= 0) continue;
      const tp1 = +(r.entry * (1 + hv.PARTIAL_TP_GAIN_PCT / 100)).toFixed(2);
      const tp2 = +(r.entry * (1 + (hv.PARTIAL_TP_GAIN_PCT * 2) / 100)).toFixed(2);
      const rr = +((tp1 - r.entry) / risk).toFixed(2);
      candidates.push({
        ticker: t, name: t, score: r.score, strategy: 'HighVolBreakout',
        entry: +r.entry.toFixed(2), stop: +r.stop.toFixed(2), tp1, tp2, rr: `1:${rr.toFixed(2)}`,
        horizon: CFG.horizon || 14, region: 'US', universe: 'americanbull',
        thesis: `HV score ${r.score}: ATR%=${(r.atrPct * 100).toFixed(1)}%, DistMA20=${(r.distMA20 * 100).toFixed(1)}%, VolR=${r.volRatio}, RSI=${r.rsi.toFixed(0)}`,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    candidates = candidates.slice(0, TOP_N);
  }

  // Write signals.json into the ISOLATED backfill namespace (format = scanner signals.json).
  const folder = entryDay.replace(/-/g, '');
  const dir = path.join(OUT_DIR, 'scans', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'signals.json'), JSON.stringify({
    _backfill: true, _isolated: 'Phase-D PoC — NOT a real scan', decisionDate: D, scanDate: entryDay,
    regime, vix: { level: +vixLevel.toFixed(2), trend: vixTrend },
    signals: candidates,
    _scanRuns: { highvol: { at: new Date().toISOString(), universe: 'americanbull', signals: candidates.length, gated } },
  }, null, 2));

  // Build internal setups (mirror sweep.parseScan buildSetups for source='signals').
  const setups = candidates.map(c => ({
    ticker: c.ticker, strategy: 'highvol_breakout', score: c.score,
    entry: c.entry, stop: c.stop, tp1: c.tp1, tp2: c.tp2,
    source: 'signals', universe: 'americanbull',
  })).filter(s => s.entry > 0 && s.stop > 0 && s.stop < s.entry && s.tp1 > s.entry);

  scanByEntryDate.set(entryDay, { scanDate: entryDay, regime, setups });
  scanRunLog.push({ decision: D, entry: entryDay, vix: +vixLevel.toFixed(1), trend: vixTrend, regime, gated, signals: candidates.length });
  if (VERBOSE) log(`  ${D} vix=${vixLevel.toFixed(1)}/${vixTrend} regime=${regime} gated=${gated} signals=${candidates.length}`);
  else process.stdout.write(`  scanned ${scanRunLog.length}/${decisionDays.length}\r`);
}
process.stdout.write('\n');

const totalSignals = scanRunLog.reduce((s, r) => s + r.signals, 0);
const gatedDays = scanRunLog.filter(r => r.gated).length;
console.log(`  ${scanRunLog.length} sessions scanned · ${gatedDays} VIX-gated · ${totalSignals} total signal-slots emitted.`);

// ─── STEP 3: consume scans → track record (EXACT pit-engine mechanics) ───────
// Reproduces the pit-engine day loop for the SINGLE highvol mode. highvol config has
// rotation='none' + crossModeDedup=false + status=draft(statusSince future) so the loop
// reduces to: step open positions (+circuit breaker) → open new entries from today's scan
// (status/VIX/DD/CB gates + inverse-ATR sizing) → mark-to-market. All per-trade math
// (openPosition/stepPosition/computePnl/buildCandidates) is the real pit-engine code.
console.log(`\nSTEP 3 — consume backfilled scans → highvol track record ...`);
const cfg = CFG;
const mode = { id: MODE_ID, cfg };
const state = { positions: [], closedTrades: [], equityCurve: [], cooldown: {}, cbStopDates: [], cbPauseUntil: null };

// Entry-model diagnostics (limit_markup only): count fills vs no-fills (gap-up above the cap).
// Read-only — does NOT touch trade mechanics. A no-fill = the whole J+1 bar traded above the
// limit price, so pit-engine.openPosition returned null and the slot fell through.
let fillCount = 0, noFillCount = 0;
const markupPct = (cfg.limitMarkupPct != null) ? cfg.limitMarkupPct : 2.5;

const entryDays = calendar.slice(startIdx + 1, endIdx + 1);   // sessions on which entries/MtM happen
const statusSinceDay = (cfg.statusSince || '').slice(0, 10);
const cfgStatus = ms.isValidState(cfg.status) ? cfg.status : ms.DEFAULT_STATE;

for (const day of entryDays) {
  // 1. Step open positions
  const stillOpen = [];
  for (const pos of state.positions) {
    if (pos.entryDate >= day) { stillOpen.push(pos); continue; }
    const bar = sweep.priceCache[pos.ticker]?.[day];
    const res = pe.stepPosition(pos, day, bar, cfg);
    if (res === 'closed') {
      pos.pnlPct = pe.computePnl(pos, cfg);
      state.closedTrades.push(pos);
      const cd = pe.cooldownDaysForStatus(pos.status);
      if (cd > 0) state.cooldown[pos.ticker] = { exitDate: day, days: cd };
      const cbBase = (pos.status || '').replace(/_amb$/, '');
      if (cbBase === 'sl' && (cfg.circuitBreakerStops || 0) > 0) {
        state.cbStopDates.push(day);
        const winStart = pe.addBizDays(day, -(cfg.circuitBreakerWindow || 5));
        if (state.cbStopDates.filter(d => d >= winStart).length >= cfg.circuitBreakerStops) {
          state.cbPauseUntil = pe.addBizDays(day, cfg.circuitBreakerPause || 3);
        }
      }
    } else stillOpen.push(pos);
  }
  state.positions = stillOpen;

  // 2. Scan today → open new entries
  const scan = scanByEntryDate.get(day);
  if (scan && scan.setups.length) {
    const candidates = pe.buildCandidates({ setups: scan.setups, tklPool: [], regime: scan.regime }, mode, day, cfg);
    let slots = (cfg.portfolioSize || 1) - state.positions.length;

    const statusActiveOnDay = !statusSinceDay || day >= statusSinceDay;
    const statusHalt = statusActiveOnDay && !ms.acceptsNewEntries(cfgStatus);
    const vixKill = sweep.vixKillTriggered(scan.regime, cfg.vixKillThreshold);
    let ddBreaker = false;
    if (cfg.ddBreakerPct && state.equityCurve.length >= 2) {
      let peak = 100;
      for (let i = 0; i < state.equityCurve.length - 1; i++) if (state.equityCurve[i].value > peak) peak = state.equityCurve[i].value;
      const priorClose = state.equityCurve[state.equityCurve.length - 1].value;
      const dd = peak > 0 ? ((peak - priorClose) / peak) * 100 : 0;
      ddBreaker = dd > cfg.ddBreakerPct;
    }
    const cbHalt = !!(state.cbPauseUntil && day <= state.cbPauseUntil);

    if (statusHalt || vixKill || ddBreaker || cbHalt) {
      log(`  ${day} HALT (status=${statusHalt} vixKill=${vixKill} dd=${ddBreaker} cb=${cbHalt})`);
    } else {
      const regimeMult = (cfg.vixKillSwitch !== false) ? sweep.regimeSizeMultiplier(scan.regime) : 1;
      const baseWeight = (1 / (cfg.portfolioSize || 1)) * (cfg.positionSizePct || 1) * regimeMult;
      const SIZING_REF = 0.03;
      const openTickers = new Set(state.positions.map(p => p.ticker));
      const sectorCounts = {};
      for (const p of state.positions) { const s = sweep.getSector(p.ticker); sectorCounts[s] = (sectorCounts[s] || 0) + 1; }
      let added = 0;
      for (const cand of candidates) {
        if (added >= slots) break;
        if (openTickers.has(cand.ticker)) continue;
        const cd = state.cooldown[cand.ticker];
        if (cd && pe.bizDaysBetween(cd.exitDate, day) < cd.days) continue;
        if (cfg.sectorCapMax) { const s = sweep.getSector(cand.ticker); if ((sectorCounts[s] || 0) >= cfg.sectorCapMax) continue; }
        if (cfg.correlationCap > 0 && state.positions.length > 0) {
          const openPseudo = state.positions.map(p => ({ trade: { ticker: p.ticker } }));
          const rho = sweep.maxCorrToOpen({ ticker: cand.ticker }, openPseudo, 60);
          if (rho != null && Math.abs(rho) > cfg.correlationCap) continue;
        }
        let weight = baseWeight;
        if (cfg.sizingMethod === 'inverse_atr' && cand.entry > 0 && cand.stop > 0) {
          const stopPct = (cand.entry - cand.stop) / cand.entry;
          if (stopPct > 0) weight = baseWeight * Math.max(0.5, Math.min(1.5, SIZING_REF / Math.max(stopPct, 0.005)));
        }
        const pos = pe.openPosition(cand, day, day, cfg);
        if (!pos) {
          // limit_markup diagnostic: classify a null as a genuine no-fill (whole J+1 bar
          // above the cap) vs an ordinary gate reject (rr<1.5, stop, etc.).
          if (cfg.entryModel === 'limit_markup') {
            const b = sweep.priceCache[cand.ticker]?.[day];
            const limitPrice = cand.entry * (1 + markupPct / 100);
            if (b && b.low > limitPrice) { noFillCount++; log(`  ${day} NO-FILL ${cand.ticker} (low ${b.low.toFixed(2)} > limit ${limitPrice.toFixed(2)})`); continue; }
          }
          log(`  ${day} reject ${cand.ticker} (gate)`); continue;
        }
        if (cfg.entryModel === 'limit_markup') fillCount++;
        pos.weight = weight;
        state.positions.push(pos);
        openTickers.add(cand.ticker);
        const s = sweep.getSector(cand.ticker); sectorCounts[s] = (sectorCounts[s] || 0) + 1;
        log(`  ${day} ENTER ${cand.ticker} @ ${pos.entryPrice.toFixed(2)} w=${weight.toFixed(3)}`);
        added++;
      }
    }
  }

  // 3. Mark-to-market equity
  const defaultWeight = (1 / (cfg.portfolioSize || 1)) * (cfg.positionSizePct || 1);
  let realized = 0;
  for (const t of state.closedTrades) realized += (t.pnlPct || 0) * (t.weight ?? defaultWeight);
  let unrealized = 0;
  for (const pos of state.positions) {
    if (pos.entryDate > day) continue;
    const close = sweep.priceCache[pos.ticker]?.[day]?.close;
    if (close && pos.entryPrice > 0) unrealized += ((close - pos.entryPrice) / pos.entryPrice) * 100 * (pos.weight ?? defaultWeight);
  }
  state.equityCurve.push({ date: day, value: +(100 + realized + unrealized).toFixed(2), realized: +realized.toFixed(2), unrealized: +unrealized.toFixed(2) });
}

// ─── Summary stats (identical to pit-engine summary block) ───────────────────
const ec = state.equityCurve;
const ret = ec.length ? ec[ec.length - 1].value - 100 : 0;
let peak = 100, maxDD = 0;
for (const p of ec) { if (p.value > peak) peak = p.value; const dd = (peak - p.value) / peak * 100; if (dd > maxDD) maxDD = dd; }
const RESOLVED = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'breakeven', 'trail', 'rotated'];
const resolved = state.closedTrades.filter(t => RESOLVED.includes((t.status || '').replace(/_amb$/, '')));
const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
const wr = resolved.length ? wins.length / resolved.length * 100 : 0;
const gw = wins.reduce((s, t) => s + t.pnlPct, 0);
const gl = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
const pf = gl > 0 ? gw / gl : (gw > 0 ? 99 : 0);
let sharpe = 0;
if (ec.length > 2) {
  const dr = [];
  for (let i = 1; i < ec.length; i++) { const a = ec[i - 1].value, b = ec[i].value; if (a > 0) dr.push((b - a) / a); }
  const mean = dr.reduce((s, r) => s + r, 0) / dr.length;
  const variance = dr.reduce((s, r) => s + (r - mean) ** 2, 0) / (dr.length - 1);
  const sd = Math.sqrt(variance);
  if (sd > 0) sharpe = Math.sqrt(252) * mean / sd;
}

const nSessions = ec.length;
const cagr = nSessions > 1 ? (Math.pow(1 + ret / 100, 252 / nSessions) - 1) * 100 : 0;

const summary = {
  mode: MODE_ID, window: windowLabel, sessions: nSessions,
  ret: +ret.toFixed(2), cagrAnnualized: +cagr.toFixed(1), maxDD: +(-maxDD).toFixed(2),
  wr: +wr.toFixed(1), pf: +pf.toFixed(2), sharpe: +sharpe.toFixed(2),
  trades: resolved.length, openAtEnd: state.positions.length,
  entryModel: cfg.entryModel || 'vwap_gate',
  limitMarkupPct: cfg.entryModel === 'limit_markup' ? markupPct : null,
  fills: cfg.entryModel === 'limit_markup' ? fillCount : null,
  noFills: cfg.entryModel === 'limit_markup' ? noFillCount : null,
  scan: { decisionSessions: scanRunLog.length, vixGatedSessions: gatedDays, totalSignalSlots: totalSignals },
};

fs.writeFileSync(path.join(OUT_DIR, 'highvol-backfill-results.json'), JSON.stringify({ summary, equityCurve: ec, scanRunLog, trades: resolved.map(t => ({ ticker: t.ticker, entryDate: t.entryDate, exitDate: t.exitDate, entryPrice: t.entryPrice, exitPrice: t.exitPrice, status: t.status, pnlPct: t.pnlPct, weight: t.weight })) }, null, 2));

console.log('\n=== HIGHVOL BACKFILL (PoC, isolated) ===');
console.log(`window       : ${windowLabel}`);
console.log(`sessions     : ${nSessions}`);
console.log(`return       : ${summary.ret}%  (annualized ~${summary.cagrAnnualized}% CAGR)`);
console.log(`maxDD        : ${summary.maxDD}%`);
console.log(`WR / PF      : ${summary.wr}% / ${summary.pf}`);
console.log(`sharpe       : ${summary.sharpe}`);
console.log(`trades       : ${summary.trades} resolved (+${summary.openAtEnd} open at window end)`);
console.log(`entryModel   : ${summary.entryModel}${cfg.entryModel === 'limit_markup' ? ` (markup ${markupPct}% · fills=${fillCount} · no-fills=${noFillCount})` : ''}`);
console.log(`scan         : ${scanRunLog.length} sessions, ${gatedDays} VIX-gated, ${totalSignals} signal-slots`);
console.log(`\nOutput (isolated): ${OUT_DIR}`);
