#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  publicStatusReason,
  sanitizePublicMetadata,
  sanitizePublicRegimeProbability,
} = require('./lib/public-sanitize');

const raw = {
  traceIds: ['trace-secret'],
  requestId: 'req-secret',
  nested: {
    intent_id: 'intent-secret',
    jobId: 'job-secret',
    run_id: 'run-secret',
    instrumentId: 'US0378331005',
    portfolioId: 'us_highvol_tp999_vwap',
    validFrom: '2026-09-01T13:30:00Z',
  },
  list: [{ callId: 'call-secret', symbol: 'SNDK' }],
};
assert.deepStrictEqual(sanitizePublicMetadata(raw), {
  nested: {
    instrumentId: 'US0378331005',
    portfolioId: 'us_highvol_tp999_vwap',
    validFrom: '2026-09-01T13:30:00Z',
  },
  list: [{ symbol: 'SNDK' }],
});
assert.deepStrictEqual(raw.traceIds, ['trace-secret'], 'sanitizer must not mutate retained private evidence');

const reason = publicStatusReason({
  performanceScope: 'simulated_backtest',
  statusReason: 'GO +18.35%, PF 2.09, DD -4.16%',
});
assert.strictEqual(reason, 'Simulation non broker : historique de performance non certifié retiré et métriques masquées.');
assert.doesNotMatch(reason, /18\.35|2\.09|4\.16|PF|DD/);
assert.strictEqual(publicStatusReason({ performanceScope: 'forward_execution', statusReason: 'owner approved' }), 'owner approved');

const regime = sanitizePublicRegimeProbability({
  source: 'mcp_connected:GetMarketContext(facets=regime)',
  currentState: 'risk_on',
  traceIds: ['trace-secret'],
});
assert.deepStrictEqual(regime, { source: 'marketdata_regime_context', currentState: 'risk_on' });
assert.doesNotMatch(JSON.stringify(regime), /mcp_connected|GetMarketContext|trace-secret/);

console.log('public sanitizer tests: PASS');
