#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const requireReviews = args.includes('--require-reviews');
const target = args.find(argument => !argument.startsWith('--'));
if (!target) {
  console.error('Usage: node tools/validate-substack-series.js <series-directory> [--require-reviews]');
  process.exit(2);
}

const root = path.resolve(target);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest.json');
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function words(markdown) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[`*_>#\[\]()|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

if (!fs.existsSync(manifestPath)) {
  fail('manifest.json is missing');
} else {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (error) { fail(`manifest.json is invalid JSON: ${error.message}`); }

  if (manifest) {
    if (manifest.channel !== 'substack') fail('manifest channel must be substack');
    if (manifest.language !== 'en') fail('manifest language must be en');
    if (!Number.isInteger(manifest.section?.id)) fail('manifest section.id must be an integer');
    if (manifest.delivery?.post_audience !== manifest.audience) fail('post audience must match manifest audience');
    if (!manifest.selection_disclosure) fail('purpose-selection disclosure is missing');
    if (manifest.conflict_attestation?.issuer_sponsorship_or_compensation !== false) {
      fail('issuer sponsorship/compensation attestation is missing');
    }
    if (!manifest.conflict_attestation?.positions_disclosure) fail('positions disclosure is missing');
    if (!Array.isArray(manifest.episodes) || manifest.episodes.length < 2) {
      fail('manifest must contain at least two episodes');
    } else {
      const expected = manifest.episodes.map((_, index) => index + 1);
      const actual = manifest.episodes.map(episode => episode.number);
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        fail(`episode numbering must be contiguous: ${JSON.stringify(actual)}`);
      }

      const titles = new Set();
      const scheduled = [];
      for (const episode of manifest.episodes) {
        if (titles.has(episode.title)) fail(`duplicate title: ${episode.title}`);
        titles.add(episode.title);
        if (episode.scheduled_at) {
          const timestamp = Date.parse(episode.scheduled_at);
          if (!Number.isFinite(timestamp)) fail(`${episode.file}: invalid scheduled_at`);
          else {
            scheduled.push({ number: episode.number, timestamp });
            try {
              const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
                timeZone: manifest.cadence?.timezone,
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
              }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
              const localTime = `${parts.hour}:${parts.minute}`;
              if (parts.weekday !== manifest.cadence?.weekday || localTime !== manifest.cadence?.local_time) {
                fail(`${episode.file}: schedule is ${parts.weekday} ${localTime} in ${manifest.cadence?.timezone}`);
              }
            } catch (error) {
              fail(`${episode.file}: cadence timezone is invalid: ${error.message}`);
            }
          }
        }

        const file = path.join(root, episode.file);
        if (!fs.existsSync(file)) {
          fail(`missing episode file: ${episode.file}`);
          continue;
        }

        const body = fs.readFileSync(file, 'utf8');
        const count = words(body);
        const min = manifest.publication_contract?.min_words_per_episode ?? 500;
        const max = manifest.publication_contract?.max_words_per_episode ?? 1000;
        if (count < min || count > max) fail(`${episode.file}: ${count} words, expected ${min}-${max}`);
        if (!body.includes(`title: "${episode.title}"`)) fail(`${episode.file}: front matter title mismatch`);
        if (!body.includes(`subtitle: "${episode.subtitle}"`)) fail(`${episode.file}: front matter subtitle mismatch`);
        if (!body.includes(`Part ${episode.number} of ${manifest.episodes.length}`)) fail(`${episode.file}: part marker missing`);
        if (!/(do not|reject|write|calculate|check|skip|reduce|record|give zero weight|treat)/i.test(body.slice(0, 2200))) {
          fail(`${episode.file}: decision is not visible near the start`);
        }
        if (!/(before|use this|run this|write|calculate|check|record|cross out|label)/i.test(body)) {
          fail(`${episode.file}: actionable instruction missing`);
        }
        if (!/(cannot|does not|may |depends|not a guarantee|not prove|no universal|different case|misses)/i.test(body)) {
          fail(`${episode.file}: explicit limitation or counter-case missing`);
        }
        if (!/educational/i.test(body)) fail(`${episode.file}: educational disclaimer missing`);
        if (/articles\.dailytickers\.com|full version|read more on (our|the) (site|website)|website version/i.test(body)) {
          fail(`${episode.file}: forbidden website reference`);
        }
        if (/\b(TODO|TBD|PLACEHOLDER|undefined|N\/A)\b/i.test(body)) fail(`${episode.file}: placeholder detected`);
        if (/\b(le|la|les|des|une|avec|pour|dans|sur)\b/gi.test(body.replace(/^---[\s\S]*?---\s*/m, '').slice(0, 1200))) {
          warn(`${episode.file}: possible French residue; review manually`);
        }
      }

      const pilotCount = manifest.rollout?.scheduled_episode_count;
      if (!Number.isInteger(pilotCount) || pilotCount < 1 || pilotCount > manifest.episodes.length) {
        fail('rollout.scheduled_episode_count must identify a non-empty pilot');
      } else {
        const expectedHeld = manifest.episodes.slice(pilotCount).map(episode => episode.number);
        const actualHeld = manifest.rollout?.held_as_drafts || [];
        if (JSON.stringify(expectedHeld) !== JSON.stringify(actualHeld)) {
          fail(`held_as_drafts mismatch: expected ${JSON.stringify(expectedHeld)}, got ${JSON.stringify(actualHeld)}`);
        }
        for (const episode of manifest.episodes) {
          const shouldSchedule = episode.number <= pilotCount;
          if (shouldSchedule !== Boolean(episode.scheduled_at)) {
            fail(`${episode.file}: schedule does not match pilot boundary`);
          }
        }
      }
      scheduled.sort((a, b) => a.number - b.number);
      for (let index = 1; index < scheduled.length; index += 1) {
        const elapsed = scheduled[index].timestamp - scheduled[index - 1].timestamp;
        if (elapsed !== 7 * 24 * 60 * 60 * 1000) {
          fail(`episodes ${scheduled[index - 1].number} and ${scheduled[index].number} are not one week apart`);
        }
      }
    }

    for (const evidence of manifest.governing_evidence || []) {
      if (!fs.existsSync(path.join(root, evidence))) fail(`missing evidence: ${evidence}`);
    }

    const harnessPath = path.join(root, manifest.review_snapshot_harness || '');
    if (!manifest.review_snapshot_harness || !fs.existsSync(harnessPath)) {
      fail('review snapshot harness is missing');
    } else {
      try {
        const harness = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));
        const snapshot = harness.review_snapshot;
        if (snapshot?.aggregation?.algorithm !== 'sha256') fail('review snapshot algorithm must be sha256');
        if (snapshot?.aggregation?.line_format !== '<sha256><two spaces><repo_relative_path>\\n') {
          fail('review snapshot line format is unsupported');
        }
        const ordered = snapshot?.aggregation?.ordered_files;
        if (!Array.isArray(ordered) || !ordered.length) {
          fail('review snapshot ordered file list is missing');
        } else {
          let aggregateInput = '';
          for (const relative of ordered) {
            const file = path.join(repoRoot, relative);
            if (!fs.existsSync(file)) {
              fail(`review snapshot file is missing: ${relative}`);
              continue;
            }
            const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
            if (snapshot.files?.[relative] !== digest) fail(`review snapshot hash mismatch: ${relative}`);
            aggregateInput += `${digest}  ${relative}\n`;
          }
          const aggregate = crypto.createHash('sha256').update(aggregateInput).digest('hex');
          if (snapshot.aggregate_sha256 !== aggregate) fail('review snapshot aggregate hash mismatch');
        }
        if (requireReviews) {
          const reviewGateKeys = {
            'Senior QA': 'senior_qa',
            'Contrarian': 'contrarian',
            'Retail War Room': 'retail_war_room',
            'AI Forensics': 'ai_forensics'
          };
          for (const review of manifest.publication_contract?.required_reviews || []) {
            const key = reviewGateKeys[review];
            if (!key || harness.gates?.[key] !== 'passed') fail(`required review has not passed: ${review}`);
          }
        }
      } catch (error) {
        fail(`review snapshot harness is invalid: ${error.message}`);
      }
    }
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);
if (errors.length) {
  console.error(`Substack series validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`Substack series validation passed: ${warnings.length} warning(s)`);
