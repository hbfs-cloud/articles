#!/usr/bin/env node
'use strict';
// Create a truthful external-source run journal around an actual offline recomputation.
// No MCP source, health, source ownership or publication gate is relabelled by this tool.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {stableStringify}=require('./lib/workflow-contract');
const ROOT=path.resolve(__dirname,'..'),out=process.argv[2],artifact=process.argv[3];
if(!out||!artifact){console.error('Usage: node tools/eur-evidence.js <external-dir> <article-path>');process.exit(2);}
const abs=path.resolve(ROOT,out),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(abs,f),'utf8'));
const study=read('study.json'),ref=study.spec.reference_close,capture=new Date().toISOString();
const files=['study.json','universe-resolved.json','facts.json','event-reactions.json'];
const calls=files.map(file=>({as:path.basename(file,'.json'),server:'local-external-evidence',tool:file==='study.json'?'eur-opportunities.study':'reviewed-archive-import',args:{file:path.join(out,file)},freshness:{required:true}}));
const plan={schema_version:'eur-external-evidence.v1',workflow:'eur-opportunities',artifact,reference_close:ref,
 authorization:{source_instruction:'trouve des sources alternatives a notre mcp et continue svp',recurring_instruction:'ce travail sera a faire regulierement, generer un article pour les bonnes affaires euro, donc fait des skills, scripts, etc... reutilisable',scope:'EUR opportunities only; no change to other MCP workflow contracts'},
 note:'Replay plan created before this offline run. Original HTTPS captures retain their actual earlier timestamps and journals. Imports are reviewed local archives, not new network requests or MCP certification.',waves:[{name:'external-replay',calls}]};
const planPath=path.join(out,'plan.json');fs.writeFileSync(path.join(ROOT,planPath),JSON.stringify(plan,null,2)+'\n');const planHash=sha(fs.readFileSync(path.join(ROOT,planPath)));
const resolved={artifact,reference_close:ref,as_of_timestamp:capture,waves:plan.waves},inputHash=sha(Buffer.from(stableStringify(resolved)));
const result=cp.spawnSync('python3',['tools/eur-opportunities.py','study','--out',out,'--refdate',ref,'--anchor',study.spec.anchor],{cwd:ROOT,encoding:'utf8'});
if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}
const outputs=files.map((file,i)=>({...calls[i],ok:true,output_sha256:sha(fs.readFileSync(path.join(abs,file))),completed_at:new Date().toISOString()}));
const common={contract_version:'eur-external-evidence.v1',workflow:'eur-opportunities',plan:planPath,plan_sha256:planHash,input_sha256:inputHash};
fs.writeFileSync(path.join(abs,'_collect.json'),JSON.stringify({...common,reference_date:ref,resolved_input:resolved,waves:[{name:'external-replay',calls:outputs}],status:'completed',original_collection_manifest:'universe-collection.json',original_collection_sha256:sha(fs.readFileSync(path.join(abs,'universe-collection.json')))},null,2)+'\n');
fs.writeFileSync(path.join(abs,'harness.json'),JSON.stringify({...common,artifact,reference_close:ref,generated_at:new Date().toISOString(),sources:outputs.map(x=>({name:x.as,sha256:x.output_sha256,required:true,reference_close:ref,as_of:capture,note:x.tool})),scope:'External research arithmetic and archive provenance. Not calibrated future probabilities or a standard daily MCP run.'},null,2)+'\n');
console.log(`External replay provenance: ${files.length} bound artifacts; ${ref}`);
