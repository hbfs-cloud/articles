#!/usr/bin/env node
'use strict';

const assert = require('assert');
const calendar = require('./lib/market-calendar');

const closed = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
];
for (const date of closed) assert.strictEqual(calendar.isUSTradingDay(date), false, `${date} must be closed`);

const halfDays = ['2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24'];
for (const date of halfDays) assert.strictEqual(calendar.isUSHalfDay(date), true, `${date} must be a half day`);
assert.strictEqual(calendar.isUSHalfDay('2026-07-02'), false, '2026-07-02 is not an official early close');
assert.strictEqual(calendar.isUSTradingDay('2027-12-31'), true, 'Saturday New Year 2028 is not observed on Friday');
assert.strictEqual(calendar.nextUSTradingDay('2026-07-02'), '2026-07-06');
assert.strictEqual(calendar.previousUSTradingDay('2026-07-06'), '2026-07-02');
assert.throws(() => calendar.isUSTradingDay('2029-01-02'), /verified only through/);
assert.throws(() => calendar.isUSTradingDay('2026-02-30'), /invalid ISO/);

console.log('market calendar: PASS');
