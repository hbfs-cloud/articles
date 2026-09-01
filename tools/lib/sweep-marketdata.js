'use strict';

const { validateQueryData } = require('./marketdata-bars-contract');

// The audited 0424 contract exposes readiness only for US exchange sessions
// and crypto UTC. Do not silently route a Yahoo-style foreign ticker through
// the US bucket: that would compare its close against the wrong calendar.
const FOREIGN_EXCHANGE_SUFFIX = /\.(?:PA|MC|BR|LS|AS|DE|L|MI|SW|ST|CO|HE|OL|VI|IR|WA|PR|AT|HK|T|TO|V|AX|NZ|SS|SZ|KS|KQ|SA|MX|IS|JK|BO|NS|SI|BK|TW)$/i;

function classifyBarsDailyCalendar(symbol) {
  const normalized = String(symbol || '').trim();
  if (!normalized) return { supported: false, assetCalendar: null, reason: 'symbol missing' };
  if (/-USD$/i.test(normalized)) {
    return { supported: true, assetCalendar: 'crypto_24_7_utc', reason: null };
  }
  if (FOREIGN_EXCHANGE_SUFFIX.test(normalized)) {
    return {
      supported: false,
      assetCalendar: null,
      reason: 'foreign exchange calendar has no audited operation_readiness bucket in contract 0424',
    };
  }
  return { supported: true, assetCalendar: 'us_equity_exchange_sessions', reason: null };
}

function latestCompletedCryptoUtcDate(asOfTimestamp) {
  const instant = new Date(asOfTimestamp);
  if (!Number.isFinite(instant.getTime())) throw new Error('as_of_timestamp must be a valid timestamp');
  // A crypto daily candle is complete only after the next UTC midnight. The
  // current UTC calendar date is therefore never a certified completed close.
  return new Date(Date.UTC(
    instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate() - 1,
  )).toISOString().slice(0, 10);
}

function buildBarsDailyArgs(symbols, asOfTimestamp, limit = 140) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(String(asOfTimestamp || ''))) {
    throw new Error('as_of_timestamp must be an explicit ISO-8601 UTC timestamp');
  }
  const parsed = new Date(asOfTimestamp);
  if (!Number.isFinite(parsed.getTime())) throw new Error('as_of_timestamp must be a valid timestamp');
  const normalizedSymbols = (Array.isArray(symbols) ? symbols : String(symbols || '').split(','))
    .map(symbol => String(symbol || '').trim())
    .filter(Boolean);
  if (!normalizedSymbols.length) throw new Error('bars_daily requires at least one symbol/instrument_id');
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('bars_daily limit must be a positive integer');
  const iso = parsed.toISOString();
  return {
    types: 'bars_daily',
    symbols: normalizedSymbols.join(','),
    limit,
    as_of_timestamp: iso,
    completion_policy: 'completed_only',
  };
}

function barsToHistory(bars) {
  const history = {};
  for (const bar of Array.isArray(bars) ? bars : []) {
    if (Array.isArray(bar) && bar.length >= 5 && bar[0]) {
      history[String(bar[0]).slice(0, 10)] = {
        open: bar[1], high: bar[2], low: bar[3], close: bar[4], volume: bar[5],
      };
    } else if (bar && bar.date) {
      history[String(bar.date).slice(0, 10)] = {
        open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
      };
    }
  }
  return history;
}

/** Preserve healthy cells from a mixed batch; never invent rows for failures. */
function ingestCertifiedBarsBatch(value, options) {
  const check = validateQueryData(value, {
    symbols: (options.symbols || []).join(','),
    assetCalendar: options.assetCalendar || 'us_equity_exchange_sessions',
    expectedCompletedEnd: options.expectedCompletedEnd,
  });
  const histories = {};
  const proofs = {};
  for (const healthy of check.healthyCells) {
    if (healthy.status !== 'completed' || !healthy.row || !healthy.proof) continue;
    const history = barsToHistory(healthy.row.bars);
    if (!Object.keys(history).length) continue;
    histories[healthy.id] = history;
    proofs[healthy.id] = {
      assetCalendar: healthy.proof.assetCalendar,
      expectedCompletedEnd: healthy.proof.expectedCompletedEnd,
      servedCompletedEnd: healthy.proof.servedCompletedEnd,
      lastBarComplete: healthy.proof.lastBarComplete,
    };
  }
  const requested = new Set(options.symbols || []);
  const failedSymbols = [...requested].filter(symbol => !histories[symbol]);
  return {
    histories,
    proofs,
    failedSymbols,
    errors: check.errors,
    retryAt: check.retryAt,
  };
}

module.exports = {
  buildBarsDailyArgs,
  classifyBarsDailyCalendar,
  ingestCertifiedBarsBatch,
  latestCompletedCryptoUtcDate,
};
