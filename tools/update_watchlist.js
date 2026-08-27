/**
 * update_watchlist.js — Extract picks from a scanner HTML and update mcp/watchlist.json
 *
 * Usage: node tools/update_watchlist.js scanner/YYYYMMDD/index.html
 *
 * Parses the scanner's synthesis table + ECharts gauge data to build
 * a fresh watchlist.json for the prompt-ia Live Data Preview and MCP server.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const argPath = process.argv[2];
if (!argPath) {
  console.error('Usage: node tools/update_watchlist.js scanner/YYYYMMDD/index.html');
  process.exit(1);
}

const fullPath = path.resolve(__dirname, '..', argPath);
if (!fs.existsSync(fullPath)) {
  console.error('File not found: ' + fullPath);
  process.exit(1);
}

const html = fs.readFileSync(fullPath, 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
const scanDir = path.dirname(fullPath);
const signalsPath = path.join(scanDir, 'signals.json');

// --- Extract date from folder name (YYYYMMDD) ---
const dateMatch = argPath.match(/(\d{8})/);
if (!dateMatch) {
  console.error('Cannot extract date from path. Expected scanner/YYYYMMDD/');
  process.exit(1);
}
const dateStr = dateMatch[1];
const isoDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T23:00:00Z`;

// --- Extract regime from badge ---
let regime = 'UNKNOWN';
const badges = doc.querySelectorAll('.badge');
for (const b of badges) {
  const txt = b.textContent.trim().toUpperCase();
  if (txt.includes('RISK-OFF') || txt.includes('RISK-ON') || txt.includes('NEUTRAL') || txt.includes('RECOVERY')) {
    regime = txt;
    break;
  }
}

// --- Extract macro metrics from ticker-metrics ---
let vix = null, dxy = null, spx = null, us10y = null, fearGreed = null;
const metricEls = doc.querySelectorAll('.ticker-metric');
for (const m of metricEls) {
  const label = (m.querySelector('.tm-label') || {}).textContent || '';
  const value = (m.querySelector('.tm-value') || {}).textContent || '';
  const labelLow = label.toLowerCase();
  if (labelLow.includes('vix')) vix = parseFloat(value.replace(',', '.')) || null;
  if (labelLow.includes('score moyen')) { /* skip, computed later */ }
}

// Try extracting VIX/DXY/SPX from badge text or ticker-metrics
const allText = html.replace(/&[a-z]+;/g, ' ').replace(/&#\d+;/g, ' ');
// Look for "VIX 23,75" or "VIX: 23.75" patterns (with realistic range 10-80)
const vixMatch = allText.match(/VIX[\s:]+(\d{1,2}[,\.]\d+)/i);
if (vixMatch && !vix) vix = parseFloat(vixMatch[1].replace(',', '.'));
const dxyMatch = allText.match(/DXY[\s:]+(\d{2,3}[,\.]\d+)/i);
if (dxyMatch && !dxy) dxy = parseFloat(dxyMatch[1].replace(',', '.'));
const spxMatch = allText.match(/S.P\s*500[\s:]+(\d{3,5})/i) || allText.match(/SPX[\s:]+(\d{3,5})/i);
if (spxMatch && !spx) spx = parseInt(spxMatch[1]);

// --- Extract picks from synthesis table ---
const picks = [];
const rows = doc.querySelectorAll('table tr');
for (const row of rows) {
  const cells = row.querySelectorAll('td');
  if (cells.length < 7) continue;

  const ticker = (cells[0].textContent || '').trim();
  const score = parseInt(cells[1].textContent) || 0;
  const strategy = (cells[2].textContent || '').trim();
  const entryText = (cells[3].textContent || '').trim();
  const stopText = (cells[4].textContent || '').trim();
  const tp1Text = (cells[5].textContent || '').trim();
  const rrText = (cells[6].textContent || '').trim();

  if (!ticker || score < 50) continue;

  // Parse entry (take midpoint of range like "$187-190" or "$43,50-45")
  // Match two number groups separated by dash/ndash
  const entryClean = entryText.replace(/\$/g, '').trim();
  const rangeMatch = entryClean.match(/^([\d.,\s]+)[-–]([\d.,\s]+)$/);
  let entry;
  if (rangeMatch) {
    entry = (parseNum(rangeMatch[1]) + parseNum(rangeMatch[2])) / 2;
  } else {
    entry = parseNum(entryClean);
  }

  const stop = parseNum(stopText);
  const tp1 = parseNum(tp1Text);

  picks.push({ ticker, score, strategy, entry, stop, tp1, rr: rrText.replace(/\s/g, '') });
}

function parseNum(s) {
  if (!s) return 0;
  // Remove currency symbols and spaces
  let clean = s.replace(/[$€£\s\u00a0]/g, '');
  // French format: 1.234,56 or 179,50 — detect comma as decimal
  // If there's a comma and no dot after it, comma is decimal separator
  if (clean.includes(',') && !clean.includes('.')) {
    clean = clean.replace(',', '.');
  } else if (clean.includes(',') && clean.includes('.')) {
    // 1.234,56 format — remove dots (thousands), comma becomes dot
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

// --- Enrich picks with setup card data (name, catalyst, region, tags) ---
for (const pick of picks) {
  const tickerLower = pick.ticker.toLowerCase();

  // Find setup card
  const setupEl = doc.getElementById('setup-' + pick.ticker) || doc.getElementById('setup-' + tickerLower);

  let name = pick.ticker;
  let catalyst = '';
  let region = 'US';
  let tags = [];

  if (setupEl) {
    // Name from h3
    const h3 = setupEl.querySelector('h3');
    if (h3) {
      const parts = h3.textContent.split('—');
      name = parts.length > 1 ? parts[1].trim() : parts[0].replace(pick.ticker, '').trim();
    }

    // Catalyst from setup-description — take first sentence, max 100 chars
    const descEl = setupEl.querySelector('.setup-description');
    if (descEl) {
      let raw = descEl.textContent.trim();
      // Remove "Thèse :" prefix
      raw = raw.replace(/^Th[eè]se\s*:\s*/i, '');
      // Take first sentence
      const firstSentence = raw.split(/\.\s/)[0];
      catalyst = firstSentence.length > 100 ? firstSentence.slice(0, 97) + '...' : firstSentence;
    }

    // Region from badges
    const badgeEls = setupEl.querySelectorAll('.badge');
    for (const b of badgeEls) {
      const t = b.textContent.trim().toLowerCase();
      if (t.includes('europe') || t.includes('eu')) region = 'EU';
      else if (t.includes('asia') || t.includes('apac')) region = 'APAC';
      else if (t.includes('etf')) region = 'ETF';
      else if (t.includes('crypto')) region = 'Crypto';
    }

    // Tags from badges
    for (const b of badgeEls) {
      const t = b.textContent.trim().toLowerCase();
      if (['energy', 'tech', 'healthcare', 'defense', 'financials', 'materials', 'industrials', 'consumer'].some(s => t.includes(s))) {
        tags.push(t.replace(/[^a-z]/g, ''));
      }
      if (t.includes('hedge')) tags.push('hedge');
      if (t.includes('etf')) tags.push('etf');
      if (t.includes('commodity') || t.includes('gold') || t.includes('oil')) tags.push('commodity');
    }
  }

  // Detect region from ticker if not found
  if (region === 'US' && (pick.ticker.includes('.') || ['VGK','EWG','EWQ','EWU','EWP','EWI'].includes(pick.ticker))) region = 'EU';
  if (['EWJ','EWY','EWH','FXI','MCHI'].includes(pick.ticker)) region = 'APAC';
  if (['GLD','SLV','USO','UNG','DBA'].includes(pick.ticker)) region = 'ETF';
  if (['SH','SDS','SQQQ','SPXU','PSQ'].includes(pick.ticker)) region = 'ETF';
  if (['BITO','ETHE','BTC-USD','ETH-USD'].includes(pick.ticker)) region = 'Crypto';

  // Extract TP2 from levels grid if possible
  let tp2 = null;
  if (setupEl) {
    const levelItems = setupEl.querySelectorAll('.level-item');
    for (const li of levelItems) {
      const lbl = (li.querySelector('.lbl') || {}).textContent || '';
      const val = (li.querySelector('.val') || {}).textContent || '';
      if (lbl.toLowerCase().includes('target 2') || lbl.toLowerCase().includes('tp2')) {
        tp2 = parseNum(val);
      }
    }
  }

  pick.name = name;
  pick.catalyst = catalyst;
  pick.region = region;
  pick.tags = tags.length > 0 ? tags : [pick.strategy.toLowerCase()];
  pick.tp2 = tp2 || Math.round(pick.tp1 * 1.15 * 100) / 100;
  pick.entry = Math.round(pick.entry * 100) / 100;
}

// Sort by score descending
picks.sort((a, b) => b.score - a.score);

// New scanner renderer no longer exposes score in the synthesis table. Fall back
// to signals.json, which is the canonical structured source for watchlist fields.
if (picks.length === 0 && fs.existsSync(signalsPath)) {
  const sig = JSON.parse(fs.readFileSync(signalsPath, 'utf8'));
  for (const s of (sig.signals || [])) {
    const entry = s.entry != null ? Number(s.entry)
      : (s.entry_low != null && s.entry_high != null ? (Number(s.entry_low) + Number(s.entry_high)) / 2 : null);
    const stop = s.stop != null ? Number(s.stop) : null;
    const tp1 = s.tp1 != null ? Number(s.tp1) : null;
    if (!s.ticker || s.score == null || !s.strategy || entry == null) continue;
    picks.push({
      ticker: String(s.ticker),
      name: s.name || s.ticker,
      strategy: s.strategy,
      entry: Math.round(entry * 100) / 100,
      stop: stop != null ? Math.round(stop * 100) / 100 : null,
      tp1: tp1 != null ? Math.round(tp1 * 100) / 100 : null,
      tp2: s.tp2 != null ? Math.round(Number(s.tp2) * 100) / 100 : null,
      rr: typeof s.rr === 'string' ? s.rr : (s.rr_entry != null ? `1:${Number(s.rr_entry).toFixed(2)}` : null),
      score: Number(s.score),
      region: s.region || 'US',
      tags: [s.sector, s.strategy].filter(Boolean).map(x => String(x).toLowerCase()),
      catalyst: s.thesis || s.catalyst || '',
      sharia: !!s.sharia,
    });
  }
  picks.sort((a, b) => b.score - a.score);
}

// --- Extract alerts ---
const alerts = {
  regime_change: false,
  vix_elevated: vix ? vix > 20 : false,
  earnings_today: [],
  macro_events: []
};

// Try to find earnings/macro from alert-box
const alertBoxes = doc.querySelectorAll('.alert-box');
for (const ab of alertBoxes) {
  const text = ab.textContent;
  // Extract ticker mentions that look like earnings
  const earningsMatch = text.match(/earnings?\s+(?:de\s+)?(\w+)/gi);
  if (earningsMatch) {
    for (const e of earningsMatch) {
      const t = e.split(/\s+/).pop();
      if (t.length >= 2 && t.length <= 5 && t === t.toUpperCase()) {
        alerts.earnings_today.push(t);
      }
    }
  }
}

// --- Compute next update date ---
const y = parseInt(dateStr.slice(0, 4));
const m = parseInt(dateStr.slice(4, 6)) - 1;
const d = parseInt(dateStr.slice(6, 8));
const nextDate = new Date(y, m, d + 1);
const nextIso = nextDate.toISOString().split('T')[0] + 'T23:00:00Z';

// --- Build watchlist.json ---
const watchlist = {
  updated_at: isoDate,
  updated: isoDate,
  source: 'DailyTickers Scanner',
  url: `https://articles.dailytickers.com/scanner/${dateStr}/`,
  regime: regime,
  vix: vix,
  dxy: dxy,
  us10y: us10y,
  spx: spx,
  fear_greed: fearGreed,
  picks: picks.map(p => ({
    ticker: p.ticker,
    name: p.name,
    strategy: p.strategy,
    entry: p.entry,
    stop: p.stop,
    tp1: p.tp1,
    tp2: p.tp2,
    rr: p.rr,
    score: p.score,
    region: p.region,
    tags: p.tags,
    catalyst: p.catalyst
  })),
  alerts: alerts,
  next_update: nextIso
};

// --- Write ---
const outPath = path.resolve(__dirname, '..', 'mcp', 'watchlist.json');
fs.writeFileSync(outPath, JSON.stringify(watchlist, null, 2) + '\n', 'utf8');

console.log(`Watchlist updated: ${picks.length} picks from scanner ${dateStr}`);
console.log(`  Regime: ${regime} | VIX: ${vix || '?'} | DXY: ${dxy || '?'}`);
console.log(`  Top pick: ${picks[0]?.ticker} (${picks[0]?.score}) | Lowest: ${picks[picks.length-1]?.ticker} (${picks[picks.length-1]?.score})`);
console.log(`  Output: ${outPath}`);
