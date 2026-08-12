#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// DÉPRÉCIÉ (2026-07-22) POUR L'AFFICHAGE — pit-state.json / pit-forward.json ne
// sont PLUS consommés par gen-status-page.js ni gen-api.js. Source unique de la
// performance affichée = le sweep frozen (computeStatsFromTrades dans sweep.js).
// Fichier CONSERVÉ pour référence / rollback ; ne pas supprimer.
// ─────────────────────────────────────────────────────────────────────────────
// pit-engine.js — Point-in-time event-driven backtest engine.
//
// Drives signals (scans) + OHLCV bars through a per-mode portfolio state machine
// chronologically. Replicates sweep.js simulatePortfolio behavior with the same
// risk gates (VIX kill, DD breaker, sector cap, correlation cap, cooldown,
// strategy filter, regime-aware override, ETF 52w penalty, inverse-ATR sizing,
// rotation, cross-mode dedup, TKL pool).
//
// Supports starting from scratch or resuming from a saved state snapshot.
//
// CLI:
//   --from=YYYY-MM-DD          start date (default: first scan)
//   --to=YYYY-MM-DD            end date (default: today)
//   --config=PATH              modes config (default: data/modes-config.json)
//   --state-in=PATH            resume from saved state JSON
//   --state-out=PATH           save state JSON at end (default: data/pit-state.json)
//   --out=PATH                 stats output JSON (default: data/pit-results.json)
//   --modes=turbo,fortress     subset (default: all)
//   --verbose                  per-day log

const fs = require('fs');
const path = require('path');
const sweep = require('./sweep.js');
const ms = require('./lib/mode-status');
const {
  fetchOHLCV, priceCache, parseScan, getSector, normalizeRegime,
  STRATEGY_FILTERS_MAP, vixKillTriggered, regimeSizeMultiplier, maxCorrToOpen,
} = sweep;

const ROOT = path.dirname(__dirname);

// ─── CLI parsing ─────────────────────────────────────────────────────────────
const ARGS = parseArgs(process.argv.slice(2));
function parseArgs(argv) {
  const out = { modes: null, verbose: false };
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'verbose') out.verbose = true;
    else if (m[1] === 'use-history') out['use-history'] = true;
    else if (m[1] === 'modes' && m[2]) out.modes = m[2].split(',').map(s => s.trim());
    else out[m[1]] = m[2];
  }
  return out;
}

const STATE_IN = ARGS['state-in'];
const STATE_OUT = ARGS['state-out'] || path.join(ROOT, 'data', 'pit-state.json');
const OUT = ARGS.out || path.join(ROOT, 'data', 'pit-results.json');
const CONFIG_PATH = ARGS.config || path.join(ROOT, 'data', 'modes-config.json');
const HISTORY_PATH = ARGS['config-history'] || path.join(ROOT, 'data', 'modes-config-history.json');
const USE_HISTORY = ARGS['use-history'] !== undefined;

const log = (...args) => ARGS.verbose && console.log(...args);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function addBizDays(dateStr, n) {
  let d = new Date(dateStr + 'T12:00:00Z');
  const step = n >= 0 ? 1 : -1;
  let added = 0;
  while (added < Math.abs(n)) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}
function bizDaysBetween(a, b) {
  let d = new Date(a + 'T12:00:00Z');
  const end = new Date(b + 'T12:00:00Z');
  let n = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return n;
}
function getAllBizDays(start, end) {
  const days = [];
  let d = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  while (d <= e) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function computeATR(priceHistory, endDate, period = 14) {
  const dates = Object.keys(priceHistory).filter(d => d <= endDate).sort();
  if (dates.length < period + 1) return null;
  const recent = dates.slice(-period - 1);
  let sumTR = 0;
  for (let i = 1; i < recent.length; i++) {
    const cur = priceHistory[recent[i]], prev = priceHistory[recent[i - 1]];
    if (!cur || !prev) return null;
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    sumTR += tr;
  }
  return sumTR / period;
}

// ─── Cooldown days by exit status ────────────────────────────────────────────
function cooldownDaysForStatus(status) {
  // Match sweep.js: only SL triggers cooldown (10 biz days). Other statuses no ban.
  const base = (status || '').replace(/_amb$/, '');
  if (base === 'sl') return 10;
  return 0;
}

// ─── Phase 1: Index all scan events ──────────────────────────────────────────
function indexScans(from, to) {
  const scanDir = path.join(ROOT, 'scanner');
  const dirs = fs.readdirSync(scanDir).filter(d => /^\d{8}$/.test(d)).sort();
  const events = [];
  for (const d of dirs) {
    const dm = d.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dm) continue;
    const scanDate = `${dm[1]}-${dm[2]}-${dm[3]}`;
    if (from && scanDate < from) continue;
    if (to && scanDate > to) continue;
    const parsed = parseScan(d);
    if (!parsed) continue;
    if ((parsed.setups || []).length === 0 && (parsed.tklPool || []).length === 0) continue;
    events.push({
      scanDate, regime: parsed.regime,
      setups: parsed.setups || [],
      tklPool: parsed.tklPool || [],
    });
  }
  return events;
}

// ─── Phase 2: Bulk fetch prices ──────────────────────────────────────────────
async function fetchAllPrices(tickers) {
  let i = 0;
  for (const tk of tickers) {
    if (!priceCache[tk]) {
      try { await fetchOHLCV(tk); } catch (e) { /* skip */ }
    }
    if (++i % 50 === 0) process.stdout.write(`  ${i}/${tickers.size}\r`);
  }
  console.log(`\nPrice cache loaded (${Object.keys(priceCache).length} tickers).`);
}

// ─── Per-position update (one bar) ───────────────────────────────────────────
// EARLY_EXIT_MIN_DAYS: Go EarlyExitConfig default (portfolio_etf_us.yaml min_days: 2).
// Not exposed as a config field (see cfg.earlyExitDays doc below) — hardcoded to match
// the Go PM's lower bound before an early-exit check is even considered.
const EARLY_EXIT_MIN_DAYS = 2;

function stepPosition(pos, day, bar, cfg) {
  if (!bar) return null;
  pos.daysHeld = (pos.daysHeld || 0) + 1;

  // SL check (first-touch)
  if (bar.low <= pos.currentStop) {
    const ambiguous = (bar.high >= pos.actualTp1) || (pos.actualTp2 && bar.high >= pos.actualTp2);
    let status;
    if (pos.partialRealized > 0) status = 'tp1_partial';
    else if (pos.currentStop > pos.entryPrice) status = 'trail';
    else if (pos.currentStop >= pos.entryPrice) status = 'breakeven';
    else status = 'sl';
    if (ambiguous) status += '_amb';
    pos.status = status;
    pos.exitDate = day;
    pos.exitPrice = pos.currentStop;
    return 'closed';
  }

  // Early exit: cut fast losers within first N days (Go: portfolio_etf_us.yaml /
  // portfolio_etf_eu.yaml early_exit block). Close-based (not intraday like SL). Opt-in
  // (cfg.earlyExitLossPct/earlyExitDays default 0 = off). Reuses 'sl' status tagged via
  // exitTrigger so no downstream consumer needs a new status value.
  if (cfg.earlyExitLossPct > 0 && cfg.earlyExitDays > 0 &&
      pos.daysHeld >= EARLY_EXIT_MIN_DAYS && pos.daysHeld <= cfg.earlyExitDays) {
    const closeLossPct = (pos.entryPrice - bar.close) / pos.entryPrice * 100;
    if (closeLossPct >= cfg.earlyExitLossPct) {
      pos.status = 'sl';
      pos.exitDate = day;
      pos.exitPrice = bar.close;
      pos.exitTrigger = 'early_exit';
      return 'closed';
    }
  }

  // TP2 (only real)
  if (pos.actualTp2 !== null && bar.high >= pos.actualTp2) {
    pos.status = 'tp2'; pos.exitDate = day; pos.exitPrice = pos.actualTp2;
    return 'closed';
  }

  // TP1
  if (bar.high >= pos.actualTp1 && pos.partialRealized === 0) {
    if (cfg.partialTP) {
      const tpFrac = (cfg.partialTPPct || 0.5) * 100;
      pos.partialRealized = ((pos.actualTp1 - pos.entryPrice) / pos.entryPrice) * tpFrac;
      if (pos.entryPrice > pos.currentStop) pos.currentStop = pos.entryPrice;
    } else {
      pos.status = 'tp1'; pos.exitDate = day; pos.exitPrice = pos.actualTp1;
      return 'closed';
    }
  }

  // trailTriggerPct: trailing stop only arms once unrealized gain (close-based) has
  // reached >= X% at some point (Go: portfolio_us_highvol.yaml trail_trigger_pct). Once
  // armed it stays armed. Opt-in — cfg.trailTriggerPct default 0 = armed immediately
  // (prior behavior, tracked via pos.trailArmed initialized true when disabled).
  if (pos.trailArmed === undefined) pos.trailArmed = !(cfg.trailTriggerPct > 0); // resumed-state safety net
  if (!pos.trailArmed) {
    const gainPct = (bar.close - pos.entryPrice) / pos.entryPrice * 100;
    if (gainPct >= cfg.trailTriggerPct) pos.trailArmed = true;
  }

  // Trailing stop (post-partial) — gate on partialRealized only when partialTP is configured
  const trailGated = (cfg.partialTPGain > 0 || cfg.partialTP) ? pos.partialRealized > 0 : true;
  if (cfg.trailingStop && pos.trailArmed && trailGated && pos.daysHeld > (cfg.trailGraceDays || 0)) {
    const trailLevel = bar.high - pos.riskPerUnit * (cfg.trailMultR || 1.5);
    if (trailLevel > pos.currentStop) pos.currentStop = trailLevel;
  }

  // Daily trailing
  if (cfg.dailyTrailPct > 0 && pos.daysHeld > (cfg.beGraceDays || 0)) {
    const trailLevel = bar.close * (1 - cfg.dailyTrailPct / 100);
    if (trailLevel > pos.currentStop) pos.currentStop = trailLevel;
  }

  // Breakeven stop
  if (cfg.breakevenPct > 0 && !pos.breakevenActivated && pos.daysHeld > (cfg.beGraceDays || 0)) {
    const currentGain = (bar.high - pos.entryPrice) / pos.entryPrice * 100;
    if (currentGain >= cfg.breakevenPct) {
      pos.breakevenActivated = true;
      if (pos.entryPrice > pos.currentStop) pos.currentStop = pos.entryPrice;
    }
  }

  // Tighten after days: after N days in position, floor the stop at entry*(1-X/100)
  // if the current stop is lower (Go: portfolio_ma.yaml casablanca tighten_after_days /
  // tightened_max_loss). Opt-in — cfg.tightenAfterDays/tightenToPct default 0 = off.
  if (cfg.tightenAfterDays > 0 && cfg.tightenToPct > 0 && pos.daysHeld >= cfg.tightenAfterDays) {
    const tightenedStop = pos.entryPrice * (1 - cfg.tightenToPct / 100);
    if (tightenedStop > pos.currentStop) pos.currentStop = tightenedStop;
  }

  // Stale exit
  if (cfg.staleDays > 0) {
    if (bar.high > (pos.highWaterMark || pos.entryPrice)) {
      pos.highWaterMark = bar.high;
      pos.daysSinceNewHigh = 0;
    } else {
      pos.daysSinceNewHigh = (pos.daysSinceNewHigh || 0) + 1;
    }
    if (pos.daysSinceNewHigh >= cfg.staleDays) {
      const staleRaise = (pos.daysSinceNewHigh - cfg.staleDays + 1) * 0.002 * pos.entryPrice;
      const tightened = pos.currentStop + staleRaise;
      if (tightened > pos.currentStop && tightened < bar.close) pos.currentStop = tightened;
    }
  }

  // Horizon expiry
  if (pos.daysHeld >= (cfg.horizon || cfg.horizonDays || 20)) {
    pos.status = 'expired';
    pos.exitDate = day;
    pos.exitPrice = bar.close;
    return 'closed';
  }

  return 'open';
}

function computePnl(pos, cfg) {
  if (cfg.partialTP && pos.partialRealized > 0) {
    const tpFrac = (cfg.partialTPPct || 0.5) * 100;
    const remaining = ((pos.exitPrice - pos.entryPrice) / pos.entryPrice) * (100 - tpFrac);
    return +((pos.partialRealized + remaining) / 100 * 100).toFixed(2);
  }
  return +((pos.exitPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2);
}

// ─── Open a new position ────────────────────────────────────────────────────
function openPosition(setup, scanDate, entryDate, cfg) {
  const hist = priceCache[setup.ticker];
  if (!hist) return null;
  const entryBar = hist[entryDate];
  if (!entryBar) return null;
  const actualEntry = entryBar.open;
  if (!actualEntry || actualEntry <= 0) return null;
  if (actualEntry <= setup.stop) return null;
  if (cfg.entryGatePct > 0 && actualEntry > setup.entry * (1 + cfg.entryGatePct / 100)) return null;

  let entryPrice = actualEntry;
  let vwapRef = null;
  const allDates = Object.keys(hist).sort();
  const idx = allDates.indexOf(entryDate);
  const prevBar = idx > 0 ? hist[allDates[idx - 1]] : null;
  if (prevBar && prevBar.high && prevBar.low && prevBar.close) {
    vwapRef = (prevBar.high + prevBar.low + prevBar.close) / 3;
  }
  // Entry model. Two mutually-exclusive paths (they NEVER stack):
  //   - entryModel='limit_markup' (opt-in): models the Go PM's LIMIT BUY order
  //     (systematic-tss pm_highvol_corr, limit_price_markup=1.025 → default 2.5%).
  //     limitPrice = signalPrice(setup.entry) × (1 + limitMarkupPct/100). Fill on the
  //     J+1 daily bar: open ≤ limit → fill at open; else low ≤ limit → fill at limit;
  //     else (low > limit, price gapped above the cap) → NO FILL → return null so the
  //     slot falls through to the next candidate (behaves like a gate, no clamp).
  //     vwapGate is BYPASSED here (limit_markup owns the entry price).
  //   - otherwise: legacy vwapGate path (unchanged, strict rétro-compat for every mode
  //     without entryModel — cfg.entryModel is undefined → this else-if runs as before).
  if (cfg.entryModel === 'limit_markup') {
    const markupPct = (cfg.limitMarkupPct != null) ? cfg.limitMarkupPct : 2.5;
    const limitPrice = setup.entry * (1 + markupPct / 100);
    if (actualEntry <= limitPrice) {
      entryPrice = actualEntry;                 // gap-up ≤ cap (or flat/down): fill at open
    } else if (entryBar.low <= limitPrice) {
      entryPrice = limitPrice;                  // opened above cap but pulled back to it intraday
    } else {
      return null;                              // whole J+1 bar above cap → no fill
    }
  } else if (cfg.vwapGate && vwapRef !== null && setup.strategy !== 'candlestick') {
    if (actualEntry > vwapRef * 1.01) return null;
    entryPrice = Math.max(Math.min(actualEntry, vwapRef), entryBar.low);
  }

  if (setup.source && setup.source.startsWith('tkl')) {
    const GAP = { breakout: 5, momentum: 6, pre_squeeze: 7, pullback: 0 };
    const stratKey = (setup.strategy || '').toLowerCase().replace(/[^a-z_]/g, '');
    const thr = GAP[stratKey] ?? 5;
    if (thr > 0 && prevBar && prevBar.close) {
      const gapPct = (prevBar.close - actualEntry) / prevBar.close * 100;
      if (gapPct > thr) return null;
    }
  }

  let riskPerUnit = setup.entry - setup.stop;
  if (riskPerUnit <= 0) return null;

  const STRATEGY_CAP = { pre_squeeze: 10, short_squeeze: 10, breakout: 10, momentum: 10, pullback: 10 };
  const effMaxStop = Math.min(
    cfg.maxStopPct > 0 ? cfg.maxStopPct : 100,
    STRATEGY_CAP[setup.strategy] || (cfg.maxStopPct > 0 ? cfg.maxStopPct : 100)
  );
  if (effMaxStop < 100) {
    const maxRisk = entryPrice * (effMaxStop / 100);
    if (riskPerUnit > maxRisk) riskPerUnit = maxRisk;
  }
  if (cfg.atrStopMult > 0) {
    const atr = computeATR(hist, entryDate);
    if (atr) {
      const atrRisk = atr * cfg.atrStopMult;
      if (atrRisk < riskPerUnit) riskPerUnit = atrRisk;
    }
  }

  const actualStop = entryPrice - riskPerUnit;
  const rewardMult1 = (setup.tp1 - setup.entry) / riskPerUnit;
  const actualTp1 = entryPrice + riskPerUnit * rewardMult1;
  const rewardMult2 = setup.tp2 ? (setup.tp2 - setup.entry) / riskPerUnit : null;
  const actualTp2 = rewardMult2 !== null ? entryPrice + riskPerUnit * rewardMult2 : null;

  const rr = (actualTp1 - entryPrice) / riskPerUnit;
  if (rr < 1.5) return null;

  return {
    ticker: setup.ticker, strategy: setup.strategy, score: setup.score, source: setup.source || 'signals',
    scanDate, entryDate, entryPrice, actualEntry,
    actualStop, actualTp1, actualTp2, riskPerUnit,
    currentStop: actualStop, daysHeld: 0, partialRealized: 0,
    breakevenActivated: false, highWaterMark: entryPrice, daysSinceNewHigh: 0,
    trailArmed: !(cfg.trailTriggerPct > 0), // opt-in trailTriggerPct: armed immediately when off
    status: 'open',
  };
}

// ─── History-aware config resolver ───────────────────────────────────────────
// Returns active config (per mode) for a given date, merged with current defaults
// to fill any fields the history version omitted (e.g. vwapGate added later).
function buildHistoryResolver(historyPath, currentModes) {
  if (!fs.existsSync(historyPath)) {
    return () => currentModes;
  }
  const hist = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const versions = (hist.versions || [])
    .map(v => ({ id: v.id, day: v.timestamp.slice(0, 10), config: v.config }))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (versions.length === 0) return () => currentModes;
  return (day) => {
    // Find latest version whose day <= day
    let active = null;
    for (const v of versions) {
      if (v.day <= day) active = v;
      else break;
    }
    if (!active) return currentModes;
    const merged = {};
    for (const id of Object.keys(currentModes)) {
      merged[id] = { ...currentModes[id], ...(active.config[id] || {}) };
      merged[id].__configVersion = active.id;
    }
    return merged;
  };
}

// ─── State init / resume ─────────────────────────────────────────────────────
function initState(modesConfig, modeFilter) {
  const state = { asOf: null, modes: {} };
  for (const [id, cfg] of Object.entries(modesConfig)) {
    if (modeFilter && !modeFilter.includes(id)) continue;
    state.modes[id] = {
      id, cfg,
      positions: [],
      pendingEntries: [],
      closedTrades: [],
      equityCurve: [],
      cooldown: {}, // ticker → { exitDate, days }
      cbStopDates: [], // circuit breaker: dates of SL events
      cbPauseUntil: null, // circuit breaker: pause new entries until this date
    };
  }
  return state;
}

// Reconcile a resumed state against the current modes-config: seed any mode that
// exists in the config but was never initialized in the saved state (e.g. the 6
// asset-class specialists — etf/etf_eu/momentum/trendline/highvol/casablanca —
// added to modes-config.json on 2026-07-01, long after this state was first built).
// EXISTING modes are left byte-for-byte untouched (diff = additions only): we never
// touch their cfg, curves or trades. New modes start their live book at 100 on the
// state's asOf day (a single equity anchor) so the dashboard can show "live book
// starts DD/MM" and they begin trading on the next scan the engine processes.
function reconcileModes(state, modesConfig, modeFilter) {
  const added = [];
  const anchorDate = state.asOf || null;
  for (const [id, cfg] of Object.entries(modesConfig)) {
    if (modeFilter && !modeFilter.includes(id)) continue;
    if (state.modes[id]) continue; // existing mode — never mutate
    state.modes[id] = {
      id, cfg,
      positions: [],
      pendingEntries: [],
      closedTrades: [],
      // Anchor the live book at 100 today so the mode has >=1 equity point
      // ("starts at 100 on asOf"). Empty when asOf is null (pathological fresh state).
      equityCurve: anchorDate ? [{ date: anchorDate, value: 100, realized: 0, unrealized: 0 }] : [],
      cooldown: {},
      cbStopDates: [],
      cbPauseUntil: null,
    };
    added.push(id);
  }
  return added;
}

function loadState(file) {
  if (!fs.existsSync(file)) throw new Error(`State file missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveState(state, file) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// ─── Get effective candidates for a scan, applying all filters ──────────────
function buildCandidates(scan, mode, day, cfgOverride = null) {
  const cfg = cfgOverride || mode.cfg;
  // Source pool selection — matches sweep excludeSources logic:
  //   - TKL mode: tkl_pool only (signals excluded)
  //   - Other modes: signals always; tkl_pool included unless tklPoolEnabled===false
  let pool = [];
  if (mode.id === 'tkl') {
    pool = scan.tklPool || [];
  } else {
    pool = [...(scan.setups || [])];
    if (cfg.tklPoolEnabled !== false) {
      pool = pool.concat(scan.tklPool || []);
    }
  }

  // Regime-aware filter override
  let filterName = cfg.filterName || 'all';
  if (cfg.regimeFilters) {
    const key = normalizeRegime(scan.regime);
    if (cfg.regimeFilters[key]) filterName = cfg.regimeFilters[key];
  }
  const filterSet = STRATEGY_FILTERS_MAP[filterName] || new Set();

  // Filter by score + strategy
  const minScore = cfg.minScore || 0;
  let candidates = pool
    .filter(s => (s.score || 0) >= minScore || s.strategy === 'candlestick')
    .filter(s => !filterSet.has(s.strategy));

  // ETF 52w high penalty
  for (const c of candidates) {
    const sec = getSector(c.ticker);
    if (sec.startsWith('ETF-')) {
      const hist = priceCache[c.ticker];
      if (hist) {
        const lookback = Object.keys(hist).filter(d => d <= day).sort().slice(-252);
        const yearHigh = Math.max(...lookback.map(d => hist[d]?.high || 0));
        const entry = c.entry || 0;
        if (yearHigh > 0 && entry >= yearHigh * 0.98) {
          c._effScore = (c.score || 0) - 5;
        }
      }
    }
  }
  candidates = candidates.filter(c => (c._effScore ?? c.score) >= minScore || c.strategy === 'candlestick');

  // Sort by effective score desc, take topN
  candidates.sort((a, b) => (b._effScore ?? b.score) - (a._effScore ?? a.score));
  const topN = cfg.topN || cfg.portfolioSize || 1;
  const candlestickExtras = candidates.filter(c => c.strategy === 'candlestick').length;
  return candidates.slice(0, topN + candlestickExtras);
}

// ─── Main engine loop ────────────────────────────────────────────────────────
async function run() {
  const cfgFile = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const modesConfig = cfgFile.modes || cfgFile;

  let state;
  if (STATE_IN) {
    state = loadState(STATE_IN);
    console.log(`Resumed from ${STATE_IN}, asOf=${state.asOf}`);
  } else {
    state = initState(modesConfig, ARGS.modes);
  }

  // Seed any config mode missing from the (resumed) state. Additions only —
  // existing modes are never mutated. Persist immediately even if the day-loop
  // below is a no-op (e.g. asOf === TO) or bails on "no scans in range", so a
  // resume-to-today run still commits the newly seeded specialists.
  const seeded = reconcileModes(state, modesConfig, ARGS.modes);
  if (seeded.length) console.log(`Seeded ${seeded.length} new mode(s): ${seeded.join(', ')} (anchored at 100 on ${state.asOf || 'n/a'})`);

  // History resolver — when --use-history is set, lookup active config per day
  // from modes-config-history.json. Otherwise always return current cfg.
  const resolveCfg = USE_HISTORY
    ? buildHistoryResolver(HISTORY_PATH, modesConfig)
    : (() => modesConfig);
  if (USE_HISTORY) console.log(`Using PIT config history from ${HISTORY_PATH}`);

  const FROM = ARGS.from || state.asOf || null;
  const TO = ARGS.to || new Date().toISOString().slice(0, 10);
  console.log(`PIT engine: from=${FROM || 'first scan'} to=${TO}`);
  console.log(`Modes: ${Object.keys(state.modes).join(', ')}`);

  const scanEvents = indexScans(FROM, TO);
  console.log(`Indexed ${scanEvents.length} scan events.`);
  if (scanEvents.length === 0) {
    console.log('No scans in range.');
    // Still commit newly-seeded modes so a resume-to-today run persists them.
    if (seeded.length) { saveState(state, STATE_OUT); console.log(`State saved to ${STATE_OUT} (seed-only).`); }
    return;
  }

  // Tickers: scans (setups + tklPool) + open positions + pending entries
  const tickers = new Set();
  for (const e of scanEvents) {
    for (const s of e.setups) tickers.add(s.ticker);
    for (const s of e.tklPool) tickers.add(s.ticker);
  }
  for (const mode of Object.values(state.modes)) {
    for (const p of mode.positions) tickers.add(p.ticker);
    for (const pe of mode.pendingEntries) tickers.add(pe.ticker);
  }
  console.log(`Loading prices for ${tickers.size} tickers...`);
  await fetchAllPrices(tickers);

  const scanByDate = new Map();
  for (const e of scanEvents) scanByDate.set(e.scanDate, e);

  const startDate = state.asOf ? addBizDays(state.asOf, 1) : scanEvents[0].scanDate;
  const endDate = TO;
  const allDays = getAllBizDays(startDate, endDate);

  // Pre-compute SPY equity peaks for DD breaker (cumulative across modes)
  let dayCount = 0;
  for (const day of allDays) {
    dayCount++;
    if (dayCount % 20 === 0) process.stdout.write(`  day ${dayCount}/${allDays.length}\r`);

    // 1. Per-mode: update open positions using their stamped cfg (PIT-correct)
    for (const mode of Object.values(state.modes)) {
      const stillOpen = [];
      for (const pos of mode.positions) {
        if (pos.entryDate >= day) { stillOpen.push(pos); continue; }
        const bar = priceCache[pos.ticker]?.[day];
        const cfg = pos.cfg || mode.cfg;
        const res = stepPosition(pos, day, bar, cfg);
        if (res === 'closed') {
          pos.pnlPct = computePnl(pos, cfg);
          mode.closedTrades.push(pos);
          const cdDays = cooldownDaysForStatus(pos.status);
          if (cdDays > 0) mode.cooldown[pos.ticker] = { exitDate: day, days: cdDays };
          // Circuit breaker: track SL events
          const cbBase = (pos.status || '').replace(/_amb$/, '');
          const cbMax = cfg.circuitBreakerStops || 0;
          if (cbBase === 'sl' && cbMax > 0) {
            mode.cbStopDates.push(day);
            const cbWin = cfg.circuitBreakerWindow || 5;
            const windowStart = addBizDays(day, -cbWin);
            const recentStops = mode.cbStopDates.filter(d => d >= windowStart).length;
            if (recentStops >= cbMax) {
              mode.cbPauseUntil = addBizDays(day, cfg.circuitBreakerPause || 3);
            }
          }
        } else {
          stillOpen.push(pos);
        }
      }
      mode.positions = stillOpen;
    }

    // 1b. Liquidation pass — modes flagged 'liquidated' force-close every
    // remaining position at the day's close price (skip if no bar yet).
    // Runs after the normal exit pass so SL/TP firing today are still
    // honored at their actual triggers.
    for (const mode of Object.values(state.modes)) {
      const cfg = mode.cfg;
      const cfgStatus = ms.isValidState(cfg.status) ? cfg.status : ms.DEFAULT_STATE;
      if (!ms.forceLiquidate(cfgStatus)) continue;
      const statusSinceDay = (cfg.statusSince || '').slice(0, 10);
      if (statusSinceDay && day < statusSinceDay) continue;
      if (mode.positions.length === 0) continue;
      const stillOpen = [];
      for (const pos of mode.positions) {
        const bar = priceCache[pos.ticker]?.[day];
        if (!bar) { stillOpen.push(pos); continue; }
        pos.status = 'liquidated';
        pos.exitDate = day;
        pos.exitPrice = bar.close;
        pos.pnlPct = +(((bar.close - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2);
        mode.closedTrades.push(pos);
        log(`  ${day} ${mode.id} LIQUIDATE ${pos.ticker} @ ${bar.close.toFixed(2)} pnl=${pos.pnlPct.toFixed(2)}%`);
      }
      mode.positions = stillOpen;
    }

    // 2. Per-mode: process pending entries scheduled for today
    for (const mode of Object.values(state.modes)) {
      const cfg = mode.cfg;
      const stillPending = [];
      for (const pe of mode.pendingEntries) {
        if (pe.entryDate > day) { stillPending.push(pe); continue; }
        if (pe.entryDate < day) continue; // missed entry, drop
        // Capacity
        if (mode.positions.length >= (cfg.portfolioSize || 1)) {
          log(`  ${day} ${mode.id} skip ${pe.ticker} — portfolio full`); continue;
        }
        // Cooldown
        const cd = mode.cooldown[pe.ticker];
        if (cd && bizDaysBetween(cd.exitDate, day) < cd.days) {
          log(`  ${day} ${mode.id} cooldown ${pe.ticker}`); continue;
        }
        // Sector cap
        if (cfg.sectorCapMax) {
          const sec = getSector(pe.ticker);
          const count = mode.positions.filter(p => getSector(p.ticker) === sec).length;
          if (count >= cfg.sectorCapMax) {
            log(`  ${day} ${mode.id} sectorCap ${pe.ticker}`); continue;
          }
        }
        // Correlation cap
        if (cfg.correlationCap > 0 && mode.positions.length > 0) {
          const candPseudo = { ticker: pe.ticker };
          const openPseudo = mode.positions.map(p => ({ trade: { ticker: p.ticker } }));
          const rho = maxCorrToOpen(candPseudo, openPseudo, 60);
          if (rho != null && Math.abs(rho) > cfg.correlationCap) {
            log(`  ${day} ${mode.id} corrCap ${pe.ticker} rho=${rho.toFixed(2)}`); continue;
          }
        }
        // Open
        const pos = openPosition(pe.setup, pe.scanDate, day, cfg);
        if (!pos) { log(`  ${day} ${mode.id} reject ${pe.ticker} (gate)`); continue; }
        pos.weight = pe.weight || (1 / (cfg.portfolioSize || 1)) * (cfg.positionSizePct || 1);
        mode.positions.push(pos);
        log(`  ${day} ${mode.id} ENTER ${pe.ticker} @ ${pos.entryPrice.toFixed(2)}`);
      }
      mode.pendingEntries = stillPending;
    }

    // 3. Scan event today → queue new entries per mode
    const scan = scanByDate.get(day);
    if (scan) {
      // Resolve active cfg for this day (PIT history-aware if --use-history)
      const activeCfgByMode = resolveCfg(day);
      // Cross-mode dedup: shared picked set per scan day
      const crossModePicked = new Set();
      // Iterate modes in priority order (matches sweep DEDUP_PRIORITY).
      // Conservative modes first so they consume the candidate pool before
      // aggressive modes when crossModeDedup is active.
      // Même ordre que sweep.js (modes supprimés retirés le 2026-08-12) ; `best`, absent de la
      // liste, passe en dernier — voir le commentaire de sweep.js.
      const DEDUP_PRIORITY = ['fortress', 'balanced', 'dynamic', 'turbo'];
      const modeOrder = [
        ...DEDUP_PRIORITY.filter(id => state.modes[id]),
        ...Object.keys(state.modes).filter(id => !DEDUP_PRIORITY.includes(id)),
      ];
      for (const id of modeOrder) {
        const mode = state.modes[id];
        const cfg = activeCfgByMode[id] || mode.cfg;
        const candidates = buildCandidates(scan, mode, day, cfg);
        let slots = (cfg.portfolioSize || 1) - mode.positions.length - mode.pendingEntries.length;

        // Status gate (computed early so rotation respects it too — rotating in a
        // new candidate is effectively a new entry and must be blocked when the
        // mode is winding down or paused).
        const cfgStatus = ms.isValidState(cfg.status) ? cfg.status : ms.DEFAULT_STATE;
        const statusSinceDay = (cfg.statusSince || '').slice(0, 10);
        const statusActiveOnDay = !statusSinceDay || day >= statusSinceDay;
        const statusHalt = statusActiveOnDay && !ms.acceptsNewEntries(cfgStatus);

        // Rotation — skipped when status or circuit breaker forbids new entries.
        const cbHaltRotation = !!(mode.cbPauseUntil && day <= mode.cbPauseUntil);
        if (!statusHalt && !cbHaltRotation && cfg.rotation && cfg.rotation !== 'none' && slots <= 0 && candidates.length > 0) {
          const rotLimit = cfg.rotation === 'daily_max1' ? 1 : cfg.rotation === 'daily_max2' ? 2 : (cfg.portfolioSize || 1);
          const margin = cfg.rotation === 'aggressive' ? 0 : 5;
          const sorted = [...mode.positions].sort((a, b) => (a.score || 0) - (b.score || 0));
          let rotated = 0;
          for (const cand of candidates) {
            if (rotated >= rotLimit) break;
            if (rotated >= sorted.length) break;
            const worst = sorted[rotated];
            const candEff = cand._effScore ?? cand.score;
            if (candEff > (worst.score || 0) + margin) {
              const histW = priceCache[worst.ticker];
              if (histW && histW[day]) {
                const forcePnl = ((histW[day].close - worst.entryPrice) / worst.entryPrice) * 100;
                const rotated_trade = { ...worst, status: 'rotated', exitDate: day, exitPrice: histW[day].close, pnlPct: +forcePnl.toFixed(2) };
                mode.closedTrades.push(rotated_trade);
                mode.cooldown[worst.ticker] = { exitDate: day, days: 3 };
              }
              mode.positions = mode.positions.filter(p => p !== worst);
              slots++;
              rotated++;
            }
          }
        }

        // VIX kill + DD breaker
        const vixKill = vixKillTriggered(scan.regime, cfg.vixKillThreshold);
        let ddBreaker = false;
        if (cfg.ddBreakerPct && mode.equityCurve.length >= 2) {
          let peak = 100;
          for (let i = 0; i < mode.equityCurve.length - 1; i++) {
            if (mode.equityCurve[i].value > peak) peak = mode.equityCurve[i].value;
          }
          const priorClose = mode.equityCurve[mode.equityCurve.length - 1].value;
          const currentDD = peak > 0 ? ((peak - priorClose) / peak) * 100 : 0;
          ddBreaker = currentDD > cfg.ddBreakerPct;
        }
        // Circuit breaker: pause new entries after consecutive SL streak
        const cbHalt = !!(mode.cbPauseUntil && day <= mode.cbPauseUntil);
        // Status gate already computed above (statusHalt). For paused / stopped /
        // pausing / liquidated / draft, statusActiveOnDay gates from the transition
        // date so historical backtest results stay reproducible. Existing positions
        // still run their full exit logic (SL/TP/horizon/trailing) — only the
        // new-entry path is suppressed. Liquidated additionally force-closes
        // every remaining position via the 1b pass above.
        if (vixKill || ddBreaker || statusHalt || cbHalt) {
          log(`  ${day} ${mode.id} HALT new entries (vixKill=${vixKill}, ddBreaker=${ddBreaker}, status=${statusHalt ? cfgStatus : 'ok'}, cb=${cbHalt})`);
          continue;
        }

        // Inverse-ATR sizing setup
        const regimeMult = (cfg.vixKillSwitch !== false) ? regimeSizeMultiplier(scan.regime) : 1;
        const baseWeight = (1 / (cfg.portfolioSize || 1)) * (cfg.positionSizePct || 1) * regimeMult;
        const SIZING_REF = 0.03;

        // Scan date IS entry day (folder generated D-1 at 23h, folder=D+1 entry).
        // Open positions same day at scan date open price.
        const openTickers = new Set(mode.positions.map(p => p.ticker));
        const sectorCounts = {};
        for (const p of mode.positions) {
          const sec = getSector(p.ticker);
          sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
        }

        let added = 0;
        for (const cand of candidates) {
          if (added >= slots) break;
          if (openTickers.has(cand.ticker)) continue;
          // Cooldown
          const cd = mode.cooldown[cand.ticker];
          if (cd && bizDaysBetween(cd.exitDate, day) < cd.days) continue;
          // Cross-mode dedup
          if (cfg.crossModeDedup) {
            const key = `${day}|${cand.ticker}`;
            if (crossModePicked.has(key)) continue;
          }
          // Sector cap (checked at queue time, against in-portfolio + freshly added)
          if (cfg.sectorCapMax) {
            const sec = getSector(cand.ticker);
            if ((sectorCounts[sec] || 0) >= cfg.sectorCapMax) continue;
          }
          // Correlation cap
          if (cfg.correlationCap > 0 && mode.positions.length > 0) {
            const openPseudo = mode.positions.map(p => ({ trade: { ticker: p.ticker } }));
            const rho = maxCorrToOpen({ ticker: cand.ticker }, openPseudo, 60);
            if (rho != null && Math.abs(rho) > cfg.correlationCap) continue;
          }

          // Compute candidate weight (inverse-ATR)
          let weight = baseWeight;
          if (cfg.sizingMethod === 'inverse_atr' && cand.entry > 0 && cand.stop > 0) {
            const stopPct = (cand.entry - cand.stop) / cand.entry;
            if (stopPct > 0) {
              const adj = Math.max(0.5, Math.min(1.5, SIZING_REF / Math.max(stopPct, 0.005)));
              weight = baseWeight * adj;
            }
          }

          // Open immediately (same day entry)
          const pos = openPosition(cand, day, day, cfg);
          if (!pos) { log(`  ${day} ${mode.id} reject ${cand.ticker} (gate)`); continue; }
          pos.weight = weight;
          pos.cfg = cfg;                            // PIT: stamp cfg for trade lifetime
          pos.configVersion = cfg.__configVersion || null;
          mode.positions.push(pos);
          openTickers.add(cand.ticker);
          const candSec = getSector(cand.ticker);
          sectorCounts[candSec] = (sectorCounts[candSec] || 0) + 1;
          if (cfg.crossModeDedup) crossModePicked.add(`${day}|${cand.ticker}`);
          log(`  ${day} ${mode.id} ENTER ${cand.ticker} @ ${pos.entryPrice.toFixed(2)}`);
          added++;
        }
      }
    }

    // 4. MtM equity per mode
    for (const mode of Object.values(state.modes)) {
      const cfg = mode.cfg;
      const defaultWeight = (1 / (cfg.portfolioSize || 1)) * (cfg.positionSizePct || 1);
      let realized = 0;
      for (const t of mode.closedTrades) realized += (t.pnlPct || 0) * (t.weight ?? defaultWeight);
      let unrealized = 0;
      for (const pos of mode.positions) {
        if (pos.entryDate > day) continue;
        const close = priceCache[pos.ticker]?.[day]?.close;
        if (close && pos.entryPrice > 0) {
          unrealized += ((close - pos.entryPrice) / pos.entryPrice) * 100 * (pos.weight ?? defaultWeight);
        }
      }
      const equity = 100 + realized + unrealized;
      mode.equityCurve.push({ date: day, value: +equity.toFixed(2), realized: +realized.toFixed(2), unrealized: +unrealized.toFixed(2) });
    }
    state.asOf = day;
  }

  console.log(`\nDone. Days processed: ${dayCount}.`);

  const summary = {};
  for (const [id, mode] of Object.entries(state.modes)) {
    const ec = mode.equityCurve;
    const ret = ec.length ? ec[ec.length - 1].value - 100 : 0;
    let peak = 100, maxDD = 0;
    for (const p of ec) {
      if (p.value > peak) peak = p.value;
      const dd = (peak - p.value) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }
    const RESOLVED = ['tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'breakeven', 'trail', 'rotated'];
    const resolved = mode.closedTrades.filter(t => RESOLVED.includes((t.status || '').replace(/_amb$/, '')));
    const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
    const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
    const wr = resolved.length ? wins.length / resolved.length * 100 : 0;
    const gw = wins.reduce((s, t) => s + t.pnlPct, 0);
    const gl = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
    const pf = gl > 0 ? gw / gl : (gw > 0 ? 99 : 0);
    let sharpe = 0;
    if (ec.length > 2) {
      const dr = [];
      for (let i = 1; i < ec.length; i++) {
        const prev = ec[i - 1].value, cur = ec[i].value;
        if (prev > 0) dr.push((cur - prev) / prev);
      }
      const mean = dr.reduce((s, r) => s + r, 0) / dr.length;
      const variance = dr.reduce((s, r) => s + (r - mean) ** 2, 0) / (dr.length - 1);
      const sd = Math.sqrt(variance);
      if (sd > 0) sharpe = Math.sqrt(252) * mean / sd;
    }
    summary[id] = {
      ret: +ret.toFixed(2),
      maxDD: +(-maxDD).toFixed(2),
      wr: +wr.toFixed(1),
      pf: +pf.toFixed(2),
      sharpe: +sharpe.toFixed(2),
      trades: resolved.length,
      openPositions: mode.positions.length,
      pendingEntries: mode.pendingEntries.length,
    };
  }

  console.log('\n=== PIT ENGINE RESULT ===');
  console.log('Mode      | Ret%    DD%    WR%    PF    Sharpe  Trades  Open  Pending');
  for (const [id, s] of Object.entries(summary)) {
    console.log(id.padEnd(10), '|',
      String(s.ret).padStart(6), String(s.maxDD).padStart(6), String(s.wr).padStart(6), String(s.pf).padStart(6),
      String(s.sharpe).padStart(7), String(s.trades).padStart(7), String(s.openPositions).padStart(5), String(s.pendingEntries).padStart(8));
  }

  saveState(state, STATE_OUT);
  fs.writeFileSync(OUT, JSON.stringify({ asOf: state.asOf, summary, from: startDate, to: endDate }, null, 2));
  console.log(`\nState saved to ${STATE_OUT}`);
  console.log(`Results saved to ${OUT}`);
}

// ─── Module exports (for tools/pit-backfill.js — reuse EXACT trade mechanics for PIT parity) ──
// Backward-compatible: run() still fires unchanged when invoked as CLI entrypoint.
module.exports = {
  openPosition, stepPosition, computePnl, buildCandidates,
  cooldownDaysForStatus, addBizDays, bizDaysBetween, getAllBizDays, computeATR,
};

if (require.main === module) {
  run().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
}
