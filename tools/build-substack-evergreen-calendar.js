#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const programPath = path.join(repoRoot, 'data', 'substack', 'programs', 'retail-market-operating-system', 'program.json');
const outputPath = path.join(path.dirname(programPath), 'calendar.json');

function fail(message) {
  console.error(`Evergreen calendar build failed: ${message}`);
  process.exit(1);
}

function naturalSort(left, right) {
  return left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' });
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, ' - ')
    .replace(/&ndash;/g, ' - ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceTitle(file) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || path.basename(path.dirname(file)));
}

function frontMatter(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) fail(`${path.relative(repoRoot, file)}: missing front matter`);
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    try { result[key] = JSON.parse(value); }
    catch { result[key] = value; }
  }
  return result;
}

function verifiedScheduleReceipt(module, manifest) {
  if (!manifest.review_snapshot_harness) return null;
  const harnessFile = path.join(repoRoot, module.target_dir, manifest.review_snapshot_harness);
  if (!fs.existsSync(harnessFile)) return null;
  const harness = JSON.parse(fs.readFileSync(harnessFile, 'utf8'));
  const remote = harness.remote || {};
  if (remote.schedule_readback_verified !== true || remote.send_email !== false || remote.email_audience !== null) return null;
  if (remote.post_audience !== 'everyone' || remote.scheduled_episodes?.length !== manifest.episodes?.length) return null;
  const receipts = new Map(remote.scheduled_episodes.map(receipt => [Number(receipt.episode), receipt]));
  for (const episode of manifest.episodes || []) {
    const receipt = receipts.get(Number(episode.number));
    if (!receipt || !receipt.draft_id || receipt.post_audience !== 'everyone' || receipt.email_audience !== null) return null;
    if (Date.parse(receipt.scheduled_at) !== Date.parse(episode.scheduled_at) || !receipt.verified_at) return null;
  }
  return receipts;
}

function localDateAtUtc(localDate, localTime, timeZone) {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = localAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const renderedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += localAsUtc - renderedAsUtc;
  }
  return new Date(guess);
}

function addWeeks(localDate, weeks) {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + (weeks * 7)));
  return date.toISOString().slice(0, 10);
}

const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));
if (program.schedule?.send_email !== false || program.schedule?.email_audience !== null) {
  fail('program must explicitly disable email');
}

const sourceEpisodes = [];
for (const module of program.modules) {
  let episodes;
  if (module.existing_manifest) {
    const manifestFile = path.join(repoRoot, module.existing_manifest);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const receipts = verifiedScheduleReceipt(module, manifest);
    episodes = manifest.episodes.map(episode => {
      const targetFile = path.posix.join(module.target_dir, episode.file);
      const metadata = frontMatter(path.join(repoRoot, targetFile));
      if (!metadata) fail(`${targetFile}: target metadata is required`);
      if (metadata.title !== episode.title || metadata.subtitle !== episode.subtitle) {
        fail(`${targetFile}: manifest and front matter disagree`);
      }
      const sourceFile = episode.source_path;
      if (!sourceFile || !fs.existsSync(path.join(repoRoot, sourceFile))) fail(`${targetFile}: source_path is missing or invalid`);
      const receipt = receipts?.get(Number(episode.number));
      return {
        source_file: sourceFile,
        target_file: targetFile,
        source_title: sourceTitle(path.join(repoRoot, sourceFile)),
        title: metadata.title,
        subtitle: metadata.subtitle,
        remote_status: receipt ? 'verified_scheduled' : 'schedule_receipt_pending',
        ...(receipt ? { remote_draft_id: String(receipt.draft_id) } : {})
      };
    });
  } else {
    const sourceDir = path.join(repoRoot, module.source_dir);
    episodes = fs.readdirSync(sourceDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^(?:part|ep)\d+/i.test(entry.name))
      .map(entry => path.join(sourceDir, entry.name, 'index.html'))
      .filter(file => fs.existsSync(file))
      .sort(naturalSort)
      .map((file, index) => {
        const targetFile = path.posix.join(module.target_dir, `episode-${String(index + 1).padStart(2, '0')}.md`);
        const metadata = frontMatter(path.join(repoRoot, targetFile));
        return {
          source_file: path.relative(repoRoot, file).split(path.sep).join('/'),
          target_file: targetFile,
          source_title: sourceTitle(file),
          title: metadata?.title || null,
          subtitle: metadata?.subtitle || null,
          remote_status: metadata ? 'authorized_for_scheduling' : 'planned'
        };
      });
  }
  if (episodes.length !== module.expected_episodes) {
    fail(`${module.id}: expected ${module.expected_episodes} episodes, found ${episodes.length}`);
  }
  episodes.forEach((episode, index) => sourceEpisodes.push({
    module_id: module.id,
    module_title: module.title,
    module_episode: index + 1,
    module_episode_count: episodes.length,
    ...episode
  }));
}

if (sourceEpisodes.length !== program.inventory.selected_episodes) {
  fail(`expected ${program.inventory.selected_episodes} total episodes, found ${sourceEpisodes.length}`);
}

const slots = sourceEpisodes.map((episode, index) => {
  const localDate = addWeeks(program.schedule.start_local_date, index);
  const scheduled = localDateAtUtc(localDate, program.schedule.local_time, program.schedule.timezone);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: program.schedule.timezone,
    weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(scheduled).map(part => [part.type, part.value]));
  if (parts.weekday !== program.schedule.weekday || `${parts.hour}:${parts.minute}` !== program.schedule.local_time) {
    fail(`slot ${index + 1}: timezone conversion mismatch`);
  }
  return {
    week: index + 1,
    local_date: localDate,
    scheduled_at: scheduled.toISOString(),
    timezone: program.schedule.timezone,
    local_time: program.schedule.local_time,
    post_audience: program.schedule.post_audience,
    send_email: false,
    email_audience: null,
    ...episode
  };
});

const calendar = {
  schema_version: 'substack-program-calendar.v1',
  program_id: program.program_id,
  generated_at: program.created_at,
  starts_at: slots[0].scheduled_at,
  ends_at: slots.at(-1).scheduled_at,
  episode_count: slots.length,
  slots
};
fs.writeFileSync(outputPath, `${JSON.stringify(calendar, null, 2)}\n`);
console.log(`${outputPath}: ${slots.length} weekly episodes, ${calendar.starts_at} to ${calendar.ends_at}`);
