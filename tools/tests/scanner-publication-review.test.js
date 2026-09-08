'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawnSync}=require('node:child_process');
const {validateReview,publishReview,entryGate,applyCurrentApiGate,sha}=require('../lib/scanner-publication-review');
const ROOT=path.resolve(__dirname,'../..'), now=new Date('2026-09-08T20:00:00Z');
function fixture(t) {
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'scanner-publication-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(rel,v)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2));return sha(fs.readFileSync(p));};
 const source=put('scanner/20260908/review-evidence.json',{product:'scanner_surveillance_evidence',reference_close:'2026-09-04',counts:{screened:105,histories_complete:24,histories_rejected:81,numeric_pass:15},watchlist:[{ticker:'CEG',status:'verification_pending'}]});
 const review={schema_version:1,product:'scanner_surveillance_review',review_date:'2026-09-08',reference_close:'2026-09-04',status:'review_only',actionability_certified:false,orders:[],excluded_components:['dtx'],article_url:'/scanner/20260908/',headline:'CEG, COP, XOM : surveillance, aucun nouvel ordre validé',counts:{screened:105,histories_complete:24,histories_rejected:81,numeric_pass:15},watchlist:[{ticker:'CEG',status:'verification_pending'}],validation_pending:['dividends','sec'],source_provenance:[{name:'scanner/20260908/review-evidence.json',sha256:source}],reviewed_at:'2026-09-08T00:00:00Z'};
 const reviewPath='scanner/20260908/review.json';put(reviewPath,review);
 put('data/modes-config.json',{modes:{balanced:{assetClass:'equity'},best:{assetClass:'dtx'}}});
 put('data/scanner-positions.json',{positions:[{ticker:'OLD',entry:4}]});
 put('scanner/20260908/signals.json',{signals:[{ticker:'OLD',entry:4}]});put('scanner/20260908/data.json',{setups:[{ticker:'OLD'}]});
 put('scanner/status/history/20260906.json',{date:'2026-09-06',scanDir:'20260901'});put('scanner/status/history/dates.json',['20260906']);
 put('scanner/status/engine-history.json',{dtx:'unchanged'});put('scanner/status/index.html','<!doctype html><html><body class="old"><main>Historical performance 4%</main></body></html>');
 const endpoint={updatedAt:'2026-09-06T08:00:00Z',date:'2026-09-06',scanDate:'20260901',status:{state:'live',acceptsNewEntries:true},orders:[{ticker:'OLD',action:'BUY',entry:4}],signals:[{ticker:'OLD',entry:4}],stats:{return:4},equityCurve:{d:['2026-09-06'],v:[104]},positions:[{ticker:'OPEN',entry:3}],trades:[{ticker:'CLOSED',pnl:3}]};
 for(const mode of ['', 'balanced/','best/']) for(const name of ['orders','signals','all','positions','trades','equity']) put(`portfolio/v1/${mode}${name}.json`,endpoint);
 put('portfolio/v1/status.json',{updatedAt:endpoint.updatedAt,modes:{balanced:endpoint.status,best:endpoint.status},recentTransitions:[{mode:'old',state:'stopped'}]});
 put('portfolio/v1/modes.json',{updatedAt:endpoint.updatedAt,date:endpoint.date,modes:['balanced','best'].map(id=>({id,status:endpoint.status,orderCount:1,positionCount:1,stats:endpoint.stats}))});
 put('portfolio/v1/docs/index.html','documentation');
 return {root,put,review,reviewPath,endpoint,run:target=>publishReview({root,reviewPath,target,now})};
}
function allFiles(root){const out={};function walk(rel){for(const n of fs.readdirSync(path.join(root,rel)).sort()){const p=path.join(rel,n);if(fs.statSync(path.join(root,p)).isDirectory())walk(p);else out[p]=sha(fs.readFileSync(path.join(root,p)));}}walk('');return out;}
test('publication changes only allowlisted current outputs; historical fields and byte archives preserved',t=>{
 const f=fixture(t), before=allFiles(f.root), a=f.run('api'), b=f.run('status'), after=allFiles(f.root);
 const allowed=new Set([...a.changed_files,...b.changed_files].map(x=>x.path));
 for(const [p,h]of Object.entries(before)) if(!allowed.has(p))assert.equal(after[p],h,p);
 for(const p of Object.keys(after)) if(!Object.hasOwn(before,p))assert.ok(allowed.has(p)||p.startsWith('scanner/20260908/_publication/'),p);
 for(const row of [...a.changed_files,...b.changed_files])if(row.archive)assert.equal(after[row.archive],row.before_sha256,row.path);
 const out=JSON.parse(fs.readFileSync(path.join(f.root,'portfolio/v1/all.json')));
 assert.deepEqual(out.orders,[]);assert.deepEqual(out.signals,[]);assert.equal(out.status.acceptsNewEntries,false);
 for(const k of ['updatedAt','date','scanDate','stats','equityCurve','positions','trades'])assert.deepEqual(out[k],f.endpoint[k],k);
 assert.equal(out.publication_review.review_date,'2026-09-08');
 assert.match(fs.readFileSync(path.join(f.root,'scanner/status/index.html'),'utf8'),/aucun nouvel ordre validé/);
 assert.equal(f.run('api').idempotent,true);assert.equal(f.run('status').idempotent,true);
});
for(const [name,mutate]of [
 ['order',r=>r.orders.push({ticker:'CEG'})],['quantity',r=>r.watchlist[0].qty=4],['trade level',r=>r.watchlist[0].entry=4],['score',r=>r.watchlist[0].score=99],['probability',r=>r.probability=.8],['certification',r=>r.actionability_certified=true],['future',r=>r.review_date='2026-09-09'],['reference mismatch',r=>r.reference_close='2026-09-03'],['directory mismatch',r=>r.article_url='/scanner/20260907/'],['invalid date',r=>r.reference_close='2026-02-30'],['future reviewed_at',r=>r.reviewed_at='2099-01-01T00:00:00Z'],['counts',r=>r.counts.histories_rejected=80],['DTX included',r=>r.excluded_components=[]],['missing evidence',r=>r.source_provenance=[]]
])test(`reject ${name} before writes`,t=>{const f=fixture(t);mutate(f.review);f.put(f.reviewPath,f.review);const before=allFiles(f.root);assert.throws(()=>f.run('api'));assert.deepEqual(allFiles(f.root),before);});
test('source hash tampering rejected',t=>{const f=fixture(t);f.put('scanner/20260908/review-evidence.json',{tampered:true});assert.throws(()=>f.run('api'),/hash mismatch/);});
test('preservation manifest rejects later historical tampering',t=>{const f=fixture(t);f.run('api');f.put('data/scanner-positions.json',{tampered:true});assert.throws(()=>f.run('api'),/protected files changed/);});
test('archive and current-output tampering rejected',t=>{const f=fixture(t),m=f.run('api');f.put(m.changed_files[0].archive,'tampered');assert.throws(()=>f.run('api'),/archive hash mismatch/);});
test('unknown API mode with current endpoints fails closed',t=>{const f=fixture(t);f.put('portfolio/v1/unknown/orders.json',f.endpoint);assert.throws(()=>f.run('api'),/unclassified/);});
test('symlink cannot alias protected data',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.root,'portfolio/v1/orders.json'));fs.symlinkSync(path.join(f.root,'data/scanner-positions.json'),path.join(f.root,'portfolio/v1/orders.json'));assert.throws(()=>f.run('api'),/symlink/);});
test('normal entry gate blocks both old and review-date baskets, preserves future edition and DTX',t=>{const f=fixture(t);assert.equal(entryGate(f.root,'20260908','equity',now),true);f.run('api');for(const d of ['20260901','20260908',''])assert.equal(entryGate(f.root,d,'equity',now),false);assert.equal(entryGate(f.root,'20260909','equity',now),true);assert.equal(entryGate(f.root,'20260908','dtx',now),true);f.put('portfolio/v1/publication.json',{review_path:f.reviewPath,review_sha256:'bad'});assert.throws(()=>entryGate(f.root,'20260908','equity',now),/integrity/);});
test('both CLI branches exit before business imports/auth/network; no other flags accepted',t=>{
 const f=fixture(t);f.review.reviewed_at='2026-09-08T00:00:00Z';f.put(f.reviewPath,f.review);
 for(const file of ['gen-status-page.js','gen-api.js'])f.put('tools/'+file,fs.readFileSync(path.join(ROOT,'tools',file),'utf8'));
 f.put('config/us-market-calendar.json',fs.readFileSync(path.join(ROOT,'config/us-market-calendar.json'),'utf8'));
 for(const file of ['scanner-publication-review.js','scanner-review-live.js','market-calendar.js'])f.put('tools/lib/'+file,fs.readFileSync(path.join(ROOT,'tools/lib',file),'utf8'));
 f.put('guard.js',`const M=require('module'),old=M._load;M._load=function(n,...args){if(['https','http','net','tls'].includes(n)||/mode-status|mcp|auth|token|mode-stats|scanner-scope/.test(n))throw Error('FORBIDDEN '+n);return old.call(this,n,...args)};global.fetch=()=>{throw Error('FORBIDDEN fetch')};`);
 for(const file of ['gen-status-page.js','gen-api.js']){const p=spawnSync(process.execPath,['--require',path.join(f.root,'guard.js'),path.join(f.root,'tools',file),'--publication-only',f.reviewPath],{cwd:f.root,encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
 const p=spawnSync(process.execPath,[path.join(f.root,'tools/gen-api.js'),'--publication-only',f.reviewPath,'--refresh'],{cwd:f.root,encoding:'utf8'});assert.notEqual(p.status,0);assert.match(p.stderr,/no other options/);
});

test('status then API order remains repeatable and byte-stable',t=>{const f=fixture(t);f.run('status');f.run('api');const before=allFiles(f.root);assert.equal(f.run('status').idempotent,true);assert.equal(f.run('api').idempotent,true);assert.deepEqual(allFiles(f.root),before);});
test('internally consistent invented counts still fail evidence binding',t=>{const f=fixture(t);f.review.counts.histories_complete++;f.review.counts.histories_rejected--;f.put(f.reviewPath,f.review);assert.throws(()=>f.run('api'),/evidence claims mismatch/);});

test('aggregate status/modes suspended with exact DTX objects, dates and statistics preserved',t=>{
 const f=fixture(t), read=n=>JSON.parse(fs.readFileSync(path.join(f.root,'portfolio/v1',n)));
 const status=read('status.json'),modes=read('modes.json'),m=f.run('api');
 const so=read('status.json'),mo=read('modes.json');
 assert.equal(so.modes.balanced.acceptsNewEntries,false);assert.deepEqual(so.modes.best,status.modes.best);
 assert.equal(mo.modes[0].status.acceptsNewEntries,false);assert.equal(mo.modes[0].orderCount,0);assert.deepEqual(mo.modes[1],modes.modes[1]);
 assert.deepEqual(mo.modes[0].stats,modes.modes[0].stats);assert.equal(mo.modes[0].positionCount,1);
 assert.equal(so.updatedAt,status.updatedAt);assert.equal(mo.date,modes.date);assert.deepEqual(so.recentTransitions,status.recentTransitions);
 for(const name of ['status.json','modes.json'])assert.ok(m.changed_files.find(x=>x.path==='portfolio/v1/'+name&&x.archive));
});
test('normal generator final write guard cannot re-promote signals, orders or current permissions',t=>{
 const f=fixture(t);f.run('api');
 const code=fs.readFileSync(path.join(ROOT,'tools/gen-api.js'),'utf8');
 const start=code.indexOf('function write(filename, content) {'),end=code.indexOf('\n}',start)+2;
 assert.ok(start>0&&end>start);
 const vm=require('node:vm'), requireFromGenerator=require('node:module').createRequire(path.join(ROOT,'tools/gen-api.js'));
 const ctx={require:requireFromGenerator,ROOT:f.root,OUT:path.join(f.root,'portfolio/v1'),fs,path,scanDir:'20260908',console:{log(){}}};
 vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);
 for(const name of ['orders.json','signals.json','all.json','balanced/orders.json','balanced/signals.json','balanced/all.json']){
   ctx.write(name,f.endpoint);const out=JSON.parse(fs.readFileSync(path.join(ctx.OUT,name)));
   assert.equal(out.status.acceptsNewEntries,false,name);if(name.endsWith('orders.json')||name.endsWith('all.json'))assert.deepEqual(out.orders,[],name);if(name.endsWith('signals.json')||name.endsWith('all.json'))assert.deepEqual(out.signals,[],name);
   assert.deepEqual(out.positions,f.endpoint.positions);assert.equal(out.date,f.endpoint.date);
 }
 for(const name of ['status.json','modes.json']){
  const archived=JSON.parse(fs.readFileSync(path.join(f.root,'scanner/20260908/_publication/archive/api/portfolio/v1',name)));ctx.write(name,archived);
  const out=JSON.parse(fs.readFileSync(path.join(ctx.OUT,name)));
  if(name==='status.json'){assert.equal(out.modes.balanced.acceptsNewEntries,false);assert.deepEqual(out.modes.best,archived.modes.best);}else{assert.equal(out.modes[0].orderCount,0);assert.equal(out.modes[0].status.acceptsNewEntries,false);assert.deepEqual(out.modes[1],archived.modes[1]);}
 }
 assert.strictEqual(applyCurrentApiGate(f.root,'all.json',f.endpoint,'20260909',now),f.endpoint);
 assert.strictEqual(applyCurrentApiGate(f.root,'best/all.json',f.endpoint,'20260908',now),f.endpoint);
 assert.strictEqual(applyCurrentApiGate(f.root,'positions.json',f.endpoint,'20260908',now),f.endpoint);
});
test('status banner uses stylesheet class without inline style',t=>{const f=fixture(t);f.run('status');const html=fs.readFileSync(path.join(f.root,'scanner/status/index.html'),'utf8');assert.match(html,/class="scanner-publication-review"/);assert.doesNotMatch(html,/<aside[^>]+style=/);});
