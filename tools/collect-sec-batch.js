#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..');
const USER_AGENT = 'DailyTickers research contact@dailytickers.com';
const CAPITAL_FORMS = new Set(['S-1','S-1/A','F-1','F-1/A','S-3','S-3/A','S-3ASR','F-3','F-3/A','F-3ASR','424B3','424B5','EFFECT']);
const CORE_FORMS = new Set(['10-K','10-K/A','10-Q','10-Q/A','20-F','20-F/A','40-F','6-K','8-K']);
const KEYWORDS = [
  'at-the-market','at the market','sales agreement','common stock offering','ordinary shares',
  'pre-funded warrant','warrant','convertible','senior notes','stock-based compensation',
  'share repurchase','going concern','material weakness'
];

function args() {
  const out = { tickers: [], output: 'data/analyses-data/_ai-chain-sec.json', since: '2025-08-28', merge: false };
  const a = process.argv.slice(2);
  for (let i=0;i<a.length;i++) {
    if (a[i] === '--tickers') out.tickers = a[++i].split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
    else if (a[i] === '--out') out.output = a[++i];
    else if (a[i] === '--since') out.since = a[++i];
    else if (a[i] === '--merge') out.merge = true;
  }
  if (!out.tickers.length) throw new Error('Usage: collect-sec-batch.js --tickers AAPL,MSFT [--out file] [--since YYYY-MM-DD]');
  return out;
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function getJson(url) {
  for (let attempt=0;attempt<7;attempt++) {
    const r = await fetch(url, {headers:{'User-Agent':USER_AGENT,'Accept-Encoding':'gzip, deflate'}});
    if (r.ok) return r.json();
    if (![429,500,502,503,504].includes(r.status)) throw new Error(`${r.status} ${url}`);
    const retryAfter=Number(r.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:2000*Math.pow(2,attempt));
  }
  throw new Error(`SEC request failed: ${url}`);
}

async function getText(url) {
  for (let attempt=0;attempt<7;attempt++) {
    const r = await fetch(url, {headers:{'User-Agent':USER_AGENT,'Accept-Encoding':'gzip, deflate'}});
    if (r.ok) return r.text();
    if (![429,500,502,503,504].includes(r.status)) throw new Error(`${r.status} ${url}`);
    const retryAfter=Number(r.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:2000*Math.pow(2,attempt));
  }
  throw new Error(`SEC request failed: ${url}`);
}

function recentRows(submissions) {
  const r = submissions.filings?.recent || {};
  return (r.accessionNumber||[]).map((accession,i)=>({
    accession,
    date:r.filingDate[i],
    form:r.form[i],
    primaryDocument:r.primaryDocument[i],
    description:r.primaryDocDescription?.[i]||''
  }));
}

function filingUrl(cik, row) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${row.accession.replace(/-/g,'')}/${row.primaryDocument}`;
}

function extractReview(html, form) {
  const $ = cheerio.load(html);
  $('script,style,noscript,table').remove();
  const text = $.root().text().replace(/\s+/g,' ').trim();
  const lower = text.toLowerCase();
  const snippets=[];
  for (const keyword of KEYWORDS) {
    const idx=lower.indexOf(keyword);
    if(idx>=0) snippets.push(text.slice(Math.max(0,idx-180),Math.min(text.length,idx+420)));
  }
  const head=lower.slice(0,7000);
  const isProspectus=/^(?:424B|S-1|F-1|S-3|F-3)/.test(form);
  const equity=isProspectus&&/(?:offer and sale|relating to the sale|offering).{0,700}(?:common stock|ordinary shares|american depositary shares|preferred stock|pre-funded warrants?)|(?:common stock|ordinary shares|american depositary shares|preferred stock).{0,500}(?:offered|offering|sale)/.test(head);
  const debt=isProspectus&&/(?:\d\.\d{3}% notes due|senior notes due|notes will mature|offering.{0,700}(?:senior notes|debt securities|fixed rate notes|floating rate notes))/.test(head);
  const activeWarrant=/warrants? (?:to purchase|outstanding|exercisable)|issued (?:pre-funded )?warrants?|warrant liability|exercise price of the warrants?/.test(lower);
  const activeWeakness=/we (?:have )?identified (?:a )?material weakness|material weaknesses? (?:were|was|have been|has been) identified|the following material weaknesses?|management concluded.{0,300}(?:internal control|disclosure controls).{0,200}(?:was|were) not effective/.test(lower);
  const actualAtm=isProspectus
    ? /at-the-market offering|sales agreement.{0,500}(?:offer|sell|sale)|offer and sell.{0,300}(?:from time to time|through)/.test(head)
    : /(?:entered into|pursuant to) (?:an? )?(?:at-the-market|sales) agreement.{0,500}(?:sold|issued|offer)/.test(lower);
  return {
    offeringType:equity&&debt?'mixed':equity?'equity':debt?'debt':'not-classified',
    flags:{
      atm:actualAtm,
      warrants:activeWarrant,
      convertibles:/convertible notes|convertible senior/.test(lower),
      stockComp:/stock-based compensation|share-based compensation/.test(lower),
      repurchases:/share repurchase|stock repurchase/.test(lower),
      goingConcern:/substantial doubt.{0,120}going concern|going concern.{0,120}substantial doubt/.test(lower),
      materialWeakness:activeWeakness
    },
    snippets:[...new Set(snippets)].slice(0,8)
  };
}

async function mapLimit(items, limit, fn) {
  const out=new Array(items.length); let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

async function main() {
  const cfg=args();
  const companies=await getJson('https://www.sec.gov/files/company_tickers.json');
  const byTicker=new Map(Object.values(companies).map(x=>[String(x.ticker).toUpperCase(),x]));
  const records=await mapLimit(cfg.tickers,3,async ticker=>{
    const company=byTicker.get(ticker);
    if(!company) return {ticker,error:'Ticker not found in SEC company_tickers.json'};
    const cik=String(company.cik_str).padStart(10,'0');
    const sub=await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
    const rows=recentRows(sub).filter(x=>x.date>=cfg.since&&(CORE_FORMS.has(x.form)||CAPITAL_FORMS.has(x.form)));
    const latestCore=[];
    for(const family of [['10-Q','10-Q/A'],['10-K','10-K/A','20-F','20-F/A','40-F'],['6-K'],['8-K']]) {
      const row=rows.find(x=>family.includes(x.form)); if(row) latestCore.push(row);
    }
    const selected=[...latestCore,...rows.filter(x=>CAPITAL_FORMS.has(x.form))]
      .filter((x,i,a)=>a.findIndex(y=>y.accession===x.accession)===i);
    const reviewed=await mapLimit(selected.slice(0,8),2,async row=>{
      const url=filingUrl(cik,row);
      try{return {...row,url,review:extractReview(await getText(url),row.form)};}
      catch(e){return {...row,url,error:e.message};}
    });
    await sleep(120);
    return {ticker,cik,company:company.title,asOf:new Date().toISOString(),filings:selected.map(x=>({...x,url:filingUrl(cik,x)})),reviewed};
  });
  const out=path.resolve(ROOT,cfg.output); fs.mkdirSync(path.dirname(out),{recursive:true});
  let mergedRecords=records;
  if(cfg.merge&&fs.existsSync(out)){
    const prior=JSON.parse(fs.readFileSync(out,'utf8'));
    const byTicker=new Map((prior.records||[]).map(x=>[x.ticker,x]));
    records.forEach(x=>byTicker.set(x.ticker,x));
    mergedRecords=[...byTicker.values()];
  }
  const output={generatedAt:new Date().toISOString(),since:cfg.since,source:'SEC EDGAR official submissions and primary documents',records:mergedRecords};
  fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
  const errors=records.filter(x=>x.error).length;
  console.log(`[sec-review] ${records.length-errors}/${records.length} tickers mapped; ${errors} errors -> ${path.relative(ROOT,out)}`);
  if(errors) process.exitCode=1;
}

main().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
