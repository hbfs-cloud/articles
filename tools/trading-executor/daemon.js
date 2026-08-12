#!/usr/bin/env node
'use strict';

// daemon.js — Long-running trading executor for a single mode.
// Runs continuously: generates plan at session open, monitors positions, sends notifications.
// Designed for deployment as a service (Nomad, systemd, Docker).
//
// Usage: node tools/trading-executor/daemon.js
// Env:   MODE (required), BROKER (default: paper), plus broker-specific credentials.
//        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL for notifications.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Engine } = require('./engine');
const { Notifier } = require('./notifier');
const { assertAllowed, applyCaps } = require('./allowlist');

const ROOT = path.resolve(__dirname, '../..');
const MODE = process.env.MODE;
const BROKER = process.env.BROKER || 'paper';
const CAPITAL = +(process.env.CAPITAL_USD || 10000);
const VERBOSE = process.env.VERBOSE === 'true' || process.env.VERBOSE === '1';
const LOG_DIR = process.env.LOG_DIR || path.join(ROOT, 'data/execution-logs');

if (!MODE) {
  console.error('❌ MODE env var required — voir data/executor-allowlist.json pour les modes autorisés');
  process.exit(1);
}

// AUTORISATION — avant tout le reste. Ce démon prenait son mode dans process.env.MODE et ne
// consultait aucune liste blanche : `MODE=best BROKER=alpaca node daemon.js` générait le plan et
// l'exécutait chez le courtier. La vérification se fait ici, au démarrage, pas à la première
// session : un service qui tourne des heures avant de refuser est un service qu'on croit protégé.
const ALLOW = assertAllowed(MODE, BROKER, 'daemon');

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [${MODE}/${BROKER}] ${msg}`);
}

function loadAdapter() {
  const AdapterClass = require(path.join(__dirname, 'adapters', BROKER + '.js'));
  const creds = {};

  // Resolve credentials from env
  const envMap = {
    paper: { initial_balance: 'CAPITAL_USD', live_quotes: 'LIVE_QUOTES' },
    alpaca: { api_key: 'ALPACA_API_KEY', api_secret: 'ALPACA_API_SECRET', paper: 'ALPACA_PAPER' },
    ibkr: { gateway_host: 'IBKR_GATEWAY_HOST', gateway_port: 'IBKR_GATEWAY_PORT', account_id: 'IBKR_ACCOUNT_ID' },
    saxo: { access_token: 'SAXO_ACCESS_TOKEN', account_key: 'SAXO_ACCOUNT_KEY', simulation: 'SAXO_SIMULATION' },
    trading212: { api_key: 'T212_API_KEY', demo: 'T212_DEMO' },
    binance: { api_key: 'BINANCE_API_KEY', api_secret: 'BINANCE_API_SECRET', testnet: 'BINANCE_TESTNET' },
  };

  for (const [key, envVar] of Object.entries(envMap[BROKER] || {})) {
    const val = process.env[envVar];
    if (val) {
      if (val === 'true') creds[key] = true;
      else if (val === 'false') creds[key] = false;
      else if (!isNaN(val)) creds[key] = +val;
      else creds[key] = val;
    }
  }

  if (BROKER === 'paper') creds.initial_balance = CAPITAL;
  return new AdapterClass(creds, { verbose: VERBOSE });
}

function generatePlan() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = path.join(LOG_DIR, `plan-${MODE}-${BROKER}-${date}.json`);
  fs.mkdirSync(LOG_DIR, { recursive: true });

  try {
    execSync(`node ${path.join(ROOT, 'tools/gen-trading-plan.js')} --mode ${MODE} --broker ${BROKER} --output ${outPath}`, {
      stdio: VERBOSE ? 'inherit' : 'pipe',
      timeout: 30000,
    });
    return JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } catch (err) {
    log(`❌ Plan generation failed: ${err.message.slice(0, 200)}`);
    return null;
  }
}

function isMarketOpen() {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const d = now.getDay();
  if (d === 0 || d === 6) return false;
  const mins = h * 60 + m;
  // US market: 14:30–21:00 UTC (9:30–16:00 ET)
  return mins >= 14 * 60 + 30 && mins < 21 * 60;
}

function isPreMarket() {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const d = now.getDay();
  if (d === 0 || d === 6) return false;
  const mins = h * 60 + m;
  // Pre-market: 13:00–14:30 UTC (8:00–9:30 ET)
  return mins >= 13 * 60 && mins < 14 * 60 + 30;
}

function msUntilPreMarket() {
  const now = new Date();
  const target = new Date(now);
  // Next weekday at 13:00 UTC
  target.setUTCHours(13, 0, 0, 0);
  if (target <= now || now.getDay() === 0 || now.getDay() === 6) {
    // Move to next weekday
    do { target.setDate(target.getDate() + 1); }
    while (target.getDay() === 0 || target.getDay() === 6);
  }
  return target - now;
}

// ── Main loop ──
let sessionRunning = false;
let currentEngine = null;

async function runSession() {
  if (sessionRunning) return;
  sessionRunning = true;
  log('🔔 Session starting — generating plan');

  const plan = generatePlan();
  if (!plan) { sessionRunning = false; return; }

  // CAPITAL écrasait INCONDITIONNELLEMENT le nominal du plan — y compris le `null` que la voie
  // moteur y met VOLONTAIREMENT : les quantités viennent du moteur et ne se redimensionnent pas
  // ici, donc y réinjecter un capital maison redonne au plan une apparence de dimensionnement
  // maîtrisé qu'il n'a pas. Un plan moteur garde son `null` ; les plans scanner gardent le
  // comportement d'avant (CAPITAL_USD fait foi). Puis les plafonds de la liste blanche s'appliquent
  // par le bas, jamais par le haut.
  const isEnginePlan = plan.account.nominal_usd === null
    || (plan.orders || []).some(o => o && o.source === 'engine');
  if (!isEnginePlan) plan.account.nominal_usd = CAPITAL;
  applyCaps(plan, ALLOW);
  const adapter = loadAdapter();
  const engine = new Engine(plan, adapter, { verbose: VERBOSE, logDir: LOG_DIR });
  currentEngine = engine;
  new Notifier(engine);

  try {
    await engine.run();
    log(`✅ Session complete — ${engine.trades.length} trades`);
  } catch (err) {
    log(`❌ Session error: ${err.message}`);
  }

  currentEngine = null;
  sessionRunning = false;
}

async function main() {
  log(`🚀 Daemon starting — mode=${MODE} broker=${BROKER} capital=$${CAPITAL}`);

  // Graceful shutdown
  const shutdown = async () => {
    log('⚠️  Shutdown signal received');
    if (currentEngine) await currentEngine.shutdown().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (true) {
    if (isPreMarket() || isMarketOpen()) {
      if (!sessionRunning) await runSession();
      // After session completes, wait until market closes
      while (isMarketOpen()) await sleep(60000);
      log('🔕 Market closed — waiting for next session');
    }

    // Sleep until next pre-market
    const waitMs = Math.min(msUntilPreMarket(), 3600000); // max 1h sleep chunks
    log(`💤 Sleeping ${Math.round(waitMs / 60000)}min until next pre-market`);
    await sleep(waitMs);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
