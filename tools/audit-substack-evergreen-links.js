#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const programRoot = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const outputPath = path.join(repoRoot, program.evidence.source_link_audit_path);
const write = process.argv.includes('--write');

function sourceUrls() {
  const urls = new Set();
  for (const module of program.modules) {
    for (const name of fs.readdirSync(path.join(repoRoot, module.target_dir)).filter(file => /^episode-\d+\.md$/.test(file))) {
      const body = fs.readFileSync(path.join(repoRoot, module.target_dir, name), 'utf8');
      const marker = body.search(/^Sources?:/im);
      if (marker < 0) continue;
      for (const match of body.slice(marker).matchAll(/https?:\/\/[^\s)>]+/g)) urls.add(match[0].replace(/[.,;]+$/, ''));
    }
  }
  return [...urls].sort();
}

async function probe(url) {
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'DailyTickers-QA/1.0' }
    });
    if ([404, 405, 501].includes(response.status)) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': 'DailyTickers-QA/1.0', range: 'bytes=0-1024' }
      });
    }
    const classification = response.status >= 200 && response.status < 400
      ? 'reachable'
      : [401, 403, 429].includes(response.status)
        ? 'official_access_restricted'
        : [404, 410].includes(response.status)
          ? 'dead'
          : 'http_error';
    return { url, status: response.status, final_url: response.url, classification };
  } catch (error) {
    return { url, status: null, final_url: null, classification: 'network_error', error: `${error.name}: ${error.message}` };
  }
}

(async () => {
  const urls = sourceUrls();
  const links = new Array(urls.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= urls.length) return;
      links[index] = await probe(urls[index]);
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  const count = classification => links.filter(link => link.classification === classification).length;
  const audit = {
    schema_version: 'substack-source-link-audit.v2',
    program_id: program.program_id,
    checked_at: new Date().toISOString(),
    method: 'HTTP HEAD with redirect following; GET range fallback for HEAD 404, 405 or 501; 12 second timeout; ten concurrent workers',
    url_set_sha256: crypto.createHash('sha256').update(`${urls.join('\n')}\n`).digest('hex'),
    summary: {
      unique_links: links.length,
      reachable_2xx_3xx: count('reachable'),
      official_rate_limited_or_bot_blocked: count('official_access_restricted'),
      dead_404_410: count('dead'),
      network_errors: count('network_error'),
      other_http_errors: count('http_error')
    },
    links
  };
  if (write) fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ output: write ? path.relative(repoRoot, outputPath) : null, ...audit.summary }, null, 2));
  if (audit.summary.dead_404_410 || audit.summary.network_errors || audit.summary.other_http_errors) process.exit(1);
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
