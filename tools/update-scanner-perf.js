#!/usr/bin/env node
/**
 * update-scanner-perf.js — Met à jour le bloc "Scanner Performance" dans index.html
 * Doit être lancé après chaque publication de rétrospective.
 *
 * v2 (2026-07-19) : piloté par le dataset data/retro-summary.json (source unique,
 * maintenu à chaque rétro) au lieu du scraping des pages HTML de rétro. L'ancienne
 * version reposait sur des regex ancrées sur des styles inline — quand le bloc a été
 * anglicisé, TOUTES les regex sont devenues des no-ops silencieux et le bloc est
 * resté figé (constat du 19/07 : bloc au 2 juillet, compteurs contradictoires 19/15/10,
 * lien vers 20260606, régime CRISIS). Règles v2 :
 *   - AUCUN chiffre en dur : tout vient de retro-summary.json + comptage des dossiers.
 *   - Remplacement par ANCRES structurelles (les commentaires HTML existants), pas par
 *     regex de style. Ancre introuvable = exit 1, jamais de no-op silencieux.
 *   - Assertions post-écriture (updated, note, lien, compteur unique) — exit 1 si échec.
 *
 * Usage: node tools/update-scanner-perf.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUMMARY_PATH = path.join(ROOT, 'data', 'retro-summary.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

function fail(msg) {
  console.error(`❌ update-scanner-perf: ${msg}`);
  process.exit(1);
}

// ── 1. Dataset ──────────────────────────────────────────────────────────────
if (!fs.existsSync(SUMMARY_PATH)) fail(`dataset manquant: ${SUMMARY_PATH}`);
const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
const retros = summary.retros || [];
const agg = summary.aggregate || {};
if (!retros.length) fail('retro-summary.json ne contient aucune rétro');

// Fraîcheur : la dernière entrée du dataset doit correspondre au dernier dossier
// scanner/retrospective/YYYYMMDD publié. Dataset en retard = on refuse de générer
// (c'est exactement le bug "bloc figé" qu'on veut rendre impossible).
const retroDirs = fs.readdirSync(path.join(ROOT, 'scanner', 'retrospective'))
  .filter(d => /^\d{8}$/.test(d)).sort();
const lastDir = retroDirs[retroDirs.length - 1];
const last = retros[retros.length - 1];
const lastCompact = last.date.replace(/-/g, '');
if (lastCompact !== lastDir) {
  fail(`dataset en retard: dernière rétro publiée ${lastDir}, dernière entrée dataset ${lastCompact}. Mettre à jour data/retro-summary.json d'abord.`);
}

// Compteur unique : le nombre d'entrées fait foi et doit être cohérent avec l'agrégat.
const nRetros = retros.length;
if (agg.total_retros !== nRetros) {
  fail(`compteur incohérent dans le dataset: retros.length=${nRetros} vs aggregate.total_retros=${agg.total_retros}`);
}

// ── 2. Valeurs dérivées ─────────────────────────────────────────────────────
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = iso => new Date(`${iso}T00:00:00Z`);
const fmtShort = iso => { const d = parseDate(iso); return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const fmtFull = iso => { const d = parseDate(iso); return `${months[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`; };

const updatedStr = fmtFull(last.date);
const periodStr = `${fmtShort(retros[0].date)} – ${fmtFull(last.date)}`;
const grade = last.grade; // tel que publié (l'astérisque « provisoire » inclus)
const retroUrl = `/scanner/retrospective/${lastCompact}/`;

const winRate = agg.overall_hit_rate_pct;
const avgReturn = agg.overall_avg_return_pct;
const totalSignals = agg.total_signals;
const totalResolved = agg.total_resolved;
if ([winRate, avgReturn, totalSignals, totalResolved].some(v => typeof v !== 'number')) {
  fail('aggregate incomplet dans retro-summary.json (hit rate / avg return / totals)');
}

const pf = last.profit_factor;
if (typeof pf !== 'number') fail(`profit_factor absent de l'entrée ${last.date} du dataset`);

// Régime de la dernière rétro : champ court explicite si présent, sinon dernier
// libellé de régime mentionné dans la description (l'état final de la semaine).
const REGIME_WORDS = ['EARLY RISK-OFF', 'RISK-ON', 'RISK-OFF', 'NEUTRAL', 'RECOVERY', 'CRISIS'];
function regimeLabel(entry) {
  if (entry.regime_label) return entry.regime_label;
  const up = String(entry.regime || '').toUpperCase();
  let best = null;
  for (const w of REGIME_WORDS) {
    const i = up.lastIndexOf(w);
    if (i >= 0 && (best === null || i > best.i)) best = { i, w };
  }
  return best ? best.w : '?';
}
const regime = regimeLabel(last);
const regimeColors = {
  'RISK-ON': '#10b981', 'NEUTRAL': '#f59e0b', 'RECOVERY': '#f59e0b',
  'EARLY RISK-OFF': '#f97316', 'RISK-OFF': '#ef4444', 'CRISIS': '#ef4444',
};
const regimeColor = regimeColors[(regime.split('(')[0] || '').trim()] || '#94a3b8';

const gradeColors = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626', F: '#dc2626' };
const gradeColor = gradeColors[grade[0]] || '#64748b';

const scanDirs = fs.readdirSync(path.join(ROOT, 'scanner')).filter(d => /^\d{8}$/.test(d)).length;

// ── 3. Données charts (100% dataset) ────────────────────────────────────────
const chartLabels = retros.map(r => fmtShort(r.date));
const tp1ByRetro = retros.map(r => (r.strategy_breakdown || []).reduce((s, x) => s + (x.tp1_count || 0), 0));
const stopByRetro = retros.map(r => (r.strategy_breakdown || []).reduce((s, x) => s + (x.stopped_count || 0), 0));
const otherByRetro = retros.map((r, i) => Math.max(0, (r.resolved || 0) - tp1ByRetro[i] - stopByRetro[i]));
const openByRetro = retros.map(r => Math.max(0, (r.total_signals || 0) - (r.resolved || 0)));
const hrByRetro = retros.map(r => r.hit_rate_pct);
const resolvedPctByRetro = retros.map(r => r.total_signals ? Math.round(1000 * r.resolved / r.total_signals) / 10 : 0);

// Top picks : meilleurs / pires trades publiés dans les rétros.
const picks = [];
for (const r of retros) {
  if (r.best_trade && typeof r.best_trade.return_pct === 'number') picks.push({ t: r.best_trade.ticker, v: r.best_trade.return_pct });
  if (r.worst_trade && typeof r.worst_trade.return_pct === 'number') picks.push({ t: r.worst_trade.ticker, v: r.worst_trade.return_pct });
}
picks.sort((a, b) => a.v - b.v);
const bottom5 = picks.slice(0, 5);
const top5 = picks.slice(-5);
const pickRows = [...bottom5, ...top5];
const pickLabels = pickRows.map((p, i) => i === pickRows.length - 1 ? `${p.t} 🏆` : p.t);
const pickData = pickRows.map((p, i) => ({
  value: p.v,
  itemStyle: { color: i === pickRows.length - 1 ? 'oklch(72% 0.13 237)' : (p.v < 0 ? 'oklch(58% 0.16 25)' : 'oklch(60% 0.12 155)') },
}));
const bestPick = picks[picks.length - 1] || { t: '?', v: 0 };
const worstPick = picks[0] || { t: '?', v: 0 };

const fmtSigned = v => (v > 0 ? '+' : '') + v + '%';

// ── 4. Génération HTML du bloc ──────────────────────────────────────────────
const BLOCK_START = '<!-- ===== SCANNER PERFORMANCE DASHBOARD (COLLAPSIBLE) ===== -->';
const BLOCK_END = '<!-- ===== END SCANNER PERFORMANCE DASHBOARD ===== -->';

const kpiCardOpen = `<div style="
                  background: rgba(255, 255, 255, 0.06);
                  border-radius: 10px;
                  padding: 0.6rem;
                  text-align: center;
                ">`;
const kpiLabel = txt => `<div style="
                    font-size: 0.6rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                  ">
                ${txt}
              </div>`;

const blockHtml = `${BLOCK_START}
      <div class="scanner-perf-card" id="scannerPerfCard">
        <button type="button" class="scanner-perf-header" onclick="toggleScannerDashboard()" aria-expanded="false" aria-controls="scanner-perf-content" style="width:100%;background:transparent;border:none;text-align:left;cursor:pointer;padding:0;">
          <div style="
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">
            <i class="fa-solid fa-chart-pie" style="color: #fff; font-size: 0.9rem"></i>
          </div>
          <div style="flex-grow: 1;">
            <div style="font-weight: 800; font-size: 1rem; color: #fff; line-height: 1.2;">
              Scanner Performance
            </div>
            <div style="font-size: 0.68rem; color: #94a3b8">
              Updated: ${updatedStr} — Period: ${periodStr} (${nRetros} cumulative retros)
            </div>
          </div>
          <div style="
                background: ${gradeColor};
                padding: 4px 12px;
                border-radius: 8px;
                font-weight: 900;
                font-family: 'JetBrains Mono', monospace;
                font-size: 1rem;
                color: #fff;
                margin-right: 5px;
              ">
            ${grade}</div>
          <i class="fa-solid fa-chevron-down toggle-icon" aria-hidden="true"></i>
        </button>

        <div class="scanner-perf-content" id="scanner-perf-content">
          <!-- Narrative Framing -->
          <div style="background:oklch(46% 0.13 237 / 0.10); border:1px solid oklch(46% 0.13 237 / 0.30); border-radius:8px; padding:0.6rem 0.9rem; margin-bottom:1rem; font-size:0.78rem; color:#cbd5e1; line-height:1.55;">
            <strong style="color:#fff;">How to read this:</strong> our A+ setups target R:R of 1:1.5 or better. The <strong>${winRate}% hit rate is cumulative</strong> across all ${nRetros} retros (${totalSignals} signals, ${totalResolved} resolved) — <em>not</em> the latest week, which can swing wildly. With positive R:R we need fewer wins than losses for positive expectancy; what matters is the <strong style="color:oklch(70% 0.12 155);">size of wins vs the size of losses</strong> and the trend across retros. Latest retro (${grade}): hit rate ${last.hit_rate_pct}%, avg return ${fmtSigned(last.avg_return_pct)}, PF ${pf} on resolved trades. <a href="/scanner/retrospective/" style="color:oklch(72% 0.13 237); text-decoration:underline;">See full methodology + every retro →</a>
          </div>

          <!-- KPI Row -->
          <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 0.6rem;
                margin-bottom: 1.25rem;
              ">
            ${kpiCardOpen}
              ${kpiLabel('Hit Rate')}
              <div style="font-size: 1.5rem; font-weight: 900; color: #f59e0b">
                ${winRate}%</div>
              <div style="font-size: 0.6rem; color: #64748b">${totalResolved} resolved signals — ${nRetros} retros</div>
            </div>
            ${kpiCardOpen}
              ${kpiLabel('Avg Return')}
              <div style="font-size: 1.5rem; font-weight: 900; color: ${avgReturn >= 0 ? '#10b981' : '#ef4444'}">
                ${fmtSigned(avgReturn)}</div>
              <div style="font-size: 0.6rem; color: #64748b">Per resolved signal — all retros</div>
            </div>
            ${kpiCardOpen}
              ${kpiLabel('Scans')}
              <div style="font-size: 1.5rem; font-weight: 900; color: #fff">
                ${scanDirs}
              </div>
              <div style="font-size: 0.6rem; color: #64748b">${totalSignals} signals • ${nRetros} retros</div>
            </div>
            ${kpiCardOpen}
              ${kpiLabel('Profit Factor')}
              <div style="font-size: 1.5rem; font-weight: 900; color: ${pf >= 1 ? '#10b981' : '#ef4444'}">
                ${pf}×</div>
              <div style="font-size: 0.6rem; color: #64748b">Latest retro — resolved trades</div>
            </div>
            ${kpiCardOpen}
              ${kpiLabel('Regime')}
              <div style="font-size: 1.1rem; font-weight: 900; color: ${regimeColor}">
                ${regime}
              </div>
              <div style="font-size: 0.6rem; color: #64748b">Latest retro close</div>
            </div>
          </div>

          <!-- Charts Row -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem">
            <div style="
                  background: rgba(255, 255, 255, 0.04);
                  border-radius: 12px;
                  padding: 0.75rem;
                ">
              <div style="
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                  ">
                <i class="fa-solid fa-trophy" style="margin-right: 4px; color: #f59e0b"></i>Top Picks — P&amp;L (%)
              </div>
              <div id="scannerTopChart" style="width: 100%; height: 180px"></div>
            </div>
            <div style="
                  background: rgba(255, 255, 255, 0.04);
                  border-radius: 12px;
                  padding: 0.75rem;
                ">
              <div style="
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                  ">
                <i class="fa-solid fa-bullseye" style="margin-right: 4px; color: #10b981"></i>Outcomes by Retro
              </div>
              <div id="scannerResultsChart" style="width: 100%; height: 180px"></div>
            </div>
          </div>

          <!-- Score by Scan -->
          <div style="
                margin-top: 1rem;
                background: rgba(255, 255, 255, 0.04);
                border-radius: 12px;
                padding: 0.75rem;
              ">
            <div style="
                  font-size: 0.72rem;
                  font-weight: 700;
                  color: #94a3b8;
                  margin-bottom: 0.5rem;
                  text-transform: uppercase;
                  letter-spacing: 0.04em;
                ">
              <i class="fa-solid fa-gauge-high" style="margin-right: 4px; color: oklch(72% 0.13 237)"></i>Hit Rate &amp; Resolved Positions Trend
            </div>
            <div id="scannerScoreChart" style="width: 100%; height: 160px"></div>
          </div>

          <div style="text-align: center; margin-top: 1rem">
            <a href="${retroUrl}" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  color: #94a3b8;
                  font-size: 0.8rem;
                  text-decoration: none;
                  padding: 8px 16px;
                  border: 1px solid #334155;
                  border-radius: 8px;
                  transition: 0.2s;
                " onmouseover="
                  this.style.borderColor = 'oklch(46% 0.13 237)';
                  this.style.color = 'oklch(72% 0.13 237)';
                " onmouseout="
                  this.style.borderColor = '#334155';
                  this.style.color = '#94a3b8';
                ">
              <i class="fa-solid fa-arrow-right"></i> View full
              retrospective
            </a>
          </div>
        </div>
      </div>
      ${BLOCK_END}`;

// ── 5. Génération du script charts ──────────────────────────────────────────
const CHARTS_START = '<!-- Scanner Performance Charts -->';
const J = v => JSON.stringify(v);

const chartsHtml = `${CHARTS_START}
  <script>
    // Initialize scanner charts when tab becomes visible
    // (données générées par tools/update-scanner-perf.js depuis data/retro-summary.json)
    var scannerChartsInit = false;
    function initScannerCharts() {
      if (scannerChartsInit) return;
      if (!document.getElementById("scannerTopChart")) return;
      scannerChartsInit = true;

      var darkText = "#94a3b8";
      var darkAxis = "#334155";

      // === TOP PICKS P&L CHART ===
      var topChart = echarts.init(document.getElementById("scannerTopChart"));
      topChart.setOption({
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          textStyle: { color: "#e2e8f0", fontSize: 11 },
        },
        grid: { left: 50, right: 12, top: 8, bottom: 24 },
        xAxis: {
          type: "value",
          axisLine: { lineStyle: { color: darkAxis } },
          axisLabel: { color: darkText, fontSize: 10, formatter: "{value}%" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
        },
        yAxis: {
          type: "category",
          data: ${J(pickLabels)},
          axisLine: { lineStyle: { color: darkAxis } },
          axisLabel: { color: darkText, fontSize: 10 },
        },
        series: [
          {
            type: "bar",
            barWidth: 14,
            data: ${J(pickData)},
            label: {
              show: true,
              position: "right",
              color: "#e2e8f0",
              fontSize: 10,
              formatter: function (p) {
                return (p.value > 0 ? "+" : "") + p.value + "%";
              },
            },
          },
        ],
      });

      // === OUTCOMES BY RETRO CHART ===
      var resultsChart = echarts.init(
        document.getElementById("scannerResultsChart"),
      );
      resultsChart.setOption({
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          textStyle: { color: "#e2e8f0", fontSize: 11 },
        },
        legend: {
          data: ["TP1 Hit", "Stop Hit", "Other exit", "Open / no fill"],
          textStyle: { color: darkText, fontSize: 9 },
          bottom: 0,
          itemWidth: 10,
          itemHeight: 10,
        },
        grid: { left: 36, right: 12, top: 8, bottom: 40 },
        xAxis: {
          type: "category",
          data: ${J(chartLabels)},
          axisLine: { lineStyle: { color: darkAxis } },
          axisLabel: { color: darkText, fontSize: 8, rotate: 40 },
        },
        yAxis: {
          type: "value",
          axisLine: { lineStyle: { color: darkAxis } },
          axisLabel: { color: darkText, fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
        },
        series: [
          {
            name: "TP1 Hit",
            type: "bar",
            stack: "a",
            data: ${J(tp1ByRetro)},
            itemStyle: { color: "oklch(60% 0.12 155)" },
          },
          {
            name: "Stop Hit",
            type: "bar",
            stack: "a",
            data: ${J(stopByRetro)},
            itemStyle: { color: "oklch(58% 0.16 25)" },
          },
          {
            name: "Other exit",
            type: "bar",
            stack: "a",
            data: ${J(otherByRetro)},
            itemStyle: { color: "#64748b" },
          },
          {
            name: "Open / no fill",
            type: "bar",
            stack: "a",
            data: ${J(openByRetro)},
            itemStyle: { color: "oklch(72% 0.13 237)", opacity: 0.6 },
          },
        ],
      });

      // === SCORE & QUALITY CHART ===
      var scoreChart = echarts.init(
        document.getElementById("scannerScoreChart"),
      );
      scoreChart.setOption({
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          textStyle: { color: "#e2e8f0", fontSize: 11 },
        },
        legend: {
          data: ["Hit Rate (%)", "% Résolu"],
          textStyle: { color: darkText, fontSize: 9 },
          bottom: 0,
          itemWidth: 10,
          itemHeight: 10,
        },
        grid: { left: 40, right: 40, top: 8, bottom: 40 },
        xAxis: {
          type: "category",
          data: ${J(chartLabels)},
          axisLine: { lineStyle: { color: darkAxis } },
          axisLabel: { color: darkText, fontSize: 8, rotate: 40 },
        },
        yAxis: [
          {
            type: "value",
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: darkAxis } },
            axisLabel: { color: "oklch(72% 0.13 237)", fontSize: 10, formatter: "{value}%" },
            splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
          },
          {
            type: "value",
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: darkAxis } },
            axisLabel: { color: "oklch(75% 0.13 75)", fontSize: 10, formatter: "{value}%" },
          },
        ],
        series: [
          {
            name: "Hit Rate (%)",
            type: "line",
            data: ${J(hrByRetro)},
            smooth: true,
            symbolSize: 6,
            lineStyle: { width: 3, color: "oklch(72% 0.13 237)" },
            itemStyle: { color: "oklch(72% 0.13 237)" },
            markLine: {
              silent: true,
              symbol: "none",
              data: [{ yAxis: 50, name: "Cible 50%", lineStyle: { color: "#64748b", type: "dashed" } }],
              label: { color: "#94a3b8", fontSize: 10, formatter: "50%" },
            },
            areaStyle: {
              color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: "oklch(46% 0.13 237 / 0.25)" }, { offset: 1, color: "oklch(46% 0.13 237 / 0)" }] },
            },
          },
          {
            name: "% Résolu",
            type: "bar",
            yAxisIndex: 1,
            data: ${J(resolvedPctByRetro)},
            itemStyle: { color: "#f59e0b", borderRadius: [4, 4, 0, 0], opacity: 0.6 },
          },
        ],
      });

      // Resize on window resize
      window.addEventListener("resize", function () {
        topChart.resize();
        resultsChart.resize();
        scoreChart.resize();
      });
    }

    // Init charts when scanner tab is opened
    var origSwitchTab = switchTab;
    switchTab = function (tab) {
      origSwitchTab(tab);
      // Removed automatic initScannerCharts here to support collapsible lazy-loading
    };
    // Also init if scanner is default tab from URL
    if (
      new URLSearchParams(window.location.search).get("tab") === "scanner"
    ) {
      // Still allow deep-link init if needed, but the toggle handles it better
    }
  </script>`;

// ── 6. Remplacements par ancres ─────────────────────────────────────────────
let html = fs.readFileSync(INDEX_PATH, 'utf8');

function replaceBetween(src, startMarker, endMarker, replacement, label) {
  const i = src.indexOf(startMarker);
  if (i < 0) fail(`ancre introuvable (${label}): ${startMarker}`);
  const j = src.indexOf(endMarker, i);
  if (j < 0) fail(`ancre de fin introuvable (${label}): ${endMarker}`);
  return src.slice(0, i) + replacement + src.slice(j + endMarker.length);
}

html = replaceBetween(html, BLOCK_START, BLOCK_END, blockHtml, 'bloc dashboard');
html = replaceBetween(html, CHARTS_START, '</script>', chartsHtml, 'script charts');

// Bannière : compteur de rétros partagé.
const bannerRe = /\d+-retro performance dashboard/;
if (!bannerRe.test(html)) fail('bannière "N-retro performance dashboard" introuvable');
html = html.replace(bannerRe, `${nRetros}-retro performance dashboard`);

fs.writeFileSync(INDEX_PATH, html);

// ── 7. Assertions post-écriture ─────────────────────────────────────────────
const out = fs.readFileSync(INDEX_PATH, 'utf8');
const block = out.slice(out.indexOf(BLOCK_START), out.indexOf(BLOCK_END));
const asserts = [
  [`updated_at = ${updatedStr}`, block.includes(`Updated: ${updatedStr}`)],
  [`note latest = ${grade}`, block.includes(`>\n            ${grade}</div>`)],
  [`lien = ${retroUrl}`, block.includes(`href="${retroUrl}"`)],
  [`régime = ${regime}`, block.includes(regime)],
  [`compteur unique = ${nRetros} (bloc)`, [...block.matchAll(/\b(\d+)[ -](?:cumulative retros|retros\b|rétros)/g)].every(m => Number(m[1]) === nRetros)],
  [`compteur unique = ${nRetros} (bannière)`, out.includes(`${nRetros}-retro performance dashboard`)],
];
let ok = true;
console.log('=== Assertions bloc Scanner Performance ===');
for (const [label, pass] of asserts) {
  console.log(`${pass ? '✅' : '❌'} ${label}`);
  if (!pass) ok = false;
}
console.log(`\nUpdated: ${updatedStr} | Rétros: ${nRetros} | Hit rate: ${winRate}% | Avg return: ${fmtSigned(avgReturn)} | PF (dernière rétro): ${pf} | Régime: ${regime}`);
console.log(`Best pick: ${bestPick.t} ${fmtSigned(bestPick.v)} | Worst pick: ${worstPick.t} ${fmtSigned(worstPick.v)} | Scans: ${scanDirs}`);
if (!ok) fail('assertions post-écriture en échec');
console.log('\n✅ index.html mis à jour depuis data/retro-summary.json.');
