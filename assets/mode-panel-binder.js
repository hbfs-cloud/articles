/* mode-panel-binder.js — declarative HTML template binder for portfolio mode panels.
 *
 * Walks a DOM subtree and applies the JSON snapshot to it via data-* attributes:
 *
 *   data-bind="path.to.value"        — set textContent from JSON path
 *   data-format="pct1|pct2|usd|usd0|int|mult|days|date-md"  — format the bound value
 *   data-class-sign="pnlPct"         — toggle .pos/.neg/.flat class from the value sign
 *   data-list="orders|filter:rotate" — repeat <template> child with pipeline result
 *   data-empty="No rotation"         — empty-state label inside the table body
 *   data-show-if="orders|filter:rotate|count"  — show element only when truthy/non-empty
 *
 * Pipelines:  orders|filter:rotate|count  →  (orders rotate filter) → length
 *   filter:rotate / filter:buy            (orders[] only)
 *   sort:scanDate                         (descending by field)
 *   slice:N                               (first N)
 *   count                                 (length)
 *
 * Used by gen-status-page Time Machine and (later) the live grid so layout is
 * driven 100% by the embedded HTML template — no string concat in JS.
 */
(function () {
  'use strict';

  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    var keys = path.split('.');
    var v = obj;
    for (var i = 0; i < keys.length; i++) {
      if (v == null) return undefined;
      v = v[keys[i]];
    }
    return v;
  }

  function pipeline(data, expr) {
    if (!expr) return undefined;
    var parts = expr.split('|').map(function (s) { return s.trim(); });
    var v = getPath(data, parts[0]);
    for (var i = 1; i < parts.length; i++) {
      var op = parts[i];
      var colon = op.indexOf(':');
      var fn = colon >= 0 ? op.slice(0, colon) : op;
      var arg = colon >= 0 ? op.slice(colon + 1) : null;
      if (fn === 'filter') {
        if (!Array.isArray(v)) v = [];
        if (arg === 'rotate') v = v.filter(function (o) { return (o.action || '').toUpperCase() === 'ROTATE'; });
        else if (arg === 'buy') v = v.filter(function (o) { return (o.action || '').toUpperCase() !== 'ROTATE'; });
        else if (arg === 'positiveTriggered' && data && data.mCfg) {
          var thr = data.mCfg.breakevenPct || 999;
          v = v.filter(function (p) { var pnl = p.pnlPct != null ? p.pnlPct : (p.return_pct || 0); return pnl >= thr; });
        }
      } else if (fn === 'count') {
        v = Array.isArray(v) ? v.length : 0;
      } else if (fn === 'sort') {
        if (!Array.isArray(v)) v = [];
        v = v.slice().sort(function (a, b) {
          var av = (a && a[arg]) || '';
          var bv = (b && b[arg]) || '';
          if (typeof av === 'string' && typeof bv === 'string') return bv.localeCompare(av);
          return (bv || 0) - (av || 0);
        });
      } else if (fn === 'slice') {
        if (!Array.isArray(v)) v = [];
        v = v.slice(0, parseInt(arg, 10) || v.length);
      }
    }
    return v;
  }

  function fmt(v, format) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    switch (format) {
      case 'pct1':    return (isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(1) + '%' : '—');
      case 'pct2':    return (isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(2) + '%' : '—');
      case 'usd':     return (isFinite(n) ? '$' + n.toFixed(2) : '—');
      case 'usd0':    return (isFinite(n) ? '$' + Math.round(n) : '—');
      case 'int':     return (isFinite(n) ? String(Math.round(n)) : String(v));
      case 'mult':    return (isFinite(n) ? n.toFixed(2) + 'x' : '—');
      case 'days':    return (isFinite(n) ? n + 'd' : '—');
      case 'date-md': return (typeof v === 'string' && v.length >= 7 ? v.slice(5, 10) : '—');
      case 'upper':   return String(v).toUpperCase();
      default:        return String(v);
    }
  }

  function applySignClass(el, value) {
    el.classList.remove('pos', 'neg', 'flat');
    if (value > 0.001) el.classList.add('pos');
    else if (value < -0.001) el.classList.add('neg');
    else el.classList.add('flat');
  }

  function bind(root, data) {
    if (!root) return;

    // Simple value bindings
    root.querySelectorAll('[data-bind]').forEach(function (el) {
      var v = pipeline(data, el.dataset.bind);
      el.textContent = fmt(v, el.dataset.format);
    });

    // Conditional class on sign
    root.querySelectorAll('[data-class-sign]').forEach(function (el) {
      var v = pipeline(data, el.dataset.classSign);
      applySignClass(el, Number(v) || 0);
    });

    // Show / hide
    root.querySelectorAll('[data-show-if]').forEach(function (el) {
      var v = pipeline(data, el.dataset.showIf);
      var truthy = v && (Array.isArray(v) ? v.length > 0 : !!v);
      el.style.display = truthy ? '' : 'none';
    });

    // List repeat — must run last so its inner data-bind doesn't clobber outer rows
    root.querySelectorAll('[data-list]').forEach(function (container) {
      var arr = pipeline(data, container.dataset.list) || [];
      var tpl = container.querySelector(':scope > template') || container.querySelector('template');
      if (!tpl) return;
      var tbody = container.querySelector(':scope > tbody') || container.querySelector('tbody') || container;
      tbody.innerHTML = '';

      if (arr.length === 0) {
        var firstChild = tpl.content.firstElementChild;
        var colspan = firstChild && firstChild.children ? firstChild.children.length : 1;
        var er = document.createElement('tr');
        er.className = 'tm-empty-row';
        var td = document.createElement('td');
        td.colSpan = colspan;
        td.style.cssText = 'text-align:center;padding:.7rem .5rem;font-style:italic';
        td.textContent = container.dataset.empty || '—';
        er.appendChild(td);
        tbody.appendChild(er);
        return;
      }

      arr.forEach(function (item) {
        var clone = tpl.content.cloneNode(true);
        // Bind each row in its own scope (the row's data is the array item)
        bind(clone, item);
        tbody.appendChild(clone);
      });
    });
  }

  window.ModePanelBinder = { bind: bind, pipeline: pipeline, fmt: fmt };
})();
