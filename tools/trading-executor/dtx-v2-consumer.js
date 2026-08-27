#!/usr/bin/env node
'use strict';

// Consume raw systematic MCP DtxDecide output for the broker DTX V2 boundary.
// The MCP call itself is done by the agent, like /scanner. This file only reads
// the captured JSON, unwraps the job result, validates Contract V2, and refuses
// legacy actions.CREATE as non-executable for a V2 broker client.

const fs = require('fs');
const crypto = require('crypto');

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--decide' || a === '--input') o.input = argv[++i];
    else if (a === '--request-id') o.requestId = argv[++i];
    else if (a === '--now') o.now = argv[++i];
    else if (a === '--json') o.json = true;
  }
  return o;
}

function readJson(file) {
  const raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function unwrapMcpResult(payload) {
  if (!payload || typeof payload !== 'object') {
    return { kind: 'invalid', payload: null, errors: ['DtxDecide payload is not an object'] };
  }
  if (payload.status === 'async_pending') {
    return { kind: 'async_pending', job_id: payload.job_id || null, errors: ['DtxDecide job is still pending; poll DtxJobStatus, do not call DtxDecide again'] };
  }
  if (payload.status === 'error') {
    return { kind: 'error', errors: [payload.error || payload.message || 'DtxDecide returned status=error'] };
  }
  if (payload.status === 'done' && payload.result && typeof payload.result === 'object') {
    return { kind: 'result', payload: payload.result, job_id: payload.job_id || null };
  }
  return { kind: 'result', payload };
}

function nonEmpty(v) {
  return v !== null && v !== undefined && v !== '';
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const k of Object.keys(value).sort()) out[k] = stable(value[k]);
  return out;
}

function engineOrderFingerprint(ctx, group, candidate) {
  const material = {
    request_id: ctx.request_id,
    run_id: ctx.run_id,
    call_id: ctx.call_id,
    plan_id: ctx.plan_id,
    revision: ctx.revision,
    group_id: group.group_id,
    candidate_id: candidate.candidate_id,
    rank: candidate.rank,
    symbol: candidate.symbol,
    side: candidate.side,
    qty: candidate.qty,
    broker: candidate.broker,
    sleeve: candidate.sleeve,
    order: candidate.order,
    protection: candidate.protection,
    execution: candidate.execution,
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable(material))).digest('hex');
}

function classifyDtxDecide(payload) {
  if (!payload || typeof payload !== 'object') return 'invalid';
  if (payload.contract_version === '2.0' || payload.execution_plan) return 'v2';
  if (payload.actions) return 'legacy_v1';
  return 'unknown';
}

function validateProtection(candidate, errors, label) {
  const p = candidate.protection;
  if (!isPlainObject(p)) {
    errors.push(`${label}: protection must be an object`);
    return;
  }
  if (!nonEmpty(p.mode)) errors.push(`${label}: protection.mode missing`);
  if (candidate.side === 'BUY' && p.mode === 'none') {
    errors.push(`${label}: BUY candidate cannot have protection.mode=none`);
  }
  if (p.mode === 'native_bracket') {
    if (!nonEmpty(p.stop_loss)) errors.push(`${label}: native_bracket.stop_loss missing`);
    if (!nonEmpty(p.take_profit)) errors.push(`${label}: native_bracket.take_profit missing`);
  } else if (p.mode === 'native_oco') {
    if (!Array.isArray(p.legs) || p.legs.length !== 2) errors.push(`${label}: native_oco requires exactly two legs`);
  } else if (p.mode === 'engine_managed') {
    if (!nonEmpty(p.stop_loss)) errors.push(`${label}: engine_managed.stop_loss missing`);
    if (!nonEmpty(p.exit_policy_ref)) errors.push(`${label}: engine_managed.exit_policy_ref missing`);
  } else if (p.mode !== 'none') {
    errors.push(`${label}: unsupported protection.mode=${p.mode}`);
  }
}

function validateOrder(candidate, errors, label) {
  const order = candidate.order;
  if (!isPlainObject(order)) {
    errors.push(`${label}: order must be an object`);
    return;
  }
  const orderType = order.order_type || order.type;
  if (!nonEmpty(orderType)) errors.push(`${label}: order.order_type missing`);
  const qty = nonEmpty(candidate.qty) ? candidate.qty : order.qty;
  if (!nonEmpty(qty)) errors.push(`${label}: qty missing`);
  const t = String(orderType || '').toLowerCase();
  if ((t === 'limit' || t === 'stop_limit') && !nonEmpty(order.limit_price)) {
    errors.push(`${label}: ${orderType}.limit_price missing`);
  }
  if ((t === 'stop' || t === 'stop_limit') && !nonEmpty(order.stop_price)) {
    errors.push(`${label}: ${orderType}.stop_price missing`);
  }
}

function validateDtxV2Response(payload, opts = {}) {
  const errors = [];
  if (!isPlainObject(payload)) errors.push('response must be an object');
  if (payload.contract_version !== '2.0') errors.push('contract_version must equal "2.0"');
  if (opts.requestId && payload.request_id !== opts.requestId) {
    errors.push(`request_id mismatch: expected ${opts.requestId}, got ${payload.request_id || 'missing'}`);
  }
  for (const k of ['request_id', 'run_id', 'call_id']) {
    if (!nonEmpty(payload[k])) errors.push(`${k} missing`);
  }
  const plan = payload.execution_plan;
  if (!isPlainObject(plan)) errors.push('execution_plan missing');
  if (plan && !nonEmpty(plan.plan_id)) errors.push('execution_plan.plan_id missing');
  const revision = Number((plan && plan.revision) ?? payload.revision);
  if (!Number.isFinite(revision) || revision < 1) errors.push('revision must be >= 1');
  const validFrom = (plan && plan.valid_from) || payload.valid_from;
  const validUntil = (plan && plan.valid_until) || payload.valid_until;
  if (!nonEmpty(validFrom)) errors.push('valid_from missing');
  if (!nonEmpty(validUntil)) errors.push('valid_until missing');
  if (validUntil && opts.now) {
    const until = Date.parse(validUntil);
    const now = Date.parse(opts.now);
    if (Number.isFinite(until) && Number.isFinite(now) && now > until) errors.push(`plan expired at ${validUntil}`);
  }

  const groups = plan && Array.isArray(plan.groups) ? plan.groups : null;
  if (!groups) errors.push('execution_plan.groups must be an array');

  const groupIds = new Set();
  const candidateIds = new Set();
  const normalizedGroups = [];
  if (groups) {
    for (const group of groups) {
      const gid = group && group.group_id;
      const glabel = gid || '<missing-group>';
      if (!nonEmpty(gid)) errors.push('group_id missing');
      else if (groupIds.has(gid)) errors.push(`duplicate group_id=${gid}`);
      else groupIds.add(gid);
      if (group.max_winners !== 1) errors.push(`${glabel}: max_winners must equal 1`);

      const candidates = Array.isArray(group.candidates) ? group.candidates : null;
      if (!candidates) {
        errors.push(`${glabel}: candidates must be an array`);
        continue;
      }
      const ranks = [];
      const normalizedCandidates = [];
      for (const candidate of candidates) {
        const cid = candidate && candidate.candidate_id;
        const clabel = `${glabel}/${cid || '<missing-candidate>'}`;
        if (!nonEmpty(cid)) errors.push(`${glabel}: candidate_id missing`);
        else if (candidateIds.has(cid)) errors.push(`duplicate candidate_id=${cid}`);
        else candidateIds.add(cid);
        if (!Number.isFinite(Number(candidate.rank))) errors.push(`${clabel}: rank missing or non-numeric`);
        else ranks.push(Number(candidate.rank));
        for (const k of ['symbol', 'side', 'qty', 'broker', 'sleeve', 'reason', 'decision_context']) {
          if (!nonEmpty(candidate[k])) errors.push(`${clabel}: ${k} missing`);
        }
        validateOrder(candidate, errors, clabel);
        validateProtection(candidate, errors, clabel);
        if (!isPlainObject(candidate.execution)) errors.push(`${clabel}: execution must be an object`);
        normalizedCandidates.push(candidate);
      }
      const sorted = [...ranks].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] === sorted[i - 1]) errors.push(`${glabel}: duplicate rank=${sorted[i]}`);
        if (i > 0 && sorted[i] <= sorted[i - 1]) errors.push(`${glabel}: ranks must be strictly increasing`);
      }
      normalizedGroups.push({ ...group, candidates: normalizedCandidates.sort((a, b) => Number(a.rank) - Number(b.rank)) });
    }
  }

  const ctx = {
    request_id: payload.request_id,
    run_id: payload.run_id,
    call_id: payload.call_id,
    plan_id: plan && plan.plan_id,
    revision,
  };
  const executableGroups = normalizedGroups.map((group) => ({
    ...group,
    candidates: group.candidates.map((candidate) => ({
      ...candidate,
      engine_order_fingerprint: engineOrderFingerprint(ctx, group, candidate),
    })),
  }));

  return {
    ok: errors.length === 0,
    errors,
    response: payload,
    plan: plan ? { ...plan, revision, valid_from: validFrom, valid_until: validUntil, groups: executableGroups } : null,
    state: payload.state,
    updates: payload.actions && Array.isArray(payload.actions.UPDATE) ? payload.actions.UPDATE : [],
    cancels: payload.actions && Array.isArray(payload.actions.CANCEL) ? payload.actions.CANCEL : [],
  };
}

function consumeDtxDecidePayload(raw, opts = {}) {
  const unwrapped = unwrapMcpResult(raw);
  if (unwrapped.kind !== 'result') return { ok: false, mode: unwrapped.kind, errors: unwrapped.errors || [], job_id: unwrapped.job_id || null };
  const payload = unwrapped.payload;
  const mode = classifyDtxDecide(payload);
  if (mode === 'legacy_v1') {
    const create = payload.actions && Array.isArray(payload.actions.CREATE) ? payload.actions.CREATE.length : 0;
    return {
      ok: false,
      mode,
      payload,
      create_count: create,
      errors: ['legacy actions.CREATE payload is scanner staging input only; broker DTX V2 must consume execution_plan.groups'],
    };
  }
  if (mode !== 'v2') {
    return { ok: false, mode, payload, errors: ['payload is neither DtxDecide V2 nor legacy actions payload'] };
  }
  const validation = validateDtxV2Response(payload, opts);
  return { mode, ...validation };
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.input) {
    console.error('Usage: node tools/trading-executor/dtx-v2-consumer.js --decide <raw-dtx-decide.json> [--request-id UUID] [--now ISO] [--json]');
    process.exit(2);
  }
  let result;
  try {
    result = consumeDtxDecidePayload(readJson(opts.input), { requestId: opts.requestId, now: opts.now || new Date().toISOString() });
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
  if (opts.json) {
    console.log(JSON.stringify({
      ok: result.ok,
      mode: result.mode,
      errors: result.errors,
      plan_id: result.plan && result.plan.plan_id,
      revision: result.plan && result.plan.revision,
      groups: result.plan && result.plan.groups ? result.plan.groups.length : 0,
      create_count: result.create_count,
    }, null, 2));
  } else if (result.ok) {
    const candidates = result.plan.groups.reduce((n, g) => n + g.candidates.length, 0);
    console.log(`OK DtxDecide V2 plan=${result.plan.plan_id} revision=${result.plan.revision} groups=${result.plan.groups.length} candidates=${candidates}`);
  } else {
    console.error(`REFUSED ${result.mode}:`);
    for (const e of result.errors) console.error(`  - ${e}`);
  }
  if (result.ok) return;
  process.exit(result.mode === 'legacy_v1' ? 4 : result.mode === 'async_pending' ? 6 : 5);
}

if (require.main === module) main();

module.exports = {
  unwrapMcpResult,
  classifyDtxDecide,
  validateDtxV2Response,
  consumeDtxDecidePayload,
  engineOrderFingerprint,
};
