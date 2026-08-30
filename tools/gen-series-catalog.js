#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERIES_ROOT = path.join(ROOT, 'series');
const SOURCE = path.join(ROOT, 'data', 'series.json');
const OUTPUT = path.join(ROOT, 'data', 'series-catalog.json');

function strip(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capture(html, expression) {
  const match = html.match(expression);
  return match ? strip(match[1]) : '';
}

function pageMeta(file, href, fallbackTitle) {
  const html = fs.readFileSync(file, 'utf8');
  const title = capture(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i).split('|')[0].trim()
    || fallbackTitle;
  const seriesTitle = capture(html, /class=["'][^"']*series-title[^"']*["'][^>]*>([\s\S]*?)<\//i);
  return { href, title, seriesTitle };
}

function partNumber(name, html) {
  const direct = name.match(/(?:part|ep)(\d+)/i);
  if (direct) return Number(direct[1]);
  const stated = html.match(/(?:Partie|Part|Épisode|Episode)\s*(\d+)\s*(?:sur|of|\/)/i);
  return stated ? Number(stated[1]) : null;
}

function chaptersFor(slug) {
  const dir = path.join(SERIES_ROOT, slug);
  if (!fs.existsSync(dir)) return [];
  const chapters = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const number = partNumber(entry.name, html);
    if (number == null) continue;
    const href = `/series/${slug}/${entry.name}/`;
    const meta = pageMeta(file, href, `Partie ${number}`);
    chapters.push({ number, href, title: meta.title });
  }
  return chapters.sort((a, b) => a.number - b.number || a.href.localeCompare(b.href));
}

const cards = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const bySlug = new Map();

for (const card of cards) {
  const href = capture(card, /href=["']([^"']+)/i);
  const match = href.match(/^\/series\/([^/]+)(?:\/|$)/);
  if (!match || bySlug.has(match[1])) continue;
  const slug = match[1];
  const title = capture(card, /<h2[^>]*>([\s\S]*?)<\/h2>/i) || slug.replace(/-/g, ' ');
  const description = capture(card, /<p[^>]*>([\s\S]*?)<\/p>/i);
  const lang = capture(card, /data-lang=["']([^"']+)/i) || 'fr';
  const tags = capture(card, /data-tags=["']([^"']*)/i).split(',').map(s => s.trim()).filter(Boolean);
  const chapters = chaptersFor(slug);
  const representative = chapters.find(ch => ch.href === href) || chapters[0];
  let seriesTitle = '';
  if (representative) {
    const file = path.join(ROOT, representative.href.replace(/^\//, ''), 'index.html');
    if (fs.existsSync(file)) seriesTitle = pageMeta(file, representative.href, title).seriesTitle;
  }
  bySlug.set(slug, {
    slug,
    title: seriesTitle || title,
    latestTitle: title,
    description,
    lang,
    tags,
    href: chapters[0] ? chapters[0].href : href,
    chapterCount: chapters.length || 1,
    chapters: chapters.length ? chapters : [{ number: 1, href, title }],
  });
}

const output = {
  schema: 'series-catalog.v1',
  generatedAt: new Date().toISOString(),
  seriesCount: bySlug.size,
  chapterCount: Array.from(bySlug.values()).reduce((sum, item) => sum + item.chapterCount, 0),
  series: Array.from(bySlug.values()),
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`[series-catalog] ${output.seriesCount} séries, ${output.chapterCount} chapitres -> ${path.relative(ROOT, OUTPUT)}`);
