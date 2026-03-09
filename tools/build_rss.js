#!/usr/bin/env node
/**
 * build_rss.js — Generate RSS 2.0 feed from data/*.json card files.
 * Outputs feed.xml at project root.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://articles.market-watch.xyz';
const FEED_TITLE = 'Market Watch — Financial Intelligence';
const FEED_DESC = 'Daily briefings, weekly reports, ticker analyses, and scanner picks. Institutional-grade financial research powered by AI.';
const MAX_ITEMS = 50;

const SOURCES = [
  { file: 'daily.json', category: 'Daily Briefing' },
  { file: 'weekly.json', category: 'Weekly Report' },
  { file: 'analyses.json', category: 'Ticker Analysis' },
  { file: 'scanner.json', category: 'Scanner' },
  { file: 'tech.json', category: 'Tech Guide' },
  { file: 'series.json', category: 'Series' },
];

// Parse date from card HTML meta text
function parseDate(text) {
  if (!text) return null;
  const norm = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–·•\|]/g, ' ')
    .trim();

  const months = {
    janvier: 0, january: 0, jan: 0,
    fevrier: 1, february: 1, feb: 1, février: 1,
    mars: 2, march: 2, mar: 2,
    avril: 3, april: 3, apr: 3,
    mai: 4, may: 4,
    juin: 5, june: 5, jun: 5,
    juillet: 6, july: 6, jul: 6,
    aout: 7, august: 7, aug: 7, août: 7,
    septembre: 8, september: 8, sep: 8, sept: 8,
    octobre: 9, october: 9, oct: 9,
    novembre: 10, november: 10, nov: 10,
    decembre: 11, december: 11, dec: 11, décembre: 11,
  };

  // Try "DD month YYYY" or "month DD, YYYY"
  for (const [name, idx] of Object.entries(months)) {
    const re1 = new RegExp(`(\\d{1,2})\\s+${name}\\s+(\\d{4})`);
    const re2 = new RegExp(`${name}\\s+(\\d{1,2}),?\\s+(\\d{4})`);
    let m = norm.match(re1);
    if (m) return new Date(parseInt(m[2]), idx, parseInt(m[1]));
    m = norm.match(re2);
    if (m) return new Date(parseInt(m[2]), idx, parseInt(m[1]));
  }
  return null;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

const items = [];

for (const src of SOURCES) {
  const filePath = path.join(__dirname, '..', 'data', src.file);
  if (!fs.existsSync(filePath)) continue;

  let cards;
  try {
    cards = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { continue; }

  for (const cardHtml of cards) {
    // Extract href
    const hrefMatch = cardHtml.match(/href="([^"]+)"/);
    if (!hrefMatch) continue;
    let href = hrefMatch[1];
    if (!href.startsWith('/')) href = '/' + href;

    // Extract title
    const titleMatch = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const title = titleMatch ? stripHtml(titleMatch[1]) : 'Market Watch Article';

    // Extract description
    const descMatch = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const desc = descMatch ? stripHtml(descMatch[1]).substring(0, 500) : '';

    // Extract date
    const metaMatch = cardHtml.match(/report-card-meta[^>]*>([\s\S]*?)<\/div>/);
    const dateText = metaMatch ? stripHtml(metaMatch[1]) : '';
    const date = parseDate(dateText);

    // Extract tags
    const tagsMatch = cardHtml.match(/data-tags="([^"]+)"/);
    const tags = tagsMatch ? tagsMatch[1].split(',') : [];

    items.push({
      title,
      desc,
      link: BASE_URL + href,
      date,
      dateText,
      category: src.category,
      tags,
    });
  }
}

// Sort by date descending
items.sort((a, b) => {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date - a.date;
});

// Take top N
const topItems = items.slice(0, MAX_ITEMS);

// Build RSS XML
const now = new Date().toUTCString();
let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${BASE_URL}/</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>en</language>
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
  rss += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.desc)}</description>
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

const outPath = path.join(__dirname, '..', 'feed.xml');
fs.writeFileSync(outPath, rss);
console.log(`Generated feed.xml with ${topItems.length} items`);
