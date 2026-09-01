'use strict';

const TERMINAL_STATUSES = new Set(['completed', 'not_applicable', 'failed', 'unavailable']);

function csvValues(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function identifiers(value) {
  if (!value || typeof value !== 'object') return [];
  return [...new Set(['symbol', 'instrument_id']
    .filter(key => Object.prototype.hasOwnProperty.call(value, key))
    .map(key => value[key])
    .filter(value => (typeof value === 'string' || typeof value === 'number') && String(value).trim())
    .map(value => String(value).trim()))];
}

function resultType(result) {
  const value = result && (result.data_type || result.type);
  return value == null ? null : String(value).trim() || null;
}

function structuredReason(cell) {
  if (!cell || typeof cell !== 'object') return '';
  if (cell.rejection_reason != null && String(cell.rejection_reason).trim()) {
    return String(cell.rejection_reason).trim();
  }
  if (typeof cell.error === 'string' && cell.error.trim()) return cell.error.trim();
  if (cell.error && typeof cell.error === 'object' && Object.keys(cell.error).length) {
    return JSON.stringify(cell.error);
  }
  return '';
}

function hasOwnValue(value, key) {
  return !!value && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, key)
    && value[key] != null && String(value[key]).trim() !== '';
}

function findQueryResults(value) {
  const results = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    // Symbol-scoped facets expose cells[]. Market-scoped facets (economic
    // events, rates, regime, etc.) have no artificial symbol and therefore no
    // cells; their data_type + aggregate terminal status is the route key.
    if (Array.isArray(node.cells)
        || (typeof node.data_type === 'string' && typeof node.status === 'string')) {
      results.push(node);
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return results;
}

function sharesIdentifier(left, right) {
  const rightIds = new Set(identifiers(right));
  return identifiers(left).some(id => rightIds.has(id));
}

/**
 * Validate the terminal envelope of every Marketdata QueryData cell, regardless
 * of facet. Validation is scoped per result/data_type: the same symbol is
 * expected to appear once for each requested facet, not once for the batch.
 *
 * A structurally valid failed/unavailable cell remains an error for the call,
 * while healthy siblings are returned for audit/persistence. The function is
 * pure and never removes data from the supplied response.
 */
function validateQueryDataCells(value, options = {}) {
  const expectedSymbols = csvValues(options.symbols);
  const expectedSymbolSet = new Set(expectedSymbols);
  const expectedTypes = csvValues(options.types);
  const expectedTypeSet = new Set(expectedTypes);
  const results = findQueryResults(value);
  const errors = [];
  const healthyCells = [];
  const failedCells = [];
  const seenTypes = new Map();
  let retryAt = null;

  if (!results.length) errors.push('QueryData returned no cell results or market-level results');

  for (const result of results) {
    const type = resultType(result);
    if (type) seenTypes.set(type, (seenTypes.get(type) || 0) + 1);
  }

  results.forEach((result, resultIndex) => {
    const type = resultType(result);
    const label = type || `result[${resultIndex}]`;
    const resultErrors = [];
    const aggregateStatus = typeof result.status === 'string'
      ? result.status.trim().toLowerCase() : '';
    const cells = Array.isArray(result.cells) ? result.cells : [];
    const marketScoped = expectedSymbols.length === 0 && cells.length === 0;
    if (!type) resultErrors.push(`${label}: missing data_type`);
    else {
      if (expectedTypes.length && !expectedTypeSet.has(type)) {
        resultErrors.push(`${type}: unexpected QueryData result type`);
      }
      if ((seenTypes.get(type) || 0) !== 1) {
        resultErrors.push(`${type}: duplicate QueryData results (${seenTypes.get(type)})`);
      }
    }
    if (aggregateStatus && aggregateStatus !== 'completed' && !marketScoped) {
      resultErrors.push(`${label}: QueryData result is not completed (${aggregateStatus})`);
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    const cellIdentifierCounts = new Map();
    const matchedExpectedCounts = new Map(expectedSymbols.map(id => [id, 0]));

    if (marketScoped) {
      const marketErrors = [...resultErrors];
      const hasData = result.data != null
        && (!Array.isArray(result.data) || result.data.length > 0)
        && (typeof result.data !== 'object' || Array.isArray(result.data) || Object.keys(result.data).length > 0);
      if (aggregateStatus === 'completed_without_data') {
        marketErrors.push(`${label}/__market__: completed_without_data is forbidden (fail-closed)`);
      } else if (!TERMINAL_STATUSES.has(aggregateStatus)) {
        marketErrors.push(`${label}/__market__: non-terminal or unknown result status ${aggregateStatus || '(missing)'}`);
      } else if (aggregateStatus === 'completed') {
        if (!hasData) marketErrors.push(`${label}/__market__: completed result has no data payload`);
        if (hasOwnValue(result, 'not_applicable_reason')
            || hasOwnValue(result, 'rejection_reason') || hasOwnValue(result, 'error')) {
          marketErrors.push(`${label}/__market__: completed result carries a conflicting terminal reason`);
        }
      } else if (aggregateStatus === 'not_applicable') {
        if (!hasOwnValue(result, 'not_applicable_reason')) {
          marketErrors.push(`${label}/__market__: not_applicable missing not_applicable_reason`);
        }
        if (hasData) marketErrors.push(`${label}/__market__: not_applicable must not carry data`);
      } else {
        const reason = structuredReason(result);
        if (!reason) marketErrors.push(`${label}/__market__: ${aggregateStatus} missing rejection_reason/structured error`);
        else marketErrors.push(`${label}/__market__: ${aggregateStatus}: ${reason}`);
        if (hasData) marketErrors.push(`${label}/__market__: ${aggregateStatus} must not carry data`);
      }
      errors.push(...marketErrors);
      if (!marketErrors.length) {
        healthyCells.push({ type, id: '__market__', status: aggregateStatus, cell: result, row: aggregateStatus === 'completed' ? result.data : null });
      } else if (aggregateStatus === 'failed' || aggregateStatus === 'unavailable') {
        failedCells.push({ type, id: '__market__', status: aggregateStatus, cell: result, reason: structuredReason(result) || null });
      }
      return;
    }

    for (const cell of cells) {
      const ids = identifiers(cell);
      for (const candidate of ids) {
        cellIdentifierCounts.set(candidate, (cellIdentifierCounts.get(candidate) || 0) + 1);
      }
      for (const expected of expectedSymbols) {
        if (ids.includes(expected)) matchedExpectedCounts.set(expected, matchedExpectedCounts.get(expected) + 1);
      }
    }

    for (const row of rows) {
      if (!identifiers(row).length) errors.push(`${label}: data row missing symbol/instrument_id`);
    }

    for (const cell of cells) {
      const ids = identifiers(cell);
      if (!ids.length) {
        errors.push(`${label}: QueryData cell missing symbol/instrument_id`);
        continue;
      }
      const id = ids[0];

      // Aggregate/result-envelope errors fail the call, but must not erase a
      // structurally healthy sibling cell from the audit view. Keep those
      // errors at result scope and evaluate the terminal cell independently.
      const cellErrors = [];
      for (const candidate of ids) {
        const count = cellIdentifierCounts.get(candidate) || 0;
        if (count !== 1) cellErrors.push(`${label}/${candidate}: duplicate terminal cells (${count})`);
      }
      for (const expected of expectedSymbols) {
        if (ids.includes(expected) && matchedExpectedCounts.get(expected) !== 1) {
          cellErrors.push(`${label}/${expected}: expected exactly one terminal cell (got ${matchedExpectedCounts.get(expected)})`);
        }
      }
      if (expectedSymbols.length && !ids.some(candidate => expectedSymbolSet.has(candidate))) {
        cellErrors.push(`${label}/${id}: unexpected terminal cell`);
      }

      const rawStatus = cell.status;
      const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
      const matches = rows.filter(row => sharesIdentifier(cell, row));
      const announcedRetry = cell.retry_at || cell.next_complete_available_at;
      if (announcedRetry && (!retryAt || String(announcedRetry) < retryAt)) retryAt = String(announcedRetry);

      if (status === 'completed_without_data') {
        cellErrors.push(`${label}/${id}: completed_without_data is forbidden (fail-closed)`);
      } else if (!TERMINAL_STATUSES.has(status)) {
        cellErrors.push(`${label}/${id}: non-terminal or unknown cell status ${status || '(missing)'}`);
      } else if (status === 'completed') {
        if (hasOwnValue(cell, 'not_applicable_reason')
            || hasOwnValue(cell, 'rejection_reason') || hasOwnValue(cell, 'error')) {
          cellErrors.push(`${label}/${id}: completed cell carries a conflicting terminal reason`);
        }
        if (matches.length !== 1) {
          cellErrors.push(`${label}/${id}: completed cell must map to exactly one identified data row (got ${matches.length})`);
        }
      } else if (status === 'not_applicable') {
        if (!hasOwnValue(cell, 'not_applicable_reason')) {
          cellErrors.push(`${label}/${id}: not_applicable missing not_applicable_reason`);
        }
        if (hasOwnValue(cell, 'rejection_reason') || hasOwnValue(cell, 'error')) {
          cellErrors.push(`${label}/${id}: not_applicable carries a conflicting failure reason`);
        }
        if (matches.length) cellErrors.push(`${label}/${id}: not_applicable must not carry a data row`);
      } else {
        const reason = structuredReason(cell);
        if (hasOwnValue(cell, 'not_applicable_reason')) {
          cellErrors.push(`${label}/${id}: ${status} carries a conflicting not_applicable_reason`);
        }
        if (!reason) cellErrors.push(`${label}/${id}: ${status} missing rejection_reason/structured error`);
        else cellErrors.push(`${label}/${id}: ${status}: ${reason}`);
        if (matches.length) cellErrors.push(`${label}/${id}: ${status} must not carry a data row`);
      }

      errors.push(...cellErrors);
      if (!cellErrors.length) {
        healthyCells.push({ type, id, status, cell, row: status === 'completed' ? matches[0] : null });
      } else if (status === 'failed' || status === 'unavailable') {
        failedCells.push({ type, id, status, cell, reason: structuredReason(cell) || null });
      }
    }

    errors.push(...resultErrors);
    if (!cells.length) errors.push(`${label}: QueryData result returned no terminal cells`);
    for (const [id, count] of cellIdentifierCounts) {
      if (count !== 1) errors.push(`${label}/${id}: duplicate terminal cells (${count})`);
    }
    for (const [id, count] of matchedExpectedCounts) {
      if (count !== 1) errors.push(`${label}/${id}: expected exactly one terminal cell (got ${count})`);
    }
    for (const row of rows) {
      const rowIds = identifiers(row);
      if (rowIds.length && !cells.some(cell => sharesIdentifier(cell, row))) {
        errors.push(`${label}/${rowIds[0]}: data row has no terminal cell`);
      }
      if (expectedSymbols.length && rowIds.length
          && !rowIds.some(id => expectedSymbolSet.has(id))) {
        errors.push(`${label}/${rowIds[0]}: unexpected data row`);
      }
    }
  });

  for (const type of expectedTypes) {
    const count = seenTypes.get(type) || 0;
    if (count !== 1) errors.push(`${type}: expected exactly one QueryData result (got ${count})`);
  }
  for (const [type, count] of seenTypes) {
    if (count !== 1) errors.push(`${type}: duplicate QueryData results (${count})`);
  }

  return {
    errors: [...new Set(errors)],
    healthyCells,
    failedCells,
    retryAt,
  };
}

module.exports = {
  TERMINAL_STATUSES,
  findQueryResults,
  validateQueryDataCells,
};
