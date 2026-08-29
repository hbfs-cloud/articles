#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const target = process.argv[2];
if (!target) {
  console.error('Usage: merge-agent-job-pages.js <source.json>');
  process.exit(2);
}
const abs = path.resolve(target);
let raw = '';
let handled = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  raw += chunk;
  if (!handled && raw.endsWith('\n')) {
    process.stdin.pause();
    finish();
  }
});
process.stdin.on('end', finish);

function finish() {
  if (handled) return;
  handled = true;
  try {
    const first = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const pages = JSON.parse(raw);
    if (!Array.isArray(first.data?.items) || !Array.isArray(pages) || !pages.length) {
      throw new Error('pages ou data.items absents');
    }
    const merged = { ...first, data: { ...first.data, items: [...first.data.items] } };
    let pagination = first.pagination;
    for (const page of pages) {
      if (!Array.isArray(page.data?.items)) throw new Error('page sans data.items');
      merged.data.items.push(...page.data.items);
      pagination = page.pagination || page.data.pagination || { has_next: false };
    }
    if (pagination?.has_next === true) throw new Error('dernière page non épuisée');
    merged.pagination = { ...pagination, has_next: false, pages_fetched: pages.length + 1, exhausted: true };
    const body = JSON.stringify(merged, null, 2);
    fs.writeFileSync(abs, body);

    const dir = path.dirname(abs);
    const alias = path.basename(abs, '.json');
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    for (const name of ['harness.json', '_collect.json']) {
      const p = path.join(dir, name);
      const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (name === 'harness.json') {
        const source = doc.sources.find(s => s.name === alias);
        if (!source) throw new Error(`source ${alias} absente du harness`);
        source.sha256 = hash;
      } else {
        const call = doc.waves.flatMap(w => w.calls || []).find(c => c.as === alias);
        if (!call) throw new Error(`appel ${alias} absent du journal`);
        call.output_sha256 = hash;
      }
      fs.writeFileSync(p, JSON.stringify(doc, null, 2));
    }
    console.log(`[merge-agent-job-pages] ${alias}: ${merged.data.items.length} item(s), pagination épuisée`);
  } catch (error) {
    console.error(`[merge-agent-job-pages] ${error.message}`);
    process.exit(1);
  }
}
