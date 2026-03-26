#!/usr/bin/env node
/**
 * gen-status-page.js — Generates scanner/status/index.html from data.
 *
 * Single source of truth: all KPIs, charts, tables, descriptions
 * are computed from backtest-trades.json + modes-config.json.
 *
 * Usage: node tools/gen-status-page.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODES_CFG = path.join(ROOT, 'data/modes-config.json');
const TRADES = path.join(ROOT, 'data/backtest-trades.json');
const RESULTS = path.join(ROOT, 'data/backtest-results.json');
const MANIFEST = path.join(ROOT, 'scanner/status/manifest.json');
const METRICS_FILE = path.join(ROOT, 'data/scanner-metrics.json');
const POSITIONS_FILE = path.join(ROOT, 'data/scanner-positions.json');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const OUT = path.join(ROOT, 'scanner/status/index.html');

// ─── Compute metrics from trade list ────────────────────────────────────────
function computeMetrics(trades, portfolioSize) {
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalReturn = trades.reduce((s, t) => s + (t.pnlPct || 0) / portfolioSize, 0);

  let equity = 0, peak = 0, maxDD = 0;
  const equityCurve = [{ date: null, value: 100 }];
  for (const t of trades) {
    equity += (t.pnlPct || 0) / portfolioSize;
    if (equity > peak) peak = equity;
    if (peak - equity > maxDD) maxDD = peak - equity;
    equityCurve.push({ date: t.scanDate, value: +(100 + equity).toFixed(2) });
  }

  const grossWin = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? 99 : 0);
  const wr = trades.length ? +((wins.length / trades.length) * 100).toFixed(1) : 0;
  const holdDays = trades.filter(t => t.holdDays).map(t => t.holdDays);
  const avgHold = holdDays.length ? +(holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(1) : 0;
  const ret = +totalReturn.toFixed(2);
  const dd = +maxDD.toFixed(2);
  const sharpe = dd > 0 ? +(ret / dd).toFixed(2) : (ret > 0 ? 999 : 0);
  const calmar = dd > 0 ? Math.round(ret / dd) : (ret > 0 ? 999 : 0);

  return { ret, dd: +(-dd).toFixed(2), wr, pf, trades: trades.length, avgHold, sharpe, calmar, equityCurve };
}

// ─── Unique dates from equity curve ─────────────────────────────────────────
function equityDatesValues(curve) {
  const byDate = {};
  for (const p of curve) {
    if (p.date) byDate[p.date] = p.value;
  }
  const dates = Object.keys(byDate).sort();
  return { dates: dates.map(d => d.slice(5).replace('-', '/')), values: dates.map(d => byDate[d]) };
}

// ─── Build HTML ─────────────────────────────────────────────────────────────
function main() {
  const config = JSON.parse(fs.readFileSync(MODES_CFG));
  let allTrades = {};
  try { allTrades = JSON.parse(fs.readFileSync(TRADES)); } catch (_) {}
  let results = {};
  try { results = JSON.parse(fs.readFileSync(RESULTS)); } catch (_) {}

  // Read manifest for timestamped image filenames
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST)); } catch (_) {}
  const imgGrowth = manifest['mode-growth'] || 'mode-growth.png';
  const imgCalmar = manifest['mode-calmar'] || 'mode-calmar.png';
  const imgZero = manifest['mode-zero'] || 'mode-zero.png';
  const imgDailyCard = manifest['daily-card'] || null;

  // Load live data (positions + metrics)
  let liveMetrics = {};
  try { liveMetrics = JSON.parse(fs.readFileSync(METRICS_FILE)); } catch (_) {}
  let livePositions = [];
  try {
    const posData = JSON.parse(fs.readFileSync(POSITIONS_FILE));
    livePositions = posData.open_positions || [];
  } catch (_) {}

  // Extract latest scan signals
  let latestSignals = [];
  try {
    const scanDirs = fs.readdirSync(SCANNER_DIR).filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
    if (scanDirs[0]) {
      const scanHtml = fs.readFileSync(path.join(SCANNER_DIR, scanDirs[0], 'index.html'), 'utf8');
      const m = scanHtml.match(/id="synthese"[\s\S]{0,15000}/);
      if (m) {
        const rows = m[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, '').replace(/,/g, '.').trim());
          if (cells.length < 4) continue;
          const ticker = cells.find(c => /^[A-Z]{1,5}$/.test(c.trim()));
          if (!ticker) continue;
          const score = cells.map(c => parseFloat(c)).find(n => n >= 70 && n <= 100);
          const stratRaw = cells.find(c => /momentum|squeeze|breakout|pullback/i.test(c)) || '';
          const pf = cells.filter(c => /^\$[\d.]/.test(c.trim()));
          latestSignals.push({
            ticker: ticker.trim(), score: score || 0, strategy: stratRaw.trim(),
            entry: pf[0] || '—', stop: pf[1] || '—', tp1: pf[2] || '—',
          });
        }
      }
      latestSignals._scanDir = scanDirs[0];
    }
  } catch (_) {}

  const modeMap = { growth: 'growth', calmar: 'calmar', zero: 'sharpe' };
  const modes = {};
  for (const [id, cfg] of Object.entries(config.modes)) {
    const tradeKey = modeMap[id] || id;
    const trades = allTrades[tradeKey] || [];
    modes[id] = { cfg, trades, m: computeMetrics(trades, cfg.portfolioSize) };
  }

  const g = modes.growth.m, ca = modes.calmar.m, z = modes.zero.m;
  const totalCombos = results.total_combinations || 126000;
  const totalScans = results.total_scans || 25;
  const totalTickers = results.total_tickers || 103;
  const totalSetups = results.total_setups || 161;
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
  const todayFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Scan date range
  const allDates = [...(modes.growth.trades), ...(modes.calmar.trades), ...(modes.zero.trades)]
    .map(t => t.scanDate).filter(Boolean).sort();
  const firstDate = allDates[0] || '2026-02-15';
  const lastDate = allDates[allDates.length - 1] || '2026-03-24';
  const daySpan = Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000);

  // Best values for highlight
  function best(a, b, c, higher = true) {
    const vals = [a, b, c];
    const best = higher ? Math.max(...vals) : Math.min(...vals.map(Math.abs));
    return vals.map(v => (higher ? v === best : Math.abs(v) === best) ? ' class="best"' : '');
  }

  const bRet = best(g.ret, ca.ret, z.ret);
  const bDD = best(Math.abs(g.dd), Math.abs(ca.dd), Math.abs(z.dd), false);
  const bSharpe = best(g.sharpe, ca.sharpe, z.sharpe);
  const bCalmar = best(g.calmar, ca.calmar, z.calmar);
  const bWR = best(g.wr, ca.wr, z.wr);
  const bPF = best(g.pf, ca.pf, z.pf);
  const bTrades = best(g.trades, ca.trades, z.trades);

  // Equity curve data for ECharts
  const gEC = equityDatesValues(g.equityCurve);
  const caEC = equityDatesValues(ca.equityCurve);
  const zEC = equityDatesValues(z.equityCurve);

  function modeDesc(id, cfg) {
    return [`P${cfg.portfolioSize}`, `Top${cfg.topN}`, `H${cfg.horizon}j`, cfg.filterName, cfg.rotation,
      cfg.partialTP ? 'PTP' : null, cfg.trailingStop ? 'Trail' : null].filter(Boolean).join(' / ');
  }

  function filterLabel(f) {
    return { all: 'Toutes', no_sq: 'Toutes sauf Short Squeeze', momentum_only: 'Momentum uniquement', breakout_only: 'Breakout uniquement', no_sq_pb: 'Sans SQ ni PB' }[f] || f;
  }

  function rotationLabel(r) {
    return { none: 'Aucune', daily_max1: 'Max 1/jour (marge +5)', daily_max2: 'Max 2/jour', aggressive: 'Agressive' }[r] || r;
  }

  function kpiTile(value, label, color) {
    return `<div class="kpi-card"><div class="kpi-value" style="color:${color}">${value}</div><div class="kpi-label">${label}</div></div>`;
  }

  function kpiGrid(m) {
    return `<div class="kpi-grid">
      ${kpiTile(`+${m.ret}%`, 'Return', '#059669')}
      ${kpiTile(`${m.dd}%`, 'Max DD', '#dc2626')}
      ${kpiTile(m.sharpe, 'Sharpe', '#2563eb')}
      ${kpiTile(`${m.wr}%`, 'Win Rate', '#7c3aed')}
      ${kpiTile(`${m.pf}x`, 'Profit Factor', '#059669')}
      ${kpiTile(m.trades, 'Trades', '#0891b2')}
      ${kpiTile(`${m.avgHold}j`, 'Hold Moy.', '#f59e0b')}
      ${kpiTile(m.calmar, 'Calmar', '#6366f1')}
    </div>`;
  }

  // ── Build trade table for a mode ──
  function tradesTable(trades, modeColor, modeLabel) {
    if (!trades.length) return '<p style="color:#94a3b8;font-style:italic">Aucun trade pour ce mode.</p>';
    const statusBadge = (s) => {
      const map = { tp1: ['badge-tp1','&#x2705; TP1'], tp2: ['badge-tp2','&#x1F3AF; TP2'], sl: ['badge-sl','&#x274C; SL'],
        expired: ['badge-expired','&#x23F3; Expir&eacute;'], rotated: ['badge-rotated','&#x1F504; Rotat&eacute;'],
        tp1_partial: ['badge-tp1_partial','&#x2705; TP1&frac12;'], open: ['badge-open','&#x1F7E2; Ouvert'] };
      const [cls, lbl] = map[s] || ['badge-open', s || '—'];
      return `<span class="badge-sm ${cls}">${lbl}</span>`;
    };
    const sorted = [...trades].sort((a, b) => (a.scanDate || '').localeCompare(b.scanDate || ''));
    return `
    <details style="margin:1.5rem 0" open>
      <summary style="cursor:pointer;font-weight:700;font-size:.95rem;color:#334155;padding:.5rem 0">
        <i class="fas fa-table" style="color:${modeColor}"></i> Historique des trades &mdash; ${modeLabel} (${trades.length})
      </summary>
      <table class="status-table">
        <thead><tr>
          <th style="text-align:center">#</th><th>Ticker</th><th>Date Scan</th><th>Strat.</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Dur&eacute;e</th><th>Statut</th>
        </tr></thead>
        <tbody>
        ${sorted.map((t, i) => {
          const pnl = t.pnlPct || 0;
          const retClass = pnl > 0 ? 'pnl-pos' : pnl < 0 ? 'pnl-neg' : '';
          return `<tr>
            <td style="text-align:center;color:#94a3b8;font-size:.8rem">${i + 1}</td>
            <td class="ticker-cell">${t.ticker || '—'}</td>
            <td style="font-size:.8rem;color:#64748b">${t.scanDate || '—'}</td>
            <td style="font-size:.8rem;color:#64748b">${t.strategy || '—'}</td>
            <td style="font-weight:600">$${(t.actualEntry || 0).toFixed(2)}</td>
            <td style="font-weight:600">${t.exitPrice ? '$' + t.exitPrice.toFixed(2) : '—'}</td>
            <td class="${retClass}">${pnl > 0 ? '+' : ''}${pnl}%</td>
            <td style="font-size:.8rem;color:#64748b;text-align:center">${t.holdDays || 0}j</td>
            <td>${statusBadge(t.status)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </details>`;
  }

  function configGrid(cfg) {
    const ptp = cfg.partialTP ? '<span style="color:#059669"><i class="fas fa-check"></i> Oui (50% TP1)</span>' : 'Non';
    const trail = cfg.trailingStop ? '<span style="color:#059669"><i class="fas fa-check"></i> Oui (BE apr&egrave;s TP1)</span>' : 'Non';
    return `<div class="config-box">
      <h4><i class="fas fa-gear"></i> Configuration</h4>
      <div class="config-grid">
        <div class="config-item"><span class="config-key">Portfolio</span><span class="config-val">${cfg.portfolioSize} positions</span></div>
        <div class="config-item"><span class="config-key">Signaux/Scan</span><span class="config-val">Top ${cfg.topN}</span></div>
        <div class="config-item"><span class="config-key">Score Min</span><span class="config-val">${cfg.minScore > 0 ? cfg.minScore : 'Aucun'}</span></div>
        <div class="config-item"><span class="config-key">Strat&eacute;gies</span><span class="config-val">${filterLabel(cfg.filterName)}</span></div>
        <div class="config-item"><span class="config-key">Rotation</span><span class="config-val">${rotationLabel(cfg.rotation)}</span></div>
        <div class="config-item"><span class="config-key">Horizon</span><span class="config-val">${cfg.horizon} jours</span></div>
        <div class="config-item"><span class="config-key">Partial TP</span><span class="config-val">${ptp}</span></div>
        <div class="config-item"><span class="config-key">Trailing Stop</span><span class="config-val">${trail}</span></div>
      </div>
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="fr" data-tags="technique,formation,trade-idea,us,eu,asia,etf" data-tab="scanner">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scanner Strategy Guide &mdash; 3 Modes Optimis&eacute;s | Market Watch</title>
  <meta name="description" content="Guide des 3 strat&eacute;gies optimis&eacute;es du scanner Market Watch. Bas&eacute; sur ${totalCombos.toLocaleString('fr')} backtests.">
  <meta property="og:title" content="Scanner Strategy Guide &mdash; 3 Modes Optimis&eacute;s">
  <meta property="og:description" content="3 strat&eacute;gies backtested sur ${totalCombos.toLocaleString('fr')} combinaisons. Return +${g.ret}%, WR ${g.wr}%.">
  <meta property="og:image" content="https://articles.market-watch.xyz/scanner/status/${imgDailyCard || imgGrowth}">
  <meta name="twitter:card" content="summary_large_image">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
  <link rel="stylesheet" href="/assets/report.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    .mode-tabs{display:flex;gap:0;border-radius:16px;overflow:hidden;margin:2rem 0;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .mode-tab{flex:1;padding:1rem 1.5rem;text-align:center;cursor:pointer;font-weight:700;font-size:.95rem;transition:all .25s;border:none;background:#f1f5f9;color:#64748b}
    .mode-tab:hover{background:#e2e8f0}
    .mode-tab.active{color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    .mode-tab[data-mode="growth"].active{background:linear-gradient(135deg,#059669,#10b981)}
    .mode-tab[data-mode="calmar"].active{background:linear-gradient(135deg,#2563eb,#3b82f6)}
    .mode-tab[data-mode="zero"].active{background:linear-gradient(135deg,#7c3aed,#8b5cf6)}
    .mode-panel{display:none;animation:fadeIn .3s ease}
    .mode-panel.active{display:block}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;margin:1.5rem 0}
    .kpi-card{background:#fff;border-radius:14px;padding:.8rem .6rem;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.06);border:1px solid #e2e8f0;overflow:hidden}
    .kpi-value{font-size:1.3rem;font-weight:800;line-height:1.2;white-space:nowrap}
    .kpi-label{font-size:.65rem;color:#64748b;margin-top:.25rem;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
    .config-box{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:1.5rem;margin:1.5rem 0}
    .config-box h4{margin:0 0 .8rem;font-size:1rem;color:#334155}
    .config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem}
    .config-item{display:flex;justify-content:space-between;padding:.5rem .8rem;background:#fff;border-radius:8px;border:1px solid #e2e8f0}
    .config-key{font-weight:600;color:#475569;font-size:.85rem}
    .config-val{font-weight:700;color:#0f172a;font-size:.85rem}
    .walkforward-box{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:14px;padding:1.5rem;margin:1.5rem 0}
    .walkforward-box h4{color:#92400e;margin:0 0 .6rem}
    .wf-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;text-align:center}
    .wf-item{padding:.8rem;background:rgba(255,255,255,.7);border-radius:10px}
    .wf-label{font-size:.7rem;color:#92400e;text-transform:uppercase;letter-spacing:.5px}
    .wf-value{font-size:1.2rem;font-weight:800;color:#78350f}
    .how-box{background:#f0fdf4;border:2px solid #86efac;border-radius:14px;padding:1.5rem;margin:1.5rem 0}
    .how-box h4{color:#166534;margin:0 0 .8rem}
    .how-box ol{margin:0;padding-left:1.2rem;color:#15803d}
    .how-box li{margin-bottom:.6rem;line-height:1.5}
    .disclaimer-sweep{background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:1.2rem;margin:1.5rem 0;font-size:.85rem;color:#991b1b}
    .hero-sweep{text-align:center;padding:3rem 1.5rem 2rem;background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);color:#fff;border-radius:0 0 24px 24px;margin:-1rem -1rem 2rem}
    .hero-sweep h1{font-size:2.2rem;font-weight:900;margin:0 0 .5rem;letter-spacing:-.02em}
    .hero-sweep .subtitle{font-size:1.1rem;color:#94a3b8;margin:0 0 1.5rem}
    .hero-badges{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin:1rem 0}
    .hero-badge{padding:.4rem 1rem;border-radius:20px;font-size:.8rem;font-weight:700}
    .badge-green{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)}
    .badge-blue{background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3)}
    .badge-purple{background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3)}
    .badge-amber{background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
    .setup-img{width:100%;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.1);margin:1.5rem 0;border:1px solid #e2e8f0}
    .echart-box{width:100%;height:320px;margin:1rem 0;border-radius:12px;background:#fff}
    .section-title{font-size:1.4rem;font-weight:800;color:#0f172a;margin:2.5rem 0 1rem;padding-bottom:.5rem;border-bottom:3px solid #e2e8f0}
    .updated-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .8rem;border-radius:20px;background:rgba(255,255,255,.1);font-size:.75rem;color:#94a3b8;border:1px solid rgba(255,255,255,.1)}
    .methodology-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin:1rem 0}
    .methodology-card{background:#fff;border-radius:12px;padding:1.2rem;border:1px solid #e2e8f0}
    .methodology-card h5{margin:0 0 .5rem;color:#334155;font-size:.95rem}
    .methodology-card p{margin:0;color:#64748b;font-size:.85rem;line-height:1.5}
    .compare-table{width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06);margin:1.5rem 0}
    .compare-table th{background:#0f172a;color:#fff;padding:.8rem 1rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.5px}
    .compare-table td{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.9rem}
    .compare-table tr:nth-child(even){background:#f8fafc}
    .compare-table .best{font-weight:800;color:#059669}
    .status-table{width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06);margin:1rem 0;font-size:.85rem}
    .status-table th{background:#0f172a;color:#e2e8f0;padding:.6rem .8rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap}
    .status-table td{padding:.5rem .8rem;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .status-table tr:nth-child(even){background:#f8fafc}
    .status-table tr:hover{background:#f1f5f9}
    .status-table .pnl-pos{color:#059669;font-weight:700}
    .status-table .pnl-neg{color:#dc2626;font-weight:700}
    .status-table .ticker-cell{font-weight:800;color:#0f172a;font-size:.9rem}
    .signal-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
    .signal-green{background:#22c55e}
    .signal-yellow{background:#f59e0b}
    .signal-red{background:#ef4444}
    .badge-sm{display:inline-block;padding:.15rem .5rem;border-radius:10px;font-size:.7rem;font-weight:700;white-space:nowrap}
    .badge-tp1{background:#ecfdf5;color:#059669}
    .badge-tp2{background:#d1fae5;color:#047857}
    .badge-sl{background:#fef2f2;color:#dc2626}
    .badge-expired{background:#fffbeb;color:#d97706}
    .badge-rotated{background:#ede9fe;color:#6366f1}
    .badge-open{background:#eff6ff;color:#2563eb}
    .badge-tp1_partial{background:#ecfdf5;color:#10b981}
    .ts-badge{display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .7rem;border-radius:8px;background:#f1f5f9;font-size:.75rem;color:#64748b;font-weight:600;border:1px solid #e2e8f0}
    .live-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:livePulse 2s infinite}
    @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
    .progress-bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden}
    .progress-fill{height:100%;border-radius:3px;transition:width .3s}
    @media(max-width:600px){.kpi-grid{grid-template-columns:repeat(2,1fr)}.kpi-value{font-size:1.1rem}.status-table{font-size:.75rem}.status-table th,.status-table td{padding:.4rem .5rem}}
  </style>
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo">
      <img src="/logo.svg" alt="" width="36" height="36">
      <span class="brand-title">MarketWatch</span>
    </a>
    <div class="brand-nav">
      <a href="/?tab=weekly">Hebdo</a>
      <a href="/?tab=daily">Daily</a>
      <a href="/?tab=analyses">Analyses</a>
      <a href="/?tab=scanner">Scanner</a>
      <a href="/?tab=radar">Radar</a>
      <a href="/?tab=series">S&eacute;ries</a>
    </div>
    <div class="brand-actions">
      <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
    </div>
  </div>
</nav>

<article style="max-width:960px;margin:0 auto;padding:0 1rem 3rem">

  <div class="hero-sweep">
    <span class="updated-badge"><i class="fas fa-clock"></i> Mis &agrave; jour le ${todayFr}</span>
    <h1>Scanner Strategy Guide</h1>
    <p class="subtitle">3 modes optimis&eacute;s &mdash; ${totalCombos.toLocaleString('fr')} backtests, ${totalScans} scans, ${totalTickers} tickers, ${totalSetups} setups</p>
    <div class="hero-badges">
      <span class="hero-badge badge-green"><i class="fas fa-rocket"></i> Maximum Growth +${g.ret}%</span>
      <span class="hero-badge badge-blue"><i class="fas fa-shield-halved"></i> Risk-Adjusted +${ca.ret}%</span>
      <span class="hero-badge badge-purple"><i class="fas fa-gem"></i> Conservative +${z.ret}%</span>
      <span class="hero-badge badge-amber"><i class="fas fa-flask-vial"></i> Walk-Forward Valid&eacute;</span>
    </div>
    <div id="article-clickable-tags" class="card-tags"></div>
  </div>

  ${imgDailyCard ? `
  <h2 class="section-title"><i class="fas fa-chart-line" style="color:#f59e0b"></i> Dashboard du jour</h2>
  <p style="color:#64748b;font-size:.9rem;margin-bottom:1rem">Top 3 signaux, positions ouvertes, performance depuis D0, rotation et capital disponible.</p>
  <img src="/scanner/status/${imgDailyCard}" alt="Dashboard quotidien Scanner Market Watch" class="setup-img" loading="eager">
  ` : ''}

  <!-- ═══ LIVE METRICS ═══ -->
  ${liveMetrics.updated_at ? `
  <h2 class="section-title" id="live"><i class="fas fa-satellite-dish" style="color:#22c55e"></i> Donn&eacute;es Live</h2>
  <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem">
    <span class="ts-badge"><span class="live-dot"></span> Mis &agrave; jour : ${new Date(liveMetrics.updated_at).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
    ${latestSignals._scanDir ? `<span class="ts-badge"><i class="fas fa-radar"></i> Dernier scan : ${latestSignals._scanDir}</span>` : ''}
  </div>

  <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
    ${kpiTile(`${liveMetrics.return_total != null ? (liveMetrics.return_total > 0 ? '+' : '') + liveMetrics.return_total + '%' : liveMetrics.return_30d + '%'}`, 'Return Total', '#059669')}
    ${kpiTile(`${liveMetrics.max_drawdown || 0}%`, 'Max DD', '#dc2626')}
    ${kpiTile(`${liveMetrics.win_rate || 0}%`, 'Win Rate', '#7c3aed')}
    ${kpiTile(`${liveMetrics.profit_factor || '—'}x`, 'Profit Factor', '#2563eb')}
    ${kpiTile(`${liveMetrics.trades_open || 0} / ${liveMetrics.trades_total || 0}`, 'Open / Total', '#0891b2')}
  </div>
  ` : ''}

  <!-- ═══ DERNIERS SIGNAUX ═══ -->
  ${latestSignals.length ? `
  <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:2rem 0 .5rem"><i class="fas fa-bolt" style="color:#f59e0b"></i> Derniers signaux &mdash; Scan ${latestSignals._scanDir || ''}</h3>
  <table class="status-table">
    <thead><tr>
      <th>#</th><th>Ticker</th><th>Score</th><th>Strat&eacute;gie</th><th>Entry</th><th>Stop</th><th>TP1</th>
    </tr></thead>
    <tbody>
    ${latestSignals.map((s, i) => `<tr>
      <td style="text-align:center;color:#94a3b8;font-weight:700">${i + 1}</td>
      <td class="ticker-cell">${s.ticker}</td>
      <td><span style="background:${s.score >= 90 ? '#059669' : s.score >= 85 ? '#2563eb' : '#f59e0b'};color:white;padding:2px 8px;border-radius:6px;font-weight:800;font-size:.8rem">${s.score}</span></td>
      <td style="color:#64748b">${s.strategy}</td>
      <td style="font-weight:600">${s.entry}</td>
      <td style="color:#dc2626;font-weight:600">${s.stop}</td>
      <td style="color:#059669;font-weight:600">${s.tp1}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- ═══ POSITIONS OUVERTES ═══ -->
  ${livePositions.length ? `
  <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:2rem 0 .5rem"><i class="fas fa-wallet" style="color:#3b82f6"></i> Positions ouvertes (${livePositions.length})</h3>
  <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.8rem;flex-wrap:wrap">
    <span class="ts-badge"><i class="fas fa-clock"></i> ${liveMetrics.updated_at ? new Date(liveMetrics.updated_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—'}</span>
    <span class="ts-badge" style="background:#f0fdf4;color:#059669;border-color:#86efac"><i class="fas fa-chart-pie"></i> Capital d&eacute;ploy&eacute; : ${liveMetrics.working_capital_pct || 0}%</span>
    <span class="ts-badge" style="background:${(liveMetrics.available_cash_pct || 0) > 5 ? '#f0fdf4' : '#fef2f2'};color:${(liveMetrics.available_cash_pct || 0) > 5 ? '#059669' : '#dc2626'};border-color:${(liveMetrics.available_cash_pct || 0) > 5 ? '#86efac' : '#fecaca'}"><i class="fas fa-coins"></i> Cash libre : ${liveMetrics.available_cash_pct || 0}%</span>
  </div>
  <table class="status-table">
    <thead><tr>
      <th>Ticker</th><th>Signal</th><th>Strat.</th><th>Entr&eacute;e</th><th>Prix actuel</th><th>Return</th><th>Stop</th><th>TP1</th><th>Progression</th><th>Scan</th><th>Expire</th>
    </tr></thead>
    <tbody>
    ${[...livePositions].sort((a, b) => a.ticker.localeCompare(b.ticker)).map(p => {
      const retClass = p.return_pct >= 0 ? 'pnl-pos' : 'pnl-neg';
      const sigClass = p.signal === 'green' ? 'signal-green' : p.signal === 'red' ? 'signal-red' : 'signal-yellow';
      const prog = Math.min(100, Math.max(0, p.progress_pct || 0));
      const progColor = prog >= 70 ? '#059669' : prog >= 40 ? '#f59e0b' : '#dc2626';
      return `<tr>
        <td class="ticker-cell">${p.ticker}</td>
        <td><span class="signal-dot ${sigClass}"></span>${p.status_label || p.signal}</td>
        <td style="color:#64748b;font-size:.8rem">${p.strategy || '—'}</td>
        <td style="font-weight:600">$${(p.entry || 0).toFixed(2)}</td>
        <td style="font-weight:600">$${(p.current_price || 0).toFixed(2)}</td>
        <td class="${retClass}">${p.return_pct > 0 ? '+' : ''}${p.return_pct}%</td>
        <td style="color:#dc2626">$${(p.stop || 0).toFixed(2)}</td>
        <td style="color:#059669">${p.tp1 ? '$' + p.tp1.toFixed(2) : '—'}</td>
        <td><div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${prog}%;background:${progColor}"></div></div><span style="font-size:.7rem;color:#94a3b8;margin-left:4px">${prog}%</span></td>
        <td style="font-size:.8rem;color:#94a3b8">${p.scan_date ? p.scan_date.slice(5) : '—'}</td>
        <td style="font-size:.8rem;color:#94a3b8">${p.expire_date ? p.expire_date.slice(5) : '—'} (${p.days_remaining || 0}j)</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  ` : ''}

  <h2 class="section-title"><i class="fas fa-sliders" style="color:#3b82f6"></i> Choisissez votre mode</h2>
  <p style="color:#64748b;font-size:.9rem;margin-bottom:1rem">Chaque mode correspond &agrave; un profil de risque diff&eacute;rent. Les param&egrave;tres sont issus d'un grid search sur <strong>${totalCombos.toLocaleString('fr')} combinaisons</strong> avec validation walk-forward (70% in-sample / 30% out-of-sample).</p>

  <div class="mode-tabs">
    <button class="mode-tab active" data-mode="growth" onclick="switchMode('growth')"><i class="fas fa-rocket"></i><br>Maximum Growth</button>
    <button class="mode-tab" data-mode="calmar" onclick="switchMode('calmar')"><i class="fas fa-shield-halved"></i><br>Risk-Adjusted</button>
    <button class="mode-tab" data-mode="zero" onclick="switchMode('zero')"><i class="fas fa-gem"></i><br>Conservative</button>
  </div>

  <!-- MODE 1: GROWTH -->
  <div class="mode-panel active" id="panel-growth">
    <img src="/scanner/status/${imgGrowth}" alt="Maximum Growth mode" class="setup-img" loading="eager">
    ${kpiGrid(g)}
    ${configGrid(modes.growth.cfg)}
    <div class="how-box">
      <h4><i class="fas fa-list-check"></i> Comment appliquer ce mode</h4>
      <ol>
        <li><strong>Chaque soir</strong> apr&egrave;s le scan (23h), prenez les <strong>${modes.growth.cfg.topN} premiers setups</strong> par score</li>
        <li><strong>Entr&eacute;e</strong> &agrave; l'ouverture J+1 (15h30 Paris) au prix d'ouverture</li>
        <li><strong>Stop loss</strong> et <strong>Target 1</strong> tels qu'indiqu&eacute;s dans le scan</li>
        <li><strong>Sortie</strong> : TP1 touch&eacute; OU stop touch&eacute; OU expir&eacute; apr&egrave;s ${modes.growth.cfg.horizon} jours ouvrables</li>
        <li><strong>Rotation agressive</strong> : si un nouveau signal a un score sup&eacute;rieur &agrave; votre pire position ouverte, fermez-la au march&eacute; et entrez sur le nouveau signal</li>
        <li><strong>Allocation</strong> : ${Math.round(100/modes.growth.cfg.portfolioSize)}% du capital par position (${modes.growth.cfg.portfolioSize} positions &times; ${Math.round(100/modes.growth.cfg.portfolioSize)}% = 100%)</li>
      </ol>
    </div>
    <div class="disclaimer-sweep">
      <strong><i class="fas fa-triangle-exclamation"></i> Attention :</strong> Ce mode cherche la performance maximale. Le drawdown de ${g.dd}% est contenu mais le turnover est &eacute;lev&eacute; (${g.avgHold} jours de hold moyen). Les frais de courtage r&eacute;els ne sont pas mod&eacute;lis&eacute;s.
    </div>
    <div id="chartGrowthEquity" class="echart-box"></div>
    ${tradesTable(modes.growth.trades, '#059669', 'Maximum Growth')}
  </div>

  <!-- MODE 2: CALMAR -->
  <div class="mode-panel" id="panel-calmar">
    <img src="/scanner/status/${imgCalmar}" alt="Risk-Adjusted mode" class="setup-img" loading="lazy">
    ${kpiGrid(ca)}
    ${configGrid(modes.calmar.cfg)}
    <div class="how-box">
      <h4><i class="fas fa-list-check"></i> Comment appliquer ce mode</h4>
      <ol>
        <li><strong>Chaque soir</strong> apr&egrave;s le scan, prenez les <strong>${modes.calmar.cfg.topN} premiers setups</strong> (hors Short Squeeze)</li>
        <li><strong>Entr&eacute;e</strong> &agrave; l'ouverture J+1 (15h30 Paris)</li>
        <li><strong>Stop loss</strong> et <strong>Target 1</strong> tels qu'indiqu&eacute;s dans le scan</li>
        <li><strong>Sortie</strong> : TP1 touch&eacute; OU stop touch&eacute; OU expir&eacute; apr&egrave;s ${modes.calmar.cfg.horizon} jours ouvrables</li>
        <li><strong>Rotation contr&ocirc;l&eacute;e</strong> : max 1 rotation par jour, marge +5 points de score</li>
        <li><strong>Allocation</strong> : ${Math.round(100/modes.calmar.cfg.portfolioSize)}% du capital par position (${modes.calmar.cfg.portfolioSize} &times; ${Math.round(100/modes.calmar.cfg.portfolioSize)}% = 100%)</li>
      </ol>
    </div>
    <div class="disclaimer-sweep">
      <strong><i class="fas fa-shield-halved"></i> Mode recommand&eacute; :</strong> Meilleur ratio return/risque. Drawdown contenu (${ca.dd}%) avec un return de +${ca.ret}%. Le filtre Short Squeeze &eacute;vite les pics de volatilit&eacute; destructeurs.
    </div>
    <div id="chartCalmarEquity" class="echart-box"></div>
    ${tradesTable(modes.calmar.trades, '#2563eb', 'Risk-Adjusted')}
  </div>

  <!-- MODE 3: CONSERVATIVE (ex-Zero DD) -->
  <div class="mode-panel" id="panel-zero">
    <img src="/scanner/status/${imgZero}" alt="Conservative mode" class="setup-img" loading="lazy">
    ${kpiGrid(z)}
    ${configGrid(modes.zero.cfg)}
    <div class="how-box">
      <h4><i class="fas fa-list-check"></i> Comment appliquer ce mode</h4>
      <ol>
        <li><strong>Chaque soir</strong>, ne prenez que les <strong>${modes.zero.cfg.topN} premiers setups Momentum</strong> (ignorez Breakout, Pullback, Squeeze)</li>
        <li><strong>Entr&eacute;e</strong> &agrave; l'ouverture J+1 (15h30 Paris)</li>
        <li><strong>Quand TP1 est touch&eacute;</strong> : vendez <strong>50% de la position</strong> et d&eacute;placez le stop au <strong>breakeven</strong></li>
        <li>Laissez courir les <strong>50% restants</strong> avec un <strong>trailing stop &agrave; 1.5R</strong> du plus haut</li>
        <li><strong>Horizon max</strong> : ${modes.zero.cfg.horizon} jours. Cl&ocirc;turez si le trade expire</li>
        <li><strong>Allocation</strong> : ${Math.round(100/modes.zero.cfg.portfolioSize)}% du capital par position (${modes.zero.cfg.portfolioSize} &times; ${Math.round(100/modes.zero.cfg.portfolioSize)}% &cong; 100%)</li>
        <li><strong>Rotation</strong> : remplacez la pire position si un meilleur signal Momentum appara&icirc;t</li>
      </ol>
    </div>
    <div class="disclaimer-sweep">
      <strong><i class="fas fa-gem"></i> Mode conservateur :</strong> Drawdown limit&eacute; (${z.dd}%) gr&acirc;ce au partial TP (50% &agrave; TP1) et trailing stop (breakeven). ${z.trades} trades, WR ${z.wr}%. Id&eacute;al pour d&eacute;buter.
    </div>
    <div id="chartZeroEquity" class="echart-box"></div>
    ${tradesTable(modes.zero.trades, '#7c3aed', 'Conservative')}
  </div>

  <!-- COMPARAISON -->
  <h2 class="section-title"><i class="fas fa-table-columns" style="color:#f59e0b"></i> Comparaison des 3 modes</h2>
  <table class="compare-table">
    <thead><tr>
      <th>M&eacute;trique</th>
      <th style="background:#059669">Maximum Growth</th>
      <th style="background:#2563eb">Risk-Adjusted</th>
      <th style="background:#7c3aed">Conservative</th>
    </tr></thead>
    <tbody>
      <tr><td><strong>Return</strong></td><td${bRet[0]}>+${g.ret}%</td><td${bRet[1]}>+${ca.ret}%</td><td${bRet[2]}>+${z.ret}%</td></tr>
      <tr><td><strong>Max Drawdown</strong></td><td${bDD[0]}>${g.dd}%</td><td${bDD[1]}>${ca.dd}%</td><td${bDD[2]}>${z.dd}%</td></tr>
      <tr><td><strong>Sharpe Ratio</strong></td><td${bSharpe[0]}>${g.sharpe}</td><td${bSharpe[1]}>${ca.sharpe}</td><td${bSharpe[2]}>${z.sharpe}</td></tr>
      <tr><td><strong>Calmar Ratio</strong></td><td${bCalmar[0]}>${g.calmar}</td><td${bCalmar[1]}>${ca.calmar}</td><td${bCalmar[2]}>${z.calmar}</td></tr>
      <tr><td><strong>Win Rate</strong></td><td${bWR[0]}>${g.wr}%</td><td${bWR[1]}>${ca.wr}%</td><td${bWR[2]}>${z.wr}%</td></tr>
      <tr><td><strong>Profit Factor</strong></td><td${bPF[0]}>${g.pf}x</td><td${bPF[1]}>${ca.pf}x</td><td${bPF[2]}>${z.pf}x</td></tr>
      <tr><td><strong>Trades</strong></td><td${bTrades[0]}>${g.trades}</td><td${bTrades[1]}>${ca.trades}</td><td${bTrades[2]}>${z.trades}</td></tr>
      <tr><td><strong>Hold Moyen</strong></td><td>${g.avgHold}j</td><td>${ca.avgHold}j</td><td>${z.avgHold}j</td></tr>
      <tr><td><strong>Positions Max</strong></td><td>${modes.growth.cfg.portfolioSize}</td><td>${modes.calmar.cfg.portfolioSize}</td><td>${modes.zero.cfg.portfolioSize}</td></tr>
      <tr><td><strong>Partial TP</strong></td><td>Non</td><td>Non</td><td${modes.zero.cfg.partialTP ? ' class="best"' : ''}>Oui (50%)</td></tr>
      <tr><td><strong>Trailing Stop</strong></td><td>Non</td><td>Non</td><td${modes.zero.cfg.trailingStop ? ' class="best"' : ''}>Oui (BE)</td></tr>
      <tr><td><strong>Id&eacute;al pour</strong></td><td>Traders actifs</td><td><strong>Recommand&eacute;</strong></td><td>D&eacute;butants</td></tr>
    </tbody>
  </table>

  <div id="chartCompareReturns" class="echart-box" style="height:380px"></div>

  <!-- METHODOLOGIE -->
  <h2 class="section-title" id="methodo"><i class="fas fa-flask" style="color:#dc2626"></i> M&eacute;thodologie du Sweep</h2>
  <div class="methodology-grid">
    <div class="methodology-card">
      <h5><i class="fas fa-cubes" style="color:#3b82f6"></i> Grid Search Exhaustif</h5>
      <p><strong>${totalCombos.toLocaleString('fr')} combinaisons</strong> test&eacute;es sur 8 dimensions : taille portfolio (1-20), signaux/scan (1-5), score min (0-95), horizon (5-30j), 5 filtres strat&eacute;gie, 4 modes rotation, partial TP, trailing stop.</p>
    </div>
    <div class="methodology-card">
      <h5><i class="fas fa-chart-line" style="color:#059669"></i> Simulation R&eacute;aliste</h5>
      <p>Entr&eacute;e au prix d'<strong>ouverture r&eacute;el J+1</strong> (Yahoo Finance OHLCV). Stop/TP ajust&eacute;s en R-multiple depuis l'entr&eacute;e r&eacute;elle. SL v&eacute;rifi&eacute; avant TP sur chaque barre (conservateur).</p>
    </div>
    <div class="methodology-card">
      <h5><i class="fas fa-shuffle" style="color:#f59e0b"></i> Walk-Forward Validation</h5>
      <p>Split <strong>70/30</strong> : in-sample pour optimiser, out-of-sample pour valider. D&eacute;gradation mesur&eacute;e sur chaque combo.</p>
    </div>
    <div class="methodology-card">
      <h5><i class="fas fa-filter" style="color:#dc2626"></i> Anti-Overfitting</h5>
      <p>Minimum <strong>8 trades</strong> par combo. M&eacute;triques multiples (Sharpe, Calmar, Sortino) pour &eacute;viter l'optimisation sur un seul crit&egrave;re.</p>
    </div>
  </div>

  <!-- DONNEES -->
  <h2 class="section-title"><i class="fas fa-database" style="color:#0891b2"></i> Donn&eacute;es &amp; Mises &agrave; jour</h2>
  <div class="config-box">
    <h4><i class="fas fa-calendar-check"></i> P&eacute;riode analys&eacute;e</h4>
    <div class="config-grid">
      <div class="config-item"><span class="config-key">D&eacute;but</span><span class="config-val">${firstDate}</span></div>
      <div class="config-item"><span class="config-key">Fin</span><span class="config-val">${lastDate}</span></div>
      <div class="config-item"><span class="config-key">Dur&eacute;e</span><span class="config-val">${daySpan} jours (${totalScans} scans)</span></div>
      <div class="config-item"><span class="config-key">Tickers</span><span class="config-val">${totalTickers}</span></div>
      <div class="config-item"><span class="config-key">Setups</span><span class="config-val">${totalSetups}</span></div>
      <div class="config-item"><span class="config-key">Combinaisons</span><span class="config-val">${totalCombos.toLocaleString('fr')}</span></div>
      <div class="config-item"><span class="config-key">Source prix</span><span class="config-val">Yahoo Finance OHLCV</span></div>
      <div class="config-item"><span class="config-key">Slippage</span><span class="config-val">Non (open r&eacute;el)</span></div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div id="disclaimer" class="content-card" style="margin-top:2.5rem;background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:1.5rem">
    <h3 style="color:#991b1b;margin:0 0 .8rem"><i class="fas fa-triangle-exclamation"></i> Disclaimer</h3>
    <p style="color:#991b1b;font-size:.85rem;line-height:1.6;margin:0">
      Les performances pass&eacute;es ne garantissent pas les r&eacute;sultats futurs. Ce guide est &agrave; titre &eacute;ducatif uniquement. Les backtests ne mod&eacute;lisent pas les frais de courtage, le slippage, ni l'impact de march&eacute;. La p&eacute;riode d'analyse est courte (${daySpan} jours, ${totalScans} scans). Investir comporte des risques de perte en capital.
    </p>
  </div>

</article>

<!-- FAB -->
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#live" class="fnav-item"><i class="fas fa-satellite-dish"></i><span>Live</span></a>
    <a href="#" class="fnav-item" onclick="switchMode('growth');window.scrollTo({top:document.querySelector('.mode-tabs').offsetTop-80,behavior:'smooth'})"><i class="fas fa-rocket"></i><span>Growth</span></a>
    <a href="#" class="fnav-item" onclick="switchMode('calmar');window.scrollTo({top:document.querySelector('.mode-tabs').offsetTop-80,behavior:'smooth'})"><i class="fas fa-shield-halved"></i><span>Risk-Adj</span></a>
    <a href="#" class="fnav-item" onclick="switchMode('zero');window.scrollTo({top:document.querySelector('.mode-tabs').offsetTop-80,behavior:'smooth'})"><i class="fas fa-gem"></i><span>Conserv.</span></a>
    <a href="#methodo" class="fnav-item"><i class="fas fa-flask"></i><span>M&eacute;thodo</span></a>
    <a href="#disclaimer" class="fnav-item"><i class="fas fa-triangle-exclamation"></i><span>Disclaimer</span></a>
    <a href="/?tab=scanner" class="fnav-item"><i class="fas fa-radar"></i><span>Scanner</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>

<footer class="article-footer">
  &copy; 2026 Market Watch. Donn&eacute;es via MarketWatch Gateway &amp; Yahoo Finance.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>

<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script>
function switchMode(mode) {
  document.querySelectorAll('.mode-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.mode-panel').forEach(function(p){p.classList.remove('active')});
  document.querySelector('[data-mode="'+mode+'"]').classList.add('active');
  document.getElementById('panel-'+mode).classList.add('active');
  setTimeout(function(){window.dispatchEvent(new Event('resize'))},100);
}

function initCharts() {
  var dk='#334155',gc='#f1f5f9';

  // Growth equity curve
  var gD=${JSON.stringify(gEC.dates)};
  var gV=${JSON.stringify(gEC.values)};
  var c1=echarts.init(document.getElementById('chartGrowthEquity'));
  c1.setOption({title:{text:'Equity Curve — Maximum Growth',left:'center',textStyle:{fontSize:14,color:dk}},tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/>'+p[0].value.toFixed(2)}},xAxis:{type:'category',data:gD,axisLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8',fontSize:11}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,gV))-1,axisLine:{show:false},splitLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8'}},series:[{data:gV,type:'line',smooth:true,symbol:'circle',symbolSize:4,lineStyle:{color:'#059669',width:3},itemStyle:{color:'#059669'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(5,150,105,.25)'},{offset:1,color:'rgba(5,150,105,.02)'}])}}],grid:{left:50,right:20,top:45,bottom:30}});

  // Calmar equity curve
  var caD=${JSON.stringify(caEC.dates)};
  var caV=${JSON.stringify(caEC.values)};
  var c2=echarts.init(document.getElementById('chartCalmarEquity'));
  c2.setOption({title:{text:'Equity Curve — Risk-Adjusted',left:'center',textStyle:{fontSize:14,color:dk}},tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/>'+p[0].value.toFixed(2)}},xAxis:{type:'category',data:caD,axisLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8',fontSize:11}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,caV))-1,axisLine:{show:false},splitLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8'}},series:[{data:caV,type:'line',smooth:true,symbol:'circle',symbolSize:4,lineStyle:{color:'#2563eb',width:3},itemStyle:{color:'#2563eb'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(37,99,235,.25)'},{offset:1,color:'rgba(37,99,235,.02)'}])}}],grid:{left:50,right:20,top:45,bottom:30}});

  // Zero equity curve
  var zD=${JSON.stringify(zEC.dates)};
  var zV=${JSON.stringify(zEC.values)};
  var c3=echarts.init(document.getElementById('chartZeroEquity'));
  c3.setOption({title:{text:'Equity Curve — Conservative',left:'center',textStyle:{fontSize:14,color:dk}},tooltip:{trigger:'axis',formatter:function(p){return p[0].name+'<br/>'+p[0].value.toFixed(2)}},xAxis:{type:'category',data:zD,axisLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8',fontSize:11}},yAxis:{type:'value',min:Math.floor(Math.min.apply(null,zV))-1,axisLine:{show:false},splitLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8'}},series:[{data:zV,type:'line',smooth:true,symbol:'circle',symbolSize:4,lineStyle:{color:'#7c3aed',width:3},itemStyle:{color:'#7c3aed'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(124,58,237,.25)'},{offset:1,color:'rgba(124,58,237,.02)'}])}}],grid:{left:50,right:20,top:45,bottom:30}});

  // Comparison bar chart
  var c4=echarts.init(document.getElementById('chartCompareReturns'));
  c4.setOption({title:{text:'Comparaison des 3 modes',left:'center',textStyle:{fontSize:14,color:dk}},tooltip:{trigger:'axis'},legend:{bottom:0,textStyle:{color:'#64748b'}},xAxis:{type:'category',data:['Return (%)','|MaxDD| (%)','Win Rate (%)','Profit Factor','Trades','Hold (j)'],axisLabel:{color:'#64748b',fontSize:11,rotate:15},axisLine:{lineStyle:{color:gc}}},yAxis:{type:'value',axisLine:{show:false},splitLine:{lineStyle:{color:gc}},axisLabel:{color:'#94a3b8'}},series:[{name:'Growth',type:'bar',data:[${g.ret},${Math.abs(g.dd)},${g.wr},${g.pf},${g.trades},${g.avgHold}],itemStyle:{color:'#059669',borderRadius:[6,6,0,0]}},{name:'Risk-Adj',type:'bar',data:[${ca.ret},${Math.abs(ca.dd)},${ca.wr},${ca.pf},${ca.trades},${ca.avgHold}],itemStyle:{color:'#2563eb',borderRadius:[6,6,0,0]}},{name:'Conserv.',type:'bar',data:[${z.ret},${Math.abs(z.dd)},${z.wr},${z.pf},${z.trades},${z.avgHold}],itemStyle:{color:'#7c3aed',borderRadius:[6,6,0,0]}}],grid:{left:45,right:20,top:45,bottom:50}});

  window.addEventListener('resize',function(){c1.resize();c2.resize();c3.resize();c4.resize()});
}
document.addEventListener('DOMContentLoaded',initCharts);
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log(`✅ ${OUT} generated (${(html.length / 1024).toFixed(0)}KB)`);
  console.log(`   Growth: +${g.ret}%, DD ${g.dd}%, WR ${g.wr}%, PF ${g.pf}x, ${g.trades} trades`);
  console.log(`   Calmar: +${ca.ret}%, DD ${ca.dd}%, WR ${ca.wr}%, PF ${ca.pf}x, ${ca.trades} trades`);
  console.log(`   Conservative: +${z.ret}%, DD ${z.dd}%, WR ${z.wr}%, PF ${z.pf}x, ${z.trades} trades`);
}

main();
