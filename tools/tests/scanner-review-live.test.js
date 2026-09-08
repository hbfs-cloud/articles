'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { guardStatusHtml, freezeStatusHtml } = require('../lib/scanner-review-live');
const root = path.resolve(__dirname, '../..');
const generator = fs.readFileSync(path.join(root, 'tools/gen-status-page.js'), 'utf8');
const guarded = guardStatusHtml(generator);
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'runtime hook exists');
  return source.slice(a, b);
}
const tracker = section(guarded, '// ── Signal Live Tracker v2', '</script>')
  .replace(/var _pSizeMap=\$\{[^\n]+/, 'var _pSizeMap={best:1,balanced:1};');
const actions = section(guarded, '  function updateLiveActions(modeId){', '  // Hide STALE orders only.')
  .replace('setTimeout(updateLiveActions, 800);', 'updateLiveActions();');
let browser;
test.before(async () => {
  const puppeteer = require('puppeteer');
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
});
test.after(async () => { if (browser) await browser.close(); });

async function pageWith(html) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => req.abort()); // No financial/provider network in regression tests.
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const OriginalDate = Date;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ['2026-09-08T15:00:00Z'])); }
      static now() { return new OriginalDate('2026-09-08T15:00:00Z').getTime(); }
    };
    window._v = 'test'; window.calls = []; window.added = [];
    window.modeCharts = { balanced:{d:['09/04'],v:[100]},best:{d:['09/04'],v:[100]} };
    window.LE = {
      addTickers(ts) { window.added.push(...ts); },
      getPrices() { return { EQ:{price:110,open:100,dayHigh:116,dayLow:95,changePct:10},DTX:{price:110,open:100,dayHigh:116,dayLow:95,changePct:10} }; }
    };
    window.fetch = async url => {
      calls.push(url);
      return { ok:true, json:async () => url.includes('allorigins')
        ? {contents:JSON.stringify({chart:{result:[{meta:{regularMarketPrice:110}}]}})}
        : {modes:{balanced:{breakevenPct:1},best:{breakevenPct:1}}} };
    };
  });
  return page;
}
function panel(id, asset, ticker) {
  return `<div id="p-${id}" class="mode-panel" data-asset-class="${asset}" data-psize="1"><div class="live-content">
    <div class="section-card" id="sec-pos-${id}" data-section="positions"><h3>Open Positions</h3><div class="sc-head"></div><table><tbody><tr data-pos-ticker="${ticker}"><td><b>${ticker}</b></td><td>09/04</td><td>100</td><td class="hide-m">100</td><td class="pos"><b>0%</b></td></tr></tbody></table></div>
    <div class="section-card"><table><tbody><tr data-sig-ticker="${ticker}" data-sig-entry="100" data-sig-stop="90" data-sig-tp1="115" data-sig-tp2="120" data-sig-rank="primary" data-sig-price="100"><td>${ticker}</td><td>0</td><td>test</td><td>100</td><td><span class="pill">historical</span></td></tr></tbody></table></div>
    <div id="sec-hist-${id}"><table><tbody><tr><td>historical trade</td></tr></tbody></table></div></div></div>`;
}

test('overlay guards are idempotent, static-safe, DTX unchanged, and fail on partial live hooks', () => {
  assert.equal(freezeStatusHtml('<body>historical</body>'), '<body>historical</body>');
  const html = panel('balanced','equity','EQ') + panel('best','dtx','DTX');
  const frozen = freezeStatusHtml(html);
  assert.equal(freezeStatusHtml(frozen), frozen);
  assert.ok(frozen.endsWith(panel('best','dtx','DTX')));
  assert.throws(() => guardStatusHtml('// ── Signal Live Tracker v2\npartial'), /missing\/ambiguous/);
  assert.equal(guardStatusHtml(guarded), guarded);
  const assets = freezeStatusHtml('<link href="/assets/report.css?v=old"><script src="/assets/live-engine-ui.js?v=old"></script><script src="/assets/live-engine.js?v=old"></script>');
  assert.ok(assets.includes('/assets/report.css?v=scanner-review-v1'));
  assert.ok(assets.includes('/assets/live-engine-ui.js?v=scanner-review-v1'));
  assert.ok(assets.includes('/assets/live-engine.js?v=old'));
  assert.equal(freezeStatusHtml(assets), assets);
});

test('15:00 UTC: non-DTX rows/history/equity stay unchanged; no quote or ticker request', async () => {
  const page = await pageWith(freezeStatusHtml('<button class="mode-tab active" data-mode="balanced"></button>'+panel('balanced','equity','EQ')));
  try {
    const before = await page.$eval('#p-balanced', el => el.innerHTML);
    await page.addScriptTag({content:tracker+'\n'+actions});
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40)));
    assert.equal(await page.$eval('#p-balanced', el => el.innerHTML), before);
    const result = await page.evaluate(() => ({calls,added,curve:modeCharts.balanced}));
    assert.deepEqual(result.added, []);
    assert.ok(result.calls.every(url => url.startsWith('/data/modes-config.json')));
    assert.deepEqual(result.curve, {d:['09/04'],v:[100]});
  } finally { await page.close(); }
});

test('15:00 UTC: DTX still evaluates live signals and MtM; default non-DTX stays live', async () => {
  for (const [mode, asset, ticker, scoped] of [['best','dtx','DTX',true],['balanced','equity','EQ',false]]) {
    const html = `<button class="mode-tab active" data-mode="${mode}"></button>`+panel(mode,asset,ticker);
    const page = await pageWith(scoped ? freezeStatusHtml(html) : html);
    try {
      await page.addScriptTag({content:tracker});
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40)));
      const result = await page.evaluate(() => ({calls,added,live:document.querySelectorAll('[data-sig-live]').length}));
      assert.ok(result.added.includes(ticker));
      assert.ok(result.calls.some(url => url.includes('allorigins')), 'existing MtM remains active');
      assert.ok(result.live > 0, 'positive control: existing fill evaluation remains active');
    } finally { await page.close(); }
  }
});

test('real status artifact freezes every non-DTX panel before the actual inline runtime', async () => {
  const html = fs.readFileSync(path.join(root,'scanner/status/index.html'),'utf8');
  const page = await pageWith(html);
  try {
    const panels = await page.$$eval('.mode-panel', es => es.map(e => ({id:e.id,asset:e.dataset.assetClass,frozen:e.dataset.publicationReview,html:e.innerHTML})));
    assert.ok(panels.some(p => p.asset === 'dtx'));
    for (const p of panels) assert.equal(p.frozen, p.asset === 'dtx' ? undefined : '1', p.id);
    const liveCode = section(html, '// ── Signal Live Tracker v2', '</script>');
    await page.addScriptTag({content:liveCode});
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40)));
    for (const p of panels.filter(p => p.asset !== 'dtx')) assert.equal(await page.$eval('#'+p.id,e=>e.innerHTML),p.html,p.id);
  } finally { await page.close(); }
});

test('LiveEngine UI boots and reloads snapshots with DTX positions only during review', async () => {
  const page = await pageWith(freezeStatusHtml(panel('balanced','equity','EQ')+panel('best','dtx','DTX')));
  try {
    await page.evaluate(()=>document.querySelectorAll('.live-content').forEach(e=>e.replaceWith(...e.childNodes)));
    const before = await page.$eval('#p-balanced', e=>e.innerHTML);
    await page.evaluate(() => {
      window.inits=[]; window.refreshes=[]; window.polls=[]; window.snapshotDate='20260904'; window.bootErrors=[];
      console.warn=(...args)=>bootErrors.push(args.map(a=>a?.stack||String(a)).join(' '));
      window.setInterval=fn=>{polls.push(fn);return polls.length;};
      window.LiveEngine={on(){},init(opts){inits.push(opts)},refreshPositions(p){refreshes.push(p)},isMarketOpen(){return true},getStatusInfo(){return {label:'OPEN',color:'#888'}},getPrice(){return null},getEval(){return null}};
      window.fetch=async url=>({json:async()=>url.includes('modes-config')?{modes:{balanced:{assetClass:'equity'},best:{assetClass:'dtx'}}}:url.includes('dates.json')?[snapshotDate]:{modes:{balanced:{positions:[{ticker:'EQ',entry:100}]},best:{positions:[{ticker:'DTX',entry:100}]}}}});
    });
    await page.addScriptTag({path:path.join(root,'assets/live-engine-ui.js')});
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    const init = await page.evaluate(()=>inits);
    assert.equal(init.length,1,JSON.stringify(await page.evaluate(()=>bootErrors)));
    assert.deepEqual(Object.keys(init[0].positions),['best']);
    assert.deepEqual(Object.keys(init[0].modesCfg),['best']);
    assert.equal(await page.$eval('#p-balanced',e=>e.innerHTML),before);
    await page.evaluate(()=>{snapshotDate='20260908';polls.forEach(fn=>fn());});
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    const refresh=await page.evaluate(()=>refreshes);
    assert.equal(refresh.length,1);
    assert.deepEqual(Object.keys(refresh[0]),['best']);
    assert.equal(await page.$eval('#p-balanced',e=>e.innerHTML),before);
  } finally { await page.close(); }
});
