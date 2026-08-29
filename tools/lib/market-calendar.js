'use strict';

// NYSE/Nasdaq cash-equity calendar. Recurring holidays are calculated; dated
// exchange exceptions and the official verification horizon live in config.
// Source: https://www.nyse.com/trade/hours-calendars

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'us-market-calendar.json');

function loadConfig() {
  const value = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  for (const field of ['verified_through', 'source_url', 'verified_at']) {
    if (!value[field]) throw new Error(`market calendar config missing ${field}`);
  }
  return value;
}

const CONFIG = loadConfig();

function toISO(date) { return date.toISOString().slice(0, 10); }
function utcDate(year, month, day) { return new Date(Date.UTC(year, month - 1, day, 12)); }
function addDays(date, days) {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function nthWeekday(year, month, weekday, nth) {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return toISO(addDays(first, offset + (nth - 1) * 7));
}

function lastWeekday(year, month, weekday) {
  const last = utcDate(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return toISO(addDays(last, -offset));
}

// Anonymous Gregorian algorithm.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

function observed(date, { saturday = 'friday', sunday = 'monday' } = {}) {
  const day = date.getUTCDay();
  if (day === 6) return saturday === 'none' ? null : toISO(addDays(date, -1));
  if (day === 0) return sunday === 'none' ? null : toISO(addDays(date, 1));
  return toISO(date);
}

function holidaySet(year) {
  const set = new Set();
  const add = value => { if (value) set.add(value); };
  // NYSE does not shift a Saturday New Year's Day back into Dec 31.
  add(observed(utcDate(year, 1, 1), { saturday: 'none', sunday: 'monday' }));
  add(nthWeekday(year, 1, 1, 3)); // MLK
  add(nthWeekday(year, 2, 1, 3)); // Washington's Birthday
  add(toISO(addDays(easterSunday(year), -2))); // Good Friday
  add(lastWeekday(year, 5, 1)); // Memorial Day
  add(observed(utcDate(year, 6, 19))); // Juneteenth
  add(observed(utcDate(year, 7, 4))); // Independence Day
  add(nthWeekday(year, 9, 1, 1)); // Labor Day
  add(nthWeekday(year, 11, 4, 4)); // Thanksgiving
  add(observed(utcDate(year, 12, 25))); // Christmas
  for (const iso of CONFIG.closed_additions || []) if (iso.startsWith(`${year}-`)) add(iso);
  for (const iso of CONFIG.open_exceptions || []) set.delete(iso);
  return set;
}

function halfDaySet(year) {
  const set = new Set();
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const dayAfter = toISO(addDays(new Date(`${thanksgiving}T12:00:00Z`), 1));
  if (new Date(`${dayAfter}T12:00:00Z`).getUTCDay() === 5) set.add(dayAfter);

  const christmasEve = `${year}-12-24`;
  const christmasEveDay = new Date(`${christmasEve}T12:00:00Z`).getUTCDay();
  if (christmasEveDay >= 1 && christmasEveDay <= 5 && !holidaySet(year).has(christmasEve)) set.add(christmasEve);

  const julyThird = `${year}-07-03`;
  const julyThirdDay = new Date(`${julyThird}T12:00:00Z`).getUTCDay();
  if (julyThirdDay >= 1 && julyThirdDay <= 5 && !holidaySet(year).has(julyThird)) set.add(julyThird);

  for (const iso of CONFIG.half_day_additions || []) if (iso.startsWith(`${year}-`)) set.add(iso);
  for (const iso of CONFIG.half_day_removals || []) set.delete(iso);
  return set;
}

function validateIso(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) throw new Error(`invalid ISO market date: ${isoDate}`);
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || toISO(parsed) !== isoDate) throw new Error(`invalid ISO market date: ${isoDate}`);
  if (isoDate > CONFIG.verified_through) {
    throw new Error(
      `NYSE calendar is verified only through ${CONFIG.verified_through}; refresh ${path.relative(ROOT, CONFIG_PATH)} from ${CONFIG.source_url}`,
    );
  }
  return parsed;
}

function isUSTradingDay(isoDate) {
  const date = validateIso(isoDate);
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !holidaySet(date.getUTCFullYear()).has(isoDate);
}

function nextUSTradingDay(isoDate) {
  const date = validateIso(isoDate);
  for (let i = 0; i < 14; i++) {
    date.setUTCDate(date.getUTCDate() + 1);
    const next = toISO(date);
    validateIso(next);
    if (isUSTradingDay(next)) return next;
  }
  throw new Error(`no US trading day within 14 days after ${isoDate}`);
}

function previousUSTradingDay(isoDate) {
  const date = validateIso(isoDate);
  for (let i = 0; i < 14; i++) {
    date.setUTCDate(date.getUTCDate() - 1);
    const previous = toISO(date);
    if (isUSTradingDay(previous)) return previous;
  }
  throw new Error(`no US trading day within 14 days before ${isoDate}`);
}

function isUSHalfDay(isoDate) {
  const date = validateIso(isoDate);
  return isUSTradingDay(isoDate) && halfDaySet(date.getUTCFullYear()).has(isoDate);
}

module.exports = {
  CONFIG,
  holidaySet,
  halfDaySet,
  isUSTradingDay,
  nextUSTradingDay,
  previousUSTradingDay,
  isUSHalfDay,
};

if (require.main === module) {
  const base = process.argv[2] || toISO(new Date());
  process.stdout.write(nextUSTradingDay(base).replace(/-/g, ''));
}
