#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const contract = require('./lib/workflow-contract');

const config = contract.readConfig();
const symbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM', 'XOM', 'XLK', 'SPY', 'QQQ'];
const seen = new Set();

for (const workflow of Object.values(config.workflows)) {
  for (const spec of workflow.plans || []) {
    if (seen.has(spec.path)) continue;
    seen.add(spec.path);
    const vars = {
      date: '20260831',
      scandate: '20260810',
      startdate: '2026-08-10',
      refdate: '2026-08-28',
      asof: '2026-08-31',
      request_id: '123e4567-e89b-42d3-a456-426614174000',
      symbol: 'AAPL',
      comparison_start_date: '2026-03-01',
      comparison_symbols: symbols.join(','),
      documented_client_symbols: 'GOOGL,META,AAPL',
    };
    for (const name of spec.required_variables || []) {
      if (vars[name] != null) continue;
      const constraint = spec.variable_constraints && spec.variable_constraints[name];
      const count = Math.max(1, constraint && constraint.min_items || 1);
      vars[name] = symbols.slice(0, count).join(',');
    }
    const args = ['tools/collect.js', '--plan', spec.path, '--out', '/tmp/dailytickers-plan-dry-run', '--plan-only'];
    for (const [name, value] of Object.entries(vars)) {
      if ((spec.required_variables || []).includes(name)) args.push('--var', `${name}=${value}`);
    }
    const result = spawnSync(process.execPath, args, { cwd: contract.ROOT, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `${spec.path} dry-run failed:\n${result.stdout}\n${result.stderr}`);
  }
}

console.log(`plan dry-runs: PASS (${seen.size} plan(s))`);
