/**
 * sidebar.js — Global sidebar navigation for Market Watch articles.
 * Include via <script src="/assets/sidebar.js"></script> before </body>.
 * Loads /assets/sidebar.css and injects a sidebar identical to the landing page.
 */
(function () {
  // Don't inject on the landing page (it has its own sidebar)
  if (document.getElementById('sidebar')) return;

  // === Load sidebar CSS immediately via <link> ===
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/sidebar.css';
  document.head.appendChild(link);

  // === Hide body until sidebar is ready (prevents FOUC) ===
  document.body.style.visibility = 'hidden';

  function boot() {
    if (window.__sidebarReady) return;
    window.__sidebarReady = true;
    initSidebar();
    // Reveal body after sidebar is injected
    document.body.style.visibility = '';
  }

  // Try to init as soon as CSS loads
  link.onload = function () {
    // Small delay to ensure layout is computed
    requestAnimationFrame(boot);
  };

  // Fallback: init after 400ms regardless
  setTimeout(boot, 400);

  function initSidebar() {
    // === Remove brand-bar (sidebar replaces it) ===
    var brandBar = document.querySelector('nav.brand-bar');
    if (brandBar) brandBar.remove();

    // === i18n translations ===
    var T = {
      fr: {
        'tab.radar': 'Radar', 'tab.weekly': 'Hebdo', 'tab.daily': 'Daily',
        'tab.analyses': 'Analyses', 'tab.scanner': 'Scanner', 'tab.series': 'S\u00e9ries', 'tab.tech': 'Tech',
        'search.trigger': 'Rechercher...', 'sidebar.start': 'D\u00e9buter en Bourse'
      },
      en: {
        'tab.radar': 'Radar', 'tab.weekly': 'Weekly', 'tab.daily': 'Daily',
        'tab.analyses': 'Analyses', 'tab.scanner': 'Scanner', 'tab.series': 'Series', 'tab.tech': 'Tech',
        'search.trigger': 'Search...', 'sidebar.start': 'Getting Started'
      },
      ar: {
        'tab.radar': '\u0631\u0627\u062f\u0627\u0631', 'tab.weekly': '\u0623\u0633\u0628\u0648\u0639\u064a', 'tab.daily': '\u064a\u0648\u0645\u064a',
        'tab.analyses': '\u062a\u062d\u0644\u064a\u0644\u0627\u062a', 'tab.scanner': '\u0645\u0627\u0633\u062d', 'tab.series': '\u0633\u0644\u0627\u0633\u0644', 'tab.tech': '\u062a\u0642\u0646\u064a\u0629',
        'search.trigger': '\u0628\u062d\u062b...', 'sidebar.start': '\u0628\u062f\u0627\u064a\u0629'
      },
      es: {
        'tab.radar': 'Radar', 'tab.weekly': 'Semanal', 'tab.daily': 'Diario',
        'tab.analyses': 'An\u00e1lisis', 'tab.scanner': 'Esc\u00e1ner', 'tab.series': 'Series', 'tab.tech': 'Tech',
        'search.trigger': 'Buscar...', 'sidebar.start': 'Empezar'
      },
      zh: {
        'tab.radar': '\u96f7\u8fbe', 'tab.weekly': '\u5468\u62a5', 'tab.daily': '\u65e5\u62a5',
        'tab.analyses': '\u5206\u6790', 'tab.scanner': '\u626b\u63cf', 'tab.series': '\u7cfb\u5217', 'tab.tech': '\u6280\u672f',
        'search.trigger': '\u641c\u7d22...', 'sidebar.start': '\u5165\u95e8'
      }
    };

    var storedLang = localStorage.getItem('mw-lang') || 'all';
    var uiLang = (storedLang === 'all') ? 'en' : storedLang;
    if (!T[uiLang]) uiLang = 'en';

    function t(key) {
      return (T[uiLang] && T[uiLang][key]) || (T.en && T.en[key]) || key;
    }

    // === Detect current tab ===
    var htmlEl = document.documentElement;
    var currentTab = htmlEl.getAttribute('data-tab') || '';
    if (!currentTab) {
      var path = window.location.pathname;
      if (path.indexOf('/weekly/') === 0) currentTab = 'weekly';
      else if (path.indexOf('/daily/') === 0) currentTab = 'daily';
      else if (path.indexOf('/analyses/') === 0) currentTab = 'analyses';
      else if (path.indexOf('/scanner/') === 0) currentTab = 'scanner';
      else if (path.indexOf('/series/') === 0) currentTab = 'series';
      else if (path.indexOf('/tech/') === 0) currentTab = 'tech';
    }

    // === Build sidebar HTML ===
    var tabs = [
      { tab: 'radar', icon: 'fa-satellite-dish' },
      { tab: 'weekly', icon: 'fa-calendar-week' },
      { tab: 'daily', icon: 'fa-sun' },
      { tab: 'analyses', icon: 'fa-chart-column' },
      { tab: 'scanner', icon: 'fa-crosshairs' },
      { tab: 'series', icon: 'fa-graduation-cap' },
      { tab: 'tech', icon: 'fa-microchip' }
    ];

    var navLinks = tabs.map(function (tb) {
      var active = tb.tab === currentTab ? ' active' : '';
      var href = tb.tab === 'radar' ? '/' : '/?tab=' + tb.tab;
      var countSpan = tb.tab !== 'radar' ? '<span class="sidebar-count" id="sidebarCount-' + tb.tab + '"></span>' : '';
      return '<a href="' + href + '" class="sidebar-link' + active + '"><i class="fa-solid ' + tb.icon + '"></i><span data-i18n="tab.' + tb.tab + '">' + t('tab.' + tb.tab) + '</span>' + countSpan + '</a>';
    }).join('');

    var html = [
      '<aside class="sidebar open" id="sidebar">',
      '  <a href="/" class="sidebar-brand">',
      '    <img src="/logo.svg" alt="MW" width="24" height="24">',
      '    Market Watch',
      '  </a>',
      '  <div class="sidebar-top">',
      '    <a href="/?search=1" class="sidebar-search-btn"><i class="fa-solid fa-magnifying-glass"></i><span data-i18n="search.trigger">' + t('search.trigger') + '</span><kbd>\u2318K</kbd></a>',
      '    <select class="sidebar-lang" id="sidebarLang" onchange="localStorage.setItem(\'mw-lang\',this.value);location.reload()">',
      '      <option value="all">\ud83c\udf10 All</option>',
      '      <option value="en">\ud83c\uddfa\ud83c\uddf8 EN</option>',
      '      <option value="fr">\ud83c\uddeb\ud83c\uddf7 FR</option>',
      '      <option value="ar">\ud83c\uddf8\ud83c\udde6 AR</option>',
      '      <option value="es">\ud83c\uddea\ud83c\uddf8 ES</option>',
      '      <option value="zh">\ud83c\udde8\ud83c\uddf3 ZH</option>',
      '    </select>',
      '  </div>',
      '  <nav class="sidebar-nav">' + navLinks + '</nav>',
      '  <div class="sidebar-bottom">',
      '    <a href="/prompt-ia/" class="sidebar-link sidebar-extra"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Prompt IA</span></a>',
      '    <a href="/integrations/" class="sidebar-link sidebar-extra"><i class="fa-solid fa-plug"></i><span>Integrations</span></a>',
      '    <a href="/series/quick-start/" class="sidebar-link sidebar-extra"><i class="fa-solid fa-graduation-cap"></i><span data-i18n="sidebar.start">' + t('sidebar.start') + '</span></a>',
      '  </div>',
      '</aside>',
      '<div class="sidebar-overlay" id="sidebarOverlay"></div>',
      '<button class="sidebar-toggle" id="sidebarToggle" aria-label="Menu"><i class="fas fa-bars" id="sidebarToggleIcon"></i></button>'
    ].join('\n');

    // Insert at start of body
    document.body.insertAdjacentHTML('afterbegin', html);
    document.body.classList.add('has-sidebar');

    // === Toggle logic ===
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggleBtn = document.getElementById('sidebarToggle');
    var icon = document.getElementById('sidebarToggleIcon');

    // On desktop, sidebar starts open. On mobile, close it initially.
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      if (icon) icon.className = 'fas fa-bars';
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var isOpen = sidebar.classList.toggle('open');
        overlay.classList.toggle('visible', isOpen);
        icon.className = isOpen ? 'fas fa-xmark' : 'fas fa-bars';
      });
    }
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });

    // === Init language select ===
    var langSel = document.getElementById('sidebarLang');
    if (langSel) langSel.value = storedLang;

    // === Fetch tab counts ===
    ['weekly', 'daily', 'analyses', 'scanner', 'series', 'tech'].forEach(function (tab) {
      fetch('/data/' + tab + '.json?v=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var el = document.getElementById('sidebarCount-' + tab);
          if (el && data && data.length) el.textContent = data.length;
        })
        .catch(function () {});
    });
  }
})();
