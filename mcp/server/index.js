#!/usr/bin/env node

/**
 * Market Watch MCP Server v2.0
 *
 * Full-featured MCP server for AI-powered trading:
 * - Yahoo Finance: quotes, bars, options, financials, news
 * - Binance: crypto bars, WebSocket realtime
 * - Smart alerts: multi-channel (Slack, Discord, Telegram, Desktop)
 * - Trade journal: SQLite with stats
 * - Watchlist sync: auto-download scanner picks from Market Watch
 * - Regime detection: automatic market regime classification
 * - SEC EDGAR: filings, insider transactions
 * - News monitoring: real-time alerts on watchlist tickers
 *
 * Usage:
 *   node index.js                    (stdio transport for Claude Code/Desktop)
 *   npx mw-setup                    (setup wizard)
 *   npx mw-dashboard                (admin UI on localhost:3847)
 *
 * Claude Code config (~/.claude/settings.json):
 *   "mcpServers": {
 *     "market-watch": {
 *       "command": "node",
 *       "args": ["/path/to/mcp/server/index.js"]
 *     }
 *   }
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import * as yahoo from './lib/yahoo.js';
import * as binance from './lib/binance.js';
import * as alerts from './lib/alerts.js';
import * as alertEngine from './lib/alert-engine.js';
import { stream as yahooWS } from './lib/yahoo-ws.js';
import * as watchlist from './lib/watchlist.js';
import * as journal from './lib/journal.js';
import * as news from './lib/news.js';
import * as regime from './lib/regime.js';
import * as cache from './lib/cache.js';
import * as universe from './lib/universe.js';
import * as screener from './lib/screener.js';
import * as bvc from './lib/bvc.js';
import { getStorage } from './lib/storage.js';
import * as barsWorker from './lib/bars-worker.js';
import * as tickEnricher   from './lib/tick-enricher.js';
import * as jobManager     from './lib/job-manager.js';
import * as rollingScanner from './lib/rolling-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

let config = {};
const configPath = resolve(__dirname, 'config.yaml');
if (existsSync(configPath)) {
  try {
    const yaml = (await import('yaml')).default;
    config = yaml.parse(readFileSync(configPath, 'utf8'));
  } catch { /* use defaults */ }
}

// ═══════════════════════════════════════
// INIT MODULES
// ═══════════════════════════════════════

alerts.configure(config);
alertEngine.configure(config);
await journal.init(config.journal?.db_path || resolve(__dirname, 'data/journal.db'));

// Static data fallback
const BASE_URL = 'https://articles.market-watch.xyz';
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}
function extractCardInfo(html) {
  const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/s) || html.match(/<h3[^>]*>(.*?)<\/h3>/s);
  const descMatch = html.match(/<p[^>]*>(.*?)<\/p>/s);
  const hrefMatch = html.match(/href="([^"]+)"/);
  const tagsMatch = html.match(/data-tags="([^"]*)"/);
  return {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '',
    href: hrefMatch ? hrefMatch[1] : '',
    tags: tagsMatch ? tagsMatch[1] : ''
  };
}

// ═══════════════════════════════════════
// MCP SERVER
// ═══════════════════════════════════════

const server = new McpServer({
  name: 'market-watch',
  version: '2.0.0'
});

// ────────────────────────────────────
// YAHOO FINANCE TOOLS
// ────────────────────────────────────

server.tool(
  'get_quote',
  'Get real-time quotes for one or more symbols. Returns price, change, volume, RVOL, market cap, PE, 52-week range, moving averages.',
  { symbols: z.string().describe('Comma-separated symbols (e.g. "AAPL,MSFT,NVDA")') },
  async ({ symbols }) => {
    const syms = symbols.split(',').map(s => s.trim());
    const data = await yahoo.getQuotes(syms);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_chart',
  'Get OHLCV bars (candlestick data) for a symbol. Supports 1m to 1mo intervals, 1d to max range.',
  {
    symbol: z.string().describe('Symbol (e.g. AAPL, BTC-USD)'),
    interval: z.string().optional().describe('Interval: 1m,5m,15m,1h,1d,1wk,1mo (default: 1d)'),
    range: z.string().optional().describe('Range: 1d,5d,1mo,3mo,6mo,1y,5y,max (default: 6mo)')
  },
  async ({ symbol, interval, range }) => {
    const data = await yahoo.getBars(symbol, interval || '1d', range || '6mo');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_options',
  'Get options chain for a symbol. Returns calls, puts, strikes, IV, OI, volume.',
  {
    symbol: z.string().describe('Symbol (e.g. AAPL, SPY)'),
    expiration: z.string().optional().describe('Expiration date YYYY-MM-DD (omit for nearest)')
  },
  async ({ symbol, expiration }) => {
    const data = await yahoo.getOptions(symbol, expiration ? Math.floor(new Date(expiration).getTime() / 1000) : null);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_financials',
  'Get financial data for a symbol: key stats, insider transactions, institutional holders, earnings.',
  {
    symbol: z.string().describe('Symbol'),
    module: z.enum(['keyStats', 'insiders', 'institutions', 'earnings']).optional().describe('Data type (default: keyStats)')
  },
  async ({ symbol, module }) => {
    let data;
    switch (module) {
      case 'insiders': data = await yahoo.getInsiderTransactions(symbol); break;
      case 'institutions': data = await yahoo.getInstitutionalHolders(symbol); break;
      case 'earnings': data = await yahoo.getEarnings(symbol); break;
      default: data = await yahoo.getKeyStats(symbol);
    }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_news',
  'Get latest news for a symbol from Yahoo Finance.',
  {
    symbol: z.string().describe('Symbol (e.g. AAPL, TSLA)'),
    count: z.number().optional().describe('Number of articles (default: 10)')
  },
  async ({ symbol, count }) => {
    const data = await yahoo.getNews(symbol, count || 10);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ────────────────────────────────────
// BINANCE TOOLS
// ────────────────────────────────────

server.tool(
  'get_crypto_quote',
  'Get 24h crypto ticker from Binance. Returns price, change, volume, trades.',
  { symbol: z.string().describe('Binance symbol (e.g. BTCUSDT, ETHUSDT)') },
  async ({ symbol }) => {
    const data = await binance.getTicker(symbol.toUpperCase());
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_crypto_chart',
  'Get crypto OHLCV bars from Binance.',
  {
    symbol: z.string().describe('Binance symbol (e.g. BTCUSDT)'),
    interval: z.string().optional().describe('1m,5m,15m,1h,4h,1d,1w (default: 1d)'),
    limit: z.number().optional().describe('Number of bars (default: 100, max 1000)')
  },
  async ({ symbol, interval, limit }) => {
    const data = await binance.getBars(symbol.toUpperCase(), interval || '1d', limit || 100);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_orderbook',
  'Get crypto order book depth from Binance.',
  {
    symbol: z.string().describe('Binance symbol (e.g. BTCUSDT)'),
    limit: z.number().optional().describe('Depth levels (default: 20)')
  },
  async ({ symbol, limit }) => {
    const data = await binance.getOrderBook(symbol.toUpperCase(), limit || 20);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ────────────────────────────────────
// WATCHLIST & SCANNER TOOLS
// ────────────────────────────────────

server.tool(
  'get_watchlist',
  'Get today\'s Market Watch A+ scanner picks with entry/stop/TP levels, regime, and alerts. Synced from articles.market-watch.xyz.',
  {},
  async () => {
    let wl = watchlist.get();
    if (!wl) wl = await watchlist.sync(config.watchlist?.sync_url);
    return { content: [{ type: 'text', text: JSON.stringify(wl, null, 2) }] };
  }
);

server.tool(
  'sync_watchlist',
  'Force sync watchlist from Market Watch scanner. Downloads latest picks and creates alerts.',
  {},
  async () => {
    const wl = await watchlist.sync(config.watchlist?.sync_url);
    return { content: [{ type: 'text', text: JSON.stringify({ status: 'synced', ...watchlist.status() }, null, 2) }] };
  }
);

server.tool(
  'add_to_watchlist',
  'Add a custom ticker to your watchlist with optional entry/stop/TP levels.',
  {
    ticker: z.string().describe('Ticker symbol'),
    entry: z.number().optional().describe('Entry price'),
    stop: z.number().optional().describe('Stop loss price'),
    tp1: z.number().optional().describe('Take profit 1'),
    tp2: z.number().optional().describe('Take profit 2'),
    note: z.string().optional().describe('Note')
  },
  async (params) => {
    const result = watchlist.addTicker(params.ticker, params);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_market_regime',
  'Detect current market regime (Risk-On/Neutral/Risk-Off/Crisis) from VIX, SPY, IWM, GLD, yields.',
  {},
  async () => {
    const data = await regime.detect();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ────────────────────────────────────
// ALERT ENGINE — DSL-BASED ALERTS
// ────────────────────────────────────

server.tool(
  'create_alert',
  [
    'Create an intelligent DSL alert for any ticker. Fires on Discord/Telegram/desktop.',
    '',
    'DSL examples:',
    '  "price crosses_above ema50"          — breakout above 50-day MA',
    '  "price crosses_below ema200"          — breaks major support',
    '  "rsi14 crosses_below 30"             — enters oversold',
    '  "rsi14 crosses_above 70"             — enters overbought',
    '  "price touches 52w_high"             — within 0.5% of ATH',
    '  "rvol >= 2 AND changePct > 2"        — high volume + momentum',
    '  "drawdown > 5"                        — loss vs entry > 5%',
    '  "gain > 10"                           — profit target +10%',
    '  "price crosses_below stop"            — stop loss hit',
    '  "price crosses_above tp1"             — TP1 reached',
  ].join('\n'),
  {
    ticker:   z.string().describe('Ticker (AAPL, BTCUSDT, ATW…)'),
    name:     z.string().describe('Human label, e.g. "AAPL breakout above EMA50"'),
    when:     z.string().describe('DSL expression evaluated on each price tick'),
    channels: z.array(z.string()).optional().describe('["discord","telegram","desktop","slack"]'),
    once:     z.boolean().optional().describe('Disable after first trigger (default false)'),
    throttle: z.number().optional().describe('Cooldown in seconds between re-triggers (default 300)'),
    message:  z.string().optional().describe('Custom notification message (auto-generated if omitted)'),
    entry:    z.number().optional().describe('Entry price — enables drawdown/gain fields in DSL'),
    stop:     z.number().optional().describe('Stop loss level'),
    tp1:      z.number().optional().describe('Take profit 1'),
    tp2:      z.number().optional().describe('Take profit 2'),
  },
  async (params) => {
    try {
      const alert = alertEngine.createAlert(params);
      // Subscribe ticker to Yahoo WS for real-time evaluation
      if (!yahooWS.isConnected()) yahooWS.connect();
      yahooWS.subscribe([params.ticker]);
      return { content: [{ type: 'text', text: JSON.stringify(alert, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }] };
    }
  }
);

server.tool(
  'list_alerts',
  'List all DSL alerts (active, paused, triggered). Filter by ticker or status.',
  {
    ticker: z.string().optional().describe('Filter by ticker'),
    status: z.string().optional().describe('active | paused | triggered'),
  },
  async (params) => {
    const list = alertEngine.listAlerts(params);
    const st   = alertEngine.status();
    return { content: [{ type: 'text', text: JSON.stringify({ status: st, alerts: list }, null, 2) }] };
  }
);

server.tool(
  'delete_alert',
  'Delete a DSL alert by ID.',
  { id: z.number().describe('Alert ID (from list_alerts)') },
  async ({ id }) => {
    const ok = alertEngine.deleteAlert(id);
    return { content: [{ type: 'text', text: ok ? `Alert #${id} deleted.` : `Alert #${id} not found.` }] };
  }
);

server.tool(
  'pause_alert',
  'Pause or resume a DSL alert.',
  {
    id:     z.number().describe('Alert ID'),
    action: z.enum(['pause', 'resume']).describe('pause or resume'),
  },
  async ({ id, action }) => {
    const a = action === 'pause' ? alertEngine.pauseAlert(id) : alertEngine.resumeAlert(id);
    return { content: [{ type: 'text', text: JSON.stringify(a ?? `Alert #${id} not found`, null, 2) }] };
  }
);

server.tool(
  'alert_history',
  'Get the last N triggered alert events.',
  { limit: z.number().optional().describe('Max results (default 50)') },
  async ({ limit }) => {
    return { content: [{ type: 'text', text: JSON.stringify(alertEngine.alertHistory(limit || 50), null, 2) }] };
  }
);

server.tool(
  'test_alert_dsl',
  'Dry-run a DSL expression against a live quote to validate it before creating an alert.',
  {
    ticker: z.string().describe('Ticker symbol'),
    when:   z.string().describe('DSL expression to test'),
    entry:  z.number().optional().describe('Entry price for drawdown/gain context'),
  },
  async ({ ticker, when, entry }) => {
    const { fn, ok, error, js } = alertEngine.compileAlertDSL(when);
    if (!ok) return { content: [{ type: 'text', text: `DSL error: ${error}\nCompiled: ${js}` }] };

    // Get live quote
    let quote = null;
    try {
      const raw = await yahoo.getQuotes([ticker.toUpperCase()]);
      if (raw.length) {
        quote = raw[0];
        if (entry) {
          quote.entry    = entry;
          quote.drawdown = (quote.price - entry) / entry * 100;
          quote.gain     = quote.drawdown;
        }
      }
    } catch { /* quote unavailable */ }

    const result = quote ? fn(quote, null) : null;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          dsl:    when,
          compiled_js: js,
          ticker,
          quote:  quote ? { price: quote.price, changePct: quote.changePct, rvol: quote.rvol, ema50: quote.ema50, ema200: quote.ema200, rsi14: quote.rsi14 } : null,
          would_fire: result,
        }, null, 2)
      }]
    };
  }
);

// ────────────────────────────────────
// YAHOO WEBSOCKET TOOLS
// ────────────────────────────────────

server.tool(
  'enricher_status',
  'Status of the background pattern enricher: last run, tracked tickers, enriched count, errors.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(tickEnricher.status(), null, 2) }] };
  }
);

server.tool(
  'get_patterns',
  'Get computed pattern scores for a ticker: breakout_score, reversal_score, squeeze_score, VWAP, double top/bottom detection.',
  {
    symbol:   z.string().describe('Ticker symbol'),
    refresh:  z.boolean().optional().describe('Force immediate re-enrichment (default false)'),
  },
  async ({ symbol, refresh }) => {
    const sym = symbol.toUpperCase();
    tickEnricher.track(sym);
    if (refresh) {
      // Synchronous single-ticker enrichment
      const storage = getStorage();
      const bars = storage.get(sym, '1d');
      if (bars.length >= 5) {
        const { enrichBars } = await import('./lib/pattern-engine.js');
        const quote = (await yahoo.getQuotes([sym]).catch(() => []))[0] ?? {};
        const result = enrichBars(bars, quote);
        return { content: [{ type: 'text', text: JSON.stringify({ symbol: sym, ...result }, null, 2) }] };
      }
    }
    const data = tickEnricher.getEnrichment(sym);
    return { content: [{ type: 'text', text: JSON.stringify({ symbol: sym, ...data }, null, 2) }] };
  }
);

server.tool(
  'alert_errors',
  'Get recent DSL evaluation errors — never fails silently. Shows what went wrong and which alert caused it.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(alertEngine.getErrors(), null, 2) }] };
  }
);

server.tool(
  'yahoo_ws_subscribe',
  'Subscribe tickers to Yahoo Finance WebSocket for real-time price streaming. Alerts are evaluated on each tick.',
  {
    symbols: z.string().describe('Comma-separated tickers (e.g. "AAPL,MSFT,NVDA")'),
  },
  async ({ symbols }) => {
    const syms = symbols.split(',').map(s => s.trim().toUpperCase());
    if (!yahooWS.isConnected()) yahooWS.connect();
    yahooWS.subscribe(syms);
    // Give it 2 seconds to receive first quotes
    await new Promise(r => setTimeout(r, 2000));
    return { content: [{ type: 'text', text: JSON.stringify(yahooWS.status(), null, 2) }] };
  }
);

server.tool(
  'yahoo_ws_status',
  'Get Yahoo Finance WebSocket status: connection state, subscriptions, live quotes received.',
  {},
  async () => {
    const st     = yahooWS.status();
    const quotes = yahooWS.allQuotes();
    return { content: [{ type: 'text', text: JSON.stringify({ ws: st, liveQuotes: quotes }, null, 2) }] };
  }
);

// ────────────────────────────────────
// NEWS & SEC TOOLS
// ────────────────────────────────────

server.tool(
  'get_sec_filings',
  'Get recent SEC filings (10-K, 10-Q, 8-K, Form 4) for a symbol from EDGAR.',
  {
    ticker: z.string().describe('Ticker symbol'),
    types: z.string().optional().describe('Filing types comma-separated (default: 10-K,10-Q,8-K,4)'),
    limit: z.number().optional().describe('Max filings (default: 10)')
  },
  async ({ ticker, types, limit }) => {
    const fileTypes = types ? types.split(',') : ['10-K', '10-Q', '8-K', '4'];
    const data = await news.getRecentFilings(ticker, fileTypes, limit || 10);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_insider_activity',
  'Get recent insider transactions (Form 4 filings) for a symbol.',
  { ticker: z.string().describe('Ticker symbol') },
  async ({ ticker }) => {
    const data = await news.getInsiderActivity(ticker);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  'get_upcoming_earnings',
  'Get upcoming earnings dates and estimates for watchlist tickers.',
  { tickers: z.string().optional().describe('Comma-separated tickers (omit for watchlist)') },
  async ({ tickers }) => {
    const syms = tickers ? tickers.split(',').map(s => s.trim()) : watchlist.getTickers();
    const data = await news.getUpcomingEarnings(syms);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

// ────────────────────────────────────
// TRADE JOURNAL TOOLS
// ────────────────────────────────────

server.tool(
  'log_trade',
  'Log a new trade to the journal.',
  {
    ticker: z.string().describe('Ticker symbol'),
    direction: z.enum(['long', 'short']).optional().describe('Trade direction (default: long)'),
    strategy: z.string().optional().describe('Strategy name (momentum, breakout, mean_reversion, etc.)'),
    entry_price: z.number().describe('Entry price'),
    stop_price: z.number().optional().describe('Stop loss price'),
    tp1_price: z.number().optional().describe('Take profit 1'),
    tp2_price: z.number().optional().describe('Take profit 2'),
    shares: z.number().optional().describe('Number of shares'),
    risk_pct: z.number().optional().describe('Portfolio risk % (e.g. 2.0)'),
    entry_reason: z.string().optional().describe('Why you entered'),
    notes: z.string().optional().describe('Additional notes')
  },
  async (params) => {
    const trade = journal.addTrade(params);
    return { content: [{ type: 'text', text: JSON.stringify(trade, null, 2) }] };
  }
);

server.tool(
  'close_trade',
  'Close an open trade with exit price and reason.',
  {
    id: z.number().describe('Trade ID'),
    exit_price: z.number().describe('Exit price'),
    exit_reason: z.string().optional().describe('Why you exited'),
    notes: z.string().optional().describe('Additional notes')
  },
  async (params) => {
    const trade = journal.closeTrade(params.id, params);
    return { content: [{ type: 'text', text: trade ? JSON.stringify(trade, null, 2) : 'Trade not found' }] };
  }
);

server.tool(
  'get_trades',
  'Get trade journal entries with optional filters.',
  {
    ticker: z.string().optional().describe('Filter by ticker'),
    status: z.enum(['open', 'closed']).optional().describe('Filter by status'),
    strategy: z.string().optional().describe('Filter by strategy'),
    limit: z.number().optional().describe('Max results (default: 20)')
  },
  async (params) => {
    const trades = journal.getTrades({ ...params, limit: params.limit || 20 });
    return { content: [{ type: 'text', text: JSON.stringify(trades, null, 2) }] };
  }
);

server.tool(
  'get_journal_stats',
  'Get trading statistics: win rate, profit factor, avg R-multiple, max drawdown, best/worst trade.',
  {
    from: z.string().optional().describe('Start date YYYY-MM-DD'),
    to: z.string().optional().describe('End date YYYY-MM-DD'),
    strategy: z.string().optional().describe('Filter by strategy')
  },
  async (params) => {
    const stats = journal.getStats(params);
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  }
);

// ────────────────────────────────────
// ARTICLES TOOLS (from static site)
// ────────────────────────────────────

server.tool(
  'search_articles',
  'Search Market Watch published articles by ticker or keyword.',
  {
    query: z.string().describe('Search query'),
    tab: z.string().optional().describe('Tab filter: daily, weekly, analyses, scanner, tech, series')
  },
  async ({ query, tab }) => {
    const tabs = tab ? [tab] : ['analyses', 'daily', 'weekly', 'scanner', 'tech', 'series'];
    const results = [];
    const q = query.toLowerCase();
    for (const t of tabs) {
      try {
        const cards = await fetchJSON(`${BASE_URL}/data/${t}.json`);
        for (const html of cards) {
          if (html.toLowerCase().includes(q)) {
            results.push({ tab: t, ...extractCardInfo(html) });
          }
        }
      } catch { /* skip */ }
    }
    return { content: [{ type: 'text', text: results.length > 0 ? JSON.stringify(results.slice(0, 20), null, 2) : `No articles found for "${query}"` }] };
  }
);

server.tool(
  'get_article_list',
  'List latest Market Watch articles by type.',
  {
    tab: z.enum(['daily', 'weekly', 'analyses', 'scanner', 'tech', 'series']).describe('Article type'),
    limit: z.number().optional().describe('Max results (default: 10)')
  },
  async ({ tab, limit }) => {
    const cards = await fetchJSON(`${BASE_URL}/data/${tab}.json`);
    const articles = cards.slice(0, limit || 10).map(html => extractCardInfo(html));
    return { content: [{ type: 'text', text: JSON.stringify({ tab, count: cards.length, articles }, null, 2) }] };
  }
);

// ────────────────────────────────────
// PROMPT LIBRARY TOOLS
// ────────────────────────────────────

// Load prompt library from prompt-ia/library.js
let promptLibrary = [];
try {
  const libPath = resolve(__dirname, '../../prompt-ia/library.js');
  if (existsSync(libPath)) {
    const raw = readFileSync(libPath, 'utf8');
    // Extract the LIBRARY array from "var LIBRARY = [...];"
    const match = raw.match(/var\s+LIBRARY\s*=\s*(\[[\s\S]*\]);?\s*$/);
    if (match) {
      promptLibrary = new Function('return ' + match[1])();
    }
  }
} catch { /* prompt library unavailable */ }

server.tool(
  'get_prompts',
  `List or search the Market Watch Prompt Library (${promptLibrary.length} expert prompts for trading/investing). Categories: essential, stock, portfolio, macro, crypto, special. Each prompt is a battle-tested template you can fill in with your ticker/data and use directly.`,
  {
    category: z.string().optional().describe('Filter by category: essential, stock, portfolio, macro, crypto, special'),
    search:   z.string().optional().describe('Search prompts by keyword (matches title and description)'),
    lang:     z.string().optional().describe('Language for titles/descriptions: en (default), fr, ar')
  },
  async ({ category, search, lang }) => {
    const l = lang || 'en';
    let results = promptLibrary;
    if (category) {
      results = results.filter(p => p.cat === category);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(p => {
        const title = (p.title[l] || p.title.en || '').toLowerCase();
        const desc = (p.desc[l] || p.desc.en || '').toLowerCase();
        const code = (p.code[l] || p.code.en || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || code.includes(q);
      });
    }
    const list = results.map(p => ({
      num: p.num,
      category: p.cat,
      title: p.title[l] || p.title.en,
      description: p.desc[l] || p.desc.en
    }));
    return { content: [{ type: 'text', text: JSON.stringify({ total: promptLibrary.length, matching: list.length, prompts: list }, null, 2) }] };
  }
);

server.tool(
  'get_prompt',
  'Get a specific prompt from the Market Watch Prompt Library by number. Returns the full prompt template ready to use — just fill in the [PLACEHOLDERS] with your data.',
  {
    num:  z.number().describe('Prompt number (1-50)'),
    lang: z.string().optional().describe('Language: en (default), fr, ar')
  },
  async ({ num, lang }) => {
    const l = lang || 'en';
    const prompt = promptLibrary.find(p => p.num === num);
    if (!prompt) {
      return { content: [{ type: 'text', text: `Prompt #${num} not found. Use get_prompts to see available prompts (1-${promptLibrary.length}).` }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          num: prompt.num,
          category: prompt.cat,
          title: prompt.title[l] || prompt.title.en,
          description: prompt.desc[l] || prompt.desc.en,
          prompt: prompt.code[l] || prompt.code.en
        }, null, 2)
      }]
    };
  }
);

// ────────────────────────────────────
// UNIVERSE TOOL
// ────────────────────────────────────

server.tool(
  'get_universe',
  'List available symbol universes or get symbols for a specific one. Universes are sourced live from StockAnalysis.com (15k+ stocks, daily cache). Also supports Yahoo Finance predefined screeners.',
  {
    list:   z.boolean().optional().describe('List all available universes with symbol counts (default: true if no other param)'),
    name:   z.string().optional().describe('Universe: us_large (~500), us_mid (~400), us (~800), eu (~400), eu_large (~200), uk, de, fr, apac (~300), jp, kr, au, hk, etf (~200), crypto (25 hardcoded), all (~600)'),
    search: z.string().optional().describe('Search Yahoo Finance for tickers matching a keyword (e.g. "semiconductor", "EV battery")'),
    yahoo_screener: z.string().optional().describe('Yahoo predefined screener: most_actives, day_gainers, day_losers, undervalued_large, growth_tech')
  },
  async ({ list, name, search, yahoo_screener }) => {
    if (yahoo_screener) {
      const ids = universe.YF_SCREENER_IDS;
      const id  = ids[yahoo_screener] || yahoo_screener;
      const syms = await universe.fetchYahooScreener(id, 100);
      return { content: [{ type: 'text', text: JSON.stringify({ screener: yahoo_screener, count: syms.length, symbols: syms }, null, 2) }] };
    }
    if (search) {
      const results = await universe.searchTickers(search, null, 30);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    if (name) {
      const syms = await universe.get(name);
      return { content: [{ type: 'text', text: JSON.stringify({ universe: name, count: syms.length, symbols: syms }, null, 2) }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(universe.list(), null, 2) }] };
  }
);

// ────────────────────────────────────
// SCREENER TOOL
// ────────────────────────────────────

server.tool(
  'run_screener',
  `Run a DSL screener across US, EU, APAC, ETF, or Crypto universes. Uses regime-aware scoring.

DSL syntax examples:
  change1d > 2.0 AND volume > avgvol3m * 1.5     # Momentum
  rsi14 < 30 AND price > low52w * 1.05            # Oversold bounce (requires bars=true)
  pct_from_high > -5 AND rvol > 2.0              # Near-52w-high breakout
  price > ema200 AND change1d > 1.0              # Uptrend continuation
  change1d < -3 AND rvol > 2.0                   # Dump screener (for shorts / RISK-OFF)
  pe < 20 AND above_ema200 = 1 AND rvol > 1.5   # Value + momentum

Available fields: price, change1d, volume, avgvol3m, avgvol10d, rvol, marketcap ($M),
pe, forward_pe, beta, ema50, ema200, high52w, low52w, pct_from_high, pct_from_low,
above_ema50, above_ema200, rsi14 (bars=true only), atr14 (bars=true only)`,
  {
    universe: z.string().optional().describe('Universe: us_large, us_mid, us, eu, apac, etf, crypto, all — or comma-separated symbols'),
    filter:   z.string().optional().describe('DSL filter expression (see tool description for syntax)'),
    sort:     z.string().optional().describe('Sort by: score (default), change, volume, rvol, rsi'),
    limit:    z.number().optional().describe('Max results (default: 20)'),
    bars:     z.boolean().optional().describe('Fetch bars to compute RSI/ATR (slower but enables rsi14/atr14 conditions)'),
    regime:   z.string().optional().describe('Override regime: RISK-ON, EARLY RISK-ON, NEUTRAL, EARLY RISK-OFF, RISK-OFF')
  },
  async (params) => {
    const result = await screener.run({
      universe:       params.universe || 'us_large',
      filter:         params.filter   || '',
      sort:           params.sort     || 'score',
      limit:          params.limit    || 20,
      bars:           params.bars     || false,
      regimeOverride: params.regime   || null
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ────────────────────────────────────
// BACKTEST TOOL
// ────────────────────────────────────

server.tool(
  'backtest_screener',
  `Backtest a DSL screener against historical bars. Fetches 1-year bars for the universe, walks through history, applies the filter at each bar, then tracks forward returns.

Returns: hit rate, avg return, best/worst trade, grade (A+ to D), per-trade details.
Use optimize_screener to auto-tune thresholds for best grade.`,
  {
    universe:  z.string().optional().describe('Universe (keep small for speed: us_large, eu, etf)'),
    filter:    z.string().describe('DSL filter expression'),
    hold_days: z.number().optional().describe('Holding period in trading days (default: 10)'),
    tp_pct:    z.number().optional().describe('Take-profit % from entry (default: 5)'),
    stop_pct:  z.number().optional().describe('Stop-loss % from entry, negative (default: -3)')
  },
  async (params) => {
    const result = await screener.backtest({
      universe:  params.universe  || 'us_large',
      filter:    params.filter,
      hold_days: params.hold_days || 10,
      tp_pct:    params.tp_pct    || 5,
      stop_pct:  params.stop_pct  || -3
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ────────────────────────────────────
// AUTO-OPTIMIZE TOOL
// ────────────────────────────────────

server.tool(
  'optimize_screener',
  `Auto-tune screener thresholds using grid search + backtest. Replace numeric thresholds with $PARAM_NAME placeholders, provide a range of values to test, and the engine finds the best combination.

Example:
  filter: "rsi14 < $RSI_THRESH AND change1d > $CHANGE_MIN AND volume > avgvol3m * $VOL_MULT"
  param_ranges: { "RSI_THRESH": [25,30,35,40], "CHANGE_MIN": [0.5,1.0,1.5], "VOL_MULT": [1.5,2.0,2.5] }

Returns best parameter set by composite score (hit rate × avg return).`,
  {
    universe:     z.string().optional().describe('Universe name (default: us_large)'),
    filter:       z.string().describe('DSL filter with $PARAM_NAME placeholders'),
    param_ranges: z.record(z.array(z.number())).describe('Object mapping param names to arrays of values to test'),
    hold_days:    z.number().optional().describe('Holding period (default: 10)'),
    tp_pct:       z.number().optional().describe('Take-profit % (default: 5)'),
    stop_pct:     z.number().optional().describe('Stop-loss % (default: -3)')
  },
  async (params) => {
    const result = await screener.optimize({
      universe:     params.universe     || 'us_large',
      filter:       params.filter,
      param_ranges: params.param_ranges,
      hold_days:    params.hold_days    || 10,
      tp_pct:       params.tp_pct       || 5,
      stop_pct:     params.stop_pct     || -3
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ────────────────────────────────────
// BAR STORAGE TOOLS
// ────────────────────────────────────

server.tool(
  'save_bars',
  'Save OHLCV bars for one or more symbols to local SQLite storage for offline analysis and backtesting. Supports Yahoo Finance (stocks/ETFs) and Binance (crypto).',
  {
    symbols:  z.string().describe('Comma-separated symbols (e.g. "AAPL,MSFT,NVDA" or "BTCUSDT,ETHUSDT")'),
    interval: z.string().optional().describe('Bar interval: 1d, 1h, 15m (default: 1d)'),
    range:    z.string().optional().describe('History range: 1mo,3mo,6mo,1y,2y,5y (default: 1y)'),
    source:   z.string().optional().describe('Source: yahoo or binance (default: yahoo)')
  },
  async ({ symbols, interval, range, source }) => {
    const storage = getStorage();
    const syms    = symbols.split(',').map(s => s.trim().toUpperCase());
    const intv    = interval || '1d';
    const rng     = range    || '1y';
    const src     = source   || 'yahoo';

    const results = [];
    for (const sym of syms) {
      try {
        let bars;
        if (src === 'binance') {
          const data = await binance.getBars(sym, intv, rng === '1y' ? 365 : 100);
          bars = data.bars;
        } else if (src === 'bvc') {
          const data = await bvc.getBars(sym);
          bars = data.bars;
        } else {
          const data = await yahoo.getBars(sym, intv, rng);
          bars = data.bars;
        }
        const saved = storage.save(sym, intv, bars, src);
        results.push({ symbol: sym, saved, from: bars[0]?.time, to: bars[bars.length - 1]?.time });
      } catch (e) {
        results.push({ symbol: sym, error: e.message });
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({ results, catalog: storage.storageStats() }, null, 2) }] };
  }
);

server.tool(
  'get_cached_bars',
  'Retrieve locally cached bars. Also supports CSV and NDJSON export (NDJSON is Parquet-compatible via DuckDB).',
  {
    symbol:   z.string().describe('Symbol (e.g. AAPL, BTCUSDT)'),
    interval: z.string().optional().describe('Interval (default: 1d)'),
    format:   z.string().optional().describe('Output format: json, csv, ndjson (default: json)'),
    from:     z.string().optional().describe('Start date YYYY-MM-DD'),
    to:       z.string().optional().describe('End date YYYY-MM-DD')
  },
  async ({ symbol, interval, format, from, to }) => {
    const storage = getStorage();
    const intv    = interval || '1d';
    const fmt     = format   || 'json';

    if (fmt === 'csv') {
      const csv = storage.exportCSV(symbol.toUpperCase(), intv);
      return { content: [{ type: 'text', text: csv || `No cached bars for ${symbol} ${intv}` }] };
    }
    if (fmt === 'ndjson') {
      const ndjson = storage.exportNDJSON(symbol.toUpperCase(), intv);
      const cmd    = storage.parquetCommand(symbol.toUpperCase(), intv);
      return { content: [{ type: 'text', text: ndjson ? `${ndjson}\n\n# To convert to Parquet:\n# ${cmd}` : `No cached bars for ${symbol} ${intv}` }] };
    }

    const bars = storage.get(symbol.toUpperCase(), intv, { from, to });
    return { content: [{ type: 'text', text: JSON.stringify({ symbol: symbol.toUpperCase(), interval: intv, count: bars.length, bars }, null, 2) }] };
  }
);

server.tool(
  'storage_catalog',
  'Show all locally cached symbols with bar counts, date ranges, and storage stats.',
  {},
  async () => {
    const storage = getStorage();
    const catalog = storage.catalog();
    const stats   = storage.storageStats();
    return { content: [{ type: 'text', text: JSON.stringify({ stats, catalog }, null, 2) }] };
  }
);

server.tool(
  'export_parquet',
  'Export locally cached bars to Parquet format via DuckDB. Runs immediately (normally auto-runs every 6h). Requires DuckDB installed (brew install duckdb). Parquet files are saved to data/parquet/.',
  {},
  async () => {
    await barsWorker.runNow();
    const st = barsWorker.status();
    return { content: [{ type: 'text', text: JSON.stringify(st, null, 2) }] };
  }
);

server.tool(
  'bars_worker_status',
  'Get bars background worker status: last run, export counts, DuckDB availability, storage stats, intraday cleanup info.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(barsWorker.status(), null, 2) }] };
  }
);

// ────────────────────────────────────
// BVC (CASABLANCA BOURSE) TOOLS
// ────────────────────────────────────

server.tool(
  'get_bvc_instruments',
  'List all instruments traded on the Casablanca Stock Exchange (Bourse des Valeurs de Casablanca). Returns symbol, ISIN, and instrumentID for each stock.',
  {},
  async () => {
    const instruments = await bvc.loadInstruments();
    const list = Object.values(instruments).map(({ symbol, isin, instrumentID }) => ({ symbol, isin, instrumentID }));
    list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return { content: [{ type: 'text', text: JSON.stringify({ exchange: 'CSE', country: 'MA', count: list.length, instruments: list }, null, 2) }] };
  }
);

server.tool(
  'get_bvc_bars',
  'Fetch daily OHLCV bars for a Casablanca Bourse (BVC) stock. Bars are cached locally in SQLite. Use for backtesting Moroccan equities.',
  {
    symbol: z.string().describe('BVC ticker symbol (e.g. ATW, BCP, IAM, MASI)'),
    format: z.string().optional().describe('Output format: json, csv (default: json)')
  },
  async ({ symbol, format }) => {
    const storage = getStorage();
    const sym = symbol.toUpperCase();
    const { bars } = await bvc.getBars(sym);
    storage.save(sym, '1d', bars, 'bvc');

    if (format === 'csv') {
      const csv = storage.exportCSV(sym, '1d');
      return { content: [{ type: 'text', text: csv || `No bars for ${sym}` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ symbol: sym, source: 'bvc', exchange: 'CSE', count: bars.length, from: bars[0]?.time, to: bars[bars.length - 1]?.time, bars }, null, 2) }] };
  }
);

server.tool(
  'get_bvc_quote',
  'Get the latest price quote for a Casablanca Bourse (BVC) stock. Since BVC has no real-time feed, the quote is derived from the most recent daily close.',
  {
    symbol: z.string().describe('BVC ticker symbol (e.g. ATW, BCP, IAM)')
  },
  async ({ symbol }) => {
    const quote = await bvc.getQuote(symbol.toUpperCase());
    if (!quote) return { content: [{ type: 'text', text: `No data found for ${symbol.toUpperCase()}` }] };
    return { content: [{ type: 'text', text: JSON.stringify(quote, null, 2) }] };
  }
);

// ────────────────────────────────────
// JOB MANAGER TOOLS
// ────────────────────────────────────

server.tool(
  'job_list',
  'List all background jobs (enricher, bars-worker, scanners…) with their status, schedule, last run, and progress.',
  {},
  async () => {
    const jobs = jobManager.list();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(jobs.map(j => ({
          id:          j.id,
          name:        j.name,
          description: j.description,
          type:        j.type,
          status:      j.status,
          schedule:    jobManager.formatSchedule(j.schedule),
          lastRun:     j.lastRun,
          nextRun:     j.nextRun,
          runCount:    j.runCount,
          errorCount:  j.errorCount,
          lastError:   j.lastError,
          progress:    j.progress,
        })), null, 2)
      }]
    };
  }
);

server.tool(
  'job_control',
  'Start, stop, pause, resume, or run-now a background job by id.',
  {
    id:     z.string().describe('Job id (e.g. "enricher", "bars_worker", "scan:momentum")'),
    action: z.enum(['start', 'stop', 'pause', 'resume', 'run_now']).describe('Action to perform'),
  },
  async ({ id, action }) => {
    let result;
    switch (action) {
      case 'start':   result = jobManager.start(id);   break;
      case 'stop':    result = jobManager.stop(id);    break;
      case 'pause':   result = jobManager.pause(id);   break;
      case 'resume':  result = jobManager.resume(id);  break;
      case 'run_now': result = jobManager.runNow(id);  break;
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ok: true, id, action, status: result?.status }, null, 2)
      }]
    };
  }
);

server.tool(
  'job_set_schedule',
  'Set or update the schedule for a job. Pass null to remove schedule (job becomes idle after current run).',
  {
    id:       z.string().describe('Job id'),
    schedule: z.string().nullable().describe(
      'Schedule as JSON string: {"every":"5min"} | {"every":"1h"} | {"every":"1d"} | {"daily":"09:00"} | {"daily":"09:00","weekday":1} | null to remove'
    ),
  },
  async ({ id, schedule }) => {
    const sched = schedule ? JSON.parse(schedule) : null;
    const result = jobManager.setSchedule(id, sched);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ok: true, id, schedule: jobManager.formatSchedule(sched), status: result?.status, nextRun: result?.nextRun }, null, 2)
      }]
    };
  }
);

server.tool(
  'job_create_scan',
  'Create a rolling universe scanner job that continuously evaluates a DSL filter on every symbol in a universe.',
  {
    id:             z.string().describe('Unique scanner id (e.g. "momentum", "breakout")'),
    name:           z.string().optional().describe('Human label'),
    universe:       z.string().default('us_large').describe('Universe key (us_large, us_mid, us_small, crypto, ma) or comma-sep symbols'),
    filter:         z.string().default('price > 0').describe('DSL filter expression (same syntax as run_screener)'),
    alert_channels: z.array(z.string()).optional().describe('Notification channels: discord, telegram, slack, desktop'),
    batch_size:     z.number().optional().describe('Symbols per batch (default: 50)'),
    batch_delay:    z.number().optional().describe('Ms between batches (default: 2000)'),
    cycle_delay:    z.number().optional().describe('Ms between full cycles (default: 60000)'),
    once_per_cycle: z.boolean().optional().describe('Alert max once per symbol per cycle (default: true)'),
    schedule:       z.string().optional().describe('Optional schedule JSON: {"every":"5min"} etc — defers start until scheduled'),
  },
  async ({ id, name, universe: uni, filter, alert_channels, batch_size, batch_delay, cycle_delay, once_per_cycle, schedule }) => {
    const opts = {
      id, name, universe: uni, filter, alert_channels,
      batch_size, batch_delay, cycle_delay, once_per_cycle,
      schedule: schedule ? JSON.parse(schedule) : null,
    };
    const { jobId, job } = rollingScanner.createScanner(opts);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok:      true,
          jobId,
          status:  job?.status,
          message: `Scanner "${jobId}" created. Use job_list to monitor progress.`,
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'job_remove',
  'Remove a scanner job (stops it and deletes it from the registry).',
  {
    id: z.string().describe('Job id to remove (e.g. "scan:momentum")'),
  },
  async ({ id }) => {
    const removed = rollingScanner.removeScanner(id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ok: removed, id, message: removed ? `Job "${id}" removed.` : `Job "${id}" not found.` }, null, 2)
      }]
    };
  }
);

// ────────────────────────────────────
// STATUS TOOL
// ────────────────────────────────────

server.tool(
  'mw_status',
  'Get Market Watch MCP server status: version, modules, watchlist, alerts, journal stats.',
  {},
  async () => {
    const wlStatus = watchlist.status();
    const journalStats = journal.getStats();
    const alertList = alerts.listAlerts();
    const cacheStats = cache.stats();
    const currentRegime = regime.getCurrent();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          version: '2.0.0',
          modules: {
            yahoo: config.sources?.yahoo?.enabled !== false,
            binance: config.sources?.binance?.enabled !== false,
            sec_edgar: config.sources?.sec_edgar?.enabled !== false,
            alerts: config.alerts?.enabled !== false,
            journal: config.journal?.enabled !== false,
            dashboard: config.dashboard?.enabled !== false
          },
          watchlist: wlStatus,
          regime: currentRegime?.regime || 'Not yet detected',
          alerts: alertEngine.status(),
          journal: { totalTrades: journalStats.totalTrades || 0, winRate: journalStats.winRate || null },
          cache: cacheStats
        }, null, 2)
      }]
    };
  }
);

// ────────────────────────────────────
// RESOURCES
// ────────────────────────────────────

server.resource(
  'watchlist',
  'marketwatch://watchlist',
  { description: 'Current watchlist with scanner picks and custom tickers', mimeType: 'application/json' },
  async () => {
    let wl = watchlist.get();
    if (!wl) wl = await watchlist.sync();
    return { contents: [{ uri: 'marketwatch://watchlist', mimeType: 'application/json', text: JSON.stringify(wl, null, 2) }] };
  }
);

server.resource(
  'articles-{tab}',
  new ResourceTemplate('marketwatch://articles/{tab}', { list: undefined }),
  { description: 'Articles by tab', mimeType: 'application/json' },
  async (uri, { tab }) => {
    const cards = await fetchJSON(`${BASE_URL}/data/${tab}.json`);
    const articles = cards.slice(0, 20).map(html => extractCardInfo(html));
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ tab, count: cards.length, articles }, null, 2) }] };
  }
);

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════

// Auto-sync watchlist on startup + auto-create DSL alerts for scanner picks
try {
  const wl = await watchlist.sync(config.watchlist?.sync_url);
  if (wl?.picks?.length) alertEngine.createWatchlistAlerts(wl);
} catch { /* will sync later */ }

// Yahoo WebSocket → alert engine tick
// Real-time: alerts are evaluated on every WS quote event
// Fallback polling: also evaluated in the monitoring loop below
{
  const prevQuotes = new Map();

  yahooWS.on('quote', async (quote, prev) => {
    try {
      const sym = quote.id;
      if (!sym) return;
      // Normalise the raw protobuf quote to match screener format
      const q = {
        symbol:        sym,
        price:         quote.price         ?? 0,
        open:          quote.open          ?? null,
        high:          quote.dayHigh       ?? null,
        low:           quote.dayLow        ?? null,
        previousClose: quote.previousClose ?? null,
        change:        quote.change        ?? null,
        changePct:     quote.changePercent ?? 0,
        volume:        quote.dayVolume     ?? 0,
        rvol:          null,  // not available from WS
        ema50:         null,  // not available from WS
        ema200:        null,
        bid:           quote.bid           ?? null,
        ask:           quote.ask           ?? null,
      };
      const prevQ = prevQuotes.get(sym) ?? null;
      const quotesMap = new Map([[sym, q]]);
      const prevMap   = prevQ ? new Map([[sym, prevQ]]) : new Map();
      prevQuotes.set(sym, q);
      await alertEngine.tick(quotesMap, prevMap);
    } catch (e) {
      console.error('[AlertTick] Error:', e.message);
    }
  });

  yahooWS.on('error', (e) => console.error('[YahooWS] Stream error:', e.message));
}

// Polling fallback: monitor watchlist every 15s (enriched with ema50/200/rvol)
// Also feeds alert engine in case WS is not connected
if (config.alerts?.enabled !== false) {
  const interval = (config.sources?.yahoo?.polling_interval || 15) * 1000;
  watchlist.startMonitoring(interval).catch(() => {});
}

// Register background jobs in job-manager so the user can control them
// (start/stop/pause/resume/schedule via job_list + job_control MCP tools)

const enricherIntervalMs = config.alerts?.enricher_interval_ms || 5 * 60_000;
const barsIntervalMs     = config.bars?.worker_interval_ms     || 6 * 3600_000;

// Pre-seed enricher with watchlist tickers
{
  const wl = watchlist.get();
  const wlTickers = (wl?.picks || []).map(p => p.ticker).concat(wl?.custom?.map(c => c.ticker) || []);
  if (wlTickers.length) tickEnricher.track(wlTickers);
}

jobManager.register('enricher', {
  name:        'Pattern Enricher',
  description: 'Computes breakout/reversal/squeeze scores for tracked tickers every 5 min',
  type:        'periodic',
  schedule:    { intervalMs: enricherIntervalMs },
  autoStart:   true,
  fn:          async () => { await tickEnricher.runNow(); return tickEnricher.status(); },
  stopFn:      () => {},
  pauseFn:     () => {},
  resumeFn:    () => {},
});

// Immediate first run (non-blocking)
tickEnricher.runNow().catch(() => {});

jobManager.register('bars_worker', {
  name:        'Bars Worker',
  description: 'Exports daily bars to storage and cleans old intraday data every 6h',
  type:        'periodic',
  schedule:    { intervalMs: barsIntervalMs },
  autoStart:   true,
  fn:          async () => barsWorker.runNow(),
  stopFn:      () => barsWorker.stop(),
  pauseFn:     () => {},
  resumeFn:    () => {},
});

// Also start bars worker directly (it manages its own internal timer for backward compat)
barsWorker.start(barsIntervalMs);

// Connect MCP transport
const transport = new StdioServerTransport();
await server.connect(transport);
