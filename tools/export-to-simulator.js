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
 *   node tools/export-to-simulator.js                 # backfill all pilot modes (force)
 *   node tools/export-to-simulator.js --mode dynamic  # one mode only
 *   node tools/export-to-simulator.js --dry-run       # print payloads, no POST
 *   node tools/export-to-simulator.js --sync          # BOOTSTRAP-ONCE: backfill a mode ONLY
 *                                                     # if its mirror account has no fills yet
 *                                                     # AND pit-state has data for it. Non-blocking.
 *
 * --sync is the nightly auto-onboard step: it seeds each mode's frozen history exactly once,
 * the first night a mirror:<mode> account exists with pit-state data. Once the account has any
 * fill (the backfill wrote them, or the forward mirror-run did), it is skipped forever — the
 * forward loop (mirror-order + mirror-run) now owns the open positions, so re-importing would
 * fight it. Any sim/token/network problem is swallowed (exit 0) so it never aborts the nightly.
 *
 * Env: BROKERSIM_SERVICE_TOKEN (service token; never hardcoded).
 */

const fs   = require('fs');
const path = require('path');
const { SimulatorClient, loadConfig } = require('./lib/simulator-client');

const ROOT = path.join(__dirname, '..');

// ── tiny CLI parser ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { dryRun: false, mode: null, sync: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--sync') out.sync = true;
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
    if (!modeData) {
      // --sync: a mode with no pit-state data yet is simply not ready to onboard — quiet skip.
      console.log(`  ${mode}: no pit-state entry — skip`);
      continue;
    }

    const payload = buildPayload(mode, modeData, modesCfg[mode] || {}, initialEquity);
    const counts = `closed=${payload.closed_trades.length} open=${payload.open_positions.length} equity=${payload.equity_curve.length}`;

    if (args.dryRun) {
      console.log(`[DRY] ${mode} (${counts}):`);
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }

    try {
      const accountId = await client.resolveAccountId(mode);

      // ── BOOTSTRAP-ONCE gate (--sync) ───────────────────────────────────────────
      // Seed the frozen history only if the account has been seeded with NOTHING yet — no
      // fill AND no position. As soon as it has either — a fill from a prior backfill/closed
      // trade OR an open position seeded by the backfill / opened by a forward mirror-run —
      // the forward loop owns the open positions and we must NOT re-import them. (The server
      // gate alone is insufficient for open-only modes: it keys on sim.orders, which open
      // positions never write — see fix note below.)
      if (args.sync) {
        // "Already bootstrapped" must be detected from ANY persisted seed, not just fills.
        // The server writes fills ONLY for closed trades (backfill.go:181-189 via backfillLeg);
        // an OPEN position seeds a sim.positions row + a sim.mirror_orders row and NO fill
        // (confirmed backfill_test.go "open position has no backfill fill"). So an open-only mode
        // (the normal early state — positions open before any close) has 0 fills, and a fills-only
        // gate would RE-import it every night, clobbering the forward-managed qty/stop. Detect the
        // seeded POSITION too. A read error on either source skips the bootstrap (stay safe).
        let fills = [], positions = [];
        try { fills = await client.listFills(accountId, 1); } catch (fe) {
          console.warn(`  ${mode}: cannot read fills (${fe.message}) — skip bootstrap`);
          continue;
        }
        try { positions = await client.listPositions(accountId); } catch (pe) {
          console.warn(`  ${mode}: cannot read positions (${pe.message}) — skip bootstrap`);
          continue;
        }
        const fillCount = Array.isArray(fills) ? fills.length : 0;
        const posCount  = Array.isArray(positions) ? positions.length : 0;
        if (fillCount > 0 || posCount > 0) {
          console.log(`  ${mode}: already bootstrapped (${fillCount} fill(s), ${posCount} position(s)) — skip`);
          continue;
        }
        if (payload.closed_trades.length === 0 && payload.open_positions.length === 0 && payload.equity_curve.length === 0) {
          console.log(`  ${mode}: pit-state empty for this mode — nothing to bootstrap`);
          continue;
        }
        const res = await client.backfill(accountId, payload);
        const applied = res && res.applied === false ? `skipped (${res.reason || 'already_backfilled'})` : 'BOOTSTRAPPED';
        console.log(`  ${mode}: ${applied} ${counts} -> account ${accountId}`);
        continue;
      }

      const res = await client.backfill(accountId, payload);
      const applied = res && res.applied === false ? `skipped (${res.reason || 'already_backfilled'})` : 'applied';
      console.log(`  ${mode}: ${applied} ${counts} -> account ${accountId}`);
    } catch (e) {
      console.error(`  ${mode}: ERROR ${e.message}`);
      // --sync must never break the nightly: a per-mode failure is logged, not fatal.
      if (!args.sync) process.exitCode = 1;
    }
  }
}

// --sync is non-blocking by contract: a missing token / config / network must exit 0 so the
// nightly continues. A plain (force) run keeps its exit-1-on-error behaviour for manual use.
main().catch(e => {
  if (process.argv.slice(2).includes('--sync')) {
    console.error(`export-to-simulator --sync disabled: ${e.message}`);
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
