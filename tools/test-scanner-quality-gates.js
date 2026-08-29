#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const parser = require('./lib/scanner-parser');
const { extractAllFromDir } = require('./update-tracking');
const dtxScan = require('./dtx-scan');
const { isPlanActive } = require('./lib/dtx-plan-window');

const ROOT = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const loaded = parser.loadSignals('20260831');
assert(loaded && loaded.signals.length >= 9, '20260831 signals must be parseable');
for (const signal of loaded.signals.filter(s => ['Momentum', 'Breakout', 'Pullback'].includes(s.strategy))) {
  assert(signal.selection_evidence, `${signal.ticker}: selection evidence lost by parser`);
  assert(signal.entry_low && signal.entry_high, `${signal.ticker}: entry zone lost by parser`);
  assert.strictEqual(signal.horizon, 10, `${signal.ticker}: published horizon lost by parser`);
}

const tracked = extractAllFromDir('20260831');
assert(tracked.length >= 9, 'tracking extractor must retain the editorial basket');
assert(tracked.every(t => t.horizon_days === 10), 'tracking must not replace H10 with H20');
assert(tracked.every(t => t.entry_low && t.entry_high), 'tracking must retain entry zones');

const positions = read('data/scanner-positions.json').open_positions || [];
const today = new Date().toISOString().slice(0, 10);
assert(!positions.some(p => p.scan_date > today), 'future scans must never become open positions');

const statusHtml = fs.readFileSync(path.join(ROOT, 'scanner/status/index.html'), 'utf8');
assert(!statusHtml.includes('scanDir=20260831'), 'future scans must never feed status orders');
const isWeekend = [0, 6].includes(new Date(`${today}T00:00:00Z`).getUTCDay());
if (isWeekend) {
  assert(statusHtml.includes('Portfolio · Market Closed'), 'weekend status must be labeled market closed');
  assert(!/>\s*\d+ Orders? to Place</.test(statusHtml), 'weekend status must not advertise actionable orders');
  const todayKey = today.replace(/-/g, '');
  const snapshot = read(`scanner/status/history/${todayKey}.json`);
  for (const [mode, payload] of Object.entries(snapshot.modes || {})) {
    assert.strictEqual((payload.orders || []).length, 0, `${mode}: weekend snapshot orders must be empty`);
  }
  for (const mode of ['best', 'turbo', 'dynamic', 'balanced', 'fortress']) {
    assert.strictEqual((read(`portfolio/v1/${mode}/orders.json`).orders || []).length, 0, `${mode}: weekend API orders must be empty`);
  }
}
const bestMethod = (statusHtml.split('<div id="p-best"')[1] || '').split('<!-- ══ 2bis.')[0];
assert(!/market order/i.test(bestMethod), 'DTX public method must never prescribe LIMIT-to-MARKET conversion');
assert(/rank 1 only/i.test(bestMethod) && /engine_managed/i.test(bestMethod), 'DTX public method must describe grouped execution and exact protection');

const sec = read('scanner/20260831/_data2/sec_selected_evidence.json');
assert.strictEqual(sec.pagination_exhausted, true, 'SEC pagination must be exhausted');
assert.strictEqual(sec.coverage.HTGC.equity_offering_hits.length, 0, 'HTGC debt must not be classified as equity');
assert(sec.coverage.HTGC.non_equity_offering_hits.every(h => h.classification === 'debt' && h.verified_from_primary_filing), 'HTGC 424B2 debt classification must cite primary filings');

const overlays = read('data/scanner-strategy-overlays.json');
const evidencePath = path.join(ROOT, overlays.evidence_source);
const hash = crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
assert.strictEqual(hash, overlays.evidence_sha256, 'strategy overlay evidence hash mismatch');
const retro = read(overlays.evidence_source);
const resolvedStatuses = new Set(['tp1', 'tp2', 'tp1_be', 'tp1_expired', 'stopped', 'expired']);
const momentumMature = retro.outcomes.filter(x => x.strategy === 'Momentum' && x.horizon_end <= overlays.evidence_cutoff && resolvedStatuses.has(x.status));
const summarize = rows => {
  const positive = rows.filter(x => x.r_multiple > 0).reduce((sum, x) => sum + x.r_multiple, 0);
  const negative = Math.abs(rows.filter(x => x.r_multiple < 0).reduce((sum, x) => sum + x.r_multiple, 0));
  return {
    resolved: rows.length,
    hit_rate_pct: +(rows.filter(x => x.r_multiple > 0).length / rows.length * 100).toFixed(1),
    profit_factor: +(positive / negative).toFixed(2),
    average_r: +(rows.reduce((sum, x) => sum + x.r_multiple, 0) / rows.length).toFixed(3),
  };
};
const policy = overlays.policies.find(p => p.strategy === 'Momentum');
const momentumHorizonComplete = retro.outcomes.filter(x => x.strategy === 'Momentum' && x.horizon_end <= overlays.evidence_cutoff);
assert.strictEqual(momentumHorizonComplete.length, policy.mature_evidence.horizon_complete_proposals, 'Momentum horizon-complete denominator drift');
assert.strictEqual(momentumHorizonComplete.filter(x => x.status === 'no_fill').length, policy.mature_evidence.no_fill, 'Momentum no-fill denominator drift');
assert.deepStrictEqual(summarize(momentumMature), {
  resolved: policy.mature_evidence.resolved,
  hit_rate_pct: policy.mature_evidence.hit_rate_pct,
  profit_factor: policy.mature_evidence.profit_factor,
  average_r: policy.mature_evidence.average_r,
}, 'Momentum mature evidence drift');
assert.deepStrictEqual(summarize(momentumMature.filter(x => ['US', 'ETF'].includes(x.region))), policy.us_listed_plus_etf_sensitivity, 'Momentum US-listed+ETF sensitivity drift');
assert.deepStrictEqual(summarize(momentumMature.filter(x => x.region === 'US')), policy.strict_us_sensitivity, 'Momentum strict-US sensitivity drift');

const dtxBest = read('data/dtx/best.json');
const decideEnvelope = read('scanner/20260831/_dtx/decide_best.json');
const decideV2 = decideEnvelope.result || decideEnvelope;
assert.deepStrictEqual(dtxScan.validateDecisionV2(decideV2, { asof: '2026-08-31' }), [], 'valid DTX Contract V2 decision rejected');
assert.strictEqual(dtxScan.rankOneOrdersFromV2(decideV2).length, decideV2.execution_plan.groups.length, 'one rank-1 order must be armed per V2 group');
const brokenDecision = structuredClone(decideV2);
delete brokenDecision.execution_plan.groups[0].candidates[0].protection;
assert(dtxScan.validateDecisionV2(brokenDecision, { asof: '2026-08-31' }).some(e => e.includes('protection missing')), 'missing V2 protection must fail closed');
assert.strictEqual(dtxBest.metricsSource, 'mcp_replay', 'incoherent served DTX snapshot must fall back to fresh replay');
assert(dtxBest.rejectedServedSnapshot, 'rejected DTX served snapshot must retain an audit record');
assert(
  Math.abs(dtxBest.rejectedServedSnapshot.curve_max_dd_pct - dtxBest.rejectedServedSnapshot.served_max_dd_pct) > 0.25,
  'served DTX snapshot may only be rejected when the curve/metric drawdown mismatch is material',
);
assert.strictEqual(dtxBest.decisionProvenance.contractVersion, '2.0', 'DTX best decision must retain Contract V2 provenance');
assert(dtxBest.decisionProvenance.planId && dtxBest.decisionProvenance.validFrom && dtxBest.decisionProvenance.validUntil, 'DTX best decision provenance incomplete');
const planFrom = Date.parse(dtxBest.decisionProvenance.validFrom);
const planUntil = Date.parse(dtxBest.decisionProvenance.validUntil);
assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planFrom - 1), false, 'DTX plan active before validFrom');
assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planFrom), true, 'DTX plan inactive at validFrom');
assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planUntil), true, 'DTX plan inactive at validUntil');
assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planUntil + 1), false, 'DTX plan active after validUntil');
assert.strictEqual(dtxBest.executionPlan.source, 'execution_plan.groups', 'DTX V2 ingestion must not consume actions.CREATE');
const dtxHistory = read('data/dtx-engine-history.json');
const historicalDecision = dtxHistory.modes.best['2026-08-31'];
assert.deepStrictEqual(historicalDecision.decisionProvenance, dtxBest.decisionProvenance, 'DTX V2 provenance must survive history persistence');
assert.strictEqual(historicalDecision.executionPlan.source, 'execution_plan.groups', 'DTX V2 source must survive history persistence');
const dtxValidDate = dtxBest.decisionProvenance.validFrom.slice(0, 10);
const rawScan = read('scanner/20260831/signals.json');
if (dtxValidDate !== rawScan.scanDate) {
  assert.strictEqual((rawScan.dtx_pool || []).filter(s => s.universe === 'best').length, 0, 'DTX plan must not leak into a different scanner session');
}
const stagedValues = dtxBest.equity.values;
const stagedReturn = (stagedValues[stagedValues.length - 1] / stagedValues[0] - 1) * 100;
assert(Math.abs(stagedReturn - dtxBest.metrics.return_pct) <= 0.05, 'DTX staging curve/headline mismatch');
const bestApi = read('portfolio/v1/best/equity.json');
const apiValues = bestApi.equityCurve.v;
const apiReturn = (apiValues[apiValues.length - 1] / apiValues[0] - 1) * 100;
assert(Math.abs(apiReturn - bestApi.stats.ret) <= 0.05, 'DTX API curve/headline mismatch');
assert.strictEqual(bestApi.engineBacktest.metrics_source, 'mcp_replay', 'DTX API replay provenance missing');
assert.strictEqual(bestApi.engineBacktest.curve_is_book, false, 'DTX replay must not be labeled as a served book curve');
const now = Date.now();
if (now < Date.parse(dtxBest.decisionProvenance.validFrom) || now > Date.parse(dtxBest.decisionProvenance.validUntil)) {
  const bestOrdersApi = read('portfolio/v1/best/orders.json');
  assert.strictEqual((bestOrdersApi.orders || []).length, 0, 'DTX API orders must be empty outside plan window');
  assert.deepStrictEqual(bestOrdersApi.decisionProvenance, dtxBest.decisionProvenance, 'DTX API must disclose the gated plan provenance even when it publishes zero orders');
}

const validation = spawnSync(process.execPath, ['tools/validate-scan.js', 'scanner/20260831/', '--skip-edgar'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.strictEqual(validation.status, 0, validation.stdout + validation.stderr);

console.log('scanner quality gates: PASS');
