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
const documents = [];

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
  // forced explainer openers / LLM transitions (reader-flagged)
  "one more thing", "here's what", "here's how", "here's the part", "here's the map",
  "picture this", "imagine you", "think of it like", "let me explain", "in other words",
  "simply put", "to put it simply", "the takeaway", "picture musical",
  // aphoristic "closer" flourishes (newsletter-LLM signature)
  "told you nothing", "told you everything", "tells you everything", "says it all",
  "that's the tell", "a scratch on", "and passports",
  // reflexive inline definitions (LLM explains basic terms every time)
  "a call option is", "a put option is", "a call is a bet", "a put is a bet",
  "which is a bet that", "is a bet that a price",
  // internal/infra terms that must never reach readers
  "dailytickers mcp", "dailytickers gateway", "via gateway", "mcp market data", "market data service",
  "git objects", "repository-local chronology", "repository-local timestamp",
  // FR equivalents
  "il est important de noter", "il convient de noter", "en conclusion", "cela dit",
  "force est de constater", "dans un monde", "sans plus attendre", "la clé réside",
];
// Formal connectors LLMs overuse — warn if they pile up.
const CONNECTORS = ["moreover", "furthermore", "additionally", "consequently", "notably", "par ailleurs", "de plus", "en outre"];

function stripToProse(raw, isHtml) {
  if (!isHtml) {
    return raw
      .replace(/\]\(https?:\/\/[^)]+\)/gi, ']')
      .replace(/https?:\/\/\S+/gi, ' ');
  }
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

let hadHard = false;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`  ❌ not found: ${file}`);
    if (STRICT) hadHard = true;
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const isHtml = /\.html?$/i.test(file);
  const prose = stripToProse(raw, isHtml);
  // Preserve the anti-cliche rule without flagging Tapestry, Inc. as its company name.
  const phraseProse = prose.replace(/\bTapestry(?=\s*(?:\(|,\s*Inc\.?))/g, 'IssuerName');
  const lower = phraseProse.toLowerCase();
  const words = (prose.match(/\S+/g) || []).length;
  const title = isHtml
    ? (raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : (raw.match(/^title:\s*"([^"]+)"/m)?.[1] || '');
  const headings = isHtml
    ? []
    : [...raw.matchAll(/^\*\*([^*\n]{2,80})\*\*\s*$/gm)].map(match => match[1].trim());
  const sentences = prose
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.replace(/\s+/g, ' ').trim())
    .filter(sentence => sentence.length >= 70 &&
      !/Educational, not investment advice|No named issuer sponsored|Sources?:/i.test(sentence));
  let structure = null;
  if (!isHtml) {
    const lines = raw.split(/\r?\n/);
    const worked = lines.findIndex(line => /\b(?:worked|suppose|consider a hypothetical|hypothetical chronology)\b/i.test(line));
    const action = lines.findIndex(line => /^\*\*[^*]+\*\*\s*$|\b(?:checklist|check|record|procedure|controls|rules):?\s*$/i.test(line.trim()));
    const limitation = lines.findIndex(line => /^(?:\*\*)?(?:limitation|boundary|the limitation|this method has a clear limit|no short event history)/i.test(line.trim()));
    const sources = lines.findIndex(line => /^Sources?:/i.test(line.trim()));
    if ([worked, action, limitation, sources].every(index => index >= 0)) structure = `${worked + 1}/${action + 1}/${limitation + 1}/${sources + 1}`;
  }
  documents.push({ file, title, headings, sentences, structure, module: file.replace(/\\/g, '/').split('/').slice(0, -1).join('/') });

  const hits = [];
  for (const p of PHRASES) {
    let i = 0, n = 0;
    while ((i = lower.indexOf(p, i)) !== -1) { n++; i += p.length; }
    if (n) hits.push(`phrase "${p}" ×${n}`);
  }
  // Un connecteur de cadence est en TÊTE de proposition. Compter la chaîne nue produisait des
  // faux positifs sur des tournures parfaitement françaises : « cassure de plus-hauts », « une
  // ligne de plus sans que… », « ne lui accorde plus que trois séances » — trois occurrences
  // signalées le 2026-09-06 sur une page qui n'employait aucun connecteur. On exige donc un
  // début de phrase ou de proposition (après un point, un point-virgule, un deux-points, un
  // tiret cadratin ou une ouverture de balise) et une frontière de mot en fin.
  let connTotal = 0;
  for (const c of CONNECTORS) {
    const re = new RegExp(`(^|[.;:!?—]\\s+|>\\s*)${c.replace(/ /g, '\\s+')}\\b`, 'gi');
    connTotal += (prose.match(re) || []).length;
  }
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

if (documents.length >= 6) {
  const crossHits = [];
  const antithetical = documents.filter(document => /(?:,|\bis|\bdoes)\s+not\b|\bnot just\b/i.test(document.title));
  if (antithetical.length >= 6 && antithetical.length / documents.length > 0.25) {
    crossHits.push(`${antithetical.length}/${documents.length} titles use the same antithetical X-not-Y construction`);
  }

  const headingUses = new Map();
  const sentenceUses = new Map();
  const structureUses = new Map();
  for (const document of documents) {
    for (const heading of document.headings) headingUses.set(heading, (headingUses.get(heading) || []).concat(document.file));
    for (const sentence of document.sentences) sentenceUses.set(sentence, (sentenceUses.get(sentence) || []).concat(document.file));
    if (document.structure) {
      const key = `${document.module}:${document.structure}`;
      structureUses.set(key, (structureUses.get(key) || []).concat(document.file));
    }
  }
  for (const [heading, uses] of headingUses) {
    if (new Set(uses).size >= 4) crossHits.push(`heading "${heading}" repeats in ${new Set(uses).size} files`);
  }
  for (const [sentence, uses] of sentenceUses) {
    if (new Set(uses).size >= 2) crossHits.push(`exact sentence repeats in ${new Set(uses).size} files: "${sentence.slice(0, 120)}"`);
  }
  for (const [signature, uses] of structureUses) {
    if (new Set(uses).size >= 4) crossHits.push(`module structure ${signature} repeats in ${new Set(uses).size} files`);
  }
  if (crossHits.length) {
    console.log('\nCross-file AI-forensics');
    for (const hit of crossHits) console.log(`  ❌ ${hit}`);
    hadHard = true;
  }
}

if (STRICT && hadHard) {
  console.log('\n⛔ AI-tell phrases found — rewrite before publishing (voix: concis, direct, actionnable, humain).');
  process.exit(1);
}
