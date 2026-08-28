#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ASOF = '2026-08-27';
const REFRESHED = new Date().toISOString();

const PLANS = {
  OKTA:{v:'Validated only on a pullback',lo:142,hi:144.38,s:130.82,sp:-9.39,t1:174.85,u1:21.11,r:2.25,c:'Test $142-$145, then reclaim $146 and VWAP',x:'15-minute close below $140; hard stop $130.82',q:76},
  AMZN:{v:'Watch; initial plan rejected',lo:254,hi:258,s:246.20,sp:-4.57,t1:276.39,u1:7.13,r:1.56,c:'Break $259.66, then hold the retest',x:'Below $246.20',q:64},
  TSM:{v:'Watch; target remains too distant',lo:423,hi:429,s:408.09,sp:-4.87,t1:465.73,u1:8.56,r:1.76,c:'Break $429.64 and hold VWAP',x:'Below $408.09',q:64},
  AMRZ:{v:'Wait for a new base',lo:43.94,hi:44.20,s:42.70,sp:-3.39,t1:46.38,u1:4.93,t2:47.42,r:1.45,r2:2.15,c:'Hold the pullback, reclaim $45.06; ideally $46.25',x:'Below $42.70',q:53},
  FSLR:{v:'Wait; trend is damaged',lo:208.42,hi:209.68,s:199.54,sp:-4.84,t1:224.68,u1:7.15,t2:232.08,r:1.48,r2:2.21,c:'Reclaim $213.20 and VWAP',x:'Below $199.54',q:48},
  GEN:{v:'Wait; stop sits inside normal noise',lo:30.53,hi:30.74,s:29.74,sp:-3.25,t1:32.17,u1:4.65,t2:32.85,r:1.43,r2:2.11,c:'Break $30.74, then hold a $30.50 retest',x:'Below $29.74',q:51},
  DINO:{v:'Wait for a new pivot',lo:97.10,hi:97.78,s:93.92,sp:-3.95,t1:103.58,u1:5.93,t2:106.20,r:1.50,r2:2.18,c:'Break above $98.44',x:'Below $93.92',q:53},
  CNC:{v:'Wait; insider flow is negative',lo:64.90,hi:65.70,s:61.96,sp:-5.69,t1:72.06,u1:9.68,r:1.70,c:'Reclaim $66.21 and VWAP',x:'Below $61.96',q:49},
  ARWR:{v:'Wait for regular-session confirmation',lo:88,hi:89.20,s:83.68,sp:-6.19,t1:98.40,u1:10.31,r:1.67,c:'Break $89.59 with confirmed volume',x:'Below $83.68',q:54},
  BHVN:{v:'Speculative; first target does not pay enough',lo:14.34,hi:14.34,s:12.60,sp:-12.13,t1:16.74,u1:16.70,t2:17.28,r:1.38,r2:1.69,c:'15-minute reversal around $14.20-$14.50',x:'Below $12.60',q:38},
  DHT:{v:'Wait; first resistance is too close',lo:19.20,hi:19.55,s:18.23,sp:-6.75,t1:21.60,u1:10.49,r:1.55,c:'Break $19.565, then hold the retest',x:'Below $18.23',q:53},
  ELVN:{v:'Wait; flows conflict',lo:60.20,hi:60.80,s:57.05,sp:-6.17,t1:67.39,u1:10.84,r:1.76,c:'Break above $61.80',x:'Below $57.05',q:52},
  IBKR:{v:'Rejected at current levels',lo:96.65,hi:97.32,s:94.12,sp:-3.29,t1:101.81,u1:4.61,t2:104.07,r:1.40,r2:2.11,c:'Break $97.34, then hold the retest',x:'Below $94.12; conventional financial business',q:36},
  CRWD:{v:'Wait for post-earnings digestion',lo:207.58,hi:207.58,s:180.79,sp:-12.90,t1:229.08,u1:10.36,r:0.80,c:'Pull back to $203-$208, then reclaim $208',x:'Below $180.79',q:45},
  VG:{v:'Rejected; stop sits inside normal noise',lo:14.49,hi:14.60,s:13.90,sp:-4.79,t1:15.66,u1:7.26,t2:16.17,r:1.51,r2:2.24,c:'Break above $14.73',x:'Below $13.90',q:39},
  NBTX:{v:'Rejected',lo:40.49,hi:40.49,s:35.87,sp:-11.41,t1:45.74,u1:12.96,r:1.14,c:'Pull back, then reclaim $40.50',x:'Below $35.87',q:31}
};
const TRIGGERS = {OKTA:146,AMZN:259.66,TSM:429.64,AMRZ:45.06,FSLR:213.20,GEN:30.74,DINO:98.44,CNC:66.21,ARWR:89.59,BHVN:14.50,DHT:19.565,ELVN:61.80,IBKR:97.34,CRWD:208,VG:14.73,NBTX:40.50};
const VERSIONS = {AMZN:3,TSM:3,IBKR:2};

const num = v => v === null || v === undefined || v === '' ? null : Number.isFinite(+v) ? +v : null;
const positive = (...values) => values.map(num).find(v => v !== null && v > 0) ?? null;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const px = v => num(v) === null ? 'N/A' : '$'+num(v).toFixed(2);
const money = v => {
  v=num(v); if(v===null)return 'N/A'; const a=Math.abs(v);
  if(a>=1e12)return '$'+(v/1e12).toFixed(2)+'T';
  if(a>=1e9)return '$'+(v/1e9).toFixed(2)+'B';
  if(a>=1e6)return '$'+(v/1e6).toFixed(1)+'M';
  return '$'+v.toLocaleString('en-US',{maximumFractionDigits:0});
};
const qty = v => {
  v=num(v); if(v===null)return 'N/A';
  if(Math.abs(v)>=1e9)return (v/1e9).toFixed(2)+'B';
  if(Math.abs(v)>=1e6)return (v/1e6).toFixed(1)+'M';
  return v.toLocaleString('en-US',{maximumFractionDigits:0});
};
const pct = (v,scale=100) => num(v)===null?'N/A':(num(v)*scale).toFixed(1)+'%';
const load = f => { try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return {};} };
const at = (a,t) => a.find(x=>x&&x.type===t)||{};
const qresults = (t,f) => {
  const j=load(path.join(ROOT,'analyses',t,'_data',f));
  return j.data?.items?.flatMap(x=>x.results||[])||j.results||[];
};
const qtype = (t,f,k) => {
  const r=qresults(t,f).find(x=>x.data_type===k);
  return Array.isArray(r?.data)?r.data:[];
};
const csv = lines => {
  if(!Array.isArray(lines)||lines.length<2||typeof lines[0]!=='string')return [];
  const h=lines[0].split(',');
  return lines.slice(1).map(s=>Object.fromEntries(h.map((k,i)=>[k,String(s).split(',')[i]])));
};
const refs = t => [
  {name:'Company filings — SEC EDGAR',url:`https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t)}`,date:ASOF},
  {name:'Market and company data',url:`https://finance.yahoo.com/quote/${encodeURIComponent(t)}/`,date:ASOF}
];
const grade = s => s>=72?'B+':s>=62?'B':s>=52?'C+':s>=42?'C':s>=32?'D+':'D';
const levels = (lines,fallback) => {
  const a=csv(lines).map(x=>num(x.price)).filter(x=>x!==null);
  return (a.length?a:fallback).slice(0,3);
};
const bars = t => (qtype(t,'bars.json','bars_daily')[0]?.bars||[])
  .map(r=>({date:r[0],close:num(r[4])})).filter(x=>x.close!==null);
const perf = (b,days) => {
  if(b.length<2)return null;
  const end=b.at(-1), cut=new Date(end.date+'T00:00:00Z').getTime()-days*86400000;
  const start=b.find(x=>new Date(x.date+'T00:00:00Z').getTime()>=cut)||b[0];
  return start.close?(end.close/start.close-1)*100:null;
};
const ytdPerf = b => {
  if(b.length<2)return null;
  const year=String(b.at(-1).date).slice(0,4), prior=b.filter(x=>String(x.date)<`${year}-01-01`).at(-1);
  if(!prior)return null;
  return prior.close?(b.at(-1).close/prior.close-1)*100:null;
};
const news = (t,name) => {
  const raw=qtype(t,'sentiment.json','news').flat(3).filter(x=>x&&x.title);
  const keys=[t.toLowerCase(),String(name).toLowerCase().split(/\s+/)[0]];
  return raw.filter(x=>keys.some(k=>k.length>2&&x.title.toLowerCase().includes(k))).slice(0,6).map(x=>({
    date:String(x.publishedAt||ASOF).slice(0,10),title:x.title,source:x.source||'Market news',
    sourceUrl:x.url,impact:/surge|beat|record|raise|growth|higher|upgrade/i.test(x.title)?'positive':/fall|drop|cut|risk|lower|miss|downgrade/i.test(x.title)?'negative':'neutral',
    detail:/surge|beat|record|raise|growth|higher|upgrade/i.test(x.title)?'Potentially supportive for expectations; verify the magnitude in the primary release before acting.':/fall|drop|cut|risk|lower|miss|downgrade/i.test(x.title)?'Potential downside risk; the headline alone does not quantify the impact.':'Context only; no trade conclusion is drawn from this headline.'
  }));
};
const catalystText = x => {
  if(typeof x === 'string') return x;
  if(!x || typeof x !== 'object') return null;
  return x.detail || x.description || x.headline || x.title || x.reason ||
    x.catalyst?.detail || x.catalyst?.description || x.catalyst?.headline || null;
};
const countWord=(n,word)=>`${n||0} ${word}${Number(n)===1?'':'s'}`;

function build(t,p){
  const a=load(path.join(ROOT,'analyses',t,'_data','instrument.json')).data?.items||[];
  if(!a.length)throw new Error(t+': instrument bundle missing');
  const md=at(a,'instrument_metadata'), qt=at(a,'instrument_quote'), pr=at(a,'instrument_comprehensive_profile');
  const fn=at(a,'instrument_comprehensive_financial'), st=at(a,'instrument_comprehensive_stats');
  const ho=at(a,'instrument_comprehensive_holders'), te=at(a,'instrument_technicals');
  const sr=at(a,'instrument_support_resistance'), sh=at(a,'instrument_shariah_compliance');
  const ins=at(a,'instrument_insider_transactions'), si=at(a,'instrument_short_interest');
  const mp=at(a,'instrument_max_pain'), ov=at(a,'instrument_options_volume_ratio');
  const so=at(a,'instrument_sentiment_overall'), sw=at(a,'instrument_sentiment_stocktwits');
  const dp=at(a,'instrument_dark_pool'), fl=at(a,'instrument_flags'), cal=at(a,'instrument_calendar');
  const er=a.filter(x=>x.type==='instrument_comprehensive_earnings_quarterly');
  const b=bars(t), price=num(qt.price)??b.at(-1)?.close, entry=(p.lo+p.hi)/2;
  const trigger=TRIGGERS[t], triggerRr=(p.t1-trigger)/(trigger-p.s);
  const fmoney=v=>t==='TSM'?`TWD ${money(v).replace('$','')}`:money(v);
  const valuation=load(path.join(ROOT,'analyses',t,'_data','valuation.json'));
  const board=load(path.join(ROOT,'analyses',t,'_data','quality-board.json'));
  const high=price>p.hi*1.03, low=price<p.s, approved=/^Validated\b/i.test(p.v);
  const active=approved&&!high&&!low&&price>=p.lo*.97;
  let score=p.q-(high?8:0)-(low?16:0)-(triggerRr<1.5?5:0)-((te.rsi||0)>75?5:0)-(ins.net_activity==='bearish'?3:0)
    +(board.signal==='bullish'?2:board.signal==='bearish'?-4:0);
  score=clamp(Math.round(score),20,79);
  const sec=(a.filter(x=>x.type==='instrument_sec_filing').map(x=>x.content||'').join('\n')+'\n'+JSON.stringify(qtype(t,'dilution.json','sec_filings'))).toLowerCase();
  const atm=/at.the.market|atm offering|open market sale agreement/.test(sec), warrant=/warrant/.test(sec);
  const small=(qt.marketCap||Infinity)<5e9, dil=atm&&small?'high':atm?'moderate':'unknown';
  const sip=positive(si.percentOfFloat)??positive(st.shortPercentOfFloat);
  const move=load(path.join(ROOT,'analyses',t,'_data','move.json'));
  const baseRisk=Math.round(4+(dil==='high'?2:dil==='moderate'||dil==='unknown'?1:0)+((st.beta||0)>1.5?1:0)+((sip||0)>.1?1:0)+(ins.net_activity==='bearish'?1:0));
  const risk=clamp(Math.max(baseRisk,num(move.risk_score)!==null?Math.ceil(num(move.risk_score)/10):0),2,9);
  const e50=positive(te.ema50,qt.fiftyDayAverage), e200=positive(te.ema200,qt.twoHundredDayAvg);
  const e20=positive(te.ema20)??entry, recent=csv(ins.recent_trades).slice(0,8), r=refs(t);
  const status=low?`Current price ${px(price)} is below the hard stop.`:high?`Current price ${px(price)} is more than 3% above the original zone; wait for a new base.`:!approved?`This plan is watch-only and is not an active entry. Required evidence: ${p.c}.`:active?`Conditional plan: ${p.c}.`:`Watch only; confirmation is still missing: ${p.c}.`;
  const companyKey=String(md.shortName||md.name||t).toLowerCase().split(/\s+/)[0];
  const catalysts=(move.catalysts||[]).filter(x=>{
    if(!x || typeof x!=='object' || x.kind!=='news') return true;
    const hay=`${x.headline||''} ${x.detail||''}`.toLowerCase();
    return hay.includes(t.toLowerCase()) || (companyKey.length>2 && hay.includes(companyKey));
  }).map(x=>{
    if(x?.kind==='risk' && x.headline==='short_squeeze_pressure') return 'Crowded-positioning pressure is flagged, but it is not an entry trigger.';
    if(x?.kind==='risk' && x.headline==='high_ctb') return 'Borrow pressure is flagged as elevated; the exact cost-to-borrow rate is unavailable.';
    if(x?.kind==='filing') return `${x.headline||'Financing filing'}: review the document directly before any entry.`;
    return catalystText(x);
  }).filter(Boolean).slice(0,3);
  [p.c,`Analyst mean target: ${px(fn.targetMeanPrice)}`,`Next earnings: ${cal.nextEarningsDate||'not confirmed'}`].forEach(x=>{if(catalysts.length<3)catalysts.push(x);});
  const rr2=p.r2??(p.t2?(p.t2-entry)/(entry-p.s):null);
  const siScale=sip!==null&&sip>1?1:100;

  return {
    meta:{lang:'en',dir:'ltr',level:'intermediate',assetType:'stock',tags:['us','equities','trade-idea',String(pr.sector||'stocks').toLowerCase().replace(/[^a-z0-9]+/g,'-')],grade:grade(score),date:'2026-08-28',dateDisplay:'August 28, 2026',version:VERSIONS[t]||1,status:active?'active':'invalidated',lastMcpRefresh:REFRESHED,description:`${t}: ${p.v}. Fresh review of fundamentals, capital structure, technicals and trade levels.`,ogDescription:`${t}: verdict, risks, confirmation, invalidation and current trade levels.`},
    header:{ticker:t,name:md.shortName||md.name||t,exchange:md.exchange||'US',sector:pr.sector||'Unclassified',price,changePct:(num(qt.changePercent)||0)*100,badges:[{text:p.v,color:active?'green':high||low?'red':'amber'},{text:pr.industry||pr.sector||'Equity',color:'blue'}],metrics:{marketCap:money(qt.marketCap),volume:qty(qt.volume),fwdPE:positive(qt.forwardPE)===null?'N/A':positive(qt.forwardPE).toFixed(1)+'x',beta:num(st.beta)||0,range52w:positive(qt.fiftyTwoWeekLow)&&positive(qt.fiftyTwoWeekHigh)?`${px(qt.fiftyTwoWeekLow)} – ${px(qt.fiftyTwoWeekHigh)}`:'N/A',shortInterest:pct(sip,siScale),analystTarget:px(fn.targetMeanPrice),evEbitda:t==='TSM'||positive(st.enterpriseToEbitda)===null?'N/A':positive(st.enterpriseToEbitda).toFixed(1)+'x'},halal:sh.status==='compliant',halalStatus:sh.status==='compliant'?'halal':sh.status==='non-compliant'?'non-halal':'unknown'},
    verdict:{score,conviction:score>=70?'High':score>=50?'Moderate':'Low',bias:active?'Bullish':low?'Bearish':'Neutral',confidence:'Moderate confidence',summary:`${pr.longBusinessSummary?pr.longBusinessSummary.split('. ').slice(0,2).join('. ')+'. ':''}${p.v}. ${status}`,whyBuy:[`Revenue growth: ${pct(fn.revenueGrowth)}; earnings growth: ${pct(fn.earningsGrowth)}`,`Cash ${fmoney(fn.totalCash)} versus debt ${fmoney(fn.totalDebt)}`,`Defined confirmation: ${p.c}`],whyAvoid:[status,`First-target reward/risk at confirmation: ${triggerRr.toFixed(2)}R`,ins.net_activity==='bearish'?`Aggregate insider feed: ${countWord(ins.buys_count,'buy')} versus ${countWord(ins.sells_count,'sale')}`:'Insider activity is not a strong positive confirmation']},
    business:{overview:`<p>${pr.longBusinessSummary||(md.name||t)+' operates in '+(pr.industry||pr.sector||'its reported market')+'.'}</p>`,moat:`The trade assumes no moat beyond the reported economics in ${pr.industry||'the company industry'}.`,theme:pr.industry||pr.sector||'Equity'},
    news:news(t,md.shortName||md.name||t),
    fundamentals:{rows:[
      {metric:'Revenue (TTM)',value:fmoney(fn.totalRevenue),signal:pct(fn.revenueGrowth)+' YoY',signalColor:(fn.revenueGrowth||0)>=0?'green':'red'},
      {metric:'EBITDA',value:positive(fn.ebitda)===null?'N/A':fmoney(fn.ebitda),signal:t==='TSM'?'ADR and statement units are not compared':positive(fn.ebitda)===null||positive(st.enterpriseToEbitda)===null?'Not meaningful / unavailable':positive(st.enterpriseToEbitda).toFixed(1)+'x EV/EBITDA',signalColor:'blue'},
      {metric:'Gross Margin',value:pct(fn.grossMargins),signal:'Reported',signalColor:'blue'},
      {metric:'Operating Margin',value:num(fn.totalRevenue)>0?pct(fn.operatingMargins):'N/A',signal:num(fn.totalRevenue)>0?((fn.operatingMargins||0)>0?'Profitable':'Loss-making'):'Not meaningful without revenue',signalColor:num(fn.totalRevenue)>0&&fn.operatingMargins>0?'green':'red'},
      {metric:'Net Margin',value:num(fn.totalRevenue)>0?pct(fn.profitMargins):'N/A',signal:num(fn.totalRevenue)>0?((fn.profitMargins||0)>0?'Positive':'Negative'):'Not meaningful without revenue',signalColor:num(fn.totalRevenue)>0&&fn.profitMargins>0?'green':'red'},
      {metric:'ROE',value:pct(fn.returnOnEquity),signal:'Capital efficiency',signalColor:(fn.returnOnEquity||0)>=.12?'green':'amber'},
      {metric:'Cash',value:fmoney(fn.totalCash),signal:'Liquidity',signalColor:'green'},
      {metric:'Debt',value:fmoney(fn.totalDebt),signal:'Balance-sheet claim',signalColor:(fn.totalDebt||0)>(fn.totalCash||0)?'amber':'green'},
      {metric:'Forward P/E',value:positive(qt.forwardPE)===null?'N/A':positive(qt.forwardPE).toFixed(1)+'x',signal:'No estimate substituted',signalColor:'gray'},
      {metric:'Intrinsic-value model',value:num(valuation.modelValue)===null?'N/A':money(valuation.modelValue),signal:num(valuation.modelValue)===null?'Fail-closed: insufficient inputs':`${valuation.signal||'neutral'} / confidence ${valuation.confidence||0}`,signalColor:valuation.signal==='bullish'?'green':valuation.signal==='bearish'?'red':'gray'},
      {metric:'Value / quality panel',value:`${board.tally?.bullish||0} positive / ${board.tally?.bearish||0} negative / ${board.tally?.neutral||0} neutral`,signal:`${board.signal||'neutral'} / confidence ${board.confidence||0}`,signalColor:board.signal==='bullish'?'green':board.signal==='bearish'?'red':'gray'},
      {metric:'Analyst Mean Target',value:px(fn.targetMeanPrice),signal:'Consensus, not a guarantee',signalColor:'blue'}
    ],sourceRefs:r},
    earnings:{quarters:er.slice(0,4).map(x=>({quarter:String(x.date).slice(0,10),epsActual:num(x.actual)||0,epsEstimate:num(x.estimate)||0,surprise:num(x.actual)!==null&&num(x.estimate)?(((num(x.actual)-num(x.estimate))/Math.abs(num(x.estimate)))*100).toFixed(1)+'%':'N/A'})),beatStreak:er.filter(x=>num(x.actual)!==null&&num(x.estimate)!==null&&num(x.actual)>num(x.estimate)).length,beatNote:`${er.filter(x=>num(x.actual)>num(x.estimate)).length}/${er.length} captured quarters beat estimates`,nextEarnings:cal.nextEarningsDate||'Not confirmed'},
    insiders:{insiderPct:pct(ho.insidersPercent,1),institutionPct:pct(ho.institutionsPercent,1),recentTransactions:recent.map(x=>({date:x.date,insider:x.insider,type:/purchase|buy/i.test(x.type)?'buy':/sale|sell/i.test(x.type)?'sell':'grant',shares:qty(x.shares),value:num(x.shares)!==null&&num(x.price)!==null?money(num(x.shares)*num(x.price)):'N/A'})),signal:recent.length?`${ins.net_activity||'neutral'} aggregate feed — ${countWord(ins.buys_count,'buy')} and ${countWord(ins.sells_count,'sale')}`:'No structured transaction table was captured; aggregate counts are not used.',sourceRefs:r},
    capitalStructure:{sharesOutstanding:qty(st.sharesOutstanding),sharesAuthorized:'Not available in the structured dataset',dilutionRisk:dil,warrants:[],atm:{active:atm,authorized:atm?'Active filing language detected; amount requires filing-level review':'ATM status is unconfirmed; limited filing coverage cannot prove absence',used:'Not quantified',remaining:'Not quantified'},convertibles:[],shareHistory:`No point-in-time share-count series was available. Warrants and convertibles are unconfirmed, not assumed absent; dilution remains ${dil}.`,sourceRefs:r},
    shortInterest:{siPct:pct(sip,siScale),daysToCover:num(si.daysToCover)!==null?num(si.daysToCover).toFixed(2):num(st.shortRatio)!==null?num(st.shortRatio).toFixed(2):'N/A',ctb:positive(si.costToBorrow)===null?'N/A':pct(si.costToBorrow,si.costToBorrow>1?1:100),trend:'Current snapshot only; no acceleration claim without a comparable historical series.',squeezeScore:num(move.squeeze_score)>=70?'Elevated':'Low to moderate',sourceRefs:r},
    options:{callOI:qty(mp.totalCallOI),putOI:qty(mp.totalPutOI),cpRatio:num(mp.callPutRatio)===null?'N/A':num(mp.callPutRatio).toFixed(2),maxPain:px(mp.maxPainStrike),ivMean:'N/A',skew:num(ov.put_call_volume_ratio)===null?'N/A':`Put/call volume ${num(ov.put_call_volume_ratio).toFixed(2)}`,unusual:ov.unusual_activity?'Unusual activity detected':'No unusual activity confirmed',sourceRefs:r},
    technicals:{rsi14:num(te.rsi)||50,...(num(te.macd)!==null?{macd:num(te.macd)}:{}),...(num(te.signal)!==null?{macdSignal:num(te.signal)}:{}),ema20:e20,ema50:e50??entry,ema200:e200??entry,ma50Type:positive(te.ema50)?'EMA':'SMA',ma200Type:positive(te.ema200)?'EMA':'SMA',ma50Available:e50!==null,ma200Available:e200!==null,atr14:num(te.atr)||Math.abs(entry-p.s),badges:[`RSI ${num(te.rsi)===null?'N/A':num(te.rsi).toFixed(1)}`,active?'Inside actionable area':'Confirmation missing',p.v],supports:levels(sr.supports,[]).filter(v=>v<price),resistances:levels(sr.resistances,[]).filter(v=>v>price),setupNote:`${p.v}. Required confirmation: ${p.c}. ${e50!==null||e200!==null?'Available moving averages are shown with their provider type.':'The dataset has insufficient history for 50-day and 200-day averages; both remain unavailable.'}`,wyckoff:'Transitional',radarValues:{rsi:clamp(Math.round(100-Math.abs((te.rsi||50)-55)*2),0,100),trend:active?70:45,volume:clamp(Math.round((qt.volume||0)/1e6*15),10,100),momentum:high?80:55,volatility:clamp(Math.round((te.atr||0)/(price||1)*1000),10,100),support:active?75:45},sourceRefs:r},
    macro:{indicators:[{name:'Market regime',value:'Risk-on 0.79',signal:'Trend support, not a timing trigger'},{name:'VIX',value:'14.51',signal:'Low current protection price'}],regime:'risk-on',impact:'The broad regime supports long setups, but rates and ticker-specific confirmation override the label.',sourceRefs:[{name:'Systematic market regime snapshot',url:'/data/analyses-data/market-regime-20260827.json',date:ASOF}]},
    risks:{riskScore:risk,riskProfile:risk>=8?'High':risk>=5?'High':'Moderate',riskSummary:`Dilution: ${dil}; beta: ${num(st.beta)===null?'N/A':num(st.beta).toFixed(2)}; insider signal: ${ins.net_activity||'unavailable'}.`,riskCards:[
      {title:'Trade Structure',severity:triggerRr<1.5?'high':'medium',icon:'fa-chart-line',points:[`First-target reward/risk at confirmation: ${triggerRr.toFixed(2)}R`,status],probability:triggerRr<1.5?65:45,impact:70,verdict:p.c},
      {title:'Capital and Dilution',severity:dil==='high'?'high':'medium',icon:'fa-coins',points:[`ATM language: ${atm?'detected':'unconfirmed'}`,`Warrant language: ${warrant?'detected in captured text':'unconfirmed'}`],probability:dil==='high'?70:dil==='moderate'?45:35,impact:small?75:40,verdict:'Limited filing coverage cannot establish absence. No unreported dilution amount is inferred.'},
      {title:'Positioning',severity:ins.net_activity==='bearish'?'medium':'low',icon:'fa-user-tie',points:[`${ins.buys_count||0} insider buys vs ${ins.sells_count||0} sells`,`Short interest: ${pct(sip,siScale)}`],probability:50,impact:45,verdict:'Positioning is context, not a standalone trigger.'}
    ],pedagogy:'A precise stop does not make a setup valid. Entry location, normal volatility, event risk and reachable resistance decide whether the risk is paid.',riskRadarValues:{dilution:dil==='high'?85:dil==='moderate'?55:dil==='unknown'?60:25,burnRate:(fn.profitMargins||0)<0?75:25,beta:clamp(Math.round((st.beta||1)*45),10,100),shortInterest:clamp(Math.round((sip||0)*500),5,100),insiderSelling:ins.net_activity==='bearish'?75:30,macroRisk:45},sourceRefs:r},
    social:{platforms:[{platform:'Stocktwits',icon:'fa-solid fa-comments',mentions:String(sw.messageCount||'N/A'),trend:sw.sentimentLabel||'unavailable',trendColor:sw.sentimentLabel==='positive'?'green':sw.sentimentLabel==='negative'?'red':'gray',detail:`${sw.watchers||'N/A'} watchers; not used as a trigger.`},{platform:'Aggregate sentiment',icon:'fa-solid fa-satellite-dish',mentions:String(so.sourceCount||'N/A'),trend:so.sentimentLabel||'unavailable',trendColor:so.sentimentLabel==='positive'?'green':so.sentimentLabel==='negative'?'red':'gray',detail:`Confidence ${pct(so.confidence)}.`}],pumpDumpScore:clamp((small?2:0)+(fl.is_halted_recently?2:0)+(fl.is_top_ctb?1:0)+(dil==='high'?1:0)+((sip||0)>.2?2:0),0,6),pumpDumpChecklist:[{criterion:'No recent halt flag',pass:!fl.is_halted_recently},{criterion:'Short interest below 20%',pass:(sip||0)<=.2},{criterion:'Dilution risk established as low',pass:dil==='low'}],sourceRefs:r},
    performance:{ytd:num(ytdPerf(b))===null?'N/A — insufficient calendar-year history':ytdPerf(b).toFixed(1)+'%',oneYear:b.length<230?'N/A — insufficient one-year history':num(perf(b,365))===null?'N/A — insufficient history':perf(b,365).toFixed(1)+'%',threeYear:'N/A — insufficient point-in-time history',benchmarks:[],alpha:'Not calculated without aligned benchmark bars.',sourceRefs:r},
    capitalFlow:{netFlow:'N/A',institutionalFlow:'N/A',retailFlow:'N/A',darkPoolPct:num(dp.percentVolume)===null?'N/A':pct(dp.percentVolume,dp.percentVolume>1?1:100),signal:'No directional flow claim is made when detailed, aligned flow data is unavailable.',sourceRefs:r},
    tradeIdea:{entry,entryNote:`Original zone ${px(p.lo)}-${px(p.hi)}. ${p.c}. At the conservative ${px(trigger)} confirmation price, TP1 pays ${triggerRr.toFixed(2)}R.`,stop:p.s,stopPct:`${p.sp.toFixed(2)}% risk`,tp1:p.t1,tp1Pct:`${p.u1.toFixed(2)}% upside`,...(p.t2?{tp2:p.t2,tp2Pct:'Stretch target; use the stated TP2 reward/risk below.'}:{}),rr:`Confirmation TP1 1:${triggerRr.toFixed(2)}; original plan 1:${p.r.toFixed(2)}${num(rr2)!==null?` / TP2 1:${rr2.toFixed(2)}`:''}`,horizon:'10 trading sessions',thesis:approved?`${p.v}. Execute only after ${p.c.toLowerCase()}; no market order and no chase outside the zone.`:`${p.v}. Do not execute this historical plan. Reassess only after ${p.c.toLowerCase()}, then rebuild entry economics from the observed fill.`,catalysts,invalidation:[p.x,status,'Any earnings, clinical, regulatory or financing event before entry requires a fresh review.'],status:active?'active':'invalidated',statusNote:status},
    globalScore:{profile:pr.sector||'Equity',keyTakeawaysPositive:[`Defined trigger: ${p.c}`,`Cash: ${fmoney(fn.totalCash)}`,`Revenue growth: ${pct(fn.revenueGrowth)}`],keyTakeawaysNegative:[status,`First-target R/R at confirmation: ${triggerRr.toFixed(2)}R`,`Value / quality panel: ${board.signal||'neutral'} (${board.confidence||0} confidence)`],mindsetTip:'Wait for confirmation and preserve the invalidation.'},
    disclaimer:'Educational market analysis, not financial advice. Prices can gap and losses can exceed the planned stop.'
  };
}

for(const t of (process.argv.slice(2).map(x=>x.toUpperCase()).length?process.argv.slice(2).map(x=>x.toUpperCase()):Object.keys(PLANS))){
  if(!PLANS[t])throw new Error('Unknown plan: '+t);
  const data=build(t,PLANS[t]), out=path.join(ROOT,'data','analyses-data',t+'.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
  console.log(`[analysis-data] ${t}: ${data.meta.grade} / ${data.verdict.score} — ${data.tradeIdea.status}`);
}
