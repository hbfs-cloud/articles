#!/usr/bin/env node
'use strict';
// Inventaire COMPLET des dépôts EDGAR d'une fenêtre, par émetteur, avec les codes d'items des 8-K.
// Complète collect-sec-batch.js, qui ne retient que le dernier dépôt de chaque famille cœur : un 8-K
// item 3.02/3.03 plus ancien, masqué par un 8-K récent, lui échappe, et il ignore 424B1/2/4/7/8.
// Source : index officiel EDGAR (data.sec.gov/submissions), aucune interprétation d'un texte ici :
// forme et items sont des champs structurés du dépôt. Classification finale = lecture du dépôt primaire.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const UA = 'DailyTickers research contact@dailytickers.com';
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const dir = arg('--dir'), since = arg('--since'), until = arg('--until'), tickers = (arg('--tickers') || '').split(',').filter(Boolean);
if (!dir || !since || !until || !tickers.length) { console.error('Usage: sec-window-inventory.js --dir scanner/YYYYMMDD --since YYYY-MM-DD --until YYYY-MM-DD --tickers A,B'); process.exit(2); }
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scanner-filters.json'), 'utf8')).sec_offering_policy;
const BLOCK_FORMS = new Set(policy.blocking_forms), BLOCK_ITEMS = new Set(policy.blocking_8k_items);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (r.ok) return r.json();
    if (![429, 500, 502, 503, 504].includes(r.status)) throw new Error(`${r.status} ${url}`);
    await sleep(2000 * 2 ** a);
  }
  throw new Error(`SEC request failed: ${url}`);
}
(async () => {
  const map = new Map(Object.values(await getJson('https://www.sec.gov/files/company_tickers.json')).map(x => [String(x.ticker).toUpperCase(), x]));
  const out = { generatedAt: new Date().toISOString(), since, until, source: 'SEC EDGAR data.sec.gov/submissions (index structuré)', policy: 'data/scanner-filters.json#sec_offering_policy', issuers: {} };
  for (const t of tickers) {
    const c = map.get(t); if (!c) { out.issuers[t] = { error: 'absent de company_tickers.json' }; continue; }
    const cik = String(c.cik_str).padStart(10, '0');
    const r = (await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`)).filings.recent;
    const rows = r.accessionNumber.map((accession, i) => ({ accession, date: r.filingDate[i], form: r.form[i], items: r.items?.[i] || '', doc: r.primaryDocument[i] }))
      .filter(x => x.date >= since && x.date <= until);
    const hits = rows.filter(x => BLOCK_FORMS.has(x.form) || (/^8-K/.test(x.form) && x.items.split(',').some(i => BLOCK_ITEMS.has(i.trim()))))
      .map(x => ({ ...x, url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${x.accession.replace(/-/g, '')}/${x.doc}`, why: BLOCK_FORMS.has(x.form) ? 'blocking_form' : 'blocking_8k_item' }));
    out.issuers[t] = { cik, company: c.title, filings_in_window: rows.length, forms: [...new Set(rows.map(x => x.form))].sort(), hits,
      filings: rows.map(x => ({ accession: x.accession, date: x.date, form: x.form, items: x.items, url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${x.accession.replace(/-/g, '')}/${x.doc}` })) };
    await sleep(150);
  }
  const file = path.join(ROOT, dir, '_sec-discovery', 'window-inventory.json');
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  const flagged = Object.entries(out.issuers).filter(([, v]) => v.hits && v.hits.length);
  console.log(`[sec-inventory] ${tickers.length} émetteur(s), ${flagged.length} avec dépôt bloquant -> ${path.relative(ROOT, file)}`);
  for (const [t, v] of flagged) console.log(`  ${t}: ` + v.hits.map(h => `${h.form}${h.items ? '[' + h.items + ']' : ''}@${h.date}`).join(' '));
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
