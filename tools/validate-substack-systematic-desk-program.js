#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const programRoot = path.join(root, 'data', 'substack', 'programs', 'retail-systematic-desk');
const seriesRoot = path.join(root, 'data', 'substack', 'series', 'retail-systematic-desk');
const draftsRoot = path.join(root, 'data', 'substack-drafts', 'retail-systematic-desk');
const program = JSON.parse(fs.readFileSync(path.join(programRoot, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(programRoot, 'calendar.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(seriesRoot, 'manifest.json'), 'utf8'));
const errors = [];
const fail = message => errors.push(message);

function parseArticle(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { metadata: null, body: raw, raw };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { metadata[key] = JSON.parse(value); }
    catch { metadata[key] = value; }
  }
  return { metadata, body: raw.slice(match[0].length).trim(), raw };
}

function words(body) {
  return body.replace(/https?:\/\/\S+/g, ' ').replace(/[`*_>#\[\]()|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function localParts(timestamp) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: program.schedule.timezone,
    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
}

if (program.program_id !== 'retail-systematic-desk') fail('program id mismatch');
if (program.episode_count !== 45 || calendar.episode_count !== 45 || manifest.episodes?.length !== 45) fail('expected exactly 45 episodes');
if (program.schedule.weekday !== 'Friday' || program.schedule.frequency !== 'weekly') fail('cadence must be weekly Friday');
if (program.schedule.send_email !== false || program.schedule.email_audience !== null) fail('program email must be disabled');
if (program.remote_contract.send_email !== false || program.remote_contract.email_audience !== null) fail('remote email must be disabled');
if (manifest.delivery.send_email !== false || manifest.delivery.email_audience !== null) fail('manifest email must be disabled');
if (program.confidentiality_contract?.forbidden?.length < 8) fail('confidentiality boundary is incomplete');
if (manifest.rollout?.phase !== 'held-for-review' || manifest.rollout?.authorized_episode_count !== 0) fail('generated rollout must remain held for review');
if (manifest.rollout?.held_as_drafts?.length !== 45) fail('all generated episodes must be held before authorization');

const titles = new Set();
const schedules = new Set();
for (let index = 0; index < calendar.slots.length; index += 1) {
  const slot = calendar.slots[index];
  const expectedNumber = index + 1;
  if (slot.week !== expectedNumber) fail(`week ${expectedNumber}: sequence mismatch`);
  if (slot.remote_status !== 'held_for_review') fail(`week ${expectedNumber}: generated slot bypasses review hold`);
  if (slot.send_email !== false || slot.email_audience !== null) fail(`week ${expectedNumber}: email is not disabled`);
  if (titles.has(slot.title)) fail(`week ${expectedNumber}: duplicate title`);
  if (schedules.has(slot.scheduled_at)) fail(`week ${expectedNumber}: duplicate schedule`);
  titles.add(slot.title);
  schedules.add(slot.scheduled_at);
  const parts = localParts(slot.scheduled_at);
  if (parts.weekday !== 'Friday' || `${parts.hour}:${parts.minute}` !== '08:00') fail(`week ${expectedNumber}: not Friday 08:00 ET`);
  if (index > 0) {
    const delta = Date.parse(slot.local_date) - Date.parse(calendar.slots[index - 1].local_date);
    if (delta !== 7 * 24 * 60 * 60 * 1000) fail(`week ${expectedNumber}: local calendar gap`);
  }

  const articleFile = path.join(root, slot.target_file);
  const payloadFile = path.join(root, slot.payload_file);
  if (!fs.existsSync(articleFile)) { fail(`week ${expectedNumber}: article missing`); continue; }
  if (!fs.existsSync(payloadFile)) { fail(`week ${expectedNumber}: payload missing`); continue; }
  const article = parseArticle(articleFile);
  const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
  if (!article.metadata) { fail(`week ${expectedNumber}: front matter missing`); continue; }
  if (article.metadata.title !== slot.title || article.metadata.subtitle !== slot.subtitle) fail(`week ${expectedNumber}: metadata mismatch`);
  if (article.metadata.send_email !== false) fail(`week ${expectedNumber}: article email flag mismatch`);
  if (Date.parse(article.metadata.scheduled_at) !== Date.parse(slot.scheduled_at)) fail(`week ${expectedNumber}: article schedule mismatch`);
  if (payload.title !== slot.title || payload.subtitle !== slot.subtitle || payload.body_markdown !== article.body) fail(`week ${expectedNumber}: payload content mismatch`);
  if (payload.send_email !== false || payload.email_audience !== null || payload.post_audience !== 'everyone') fail(`week ${expectedNumber}: payload delivery mismatch`);
  if (payload.release_status !== 'held_for_review') fail(`week ${expectedNumber}: payload bypasses review hold`);
  if (Date.parse(payload.scheduled_at) !== Date.parse(slot.scheduled_at)) fail(`week ${expectedNumber}: payload schedule mismatch`);
  const count = words(article.body);
  if (count < program.quality_contract.min_words || count > program.quality_contract.max_words) fail(`week ${expectedNumber}: ${count} words`);
  if (!article.body.includes('## Build this') || !article.body.includes('## Test it before moving on') || !article.body.includes('## Release decision')) fail(`week ${expectedNumber}: instructional sections missing`);
  if (!article.body.includes('**GO:**') || !article.body.includes('**NO-GO:**') || !article.body.includes('**Next Friday:**') || !article.body.includes('**Operating limit:**') || !article.body.includes('**Friday deliverable:**')) {
    fail(`week ${expectedNumber}: decision or continuity marker missing`);
  }
  if (!article.body.includes('Educational, not investment advice.')) fail(`week ${expectedNumber}: disclaimer missing`);
  if (/articles\.dailytickers\.com|read more on|full version on/i.test(article.body)) fail(`week ${expectedNumber}: website reference forbidden`);
  if (/\b(?:us_highvol|episodic-pivot|stockbox|portfolio_[a-z]|dtxdecide|daily tickers internal)\b/i.test(article.body)) fail(`week ${expectedNumber}: proprietary identifier leaked`);
  if (/\b(?:buy|sell)\s+[A-Z]{1,5}\b/.test(article.body)) fail(`week ${expectedNumber}: current recommendation pattern detected`);
  const links = [...article.body.matchAll(/https?:\/\/[^\s)>]+/g)].map(match => match[0].replace(/[.,;]+$/, ''));
  if (links.length < 2) fail(`week ${expectedNumber}: two primary sources required`);
  for (const link of links) {
    const host = new URL(link).hostname.replace(/^www\./, '');
    if (!['investor.gov', 'finra.org', 'sec.gov', 'nyse.com', 'cftc.gov', 'itl.nist.gov'].some(domain => host === domain || host.endsWith(`.${domain}`))) {
      fail(`week ${expectedNumber}: non-primary source ${host}`);
    }
  }
}

const draftIndex = JSON.parse(fs.readFileSync(path.join(draftsRoot, 'index.json'), 'utf8'));
if (draftIndex.count !== 45 || draftIndex.drafts?.length !== 45) fail('draft index is incomplete');
if (calendar.starts_at !== '2026-09-04T12:00:00.000Z' || calendar.ends_at !== '2027-07-09T12:00:00.000Z') fail('calendar boundary mismatch');

const harnessFile = path.join(programRoot, 'harness.json');
if (process.argv.includes('--require-reviews')) {
  if (!fs.existsSync(harnessFile)) fail('review harness missing');
  else {
    const harness = JSON.parse(fs.readFileSync(harnessFile, 'utf8'));
    if (harness.status !== 'reviewed' || harness.review_attestations?.status !== 'passed') fail('reviews are not closed');
    if (harness.review_attestations?.snapshot_sha256 !== harness.review_snapshot?.aggregate_sha256) fail('review snapshot mismatch');
    for (const role of ['senior_qa', 'contrarian', 'retail_war_room', 'ai_forensics']) {
      if (harness.gates?.[role] !== 'passed' || harness.review_attestations?.reviews?.[role]?.verdict !== 'PASS') fail(`review missing: ${role}`);
    }
    let aggregateInput = '';
    for (const relative of harness.review_snapshot?.aggregation?.ordered_files || []) {
      const file = path.join(root, relative);
      if (!fs.existsSync(file)) { fail(`snapshot file missing: ${relative}`); continue; }
      const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (harness.review_snapshot.files?.[relative] !== digest) fail(`snapshot hash mismatch: ${relative}`);
      aggregateInput += `${digest}  ${relative}\n`;
    }
    const aggregate = crypto.createHash('sha256').update(aggregateInput).digest('hex');
    if (aggregate !== harness.review_snapshot?.aggregate_sha256) fail('aggregate hash mismatch');
  }
}

for (const error of errors) console.error(`FAIL ${error}`);
if (errors.length) {
  console.error(`Systematic desk program validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Systematic desk program validation passed: 45 Friday posts, email disabled`);
