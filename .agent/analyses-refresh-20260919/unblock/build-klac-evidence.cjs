'use strict';
// Numeric provenance for the local KLAC revision. This does not satisfy the full source/AQ gates.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),run='analyses/KLAC/_runs/20260919-update',revision=run+'/revision';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const esc=s=>String(s).replace(/~/g,'~0').replace(/\//g,'~1');
const get=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const a=read(revision+'/KLAC.json'),diagnostic=read(revision+'/calculations.json');
const primary=read(run+'/primary/annual-documents.json');
primary[1].alternate_url='https://ir.kla.com/sec-filings/all-sec-filings/content/0000319201-26-000024/exhibit991earningsrelease7.htm';
const index=fs.readFileSync(path.join(root,run,'primary/INDEX.md'),'utf8');
for(const line of index.split('\n').filter(s=>/^\| 2026-/.test(s))){const c=line.split('|').slice(1,-1).map(s=>s.trim());const doc={date:c[0],form:c[1],accession:c[2],path:run+'/primary/'+c[3].replace(/`/g,''),url:c[4].match(/\(([^)]+)\)/)[1],sha256:c[5].replace(/`/g,'')}; const existing=primary.find(x=>x.accession===doc.accession); if(existing){for(const k of Object.keys(doc))if(existing[k]!==doc[k])throw Error('Conflicting primary index '+doc.accession+' '+k);}else primary.push(doc);}
for(const p of primary)if(sha(fs.readFileSync(path.join(root,p.path)))!==p.sha256)throw Error('Primary hash mismatch '+p.path);
const manifest={kind:'primary_sec_manifest_v1',ticker:'KLAC',as_of:'2026-09-19',inventory_count:28,inventory_screened_count:28,opened_count:primary.length,reviewed_count:primary.length,decision_relevant_count:primary.length,local_primary_count:primary.length,review_scope:'The 28 MCP-discovered post-10-K filings plus four separately reviewed annual/earnings/dividend/split documents. Not an exhaustive financing-capacity or EDGAR inventory.',documents:primary,semantic_findings:{recent_capital_review:{source_path:run+'/primary/KLAC-capital-update.md',source_sha256:sha(fs.readFileSync(path.join(root,run+'/primary/KLAC-capital-update.md'))),source_needles:['not** an exhaustive EDGAR','19 Form 4s and 9 Form 144s']}}};
write(revision+'/primary-manifest.json',manifest);
const judgments={ticker:'KLAC',score_components:diagnostic.score_components,judgments:{}};
const reasons={'meta.version':'Editorial revision identifier following preserved original; not a market statistic.','meta.date':'Local research completion date; distinct from the completed market close.','meta.dateDisplay':'French display of the editorial research date.','verdict.score':'Additive existing editorial policy: base, operating margin, ROE, valuation and concentration. Missing FCF input remains explicitly unscored; not a predictive or fully calibrated investment grade.','risks.riskScore':'Editorial midpoint on the established one-to-ten scale; profitable established issuer with valuation, concentration and execution risks. Qualitative judgment, not a probability.'};
for(const [p,reason] of Object.entries(reasons))judgments.judgments[p]={value:get(a,p),reason};
a.blastRadius.groups.forEach((g,i)=>judgments.judgments[`blastRadius.groups.${i}.order`]={value:g.order,reason:'Economic transmission classification: direct production chain versus indirect demand/market controls; no causal estimate.'});
write(revision+'/editorial-judgments.json',judgments);
const raw={},inputs=[];
function input(name,p,kind){raw[name]=read(p);const row={name,path:p,sha256:sha(fs.readFileSync(path.join(root,p)))};if(kind)row.kind=kind;inputs.push(row);return row;}
for(const n of ['status','bars','fundamentals','comparison_bars','comparison_context','sec_evidence'])input(n,run+'/data/'+n+'.json');
input('primary',revision+'/primary-manifest.json','primary_sec_manifest_v1');
input('judgments',revision+'/editorial-judgments.json','editorial_judgment');
input('archive','analyses/KLAC/_runs/20260919/original/KLAC.json','archived_analysis');
function find(o,predicate,p=''){if(predicate(o,p))return p;if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){const found=find(v,predicate,p+'/'+esc(k));if(found!==undefined)return found;}}
function facet(name,type,symbol){const p=find(raw[name],x=>x&&typeof x==='object'&&x.data_type===type&&Array.isArray(x.data));if(!p)throw Error('Missing facet '+name+' '+type);let v=p.split('/').slice(1).reduce((o,k)=>o[k],raw[name]);const i=symbol?v.data.findIndex(x=>x.symbol===symbol):0;if(i<0)throw Error('Missing symbol '+symbol);return p+'/data/'+i;}
const B=facet('bars','bars_daily','KLAC')+'/bars',F=facet('fundamentals','financials'),S=facet('fundamentals','stats');
const claims={},strings={},methods={};
function provenance(alias,pointer,method,others=[]){const input=inputs.find(i=>i.name===alias);if(!input)throw Error(alias);return {input_name:alias,input_path:input.path,input_sha256:input.sha256,source_pointer:pointer,method,...(others.length?{additional_inputs:others}: {})};}
const dependency=(name,pointer)=>({input_path:inputs.find(i=>i.name===name).path,input_sha256:inputs.find(i=>i.name===name).sha256,source_pointer:pointer});
function sourceFor(p,value){
 if(judgments.judgments[p])return provenance('judgments','/judgments/'+esc(p)+'/value',judgments.judgments[p].reason);
 if(p==='tradeIdea.archiveReferenceClose')return provenance('archive','/meta/levelsCloseDate','Exact reference close of the preserved proposal; never the current market close.');
 if(/^tradeIdea\.(entry|stop|tp1|tp2)$/.test(p))return provenance('archive','/'+p.replaceAll('.','/'),'Preserve exact historical level, explicitly inactive and not recomputed as a new order.');
 if(/^tradeIdea\.(stopPct|tp1Pct|tp2Pct|rr)$/.test(p))return {...provenance('archive','/tradeIdea','Ratios and percentage distances derived from the preserved historical entry, stop and respective targets at the displayed precision.'),derivation:'archived_trade_geometry'};
 // Bibliographic metadata points to the exact primary document, never a market-number fallback.
 const refMatch=p.match(/^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$/);
 if(refMatch){const ref=get(a,refMatch[1]+'.sourceRefs.'+refMatch[2]);if(ref.url==='https://mcp.dailytickers.com/mcp')return provenance('status','/captured_at','UTC collection date displayed for MCP source attribution.');const i=primary.findIndex(x=>[x.url,x.alternate_url].includes(ref.url));if(i<0)throw Error('Unmapped primary '+ref.url);return provenance('primary','/documents/'+i,'Primary document bibliographic date or address; not a market observation.');}
 if(/^news\.\d+\.(date|sourceUrl)$/.test(p)){const n=a.news[Number(p.split('.')[1])],i=primary.findIndex(x=>[x.url,x.alternate_url].includes(n.sourceUrl));if(i<0)throw Error('News primary missing');return provenance('primary','/documents/'+i,'Filing/publication date or original URL of the opened primary.');}
 if(/^filingsReview\.filings\.\d+\./.test(p)){const n=a.filingsReview.filings[Number(p.split('.')[2])],i=primary.findIndex(x=>x.accession===n.accession);if(i<0)throw Error('Filing missing');return provenance('primary','/documents/'+i,'Exact filing metadata for the archived document.');}
 if(p==='meta.lastMcpRefresh'||p==='blastRadius.observationTime')return provenance('status','/captured_at','End-of-collection timestamp from the hash-bound sibling harness; distinguish it from status capture and market close.');
 if(p==='meta.levelsCloseDate'||p==='blastRadius.asOf'||p==='disclaimer')return provenance('bars',B,'Last certified completed daily session; editorial disclaimer distinguishes observation date from close.');
 if(p==='blastRadius.window')return provenance('comparison_bars',facet('comparison_bars','bars_daily','AMAT')+'/bars','First and last common completed session of the comparison window.');
 if(/^blastRadius\.groups\.\d+\.symbols\.\d+\./.test(p)){
  const parts=p.split('.'),row=a.blastRadius.groups[parts[2]].symbols[parts[4]],field=parts[5];
  if(field==='eventRisk')return provenance('comparison_context',facet('comparison_context','calendar',row.ticker)+'/nextEarningsDate','Provider calendar date only, explicitly unconfirmed by issuer; no options-implied event probability.');
  return provenance('comparison_bars',facet('comparison_bars','bars_daily',row.ticker)+'/bars','Aligned daily log returns vs KLAC; Pearson correlation, covariance/variance beta of comparable on KLAC, squared correlation, 124 common returns; simple price return over last 5/21 sessions.',[dependency('bars',B)]);
 }
 if(p.startsWith('performance.windowReturns.')){const match=p.match(/rows\.(\d+)\.returnPct/);const ticker=match?a.performance.windowReturns.rows[match[1]].ticker:'KLAC';return provenance(ticker==='KLAC'?'bars':'comparison_bars',ticker==='KLAC'?B:facet('comparison_bars','bars_daily',ticker)+'/bars','100*(last close/close 21 sessions earlier-1), price only without dividend reinvestment; dates bound to those observations.');}
 if(p.startsWith('technicals.'))return provenance('bars',B,'300 contiguous completed sessions; EMA initialized with period-length SMA; Wilder recursive gain/loss and true range for RSI14/ATR14; MACD EMA12-EMA26 and EMA9 signal. Archived levels mentioned separately remain inactive.',[dependency('archive','/tradeIdea')]);
 const barsClaim=p==='header.price'||p==='header.changePct'||p==='header.metrics.volume'||p==='verdict.whyBuy.3'||p==='verdict.whyAvoid.0'||p==='verdict.whyAvoid.2'||p==='globalScore.keyTakeawaysNegative.0'||p==='globalScore.keyTakeawaysNegative.2';
 if(barsClaim)return provenance('bars',B,'Last close; daily change versus previous close; last volume scaled to millions; volume ratio against previous 20 sessions; 21-session price return or Wilder RSI as named in the exact text.',[dependency('comparison_bars',facet('comparison_bars','bars_daily','SMH')+'/bars')]);
 if(p==='header.metrics.marketCap'||p==='header.metrics.evEbitda'||p==='verdict.summary'||p==='verdict.whyAvoid.1'||p==='globalScore.keyTakeawaysNegative.1')return provenance('fundamentals',F,'Capitalization=completed close*current shares; EV=capitalization+debt-cash; EV/EBITDA and PE=capitalization/(revenue*net margin), rounded as shown. Summary returns and volume derive from aligned bars. Undated provider denominators explicitly qualified.',[dependency('fundamentals',S),dependency('bars',B),dependency('comparison_bars',facet('comparison_bars','bars_daily','SMH')+'/bars')]);
 if(p.startsWith('fundamentals.rows.')){
  const idx=Number(p.split('.')[2]); const keys=['totalRevenue','revenueGrowth','grossMargins','operatingMargins','profitMargins','ebitda','totalCash','totalDebt'];
  if(p.endsWith('.signal'))return provenance('status','/captured_at','Collection date qualification; accounting denominator date unknown, not invented.');
  if(p.endsWith('.comparison'))return provenance('comparison_context',facet('comparison_context','financials','AMAT'),'For AMAT and LRCX: (completed close*current shares+debt-cash)/EBITDA, same arithmetic; periods/mix not harmonized.',[dependency('comparison_context',facet('comparison_context','financials','LRCX')),dependency('comparison_context',facet('comparison_context','stats','AMAT')),dependency('comparison_context',facet('comparison_context','stats','LRCX')),dependency('comparison_bars',facet('comparison_bars','bars_daily','AMAT')+'/bars'),dependency('comparison_bars',facet('comparison_bars','bars_daily','LRCX')+'/bars')]);
  if(p.endsWith('.note'))return provenance('fundamentals',F,'Mechanical scenario: current EV/EBITDA*0.7 rounded to nearest 5x; scenario price=(multiple*EBITDA-debt+cash)/shares; downside=100*(scenario price/close-1). Not fair value or forecast.',[dependency('fundamentals',S),dependency('bars',B)]);
  if(idx<8)return provenance('fundamentals',F+'/'+keys[idx],'Current provider fundamental scaled to billions or percent and rounded as displayed; no accounting-period inference.');
  if(idx===9)return provenance('fundamentals',S+'/sharesOutstanding','Current provider shares divided by one billion and rounded to four decimals, not a diluted historical share count.');
  return provenance('fundamentals',F,'Net debt=debt-cash; capitalization=close*shares; EV=capitalization+net debt; EV/EBITDA, EV/revenue, and PE using provider net income proxy revenue*profit margin.',[dependency('fundamentals',S),dependency('bars',B)]);
 }
 if(p==='capitalStructure.sharesOutstanding')return provenance('fundamentals',S+'/sharesOutstanding','Current provider shares / one billion, four decimals.');
 if(p==='capitalStructure.shareHistory')return provenance('fundamentals',F,'Cash/debt scaled to billions and rounded; primary capital mechanisms are narrative, no missing MCP financial number replaced by web.');
 if(/^verdict\.whyBuy\.[012]$/.test(p)||/^globalScore\.keyTakeawaysPositive\.[012]$/.test(p)){const i=Number(p.split('.').at(-1));return provenance('fundamentals',F+'/'+['grossMargins','operatingMargins','revenueGrowth'][i],'Provider fraction multiplied by 100 and rounded as printed; period explicitly unspecified.');}
 if(p==='earnings.beatNote')return provenance('fundamentals',F,'Provider revenueGrowth and earningsGrowth multiplied by 100; no fiscal period/date invented; narrative release not treated as realized guidance.');
 if(/^risks\.riskCards\.0\.points\.[01]$/.test(p))return provenance('fundamentals',F,'Same EV/EBITDA arithmetic or provider revenueGrowth*100; qualitative risk implication without probability.',[dependency('fundamentals',S),dependency('bars',B)]);
 throw Error('No explicit provenance mapping: '+p+' '+value);
}
function walk(v,p=''){if(typeof v==='number'||typeof v==='string'&&/\d/.test(v)){claims[p]=sourceFor(p,v);methods[p]=claims[p].method;if(typeof v==='string')strings[p]=v;}else if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))walk(c,p?p+'.'+k:k);}
walk(a);
const analysisPath=revision+'/KLAC.json',analysisSha=sha(fs.readFileSync(path.join(root,analysisPath)));
const calculation={kind:'deterministic_analysis_calculation_v1',ticker:'KLAC',reference_close:'2026-09-18',analysis_sha256:analysisSha,generator_path:'.agent/analyses-refresh-20260919/unblock/build-klac.cjs',generator_sha256:sha(fs.readFileSync(path.join(root,'.agent/analyses-refresh-20260919/unblock/build-klac.cjs'))),evidence_generator_sha256:sha(fs.readFileSync(__filename)),inputs,score_components:diagnostic.score_components,valuation_scenario:diagnostic.valuation_scenario,values:a,string_numeric_claims:strings,methods,claim_provenance:claims,limitations:['Full source plan still fails required RankBeta.','Primary financing-capacity coverage not exhaustive.','No final AQ publication approval.']};
const calcPath=revision+'/numeric-evidence.json';write(calcPath,calculation);const calcSha=sha(fs.readFileSync(path.join(root,calcPath)));
write(revision+'/evidence.json',{ticker:'KLAC',reference_close:'2026-09-18',analysis_path:analysisPath,analysis_sha256:analysisSha,claims:Object.keys(claims).map(p=>({path:p,value:get(a,p),as_of:'2026-09-18',source_artifact:calcPath,source_sha256:calcSha,source_pointer:typeof get(a,p)==='number'?'/values/'+p.replaceAll('.','/'):'/string_numeric_claims/'+esc(p)}))});
console.log('KLAC evidence generated: '+Object.keys(claims).length+' numeric/text claims; full publication gates remain separate.');
