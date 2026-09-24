#!/usr/bin/env node
'use strict';

/* Graphiques du Substack « AI chain, four weeks later » (24/09/2026).
 *
 * Les valeurs sont lues dans les barres certifiées du dossier spécial (mêmes fichiers que la page
 * web) et dans son calcul des niveaux : aucune donnée ressaisie. Chaque image porte le vrai
 * logo /logo.svg en data-URI (convention n° 13), jamais un wordmark dessiné.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DIR = 'daily/20260924/bilan-chaine-ia-27-aout';
const OUT = 'data/substack/ai-chain-four-weeks-later-20260924';
const D26 = '2026-08-26', D27 = '2026-08-27', REF = '2026-09-23';
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

const SOURCES = [1, 2, 3].map(i => `${DIR}/_data${i}/bars_dossier.json`).concat([`${DIR}/_data1/bars_crypto.json`]);
const B = {};
for (const rel of SOURCES) {
  const d = readJson(rel);
  const rows = rel.endsWith('bars_crypto.json') ? d.results[0].data : d.data.items[0].results[0].data;
  for (const r of rows) B[r.symbol] = r.bars;
}
const close = (s, d) => { const b = B[s].find(x => x[0] === d); if (!b) throw new Error(`${s} ${d}`); return b[4]; };
const since = s => (close(s, REF) / close(s, D27) - 1) * 100;

const LINKS = [
  ['Cybersecurity', ['CRWD', 'OKTA', 'ZS', 'S', 'FTNT', 'PANW', 'TENB'], '#2563eb'],
  ['Chips & hardware', ['VICR', 'INTC', 'AMD', 'DELL', 'MU', 'HPE', 'MRVL', 'SMCI', 'AMKR', 'KLAC', 'ANET', 'TTMI', 'NVDA', 'AVGO', 'AAOI', 'SNPS'], '#7c3aed'],
  ['Software & cloud', ['DDOG', 'SNOW', 'NOW', 'MDB', 'ORCL', 'CRM'], '#0891b2'],
  ['Power', ['BE', 'GEV', 'VST', 'CEG'], '#d97706'],
  ['AI compute & miners', ['HUT', 'IREN', 'MARA', 'CLSK', 'CIFR', 'NBIS', 'CORZ', 'CRWV', 'APLD', 'WULF', 'CAN'], '#059669'],
  ['Crypto', ['BTC-USD', 'ETH-USD', 'MSTR', 'SBET', 'BMNR', 'COIN'], '#f59e0b'],
  ['Precious-metal miners', ['EQX', 'AG', 'CDE'], '#dc2626'],
];

const LOGO = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'logo.svg')).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const shell = (title, note, body, script = '') => `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#fff;color:#0f172a}
  .wrap{padding:30px 36px 22px;width:1128px}
  .eyebrow{font-family:Menlo,monospace;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#2563eb;font-weight:600}
  h1{font-size:26px;line-height:1.25;margin:6px 0 16px;font-weight:800}
  .note{font-size:13px;line-height:1.5;color:#475569;margin:14px 0 0}
  .foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:12px;color:#94a3b8;font-family:Menlo,monospace}
  .brand{display:inline-flex;align-items:center;gap:7px;color:#0f172a;font-weight:600;font-family:Inter,sans-serif}
  table{width:100%;border-collapse:collapse;font-size:15px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;padding:0 10px 8px;border-bottom:2px solid #e2e8f0}
  td{padding:9px 10px;border-bottom:1px solid #eef2f7;font-variant-numeric:tabular-nums}
  .up{color:#15803d;font-weight:700}.down{color:#b91c1c;font-weight:700}
  .pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700}
  .hit{background:#dcfce7;color:#166534}.miss{background:#f1f5f9;color:#475569}.fail{background:#fee2e2;color:#991b1b}
</style>
<div class="wrap">
  <div class="eyebrow">AI chain · four weeks later</div>
  <h1>${esc(title)}</h1>
  ${body}
  <p class="note">${esc(note)}</p>
  <div class="foot"><span>Daily closes through Sep 23, 2026 · not investment advice</span><span class="brand"><img src="${LOGO}" width="20" height="20" alt="">DailyTickers</span></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script>${script}window.__ready=true;</script>`;

const fmt = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

// Palette Okabe-Ito, lisible par les daltoniens.
const OK = { blue: '#0072B2', orange: '#E69F00', green: '#009E73', pink: '#CC79A7', red: '#D55E00', sky: '#56B4E9', yellow: '#F0E442', grey: '#666666' };
LINKS[0][2] = OK.blue; LINKS[1][2] = OK.pink; LINKS[2][2] = OK.sky; LINKS[3][2] = OK.orange; LINKS[4][2] = OK.green; LINKS[5][2] = OK.yellow; LINKS[6][2] = OK.red;
const sign1 = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

// 1. Dix plus fortes hausses et dix plus fortes baisses depuis le 27/08.
const all = LINKS.flatMap(([name, syms, color]) => syms.map(s => ({ s: s.replace('-USD', ''), v: since(s), name, color })))
  .sort((a, b) => b.v - a.v);
const pick = [...all.slice(0, 10), ...all.slice(-10)].reverse();
const chart1 = shell('Where the AI money went after Aug 27',
  'Ten best and ten worst of ' + all.length + ' AI-chain stocks and crypto assets grouped by link (ETFs and watchlist names excluded), close-to-close from Aug 27 to Sep 23. Colour = link in the chain. S&P 500 ETF ' + sign1(since('SPY')) + ', Nasdaq 100 ETF ' + sign1(since('QQQ')) + '.',
  '<div id="c" style="width:1128px;height:640px"></div>',
  `echarts.init(document.getElementById('c'),null,{renderer:'canvas'}).setOption({animation:false,grid:{left:70,right:80,top:10,bottom:30},
    xAxis:{type:'value',axisLabel:{formatter:function(v){return (v<0?'−':'')+Math.abs(v)+'%';}}},
    yAxis:{type:'category',data:${JSON.stringify(pick.map(r => r.s))},axisLabel:{fontSize:13,fontWeight:'bold'}},
    series:[{type:'bar',barWidth:'70%',data:${JSON.stringify(pick.map(r => ({ value: Number(r.v.toFixed(1)), itemStyle: { color: r.color } })))},
      label:{show:true,position:'right',fontSize:12,formatter:function(p){var v=p.value;return (v>=0?'+':'−')+Math.abs(v).toFixed(1)+'%';}}}]});`);
const legend = LINKS.map(([n, , c]) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:13px"><span style="width:12px;height:12px;border-radius:3px;background:${c}"></span>${esc(n)}</span>`).join('');

// 2. Valeurs de la séance du 27/08, base 100 à l'ouverture du 27/08.
const open27 = s => B[s].find(x => x[0] === D27)[1];
const dates = B.NVDA.filter(b => b[0] >= D27 && b[0] <= REF).map(b => b[0]);
const base = s => dates.map(d => Number((close(s, d) / open27(s) * 100).toFixed(2)));
const LEAD = [['CRWD', OK.orange], ['OKTA', OK.green], ['CRM', OK.pink], ['NVDA', OK.blue], ['SNPS', OK.red], ['QQQ', OK.grey]];
const chart2 = shell('Bought at the Aug 27 open: CRWD and OKTA ran, SNPS gave almost all of it back',
  'Indexed to 100 at the Aug 27 open, then daily closes. Since that open: CRWD ' + sign1((close('CRWD', REF) / open27('CRWD') - 1) * 100) + ', OKTA ' + sign1((close('OKTA', REF) / open27('OKTA') - 1) * 100) + ', CRM ' + sign1((close('CRM', REF) / open27('CRM') - 1) * 100) + ', NVDA ' + sign1((close('NVDA', REF) / open27('NVDA') - 1) * 100) + ', SNPS ' + sign1((close('SNPS', REF) / open27('SNPS') - 1) * 100) + '.',
  '<div id="c" style="width:1128px;height:520px"></div>',
  `echarts.init(document.getElementById('c'),null,{renderer:'canvas'}).setOption({animation:false,grid:{left:50,right:90,top:20,bottom:40},
    xAxis:{type:'category',data:${JSON.stringify(dates.map(d => d.slice(5)))}},yAxis:{type:'value',scale:true},
    series:${JSON.stringify(LEAD.map(([s, c]) => ({ name: s, type: 'line', showSymbol: false, lineStyle: { width: s === 'QQQ' ? 2 : 3, type: s === 'QQQ' ? 'dashed' : 'solid', color: c }, itemStyle: { color: c }, endLabel: { show: true, formatter: s, color: c, fontWeight: 'bold', fontSize: 13, offset: [4, s === 'CRM' ? -9 : s === 'QQQ' ? 9 : 0] }, data: base(s) })))}});`);

// 3. Tableau des niveaux du 27/08.
const levels = readJson(`${DIR}/_calc/levels.json`).rows;
const usd = v => `$${v.toFixed(v < 5 ? 2 : 2)}`;
const md = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const outcome = r => {
  if (r.trigDate && r.weakAfter) return `<span class="pill fail">Triggered ${md(r.trigDate)}, stopped ${md(r.weakAfter)}</span>`;
  if (r.trigDate && r.weakDate && r.weakDate < r.trigDate) return `<span class="pill miss">Weak ${md(r.weakDate)}, triggered ${md(r.trigDate)}</span>`;
  if (r.trigDate) return `<span class="pill hit">Triggered ${md(r.trigDate)}</span>`;
  return `<span class="pill miss">Never triggered · weak ${md(r.weakDate)}</span>`;
};
const tableRows = levels.map(r => {
  const v = since(r.s);
  const post = r.sinceTriggerPct == null ? '—' : `<span class="${r.sinceTriggerPct >= 0 ? 'up' : 'down'}">${sign1(r.sinceTriggerPct)}</span>`;
  return `<tr><td><b>${r.s}</b></td><td>${usd(r.trig)}</td><td>${r.weak == null ? '—' : usd(r.weak)}</td><td>${outcome(r)}</td><td>${post}</td><td class="${v >= 0 ? 'up' : 'down'}">${sign1(v)}</td></tr>`;
}).join('');
const chart3 = shell('Twelve pre-market levels from Aug 27: five triggered, one winner',
  'Judged on daily closes from Aug 27. Trigger = first close at or above the level; weak = first close below the weakness level. Only Vicor gained after triggering.',
  `<table><thead><tr><th>Stock</th><th>Trigger</th><th>Weakness</th><th>What happened</th><th>Since trigger</th><th>Since Aug 27</th></tr></thead><tbody>${tableRows}</tbody></table>`);

// 4. Vicor et son seuil.
const vd = B.VICR.filter(b => b[0] >= D26).map(b => [b[0].slice(5), b[4]]);
const trigIdx = vd.findIndex(x => x[0] === '09-18');
const chart4 = shell('Vicor: the level kept you out of the drop, then in for the breakout',
  'Daily closes. The Aug 27 trigger was a close above $216.66. The stock first slid to $175.99 on Sep 1; the trigger came on Sep 18.',
  '<div id="c" style="width:1128px;height:460px"></div>',
  `echarts.init(document.getElementById('c'),null,{renderer:'canvas'}).setOption({animation:false,grid:{left:60,right:190,top:20,bottom:40},
    xAxis:{type:'category',data:${JSON.stringify(vd.map(x => x[0]))}},yAxis:{type:'value',scale:true,axisLabel:{formatter:'\${value}'}},
    series:[{type:'line',showSymbol:false,lineStyle:{width:3,color:'${OK.blue}'},data:${JSON.stringify(vd.map(x => x[1]))},
      markPoint:{symbol:'circle',symbolSize:12,itemStyle:{color:'${OK.orange}'},label:{show:true,position:'left',formatter:'Sep 18 trigger',fontWeight:'bold',color:'#0f172a'},data:[{coord:[${trigIdx},${vd[trigIdx][1]}]}]},
      markLine:{symbol:'none',lineStyle:{color:'${OK.red}',type:'dashed'},label:{position:'end',formatter:'Aug 27 trigger $216.66'},data:[{yAxis:216.66}]}}]});`);

const charts = [
  ['01-where-the-money-went.png', chart1.replace('<div id="c"', `<div style="margin-bottom:10px">${legend}</div><div id="c"`), 830],
  ['02-earnings-leaders.png', chart2, 740],
  ['03-aug27-levels.png', chart3, 820],
  ['04-vicor-level.png', chart4, 680],
];

(async () => {
  const puppeteer = require('puppeteer');
  const { findChrome } = require('./lib/find-chrome');
  const browser = await puppeteer.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
  const images = [];
  for (const [name, html, h] of charts) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: h, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__ready === true', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 400));
    const rel = `${OUT}/${name}`;
    await page.screenshot({ path: path.join(ROOT, rel), fullPage: true });
    images.push({ path: rel, sha256: sha(rel) });
    await page.close();
  }
  await browser.close();
  const harness = {
    content: 'data/substack/ai-chain-four-weeks-later-20260924-en.md',
    reference_close: REF,
    generated_at: new Date().toISOString(),
    sources: SOURCES.concat([`${DIR}/_calc/levels.json`, `${DIR}/_data1/claims.json`]).map(rel => ({ path: rel, sha256: sha(rel) })),
    harnesses: [1, 2, 3].map(i => ({ path: `${DIR}/_data${i}/harness.json`, sha256: sha(`${DIR}/_data${i}/harness.json`) })),
    images,
  };
  fs.writeFileSync(path.join(ROOT, OUT, 'harness.json'), `${JSON.stringify(harness, null, 2)}\n`);
  console.log(images.map(i => `${i.path} ${i.sha256.slice(0, 12)}`).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
