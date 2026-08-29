'use strict';

const crypto = require('crypto');

function curveProofPayload(dates, values, metrics) {
  return {
    dates,
    values,
    metrics: {
      cagr_pct: metrics.cagr_pct,
      max_dd_pct: metrics.max_dd_pct,
      sharpe: metrics.sharpe,
      avg_exposure_pct: metrics.avg_exposure_pct,
      initial_capital: metrics.initial_capital,
      committed_capital: metrics.committed_capital,
      trading_days_per_year: metrics.trading_days_per_year,
      measured_at: metrics.measured_at,
      basis: metrics.basis,
    },
  };
}

function bookCurveSha256(dates, values, metrics) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(curveProofPayload(dates, values, metrics)))
    .digest('hex');
}

module.exports = { curveProofPayload, bookCurveSha256 };
