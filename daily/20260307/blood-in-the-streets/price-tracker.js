/**
 * Blood in the Streets — Live Price Tracker
 * Fetches current prices via Yahoo Finance and shows % change since article date (March 7, 2026).
 * Works on both the main index page (.wl-pick) and sub-watchlist pages (.setup-card).
 */
(function () {
  // Each proxy returns { url, unwrap } — unwrap extracts Yahoo JSON from the proxy response
  var PROXIES = [
    {
      url: function (u) { return 'https://api.allorigins.win/get?url=' + encodeURIComponent(u); },
      unwrap: function (d) { return typeof d.contents === 'string' ? JSON.parse(d.contents) : d; }
    },
    {
      url: function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
      unwrap: function (d) { return d; }
    }
  ];
  var CACHE_KEY = 'bts-prices-v2';
  var CACHE_TTL = 5 * 60 * 1000;

  function parsePriceText(t) {
    if (!t) return NaN;
    return parseFloat(t.replace(/[^0-9.\-]/g, ''));
  }
  function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }
  function fmtPrice(v) { return v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2); }

  function badgeColor(pct) {
    if (pct >= 10) return { bg: '#dcfce7', fg: '#15803d', border: '#86efac' };
    if (pct >= 0)  return { bg: '#f0fdf4', fg: '#16a34a', border: '#bbf7d0' };
    if (pct > -10) return { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' };
    return { bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' };
  }

  // ── Cache ──
  function getCache() {
    try {
      var d = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      return d && (Date.now() - d.ts < CACHE_TTL) ? d.prices : null;
    } catch (e) { return null; }
  }
  function setCache(p) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), prices: p })); }
    catch (e) {}
  }

  // ── Extract tickers ──
  function extractItems() {
    var items = [];
    document.querySelectorAll('.setup-card').forEach(function (card) {
      var tickerEl = card.querySelector('.setup-ticker');
      var priceEl = card.querySelector('.setup-price');
      if (!tickerEl || !priceEl) return;
      // Ticker text is like "#1 CRDO LOW US" or "DUOL #1"
      var raw = tickerEl.childNodes[0] ? tickerEl.childNodes[0].textContent.trim() : tickerEl.textContent.trim();
      var ticker = raw.replace(/^#\d+\s*/, '').split(/\s+/)[0];
      if (!ticker || ticker.length > 6) return;
      var price = parsePriceText(priceEl.textContent);
      if (isNaN(price)) return;
      items.push({ ticker: ticker, articlePrice: price, priceEl: priceEl, card: card, type: 'setup' });
    });
    document.querySelectorAll('.wl-pick').forEach(function (pick) {
      var tkEl = pick.querySelector('.tk');
      if (!tkEl) return;
      items.push({ ticker: tkEl.textContent.trim(), articlePrice: null, priceEl: null, card: pick, type: 'wl' });
    });
    return items;
  }

  // ── Fetch single ticker with proxy fallback ──
  function fetchOne(sym, proxyIdx) {
    if (proxyIdx >= PROXIES.length) return Promise.resolve(null);
    var proxy = PROXIES[proxyIdx];
    var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d';
    var url = proxy.url(yahooUrl);
    return fetch(url, { signal: AbortSignal.timeout(12000) })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        var yahoo = proxy.unwrap(d);
        var res = yahoo && yahoo.chart && yahoo.chart.result && yahoo.chart.result[0];
        if (res && res.meta && res.meta.regularMarketPrice) return res.meta.regularMarketPrice;
        throw new Error('no data');
      })
      .catch(function () {
        return fetchOne(sym, proxyIdx + 1);
      });
  }

  // ── Fetch all prices with concurrency limit ──
  function fetchAll(tickers, callback) {
    var cached = getCache();
    if (cached) {
      var miss = tickers.filter(function (t) { return cached[t] === undefined; });
      if (!miss.length) return callback(cached);
    }
    var prices = cached || {};
    var todo = tickers.filter(function (t) { return prices[t] === undefined; });
    if (!todo.length) return callback(prices);

    var idx = 0, inflight = 0, MAX = 6;
    function done() { setCache(prices); callback(prices); }
    function next() {
      if (idx >= todo.length && inflight === 0) return done();
      while (idx < todo.length && inflight < MAX) {
        (function (sym) {
          inflight++;
          fetchOne(sym, 0)
            .then(function (p) { if (p !== null) prices[sym] = p; })
            .finally(function () { inflight--; next(); });
        })(todo[idx++]);
      }
    }
    next();
  }

  // ── Inject badges ──
  function inject(items, prices) {
    var count = 0;
    items.forEach(function (item) {
      var cp = prices[item.ticker];
      if (cp === undefined) return;

      if (item.type === 'setup' && item.articlePrice) {
        var pct = ((cp - item.articlePrice) / item.articlePrice) * 100;
        var c = badgeColor(pct);
        var el = item.priceEl.parentElement.querySelector('.live-pct-badge');
        if (el) el.remove();
        var badge = document.createElement('div');
        badge.className = 'live-pct-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:.78rem;font-weight:700;'
          + 'padding:3px 10px;border-radius:8px;margin-top:5px;background:' + c.bg + ';color:' + c.fg + ';border:1px solid ' + c.border;
        var arrow = pct >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        badge.innerHTML = '<i class="fas ' + arrow + '" style="font-size:.6rem"></i> '
          + fmtPct(pct) + ' <span style="font-weight:500;font-size:.66rem;opacity:.75">($' + fmtPrice(cp) + ' now)</span>';
        badge.title = 'Article price: $' + item.articlePrice.toFixed(2) + ' → Current: $' + fmtPrice(cp) + ' (' + fmtPct(pct) + ')';
        item.priceEl.parentElement.appendChild(badge);
        count++;
      }

      if (item.type === 'wl') {
        var ddEl = item.card.querySelector('.dd');
        if (!ddEl) return;
        var ex = item.card.querySelector('.live-price-tag');
        if (ex) ex.remove();
        var tag = document.createElement('span');
        tag.className = 'live-price-tag';
        tag.style.cssText = 'font-size:.6rem;font-weight:600;color:#3b82f6;display:block;margin-top:2px';
        tag.textContent = '$' + fmtPrice(cp);
        ddEl.insertAdjacentElement('afterend', tag);
        count++;
      }
    });

    // Status
    var st = document.querySelector('.price-tracker-status');
    if (st) {
      if (count > 0) {
        st.innerHTML = '<i class="fas fa-circle" style="color:#10b981;font-size:.45rem"></i> '
          + count + ' live prices · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        st.style.color = '#10b981';
      } else {
        st.innerHTML = '<i class="fas fa-circle" style="color:#ef4444;font-size:.45rem"></i> Price feed unavailable';
        st.style.color = '#ef4444';
      }
    }
  }

  // ── Init ──
  function init() {
    var items = extractItems();
    if (!items.length) return;

    var seen = {}, tickers = [];
    items.forEach(function (it) {
      if (!seen[it.ticker]) { seen[it.ticker] = true; tickers.push(it.ticker); }
    });

    // Status indicator in hero
    var hero = document.querySelector('.hero-section');
    if (hero) {
      var s = document.createElement('div');
      s.className = 'price-tracker-status';
      s.style.cssText = 'font-size:.7rem;font-weight:600;color:#94a3b8;margin-top:.5rem;text-align:center;display:flex;align-items:center;justify-content:center;gap:5px';
      s.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:.55rem"></i> Loading live prices...';
      hero.appendChild(s);
    }

    fetchAll(tickers, function (prices) {
      inject(items, prices);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);
})();
