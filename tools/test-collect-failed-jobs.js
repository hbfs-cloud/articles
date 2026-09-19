#!/usr/bin/env node
'use strict';
// Offline integration: failed async diagnostics must survive collection, but
// must never become a successful source or a freshness proof.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'collect-failed-job-')));
try {
  fs.mkdirSync(path.join(root,'tools'),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'collect.js'),path.join(root,'tools/collect.js'));
  fs.copyFileSync(path.join(__dirname,'dtx-scan.js'),path.join(root,'tools/dtx-scan.js'));
  fs.cpSync(path.join(__dirname,'lib'),path.join(root,'tools/lib'),{recursive:true});
  fs.cpSync(path.join(__dirname,'../config'),path.join(root,'config'),{recursive:true});
  const failed={status:'failed',job_id:'offline-job',data:{items:[{type:'query_data',status:'failed',results:[{
    data_type:'options_chain',status:'failed',cells:[{symbol:'ALLR',status:'failed',error:'no expiration dates available for ALLR'}],data:[],
  }]}]}};
  fs.writeFileSync(path.join(root,'offline-guard.js'),`global.fetch=async(_url,options)=>{const q=JSON.parse(options.body);const name=q.params.name;if(!['QueryData','Jobs'].includes(name))throw Error('Unexpected call '+name);const value=name==='QueryData'?{status:'pending',job_id:'offline-job'}:${JSON.stringify(failed)};return {ok:true,status:200,text:async()=>JSON.stringify({jsonrpc:'2.0',id:q.id,result:{content:[{type:'text',text:JSON.stringify(value)}]}})}};`);
  fs.writeFileSync(path.join(root,'plan.json'),JSON.stringify({artifact:'test/index.html',waves:[{name:'options',calls:[{
    as:'options',server:'marketdata',tool:'QueryData',args:{types:'options_chain',symbols:'ALLR'},freshness:{required:true,max_age_h:24},
  }]}]}));
  const result=spawnSync(process.execPath,['--require',path.join(root,'offline-guard.js'),'tools/collect.js','--plan','plan.json','--out','out','--var','refdate=2026-09-18','--quiet'],{
    cwd:root,encoding:'utf8',env:{...process.env,MCP_TOKEN_MARKETDATA:'offline-test-token',MCP_TOKEN_MARKETDATA_EXPIRES_AT:new Date(Date.now()+600000).toISOString()},
  });
  assert.strictEqual(result.status,1,result.stdout+result.stderr);
  assert(fs.existsSync(path.join(root,'out/_collect.json')),result.stdout+result.stderr);
  const journal=JSON.parse(fs.readFileSync(path.join(root,'out/_collect.json'))),receipt=journal.waves[0].calls[0];
  assert.strictEqual(receipt.ok,false);assert.strictEqual(journal.failures,1);
  assert.match(receipt.error,/options_chain\[ALLR\]: no expiration dates/);
  assert.strictEqual(receipt.diagnostic_artifact,'options.failed.json');
  const diagnostic=fs.readFileSync(path.join(root,'out',receipt.diagnostic_artifact));
  assert.strictEqual(crypto.createHash('sha256').update(diagnostic).digest('hex'),receipt.diagnostic_sha256);
  assert.deepStrictEqual(JSON.parse(diagnostic),failed);
  assert.strictEqual(fs.existsSync(path.join(root,'out/options.json')),false);
  const harnessPath=path.join(root,'out/harness.json');
  if(fs.existsSync(harnessPath))assert.strictEqual(JSON.parse(fs.readFileSync(harnessPath)).sources.length,0);
  console.log('failed async collection diagnostics: PASS; source gate remains closed');
} finally {fs.rmSync(root,{recursive:true,force:true});}
