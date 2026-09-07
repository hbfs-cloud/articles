#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateEvidenceManifest } = require('./lib/evidence-gates');
const { sha256 } = require('./lib/workflow-contract');
const { stableStringify } = require('./lib/workflow-contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-gates-'));
try {
  const run = path.join(root, 'run');
  fs.mkdirSync(run);
  const body = '{"bars":[]}';
  const hash = sha256(body);
  fs.writeFileSync(path.join(run, 'bars.json'), body);
  const plan = '{}'; fs.writeFileSync(path.join(root, 'plan.json'), plan);
  const resolvedInput = { artifact: 'test', refdate: '2026-08-28', waves: [{ calls: [{ as: 'bars', server: 'marketdata', tool: 'QueryData' }] }] };
  const inputHash = sha256(stableStringify(resolvedInput));
  fs.writeFileSync(path.join(run, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28',
    plan: 'plan.json', plan_sha256: sha256(plan), input_sha256: inputHash,
    sources: [{ name: 'bars', sha256: hash }],
  }));
  fs.writeFileSync(path.join(run, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: sha256(plan), input_sha256: inputHash,
    resolved_input: resolvedInput, waves: [{ calls: [{ as: 'bars', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: hash }] }],
  }));
  const payload = {
    reference_close: '2026-08-28',
    evidence: { bars: { path: 'run/bars.json', sha256: hash } },
  };
  assert.deepStrictEqual(validateEvidenceManifest(payload, root, ['bars']), []);
  // A current plan update must not invalidate an intact historical run. Recovery requires
  // the byte-identical historical plan, not just a file named after the expected hash.
  fs.writeFileSync(path.join(root, 'plan.json'), '{"newVersion":true}');
  assert(validateEvidenceManifest(payload, root, ['bars']).some(error => error.includes('plan file hash mismatch')));
  const archive = path.join(root, 'data/plan-archive');
  fs.mkdirSync(archive, { recursive: true });
  const archivedPlan = path.join(archive, `${sha256(plan)}.json`);
  fs.writeFileSync(archivedPlan, 'wrong bytes');
  assert(validateEvidenceManifest(payload, root, ['bars']).some(error => error.includes('plan file hash mismatch')));
  fs.writeFileSync(archivedPlan, plan);
  assert.deepStrictEqual(validateEvidenceManifest(payload, root, ['bars']), []);
  fs.writeFileSync(path.join(run, 'bars.json'), '{"bars":[1]}');
  assert(validateEvidenceManifest(payload, root, ['bars']).some(error => error.includes('hash mismatch')));
  assert(validateEvidenceManifest({ reference_close: '2026-08-28', evidence: {} }, root, ['bars']).some(error => error.includes('missing')));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('evidence gate tests: PASS');
