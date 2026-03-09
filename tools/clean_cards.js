#!/usr/bin/env node
/**
 * Clean up card HTML in data/*.json files
 * - Reduce icon sizes from 48px to 32px
 * - Reduce border-radius on icons from 14px to 8px
 * - Reduce gap/margin in icon headers
 * - Remove inline tag badges (custom styled spans with inline CSS)
 * - Collapse excessive whitespace/newlines
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Process ALL json files — parse cards, clean HTML, re-serialize
['weekly.json', 'daily.json', 'analyses.json', 'scanner.json', 'series.json', 'tech.json'].forEach(file => {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return;
  let raw = fs.readFileSync(fp, 'utf8');
  const before = raw.length;

  let cards = JSON.parse(raw);
  cards = cards.map(html => {
    // Icon container: 48px → 32px (handles newlines in style attrs)
    html = html.replace(/width:\s*48px;\s*height:\s*48px/g, 'width: 32px; height: 32px');
    // Border radius on icon container: 14px → 8px
    html = html.replace(/border-radius:\s*14px;\s*background:\s*linear-gradient/g, 'border-radius: 8px; background: linear-gradient');
    // Icon font size: 1.2rem → 0.85rem
    html = html.replace(/font-size:\s*1\.2rem/g, 'font-size: 0.85rem');
    // h3 font-size: 1.15rem → 0.9rem
    html = html.replace(/font-size:\s*1\.15rem/g, 'font-size: 0.9rem');
    // Collapse gap: 0.75rem in icon header to 0.5rem
    html = html.replace(/gap:\s*0\.75rem;\s*margin-bottom:\s*0\.5rem/g, 'gap: 0.5rem; margin-bottom: 0.35rem');
    // Collapse margin-bottom: 0.75rem → 0.4rem
    html = html.replace(/margin-bottom:\s*0\.75rem/g, 'margin-bottom: 0.4rem');
    // Collapse margin-bottom: 1rem on inline badge containers → 0.4rem
    html = html.replace(/margin-bottom:\s*1rem/g, 'margin-bottom: 0.4rem');
    // Remove width: 100% from btn-read-primary
    html = html.replace(/ width:\s*100%/g, '');

    // Collapse whitespace
    html = html
      .replace(/\n\s*\n/g, '\n')
      .replace(/\n\s{6,}/g, '\n    ')
      .replace(/>\s*\n\s*</g, '><')
      .replace(/>\s{2,}/g, '> ')
      .replace(/\s{2,}</g, ' <')
      .trim();

    return html;
  });

  const out = JSON.stringify(cards, null, 2);
  fs.writeFileSync(fp, out);
  const after = out.length;
  const diff = before - after;
  console.log(`${file}: ${before} → ${after} bytes (${diff > 0 ? '-' : '+'}${Math.abs(diff)})`);
});
