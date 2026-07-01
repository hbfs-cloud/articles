#!/usr/bin/env node
'use strict';
/**
 * tss-orders.js — Pont de PARITÉ pour les modes SCRIPTÉS (Bull/HighVol/ETF/Casablanca/…).
 *
 * Les modes scriptés doivent placer EXACTEMENT les mêmes ordres BUY/SELL du lendemain que
 * systematic-tss (le système est la source de vérité). Au lieu de re-dériver avec nos scanners
 * JS (qui ont divergé : gate 8× Bull, scores off-scale momentum, ETF surachat…), on run le PM
 * systematic-tss via `cmd/backtest` et on lit ses `pending_orders` du dernier snapshot.
 *
 * Infisical (cert btw.cloud.hbfs-cloud.net expiré) est SKIPPÉ via un .env vide + unset des vars.
 * Données US cachées OK ; les configs EU (secmaster FR/DE) nécessitent l'infra data.
 *
 * Usage:
 *   node tools/tss-orders.js --mode bull --config config/portfolio_us_americanbulls.yaml \
 *        --end 2026-06-30 [--start 2026-05-15] [--tss <path>] [--json out.json]
 *
 * Voir mémoire scripted-modes-tss-order-parity.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const MODE = arg('mode', 'bull');
const CONFIG = arg('config', 'config/portfolio_us_americanbulls.yaml');
const END = arg('end', new Date().toISOString().slice(0, 10)); // caller passes a concrete date; no Date.now in scanner ctx
const START = arg('start', '');
const TSS = arg('tss', path.join(process.env.HOME || '', 'GolandProjects', 'systematic-tss'));
const JSON_OUT = arg('json', '');

function log(...a) { process.stderr.write(a.join(' ') + '\n'); }

// 1) Build the backtest binary (idempotent, fast when cached).
const BIN = path.join('/tmp', 'tss-bt');
try {
  execFileSync('go', ['build', '-o', BIN, './cmd/backtest/'], { cwd: TSS, stdio: 'pipe' });
} catch (e) {
  log('❌ build cmd/backtest failed:', (e.stderr || e.message || '').toString().slice(0, 300));
  process.exit(2);
}

// 2) Empty .env → secrets.Load skips Infisical (falls back to .env only). Unset Infisical vars too.
const EENV = path.join('/tmp', 'tss-empty.env');
fs.writeFileSync(EENV, '');
const SNAP_DIR = path.join('/tmp', 'tss-snap-' + MODE);
fs.rmSync(SNAP_DIR, { recursive: true, force: true });

const env = { ...process.env };
delete env.INFISICAL_CLIENT_ID; delete env.INFISICAL_CLIENT_SECRET;
delete env.INFISICAL_API_URL; delete env.INFISICAL_PROJECT_ID;

const btArgs = ['--env', EENV, '--config', CONFIG, '--end', END, '--export-snapshots', SNAP_DIR];
if (START) { btArgs.push('--start', START); }

try {
  execFileSync(BIN, btArgs, { cwd: TSS, env, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  const err = (e.stderr || e.stdout || e.message || '').toString();
  if (/Infisical/i.test(err) && /certificate/i.test(err)) {
    log('❌ Infisical cert blocked despite empty .env — check env unset. ', err.slice(0, 200));
  } else if (/Could not load stocks|404/i.test(err)) {
    log('❌ market data unavailable (likely EU secmaster offline). This mode needs the data infra.');
  } else {
    log('❌ backtest failed:', err.slice(0, 300));
  }
  process.exit(3);
}

// 3) Parse the most-recent snapshot → pending_orders + positions.
const snapPath = path.join(SNAP_DIR, 'data', 'snapshots.json');
if (!fs.existsSync(snapPath)) { log('❌ no snapshots.json produced'); process.exit(4); }
const arr = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
if (!Array.isArray(arr) || !arr.length) { log('❌ empty snapshots array'); process.exit(4); }
arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const last = arr[arr.length - 1];

// STOP orders carry the level in StopPrice (LimitPrice=0); LIMIT in LimitPrice; MARKET has no price.
const orders = (last.pending_orders || []).map(o => {
  const type = (o.OrderType || '').toUpperCase();
  const price = type === 'STOP' || type === 'STOP_LIMIT' ? (o.StopPrice || 0) : (o.LimitPrice || 0);
  return {
    ticker: o.Symbol, side: (o.Side || '').toUpperCase(), order_type: type,
    price: +(+price).toFixed(4), qty: o.Qty || 0,
    reason: o.Reason || '', source: 'systematic-tss',
  };
});
const positions = (last.positions || []).map(p => p.Symbol || p.symbol).filter(Boolean);

const result = { mode: MODE, config: CONFIG, snapshotDate: last.date, orders, positions };
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 2));

// Human summary to stderr, machine JSON to stdout.
log(`\n✅ ${MODE} — systematic-tss snapshot ${last.date}: ${orders.length} ordres, ${positions.length} positions`);
for (const o of orders) log(`   ${o.side.padEnd(4)} ${o.ticker.padEnd(6)} ${o.order_type.padEnd(6)} ${o.price ? '$' + o.price : '(market)'} qty=${o.qty} ${o.reason ? '· ' + o.reason : ''}`);
process.stdout.write(JSON.stringify(result));
