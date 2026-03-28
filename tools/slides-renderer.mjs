/**
 * slides-renderer.mjs  v2 — LIGHT THEME
 * Renders edu-data slides to 1280×720 PNGs using puppeteer + inline HTML.
 * Design: Bloomberg meets Robinhood — white, clean, data-rich, emotional.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROMIUM = '/snap/bin/chromium';

// ── Light theme palette ────────────────────────────────────────────────────────
const T = {
  bg:           '#FFFFFF',
  bgCard:       '#F8FAFC',
  bgCardAlt:    '#F1F5F9',
  border:       '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Brand
  primary:      '#2563EB',    // Confident blue
  primaryLight: '#EFF6FF',
  primaryMid:   '#BFDBFE',

  // Semantic colors
  bull:         '#059669',    // Green — gains, bullish
  bullLight:    '#ECFDF5',
  bullMid:      '#6EE7B7',

  bear:         '#DC2626',    // Red — losses, bearish
  bearLight:    '#FEF2F2',
  bearMid:      '#FECACA',

  warning:      '#D97706',    // Amber — caution
  warningLight: '#FFFBEB',

  purple:       '#7C3AED',    // Purple — analysis, insight
  purpleLight:  '#F5F3FF',

  // Text
  text:         '#0F172A',    // Near black
  textSub:      '#334155',
  textMuted:    '#64748B',
  textFaint:    '#94A3B8',
  textOnDark:   '#FFFFFF',

  // Gradients
  gradHero:     'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #0891b2 100%)',
  gradBull:     'linear-gradient(135deg, #065f46 0%, #059669 100%)',
  gradBear:     'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
  gradPurple:   'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',

  font:         "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontMono:     "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

// ── Base CSS ───────────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px; height: 720px; overflow: hidden;
    background: ${T.bg};
    color: ${T.text};
    font-family: ${T.font};
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Slide container ── */
  .slide {
    width: 1280px; height: 720px;
    position: relative; overflow: hidden;
    display: flex; flex-direction: column;
  }

  /* ── Top accent bar ── */
  .brand-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 5px;
    background: ${T.gradHero};
    z-index: 10;
  }

  /* ── Footer ── */
  .footer {
    position: absolute; bottom: 0; left: 0; right: 0; height: 44px;
    background: ${T.bgCard};
    border-top: 1px solid ${T.border};
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px;
    font-size: 12px; color: ${T.textFaint};
    z-index: 10;
  }
  .footer .brand {
    color: ${T.primary}; font-weight: 800;
    letter-spacing: 2px; font-size: 11px; text-transform: uppercase;
  }
  .footer .slide-num {
    background: ${T.primary}; color: white;
    padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;
  }

  /* ── Content area ── */
  .content {
    flex: 1; display: flex; flex-direction: column;
    padding: 28px 44px 56px;
    margin-top: 5px;
  }

  /* ── Section label ── */
  .section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 2.5px;
    color: ${T.primary}; text-transform: uppercase; margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .section-label::before {
    content: ''; display: block;
    width: 14px; height: 3px;
    background: ${T.primary}; border-radius: 2px;
  }

  /* ── Slide title ── */
  .slide-title {
    font-size: 26px; font-weight: 800; color: ${T.text};
    margin-bottom: 20px; line-height: 1.2;
    letter-spacing: -0.3px;
  }

  /* ── Cards ── */
  .card {
    background: ${T.bgCard};
    border: 1px solid ${T.border};
    border-radius: 12px; padding: 16px 20px;
  }
  .card-elevated {
    background: ${T.bg};
    border: 1px solid ${T.border};
    border-radius: 14px; padding: 20px 24px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  }
`;

// ── Helper ─────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function trendColor(trend) {
  if (!trend) return T.textMuted;
  const t = String(trend).toLowerCase();
  if (t === 'up' || t === 'positive' || t === 'bull' || t === 'bullish') return T.bull;
  if (t === 'down' || t === 'negative' || t === 'bear' || t === 'bearish') return T.bear;
  if (t === 'warning' || t === 'caution') return T.warning;
  return T.textMuted;
}

function trendArrow(trend) {
  const t = String(trend || '').toLowerCase();
  if (t === 'up' || t === 'positive' || t === 'bull' || t === 'bullish') return '▲';
  if (t === 'down' || t === 'negative' || t === 'bear' || t === 'bearish') return '▼';
  return '';
}

function trendBg(trend) {
  const t = String(trend || '').toLowerCase();
  if (t === 'up' || t === 'positive' || t === 'bull' || t === 'bullish') return T.bullLight;
  if (t === 'down' || t === 'negative' || t === 'bear' || t === 'bearish') return T.bearLight;
  return T.bgCardAlt;
}

function impactColor(impact) {
  const i = String(impact || '').toLowerCase();
  if (i === 'high' || i === 'critical') return T.bear;
  if (i === 'medium' || i === 'moderate') return T.warning;
  if (i === 'low' || i === 'positive') return T.bull;
  return T.textMuted;
}

// ── Slide renderers ────────────────────────────────────────────────────────────

function renderChapterIntro(slide, idx, total, config) {
  const ch = slide.chapter || {};
  const part = ch.partNumber || 1;
  const totalParts = ch.totalParts || total;
  const dots = Array.from({ length: totalParts }, (_, i) => {
    const active = i + 1 === part;
    return `<div style="width:${active?28:8}px;height:8px;border-radius:4px;background:${active?'white':'rgba(255,255,255,0.35)'};transition:all 0.3s"></div>`;
  }).join('');

  const icon = slide.icon || '📊';

  return `
    <div class="slide" style="background:${T.gradHero};color:white;justify-content:center;align-items:center;text-align:center">
      <!-- Background grid pattern -->
      <div style="position:absolute;inset:0;opacity:0.04;background-image:linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px);background-size:48px 48px"></div>

      <!-- Content -->
      <div style="position:relative;z-index:2;padding:60px">
        <div style="font-size:52px;margin-bottom:20px">${icon}</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:4px;color:rgba(255,255,255,0.65);text-transform:uppercase;margin-bottom:14px">
          MARKET WATCH — PART ${part} OF ${totalParts}
        </div>
        <h1 style="font-size:56px;font-weight:900;line-height:1.05;letter-spacing:-1px;max-width:900px;margin:0 auto 16px;color:white">${esc(ch.title || config.seriesTitle)}</h1>
        <p style="font-size:22px;color:rgba(255,255,255,0.75);max-width:640px;margin:0 auto 32px;line-height:1.4">${esc(ch.subtitle || config.date || '')}</p>
        <!-- Progress dots -->
        <div style="display:flex;gap:8px;justify-content:center">${dots}</div>
      </div>

      <div class="footer" style="background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.1)">
        <span class="brand" style="color:rgba(255,255,255,0.9)">MARKET WATCH</span>
        <span style="color:rgba(255,255,255,0.55)">${esc(config.seriesTitle)}</span>
        <span class="slide-num" style="background:rgba(255,255,255,0.2)">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderMetricRow(slide, idx, total, config) {
  const metrics = (slide.metrics || []).slice(0, 6);
  const mainMetrics = metrics.slice(0, 4);
  const hasSecondary = metrics.length > 4;

  const bigCards = mainMetrics.map(m => {
    const color = trendColor(m.trend);
    const arrow = trendArrow(m.trend);
    const bg = trendBg(m.trend);
    const border = m.trend === 'up' ? T.bull : m.trend === 'down' ? T.bear : T.border;
    return `
      <div style="flex:1;background:${bg};border:2px solid ${border};border-radius:16px;padding:20px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color}"></div>
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:${T.textMuted};text-transform:uppercase;margin-bottom:8px">${esc(m.label)}</div>
        <div style="font-size:36px;font-weight:900;color:${T.text};line-height:1;margin-bottom:6px;letter-spacing:-1px">${esc(m.value)}</div>
        ${m.delta ? `<div style="font-size:15px;color:${color};font-weight:700">${arrow} ${esc(m.delta)}</div>` : ''}
        ${m.context ? `<div style="font-size:12px;color:${T.textMuted};margin-top:6px;line-height:1.3">${esc(m.context)}</div>` : ''}
      </div>`;
  }).join('');

  const secondaryCards = hasSecondary ? metrics.slice(4).map(m => {
    const color = trendColor(m.trend);
    return `
      <div style="flex:1;background:${T.bgCard};border:1px solid ${T.border};border-radius:10px;padding:12px 16px">
        <div style="font-size:10px;color:${T.textFaint};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${esc(m.label)}</div>
        <div style="font-size:22px;font-weight:800;color:${T.text}">${esc(m.value)}</div>
        ${m.delta ? `<div style="font-size:12px;color:${color};font-weight:600">${trendArrow(m.trend)} ${esc(m.delta)}</div>` : ''}
      </div>`;
  }).join('') : '';

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Market Snapshot</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;gap:14px;flex:1">${bigCards}</div>
        ${hasSecondary ? `<div style="display:flex;gap:12px;margin-top:12px">${secondaryCards}</div>` : ''}
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderPerformance(slide, idx, total, config) {
  const tickers = (slide.tickers || []).slice(0, 7);

  // Split: big winner + big loser shown prominently, rest in a list
  const sorted = [...tickers].sort((a, b) => (b.perf || 0) - (a.perf || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const rest = tickers.filter(t => t !== best && t !== worst);

  function heroCard(t, isBull) {
    const color = isBull ? T.bull : T.bear;
    const bg = isBull ? T.bullLight : T.bearLight;
    const arrow = isBull ? '▲' : '▼';
    const perf = typeof t.perf === 'number' ? Math.abs(t.perf).toFixed(1) + '%' : t.perf;
    return `
      <div style="background:${bg};border:2px solid ${color}40;border-radius:16px;padding:20px 22px;flex:1">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${color};text-transform:uppercase;margin-bottom:8px">${isBull ? '🏆 TOP GAINER' : '📉 TOP LOSER'}</div>
        <div style="font-size:32px;font-weight:900;color:${T.text};margin-bottom:4px">${esc(t.symbol)}</div>
        <div style="font-size:13px;color:${T.textMuted};margin-bottom:10px">${esc(t.name || '')}</div>
        <div style="font-size:38px;font-weight:900;color:${color}">${arrow} ${perf}</div>
        ${t.note ? `<div style="font-size:13px;color:${T.textSub};margin-top:8px;line-height:1.3">${esc(t.note)}</div>` : ''}
      </div>`;
  }

  const rows = rest.slice(0, 5).map(t => {
    const isUp = (t.perf || 0) >= 0;
    const color = isUp ? T.bull : T.bear;
    const arrow = isUp ? '▲' : '▼';
    const perf = typeof t.perf === 'number' ? Math.abs(t.perf).toFixed(1) + '%' : t.perf;
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:9px 14px;background:${T.bgCard};border-radius:10px;border:1px solid ${T.border}">
        <div style="font-size:16px;font-weight:800;color:${T.text};min-width:60px">${esc(t.symbol)}</div>
        <div style="flex:1;font-size:13px;color:${T.textMuted}">${esc(t.name || '')}</div>
        <div style="font-size:16px;font-weight:700;color:${color}">${arrow} ${perf}</div>
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content" style="flex-direction:row;gap:20px">
        <div style="display:flex;flex-direction:column;gap:12px;width:240px">
          ${best ? heroCard(best, true) : ''}
          ${worst ? heroCard(worst, false) : ''}
        </div>
        <div style="flex:1;display:flex;flex-direction:column">
          <div class="section-label">Performance</div>
          <div class="slide-title">${esc(slide.title)}</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">${rows}</div>
        </div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderEventTimeline(slide, idx, total, config) {
  const events = (slide.events || []).slice(0, 6);

  const items = events.map((e, i) => {
    const color = impactColor(e.impact);
    const isLast = i === events.length - 1;
    return `
      <div style="display:flex;gap:16px;position:relative">
        <!-- Timeline line -->
        ${!isLast ? `<div style="position:absolute;left:15px;top:28px;width:2px;bottom:-8px;background:linear-gradient(${color},${T.border})"></div>` : ''}
        <!-- Dot -->
        <div style="width:30px;height:30px;border-radius:50%;background:${color}20;border:2px solid ${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:4px">
          <div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>
        </div>
        <!-- Content -->
        <div style="flex:1;padding-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="font-size:12px;font-weight:700;color:${T.primary};font-family:${T.fontMono}">${esc(e.time || '')}</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:2px 8px;border-radius:4px;background:${color}15;color:${color}">${esc(e.impact || '')}</span>
          </div>
          <div style="font-size:16px;font-weight:700;color:${T.text};margin-bottom:3px">${esc(e.title)}</div>
          ${e.desc ? `<div style="font-size:13px;color:${T.textMuted};line-height:1.4">${esc(e.desc)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content" style="flex-direction:row;gap:32px">
        <div style="flex:1">
          <div class="section-label">Timeline</div>
          <div class="slide-title">${esc(slide.title)}</div>
        </div>
        <div style="flex:2;overflow:hidden">${items}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderHighlight(slide, idx, total, config) {
  const icon = slide.icon || '💡';
  const sentiment = slide.sentiment || 'neutral'; // bull, bear, warning, insight
  let accentColor = T.primary;
  let bg = T.primaryLight;
  if (sentiment === 'bull' || sentiment === 'bullish') { accentColor = T.bull; bg = T.bullLight; }
  if (sentiment === 'bear' || sentiment === 'bearish') { accentColor = T.bear; bg = T.bearLight; }
  if (sentiment === 'warning') { accentColor = T.warning; bg = T.warningLight; }
  if (sentiment === 'insight') { accentColor = T.purple; bg = T.purpleLight; }

  return `
    <div class="slide" style="justify-content:center;align-items:center">
      <div class="brand-bar"></div>

      <!-- Background accent blob -->
      <div style="position:absolute;top:-100px;right:-100px;width:500px;height:500px;border-radius:50%;background:${accentColor};opacity:0.05"></div>

      <div style="max-width:820px;width:100%;padding:0 60px;text-align:center;position:relative;z-index:2">
        <!-- Icon bubble -->
        <div style="width:88px;height:88px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;margin:0 auto 28px;font-size:40px;box-shadow:0 8px 32px ${accentColor}40">
          ${icon}
        </div>

        <!-- Title -->
        <h2 style="font-size:38px;font-weight:900;color:${T.text};margin-bottom:20px;line-height:1.15;letter-spacing:-0.5px">${esc(slide.title)}</h2>

        <!-- Divider -->
        <div style="width:64px;height:4px;background:${accentColor};border-radius:2px;margin:0 auto 24px"></div>

        <!-- Text -->
        <p style="font-size:22px;color:${T.textSub};line-height:1.55;font-weight:400">${esc(slide.text || '')}</p>

        ${slide.subtext ? `<p style="font-size:15px;color:${T.textMuted};margin-top:16px;line-height:1.5">${esc(slide.subtext)}</p>` : ''}
      </div>

      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderChartImage(slide, idx, total, config) {
  const levels = slide.levels || [];
  const ticker = (slide.title.match(/^([A-Z]{1,5})/) || [])[1] || '';
  const signalType = slide.signalType || '';
  const sentiment = (signalType || '').toLowerCase().includes('buy') || (signalType || '').toLowerCase().includes('bull') ? 'bull' : 'bear';
  const sentimentColor = sentiment === 'bull' ? T.bull : T.bear;

  const levelRows = levels.map(l => {
    const colorMap = {
      tp2: T.bull, tp1: '#22c55e', entry: T.primary,
      stop: T.bear, rr: T.purple, horizon: '#0891b2',
    };
    const color = colorMap[l.type] || T.textMuted;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-left:4px solid ${color};background:${color}08;border-radius:0 8px 8px 0;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;color:${T.textMuted};text-transform:uppercase;letter-spacing:1px">${esc(l.label)}</div>
          ${l.note ? `<div style="font-size:12px;color:${T.textFaint};margin-top:2px">${esc(l.note)}</div>` : ''}
        </div>
        <div style="font-size:22px;font-weight:800;color:${color};font-family:${T.fontMono}">${esc(l.value)}</div>
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content" style="flex-direction:row;gap:24px">

        <!-- Left: levels + context -->
        <div style="flex:1;display:flex;flex-direction:column">
          <div class="section-label">Technical Setup</div>
          <div class="slide-title">${esc(slide.title)}</div>
          ${slide.caption ? `<div style="font-size:14px;color:${T.textMuted};margin-bottom:16px;line-height:1.4">${esc(slide.caption)}</div>` : ''}
          <div style="flex:1">${levelRows || `<div style="color:${T.textMuted};font-size:15px">See full chart at articles.market-watch.xyz</div>`}</div>
        </div>

        <!-- Right: signal badge + finviz link -->
        <div style="width:260px;display:flex;flex-direction:column;gap:14px">
          ${ticker ? `
          <div style="background:${T.text};color:white;border-radius:14px;padding:22px 24px;text-align:center">
            <div style="font-size:36px;font-weight:900;letter-spacing:-1px;margin-bottom:4px">${esc(ticker)}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:1px;text-transform:uppercase">Ticker</div>
          </div>` : ''}
          ${signalType ? `
          <div style="background:${sentimentColor};color:white;border-radius:14px;padding:18px 24px;text-align:center">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;opacity:0.8;margin-bottom:6px;text-transform:uppercase">Signal</div>
            <div style="font-size:22px;font-weight:800">${esc(signalType)}</div>
          </div>` : ''}
          <div style="background:${T.bgCard};border:1px solid ${T.border};border-radius:14px;padding:16px;text-align:center">
            <div style="font-size:11px;color:${T.textFaint};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Chart</div>
            <div style="font-size:13px;font-weight:600;color:${T.primary}">finviz.com</div>
          </div>
        </div>

      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderTradeLevels(slide, idx, total, config) {
  const colorMap = {
    tp2: '#16a34a', tp1: '#22c55e', entry: T.primary,
    stop: T.bear, rr: T.purple, horizon: '#0891b2',
  };
  const levels = slide.levels || [];

  // 2-column layout for trade levels
  const items = levels.map(l => {
    const color = colorMap[l.type] || T.textMuted;
    const bg = color + '10';
    return `
      <div style="background:${bg};border:2px solid ${color}30;border-radius:14px;padding:18px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color}"></div>
        <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">${esc(l.label)}</div>
        <div style="font-size:32px;font-weight:900;color:${T.text};font-family:${T.fontMono};letter-spacing:-0.5px">${esc(l.value)}</div>
        ${l.note ? `<div style="font-size:12px;color:${T.textMuted};margin-top:6px">${esc(l.note)}</div>` : ''}
      </div>`;
  }).join('');

  const cols = levels.length <= 3 ? levels.length : Math.ceil(levels.length / 2);

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Trade Setup</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;flex:1;align-content:start">${items}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderBullets(slide, idx, total, config) {
  const items = (slide.items || []).slice(0, 6);
  const accents = [T.primary, T.bull, T.bear, T.purple, T.warning, '#0891b2'];

  const bullets = items.map((item, i) => {
    const color = accents[i % accents.length];
    return `
      <div style="display:flex;align-items:flex-start;gap:14px;padding:13px 18px;background:${T.bgCard};border-radius:12px;border:1px solid ${T.border};border-left:4px solid ${color}">
        <div style="width:24px;height:24px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;margin-top:1px">${i+1}</div>
        <div style="font-size:16px;color:${T.text};line-height:1.45;padding-top:1px">${esc(item)}</div>
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Key Points</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;flex:1">${bullets}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderSummary(slide, idx, total, config) {
  const items = (slide.items || []).slice(0, 5);

  const bullets = items.map((item, i) => `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 18px;background:${T.bgCard};border-radius:12px;border:1px solid ${T.border}">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${T.primary},${T.bull});color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0">✓</div>
      <div style="font-size:16px;color:${T.text};line-height:1.45;padding-top:5px">${esc(item)}</div>
    </div>`).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content" style="flex-direction:row;gap:32px">
        <!-- Left side title -->
        <div style="width:260px;display:flex;flex-direction:column;justify-content:center">
          <div style="width:56px;height:56px;border-radius:50%;background:${T.primary};color:white;font-size:26px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">💡</div>
          <div style="font-size:28px;font-weight:900;color:${T.text};line-height:1.2;margin-bottom:12px">${esc(slide.title)}</div>
          <div style="font-size:13px;color:${T.textMuted};line-height:1.5">Key takeaways from today's analysis</div>
        </div>
        <!-- Right side bullets -->
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;justify-content:center">
          ${bullets}
        </div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderOutro(slide, idx, total, config) {
  return `
    <div class="slide" style="background:${T.gradHero};color:white;justify-content:center;align-items:center;text-align:center">
      <div style="position:absolute;inset:0;opacity:0.04;background-image:radial-gradient(circle,rgba(255,255,255,1) 1px,transparent 1px);background-size:32px 32px"></div>

      <div style="position:relative;z-index:2;padding:60px">
        <div style="font-size:52px;margin-bottom:24px">📊</div>
        <h2 style="font-size:44px;font-weight:900;color:white;margin-bottom:14px;letter-spacing:-0.5px">Stay Ahead of the Market</h2>
        <p style="font-size:20px;color:rgba(255,255,255,0.7);max-width:600px;margin:0 auto 36px;line-height:1.5">Daily briefings, stock analysis, and scanner signals — all free.</p>

        <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap">
          <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:14px 28px;font-size:16px;font-weight:700">
            🌐 articles.market-watch.xyz
          </div>
          <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:14px 28px;font-size:16px;font-weight:700">
            📱 @MarketWatchXYZ
          </div>
        </div>
      </div>

      <div class="footer" style="background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.1)">
        <span class="brand" style="color:rgba(255,255,255,0.9)">MARKET WATCH</span>
        <span style="color:rgba(255,255,255,0.55)">${esc(config.seriesTitle)}</span>
        <span class="slide-num" style="background:rgba(255,255,255,0.2)">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderDefault(slide, idx, total, config) {
  const items = slide.items || (slide.text ? [slide.text] : []);
  const bullets = items.slice(0, 5).map((item, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:${T.bgCard};border-radius:10px;border:1px solid ${T.border}">
      <div style="color:${T.primary};font-weight:800;flex-shrink:0;font-size:18px">▸</div>
      <div style="font-size:16px;color:${T.text};line-height:1.4">${esc(item)}</div>
    </div>`).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Analysis</div>
        <div class="slide-title">${esc(slide.title || '')}</div>
        ${bullets || `<p style="font-size:18px;color:${T.textMuted}">${esc(slide.narration || '')}</p>`}
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span style="color:${T.textFaint}">${esc(config.seriesTitle)}</span>
        <span class="slide-num">${idx+1} / ${total}</span>
      </div>
    </div>`;
}

// ── Scanner slide renderers (light theme) ─────────────────────────────────────
const S = {
  bg:      '#f8f9fa',
  bgCard:  '#ffffff',
  border:  '#e2e8f0',
  text:    '#0f172a',
  textSub: '#64748b',
  orange:  '#d97706',
  green:   '#16a34a',
  red:     '#dc2626',
  blue:    '#2563eb',
  purple:  '#7c3aed',
  cyan:    '#0891b2',
};

function scannerFooter(idx, total, config) {
  return `
    <div style="position:absolute;bottom:0;left:0;right:0;height:44px;background:${S.bgCard};border-top:1px solid ${S.border};display:flex;align-items:center;justify-content:space-between;padding:0 40px;font-size:12px;color:${S.textSub};z-index:10">
      <span style="color:${S.orange};font-weight:800;letter-spacing:2px;font-size:11px;text-transform:uppercase">MARKET WATCH SCANNER</span>
      <span style="color:${S.textSub}">${esc(config.seriesTitle || config.date || '')}</span>
      <span style="background:${S.orange};color:${S.bg};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700">${idx+1} / ${total}</span>
    </div>`;
}

function renderScannerActions(slide, idx, total, config) {
  const orders = (slide.newSetups || []).slice(0, 5);
  const orderRows = orders.map(o => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:${S.green}12;border:1px solid ${S.green}40;border-radius:10px;margin-bottom:8px">
      <div style="font-size:20px;font-weight:900;color:${S.green};min-width:64px;font-family:${T.fontMono}">${esc(o.ticker)}</div>
      <div style="flex:1;display:flex;gap:16px;font-size:13px;color:${S.text}">
        <span>Entry <strong style="color:${S.blue}">${esc(o.entry)}</strong></span>
        <span>Stop <strong style="color:${S.red}">${esc(o.stop)}</strong></span>
        <span>TP1 <strong style="color:${S.green}">${esc(o.tp1)}</strong></span>
        <span>R/R <strong style="color:${S.purple}">${esc(o.rr)}</strong></span>
      </div>
    </div>`).join('');

  return `
    <div class="slide" style="background:${S.bg};color:${S.text}">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${S.red},${S.orange})"></div>
      <div style="flex:1;display:flex;flex-direction:column;padding:28px 44px 56px;margin-top:5px">
        <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:${S.orange};text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <div style="width:14px;height:3px;background:${S.orange};border-radius:2px"></div>
          PORTFOLIO ACTIONS
        </div>
        <div style="font-size:26px;font-weight:800;color:${S.text};margin-bottom:8px;letter-spacing:-0.3px">${esc(slide.title)}</div>
        <div style="font-size:14px;color:${S.textSub};margin-bottom:20px">${slide.openCount} positions open — new orders below</div>

        <div style="font-size:12px;font-weight:700;color:${S.green};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">🟢 New Orders</div>
        <div style="flex:1">${orderRows}</div>
      </div>
      ${scannerFooter(idx, total, config)}
    </div>`;
}

function renderScannerPortfolio(slide, idx, total, config) {
  const positions = (slide.positions || []).slice(0, 6);
  const m = slide.metrics || {};

  const posRows = positions.map(p => `
    <div style="display:flex;align-items:center;padding:8px 14px;background:${S.bgCard};border:1px solid ${S.border};border-radius:8px">
      <div style="font-size:15px;font-weight:800;color:${S.text};min-width:60px;font-family:${T.fontMono}">${esc(p.ticker)}</div>
      <div style="flex:1;font-size:12px;color:${S.textSub}">${esc(p.sector)}</div>
      <div style="font-size:12px;color:${S.purple};font-weight:600">${esc(p.strategy)}</div>
      <div style="font-size:14px;font-weight:800;color:${S.orange};min-width:40px;text-align:right">${p.score}</div>
    </div>`).join('');

  const metricBoxes = [
    { label: 'Regime', value: m.regime || '—', color: S.red },
    { label: 'Avg Score', value: m.avgScore || '—', color: S.orange },
    { label: 'S&P 500', value: m.spChange || '—', color: m.spChange?.startsWith('-') ? S.red : S.green },
    { label: 'NASDAQ', value: m.nasdaqChange || '—', color: m.nasdaqChange?.startsWith('-') ? S.red : S.green },
  ].map(b => `
    <div style="flex:1;background:${S.bgCard};border:1px solid ${S.border};border-radius:10px;padding:12px 14px;text-align:center">
      <div style="font-size:10px;color:${S.textSub};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${esc(b.label)}</div>
      <div style="font-size:20px;font-weight:800;color:${b.color}">${esc(b.value)}</div>
    </div>`).join('');

  return `
    <div class="slide" style="background:${S.bg};color:${S.text}">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${S.blue},${S.purple})"></div>
      <div style="flex:1;display:flex;flex-direction:column;padding:28px 44px 56px;margin-top:5px">
        <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:${S.blue};text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <div style="width:14px;height:3px;background:${S.blue};border-radius:2px"></div>
          PORTFOLIO STATE
        </div>
        <div style="font-size:26px;font-weight:800;color:${S.text};margin-bottom:16px;letter-spacing:-0.3px">${esc(slide.title)}</div>
        <div style="display:flex;gap:12px;margin-bottom:16px">${metricBoxes}</div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">${posRows}</div>
      </div>
      ${scannerFooter(idx, total, config)}
    </div>`;
}

function renderScannerMarket(slide, idx, total, config) {
  const m = slide.metrics || {};
  const sectors = (slide.topSectors || []).slice(0, 4);

  const regimeColor = (slide.regime || '').toLowerCase().includes('risk-off') ? S.red
    : (slide.regime || '').toLowerCase().includes('risk-on') ? S.green : S.orange;

  const sectorTags = sectors.map(s => `
    <span style="background:${S.bgCard};border:1px solid ${S.border};border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;color:${S.cyan}">${esc(s)}</span>`).join('');

  const metricItems = [
    { label: 'S&P 500', value: m.spChange, color: m.spChange?.startsWith('-') ? S.red : S.green },
    { label: 'NASDAQ', value: m.nasdaqChange, color: m.nasdaqChange?.startsWith('-') ? S.red : S.green },
    { label: 'WTI', value: m.wtiPrice, color: S.green },
  ].filter(x => x.value).map(x => `
    <div style="flex:1;text-align:center">
      <div style="font-size:10px;color:${S.textSub};text-transform:uppercase;letter-spacing:1px">${esc(x.label)}</div>
      <div style="font-size:24px;font-weight:800;color:${x.color}">${esc(x.value)}</div>
    </div>`).join('');

  return `
    <div class="slide" style="background:${S.bg};color:${S.text}">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${S.bgCard},${regimeColor},${S.bgCard})"></div>
      <div style="flex:1;display:flex;flex-direction:row;gap:32px;padding:28px 44px 56px;margin-top:5px">
        <!-- Left: regime -->
        <div style="width:340px;display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:${regimeColor};text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <div style="width:14px;height:3px;background:${regimeColor};border-radius:2px"></div>
            MARKET REGIME
          </div>
          <div style="font-size:48px;margin-bottom:8px">${slide.regimeEmoji || '📊'}</div>
          <div style="font-size:32px;font-weight:900;color:${regimeColor};margin-bottom:12px">${esc(slide.regime)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${sectorTags}</div>
        </div>
        <!-- Right: metrics + thesis -->
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
          <div style="display:flex;gap:16px;background:${S.bgCard};border:1px solid ${S.border};border-radius:14px;padding:16px;margin-bottom:20px">${metricItems}</div>
          <div style="background:${S.bgCard};border:1px solid ${S.border};border-radius:14px;padding:20px">
            <div style="font-size:12px;font-weight:700;color:${S.orange};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Market Thesis</div>
            <div style="font-size:15px;color:${S.text};line-height:1.55">${esc(slide.thesis || '')}</div>
          </div>
        </div>
      </div>
      ${scannerFooter(idx, total, config)}
    </div>`;
}

function renderScannerSetup(slide, idx, total, config) {
  const levels = (slide.levels || []);
  const scoreColor = slide.score >= 90 ? S.green : slide.score >= 85 ? S.orange : S.blue;

  const levelRows = levels.map(l => {
    const colorMap = { tp2: S.green, tp1: '#3fb950', entry: S.blue, stop: S.red, rr: S.purple };
    const color = colorMap[l.type] || S.textSub;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-left:3px solid ${color};background:${color}10;border-radius:0 8px 8px 0;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:${S.textSub};text-transform:uppercase;letter-spacing:1px;min-width:44px">${esc(l.label)}</div>
        <div style="font-size:18px;font-weight:800;color:${color};font-family:${T.fontMono}">${esc(l.value)}</div>
      </div>`;
  }).join('');

  return `
    <div class="slide" style="background:${S.bg};color:${S.text}">
      <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,${scoreColor},${S.orange})"></div>
      <div style="flex:1;display:flex;flex-direction:row;gap:20px;padding:28px 44px 56px;margin-top:5px">
        <!-- Left: chart + levels -->
        <div style="flex:1;display:flex;flex-direction:column">
          <div style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:${S.orange};text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px">
            <div style="width:14px;height:3px;background:${S.orange};border-radius:2px"></div>
            SETUP ${esc(slide.strategy || '')}
          </div>
          <div style="font-size:24px;font-weight:800;color:${S.text};margin-bottom:4px;letter-spacing:-0.3px">${esc(slide.title)}</div>
          <div style="font-size:13px;color:${S.textSub};margin-bottom:12px">${esc(slide.name || '')} · ${esc(slide.sector || '')}</div>

          <!-- Finviz chart image -->
          <div style="flex:1;background:${S.bgCard};border:1px solid ${S.border};border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:220px;position:relative">
            ${slide.finvizUrl ? `<img src="${slide.finvizUrl.startsWith('data:') ? slide.finvizUrl : esc(slide.finvizUrl)}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : ''}
            <div style="display:${slide.finvizUrl ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:8px;color:${S.textSub}">
              <div style="font-size:48px">📊</div>
              <div style="font-size:14px;font-weight:600">${esc(slide.ticker || '')} — Daily Chart</div>
              <div style="font-size:11px;color:${S.textSub}">finviz.com</div>
            </div>
          </div>
        </div>

        <!-- Right: score + levels + thesis -->
        <div style="width:280px;display:flex;flex-direction:column;gap:12px">
          <!-- Score badge -->
          <div style="background:${scoreColor};border-radius:14px;padding:18px;text-align:center">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:4px">Score</div>
            <div style="font-size:44px;font-weight:900;color:white;line-height:1">${slide.score || '—'}</div>
          </div>
          <!-- Levels -->
          <div style="flex:1">${levelRows}</div>
          <!-- Thesis snippet -->
          <div style="background:${S.bgCard};border:1px solid ${S.border};border-radius:10px;padding:12px;font-size:12px;color:${S.textSub};line-height:1.45">${esc(slide.thesis || '')}</div>
        </div>
      </div>
      ${scannerFooter(idx, total, config)}
    </div>`;
}

// ── Route slides ───────────────────────────────────────────────────────────────
function renderSlide(slide, idx, total, config) {
  switch (slide.type) {
    case 'chapter-intro':  return renderChapterIntro(slide, idx, total, config);
    case 'metric-row':     return renderMetricRow(slide, idx, total, config);
    case 'event-timeline': return renderEventTimeline(slide, idx, total, config);
    case 'highlight':      return renderHighlight(slide, idx, total, config);
    case 'chart-image':    return renderChartImage(slide, idx, total, config);
    case 'trade-levels':   return renderTradeLevels(slide, idx, total, config);
    case 'performance':    return renderPerformance(slide, idx, total, config);
    case 'summary':        return renderSummary(slide, idx, total, config);
    case 'bullets':        return renderBullets(slide, idx, total, config);
    case 'outro':          return renderOutro(slide, idx, total, config);
    case 'scanner-actions':   return renderScannerActions(slide, idx, total, config);
    case 'scanner-portfolio': return renderScannerPortfolio(slide, idx, total, config);
    case 'scanner-market':    return renderScannerMarket(slide, idx, total, config);
    case 'scanner-setup':     return renderScannerSetup(slide, idx, total, config);
    default:               return renderDefault(slide, idx, total, config);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function renderSlidesToPng(slides, config, outDir) {
  const total = slides.length;

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-web-security',
    ],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 }); // retina quality

  const pngPaths = [];

  for (let i = 0; i < slides.length; i++) {
    const slideHtml = renderSlide(slides[i], i, total, config);
    const fullHtml = `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <style>${BASE_CSS}</style>
    </head><body>${slideHtml}</body></html>`;

    try {
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (e) {
      // ignore timeout
    }
    await new Promise(r => setTimeout(r, 200)); // let fonts render

    const outPath = path.join(outDir, `slide-${i}.png`);
    await page.screenshot({ path: outPath, type: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    const size = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ✅ slide-${i}.png (${size}KB) [${slides[i].type}]`);
    pngPaths.push(outPath);
  }

  await browser.close();
  return pngPaths;
}
