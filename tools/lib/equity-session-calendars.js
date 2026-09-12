'use strict';

// Venue calendars are intentionally bounded to official 2025–2026 schedules.
// This validates historical tracking and the sweep's 252-session lookback; it
// does not expand the US scanner universe or borrow a US weekday calendar.
const us = require('./market-calendar');
const EQUITY_CALENDAR = 'us_equity_exchange_sessions';
const CRYPTO_CALENDAR = 'crypto_24_7_utc';
const CALENDARS = {
  euronext_cash_2025_2026: {
    closed: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-12-25', '2025-12-26', '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25'],
    earlyClose: ['2025-12-24', '2025-12-31', '2026-12-24', '2026-12-31'],
    source: 'https://live.euronext.com/en/resources/trading-hours-holidays',
  },
  borsa_italiana_cash_2025_2026: {
    closed: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-08-15', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31', '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31'],
    source: 'https://www.borsaitaliana.it/borsaitaliana/calendario-e-orari-di-negoziazione/calendario-borsa-orari-di-negoziazione.en.htm',
  },
  bme_cash_2025_2026: {
    closed: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-12-25', '2025-12-26', '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25'],
    earlyClose: ['2025-12-24', '2025-12-31', '2026-12-24', '2026-12-31'],
    source: 'https://www.bolsasymercados.es/es/bme-exchange/docs/regula/SBolsas/esp/instrucc/2024/2024-52-IO-CALENDARIO-DE-SESIONES-2025.pdf',
  },
  gpw_cash_2025_2026: {
    closed: ['2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-19', '2025-08-15', '2025-11-11', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31', '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06', '2026-05-01', '2026-06-04', '2026-11-11', '2026-12-24', '2026-12-25', '2026-12-31'],
    source: 'https://www.gpw.pl/szczegoly-sesji',
  },
  lse_cash_2025_2026: {
    closed: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05', '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26', '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28'],
    earlyClose: ['2025-12-24', '2025-12-31', '2026-12-24', '2026-12-31'],
    source: 'https://docs.londonstockexchange.com/sites/default/files/documents/lse-turquoise-calendar-2025.pdf',
  },
  xetra_cash_2025_2026: {
    closed: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31', '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31'],
    earlyClose: ['2025-12-30'],
    source: 'https://live.deutsche-boerse.com/en/handeln/trading-calendar',
  },
  nasdaq_helsinki_cash_2025_2026: {
    closed: ['2025-01-01', '2025-01-06', '2025-04-18', '2025-04-21', '2025-05-01', '2025-05-29', '2025-06-20', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31', '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-06-19', '2026-12-24', '2026-12-25', '2026-12-31'],
    source: 'https://www.nasdaq.com/european-market-activity/trading-hours',
  },
};

function calendarForSymbol(symbol) {
  const value = String(symbol).toUpperCase();
  if (/-USD$/.test(value)) return CRYPTO_CALENDAR;
  if (/\.(PA|AS|BR|LS)$/.test(value)) return 'euronext_cash_2025_2026';
  if (/\.MI$/.test(value)) return 'borsa_italiana_cash_2025_2026';
  if (/\.MC$/.test(value)) return 'bme_cash_2025_2026';
  if (/\.WA$/.test(value)) return 'gpw_cash_2025_2026';
  if (/\.L$/.test(value)) return 'lse_cash_2025_2026';
  if (/\.DE$/.test(value)) return 'xetra_cash_2025_2026';
  if (/\.HE$/.test(value)) return 'nasdaq_helsinki_cash_2025_2026';
  // Unrecognised venue suffixes must never inherit the US holiday schedule.
  if (/\.[A-Z]{1,3}$/.test(value) && !/\.[AB]$/.test(value)) throw new Error(`${symbol}: unsupported exchange calendar`);
  return EQUITY_CALENDAR;
}

function isSession(date, calendar) {
  if (calendar === EQUITY_CALENDAR) return us.isUSTradingDay(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`invalid session date ${date}`);
  if (calendar === CRYPTO_CALENDAR) return true;
  const definition = CALENDARS[calendar];
  if (!definition || !/^(2025|2026)-/.test(date)) throw new Error(`${calendar}: no certified calendar for ${date}`);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !definition.closed.includes(date);
}

function nextSession(date, calendar) {
  if (calendar === EQUITY_CALENDAR) return us.nextUSTradingDay(date);
  isSession(date, calendar); // validate the starting date/year too
  const cursor = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 14; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const next = cursor.toISOString().slice(0, 10);
    if (isSession(next, calendar)) return next;
  }
  throw new Error(`${calendar}: no session after ${date}`);
}
module.exports = { EQUITY_CALENDAR, CRYPTO_CALENDAR, CALENDARS, calendarForSymbol, isSession, nextSession };
