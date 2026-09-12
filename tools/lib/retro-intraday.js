'use strict';

// Contracts used by the retrospective's execution truth. The LSE contract is
// local-time based: the LSE SETS technical description defines regular trading
// as 08:00–16:30 London time, so complete 15-minute bars run 08:00–16:15.
// Sources: https://docs.londonstockexchange.com/sites/default/files/documents/Service%20Technical%20Description-%2010.11.2020.pdf
// and the 2026 LSE Group calendar (its London Stock Exchange column):
// https://docs.londonstockexchange.com/sites/default/files/documents/turquoise-calendar-2026_0.pdf
function fifteenMinuteTimes(startHour, startMinute, count) {
  return Array.from({ length: count }, (_, index) => {
    const minutes = startHour * 60 + startMinute + index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
}

const expectedRthTimes = fifteenMinuteTimes(9, 30, 26);
const expectedLseTimes = fifteenMinuteTimes(8, 0, 34);
const US_REGULAR_15M = Object.freeze({ id: 'US_RTH_15M', timeZone: 'America/New_York', expectedTimes: expectedRthTimes });
const LSE_REGULAR_15M = Object.freeze({ id: 'LSE_REGULAR_15M', timeZone: 'Europe/London', expectedTimes: expectedLseTimes });

// This retrospective measures 2026. Outside this official calendar horizon the
// contract fails closed instead of silently treating a UK bank holiday as open.
const LSE_CALENDAR_VERIFIED_FROM = '2026-01-01';
const LSE_CALENDAR_VERIFIED_THROUGH = '2026-12-31';
const LSE_2026_CLOSED = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25',
  '2026-08-31', '2026-12-25', '2026-12-28',
]);
const LSE_2026_EARLY_CLOSE = new Set(['2026-12-24', '2026-12-31']);

function validateIso(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) throw new Error(`invalid ISO market date: ${isoDate}`);
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) throw new Error(`invalid ISO market date: ${isoDate}`);
  return parsed;
}

function dateTimeInZone(timestamp, timeZone) {
  if (typeof timestamp !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) return null;
  const instant = new Date(timestamp);
  // The execution contract accepts only bars aligned exactly on a 15-minute
  // boundary. A provider row at 15:30:23 must not masquerade as 15:30.
  if (instant.getUTCSeconds() !== 0 || instant.getUTCMilliseconds() !== 0) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function newYorkDateTime(timestamp) { return dateTimeInZone(timestamp, US_REGULAR_15M.timeZone); }
function londonDateTime(timestamp) { return dateTimeInZone(timestamp, LSE_REGULAR_15M.timeZone); }

function contractForTicker(ticker) {
  const normalized = String(ticker || '').toUpperCase();
  if (normalized.endsWith('.L')) return LSE_REGULAR_15M;
  if (!normalized.includes('.')) return US_REGULAR_15M;
  return null;
}

function isLSETradingDay(isoDate) {
  const date = validateIso(isoDate);
  if (isoDate < LSE_CALENDAR_VERIFIED_FROM || isoDate > LSE_CALENDAR_VERIFIED_THROUGH) {
    throw new Error(`LSE calendar is verified only from ${LSE_CALENDAR_VERIFIED_FROM} through ${LSE_CALENDAR_VERIFIED_THROUGH}; refresh the official LSE calendar contract.`);
  }
  if (LSE_2026_EARLY_CLOSE.has(isoDate)) {
    throw new Error(`LSE early-close session ${isoDate} has no implemented 15-minute execution contract.`);
  }
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !LSE_2026_CLOSED.has(isoDate);
}

function addLSETradingDays(isoDate, count) {
  const date = validateIso(isoDate);
  let added = 0;
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1);
    const next = date.toISOString().slice(0, 10);
    if (isLSETradingDay(next)) added++;
  }
  return date.toISOString().slice(0, 10);
}

function isTradingDayForTicker(isoDate, ticker) {
  const contract = contractForTicker(ticker);
  if (contract === LSE_REGULAR_15M) return isLSETradingDay(isoDate);
  if (contract === US_REGULAR_15M) return require('./market-calendar').isUSTradingDay(isoDate);
  return false;
}

function normalizeIntradayBars(session) {
  const rows = Array.isArray(session) ? session : session && Array.isArray(session.bars) ? session.bars : [];
  return rows.map(row => Array.isArray(row) ? {
    timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5],
  } : row).filter(row => row && typeof row.timestamp === 'string'
    && [row.open, row.high, row.low, row.close].every(Number.isFinite)
    && row.open > 0 && row.low > 0 && row.high >= row.low)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function sessionCoverageError(bars, date, contract = US_REGULAR_15M) {
  if (!contract || !Array.isArray(contract.expectedTimes)) return 'intraday_calendar_not_supported_for_listing';
  const label = contract === US_REGULAR_15M ? 'rth' : 'lse_regular';
  if (bars.length !== contract.expectedTimes.length) return `expected_${contract.expectedTimes.length}_${label}_bars_got_${bars.length}`;
  const observed = bars.map(bar => dateTimeInZone(bar.timestamp, contract.timeZone));
  if (observed.some(value => !value || value.date !== date)) return 'timestamp_date_or_timezone_invalid';
  const times = observed.map(value => value.time);
  if (new Set(times).size !== contract.expectedTimes.length || JSON.stringify(times) !== JSON.stringify(contract.expectedTimes)) return `${label}_15m_sequence_invalid`;
  return null;
}

function performancePopulation(outcomes, referenceClose) {
  const excluded = new Set(['no_fill', 'data_error', 'open_unverified', 'ambiguous']);
  const filled = outcomes.filter(outcome => !excluded.has(outcome.status));
  const resolved = filled.filter(outcome => outcome.horizon_end <= referenceClose
    && outcome.status !== 'pending' && outcome.status !== 'tp1_pending');
  const pending = filled.filter(outcome => outcome.status === 'pending');
  const openRunners = filled.filter(outcome => outcome.status === 'tp1_pending');
  const statusCount = status => outcomes.filter(outcome => outcome.status === status).length;
  const performanceExclusions = {
    no_fill: statusCount('no_fill'),
    data_error: statusCount('data_error'),
    open_unverified: statusCount('open_unverified'),
    ambiguous: statusCount('ambiguous'),
    non_mature: outcomes.filter(outcome => outcome.horizon_end > referenceClose).length,
    pending: pending.length,
    open_runners: openRunners.length,
  };
  return {
    filled,
    matureFilled: filled.filter(outcome => outcome.horizon_end <= referenceClose),
    nonMatureFilled: filled.filter(outcome => outcome.horizon_end > referenceClose),
    resolved,
    fullyClosed: resolved,
    pending,
    openRunners,
    performanceExclusions,
  };
}

module.exports = {
  expectedRthTimes, expectedLseTimes, US_REGULAR_15M, LSE_REGULAR_15M,
  LSE_CALENDAR_VERIFIED_FROM, LSE_CALENDAR_VERIFIED_THROUGH, LSE_2026_CLOSED, LSE_2026_EARLY_CLOSE,
  dateTimeInZone, newYorkDateTime, londonDateTime, contractForTicker,
  isLSETradingDay, addLSETradingDays, isTradingDayForTicker, normalizeIntradayBars, sessionCoverageError,
  performancePopulation,
};
