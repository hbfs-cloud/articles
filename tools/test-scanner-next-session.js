'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadNextSession, renderNextSession } = require('./lib/scanner-next-session');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-preview-test-'));
const date = '20260914', dir = `scanner/${date}`;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (p,v) => { fs.mkdirSync(path.dirname(path.join(root,p)), {recursive:true}); fs.writeFileSync(path.join(root,p), v); };
const signals = { scanDate:date, referenceClose:'2026-09-11', signals:[{ticker:'TEST',name:'<Test>',strategy:'Pullback',entry:10,stop:9,tp1:11,tp2:12,horizon:10, evidence:{source_artifact:`${dir}/source.json`,source_sha256:sha('{}')}}] };
signals.signals = Array.from({length:8}, (_,i)=>({...signals.signals[0],ticker:'TEST'+i}));
function seed() {
 write('data/scanner.json', JSON.stringify([`<a href="/${dir}/">scanner</a>`]));
 write(`${dir}/signals.json`, JSON.stringify(signals));write(`${dir}/index.html`, '<html>Fixture</html>');write(`${dir}/source.json`, '{}');
 for (const role of ['senior','contrarian','retail']) write(`${dir}/reviews/${role}.md`, sha(JSON.stringify(signals))+' '+sha('<html>Fixture</html>'));
}
try {
 seed();
 for (const now of ['2026-09-12T22:46:00Z','2026-09-13T00:30:00Z','2026-09-13T22:00:00Z','2026-09-14T00:30:00Z']) {
  const p=loadNextSession(root,new Date(now));assert.equal(p.state,'preview_non_executable');assert.equal(p.new_entries_allowed,false);assert.equal(p.scan_date,date);assert.equal(p.reference_close,'2026-09-11');assert(!('orders' in p));assert(!('action' in p.candidates[0]));
  assert(renderNextSession(p).includes('&lt;Test&gt;'));assert(!renderNextSession(p).includes('data-sig-ticker'));
 }
 assert.equal(loadNextSession(root,new Date('2026-09-14T12:00:00Z')),null);
 write('data/scanner.json',JSON.stringify(['<a href="/scanner/20260912/">old</a>']));assert.equal(loadNextSession(root,new Date('2026-09-13T12:00:00Z')),null);
 write('data/scanner.json',JSON.stringify(['<a href="/scanner/20260915/">future</a>']));assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/next US session/);
 seed();write(`${dir}/source.json`,'changed');assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/evidence mismatch/);
 seed();write(`${dir}/reviews/retail.md`,'unbound');assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/unbound retail/);
 seed();write(`${dir}/signals.json`,JSON.stringify({...signals,referenceClose:'2026-09-10'}));assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/reference close mismatch/);
 seed(); const original=signals.signals;signals.signals=[...original,...original.slice(0,2).map((s,i)=>({...s,ticker:'OK'+i}))];seed();assert.equal(loadNextSession(root,new Date('2026-09-13T12:00:00Z')).candidates.length,10);signals.signals=original;
 seed(); const backup=signals.signals; signals.signals=[...backup,...backup.slice(0,3).map((s,i)=>({...s,ticker:'EXTRA'+i}))];seed();assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/missing candidates/);signals.signals=backup;
 seed(); signals.signals[0].classification={source_report:'.agent/report.json',source_sha256:sha('{}')};seed();write(`${dir}/primaries/source-reports/${sha('{}')}.json`,'changed');assert.throws(()=>loadNextSession(root,new Date('2026-09-13T12:00:00Z')),/evidence mismatch/);delete signals.signals[0].classification;
 seed();write(`${dir}/review.json`,'{}');assert.equal(loadNextSession(root,new Date('2026-09-13T12:00:00Z')),null);
 console.log('scanner next-session preview: PASS (weekend, NY boundary, published-only, dates, hashes, review-only, no execution)');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
