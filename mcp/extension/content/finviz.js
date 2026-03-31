/**
 * DailyTickers MCP — Finviz Content Script
 *
 * Injected on finviz.com pages.
 * - Scrapes screener results from screener pages
 * - Extracts heatmap data from the map page
 * - Adds MW overlay badge on individual stock pages (/quote.ashx?t=AAPL)
 * - Sends scraped data to background service worker
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
    const pageType = detectPageType();
    console.log(`[MW-MCP Finviz] Page type: ${pageType}`);

    switch (pageType) {
      case 'quote':
        currentTicker = detectTicker();
        if (currentTicker) {
          scrapeQuoteAndSend();
          injectOverlayBadge();
          injectActionButtons();
        }
        break;
      case 'screener':
        scrapeScreenerAndSend();
        break;
      case 'heatmap':
        scrapeHeatmapAndSend();
        break;
    }

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Page Detection ===== */
  function detectPageType() {
    const path = window.location.pathname;
    const search = window.location.search;

    if (path.includes('quote.ashx') || search.includes('t=')) return 'quote';
    if (path.includes('screener.ashx') || path.includes('screener')) return 'screener';
    if (path.includes('map.ashx') || path.includes('map')) return 'heatmap';
    return 'other';
  }

  function detectTicker() {
    const match = window.location.search.match(/[?&]t=([A-Z0-9.]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /* ===== Quote Page Scraping ===== */
  function scrapeQuoteData() {
    const data = {
      ticker: currentTicker,
      timestamp: Date.now(),
      fundamentals: {},
      technicals: {},
      targetPrice: null,
      analystRating: null,
      news: []
    };

    // Scrape the snapshot table (Finviz's main data grid)
    const snapshotTable = document.querySelector('.snapshot-table2, table.snapshot-table2');
    if (snapshotTable) {
      const cells = snapshotTable.querySelectorAll('td');
      for (let i = 0; i < cells.length - 1; i += 2) {
        const label = cells[i]?.textContent?.trim();
        const value = cells[i + 1]?.textContent?.trim();
        if (!label || !value) continue;

        // Map key metrics
        const key = label.toLowerCase();
        if (key.includes('p/e')) data.fundamentals.pe = value;
        else if (key.includes('eps')) data.fundamentals.eps = value;
        else if (key.includes('market cap')) data.fundamentals.marketCap = value;
        else if (key.includes('dividend')) data.fundamentals.dividend = value;
        else if (key.includes('roe')) data.fundamentals.roe = value;
        else if (key.includes('roa')) data.fundamentals.roa = value;
        else if (key.includes('debt/eq')) data.fundamentals.debtToEquity = value;
        else if (key.includes('target price')) data.targetPrice = parseFloat(value);
        else if (key.includes('rsi')) data.technicals.rsi = parseFloat(value);
        else if (key.includes('sma20')) data.technicals.sma20 = value;
        else if (key.includes('sma50')) data.technicals.sma50 = value;
        else if (key.includes('sma200')) data.technicals.sma200 = value;
        else if (key.includes('52w high')) data.technicals.high52w = parseFloat(value);
        else if (key.includes('52w low')) data.technicals.low52w = parseFloat(value);
        else if (key.includes('rel volume')) data.technicals.relVolume = parseFloat(value);
        else if (key.includes('avg volume')) data.technicals.avgVolume = value;
        else if (key.includes('volume')) data.technicals.volume = value;
        else if (key.includes('beta')) data.technicals.beta = parseFloat(value);
        else if (key.includes('atr')) data.technicals.atr = parseFloat(value);
        else if (key.includes('perf week')) data.technicals.perfWeek = value;
        else if (key.includes('perf month')) data.technicals.perfMonth = value;
        else if (key.includes('perf quart')) data.technicals.perfQuarter = value;
        else if (key.includes('perf ytd')) data.technicals.perfYtd = value;
        else if (key.includes('recom')) data.analystRating = value;
        else if (key.includes('short float')) data.fundamentals.shortFloat = value;
        else if (key.includes('insider own')) data.fundamentals.insiderOwn = value;
        else if (key.includes('inst own')) data.fundamentals.instOwn = value;
      }
    }

    // Scrape news
    const newsTable = document.querySelector('.fullview-news-outer table, #news-table');
    if (newsTable) {
      const rows = newsTable.querySelectorAll('tr');
      rows.forEach((row, idx) => {
        if (idx >= 10) return;
        const link = row.querySelector('a');
        const dateCell = row.querySelector('td:first-child');
        if (link) {
          data.news.push({
            title: link.textContent.trim(),
            url: link.href,
            date: dateCell ? dateCell.textContent.trim() : null
          });
        }
      });
    }

    return data;
  }

  function scrapeQuoteAndSend() {
    const data = scrapeQuoteData();
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'finviz',
      data
    });
  }

  /* ===== Screener Scraping ===== */
  function scrapeScreenerData() {
    const data = {
      timestamp: Date.now(),
      results: [],
      totalResults: null
    };

    // Total count
    const countEl = document.querySelector('.screener-total, #screener-total, .count-text');
    if (countEl) {
      const match = countEl.textContent.match(/(\d+)/);
      if (match) data.totalResults = parseInt(match[1], 10);
    }

    // Results table
    const table = document.querySelector('#screener-content table, table.table-top');
    if (!table) return data;

    const headers = [];
    const headerRow = table.querySelector('tr');
    if (headerRow) {
      headerRow.querySelectorAll('th, td').forEach(th => {
        headers.push(th.textContent.trim().toLowerCase());
      });
    }

    const rows = table.querySelectorAll('tr');
    rows.forEach((row, idx) => {
      if (idx === 0) return; // Skip header
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      const result = {};
      cells.forEach((cell, cidx) => {
        const header = headers[cidx] || `col${cidx}`;
        result[header] = cell.textContent.trim();
      });

      // Extract ticker specifically
      const tickerCell = cells[1]; // Usually column 2
      const tickerLink = tickerCell?.querySelector('a');
      if (tickerLink) {
        result.ticker = tickerLink.textContent.trim().toUpperCase();
      }

      if (result.ticker) {
        data.results.push(result);
      }
    });

    return data;
  }

  function scrapeScreenerAndSend() {
    const data = scrapeScreenerData();
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'finviz_screener',
      data
    });
  }

  /* ===== Heatmap Scraping ===== */
  function scrapeHeatmapData() {
    const data = {
      timestamp: Date.now(),
      sectors: {}
    };

    // Finviz heatmap uses SVG/canvas, extract from tooltips or data attributes
    const mapItems = document.querySelectorAll('[data-ticker], rect[data-tooltip]');
    mapItems.forEach(item => {
      const ticker = item.getAttribute('data-ticker') || '';
      const tooltip = item.getAttribute('data-tooltip') || item.textContent || '';
      const fill = item.getAttribute('fill') || '';

      if (ticker) {
        // Determine sector from parent group
        const group = item.closest('g[data-sector]');
        const sector = group ? group.getAttribute('data-sector') : 'unknown';

        if (!data.sectors[sector]) data.sectors[sector] = [];
        data.sectors[sector].push({
          ticker,
          change: parsePercentage(tooltip),
          color: fill
        });
      }
    });

    return data;
  }

  function scrapeHeatmapAndSend() {
    const data = scrapeHeatmapData();
    if (Object.keys(data.sectors).length > 0) {
      chrome.runtime.sendMessage({
        type: 'SCRAPED_DATA',
        source: 'finviz_heatmap',
        data
      });
    }
  }

  /* ===== Overlay Badge ===== */
  function injectOverlayBadge() {
    if (document.getElementById(MW_BADGE_ID)) return;

    const badge = document.createElement('div');
    badge.id = MW_BADGE_ID;
    badge.className = 'mw-overlay-badge mw-watching';
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
      <button class="mw-overlay-dismiss" title="Dismiss">&times;</button>
    `;

    document.body.appendChild(badge);

    badge.addEventListener('click', (e) => {
      if (e.target.classList.contains('mw-overlay-dismiss')) {
        badge.classList.add('mw-hidden');
        return;
      }
      window.open(`https://articles.dailytickers.com/analyses/${currentTicker}/`, '_blank');
    });

    // Load levels from storage
    loadAndDisplayLevels(badge);
  }

  async function loadAndDisplayLevels(badge) {
    const data = await chrome.storage.local.get('mw_watchlist');
    const watchlist = data.mw_watchlist || [];
    const item = watchlist.find(w => w.ticker === currentTicker);

    if (item && item.levels) {
      const scoreEl = badge.querySelector('.mw-overlay-score');
      if (item.score) scoreEl.textContent = item.score;
      if (item.levels.entry) document.getElementById('mw-entry').textContent = '$' + item.levels.entry.toFixed(0);
      if (item.levels.stop) document.getElementById('mw-stop').textContent = '$' + item.levels.stop.toFixed(0);
      if (item.levels.tp1) document.getElementById('mw-tp1').textContent = '$' + item.levels.tp1.toFixed(0);
    }
  }

  /* ===== Action Buttons ===== */
  function injectActionButtons() {
    if (document.getElementById(MW_BUTTONS_ID)) return;

    // Find the stock name area on Finviz quote pages
    const headerArea = document.querySelector('.fullview-title, .quote-header');
    if (!headerArea) return;

    const container = document.createElement('div');
    container.id = MW_BUTTONS_ID;
    container.style.marginTop = '6px';

    const addBtn = document.createElement('button');
    addBtn.className = 'mw-inline-btn mw-btn-green';
    addBtn.innerHTML = '+ MW Watchlist';
    addBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'ADD_TO_WATCHLIST', ticker: currentTicker });
      addBtn.innerHTML = '&#10003; Added';
      addBtn.style.opacity = '0.6';
      addBtn.disabled = true;
    });

    const analyzeBtn = document.createElement('button');
    analyzeBtn.className = 'mw-inline-btn mw-btn-purple';
    analyzeBtn.innerHTML = 'Analyze';
    analyzeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'ANALYZE_TICKER',
        url: window.location.href,
        title: document.title
      });
    });

    container.appendChild(addBtn);
    container.appendChild(analyzeBtn);
    headerArea.appendChild(container);
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'GET_FINVIZ_DATA') {
      const pageType = detectPageType();
      if (pageType === 'quote') sendResponse(scrapeQuoteData());
      else if (pageType === 'screener') sendResponse(scrapeScreenerData());
      else sendResponse(null);
      return true;
    }
  }

  /* ===== Utilities ===== */
  function parsePercentage(str) {
    if (!str) return null;
    const match = str.match(/([-+]?\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : null;
  }

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
