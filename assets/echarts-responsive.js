/**
 * echarts-responsive.js
 * Patches ECharts instances for mobile readability.
 * Include AFTER echarts.min.js and AFTER all setOption() calls.
 *
 * What it does:
 * - Detects mobile viewport (<= 480px)
 * - Reduces font sizes in axis labels, titles, legends, and tooltips
 * - Hides axis ticks and reduces label density via interval
 * - Adjusts grid margins to prevent label clipping
 * - Fires resize on all instances after patching
 */
(function () {
  'use strict';

  var MOBILE_BP = 480;
  var TABLET_BP = 768;

  function isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  function isTablet() {
    return window.innerWidth <= TABLET_BP && window.innerWidth > MOBILE_BP;
  }

  function patchAxis(axis) {
    if (!axis) return;
    var axes = Array.isArray(axis) ? axis : [axis];
    axes.forEach(function (a) {
      if (!a) return;
      if (a.axisLabel) {
        if (isMobile()) {
          a.axisLabel.fontSize = Math.min(a.axisLabel.fontSize || 12, 8);
          a.axisLabel.rotate = a.axisLabel.rotate || 0;
          if (a.type === 'category' && a.data && a.data.length > 6) {
            a.axisLabel.interval = Math.ceil(a.data.length / 5) - 1;
          }
        } else if (isTablet()) {
          a.axisLabel.fontSize = Math.min(a.axisLabel.fontSize || 12, 10);
        }
      }
      if (a.axisTick && isMobile()) {
        a.axisTick.show = false;
      }
      // Truncate long category labels on mobile
      if (a.data && isMobile()) {
        a.axisLabel = a.axisLabel || {};
        var origFormatter = a.axisLabel.formatter;
        if (!origFormatter) {
          a.axisLabel.formatter = function (v) {
            return typeof v === 'string' && v.length > 8 ? v.substring(0, 7) + '\u2026' : v;
          };
        }
      }
    });
  }

  function patchSeries(series) {
    if (!series) return;
    series.forEach(function (s) {
      if (!s) return;
      // Reduce label font sizes
      if (s.label && isMobile()) {
        s.label.fontSize = Math.min(s.label.fontSize || 12, 9);
      }
      // Gauge: reduce detail/title sizes
      if (s.type === 'gauge') {
        if (s.detail && isMobile()) {
          s.detail.fontSize = Math.min(s.detail.fontSize || 28, 18);
        }
        if (s.title && isMobile()) {
          s.title.fontSize = Math.min(s.title.fontSize || 14, 10);
        }
      }
      // Radar: reduce indicator name font
      if (s.type === 'radar' && s.data) {
        // radar indicator names are on the radar option, not series
      }
      // Treemap: reduce label
      if (s.type === 'treemap' && s.label && isMobile()) {
        s.label.fontSize = Math.min(s.label.fontSize || 12, 8);
      }
      // Bar labels
      if (s.type === 'bar' && s.label && isMobile()) {
        s.label.fontSize = Math.min(s.label.fontSize || 12, 8);
      }
    });
  }

  function patchOption(opt) {
    if (!opt) return;

    // Title
    if (opt.title) {
      var titles = Array.isArray(opt.title) ? opt.title : [opt.title];
      titles.forEach(function (t) {
        if (t.textStyle && isMobile()) {
          t.textStyle.fontSize = Math.min(t.textStyle.fontSize || 16, 11);
        } else if (t.textStyle && isTablet()) {
          t.textStyle.fontSize = Math.min(t.textStyle.fontSize || 16, 12);
        }
      });
    }

    // Legend
    if (opt.legend) {
      var legends = Array.isArray(opt.legend) ? opt.legend : [opt.legend];
      legends.forEach(function (l) {
        if (isMobile()) {
          l.textStyle = l.textStyle || {};
          l.textStyle.fontSize = Math.min(l.textStyle.fontSize || 12, 8);
          l.itemWidth = Math.min(l.itemWidth || 25, 8);
          l.itemHeight = Math.min(l.itemHeight || 14, 8);
          l.itemGap = Math.min(l.itemGap || 10, 6);
        }
      });
    }

    // Tooltip
    if (opt.tooltip) {
      if (isMobile()) {
        opt.tooltip.textStyle = opt.tooltip.textStyle || {};
        opt.tooltip.textStyle.fontSize = Math.min(opt.tooltip.textStyle.fontSize || 14, 10);
        opt.tooltip.confine = true;
      }
    }

    // Grid (adjust margins to prevent clipping)
    if (opt.grid && isMobile()) {
      var grids = Array.isArray(opt.grid) ? opt.grid : [opt.grid];
      grids.forEach(function (g) {
        g.left = Math.max(g.left || 0, 35);
        g.right = Math.max(g.right || 0, 8);
        g.top = Math.max(g.top || 0, 8);
        g.bottom = Math.max(g.bottom || 0, 30);
      });
    }

    // Radar indicator names
    if (opt.radar) {
      var radars = Array.isArray(opt.radar) ? opt.radar : [opt.radar];
      radars.forEach(function (r) {
        if (r.indicator && isMobile()) {
          r.indicator.forEach(function (ind) {
            if (ind.name && ind.name.length > 10) {
              ind.name = ind.name.substring(0, 9) + '\u2026';
            }
          });
          r.radius = r.radius || '65%';
          // Shrink for mobile
          if (typeof r.radius === 'string' && parseInt(r.radius) > 60) {
            r.radius = '55%';
          }
          r.name = r.name || {};
          r.name.fontSize = Math.min((r.name && r.name.fontSize) || 12, 9);
        }
      });
    }

    patchAxis(opt.xAxis);
    patchAxis(opt.yAxis);
    patchSeries(opt.series);
  }

  function patchAllCharts() {
    if (typeof echarts === 'undefined') return;

    // Find all ECharts instances on the page
    var chartDivs = document.querySelectorAll('div[id*="Chart"], div[id*="chart"], div[id*="gauge"], div[id*="Gauge"], div[_echarts_instance_]');

    // Also try to get all instances via echarts internal registry
    // ECharts 5 stores instances; we can iterate DOM elements
    var allDivs = document.querySelectorAll('div[_echarts_instance_]');
    var processed = new Set();

    function processDom(el) {
      if (processed.has(el)) return;
      processed.add(el);
      var instance = echarts.getInstanceByDom(el);
      if (!instance) return;
      var opt = instance.getOption();
      if (!opt) return;
      patchOption(opt);
      instance.setOption(opt);
      instance.resize();
    }

    chartDivs.forEach(processDom);
    allDivs.forEach(processDom);

    // Fallback: query all divs with inline height that look like charts
    document.querySelectorAll('div[style*="height"]').forEach(function (el) {
      if (processed.has(el)) return;
      var instance = echarts.getInstanceByDom(el);
      if (instance) {
        processDom(el);
      }
    });
  }

  // Run on load and resize
  function init() {
    if (window.innerWidth > TABLET_BP) return; // Skip on desktop
    // Wait for charts to initialize
    setTimeout(patchAllCharts, 500);
    setTimeout(patchAllCharts, 1500); // Second pass for lazy-loaded charts
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      patchAllCharts();
    }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual trigger
  window.echartsResponsivePatch = patchAllCharts;
})();
