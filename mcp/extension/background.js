/**
 * DailyTickers MCP — Background Service Worker
 *
 * Responsibilities:
 * - WebSocket connection to MCP dashboard (configurable host)
 * - Periodic Yahoo Finance quote polling for watchlist tickers
 * - Alert checking against watchlist entry/stop/TP levels
 * - Chrome notifications for triggered alerts
 * - Message passing to/from popup and content scripts
 * - Hourly watchlist sync via alarm
 */

/* ===== Constants ===== */
const YAHOO_QUOTE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const DEFAULT_POLL_INTERVAL_SEC = 15;
const SYNC_ALARM_NAME = 'mw_watchlist_sync';
const POLL_ALARM_NAME = 'mw_quote_poll';

/* ===== State ===== */
let ws = null;
let wsConnected = false;
let settings = {
  mcpHost: 'localhost:3847',
  pollInterval: 15,
  notificationsEnabled: true
};
let watchlist = [];
let latestQuotes = {};
let alertHistory = [];
let pollTimerId = null;

/* ===== Lifecycle ===== */
self.addEventListener('install', () => {
  console.log('[MW-MCP] Service worker installed');
});

self.addEventListener('activate', () => {
  console.log('[MW-MCP] Service worker activated');
  initialize();
});

// Re-initialize on startup (service worker may restart)
initialize();

async function initialize() {
  await loadSettings();
  await loadWatchlist();
  await loadAlertHistory();
  connectWebSocket();
  setupAlarms();
  startPolling();
}

/* ===== Storage ===== */
async function loadSettings() {
  const data = await chrome.storage.local.get('mw_settings');
  if (data.mw_settings) settings = { ...settings, ...data.mw_settings };
}

async function loadWatchlist() {
  const data = await chrome.storage.local.get('mw_watchlist');
  watchlist = data.mw_watchlist || [];
}

async function saveWatchlist() {
  await chrome.storage.local.set({ mw_watchlist: watchlist });
}

async function loadAlertHistory() {
  const data = await chrome.storage.local.get('mw_alerts');
  alertHistory = data.mw_alerts || [];
}

async function saveAlertHistory() {
  await chrome.storage.local.set({ mw_alerts: alertHistory });
}

/* ===== WebSocket Connection to MCP Dashboard ===== */
function connectWebSocket() {
  if (ws) {
    try { ws.close(); } catch (e) { /* ignore */ }
  }

  const url = `ws://${settings.mcpHost}/ws`;
  console.log(`[MW-MCP] Connecting to WebSocket: ${url}`);

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[MW-MCP] WebSocket connected');
      wsConnected = true;
      broadcastStatus();

      // Send current watchlist to MCP
      ws.send(JSON.stringify({
        type: 'watchlist_sync',
        tickers: watchlist.map(w => w.ticker)
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMcpMessage(msg);
      } catch (e) {
        console.warn('[MW-MCP] Invalid WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[MW-MCP] WebSocket disconnected');
      wsConnected = false;
      broadcastStatus();
      // Reconnect after 10s
      setTimeout(connectWebSocket, 10000);
    };

    ws.onerror = (err) => {
      console.warn('[MW-MCP] WebSocket error:', err);
      wsConnected = false;
      broadcastStatus();
    };
  } catch (e) {
    console.warn('[MW-MCP] Failed to create WebSocket:', e);
    wsConnected = false;
    broadcastStatus();
    setTimeout(connectWebSocket, 10000);
  }
}

function handleMcpMessage(msg) {
  switch (msg.type) {
    case 'quote_update':
      // Real-time quote from MCP
      if (msg.ticker && msg.data) {
        latestQuotes[msg.ticker] = msg.data;
        updateWatchlistQuote(msg.ticker, msg.data);
        checkAlerts(msg.ticker, msg.data.price);
      }
      break;

    case 'alert':
      // Alert from MCP server
      triggerAlert(msg);
      break;

    case 'watchlist_data':
      // Full watchlist data with levels from MCP
      if (msg.items && Array.isArray(msg.items)) {
        for (const item of msg.items) {
          const existing = watchlist.find(w => w.ticker === item.ticker);
          if (existing) {
            existing.levels = item.levels || existing.levels;
            existing.score = item.score || existing.score;
          }
        }
        saveWatchlist();
      }
      break;

    default:
      console.log('[MW-MCP] Unknown message type:', msg.type);
  }
}

function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: 'CONNECTION_STATUS',
    connected: wsConnected
  }).catch(() => { /* popup may be closed */ });
}

/* ===== Alarms ===== */
function setupAlarms() {
  // Hourly sync alarm
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 60 });

  // Quote polling alarm (backup, in case setInterval gets killed)
  chrome.alarms.create(POLL_ALARM_NAME, {
    periodInMinutes: Math.max(1, Math.ceil(settings.pollInterval / 60))
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    syncWatchlistFromMcp();
  }
  if (alarm.name === POLL_ALARM_NAME) {
    fetchAllQuotes();
  }
});

/* ===== Quote Polling ===== */
function startPolling() {
  if (pollTimerId) clearInterval(pollTimerId);
  const intervalMs = (settings.pollInterval || DEFAULT_POLL_INTERVAL_SEC) * 1000;
  pollTimerId = setInterval(fetchAllQuotes, intervalMs);
  // Fetch immediately
  fetchAllQuotes();
}

async function fetchAllQuotes() {
  if (watchlist.length === 0) return;

  const tickers = watchlist.map(w => w.ticker);
  const quotes = {};

  // Fetch in parallel, batches of 5
  const batches = [];
  for (let i = 0; i < tickers.length; i += 5) {
    batches.push(tickers.slice(i, i + 5));
  }

  for (const batch of batches) {
    const promises = batch.map(ticker => fetchYahooQuote(ticker));
    const results = await Promise.allSettled(promises);

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const ticker = batch[idx];
        quotes[ticker] = result.value;
        latestQuotes[ticker] = result.value;
        updateWatchlistQuote(ticker, result.value);
        checkAlerts(ticker, result.value.price);
      }
    });
  }

  // Broadcast to popup
  chrome.runtime.sendMessage({
    type: 'QUOTES_UPDATED',
    quotes
  }).catch(() => { /* popup closed */ });
}

async function fetchYahooQuote(ticker) {
  try {
    const url = `${YAHOO_QUOTE_API}${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!resp.ok) return null;

    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    return {
      price,
      prevClose,
      change,
      changePercent,
      volume: meta.regularMarketVolume,
      marketState: meta.marketState,
      currency: meta.currency,
      timestamp: Date.now()
    };
  } catch (e) {
    console.warn(`[MW-MCP] Failed to fetch quote for ${ticker}:`, e);
    return null;
  }
}

function updateWatchlistQuote(ticker, data) {
  const item = watchlist.find(w => w.ticker === ticker);
  if (item) {
    item.price = data.price;
    item.changePercent = data.changePercent;
    item.lastUpdated = Date.now();
    saveWatchlist();
  }
}

/* ===== Alert Checking ===== */
function checkAlerts(ticker, price) {
  if (!price) return;

  const item = watchlist.find(w => w.ticker === ticker);
  if (!item || !item.levels) return;

  const { entry, stop, tp1, tp2 } = item.levels;

  // Check stop loss
  if (stop && price <= stop) {
    const alertKey = `${ticker}_stop_${stop}`;
    if (!wasAlertTriggered(alertKey)) {
      triggerAlert({
        type: 'stop',
        ticker,
        message: `${ticker} hit STOP at $${price.toFixed(2)} (stop: $${stop.toFixed(2)})`,
        price,
        level: stop,
        timestamp: Date.now(),
        key: alertKey
      });
    }
  }

  // Check TP1
  if (tp1 && price >= tp1) {
    const alertKey = `${ticker}_tp1_${tp1}`;
    if (!wasAlertTriggered(alertKey)) {
      triggerAlert({
        type: 'tp',
        ticker,
        message: `${ticker} reached TP1 at $${price.toFixed(2)} (target: $${tp1.toFixed(2)})`,
        price,
        level: tp1,
        timestamp: Date.now(),
        key: alertKey
      });
    }
  }

  // Check TP2
  if (tp2 && price >= tp2) {
    const alertKey = `${ticker}_tp2_${tp2}`;
    if (!wasAlertTriggered(alertKey)) {
      triggerAlert({
        type: 'tp',
        ticker,
        message: `${ticker} reached TP2 at $${price.toFixed(2)} (target: $${tp2.toFixed(2)})`,
        price,
        level: tp2,
        timestamp: Date.now(),
        key: alertKey
      });
    }
  }

  // Check entry zone (within 2%)
  if (entry && Math.abs(price - entry) / entry < 0.02) {
    const alertKey = `${ticker}_entry_${Math.floor(Date.now() / 3600000)}`; // 1 alert per hour
    if (!wasAlertTriggered(alertKey)) {
      triggerAlert({
        type: 'entry',
        ticker,
        message: `${ticker} near ENTRY zone at $${price.toFixed(2)} (entry: $${entry.toFixed(2)})`,
        price,
        level: entry,
        timestamp: Date.now(),
        key: alertKey
      });
    }
  }
}

function wasAlertTriggered(key) {
  return alertHistory.some(a => a.key === key);
}

function triggerAlert(alert) {
  alertHistory.unshift(alert);
  if (alertHistory.length > 50) alertHistory = alertHistory.slice(0, 50);
  saveAlertHistory();

  // Notify popup
  chrome.runtime.sendMessage({
    type: 'ALERT_TRIGGERED',
    alert
  }).catch(() => { /* popup closed */ });

  // Desktop notification
  if (settings.notificationsEnabled) {
    const iconSuffix = alert.type === 'stop' ? ' [STOP]' : alert.type === 'tp' ? ' [TARGET]' : ' [ENTRY]';
    chrome.notifications.create(alert.key || `mw_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `DailyTickers${iconSuffix}`,
      message: alert.message,
      priority: alert.type === 'stop' ? 2 : 1
    });
  }
}

/* ===== MCP Sync ===== */
async function syncWatchlistFromMcp() {
  if (!wsConnected || !ws) return;

  try {
    ws.send(JSON.stringify({
      type: 'watchlist_request',
      tickers: watchlist.map(w => w.ticker)
    }));
    console.log('[MW-MCP] Watchlist sync requested');
  } catch (e) {
    console.warn('[MW-MCP] Failed to sync watchlist:', e);
  }
}

/* ===== Message Handler ===== */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_STATUS':
      sendResponse({ connected: wsConnected });
      return true;

    case 'SETTINGS_UPDATED':
      settings = msg.settings;
      connectWebSocket();
      startPolling();
      setupAlarms();
      sendResponse({ ok: true });
      return true;

    case 'WATCHLIST_UPDATED':
      watchlist = msg.watchlist;
      sendResponse({ ok: true });
      return true;

    case 'FETCH_QUOTE':
      fetchYahooQuote(msg.ticker).then(data => {
        if (data) {
          latestQuotes[msg.ticker] = data;
          updateWatchlistQuote(msg.ticker, data);
          chrome.runtime.sendMessage({
            type: 'QUOTES_UPDATED',
            quotes: { [msg.ticker]: data }
          }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      return true;

    case 'REFRESH_QUOTES':
      fetchAllQuotes().then(() => sendResponse({ ok: true }));
      return true;

    case 'ANALYZE_TICKER':
      handleAnalyzeTicker(msg);
      sendResponse({ ok: true });
      return true;

    case 'RUN_DD':
      handleRunDD(msg);
      sendResponse({ ok: true });
      return true;

    case 'SCRAPED_DATA':
      // Data from content scripts (Yahoo, StockTwits, Reddit, Finviz)
      handleScrapedData(msg.source, msg.data);
      sendResponse({ ok: true });
      return true;

    case 'DEEPSEEK_RESPONSE':
      handleDeepSeekResponse(msg.data);
      sendResponse({ ok: true });
      return true;

    case 'ADD_TO_WATCHLIST':
      addToWatchlist(msg.ticker, msg.levels);
      sendResponse({ ok: true });
      return true;

    default:
      return false;
  }
});

/* ===== Action Handlers ===== */
function handleAnalyzeTicker(msg) {
  const ticker = extractTickerFromUrl(msg.url);
  if (!ticker) return;

  // If MCP connected, send analysis request
  if (wsConnected && ws) {
    ws.send(JSON.stringify({
      type: 'analyze_request',
      ticker,
      url: msg.url
    }));
  }

  // Open MW analysis page
  chrome.tabs.create({
    url: `https://articles.dailytickers.com/analyses/${ticker}/`
  });
}

function handleRunDD(msg) {
  const ticker = extractTickerFromUrl(msg.url);
  if (!ticker) return;

  // Send DD request to MCP
  if (wsConnected && ws) {
    ws.send(JSON.stringify({
      type: 'dd_request',
      ticker,
      url: msg.url
    }));
  }

  // Also try DeepSeek if available
  chrome.tabs.query({ url: 'https://chat.deepseek.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'analyze',
        prompt: `Perform a comprehensive due diligence analysis on ${ticker}. Include: business model, financials, competitive moat, risks, valuation, and a bull/bear thesis. Format as a structured report.`
      });
    }
  });
}

function handleScrapedData(source, data) {
  console.log(`[MW-MCP] Scraped data from ${source}:`, data);

  // Forward to MCP if connected
  if (wsConnected && ws) {
    ws.send(JSON.stringify({
      type: 'scraped_data',
      source,
      data,
      timestamp: Date.now()
    }));
  }

  // Store locally for enrichment
  chrome.storage.local.get('mw_scraped', (stored) => {
    const scraped = stored.mw_scraped || {};
    if (data.ticker) {
      scraped[data.ticker] = {
        ...scraped[data.ticker],
        [source]: { ...data, timestamp: Date.now() }
      };
      chrome.storage.local.set({ mw_scraped: scraped });
    }
  });
}

function handleDeepSeekResponse(data) {
  console.log('[MW-MCP] DeepSeek response received');

  if (wsConnected && ws) {
    ws.send(JSON.stringify({
      type: 'deepseek_response',
      data,
      timestamp: Date.now()
    }));
  }
}

async function addToWatchlist(ticker, levels) {
  if (!ticker) return;
  ticker = ticker.toUpperCase();

  if (watchlist.find(w => w.ticker === ticker)) return;

  watchlist.push({
    ticker,
    price: null,
    changePercent: null,
    levels: levels || null,
    addedAt: Date.now()
  });

  await saveWatchlist();

  // Fetch quote immediately
  const quote = await fetchYahooQuote(ticker);
  if (quote) {
    updateWatchlistQuote(ticker, quote);
    chrome.runtime.sendMessage({
      type: 'QUOTES_UPDATED',
      quotes: { [ticker]: quote }
    }).catch(() => {});
  }
}

/* ===== Utilities ===== */
function extractTickerFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /finance\.yahoo\.com\/quote\/([A-Z0-9.\-^]+)/i,
    /finviz\.com\/quote\.ashx\?t=([A-Z0-9.]+)/i,
    /tradingview\.com\/symbols\/([A-Z0-9]+)/i,
    /stocktwits\.com\/symbol\/([A-Z0-9.]+)/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}
