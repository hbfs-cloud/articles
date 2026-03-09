/**
 * sidebar.js — Global sidebar navigation for Market Watch articles.
 * Include via <script src="/assets/sidebar.js"></script> before </body>.
 * Automatically:
 *   1. Removes the brand-bar (<nav class="brand-bar">)
 *   2. Injects a fixed left sidebar with nav links
 *   3. Pushes page content right (margin-left) on desktop
 *   4. Adds hamburger toggle on mobile
 */
(function () {
  // Don't inject on the landing page (it has its own sidebar)
  if (document.getElementById('sidebar')) return;

  // === CSS ===
  var css = document.createElement('style');
  css.textContent = [
    '.mw-sidebar{position:fixed;top:0;left:0;bottom:0;width:260px;background:#fff;border-right:1px solid #e2e8f0;z-index:200;display:flex;flex-direction:column;padding:1.25rem 0;overflow-y:auto;overflow-x:hidden;font-family:"Inter",sans-serif}',
    '.mw-sidebar-brand{display:flex;align-items:center;gap:10px;padding:0 1.25rem 1.25rem;text-decoration:none;color:#0f172a;font-weight:600;font-size:1rem;border-bottom:1px solid #e2e8f0;margin-bottom:0.75rem}',
    '.mw-sidebar-nav{flex:1;display:flex;flex-direction:column;gap:2px;padding:0 0.75rem}',
    '.mw-sidebar-link{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:0.85rem;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.15s;border:none;background:none;font-family:inherit;width:100%;text-align:left;text-decoration:none}',
    '.mw-sidebar-link:hover{background:#f1f5f9;color:#0f172a}',
    '.mw-sidebar-link.active{background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#2563eb}',
    '.mw-sidebar-link i{width:20px;text-align:center;font-size:0.95rem}',
    '.mw-sidebar-count{margin-left:auto;background:#f1f5f9;color:#64748b;font-size:0.65rem;padding:1px 6px;border-radius:8px}',
    '.mw-sidebar-link.active .mw-sidebar-count{background:#2563eb;color:#fff}',
    '.mw-sidebar-bottom{padding:0.75rem 0.75rem 0;border-top:1px solid #e2e8f0;margin-top:0.5rem;display:flex;flex-direction:column;gap:2px}',
    '.mw-sidebar-extra{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;font-size:0.8rem;font-weight:600;color:#64748b;text-decoration:none;transition:all 0.15s}',
    '.mw-sidebar-extra:hover{background:#f1f5f9;color:#0f172a}',
    '.mw-sidebar-divider{height:1px;background:#e2e8f0;margin:0.4rem 0.5rem}',
    '.mw-sidebar-search{display:flex;align-items:center;gap:8px;width:calc(100% - 1rem);margin:0 0.5rem;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#94a3b8;font-size:0.8rem;font-family:inherit;cursor:pointer;transition:all 0.15s}',
    '.mw-sidebar-search:hover{border-color:#2563eb;color:#2563eb}',
    '.mw-sidebar-search kbd{margin-left:auto;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:3px;padding:0 4px;font-size:0.65rem;font-family:inherit;color:#94a3b8}',
    '.mw-sidebar-lang{width:calc(100% - 1rem);margin:0 0.5rem;appearance:none;-webkit-appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #e2e8f0;border-radius:8px;padding:8px 28px 8px 12px;font-size:0.8rem;font-weight:600;font-family:inherit;color:#0f172a;cursor:pointer;transition:all 0.15s}',
    '.mw-sidebar-lang:hover{border-color:#2563eb}',
    '.mw-sidebar-lang:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.1)}',
    '.mw-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:190;backdrop-filter:blur(2px)}',
    '.mw-sidebar-overlay.visible{display:block}',
    '.mw-sidebar-toggle{display:none;position:fixed;top:0.75rem;left:0.75rem;z-index:300;width:40px;height:40px;border-radius:10px;border:1px solid #e2e8f0;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#0f172a;font-size:1.1rem;cursor:pointer;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)}',
    '.mw-sidebar-toggle:hover{border-color:#2563eb;color:#2563eb}',
    'body.has-mw-sidebar{margin-left:260px}',
    '@media(max-width:768px){',
    '  .mw-sidebar{transform:translateX(-100%);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);z-index:250;width:280px}',
    '  .mw-sidebar.open{transform:translateX(0)}',
    '  .mw-sidebar-toggle{display:flex}',
    '  body.has-mw-sidebar{margin-left:0}',
    '}'
  ].join('\n');
  document.head.appendChild(css);

  // === Remove brand-bar ===
  var brandBar = document.querySelector('nav.brand-bar');
  if (brandBar) brandBar.remove();

  // === Detect current tab from html data-tab or URL ===
  var htmlEl = document.documentElement;
  var currentTab = htmlEl.getAttribute('data-tab') || '';
  // Map folder paths to tabs
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
    var href = '/' + (t.tab === 'radar' ? '' : '?tab=' + t.tab);
    var countSpan = t.tab !== 'radar' ? '<span class="mw-sidebar-count" id="mwCount-' + t.tab + '"></span>' : '';
    return '<a href="' + href + '" class="mw-sidebar-link' + active + '"><i class="fa-solid ' + t.icon + '"></i><span>' + t.label + '</span>' + countSpan + '</a>';
  }).join('');

  var sidebarHTML = [
    '<aside class="mw-sidebar" id="mwSidebar">',
    '  <a href="/" class="mw-sidebar-brand">',
    '    <img src="/logo.svg" alt="MW" width="28" height="28">',
    '    Market Watch',
    '  </a>',
    '  <nav class="mw-sidebar-nav">' + navLinks + '</nav>',
    '  <div class="mw-sidebar-bottom">',
    '    <a href="/prompt-ia/" class="mw-sidebar-extra"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Prompt IA</span></a>',
    '    <a href="/integrations/" class="mw-sidebar-extra"><i class="fa-solid fa-plug"></i><span>Integrations</span></a>',
    '    <a href="/series/quick-start/" class="mw-sidebar-extra"><i class="fa-solid fa-bolt"></i><span>Quick Start</span></a>',
    '    <div class="mw-sidebar-divider"></div>',
    '    <a href="/?search=1" class="mw-sidebar-search"><i class="fa-solid fa-magnifying-glass"></i><span>Search...</span><kbd>\u2318K</kbd></a>',
    '    <select class="mw-sidebar-lang" id="mwSidebarLang" onchange="localStorage.setItem(\'mw-lang\',this.value);location.reload()">',
    '      <option value="all">\ud83c\udf10 All</option>',
    '      <option value="en">\ud83c\uddfa\ud83c\uddf8 EN</option>',
    '      <option value="fr">\ud83c\uddeb\ud83c\uddf7 FR</option>',
    '      <option value="ar">\ud83c\uddf8\ud83c\udde6 AR</option>',
    '      <option value="es">\ud83c\uddea\ud83c\uddf8 ES</option>',
    '      <option value="zh">\ud83c\udde8\ud83c\uddf3 ZH</option>',
    '    </select>',
    '  </div>',
    '</aside>',
    '<div class="mw-sidebar-overlay" id="mwSidebarOverlay"></div>',
    '<button class="mw-sidebar-toggle" id="mwSidebarToggle" aria-label="Menu"><i class="fas fa-bars" id="mwSidebarIcon"></i></button>'
  ].join('\n');

  // Insert at start of body
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  document.body.classList.add('has-mw-sidebar');

  // === Toggle logic ===
  var sidebar = document.getElementById('mwSidebar');
  var overlay = document.getElementById('mwSidebarOverlay');
  var toggleBtn = document.getElementById('mwSidebarToggle');
  var icon = document.getElementById('mwSidebarIcon');

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
  var langSel = document.getElementById('mwSidebarLang');
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
        var el = document.getElementById('mwCount-' + tab);
        if (el && data && data.length) el.textContent = data.length;
      })
      .catch(function () { /* silent */ });
  });
})();
