#!/usr/bin/env node
/**
 * Clean up card HTML in data/*.json files
 * - Reduce icon sizes from 48px to 32px
 * - Reduce icon font sizes from 1.2rem to 0.85rem
 * - Reduce border-radius on icons from 14px to 10px
 * - Remove "NEW" badges
 * - Reduce h3 font-size from 1.15rem to 0.95rem
 * - Remove width:100% from btn-read-primary inline styles
 * - Collapse excessive whitespace/newlines
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const files = ['series.json', 'tech.json'];

files.forEach(file => {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return;
  let raw = fs.readFileSync(fp, 'utf8');

  // Icon container: 48px → 32px
  raw = raw.replace(/width: 48px; height: 48px/g, 'width: 32px; height: 32px');
  // Border radius on icon: 14px → 10px
  raw = raw.replace(/border-radius: 14px; background: linear-gradient/g, 'border-radius: 8px; background: linear-gradient');
  // Icon font size: 1.2rem → 0.85rem
  raw = raw.replace(/font-size: 1\.2rem/g, 'font-size: 0.85rem');
  // h3 font-size: 1.15rem → 0.9rem
  raw = raw.replace(/font-size: 1\.15rem/g, 'font-size: 0.9rem');
  // Remove NEW badges
  raw = raw.replace(/<span class=\\"badge\\"[^>]*>NEW<\/span>/g, '');
  // Remove width: 100% from btn-read-primary
  raw = raw.replace(/ width: 100%/g, '');
  // Collapse margin-bottom: 0.75rem on badge containers to 0.4rem
  raw = raw.replace(/margin-bottom: 0\.75rem/g, 'margin-bottom: 0.4rem');
  // Gap in header: 0.75rem → 0.5rem
  raw = raw.replace(/gap: 0\.75rem; margin-bottom: 0\.5rem/g, 'gap: 0.5rem; margin-bottom: 0.35rem');

  fs.writeFileSync(fp, raw);
  console.log(`Cleaned ${file}`);
});

// Also clean ALL json files for remaining whitespace issues
['weekly.json', 'daily.json', 'analyses.json', 'scanner.json', 'series.json', 'tech.json'].forEach(file => {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return;
  let raw = fs.readFileSync(fp, 'utf8');
  const before = raw.length;

  // Collapse runs of whitespace (spaces+newlines) inside card HTML to single space
  // But keep the JSON structure intact
  let cards = JSON.parse(raw);
  cards = cards.map(html => {
    // Collapse multiple whitespace chars to single space (but not inside attribute values)
    return html
      .replace(/\n\s*\n/g, '\n')           // double newlines → single
      .replace(/\n\s{6,}/g, '\n    ')       // excessive indentation
      .replace(/>\s*\n\s*</g, '><')         // remove whitespace between tags
      .replace(/>\s{2,}/g, '> ')            // collapse spaces after >
      .replace(/\s{2,}</g, ' <')            // collapse spaces before <
      .trim();
  });

  const out = JSON.stringify(cards, null, 2);
  fs.writeFileSync(fp, out);
  const after = out.length;
  console.log(`${file}: ${before} → ${after} bytes (${before - after > 0 ? '-' : '+'}${Math.abs(before - after)})`);
});
