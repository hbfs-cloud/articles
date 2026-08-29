'use strict';
const expectedRthTimes = Array.from({ length: 26 }, (_, index) => {
  const minutes = 9 * 60 + 30 + index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
function normalizeIntradayBars(session) {
  const rows = Array.isArray(session) ? session : session && Array.isArray(session.bars) ? session.bars : [];
  return rows.map(row => Array.isArray(row) ? {
    timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5],
  } : row).filter(row => row && typeof row.timestamp === 'string'
    && [row.open, row.high, row.low, row.close].every(Number.isFinite)
    && row.open > 0 && row.low > 0 && row.high >= row.low)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
function newYorkDateTime(timestamp) {
  if (typeof timestamp !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function sessionCoverageError(bars, date) {
  if (bars.length !== 26) return `expected_26_rth_bars_got_${bars.length}`;
  const observed = bars.map(bar => newYorkDateTime(bar.timestamp));
  if (observed.some(value => !value || value.date !== date)) return 'timestamp_date_or_timezone_invalid';
  const times = observed.map(value => value.time);
  if (new Set(times).size !== 26 || JSON.stringify(times) !== JSON.stringify(expectedRthTimes)) return 'rth_15m_sequence_invalid';
  return null;
}
module.exports = { expectedRthTimes, newYorkDateTime, normalizeIntradayBars, sessionCoverageError };
