#!/usr/bin/env node
'use strict';
/**
 * substack-publish.js — Optional, non-blocking Substack publication step.
 *
 * 1. Converts a separately authored English artifact into a Substack draft via
 *    gen-substack-draft.js (French website articles fail closed; in-process module call falls back to a spawned
 *    child process if the module require ever fails, e.g. syntax drift).
 * 2. Always writes the draft locally to data/substack-drafts/<slug>.json —
 *    this step never fails silently and never touches the network to do this.
 * 3. ONLY if SUBSTACK_MCP_URL is reachable AND a bearer token is present in
 *    env var MCP_AUTH_TOKEN, POSTs a JSON-RPC 2.0 `tools/call` for `create_note`
 *    (Notes teaser). With --draft, also calls `create_draft` (full post draft).
 *    Without a bearer token (or if the endpoint can't be reached), the tool
 *    stays in "draft-only local" mode and prints a clear, human-readable note
 *    explaining why — it NEVER throws an uncaught exception and NEVER blocks
 *    the caller.
 *
 * Exit codes (safe to wrap with `|| true` / `|| echo ... non-blocking`):
 *   0 — draft written; no remote POST attempted, or remote POST succeeded.
 *   1 — draft generation itself failed (bad path / unreadable / unparsable article).
 *   2 — draft written OK, but the remote Substack POST was attempted and failed
 *       (network unreachable, auth rejected, or the MCP tool call errored).
 *
 * Usage:
 *   node tools/substack-publish.js <path/to/article/index.html>
 *   node tools/substack-publish.js <path> --draft      # also create_draft (full post)
 *   node tools/substack-publish.js <path> --json       # print result summary as JSON
 *
 * Env:
 *   SUBSTACK_MCP_URL   default https://substack.dailytickers.com/mcp
 *   MCP_AUTH_TOKEN     bearer token for the Substack MCP gateway (never logged)
 *   SUBSTACK_TIMEOUT_MS  request timeout in ms (default 8000 — kept short on purpose)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRAFTS_DIR = path.join(ROOT, 'data', 'substack-drafts');
const GATEWAY = process.env.SUBSTACK_MCP_URL || 'https://substack.dailytickers.com/mcp';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';
const TIMEOUT_MS = +(process.env.SUBSTACK_TIMEOUT_MS || 8000);

// ─── Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const inputArg = args.find(a => !a.startsWith('--'));
const WANT_DRAFT_POST = flags.has('--draft');
const WANT_JSON = flags.has('--json');

function log(...msg) { if (!WANT_JSON) console.log(...msg); }
function errLog(...msg) { console.error(...msg); }

if (!inputArg) {
  errLog('Usage: node tools/substack-publish.js <path/to/article> [--draft] [--json]');
  process.exit(1);
}

// ─── Step 1: Generate the draft (module call, spawn fallback) ──────────────
function resolveArticlePath(p) {
  let abs = path.resolve(process.cwd(), p);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    abs = path.join(abs, 'index.html');
  }
  return abs;
}

function genDraftViaModule(absPath) {
  // eslint-disable-next-line global-require
  const gen = require('./gen-substack-draft');
  const draft = gen.convert(absPath);
  const slug = gen.slugFromPath(absPath);
  return { draft, slug };
}

function genDraftViaSpawn(absPath) {
  const res = spawnSync('node', [path.join(__dirname, 'gen-substack-draft.js'), absPath, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (res.status !== 0 || res.error) {
    throw new Error('gen-substack-draft.js (spawn) failed: ' + (res.stderr || res.error || 'unknown error'));
  }
  const draft = JSON.parse(res.stdout);
  // Slug fallback mirrors gen-substack-draft.js's own slugFromPath logic.
  let rel = path.relative(ROOT, absPath).split(path.sep).join('/');
  rel = rel.replace(/\/?index\.html?$/i, '').replace(/\/+$/, '');
  const slug = rel.replace(/[\/]+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '') || 'draft';
  return { draft, slug };
}

let absPath, draft, slug;
try {
  absPath = resolveArticlePath(inputArg);
  if (!fs.existsSync(absPath)) {
    throw new Error('File not found: ' + absPath);
  }
  try {
    ({ draft, slug } = genDraftViaModule(absPath));
  } catch (moduleErr) {
    log(`⚠️  In-process draft generation failed (${moduleErr.message}) — retrying via spawn...`);
    ({ draft, slug } = genDraftViaSpawn(absPath));
  }
} catch (e) {
  errLog('ERROR: draft generation failed — ' + e.message);
  process.exit(1);
}

// ─── Step 2: Always write the draft locally (never network-dependent) ──────
let draftPath;
try {
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  draftPath = path.join(DRAFTS_DIR, slug + '.json');
  const relArticle = path.relative(ROOT, absPath).split(path.sep).join('/');
  const record = {
    title: draft.title,
    subtitle: draft.subtitle,
    body_markdown: draft.body_markdown,
    canonical_url: draft.canonical_url,
    tags: draft.tags,
    note: draft.note,
    source_path: relArticle,
    generated_at: new Date().toISOString(),
    substack: null, // filled in below once we know the POST outcome
  };
  fs.writeFileSync(draftPath, JSON.stringify(record, null, 2), 'utf8');
  log(`✅ Draft written → ${path.relative(ROOT, draftPath)}`);
} catch (e) {
  errLog('ERROR: failed to write local draft — ' + e.message);
  process.exit(1);
}

// ─── Step 3: Optional remote POST (create_note [+ create_draft]) ───────────
function jsonrpcCall(toolName, params) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(GATEWAY); } catch (e) { return reject(new Error('invalid SUBSTACK_MCP_URL: ' + e.message)); }
    if (url.protocol !== 'https:') return reject(new Error(`HTTPS required for SUBSTACK_MCP_URL (got ${url.protocol})`));

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name: toolName, arguments: params },
    });
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: TIMEOUT_MS,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error(`[${toolName}] rpc error: ${j.error.message || JSON.stringify(j.error)}`));
          const r = j.result;
          if (r && r.isError) {
            const msg = r.content?.[0]?.text || 'MCP tool returned isError';
            return reject(new Error(`[${toolName}] ${msg}`));
          }
          if (r && r.content && Array.isArray(r.content) && r.content[0]?.type === 'text') {
            try { return resolve(JSON.parse(r.content[0].text)); }
            catch { return resolve(r.content[0].text); }
          }
          resolve(r);
        } catch (e) {
          reject(new Error(`[${toolName}] non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', (e) => reject(new Error(`[${toolName}] network error: ${e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error(`[${toolName}] timeout after ${TIMEOUT_MS}ms`)); });
    req.write(body);
    req.end();
  });
}

async function attemptRemotePublish() {
  const outcome = {
    attempted: false,
    mode: 'draft-only',
    reason: null,
    note_posted: false,
    draft_posted: false,
    error: null,
  };

  if (!AUTH_TOKEN) {
    outcome.reason = 'no MCP_AUTH_TOKEN set in env — staying in draft-only local mode.';
    return outcome;
  }

  outcome.attempted = true;
  try {
    const noteResult = await jsonrpcCall('create_note', { body: draft.note, teaser: draft.note });
    outcome.note_posted = true;
    outcome.mode = 'live';
    outcome.note_result = noteResult;

    if (WANT_DRAFT_POST) {
      try {
        const draftResult = await jsonrpcCall('create_draft', {
          title: draft.title,
          subtitle: draft.subtitle,
          body_markdown: draft.body_markdown,
          canonical_url: draft.canonical_url,
        });
        outcome.draft_posted = true;
        outcome.draft_result = draftResult;
      } catch (e) {
        outcome.error = e.message;
      }
    }
  } catch (e) {
    // Expected today: the real Substack MCP has no session cookie configured
    // yet, so create_note fails cleanly server-side. Surface the message and
    // fall back to draft-only — never crash, never block the caller.
    outcome.mode = 'draft-only';
    outcome.error = e.message;
  }
  return outcome;
}

(async () => {
  let outcome;
  try {
    outcome = await attemptRemotePublish();
  } catch (e) {
    // Absolute safety net — attemptRemotePublish already catches its own
    // errors, but never let anything escape uncaught.
    outcome = { attempted: false, mode: 'draft-only', reason: null, note_posted: false, draft_posted: false, error: 'unexpected: ' + e.message };
  }

  try {
    const record = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    record.substack = outcome;
    fs.writeFileSync(draftPath, JSON.stringify(record, null, 2), 'utf8');
  } catch (e) {
    errLog('⚠️  Could not annotate draft file with publish outcome: ' + e.message);
  }

  if (!outcome.attempted) {
    log(`ℹ️  Substack POST skipped — ${outcome.reason}`);
  } else if (outcome.note_posted) {
    log('✅ Substack Note posted.');
    if (WANT_DRAFT_POST) {
      log(outcome.draft_posted ? '✅ Substack draft post created.' : `⚠️  create_draft failed: ${outcome.error}`);
    }
  } else {
    log(`⚠️  Substack POST failed (draft still saved locally): ${outcome.error}`);
  }

  if (WANT_JSON) {
    console.log(JSON.stringify({
      draft_path: path.relative(ROOT, draftPath),
      canonical_url: draft.canonical_url,
      substack: outcome,
    }, null, 2));
  }

  if (outcome.attempted && !outcome.note_posted) process.exit(2);
  process.exit(0);
})();
