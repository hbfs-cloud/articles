#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METRICS_FILE = path.join(ROOT, 'data', 'scanner-metrics.json');
const POSITIONS_FILE = path.join(ROOT, 'data', 'scanner-positions.json');
const SCANNER_DIR = path.join(ROOT, 'scanner');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function fetchPrice(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
          resolve(price);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

function parseMidpoint(entryStr) {
  if (!entryStr) return null;
  const nums = String(entryStr).replace(/[$,]/g, '').match(/[\d.]+/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return vals.length >= 2 ? (vals[0] + vals[1]) / 2 : vals[0];
}

function parseNumber(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

// ─── Extract top3 from scan HTML ─────────────────────────────────────────────

function extractTop3FromHTML(htmlPath) {
  if (!fs.existsSync(htmlPath)) return [];
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Try Synthesis table first: look for rows with ticker+score+entry+stop+tp1
  // Pattern: <td>TICKER</td> ... score ... entry ... stop ... tp1
  const trades = [];

  // Strategy 1: parse the synthesis table rows
  // The table has pattern: rank ticker strategy region score entry stop tp1 rr
  // Using a broad regex to find setup blocks
  const synthMatch = html.match(/id="synthese"[\s\S]*?<\/section>/i) ||
                     html.match(/id="synthese"[\s\S]{0,20000}/i);

  if (synthMatch) {
    const synthHtml = synthMatch[0];
    // Find table rows with ticker data
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    const rows = synthHtml.match(rowRe) || [];
    for (const row of rows) {
      const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
        .map(c => c.replace(/<[^>]+>/g, '').replace(/,/g, '.').trim());
      if (cells.length < 4) continue;
      const ticker = cells.find(c => /^[A-Z]{1,5}$/.test(c.trim()));
      if (!ticker) continue;
      const score = cells.map(c => parseFloat(c)).find(n => n >= 70 && n <= 100);
      // Price fields: cells starting with $ followed by digits
      const priceFields = cells.filter(c => /^\$[\d.]/.test(c.trim()));
      
      // Strategy extraction
      const stratMap = ['Momentum', 'Breakout', 'Squeeze', 'Pullback', 'Reversal'];
      const strategy = cells.find(c => stratMap.some(s => c.includes(s))) || 'Momentum';

      if (priceFields.length >= 4) {
        // Full format: entry | stop | tp1 | tp2
        trades.push({ ticker: ticker.trim(), score: score||85, strategy,
          entry_str: priceFields[0], stop_str: priceFields[1],
          tp1_str: priceFields[2], tp2_str: priceFields[3] });
      } else if (priceFields.length === 3) {
        // entry | stop | tp1 (no tp2)
        trades.push({ ticker: ticker.trim(), score: score||85, strategy,
          entry_str: priceFields[0], stop_str: priceFields[1],
          tp1_str: priceFields[2], tp2_str: null });
      }
      // Skip rows with only 2 price fields (entry+tp1, no stop) — untrackable
    }
  }

  // Strategy 2: parse setup cards if synthesis didn't yield results
  if (trades.length === 0) {
    const setupRe = /id="setup-([A-Z0-9]+)"[\s\S]*?(?=id="setup-|id="synthese"|id="performance"|$)/gi;
    let m;
    while ((m = setupRe.exec(html)) !== null && trades.length < 10) {
      const ticker = m[1];
      const block = m[0];

      // Extract score from gauge
      const scoreMatch = block.match(/["']score["'][\s\S]{0,200}?([\d]{2,3})/i) ||
                         block.match(/Score[\s\S]{0,100}?(9[0-9]|8[5-9]|7[0-9])/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 85;

      // Extract levels
      const entryM = block.match(/[Ee]ntr[eé][e]?[\s\S]{0,50}\$([\d.,–\-]+)/);
      const stopM  = block.match(/[Ss]top[\s\S]{0,50}\$([\d.,]+)/);
      const tp1M   = block.match(/[Tt]arget\s*1[\s\S]{0,50}\$([\d.,]+)/);
      const tp2M   = block.match(/[Tt]arget\s*2[\s\S]{0,50}\$([\d.,]+)/);
      const horizM = block.match(/[Hh]orizon[\s\S]{0,50}(\d+)[–\-](\d+)\s*[jd]/);

      if (entryM && stopM && tp1M) {
        trades.push({
          ticker,
          score,
          entry_str: entryM[1],
          stop_str: stopM[1],
          tp1_str: tp1M[1],
          tp2_str: tp2M ? tp2M[1] : null,
          horizon_max: horizM ? parseInt(horizM[2]) : 20,
        });
      }
    }
  }

  // Return top 3 by score
  return trades
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(t => ({
      ticker: t.ticker,
      score: t.score,
      entry: parseMidpoint(t.entry_str),
      stop: parseNumber(t.stop_str),
      tp1: parseNumber(t.tp1_str),
      tp2: parseNumber(t.tp2_str),
      horizon_days: t.horizon_max || 20,
    }));
}

// ─── Yahoo ticker mapping ─────────────────────────────────────────────────────

const YAHOO_MAP = {
  TTE: 'TTE.PA', BBVA: 'BBVA', ESLT: 'ESLT', SAP: 'SAP',
  TTE: 'TTE', // ADR also works
  ASML: 'ASML', ARGX: 'ARGX', EQNR: 'EQNR', TTE: 'TTE',
};
function yahooTicker(t) {
  return YAHOO_MAP[t] || t;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // Get all scan dirs (YYYYMMDD, not retrospective)
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d))
    .filter(d => {
      const dateStr = d.slice(0, 8);
      const scanDate = new Date(dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8));
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 35);
      return scanDate >= cutoff;
    })
    .sort();

  console.log(`Found ${scanDirs.length} scan dirs:`, scanDirs);

  // Build all trades from HTMLs
  const allTrades = [];
  for (const dir of scanDirs) {
    const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
    const dateStr = dir.slice(0, 8);
    const scanDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;

    const top3 = extractTop3FromHTML(htmlPath);
    if (top3.length === 0) {
      console.log(`  [${dir}] No trades extracted`);
      continue;
    }
    console.log(`  [${dir}] Extracted:`, top3.map(t => t.ticker).join(', '));

    for (let i = 0; i < top3.length; i++) {
      const t = top3[i];
      const expireDate = addBusinessDays(scanDate, t.horizon_days || 20);
      allTrades.push({
        id: `${dir}-${t.ticker}-${i+1}`,
        scan_date: scanDate,
        scan: dir,
        rank: i + 1,
        ticker: t.ticker,
        ticker_yahoo: yahooTicker(t.ticker),
        strategy: t.strategy || 'Momentum',
        chart_url: `https://finviz.com/chart.ashx?t=${t.ticker}&ty=c&ta=1&p=d&s=l`,
        entry: t.entry,
        stop: t.stop,
        tp1: t.tp1,
        tp2: t.tp2,
        horizon_days: t.horizon_days || 20,
        expire_date: expireDate,
        status: 'open',
        current_price: null,
        exit_price: null,
        exit_date: null,
        pnl_pct: null,
      });
    }
  }

  console.log(`\nTotal trades: ${allTrades.length}`);

  // Fetch current prices
  const tickers = [...new Set(allTrades.map(t => t.ticker_yahoo))];
  console.log(`\nFetching prices for: ${tickers.join(', ')}`);
  const prices = {};
  for (const tkr of tickers) {
    prices[tkr] = await fetchPrice(tkr);
    console.log(`  ${tkr}: ${prices[tkr]}`);
  }

  // Determine status for each trade
  for (const trade of allTrades) {
    const price = prices[trade.ticker_yahoo];
    trade.current_price = price;

    if (price == null) continue;
    if (!trade.entry || !trade.stop || !trade.tp1) continue;

    const expired = today > trade.expire_date;

    if (price <= trade.stop) {
      trade.status = 'sl';
      trade.exit_price = trade.stop;
      trade.exit_date = today;
      trade.pnl_pct = +((trade.stop - trade.entry) / trade.entry * 100).toFixed(2);
    } else if (trade.tp2 && price >= trade.tp2) {
      trade.status = 'tp2';
      trade.exit_price = trade.tp2;
      trade.exit_date = today;
      trade.pnl_pct = +((trade.tp2 - trade.entry) / trade.entry * 100).toFixed(2);
    } else if (price >= trade.tp1) {
      trade.status = 'tp1';
      trade.exit_price = trade.tp1;
      trade.exit_date = today;
      trade.pnl_pct = +((trade.tp1 - trade.entry) / trade.entry * 100).toFixed(2);
    } else if (expired) {
      trade.status = 'expired';
      trade.exit_price = price;
      trade.exit_date = today;
      trade.pnl_pct = +((price - trade.entry) / trade.entry * 100).toFixed(2);
    } else {
      trade.status = 'open';
      trade.pnl_pct = +((price - trade.entry) / trade.entry * 100).toFixed(2);
    }
  }

  // ── Metrics ──
  const closed = allTrades.filter(t => ['tp1','tp2','sl','expired'].includes(t.status));
  const open   = allTrades.filter(t => t.status === 'open');
  const tp1c   = allTrades.filter(t => t.status === 'tp1').length;
  const tp2c   = allTrades.filter(t => t.status === 'tp2').length;
  const slc    = allTrades.filter(t => t.status === 'sl').length;
  const expc   = allTrades.filter(t => t.status === 'expired').length;
  const wins   = closed.filter(t => ['tp1','tp2'].includes(t.status));
  const losses = closed.filter(t => ['sl','expired'].includes(t.status) && t.pnl_pct < 0);

  const FRACTION = 1/30;
  const cutoff30 = new Date(today); cutoff30.setDate(cutoff30.getDate() - 30);
  const closed30 = closed.filter(t => t.exit_date && new Date(t.exit_date) >= cutoff30);
  // return_30d = weighted portfolio return: each trade contributes pnl_pct * (1/30)
  // But pnl_pct is already in % (e.g. 8.5 means +8.5%), so portfolio return in % = sum(pnl_pct * 1/30)
  // return_30d = closed P&L + open MtM (positions ouvertes comptent au prix actuel)
  const open30 = open.filter(t => t.scan_date && new Date(t.scan_date) >= cutoff30);
  const return30d = +(
    closed30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0) +
    open30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0)
  ).toFixed(2);

  // return_30d_closed_only = pour référence (stats partielles)
  const return30d_closed = +closed30.reduce((s, t) => s + (t.pnl_pct || 0) / 30, 0).toFixed(2);

  // Max drawdown — sur tous trades (closed + open MtM), triés par date d'entrée
  const allSorted = [...allTrades]
    .filter(t => t.scan_date && t.pnl_pct != null)
    .sort((a,b) => a.scan_date.localeCompare(b.scan_date));
  let running = 0, peak = 0, maxDD = 0;
  for (const t of allSorted) {
    running += (t.pnl_pct || 0) * FRACTION;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  // Capital allocation
  const entered = open.filter(t => t.current_price && t.entry && t.current_price >= t.entry * 0.98);
  const pending = open.filter(t => t.current_price && t.entry && t.current_price < t.entry * 0.98);
  const workingCapitalPct = +Math.min(100, +(entered.length * FRACTION * 100).toFixed(1));
  const pendingOrdersPct  = +Math.min(100 - workingCapitalPct, +(pending.length * FRACTION * 100).toFixed(1));
  const availableCashPct  = +Math.max(0, 100 - workingCapitalPct - pendingOrdersPct).toFixed(1);

  // ── Return total depuis D0 (all trades, not just 30d) ──
  const returnTotal = +(allSorted.reduce((s, t) => s + (t.pnl_pct || 0) * FRACTION, 0)).toFixed(2);

  // ── Profit Factor ──
  const grossWins = closed.filter(t => t.pnl_pct > 0).reduce((s, t) => s + t.pnl_pct, 0);
  const grossLosses = Math.abs(closed.filter(t => t.pnl_pct < 0).reduce((s, t) => s + t.pnl_pct, 0));
  const profitFactor = grossLosses > 0 ? +(grossWins / grossLosses).toFixed(1) : (grossWins > 0 ? 99 : 0);

  // ── Total days and scans count ──
  const scanDates = [...new Set(allTrades.map(t => t.scan_date).filter(Boolean))].sort();
  const scansCount = scanDates.length;
  const firstScan = scanDates[0] || '2026-02-15';
  const totalDays = Math.round((new Date(today) - new Date(firstScan)) / 86400000);

  // ── Return / DD ratio ──
  const returnDDRatio = maxDD > 0 ? +(returnTotal / maxDD).toFixed(1) : (returnTotal > 0 ? 99 : 0);

  // ── Portfolio history (cumulative return curve) ──
  const portfolioHistory = [0];
  const drawdownHistory = [0];
  let cumReturn = 0, cumPeak = 0;
  for (const t of allSorted) {
    cumReturn += (t.pnl_pct || 0) * FRACTION;
    if (cumReturn > cumPeak) cumPeak = cumReturn;
    const dd = cumPeak - cumReturn;
    portfolioHistory.push(+cumReturn.toFixed(2));
    drawdownHistory.push(+(-dd).toFixed(2));
  }

  const metrics = {
    updated_at: new Date().toISOString(),
    trades_total: allTrades.length,
    trades_closed: closed.length,
    trades_open: open.length,
    win_rate: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : 0,
    tp1_count: tp1c,
    tp2_count: tp2c,
    sl_count: slc,
    expired_count: expc,
    return_30d: return30d,
    return_30d_closed_only: return30d_closed,
    return_total: returnTotal,
    max_drawdown: +(-maxDD).toFixed(2),
    profit_factor: profitFactor,
    avg_win_pct: wins.length ? +(wins.reduce((s,t)=>s+(t.pnl_pct||0),0)/wins.length).toFixed(2) : 0,
    avg_loss_pct: losses.length ? +(losses.reduce((s,t)=>s+(t.pnl_pct||0),0)/losses.length).toFixed(2) : 0,
    working_capital_pct: workingCapitalPct,
    pending_orders_pct: pendingOrdersPct,
    available_cash_pct: availableCashPct,
    total_days: totalDays,
    scans_count: scansCount,
    return_dd_ratio: returnDDRatio,
    portfolio_history: portfolioHistory,
    drawdown_history: drawdownHistory,
  };

  // ── Positions ──
  const positions = open
    .filter(t => t.current_price && t.entry)
    .map(t => {
      const ret = +((t.current_price - t.entry) / t.entry * 100).toFixed(2);
      const daysLeft = Math.max(0, Math.ceil((new Date(t.expire_date) - new Date(today)) / 86400000));
      const toTP1 = t.tp1 ? +((t.tp1 - t.current_price) / t.current_price * 100).toFixed(1) : null;
      const toSL  = t.stop ? +((t.current_price - t.stop) / t.current_price * 100).toFixed(1) : null;
      let signal, status_label;
      if (ret >= 5)          { signal = 'green';  status_label = '🟢 En route TP1'; }
      else if (ret >= 2)     { signal = 'green';  status_label = '🟢 Positif'; }
      else if (toTP1 && toTP1 < 3) { signal = 'green'; status_label = '🎯 TP1 proche'; }
      else if (toSL && toSL < 3)   { signal = 'red';   status_label = '🔴 Vers SL'; }
      else if (ret < -2)     { signal = 'red';    status_label = '🔴 Sous eau'; }
      else                   { signal = 'yellow'; status_label = '🟡 Neutre'; }
      return {
        id: t.id, ticker: t.ticker, scan_date: t.scan_date,
        entry: t.entry, current_price: t.current_price,
        return_pct: ret, stop: t.stop, tp1: t.tp1, tp2: t.tp2,
        days_remaining: daysLeft, expire_date: t.expire_date,
        strategy: t.strategy,
        chart_url: t.chart_url, signal, status_label,
        to_tp1_pct: toTP1, to_sl_pct: toSL,
        progress_pct: t.tp1 && t.stop ? +Math.min(100,Math.max(0,(t.current_price-t.stop)/(t.tp1-t.stop)*100)).toFixed(0) : 0,
      };
    })
    .sort((a, b) => b.return_pct - a.return_pct);

  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify({ updated_at: metrics.updated_at, open_positions: positions }, null, 2));

  console.log('\n✅ scanner-metrics.json:', metrics);
  console.log(`✅ scanner-positions.json: ${positions.length} open positions`);
}

main().catch(console.error);
