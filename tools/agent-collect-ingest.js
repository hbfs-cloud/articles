#!/usr/bin/env node
'use strict';

// Persist MCP responses collected by an authenticated agent when the connected
// marketdata channel cannot mint a second TTL token for collect.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const planRel = arg('--plan');
const outRel = arg('--out');
const vars = {};
argv.forEach((value, i) => {
  if (value !== '--var' || !argv[i + 1]) return;
  const eq = argv[i + 1].indexOf('=');
  if (eq > 0) vars[argv[i + 1].slice(0, eq)] = argv[i + 1].slice(eq + 1);
});
if (!planRel || !outRel) {
  console.error('Usage: agent-collect-ingest.js --plan plans/x.json --out path --var key=value');
  process.exit(2);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function substitute(value) {
  if (typeof value === 'string') {
    return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => {
      if (!(key in vars)) throw new Error(`variable manquante: ${key}`);
      return vars[key];
    });
  }
  if (Array.isArray(value)) return value.map(substitute);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v)]));
  }
  return value;
}

function dates(value, out = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) out.push(match[1]);
  } else if (Array.isArray(value)) {
    value.forEach(v => dates(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(v => dates(v, out));
  }
  return out;
}

let raw = '';
let handled = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  raw += chunk;
  if (!handled && raw.endsWith('\n')) {
    process.stdin.pause();
    finish();
  }
});
process.stdin.on('end', finish);

function finish() {
  if (handled) return;
  handled = true;
  try {
    const planPath = path.resolve(ROOT, planRel);
    const outDir = path.resolve(ROOT, outRel);
    const planBytes = fs.readFileSync(planPath);
    const plan = JSON.parse(planBytes);
    const resolved = substitute(plan);
    const supplied = JSON.parse(raw);
    const byAlias = new Map((supplied.results || []).map(r => [r.as, r]));
    const plannedCalls = resolved.waves.flatMap(w => (w.calls || []).map(c => ({ wave: w, call: c })));
    const extras = [...byAlias.keys()].filter(alias => !plannedCalls.some(x => x.call.as === alias));
    if (extras.length) throw new Error(`réponses hors plan: ${extras.join(', ')}`);
    const missing = plannedCalls.filter(x => !byAlias.has(x.call.as)).map(x => x.call.as);
    if (missing.length) throw new Error(`réponses planifiées absentes: ${missing.join(', ')}`);

    fs.mkdirSync(outDir, { recursive: true });
    const sources = [];
    const journalWaves = [];
    let failures = 0;
    let blockedAtGate = null;
    for (const wave of resolved.waves) {
      const waveCalls = [];
      for (const call of wave.calls || []) {
        const result = byAlias.get(call.as);
        const required = call.freshness?.required !== false;
        const pagination = result.value?.pagination || result.value?.data?.pagination;
        const incompletePagination = pagination?.has_next === true;
        const ok = result.ok === true && !incompletePagination;
        const row = {
          as: call.as,
          server: call.server,
          tool: call.tool,
          required,
          detached: !!wave.detached,
          ok,
          ms: result.ms || 0,
          wait_ms: result.wait_ms || 0,
          error: ok ? null : (incompletePagination
            ? 'pagination MCP incomplète: has_next=true'
            : (result.error || 'échec MCP non détaillé')),
        };
        if (ok) {
          const body = JSON.stringify(result.value, null, 2);
          fs.writeFileSync(path.join(outDir, `${call.as}.json`), body);
          row.output_sha256 = sha256(body);
          if (call.freshness) {
            const observed = dates(result.value).filter(d => d <= vars.refdate).sort().at(-1) || null;
            sources.push({
              name: call.as,
              sha256: row.output_sha256,
              as_of: result.as_of || supplied.completed_at,
              data_through: call.freshness.expects_close ? observed : (result.data_through || observed),
              max_age_h: call.freshness.max_age_h,
              required,
              ...(call.freshness.expects_close ? { expects_close: true, reference_close: vars.refdate } : {}),
              note: call.freshness.note || `${call.server}.${call.tool} (date de référence ${vars.refdate})`,
            });
          }
        } else if (!wave.detached) {
          failures++;
        }
        waveCalls.push(row);
      }
      journalWaves.push({ name: wave.name, ms: 0, calls: waveCalls });
      if (wave.gate && waveCalls.some(c => !c.ok && c.required)) blockedAtGate = wave.name;
    }

    const artifact = resolved.artifact;
    const planHash = sha256(planBytes);
    const inputHash = sha256(stable({ artifact, refdate: vars.refdate, waves: resolved.waves }));
    const journal = {
      contract_version: '1.0',
      workflow: supplied.workflow || null,
      plan: path.relative(ROOT, planPath).replace(/\\/g, '/'),
      plan_sha256: planHash,
      input_sha256: inputHash,
      resolved_input: { artifact, refdate: vars.refdate, waves: resolved.waves },
      artifact,
      reference_date: vars.refdate,
      started_at: supplied.started_at,
      finished_at: supplied.completed_at,
      failures,
      blocked_at_gate: blockedAtGate,
      executed_calls: plannedCalls.length,
      skipped_calls: 0,
      collection_mode: 'authenticated_agent_mcp',
      waves: journalWaves,
    };
    const harness = {
      contract_version: '1.0',
      workflow: supplied.workflow || null,
      generated_at: supplied.completed_at,
      artifact,
      content: artifact.endsWith('/index.html') ? path.dirname(artifact) : artifact,
      reference_close: vars.refdate,
      plan: journal.plan,
      plan_sha256: planHash,
      input_sha256: inputHash,
      sources,
    };
    fs.writeFileSync(path.join(outDir, '_collect.json'), JSON.stringify(journal, null, 2));
    fs.writeFileSync(path.join(outDir, 'harness.json'), JSON.stringify(harness, null, 2));
    console.log(`[agent-collect-ingest] ${sources.length} source(s), ${failures} échec(s)`);
    if (failures || blockedAtGate) process.exit(1);
  } catch (error) {
    console.error(`[agent-collect-ingest] ${error.message}`);
    process.exit(1);
  }
}
