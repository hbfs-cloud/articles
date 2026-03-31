/**
 * slides-to-html.js
 * Converts edu-data.json slides to a complete Reveal.js HTML file.
 */

const LETTERS = ['A', 'B', 'C', 'D'];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Slide renderers ───────────────────────────────────────────────────

function renderChapterIntro(slide, idx, total) {
  const ch = slide.chapter || {};
  const part = ch.partNumber || 1;
  const totalParts = ch.totalParts || 6;
  const dots = Array.from({ length: totalParts }, (_, i) =>
    `<div class="progress-dot${i + 1 === part ? ' active' : ''}"></div>`
  ).join('');

  return `
    <div class="chapter-intro-wrap">
      <div class="trading-badge animate d1">Chapitre ${part} / ${totalParts}</div>
      <div class="chapter-number animate d2">${String(part).padStart(2, '0')}</div>
      <h2 class="chapter-title animate d3">${escapeHtml(ch.title)}</h2>
      <p class="chapter-subtitle animate d4">${escapeHtml(ch.subtitle)}</p>
      <div class="chapter-progress animate d5">${dots}</div>
    </div>`;
}

function renderBullets(slide, idx, total) {
  const items = (slide.items || []).map((item, i) =>
    `<li class="animate d${Math.min(i + 2, 8)}">${escapeHtml(item)}</li>`
  ).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <ul class="bullet-list">${items}</ul>
    </div>`;
}

function renderTable(slide, idx, total) {
  const headers = (slide.headers || []).map(h =>
    `<th>${escapeHtml(h)}</th>`
  ).join('');

  const rows = (slide.rows || []).map(row =>
    `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  ).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <table class="data-table animate d2">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderConcept(slide, idx, total) {
  const logoHtml = slide.logoUrl
    ? `<img src="${escapeHtml(slide.logoUrl)}" alt="" style="height:80px;max-width:300px;object-fit:contain;margin:0 auto 20px;display:block;border-radius:8px;">`
    : '';
  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      ${logoHtml ? `<div class="animate d2">${logoHtml}</div>` : ''}
      <div class="concept-text animate d${logoHtml ? '3' : '2'}">${escapeHtml(slide.text)}</div>
    </div>`;
}

function renderTip(slide, idx, total) {
  const title = slide.title ? `<div class="tip-label">${escapeHtml(slide.title)}</div>` : `<div class="tip-label">Conseil Pro</div>`;
  return `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:70vh;">
      <div class="tip-box animate d1">
        <div class="tip-header">
          <span class="tip-icon">💡</span>
          ${title}
        </div>
        <p>${escapeHtml(slide.text)}</p>
      </div>
    </div>`;
}

function renderWarning(slide, idx, total) {
  return `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:70vh;">
      <div class="warning-box animate d1">
        <div class="warning-header">
          <span class="warning-icon">⚠️</span>
          <div class="warning-title">${escapeHtml(slide.title || 'Attention')}</div>
        </div>
        <p>${escapeHtml(slide.text)}</p>
      </div>
    </div>`;
}

function renderSteps(slide, idx, total) {
  const steps = (slide.steps || []).map((step, i) => `
    <div class="timeline-item animate d${Math.min(i + 2, 8)}">
      <div class="step-number">${step.number || i + 1}</div>
      <h4>${escapeHtml(step.title)}</h4>
      <p>${escapeHtml(step.description)}</p>
    </div>`).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="timeline">${steps}</div>
    </div>`;
}

function renderQuote(slide, idx, total) {
  return `
    <div class="quote-wrap">
      <div class="quote-mark animate d1">&ldquo;</div>
      <div class="quote-text animate d2">${escapeHtml(slide.text)}</div>
      <div class="quote-source animate d3">&mdash; ${escapeHtml(slide.source)}</div>
    </div>`;
}

function renderComparison(slide, idx, total) {
  const left = slide.left || {};
  const right = slide.right || {};

  const leftLabel = left.label || '';
  const rightLabel = right.label || '';

  // Heuristic: detect positive/negative side from label text
  const leftClass = leftLabel.toLowerCase().match(/signal|pour|avantage|bon|positif|✓|achet/) ? 'positive' : 'neutral';
  const rightClass = rightLabel.toLowerCase().match(/bruit|contre|risque|négatif|danger|vend|✗/) ? 'negative' : 'neutral';

  const leftItems = (left.items || []).map(item =>
    `<li>${escapeHtml(item)}</li>`
  ).join('');
  const rightItems = (right.items || []).map(item =>
    `<li>${escapeHtml(item)}</li>`
  ).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="comparison-grid animate d2">
        <div class="comparison-col ${leftClass}">
          <div class="comparison-label">${escapeHtml(leftLabel)}</div>
          <ul class="comparison-items">${leftItems}</ul>
        </div>
        <div class="comparison-col ${rightClass}">
          <div class="comparison-label">${escapeHtml(rightLabel)}</div>
          <ul class="comparison-items">${rightItems}</ul>
        </div>
      </div>
    </div>`;
}

function renderQuiz(slide, idx, total) {
  const choices = (slide.choices || []).map((choice, i) => {
    const isCorrect = i === slide.correctIndex;
    return `
      <li class="quiz-option${isCorrect ? ' correct' : ''} animate d${i + 2}">
        <span class="quiz-letter">${LETTERS[i]}</span>
        ${escapeHtml(choice)}
      </li>`;
  }).join('');

  return `
    <div class="quiz-wrap">
      <div class="trading-badge animate d1">Quiz</div>
      <div class="quiz-question animate d2">${escapeHtml(slide.question)}</div>
      <ul class="quiz-options">${choices}</ul>
      <div class="quiz-explanation animate d7">
        <strong>Explication :</strong> ${escapeHtml(slide.explanation)}
      </div>
    </div>`;
}

function renderSummary(slide, idx, total) {
  const items = (slide.items || []).map((item, i) => `
    <li class="animate d${Math.min(i + 2, 8)}">
      <div class="summary-icon">${i + 1}</div>
      ${escapeHtml(item)}
    </li>`).join('');

  return `
    <div class="summary-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <ul class="summary-list">${items}</ul>
    </div>`;
}

// ── New slide types (from Remotion components) ───────────────────────

function renderMetricRow(slide, idx, total) {
  const metrics = (slide.metrics || []).map((m, i) => {
    const trendClass = m.trend === 'up' ? 'positive' : m.trend === 'down' ? 'negative' : '';
    const trendIcon = m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '';
    return `
      <div class="metric-card animate d${Math.min(i + 1, 6)}">
        <div class="label">${escapeHtml(m.label)}</div>
        <div class="value">${escapeHtml(m.value)}</div>
        ${m.delta ? `<div class="delta ${trendClass}">${trendIcon} ${escapeHtml(m.delta)}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="grid-${Math.min(slide.metrics?.length || 3, 4)}" style="margin-top:20px;">${metrics}</div>
    </div>`;
}

function renderTradeLevels(slide, idx, total) {
  const levels = (slide.levels || []).map((l, i) => {
    const colorMap = { entry: '#10b981', stop: '#ef4444', tp1: '#22c55e', tp2: '#84cc16', rr: '#8b5cf6', horizon: '#3b82f6' };
    const color = colorMap[l.type] || '#64748b';
    return `
      <div class="trade-level animate d${Math.min(i + 2, 8)}" style="border-left:4px solid ${color};">
        <div class="trade-level-label">${escapeHtml(l.label)}</div>
        <div class="trade-level-value">${escapeHtml(l.value)}</div>
      </div>`;
  }).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      ${slide.ticker ? `<div class="ticker-badge animate d1">${escapeHtml(slide.ticker)}</div>` : ''}
      <div class="levels-grid">${levels}</div>
    </div>`;
}

function renderDidactic(slide, idx, total) {
  const icon = slide.icon || '📘';
  return `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:70vh;">
      <div class="didactic-box animate d1">
        <div class="didactic-header">
          <span class="didactic-icon">${icon}</span>
          <div class="didactic-label">${escapeHtml(slide.title || 'Le saviez-vous ?')}</div>
        </div>
        <p class="didactic-text">${escapeHtml(slide.text)}</p>
        ${slide.source ? `<div class="didactic-source">Source : ${escapeHtml(slide.source)}</div>` : ''}
      </div>
    </div>`;
}

function renderChartImage(slide, idx, total) {
  const url = slide.imageUrl || slide.finvizUrl || '';
  const caption = slide.caption || '';
  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="chart-image-wrap animate d2">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(slide.title)}"
             style="width:100%;max-height:600px;object-fit:contain;border-radius:12px;background:#1e293b;">
        ${caption ? `<div class="chart-caption">${escapeHtml(caption)}</div>` : ''}
      </div>
    </div>`;
}

function renderPerformance(slide, idx, total) {
  const rows = (slide.tickers || []).map((t, i) => {
    const isUp = t.perf >= 0;
    const perfClass = isUp ? 'positive' : 'negative';
    const arrow = isUp ? '▲' : '▼';
    return `
      <div class="perf-row animate d${Math.min(i + 2, 8)}">
        <div class="perf-ticker">${escapeHtml(t.symbol)}</div>
        <div class="perf-name">${escapeHtml(t.name || '')}</div>
        <div class="perf-value ${perfClass}">${arrow} ${typeof t.perf === 'number' ? (t.perf >= 0 ? '+' : '') + t.perf.toFixed(1) + '%' : escapeHtml(t.perf)}</div>
      </div>`;
  }).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="perf-table">${rows}</div>
    </div>`;
}

function renderEventTimeline(slide, idx, total) {
  const events = (slide.events || []).map((e, i) => {
    const impactColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    const impact = (e.impact || 'medium').toLowerCase();
    const color = impactColors[impact] || '#64748b';
    return `
      <div class="event-item animate d${Math.min(i + 2, 8)}">
        <div class="event-time">${escapeHtml(e.time || e.date || '')}</div>
        <div class="event-body">
          <div class="event-title">${escapeHtml(e.title)}</div>
          ${e.description ? `<div class="event-desc">${escapeHtml(e.description)}</div>` : ''}
        </div>
        <div class="event-impact" style="background:${color}20;color:${color};border:1px solid ${color}40;">
          ${escapeHtml(e.impact || 'Medium')}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="event-timeline">${events}</div>
    </div>`;
}

function renderCode(slide, idx, total) {
  const before = slide.before || '';
  const after = slide.after || '';
  const isSingle = !after;

  if (isSingle) {
    return `
      <div class="concept-wrap">
        <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
        <div class="code-block full animate d2">
          ${slide.language ? `<div class="code-lang">${escapeHtml(slide.language)}</div>` : ''}
          <pre><code>${escapeHtml(slide.code || before)}</code></pre>
        </div>
      </div>`;
  }

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="code-comparison">
        <div class="code-block before animate d2">
          <div class="code-label negative">AVANT</div>
          <pre><code>${escapeHtml(before)}</code></pre>
        </div>
        <div class="code-block after animate d3">
          <div class="code-label positive">APRÈS</div>
          <pre><code>${escapeHtml(after)}</code></pre>
        </div>
      </div>
    </div>`;
}

function renderArchitecture(slide, idx, total) {
  const nodes = (slide.nodes || []).map((n, i) => `
    <div class="arch-node animate d${Math.min(i + 2, 8)}" style="${n.color ? `border-color:${n.color};` : ''}">
      ${n.icon ? `<span class="arch-icon">${n.icon}</span>` : ''}
      <div class="arch-label">${escapeHtml(n.label)}</div>
      ${n.detail ? `<div class="arch-detail">${escapeHtml(n.detail)}</div>` : ''}
    </div>`).join('');

  const hub = slide.hub ? `
    <div class="arch-hub animate d3">
      ${slide.hub.icon ? `<span>${slide.hub.icon}</span>` : ''}
      <strong>${escapeHtml(slide.hub.label)}</strong>
    </div>` : '';

  return `
    <div class="concept-wrap">
      <div class="section-title animate d1">${escapeHtml(slide.title)}</div>
      <div class="arch-flow">
        <div class="arch-row">${nodes.slice(0, Math.ceil((slide.nodes || []).length / 2))}</div>
        ${hub}
        ${(slide.nodes || []).length > 3 ? `<div class="arch-row">${nodes.slice(Math.ceil((slide.nodes || []).length / 2))}</div>` : ''}
      </div>
    </div>`;
}

function renderHighlight(slide, idx, total) {
  const icon = slide.icon || '🔑';
  return `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:70vh;">
      <div class="highlight-box animate d1">
        <div class="highlight-icon">${icon}</div>
        <h3 class="highlight-title">${escapeHtml(slide.title)}</h3>
        <p class="highlight-text">${escapeHtml(slide.text)}</p>
      </div>
    </div>`;
}

// ── Dispatcher ────────────────────────────────────────────────────────

function renderSlide(slide, idx, total) {
  switch (slide.type) {
    case 'chapter-intro':   return renderChapterIntro(slide, idx, total);
    case 'bullets':         return renderBullets(slide, idx, total);
    case 'table':           return renderTable(slide, idx, total);
    case 'concept':         return renderConcept(slide, idx, total);
    case 'tip':             return renderTip(slide, idx, total);
    case 'warning':         return renderWarning(slide, idx, total);
    case 'steps':           return renderSteps(slide, idx, total);
    case 'quote':           return renderQuote(slide, idx, total);
    case 'comparison':      return renderComparison(slide, idx, total);
    case 'quiz':            return renderQuiz(slide, idx, total);
    case 'summary':         return renderSummary(slide, idx, total);
    case 'metric-row':      return renderMetricRow(slide, idx, total);
    case 'trade-levels':    return renderTradeLevels(slide, idx, total);
    case 'didactic':        return renderDidactic(slide, idx, total);
    case 'chart-image':     return renderChartImage(slide, idx, total);
    case 'performance':     return renderPerformance(slide, idx, total);
    case 'event-timeline':  return renderEventTimeline(slide, idx, total);
    case 'code':            return renderCode(slide, idx, total);
    case 'architecture':    return renderArchitecture(slide, idx, total);
    case 'highlight':       return renderHighlight(slide, idx, total);
    default:                return renderConcept(slide, idx, total);
  }
}

// ── Main export ───────────────────────────────────────────────────────

export function slidesToHtml(eduData, narrationData, theme) {
  const slides = eduData.slides || [];
  const config = eduData.config || {};
  const total = slides.length;
  const seriesTitle = config.seriesTitle || 'Formation';

  const sections = slides.map((slide, idx) => {
    const inner = renderSlide(slide, idx, total);
    return `
  <section data-slide-index="${idx}">
    ${inner}
    <div class="footer-bar">
      <span class="footer-brand">market-watch.xyz</span>
      <span>${escapeHtml(seriesTitle)}</span>
      <span class="footer-slide">${idx + 1} / ${total}</span>
    </div>
  </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${config.language || 'fr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(seriesTitle)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css">
  <style>
    ${theme.css}

    /* Override Reveal defaults */
    .reveal .slides { text-align: left; }
    .reveal .slides section {
      top: 0 !important;
      height: 100%;
      display: flex !important;
      flex-direction: column;
      justify-content: flex-start;
      padding: 40px 60px 70px;
    }
    .reveal h2 { color: #fff; text-shadow: none; }
    .reveal p  { color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${sections}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      hash: false,
      controls: false,
      progress: false,
      center: false,
      transition: 'fade',
      transitionSpeed: 'fast',
      backgroundTransition: 'none',
      width: 1920,
      height: 1080,
      margin: 0,
      minScale: 1,
      maxScale: 1,
    });
  </script>
</body>
</html>`;
}
