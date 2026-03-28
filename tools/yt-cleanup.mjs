#!/usr/bin/env node
// yt-cleanup.mjs — Delete YouTube videos NOT in the keep list
// Run via SSH on Mac Mini (where YT credentials are)
// Usage: node tools/yt-cleanup.mjs [--dry-run]
//
// Designed to be re-run daily until all junk is gone (quota = 50 deletes/day max)

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Videos to KEEP (latest AI-quality versions) ──────────────────────────────
const KEEP = new Set([
  'z0hBwy_c3Jw',  // Daily Briefing — Mar 28, 2026 (v4 with AI bullets)
  '7CE20AqrMu8',  // Weekly Review — Mar 23-27, 2026
  'DD5Inx73oa8',  // EQNR Stock Analysis
]);

const STATE_FILE = '/tmp/yt-cleanup-state.json';

// ── SSH helper (run on Mac Mini) ──────────────────────────────────────────────
async function getVideosRemote() {
  const script = `
export PATH=$PATH:/opt/homebrew/bin
cd ~/GolandProjects/video-factory
node --input-type=module << 'JSEOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
const creds = JSON.parse(readFileSync("/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json"));
const token = JSON.parse(readFileSync("/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json"));
const auth = new google.auth.OAuth2(creds.web.client_id, creds.web.client_secret, creds.web.redirect_uris[0]);
auth.setCredentials(token);
const yt = google.youtube({ version: "v3", auth });
const r = await yt.search.list({ part: "snippet", forMine: true, type: "video", maxResults: 50, order: "date" });
const items = r.data.items.filter(v => v.id?.videoId).map(v => ({ id: v.id.videoId, title: v.snippet?.title || "?" }));
console.log(JSON.stringify(items));
JSEOF`;

  try {
    const out = execSync(
      `sshpass -p 'Elonux!123' ssh -o StrictHostKeyChecking=no -o PubkeyAuthentication=no marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net '${script.replace(/'/g, "'\"'\"'")}'`,
      { encoding: 'utf8', timeout: 30000 }
    );
    const jsonLine = out.split('\n').find(l => l.startsWith('['));
    return jsonLine ? JSON.parse(jsonLine) : [];
  } catch (e) {
    console.error('❌ SSH list error:', e.message.slice(0, 200));
    return [];
  }
}

async function deleteVideoRemote(videoId) {
  const script = `
export PATH=$PATH:/opt/homebrew/bin
cd ~/GolandProjects/video-factory
node --input-type=module << 'JSEOF'
import { google } from "googleapis";
import { readFileSync } from "fs";
const creds = JSON.parse(readFileSync("/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-credentials.json"));
const token = JSON.parse(readFileSync("/Users/marketwatchxyz/GolandProjects/video-factory/credentials/youtube-token.json"));
const auth = new google.auth.OAuth2(creds.web.client_id, creds.web.client_secret, creds.web.redirect_uris[0]);
auth.setCredentials(token);
const yt = google.youtube({ version: "v3", auth });
try {
  await yt.videos.delete({ id: "${videoId}" });
  console.log("DELETED:${videoId}");
} catch(e) {
  if (e.message.includes('quota')) console.log("QUOTA_EXCEEDED");
  else console.log("ERROR:" + e.message.slice(0,100));
}
JSEOF`;

  try {
    const out = execSync(
      `sshpass -p 'Elonux!123' ssh -o StrictHostKeyChecking=no -o PubkeyAuthentication=no marketwatchxyz@melouadis-mac-mini.tail5d09f.ts.net '${script.replace(/'/g, "'\"'\"'")}'`,
      { encoding: 'utf8', timeout: 15000 }
    );
    if (out.includes('DELETED:')) return 'deleted';
    if (out.includes('QUOTA_EXCEEDED')) return 'quota';
    return 'error: ' + out.trim().slice(0, 100);
  } catch (e) {
    return 'error: ' + e.message.slice(0, 100);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n🧹 YouTube Cleanup');
console.log('   Keep list:', [...KEEP].join(', '));
if (DRY_RUN) console.log('   Mode: DRY-RUN\n');

const videos = await getVideosRemote();
if (videos.length === 0) {
  console.log('⚠️  Could not fetch video list — check SSH/credentials');
  process.exit(1);
}

const toDelete = videos.filter(v => !KEEP.has(v.id));
const toKeep = videos.filter(v => KEEP.has(v.id));

console.log(`\n📋 Channel: ${videos.length} videos total`);
console.log(`   ✅ Keep: ${toKeep.length}`);
toKeep.forEach(v => console.log(`      ${v.id} | ${v.title}`));
console.log(`   🗑️  Delete: ${toDelete.length}`);
toDelete.forEach(v => console.log(`      ${v.id} | ${v.title}`));

if (toDelete.length === 0) {
  console.log('\n🎉 Channel is clean — nothing to delete!');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n✅ Dry-run complete — no deletions performed');
  process.exit(0);
}

console.log('\n🗑️  Deleting...');
let deleted = 0, quotaHit = false;
const failed = [];

for (const v of toDelete) {
  if (quotaHit) { failed.push(v.id); continue; }

  process.stdout.write(`  ${v.id} | ${v.title.slice(0, 50)}... `);
  const result = await deleteVideoRemote(v.id);
  
  if (result === 'deleted') {
    console.log('✅');
    deleted++;
  } else if (result === 'quota') {
    console.log('⏸️  QUOTA EXCEEDED');
    quotaHit = true;
    failed.push(v.id);
  } else {
    console.log('❌', result);
    failed.push(v.id);
  }
  
  // Small delay to avoid hammering
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✅ Done: ${deleted} deleted`);
if (failed.length > 0) {
  console.log(`⏳ Remaining (${failed.length}): ${failed.join(', ')}`);
  if (quotaHit) {
    console.log('   ⚠️  Quota exceeded — re-run tomorrow after 8h UTC');
    console.log('   Run: cd /home/ci/projects/articles && node tools/yt-cleanup.mjs');
  }
}
