/**
 * Market Regime Detector
 * Calculates regime from VIX, yield curve, breadth, momentum
 * Emits regime change alerts
 */

import * as yahoo from './yahoo.js';

let currentRegime = null;
let onRegimeChange = null;

const REGIMES = {
  RISK_ON: { label: 'RISK-ON', color: '#10b981', description: 'Bullish regime — favor momentum, growth, small-caps' },
  NEUTRAL: { label: 'NEUTRAL', color: '#f59e0b', description: 'Mixed signals — selective positioning, balanced exposure' },
  EARLY_RISK_OFF: { label: 'EARLY RISK-OFF', color: '#f97316', description: 'Warning signs — reduce risk, add hedges, tighten stops' },
  RISK_OFF: { label: 'RISK-OFF', color: '#ef4444', description: 'Defensive mode — favor cash, gold, bonds, inverse ETFs' },
  CRISIS: { label: 'CRISIS', color: '#7f1d1d', description: 'Capital preservation — max hedges, reduce all exposure' }
};

export function onRegimeChangeCallback(cb) {
  onRegimeChange = cb;
}

export async function detect() {
  try {
    const quotes = await yahoo.getQuotes(['^VIX', '^TNX', 'SPY', 'IWM', 'GLD', 'TLT', 'HYG']);

    const vix = quotes.find(q => q.symbol === '^VIX')?.price || 20;
    const tnx = quotes.find(q => q.symbol === '^TNX')?.price || 4.0;
    const spy = quotes.find(q => q.symbol === 'SPY');
    const iwm = quotes.find(q => q.symbol === 'IWM');
    const gld = quotes.find(q => q.symbol === 'GLD');

    // Score: higher = more risk-off
    let riskScore = 0;

    // VIX levels
    if (vix < 15) riskScore -= 2;
    else if (vix < 20) riskScore -= 1;
    else if (vix < 25) riskScore += 1;
    else if (vix < 30) riskScore += 2;
    else if (vix < 40) riskScore += 3;
    else riskScore += 4;

    // SPY trend (above/below 200 SMA proxy via 200-day avg)
    if (spy?.price && spy?.twoHundredDayAvg) {
      if (spy.price > spy.twoHundredDayAvg * 1.05) riskScore -= 1;
      else if (spy.price < spy.twoHundredDayAvg * 0.95) riskScore += 2;
      else if (spy.price < spy.twoHundredDayAvg) riskScore += 1;
    }

    // SPY daily change
    if (spy?.changePct) {
      if (spy.changePct < -2) riskScore += 2;
      else if (spy.changePct < -1) riskScore += 1;
      else if (spy.changePct > 1) riskScore -= 1;
    }

    // Small-cap relative strength
    if (iwm?.changePct && spy?.changePct) {
      const relStr = iwm.changePct - spy.changePct;
      if (relStr > 1) riskScore -= 1; // small-caps leading = risk-on
      if (relStr < -1) riskScore += 1; // small-caps lagging = risk-off
    }

    // Gold strength (safe haven)
    if (gld?.changePct) {
      if (gld.changePct > 1) riskScore += 1; // gold rising = risk-off
      if (gld.changePct < -1) riskScore -= 1;
    }

    // Determine regime
    let regime;
    if (riskScore <= -2) regime = REGIMES.RISK_ON;
    else if (riskScore <= 0) regime = REGIMES.NEUTRAL;
    else if (riskScore <= 2) regime = REGIMES.EARLY_RISK_OFF;
    else if (riskScore <= 4) regime = REGIMES.RISK_OFF;
    else regime = REGIMES.CRISIS;

    const result = {
      regime: regime.label,
      color: regime.color,
      description: regime.description,
      score: riskScore,
      components: {
        vix,
        tnx,
        spyPrice: spy?.price,
        spyChange: spy?.changePct,
        spy200: spy?.twoHundredDayAvg,
        iwmChange: iwm?.changePct,
        gldChange: gld?.changePct
      },
      timestamp: new Date().toISOString()
    };

    // Check for regime change
    if (currentRegime && currentRegime.regime !== regime.label && onRegimeChange) {
      onRegimeChange({
        from: currentRegime.regime,
        to: regime.label,
        description: regime.description,
        timestamp: result.timestamp
      });
    }

    currentRegime = result;
    return result;
  } catch (err) {
    return {
      regime: currentRegime?.regime || 'UNKNOWN',
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

export function getCurrent() {
  return currentRegime;
}
