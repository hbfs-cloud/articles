/**
 * DailyTickers MCP — TradingView Content Script
 *
 * Injected on tradingview.com pages.
 * - Detects current ticker from URL and page elements
 * - Adds MW overlay badge with trade levels
 * - Adds "Add to MW Watchlist" button
 * - Sends ticker context to background service worker
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const MW_BADGE_ID = 'mw-overlay-badge';
  const MW_BUTTONS_ID = 'mw-inline-buttons';

  /* ===== State ===== */
  let currentTicker = null;

  /* ===== Initialization ===== */
  function init() {
    currentTicker = detectTicker();
    if (!currentTicker) {
      // TradingView is an SPA; watch for ticker changes
      observeTickerChanges();
      return;
    }

    console.log(`[MW-MCP TradingView] Detected ticker: ${currentTicker}`);
    injectOverlayBadge();
    sendTickerContext();

    // Watch for symbol changes in the SPA
    observeTickerChanges();

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Ticker Detection ===== */
  function detectTicker() {
    // URL: /symbols/AAPL/ or /chart/AAPL/
    const urlMatch = window.location.pathname.match(/\/(symbols|chart)\/([A-Z0-9]+)/i);
    if (urlMatch) return urlMatch[2].toUpperCase();

    // From the symbol header in the chart
    const symbolEl = document.querySelector(
      '[data-symbol-short], .chart-markup-table .symbol-title, ' +
      '.tv-symbol-header__first-line span, #header-toolbar-symbol-search'
    );
    if (symbolEl) {
      const text = symbolEl.getAttribute('data-symbol-short') || symbolEl.textContent;
      const clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (clean.length >= 1 && clean.length <= 6) return clean;
    }

    return null;
  }

  /**
   * Observe for ticker changes in TradingView SPA.
   */
  function observeTickerChanges() {
    let lastTicker = currentTicker;

    // Watch for URL changes (pushState)
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      checkTickerChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      checkTickerChange();
    };

    window.addEventListener('popstate', checkTickerChange);

    // Also watch DOM for symbol changes
    const observer = new MutationObserver(() => {
      checkTickerChange();
    });

    // Observe the header area for symbol changes
    const target = document.querySelector('#header-toolbar-symbol-search, .chart-controls-bar');
    if (target) {
      observer.observe(target, { childList: true, subtree: true, characterData: true });
    }

    function checkTickerChange() {
      const newTicker = detectTicker();
      if (newTicker && newTicker !== lastTicker) {
        lastTicker = newTicker;
        currentTicker = newTicker;
        console.log(`[MW-MCP TradingView] Ticker changed: ${currentTicker}`);

        // Remove old overlay
        document.getElementById(MW_BADGE_ID)?.remove();
        document.getElementById(MW_BUTTONS_ID)?.remove();

        // Re-inject
        injectOverlayBadge();
        sendTickerContext();
      }
    }
  }

  /* ===== Overlay Badge ===== */
  function injectOverlayBadge() {
    if (!currentTicker || document.getElementById(MW_BADGE_ID)) return;

    const badge = document.createElement('div');
    badge.id = MW_BADGE_ID;
    badge.className = 'mw-overlay-badge mw-watching';

    // Position adjustment for TradingView (chart takes full viewport)
    badge.style.top = '50px';
    badge.style.right = '60px';

    badge.innerHTML = `
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
      </div>
      <button class="mw-inline-btn mw-btn-green" id="mw-tv-add" style="margin-left:6px;font-size:10px;padding:3px 8px;">+ Watch</button>
      <button class="mw-overlay-dismiss" title="Dismiss">&times;</button>
    `;

    document.body.appendChild(badge);

    // Click badge to open MW analysis
    badge.addEventListener('click', (e) => {
      if (e.target.classList.contains('mw-overlay-dismiss')) {
        badge.classList.add('mw-hidden');
        return;
      }
      if (e.target.id === 'mw-tv-add' || e.target.closest('#mw-tv-add')) {
        chrome.runtime.sendMessage({ type: 'ADD_TO_WATCHLIST', ticker: currentTicker });
        const btn = document.getElementById('mw-tv-add');
        if (btn) { btn.innerHTML = '&#10003;'; btn.disabled = true; btn.style.opacity = '0.6'; }
        return;
      }
      window.open(`https://articles.dailytickers.com/analyses/${currentTicker}/`, '_blank');
    });

    // Load levels
    loadAndDisplayLevels(badge);
  }

  async function loadAndDisplayLevels(badge) {
    const data = await chrome.storage.local.get('mw_watchlist');
    const watchlist = data.mw_watchlist || [];
    const item = watchlist.find(w => w.ticker === currentTicker);

    if (item && item.levels) {
      if (item.score) badge.querySelector('.mw-overlay-score').textContent = item.score;
      if (item.levels.entry) document.getElementById('mw-entry').textContent = '$' + item.levels.entry.toFixed(0);
      if (item.levels.stop) document.getElementById('mw-stop').textContent = '$' + item.levels.stop.toFixed(0);
      if (item.levels.tp1) document.getElementById('mw-tp1').textContent = '$' + item.levels.tp1.toFixed(0);

      // Update Add button state
      const addBtn = document.getElementById('mw-tv-add');
      if (addBtn) { addBtn.innerHTML = '&#10003;'; addBtn.disabled = true; addBtn.style.opacity = '0.6'; }
    }
  }

  /* ===== Context Sending ===== */
  function sendTickerContext() {
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'tradingview',
      data: {
        ticker: currentTicker,
        timestamp: Date.now(),
        url: window.location.href
      }
    });
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'GET_TV_TICKER') {
      sendResponse({ ticker: currentTicker });
      return true;
    }
    if (msg.type === 'UPDATE_LEVELS' && msg.ticker === currentTicker) {
      const badge = document.getElementById(MW_BADGE_ID);
      if (badge && msg.levels) {
        if (msg.score) badge.querySelector('.mw-overlay-score').textContent = msg.score;
        if (msg.levels.entry) document.getElementById('mw-entry').textContent = '$' + msg.levels.entry.toFixed(0);
        if (msg.levels.stop) document.getElementById('mw-stop').textContent = '$' + msg.levels.stop.toFixed(0);
        if (msg.levels.tp1) document.getElementById('mw-tp1').textContent = '$' + msg.levels.tp1.toFixed(0);
      }
      sendResponse({ ok: true });
      return true;
    }
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
