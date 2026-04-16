/**
 * live-engine-ui.js — DOM renderer for LiveEngine on scanner/status page
 * Renders: connection badge, aggregate P&L banner, position price/status updates,
 * scenario bar animation, alert toasts, ticker tape.
 */
(function () {
  'use strict';
  if (!window.LiveEngine) return;

  var LE = window.LiveEngine;
  var activeMode = window.activeMode || 'balanced';
  var _v = Date.now();

  // ── Inject CSS ──
  var css = document.createElement('style');
  css.textContent = [
    '/* Live Engine UI */',
    '.le-bar{display:flex;align-items:center;gap:.65rem;padding:.65rem 1.25rem;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:14px;margin-bottom:1.35rem;flex-wrap:wrap;border:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden}',
    '.le-bar::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(59,130,246,.03) 50%,transparent 100%);animation:le-sweep 4s linear infinite;pointer-events:none}',
    '@keyframes le-sweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}',
    '.le-conn{display:inline-flex;align-items:center;gap:.35rem;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.25rem .65rem;border-radius:6px;flex-shrink:0}',
    '.le-conn.connected{background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.25)}',
    '.le-conn.connecting{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}',
    '.le-conn.disconnected{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}',
    '.le-conn.idle{background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.15)}',
    '.le-conn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}',
    '.le-conn.connected .le-conn-dot{background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.6);animation:le-pulse 2s infinite}',
    '.le-conn.connecting .le-conn-dot{background:#fbbf24;animation:le-pulse 1s infinite}',
    '.le-conn.disconnected .le-conn-dot{background:#f87171}',
    '.le-conn.idle .le-conn-dot{background:#94a3b8}',
    '@keyframes le-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
    '.le-pnl{font-family:"JetBrains Mono",monospace;font-size:1.4rem;font-weight:800;line-height:1;letter-spacing:-.02em}',
    '.le-pnl.pos{color:#34d399}',
    '.le-pnl.neg{color:#f87171}',
    '.le-pnl.flat{color:#94a3b8}',
    '.le-pnl-label{font-size:.6rem;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:600}',
    '.le-stats{display:flex;gap:1rem;margin-left:auto;flex-wrap:wrap}',
    '.le-stat{text-align:center;min-width:60px}',
    '.le-stat-v{font-family:"JetBrains Mono",monospace;font-size:.85rem;font-weight:700;color:#e2e8f0;line-height:1.2}',
    '.le-stat-l{font-size:.55rem;color:#64748b;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:.15rem}',
    '.le-tape{display:flex;gap:.5rem;overflow-x:auto;padding:.4rem 0;scrollbar-width:none;-ms-overflow-style:none;margin-top:.15rem;width:100%}',
    '.le-tape::-webkit-scrollbar{display:none}',
    '.le-tick{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .55rem;border-radius:5px;font-size:.65rem;font-weight:600;white-space:nowrap;flex-shrink:0;transition:all .3s;font-family:"JetBrains Mono",monospace;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}',
    '.le-tick.up{color:#34d399;background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.15)}',
    '.le-tick.down{color:#f87171;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.15)}',
    '.le-tick.flash-up{animation:le-flash-up .6s ease}',
    '.le-tick.flash-down{animation:le-flash-down .6s ease}',
    '@keyframes le-flash-up{0%{background:rgba(16,185,129,.3)}100%{background:rgba(16,185,129,.08)}}',
    '@keyframes le-flash-down{0%{background:rgba(239,68,68,.3)}100%{background:rgba(239,68,68,.08)}}',
    '/* Position row updates */',
    '.le-price-cell{transition:color .3s}',
    '.le-price-cell.flash-up{animation:le-cell-up .5s ease}',
    '.le-price-cell.flash-down{animation:le-cell-down .5s ease}',
    '@keyframes le-cell-up{0%{background:rgba(5,150,105,.15)}100%{background:transparent}}',
    '@keyframes le-cell-down{0%{background:rgba(220,38,38,.15)}100%{background:transparent}}',
    '.le-status-badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.62rem;font-weight:700;padding:.15rem .45rem;border-radius:5px;white-space:nowrap;letter-spacing:.02em}',
    '.le-status-badge i{font-size:.55rem}',
    '/* Alert toast */',
    '.le-toast-container{position:fixed;top:5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none}',
    '.le-toast{display:flex;align-items:center;gap:.6rem;padding:.75rem 1.1rem;border-radius:12px;font-size:.8rem;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.25);pointer-events:auto;animation:le-toast-in .3s ease,le-toast-out .3s ease 4.7s;opacity:0;animation-fill-mode:forwards;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08)}',
    '.le-toast i{font-size:1rem;flex-shrink:0}',
    '@keyframes le-toast-in{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes le-toast-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(30px)}}',
    '/* Market status */',
    '.le-mkt{font-size:.58rem;font-weight:700;padding:.15rem .45rem;border-radius:4px;text-transform:uppercase;letter-spacing:.06em}',
    '.le-mkt.open{background:rgba(16,185,129,.12);color:#34d399}',
    '.le-mkt.closed{background:rgba(148,163,184,.12);color:#94a3b8}',
    '@media(max-width:700px){.le-bar{padding:.55rem .85rem;gap:.45rem}.le-pnl{font-size:1.1rem}.le-stats{gap:.6rem}.le-stat-v{font-size:.75rem}}'
  ].join('\n');
  document.head.appendChild(css);

  // ── Create DOM elements ──
  var barEl = null;
  var tapeEl = null;
  var toastContainer = null;
  var lastToastTs = {};

  function createBar() {
    barEl = document.createElement('div');
    barEl.className = 'le-bar';
    barEl.id = 'liveEngineBar';
    barEl.innerHTML = [
      '<div class="le-conn idle" id="leConn"><span class="le-conn-dot"></span><span id="leConnLabel">Idle</span></div>',
      '<div class="le-mkt closed" id="leMkt">Closed</div>',
      '<div><div class="le-pnl flat" id="lePnl">—</div><div class="le-pnl-label">Unrealized P&L</div></div>',
      '<div class="le-stats" id="leStats"></div>',
      '<div class="le-tape" id="leTape"></div>'
    ].join('');

    // Insert before mode tabs or first section-card
    var tabs = document.querySelector('.mode-tabs');
    if (tabs && tabs.parentNode) {
      tabs.parentNode.insertBefore(barEl, tabs);
    }

    tapeEl = document.getElementById('leTape');

    // Toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'le-toast-container';
    document.body.appendChild(toastContainer);
  }

  // ── Update Connection Badge ──
  function updateConn(state) {
    var el = document.getElementById('leConn');
    var label = document.getElementById('leConnLabel');
    if (!el) return;
    el.className = 'le-conn ' + state;
    var labels = { connected: 'Live', connecting: 'Connecting...', disconnected: 'Reconnecting...', idle: 'Idle' };
    if (label) label.textContent = labels[state] || state;

    // Market status
    var mkt = document.getElementById('leMkt');
    if (mkt) {
      var open = LE.isMarketOpen();
      mkt.className = 'le-mkt ' + (open ? 'open' : 'closed');
      mkt.textContent = open ? 'Market Open' : 'Market Closed';
    }
  }

  // ── Update Aggregate P&L ──
  function updateAgg(aggs) {
    var modeId = window.activeMode || 'balanced';
    var a = aggs[modeId];
    if (!a) return;

    var pnlEl = document.getElementById('lePnl');
    if (pnlEl) {
      var pnl = a.totalPnl;
      var cls = pnl > 0.01 ? 'pos' : pnl < -0.01 ? 'neg' : 'flat';
      pnlEl.className = 'le-pnl ' + cls;
      pnlEl.textContent = (pnl > 0 ? '+' : '') + pnl.toFixed(2) + '%';
    }

    // Stats
    var statsEl = document.getElementById('leStats');
    if (statsEl) {
      var alertCount = a.alerts.length;
      var critCount = a.alerts.filter(function (x) { return ['SL_HIT', 'TP2_HIT', 'TP1_HIT'].indexOf(x.status) >= 0; }).length;

      statsEl.innerHTML = [
        '<div class="le-stat"><div class="le-stat-v">' + a.count + '</div><div class="le-stat-l">Positions</div></div>',
        alertCount > 0 ? '<div class="le-stat"><div class="le-stat-v" style="color:' + (critCount > 0 ? '#f87171' : '#fbbf24') + '">' + alertCount + '</div><div class="le-stat-l">Alerts</div></div>' : '',
        '<div class="le-stat"><div class="le-stat-v">' + Object.keys(LE.getPrices()).length + '</div><div class="le-stat-l">Tickers</div></div>'
      ].join('');
    }
  }

  // ── Update Ticker Tape ──
  function updateTape(data) {
    if (!tapeEl) return;
    var ticker = data.ticker;
    var p = data.data;
    var existing = tapeEl.querySelector('[data-ticker="' + ticker + '"]');

    var dir = p.direction || 'flat';
    var sign = p.changePct >= 0 ? '+' : '';
    var html = '<b>' + ticker + '</b> $' + p.price.toFixed(2) + ' <span style="opacity:.7">' + sign + p.changePct.toFixed(2) + '%</span>';

    if (existing) {
      existing.innerHTML = html;
      existing.className = 'le-tick ' + (dir === 'up' ? 'up' : dir === 'down' ? 'down' : '');
      // Flash animation
      existing.classList.remove('flash-up', 'flash-down');
      void existing.offsetWidth; // reflow
      existing.classList.add(dir === 'up' ? 'flash-up' : dir === 'down' ? 'flash-down' : '');
    } else {
      var el = document.createElement('span');
      el.className = 'le-tick ' + (dir === 'up' ? 'up' : dir === 'down' ? 'down' : '');
      el.setAttribute('data-ticker', ticker);
      el.innerHTML = html;
      tapeEl.appendChild(el);
    }
  }

  // ── Update Position Rows in Table ──
  function updatePositionRow(data) {
    var modeId = data.modeId;
    var r = data.result;
    if (!r) return;

    // Only update visible mode
    if (modeId !== (window.activeMode || 'balanced')) return;

    // Find the position row by ticker text in the active panel
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return;

    var rows = panel.querySelectorAll('.t tbody tr');
    rows.forEach(function (tr) {
      if (tr.classList.contains('thesis-row')) return;
      var firstTd = tr.querySelector('td b');
      if (!firstTd || firstTd.textContent.trim() !== r.ticker) return;

      var cells = tr.querySelectorAll('td');
      if (cells.length < 5) return;

      // Update "Now" price (cell index 3, might be hidden on mobile)
      var nowCell = null;
      var pnlCell = null;
      cells.forEach(function (td, idx) {
        var text = td.textContent.trim();
        if (text.match(/^\$[\d.]+$/) && idx >= 2 && idx <= 3 && !td.classList.contains('neg') && !td.classList.contains('pos')) {
          nowCell = td;
        }
        if (td.querySelector('b') && (td.classList.contains('pos') || td.classList.contains('neg')) && idx > 2) {
          pnlCell = td;
        }
      });

      // Update Now price
      if (nowCell) {
        nowCell.textContent = '$' + r.price.toFixed(2);
        nowCell.classList.add('le-price-cell');
        nowCell.classList.remove('flash-up', 'flash-down');
        void nowCell.offsetWidth;
        nowCell.classList.add(r.direction === 'up' ? 'flash-up' : 'flash-down');
      }

      // Update P&L
      if (pnlCell) {
        var pnl = r.pnlPct;
        pnlCell.className = pnl >= 0 ? 'pos' : 'neg';
        pnlCell.innerHTML = '<b>' + (pnl > 0 ? '+' : '') + pnl.toFixed(2) + '%</b>';
      }

      // Add/update status badge in the last cell (days left)
      var lastCell = cells[cells.length - 1];
      if (lastCell) {
        var si = LE.getStatusInfo(r.status);
        var badge = lastCell.querySelector('.le-status-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'le-status-badge';
          lastCell.appendChild(document.createElement('br'));
          lastCell.appendChild(badge);
        }
        badge.style.background = si.bg;
        badge.style.color = si.color;
        badge.innerHTML = '<i class="fas ' + si.icon + '"></i> ' + si.label;
      }

      // Row styling for terminal states
      if (r.status === 'SL_HIT') {
        tr.style.opacity = '0.5';
        tr.style.filter = 'grayscale(0.5)';
      } else if (r.status === 'TP2_HIT' || r.status === 'TP1_HIT') {
        tr.style.boxShadow = 'inset 3px 0 0 ' + (r.status === 'TP2_HIT' ? '#7c3aed' : '#059669');
      }
    });

    // Update scenario bar
    updateScenarioBar(modeId);
  }

  // ── Update Scenario Bar ──
  function updateScenarioBar(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel) return;
    var bar = panel.querySelector('.scenario-bar-wrap');
    if (!bar) return;

    var posArr = window.LiveEngine.getAggregates()[modeId];
    if (!posArr) return;

    // Recalculate from live evals
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
      if (spans[0]) { spans[0].className = worst < 0 ? 'neg' : 'pos'; spans[0].textContent = 'Worst: ' + (worst > 0 ? '+' : '') + worst.toFixed(1) + '%'; }
      if (spans[1]) { spans[1].className = now >= 0 ? 'pos' : 'neg'; spans[1].textContent = 'Now: ' + (now > 0 ? '+' : '') + now.toFixed(1) + '%'; }
      if (spans[2]) { spans[2].textContent = 'Best: +' + best.toFixed(1) + '%'; }
    }

    var r = best - worst;
    var cp = r > 0 ? Math.max(0, Math.min(100, (now - worst) / r * 100)) : 50;
    var cursor = bar.querySelector('.scenario-cursor');
    if (cursor) cursor.style.left = cp.toFixed(1) + '%';
  }

  // ── Toast Notifications ──
  function showToast(evalResult) {
    if (!toastContainer) return;
    var status = evalResult.status;
    // Only toast critical events
    if (['SL_HIT', 'TP2_HIT', 'TP1_HIT', 'TP1_PARTIAL', 'EXPIRED'].indexOf(status) < 0) return;

    // Cooldown 5 min per ticker+status
    var key = evalResult.ticker + ':' + status;
    if (lastToastTs[key] && Date.now() - lastToastTs[key] < 300000) return;
    lastToastTs[key] = Date.now();

    var si = LE.getStatusInfo(status);
    var toast = document.createElement('div');
    toast.className = 'le-toast';
    toast.style.background = si.bg;
    toast.style.color = si.color;
    toast.innerHTML = '<i class="fas ' + si.icon + '"></i><div><b>' + evalResult.ticker + '</b> — ' + si.label + '<br><span style="font-size:.72rem;opacity:.7">' + evalResult.statusDetail + '</span></div>';
    toastContainer.appendChild(toast);

    // Auto-remove after 5s
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

  // ── Bootstrap ──
  function boot() {
    createBar();

    // Fetch modes config + latest snapshot to get positions
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
          // Extract positions per mode
          var allPositions = {};
          var modesCfgFlat = {};

          Object.keys(cfg.modes).forEach(function (modeId) {
            modesCfgFlat[modeId] = cfg.modes[modeId];
            var modeData = snap.modes ? snap.modes[modeId] : null;
            if (modeData && modeData.positions && modeData.positions.length > 0) {
              allPositions[modeId] = modeData.positions;
            } else {
              allPositions[modeId] = [];
            }
          });

          // Store for scenario bar updates
          window._leModesCfg = modesCfgFlat;
          window._lePositions = allPositions;

          // Wire up events
          LE.on('connection', updateConn);
          LE.on('tick', updateTape);
          LE.on('eval', function (data) {
            updatePositionRow(data);
            showToast(data.result);
          });
          LE.on('aggregates', updateAgg);

          // Also re-render on mode switch
          var origSwitch = window.switchMode;
          if (origSwitch) {
            window.switchMode = function (id, opts) {
              origSwitch(id, opts);
              // Re-evaluate aggregates for new mode
              setTimeout(function () { updateAgg(LE.getAggregates()); }, 100);
            };
          }

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

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
