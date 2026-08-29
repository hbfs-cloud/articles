'use strict';

function inspectPlanWindow(provenance = {}, executionPlan = {}) {
  provenance = provenance || {};
  executionPlan = executionPlan || {};
  const validFrom = Date.parse(provenance.validFrom || executionPlan.validFrom || '');
  const validUntil = Date.parse(provenance.validUntil || executionPlan.validUntil || '');
  const valid = provenance.contractVersion === '2.0'
    && Boolean(provenance.requestId && provenance.runId && provenance.callId && provenance.planId)
    && Number(provenance.planRevision) >= 1
    && Number.isFinite(validFrom)
    && Number.isFinite(validUntil)
    && validUntil > validFrom;
  return { valid, validFrom, validUntil };
}

function isPlanActive(provenance, executionPlan, nowMs = Date.now()) {
  const window = inspectPlanWindow(provenance, executionPlan);
  return window.valid && nowMs >= window.validFrom && nowMs <= window.validUntil;
}

module.exports = { inspectPlanWindow, isPlanActive };
