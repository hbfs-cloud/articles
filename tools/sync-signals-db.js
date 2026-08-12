#!/usr/bin/env node
'use strict';

/**
 * sync-signals-db.js — Push daily articles scanner output to analytics DB.
 *
 * Reads scanner/status/history/<YYYYMMDD>.json and upserts:
 *   - mart.fact_strategy_action   (signals → BUY, closedTrades → SELL)
 *   - mart.fact_strategy_position (open positions)
 *   - mart.fact_strategy_equity   (equity curve, last point only)
 *
 * Usage:
 *   node tools/sync-signals-db.js               # today's scan
 *   node tools/sync-signals-db.js 20260520      # specific date
 *   node tools/sync-signals-db.js --dry-run     # print rows, no DB write
 *
 * Env: ANALYTICS_DB_URL (postgresql://user:pass@host:port/db)
 */

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT        = path.join(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'scanner', 'status', 'history');
const DRY_RUN     = process.argv.includes('--dry-run');

const MODE_PREFIX = 'articles-';

// ── helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadScan(dateStr) {
  const file = path.join(HISTORY_DIR, `${dateStr}.json`);
  if (!fs.existsSync(file)) throw new Error(`Scan file not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseFloat2(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ticker_key lookup cache: symbol → uuid
const tickerKeyCache = {};
async function getTickerKey(client, symbol) {
  if (tickerKeyCache[symbol] !== undefined) return tickerKeyCache[symbol];
  const res = await client.query(
    `SELECT ticker_key FROM mart.dim_ticker WHERE symbol = $1 AND is_current = TRUE LIMIT 1`,
    [symbol]
  );
  const key = res.rows[0]?.ticker_key ?? null;
  tickerKeyCache[symbol] = key;
  return key;
}

// ── sync one mode ─────────────────────────────────────────────────────────────

async function syncMode(client, scanDate, modeName, modeData) {
  const strategyId = MODE_PREFIX + modeName;
  const runTs      = new Date(`${scanDate.slice(0,4)}-${scanDate.slice(4,6)}-${scanDate.slice(6,8)}T16:00:00Z`);

  // 1. BUY signals (scanner candidates for today)
  const signals = modeData.signals || [];
  for (const sig of signals) {
    const tickerKey = await getTickerKey(client, sig.ticker);
    if (!tickerKey) continue;
    const row = {
      strategy_id:    strategyId,
      run_ts:         runTs,
      ticker_key:     tickerKey,
      action_type:    'BUY',
      reason:         sig.strategy || null,
      target_price:   parseFloat2(sig.entry),
      target_shares:  null,
      score:          sig.score != null ? parseFloat2(sig.score) : null,
      context_snap:   JSON.stringify({
        stop: sig.stop, tp1: sig.tp1, tp2: sig.tp2,
        rr: sig.rr, thesis: sig.thesis,
      }),
      executed:       false,
    };
    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO mart.fact_strategy_action
          (strategy_id, run_ts, ticker_key, action_type, reason,
           target_price, target_shares, score, context_snap, executed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
        ON CONFLICT DO NOTHING
      `, [row.strategy_id, row.run_ts, row.ticker_key, row.action_type,
          row.reason, row.target_price, row.target_shares, row.score,
          row.context_snap, row.executed]);
    } else {
      console.log(`[DRY] BUY ${strategyId} ${sig.ticker} @${sig.entry} score=${sig.score}`);
    }
  }

  // 2. SELL — closed trades today
  const closed = modeData.closedTrades || [];
  for (const trade of closed) {
    if (!trade.exitDate) continue;
    const exitDate = new Date(trade.exitDate + 'T16:00:00Z');
    if (exitDate.toISOString().slice(0,8).replace(/-/g,'') !== scanDate) continue;
    const tickerKey = await getTickerKey(client, trade.ticker);
    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO mart.fact_strategy_action
          (strategy_id, run_ts, ticker_key, action_type, reason,
           target_price, score, context_snap, executed)
        VALUES ($1,$2,$3,'SELL',$4,$5,null,$6::jsonb,true)
        ON CONFLICT DO NOTHING
      `, [strategyId, exitDate, tickerKey,
          trade.exitReason || null,
          parseFloat2(trade.exitPrice),
          JSON.stringify({ entryPrice: trade.entryPrice, pnlPct: trade.pnlPct })]);
    } else {
      console.log(`[DRY] SELL ${strategyId} ${trade.ticker} reason=${trade.exitReason}`);
    }
  }

  // 3. Open positions snapshot
  const positions = modeData.positions || [];
  for (const pos of positions) {
    const tickerKey = await getTickerKey(client, pos.ticker);
    if (!tickerKey) continue;
    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO mart.fact_strategy_position
          (strategy_id, snapshot_ts, ticker_key, entry_date, entry_price,
           shares, stop_loss, take_profit, return_pct)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (strategy_id, snapshot_ts, ticker_key) DO UPDATE SET
          shares      = EXCLUDED.shares,
          stop_loss   = EXCLUDED.stop_loss,
          take_profit = EXCLUDED.take_profit,
          return_pct  = EXCLUDED.return_pct
      `, [strategyId, runTs, tickerKey,
          pos.scan_date ? new Date(pos.scan_date) : null,
          parseFloat2(pos.entry),
          parseFloat2(pos.shares) || 1,
          parseFloat2(pos.stop),
          pos.tp1 ? parseFloat2(pos.tp1) : null,
          parseFloat2(pos.return_pct)]);
    } else {
      console.log(`[DRY] POS ${strategyId} ${pos.ticker} entry=${pos.entryPrice}`);
    }
  }

  // 4. Equity — push last point of the curve
  const equity = modeData.equity;
  if (equity?.d?.length && equity?.v?.length) {
    const lastDate  = equity.d[equity.d.length - 1];
    const lastValue = equity.v[equity.v.length - 1];
    // Deux étiquetages : "MM/DD" (modes scanner) et "YYYY-MM-DD" (modes moteur/dtx, courbe
    // multi-années). Préfixer une étiquette déjà ISO produisait "2026-2026-08-12" → Invalid Date.
    const _iso = (String(lastDate).length === 10 && lastDate.includes('-'))
      ? lastDate
      : `2026-${String(lastDate).split('/').join('-')}`;
    const ts = new Date(`${_iso}T16:00:00Z`);
    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO mart.fact_strategy_equity (strategy_id, ts, equity, num_positions)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (strategy_id, ts) DO UPDATE SET
          equity = EXCLUDED.equity, num_positions = EXCLUDED.num_positions
      `, [strategyId, ts, lastValue, positions.length]);
    } else {
      console.log(`[DRY] EQ  ${strategyId} ${lastDate}=${lastValue}`);
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dateArg = process.argv.find(a => /^\d{8}$/.test(a)) || todayStr();
  console.log(`sync-signals-db: date=${dateArg} dry=${DRY_RUN}`);

  const scan  = loadScan(dateArg);
  const modes = scan.modes || {};

  const client = new Client({ connectionString: process.env.ANALYTICS_DB_URL });
  await client.connect();

  try {
    for (const [modeName, modeData] of Object.entries(modes)) {
      await syncMode(client, dateArg, modeName, modeData);
      console.log(`  ${modeName}: ok`);
    }
  } finally {
    if (!DRY_RUN) await client.end();
  }
  console.log('done.');
}

main().catch(e => { console.error(e); process.exit(1); });
