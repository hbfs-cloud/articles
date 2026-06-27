#!/usr/bin/env node
'use strict';
/**
 * publish.js — Unified publication pipeline
 *
 * Usage:
 *   node tools/publish.js --type <daily|weekly|scanner|retro|analysis|series|tech>
 *                         --path <relative/path/to/index.html>
 *                         [--dry-run] [--no-push] [--no-notify]
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Safe argv injection guard ────────────────────────────────────────────────
// artPath is user-controlled — reject anything with shell metachars or traversal.
function assertSafePath(p) {
  if (!p || typeof p !== 'string') return false;
  if (p.includes('..')) return false;
  if (!/^[\w./-]+$/.test(p)) return false;
  return true;
}

function runSafe(bin, args, label) {
  const cmdStr = `${bin} ${args.join(' ')}`;
  console.log(`  $ ${cmdStr}`);
  if (dryRun) { console.log('  [dry-run] skipped'); return; }
  const res = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`ERROR: ${label} failed (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

// ─── Parse args ───────────────────────────────────────────────────────────────

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

const type    = getArg('--type');
const artPath = getArg('--path');
const dryRun  = process.argv.includes('--dry-run');
const noPush  = process.argv.includes('--no-push');
const noNotify= process.argv.includes('--no-notify');

const VALID_TYPES = ['daily', 'weekly', 'scanner', 'retro', 'analysis', 'series', 'tech'];

// ─── Step 1: Validate args ────────────────────────────────────────────────────

console.log('\nStep 1/7 — Validating arguments...');

if (!type || !VALID_TYPES.includes(type)) {
  console.error(`ERROR: --type must be one of: ${VALID_TYPES.join(', ')}`);
  console.error('Usage: node tools/publish.js --type <type> --path <path> [--dry-run] [--no-push] [--no-notify]');
  process.exit(1);
}

if (!artPath) {
  console.error('ERROR: --path is required (e.g. --path daily/20260414/index.html)');
  process.exit(1);
}

if (!assertSafePath(artPath)) {
  console.error(`ERROR: --path "${artPath}" contains unsafe characters (shell metachars or path traversal).`);
  process.exit(1);
}

console.log(`  type=${type}  path=${artPath}  dry-run=${dryRun}  no-push=${noPush}  no-notify=${noNotify}`);

// ─── Step 2: File size check ──────────────────────────────────────────────────

console.log('\nStep 2/7 — Checking file size (> 10KB required)...');

const absPath = path.join(ROOT, artPath);
if (!fs.existsSync(absPath)) {
  console.error(`ERROR: File not found: ${absPath}`);
  process.exit(1);
}

const sizeKB = fs.statSync(absPath).size / 1024;
if (sizeKB < 10) {
  console.error(`ERROR: File is too small (${sizeKB.toFixed(1)} KB < 10 KB). Generation may be incomplete.`);
  process.exit(1);
}

console.log(`  OK — ${sizeKB.toFixed(1)} KB`);

// ─── Step 2b: Pre-publish validation (scanner only) ───────────────────────────

if (type === 'scanner') {
  console.log('\nStep 2b/7 — Validating scan against scanner-filters.json...');
  const scanDir = artPath.split('/').slice(0, 2).join('/');
  const vRes = spawnSync('node', ['tools/validate-scan.js', scanDir], { cwd: ROOT, stdio: 'inherit' });
  if (vRes.status !== 0) {
    const e = { status: vRes.status };
    console.error('\nERROR: Scan validation failed — aborting publish.');
    console.error('Fix the signals.json / scan HTML above, or override with --skip-validate.\n');
    if (!process.argv.includes('--skip-validate')) process.exit(e.status || 1);
    console.warn('⚠️  --skip-validate set — publishing non-compliant scan (NOT RECOMMENDED).');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd, label) {
  console.log(`  $ ${cmd}`);
  if (dryRun) {
    console.log('  [dry-run] skipped');
    return;
  }
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(`ERROR: ${label} failed (exit ${e.status})`);
    process.exit(e.status || 1);
  }
}

// Extract date/identifier segment from path (e.g. daily/20260414/index.html → 20260414)
function extractDatePart(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  // Second segment is typically the date folder (daily/20260414/...)
  return parts.length >= 2 ? parts[1] : parts[0];
}

// ─── Step 3: Index the article ────────────────────────────────────────────────

console.log('\nStep 3/7 — Indexing article (add_card.js)...');
runSafe('node', ['tools/add_card.js', artPath], 'add_card.js');

// ─── Step 4: Git add ──────────────────────────────────────────────────────────

console.log('\nStep 4/7 — Staging files (git add)...');

// Always stage the article folder and data/
const artFolder = artPath.split('/').slice(0, 2).join('/');
let gitAddPaths = [artFolder, 'data/'];

if (type === 'daily' || type === 'weekly') {
  gitAddPaths.push('data/radar.json');
}

if (type === 'scanner' || type === 'retro') {
  gitAddPaths.push('portfolio/', 'scanner/status/', 'history/');
}

// Deduplicate + drop non-existent paths (some like history/ only exist post-pipeline)
const ROOT_PUB = path.resolve(__dirname, '..');
const uniquePaths = [...new Set(gitAddPaths)].filter(p => fs.existsSync(path.join(ROOT_PUB, p)));
runSafe('git', ['add', ...uniquePaths], 'git add');

// ─── Step 4b: Content validation gate ────────────────────────────────────────

console.log('\nStep 4b/7 — Validating article content...');
const valRes = spawnSync('node', ['tools/validate-article.js', artPath, '--type', type], { cwd: ROOT, stdio: 'inherit' });
if (valRes.status !== 0) {
  console.error('\nERROR: Content validation failed — aborting publish.');
  console.error('Fix the issues above, or use --skip-validate to override (NOT RECOMMENDED).\n');
  if (!process.argv.includes('--skip-validate')) {
    spawnSync('git', ['reset', 'HEAD'], { cwd: ROOT, stdio: 'inherit' });
    process.exit(valRes.status || 1);
  }
  console.warn('⚠️  --skip-validate set — publishing despite validation failure.');
}

// ─── Step 5: Git commit ───────────────────────────────────────────────────────

console.log('\nStep 5/7 — Committing...');
const datePart = extractDatePart(artPath);
const commitMsg = `feat: ${type} ${datePart} — auto-published`;
runSafe('git', ['commit', '-m', commitMsg], 'git commit');

// ─── Step 6: Git push ─────────────────────────────────────────────────────────

if (!noPush) {
  console.log('\nStep 6/7 — Pushing to origin main...');
  const pushRes = spawnSync('git', ['push', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
  if (pushRes.status !== 0) {
    console.log('  Push rejected — retrying with pull --rebase...');
    const pullRes = spawnSync('git', ['pull', '--rebase', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
    if (pullRes.status !== 0) {
      console.error('ERROR: git pull --rebase failed');
      process.exit(1);
    }
    runSafe('git', ['push', 'origin', 'main'], 'git push (retry)');
  }
} else {
  console.log('\nStep 6/7 — Skipped (--no-push)');
}

// ─── Step 7: Telegram notification ───────────────────────────────────────────

if (!noNotify && !dryRun) {
  console.log('\nStep 7/7 — Sending Telegram notification...');
  runSafe('node', ['tools/telegram-publish-notify.js', '--type', type, '--path', artPath], 'telegram-publish-notify.js');
} else {
  const reason = dryRun ? '--dry-run' : '--no-notify';
  console.log(`\nStep 7/7 — Skipped (${reason})`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const url = `https://articles.dailytickers.com/${artFolder}/`;
console.log(`\n✅ Published ${type} ${artPath} → ${url}`);
if (dryRun) console.log('   (dry-run — no files were modified)');
