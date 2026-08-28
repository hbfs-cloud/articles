#!/usr/bin/env node
/**
 * render-analysis.js — DailyTickers Analysis JSON → HTML Renderer (V2)
 *
 * The LLM produces structured JSON (~5KB). This engine renders it
 * deterministically to a complete HTML article (~30-60KB).
 *
 * Usage:
 *   node tools/render-analysis.js data/analyses-data/MATX.json
 *   node tools/render-analysis.js data/analyses-data/MATX.json --dry    # validate only
 *   node tools/render-analysis.js --batch data/analyses-data/*.json     # batch render
 *   node tools/render-analysis.js --re-render                          # re-render ALL
 *
 * Schema: tools/lib/analysis-schema.json
 * Data:   data/analyses-data/{TICKER}.json
 * Output: analyses/{TICKER}/index.html
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { pickOgImage } = require('./lib/og-image.js');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'analysis-schema.json'), 'utf8'));

// ─── Minimal JSON Schema validator ──────────────────────────────────────────
function validate(data, schema, loc) {
  loc = loc || '';
  const errs = [];
  if (!data && data !== 0 && data !== false && data !== '') return errs;
  if (schema.required && schema.type === 'object' && typeof data === 'object') {
    for (const k of schema.required) {
      if (data[k] === undefined || data[k] === null) errs.push(`${loc}.${k} is required`);
    }
  }
  if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (data[k] !== undefined) errs.push(...validate(data[k], sub, `${loc}.${k}`));
    }
  }
  if (schema.type === 'array' && Array.isArray(data) && schema.items) {
    data.forEach((item, i) => errs.push(...validate(item, schema.items, `${loc}[${i}]`)));
  }
  if (schema.type === 'number' && typeof data !== 'number') errs.push(`${loc} must be number, got ${typeof data}`);
  if (schema.type === 'integer' && (!Number.isInteger(data))) errs.push(`${loc} must be integer`);
  if (schema.type === 'string' && typeof data !== 'string') errs.push(`${loc} must be string, got ${typeof data}`);
  if (schema.minimum != null && data < schema.minimum) errs.push(`${loc} must be >= ${schema.minimum}`);
  if (schema.maximum != null && data > schema.maximum) errs.push(`${loc} must be <= ${schema.maximum}`);
  return errs;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function gradeColor(g) {
  if (!g) return '#64748b';
  if (g.startsWith('A')) return '#22c55e';
  if (g.startsWith('B')) return '#3b82f6';
  if (g.startsWith('C')) return '#f59e0b';
  return '#ef4444';
}

function gradeBadgeClass(g) {
  if (!g) return 'gray';
  if (g.startsWith('A')) return 'green';
  if (g.startsWith('B')) return 'blue';
  if (g.startsWith('C')) return 'amber';
  return 'red';
}

const changePctColor = v => (v || 0) >= 0 ? '#22c55e' : '#ef4444';
const changePctSign  = v => (v || 0) >= 0 ? '+' : '';

function severityClass(s) {
  return ({ critical: 'risk-card-critical', high: 'risk-card-high', medium: 'risk-card-medium', low: 'risk-card-low' })[s] || 'risk-card-medium';
}

function severityIcon(s) {
  return ({ critical: 'fa-skull-crossbones', high: 'fa-triangle-exclamation', medium: 'fa-circle-info', low: 'fa-circle-check' })[s] || 'fa-circle-info';
}

function riskGaugeColor(score) {
  if (score <= 3) return '#22c55e';
  if (score <= 5) return '#3b82f6';
  if (score <= 7) return '#f59e0b';
  return '#ef4444';
}

function signalBadgeClass(c) {
  // 'gray' mappait vers .badge-gray, classe INEXISTANTE dans report.css (seules
  // blue/green/red/purple/orange sont définies) : chaque cellule Signal en gris
  // rendait un badge nu. .badge-gray est désormais défini côté CSS.
  return ({ green: 'badge-green', red: 'badge-red', blue: 'badge-blue', amber: 'badge-purple', orange: 'badge-orange', gray: 'badge-gray' })[c] || 'badge-blue';
}

// Le gabarit écrivait `class="fa-solid ${rc.icon}"`. Quand la donnée porte
// icon:"fa-solid" (cas EONR), on obtient `fa-solid fa-solid` : aucun glyphe,
// neuf encarts de risque vides. On retire le préfixe de famille et on retombe
// sur un glyphe réel si rien d'exploitable ne reste.
// Une tuile .tm-value est un CHIFFRE (1.1rem, poids 800, chiffres tabulaires,
// centré dans une petite carte) : une valeur absente y imprimait « N/A », que la
// règle maison interdit, et une phrase longue y cassait la mise en page. On omet
// la tuile dans les deux cas — la prose a sa place dans `notes`.
function metricTile(value, label) {
  const v = String(value == null ? '' : value).trim();
  if (!v || v === 'N/A' || v === '.' || v.length > 40) return '';
  return `          <div class="ticker-metric"><div class="tm-value">${esc(v)}</div><div class="tm-label">${esc(label)}</div></div>\n`;
}

// Les jauges de risque attendent un NOMBRE. Une valeur en prose (« Structural »,
// « Already the case ») était injectée telle quelle dans style="width:...%",
// déclaration invalide donc barre cassée et légende invisible — six par page sur
// EONR. On ne laisse plus passer que du numérique borné ; la prose part en verdict.
function pct(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
}

function riskIcon(icon) {
  const g = String(icon || '').replace(/\bfa-(solid|regular|light|thin|duotone|brands)\b/g, '').trim();
  return /^fa-[a-z0-9-]+$/.test(g) ? g : 'fa-triangle-exclamation';
}

function impactBadge(i) {
  return ({ positive: 'badge-green', negative: 'badge-red', neutral: 'badge-blue' })[i] || 'badge-blue';
}

function sourceRefsHtml(refs) {
  if (!refs || !refs.length) return '';
  return `\n      <div class="source-refs" style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #e2e8f0;">\n` +
    refs.map(r => `        <a href="${esc(r.url)}" class="source-ref" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square source-icon"></i><span class="source-name">${esc(r.name)}</span>${r.date ? `<span class="source-date">&middot; ${esc(r.date)}</span>` : ''}</a>`).join('\n') +
    `\n      </div>`;
}

function formatHeaderPrice(price, meta) {
  const at = (meta && meta.assetType) || 'stock';
  if (at === 'forex') return price.toFixed(4);
  if (at === 'crypto' && price > 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (at === 'crypto') return '$' + price.toFixed(2);
  return '$' + price.toFixed(2);
}

function renderChartEmbed(header, meta) {
  const t = header.ticker;
  const assetType = (meta && meta.assetType) || 'stock';

  if (assetType === 'crypto') {
    const symbol = t.replace('-USD', '').replace('-', '');
    return `
    <div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;height:400px;">
        <iframe src="https://www.tradingview.com/widgetembed/?symbol=COINBASE:${symbol}USD&interval=D&theme=light&style=1&locale=en&toolbar_bg=f8fafc" style="width:100%;height:100%;border:none;" loading="lazy"></iframe>
      </div>
    </div>`;
  }

  if (assetType === 'forex') {
    const pair = t.replace('/', '');
    return `
    <div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;height:400px;">
        <iframe src="https://www.tradingview.com/widgetembed/?symbol=FX:${pair}&interval=D&theme=light&style=1&locale=en" style="width:100%;height:100%;border:none;" loading="lazy"></iframe>
      </div>
    </div>`;
  }

  if (assetType === 'commodity') {
    return `
    <div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;height:400px;">
        <iframe src="https://www.tradingview.com/widgetembed/?symbol=${t}&interval=D&theme=light&style=1&locale=en" style="width:100%;height:100%;border:none;" loading="lazy"></iframe>
      </div>
    </div>`;
  }

  if (assetType === 'index') {
    return `
    <div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div onclick="openChartModal()" style="cursor:pointer;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <img src="https://charts2.finviz.com/chart.ashx?t=${t}&ty=c&ta=1&p=d&s=l" alt="${t}" style="width:100%;display:block;" loading="lazy">
        <div style="background:#f8fafc;padding:6px 12px;font-size:0.7rem;color:#64748b;"><span><i class="fa-solid fa-chart-line"></i> Click to enlarge</span></div>
      </div>
    </div>`;
  }

  // stock + etf: Finviz
  return `
    <div style="max-width:900px;margin:1rem auto;padding:0 1rem;">
      <div onclick="openChartModal()" style="cursor:pointer;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <img src="https://charts2.finviz.com/chart.ashx?t=${t}&ty=c&ta=1&p=d&s=l" alt="${t} Chart" style="width:100%;display:block;" loading="lazy">
        <div style="background:#f8fafc;padding:6px 12px;font-size:0.7rem;color:#64748b;"><span><i class="fa-solid fa-chart-line"></i> Click to enlarge</span></div>
      </div>
    </div>`;
}

// ─── Section renderers ──────────────────────────────────────────────────────

function renderHead(d) {
  const { meta, header, verdict } = d;
  const title = `DailyTickers | ${header.ticker} Analysis — ${header.name} | ${meta.dateDisplay || meta.date}`;
  const desc = esc(meta.description || `${header.ticker} analysis: ${(verdict.summary || '').slice(0, 160)}`);
  const ogDesc = esc(meta.ogDescription || `${header.ticker}: ${verdict.bias} setup, score ${verdict.score}/100.`);
  // CHANTIER 2 (og:image auto) : PNG du dossier analyses/{TICKER}/ s'il existe,
  // sinon logo boursier par ticker, sinon /logo.svg.
  const ogImage = pickOgImage({
    articleDir: path.join('analyses', header.ticker),
    type: 'analyses',
    ticker: header.ticker,
  }).url;
  return `<!DOCTYPE html>
<html lang="${meta.lang || 'en'}"${meta.dir === 'rtl' ? ' dir="rtl"' : ''} data-tags="${meta.tags.join(',')}" data-tab="analyses" data-grade="${meta.grade}"${meta.level ? ` data-level="${meta.level}"` : ''}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta property="og:title" content="DailyTickers — ${header.ticker} Analysis">
    <meta property="og:description" content="${ogDesc}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://articles.dailytickers.com/analyses/${header.ticker}/">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${ogImage}">
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="/assets/report.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head>
<body>
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

function renderBrandBar() {
  return `
    <nav class="brand-bar">
      <div class="brand-bar-inner">
        <a href="/" class="brand-logo">
          <img src="/logo.svg" alt="DailyTickers" width="36" height="36">
          <span class="brand-title">DailyTickers</span>
        </a>
        <div class="brand-nav">
          <a href="/?tab=weekly">Hebdo</a>
          <a href="/?tab=daily">Daily</a>
          <a href="/?tab=analyses">Analyses</a>
          <a href="/?tab=scanner">Scanner</a>
          <a href="/?tab=radar">Radar</a>
          <a href="/?tab=series">S&eacute;ries</a>
        </div>
        <div class="brand-actions">
          <a href="/" class="brand-home-btn" title="Home"><i class="fas fa-house"></i></a>
        </div>
      </div>
    </nav>`;
}

function renderStatusBanner(d) {
  if (d.meta.status === 'invalidated') {
    return `\n    <div style="background:#dc2626;color:#fff;text-align:center;padding:1rem;font-weight:700;font-size:1.1rem;">
      <i class="fa-solid fa-triangle-exclamation"></i> GRADE DOWNGRADED &mdash; ${esc(d.meta.invalidationNote || 'Setup invalidated')}
    </div>`;
  }
  if (d.meta.status === 'archived') {
    return `\n    <div style="background:#64748b;color:#fff;text-align:center;padding:0.75rem;font-weight:600;">
      <i class="fa-solid fa-archive"></i> ARCHIVED &mdash; This analysis is no longer maintained.
    </div>`;
  }
  return '';
}

function renderHeader(d) {
  const { header, meta, verdict } = d;
  const m = header.metrics || {};
  const badges = (header.badges || []).map(b => `<span class="badge badge-${b.color}">${esc(b.text)}</span>`).join('\n        ');
  const halalBadge = header.halal
    ? `<span class="badge badge-green">☪ ${header.halalStatus === 'disputed' ? 'Disputed' : 'Halal'}</span>`
    : '';

  const metrics = [
    m.marketCap      && ['Market Cap', m.marketCap],
    m.volume         && ['Volume', m.volume],
    m.fwdPE          && ['Fwd P/E', m.fwdPE],
    m.beta != null   && ['Beta', m.beta],
    m.range52w       && ['52W Range', m.range52w],
    m.shortInterest  && ['Short Interest', m.shortInterest],
    m.divYield       && ['Div Yield', m.divYield],
    m.analystTarget  && ['Analyst Target', m.analystTarget],
    m.pegRatio       && ['PEG', m.pegRatio],
    m.evEbitda       && ['EV/EBITDA', m.evEbitda],
  ].filter(Boolean);

  return `
    <header class="ticker-header">
      <div class="ticker-symbol" style="display:none">${esc(header.ticker)}</div>
      <div class="ticker-name" style="display:none">${esc(header.name)} &mdash; ${esc(header.exchange)} &middot; ${esc(header.sector)}</div>
      <div class="ticker-exchange" style="display:none">${esc(header.exchange)} &middot; ${esc(header.sector)}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <img src="/logo.svg" alt="DailyTickers" width="44" height="44" style="border-radius:10px;">
        <div style="text-align:center;">
          <h1 style="margin:0;font-size:1.8rem;font-weight:800;">${esc(header.ticker)} <span style="font-weight:400;font-size:1rem;color:#64748b;">&mdash; ${esc(header.name)}</span></h1>
          <div style="font-size:0.85rem;color:#64748b;">${esc(header.exchange)} &middot; ${esc(header.sector)} &middot; ${esc(meta.dateDisplay || meta.date)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <span style="font-size:2.2rem;font-weight:800;">${formatHeaderPrice(header.price, d.meta)}</span>
        <span style="font-size:1.1rem;font-weight:600;color:${changePctColor(header.changePct)};">${changePctSign(header.changePct)}${(header.changePct || 0).toFixed(2)}%</span>
        ${badges}
        <span class="badge badge-blue">Score ${verdict.score}</span>
        <span style="background:${gradeColor(meta.grade)};color:#fff;padding:0.3rem 0.7rem;border-radius:8px;font-weight:800;">${meta.grade}</span>
${halalBadge ? `        ${halalBadge}` : ''}
${(d.archiveHistory && d.archiveHistory.length) ? `        <button type="button" onclick="document.getElementById('historyModal').style.display='flex'" style="background:none;border:1px solid #e2e8f0;color:#64748b;cursor:pointer;padding:0.3rem 0.7rem;border-radius:8px;font-size:0.8rem;display:inline-flex;align-items:center;gap:0.4rem;"><i class="fa-solid fa-clock-rotate-left"></i>Historique</button>` : ''}
      </div>
      <div class="ticker-metrics" style="display:flex;flex-wrap:wrap;gap:1rem;">
${metrics.map(([label, val]) => `        <div class="ticker-metric"><div class="tm-value">${esc(val)}</div><div class="tm-label">${esc(label)}</div></div>`).join('\n')}
      </div>
      <div id="article-clickable-tags" class="card-tags"></div>
    </header>

${renderChartEmbed(header, d.meta)}`;
}

function renderVerdict(d) {
  const { verdict, meta } = d;
  return `
      <div id="verdict" class="content-card">
        <h2><i class="fa-solid fa-gavel"></i> Verdict Express</h2>
        <div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem;">
          <div style="text-align:center;">
            <div id="gaugeScore" class="echart-box" style="width:180px;height:180px;"></div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
              <span style="background:${gradeColor(meta.grade)};color:#fff;padding:0.3rem 0.8rem;border-radius:8px;font-weight:800;font-size:1.2rem;">${meta.grade}</span>
              <span class="badge badge-${verdict.bias === 'Bullish' ? 'green' : verdict.bias === 'Bearish' ? 'red' : 'blue'}">${verdict.bias}</span>
              <span class="badge badge-purple">${esc(verdict.confidence || verdict.conviction)}</span>
            </div>
            <p style="font-size:0.95rem;line-height:1.6;color:#334155;">${esc(verdict.summary)}</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
          <div style="background:#f0fdf4;border:1px solid #86efac;padding:1.25rem;border-radius:12px;">
            <h4 style="color:#16a34a;margin:0 0 0.75rem;font-size:1rem;"><i class="fa-solid fa-thumbs-up"></i> Why Buy</h4>
            <ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:0.5rem;">
${(verdict.whyBuy || []).map(p => `              <li style="font-size:0.9rem;line-height:1.5;">${esc(p)}</li>`).join('\n')}
            </ul>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:1.25rem;border-radius:12px;">
            <h4 style="color:#dc2626;margin:0 0 0.75rem;font-size:1rem;"><i class="fa-solid fa-thumbs-down"></i> Why Avoid</h4>
            <ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:0.5rem;">
${(verdict.whyAvoid || []).map(p => `              <li style="font-size:0.9rem;line-height:1.5;">${esc(p)}</li>`).join('\n')}
            </ul>
          </div>
        </div>
      </div>`;
}

function renderBusiness(d) {
  if (!d.business) return '';
  const b = d.business;
  let html = `
      <div id="business" class="content-card">
        <h2><i class="fa-solid fa-building"></i> Business Overview</h2>
        ${b.overview}`;
  if (b.segments && b.segments.length) {
    // Colonnes émises seulement si au moins un segment porte la donnée —
    // sinon le <thead> annonçait 4 colonnes pour des lignes à 2 cellules.
    const hasPct = b.segments.some(s => s.pct);
    const hasDesc = b.segments.some(s => s.description);
    html += `\n        <h4 style="margin-top:1rem;">Segments</h4>
        <table class="data-table">
          <thead><tr><th>Segment</th><th>Revenue</th>${hasPct ? '<th>% Total</th>' : ''}${hasDesc ? '<th>Description</th>' : ''}</tr></thead>
          <tbody>
${b.segments.map(s => `            <tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.revenue || '')}</td>${hasPct ? `<td>${esc(s.pct || '')}</td>` : ''}${hasDesc ? `<td>${esc(s.description || '')}</td>` : ''}</tr>`).join('\n')}
          </tbody>
        </table>`;
  }
  html += `\n      </div>`;
  return html;
}

function renderNews(d) {
  if (!d.news || !d.news.length) return '';
  return `
      <div id="news" class="content-card">
        <h2><i class="fa-solid fa-newspaper"></i> Recent News</h2>
${d.news.map(n => `        <div style="display:flex;gap:0.75rem;align-items:flex-start;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:0.75rem;color:#64748b;white-space:nowrap;min-width:5rem;">${esc(n.date)}</span>
          <div>
            <div style="font-weight:600;font-size:0.9rem;">${esc(n.title)} <span class="badge ${impactBadge(n.impact)}" style="font-size:0.65rem;">${n.impact}</span></div>
${n.detail ? `            <div style="font-size:0.82rem;color:#64748b;margin-top:0.25rem;">${esc(n.detail)}</div>` : ''}
${n.sourceUrl ? `            <a href="${esc(n.sourceUrl)}" class="source-ref" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square source-icon"></i><span class="source-name">${esc(n.source || 'Source')}</span></a>` : ''}
          </div>
        </div>`).join('\n')}
      </div>`;
}

function renderFundamentals(d) {
  const f = d.fundamentals;
  return `
      <div id="fondamentaux" class="content-card">
        <h2><i class="fa-solid fa-chart-line"></i> Fundamentals</h2>
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Value</th><th>Signal</th></tr></thead>
          <tbody>
${f.rows.map(r => `            <tr><td>${esc(r.metric)}</td><td><strong>${esc(r.value)}</strong></td><td>${r.signal ? `<span class="badge ${signalBadgeClass(r.signalColor)}">${esc(r.signal)}</span>` : ''}</td></tr>`).join('\n')}
          </tbody>
        </table>${sourceRefsHtml(f.sourceRefs)}
      </div>`;
}

function renderEarnings(d) {
  if (!d.earnings || !d.earnings.quarters || !d.earnings.quarters.length) return '';
  const e = d.earnings;
  return `
      <div id="earnings" class="content-card">
        <h2><i class="fa-solid fa-chart-bar"></i> Earnings History</h2>
        <table class="data-table">
          <thead><tr><th>Quarter</th><th>EPS Actual</th><th>EPS Est.</th><th>Surprise</th><th>Revenue</th></tr></thead>
          <tbody>
${e.quarters.map(q => {
    const beat = q.epsActual > q.epsEstimate;
    return `            <tr><td>${esc(q.quarter)}</td><td><strong>$${q.epsActual.toFixed(2)}</strong></td><td>$${q.epsEstimate.toFixed(2)}</td><td><span class="badge badge-${beat ? 'green' : q.epsActual === q.epsEstimate ? 'blue' : 'red'}">${esc(q.surprise || (beat ? 'Beat' : q.epsActual === q.epsEstimate ? 'Inline' : 'Miss'))}</span></td><td>${esc(q.revActual || '-')}</td></tr>`;
  }).join('\n')}
          </tbody>
        </table>
${e.beatNote ? `        <div class="pedagogy-box" style="margin-top:1rem;"><p><strong>${esc(e.beatNote)}</strong>${e.nextEarnings ? ` &mdash; Next: ${esc(e.nextEarnings)}` : ''}</p></div>` : ''}
      </div>`;
}

function renderInsiders(d) {
  if (!d.insiders) return '';
  const ins = d.insiders;
  let html = `
      <div id="insiders" class="content-card">
        <h2><i class="fa-solid fa-user-tie"></i> Insiders &amp; Institutions</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div class="ticker-metric"><div class="tm-value">${esc(ins.insiderPct || 'N/A')}</div><div class="tm-label">Insider Own.</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(ins.institutionPct || 'N/A')}</div><div class="tm-label">Institution Own.</div></div>
        </div>`;
  if (ins.topHolders && ins.topHolders.length) {
    html += `\n        <table class="data-table"><thead><tr><th>Holder</th><th>%</th><th>Role</th></tr></thead><tbody>
${ins.topHolders.map(h => `            <tr><td>${esc(h.name)}</td><td>${esc(h.pct)}</td><td>${esc(h.role || '')}</td></tr>`).join('\n')}
          </tbody></table>`;
  }
  if (ins.recentTransactions && ins.recentTransactions.length) {
    html += `\n        <h4 style="margin-top:1rem;">Recent Transactions</h4>
        <table class="data-table"><thead><tr><th>Date</th><th>Insider</th><th>Type</th><th>Shares</th><th>Value</th></tr></thead><tbody>
${ins.recentTransactions.map(t => `            <tr><td>${esc(t.date)}</td><td>${esc(t.insider)}</td><td><span class="badge badge-${t.type === 'buy' ? 'green' : 'red'}">${t.type}</span></td><td>${esc(t.shares)}</td><td>${esc(t.value)}</td></tr>`).join('\n')}
          </tbody></table>`;
  }
  if (ins.signal) html += `\n        <div class="pedagogy-box"><p>${esc(ins.signal)}</p></div>`;
  html += sourceRefsHtml(ins.sourceRefs);
  html += `\n      </div>`;
  return html;
}

function renderCapitalStructure(d) {
  if (!d.capitalStructure) return '';
  const cs = d.capitalStructure;
  let html = `
      <div id="capital" class="content-card">
        <h2><i class="fa-solid fa-money-bill-trend-up"></i> Capital Structure &amp; Dilution</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
${metricTile(cs.sharesOutstanding, 'Shares Out.')}${metricTile(cs.sharesAuthorized, 'Authorized')}${cs.dilutionRisk ? `          <div class="ticker-metric"><div class="tm-value"><span class="badge badge-${cs.dilutionRisk === 'low' ? 'green' : cs.dilutionRisk === 'moderate' ? 'blue' : cs.dilutionRisk === 'unknown' ? 'gray' : 'red'}">${esc(cs.dilutionRisk)}</span></div><div class="tm-label">Dilution Risk</div></div>\n` : ''}        </div>`;
  if (cs.warrants && cs.warrants.length) {
    html += `\n        <h4>Warrants</h4>
        <table class="data-table"><thead><tr><th>Series</th><th>Type</th><th>Strike</th><th>Shares</th><th>Exp.</th><th>Dilution</th><th>Status</th></tr></thead><tbody>
${cs.warrants.map(w => `            <tr><td>${esc(w.series)}</td><td>${esc(w.type || 'N/A')}</td><td>${w.strike == null ? 'N/A' : '$' + w.strike}</td><td>${esc(w.shares || 'N/A')}</td><td>${esc(w.expiration || 'N/A')}</td><td>${esc(w.dilutionPct || w.note || 'See filing')}</td><td>${w.status ? `<span class="badge badge-${w.status === 'OTM' ? 'green' : w.status === 'ITM' ? 'red' : 'blue'}">${esc(w.status)}</span>` : 'Outstanding'}</td></tr>`).join('\n')}
          </tbody></table>`;
  }
  if (cs.atm && cs.atm.active) {
    html += `\n        <div class="alert-box" style="margin-top:1rem;"><h4 style="margin:0;"><i class="fa-solid fa-triangle-exclamation"></i> Active ATM Program</h4><p>Authorized: ${esc(cs.atm.authorized)} | Used: ${esc(cs.atm.used)} | Remaining: ${esc(cs.atm.remaining)}</p></div>`;
  }
  if (cs.shareHistory) html += `\n        <div class="pedagogy-box"><p>${esc(cs.shareHistory)}</p></div>`;
  html += sourceRefsHtml(cs.sourceRefs);
  html += `\n      </div>`;
  return html;
}

function renderFilingsReview(d) {
  const fr = d.filingsReview;
  if (!fr) return '';
  return `
      <div id="filings" class="content-card">
        <h2><i class="fa-solid fa-file-shield"></i> SEC Filings Review</h2>
        <div class="pedagogy-box"><p>${esc(fr.summary)}</p></div>
        <table class="data-table"><thead><tr><th>Date</th><th>Form</th><th>Accession</th><th>What the filing changes</th></tr></thead><tbody>
${fr.filings.map(f => `          <tr><td>${esc(f.date)}</td><td>${esc(f.form)}</td><td><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.accession)}</a></td><td>${esc(f.finding)}</td></tr>`).join('\n')}
        </tbody></table>
        <h4 style="margin-top:1rem;">Contrarian checks</h4>
        <ul class="check-list negative">${fr.contrarianRisks.map(r => `<li><i class="fa-solid fa-circle-xmark"></i><span>${esc(r)}</span></li>`).join('')}</ul>
      </div>`;
}

function renderShortInterest(d) {
  if (!d.shortInterest) return '';
  const si = d.shortInterest;
  return `
      <div id="short" class="content-card">
        <h2><i class="fa-solid fa-arrow-down-up-across-line"></i> Short Interest</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div class="ticker-metric"><div class="tm-value">${esc(si.siPct || 'N/A')}</div><div class="tm-label">SI % Float</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(si.daysToCover || 'N/A')}</div><div class="tm-label">Days to Cover</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(si.ctb || 'N/A')}</div><div class="tm-label">CTB</div></div>
        </div>
${si.trend ? `        <p style="font-size:0.9rem;color:#64748b;">${esc(si.trend)}</p>` : ''}${sourceRefsHtml(si.sourceRefs)}
      </div>`;
}

function renderOptions(d) {
  if (!d.options) return '';
  const o = d.options;
  return `
      <div id="options" class="content-card">
        <h2><i class="fa-solid fa-chart-gantt"></i> Options / Derivatives</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div class="ticker-metric"><div class="tm-value">${esc(o.callOI || 'N/A')}</div><div class="tm-label">Call OI</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(o.putOI || 'N/A')}</div><div class="tm-label">Put OI</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(o.cpRatio || 'N/A')}</div><div class="tm-label">C/P Ratio</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(o.maxPain || 'N/A')}</div><div class="tm-label">Max Pain</div></div>
          <div class="ticker-metric"><div class="tm-value">${esc(o.ivMean || 'N/A')}</div><div class="tm-label">IV Mean</div></div>
        </div>
${o.unusual ? `        <div class="alert-box"><p><strong>Unusual Activity:</strong> ${esc(o.unusual)}</p></div>` : ''}${sourceRefsHtml(o.sourceRefs)}
      </div>`;
}

function renderTechnicals(d) {
  const t = d.technicals;
  const rv = t.radarValues || {};
  return `
      <div id="technique" class="content-card">
        <h2><i class="fa-solid fa-chart-area"></i> Technical Analysis</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;margin-bottom:1.5rem;">
${t.radarValues && Object.keys(rv).length ? `          <div><div id="radarTech${d.header.ticker.replace(/[^a-zA-Z0-9]/g,'')}" class="echart-box" style="height:320px;"></div></div>` : ''}
          <div>
            <table class="data-table"><tbody>
              <tr><td><strong>RSI (14)</strong></td><td style="color:${t.rsi14 > 70 ? '#ef4444' : t.rsi14 < 30 ? '#22c55e' : '#334155'};font-weight:600;">${t.rsi14.toFixed(1)}</td></tr>
              <tr><td><strong>EMA 20</strong></td><td>$${t.ema20.toFixed(2)}</td></tr>
              <tr><td><strong>${esc(t.ma50Type || 'EMA')} 50</strong></td><td>${t.ma50Available === false ? 'N/A' : '$' + t.ema50.toFixed(2)}</td></tr>
              <tr><td><strong>${esc(t.ma200Type || 'EMA')} 200</strong></td><td>${t.ma200Available === false ? 'N/A' : '$' + t.ema200.toFixed(2)}</td></tr>
              <tr><td><strong>MACD</strong></td><td style="color:${t.macd == null ? '#64748b' : t.macd >= 0 ? '#22c55e' : '#ef4444'};font-weight:600;">${t.macd == null ? 'N/A' : t.macd.toFixed(3)}</td></tr>
${t.macdSignal != null ? `              <tr><td><strong>Signal</strong></td><td>${t.macdSignal.toFixed(3)}</td></tr>` : ''}
              <tr><td><strong>ATR (14)</strong></td><td>$${t.atr14.toFixed(2)}</td></tr>
${t.wyckoff ? `              <tr><td><strong>Wyckoff</strong></td><td>${esc(t.wyckoff)}</td></tr>` : ''}
            </tbody></table>
            <div style="margin-top:1rem;">
${(t.badges || []).map(b => `              <span class="badge badge-${b.includes('Above') || b.includes('Bullish') || b.includes('rising') ? 'green' : b.includes('Below') || b.includes('Bearish') ? 'red' : 'blue'}">${esc(b)}</span>`).join('\n')}
            </div>
          </div>
        </div>
${t.supports && t.supports.length ? `        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;"><div><strong>Supports:</strong> ${t.supports.map(s => '$' + s.toFixed(2)).join(' / ')}</div><div><strong>Resistances:</strong> ${(t.resistances||[]).map(r => '$' + r.toFixed(2)).join(' / ')}</div></div>` : ''}
${t.setupNote ? `        <div class="pedagogy-box"><h4><i class="fa-solid fa-lightbulb"></i> Technical Setup</h4><p>${esc(t.setupNote)}</p></div>` : ''}${sourceRefsHtml(t.sourceRefs)}
      </div>`;
}

function renderPerformance(d) {
  if (!d.performance) return '';
  const p = d.performance;
  let html = `
      <div id="performance" class="content-card">
        <h2><i class="fa-solid fa-trophy"></i> Performance &amp; Benchmarks</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
          ${p.ytd ? `<div class="ticker-metric"><div class="tm-value">${esc(p.ytd)}</div><div class="tm-label">YTD</div></div>` : ''}
          ${p.oneYear ? `<div class="ticker-metric"><div class="tm-value">${esc(p.oneYear)}</div><div class="tm-label">1Y</div></div>` : ''}
          ${p.threeYear ? `<div class="ticker-metric"><div class="tm-value">${esc(p.threeYear)}</div><div class="tm-label">3Y</div></div>` : ''}
          ${p.alpha ? `<div class="ticker-metric"><div class="tm-value">${esc(p.alpha)}</div><div class="tm-label">Alpha</div></div>` : ''}
        </div>`;
  if (p.benchmarks && p.benchmarks.length) {
    html += `\n        <table class="data-table"><thead><tr><th>Benchmark</th><th>Ticker</th><th>YTD</th>${p.benchmarks[0].oneYear ? '<th>1Y</th>' : ''}</tr></thead><tbody>
${p.benchmarks.map(b => `            <tr><td>${esc(b.name)}</td><td>${esc(b.ticker||'')}</td><td>${esc(b.ytd)}</td>${b.oneYear ? `<td>${esc(b.oneYear)}</td>` : ''}</tr>`).join('\n')}
          </tbody></table>`;
  }
  html += sourceRefsHtml(p.sourceRefs);
  html += `\n      </div>`;
  return html;
}

function renderForecast(d) {
  if (!d.forecast) return '';
  const f = d.forecast;
  return `
      <div id="forecast" class="content-card">
        <h2><i class="fa-solid fa-chart-line"></i> Price Forecast (${esc(f.horizon || '10 Days')})</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;margin-bottom:1rem;">
          <div style="font-size:0.85rem;color:#64748b;margin-bottom:0.5rem;">Probabilistic Zone (80%)</div>
          <div style="font-size:1.8rem;font-weight:800;color:#0f172a;">$${f.ciLow.toFixed(2)} &mdash; $${f.ciHigh.toFixed(2)}</div>
          ${f.mape ? `<div style="font-size:0.8rem;color:#64748b;margin-top:0.25rem;">Expected error: ${esc(f.mape)}</div>` : ''}
          ${f.direction && f.directionAccuracy ? `<div style="margin-top:0.5rem;"><span class="badge badge-${f.direction === 'bullish' ? 'green' : f.direction === 'bearish' ? 'red' : 'blue'}">${f.direction}</span> <span style="font-size:0.75rem;color:#64748b;">(historical accuracy ~${esc(f.directionAccuracy)})</span></div>` : ''}
        </div>
        ${f.note ? `<div class="pedagogy-box"><h4><i class="fa-solid fa-lightbulb"></i> How to Read This</h4><p>${esc(f.note)}</p></div>` : ''}
        <p style="font-size:0.72rem;color:#94a3b8;">Quantitative projection only. Exclude earnings windows (&pm;3 days).</p>${sourceRefsHtml(f.sourceRefs)}
      </div>`;
}

function renderSectorComparison(d) {
  if (!d.sectorComparison || !d.sectorComparison.peers || !d.sectorComparison.peers.length) return '';
  const sc = d.sectorComparison;
  return `
      <div id="peers" class="content-card">
        <h2><i class="fa-solid fa-building"></i> Sector / Peers</h2>
        <table class="data-table"><thead><tr><th>Ticker</th><th>Name</th><th>Price</th><th>P/E</th><th>YTD</th><th>MCap</th></tr></thead><tbody>
${sc.peers.map(p => `            <tr><td><strong>${esc(p.ticker)}</strong></td><td>${esc(p.name||'')}</td><td>${esc(p.price||'-')}</td><td>${esc(p.pe||'-')}</td><td>${esc(p.ytd||'-')}</td><td>${esc(p.marketCap||'-')}</td></tr>`).join('\n')}
          </tbody></table>
${sc.positioning ? `        <div class="pedagogy-box"><p>Positioning: <strong>${esc(sc.positioning)}</strong>${sc.sectorEtf ? ` vs ${esc(sc.sectorEtf)}` : ''}</p></div>` : ''}${sourceRefsHtml(sc.sourceRefs)}
      </div>`;
}

function renderMacro(d) {
  if (!d.macro || !d.macro.indicators || !d.macro.indicators.length) return '';
  const mc = d.macro;
  return `
      <div id="macro" class="content-card">
        <h2><i class="fa-solid fa-globe"></i> Macro Context</h2>
        <table class="data-table"><thead><tr><th>Indicator</th><th>Value</th><th>Signal</th></tr></thead><tbody>
${mc.indicators.map(i => `            <tr><td>${esc(i.name)}</td><td><strong>${esc(i.value)}</strong></td><td>${esc(i.signal||'')}</td></tr>`).join('\n')}
          </tbody></table>
${mc.regime ? `        <p style="margin-top:0.75rem;"><strong>Regime:</strong> <span class="badge badge-${mc.regime === 'risk-on' ? 'green' : mc.regime === 'risk-off' ? 'red' : 'blue'}">${mc.regime}</span></p>` : ''}
${mc.impact ? `        <div class="pedagogy-box"><p>${esc(mc.impact)}</p></div>` : ''}${sourceRefsHtml(mc.sourceRefs)}
      </div>`;
}

function renderRisks(d) {
  const r = d.risks;
  const gc = riskGaugeColor(r.riskScore);
  return `
      <div id="risques" class="content-card">
        <h2><i class="fa-solid fa-shield-halved"></i> Risk Analysis</h2>
        <div class="risk-summary">
          <div id="riskGaugeChart" style="width:100px;height:100px;flex-shrink:0;"></div>
          <div class="risk-summary-detail"><h3>Risk Profile: ${esc(r.riskProfile || 'Moderate')}</h3><p>${esc(r.riskSummary || '')}</p></div>
        </div>
${r.riskRadarValues ? `        <div style="display:flex;justify-content:center;margin:1rem 0;"><div id="riskRadarChart" style="width:320px;height:260px;"></div></div>` : ''}
        <div class="risk-grid">
${r.riskCards.map(rc => `          <div class="risk-card ${severityClass(rc.severity)}">
            <div class="risk-card-header"><div class="risk-card-icon"><i class="fa-solid ${riskIcon(rc.icon)}"></i></div><h4>${esc(rc.title)}</h4><span class="risk-severity">${esc(rc.severity.charAt(0).toUpperCase() + rc.severity.slice(1))}</span></div>
            <div class="risk-card-body"><ul>${(rc.points||[]).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
              <div class="risk-meters"><div class="risk-meter"><div class="risk-meter-label">Probability</div><div class="risk-meter-bar"><div class="risk-meter-fill" style="width:${pct(rc.probability)}%;"></div></div></div><div class="risk-meter"><div class="risk-meter-label">Impact</div><div class="risk-meter-bar"><div class="risk-meter-fill" style="width:${pct(rc.impact)}%;"></div></div></div></div>
            </div>
            ${(rc.verdict || (typeof rc.impact === 'string' ? rc.impact : '')) ? `<div class="risk-verdict"><i class="fa-solid ${severityIcon(rc.severity)}"></i> ${esc(rc.verdict || rc.impact)}</div>` : ''}
          </div>`).join('\n')}
        </div>
${r.pedagogy ? `        <div class="pedagogy-box"><h4><i class="fa-solid fa-lightbulb"></i> Risk Synthesis</h4><p>${esc(r.pedagogy)}</p></div>` : ''}${sourceRefsHtml(r.sourceRefs)}
      </div>`;
}

function renderSocial(d) {
  if (!d.social || !d.social.platforms || !d.social.platforms.length) return '';
  const soc = d.social;
  return `
      <div id="social" class="content-card">
        <h2><i class="fa-solid fa-satellite-dish"></i> Social Radar</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">
${soc.platforms.map(p => `          <div style="padding:1rem;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
            <i class="${esc(p.icon)}" style="font-size:1.5rem;color:#64748b;"></i>
            <div style="font-weight:600;font-size:0.85rem;margin:0.5rem 0 0.25rem;">${esc(p.platform)}</div>
            <div style="font-size:0.8rem;color:#64748b;">${esc(p.mentions||'-')}</div>
            <span class="badge badge-${p.trendColor||'gray'}">${esc(p.trend||'-')}</span>
            <div style="font-size:0.72rem;color:#94a3b8;margin-top:0.25rem;">${esc(p.detail||'')}</div>
          </div>`).join('\n')}
        </div>
${soc.pumpDumpScore != null ? `        <div style="margin-top:1.5rem;border-top:1px solid #e2e8f0;padding-top:1rem;">
          <h4><i class="fa-solid fa-magnifying-glass-dollar"></i> Pump & Dump Score: ${soc.pumpDumpScore}/6</h4>
          <span class="badge badge-${soc.pumpDumpScore <= 1 ? 'green' : soc.pumpDumpScore <= 3 ? 'purple' : 'red'}" style="font-size:0.85rem;padding:4px 12px;">${soc.pumpDumpScore <= 1 ? 'Clean' : soc.pumpDumpScore <= 3 ? 'Suspect' : 'Alert P&D'}</span>
${soc.pumpDumpChecklist && soc.pumpDumpChecklist.length ? `          <div style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.5rem;">
${soc.pumpDumpChecklist.map(c => `            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;border-radius:8px;background:${c.pass ? '#fef2f2' : '#f0fdf4'};font-size:0.82rem;">
              <i class="fa-solid fa-${c.pass ? 'triangle-exclamation' : 'circle-check'}" style="color:${c.pass ? '#ef4444' : '#22c55e'};"></i>
              <span>${esc(c.criterion)}</span>
            </div>`).join('\n')}
          </div>` : ''}
        </div>` : ''}${sourceRefsHtml(soc.sourceRefs)}
      </div>`;
}

function renderCapitalFlow(d) {
  if (!d.capitalFlow) return '';
  const cf = d.capitalFlow;
  return `
      <div id="capitalflow" class="content-card">
        <h2><i class="fa-solid fa-water"></i> Capital Flow</h2>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">
          ${cf.netFlow ? `<div class="ticker-metric"><div class="tm-value">${esc(cf.netFlow)}</div><div class="tm-label">Net Flow</div></div>` : ''}
          ${cf.institutionalFlow ? `<div class="ticker-metric"><div class="tm-value">${esc(cf.institutionalFlow)}</div><div class="tm-label">Institutional</div></div>` : ''}
          ${cf.retailFlow ? `<div class="ticker-metric"><div class="tm-value">${esc(cf.retailFlow)}</div><div class="tm-label">Retail</div></div>` : ''}
          ${cf.darkPoolPct ? `<div class="ticker-metric"><div class="tm-value">${esc(cf.darkPoolPct)}</div><div class="tm-label">Dark Pool %</div></div>` : ''}
        </div>
        ${cf.signal ? `<div class="pedagogy-box"><p>${esc(cf.signal)}</p></div>` : ''}${sourceRefsHtml(cf.sourceRefs)}
      </div>`;
}

function renderBottomEstimation(d) {
  if (!d.bottomEstimation) return '';
  const be = d.bottomEstimation;
  const probColor = be.probability < 30 ? '#ef4444' : be.probability < 60 ? '#f59e0b' : '#22c55e';
  let html = `
      <div id="bottom-estimation" class="content-card">
        <h2><i class="fa-solid fa-bullseye"></i> Bottom Estimation & Setups</h2>`;
  if (be.probability != null) {
    html += `
        <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1.5rem;">
          <div class="risk-gauge" style="border-color:${probColor};width:80px;height:80px;">
            <div class="risk-gauge-score" style="color:${probColor};font-size:1.3rem;">${be.probability}%</div>
            <div class="risk-gauge-label" style="font-size:0.65rem;">Bottom Prob.</div>
          </div>
          <div style="font-size:0.85rem;color:#64748b;">Confidence based on ${be.confluences ? be.confluences.length : 0} confluence(s)</div>
        </div>`;
  }
  if (be.scenarios && be.scenarios.length) {
    const scenarioColors = { optimistic: '#22c55e', base: '#3b82f6', pessimistic: '#ef4444' };
    html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">
${be.scenarios.map(s => `          <div style="border-left:4px solid ${scenarioColors[s.label]||'#64748b'};padding:1rem;background:#f8fafc;border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">${esc(s.label)}</div>
            <div style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0.25rem 0;">$${typeof s.price === 'number' ? s.price.toLocaleString() : esc(String(s.price))}</div>
            <div style="font-size:0.78rem;color:#64748b;">${esc(s.basis)}</div>
          </div>`).join('\n')}
        </div>`;
  }
  if (be.confluences && be.confluences.length) {
    html += `
        <div style="margin-bottom:1.5rem;">
          <h4 style="margin-bottom:0.5rem;">Confluences</h4>
${be.confluences.map(c => `          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
            <div style="width:8px;height:8px;border-radius:50%;background:#6366f1;flex-shrink:0;"></div>
            <span style="font-size:0.85rem;">${esc(c)}</span>
          </div>`).join('\n')}
        </div>`;
  }
  if (be.setups && be.setups.length) {
    html += `
        <h4 style="margin-bottom:0.75rem;">Setups in Formation</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
${be.setups.map(s => `          <div class="setup-card" style="border:1px solid #e2e8f0;border-radius:12px;padding:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
              <span style="font-weight:700;font-size:0.9rem;">${esc(s.pattern)}</span>
              <span class="badge badge-blue">${esc(s.timeframe||'')}</span>
            </div>
            <p style="font-size:0.82rem;margin:0.25rem 0;"><strong>Trigger:</strong> ${esc(s.trigger||'')}</p>
            <p style="font-size:0.82rem;margin:0.25rem 0;"><strong>Target:</strong> ${esc(s.target||'')}</p>
            <p style="font-size:0.82rem;margin:0.25rem 0;"><strong>Invalidation:</strong> ${esc(s.invalidation||'')}</p>
${s.progress != null ? `            <div style="margin-top:0.5rem;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden;">
              <div style="width:${s.progress}%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;"></div>
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:0.25rem;">Formation: ${s.progress}%</div>` : ''}
          </div>`).join('\n')}
        </div>`;
  }
  html += `\n      </div>`;
  return html;
}

function renderManipulations(d) {
  if (!d.manipulations) return '';
  const m = d.manipulations;
  let html = `
      <div id="manipulations" class="content-card">
        <h2><i class="fa-solid fa-magnifying-glass-dollar"></i> Market Integrity Analysis</h2>`;
  if (m.anomalies && m.anomalies.length) {
    html += `
        <h3 style="margin-bottom:0.75rem;"><i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> Detected Anomalies</h3>
${m.anomalies.map(a => {
    const sevColor = a.severity === 'high' ? '#ef4444' : a.severity === 'medium' ? '#f59e0b' : '#3b82f6';
    return `        <div style="border-left:4px solid ${sevColor};padding:1rem;background:#f8fafc;border-radius:0 8px 8px 0;margin-bottom:0.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <strong>${esc(a.type)}</strong>
            <span class="badge badge-${a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'blue'}">${esc(a.severity)}</span>
          </div>
          <p style="font-size:0.85rem;margin:0.25rem 0;"><strong>Data:</strong> ${esc(a.data||'')}</p>
          <p style="font-size:0.85rem;margin:0.25rem 0;"><strong>Interpretation:</strong> ${esc(a.interpretation||'')}</p>
${a.history ? `          <p style="font-size:0.82rem;color:#64748b;margin:0.25rem 0;"><strong>History:</strong> ${esc(a.history)}</p>` : ''}
        </div>`;
  }).join('\n')}`;
  }
  if (m.secFilings && m.secFilings.length) {
    html += `
        <h3 style="margin:1.5rem 0 0.75rem;"><i class="fa-solid fa-file-shield"></i> SEC Filings & Hostile Funds</h3>
        <div style="overflow-x:auto;">
        <table class="data-table"><thead><tr><th>Date</th><th>Filing</th><th>Issuer</th><th>Detail</th><th>Signal</th></tr></thead><tbody>
${m.secFilings.map(f => `          <tr><td>${esc(f.date||'')}</td><td><span class="badge badge-blue">${esc(f.type||'')}</span></td><td>${esc(f.issuer||'')}</td><td>${esc(f.detail||'')}</td><td>${esc(f.signal||'')}</td></tr>`).join('\n')}
        </tbody></table>
        </div>`;
  }
  if (m.hostileFundsVerdict) {
    html += `
        <div class="pedagogy-box" style="margin-top:1rem;">
          <h4><i class="fa-solid fa-shield-halved"></i> Hostile Funds Verdict</h4>
          <p>${esc(m.hostileFundsVerdict)}</p>
        </div>`;
  }
  if (m.integrityVerdict) {
    html += `
        <div class="alert-box" style="margin-top:1rem;">
          <h4><i class="fa-solid fa-gavel"></i> Market Integrity</h4>
          <p>${esc(m.integrityVerdict)}</p>
        </div>`;
  }
  html += `\n      </div>`;
  return html;
}

function renderPredictionMarkets(d) {
  if (!d.predictionMarkets || !d.predictionMarkets.markets || !d.predictionMarkets.markets.length) return '';
  const pm = d.predictionMarkets;
  return `
      <div id="predictions" class="content-card">
        <h2><i class="fa-solid fa-chart-pie"></i> Prediction Markets</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;">
${pm.markets.map(m => `          <div style="padding:1rem;border:1px solid #e2e8f0;border-radius:12px;">
            <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;">${esc(m.question)}</div>
            <div style="font-size:1.5rem;font-weight:800;color:#6366f1;">${esc(m.probability)}</div>
            ${m.volume ? `<div style="font-size:0.72rem;color:#94a3b8;">Vol: ${esc(m.volume)}</div>` : ''}
            ${m.source ? `<a href="${m.sourceUrl || '#'}" class="source-ref" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square source-icon"></i><span class="source-name">${esc(m.source)}</span></a>` : ''}
          </div>`).join('\n')}
        </div>
        ${pm.interpretation ? `<div class="pedagogy-box"><p>${esc(pm.interpretation)}</p></div>` : ''}${sourceRefsHtml(pm.sourceRefs)}
      </div>`;
}

function renderTradeIdea(d) {
  const t = d.tradeIdea;
  const isInvalidated = t.status === 'invalidated' || t.status === 'stopped';
  const isClosed = isInvalidated || t.status === 'rejected' || t.status === 'missed';
  const op = isClosed ? 'opacity:0.65;' : '';
  const statusBanner = isInvalidated
    ? `\n        <div style="background:#dc2626;color:#fff;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-weight:600;text-align:center;"><i class="fa-solid fa-ban"></i> TRADE ${t.status.toUpperCase()}${t.statusNote ? ' &mdash; ' + esc(t.statusNote) : ''}</div>`
    : t.status === 'rejected' || t.status === 'missed'
    ? `\n        <div style="background:#64748b;color:#fff;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-weight:600;text-align:center;"><i class="fa-solid fa-circle-pause"></i> ${t.status.toUpperCase()}${t.statusNote ? ' &mdash; ' + esc(t.statusNote) : ''}</div>`
    : t.status === 'watch' || t.status === 'wait' || t.status === 'speculative'
    ? `\n        <div style="background:${t.status === 'watch' ? '#2563eb' : t.status === 'speculative' ? '#7c3aed' : '#d97706'};color:#fff;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-weight:600;text-align:center;"><i class="fa-solid fa-eye"></i> ${t.status.toUpperCase()}${t.statusNote ? ' &mdash; ' + esc(t.statusNote) : ''}</div>`
    : t.status === 'tp1-hit' || t.status === 'tp2-hit'
    ? `\n        <div style="background:#22c55e;color:#fff;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-weight:600;text-align:center;"><i class="fa-solid fa-check"></i> ${t.status.toUpperCase()}${t.statusNote ? ' &mdash; ' + esc(t.statusNote) : ''}</div>`
    : '';

  const cards = [
    { label: 'Entry Zone', value: `$${t.entry.toFixed(2)}`, note: t.entryNote || '', color: '#3b82f6', bg: '#f8fafc', tc: '#0f172a' },
    { label: 'Stop Loss',  value: `$${t.stop.toFixed(2)}`,  note: t.stopPct || '',  color: '#ef4444', bg: '#fef2f2', tc: '#ef4444' },
    { label: 'Target 1',   value: `$${t.tp1.toFixed(2)}`,   note: t.tp1Pct || '',   color: '#22c55e', bg: '#f0fdf4', tc: '#22c55e' },
  ];
  if (t.tp2) cards.push({ label: 'Target 2', value: `$${t.tp2.toFixed(2)}`, note: t.tp2Pct || '', color: '#22c55e', bg: '#f0fdf4', tc: '#22c55e' });
  cards.push({ label: 'Risk/Reward', value: t.rr, note: t.horizon || '', color: '#7c3aed', bg: '#f5f3ff', tc: '#7c3aed' });

  return `
      <div id="trade" class="content-card">
        <h2><i class="fa-solid fa-crosshairs"></i> Trade Idea</h2>${statusBanner}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;${op}">
${cards.map(c => `          <div style="border-left:4px solid ${c.color};padding:1rem;background:${c.bg};border-radius:0 8px 8px 0;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">${esc(c.label)}</div>
            <div style="font-size:1.5rem;font-weight:800;color:${c.tc};margin:0.25rem 0;">${esc(c.value)}</div>
            <div style="font-size:0.78rem;color:#64748b;">${esc(c.note)}</div>
          </div>`).join('\n')}
        </div>
${t.thesis ? `        <div class="pedagogy-box"${isClosed ? ' style="opacity:0.65;"' : ''}><h4><i class="fa-solid fa-lightbulb"></i> Thesis</h4><p>${esc(t.thesis)}</p></div>` : ''}
${t.catalysts && t.catalysts.length ? `        <div style="margin-top:1rem;${op}"><h4 style="font-size:0.95rem;margin-bottom:0.5rem;"><i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> Catalysts</h4><ul style="display:flex;flex-direction:column;gap:0.4rem;padding-left:1.2rem;">${t.catalysts.map(c => `<li style="font-size:0.9rem;">${esc(c)}</li>`).join('')}</ul></div>` : ''}
${t.invalidation && t.invalidation.length ? `        <div class="alert-box" style="margin-top:1rem;${op}"><h4 style="margin:0 0 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Invalidation</h4><ul style="margin:0;padding-left:1.2rem;">${t.invalidation.map(i => `<li style="font-size:0.9rem;">${esc(i)}</li>`).join('')}</ul></div>` : ''}
${t.forecast ? `        <div class="pedagogy-box" style="margin-top:1rem;"><h4>Price Forecast (${esc(t.forecast.horizon || '10 Days')})</h4><p>Probabilistic range 80%: <strong>[$${t.forecast.ciLow.toFixed(2)} &ndash; $${t.forecast.ciHigh.toFixed(2)}]</strong></p><p style="font-size:0.75rem;color:#64748b;">Quantitative projection only. Exclude earnings windows (&pm;3 days).</p></div>` : ''}
      </div>`;
}

function renderGlobalScore(d) {
  if (!d.globalScore) return '';
  const gs = d.globalScore;
  return `
      <div id="score" class="content-card">
        <h2><i class="fa-solid fa-star"></i> Global Score</h2>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <span style="background:${gradeColor(d.meta.grade)};color:#fff;padding:0.5rem 1.2rem;border-radius:10px;font-weight:800;font-size:1.5rem;">${d.meta.grade}</span>
          <span class="badge badge-purple">${esc(gs.profile || '')}</span>
          <span class="badge badge-${d.verdict.bias === 'Bullish' ? 'green' : d.verdict.bias === 'Bearish' ? 'red' : 'blue'}">${d.verdict.bias}</span>
        </div>
${gs.keyTakeawaysPositive && gs.keyTakeawaysPositive.length ? `        <div style="background:#f0fdf4;border:1px solid #86efac;padding:1rem;border-radius:10px;margin-bottom:1rem;"><h4 style="color:#16a34a;margin:0 0 0.5rem;">Key Takeaways &mdash; Positive</h4><ul style="margin:0;padding-left:1.2rem;">${gs.keyTakeawaysPositive.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
${gs.keyTakeawaysNegative && gs.keyTakeawaysNegative.length ? `        <div style="background:#fef2f2;border:1px solid #fecaca;padding:1rem;border-radius:10px;margin-bottom:1rem;"><h4 style="color:#dc2626;margin:0 0 0.5rem;">Key Takeaways &mdash; Risks</h4><ul style="margin:0;padding-left:1.2rem;">${gs.keyTakeawaysNegative.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
${gs.mindsetTip ? `        <div class="pedagogy-box"><h4><i class="fa-solid fa-brain"></i> Mindset Tip</h4><p>${esc(gs.mindsetTip)}</p></div>` : ''}
      </div>`;
}

function renderDisclaimer() {
  return `
      <div id="disclaimer" class="content-card">
        <h2><i class="fa-solid fa-triangle-exclamation"></i> Disclaimer</h2>
        <div class="disclaimer-mega">
          <p>This analysis is provided for <strong>informational and educational purposes only</strong>. It does not constitute financial advice, investment recommendation, or solicitation to buy or sell any security.</p>
          <p>Past performance is not indicative of future results. All investments involve risk, including the possible loss of principal. Always conduct your own research and consult a licensed financial advisor before making investment decisions.</p>
          <p>Data comes from point-in-time market snapshots, company filings, Yahoo Finance, SEC EDGAR, and public market data. Accuracy is not guaranteed.</p>
        </div>
      </div>`;
}

function renderFab(d) {
  const items = [
    d.verdict           && { id: 'verdict',      icon: 'fa-gavel',                    label: 'Verdict' },
    d.business          && { id: 'business',      icon: 'fa-building',                 label: 'Business' },
    d.news && d.news.length && { id: 'news',      icon: 'fa-newspaper',                label: 'News' },
    d.fundamentals      && { id: 'fondamentaux',  icon: 'fa-chart-line',               label: 'Fundamentals' },
    d.earnings && d.earnings.quarters && d.earnings.quarters.length && { id: 'earnings', icon: 'fa-chart-bar', label: 'Earnings' },
    d.insiders          && { id: 'insiders',      icon: 'fa-user-tie',                 label: 'Insiders' },
    d.capitalStructure  && { id: 'capital',       icon: 'fa-money-bill-trend-up',      label: 'Capital' },
    d.filingsReview     && { id: 'filings',       icon: 'fa-file-shield',               label: 'SEC Review' },
    d.technicals        && { id: 'technique',     icon: 'fa-chart-area',               label: 'Technical' },
    d.performance       && { id: 'performance',   icon: 'fa-trophy',                   label: 'Perf' },
    d.forecast          && { id: 'forecast',      icon: 'fa-chart-line',               label: 'Forecast' },
    d.sectorComparison  && d.sectorComparison.peers && { id: 'peers', icon: 'fa-building', label: 'Sector' },
    d.risks             && { id: 'risques',       icon: 'fa-shield-halved',            label: 'Risks' },
    d.social && d.social.platforms && { id: 'social', icon: 'fa-satellite-dish',       label: 'Social' },
    d.bottomEstimation  && { id: 'bottom-estimation', icon: 'fa-bullseye',            label: 'Bottom' },
    d.manipulations     && { id: 'manipulations', icon: 'fa-magnifying-glass-dollar',  label: 'Integrity' },
    d.capitalFlow       && { id: 'capitalflow',   icon: 'fa-water',                    label: 'Flow' },
    d.predictionMarkets && d.predictionMarkets.markets && { id: 'predictions', icon: 'fa-chart-pie', label: 'Predict' },
    d.tradeIdea         && { id: 'trade',         icon: 'fa-crosshairs',               label: 'Trade' },
    d.globalScore       && { id: 'score',         icon: 'fa-star',                     label: 'Score' },
  ].filter(Boolean);
  return `
    <div class="fnav" id="floatingNav">
      <div class="fnav-menu" id="fnavMenu">
${items.map(s => `        <a href="#${s.id}" class="fnav-item" data-section="${s.id}"><i class="fas ${s.icon}"></i><span>${s.label}</span></a>`).join('\n')}
      </div>
      <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button>
    </div>`;
}

function renderModals(d) {
  const t = d.header.ticker;
  const archives = d.archiveHistory || [];
  return `
    <div id="chartModal" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.95);z-index:1000;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)this.style.display='none'">
      <div style="max-width:1000px;width:100%;text-align:center;">
        <img src="https://charts2.finviz.com/chart.ashx?t=${t}&ty=c&ta=1&p=d&s=l" alt="${t}" style="width:100%;border-radius:12px;margin-bottom:1rem;">
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a href="https://finviz.com/quote.ashx?t=${t}" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Finviz</a>
          <a href="https://www.tradingview.com/chart/?symbol=${t}" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> TradingView</a>
          <a href="https://finance.yahoo.com/quote/${t}/" target="_blank" rel="noopener" style="color:#60a5fa;font-size:0.85rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Yahoo Finance</a>
        </div>
        <button onclick="document.getElementById('chartModal').style.display='none'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;">&times;</button>
      </div>
    </div>
    <div id="historyModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;" onclick="if(event.target===this)this.style.display='none'">
      <div style="background:white;border-radius:16px;padding:2rem;max-width:420px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;"><h3 style="margin:0;font-size:1.2rem;">History &mdash; ${t}</h3><button onclick="document.getElementById('historyModal').style.display='none'" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button></div>
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div style="display:flex;align-items:center;gap:1rem;padding:0.75rem 1rem;border:1px solid #22c55e;border-radius:10px;background:#f0fdf4;"><div style="width:40px;height:40px;border-radius:8px;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-star" style="color:#22c55e;"></i></div><div><div style="font-weight:600;font-size:0.9rem;">${esc(d.meta.dateDisplay || d.meta.date)} <span style="background:#22c55e;color:white;font-size:0.65rem;padding:2px 6px;border-radius:4px;margin-left:6px;">CURRENT</span></div><div style="font-size:0.75rem;color:#64748b;">${t} Analysis (${d.meta.grade})</div></div></div>
${archives.map(a => `          <a href="archive/${String(a.date).replace(/-/g, '')}/" style="display:flex;align-items:center;gap:1rem;padding:0.75rem 1rem;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#0f172a;"><div style="width:40px;height:40px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-file-lines" style="color:#64748b;"></i></div><div><div style="font-weight:600;font-size:0.9rem;">${esc(a.dateDisplay || a.date)}</div><div style="font-size:0.75rem;color:#64748b;">${esc(a.note || 'Previous version')}${a.grade ? ` (${a.grade})` : ''}</div></div></a>`).join('\n')}
        </div>
      </div>
    </div>`;
}

function renderFooter() {
  return `
    <footer class="article-footer">
      &copy; 2026 DailyTickers. Data via institutional market data feeds. Not financial advice.
      <br><a href="/" title="Home"><i class="fas fa-house"></i></a>
    </footer>`;
}

// Les deux radars lisaient des clés codées en dur : toute fiche nommant ses axes
// autrement retombait silencieusement sur ||0 (radar vide) ou ||50 (hexagone plat
// d'apparence normale). Les axes suivent désormais les clés de la fiche ; la table
// ci-dessous ne sert qu'à garder les libellés lisibles des clés historiques.
const RADAR_LABELS = {
  rsi: 'RSI', trend: 'Trend', volume: 'Volume', momentum: 'Momentum',
  volatility: 'Volatility', support: 'Support',
  dilution: 'Dilution', burnRate: 'Burn Rate', beta: 'Beta',
  shortInterest: 'Short Int.', insiderSelling: 'Insider Sell', macroRisk: 'Macro Risk'
};

function radarAxes(values, fallback) {
  const entries = Object.entries(values || {}).filter(([, v]) => Number.isFinite(Number(v)));
  if (!entries.length) return null;
  return {
    indicator: JSON.stringify(entries.map(([k]) => ({ name: RADAR_LABELS[k] || k, max: 100 }))),
    values: JSON.stringify(entries.map(([, v]) => Number(v)))
  };
}

function renderScripts(d) {
  const t = d.header.ticker;
  const chartId = t.replace(/[^a-zA-Z0-9]/g, '');
  const rv = (d.technicals && d.technicals.radarValues) || {};
  const techRadar = radarAxes(rv);
  const riskRadar = radarAxes(d.risks.riskRadarValues);
  return `
    <script>
    (function(){var el=document.getElementById('gaugeScore');if(!el)return;var c=echarts.init(el);c.setOption({series:[{type:'gauge',radius:'90%',axisLine:{lineStyle:{width:12,color:[[0.3,'#ef4444'],[0.5,'#f59e0b'],[0.7,'#3b82f6'],[1,'#22c55e']]}},pointer:{itemStyle:{color:'auto'}},axisTick:{distance:-12,length:6,lineStyle:{color:'#fff',width:1}},splitLine:{distance:-14,length:12,lineStyle:{color:'#fff',width:2}},axisLabel:{color:'auto',distance:16,fontSize:11},detail:{valueAnimation:true,formatter:'{value}',color:'auto',fontSize:28,fontWeight:800,offsetCenter:[0,'70%']},data:[{value:${d.verdict.score}}]}]});window.addEventListener('resize',function(){c.resize();});})();
${techRadar ? `    (function(){var el=document.getElementById('radarTech${chartId}');if(!el)return;var c=echarts.init(el);c.setOption({radar:{indicator:${techRadar.indicator},shape:'circle',splitArea:{areaStyle:{color:['rgba(59,130,246,0.02)','rgba(59,130,246,0.04)']}}},series:[{type:'radar',data:[{value:${techRadar.values},name:'${t}',areaStyle:{color:'rgba(59,130,246,0.15)'},lineStyle:{color:'#3b82f6'},itemStyle:{color:'#3b82f6'}}]}]});window.addEventListener('resize',function(){c.resize();});})();` : ''}
    (function(){var el=document.getElementById('riskGaugeChart');if(!el)return;var c=echarts.init(el);c.setOption({series:[{type:'gauge',radius:'90%',center:['50%','60%'],startAngle:200,endAngle:-20,min:0,max:10,axisLine:{lineStyle:{width:10,color:[[0.3,'#22c55e'],[0.5,'#3b82f6'],[0.7,'#f59e0b'],[1,'#ef4444']]}},pointer:{length:'60%',width:4,itemStyle:{color:'auto'}},axisTick:{show:false},splitLine:{show:false},axisLabel:{show:false},detail:{valueAnimation:true,formatter:'{value}/10',color:'auto',fontSize:16,fontWeight:800,offsetCenter:[0,'40%']},data:[{value:${d.risks.riskScore}}]}]});window.addEventListener('resize',function(){c.resize();});})();
${d.risks.riskRadarValues ? `    (function(){var el=document.getElementById('riskRadarChart');if(!el)return;var rr=${JSON.stringify(d.risks.riskRadarValues).replace(/<\//g, '<\\/')};var c=echarts.init(el);c.setOption({radar:{indicator:[{name:'Dilution',max:100},{name:'Burn Rate',max:100},{name:'Beta',max:100},{name:'Short Int.',max:100},{name:'Insider Sell',max:100},{name:'Macro Risk',max:100}],shape:'circle',splitArea:{areaStyle:{color:['rgba(239,68,68,0.02)','rgba(239,68,68,0.04)']}}},series:[{type:'radar',data:[{value:[rr.dilution||0,rr.burnRate||0,rr.beta||0,rr.shortInterest||0,rr.insiderSelling||0,rr.macroRisk||0],areaStyle:{color:'rgba(239,68,68,0.15)'},lineStyle:{color:'#ef4444'},itemStyle:{color:'#ef4444'}}]}]});window.addEventListener('resize',function(){c.resize();});})();` : ''}
    </script>
    <script>
    function openChartModal(){document.getElementById('chartModal').style.display='flex';}
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){['chartModal','historyModal'].forEach(function(id){var m=document.getElementById(id);if(m)m.style.display='none';});}});
    (function(){var btn=document.getElementById('fnavBtn'),menu=document.getElementById('fnavMenu'),open=false;if(!btn||!menu)return;btn.addEventListener('click',function(){open=!open;menu.classList.toggle('open',open);});menu.querySelectorAll('.fnav-item').forEach(function(a){a.addEventListener('click',function(){open=false;menu.classList.remove('open');});});var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var id=e.target.id;menu.querySelectorAll('.fnav-item').forEach(function(a){a.classList.toggle('active',a.getAttribute('data-section')===id);});}});},{threshold:0.3});document.querySelectorAll('[id]').forEach(function(el){if(menu.querySelector('[data-section="'+el.id+'"]'))obs.observe(el);});})();
    </script>
    <script src="/assets/core.js"></script>
    <script src="/assets/tag-renderer.js"></script>
    <script src="/assets/echarts-responsive.js"></script>`;
}

// ─── Main render pipeline ───────────────────────────────────────────────────

function render(data) {
  return [
    renderHead(data),
    renderBrandBar(),
    renderStatusBanner(data),
    renderHeader(data),
    '\n    <div class="container">',
    renderVerdict(data),
    renderBusiness(data),
    renderNews(data),
    renderFundamentals(data),
    renderEarnings(data),
    renderInsiders(data),
    renderCapitalStructure(data),
    renderFilingsReview(data),
    renderShortInterest(data),
    renderOptions(data),
    renderTechnicals(data),
    renderPerformance(data),
    renderForecast(data),
    renderSectorComparison(data),
    renderMacro(data),
    renderRisks(data),
    renderSocial(data),
    renderBottomEstimation(data),
    renderManipulations(data),
    renderCapitalFlow(data),
    renderPredictionMarkets(data),
    renderTradeIdea(data),
    renderGlobalScore(data),
    renderDisclaimer(),
    '\n    </div>',
    renderFab(data),
    renderModals(data),
    renderFooter(),
    renderScripts(data),
    '\n</body>\n</html>',
  ].filter(Boolean).join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const reRenderAll = args.includes('--re-render');

  let files;
  if (reRenderAll) {
    if (!fs.existsSync(DATA_DIR)) { console.error('No data dir:', DATA_DIR); process.exit(1); }
    files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => path.join(DATA_DIR, f));
  } else {
    files = args.filter(a => !a.startsWith('--'));
  }

  if (!files.length) {
    console.error('Usage: node tools/render-analysis.js <json-file> [--dry]');
    console.error('       node tools/render-analysis.js --re-render');
    process.exit(1);
  }

  let exitCode = 0;
  let rendered = 0;

  for (const file of files) {
    const absFile = path.resolve(file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(absFile, 'utf8'));
    } catch (e) {
      console.error(`[ERROR] ${file}: ${e.message}`);
      exitCode = 1;
      continue;
    }

    const errors = validate(data, SCHEMA);
    if (errors.length) {
      console.error(`[VALIDATION] ${file}:`);
      errors.forEach(e => console.error(`  - ${e}`));
      if (errors.some(e => e.includes('is required'))) { exitCode = 1; if (dryRun) continue; }
    }

    if (dryRun) {
      const ticker = data.header ? data.header.ticker : '?';
      const grade = data.meta ? data.meta.grade : '?';
      console.log(`[OK] ${file} — valid (${ticker}, grade ${grade})`);
      continue;
    }

    const html = render(data);
    const ticker = data.header.ticker;
    const outDir = path.join(ROOT, 'analyses', ticker);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'index.html');
    fs.writeFileSync(outPath, html, 'utf8');
    rendered++;

    const sizeKb = (Buffer.byteLength(html) / 1024).toFixed(1);
    console.log(`[RENDERED] ${ticker} -> analyses/${ticker}/index.html (${sizeKb}KB, grade ${data.meta.grade})`);
  }

  if (rendered) console.log(`\nDone: ${rendered} article(s) rendered.`);
  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = { render, validate, SCHEMA };
