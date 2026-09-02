'use strict';

const MIN_MARKETDATA_BUILD = '0424cf4b';
const ASSET_CALENDARS = new Set(['us_equity_exchange_sessions', 'crypto_24_7_utc']);

function scalar(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null && value[key] !== '') return value[key];
  }
  return null;
}

function boolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
}

function identifier(value) {
  const id = scalar(value, ['symbol', 'instrument_id']);
  return id == null ? null : String(id);
}

function findObjectByKey(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (value[key] && typeof value[key] === 'object') return value[key];
  for (const child of Object.values(value)) {
    const found = findObjectByKey(child, key);
    if (found) return found;
  }
  return null;
}

function findBuild(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['server_version', 'deployment_id', 'commit_hash', 'commit']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  for (const child of Object.values(value)) {
    const found = findBuild(child);
    if (found) return found;
  }
  return null;
}

function findQueryResults(value) {
  const results = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (Array.isArray(node.cells)) {
      results.push(node);
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return results;
}

function structuredReason(cell) {
  const rejection = scalar(cell, ['rejection_reason', 'not_applicable_reason']);
  if (rejection != null) return String(rejection).trim();
  if (typeof cell.error === 'string') return cell.error.trim();
  if (cell.error && typeof cell.error === 'object' && Object.keys(cell.error).length) return JSON.stringify(cell.error);
  return '';
}

function proofFor(cell, row) {
  const coverage = row && row.coverage && typeof row.coverage === 'object' ? row.coverage : {};
  return {
    assetCalendar: scalar(cell, ['asset_calendar']) || scalar(row, ['asset_calendar']) || scalar(coverage, ['asset_calendar']),
    expectedCompletedEnd: scalar(cell, ['expected_completed_end']) || scalar(row, ['expected_completed_end']) || scalar(coverage, ['expected_completed_end', 'expected_session_end']),
    servedCompletedEnd: scalar(cell, ['served_completed_end']) || scalar(row, ['served_completed_end']) || scalar(coverage, ['served_completed_end', 'served_end']),
    requestedEndState: scalar(cell, ['requested_end_state']) || scalar(row, ['requested_end_state']) || scalar(coverage, ['requested_end_state']),
    lastBarComplete: boolean(scalar(cell, ['last_bar_complete']) ?? scalar(row, ['last_bar_complete']) ?? scalar(coverage, ['last_bar_complete', 'complete'])),
    retryAt: scalar(cell, ['retry_at', 'next_complete_available_at']) || scalar(row, ['retry_at', 'next_complete_available_at']) || scalar(coverage, ['retry_at', 'next_complete_available_at']),
  };
}

/**
 * Validate the terminal state and completed-close proof of every QueryData cell.
 * Healthy cells remain returned even when another cell fails, so callers can
 * persist the full batch while still failing the publication gate.
 */
function validateQueryData(value, options = {}) {
  const expectedIds = String(options.symbols || '').split(',').map(item => item.trim()).filter(Boolean);
  const results = findQueryResults(value);
  const cells = results.flatMap(result => result.cells || []);
  const rows = results.flatMap(result => Array.isArray(result.data) ? result.data : []);
  const rowsById = new Map();
  for (const row of rows) {
    const id = identifier(row);
    if (id) {
      if (!rowsById.has(id)) rowsById.set(id, []);
      rowsById.get(id).push(row);
    }
  }

  const errors = [];
  const healthyCells = [];
  const seen = new Map();
  let retryAt = null;
  for (const cell of cells) {
    const id = identifier(cell);
    const status = String(cell.status || '').toLowerCase();
    if (!id) {
      errors.push('QueryData cell missing symbol/instrument_id');
      continue;
    }
    seen.set(id, (seen.get(id) || 0) + 1);
    if (status === 'completed_without_data') {
      errors.push(`${id}: completed_without_data is forbidden (fail-closed)`);
      continue;
    }
    if (status === 'not_applicable') {
      if (!String(cell.not_applicable_reason || '').trim()) errors.push(`${id}: not_applicable missing not_applicable_reason`);
      else healthyCells.push({ id, status, cell, row: null });
      continue;
    }
    if (status === 'failed' || status === 'unavailable') {
      if (!structuredReason(cell)) errors.push(`${id}: ${status} missing rejection_reason/structured error`);
      else errors.push(`${id}: ${status}: ${structuredReason(cell)}`);
      const proof = proofFor(cell, null);
      if (proof.retryAt && (!retryAt || String(proof.retryAt) < retryAt)) retryAt = String(proof.retryAt);
      continue;
    }
    if (status !== 'completed') {
      errors.push(`${id}: non-terminal or unknown cell status ${status || '(missing)'}`);
      continue;
    }
    const matches = rowsById.get(id) || [];
    if (matches.length !== 1) {
      errors.push(`${id}: completed cell must map to exactly one data row (got ${matches.length})`);
      continue;
    }
    const row = matches[0];
    const proof = proofFor(cell, row);
    if (proof.retryAt && (!retryAt || String(proof.retryAt) < retryAt)) retryAt = String(proof.retryAt);
    if (options.assetCalendar && proof.assetCalendar !== options.assetCalendar) {
      errors.push(`${id}: asset_calendar mismatch (expected ${options.assetCalendar}, got ${proof.assetCalendar || 'missing'})`);
    }
    if (options.expectedCompletedEnd) {
      if (!proof.expectedCompletedEnd) errors.push(`${id}: missing expected_completed_end`);
      else if (String(proof.expectedCompletedEnd) !== String(options.expectedCompletedEnd)) {
        errors.push(`${id}: expected_completed_end mismatch (expected ${options.expectedCompletedEnd}, got ${proof.expectedCompletedEnd})`);
      }
      if (!proof.servedCompletedEnd) errors.push(`${id}: missing served_completed_end`);
      else if (String(proof.servedCompletedEnd) !== String(options.expectedCompletedEnd)) {
        errors.push(`${id}: served_completed_end mismatch (expected ${options.expectedCompletedEnd}, got ${proof.servedCompletedEnd})`);
      }
    }
    // current_bar_open describes the requested end, not stale data. It is safe
    // only when the separately served completed end is proven above.
    if (proof.lastBarComplete === false) errors.push(`${id}: last bar is partial (complete=false) and cannot satisfy a close gate`);
    if (!errors.some(error => error.startsWith(`${id}:`))) healthyCells.push({ id, status, cell, row, proof });
  }

  for (const id of expectedIds) {
    const count = seen.get(id) || 0;
    if (count !== 1) errors.push(`${id}: expected exactly one terminal cell (got ${count})`);
  }
  for (const [id, count] of seen) if (count !== 1) errors.push(`${id}: duplicate terminal cells (${count})`);
  if (expectedIds.length && cells.length === 0) errors.push('QueryData returned no terminal cells');

  const completedEnds = healthyCells
    .filter(item => item.status === 'completed' && item.proof && item.proof.servedCompletedEnd)
    .map(item => String(item.proof.servedCompletedEnd));
  return {
    errors: [...new Set(errors)],
    healthyCells,
    retryAt,
    completedDataThrough: completedEnds.length ? completedEnds.sort()[0] : null,
  };
}

function validateOperationReadiness(value, expectations = {}) {
  const readiness = findObjectByKey(value, 'operation_readiness');
  const errors = [];
  let retryAt = null;
  if (!readiness) return { errors: ['marketdata GetStatus missing operation_readiness'], retryAt };
  const build = findBuild(value);
  if (expectations.minimumBuild && !build) errors.push(`marketdata build identity missing (minimum ${expectations.minimumBuild})`);
  // Git hashes have no lexical ordering. A different/newer hash is accepted
  // only through the capability checks below; the known floor hash is recorded
  // in every harness and all required 0424cf4b fields remain mandatory.

  const checks = [];
  if (expectations.equityReferenceClose) checks.push({
    key: 'bars_daily_us_equity', calendar: 'us_equity_exchange_sessions', expected: expectations.equityReferenceClose,
  });
  if (expectations.equityCoversClose && !expectations.equityReferenceClose) checks.push({
    key: 'bars_daily_us_equity', calendar: 'us_equity_exchange_sessions', covers: expectations.equityCoversClose,
  });
  if (expectations.cryptoCompletedRefdate) checks.push({
    key: 'bars_daily_crypto_utc', calendar: 'crypto_24_7_utc', expected: expectations.cryptoCompletedRefdate,
  });
  for (const check of checks) {
    const operation = readiness[check.key];
    if (!operation || typeof operation !== 'object') {
      errors.push(`operation_readiness.${check.key} missing`);
      continue;
    }
    if (String(operation.status || '').toLowerCase() !== 'ready') errors.push(`${check.key} not ready (${operation.status || 'missing status'})`);
    if (operation.asset_calendar !== check.calendar) errors.push(`${check.key} asset_calendar mismatch (expected ${check.calendar}, got ${operation.asset_calendar || 'missing'})`);
    const serverExpected = String(operation.expected_completed_end || check.expected || operation.served_completed_end || '');
    const served = String(operation.served_completed_end || '');
    if (check.expected && serverExpected !== String(check.expected)) errors.push(`${check.key} expected_completed_end mismatch (expected ${check.expected}, got ${serverExpected || 'missing'})`);
    if (!served || served !== serverExpected) errors.push(`${check.key} served_completed_end mismatch (expected ${serverExpected || check.expected}, got ${served || 'missing'})`);
    if (check.covers && served < String(check.covers)) errors.push(`${check.key} does not cover completed close ${check.covers} (got ${served || 'missing'})`);
    const announcedRetry = operation.retry_at || operation.next_complete_available_at;
    if (announcedRetry && (!retryAt || String(announcedRetry) < retryAt)) retryAt = String(announcedRetry);
  }

  if (expectations.secOperation) {
    const sec = readiness[expectations.secOperation];
    if (!sec || typeof sec !== 'object') errors.push(`operation_readiness.${expectations.secOperation} missing`);
    else if (String(sec.status || '').toLowerCase() !== 'ready') errors.push(`${expectations.secOperation} not ready (${sec.status || 'missing status'})`);
  }
  return { errors: [...new Set(errors)], retryAt, build };
}

function validateRefreshBars(value, expectedCompletedEnd) {
  const payload = value && value.result && typeof value.result === 'object' ? value.result : value;
  const errors = [];
  const completed = scalar(payload, ['last_completed_bar_after']);
  const complete = boolean(scalar(payload, ['last_bar_complete']));
  if (!completed) errors.push('RefreshBars missing last_completed_bar_after');
  else if (expectedCompletedEnd && String(completed).slice(0, 10) !== String(expectedCompletedEnd)) {
    errors.push(`RefreshBars last_completed_bar_after mismatch (expected ${expectedCompletedEnd}, got ${completed})`);
  }
  if (complete !== true) errors.push('RefreshBars last_bar_complete must be true to certify a close');
  return errors;
}

module.exports = {
  ASSET_CALENDARS,
  MIN_MARKETDATA_BUILD,
  findQueryResults,
  validateOperationReadiness,
  validateQueryData,
  validateRefreshBars,
};
