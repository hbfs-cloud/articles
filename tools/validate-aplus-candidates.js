#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validateEvidenceManifest } = require('./lib/evidence-gates');
const { validateAplus } = require('./lib/trade-idea-gates');
const { ROOT } = require('./lib/workflow-contract');
const { validateSelection } = require('./lib/selection-gates');
const { validateAplusPointers } = require('./lib/semantic-evidence');

const file = process.argv[2];
if (!file) { console.error('Usage: validate-aplus-candidates.js <candidates.json>'); process.exit(2); }
let payload;
try { payload = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`[aplus] invalid JSON: ${e.message}`); process.exit(1); }
const requiredEvidence = payload.status === 'no_setup'
  ? ['screen', 'regime']
  : ['bars', 'technicals', 'calendar', 'sec', 'guidance', 'eps_history', 'corporate_actions'];
if ((payload.candidates || []).length >= 2) requiredEvidence.push('correlation');
const errors = [
  ...validateAplus(payload),
  ...validateEvidenceManifest(payload, ROOT, requiredEvidence),
  ...validateSelection(payload, ROOT, 10),
  ...validateAplusPointers(payload, ROOT),
];
if (errors.length) {
  console.error('[aplus] FAIL');
  errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log(`[aplus] PASS (${payload.candidates.length} candidate(s))`);
