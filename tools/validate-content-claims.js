#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { validateCollectedArtifact } = require('./lib/evidence-gates');

const ROOT = path.resolve(__dirname, '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const pointerGet = (value, pointer) => pointer === '' ? value : String(pointer || '').startsWith('/')
  ? pointer.slice(1).split('/').reduce((node, raw) => node == null ? undefined : node[raw.replace(/~1/g, '/').replace(/~0/g, '~')], value)
  : undefined;
const hasNumber = text => /(?:^|[^A-Za-z])[-+]?(?:\d{1,3}(?:[ ,.']\d{3})+|\d+)(?:[.,]\d+)?%?/.test(text);
function renderValue(value, render) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !render || !Number.isInteger(render.decimals)
    || render.decimals < 0 || render.decimals > 8 || typeof render.scale !== 'number') return null;
  const scaled = value * render.scale;
  const sign = render.sign === 'always' && scaled >= 0 ? '+' : '';
  return `${render.prefix || ''}${sign}${scaled.toFixed(render.decimals)}${render.suffix || ''}`;
}

function validate(manifest, root = ROOT) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest must be an object'];
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(manifest.reference_close || ''))) errors.push('reference_close is invalid');
  const rel = manifest.article_path;
  if (!rel || path.isAbsolute(rel)) return ['article_path must be repository-relative'];
  const articlePath = path.resolve(root, rel);
  if (path.relative(root, articlePath).startsWith('..') || !fs.existsSync(articlePath)) return ['article_path is missing or escapes repository'];
  const bytes = fs.readFileSync(articlePath);
  if (sha256(bytes) !== manifest.article_sha256) errors.push('article_sha256 mismatch');
  const document = new JSDOM(bytes.toString('utf8')).window.document;
  const main = document.querySelector('main');
  if (!main) return [...errors, 'article must contain main'];
  const claims = Array.isArray(manifest.claims) ? manifest.claims : [];
  const byId = new Map();
  for (const claim of claims) {
    if (!claim || !/^[a-z0-9][a-z0-9_-]*$/.test(String(claim.id || ''))) { errors.push('claim id is invalid'); continue; }
    if (byId.has(claim.id)) errors.push(`duplicate manifest claim ${claim.id}`);
    byId.set(claim.id, claim);
  }
  const seen = new Set();
  for (const element of main.querySelectorAll('[data-claim]')) {
    const id = element.getAttribute('data-claim');
    if (seen.has(id)) errors.push(`duplicate article claim ${id}`);
    seen.add(id);
    const claim = byId.get(id);
    if (!claim) { errors.push(`article claim ${id} is absent from manifest`); continue; }
    if (element.textContent.trim() !== String(claim.rendered_text || '').trim()) errors.push(`${id}: rendered_text differs from article`);
  }
  for (const id of byId.keys()) if (!seen.has(id)) errors.push(`manifest claim ${id} is absent from article`);
  const walker = document.createTreeWalker(main, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[data-claim],script,style,template,[aria-hidden="true"]')) continue;
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    if (text && hasNumber(text)) errors.push(`unbound numeric text: ${text.slice(0, 80)}`);
  }
  for (const claim of claims) {
    if (!claim || !claim.source_artifact || path.isAbsolute(claim.source_artifact)
      || !/^[a-f0-9]{64}$/.test(String(claim.source_sha256 || ''))
      || typeof claim.source_pointer !== 'string' || !claim.source_pointer.startsWith('/')) {
      errors.push(`${claim && claim.id || '?'}: source artifact/hash/pointer is invalid`); continue;
    }
    const sourcePath = path.resolve(root, claim.source_artifact);
    if (path.relative(root, sourcePath).startsWith('..') || !fs.existsSync(sourcePath)) { errors.push(`${claim.id}: source artifact is missing`); continue; }
    const sourceBytes = fs.readFileSync(sourcePath);
    if (sha256(sourceBytes) !== claim.source_sha256) { errors.push(`${claim.id}: source hash mismatch`); continue; }
    const collectedErrors = validateCollectedArtifact(sourcePath, claim.source_sha256, manifest.reference_close, root);
    if (collectedErrors.length) { errors.push(`${claim.id}: source collector provenance invalid: ${collectedErrors.join('; ')}`); continue; }
    let source;
    try { source = JSON.parse(sourceBytes); } catch { errors.push(`${claim.id}: source is not valid JSON`); continue; }
    const observed = pointerGet(source, claim.source_pointer);
    if (JSON.stringify(observed) !== JSON.stringify(claim.source_value)) errors.push(`${claim.id}: source_value differs from source_pointer`);
    const expectedText = renderValue(observed, claim.render);
    if (expectedText == null || expectedText !== claim.rendered_text) errors.push(`${claim.id}: rendered_text is not the deterministic rendering of source_value`);
  }
  return [...new Set(errors)];
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: validate-content-claims.js <claims.json>'); process.exit(2); }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`[content-claims] invalid JSON: ${error.message}`); process.exit(1); }
  const errors = validate(manifest);
  if (errors.length) { console.error('[content-claims] FAIL'); errors.forEach(error => console.error(`  - ${error}`)); process.exit(1); }
  console.log(`[content-claims] PASS (${manifest.claims.length} claims)`);
}

module.exports = { renderValue, validate };
