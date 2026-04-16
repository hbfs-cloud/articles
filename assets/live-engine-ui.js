/**
 * live-engine-ui.js — Per-mode live portfolio cards for scanner/status
 * Renders inside each #p-{modeId} panel: aggregate P&L, position rows
 * with price range gauges, status badges, flash animations, toasts.
 */
(function () {
  'use strict';
  if (!window.LiveEngine) return;

  var LE = window.LiveEngine;
  var _v = Date.now();
  var lastToastTs = {};
  var toastContainer = null;
  var MODE_COLORS = {
    turbo: '#f59e0b', dynamic: '#dc2626', balanced: '#059669',
    secured: '#2563eb', fortress: '#6d28d9'
  };

  // ── Inject CSS ──
  var css = document.createElement('style');
  css.textContent = [
    '/* ═══ Live Portfolio Card ═══ */',
    '@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap");',

    '.lp-card{background:linear-gradient(145deg,#0c111b 0%,#111827 60%,#0f172a 100%);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:0;margin-bottom:1.35rem;overflow:hidden;position:relative}',
    '.lp-card::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 0%,var(--mode-color,.5) 50%,transparent 100%);opacity:.4}',

    '/* Header row */',
    '.lp-header{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.1rem .65rem;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.lp-title{display:flex;align-items:center;gap:.5rem;font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em}',
    '.lp-live-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;animation:lp-pulse 2s infinite}',
    '.lp-live-dot.connected{background:#34d399;box-shadow:0 0 8px rgba(52,211,153,.5)}',
    '.lp-live-dot.connecting{background:#fbbf24;animation:lp-pulse .8s infinite}',
    '.lp-live-dot.disconnected{background:#f87171;animation:none}',
    '.lp-live-dot.idle{background:#64748b;animation:none}',
    '@keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}',
    '.lp-conn-label{font-size:.6rem;color:#475569;font-weight:600}',

    '/* Aggregate strip */',
    '.lp-agg{display:flex;align-items:center;gap:1.25rem;padding:.75rem 1.1rem;flex-wrap:wrap}',
    '.lp-pnl-wrap{display:flex;flex-direction:column;gap:.1rem}',
    '.lp-pnl{font-family:"JetBrains Mono",monospace;font-size:1.6rem;font-weight:800;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}',
    '.lp-pnl.pos{color:#34d399}',
    '.lp-pnl.neg{color:#f87171}',
    '.lp-pnl.flat{color:#64748b}',
    '.lp-pnl-sub{font-size:.58rem;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.08em}',
    '.lp-stats{display:flex;gap:.85rem;margin-left:auto;flex-wrap:wrap}',
    '.lp-stat{text-align:center;padding:.35rem .6rem;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.04);min-width:52px}',
    '.lp-stat-v{font-family:"JetBrains Mono",monospace;font-size:.82rem;font-weight:700;color:#e2e8f0;line-height:1.2;font-variant-numeric:tabular-nums}',
    '.lp-stat-l{font-size:.5rem;color:#475569;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:.1rem}',

    '/* Position rows */',
    '.lp-positions{padding:0 .75rem .75rem}',
    '.lp-row{display:grid;grid-template-columns:minmax(70px,auto) minmax(72px,1fr) 1fr minmax(50px,auto);gap:.4rem .6rem;align-items:center;padding:.6rem .5rem;border-bottom:1px solid rgba(255,255,255,.04);transition:opacity .3s}',
    '.lp-row:last-child{border-bottom:none}',
    '.lp-row.terminal{opacity:.45;filter:grayscale(.4)}',
    '.lp-row-head{display:grid;grid-template-columns:minmax(70px,auto) minmax(72px,1fr) 1fr minmax(50px,auto);gap:.4rem .6rem;padding:.35rem .5rem .25rem;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.lp-row-head span{font-size:.52rem;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.08em}',

    '/* Ticker cell */',
    '.lp-ticker{display:flex;flex-direction:column;gap:.1rem}',
    '.lp-ticker-sym{font-family:"JetBrains Mono",monospace;font-size:.82rem;font-weight:800;color:#f1f5f9;letter-spacing:.02em}',
    '.lp-ticker-days{font-size:.55rem;color:#475569;font-weight:600}',

    '/* Price cell */',
    '.lp-price-wrap{display:flex;flex-direction:column;gap:.15rem}',
    '.lp-price{font-family:"JetBrains Mono",monospace;font-size:.82rem;font-weight:700;color:#cbd5e1;font-variant-numeric:tabular-nums;transition:color .2s}',
    '.lp-price.flash-up{animation:lp-flash-g .5s ease}',
    '.lp-price.flash-down{animation:lp-flash-r .5s ease}',
    '@keyframes lp-flash-g{0%{color:#34d399;text-shadow:0 0 8px rgba(52,211,153,.4)}100%{color:#cbd5e1;text-shadow:none}}',
    '@keyframes lp-flash-r{0%{color:#f87171;text-shadow:0 0 8px rgba(248,113,113,.4)}100%{color:#cbd5e1;text-shadow:none}}',
    '.lp-change{font-family:"JetBrains Mono",monospace;font-size:.6rem;font-weight:600;font-variant-numeric:tabular-nums}',
    '.lp-change.pos{color:#34d399}',
    '.lp-change.neg{color:#f87171}',
    '.lp-change.flat{color:#64748b}',

    '/* Range gauge */',
    '.lp-gauge-wrap{display:flex;flex-direction:column;gap:.25rem}',
    '.lp-pnl-val{font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:700;font-variant-numeric:tabular-nums}',
    '.lp-pnl-val.pos{color:#34d399}',
    '.lp-pnl-val.neg{color:#f87171}',
    '.lp-pnl-val.flat{color:#64748b}',
    '.lp-gauge{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:visible}',
    '.lp-gauge-fill{position:absolute;top:0;left:0;height:100%;border-radius:3px;transition:width .4s ease}',
    '.lp-gauge-cursor{position:absolute;top:-3px;width:3px;height:12px;border-radius:1.5px;transform:translateX(-50%);transition:left .4s ease;box-shadow:0 0 6px var(--cursor-glow,rgba(255,255,255,.3))}',
    '.lp-gauge-labels{display:flex;justify-content:space-between;font-size:.48rem;color:#334155;font-weight:600;font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}',

    '/* Status badge */',
    '.lp-badge{display:inline-flex;align-items:center;gap:.2rem;font-size:.58rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap;letter-spacing:.02em;justify-self:end}',
    '.lp-badge i{font-size:.5rem}',

    '/* Empty state */',
    '.lp-empty{padding:1.5rem 1rem;text-align:center;color:#334155;font-size:.78rem;font-weight:500}',
    '.lp-empty i{display:block;font-size:1.2rem;color:#1e293b;margin-bottom:.4rem}',

    '/* Toast */',
    '.lp-toast-wrap{position:fixed;top:5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none}',
    '.lp-toast{display:flex;align-items:center;gap:.55rem;padding:.7rem 1rem;border-radius:12px;font-size:.78rem;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.35);pointer-events:auto;backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08);animation:lp-toast-in .25s ease forwards,lp-toast-out .25s ease 4.7s forwards;opacity:0}',
    '.lp-toast i{font-size:.95rem;flex-shrink:0}',
    '.lp-toast-detail{font-size:.65rem;opacity:.7;margin-top:.1rem}',
    '@keyframes lp-toast-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes lp-toast-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(24px)}}',

    '/* Responsive */',
    '@media(max-width:600px){',
    '  .lp-agg{gap:.7rem;padding:.6rem .85rem}',
    '  .lp-pnl{font-size:1.25rem}',
    '  .lp-stats{gap:.5rem}',
    '  .lp-stat{min-width:44px;padding:.25rem .4rem}',
    '  .lp-stat-v{font-size:.72rem}',
    '  .lp-row{grid-template-columns:minmax(55px,auto) minmax(60px,.8fr) 1fr minmax(45px,auto);gap:.3rem .4rem;padding:.5rem .3rem}',
    '  .lp-row-head{grid-template-columns:minmax(55px,auto) minmax(60px,.8fr) 1fr minmax(45px,auto);gap:.3rem .4rem;padding:.25rem .3rem}',
    '  .lp-ticker-sym{font-size:.72rem}',
    '  .lp-price{font-size:.72rem}',
    '  .lp-pnl-val{font-size:.65rem}',
    '  .lp-gauge-labels{font-size:.42rem}',
    '  .lp-badge{font-size:.52rem;padding:.1rem .3rem}',
    '  .lp-toast-wrap{right:.75rem;left:.75rem}',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  // ── DOM helpers ──
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function fmt(n, d) { return n != null ? n.toFixed(d == null ? 2 : d) : '—'; }
  function sign(n) { return n > 0 ? '+' : ''; }

  // ── Per-mode card registry ──
  var cards = {}; // { modeId: { container, rows: { ticker: rowEl }, ... } }

  function createCard(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return null;
    var color = MODE_COLORS[modeId] || '#64748b';

    var card = el('div', 'lp-card');
    card.id = 'lp-' + modeId;
    card.style.setProperty('--mode-color', color);

    // Header
    card.innerHTML =
      '<div class="lp-header">' +
        '<span class="lp-title">' +
          '<span class="lp-live-dot idle" id="lp-dot-' + modeId + '"></span>' +
          'Live Portfolio' +
        '</span>' +
        '<span class="lp-conn-label" id="lp-conn-' + modeId + '">Idle</span>' +
      '</div>' +
      '<div class="lp-agg" id="lp-agg-' + modeId + '">' +
        '<div class="lp-pnl-wrap">' +
          '<span class="lp-pnl flat" id="lp-pnl-' + modeId + '">—</span>' +
          '<span class="lp-pnl-sub">Unrealized P&L</span>' +
        '</div>' +
        '<div class="lp-stats" id="lp-stats-' + modeId + '"></div>' +
      '</div>' +
      '<div class="lp-positions" id="lp-pos-' + modeId + '"></div>';

    // Insert before the first section-card inside the panel
    var firstSection = panel.querySelector('.section-card, .perf-hero');
    if (firstSection) {
      panel.insertBefore(card, firstSection);
    } else {
      panel.appendChild(card);
    }

    cards[modeId] = { container: card, rows: {} };
    return cards[modeId];
  }

  // ── Build position rows ──
  function buildPositionRows(modeId, posArr) {
    var c = cards[modeId];
    if (!c) return;
    var wrap = document.getElementById('lp-pos-' + modeId);
    if (!wrap) return;

    if (!posArr || !posArr.length) {
      wrap.innerHTML = '<div class="lp-empty"><i class="fas fa-inbox"></i>No open positions</div>';
      return;
    }

    var html = '<div class="lp-row-head"><span>Ticker</span><span>Price</span><span>Range</span><span>Status</span></div>';
    posArr.forEach(function (pos) {
      html += '<div class="lp-row" id="lp-r-' + modeId + '-' + pos.ticker + '" data-ticker="' + pos.ticker + '">' +
        '<div class="lp-ticker">' +
          '<span class="lp-ticker-sym">' + pos.ticker + '</span>' +
          '<span class="lp-ticker-days" id="lp-days-' + modeId + '-' + pos.ticker + '">—</span>' +
        '</div>' +
        '<div class="lp-price-wrap">' +
          '<span class="lp-price" id="lp-px-' + modeId + '-' + pos.ticker + '">$' + fmt(pos.entry) + '</span>' +
          '<span class="lp-change flat" id="lp-chg-' + modeId + '-' + pos.ticker + '">—</span>' +
        '</div>' +
        '<div class="lp-gauge-wrap">' +
          '<span class="lp-pnl-val flat" id="lp-pv-' + modeId + '-' + pos.ticker + '">0.00%</span>' +
          buildGaugeHTML(modeId, pos) +
        '</div>' +
        '<span class="lp-badge" id="lp-bg-' + modeId + '-' + pos.ticker + '" style="background:rgba(100,116,139,.12);color:#94a3b8"><i class="fas fa-circle"></i> Open</span>' +
      '</div>';
    });
    wrap.innerHTML = html;
  }

  function buildGaugeHTML(modeId, pos) {
    var stop = pos.stop || 0;
    var entry = pos.entry || 0;
    var tp1 = pos.tp1 || entry;
    var tp2 = pos.tp2 || tp1;
    return '<div class="lp-gauge" id="lp-g-' + modeId + '-' + pos.ticker + '">' +
      '<div class="lp-gauge-fill" style="width:0%;background:linear-gradient(90deg,#dc2626,#f59e0b,#059669)"></div>' +
      '<div class="lp-gauge-cursor" style="left:0%;background:#fff"></div>' +
    '</div>' +
    '<div class="lp-gauge-labels"><span>S $' + fmt(stop, 0) + '</span><span>E $' + fmt(entry, 0) + '</span><span>T1 $' + fmt(tp1, 0) + '</span><span>T2 $' + fmt(tp2, 0) + '</span></div>';
  }

  // ── Update position row from eval result ──
  function updateRow(modeId, r) {
    if (!r) return;
    var t = r.ticker;
    var si = LE.getStatusInfo(r.status);

    // Price
    var pxEl = document.getElementById('lp-px-' + modeId + '-' + t);
    if (pxEl) {
      pxEl.textContent = '$' + fmt(r.price);
      pxEl.classList.remove('flash-up', 'flash-down');
      void pxEl.offsetWidth;
      if (r.direction === 'up') pxEl.classList.add('flash-up');
      else if (r.direction === 'down') pxEl.classList.add('flash-down');
    }

    // Day change
    var chgEl = document.getElementById('lp-chg-' + modeId + '-' + t);
    if (chgEl) {
      var cp = r.changePct || 0;
      chgEl.textContent = sign(cp) + fmt(cp) + '%';
      chgEl.className = 'lp-change ' + (cp > 0.01 ? 'pos' : cp < -0.01 ? 'neg' : 'flat');
    }

    // P&L value
    var pvEl = document.getElementById('lp-pv-' + modeId + '-' + t);
    if (pvEl) {
      var pnl = r.pnlPct;
      pvEl.textContent = sign(pnl) + fmt(pnl) + '%';
      pvEl.className = 'lp-pnl-val ' + (pnl > 0.01 ? 'pos' : pnl < -0.01 ? 'neg' : 'flat');
    }

    // Days
    var daysEl = document.getElementById('lp-days-' + modeId + '-' + t);
    if (daysEl) {
      daysEl.textContent = r.daysHeld + 'd / ' + (r.daysHeld + r.daysLeft) + 'd';
    }

    // Gauge
    updateGauge(modeId, r);

    // Badge
    var bgEl = document.getElementById('lp-bg-' + modeId + '-' + t);
    if (bgEl) {
      bgEl.style.background = si.bg;
      bgEl.style.color = si.color;
      bgEl.innerHTML = '<i class="fas ' + si.icon + '"></i> ' + si.label;
    }

    // Terminal state styling
    var rowEl = document.getElementById('lp-r-' + modeId + '-' + t);
    if (rowEl) {
      if (r.status === 'SL_HIT' || r.status === 'EXPIRED') {
        rowEl.classList.add('terminal');
      } else {
        rowEl.classList.remove('terminal');
      }
      if (r.status === 'TP2_HIT') {
        rowEl.style.borderLeft = '2px solid #7c3aed';
      } else if (r.status === 'TP1_HIT' || r.status === 'TP1_PARTIAL') {
        rowEl.style.borderLeft = '2px solid #059669';
      } else {
        rowEl.style.borderLeft = '';
      }
    }
  }

  function updateGauge(modeId, r) {
    var gaugeEl = document.getElementById('lp-g-' + modeId + '-' + r.ticker);
    if (!gaugeEl) return;

    var stop = r.originalStop || r.stop;
    var tp2 = r.tp2 || r.tp1 || r.entry;
    var range = tp2 - stop;
    if (range <= 0) return;

    var pct = Math.max(0, Math.min(100, ((r.price - stop) / range) * 100));
    var entryPct = Math.max(0, Math.min(100, ((r.entry - stop) / range) * 100));

    var fill = gaugeEl.querySelector('.lp-gauge-fill');
    var cursor = gaugeEl.querySelector('.lp-gauge-cursor');

    // Fill gradient from stop→current
    if (fill) {
      fill.style.width = pct + '%';
      if (pct < entryPct * 0.5) {
        fill.style.background = 'linear-gradient(90deg,#dc2626,#f87171)';
      } else if (pct < entryPct) {
        fill.style.background = 'linear-gradient(90deg,#dc2626,#f59e0b)';
      } else {
        fill.style.background = 'linear-gradient(90deg,#dc2626,#f59e0b ' + (entryPct / pct * 100).toFixed(0) + '%,#059669)';
      }
    }

    // Cursor
    if (cursor) {
      cursor.style.left = pct + '%';
      var si = LE.getStatusInfo(r.status);
      cursor.style.background = si.color;
      cursor.style.setProperty('--cursor-glow', si.color + '66');
      cursor.style.boxShadow = '0 0 8px ' + si.color + '55';
    }
  }

  // ── Connection update ──
  function updateConn(state) {
    Object.keys(cards).forEach(function (modeId) {
      var dot = document.getElementById('lp-dot-' + modeId);
      var label = document.getElementById('lp-conn-' + modeId);
      if (dot) {
        dot.className = 'lp-live-dot ' + state;
      }
      if (label) {
        var labels = { connected: 'Live', connecting: 'Connecting...', disconnected: 'Reconnecting...', idle: 'Idle' };
        label.textContent = labels[state] || state;
        label.style.color = state === 'connected' ? '#34d399' : state === 'connecting' ? '#fbbf24' : state === 'disconnected' ? '#f87171' : '#475569';
      }
    });
  }

  // ── Aggregate update ──
  function updateAgg(aggs) {
    Object.keys(cards).forEach(function (modeId) {
      var a = aggs[modeId];
      if (!a) return;

      var pnlEl = document.getElementById('lp-pnl-' + modeId);
      if (pnlEl) {
        var pnl = a.totalPnl;
        pnlEl.className = 'lp-pnl ' + (pnl > 0.01 ? 'pos' : pnl < -0.01 ? 'neg' : 'flat');
        pnlEl.textContent = sign(pnl) + fmt(pnl) + '%';
      }

      var statsEl = document.getElementById('lp-stats-' + modeId);
      if (statsEl) {
        var alertCount = a.alerts.length;
        var html = '<div class="lp-stat"><div class="lp-stat-v">' + a.count + '</div><div class="lp-stat-l">Positions</div></div>';
        if (alertCount > 0) {
          var critCount = a.alerts.filter(function (x) { return ['SL_HIT', 'TP2_HIT', 'TP1_HIT'].indexOf(x.status) >= 0; }).length;
          html += '<div class="lp-stat"><div class="lp-stat-v" style="color:' + (critCount > 0 ? '#f87171' : '#fbbf24') + '">' + alertCount + '</div><div class="lp-stat-l">Alerts</div></div>';
        }
        statsEl.innerHTML = html;
      }
    });
  }

  // ── Toast ──
  function showToast(evalResult) {
    if (!toastContainer) return;
    var status = evalResult.status;
    if (['SL_HIT', 'TP2_HIT', 'TP1_HIT', 'TP1_PARTIAL', 'EXPIRED'].indexOf(status) < 0) return;

    var key = evalResult.ticker + ':' + status;
    if (lastToastTs[key] && Date.now() - lastToastTs[key] < 300000) return;
    lastToastTs[key] = Date.now();

    var si = LE.getStatusInfo(status);
    var toast = el('div', 'lp-toast');
    toast.style.background = 'linear-gradient(135deg,' + si.bg + ' 0%,rgba(15,23,42,.95) 100%)';
    toast.style.color = si.color;
    toast.style.borderColor = si.color + '22';
    toast.innerHTML = '<i class="fas ' + si.icon + '"></i><div><b>' + evalResult.ticker + '</b> — ' + si.label + '<div class="lp-toast-detail">' + evalResult.statusDetail + '</div></div>';
    toastContainer.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

  // ── Scenario bar sync ──
  function updateScenarioBar(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return;
    var bar = panel.querySelector('.scenario-bar-wrap');
    if (!bar) return;

    var cfg = window._leModesCfg ? window._leModesCfg[modeId] : null;
    if (!cfg) return;
    var pSize = cfg.portfolioSize || 1;
    var sizePct = cfg.positionSizePct || 1;
    var allocPct = sizePct / pSize;
    var worst = 0, now = 0, best = 0;

    var posData = window._lePositions ? window._lePositions[modeId] : [];
    posData.forEach(function (p) {
      if (!p._eval) return;
      var entry = p.entry || 0;
      var stop = p._eval.stop || p.stop || 0;
      var tp = p.tp2 || p.tp1 || entry;
      if (entry > 0 && stop > 0) worst += ((stop - entry) / entry * 100) * allocPct;
      if (entry > 0 && tp > 0) best += ((tp - entry) / entry * 100) * allocPct;
      now += (p._eval.pnlPct || 0) * allocPct;
    });

    var labels = bar.querySelector('.scenario-labels');
    if (labels) {
      var spans = labels.querySelectorAll('span');
      if (spans[0]) { spans[0].className = worst < 0 ? 'neg' : 'pos'; spans[0].innerHTML = '<i class="fas fa-shield-halved"></i> Worst: ' + sign(worst) + fmt(worst, 1) + '%'; }
      if (spans[1]) { spans[1].className = now >= 0 ? 'pos' : 'neg'; spans[1].innerHTML = '<i class="fas fa-circle-dot"></i> Now: ' + sign(now) + fmt(now, 1) + '%'; }
      if (spans[2]) { spans[2].innerHTML = '<i class="fas fa-bullseye"></i> Best: +' + fmt(best, 1) + '%'; }
    }

    var r = best - worst;
    var cp = r > 0 ? Math.max(0, Math.min(100, (now - worst) / r * 100)) : 50;
    var cursor = bar.querySelector('.scenario-cursor');
    if (cursor) cursor.style.left = cp.toFixed(1) + '%';
  }

  // ── Bootstrap ──
  function boot() {
    toastContainer = el('div', 'lp-toast-wrap');
    document.body.appendChild(toastContainer);

    Promise.all([
      fetch('/data/modes-config.json?v=' + _v).then(function (r) { return r.json(); }),
      fetch('/scanner/status/history/dates.json?v=' + _v).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var cfg = results[0];
      var dates = results[1];
      if (!dates || !dates.length) return;

      var latest = dates[dates.length - 1];
      return fetch('/scanner/status/history/' + latest + '.json?v=' + _v)
        .then(function (r) { return r.json(); })
        .then(function (snap) {
          var allPositions = {};
          var modesCfgFlat = {};

          Object.keys(cfg.modes).forEach(function (modeId) {
            modesCfgFlat[modeId] = cfg.modes[modeId];
            var modeData = snap.modes ? snap.modes[modeId] : null;
            allPositions[modeId] = (modeData && modeData.positions && modeData.positions.length > 0) ? modeData.positions : [];
          });

          window._leModesCfg = modesCfgFlat;
          window._lePositions = allPositions;

          // Create cards for all modes
          Object.keys(cfg.modes).forEach(function (modeId) {
            createCard(modeId);
            buildPositionRows(modeId, allPositions[modeId]);
          });

          // Wire events
          LE.on('connection', updateConn);

          LE.on('tick', function () {
            // tick handled via eval
          });

          LE.on('eval', function (data) {
            updateRow(data.modeId, data.result);
            updateScenarioBar(data.modeId);
            showToast(data.result);
          });

          LE.on('aggregates', updateAgg);

          // Init engine
          LE.init({
            positions: allPositions,
            modesCfg: modesCfgFlat
          });
        });
    }).catch(function (e) {
      console.warn('[LiveEngineUI] Boot failed:', e);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
