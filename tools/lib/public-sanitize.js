'use strict';

// Operational correlation identifiers are useful in retained private evidence,
// never in static public artifacts. Match exact normalized key names so fields
// such as instrumentId and portfolioId remain intact.
const PRIVATE_ID_KEYS = new Set([
  'traceid', 'traceids', 'requestid', 'runid', 'callid', 'planid',
  'intentid', 'jobid', 'correlationid', 'invocationid', 'executionid',
]);

function normalizedKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function sanitizePublicMetadata(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizePublicMetadata);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_ID_KEYS.has(normalizedKey(key))) continue;
    out[key] = sanitizePublicMetadata(item);
  }
  return out;
}

function publicStatusReason(config) {
  if (config && config.performanceScope === 'simulated_backtest') {
    return 'Simulation non broker : historique de performance non certifié retiré et métriques masquées.';
  }
  return config?.statusReason || null;
}

function sanitizePublicRegimeProbability(value) {
  if (!value || typeof value !== 'object') return value || null;
  const out = sanitizePublicMetadata(value);
  // Do not expose connector/tool topology as if it were a market label.
  out.source = 'marketdata_regime_context';
  return out;
}

module.exports = {
  PRIVATE_ID_KEYS,
  publicStatusReason,
  sanitizePublicMetadata,
  sanitizePublicRegimeProbability,
};
