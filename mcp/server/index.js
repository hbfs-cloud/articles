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
// ALERTS TOOLS
// ────────────────────────────────────

server.tool(
  'create_alert',
  'Create a price/volume/news alert with multi-channel notifications.',
  {
    ticker: z.string().describe('Ticker symbol'),
    type: z.enum(['entry', 'stop', 'tp', 'price_above', 'price_below', 'rvol', 'vwap_reclaim', 'news', 'volume_spike']).describe('Alert type'),
    value: z.number().optional().describe('Price or threshold value'),
    message: z.string().optional().describe('Custom alert message'),
    channels: z.array(z.string()).optional().describe('Notification channels: desktop, slack, discord, telegram')
  },
  async (params) => {
    const alert = alerts.createAlert({
      ...params,
      condition: ['stop', 'price_below'].includes(params.type) ? 'below' : ['tp', 'price_above'].includes(params.type) ? 'above' : 'near'
    });
    return { content: [{ type: 'text', text: JSON.stringify(alert, null, 2) }] };
  }
);

server.tool(
  'list_alerts',
  'List all active alerts, optionally filtered by ticker or status.',
  {
    ticker: z.string().optional().describe('Filter by ticker'),
    status: z.string().optional().describe('Filter by status: active, paused, triggered')
  },
  async (params) => {
    const list = alerts.listAlerts(params);
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  }
);

server.tool(
  'delete_alert',
  'Delete an alert by ID.',
  { id: z.number().describe('Alert ID') },
  async ({ id }) => {
    const ok = alerts.deleteAlert(id);
    return { content: [{ type: 'text', text: ok ? 'Alert deleted' : 'Alert not found' }] };
  }
);

server.tool(
  'get_alert_history',
  'Get history of triggered alerts.',
  { limit: z.number().optional().describe('Max results (default: 50)') },
  async ({ limit }) => {
    const hist = alerts.getHistory(limit || 50);
    return { content: [{ type: 'text', text: JSON.stringify(hist, null, 2) }] };
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
          alerts: { total: alertList.length, active: alertList.filter(a => a.status === 'active').length },
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

// Auto-sync watchlist on startup
try {
  await watchlist.sync(config.watchlist?.sync_url);
} catch { /* will sync later */ }

// Start monitoring if configured
if (config.alerts?.enabled !== false) {
  const interval = (config.sources?.yahoo?.polling_interval || 15) * 1000;
  watchlist.startMonitoring(interval).catch(() => {});
}

// Start background bars worker (Parquet export + intraday cleanup every 6h)
barsWorker.start(config.bars?.worker_interval_ms || 6 * 3600_000);

// Connect MCP transport
const transport = new StdioServerTransport();
await server.connect(transport);
