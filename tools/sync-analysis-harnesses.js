#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const statusFlag = argv.indexOf('--verified-status-at');
const verifiedStatusAt = statusFlag >= 0 ? argv[statusFlag + 1] : null;
const tickers = argv.filter((x, i) => !x.startsWith('--') && i !== statusFlag + 1).map(x => x.toUpperCase());
const required = ['status', 'instrument', 'bars', 'fundamentals', 'dilution', 'technicals'];
const sharedHarness = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'analyses-data', 'CRWD.harness.json'), 'utf8'));
const regime = sharedHarness.sources.find(x => x.name === 'systematic_regime');

if (!tickers.length) {
  console.error('Usage: node tools/sync-analysis-harnesses.js [--verified-status-at ISO] TICKER ...');
  process.exit(2);
}
if (verifiedStatusAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(verifiedStatusAt)) {
  throw new Error('--verified-status-at must be an ISO UTC timestamp without milliseconds');
}
if (!regime) throw new Error('Shared systematic_regime provenance is unavailable');

for (const ticker of tickers) {
  const source = path.join(ROOT, 'analyses', ticker, '_data', 'harness.json');
  if (!fs.existsSync(source)) throw new Error(`${ticker}: source harness missing at ${path.relative(ROOT, source)}`);
  const harness = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (harness.reference_close !== '2026-08-27') throw new Error(`${ticker}: unexpected reference close ${harness.reference_close}`);
  const names = new Set((harness.sources || []).filter(x => x.required).map(x => x.name));
  const missing = required.filter(name => !names.has(name));
  if (missing.length) throw new Error(`${ticker}: missing required provenance ${missing.join(', ')}`);
  harness.artifact = `analyses/${ticker}/index.html`;
  harness.content = `analyses/${ticker}`;
  harness.sources = [...harness.sources.filter(x => x.name !== 'systematic_regime'), regime];
  if (verifiedStatusAt) {
    const status = harness.sources.find(x => x.name === 'status');
    if (!status) throw new Error(`${ticker}: status provenance is unavailable`);
    status.as_of = verifiedStatusAt;
    status.note = 'marketdata.GetStatus rechecked: service healthy; SPY/QQQ/VIX witnesses at the 2026-08-27 reference close';
  }
  const out = path.join(ROOT, 'data', 'analyses-data', `${ticker}.harness.json`);
  fs.writeFileSync(out, JSON.stringify(harness, null, 2) + '\n');
  console.log(`[harness] ${ticker}: ${harness.sources.length} sources -> ${path.relative(ROOT, out)}`);
}
