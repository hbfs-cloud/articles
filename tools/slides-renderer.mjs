/**
 * slides-renderer.mjs
 * Renders edu-data slides to 1280x720 PNGs using puppeteer + inline HTML.
 * No CDN dependencies — all styles inline.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CHROMIUM = '/snap/bin/chromium';

// ── Theme ──────────────────────────────────────────────────────────────────────
const THEME = {
  bg:         '#0a0e1a',
  surface:    '#111827',
  surface2:   '#1f2937',
  border:     '#1e293b',
  primary:    '#3b82f6',
  success:    '#10b981',
  danger:     '#ef4444',
  warning:    '#f59e0b',
  info:       '#38bdf8',
  text:       '#f1f5f9',
  textMuted:  '#94a3b8',
  textFaint:  '#475569',
  font:       "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px; height: 720px; overflow: hidden;
    background: ${THEME.bg};
    color: ${THEME.text};
    font-family: ${THEME.font};
    font-size: 16px;
    line-height: 1.5;
  }
  .slide {
    width: 1280px; height: 720px;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
  }
  .brand-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, ${THEME.primary}, ${THEME.success});
  }
  .footer {
    position: absolute; bottom: 0; left: 0; right: 0; height: 40px;
    background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px;
    font-size: 13px; color: ${THEME.textFaint};
    border-top: 1px solid ${THEME.border};
  }
  .footer .brand { color: ${THEME.primary}; font-weight: 700; letter-spacing: 1px; font-size: 11px; text-transform: uppercase; }
  .content {
    flex: 1; display: flex; flex-direction: column;
    padding: 28px 48px 52px;
  }
  .section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 2px;
    color: ${THEME.primary}; text-transform: uppercase; margin-bottom: 12px;
  }
  .slide-title {
    font-size: 26px; font-weight: 800; color: ${THEME.text};
    margin-bottom: 20px; line-height: 1.2;
  }
  .card {
    background: ${THEME.surface}; border: 1px solid ${THEME.border};
    border-radius: 12px; padding: 16px 20px;
  }
  .glass {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 16px 20px; backdrop-filter: blur(4px);
  }
`;

// ── Slide renderers ────────────────────────────────────────────────────────────

function renderChapterIntro(slide, idx, total, config) {
  const ch = slide.chapter || {};
  const part = ch.partNumber || 1;
  const totalParts = ch.totalParts || 4;
  const dots = Array.from({ length: totalParts }, (_, i) =>
    `<div style="width:8px;height:8px;border-radius:50%;background:${i+1===part ? THEME.primary : THEME.surface2}"></div>`
  ).join('');

  return `
    <div class="slide" style="background:linear-gradient(135deg,#0a0e1a 0%,#0f1f3d 60%,#0a0e1a 100%);justify-content:center;align-items:center;text-align:center">
      <div class="brand-bar"></div>
      <div style="display:flex;gap:8px;margin-bottom:28px;justify-content:center">${dots}</div>
      <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:${THEME.primary};text-transform:uppercase;margin-bottom:16px">
        MARKET WATCH — Chapter ${part} / ${totalParts}
      </div>
      <div style="width:60px;height:3px;background:${THEME.primary};border-radius:2px;margin:0 auto 24px"></div>
      <h1 style="font-size:52px;font-weight:900;line-height:1.1;max-width:900px;margin:0 auto 20px">${esc(ch.title || config.seriesTitle)}</h1>
      <p style="font-size:22px;color:${THEME.textMuted};max-width:700px;margin:0 auto">${esc(ch.subtitle || config.date)}</p>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderMetricRow(slide, idx, total, config) {
  const metrics = (slide.metrics || []).slice(0, 6);
  const cols = metrics.length <= 3 ? metrics.length : Math.ceil(metrics.length / 2);

  const cards = metrics.map(m => {
    const isUp = m.trend === 'up';
    const isDown = m.trend === 'down';
    const deltaColor = isUp ? THEME.success : isDown ? THEME.danger : THEME.textMuted;
    const arrow = isUp ? '▲' : isDown ? '▼' : '';
    return `
      <div class="card" style="flex:1;min-width:160px">
        <div style="font-size:12px;color:${THEME.textMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${esc(m.label)}</div>
        <div style="font-size:28px;font-weight:800;color:${THEME.text};margin-bottom:4px">${esc(m.value)}</div>
        ${m.delta ? `<div style="font-size:14px;color:${deltaColor};font-weight:600">${arrow} ${esc(m.delta)}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Market Watch</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;flex:1">${cards}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderEventTimeline(slide, idx, total, config) {
  const events = (slide.events || []).slice(0, 5);
  const impactColors = { high: THEME.danger, medium: THEME.warning, low: THEME.success };

  const items = events.map(e => {
    const impact = (e.impact || 'medium').toLowerCase();
    const color = impactColors[impact] || THEME.textMuted;
    return `
      <div style="display:flex;gap:16px;align-items:flex-start;padding:10px 0;border-bottom:1px solid ${THEME.border}">
        <div style="min-width:64px;font-size:13px;font-weight:700;color:${THEME.primary};padding-top:2px">${esc(e.time)}</div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:600;color:${THEME.text}">${esc(e.title)}</div>
        </div>
        <div style="min-width:64px;text-align:right;font-size:12px;font-weight:700;color:${color};text-transform:uppercase">${esc(e.impact)}</div>
      </div>`;
  }).join('');

  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Timeline</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="flex:1">${items}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderHighlight(slide, idx, total, config) {
  const icon = slide.icon || '💡';
  return `
    <div class="slide" style="justify-content:center;align-items:center;background:linear-gradient(135deg,#0a0e1a 0%,#0d1929 100%)">
      <div class="brand-bar"></div>
      <div style="max-width:800px;text-align:center;padding:0 60px">
        <div style="font-size:56px;margin-bottom:24px">${icon}</div>
        <h2 style="font-size:32px;font-weight:800;color:${THEME.text};margin-bottom:20px;line-height:1.2">${esc(slide.title)}</h2>
        <div style="width:60px;height:3px;background:${THEME.primary};border-radius:2px;margin:0 auto 24px"></div>
        <p style="font-size:20px;color:${THEME.textMuted};line-height:1.6">${esc(slide.text)}</p>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderChartImage(slide, idx, total, config) {
  const imageUrl = slide.imageUrl || slide.finvizUrl || '';
  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content" style="flex-direction:row;gap:24px">
        <div style="flex:1.8;display:flex;flex-direction:column">
          <div class="section-label">Technical Analysis</div>
          <div class="slide-title">${esc(slide.title)}</div>
          <div style="flex:1;background:${THEME.surface};border-radius:12px;overflow:hidden;border:1px solid ${THEME.border}">
            ${imageUrl
              ? `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:contain" />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${THEME.textFaint}">Chart loading...</div>`}
          </div>
          ${slide.caption ? `<div style="font-size:13px;color:${THEME.textMuted};margin-top:8px;text-align:center">${esc(slide.caption)}</div>` : ''}
        </div>
        ${slide.levels ? renderTradeLevelsInline(slide.levels) : ''}
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderTradeLevelsInline(levels) {
  const colorMap = { tp2: '#84cc16', tp1: '#22c55e', entry: '#3b82f6', stop: '#ef4444', rr: '#8b5cf6', horizon: '#38bdf8' };
  const items = levels.map(l => {
    const color = colorMap[l.type] || THEME.textMuted;
    return `
      <div style="background:${THEME.surface};border:1px solid ${THEME.border};border-left:4px solid ${color};border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;color:${THEME.textMuted};text-transform:uppercase;letter-spacing:1px">${esc(l.label)}</div>
          <div style="font-size:18px;font-weight:800;color:${color}">${esc(l.value)}</div>
        </div>
        ${l.note ? `<div style="font-size:12px;color:${THEME.textFaint};margin-top:2px">${esc(l.note)}</div>` : ''}
      </div>`;
  }).join('');
  return `<div style="flex:0.9;display:flex;flex-direction:column;justify-content:center">${items}</div>`;
}

function renderTradeLevels(slide, idx, total, config) {
  const colorMap = { tp2: '#84cc16', tp1: '#22c55e', entry: '#3b82f6', stop: '#ef4444', rr: '#8b5cf6', horizon: '#38bdf8' };
  const levels = (slide.levels || []);
  const items = levels.map(l => {
    const color = colorMap[l.type] || THEME.textMuted;
    return `
      <div style="background:${THEME.surface};border:1px solid ${THEME.border};border-left:5px solid ${color};border-radius:10px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:13px;color:${THEME.textMuted};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${esc(l.label)}</div>
          ${l.note ? `<div style="font-size:13px;color:${THEME.textFaint}">${esc(l.note)}</div>` : ''}
        </div>
        <div style="font-size:26px;font-weight:900;color:${color}">${esc(l.value)}</div>
      </div>`;
  }).join('');
  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Trade Setup</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;flex:1">${items}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderPerformance(slide, idx, total, config) {
  const tickers = (slide.tickers || []).slice(0, 8);
  const rows = tickers.map(t => {
    const isUp = t.perf >= 0;
    const color = isUp ? THEME.success : THEME.danger;
    const arrow = isUp ? '▲' : '▼';
    return `
      <div style="display:flex;align-items:center;gap:16px;padding:10px 16px;background:${THEME.surface};border-radius:8px;border:1px solid ${THEME.border}">
        <div style="min-width:64px;font-weight:800;font-size:18px;color:${THEME.text}">${esc(t.symbol)}</div>
        <div style="flex:1;font-size:14px;color:${THEME.textMuted}">${esc(t.name)}</div>
        <div style="font-size:18px;font-weight:700;color:${color};min-width:72px;text-align:right">${arrow} ${Math.abs(t.perf).toFixed(1)}%</div>
        ${t.note ? `<div style="font-size:13px;color:${THEME.textFaint};min-width:200px;text-align:right">${esc(t.note)}</div>` : ''}
      </div>`;
  }).join('');
  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Performance</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;flex:1">${rows}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderSummary(slide, idx, total, config) {
  const items = (slide.items || []);
  const bullets = items.map((item, i) => `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 16px;background:${THEME.surface};border-radius:10px;border:1px solid ${THEME.border}">
      <div style="min-width:28px;height:28px;background:${THEME.primary};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0">${i+1}</div>
      <div style="font-size:16px;color:${THEME.text};line-height:1.4;padding-top:2px">${esc(item)}</div>
    </div>`).join('');
  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Key Takeaways</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;flex:1">${bullets}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderBullets(slide, idx, total, config) {
  const items = (slide.items || []).slice(0, 6);
  const bullets = items.map((item, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 16px;border-left:3px solid ${THEME.primary};background:${THEME.surface};border-radius:0 8px 8px 0;margin-bottom:8px">
      <div style="font-size:15px;color:${THEME.text};line-height:1.4">${esc(item)}</div>
    </div>`).join('');
  return `
    <div class="slide">
      <div class="brand-bar"></div>
      <div class="content">
        <div class="section-label">Analysis</div>
        <div class="slide-title">${esc(slide.title)}</div>
        <div style="flex:1">${bullets}</div>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

function renderDefault(slide, idx, total, config) {
  // Generic fallback
  return `
    <div class="slide" style="justify-content:center;align-items:center">
      <div class="brand-bar"></div>
      <div style="max-width:800px;padding:60px;text-align:center">
        <div class="section-label">${esc(slide.type)}</div>
        <h2 style="font-size:36px;font-weight:800;margin-bottom:20px">${esc(slide.title||'')}</h2>
        <p style="font-size:18px;color:${THEME.textMuted}">${esc(slide.text||slide.narration||'')}</p>
      </div>
      <div class="footer">
        <span class="brand">MARKET WATCH</span>
        <span>${esc(config.seriesTitle)}</span>
        <span>${idx+1} / ${total}</span>
      </div>
    </div>`;
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Render one slide to HTML ──────────────────────────────────────────────────
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
    default:               return renderDefault(slide, idx, total, config);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function renderSlidesToPng(slides, config, outDir) {
  const total = slides.length;

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

  const pngPaths = [];
  for (let i = 0; i < slides.length; i++) {
    const slideHtml = renderSlide(slides[i], i, total, config);
    const fullHtml = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>${BASE_CSS}</style>
    </head><body>${slideHtml}</body></html>`;

    // For chart-image slides with external images, use networkidle0
    const hasExternal = (slides[i].imageUrl || slides[i].finvizUrl || '').length > 0;
    await page.setContent(fullHtml, { waitUntil: hasExternal ? 'networkidle0' : 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 200));

    const outPath = path.join(outDir, `slide-${i}.png`);
    await page.screenshot({ path: outPath, type: 'png', captureBeyondViewport: false });
    const size = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ✅ slide-${i}.png (${size}KB) [${slides[i].type}]`);
    pngPaths.push(outPath);
  }

  await browser.close();
  return pngPaths;
}
