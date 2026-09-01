'use strict';

const MIN_MARKETDATA_BUILD = '0424cf4b';
// Git hashes are not orderable. The client therefore keeps a fail-closed list
// of builds whose ancestry from MIN_MARKETDATA_BUILD was verified in the
// Marketdata source repository. 0e946129 was checked with:
//   git merge-base --is-ancestor 0424cf4b 0e94612996111518814c6415e38cb5c913c9309d
// on 2026-09-01 before this release. 4d8a54f1 was checked as a descendant
// of both 0424cf4b and the prior live 0e946129 before its live probes.
// d24684fb was then checked as a descendant of 0424cf4b, 0e946129 and
// 4d8a54f1 before its post-ready single-symbol SEC and daily-calendar probes.
const AUDITED_MARKETDATA_BUILDS = new Set([
  MIN_MARKETDATA_BUILD,
  '0424cf4bc65f117e15497c1e83d86e91c441635d',
  '0e946129',
  '0e94612996111518814c6415e38cb5c913c9309d',
  '4d8a54f1',
  '4d8a54f183c17f60e946e06f5caa4e31bd97378c',
  'd24684fb',
  'd24684fbb8f415d8bd7632f23a25f7d17a75f24c',
]);
const ASSET_CALENDARS = new Set(['us_equity_exchange_sessions', 'crypto_24_7_utc']);
const GET_STATUS_CONTRACT_ASSERTIONS = new Set([
  'equity_reference_close',
  'crypto_completed_refdate',
  'sec_operation',
  'expected_intraday_close',
]);

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

function ownScalar(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  const candidate = value[key];
  return candidate == null || candidate === '' ? null : candidate;
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
  const payload = value && value.result && typeof value.result === 'object' ? value.result : value;
  const build = payload && payload.server_version;
  return typeof build === 'string' && build.trim() ? build.trim() : null;
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

function exactProofValue(cell, row, key, normalize = value => String(value)) {
  const values = [ownScalar(cell, key), ownScalar(row, key)].filter(value => value != null);
  if (!values.length) return { value: null, conflict: false };
  const normalized = values.map(normalize);
  return { value: values[0], conflict: normalized.some(value => value !== normalized[0]) };
}

function proofFor(cell, row) {
  const assetCalendar = exactProofValue(cell, row, 'asset_calendar');
  const expectedCompletedEnd = exactProofValue(cell, row, 'expected_completed_end');
  const servedCompletedEnd = exactProofValue(cell, row, 'served_completed_end');
  const requestedEndState = exactProofValue(cell, row, 'requested_end_state');
  const lastBarComplete = exactProofValue(cell, row, 'last_bar_complete', value => String(boolean(value)));
  const currentBarIncluded = exactProofValue(cell, row, 'current_bar_included', value => String(boolean(value)));
  const currentBarComplete = exactProofValue(cell, row, 'current_bar_complete', value => String(boolean(value)));
  const retryAt = exactProofValue(cell, row, 'retry_at');
  const nextCompleteAvailableAt = exactProofValue(cell, row, 'next_complete_available_at');
  return {
    assetCalendar: assetCalendar.value,
    expectedCompletedEnd: expectedCompletedEnd.value,
    servedCompletedEnd: servedCompletedEnd.value,
    requestedEndState: requestedEndState.value,
    lastBarComplete: boolean(lastBarComplete.value),
    currentBarIncluded: boolean(currentBarIncluded.value),
    currentBarComplete: boolean(currentBarComplete.value),
    retryAt: retryAt.value || nextCompleteAvailableAt.value,
    conflicts: [
      ['asset_calendar', assetCalendar],
      ['expected_completed_end', expectedCompletedEnd],
      ['served_completed_end', servedCompletedEnd],
      ['requested_end_state', requestedEndState],
      ['last_bar_complete', lastBarComplete],
      ['current_bar_included', currentBarIncluded],
      ['current_bar_complete', currentBarComplete],
      ['retry_at', retryAt],
      ['next_complete_available_at', nextCompleteAvailableAt],
    ].filter(([, result]) => result.conflict).map(([key]) => key),
  };
}

function lastBarDate(row) {
  if (!row || !Array.isArray(row.bars) || !row.bars.length) return null;
  const last = row.bars[row.bars.length - 1];
  if (Array.isArray(last)) return last[0] == null ? null : String(last[0]).slice(0, 10);
  if (last && typeof last === 'object') {
    const date = ownScalar(last, 'date') || ownScalar(last, 'timestamp') || ownScalar(last, 'time');
    return date == null ? null : String(date).slice(0, 10);
  }
  return null;
}

/**
 * Validate the terminal state and completed-close proof of every QueryData cell.
 * Healthy cells remain returned even when another cell fails, so callers can
 * persist the full batch while still failing the publication gate.
 */
function validateQueryData(value, options = {}) {
  const expectedIds = String(options.symbols || '').split(',').map(item => item.trim()).filter(Boolean);
  const expectedIdSet = new Set(expectedIds);
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
    const cellErrors = [];
    if (expectedIds.length && !expectedIdSet.has(id)) cellErrors.push(`${id}: unexpected terminal cell`);
    if (status === 'completed_without_data') {
      errors.push(...cellErrors, `${id}: completed_without_data is forbidden (fail-closed)`);
      continue;
    }
    if (status === 'not_applicable') {
      if (!String(cell.not_applicable_reason || '').trim()) cellErrors.push(`${id}: not_applicable missing not_applicable_reason`);
      if (ownScalar(cell, 'rejection_reason') != null || ownScalar(cell, 'error') != null) {
        cellErrors.push(`${id}: not_applicable carries a conflicting failure reason`);
      }
      if ((rowsById.get(id) || []).length) cellErrors.push(`${id}: not_applicable must not carry a data row`);
      errors.push(...cellErrors);
      if (!cellErrors.length) healthyCells.push({ id, status, cell, row: null });
      continue;
    }
    if (status === 'failed' || status === 'unavailable') {
      if (ownScalar(cell, 'not_applicable_reason') != null) cellErrors.push(`${id}: ${status} carries a conflicting not_applicable_reason`);
      if (!structuredReason(cell)) cellErrors.push(`${id}: ${status} missing rejection_reason/structured error`);
      else cellErrors.push(`${id}: ${status}: ${structuredReason(cell)}`);
      if ((rowsById.get(id) || []).length) cellErrors.push(`${id}: ${status} must not carry a data row`);
      const proof = proofFor(cell, null);
      if (proof.retryAt && (!retryAt || String(proof.retryAt) < retryAt)) retryAt = String(proof.retryAt);
      errors.push(...cellErrors);
      continue;
    }
    if (status !== 'completed') {
      errors.push(...cellErrors, `${id}: non-terminal or unknown cell status ${status || '(missing)'}`);
      continue;
    }
    if (ownScalar(cell, 'not_applicable_reason') != null || ownScalar(cell, 'rejection_reason') != null || ownScalar(cell, 'error') != null) {
      cellErrors.push(`${id}: completed cell carries a conflicting terminal reason`);
    }
    const matches = rowsById.get(id) || [];
    if (matches.length !== 1) {
      errors.push(...cellErrors, `${id}: completed cell must map to exactly one data row (got ${matches.length})`);
      continue;
    }
    const row = matches[0];
    const proof = proofFor(cell, row);
    if (proof.retryAt && (!retryAt || String(proof.retryAt) < retryAt)) retryAt = String(proof.retryAt);
    for (const field of proof.conflicts) cellErrors.push(`${id}: conflicting ${field} between terminal cell and data row`);
    if (options.assetCalendar && proof.assetCalendar !== options.assetCalendar) {
      cellErrors.push(`${id}: asset_calendar mismatch (expected ${options.assetCalendar}, got ${proof.assetCalendar || 'missing'})`);
    }
    if (options.expectedCompletedEnd) {
      if (!proof.expectedCompletedEnd) cellErrors.push(`${id}: missing expected_completed_end`);
      else if (String(proof.expectedCompletedEnd) !== String(options.expectedCompletedEnd)) {
        cellErrors.push(`${id}: expected_completed_end mismatch (expected ${options.expectedCompletedEnd}, got ${proof.expectedCompletedEnd})`);
      }
      if (!proof.servedCompletedEnd) cellErrors.push(`${id}: missing served_completed_end`);
      else if (String(proof.servedCompletedEnd) !== String(options.expectedCompletedEnd)) {
        cellErrors.push(`${id}: served_completed_end mismatch (expected ${options.expectedCompletedEnd}, got ${proof.servedCompletedEnd})`);
      }
    }
    // current_bar_open describes the requested end, not stale data. It is safe
    // only when the separately served completed end is proven above.
    if (!proof.requestedEndState) cellErrors.push(`${id}: missing requested_end_state`);
    // QueryData certifies the close through expected/served_completed_end plus
    // the identified last data row. `last_bar_complete` is mandatory only on
    // RefreshBars; when QueryData does expose it, an explicit false still fails.
    if (proof.lastBarComplete === false) {
      cellErrors.push(`${id}: last_bar_complete=false cannot satisfy a close gate`);
    }
    if (proof.currentBarIncluded === true && proof.currentBarComplete !== true) {
      cellErrors.push(`${id}: included current bar is partial (complete=false) and cannot satisfy a close gate`);
    }
    const actualLastBar = lastBarDate(row);
    if (!actualLastBar) cellErrors.push(`${id}: completed data row has no identifiable bar`);
    else if (proof.servedCompletedEnd && actualLastBar !== String(proof.servedCompletedEnd).slice(0, 10)) {
      cellErrors.push(`${id}: last bar ${actualLastBar} != served_completed_end ${proof.servedCompletedEnd}`);
    }
    errors.push(...cellErrors);
    if (!cellErrors.length) healthyCells.push({ id, status, cell, row, proof });
  }

  for (const id of expectedIds) {
    const count = seen.get(id) || 0;
    if (count !== 1) errors.push(`${id}: expected exactly one terminal cell (got ${count})`);
  }
  for (const [id, count] of seen) if (count !== 1) errors.push(`${id}: duplicate terminal cells (${count})`);
  for (const id of rowsById.keys()) {
    if (!seen.has(id)) errors.push(`${id}: data row has no terminal cell`);
    if (expectedIds.length && !expectedIdSet.has(id)) errors.push(`${id}: unexpected data row`);
  }
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
  else if (expectations.minimumBuild && !AUDITED_MARKETDATA_BUILDS.has(build)) {
    // Git hashes have no ordering. Accepting an arbitrary different hash as
    // "newer" would turn the minimum version into a no-op. Every descendant
    // must be admitted only after an explicit ancestry + contract audit.
    errors.push(`marketdata build ${build} is not an audited descendant of ${expectations.minimumBuild}`);
  }

  const checks = [];
  if (expectations.equityReferenceClose) checks.push({
    key: 'bars_daily_us_equity', calendar: 'us_equity_exchange_sessions', expected: expectations.equityReferenceClose,
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
    const serverExpected = String(operation.expected_completed_end || '');
    const served = String(operation.served_completed_end || '');
    if (!serverExpected) errors.push(`${check.key} expected_completed_end missing`);
    if (check.expected && serverExpected !== String(check.expected)) errors.push(`${check.key} expected_completed_end mismatch (expected ${check.expected}, got ${serverExpected || 'missing'})`);
    if (!served || served !== serverExpected) errors.push(`${check.key} served_completed_end mismatch (expected ${serverExpected || check.expected}, got ${served || 'missing'})`);
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

function hasGetStatusContractAssertions(assertions = {}) {
  return Object.keys(assertions || {}).some(key => GET_STATUS_CONTRACT_ASSERTIONS.has(key));
}

/**
 * Apply every contractual GetStatus assertion with explicit, calendar-specific
 * reference names. Legacy `covers_close`/`expected_close` aliases are rejected
 * by plan validation rather than silently weakening readiness semantics.
 */
function validateGetStatus(value, assertions = {}, options = {}) {
  const equityReferenceClose = assertions.equity_reference_close;
  const check = validateOperationReadiness(value, {
    equityReferenceClose,
    cryptoCompletedRefdate: assertions.crypto_completed_refdate,
    secOperation: assertions.sec_operation,
    minimumBuild: options.minimumBuild || MIN_MARKETDATA_BUILD,
  });
  const errors = [...check.errors];
  const expectedIntradayClose = assertions.expected_intraday_close;
  if (expectedIntradayClose) {
    const readiness = findObjectByKey(value, 'operation_readiness');
    const intraday = readiness && readiness.bars_intraday_15m;
    const state = String(intraday && intraday.status || '').toLowerCase();
    if (state !== 'ready') errors.push(`bars_intraday_15m not ready (${state || 'missing status'})`);
    const intradayClose = String(intraday && intraday.max_last_bar_at || '').slice(0, 10);
    if (intradayClose !== String(expectedIntradayClose)) {
      errors.push(`bars_intraday_15m close mismatch (expected ${expectedIntradayClose}, got ${intradayClose || 'missing'})`);
    }
  }
  return { ...check, errors: [...new Set(errors)] };
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
  AUDITED_MARKETDATA_BUILDS,
  ASSET_CALENDARS,
  GET_STATUS_CONTRACT_ASSERTIONS,
  MIN_MARKETDATA_BUILD,
  findQueryResults,
  hasGetStatusContractAssertions,
  validateGetStatus,
  validateOperationReadiness,
  validateQueryData,
  validateRefreshBars,
};
