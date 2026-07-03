#!/usr/bin/env node
'use strict';
/*
 * check-ai-tells.js — flag "obviously AI-written" tells in an article.
 * Editorial voice rule (site-wide): concis, direct, actionnable, PAS de style IA.
 * Usage:
 *   node tools/check-ai-tells.js <path.html|path.md>[ ...more]   # advisory, exit 0
 *   node tools/check-ai-tells.js --strict <path>                 # exit 1 if any hard tell
 * Scans visible prose (HTML tags/scripts/styles stripped). Advisory by default —
 * it flags smells, it does not rewrite. Zero findings != guaranteed human, but any
 * finding means: rewrite that bit before publishing.
 */
const fs = require('fs');

const STRICT = process.argv.includes('--strict');
const files = process.argv.slice(2).filter(a => a !== '--strict');

// Signposting / marketing clichés that scream "LLM newsletter". Case-insensitive.
const PHRASES = [
  "hold one idea", "here's the thing", "here's the deal", "let's dive in", "dive into",
  "buckle up", "make no mistake", "at the end of the day", "the bottom line", "bottom line:",
  "in conclusion", "it's worth noting", "it's important to note", "needless to say",
  "the reality is", "one thing is clear", "that's the whole story", "the whole story",
  "that divergence is the whole story", "when it comes to", "in today's fast-paced",
  "in a world where", "ever-evolving", "ever-changing", "game-changer", "game changer",
  "testament to", "tapestry", "navigating the", "unlock the", "elevate your", "seamless",
  "look no further", "rest assured", "the key takeaway", "without further ado",
  // FR equivalents
  "il est important de noter", "il convient de noter", "en conclusion", "cela dit",
  "force est de constater", "dans un monde", "sans plus attendre", "la clé réside",
];
// Formal connectors LLMs overuse — warn if they pile up.
const CONNECTORS = ["moreover", "furthermore", "additionally", "consequently", "notably", "par ailleurs", "de plus", "en outre"];

function stripToProse(raw, isHtml) {
  if (!isHtml) return raw;
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

let hadHard = false;
for (const file of files) {
  if (!fs.existsSync(file)) { console.error(`  ⚠️  not found: ${file}`); continue; }
  const raw = fs.readFileSync(file, 'utf8');
  const isHtml = /\.html?$/i.test(file);
  const prose = stripToProse(raw, isHtml);
  const lower = prose.toLowerCase();
  const words = (prose.match(/\S+/g) || []).length;

  const hits = [];
  for (const p of PHRASES) {
    let i = 0, n = 0;
    while ((i = lower.indexOf(p, i)) !== -1) { n++; i += p.length; }
    if (n) hits.push(`phrase "${p}" ×${n}`);
  }
  let connTotal = 0;
  for (const c of CONNECTORS) { const m = lower.split(c).length - 1; connTotal += m; }
  const emDashes = (prose.match(/—/g) || []).length;
  const emPer500 = words ? (emDashes / words * 500) : 0;

  const soft = [];
  if (connTotal > 2) soft.push(`${connTotal} formal connectors (moreover/furthermore/…) — LLM cadence, prefer plain sentences`);
  if (emPer500 > 6) soft.push(`${emDashes} em-dashes for ${words} words (${emPer500.toFixed(1)}/500) — em-dash overload, vary punctuation`);

  console.log(`\n${file}  [${words} words]`);
  if (!hits.length && !soft.length) { console.log('  ✅ no obvious AI tells'); continue; }
  for (const h of hits) { console.log(`  ❌ ${h}`); hadHard = true; }
  for (const s of soft) console.log(`  ⚠️  ${s}`);
}

if (STRICT && hadHard) {
  console.log('\n⛔ AI-tell phrases found — rewrite before publishing (voix: concis, direct, actionnable, humain).');
  process.exit(1);
}
