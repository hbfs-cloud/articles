'use strict';
// Reuses the project's calendar/OHLCV contract and the log-return OLS formula
// already used by build-avgo-analysis.js. No interpolation or gap bridging.
const fs=require('fs'),crypto=require('crypto');
const {normalizeBars,EQUITY_CALENDAR}=require('../../../tools/lib/mcp-daily-bars');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const paths=['analyses/TSM/_data/bars.json','analyses/TSM/_data/comparison_bars.json'];
const inputs=paths.map(path=>({path,sha256:hash(fs.readFileSync(path))}));
const targetRaw=JSON.parse(fs.readFileSync(paths[0])).results[0].data[0];
const comps=JSON.parse(fs.readFileSync(paths[1])).data.items[0].results[0].data;
const ref='2026-09-11',start='2026-03-15';
const target=normalizeBars({...targetRaw,bars:targetRaw.bars.filter(r=>r[0]>=start&&r[0]<=ref)},'TSM',EQUITY_CALENDAR);
const targetByDate=new Map(target.map(r=>[r.date,r.close]));
function performance(raw,n){const recent=raw.bars.slice(-(n+1));try{const rows=normalizeBars({...raw,bars:recent},raw.symbol,EQUITY_CALENDAR);if(rows.length!==n+1||rows.at(-1).date!==ref)throw Error('Insufficient completed window');return {value:(rows.at(-1).close/rows[0].close-1)*100,start:rows[0].date,end:ref,observations:n};}catch(e){return {value:null,error:e.message}}}
function regression(raw){const filtered=raw.bars.filter(r=>r[0]>=start&&r[0]<=ref);let rows;try{rows=normalizeBars({...raw,bars:filtered},raw.symbol,EQUITY_CALENDAR)}catch(e){return {correlation:null,beta:null,r2:null,observations:null,status:'UNAVAILABLE',reason:e.message}}
 if(rows.at(-1).date!==ref||rows.length!==target.length||rows.some((r,i)=>r.date!==target[i].date))return {status:'UNAVAILABLE',reason:'Common calendar window differs',correlation:null,beta:null,r2:null,observations:null};
 const pairs=rows.slice(1).map((r,i)=>({y:Math.log(r.close/rows[i].close),x:Math.log(targetByDate.get(r.date)/targetByDate.get(rows[i].date))}));
 if(pairs.length<60)return {status:'UNAVAILABLE',reason:'Fewer than 60 returns',observations:pairs.length,correlation:null,beta:null,r2:null};
 const mean=k=>pairs.reduce((s,r)=>s+r[k],0)/pairs.length,mx=mean('x'),my=mean('y');
 const cov=pairs.reduce((s,r)=>s+(r.x-mx)*(r.y-my),0),vx=pairs.reduce((s,r)=>s+(r.x-mx)**2,0),vy=pairs.reduce((s,r)=>s+(r.y-my)**2,0);
 const c=cov/Math.sqrt(vx*vy);return {status:'PASS',correlation:c,beta:cov/vx,r2:c*c,observations:pairs.length,start:rows[0].date,end:ref};
}
const result={kind:'independent_comparison_audit',ticker:'TSM',referenceClose:ref,inputs,formula:'OLS comparator log returns on TSM log returns; beta=cov(y,x)/var(x), R2=Pearson correlation squared. Complete identical US sessions required. No filling missing rows.',reference:{return5d:performance(targetRaw,5),return21d:performance(targetRaw,21)},comparisons:comps.map(r=>({ticker:r.symbol,return5d:performance(r,5),return21d:performance(r,21),...regression(r)}))};
fs.writeFileSync('analyses/TSM/_review/parent-comparison-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
