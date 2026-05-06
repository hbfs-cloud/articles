#!/usr/bin/env node
'use strict';

/**
 * gen-mode-cards.js
 * Generates PNG card images for all portfolio modes (turbo, dynamic, balanced, secured, fortress, tkl — read dynamically from MODE_META).
 * Reads metrics from scanner/status/index.html (same source of truth as notify-scanner-status.js)
 * Saves to scanner/status/mode-{mode}-{timestamp}.png
 * Updates scanner/status/manifest.json
 *
 * Usage:
 *   node tools/gen-mode-cards.js
 *   node tools/gen-mode-cards.js --dry-run
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const STATUS_DIR = path.join(ROOT, 'scanner/status');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Mode metadata ────────────────────────────────────────────────────────────
const MODE_META = {
  turbo:    { emoji: '🚀', label: 'Turbo' },
  dynamic:  { emoji: '🔥', label: 'Dynamic' },
  balanced: { emoji: '⚖️',  label: 'Balanced' },
  secured:  { emoji: '🛡️',  label: 'Secured' },
  fortress: { emoji: '🏰', label: 'Fortress' },
  tkl:      { emoji: '🎯', label: 'TKL' },
};
const MODES = Object.keys(MODE_META);

// ─── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

// ─── Read metrics from scanner/status/index.html (source of truth) ───────────
function readStatusMetrics(modeKey) {
  const htmlPath = path.join(STATUS_DIR, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  const statusHtml = fs.readFileSync(htmlPath, 'utf8');
  const panelId = `p-${modeKey}`;
  const section = statusHtml.match(new RegExp(`id="${panelId}"[\\s\\S]{0,15000}`));
  if (!section) return null;
  const html = section[0];

  const perfBlock = html.match(/class="perf-stats"[\s\S]{0,4000}?<\/div>\s*<\/div>/);
  const perfHtml  = perfBlock ? perfBlock[0] : '';

  const allPsV = perfHtml.match(/class="ps-v"[^>]*>([+\-]?[\d.]+[%x]?)/g) || [];
  const extract = s => { const m = s.match(/>([+\-]?[\d.]+)/); return m ? parseFloat(m[1]) : NaN; };
  const vals = allPsV.map(extract).filter(n => !isNaN(n));

  const worstM = html.match(/Worst:\s*([+\-]?[\d.]+)%/);
  const nowM   = html.match(/Now:\s*([+\-]?[\d.]+)%/);
  const bestM  = html.match(/Best:\s*([+\-]?[\d.]+)%/);

  const tradesM = html.match(/(\d+)\s*(?:trades?|Trades?)/);

  return {
    ret:    vals[0] || 0,
    dd:     vals[1] || 0,
    wr:     vals[2] || 0,
    pf:     vals[3] || 0,
    trades: tradesM ? parseInt(tradesM[1]) : (vals[4] || 0),
    worst:  worstM ? parseFloat(worstM[1]) : 0,
    now:    nowM   ? parseFloat(nowM[1])   : 0,
    best:   bestM  ? parseFloat(bestM[1])  : 0,
  };
}

// ─── Build open positions per mode (mirrors notify-scanner-status.js) ─────────
function buildPositions(cfg, modeKey) {
  const tradesPath    = path.join(ROOT, 'data/backtest-trades.json');
  const positionsPath = path.join(ROOT, 'data/scanner-positions.json');
  if (!fs.existsSync(tradesPath) || !fs.existsSync(positionsPath)) return [];

  const allTrades     = JSON.parse(fs.readFileSync(tradesPath));
  const livePositions = (JSON.parse(fs.readFileSync(positionsPath)).open_positions || []);
  const liveLookup    = {};
  for (const p of livePositions) liveLookup[p.ticker] = p;

  const raw    = allTrades[modeKey] || [];
  const trades = raw.map(t =>
    (t.status === 'expired' && t.holdDays < cfg.horizon) ? { ...t, _premature: true } : t
  );
  const pending = trades.filter(t => t._premature);

  return pending.map(t => {
    const live         = liveLookup[t.ticker];
    const currentPrice = live ? live.current_price : (t.exitPrice || 0);
    const entry        = t.actualEntry || 0;
    const ret          = entry > 0 ? +((currentPrice - entry) / entry * 100).toFixed(2) : 0;
    const ageD         = t.entryDate ? Math.round((new Date() - new Date(t.entryDate)) / 86400000) : 0;
    const left         = Math.max(0, cfg.horizon - Math.round(ageD * 5 / 7));
    const stopDist     = (entry > 0 && live && live.stop)
      ? +((entry - live.stop) / entry * 100).toFixed(2) : 0;
    return {
      ticker:       t.ticker,
      entry,
      current_price: currentPrice,
      return_pct:   ret,
      stop:         live ? live.stop : 0,
      tp1:          live ? live.tp1  : 0,
      left,
      stopDist,
    };
  }).sort((a, b) => b.return_pct - a.return_pct);
}

// ─── Generate HTML for one mode card ─────────────────────────────────────────
function buildCardHtml(modeKey, cfg, metrics, positions) {
  const meta     = MODE_META[modeKey];
  const today    = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const modeColor = cfg.color || '#888';

  // KPI formatting helpers
  const fmtPct  = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const fmtDD   = v => '-' + Math.abs(v).toFixed(2) + '%';
  const fmtWR   = v => v.toFixed(1) + '%';
  const fmtPF   = v => v.toFixed(2) + 'x';

  const retColor = metrics.ret >= 0 ? '#10b981' : '#ef4444';
  const ddColor  = '#ef4444';
  const wrColor  = metrics.wr >= 55 ? '#10b981' : metrics.wr >= 45 ? '#f59e0b' : '#ef4444';
  const pfColor  = metrics.pf >= 1.5 ? '#10b981' : metrics.pf >= 1 ? '#f59e0b' : '#ef4444';

  // Scenario bar
  const worstNum = metrics.worst;
  const nowNum   = metrics.now;
  const bestNum  = metrics.best;
  const allVals  = [worstNum, nowNum, bestNum, 0];
  const minV     = Math.min(...allVals) - 2;
  const maxV     = Math.max(...allVals) + 2;
  const range    = maxV - minV || 1;
  const pct      = v => ((v - minV) / range * 100).toFixed(1);
  const nowPct   = pct(nowNum);
  const nowColor = nowNum >= 0 ? '#10b981' : '#ef4444';

  // Positions rows
  const posRows = positions.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:18px 0;font-size:13px;">No open positions</td></tr>`
    : positions.slice(0, 6).map(p => {
        const rc = p.return_pct >= 0 ? '#10b981' : '#ef4444';
        const sign = p.return_pct >= 0 ? '+' : '';
        return `<tr>
          <td style="font-weight:700;color:#f1f5f9;font-size:15px;">${p.ticker}</td>
          <td style="color:${rc};font-weight:700;font-size:15px;">${sign}${p.return_pct.toFixed(2)}%</td>
          <td style="color:#94a3b8;font-size:13px;">${p.left}d left</td>
          <td style="color:#6b7280;font-size:13px;">${p.stopDist > 0 ? p.stopDist.toFixed(1) + '% stop' : '—'}</td>
          <td style="color:#94a3b8;font-size:13px;">${p.tp1 > 0 ? 'TP1: $' + p.tp1.toFixed(2) : '—'}</td>
        </tr>`;
      }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0a0e1a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #f1f5f9;
  width: 1920px;
}
.card {
  width: 1920px;
  min-height: 1080px;
  background: #0a0e1a;
  padding: 56px 80px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid ${modeColor}44;
  padding-bottom: 32px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}
.mode-badge {
  background: ${modeColor}22;
  border: 2px solid ${modeColor};
  border-radius: 16px;
  padding: 14px 32px;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: ${modeColor};
  display: flex;
  align-items: center;
  gap: 14px;
}
.mode-goal {
  color: #94a3b8;
  font-size: 18px;
  margin-top: 6px;
}
.header-right {
  text-align: right;
}
.brand {
  font-size: 22px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.date {
  color: #475569;
  font-size: 16px;
  margin-top: 4px;
}

/* ── KPI row ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;
}
.kpi-card {
  background: #141825;
  border: 1px solid #1e2538;
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
}
.kpi-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 10px;
}
.kpi-label {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ── Positions ── */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 16px;
}
.positions-table {
  width: 100%;
  border-collapse: collapse;
}
.positions-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 10px 16px;
  border-bottom: 1px solid #1e2538;
}
.positions-table td {
  padding: 16px;
  border-bottom: 1px solid #141825;
}
.empty-pos {
  color: #6b7280;
  font-size: 15px;
  padding: 24px 0;
  text-align: center;
}

/* ── Scenario bar ── */
.scenario-wrap {
  background: #141825;
  border: 1px solid #1e2538;
  border-radius: 12px;
  padding: 28px 40px;
}
.scenario-title {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 20px;
}
.scenario-bar-bg {
  background: #0f1629;
  border-radius: 6px;
  height: 12px;
  position: relative;
  margin-bottom: 16px;
}
.scenario-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${pct(nowNum)}%;
  background: linear-gradient(90deg, #1e2538, ${nowColor});
  border-radius: 6px;
}
.scenario-bar-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 22px;
  border-radius: 3px;
}
.scenario-labels {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  color: #64748b;
}
.scenario-now {
  color: ${nowColor};
  font-weight: 700;
  font-size: 16px;
}

/* ── Footer ── */
.footer {
  margin-top: auto;
  border-top: 1px solid #1e2538;
  padding-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #374151;
  font-size: 13px;
}
</style>
</head>
<body>
<div class="card">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div>
        <div class="mode-badge">${meta.emoji} ${meta.label}</div>
        <div class="mode-goal">${cfg.goal || ''} — ${cfg.riskProfile || ''} Risk</div>
      </div>
    </div>
    <div class="header-right">
      <div class="brand">DailyTickers</div>
      <div class="date">${today}</div>
      <div style="color:#475569;font-size:14px;margin-top:4px;">Portfolio Mode Card</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-value" style="color:${retColor}">${fmtPct(metrics.ret)}</div>
      <div class="kpi-label">Total Return</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${ddColor}">${fmtDD(metrics.dd)}</div>
      <div class="kpi-label">Max Drawdown</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${wrColor}">${fmtWR(metrics.wr)}</div>
      <div class="kpi-label">Win Rate</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:${pfColor}">${fmtPF(metrics.pf)}</div>
      <div class="kpi-label">Profit Factor</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value" style="color:#94a3b8">${metrics.trades}</div>
      <div class="kpi-label"># Trades</div>
    </div>
  </div>

  <!-- Open Positions -->
  <div>
    <div class="section-title">Open Positions (${positions.length})</div>
    <table class="positions-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Return</th>
          <th>Time Left</th>
          <th>Stop</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        ${posRows}
      </tbody>
    </table>
  </div>

  <!-- Scenario -->
  <div class="scenario-wrap">
    <div class="scenario-title">Portfolio Scenario (Worst / Now / Best)</div>
    <div class="scenario-bar-bg">
      <div class="scenario-bar-fill"></div>
      <div class="scenario-bar-marker" style="left:${pct(0)}%;background:#475569;"></div>
      <div class="scenario-bar-marker" style="left:${pct(nowNum)}%;background:${nowColor};"></div>
    </div>
    <div class="scenario-labels">
      <span>Worst: ${worstNum >= 0 ? '+' : ''}${worstNum.toFixed(2)}%</span>
      <span class="scenario-now">Now: ${nowNum >= 0 ? '+' : ''}${nowNum.toFixed(2)}%</span>
      <span>Best: ${bestNum >= 0 ? '+' : ''}${bestNum.toFixed(2)}%</span>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>articles.dailytickers.com/scanner/status/</span>
    <span>For informational purposes only. Not financial advice.</span>
    <span>H${cfg.horizon || '?'} · ${cfg.filterName || ''} · ${cfg.portfolioSize || 1} slot${cfg.portfolioSize > 1 ? 's' : ''}</span>
  </div>

</div>
</body>
</html>`;
}

// ─── Generate PNG via Puppeteer ───────────────────────────────────────────────
async function generatePNG(html, outputPath) {
  const puppeteer = require('puppeteer');
  const fsSync    = require('fs');

  let executablePath;
  const playwrightBase = '/home/ci/.cache/ms-playwright';
  if (fsSync.existsSync(playwrightBase)) {
    try {
      const dirs = fsSync.readdirSync(playwrightBase)
        .filter(d => d.startsWith('chromium-')).sort().reverse();
      for (const dir of dirs) {
        const candidate = `${playwrightBase}/${dir}/chrome-linux/chrome`;
        if (fsSync.existsSync(candidate)) { executablePath = candidate; break; }
      }
    } catch (_) { /* fallback */ }
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  const clip = await page.evaluate(() => {
    const el = document.body.firstElementChild;
    const rect = el.getBoundingClientRect();
    return { x: 0, y: 0, width: 1920, height: Math.max(1080, Math.ceil(rect.height)) };
  });
  await page.screenshot({ path: outputPath, clip, type: 'png' });
  await browser.close();
  console.log(`  PNG: ${outputPath} (${clip.height}px)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== gen-mode-cards.js ===');
  console.log(`Date: ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('DRY RUN — no files written');

  // Load modes-config
  const modesConfigPath = path.join(ROOT, 'data/modes-config.json');
  if (!fs.existsSync(modesConfigPath)) {
    console.error('ERROR: data/modes-config.json not found');
    process.exit(1);
  }
  const modesObj = JSON.parse(fs.readFileSync(modesConfigPath)).modes;

  // Load manifest
  const manifestPath = path.join(STATUS_DIR, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath)); } catch (_) {}

  const ts = Date.now();

  for (const modeKey of MODES) {
    console.log(`\n[${modeKey}]`);
    const cfgRaw = modesObj[modeKey];
    if (!cfgRaw) { console.log('  No config found, skipping'); continue; }
    const cfg = { id: modeKey, ...cfgRaw };

    // Metrics from status page
    const metrics = readStatusMetrics(modeKey) || { ret: 0, dd: 0, wr: 0, pf: 0, trades: 0, worst: 0, now: 0, best: 0 };
    console.log(`  metrics: ret=${metrics.ret} dd=${metrics.dd} wr=${metrics.wr} pf=${metrics.pf}`);

    // Open positions
    const positions = buildPositions(cfg, modeKey);
    console.log(`  positions: ${positions.length}`);

    if (DRY_RUN) {
      console.log('  [dry-run] skipping PNG');
      continue;
    }

    // Clean old mode-{modeKey}-*.png files
    try {
      fs.readdirSync(STATUS_DIR)
        .filter(f => new RegExp(`^mode-${modeKey}-\\d+\\.png$`).test(f))
        .forEach(f => {
          fs.unlinkSync(path.join(STATUS_DIR, f));
          console.log(`  Removed old: ${f}`);
        });
    } catch (_) {}

    // Build HTML
    const html     = buildCardHtml(modeKey, cfg, metrics, positions);
    const filename = `mode-${modeKey}-${ts}.png`;
    const outPath  = path.join(STATUS_DIR, filename);

    // Generate PNG
    try {
      await generatePNG(html, outPath);
      manifest[`mode-${modeKey}`] = filename;
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        console.warn(`  Puppeteer not available — skipping PNG for ${modeKey}`);
      } else {
        console.error(`  Error generating PNG for ${modeKey}:`, err.message);
      }
    }
  }

  // Write updated manifest
  if (!DRY_RUN) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest updated: ${manifestPath}`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
