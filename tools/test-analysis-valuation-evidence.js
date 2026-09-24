'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { validateValuationScenario } = require('./validate-analysis-evidence');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'valuation-evidence-'));
try {
  const fixture = value => {
    const bytes = JSON.stringify({ financials: { ebitda: value, loss: -5 } });
    fs.writeFileSync(path.join(root, 'fundamentals.json'), bytes);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return { inputs: [{ path: 'fundamentals.json', sha256 }], scenario: {
      status: 'non_applicable', reason_code: 'NON_POSITIVE_EBITDA', reason: 'Observed EBITDA is non-positive.',
      basis: { input_path: 'fundamentals.json', input_sha256: sha256, source_pointer: '/financials/ebitda' }
    } };
  };
  const check = f => validateValuationScenario(f.scenario, f.inputs, root);
  for (const value of [-15, 0]) assert.deepStrictEqual(check(fixture(value)), []);
  for (const value of [15, '-15', null]) assert(check(fixture(value)).length);
  for (const mutate of [
    f => { f.scenario.basis.source_pointer = '/missing'; },
    f => { f.scenario.basis.source_pointer = '/financials/loss'; },
    f => { f.scenario.basis.input_sha256 = '0'.repeat(64); f.inputs[0].sha256 = '0'.repeat(64); },
    f => { f.scenario.basis.input_path = '../outside.json'; f.inputs[0].path = '../outside.json'; },
    f => { f.scenario.price = 2.35; },
    f => { f.scenario.reason = ''; },
    f => { f.inputs = []; }
  ]) { const f = fixture(-15); mutate(f); assert(check(f).length); }
  const scenario = { multiple: 10, ebitda: 100, debt: 100, cash: 50, shares: 10, close: 100,
    enterprise_value: 1000, equity_value: 950, price: 95, downside_pct: -5 };
  assert.deepStrictEqual(validateValuationScenario(scenario, [], root), []);
  assert(validateValuationScenario({ ...scenario, price: 96 }, [], root).length);
  const revenue = { metric: 'revenue', multiple: 5, revenue: 200, ebitda: -20, debt: 100, cash: 50, shares: 10, close: 100,
    enterprise_value: 1000, equity_value: 950, price: 95, downside_pct: -5 };
  assert.deepStrictEqual(validateValuationScenario(revenue, [], root), []);
  assert(validateValuationScenario({ ...revenue, metric: 'ebitda' }, [], root).length);
  assert(validateValuationScenario({ ...revenue, revenue: 0, enterprise_value: 0 }, [], root).length);
  assert(validateValuationScenario({ ...revenue, metric: 'sales' }, [], root).length);
  assert(validateValuationScenario({ ...revenue, price: 96 }, [], root).length);
  console.log('valuation evidence: PASS; non-applicability requires hashed non-positive EBITDA without economic outputs; revenue metric replays revenue × multiple');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
