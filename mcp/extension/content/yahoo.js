/**
 * DailyTickers MCP — Yahoo Finance Content Script
 *
 * Injected on finance.yahoo.com pages.
 * - Detects current ticker from URL
 * - Scrapes real-time price, volume, key stats, news, options data
 * - Injects MW overlay badge with score and trade levels
 * - Adds "Add to MW Watchlist" and "Analyze with Claude" buttons
 * - Sends scraped data to background service worker
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const MW_BADGE_ID = 'mw-overlay-badge';
  const MW_BUTTONS_ID = 'mw-inline-buttons';
  const SCRAPE_INTERVAL_MS = 30000; // Re-scrape every 30s

  /* ===== State ===== */
  let currentTicker = null;
  let overlayBadge = null;
  let scrapeTimer = null;

  /* ===== Initialization ===== */
  function init() {
    currentTicker = detectTicker();
    if (!currentTicker) return;

    console.log(`[MW-MCP Yahoo] Detected ticker: ${currentTicker}`);

    // Wait for page to fully load quote data
    waitForElement('[data-testid="qsp-price"]', () => {
      scrapeAndSend();
      injectOverlayBadge();
      injectActionButtons();

      // Periodic re-scrape
      scrapeTimer = setInterval(scrapeAndSend, SCRAPE_INTERVAL_MS);
    });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Ticker Detection ===== */
  function detectTicker() {
    // URL patterns: /quote/AAPL/, /quote/AAPL, /quote/AAPL?p=AAPL
    const match = window.location.pathname.match(/\/quote\/([A-Z0-9.\-^]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /* ===== Data Scraping ===== */
  function scrapePageData() {
    const data = {
      ticker: currentTicker,
      timestamp: Date.now(),
      price: null,
      change: null,
      changePercent: null,
      volume: null,
      avgVolume: null,
      marketCap: null,
      pe: null,
      eps: null,
      dividend: null,
      high52w: null,
      low52w: null,
      beta: null,
      news: [],
      optionsAvailable: false
    };

    // Price
    const priceEl = document.querySelector('[data-testid="qsp-price"]');
    if (priceEl) data.price = parseFloat(priceEl.textContent.replace(/,/g, ''));

    // Change & Change%
    const changeEl = document.querySelector('[data-testid="qsp-price-change"]');
    if (changeEl) data.change = parseFloat(changeEl.textContent.replace(/[(),]/g, ''));

    const changePctEl = document.querySelector('[data-testid="qsp-price-change-percent"]');
    if (changePctEl) {
      const pctText = changePctEl.textContent.replace(/[()%,]/g, '');
      data.changePercent = parseFloat(pctText);
    }

    // Key statistics from the quote summary table
    const statRows = document.querySelectorAll('[data-testid="quote-statistics"] tr, [data-testid="qsp-statistics"] li');
    statRows.forEach(row => {
      const label = row.querySelector('td:first-child, span:first-child');
      const value = row.querySelector('td:last-child, span:last-child');
      if (!label || !value) return;

      const labelText = label.textContent.trim().toLowerCase();
      const valueText = value.textContent.trim();

      if (labelText.includes('volume') && !labelText.includes('avg')) {
        data.volume = parseStatValue(valueText);
      } else if (labelText.includes('avg') && labelText.includes('volume')) {
        data.avgVolume = parseStatValue(valueText);
      } else if (labelText.includes('market cap')) {
        data.marketCap = valueText;
      } else if (labelText.includes('pe ratio') || labelText.includes('p/e')) {
        data.pe = parseFloat(valueText);
      } else if (labelText.includes('eps')) {
        data.eps = parseFloat(valueText);
      } else if (labelText.includes('dividend') && labelText.includes('yield')) {
        data.dividend = valueText;
      } else if (labelText.includes('52') && labelText.includes('high')) {
        data.high52w = parseFloat(valueText.replace(/,/g, ''));
      } else if (labelText.includes('52') && labelText.includes('low')) {
        data.low52w = parseFloat(valueText.replace(/,/g, ''));
      } else if (labelText.includes('beta')) {
        data.beta = parseFloat(valueText);
      }
    });

    // News headlines
    const newsItems = document.querySelectorAll('[data-testid="news-stream"] a h3, .stream-item a h3');
    newsItems.forEach(h3 => {
      if (data.news.length < 5) {
        data.news.push(h3.textContent.trim());
      }
    });

    // Options tab available?
    const optionsTab = document.querySelector('a[href*="/options/"], [data-testid="OPTIONS"]');
    data.optionsAvailable = !!optionsTab;

    return data;
  }

  function scrapeAndSend() {
    const data = scrapePageData();
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'yahoo',
      data
    });
  }

  /* ===== Overlay Badge ===== */
  function injectOverlayBadge() {
    if (document.getElementById(MW_BADGE_ID)) return;

    overlayBadge = document.createElement('div');
    overlayBadge.id = MW_BADGE_ID;
    overlayBadge.className = 'mw-overlay-badge mw-watching';
    overlayBadge.innerHTML = `
      <span class="mw-overlay-score" title="MW Composite Score">--</span>
      <span class="mw-overlay-divider"></span>
      <div class="mw-overlay-levels">
        <div class="mw-overlay-level">
          <span class="mw-overlay-level-label">Entry</span>
          <span class="mw-overlay-level-value entry" id="mw-entry">--</span>
        </div>
        <div class="mw-overlay-level">
          <span class="mw-overlay-level-label">Stop</span>
          <span class="mw-overlay-level-value stop" id="mw-stop">--</span>
        </div>
        <div class="mw-overlay-level">
          <span class="mw-overlay-level-label">TP1</span>
          <span class="mw-overlay-level-value tp1" id="mw-tp1">--</span>
        </div>
        <div class="mw-overlay-level">
          <span class="mw-overlay-level-label">TP2</span>
          <span class="mw-overlay-level-value tp2" id="mw-tp2">--</span>
        </div>
      </div>
      <button class="mw-overlay-dismiss" title="Dismiss">&times;</button>
    `;

    document.body.appendChild(overlayBadge);

    // Click badge to open MW analysis
    overlayBadge.addEventListener('click', (e) => {
      if (e.target.classList.contains('mw-overlay-dismiss')) {
        overlayBadge.classList.add('mw-hidden');
        return;
      }
      window.open(`https://articles.dailytickers.com/analyses/${currentTicker}/`, '_blank');
    });

    // Load watchlist data to populate levels
    loadWatchlistLevels();
  }

  async function loadWatchlistLevels() {
    const data = await chrome.storage.local.get('mw_watchlist');
    const watchlist = data.mw_watchlist || [];
    const item = watchlist.find(w => w.ticker === currentTicker);

    if (item && item.levels) {
      updateBadgeLevels(item.levels, item.score);
    }

    // Also check scraped data for score
    const scraped = await chrome.storage.local.get('mw_scraped');
    const tickerData = scraped.mw_scraped?.[currentTicker];
    if (tickerData?.mcp?.score) {
      document.querySelector('.mw-overlay-score').textContent = tickerData.mcp.score;
    }
  }

  function updateBadgeLevels(levels, score) {
    if (!overlayBadge) return;

    if (score) {
      overlayBadge.querySelector('.mw-overlay-score').textContent = score;
    }
    if (levels.entry) document.getElementById('mw-entry').textContent = '$' + levels.entry.toFixed(0);
    if (levels.stop) document.getElementById('mw-stop').textContent = '$' + levels.stop.toFixed(0);
    if (levels.tp1) document.getElementById('mw-tp1').textContent = '$' + levels.tp1.toFixed(0);
    if (levels.tp2) document.getElementById('mw-tp2').textContent = '$' + levels.tp2.toFixed(0);

    // Update badge color based on current price vs levels
    const priceEl = document.querySelector('[data-testid="qsp-price"]');
    if (priceEl && levels.stop && levels.tp1) {
      const price = parseFloat(priceEl.textContent.replace(/,/g, ''));
      overlayBadge.classList.remove('mw-bullish', 'mw-bearish', 'mw-watching', 'mw-stop-nearby');

      if (price >= levels.tp1) {
        overlayBadge.classList.add('mw-bullish');
      } else if (levels.stop && Math.abs(price - levels.stop) / levels.stop < 0.03) {
        overlayBadge.classList.add('mw-stop-nearby');
      } else if (price <= levels.stop) {
        overlayBadge.classList.add('mw-bearish');
      } else {
        overlayBadge.classList.add('mw-watching');
      }
    }
  }

  /* ===== Action Buttons ===== */
  function injectActionButtons() {
    if (document.getElementById(MW_BUTTONS_ID)) return;

    // Find the quote header area
    const header = document.querySelector('[data-testid="quote-header"], .quote-header-section h1, section[data-testid="quoteHeaderTitle"]');
    if (!header) return;

    const container = document.createElement('span');
    container.id = MW_BUTTONS_ID;

    // "Add to MW Watchlist" button
    const addBtn = document.createElement('button');
    addBtn.className = 'mw-inline-btn mw-btn-green';
    addBtn.innerHTML = '+ MW Watchlist';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'ADD_TO_WATCHLIST',
        ticker: currentTicker
      });
      addBtn.innerHTML = '&#10003; Added';
      addBtn.style.opacity = '0.6';
      addBtn.disabled = true;
    });

    // "Analyze with Claude" button
    const analyzeBtn = document.createElement('button');
    analyzeBtn.className = 'mw-inline-btn mw-btn-purple';
    analyzeBtn.innerHTML = 'Analyze';
    analyzeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'ANALYZE_TICKER',
        url: window.location.href,
        title: document.title
      });
    });

    container.appendChild(addBtn);
    container.appendChild(analyzeBtn);
    header.appendChild(container);
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'GET_PAGE_DATA') {
      sendResponse(scrapePageData());
      return true;
    }
    if (msg.type === 'UPDATE_LEVELS') {
      updateBadgeLevels(msg.levels, msg.score);
      sendResponse({ ok: true });
      return true;
    }
  }

  /* ===== Utilities ===== */
  function parseStatValue(str) {
    if (!str) return null;
    str = str.trim().replace(/,/g, '');
    const multipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    const match = str.match(/^([\d.]+)\s*([KMBT])?$/i);
    if (match) {
      const num = parseFloat(match[1]);
      const mult = match[2] ? multipliers[match[2].toUpperCase()] || 1 : 1;
      return num * mult;
    }
    return parseFloat(str) || null;
  }

  function waitForElement(selector, callback, maxWait = 10000) {
    const el = document.querySelector(selector);
    if (el) { callback(el); return; }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        callback(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback: run anyway after maxWait
    setTimeout(() => {
      observer.disconnect();
      callback(null);
    }, maxWait);
  }

  /* ===== Cleanup on navigation ===== */
  window.addEventListener('beforeunload', () => {
    if (scrapeTimer) clearInterval(scrapeTimer);
  });

  // SPA-aware: re-init on URL change
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (scrapeTimer) clearInterval(scrapeTimer);
      // Remove old overlay elements
      document.getElementById(MW_BADGE_ID)?.remove();
      document.getElementById(MW_BUTTONS_ID)?.remove();
      // Re-init
      setTimeout(init, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
