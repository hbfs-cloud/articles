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
const { isUSTradingDay, newYorkDateISO } = require('./lib/market-calendar');
const { HISTORY_STATUS, REASON_CODE } = require('./lib/public-scanner-history');

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
const today = newYorkDateISO();
const todayKey = today.replace(/-/g, '');
assert(!positions.some(p => p.scan_date > today), 'future scans must never become open positions');

const statusHtml = fs.readFileSync(path.join(ROOT, 'scanner/status/index.html'), 'utf8');
assert(!statusHtml.includes('scanDir=20260831'), 'future scans must never feed status orders');
const isMarketClosedDay = !isUSTradingDay(today);
if (isMarketClosedDay) {
  assert(statusHtml.includes('Portefeuille · Marché fermé'), 'closed-session status must be labeled in the site language');
  assert(!/>\s*\d+ Orders? to Place</.test(statusHtml), 'closed-session status must not advertise actionable orders');
  const snapshot = read(`scanner/status/history/${todayKey}.json`);
  for (const [mode, payload] of Object.entries(snapshot.modes || {})) {
    assert.strictEqual((payload.orders || []).length, 0, `${mode}: closed-session snapshot orders must be empty`);
  }
  for (const mode of ['best', 'turbo', 'dynamic', 'balanced', 'fortress']) {
    assert.strictEqual((read(`portfolio/v1/${mode}/orders.json`).orders || []).length, 0, `${mode}: closed-session API orders must be empty`);
  }
}
const bestMethod = (statusHtml.split('<div id="p-best"')[1] || '').split('<!-- ══ 2bis.')[0];
assert(!/market order/i.test(bestMethod), 'DTX public method must never prescribe LIMIT-to-MARKET conversion');
assert(/uniquement le rang 1/i.test(bestMethod) && /protection affichée/i.test(bestMethod), 'DTX public method must describe grouped execution and exact protection in French');
assert(statusHtml.includes('Simulations éditoriales'), 'legacy strategy group must disclose its simulated scope');
for (const mode of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  const start = statusHtml.indexOf(`<div id="p-${mode}"`);
  const next = statusHtml.indexOf('<div id="p-', start + 10);
  const panel = statusHtml.slice(start, next < 0 ? statusHtml.length : next);
  assert(panel.includes('data-performance-scope="simulated_backtest"'), `${mode}: simulated scope missing from panel`);
  for (const row of (panel.match(/<tr data-sig-ticker=[\s\S]*?<\/tr>/g) || [])) {
    assert(!/>LIVE<\/span>/.test(row), `${mode}: simulated candidate must not carry a LIVE execution badge`);
    assert(/>SIGNAL<\/span>/.test(row), `${mode}: simulated candidate must be labeled SIGNAL`);
  }
}

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
const publicBestConfig = read('data/modes-config.json').modes.best;
const decideEnvelope = read('scanner/20260831/_dtx/decide_best.json');
const decideV2 = decideEnvelope.result || decideEnvelope;
assert.deepStrictEqual(dtxScan.validateDecisionV2(decideV2, { asof: '2026-08-31' }), [], 'valid DTX Contract V2 decision rejected');
assert.strictEqual(dtxScan.rankOneOrdersFromV2(decideV2).length, decideV2.execution_plan.groups.length, 'one rank-1 order must be armed per V2 group');
const brokenDecision = structuredClone(decideV2);
delete brokenDecision.execution_plan.groups[0].candidates[0].protection;
assert(dtxScan.validateDecisionV2(brokenDecision, { asof: '2026-08-31' }).some(e => e.includes('protection missing')), 'missing V2 protection must fail closed');
assert.strictEqual(dtxBest.metricsSource, 'mcp_replay', 'incoherent served DTX snapshot must fall back to fresh replay');
assert.strictEqual(dtxBest.portfolioId, publicBestConfig.dtxPortfolio, 'public best alias must retain the selected engine identity');
assert.strictEqual(dtxBest.configHash, publicBestConfig.dtxConfigHash, 'DTX staging must retain the exact configured engine hash');
assert.strictEqual(dtxBest.rejectedServedSnapshot, undefined, 'new engine identity must not inherit the previous Best book rejection');
assert.strictEqual(dtxBest.metrics.replay_scope, 'single_strategy', 'DTX Max must publish one exact strategy replay');
assert.strictEqual(dtxBest.decisionProvenance.contractVersion, '2.0', 'DTX best decision must retain Contract V2 provenance');
if (dtxBest.actionable === false) {
  assert.strictEqual(dtxBest.failureMode, 'fail_closed', 'non-actionable DTX staging must declare fail_closed');
  assert.strictEqual((dtxBest.orders || []).length, 0, 'fail-closed DTX staging must contain zero orders');
  assert.strictEqual(dtxBest.executionPlan, null, 'fail-closed DTX staging must not invent an execution plan');
  assert.strictEqual(dtxBest.invalidDecision?.code, 'IDEMPOTENCY_FINGERPRINT_CONFLICT', 'fail-closed DTX staging must retain the exact refusal class');
  assert.deepStrictEqual(dtxScan.stagingSnapshotErrors(dtxBest, publicBestConfig.dtxPortfolio, {
    publicModeId: 'best', expectedConfigHash: publicBestConfig.dtxConfigHash,
    todayIso: dtxBest.generatedAt.slice(0, 10), scanDateIso: dtxBest.asof,
    expectedClose: dtxBest.decisionProvenance.expectedDataDate,
  }), [], 'formal fail-closed DTX staging rejected');
  assert.strictEqual((read('portfolio/v1/best/orders.json').orders || []).length, 0, 'fail-closed DTX API orders must be empty');
} else {
  assert(dtxBest.decisionProvenance.planId && dtxBest.decisionProvenance.validFrom && dtxBest.decisionProvenance.validUntil, 'DTX best decision provenance incomplete');
  const planFrom = Date.parse(dtxBest.decisionProvenance.validFrom);
  const planUntil = Date.parse(dtxBest.decisionProvenance.validUntil);
  assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planFrom - 1), false, 'DTX plan active before validFrom');
  assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planFrom), true, 'DTX plan inactive at validFrom');
  assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planUntil), true, 'DTX plan inactive at validUntil');
  assert.strictEqual(isPlanActive(dtxBest.decisionProvenance, dtxBest.executionPlan, planUntil + 1), false, 'DTX plan active after validUntil');
  assert.strictEqual(dtxBest.executionPlan.source, 'execution_plan.groups', 'DTX V2 ingestion must not consume actions.CREATE');
  const dtxHistory = read('data/dtx-engine-history.json');
  const historicalDecision = dtxHistory.modes.best[dtxBest.asof];
  assert.strictEqual(historicalDecision.configHash, dtxBest.configHash, 'DTX config hash must survive history persistence');
  assert.deepStrictEqual(historicalDecision.decisionProvenance, dtxBest.decisionProvenance, 'DTX V2 provenance must survive history persistence');
  assert.strictEqual(historicalDecision.executionPlan.source, 'execution_plan.groups', 'DTX V2 source must survive history persistence');
  const dtxValidDate = dtxBest.decisionProvenance.validFrom.slice(0, 10);
  const rawScan = read('scanner/20260831/signals.json');
  if (dtxValidDate !== rawScan.scanDate) {
    assert.strictEqual((rawScan.dtx_pool || []).filter(s => s.universe === 'best').length, 0, 'DTX plan must not leak into a different scanner session');
  }
}
const stagedValues = dtxBest.equity.values;
const stagedReturn = (stagedValues[stagedValues.length - 1] / stagedValues[0] - 1) * 100;
assert(Math.abs(stagedReturn - dtxBest.metrics.return_pct) <= 0.05, 'DTX staging curve/headline mismatch');
const bestApi = read('portfolio/v1/best/equity.json');
assert.strictEqual(bestApi.engineConfigHash, publicBestConfig.dtxConfigHash, 'DTX API must disclose the exact configured engine hash');
assert.strictEqual(bestApi.stats.scope, 'forward_execution', 'DTX API top-level stats must describe forward execution only');
assert.strictEqual(bestApi.stats.status, 'not_started', 'DTX forward tracking must disclose its not-started state');
assert.strictEqual(bestApi.stats.ret, null, 'DTX forward return must remain null before a certified execution');
assert.deepStrictEqual(bestApi.equityCurve.v, [], 'DTX forward curve must remain empty before a certified execution');
const apiValues = bestApi.engineBacktest.equityCurve.v;
const apiReturn = (apiValues[apiValues.length - 1] / apiValues[0] - 1) * 100;
assert(Math.abs(apiReturn - bestApi.engineBacktest.return_pct) <= 0.05, 'DTX reference curve/headline mismatch');
assert.strictEqual(bestApi.engineBacktest.metrics_source, 'exact_reference_replay', 'DTX API replay provenance missing');
assert.strictEqual(bestApi.engineBacktest.curve_is_book, false, 'DTX replay must not be labeled as a served book curve');
const currentStatusSnapshot = read(`scanner/status/history/${todayKey}.json`);
const currentSnapshotBest = currentStatusSnapshot.modes.best;
assert.strictEqual(currentSnapshotBest.stats.scope, 'forward_execution', 'DTX Time Machine stats must be forward-only');
assert.strictEqual(currentSnapshotBest.stats.status, 'not_started', 'DTX Time Machine must disclose forward not_started');
for (const metric of ['ret', 'realized', 'unrealized', 'dd', 'wr', 'pf', 'avgHold', 'r2', 'cagr', 'sharpe']) {
  assert.strictEqual(currentSnapshotBest.stats[metric], null, `DTX Time Machine ${metric} must stay null before certified fills`);
}
assert.deepStrictEqual(currentSnapshotBest.equity.d, [], 'DTX Time Machine forward curve dates must be empty');
assert.deepStrictEqual(currentSnapshotBest.equity.v, [], 'DTX Time Machine forward curve values must be empty');
assert.deepStrictEqual(currentSnapshotBest.positions, [], 'DTX Time Machine positions must be certified-execution only');
assert.deepStrictEqual(currentSnapshotBest.closedTrades, [], 'DTX Time Machine closed trades must be certified-execution only');
assert.strictEqual(currentSnapshotBest.risk, null, 'DTX forward not_started must not inherit a pre-boundary VaR/stress snapshot');
for (const modeId of ['turbo', 'dynamic', 'balanced', 'fortress']) {
  const mode = currentStatusSnapshot.modes[modeId];
  assert.strictEqual(mode.stats?.capacityBoundary?.forwardCertified, true, `${modeId}: forward capacity boundary missing`);
  assert.strictEqual(mode.risk, null, `${modeId}: pre-boundary portfolio risk must not survive the zero-position genesis`);
}
assert.strictEqual(currentSnapshotBest.reference.scope, 'reference_backtest', 'DTX replay must be namespaced under reference');
assert(currentSnapshotBest.reference.equity.d.length > 0, 'DTX reference replay curve must remain available outside the forward hero');
assert.strictEqual(currentSnapshotBest.engine_decision.historyStatus, HISTORY_STATUS, 'pre-boundary DTX proposal must be retired_uncertified');
assert.strictEqual(currentSnapshotBest.engine_decision.reasonCode, REASON_CODE, 'pre-boundary DTX proposal must disclose the capacity reason');
assert.strictEqual(currentSnapshotBest.engine_decision.execution_verified, false, 'pre-boundary DTX proposal cannot be execution-verified');
assert.deepStrictEqual(currentSnapshotBest.engine_decision.plans, [], 'pre-boundary DTX proposal must expose zero public plans');
assert(!/SNDK/.test(JSON.stringify(currentSnapshotBest.engine_decision)), 'pre-boundary SNDK proposal leaked into current public snapshot');
const publicPlanHistory = read('scanner/status/engine-history.json');
const publicPlanSession = publicPlanHistory.modes.best['2026-09-01'];
assert.strictEqual(publicPlanSession.historyStatus, HISTORY_STATUS, 'public plan registry must retire the pre-boundary decision');
assert.deepStrictEqual(publicPlanSession.plans, [], 'public plan registry must expose zero pre-boundary plans');
assert(!/(?:"engineMode"|"orders"|"metrics"|\bmcp\b|SNDK)/i.test(JSON.stringify(publicPlanHistory)), 'public proposed-plan registry leaked engine/order/metric/pre-boundary details');
assert(statusHtml.includes('Plans proposés') && statusHtml.includes('NON EXÉCUTÉ'), 'public plan section must be explicit and non-executed');
assert(!statusHtml.includes('Décisions du moteur'), 'legacy engine-decision heading must not survive');
const bestOrdersApi = read('portfolio/v1/best/orders.json');
assert.strictEqual((bestOrdersApi.orders || []).length, 0, 'DTX API orders must be empty for a pre-boundary decision');
assert.deepStrictEqual(bestOrdersApi.plannedOrders, [], 'DTX API plannedOrders must be empty for a pre-boundary decision');
assert.strictEqual(bestOrdersApi.decisionProvenance, null, 'pre-boundary plan-window provenance must be quarantined');
assert.strictEqual(bestOrdersApi.planningCertification?.status, HISTORY_STATUS, 'DTX API must retire the pre-boundary proposal');
assert.strictEqual(bestOrdersApi.planningCertification?.reasonCode, 'decision_precedes_capacity_boundary', 'DTX API must disclose the exact planning cutoff reason');
assert.strictEqual(bestOrdersApi.planningCertification?.execution_verified, false, 'pre-boundary API plan cannot be execution-verified');

const validation = spawnSync(process.execPath, ['tools/validate-scan.js', 'scanner/20260831/', '--skip-edgar'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.strictEqual(validation.status, 0, validation.stdout + validation.stderr);

console.log('scanner quality gates: PASS');
