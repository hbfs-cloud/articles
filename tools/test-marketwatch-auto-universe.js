#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildUniverse } = require('./build-marketwatch-data');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marketwatch-universe-'));
fs.mkdirSync(path.join(root, 'data', 'analyses-data'), { recursive: true });
fs.mkdirSync(path.join(root, 'scanner', '20260919'), { recursive: true });
fs.mkdirSync(path.join(root, 'scanner', '20260920'), { recursive: true });

fs.writeFileSync(path.join(root, 'data', 'analyses-status.json'), JSON.stringify({
  generatedAt: '2026-09-20T08:00:00Z',
  symbol_exclusions: { symbols: ['SKIP'] },
  entries: {
    TSM: { status: 'active', grade: 'B+', hasPlan: true, name: 'TSMC' },
    AMD: { status: 'wait', grade: 'B', hasPlan: true, name: 'AMD' },
    OLD: { status: 'expired', grade: 'A', hasPlan: true, name: 'Old idea' },
    SKIP: { status: 'active', grade: 'A', hasPlan: true, name: 'Excluded' }
  }
}));
fs.writeFileSync(path.join(root, 'data', 'analyses-data', 'TSM.json'), JSON.stringify({
  meta: { assetType: 'stock', tags: ['us', 'technology'] },
  header: { name: 'Taiwan Semiconductor', exchange: 'NYSE', sector: 'Semiconductors', price: 430, changePct: 1.2 }
}));
fs.writeFileSync(path.join(root, 'scanner', '20260919', 'signals.json'), JSON.stringify({ scanDate: '20260919', signals: [{ ticker: 'OLD_SCAN' }] }));
fs.writeFileSync(path.join(root, 'scanner', '20260920', 'signals.json'), JSON.stringify({
  scanDate: '20260920', referenceClose: '2026-09-18', regime: 'RECOVERY',
  signals: [
    { ticker: 'TSM', name: 'Taiwan Semiconductor', strategy: 'Pullback', region: 'US', sector: 'Semis', price: 435 },
    { ticker: 'BUG', name: 'Global X Cybersecurity ETF', strategy: 'Momentum', region: 'ETF', sector: 'ETF-Factor', price: 45 }
  ]
}));

const output = buildUniverse(root);
assert.deepStrictEqual(output.generatedFrom.scannerDate, '20260920');
assert.deepStrictEqual(output.assets.map(asset => asset.ticker), ['AMD', 'BUG', 'TSM']);
assert.strictEqual(output.counts.assets, 3);
assert.strictEqual(output.counts.scanner, 2);
assert.strictEqual(output.counts.analyses, 2);
const tsm = output.assets.find(asset => asset.ticker === 'TSM');
assert.strictEqual(tsm.price, 435, 'latest scanner price wins when a ticker belongs to both sources');
assert(tsm.tags.includes('Analyse active'));
assert(tsm.tags.includes('Dernier scan'));
assert(tsm.tags.includes('Pullback'));
assert.deepStrictEqual(tsm.sources, ['Analyses DailyTickers', 'Scanner DailyTickers']);
assert(!output.assets.some(asset => asset.ticker === 'OLD' || asset.ticker === 'SKIP' || asset.ticker === 'OLD_SCAN'));

console.log('MarketWatch auto-universe tests passed');
