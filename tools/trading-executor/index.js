#!/usr/bin/env node
'use strict';

// Trading Plan Executor — interprets DSL plans and executes them against a broker.
// Usage: node tools/trading-executor/index.js --plan data/trading-plans/balanced-alpaca-20260505.json
//        node tools/trading-executor/index.js --plan plan.json --paper   (force paper mode)

const fs = require('fs');
const path = require('path');
const { Engine } = require('./engine');
const { Notifier } = require('./notifier');

const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] || true) : null; }

const PLAN_PATH = flag('plan');
const PAPER = args.includes('--paper');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

if (!PLAN_PATH) {
  console.error('Usage: node tools/trading-executor/index.js --plan <path.json> [--paper] [--verbose]');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));

if (PAPER) plan.broker.name = 'paper';

// Resolve broker adapter
function loadAdapter(brokerName) {
  const adapterPath = path.join(__dirname, 'adapters', brokerName + '.js');
  if (!fs.existsSync(adapterPath)) {
    console.error(`No adapter for broker: ${brokerName}. Available: alpaca, ibkr, paper`);
    console.error(`Create ${adapterPath} implementing the BrokerAdapter interface.`);
    process.exit(1);
  }
  return require(adapterPath);
}

const AdapterClass = loadAdapter(plan.broker.name);
const adapter = new AdapterClass(plan.broker.credentials, { verbose: VERBOSE });

const engine = new Engine(plan, adapter, {
  verbose: VERBOSE,
  logDir: path.join(path.dirname(PLAN_PATH), 'logs'),
});
new Notifier(engine);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT — cancelling unfilled orders and shutting down...');
  await engine.shutdown();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await engine.shutdown();
  process.exit(0);
});

(async () => {
  try {
    await engine.run();
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
    await engine.shutdown().catch(() => {});
    process.exit(1);
  }
})();
