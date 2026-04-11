/**
 * tools/lib/scanner-parser.js — Shared scanner HTML parser.
 *
 * Before this module existed, sweep.js, update-tracking.js and gen-status-page.js
 * each had their own (slightly divergent) copy of the synthese-table parser.
 * Any schema change required three edits — easy to miss one.
 *
 * This module exposes:
 *   parseSynthese(html)     → raw signals from the <section id="synthese"> table
 *   parseSetupCards(html)   → fallback parser that reads data-* attributes
 *   parseScannerHtml(html)  → tries synthese first, falls back to setup cards
 *   parseThesisMap(html)    → { TICKER: "short thesis..." } from investment thesis <p>
 *
 * All functions are pure (no fs access). Callers pass the raw HTML string.
 */
'use strict';

const cfg = require('../config');

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

/**
 * Parse the synthese table into an array of raw signal objects.
 * Each signal: { ticker, score, strategy, entry, stop, tp1, tp2, rr }
 */
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
    const score = cells
      .map(c => parseFloat(c))
      .find(n => n >= cfg.SCORE_RANGE_VALID[0] && n <= cfg.SCORE_RANGE_VALID[1]);
    const stratRaw = cells.find(c => cfg.RE_STRATEGY.test(c)) || '';
    const pf = cells.filter(c => cfg.RE_PRICE_CELL.test(c.trim()));
    const rr = cells.find(c => cfg.RE_RR.test(c)) || '';
    signals.push({
      ticker: ticker.trim(),
      score: score || 0,
      strategy: stratRaw.trim(),
      entry: pf[0] || '—',
      stop: pf[1] || '—',
      tp1: pf[2] || '—',
      tp2: pf[3] || '—',
      rr,
    });
  }
  return signals;
}

/**
 * Fallback parser — reads `<div class="setup-card" id="setup-TICKER" data-entry=".." ...>`
 * Useful when the synthese table shape changes but data-* attributes remain stable.
 */
function parseSetupCards(html) {
  if (!html) return [];
  const re = /class="setup-card"\s+id="setup-([A-Z]{1,5})"([^>]*)>/gi;
  const signals = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const ticker = m[1];
    const attrs = m[2];
    const pick = re2 => {
      const match = attrs.match(re2);
      return match ? parseFloat(match[1]) : null;
    };
    const entry = pick(/data-entry="([\d.]+)"/);
    const stop = pick(/data-stop="([\d.]+)"/);
    const tp1 = pick(/data-tp1="([\d.]+)"/);
    const tp2 = pick(/data-tp2="([\d.]+)"/);
    if (entry == null || stop == null || tp1 == null) continue;
    signals.push({
      ticker,
      score: 85,
      strategy: '',
      entry: `$${entry}`,
      stop: `$${stop}`,
      tp1: `$${tp1}`,
      tp2: tp2 != null ? `$${tp2}` : '—',
      rr: '',
    });
  }
  return signals;
}

/**
 * Canonical entry point — tries the synthese table first, falls back to setup cards.
 * Returns signals sorted by score descending.
 */
function parseScannerHtml(html) {
  let signals = parseSynthese(html);
  if (!signals.length) signals = parseSetupCards(html);
  return signals.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Build a { TICKER: "thesis..." } map from the "Investment Thesis" paragraph.
 * Clipped to THESIS_MAX_LEN.
 */
function parseThesisMap(html) {
  if (!html) return {};
  const map = {};
  const blocks = html.match(/id="setup-([A-Z]{1,5})"[\s\S]*?(?=id="setup-[A-Z]|id="synthese|id="summary|$)/gi) || [];
  for (const block of blocks) {
    const tm = block.match(/id="setup-([A-Z]{1,5})"/i);
    const thM = block.match(/Investment Thesis<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
    if (tm && thM && !map[tm[1]]) {
      let thesis = decodeEntities(stripTags(thM[1])).replace(/\s+/g, ' ').trim();
      if (thesis.length > cfg.THESIS_MAX_LEN) {
        thesis = thesis.slice(0, cfg.THESIS_MAX_LEN - 3).replace(/\s+\S*$/, '') + '…';
      }
      map[tm[1].toUpperCase()] = thesis;
    }
  }
  return map;
}

module.exports = {
  parseSynthese,
  parseSetupCards,
  parseScannerHtml,
  parseThesisMap,
  stripTags,
  decodeEntities,
};
