'use strict';

/**
 * americanbull-pm.js — Position manager, faithful port of pm_americanbulls.go.
 *
 * Features:
 * - Hybrid 3-mode (AGGRESSIVE/NORMAL/DEFENSIVE) based on VIX + equity + bleeding
 * - Dynamic regime stops/TP: max_loss 4-7.5%, TP 5-10%, timeout 7-10d
 * - Bearish candlestick exit signals (Engulfing, Three Black Crows, etc.)
 * - Rotation: replace worst loser after 7d if down >5%
 * - Confirmation entries: limit at pattern close + 0.1%
 * - Correlation filter: max 0.7 between holdings
 * - Safety stop: soft_stop - (entry - soft_stop) * safety_mult
 */

const { detectBearishExit } = require('./candlestick-patterns');

// ─── Config from portfolio_us_americanbulls.yaml ────────────────────────────

const DEFAULT_CONFIG = {
  maxOpenPositions: 5,
  positionSizePct: 0.20,
  baseStopATR: 1.5,
  safetyStopMult: 3.0,
  maxLossPct: 0.07,
  takeProfitPct: 9.0,
  timeoutDays: 10,
  pendingBuyCancelDays: 3,
  enableRotation: true,
  rotationMinDays: 7,
  rotationMinLoss: 0.05,
  rotationMinScore: 0,
  minCashReserve: 2.0,

  hybridModes: {
    vixCalmThreshold: 18,
    vixStressThreshold: 22,
    capitalPreservationBuffer: 0.05,
    equityAggressiveBuffer: 0.10,
    bleedingThreshold: 0.50,
    aggressive: { maxOpenPositions: 5, positionSizePct: 0.40, safetyStopMult: 3.0, timeoutDays: 10 },
    normal: { maxOpenPositions: 5, positionSizePct: 0.25, safetyStopMult: 2.5, timeoutDays: 10 },
    defensive: { maxOpenPositions: 3, positionSizePct: 0.10, safetyStopMult: 1.5, timeoutDays: 7 },
  },

  dynamicMaxLoss: {
    risk_on: 0.07, recovery: 0.07, neutral: 0.07,
    early_risk_off: 0.05, risk_off: 0.04,
    risk_on_vix_rising: 0.075, recovery_vix_rising: 0.075, neutral_vix_rising: 0.075,
  },
  dynamicTakeProfit: {
    risk_on: 9.0, recovery: 10.0, neutral: 10.0,
    early_risk_off: 8.0, risk_off: 5.0,
  },
  dynamicMaxPositions: {
    risk_on: 5, recovery: 5, neutral: 4,
    early_risk_off: 0, risk_off: 0,
  },
  dynamicPositionSize: {
    risk_on: 0.40, recovery: 0.30, neutral: 0.20,
    early_risk_off: 0.10, risk_off: 0.01,
  },
};

// ─── Hybrid mode selection (exact port of selectMode) ───────────────────────

function selectMode(vixLevel, vixRising, equity, initialCapital, positions, config) {
  const hc = config.hybridModes || DEFAULT_CONFIG.hybridModes;
  const vixCalm = hc.vixCalmThreshold || 18;
  const vixStress = hc.vixStressThreshold || 22;
  const capPresBuf = hc.capitalPreservationBuffer || 0.05;
  const eqAggBuf = hc.equityAggressiveBuffer || 0.10;
  const bleedThresh = hc.bleedingThreshold || 0.50;

  // DEFENSIVE checks
  if (equity < initialCapital * (1.0 + capPresBuf)) return 'DEFENSIVE';
  if (vixLevel >= vixStress) return 'DEFENSIVE';
  if (vixRising && bleedingFraction(positions, config.maxLossPct || 0.07) >= bleedThresh) return 'DEFENSIVE';

  // AGGRESSIVE
  if (vixLevel > 0 && vixLevel < vixCalm && equity > initialCapital * (1.0 + eqAggBuf)) return 'AGGRESSIVE';

  return 'NORMAL';
}

function bleedingFraction(positions, maxLossPct) {
  if (!positions || !positions.length) return 0;
  const threshold = maxLossPct / 2.0 || 0.04;
  let count = 0, total = 0;
  for (const pos of positions) {
    if (!pos.currentPrice || !pos.entry || pos.entry <= 0) continue;
    total++;
    const loss = (pos.entry - pos.currentPrice) / pos.entry;
    if (loss >= threshold) count++;
  }
  return total > 0 ? count / total : 0;
}

// ─── Mode-specific config resolution ────────────────────────────────────────

function resolveConfig(config, mode, regime, vixRising) {
  const hc = config.hybridModes || DEFAULT_CONFIG.hybridModes;
  const modeOverrides = mode === 'AGGRESSIVE' ? hc.aggressive : mode === 'DEFENSIVE' ? hc.defensive : hc.normal;

  // Go flow: ResolvedConfig(regime) → applyModeOverrides(cfg, mode) → ResolvedConfig(regime) again
  // In Go, createConfirmationEntries/CheckStandardExits call ResolvedConfig on the ALREADY
  // mode-overridden config. This means regime dynamics are applied AFTER mode overrides,
  // giving REGIME the final say. E.g. risk_off maxOpenPositions=0 blocks entries even in DEFENSIVE.
  const resolved = { ...DEFAULT_CONFIG, ...config };

  const regimeKey = (regime || 'neutral').toLowerCase().replace(/[\s-]+/g, '_');
  const vixKey = vixRising ? regimeKey + '_vix_rising' : null;

  const dml = config.dynamicMaxLoss || DEFAULT_CONFIG.dynamicMaxLoss;
  const dtp = config.dynamicTakeProfit || DEFAULT_CONFIG.dynamicTakeProfit;
  const dmp = config.dynamicMaxPositions || DEFAULT_CONFIG.dynamicMaxPositions;
  const dps = config.dynamicPositionSize || DEFAULT_CONFIG.dynamicPositionSize;

  // Step 1: Apply mode overrides to BASE values
  if (modeOverrides) {
    if (modeOverrides.maxOpenPositions != null) resolved.maxOpenPositions = modeOverrides.maxOpenPositions;
    if (modeOverrides.positionSizePct != null) resolved.positionSizePct = modeOverrides.positionSizePct;
    if (modeOverrides.safetyStopMult != null) resolved.safetyStopMult = modeOverrides.safetyStopMult;
    if (modeOverrides.timeoutDays != null) resolved.timeoutDays = modeOverrides.timeoutDays;
  }

  // Step 2: Apply dynamic regime overrides LAST (regime has final say — exact Go behavior)
  if (vixKey && dml[vixKey] != null) resolved.maxLossPct = dml[vixKey];
  else if (dml[regimeKey] != null) resolved.maxLossPct = dml[regimeKey];
  if (dtp[regimeKey] != null) resolved.takeProfitPct = dtp[regimeKey];
  if (dmp[regimeKey] != null) resolved.maxOpenPositions = dmp[regimeKey];
  if (dps[regimeKey] != null) resolved.positionSizePct = dps[regimeKey];

  return resolved;
}

// ─── Entry / Stop / TP computation (exact port) ─────────────────────────────

function computeEntry(patternClose) {
  return +(patternClose * 1.001).toFixed(4);
}

function computeStop(patternStop, entry, atr, safetyMult, baseStopATR) {
  const softStop = Math.min(patternStop, entry - atr * baseStopATR);
  const hardStop = entry - (entry - softStop) * safetyMult;
  return { softStop: +softStop.toFixed(4), hardStop: +hardStop.toFixed(4) };
}

function computeTP(entry, takeProfitPct) {
  return +(entry * (1 + takeProfitPct / 100)).toFixed(4);
}

// ─── Rotation logic (exact port of rotateWorstLoser) ────────────────────────

function shouldRotate(positions, candidate, config) {
  if (!config.enableRotation || !positions || positions.length < config.maxOpenPositions) return null;

  let worst = null, worstLoss = 0;
  for (const pos of positions) {
    if (!pos.currentPrice || !pos.entry || pos.entry <= 0) continue;
    const daysHeld = pos.daysHeld || 0;
    if (daysHeld < (config.rotationMinDays || 7)) continue;
    const loss = (pos.entry - pos.currentPrice) / pos.entry;
    if (loss >= (config.rotationMinLoss || 0.05) && loss > worstLoss) {
      worst = pos;
      worstLoss = loss;
    }
  }

  if (!worst) return null;
  if (candidate.totalScore < (config.rotationMinScore || 0)) return null;

  return { sell: worst, reason: `Rotate: ${worst.ticker} down ${(worstLoss * 100).toFixed(1)}% after ${worst.daysHeld}d` };
}

// ─── Bearish exit signal check ──────────────────────────────────────────────

function checkBearishExit(bars, regime) {
  return detectBearishExit(bars, regime);
}

// ─── Trade simulation for sweep.js integration ─────────────────────────────

/**
 * Simulate a single americanbull trade day-by-day.
 * This replaces the generic simulateTrade in sweep.js for candlestick trades.
 *
 * @param {object} setup — { ticker, entry, stop, tp1, score, pattern }
 * @param {string} scanDate — YYYY-MM-DD
 * @param {object} priceHistory — { 'YYYY-MM-DD': { open, high, low, close } }
 * @param {object} config — resolved PM config
 * @param {string} regime — current regime
 * @returns {object|null} — trade result
 */
function simulateAmericanBullTrade(setup, scanDate, priceHistory, config, regime) {
  if (!priceHistory) return null;

  const resolved = resolveConfig(config || {}, 'NORMAL', regime, false);
  const entryDate = scanDate;
  const entryBar = priceHistory[entryDate];
  if (!entryBar) return null;

  // Confirmation entry: buy if price >= pattern close * 1.001
  const confirmLevel = setup.entry * 1.001;
  if (entryBar.open < confirmLevel && entryBar.high < confirmLevel) return null;

  const actualEntry = Math.max(entryBar.open, confirmLevel);
  if (actualEntry <= 0 || actualEntry <= setup.stop) return null;

  const atr = computeATRFromHistory(priceHistory, entryDate, 14);
  const { softStop } = computeStop(setup.stop, actualEntry, atr || (actualEntry * 0.03), resolved.safetyStopMult, resolved.baseStopATR);
  const tp = computeTP(actualEntry, resolved.takeProfitPct);
  const maxLoss = actualEntry * (1 - resolved.maxLossPct);
  const currentStop = Math.max(softStop, maxLoss);

  const allDates = Object.keys(priceHistory).sort();
  const startIdx = allDates.indexOf(entryDate);
  if (startIdx < 0) return null;

  let status = 'open', exitDate = null, exitPrice = null, daysHeld = 0;

  for (let i = startIdx; i < allDates.length && daysHeld <= resolved.timeoutDays; i++) {
    const date = allDates[i];
    const bar = priceHistory[date];
    if (!bar) continue;
    daysHeld++;

    // SL check
    if (bar.low <= currentStop) {
      status = 'sl'; exitDate = date; exitPrice = currentStop; break;
    }

    // TP check
    if (bar.high >= tp) {
      status = 'tp1'; exitDate = date; exitPrice = tp; break;
    }

    // Bearish pattern exit (from day 2+)
    if (daysHeld >= 2 && i >= 2) {
      const recentBars = [];
      for (let j = Math.max(0, i - 59); j <= i; j++) {
        const d = allDates[j], b = priceHistory[d];
        if (b) recentBars.push({ date: d, open: b.open, high: b.high, low: b.low, close: b.close, volume: 0 });
      }
      if (recentBars.length >= 3) {
        const bearish = checkBearishExit(recentBars);
        if (bearish) {
          status = bar.close >= actualEntry ? 'trail' : 'sl';
          exitDate = date; exitPrice = bar.close; break;
        }
      }
    }
  }

  // Timeout
  if (status === 'open') {
    const lastIdx = Math.min(startIdx + resolved.timeoutDays, allDates.length - 1);
    const lastDate = allDates[lastIdx];
    const lastBar = priceHistory[lastDate];
    if (lastBar) {
      status = 'expired'; exitDate = lastDate; exitPrice = lastBar.close;
    } else {
      status = 'pending'; exitDate = null; exitPrice = entryBar.close;
    }
  }

  const pnlPct = (exitPrice - actualEntry) / actualEntry;

  return {
    ticker: setup.ticker, strategy: 'candlestick', score: setup.score || 0,
    scanDate, entryDate, actualEntry, actualStop: currentStop, actualTp1: tp, actualTp2: null,
    status, exitDate, exitPrice, pnlPct, holdDays: daysHeld,
    source: setup.source || 'signals',
    pattern: setup.pattern || null,
    pmMode: 'NORMAL',
  };
}

function computeATRFromHistory(priceHistory, beforeDate, periods) {
  const dates = Object.keys(priceHistory).filter(d => d < beforeDate).sort().slice(-periods - 1);
  if (dates.length < 2) return null;
  let sum = 0, count = 0;
  for (let i = 1; i < dates.length; i++) {
    const prev = priceHistory[dates[i - 1]], cur = priceHistory[dates[i]];
    if (!prev || !cur) continue;
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    count++;
  }
  return count > 0 ? sum / count : null;
}

function isPatternInvalidated(setup, bar, entryPrice) {
  if (!setup.pattern || setup.pattern.invalidation == null) {
    return { invalidated: false };
  }
  const invPrice = setup.pattern.invalidation;
  if (bar.low <= invPrice) {
    return { invalidated: true, reason: 'price_below_invalidation', level: invPrice };
  }
  return { invalidated: false };
}

module.exports = {
  DEFAULT_CONFIG, selectMode, resolveConfig, computeEntry, computeStop, computeTP,
  shouldRotate, checkBearishExit, simulateAmericanBullTrade, bleedingFraction,
  isPatternInvalidated,
};
