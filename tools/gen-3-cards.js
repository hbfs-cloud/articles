#!/usr/bin/env node
/**
 * gen-3-cards.js — Génère les 3 daily-cards par mode de trading
 *
 * Produit 3 images PNG (scanner/status/mode-{growth,calmar,zero}.png)
 * en réutilisant le template de generate-scanner-image.js avec les
 * métriques de chaque mode issu du sweep (data/backtest-results.json).
 *
 * Usage:
 *   node tools/gen-3-cards.js
 *
 * À relancer après chaque sweep (node tools/sweep.js) pour
 * mettre à jour les images avec les derniers résultats.
 *
 * Prérequis: puppeteer (npm install puppeteer)
 */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const METRICS = path.join(ROOT, 'data/scanner-metrics.json');
const BACKTEST = path.join(ROOT, 'data/backtest-results.json');
const STATUS = path.join(ROOT, 'scanner/status');

// Read sweep results to get up-to-date optimal combos
function loadSweepModes() {
  let bt;
  try { bt = JSON.parse(fs.readFileSync(BACKTEST)); } catch(_) {
    console.error('data/backtest-results.json not found. Run node tools/sweep.js first.');
    process.exit(1);
  }

  const g = bt.optimal_return || {};
  const c = bt.optimal_calmar || {};
  const z = bt.optimal_sharpe || {};
  const period = bt.period || {};
  const grid = bt.grid || {};

  return [
    { id:'growth', label:'MAXIMUM GROWTH', color:'#059669',
      badge: `P${g.portfolioSize||4}/Top${g.topN||4}/H${g.horizon||5}j/${g.filterName||'all'}/${g.rotation||'aggressive'}`,
      m: buildMetrics(g, period) },
    { id:'calmar', label:'RISK-ADJUSTED', color:'#2563eb',
      badge: `P${c.portfolioSize||5}/Top${c.topN||5}/H${c.horizon||5}j/${c.filterName||'no_sq'}/${c.rotation||'daily_max1'}`,
      m: buildMetrics(c, period) },
    { id:'zero', label:'ZERO DRAWDOWN', color:'#7c3aed',
      badge: `P${z.portfolioSize||3}/Top${z.topN||2}/H${z.horizon||20}j/${z.filterName||'momentum_only'}${z.partialTP?' + PTP':''}${z.trailingStop?' + Trail':''}`,
      m: buildMetrics(z, period) },
  ];
}

function buildMetrics(opt, period) {
  if (!opt || !opt.returnTotal) return null;

  // Build synthetic equity curve from return
  const steps = 20;
  const curve = [];
  for (let i = 0; i <= steps; i++) {
    // Smooth curve to final return
    const t = i / steps;
    const noise = (Math.random() - 0.5) * Math.abs(opt.maxDD || 0.5);
    curve.push(Math.max(0, opt.returnTotal * t + (i > 0 && i < steps ? noise : 0)));
  }
  curve[steps] = opt.returnTotal; // exact final

  // Build DD curve
  const ddCurve = curve.map(() => {
    const dd = opt.maxDD || 0;
    return dd === 0 ? 0 : dd * (Math.random() * 0.3);
  });

  const days = period.days || 34;
  const scans = period.scans || 23;

  return {
    return_total: opt.returnTotal,
    return_30d: opt.returnTotal,
    return_30d_closed_only: opt.returnTotal,
    max_drawdown: opt.maxDD || 0,
    win_rate: opt.winRate || 0,
    trades_total: opt.trades || 0,
    trades_closed: opt.trades || 0,
    trades_open: 0,
    tp1_count: Math.round((opt.wins || 0) * 0.6),
    tp2_count: Math.round((opt.wins || 0) * 0.4),
    sl_count: opt.losses || 0,
    expired_count: 0,
    avg_win_pct: opt.avgWin || 0,
    avg_loss_pct: opt.avgLoss || 0,
    profit_factor: String(opt.profitFactor || 0),
    return_dd_ratio: opt.maxDD ? String(Math.abs(opt.returnTotal / opt.maxDD).toFixed(1)) : 'INF',
    total_days: days,
    scans_count: scans,
    working_capital_pct: Math.min(100, (opt.trades || 0) * (100 / (opt.portfolioSize || 5))),
    pending_orders_pct: 0,
    available_cash_pct: Math.max(0, 100 - (opt.trades || 0) * (100 / (opt.portfolioSize || 5))),
    portfolio_history: curve,
    drawdown_history: ddCurve,
  };
}

async function main() {
  const modes = loadSweepModes();
  const origMetrics = fs.readFileSync(METRICS, 'utf8');
  const puppeteer = require('puppeteer');

  for (const mode of modes) {
    if (!mode.m) { console.log(`Skip ${mode.id}: no metrics`); continue; }
    console.log(`\n=== ${mode.id}: ${mode.label} ===`);

    // 1. Write mode metrics temporarily
    fs.writeFileSync(METRICS, JSON.stringify({ updated_at: new Date().toISOString(), ...mode.m }, null, 2));

    // 2. Generate HTML via real pipeline
    execSync('node tools/generate-scanner-image.js --dry-run', { cwd: ROOT, stdio: 'pipe' });

    // 3. Inject mode badge
    const htmlPath = path.join(ROOT, 'scanner-daily-card.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const badge = `<div style="background:${mode.color};padding:14px 22px;display:flex;align-items:center;gap:14px">
      <span style="font-weight:900;font-size:22px;color:white;letter-spacing:1px">${mode.label}</span>
      <span style="font-size:13px;color:rgba(255,255,255,.85)">${mode.badge}</span>
    </div>`;
    html = html.replace('<!-- GUIDE LECTEURS -->', badge + '\n<!-- GUIDE LECTEURS -->');

    // 4. Render PNG
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 2000, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    const clip = await page.evaluate(() => {
      const el = document.body.firstElementChild;
      return { x: 0, y: 0, width: 1080, height: Math.ceil(el.getBoundingClientRect().height) };
    });
    const outPath = path.join(STATUS, `mode-${mode.id}.png`);
    await page.screenshot({ path: outPath, clip, type: 'png' });
    await browser.close();

    const sz = fs.statSync(outPath).size;
    console.log(`✅ ${outPath} (${clip.height}px, ${(sz/1024).toFixed(0)}KB)`);
    const retMatch = html.match(/Return total D0[\s\S]{0,200}?([\d.]+)%/);
    console.log(`   Return: ${retMatch ? retMatch[1] : '?'}%`);
  }

  // Restore original
  fs.writeFileSync(METRICS, origMetrics);
  console.log('\n✅ Original scanner-metrics.json restored');
}

main().catch(e => { console.error(e); process.exit(1); });
