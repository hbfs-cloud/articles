#!/usr/bin/env node
'use strict';

/**
 * validate-article.js — pre-publish content gate for all article types
 *
 * Checks structural integrity, placeholder text, required elements.
 * Exits 0 on pass, 1 on fail with descriptive errors.
 *
 * Usage:
 *   node tools/validate-article.js <path> [--type <type>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

const filePath = process.argv[2];
const type = getArg('--type');

if (!filePath) {
  console.error('Usage: node tools/validate-article.js <path/to/index.html> [--type daily|scanner|analysis|...]');
  process.exit(1);
}

const absPath = path.resolve(ROOT, filePath);
if (!fs.existsSync(absPath)) {
  console.error(`FAIL: File not found: ${absPath}`);
  process.exit(1);
}

const html = fs.readFileSync(absPath, 'utf8');
const sizeKB = Buffer.byteLength(html, 'utf8') / 1024;
const errors = [];

// 1. File size
if (sizeKB < 10) {
  errors.push(`File too small: ${sizeKB.toFixed(1)} KB (min 10 KB)`);
}

// 2. Required structural elements
if (!html.includes('brand-bar')) {
  errors.push('Missing brand-bar navigation');
}
if (!html.includes('article-footer')) {
  errors.push('Missing article-footer');
}
if (!html.includes('GTM-T5Z595CW')) {
  errors.push('Missing GTM tag (GTM-T5Z595CW)');
}

// 3. Placeholder / template text
const PLACEHOLDERS = [
  { pattern: /\{\{[^}]*\}\}/g, label: 'template variable {{...}}' },
  { pattern: /\bTODO\b/gi, label: 'TODO' },
  { pattern: /\bPLACEHOLDER\b/gi, label: 'PLACEHOLDER' },
  { pattern: /Lorem ipsum/gi, label: 'Lorem ipsum' },
];

for (const { pattern, label } of PLACEHOLDERS) {
  const matches = html.match(pattern);
  if (matches) {
    errors.push(`Found ${label}: "${matches[0]}" (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
  }
}

// Check for suspicious NaN/undefined in data contexts (not in script blocks or attributes)
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
const bodyText = bodyMatch ? bodyMatch[1] : html;
const textOnly = bodyText.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

const nanMatches = textOnly.match(/\bNaN\b/g);
if (nanMatches && nanMatches.length > 0) {
  errors.push(`Found NaN in article text (${nanMatches.length} occurrence${nanMatches.length > 1 ? 's' : ''})`);
}
const undefMatches = textOnly.match(/\bundefined\b/g);
if (undefMatches && undefMatches.length > 0) {
  errors.push(`Found "undefined" in article text (${undefMatches.length} occurrence${undefMatches.length > 1 ? 's' : ''})`);
}

// 4. Minimum section count
const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
if (h2Count < 3) {
  errors.push(`Too few sections: ${h2Count} h2 elements (min 3)`);
}

// 5. Type-specific checks
const inferredType = type || (filePath.includes('daily/') ? 'daily'
  : filePath.includes('scanner/') ? 'scanner'
  : filePath.includes('analyses/') ? 'analysis'
  : filePath.includes('weekly/') ? 'weekly'
  : null);

if (inferredType === 'daily' || inferredType === 'scanner') {
  if (!html.includes('data-tab=')) {
    errors.push(`Missing data-tab attribute on <html> (required for ${inferredType})`);
  }
}

if (inferredType === 'analysis') {
  if (!html.includes('ticker-header')) {
    errors.push('Missing ticker-header section (required for analysis)');
  }
}

// 6. Report
if (errors.length > 0) {
  console.error(`\n❌ VALIDATION FAILED — ${errors.length} issue${errors.length > 1 ? 's' : ''}:\n`);
  for (const e of errors) {
    console.error(`  • ${e}`);
  }
  console.error(`\n  File: ${filePath} (${sizeKB.toFixed(1)} KB, ${h2Count} sections)\n`);
  process.exit(1);
} else {
  console.log(`  ✅ Validation passed (${sizeKB.toFixed(1)} KB, ${h2Count} sections)`);
  process.exit(0);
}
