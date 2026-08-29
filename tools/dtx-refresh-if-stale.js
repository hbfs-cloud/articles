#!/usr/bin/env node
'use strict';

const { callTool, redactSecrets } = require('./lib/mcp-client');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function find(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) return value[key];
  for (const child of Object.values(value)) { const found = find(child, key); if (found != null) return found; }
  return null;
}
function healthState(value, expectedClose) {
  const last = String(find(value, 'last_data_date') || find(value, 'data_asof') || '').slice(0, 10);
  const runningValue = find(value, 'running');
  const running = runningValue === true;
  const ok = find(value, 'ok') === true && find(value, 'freshness_ok') === true
    && find(value, 'behind_expected') === false && last === expectedClose && runningValue === false;
  return { ok, last_data_date: last || null, prefetch_running: running };
}

async function refreshIfStale(expectedClose, options = {}) {
  const pollMs = options.pollMs || Number(process.env.DTX_REFRESH_POLL_MS || 15_000);
  const timeoutMs = options.timeoutMs || Number(process.env.DTX_REFRESH_TIMEOUT_MS || 10 * 60_000);
  let health = await callTool('systematic', 'GetHealth', { expected_close: expectedClose });
  let state = healthState(health, expectedClose);
  if (state.ok) return { refreshed: false, state };
  const refresh = await callTool('systematic', 'DtxRefreshBars', {});
  const status = String(find(refresh, 'status') || 'unknown');
  if (!['started', 'already_running'].includes(status)) throw new Error(`DtxRefreshBars status inattendu: ${status}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    health = await callTool('systematic', 'GetHealth', { expected_close: expectedClose });
    state = healthState(health, expectedClose);
    if (state.ok) return { refreshed: true, state };
  }
  throw new Error(`DtxRefreshBars timeout: derniere cloture ${state.last_data_date || 'inconnue'}, prefetch.running=${state.prefetch_running}`);
}

if (require.main === module) {
  const index = process.argv.indexOf('--expected-close');
  const expectedClose = index >= 0 ? process.argv[index + 1] : null;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(expectedClose || ''))) {
    console.error('Usage: dtx-refresh-if-stale.js --expected-close YYYY-MM-DD'); process.exit(2);
  }
  refreshIfStale(expectedClose).then(result => {
    console.log(`DTX ${result.refreshed ? 'refreshed' : 'already fresh'} through ${result.state.last_data_date}`);
  }).catch(error => { console.error(`DTX refresh blocked: ${redactSecrets(error.message)}`); process.exit(1); });
}

module.exports = { healthState, refreshIfStale };
