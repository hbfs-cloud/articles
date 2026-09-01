'use strict';

const fs = require('fs');
const path = require('path');

const HISTORY_STATUS = 'retired_uncertified';
const REASON_CODE = 'historical_capacity_at_entry_unrecoverable';
const TOMBSTONE_SCHEMA = 'scanner_history_tombstone_v1';
const PROPOSED_PLAN_STATUS = 'proposed_not_executed';
const DATE_KEY_RE = /^\d{8}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const METRIC_KEYS = Object.freeze([
  'ret', 'realized', 'unrealized', 'dd', 'wr', 'pf', 'pfLow', 'pfHigh',
  'pfReliable', 'trades', 'avgHold', 'oosWarn', 'r2', 'cagr', 'sharpe',
]);

function dateKeyFromIso(value) {
  if (!ISO_DATE_RE.test(String(value || ''))) {
    throw new Error(`invalid ISO boundary session: ${value || '(missing)'}`);
  }
  return String(value).replace(/-/g, '');
}

function isoFromDateKey(value) {
  if (!DATE_KEY_RE.test(String(value || ''))) {
    throw new Error(`invalid history date key: ${value || '(missing)'}`);
  }
  const key = String(value);
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function boundaryFromRegistry(registry) {
  const session = registry?.boundary?.session;
  const effectiveAt = registry?.boundary?.effectiveAt;
  const reasonCode = registry?.boundary?.preBoundary?.reasonCode;
  if (!ISO_DATE_RE.test(String(session || ''))) {
    throw new Error('capacity ledger boundary.session is missing or invalid');
  }
  if (typeof effectiveAt !== 'string' || !effectiveAt) {
    throw new Error('capacity ledger boundary.effectiveAt is missing');
  }
  if (reasonCode !== REASON_CODE) {
    throw new Error(`capacity ledger pre-boundary reason must be ${REASON_CODE}`);
  }
  return {
    session,
    dateKey: dateKeyFromIso(session),
    effectiveAt,
    historyStatus: HISTORY_STATUS,
    reasonCode: REASON_CODE,
  };
}

function copyIfPresent(target, source, key) {
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) return;
  const value = source[key];
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) target[key] = value;
}

function configIdentityFromMode(mode) {
  const identity = {};
  copyIfPresent(identity, mode, 'configVersion');
  copyIfPresent(identity, mode, 'configHash');

  const sourceConfig = mode && typeof mode.config === 'object' && !Array.isArray(mode.config)
    ? mode.config : null;
  if (sourceConfig) {
    const config = {};
    for (const key of ['configVersion', 'configHash', 'versionId', 'dtxPortfolio', 'dtxConfigHash']) {
      copyIfPresent(config, sourceConfig, key);
    }
    if (Object.keys(config).length) identity.config = config;
  }
  return identity;
}

function emptyStats() {
  const stats = {
    scope: 'unavailable',
    status: 'unavailable',
    historyStatus: HISTORY_STATUS,
    reasonCode: REASON_CODE,
    execution_verified: false,
    accountingCertified: false,
  };
  for (const key of METRIC_KEYS) stats[key] = null;
  return stats;
}

function emptyEquity() {
  return {
    d: [],
    v: [],
    scope: 'unavailable',
    status: 'unavailable',
    historyStatus: HISTORY_STATUS,
    reasonCode: REASON_CODE,
    execution_verified: false,
    accountingCertified: false,
  };
}

function buildModeTombstone(mode) {
  return {
    ...configIdentityFromMode(mode),
    historyStatus: HISTORY_STATUS,
    reasonCode: REASON_CODE,
    execution_verified: false,
    accountingCertified: false,
    performanceScope: 'unavailable',
    stats: emptyStats(),
    equity: emptyEquity(),
    pit_stats: null,
    pit_equity: emptyEquity(),
    signals: [],
    positions: [],
    orders: [],
    trades: [],
    closedTrades: [],
    closeNow: [],
    expiresTomorrow: [],
    reference: null,
    proposed_plans: null,
    engine_decision: null,
    recentRotation: null,
    risk: null,
  };
}

function buildSnapshotTombstone(snapshot, options) {
  const dateKey = String(options?.dateKey || '');
  const boundary = options?.boundary;
  if (!DATE_KEY_RE.test(dateKey)) throw new Error(`invalid history date key: ${dateKey || '(missing)'}`);
  if (!boundary || !DATE_KEY_RE.test(String(boundary.dateKey || ''))) {
    throw new Error('validated capacity boundary is required');
  }
  if (dateKey >= boundary.dateKey) {
    throw new Error(`${dateKey}: only snapshots before ${boundary.dateKey} may be quarantined`);
  }

  const topIdentity = {};
  copyIfPresent(topIdentity, snapshot, 'configVersion');
  copyIfPresent(topIdentity, snapshot, 'configHash');
  const modes = {};
  for (const modeId of Object.keys(snapshot?.modes || {}).sort()) {
    modes[modeId] = buildModeTombstone(snapshot.modes[modeId]);
  }

  return {
    schema: TOMBSTONE_SCHEMA,
    date: ISO_DATE_RE.test(String(snapshot?.date || '')) ? snapshot.date : isoFromDateKey(dateKey),
    scanDir: typeof snapshot?.scanDir === 'string' && snapshot.scanDir ? snapshot.scanDir : dateKey,
    ...topIdentity,
    historyStatus: HISTORY_STATUS,
    reasonCode: REASON_CODE,
    execution_verified: false,
    accountingCertified: false,
    capacityBoundary: {
      session: boundary.session,
      effectiveAt: boundary.effectiveAt,
      historyStatus: HISTORY_STATUS,
      historicalStatsPublishable: false,
      historicalCurvesPublishable: false,
      execution_verified: false,
    },
    modes,
  };
}

function historyDateKeys(historyDir) {
  return fs.readdirSync(historyDir)
    .filter(name => /^\d{8}\.json$/.test(name))
    .map(name => name.slice(0, 8))
    .sort();
}

function publishedHistoryDates(historyDir, boundary) {
  return historyDateKeys(historyDir).filter(dateKey => dateKey >= boundary.dateKey);
}

function quarantineHistoryDirectory(options) {
  const historyDir = path.resolve(options?.historyDir || '');
  const boundary = options?.boundary;
  if (!fs.existsSync(historyDir) || !fs.statSync(historyDir).isDirectory()) {
    throw new Error(`history directory not found: ${historyDir}`);
  }
  if (!boundary || !DATE_KEY_RE.test(String(boundary.dateKey || ''))) {
    throw new Error('validated capacity boundary is required');
  }

  let quarantined = 0;
  let changed = 0;
  for (const dateKey of historyDateKeys(historyDir)) {
    if (dateKey >= boundary.dateKey) continue;
    const filePath = path.join(historyDir, `${dateKey}.json`);
    const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const tombstone = buildSnapshotTombstone(snapshot, { dateKey, boundary });
    const serialized = JSON.stringify(tombstone);
    const previous = fs.readFileSync(filePath, 'utf8');
    quarantined++;
    if (previous !== serialized) {
      fs.writeFileSync(filePath, serialized);
      changed++;
    }
  }
  return {
    boundary: boundary.dateKey,
    quarantined,
    changed,
    publishedDates: publishedHistoryDates(historyDir, boundary),
  };
}

function proposedPlanFromOrder(order) {
  const side = String(order?.side || '').toUpperCase();
  const proposalType = String(order?.orderType || order?.type || '').toUpperCase();
  const finiteOrNull = value => value === null || value === undefined || value === ''
    ? null
    : (Number.isFinite(Number(value)) ? Number(value) : null);
  return {
    symbol: String(order?.symbol || ''),
    side: side === 'BUY' ? 'ACHAT' : side === 'SELL' ? 'VENTE' : (side || null),
    proposalType: proposalType || null,
    quantity: finiteOrNull(order?.qty),
    entryReference: finiteOrNull(order?.entry),
    limitPrice: finiteOrNull(order?.limitPrice),
    stopLoss: finiteOrNull(order?.stopLoss),
    takeProfit: finiteOrNull(order?.takeProfit),
    rationale: typeof order?.reason === 'string' ? order.reason.slice(0, 500) : '',
    status: PROPOSED_PLAN_STATUS,
    execution_verified: false,
    fill_verified: false,
  };
}

function decisionTimestamp(entry) {
  for (const value of [entry?.generatedAt, entry?.recordedAt, entry?.capturedAt, entry?.updatedAt]) {
    const timestamp = Date.parse(value || '');
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function isDecisionAtOrAfterBoundary(entry, boundary) {
  const timestamp = decisionTimestamp(entry);
  const cutoff = Date.parse(boundary?.effectiveAt || '');
  return timestamp !== null && Number.isFinite(cutoff) && timestamp >= cutoff;
}

function publicProposedPlanEntry(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const retiredUncertified = options.boundary
    ? !isDecisionAtOrAfterBoundary(entry, options.boundary)
    : false;
  if (retiredUncertified) {
    return {
      asof: entry.asof || null,
      portfolioId: entry.portfolioId || null,
      configHash: entry.configHash || null,
      stale: options.stale === true,
      status: HISTORY_STATUS,
      historyStatus: HISTORY_STATUS,
      reasonCode: REASON_CODE,
      execution_verified: false,
      fill_verified: false,
      plans: [],
      planUpdates: 0,
      planWithdrawals: 0,
      validity: null,
    };
  }
  const provenance = entry.decisionProvenance && typeof entry.decisionProvenance === 'object'
    ? entry.decisionProvenance : {};
  const plans = (entry.orders || []).map(proposedPlanFromOrder);
  const count = value => Array.isArray(value)
    ? value.length
    : (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0);
  return {
    asof: entry.asof || null,
    portfolioId: entry.portfolioId || null,
    configHash: entry.configHash || null,
    stale: options.stale === true,
    status: PROPOSED_PLAN_STATUS,
    execution_verified: false,
    fill_verified: false,
    plans,
    planUpdates: count(entry.updates),
    planWithdrawals: count(entry.cancels),
    validity: {
      contractVersion: provenance.contractVersion || null,
      requestedAsOf: provenance.requestedAsOf || null,
      expectedDataDate: provenance.expectedDataDate || null,
      dataAsOf: provenance.dataAsOf || null,
      planRevision: provenance.planRevision ?? null,
      validFrom: provenance.validFrom || null,
      validUntil: provenance.validUntil || null,
    },
  };
}

module.exports = {
  HISTORY_STATUS,
  METRIC_KEYS,
  PROPOSED_PLAN_STATUS,
  REASON_CODE,
  TOMBSTONE_SCHEMA,
  boundaryFromRegistry,
  buildModeTombstone,
  buildSnapshotTombstone,
  dateKeyFromIso,
  decisionTimestamp,
  historyDateKeys,
  isDecisionAtOrAfterBoundary,
  publicProposedPlanEntry,
  publishedHistoryDates,
  quarantineHistoryDirectory,
};
