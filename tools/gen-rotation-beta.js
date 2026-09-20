#!/usr/bin/env node
'use strict';
/** Strict Marketdata quantitative + SEC documentary rotation collector.
 * REFDATE=YYYY-MM-DD node tools/gen-rotation-beta.js [--out-dir scanner/YYYYMMDD/_rotation]
 * Optional AS_OF_TIMESTAMP fixes the completed-bar request to the enclosing run timestamp.
 * Default: refresh the two local shared endpoints only after complete validation.
 * Explicit --out-dir: staging only. No notifications, fallback feeds or partial-success exits.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mcp = require('./lib/mcp-client');
const calendar = require('./lib/market-calendar');
const barsContract = require('./lib/marketdata-bars-contract');
const { stableStringify } = require('./lib/workflow-contract');
const ROOT = path.resolve(__dirname, '..');
const CALENDAR = 'us_equity_exchange_sessions';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
// --- config : sous-jacents + seuil de corrélation (pour écarter les co-mouvements parasites) ---
const CRYPTO_REFERENCES = [
  { key: 'btc', label: 'Bitcoin', ref: 'BTC-USD', minCorr: 0.55, minOverlap: 50, group: 'Crypto' },
  { key: 'eth', label: 'Ethereum', ref: 'ETH-USD', minCorr: 0.60, minOverlap: 50, group: 'Crypto' },
  { key: 'sol', label: 'Solana', ref: 'SOL-USD', minCorr: 0.60, minOverlap: 50, group: 'Crypto' },
];

// Univers thématique explicite : 30 ETF USD liquides ou spécialisés. Le rang
// éditorial est un ordre de lecture; le classement publié est recalculé sur les
// performances 1 mois puis 1 semaine au close de référence.
const THEMES = [
  { rank:1, key:'semis', label:'Semi-conducteurs / AI compute', ref:'SMH', group:'IA & numérique', theme:'semis' },
  { rank:2, key:'nuclear', label:'Uranium + nucléaire', ref:'URA', group:'Énergie & ressources' },
  { rank:3, key:'grid', label:'Électrification / réseau / AI power', ref:'GRID', group:'Énergie & ressources' },
  { rank:4, key:'copper', label:'Mines de cuivre', ref:'COPX', group:'Énergie & ressources' },
  { rank:5, key:'ai_broad', label:'IA large / Big Data', ref:'AIQ', group:'IA & numérique' },
  { rank:6, key:'cyber', label:'Cybersécurité', ref:'CIBR', group:'IA & numérique' },
  { rank:7, key:'datacenters', label:'Data centers', ref:'VPN', group:'Infrastructure' },
  { rank:8, key:'robotics', label:'Robotique / automatisation', ref:'BOTZ', group:'Industrie & rupture' },
  { rank:9, key:'rareearth', label:'Terres rares / métaux stratégiques', ref:'REMX', group:'Énergie & ressources' },
  { rank:10, key:'goldminers', label:"Mines d'or", ref:'GDX', group:'Énergie & ressources' },
  { rank:11, key:'silverminers', label:"Mines d'argent", ref:'SIL', group:'Énergie & ressources' },
  { rank:12, key:'uraniumminers', label:"Mines d'uranium", ref:'URNM', group:'Énergie & ressources' },
  { rank:13, key:'defense', label:'Défense / aérospatial', ref:'PPA', group:'Industrie & rupture' },
  { rank:14, key:'bitcoinminers', label:'Bitcoin miners / HPC', ref:'WGMI', group:'Actifs numériques' },
  { rank:15, key:'quantum', label:'Informatique quantique', ref:'QTUM', group:'IA & numérique' },
  { rank:16, key:'infrastructure', label:'Infrastructure US / reshoring', ref:'PAVE', group:'Infrastructure' },
  { rank:17, key:'space', label:'Économie spatiale', ref:'UFO', group:'Industrie & rupture' },
  { rank:18, key:'cloud', label:'Logiciel cloud / SaaS', ref:'WCLD', group:'IA & numérique' },
  { rank:19, key:'biotech', label:'Biotechnologie', ref:'IBB', group:'Santé' },
  { rank:20, key:'genomics', label:'Innovation santé / génomique', ref:'ARKG', group:'Santé' },
  { rank:21, key:'blockchain', label:'Actions blockchain', ref:'BLOK', group:'Actifs numériques' },
  { rank:22, key:'fintech', label:'Fintech', ref:'FINX', group:'Finance' },
  { rank:23, key:'lithium', label:'Lithium / batteries', ref:'LIT', group:'Énergie & ressources' },
  { rank:24, key:'ev', label:'Véhicules électriques / conduite autonome', ref:'DRIV', group:'Industrie & rupture' },
  { rank:25, key:'cleanenergy', label:'Transition énergétique', ref:'ICLN', group:'Énergie & ressources' },
  { rank:26, key:'solar', label:'Solaire', ref:'TAN', group:'Énergie & ressources' },
  { rank:27, key:'hydrogen', label:'Hydrogène', ref:'HYDR', group:'Énergie & ressources' },
  { rank:28, key:'water', label:'Eau', ref:'PHO', group:'Ressources durables' },
  { rank:29, key:'agribusiness', label:'Agribusiness / agriculture', ref:'MOO', group:'Ressources durables' },
  { rank:30, key:'timber', label:'Bois / forêt', ref:'WOOD', group:'Ressources durables' },
].map(theme => ({...theme, minCorr:0.50, minOverlap:50, allowEmpty:true}));
const REFERENCES = [...CRYPTO_REFERENCES, ...THEMES];

// Relations économiques explicites et contrôlées séparément des simples
// co-mouvements. Cette liste est volontairement courte et non exhaustive.
const DIRECT_CRYPTO_PROXIES = [
  { key: 'btc', reference: 'BTC-USD', symbol: 'ASST', relation: 'Trésorerie Bitcoin', minCorr: 0.55,
    evidence_url: 'https://www.sec.gov/Archives/edgar/data/1920406/000162828026047102/asst-20260706.htm', evidence_date: '2026-07-06', evidence_term: 'bitcoin' },
  { key: 'eth', reference: 'ETH-USD', symbol: 'SBET', relation: 'Trésorerie Ethereum', minCorr: 0.60,
    evidence_url: 'https://www.sec.gov/Archives/edgar/data/1981535/000149315226036741/ex99-1.htm', evidence_date: '2026-08-10', evidence_term: 'ethereum' },
  { key: 'eth', reference: 'ETH-USD', symbol: 'BMNR', relation: 'Trésorerie Ethereum', minCorr: 0.60,
    evidence_url: 'https://www.sec.gov/Archives/edgar/data/1829311/000149315226022150/ex99-3.htm', evidence_date: '2026-05-11', evidence_term: 'ethereum' },
  { key: 'sol', reference: 'SOL-USD', symbol: 'DFDV', relation: 'Trésorerie Solana', minCorr: 0.60,
    evidence_url: 'https://www.sec.gov/Archives/edgar/data/1805526/000180552626000107/dfdv-exx991_91426.htm', evidence_date: '2026-09-14', evidence_term: 'solana' },
];
const DIRECT_MIN_OVERLAP = 50;
const DIRECT_MIN_DOLLAR_ADV = 2e6;

function themeUnavailableWarning(error) {
  const message = String(error && error.message ? error.message : error || '');
  const shortHistory = message.match(/only\s+(\d+)\s+bars?.*?need\s*>=?\s*(\d+)/i);
  if (shortHistory) {
    return `Historique insuffisant : ${shortHistory[1]} séances exploitables, minimum ${shortHistory[2]}.`;
  }
  if (/no bars for reference|no bars available|without bars/i.test(message)) {
    return 'Historique indisponible pour cette référence sur la fenêtre.';
  }
  return 'Calcul indisponible pour cette référence sur la fenêtre.';
}

// --- 11 secteurs SPDR + noms FR + valeurs-phares (top holdings, stables) ---
const SECTORS = [
  { etf: 'XLK',  name: 'Technologie',      bellwethers: ['NVDA', 'MSFT', 'AAPL'] },
  { etf: 'XLV',  name: 'Santé',            bellwethers: ['LLY', 'UNH', 'JNJ'] },
  { etf: 'XLF',  name: 'Financières',      bellwethers: ['JPM', 'V', 'MA'] },
  { etf: 'XLE',  name: 'Énergie',          bellwethers: ['XOM', 'CVX', 'COP'] },
  { etf: 'XLI',  name: 'Industrie',        bellwethers: ['GE', 'CAT', 'RTX'] },
  { etf: 'XLY',  name: 'Conso discrét.',   bellwethers: ['AMZN', 'TSLA', 'HD'] },
  { etf: 'XLP',  name: 'Conso de base',    bellwethers: ['COST', 'WMT', 'PG'] },
  { etf: 'XLC',  name: 'Communication',    bellwethers: ['META', 'GOOGL', 'NFLX'] },
  { etf: 'XLU',  name: 'Utilities',        bellwethers: ['NEE', 'SO', 'DUK'] },
  { etf: 'XLRE', name: 'Immobilier',       bellwethers: ['PLD', 'AMT', 'EQIX'] },
  { etf: 'XLB',  name: 'Matériaux',        bellwethers: ['LIN', 'SHW', 'FCX'] },
];


function objects(value, predicate) {
  const found = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node) && predicate(node)) { found.push(node); return; }
    for (const child of Object.values(node)) visit(child);
  }
  visit(value); return found;
}
function sourceTime(value) {
  const timestamps = objects(value, node => typeof node.captured_at === 'string');
  if (!timestamps.length) throw Error('source has no served captured_at timestamp');
  const stamp = timestamps[0].captured_at;
  if (!Number.isFinite(Date.parse(stamp))) throw Error('source captured_at is invalid');
  return stamp;
}
function assertTerminal(value) {
  // Transport/job state belongs to response envelopes, not arbitrary domain objects.
  // GetStatus may truthfully report a background SEC rebuild as status=running while
  // the response and all required operation_readiness gates are complete/ready.
  const envelopes = [value, value?.data].filter(node => node && typeof node === 'object' && !Array.isArray(node));
  for (const node of envelopes) {
    if (node.isError === true || ['failed', 'error', 'pending', 'running'].includes(node.status)) {
      throw Error(`source response is not complete (${node.status || 'isError'})`);
    }
    if (node.pagination?.has_next === true) throw Error('source response pagination is not exhausted');
  }
  // Individual Jobs items can also carry an actual job/error envelope. Per-cell
  // data quality is assessed separately by validateQueryData / validateBeta.
  for (const item of value?.data?.items || []) {
    if (item?.isError === true || (item?.job_id && ['failed', 'error', 'pending', 'running'].includes(item.status))) {
      throw Error(`source job item is not complete (${item.status || 'isError'})`);
    }
  }
}
function validatePerformanceBars(payload, configs, symbolOf, refdate, kind) {
  const symbols = configs.map(symbolOf);
  const result = barsContract.validateQueryData(payload, { symbols: symbols.join(','), assetCalendar: CALENDAR, expectedCompletedEnd: refdate });
  if (result.errors.length) throw Error(result.errors.join(' | '));
  const map = new Map();
  for (const item of result.healthyCells) {
    if (!symbols.includes(item.id) || item.status !== 'completed' || !item.row) throw Error(`unexpected or unavailable ${kind} ${item.id}`);
    const rows = item.row.bars;
    if (!Array.isArray(rows) || rows.length < 21) throw Error(`${item.id}: fewer than 21 completed sessions`);
    const parsed = rows.map(row => {
      const date = Array.isArray(row) ? row[0] : row.date;
      const close = Array.isArray(row) ? row[4] : row.close;
      if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0 || !calendar.isUSTradingDay(date)) throw Error(`${item.id}: invalid dated close`);
      if (!Array.isArray(row) && row.complete === false) throw Error(`${item.id}: partial bar`);
      return { date, close };
    });
    for (let i = 1; i < parsed.length; i++) {
      if (calendar.nextUSTradingDay(parsed[i - 1].date) !== parsed[i].date) throw Error(`${item.id}: missing, duplicate or unordered session`);
    }
    if (parsed.at(-1).date !== refdate) throw Error(`${item.id}: actual final bar differs from ${refdate}`);
    if (item.row.coverage?.complete === false || (item.row.coverage?.missing_ranges || []).length) throw Error(`${item.id}: incomplete coverage`);
    map.set(item.id, parsed);
  }
  if (map.size !== symbols.length) throw Error(`incomplete ${kind} universe`);
  return configs.map(config => {
    const symbol=symbolOf(config), b=map.get(symbol), last=b.at(-1).close;
    const perf_1w = +((last / b.at(-6).close - 1) * 100).toFixed(2);
    const perf_1m = +((last / b.at(-21).close - 1) * 100).toFixed(2);
    return { ...config, last:+last.toFixed(2), perf_1w, perf_1m, dir:perf_1w>0.15?'up':perf_1w<-.15?'down':'flat' };
  });
}
function validateSectorBars(payload, refdate) {
  return validatePerformanceBars(payload,SECTORS,s=>s.etf,refdate,'sector')
    .sort((a,b) => b.perf_1w - a.perf_1w || a.etf.localeCompare(b.etf));
}
function validateThemeBars(payload, refdate) {
  return validatePerformanceBars(payload,THEMES,t=>t.ref,refdate,'theme ETF')
    .sort((a,b)=>b.perf_1m-a.perf_1m || b.perf_1w-a.perf_1w || a.ref.localeCompare(b.ref))
    .map((theme,index)=>({...theme,momentum_rank:index+1}));
}
function themeMatch(row, theme) {
  if (!theme) return true;
  const sector=String(row.sector || '').toLowerCase();
  const industry=String(row.industry || '').toLowerCase();
  if (theme === 'metals') return sector === 'materials' && /(gold|silver|precious|metal|mining)/.test(industry);
  if (theme === 'energy') return sector === 'energy' && /(oil|gas|energy|midstream|exploration|drilling|integrated)/.test(industry);
  if (theme === 'semis') return sector === 'technology' && /(semiconductor|electronic components|computer hardware|communication equipment|scientific.*technical instruments)/.test(industry);
  throw Error(`unknown rotation theme ${theme}`);
}
function utcDateMinus(date, days) {
  const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()-days); return d.toISOString().slice(0,10);
}
function median(values) {
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
function parseDailySeries(row, symbol, refdate, windowStart) {
  if (!row || row.symbol !== symbol || !Array.isArray(row.bars)) throw Error(`${symbol}: missing identified daily bars`);
  if (String(row.served_completed_end || '').slice(0,10) !== refdate) throw Error(`${symbol}: served bars do not end on ${refdate}`);
  if (row.coverage?.complete === false || (row.coverage?.missing_ranges || []).length) throw Error(`${symbol}: incomplete daily-bar coverage`);
  const parsed=row.bars.map(bar=>{
    const date=Array.isArray(bar)?bar[0]:bar.date;
    const close=Array.isArray(bar)?bar[4]:bar.close;
    const volume=Array.isArray(bar)?bar[5]:bar.volume;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof close !== 'number' || !Number.isFinite(close) || close<=0) throw Error(`${symbol}: invalid dated close`);
    if (!Array.isArray(bar) && bar.complete === false) throw Error(`${symbol}: partial daily bar`);
    return {date,close,volume:typeof volume==='number'&&Number.isFinite(volume)&&volume>=0?volume:null};
  }).filter(bar=>bar.date>=windowStart && bar.date<=refdate).sort((a,b)=>a.date.localeCompare(b.date));
  if (parsed.length<2 || parsed.at(-1).date!==refdate) throw Error(`${symbol}: exact reference close missing`);
  for (let i=1;i<parsed.length;i++) if (parsed[i-1].date>=parsed[i].date) throw Error(`${symbol}: duplicate or unordered daily bars`);
  return parsed;
}
function regression(stock, reference) {
  const stockMap=new Map(stock.map(x=>[x.date,x.close]));
  const common=reference.filter(x=>stockMap.has(x.date)).map(x=>({date:x.date,reference:x.close,stock:stockMap.get(x.date)}));
  const xs=[],ys=[];
  for (let i=1;i<common.length;i++) {
    xs.push(Math.log(common[i].reference/common[i-1].reference));
    ys.push(Math.log(common[i].stock/common[i-1].stock));
  }
  const n=xs.length;
  if (n<DIRECT_MIN_OVERLAP) throw Error(`only ${n} common return observations`);
  const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
  let cov=0,vx=0,vy=0;
  for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;cov+=dx*dy;vx+=dx*dx;vy+=dy*dy;}
  if (!(vx>0&&vy>0)) throw Error('zero return variance');
  const beta=cov/vx, correlation=cov/Math.sqrt(vx*vy);
  return {beta,correlation,r2:correlation*correlation,n_obs:n};
}
function validateDirectBatch(payload,symbols,assetCalendar,refdate) {
  const report=barsContract.validateQueryData(payload,{symbols:symbols.join(','),assetCalendar,expectedCompletedEnd:refdate});
  if (report.errors.length) throw Error(report.errors.join(' | '));
  const bySymbol=new Map(report.healthyCells.map(item=>[item.id,item]));
  if (bySymbol.size!==symbols.length) throw Error(`direct crypto bars incomplete (${bySymbol.size}/${symbols.length})`);
  for(const symbol of symbols) {
    const item=bySymbol.get(symbol);
    if (item.proof.assetCalendar!==assetCalendar) throw Error(`${symbol}: asset_calendar mismatch (expected ${assetCalendar}, got ${item.proof.assetCalendar || 'missing'})`);
  }
  return bySymbol;
}
function computeDirectProxies(bySymbol,refdate) {
  const symbols=[...new Set(DIRECT_CRYPTO_PROXIES.flatMap(x=>[x.reference,x.symbol]))];
  const windowStart=utcDateMinus(refdate,90), series=new Map();
  for(const symbol of symbols) {
    const item=bySymbol.get(symbol);
    if (!item) throw Error(`${symbol}: direct daily bars missing after validation`);
    series.set(symbol,parseDailySeries(item.row,symbol,refdate,windowStart));
  }
  return DIRECT_CRYPTO_PROXIES.map(cfg=>{
    const stock=series.get(cfg.symbol), stats=regression(stock,series.get(cfg.reference));
    if (stats.correlation<cfg.minCorr) throw Error(`${cfg.symbol}: direct proxy correlation below ${cfg.minCorr}`);
    const dollarVolumes=stock.filter(x=>x.volume!=null).map(x=>x.close*x.volume);
    if (!dollarVolumes.length) throw Error(`${cfg.symbol}: volume missing`);
    const dollarAdv=median(dollarVolumes),last=stock.at(-1).close;
    if (dollarAdv<DIRECT_MIN_DOLLAR_ADV || last<3) throw Error(`${cfg.symbol}: direct proxy liquidity floor not met`);
    return {...cfg,beta:+stats.beta.toFixed(2),correlation:+stats.correlation.toFixed(2),r2:+stats.r2.toFixed(2),n_obs:stats.n_obs,
      last_price:+last.toFixed(2),dollar_adv_median:+dollarAdv.toFixed(2),asof:refdate,window:`${windowStart}..${refdate}`};
  });
}
function validateDirectCryptoBars(payload, refdate) {
  const crypto=[...new Set(DIRECT_CRYPTO_PROXIES.map(x=>x.reference))];
  const equities=[...new Set(DIRECT_CRYPTO_PROXIES.map(x=>x.symbol))];
  const all=barsContract.validateQueryData(payload,{symbols:[...crypto,...equities].join(','),expectedCompletedEnd:refdate});
  if (all.errors.length) throw Error(all.errors.join(' | '));
  const bySymbol=new Map(all.healthyCells.map(item=>[item.id,item]));
  for(const symbol of crypto) if (bySymbol.get(symbol)?.proof.assetCalendar!=='crypto_24_7_utc') throw Error(`${symbol}: asset_calendar mismatch`);
  for(const symbol of equities) if (bySymbol.get(symbol)?.proof.assetCalendar!==CALENDAR) throw Error(`${symbol}: asset_calendar mismatch`);
  return computeDirectProxies(bySymbol,refdate);
}
function validateSecEvidence(bytes,cfg,refdate) {
  if (!Buffer.isBuffer(bytes) || bytes.length<1000) throw Error(`${cfg.symbol}: SEC evidence is empty or truncated`);
  if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(cfg.evidence_url)) throw Error(`${cfg.symbol}: evidence URL is not SEC EDGAR`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.evidence_date) || cfg.evidence_date>refdate) throw Error(`${cfg.symbol}: SEC evidence post-dates reference close`);
  const text=bytes.toString('utf8').toLowerCase();
  if (!text.includes(cfg.symbol.toLowerCase()) || !text.includes(cfg.evidence_term)) throw Error(`${cfg.symbol}: SEC evidence does not identify ticker and treasury asset`);
  return true;
}
async function fetchDocument(url) {
  const response=await fetch(url,{headers:{'User-Agent':'DailyTickers research contact@dailytickers.com','Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`SEC HTTP ${response.status}`);
  return {bytes:Buffer.from(await response.arrayBuffer()),captured_at:new Date().toISOString(),final_url:response.url};
}
function validateBeta(payload, cfg, refdate) {
  const items = objects(payload, node => node.type === 'beta_ranking' || Array.isArray(node.rows));
  if (items.length !== 1) throw Error(`${cfg.ref}: expected one RankBeta result`);
  const item = items[0];
  const reference = item.reference ?? item.reference_symbol;
  if (reference !== cfg.ref) throw Error(`${cfg.ref}: returned reference missing or mismatched`);
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  const servedEnds = [];
  for (const key of ['served_completed_end', 'data_through', 'as_of']) {
    if (item[key] == null) continue;
    const value = item[key];
    if (typeof value !== 'string' || !validDay(value.slice(0,10)) ||
        !(value.length === 10 || (/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))))) {
      throw Error(`${cfg.ref}: invalid served ${key}`);
    }
    servedEnds.push({ source: key, date: value.slice(0,10) });
  }
  // RankBeta serves its actual regression interval as YYYY-MM-DD..YYYY-MM-DD.
  // This is direct date evidence, independently checked against every other served date.
  if (typeof item.window === 'string' && (item.window.includes('..') || /^\d{4}-/.test(item.window))) {
    const interval = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(item.window);
    if (!interval || !validDay(interval[1]) || !validDay(interval[2]) || interval[1] >= interval[2]) {
      throw Error(`${cfg.ref}: invalid served regression window`);
    }
    servedEnds.push({ source: 'window', date: interval[2] });
  }
  if (!servedEnds.length) throw Error(`${cfg.ref}: RankBeta has no matching served as-of ${refdate}`);
  for (const end of servedEnds) if (end.date !== refdate) {
    throw Error(`${cfg.ref}: served ${end.source} ends ${end.date}, expected ${refdate}`);
  }
  if (['insufficient', 'unavailable', 'failed', 'error', 'partial', 'low'].includes(String(item.quality || item.status || '').toLowerCase())) throw Error(`${cfg.ref}: insufficient RankBeta quality`);
  if (item.rows == null || (Array.isArray(item.rows) && item.rows.length === 0)) {
    const coverage = ['analyzed', 'skipped_insufficient_overlap', 'skipped_no_bars', 'skipped_filtered', 'universe_size']
      .filter(key => item[key] != null).map(key => `${key}=${item[key]}`).join(', ');
    if (cfg.allowEmpty) return {key:cfg.key,label:cfg.label,reference:cfg.ref,group:cfg.group,window:item.window||'90d',asof:refdate,quality:'no_qualified_rows',warning:`Aucun titre ne passe les seuils${coverage?' ('+coverage+')':''}.`,excluded_rows:0,rows:[]};
    throw Error(`${cfg.ref}: no qualified beta proxies — coverage/overlap insufficient (rows=${item.rows == null ? 'null' : '[]'}${coverage ? ', ' + coverage : ''})`);
  }
  if (!Array.isArray(item.rows)) throw Error(`${cfg.ref}: invalid RankBeta rows, expected array or explicit empty null`);
  const seen = new Set();
  for (const row of item.rows) {
    if (typeof row.symbol !== 'string' || !row.symbol || seen.has(row.symbol)) throw Error(`${cfg.ref}: missing/duplicate proxy symbol`);
    seen.add(row.symbol);
    for (const key of ['beta', 'correlation', 'r2']) if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) throw Error(`${cfg.ref}/${row.symbol}: invalid ${key}`);
    // RankBeta filtre sur |correlation| : il retient aussi les proxys INVERSES (beta < 0),
    // légitimes mais qui ne sont pas des "plus hauts beta". Comparer la valeur signée au
    // seuil faisait donc échouer toute la page sur un proxy que le tri écartait de toute
    // façon (ETH/LZB, corr=-0.61, beta=-0.65, le 2026-09-15). On valide sur la magnitude,
    // et on écarte les inverses de la liste publiée plus bas.
    if (Math.abs(row.correlation) < cfg.minCorr || Math.abs(row.correlation) > 1 || row.r2 < 0 || row.r2 > 1) throw Error(`${cfg.ref}/${row.symbol}: proxy fails quality thresholds`);
    if (Math.abs(row.r2-row.correlation*row.correlation)>1e-8) throw Error(`${cfg.ref}/${row.symbol}: r2 disagrees with correlation squared`);
    const n = row.overlap ?? row.n_obs ?? row.observations ?? row.n;
    if (!Number.isInteger(n) || n < cfg.minOverlap) throw Error(`${cfg.ref}/${row.symbol}: fewer than ${cfg.minOverlap} overlapping observations`);
    for (const key of ['served_completed_end', 'data_through', 'as_of']) if (row[key] != null && String(row[key]).slice(0,10) !== refdate) throw Error(`${cfg.ref}/${row.symbol}: stale regression window`);
    if (typeof row.last_price !== 'number' || !Number.isFinite(row.last_price) || row.last_price < 3) throw Error(`${cfg.ref}/${row.symbol}: price floor not met`);
    if (typeof row.dollar_adv_median !== 'number' || !Number.isFinite(row.dollar_adv_median) || row.dollar_adv_median < 5e6) throw Error(`${cfg.ref}/${row.symbol}: dollar ADV floor not met`);
  }
  const positive = item.rows.filter(r => r.correlation > 0 && themeMatch(r,cfg.theme));
  const inverseExcluded = item.rows.length - positive.length;
  if (!positive.length) throw Error(`${cfg.ref}: no positively-correlated in-theme beta proxy (${inverseExcluded} excluded rows)`);
  const rows = [...positive].sort((a,b) => b.beta - a.beta || a.symbol.localeCompare(b.symbol)).slice(0,6).map(r => ({
    symbol: r.symbol, beta: +r.beta.toFixed(2), correlation: +r.correlation.toFixed(2), r2: +r.r2.toFixed(2),
    n_obs: r.overlap ?? r.n_obs ?? r.observations ?? r.n,
    last_price:+r.last_price.toFixed(2), dollar_adv_median:+r.dollar_adv_median.toFixed(2), sector: r.sector || '', industry: r.industry || '',
  }));
  return { key: cfg.key, label: cfg.label, reference: cfg.ref, group:cfg.group, window: item.window || '90d', asof: refdate, quality: 'usable', warning: null, excluded_rows: inverseExcluded, rows };
}

function pinDirectProxies(references, directProxies, limit=6) {
  return references.map(reference => {
    const direct = directProxies.filter(proxy => proxy.key === reference.key);
    if (!direct.length) return reference;
    const directSymbols = new Set(direct.map(proxy => proxy.symbol));
    const rankBySymbol = new Map(reference.rows.map(row => [row.symbol, row]));
    const pinned = direct.map(proxy => {
      const ranked = rankBySymbol.get(proxy.symbol) || {};
      return {
        symbol: proxy.symbol,
        beta: proxy.beta,
        correlation: proxy.correlation,
        r2: proxy.r2,
        n_obs: proxy.n_obs,
        last_price: proxy.last_price,
        dollar_adv_median: proxy.dollar_adv_median,
        sector: ranked.sector || '',
        industry: ranked.industry || '',
        relation_verified: true,
        relation: proxy.relation,
      };
    });
    const statistical = reference.rows.filter(row => !directSymbols.has(row.symbol));
    const selected = [...pinned, ...statistical.slice(0, Math.max(0, limit - pinned.length))]
      .sort((a,b) => b.beta - a.beta || a.symbol.localeCompare(b.symbol));
    return {...reference, rows:selected};
  });
}
function options(argv, env, root, now) {
  let supplied;
  for (let i=0; i<argv.length; i++) {
    const arg=argv[i];
    if (arg === '--out-dir') { if (supplied || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('invalid --out-dir'); supplied=argv[++i]; }
    else if (arg.startsWith('--out-dir=')) { if (supplied) throw Error('duplicate --out-dir'); supplied=arg.slice(10); if (!supplied) throw Error('invalid --out-dir'); }
    else throw Error(`unknown argument ${arg}`);
  }
  const refdate=env.REFDATE, asof=env.AS_OF_TIMESTAMP || now.toISOString();
  if (!refdate || !calendar.isUSTradingDay(refdate)) throw Error('REFDATE must be an explicit completed US session');
  if (!Number.isFinite(Date.parse(asof)) || Date.parse(asof)>now.getTime()+15000 || calendar.latestCompletedUSClose(new Date(asof))!==refdate) throw Error('AS_OF_TIMESTAMP does not identify REFDATE as the last completed US close');
  const session=calendar.nextUSTradingDay(refdate).replace(/-/g,'');
  const outDir=path.resolve(root,supplied || `scanner/${session}/_rotation`);
  const relative=path.relative(root,outDir).split(path.sep).join('/');
  if (!/^scanner\/\d{8}\/_[^/]+(?:\/[^/]+)*$/.test(relative) || relative.split('/')[1] !== session || relative.includes('/../')) throw Error('--out-dir must be local runtime staging under the matching scanner session');
  // Do not follow an existing ancestor symlink into published/unrelated files.
  let ancestor=outDir;
  while (!fs.existsSync(ancestor)) ancestor=path.dirname(ancestor);
  if (fs.realpathSync(ancestor)!==ancestor) throw Error('staging path cannot traverse a symlink');
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw Error('staging is not empty; use a new --out-dir for this attempt');
  return {refdate,asof,outDir,relative,refreshShared:supplied===undefined};
}
async function run({ argv=process.argv.slice(2), env=process.env, root=ROOT, client=mcp, fetchDocument:fetchEvidence=fetchDocument, now=new Date() }={}) {
  root=fs.realpathSync(root);
  const opts=options(argv,env,root,now);
  if (!client.canCallDirectly('marketdata')) throw Error('marketdata token missing or expired; rotation did not run');
  const directCryptoSymbols=[...new Set(DIRECT_CRYPTO_PROXIES.map(x=>x.reference))];
  const directEquitySymbols=[...new Set(DIRECT_CRYPTO_PROXIES.map(x=>x.symbol))];
  const themeSymbols=THEMES.map(x=>x.ref);
  const declarations=[{name:'status',tool:'GetStatus',args:{}},
    {name:'bars_sectors',tool:'QueryData',args:{symbols:SECTORS.map(s=>s.etf).join(','),types:'bars_daily',limit:30,source:'webull',force_async:true,as_of_timestamp:opts.asof,completion_policy:'completed_only'},asset_calendar:CALENDAR,expected_completed_end:opts.refdate},
    {name:'bars_themes',tool:'QueryData',args:{symbols:themeSymbols.join(','),types:'bars_daily',limit:30,source:'webull',force_async:true,as_of_timestamp:opts.asof,completion_policy:'completed_only'},asset_calendar:CALENDAR,expected_completed_end:opts.refdate},
    {name:'bars_direct_crypto',tool:'QueryData',args:{symbols:directCryptoSymbols.join(','),types:'bars_daily',start_date:utcDateMinus(opts.refdate,92),end_date:opts.refdate,limit:120,force_async:true,as_of_timestamp:opts.asof,completion_policy:'completed_only'}},
    {name:'bars_direct_equities',tool:'QueryData',args:{symbols:directEquitySymbols.join(','),types:'bars_daily',start_date:utcDateMinus(opts.refdate,92),end_date:opts.refdate,limit:120,source:'webull',force_async:true,as_of_timestamp:opts.asof,completion_policy:'completed_only'}},
    ...REFERENCES.map(cfg=>({name:`beta_${cfg.key}`,tool:'RankBeta',args:{reference:cfg.ref,universe_asset:'stock',universe_region:'US',min_correlation:cfg.minCorr,min_dollar_adv:5e6,min_price:3,min_overlap:cfg.minOverlap,lookback_days:90,top_k:30,as_of:opts.refdate}}))];
  const documents=DIRECT_CRYPTO_PROXIES.map(cfg=>({name:`sec_${cfg.symbol}`,url:cfg.evidence_url,document_date:cfg.evidence_date,symbol:cfg.symbol,asset_term:cfg.evidence_term}));
  const plan={schema:'scanner-rotation-plan.v3',reference_close:opts.refdate,as_of_timestamp:opts.asof,calls:declarations,documents};
  const planSha=hash(JSON.stringify(plan,null,2)+'\n'), inputSha=hash(stableStringify(plan)), sources=[], calls=[];
  const collectorSha=hash(fs.readFileSync(__filename));
  const barsValidatorSha=hash(fs.readFileSync(require.resolve('./lib/marketdata-bars-contract')));
  const journal={schema:'scanner-rotation-collection.v1',reference_close:opts.refdate,as_of_timestamp:opts.asof,plan_sha256:planSha,input_sha256:inputSha,collector_sha256:collectorSha,bars_validator_sha256:barsValidatorSha,resolved_input:plan,status:'RUNNING',calls};
  fs.mkdirSync(opts.outDir,{recursive:true});
  function saveBytes(name,bytes) {fs.writeFileSync(path.join(opts.outDir,name),bytes,{flag:'wx'});return hash(bytes);}
  function save(name,value) { const bytes=JSON.stringify(value,null,2)+'\n'; return saveBytes(name,bytes); }
  save('plan.json',plan);
  async function request(decl,validate,{required=true,onError=null}={}) {
    const call={name:decl.name,server:'marketdata',tool:decl.tool,args_sha256:hash(stableStringify(decl.args)),ok:false}; calls.push(call);
    const source={name:decl.name,as_of:null,max_age_h:24,required,origin:`marketdata.${decl.tool}`,file:`${decl.name}.json`,reference_close:opts.refdate,expects_close:true}; sources.push(source);
    try {
      let payload=await client.callTool('marketdata',decl.tool,decl.args);
      if (payload?.job_id && ['pending','running'].includes(payload.status)) {
        save(`${decl.name}.initial.json`,payload);
        payload=await client.awaitJob('marketdata',payload.job_id);
      }
      source.sha256=save(source.file,payload); call.sha256=source.sha256;
      source.as_of=sourceTime(payload);
      const age=(now.getTime()-Date.parse(source.as_of))/36e5;
      if (age < -0.25 || age>24) throw Error('served capture time is future-dated or older than 24h');
      assertTerminal(payload);
      const result=validate(payload);
      source.data_through=opts.refdate;
      call.ok=true; return result;
    } catch(e) {
      call.error=client.redactSecrets ? client.redactSecrets(e.message) : e.message;
      source.error=call.error;
      if(!required&&onError)return onError(call.error);
      throw Error(`${decl.name}: ${call.error}`);
    }
  }
  async function requestEvidence(cfg) {
    const name=`sec_${cfg.symbol}`,file=`${name}.html`;
    const call={name,server:'sec-edgar',tool:'GET',args_sha256:hash(stableStringify({url:cfg.evidence_url})),ok:false};calls.push(call);
    const source={name,as_of:null,max_age_h:24,required:true,origin:'SEC EDGAR',url:cfg.evidence_url,file,reference_close:opts.refdate,expects_close:false,document_date:cfg.evidence_date,data_through:cfg.evidence_date};sources.push(source);
    try {
      const document=await fetchEvidence(cfg.evidence_url);
      const bytes=Buffer.isBuffer(document.bytes)?document.bytes:Buffer.from(document.bytes || '');
      source.sha256=saveBytes(file,bytes);call.sha256=source.sha256;
      source.as_of=document.captured_at;
      const age=(now.getTime()-Date.parse(source.as_of))/36e5;
      if (!Number.isFinite(age) || age < -0.25 || age>24) throw Error('SEC capture time is invalid, future-dated or older than 24h');
      if (document.final_url && document.final_url!==cfg.evidence_url) throw Error('SEC evidence redirected to an unexpected URL');
      validateSecEvidence(bytes,cfg,opts.refdate);call.ok=true;
      return {sha256:source.sha256,date:cfg.evidence_date};
    } catch(e) {call.error=client.redactSecrets ? client.redactSecrets(e.message) : e.message;throw Error(`${name}: ${call.error}`);}
  }
  let result;
  try {
    await request(declarations[0], payload=>{
      const report=barsContract.validateOperationReadiness(payload,{equityReferenceClose:opts.refdate,minimumBuild:barsContract.MIN_MARKETDATA_BUILD});
      if (report.errors.length) throw Error(report.errors.join(' | ')); return report;
    });
    const sectors=await request(declarations[1],payload=>validateSectorBars(payload,opts.refdate));
    const themes=await request(declarations[2],payload=>validateThemeBars(payload,opts.refdate));
    const cryptoRows=await request(declarations[3],payload=>validateDirectBatch(payload,directCryptoSymbols,'crypto_24_7_utc',opts.refdate));
    const equityRows=await request(declarations[4],payload=>validateDirectBatch(payload,directEquitySymbols,CALENDAR,opts.refdate));
    let direct_proxies=computeDirectProxies(new Map([...cryptoRows,...equityRows]),opts.refdate);
    const evidence=new Map();
    for (const cfg of DIRECT_CRYPTO_PROXIES) evidence.set(cfg.symbol,await requestEvidence(cfg));
    direct_proxies=direct_proxies.map(row=>({...row,evidence_date:evidence.get(row.symbol).date,evidence_sha256:evidence.get(row.symbol).sha256}));
    let references=[];
    for(let i=0;i<REFERENCES.length;i++) {
      const cfg=REFERENCES[i];
      references.push(await request(declarations[i+5],payload=>validateBeta(payload,cfg,opts.refdate),cfg.allowEmpty?{required:false,onError:error=>({key:cfg.key,label:cfg.label,reference:cfg.ref,group:cfg.group,window:'90 jours',asof:opts.refdate,quality:'unavailable',warning:themeUnavailableWarning(error),excluded_rows:0,rows:[]})}:undefined));
    }
    references=pinDirectProxies(references,direct_proxies);
    result={schema:'rotation-beta.v3',updated:new Date().toISOString(),asof:opts.refdate,
      window:{beta:'90 jours',perf:'5 et 20 séances US'},
      note:'Les 30 ETF thématiques sont classés sur leur performance à 1 mois, puis 1 semaine. Les co-mouvements utilisent au moins 50 rendements communs. Les repères crypto directs sont recalculés depuis les barres Marketdata.',
      methodology:{theme_count:THEMES.length,theme_rank:'perf_1m_desc_then_perf_1w_desc',rank_min_overlap:50,rank_min_dollar_adv:5000000,rank_min_price:3,direct_min_overlap:DIRECT_MIN_OVERLAP,direct_min_dollar_adv:DIRECT_MIN_DOLLAR_ADV,return_type:'log'},
      sectors,themes,references,direct_proxies,provenance:{plan_sha256:planSha,input_sha256:inputSha,collector_sha256:collectorSha,bars_validator_sha256:barsValidatorSha,equity_reference_close:opts.refdate,as_of_timestamp:opts.asof,sources:sources.map(s=>({file:s.file,sha256:s.sha256}))}};
    journal.status='PASS';
  } catch(e) {
    journal.status='BLOCKED'; journal.error=e.message; throw e;
  } finally {
    journal.finished_at=new Date().toISOString();
    save('collection.json',journal);
    save('harness.json',{schema:'scanner-rotation-harness.v1',content:opts.relative,generated_at:journal.finished_at,reference_close:opts.refdate,equity_reference_close:opts.refdate,plan_sha256:planSha,input_sha256:inputSha,collector_sha256:collectorSha,bars_validator_sha256:barsValidatorSha,sources});
    fs.mkdirSync(path.join(opts.outDir,'_wf'));
    save('_wf/rotation.json',{status:journal.status,blocking:journal.status!=='PASS',generated_at:journal.finished_at,error:journal.error || null});
  }
  const outputHash=save('rotation-beta.json',result);
  if (opts.refreshShared) {
    const bytes=fs.readFileSync(path.join(opts.outDir,'rotation-beta.json'));
    for (const relative of ['data/rotation-beta.json','portfolio/v1/rotation.json']) {
      const target=path.join(root,relative);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      const temporary=target+'.'+crypto.randomUUID()+'.tmp';
      fs.writeFileSync(temporary,bytes,{flag:'wx'});
      fs.renameSync(temporary,target);
    }
  }
  return {outDir:opts.outDir,sha256:outputHash,shared_updated:opts.refreshShared,result};
}
module.exports={run,assertTerminal,validateSectorBars,validateThemeBars,validateBeta,validateDirectCryptoBars,validateSecEvidence,regression,themeMatch,pinDirectProxies,themeUnavailableWarning,SECTORS,THEMES,REFERENCES,DIRECT_CRYPTO_PROXIES};
if (require.main===module) run().then(r=>console.log(`[gen-rotation-beta] validated local output: ${r.outDir}/rotation-beta.json sha256:${r.sha256}`)).catch(e=>{console.error(`[gen-rotation-beta] BLOCKED: ${mcp.redactSecrets(e.message)}`);process.exitCode=1;});
