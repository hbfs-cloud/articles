'use strict';

/**
 * Certified daily bars for non-editorial scanner consumers.
 *
 * This helper deliberately has no cache or public-data fallback.  A caller gets
 * bars only after the Marketdata MCP has proved the requested completed close
 * for every requested symbol.  It is intentionally small so chain C tools use
 * the same completed-bar contract as the collectors. Raw responses, including
 * failed cells and async job IDs, are retained in a private receipt directory.
 */

const contract = require('./marketdata-bars-contract');
const { EQUITY_CALENDAR, CRYPTO_CALENDAR, calendarForSymbol, isSession, nextSession } = require('./equity-session-calendars');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function argValue(argv, name, envName) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : process.env[envName];
}

function requireIsoDate(value, label) {
  if (!isValidIsoDate(String(value || ''))) {
    throw new Error(`${label} is required as YYYY-MM-DD; refusing an implicit live close`);
  }
  return value;
}

function requireTimestamp(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error('--asof is required as an ISO timestamp; refusing an implicit live request');
  }
  return value;
}

function runArgs(argv = process.argv) {
  return {
    refdate: requireIsoDate(argValue(argv, '--refdate', 'SCANNER_REFDATE'), '--refdate'),
    cryptoRefdate: argValue(argv, '--crypto-refdate', 'SCANNER_CRYPTO_REFDATA') || null,
    asOfTimestamp: requireTimestamp(argValue(argv, '--asof', 'SCANNER_ASOF')),
  };
}

function isCryptoSymbol(symbol) {
  return /-USD$/i.test(String(symbol || ''));
}

function isValidIsoDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

function normalizeBars(row, symbol, calendar) {
  const raw = row && row.bars;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${symbol}: bars_daily returned no bars`);
  const out = [];
  for (const bar of raw) {
    const value = Array.isArray(bar)
      ? { date: bar[0], open: bar[1], high: bar[2], low: bar[3], close: bar[4], volume: bar[5] }
      : bar;
    const date = String(value && value.date || '').slice(0, 10);
    const open = Number(value && value.open), high = Number(value && value.high);
    const low = Number(value && value.low), close = Number(value && value.close);
    const rawVolume = value && value.volume;
    const volume = Number(rawVolume);
    if (rawVolume === null || rawVolume === '' || rawVolume === undefined
      || !isValidIsoDate(date) || ![open, high, low, close, volume].every(Number.isFinite)) {
      throw new Error(`${symbol}: malformed bars_daily row`);
    }
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0
      || high < Math.max(open, low, close) || low > Math.min(open, high, close)) {
      throw new Error(`${symbol}: invalid OHLCV bounds`);
    }
    if (!isSession(date, calendar)) throw new Error(`${symbol}: bar on a non-session date ${date} (${calendar})`);
    out.push({ date, open, high, low, close, volume });
  }
  for (let i = 1; i < out.length; i++) {
    const prior = out[i - 1].date, current = out[i].date;
    if (current <= prior) throw new Error(`${symbol}: duplicate or non-monotonic bar date ${current}`);
    const expected = nextSession(prior, calendar);
    if (current !== expected) throw new Error(`${symbol}: incomplete ${calendar} bar sequence (${prior} → ${current}, expected ${expected})`);
  }
  return out;
}

function jobId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.job_id || value.jobId || value.data && (value.data.job_id || value.data.jobId) || null;
}

async function completedResponse(client, args, recordReceipt) {
  const initial = await client.callToolWithRetry('marketdata', 'QueryData', args);
  const id = jobId(initial);
  recordReceipt({ phase: 'initial', args, job_id: id, response: initial });
  if (!id) return initial;
  try {
    const terminal = await client.awaitJob('marketdata', id);
    recordReceipt({ phase: 'terminal', args, job_id: id, response: terminal });
    return terminal;
  } catch (error) {
    recordReceipt({ phase: 'error', args, job_id: id, error: error.message });
    throw error;
  }
}

/**
 * Returns Map<symbol, [{date,open,high,low,close,volume}]>.
 * Every returned series is bounded by, and proves, its requested completed end.
 */
async function fetchCertifiedDailyBars({ symbols, refdate, cryptoRefdate, asOfTimestamp, limit = 160, batchSize = 25, client = require('./mcp-client'), receiptDir = path.resolve(__dirname, '../../.agent/mcp-daily-bars') }) {
  const requested = [...new Set((symbols || []).map(String).map(s => s.trim()).filter(Boolean))];
  if (!requested.length) return new Map();
  refdate = requireIsoDate(refdate, '--refdate');
  asOfTimestamp = requireTimestamp(asOfTimestamp);
  const groups = new Map();
  for (const symbol of requested) {
    const calendar = calendarForSymbol(symbol);
    if (!groups.has(calendar)) groups.set(calendar, []);
    groups.get(calendar).push(symbol);
  }
  const equities = groups.get(EQUITY_CALENDAR) || [];
  const recordReceipt = receipt => {
    if (!receiptDir) return;
    fs.mkdirSync(receiptDir, { recursive: true });
    const redact = require('./mcp-client').redactSecrets;
    fs.writeFileSync(path.join(receiptDir, `${Date.now()}-${randomUUID()}.json`), redact(JSON.stringify({ captured_at: new Date().toISOString(), ...receipt }, null, 2)));
  };
  const crypto = requested.filter(isCryptoSymbol);
  if (crypto.length) cryptoRefdate = requireIsoDate(cryptoRefdate, '--crypto-refdate');
  if (!client.canCallDirectly('marketdata')) {
    throw new Error('marketdata MCP read-only token unavailable; chain C fails closed (no public-data fallback)');
  }

  const status = await client.callToolWithRetry('marketdata', 'GetStatus', {});
  const statusCheck = contract.validateOperationReadiness(status, {
    equityReferenceClose: equities.length ? refdate : null,
    cryptoCompletedRefdate: crypto.length ? cryptoRefdate : null,
    minimumBuild: contract.MIN_MARKETDATA_BUILD,
  });
  if (statusCheck.errors.length) {
    throw new Error(`marketdata readiness rejected: ${statusCheck.errors.join('; ')}`);
  }

  const result = new Map();
  for (const [calendar, symbols] of groups) {
    const group = { symbols, calendar, expected: calendar === CRYPTO_CALENDAR ? cryptoRefdate : refdate };
    if (!group.symbols.length) continue;
    for (let offset = 0; offset < group.symbols.length; offset += batchSize) {
      const symbolsBatch = group.symbols.slice(offset, offset + batchSize);
      const response = await completedResponse(client, {
        types: 'bars_daily', symbols: symbolsBatch.join(','), limit,
        as_of_timestamp: asOfTimestamp, completion_policy: 'completed_only',
      }, recordReceipt);
      const check = contract.validateQueryData(response, {
        symbols: symbolsBatch.join(','), assetCalendar: group.calendar,
        expectedCompletedEnd: group.expected,
      });
      if (check.errors.length) {
        throw new Error(`marketdata bars rejected: ${check.errors.join('; ')}${check.retryAt ? `; retry_at=${check.retryAt}` : ''}${receiptDir ? `; receipt_dir=${receiptDir}` : ''}`);
      }
      for (const item of check.healthyCells) {
        if (item.status !== 'completed' || !item.row) throw new Error(`${item.id}: no completed daily-bar row`);
        const bars = normalizeBars(item.row, item.id, group.calendar).filter(bar => bar.date <= group.expected);
        const last = bars[bars.length - 1];
        if (!last || last.date !== group.expected) {
          throw new Error(`${item.id}: bars do not end at certified close ${group.expected}`);
        }
        result.set(item.id, bars);
      }
    }
  }
  if (result.size !== requested.length) throw new Error('marketdata returned an incomplete symbol set');
  return result;
}

function barsToHistory(bars) {
  const history = {};
  for (const bar of bars || []) history[bar.date] = { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
  return history;
}

module.exports = { EQUITY_CALENDAR, CRYPTO_CALENDAR, runArgs, fetchCertifiedDailyBars, barsToHistory, isCryptoSymbol, normalizeBars };
