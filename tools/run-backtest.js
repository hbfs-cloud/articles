#!/usr/bin/env node
'use strict';

/**
 * Backtest complet du scanner Market Watch depuis D0 (2026-02-15)
 * 
 * Flux:
 * 1. Parse tous les scans HTML → setups
 * 2. Fetch prix historiques Yahoo Finance (open + close)
 * 3. Simulation réaliste: entry = open J+1 après scan
 * 4. Grid search: N positions × stratégie filter × rotation × stop type
 * 5. Save data/backtest-results.json + data/portfolio-history.json
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const DATA_DIR = path.join(ROOT, 'data');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/&\#\d+;/gi, ' ').trim();
}

function parsePrice(s) {
  if (!s) return null;
  const clean = String(s).replace(/[$,\s]/g, '').replace(/&ndash;/g, '-').replace(/–/g, '-').replace(/\s+/g, '');
  // Range like "430-435" or "$90 – $93"
  const nums = clean.match(/[\d.]+/g);
  if (!nums || nums.length === 0) return null;
  const vals = nums.map(Number).filter(n => n > 0);
  if (vals.length === 0) return null;
  if (vals.length >= 2) return (vals[0] + vals[1]) / 2;
  return vals[0];
}

function parseHorizon(s) {
  if (!s) return 15;
  const nums = String(s).match(/\d+/g);
  if (!nums) return 15;
  const vals = nums.map(Number);
  if (vals.length >= 2) return Math.round((vals[0] + vals[1]) / 2);
  return vals[0] || 15;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function addCalendarDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function nextBusinessDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return toDateStr(d);
}

function businessDaysBetween(startStr, endStr) {
  let d = new Date(startStr + 'T12:00:00Z');
  const end = new Date(endStr + 'T12:00:00Z');
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

// ─── 1. Parse scan HTML ───────────────────────────────────────────────────────

function parseScannerDir(dirName) {
  const htmlPath = path.join(SCANNER_DIR, dirName, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;

  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract date from dir name (handle 20260310-2300 → 2026-03-10)
  const dateMatch = dirName.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dateMatch) return null;
  const scanDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  // Extract regime
  let regime = 'Unknown';
  const regimePatterns = [
    /Risk-Off\b/i,
    /Risk-On\b/i,
    /Early Risk-Off/i,
    /Neutral/i,
    /Recovery/i,
  ];
  // Try meta description first
  const metaDesc = html.match(/<meta[^>]*description[^>]*content="([^"]+)"/i);
  if (metaDesc) {
    const desc = metaDesc[1];
    if (/Early Risk-Off/i.test(desc)) regime = 'Early Risk-Off';
    else if (/Risk-Off/i.test(desc)) regime = 'Risk-Off';
    else if (/Risk-On/i.test(desc)) regime = 'Risk-On';
    else if (/Neutral/i.test(desc)) regime = 'Neutral';
    else if (/Recovery/i.test(desc)) regime = 'Recovery';
  }
  if (regime === 'Unknown') {
    // Look in HTML body
    const rgxMatch = html.match(/ticker-metric-value[^>]*>([^<]*(?:Risk-Off|Risk-On|Neutral|Recovery|Early Risk)[^<]*)</i);
    if (rgxMatch) {
      const t = rgxMatch[1].toLowerCase();
      if (t.includes('early risk-off')) regime = 'Early Risk-Off';
      else if (t.includes('risk-off')) regime = 'Risk-Off';
      else if (t.includes('risk-on')) regime = 'Risk-On';
      else if (t.includes('neutral')) regime = 'Neutral';
      else if (t.includes('recovery')) regime = 'Recovery';
    }
  }
  if (regime === 'Unknown') {
    if (/early risk-off/i.test(html)) regime = 'Early Risk-Off';
    else if (/risk-off/i.test(html)) regime = 'Risk-Off';
    else if (/risk-on/i.test(html)) regime = 'Risk-On';
    else if (/neutral/i.test(html)) regime = 'Neutral';
    else if (/recovery/i.test(html)) regime = 'Recovery';
  }

  const setups = [];

  // ── Format A: Old (20260215) – trade-level trade-entry/trade-stop/trade-tp blocks ──
  // Setup card: div id="TICKER" class="setup-card"
  // Score: sf-value (first one with style color)
  // Strategy: badge text
  // Levels: in trade-levels div

  // ── Format B: Medium (20260217) – strong tags: "Stop Loss :", "Target 1 :", "Target 2 :", "Horizon :"
  // Setup: div id="setup-TICKER"

  // ── Format C: New (20260219+) – level-item with lbl/val

  // Try to find all setup cards
  // Common pattern: id="setup-TICKER" or id="TICKER" class="setup-card"
  const setupCardRe = /<div[^>]+(?:id="(setup-([A-Z0-9.^-]{1,10}))"[^>]*class="setup-card"|class="setup-card"[^>]*id="(setup-([A-Z0-9.^-]{1,10}))")|<div[^>]+id="([A-Z]{1,10})"[^>]*class="setup-card"|<div[^>]+class="setup-card"[^>]*id="([A-Z]{1,10})"/gi;
  
  // Let's do a simpler approach: split by setup-card div, then extract ticker
  // Split the HTML into setup blocks
  const parts = html.split(/(?=<div[^>]+class="setup-card")/i);
  
  for (const part of parts.slice(1)) { // skip first part (before first card)
    // Extract ticker from id
    let ticker = null;
    const idMatch = part.match(/id="(?:setup-)?([A-Z0-9.]{1,10})"/i);
    if (idMatch) {
      const candidate = idMatch[1].toUpperCase();
      // Filter out non-ticker IDs
      if (candidate.length >= 1 && candidate.length <= 10 && 
          !['SETUP', 'SYNTHESE', 'REGIME', 'METHODO', 'DISCLAIMER'].includes(candidate)) {
        ticker = candidate;
      }
    }
    
    // Alternate: look for h3 ticker
    if (!ticker) {
      const h3Match = part.match(/<h3[^>]*>([A-Z]{1,10})\s*(?:&mdash;|\-|<)/);
      if (h3Match) ticker = h3Match[1];
    }
    
    if (!ticker) continue;
    if (ticker.length < 1 || ticker.length > 10) continue;

    // Extract score (composite)
    let score = 80;
    const scoreMatch = part.match(/sf-value"[^>]*style="[^"]*color[^"]*"[^>]*>(\d+)</i) ||
                       part.match(/sf-value"[^>]*>(\d+)</i);
    if (scoreMatch) score = parseInt(scoreMatch[1]);
    
    // Also check gauge chart data
    const gaugeMatch = part.match(/score['":\s]*(\d{2,3})/i);
    if (!scoreMatch && gaugeMatch) score = parseInt(gaugeMatch[1]);

    // Extract strategy from badges
    let strategy = 'momentum';
    const badgeTexts = [];
    const badgeRe = /class="badge[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    let bm;
    while ((bm = badgeRe.exec(part)) !== null) {
      badgeTexts.push(stripHtml(bm[1]).toLowerCase());
    }
    const badgeStr = badgeTexts.join(' ');
    
    if (/short.?squeeze/i.test(badgeStr)) strategy = 'short_squeeze';
    else if (/pre.?squeeze/i.test(badgeStr)) strategy = 'pre_squeeze';
    else if (/breakout.?squeeze/i.test(badgeStr)) strategy = 'breakout_squeeze';
    else if (/breakout/i.test(badgeStr)) strategy = 'breakout';
    else if (/momentum/i.test(badgeStr)) strategy = 'momentum';
    else if (/pullback/i.test(badgeStr)) strategy = 'pullback';
    else if (/reversal/i.test(badgeStr)) strategy = 'reversal';
    else if (/pre.?squeeze/i.test(part)) strategy = 'pre_squeeze';
    else if (/short.?squeeze/i.test(part)) strategy = 'short_squeeze';
    else if (/breakout/i.test(part.slice(0, 1000))) strategy = 'breakout';
    else if (/momentum/i.test(part.slice(0, 1000))) strategy = 'momentum';
    
    // Also check strategy from setup-name div
    const setupNameMatch = part.match(/setup-name"[^>]*>([\s\S]{0,200}?)<\/div>/i);
    if (setupNameMatch) {
      const sn = setupNameMatch[1].toLowerCase();
      if (/short.?squeeze/i.test(sn)) strategy = 'short_squeeze';
      else if (/pre.?squeeze/i.test(sn)) strategy = 'pre_squeeze';
      else if (/breakout.?squeeze/i.test(sn)) strategy = 'breakout_squeeze';
      else if (/breakout/i.test(sn)) strategy = 'breakout';
      else if (/momentum/i.test(sn)) strategy = 'momentum';
    }

    // ── Parse levels ──

    let entry = null, stop = null, tp1 = null, tp2 = null, horizon = 15;

    // Format C: level-item with lbl/val
    const levelItems = [];
    const liRe = /class="level-item"[^>]*>([\s\S]*?)(?=class="level-item"|<\/div>\s*<\/div>|$)/gi;
    let liM;
    const levelSection = part.match(/class="levels-grid"[^>]*>([\s\S]*?)(?=<div class="setup-card"|<\/div>\s*<\/section>|$)/i);
    if (levelSection) {
      const ls = levelSection[0];
      const lblRe = /class="lbl"[^>]*>([\s\S]*?)<\/div>\s*<div class="val"[^>]*>([\s\S]*?)<\/div>/gi;
      let lm;
      while ((lm = lblRe.exec(ls)) !== null) {
        const lbl = stripHtml(lm[1]).toLowerCase();
        const val = stripHtml(lm[2]);
        if (/entry/i.test(lbl)) entry = parsePrice(val);
        else if (/stop/i.test(lbl)) stop = parsePrice(val);
        else if (/target.?1|tp.?1/i.test(lbl)) tp1 = parsePrice(val);
        else if (/target.?2|tp.?2/i.test(lbl)) tp2 = parsePrice(val);
        else if (/horizon/i.test(lbl)) horizon = parseHorizon(val);
      }
    }

    // Format B (20260217): strong tags
    if (!entry) {
      // Look for: <strong>Stop Loss :</strong> $221
      const stopMatch = part.match(/<strong>\s*Stop Loss\s*:?\s*<\/strong>\s*\$?([\d.,\s\-$]+)/i);
      const tp1Match = part.match(/<strong>\s*Target 1\s*:?\s*<\/strong>\s*\$?([\d.,\s\-$]+)/i);
      const tp2Match = part.match(/<strong>\s*Target 2\s*:?\s*<\/strong>\s*\$?([\d.,\s\-$]+)/i);
      const horizMatch = part.match(/<strong>\s*Horizon\s*:?\s*<\/strong>\s*([^<\n]{1,30})/i);
      const entMatch = part.match(/<strong>\s*(?:Entr[eé]e|Entry)\s*:?\s*<\/strong>\s*\$?([\d.,\s\-$]+)/i);
      
      if (stopMatch) stop = parsePrice(stopMatch[1]);
      if (tp1Match) tp1 = parsePrice(tp1Match[1]);
      if (tp2Match) tp2 = parsePrice(tp2Match[1]);
      if (horizMatch) horizon = parseHorizon(horizMatch[1]);
      if (entMatch) entry = parsePrice(entMatch[1]);
      
      // If still no entry, try data-entry attribute
      if (!entry) {
        const dataEntryMatch = part.match(/data-entry="([\d.]+)"/i);
        if (dataEntryMatch) entry = parseFloat(dataEntryMatch[1]);
      }
    }

    // Format A (20260215): trade-level divs
    if (!entry) {
      const tradeLevels = part.match(/<div class="trade-levels"[\s\S]*?<\/div>\s*<\/div>/i);
      if (tradeLevels) {
        const tl = tradeLevels[0];
        // Look for entry block
        const entryBlock = tl.match(/trade-entry[\s\S]*?class="value"[^>]*>([\s\S]*?)<\/div>/i);
        const stopBlock = tl.match(/trade-stop[\s\S]*?class="value"[^>]*>([\s\S]*?)<\/div>/i);
        const tp1Block = tl.match(/trade-tp[\s\S]*?class="value"[^>]*>([\s\S]*?)<\/div>/i);
        if (entryBlock) entry = parsePrice(stripHtml(entryBlock[1]));
        if (stopBlock) stop = parsePrice(stripHtml(stopBlock[1]));
        if (tp1Block) tp1 = parsePrice(stripHtml(tp1Block[1]));
      }
    }

    // Fallback: try data attributes on price div
    if (!entry) {
      const dataM = part.match(/data-entry="([\d.]+)"[^>]*data-stop="([\d.]+)"[^>]*data-tp1="([\d.]+)"[^>]*data-tp2="([\d.]+)"/i) ||
                    part.match(/data-ticker="[^"]*"[^>]*data-entry="([\d.]+)"[^>]*data-stop="([\d.]+)"[^>]*data-tp1="([\d.]+)"[^>]*data-tp2="([\d.]+)"/i);
      if (!dataM) {
        // Try individual data attrs
        const dEntry = part.match(/data-entry="([\d.]+)"/i);
        const dStop = part.match(/data-stop="([\d.]+)"/i);
        const dTp1 = part.match(/data-tp1="([\d.]+)"/i);
        const dTp2 = part.match(/data-tp2="([\d.]+)"/i);
        if (dEntry) entry = parseFloat(dEntry[1]);
        if (dStop) stop = parseFloat(dStop[1]);
        if (dTp1) tp1 = parseFloat(dTp1[1]);
        if (dTp2) tp2 = parseFloat(dTp2[1]);
      } else {
        entry = parseFloat(dataM[1]);
        stop = parseFloat(dataM[2]);
        tp1 = parseFloat(dataM[3]);
        tp2 = parseFloat(dataM[4]);
      }
    }
    
    // Skip if no useful price data
    if (!entry && !stop && !tp1) continue;
    
    // Infer missing levels
    if (!tp2 && tp1 && entry) {
      // tp2 = entry + 2*(tp1 - entry)
      tp2 = entry + 2 * (tp1 - entry);
    }
    if (!tp1 && tp2 && entry) {
      tp1 = entry + (tp2 - entry) * 0.5;
    }
    if (!stop && entry) {
      stop = entry * 0.95; // 5% default stop
    }
    if (!entry && stop && tp1) {
      entry = stop * 1.05; // infer from stop
    }

    setups.push({
      ticker,
      strategy,
      score,
      entry: entry ? Math.round(entry * 100) / 100 : null,
      stop: stop ? Math.round(stop * 100) / 100 : null,
      tp1: tp1 ? Math.round(tp1 * 100) / 100 : null,
      tp2: tp2 ? Math.round(tp2 * 100) / 100 : null,
      horizon_days: horizon,
    });
  }

  // Deduplicate (keep first occurrence)
  const seen = new Set();
  const uniqueSetups = setups.filter(s => {
    if (seen.has(s.ticker)) return false;
    seen.add(s.ticker);
    return true;
  });

  return {
    dir: dirName,
    date: scanDate,
    regime,
    setups: uniqueSetups.slice(0, 10),
  };
}

// ─── 2. Fetch Yahoo Finance history ──────────────────────────────────────────

function fetchYahooHistory(ticker) {
  return new Promise((resolve) => {
    // Use range=90d to cover from Feb 15 to now
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=90d`;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    };
    const req = https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (data.startsWith('Too Many')) { resolve(null); return; }
        try {
          const j = JSON.parse(data);
          const result = j?.chart?.result?.[0];
          if (!result) { resolve(null); return; }
          const timestamps = result.timestamp || [];
          const opens = result.indicators?.quote?.[0]?.open || [];
          const closes = result.indicators?.quote?.[0]?.close || [];
          const highs = result.indicators?.quote?.[0]?.high || [];
          const lows = result.indicators?.quote?.[0]?.low || [];
          
          const history = {};
          for (let i = 0; i < timestamps.length; i++) {
            const date = toDateStr(new Date(timestamps[i] * 1000));
            if (opens[i] != null || closes[i] != null) {
              history[date] = {
                open: opens[i] ? Math.round(opens[i] * 100) / 100 : null,
                close: closes[i] ? Math.round(closes[i] * 100) / 100 : null,
                high: highs[i] ? Math.round(highs[i] * 100) / 100 : null,
                low: lows[i] ? Math.round(lows[i] * 100) / 100 : null,
              };
            }
          }
          resolve(history);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    // socket timeout
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

// ─── 3. Simulate trade outcome ────────────────────────────────────────────────

function simulateTrade(setup, scanDate, priceHistory, stopType) {
  // entry_price = open of next business day after scan
  const entryDate = nextBusinessDay(scanDate);
  const priceData = priceHistory[setup.ticker];
  
  if (!priceData) return { status: 'price_unavailable', entry_price: null, exit_price: null, exit_date: null, pnl_pct: null, holding_days: null };
  
  const entryDayData = priceData[entryDate];
  if (!entryDayData || !entryDayData.open) {
    // Try to find nearest available date
    let d = new Date(entryDate + 'T12:00:00Z');
    let foundEntry = null;
    for (let i = 0; i < 5; i++) {
      d.setDate(d.getDate() + 1);
      const ds = toDateStr(d);
      if (priceData[ds] && priceData[ds].open) {
        foundEntry = { date: ds, price: priceData[ds].open };
        break;
      }
    }
    if (!foundEntry) return { status: 'price_unavailable', entry_price: null, exit_price: null, exit_date: null, pnl_pct: null, holding_days: null };
    return simulateTradeFromEntry(setup, foundEntry.date, foundEntry.price, priceData, stopType);
  }
  
  return simulateTradeFromEntry(setup, entryDate, entryDayData.open, priceData, stopType);
}

function simulateTradeFromEntry(setup, entryDate, entryPrice, priceData, stopType) {
  if (!entryPrice) return { status: 'price_unavailable', entry_price: null, exit_price: null, exit_date: null, pnl_pct: null, holding_days: null };
  
  // Adjust stop/tp by ratio relative to entry (since entry might differ from midpoint)
  const ratio = entryPrice / setup.entry;
  const adjStop = setup.stop * ratio;
  const adjTp1 = setup.tp1 * ratio;
  const adjTp2 = setup.tp2 ? setup.tp2 * ratio : null;
  
  let tp1Hit = false;
  const maxHoldingDays = setup.horizon_days * 2 + 5; // allow some buffer
  
  // Simulate day by day after entry
  let d = new Date(entryDate + 'T12:00:00Z');
  const sortedDates = Object.keys(priceData).sort();
  
  // Get dates after entry
  const tradeDates = sortedDates.filter(dt => dt > entryDate);
  
  if (tradeDates.length === 0) {
    // Still open - use latest price
    const lastDate = sortedDates[sortedDates.length - 1];
    const lastPrice = priceData[lastDate]?.close || priceData[lastDate]?.open;
    if (lastPrice) {
      const pnl = (lastPrice - entryPrice) / entryPrice * 100;
      return {
        status: 'open',
        entry_price: entryPrice,
        entry_date: entryDate,
        exit_price: lastPrice,
        exit_date: lastDate,
        pnl_pct: Math.round(pnl * 100) / 100,
        holding_days: businessDaysBetween(entryDate, lastDate),
        exit_reason: 'open_mtm',
        tp1_hit: false,
      };
    }
    return { status: 'open', entry_price: entryPrice, exit_price: null, exit_date: null, pnl_pct: null, holding_days: null };
  }
  
  let holdingDays = 0;
  let currentStop = adjStop;
  
  for (const dt of tradeDates) {
    const day = priceData[dt];
    if (!day) continue;
    
    const high = day.high || day.close;
    const low = day.low || day.close;
    const close = day.close;
    
    holdingDays++;
    
    // Check stop first (intraday, stop hit before target)
    if (low !== null && low <= currentStop) {
      const pnl = (currentStop - entryPrice) / entryPrice * 100;
      return {
        status: 'stopped',
        entry_price: entryPrice,
        entry_date: entryDate,
        exit_price: currentStop,
        exit_date: dt,
        pnl_pct: Math.round(pnl * 100) / 100,
        holding_days: holdingDays,
        exit_reason: 'stop_loss',
        tp1_hit: tp1Hit,
      };
    }
    
    // Check TP1
    if (!tp1Hit && high !== null && high >= adjTp1) {
      tp1Hit = true;
      // With breakeven_after_tp1, move stop to entry
      if (stopType === 'breakeven_after_tp1') {
        currentStop = entryPrice;
      }
    }
    
    // Check TP2
    if (adjTp2 && high !== null && high >= adjTp2) {
      const pnl = (adjTp2 - entryPrice) / entryPrice * 100;
      return {
        status: 'tp2',
        entry_price: entryPrice,
        entry_date: entryDate,
        exit_price: adjTp2,
        exit_date: dt,
        pnl_pct: Math.round(pnl * 100) / 100,
        holding_days: holdingDays,
        exit_reason: 'tp2',
        tp1_hit: true,
      };
    }
    
    // Check horizon expiry
    if (holdingDays >= maxHoldingDays) {
      const exitPrice = close || high || low;
      const pnl = exitPrice ? (exitPrice - entryPrice) / entryPrice * 100 : 0;
      return {
        status: tp1Hit ? 'tp1_partial' : 'expired',
        entry_price: entryPrice,
        entry_date: entryDate,
        exit_price: exitPrice,
        exit_date: dt,
        pnl_pct: Math.round(pnl * 100) / 100,
        holding_days: holdingDays,
        exit_reason: 'horizon_expired',
        tp1_hit: tp1Hit,
      };
    }
  }
  
  // Still open (no more price data)
  const lastDt = tradeDates[tradeDates.length - 1];
  const lastDay = priceData[lastDt];
  const lastPrice = lastDay?.close || lastDay?.open;
  const pnl = lastPrice ? (lastPrice - entryPrice) / entryPrice * 100 : null;
  
  return {
    status: tp1Hit ? 'tp1_open' : 'open',
    entry_price: entryPrice,
    entry_date: entryDate,
    exit_price: lastPrice || null,
    exit_date: lastDt,
    pnl_pct: pnl !== null ? Math.round(pnl * 100) / 100 : null,
    holding_days: holdingDays,
    exit_reason: 'still_open',
    tp1_hit: tp1Hit,
  };
}

// ─── 4. Strategy filter ────────────────────────────────────────────────────────

function strategyFilter(setup, filterName) {
  const s = setup.strategy;
  switch (filterName) {
    case 'all': return true;
    case 'no_squeeze': return !s.includes('squeeze');
    case 'momentum_only': return s === 'momentum' || s === 'momentum_expansion';
    case 'breakout_only': return s === 'breakout' || s === 'breakout_squeeze';
    case 'no_short_squeeze': return s !== 'short_squeeze';
    default: return true;
  }
}

// ─── 5. Portfolio simulation ──────────────────────────────────────────────────

function simulatePortfolio(allSetups, trades, params, allDates) {
  // allDates: sorted business days from start to end
  // trades: map of setupId -> trade result
  
  const { nPositions, rotationType, stopType } = params;
  
  // Build timeline of events
  // Each scan day: pick top N setups (filtered), allocate 1/N capital each
  
  // State
  let portfolioValue = 100.0; // normalized to 100
  let cash = portfolioValue;
  const openPositions = []; // [{ticker, entryDate, entryPrice, stop, tp1, tp2, capital, setupId, horizon}]
  const closedTrades = [];
  const dailyHistory = [];
  
  // Track which scan days we've processed
  const processedScans = new Set();
  
  // Group setups by scan date
  const setupsByDate = {};
  for (const [setupId, setup] of Object.entries(allSetups)) {
    if (!setupsByDate[setup.scanDate]) setupsByDate[setup.scanDate] = [];
    setupsByDate[setup.scanDate].push({ ...setup, setupId });
  }
  
  // Process each business day
  for (const date of allDates) {
    // 1. Close positions that hit stop/tp today or expired
    const stillOpen = [];
    for (const pos of openPositions) {
      const trade = trades[pos.setupId];
      if (!trade || trade.status === 'price_unavailable') {
        // Keep position, mark as unavailable
        stillOpen.push(pos);
        continue;
      }
      
      // If exit date is today or earlier, close it
      if (trade.exit_date && trade.exit_date <= date && trade.exit_reason !== 'still_open' && trade.exit_reason !== 'open_mtm') {
        const returnMult = trade.pnl_pct ? (1 + trade.pnl_pct / 100) : 1;
        const newCapital = pos.capital * returnMult;
        cash += newCapital;
        portfolioValue = cash + stillOpen.reduce((sum, p) => sum + p.capital, 0);
        closedTrades.push({
          ...pos,
          exitDate: trade.exit_date,
          exitReason: trade.exit_reason,
          pnl_pct: trade.pnl_pct,
          finalCapital: newCapital,
        });
      } else {
        stillOpen.push(pos);
      }
    }
    openPositions.length = 0;
    openPositions.push(...stillOpen);
    
    // 2. Check if any scan happened on this date (or the day before for evening scans)
    // Scans happen "the evening of date", orders execute next business day
    // So if scan was on date-1 business day, we execute today
    const prevBizDay = getPrevBusinessDay(date);
    
    // Look for scans from yesterday (or today for same-day processing)
    const scanDate = prevBizDay;
    
    if (setupsByDate[scanDate] && !processedScans.has(scanDate)) {
      processedScans.add(scanDate);
      
      // Get available setups for this scan, filtered
      const scanSetups = setupsByDate[scanDate]
        .filter(s => s.filtered) // pre-filtered by strategy
        .sort((a, b) => b.score - a.score);
      
      // Apply rotation rules
      let toAdd = [];
      
      if (rotationType === 'none') {
        // Fill up to nPositions
        const slotsAvailable = nPositions - openPositions.length;
        toAdd = scanSetups.slice(0, slotsAvailable);
      } else if (rotationType === 'daily_max1') {
        // Add at most 1 new position per day
        if (openPositions.length < nPositions) {
          toAdd = scanSetups.slice(0, 1);
        }
      } else if (rotationType === 'daily_max2') {
        // Add at most 2 new positions per day
        const slotsAvailable = Math.min(2, nPositions - openPositions.length);
        toAdd = scanSetups.slice(0, slotsAvailable);
      } else if (rotationType === 'weekly') {
        // Only rotate on Mondays
        const dow = new Date(date + 'T12:00:00Z').getDay();
        if (dow === 1) { // Monday
          const slotsAvailable = nPositions - openPositions.length;
          toAdd = scanSetups.slice(0, slotsAvailable);
        }
      }
      
      // Allocate capital to new positions
      for (const setup of toAdd) {
        const trade = trades[setup.setupId];
        if (!trade || !trade.entry_price) continue;
        
        // Capital per position = 1/N of portfolio
        const posCapital = portfolioValue / nPositions;
        if (cash < posCapital * 0.5) continue; // not enough cash
        
        const allocated = Math.min(posCapital, cash);
        cash -= allocated;
        
        openPositions.push({
          ticker: setup.ticker,
          entryDate: date,
          entryPrice: trade.entry_price,
          capital: allocated,
          setupId: setup.setupId,
          horizon: setup.horizon_days,
        });
      }
    }
    
    // 3. Update portfolio value (MtM open positions)
    let posValue = 0;
    for (const pos of openPositions) {
      const trade = trades[pos.setupId];
      if (trade && trade.pnl_pct !== null && trade.exit_date) {
        // Check if today is before exit date
        if (date < trade.exit_date) {
          // Use current mtm from trade (simplified: linear interpolation)
          posValue += pos.capital; // hold at cost until resolved
        } else {
          const returnMult = 1 + (trade.pnl_pct || 0) / 100;
          posValue += pos.capital * returnMult;
        }
      } else {
        posValue += pos.capital;
      }
    }
    
    portfolioValue = cash + posValue;
    
    dailyHistory.push({
      date,
      portfolio_value: Math.round(portfolioValue * 1000) / 1000,
      open_positions: openPositions.length,
      cash_pct: Math.round(cash / portfolioValue * 1000) / 10,
    });
  }
  
  return { dailyHistory, closedTrades, finalValue: portfolioValue };
}

function getPrevBusinessDay(dateStr) {
  let d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return toDateStr(d);
}

// ─── 6. Grid search metrics ───────────────────────────────────────────────────

function calculateMetrics(tradeResults) {
  const resolved = tradeResults.filter(t => 
    t.pnl_pct !== null && 
    !['price_unavailable', 'open', 'still_open'].includes(t.status) &&
    t.exit_reason !== 'still_open' && 
    t.exit_reason !== 'open_mtm'
  );
  const open = tradeResults.filter(t => ['open', 'tp1_open'].includes(t.status) || t.exit_reason === 'still_open');
  
  if (resolved.length === 0) return null;
  
  const wins = resolved.filter(t => t.pnl_pct > 0);
  const losses = resolved.filter(t => t.pnl_pct <= 0);
  const winRate = resolved.length > 0 ? wins.length / resolved.length * 100 : 0;
  
  const totalGain = wins.reduce((s, t) => s + t.pnl_pct, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl_pct, 0));
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? 10 : 0;
  
  // Average return per trade
  const avgReturn = resolved.reduce((s, t) => s + t.pnl_pct, 0) / resolved.length;
  const stdReturn = Math.sqrt(resolved.reduce((s, t) => s + Math.pow(t.pnl_pct - avgReturn, 2), 0) / resolved.length);
  const sharpe = stdReturn > 0 ? avgReturn / stdReturn * Math.sqrt(252 / 15) : 0; // annualized approx
  
  // Total return (equal-weight 1/N)
  // Simplified: sum of individual returns divided by nPositions
  const totalReturn = resolved.reduce((s, t) => s + t.pnl_pct, 0);
  
  // Avg holding
  const avgHolding = resolved.reduce((s, t) => s + (t.holding_days || 0), 0) / resolved.length;
  
  return {
    return_total: Math.round(avgReturn * 100) / 100,
    win_rate: Math.round(winRate * 10) / 10,
    sharpe: Math.round(sharpe * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    trades: tradeResults.length,
    resolved: resolved.length,
    open: open.length,
    avg_holding: Math.round(avgHolding * 10) / 10,
    max_drawdown: 0, // computed separately from portfolio curve
  };
}

function computeMaxDrawdown(dailyHistory) {
  if (!dailyHistory || dailyHistory.length === 0) return 0;
  let peak = -Infinity;
  let maxDD = 0;
  for (const d of dailyHistory) {
    if (d.portfolio_value > peak) peak = d.portfolio_value;
    const dd = (d.portfolio_value - peak) / peak * 100;
    if (dd < maxDD) maxDD = dd;
  }
  return Math.round(maxDD * 100) / 100;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Backtest complet scanner Market Watch ===\n');
  
  // 1. Parse all scans
  console.log('Step 1: Parsing scan HTML files...');
  const scanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}/.test(d))
    .sort();
  
  const scans = [];
  for (const dir of scanDirs) {
    const scan = parseScannerDir(dir);
    if (scan && scan.setups.length > 0) {
      scans.push(scan);
      console.log(`  ${scan.date} (${dir}): ${scan.setups.length} setups, regime=${scan.regime}`);
    } else if (scan) {
      console.log(`  ${scan.date} (${dir}): 0 setups (skipped)`);
    }
  }
  
  console.log(`\nTotal scans parsed: ${scans.length}`);
  
  // Collect all unique tickers
  const allTickersSet = new Set();
  for (const scan of scans) {
    for (const setup of scan.setups) {
      allTickersSet.add(setup.ticker);
    }
  }
  const allTickers = [...allTickersSet].sort();
  console.log(`\nUnique tickers: ${allTickers.length}`);
  console.log(allTickers.join(', '));
  
  // 2. Fetch Yahoo Finance data
  console.log('\nStep 2: Fetching Yahoo Finance price history...');
  const priceHistory = {}; // ticker -> {date -> {open, close, high, low}}
  
  for (const ticker of allTickers) {
    process.stdout.write(`  Fetching ${ticker}... `);
    const hist = await fetchYahooHistory(ticker);
    if (hist && Object.keys(hist).length > 0) {
      priceHistory[ticker] = hist;
      const dates = Object.keys(hist).sort();
      console.log(`OK (${dates.length} days, ${dates[0]} to ${dates[dates.length-1]})`);
    } else {
      priceHistory[ticker] = null;
      console.log('FAILED (price_unavailable)');
    }
    await sleep(500); // rate limiting
  }
  
  // 3. Build all setups with unique IDs
  console.log('\nStep 3: Building setup universe...');
  const allSetups = {}; // setupId -> setup + trade result
  let setupCounter = 0;
  
  for (const scan of scans) {
    for (const setup of scan.setups) {
      const setupId = `${scan.dir}_${setup.ticker}`;
      if (allSetups[setupId]) continue; // skip duplicate (same ticker in different scan versions)
      
      // Run simulation (hard stop baseline)
      const tradeHard = simulateTrade(setup, scan.date, priceHistory, 'hard_stop');
      const tradeBE = simulateTrade(setup, scan.date, priceHistory, 'breakeven_after_tp1');
      
      allSetups[setupId] = {
        ...setup,
        scanDate: scan.date,
        scanDir: scan.dir,
        regime: scan.regime,
        trade_hard_stop: tradeHard,
        trade_breakeven: tradeBE,
      };
      setupCounter++;
    }
  }
  
  console.log(`Total setups: ${setupCounter}`);
  
  // Show a sample
  const sample = Object.values(allSetups).slice(0, 5);
  for (const s of sample) {
    const t = s.trade_hard_stop;
    console.log(`  ${s.ticker} (${s.scanDate}): entry=${t.entry_price}, status=${t.status}, pnl=${t.pnl_pct}%`);
  }
  
  // 4. Generate business day calendar from start to end
  const START_DATE = '2026-02-15';
  const END_DATE = '2026-03-20';
  
  const allDates = [];
  let d = new Date(START_DATE + 'T12:00:00Z');
  const endD = new Date(END_DATE + 'T12:00:00Z');
  while (d <= endD) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      allDates.push(toDateStr(d));
    }
    d.setDate(d.getDate() + 1);
  }
  
  console.log(`\nCalendar: ${allDates.length} business days from ${START_DATE} to ${END_DATE}`);
  
  // 5. Grid search
  console.log('\nStep 4: Grid search...');
  
  const nPositionsOptions = [1, 2, 3, 4, 5];
  const strategyFilters = ['all', 'no_squeeze', 'momentum_only', 'breakout_only', 'no_short_squeeze'];
  const rotationOptions = ['none', 'daily_max1', 'daily_max2', 'weekly'];
  const stopTypes = ['hard_stop', 'breakeven_after_tp1'];
  
  const gridResults = [];
  
  for (const nPositions of nPositionsOptions) {
    for (const stratFilter of strategyFilters) {
      for (const rotation of rotationOptions) {
        for (const stopType of stopTypes) {
          
          // Filter setups for this combo
          const filteredSetups = {};
          for (const [id, setup] of Object.entries(allSetups)) {
            if (strategyFilter(setup, stratFilter)) {
              filteredSetups[id] = {
                ...setup,
                filtered: true,
              };
            }
          }
          
          // Get relevant trades (with correct stop type)
          const tradeResults = Object.values(filteredSetups).map(s => 
            stopType === 'hard_stop' ? s.trade_hard_stop : s.trade_breakeven
          ).filter(Boolean);
          
          // Calculate metrics
          const metrics = calculateMetrics(tradeResults);
          if (!metrics) continue;
          
          // Simple portfolio simulation for return/drawdown
          // (Simplified: equal weight all trades in the scan)
          // Build daily portfolio value
          const setupsByDate = {};
          for (const [id, setup] of Object.entries(filteredSetups)) {
            if (!setupsByDate[setup.scanDate]) setupsByDate[setup.scanDate] = [];
            setupsByDate[setup.scanDate].push(setup);
          }
          
          // Compute portfolio curve
          let portValue = 100.0;
          let peakValue = 100.0;
          let maxDD = 0;
          const dailyCurve = [{ date: START_DATE, value: 100.0 }];
          
          // Track active positions per day (simplified)
          const activePositions = []; // {setupId, capital, entryDate}
          let cash = 100.0;
          const processedScanDates = new Set();
          
          for (const date of allDates) {
            // Close expired positions
            const stillActive = [];
            for (const pos of activePositions) {
              const setup = filteredSetups[pos.setupId];
              if (!setup) continue;
              const trade = stopType === 'hard_stop' ? setup.trade_hard_stop : setup.trade_breakeven;
              if (!trade) { stillActive.push(pos); continue; }
              
              if (trade.exit_date && trade.exit_date <= date && 
                  trade.exit_reason !== 'still_open' && trade.exit_reason !== 'open_mtm') {
                const returnMult = trade.pnl_pct ? (1 + trade.pnl_pct / 100) : 1;
                cash += pos.capital * returnMult;
              } else {
                stillActive.push(pos);
              }
            }
            activePositions.length = 0;
            activePositions.push(...stillActive);
            
            // Check for scan results to process
            const prevDay = getPrevBusinessDay(date);
            if (setupsByDate[prevDay] && !processedScanDates.has(prevDay)) {
              processedScanDates.add(prevDay);
              
              const scanSetups = setupsByDate[prevDay]
                .filter(s => {
                  const t = stopType === 'hard_stop' ? s.trade_hard_stop : s.trade_breakeven;
                  return t && t.entry_price;
                })
                .sort((a, b) => b.score - a.score);
              
              let toAdd = [];
              const slotsAvail = nPositions - activePositions.length;
              
              if (rotation === 'none') {
                toAdd = scanSetups.slice(0, slotsAvail);
              } else if (rotation === 'daily_max1') {
                if (slotsAvail > 0) toAdd = scanSetups.slice(0, 1);
              } else if (rotation === 'daily_max2') {
                toAdd = scanSetups.slice(0, Math.min(2, slotsAvail));
              } else if (rotation === 'weekly') {
                const dow = new Date(date + 'T12:00:00Z').getDay();
                if (dow === 1) toAdd = scanSetups.slice(0, slotsAvail);
              }
              
              for (const setup of toAdd) {
                const posCapital = portValue / nPositions;
                if (cash < posCapital * 0.3) continue;
                const alloc = Math.min(posCapital, cash);
                cash -= alloc;
                activePositions.push({ setupId: `${setup.scanDir}_${setup.ticker}`, capital: alloc, entryDate: date });
              }
            }
            
            // MtM portfolio
            let posVal = 0;
            for (const pos of activePositions) {
              posVal += pos.capital; // simplified: no intraday MtM
            }
            portValue = cash + posVal;
            if (portValue > peakValue) peakValue = portValue;
            const dd = (portValue - peakValue) / peakValue * 100;
            if (dd < maxDD) maxDD = dd;
          }
          
          // Final return
          const totalReturn = portValue - 100.0;
          
          gridResults.push({
            n_positions: nPositions,
            strategy_filter: stratFilter,
            rotation,
            stop_type: stopType,
            return_total: Math.round(totalReturn * 100) / 100,
            max_drawdown: Math.round(maxDD * 100) / 100,
            win_rate: metrics.win_rate,
            sharpe: metrics.sharpe,
            profit_factor: metrics.profit_factor,
            trades: metrics.trades,
            resolved: metrics.resolved,
            open: metrics.open,
            avg_holding: metrics.avg_holding,
          });
        }
      }
    }
  }
  
  console.log(`Grid results: ${gridResults.length} combinations`);
  
  // Find optimal combinations
  const validResults = gridResults.filter(r => r.resolved >= 3);
  
  const optimalBySharpe = validResults.sort((a, b) => b.sharpe - a.sharpe)[0];
  const optimalByReturn = [...validResults].sort((a, b) => b.return_total - a.return_total)[0];
  const optimalByDD = [...validResults].sort((a, b) => b.max_drawdown - a.max_drawdown)[0]; // least negative
  
  console.log('\nOptimal by Sharpe:', optimalBySharpe);
  console.log('Optimal by Return:', optimalByReturn);
  console.log('Optimal by Min DD:', optimalByDD);
  
  // 6. Build portfolio history for optimal combo
  console.log('\nStep 5: Building portfolio history for optimal combo...');
  
  const optCombo = optimalBySharpe || optimalByReturn || gridResults[0] || {
    n_positions: 3,
    strategy_filter: 'no_short_squeeze',
    rotation: 'daily_max2',
    stop_type: 'hard_stop',
  };
  
  // Re-run with optimal combo to get daily history
  const optFilteredSetups = {};
  for (const [id, setup] of Object.entries(allSetups)) {
    if (strategyFilter(setup, optCombo.strategy_filter)) {
      optFilteredSetups[id] = setup;
    }
  }
  
  const optSetupsByDate = {};
  for (const [id, setup] of Object.entries(optFilteredSetups)) {
    if (!optSetupsByDate[setup.scanDate]) optSetupsByDate[setup.scanDate] = [];
    optSetupsByDate[setup.scanDate].push(setup);
  }
  
  const portfolioDailyHistory = [];
  let pv = 100.0;
  let pvPeak = 100.0;
  let pvCash = 100.0;
  const pvPositions = [];
  const pvProcessed = new Set();
  
  for (const date of allDates) {
    // Close positions
    const pvStill = [];
    for (const pos of pvPositions) {
      const setup = optFilteredSetups[pos.setupId];
      if (!setup) continue;
      const trade = optCombo.stop_type === 'hard_stop' ? setup.trade_hard_stop : setup.trade_breakeven;
      if (!trade) { pvStill.push(pos); continue; }
      
      if (trade.exit_date && trade.exit_date <= date && 
          trade.exit_reason !== 'still_open' && trade.exit_reason !== 'open_mtm') {
        const rm = trade.pnl_pct ? (1 + trade.pnl_pct / 100) : 1;
        pvCash += pos.capital * rm;
      } else {
        pvStill.push(pos);
      }
    }
    pvPositions.length = 0;
    pvPositions.push(...pvStill);
    
    // New entries
    const prevDay = getPrevBusinessDay(date);
    if (optSetupsByDate[prevDay] && !pvProcessed.has(prevDay)) {
      pvProcessed.add(prevDay);
      
      const scanSetups = optSetupsByDate[prevDay]
        .filter(s => {
          const t = optCombo.stop_type === 'hard_stop' ? s.trade_hard_stop : s.trade_breakeven;
          return t && t.entry_price;
        })
        .sort((a, b) => b.score - a.score);
      
      let toAdd = [];
      const slotsAvail = optCombo.n_positions - pvPositions.length;
      
      if (optCombo.rotation === 'none') {
        toAdd = scanSetups.slice(0, slotsAvail);
      } else if (optCombo.rotation === 'daily_max1') {
        if (slotsAvail > 0) toAdd = scanSetups.slice(0, 1);
      } else if (optCombo.rotation === 'daily_max2') {
        toAdd = scanSetups.slice(0, Math.min(2, slotsAvail));
      } else if (optCombo.rotation === 'weekly') {
        const dow = new Date(date + 'T12:00:00Z').getDay();
        if (dow === 1) toAdd = scanSetups.slice(0, slotsAvail);
      }
      
      for (const setup of toAdd) {
        const posCapital = pv / optCombo.n_positions;
        if (pvCash < posCapital * 0.3) continue;
        const alloc = Math.min(posCapital, pvCash);
        pvCash -= alloc;
        pvPositions.push({ 
          setupId: `${setup.scanDir}_${setup.ticker}`, 
          capital: alloc, 
          entryDate: date,
          ticker: setup.ticker,
        });
      }
    }
    
    let posVal = 0;
    for (const p of pvPositions) posVal += p.capital;
    pv = pvCash + posVal;
    if (pv > pvPeak) pvPeak = pv;
    
    portfolioDailyHistory.push({
      date,
      portfolio_value: Math.round(pv * 1000) / 1000,
      open_positions: pvPositions.length,
      cash_pct: Math.round(pvCash / pv * 1000) / 10,
    });
  }
  
  // 7. Build universe stats
  const resolvedCount = Object.values(allSetups).filter(s => {
    const t = s.trade_hard_stop;
    return t && t.pnl_pct !== null && t.exit_reason !== 'still_open' && t.exit_reason !== 'open_mtm';
  }).length;
  
  // 8. Save results
  console.log('\nStep 6: Saving results...');
  
  const backtestResults = {
    generated_at: new Date().toISOString(),
    period: {
      start: START_DATE,
      end: END_DATE,
      days: allDates.length,
    },
    universe: {
      scans: scans.length,
      tickers: allTickers.length,
      resolved: resolvedCount,
      total_setups: setupCounter,
    },
    grid_results: gridResults,
    optimal: optimalBySharpe || null,
    optimal_by_return: optimalByReturn || null,
    optimal_by_dd: optimalByDD || null,
  };
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'backtest-results.json'),
    JSON.stringify(backtestResults, null, 2)
  );
  console.log('  Saved data/backtest-results.json');
  
  const portfolioHistory = {
    combo: optCombo,
    daily: portfolioDailyHistory,
  };
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'portfolio-history.json'),
    JSON.stringify(portfolioHistory, null, 2)
  );
  console.log('  Saved data/portfolio-history.json');
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Scans: ${scans.length}`);
  console.log(`Tickers: ${allTickers.length}`);
  console.log(`Total setups: ${setupCounter}`);
  console.log(`Resolved trades: ${resolvedCount}`);
  console.log(`Grid combinations: ${gridResults.length}`);
  if (optimalBySharpe) {
    console.log(`\nOptimal (Sharpe=${optimalBySharpe.sharpe}): N=${optimalBySharpe.n_positions}, filter=${optimalBySharpe.strategy_filter}, rotation=${optimalBySharpe.rotation}, stop=${optimalBySharpe.stop_type}`);
    console.log(`  Return: ${optimalBySharpe.return_total}%, MaxDD: ${optimalBySharpe.max_drawdown}%, WinRate: ${optimalBySharpe.win_rate}%, PF: ${optimalBySharpe.profit_factor}`);
  }
  
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
