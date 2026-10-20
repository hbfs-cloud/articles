#!/usr/bin/env node
'use strict';
// Fortress STEP 0 — appels marketdata MCP en lecture seule, réponses brutes persistées.
// Usage : node mcp-call.js <spec.json>
// spec = [{ name, tool, args, async? }] ; chaque réponse → fortress-step0-raw/<name>.json
// Le jeton est lu depuis l'environnement (MCP_TOKEN_MARKETDATA, injecté par run.sh). Jamais écrit.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../../../..');
const { callToolWithRetry, awaitJob, redactSecrets } = require(path.join(ROOT, 'tools/lib/mcp-client.js'));

const RAW = path.resolve(__dirname, '../fortress-step0-raw');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const conc = Number(process.env.CONC || 4);

function jobIdOf(r) {
  if (!r || typeof r !== 'object') return null;
  const st = r.status || (r.data && r.data.status);
  const id = r.job_id || (r.data && r.data.job_id);
  if (id && st && !['completed', 'done'].includes(st)) return id;
  return null;
}

async function one(c) {
  const t0 = new Date().toISOString();
  const env = { name: c.name, server: 'marketdata', tool: c.tool, args: c.args, called_at: t0 };
  try {
    let r = await callToolWithRetry('marketdata', c.tool, c.args || {}, { timeoutMs: 120000 });
    env.submit_response = null;
    const jid = jobIdOf(r);
    if (jid) {
      env.submit_response = r;
      env.job_id = jid;
      r = await awaitJob('marketdata', jid, { maxMs: 300000 });
    }
    env.completed_at = new Date().toISOString();
    env.ok = true;
    env.response = r;
  } catch (e) {
    env.completed_at = new Date().toISOString();
    env.ok = false;
    env.error = redactSecrets(e.message);
    if (e.failedResponse) env.failed_response = e.failedResponse;
  }
  const text = JSON.stringify(env, null, 1);
  const file = path.join(RAW, `${c.name}.json`);
  fs.writeFileSync(file, text);
  const sha = crypto.createHash('sha256').update(text).digest('hex');
  console.log(`${env.ok ? 'OK ' : 'ERR'} ${c.name} ${c.tool} ${text.length}B sha=${sha.slice(0, 12)}${env.ok ? '' : ' :: ' + env.error.slice(0, 300)}`);
}

(async () => {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, spec.length) }, async () => {
    for (;;) { const k = i++; if (k >= spec.length) return; await one(spec[k]); }
  }));
})().catch(e => { console.error(redactSecrets(e.message)); process.exit(1); });
