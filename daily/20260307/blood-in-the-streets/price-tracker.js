/**
 * Blood in the Streets — Live Price Tracker
 * Fetches current prices via Yahoo Finance and shows % change since article date.
 * Works on both the main index page (.wl-pick items) and sub-watchlist pages (.setup-card items).
 */
(function () {
  var PROXY = 'https://corsproxy.io/?url=';
  var ARTICLE_DATE = '2026-03-07';
  var CACHE_KEY = 'bts-prices';
  var CACHE_TTL = 5 * 60 * 1000; // 5 min

  // ── Helpers ──
  function parsePriceText(t) {
    if (!t) return NaN;
    return parseFloat(t.replace(/[^0-9.\-]/g, ''));
  }

  function fmtPct(v) {
    var sign = v >= 0 ? '+' : '';
    return sign + v.toFixed(1) + '%';
  }

  function badgeColor(pct) {
    if (pct >= 10) return { bg: '#dcfce7', fg: '#15803d', border: '#86efac' };
    if (pct >= 0) return { bg: '#f0fdf4', fg: '#16a34a', border: '#bbf7d0' };
    if (pct >= -10) return { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' };
    return { bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' };
  }

  // ── Cache ──
  function getCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - data.ts > CACHE_TTL) return null;
      return data.prices;
    } catch (e) { return null; }
  }
  function setCache(prices) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), prices: prices })); }
    catch (e) { /* quota */ }
  }

  // ── Extract tickers from page ──
  function extractSetupCards() {
    var items = [];
    // Sub-watchlist pages: .setup-card with .setup-ticker and .setup-price
    document.querySelectorAll('.setup-card').forEach(function (card) {
      var tickerEl = card.querySelector('.setup-ticker');
      var priceEl = card.querySelector('.setup-price');
      if (!tickerEl || !priceEl) return;
      var ticker = tickerEl.textContent.trim().replace(/^#\d+\s*/, '').split(/\s+/)[0];
      if (!ticker) return;
      var price = parsePriceText(priceEl.textContent);
      if (isNaN(price)) return;
      items.push({ ticker: ticker, articlePrice: price, priceEl: priceEl, card: card, type: 'setup' });
    });
    // Main index page: .wl-pick with .tk
    document.querySelectorAll('.wl-pick').forEach(function (pick) {
      var tkEl = pick.querySelector('.tk');
      if (!tkEl) return;
      var ticker = tkEl.textContent.trim();
      if (!ticker) return;
      items.push({ ticker: ticker, articlePrice: null, priceEl: null, card: pick, type: 'wl' });
    });
    return items;
  }

  // ── Fetch prices ──
  function fetchPrices(tickers, callback) {
    var cached = getCache();
    if (cached) {
      var allHit = tickers.every(function (t) { return cached[t] !== undefined; });
      if (allHit) return callback(cached);
    }

    var prices = cached || {};
    var remaining = tickers.filter(function (t) { return prices[t] === undefined; });
    if (!remaining.length) return callback(prices);

    // Batch: max 8 concurrent
    var queue = remaining.slice();
    var inflight = 0;
    var MAX = 8;

    function done() {
      setCache(prices);
      callback(prices);
    }

    function next() {
      if (!queue.length && inflight === 0) return done();
      while (queue.length && inflight < MAX) {
        (function (sym) {
          inflight++;
          var url = PROXY + encodeURIComponent(
            'https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=5d'
          );
          fetch(url, { signal: AbortSignal.timeout(8000) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              var result = d.chart && d.chart.result && d.chart.result[0];
              if (result && result.meta) {
                prices[sym] = result.meta.regularMarketPrice;
              }
            })
            .catch(function () { /* skip */ })
            .finally(function () { inflight--; next(); });
        })(queue.shift());
      }
    }
    next();
  }

  // ── Inject badges ──
  function injectBadges(items, prices) {
    items.forEach(function (item) {
      var currentPrice = prices[item.ticker];
      if (currentPrice === undefined) return;

      if (item.type === 'setup' && item.articlePrice) {
        // Sub-page: badge next to price
        var pct = ((currentPrice - item.articlePrice) / item.articlePrice) * 100;
        var c = badgeColor(pct);
        var badge = document.createElement('div');
        badge.className = 'live-pct-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:8px;margin-top:4px;'
          + 'background:' + c.bg + ';color:' + c.fg + ';border:1px solid ' + c.border;
        badge.innerHTML = '<i class="fas fa-signal" style="font-size:.6rem"></i> '
          + fmtPct(pct) + ' <span style="font-weight:500;font-size:.68rem;opacity:.7">since article</span>';
        badge.title = 'Article: $' + item.articlePrice.toFixed(2) + ' → Now: $' + currentPrice.toFixed(2);
        // Avoid duplicates
        var existing = item.priceEl.parentElement.querySelector('.live-pct-badge');
        if (existing) existing.remove();
        item.priceEl.parentElement.appendChild(badge);
      }

      if (item.type === 'wl') {
        // Main index: small badge after the dd badge
        var ddEl = item.card.querySelector('.dd');
        if (!ddEl) return;
        // We don't have article price for wl-pick items stored in HTML,
        // so skip percentage — just show current price
        var tag = document.createElement('span');
        tag.className = 'live-price-tag';
        tag.style.cssText = 'font-size:.62rem;font-weight:600;color:#3b82f6;margin-left:4px;white-space:nowrap';
        tag.textContent = '$' + currentPrice.toFixed(2);
        tag.title = 'Live price via Yahoo Finance';
        var ex = item.card.querySelector('.live-price-tag');
        if (ex) ex.remove();
        ddEl.insertAdjacentElement('afterend', tag);
      }
    });

    // Update header badge
    var header = document.querySelector('.price-tracker-status');
    if (header) {
      var now = new Date();
      header.innerHTML = '<i class="fas fa-wifi" style="color:#10b981"></i> Live prices updated ' + now.toLocaleTimeString();
      header.style.color = '#10b981';
    }
  }

  // ── Main ──
  function init() {
    var items = extractSetupCards();
    if (!items.length) return;

    // Dedupe tickers
    var seen = {};
    var tickers = [];
    items.forEach(function (it) {
      if (!seen[it.ticker]) { seen[it.ticker] = true; tickers.push(it.ticker); }
    });

    // Add status indicator
    var hero = document.querySelector('.hero-section .container, .hero-section');
    if (hero) {
      var statusEl = document.createElement('div');
      statusEl.className = 'price-tracker-status';
      statusEl.style.cssText = 'font-size:.72rem;font-weight:600;color:#94a3b8;margin-top:.75rem;display:flex;align-items:center;justify-content:center;gap:6px';
      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:.65rem"></i> Fetching live prices...';
      hero.appendChild(statusEl);
    }

    fetchPrices(tickers, function (prices) {
      injectBadges(items, prices);
    });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
