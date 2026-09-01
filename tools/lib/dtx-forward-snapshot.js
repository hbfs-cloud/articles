'use strict';

const PERFORMANCE_SCOPE = 'forward_execution';
const REFERENCE_SCOPE = 'reference_backtest';

function forwardStatus(cfg = {}) {
  const value = cfg.forwardTracking && cfg.forwardTracking.status;
  return typeof value === 'string' && value.trim() ? value.trim() : 'not_started';
}

function executedTrades(cfg = {}) {
  const raw = cfg.forwardTracking && cfg.forwardTracking.executedTrades;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Public Time Machine fields for a DTX mode.
 *
 * DTX replay data is reference evidence, never an execution ledger.  Keep every
 * forward-performance field empty until the broker ledger certifies fills.
 */
function buildDtxForwardSnapshotFields(cfg = {}) {
  const status = forwardStatus(cfg);
  return {
    stats: {
      scope: PERFORMANCE_SCOPE,
      status,
      ret: null,
      realized: null,
      unrealized: null,
      dd: null,
      wr: null,
      pf: null,
      pfLow: null,
      pfHigh: null,
      pfReliable: null,
      trades: executedTrades(cfg),
      avgHold: null,
      oosWarn: null,
      r2: null,
      cagr: null,
      sharpe: null,
    },
    equity: { d: [], v: [], scope: PERFORMANCE_SCOPE, status },
    signals: [],
    positions: [],
    orders: [],
    recentRotation: null,
    closeNow: [],
    expiresTomorrow: [],
    closedTrades: [],
    pit_stats: null,
    pit_equity: null,
  };
}

/** Keep replay evidence namespaced away from the forward hero. */
function buildDtxReferenceSnapshot(cfg = {}, metrics = {}, equity = null) {
  const source = metrics && typeof metrics === 'object' ? metrics : {};
  const curve = equity && Array.isArray(equity.d) && Array.isArray(equity.v)
    ? { d: [...equity.d], v: [...equity.v] }
    : { d: [], v: [] };
  return {
    scope: REFERENCE_SCOPE,
    status: curve.d.length || Object.keys(source).length ? 'available' : 'unavailable',
    measuredAt: cfg.referenceMeasuredAt || null,
    dataAsOf: cfg.referenceDataAsOf || null,
    stats: {
      ret: source.ret ?? null,
      dd: source.dd ?? null,
      wr: source.wr ?? null,
      pf: source.pf ?? null,
      trades: source.trades ?? null,
      avgHold: source.avgHold ?? null,
      r2: source.r2 ?? null,
      cagr: source.cagr ?? null,
      sharpe: source.sharpe ?? null,
    },
    equity: curve,
    stress: cfg.stressReference || null,
  };
}

module.exports = {
  PERFORMANCE_SCOPE,
  REFERENCE_SCOPE,
  buildDtxForwardSnapshotFields,
  buildDtxReferenceSnapshot,
};
