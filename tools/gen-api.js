#!/usr/bin/env node
/**
 * gen-api.js — Portfolio endpoint generator
 * Reads source data and writes flat JSON/XML to portfolio/v1/
 *
 * Usage: node tools/gen-api.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'portfolio', 'v1');

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
const backtestTrades = readJSON('data/backtest-trades.json');
const positions      = readJSON('data/scanner-positions.json');
const backtestRes    = readJSON('data/backtest-results.json');
const scannerCards   = readJSON('data/scanner.json');

// ─── 1. signals.json — latest scan signals (flat array) ─────────────────────
if (backtestTrades) {
  // Use calmar trades; fallback to first available key
  const trades = backtestTrades.calmar || Object.values(backtestTrades)[0] || [];
  const latestScan = trades.reduce((acc, t) => (!acc || t.scanDate > acc) ? t.scanDate : acc, null);

  const signals = trades
    .filter(t => t.scanDate === latestScan)
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

  write('signals.json', { updatedAt: now, latestScanDate: latestScan, signals });
}

// ─── 2. positions.json — current open positions ─────────────────────────────
if (positions) {
  write('positions.json', {
    updatedAt: now,
    sourceUpdatedAt: positions.updated_at || null,
    openPositions: positions.open_positions || []
  });
}

// ─── 3. trades.json — full trade history (flat array) ───────────────────────
if (backtestTrades) {
  const trades = backtestTrades.calmar || Object.values(backtestTrades)[0] || [];
  write('trades.json', { updatedAt: now, trades });
}

// ─── 4. equity.json — backtest stats + equity curve ─────────────────────────
if (backtestRes) {
  const res = backtestRes.optimal_calmar;
  if (res) {
    write('equity.json', {
      updatedAt: now,
      period: backtestRes.period || null,
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
    });
  }
}

// ─── 5. feed.xml — RSS 2.0 from last 20 scanner cards ──────────────────────
if (scannerCards) {
  const BASE = 'https://articles.market-watch.xyz';

  function parseCard(cardHtml) {
    const hrefMatch = cardHtml.match(/href="([^"]+)"/);
    const h2Match   = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const pMatch    = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const metaMatch = cardHtml.match(/report-card-meta"[^>]*>([\s\S]*?)<\/div>/);
    return {
      href:  hrefMatch  ? hrefMatch[1]  : '/scanner/',
      title: h2Match    ? h2Match[1].replace(/<[^>]+>/g, '').trim() : 'Scanner',
      desc:  pMatch     ? pMatch[1].replace(/<[^>]+>/g, '').trim()  : '',
      date:  metaMatch  ? metaMatch[1].replace(/<[^>]+>/g, '').trim() : ''
    };
  }

  const items = (Array.isArray(scannerCards) ? scannerCards : [])
    .slice(0, 20)
    .map(parseCard)
    .map(item => {
      const url   = item.href.startsWith('http') ? item.href : `${BASE}${item.href}`;
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

  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Market Watch — Scanner &amp; Publications</title>
    <link>${BASE}/</link>
    <description>Daily scanner picks, weekly market reviews, and stock analyses from Market Watch.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE}/portfolio/v1/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE}/logo.svg</url>
      <title>Market Watch</title>
      <link>${BASE}/</link>
    </image>
${items}
  </channel>
</rss>`);
}

console.log(`\nDone. Endpoints written to portfolio/v1/ at ${now}`);
