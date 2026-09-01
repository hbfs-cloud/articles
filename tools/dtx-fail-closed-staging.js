#!/usr/bin/env node
'use strict';

/**
 * Materialize a current, explicitly non-actionable DTX staging when DtxDecide
 * refuses the request before producing Contract V2 run/call/plan identifiers.
 * A certified replay may still provide public historical metrics, but no order
 * can escape this path and no provenance identifier is fabricated.
 */
const fs = require('fs');
const path = require('path');
const scan = require('./dtx-scan');
const { unwrapResult, validateDtxReplay } = require('./lib/dtx-content-gates');

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) out[key.slice(2)] = argv[++i];
  }
  return out;
}

function readJson(file, label) {
  if (!file || !fs.existsSync(file)) throw new Error(`${label} file missing`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${label} invalid JSON: ${error.message}`); }
}

function main() {
  const o = args(process.argv);
  for (const key of ['portfolio', 'config-hash', 'asof', 'expected-close', 'decision-error', 'replay', 'request-id']) {
    if (!o[key]) throw new Error(`--${key} required`);
  }
  const publicMode = scan.publicModeForPortfolio(o.portfolio) || o.portfolio;
  const expectedPortfolio = scan.dtxPortfolioForMode(publicMode);
  const expectedConfigHash = scan.dtxConfigHashForMode(publicMode);
  if (o.portfolio !== expectedPortfolio) {
    throw new Error(`portfolio ${o.portfolio} != configured engine ${expectedPortfolio}`);
  }
  if (!expectedConfigHash || o['config-hash'] !== expectedConfigHash) {
    throw new Error(`config hash ${o['config-hash']} != configured ${expectedConfigHash || 'missing'}`);
  }
  const decisionFault = readJson(o['decision-error'], 'decision error');
  const expectedMessage = 'idempotency key reused with different input fingerprint';
  if (decisionFault !== expectedMessage) throw new Error(`unsupported DtxDecide refusal: ${JSON.stringify(decisionFault)}`);
  const replayEnvelope = readJson(o.replay, 'replay');
  const replayErrors = validateDtxReplay(replayEnvelope, {
    portfolio: o.portfolio, referenceClose: o['expected-close'],
  });
  if (replayErrors.length) throw new Error(`DtxReplay rejected: ${replayErrors.join('; ')}`);
  const requestId = fs.readFileSync(o['request-id'], 'utf8').trim();
  if (!requestId) throw new Error('request id empty');
  const replay = unwrapResult(replayEnvelope);
  const from = o.from || scan.DEFAULT_FROM;
  const to = o.to || scan.goLiveFor(o.portfolio) || o.asof;
  const { metrics, equity } = scan.extractReplayMetrics(replay, from, to);
  if (!metrics || !equity) throw new Error('certified replay metrics/equity missing');
  const sanity = scan.assertReplaySanity(o.portfolio, metrics);
  if (sanity.length) throw new Error(`DtxReplay sanity rejected: ${sanity.join('; ')}`);
  const sourceArtifact = path.relative(scan.REPO_ROOT, path.resolve(o['decision-error']));
  const snapshot = {
    mode: publicMode,
    portfolioId: expectedPortfolio,
    configHash: o['config-hash'],
    name: o.name || 'DTX Best multi-sleeve',
    asof: o.asof,
    generatedAt: new Date().toISOString(),
    engine: 'dtx (systematic-tss) — MCP refusal, fail closed',
    engineMode: 'mcp',
    actionable: false,
    failureMode: 'fail_closed',
    invalidDecision: {
      code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
      message: decisionFault,
      sourceArtifact,
    },
    decisionProvenance: {
      contractVersion: '2.0', requestId, runId: null, callId: null,
      requestedAsOf: o.asof, expectedDataDate: o['expected-close'], dataAsOf: replay.data_asof,
      planId: null, planRevision: null, validFrom: null, validUntil: null,
    },
    executionPlan: null,
    config: `MCP:${o.portfolio}`,
    currency: o.currency || 'USD',
    orders: [], updates: [], cancels: [],
    sleeveCoverage: { tagged: 0, total: 0, untagged: [], conflicts: [], source: 'none: decision refused' },
    metrics, equity,
    metricsSource: 'mcp_replay', equityResolution: 'replay',
    equitySource: 'DtxReplay (historique certifié; décision courante non actionnable)',
    replayError: null, metricsSuspect: false, _sanityWarning: null,
    stateless: true, tookMs: 0,
  };
  const validation = scan.stagingSnapshotErrors(snapshot, expectedPortfolio, {
    publicModeId: publicMode,
    expectedConfigHash,
    todayIso: new Date().toISOString().slice(0, 10), scanDateIso: o.asof, expectedClose: o['expected-close'],
  });
  if (validation.length) throw new Error(`fail-closed staging rejected: ${validation.join('; ')}`);
  const outFile = o.out || scan.stagingPathFor(publicMode);
  scan.writeStaging(snapshot, outFile);
  console.log(`Wrote ${outFile}: fail closed, 0 actionable orders (${decisionFault})`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`ERROR: ${error.message}`); process.exit(1); }
}

module.exports = { main };
