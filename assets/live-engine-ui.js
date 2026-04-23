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
  // Nominal capital per mode — used to translate % return into a $ figure users can relate to.
  // 10k default; fortress half-sized so effectively 5k of exposure per slot.
  var NOMINAL_CAPITAL = { turbo: 10000, dynamic: 10000, balanced: 10000, secured: 10000, fortress: 10000 };

  // Load JetBrains Mono via <link> to avoid FOUC
  var fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.crossOrigin = 'anonymous';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(fontLink);

  var css = document.createElement('style');
  css.textContent = [

    /* ═══════════════════════════════════════════════
       PAGE-LEVEL OVERRIDES — widen container, compress chrome
    ═══════════════════════════════════════════════ */
    '@media(min-width:1024px){',
    '  .w{max-width:1560px!important;padding:0 1.5rem 1.5rem!important}',
    /* Flatten the hero — just a title bar */
    '  .hero{padding:.5rem 1.5rem .4rem!important;border-bottom:1px solid #f1f5f9!important;background:#fff!important}',
    '  .hero h1{font-size:1rem!important;margin-bottom:.1rem!important;font-weight:700!important;color:#0f172a!important}',
    '  .hero p{font-size:.72rem!important;margin:0!important;color:#64748b!important}',
    '  .hero-meta{margin-top:.2rem!important;font-size:.65rem!important;color:#94a3b8!important}',
    '  .breadcrumb{padding:.2rem 1.5rem!important;font-size:.6rem!important;background:#fafafa!important;border-bottom:1px solid #f1f5f9!important}',
    '  .mode-tabs{margin:.5rem 0 .6rem!important;padding:.2rem!important;gap:.2rem!important;background:#f8fafc!important;border-radius:10px!important;border:1px solid #e2e8f0!important;display:flex!important;align-items:center!important}',
    '  .mode-tab{padding:.38rem .9rem!important;font-size:.72rem!important;border-radius:7px!important;font-weight:600!important;transition:all .15s ease!important;position:relative!important}',
    /* Active tab dot — a 3px mode-colored bottom bar for visual identity */
    '  .mode-tab.active::after{content:"";position:absolute;bottom:2px;left:20%;right:20%;height:2px;border-radius:2px;background:currentColor;opacity:.35}',
    '  .brand-bar{padding:.35rem 1.5rem!important}',
    /* Hide community + related on desktop — not part of trading dashboard */
    '  .community-section,.community-cta,section.community-section{display:none!important}',
    '  .related-section,.related-articles{display:none!important}',
    '  .article-footer{padding:.5rem 1.5rem!important;font-size:.6rem!important}',
    '}',

    /* ═══════════════════════════════════════════════
       DASHBOARD GRID — 2-column layout inside mode panels
    ═══════════════════════════════════════════════ */
    '@media(min-width:1024px){',
    '  .lp-grid{',
    '    display:grid;',
    '    grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);',
    '    grid-auto-rows:min-content;',
    '    gap:.6rem;',
    '    align-items:stretch;',
    '  }',

    /* Live card — full width hero at top */
    '  .lp-grid>[data-grid="live"]{',
    '    grid-column:1/-1;',
    '    grid-row:1;',
    '  }',

    /* Equity curve — left column, spans 2 rows to balance with signals+orders stack on right */
    '  .lp-grid>[data-grid="equity"]{',
    '    grid-column:1;',
    '    grid-row:2/span 2;',
    '    margin-bottom:0!important;',
    '    display:flex!important;',
    '    flex-direction:column!important;',
    '  }',

    /* Signals — right column, directly under live card */
    '  .lp-grid>[data-grid="signals"]{',
    '    grid-column:2;',
    '    grid-row:2;',
    '    margin-bottom:0!important;',
    '  }',

    /* Orders — right column, under signals (CTA to action) */
    '  .lp-grid>[data-grid="orders"]{',
    '    grid-column:2;',
    '    grid-row:3;',
    '    margin-bottom:0!important;',
    '  }',

    /* Positions — full width row 4 */
    '  .lp-grid>[data-grid="positions"]{',
    '    grid-column:1/-1;',
    '    grid-row:4;',
    '    margin-bottom:0!important;',
    '  }',

    /* History — full width row 5 */
    '  .lp-grid>[data-grid="history"]{grid-column:1/-1;grid-row:5;margin-bottom:0!important}',
    '  .lp-grid>[data-grid="footer"]{grid-column:1/-1}',

    /* Hide empty-state collapsed sections on desktop to reclaim space */
    '  .lp-grid>[data-grid-empty="1"]{display:none!important}',

    /* Hide "How to trade" method card on desktop */
    '  .lp-grid>[data-grid="method"]{display:none!important}',

    /* ── Equity curve panel ── */
    '  .lp-grid>[data-grid="equity"] .perf-hero{',
    '    padding:.9rem 1rem!important;',
    '    gap:.6rem!important;',
    '    flex-direction:column!important;',
    '    margin-bottom:0!important;',
    '    border-radius:10px!important;',
    '    background:#fff!important;',
    '    border:1px solid #e2e8f0!important;',
    '    box-shadow:0 1px 4px rgba(15,23,42,.04)!important;',
    '  }',
    '  .lp-grid>[data-grid="equity"] .perf-chart{flex:1 1 auto!important;min-height:340px!important;height:auto!important;position:relative!important}',
    '  .lp-grid>[data-grid="equity"] .perf-chart-wrap{flex:1 1 auto!important;display:flex!important;flex-direction:column!important;min-height:360px!important}',
    /* Empty chart — zero-trade state: show a subtle "No trades yet" watermark */
    '  .lp-grid>[data-grid="equity"] .perf-chart:empty::after,',
    '  .lp-grid>[data-grid="equity"] .perf-chart[data-empty]::after{',
    '    content:"No closed trades yet";',
    '    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
    '    font-size:.65rem;font-weight:600;color:#cbd5e1;letter-spacing:.04em;text-transform:uppercase;',
    '    pointer-events:none;white-space:nowrap;',
    '  }',
    '  .lp-grid .perf-head{margin-bottom:.3rem!important}',
    '  .lp-grid .perf-head h2{font-size:.82rem!important;font-weight:700!important;color:#0f172a!important}',
    '  .lp-grid .perf-stats{',
    '    grid-template-columns:repeat(3,1fr)!important;',
    '    min-width:0!important;',
    '    gap:.4rem!important;',
    '  }',
    '  .lp-grid .ps{',
    '    padding:.45rem .5rem!important;',
    '    border-radius:7px!important;',
    '    background:#f8fafc!important;',
    '    border:1px solid #e2e8f0!important;',
    '  }',
    '  .lp-grid .ps-v{font-size:.95rem!important;font-weight:800!important;letter-spacing:-.02em!important}',
    '  .lp-grid .ps-l{font-size:.57rem!important;color:#94a3b8!important;font-weight:600!important}',

    /* ── Section cards (signals, orders, positions, history) ── */
    '  .lp-grid .section-card{',
    '    padding:.8rem 1rem!important;',
    '    margin-bottom:0!important;',
    '    border-radius:10px!important;',
    '    background:#fff!important;',
    '    border:1px solid #e2e8f0!important;',
    '    box-shadow:0 1px 4px rgba(15,23,42,.04)!important;',
    '  }',
    '  .lp-grid .cta-card{',
    '    padding:.8rem 1rem!important;',
    '    margin-bottom:0!important;',
    '    border-radius:10px!important;',
    '    background:#fff!important;',
    '    border:1px solid #e2e8f0!important;',
    '    box-shadow:0 1px 4px rgba(15,23,42,.04)!important;',
    '  }',
    '  .lp-grid .sc-head{margin-bottom:.5rem!important}',
    '  .lp-grid .sc-head h3{font-size:.82rem!important;font-weight:700!important;color:#0f172a!important}',

    /* Table in orders/signals */
    '  .lp-grid .t th{',
    '    padding:.3rem .55rem!important;',
    '    font-size:.62rem!important;',
    '    background:#f8fafc!important;',
    '    color:#64748b!important;',
    '    font-weight:700!important;',
    '    letter-spacing:.04em!important;',
    '    text-transform:uppercase!important;',
    '  }',
    '  .lp-grid .t td{padding:.35rem .55rem!important;font-size:.72rem!important}',

    /* Scenario bar */
    '  .lp-grid .scenario-bar-wrap{',
    '    margin-bottom:.5rem!important;',
    '    padding:.5rem .7rem!important;',
    '    border-radius:7px!important;',
    '    background:#f8fafc!important;',
    '    border:1px solid #f1f5f9!important;',
    '  }',

    /* Disclaimer */
    '  .lp-grid .disc{',
    '    margin-top:.4rem!important;',
    '    padding:.5rem .7rem!important;',
    '    font-size:.6rem!important;',
    '    border-radius:8px!important;',
    '    background:#f8fafc!important;',
    '    border:1px solid #f1f5f9!important;',
    '    color:#94a3b8!important;',
    '  }',
    '}',

    /* Time Machine: when viewing a past snapshot, collapse the dashboard grid to a vertical stack
       so the injected tmRender cards (no data-grid) flow in a natural reading order. */
    '.lp-grid.tm-viewing{display:flex!important;flex-direction:column!important;gap:.75rem!important}',
    '.lp-grid.tm-viewing>*{grid-column:unset!important;grid-row:unset!important;margin-bottom:0!important}',
    '.lp-grid.tm-viewing>[data-grid="live"]{display:none!important}',

    /* ═══════════════════════════════════════════════
       LIVE PORTFOLIO CARD — The Hero
       Full-width card at top with prominent P&L
    ═══════════════════════════════════════════════ */
    '.lp-card{',
    '  background:#fff;',
    '  border:1px solid #e2e8f0;',
    '  border-radius:12px;',
    '  overflow:hidden;',
    '  position:relative;',
    '  font-family:"JetBrains Mono",monospace;',
    '  box-shadow:0 2px 8px rgba(15,23,42,.06);',
    '}',
    /* Left accent bar using mode color */
    '.lp-card::before{',
    '  content:"";',
    '  position:absolute;',
    '  top:0;left:0;bottom:0;',
    '  width:4px;',
    '  background:var(--mode-color,#94a3b8);',
    '  border-radius:12px 0 0 12px;',
    '}',

    '.lp-card.lp-init{opacity:.75}',
    '.lp-card.lp-init .lp-strip::after{',
    '  content:"";',
    '  position:absolute;',
    '  bottom:0;left:4px;right:0;',
    '  height:2px;',
    '  background:linear-gradient(90deg,transparent,var(--mode-color,#94a3b8),transparent);',
    '  animation:lp-scan 1.8s ease-in-out infinite;',
    '}',
    '@keyframes lp-scan{0%{opacity:.1}50%{opacity:.8}100%{opacity:.1}}',
    '.lp-card.lp-ready{opacity:1;transition:opacity .3s ease}',

    /* Strip layout — horizontal flex */
    '.lp-strip{',
    '  display:flex;',
    '  align-items:stretch;',
    '  gap:0;',
    '  padding:0 0 0 4px;',
    '  position:relative;',
    '  min-height:56px;',
    '}',

    /* LEFT: status badge */
    '.lp-strip-left{',
    '  display:flex;',
    '  align-items:center;',
    '  gap:.5rem;',
    '  padding:.6rem 1rem;',
    '  border-right:1px solid #f1f5f9;',
    '  white-space:nowrap;',
    '  flex-shrink:0;',
    '  background:#fafbfc;',
    '}',
    '.lp-live-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    '.lp-live-dot.connected{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.2);animation:lp-pulse 2s infinite}',
    '.lp-live-dot.connecting{background:#f59e0b;animation:lp-pulse .8s infinite}',
    '.lp-live-dot.disconnected{background:#ef4444;animation:none}',
    '.lp-live-dot.idle{background:#cbd5e1;animation:none}',
    '@keyframes lp-pulse{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.2)}50%{box-shadow:0 0 0 7px rgba(16,185,129,.05)}}',
    '.lp-label{font-size:.62rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em}',
    '.lp-conn-chip{font-size:.6rem;font-weight:700;padding:.1rem .4rem;border-radius:5px;margin-left:.15rem}',
    '.lp-conn-chip.connected{color:#059669;background:#ecfdf5}',
    '.lp-conn-chip.connecting{color:#d97706;background:#fffbeb}',
    '.lp-conn-chip.disconnected{color:#dc2626;background:#fef2f2}',
    '.lp-conn-chip.idle{color:#94a3b8;background:#f1f5f9}',

    /* CENTER-LEFT: BIG P&L number — this is the hero element */
    '.lp-strip-pnl{',
    '  display:flex;',
    '  flex-direction:column;',
    '  justify-content:center;',
    '  align-items:flex-start;',
    '  padding:.5rem 1.4rem .5rem 1.2rem;',
    '  border-right:1px solid #f1f5f9;',
    '  flex-shrink:0;',
    '  min-width:120px;',
    '}',
    '.lp-pnl{',
    '  font-size:2rem;',
    '  font-weight:800;',
    '  line-height:1;',
    '  letter-spacing:-.04em;',
    '  font-variant-numeric:tabular-nums;',
    '  color:#0f172a;',
    '  transition:color .25s;',
    '}',
    '.lp-pnl.pos{color:#059669}',
    '.lp-pnl.neg{color:#dc2626}',
    '.lp-pnl.flat{color:#94a3b8}',
    '.lp-pnl-sub{font-size:.6rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-top:.25rem}',

    /* Chips row */
    '.lp-strip-chips{display:flex;align-items:center;gap:.5rem;padding:.5rem .9rem;flex-wrap:wrap;flex:1}',
    '.lp-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.65rem;font-weight:700;padding:.18rem .5rem;border-radius:6px;white-space:nowrap}',
    '.lp-chip-pos{background:#f1f5f9;color:#334155}',
    '.lp-chip-alert-crit{background:#fef2f2;color:#dc2626}',
    '.lp-chip-alert-warn{background:#fffbeb;color:#b45309}',

    /* Market status chip */
    '.lp-market-chip{font-size:.58rem;font-weight:700;padding:.1rem .4rem;border-radius:5px;margin-left:.2rem;flex-shrink:0;align-self:center}',
    '.lp-market-chip.open{color:#059669;background:#ecfdf5}',
    '.lp-market-chip.closed{color:#64748b;background:#f1f5f9}',

    /* Loading state inline */
    '.lp-init-inline{display:flex;align-items:center;gap:.4rem;padding:.5rem .9rem;font-size:.62rem;color:#94a3b8;font-weight:600;flex-shrink:0;margin-left:auto}',
    '.lp-init-inline i{animation:lp-spin 1.2s linear infinite;color:var(--mode-color,#94a3b8)}',
    '@keyframes lp-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
    '.lp-card.lp-ready .lp-init-inline{display:none}',

    /* ═══════════════════════════════════════════════
       POSITION ROWS — inside the live card
    ═══════════════════════════════════════════════ */
    '.lp-positions{border-top:1px solid #f1f5f9}',
    '.lp-row-head,.lp-row{display:grid;grid-template-columns:90px 100px 70px 1fr 100px;gap:0;align-items:center}',
    '.lp-row-head{padding:.2rem .9rem .2rem 1.1rem;background:#f8fafc;border-bottom:1px solid #f1f5f9}',
    '.lp-row-head span{font-size:.6rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.07em}',
    '.lp-row-head span:last-child{text-align:right;padding-right:.2rem}',

    '.lp-row{',
    '  padding:.3rem .9rem .3rem 1.1rem;',
    '  border-top:1px solid #f8fafc;',
    '  min-height:44px;',
    '  transition:opacity .3s,background .2s;',
    '}',
    '.lp-row:hover{background:#fafbfc}',
    '.lp-row:first-child{border-top:none}',
    '.lp-row.terminal{opacity:.35;filter:grayscale(.6)}',

    '.lp-ticker{display:flex;flex-direction:column;gap:.06rem;padding-right:.4rem}',
    '.lp-ticker-sym{font-size:.82rem;font-weight:800;color:#0f172a;letter-spacing:.02em;line-height:1}',
    '.lp-ticker-days{font-size:.6rem;color:#94a3b8;font-weight:600}',

    '.lp-price-cell{display:flex;flex-direction:column;gap:.06rem}',
    '.lp-price{',
    '  font-size:.8rem;',
    '  font-weight:700;',
    '  color:#1e293b;',
    '  font-variant-numeric:tabular-nums;',
    '  transition:color .15s;',
    '  line-height:1;',
    '}',
    '.lp-price.flash-up{animation:lp-flash-g .5s ease}',
    '.lp-price.flash-down{animation:lp-flash-r .5s ease}',
    '@keyframes lp-flash-g{0%{color:#059669;background:rgba(5,150,105,.1);border-radius:3px}100%{color:#1e293b;background:transparent}}',
    '@keyframes lp-flash-r{0%{color:#dc2626;background:rgba(220,38,38,.1);border-radius:3px}100%{color:#1e293b;background:transparent}}',
    '.lp-change{font-size:.62rem;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}',
    '.lp-change.pos{color:#059669}',
    '.lp-change.neg{color:#dc2626}',
    '.lp-change.flat{color:#94a3b8}',

    '.lp-pnl-cell{display:flex;align-items:center}',
    '.lp-pnl-val{font-size:.78rem;font-weight:700;font-variant-numeric:tabular-nums}',
    '.lp-pnl-val.pos{color:#059669}',
    '.lp-pnl-val.neg{color:#dc2626}',
    '.lp-pnl-val.flat{color:#94a3b8}',

    /* Gauge — the stop→entry→tp1→tp2 range bar */
    '.lp-gauge-cell{display:flex;flex-direction:column;gap:.28rem;padding:0 .7rem 0 .4rem}',
    '.lp-gauge{',
    '  position:relative;',
    '  height:7px;',
    '  border-radius:4px;',
    '  background:#e2e8f0;',
    '  overflow:visible;',
    '}',
    '.lp-gauge-fill{position:absolute;top:0;left:0;height:100%;border-radius:4px;transition:width .45s ease}',
    '.lp-gauge-cursor{',
    '  position:absolute;',
    '  top:-4px;',
    '  width:3px;',
    '  height:15px;',
    '  border-radius:2px;',
    '  transform:translateX(-50%);',
    '  transition:left .45s ease;',
    '  box-shadow:0 1px 5px rgba(0,0,0,.18),0 0 0 2px #fff;',
    '}',
    '.lp-gauge-labels{',
    '  display:flex;',
    '  justify-content:space-between;',
    '  font-size:.62rem;',
    '  color:#94a3b8;',
    '  font-weight:600;',
    '  font-variant-numeric:tabular-nums;',
    '}',

    '.lp-badge-cell{display:flex;justify-content:flex-end}',
    '.lp-badge{',
    '  display:inline-flex;',
    '  align-items:center;',
    '  gap:.2rem;',
    '  font-size:.6rem;',
    '  font-weight:700;',
    '  padding:.15rem .45rem;',
    '  border-radius:5px;',
    '  white-space:nowrap;',
    '  letter-spacing:.02em;',
    '}',
    '.lp-badge i{font-size:.52rem}',

    /* Empty state */
    '.lp-empty{',
    '  display:flex;',
    '  align-items:center;',
    '  gap:.55rem;',
    '  padding:.65rem .9rem .65rem 1.1rem;',
    '  color:#94a3b8;',
    '  font-size:.65rem;',
    '  font-weight:500;',
    '  border-top:1px solid #f1f5f9;',
    '  font-style:italic;',
    '  letter-spacing:.01em;',
    '}',
    '.lp-empty i{font-size:.78rem;opacity:.35;flex-shrink:0}',

    /* ═══════════════════════════════════════════════
       TOASTS
    ═══════════════════════════════════════════════ */
    '.lp-toast-wrap{position:fixed;top:4.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none}',
    '.lp-toast{',
    '  display:flex;',
    '  align-items:flex-start;',
    '  gap:.55rem;',
    '  padding:.6rem .9rem;',
    '  border-radius:10px;',
    '  font-size:.72rem;',
    '  font-weight:600;',
    '  box-shadow:0 6px 20px rgba(15,23,42,.12);',
    '  pointer-events:auto;',
    '  border:1px solid #e2e8f0;',
    '  background:#fff;',
    '  animation:lp-toast-in .25s ease forwards,lp-toast-out .25s ease 4.7s forwards;',
    '  opacity:0;',
    '  font-family:"JetBrains Mono",monospace;',
    '  min-width:220px;',
    '}',
    '.lp-toast i{font-size:.85rem;flex-shrink:0;margin-top:.05rem}',
    '.lp-toast-detail{font-size:.6rem;opacity:.55;margin-top:.12rem;font-weight:500}',
    '@keyframes lp-toast-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes lp-toast-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(20px)}}',

    /* ═══════════════════════════════════════════════
       MOBILE — stacked, compact but readable
    ═══════════════════════════════════════════════ */
    '@media(max-width:600px){',
    '  .lp-strip{flex-wrap:wrap;min-height:auto}',
    '  .lp-strip-left{border-right:none;border-bottom:1px solid #f1f5f9;width:100%;padding:.45rem .75rem}',
    '  .lp-strip-pnl{border-right:none;padding:.45rem .75rem .3rem;min-width:auto}',
    '  .lp-pnl{font-size:1.5rem}',
    '  .lp-init-inline{margin-left:0;padding:.25rem .75rem .35rem}',
    '  .lp-row,.lp-row-head{grid-template-columns:64px 80px 58px 1fr 76px}',
    '  .lp-row{padding:.22rem .5rem;min-height:36px}',
    '  .lp-row-head{padding:.18rem .5rem}',
    '  .lp-ticker-sym{font-size:.72rem}',
    '  .lp-price{font-size:.7rem}',
    '  .lp-change{font-size:.55rem}',
    '  .lp-pnl-val{font-size:.67rem}',
    '  .lp-gauge{height:6px}',
    '  .lp-gauge-labels{font-size:.55rem}',
    '  .lp-badge{font-size:.55rem;padding:.1rem .28rem}',
    '  .lp-toast-wrap{right:.65rem;left:.65rem}',
    '  .lp-toast{min-width:auto}',
    /* Stack the grid tightly — no desktop layout applies, but tighten gaps */
    '  .lp-grid{display:flex!important;flex-direction:column!important;gap:.6rem!important}',
    '  .lp-grid>*{margin-bottom:0!important}',
    /* Hide empty sections + method card on mobile — reclaim vertical space */
    '  .lp-grid>[data-grid-empty="1"]{display:none!important}',
    '  .lp-grid>[data-grid="method"]{display:none!important}',
    /* Compact equity chart on mobile — enough to read the curve */
    '  .lp-grid>[data-grid="equity"] .perf-hero{padding:.7rem .8rem!important;gap:.5rem!important}',
    '  .lp-grid>[data-grid="equity"] .perf-chart{min-height:200px!important}',
    '  .lp-grid .perf-stats{grid-template-columns:repeat(3,1fr)!important;gap:.35rem!important}',
    '  .lp-grid .ps{padding:.35rem .4rem!important}',
    '  .lp-grid .ps-v{font-size:.8rem!important;font-weight:800!important}',
    '  .lp-grid .ps-l{font-size:.52rem!important}',
    /* Tables: wrap in an overflow-x container so columns stay aligned and horizontally scroll */
    '  .lp-grid .section-card details[open]>table.t,.lp-grid .section-card>table.t{display:block;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap}',
    '  .lp-grid .section-card table.t th,.lp-grid .section-card table.t td{font-size:.66rem!important;padding:.3rem .45rem!important;white-space:nowrap}',
    /* Live strip: tighten the UNREALIZED P&L label */
    '  .lp-strip-pnl .lp-pnl-label{font-size:.52rem!important;letter-spacing:.03em!important}',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  // Double-boot guard
  if (document.querySelector('.lp-toast-wrap')) return;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function fmt(n, d) { return n != null ? n.toFixed(d == null ? 2 : d) : '—'; }
  function sign(n) { return n > 0 ? '+' : ''; }

  var MAX_TOASTS = 3;
  var cards = {};
  var connState = 'idle';

  /* ── Reorganize panel children into a CSS grid wrapper ── */
  function reorganizePanel(modeId) {
    var panel = document.getElementById('p-' + modeId);
    if (!panel || panel.querySelector('.lp-grid')) return;

    var grid = document.createElement('div');
    grid.className = 'lp-grid';

    // Collect all children, tag them, move into grid wrapper
    var children = Array.prototype.slice.call(panel.children);
    children.forEach(function (child) {
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
        child.setAttribute('data-grid', 'orders');
      } else if (child.getAttribute('data-static') === '1') {
        child.setAttribute('data-grid', 'method');
      } else if (child.classList.contains('section-card')) {
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
      } else {
        child.setAttribute('data-grid', 'footer');
      }

      grid.appendChild(child);
    });

    panel.appendChild(grid);

    // Collapse empty Positions / History sections on desktop so the grid reclaims space
    setTimeout(function () {
      var empties = grid.querySelectorAll('[data-grid="positions"], [data-grid="history"]');
      empties.forEach(function (node) {
        var hasRows = node.querySelector('tbody tr, .setup-card, .lp-row');
        var hasMeaningfulText = false;
        var txt = (node.textContent || '').toLowerCase();
        if (hasRows) hasMeaningfulText = true;
        else if (txt.indexOf('no active') < 0 && txt.indexOf('0 closed') < 0 && txt.length > 60) hasMeaningfulText = true;
        if (!hasMeaningfulText) node.setAttribute('data-grid-empty', '1');
      });
    }, 50);
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
        '<span class="lp-market-chip closed" id="lp-mkt-' + modeId + '"><i class="fas fa-moon"></i> Closed</span>' +
        '<div class="lp-strip-pnl">' +
          '<span class="lp-pnl flat" id="lp-pnl-' + modeId + '">—</span>' +
          '<span class="lp-pnl-sub"><span id="lp-pnl-abs-' + modeId + '">Unrealized P&amp;L</span></span>' +
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
      var t = esc(pos.ticker);
      html +=
        '<div class="lp-row" id="lp-r-' + modeId + '-' + t + '" data-ticker="' + t + '">' +
          '<div class="lp-ticker">' +
            '<span class="lp-ticker-sym">' + t + '</span>' +
            '<span class="lp-ticker-days" id="lp-days-' + modeId + '-' + t + '">—</span>' +
          '</div>' +
          '<div class="lp-price-cell">' +
            '<span class="lp-price" id="lp-px-' + modeId + '-' + t + '">$' + fmt(pos.entry) + '</span>' +
            '<span class="lp-change flat" id="lp-chg-' + modeId + '-' + t + '">—</span>' +
          '</div>' +
          '<div class="lp-pnl-cell">' +
            '<span class="lp-pnl-val flat" id="lp-pv-' + modeId + '-' + t + '">0.00%</span>' +
          '</div>' +
          '<div class="lp-gauge-cell">' +
            buildGaugeHTML(modeId, pos) +
          '</div>' +
          '<div class="lp-badge-cell">' +
            '<span class="lp-badge" id="lp-bg-' + modeId + '-' + t + '" style="background:#f1f5f9;color:#94a3b8"><i class="fas fa-circle"></i> Open</span>' +
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
      var dir = r.direction;
      if (dir === 'up' || dir === 'down') {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (dir === 'up') pxEl.classList.add('flash-up');
            else pxEl.classList.add('flash-down');
          });
        });
      }
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
    var marketOpen = LE.isMarketOpen();
    Object.keys(cards).forEach(function (modeId) {
      var dot = document.getElementById('lp-dot-' + modeId);
      var chip = document.getElementById('lp-conn-' + modeId);
      if (dot) dot.className = 'lp-live-dot ' + (marketOpen ? state : 'idle');
      if (chip) {
        var labels = marketOpen
          ? { connected: 'Live', connecting: 'Connecting...', disconnected: 'Reconnecting...', idle: 'Idle' }
          : { connected: 'Snapshot', connecting: 'Snapshot', disconnected: 'Snapshot', idle: 'Snapshot' };
        chip.textContent = labels[state] || state;
        chip.className = 'lp-conn-chip ' + (marketOpen ? state : 'idle');
      }
      var mkt = document.getElementById('lp-mkt-' + modeId);
      if (mkt) {
        if (marketOpen) {
          mkt.className = 'lp-market-chip open';
          mkt.innerHTML = '<i class="fas fa-circle"></i> Market Open';
        } else {
          mkt.className = 'lp-market-chip closed';
          mkt.innerHTML = '<i class="fas fa-moon"></i> Market Closed';
        }
      }
      // Mark ready as soon as we have a verdict: connected OR market is closed (no live data expected).
      if (state === 'connected' || !marketOpen) markReady(modeId);
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
      var absEl = document.getElementById('lp-pnl-abs-' + modeId);
      if (absEl) {
        var cap = NOMINAL_CAPITAL[modeId] || 10000;
        var dollars = cap * (a.totalPnl / 100);
        if (a.count > 0) {
          absEl.textContent = (dollars >= 0 ? '+$' : '-$') + fmt(Math.abs(dollars), 0) + ' on $' + fmt(cap, 0) + ' nominal';
        } else {
          absEl.textContent = 'Unrealized P&L';
        }
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
    var now = Date.now();
    var isCritical = ['SL_HIT', 'TP2_HIT'].indexOf(status) >= 0;
    var dedupMs = isCritical ? 60000 : 300000;
    if (lastToastTs[key] && now - lastToastTs[key] < dedupMs) return;
    lastToastTs[key] = now;

    // Prune stale dedup entries
    var keys = Object.keys(lastToastTs);
    if (keys.length > 30) {
      keys.forEach(function (k) { if (now - lastToastTs[k] > 300000) delete lastToastTs[k]; });
    }

    // Cap visible toasts
    var existing = toastContainer.children;
    while (existing.length >= MAX_TOASTS) {
      toastContainer.removeChild(existing[0]);
    }

    var si = LE.getStatusInfo(status);
    var toast = el('div', 'lp-toast');
    toast.setAttribute('role', 'alert');
    toast.style.borderLeftColor = si.color;
    toast.style.borderLeftWidth = '3px';
    toast.innerHTML =
      '<i class="fas ' + esc(si.icon) + '" style="color:' + esc(si.color) + '"></i>' +
      '<div style="color:#0f172a"><b>' + esc(evalResult.ticker) + '</b> — ' + esc(si.label) +
        '<div class="lp-toast-detail" style="color:#64748b">' + esc(evalResult.statusDetail) + '</div>' +
      '</div>';
    toastContainer.appendChild(toast);

    toast.addEventListener('animationend', function (e) {
      if (e.animationName === 'lp-toast-out' && toast.parentNode) toast.parentNode.removeChild(toast);
    });
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5500);
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
    toastContainer.setAttribute('role', 'log');
    toastContainer.setAttribute('aria-live', 'assertive');
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

          // Resize ECharts after grid layout change + flag empty charts for watermark
          setTimeout(function () {
            document.querySelectorAll('.perf-chart').forEach(function (chartEl) {
              var chart = window.echarts && window.echarts.getInstanceByDom(chartEl);
              if (chart) chart.resize();
              // Detect zero-trade equity charts: look at the adjacent perf-stats for "0 Closed Trades"
              var hero = chartEl.closest('.perf-hero');
              if (hero) {
                var statsTxt = (hero.querySelector('.perf-stats') || {}).textContent || '';
                if (/\b0\s*closed/i.test(statsTxt)) {
                  chartEl.setAttribute('data-empty', '1');
                  if (chart) chart.getDom().style.opacity = '0';
                }
              }
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

          // If market is already known closed at boot, update chrome immediately —
          // no spinning forever while waiting for a live feed that won't arrive.
          if (!LE.isMarketOpen()) {
            updateConn(connState || 'idle');
          }

          // Safety: if after 7s we're still not ready, stop spinning and show a soft fallback.
          setTimeout(function () {
            Object.keys(cards).forEach(function (modeId) {
              var card = document.getElementById('lp-' + modeId);
              if (card && card.classList.contains('lp-init')) {
                markReady(modeId);
                var chip = document.getElementById('lp-conn-' + modeId);
                if (chip && chip.textContent === 'Connecting...') {
                  chip.textContent = 'Offline';
                  chip.className = 'lp-conn-chip disconnected';
                }
              }
            });
          }, 7000);
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
