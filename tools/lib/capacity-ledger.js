'use strict';

/**
 * Forward-only point-in-time capacity ledger.
 *
 * This module deliberately does not ingest data/backtest-trades.json. A reset
 * boundary can certify an empty forward state, but it can never certify the
 * historical flat ledger that preceded it.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { configAtDate } = require('./mode-stats');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_LEDGER_PATH = path.join(ROOT, 'data', 'capacity-ledger-v1.json');
const DEFAULT_CONFIG_HISTORY_PATH = path.join(ROOT, 'data', 'modes-config-history.json');
const MODE_IDS = Object.freeze(['turbo', 'dynamic', 'balanced', 'fortress']);
const REGISTRY_SCHEMA = 'capacity_at_entry_registry_v1';
const RECORD_SCHEMA = 'capacity_at_entry_record_v1';
const ACCOUNTING_POLICY = 'capacity_pit_sealed_ledger_v1';
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CELL_STATUSES = new Set(['completed', 'not_applicable', 'failed', 'unavailable']);

function assertPlainValue(value, at = '$') {
  if (value === undefined) throw new Error(`${at}: undefined is not canonical JSON`);
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${at}: non-finite number is not canonical JSON`);
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainValue(item, `${at}[${index}]`));
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${at}: only plain JSON objects are accepted`);
  }
  for (const [key, item] of Object.entries(value)) assertPlainValue(item, `${at}.${key}`);
}

function canonicalize(value) {
  assertPlainValue(value);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}

function canonicalJSONStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function hashValue(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJSONStringify(value)).digest('hex')}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withoutKey(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function previousCalendarDay(date) {
  if (!ISO_DATE_RE.test(String(date || ''))) throw new Error('boundary session must be an ISO date');
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function normalizeConfigAt(history, session, modeId) {
  const selected = configAtDate(history, session, modeId);
  if (!HASH_RE.test(String(selected.configHash || ''))) {
    throw new Error(`${modeId}@${session}: effective config has no sealed config hash`);
  }
  const portfolioSize = Number(selected.config && selected.config.portfolioSize);
  if (!Number.isInteger(portfolioSize) || portfolioSize <= 0) {
    throw new Error(`${modeId}@${session}: effective portfolioSize is invalid`);
  }
  return {
    versionId: selected.versionId,
    effectiveFrom: selected.effectiveFrom,
    configHash: selected.configHash,
    modeConfigHash: hashValue(selected.config),
    nominalSlots: portfolioSize,
    positionSizePct: Number(selected.config.positionSizePct ?? 1),
    sizingMethod: selected.config.sizingMethod || 'fixed',
    targetRiskPct: Number(selected.config.targetRiskPct || 0),
    performanceScope: selected.config.performanceScope || 'simulated_backtest',
    riskGatesRequired: Number(selected.config.vixKillThreshold || 0) > 0
      || Number(selected.config.ddBreakerPct || 0) > 0
      || Number(selected.config.circuitBreakerStops || 0) > 0,
    regimeGateRequired: !!(selected.config.regimeFilters
      && Object.keys(selected.config.regimeFilters).length),
  };
}

function stateFromPositions(configAt, positions = [], reservations = []) {
  const pos = clone(positions);
  const res = clone(reservations);
  const occupiedSlots = pos.length;
  const reservedSlots = res.length;
  const usedSlots = occupiedSlots + reservedSlots;
  const nominalSlots = Number(configAt.nominalSlots);
  const maxGrossWeight = Number(configAt.positionSizePct);
  const grossWeight = pos.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const reservedWeight = res.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  return {
    nominalSlots,
    occupiedSlots,
    reservedSlots,
    availableSlots: Math.max(0, nominalSlots - usedSlots),
    overCapacitySlots: Math.max(0, usedSlots - nominalSlots),
    maxGrossWeight,
    grossWeight: +grossWeight.toFixed(12),
    reservedWeight: +reservedWeight.toFixed(12),
    cashWeight: +Math.max(0, 1 - grossWeight - reservedWeight).toFixed(12),
    deployableWeightRemaining: +Math.max(0, maxGrossWeight - grossWeight - reservedWeight).toFixed(12),
    positions: pos,
    reservations: res,
  };
}

function sealRecord(record) {
  const unsigned = withoutKey(record, 'recordHash');
  return { ...unsigned, recordHash: hashValue(unsigned) };
}

function sealRegistry(registry) {
  const unsigned = withoutKey(registry, 'registryHash');
  return { ...unsigned, registryHash: hashValue(unsigned) };
}

function buildGenesisRegistry(options = {}) {
  const history = options.configHistory;
  if (!history || !Array.isArray(history.versions)) throw new Error('config history is required');
  const boundarySession = options.boundarySession || '2026-09-01';
  const createdAt = options.createdAt || new Date().toISOString();
  const effectiveAt = options.effectiveAt || createdAt;
  if (!ISO_DATE_RE.test(boundarySession)) throw new Error('boundary session must be an ISO date');
  if (!ISO_TS_RE.test(createdAt) || !ISO_TS_RE.test(effectiveAt)) {
    throw new Error('createdAt/effectiveAt must be canonical UTC timestamps');
  }
  if (createdAt !== effectiveAt) throw new Error('effectiveAt must equal the ledger creation timestamp');
  if (effectiveAt.slice(0, 10) !== boundarySession) {
    throw new Error('effective boundary timestamp must fall within boundarySession in UTC');
  }

  const modes = {};
  const selectedVersionHashes = {};
  for (const modeId of MODE_IDS) {
    const configAt = normalizeConfigAt(history, boundarySession, modeId);
    const selectedVersion = history.versions.find(version => version.id === configAt.versionId);
    if (!selectedVersion) throw new Error(`${modeId}: config-history version ${configAt.versionId} missing`);
    selectedVersionHashes[configAt.versionId] = hashValue(selectedVersion);
    const stateAfter = stateFromPositions(configAt);
    const sourceHash = hashValue({
      kind: 'owner_certified_forward_reset',
      boundarySession,
      effectiveAt,
      modeId,
      configAt,
    });
    const genesis = sealRecord({
      schema: RECORD_SCHEMA,
      type: 'genesis',
      sequence: 0,
      modeId,
      session: boundarySession,
      recordedAt: createdAt,
      previousRecordHash: null,
      previousStateHash: null,
      terminalState: 'completed',
      decisionReason: 'owner_certified_forward_reset',
      configAt,
      capacityAt: {
        nominalSlots: configAt.nominalSlots,
        occupiedSlots: 0,
        reservedSlots: 0,
        availableSlots: configAt.nominalSlots,
        grossWeight: 0,
        reservedWeight: 0,
        cashWeight: 1,
        maxGrossWeight: configAt.positionSizePct,
        deployableWeightRemaining: configAt.positionSizePct,
        requestedWeight: 0,
      },
      riskState: {
        status: 'not_applicable',
        notApplicableReason: 'reset genesis has no candidate and inherits no uncertified position',
      },
      regimeState: {
        status: 'not_applicable',
        notApplicableReason: 'reset genesis has no candidate',
      },
      orderState: {
        status: 'not_applicable',
        notApplicableReason: 'reset genesis has no candidate order',
      },
      sizingState: {
        status: 'not_applicable',
        notApplicableReason: 'reset genesis has no candidate sizing decision',
      },
      sourceEvidence: {
        status: 'completed',
        sourceKind: 'owner_certified_forward_reset',
        sourceRef: 'capacity-ledger-v1/boundary/2026-09-01',
        sourceHash,
      },
      entryEvidence: {
        status: 'not_applicable',
        notApplicableReason: 'reset genesis establishes no entry',
      },
      stateBeforeHash: null,
      stateAfter,
      stateAfterHash: hashValue(stateAfter),
    });
    modes[modeId] = {
      modeId,
      performanceScope: 'simulated_backtest',
      historyStatus: 'retired_uncertified',
      forwardStatus: 'certified_append_only',
      boundarySession,
      configAtBoundary: configAt,
      counters: { candidates: 0, accepted: 0, rejected: 0, exits: 0 },
      records: [genesis],
      headHash: genesis.recordHash,
    };
  }

  return sealRegistry({
    schema: REGISTRY_SCHEMA,
    ledgerSchema: 'capacity_at_entry_v1',
    accountingPolicy: ACCOUNTING_POLICY,
    createdAt,
    boundary: {
      session: boundarySession,
      effectiveAt,
      timezone: 'America/New_York',
      status: 'certified_forward_only',
      preBoundary: {
        endsAtExclusive: effectiveAt,
        lastUncertifiedSession: boundarySession,
        includesBoundarySessionBeforeEffectiveAt: true,
        status: 'retired_uncertified',
        metricsPolicy: 'masked',
        curvesPolicy: 'masked',
        tradesPolicy: 'masked',
        carryInPolicy: 'discarded_uncertified_state',
        reasonCode: 'historical_capacity_at_entry_unrecoverable',
      },
    },
    contract: {
      appendOnly: true,
      hashAlgorithm: 'sha256',
      canonicalization: 'sorted_object_keys_json_v1',
      candidateTerminalStates: ['accepted', 'rejected'],
      sameSessionExitPolicy: 'occupies_until_certified_exit_event',
      dataCompletionPolicy: 'completed_only',
      absencePolicy: 'fail_closed_never_zero',
      performancePolicy: 'capacity_ledger_alone_never_certifies_returns',
    },
    sourceBindings: {
      configHistoryPath: 'data/modes-config-history.json',
      selectedVersionHashes,
    },
    modes,
  });
}

function pushError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function validateCell(cell, tag, errors, options = {}) {
  if (!cell || typeof cell !== 'object') {
    errors.push(`${tag} missing`);
    return;
  }
  if (!CELL_STATUSES.has(cell.status)) {
    errors.push(`${tag}.status invalid`);
    return;
  }
  if (cell.status === 'completed') {
    if (!HASH_RE.test(String(cell.sourceHash || ''))) errors.push(`${tag}.sourceHash invalid`);
  } else if (cell.status === 'not_applicable') {
    if (!String(cell.notApplicableReason || '').trim()) errors.push(`${tag}.notApplicableReason missing`);
  } else if (!String(cell.rejectionReason || cell.error || '').trim()) {
    errors.push(`${tag}.rejectionReason/error missing`);
  }
  if (options.mustSucceed && (cell.status === 'failed' || cell.status === 'unavailable')) {
    errors.push(`${tag} cannot ${cell.status} for an accepted candidate`);
  }
  if (options.requireCompleted && cell.status !== 'completed') {
    errors.push(`${tag} must be completed`);
  }
}

function validateState(state, configAt, tag, errors) {
  if (!state || typeof state !== 'object') {
    errors.push(`${tag} missing`);
    return;
  }
  const positions = Array.isArray(state.positions) ? state.positions : null;
  const reservations = Array.isArray(state.reservations) ? state.reservations : null;
  if (!positions) errors.push(`${tag}.positions missing`);
  if (!reservations) errors.push(`${tag}.reservations missing`);
  if (!positions || !reservations) return;
  const expected = stateFromPositions(configAt, positions, reservations);
  for (const key of [
    'nominalSlots', 'occupiedSlots', 'reservedSlots', 'availableSlots',
    'overCapacitySlots', 'maxGrossWeight', 'grossWeight', 'reservedWeight',
    'cashWeight', 'deployableWeightRemaining',
  ]) {
    if (Number(state[key]) !== Number(expected[key])) errors.push(`${tag}.${key} inconsistent`);
  }
  const ids = new Set();
  const instruments = new Set();
  for (const [index, position] of positions.entries()) {
    const ptag = `${tag}.positions[${index}]`;
    if (!String(position.positionId || '').trim()) errors.push(`${ptag}.positionId missing`);
    if (!String(position.symbol || '').trim()) errors.push(`${ptag}.symbol missing`);
    if (!String(position.instrumentId || '').trim()) errors.push(`${ptag}.instrumentId missing`);
    if (!Number.isFinite(Number(position.weight)) || Number(position.weight) <= 0 || Number(position.weight) > 1) {
      errors.push(`${ptag}.weight invalid`);
    }
    if (ids.has(position.positionId)) errors.push(`${ptag}.positionId duplicate`);
    if (instruments.has(position.instrumentId)) errors.push(`${ptag}.instrumentId duplicate`);
    ids.add(position.positionId);
    instruments.add(position.instrumentId);
  }
  if (Number(state.grossWeight) + Number(state.reservedWeight) > 1 + 1e-9) {
    errors.push(`${tag}: leverage is forbidden`);
  }
}

function capacitySnapshot(state, requestedWeight) {
  return {
    nominalSlots: state.nominalSlots,
    occupiedSlots: state.occupiedSlots,
    reservedSlots: state.reservedSlots,
    availableSlots: state.availableSlots,
    grossWeight: state.grossWeight,
    reservedWeight: state.reservedWeight,
    cashWeight: state.cashWeight,
    maxGrossWeight: state.maxGrossWeight,
    deployableWeightRemaining: state.deployableWeightRemaining,
    requestedWeight: +Number(requestedWeight || 0).toFixed(12),
  };
}

function compareCanonical(actual, expected, tag, errors) {
  try {
    if (canonicalJSONStringify(actual) !== canonicalJSONStringify(expected)) errors.push(`${tag} inconsistent`);
  } catch (error) {
    errors.push(`${tag} invalid: ${error.message}`);
  }
}

function validateRegistry(registry, options = {}) {
  const errors = [];
  const history = options.configHistory;
  if (!registry || typeof registry !== 'object') return ['capacity ledger registry missing'];
  pushError(errors, registry.schema === REGISTRY_SCHEMA, `schema must be ${REGISTRY_SCHEMA}`);
  pushError(errors, registry.ledgerSchema === 'capacity_at_entry_v1', 'ledgerSchema mismatch');
  pushError(errors, registry.accountingPolicy === ACCOUNTING_POLICY, 'accountingPolicy mismatch');
  pushError(errors, ISO_TS_RE.test(String(registry.createdAt || '')), 'createdAt invalid');
  pushError(errors, HASH_RE.test(String(registry.registryHash || '')), 'registryHash invalid');
  try {
    if (registry.registryHash !== hashValue(withoutKey(registry, 'registryHash'))) errors.push('registryHash mismatch');
  } catch (error) {
    errors.push(`registry payload is not canonical JSON: ${error.message}`);
  }

  const boundary = registry.boundary || {};
  pushError(errors, ISO_DATE_RE.test(String(boundary.session || '')), 'boundary.session invalid');
  pushError(errors, ISO_TS_RE.test(String(boundary.effectiveAt || '')), 'boundary.effectiveAt invalid');
  pushError(errors, registry.createdAt === boundary.effectiveAt, 'boundary.effectiveAt must equal registry.createdAt');
  pushError(errors, boundary.timezone === 'America/New_York', 'boundary.timezone mismatch');
  pushError(errors, boundary.status === 'certified_forward_only', 'boundary.status mismatch');
  const pre = boundary.preBoundary || {};
  pushError(errors, pre.endsAtExclusive === boundary.effectiveAt, 'preBoundary.endsAtExclusive must equal boundary.effectiveAt');
  pushError(errors, pre.lastUncertifiedSession === boundary.session, 'preBoundary.lastUncertifiedSession mismatch');
  pushError(errors, pre.includesBoundarySessionBeforeEffectiveAt === true, 'preBoundary must include same-session evidence before effectiveAt');
  pushError(errors, pre.status === 'retired_uncertified', 'preBoundary.status must be retired_uncertified');
  for (const key of ['metricsPolicy', 'curvesPolicy', 'tradesPolicy']) {
    pushError(errors, pre[key] === 'masked', `preBoundary.${key} must be masked`);
  }
  pushError(errors, pre.carryInPolicy === 'discarded_uncertified_state', 'preBoundary carry-in must be discarded');
  pushError(errors, registry.contract?.appendOnly === true, 'contract.appendOnly must be true');
  pushError(errors, registry.contract?.dataCompletionPolicy === 'completed_only', 'contract.dataCompletionPolicy mismatch');
  pushError(errors, registry.contract?.absencePolicy === 'fail_closed_never_zero', 'contract.absencePolicy mismatch');
  pushError(errors, registry.contract?.performancePolicy === 'capacity_ledger_alone_never_certifies_returns', 'contract.performancePolicy mismatch');

  if (!history || !Array.isArray(history.versions)) errors.push('config-history validation context missing');
  if (history && Array.isArray(history.versions)) {
    const expectedVersionHashes = {};
    for (const modeId of MODE_IDS) {
      try {
        const configAt = normalizeConfigAt(history, boundary.session, modeId);
        const version = history.versions.find(item => item.id === configAt.versionId);
        if (version) expectedVersionHashes[version.id] = hashValue(version);
      } catch (_) { /* reported by the per-mode binding below */ }
    }
    compareCanonical(
      registry.sourceBindings?.selectedVersionHashes,
      expectedVersionHashes,
      'sourceBindings.selectedVersionHashes',
      errors,
    );
    pushError(errors, registry.sourceBindings?.configHistoryPath === 'data/modes-config-history.json',
      'sourceBindings.configHistoryPath mismatch');
  }
  const actualModeIds = Object.keys(registry.modes || {}).sort();
  compareCanonical(actualModeIds, [...MODE_IDS].sort(), 'registry mode set', errors);

  for (const modeId of MODE_IDS) {
    const mode = registry.modes && registry.modes[modeId];
    const tag = `modes.${modeId}`;
    if (!mode || typeof mode !== 'object') { errors.push(`${tag} missing`); continue; }
    pushError(errors, mode.modeId === modeId, `${tag}.modeId mismatch`);
    pushError(errors, mode.performanceScope === 'simulated_backtest', `${tag}.performanceScope mismatch`);
    pushError(errors, mode.historyStatus === 'retired_uncertified', `${tag}.historyStatus mismatch`);
    pushError(errors, mode.forwardStatus === 'certified_append_only', `${tag}.forwardStatus mismatch`);
    pushError(errors, mode.boundarySession === boundary.session, `${tag}.boundarySession mismatch`);
    const records = Array.isArray(mode.records) ? mode.records : [];
    if (!records.length) { errors.push(`${tag}.records missing genesis`); continue; }
    const candidateIds = new Set();
    const sessionOrder = new Set();
    let previousHash = null;
    let previousState = null;
    let priorSession = '';
    const counters = { candidates: 0, accepted: 0, rejected: 0, exits: 0 };

    for (const [index, record] of records.entries()) {
      const rtag = `${tag}.records[${index}]`;
      if (!record || typeof record !== 'object') { errors.push(`${rtag} invalid`); continue; }
      pushError(errors, record.schema === RECORD_SCHEMA, `${rtag}.schema mismatch`);
      pushError(errors, record.modeId === modeId, `${rtag}.modeId mismatch`);
      pushError(errors, Number(record.sequence) === index, `${rtag}.sequence must be contiguous`);
      pushError(errors, ISO_DATE_RE.test(String(record.session || '')), `${rtag}.session invalid`);
      pushError(errors, record.session >= boundary.session, `${rtag}.session precedes certified boundary`);
      pushError(errors, record.session >= priorSession, `${rtag}.session regressed`);
      pushError(errors, ISO_TS_RE.test(String(record.recordedAt || '')), `${rtag}.recordedAt invalid`);
      pushError(errors, record.previousRecordHash === previousHash, `${rtag}.previousRecordHash mismatch`);
      pushError(errors, HASH_RE.test(String(record.recordHash || '')), `${rtag}.recordHash invalid`);
      try {
        if (record.recordHash !== hashValue(withoutKey(record, 'recordHash'))) errors.push(`${rtag}.recordHash mismatch`);
      } catch (error) {
        errors.push(`${rtag} is not canonical JSON: ${error.message}`);
      }

      let configAt = record.configAt;
      if (history && ISO_DATE_RE.test(String(record.session || ''))) {
        try {
          const expectedConfig = normalizeConfigAt(history, record.session, modeId);
          compareCanonical(configAt, expectedConfig, `${rtag}.configAt`, errors);
          configAt = expectedConfig;
        } catch (error) {
          errors.push(`${rtag}.configAt unresolved: ${error.message}`);
        }
      }
      if (!configAt || !Number.isInteger(Number(configAt.nominalSlots))) {
        errors.push(`${rtag}.configAt invalid`);
        previousHash = record.recordHash;
        priorSession = record.session || priorSession;
        continue;
      }

      if (index === 0) {
        pushError(errors, record.type === 'genesis', `${rtag} must be genesis`);
        pushError(errors, record.session === boundary.session, `${rtag}.session must equal boundary`);
        pushError(errors, record.recordedAt === boundary.effectiveAt, `${rtag}.recordedAt must equal effective boundary`);
        pushError(errors, record.previousStateHash === null && record.stateBeforeHash === null, `${rtag} genesis must not inherit state`);
        pushError(errors, record.terminalState === 'completed', `${rtag}.terminalState mismatch`);
        pushError(errors, record.decisionReason === 'owner_certified_forward_reset', `${rtag}.decisionReason mismatch`);
        validateCell(record.sourceEvidence, `${rtag}.sourceEvidence`, errors, { requireCompleted: true });
        validateCell(record.riskState, `${rtag}.riskState`, errors);
        validateCell(record.regimeState, `${rtag}.regimeState`, errors);
        validateCell(record.orderState, `${rtag}.orderState`, errors);
        validateCell(record.sizingState, `${rtag}.sizingState`, errors);
        validateCell(record.entryEvidence, `${rtag}.entryEvidence`, errors);
        const expectedState = stateFromPositions(configAt);
        compareCanonical(record.stateAfter, expectedState, `${rtag}.stateAfter`, errors);
        compareCanonical(record.capacityAt, capacitySnapshot(expectedState, 0), `${rtag}.capacityAt`, errors);
        pushError(errors, record.stateAfterHash === hashValue(record.stateAfter), `${rtag}.stateAfterHash mismatch`);
        previousState = record.stateAfter;
      } else if (record.type === 'candidate_decision') {
        counters.candidates++;
        const accepted = record.terminalState === 'accepted';
        const rejected = record.terminalState === 'rejected';
        pushError(errors, accepted || rejected, `${rtag}.terminalState must be exactly accepted or rejected`);
        if (accepted) counters.accepted++;
        if (rejected) counters.rejected++;
        pushError(errors, String(record.candidateId || '').trim(), `${rtag}.candidateId missing`);
        pushError(errors, !candidateIds.has(record.candidateId), `${rtag}.candidateId duplicate`);
        candidateIds.add(record.candidateId);
        pushError(errors, String(record.symbol || '').trim(), `${rtag}.symbol missing`);
        pushError(errors, String(record.instrumentId || '').trim(), `${rtag}.instrumentId missing`);
        pushError(errors, ISO_TS_RE.test(String(record.decisionTimestamp || '')), `${rtag}.decisionTimestamp invalid`);
        pushError(errors, record.decisionTimestamp >= boundary.effectiveAt, `${rtag}.decisionTimestamp precedes effective boundary`);
        pushError(errors, record.recordedAt >= record.decisionTimestamp, `${rtag}.recordedAt precedes decisionTimestamp`);
        if (rejected) pushError(errors, String(record.rejectionReason || '').trim(), `${rtag}.rejectionReason missing`);
        if (accepted) pushError(errors, record.rejectionReason == null, `${rtag}.rejectionReason must be null when accepted`);

        const before = stateFromPositions(configAt, previousState?.positions || [], previousState?.reservations || []);
        pushError(errors, record.previousStateHash === hashValue(previousState), `${rtag}.previousStateHash mismatch`);
        pushError(errors, record.stateBeforeHash === hashValue(before), `${rtag}.stateBeforeHash mismatch`);
        const requestedWeight = Number(record.capacityAt && record.capacityAt.requestedWeight);
        compareCanonical(record.capacityAt, capacitySnapshot(before, requestedWeight), `${rtag}.capacityAt`, errors);
        validateCell(record.sourceEvidence, `${rtag}.sourceEvidence`, errors, { requireCompleted: true });
        validateCell(record.riskState, `${rtag}.riskState`, errors, {
          mustSucceed: accepted,
          requireCompleted: accepted && configAt.riskGatesRequired,
        });
        validateCell(record.regimeState, `${rtag}.regimeState`, errors, {
          mustSucceed: accepted,
          requireCompleted: accepted && configAt.regimeGateRequired,
        });
        validateCell(record.orderState, `${rtag}.orderState`, errors, { requireCompleted: true });
        validateCell(record.sizingState, `${rtag}.sizingState`, errors, { requireCompleted: accepted });
        validateCell(record.entryEvidence, `${rtag}.entryEvidence`, errors, { requireCompleted: accepted });
        pushError(errors, Number.isInteger(Number(record.orderState?.rank)) && Number(record.orderState.rank) >= 0, `${rtag}.orderState.rank invalid`);
        pushError(errors, Number.isInteger(Number(record.orderState?.sequenceInSession)) && Number(record.orderState.sequenceInSession) >= 0,
          `${rtag}.orderState.sequenceInSession invalid`);
        pushError(errors, String(record.orderState?.deterministicKey || '').trim(), `${rtag}.orderState.deterministicKey missing`);
        const orderKey = `${record.session}:${record.orderState?.sequenceInSession}`;
        pushError(errors, !sessionOrder.has(orderKey), `${rtag}.orderState.sequenceInSession duplicate`);
        sessionOrder.add(orderKey);
        if (accepted) {
          pushError(errors, before.availableSlots > 0, `${rtag}: accepted with no available slot`);
          pushError(errors, Number.isFinite(requestedWeight) && requestedWeight > 0
            && requestedWeight <= before.cashWeight + 1e-9
            && requestedWeight <= before.deployableWeightRemaining + 1e-9,
          `${rtag}: accepted weight exceeds available cash or configured exposure`);
          pushError(errors, record.sizingState?.method === configAt.sizingMethod,
            `${rtag}.sizingState.method does not match configAt`);
          pushError(errors, Number(record.sizingState?.weight) === requestedWeight,
            `${rtag}.sizingState.weight does not match requestedWeight`);
          if (record.riskState?.status === 'completed') {
            for (const key of ['vixKill', 'drawdownBreaker', 'circuitBreaker']) {
              pushError(errors, typeof record.riskState[key] === 'boolean', `${rtag}.riskState.${key} missing`);
              pushError(errors, record.riskState[key] !== true, `${rtag}: accepted while ${key} triggered`);
            }
          }
          if (record.regimeState?.status === 'completed') {
            pushError(errors, String(record.regimeState.rawRegime || '').trim(), `${rtag}.regimeState.rawRegime missing`);
            pushError(errors, String(record.regimeState.effectiveRegime || '').trim(), `${rtag}.regimeState.effectiveRegime missing`);
            const missingScore = record.regimeState.regimeScore == null;
            if (missingScore) pushError(errors, String(record.regimeState.regimeScoreNotApplicableReason || '').trim(), `${rtag}.regimeState score N/A reason missing`);
          }
          pushError(errors, record.entryEvidence?.entryTimestamp >= boundary.effectiveAt,
            `${rtag}.entryEvidence.entryTimestamp precedes effective boundary`);
          pushError(errors, record.entryEvidence?.entryTimestamp >= record.decisionTimestamp,
            `${rtag}.entryEvidence.entryTimestamp precedes decisionTimestamp`);
          pushError(errors, record.entryEvidence?.completionPolicy === 'completed_only',
            `${rtag}.entryEvidence.completionPolicy must be completed_only`);
        }

        let expectedPositions = clone(before.positions);
        if (accepted) {
          const position = {
            positionId: record.positionId,
            candidateId: record.candidateId,
            symbol: record.symbol,
            instrumentId: record.instrumentId,
            entrySession: record.session,
            entryTimestamp: record.entryEvidence?.entryTimestamp,
            entryPrice: record.entryEvidence?.entryPrice,
            weight: requestedWeight,
            sourceHash: record.entryEvidence?.sourceHash,
          };
          pushError(errors, String(position.positionId || '').trim(), `${rtag}.positionId missing`);
          pushError(errors, !expectedPositions.some(item => item.instrumentId === position.instrumentId), `${rtag}: instrument already active`);
          expectedPositions.push(position);
        }
        const expectedAfter = stateFromPositions(configAt, expectedPositions, before.reservations);
        compareCanonical(record.stateAfter, expectedAfter, `${rtag}.stateAfter`, errors);
        pushError(errors, record.stateAfterHash === hashValue(record.stateAfter), `${rtag}.stateAfterHash mismatch`);
        previousState = record.stateAfter;
      } else if (record.type === 'position_exit') {
        counters.exits++;
        pushError(errors, record.terminalState === 'completed', `${rtag}.terminalState must be completed`);
        validateCell(record.exitEvidence, `${rtag}.exitEvidence`, errors, { requireCompleted: true });
        pushError(errors, ISO_TS_RE.test(String(record.exitEvidence?.exitTimestamp || '')), `${rtag}.exitEvidence.exitTimestamp invalid`);
        pushError(errors, record.exitEvidence?.exitTimestamp >= boundary.effectiveAt,
          `${rtag}.exitEvidence.exitTimestamp precedes effective boundary`);
        pushError(errors, record.recordedAt >= record.exitEvidence?.exitTimestamp,
          `${rtag}.recordedAt precedes exitTimestamp`);
        const before = stateFromPositions(configAt, previousState?.positions || [], previousState?.reservations || []);
        pushError(errors, record.previousStateHash === hashValue(previousState), `${rtag}.previousStateHash mismatch`);
        pushError(errors, record.stateBeforeHash === hashValue(before), `${rtag}.stateBeforeHash mismatch`);
        const indexOfPosition = before.positions.findIndex(item => item.positionId === record.positionId);
        pushError(errors, indexOfPosition >= 0, `${rtag}.positionId is not active`);
        const expectedPositions = before.positions.filter(item => item.positionId !== record.positionId);
        const expectedAfter = stateFromPositions(configAt, expectedPositions, before.reservations);
        compareCanonical(record.capacityAt, capacitySnapshot(before, 0), `${rtag}.capacityAt`, errors);
        compareCanonical(record.stateAfter, expectedAfter, `${rtag}.stateAfter`, errors);
        pushError(errors, record.stateAfterHash === hashValue(record.stateAfter), `${rtag}.stateAfterHash mismatch`);
        previousState = record.stateAfter;
      } else {
        errors.push(`${rtag}.type invalid`);
      }

      previousHash = record.recordHash;
      priorSession = record.session || priorSession;
    }

    pushError(errors, mode.headHash === previousHash, `${tag}.headHash mismatch`);
    compareCanonical(mode.counters, counters, `${tag}.counters`, errors);
    if (history && ISO_DATE_RE.test(String(boundary.session || ''))) {
      try {
        compareCanonical(mode.configAtBoundary, normalizeConfigAt(history, boundary.session, modeId), `${tag}.configAtBoundary`, errors);
      } catch (error) {
        errors.push(`${tag}.configAtBoundary unresolved: ${error.message}`);
      }
    }
  }
  return [...new Set(errors)];
}

function assertValidRegistry(registry, options = {}) {
  const errors = validateRegistry(registry, options);
  if (errors.length) throw new Error(errors.join(' | '));
  return registry;
}

function normalizeCompletedCell(cell, label) {
  if (!cell || cell.status !== 'completed' || !HASH_RE.test(String(cell.sourceHash || ''))) {
    throw new Error(`${label} must be completed with a SHA-256 source hash`);
  }
  return clone(cell);
}

function appendCandidateDecision(registry, input, options = {}) {
  const history = options.configHistory;
  assertValidRegistry(registry, { configHistory: history });
  const out = clone(registry);
  const modeId = String(input?.modeId || '');
  const mode = out.modes[modeId];
  if (!mode) throw new Error(`unsupported mode ${modeId || '(missing)'}`);
  const session = String(input.session || '');
  if (!ISO_DATE_RE.test(session) || session < out.boundary.session) throw new Error('candidate session precedes or violates certified boundary');
  if (mode.records.some(record => record.candidateId === input.candidateId)) throw new Error(`duplicate candidateId ${input.candidateId}`);
  const terminalState = input.terminalState;
  if (!['accepted', 'rejected'].includes(terminalState)) throw new Error('terminalState must be exactly accepted or rejected');
  if (terminalState === 'rejected' && !String(input.rejectionReason || '').trim()) throw new Error('rejected candidate requires rejectionReason');
  if (terminalState === 'accepted' && input.rejectionReason != null) throw new Error('accepted candidate cannot carry rejectionReason');
  const recordedAt = input.recordedAt;
  if (!ISO_TS_RE.test(String(recordedAt || ''))) throw new Error('recordedAt must be a canonical UTC timestamp');
  const decisionTimestamp = input.decisionTimestamp;
  if (!ISO_TS_RE.test(String(decisionTimestamp || ''))) throw new Error('decisionTimestamp must be a canonical UTC timestamp');
  if (decisionTimestamp < out.boundary.effectiveAt) throw new Error('candidate decision precedes certified effective boundary');
  if (recordedAt < decisionTimestamp) throw new Error('recordedAt cannot precede decisionTimestamp');
  const configAt = normalizeConfigAt(history, session, modeId);
  const head = mode.records.at(-1);
  const before = stateFromPositions(configAt, head.stateAfter.positions, head.stateAfter.reservations);
  const requestedWeight = Number(input.requestedWeight || 0);
  const accepted = terminalState === 'accepted';
  normalizeCompletedCell(input.sourceEvidence, 'sourceEvidence');
  normalizeCompletedCell(input.orderState, 'orderState');
  if (accepted) {
    normalizeCompletedCell(input.riskState, 'riskState');
    normalizeCompletedCell(input.regimeState, 'regimeState');
    normalizeCompletedCell(input.entryEvidence, 'entryEvidence');
    normalizeCompletedCell(input.sizingState, 'sizingState');
    if (before.availableSlots <= 0) throw new Error('accepted candidate has no available slot');
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0
        || requestedWeight > before.cashWeight + 1e-9
        || requestedWeight > before.deployableWeightRemaining + 1e-9) {
      throw new Error('accepted candidate weight exceeds available cash or configured exposure');
    }
    if (['vixKill', 'drawdownBreaker', 'circuitBreaker'].some(key => input.riskState[key] !== false)) {
      throw new Error('accepted candidate requires completed, clear risk gates');
    }
    if (!String(input.regimeState.rawRegime || '').trim() || !String(input.regimeState.effectiveRegime || '').trim()) {
      throw new Error('accepted candidate requires raw and effective regime evidence');
    }
    if (!String(input.positionId || '').trim()) throw new Error('accepted candidate requires positionId');
    if (input.sizingState.method !== configAt.sizingMethod || Number(input.sizingState.weight) !== requestedWeight) {
      throw new Error('sizingState must bind requestedWeight to the effective sizing method');
    }
    if (!Number.isFinite(Number(input.entryEvidence.entryPrice)) || Number(input.entryEvidence.entryPrice) <= 0
        || !ISO_TS_RE.test(String(input.entryEvidence.entryTimestamp || ''))) {
      throw new Error('accepted candidate requires certified entry price/timestamp');
    }
    if (input.entryEvidence.completionPolicy !== 'completed_only') {
      throw new Error('accepted candidate requires completionPolicy=completed_only');
    }
  }
  if (!String(input.candidateId || '').trim() || !String(input.symbol || '').trim() || !String(input.instrumentId || '').trim()) {
    throw new Error('candidateId, symbol and instrumentId are required');
  }
  if (!Number.isInteger(Number(input.orderState.rank)) || Number(input.orderState.rank) < 0
      || !Number.isInteger(Number(input.orderState.sequenceInSession)) || Number(input.orderState.sequenceInSession) < 0
      || !String(input.orderState.deterministicKey || '').trim()) {
    throw new Error('orderState requires rank, sequenceInSession and deterministicKey');
  }
  if (mode.records.some(record => record.type === 'candidate_decision'
      && record.session === session
      && Number(record.orderState?.sequenceInSession) === Number(input.orderState.sequenceInSession))) {
    throw new Error('duplicate candidate sequenceInSession');
  }

  const positions = clone(before.positions);
  if (accepted) {
    if (positions.some(position => position.instrumentId === input.instrumentId)) throw new Error('instrument already active');
    positions.push({
      positionId: input.positionId,
      candidateId: input.candidateId,
      symbol: input.symbol,
      instrumentId: input.instrumentId,
      entrySession: session,
      entryTimestamp: input.entryEvidence.entryTimestamp,
      entryPrice: Number(input.entryEvidence.entryPrice),
      weight: +requestedWeight.toFixed(12),
      sourceHash: input.entryEvidence.sourceHash,
    });
  }
  const after = stateFromPositions(configAt, positions, before.reservations);
  const record = sealRecord({
    schema: RECORD_SCHEMA,
    type: 'candidate_decision',
    sequence: mode.records.length,
    modeId,
    session,
    recordedAt,
    decisionTimestamp,
    previousRecordHash: head.recordHash,
    previousStateHash: hashValue(head.stateAfter),
    candidateId: input.candidateId,
    positionId: accepted ? input.positionId : null,
    symbol: input.symbol,
    instrumentId: input.instrumentId,
    terminalState,
    rejectionReason: accepted ? null : input.rejectionReason,
    decisionReason: accepted ? (input.decisionReason || 'all_gates_passed') : input.rejectionReason,
    configAt,
    capacityAt: capacitySnapshot(before, requestedWeight),
    riskState: clone(input.riskState),
    regimeState: clone(input.regimeState),
    orderState: clone(input.orderState),
    sizingState: clone(input.sizingState),
    sourceEvidence: clone(input.sourceEvidence),
    entryEvidence: clone(input.entryEvidence),
    stateBeforeHash: hashValue(before),
    stateAfter: after,
    stateAfterHash: hashValue(after),
  });
  mode.records.push(record);
  mode.headHash = record.recordHash;
  mode.counters.candidates++;
  mode.counters[terminalState]++;
  const sealed = sealRegistry(withoutKey(out, 'registryHash'));
  return assertValidRegistry(sealed, { configHistory: history });
}

function appendPositionExit(registry, input, options = {}) {
  const history = options.configHistory;
  assertValidRegistry(registry, { configHistory: history });
  const out = clone(registry);
  const modeId = String(input?.modeId || '');
  const mode = out.modes[modeId];
  if (!mode) throw new Error(`unsupported mode ${modeId || '(missing)'}`);
  const session = String(input.session || '');
  if (!ISO_DATE_RE.test(session) || session < out.boundary.session) throw new Error('exit session precedes or violates certified boundary');
  if (!ISO_TS_RE.test(String(input.recordedAt || ''))) throw new Error('recordedAt must be a canonical UTC timestamp');
  normalizeCompletedCell(input.exitEvidence, 'exitEvidence');
  const configAt = normalizeConfigAt(history, session, modeId);
  const head = mode.records.at(-1);
  const before = stateFromPositions(configAt, head.stateAfter.positions, head.stateAfter.reservations);
  const position = before.positions.find(item => item.positionId === input.positionId);
  if (!position) throw new Error(`active position ${input.positionId || '(missing)'} not found`);
    if (!ISO_TS_RE.test(String(input.exitEvidence.exitTimestamp || ''))
      || !Number.isFinite(Number(input.exitEvidence.exitPrice)) || Number(input.exitEvidence.exitPrice) <= 0) {
    throw new Error('exitEvidence requires certified exit price/timestamp');
  }
  if (input.exitEvidence.exitTimestamp < out.boundary.effectiveAt) {
    throw new Error('position exit precedes certified effective boundary');
  }
  if (input.recordedAt < input.exitEvidence.exitTimestamp) {
    throw new Error('recordedAt cannot precede exitTimestamp');
  }
  const after = stateFromPositions(
    configAt,
    before.positions.filter(item => item.positionId !== input.positionId),
    before.reservations,
  );
  const record = sealRecord({
    schema: RECORD_SCHEMA,
    type: 'position_exit',
    sequence: mode.records.length,
    modeId,
    session,
    recordedAt: input.recordedAt,
    previousRecordHash: head.recordHash,
    previousStateHash: hashValue(head.stateAfter),
    positionId: input.positionId,
    symbol: position.symbol,
    instrumentId: position.instrumentId,
    terminalState: 'completed',
    decisionReason: input.decisionReason || 'certified_position_exit',
    configAt,
    capacityAt: capacitySnapshot(before, 0),
    exitEvidence: clone(input.exitEvidence),
    stateBeforeHash: hashValue(before),
    stateAfter: after,
    stateAfterHash: hashValue(after),
  });
  mode.records.push(record);
  mode.headHash = record.recordHash;
  mode.counters.exits++;
  const sealed = sealRegistry(withoutKey(out, 'registryHash'));
  return assertValidRegistry(sealed, { configHistory: history });
}

function assertAppendOnly(previous, next) {
  for (const modeId of MODE_IDS) {
    const oldRecords = previous?.modes?.[modeId]?.records || [];
    const newRecords = next?.modes?.[modeId]?.records || [];
    if (newRecords.length < oldRecords.length) throw new Error(`${modeId}: ledger record count regressed`);
    for (let index = 0; index < oldRecords.length; index++) {
      if (canonicalJSONStringify(oldRecords[index]) !== canonicalJSONStringify(newRecords[index])) {
        throw new Error(`${modeId}: append-only prefix changed at record ${index}`);
      }
    }
  }
  return true;
}

function modeBoundaryStatus(registry, modeId, options = {}) {
  const errors = validateRegistry(registry, options);
  const mode = registry?.modes?.[modeId];
  const forwardCertified = errors.length === 0
    && mode?.forwardStatus === 'certified_append_only'
    && mode?.historyStatus === 'retired_uncertified';
  return {
    modeId,
    forwardCertified,
    boundarySession: forwardCertified ? registry.boundary.session : null,
    effectiveAt: forwardCertified ? registry.boundary.effectiveAt : null,
    historyThroughExclusive: forwardCertified ? registry.boundary.preBoundary.endsAtExclusive : null,
    historyStatus: forwardCertified ? 'retired_uncertified' : 'unavailable',
    historicalStatsPublishable: false,
    historicalCurvesPublishable: false,
    forwardPerformancePublishable: false,
    trackingStatus: forwardCertified
      ? (mode.counters.accepted === 0 && mode.counters.exits === 0 ? 'not_started' : 'tracking')
      : 'unavailable',
    errors,
  };
}

function loadRegistry(filePath = DEFAULT_LEDGER_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadConfigHistory(filePath = DEFAULT_CONFIG_HISTORY_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeRegistryAtomic(filePath, registry, options = {}) {
  assertValidRegistry(registry, options);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(tmp, filePath);
}

module.exports = {
  ACCOUNTING_POLICY,
  DEFAULT_CONFIG_HISTORY_PATH,
  DEFAULT_LEDGER_PATH,
  MODE_IDS,
  RECORD_SCHEMA,
  REGISTRY_SCHEMA,
  appendCandidateDecision,
  appendPositionExit,
  assertAppendOnly,
  assertValidRegistry,
  buildGenesisRegistry,
  canonicalJSONStringify,
  hashValue,
  loadConfigHistory,
  loadRegistry,
  modeBoundaryStatus,
  normalizeConfigAt,
  sealRecord,
  sealRegistry,
  validateRegistry,
  writeRegistryAtomic,
};
