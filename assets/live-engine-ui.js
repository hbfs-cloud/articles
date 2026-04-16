/**
 * live-engine-ui.js — Dashboard layout + live portfolio cards
 * Transforms the scanner/status page into a 2-column trading dashboard
 * on desktop. Injects live portfolio strip, position rows, toasts.
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

  // Load JetBrains Mono via <link> to avoid FOUC
  var fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(fontLink);

  var css = document.createElement('style');
  css.textContent = [

    /* ═══ PAGE-LEVEL: widen + compress header ═══ */
    '@media(min-width:1024px){',
    '  .w{max-width:1520px!important;padding:0 2rem 2rem!important}',
    '  .hero{padding:.65rem 1.5rem .5rem!important}',
    '  .hero h1{font-size:1.25rem!important;margin-bottom:.15rem!important}',
    '  .hero p{font-size:.75rem!important;margin:0!important}',
    '  .hero-meta{margin-top:.25rem!important}',
    '  .breadcrumb{padding:.2rem 1.5rem!important;font-size:.62rem!important}',
    '  .mode-tabs{margin-bottom:.65rem!important;padding:.2rem!important}',
    '  .mode-tab{padding:.45rem .8rem!important;font-size:.78rem!important}',
    '}',

    /* ═══ DASHBOARD GRID on mode panels ═══ */
    '@media(min-width:1024px){',
    '  .mode-panel.lp-dashboard{',
    '    display:grid!important;',
    '    grid-template-columns:1fr 1fr;',
    '    grid-template-rows:auto auto auto auto;',
    '    gap:.6rem;',
    '    align-items:start;',
    '  }',
    '  .mode-panel.lp-dashboard>[data-grid="live"]{grid-column:1/-1;grid-row:1}',
    '  .mode-panel.lp-dashboard>[data-grid="equity"]{grid-column:1;grid-row:2;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="signals"]{grid-column:2;grid-row:2;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="orders"]{grid-column:1;grid-row:3;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="positions"]{grid-column:2;grid-row:3;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="history"]{grid-column:1/-1;grid-row:4;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="method"]{grid-column:1/-1;grid-row:5;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard>[data-grid="footer"]{grid-column:1/-1}',
    /* Compact equity in grid */
    '  .mode-panel.lp-dashboard .perf-hero{padding:.85rem!important;gap:1rem!important;flex-direction:column!important}',
    '  .mode-panel.lp-dashboard .perf-chart{min-height:140px!important}',
    '  .mode-panel.lp-dashboard .perf-stats{grid-template-columns:repeat(3,1fr)!important;min-width:0!important;gap:.4rem!important}',
    '  .mode-panel.lp-dashboard .ps{padding:.35rem .3rem!important}',
    '  .mode-panel.lp-dashboard .ps-v{font-size:1rem!important}',
    '  .mode-panel.lp-dashboard .ps-l{font-size:.52rem!important}',
    /* Compact section cards in grid */
    '  .mode-panel.lp-dashboard .section-card{padding:.75rem .9rem!important;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard .sc-head{margin-bottom:.5rem!important}',
    '  .mode-panel.lp-dashboard .sc-head h3{font-size:.85rem!important}',
    '  .mode-panel.lp-dashboard .t th,.mode-panel.lp-dashboard .t td{padding:.35rem .5rem!important;font-size:.72rem!important}',
    '  .mode-panel.lp-dashboard .scenario-bar-wrap{margin-bottom:.65rem!important;padding:.6rem .8rem!important}',
    '  .mode-panel.lp-dashboard .cta-card{padding:.75rem .9rem!important;margin-bottom:0!important}',
    '  .mode-panel.lp-dashboard .disc{margin-top:.5rem!important;padding:.6rem!important}',
    '}',

    /* ═══ LIVE PORTFOLIO CARD ═══ */
    '.lp-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;position:relative;border-left:3px solid var(--mode-color,#94a3b8);font-family:"JetBrains Mono",monospace}',

    '.lp-card.lp-init{opacity:.72}',
    '.lp-card.lp-init .lp-strip::after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--mode-color,#94a3b8),transparent);animation:lp-scan 1.8s ease-in-out infinite}',
    '@keyframes lp-scan{0%{opacity:.15}50%{opacity:.9}100%{opacity:.15}}',
    '.lp-card.lp-ready{opacity:1;transition:opacity .35s ease}',

    '.lp-strip{display:flex;align-items:center;gap:0;padding:0;position:relative;min-height:42px}',

    '.lp-strip-left{display:flex;align-items:center;gap:.4rem;padding:.35rem .7rem;border-right:1px solid #f1f5f9;white-space:nowrap;flex-shrink:0}',
    '.lp-live-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
    '.lp-live-dot.connected{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.18);animation:lp-pulse 2s infinite}',
    '.lp-live-dot.connecting{background:#f59e0b;animation:lp-pulse .8s infinite}',
    '.lp-live-dot.disconnected{background:#ef4444;animation:none}',
    '.lp-live-dot.idle{background:#cbd5e1;animation:none}',
    '@keyframes lp-pulse{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.18)}50%{box-shadow:0 0 0 6px rgba(16,185,129,.06)}}',
    '.lp-label{font-size:.58rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em}',
    '.lp-conn-chip{font-size:.55rem;font-weight:700;padding:.08rem .35rem;border-radius:4px;margin-left:.1rem}',
    '.lp-conn-chip.connected{color:#059669;background:#ecfdf5}',
    '.lp-conn-chip.connecting{color:#d97706;background:#fffbeb}',
    '.lp-conn-chip.disconnected{color:#dc2626;background:#fef2f2}',
    '.lp-conn-chip.idle{color:#94a3b8;background:#f8fafc}',

    '.lp-strip-pnl{display:flex;flex-direction:column;align-items:flex-start;padding:.3rem .8rem;border-right:1px solid #f1f5f9;flex-shrink:0;min-width:85px}',
    '.lp-pnl{font-size:1.2rem;font-weight:800;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:#0f172a;transition:color .2s}',
    '.lp-pnl.pos{color:#059669}',
    '.lp-pnl.neg{color:#dc2626}',
    '.lp-pnl.flat{color:#94a3b8}',
    '.lp-pnl-sub{font-size:.42rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:.05rem}',

    '.lp-strip-chips{display:flex;align-items:center;gap:.4rem;padding:.3rem .7rem;flex-wrap:wrap}',
    '.lp-chip{display:inline-flex;align-items:center;gap:.2rem;font-size:.55rem;font-weight:700;padding:.1rem .38rem;border-radius:5px;white-space:nowrap}',
    '.lp-chip-pos{background:#f1f5f9;color:#475569}',
    '.lp-chip-alert-crit{background:#fef2f2;color:#dc2626}',
    '.lp-chip-alert-warn{background:#fffbeb;color:#d97706}',

    '.lp-init-inline{display:flex;align-items:center;gap:.35rem;padding:.3rem .7rem;font-size:.58rem;color:#94a3b8;font-weight:600;flex-shrink:0;margin-left:auto}',
    '.lp-init-inline i{animation:lp-spin 1.2s linear infinite;color:var(--mode-color,#94a3b8);font-size:.58rem}',
    '@keyframes lp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    '.lp-card.lp-ready .lp-init-inline{display:none}',

    /* Position rows */
    '.lp-positions{border-top:1px solid #f1f5f9}',
    '.lp-row-head,.lp-row{display:grid;grid-template-columns:82px 88px 62px 1fr 86px;gap:0;align-items:center}',
    '.lp-row-head{padding:.12rem .7rem;background:#f8fafc}',
    '.lp-row-head span{font-size:.46rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.06em}',
    '.lp-row-head span:last-child{text-align:right;padding-right:.1rem}',

    '.lp-row{padding:.15rem .7rem;border-top:1px solid #f1f5f9;min-height:30px;transition:opacity .3s}',
    '.lp-row:first-child{border-top:none}',
    '.lp-row.terminal{opacity:.38;filter:grayscale(.5)}',

    '.lp-ticker{display:flex;flex-direction:column;gap:.03rem;padding-right:.3rem}',
    '.lp-ticker-sym{font-size:.72rem;font-weight:800;color:#0f172a;letter-spacing:.02em;line-height:1}',
    '.lp-ticker-days{font-size:.46rem;color:#94a3b8;font-weight:600}',

    '.lp-price-cell{display:flex;flex-direction:column;gap:.04rem}',
    '.lp-price{font-size:.7rem;font-weight:700;color:#334155;font-variant-numeric:tabular-nums;transition:color .15s;line-height:1}',
    '.lp-price.flash-up{animation:lp-flash-g .5s ease}',
    '.lp-price.flash-down{animation:lp-flash-r .5s ease}',
    '@keyframes lp-flash-g{0%{color:#059669;background:rgba(5,150,105,.1);border-radius:3px}100%{color:#334155;background:transparent}}',
    '@keyframes lp-flash-r{0%{color:#dc2626;background:rgba(220,38,38,.1);border-radius:3px}100%{color:#334155;background:transparent}}',
    '.lp-change{font-size:.5rem;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}',
    '.lp-change.pos{color:#059669}',
    '.lp-change.neg{color:#dc2626}',
    '.lp-change.flat{color:#94a3b8}',

    '.lp-pnl-cell{display:flex;align-items:center}',
    '.lp-pnl-val{font-size:.66rem;font-weight:700;font-variant-numeric:tabular-nums}',
    '.lp-pnl-val.pos{color:#059669}',
    '.lp-pnl-val.neg{color:#dc2626}',
    '.lp-pnl-val.flat{color:#94a3b8}',

    '.lp-gauge-cell{display:flex;flex-direction:column;gap:.18rem;padding:0 .5rem 0 .3rem}',
    '.lp-gauge{position:relative;height:5px;border-radius:2.5px;background:#e2e8f0;overflow:visible}',
    '.lp-gauge-fill{position:absolute;top:0;left:0;height:100%;border-radius:2.5px;transition:width .4s ease}',
    '.lp-gauge-cursor{position:absolute;top:-3px;width:3px;height:11px;border-radius:1.5px;transform:translateX(-50%);transition:left .4s ease;box-shadow:0 1px 4px rgba(0,0,0,.15)}',
    '.lp-gauge-labels{display:flex;justify-content:space-between;font-size:.52rem;color:#94a3b8;font-weight:600;font-variant-numeric:tabular-nums}',

    '.lp-badge-cell{display:flex;justify-content:flex-end}',
    '.lp-badge{display:inline-flex;align-items:center;gap:.18rem;font-size:.5rem;font-weight:700;padding:.1rem .32rem;border-radius:4px;white-space:nowrap;letter-spacing:.02em}',
    '.lp-badge i{font-size:.42rem}',

    '.lp-empty{display:flex;align-items:center;gap:.4rem;padding:.45rem .7rem;color:#94a3b8;font-size:.6rem;font-weight:500;border-top:1px solid #f1f5f9}',
    '.lp-empty i{font-size:.65rem;opacity:.5;flex-shrink:0}',

    /* Toasts */
    '.lp-toast-wrap{position:fixed;top:4.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none}',
    '.lp-toast{display:flex;align-items:center;gap:.5rem;padding:.55rem .8rem;border-radius:10px;font-size:.7rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.1);pointer-events:auto;border:1px solid #e2e8f0;background:#fff;animation:lp-toast-in .25s ease forwards,lp-toast-out .25s ease 4.7s forwards;opacity:0;font-family:"JetBrains Mono",monospace}',
    '.lp-toast i{font-size:.8rem;flex-shrink:0}',
    '.lp-toast-detail{font-size:.55rem;opacity:.6;margin-top:.1rem}',
    '@keyframes lp-toast-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes lp-toast-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(24px)}}',

    /* Mobile */
    '@media(max-width:600px){',
    '  .lp-strip{flex-wrap:wrap;min-height:auto}',
    '  .lp-strip-left{border-right:none;border-bottom:1px solid #f1f5f9;width:100%;padding:.4rem .65rem}',
    '  .lp-strip-pnl{border-right:none;padding:.35rem .65rem .25rem}',
    '  .lp-init-inline{margin-left:0;padding:.2rem .65rem .3rem}',
    '  .lp-pnl{font-size:1rem}',
    '  .lp-row,.lp-row-head{grid-template-columns:58px 72px 54px 1fr 70px;gap:0}',
    '  .lp-row{padding:.18rem .4rem;min-height:26px}',
    '  .lp-ticker-sym{font-size:.62rem}',
    '  .lp-price{font-size:.6rem}',
    '  .lp-change{font-size:.45rem}',
    '  .lp-pnl-val{font-size:.55rem}',
    '  .lp-gauge-labels{font-size:.4rem}',
    '  .lp-badge{font-size:.45rem;padding:.06rem .22rem}',
    '  .lp-toast-wrap{right:.75rem;left:.75rem}',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function fmt(n, d) { return n != null ? n.toFixed(d == null ? 2 : d) : '—'; }
  function sign(n) { return n > 0 ? '+' : ''; }

  var cards = {};
  var connState = 'idle';

  /* ── Reorganize panel children into a CSS grid ── */
  function reorganizePanel(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return;

    // Tag children for grid placement
    var children = panel.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];

      if (child.classList.contains('lp-card')) {
        child.setAttribute('data-grid', 'live');
      } else if (child.classList.contains('perf-hero')) {
        child.setAttribute('data-grid', 'equity');
      } else if (child.classList.contains('disc')) {
        child.setAttribute('data-grid', 'footer');
      } else if (child.classList.contains('community-section')) {
        child.setAttribute('data-grid', 'footer');
      } else if (child.classList.contains('related-section')) {
        child.setAttribute('data-grid', 'footer');
      } else if (child.classList.contains('cta-card')) {
        // Orders CTA or Close CTA
        child.setAttribute('data-grid', 'orders');
      } else if (child.getAttribute('data-static') === '1') {
        // "How to trade" — push to bottom
        child.setAttribute('data-grid', 'method');
      } else if (child.classList.contains('section-card')) {
        // Distinguish signals vs orders vs positions vs history
        var summary = child.querySelector('.sc-sum-title, .sc-head h3');
        var text = summary ? summary.textContent.toLowerCase() : '';

        if (text.indexOf('signal') >= 0) {
          child.setAttribute('data-grid', 'signals');
        } else if (text.indexOf('order') >= 0 || text.indexOf('watch') >= 0) {
          child.setAttribute('data-grid', 'orders');
        } else if (text.indexOf('open') >= 0 || text.indexOf('position') >= 0) {
          child.setAttribute('data-grid', 'positions');
        } else if (text.indexOf('history') >= 0 || text.indexOf('trade') >= 0) {
          child.setAttribute('data-grid', 'history');
        } else {
          child.setAttribute('data-grid', 'footer');
        }
      }
    }

    // Enable grid layout
    panel.classList.add('lp-dashboard');
  }

  function createCard(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return null;
    var color = MODE_COLORS[modeId] || '#94a3b8';

    var card = el('div', 'lp-card lp-init');
    card.id = 'lp-' + modeId;
    card.style.setProperty('--mode-color', color);

    card.innerHTML =
      '<div class="lp-strip">' +
        '<div class="lp-strip-left">' +
          '<span class="lp-live-dot idle" id="lp-dot-' + modeId + '"></span>' +
          '<span class="lp-label">Live Portfolio</span>' +
          '<span class="lp-conn-chip idle" id="lp-conn-' + modeId + '">Connecting...</span>' +
        '</div>' +
        '<div class="lp-strip-pnl">' +
          '<span class="lp-pnl flat" id="lp-pnl-' + modeId + '">—</span>' +
          '<span class="lp-pnl-sub">Unrealized P&amp;L</span>' +
        '</div>' +
        '<div class="lp-strip-chips" id="lp-chips-' + modeId + '"></div>' +
        '<div class="lp-init-inline" id="lp-init-' + modeId + '"><i class="fas fa-spinner"></i>Connecting to market data...</div>' +
      '</div>' +
      '<div class="lp-positions" id="lp-pos-' + modeId + '"></div>';

    var firstSection = panel.querySelector('.section-card, .perf-hero');
    if (firstSection) {
      panel.insertBefore(card, firstSection);
    } else {
      panel.appendChild(card);
    }

    cards[modeId] = { container: card, rows: {} };
    return cards[modeId];
  }

  function markReady(modeId) {
    var card = document.getElementById('lp-' + modeId);
    if (card) {
      card.classList.remove('lp-init');
      card.classList.add('lp-ready');
    }
  }

  function buildPositionRows(modeId, posArr) {
    var c = cards[modeId];
    if (!c) return;
    var wrap = document.getElementById('lp-pos-' + modeId);
    if (!wrap) return;

    if (!posArr || !posArr.length) {
      wrap.innerHTML = '<div class="lp-empty"><i class="fas fa-inbox"></i>No open positions</div>';
      return;
    }

    var html =
      '<div class="lp-row-head">' +
        '<span>Ticker</span><span>Price</span><span>P&amp;L</span><span>Range</span><span style="text-align:right">Status</span>' +
      '</div>';

    posArr.forEach(function (pos) {
      html +=
        '<div class="lp-row" id="lp-r-' + modeId + '-' + pos.ticker + '" data-ticker="' + pos.ticker + '">' +
          '<div class="lp-ticker">' +
            '<span class="lp-ticker-sym">' + pos.ticker + '</span>' +
            '<span class="lp-ticker-days" id="lp-days-' + modeId + '-' + pos.ticker + '">—</span>' +
          '</div>' +
          '<div class="lp-price-cell">' +
            '<span class="lp-price" id="lp-px-' + modeId + '-' + pos.ticker + '">$' + fmt(pos.entry) + '</span>' +
            '<span class="lp-change flat" id="lp-chg-' + modeId + '-' + pos.ticker + '">—</span>' +
          '</div>' +
          '<div class="lp-pnl-cell">' +
            '<span class="lp-pnl-val flat" id="lp-pv-' + modeId + '-' + pos.ticker + '">0.00%</span>' +
          '</div>' +
          '<div class="lp-gauge-cell">' +
            buildGaugeHTML(modeId, pos) +
          '</div>' +
          '<div class="lp-badge-cell">' +
            '<span class="lp-badge" id="lp-bg-' + modeId + '-' + pos.ticker + '" style="background:#f1f5f9;color:#94a3b8"><i class="fas fa-circle"></i> Open</span>' +
          '</div>' +
        '</div>';
    });

    wrap.innerHTML = html;
  }

  function buildGaugeHTML(modeId, pos) {
    var stop = pos.stop || 0;
    var entry = pos.entry || 0;
    var tp1 = pos.tp1 || entry;
    var tp2 = pos.tp2 || tp1;
    return (
      '<div class="lp-gauge" id="lp-g-' + modeId + '-' + pos.ticker + '">' +
        '<div class="lp-gauge-fill" style="width:0%;background:linear-gradient(90deg,#dc2626,#f59e0b,#059669)"></div>' +
        '<div class="lp-gauge-cursor" style="left:0%;background:#94a3b8"></div>' +
      '</div>' +
      '<div class="lp-gauge-labels">' +
        '<span>S $' + fmt(stop, 0) + '</span>' +
        '<span>E $' + fmt(entry, 0) + '</span>' +
        '<span>T1 $' + fmt(tp1, 0) + '</span>' +
        '<span>T2 $' + fmt(tp2, 0) + '</span>' +
      '</div>'
    );
  }

  function updateRow(modeId, r) {
    if (!r) return;
    var t = r.ticker;
    var si = LE.getStatusInfo(r.status);

    var pxEl = document.getElementById('lp-px-' + modeId + '-' + t);
    if (pxEl) {
      pxEl.textContent = '$' + fmt(r.price);
      pxEl.classList.remove('flash-up', 'flash-down');
      void pxEl.offsetWidth;
      if (r.direction === 'up') pxEl.classList.add('flash-up');
      else if (r.direction === 'down') pxEl.classList.add('flash-down');
    }

    var chgEl = document.getElementById('lp-chg-' + modeId + '-' + t);
    if (chgEl) {
      var cp = r.changePct || 0;
      chgEl.textContent = sign(cp) + fmt(cp) + '%';
      chgEl.className = 'lp-change ' + (cp > 0.01 ? 'pos' : cp < -0.01 ? 'neg' : 'flat');
    }

    var pvEl = document.getElementById('lp-pv-' + modeId + '-' + t);
    if (pvEl) {
      var pnl = r.pnlPct;
      pvEl.textContent = sign(pnl) + fmt(pnl) + '%';
      pvEl.className = 'lp-pnl-val ' + (pnl > 0.01 ? 'pos' : pnl < -0.01 ? 'neg' : 'flat');
    }

    var daysEl = document.getElementById('lp-days-' + modeId + '-' + t);
    if (daysEl) {
      daysEl.textContent = r.daysHeld + 'd / ' + (r.daysHeld + r.daysLeft) + 'd';
    }

    updateGauge(modeId, r);

    var bgEl = document.getElementById('lp-bg-' + modeId + '-' + t);
    if (bgEl) {
      bgEl.style.background = si.bg;
      bgEl.style.color = si.color;
      bgEl.innerHTML = '<i class="fas ' + si.icon + '"></i> ' + si.label;
    }

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

    if (cursor) {
      cursor.style.left = pct + '%';
      var si = LE.getStatusInfo(r.status);
      cursor.style.background = si.color;
      cursor.style.boxShadow = '0 1px 4px rgba(0,0,0,.15), 0 0 0 2px #fff';
    }
  }

  function updateConn(state) {
    connState = state;
    Object.keys(cards).forEach(function (modeId) {
      var dot = document.getElementById('lp-dot-' + modeId);
      var chip = document.getElementById('lp-conn-' + modeId);
      if (dot) dot.className = 'lp-live-dot ' + state;
      if (chip) {
        var labels = { connected: 'Live', connecting: 'Connecting...', disconnected: 'Reconnecting...', idle: 'Idle' };
        chip.textContent = labels[state] || state;
        chip.className = 'lp-conn-chip ' + state;
      }
      if (state === 'connected') markReady(modeId);
    });
  }

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

      var chipsEl = document.getElementById('lp-chips-' + modeId);
      if (chipsEl) {
        var alertCount = a.alerts.length;
        var critCount = alertCount > 0
          ? a.alerts.filter(function (x) { return ['SL_HIT', 'TP2_HIT', 'TP1_HIT'].indexOf(x.status) >= 0; }).length
          : 0;
        var html = '<span class="lp-chip lp-chip-pos"><i class="fas fa-layer-group"></i> ' + a.count + ' pos</span>';
        if (alertCount > 0) {
          var alertCls = critCount > 0 ? 'lp-chip-alert-crit' : 'lp-chip-alert-warn';
          html += '<span class="lp-chip ' + alertCls + '"><i class="fas fa-bell"></i> ' + alertCount + ' alert' + (alertCount > 1 ? 's' : '') + '</span>';
        }
        chipsEl.innerHTML = html;
      }
    });
  }

  function showToast(evalResult) {
    if (!toastContainer) return;
    var status = evalResult.status;
    if (['SL_HIT', 'TP2_HIT', 'TP1_HIT', 'TP1_PARTIAL', 'EXPIRED'].indexOf(status) < 0) return;

    var key = evalResult.ticker + ':' + status;
    var isCritical = ['SL_HIT', 'TP2_HIT'].indexOf(status) >= 0;
    var dedupMs = isCritical ? 60000 : 300000;
    if (lastToastTs[key] && Date.now() - lastToastTs[key] < dedupMs) return;
    lastToastTs[key] = Date.now();

    var si = LE.getStatusInfo(status);
    var toast = el('div', 'lp-toast');
    toast.style.borderLeftColor = si.color;
    toast.style.borderLeftWidth = '3px';
    toast.innerHTML =
      '<i class="fas ' + si.icon + '" style="color:' + si.color + '"></i>' +
      '<div style="color:#0f172a"><b>' + evalResult.ticker + '</b> — ' + si.label +
        '<div class="lp-toast-detail" style="color:#64748b">' + evalResult.statusDetail + '</div>' +
      '</div>';
    toastContainer.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

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
      if (spans[0]) {
        spans[0].className = worst < 0 ? 'neg' : 'pos';
        spans[0].innerHTML = '<i class="fas fa-shield-halved"></i> Worst: ' + sign(worst) + fmt(worst, 1) + '%';
      }
      if (spans[1]) {
        spans[1].className = now >= 0 ? 'pos' : 'neg';
        spans[1].innerHTML = '<i class="fas fa-circle-dot"></i> Now: ' + sign(now) + fmt(now, 1) + '%';
      }
      if (spans[2]) {
        spans[2].innerHTML = '<i class="fas fa-bullseye"></i> Best: +' + fmt(best, 1) + '%';
      }
    }

    var r = best - worst;
    var cp = r > 0 ? Math.max(0, Math.min(100, (now - worst) / r * 100)) : 50;
    var cursor = bar.querySelector('.scenario-cursor');
    if (cursor) cursor.style.left = cp.toFixed(1) + '%';
  }

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
            allPositions[modeId] = (modeData && modeData.positions && modeData.positions.length > 0)
              ? modeData.positions
              : [];
          });

          window._leModesCfg = modesCfgFlat;
          window._lePositions = allPositions;

          Object.keys(cfg.modes).forEach(function (modeId) {
            createCard(modeId);
            buildPositionRows(modeId, allPositions[modeId]);
            reorganizePanel(modeId);
          });

          // Resize ECharts after grid layout change
          setTimeout(function () {
            document.querySelectorAll('.perf-chart').forEach(function (el) {
              var chart = window.echarts && window.echarts.getInstanceByDom(el);
              if (chart) chart.resize();
            });
          }, 100);

          LE.on('connection', updateConn);
          LE.on('eval', function (data) {
            updateRow(data.modeId, data.result);
            updateScenarioBar(data.modeId);
            showToast(data.result);
          });
          LE.on('aggregates', updateAgg);

          LE.init({
            positions: allPositions,
            modesCfg: modesCfgFlat
          });
        });
    }).catch(function (e) {
      console.warn('[LiveEngineUI] Boot failed:', e);
      ['turbo', 'dynamic', 'balanced', 'secured', 'fortress'].forEach(function (modeId) {
        var panel = document.getElementById('p-' + modeId);
        if (panel) {
          var msg = el('div', 'lp-empty', '<i class="fas fa-exclamation-triangle"></i>Live data unavailable');
          msg.style.margin = '.5rem 0';
          var first = panel.querySelector('.section-card, .perf-hero');
          if (first) panel.insertBefore(msg, first); else panel.appendChild(msg);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
