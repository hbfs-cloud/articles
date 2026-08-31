#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const root = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system');
const args = new Set(process.argv.slice(2));
const planOnly = args.has('--plan-only');
const requireReviews = args.has('--require-reviews');
const program = JSON.parse(fs.readFileSync(path.join(root, 'program.json'), 'utf8'));
const calendar = JSON.parse(fs.readFileSync(path.join(root, 'calendar.json'), 'utf8'));
const errors = [];
const fail = message => errors.push(message);
const minWords = Number(program.quality_contract?.min_words);
const maxWords = Number(program.quality_contract?.max_words);
const observedSourceUrls = new Set();
let linkAuditSummary = null;
let linkAudit = null;
const allowedSourceDomains = new Set([
  'bea.gov', 'bls.gov', 'cboe.com', 'census.gov', 'cftc.gov', 'cmegroup.com',
  'ecb.europa.eu', 'federalreserve.gov', 'finra.org', 'fred.stlouisfed.org',
  'home.treasury.gov', 'investor.gov', 'investors.tapestry.com', 'irs.gov',
  'itl.nist.gov', 'newyorkfed.org', 'nyse.com', 'optionseducation.org', 'sec.gov',
  'spglobal.com', 'theocc.com', 'treasurydirect.gov'
]);

function frontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { result[key] = JSON.parse(value); }
    catch { result[key] = value; }
  }
  return { result, body: raw.slice(match[0].length) };
}

function wordCount(body) {
  return body.replace(/https?:\/\/\S+/g, ' ').replace(/[`*_>#\[\]()|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function hasActionChecklist(body) {
  const bulletCount = (body.match(/^\s*(?:[-*] |\d+[.)]\s+)/gm) || []).length;
  const actionLead = /(action checklist|\bcheck\b|\btest\b|before\s+\w+|do this|run this|use this|procedure|next time|write down|record|track|review)/i;
  return bulletCount >= 3 && actionLead.test(body);
}

function hasExplicitLimitation(body) {
  return /(\*\*(?:limitation|limit|boundary|counter-case):\*\*|\b(?:limitation|framework has an important limit|does not|doesn't|cannot|counter-case|fails when|exception|not enough|can still)\b)/i.test(body);
}

function countIndexPages(root) {
  let count = 0;
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isFile() && entry.name === 'index.html') count += 1;
    }
  }
  return count;
}

function canonicalHost(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function validateSourceLinks(body, week) {
  const marker = body.search(/^Sources?:/im);
  if (marker < 0) {
    fail(`week ${week}: Sources section missing`);
    return;
  }
  const urls = [...body.slice(marker).matchAll(/https?:\/\/[^\s)>]+/g)].map(match => match[0].replace(/[.,;]+$/, ''));
  if (!urls.length) {
    fail(`week ${week}: official source link missing`);
    return;
  }
  for (const value of urls) {
    observedSourceUrls.add(value);
    let parsed;
    try { parsed = new URL(value); }
    catch {
      fail(`week ${week}: invalid source URL ${value}`);
      continue;
    }
    const host = canonicalHost(parsed.hostname);
    if (host === 'github.com') {
      if (!/^\/bitcoin\/bitcoin\/blob\/[0-9a-f]{40}\//i.test(parsed.pathname)) {
        fail(`week ${week}: GitHub source must pin a 40-character Bitcoin Core commit`);
      }
      continue;
    }
    const allowed = [...allowedSourceDomains].some(domain => host === domain || host.endsWith(`.${domain}`));
    if (!allowed) fail(`week ${week}: source domain is not in the primary-source allowlist: ${host}`);
  }
}

if (program.schedule?.send_email !== false || program.schedule?.email_audience !== null) fail('program email must be disabled');
if (program.remote_contract?.send_email !== false || program.remote_contract?.email_audience !== null) fail('remote contract email must be disabled');
if (program.remote_contract?.section_id !== program.section?.id) fail('remote contract section mismatch');
if (program.remote_contract?.require_draft_validation !== true || program.remote_contract?.require_schedule_readback !== true) {
  fail('remote contract must require validation and schedule readback');
}
if (!Number.isInteger(minWords) || !Number.isInteger(maxWords) || minWords < 1 || minWords > maxWords) {
  fail('program word-count contract is invalid');
}
const catalogPath = path.join(repoRoot, program.inventory?.catalog_path || '');
let catalog = null;
if (!program.inventory?.catalog_path || !fs.existsSync(catalogPath)) fail('canonical series catalog is missing');
else {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (program.inventory.catalog_series_reviewed !== catalog.seriesCount) fail('catalog series count mismatch');
  if (program.inventory.candidate_chapters !== catalog.chapterCount) fail('catalog chapter count mismatch');
}
const inventoryPath = path.join(repoRoot, program.inventory?.snapshot_path || '');
if (!program.inventory?.snapshot_path || !fs.existsSync(inventoryPath)) fail('chapter disposition inventory is missing');
else {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory.schema_version !== 'substack-program-inventory.v1') fail('chapter disposition inventory schema mismatch');
  if (inventory.program_id !== program.program_id) fail('chapter disposition inventory program mismatch');
  if (inventory.summary?.candidate_chapters !== program.inventory.candidate_chapters) fail('chapter disposition inventory candidate count mismatch');
  if (inventory.summary?.selected !== program.inventory.selected_episodes) fail('chapter disposition inventory selected count mismatch');
  if (inventory.summary?.deferred !== program.inventory.deferred_chapters) fail('chapter disposition inventory deferred count mismatch');
  if (inventory.chapters?.length !== program.inventory.candidate_chapters) fail('chapter disposition inventory row count mismatch');
  const hrefs = new Set();
  const selectedSources = new Map();
  for (const row of inventory.chapters || []) {
    if (hrefs.has(row.href)) fail(`chapter disposition inventory duplicate href: ${row.href}`);
    hrefs.add(row.href);
    if (!['selected', 'deferred'].includes(row.disposition)) fail(`chapter disposition inventory invalid disposition: ${row.href}`);
    if (!row.reason || !row.source_file) fail(`chapter disposition inventory incomplete row: ${row.href}`);
    if (row.disposition === 'selected') {
      if (!Number.isInteger(row.selected_week) || !row.module_id || !row.target_file) fail(`selected inventory row is incomplete: ${row.href}`);
      selectedSources.set(row.source_file, row);
    }
  }
  if (catalog) {
    const catalogHrefs = new Set(catalog.series.flatMap(series => series.chapters.map(chapter => chapter.href)));
    if (hrefs.size !== catalogHrefs.size || [...catalogHrefs].some(href => !hrefs.has(href))) fail('chapter disposition inventory does not cover the canonical catalog exactly');
  }
  for (const slot of calendar.slots || []) {
    const row = selectedSources.get(slot.source_file);
    if (!row || row.selected_week !== slot.week || row.module_id !== slot.module_id || row.target_file !== slot.target_file) {
      fail(`week ${slot.week}: calendar and chapter disposition inventory disagree`);
    }
  }
}
const seriesRoot = path.join(repoRoot, 'series');
const seriesDirectoryCount = fs.readdirSync(seriesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
if (program.inventory?.series_directories_scanned !== seriesDirectoryCount) fail('series directory count mismatch');
if (program.inventory?.html_pages_scanned !== countIndexPages(seriesRoot)) fail('series HTML page count mismatch');
if (program.inventory?.selected_episodes + program.inventory?.deferred_chapters !== program.inventory?.candidate_chapters) {
  fail('selected and deferred chapter counts do not reconcile');
}
const linkAuditPath = path.join(repoRoot, program.evidence?.source_link_audit_path || '');
if (!program.evidence?.source_link_audit_path || !fs.existsSync(linkAuditPath)) fail('source link audit is missing');
else {
  const audit = JSON.parse(fs.readFileSync(linkAuditPath, 'utf8'));
  linkAudit = audit;
  const summary = audit.summary || {};
  linkAuditSummary = summary;
  if (audit.schema_version !== 'substack-source-link-audit.v2' || audit.program_id !== program.program_id) fail('source link audit identity mismatch');
  if (audit.links?.length !== summary.unique_links) fail('source link audit row count mismatch');
  if (new Set((audit.links || []).map(link => link.url)).size !== audit.links?.length) fail('source link audit contains duplicate URLs');
  const classificationCounts = Object.fromEntries(['reachable', 'official_access_restricted', 'dead', 'network_error', 'http_error'].map(classification => [
    classification,
    (audit.links || []).filter(link => link.classification === classification).length
  ]));
  if (classificationCounts.reachable !== summary.reachable_2xx_3xx || classificationCounts.dead !== summary.dead_404_410 ||
      classificationCounts.network_error !== summary.network_errors || classificationCounts.http_error !== summary.other_http_errors) {
    fail('source link audit classification counts do not reconcile');
  }
  if (summary.unique_links !== summary.reachable_2xx_3xx + summary.official_rate_limited_or_bot_blocked) fail('source link audit counts do not reconcile');
  if (summary.dead_404_410 !== 0 || summary.network_errors !== 0 || summary.other_http_errors !== 0) fail('source link audit contains unresolved failures');
  if ((audit.links || []).filter(link => link.classification === 'official_access_restricted').length !== summary.official_rate_limited_or_bot_blocked) {
    fail('source link audit restricted-link count mismatch');
  }
}
if (calendar.episode_count !== program.inventory?.selected_episodes) fail('calendar episode count does not match inventory');
if (calendar.slots?.length !== calendar.episode_count) fail('calendar slots length mismatch');
if (calendar.episode_count < 79) fail('program must cover at least 18 months of weekly posts');

const targets = new Set();
const dates = new Set();
for (const slot of calendar.slots || []) {
  if (slot.send_email !== false || slot.email_audience !== null) fail(`week ${slot.week}: email is not disabled`);
  if (slot.post_audience !== program.schedule.post_audience) fail(`week ${slot.week}: post audience mismatch`);
  if (targets.has(slot.target_file)) fail(`duplicate target: ${slot.target_file}`);
  if (dates.has(slot.scheduled_at)) fail(`duplicate schedule: ${slot.scheduled_at}`);
  targets.add(slot.target_file);
  dates.add(slot.scheduled_at);
  if (!fs.existsSync(path.join(repoRoot, slot.source_file))) fail(`missing source: ${slot.source_file}`);
  const timestamp = Date.parse(slot.scheduled_at);
  if (!Number.isFinite(timestamp)) {
    fail(`week ${slot.week}: invalid scheduled_at`);
    continue;
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: program.schedule.timezone,
    weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  if (parts.weekday !== program.schedule.weekday || `${parts.hour}:${parts.minute}` !== program.schedule.local_time) {
    fail(`week ${slot.week}: expected ${program.schedule.weekday} ${program.schedule.local_time}, got ${parts.weekday} ${parts.hour}:${parts.minute}`);
  }
  if (!planOnly) {
    const target = path.join(repoRoot, slot.target_file);
    if (!fs.existsSync(target)) {
      fail(`week ${slot.week}: missing target ${slot.target_file}`);
      continue;
    }
    const parsed = frontMatter(fs.readFileSync(target, 'utf8'));
    if (!parsed) {
      fail(`week ${slot.week}: missing front matter`);
      continue;
    }
    const metadata = parsed.result;
    if (metadata.title !== slot.title || metadata.subtitle !== slot.subtitle) fail(`week ${slot.week}: calendar title metadata mismatch`);
    if (metadata.module_id !== slot.module_id) fail(`week ${slot.week}: module_id mismatch`);
    if (Number(metadata.episode_number) !== slot.module_episode) fail(`week ${slot.week}: episode_number mismatch`);
    if (metadata.source_path !== slot.source_file) fail(`week ${slot.week}: source_path mismatch`);
    const count = wordCount(parsed.body);
    if (Number.isInteger(minWords) && Number.isInteger(maxWords) && (count < minWords || count > maxWords)) {
      fail(`week ${slot.week}: ${count} words, expected ${minWords}-${maxWords}`);
    }
    if (!parsed.body.includes(`Part ${slot.module_episode} of ${slot.module_episode_count}`)) fail(`week ${slot.week}: part marker missing`);
    if (!hasActionChecklist(parsed.body)) fail(`week ${slot.week}: action checklist missing`);
    if (!hasExplicitLimitation(parsed.body)) fail(`week ${slot.week}: limitation missing`);
    validateSourceLinks(parsed.body, slot.week);
    if (!/Educational,\s+not\s+investment\s+advice\./i.test(parsed.body)) fail(`week ${slot.week}: disclaimer missing`);
    if (/articles\.dailytickers\.com|full version|read more on (our|the) (site|website)/i.test(parsed.body)) fail(`week ${slot.week}: website reference forbidden`);
    if (/^\s*\|.*\|\s*$/m.test(parsed.body) || /!\[[^\]]*\]\(/.test(parsed.body) || /::(?:chart|audience)/.test(parsed.body)) {
      fail(`week ${slot.week}: complex layout is forbidden without a rendered preview`);
    }
  }
}

for (let index = 1; index < (calendar.slots || []).length; index += 1) {
  const previous = Date.parse(`${calendar.slots[index - 1].local_date}T00:00:00Z`);
  const current = Date.parse(`${calendar.slots[index].local_date}T00:00:00Z`);
  if (current - previous !== 7 * 24 * 60 * 60 * 1000) fail(`weeks ${index} and ${index + 1} are not seven local days apart`);
}
if (!planOnly && linkAuditSummary && observedSourceUrls.size !== linkAuditSummary.unique_links) {
  fail(`source link audit covers ${linkAuditSummary.unique_links} links but content contains ${observedSourceUrls.size}`);
}
if (!planOnly && linkAudit) {
  const observed = [...observedSourceUrls].sort();
  const audited = (linkAudit.links || []).map(link => link.url).sort();
  if (JSON.stringify(observed) !== JSON.stringify(audited)) fail('source link audit URL set differs from the content URL set');
  const observedHash = crypto.createHash('sha256').update(`${observed.join('\n')}\n`).digest('hex');
  if (linkAudit.url_set_sha256 !== observedHash) fail('source link audit URL-set hash mismatch');
}

if (!planOnly) {
  for (const module of program.modules.filter(item => !item.existing_manifest)) {
    const manifestPath = path.join(repoRoot, module.target_dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      fail(`${module.id}: manifest missing`);
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.delivery?.send_email !== false || manifest.delivery?.email_audience !== null) fail(`${module.id}: manifest email is not disabled`);
    if (manifest.episodes?.length !== module.expected_episodes) fail(`${module.id}: manifest episode count mismatch`);
    if (manifest.rollout?.phase !== 'authorized-for-scheduling') fail(`${module.id}: rollout phase must be authorized-for-scheduling`);
    if (manifest.rollout?.authorized_episode_count !== module.expected_episodes) fail(`${module.id}: authorized episode count mismatch`);
    if (manifest.publication_contract?.min_words_per_episode !== minWords || manifest.publication_contract?.max_words_per_episode !== maxWords) {
      fail(`${module.id}: word-count contract mismatch`);
    }
  }
  if (requireReviews) {
    const harnessPath = path.join(root, 'harness.json');
    if (!fs.existsSync(harnessPath)) fail('program harness missing');
    else {
      const harness = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));
      const snapshot = harness.review_snapshot;
      if (snapshot?.aggregation?.algorithm !== 'sha256') fail('program harness algorithm must be sha256');
      if (snapshot?.aggregation?.line_format !== '<sha256><two spaces><repo_relative_path>\\n') fail('program harness line format mismatch');
      let aggregateInput = '';
      for (const relative of snapshot?.aggregation?.ordered_files || []) {
        const file = path.join(repoRoot, relative);
        if (!fs.existsSync(file)) {
          fail(`program harness file missing: ${relative}`);
          continue;
        }
        const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        if (snapshot.files?.[relative] !== digest) fail(`program harness hash mismatch: ${relative}`);
        aggregateInput += `${digest}  ${relative}\n`;
      }
      const aggregate = crypto.createHash('sha256').update(aggregateInput).digest('hex');
      if (snapshot?.aggregate_sha256 !== aggregate) fail('program harness aggregate mismatch');
      const attestations = harness.review_attestations;
      if (harness.status !== 'reviewed' || attestations?.status !== 'passed') fail('program review attestations are not closed');
      if (attestations?.snapshot_sha256 !== snapshot?.aggregate_sha256) fail('program review attestations target a different snapshot');
      for (const gate of ['program_validator', 'series_validators', 'ai_phrase_linter', 'javascript_syntax']) {
        if (harness.gates?.[gate] !== 'passed') fail(`required local gate has not passed: ${gate}`);
      }
      for (const gate of ['senior_qa', 'contrarian', 'retail_war_room', 'ai_forensics']) {
        if (harness.gates?.[gate] !== 'passed') fail(`required review has not passed: ${gate}`);
        const review = attestations?.reviews?.[gate];
        if (review?.verdict !== 'PASS' || !review.agent_id || !review.attested_at) fail(`required review attestation is incomplete: ${gate}`);
      }
    }
  }
}

for (const error of errors) console.error(`FAIL ${error}`);
if (errors.length) {
  console.error(`Evergreen program validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Evergreen program validation passed (${planOnly ? 'plan' : 'full'}): ${calendar.episode_count} episodes through ${calendar.ends_at}`);
