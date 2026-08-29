#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  maxDrawdownPct,
  validateAndNormalizeBook,
  buildBookSnapshot,
} = require('./dtx-book-equity-ingest');
const { bookSnapshotCoherence } = require('./dtx-scan');

const dates = [];
const values = [];
const start = Date.parse('2025-01-01T00:00:00Z');
for (let i = 0; i < 252; i++) {
  dates.push(new Date(start + i * 86400000).toISOString().slice(0, 10));
  values.push(100 * Math.pow(1.2, i / 251));
}
values[126] *= 0.9;

const book = {
  _meta: { engine: 'fixture' },
  best: {
    resolution: 'daily',
    source: 'book_served',
    equity_dates: dates,
    equity_values: values,
    cagr_pct: 20,
    max_dd_pct: maxDrawdownPct(values),
    sharpe: 1.5,
    avg_exposure_pct: 50,
    committed_capital: 100,
    initial_capital: 80,
    measured_at: dates[dates.length - 1],
    basis: 'fixture',
  },
};

const normalized = validateAndNormalizeBook(book, 'best', dates[dates.length - 1]);
assert.deepStrictEqual(normalized.errors, [], normalized.errors.join('; '));

const staged = buildBookSnapshot({
  metrics: {
    allocation: 'best',
    total_trades: 9999,
    r2: 0.99,
    cagr_pct: 999,
    max_dd_pct: 1,
  },
  rejectedServedSnapshot: { reason: 'old mismatch' },
}, normalized, {
  portfolio: 'best',
  path: 'fixture.json',
  sha256: 'a'.repeat(64),
  verifiedAt: '2026-08-29T00:00:00.000Z',
});
assert.strictEqual(staged.metricsSource, 'book_served_stats');
assert.strictEqual(staged.equityResolution, 'daily');
assert.strictEqual(staged.metrics.cagr_pct, 20);
assert.strictEqual(staged.metrics.max_dd_pct, book.best.max_dd_pct);
assert.strictEqual(staged.metrics.total_trades, undefined, 'different-vintage replay/stat fields must not leak into book metrics');
assert.strictEqual(staged.metrics.r2, undefined, 'different-vintage replay/stat fields must not leak into book metrics');
assert.strictEqual(staged.rejectedServedSnapshot, undefined);
assert.strictEqual(staged.bookSnapshot.sourceSha256, 'a'.repeat(64));
assert.match(staged.bookSnapshot.curveSha256, /^[a-f0-9]{64}$/);
assert.strictEqual(staged.bookSnapshot.sameVintage, true);
assert.strictEqual(staged.bookSnapshot.portfolio, 'best');
assert.strictEqual(staged.bookSnapshot.expectedClose, dates[dates.length - 1]);
assert.strictEqual(staged.bookSnapshot.scope, 'performance_only');
assert.strictEqual(staged.equityVerifiedAt, '2026-08-29T00:00:00.000Z');
assert.strictEqual(bookSnapshotCoherence(staged, {
  expectedClose: dates[dates.length - 1], expectedPortfolio: 'best',
}).ok, true, 'valid same-vintage book snapshot must be reusable');

const unbound = structuredClone(book.best);
assert(
  validateAndNormalizeBook(unbound, 'best', dates[dates.length - 1]).errors.some(error => error.includes('not bound')),
  'an unkeyed payload with no portfolio identity must be rejected',
);

const mixedVintage = structuredClone(staged);
mixedVintage.metrics.cagr_pct += 1;
assert(
  bookSnapshotCoherence(mixedVintage).errors.some(error => error.includes('CAGR') || error.includes('SHA-256')),
  'a newer stats row must not be paired with an older book curve',
);

const tamperedCurve = structuredClone(staged);
tamperedCurve.equity.values[1] += 0.0001;
assert(
  bookSnapshotCoherence(tamperedCurve).errors.some(error => error.includes('durable curve SHA-256 mismatch')),
  'curve bytes must remain bound after runtime staging is removed',
);

const wrongDrawdown = structuredClone(book);
wrongDrawdown.best.max_dd_pct += 1;
assert(
  validateAndNormalizeBook(wrongDrawdown, 'best', dates[dates.length - 1]).errors.some(error => error.includes('MaxDD')),
  'curve/MaxDD mismatch must fail closed',
);

const wrongCagr = structuredClone(book);
wrongCagr.best.cagr_pct += 1;
assert(
  validateAndNormalizeBook(wrongCagr, 'best', dates[dates.length - 1]).errors.some(error => error.includes('CAGR')),
  'curve/CAGR mismatch must fail closed',
);

const unordered = structuredClone(book);
unordered.best.equity_dates[2] = unordered.best.equity_dates[1];
assert(
  validateAndNormalizeBook(unordered, 'best', dates[dates.length - 1]).errors.some(error => error.includes('strictly increasing')),
  'duplicate or unordered dates must fail closed',
);

console.log('dtx book equity ingest: PASS');
