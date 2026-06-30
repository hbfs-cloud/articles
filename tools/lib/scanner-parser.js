/**
 * tools/lib/scanner-parser.js — Shared scanner signal loader.
 *
 * PRIMARY: reads `scanner/YYYYMMDD/signals.json` — zero parsing, direct JSON.
 * FALLBACK: parses HTML for legacy scans (pre-signals.json).
 *
 * IMPORTANT: loadSignals always returns NUMBERS for price fields (entry, stop, tp1, tp2).
 * Display formatting ("$120.50") is the caller's responsibility — data layer never adds "$".
 *
 * Signal shape: { ticker, score, strategy, entry, stop, tp1, tp2, rr, sharia, thesis }
 *   entry/stop/tp1/tp2 = number | null
 *   sharia = true | false | null (null = untagged legacy scan)
 */
'use strict';

const REGIME_RANK = { 'RISK-OFF': 0, 'EARLY RISK-OFF': 1, 'NEUTRAL': 2, 'RECOVERY': 3, 'RISK-ON': 4 };

function scoreToRegime(score) {
  if (score >= 65) return 'RISK-ON';
  if (score >= 55) return 'RECOVERY';
  if (score >= 45) return 'NEUTRAL';
  if (score >= 38) return 'EARLY RISK-OFF';
  return 'RISK-OFF';
}

function adjustRegimeLabel(label, score) {
  if (score == null || !label) return label;
  const implied = scoreToRegime(score);
  const labelRank = REGIME_RANK[String(label).toUpperCase().trim()] ?? 2;
  const scoreRank = REGIME_RANK[implied] ?? 2;
  return labelRank > scoreRank ? implied : label;
}

const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const SCANNER_DIR = path.join(__dirname, '..', '..', 'scanner');

// ─── Price helpers ──────────────────────────────────────────────────────────

function parsePrice(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s > 0 ? s : null;
  const clean = String(s).replace(/[$,\s]/g, '').replace(/[–—]/g, '-');
  const nums = clean.split('-').map(Number).filter(n => n > 0);
  if (!nums.length) return null;
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// ─── PRIMARY: load from signals.json ────────────────────────────────────────

/**
 * Load signals for a scan directory. Tries signals.json first, falls back to HTML.
 * @param {string} dir — directory name like "20260414" (relative to scanner/)
 * @returns {{ signals: Array, thesis: Object }} or null
 */
function extractRegimeFromHtml(html) {
  if (!html) return null;
  const m = html.match(/\b(EARLY RISK-OFF|RISK-OFF|RISK-ON|NEUTRAL|RECOVERY)\b/);
  return m ? m[1] : null;
}

function loadSignals(dir) {
  const jsonPath = path.join(SCANNER_DIR, dir, 'signals.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const thesis = {};
      const mapSignal = s => {
        if (s.thesis) thesis[s.ticker] = s.thesis;
        return {
          ticker: s.ticker,
          score: s.score || 0,
          strategy: s.strategy || '',
          entry: parsePrice(s.entry),
          stop: parsePrice(s.stop),
          tp1: parsePrice(s.tp1),
          tp2: parsePrice(s.tp2),
          rr: s.rr || '',
          sharia: s.sharia != null ? s.sharia : null,
          thesis: s.thesis || '',
          // Preserve fields used by validate-scan.js blocking rules
          region: s.region || null,
          extension: s.extension || null,
          earnings_clear: s.earnings_clear,
          dilution_clear: s.dilution_clear,
          horizon: s.horizon,
          name: s.name,
          pattern: s.pattern || null,
        };
      };
      const baseSignals = (data.signals || []).map(mapSignal);
      // Strategy-specific pools (multi-list format: momentum[], breakout[], etc.)
      const STRATEGY_POOLS = ['momentum', 'breakout', 'pullback', 'pre_squeeze'];
      const strategyPools = {};
      const seenTickers = new Set(baseSignals.map(s => s.ticker));
      for (const pool of STRATEGY_POOLS) {
        strategyPools[pool] = (data[pool] || []).map(mapSignal);
      }
      // Merge strategy pools into signals for backward compat (dedup by ticker)
      const signals = [...baseSignals];
      for (const pool of STRATEGY_POOLS) {
        for (const s of strategyPools[pool]) {
          if (!seenTickers.has(s.ticker)) {
            signals.push(s);
            seenTickers.add(s.ticker);
          }
        }
      }
      const tklPool = (data.tkl_pool || []).map(s => {
        const m = mapSignal(s);
        m.source = 'tkl_pool';
        return m;
      });
      // Asset-class pools (crypto/metals/forex) — each tagged with its source for per-mode filtering.
      const poolFrom = key => (data[key] || []).map(s => { const m = mapSignal(s); m.source = key; return m; });
      const cryptoPool = poolFrom('crypto_pool');
      const metalsPool = poolFrom('metals_pool');
      const forexPool = poolFrom('forex_pool');
      // regimeScore: numeric regime strength (0-100). Used by the regime-score override
      // (proactive de-risk when the score deteriorates even if the label still says RISK-ON).
      const regimeScore = (data.regimeScore ?? data.regime_score ?? null);
      return { signals, strategyPools, tklPool, cryptoPool, metalsPool, forexPool, thesis, regime: data.regime || 'EARLY RISK-OFF', regimeScore };  // retail fail-closed: null regime = max caution
    } catch (_) { /* fall through to HTML */ }
  }

  // FALLBACK: parse HTML (legacy scans without signals.json)
  const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const raw = parseScannerHtml(html);
  const thesisMap = parseThesisMap(html);
  // Normalize HTML-parsed signals to numbers
  const signals = raw.map(s => ({
    ...s,
    entry: parsePrice(s.entry),
    stop: parsePrice(s.stop),
    tp1: parsePrice(s.tp1),
    tp2: parsePrice(s.tp2),
    thesis: thesisMap[s.ticker] || '',
  }));
  const regime = extractRegimeFromHtml(html);
  return { signals, tklPool: [], cryptoPool: [], metalsPool: [], forexPool: [], thesis: thesisMap, regime, regimeScore: null };
}

// ─── LEGACY: HTML parsers (kept for old scans without signals.json) ─────────

function parseSynthese(html) {
  if (!html) return [];
  const block = html.match(new RegExp(`id="(?:synthese|summary)"[\\s\\S]{0,${cfg.SYNTHESE_MATCH_LEN}}`));
  if (!block) return [];
  const rows = block[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const signals = [];
  for (const row of rows) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(c => decodeEntities(stripTags(c)).replace(/,/g, '.').trim());
    if (cells.length < 4) continue;
    const ticker = cells.find(c => cfg.RE_TICKER.test(c.trim()));
    if (!ticker) continue;
    const score = cells.map(c => parseFloat(c)).find(n => n >= cfg.SCORE_RANGE_VALID[0] && n <= cfg.SCORE_RANGE_VALID[1]);
    const stratRaw = cells.find(c => cfg.RE_STRATEGY.test(c)) || '';
    const pf = cells.filter(c => cfg.RE_PRICE_CELL.test(c.trim()));
    const rr = cells.find(c => cfg.RE_RR.test(c)) || '';
    const trAttrs = row.match(/<tr([^>]*)>/i);
    const shariaAttr = trAttrs && trAttrs[1] ? trAttrs[1].match(/data-sharia="(true|false)"/i) : null;
    const sharia = shariaAttr ? shariaAttr[1] === 'true' : null;
    signals.push({
      ticker: ticker.trim(), score: score || 0, strategy: stratRaw.trim(),
      entry: pf[0] || null, stop: pf[1] || null, tp1: pf[2] || null, tp2: pf[3] || null,
      rr, sharia,
    });
  }
  return signals;
}

function parseSetupCards(html) {
  if (!html) return [];
  const re = /class="setup-card"\s+id="setup-([A-Z]{1,5})"([^>]*)>/gi;
  const signals = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const ticker = m[1];
    const attrs = m[2];
    const pick = re2 => { const match = attrs.match(re2); return match ? parseFloat(match[1]) : null; };
    const entry = pick(/data-entry="([\d.]+)"/);
    const stop = pick(/data-stop="([\d.]+)"/);
    const tp1 = pick(/data-tp1="([\d.]+)"/);
    const tp2 = pick(/data-tp2="([\d.]+)"/);
    if (entry == null || stop == null || tp1 == null) continue;
    const shariaCard = attrs.match(/data-sharia="(true|false)"/i);
    const sharia = shariaCard ? shariaCard[1] === 'true' : null;
    signals.push({ ticker, score: 85, strategy: '', entry, stop, tp1, tp2, rr: '', sharia });
  }
  return signals;
}

function parseScannerHtml(html) {
  // Prefer setup-cards (data-* attributes are unambiguous).
  // Fall back to synthese table only when no cards present (very old scans).
  // Merge: cards give clean entry/stop/tp1/tp2/sharia; synthese fills score+strategy.
  const cards = parseSetupCards(html);
  if (cards.length) {
    const synth = parseSynthese(html);
    const synthMap = {};
    for (const s of synth) synthMap[String(s.ticker).toUpperCase()] = s;
    const merged = cards.map(c => {
      const s = synthMap[c.ticker.toUpperCase()] || {};
      return {
        ...c,
        score: s.score || c.score || 85,
        // Strip trailing " x2"/" X10" multiplier suffix only when it ends the string (word-boundary)
        strategy: (s.strategy || c.strategy || '').replace(/\s+x\d+\b\s*$/i, '').trim(),
        rr: s.rr || c.rr || '',
        sharia: c.sharia != null ? c.sharia : (s.sharia != null ? s.sharia : null),
      };
    });
    return merged.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  return parseSynthese(html).sort((a, b) => (b.score || 0) - (a.score || 0));
}

function parseThesisMap(html) {
  if (!html) return {};
  const map = {};
  const blocks = html.match(/id="setup-([A-Z]{1,5})"[\s\S]*?(?=id="setup-[A-Z]|id="synthese|id="summary|$)/gi) || [];
  for (const block of blocks) {
    const tm = block.match(/id="setup-([A-Z]{1,5})"/i);
    const thM = block.match(/Investment Thesis<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
    if (tm && thM && !map[tm[1]]) {
      let thesis = decodeEntities(stripTags(thM[1])).replace(/\s+/g, ' ').trim();
      if (thesis.length > cfg.THESIS_MAX_LEN) thesis = thesis.slice(0, cfg.THESIS_MAX_LEN - 3).replace(/\s+\S*$/, '') + '…';
      map[tm[1].toUpperCase()] = thesis;
    }
  }
  return map;
}

module.exports = {
  loadSignals,
  parsePrice,
  parseSynthese,
  parseSetupCards,
  scoreToRegime,
  adjustRegimeLabel,
  parseScannerHtml,
  parseThesisMap,
  extractRegimeFromHtml,
  stripTags,
  decodeEntities,
};
