// assets/core.js

// Tag metadata with multi-language support
// Keys are used for filtering (?tags=key), labels are displayed to the user
const tagMeta = {
    // Region (cat: "region")
    us: { labels: { fr: "US", en: "US", ar: "أمريكا" }, cat: "region" },
    eu: { labels: { fr: "Europe", en: "Europe", ar: "أوروبا" }, cat: "region" },
    asia: { labels: { fr: "Asie", en: "Asia", ar: "آسيا" }, cat: "region" },
    crypto: { labels: { fr: "Crypto", en: "Crypto", ar: "كريبتو" }, cat: "region" },
    commodity: { labels: { fr: "Matières Premières", en: "Commodities", ar: "سلع" }, cat: "region" },
    forex: { labels: { fr: "Forex", en: "Forex", ar: "فوركس" }, cat: "region" },
    etf: { labels: { fr: "ETF", en: "ETF", ar: "صناديق" }, cat: "region" },
    em: { labels: { fr: "Marchés Émergents", en: "Emerging Markets", ar: "أسواق ناشئة" }, cat: "region" },

    // Sector (cat: "sector")
    tech: { labels: { fr: "Technologie", en: "Tech", ar: "تكنولوجيا" }, cat: "sector" },
    semis: { labels: { fr: "Semi-conducteurs", en: "Semis", ar: "أشباه الموصلات" }, cat: "sector" },
    healthcare: { labels: { fr: "Santé", en: "Healthcare", ar: "الرعاية الصحية" }, cat: "sector" },
    energy: { labels: { fr: "Énergie", en: "Energy", ar: "طاقة" }, cat: "sector" },
    financials: { labels: { fr: "Finance", en: "Financials", ar: "مالية" }, cat: "sector" },
    industrials: { labels: { fr: "Industrie", en: "Industrials", ar: "صناعة" }, cat: "sector" },
    materials: { labels: { fr: "Matériaux", en: "Materials", ar: "مواد" }, cat: "sector" },
    consumer: { labels: { fr: "Consommation", en: "Consumer", ar: "استهلاك" }, cat: "sector" },
    defense: { labels: { fr: "Défense", en: "Defense", ar: "دفاع" }, cat: "sector" },
    software: { labels: { fr: "Logiciel", en: "Software", ar: "برمجيات" }, cat: "sector" },
    gold: { labels: { fr: "Or", en: "Gold", ar: "ذهب" }, cat: "sector" },
    mining: { labels: { fr: "Mines", en: "Mining", ar: "تعدين" }, cat: "sector" },
    agriculture: { labels: { fr: "Agriculture", en: "Agriculture", ar: "زراعة" }, cat: "sector" },
    biotech: { labels: { fr: "Biotech", en: "Biotech", ar: "تقنية حيوية" }, cat: "sector" },
    comms: { labels: { fr: "Communications", en: "Comms", ar: "اتصالات" }, cat: "sector" },
    staples: { labels: { fr: "Consommation de Base", en: "Staples", ar: "سلع أساسية" }, cat: "sector" },
    utilities: { labels: { fr: "Services Publics", en: "Utilities", ar: "مرافق" }, cat: "sector" },
    quantum: { labels: { fr: "Quantique", en: "Quantum", ar: "كم" }, cat: "sector" },
    airlines: { labels: { fr: "Compagnies Aériennes", en: "Airlines", ar: "طيران" }, cat: "sector" },
    coal: { labels: { fr: "Charbon", en: "Coal", ar: "فحم" }, cat: "sector" },
    lng: { labels: { fr: "GNL", en: "LNG", ar: "غاز طبيعي مسال" }, cat: "sector" },
    oil: { labels: { fr: "Pétrole", en: "Oil", ar: "نفط" }, cat: "sector" },
    refining: { labels: { fr: "Raffinage", en: "Refining", ar: "تكرير" }, cat: "sector" },

    // Theme (cat: "theme")
    ai: { labels: { fr: "IA", en: "AI", ar: "ذكاء اصطناعي" }, cat: "theme" },
    earnings: { labels: { fr: "Résultats", en: "Earnings", ar: "أرباح" }, cat: "theme" },
    geopolitique: { labels: { fr: "Géopolitique", en: "Geopolitics", ar: "جيوسياسة" }, cat: "theme" },
    macro: { labels: { fr: "Macro", en: "Macro", ar: "ماكرو" }, cat: "theme" },
    technique: { labels: { fr: "Technique", en: "Technical", ar: "تقني" }, cat: "theme" },
    options: { labels: { fr: "Options", en: "Options", ar: "خيارات" }, cat: "theme" },
    dividende: { labels: { fr: "Dividende", en: "Dividend", ar: "توزيعات" }, cat: "theme" },
    "small-cap": { labels: { fr: "Small Cap", en: "Small Cap", ar: "شركات صغيرة" }, cat: "theme" },
    speculative: { labels: { fr: "Spéculatif", en: "Speculative", ar: "مضاربة" }, cat: "theme" },
    momentum: { labels: { fr: "Momentum", en: "Momentum", ar: "زخم" }, cat: "theme" },
    defensive: { labels: { fr: "Défensif", en: "Defensive", ar: "دفاعي" }, cat: "theme" },
    value: { labels: { fr: "Value", en: "Value", ar: "قيمة" }, cat: "theme" },
    "short-squeeze": { labels: { fr: "Short Squeeze", en: "Short Squeeze", ar: "ضغط المكشوف" }, cat: "theme" },
    "penny-stocks": { labels: { fr: "Penny Stocks", en: "Penny Stocks", ar: "أسهم رخيصة" }, cat: "theme" },
    debutant: { labels: { fr: "Débutant", en: "Beginner", ar: "مبتدئ" }, cat: "theme" },
    education: { labels: { fr: "Éducation", en: "Education", ar: "تعليم" }, cat: "theme" },
    societe: { labels: { fr: "Société", en: "Society", ar: "مجتمع" }, cat: "theme" },
    securite: { labels: { fr: "Sécurité", en: "Security", ar: "أمن" }, cat: "theme" },
    architecture: { labels: { fr: "Architecture", en: "Architecture", ar: "هندسة" }, cat: "theme" },
    sql: { labels: { fr: "SQL", en: "SQL", ar: "SQL" }, cat: "theme" },
    snowflake: { labels: { fr: "Snowflake", en: "Snowflake", ar: "Snowflake" }, cat: "theme" },
    singer: { labels: { fr: "Singer", en: "Singer", ar: "Singer" }, cat: "theme" },
    opensource: { labels: { fr: "Open-Source", en: "Open-Source", ar: "مصدر مفتوح" }, cat: "theme" },
    automation: { labels: { fr: "Automatisation", en: "Automation", ar: "أتمتة" }, cat: "theme" },
    breakout: { labels: { fr: "Cassure", en: "Breakout", ar: "اختراق" }, cat: "theme" },
    data: { labels: { fr: "Données", en: "Data", ar: "بيانات" }, cat: "theme" },
    "gene-therapy": { labels: { fr: "Thérapie Génique", en: "Gene Therapy", ar: "علاج جيني" }, cat: "theme" },
    glp1: { labels: { fr: "GLP-1", en: "GLP-1", ar: "GLP-1" }, cat: "theme" },
    inflation: { labels: { fr: "Inflation", en: "Inflation", ar: "تضخم" }, cat: "theme" },
    mash: { labels: { fr: "MASH", en: "MASH", ar: "MASH" }, cat: "theme" },
    obesity: { labels: { fr: "Obésité", en: "Obesity", ar: "سمنة" }, cat: "theme" },
    trading: { labels: { fr: "Trading", en: "Trading", ar: "تداول" }, cat: "theme" },

    // Special (cat: "special")
    "special-edition": { labels: { fr: "Édition Spéciale", en: "Special Edition", ar: "إصدار خاص" }, cat: "special" },

    // Content (cat: "content")
    "trade-idea": { labels: { fr: "Idée de Trade", en: "Trade Idea", ar: "فكرة تداول" }, cat: "content" },
    formation: { labels: { fr: "Formation", en: "Learning", ar: "تدريب" }, cat: "content" },
    retrospective: { labels: { fr: "Rétrospective", en: "Retrospective", ar: "مراجعة" }, cat: "content" },
    scanner: { labels: { fr: "Scanner", en: "Scanner", ar: "ماسح" }, cat: "content" },
};

/**
 * Renders clickable tags into a container with multi-language support.
 */
function renderClickableTags(tagsString, targetElementId, defaultTab = "analyses") {
    const tagsContainer = document.getElementById(targetElementId);
    if (!tagsContainer || !tagsString) return;

    // Detect language from <html> tag, default to English
    const lang = document.documentElement.lang || "en";
    
    tagsContainer.innerHTML = '';

    const tags = tagsString.split(",").map(t => t.trim()).filter(Boolean);
    tags.forEach(function(t) {
        // Fallback : un tag hors registre rend une chip neutre (cat theme) au lieu
        // de disparaître silencieusement — la taxonomie évolue plus vite que tagMeta.
        const meta = tagMeta[t] || { cat: "theme", labels: { en: t } };
        if (meta) {
            const chip = document.createElement("span");
            chip.className = "card-tag";
            chip.setAttribute("data-cat", meta.cat);
            
            // Get translated label, fallback to English then key
            const label = meta.labels[lang] || meta.labels["en"] || t;
            chip.textContent = label;
            
            chip.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = '/?tags=' + t + '&explore=tags';
            };
            tagsContainer.appendChild(chip);
        }
    });
}

// Skip-to-content link for WCAG 2.4.1 — injected on every page that loads core.js
document.addEventListener("DOMContentLoaded", function() {
    if (document.querySelector('.skip-nav')) return;
    var main = document.querySelector('main')
            || document.querySelector('.container')
            || document.querySelector('.ticker-header')
            || document.querySelector('article');
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    var a = document.createElement('a');
    a.className = 'skip-nav';
    a.href = '#' + main.id;
    a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
});

// Shared series navigation. Existing articles span several HTML generations;
// normalizing their common .series-bar keeps every chapter usable without
// rewriting hundreds of editorial files.
document.addEventListener('DOMContentLoaded', function() {
    if (!/^\/series\//.test(location.pathname)) return;

    document.querySelectorAll('.series-bar:not(.series-enhanced)').forEach(function(bar, barIndex) {
        var inner = bar.querySelector('.series-bar-inner');
        var steps = bar.querySelector('.series-steps');
        if (!inner || !steps) return;
        var items = Array.prototype.slice.call(steps.querySelectorAll('.series-step'));
        if (!items.length) return;

        var currentIndex = items.findIndex(function(item) { return item.classList.contains('current'); });
        if (currentIndex < 0) currentIndex = 0;
        items.forEach(function(item, index) {
            item.classList.toggle('done', index < currentIndex);
            if (index === currentIndex) item.setAttribute('aria-current', 'step');
            item.setAttribute('aria-label', 'Partie ' + (index + 1) + ' sur ' + items.length + ' : ' + (item.getAttribute('title') || item.textContent.trim()));
        });

        var titleNode = inner.querySelector('.series-title');
        var counterNode = inner.querySelector('.series-counter');
        var arrows = Array.prototype.slice.call(inner.children).filter(function(node) {
            return node.classList && node.classList.contains('series-arrow');
        });
        var previous = arrows[0] || null;
        var next = arrows[arrows.length - 1] || null;
        var title = titleNode ? titleNode.textContent.trim() : 'Série';

        var head = document.createElement('div');
        head.className = 'series-progress-head';
        head.innerHTML = '<div><span class="series-eyebrow">Parcours</span><strong></strong></div>' +
            '<span class="series-position">Partie ' + (currentIndex + 1) + ' sur ' + items.length + '</span>';
        head.querySelector('strong').textContent = title;

        var progress = document.createElement('div');
        progress.className = 'series-progress-track';
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-label', 'Progression dans la série');
        progress.setAttribute('aria-valuemin', '1');
        progress.setAttribute('aria-valuemax', String(items.length));
        progress.setAttribute('aria-valuenow', String(currentIndex + 1));
        progress.innerHTML = '<span style="width:' + (((currentIndex + 1) / items.length) * 100).toFixed(2) + '%"></span>';

        var row = document.createElement('div');
        row.className = 'series-chapter-row';
        if (previous) {
            previous.setAttribute('aria-label', currentIndex > 0 ? 'Partie précédente' : 'Aucune partie précédente');
            row.appendChild(previous);
        }
        row.appendChild(steps);
        if (next && next !== previous) {
            next.setAttribute('aria-label', currentIndex < items.length - 1 ? 'Partie suivante' : 'Aucune partie suivante');
            row.appendChild(next);
        }

        inner.innerHTML = '';
        inner.appendChild(head);
        inner.appendChild(progress);
        inner.appendChild(row);
        bar.classList.add('series-enhanced');
        bar.setAttribute('role', 'navigation');
        bar.setAttribute('aria-label', title + (barIndex ? ' — navigation de fin' : ' — navigation des chapitres'));

        requestAnimationFrame(function() {
            var current = steps.querySelector('.series-step.current');
            if (current) current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        });
    });
});

// One public follow destination. Historical pages may still contain legacy
// Telegram, YouTube or RSS anchors; normalize them at runtime as a safety net.
document.addEventListener('DOMContentLoaded', function() {
    var substack = 'https://dailytickers.substack.com';
    document.querySelectorAll('a[href]').forEach(function(link) {
        var raw = link.getAttribute('href') || '';
        var legacy = /(?:^https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|youtube\.com|youtu\.be)\//i.test(raw)
            || /^\/?feed\.xml(?:[?#]|$)/i.test(raw);
        if (!legacy) return;
        link.href = substack;
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', 'Suivre DailyTickers sur Substack');
        link.setAttribute('title', 'DailyTickers sur Substack');
        link.querySelectorAll('i').forEach(function(icon) { icon.className = 'fa-solid fa-newspaper'; });
        Array.prototype.slice.call(link.childNodes).forEach(function(node) {
            if (node.nodeType === Node.TEXT_NODE && /Telegram|YouTube|RSS/i.test(node.textContent)) node.textContent = ' Substack';
        });
        link.querySelectorAll('strong').forEach(function(node) { node.textContent = 'Lire sur Substack'; });
        link.querySelectorAll('small').forEach(function(node) { node.textContent = 'Analyses · Daily · Weekly'; });
    });
});

document.addEventListener("DOMContentLoaded", function() {
    const articleTagsString = document.documentElement.dataset.tags;
    const articleDefaultTab = document.documentElement.dataset.tab || "analyses";

    if (articleTagsString) {
        renderClickableTags(articleTagsString, "article-clickable-tags", articleDefaultTab);
    }

    // Auto-add tooltips to Sharia badges (Halal / CONV) — no need to edit every scan HTML
    document.querySelectorAll('.badge').forEach(function(el) {
        if (el.hasAttribute('title')) return;
        var txt = (el.textContent || '').trim();
        if (/Halal/i.test(txt))
            el.setAttribute('title', 'Sharia-compliant — passes AAOIFI ratios (debt/mcap <33%, interest <5%, haram sectors excluded)');
        else if (/CONV/i.test(txt))
            el.setAttribute('title', 'Conventional — not Sharia-compliant (finance/alcohol/leverage or ratios out of bounds)');
    });

    // === FAB (Floating Action Button) Navigation ===
    var fnavBtn = document.getElementById('fnavBtn');
    var fnavMenu = document.getElementById('fnavMenu');
    if (fnavBtn && fnavMenu) {
        fnavBtn.addEventListener('click', function() {
            var isOpen = fnavMenu.classList.toggle('open');
            fnavBtn.classList.toggle('open', isOpen);
            var icon = document.getElementById('fnavIcon');
            var label = document.getElementById('fnavLabel');
            if (icon) icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
            if (label) label.textContent = isOpen ? 'Close' : 'Menu';
        });
        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!fnavBtn.contains(e.target) && !fnavMenu.contains(e.target)) {
                fnavMenu.classList.remove('open');
                fnavBtn.classList.remove('open');
                var icon = document.getElementById('fnavIcon');
                var label = document.getElementById('fnavLabel');
                if (icon) icon.className = 'fas fa-bars';
                if (label) label.textContent = 'Menu';
            }
        });
        // Smooth scroll + close on item click
        fnavMenu.querySelectorAll('.fnav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                fnavMenu.classList.remove('open');
                fnavBtn.classList.remove('open');
                var icon = document.getElementById('fnavIcon');
                var label = document.getElementById('fnavLabel');
                if (icon) icon.className = 'fas fa-bars';
                if (label) label.textContent = 'Menu';
            });
        });
        // IntersectionObserver for active section highlighting
        var sections = [];
        fnavMenu.querySelectorAll('.fnav-item[data-section]').forEach(function(item) {
            var sec = document.getElementById(item.dataset.section);
            if (sec) sections.push({ el: sec, item: item });
        });
        if (sections.length && 'IntersectionObserver' in window) {
            var obs = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    var match = sections.find(function(s) { return s.el === entry.target; });
                    if (match) match.item.classList.toggle('active', entry.isIntersecting);
                });
            }, { threshold: 0.15 });
            sections.forEach(function(s) { obs.observe(s.el); });
        }
    }
});

// S2: Scanner Top 3 collapse — DISABLED 2026-04-29.
// User feedback: hiding setups #4-10 behind "Show all" button breaks the
// reference layout (matches scanner/20260407/) where all 10 cards are
// visible by default. Function kept as no-op for backward compatibility
// in case the call site is referenced elsewhere.
function initScannerCollapse() {
    return; // disabled — show all setups
    if (document.documentElement.dataset.tab !== 'scanner') return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.setup-card'));
    if (cards.length <= 3) return;

    // Hide cards after index 2
    for (var i = 3; i < cards.length; i++) {
        cards[i].classList.add('scanner-hidden');
    }

    // Insert expand button after 3rd card
    var expandBtn = document.createElement('button');
    expandBtn.className = 'scanner-expand-btn';
    expandBtn.textContent = 'Show all ' + cards.length + ' setups \u25bc';
    cards[2].parentNode.insertBefore(expandBtn, cards[2].nextSibling);

    expandBtn.addEventListener('click', function() {
        var hidden = document.querySelectorAll('.scanner-hidden');
        Array.prototype.forEach.call(hidden, function(c) { c.classList.remove('scanner-hidden'); });
        expandBtn.remove();

        // Insert collapse button after last card
        var collapseBtn = document.createElement('button');
        collapseBtn.className = 'scanner-expand-btn';
        collapseBtn.textContent = '\u25b2 Show less';
        var allCards = document.querySelectorAll('.setup-card');
        var lastCard = allCards[allCards.length - 1];
        lastCard.parentNode.insertBefore(collapseBtn, lastCard.nextSibling);

        collapseBtn.addEventListener('click', function() {
            var allC = Array.prototype.slice.call(document.querySelectorAll('.setup-card'));
            for (var j = 3; j < allC.length; j++) {
                allC[j].classList.add('scanner-hidden');
            }
            collapseBtn.remove();
            // Re-insert expand button
            var newExpand = document.createElement('button');
            newExpand.className = 'scanner-expand-btn';
            newExpand.textContent = 'Show all ' + allC.length + ' setups \u25bc';
            allC[2].parentNode.insertBefore(newExpand, allC[2].nextSibling);
            newExpand.addEventListener('click', function() { expandBtn.click(); });
        });
    });
}

// S3: Mobile bottom nav
function initMobileBottomNav() {
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';

    var links = [
        { href: '/?tab=daily',    icon: 'fas fa-newspaper',      label: 'Daily',    tab: 'daily' },
        { href: '/?tab=scanner',  icon: 'fas fa-crosshairs',     label: 'Scanner',  tab: 'scanner' },
        { href: '/?tab=analyses', icon: 'fas fa-chart-line',     label: 'Analyses', tab: 'analyses' },
        { href: '/?tab=radar',    icon: 'fas fa-satellite-dish', label: 'Radar',    tab: 'radar' },
        { href: '/?tab=weekly',   icon: 'fas fa-calendar-week',  label: 'Weekly',   tab: 'weekly' },
        { href: '/?tab=series',   icon: 'fas fa-graduation-cap', label: 'S\u00e9ries',  tab: 'series' }
    ];

    // Determine active tab
    var pageTab = document.documentElement.dataset.tab || '';
    if (!pageTab) {
        var urlParams = new URLSearchParams(window.location.search);
        pageTab = urlParams.get('tab') || '';
    }

    links.forEach(function(item) {
        var a = document.createElement('a');
        a.href = item.href;
        if (item.tab === pageTab) a.classList.add('active');
        var i = document.createElement('i');
        i.className = item.icon;
        var span = document.createElement('span');
        span.textContent = item.label;
        a.appendChild(i);
        a.appendChild(span);
        nav.appendChild(a);
    });

    document.body.appendChild(nav);
}

document.addEventListener('DOMContentLoaded', function() {
    initScannerCollapse();
    initMobileBottomNav();
    initRetentionKit();
});

// Retention kit — injected before article-footer on every article page
(function() {
    function initRetentionKit() {
        var footer = document.querySelector('footer.article-footer');
        if (!footer) return;
        if (document.querySelector('.retention-kit')) return; // idempotent
        if (document.querySelector('.community-cta')) return; // skip if page already has CTA

        var kit = document.createElement('div');
        kit.className = 'retention-kit';
        kit.innerHTML =
            '<div class="retention-kit-card retention-kit-substack">' +
                '<div class="rk-icon"><i class="fa-solid fa-newspaper"></i></div>' +
                '<div class="rk-heading">Retrouvez DailyTickers sur Substack</div>' +
                '<div class="rk-sub">Analyses, Daily et Weekly dans un seul fil éditorial.</div>' +
                '<a class="rk-btn" href="https://dailytickers.substack.com" target="_blank" rel="noopener">' +
                    '<i class="fa-solid fa-arrow-up-right-from-square"></i> Ouvrir Substack' +
                '</a>' +
            '</div>';

        footer.parentNode.insertBefore(kit, footer);
    }

    // Expose for DOMContentLoaded caller
    window.__initRetentionKit = initRetentionKit;
})();

function initRetentionKit() {
    if (typeof window.__initRetentionKit === 'function') {
        window.__initRetentionKit();
    }
}

// =====================================================================
// BREADCRUMB — injected on article pages (not on landing)
// Detects article type via <html data-tab="...">, builds trail from URL
// =====================================================================
(function() {
    var MONTHS_FR = ['janvier','février','mars','avril','mai','juin',
                     'juillet','août','septembre','octobre','novembre','décembre'];

    var TAB_LABELS = {
        analyses:  'Analyses',
        scanner:   'Scanner',
        daily:     'Daily',
        weekly:    'Weekly Outlook',
        series:    'Series',
        tech:      'Tech'
    };

    function formatDateFR(yyyymmdd) {
        var s = String(yyyymmdd);
        if (s.length !== 8) return s;
        var y = s.slice(0, 4);
        var m = parseInt(s.slice(4, 6), 10);
        var d = parseInt(s.slice(6, 8), 10);
        return d + ' ' + MONTHS_FR[m - 1] + ' ' + y;
    }

    function buildBreadcrumb() {
        // Only run on article pages (not landing)
        var tab = document.documentElement.getAttribute('data-tab');
        if (!tab) return;

        // Skip if breadcrumb already injected
        if (document.querySelector('.breadcrumb')) return;

        var brandBar = document.querySelector('nav.brand-bar');
        if (!brandBar) return;

        var tabLabel = TAB_LABELS[tab] || tab;

        // Extract leaf from URL path: /scanner/20260414/ or /analyses/MSFT/
        var parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        var leaf = parts[parts.length - 1] || '';

        // Determine leaf label
        var leafLabel = '';
        if (/^\d{8}$/.test(leaf)) {
            leafLabel = formatDateFR(leaf);
        } else if (leaf) {
            leafLabel = leaf.toUpperCase();
        }

        var items = [
            '<a href="/" class="breadcrumb-link">Home</a>',
            '<span class="breadcrumb-sep" aria-hidden="true">›</span>',
            '<a href="/?tab=' + tab + '" class="breadcrumb-link">' + tabLabel + '</a>'
        ];
        if (leafLabel) {
            items.push('<span class="breadcrumb-sep" aria-hidden="true">›</span>');
            items.push('<span class="breadcrumb-current" aria-current="page">' + leafLabel + '</span>');
        }

        var nav = document.createElement('nav');
        nav.className = 'breadcrumb';
        nav.setAttribute('aria-label', 'Breadcrumb');
        nav.innerHTML = items.join('');

        brandBar.insertAdjacentElement('afterend', nav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildBreadcrumb);
    } else {
        buildBreadcrumb();
    }
})();

// ── Goal 1: Ticker Auto-Linker ────────────────────────────────────────────────
(function() {
    var SKIP_TAGS = { A: 1, CODE: 1, PRE: 1, H1: 1, H2: 1, H3: 1, TITLE: 1, SCRIPT: 1, STYLE: 1, TH: 1 };
    var MAX_PER_TICKER = 3;

    function escapeRe(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function isInsideSkipped(node) {
        var el = node.parentElement;
        while (el) {
            var tag = el.tagName;
            if (tag === 'A') return true;
            if (SKIP_TAGS[tag]) return true;
            if (el.dataset && el.dataset.noTickerlink !== undefined) return true;
            el = el.parentElement;
        }
        return false;
    }

    function walkTextNodes(root, callback) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(callback);
    }

    function initTickerLinker(tickers) {
        var pageTab = document.documentElement.dataset.tab || '';
        // Avoid self-linking on the analysis page for the same ticker
        var selfTicker = null;
        if (pageTab === 'analyses') {
            var m = window.location.pathname.match(/^\/analyses\/([^/]+)\//);
            if (m) selfTicker = m[1].toUpperCase();
        }

        var candidates = tickers.filter(function(t) { return t !== selfTicker; });
        if (!candidates.length) return;

        // Sort longest first so longer tickers match before any substring
        candidates.sort(function(a, b) { return b.length - a.length; });

        var re = new RegExp('\\b(' + candidates.map(escapeRe).join('|') + ')\\b', 'g');
        var counts = {};

        var scope = document.querySelector('main, article, .container');
        if (!scope) return;

        walkTextNodes(scope, function(node) {
            if (isInsideSkipped(node)) return;
            var text = node.nodeValue;
            if (!re.test(text)) { re.lastIndex = 0; return; }
            re.lastIndex = 0;

            var frag = document.createDocumentFragment();
            var lastIndex = 0;
            var match;
            var modified = false;

            while ((match = re.exec(text)) !== null) {
                var ticker = match[1];
                if (!counts[ticker]) counts[ticker] = 0;
                if (counts[ticker] >= MAX_PER_TICKER) continue;
                counts[ticker]++;
                modified = true;

                if (match.index > lastIndex) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }
                var a = document.createElement('a');
                a.href = '/analyses/' + ticker + '/';
                a.className = 'ticker-link';
                a.dataset.ticker = ticker;
                a.textContent = ticker;
                frag.appendChild(a);
                lastIndex = re.lastIndex;
            }

            if (!modified) return;
            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            }
            node.parentNode.replaceChild(frag, node);
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        fetch('/data/tickers-index.json')
            .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function(tickers) { initTickerLinker(tickers); })
            .catch(function() { /* graceful degradation */ });
    });
})();

// ── Goal 2: Related Articles ──────────────────────────────────────────────────
(function() {
    var INDEX_FILES = [
        { file: '/data/daily.json',    tab: 'daily' },
        { file: '/data/weekly.json',   tab: 'weekly' },
        { file: '/data/analyses.json', tab: 'analyses' },
        { file: '/data/scanner.json',  tab: 'scanner' },
        { file: '/data/series.json',   tab: 'series' },
        { file: '/data/tech.json',     tab: 'tech' }
    ];
    var CACHE_KEY_PREFIX = 'related_idx_';
    var CACHE_TTL = 10 * 60 * 1000; // 10 min

    function parseCard(html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html.replace(/ src=/gi, ' data-lazy-src=');
        var card = tmp.querySelector('.report-card');
        if (!card) return null;
        var tags = (card.dataset.tags || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
        var h2 = card.querySelector('h2');
        var title = h2 ? h2.textContent.trim() : '';
        var meta = card.querySelector('.report-card-meta');
        var date = meta ? meta.textContent.trim() : '';
        var link = card.querySelector('a[href]');
        var url = link ? link.getAttribute('href') : null;
        if (!url || !title) return null;
        return { url: url, title: title, date: date, tags: tags };
    }

    function fetchIndex(entry) {
        var cacheKey = CACHE_KEY_PREFIX + entry.tab;
        try {
            var cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                var obj = JSON.parse(cached);
                if (Date.now() - obj.ts < CACHE_TTL) return Promise.resolve(obj.data);
            }
        } catch(e) {}

        return fetch(entry.file)
            .then(function(r) { return r.ok ? r.json() : []; })
            .then(function(arr) {
                var items = Array.isArray(arr) ? arr : [];
                try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: items })); } catch(e) {}
                return items;
            })
            .catch(function() { return []; });
    }

    function jaccardScore(a, b) {
        if (!a.length || !b.length) return 0;
        var setA = {}, inter = 0, union = 0;
        a.forEach(function(t) { setA[t] = 1; });
        b.forEach(function(t) { if (setA[t]) inter++; });
        union = a.length + b.length - inter;
        return union > 0 ? inter / union : 0;
    }

    function renderRelated(items) {
        var lang = document.documentElement.lang || 'en';
        var heading = lang === 'fr' ? 'Articles li\u00e9s' : 'Related articles';

        var section = document.createElement('div');
        section.className = 'related-articles';

        var h = document.createElement('h3');
        h.className = 'related-articles-heading';
        h.textContent = heading;
        section.appendChild(h);

        var grid = document.createElement('div');
        grid.className = 'related-articles-grid';

        items.forEach(function(item) {
            var card = document.createElement('a');
            card.href = item.url;
            card.className = 'related-card';

            var title = document.createElement('div');
            title.className = 'related-card-title';
            title.textContent = item.title;
            card.appendChild(title);

            var meta = document.createElement('div');
            meta.className = 'related-card-meta';
            meta.textContent = item.date;
            card.appendChild(meta);

            if (item.tags.length) {
                var tagWrap = document.createElement('div');
                tagWrap.className = 'related-card-tags';
                item.tags.slice(0, 4).forEach(function(t) {
                    var chip = document.createElement('span');
                    chip.className = 'related-tag';
                    chip.textContent = t;
                    tagWrap.appendChild(chip);
                });
                card.appendChild(tagWrap);
            }

            grid.appendChild(card);
        });

        section.appendChild(grid);

        var footer = document.querySelector('footer.article-footer');
        if (footer) {
            footer.parentNode.insertBefore(section, footer);
        } else {
            document.body.appendChild(section);
        }
    }

    function initRelated() {
        var pageTags = document.documentElement.dataset.tags;
        if (!pageTags) return;

        var currentPath = window.location.pathname.replace(/\/?$/, '/');
        var currentTags = pageTags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);

        Promise.all(INDEX_FILES.map(fetchIndex)).then(function(results) {
            var allCards = [];
            results.forEach(function(arr) {
                arr.forEach(function(html) {
                    if (typeof html !== 'string') return;
                    var parsed = parseCard(html);
                    if (!parsed) return;
                    var url = parsed.url.replace(/\/?$/, '/');
                    if (url === currentPath) return; // skip self
                    allCards.push(parsed);
                });
            });

            // Score by tag overlap (Jaccard)
            var scored = allCards.map(function(card) {
                return { card: card, score: jaccardScore(currentTags, card.tags) };
            });
            scored.sort(function(a, b) { return b.score - a.score; });

            // Deduplicate by URL, pick top 3
            var seen = {};
            var top = [];
            for (var i = 0; i < scored.length && top.length < 3; i++) {
                var url = scored[i].card.url;
                if (!seen[url]) { seen[url] = 1; top.push(scored[i].card); }
            }

            if (top.length) renderRelated(top);
        });
    }

    document.addEventListener('DOMContentLoaded', initRelated);
})();

// ─── Analysis status & freshness (header strip + pill + safety net) ─────────────────────────
// On every /analyses/<DOSSIER>/ page, reads /data/analyses-status.json (regenerated nightly by
// tools/analyses-lifecycle.js — close-based transitions) and makes the status impossible to miss:
//   • a full-width STRIP at the top of the ticker-header (colour = status),
//   • a solid PILL in the badges row (price · score · grade · halal).
// Colours: green = current / validated · slate = awaiting trigger · red = invalidated ·
// amber = window expired · orange = NOT VERIFIED.
// SAFETY NET: file unreachable, dossier missing, or verification older than 5 days (the nightly
// update did not run) → "Levels not verified". Doubt always benefits the reader.
// Language: <html lang> of the page (en default · fr · ar · es · zh). The registry itself is
// language-neutral (structured `event`); all wording lives here.
// Vocabulary + classifier exposed as window.DT_ANALYSIS_STATUS for the landing page cards.
(function() {
    var THEMES = {
        active:      { bg: '#16a34a', icon: 'fa-circle-check' },
        validated:   { bg: '#059669', icon: 'fa-trophy' },
        pending:     { bg: '#475569', icon: 'fa-hourglass-half' },
        invalidated: { bg: '#dc2626', icon: 'fa-ban' },
        expired:     { bg: '#d97706', icon: 'fa-clock-rotate-left' },
        unverified:  { bg: '#ea580c', icon: 'fa-triangle-exclamation' },
        info:        { bg: '#64748b', icon: 'fa-circle-info' }
    };
    var I18N = {
        en: {
            label: { active: 'CURRENT', validated: 'THESIS VALIDATED', pending: 'AWAITING TRIGGER', invalidated: 'INVALIDATED — STOP HIT', expired: 'WINDOW EXPIRED — STALE', unverified: 'LEVELS NOT VERIFIED', info: 'INFORMATIONAL' },
            active: 'Levels verified at the {date} close — plan still valid.',
            pending: 'Entry not reached on a closing basis yet — levels verified at the {date} close.',
            validated: 'Target reached: this dossier is closed, the levels shown are historical.',
            invalidated: 'The published levels are void — do not follow this plan.',
            expired: 'The plan’s validity window has passed; the levels are stale.',
            info: 'No trade plan: background reading, no levels to follow.',
            unverified: 'Treat this dossier as potentially stale: levels are only valid as of their last verification.',
            unverifiedLast: 'Last verification: {date}.', unverifiedMissing: 'Dossier absent from the daily tracking.', unverifiedDown: 'Tracking unavailable.',
            ev: { stop: 'Closed at the stop on {date} ({close})', stop_after_tp1: 'Stop hit after TP1 on {date} ({close})', tp1: 'TP1 reached at the close on {date} ({close})', tp2: 'TP2 reached at the close on {date} ({close})', completed: 'TP1 reached, then window closed on {date}', expired: '{horizon}-session window elapsed on {date} without stop or target', expired_untriggered: 'Never triggered — {horizon}-session window elapsed on {date}', triggered: 'Entry triggered at the close on {date}' },
            months: ['January','February','March','April','May','June','July','August','September','October','November','December'], fmt: 'mdy'
        },
        fr: {
            label: { active: 'DOSSIER D’ACTUALITÉ', validated: 'THÈSE VALIDÉE', pending: 'EN ATTENTE DE DÉCLENCHEMENT', invalidated: 'INVALIDÉ — STOP TOUCHÉ', expired: 'FENÊTRE ÉCOULÉE — PÉRIMÉ', unverified: 'NIVEAUX NON VÉRIFIÉS', info: 'DOSSIER INFORMATIF' },
            active: 'Niveaux vérifiés à la clôture du {date} — plan toujours valable.',
            pending: 'Entrée non touchée en clôture à ce jour — niveaux vérifiés à la clôture du {date}.',
            validated: 'Objectif atteint : dossier clos, les niveaux affichés sont historiques.',
            invalidated: 'Les niveaux publiés sont caducs — ne pas suivre ce plan.',
            expired: 'La fenêtre de validité du plan est passée, les niveaux sont périmés.',
            info: 'Pas de plan de trade : lecture de fond, pas de niveaux à suivre.',
            unverified: 'Considérez ce dossier comme potentiellement périmé : les niveaux ne valent qu’au jour de leur dernière vérification.',
            unverifiedLast: 'Dernière vérification : {date}.', unverifiedMissing: 'Dossier absent du suivi quotidien.', unverifiedDown: 'Suivi indisponible.',
            ev: { stop: 'Clôture au stop le {date} ({close})', stop_after_tp1: 'Stop touché après TP1 le {date} ({close})', tp1: 'TP1 atteint en clôture le {date} ({close})', tp2: 'TP2 atteint en clôture le {date} ({close})', completed: 'TP1 atteint puis fenêtre close le {date}', expired: 'Fenêtre de {horizon} séances écoulée le {date} sans stop ni objectif', expired_untriggered: 'Jamais déclenché — fenêtre de {horizon} séances écoulée le {date}', triggered: 'Entrée déclenchée en clôture le {date}' },
            months: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'], fmt: 'dmy'
        },
        es: {
            label: { active: 'VIGENTE', validated: 'TESIS VALIDADA', pending: 'A LA ESPERA DE ACTIVACIÓN', invalidated: 'INVALIDADO — STOP TOCADO', expired: 'VENTANA VENCIDA — CADUCADO', unverified: 'NIVELES NO VERIFICADOS', info: 'INFORMATIVO' },
            active: 'Niveles verificados al cierre del {date} — plan aún válido.',
            pending: 'Entrada aún no alcanzada al cierre — niveles verificados al cierre del {date}.',
            validated: 'Objetivo alcanzado: expediente cerrado, los niveles mostrados son históricos.',
            invalidated: 'Los niveles publicados quedan sin efecto — no seguir este plan.',
            expired: 'La ventana de validez del plan ha pasado; los niveles están caducados.',
            info: 'Sin plan de trading: lectura de fondo, sin niveles que seguir.',
            unverified: 'Considere este expediente potencialmente caducado: los niveles solo valen al día de su última verificación.',
            unverifiedLast: 'Última verificación: {date}.', unverifiedMissing: 'Expediente ausente del seguimiento diario.', unverifiedDown: 'Seguimiento no disponible.',
            ev: { stop: 'Cierre en el stop el {date} ({close})', stop_after_tp1: 'Stop tocado tras TP1 el {date} ({close})', tp1: 'TP1 alcanzado al cierre el {date} ({close})', tp2: 'TP2 alcanzado al cierre el {date} ({close})', completed: 'TP1 alcanzado y ventana cerrada el {date}', expired: 'Ventana de {horizon} sesiones vencida el {date} sin stop ni objetivo', expired_untriggered: 'Nunca activado — ventana de {horizon} sesiones vencida el {date}', triggered: 'Entrada activada al cierre el {date}' },
            months: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'], fmt: 'dmy'
        },
        ar: {
            label: { active: 'ساري', validated: 'الفرضية متحققة', pending: 'في انتظار التفعيل', invalidated: 'ملغى — وقف الخسارة', expired: 'انتهت المهلة — قديم', unverified: 'مستويات غير مُتحقّق منها', info: 'معلوماتي' },
            active: 'تم التحقق من المستويات عند إغلاق {date} — الخطة ما زالت سارية.',
            pending: 'لم يُبلغ سعر الدخول عند الإغلاق بعد — تم التحقق عند إغلاق {date}.',
            validated: 'تم بلوغ الهدف: الملف مغلق والمستويات المعروضة تاريخية.',
            invalidated: 'المستويات المنشورة لم تعد سارية — لا تتبع هذه الخطة.',
            expired: 'انتهت مهلة صلاحية الخطة؛ المستويات قديمة.',
            info: 'لا خطة تداول: قراءة خلفية بلا مستويات.',
            unverified: 'اعتبر هذا الملف قديماً محتملاً: المستويات صالحة فقط في يوم آخر تحقق.',
            unverifiedLast: 'آخر تحقق: {date}.', unverifiedMissing: 'الملف غير مدرج في المتابعة اليومية.', unverifiedDown: 'المتابعة غير متاحة.',
            ev: { stop: 'إغلاق عند وقف الخسارة في {date} ({close})', stop_after_tp1: 'وقف الخسارة بعد TP1 في {date} ({close})', tp1: 'بلوغ TP1 عند الإغلاق في {date} ({close})', tp2: 'بلوغ TP2 عند الإغلاق في {date} ({close})', completed: 'بلوغ TP1 ثم إغلاق المهلة في {date}', expired: 'انتهت مهلة {horizon} جلسة في {date} دون وقف أو هدف', expired_untriggered: 'لم يُفعّل — انتهت مهلة {horizon} جلسة في {date}', triggered: 'تفعيل الدخول عند الإغلاق في {date}' },
            months: null, fmt: 'iso'
        },
        zh: {
            label: { active: '有效', validated: '论点已验证', pending: '等待触发', invalidated: '已失效 — 触及止损', expired: '窗口已过 — 已过时', unverified: '价位未验证', info: '信息参考' },
            active: '价位已按 {date} 收盘验证 — 计划仍然有效。',
            pending: '收盘尚未触及入场位 — 价位已按 {date} 收盘验证。',
            validated: '已达目标：本案已结束，所示价位为历史数据。',
            invalidated: '已发布的价位已作废 — 请勿跟随此计划。',
            expired: '计划有效窗口已过，价位已过时。',
            info: '无交易计划：背景阅读，无需跟随价位。',
            unverified: '请将本案视为可能已过时：价位仅在最后验证日有效。',
            unverifiedLast: '最后验证：{date}。', unverifiedMissing: '本案未纳入每日跟踪。', unverifiedDown: '跟踪不可用。',
            ev: { stop: '{date} 收盘触及止损 ({close})', stop_after_tp1: 'TP1 后于 {date} 触及止损 ({close})', tp1: '{date} 收盘达到 TP1 ({close})', tp2: '{date} 收盘达到 TP2 ({close})', completed: '达到 TP1，窗口于 {date} 关闭', expired: '{horizon} 个交易日窗口于 {date} 结束，未触及止损或目标', expired_untriggered: '从未触发 — {horizon} 个交易日窗口于 {date} 结束', triggered: '{date} 收盘触发入场' },
            months: null, fmt: 'iso'
        }
    };
    var FRESH_MAX_DAYS = 5;

    function pickLang() {
        var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        return I18N[l] ? l : 'en';
    }
    function fmtDate(iso, lang) {
        if (!iso) return '?';
        var L = I18N[lang] || I18N.en, day = iso.slice(0, 10);
        if (L.fmt === 'iso' || !L.months) return day;
        var d = new Date(day + 'T12:00:00Z');
        return L.fmt === 'mdy'
            ? L.months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear()
            : d.getUTCDate() + ' ' + L.months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    }
    function fill(tpl, vars) {
        return String(tpl).replace(/\{(\w+)\}/g, function(_, k) { return vars[k] != null ? vars[k] : ''; });
    }
    /** Structured registry event → sentence in the page language (null if no event). */
    function fmtEvent(ev, lang) {
        if (!ev || !ev.type) return null;
        var L = I18N[lang] || I18N.en, tpl = L.ev[ev.type] || I18N.en.ev[ev.type];
        if (!tpl) return null;
        return fill(tpl, { date: fmtDate(ev.date, lang), close: ev.close != null ? Number(ev.close).toFixed(2) : '', horizon: ev.horizon || '' });
    }
    /** Raw registry status → theme key (shared by article page and landing cards). */
    function classify(e, agg) {
        if (!e) return 'unverified';
        if (!e.hasPlan) return 'info';
        var s = e.status;
        if (s === 'stopped' || s === 'invalidated') return 'invalidated';
        if (s === 'tp1-hit' || s === 'tp2-hit' || s === 'completed') return 'validated';
        if (s === 'expired') return 'expired';
        var genAge = agg && agg.generatedAt ? (Date.now() - new Date(agg.generatedAt)) / 86400000 : Infinity;
        var verAge = e.verifiedAt ? (Date.now() - new Date(e.verifiedAt)) / 86400000 : Infinity;
        if (verAge > FRESH_MAX_DAYS || genAge > FRESH_MAX_DAYS) return 'unverified';
        if (s === 'pending' || s === 'watch' || s === 'wait') return 'pending';
        return 'active';
    }
    window.DT_ANALYSIS_STATUS = { THEMES: THEMES, I18N: I18N, classify: classify, fmtEvent: fmtEvent, fmtDate: fmtDate, FRESH_MAX_DAYS: FRESH_MAX_DAYS };

    if (document.documentElement.dataset.tab !== 'analyses') return;
    var m = location.pathname.match(/^\/analyses\/([A-Za-z0-9.\-]+)\/?/);
    if (!m) return;
    var slug = m[1];
    var looksTicker = /^[A-Z0-9.\-]{1,8}$/.test(slug);
    var lang = pickLang(), L = I18N[lang];

    function render(kind, detail) {
        var t = THEMES[kind] || THEMES.info, label = L.label[kind] || I18N.en.label[kind];
        var header = document.querySelector('.ticker-header');
        if (!header) return;
        var strip = document.createElement('div');
        strip.className = 'analysis-status-strip analysis-status-' + kind;
        strip.setAttribute('role', 'status');
        strip.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin:-0.25rem 0 1rem;padding:0.6rem 0.9rem;' +
            'border-radius:10px;background:' + t.bg + ';color:#fff;font-weight:700;font-size:0.95rem;letter-spacing:0.01em;';
        strip.innerHTML = '<i class="fa-solid ' + t.icon + '"></i><span>' + label + '</span>' +
            (detail ? '<span style="font-weight:500;opacity:0.95">— ' + detail + '</span>' : '');
        header.insertBefore(strip, header.firstChild);
        var anyBadge = header.querySelector('.badge');
        var row = anyBadge ? anyBadge.parentNode : null;
        if (row) {
            var pill = document.createElement('span');
            pill.className = 'analysis-status-pill';
            pill.style.cssText = 'background:' + t.bg + ';color:#fff;padding:0.35rem 0.8rem;border-radius:999px;font-weight:800;' +
                'font-size:0.8rem;letter-spacing:0.03em;white-space:nowrap;';
            pill.innerHTML = '<i class="fa-solid ' + t.icon + '" style="margin-right:0.35rem"></i>' + label;
            row.insertBefore(pill, row.firstChild);
        }
    }
    function warnUnverified(extra) { render('unverified', (extra ? extra + ' ' : '') + L.unverified); }

    fetch('/data/analyses-status.json', { cache: 'no-cache' })
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(agg) {
            var e = agg.entries && agg.entries[slug];
            if (!e) { if (looksTicker) warnUnverified(L.unverifiedMissing); return; }
            var kind = classify(e, agg);
            var evTxt = fmtEvent(e.event, lang), pre = evTxt ? evTxt + '. ' : '';
            var when = fmtDate(e.closeDate || e.publishedAt || e.verifiedAt, lang);
            if (kind === 'info')             render('info', L.info);
            else if (kind === 'invalidated') render('invalidated', pre + L.invalidated);
            else if (kind === 'validated')   render('validated', pre + L.validated);
            else if (kind === 'expired')     render('expired', pre + L.expired);
            else if (kind === 'unverified')  warnUnverified(fill(L.unverifiedLast, { date: fmtDate(e.verifiedAt || agg.generatedAt, lang) }));
            else if (kind === 'pending')     render('pending', e.status === 'wait' && e.note
                ? e.note + ' — ' + when + '.'
                : fill(L.pending, { date: when }));
            else                             render('active', fill(L.active, { date: when }));
        })
        .catch(function() { if (looksTicker) warnUnverified(L.unverifiedDown); });
})();
