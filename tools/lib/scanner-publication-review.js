'use strict';
// Offline publication overlay. Never invokes collection, tracking, mode reconciliation or ledger writers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const json = (root, rel) => JSON.parse(fs.readFileSync(safe(root, rel), 'utf8'));
function fail(message) { throw new Error(`scanner publication review: ${message}`); }
function safe(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).some(x => x === '..') || rel.includes('\\')) fail('unsafe relative path');
  const target = path.resolve(root, rel);
  let check = target;
  while (!fs.existsSync(check)) check = path.dirname(check);
  const real = fs.realpathSync(check), base = fs.realpathSync(root);
  if (real !== base && !real.startsWith(base + path.sep)) fail('symlink escapes root');
  // Refuse symlinks even within root: output must never alias a protected file.
  let p = root;
  for (const part of rel.split('/')) { p = path.join(p, part); if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) fail('symlink path'); }
  return target;
}
function exactKeys(o, allowed, label) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) fail(`${label} must be object`);
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${label}: forbidden field ${k}`);
}
function date(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d; }
function validateReview(root, reviewPath, now = new Date()) {
  root = fs.realpathSync(root);
  const rel = path.relative(root, path.resolve(root, reviewPath)).split(path.sep).join('/');
  const r = json(root, rel);
  exactKeys(r, ['schema_version','product','review_date','reference_close','status','actionability_certified','orders','excluded_components','article_url','headline','counts','watchlist','validation_pending','source_provenance','reviewed_at'], 'review');
  if (r.schema_version !== 1 || r.product !== 'scanner_surveillance_review' || r.status !== 'review_only' || r.actionability_certified !== false || !Array.isArray(r.orders) || r.orders.length) fail('review-only contract required');
  const today = now.toISOString().slice(0,10);
  if (!date(r.review_date) || !date(r.reference_close) || r.review_date > today || r.reference_close > r.review_date) fail('invalid/future dates');
  const dir = `scanner/${r.review_date.replaceAll('-', '')}`;
  if (require('./market-calendar').previousUSTradingDay(r.review_date) !== r.reference_close) fail('reference close must be previous US trading session');
  if (rel !== `${dir}/review.json` || r.article_url !== `/${dir}/`) fail('review directory/article date mismatch');
  if (typeof r.reviewed_at !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(r.reviewed_at) || !Number.isFinite(Date.parse(r.reviewed_at)) || Date.parse(r.reviewed_at) > now.getTime() || new Date(r.reviewed_at).toISOString().slice(0,10) < r.review_date) fail('invalid/future reviewed_at');
  if (JSON.stringify(r.excluded_components) !== '["dtx"]') fail('DTX must be explicitly excluded');
  if (typeof r.headline !== 'string' || !r.headline.trim() || r.headline.length > 300) fail('headline missing/too long');
  exactKeys(r.counts, ['screened','histories_complete','histories_rejected','numeric_pass'], 'counts');
  if (Object.keys(r.counts).length !== 4 || Object.values(r.counts).some(n => !Number.isSafeInteger(n) || n < 0) || r.counts.histories_complete + r.counts.histories_rejected !== r.counts.screened || r.counts.numeric_pass > r.counts.histories_complete) fail('inconsistent counts');
  if (!Array.isArray(r.watchlist)) fail('watchlist required');
  const tickers = new Set();
  for (const w of r.watchlist) {
    exactKeys(w, ['ticker','status'], 'watchlist');
    if (!/^[A-Z0-9][A-Z0-9.^-]{0,14}$/.test(w.ticker || '') || w.status !== 'verification_pending' || tickers.has(w.ticker)) fail('invalid/duplicate watchlist');
    tickers.add(w.ticker);
  }
  if (!Array.isArray(r.validation_pending) || !r.validation_pending.length || r.validation_pending.some(x => typeof x !== 'string' || !/^[a-z][a-z0-9_]*$/.test(x))) fail('pending validations required');
  if (!Array.isArray(r.source_provenance) || !r.source_provenance.length) fail('source provenance required');
  const names = new Set();
  for (const s of r.source_provenance) {
    exactKeys(s, ['name','path','sha256'], 'source');
    if (typeof s.name !== 'string' || !s.name || names.has(s.name) || !/^[a-f0-9]{64}$/.test(s.sha256 || '')) fail('invalid/duplicate source provenance');
    names.add(s.name);
    if (sha(fs.readFileSync(safe(root, s.path || s.name))) !== s.sha256) fail(`source hash mismatch: ${s.name}`);
  }
  const evidenceSource = r.source_provenance.find(s => (s.path || s.name) === `${dir}/review-evidence.json`);
  if (!evidenceSource) fail('canonical review evidence required');
  const evidence = json(root, `${dir}/review-evidence.json`);
  if (evidence.product !== 'scanner_surveillance_evidence' || evidence.reference_close !== r.reference_close || !same(evidence.counts,r.counts) || !same(evidence.watchlist,r.watchlist)) fail('review/evidence claims mismatch');
  return { review: r, dir, review_path: rel, review_sha256: sha(fs.readFileSync(safe(root, rel))) };
}
function inventory(root, dirs, excluded = new Set()) {
  const result = {};
  function walk(rel) {
    const p = safe(root, rel);
    if (!fs.existsSync(p) || excluded.has(rel)) return;
    if (fs.statSync(p).isDirectory()) { for (const n of fs.readdirSync(p).sort()) walk(`${rel}/${n}`); }
    else result[rel] = sha(fs.readFileSync(p));
  }
  dirs.forEach(walk); return result;
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function escaped(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function publishReview({ root, reviewPath, target, now = new Date() }) {
  root = fs.realpathSync(root);
  if (!['status','api'].includes(target)) fail('invalid target');
  const validated = validateReview(root, reviewPath, now), r = validated.review;
  const metadata = { ...r, review_path: validated.review_path, review_sha256: validated.review_sha256, new_entries_allowed: false, scope: 'current_scanner_non_dtx', historical_data_unchanged: true };
  const base = `${validated.dir}/_publication`, manifestPath = `${base}/${target}-manifest.json`;
  const writes = new Map();
  if (target === 'status') {
    const rel = 'scanner/status/index.html', html = fs.readFileSync(safe(root,rel),'utf8');
    if (!/<body\b[^>]*>/i.test(html)) fail('status body missing');
    const banner = `\n<!-- scanner-publication-review:start --><aside id="scanner-publication-review" role="note" lang="fr" class="scanner-publication-review"><strong>Revue de surveillance du ${escaped(r.review_date)} — aucun nouvel ordre validé</strong><p>${escaped(r.headline)}. Cette revue ne valide aucune nouvelle entrée ni rotation du scanner. Les positions, performances et instantanés affichés conservent leurs dates historiques ; ils ne sont pas recalculés par cette publication. Les composants DTX sont exclus de cette revue.</p><a href="${escaped(r.article_url)}">Lire la revue et les contrôles encore manquants</a></aside><!-- scanner-publication-review:end -->\n`;
    const clean = html.replace(/\n?<!-- scanner-publication-review:start -->[\s\S]*?<!-- scanner-publication-review:end -->\n?/g, '');
    writes.set(rel, require('./scanner-review-live').freezeStatusHtml(clean.replace(/<body\b[^>]*>/i, m => m + banner)));
    writes.set('scanner/status/publication.json', JSON.stringify(metadata,null,2)+'\n');
  } else {
    const config = json(root,'data/modes-config.json').modes;
    if (!config || config.balanced?.assetClass === 'dtx') fail('invalid mode configuration/root alias');
    const apiRoot = safe(root,'portfolio/v1');
    const folders = ['', ...fs.readdirSync(apiRoot).filter(n => fs.lstatSync(path.join(apiRoot,n)).isDirectory())];
    for (const folder of folders) {
      if (folder && !Object.hasOwn(config,folder)) {
        if (['orders.json','signals.json','all.json'].some(n => fs.existsSync(safe(root, `portfolio/v1/${folder}/${n}`)))) fail(`unclassified API mode ${folder}`);
        continue;
      }
      if (folder && config[folder].assetClass === 'dtx') continue;
      for (const name of ['orders.json','signals.json','all.json']) {
        const rel = `portfolio/v1/${folder ? folder+'/' : ''}${name}`;
        if (!fs.existsSync(safe(root,rel))) continue;
        const out = suspendCurrentApi(json(root,rel), `${folder ? folder+'/' : ''}${name}`, config, metadata);
        writes.set(rel,JSON.stringify(out,null,2)+'\n');
      }
    }
    for (const name of ['status.json','modes.json']) {
      const rel = `portfolio/v1/${name}`;
      writes.set(rel,JSON.stringify(suspendCurrentApi(json(root,rel),name,config,metadata),null,2)+'\n');
    }
    writes.set('portfolio/v1/publication.json',JSON.stringify(metadata,null,2)+'\n');
  }
  const protectedDirs = ['data','scanner/status/history','scanner/status/engine-history.json','portfolio/v1',`${validated.dir}/signals.json`,`${validated.dir}/data.json`];
  const excluded = new Set([...writes.keys(),'portfolio/v1/publication.json']);
  // The other publication branch may run before or after this one. Exclude its
  // declared outputs from the durable baseline, while still checking its manifest.
  const otherManifestPath = `${base}/${target === 'api' ? 'status' : 'api'}-manifest.json`;
  let otherManifest = null;
  if (fs.existsSync(safe(root,otherManifestPath))) {
    otherManifest = json(root,otherManifestPath);
    if (otherManifest.review_sha256 !== validated.review_sha256) fail('other publication belongs to another review');
    for (const row of otherManifest.changed_files) {
      if (sha(fs.readFileSync(safe(root,row.path))) !== row.after_sha256 || (row.archive && sha(fs.readFileSync(safe(root,row.archive))) !== row.before_sha256)) fail('other publication/archive hash mismatch');
      excluded.add(row.path);
    }
  }
  const protectedBefore = inventory(root,protectedDirs,excluded);
  if (fs.existsSync(safe(root,manifestPath))) {
    const prior = json(root,manifestPath);
    if (prior.review_sha256 !== validated.review_sha256) fail('existing publication belongs to another review');
    const expectedProtected = Object.fromEntries(Object.entries(prior.protected_files).filter(([p]) => !excluded.has(p)));
    if (!same(expectedProtected,protectedBefore)) fail('historical/protected files changed since publication');
    for (const row of prior.changed_files) {
      if (sha(fs.readFileSync(safe(root,row.path))) !== row.after_sha256 || (row.before_sha256 !== null && sha(fs.readFileSync(safe(root,row.archive))) !== row.before_sha256)) fail('published output/archive hash mismatch');
    }
    return { ...prior, idempotent: true };
  }
  const changed = [];
  for (const [rel, value] of writes) {
    const p = safe(root,rel), before = fs.existsSync(p) ? fs.readFileSync(p) : null;
    const archive = before === null ? null : `${base}/archive/${target}/${rel}`;
    if (archive && fs.existsSync(safe(root,archive))) fail('unmanifested archive exists');
    changed.push({ path:rel, before_sha256:before === null ? null : sha(before), after_sha256:sha(value), archive, before });
  }
  // All inputs validated and every write planned before the first mutation.
  for (const row of changed) {
    if (row.archive) { const p=safe(root,row.archive); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,row.before,{flag:'wx'}); }
    const p=safe(root,row.path); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,writes.get(row.path));
  }
  const protectedAfter = inventory(root,protectedDirs,excluded);
  if (!same(protectedBefore,protectedAfter)) fail('protected history changed during publication');
  const manifest = { schema_version:1, target, review_path:validated.review_path, review_sha256:validated.review_sha256, processed_at:now.toISOString(), protected_files:protectedBefore, changed_files:changed.map(({before,...row})=>row), network_used:false, performance_recomputed:false };
  const p=safe(root,manifestPath); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}
function runCli(target, argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--publication-only') fail('usage: --publication-only scanner/YYYYMMDD/review.json (no other options)');
  const result = publishReview({root:path.resolve(__dirname,'../..'),reviewPath:argv[1],target});
  console.log(JSON.stringify({status:'review_only',target,changed_files:result.changed_files.map(x=>x.path),idempotent:!!result.idempotent}));
}
// Scope is the source scan date, not wall-clock expiry: an old basket stays suspended.
// A later certified edition follows the generators' existing controls; DTX is untouched.
function activePublication(root, scanDate, now = new Date()) {
  const reviews = [];
  for (const rel of ['scanner/status/publication.json','portfolio/v1/publication.json']) {
    if (!fs.existsSync(safe(root,rel))) continue;
    const meta = json(root,rel);
    if (typeof meta.review_path !== 'string') fail('publication sidecar missing review path');
    const v = validateReview(root,meta.review_path,now);
    if (meta.review_sha256 !== v.review_sha256 || meta.review_date !== v.review.review_date || meta.new_entries_allowed !== false) fail('publication sidecar integrity mismatch');
    reviews.push(v);
  }
  if (!reviews.length) return null;
  reviews.sort((a,b) => b.review.review_date.localeCompare(a.review.review_date));
  if (reviews.length > 1 && reviews[0].review.review_date === reviews[1].review.review_date && reviews[0].review_sha256 !== reviews[1].review_sha256) fail('conflicting current publication sidecars');
  const v=reviews[0];
  if (/^\d{8}$/.test(scanDate || '') && scanDate > v.review.review_date.replaceAll('-','')) return null;
  return {...v.review,review_path:v.review_path,review_sha256:v.review_sha256,new_entries_allowed:false,scope:'current_scanner_non_dtx',historical_data_unchanged:true};
}
function entryGate(root, scanDate, assetClass, now = new Date()) {
  return assetClass === 'dtx' || activePublication(root,scanDate,now) === null;
}
// Transform only current entry-facing endpoints. Never mode configuration or ledger facts.
function suspendCurrentApi(input, filename, config, metadata) {
  if (!metadata) return input;
  const match=/^(?:([a-zA-Z0-9_-]+)\/)?(orders|signals|all|status|modes)\.json$/.exec(filename);
  if (!match) return input;
  const folder=match[1], kind=match[2];
  const isDtx=id=>{if(!Object.hasOwn(config,id))fail(`unclassified API mode ${id}`);return config[id].assetClass==='dtx';};
  if (folder && isDtx(folder)) return input;
  if ((kind==='status'||kind==='modes') && folder) return input;
  const out=structuredClone(input);
  const suspendStatus=status=>{
    if (!status || typeof status!=='object' || Array.isArray(status)) fail(`missing API status ${filename}`);
    return {...status,acceptsNewEntries:false};
  };
  if (kind==='status') {
    if (!out.modes || typeof out.modes!=='object' || Array.isArray(out.modes)) fail('invalid status aggregate');
    for (const id of Object.keys(out.modes)) if(!isDtx(id)) out.modes[id]={...suspendStatus(out.modes[id]),publication_review:metadata};
  } else if (kind==='modes') {
    if (!Array.isArray(out.modes)) fail('invalid modes aggregate');
    out.modes=out.modes.map(m=>isDtx(m.id)?m:{...m,status:suspendStatus(m.status),orderCount:0,publication_review:metadata});
  } else {
    if (isDtx(folder||'balanced')) return input;
    if(kind!=='signals'){if(!Array.isArray(out.orders))fail(`missing orders ${filename}`);out.orders=[];}
    if(kind!=='orders'){if(!Array.isArray(out.signals))fail(`missing signals ${filename}`);out.signals=[];}
    out.status=suspendStatus(out.status);
  }
  out.publication_review=metadata;
  return out;
}
function applyCurrentApiGate(root, filename, input, scanDate, now = new Date()) {
  if(!/^(?:[a-zA-Z0-9_-]+\/)?(?:orders|signals|all|status|modes)\.json$/.test(filename)) return input;
  const config=json(root,'data/modes-config.json').modes;
  const folder=filename.includes('/')?filename.split('/')[0]:null;
  if(folder && config[folder]?.assetClass==='dtx') return input;
  return suspendCurrentApi(input,filename,config,activePublication(root,scanDate,now));
}
module.exports = { validateReview, publishReview, runCli, entryGate, applyCurrentApiGate, suspendCurrentApi, sha };
