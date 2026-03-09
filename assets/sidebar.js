/**
 * sidebar.js — Global sidebar navigation for Market Watch articles.
 * Include via <script src="/assets/sidebar.js"></script> before </body>.
 * Loads /assets/sidebar.css and injects a sidebar identical to the landing page.
 */
(function () {
  // Don't inject on the landing page (it has its own sidebar)
  if (document.getElementById('sidebar')) return;

  // === Load shared sidebar CSS ===
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/sidebar.css';
  document.head.appendChild(link);

  // === Remove brand-bar ===
  var brandBar = document.querySelector('nav.brand-bar');
  if (brandBar) brandBar.remove();

  // === Detect current tab from html data-tab or URL ===
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

  // === Build sidebar HTML (same structure as landing page) ===
  var tabs = [
    { tab: 'radar', icon: 'fa-satellite-dish', label: 'Radar' },
    { tab: 'weekly', icon: 'fa-calendar-week', label: 'Hebdo' },
    { tab: 'daily', icon: 'fa-sun', label: 'Daily' },
    { tab: 'analyses', icon: 'fa-chart-column', label: 'Analyses' },
    { tab: 'scanner', icon: 'fa-crosshairs', label: 'Scanner' },
    { tab: 'series', icon: 'fa-graduation-cap', label: 'Séries' },
    { tab: 'tech', icon: 'fa-microchip', label: 'Tech' }
  ];

  var navLinks = tabs.map(function (t) {
    var active = t.tab === currentTab ? ' active' : '';
    var href = t.tab === 'radar' ? '/' : '/?tab=' + t.tab;
    var countSpan = t.tab !== 'radar' ? '<span class="sidebar-count" id="sidebarCount-' + t.tab + '"></span>' : '';
    return '<a href="' + href + '" class="sidebar-link' + active + '"><i class="fa-solid ' + t.icon + '"></i><span>' + t.label + '</span>' + countSpan + '</a>';
  }).join('');

  var sidebarHTML = [
    '<aside class="sidebar" id="sidebar">',
    '  <a href="/" class="sidebar-brand">',
    '    <img src="/logo.svg" alt="MW" width="28" height="28">',
    '    Market Watch',
    '  </a>',
    '  <div class="sidebar-top">',
    '    <a href="/?search=1" class="sidebar-search-btn"><i class="fa-solid fa-magnifying-glass"></i><span>Search...</span><kbd>\u2318K</kbd></a>',
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
    '    <a href="/series/quick-start/" class="sidebar-link sidebar-extra"><i class="fa-solid fa-graduation-cap"></i><span>D\u00e9buter en Bourse</span></a>',
    '  </div>',
    '</aside>',
    '<div class="sidebar-overlay" id="sidebarOverlay"></div>',
    '<button class="sidebar-toggle" id="sidebarToggle" aria-label="Menu"><i class="fas fa-bars" id="sidebarToggleIcon"></i></button>'
  ].join('\n');

  // Insert at start of body
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  document.body.classList.add('has-sidebar');

  // === Toggle logic ===
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var toggleBtn = document.getElementById('sidebarToggle');
  var icon = document.getElementById('sidebarToggleIcon');

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

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // === Init language select ===
  var langSel = document.getElementById('sidebarLang');
  if (langSel) {
    var storedLang = localStorage.getItem('mw-lang') || 'all';
    langSel.value = storedLang;
  }

  // === Fetch tab counts ===
  var countTabs = ['weekly', 'daily', 'analyses', 'scanner', 'series', 'tech'];
  countTabs.forEach(function (tab) {
    fetch('/data/' + tab + '.json?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var el = document.getElementById('sidebarCount-' + tab);
        if (el && data && data.length) el.textContent = data.length;
      })
      .catch(function () { /* silent */ });
  });
})();
