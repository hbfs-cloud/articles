#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validateEvidenceManifest } = require('./lib/evidence-gates');
const { validateTradeIdeas } = require('./lib/trade-idea-gates');
const { ROOT } = require('./lib/workflow-contract');
const { validateSelection } = require('./lib/selection-gates');
const { validateObservationPointers } = require('./lib/semantic-evidence');

const file = process.argv[2];
if (!file) { console.error('Usage: validate-trade-ideas.js <ideas.json>'); process.exit(2); }
let payload;
try { payload = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`[trade-ideas] invalid JSON: ${e.message}`); process.exit(1); }
const requiredEvidence = payload.status === 'no_setup'
  ? ['screen', 'regime', 'calendar']
  : ['bars', 'technicals', 'calendar', 'sec', 'flows'];
if ((payload.ideas || []).length >= 2) requiredEvidence.push('correlation');
const errors = [
  ...validateTradeIdeas(payload),
  ...validateEvidenceManifest(payload, ROOT, requiredEvidence),
  ...validateSelection(payload, ROOT, 5),
  ...validateObservationPointers(payload, ROOT),
];
if (errors.length) {
  console.error('[trade-ideas] FAIL');
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log(`[trade-ideas] PASS (${payload.ideas.length} idea(s), ${payload.status})`);
