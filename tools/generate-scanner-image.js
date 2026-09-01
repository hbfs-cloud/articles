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
 *   - data/modes-config.json (état public du produit DTX Max)
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
const DTX_PUBLIC_LABEL = 'DTX Max';
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

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

function formatFrenchDate(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'date indisponible';
  const rendered = new Intl.DateTimeFormat('fr-FR', options).format(date);
  return rendered.replace(/\b1 (?=[a-zéû])/i, '1er ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/D';
  return numeric.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
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
  const safeTicker = escapeHtml(ticker);
  if (!chart) {
    return `<div class="pick-chart pick-chart-empty">Graphique Finviz indisponible · ${safeTicker}</div>`;
  }
  return `<img src="${chart}" alt="Graphique quotidien Finviz de ${safeTicker}" class="pick-chart">`;
}

const DTX_FORWARD_NOTICES = Object.freeze({
  not_started: Object.freeze({
    stateLabel: 'suivi réel non démarré',
    stateSentence: 'Le suivi réel n’a pas encore démarré; aucune exécution DTX n’est revendiquée avant un fill certifié.',
  }),
  active: Object.freeze({
    stateLabel: 'suivi réel actif',
    stateSentence: 'Le suivi réel est actif; seules les exécutions certifiées sont comptées sur le tableau de bord.',
  }),
  paused: Object.freeze({
    stateLabel: 'suivi réel en pause',
    stateSentence: 'Le suivi réel est en pause; son état d’exécution certifié reste consultable sur le tableau de bord.',
  }),
});

function buildDtxProductNotice(mode) {
  const tracking = mode && mode.forwardTracking;
  if (!mode || mode.label !== DTX_PUBLIC_LABEL) {
    throw new Error(`Produit public ${DTX_PUBLIC_LABEL} absent ou renommé dans modes-config.json`);
  }
  const status = typeof tracking?.status === 'string' ? tracking.status.trim().toLowerCase() : '';
  const notice = Object.prototype.hasOwnProperty.call(DTX_FORWARD_NOTICES, status)
    ? DTX_FORWARD_NOTICES[status]
    : null;
  if (!notice) {
    throw new Error(`État forward ${DTX_PUBLIC_LABEL} inconnu ou absent (${status || 'absent'}) — carte refusée`);
  }
  return {
    label: mode.label,
    status,
    ...notice,
  };
}

function loadDtxProductNotice() {
  const modesPath = path.join(ROOT, 'data', 'modes-config.json');
  const config = JSON.parse(fs.readFileSync(modesPath, 'utf8'));
  return buildDtxProductNotice(config.modes && config.modes.best);
}

function buildTelegramCaption({ top3, regime, scanDir, dtxNotice }) {
  if (!Array.isArray(top3) || top3.length !== 3) {
    throw new Error(`Légende Telegram impossible : Top 3 incomplet (${top3?.length || 0}/3)`);
  }
  const scanDate = new Date(`${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}T12:00:00Z`);
  const captionDate = formatFrenchDate(scanDate, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const ideas = top3.map(item => (
    `• <b>${escapeHtml(item.ticker)}</b> : entrée ${escapeHtml(formatPrice(item.entry))} · `
    + `stop ${escapeHtml(formatPrice(item.stop))} · TP ${escapeHtml(formatPrice(item.tp1))}`
    + (item.tp2 != null ? ` / ${escapeHtml(formatPrice(item.tp2))}` : '')
  )).join('\n');
  const scanUrl = `https://articles.dailytickers.com/scanner/${scanDir}/`;
  const zeroPositionDisclosure = dtxNotice.status === 'not_started'
    ? ', aucune position ouverte'
    : '';
  const caption = `📡 <b>Scanner DailyTickers — ${captionDate}</b>
Régime : <b>${escapeHtml(regime.label)}</b>

<b>Top 3 éditorial — aucune idée exécutée${zeroPositionDisclosure}</b>
${ideas}

Après 09:30 ET, attendre un prix dans la zone publiée et au-dessus du VWAP (prix moyen échangé pendant la séance). Ne pas poursuivre un gap &gt; 2 % sans retour dans la zone.

<b>${escapeHtml(dtxNotice.label)}</b> est un produit distinct. ${escapeHtml(dtxNotice.stateSentence)}

Pas un conseil financier. <a href="${scanUrl}">Voir le scan complet</a>`;
  if (caption.length > 1024) {
    throw new Error(`Légende Telegram trop longue (${caption.length}/1024)`);
  }
  return caption;
}

// ─── Generate HTML for the image ─────────────────────────────────────────────

function generateHTML({ top3, regime, scanDir, referenceClose, dtxNotice }) {
  if (!Array.isArray(top3) || top3.length !== 3) {
    throw new Error(`Carte Telegram impossible : Top 3 incomplet (${top3?.length || 0}/3)`);
  }
  const scanDate = `${scanDir.slice(0, 4)}-${scanDir.slice(4, 6)}-${scanDir.slice(6, 8)}`;
  const sessionLabel = formatFrenchDate(new Date(`${scanDate}T12:00:00Z`), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const closeLabel = formatFrenchDate(new Date(`${referenceClose}T12:00:00Z`), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const pickCards = top3.map(item => {
    const rr = String(item.rr || '—').replace('.', ',');
    const levelItems = [
      ['Entrée', formatPrice(item.entry), ''],
      ['Stop', formatPrice(item.stop), ' level-stop'],
      ['TP1', formatPrice(item.tp1), ' level-target'],
      ['TP2', formatPrice(item.tp2), ' level-target'],
    ];
    return `<article class="pick-card" style="--pick:${escapeHtml(item.color)}">
      <div class="pick-head">
        <div class="pick-identity">
          <span class="rank">#${item.rank}</span>
          <strong class="ticker">${escapeHtml(item.ticker)}</strong>
          <span class="company">${escapeHtml(item.name)}</span>
          <span class="setup">${escapeHtml(item.strategy)}</span>
        </div>
        <div class="score"><span>${escapeHtml(formatScore(item.score))}</span><small>score de classement</small></div>
      </div>
      <div class="pick-body">
        ${chartElement(item.ticker, item.chart)}
        <div class="level-grid">
          ${levelItems.map(([label, value, className]) => `<div class="level${className}"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
          <div class="level-meta"><span>R/R <b>${escapeHtml(rr)}</b></span><span>Horizon <b>${escapeHtml(item.horizon_days ?? 'N/D')} j</b></span></div>
        </div>
      </div>
    </article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;overflow:hidden;background:#eef3f7}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#142033;font-variant-numeric:tabular-nums}
.card-shell{width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;display:flex;flex-direction:column;background:#eef3f7}
.topbar{height:118px;flex:0 0 118px;padding:22px 32px;background:#111c2d;border-bottom:3px solid #50b4ee;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:18px}.brand-mark{width:68px;height:68px;padding:8px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}.brand-mark img{display:block;width:100%;height:100%}
.brand-name{color:#fff;font-size:38px;font-weight:850;letter-spacing:-.02em;line-height:1}.brand-sub{margin-top:8px;color:#9bd8f6;font-size:18px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.session{text-align:right}.session-date{color:#fff;font-size:28px;font-weight:800;text-transform:capitalize}.session-meta{margin-top:9px;display:flex;align-items:center;justify-content:flex-end;gap:14px;color:#b9c7d8;font-size:20px;font-weight:650}.regime{padding:6px 13px;border-radius:999px;background:${escapeHtml(regime.color)};color:#fff;font-size:20px;font-weight:850}
.execution-rule{height:96px;flex:0 0 96px;padding:17px 32px;background:#e7f1f7;border-bottom:1px solid #cbd9e3;display:grid;grid-template-columns:350px 1fr;align-items:center;gap:28px}
.rule-state strong{display:block;font-size:27px;line-height:1.1}.rule-state span{display:block;margin-top:6px;color:#4f6074;font-size:21px;font-weight:650}.rule-copy{color:#314256;font-size:22px;line-height:1.28;font-weight:650}
.content{flex:1;min-height:0;padding:22px 32px 20px;display:flex;flex-direction:column}
.section-head{height:52px;display:flex;align-items:flex-start;justify-content:space-between}.section-head h1{margin:0;font-size:36px;line-height:1.1;letter-spacing:-.02em}.section-head p{margin:8px 0 0;color:#5b687a;font-size:20px;font-weight:650}
.picks{display:grid;grid-template-rows:repeat(3,274px);gap:14px}
.pick-card{height:274px;padding:16px;background:#fff;border:1px solid #d4dee7;border-top:5px solid var(--pick);border-radius:14px;overflow:hidden}
.pick-head{height:52px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.pick-identity{display:flex;align-items:center;gap:12px;min-width:0}
.rank{padding:5px 10px;border-radius:7px;background:var(--pick);color:#fff;font-size:20px;font-weight:850}.ticker{font-size:42px;line-height:1;color:#142033;letter-spacing:-.02em}.company{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#59687b;font-size:22px}.setup{padding:5px 10px;border-radius:999px;background:#eef3f7;color:#3e5066;font-size:20px;font-weight:750}
.score{min-width:154px;text-align:right;color:var(--pick)}.score span{display:block;font-size:38px;line-height:.9;font-weight:900}.score small{display:block;margin-top:7px;color:#5b687a;font-size:16px;font-weight:700}
.pick-body{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(330px,1fr);gap:18px;margin-top:12px}
.pick-chart{display:block;width:100%;height:174px;object-fit:cover;object-position:center;border:1px solid #dce4ec;border-radius:9px;background:#f4f7fa}.pick-chart-empty{display:flex;align-items:center;justify-content:center;color:#526174;font-size:22px;font-weight:700}
.level-grid{height:174px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:1fr 1fr 34px;gap:8px}
.level{padding:8px 10px;border-radius:9px;background:#f2f5f8;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.level span{color:#5a6879;font-size:18px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.level strong{margin-top:3px;color:#142033;font-family:"SF Mono",ui-monospace,Consolas,monospace;font-size:27px;line-height:1;font-weight:850;white-space:nowrap}.level-stop strong{color:#a91f32}.level-target strong{color:#08745a}
.level-meta{grid-column:1/-1;padding:0 10px;border-top:1px solid #dce4ec;display:flex;align-items:flex-end;justify-content:space-between;color:#59687b;font-size:19px}.level-meta b{color:#142033}
.dtx-note{height:82px;flex:0 0 82px;margin-top:16px;padding:0 22px;border:1px solid #d9cef8;border-radius:13px;background:#f7f4ff;display:flex;align-items:center;justify-content:space-between;gap:24px}.dtx-note strong{color:#6237c5;font-size:29px;white-space:nowrap}.dtx-note span{color:#3e3b50;font-size:23px;font-weight:700;text-align:right}
.card-footer{min-height:56px;margin-top:auto;padding-top:13px;border-top:1px solid #ced9e2;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;color:#59687b;font-size:17px;line-height:1.35}.card-footer strong{color:#35465a}.card-footer .url{color:#26384d;font-size:22px;font-weight:800;white-space:nowrap}
</style></head><body>
<main class="card-shell">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark"><img src="${LOGO_DATA_URI}" alt=""></div>
      <div><div class="brand-name">DailyTickers</div><div class="brand-sub">Scanner quotidien</div></div>
    </div>
    <div class="session">
      <div class="session-date">${escapeHtml(sessionLabel)}</div>
      <div class="session-meta"><span>Référence de calcul : ${escapeHtml(closeLabel)}</span><span class="regime">${escapeHtml(regime.label)}</span></div>
    </div>
  </header>

  <section class="execution-rule">
    <div class="rule-state"><strong>3 idées conditionnelles</strong><span>Aucune idée n’est exécutée</span></div>
    <div class="rule-copy">Après 09:30 ET : rester dans la zone publiée et confirmer au-dessus du VWAP, le prix moyen de séance. Ignorer tout gap &gt; 2 % sans retour.</div>
  </section>

  <div class="content">
    <div class="section-head">
      <h1>Top 3 à surveiller</h1>
      <p>Scores de classement — jamais des probabilités de gain</p>
    </div>
    <section class="picks">${pickCards}</section>

    <aside class="dtx-note">
      <strong>${escapeHtml(dtxNotice.label)}</strong>
      <span>Produit distinct du Top 3 · ${escapeHtml(dtxNotice.stateLabel)}</span>
    </aside>

    <footer class="card-footer">
      <div><strong>Pas un conseil financier.</strong> Plans conditionnels, sans ordre automatique.<br>Données arrêtées au ${escapeHtml(closeLabel)} · Graphiques : Finviz</div>
      <div class="url">articles.dailytickers.com/scanner/${scanDir}/</div>
    </footer>
  </div>
</main></body></html>`;
}

// ─── Generate PNG with Puppeteer ────────────────────────────────────

async function generatePNG(html, outputPath) {
  const puppeteer = require('puppeteer');
  // Use arm64-compatible chromium from playwright if available (Hetzner aarch64 CI)
  const fs = require('fs');

  // Chrome for Testing 146 on macOS can hang in Page.captureScreenshot.
  // Use the installed Playwright browser locally; CI keeps the Puppeteer path below.
  if (process.platform === 'darwin') {
    const { execFileSync } = require('child_process');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), `scanner-card-${process.pid}-${Date.now()}.html`);
    try {
      fs.writeFileSync(tmp, html);
      execFileSync('playwright', [
        'screenshot', '--browser', 'chromium', '--viewport-size', `${CARD_WIDTH},${CARD_HEIGHT}`,
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
  await page.setViewport({ width: CARD_WIDTH, height: CARD_HEIGHT, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Wait for images to load
  await new Promise(r => setTimeout(r, 2000));
  const clip = await page.evaluate(() => {
    const el = document.body.firstElementChild;
    const rect = el.getBoundingClientRect();
    return { x: 0, y: 0, width: rect.width, height: Math.ceil(rect.height) };
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
  form.append('parse_mode', 'HTML');
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
  const referenceClose = completedEnds[0];
  const dtxNotice = loadDtxProductNotice();

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

  // Generate HTML
  const html = generateHTML({ top3, regime, scanDir, referenceClose, dtxNotice })
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
    const caption = buildTelegramCaption({ top3, regime, scanDir, dtxNotice });
    await publishTelegram(pngPath, caption);
  }

  console.log('\n✅ Done.');
}

module.exports = {
  CARD_HEIGHT,
  CARD_WIDTH,
  buildDtxProductNotice,
  buildTelegramCaption,
  generateHTML,
  loadDtxProductNotice,
};

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
}
