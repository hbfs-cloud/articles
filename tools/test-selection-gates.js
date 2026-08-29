#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateSelection } = require('./lib/selection-gates');
const { stableStringify } = require('./lib/workflow-contract');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selection-gates-'));
try {
  fs.mkdirSync(path.join(root, 'plans'));
  const plan = JSON.stringify({ waves: [{ calls: [{ as: 'screen', server: 'marketdata', tool: 'RunScreener' }] }] });
  fs.writeFileSync(path.join(root, 'plans', 'aplus-screen.json'), plan);
  const body = JSON.stringify({ data: [{ symbol: 'BBB', score: 10 }, { symbol: 'AAA', score: 10 }, { symbol: 'CCC', score: 8 }] });
  fs.writeFileSync(path.join(root, 'screen.json'), body);
  const sourceHash = crypto.createHash('sha256').update(body).digest('hex');
  const resolvedInput = { artifact: 'test', refdate: '2026-08-28', waves: [{ calls: [{ as: 'screen', server: 'marketdata', tool: 'RunScreener' }] }] };
  const inputHash = crypto.createHash('sha256').update(stableStringify(resolvedInput)).digest('hex');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plans/aplus-screen.json',
    plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: inputHash,
    sources: [{ name: 'screen', sha256: sourceHash, required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plans/aplus-screen.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: inputHash, resolved_input: resolvedInput,
    waves: [{ calls: [{ as: 'screen', server: 'marketdata', tool: 'RunScreener', ok: true, output_sha256: sourceHash }] }],
  }));
  const payload = {
    reference_close: '2026-08-28',
    ideas: [{ ticker: 'AAA' }], candidates: [],
    selection: {
      source_artifacts: [{ path: 'screen.json', sha256: sourceHash }],
      ranking: [
        { rank: 1, ticker: 'AAA', source_score: 10 }, { rank: 2, ticker: 'BBB', source_score: 10 },
        { rank: 3, ticker: 'CCC', source_score: 8 },
      ],
      selected_for_verify: ['AAA', 'BBB'], verification_rejections: [{ ticker: 'BBB', reasons: ['SEC gate'] }],
    },
  };
  assert.deepStrictEqual(validateSelection(payload, root, 2), []);
  const cherryPicked = structuredClone(payload); cherryPicked.selection.selected_for_verify = ['CCC'];
  assert(validateSelection(cherryPicked, root, 2).some(error => error.includes('top-ranked')));
  console.log('selection gate tests: PASS');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
