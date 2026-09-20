'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {run,assertTerminal,SECTORS,REFERENCES,DIRECT_CRYPTO_PROXIES,validateBeta,validateSectorBars,validateDirectCryptoBars,validateSecEvidence}=require('../gen-rotation-beta');
const cal=require('../lib/market-calendar');
const REF='2026-09-18', NOW='2026-09-20T08:30:00Z', CAL='us_equity_exchange_sessions';
function fixture(t) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'rotation-test-')));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'data'));
  fs.writeFileSync(path.join(root,'data/rotation-beta.json'),'OLD PUBLIC ROTATION');
  fs.mkdirSync(path.join(root,'portfolio/v1'),{recursive:true});
  fs.writeFileSync(path.join(root,'portfolio/v1/rotation.json'),'OLD PUBLIC API');
  return root;
}
function bars() {
  return {captured_at:NOW,results:[{cells:SECTORS.map(s=>({symbol:s.etf,status:'completed'})),data:SECTORS.map(s=>({
    symbol:s.etf,asset_calendar:CAL,expected_completed_end:REF,served_completed_end:REF,last_bar_complete:true,
    bars:Array.from({length:30},(_,i)=>[cal.addUSTradingDays(REF,i-29),100+i,101+i,99+i,100+i,10000]),
  }))}]};
}
function directBars() {
  const symbols=[...new Set(DIRECT_CRYPTO_PROXIES.flatMap(x=>[x.reference,x.symbol]))];
  return {captured_at:NOW,results:[{cells:symbols.map(symbol=>({symbol,status:'completed'})),data:symbols.map((symbol,j)=>({
    symbol,asset_calendar:symbol.endsWith('-USD')?'crypto_24_7_utc':CAL,expected_completed_end:REF,served_completed_end:REF,last_bar_complete:true,coverage:{complete:true,missing_ranges:[]},
    bars:(symbol.endsWith('-USD')?Array.from({length:93},(_,i)=>{const d=new Date(`${REF}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+i-92);return d.toISOString().slice(0,10)}):Array.from({length:63},(_,i)=>cal.addUSTradingDays(REF,i-62))).map(date=>{const i=(Date.parse(date)-Date.parse('2026-06-01'))/86400000,base=100+i+Math.sin(i*.7)*3,close=base*(1+j*.08);return[date,close,close,close,close,1000000];}),
  }))}]};
}
function directBatch(symbols) {const payload=directBars(),wanted=new Set(String(symbols).split(','));payload.results[0].cells=payload.results[0].cells.filter(x=>wanted.has(x.symbol));payload.results[0].data=payload.results[0].data.filter(x=>wanted.has(x.symbol));return payload;}
function beta(ref) {
  const themed={GLD:['AUGO','Materials','Gold'],SLV:['AYA','Materials','Silver'],'CL=F':['OBE','Energy','Oil & Gas Exploration & Production'],SMH:['COHU','Technology','Semiconductor Equipment & Materials']};
  const [symbol,sector,industry]=themed[ref]||['AAPL','Technology','Consumer Electronics'];
  return {captured_at:NOW,reference:ref,as_of:REF,window:'90d',rows:[{symbol,beta:1.5,correlation:0.8,r2:0.64,observations:60,last_price:100,dollar_adv_median:10000000,sector,industry}]};
}
function evidenceFetcher() {return async url=>{const cfg=DIRECT_CRYPTO_PROXIES.find(x=>x.evidence_url===url);return {bytes:Buffer.from(`<html>${cfg.symbol} ${cfg.evidence_term} ${'evidence '.repeat(200)}</html>`),captured_at:NOW,final_url:url};};}
function client(edit) {
  const calls=[];
  return {calls,canCallDirectly:()=>true,callTool:async(server,tool,args)=>{
    calls.push({server,tool,args});
    let value=tool==='GetStatus'?{captured_at:NOW,commit:'13a1b497',operation_readiness:{bars_daily_us_equity:{status:'ready',asset_calendar:CAL,expected_completed_end:REF,served_completed_end:REF}}}:tool==='QueryData'?(args.symbols===SECTORS.map(s=>s.etf).join(',')?bars():directBatch(args.symbols)):beta(args.reference);
    return edit?edit(value,tool,args):value;
  },awaitJob:async()=>{throw Error('unexpected job polling')},redactSecrets:s=>s};
}
const opts=(root,c)=>({root,client:c,fetchDocument:evidenceFetcher(),argv:['--out-dir','scanner/20260921/_rotation'],env:{REFDATE:REF,AS_OF_TIMESTAMP:NOW},now:new Date(NOW)});
function staging(root) {return path.join(root,'scanner/20260921/_rotation');}
function unchanged(root) {
  assert.equal(fs.readFileSync(path.join(root,'data/rotation-beta.json'),'utf8'),'OLD PUBLIC ROTATION');
  assert.equal(fs.readFileSync(path.join(root,'portfolio/v1/rotation.json'),'utf8'),'OLD PUBLIC API');
}
test('MCP-only full run stages all hashed sources; public outputs remain byte-identical',async t=>{
  const root=fixture(t), c=client();
  const output=await run(opts(root,c));
  assert.equal(c.calls.length,11); assert.ok(c.calls.every(c=>c.server==='marketdata'));
  const request=c.calls.find(c=>c.tool==='QueryData'&&c.args.source==='webull').args;
  assert.equal(request.completion_policy,'completed_only'); assert.equal(request.as_of_timestamp,NOW); assert.equal(request.end_date,undefined);
  assert.equal(output.result.sectors.length,11); assert.equal(output.result.references.length,7);assert.equal(output.result.direct_proxies.length,4);
  assert.equal(output.result.provenance.sources.length,15);assert.ok(output.result.direct_proxies.every(x=>x.evidence_sha256&&x.evidence_date<=REF));
  assert.equal(output.result.sectors[0].perf_1m,+((129/109-1)*100).toFixed(2));
  for(const source of output.result.provenance.sources) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(output.outDir,source.file))).digest('hex'),source.sha256);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output.outDir,'collection.json'))).status,'PASS');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(output.outDir,'plan.json'))).digest('hex'),output.result.provenance.plan_sha256);
  unchanged(root);
  await assert.rejects(run(opts(root,c)),/not empty/); assert.equal(c.calls.length,11);
});
test('missing token fails without network, staging or public mutation',async t=>{
  const root=fixture(t),c=client();c.canCallDirectly=()=>false;
  await assert.rejects(run(opts(root,c)),/token missing/);assert.equal(c.calls.length,0);assert.equal(fs.existsSync(staging(root)),false);unchanged(root);
});
test('failed or unavailable required sources retain captures and block output',async t=>{
  const root=fixture(t),c=client((value,tool)=>{if(tool==='QueryData')value.results[0].cells[0]={symbol:'XLK',status:'unavailable',rejection_reason:'missing exact close'};return value;});
  await assert.rejects(run(opts(root,c)),/unavailable/);
  assert.equal(c.calls.length,2);assert.equal(fs.existsSync(path.join(staging(root),'bars_sectors.json')),true);
  assert.equal(fs.existsSync(path.join(staging(root),'rotation-beta.json')),false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(staging(root),'_wf/rotation.json'))).blocking,true);unchanged(root);
});
test('each ETF must contain the exact close and contiguous completed sessions',()=>{
  for(const mutate of [p=>p.results[0].data[0].served_completed_end='2026-09-17',p=>p.results[0].data[0].last_bar_complete=false,
    p=>p.results[0].data[0].bars.pop(),p=>p.results[0].data[0].bars.splice(15,1),p=>p.results[0].data[0].bars[29][4]=null,
    p=>p.results[0].cells.pop()]) {const payload=bars();mutate(payload);assert.throws(()=>validateSectorBars(payload,REF));}
  const payload=bars();payload.results[0].data.reverse();assert.equal(validateSectorBars(payload,REF).length,11); // Symbol identity, not array position.
});
test('stale, mismatched, low-quality or empty beta results never become current output',()=>{
  for(const mutate of [p=>p.as_of='2026-09-17',p=>delete p.as_of,p=>p.reference='WRONG',p=>p.rows=[],p=>p.quality='insufficient',
    p=>p.rows[0].observations=29,p=>p.rows[0].r2=NaN,p=>p.rows[0].r2=.99,p=>p.rows[0].correlation=-0.9,p=>p.rows[0].dollar_adv_median=4999999]) {
    const payload=beta('BTC-USD');mutate(payload);assert.throws(()=>validateBeta(payload,REFERENCES[0],REF));
  }
});
test('published beta rows preserve the normalized observation count',()=>{
  const result=validateBeta(beta('BTC-USD'),REFERENCES[0],REF);
  assert.equal(result.rows[0].n_obs,60);
});
test('direct crypto proxies are recomputed from identified common-date bars',()=>{
  const rows=validateDirectCryptoBars(directBars(),REF);
  assert.deepEqual(rows.map(x=>`${x.key}:${x.symbol}`),['btc:ASST','eth:SBET','eth:BMNR','sol:DFDV']);
  assert.ok(rows.every(x=>x.n_obs>=50&&x.correlation>=.6&&x.dollar_adv_median>=2e6));
});
test('direct crypto bars reject false coverage, wrong calendars and malformed OHLCV',()=>{
  for(const mutate of [p=>p.results[0].data.find(x=>x.symbol==='ASST').bars.splice(10,1),p=>p.results[0].data.find(x=>x.symbol==='ASST').asset_calendar='bogus',p=>p.results[0].data.find(x=>x.symbol==='ASST').bars[5][2]=0]) {
    const payload=directBars();mutate(payload);assert.throws(()=>validateDirectCryptoBars(payload,REF));
  }
});
test('SEC evidence is point-in-time, identified and content-addressed',async()=>{
  const cfg=DIRECT_CRYPTO_PROXIES[0],document=await evidenceFetcher()(cfg.evidence_url);
  assert.equal(validateSecEvidence(document.bytes,cfg,REF),true);
  assert.throws(()=>validateSecEvidence(Buffer.from('truncated'),cfg,REF));
  assert.throws(()=>validateSecEvidence(Buffer.from(`<html>${cfg.symbol} ${'evidence '.repeat(200)}</html>`),cfg,REF));
});
test('a late beta failure preserves evidence but does not write a partial rotation',async t=>{
  const root=fixture(t),c=client((value,tool,args)=>{if(tool==='RankBeta'&&args.reference==='SMH')value.rows=[];return value;});
  await assert.rejects(run(opts(root,c)),/no qualified beta/);assert.equal(c.calls.length,11);
  assert.equal(fs.existsSync(path.join(staging(root),'beta_ai.json')),true);
  assert.equal(fs.existsSync(path.join(staging(root),'rotation-beta.json')),false);unchanged(root);
});
test('date or published output-path mismatch fails before network',async t=>{
  const root=fixture(t),c=client();
  await assert.rejects(run({...opts(root,c),env:{REFDATE:'2026-09-07',AS_OF_TIMESTAMP:NOW}}));
  await assert.rejects(run({...opts(root,c),argv:['--out-dir','data']}),/runtime staging/);
  await assert.rejects(run({...opts(root,c),argv:['--out-dir','scanner/20260922/_rotation']}),/runtime staging/);
  assert.equal(c.calls.length,0);unchanged(root);
});
test('async job is polled once via shared exhausted-pagination client',async t=>{
  const root=fixture(t),c=client();const original=c.callTool;let polls=0;
  c.callTool=async(...args)=>args[1]==='QueryData'&&args[2].symbols===SECTORS.map(s=>s.etf).join(',')?(c.calls.push({server:args[0],tool:args[1],args:args[2]}),{job_id:'stable-job',status:'pending'}):original(...args);
  c.awaitJob=async(server,id)=>{polls++;assert.equal(server,'marketdata');assert.equal(id,'stable-job');return bars();};
  await run(opts(root,c));assert.equal(polls,1);assert.equal(fs.existsSync(path.join(staging(root),'bars_sectors.initial.json')),true);unchanged(root);
});

test('completed GetStatus accepts running background work but still gates required readiness',async t=>{
  const root=fixture(t),c=client((value,tool)=>{if(tool==='GetStatus') {value.status='completed';value.capabilities=[{name:'sec_historical_rebuild',status:'running'},{name:'unrelated_old_job',status:'failed'}];}return value;});
  await run(opts(root,c)); assert.equal(c.calls.length,11); unchanged(root);
  const other=fixture(t),bad=client((value,tool)=>{if(tool==='GetStatus'){value.status='completed';value.capabilities=[{name:'sec_historical_rebuild',status:'running'}];value.operation_readiness.bars_daily_us_equity.status='not_ready';}return value;});
  await assert.rejects(run(opts(other,bad)),/not ready/);assert.equal(bad.calls.length,1);unchanged(other);
});
test('actual unfinished/error job envelopes and incomplete pagination remain rejected',()=>{
  for(const payload of [{status:'running',job_id:'j'}, {isError:true}, {status:'failed'},
    {status:'completed',pagination:{has_next:true}}, {status:'completed',data:{pagination:{has_next:true}}},
    {status:'completed',data:{items:[{job_id:'j',status:'pending'}]}}]) assert.throws(()=>assertTerminal(payload));
});

test('default compatibility refreshes both shared files only after every source passes',async t=>{
  const root=fixture(t),c=client();
  const output=await run({...opts(root,c),argv:[]});
  assert.equal(output.shared_updated,true);
  const staged=fs.readFileSync(path.join(output.outDir,'rotation-beta.json'),'utf8');
  assert.equal(fs.readFileSync(path.join(root,'data/rotation-beta.json'),'utf8'),staged);
  assert.equal(fs.readFileSync(path.join(root,'portfolio/v1/rotation.json'),'utf8'),staged);
  const other=fixture(t),bad=client((value,tool,args)=>{if(tool==='RankBeta'&&args.reference==='SMH')value.rows=[];return value;});
  await assert.rejects(run({...opts(other,bad),argv:[]}),/no qualified beta/);unchanged(other);
});

test('actual RankBeta dated-window format certifies the served end without an as_of alias',()=>{
  const payload=beta('BTC-USD');delete payload.as_of;payload.window='2026-06-20..2026-09-18';
  assert.equal(validateBeta(payload,REFERENCES[0],REF).asof,REF);
  for(const window of ['2026-06-20..2026-09-17','2026-06-20..2026-09-19','2026-09-18..2026-06-20','2026-02-30..2026-09-18','2026-06-20..2026-9-18','2026-06-20..2026-09-18 trailing']) {
    assert.throws(()=>validateBeta({...payload,window,as_of:REF},REFERENCES[0],REF));
  }
  for(const field of ['as_of','served_completed_end','data_through']) {
    assert.throws(()=>validateBeta({...payload,[field]:'2026-09-17'},REFERENCES[0],REF));
    assert.throws(()=>validateBeta({...payload,[field]:'2026-09-18-invalid'},REFERENCES[0],REF));
  }
});

test('complete RankBeta with null rows reports insufficient overlap, not a parser failure',async t=>{
  const empty={captured_at:NOW,type:'beta_ranking',reference:'SMH',window:'2026-06-20..2026-09-18',rows:null,analyzed:0,skipped_insufficient_overlap:5525,skipped_no_bars:73,universe_size:5599};
  assert.throws(()=>validateBeta(empty,REFERENCES.at(-1),REF),/no qualified beta proxies.*coverage\/overlap insufficient.*analyzed=0.*skipped_insufficient_overlap=5525/);
  const root=fixture(t),c=client((value,tool,args)=>tool==='RankBeta'&&args.reference==='SMH'?empty:value);
  await assert.rejects(run(opts(root,c)),/coverage\/overlap insufficient/);
  assert.equal(c.calls.length,11);
  assert.equal(fs.existsSync(path.join(staging(root),'beta_ai.json')),true);
  assert.equal(fs.existsSync(path.join(staging(root),'rotation-beta.json')),false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(staging(root),'collection.json'))).status,'BLOCKED');unchanged(root);
});
