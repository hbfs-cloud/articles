'use strict';

/**
 * americanbull-pm.js — Position manager for candlestick-based trades.
 * Replicates systematic-tss americanbulls position manager logic.
 *
 * Entry:  on confirmed pattern + volume spike
 * Stop:   pattern invalidation level (below pattern low)
 * TP:     pattern target (measured move) or swing high
 * Exit:   pattern invalidation (close below pattern range) = early exit
 *
 * Used by:
 *   - sweep.js: simulateTrade() calls isPatternInvalidated() for early exit
 *   - signal-monitor.js: live monitoring calls checkPatternHealth()
 */

const { scanPatterns } = require('./candlestick-patterns');

// ─── Trade-time pattern validation ──────────────────────────────────────────

/**
 * Check if a candlestick pattern is invalidated by subsequent price action.
 * Called during sweep.js day-by-day simulation loop.
 *
 * @param {object} setup — trade setup with pattern metadata
 * @param {object} bar — current day OHLCV bar { open, high, low, close }
 * @param {number} entryPrice — actual entry price
 * @returns {{ invalidated: boolean, reason: string }}
 */
function isPatternInvalidated(setup, bar, entryPrice) {
  if (!setup.pattern) return { invalidated: false, reason: null };

  const patternLow = setup.pattern.invalidation || setup.stop;

  // Hard invalidation: close below pattern low
  if (bar.close < patternLow) {
    return { invalidated: true, reason: 'close_below_pattern' };
  }

  // Soft invalidation: bearish engulfing against our position (reversal of reversal)
  if (bar.close < bar.open) {
    const bodyPct = Math.abs(bar.close - bar.open) / bar.open * 100;
    if (bodyPct > 3.0 && bar.close < entryPrice * 0.98) {
      return { invalidated: true, reason: 'bearish_reversal_candle' };
    }
  }

  return { invalidated: false, reason: null };
}

/**
 * Compute americanbull-specific stop level from pattern geometry.
 * Uses pattern invalidation level with a small buffer (0.5% below pattern low).
 *
 * @param {object} setup — setup with pattern.invalidation
 * @returns {number|null} — stop price, or null if no pattern data
 */
function computePatternStop(setup) {
  if (!setup.pattern || !setup.pattern.invalidation) return null;
  return +(setup.pattern.invalidation * 0.995).toFixed(2);
}

/**
 * Compute americanbull TP levels from pattern geometry.
 * TP1 = pattern measured move target
 * TP2 = 1.5× measured move (runner target)
 *
 * @param {object} setup — setup with pattern metadata
 * @param {number} entry — entry price
 * @returns {{ tp1: number, tp2: number }|null}
 */
function computePatternTargets(setup, entry) {
  if (!setup.pattern || !setup.pattern.patternTarget) return null;
  const tp1 = setup.pattern.patternTarget;
  const risk = entry - (setup.pattern.invalidation || setup.stop);
  if (risk <= 0) return null;
  const tp2 = +(entry + risk * 3).toFixed(2);
  return { tp1: +tp1.toFixed(2), tp2 };
}

// ─── Live monitoring integration (signal-monitor.js) ────────────────────────

/**
 * Check pattern health for live position monitoring.
 * Returns alert level and message for Telegram notification.
 *
 * @param {object} position — from scanner-positions.json
 * @param {object} liveBar — { price, dayHigh, dayLow, dayVolume }
 * @returns {{ alert: 'none'|'warning'|'exit', message: string }}
 */
function checkPatternHealth(position, liveBar) {
  if (!position.pattern) return { alert: 'none', message: '' };

  const patternLow = position.pattern.invalidation || position.stop;

  if (liveBar.price < patternLow) {
    return {
      alert: 'exit',
      message: `⚠️ ${position.ticker}: Pattern invalidated — price $${liveBar.price} below pattern low $${patternLow.toFixed(2)}`,
    };
  }

  if (liveBar.dayLow < patternLow * 1.01) {
    return {
      alert: 'warning',
      message: `🔶 ${position.ticker}: Price nearing pattern invalidation ($${liveBar.dayLow.toFixed(2)} vs $${patternLow.toFixed(2)})`,
    };
  }

  return { alert: 'none', message: '' };
}

/**
 * Determine if a new pattern confirmation warrants scaling in (partial entry).
 * Systematic-tss americanbulls PM scales in on "breakout confirmation" after initial pattern.
 *
 * @param {Array} bars — recent OHLCV bars for the position's ticker
 * @param {object} position — existing position
 * @returns {{ scaleIn: boolean, reason: string }}
 */
function shouldScaleIn(bars, position) {
  if (!bars || bars.length < 25) return { scaleIn: false, reason: 'insufficient_data' };

  const patterns = scanPatterns(bars);
  if (!patterns.length) return { scaleIn: false, reason: 'no_new_pattern' };

  const newPattern = patterns[0];
  if (!newPattern.confirmed || !newPattern.volumeSpike) {
    return { scaleIn: false, reason: 'pattern_not_confirmed' };
  }

  const last = bars[bars.length - 1];
  if (last.close <= position.entry) {
    return { scaleIn: false, reason: 'below_entry' };
  }

  return {
    scaleIn: true,
    reason: `New ${newPattern.name} at $${last.close.toFixed(2)} with volume spike — confirms trend`,
  };
}

module.exports = {
  isPatternInvalidated,
  computePatternStop,
  computePatternTargets,
  checkPatternHealth,
  shouldScaleIn,
};
