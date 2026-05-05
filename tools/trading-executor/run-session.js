#!/usr/bin/env node
'use strict';

// run-session.js — Batch executor: reads config, generates plans per mode/broker, executes all.
// Usage: node tools/trading-executor/run-session.js [--dry-run] [--mode turbo] [--broker alpaca] [--verbose]
//
// Without flags: runs ALL mode/broker pairs from config.json.
// With --mode or --broker: filters to matching pairs only.

const fs = require('fs');
const path = require('path');
const { Engine } = require('./engine');
const { Notifier } = require('./notifier');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] || true) : null; }
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const FILTER_MODE = flag('mode');
const FILTER_BROKER = flag('broker');

// ── Load config ──
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ Missing config.json. Copy config.example.json → config.json and fill in your settings.');
  console.error(`   cp ${path.join(__dirname, 'config.example.json')} ${configPath}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ── Resolve credentials from env ──
function resolveCredentials(account) {
  const creds = {};
  for (const [key, envVar] of Object.entries(account.env || {})) {
    const val = process.env[envVar];
    if (!val) {
      console.error(`⚠️  Env var ${envVar} not set (broker: ${account.broker})`);
      return null;
    }
    creds[key] = val;
  }
  if (account.paper !== undefined) creds.paper = account.paper;
  if (account.demo !== undefined) creds.demo = account.demo;
  if (account.testnet !== undefined) creds.testnet = account.testnet;
  if (account.simulation !== undefined) creds.simulation = account.simulation;
  return creds;
}

// ── Load adapter ──
function loadAdapter(brokerName) {
  const adapterPath = path.join(__dirname, 'adapters', brokerName + '.js');
  if (!fs.existsSync(adapterPath)) {
    console.error(`❌ No adapter: ${brokerName}. Available: alpaca, ibkr, saxo, trading212, binance, paper`);
    return null;
  }
  return require(adapterPath);
}

// ── Generate plan for a mode/broker pair ──
function generatePlan(mode, broker) {
  const { execSync } = require('child_process');
  const planDir = path.join(ROOT, 'data/trading-plans');
  fs.mkdirSync(planDir, { recursive: true });
  // Derive date from orders.json scanDate (target session), fallback to today
  let date;
  try {
    const od = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio/v1', mode, 'orders.json'), 'utf8'));
    date = od.scanDate || '';
  } catch (_) {}
  if (!date) date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = path.join(planDir, `${mode}-${broker}-${date}.json`);

  const cmd = `node ${path.join(ROOT, 'tools/gen-trading-plan.js')} --mode ${mode} --broker ${broker} --date ${date} --output ${outPath}`;
  try {
    execSync(cmd, { stdio: VERBOSE ? 'inherit' : 'pipe' });
    return outPath;
  } catch (err) {
    console.error(`❌ Plan generation failed: ${mode}/${broker}`, err.message?.slice(0, 200));
    return null;
  }
}

// ── Main ──
(async () => {
  const settings = config.settings || {};
  const logDir = path.join(ROOT, settings.log_dir || 'data/execution-logs');
  const verbose = VERBOSE || settings.verbose;

  console.log(`🚀 Trading Session — ${new Date().toISOString().slice(0, 16)}`);
  console.log(`   Config: ${config.accounts.length} accounts | Dry run: ${DRY_RUN}`);

  const results = [];

  for (const account of config.accounts) {
    // Apply filters
    if (FILTER_BROKER && account.broker !== FILTER_BROKER) continue;

    const creds = resolveCredentials(account);
    if (!creds) { results.push({ broker: account.broker, status: 'SKIPPED', reason: 'missing credentials' }); continue; }

    const AdapterClass = loadAdapter(account.broker);
    if (!AdapterClass) { results.push({ broker: account.broker, status: 'SKIPPED', reason: 'no adapter' }); continue; }

    for (const mode of account.modes) {
      if (FILTER_MODE && mode !== FILTER_MODE) continue;

      console.log(`\n── ${mode} / ${account.broker} ──`);

      // Generate plan
      const planPath = generatePlan(mode, account.broker);
      if (!planPath) { results.push({ broker: account.broker, mode, status: 'FAILED', reason: 'plan generation' }); continue; }

      const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

      // Override capital from config
      if (account.capital_usd) plan.account.nominal_usd = account.capital_usd;

      if (DRY_RUN) {
        const orderCount = plan.orders?.length || 0;
        const closeCount = plan.close_now?.length || 0;
        console.log(`   📋 Plan: ${orderCount} orders, ${closeCount} close-now (dry-run — not executing)`);
        results.push({ broker: account.broker, mode, status: 'DRY_RUN', orders: orderCount, closes: closeCount });
        continue;
      }

      // Execute
      try {
        const adapter = new AdapterClass(creds, { verbose });
        const engine = new Engine(plan, adapter, { verbose, logDir });
        new Notifier(engine, { quiet: DRY_RUN });

        // Timeout: 2 hours max per mode
        const timeout = setTimeout(() => { engine.shutdown(); }, 7200000);
        await engine.run();
        clearTimeout(timeout);

        const filled = [...engine.orderState.values()].filter(os => os.state === 'FILLED').length;
        results.push({ broker: account.broker, mode, status: 'OK', filled, errors: engine.errors.length });
      } catch (err) {
        console.error(`   ❌ Execution error: ${err.message}`);
        results.push({ broker: account.broker, mode, status: 'FAILED', reason: err.message.slice(0, 100) });
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Session Results:');
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status === 'DRY_RUN' ? '📋' : r.status === 'SKIPPED' ? '⏭️' : '❌';
    console.log(`   ${icon} ${r.mode || '-'}/${r.broker}: ${r.status}${r.filled ? ` (${r.filled} filled)` : ''}${r.reason ? ` — ${r.reason}` : ''}`);
  }
})();
