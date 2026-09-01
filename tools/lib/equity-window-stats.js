'use strict';

function computeEquityWindowStats(curve, startDate, endDate) {
  const validPoints = (Array.isArray(curve) ? curve : [])
    .filter(point => point && typeof point.date === 'string'
      && Number.isFinite(Number(point.value)) && Number(point.value) > 0)
    .map(point => ({ date: point.date, value: Number(point.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const points = validPoints.filter(point => point.date >= startDate && point.date <= endDate);
  const baseline = validPoints.filter(point => point.date < startDate).pop() || null;
  if (!baseline || points.length < 1) return null;

  // The window return starts from the last certified close before startDate.
  // Using the first in-window close as the denominator silently drops the
  // first session's P&L (for this report, the whole 1 June session).
  let peak = baseline.value;
  let maxDrawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.value);
    maxDrawdown = Math.min(maxDrawdown, (point.value - peak) / peak * 100);
  }
  return {
    baselineDate: baseline.date,
    from: points[0].date,
    to: points[points.length - 1].date,
    sessions: points.length,
    ret: +((points[points.length - 1].value / baseline.value - 1) * 100).toFixed(2),
    dd: +maxDrawdown.toFixed(2),
  };
}

function computeRollingEquityWindowStats(curve, endDate, calendarDays = 92) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ''))) return null;
  if (!Number.isInteger(calendarDays) || calendarDays < 2) return null;
  const start = new Date(`${endDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (calendarDays - 1));
  const result = computeEquityWindowStats(curve, start.toISOString().slice(0, 10), endDate);
  return result ? { ...result, rollingCalendarDays: calendarDays, asOf: endDate } : null;
}

module.exports = { computeEquityWindowStats, computeRollingEquityWindowStats };
