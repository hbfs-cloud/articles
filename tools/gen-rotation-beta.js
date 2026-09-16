#!/usr/bin/env node
'use strict';
/** Strict marketdata-only rotation collector. Stages evidence and a validated output locally.
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
const REFERENCES = [
  { key: 'btc',    label: 'Bitcoin',        ref: 'BTC-USD',   minCorr: 0.55 },
  { key: 'eth',    label: 'Ethereum',       ref: 'ETH-USD',   minCorr: 0.60 },
  { key: 'sol',    label: 'Solana',         ref: 'SOL-USD',   minCorr: 0.60 },
  { key: 'gold',   label: 'Or',             ref: 'GC=F',      minCorr: 0.60 },
  { key: 'silver', label: 'Argent',         ref: 'SI=F',      minCorr: 0.60 },
  { key: 'crude',  label: 'Pétrole (WTI)',  ref: 'CL=F',      minCorr: 0.60 },
  { key: 'ai',     label: 'IA / Semis',     ref: 'NVDA',      minCorr: 0.55 },
  { key: 'eurusd', label: 'Euro (EUR/USD)', ref: 'EURUSD=X',  minCorr: 0.50 },
];

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
function validateSectorBars(payload, refdate) {
  const symbols = SECTORS.map(s => s.etf);
  const result = barsContract.validateQueryData(payload, { symbols: symbols.join(','), assetCalendar: CALENDAR, expectedCompletedEnd: refdate });
  if (result.errors.length) throw Error(result.errors.join(' | '));
  const map = new Map();
  for (const item of result.healthyCells) {
    if (!symbols.includes(item.id) || item.status !== 'completed' || !item.row) throw Error(`unexpected or unavailable sector ${item.id}`);
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
  if (map.size !== symbols.length) throw Error('incomplete sector universe');
  return SECTORS.map(s => {
    const b = map.get(s.etf), last = b.at(-1).close;
    const perf_1w = +((last / b.at(-6).close - 1) * 100).toFixed(2);
    const perf_1m = +((last / b.at(-21).close - 1) * 100).toFixed(2);
    return { ...s, last: +last.toFixed(2), perf_1w, perf_1m, dir: perf_1w > 0.15 ? 'up' : perf_1w < -0.15 ? 'down' : 'flat' };
  }).sort((a,b) => b.perf_1w - a.perf_1w || a.etf.localeCompare(b.etf));
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
    const n = row.overlap ?? row.n_obs ?? row.observations ?? row.n;
    if (n != null && (!Number.isInteger(n) || n < 30)) throw Error(`${cfg.ref}/${row.symbol}: fewer than 30 overlapping observations`);
    for (const key of ['served_completed_end', 'data_through', 'as_of']) if (row[key] != null && String(row[key]).slice(0,10) !== refdate) throw Error(`${cfg.ref}/${row.symbol}: stale regression window`);
    if (row.last_price != null && (typeof row.last_price !== 'number' || !Number.isFinite(row.last_price) || row.last_price <= 0)) throw Error(`${cfg.ref}/${row.symbol}: invalid price`);
  }
  const positive = item.rows.filter(r => r.correlation > 0);
  const inverseExcluded = item.rows.length - positive.length;
  if (!positive.length) throw Error(`${cfg.ref}: no positively-correlated beta proxy (${inverseExcluded} inverse proxies only)`);
  const rows = [...positive].sort((a,b) => b.beta - a.beta || a.symbol.localeCompare(b.symbol)).slice(0,6).map(r => ({
    symbol: r.symbol, beta: +r.beta.toFixed(2), correlation: +r.correlation.toFixed(2), r2: +r.r2.toFixed(2),
    last_price: r.last_price == null ? null : +r.last_price.toFixed(2), sector: r.sector || '', industry: r.industry || '',
  }));
  return { key: cfg.key, label: cfg.label, reference: cfg.ref, window: item.window || '90d', asof: refdate, quality: 'usable', warning: null, inverse_excluded: inverseExcluded, rows };
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
async function run({ argv=process.argv.slice(2), env=process.env, root=ROOT, client=mcp, now=new Date() }={}) {
  root=fs.realpathSync(root);
  const opts=options(argv,env,root,now);
  if (!client.canCallDirectly('marketdata')) throw Error('marketdata token missing or expired; rotation did not run');
  const declarations=[{name:'status',tool:'GetStatus',args:{}},
    {name:'bars_sectors',tool:'QueryData',args:{symbols:SECTORS.map(s=>s.etf).join(','),types:'bars_daily',limit:30,force_async:true,as_of_timestamp:opts.asof,completion_policy:'completed_only'},asset_calendar:CALENDAR,expected_completed_end:opts.refdate},
    ...REFERENCES.map(cfg=>({name:`beta_${cfg.key}`,tool:'RankBeta',args:{reference:cfg.ref,universe_asset:'stock',universe_region:'US',min_correlation:cfg.minCorr,min_dollar_adv:5e6,min_price:3,min_overlap:30,lookback_days:90,top_k:12,as_of:opts.refdate}}))];
  const plan={schema:'scanner-rotation-plan.v1',reference_close:opts.refdate,as_of_timestamp:opts.asof,calls:declarations};
  const planSha=hash(JSON.stringify(plan,null,2)+'\n'), inputSha=hash(stableStringify(plan)), sources=[], calls=[];
  const collectorSha=hash(fs.readFileSync(__filename));
  const barsValidatorSha=hash(fs.readFileSync(require.resolve('./lib/marketdata-bars-contract')));
  const journal={schema:'scanner-rotation-collection.v1',reference_close:opts.refdate,as_of_timestamp:opts.asof,plan_sha256:planSha,input_sha256:inputSha,collector_sha256:collectorSha,bars_validator_sha256:barsValidatorSha,resolved_input:plan,status:'RUNNING',calls};
  fs.mkdirSync(opts.outDir,{recursive:true});
  function save(name,value) { const bytes=JSON.stringify(value,null,2)+'\n'; fs.writeFileSync(path.join(opts.outDir,name),bytes,{flag:'wx'}); return hash(bytes); }
  save('plan.json',plan);
  async function request(decl,validate) {
    const call={name:decl.name,server:'marketdata',tool:decl.tool,args_sha256:hash(stableStringify(decl.args)),ok:false}; calls.push(call);
    const source={name:decl.name,as_of:null,max_age_h:24,required:true,origin:`marketdata.${decl.tool}`,file:`${decl.name}.json`,reference_close:opts.refdate,expects_close:true}; sources.push(source);
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
    } catch(e) {call.error=client.redactSecrets ? client.redactSecrets(e.message) : e.message; throw Error(`${decl.name}: ${call.error}`);}
  }
  let result;
  try {
    await request(declarations[0], payload=>{
      const report=barsContract.validateOperationReadiness(payload,{equityReferenceClose:opts.refdate,minimumBuild:barsContract.MIN_MARKETDATA_BUILD});
      if (report.errors.length) throw Error(report.errors.join(' | ')); return report;
    });
    const sectors=await request(declarations[1],payload=>validateSectorBars(payload,opts.refdate));
    const references=[];
    for (let i=0;i<REFERENCES.length;i++) references.push(await request(declarations[i+2],payload=>validateBeta(payload,REFERENCES[i],opts.refdate)));
    result={schema:'rotation-beta.v1',updated:new Date().toISOString(),asof:opts.refdate,
      window:{beta:'90 jours',perf:'5 et 20 séances US'},
      note:'Beta serveur marketdata. Performances sectorielles calculées sur 5 et 20 séances US terminées. Valeurs-phares indicatives, sans classement de performance.',
      sectors,references,provenance:{plan_sha256:planSha,input_sha256:inputSha,collector_sha256:collectorSha,bars_validator_sha256:barsValidatorSha,equity_reference_close:opts.refdate,as_of_timestamp:opts.asof,sources:sources.map(s=>({file:s.file,sha256:s.sha256}))}};
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
module.exports={run,assertTerminal,validateSectorBars,validateBeta,SECTORS,REFERENCES};
if (require.main===module) run().then(r=>console.log(`[gen-rotation-beta] validated local output: ${r.outDir}/rotation-beta.json sha256:${r.sha256}`)).catch(e=>{console.error(`[gen-rotation-beta] BLOCKED: ${mcp.redactSecrets(e.message)}`);process.exitCode=1;});
