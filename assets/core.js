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
    education: { labels: { fr: "Éducation", en: "Education", ar: "تعليم" }, cat: "theme" },
    societe: { labels: { fr: "Société", en: "Society", ar: "مجتمع" }, cat: "theme" },
    securite: { labels: { fr: "Sécurité", en: "Security", ar: "أمن" }, cat: "theme" },
    architecture: { labels: { fr: "Architecture", en: "Architecture", ar: "هندسة" }, cat: "theme" },
    sql: { labels: { fr: "SQL", en: "SQL", ar: "SQL" }, cat: "theme" },
    snowflake: { labels: { fr: "Snowflake", en: "Snowflake", ar: "Snowflake" }, cat: "theme" },
    singer: { labels: { fr: "Singer", en: "Singer", ar: "Singer" }, cat: "theme" },
    opensource: { labels: { fr: "Open-Source", en: "Open-Source", ar: "مصدر مفتوح" }, cat: "theme" },
    
    // Special (cat: "special")
    "special-edition": { labels: { fr: "Édition Spéciale", en: "Special Edition", ar: "إصدار خاص" }, cat: "special" },

    // Content (cat: "content")
    "trade-idea": { labels: { fr: "Idée de Trade", en: "Trade Idea", ar: "فكرة تداول" }, cat: "content" },
    formation: { labels: { fr: "Formation", en: "Learning", ar: "تدريب" }, cat: "content" },
    retrospective: { labels: { fr: "Rétrospective", en: "Retrospective", ar: "مراجعة" }, cat: "content" },
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
        const meta = tagMeta[t];
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

// S2: Scanner Top 3 collapse
function initScannerCollapse() {
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
        if (footer.querySelector('.retention-kit')) return; // idempotent

        var kit = document.createElement('div');
        kit.className = 'retention-kit';
        kit.innerHTML =
            '<div class="retention-kit-card retention-kit-tg">' +
                '<div class="rk-icon"><i class="fa-brands fa-telegram"></i></div>' +
                '<div class="rk-heading">Get every signal live</div>' +
                '<div class="rk-sub">Free Telegram channel — scanner picks, daily briefings, alerts.</div>' +
                '<a class="rk-btn rk-btn-tg" href="https://t.me/+gl06cNSLV2RiZmE0" target="_blank" rel="noopener">' +
                    '<i class="fa-brands fa-telegram"></i> Join on Telegram' +
                '</a>' +
            '</div>' +
            '<div class="retention-kit-card retention-kit-rss">' +
                '<div class="rk-icon"><i class="fa-solid fa-rss"></i></div>' +
                '<div class="rk-heading">Follow via RSS</div>' +
                '<div class="rk-sub">Get articles in your reader.</div>' +
                '<a class="rk-btn rk-btn-rss" href="/feed.xml" target="_blank" rel="noopener">' +
                    '<i class="fa-solid fa-rss"></i> Subscribe to RSS' +
                '</a>' +
            '</div>';

        footer.insertBefore(kit, footer.firstChild);
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
        tmp.innerHTML = html;
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
