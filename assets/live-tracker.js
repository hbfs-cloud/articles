/**
 * Live Price Tracker — shared across scanner & blood-in-the-streets articles
 * Auto-detects page type, fetches live prices, shows badges + status bar
 *
 * Usage: <script src="/assets/live-tracker.js"></script> (before </body>)
 *
 * Data sources:
 *   - Stocks/ETFs: Yahoo Finance via allorigins.win CORS proxy (primary)
 *     Fallback chain P0→P4: allorigins×query2, allorigins×query1, thingproxy×query2, thingproxy×query1, quoteSummary
 *   - Crypto (*-USD): Binance REST API (no proxy needed)
 *
 * Cache: sessionStorage, 5-minute TTL
 * Concurrency: max 6 simultaneous fetches
 */
(function () {
  'use strict';

  /* ────────────────────────── constants ────────────────────────── */

  var CACHE_KEY_PREFIX = 'ltp_';
  var CACHE_TTL = 5 * 60 * 1000; // 5 min
  var MAX_CONCURRENT = 6;
  var YAHOO_PROXY = 'https://api.allorigins.win/get?url=';
  var BINANCE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=';

  // Fallback proxy chain — only used if primary allorigins call fails
  // P0: allorigins + query2 (alternate Yahoo host)
  // P1: allorigins + query1 (swap primary host via same stable proxy)
  // P2: thingproxy + query2 (different proxy, different host)
  // P3: thingproxy + query1 (different proxy, primary host)
  // P4: Yahoo quoteSummary fundamentals via allorigins (last resort)
  // NOTE: corsproxy.io removed — returns 403 under load, was the root cause of "Price feed unstable"
  var YAHOO_FALLBACK_PROXIES = [
    function (ticker) {
      var u = 'https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d';
      return { url: YAHOO_PROXY + encodeURIComponent(u), mode: 'allorigins-chart' };
    },
    function (ticker) {
      var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d';
      return { url: YAHOO_PROXY + encodeURIComponent(u), mode: 'allorigins-chart' };
    },
    function (ticker) {
      var u = 'https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d';
      return { url: 'https://thingproxy.freeboard.io/fetch/' + u, mode: 'raw-chart' };
    },
    function (ticker) {
      var u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?range=1d&interval=1d';
      return { url: 'https://thingproxy.freeboard.io/fetch/' + u, mode: 'raw-chart' };
    },
    function (ticker) {
      var u = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(ticker) + '?modules=price';
      return { url: YAHOO_PROXY + encodeURIComponent(u), mode: 'allorigins-fundamentals' };
    }
  ];

  /* ────────────────────────── page detection ────────────────────── */

  var PAGE_TYPE = detect();

  function detect() {
    // Scanner articles: .setup-card with id="setup-TICKER", prices in .setup-header-price .price
    var scannerCards = document.querySelectorAll('.setup-card[id^="setup-"]');
    if (scannerCards.length > 0) return 'scanner';

    // Blood-in-the-streets (or similar): .setup-card with .setup-ticker + .setup-price
    var bitsCards = document.querySelectorAll('.setup-card');
    if (bitsCards.length > 0) {
      var hasTicker = bitsCards[0].querySelector('.setup-ticker') ||
                      bitsCards[0].querySelector('.setup-header-info h3');
      if (hasTicker) return 'bits';
    }

    return null;
  }

  if (!PAGE_TYPE) return; // no setup cards found — bail

  /* ────────────────────────── extract setups ─────────────────────── */

  function parsePrice(text) {
    if (!text) return NaN;
    // Handle ranges like "$90 – $93" → take midpoint
    var cleaned = text.replace(/&ndash;/g, '–').replace(/\u2013/g, '–');
    if (cleaned.indexOf('–') !== -1) {
      var parts = cleaned.split('–');
      var lo = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
      var hi = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
      if (!isNaN(lo) && !isNaN(hi)) return (lo + hi) / 2;
    }
    return parseFloat(cleaned.replace(/[^0-9.]/g, ''));
  }

  function extractSetups() {
    var setups = [];
    var cards = document.querySelectorAll('.setup-card');

    cards.forEach(function (card) {
      var ticker, articlePrice, priceEl, levels, entry, stop, tp1, tp2;

      if (PAGE_TYPE === 'scanner') {
        // Scanner structure
        var id = card.id || '';
        ticker = id.replace('setup-', '');

        var headerInfo = card.querySelector('.setup-header-info h3');
        if (headerInfo && !ticker) {
          var m = headerInfo.textContent.match(/^(\S+)/);
          if (m) ticker = m[1];
        }

        priceEl = card.querySelector('.setup-header-price .price');
        articlePrice = priceEl ? parsePrice(priceEl.textContent) : NaN;

        // Levels from .level-item
        levels = {};
        card.querySelectorAll('.level-item').forEach(function (li) {
          var lbl = li.querySelector('.lbl');
          var val = li.querySelector('.val');
          if (lbl && val) {
            var key = lbl.textContent.trim().toLowerCase();
            var v = parsePrice(val.textContent);
            if (key.indexOf('entry') !== -1) levels.entry = v;
            else if (key.indexOf('stop') !== -1) levels.stop = v;
            else if (key.indexOf('target 1') !== -1 || key === 'tp1') levels.tp1 = v;
            else if (key.indexOf('target 2') !== -1 || key === 'tp2') levels.tp2 = v;
          }
        });
      } else {
        // Blood-in-the-streets structure
        var tickerEl = card.querySelector('.setup-ticker');
        if (tickerEl) {
          // Text like "DUOL #1" or "#1 CRDO LOW US"
          var raw = tickerEl.textContent.trim();
          // Remove #N numbering and extra words
          var tokens = raw.replace(/#\d+/g, '').trim().split(/\s+/);
          ticker = tokens[0]; // first real word = ticker
        }

        priceEl = card.querySelector('.setup-price');
        articlePrice = priceEl ? parsePrice(priceEl.textContent) : NaN;

        // Levels from .level-box
        levels = {};
        card.querySelectorAll('.level-box').forEach(function (lb) {
          var lbl = lb.querySelector('.level-label');
          var val = lb.querySelector('.level-val');
          if (lbl && val) {
            var key = lbl.textContent.trim().toLowerCase();
            var v = parsePrice(val.textContent);
            if (key.indexOf('entry') !== -1) levels.entry = v;
            else if (key.indexOf('stop') !== -1) levels.stop = v;
            else if (key.indexOf('target 1') !== -1 || key === 'tp1') levels.tp1 = v;
            else if (key.indexOf('target 2') !== -1 || key === 'tp2') levels.tp2 = v;
            else if (key.indexOf('r:r') !== -1 || key === 'r/r') { /* skip */ }
          }
        });
      }

      if (!ticker) return;

      setups.push({
        ticker: ticker.toUpperCase(),
        articlePrice: articlePrice,
        entry: levels.entry || articlePrice,
        stop: levels.stop || NaN,
        tp1: levels.tp1 || NaN,
        tp2: levels.tp2 || NaN,
        card: card,
        priceEl: priceEl
      });
    });

    return setups;
  }

  /* ────────────────────────── cache ────────────────────────────── */

  function cacheGet(ticker) {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY_PREFIX + ticker);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY_PREFIX + ticker);
        return null;
      }
      return obj.price;
    } catch (e) { return null; }
  }

  function cacheSet(ticker, price) {
    try {
      sessionStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify({ price: price, ts: Date.now() }));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  /* ────────────────────────── fetch prices ───────────────────────── */

  function isCrypto(ticker) {
    return /\-USD$/i.test(ticker);
  }

  function toBinanceSymbol(ticker) {
    // BTC-USD → BTCUSDT, ETH-USD → ETHUSDT
    return ticker.replace('-USD', '').toUpperCase() + 'USDT';
  }

  function fetchCryptoPrice(ticker) {
    var symbol = toBinanceSymbol(ticker);
    return fetch(BINANCE_API + encodeURIComponent(symbol))
      .then(function (r) {
        if (!r.ok) throw new Error('Binance ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var p = parseFloat(data.price);
        if (isNaN(p)) throw new Error('Bad Binance price');
        return p;
      });
  }

  function parseAlloriginsChart(wrapper) {
    var inner = JSON.parse(wrapper.contents);
    var result = inner.chart.result;
    if (!result || !result.length) throw new Error('No Yahoo data');
    var price = result[0].meta.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price)) throw new Error('Bad Yahoo price');
    return price;
  }

  function parseRawChart(data) {
    var result = data.chart && data.chart.result;
    if (!result || !result.length) throw new Error('No Yahoo data');
    var price = result[0].meta.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price)) throw new Error('Bad Yahoo price');
    return price;
  }

  function parseAlloriginsFundamentals(wrapper) {
    var inner = JSON.parse(wrapper.contents);
    var res = inner.quoteSummary && inner.quoteSummary.result;
    if (!res || !res.length) throw new Error('No fundamentals data');
    var price = res[0].price && res[0].price.regularMarketPrice && res[0].price.regularMarketPrice.raw;
    if (typeof price !== 'number' || isNaN(price)) throw new Error('Bad fundamentals price');
    return price;
  }

  function fetchFallback(ticker, idx) {
    if (idx >= YAHOO_FALLBACK_PROXIES.length) return Promise.reject(new Error('All fallbacks failed'));
    var cfg = YAHOO_FALLBACK_PROXIES[idx](ticker);
    return fetch(cfg.url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (cfg.mode === 'allorigins-chart') return parseAlloriginsChart(data);
        if (cfg.mode === 'raw-chart') return parseRawChart(data);
        if (cfg.mode === 'allorigins-fundamentals') return parseAlloriginsFundamentals(data);
        throw new Error('Unknown mode');
      })
      .catch(function () {
        return fetchFallback(ticker, idx + 1);
      });
  }

  function fetchStockPrice(ticker) {
    var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(ticker) + '?range=1d&interval=1d';
    var proxyUrl = YAHOO_PROXY + encodeURIComponent(yahooUrl);

    return fetch(proxyUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('Proxy ' + r.status);
        return r.json();
      })
      .then(parseAlloriginsChart)
      .catch(function () {
        // Primary failed — try fallback chain P0→P4
        return fetchFallback(ticker, 0);
      });
  }

  function fetchPrice(ticker) {
    var cached = cacheGet(ticker);
    if (cached !== null) return Promise.resolve(cached);

    var promise = isCrypto(ticker) ? fetchCryptoPrice(ticker) : fetchStockPrice(ticker);

    return promise.then(function (price) {
      cacheSet(ticker, price);
      return price;
    });
  }

  /* ────────────────────────── concurrency limiter ────────────────── */

  function pooledFetch(tickers, fn) {
    var results = {};
    var queue = tickers.slice();
    var running = 0;

    return new Promise(function (resolve) {
      function next() {
        if (queue.length === 0 && running === 0) {
          resolve(results);
          return;
        }
        while (running < MAX_CONCURRENT && queue.length > 0) {
          var t = queue.shift();
          running++;
          fn(t)
            .then(function (tk, price) {
              results[tk] = price;
            }.bind(null, t))
            .catch(function (tk) {
              results[tk] = null;
            }.bind(null, t))
            .finally(function () {
              running--;
              next();
            });
        }
      }
      next();
    });
  }

  /* ────────────────────────── status classification ──────────────── */

  function classify(setup, livePrice) {
    if (isNaN(livePrice) || isNaN(setup.articlePrice)) return { label: 'N/A', color: '#94a3b8' };

    var stop = setup.stop;
    var tp1 = setup.tp1;
    var tp2 = setup.tp2;
    var entry = setup.entry;

    // Determine direction: if stop < entry → long, else short
    var isLong = isNaN(stop) || stop < entry;

    if (!isNaN(tp2)) {
      if (isLong && livePrice >= tp2) return { label: 'TP2 Hit', color: '#7c3aed', icon: 'fa-trophy' };
      if (!isLong && livePrice <= tp2) return { label: 'TP2 Hit', color: '#7c3aed', icon: 'fa-trophy' };
    }
    if (!isNaN(tp1)) {
      if (isLong && livePrice >= tp1) return { label: 'TP1 Hit', color: '#16a34a', icon: 'fa-check-circle' };
      if (!isLong && livePrice <= tp1) return { label: 'TP1 Hit', color: '#16a34a', icon: 'fa-check-circle' };
    }
    if (!isNaN(stop)) {
      if (isLong && livePrice <= stop) return { label: 'Stopped', color: '#dc2626', icon: 'fa-times-circle' };
      if (!isLong && livePrice >= stop) return { label: 'Stopped', color: '#dc2626', icon: 'fa-times-circle' };
      // Near stop: within 2% of stop
      var distStop = Math.abs(livePrice - stop) / stop;
      if (distStop < 0.02) return { label: 'Near Stop', color: '#f59e0b', icon: 'fa-exclamation-triangle' };
    }

    // Entry zone: within 1.5% of entry price
    var distEntry = Math.abs(livePrice - entry) / entry;
    if (distEntry < 0.015) return { label: 'Entry Zone', color: '#3b82f6', icon: 'fa-crosshairs' };

    // Determine trending vs underwater
    var pctChange = (livePrice - setup.articlePrice) / setup.articlePrice;
    if (isLong) {
      if (pctChange > 0.005) return { label: 'Trending', color: '#16a34a', icon: 'fa-arrow-trend-up' };
      return { label: 'Underwater', color: '#dc2626', icon: 'fa-arrow-trend-down' };
    } else {
      // Short position: price down = good
      if (pctChange < -0.005) return { label: 'Trending', color: '#16a34a', icon: 'fa-arrow-trend-down' };
      return { label: 'Underwater', color: '#dc2626', icon: 'fa-arrow-trend-up' };
    }
  }

  /* ────────────────────────── DOM injection ──────────────────────── */

  function injectBadge(setup, livePrice) {
    if (isNaN(livePrice) || isNaN(setup.articlePrice)) return;

    var pct = ((livePrice - setup.articlePrice) / setup.articlePrice) * 100;
    var status = classify(setup, livePrice);
    var isUp = pct >= 0;
    var arrow = isUp ? 'fa-caret-up' : 'fa-caret-down';
    var pctColor = isUp ? '#16a34a' : '#dc2626';

    if (status.label === 'Stopped') pctColor = '#94a3b8';

    // Create badge element
    var badge = document.createElement('div');
    badge.className = 'live-tracker-badge';
    badge.setAttribute('style',
      'display:inline-flex;align-items:center;gap:6px;' +
      'margin-top:6px;padding:4px 10px;border-radius:8px;' +
      'font-size:.78rem;font-weight:700;line-height:1.3;' +
      'background:' + (status.label === 'Stopped' ? '#f1f5f9' : (isUp ? '#f0fdf4' : '#fef2f2')) + ';' +
      'border:1px solid ' + (status.label === 'Stopped' ? '#cbd5e1' : (isUp ? '#86efac' : '#fca5a5')) + ';' +
      'white-space:nowrap;'
    );

    badge.innerHTML =
      '<i class="fas ' + arrow + '" style="color:' + pctColor + ';font-size:.85rem;"></i>' +
      '<span style="color:' + pctColor + ';">' + (isUp ? '+' : '') + pct.toFixed(2) + '%</span>' +
      '<span style="color:#64748b;font-size:.72rem;">($' + formatNum(livePrice) + ')</span>' +
      '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;' +
        'font-size:.68rem;font-weight:800;letter-spacing:.3px;' +
        'background:' + status.color + '18;color:' + status.color + ';">' +
        (status.icon ? '<i class="fas ' + status.icon + '" style="font-size:.62rem;"></i>' : '') +
        status.label +
      '</span>';

    // Remove existing badge if re-running
    var existing = setup.card.querySelector('.live-tracker-badge');
    if (existing) existing.remove();

    // Insert badge
    if (setup.priceEl) {
      setup.priceEl.parentElement.appendChild(badge);
    } else {
      // Fallback: after the first heading
      var h = setup.card.querySelector('h3, h4, .setup-ticker');
      if (h) h.parentElement.appendChild(badge);
    }

    // Apply card-level visual effects
    applyCardEffects(setup.card, status);
  }

  function applyCardEffects(card, status) {
    // Reset first
    card.style.transition = 'all 0.3s ease';

    switch (status.label) {
      case 'Stopped':
        card.style.filter = 'grayscale(0.6)';
        card.style.opacity = '0.75';
        card.style.borderColor = '#cbd5e1';
        break;
      case 'TP2 Hit':
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '#7c3aed';
        card.style.boxShadow = '0 0 0 2px rgba(124,58,237,.25), 0 4px 12px rgba(124,58,237,.15)';
        break;
      case 'TP1 Hit':
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '#16a34a';
        card.style.boxShadow = '0 0 0 2px rgba(22,163,74,.2), 0 4px 12px rgba(22,163,74,.1)';
        break;
      case 'Trending':
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '#22c55e';
        card.style.boxShadow = '0 2px 8px rgba(34,197,94,.12)';
        break;
      case 'Underwater':
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '#fca5a5';
        card.style.boxShadow = '';
        break;
      case 'Near Stop':
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '#f59e0b';
        card.style.boxShadow = '0 0 0 2px rgba(245,158,11,.2)';
        break;
      default:
        card.style.filter = '';
        card.style.opacity = '';
        card.style.borderColor = '';
        card.style.boxShadow = '';
    }
  }

  function formatNum(n) {
    if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(4); // small crypto
  }

  /* ────────────────────────── status bar ─────────────────────────── */

  function injectStatusBar(loaded, total, failed) {
    // Find the hero section
    var hero = document.querySelector('.ticker-header') ||
               document.querySelector('.hero-section') ||
               document.querySelector('.brand-bar');
    if (!hero) return;

    var existing = document.getElementById('live-tracker-status');
    if (existing) existing.remove();

    var bar = document.createElement('div');
    bar.id = 'live-tracker-status';

    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                  now.getMinutes().toString().padStart(2, '0');

    var isOk = loaded > 0;
    // Use a neutral gray (not alarming red) when the feed is temporarily down —
    // the article still displays last-close prices from the setup cards.
    var dotColor = isOk ? '#22c55e' : '#94a3b8';
    var msg = isOk
      ? loaded + ' live price' + (loaded > 1 ? 's' : '') + ' · ' + timeStr +
        (failed > 0 ? ' · ' + failed + ' unavailable' : '')
      : 'Price feed unavailable';
    var unavailableTitle = 'Live prices temporarily unavailable — using last close from article. Updates automatically when feed resumes.';

    bar.setAttribute('style',
      'display:flex;align-items:center;justify-content:center;gap:8px;' +
      'padding:6px 16px;font-size:.75rem;font-weight:600;' +
      'color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;' +
      'letter-spacing:.3px;'
    );
    if (!isOk) {
      bar.setAttribute('title', unavailableTitle);
      bar.setAttribute('aria-label', unavailableTitle);
    }

    // Color legend — makes setup-card color coding self-explanatory
    var legend =
      '<span style="display:inline-flex;align-items:center;gap:12px;flex-wrap:wrap;margin-left:12px;font-weight:500;">' +
        '<span title="Price hit TP2 — max profit target"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#eab308;margin-right:4px;vertical-align:middle"></span>TP2</span>' +
        '<span title="Price hit TP1 — partial profit triggered"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:4px;vertical-align:middle"></span>TP1/Trend</span>' +
        '<span title="Price in the ideal entry zone"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;margin-right:4px;vertical-align:middle"></span>Entry</span>' +
        '<span title="Price below entry but far from stop"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:4px;vertical-align:middle"></span>Underwater</span>' +
        '<span title="Price near or hit the stop-loss"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:4px;vertical-align:middle"></span>Near/Stopped</span>' +
      '</span>';

    bar.innerHTML =
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;' +
        'background:' + dotColor + ';' +
        (isOk ? 'animation:ltp-pulse 2s infinite;' : '') +
      '"></span>' +
      '<span>' + msg + '</span>' +
      (isOk ? legend : '');

    // Insert after hero
    hero.parentElement.insertBefore(bar, hero.nextSibling);

    // Inject pulse animation if not already
    if (!document.getElementById('ltp-style')) {
      var style = document.createElement('style');
      style.id = 'ltp-style';
      style.textContent =
        '@keyframes ltp-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '.live-tracker-badge{cursor:default;}';
      document.head.appendChild(style);
    }
  }

  /* ────────────────────────── main ───────────────────────────────── */

  function run() {
    var setups = extractSetups();
    if (setups.length === 0) return;

    // Deduplicate tickers
    var tickerMap = {};
    setups.forEach(function (s) { tickerMap[s.ticker] = true; });
    var tickers = Object.keys(tickerMap);

    // Show loading state
    injectStatusBar(0, tickers.length, 0);

    pooledFetch(tickers, fetchPrice).then(function (prices) {
      var loaded = 0;
      var failed = 0;

      tickers.forEach(function (t) {
        if (prices[t] !== null && prices[t] !== undefined) loaded++;
        else failed++;
      });

      setups.forEach(function (s) {
        var livePrice = prices[s.ticker];
        if (livePrice !== null && livePrice !== undefined) {
          injectBadge(s, livePrice);
        }
      });

      injectStatusBar(loaded, tickers.length, failed);
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
