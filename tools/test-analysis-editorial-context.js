'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'analysis-editorial-context-'));
// A fixture need not pass unrelated density checks: exercise only these gates.
const base={meta:{status:'no-trade',levelsCloseDate:'2026-09-18'},header:{ticker:'TEST'},tradeIdea:{status:'no-trade',archiveReferenceClose:'2026-08-27',statusNote:'Archive historique : aucun ordre actif.',entry:10,stop:9,tp1:12,rr:'1:2.00',stopPct:'-10%',tp1Pct:'20%'},insiders:{sourceRefs:[{name:'Marketdata',url:'https://mcp.dailytickers.com/mcp'},{name:'SEC Form 4',url:'https://www.sec.gov/Archives/ownership.xml'}]},fundamentals:{rows:[{metric:'EV/revenus',value:'4x',signal:'Enterprise value, comptes 2026',comparison:'Versus multiple historique',source:'Marketdata MCP'}]}};
function run(d){const p=path.join(tmp,'TEST.json');fs.writeFileSync(p,JSON.stringify(d));return cp.spawnSync(process.execPath,[path.join(root,'tools/check-analysis-editorial-quality.js'),'--strict','--pre-review',p],{encoding:'utf8'}).stdout;}
let out=run(base);
assert(!out.includes('does not cite its own'), 'inactive dated archive need not promote historical levels in current thesis');
assert(!out.includes('archived trade must'), 'archive qualification accepted');
assert(!out.includes('insiders section lacks a market source distinct'), 'SEC supplements an actual market source');
assert(!out.includes('valuation lacks a peer'), 'rendered comparison field counts as context');
let d=structuredClone(base);d.tradeIdea.status='active';out=run(d);assert(out.includes('trade thesis does not cite its own entry'), 'active trade retains numeric thesis requirement');
d=structuredClone(base);d.tradeIdea.archiveReferenceClose='2026-09-18';assert(run(d).includes('trade thesis does not cite its own entry'), 'current levels cannot impersonate old archive');
d=structuredClone(base);d.tradeIdea.statusNote='Historical archive';assert(run(d).includes('archived trade must'), 'archive must explicitly state inactive');
d=structuredClone(base);d.tradeIdea.rr='1:5';assert(run(d).includes('published R/R does not match'), 'archive geometry still validated');
d=structuredClone(base);d.insiders.sourceRefs.shift();assert(run(d).includes('insiders section lacks a market source distinct'), 'SEC alone cannot replace market source');
fs.rmSync(tmp,{recursive:true,force:true});console.log('PASS analysis editorial contextual gates');
