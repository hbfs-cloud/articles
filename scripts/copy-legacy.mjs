/**
 * Post-build script: copies legacy HTML content into Astro's dist/.
 * This allows old articles to coexist with new Astro-generated ones.
 *
 * Legacy dirs: daily/, analyses/, weekly/, scanner/, series/, tech/, lab/
 * Legacy files: index.html, 404.html, CNAME, logo.svg
 * Legacy assets: assets/, data/
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// Ensure dist exists
if (!existsSync(dist)) {
  console.error('dist/ does not exist. Run astro build first.');
  process.exit(1);
}

// Directories to copy (legacy content)
const legacyDirs = [
  'daily', 'analyses', 'weekly', 'scanner', 'series', 'tech', 'lab',
  'assets', 'data', 'prompt-ia',
];

// Files to copy
const legacyFiles = [
  'index.html', '404.html', 'CNAME', 'logo.svg',
];

let copied = 0;

for (const dir of legacyDirs) {
  const src = resolve(root, dir);
  const dest = resolve(dist, dir);
  if (existsSync(src)) {
    // Don't overwrite Astro-generated files (new articles take priority)
    cpSync(src, dest, { recursive: true, force: false });
    copied++;
    console.log(`  [legacy] ${dir}/ → dist/${dir}/`);
  }
}

for (const file of legacyFiles) {
  const src = resolve(root, file);
  const dest = resolve(dist, file);
  if (existsSync(src) && !existsSync(dest)) {
    cpSync(src, dest);
    copied++;
    console.log(`  [legacy] ${file} → dist/${file}`);
  }
}

console.log(`\nCopied ${copied} legacy items to dist/.`);
