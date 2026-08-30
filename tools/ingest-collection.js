#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const contract = require('./lib/workflow-contract');

const ROOT = contract.ROOT;
const arg = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const planArg = arg('--plan');
const outArg = arg('--out');
if (!planArg || !outArg) {
  console.error('Usage: node tools/ingest-collection.js --plan plans/NAME.json --out DIR --var key=value ...');
  process.exit(2);
}

const vars = {};
for (let index = 2; index < process.argv.length; index++) {
  if (process.argv[index] !== '--var') continue;
  const value = process.argv[++index] || '';
  const equals = value.indexOf('=');
  if (equals < 1) throw new Error(`Invalid --var ${value}`);
  vars[value.slice(0, equals)] = value.slice(equals + 1);
}

const planPath = path.resolve(ROOT, planArg);
const outDir = path.resolve(ROOT, outArg);
const planBytes = fs.readFileSync(planPath);
const plan = JSON.parse(planBytes.toString('utf8'));
const owner = contract.findPlanSpec(planPath);
if (!owner) throw new Error(`Plan is not configured: ${planArg}`);
const planErrors = contract.validatePlan(plan, owner.planSpec);
if (planErrors.length) throw new Error(`Plan invalid: ${planErrors.join('; ')}`);
const runtimeErrors = contract.validateRuntimeVariables(owner.planSpec, vars);
if (runtimeErrors.length) throw new Error(`Runtime variables invalid: ${runtimeErrors.join('; ')}`);

const substitute = value => {
  if (typeof value === 'string') return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Unresolved variable $${key}`);
    return vars[key];
  });
  if (Array.isArray(value)) return value.map(substitute);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, substitute(child)]));
  return value;
};

const waves = (plan.waves || []).map(wave => ({ ...wave, calls: (wave.calls || []).map(substitute) }));
const artifact = substitute(plan.artifact || '');
const refdate = vars.refdate || plan.reference_date;
const resolvedInput = { artifact, refdate, waves };
const planSha256 = contract.sha256(planBytes);
const inputSha256 = contract.sha256(Buffer.from(contract.stableStringify(resolvedInput)));
const generatedAt = new Date().toISOString();

let previousHarness = null;
try { previousHarness = JSON.parse(fs.readFileSync(path.join(outDir, 'harness.json'), 'utf8')); } catch (_) {}
const previousByName = new Map((previousHarness?.sources || []).map(source => [source.name, source]));

function visitDates(value, predicate) {
  let best = null;
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (typeof child === 'string' && predicate(key)) {
        const parsed = Date.parse(child);
        if (Number.isFinite(parsed) && parsed <= Date.now() && (!best || parsed > Date.parse(best))) best = new Date(parsed).toISOString();
      }
      visit(child);
    }
  };
  visit(value);
  return best;
}

function maxBarDate(value) {
  let best = null;
  const visit = (node, inBars = false) => {
    if (Array.isArray(node)) {
      if (inBars) for (const row of node) {
        const raw = Array.isArray(row) ? row[0] : row?.date || row?.time || row?.timestamp;
        const match = String(raw || '').match(/\d{4}-\d{2}-\d{2}/);
        if (match && (!best || match[0] > best)) best = match[0];
      }
      return node.forEach(child => visit(child, inBars));
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) visit(child, inBars || key === 'bars');
  };
  visit(value);
  return best;
}

function maxObservedDate(value) {
  const serialized = JSON.stringify(value);
  const today = generatedAt.slice(0, 10);
  let best = null;
  for (const match of serialized.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
    const date = match[0];
    if (date < '2000-01-01' || date > today) continue;
    if (!best || date > best) best = date;
  }
  return best;
}

const journalWaves = [];
const sources = [];
let failures = 0;
let executedCalls = 0;
for (const wave of waves) {
  const calls = [];
  for (const call of wave.calls || []) {
    executedCalls++;
    const sourcePath = path.join(outDir, `${call.as}.json`);
    const required = call.freshness?.required !== false;
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).size) {
      calls.push({ as: call.as, server: call.server, tool: call.tool, required, detached: !!wave.detached, ok: false, ms: 0, wait_ms: 0, error: 'agent MCP artifact missing' });
      if (required) failures++;
      continue;
    }
    const bytes = fs.readFileSync(sourcePath);
    const payload = JSON.parse(bytes.toString('utf8'));
    const hash = contract.sha256(bytes);
    const dataThrough = call.freshness?.expects_close ? maxBarDate(payload) : maxObservedDate(payload);
    if (call.freshness?.expects_close && dataThrough !== refdate) {
      throw new Error(`${call.as}: expected close ${refdate}, observed ${dataThrough || 'none'}`);
    }
    if (call.tool === 'GetStatus') {
      const actualClose = JSON.stringify(payload).match(/"bar_service_1d_max_last_bar_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
      if (call.assert?.expected_close && actualClose !== call.assert.expected_close) throw new Error(`${call.as}: GetStatus close ${actualClose || 'missing'} != ${call.assert.expected_close}`);
    }
    const embeddedObservation = visitDates(payload, key => /^(as_of|timestamp|generated_at|fetched_at|observed_at)$/i.test(key));
    const observationAtCallTime = new Set(['GetStatus', 'ExplainSymbolMove', 'GetSymbolSignals', 'GetEarningsCalendarFiltered']);
    const observedAt = (observationAtCallTime.has(call.tool) ? generatedAt : null)
      || embeddedObservation
      || previousByName.get(call.as)?.as_of
      || generatedAt;
    calls.push({ as: call.as, server: call.server, tool: call.tool, required, detached: !!wave.detached, ok: true, ms: 0, wait_ms: 0, error: null, output_sha256: hash });
    sources.push({
      name: call.as,
      sha256: hash,
      as_of: observedAt,
      data_through: dataThrough,
      max_age_h: call.freshness?.max_age_h,
      required,
      ...(call.freshness?.expects_close ? { expects_close: true, reference_close: refdate } : {}),
      temporal_mode: call.args?.as_of || call.args?.end_date ? 'point_in_time_or_bounded' : 'current',
      note: `${call.server}.${call.tool} ingéré depuis la réponse MCP authentifiée de la session agent${call.freshness?.note ? ` — ${call.freshness.note}` : ''}`
    });
  }
  journalWaves.push({ name: wave.name, ms: 0, calls });
}
if (failures) throw new Error(`${failures} required artifact(s) missing`);

const planRelative = path.relative(ROOT, planPath).replace(/\\/g, '/');
const journal = {
  contract_version: '1.0', workflow: owner.workflow, plan: planRelative, plan_sha256: planSha256,
  input_sha256: inputSha256, resolved_input: resolvedInput, artifact, reference_date: refdate,
  started_at: generatedAt, finished_at: generatedAt, failures: 0, blocked_at_gate: null,
  executed_calls: executedCalls, skipped_calls: 0, collection_mode: 'authenticated_agent_mcp_ingest', waves: journalWaves
};
const harness = {
  contract_version: '1.0', workflow: owner.workflow, generated_at: generatedAt, artifact,
  content: artifact.endsWith('/index.html') ? path.dirname(artifact) : artifact,
  reference_close: refdate, plan: planRelative, plan_sha256: planSha256, input_sha256: inputSha256, sources
};
fs.writeFileSync(path.join(outDir, '_collect.json'), JSON.stringify(journal, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'harness.json'), JSON.stringify(harness, null, 2) + '\n');
console.log(`[ingest-collection] ${sources.length}/${executedCalls} source(s), plan ${planSha256.slice(0, 12)}, close ${refdate}`);
