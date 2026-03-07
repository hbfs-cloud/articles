/**
 * Market Watch MCP — Reddit Content Script
 *
 * Injected on reddit.com/r/wallstreetbets and reddit.com/r/stocks.
 * - Scrapes post titles mentioning watchlist tickers
 * - Counts mentions, uses upvotes as sentiment proxy
 * - Sends data to background for alert enrichment
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const SCRAPE_INTERVAL_MS = 120000; // Re-scrape every 2 minutes
  // Common ticker-like words to exclude (false positives)
  const TICKER_BLACKLIST = new Set([
    'A', 'I', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF',
    'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'OK', 'ON', 'OR', 'SO', 'TO',
    'UP', 'US', 'WE', 'ALL', 'ANY', 'ARE', 'BUT', 'CAN', 'CEO', 'CFO',
    'COO', 'CTO', 'DAY', 'DID', 'FOR', 'GET', 'GOT', 'HAS', 'HER', 'HIM',
    'HIS', 'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOT', 'NOW', 'OLD', 'ONE',
    'OUR', 'OUT', 'OWN', 'PUT', 'RUN', 'SAY', 'SHE', 'THE', 'TOO', 'TOP',
    'TWO', 'USE', 'WAR', 'WAS', 'WAY', 'WHO', 'WHY', 'WIN', 'WON', 'YET',
    'YOU', 'DD', 'EPS', 'ETF', 'GDP', 'IMO', 'IPO', 'ITM', 'OTM', 'SEC',
    'ATH', 'ATL', 'FED', 'WSB', 'USA', 'CEO', 'CPI', 'RSI', 'LOL', 'BRO',
    'EDIT', 'GOOD', 'JUST', 'LIKE', 'LONG', 'NEXT', 'ONLY', 'OVER', 'PLAY',
    'PUMP', 'REAL', 'SELL', 'STOP', 'YOLO', 'HOLD', 'MOON', 'GAIN', 'LOSS',
    'BEAR', 'BULL', 'CALL', 'CASH', 'DEBT', 'DIPS', 'DUMP', 'EVER', 'FALL',
    'FIRE', 'FREE', 'FUND', 'HUGE', 'LAST', 'LOAN', 'MAKE', 'MANY', 'MORE',
    'MOST', 'MUCH', 'NEWS', 'PAID', 'PEAK', 'RISK', 'SAFE', 'SAVE', 'SOME',
    'SURE', 'TAKE', 'THAN', 'THAT', 'THEM', 'THEN', 'THIS', 'TIME', 'VERY',
    'WANT', 'WEEK', 'WHAT', 'WHEN', 'WILL', 'WITH', 'WORK', 'YEAR', 'YOUR',
    'HIGH', 'RATE', 'MOVE', 'BEST', 'PUTS', 'PAYS'
  ]);

  /* ===== State ===== */
  let watchlistTickers = [];
  let scrapeTimer = null;

  /* ===== Initialization ===== */
  async function init() {
    console.log('[MW-MCP Reddit] Content script loaded');

    // Load watchlist tickers from storage
    const data = await chrome.storage.local.get('mw_watchlist');
    watchlistTickers = (data.mw_watchlist || []).map(w => w.ticker);

    scrapeAndSend();
    scrapeTimer = setInterval(scrapeAndSend, SCRAPE_INTERVAL_MS);

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /* ===== Scraping ===== */
  function scrapePageData() {
    const subreddit = detectSubreddit();
    const posts = scrapePosts();
    const tickerMentions = extractTickerMentions(posts);

    return {
      subreddit,
      timestamp: Date.now(),
      postsScraped: posts.length,
      tickerMentions,
      topPosts: posts.slice(0, 10).map(p => ({
        title: p.title,
        upvotes: p.upvotes,
        comments: p.comments,
        tickers: p.tickers
      }))
    };
  }

  function detectSubreddit() {
    const match = window.location.pathname.match(/\/r\/(\w+)/);
    return match ? match[1] : null;
  }

  function scrapePosts() {
    const posts = [];

    // New Reddit (shreddit) structure
    const shredditPosts = document.querySelectorAll('shreddit-post, [data-testid="post-container"], article');
    shredditPosts.forEach(post => {
      const titleEl = post.querySelector(
        'a[slot="title"], [data-testid="post-title"], h3, .Post h3'
      );
      const upvoteEl = post.querySelector(
        '[data-testid="vote-score"], shreddit-post-meta [score], .score, faceplate-number'
      );
      const commentEl = post.querySelector(
        'a[data-testid="comment-count"], [data-click-id="comments"] span'
      );

      if (!titleEl) return;

      const title = titleEl.textContent.trim();
      const upvotes = parseRedditNumber(
        upvoteEl ? (upvoteEl.getAttribute('score') || upvoteEl.textContent) : '0'
      );
      const comments = parseRedditNumber(
        commentEl ? commentEl.textContent : '0'
      );

      const tickers = extractTickersFromText(title);

      posts.push({ title, upvotes, comments, tickers });
    });

    // Old Reddit fallback
    if (posts.length === 0) {
      const oldPosts = document.querySelectorAll('.thing.link');
      oldPosts.forEach(post => {
        const titleEl = post.querySelector('a.title');
        const scoreEl = post.querySelector('.score.unvoted, .score.likes, .score');
        const commentEl = post.querySelector('.comments');

        if (!titleEl) return;

        const title = titleEl.textContent.trim();
        const upvotes = parseRedditNumber(scoreEl ? scoreEl.textContent : '0');
        const comments = parseRedditNumber(commentEl ? commentEl.textContent : '0');
        const tickers = extractTickersFromText(title);

        posts.push({ title, upvotes, comments, tickers });
      });
    }

    return posts;
  }

  /* ===== Ticker Extraction ===== */
  function extractTickersFromText(text) {
    const found = [];

    // Pattern 1: $TICKER notation
    const dollarMatches = text.matchAll(/\$([A-Z]{1,5})\b/g);
    for (const m of dollarMatches) {
      const t = m[1];
      if (!TICKER_BLACKLIST.has(t) && t.length >= 2) {
        found.push(t);
      }
    }

    // Pattern 2: ALL-CAPS words that look like tickers (3-5 chars, not in blacklist)
    const capsMatches = text.matchAll(/\b([A-Z]{3,5})\b/g);
    for (const m of capsMatches) {
      const t = m[1];
      if (!TICKER_BLACKLIST.has(t) && !found.includes(t)) {
        found.push(t);
      }
    }

    return [...new Set(found)];
  }

  function extractTickerMentions(posts) {
    const mentions = {};

    posts.forEach(post => {
      post.tickers.forEach(ticker => {
        if (!mentions[ticker]) {
          mentions[ticker] = {
            count: 0,
            totalUpvotes: 0,
            totalComments: 0,
            sentiment: 0, // Upvotes as proxy
            inWatchlist: watchlistTickers.includes(ticker),
            posts: []
          };
        }
        mentions[ticker].count++;
        mentions[ticker].totalUpvotes += post.upvotes;
        mentions[ticker].totalComments += post.comments;
        mentions[ticker].sentiment += post.upvotes; // Simple proxy
        mentions[ticker].posts.push(post.title.substring(0, 100));
      });
    });

    // Sort by mention count
    const sorted = Object.entries(mentions)
      .sort((a, b) => b[1].count - a[1].count)
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});

    return sorted;
  }

  function scrapeAndSend() {
    const data = scrapePageData();
    chrome.runtime.sendMessage({
      type: 'SCRAPED_DATA',
      source: 'reddit',
      data
    });
  }

  /* ===== Message Handler ===== */
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'GET_REDDIT_DATA') {
      sendResponse(scrapePageData());
      return true;
    }
    if (msg.type === 'WATCHLIST_TICKERS') {
      watchlistTickers = msg.tickers || [];
      sendResponse({ ok: true });
      return true;
    }
  }

  /* ===== Utilities ===== */
  function parseRedditNumber(str) {
    if (!str) return 0;
    str = str.trim().toLowerCase().replace(/,/g, '');
    if (str.includes('k')) return Math.round(parseFloat(str) * 1000);
    if (str.includes('m')) return Math.round(parseFloat(str) * 1000000);
    const num = parseInt(str, 10);
    return isNaN(num) ? 0 : num;
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
