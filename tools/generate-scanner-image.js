#!/usr/bin/env node
/**
 * generate-scanner-image.js
 * 
 * Génère l'image quotidienne du scanner DailyTickers et la publie sur Telegram.
 * 
 * Usage:
 *   node tools/generate-scanner-image.js [YYYYMMDD]
 *   node tools/generate-scanner-image.js --telegram  (publie aussi sur Telegram)
 *   node tools/generate-scanner-image.js --dry-run   (génère sans publier)
 * 
 * Prérequis:
 *   - puppeteer: npm install puppeteer
 *   - TELEGRAM_BOT_TOKEN dans l'env ou .env
 *   - TELEGRAM_CHAT_ID dans l'env ou .env
 *   - scanner/YYYYMMDD/signals.json (sélection éditoriale)
 *   - scanner/YYYYMMDD/_dtx/replay_best.json (backtest certifié au refdate)
 * 
 * Flux complet:
 *   node tools/generate-scanner-image.js --telegram → génère + publie
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SCANNER_DIR = path.join(ROOT, 'scanner');
const LOGO_DATA_URI = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'logo.svg')).toString('base64')}`;

// ─── Config ───────────────────────────────────────────────────────────────────

// Load .env if present
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';
const PUBLISH_TELEGRAM   = process.argv.includes('--telegram');
const DRY_RUN            = process.argv.includes('--dry-run');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseMidpoint(s) {
  if (!s) return null;
  const nums = String(s).replace(/[$,]/g, '').match(/[\d.]+/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return vals.length >= 2 ? (vals[0] + vals[1]) / 2 : vals[0];
}

function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function formatFrenchDate(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'date indisponible';
  const rendered = new Intl.DateTimeFormat('fr-FR', options).format(date);
  return rendered.replace(/\b1 (?=[a-zéû])/i, '1er ');
}

// ─── Extract top3 from scan HTML ─────────────────────────────────────────────

const EXCLUDED_STRATEGIES = ['Short Squeeze', 'Short_Squeeze'];
const scannerParser = require('./lib/scanner-parser');

function normalizeStrategy(raw) {
  const s = (raw || '').trim();
  if (/short.?squeeze/i.test(s)) return 'Short Squeeze';
  if (/pre.?squeeze/i.test(s)) return 'Pre-Squeeze';
  if (/breakout/i.test(s)) return 'Breakout';
  if (/pullback/i.test(s)) return 'Pullback';
  return 'Momentum';
}

function extractTop3(scanDir) {
  // JSON-first via loadSignals, HTML fallback for legacy scans
  const loaded = scannerParser.loadSignals(scanDir);
  if (!loaded) return [];
  const trades = [];

  for (const s of loaded.signals) {
    const strategy = normalizeStrategy(s.strategy);
    if (EXCLUDED_STRATEGIES.includes(strategy)) continue;
    if (s.entry == null || s.stop == null || s.tp1 == null) continue;
    trades.push({
      ticker: s.ticker,
      name: s.name || s.ticker,
      strategy,
      score: s.score ?? null,
      entry: s.entry,
      stop: s.stop,
      tp1: s.tp1,
      tp2: s.tp2 || null,
      rr: s.rr || 'n/a',
      horizon_days: s.horizon ?? null,
      completed_end: s.selection_evidence?.screen_snapshot_as_of || null,
    });
  }

  return trades
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.ticker.localeCompare(b.ticker))
    .slice(0, 3);
}

// ─── Extract regime from scan HTML ───────────────────────────────────────────

function extractRegime(scanDir) {
  const htmlPath = path.join(SCANNER_DIR, scanDir, 'index.html');
  if (!fs.existsSync(htmlPath)) return { label: 'UNKNOWN', color: '#94a3b8' };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/RISK-OFF|EARLY.RISK-OFF|RISK-ON|NEUTRAL|RECOVERY/i);
  const label = m ? m[0].toUpperCase().replace('.', ' ') : 'NEUTRAL';
  const colors = {
    'RISK-OFF': '#dc2626',
    'EARLY RISK-OFF': '#f59e0b',
    'RISK-ON': '#16a34a',
    'NEUTRAL': '#3b82f6',
    'RECOVERY': '#8b5cf6',
  };
  return { label, color: colors[label] || '#64748b' };
}

// Follow Finviz's multi-hop redirect chain and embed the final image so the
// screenshot renderer never depends on a remote request at capture time.
function fetchUrlBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        Referer: 'https://finviz.com/',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        let next;
        try { next = new URL(res.headers.location, url).href; }
        catch (_) { res.resume(); return finish(null); }
        res.resume();
        fetchUrlBuffer(next, redirectsLeft - 1).then(finish);
        return;
      }
      const contentType = String(res.headers['content-type'] || '').split(';')[0].trim();
      if (res.statusCode !== 200 || !contentType.startsWith('image/')) {
        res.resume();
        finish(null);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        finish(buffer.length > 1000 ? { buffer, contentType } : null);
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Finviz timeout')));
    req.on('error', () => finish(null));
  });
}

async function fetchChartBase64(ticker) {
  const url = `https://finviz.com/chart.ashx?t=${encodeURIComponent(ticker)}&ty=c&ta=1&p=d&s=l`;
  const result = await fetchUrlBuffer(url);
  return result ? `data:${result.contentType};base64,${result.buffer.toString('base64')}` : null;
}

function chartElement(ticker, chart) {
  if (!chart) {
    return `<div style="height:118px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:10px;font-weight:700">Graphique Finviz indisponible · ${ticker}</div>`;
  }
  return `<img src="${chart}" alt="Graphique quotidien Finviz de ${ticker}" style="display:block;width:100%;height:118px;object-fit:cover;object-position:center;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;background:#f8fafc">`;
}

function loadCertifiedBacktest(scanDir, expectedClose) {
  const replayPath = path.join(SCANNER_DIR, scanDir, '_dtx', 'replay_best.json');
  const envelope = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
  const result = envelope.result;
  if (envelope.status !== 'done' || !result || result.portfolio_id !== 'best') {
    throw new Error('Backtest best indisponible ou incomplet');
  }
  if (!expectedClose || result.data_asof !== expectedClose || Number(result.sessions_behind) !== 0) {
    throw new Error(`Backtest best non certifié pour la clôture ${expectedClose || 'attendue'}`);
  }
  const combined = result.combined || {};
  const dates = Array.isArray(combined.equity_dates) ? combined.equity_dates : [];
  const values = Array.isArray(combined.equity_values) ? combined.equity_values : [];
  if (dates.length < 2 || dates.length !== values.length || dates[dates.length - 1] !== expectedClose) {
    throw new Error('Courbe backtest best absente ou de millésime incohérent');
  }
  const allocations = Array.isArray(result.results) ? result.results : [];
  const totalTrades = allocations.reduce((sum, row) => sum + Number(row.total_trades || 0), 0);
  const totalReturnPct = (Number(values[values.length - 1]) / Number(values[0]) - 1) * 100;
  const required = [combined.cagr_pct, combined.max_dd_pct, combined.sharpe, combined.avg_exposure_pct, totalReturnPct];
  if (!required.every(value => Number.isFinite(Number(value))) || totalTrades <= 0) {
    throw new Error('Métriques backtest best incomplètes');
  }
  return {
    portfolio: 'best',
    dataAsOf: result.data_asof,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    cagrPct: Number(combined.cagr_pct),
    maxDdPct: -Math.abs(Number(combined.max_dd_pct)),
    sharpe: Number(combined.sharpe),
    avgExposurePct: Number(combined.avg_exposure_pct),
    totalReturnPct,
    totalTrades,
    allocations: allocations.length,
    equityValues: values.map(Number),
  };
}

// ─── Generate HTML for the image ─────────────────────────────────────────────

// ─── Generate HTML for the image ───────────────────────────────────────

function generateHTML({ top3, backtest, regime, scanDir, yesterday }) {
  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  const fr = (value, digits = 1) => Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const pct = (value, digits = 1) => `${Number(value) > 0 ? '+' : ''}${fr(value, digits)} %`;
  const dateLabel = value => formatFrenchDate(new Date(`${value}T12:00:00Z`), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const scanDate = `${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}`;
  const sessionLabel = formatFrenchDate(new Date(`${scanDate}T12:00:00Z`), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const closeLabel = dateLabel(backtest.dataAsOf);
  const values = backtest.equityValues;
  const sampleEvery = Math.max(1, Math.ceil(values.length / 180));
  const sampled = values.filter((_, index) => index % sampleEvery === 0 || index === values.length - 1);
  const normalized = sampled.map(value => value / values[0] * 100);
  const width = 470;
  const height = 72;
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;
  const points = normalized.map((value, index) => {
    const x = index / (normalized.length - 1) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f4f7fa}body{width:1080px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#142033;font-variant-numeric:tabular-nums}.mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace}.card{background:#fff;border:1px solid #dce4ec;border-radius:10px}.label{font-size:8px;letter-spacing:1.35px;text-transform:uppercase;color:#68768a;font-weight:800}
</style></head><body>
<main style="width:1080px;background:#f4f7fa">
  <header style="height:76px;background:#111c2d;padding:14px 22px;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;border-bottom:3px solid #50b4ee">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;padding:6px"><img src="${LOGO_DATA_URI}" alt="" style="width:100%;height:100%;display:block"></div>
      <div><div style="color:#fff;font-size:20px;font-weight:850;letter-spacing:-.25px">DailyTickers</div><div style="color:#8fd2f5;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase">Scanner quotidien</div></div>
    </div>
    <div style="text-align:center"><div style="color:#fff;font-weight:800;font-size:13px;text-transform:capitalize">${esc(sessionLabel)}</div><div style="margin-top:5px"><span style="display:inline-block;background:${regime.color};color:#fff;border-radius:999px;padding:3px 10px;font-size:9px;font-weight:850">${esc(regime.label)}</span></div></div>
    <div style="text-align:right"><div style="color:#8fa0b6;font-size:8px;letter-spacing:1px;text-transform:uppercase;font-weight:700">Clôture de référence</div><div style="color:#fff;font-size:11px;font-weight:750;margin-top:3px">${esc(closeLabel)}</div><div style="color:#8fa0b6;font-size:8px;margin-top:2px">Scan précédent : ${(yesterday || []).map(item => esc(item.ticker)).join(' · ') || 'indisponible'}</div></div>
  </header>

  <section style="background:#eaf0f5;border-bottom:1px solid #d5dee8;padding:8px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px">
    <div style="display:flex;align-items:center;gap:8px"><span style="width:7px;height:7px;border-radius:50%;background:#50b4ee"></span><span style="font-size:9px;color:#3d4b60"><strong>Plan du jour :</strong> 3 idées conditionnelles pour la séance — aucune n’est une position ouverte.</span></div>
    <div style="font-size:9px;color:#3d4b60"><strong>Entrée :</strong> zone publiée + VWAP après 09:30 ET · <strong>Pas de poursuite</strong> si gap &gt; 2 %</div>
  </section>

  <div style="padding:15px 20px 12px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px"><div><div class="label">Sélection éditoriale</div><div style="font-size:15px;font-weight:850;margin-top:2px">Top 3 à surveiller</div></div><div style="font-size:8px;color:#68768a">Scores de classement, pas probabilités de gain</div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${top3.map(t => `<article class="card" style="overflow:hidden;border-top:4px solid ${t.color};padding:10px 11px 9px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:7px">
          <div><div style="display:flex;align-items:baseline;gap:6px"><span style="background:${t.color};color:#fff;border-radius:4px;padding:2px 6px;font-size:8px;font-weight:850">#${t.rank}</span><span style="font-size:18px;font-weight:900">${esc(t.ticker)}</span><span style="font-size:9px;color:#68768a">${esc(t.name)}</span></div><div style="display:inline-block;margin-top:4px;color:${t.color};background:${t.color}12;border:1px solid ${t.color}45;border-radius:999px;padding:2px 7px;font-size:8px;font-weight:750">${esc(t.strategy)}</div></div>
          <div style="min-width:44px;height:36px;border:2px solid ${t.color};background:${t.color}10;color:${t.color};border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900">${esc(t.score ?? 'N/D')}</div>
        </div>
        ${chartElement(t.ticker, t.chart)}
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px">
          ${[['Entrée', `$${t.entry ?? '—'}`, '#142033'], ['Stop', `$${t.stop ?? '—'}`, '#b4232f'], ['TP1', `$${t.tp1 ?? '—'}`, '#087f5b'], ['TP2', `$${t.tp2 ?? '—'}`, '#087f5b'], ['R/R', t.rr || '—', '#9a6700'], ['Horizon', `${t.horizon_days ?? 'N/D'} j`, '#405b91']].map(([label, value, color]) => `<div style="background:#f6f8fa;border-radius:4px;padding:4px 1px;text-align:center"><div style="font-size:6.5px;color:#7b8798;text-transform:uppercase">${label}</div><div class="mono" style="font-size:8px;font-weight:800;color:${color};white-space:nowrap;margin-top:1px">${value}</div></div>`).join('')}
        </div>
      </article>`).join('')}
    </div>

    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin:15px 0 8px"><div><div class="label">Simulation historique · portefeuille best</div><div style="font-size:15px;font-weight:850;margin-top:2px">Backtest certifié au ${esc(closeLabel)}</div></div><div style="font-size:8px;color:#68768a">${backtest.allocations} allocations · ${backtest.totalTrades.toLocaleString('fr-FR')} trades · 2021 → 2026</div></div>
    <section class="card" style="padding:11px 12px;display:grid;grid-template-columns:repeat(4,122px) 1fr;gap:9px;align-items:stretch">
      ${[
        ['CAGR', pct(backtest.cagrPct, 2), '#087f5b', 'annualisé'],
        ['Rendement total', pct(backtest.totalReturnPct, 1), '#087f5b', 'base 100'],
        ['Drawdown max', pct(backtest.maxDdPct, 2), '#b4232f', 'pic → creux'],
        ['Sharpe', fr(backtest.sharpe, 2), '#142033', `expo. moy. ${fr(backtest.avgExposurePct, 1)} %`],
      ].map(([label, value, color, note]) => `<div style="background:#f6f8fa;border:1px solid #e5ebf0;border-radius:7px;padding:9px"><div class="label" style="letter-spacing:.7px">${label}</div><div class="mono" style="font-size:20px;line-height:1.25;font-weight:900;color:${color};margin-top:3px">${value}</div><div style="font-size:7.5px;color:#7b8798;margin-top:2px">${note}</div></div>`).join('')}
      <div style="padding:4px 5px 0 8px;border-left:1px solid #e0e7ee"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><span class="label" style="letter-spacing:.7px">Courbe du capital</span><span class="mono" style="font-size:9px;font-weight:800;color:#087f5b">100 → ${fr(100 + backtest.totalReturnPct, 1)}</span></div><svg viewBox="0 0 ${width} ${height}" style="width:100%;height:72px;display:block" aria-label="Courbe du backtest"><line x1="0" y1="${height - 4}" x2="${width}" y2="${height - 4}" stroke="#dce4ec"/><polygon points="0,${height} ${points} ${width},${height}" fill="#50b4ee20"/><polyline points="${points}" fill="none" stroke="#1687bd" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg><div style="display:flex;justify-content:space-between;font-size:7px;color:#8a96a6"><span>${esc(dateLabel(backtest.startDate))}</span><span>${esc(dateLabel(backtest.endDate))}</span></div></div>
    </section>

    <footer style="margin-top:11px;padding-top:8px;border-top:1px solid #d5dee8;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:7.5px;color:#68768a;line-height:1.45"><strong style="color:#3d4b60">Pas un conseil financier.</strong> Signaux conditionnels et simulation historique ; aucune performance future n’est garantie.<br>Graphiques : Finviz · Backtest : modèle best, millésime ${esc(backtest.dataAsOf)} · Positions live non affichées sur cette carte.</div>
      <div style="text-align:right"><div style="font-size:9px;font-weight:800;color:#3d4b60">articles.dailytickers.com/scanner/${scanDir}/</div><div style="font-size:7px;color:#8a96a6;margin-top:2px">© 2026 DailyTickers™ · Tous droits réservés</div></div>
    </footer>
  </div>
</main></body></html>`;
}

// ─── Generate PNG with Puppeteer ────────────────────────────────────

async function generatePNG(html, outputPath) {
  const puppeteer = require('puppeteer');
  // Use arm64-compatible chromium from playwright if available (Hetzner aarch64 CI)
  const fs = require('fs');
  const { execSync } = require('child_process');

  // Chrome for Testing 146 on macOS can hang in Page.captureScreenshot.
  // Use the installed Playwright browser locally; CI keeps the Puppeteer path below.
  if (process.platform === 'darwin') {
    const { execFileSync } = require('child_process');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `scanner-card-${process.pid}-${Date.now()}.html`);
    try {
      fs.writeFileSync(tmp, html);
      execFileSync('playwright', [
        'screenshot', '--browser', 'chromium', '--viewport-size', '1080,400',
        '--full-page', '--wait-for-timeout', '1000', '--timeout', '60000',
        `file://${tmp}`, outputPath,
      ], { stdio: 'pipe', timeout: 65000 });
      console.log(`✅ PNG generated: ${outputPath}`);
      return;
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  }
  let executablePath;
  const playwrightBase = '/home/ci/.cache/ms-playwright';
  if (fs.existsSync(playwrightBase)) {
    try {
      const dirs = fs.readdirSync(playwrightBase).filter(d => d.startsWith('chromium-')).sort().reverse();
      for (const dir of dirs) {
        const candidate = `${playwrightBase}/${dir}/chrome-linux/chrome`;
        if (fs.existsSync(candidate)) { executablePath = candidate; break; }
      }
    } catch (e) { /* fallback to default */ }
  }
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Wait for images to load
  await new Promise(r => setTimeout(r, 2000));
  const clip = await page.evaluate(() => {
    const el = document.body.firstElementChild;
    const rect = el.getBoundingClientRect();
    return { x: 0, y: 0, width: 1080, height: Math.ceil(rect.height) };
  });
  await page.screenshot({
    path: outputPath,
    clip,
    type: 'png',
  });
  await browser.close();
  console.log(`✅ PNG generated: ${outputPath} (${clip.height}px)`);
}

// ─── Publish to Telegram ─────────────────────────────────────────────────────

async function publishTelegram(imagePath, caption) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env');
    return false;
  }

  const FormData = require('form-data');
  const form = new FormData();
  form.append('chat_id', TELEGRAM_CHAT_ID);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('photo', fs.createReadStream(imagePath));

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      method: 'POST',
      headers: form.getHeaders(),
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.ok) {
          console.log('✅ Published to Telegram');
          resolve(true);
        } else {
          console.error('❌ Telegram error:', json.description);
          resolve(false);
        }
      });
    });
    req.on('error', e => { console.error('❌ Telegram request error:', e.message); resolve(false); });
    form.pipe(req);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Determine scan dir
  const argDate = process.argv.find(a => /^\d{8}/.test(a));
  let scanDir;
  if (argDate) {
    scanDir = argDate;
  } else {
    // Find latest scan — skip empty placeholder dirs (no index.html or < 5KB)
    const dirs = fs.readdirSync(SCANNER_DIR)
      .filter(d => /^\d{8}(-\d+)?$/.test(d))
      .sort()
      .reverse();
    for (const d of dirs) {
      const p = path.join(SCANNER_DIR, d, 'index.html');
      try {
        const st = fs.statSync(p);
        if (st.size > 5000) { scanDir = d; break; }
      } catch (_) { }
    }
    scanDir = scanDir || dirs[0];
  }

  if (!scanDir) { console.error('No scan dir found'); process.exit(1); }
  console.log(`Using scan: ${scanDir}`);

  // Extract top3 from HTML
  const top3raw = extractTop3(scanDir);
  if (top3raw.length !== 3) throw new Error(`Top 3 incomplet (${top3raw.length}/3)`);
  const regime = extractRegime(scanDir);
  const completedEnds = [...new Set(top3raw.map(item => item.completed_end).filter(Boolean))];
  if (completedEnds.length !== 1) throw new Error('Clôture de référence incohérente dans le Top 3');
  const backtest = loadCertifiedBacktest(scanDir, completedEnds[0]);

  // Finviz is the established scanner chart source. Embed each chart after
  // following its full redirect chain so the final screenshot stays complete.
  console.log('Fetching Finviz charts...');
  const chartResults = await Promise.all(top3raw.map(item => fetchChartBase64(item.ticker)));
  const top3 = top3raw.map((t, i) => {
    const colors = ['#059669', '#2563eb', '#7c3aed'];
    return {
      ...t,
      rank: i + 1,
      color: colors[i],
      chart: chartResults[i],
    };
  });

  // Yesterday top3 (previous scan)
  const allScanDirs = fs.readdirSync(SCANNER_DIR)
    .filter(d => /^\d{8}(-\d+)?$/.test(d)).sort().reverse();
  const prevDir = allScanDirs.find(dir => dir !== scanDir);
  const yesterday = prevDir ? extractTop3(prevDir).slice(0, 3).map(t => ({
    ticker: t.ticker,
  })) : [];

  // Generate HTML
  const html = generateHTML({ top3, backtest, regime, scanDir, yesterday })
    .replace(/[ \t]+$/gm, '');

  // Save HTML for debugging
  const htmlPath = path.join(ROOT, 'scanner-daily-card.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML saved: ${htmlPath}`);

  // Generate PNG
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const pngPath = path.join(ROOT, `scanner-daily-${today}.png`);

  if (!DRY_RUN) {
    await generatePNG(html, pngPath);

    // Also save to scanner/status/ with timestamp for cache busting
    const statusDir = path.join(SCANNER_DIR, 'status');
    const ts = Date.now();

    // Clean old daily-card-*.png files
    try {
      fs.readdirSync(statusDir)
        .filter(f => /^daily-card-\d+\.png$/.test(f))
        .forEach(f => fs.unlinkSync(path.join(statusDir, f)));
    } catch (_) {}

    const dailyCardFilename = `daily-card-${ts}.png`;
    const dailyCardPath = path.join(statusDir, dailyCardFilename);
    fs.copyFileSync(pngPath, dailyCardPath);
    console.log(`✅ Daily card copied to: ${dailyCardPath}`);

    // Cible Open Graph canonique : render-scanner.js pointe TOUTES les pages scanner sur
    // /scanner-daily-card.png (meta og:image + twitter:image). Aucun outil n'écrivait ce
    // fichier — il n'était mis à jour que par les copies datées, donc l'aperçu partagé sur
    // Telegram/WhatsApp restait figé sur une carte périmée. On l'écrase à chaque génération.
    const ogCardPath = path.join(ROOT, 'scanner-daily-card.png');
    fs.copyFileSync(pngPath, ogCardPath);
    console.log(`✅ Open Graph card updated: ${ogCardPath}`);

    // Update manifest.json with daily-card entry
    const manifestPath = path.join(statusDir, 'manifest.json');
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(manifestPath)); } catch (_) {}
    manifest['daily-card'] = dailyCardFilename;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest updated with daily-card`);
  } else {
    console.log('Dry run — skipping PNG generation');
  }

  // Publish to Telegram
  if (PUBLISH_TELEGRAM && !DRY_RUN && fs.existsSync(pngPath)) {
    const scanUrl = `https://articles.dailytickers.com/scanner/${scanDir}/`;
    const caption = `📡 *Scanner DailyTickers* — ${new Date().toLocaleDateString('fr-FR')}
Régime : *${regime.label}* | Top 5 + Rotation | Sans Short Squeeze

🔗 [Voir l'analyse complète](${scanUrl})
_articles.dailytickers.com_`;
    await publishTelegram(pngPath, caption);
  }

  console.log('\n✅ Done.');
}

main().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
