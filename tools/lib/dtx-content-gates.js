'use strict';

const dtxScan = require('../dtx-scan');

function unwrapResult(value) {
  return value && value.result && typeof value.result === 'object' ? value.result : value;
}

function validateDtxDecision(value, expected = {}) {
  const decision = unwrapResult(value);
  const errors = dtxScan.validateDecisionV2(decision, {
    asof: expected.asof,
    requestId: expected.requestId,
  });
  if (!decision || typeof decision !== 'object') return errors;
  if (expected.referenceClose && decision.expected_data_date !== expected.referenceClose) {
    errors.push(`expected_data_date=${decision.expected_data_date || 'missing'} != ${expected.referenceClose}`);
  }
  if (expected.referenceClose && decision.data_asof !== expected.referenceClose) {
    errors.push(`data_asof=${decision.data_asof || 'missing'} != ${expected.referenceClose}`);
  }
  if (Number(decision.sessions_behind || 0) !== 0) errors.push(`sessions_behind=${decision.sessions_behind}`);
  return [...new Set(errors)];
}

function validateDtxReplay(value, expected = {}) {
  const replay = unwrapResult(value);
  const errors = [];
  if (!replay || typeof replay !== 'object') return ['replay missing'];
  if (expected.portfolio && replay.portfolio_id !== expected.portfolio) {
    errors.push(`portfolio_id=${replay.portfolio_id || 'missing'} != ${expected.portfolio}`);
  }
  if (expected.referenceClose && replay.data_asof !== expected.referenceClose) {
    errors.push(`replay data_asof=${replay.data_asof || 'missing'} != ${expected.referenceClose}`);
  }
  if (Number(replay.sessions_behind || 0) !== 0) errors.push(`replay sessions_behind=${replay.sessions_behind}`);
  if (!Array.isArray(replay.results) || replay.results.length === 0) return [...errors, 'replay results[] missing'];
  for (let index = 0; index < replay.results.length; index++) {
    const row = replay.results[index] || {};
    const prefix = `replay results[${index}]`;
    if (!Array.isArray(row.equity_dates) || !Array.isArray(row.equity_values) || row.equity_dates.length < 2) {
      errors.push(`${prefix} equity curve missing`);
      continue;
    }
    if (row.equity_dates.length !== row.equity_values.length) errors.push(`${prefix} equity date/value lengths differ`);
    if (row.end_date !== row.equity_dates[row.equity_dates.length - 1]) errors.push(`${prefix} end_date differs from final equity date`);
    if (row.equity_values.some(item => typeof item !== 'number' || !Number.isFinite(item) || item <= 0)) {
      errors.push(`${prefix} equity values must be positive finite numbers`);
    }
    for (const field of ['cagr_pct', 'max_dd_pct', 'sharpe', 'r2', 'win_rate', 'total_trades', 'return_pct', 'final_equity']) {
      if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) errors.push(`${prefix} ${field} missing/invalid`);
    }
  }
  return [...new Set(errors)];
}

module.exports = { unwrapResult, validateDtxDecision, validateDtxReplay };
