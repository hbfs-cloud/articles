/**
 * DailyTickers MCP — StockTwits Content Script
 *
 * Injected on stocktwits.com pages.
 * - Scrapes sentiment data for current ticker
 * - Counts bullish/bearish posts
 * - Extracts trending tickers
 * - Sends data to background for alert enrichment
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const SCRAPE_INTERVAL_MS = 60000; // Re-scrape every 60s

  /* ===== State ===== */
  let currentTicker = null;
  let scrapeTimer = null;

  /* ===== Initialization ===== */
  function init() {
    currentTicker = detectTicker();
    console.log(`[MW-MCP StockTwits] Loaded${currentTicker ? ` — ticker: ${currentTicker}` : ''}`);

    scrapeAndSend();
    scrapeTimer = setInterval(scrapeAndSend, SCRAPE_INTERVAL_MS);

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Ticker Detection ===== */
  function detectTicker() {
    // URL: /symbol/AAPL or /symbol/AAPL/...
    const match = window.location.pathname.match(/\/symbol\/([A-Z0-9.]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /* ===== Scraping ===== */
  function scrapePageData() {
    const data = {
      ticker: currentTicker,
      timestamp: Date.now(),
      sentiment: {
        bullish: 0,
        bearish: 0,
        total: 0,
        score: null // 0-100, 50 = neutral
      },
      trending: [],
      recentMessages: [],
      watchers: null
    };

    // Scrape sentiment gauge if on a symbol page
    if (currentTicker) {
      scrapeSentimentGauge(data);
      scrapeMessages(data);
      scrapeWatchers(data);
    }

    // Scrape trending tickers (available on any page)
    scrapeTrending(data);

    return data;
  }

  function scrapeSentimentGauge(data) {
    // StockTwits shows a sentiment gauge with bullish/bearish percentages
    const gaugeSelectors = [
      '.st-sentiment-gauge',
      '[data-testid="sentiment-gauge"]',
      '.sentiment-bar',
      '.symbol-sentiment'
    ];

    for (const sel of gaugeSelectors) {
      const gauge = document.querySelector(sel);
      if (!gauge) continue;

      // Look for bullish/bearish text or percentage
      const text = gauge.textContent.toLowerCase();
      const bullishMatch = text.match(/bullish[:\s]*(\d+)%/);
      const bearishMatch = text.match(/bearish[:\s]*(\d+)%/);

      if (bullishMatch) data.sentiment.score = parseInt(bullishMatch[1], 10);
      if (bearishMatch && !bullishMatch) data.sentiment.score = 100 - parseInt(bearishMatch[1], 10);
    }

    // Count bullish/bearish badges on messages
    const bullishBadges = document.querySelectorAll(
      '.st-sentiment-bullish, [data-sentiment="bullish"], .sentiment-bullish, .bull'
    );
    const bearishBadges = document.querySelectorAll(
      '.st-sentiment-bearish, [data-sentiment="bearish"], .sentiment-bearish, .bear'
    );

    data.sentiment.bullish = bullishBadges.length;
    data.sentiment.bearish = bearishBadges.length;
    data.sentiment.total = bullishBadges.length + bearishBadges.length;

    if (data.sentiment.total > 0 && data.sentiment.score === null) {
      data.sentiment.score = Math.round(
        (data.sentiment.bullish / data.sentiment.total) * 100
      );
    }
  }

  function scrapeMessages(data) {
    // Get recent message text (first 10)
    const messageSelectors = [
      '.st-message-text',
      '[data-testid="message-body"]',
      '.message-body',
      '.st-tweet-text'
    ];

    for (const sel of messageSelectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length === 0) continue;

      messages.forEach((msg, idx) => {
        if (idx >= 10) return;
        const text = msg.textContent.trim();
        if (text.length > 10) {
          data.recentMessages.push({
            text: text.substring(0, 200),
            sentiment: detectMessageSentiment(msg)
          });
        }
      });
      break;
    }
  }

  function scrapeWatchers(data) {
    // Watcher count
    const watcherSelectors = [
      '.st-watchers-count',
      '[data-testid="watchers"]',
      '.watchers-count'
    ];

    for (const sel of watcherSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const num = el.textContent.replace(/[^0-9.kKmM]/g, '');
        data.watchers = parseCompactNumber(num);
        break;
      }
    }
  }

  function scrapeTrending(data) {
    // Trending tickers sidebar
    const trendingSelectors = [
      '.st-trending-symbol',
      '[data-testid="trending-symbol"]',
      '.trending-symbol a',
      '.trending-list a'
    ];

    for (const sel of trendingSelectors) {
      const items = document.querySelectorAll(sel);
      if (items.length === 0) continue;

      items.forEach(item => {
        const ticker = item.textContent.replace(/[$\s]/g, '').trim().toUpperCase();
        if (ticker.length >= 1 && ticker.length <= 6 && /^[A-Z]+$/.test(ticker)) {
          data.trending.push(ticker);
        }
      });
      break;
    }

    // Deduplicate
    data.trending = [...new Set(data.trending)].slice(0, 20);
  }

  function scrapeAndSend() {
    const data = scrapePageData();
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'stocktwits',
      data
    });
  }

  /* ===== Message Sentiment Detection ===== */
  function detectMessageSentiment(msgElement) {
    // Check parent or sibling for sentiment badge
    const parent = msgElement.closest('.st-message, .message, [data-testid="message"]');
    if (!parent) return 'neutral';

    if (parent.querySelector('.st-sentiment-bullish, [data-sentiment="bullish"], .bull')) {
      return 'bullish';
    }
    if (parent.querySelector('.st-sentiment-bearish, [data-sentiment="bearish"], .bear')) {
      return 'bearish';
    }
    return 'neutral';
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'GET_STOCKTWITS_DATA') {
      sendResponse(scrapePageData());
      return true;
    }
  }

  /* ===== Utilities ===== */
  function parseCompactNumber(str) {
    if (!str) return null;
    const match = str.match(/^([\d.]+)\s*([kKmM])?$/);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const mult = { k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[match[2]] || 1;
    return num * mult;
  }

  /* ===== Cleanup ===== */
  window.addEventListener('beforeunload', () => {
    if (scrapeTimer) clearInterval(scrapeTimer);
  });

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
