#!/usr/bin/env node
'use strict';

/**
 * test-parallel-run.js — Smoke test for the broker-simulator parallel-run pipeline.
 *
 * Validates end-to-end integrity for every pilot mode:
 *   1. Sim account exists (resolveAccountId)
 *   2. Sim equity curve has data at pit-state asOf date
 *   3. Position set matches (articles ↔ sim)
 *   4. Entry prices match within 0.01% (entryPrice, not actualEntry)
 *   5. NAV at asOf date matches within 0.001% (backfilled data = exact)
 *   6. source-of-truth.json streak/threshold are sane
 *
 * Usage:
 *   node tools/test-parallel-run.js              # test all pilot modes
 *   node tools/test-parallel-run.js --mode X     # one mode only
 *
 * Exit code 0 = all pass, 1 = any fail.
 * Env: BROKERSIM_SERVICE_TOKEN.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NAV_TOLERANCE = 0.001; // 0.001% — backfilled data must be exact
const ENTRY_TOLERANCE = 0.01; // 0.01% — entryPrice is deterministic

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function pctDiff(a, b) {
  return b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b) * 100;
}

function parseArgs(argv) {
  const out = { mode: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode') out.mode = argv[++i];
  }
  return out;
}

async function testMode(client, mode, pit, sot, initialEquity) {
  const checks = [];
  const fail = (name, msg) => checks.push({ name, ok: false, msg });
  const pass = (name, msg) => checks.push({ name, ok: true, msg });

  const modeData = (pit.modes || {})[mode];
  if (!modeData) {
    pass('pit-state', 'no pit-state entry — mode not onboarded yet');
    return { mode, checks, skip: true };
  }

  // 1. Sim account exists
  let accountId;
  try {
    accountId = await client.resolveAccountId(mode);
    if (!accountId) throw new Error('null account ID');
    pass('account', `resolved → ${accountId.slice(0, 8)}…`);
  } catch (e) {
    fail('account', `resolveAccountId failed: ${e.message}`);
    return { mode, checks, skip: false };
  }

  // 2. Sim equity curve has data at asOf
  let equityCurve;
  try {
    equityCurve = await client.getEquityCurve(accountId);
    if (!equityCurve || equityCurve.length === 0) throw new Error('empty curve');
  } catch (e) {
    fail('curve-exists', `getEquityCurve failed: ${e.message}`);
    return { mode, checks, skip: false };
  }

  const asOf = (pit.asOf || '').slice(0, 10);
  const curveAtAsOf = equityCurve.find(p => (p.ts || '').slice(0, 10) === asOf);
  if (curveAtAsOf) {
    pass('curve-at-asof', `found data point at ${asOf}: total_equity=${curveAtAsOf.total_equity}`);
  } else {
    const nearest = equityCurve.reduce((best, p) => {
      const d = Math.abs(new Date((p.ts || '').slice(0, 10)) - new Date(asOf));
      return d < best.d ? { d, ts: (p.ts || '').slice(0, 10) } : best;
    }, { d: Infinity, ts: 'none' });
    if (nearest.d <= 3 * 86400000) {
      pass('curve-at-asof', `no exact match for ${asOf}, nearest=${nearest.ts} (within 3 cal days)`);
    } else {
      fail('curve-at-asof', `no sim data at asOf=${asOf}, nearest=${nearest.ts}`);
    }
  }

  // 3. Position set matches
  let portfolio;
  try {
    portfolio = await client.getPortfolio(accountId);
  } catch (e) {
    fail('positions', `getPortfolio failed: ${e.message}`);
    return { mode, checks, skip: false };
  }

  const artTickers = new Set((modeData.positions || []).map(p => (p.ticker || '').toUpperCase()).filter(Boolean));
  const simTickers = new Set((portfolio.positions || []).map(d => ((d.position?.symbol || d.symbol || '').toUpperCase())).filter(Boolean));
  const onlyArt = [...artTickers].filter(s => !simTickers.has(s));
  const onlySim = [...simTickers].filter(s => !artTickers.has(s));
  if (onlyArt.length || onlySim.length) {
    fail('positions', `mismatch: articles-only=[${onlyArt}] sim-only=[${onlySim}]`);
  } else {
    pass('positions', `${artTickers.size} positions match`);
  }

  // 4. Entry prices match within tolerance
  const simAvg = {};
  for (const d of portfolio.positions || []) {
    const sym = (d.position?.symbol || d.symbol || '').toUpperCase();
    const ap = d.position?.avg_price ?? d.avg_price;
    if (sym && ap != null) simAvg[sym] = ap;
  }
  let entryOk = true;
  for (const p of modeData.positions || []) {
    const sym = (p.ticker || '').toUpperCase();
    if (!simAvg[sym]) continue;
    const diff = pctDiff(simAvg[sym], p.entryPrice);
    if (diff > ENTRY_TOLERANCE) {
      fail('entry-price', `${sym}: articles=${p.entryPrice.toFixed(4)} sim=${simAvg[sym].toFixed(4)} (${diff.toFixed(4)}% > ${ENTRY_TOLERANCE}%)`);
      entryOk = false;
    }
  }
  if (entryOk) pass('entry-price', `all entry prices within ${ENTRY_TOLERANCE}%`);

  // 5. NAV at asOf matches
  const artCurve = modeData.equityCurve || [];
  const artNav = artCurve.length ? artCurve[artCurve.length - 1].value / 100 * initialEquity : null;
  let simNav = null;
  if (asOf && equityCurve.length) {
    for (let i = equityCurve.length - 1; i >= 0; i--) {
      if ((equityCurve[i].ts || '').slice(0, 10) <= asOf) { simNav = equityCurve[i].total_equity; break; }
    }
  }
  if (artNav != null && simNav != null) {
    const navDiff = pctDiff(simNav, artNav);
    if (navDiff > NAV_TOLERANCE) {
      fail('nav-match', `articles=${artNav.toFixed(2)} sim=${simNav.toFixed(2)} (${navDiff.toFixed(4)}% > ${NAV_TOLERANCE}%)`);
    } else {
      pass('nav-match', `articles=${artNav.toFixed(2)} sim=${simNav.toFixed(2)} (${navDiff.toFixed(4)}%)`);
    }
  } else {
    pass('nav-match', `artNav=${artNav} simNav=${simNav} — one side null, skipped`);
  }

  // 6. source-of-truth sanity
  const sotMeta = (sot._meta || {}).modes || {};
  const sotMode = sotMeta[mode];
  if (sotMode) {
    if (typeof sotMode.streak !== 'number' || sotMode.streak < 0) {
      fail('sot-sanity', `streak=${sotMode.streak} is invalid`);
    } else if (typeof sotMode.threshold !== 'number' || sotMode.threshold <= 0) {
      fail('sot-sanity', `threshold=${sotMode.threshold} is invalid`);
    } else {
      pass('sot-sanity', `streak=${sotMode.streak}/${sotMode.threshold}, source=${sot[mode] || 'articles'}`);
    }
  } else {
    pass('sot-sanity', 'not yet in source-of-truth.json');
  }

  return { mode, checks, skip: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let cfg, pit, sot;
  try {
    const { SimulatorClient, loadConfig } = require('./lib/simulator-client');
    cfg = loadConfig();
    pit = loadJSON('data/pit-state.json');
    sot = loadJSON('data/source-of-truth.json');
    var client = new SimulatorClient();
  } catch (e) {
    console.error(`Setup failed: ${e.message}`);
    process.exit(1);
  }

  const pilotModes = cfg.pilotModes || ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
  const initialEquity = cfg.initialEquity || 100000;
  const targetModes = args.mode ? [args.mode] : pilotModes;

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Parallel-Run Smoke Test                        ║`);
  console.log(`║  pit-state asOf: ${(pit.asOf || '?').padEnd(32)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  let totalFails = 0;
  for (const mode of targetModes) {
    const result = await testMode(client, mode, pit, sot, initialEquity);
    const failCount = result.checks.filter(c => !c.ok).length;
    const passCount = result.checks.filter(c => c.ok).length;
    const status = result.skip ? 'SKIP' : (failCount === 0 ? 'PASS' : 'FAIL');
    const icon = status === 'PASS' ? '✓' : (status === 'SKIP' ? '○' : '✗');

    console.log(`  ${icon} ${mode}: ${status} (${passCount} pass, ${failCount} fail)`);
    for (const c of result.checks) {
      const ci = c.ok ? '  ✓' : '  ✗';
      console.log(`    ${ci} ${c.name}: ${c.msg}`);
    }
    totalFails += failCount;
  }

  console.log(`\n  ${'─'.repeat(48)}`);
  console.log(`  ${totalFails === 0 ? '✓ ALL PASS' : `✗ ${totalFails} FAILURE(S)`}\n`);
  process.exitCode = totalFails > 0 ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
