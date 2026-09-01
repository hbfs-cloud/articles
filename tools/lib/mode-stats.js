'use strict';
// ─── tools/lib/mode-stats.js ─────────────────────────────────────────────────
// SHARED accounting lib — SOURCE UNIQUE de la comptabilité des modes.
//
// Extraction VERBATIM depuis tools/sweep.js (getWeight + computeStatsFromTrades)
// pour que sweep.js, gen-status-page.js et gen-api.js calculent EXACTEMENT les
// mêmes stats (frozen_*, backtest-results.json, hero/chart-scellé, API) à partir
// de la même formule — plus de divergence entre pit-state et sweep.
//
// La comptabilité est POINT-IN-TIME et NE DOIT PAS changer :
//   dailyEquity = 100 + Σ(pnlPct * getWeight) + unrealized
//   getWeight = (1/portfolioSize)*positionSizePct du configVersion stampé sur le
//   trade (via data/modes-config-history.json). Ex balanced +42% = 23 trades à
//   poids 1.0 (portfolioSize=1 fév-avr) + 48 à poids 0.333. C'EST CORRECT.
//
// Différence unique vs la version inline de sweep.js : le priceCache n'est plus
// une variable de module (closure) mais passé via `opts.priceCache`. sweep.js
// garde un wrapper mince qui injecte SON priceCache de module → sortie identique
// et le partage-par-référence avec pit-forward.js/extend-frozen.js préservé.

const fs = require('fs');
const path = require('path');
const invalidCohorts = require('./invalid-cohorts');

const ROOT = path.join(__dirname, '..', '..');

const RESOLVED_STATUSES = new Set([
  'tp1', 'tp1_partial', 'tp2', 'sl', 'expired', 'rotated', 'breakeven', 'trail',
]);

function baseTradeStatus(status) {
  return String(status || '').replace(/_amb$/, '');
}

function isResolvedTrade(trade) {
  return !!trade && RESOLVED_STATUSES.has(baseTradeStatus(trade.status));
}

function isPendingTrade(trade) {
  return !!trade && baseTradeStatus(trade.status) === 'pending';
}

/**
 * Build the only safe append plan for a frozen equity curve.
 *
 * `frozen.trades` is the accounting cursor. Dates alone are insufficient: a
 * position can close later on the same session as the current curve tail. In
 * that case the last point is provisional and must be replayed, while every
 * earlier point remains byte-identical. Open positions also replay the tail so
 * a new completed close can refresh their MtM without rewriting history.
 */
function planFrozenAdvance(frozen, trades) {
  if (!frozen || !Array.isArray(frozen.equityCurve) || frozen.equityCurve.length === 0) {
    throw new Error('frozen equityCurve is required');
  }
  if (!Number.isInteger(frozen.trades) || frozen.trades < 0) {
    throw new Error('frozen.trades must be a non-negative integer accounting cursor');
  }

  const rows = Array.isArray(trades) ? trades : [];
  const unknown = rows.filter(trade => {
    const status = baseTradeStatus(trade && trade.status);
    return status && status !== 'sim2_artifact' && !isPendingTrade(trade) && !isResolvedTrade(trade);
  });
  if (unknown.length) {
    throw new Error(`unclassified trade status(es): ${[...new Set(unknown.map(t => t.status))].join(', ')}`);
  }

  const resolved = rows.filter(isResolvedTrade).sort((a, b) =>
    String(a.exitDate || '').localeCompare(String(b.exitDate || ''))
      || String(a.scanDate || '').localeCompare(String(b.scanDate || ''))
      || String(a.ticker || '').localeCompare(String(b.ticker || ''))
  );
  const pending = rows.filter(isPendingTrade);
  if (resolved.length < frozen.trades) {
    throw new Error(`resolved trade count regressed (${resolved.length} < frozen cursor ${frozen.trades})`);
  }

  const lastFrozenISO = frozen.equityCurve[frozen.equityCurve.length - 1]?.date || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lastFrozenISO || ''))) {
    throw new Error('frozen equityCurve tail must carry an ISO date');
  }

  const missingClosed = resolved.slice(frozen.trades);
  if (missingClosed.some(trade => !/^\d{4}-\d{2}-\d{2}$/.test(String(trade.exitDate || '')))) {
    throw new Error('every resolved trade beyond the frozen cursor must carry an ISO exitDate');
  }
  const prefixViolation = missingClosed.find(trade => trade.exitDate < lastFrozenISO);
  if (prefixViolation) {
    throw new Error(`${prefixViolation.ticker || '?'} closes ${prefixViolation.exitDate} before frozen tail ${lastFrozenISO}; immutable prefix replay required`);
  }

  const replayTail = pending.length > 0
    || missingClosed.some(trade => trade.exitDate === lastFrozenISO);
  const priorEC = replayTail ? frozen.equityCurve.slice(0, -1) : frozen.equityCurve;
  return {
    lastFrozenISO,
    resolved,
    pending,
    missingClosed,
    priorEC,
    replayTail,
    shouldAdvance: missingClosed.length > 0 || pending.length > 0,
  };
}

/** Exact ledger totals used by QA to reconcile the raw rows with frozen stats. */
function summarizeLedgerAccounting(trades, modeId, cfgVersions, defaultWeight, options = {}) {
  const rows = Array.isArray(trades) ? trades : [];
  const inferredPortfolioSize = Number.isFinite(Number(defaultWeight)) && Number(defaultWeight) > 0
    ? Math.max(1, Math.round(1 / Number(defaultWeight))) : 1;
  const capacitySelection = selectCapacityAcceptedTrades(rows, modeId, cfgVersions || {}, {
    portfolioSize: options.portfolioSize || inferredPortfolioSize,
    positionSizePct: options.positionSizePct || 1,
  });
  const resolved = capacitySelection.accepted.filter(isResolvedTrade);
  const pending = capacitySelection.accepted.filter(isPendingTrade);
  const weighted = list => list.reduce((sum, trade) => {
    const versionCfg = trade.configVersion && cfgVersions && cfgVersions[trade.configVersion];
    if (trade.configVersion && (!versionCfg || !versionCfg[modeId])) {
      throw new Error(`${modeId}/${trade.ticker || '?'}: unknown configVersion ${trade.configVersion}`);
    }
    const weight = getWeight(trade, modeId, cfgVersions || {}, defaultWeight);
    if (!Number.isFinite(weight)) throw new Error(`${modeId}/${trade.ticker || '?'}: unresolved portfolio weight`);
    return sum + Number(trade.pnlPct || 0) * weight;
  }, 0);
  const realized = weighted(resolved);
  const unrealized = weighted(pending);
  return {
    resolved: resolved.length,
    pending: pending.length,
    realized: +realized.toFixed(2),
    unrealized: +unrealized.toFixed(2),
    total: +(realized + unrealized).toFixed(2),
    accountingPolicy: capacitySelection.policy,
    raw: capacitySelection.acceptedCount + capacitySelection.rejectedCount,
    rejectedCapacity: capacitySelection.rejectedCount,
    maxConcurrent: capacitySelection.maxConcurrent,
  };
}

// ─── Business-day helpers (copie verbatim depuis sweep.js) ───────────────────
function addBizDays(dateStr, n) {
  let d = new Date(dateStr + 'T12:00:00Z');
  const step = n >= 0 ? 1 : -1;
  let added = 0;
  while (added < Math.abs(n)) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function getAllBizDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function bizDaysBetween(dateA, dateB) {
  let d = new Date(dateA + 'T12:00:00Z');
  const end = new Date(dateB + 'T12:00:00Z');
  if (d >= end) return 0;
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

// ─── Calendar-day variants (24/7 markets: crypto, and forex-leaning) ─────────
// Same signatures as the biz-day helpers but counting EVERY calendar day (no
// weekend skip). Used only by modes that opt in via config.calendar='24/7'.
function addCalDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getAllCalDays(startDate, endDate) {
  const days = [];
  let d = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function calDaysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00Z');
  const b = new Date(dateB + 'T12:00:00Z');
  if (a >= b) return 0;
  return Math.round((b - a) / 86400000);
}

// Calendar selector. Equity modes (no `calendar` field) get the EXACT biz-day
// functions → byte-identical results (parity guaranteed by construction). Only
// modes with calendar='24/7' (crypto/forex) switch to calendar-day counting.
const BIZ_DAY_FNS = { addDays: addBizDays, allDays: getAllBizDays, daysBetween: bizDaysBetween };
const CAL_DAY_FNS = { addDays: addCalDays, allDays: getAllCalDays, daysBetween: calDaysBetween };
function dayFnsFor(calendar) {
  return calendar === '24/7' || calendar === 'cal' || calendar === 'calendar' ? CAL_DAY_FNS : BIZ_DAY_FNS;
}

// ─── Per-trade portfolio weight from config (copie verbatim) ─────────────────
// Module-level (exporté) so forward/replay tooling reuses the SAME weighting.
// Reads the trade's stamped configVersion → (1/portfolioSize)*positionSizePct
// for the mode. Falls back to `defaultWeight` when the version/mode is absent.
function getWeight(trade, modeId, cfgVersions, defaultWeight) {
  const ver = trade.configVersion;
  if (ver && cfgVersions[ver] && cfgVersions[ver][modeId]) {
    const c = cfgVersions[ver][modeId];
    return (1 / (c.portfolioSize || 1)) * (c.positionSizePct || 1);
  }
  return defaultWeight;
}

// A static config-version slot replay is a useful lower-bound diagnostic, but
// it is not the portfolio's historical capacity contract. Certified capacity
// also requires the point-in-time regime/risk/rotation state that could shrink
// or reallocate slots on each entry date. No caller may publish the static
// screen under the certified policy name.
const CAPACITY_ACCOUNTING_POLICY = 'capacity_pit_sealed_ledger_v1';
const STATIC_CAPACITY_SCREEN_POLICY = 'static_config_capacity_screen_v1';

function configAtDate(history, date, modeId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('configAtDate requires an ISO date');
  const candidates = (history && Array.isArray(history.versions) ? history.versions : [])
    .map((version, index) => ({
      version,
      index,
      effectiveFrom: String(version.effectiveFrom || version.timestamp || '').slice(0, 10),
    }))
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.effectiveFrom)
      && item.effectiveFrom <= date
      && item.version.config && item.version.config[modeId])
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)
      || String(a.version.timestamp || '').localeCompare(String(b.version.timestamp || ''))
      || a.index - b.index);
  if (!candidates.length) throw new Error(`${modeId}@${date}: no effective config-history snapshot`);
  const selected = candidates[candidates.length - 1];
  return {
    versionId: selected.version.id || null,
    configHash: selected.version.config_sha256 || selected.version.hash || null,
    effectiveFrom: selected.effectiveFrom,
    config: selected.version.config[modeId],
  };
}

function configHistoryCoverageErrors(history, current, modeIds = []) {
  const errors = [];
  const versions = history && Array.isArray(history.versions) ? history.versions : [];
  const currentVersion = String(current && current._version || '');
  const hasCurrentVersion = currentVersion && versions.some(version => {
    const id = String(version.id || '');
    return id === currentVersion || new RegExp(`^${currentVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{8}$`).test(id);
  });
  if (!hasCurrentVersion) {
    errors.push(`current config version ${currentVersion || '(missing)'} is absent from modes-config-history`);
  }
  const latest = [...versions].sort((a, b) => {
    const ad = String(a.effectiveFrom || a.timestamp || '');
    const bd = String(b.effectiveFrom || b.timestamp || '');
    return ad.localeCompare(bd) || String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
  }).at(-1) || null;
  const keys = [
    'portfolioSize', 'positionSizePct', 'topN', 'minScore', 'filterName', 'horizon',
    'partialTP', 'partialTPPct', 'partialTPGain', 'disableTP2', 'trailingStop',
    'trailMultR', 'trailGraceDays', 'maxStopPct', 'atrStopMult', 'dailyTrailPct',
    'breakevenPct', 'beGraceDays', 'staleDays', 'staleGraceDays', 'staleRaiseRate',
    'staleAccel', 'entryGatePct', 'vwapGate', 'rotation', 'regimeFilters',
    'regimeParams', 'ddBreakerPct', 'vixKillThreshold', 'circuitBreakerStops',
    'circuitBreakerWindow', 'circuitBreakerPause', 'sectorCapMax', 'correlationCap',
    'crossModeDedup', 'sizingMethod', 'targetRiskPct',
  ];
  for (const modeId of modeIds) {
    const archived = latest && latest.config && latest.config[modeId];
    const now = current && current.modes && current.modes[modeId];
    if (!archived || !now) { errors.push(`${modeId}: current/latest archived config missing`); continue; }
    const drift = keys.filter(key => JSON.stringify(archived[key] ?? null) !== JSON.stringify(now[key] ?? null));
    if (drift.length) errors.push(`${modeId}: unarchived config drift (${drift.join(', ')})`);
  }
  return errors;
}

function capacityConfigFor(trade, modeId, cfgVersions, defaults) {
  const version = trade && trade.configVersion;
  if (version && (!cfgVersions[version] || !cfgVersions[version][modeId])) {
    throw new Error(`${modeId}/${trade.ticker || '?'}: unknown configVersion ${version}`);
  }
  const cfg = version ? cfgVersions[version][modeId] : null;
  const portfolioSize = Number(cfg?.portfolioSize ?? defaults.portfolioSize);
  const positionSizePct = Number(cfg?.positionSizePct ?? defaults.positionSizePct);
  if (!Number.isInteger(portfolioSize) || portfolioSize <= 0) {
    throw new Error(`${modeId}/${trade.ticker || '?'}: invalid portfolioSize ${portfolioSize}`);
  }
  if (!Number.isFinite(positionSizePct) || positionSizePct <= 0 || positionSizePct > 1) {
    throw new Error(`${modeId}/${trade.ticker || '?'}: invalid positionSizePct ${positionSizePct}`);
  }
  return {
    portfolioSize,
    positionSizePct,
    weight: positionSizePct / portfolioSize,
  };
}

/**
 * Deterministically replay which flat-ledger rows could actually have entered.
 *
 * Historical append files contain independently simulated candidates. Counting
 * every later close realizes more than the configured capital whenever their
 * holding windows overlap. This selector admits a candidate only if both slot
 * count and weighted exposure were available at its entry. An exit on the same
 * date still occupies the slot (no timestamp evidence means fail closed).
 */
function selectCapacityAcceptedTrades(trades, modeId, cfgVersions = {}, defaults = {}) {
  const rows = Array.isArray(trades) ? trades : [];
  const normalizedDefaults = {
    portfolioSize: Number(defaults.portfolioSize || 1),
    positionSizePct: Number(defaults.positionSizePct || 1),
  };
  const candidates = rows.map((trade, sourceIndex) => ({ trade, sourceIndex }))
    .filter(({ trade }) => trade && (isResolvedTrade(trade) || isPendingTrade(trade)))
    .sort((a, b) => {
      const at = a.trade, bt = b.trade;
      const ae = String(at.entryDate || at.scanDate || '');
      const be = String(bt.entryDate || bt.scanDate || '');
      return ae.localeCompare(be)
        || String(at.scanDate || '').localeCompare(String(bt.scanDate || ''))
        || (Number(bt.score || 0) - Number(at.score || 0))
        || String(at.ticker || '').localeCompare(String(bt.ticker || ''))
        || String(at.exitDate || '').localeCompare(String(bt.exitDate || ''))
        || a.sourceIndex - b.sourceIndex;
    });

  const active = [];
  const acceptedIndexes = new Set();
  const rejected = [];
  let maxConcurrent = 0;
  let maxExposure = 0;
  for (const candidate of candidates) {
    const trade = candidate.trade;
    const entryDate = String(trade.entryDate || trade.scanDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      rejected.push({ trade, reason: 'missing_or_invalid_entry_date' });
      continue;
    }
    const endDate = isResolvedTrade(trade) ? String(trade.exitDate || '') : '9999-12-31';
    if (isResolvedTrade(trade) && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < entryDate)) {
      rejected.push({ trade, reason: 'missing_or_invalid_exit_date' });
      continue;
    }
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endDate < entryDate) active.splice(i, 1);
    }
    const capacity = capacityConfigFor(trade, modeId, cfgVersions, normalizedDefaults);
    const exposure = active.reduce((sum, item) => sum + item.weight, 0);
    const duplicateTicker = active.some(item => item.ticker === trade.ticker);
    if (duplicateTicker
      || active.length >= capacity.portfolioSize
      || exposure + capacity.weight > capacity.positionSizePct + 1e-9) {
      rejected.push({
        trade,
        reason: duplicateTicker ? 'ticker_already_active' : 'portfolio_capacity_exceeded',
        active: active.map(item => item.ticker),
      });
      continue;
    }
    active.push({
      ticker: trade.ticker,
      endDate,
      weight: capacity.weight,
      sourceIndex: candidate.sourceIndex,
    });
    acceptedIndexes.add(candidate.sourceIndex);
    maxConcurrent = Math.max(maxConcurrent, active.length);
    maxExposure = Math.max(maxExposure, active.reduce((sum, item) => sum + item.weight, 0));
  }

  return {
    policy: STATIC_CAPACITY_SCREEN_POLICY,
    certified: false,
    certificationError: 'point-in-time dynamic capacity evidence unavailable',
    accepted: rows.filter((_, index) => acceptedIndexes.has(index)),
    rejected,
    acceptedCount: acceptedIndexes.size,
    rejectedCount: rejected.length,
    maxConcurrent,
    maxExposure: +maxExposure.toFixed(6),
  };
}

const SHA256_ID = /^sha256:[0-9a-f]{64}$/;

/**
 * Validate a sealed capacity-at-entry ledger produced by the point-in-time
 * portfolio engine. This module intentionally does not reconstruct one from
 * flat trades: same-session ordering, regime downgrades, inverse-ATR weights,
 * rotations and risk gates cannot be recovered safely after the fact.
 */
function capacityCertificationErrors(frozen, options = {}) {
  const errors = [];
  if (!frozen || typeof frozen !== 'object') return ['frozen accounting artifact missing'];
  if (frozen.accountingPolicy !== CAPACITY_ACCOUNTING_POLICY) {
    errors.push(`accountingPolicy must be ${CAPACITY_ACCOUNTING_POLICY}`);
  }
  if (frozen.accountingCertified !== true) errors.push('accountingCertified must be true');
  const evidence = frozen.capacityEvidence;
  if (!evidence || typeof evidence !== 'object') return [...errors, 'capacityEvidence missing'];
  if (evidence.schema !== 'capacity_at_entry_v1') errors.push('capacityEvidence.schema mismatch');
  if (!SHA256_ID.test(String(evidence.sourceHash || ''))) errors.push('capacityEvidence.sourceHash invalid');
  if (!SHA256_ID.test(String(evidence.ledgerHash || ''))) errors.push('capacityEvidence.ledgerHash invalid');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(evidence.generatedAt || ''))) errors.push('capacityEvidence.generatedAt invalid');
  const records = Array.isArray(evidence.records) ? evidence.records : null;
  if (!records) return [...errors, 'capacityEvidence.records missing'];
  const timelineBindingRequested = options.configHistory !== undefined || options.modeId !== undefined;
  const canBindTimeline = options.configHistory
    && Array.isArray(options.configHistory.versions)
    && String(options.modeId || '').trim();
  if (timelineBindingRequested && !canBindTimeline) {
    errors.push('config-history binding context incomplete');
  }
  const requiredText = [
    'candidateId', 'entryDate', 'configVersion', 'configHash', 'configEffectiveDate',
    'rawRegime', 'effectiveRegime', 'regimeSource', 'rotationState', 'cooldownState',
    'sectorState', 'correlationState', 'dedupState', 'source',
  ];
  const requiredHashes = ['configHash', 'stateHash', 'sourceHash'];
  for (const [index, record] of records.entries()) {
    const tag = `capacityEvidence.records[${index}]`;
    if (!record || typeof record !== 'object') { errors.push(`${tag} invalid`); continue; }
    for (const key of requiredText) if (!String(record[key] || '').trim()) errors.push(`${tag}.${key} missing`);
    for (const key of requiredHashes) if (!SHA256_ID.test(String(record[key] || ''))) errors.push(`${tag}.${key} invalid`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.entryDate || ''))) errors.push(`${tag}.entryDate invalid`);
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(record.configEffectiveDate || ''))) errors.push(`${tag}.configEffectiveDate invalid`);
    const regimeScoreMissing = record.regimeScore === null || record.regimeScore === ''
      || record.regimeScore === undefined;
    if (regimeScoreMissing) {
      if (!String(record.regimeScoreNotApplicableReason || '').trim()) {
        errors.push(`${tag}.regimeScore missing without regimeScoreNotApplicableReason`);
      }
    } else if (!Number.isFinite(Number(record.regimeScore))) {
      errors.push(`${tag}.regimeScore invalid`);
    }
    if (typeof record.acceptedAtEntry !== 'boolean') errors.push(`${tag}.acceptedAtEntry missing`);
    if (!Number.isInteger(Number(record.capacityAtEntry)) || Number(record.capacityAtEntry) < 0) errors.push(`${tag}.capacityAtEntry invalid`);
    if (!Number.isFinite(Number(record.weightAtEntry)) || Number(record.weightAtEntry) <= 0 || Number(record.weightAtEntry) > 1) errors.push(`${tag}.weightAtEntry invalid`);
    if (!Number.isInteger(Number(record.entryOrder)) || Number(record.entryOrder) < 0) errors.push(`${tag}.entryOrder invalid`);
    if (record.acceptedAtEntry === true && Number(record.capacityAtEntry) === 0) {
      errors.push(`${tag}.acceptedAtEntry impossible at zero capacity`);
    }
    const risk = record.riskState;
    if (!risk || typeof risk !== 'object'
        || !['vixKill', 'drawdownBreaker', 'circuitBreaker']
          .every(key => typeof risk[key] === 'boolean')) {
      errors.push(`${tag}.riskState incomplete`);
    }
    if (canBindTimeline && /^\d{4}-\d{2}-\d{2}$/.test(String(record.entryDate || ''))) {
      try {
        const expected = configAtDate(options.configHistory, record.entryDate, options.modeId);
        if (record.configVersion !== expected.versionId) {
          errors.push(`${tag}.configVersion does not match configAtDate`);
        }
        if (record.configHash !== expected.configHash) {
          errors.push(`${tag}.configHash does not match configAtDate`);
        }
        if (String(record.configEffectiveDate || '').slice(0, 10) !== expected.effectiveFrom) {
          errors.push(`${tag}.configEffectiveDate does not match configAtDate`);
        }
        const nominalCapacity = Number(expected.config && expected.config.portfolioSize);
        if (!Number.isInteger(nominalCapacity) || nominalCapacity < 0) {
          errors.push(`${tag}.historical nominal capacity invalid`);
        } else if (Number.isInteger(Number(record.capacityAtEntry))
            && Number(record.capacityAtEntry) > nominalCapacity) {
          errors.push(`${tag}.capacityAtEntry exceeds historical nominal capacity`);
        }
      } catch (error) {
        errors.push(`${tag}.configAtDate unresolved: ${error.message}`);
      }
    }
  }
  const accepted = records.filter(record => record && record.acceptedAtEntry === true).length;
  if (Number(frozen.acceptedTradeRows) !== accepted) errors.push('acceptedTradeRows does not match sealed evidence');
  if (Number(frozen.rawTradeRows) !== records.length) errors.push('rawTradeRows does not match sealed evidence');
  return [...new Set(errors)];
}

// ─── Stats from a flat closed-trade list (append-only mode) ──────────────────
// Computes returnTotal, maxDD, winRate, profitFactor, equityCurve from a
// pre-existing list of trades (resolved + pending/open).
// Daily MtM equity curve: realized P&L from closed trades + unrealized from
// open positions at each business day's close (via priceCache).
// Trades must have: pnlPct, exitDate, scanDate, status, holdDays, actualEntry.
// Uses configVersion on each trade to look up the correct weight from config history.
//
// `opts.priceCache` : OHLCV cache { ticker: { 'YYYY-MM-DD': { close } } }. Passé
// par l'appelant (sweep.js injecte son cache de module ; gen-status-page/gen-api
// passent le leur). Absent → {} (getClose → null, unrealized 0 : « pas de data »).
// `opts.priorEC`    : courbe d'equity scellée (append-only) à préfixer.
//
// `opts.excludeInvalidCohorts` : retire du calcul les trades marqués par
// `data/invalid-cohorts.json` (registre déclaratif — voir lib/invalid-cohorts.js).
// DÉFAUT = false : la comptabilité point-in-time publiée reste byte-identique.
// Le MARQUAGE, lui, est toujours reporté dans le retour (`invalidCohortTrades`,
// `invalidCohorts`, `invalidCohortExcluded`) : les trades entrés via un filtre
// inopérant sont visibles partout, y compris quand on ne les exclut pas.
// Activation globale possible via `EXCLUDE_INVALID_COHORTS=1`.
function computeStatsFromTrades(closedTrades, portfolioSize, positionSizePct, modeId, calendar, opts = {}) {
  const DF = dayFnsFor(calendar);
  const priceCache = opts.priceCache || {};
  let allTrades = (closedTrades || []).filter(t => t.actualEntry > 0);

  // ─── Cohortes invalides : marquage systématique, exclusion sur demande ─────
  const excludeInvalid = invalidCohorts.isExclusionEnabled(opts);
  const cohortInfo = invalidCohorts.summarize(allTrades, modeId, excludeInvalid);
  if (excludeInvalid && cohortInfo.invalidCohortTrades > 0) {
    allTrades = invalidCohorts.partitionTrades(allTrades, modeId).valid;
  }

  if (allTrades.length === 0) return null;
  const defaultWeight = (1 / portfolioSize) * (positionSizePct || 1);

  // Load config history for per-trade weight lookup
  const cfgHistPath = path.join(ROOT, 'data', 'modes-config-history.json');
  let cfgVersions = opts.cfgVersions || {};
  if (!opts.cfgVersions && fs.existsSync(cfgHistPath)) {
    try {
      const hist = JSON.parse(fs.readFileSync(cfgHistPath, 'utf8'));
      for (const v of (hist.versions || [])) {
        cfgVersions[v.id] = v.config;
      }
    } catch(e) {}
  }

  // Capacity screening is opt-in. Most specialist simulations already come
  // from a portfolio engine and must not be silently reselected here. Legacy
  // flat ledgers can request this diagnostic, but it remains explicitly
  // uncertified until capacityAt(entryDate) has PIT regime/risk evidence.
  const capacitySelection = opts.capacityScreen === true
    ? selectCapacityAcceptedTrades(allTrades, modeId || '', cfgVersions, {
      portfolioSize,
      positionSizePct: positionSizePct || 1,
    })
    : {
      policy: null,
      certified: null,
      certificationError: null,
      accepted: allTrades,
      rejected: [],
      acceptedCount: allTrades.length,
      rejectedCount: 0,
      maxConcurrent: null,
      maxExposure: null,
    };
  allTrades = capacitySelection.accepted;
  if (allTrades.length === 0) return null;

  const resolved = allTrades.filter(isResolvedTrade);
  const pendingTrades = allTrades.filter(isPendingTrade)
    .sort((a, b) => {
      // Injected (real broker positions) always take priority over sim2 artifacts
      if (a._injected && !b._injected) return -1;
      if (!a._injected && b._injected) return 1;
      return (a.scanDate || '').localeCompare(b.scanDate || '');
    });

  if (resolved.length === 0 && pendingTrades.length === 0) return null;

  // ─── Daily MtM equity curve: realized + unrealized at each biz day close ───
  const allDates = [
    ...resolved.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
    ...pendingTrades.flatMap(t => [t.scanDate, t.entryDate, t.exitDate]),
  ].filter(Boolean).sort();
  const firstDate = allDates[0];
  // Use last available price date (not today) to avoid zero-unrealized tail
  // when Yahoo data hasn't arrived yet for the current day.
  const lastTradeDate = allDates[allDates.length - 1];
  let lastPriceDate = '';
  const allMtmTickers = [...new Set([...pendingTrades.map(t => t.ticker), ...resolved.map(t => t.ticker)])];
  for (const ticker of allMtmTickers) {
    const hist = priceCache[ticker];
    if (hist) {
      const dates = Object.keys(hist).sort();
      if (dates.length > 0 && dates[dates.length - 1] > lastPriceDate) {
        lastPriceDate = dates[dates.length - 1];
      }
    }
  }
  // Clamp to today — never extend the equity curve into future dates
  const todayClamp = new Date().toISOString().slice(0, 10);
  if (lastPriceDate > todayClamp) lastPriceDate = todayClamp;
  const endDate = lastPriceDate || lastTradeDate;

  const allDays = DF.allDays(firstDate, endDate);
  const sortedResolved = [...resolved].sort((a, b) => (a.exitDate || '').localeCompare(b.exitDate || ''));

  let realizedPnl = 0;
  let resolvedIdx = 0;
  let peak = 100, maxDD = 0;
  const equityCurve = [];
  const lastKnownClose = {};

  // Append-only: if prior equity curve provided, copy frozen points and fast-forward
  const priorEC = opts.priorEC || [];
  let appendAfter = '';
  if (priorEC.length > 0) {
    for (const pt of priorEC) {
      equityCurve.push(pt);
      if (pt.value > peak) peak = pt.value;
      const dd = ((peak - pt.value) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
    appendAfter = priorEC[priorEC.length - 1].date;
    // Fast-forward realized PnL and resolvedIdx to match the frozen point
    for (let i = 0; i < sortedResolved.length; i++) {
      if (sortedResolved[i].exitDate <= appendAfter) {
        realizedPnl += (sortedResolved[i].pnlPct || 0) * getWeight(sortedResolved[i], modeId || '', cfgVersions, defaultWeight);
        resolvedIdx = i + 1;
      }
    }
  }

  function getClose(ticker, day) {
    const hist = priceCache[ticker];
    if (hist && hist[day]) {
      lastKnownClose[ticker] = hist[day].close;
      return hist[day].close;
    }
    // Append-only replays deliberately skip the immutable prefix. That also
    // skips the ordinary day-by-day warm-up of `lastKnownClose`: before the US
    // open there is no bar for the new calendar day, so an open position would
    // otherwise lose yesterday's certified close and fall to zero MtM. Resolve
    // the latest known close at-or-before `day` on first access; never look
    // forward to a partial/future bar.
    if (hist && lastKnownClose[ticker] == null) {
      const prior = Object.keys(hist).filter(date => date <= day).sort().at(-1);
      if (prior && hist[prior] && Number.isFinite(Number(hist[prior].close))) {
        lastKnownClose[ticker] = Number(hist[prior].close);
      }
    }
    return lastKnownClose[ticker] || null;
  }

  for (const day of allDays) {
    if (appendAfter && day <= appendAfter) continue;
    // Accumulate realized from trades closing on or before this day
    while (resolvedIdx < sortedResolved.length && sortedResolved[resolvedIdx].exitDate <= day) {
      realizedPnl += (sortedResolved[resolvedIdx].pnlPct || 0) * getWeight(sortedResolved[resolvedIdx], modeId || '', cfgVersions, defaultWeight);
      resolvedIdx++;
    }

    // Unrealized: resolved trades not yet closed + pending trades
    let unrealizedPnl = 0;

    // Resolved trades entered but not yet exited as of this day
    // Cap at portfolioSize to prevent inflated equity when FROZEN_ONLY merges
    // overlapping old + new trades (e.g. 23 positions at 10% each = 230% exposure)
    let resolvedExposure = 0;
    const maxExposure = (1 / portfolioSize) * (positionSizePct || 1) * portfolioSize; // = positionSizePct (1.0)
    for (let i = resolvedIdx; i < sortedResolved.length; i++) {
      const t = sortedResolved[i];
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const w = getWeight(t, modeId || '', cfgVersions, defaultWeight);
        if (resolvedExposure + w > maxExposure + 1e-9) continue;
        const close = getClose(t.ticker, day);
        if (close) {
          resolvedExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    // Pending trades (still open) — cap total unrealized exposure at 1.0 (100% capital)
    let pendingExposure = 0;
    for (const t of pendingTrades) {
      const w = getWeight(t, modeId || '', cfgVersions, defaultWeight);
      if (pendingExposure + w > 1.0 + 1e-9) continue;
      const entryDay = t.entryDate || t.scanDate;
      if (entryDay && entryDay <= day && t.actualEntry > 0) {
        const close = getClose(t.ticker, day);
        if (close) {
          pendingExposure += w;
          unrealizedPnl += ((close - t.actualEntry) / t.actualEntry) * 100 * w;
        }
      }
    }

    const dailyEquity = 100 + realizedPnl + unrealizedPnl;
    equityCurve.push({ date: day, value: +dailyEquity.toFixed(2) });

    if (dailyEquity > peak) peak = dailyEquity;
    const dd = ((peak - dailyEquity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Keep ALL business days in equity curve — flat days are real (capital idle, no trade)

  const returnTotal = equityCurve.length > 0
    ? +(equityCurve[equityCurve.length - 1].value - 100).toFixed(2) : 0;
  const returnRealized = +realizedPnl.toFixed(2);
  const returnUnrealized = +(returnTotal - returnRealized).toFixed(2);

  // WR, PF — from resolved trades only (unrealized don't count)
  const wins = resolved.filter(t => (t.pnlPct || 0) > 0);
  const losses = resolved.filter(t => (t.pnlPct || 0) <= 0);
  const winRate = resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0;
  // PF must use the same point-in-time portfolio weights as realized P&L.
  // Raw per-trade percentages silently overstate eras with smaller allocations.
  const grossWin = wins.reduce((s, t) => s
    + Number(t.pnlPct || 0) * getWeight(t, modeId || '', cfgVersions, defaultWeight), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s
    + Number(t.pnlPct || 0) * getWeight(t, modeId || '', cfgVersions, defaultWeight), 0));
  const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0;

  // Risk-adjusted return metrics
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(2) : returnTotal > 0 ? 99 : 0;

  // True Sharpe ratio from daily MtM returns
  let sharpe = 0;
  if (equityCurve.length > 2) {
    const dailyReturns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].value;
      const curr = equityCurve[i].value;
      if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
      const stdev = Math.sqrt(variance);
      if (stdev > 0) sharpe = +(Math.sqrt(252) * mean / stdev).toFixed(2);
    }
  }

  const dayCount = allDays.length || 1;
  const annReturn = returnTotal * (252 / dayCount);
  const calmar = maxDD > 0 ? +(annReturn / maxDD).toFixed(2) : 0;

  return {
    returnTotal,
    returnRealized,
    returnUnrealized,
    maxDD: +(-maxDD).toFixed(2),
    winRate,
    profitFactor,
    trades: resolved.length,
    calmar,
    sharpe,
    returnDDRatio,
    equityCurve,
    accountingPolicy: capacitySelection.policy,
    accountingCertified: capacitySelection.certified,
    accountingCertificationError: capacitySelection.certificationError,
    rawTradeRows: capacitySelection.acceptedCount + capacitySelection.rejectedCount,
    acceptedTradeRows: capacitySelection.acceptedCount,
    rejectedCapacityRows: capacitySelection.rejectedCount,
    maxAcceptedConcurrent: capacitySelection.maxConcurrent,
    maxAcceptedExposure: capacitySelection.maxExposure,
    // Marquage cohortes invalides — informatif quand `invalidCohortExcluded`
    // est false (chiffres ci-dessus inchangés), effectif quand il est true.
    ...cohortInfo,
  };
}

module.exports = {
  CAPACITY_ACCOUNTING_POLICY,
  STATIC_CAPACITY_SCREEN_POLICY,
  capacityCertificationErrors,
  configAtDate,
  configHistoryCoverageErrors,
  getWeight,
  selectCapacityAcceptedTrades,
  computeStatsFromTrades,
  baseTradeStatus,
  isResolvedTrade,
  isPendingTrade,
  planFrozenAdvance,
  summarizeLedgerAccounting,
  dayFnsFor,
  BIZ_DAY_FNS,
  CAL_DAY_FNS,
};
