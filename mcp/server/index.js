#!/usr/bin/env node

/**
 * Market Watch MCP Server
 *
 * Exposes live Market Watch data to AI agents (Claude Code, Cursor, etc.)
 * Data is fetched from articles.market-watch.xyz static JSON endpoints.
 *
 * Tools:
 *   - get_watchlist     → Today's A+ scanner picks with entry/stop/TP
 *   - get_market_regime → Current regime, VIX, DXY, fear/greed
 *   - get_pick_detail   → Detailed info on a specific pick
 *   - search_articles   → Search published analyses by ticker or keyword
 *   - get_article_list  → List latest articles by type (daily, weekly, scanner, analyses)
 *
 * Resources:
 *   - marketwatch://watchlist          → Current watchlist JSON
 *   - marketwatch://articles/{tab}     → Article list for a tab
 *
 * Usage:
 *   node index.js                      (stdio transport, for Claude Code)
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

const BASE_URL = 'https://articles.market-watch.xyz';
const DATA_URL = `${BASE_URL}/data`;
const MCP_URL = `${BASE_URL}/mcp`;

// ═══════════════════════════════════════
// FETCH HELPERS
// ═══════════════════════════════════════

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function fetchWatchlist() {
  return fetchJSON(`${MCP_URL}/watchlist.json`);
}

async function fetchTabData(tab) {
  return fetchJSON(`${DATA_URL}/${tab}.json`);
}

// Extract text from HTML card strings
function extractCardInfo(html) {
  const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/s);
  const descMatch = html.match(/<p[^>]*>(.*?)<\/p>/s);
  const hrefMatch = html.match(/href="([^"]+)"/);
  const dateMatch = html.match(/report-card-meta[^>]*>([^<]+)/);
  const tagsMatch = html.match(/data-tags="([^"]*)"/);
  const gradeMatch = html.match(/data-grade="([^"]*)"/);
  const langMatch = html.match(/data-lang="([^"]*)"/);

  return {
    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',
    href: hrefMatch ? hrefMatch[1] : '',
    date: dateMatch ? dateMatch[1].trim() : '',
    tags: tagsMatch ? tagsMatch[1] : '',
    grade: gradeMatch ? gradeMatch[1] : '',
    langs: langMatch ? langMatch[1] : 'fr'
  };
}

// ═══════════════════════════════════════
// MCP SERVER
// ═══════════════════════════════════════

const server = new McpServer({
  name: 'market-watch',
  version: '1.0.0'
});

// ── TOOL: get_watchlist ──
server.tool(
  'get_watchlist',
  'Get today\'s Market Watch A+ scanner picks with entry/stop/TP levels, market regime, and alerts. Updated daily at 23:00 UTC.',
  {},
  async () => {
    const data = await fetchWatchlist();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }
);

// ── TOOL: get_market_regime ──
server.tool(
  'get_market_regime',
  'Get current market regime (Risk-On/Risk-Off/Transition), VIX, DXY, S&P 500, fear/greed index.',
  {},
  async () => {
    const data = await fetchWatchlist();
    const regime = {
      regime: data.regime,
      vix: data.vix,
      dxy: data.dxy,
      us10y: data.us10y,
      spx: data.spx,
      fear_greed: data.fear_greed,
      alerts: data.alerts,
      updated: data.updated,
      next_update: data.next_update
    };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(regime, null, 2)
      }]
    };
  }
);

// ── TOOL: get_pick_detail ──
server.tool(
  'get_pick_detail',
  'Get detailed info on a specific scanner pick by ticker symbol.',
  { ticker: z.string().describe('Ticker symbol (e.g. AAPL, GLD, AVGO)') },
  async ({ ticker }) => {
    const data = await fetchWatchlist();
    const pick = data.picks.find(p =>
      p.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (!pick) {
      return {
        content: [{
          type: 'text',
          text: `Ticker ${ticker} not found in today's watchlist. Available: ${data.picks.map(p => p.ticker).join(', ')}`
        }]
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ ...pick, regime: data.regime, updated: data.updated }, null, 2)
      }]
    };
  }
);

// ── TOOL: search_articles ──
server.tool(
  'search_articles',
  'Search Market Watch published articles by ticker symbol or keyword. Returns matching articles across all tabs (daily, weekly, analyses, scanner, tech, series).',
  {
    query: z.string().describe('Search query — ticker symbol or keyword'),
    tab: z.string().optional().describe('Filter by tab: daily, weekly, analyses, scanner, tech, series. Omit for all.')
  },
  async ({ query, tab }) => {
    const tabs = tab ? [tab] : ['analyses', 'daily', 'weekly', 'scanner', 'tech', 'series'];
    const results = [];
    const q = query.toLowerCase();

    for (const t of tabs) {
      try {
        const cards = await fetchTabData(t);
        for (const html of cards) {
          if (html.toLowerCase().includes(q)) {
            const info = extractCardInfo(html);
            results.push({ tab: t, ...info });
          }
        }
      } catch (e) {
        // skip failed tabs
      }
    }

    return {
      content: [{
        type: 'text',
        text: results.length > 0
          ? JSON.stringify(results.slice(0, 20), null, 2)
          : `No articles found for "${query}"`
      }]
    };
  }
);

// ── TOOL: get_article_list ──
server.tool(
  'get_article_list',
  'List latest Market Watch articles by type. Returns title, date, URL, tags, grade for each.',
  {
    tab: z.enum(['daily', 'weekly', 'analyses', 'scanner', 'tech', 'series']).describe('Article type'),
    limit: z.number().optional().describe('Max results (default 10)')
  },
  async ({ tab, limit }) => {
    const cards = await fetchTabData(tab);
    const max = limit || 10;
    const articles = cards.slice(0, max).map(html => extractCardInfo(html));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tab,
          count: cards.length,
          showing: articles.length,
          articles
        }, null, 2)
      }]
    };
  }
);

// ── RESOURCE: watchlist ──
server.resource(
  'watchlist',
  'marketwatch://watchlist',
  { description: 'Current Market Watch scanner A+ picks watchlist', mimeType: 'application/json' },
  async () => {
    const data = await fetchWatchlist();
    return {
      contents: [{
        uri: 'marketwatch://watchlist',
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }
);

// ── RESOURCE TEMPLATE: articles by tab ──
server.resource(
  'articles-{tab}',
  new ResourceTemplate('marketwatch://articles/{tab}', { list: undefined }),
  { description: 'Market Watch articles by tab (daily, weekly, analyses, scanner, tech, series)', mimeType: 'application/json' },
  async (uri, { tab }) => {
    const cards = await fetchTabData(tab);
    const articles = cards.slice(0, 20).map(html => extractCardInfo(html));
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({ tab, count: cards.length, articles }, null, 2)
      }]
    };
  }
);

// ── START ──
const transport = new StdioServerTransport();
await server.connect(transport);
