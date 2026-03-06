(function() {
  'use strict';

  var LANG_CODE = (new URLSearchParams(window.location.search).get('lang')) || 'en';
  if (['fr','en','ar','es','zh'].indexOf(LANG_CODE) === -1) LANG_CODE = 'en';
  var isFR = LANG_CODE === 'fr';

  // ═══════════════════════════════════════
  // UI LABELS
  // ═══════════════════════════════════════
  var UI = {
    en: {
      agentIntro: 'Pick a workflow. Get a complete, self-configuring AI agent project.',
      factoryIntro: 'Build smart alerts visually. Download a ready-to-run project.',
      watchlist: 'Watchlist',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: 'Generate Project',
      download: 'Download ZIP',
      copy: 'Copy CLAUDE.md',
      step1: 'What to monitor',
      step2: 'When to alert',
      step3: 'What to do',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      useScannerPicks: 'Use today\'s Market Watch A+ picks',
      learnMore: 'Learn more',
      includes: 'Project includes',
      howTo: 'How to use'
    },
    fr: {
      agentIntro: 'Choisis un workflow. Obtiens un projet IA complet, auto-configuré.',
      factoryIntro: 'Crée des alertes visuellement. Télécharge un projet prêt à l\'emploi.',
      watchlist: 'Watchlist',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: 'Générer le Projet',
      download: 'Télécharger ZIP',
      copy: 'Copier CLAUDE.md',
      step1: 'Quoi surveiller',
      step2: 'Quand alerter',
      step3: 'Quoi faire',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      useScannerPicks: 'Utiliser les picks A+ Market Watch du jour',
      learnMore: 'En savoir plus',
      includes: 'Le projet contient',
      howTo: 'Comment utiliser'
    }
  };
  var L = UI[LANG_CODE] || UI.en;

  // ═══════════════════════════════════════
  // WORKFLOWS — Agent Mode
  // ═══════════════════════════════════════
  var WORKFLOWS = [
    {
      id: 'trading-desk',
      icon: '🏢',
      title: isFR ? 'Trading Desk' : 'Trading Desk',
      sub: isFR ? 'Scan → Analyse → Alertes → Rapport EOD' : 'Scan → Analyze → Alert → EOD Report',
      desc: isFR
        ? 'Transforme ton IA en desk de trading complet. Chaque matin, il fetch les picks A+, analyse le marché, surveille tes positions, et génère des alertes en temps réel.'
        : 'Turn your AI into a full trading desk. Every morning it fetches A+ picks, analyzes the market, monitors positions, and generates real-time alerts.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md']
    },
    {
      id: 'scanner-sniper',
      icon: '🎯',
      title: isFR ? 'Scanner Sniper' : 'Scanner Sniper',
      sub: isFR ? 'Deep-dive sur les picks A+ du jour' : 'Deep-dive today\'s A+ picks',
      desc: isFR
        ? 'L\'IA récupère les 10 meilleurs setups du scanner Market Watch, fait une analyse multi-source approfondie de chacun, et génère un plan de trade détaillé.'
        : 'The AI fetches today\'s top 10 scanner picks, runs deep multi-source analysis on each, and generates detailed trade plans.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md']
    },
    {
      id: 'portfolio-sentinel',
      icon: '📊',
      title: isFR ? 'Portfolio Sentinel' : 'Portfolio Sentinel',
      sub: isFR ? 'Surveillance risques + corrélations' : 'Risk monitoring + correlations',
      desc: isFR
        ? 'Surveille ton portefeuille en continu : corrélations, drawdown, concentration sectorielle, Greek exposure. Alerte si un seuil de risque est franchi.'
        : 'Continuously monitors your portfolio: correlations, drawdown, sector concentration, Greek exposure. Alerts when risk thresholds are breached.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'portfolio.json', 'README.md']
    },
    {
      id: 'earnings-analyst',
      icon: '📈',
      title: isFR ? 'Earnings Analyst' : 'Earnings Analyst',
      sub: isFR ? 'Saison des résultats — pré/post analyse' : 'Earnings season — pre/post analysis',
      desc: isFR
        ? 'Suit le calendrier des earnings, analyse le consensus vs whisper, pricing des options pré-earnings, et fait l\'analyse beat/miss en post-earnings.'
        : 'Tracks the earnings calendar, analyzes consensus vs whisper numbers, pre-earnings options pricing, and runs beat/miss analysis post-earnings.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'earnings-watchlist.json', 'README.md']
    },
    {
      id: 'news-reactor',
      icon: '📰',
      title: isFR ? 'News Reactor' : 'News Reactor',
      sub: isFR ? 'Détection de news → analyse d\'impact auto' : 'Breaking news detection → auto impact analysis',
      desc: isFR
        ? 'Surveille les news en continu pour ta watchlist. Classe chaque news (market-moving vs bruit), analyse l\'impact, et génère des alertes actionnables.'
        : 'Monitors news continuously for your watchlist. Classifies each story (market-moving vs noise), analyzes impact, and generates actionable alerts.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md']
    },
    {
      id: 'alert-architect',
      icon: '🔔',
      title: isFR ? 'Alert Architect' : 'Alert Architect',
      sub: isFR ? 'Alertes multi-conditions personnalisées' : 'Custom multi-condition alerts',
      desc: isFR
        ? 'Définis des règles d\'alerte complexes : "Si RSI < 30 ET VIX > 25 ET insider buy détecté → Telegram + analyse complète". Multi-actifs, multi-timeframe.'
        : 'Define complex alert rules: "If RSI < 30 AND VIX > 25 AND insider buy detected → Telegram + full analysis". Multi-asset, multi-timeframe.',
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'alerts-config.json', 'README.md']
    }
  ];

  // ═══════════════════════════════════════
  // WORKFLOW TEMPLATES (CLAUDE.md generators)
  // ═══════════════════════════════════════
  function tplTradingDesk(tickers) {
    return `# Market Watch — Trading Desk 🏢

## Your Role
You are a premium retail trading desk assistant. You run a systematic daily workflow:
scan → analyze → alert → report. You use Market Watch data as your primary signal source.

## Data Sources

### Market Watch Watchlist (Updated Daily 23:00 UTC)
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Contains: market regime, VIX, A+ scanner picks with entry/stop/TP/score/catalyst.

### Real-Time Data (if MarketWatch Gateway MCP available)
- \`GetMarketOverview\` — full market snapshot (indices, crypto, rates, sentiment)
- \`QueryData\` — quotes, technicals, sentiment, news per ticker
- \`GetInstruments\` — deep analysis per symbol

### Supplementary
- WebSearch for breaking news and catalysts
- WebFetch for SEC filings, earnings transcripts

## Watchlist
${tickers || 'Auto: loaded from Market Watch scanner A+ picks'}

## Daily Workflow

### ☀️ Pre-Market (7:00 AM)
1. Fetch \`watchlist.json\` for today's picks
2. Get market overview: futures, VIX, DXY, rates, crypto overnight
3. For each A+ pick:
   - Current price vs planned entry zone (±1%)
   - Is the setup still valid? (not already broken out or stopped)
   - Key catalyst today? (earnings, FDA, macro data)
4. **Output:** Morning Briefing with actionable setups

### 📊 Market Hours
Monitor for these triggers:
- Price enters entry zone (±1% of planned entry)
- Volume spike > 2x 20-day average
- RSI crosses 30 (oversold bounce) or 70 (overbought exit)
- Breaking news on watchlist tickers
- VIX spike > 10% intraday (risk-off signal)

When triggered, send alert (see format below).

### 🌙 Post-Market (4:15 PM)
1. Review all positions vs stops and targets
2. Check after-hours earnings and news
3. Calculate daily P&L per position
4. Status each position: ✅ Hit TP / ❌ Stopped / ⏳ Active
5. Preview tomorrow's catalysts
6. **Output:** EOD Report

## Alert Format
\`\`\`
🎯 SETUP TRIGGERED: $TICKER
━━━━━━━━━━━━━━━━━━━━━━━━
Strategy: $STRATEGY
Entry: $ENTRY | Current: $PRICE
Stop: $STOP (-$RISK%) | TP1: $TP1 (+$GAIN1%)
R/R: $RR | Score: $SCORE/100
━━━━━━━━━━━━━━━━━━━━━━━━
Catalyst: $CATALYST
Sizing: $SIZE% of portfolio
\`\`\`

## Risk Rules
- Max 5% portfolio per position
- Max 3 new entries per day
- If VIX > 35: defensive only (no new longs, consider hedges)
- Stop losses are HARD — never move stops against the trade
- If regime changes to RISK-OFF: reduce exposure 50%, add GLD/TLT hedge

## Anti-Hallucination Rules
1. NEVER invent a price or metric — write "checking..." if unknown
2. Every data point must come from a verifiable source
3. Distinguish between FACTS (data) and OPINIONS (analysis)
4. NEVER guarantee returns
5. Always include risk disclaimer

## How to Start
Say one of these commands:
- "Run the morning scan" — executes pre-market workflow
- "Check my alerts" — scans current conditions
- "EOD report" — generates end-of-day review
- "Analyze [TICKER]" — deep-dive a specific pick
`;
  }

  function tplScannerSniper(tickers) {
    return `# Market Watch — Scanner Sniper 🎯

## Your Role
You are a precision analyst. Your job: fetch today's Market Watch A+ picks and run
an institutional-grade deep analysis on each one. No fluff, no generic takes.

## Data Source
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
${tickers ? '## Additional Tickers\n' + tickers + '\n' : ''}
## For Each A+ Pick, Analyze:

### 1. Setup Validation
- Is the entry zone still valid? (price vs planned entry)
- Has the pattern broken? (invalidation check)
- Volume confirmation? (above average = confirmed)

### 2. Multi-Source Deep Dive
- **Technicals:** RSI, MACD, EMAs, support/resistance, pattern analysis
- **Fundamentals:** P/E, revenue growth, margins, FCF, debt ratio
- **Sentiment:** social media buzz, analyst consensus, insider activity
- **News:** last 7 days catalyst scan
- **Options:** unusual activity, put/call ratio, max pain (if available)

### 3. Trade Plan
For each validated setup, generate:
\`\`\`
📋 TRADE PLAN: $TICKER
━━━━━━━━━━━━━━━━━━
Setup: $STRATEGY
Entry: $ENTRY (limit order)
Stop: $STOP | Risk: $RISK%
TP1: $TP1 (+$GAIN1%) — take 50% profit
TP2: $TP2 (+$GAIN2%) — trail stop to breakeven
R/R: $RR
Position Size: $SIZE% of portfolio
Confidence: $SCORE/100

✅ Confirmations: [list 3 bullish signals]
❌ Invalidations: [list 3 bearish signals]
⏰ Timing: [catalyst date, optimal entry window]
\`\`\`

### 4. Ranking
Rank all picks by composite score:
| Rank | Ticker | Score | Strategy | R/R | Key Catalyst |
|------|--------|-------|----------|-----|-------------|
| 1    | ...    | ...   | ...      | ... | ...         |

## Output Format
- Start with a 3-line executive summary
- Then individual pick analyses (most promising first)
- End with "Today's Best Setup" highlight

## How to Start
Say: "Analyze today's picks" or "Sniper mode"
`;
  }

  function tplPortfolioSentinel(tickers) {
    return `# Market Watch — Portfolio Sentinel 📊

## Your Role
You are a portfolio risk manager. You monitor a portfolio continuously,
track correlations, detect concentration risks, and alert when thresholds are breached.

## Portfolio
${tickers ? tickers.split(',').map(function(t, i) {
  return '- ' + t.trim() + ': [enter allocation %]';
}).join('\n') : '- Define your holdings below:\n- AAPL: 15%\n- NVDA: 12%\n- BTC-USD: 10%\n- GLD: 8%\n- TLT: 5%\n- (edit this list)'}

## Market Context
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Use regime and VIX data for risk assessment.

## Daily Risk Report
Generate each morning:

### 1. Portfolio Dashboard
| Holding | Weight | Day Chg | 5d Chg | vs Stop | Signal |
|---------|--------|---------|--------|---------|--------|
| AAPL    | 15%    | +0.8%   | -1.2%  | OK      | ⏳     |

### 2. Risk Metrics
- **Portfolio Beta** vs S&P 500
- **Concentration:** top 3 holdings = X% (alert if > 50%)
- **Sector Exposure:** tech X%, healthcare Y%, ...
- **Correlation Matrix:** flag highly correlated pairs (ρ > 0.8)
- **Max Drawdown:** current vs max acceptable (-10% default)
- **VaR (95%):** estimated daily value at risk

### 3. Alert Triggers
🔴 CRITICAL: Drawdown > -7% → reduce exposure, hedge with puts
🟡 WARNING: Single position > 20% → rebalance
🟡 WARNING: Sector concentration > 40% → diversify
🟢 INFO: Correlation spike detected → review hedges

### 4. Rebalancing Suggestions
If any threshold breached:
- What to trim
- What to add
- Suggested hedge instruments (SH, GLD, TLT, VXX)

## How to Start
Say: "Portfolio check" or "Risk report"
`;
  }

  function tplEarningsAnalyst(tickers) {
    return `# Market Watch — Earnings Analyst 📈

## Your Role
You are an earnings season specialist. You track the earnings calendar,
run pre-earnings analysis, and generate post-earnings assessments.

## Earnings Watchlist
${tickers || 'Auto: loaded from Market Watch watchlist + your additions'}

## Pre-Earnings Workflow (1-3 days before)
For each ticker reporting:

### 1. Consensus Analysis
- EPS estimate (consensus vs whisper)
- Revenue estimate
- Guidance expectations
- Revision momentum (last 30/60/90 days)

### 2. Historical Pattern
- Last 4 quarters: beat/miss, price reaction
- Average post-earnings move (±%)
- Typical gap direction

### 3. Options Intelligence
- Implied move (straddle pricing)
- Put/call ratio change
- Unusual options activity
- Max pain level

### 4. Pre-Earnings Verdict
\`\`\`
📊 PRE-EARNINGS: $TICKER (reports $DATE $TIME)
━━━━━━━━━━━━━━━━━━━━━━━━━━
EPS Est: $EPS | Whisper: $WHISPER
Revenue Est: $REV
Implied Move: ±$MOVE%
Historical Beat Rate: $BEAT%
Signal: BULLISH / BEARISH / NEUTRAL
Position: [hold / trim / add / hedge]
\`\`\`

## Post-Earnings Workflow (within 1 hour)
### 1. Beat/Miss Assessment
- EPS actual vs estimate vs whisper
- Revenue actual vs estimate
- Guidance: raised / maintained / lowered

### 2. Price Reaction Analysis
- After-hours / pre-market move
- Is the move justified? (overreaction check)
- Key quotes from earnings call

### 3. Action Signal
- HOLD: results in-line, thesis intact
- ADD: beat + raised guidance + pullback = opportunity
- TRIM: miss + lowered guidance = risk
- EXIT: thesis broken

## How to Start
Say: "Earnings preview for this week" or "Post-earnings analysis [TICKER]"
`;
  }

  function tplNewsReactor(tickers) {
    return `# Market Watch — News Reactor 📰

## Your Role
You are a real-time news analyst. You monitor news for your watchlist,
classify each story by impact level, and auto-generate actionable analysis.

## Watchlist
${tickers || 'Auto: loaded from Market Watch scanner picks'}

## News Classification System

### 🔴 Level 1 — Market-Moving (immediate action)
- Earnings surprise > ±10%
- FDA approval/rejection
- M&A announcement
- Major contract win/loss
- Regulatory action (SEC, DOJ)
- Geopolitical shock (sanctions, military)
→ **Action:** Full impact analysis + alert + trade suggestion

### 🟡 Level 2 — Notable (monitor)
- Analyst upgrade/downgrade
- Insider buy/sell
- Product launch
- Partnership announcement
- Sector-wide news
→ **Action:** Quick summary + thesis impact check

### ⚪ Level 3 — Noise (log only)
- Routine filings
- Minor personnel changes
- Restatements of known info
→ **Action:** Log, no alert

## Alert Format
\`\`\`
📰 NEWS ALERT [$LEVEL]
━━━━━━━━━━━━━━━━━━
Ticker: $TICKER | Time: $TIME
Headline: $HEADLINE
Source: $SOURCE

Impact: $IMPACT_SUMMARY
Price Before: $PRICE | Expected Move: ±$MOVE%
Thesis Impact: STRENGTHENS / NEUTRAL / WEAKENS
Action: $RECOMMENDED_ACTION
\`\`\`

## Scanning Rules
- Check news every 15 minutes during market hours
- Pre-market (7-9:30 AM): check every 5 minutes
- After-hours: check hourly
- Weekend: check 2x daily for geopolitical events

## How to Start
Say: "Scan for news" or "What's happening with my watchlist?"
`;
  }

  function tplAlertArchitect(tickers) {
    return `# Market Watch — Alert Architect 🔔

## Your Role
You are an alert system manager. You monitor multiple conditions across
multiple assets and trigger smart alerts with escalation logic.

## Monitored Assets
${tickers || 'Auto: loaded from Market Watch scanner picks'}

## Alert Rules

### Rule 1: Oversold Entry
**IF:** RSI(14) < 30 AND Price near support (within 2%)
**AND:** VIX < 30 (not crisis mode)
**THEN:** Send entry alert with trade plan
**Priority:** 🟡 Medium

### Rule 2: Momentum Breakout
**IF:** Price crosses above EMA(200) AND Volume > 2x 20d average
**AND:** MACD histogram turning positive
**THEN:** Send breakout alert + generate full analysis
**Priority:** 🔴 High

### Rule 3: Risk-Off Warning
**IF:** VIX > 25 AND DXY rising AND 10Y yields spiking
**OR:** Portfolio drawdown > -3%
**THEN:** Send urgent risk alert + suggest hedges
**Priority:** 🔴 Critical

### Rule 4: Earnings Proximity
**IF:** Ticker has earnings within 3 trading days
**THEN:** Send pre-earnings briefing
**Priority:** 🟡 Medium

### Rule 5: Insider Signal
**IF:** Insider buy detected > $100K in last 7 days
**THEN:** Send insider alert + company analysis
**Priority:** 🟢 Info

### Rule 6: Regime Change
**IF:** Market regime changes (Risk-On ↔ Risk-Off)
**THEN:** Full portfolio review + rebalancing suggestions
**Priority:** 🔴 Critical

## Escalation Logic
1. 🟢 Info → Log + daily summary
2. 🟡 Medium → Immediate alert + quick analysis
3. 🔴 High → Immediate alert + full analysis + trade plan
4. 🔴 Critical → Immediate alert + portfolio review + action items

## Data Sources
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`

## How to Start
Say: "Start monitoring" or "Check alert conditions"
`;
  }

  var TEMPLATE_MAP = {
    'trading-desk': tplTradingDesk,
    'scanner-sniper': tplScannerSniper,
    'portfolio-sentinel': tplPortfolioSentinel,
    'earnings-analyst': tplEarningsAnalyst,
    'news-reactor': tplNewsReactor,
    'alert-architect': tplAlertArchitect
  };

  // ═══════════════════════════════════════
  // MCP SERVER FILES (embedded for ZIP)
  // ═══════════════════════════════════════
  var MCP_SERVER_INDEX = [
    '#!/usr/bin/env node',
    '',
    '/**',
    ' * Market Watch MCP Server',
    ' * Exposes live Market Watch data to AI agents (Claude Code, Cursor, etc.)',
    ' * Data is fetched from articles.market-watch.xyz static JSON endpoints.',
    ' */',
    '',
    "import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';",
    "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
    "import { z } from 'zod';",
    '',
    "const BASE_URL = 'https://articles.market-watch.xyz';",
    'const DATA_URL = `${BASE_URL}/data`;',
    'const MCP_URL = `${BASE_URL}/mcp`;',
    '',
    'async function fetchJSON(url) {',
    '  const res = await fetch(url);',
    '  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);',
    '  return res.json();',
    '}',
    '',
    'async function fetchWatchlist() {',
    '  return fetchJSON(`${MCP_URL}/watchlist.json`);',
    '}',
    '',
    'async function fetchTabData(tab) {',
    '  return fetchJSON(`${DATA_URL}/${tab}.json`);',
    '}',
    '',
    'function extractCardInfo(html) {',
    '  const titleMatch = html.match(/<h2[^>]*>(.*?)<\\/h2>/s);',
    '  const descMatch = html.match(/<p[^>]*>(.*?)<\\/p>/s);',
    '  const hrefMatch = html.match(/href="([^"]+)"/);',
    '  const dateMatch = html.match(/report-card-meta[^>]*>([^<]+)/);',
    '  const tagsMatch = html.match(/data-tags="([^"]*)"/);',
    '  return {',
    "    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',",
    "    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',",
    "    href: hrefMatch ? hrefMatch[1] : '',",
    "    date: dateMatch ? dateMatch[1].trim() : '',",
    "    tags: tagsMatch ? tagsMatch[1] : ''",
    '  };',
    '}',
    '',
    "const server = new McpServer({ name: 'market-watch', version: '1.0.0' });",
    '',
    "server.tool('get_watchlist', \"Get today's A+ scanner picks with entry/stop/TP levels, market regime, and alerts.\", {}, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.tool('get_market_regime', 'Get current market regime (Risk-On/Risk-Off), VIX, DXY, S&P 500, fear/greed.', {}, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { content: [{ type: 'text', text: JSON.stringify({ regime: data.regime, vix: data.vix, dxy: data.dxy, us10y: data.us10y, spx: data.spx, fear_greed: data.fear_greed, alerts: data.alerts, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('get_pick_detail', 'Get detailed info on a specific scanner pick by ticker.', { ticker: z.string().describe('Ticker symbol (e.g. AAPL, GLD)') }, async ({ ticker }) => {",
    '  const data = await fetchWatchlist();',
    '  const pick = data.picks.find(p => p.ticker.toUpperCase() === ticker.toUpperCase());',
    '  if (!pick) return { content: [{ type: \'text\', text: `Ticker ${ticker} not found. Available: ${data.picks.map(p => p.ticker).join(\', \')}` }] };',
    "  return { content: [{ type: 'text', text: JSON.stringify({ ...pick, regime: data.regime, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('search_articles', 'Search Market Watch articles by ticker or keyword.', { query: z.string(), tab: z.string().optional() }, async ({ query, tab }) => {",
    "  const tabs = tab ? [tab] : ['analyses', 'daily', 'weekly', 'scanner', 'tech', 'series'];",
    '  const results = [];',
    '  const q = query.toLowerCase();',
    '  for (const t of tabs) {',
    '    try {',
    '      const cards = await fetchTabData(t);',
    '      for (const html of cards) {',
    '        if (html.toLowerCase().includes(q)) results.push({ tab: t, ...extractCardInfo(html) });',
    '      }',
    '    } catch (e) {}',
    '  }',
    '  return { content: [{ type: \'text\', text: results.length > 0 ? JSON.stringify(results.slice(0, 20), null, 2) : `No articles found for "${query}"` }] };',
    '});',
    '',
    "server.tool('get_article_list', 'List latest articles by type.', { tab: z.enum(['daily', 'weekly', 'analyses', 'scanner', 'tech', 'series']), limit: z.number().optional() }, async ({ tab, limit }) => {",
    '  const cards = await fetchTabData(tab);',
    '  const articles = cards.slice(0, limit || 10).map(html => extractCardInfo(html));',
    "  return { content: [{ type: 'text', text: JSON.stringify({ tab, count: cards.length, showing: articles.length, articles }, null, 2) }] };",
    '});',
    '',
    "server.resource('watchlist', 'marketwatch://watchlist', { description: 'Current A+ picks watchlist', mimeType: 'application/json' }, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { contents: [{ uri: 'marketwatch://watchlist', mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.resource('articles-{tab}', new ResourceTemplate('marketwatch://articles/{tab}', { list: undefined }), { description: 'Articles by tab', mimeType: 'application/json' }, async (uri, { tab }) => {",
    '  const cards = await fetchTabData(tab);',
    '  const articles = cards.slice(0, 20).map(html => extractCardInfo(html));',
    "  return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ tab, count: cards.length, articles }, null, 2) }] };",
    '});',
    '',
    'const transport = new StdioServerTransport();',
    'await server.connect(transport);'
  ].join('\n');

  var MCP_SERVER_PKG = JSON.stringify({
    name: "market-watch-mcp",
    version: "1.0.0",
    description: "Market Watch MCP Server — Live scanner picks & articles for AI agents",
    type: "module",
    main: "index.js",
    bin: { "mw-mcp": "./index.js" },
    scripts: { start: "node index.js" },
    dependencies: { "@modelcontextprotocol/sdk": "^1.27.1" }
  }, null, 2);

  var MCP_DOT_JSON = function(serverPath) {
    return JSON.stringify({
      mcpServers: {
        "market-watch": {
          command: "node",
          args: [serverPath]
        }
      }
    }, null, 2);
  };

  // ═══════════════════════════════════════
  // README TEMPLATE
  // ═══════════════════════════════════════
  function generateReadme(workflow, tickers) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    return `# ${wf.icon} ${wf.title} — Market Watch AI Agent

${wf.desc}

## Quick Start (3 steps)

\`\`\`bash
# 1. Install the MCP server (one time only)
cd mcp-server && npm install && cd ..

# 2. Launch Claude Code
claude

# 3. Say one of these:
#    "Run the morning scan"
#    "Analyze today's picks"
#    "Start monitoring"
\`\`\`

That's it. Claude Code auto-detects \`.mcp.json\` and loads the Market Watch MCP server.
The server fetches **live data** from articles.market-watch.xyz (updated daily at 23:00 UTC).

## What's Inside

| File | Purpose |
|------|---------|
| \`CLAUDE.md\` | AI agent configuration (the brain) |
| \`.cursorrules\` | Same config, auto-detected by Cursor |
| \`.mcp.json\` | MCP server config for Claude Code |
| \`mcp-server/index.js\` | The MCP server (fetches live data) |
| \`mcp-server/package.json\` | Server dependencies |
| \`README.md\` | This file |
${workflow === 'portfolio-sentinel' ? '| `portfolio.json` | Your portfolio holdings (edit this) |\n' : ''}${workflow === 'earnings-analyst' ? '| `earnings-watchlist.json` | Tickers to track for earnings |\n' : ''}${workflow === 'alert-architect' ? '| `alerts-config.json` | Alert rules configuration |\n' : ''}
## MCP Server — Available Tools

| Tool | Description |
|------|-------------|
| \`get_watchlist\` | Today's A+ scanner picks with entry/stop/TP |
| \`get_market_regime\` | Current regime, VIX, DXY, fear/greed |
| \`get_pick_detail\` | Deep info on a specific pick by ticker |
| \`search_articles\` | Search 250+ published analyses |
| \`get_article_list\` | List latest articles by type |

## Alternative Setup (Cursor, ChatGPT, Gemini)

### Cursor
1. Open this folder in Cursor → \`.cursorrules\` is auto-detected
2. Ask: "Run the workflow"

### ChatGPT / Gemini / Other
1. Copy the contents of \`CLAUDE.md\`
2. Paste as system prompt
3. The AI will fetch data from \`https://articles.market-watch.xyz/mcp/watchlist.json\`

## Powered by Market Watch
https://articles.market-watch.xyz

---
*This is not financial advice. Always do your own research.*
`;
  }

  // ═══════════════════════════════════════
  // ZIP GENERATION (using JSZip-like approach with Blob)
  // ═══════════════════════════════════════
  function generateZip(workflow, tickers) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    var claudeMd = TEMPLATE_MAP[workflow](tickers);
    var readme = generateReadme(workflow, tickers);

    var files = [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.cursorrules', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: 'mcp-server/index.js', content: MCP_SERVER_INDEX },
      { name: 'mcp-server/package.json', content: MCP_SERVER_PKG },
      { name: 'README.md', content: readme }
    ];

    if (workflow === 'portfolio-sentinel') {
      files.push({
        name: 'portfolio.json',
        content: JSON.stringify({
          holdings: (tickers || 'AAPL,NVDA,BTC-USD,GLD,TLT').split(',').map(function(t, i) {
            return { ticker: t.trim(), weight: Math.round(100 / ((tickers || 'AAPL,NVDA,BTC-USD,GLD,TLT').split(',').length)), notes: '' };
          }),
          risk_tolerance: 'moderate',
          max_drawdown_pct: -10,
          rebalance_threshold_pct: 5
        }, null, 2)
      });
    }

    if (workflow === 'earnings-analyst') {
      files.push({
        name: 'earnings-watchlist.json',
        content: JSON.stringify({
          tickers: (tickers || 'AAPL,NVDA,AVGO,COST').split(',').map(function(t) { return t.trim(); }),
          auto_include_scanner: true,
          lookback_quarters: 4,
          alert_days_before: 3
        }, null, 2)
      });
    }

    if (workflow === 'alert-architect') {
      files.push({
        name: 'alerts-config.json',
        content: JSON.stringify({
          tickers: (tickers || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean),
          use_scanner_picks: true,
          rules: [
            { name: 'Oversold Entry', condition: 'RSI(14) < 30 AND near support', priority: 'medium', enabled: true },
            { name: 'Momentum Breakout', condition: 'Price > EMA(200) AND Volume > 2x avg', priority: 'high', enabled: true },
            { name: 'Risk-Off Warning', condition: 'VIX > 25 OR drawdown > -3%', priority: 'critical', enabled: true }
          ],
          destinations: { telegram: '', discord_webhook: '', save_to_file: true }
        }, null, 2)
      });
    }

    return files;
  }

  // Simple TAR-like download (individual files in a folder)
  // We use a multi-file download approach with a single combined .md for simplicity,
  // or JSZip if available. Fallback: download CLAUDE.md directly.
  function downloadProject(workflow, tickers) {
    var files = generateZip(workflow, tickers);

    // Try using JSZip if loaded
    if (typeof JSZip !== 'undefined') {
      var zip = new JSZip();
      var folder = zip.folder(workflow);
      files.forEach(function(f) { folder.file(f.name, f.content); });
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = workflow + '.zip';
        a.click();
        URL.revokeObjectURL(url);
      });
      return;
    }

    // Fallback: download as a single combined file
    var combined = files.map(function(f) {
      return '# ══════════════════════════════════════\n# FILE: ' + f.name + '\n# ══════════════════════════════════════\n\n' + f.content;
    }).join('\n\n\n');

    var blob = new Blob([combined], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = workflow + '-project.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════
  // RENDER AGENT PANEL
  // ═══════════════════════════════════════
  function renderAgentPanel() {
    var panel = document.getElementById('panelAgent');
    if (!panel) return;

    var html = '<p class="lib-intro">' + L.agentIntro + '</p>';
    html += '<div class="wf-grid">';
    WORKFLOWS.forEach(function(wf) {
      html += '<button class="wf-card" data-wf="' + wf.id + '" type="button">';
      html += '<span class="wf-icon">' + wf.icon + '</span>';
      html += '<span class="wf-title">' + wf.title + '</span>';
      html += '<span class="wf-sub">' + wf.sub + '</span>';
      html += '</button>';
    });
    html += '</div>';

    // Config area (shown when a workflow is selected)
    html += '<div class="wf-config" id="wfConfig" style="display:none">';
    html += '<div class="wf-config-header">';
    html += '<span class="wf-config-icon" id="wfConfigIcon"></span>';
    html += '<div><div class="wf-config-title" id="wfConfigTitle"></div>';
    html += '<div class="wf-config-desc" id="wfConfigDesc"></div></div>';
    html += '</div>';

    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-list"></i> ' + L.watchlist + '</div>';
    html += '<input type="text" class="fi" id="wfTickers" placeholder="' + L.watchlistPh + '">';
    html += '<label class="wf-checkbox"><input type="checkbox" id="wfUseScanner" checked> <span>' + L.useScannerPicks + '</span></label></div>';

    html += '<div class="wf-config-files" id="wfConfigFiles"></div>';

    html += '<div class="wf-actions">';
    html += '<button class="gen-btn" id="wfGenerateBtn" type="button" onclick="window._generateAgent()">';
    html += '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.generate + '</button>';
    html += '</div></div>';

    // Output area
    html += '<div class="wf-output" id="wfOutput" style="display:none">';
    html += '<div class="output-header"><h3><i class="fa-solid fa-file-code"></i> CLAUDE.md</h3>';
    html += '<div class="output-meta"><span id="wfOutputChars"><i class="fa-solid fa-text-width"></i></span></div></div>';
    html += '<pre class="prompt-output" id="wfOutputCode"></pre>';
    html += '<div class="wf-output-actions">';
    html += '<button class="action-btn primary" onclick="window._copyAgent()"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
    html += '<button class="action-btn" onclick="window._downloadAgent()"><i class="fa-solid fa-download"></i> ' + L.download + '</button>';
    html += '</div>';
    html += '<div class="wf-howto"><div class="pedagogy-box"><h4><i class="fa-solid fa-graduation-cap"></i> ' + L.howTo + '</h4>';
    html += '<ol><li>' + (isFR ? 'Décompresse le ZIP → <code>cd mcp-server && npm install && cd ..</code>' : 'Unzip → <code>cd mcp-server && npm install && cd ..</code>') + '</li>';
    html += '<li><strong>Claude Code:</strong> <code>claude</code> ' + (isFR ? '(le MCP server est auto-détecté via .mcp.json)' : '(MCP server auto-detected via .mcp.json)') + '</li>';
    html += '<li><strong>Cursor:</strong> ' + (isFR ? 'Ouvre le dossier dans Cursor (.cursorrules auto-détecté)' : 'Open folder in Cursor (.cursorrules auto-detected)') + '</li></ol>';
    html += '</div></div></div>';

    panel.innerHTML = html;

    // Attach card click listeners
    panel.querySelectorAll('.wf-card').forEach(function(card) {
      card.addEventListener('click', function() {
        selectWorkflow(this.dataset.wf);
      });
    });
  }

  var selectedWorkflow = null;

  function selectWorkflow(id) {
    var wf = WORKFLOWS.find(function(w) { return w.id === id; });
    if (!wf) return;
    selectedWorkflow = id;

    // Update card active states
    document.querySelectorAll('.wf-card').forEach(function(c) {
      c.classList.toggle('active', c.dataset.wf === id);
    });

    // Show and populate config
    var config = document.getElementById('wfConfig');
    config.style.display = '';
    document.getElementById('wfConfigIcon').textContent = wf.icon;
    document.getElementById('wfConfigTitle').textContent = wf.title;
    document.getElementById('wfConfigDesc').textContent = wf.desc;

    // Show included files
    var filesHtml = '<div class="fl"><i class="fa-solid fa-folder-open"></i> ' + L.includes + '</div>';
    filesHtml += '<div class="wf-files-list">';
    wf.files.forEach(function(f) {
      var icon = f.endsWith('.md') ? 'fa-file-lines' : 'fa-file-code';
      filesHtml += '<span class="wf-file-badge"><i class="fa-solid ' + icon + '"></i> ' + f + '</span>';
    });
    filesHtml += '</div>';
    document.getElementById('wfConfigFiles').innerHTML = filesHtml;

    // Hide output when switching
    document.getElementById('wfOutput').style.display = 'none';

    // Scroll to config
    config.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  window._generateAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = document.getElementById('wfTickers').value.trim();
    var useScanner = document.getElementById('wfUseScanner').checked;
    if (useScanner && !tickers) tickers = null; // will use "Auto" in template

    var claudeMd = TEMPLATE_MAP[selectedWorkflow](tickers);
    var output = document.getElementById('wfOutput');
    var code = document.getElementById('wfOutputCode');
    code.textContent = claudeMd;
    document.getElementById('wfOutputChars').innerHTML = '<i class="fa-solid fa-text-width"></i> ' + claudeMd.length.toLocaleString() + ' chars';
    output.style.display = '';
    setTimeout(function() { output.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  window._copyAgent = function() {
    var code = document.getElementById('wfOutputCode');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      if (typeof showCopySuccess === 'function') showCopySuccess('Claude Code');
    });
  };

  window._downloadAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = document.getElementById('wfTickers').value.trim() || null;
    downloadProject(selectedWorkflow, tickers);
  };

  // ═══════════════════════════════════════
  // FACTORY MODE — Alert Builder
  // ═══════════════════════════════════════
  var CONDITIONS = [
    { id: 'rsi-low', icon: 'fa-solid fa-arrow-down', label: 'RSI < 30', cat: 'technical' },
    { id: 'rsi-high', icon: 'fa-solid fa-arrow-up', label: 'RSI > 70', cat: 'technical' },
    { id: 'macd-cross', icon: 'fa-solid fa-right-left', label: 'MACD Cross', cat: 'technical' },
    { id: 'ema200-above', icon: 'fa-solid fa-chart-line', label: 'Price > EMA200', cat: 'technical' },
    { id: 'ema200-below', icon: 'fa-solid fa-chart-line', label: 'Price < EMA200', cat: 'technical' },
    { id: 'volume-spike', icon: 'fa-solid fa-volume-high', label: isFR ? 'Volume > 2x moy.' : 'Volume > 2x avg', cat: 'technical' },
    { id: '52w-high', icon: 'fa-solid fa-mountain-sun', label: isFR ? 'Nouveau 52W High' : 'New 52W High', cat: 'technical' },
    { id: '52w-low', icon: 'fa-solid fa-water', label: isFR ? 'Nouveau 52W Low' : 'New 52W Low', cat: 'technical' },
    { id: 'vix-25', icon: 'fa-solid fa-triangle-exclamation', label: 'VIX > 25', cat: 'macro' },
    { id: 'vix-35', icon: 'fa-solid fa-skull', label: 'VIX > 35', cat: 'macro' },
    { id: 'regime-change', icon: 'fa-solid fa-rotate', label: isFR ? 'Changement de régime' : 'Regime Change', cat: 'macro' },
    { id: 'rate-decision', icon: 'fa-solid fa-landmark', label: isFR ? 'Décision de taux' : 'Rate Decision', cat: 'macro' },
    { id: 'earnings-near', icon: 'fa-solid fa-calendar', label: isFR ? 'Earnings < 7j' : 'Earnings < 7d', cat: 'event' },
    { id: 'insider-buy', icon: 'fa-solid fa-user-tie', label: 'Insider Buy', cat: 'event' },
    { id: 'analyst-upgrade', icon: 'fa-solid fa-star', label: isFR ? 'Upgrade analyste' : 'Analyst Upgrade', cat: 'event' },
    { id: 'news-catalyst', icon: 'fa-solid fa-newspaper', label: isFR ? 'News majeure' : 'Major News', cat: 'event' }
  ];

  var ACTIONS = [
    { id: 'telegram', icon: 'fa-brands fa-telegram', label: 'Telegram', desc: isFR ? 'Alerte instantanée via bot' : 'Instant alert via bot' },
    { id: 'discord', icon: 'fa-brands fa-discord', label: 'Discord', desc: 'Webhook' },
    { id: 'full-analysis', icon: 'fa-solid fa-microscope', label: isFR ? 'Analyse complète' : 'Full Analysis', desc: isFR ? 'Deep-dive automatique' : 'Auto deep-dive' },
    { id: 'trade-plan', icon: 'fa-solid fa-bullseye', label: 'Trade Plan', desc: isFR ? 'Entry/Stop/TP' : 'Entry/Stop/TP' },
    { id: 'save-report', icon: 'fa-solid fa-file-export', label: isFR ? 'Sauvegarder' : 'Save Report', desc: isFR ? 'Fichier local' : 'Local file' }
  ];

  function renderFactoryPanel() {
    var panel = document.getElementById('panelFactory');
    if (!panel) return;

    var html = '<p class="lib-intro">' + L.factoryIntro + '</p>';
    html += '<div class="prompt-card">';

    // Step 1: Target
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">1</div>';
    html += '<div class="factory-step-label">' + L.step1 + '</div>';
    html += '</div>';
    html += '<div class="fg"><input type="text" class="fi" id="factoryTickers" placeholder="' + L.tickersPh + '">';
    html += '<label class="wf-checkbox"><input type="checkbox" id="factoryUseScanner" checked> <span>' + L.useScannerPicks + '</span></label></div>';

    // Step 2: Conditions
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">2</div>';
    html += '<div class="factory-step-label">' + L.step2 + '</div>';
    html += '</div>';
    html += '<div class="focus-chips" id="factoryConditions">';
    CONDITIONS.forEach(function(c) {
      var catClass = c.cat === 'macro' ? ' chip-macro' : c.cat === 'event' ? ' chip-event' : '';
      html += '<button type="button" class="focus-chip' + catClass + '" data-cond="' + c.id + '">';
      html += '<i class="' + c.icon + '"></i> ' + c.label + '</button>';
    });
    html += '</div>';

    // Step 3: Actions
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">3</div>';
    html += '<div class="factory-step-label">' + L.step3 + '</div>';
    html += '</div>';
    html += '<div class="focus-chips" id="factoryActions">';
    ACTIONS.forEach(function(a) {
      html += '<button type="button" class="focus-chip" data-action="' + a.id + '">';
      html += '<i class="' + a.icon + '"></i> ' + a.label + '</button>';
    });
    html += '</div>';

    // Generate
    html += '<button class="gen-btn" id="factoryGenBtn" type="button" onclick="window._generateFactory()">';
    html += '<i class="fa-solid fa-bolt"></i> ' + L.generate + '</button>';
    html += '</div>';

    // Output
    html += '<div class="wf-output" id="factoryOutput" style="display:none">';
    html += '<div class="output-header"><h3><i class="fa-solid fa-bell"></i> ' + (isFR ? 'Système d\'Alertes' : 'Alert System') + '</h3>';
    html += '<div class="output-meta"><span id="factoryOutputChars"><i class="fa-solid fa-text-width"></i></span></div></div>';
    html += '<pre class="prompt-output" id="factoryOutputCode"></pre>';
    html += '<div class="wf-output-actions">';
    html += '<button class="action-btn primary" onclick="window._copyFactory()"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
    html += '<button class="action-btn" onclick="window._downloadFactory()"><i class="fa-solid fa-download"></i> ' + L.download + '</button>';
    html += '</div>';
    html += '<div class="wf-howto"><div class="pedagogy-box"><h4><i class="fa-solid fa-graduation-cap"></i> ' + L.howTo + '</h4>';
    html += '<ol><li>' + (isFR ? 'Décompresse le ZIP → <code>cd mcp-server && npm install && cd ..</code>' : 'Unzip → <code>cd mcp-server && npm install && cd ..</code>') + '</li>';
    html += '<li><code>claude</code> ' + (isFR ? '(MCP auto-détecté)' : '(MCP auto-detected)') + '</li>';
    html += '<li>"Start monitoring my alerts"</li></ol>';
    html += '</div></div></div>';

    panel.innerHTML = html;

    // Chip toggle logic
    panel.querySelectorAll('.focus-chip').forEach(function(chip) {
      chip.addEventListener('click', function() { this.classList.toggle('active'); });
    });
  }

  function generateAlertCLAUDEmd(tickers, conditions, actions) {
    var condText = conditions.map(function(id) {
      var c = CONDITIONS.find(function(x) { return x.id === id; });
      return c ? '- **' + c.label + '**' : '';
    }).filter(Boolean).join('\n');

    var actionText = actions.map(function(id) {
      var a = ACTIONS.find(function(x) { return x.id === id; });
      return a ? '- **' + a.label + '**: ' + a.desc : '';
    }).filter(Boolean).join('\n');

    return `# Market Watch — Smart Alert System 🔔

## Your Role
You are an intelligent alert monitoring system. You continuously scan market conditions
and trigger alerts when specific criteria are met.

## Data Sources
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Use MarketWatch Gateway MCP if available for real-time data.

## Monitored Assets
${tickers || 'Auto: loaded from Market Watch scanner A+ picks'}

## Alert Conditions (trigger when ANY is true)
${condText || '- RSI(14) < 30\n- Price > EMA(200) with volume spike\n- VIX > 25'}

## Actions (execute ALL when triggered)
${actionText || '- Full Analysis\n- Save Report'}

## Alert Format
\`\`\`
🔔 ALERT TRIGGERED
━━━━━━━━━━━━━━━━━━━━━━━━
Ticker: $TICKER
Condition: $CONDITION_NAME
Current Value: $VALUE
Threshold: $THRESHOLD
Time: $TIMESTAMP
━━━━━━━━━━━━━━━━━━━━━━━━
Priority: 🔴 HIGH / 🟡 MEDIUM / 🟢 INFO
Action: $ACTIONS_TAKEN
\`\`\`

## Monitoring Schedule
- Pre-market (7:00-9:30 AM): every 5 minutes
- Market hours (9:30 AM-4:00 PM): every 15 minutes
- After-hours: every 30 minutes
- Weekend: 2x daily (crypto + geopolitics only)

## Escalation Logic
1. **Single condition met** → Standard alert
2. **Multiple conditions met** → Elevated priority + full analysis
3. **Critical condition** (VIX > 35, drawdown > -5%) → Urgent alert + portfolio review

## Anti-Hallucination
- Only alert on verifiable conditions (real price data, not estimates)
- Include data source and timestamp with every alert
- If data unavailable, say "DATA UNAVAILABLE" — never guess

## How to Start
Say: "Start monitoring" or "Check conditions now"
`;
  }

  window._generateFactory = function() {
    var tickers = document.getElementById('factoryTickers').value.trim();
    var useScanner = document.getElementById('factoryUseScanner').checked;
    if (useScanner && !tickers) tickers = null;

    var conditions = [];
    document.querySelectorAll('#factoryConditions .focus-chip.active').forEach(function(c) {
      conditions.push(c.dataset.cond);
    });
    var actions = [];
    document.querySelectorAll('#factoryActions .focus-chip.active').forEach(function(c) {
      actions.push(c.dataset.action);
    });

    var claudeMd = generateAlertCLAUDEmd(tickers, conditions, actions);
    var output = document.getElementById('factoryOutput');
    document.getElementById('factoryOutputCode').textContent = claudeMd;
    document.getElementById('factoryOutputChars').innerHTML = '<i class="fa-solid fa-text-width"></i> ' + claudeMd.length.toLocaleString() + ' chars';
    output.style.display = '';
    setTimeout(function() { output.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  window._copyFactory = function() {
    var code = document.getElementById('factoryOutputCode');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      if (typeof showCopySuccess === 'function') showCopySuccess('Claude Code');
    });
  };

  window._downloadFactory = function() {
    var tickers = document.getElementById('factoryTickers').value.trim() || null;
    var conditions = [];
    document.querySelectorAll('#factoryConditions .focus-chip.active').forEach(function(c) {
      conditions.push(c.dataset.cond);
    });
    var actions = [];
    document.querySelectorAll('#factoryActions .focus-chip.active').forEach(function(c) {
      actions.push(c.dataset.action);
    });

    var claudeMd = generateAlertCLAUDEmd(tickers, conditions, actions);
    var readme = '# 🔔 Alert System — Market Watch AI Agent\n\n' +
      'Custom alert monitoring system powered by Market Watch data.\n\n' +
      '## Quick Start\n```bash\ncd alert-system\nclaude\n# Say: "Start monitoring"\n```\n\n' +
      '## Files\n- `CLAUDE.md` — AI agent configuration\n- `.cursorrules` — Same config for Cursor\n- `alerts-config.json` — Alert rules (editable)\n\n' +
      '---\n*This is not financial advice.*\n';

    var files = [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.cursorrules', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: 'mcp-server/index.js', content: MCP_SERVER_INDEX },
      { name: 'mcp-server/package.json', content: MCP_SERVER_PKG },
      { name: 'README.md', content: readme },
      { name: 'alerts-config.json', content: JSON.stringify({
        tickers: (tickers || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean),
        use_scanner_picks: true,
        conditions: conditions,
        actions: actions
      }, null, 2) }
    ];

    // Download
    if (typeof JSZip !== 'undefined') {
      var zip = new JSZip();
      var folder = zip.folder('alert-system');
      files.forEach(function(f) { folder.file(f.name, f.content); });
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'alert-system.zip'; a.click();
        URL.revokeObjectURL(url);
      });
    } else {
      var combined = files.map(function(f) {
        return '# FILE: ' + f.name + '\n\n' + f.content;
      }).join('\n\n---\n\n');
      var blob = new Blob([combined], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'alert-system-project.md'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    renderAgentPanel();
    renderFactoryPanel();
  });

})();
