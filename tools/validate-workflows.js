#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const contract = require('./lib/workflow-contract');

function printErrors(errors) {
  for (const error of errors) console.error(`  - ${error}`);
}

function auditHistory(strict) {
  const tracked = spawnSync('git', ['ls-files', 'daily', 'weekly', 'scanner', 'analyses'], {
    cwd: contract.ROOT,
    encoding: 'utf8',
  });
  if (tracked.status !== 0) return { errors: [`git ls-files failed: ${tracked.stderr.trim()}`] };
  const files = tracked.stdout.split('\n').filter(f => /\/harness\.json$/.test(f));
  const counts = { total: files.length, unresolved_artifact: 0, missing_artifact: 0, missing_reference_close: 0, empty_sources: 0, incomplete_close_proof: 0 };
  const examples = [];
  for (const rel of files) {
    let h;
    try { h = JSON.parse(fs.readFileSync(path.join(contract.ROOT, rel), 'utf8')); }
    catch { examples.push(`${rel}: invalid JSON`); continue; }
    if (!h.artifact) { counts.missing_artifact++; examples.push(`${rel}: artifact missing`); }
    else if (contract.UNRESOLVED_RE.test(h.artifact)) { counts.unresolved_artifact++; examples.push(`${rel}: unresolved artifact ${h.artifact}`); }
    if (!h.reference_close) { counts.missing_reference_close++; examples.push(`${rel}: reference_close missing`); }
    if (!Array.isArray(h.sources) || !h.sources.length) { counts.empty_sources++; examples.push(`${rel}: sources empty`); }
    for (const s of h.sources || []) {
      if (s.expects_close && (!s.reference_close || !s.data_through)) {
        counts.incomplete_close_proof++;
        examples.push(`${rel}: ${s.name || '?'} has incomplete close proof`);
      }
    }
  }
  console.log(JSON.stringify({ history: counts, examples: examples.slice(0, 20), legacy_findings_are_non_blocking: !strict }, null, 2));
  const findings = Object.entries(counts).filter(([k, v]) => k !== 'total' && v > 0).length;
  return { errors: strict && findings ? [`${findings} historical finding categories remain`] : [] };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--history')) {
    const result = auditHistory(args.includes('--strict-history'));
    if (result.errors.length) { printErrors(result.errors); return 1; }
    return 0;
  }

  const runAt = args.indexOf('--run');
  if (runAt >= 0) {
    const workflow = args[runAt + 1];
    const out = args[runAt + 2];
    if (!workflow || !out) { console.error('Usage: validate-workflows.js --run <workflow> <out-dir>'); return 2; }
    const result = contract.validateRun(workflow, out);
    if (result.errors.length) { console.error(`[workflow] ${workflow} run: FAIL`); printErrors(result.errors); return 1; }
    console.log(`[workflow] ${workflow} run: PASS (${result.harness})`);
    return 0;
  }

  const runPlanAt = args.indexOf('--run-plan');
  if (runPlanAt >= 0) {
    const plan = args[runPlanAt + 1];
    const out = args[runPlanAt + 2];
    if (!plan || !out) { console.error('Usage: validate-workflows.js --run-plan <plan> <out-dir>'); return 2; }
    const owner = contract.findPlanSpec(plan);
    if (!owner) { console.error(`[workflow] unconfigured plan: ${plan}`); return 2; }
    const result = contract.validateRun(owner.workflow, out);
    if (result.errors.length) { console.error(`[workflow] ${owner.workflow} run: FAIL`); printErrors(result.errors); return 1; }
    console.log(`[workflow] ${owner.workflow} run: PASS (${result.harness})`);
    return 0;
  }

  const planAt = args.indexOf('--plan');
  if (planAt >= 0) {
    const planPath = args[planAt + 1];
    if (!planPath) { console.error('Usage: validate-workflows.js --plan <plan>'); return 2; }
    const owner = contract.findPlanSpec(planPath);
    if (!owner) { console.error(`[workflow] unconfigured plan: ${planPath}`); return 2; }
    let plan;
    try { plan = JSON.parse(fs.readFileSync(path.resolve(contract.ROOT, planPath), 'utf8')); }
    catch (e) { console.error(`[workflow] invalid plan ${planPath}: ${e.message}`); return 1; }
    const errors = contract.validatePlan(plan, owner.planSpec);
    if (errors.length) { console.error(`[workflow] ${owner.rel}: FAIL`); printErrors(errors); return 1; }
    console.log(`[workflow] ${owner.rel}: PASS`);
    return 0;
  }

  const workflowAt = args.indexOf('--workflow');
  if (workflowAt >= 0) {
    const name = args[workflowAt + 1];
    if (!name) { console.error('Usage: validate-workflows.js --workflow <name>'); return 2; }
    const result = contract.validateConfiguredWorkflow(name);
    if (result.errors.length) { console.error(`[workflow] ${name}: FAIL`); printErrors(result.errors); return 1; }
    console.log(`[workflow] ${result.workflow}: PASS (${result.plans.length} plan(s))`);
    return 0;
  }

  const result = contract.validateAll();
  if (result.errors.length) { console.error('[workflow] contracts: FAIL'); printErrors(result.errors); return 1; }
  console.log(`[workflow] contracts: PASS (${result.reports.length} workflow(s))`);
  return 0;
}

process.exit(main());
