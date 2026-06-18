#!/usr/bin/env node
'use strict';

/**
 * export-to-simulator.js — Stage 5 frozen-history exporter (articles -> broker-simulator).
 *
 * For each pilot mode (turbo, dynamic, balanced, bull, secured) this reads the FROZEN
 * articles history and POSTs one /backfill payload to the mode's "mirror:<mode>" sim account:
 *
 *   closed_trades   <- pit-state.modes[mode].closedTrades  (each carries weight + entry/exit)
 *   open_positions  <- pit-state.modes[mode].positions[]   (stop/tp1/tp2/horizon/weight + carry)
 *   equity_curve    <- pit-state.modes[mode].equityCurve   (%/weight base 100)
 *   initial_equity  <- simulator-config.initialEquity (notional, default 100000)
 *
 * Prices use entryPrice/exitPrice (the model prices articles' %/weight P&L is computed off —
 * verified: stored pnlPct == (exitPrice-entryPrice)/entryPrice), NOT actualEntry, so the sim's
 * weight-sized lots reproduce articles' equity curve and divergence stays ~0.
 *
 * bull has NO enriched closed history (equity-only): if its pit-state has no closedTrades/
 * positions, only the equity_curve is exported.
 *
 * The backfill endpoint is idempotent by deterministic client_id (<mode>|<ticker>|<entryDate>);
 * re-running is a no-op on the sim side.
 *
 * Usage:
 *   node tools/export-to-simulator.js                 # backfill all pilot modes
 *   node tools/export-to-simulator.js --mode dynamic  # one mode only
 *   node tools/export-to-simulator.js --dry-run       # print payloads, no POST
 *
 * Env: BROKERSIM_SERVICE_TOKEN (service token; never hardcoded).
 */

const fs   = require('fs');
const path = require('path');
const { SimulatorClient, loadConfig } = require('./lib/simulator-client');

const ROOT = path.join(__dirname, '..');

// ── tiny CLI parser ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { dryRun: false, mode: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--mode') out.mode = argv[++i];
  }
  return out;
}

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

// Deterministic idempotency key shared with publish-to-simulator.js.
function clientId(mode, ticker, entryDate) {
  return `${mode}|${ticker}|${entryDate}`;
}

// ── payload builder ─────────────────────────────────────────────────────────────
function buildPayload(mode, modeData, modeCfg, initialEquity) {
  const closed_trades = (modeData.closedTrades || [])
    .filter(t => t.ticker && t.entryPrice > 0 && t.exitPrice > 0 && t.weight > 0)
    .map(t => ({
      symbol:      t.ticker,
      side:        'BUY',
      mode,
      weight:      t.weight,
      entry_price: t.entryPrice,
      exit_price:  t.exitPrice,
      entry_date:  t.entryDate,
      exit_date:   t.exitDate,
      client_id:   clientId(mode, t.ticker, t.entryDate),
    }));

  // A mode runs a partial TP if EITHER the TP1-original partial (partialTP) OR the gain-based
  // partial (partialTPGain>0) is configured — sweep.js fires the gain-based partial regardless
  // of the partialTP flag (sweep.js:779-787, gate at sweep.js:812). The SIM backfill validator
  // requires partial_tp=true whenever partial_fired (backfill.go:230-233), so derive enablement
  // from whichever mechanism the mode actually uses, not just the partialTP flag.
  const partialTpEnabled = !!modeCfg.partialTP || (modeCfg.partialTPGain || 0) > 0;
  // The SIM books already-realized partial proceeds as partial_qty * tp1 (backfill.go:242). For
  // gain-based modes the partial filled at entry*(1+partialTPGain%) (sweep.js:782-783), NOT at
  // actualTp1; only the TP1-original path fills at actualTp1 (sweep.js:796-800). Send the true
  // partial fill price as tp1 so the SIM seeds the correct cash and the carried lot matches.
  const gainBased = (modeCfg.partialTPGain || 0) > 0;

  const open_positions = (modeData.positions || [])
    .filter(p => p.ticker && p.entryPrice > 0 && p.weight > 0)
    .map(p => {
      const partialFired = partialTpEnabled && (p.partialRealized || 0) > 0;
      const partialFillPrice = gainBased
        ? p.entryPrice * (1 + (modeCfg.partialTPGain || 0) / 100)
        : (p.actualTp1 != null ? p.actualTp1 : null);
      return {
        symbol:         p.ticker,
        mode,
        weight:         p.weight,
        entry_price:    p.entryPrice,
        entry_date:     p.entryDate,
        signal_date:    p.scanDate || p.entryDate,
        stop:           p.actualStop,
        // tp1 is the partial fill price the SIM books partial proceeds at; for gain-based modes
        // this is entry*(1+gain%), otherwise the original actualTp1.
        tp1:            partialFired ? partialFillPrice
                        : (p.actualTp1 != null ? p.actualTp1 : null),
        tp2:            p.actualTp2 != null ? p.actualTp2 : null,
        horizon:        modeCfg.horizon || 2,
        vwap_gate:      !!modeCfg.vwapGate,
        partial_tp:     partialTpEnabled,
        partial_tp_pct: modeCfg.partialTPPct || 0,
        client_id:      clientId(mode, p.ticker, p.entryDate),
        // Carry-forward: a position articles already partially exited (TP1 fired, stop raised).
        partial_fired:  partialFired,
        partial_qty:    partialFired ? (p.weight * initialEquity / p.entryPrice) * (modeCfg.partialTPPct || 0) : 0,
        current_stop:   p.currentStop != null ? p.currentStop : p.actualStop,
      };
    });

  const equity_curve = (modeData.equityCurve || [])
    .filter(pt => pt.date && pt.value != null)
    .map(pt => ({ date: pt.date, value: pt.value }));

  return { initial_equity: initialEquity, closed_trades, open_positions, equity_curve };
}

// ── main ─────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg  = loadConfig();
  const pilotModes = cfg.pilotModes || ['turbo', 'dynamic', 'balanced', 'bull', 'secured'];
  const initialEquity = cfg.initialEquity || 100000;

  const pit    = loadJSON('data/pit-state.json');
  const modesCfg = loadJSON('data/modes-config.json').modes || {};
  const modes  = pit.modes || {};

  const targetModes = (args.mode ? [args.mode] : pilotModes)
    .filter(m => pilotModes.includes(m));

  const client = args.dryRun ? null : new SimulatorClient();

  for (const mode of targetModes) {
    const modeData = modes[mode];
    if (!modeData) { console.log(`  ${mode}: no pit-state entry — skip`); continue; }

    const payload = buildPayload(mode, modeData, modesCfg[mode] || {}, initialEquity);
    const counts = `closed=${payload.closed_trades.length} open=${payload.open_positions.length} equity=${payload.equity_curve.length}`;

    if (args.dryRun) {
      console.log(`[DRY] ${mode} (${counts}):`);
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }

    try {
      const accountId = await client.resolveAccountId(mode);
      const res = await client.backfill(accountId, payload);
      const applied = res && res.applied === false ? `skipped (${res.reason || 'already_backfilled'})` : 'applied';
      console.log(`  ${mode}: ${applied} ${counts} -> account ${accountId}`);
    } catch (e) {
      console.error(`  ${mode}: ERROR ${e.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
