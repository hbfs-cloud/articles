#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2).filter(x => !x.startsWith('--'));
const strict = process.argv.includes('--strict');
const preReview = process.argv.includes('--pre-review');
const files = args.length ? args : [];

const strip = value => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z0-9#]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const words = value => strip(value).split(/\s+/).filter(Boolean);
const hasNumber = value => /(?:\$|\d[\d,.]*\s?(?:%|x|M|B|bn|million|billion)?)/i.test(strip(value));
const mentionsLevel = (value, level) => {
  if (!Number.isFinite(level)) return false;
  const candidates = [level.toFixed(2), level.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''), String(level)];
  return candidates.some(x => strip(value).includes(x));
};
const tokenSet = value => new Set(words(value.toLowerCase()).filter(x => x.length > 4));
const similarity = (a, b) => {
  const aa = tokenSet(a), bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter(x => bb.has(x)).length;
  return intersection / new Set([...aa, ...bb]).size;
};

function check(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const d = JSON.parse(raw);
  const ticker = d.header?.ticker || path.basename(file, '.json');
  const errors = [], warnings = [];
  const require = (ok, message) => { if (!ok) errors.push(message); };
  const warn = (ok, message) => { if (!ok) warnings.push(message); };
  const summary = d.verdict?.summary || '';
  const buy = d.verdict?.whyBuy || [], avoid = d.verdict?.whyAvoid || [];
  const overview = d.business?.overview || '';
  const paragraphs = (overview.match(/<p(?:\s[^>]*)?>/gi) || []).length;
  const beatNote = d.earnings?.beatNote || '';
  const rows = d.fundamentals?.rows || [];
  const news = d.news || [];
  const valuationRows = rows.filter(x => /valuation|P\/E|EV\/|FCF|NAV|book value|yield|price\/sales|enterprise value/i.test(x.metric));
  const usableValuationRows = valuationRows.filter(x => hasNumber(`${x.value} ${x.signal}`));
  const valuationText = valuationRows.map(x => `${x.metric} ${x.value} ${x.signal}`).join(' ');
  const risks = d.filingsReview?.contrarianRisks || [];
  const filingRows = d.filingsReview?.filings || [];
  const riskCards = d.risks?.riskCards || [];
  const trade = d.tradeIdea || {};
  const entry = Number(trade.entry), stop = Number(trade.stop), tp1 = Number(trade.tp1), tp2 = Number(trade.tp2);
  const banned = [
    'The economic link can be genuine while',
    'Quality credit comes from reported growth',
    'Company filings and entry geometry override the sector label',
    'Require company-specific confirmation, not group sympathy',
    'A real economic link to AI, power, crypto or metals does not guarantee'
  ];
  const editorialText = [summary, ...buy, ...avoid, overview, d.business?.moat, beatNote,
    d.capitalStructure?.shareHistory, ...risks, d.technicals?.setupNote, d.macro?.impact,
    d.risks?.riskSummary, d.risks?.pedagogy, trade.thesis, ...(trade.catalysts || []),
    ...(trade.invalidation || [])].join(' ');

  if (!preReview) {
    const reviewDate = String(d.meta?.date || '').replace(/-/g, '');
    const reviewFile = path.join(ROOT, 'data', 'analysis-editorial-reviews', `${reviewDate}.json`);
    const manifest = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, 'utf8')) : {};
    const review = (manifest.reviews || []).find(x => x.ticker === ticker);
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    require(review?.rubricVersion === 'AQ-1', 'missing AQ-1 external review manifest entry');
    require(review?.status === 'PASS', 'external editorial review is not PASS');
    require(Number(review?.score) >= 80, `external editorial score below 80 (${review?.score ?? 'missing'})`);
    require(Array.isArray(review?.reviewers) && review.reviewers.length >= 2, 'external review needs at least two named reviewers');
    require(Array.isArray(review?.passedCheckIds) && review.passedCheckIds.length === 38, 'external review lacks all 38 AQ-1 per-check attestations');
    require(Array.isArray(review?.failedCheckIds) && review.failedCheckIds.length === 0, 'external review retains failed AQ checks');
    require(review?.fileSha256 === digest, 'external review hash does not match dossier JSON');
  }
  require(words(summary).length >= 90, `verdict summary too short (${words(summary).length} words)`);
  require(words(summary).length <= 210, `verdict summary too long (${words(summary).length} words)`);
  require(buy.length >= 4, `whyBuy needs >=4 bullets (${buy.length})`);
  require(avoid.length >= 4, `whyAvoid needs >=4 bullets (${avoid.length})`);
  require(buy.filter(hasNumber).length >= 3, 'whyBuy needs >=3 numeric bullets');
  require(avoid.filter(hasNumber).length >= 2, 'whyAvoid needs >=2 numeric bullets');
  require(paragraphs >= 3, `business overview needs >=3 paragraphs (${paragraphs})`);
  require(words(overview).length >= 140, `business overview too short (${words(overview).length} words)`);
  require(words(d.business?.moat).length >= 35, 'moat discussion too short');
  warn((d.business?.segments || []).length >= 2, 'no structured segment table');
  require(words(beatNote).length >= 65, `earnings synthesis too short (${words(beatNote).length} words)`);
  require(hasNumber(beatNote), 'earnings synthesis has no numeric KPI');
  require(/guidance|outlook|forecast|next quarter|full.year/i.test(beatNote), 'earnings synthesis lacks guidance/outlook');
  const nextEarnings = String(d.earnings?.nextEarnings || '');
  require(/^\d{4}-\d{2}-\d{2}$/.test(nextEarnings) || (/not confirmed|unavailable|not announced/i.test(nextEarnings) && /not confirmed|unavailable|not announced|no confirmed.*date/i.test(beatNote)), `next earnings date is neither confirmed nor explicitly unavailable (${nextEarnings || 'missing'})`);
  require(rows.length >= 14, `fundamental table needs >=14 rows (${rows.length})`);
  require(usableValuationRows.length >= 2 || (usableValuationRows.length >= 1 && /scenario|NAV|sum.of.parts|SOTP/i.test(valuationText)), `valuation needs two numeric measures or one numeric scenario/NAV framework (${usableValuationRows.length})`);
  require(/trailing|forward|GAAP|non-GAAP|scenario|NAV|SOTP|enterprise value|free.cash.flow/i.test(valuationText), 'valuation basis is not identified');
  require(/peer|sector|histor|scenario|versus|\bvs\.?\b|implies|embedded/i.test(valuationText), 'valuation lacks a peer, historical or scenario comparison');
  usableValuationRows.forEach((row, i) => {
    require(words(row.source).length >= 2, `valuation row ${i + 1} lacks a proximate input source`);
    require(/\b20\d{2}\b|as.of|dated|trailing|forward|ttm|fy\d{2}|quarter/i.test(`${row.signal || ''} ${row.comparison || ''}`), `valuation row ${i + 1} lacks a dated denominator basis`);
  });
  require((d.business?.sourceRefs || []).length >= 1, 'business section lacks proximate primary source');
  require((d.earnings?.sourceRefs || []).length >= 1, 'earnings section lacks proximate primary source');
  require((d.fundamentals?.sourceRefs || []).length >= 1, 'fundamentals section lacks proximate sources');
  require((d.technicals?.sourceRefs || []).length >= 1, 'technical section lacks market-data source');
  for (const [section, refs] of Object.entries({
    business: d.business?.sourceRefs || [],
    earnings: d.earnings?.sourceRefs || [],
    fundamentals: d.fundamentals?.sourceRefs || [],
    capital: d.capitalStructure?.sourceRefs || [],
    technicals: d.technicals?.sourceRefs || []
  })) {
    require(refs.length >= 1, `${section} section lacks proximate source`);
    refs.forEach((ref, i) => {
      require(/^https?:\/\//i.test(ref.url || ''), `${section} source ${i + 1} lacks a direct URL`);
      require(/^\d{4}-\d{2}-\d{2}$/.test(ref.date || ''), `${section} source ${i + 1} lacks an ISO date`);
    });
  }
  require(!(d.technicals?.sourceRefs || []).every(x => /sec\.gov|investor|earnings|10-[qk]|8-k/i.test(`${x.url} ${x.name}`)), 'technical section cites filings instead of price data');
  for (const [section, payload] of Object.entries({
    insiders: d.insiders,
    shortInterest: d.shortInterest,
    options: d.options,
    social: d.social,
    performance: d.performance
  })) {
    const refs = payload?.sourceRefs || [];
    require(refs.length >= 1, `${section} section lacks a market source`);
    require(!refs.some(x => /sec\.gov|10-[qk]|8-k|earnings/i.test(`${x.url} ${x.name}`)), `${section} section incorrectly cites corporate filings`);
  }
  const flowHasClaim = !['N/A', '', undefined, null].includes(d.capitalFlow?.netFlow) || !['N/A', '', undefined, null].includes(d.capitalFlow?.institutionalFlow) || !['N/A', '', undefined, null].includes(d.capitalFlow?.retailFlow);
  require(!flowHasClaim || (d.capitalFlow?.sourceRefs || []).length >= 1, 'capital-flow claim lacks a market source');
  require(news.length >= 3 && news.length <= 5, `news needs 3-5 curated items (${news.length})`);
  news.forEach((item, i) => {
    require(/^\d{4}-\d{2}-\d{2}$/.test(item.date || ''), `news item ${i + 1} lacks an ISO date`);
    require(/^https?:\/\//i.test(item.sourceUrl || ''), `news item ${i + 1} lacks a direct source URL`);
    require(words(item.detail).length >= 12, `news item ${i + 1} lacks a financial consequence`);
  });
  require(!news.some(x => /Headline context only/i.test(x.detail || '')), 'generic headline filler remains');
  require(words(d.capitalStructure?.shareHistory).length >= 45, 'capital-structure synthesis too short');
  require(/fully diluted|diluted|basic.to.diluted|minimum observable|minimum verifiable|not calculable|not available|unavailable/i.test(d.capitalStructure?.shareHistory || ''), 'capital structure lacks a diluted-share bridge or an explicit unavailability statement');
  require(filingRows.length >= 2, `needs >=2 decision-relevant SEC filing findings (${filingRows.length})`);
  filingRows.forEach((f,i)=>{
    require(/^\d{10}-\d{2}-\d{6}$/.test(f.accession || ''), `SEC finding ${i+1} has malformed accession ${f.accession || 'missing'}`);
    require(/^\d{4}-\d{2}-\d{2}$/.test(f.date || ''), `SEC finding ${i+1} has malformed filing date`);
    require(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//i.test(f.url || ''), `SEC finding ${i+1} lacks a direct EDGAR archive URL`);
    require(String(f.url || '').includes(String(f.accession || '').replace(/-/g, '')), `SEC finding ${i+1} URL does not match accession ${f.accession}`);
    require(words(f.finding).length>=25,`SEC finding ${i+1} too short for ${f.accession}`);
    require(!/Periodic report reviewed|Current report reviewed|Registration capacity exists|Prospectus reviewed/i.test(f.finding||''),`generic SEC finding remains for ${f.accession}`);
  });
  require(risks.length >= 4, `contrarian risks need >=4 items (${risks.length})`);
  require(riskCards.length === 3, `exactly 3 individualized risk cards required (${riskCards.length})`);
  riskCards.forEach((card, i) => {
    require(words(card.title).length >= 2, `risk card ${i + 1} title is generic`);
    require((card.points || []).length >= 2, `risk card ${i + 1} needs >=2 points`);
    require(words(card.verdict).length >= 12, `risk card ${i + 1} verdict too short`);
  });
  require(words(d.risks?.riskSummary).length >= 30, 'risk summary too short');
  require(words(d.risks?.pedagogy).length >= 30, 'risk pedagogy too short');
  const retailWarRoom = [d.risks?.pedagogy, d.risks?.riskSummary, trade.thesis, ...(trade.invalidation || [])].join(' ');
  require(/gap/i.test(retailWarRoom), 'retail war room omits gap risk');
  require(/liquid|spread|slippage/i.test(retailWarRoom), 'retail war room omits liquidity, spread or slippage risk');
  require(/siz|taille|dimension|position|notional|notionnel|risk budget|budget de risque/i.test(retailWarRoom), 'retail war room omits sizing implications');
  require(/earnings|résultat|publication|événement|event|filing|dépôt|offering|émission|decision|décision|catalyst|catalyseur|guidance|prévision/i.test(retailWarRoom), 'retail war room omits event timing');
  require(/chase|pursu|anticipat|wait|attendre|ne pas/i.test(retailWarRoom), 'retail war room lacks an explicit no-chase instruction');
  require(words(trade.thesis).length >= 45, 'trade thesis too short');
  require(trade.status !== 'pending', 'pending is not a publishable retail trade state');
  require(!/trade state pending|status pending|remains pending/i.test(`${d.filingsReview?.summary || ''} ${trade.statusNote || ''}`), 'stale pending lifecycle prose conflicts with the published trade state');
  require(!(d.header?.badges || []).some(x => /pending/i.test(x?.text || '')), 'header retains a stale pending badge');
  require((trade.catalysts || []).length >= 3, 'trade catalysts need >=3 items');
  require((trade.invalidation || []).length >= 3, 'trade invalidations need >=3 items');
  require([entry, stop, tp1, tp2].every(Number.isFinite), 'trade geometry contains a non-numeric level');
  if ([entry, stop, tp1, tp2].every(Number.isFinite)) {
    const side = tp1 > entry ? 1 : -1;
    require(side > 0 ? stop < entry && entry < tp1 && tp1 <= tp2 : stop > entry && entry > tp1 && tp1 >= tp2, 'trade levels are directionally inconsistent');
    const risk = Math.abs(entry - stop);
    const rr1 = risk ? Math.abs(tp1 - entry) / risk : NaN;
    const publishedRr = Number((String(trade.rr || '').match(/1:([\d.]+)/) || [])[1]);
    require(risk > 0 && Number.isFinite(rr1), 'trade risk denominator is zero');
    require(Number.isFinite(publishedRr) && Math.abs(publishedRr - rr1) <= 0.03, `published R/R does not match levels (${publishedRr || 'missing'} vs ${rr1.toFixed(2)})`);
    for (const [label, value, textValue] of [['stop', stop, trade.stopPct], ['tp1', tp1, trade.tp1Pct], ['tp2', tp2, trade.tp2Pct]]) {
      const publishedPct = Number((String(textValue || '').match(/-?[\d.]+/) || [])[0]);
      const calculatedPct = (value / entry - 1) * 100;
      require(Number.isFinite(publishedPct) && Math.abs(publishedPct - calculatedPct) <= 0.15, `${label} percentage does not match levels (${publishedPct || 'missing'} vs ${calculatedPct.toFixed(1)}%)`);
    }
    require(mentionsLevel(d.technicals?.setupNote, entry), `technical setup does not cite its own entry ${entry}`);
    require(mentionsLevel(d.technicals?.setupNote, stop), `technical setup does not cite its own stop ${stop}`);
    require(mentionsLevel(trade.thesis, entry), `trade thesis does not cite its own entry ${entry}`);
    require(mentionsLevel(trade.thesis, stop), `trade thesis does not cite its own stop ${stop}`);
  }
  if (['active', 'pending', 'watch', 'wait', 'speculative', 'triggered', 'tp1-hit'].includes(trade.status)) {
    require((d.technicals?.supports || []).length >= 1, 'open trade state lacks support levels');
    require((d.technicals?.resistances || []).length >= 1, 'open trade state lacks resistance levels');
  }
  require((d.globalScore?.keyTakeawaysPositive || []).length === 3, 'positive takeaways need exactly 3 items');
  require((d.globalScore?.keyTakeawaysNegative || []).length === 3, 'negative takeaways need exactly 3 items');
  for (const phrase of banned) require(!editorialText.includes(phrase), `generic phrase remains: ${phrase}`);
  const companyToken=String(d.header?.name||'').toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g,'');
  require(editorialText.toLowerCase().includes(ticker.toLowerCase()) || (companyToken&&overview.toLowerCase().replace(/[^a-z0-9\s]/g,'').includes(companyToken)), 'editorial body does not name the company/ticker');
  return { ticker, file, summary, editorialText, errors, warnings };
}

if (!files.length) {
  console.error('Usage: node tools/check-analysis-editorial-quality.js [--strict] data/analyses-data/TICKER.json ...');
  process.exit(2);
}

const results = files.map(check);
for (let i = 0; i < results.length; i++) {
  for (let j = i + 1; j < results.length; j++) {
    const score = similarity(results[i].summary, results[j].summary);
    if (score >= 0.72) {
      results[i].errors.push(`verdict too similar to ${results[j].ticker} (${score.toFixed(2)})`);
      results[j].errors.push(`verdict too similar to ${results[i].ticker} (${score.toFixed(2)})`);
    }
  }
}
if(results.length>=10){
  const sentenceOwners=new Map();
  for(const r of results){
    const seen=new Set(strip(r.editorialText).split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>=55));
    for(const sentence of seen){
      const normalized=sentence.toLowerCase().replace(/\$?[\d,.]+(?:%|x|m|b)?/g,'#').replace(/\s+/g,' ');
      if(/educational market analysis|registration statement alone|quote timestamp|daily indicators end|daily indicators and pivots run only through/.test(normalized))continue;
      if(!sentenceOwners.has(normalized))sentenceOwners.set(normalized,[]);
      sentenceOwners.get(normalized).push(r);
    }
  }
  const maxOwners=Math.max(1,Math.floor(results.length*.10));
  for(const owners of sentenceOwners.values())if(owners.length>maxOwners){
    const names=owners.map(x=>x.ticker).join(',');
    const sample=strip(owners[0].editorialText).split(/(?<=[.!?])\s+/).find(sentence=>{
      const normalized=sentence.toLowerCase().replace(/\$?[\d,.]+(?:%|x|m|b)?/g,'#').replace(/\s+/g,' ');
      return sentenceOwners.get(normalized)===owners;
    })||'';
    owners.forEach(x=>x.errors.push(`non-allowlisted sentence duplicated across ${owners.length} dossiers: ${names} :: ${sample.slice(0,180)}`));
  }
}

let errorCount = 0, warningCount = 0;
for (const r of results) {
  errorCount += r.errors.length;
  warningCount += r.warnings.length;
  console.log(`${r.errors.length ? 'FAIL' : 'PASS'} ${r.ticker}: ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
  r.errors.forEach(x => console.log(`  ERROR ${x}`));
  r.warnings.forEach(x => console.log(`  WARN  ${x}`));
}
console.log(`Editorial quality: ${results.length} dossier(s), ${errorCount} error(s), ${warningCount} warning(s)`);
if (strict && (errorCount || warningCount)) process.exit(1);
if (errorCount) process.exit(1);
