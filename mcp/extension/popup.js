/**
 * Market Watch MCP — Popup Controller
 *
 * Manages the popup UI: watchlist table, alerts feed, quick actions,
 * settings panel, and communication with the background service worker.
 */

document.addEventListener('DOMContentLoaded', init);

/* ===== State ===== */
let watchlist = [];
let alerts = [];
let settings = {
  mcpHost: 'localhost:3847',
  pollInterval: 15,
  notificationsEnabled: true
};

/* ===== Initialization ===== */
async function init() {
  await loadSettings();
  await loadWatchlist();
  await loadAlerts();
  bindEvents();
  checkConnectionStatus();
  renderWatchlist();
  renderAlerts();
  updateStats();
}

/* ===== Storage Helpers ===== */
async function loadSettings() {
  const data = await chrome.storage.local.get('mw_settings');
  if (data.mw_settings) {
    settings = { ...settings, ...data.mw_settings };
  }
  document.getElementById('mcpHost').value = settings.mcpHost;
  document.getElementById('pollInterval').value = settings.pollInterval;
  document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
}

async function saveSettingsToStorage() {
  settings.mcpHost = document.getElementById('mcpHost').value.trim() || 'localhost:3847';
  settings.pollInterval = parseInt(document.getElementById('pollInterval').value, 10) || 15;
  settings.notificationsEnabled = document.getElementById('notificationsEnabled').checked;
  await chrome.storage.local.set({ mw_settings: settings });
  // Notify background to reconnect with new settings
  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings });
}

async function loadWatchlist() {
  const data = await chrome.storage.local.get('mw_watchlist');
  watchlist = data.mw_watchlist || [];
}

async function saveWatchlist() {
  await chrome.storage.local.set({ mw_watchlist: watchlist });
  chrome.runtime.sendMessage({ type: 'WATCHLIST_UPDATED', watchlist });
}

async function loadAlerts() {
  const data = await chrome.storage.local.get('mw_alerts');
  alerts = data.mw_alerts || [];
}

/* ===== Event Bindings ===== */
function bindEvents() {
  // Settings toggle
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('saveSettings').addEventListener('click', async () => {
    await saveSettingsToStorage();
    document.getElementById('settingsPanel').style.display = 'none';
  });
  document.getElementById('cancelSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').style.display = 'none';
  });

  // Quick actions
  document.getElementById('addTickerBtn').addEventListener('click', addCurrentPageTicker);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeCurrentTicker);
  document.getElementById('runDdBtn').addEventListener('click', runDueDiligence);
  document.getElementById('refreshWatchlist').addEventListener('click', refreshQuotes);

  // Listen for background updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'QUOTES_UPDATED') {
      updateQuotesInWatchlist(msg.quotes);
    }
    if (msg.type === 'ALERT_TRIGGERED') {
      alerts.unshift(msg.alert);
      if (alerts.length > 20) alerts.pop();
      renderAlerts();
      updateStats();
    }
    if (msg.type === 'CONNECTION_STATUS') {
      setConnectionStatus(msg.connected);
    }
  });
}

/* ===== Connection Status ===== */
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) {
      setConnectionStatus(response.connected);
    }
  });
}

function setConnectionStatus(connected) {
  const dot = document.getElementById('statusDot');
  dot.className = connected ? 'mw-status connected' : 'mw-status';
  dot.title = connected ? 'Connected to MCP' : 'Disconnected';
}

/* ===== Watchlist Rendering ===== */
function renderWatchlist() {
  const tbody = document.getElementById('watchlistBody');
  const empty = document.getElementById('watchlistEmpty');

  if (watchlist.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = watchlist.map((item, idx) => {
    const changeClass = (item.changePercent || 0) >= 0 ? 'up' : 'down';
    const changeSign = (item.changePercent || 0) >= 0 ? '+' : '';
    const statusBadge = getStatusBadge(item);

    return `
      <tr data-idx="${idx}">
        <td class="mw-ticker" title="Open on Yahoo Finance">${item.ticker}</td>
        <td class="mw-price">${item.price ? '$' + item.price.toFixed(2) : '—'}</td>
        <td class="mw-change ${changeClass}">${item.changePercent != null ? changeSign + item.changePercent.toFixed(2) + '%' : '—'}</td>
        <td>${statusBadge}</td>
        <td style="text-align:right">
          <button class="mw-remove-btn" data-idx="${idx}" title="Remove">
            <i class="fas fa-xmark"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind click events
  tbody.querySelectorAll('.mw-ticker').forEach(el => {
    el.addEventListener('click', () => {
      const ticker = el.textContent.trim();
      chrome.tabs.create({ url: `https://finance.yahoo.com/quote/${ticker}/` });
    });
  });

  tbody.querySelectorAll('.mw-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      watchlist.splice(idx, 1);
      await saveWatchlist();
      renderWatchlist();
      updateStats();
    });
  });
}

function getStatusBadge(item) {
  if (!item.price || !item.levels) {
    return '<span class="mw-status-badge watching">Watch</span>';
  }
  const { entry, stop, tp1, tp2 } = item.levels;
  if (tp2 && item.price >= tp2) return '<span class="mw-status-badge tp2">TP2</span>';
  if (tp1 && item.price >= tp1) return '<span class="mw-status-badge tp1">TP1</span>';
  if (stop && item.price <= stop) return '<span class="mw-status-badge stop">Stop</span>';
  if (entry && Math.abs(item.price - entry) / entry < 0.02) return '<span class="mw-status-badge entry">Entry</span>';
  return '<span class="mw-status-badge watching">Watch</span>';
}

/* ===== Alerts Rendering ===== */
function renderAlerts() {
  const list = document.getElementById('alertsList');
  const empty = document.getElementById('alertsEmpty');

  const recent = alerts.slice(0, 3);
  if (recent.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = recent.map(a => {
    const typeClass = a.type === 'stop' ? 'alert-stop' : a.type === 'tp' ? 'alert-tp' : '';
    const icon = a.type === 'stop' ? 'fa-triangle-exclamation' : a.type === 'tp' ? 'fa-check-circle' : 'fa-bell';
    const timeAgo = formatTimeAgo(a.timestamp);

    return `
      <div class="mw-alert-item ${typeClass}">
        <i class="fas ${icon} mw-alert-icon"></i>
        <div class="mw-alert-body">
          <div class="mw-alert-title">${escapeHtml(a.message)}</div>
          <div class="mw-alert-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Stats ===== */
function updateStats() {
  document.getElementById('watchlistCount').textContent = watchlist.length;
  document.getElementById('alertsCount').textContent = alerts.length;

  // Count signals (tickers near entry or hitting TP)
  const signals = watchlist.filter(item => {
    if (!item.price || !item.levels) return false;
    const { entry, tp1, stop } = item.levels;
    if (entry && Math.abs(item.price - entry) / entry < 0.03) return true;
    if (tp1 && item.price >= tp1) return true;
    if (stop && item.price <= stop) return true;
    return false;
  }).length;
  document.getElementById('signalsCount').textContent = signals;
}

/* ===== Quick Actions ===== */
async function addCurrentPageTicker() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Try to extract ticker from current tab URL
  let ticker = null;
  const yahooMatch = tab.url.match(/finance\.yahoo\.com\/quote\/([A-Z0-9.\-^]+)/i);
  const finvizMatch = tab.url.match(/finviz\.com\/quote\.ashx\?t=([A-Z0-9.]+)/i);
  const tvMatch = tab.url.match(/tradingview\.com\/symbols\/([A-Z0-9]+)/i);
  const stMatch = tab.url.match(/stocktwits\.com\/symbol\/([A-Z0-9.]+)/i);

  if (yahooMatch) ticker = yahooMatch[1].toUpperCase();
  else if (finvizMatch) ticker = finvizMatch[1].toUpperCase();
  else if (tvMatch) ticker = tvMatch[1].toUpperCase();
  else if (stMatch) ticker = stMatch[1].toUpperCase();

  if (!ticker) {
    // Prompt for manual ticker entry
    ticker = prompt('Enter ticker symbol (e.g., AAPL):');
    if (!ticker) return;
    ticker = ticker.trim().toUpperCase();
  }

  // Check if already in watchlist
  if (watchlist.find(w => w.ticker === ticker)) {
    return; // Already watching
  }

  watchlist.push({
    ticker,
    price: null,
    changePercent: null,
    levels: null,
    addedAt: Date.now()
  });

  await saveWatchlist();
  renderWatchlist();
  updateStats();

  // Request immediate quote from background
  chrome.runtime.sendMessage({ type: 'FETCH_QUOTE', ticker });
}

function analyzeCurrentTicker() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.runtime.sendMessage({
      type: 'ANALYZE_TICKER',
      url: tab.url,
      title: tab.title
    });
  });
}

function runDueDiligence() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.runtime.sendMessage({
      type: 'RUN_DD',
      url: tab.url,
      title: tab.title
    });
  });
}

function refreshQuotes() {
  const btn = document.getElementById('refreshWatchlist');
  btn.querySelector('i').classList.add('fa-spin');
  chrome.runtime.sendMessage({ type: 'REFRESH_QUOTES' }, () => {
    setTimeout(() => btn.querySelector('i').classList.remove('fa-spin'), 1000);
  });
}

/* ===== Update quotes received from background ===== */
function updateQuotesInWatchlist(quotes) {
  if (!quotes) return;
  for (const [ticker, data] of Object.entries(quotes)) {
    const item = watchlist.find(w => w.ticker === ticker);
    if (item && data) {
      item.price = data.price;
      item.changePercent = data.changePercent;
    }
  }
  renderWatchlist();
  updateStats();
}

/* ===== Utilities ===== */
function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
