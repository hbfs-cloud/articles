#!/usr/bin/env node
/**
 * migrate_astro.js — Conservative mass fix for all 400+ HTML articles.
 *
 * PHILOSOPHY: String-based regex fixes only. Never use DOM serialization
 * (which reformats HTML and breaks inline styles). Never remove inline CSS.
 *
 * What it fixes:
 *   1. Broken links (/articles/ prefix, external articles.market-watch.xyz)
 *   2. External logo URLs → /logo.svg
 *   3. Missing GTM tags (head script + body noscript)
 *   4. Missing/broken brand-bar (adds standard nav if missing)
 *   5. Duplicate brand-bars (removes extras)
 *   6. Duplicate footers (removes extras)
 *   7. Missing footer (adds standard footer)
 *   8. Footer standardization (inline style → class="article-footer")
 *   9. Missing data-tab attribute on <html>
 *  10. Missing core.js/tag-renderer.js script
 *  11. CSS path normalization (relative → absolute /assets/)
 *  12. Missing Font Awesome CDN
 *  13. Missing Inter font
 *  14. Missing meta charset/viewport
 *  15. FAB floating navigation menu (.fnav) injection
 *  16. Tags placement (article-clickable-tags in hero section)
 *
 * What it does NOT do (by design):
 *   - Remove or modify inline <style> blocks
 *   - Parse/serialize via jsdom (which reformats HTML)
 *   - Change any article content or design
 *
 * Usage:
 *   node tools/migrate_astro.js              # Dry-run (shows what would change)
 *   node tools/migrate_astro.js --apply      # Apply changes
 *   node tools/migrate_astro.js --report     # Validation report only
 *   node tools/migrate_astro.js --verbose    # Show per-file details
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLE_DIRS = ['weekly', 'daily', 'analyses', 'scanner', 'series', 'tech'];
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const REPORT_ONLY = process.argv.includes('--report');

const STANDARD_BRAND_BAR = `\n  <nav class="brand-bar">
    <div class="brand-bar-inner">
      <a href="/" class="brand-logo">
        <img src="/logo.svg" alt="" width="36" height="36">
        <span class="brand-title">MarketWatch</span>
      </a>
      <div class="brand-actions">
        <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
      </div>
    </div>
  </nav>\n`;

const STANDARD_FOOTER = `\n  <footer class="article-footer">
    &copy; 2026 Market Watch. Donn&eacute;es via MarketWatch Gateway.
    Ceci n'est pas un conseil financier.
    <br><a href="/" title="Accueil"><i class="fas fa-house" style="margin-right:4px;"></i></a>
  </footer>`;

const GTM_HEAD = `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>`;

const GTM_BODY = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

// Stats
const stats = { totalFiles: 0, fixed: 0, errors: 0, fixes: {}, warnings: [], byType: {} };
function incrFix(key) { stats.fixes[key] = (stats.fixes[key] || 0) + 1; }

// ─── File discovery ─────────────────────────────────────────────────
function findArticles() {
  const files = [];
  for (const dir of ARTICLE_DIRS) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) continue;
    walkDir(fullPath, files, dir);
  }
  return files;
}

function walkDir(dirPath, files, type) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'src'].includes(entry.name)) continue;
      walkDir(full, files, type);
    } else if (entry.name === 'index.html') {
      files.push({ path: full, type, relative: path.relative(ROOT, full) });
    }
  }
}

// ─── String-based fix functions (NO DOM serialization) ──────────────

function fixBrokenLinks(html) {
  const fixes = [];
  let out = html;

  // Fix /articles/ prefix
  if (/href="\/articles\//.test(out)) {
    out = out.replace(/href="\/articles\//g, 'href="/');
    fixes.push('links: removed /articles/ prefix');
  }

  // Fix external articles.market-watch.xyz URLs
  if (/href="https?:\/\/articles\.market-watch\.xyz\//.test(out)) {
    out = out.replace(/href="https?:\/\/articles\.market-watch\.xyz\//g, 'href="/');
    fixes.push('links: converted external articles URLs to relative');
  }

  return { html: out, fixes };
}

function fixLogoRefs(html) {
  const fixes = [];
  let out = html;

  if (/https?:\/\/(?:articles\.)?market-watch\.xyz\/logo\.svg/.test(out)) {
    out = out.replace(/https?:\/\/(?:articles\.)?market-watch\.xyz\/logo\.svg/g, '/logo.svg');
    fixes.push('logo: replaced external URL with /logo.svg');
  }

  return { html: out, fixes };
}

function fixGTM(html) {
  const fixes = [];
  let out = html;

  // Check head GTM
  if (!out.includes('GTM-T5Z595CW') || !/<head[\s\S]*?GTM-T5Z595CW[\s\S]*?<\/head>/i.test(out)) {
    // Only add if not already in <head>
    const headEnd = out.indexOf('</head>');
    if (headEnd !== -1 && !out.slice(0, headEnd).includes('GTM-T5Z595CW')) {
      out = out.slice(0, headEnd) + '    ' + GTM_HEAD + '\n    ' + out.slice(headEnd);
      fixes.push('gtm: injected GTM script in <head>');
    }
  }

  // Check body noscript GTM
  if (!/<body[\s\S]*?<noscript>[\s\S]*?GTM-T5Z595CW/i.test(out)) {
    const bodyStart = out.match(/<body[^>]*>/i);
    if (bodyStart) {
      const pos = bodyStart.index + bodyStart[0].length;
      out = out.slice(0, pos) + '\n    ' + GTM_BODY + out.slice(pos);
      fixes.push('gtm: injected GTM noscript in <body>');
    }
  }

  return { html: out, fixes };
}

function fixBrandBar(html) {
  const fixes = [];
  let out = html;

  // Count brand-bars (nav.brand-bar or div.brand-bar — exact class match, not brand-bar-inner)
  const brandBarMatches = out.match(/<(?:nav|div)\s[^>]*class="brand-bar"[^>]*>/gi) || [];

  if (brandBarMatches.length > 1) {
    // Duplicate brand-bars — keep only the first <nav class="brand-bar"> or the first occurrence
    let kept = false;
    out = out.replace(/<(?:nav|div)\s[^>]*class="[^"]*brand-bar[^"]*"[^>]*>[\s\S]*?<\/(?:nav|div)>/gi, (match) => {
      if (!kept) {
        kept = true;
        // If it's a <div>, convert to nav format
        if (match.startsWith('<div')) {
          fixes.push('brand-bar: removed duplicate (kept first)');
          return match; // Keep as-is for now
        }
        return match;
      }
      fixes.push('brand-bar: removed duplicate');
      return '';
    });
  } else if (brandBarMatches.length === 0) {
    // No brand-bar at all — add one after <body> or after GTM noscript
    const noscriptEnd = out.match(/<noscript>[\s\S]*?GTM[\s\S]*?<\/noscript>/i);
    if (noscriptEnd) {
      const pos = noscriptEnd.index + noscriptEnd[0].length;
      out = out.slice(0, pos) + STANDARD_BRAND_BAR + out.slice(pos);
    } else {
      const bodyMatch = out.match(/<body[^>]*>/i);
      if (bodyMatch) {
        const pos = bodyMatch.index + bodyMatch[0].length;
        out = out.slice(0, pos) + STANDARD_BRAND_BAR + out.slice(pos);
      }
    }
    fixes.push('brand-bar: injected missing nav');
  }

  return { html: out, fixes };
}

function fixDuplicateFooters(html) {
  const fixes = [];
  let out = html;

  // Count <footer> tags
  const footerMatches = out.match(/<footer\b[^>]*>/gi) || [];
  if (footerMatches.length > 1) {
    // Keep only the last footer (usually the correct one, closest to </body>)
    let count = 0;
    const total = footerMatches.length;
    out = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (match) => {
      count++;
      if (count < total) {
        fixes.push('footer: removed duplicate');
        return '';
      }
      return match;
    });
  } else if (footerMatches.length === 0) {
    // No footer — add before </body>
    const bodyEnd = out.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      out = out.slice(0, bodyEnd) + STANDARD_FOOTER + '\n' + out.slice(bodyEnd);
      fixes.push('footer: injected missing footer');
    }
  }

  return { html: out, fixes };
}

function fixDataTab(html, fileMeta) {
  const fixes = [];
  let out = html;

  if (!out.includes('data-tab=')) {
    const tabMap = { weekly: 'weekly', daily: 'daily', analyses: 'analyses', scanner: 'scanner', series: 'series', tech: 'tech' };
    const tab = tabMap[fileMeta.type] || 'analyses';
    out = out.replace(/<html\b([^>]*)>/i, (match, attrs) => {
      fixes.push(`data-attr: added data-tab="${tab}"`);
      return `<html${attrs} data-tab="${tab}">`;
    });
  }

  return { html: out, fixes };
}

function fixCSSPaths(html, fileMeta) {
  const fixes = [];
  let out = html;

  // Fix relative report.css / report-dark.css paths to absolute
  // Match: href="assets/report.css" or href="../assets/report.css" etc.
  const relativeCSS = /href="(?:\.\.\/)*assets\/(report(?:-dark)?\.css)"/g;
  if (relativeCSS.test(out)) {
    out = out.replace(/href="(?:\.\.\/)*assets\/(report(?:-dark)?\.css)"/g, 'href="/assets/$1"');
    fixes.push('css: normalized relative CSS path to absolute');
  }

  // Check if report CSS is present at all
  if (!out.includes('/assets/report.css') && !out.includes('/assets/report-dark.css')) {
    // Check for any report.css reference
    if (out.includes('report.css') || out.includes('report-dark.css')) {
      // Has some reference but not absolute — regex already handled
    } else {
      // No report CSS at all — add it
      const headEnd = out.indexOf('</head>');
      if (headEnd !== -1) {
        const cssFile = '/assets/report.css';
        out = out.slice(0, headEnd) + `    <link rel="stylesheet" href="${cssFile}">\n    ` + out.slice(headEnd);
        fixes.push(`css: added missing ${cssFile}`);
      }
    }
  }

  // Ensure Font Awesome
  if (!out.includes('font-awesome') && !out.includes('fontawesome')) {
    const headEnd = out.indexOf('</head>');
    if (headEnd !== -1) {
      out = out.slice(0, headEnd) + `    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n    ` + out.slice(headEnd);
      fixes.push('css: added missing Font Awesome');
    }
  }

  // Ensure Inter font
  if (!out.includes('fonts.googleapis.com') || !out.includes('Inter')) {
    const headEnd = out.indexOf('</head>');
    if (headEnd !== -1) {
      out = out.slice(0, headEnd) +
        `    <link rel="preconnect" href="https://fonts.googleapis.com">\n` +
        `    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
        `    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">\n    ` +
        out.slice(headEnd);
      fixes.push('css: added missing Inter font');
    }
  }

  return { html: out, fixes };
}

function fixMeta(html) {
  const fixes = [];
  let out = html;

  // Check charset
  if (!/<meta\s[^>]*charset/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (match) => {
      fixes.push('meta: added charset UTF-8');
      return match + '\n    <meta charset="UTF-8">';
    });
  }

  // Check viewport
  if (!/<meta\s[^>]*viewport/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (match) => {
      fixes.push('meta: added viewport');
      return match + '\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">';
    });
  }

  return { html: out, fixes };
}

function fixCoreScript(html) {
  const fixes = [];
  let out = html;

  // Check for core.js or tag-renderer.js
  if (!out.includes('core.js') && !out.includes('tag-renderer.js')) {
    const bodyEnd = out.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      out = out.slice(0, bodyEnd) + '    <script src="/assets/core.js"></script>\n' + out.slice(bodyEnd);
      fixes.push('script: added missing core.js');
    }
  }

  // Add echarts-responsive.js if page uses ECharts and doesn't have it yet
  if (out.includes('echarts.init') && !out.includes('echarts-responsive.js')) {
    const bodyEnd = out.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      out = out.slice(0, bodyEnd) + '    <script src="/assets/echarts-responsive.js"></script>\n' + out.slice(bodyEnd);
      fixes.push('script: added echarts-responsive.js');
    }
  }

  return { html: out, fixes };
}

// ─── Section ID → FAB icon/label mapping ────────────────────────────
// Each section ID maps to an icon class and display label for the FAB menu.
// IDs not in this map are skipped (chart containers, modals, utility IDs).
const SECTION_MAP = {
  // Daily / Weekly common sections
  alerte:          { icon: 'fas fa-bullhorn',        label: 'Flash Info' },
  alertes:         { icon: 'fas fa-bullhorn',        label: 'Alertes' },
  dashboard:       { icon: 'fas fa-tachometer-alt',  label: 'Dashboard' },
  recap:           { icon: 'fas fa-clipboard-list',  label: 'Récap' },
  agenda:          { icon: 'fas fa-calendar-alt',    label: 'Agenda' },
  us:              { icon: 'fas fa-flag-usa',        label: 'Marchés US' },
  europe:          { icon: 'fas fa-earth-europe',    label: 'Europe' },
  asia:            { icon: 'fas fa-earth-asia',      label: 'Asie' },
  crypto:          { icon: 'fab fa-bitcoin',         label: 'Crypto' },
  geo:             { icon: 'fas fa-globe',           label: 'Géopolitique' },
  geopolitique:    { icon: 'fas fa-globe',           label: 'Géopolitique' },
  sentiment:       { icon: 'fas fa-brain',           label: 'Sentiment' },
  formation:       { icon: 'fas fa-graduation-cap',  label: 'Formation' },
  trade:           { icon: 'fas fa-crosshairs',      label: 'Trade Idea' },
  trades:          { icon: 'fas fa-crosshairs',      label: 'Trades' },
  watch:           { icon: 'fas fa-eye',             label: 'À Surveiller' },
  metaux:          { icon: 'fas fa-coins',           label: 'Métaux' },
  explications:    { icon: 'fas fa-lightbulb',       label: 'Explications' },
  // Weekly specific
  synthese:        { icon: 'fas fa-chart-pie',       label: 'Synthèse' },
  'compte-rendu':  { icon: 'fas fa-file-alt',        label: 'Compte Rendu' },
  marches:         { icon: 'fas fa-chart-line',      label: 'Marchés' },
  rotation:        { icon: 'fas fa-arrows-rotate',   label: 'Rotation' },
  leaders:         { icon: 'fas fa-trophy',          label: 'Leaders' },
  risques:         { icon: 'fas fa-shield-halved',   label: 'Risques' },
  allocation:      { icon: 'fas fa-wallet',          label: 'Allocation' },
  calendrier:      { icon: 'fas fa-calendar-days',   label: 'Calendrier' },
  earnings:        { icon: 'fas fa-chart-bar',       label: 'Earnings' },
  outlook:         { icon: 'fas fa-binoculars',      label: 'Outlook' },
  // Ticker analyses
  verdict:         { icon: 'fas fa-gavel',           label: 'Verdict' },
  activite:        { icon: 'fas fa-briefcase',       label: 'Activité' },
  fondamentaux:    { icon: 'fas fa-calculator',      label: 'Fondamentaux' },
  technique:       { icon: 'fas fa-chart-line',      label: 'Technique' },
  news:            { icon: 'fas fa-newspaper',       label: 'News' },
  insiders:        { icon: 'fas fa-user-secret',     label: 'Insiders' },
  capital:         { icon: 'fas fa-building-columns', label: 'Capital' },
  short:           { icon: 'fas fa-arrow-down',      label: 'Short Interest' },
  options:         { icon: 'fas fa-layer-group',     label: 'Options' },
  secteur:         { icon: 'fas fa-industry',        label: 'Secteur' },
  macro:           { icon: 'fas fa-earth-americas',  label: 'Macro' },
  social:          { icon: 'fas fa-comments',        label: 'Social Radar' },
  tribunal:        { icon: 'fas fa-scale-balanced',  label: 'Tribunal' },
  // Scanner
  regime:          { icon: 'fas fa-gauge-high',      label: 'Régime' },
  'vue-ensemble':  { icon: 'fas fa-list',            label: 'Vue d\'Ensemble' },
  performance:     { icon: 'fas fa-chart-bar',       label: 'Performance' },
  methodo:         { icon: 'fas fa-flask',           label: 'Méthodologie' },
  disclaimer:      { icon: 'fas fa-info-circle',     label: 'Disclaimer' },
  // Series / Educational
  quiz:            { icon: 'fas fa-question-circle', label: 'Quiz' },
};

// IDs to always ignore (chart containers, modals, utility elements)
const IGNORE_ID_PATTERNS = [
  /chart$/i, /gauge$/i, /radar$/i, /pie$/i, /treemap$/i, /bar$/i, /spark$/i,
  /apex$/i, /^chart/i, /modal$/i, /^modal/i, /^histor/i,
  /^article-clickable/i, /^fnav/i, /^floating/i, /^chartBody$/i, /^chartTitle$/i,
  /^chartLinks$/i, /^chartModal$/i, /Line$/i,
];

function isChartOrUtilityId(id) {
  return IGNORE_ID_PATTERNS.some(pat => pat.test(id));
}

// ─── FAB Menu injection ─────────────────────────────────────────────

const FAB_JS = `<script>
(function() {
  var fab = document.getElementById('fnavBtn');
  var menu = document.getElementById('fnavMenu');
  var icon = document.getElementById('fnavIcon');
  var label = document.getElementById('fnavLabel');
  if (!fab || !menu) return;
  var items = menu.querySelectorAll('.fnav-item');
  var sections = [];
  var isOpen = false;

  items.forEach(function(item) {
    var id = item.getAttribute('data-section');
    var el = document.getElementById(id);
    if (el) sections.push({ id: id, el: el, item: item });
  });

  function toggle() {
    isOpen = !isOpen;
    menu.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
  }

  fab.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  document.addEventListener('click', function(e) {
    if (isOpen && !menu.contains(e.target) && !fab.contains(e.target)) toggle();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && isOpen) toggle(); });

  items.forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      var id = this.getAttribute('data-section');
      var target = document.getElementById(id);
      if (target) {
        var brandBar = document.querySelector('.brand-bar');
        var offset = (brandBar ? brandBar.offsetHeight : 56) + 20;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
      }
      if (isOpen) toggle();
    });
  });

  var currentActive = null;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var match = sections.find(function(s) { return s.el === entry.target; });
        if (match) {
          if (currentActive) currentActive.item.classList.remove('active');
          match.item.classList.add('active');
          currentActive = match;
          label.textContent = match.item.querySelector('span').textContent;
        }
      }
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });

  sections.forEach(function(s) { observer.observe(s.el); });
  if (sections.length > 0) {
    sections[0].item.classList.add('active');
    currentActive = sections[0];
    label.textContent = sections[0].item.querySelector('span').textContent;
  }
})();
</script>`;

function fixFabMenu(html) {
  const fixes = [];
  let out = html;

  // Skip if FAB menu already exists
  if (out.includes('id="floatingNav"') || out.includes('id="fnavBtn"') || out.includes('class="fnav"')) {
    return { html: out, fixes };
  }

  // Auto-detect section IDs from the HTML
  // Match: <div ... id="xxx" ...> or <section ... id="xxx" ...>
  // Also capture the content after to extract the <h2> title for unmapped IDs
  const idMatches = [...out.matchAll(/<(?:div|section)\b[^>]*\bid="([a-z][a-z0-9-]*)"[^>]*>([\s\S]{0,500})/gi)];
  const detectedSections = [];

  for (const m of idMatches) {
    const id = m[1];
    const contentAfter = m[2];
    if (isChartOrUtilityId(id)) continue;

    if (SECTION_MAP[id]) {
      detectedSections.push({ id, ...SECTION_MAP[id] });
    } else {
      // Fallback: extract label from first <h2> or <h3> in the content
      const headingMatch = contentAfter.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
      if (headingMatch) {
        // Strip HTML tags from the heading text
        let label = headingMatch[1].replace(/<[^>]+>/g, '').trim();
        // Truncate to 20 chars max
        if (label.length > 20) label = label.substring(0, 20).trim() + '…';
        if (label) {
          detectedSections.push({ id, icon: 'fas fa-bookmark', label });
        }
      }
    }
  }

  // Need at least 2 sections to make a FAB menu useful
  if (detectedSections.length < 2) {
    return { html: out, fixes };
  }

  // Deduplicate (same id could appear multiple times)
  const seen = new Set();
  const uniqueSections = detectedSections.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // Build the FAB HTML
  const menuItems = uniqueSections.map(s =>
    `<a href="#${s.id}" class="fnav-item" data-section="${s.id}"><i class="${s.icon}"></i><span>${s.label}</span></a>`
  ).join('');

  const fabHtml = `\n<div class="fnav" id="floatingNav">` +
    `<div class="fnav-menu" id="fnavMenu">${menuItems}</div>` +
    `<button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">` +
    `<i class="fas fa-bars" id="fnavIcon"></i>` +
    `<span class="fnav-btn-label" id="fnavLabel">Menu</span>` +
    `</button></div>\n${FAB_JS}\n`;

  // Find injection point: after hero-section closing, or after brand-bar, or after first content
  // Best: after the hero section (before the first content-card / container)
  // Strategy: inject before the first <div class="container"> that contains content-cards
  //   or before the first <div class="content-card" id="...">
  //   or before </body>

  // Look for the end of hero-section
  const heroEnd = out.match(/<\/section>\s*(?=\s*<(?:div|section)\b[^>]*(?:class="[^"]*content-card|class="[^"]*container|id="(?:alerte|dashboard|regime|verdict|synthese)))/i);
  if (heroEnd) {
    const pos = heroEnd.index + heroEnd[0].length;
    out = out.slice(0, pos) + fabHtml + out.slice(pos);
  } else {
    // Fallback: look for first content-card with a navigable id
    const firstSection = out.match(/<(?:div|section)\b[^>]*\bclass="[^"]*content-card[^"]*"[^>]*\bid="[a-z]/i);
    if (firstSection) {
      out = out.slice(0, firstSection.index) + fabHtml + out.slice(firstSection.index);
    } else {
      // Last fallback: before </body>
      const bodyEnd = out.lastIndexOf('</body>');
      if (bodyEnd !== -1) {
        out = out.slice(0, bodyEnd) + fabHtml + out.slice(bodyEnd);
      }
    }
  }

  fixes.push(`fab: injected FAB menu with ${uniqueSections.length} sections (${uniqueSections.map(s => s.id).join(', ')})`);
  return { html: out, fixes };
}

// ─── Footer standardization ─────────────────────────────────────────

function fixFooterStandard(html) {
  const fixes = [];
  let out = html;

  // Replace non-standard footers with the standard class-based one
  // Match: <footer style="...">...</footer> OR <footer class="footer-bar|site-footer|...">
  // (but NOT <footer class="article-footer">)
  const footerMatch = out.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch && !footerMatch[0].includes('class="article-footer"')) {
    out = out.replace(footerMatch[0], STANDARD_FOOTER);
    fixes.push('footer: replaced non-standard footer with article-footer');
  }

  return { html: out, fixes };
}

// ─── Tags placement ─────────────────────────────────────────────────

function fixTagsPlacement(html) {
  const fixes = [];
  let out = html;

  // If article-clickable-tags already exists, ensure correct positioning & styles
  // (regardless of data-tags — normalize centering even for older articles)
  if (out.includes('id="article-clickable-tags"')) {
    const tagsMatch = out.match(/<div\s+id="article-clickable-tags"[^>]*><\/div>/i);
    if (tagsMatch) {
      const tagsPos = tagsMatch.index;
      const tagsHtml = tagsMatch[0];

      // Normalize: ensure centering styles on the opening tag
      // Target: style="margin-top:1.5rem; display:flex; justify-content:center;"
      let normalizedTags = tagsHtml;
      const hasStyle = /style="/.test(tagsHtml);
      const hasFlex = /display:\s*flex/.test(tagsHtml);
      const hasJustify = /justify-content/.test(tagsHtml);

      if (!hasStyle) {
        normalizedTags = tagsHtml.replace(/><\/div>$/, ' style="margin-top:1.5rem; display:flex; justify-content:center;"></div>');
        fixes.push('tags: added centering styles');
      } else if (!hasFlex && !hasJustify) {
        normalizedTags = tagsHtml.replace(/style="/, 'style="display:flex; justify-content:center; ');
        fixes.push('tags: added centering to existing styles');
      } else if (!hasFlex && hasJustify) {
        // Has justify-content but missing display:flex
        normalizedTags = tagsHtml.replace(/style="/, 'style="display:flex; ');
        fixes.push('tags: added display:flex');
      } else if (hasFlex && !hasJustify) {
        normalizedTags = tagsHtml.replace(/style="/, 'style="justify-content:center; ');
        fixes.push('tags: added justify-content:center');
      }

      // Determine correct position: inside hero-section, after hero-badges
      // Reference: HeroSection.astro puts tags after badges, inside the hero
      const heroOpen = out.match(/<(?:div|section|header)\s+class="[^"]*hero-section[^"]*"[^>]*>/i);
      if (heroOpen && out.includes('hero-badge')) {
        // Find the target: after the LAST hero-badge's container </div>
        let lastBadgeIdx = 0;
        for (const bm of out.matchAll(/class="hero-badge[\s"]/gi)) {
          lastBadgeIdx = bm.index;
        }

        if (lastBadgeIdx > 0) {
          // Find the </span> closing the last badge, then </div> closing the badges container
          const badgeSpanClose = out.indexOf('</span>', lastBadgeIdx);
          const badgesContainerClose = badgeSpanClose !== -1 ? out.indexOf('</div>', badgeSpanClose) : -1;
          const correctPos = badgesContainerClose !== -1 ? badgesContainerClose + 6 : -1;

          // Check if tags are already at the correct position (within 20 chars)
          if (correctPos > 0 && Math.abs(tagsPos - correctPos) > 20) {
            // Tags are in wrong position — move them
            out = out.replace(/\s*<div\s+id="article-clickable-tags"[^>]*><\/div>\s*/i, '\n');
            // Recalculate after removal
            let lastBadge2 = 0;
            for (const bm of out.matchAll(/class="hero-badge[\s"]/gi)) {
              lastBadge2 = bm.index;
            }
            const spanClose2 = out.indexOf('</span>', lastBadge2);
            const divClose2 = spanClose2 !== -1 ? out.indexOf('</div>', spanClose2) : -1;
            if (divClose2 !== -1) {
              const insertAt = divClose2 + 6;
              out = out.substring(0, insertAt) + '\n    ' + normalizedTags + out.substring(insertAt);
              fixes.push('tags: repositioned inside hero after badges');
            }
          } else if (normalizedTags !== tagsHtml) {
            // Position OK but styles need updating
            out = out.replace(tagsHtml, normalizedTags);
          }
        }
      } else if (normalizedTags !== tagsHtml) {
        // No hero-badges: just normalize styles in place
        out = out.replace(tagsHtml, normalizedTags);
      }
    }
    return { html: out, fixes };
  }

  // Only inject NEW tags container if data-tags attribute exists on <html>
  if (!out.includes('data-tags=')) {
    return { html: out, fixes };
  }

  // Need to inject the tags container. Best location: after hero-badges div, or end of hero-section
  const tagsDiv = `\n    <div id="article-clickable-tags" class="card-tags" style="margin-top:1.5rem; display:flex; justify-content:center;"></div>\n`;

  // Strategy 1: After hero-badges div
  if (out.includes('hero-badges')) {
    const badgesMatch = out.match(/class="[^"]*hero-badges[^"]*"[^>]*>[\s\S]*?<\/div>/i);
    if (badgesMatch) {
      const pos = badgesMatch.index + badgesMatch[0].length;
      out = out.slice(0, pos) + tagsDiv + out.slice(pos);
      fixes.push('tags: injected article-clickable-tags after hero-badges');
      return { html: out, fixes };
    }
  }

  // Strategy 2: Inside hero-section, after last badge or subtitle
  if (out.includes('hero-section') || out.includes('hero-title')) {
    // Find the hero-section or hero-title block and inject after hero-subtitle or last badge group
    const heroSubtitle = out.match(/class="hero-subtitle"[^>]*>[\s\S]*?<\/p>/i);
    if (heroSubtitle) {
      // Look for inline badge div after subtitle
      const afterSubtitle = out.substring(heroSubtitle.index + heroSubtitle[0].length);
      const inlineBadges = afterSubtitle.match(/^\s*<div\s+style="[^"]*display:\s*flex[^"]*"[^>]*>\s*(?:<span\s+class="badge[^"]*"[^>]*>[\s\S]*?<\/span>\s*)+<\/div>/i);
      if (inlineBadges) {
        const pos = heroSubtitle.index + heroSubtitle[0].length + inlineBadges.index + inlineBadges[0].length;
        out = out.slice(0, pos) + tagsDiv + out.slice(pos);
        fixes.push('tags: injected article-clickable-tags after inline badges in hero');
        return { html: out, fixes };
      }
      // No inline badges, inject after subtitle
      const pos = heroSubtitle.index + heroSubtitle[0].length;
      out = out.slice(0, pos) + tagsDiv + out.slice(pos);
      fixes.push('tags: injected article-clickable-tags after hero-subtitle');
      return { html: out, fixes };
    }
  }

  // Strategy 3: Inside ticker-header (analyses/scanner), after the ticker-metrics or badges
  if (out.includes('ticker-header')) {
    const tickerHeader = out.match(/class="ticker-header"[^>]*>/i);
    if (tickerHeader) {
      // Insert right after the opening of ticker-header
      const pos = tickerHeader.index + tickerHeader[0].length;
      out = out.slice(0, pos) + tagsDiv + out.slice(pos);
      fixes.push('tags: injected article-clickable-tags in ticker-header');
      return { html: out, fixes };
    }
  }

  // Strategy 4: Fallback — before first </section> or </div> after hero
  const heroSectionEnd = out.match(/<\/section>/i);
  if (heroSectionEnd) {
    const pos = heroSectionEnd.index;
    out = out.slice(0, pos) + tagsDiv + out.slice(pos);
    fixes.push('tags: injected article-clickable-tags before hero-section close');
  }

  return { html: out, fixes };
}

// ─── Remove nav-grid (replaced by FAB menu) ────────────────────────

function fixRemoveNavGrid(html) {
  const fixes = [];
  let out = html;

  // Only remove nav-grid if the FAB menu is present (or will be injected)
  if (!out.includes('class="nav-grid"')) {
    return { html: out, fixes };
  }

  // Remove the entire nav-grid block: <div class="nav-grid" ...>...nav-items...</div>
  // The nav-grid may have inline styles and the nav-items may also have styles
  const navGridRegex = /\s*<div\s[^>]*class="nav-grid"[^>]*>[\s\S]*?<\/div>\s*/gi;
  if (navGridRegex.test(out)) {
    // Reset lastIndex since we used .test()
    navGridRegex.lastIndex = 0;
    out = out.replace(navGridRegex, '\n');
    fixes.push('nav-grid: removed (replaced by FAB menu)');
  }

  return { html: out, fixes };
}

// ─── Fix alert-banner contrast ──────────────────────────────────────

function fixAlertBannerContrast(html) {
  const fixes = [];
  let out = html;

  // Find inline <style> blocks that define .alert-banner with a dark background
  // but don't have proper color inheritance for child elements.
  // The issue: inline CSS defines .alert-banner { background: #dc2626; color: white; }
  // but <strong> and <p> inside inherit from global CSS (.alert-banner-content h4 = #991b1b)
  // since these articles use a different structure (no .alert-banner-content wrapper).

  // Fix: If inline <style> has .alert-banner with dark bg + color:white,
  // add rules for child elements too
  const inlineStyleMatch = out.match(/<style>([\s\S]*?)<\/style>/i);
  if (!inlineStyleMatch) return { html: out, fixes };

  const styleContent = inlineStyleMatch[1];

  // Check if alert-banner has a dark gradient background (dc2626, 991b1b, etc.)
  const hasDarkAlertBanner = /\.alert-banner\s*\{[^}]*background:\s*linear-gradient[^}]*(?:#dc2626|#991b1b|#b91c1c|#7f1d1d|#ef4444)[^}]*color:\s*white/i.test(styleContent);

  if (hasDarkAlertBanner) {
    // Check if child color rules already exist
    if (!styleContent.includes('.alert-banner strong') && !styleContent.includes('.alert-banner p')) {
      // Add child element color rules
      const extraRules = `
        .alert-banner strong, .alert-banner p, .alert-banner div { color: white !important; }
        .alert-banner p { opacity: 0.9; }`;

      out = out.replace(inlineStyleMatch[0],
        `<style>${styleContent}${extraRules}\n    </style>`);
      fixes.push('contrast: added white text rules for dark alert-banner children');
    }
  }

  return { html: out, fixes };
}

// ─── Convert series-nav to series-bar ────────────────────────────────

function humanizeSlug(slug) {
  // Convert URL slug to a readable label: "macro-timing" → "Macro Timing"
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fixSeriesWizard(html) {
  const fixes = [];
  let out = html;

  // Check if this page has the old series-nav format
  if (!out.includes('class="series-nav"')) {
    return { html: out, fixes };
  }

  // Already has series-bar → skip
  if (out.includes('class="series-bar')) {
    return { html: out, fixes };
  }

  // Extract the series-nav block (can be <div> or <nav>)
  const navMatch = out.match(/<(?:div|nav)\s+class="series-nav">([\s\S]*?)<\/(?:div|nav)>/i);
  if (!navMatch) return { html: out, fixes };

  const navContent = navMatch[1];

  // Extract series title
  const titleMatch = navContent.match(/<span\s+class="series-title"[^>]*>([\s\S]*?)<\/span>/i);
  let seriesTitle = 'Series';
  if (titleMatch) {
    // Strip HTML tags and clean
    seriesTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Extract all links — handle both "1" and "1 — SEC Filings" formats
  const linkRegex = /<a\s+href="([^"]+)"\s+class="series-link([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  let m;
  let linkIdx = 0;
  while ((m = linkRegex.exec(navContent)) !== null) {
    linkIdx++;
    const href = m[1];
    const isCurrent = m[2].includes('current');
    const linkText = m[3].replace(/<[^>]+>/g, '').trim(); // Strip inner HTML

    // Extract number and label from text
    const numLabelMatch = linkText.match(/^(\d+)\s*(?:[.—–-]\s*(.+))?$/);
    const num = numLabelMatch ? numLabelMatch[1] : String(linkIdx);
    let label;
    if (numLabelMatch && numLabelMatch[2]) {
      label = numLabelMatch[2].trim();
    } else {
      // Fallback: extract from URL slug
      const parts = href.replace(/\/$/, '').split('/');
      const slug = parts[parts.length - 1];
      label = humanizeSlug(slug);
    }
    links.push({ href, isCurrent, num, label });
  }

  if (links.length < 2) return { html: out, fixes };

  // Find current index for arrows
  const currentIdx = links.findIndex(l => l.isCurrent);
  const prevLink = currentIdx > 0 ? links[currentIdx - 1] : null;
  const nextLink = currentIdx < links.length - 1 ? links[currentIdx + 1] : null;
  const currentNum = currentIdx >= 0 ? currentIdx + 1 : 1;

  // Build series-bar HTML
  const steps = links.map(l =>
    `<a href="${l.href}" class="series-step${l.isCurrent ? ' current' : ''}" title="${l.label}">` +
    `<span class="series-num">${l.num}</span>` +
    `<span class="series-label">${l.label}</span></a>`
  ).join('');

  const prevArrow = prevLink
    ? `<a href="${prevLink.href}" class="series-arrow" title="${prevLink.label}"><i class="fas fa-chevron-left"></i></a>`
    : `<span class="series-arrow disabled"><i class="fas fa-chevron-left"></i></span>`;

  const nextArrow = nextLink
    ? `<a href="${nextLink.href}" class="series-arrow" title="${nextLink.label}"><i class="fas fa-chevron-right"></i></a>`
    : `<span class="series-arrow disabled"><i class="fas fa-chevron-right"></i></span>`;

  const seriesBar = `<div class="series-bar">` +
    `<div class="series-bar-inner">` +
    `${prevArrow}` +
    `<span class="series-title">${seriesTitle}</span>` +
    `<div class="series-steps">${steps}</div>` +
    `<span class="series-counter">${currentNum}/${links.length}</span>` +
    `${nextArrow}` +
    `</div></div>`;

  // Remove old series-nav from its current position
  out = out.replace(navMatch[0], '');

  // Place series-bar AFTER the hero-section (matching Astro reference: Hero → SeriesBar → container)
  // Find the end of hero-section (can be <div> or <section>)
  let heroInsertPos = -1;
  const heroOpenMatch = out.match(/<(?:div|section|header)\s+class="[^"]*hero-section[^"]*"[^>]*>/i);
  if (heroOpenMatch) {
    // Count div/section depth to find the closing tag
    const heroStart = heroOpenMatch.index;
    const heroTagM = heroOpenMatch[0].match(/^<(\w+)/);
    const heroTag = heroTagM ? heroTagM[1] : 'div';
    let depth = 0;
    let sPos = heroStart;
    while (sPos < out.length) {
      const openRe = `<${heroTag}`;
      const closeRe = `</${heroTag}>`;
      const nOpen = out.indexOf(openRe, sPos + (depth === 0 ? 0 : 1));
      const nClose = out.indexOf(closeRe, sPos + (depth === 0 ? 0 : 1));
      if (nClose === -1) break;
      if (nOpen !== -1 && nOpen < nClose) {
        depth++;
        sPos = nOpen + openRe.length;
      } else {
        depth--;
        if (depth === 0) {
          heroInsertPos = nClose + closeRe.length;
          break;
        }
        sPos = nClose + closeRe.length;
      }
    }
  }

  if (heroInsertPos > 0) {
    out = out.substring(0, heroInsertPos) + '\n    ' + seriesBar + out.substring(heroInsertPos);
  } else {
    // Fallback: insert before <div class="container"> if no hero found
    const containerPos = out.indexOf('<div class="container"');
    if (containerPos > 0) {
      out = out.substring(0, containerPos) + seriesBar + '\n    ' + out.substring(containerPos);
    }
  }

  // Also remove the inline CSS definitions for .series-nav, .series-link (no longer needed)
  // These are in the global report.css now
  out = out.replace(/\s*\.series-nav\s*\{[^}]*\}\s*/g, ' ');
  out = out.replace(/\s*\.series-link\s*\{[^}]*\}\s*/g, ' ');
  out = out.replace(/\s*\.series-link:hover\s*\{[^}]*\}\s*/g, ' ');
  out = out.replace(/\s*\.series-link\.current\s*\{[^}]*\}\s*/g, ' ');
  // series-title inline is also redundant
  out = out.replace(/\s*\.series-title\s*\{[^}]*\}\s*/g, ' ');

  fixes.push(`series: converted series-nav to series-bar (${links.length} parts: ${seriesTitle})`);
  return { html: out, fixes };
}

// ─── Fix brand-bar to standard format ────────────────────────────────

function fixBrandBarFormat(html) {
  const fixes = [];
  let out = html;

  // Check if brand-bar uses the old format (with switcher-bar or MARKET WATCH text)
  if (!out.includes('class="switcher-bar"') && !out.includes('MARKET WATCH</a>')) {
    return { html: out, fixes };
  }

  // Already has brand-bar-inner → skip
  if (out.includes('brand-bar-inner')) {
    return { html: out, fixes };
  }

  // Replace the entire old brand-bar (nav or div) with the standard one
  const oldBrandBar = out.match(/<(nav|div)\s+class="brand-bar"[^>]*>[\s\S]*?<\/\1>/i);
  if (oldBrandBar) {
    out = out.replace(oldBrandBar[0], STANDARD_BRAND_BAR.trim());

    // Also remove inline CSS for old brand-bar components
    out = out.replace(/\s*\.brand-bar\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.brand-logo\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.brand-logo:hover\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.switcher-bar\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.switcher-btn\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.switcher-btn:hover\s*\{[^}]*\}\s*/g, ' ');
    out = out.replace(/\s*\.switcher-btn\.active\s*\{[^}]*\}\s*/g, ' ');

    fixes.push('brand-bar: converted old format to standard brand-bar-inner');
  }

  return { html: out, fixes };
}

// ─── Remove single-option article-switcher ──────────────────────────

function fixSingleVariantSwitcher(html) {
  const fixes = [];
  let out = html;

  if (!out.includes('class="article-switcher"')) {
    return { html: out, fixes };
  }

  // Extract the article-switcher block
  const switcherMatch = out.match(/<div\s+class="article-switcher">([\s\S]*?)<\/div>\s*<\/div>/i);
  if (!switcherMatch) return { html: out, fixes };

  const switcherContent = switcherMatch[0];

  // Count level tabs and lang flags
  const levelTabs = (switcherContent.match(/class="level-tab/gi) || []).length;
  const langFlags = (switcherContent.match(/class="lang-flag/gi) || []).length;

  // If only 1 level and 1 lang, remove the entire switcher
  if (levelTabs <= 1 && langFlags <= 1) {
    out = out.replace(switcherMatch[0], '');
    fixes.push('switcher: removed single-option article-switcher');
  }

  return { html: out, fixes };
}

// ─── Remove empty history modal (no archives) ───────────────────────

function fixEmptyHistoryModal(html) {
  const fixes = [];
  let out = html;

  if (!out.includes('historyModal')) {
    return { html: out, fixes };
  }

  // Check if the history modal has any archive links (href containing "archive/")
  const modalMatch = out.match(/<div\s+id="historyModal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
  if (!modalMatch) return { html: out, fixes };

  // Count archive links inside the modal
  const archiveLinks = (modalMatch[0].match(/href="[^"]*archive\//gi) || []).length;

  // If no archive links, remove the modal AND the history button
  if (archiveLinks === 0) {
    // Remove the modal
    out = out.replace(modalMatch[0], '');

    // Remove the history button (various formats)
    // Format 1: <button onclick="...historyModal..." ...>... Historique</button>
    out = out.replace(/\s*<button\s+onclick="[^"]*historyModal[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '');

    fixes.push('history: removed empty history modal and button (no archives)');
  }

  return { html: out, fixes };
}

// ─── Clean nav-grid/nav-item CSS from inline <style> ─────────────────

function fixNavGridInlineCSS(html) {
  const fixes = [];
  let out = html;

  // Only clean up if nav-grid HTML was removed (no nav-grid in the body)
  if (out.includes('class="nav-grid"')) {
    return { html: out, fixes };
  }

  // Remove inline CSS for .nav-grid, .nav-item, .nav-item:hover
  let cleaned = false;
  const navCssPatterns = [
    /\s*\.nav-grid\s*\{[^}]*\}\s*/g,
    /\s*\.nav-item\s*\{[^}]*\}\s*/g,
    /\s*\.nav-item:hover\s*\{[^}]*\}\s*/g,
  ];

  for (const pat of navCssPatterns) {
    if (pat.test(out)) {
      pat.lastIndex = 0;
      out = out.replace(pat, ' ');
      cleaned = true;
    }
  }

  if (cleaned) {
    fixes.push('css: removed orphaned .nav-grid/.nav-item inline CSS');
  }

  return { html: out, fixes };
}

// ─── Fix tags position in ticker-header ──────────────────────────────

function fixTagsInTickerHeader(html) {
  const fixes = [];
  let out = html;

  // Check if tags are at the START of ticker-header (wrong position)
  // Pattern: <div class="ticker-header"><div id="article-clickable-tags"...>
  const badPattern = /(<div\s+class="ticker-header"[^>]*>)\s*(<div\s+id="article-clickable-tags"[^>]*><\/div>)/i;
  const badMatch = out.match(badPattern);
  if (!badMatch) return { html: out, fixes };

  // Remove tags from the start
  const tagsDiv = badMatch[2];
  out = out.replace(badPattern, badMatch[1]);

  // Find the right position: after the last badge div or after article-switcher, before the date line
  // Strategy 1: After article-switcher
  const switcherEnd = out.match(/<\/div>\s*<\/div>\s*(?=\s*<div\s+style="[^"]*font-size:\s*0\.8rem[^"]*color:[^"]*#64748b)/i);
  if (switcherEnd) {
    const pos = switcherEnd.index + switcherEnd[0].length;
    out = out.slice(0, pos) + '\n        ' + tagsDiv + '\n' + out.slice(pos);
    fixes.push('tags: moved from start of ticker-header to after switcher');
    return { html: out, fixes };
  }

  // Strategy 2: After badges div (display:flex with badge spans)
  const badgesEnd = out.match(/<div\s+style="[^"]*display:\s*flex[^"]*"[^>]*>\s*(?:<span\s+class="badge[^"]*"[^>]*>[\s\S]*?<\/span>\s*)+<\/div>/i);
  if (badgesEnd) {
    const pos = badgesEnd.index + badgesEnd[0].length;
    out = out.slice(0, pos) + '\n        ' + tagsDiv + '\n' + out.slice(pos);
    fixes.push('tags: moved from start of ticker-header to after badges');
    return { html: out, fixes };
  }

  // Strategy 3: After ticker-metrics
  const metricsEnd = out.match(/<\/div>\s*(?=\s*<div\s+style="[^"]*display:\s*flex[^"]*gap[^"]*justify-content:\s*center)/i);
  if (metricsEnd) {
    const pos = metricsEnd.index + metricsEnd[0].length;
    out = out.slice(0, pos) + '\n        ' + tagsDiv + '\n' + out.slice(pos);
    fixes.push('tags: moved from start of ticker-header to after metrics');
    return { html: out, fixes };
  }

  // Strategy 4: Before the closing </div> of ticker-header (just above container/finviz/history)
  // Allow HTML comments between </div> and next element
  const tickerHeaderEnd = out.match(/(<\/div>)\s*(?=\s*(?:<!--[^>]*-->\s*)*(?:<!--\s*(?:FINVIZ|CHART|HISTORY)|<div\s+(?:id="historyModal"|class="container")))/i);
  if (tickerHeaderEnd) {
    const pos = tickerHeaderEnd.index;
    out = out.slice(0, pos) + '\n        ' + tagsDiv + '\n' + out.slice(pos);
    fixes.push('tags: moved from start of ticker-header to end');
    return { html: out, fixes };
  }

  // Fallback: put it back where it was (don't lose it)
  out = out.replace(/(<div\s+class="ticker-header"[^>]*>)/i, '$1\n        ' + tagsDiv);
  // No fix logged since we didn't actually move it
  return { html: out, fixes };
}

// ─── Fix tags splitting hero-badges ──────────────────────────────────

function fixTagsInsideHeroBadges(html) {
  const fixes = [];
  let out = html;

  // Check if both hero-badges and article-clickable-tags exist
  if (!out.includes('id="article-clickable-tags"') || !out.includes('hero-badges')) {
    return { html: out, fixes };
  }

  // Find the hero-badges opening tag
  const heroOpenMatch = out.match(/<div\s+class="[^"]*hero-badges[^"]*"[^>]*>/i);
  if (!heroOpenMatch) return { html: out, fixes };

  const heroOpenEnd = heroOpenMatch.index + heroOpenMatch[0].length;

  // Find the tags div
  const tagsMatch = out.match(/<div\s+id="article-clickable-tags"[^>]*><\/div>/i);
  if (!tagsMatch) return { html: out, fixes };

  const tagsPos = tagsMatch.index;

  // Tags must be after hero-badges opens
  if (tagsPos <= heroOpenEnd) return { html: out, fixes };

  // Check if there are hero-badge elements AFTER the tags div (meaning tags are inside, splitting)
  const afterTags = out.substring(tagsPos + tagsMatch[0].length, tagsPos + tagsMatch[0].length + 500);
  const hasBadgesAfter = /class="hero-badge"/.test(afterTags);

  if (!hasBadgesAfter) return { html: out, fixes };

  // Tags div is splitting the badges — remove it
  out = out.replace(/\s*<div\s+id="article-clickable-tags"[^>]*><\/div>\s*/i, '\n');

  // Now find the hero-badges closing: scan for all hero-badge/hero-badges matches
  // and find the closing </div> of the hero-badges container
  // Strategy: find the last "hero-badge" class, find its </div>, then find the NEXT </div> (container close)
  let lastBadgeIdx = 0;
  const allBadges = out.matchAll(/class="hero-badge"/gi);
  for (const bm of allBadges) {
    lastBadgeIdx = bm.index;
  }

  if (lastBadgeIdx > 0) {
    // From the last hero-badge, find the next </div> (closes that badge)
    const badgeClose = out.indexOf('</div>', lastBadgeIdx);
    if (badgeClose !== -1) {
      // Then find the next </div> (closes the hero-badges container)
      const containerClose = out.indexOf('</div>', badgeClose + 6);
      if (containerClose !== -1) {
        const insertPos = containerClose + 6; // '</div>'.length = 6
        const tagsHtml = `\n    <div id="article-clickable-tags" class="card-tags" style="margin-top:1.5rem; display:flex; justify-content:center;"></div>`;
        out = out.substring(0, insertPos) + tagsHtml + out.substring(insertPos);
        fixes.push('tags: moved from inside hero-badges to after (was splitting badges)');
      }
    }
  }

  return { html: out, fixes };
}

// ─── Add series-bar before footer (bottom wizard) ────────────────────

function fixSeriesBarPosition(html) {
  const fixes = [];
  let out = html;

  // Only apply to pages with a series-bar AND a hero-section
  if (!out.includes('class="series-bar') || !out.includes('hero-section')) {
    return { html: out, fixes };
  }

  // Find the first series-bar position and the hero-section position
  const firstSeriesBar = out.indexOf('<div class="series-bar');
  const heroMatch = out.match(/<(?:div|section|header)\s+class="[^"]*hero-section[^"]*"[^>]*>/i);
  if (!heroMatch || firstSeriesBar === -1) return { html: out, fixes };

  const heroStart = heroMatch.index;

  // If series-bar is BEFORE hero — it needs to be moved AFTER
  if (firstSeriesBar < heroStart) {
    // Extract the series-bar by counting div depth
    let depth = 0;
    let pos = firstSeriesBar;
    let seriesEnd = -1;
    while (pos < out.length) {
      const nextOpen = out.indexOf('<div', pos);
      const nextClose = out.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) { seriesEnd = nextClose + 6; break; }
        pos = nextClose + 6;
      }
    }
    if (seriesEnd === -1) return { html: out, fixes };

    const seriesBarHtml = out.substring(firstSeriesBar, seriesEnd);

    // Remove from current position
    out = out.substring(0, firstSeriesBar) + out.substring(seriesEnd);

    // Find end of hero-section (recalculate since positions shifted)
    const heroMatch2 = out.match(/<(?:div|section|header)\s+class="[^"]*hero-section[^"]*"[^>]*>/i);
    if (!heroMatch2) return { html: out, fixes };

    // Detect the actual tag name used (div, section, or header)
    const heroTagMatch = heroMatch2[0].match(/^<(\w+)/);
    const heroTag = heroTagMatch ? heroTagMatch[1] : 'div';
    let hDepth = 0;
    let hPos = heroMatch2.index;
    let heroEnd = -1;
    while (hPos < out.length) {
      const openTag = `<${heroTag}`;
      const closeTag = `</${heroTag}>`;
      const nOpen = out.indexOf(openTag, hPos + (hDepth === 0 ? 0 : 1));
      const nClose = out.indexOf(closeTag, hPos + (hDepth === 0 ? 0 : 1));
      if (nClose === -1) break;
      if (nOpen !== -1 && nOpen < nClose) {
        hDepth++;
        hPos = nOpen + openTag.length;
      } else {
        hDepth--;
        if (hDepth === 0) { heroEnd = nClose + closeTag.length; break; }
        hPos = nClose + closeTag.length;
      }
    }

    if (heroEnd > 0) {
      out = out.substring(0, heroEnd) + '\n    ' + seriesBarHtml + out.substring(heroEnd);
      fixes.push('series: moved series-bar from before hero to after hero');
    }
  }

  return { html: out, fixes };
}

function fixSeriesBarFooter(html) {
  const fixes = [];
  let out = html;

  // Only apply to pages that have a series-bar
  if (!out.includes('class="series-bar')) {
    return { html: out, fixes };
  }

  // If there's already a series-bar in the second half of the document, skip
  const midpoint = Math.floor(out.length / 2);
  const lastSeriesBar = out.lastIndexOf('class="series-bar');
  if (lastSeriesBar > midpoint) {
    return { html: out, fixes };
  }

  // Extract the series-bar line from the top — it's always a single line:
  // <div class="series-bar"><div class="series-bar-inner">...all steps...</div></div>
  // Strategy: find the opening <div class="series-bar, then find the matching closing
  // by counting <div and </div> tags on that same segment
  const seriesStart = out.indexOf('<div class="series-bar');
  if (seriesStart === -1) return { html: out, fixes };

  // Scan forward from seriesStart, counting div depth
  let depth = 0;
  let pos = seriesStart;
  let seriesEnd = -1;
  while (pos < out.length) {
    const nextOpen = out.indexOf('<div', pos);
    const nextClose = out.indexOf('</div>', pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4; // skip past '<div'
    } else {
      depth--;
      if (depth === 0) {
        seriesEnd = nextClose + 6; // '</div>'.length
        break;
      }
      pos = nextClose + 6;
    }
  }

  if (seriesEnd === -1) return { html: out, fixes };

  const seriesBarHtml = out.substring(seriesStart, seriesEnd);

  // Inject before footer
  const footerPos = out.lastIndexOf('<footer');
  if (footerPos !== -1) {
    out = out.slice(0, footerPos) + '\n    ' + seriesBarHtml + '\n' + out.slice(footerPos);
    fixes.push('series: added series-bar copy before footer');
  }

  return { html: out, fixes };
}

// ─── Fix old brand-bar without brand-bar-inner ──────────────────────

function fixOldBrandBarNoInner(html) {
  const fixes = [];
  let out = html;

  // Already has brand-bar-inner → fine
  if (out.includes('brand-bar-inner')) {
    return { html: out, fixes };
  }

  // Check if there's a brand-bar (nav or div) with old-style content (no brand-bar-inner wrapper)
  const oldNavMatch = out.match(/<(nav|div)\s+class="brand-bar"[^>]*>([\s\S]*?)<\/\1>/i);
  if (!oldNavMatch) return { html: out, fixes };

  // This element exists but doesn't have brand-bar-inner — replace it
  out = out.replace(oldNavMatch[0], STANDARD_BRAND_BAR.trim());

  // Clean up inline CSS for old brand-bar components
  out = out.replace(/\s*\.brand-bar\s*\{[^}]*\}\s*/g, ' ');
  out = out.replace(/\s*\.brand-logo\s*\{[^}]*\}\s*/g, ' ');
  out = out.replace(/\s*\.brand-logo:hover\s*\{[^}]*\}\s*/g, ' ');

  fixes.push('brand-bar: replaced old nav (no brand-bar-inner) with standard');
  return { html: out, fixes };
}

// ─── Clean up inline CSS for elements moved to report.css ────────────

function fixOrphanedInlineCSS(html) {
  const fixes = [];
  let out = html;

  // Clean up inline CSS for components now in report.css
  let cleaned = false;
  const orphanPatterns = [
    // hero-section, hero-date, hero-badges, hero-badge — only remove if they're just
    // duplicating what's in report.css (simple redefinitions)
    /\s*\.container\s*\{[^}]*max-width:\s*900px[^}]*\}\s*/g,
    /\s*\.content-card\s*\{[^}]*background:\s*white[^}]*border-radius:\s*16px[^}]*\}\s*/g,
    // h2 and h3 generic overrides — DON'T remove these as they may be theme-specific
  ];

  for (const pat of orphanPatterns) {
    if (pat.test(out)) {
      pat.lastIndex = 0;
      out = out.replace(pat, ' ');
      cleaned = true;
    }
  }

  if (cleaned) {
    fixes.push('css: removed duplicated inline CSS (already in report.css)');
  }

  return { html: out, fixes };
}

// ─── Main processing ────────────────────────────────────────────────

function processFile(fileMeta) {
  let html;
  try {
    html = fs.readFileSync(fileMeta.path, 'utf8');
  } catch (err) {
    stats.errors++;
    stats.warnings.push(`ERROR reading ${fileMeta.relative}: ${err.message}`);
    return;
  }

  stats.totalFiles++;
  stats.byType[fileMeta.type] = (stats.byType[fileMeta.type] || 0) + 1;

  const allFixes = [];
  let modified = html;

  // Apply string-based fixes in order
  const fixFns = [
    (h) => fixBrokenLinks(h),
    (h) => fixLogoRefs(h),
    (h) => fixGTM(h),
    (h) => fixBrandBar(h),
    (h) => fixFooterStandard(h),          // Standardize inline footers FIRST
    (h) => fixDuplicateFooters(h),        // Then handle duplicates/missing
    (h) => fixDataTab(h, fileMeta),
    (h) => fixCSSPaths(h, fileMeta),
    (h) => fixMeta(h),
    (h) => fixCoreScript(h),
    (h) => fixTagsPlacement(h),           // Inject/fix tags container (handles hero-badges splitting)
    (h) => fixTagsInTickerHeader(h),      // Move tags from start of ticker-header
    (h) => fixAlertBannerContrast(h),     // Fix dark alert-banner text contrast
    (h) => fixBrandBarFormat(h),          // Convert old brand-bar to standard
    (h) => fixOldBrandBarNoInner(h),      // Fix brand-bars without brand-bar-inner
    (h) => fixSeriesWizard(h),            // Convert series-nav to series-bar
    (h) => fixSeriesBarPosition(h),       // Move series-bar from before hero to after hero
    (h) => fixFabMenu(h),                 // Inject FAB nav menu
    (h) => fixRemoveNavGrid(h),           // Remove nav-grid (replaced by FAB)
    (h) => fixNavGridInlineCSS(h),        // Clean orphaned .nav-grid CSS
    (h) => fixSingleVariantSwitcher(h),   // Remove single-option switchers
    (h) => fixEmptyHistoryModal(h),       // Remove empty history modals
    (h) => fixSeriesBarFooter(h),         // Add series-bar copy before footer
  ];

  for (const fn of fixFns) {
    const result = fn(modified);
    modified = result.html;
    allFixes.push(...result.fixes);
  }

  if (allFixes.length > 0) {
    stats.fixed++;
    for (const f of allFixes) {
      const key = f.split(':')[0];
      incrFix(key);
    }

    if (VERBOSE || REPORT_ONLY) {
      console.log(`\n  ${fileMeta.relative} — ${allFixes.length} fix(es):`);
      for (const f of allFixes) {
        console.log(`    + ${f}`);
      }
    } else {
      process.stdout.write('.');
    }

    if (APPLY) {
      fs.writeFileSync(fileMeta.path, modified, 'utf8');
    }
  } else {
    if (VERBOSE) {
      console.log(`  ${fileMeta.relative} — OK`);
    } else if (!REPORT_ONLY) {
      process.stdout.write('·');
    }
  }
}

// ─── Validation ─────────────────────────────────────────────────────

function validateFile(fileMeta) {
  const issues = [];
  let html;
  try {
    html = fs.readFileSync(fileMeta.path, 'utf8');
  } catch (err) {
    return [{ severity: 'error', msg: `Cannot read file: ${err.message}` }];
  }

  // Critical checks
  if (!html.includes('GTM-T5Z595CW'))
    issues.push({ severity: 'error', msg: 'Missing GTM tag' });

  if (!html.includes('/assets/report.css') && !html.includes('/assets/report-dark.css'))
    issues.push({ severity: 'error', msg: 'Missing global CSS link' });

  if (html.includes('href="/articles/'))
    issues.push({ severity: 'error', msg: 'Broken /articles/ link prefix' });

  // Warnings
  if (!html.includes('font-awesome') && !html.includes('fontawesome'))
    issues.push({ severity: 'warn', msg: 'Missing Font Awesome' });

  if (!html.includes('Inter'))
    issues.push({ severity: 'warn', msg: 'Missing Inter font' });

  if (/https?:\/\/(?:articles\.)?market-watch\.xyz\/logo\.svg/.test(html))
    issues.push({ severity: 'warn', msg: 'External logo URL (should be /logo.svg)' });

  if (!html.includes('core.js') && !html.includes('tag-renderer.js'))
    issues.push({ severity: 'warn', msg: 'Missing core.js script' });

  if (!html.includes('<footer'))
    issues.push({ severity: 'warn', msg: 'Missing footer' });

  if (!html.includes('brand-bar'))
    issues.push({ severity: 'warn', msg: 'Missing brand bar' });

  if (!html.includes('data-tab='))
    issues.push({ severity: 'info', msg: 'Missing data-tab attribute' });

  // Check for duplicate brand-bars (match class="brand-bar" exactly, not brand-bar-inner)
  const brandBarCount = (html.match(/<(?:nav|div)\s[^>]*class="brand-bar"/gi) || []).length;
  if (brandBarCount > 1)
    issues.push({ severity: 'warn', msg: `Duplicate brand-bars (${brandBarCount})` });

  // Check for duplicate footers
  const footerCount = (html.match(/<footer\b/gi) || []).length;
  if (footerCount > 1)
    issues.push({ severity: 'warn', msg: `Duplicate footers (${footerCount})` });

  // Check FAB menu
  if (!html.includes('id="fnavBtn"') && !html.includes('class="fnav"'))
    issues.push({ severity: 'info', msg: 'Missing FAB navigation menu' });

  // Check inline footer (should use article-footer class)
  if (/<footer\b\s+style="/i.test(html) && !html.includes('class="article-footer"'))
    issues.push({ severity: 'info', msg: 'Footer uses inline styles instead of article-footer class' });

  // Check tags container
  if (html.includes('data-tags=') && !html.includes('id="article-clickable-tags"'))
    issues.push({ severity: 'info', msg: 'Has data-tags but missing article-clickable-tags container' });

  // Check for legacy nav-grid (should be removed, replaced by FAB)
  if (html.includes('class="nav-grid"') && html.includes('id="fnavBtn"'))
    issues.push({ severity: 'warn', msg: 'Has both nav-grid and FAB menu (nav-grid should be removed)' });

  return issues;
}

// ─── Report ─────────────────────────────────────────────────────────

function generateReport(articles) {
  console.log('\n\n' + '='.repeat(60));
  console.log('  MIGRATION REPORT');
  console.log('='.repeat(60));

  console.log(`\n  Total articles scanned: ${stats.totalFiles}`);
  console.log(`  Articles with fixes:    ${stats.fixed}`);
  console.log(`  Errors:                 ${stats.errors}`);
  console.log(`  Mode:                   ${APPLY ? 'APPLIED' : 'DRY-RUN'}`);

  console.log('\n  By type:');
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(12)} ${count} files`);
  }

  if (Object.keys(stats.fixes).length > 0) {
    console.log('\n  Fixes applied:');
    for (const [key, count] of Object.entries(stats.fixes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${key.padEnd(16)} ${count}`);
    }
  }

  if (stats.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const w of stats.warnings.slice(0, 20)) {
      console.log(`    ! ${w}`);
    }
    if (stats.warnings.length > 20) {
      console.log(`    ... and ${stats.warnings.length - 20} more`);
    }
  }

  // Validation pass
  console.log('\n' + '-'.repeat(60));
  console.log(`  VALIDATION ${APPLY ? '(post-fix)' : '(current state)'}`);
  console.log('-'.repeat(60));

  let errorCount = 0, warnCount = 0, infoCount = 0;
  const errorFiles = [], warnFiles = [];

  for (const article of articles) {
    const issues = validateFile(article);
    const errors = issues.filter(i => i.severity === 'error');
    const warns = issues.filter(i => i.severity === 'warn');
    const infos = issues.filter(i => i.severity === 'info');

    errorCount += errors.length;
    warnCount += warns.length;
    infoCount += infos.length;

    if (errors.length > 0) errorFiles.push({ file: article.relative, errors });
    if (warns.length > 0) warnFiles.push({ file: article.relative, warns });
  }

  if (errorFiles.length > 0) {
    console.log(`\n  ERRORS (${errorFiles.length} files):`);
    for (const { file, errors } of errorFiles.slice(0, 30)) {
      console.log(`    X ${file}`);
      for (const e of errors) console.log(`      ${e.msg}`);
    }
    if (errorFiles.length > 30) console.log(`    ... and ${errorFiles.length - 30} more`);
  }

  if (VERBOSE && warnFiles.length > 0) {
    console.log(`\n  WARNINGS (${warnFiles.length} files):`);
    for (const { file, warns } of warnFiles.slice(0, 20)) {
      console.log(`    ? ${file}`);
      for (const w of warns) console.log(`      ${w.msg}`);
    }
  }

  const passRate = stats.totalFiles > 0
    ? (((stats.totalFiles - errorFiles.length) / stats.totalFiles) * 100).toFixed(1) : 0;

  console.log(`\n  Results: ${errorCount} errors, ${warnCount} warnings, ${infoCount} infos`);
  console.log(`  Pass rate (no errors): ${passRate}% (${stats.totalFiles - errorFiles.length}/${stats.totalFiles})`);
  console.log('='.repeat(60));

  if (!APPLY && stats.fixed > 0) {
    console.log(`\n  Run with --apply to write changes to disk.`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  console.log('\n  Market Watch — Article Fixer (v3 — FAB + footer + tags)');
  console.log('  ' + '-'.repeat(45));
  console.log(`  Mode: ${APPLY ? 'APPLY' : REPORT_ONLY ? 'REPORT' : 'DRY-RUN'}`);
  console.log(`  Dirs: ${ARTICLE_DIRS.join(', ')}\n`);

  const articles = findArticles();
  console.log(`  Found ${articles.length} HTML articles.\n`);

  if (!REPORT_ONLY) {
    console.log('  Processing...');
    for (const article of articles) {
      processFile(article);
    }
  } else {
    // Still count files for report
    for (const article of articles) {
      stats.totalFiles++;
      stats.byType[article.type] = (stats.byType[article.type] || 0) + 1;
    }
  }

  generateReport(articles);
}

main();
