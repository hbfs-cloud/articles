#!/usr/bin/env node
/**
 * gen-rss.js — Generate RSS 2.0 feed (/feed.xml) from data/*.json card indexes.
 *
 * REGEN WORKFLOW
 * --------------
 * Run manually:   node tools/gen-rss.js
 * Run in CI/CD:   Called automatically at the end of each successful publish.
 *
 * TODO: Hook into tools/publish.js — after the git push step, add:
 *   const { execSync } = require('child_process');
 *   execSync('node ' + path.join(__dirname, 'gen-rss.js'), { stdio: 'inherit' });
 *   // Then git add feed.xml && git commit --amend --no-edit && git push
 *
 * SOURCES: data/daily.json, data/weekly.json, data/analyses.json,
 *          data/scanner.json, data/tech.json, data/series.json
 * OUTPUT:  /feed.xml (project root), up to 50 most-recent items.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Channel metadata
// ---------------------------------------------------------------------------
const BASE_URL   = 'https://articles.dailytickers.com';
const FEED_TITLE = 'DailyTickers \u2014 Articles';
const FEED_DESC  = 'Institutional financial analysis: scanner, daily briefings, weekly outlooks, ticker deep-dives.';
const FEED_LANG  = 'en';
const MAX_ITEMS  = 50;

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------
const SOURCES = [
  { file: 'daily.json',    category: 'Daily Briefing'   },
  { file: 'weekly.json',   category: 'Weekly Report'    },
  { file: 'analyses.json', category: 'Ticker Analysis'  },
  { file: 'scanner.json',  category: 'Scanner'          },
  { file: 'tech.json',     category: 'Tech Guide'       },
  { file: 'series.json',   category: 'Series'           },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a human-readable date string from card HTML meta text.
 * Handles French ("14 avril 2026") and English ("April 14, 2026") formats.
 */
function parseDate(text) {
  if (!text) return null;
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[—\u2013\u00b7|]/g, ' ')
    .trim();

  const months = {
    janvier: 0, january: 0, jan: 0,
    fevrier: 1, february: 1, feb: 1,
    mars: 2, march: 2, mar: 2,
    avril: 3, april: 3, apr: 3,
    mai: 4, may: 4,
    juin: 5, june: 5, jun: 5,
    juillet: 6, july: 6, jul: 6,
    aout: 7, august: 7, aug: 7,
    septembre: 8, september: 8, sep: 8, sept: 8,
    octobre: 9, october: 9, oct: 9,
    novembre: 10, november: 10, nov: 10,
    decembre: 11, december: 11, dec: 11,
  };

  for (const [name, idx] of Object.entries(months)) {
    // "14 avril 2026"
    const re1 = new RegExp(`(\\d{1,2})\\s+${name}\\s+(\\d{4})`);
    // "april 14, 2026" or "april 14 2026"
    const re2 = new RegExp(`${name}\\s+(\\d{1,2}),?\\s+(\\d{4})`);
    let m = norm.match(re1);
    if (m) return new Date(parseInt(m[2]), idx, parseInt(m[1]));
    m = norm.match(re2);
    if (m) return new Date(parseInt(m[2]), idx, parseInt(m[1]));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract a single item from a card HTML string
// ---------------------------------------------------------------------------
function parseCard(cardHtml, category) {
  // href — first occurrence
  const hrefMatch = cardHtml.match(/href="([^"]+)"/);
  if (!hrefMatch) return null;
  let href = hrefMatch[1];
  if (!href.startsWith('/')) href = '/' + href;
  // Skip external links
  if (href.startsWith('http')) return null;

  // <h2> title
  const titleMatch = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : 'DailyTickers Article';

  // <p> description — first paragraph
  const descMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const desc = descMatch ? stripHtml(descMatch[1]).substring(0, 500) : title;

  // report-card-meta date
  const metaMatch = cardHtml.match(/report-card-meta[^>]*>([\s\S]*?)<\/div>/i);
  const dateText = metaMatch ? stripHtml(metaMatch[1]) : '';
  const date = parseDate(dateText);

  // data-tags
  const tagsMatch = cardHtml.match(/data-tags="([^"]+)"/);
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [];

  return { title, desc, link: BASE_URL + href, date, dateText, category, tags };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const items = [];
const counts = {};

for (const src of SOURCES) {
  const filePath = path.join(__dirname, '..', 'data', src.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  skip  ${src.file} (not found)`);
    continue;
  }

  let cards;
  try {
    cards = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`  ERROR parsing ${src.file}: ${err.message}`);
    continue;
  }

  if (!Array.isArray(cards)) {
    console.log(`  skip  ${src.file} (not an array)`);
    continue;
  }

  let n = 0;
  for (const cardHtml of cards) {
    if (typeof cardHtml !== 'string') continue;
    const item = parseCard(cardHtml, src.category);
    if (item) { items.push(item); n++; }
  }
  counts[src.file] = n;
  console.log(`  read  ${src.file}: ${n} items`);
}

// Sort by date descending (undated cards go last)
items.sort((a, b) => {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date - a.date;
});

const topItems = items.slice(0, MAX_ITEMS);
const now = new Date().toUTCString();

// ---------------------------------------------------------------------------
// Build RSS XML
// ---------------------------------------------------------------------------
let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${BASE_URL}/</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>${FEED_LANG}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/logo.svg</url>
      <title>${escapeXml(FEED_TITLE)}</title>
      <link>${BASE_URL}/</link>
    </image>
`;

for (const item of topItems) {
  const pubDate = item.date ? item.date.toUTCString() : now;
  // Prefer desc; fall back to title for the CDATA body
  const descContent = item.desc || item.title;

  rss += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description><![CDATA[${descContent}]]></description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(item.category)}</category>
`;
  for (const tag of item.tags.slice(0, 5)) {
    rss += `      <category>${escapeXml(tag)}</category>\n`;
  }
  rss += `    </item>\n`;
}

rss += `  </channel>
</rss>
`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const outPath = path.join(__dirname, '..', 'feed.xml');
fs.writeFileSync(outPath, rss, 'utf8');

const sizeKb = (Buffer.byteLength(rss, 'utf8') / 1024).toFixed(1);

console.log('');
console.log('RSS feed generated:');
console.log(`  Output   : ${outPath}`);
console.log(`  Items    : ${topItems.length} (of ${items.length} total)`);
console.log(`  Size     : ${sizeKb} KB`);
console.log('');
console.log('Items per source:');
for (const [file, count] of Object.entries(counts)) {
  console.log(`  ${file.padEnd(18)} ${count}`);
}
