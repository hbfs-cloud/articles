'use strict';

/**
 * simulator-client.js — shared client for the articles -> broker-simulator parallel-run.
 *
 * Reads data/simulator-config.json (base url + tolerances + optional mode->account map),
 * loads the SERVICE TOKEN from env BROKERSIM_SERVICE_TOKEN (never hardcoded, never committed),
 * and resolves the per-mode account by matching the label "mirror:<mode>" against
 * GET /api/accounts (the service token auto-scopes to its protected workspace, so no
 * X-Org-Id header is sent). All mutations go through the REST /api contract documented in
 * broker-simulator/internal/api/{backfill,mirror}.go.
 *
 * Used by export-to-simulator.js, publish-to-simulator.js and reconcile-simulator.js.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// ── .env loader (same minimal parser as telegram-notify.js) ──────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

// ── config ───────────────────────────────────────────────────────────────────
function loadConfig() {
  const file = path.join(ROOT, 'data', 'simulator-config.json');
  if (!fs.existsSync(file)) throw new Error(`simulator-config.json not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getToken(cfg) {
  loadEnv();
  const envName = (cfg && cfg.tokenEnv) || 'BROKERSIM_SERVICE_TOKEN';
  const token = process.env[envName];
  if (!token) throw new Error(`service token missing: set env ${envName} (do NOT hardcode)`);
  return token;
}

// ── client ─────────────────────────────────────────────────────────────────────
class SimulatorClient {
  constructor() {
    this.cfg     = loadConfig();
    this.baseUrl = this.cfg.baseUrl.replace(/\/+$/, '');
    this.token   = getToken(this.cfg);
    this._accountsCache = null; // GET /api/accounts result, fetched once.
  }

  async request(method, route, body) {
    const res = await fetch(this.baseUrl + route, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type':  'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) {
      const msg = json && json.message ? json.message : text;
      const err = new Error(`${method} ${route} -> ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  // GET /api/accounts (cached). The service token scopes the list to its workspace.
  async listAccounts() {
    if (this._accountsCache) return this._accountsCache;
    this._accountsCache = await this.request('GET', '/api/accounts');
    return this._accountsCache;
  }

  // Resolve the account id for a pilot mode. A pinned id in modeAccounts wins;
  // otherwise match the label "mirror:<mode>" (case-insensitive) in GET /api/accounts.
  async resolveAccountId(mode) {
    const pinned = this.cfg.modeAccounts && this.cfg.modeAccounts[mode];
    if (pinned) return pinned;
    const want = `mirror:${mode}`.toLowerCase();
    const accounts = await this.listAccounts();
    const hit = (accounts || []).find(a => (a.label || '').toLowerCase() === want);
    if (!hit) throw new Error(`no sim account labelled "mirror:${mode}" (and none pinned in modeAccounts)`);
    return hit.id;
  }

  backfill(accountId, payload)    { return this.request('POST', `/api/accounts/${accountId}/backfill`, payload); }
  mirrorOrder(accountId, intent)  { return this.request('POST', `/api/accounts/${accountId}/mirror-order`, intent); }
  getPortfolio(accountId)         { return this.request('GET',  `/api/accounts/${accountId}/portfolio`); }
  getEquityCurve(accountId)       { return this.request('GET',  `/api/accounts/${accountId}/equity-curve`); }
}

module.exports = { SimulatorClient, loadConfig, loadEnv };
