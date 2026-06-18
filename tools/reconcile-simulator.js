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
  const out = { dryRun: false, mode: null, noLog: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--no-log') out.noLog = true;
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
function compareMode(mode, modeData, portfolio, equityCurve, artPrices, initialEquity, tol) {
  const breaches = [];

  // 1. open-position set identity.
  const artSet = new Set((modeData.positions || []).map(p => (p.ticker || '').toUpperCase()).filter(Boolean));
  const simSet = new Set((portfolio.positions || []).map(d => (d.position?.symbol || d.symbol || '').toUpperCase()).filter(Boolean));
  const onlyArticles = [...artSet].filter(s => !simSet.has(s));
  const onlySim      = [...simSet].filter(s => !artSet.has(s));
  if (onlyArticles.length || onlySim.length) {
    breaches.push(`position set mismatch: articles-only=[${onlyArticles}] sim-only=[${onlySim}]`);
  }

  // 2. price check per matched symbol (+/- tol.pricePct).
  const simPrice = {};
  for (const d of portfolio.positions || []) {
    const sym = (d.position?.symbol || d.symbol || '').toUpperCase();
    const cp  = d.position?.current_price ?? d.current_price;
    if (sym && cp != null) simPrice[sym] = cp;
  }
  for (const sym of artSet) {
    if (!simSet.has(sym)) continue;
    const a = artPrices[sym];
    const s = simPrice[sym];
    if (a == null || s == null) continue; // no reference price either side — skip
    const dp = pctDiff(s, a);
    if (dp > tol.pricePct) breaches.push(`${sym} price ${s} vs articles ${a} (${dp.toFixed(2)}% > ${tol.pricePct}%)`);
  }

  // 3. equity / P&L check (+/- tol.pnlPct): per-mode NAV.
  const curve = modeData.equityCurve || [];
  const artNav = curve.length ? curve[curve.length - 1].value / 100 * initialEquity : null;
  // For equity-only modes (no sim positions, e.g. bull) the backfill leaves account cash ==
  // initial_equity, so portfolio.total_equity is always exactly initial_equity and a frozen
  // curve ending != 100 would fire a false NAV breach every night. The backfill DID write the
  // correct value into the equity-curve snapshots (total_equity = value/100*init,
  // store.go:1263), so when there are no positions the curve is the right source of truth.
  const curveNav = equityCurve.length ? equityCurve[equityCurve.length - 1].total_equity : null;
  const hasSimPositions = (portfolio.positions || []).length > 0;
  const simNav = hasSimPositions
               ? (portfolio.total_equity != null ? portfolio.total_equity : curveNav)
               : (curveNav != null ? curveNav : portfolio.total_equity);
  let navDiff = null;
  if (artNav != null && simNav != null) {
    navDiff = pctDiff(simNav, artNav);
    if (navDiff > tol.pnlPct) breaches.push(`NAV sim ${simNav.toFixed(2)} vs articles ${artNav.toFixed(2)} (${navDiff.toFixed(2)}% > ${tol.pnlPct}%)`);
  }

  return {
    mode,
    articlesPositions: [...artSet],
    simPositions: [...simSet],
    artNav, simNav,
    navDiffPct: navDiff,
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
      const r = compareMode(mode, modeData, portfolio, equityCurve || [], artPrices, initialEquity, tol);
      results.push(r);
      const tag = r.ok ? 'OK' : `BREACH(${r.breaches.length})`;
      console.log(`  ${mode}: ${tag} navDiff=${r.navDiffPct == null ? 'n/a' : r.navDiffPct.toFixed(2) + '%'}`);
      r.breaches.forEach(b => console.log(`      - ${b}`));
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
