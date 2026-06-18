#!/usr/bin/env node
'use strict';

/**
 * reconcile-simulator.js — Stage 5 divergence guard (articles vs broker-simulator).
 *
 * For each pilot mode it GETs the sim portfolio + equity-curve from the "mirror:<mode>" account
 * and compares against the frozen articles state (data/pit-state.json), checking three things:
 *
 *   1. open-position set    — pit-state positions[].ticker  MUST equal sim portfolio symbols
 *   2. price  (+/-0.5%)     — per matched symbol, sim current_price vs articles' current price
 *                             (articles side from data/scanner-positions.json, keyed by ticker)
 *   3. equity / P&L (+/-2%) — per-mode NAV: sim total_equity vs articles equityCurve last value
 *                             scaled value/100*initialEquity
 *
 * Every run is appended to data/reconciliation-log.json. On any breach an alert is sent via the
 * existing Discord notify path (openclaw message send), the same one publish-daily-card.sh uses.
 *
 * Usage:
 *   node tools/reconcile-simulator.js                 # reconcile all pilot modes
 *   node tools/reconcile-simulator.js --mode dynamic  # one mode only
 *   node tools/reconcile-simulator.js --dry-run       # compare + log, no alert
 *   node tools/reconcile-simulator.js --no-log        # compare + alert, no append
 *
 * Env: BROKERSIM_SERVICE_TOKEN (service token; never hardcoded).
 */

const fs        = require('fs');
const path      = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'data', 'reconciliation-log.json');
const DISCORD_CHANNEL = '1483382014588747778'; // same alert channel as notify-scanner-status.js

function parseArgs(argv) {
  const out = { dryRun: false, mode: null, noLog: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--no-log') out.noLog = true;
    else if (argv[i] === '--verbose' || argv[i] === '-v') out.verbose = true;
    else if (argv[i] === '--mode') out.mode = argv[++i];
  }
  return out;
}

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

// articles-side current price per ticker (global across modes), from scanner-positions.json.
function loadArticlesPrices() {
  const prices = {};
  try {
    const sp = loadJSON('data/scanner-positions.json');
    for (const p of sp.open_positions || []) {
      if (p.ticker && p.current_price != null) prices[p.ticker.toUpperCase()] = p.current_price;
    }
  } catch { /* optional source */ }
  return prices;
}

const pctDiff = (a, b) => (b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b) * 100);

// ── compare one mode ────────────────────────────────────────────────────────────
function compareMode(mode, modeData, portfolio, equityCurve, artPrices, initialEquity, tol, asOf, verbose) {
  const breaches = [];
  const warnings = [];

  // ── PRE-FLIGHT: date sanity ──────────────────────────────────────────────────
  if (asOf && equityCurve.length) {
    const target = asOf.slice(0, 10);
    const firstTs = (equityCurve[0].ts || '').slice(0, 10);
    const lastTs  = (equityCurve[equityCurve.length - 1].ts || '').slice(0, 10);
    const hasDataAtAsOf = equityCurve.some(p => (p.ts || '').slice(0, 10) === target)
      || equityCurve.some(p => {
        const d = (p.ts || '').slice(0, 10);
        // Within 1 business day tolerance (±3 calendar days covers weekends)
        return Math.abs(new Date(d) - new Date(target)) <= 3 * 86400000;
      });
    if (!hasDataAtAsOf) {
      breaches.push(`no sim equity-curve data at or near asOf=${target} (sim range: ${firstTs}..${lastTs})`);
    }
    // Stale data detection
    const asOfDate = new Date(target);
    const now = new Date();
    const staleDays = Math.floor((now - asOfDate) / 86400000);
    if (staleDays > 2 && lastTs > target) {
      warnings.push(`pit-state is ${staleDays} days stale (asOf=${target}), sim has data up to ${lastTs}`);
    }
  }

  if (verbose) {
    const artCurve = modeData.equityCurve || [];
    console.log(`    [verbose] articles asOf: ${asOf || 'unknown'}`);
    console.log(`    [verbose] articles curve: ${artCurve.length} pts, ${artCurve[0]?.date || '?'}..${artCurve[artCurve.length-1]?.date || '?'}`);
    if (equityCurve.length) {
      console.log(`    [verbose] sim curve: ${equityCurve.length} pts, ${(equityCurve[0].ts||'').slice(0,10)}..${(equityCurve[equityCurve.length-1].ts||'').slice(0,10)}`);
    }
  }

  // 1. open-position set identity.
  const artSet = new Set((modeData.positions || []).map(p => (p.ticker || '').toUpperCase()).filter(Boolean));
  const simSet = new Set((portfolio.positions || []).map(d => (d.position?.symbol || d.symbol || '').toUpperCase()).filter(Boolean));
  const onlyArticles = [...artSet].filter(s => !simSet.has(s));
  const onlySim      = [...simSet].filter(s => !artSet.has(s));
  if (onlyArticles.length || onlySim.length) {
    breaches.push(`position set mismatch: articles-only=[${onlyArticles}] sim-only=[${onlySim}]`);
  }

  // 2. entry price sanity — articles entryPrice vs sim avg_price must match within 0.01%.
  const simAvgPrice = {};
  const simPrice = {};
  for (const d of portfolio.positions || []) {
    const sym = (d.position?.symbol || d.symbol || '').toUpperCase();
    const cp  = d.position?.current_price ?? d.current_price;
    const ap  = d.position?.avg_price ?? d.avg_price;
    if (sym && cp != null) simPrice[sym] = cp;
    if (sym && ap != null) simAvgPrice[sym] = ap;
  }
  const artPositions = modeData.positions || [];
  for (const p of artPositions) {
    const sym = (p.ticker || '').toUpperCase();
    if (!simAvgPrice[sym]) continue;
    const artEntry = p.entryPrice;
    const simEntry = simAvgPrice[sym];
    if (artEntry > 0 && simEntry > 0) {
      const entryDiff = pctDiff(simEntry, artEntry);
      if (entryDiff > 0.01) {
        warnings.push(`${sym} entry price diverges: articles=${artEntry.toFixed(4)} sim=${simEntry.toFixed(4)} (${entryDiff.toFixed(4)}%)`);
      }
      if (verbose) {
        const simQty = (portfolio.positions || []).find(d => ((d.position?.symbol || d.symbol || '').toUpperCase()) === sym);
        const qty = simQty?.qty || simQty?.position?.qty || '?';
        const simWeight = simEntry > 0 ? (qty * simEntry / initialEquity) : '?';
        console.log(`    [verbose] ${sym}: art.entry=${artEntry.toFixed(4)} sim.avg=${simEntry.toFixed(4)} diff=${entryDiff.toFixed(4)}% | art.weight=${p.weight} sim.weight≈${typeof simWeight === 'number' ? simWeight.toFixed(4) : simWeight}`);
      }
    }
  }

  // 3. live price check per matched symbol (+/- tol.pricePct). Only informational when
  // comparing at asOf — live prices won't match the frozen snapshot. Skip breach if stale.
  for (const sym of artSet) {
    if (!simSet.has(sym)) continue;
    const a = artPrices[sym];
    const s = simPrice[sym];
    if (a == null || s == null) continue;
    const dp = pctDiff(s, a);
    if (dp > tol.pricePct) breaches.push(`${sym} price ${s} vs articles ${a} (${dp.toFixed(2)}% > ${tol.pricePct}%)`);
  }

  // 4. equity / P&L check: compare at the SAME date (pit-state asOf).
  const curve = modeData.equityCurve || [];
  const artNav = curve.length ? curve[curve.length - 1].value / 100 * initialEquity : null;

  let simNavAtAsOf = null;
  let simNavSource = 'none';
  if (asOf && equityCurve.length) {
    const target = asOf.slice(0, 10);
    for (let i = equityCurve.length - 1; i >= 0; i--) {
      const ts = (equityCurve[i].ts || '').slice(0, 10);
      if (ts <= target) { simNavAtAsOf = equityCurve[i].total_equity; simNavSource = `curve@${ts}`; break; }
    }
  }
  const curveNav = equityCurve.length ? equityCurve[equityCurve.length - 1].total_equity : null;
  const simNav = simNavAtAsOf != null ? simNavAtAsOf
               : (curveNav != null ? curveNav : portfolio.total_equity);
  if (simNavAtAsOf == null && simNav != null) {
    simNavSource = curveNav != null ? 'curve@latest' : 'portfolio.live';
    warnings.push(`NAV comparison fell back to ${simNavSource} (no sim curve data at asOf=${asOf})`);
  }

  let navDiff = null;
  if (artNav != null && simNav != null) {
    navDiff = pctDiff(simNav, artNav);
    if (navDiff > tol.pnlPct) breaches.push(`NAV sim ${simNav.toFixed(2)} vs articles ${artNav.toFixed(2)} (${navDiff.toFixed(2)}% > ${tol.pnlPct}%)`);
  }

  if (verbose) {
    console.log(`    [verbose] NAV: articles=${artNav != null ? artNav.toFixed(2) : 'null'} sim=${simNav != null ? simNav.toFixed(2) : 'null'} (source=${simNavSource}) diff=${navDiff != null ? navDiff.toFixed(4) + '%' : 'n/a'}`);
  }

  return {
    mode,
    articlesPositions: [...artSet],
    simPositions: [...simSet],
    artNav, simNav,
    navDiffPct: navDiff,
    simNavSource,
    warnings,
    breaches,
    ok: breaches.length === 0,
  };
}

function sendAlert(text) {
  try {
    const safe = text.replace(/'/g, "'\\''");
    execSync(`openclaw message send --channel discord --target "${DISCORD_CHANNEL}" --message '${safe}'`, {
      stdio: 'pipe', timeout: 15000,
    });
    console.log('alert sent to Discord');
  } catch (e) {
    console.warn(`alert send failed (non-blocking): ${e.message}`);
  }
}

function appendLog(entry) {
  let log = [];
  try { if (fs.existsSync(LOG_FILE)) log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { log = []; }
  if (!Array.isArray(log)) log = [];
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + '\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { SimulatorClient, loadConfig } = require('./lib/simulator-client');

  const cfg = loadConfig();
  const pilotModes = cfg.pilotModes || ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
  const initialEquity = cfg.initialEquity || 100000;
  const tol = { pricePct: 0.5, pnlPct: 2.0, ...(cfg.tolerances || {}) };

  const pit       = loadJSON('data/pit-state.json');
  const artPrices = loadArticlesPrices();
  const modes     = pit.modes || {};
  const targetModes = (args.mode ? [args.mode] : pilotModes).filter(m => pilotModes.includes(m));

  const client  = new SimulatorClient();
  const results = [];

  for (const mode of targetModes) {
    const modeData = modes[mode];
    if (!modeData) { console.log(`  ${mode}: no pit-state entry — skip`); continue; }
    try {
      const accountId   = await client.resolveAccountId(mode);
      const portfolio   = await client.getPortfolio(accountId);
      const equityCurve = await client.getEquityCurve(accountId);
      const r = compareMode(mode, modeData, portfolio, equityCurve || [], artPrices, initialEquity, tol, pit.asOf, args.verbose);
      results.push(r);
      const warnCount = (r.warnings || []).length;
      const tag = r.ok ? (warnCount ? `OK(${warnCount} warn)` : 'OK') : `BREACH(${r.breaches.length})`;
      console.log(`  ${mode}: ${tag} navDiff=${r.navDiffPct == null ? 'n/a' : r.navDiffPct.toFixed(4) + '%'} [${r.simNavSource || '?'}]`);
      (r.warnings || []).forEach(w => console.log(`      ⚠ ${w}`));
      r.breaches.forEach(b => console.log(`      ✗ ${b}`));
    } catch (e) {
      results.push({ mode, error: e.message, ok: false, breaches: [`reconcile error: ${e.message}`] });
      console.error(`  ${mode}: ERROR ${e.message}`);
    }
  }

  const breached = results.filter(r => !r.ok);
  const entry = {
    ts: new Date().toISOString(),
    asOf: pit.asOf,
    tolerances: tol,
    modes: results,
    breachCount: breached.length,
  };

  if (!args.noLog) { appendLog(entry); console.log(`appended to ${path.relative(ROOT, LOG_FILE)}`); }

  if (breached.length && !args.dryRun) {
    const lines = breached.map(r => `• ${r.mode}: ${r.breaches.join('; ')}`).join('\n');
    sendAlert(`⚠️ broker-sim reconciliation breach (asOf ${pit.asOf})\n${lines}`);
  }

  process.exitCode = breached.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
