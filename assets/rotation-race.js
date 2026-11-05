/* DailyTickers — graphiques de rotation animés (ECharts 5).
 * DTRotation.race  : course de barres, une image par séance, triée en direct (realtimeSort).
 * DTRotation.lines : courbes rebasées, repère vertical sur la date de base.
 * DTRotation.heat  : carte de chaleur groupes × fenêtres.
 * DTRotation.bars  : barres horizontales signées (contributions).
 * Les séries reçues sont des niveaux alignés sur `dates` ; toute variation affichée est recalculée ici
 * depuis ces niveaux, jamais saisie à la main. Mouvement réduit respecté : on affiche l'état final.
 */
(function () {
  'use strict';
  var NS = window.DTRotation = {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  function dark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function pal() {
    var d = dark();
    return { ink: d ? '#e2e8f0' : '#0f172a', muted: d ? '#94a3b8' : '#64748b', grid: d ? '#334155' : '#e2e8f0',
      pos: d ? '#34d399' : '#0b8f62', neg: d ? '#f87171' : '#c73d4b', zero: d ? '#64748b' : '#94a3b8', accent: d ? '#60a5fa' : '#2563eb', bg: d ? '#0f172a' : '#ffffff' };
  }
  NS.palette = pal;
  // La barre de fenêtre colle sous l'en-tête du site, lui-même collant : on mesure sa hauteur réelle.
  function stickTop() { var b = document.querySelector('.brand-bar'); if (b) document.documentElement.style.setProperty('--rot-top', b.offsetHeight + 'px'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stickTop); else stickTop();
  window.addEventListener('resize', stickTop);
  NS.pct = function (v, d) {
    if (v == null || !isFinite(v)) return '—';
    d = d == null ? 2 : d;
    var s = Math.abs(v).toFixed(d).replace('.', ',');
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + ' %';
  };
  // Points de pourcentage : « pt » sous 2 en valeur absolue, « pts » au-delà (accord français).
  NS.pts = function (v, d) { return NS.pct(v, d).replace(' %', Math.abs(v) >= 2 ? ' pts' : ' pt'); };
  NS.dateFr = function (iso, withDay) {
    var p = String(iso).split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return (withDay ? DAYS[dt.getUTCDay()] + ' ' : '') + (+p[2]) + ' ' + MONTHS[+p[1] - 1];
  };
  NS.load = function (url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  };
  function mount(el) {
    var old = window.echarts.getInstanceByDom(el);
    if (old) old.dispose();
    var c = window.echarts.init(el, null, { renderer: 'canvas' });
    if (!el.__dtResize) { el.__dtResize = true; window.addEventListener('resize', function () { var i = window.echarts.getInstanceByDom(el); if (i) i.resize(); }); }
    return c;
  }
  function rel(series, i0, k) { var b = series[i0], v = series[k]; return (b && v) ? Math.round((v / b - 1) * 10000) / 100 : null; }

  // ── Course de barres ──────────────────────────────────────────────────────
  NS.race = function (el, cfg) {
    var dates = cfg.dates, i0 = dates.indexOf(cfg.base), i1 = cfg.end ? dates.indexOf(cfg.end) : dates.length - 1;
    if (i0 < 0 || i1 <= i0) throw new Error('fenêtre invalide');
    var items = cfg.items.filter(function (x) { return x.series && x.series[i0] && x.series[i1]; });
    var names = items.map(function (x) { return x.name; });
    var lo = 0, hi = 0;
    for (var k = i0; k <= i1; k++) items.forEach(function (x) { var v = rel(x.series, i0, k); if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    var pad = Math.max(0.5, (hi - lo) * 0.18);
    var steps = i1 - i0, frameMs = cfg.frameMs || Math.max(140, Math.min(1100, Math.round(5200 / steps)));
    var c = mount(el), p = pal(), timer = null, cur = i0, ctl = cfg.controls || null;
    var compact = el.clientWidth < 520;
    // realtimeSort classe sur la LONGUEUR dessinée : une barre à −4,8 % passait devant +3,8 %. Les barres
    // partent donc du bord gauche (valeur décalée de x0) ; le zéro est un trait vertical, les étiquettes,
    // l'axe et l'info-bulle affichent la vraie variation.
    var span = (hi - lo + 2 * pad) / (compact ? 3 : 5), step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find(function (u) { return u >= span; }) || 100;
    var x0 = Math.floor((lo - pad) / step) * step, x1 = Math.ceil((hi + pad) / step) * step;
    function data(k) {
      return items.map(function (x) {
        var v = rel(x.series, i0, k);
        return { value: v - x0, itemStyle: { color: x.color || (v > 0 ? p.pos : v < 0 ? p.neg : p.zero), borderRadius: [0, 3, 3, 0] } };
      });
    }
    c.setOption({
      animationDuration: 0, animationDurationUpdate: reduce ? 0 : frameMs, animationEasing: 'linear', animationEasingUpdate: 'linear',
      textStyle: { fontFamily: 'Inter,system-ui,sans-serif', color: p.ink },
      grid: { left: compact ? 118 : 190, right: 64, top: 8, bottom: 30 },
      xAxis: { type: 'value', min: 0, max: x1 - x0, interval: step,
        axisLabel: { color: p.muted, formatter: function (v) { return NS.pct(Math.round((v + x0) * 10) / 10, step % 1 ? 1 : 0); } }, splitLine: { lineStyle: { color: p.grid } } },
      yAxis: { type: 'category', data: names, inverse: true, animationDuration: 280, animationDurationUpdate: 280,
        axisLabel: { color: p.ink, fontSize: compact ? 10 : 11, width: compact ? 110 : 182, overflow: 'truncate' }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.grid } } },
      tooltip: { trigger: 'item', formatter: function (q) { var it = items[q.dataIndex]; return '<strong>' + it.name + '</strong><br>' + NS.pct(q.value + x0) + (it.sub ? '<br><span style="color:' + p.muted + '">' + it.sub + '</span>' : ''); } },
      series: [{ type: 'bar', realtimeSort: true, barMaxWidth: 22, data: data(reduce ? i1 : i0),
        label: { show: true, position: 'right', valueAnimation: true, color: p.ink, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, formatter: function (q) { return NS.pct(q.value + x0); } },
        markLine: { symbol: 'none', silent: true, animation: false, label: { show: false }, lineStyle: { color: p.ink, width: 1.2, type: 'solid' }, data: [{ xAxis: -x0 }] } }],
      graphic: [{ type: 'text', id: 'stamp', invisible: compact, right: 70, bottom: 40, z: 100, style: { text: NS.dateFr(dates[reduce ? i1 : i0], true), font: '800 26px Inter,system-ui,sans-serif', fill: p.muted, opacity: 0.45 } }]
    });
    function draw(k) {
      cur = k;
      c.setOption({ series: [{ data: data(k) }], graphic: [{ id: 'stamp', style: { text: NS.dateFr(dates[k], true) } }] });
      if (ctl) { ctl.range.value = k; ctl.label.textContent = NS.dateFr(dates[k], true); }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } if (ctl) { ctl.btn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Rejouer'; ctl.btn.setAttribute('aria-pressed', 'false'); } }
    function play() {
      stop(); if (cur >= i1) draw(i0);
      if (ctl) { ctl.btn.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i> Pause'; ctl.btn.setAttribute('aria-pressed', 'true'); }
      timer = setInterval(function () { if (cur >= i1) { stop(); return; } draw(cur + 1); }, frameMs);
    }
    if (ctl) {
      ctl.btn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Lire';
      ctl.range.min = i0; ctl.range.max = i1; ctl.range.value = reduce ? i1 : i0;
      ctl.label.textContent = NS.dateFr(dates[reduce ? i1 : i0], true);
      ctl.btn.onclick = function () { if (timer) stop(); else play(); };
      ctl.range.oninput = function () { stop(); draw(+ctl.range.value); };
    }
    if (reduce) { cur = i1; stop(); }
    else if (cfg.autoplay === 'now') play();
    else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.35 });
      io.observe(el); el.__dtIO = io;
    } else play();
    return { play: play, stop: stop, chart: c, dispose: function () { stop(); if (el.__dtIO) el.__dtIO.disconnect(); c.dispose(); } };
  };
  // Barre de contrôle accessible : lecture/pause, curseur de séance, date courante.
  NS.controls = function (host) {
    host.innerHTML = '';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rot-play'; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Lire ou mettre en pause la course séance par séance');
    var range = document.createElement('input'); range.type = 'range'; range.className = 'rot-range'; range.setAttribute('aria-label', 'Séance affichée');
    var label = document.createElement('output'); label.className = 'rot-stamp';
    host.appendChild(btn); host.appendChild(range); host.appendChild(label);
    return { btn: btn, range: range, label: label };
  };

  // ── Courbes rebasées ──────────────────────────────────────────────────────
  NS.lines = function (el, cfg) {
    var dates = cfg.dates, ib = dates.indexOf(cfg.base), lead = cfg.lead == null ? 10 : cfg.lead;
    var i0 = Math.max(0, ib - lead), xs = dates.slice(i0), p = pal(), c = mount(el);
    var colors = cfg.colors || ['#2563eb', '#d97706', '#0f766e', '#7c3aed', '#db2777', '#475569', '#0891b2', '#a16207'];
    c.setOption({
      animationDuration: reduce ? 0 : 1600, animationEasing: 'cubicOut', color: colors,
      textStyle: { fontFamily: 'Inter,system-ui,sans-serif', color: p.ink },
      legend: { top: 0, type: 'scroll', textStyle: { color: p.ink, fontSize: 11 } },
      grid: { left: 52, right: el.clientWidth < 520 ? 60 : 132, top: 38, bottom: 30 },
      tooltip: { trigger: 'axis', valueFormatter: function (v) { return NS.pct(v); } },
      xAxis: { type: 'category', data: xs.map(function (d) { return NS.dateFr(d); }), boundaryGap: false, axisLabel: { color: p.muted }, axisLine: { lineStyle: { color: p.grid } } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: p.muted, formatter: function (v) { return NS.pct(v, 1); } }, splitLine: { lineStyle: { color: p.grid } } },
      series: cfg.items.map(function (it, n) {
        return { name: it.name, type: 'line', showSymbol: false, smooth: 0.15, z: n ? 2 : 5, lineStyle: { width: n ? 1.8 : 3.4 },
          endLabel: { show: el.clientWidth >= 520 || n === 0, formatter: function (q) { return NS.pct(q.value, 1); }, color: colors[n % colors.length], fontWeight: 700 },
          data: xs.map(function (_, j) { return rel(it.series, ib, i0 + j); }),
          markLine: n ? undefined : { symbol: 'none', silent: true, label: { formatter: cfg.baseLabel || 'base', color: p.muted, position: 'insideEndTop' }, lineStyle: { type: 'dashed', color: p.muted }, data: [{ xAxis: ib - i0 }] } };
      })
    });
    return c;
  };

  // ── Carte de chaleur ──────────────────────────────────────────────────────
  NS.heat = function (el, cfg) {
    var p = pal(), c = mount(el), rows = cfg.rows, cols = cfg.cols, data = [], m = 0.5;
    rows.forEach(function (r, i) { cols.forEach(function (w, j) { var v = r.vals[w.key]; if (v != null) { data.push([j, i, v]); m = Math.max(m, Math.abs(v)); } }); });
    var compact = el.clientWidth < 520;
    c.setOption({
      animationDuration: reduce ? 0 : 900,
      textStyle: { fontFamily: 'Inter,system-ui,sans-serif', color: p.ink },
      grid: { left: compact ? 112 : 190, right: 8, top: 34, bottom: 8 },
      tooltip: { formatter: function (q) { return '<strong>' + rows[q.value[1]].name + '</strong><br>' + cols[q.value[0]].label + ' : ' + NS.pct(q.value[2]); } },
      xAxis: { type: 'category', position: 'top', data: cols.map(function (w) { return w.short || w.label; }), axisLabel: { color: p.ink, fontWeight: 700, fontSize: compact ? 10 : 11, interval: 0 }, axisTick: { show: false }, axisLine: { show: false } },
      yAxis: { type: 'category', inverse: true, data: rows.map(function (r) { return r.name; }), axisLabel: { color: p.ink, fontSize: compact ? 10 : 11, width: compact ? 104 : 182, overflow: 'truncate' }, axisTick: { show: false }, axisLine: { show: false } },
      visualMap: { show: false, min: -m, max: m, dimension: 2, inRange: { color: [p.neg, dark() ? '#1e293b' : '#f8fafc', p.pos] } },
      series: [{ type: 'heatmap', data: data, itemStyle: { borderColor: p.bg, borderWidth: 2 },
        label: { show: true, fontFamily: 'JetBrains Mono,monospace', fontSize: compact ? 9 : 11, color: p.ink, formatter: function (q) { return NS.pct(q.value[2], 1); } } }]
    });
    return c;
  };

  // ── Barres signées (contributions) ───────────────────────────────────────
  NS.bars = function (el, cfg) {
    var p = pal(), c = mount(el), items = cfg.items.slice().sort(function (a, b) { return b.value - a.value; });
    var fmt = cfg.fmt || NS.pct, compact = el.clientWidth < 520;
    c.setOption({
      animationDuration: reduce ? 0 : 1100, animationEasing: 'cubicOut',
      textStyle: { fontFamily: 'Inter,system-ui,sans-serif', color: p.ink },
      grid: { left: compact ? 92 : 104, right: 70, top: 8, bottom: 26 },
      tooltip: { trigger: 'item', formatter: function (q) { var it = items[q.dataIndex]; return '<strong>' + it.name + '</strong><br>' + fmt(it.value) + (it.sub ? '<br>' + it.sub : ''); } },
      xAxis: { type: 'value', axisLabel: { color: p.muted, formatter: function (v) { return fmt(v, 2); } }, splitLine: { lineStyle: { color: p.grid } } },
      yAxis: { type: 'category', inverse: true, data: items.map(function (x) { return x.name; }), axisLabel: { color: p.ink, fontWeight: 700, fontSize: 11 }, axisTick: { show: false } },
      series: [{ type: 'bar', barMaxWidth: 18, data: items.map(function (x) { return { value: x.value, itemStyle: { color: x.value >= 0 ? p.pos : p.neg } }; }),
        label: { show: true, position: 'right', color: p.ink, fontFamily: 'JetBrains Mono,monospace', fontSize: 10, formatter: function (q) { return fmt(q.value); } } }]
    });
    return c;
  };
})();
