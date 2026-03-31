#!/usr/bin/env node
/**
 * gen-api.js — Static API endpoint generator
 * Reads source data files and writes static JSON/XML to api/v1/
 *
 * Usage: node tools/gen-api.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'api', 'v1');

// Ensure output directory exists
fs.mkdirSync(OUT, { recursive: true });

function readJSON(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  [warn] Missing source: ${relPath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function write(filename, content) {
  const outPath = path.join(OUT, filename);
  fs.writeFileSync(outPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`  [ok]   ${path.relative(ROOT, outPath)}`);
}

const now = new Date().toISOString();

// ─── Load source files ────────────────────────────────────────────────────────
const modesConfig    = readJSON('data/modes-config.json');
const backtestTrades = readJSON('data/backtest-trades.json');
const positions      = readJSON('data/scanner-positions.json');
const backtestRes    = readJSON('data/backtest-results.json');
const scannerCards   = readJSON('data/scanner.json');

// ─── 1. modes.json ────────────────────────────────────────────────────────────
// Expose each mode's configuration with its canonical API id
if (modesConfig) {
  const modes = {};
  for (const [id, cfg] of Object.entries(modesConfig.modes)) {
    modes[id] = { id, ...cfg };
  }
  write('modes.json', {
    updatedAt: now,
    _comment: modesConfig._comment || '',
    modes
  });
}

// ─── 2. signals.json ─────────────────────────────────────────────────────────
// Latest signals = open positions grouped by mode
// scanner-positions.json doesn't have per-mode breakdown so we expose
// the full open_positions list as "latest" and attach the scan date.
if (positions) {
  const openList = positions.open_positions || [];
  // Latest scanDate across open positions
  const latestScan = openList.reduce((acc, p) => {
    return (!acc || p.scan_date > acc) ? p.scan_date : acc;
  }, null);

  // Build per-mode signals from backtest-trades using latest scan date
  const signalsByMode = {};
  if (backtestTrades) {
    for (const [modeId, trades] of Object.entries(backtestTrades)) {
      // Latest scanDate in this mode's trades
      const modeLatest = trades.reduce((acc, t) => {
        return (!acc || t.scanDate > acc) ? t.scanDate : acc;
      }, null);
      signalsByMode[modeId] = trades
        .filter(t => t.scanDate === modeLatest)
        .map(t => ({
          ticker: t.ticker,
          strategy: t.strategy,
          score: t.score,
          scanDate: t.scanDate,
          entryDate: t.entryDate,
          entry: t.actualEntry,
          exitPrice: t.exitPrice,
          status: t.status,
          pnlPct: t.pnlPct,
          holdDays: t.holdDays
        }));
    }
  }

  write('signals.json', {
    updatedAt: now,
    latestScanDate: latestScan,
    signalsByMode
  });
}

// ─── 3. positions.json ────────────────────────────────────────────────────────
if (positions) {
  write('positions.json', {
    updatedAt: now,
    sourceUpdatedAt: positions.updated_at || null,
    openPositions: positions.open_positions || []
  });
}

// ─── 4. trades.json ──────────────────────────────────────────────────────────
// All closed trades per mode from backtest-trades.json
// Mode ID mapping: backtest uses 'growth', 'calmar', 'sharpe'
// modes-config uses 'growth', 'calmar', 'zero' (conservative)
if (backtestTrades) {
  const tradesByMode = {};
  const modeIdMap = { growth: 'growth', calmar: 'calmar', sharpe: 'zero' };
  for (const [rawId, trades] of Object.entries(backtestTrades)) {
    const canonicalId = modeIdMap[rawId] || rawId;
    tradesByMode[canonicalId] = trades;
  }
  write('trades.json', {
    updatedAt: now,
    _note: 'Mode IDs: growth=Aggressive, calmar=Balanced, zero=Conservative. Source key "sharpe" maps to mode "zero".',
    tradesByMode
  });
}

// ─── 5. equity.json ──────────────────────────────────────────────────────────
// Equity curves per mode from backtest-results.json
// optimal_return → growth, optimal_calmar → calmar, optimal_sharpe → zero
if (backtestRes) {
  const modeResultMap = {
    growth: 'optimal_return',
    calmar: 'optimal_calmar',
    zero:   'optimal_sharpe'
  };
  const equity = {};
  for (const [modeId, resultKey] of Object.entries(modeResultMap)) {
    const res = backtestRes[resultKey];
    if (res) {
      equity[modeId] = {
        config: {
          portfolioSize: res.portfolioSize,
          topN: res.topN,
          minScore: res.minScore,
          filterName: res.filterName,
          rotation: res.rotation,
          horizon: res.horizon,
          partialTP: res.partialTP,
          trailingStop: res.trailingStop
        },
        stats: {
          returnTotal: res.returnTotal,
          maxDD: res.maxDD,
          winRate: res.winRate,
          avgWin: res.avgWin,
          avgLoss: res.avgLoss,
          profitFactor: res.profitFactor,
          sharpe: res.sharpe,
          calmar: res.calmar,
          sortino: res.sortino,
          avgHold: res.avgHold,
          trades: res.trades,
          wins: res.wins,
          losses: res.losses
        },
        equityCurve: res.equityCurve || []
      };
    }
  }
  write('equity.json', {
    updatedAt: now,
    period: backtestRes.period || null,
    equity
  });
}

// ─── 6. feed.xml ─────────────────────────────────────────────────────────────
// RSS 2.0 feed from last 20 scanner cards
if (scannerCards) {
  const BASE = 'https://articles.market-watch.xyz';

  // Parse HTML card string → extract href, title, description, date
  function parseCard(cardHtml) {
    const hrefMatch = cardHtml.match(/href="([^"]+)"/);
    const h2Match   = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const pMatch    = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const metaMatch = cardHtml.match(/report-card-meta"[^>]*>([\s\S]*?)<\/div>/);

    const href  = hrefMatch  ? hrefMatch[1]  : '/scanner/';
    const title = h2Match    ? h2Match[1].replace(/<[^>]+>/g, '').trim() : 'Scanner';
    const desc  = pMatch     ? pMatch[1].replace(/<[^>]+>/g, '').trim()  : '';
    const date  = metaMatch  ? metaMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    return { href, title, desc, date };
  }

  // Take last 20 entries (array is newest-first already)
  const items = (Array.isArray(scannerCards) ? scannerCards : [])
    .slice(0, 20)
    .map(parseCard)
    .map(item => {
      const url = item.href.startsWith('http') ? item.href : `${BASE}${item.href}`;
      const title = item.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const desc  = item.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      <pubDate>${item.date}</pubDate>
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Market Watch — Scanner &amp; Publications</title>
    <link>${BASE}/</link>
    <description>Daily scanner picks, weekly market reviews, and stock analyses from Market Watch.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE}/api/v1/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE}/logo.svg</url>
      <title>Market Watch</title>
      <link>${BASE}/</link>
    </image>
${items}
  </channel>
</rss>`;

  write('feed.xml', rss);
}

console.log(`\nDone. All endpoints written to api/v1/ at ${now}`);
