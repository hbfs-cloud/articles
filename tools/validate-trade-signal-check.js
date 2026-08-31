#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'substack', 'series', 'trade-signal-check');
const clf = JSON.parse(fs.readFileSync(path.join(DIR, 'evidence', 'clf-case.json'), 'utf8'));
const tpr = JSON.parse(fs.readFileSync(path.join(DIR, 'evidence', 'tpr-gap-case.json'), 'utf8'));
const errors = [];

function readPinnedJson(commit, relativePath) {
  return JSON.parse(execFileSync('git', ['show', `${commit}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8'
  }));
}

function readHashedRaw(reference, label) {
  const file = path.join(DIR, reference?.path || '');
  if (!reference?.path || !fs.existsSync(file)) {
    fail(`${label} raw response is missing`);
    return { results: [] };
  }
  const bytes = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== reference.sha256) fail(`${label} raw response hash mismatch`);
  return JSON.parse(bytes.toString('utf8'));
}

function queryBarsCell(payload, symbol) {
  const result = payload.results?.find(item => item.data_type === 'bars_daily');
  const index = result?.symbols?.indexOf(symbol) ?? -1;
  return index >= 0 ? result.data?.[index] : null;
}

function fail(message) { errors.push(message); }
function close(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected}, got ${actual}`);
  }
}
function includes(file, values) {
  const body = fs.readFileSync(path.join(DIR, file), 'utf8');
  for (const value of values) {
    if (!body.includes(value)) fail(`${file}: expected published value ${JSON.stringify(value)}`);
  }
}

const plan = clf.historical_plan;
const clfLaterRaw = readHashedRaw(clf.later_bar_reconstruction?.raw_response, 'CLF later bars');
const tprBarsRaw = readHashedRaw(tpr.raw_bar_response, 'TPR bars');
const sourceCommit = plan.source_git?.commit;
let scan;
let rawScan;
let decisionBarsPayload;
try {
  scan = readPinnedJson(sourceCommit, 'scanner/20260813/signals.json');
  rawScan = readPinnedJson(sourceCommit, 'scanner/20260813/_data/screen_momentum_us.json');
} catch (error) {
  fail(`Pinned CLF source payloads cannot be read: ${error.message}`);
  scan = { signals: [] };
  rawScan = { data: { items: [] } };
}
try {
  decisionBarsPayload = readPinnedJson(
    clf.decision_bar_snapshot.source_git.commit,
    clf.decision_bar_snapshot.source_path
  );
} catch (error) {
  fail(`Pinned CLF decision bars cannot be read: ${error.message}`);
  decisionBarsPayload = { results: [] };
}
const risk = plan.entry - plan.stop;
const reward1 = plan.target_1 - plan.entry;
const reward2 = plan.target_2 - plan.entry;
const quantity = Math.floor(clf.derived.example_risk_budget / risk);

close(risk, clf.derived.risk_per_share, 1e-9, 'CLF risk per share');
close(reward1 / risk, clf.derived.target_1_r_multiple, 1e-9, 'CLF target 1 R');
close(reward2 / risk, clf.derived.target_2_r_multiple, 1e-9, 'CLF target 2 R');
close(quantity * plan.entry, clf.derived.example_notional, 1e-9, 'CLF example notional');
close(quantity * risk, clf.derived.example_theoretical_loss_at_stop, 1e-9, 'CLF loss at stop');

const decisionResult = decisionBarsPayload.results?.find(result => result.data_type === 'bars_daily');
const decisionSymbolIndex = decisionResult?.symbols?.indexOf('CLF') ?? -1;
const pinnedDecisionCell = decisionSymbolIndex >= 0 ? decisionResult.data?.[decisionSymbolIndex] : null;
if (!pinnedDecisionCell) {
  fail('CLF is missing from the pinned decision-bar payload');
} else {
  if (decisionBarsPayload.timestamp !== clf.decision_bar_snapshot.query_captured_at) {
    fail('CLF decision-bar capture timestamp mismatch');
  }
  if (decisionSymbolIndex !== clf.decision_bar_snapshot.symbol_index) {
    fail(`CLF decision symbol index mismatch: expected ${clf.decision_bar_snapshot.symbol_index}, got ${decisionSymbolIndex}`);
  }
  if (pinnedDecisionCell.source !== clf.decision_bar_snapshot.source) fail('CLF decision-bar source mismatch');
  if (pinnedDecisionCell.sessions_complete !== true) fail('CLF decision bars were not marked complete');
  const firstEvidenceDate = clf.decision_bar_snapshot.bars[0][0];
  const pinnedSubset = pinnedDecisionCell.bars.filter(row => row[0] >= firstEvidenceDate);
  if (JSON.stringify(pinnedSubset) !== JSON.stringify(clf.decision_bar_snapshot.bars)) {
    fail('CLF decision bars do not match the immutable pre-decision payload');
  }
}

const bars = clf.decision_bar_snapshot.bars;
const end = bars.findIndex(row => row[0] === '2026-08-12');
if (end < 14) {
  fail('CLF evidence does not contain enough bars for ATR14 with a prior close');
} else {
  const trueRanges = [];
  const highLowRanges = [];
  for (let i = end - 13; i <= end; i += 1) {
    const [, , high, low] = bars[i];
    const previousClose = bars[i - 1][4];
    trueRanges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
    highLowRanges.push(high - low);
  }
  const atr14 = trueRanges.reduce((sum, value) => sum + value, 0) / 14;
  const averageRange = highLowRanges.reduce((sum, value) => sum + value, 0) / 14;
  close(atr14, clf.derived.arithmetic_mean_true_range_14_as_of_2026_08_12, 1e-9, 'CLF arithmetic mean true range 14');
  close(averageRange, clf.derived.average_high_low_range_14_as_of_2026_08_12, 1e-9, 'CLF average high-low range');
}

const rawCandidate = rawScan.data?.items
  ?.flatMap(item => item.candidates || [])
  .find(candidate => candidate.symbol === 'CLF');
if (!rawCandidate) {
  fail('CLF raw screen candidate is missing');
} else {
  if (rawScan.data?.items?.[0]?.as_of !== clf.source_screen.captured_at) {
    fail('CLF source-screen capture timestamp mismatch');
  }
  close(rawCandidate.atr, clf.source_screen.atr, 1e-12, 'CLF source-screen ATR');
  close((rawCandidate.entry_price - rawCandidate.stop_loss) / rawCandidate.atr, 1.5, 1e-9, 'CLF raw stop ATR multiple');
  close((rawCandidate.take_profit - rawCandidate.entry_price) / rawCandidate.atr, 3, 1e-9, 'CLF raw target ATR multiple');
  close(risk / rawCandidate.atr, clf.derived.final_stop_distance_source_atr_multiple, 1e-9, 'CLF final stop source-ATR multiple');
  const decisionLast = bars[bars.length - 1];
  close(rawCandidate.last_price, decisionLast[4], 1e-12, 'CLF raw-screen price versus decision bar');
  close(rawCandidate.volume, decisionLast[5], 0, 'CLF raw-screen volume versus decision bar');
}
if (clf.source_screen.transformation_to_final_plan?.status !== 'undocumented') {
  fail('CLF raw-to-final plan transformation must remain explicitly undocumented');
}

const decisionLast = bars[bars.length - 1];
const reconstructed = clf.later_bar_reconstruction?.august_12_bar;
if (clf.later_bar_reconstruction?.label !== 'vendor_reconstruction_not_decision_input' || !reconstructed) {
  fail('CLF later vendor reconstruction is not separated from decision inputs');
} else {
  if (decisionLast[4] === reconstructed[4] || decisionLast[5] === reconstructed[5]) {
    fail('CLF vendor-version divergence is not represented in evidence');
  }
  close(decisionLast[4], 12.095, 1e-12, 'CLF archived decision close');
  close(decisionLast[5], 5831609, 0, 'CLF archived decision volume');
  close(reconstructed[4], 12.25, 1e-12, 'CLF later reconstructed close');
  close(reconstructed[5], 13268600, 0, 'CLF later reconstructed volume');
}
const clfLaterCell = queryBarsCell(clfLaterRaw, 'CLF');
if (!clfLaterCell) {
  fail('CLF later raw response has no bars cell');
} else {
  const laterAugust12 = clfLaterCell.bars.find(row => row[0] === '2026-08-12');
  const laterAugust13 = clfLaterCell.bars.find(row => row[0] === '2026-08-13');
  if (JSON.stringify(laterAugust12) !== JSON.stringify(reconstructed)) {
    fail('CLF later reconstruction does not match its hashed raw response');
  }
  if (JSON.stringify(laterAugust13) !== JSON.stringify(clf.post_plan_observation.bar)) {
    fail('CLF post-plan outcome does not match its hashed raw response');
  }
  if (clfLaterCell.source !== 'yahoo' || clfLaterCell.quality !== 'high') {
    fail('CLF later raw-response source or quality mismatch');
  }
  if (clfLaterCell.market_snapshot_id !== clf.later_bar_reconstruction.market_snapshot_id ||
      clfLaterRaw.market_snapshot_id !== clf.later_bar_reconstruction.raw_response.response_market_snapshot_id ||
      clfLaterRaw.captured_at !== clf.later_bar_reconstruction.captured_at) {
    fail('CLF later raw-response provenance mismatch');
  }
}

const sourceSignal = scan.signals.find(signal => signal.ticker === 'CLF');
if (!sourceSignal) {
  fail('CLF historical source signal is missing');
} else {
  close(sourceSignal.entry, plan.entry, 1e-9, 'CLF source entry');
  close(sourceSignal.stop, plan.stop, 1e-9, 'CLF source stop');
  close(sourceSignal.tp1, plan.target_1, 1e-9, 'CLF source target 1');
  close(sourceSignal.tp2, plan.target_2, 1e-9, 'CLF source target 2');
}

const gitRef = clf.historical_plan.source_git;
if (!gitRef?.commit || !gitRef?.blob || !gitRef?.decision_cutoff || !gitRef?.us_regular_open) {
  fail('CLF immutable Git provenance or decision cutoff is missing');
} else {
  try {
    const actualBlob = execFileSync('git', ['rev-parse', `${gitRef.commit}:scanner/20260813/signals.json`], {
      cwd: ROOT,
      encoding: 'utf8'
    }).trim();
    if (actualBlob !== gitRef.blob) fail(`CLF source blob mismatch: expected ${gitRef.blob}, got ${actualBlob}`);
    const actualRawBlob = execFileSync('git', [
      'rev-parse',
      `${gitRef.commit}:scanner/20260813/_data/screen_momentum_us.json`
    ], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (actualRawBlob !== clf.source_screen.source_git_blob) {
      fail(`CLF raw-screen blob mismatch: expected ${clf.source_screen.source_git_blob}, got ${actualRawBlob}`);
    }
    const commitTime = Date.parse(execFileSync('git', ['show', '-s', '--format=%cI', gitRef.commit], {
      cwd: ROOT,
      encoding: 'utf8'
    }).trim());
    const cutoff = Date.parse(gitRef.decision_cutoff);
    const marketOpen = Date.parse(gitRef.us_regular_open);
    if (![commitTime, cutoff, marketOpen].every(Number.isFinite)) {
      fail('CLF chronology contains an invalid timestamp');
    } else if (commitTime > cutoff || cutoff >= marketOpen) {
      fail(`CLF chronology invalid: commit=${commitTime}, cutoff=${cutoff}, open=${marketOpen}`);
    }
  } catch (error) {
    fail(`CLF Git provenance cannot be resolved: ${error.message}`);
  }
}
const decisionGitRef = clf.decision_bar_snapshot.source_git;
try {
  const decisionBlob = execFileSync('git', [
    'rev-parse',
    `${decisionGitRef.commit}:${clf.decision_bar_snapshot.source_path}`
  ], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (decisionBlob !== decisionGitRef.blob) {
    fail(`CLF decision-bar blob mismatch: expected ${decisionGitRef.blob}, got ${decisionBlob}`);
  }
  const decisionArchiveTime = Date.parse(execFileSync('git', [
    'show', '-s', '--format=%cI', decisionGitRef.commit
  ], { cwd: ROOT, encoding: 'utf8' }).trim());
  const queryCapturedAt = Date.parse(clf.decision_bar_snapshot.query_captured_at);
  const finalCutoff = Date.parse(gitRef.decision_cutoff);
  if (![queryCapturedAt, decisionArchiveTime, finalCutoff].every(Number.isFinite) ||
      queryCapturedAt > decisionArchiveTime || decisionArchiveTime > finalCutoff) {
    fail('CLF decision-bar capture/archive chronology is invalid');
  }
} catch (error) {
  fail(`CLF decision-bar Git provenance cannot be resolved: ${error.message}`);
}
if (clf.selection?.method !== 'purpose_selected_historical_illustration') {
  fail('CLF purpose-selection disclosure is missing');
}
if (clf.post_plan_observation?.label !== 'outcome_not_decision_input') {
  fail('CLF post-plan outcome is not separated from decision inputs');
}

const [before, reaction] = tpr.bars;
const tprRawCell = queryBarsCell(tprBarsRaw, 'TPR');
if (!tprRawCell) {
  fail('TPR raw response has no bars cell');
} else {
  if (JSON.stringify(tprRawCell.bars) !== JSON.stringify(tpr.bars)) {
    fail('TPR bars do not match their hashed raw response');
  }
  if (tprRawCell.source !== tpr.upstream_bar_source || tprRawCell.quality !== 'high') {
    fail('TPR raw-response source or quality mismatch');
  }
  if (tprRawCell.market_snapshot_id !== tpr.raw_bar_response.cell_market_snapshot_id ||
      tprBarsRaw.market_snapshot_id !== tpr.raw_bar_response.response_market_snapshot_id ||
      tprBarsRaw.captured_at !== tpr.captured_at) {
    fail('TPR raw-response provenance mismatch');
  }
}
const gap = (reaction[1] / before[4] - 1) * 100;
const closeToClose = (reaction[4] / before[4] - 1) * 100;
const intraday = (reaction[4] / reaction[1] - 1) * 100;
close(gap, tpr.derived.gap_from_2026_08_12_close_to_2026_08_13_open_pct, 1e-9, 'TPR opening gap');
close(closeToClose, tpr.derived.close_to_close_move_pct, 1e-9, 'TPR close-to-close move');
close(intraday, tpr.derived.reaction_day_open_to_close_pct, 1e-9, 'TPR reaction-day move');
if (!tpr.rejected_facet?.reason) fail('TPR rejected earnings facet is not documented');
if (tpr.selection?.method !== 'purpose_selected_historical_illustration') {
  fail('TPR purpose-selection disclosure is missing');
}
if (tpr.upstream_bar_source !== 'yahoo') fail('TPR upstream bar source is missing');

includes('episode-01.md', ['$12.25', '$11.28', '51 shares', '$624.75', '$49.47']);
includes('episode-02.md', ['0.98R', '1.65R', '50.5%', '37.7%']);
includes('episode-03.md', ['$0.645', '$0.688', '1.50 ATR', '$11.35', '$10.87', 'maximum adverse excursion', '5,831,609', '13,268,600']);
includes('episode-04.md', ['$153.74', '$132.70', '13.69%', '$128.39', '16.49%', 'Yahoo']);
includes('episode-06.md', ['0.98R', '1.65R', '1.50 ATR', '$49.47', '13:05 UTC', '13:30 UTC', '$12.095', 'gate 7 fails']);

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  console.error(`Trade signal check validation failed: ${errors.length} error(s)`);
  process.exit(1);
}

console.log('Trade signal check validation passed: immutable decision, later reconstruction and outcome layers reconciled');
