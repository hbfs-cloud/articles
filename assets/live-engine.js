/**
 * live-engine.js — Real-time portfolio valuation via Yahoo Finance WebSocket
 * Connects to wss://streamer.finance.yahoo.com/, decodes protobuf PricingData,
 * evaluates TP/SL/trailing stops, and updates the scanner status page DOM.
 *
 * Dependencies: None (vanilla JS, browser-native WebSocket + protobuf decoder)
 */
(function () {
  'use strict';

  // ── Config ──
  var WS_URL = 'wss://streamer.finance.yahoo.com/';
  var RECONNECT_BASE = 2000;
  var RECONNECT_MAX = 60000;
  var PING_INTERVAL = 30000;
  var EVAL_INTERVAL = 15000; // full eval sweep
  var ALLORIGINS = 'https://api.allorigins.win/get?url=';
  var CHART_PROXIES = [
    function (t) { return { url: ALLORIGINS + encodeURIComponent('https://query2.finance.yahoo.com/v8/finance/chart/' + t + '?range=1d&interval=1d'), mode: 'allorigins' }; },
    function (t) { return { url: ALLORIGINS + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + t + '?range=1d&interval=1d'), mode: 'allorigins' }; },
    function (t) { return { url: 'https://thingproxy.freeboard.io/fetch/https://query2.finance.yahoo.com/v8/finance/chart/' + t + '?range=1d&interval=1d', mode: 'raw' }; }
  ];

  // ── State ──
  var ws = null;
  var reconnectDelay = RECONNECT_BASE;
  var pingTimer = null;
  var evalTimer = null;
  var connected = false;
  var tickers = [];
  var prices = {};      // { TICKER: { price, change, changePct, dayHigh, dayLow, volume, bid, ask, open, prevClose, ts } }
  var positions = {};   // { modeId: [pos, ...] }
  var modesCfg = null;
  var listeners = [];   // [{fn, ctx}]

  // ── Protobuf Decoder (Yahoo PricingData) ──
  // Fields: 1=id(string), 2=price(float), 4=currency(string), 5=exchange(string),
  // 6=quoteType(varint), 7=marketHours(varint), 8=changePct(float), 9=dayVol(varint),
  // 10=dayHigh(float), 11=dayLow(float), 12=change(float), 13=shortName(string),
  // 15=bid(float), 17=ask(float), 19=open(float), 20=prevClose(float)

  function decodeProtobuf(buf) {
    var pos = 0;
    var result = {};
    while (pos < buf.length) {
      if (pos + 1 > buf.length) break;
      var tag = buf[pos]; pos++;
      var fieldNum = tag >> 3;
      var wireType = tag & 7;

      // Handle 2-byte tags (field > 15)
      if (fieldNum === 0 && wireType === 0) break;

      if (wireType === 0) { // varint
        var val = 0; var shift = 0;
        while (pos < buf.length) {
          var b = buf[pos++];
          val |= (b & 0x7f) << shift;
          if (!(b & 0x80)) break;
          shift += 7;
        }
        if (fieldNum === 6) result.quoteType = val;
        else if (fieldNum === 7) result.marketHours = val;
        else if (fieldNum === 9) result.dayVolume = val;
      } else if (wireType === 2) { // length-delimited (string)
        var len = 0; var shift = 0;
        while (pos < buf.length) {
          var b = buf[pos++];
          len |= (b & 0x7f) << shift;
          if (!(b & 0x80)) break;
          shift += 7;
        }
        if (pos + len > buf.length) break;
        var str = '';
        for (var i = 0; i < len; i++) str += String.fromCharCode(buf[pos + i]);
        pos += len;
        if (fieldNum === 1) result.id = str;
        else if (fieldNum === 4) result.currency = str;
        else if (fieldNum === 5) result.exchange = str;
        else if (fieldNum === 13) result.shortName = str;
      } else if (wireType === 5) { // 32-bit float
        if (pos + 4 > buf.length) break;
        var dv = new DataView(buf.buffer, buf.byteOffset + pos, 4);
        var fval = dv.getFloat32(0, true);
        pos += 4;
        if (fieldNum === 2) result.price = fval;
        else if (fieldNum === 8) result.changePct = fval;
        else if (fieldNum === 10) result.dayHigh = fval;
        else if (fieldNum === 11) result.dayLow = fval;
        else if (fieldNum === 12) result.change = fval;
        else if (fieldNum === 15) result.bid = fval;
        else if (fieldNum === 17) result.ask = fval;
        else if (fieldNum === 19) result.open = fval;
        else if (fieldNum === 20) result.prevClose = fval;
      } else if (wireType === 1) { // 64-bit
        pos += 8;
      } else {
        break; // unknown wire type
      }
    }
    return result;
  }

  function base64ToUint8(b64) {
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // ── WebSocket Manager ──
  function connect() {
    if (ws) { try { ws.close(); } catch (e) {} }
    updateConnectionUI('connecting');

    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      console.warn('[LiveEngine] WS create failed:', e);
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      connected = true;
      reconnectDelay = RECONNECT_BASE;
      updateConnectionUI('connected');
      subscribe(tickers);
      startPing();
      console.log('[LiveEngine] Connected, subscribed to', tickers.length, 'tickers');
    };

    ws.onmessage = function (evt) {
      try {
        // Yahoo sends base64-encoded protobuf
        var bytes = base64ToUint8(evt.data);
        var data = decodeProtobuf(bytes);
        if (!data.id || data.quoteType === 7) return; // skip heartbeat
        onTick(data);
      } catch (e) {
        // Might be JSON (subscription confirmation)
        try { JSON.parse(evt.data); } catch (e2) {
          console.warn('[LiveEngine] Decode error:', e);
        }
      }
    };

    ws.onerror = function (e) {
      console.warn('[LiveEngine] WS error:', e);
    };

    ws.onclose = function () {
      connected = false;
      stopPing();
      updateConnectionUI('disconnected');
      scheduleReconnect();
    };
  }

  function subscribe(syms) {
    if (!ws || ws.readyState !== 1 || !syms.length) return;
    ws.send(JSON.stringify({ subscribe: syms }));
  }

  function scheduleReconnect() {
    setTimeout(function () {
      if (!connected) connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, RECONNECT_MAX);
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(function () {
      if (ws && ws.readyState === 1) {
        subscribe(tickers); // re-subscribe acts as keepalive
      }
    }, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  // ── Tick Handler ──
  function onTick(data) {
    var id = data.id;
    var prev = prices[id] || {};
    var prevPrice = prev.price || 0;

    prices[id] = {
      price: data.price || prev.price || 0,
      change: data.change != null ? data.change : (prev.change || 0),
      changePct: data.changePct != null ? data.changePct : (prev.changePct || 0),
      dayHigh: data.dayHigh || prev.dayHigh || 0,
      dayLow: data.dayLow || prev.dayLow || 0,
      volume: data.dayVolume || prev.volume || 0,
      bid: data.bid || prev.bid || 0,
      ask: data.ask || prev.ask || 0,
      open: data.open || prev.open || 0,
      prevClose: data.prevClose || prev.prevClose || 0,
      ts: Date.now(),
      direction: data.price > prevPrice ? 'up' : data.price < prevPrice ? 'down' : (prev.direction || 'flat')
    };

    // Evaluate positions for this ticker
    evaluateForTicker(id);

    // Notify listeners
    emit('tick', { ticker: id, data: prices[id] });
  }

  // ── Position Evaluator ──
  // Ported from signal-monitor.js evaluatePosition()
  function evaluatePosition(pos, livePrice, cfg) {
    if (!pos || !livePrice || !cfg) return null;

    var entry = pos.entry || 0;
    var stop = pos.stop || 0;
    var tp1 = pos.tp1 || 0;
    var tp2 = pos.tp2 || 0;
    var price = livePrice.price || 0;
    var dayHigh = livePrice.dayHigh || price;
    var dayLow = livePrice.dayLow || price;

    if (!entry || !price) return null;

    // Guard: missing/zero stop = treat as inactive, do NOT default-long (would
    // never trigger SL_HIT and lock state forever). Returning null lets caller
    // skip the position quietly.
    if (!stop || stop <= 0) {
      if (!pos._warnedNoStop) {
        console.warn('[live-engine] missing stop for', pos.ticker, '— skipping eval');
        pos._warnedNoStop = true;
      }
      return null;
    }

    var pnlPct = ((price - entry) / entry) * 100;
    var isLong = stop < entry;

    // State from localStorage
    var stateKey = 'le_' + (pos._modeId || '') + '_' + pos.ticker + '_' + (pos.scan_date || '');
    var state = {};
    try { state = JSON.parse(localStorage.getItem(stateKey) || '{}'); } catch (e) {}

    var currentStop = state.currentStop || stop;
    var hwm = state.highWaterMark || entry;
    var partialClosed = state.partialClosed || false;

    // Update high water mark
    if (price > hwm) hwm = price;

    // Dynamic stop management
    if (cfg.breakevenPct > 0 && pnlPct >= cfg.breakevenPct && currentStop < entry) {
      currentStop = entry; // lock breakeven
    }
    if (cfg.dailyTrailPct > 0) {
      var trailLevel = hwm * (1 - cfg.dailyTrailPct / 100);
      if (trailLevel > currentStop) currentStop = trailLevel;
    }

    // Days remaining
    var daysHeld = 0;
    if (pos.scan_date) {
      var scanDate = new Date(pos.scan_date);
      var now = new Date();
      daysHeld = Math.floor((now - scanDate) / 86400000);
    }
    var horizon = cfg.horizon || 10;
    var daysLeft = Math.max(0, horizon - daysHeld);

    // Status classification (priority order)
    var status = 'OPEN';
    var statusDetail = '';

    if (isLong ? dayLow <= currentStop : dayHigh >= currentStop) {
      status = 'SL_HIT';
      statusDetail = 'Stop triggered at $' + currentStop.toFixed(2);
    } else if (tp2 && (isLong ? dayHigh >= tp2 : dayLow <= tp2)) {
      status = 'TP2_HIT';
      statusDetail = 'Target 2 reached — full profit';
    } else if (tp1 && (isLong ? dayHigh >= tp1 : dayLow <= tp1)) {
      if (cfg.partialTP && !partialClosed) {
        status = 'TP1_PARTIAL';
        statusDetail = 'TP1 hit — sell ' + ((cfg.partialTPPct || 0.5) * 100) + '%, trail rest';
        partialClosed = true;
      } else {
        status = 'TP1_HIT';
        statusDetail = 'Target 1 reached';
      }
    } else if (daysLeft <= 0) {
      status = 'EXPIRED';
      statusDetail = 'Horizon exceeded (' + horizon + 'd)';
    } else if (isLong && currentStop > 0 && entry > currentStop) {
      var stopDist = (price - currentStop) / (entry - currentStop);
      if (stopDist < 0.3) {
        status = 'NEAR_STOP';
        statusDetail = 'Within 30% of stop ($' + currentStop.toFixed(2) + ')';
      }
    }

    // Check near TP1
    if (status === 'OPEN' && tp1 && entry) {
      var tp1Dist = (price - entry) / (tp1 - entry);
      if (tp1Dist > 0.8) {
        status = 'NEAR_TP1';
        statusDetail = 'Within 20% of TP1 ($' + tp1.toFixed(2) + ')';
      }
    }

    // Trending / Underwater
    if (status === 'OPEN') {
      if (pnlPct > 0.5) { status = 'TRENDING'; statusDetail = 'Trending in profit'; }
      else if (pnlPct < -0.5) { status = 'UNDERWATER'; statusDetail = 'Below entry'; }
      else { status = 'ENTRY_ZONE'; statusDetail = 'Near entry price'; }
    }

    // Save state
    try {
      localStorage.setItem(stateKey, JSON.stringify({
        currentStop: currentStop,
        highWaterMark: hwm,
        partialClosed: partialClosed,
        lastStatus: status,
        lastPrice: price,
        ts: Date.now()
      }));
    } catch (e) {}

    return {
      ticker: pos.ticker,
      status: status,
      statusDetail: statusDetail,
      price: price,
      entry: entry,
      stop: currentStop,
      originalStop: stop,
      tp1: tp1,
      tp2: tp2,
      pnlPct: pnlPct,
      pnlAbs: price - entry,
      dayHigh: dayHigh,
      dayLow: dayLow,
      daysLeft: daysLeft,
      daysHeld: daysHeld,
      hwm: hwm,
      direction: livePrice.direction,
      changePct: livePrice.changePct,
      partialClosed: partialClosed
    };
  }

  // Statuses that mark a position as final — no more evaluation, no more price updates.
  var TERMINAL_STATUSES = { SL_HIT: 1, TP1_HIT: 1, TP2_HIT: 1, EXPIRED: 1 };

  function markTerminalIfNeeded(pos, result) {
    if (!result || pos._terminal) return;
    if (TERMINAL_STATUSES[result.status]) {
      pos._terminal = true;
      pos._exitPrice = result.price;
      pos._exitStatus = result.status;
      pos._exitTs = new Date().toISOString();
    }
  }

  function liveTickersStillNeeded() {
    var s = {};
    Object.keys(positions).forEach(function (modeId) {
      positions[modeId].forEach(function (p) {
        if (!p._terminal && p.ticker) s[p.ticker] = true;
      });
    });
    return s;
  }

  function evaluateForTicker(ticker) {
    if (!modesCfg) return;
    Object.keys(positions).forEach(function (modeId) {
      var cfg = modesCfg[modeId];
      if (!cfg) return;
      positions[modeId].forEach(function (pos) {
        if (pos.ticker !== ticker) return;
        if (pos._terminal) return;            // closed — skip
        var lp = prices[ticker];
        if (!lp) return;
        var result = evaluatePosition(pos, lp, cfg);
        if (result) {
          pos._eval = result;
          markTerminalIfNeeded(pos, result);
          emit('eval', { modeId: modeId, result: result, terminal: !!pos._terminal });
        }
      });
    });
    // Update aggregate
    updateAggregates();
  }

  function evaluateAll() {
    if (!modesCfg) return;
    Object.keys(positions).forEach(function (modeId) {
      var cfg = modesCfg[modeId];
      if (!cfg) return;
      positions[modeId].forEach(function (pos) {
        if (pos._terminal) return;            // closed — skip
        var lp = prices[pos.ticker];
        if (!lp) return;
        var result = evaluatePosition(pos, lp, cfg);
        if (result) {
          pos._eval = result;
          markTerminalIfNeeded(pos, result);
          emit('eval', { modeId: modeId, result: result, terminal: !!pos._terminal });
        }
      });
    });
    updateAggregates();
    // Prune subscribed tickers — drop those whose positions all reached terminal.
    var keep = liveTickersStillNeeded();
    var newTickers = tickers.filter(function (t) { return keep[t]; });
    if (newTickers.length !== tickers.length) {
      tickers = newTickers;
      try { if (typeof subscribe === 'function') subscribe(); } catch (e) { /* noop */ }
    }
  }

  // ── Aggregates ──
  var aggregates = {}; // { modeId: { totalPnl, count, alerts, ... } }

  function updateAggregates() {
    Object.keys(positions).forEach(function (modeId) {
      var totalPnl = 0;
      var count = 0;
      var alerts = [];
      var cfg = modesCfg ? modesCfg[modeId] : null;
      var sizePct = cfg && cfg.positionSizePct ? cfg.positionSizePct : 1;
      var pSize = cfg ? cfg.portfolioSize || 1 : 1;
      var allocPct = sizePct / pSize;

      positions[modeId].forEach(function (pos) {
        if (!pos._eval) return;
        count++;
        totalPnl += (pos._eval.pnlPct || 0) * allocPct;
        if (['SL_HIT', 'TP2_HIT', 'TP1_HIT', 'TP1_PARTIAL', 'NEAR_STOP', 'EXPIRED'].indexOf(pos._eval.status) >= 0) {
          alerts.push(pos._eval);
        }
      });

      aggregates[modeId] = {
        totalPnl: totalPnl,
        count: count,
        alerts: alerts
      };
    });
    emit('aggregates', aggregates);
  }

  // ── HTTP Fallback (for initial prices before WS connects) ──
  // Uses v8/finance/chart per-ticker (no crumb needed) via allorigins/thingproxy
  function parseChartResponse(ticker, raw) {
    var chart = raw.chart || raw;
    if (!chart || !chart.result || !chart.result[0]) return false;
    var r = chart.result[0];
    var meta = r.meta || {};
    var price = meta.regularMarketPrice || 0;
    var prevClose = meta.chartPreviousClose || meta.previousClose || 0;
    var change = prevClose ? price - prevClose : 0;
    var changePct = prevClose ? (change / prevClose) * 100 : 0;
    var q = r.indicators && r.indicators.quote && r.indicators.quote[0];
    prices[ticker] = {
      price: price,
      change: change,
      changePct: changePct,
      dayHigh: (q && q.high) ? Math.max.apply(null, q.high.filter(Boolean)) : meta.regularMarketDayHigh || 0,
      dayLow: (q && q.low) ? Math.min.apply(null, q.low.filter(Boolean)) : meta.regularMarketDayLow || 0,
      volume: meta.regularMarketVolume || 0,
      open: (q && q.open) ? q.open.filter(Boolean)[0] || 0 : 0,
      prevClose: prevClose,
      ts: Date.now(),
      direction: 'flat'
    };
    return true;
  }

  function fetchTickerChart(ticker, proxyIdx, cb) {
    if (proxyIdx >= CHART_PROXIES.length) return cb(false);
    var cfg = CHART_PROXIES[proxyIdx](ticker);
    fetch(cfg.url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var raw = cfg.mode === 'allorigins' ? JSON.parse(d.contents) : d;
        if (parseChartResponse(ticker, raw)) {
          cb(true);
        } else {
          throw new Error('No chart data');
        }
      })
      .catch(function () {
        fetchTickerChart(ticker, proxyIdx + 1, cb);
      });
  }

  function fetchInitialPrices(syms, cb) {
    if (!syms.length) return cb && cb();
    var pending = syms.length;
    var loaded = 0;
    var concurrent = 0;
    var queue = syms.slice();

    function next() {
      while (queue.length && concurrent < 6) {
        concurrent++;
        (function (t) {
          fetchTickerChart(t, 0, function (ok) {
            concurrent--;
            if (ok) loaded++;
            pending--;
            if (pending === 0) {
              console.log('[LiveEngine] Chart prices loaded:', loaded + '/' + syms.length);
              evaluateAll();
              if (cb) cb();
            } else {
              next();
            }
          });
        })(queue.shift());
      }
    }
    next();
  }

  // ── Event System ──
  function on(event, fn) { listeners.push({ event: event, fn: fn }); }
  function emit(event, data) {
    listeners.forEach(function (l) { if (l.event === event) l.fn(data); });
  }

  // ── Status UI helpers ──
  var STATUS_MAP = {
    SL_HIT:      { label: 'Stopped',    color: '#dc2626', bg: '#fef2f2', icon: 'fa-circle-xmark',  priority: 1 },
    TP2_HIT:     { label: 'TP2 Hit',    color: '#7c3aed', bg: '#f5f3ff', icon: 'fa-trophy',        priority: 2 },
    TP1_HIT:     { label: 'TP1 Hit',    color: '#059669', bg: '#ecfdf5', icon: 'fa-circle-check',  priority: 3 },
    TP1_PARTIAL: { label: 'TP1 Partial',color: '#059669', bg: '#ecfdf5', icon: 'fa-circle-half-stroke', priority: 4 },
    EXPIRED:     { label: 'Expired',    color: '#64748b', bg: '#f1f5f9', icon: 'fa-clock',         priority: 5 },
    NEAR_STOP:   { label: 'Near Stop',  color: '#f59e0b', bg: '#fffbeb', icon: 'fa-triangle-exclamation', priority: 6 },
    NEAR_TP1:    { label: 'Near TP1',   color: '#3b82f6', bg: '#eff6ff', icon: 'fa-bullseye',      priority: 7 },
    TRENDING:    { label: 'Trending',   color: '#059669', bg: '#ecfdf5', icon: 'fa-arrow-trend-up', priority: 8 },
    ENTRY_ZONE:  { label: 'Entry Zone', color: '#3b82f6', bg: '#eff6ff', icon: 'fa-crosshairs',    priority: 9 },
    UNDERWATER:  { label: 'Underwater', color: '#dc2626', bg: '#fef2f2', icon: 'fa-arrow-trend-down', priority: 10 },
    OPEN:        { label: 'Open',       color: '#64748b', bg: '#f1f5f9', icon: 'fa-circle',        priority: 11 }
  };

  function getStatusInfo(status) {
    return STATUS_MAP[status] || STATUS_MAP.OPEN;
  }

  // ── Connection UI ──
  function updateConnectionUI(state) {
    emit('connection', state);
  }

  // ── Market Hours Check ──
  function isMarketOpen() {
    var now = new Date();
    var day = now.getUTCDay();
    if (day === 0 || day === 6) return false; // weekend
    var utcH = now.getUTCHours();
    var utcM = now.getUTCMinutes();
    var mins = utcH * 60 + utcM;
    // NYSE: 13:30-20:00 UTC (includes pre-market from 13:00)
    return mins >= 780 && mins <= 1200;
  }

  // ── Public API ──
  window.LiveEngine = {
    init: function (opts) {
      if (!opts) opts = {};
      modesCfg = opts.modesCfg || null;

      // Avoid timer leak when init() is called twice.
      if (evalTimer) { clearInterval(evalTimer); evalTimer = null; }

      // Extract tickers from positions
      if (opts.positions) {
        positions = opts.positions;
        var tickerSet = {};
        Object.keys(positions).forEach(function (modeId) {
          positions[modeId].forEach(function (pos) {
            if (pos.ticker) {
              pos._modeId = modeId;
              tickerSet[pos.ticker] = true;
            }
          });
        });
        tickers = Object.keys(tickerSet);
      }

      if (!tickers.length) {
        console.log('[LiveEngine] No tickers to track');
        updateConnectionUI('idle');
        return;
      }

      console.log('[LiveEngine] Initializing with', tickers.length, 'tickers:', tickers.join(', '));

      // Fetch initial prices via HTTP, then connect WS
      fetchInitialPrices(tickers, function () {
        connect();
      });

      // Periodic full eval
      evalTimer = setInterval(evaluateAll, EVAL_INTERVAL);
    },

    // Hot-swap positions when a new snapshot lands (rotation/new scan).
    // Invalidates stale per-position eval so rotated-out tickers stop firing alerts.
    refreshPositions: function (newPositions) {
      if (!newPositions) return;
      positions = newPositions;
      var tickerSet = {};
      Object.keys(positions).forEach(function (modeId) {
        positions[modeId].forEach(function (pos) {
          if (pos.ticker) {
            pos._modeId = modeId;
            pos._eval = null;
            tickerSet[pos.ticker] = true;
          }
        });
      });
      tickers = Object.keys(tickerSet);
      console.log('[LiveEngine] refreshPositions —', tickers.length, 'tickers:', tickers.join(', '));
      try { if (typeof subscribe === 'function') subscribe(); } catch (e) { /* noop */ }
      try { if (typeof evaluateAll === 'function') evaluateAll(); } catch (e) { /* noop */ }
    },

    addTickers: function (extra) {
      var added = [];
      extra.forEach(function (t) { if (tickers.indexOf(t) < 0) { tickers.push(t); added.push(t); } });
      if (added.length && ws && ws.readyState === 1) subscribe(added);
      return added;
    },
    on: on,
    getPrice: function (t) { return prices[t] || null; },
    getPrices: function () { return prices; },
    getEval: function (modeId, ticker) {
      var arr = positions[modeId] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].ticker === ticker) return arr[i]._eval || null;
      }
      return null;
    },
    getAggregates: function () { return aggregates; },
    getStatusInfo: getStatusInfo,
    isConnected: function () { return connected; },
    isMarketOpen: isMarketOpen,
    STATUS_MAP: STATUS_MAP,

    destroy: function () {
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      stopPing();
      if (evalTimer) { clearInterval(evalTimer); evalTimer = null; }
      connected = false;
      listeners = [];
    }
  };
})();
