#!/usr/bin/env node
/**
 * migrate-html-to-json.js — Extract structured JSON from legacy HTML analyses
 *
 * Best-effort extraction from semi-structured HTML. Outputs a JSON file
 * conforming to tools/lib/analysis-schema.json that can be fed to
 * render-analysis.js for deterministic re-rendering.
 *
 * Usage:
 *   node tools/migrate-html-to-json.js analyses/ALT/index.html
 *   node tools/migrate-html-to-json.js analyses/ALT/index.html --dry    # preview, don't write
 *   node tools/migrate-html-to-json.js --batch                          # migrate ALL
 *
 * Output: data/analyses-data/{TICKER}.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');

// ─── Helpers ──────────────────────────────────────────────────────────────

function stripTags(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&mdash;/g, '—')
    .replace(/&bull;/g, '·').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, '').trim();
}

function first(html, re) {
  const m = (html || '').match(re);
  return m ? m[1].trim() : null;
}

function all(html, re) {
  const results = [];
  let m;
  const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = regex.exec(html)) !== null) results.push(m);
  return results;
}

function extractPrice(text) {
  const m = (text || '').match(/\$?([\d,]+\.?\d*)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}

function between(html, startMarker, endMarker) {
  const si = html.indexOf(startMarker);
  if (si === -1) return '';
  const ei = html.indexOf(endMarker, si + startMarker.length);
  if (ei === -1) return html.slice(si);
  return html.slice(si, ei + endMarker.length);
}

function sectionById(html, id) {
  const re = new RegExp(`<div[^>]*id="${id}"[^>]*class="content-card"[^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const start = m.index;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.slice(i, i + 4) === '<div') depth++;
    if (html.slice(i, i + 6) === '</div>') {
      depth--;
      if (depth === 0) return html.slice(start, i + 6);
    }
    i++;
  }
  return html.slice(start);
}

function sectionByH2(html, pattern) {
  const re = new RegExp(`<div[^>]*class="content-card"[^>]*>\\s*<h2[^>]*>[^<]*${pattern}`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const start = m.index;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.slice(i, i + 4) === '<div') depth++;
    if (html.slice(i, i + 6) === '</div>') {
      depth--;
      if (depth === 0) return html.slice(start, i + 6);
    }
    i++;
  }
  return html.slice(start);
}

// ─── Extractors ───────────────────────────────────────────────────────────

function extractMeta(html) {
  const lang = first(html, /<html[^>]*lang="([^"]+)"/i) || 'en';
  const tags = (first(html, /data-tags="([^"]+)"/i) || '').split(',').filter(Boolean);
  const grade = first(html, /data-grade="([^"]+)"/i) || 'B';
  const level = first(html, /data-level="([^"]+)"/i) || 'intermediate';
  const dateMatch = first(html, /<title>[^|]*\|\s*(\d{1,2}\s+\w+\s+\d{4})/i)
    || first(html, /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i);
  const desc = first(html, /<meta\s+name="description"\s+content="([^"]+)"/i) || '';
  const ogDesc = first(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) || '';

  let isoDate = '';
  if (dateMatch) {
    const months = { janvier:'01', février:'02', 'février':'02', mars:'03', avril:'04', mai:'05', juin:'06',
      juillet:'07', août:'08', 'août':'08', septembre:'09', octobre:'10', novembre:'11', décembre:'12', 'décembre':'12',
      january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
      july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };
    const parts = dateMatch.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (parts) {
      const mo = months[parts[2].toLowerCase()] || '01';
      isoDate = `${parts[3]}-${mo}-${parts[1].padStart(2, '0')}`;
    }
  }

  return {
    lang,
    tags,
    grade,
    level,
    date: isoDate || new Date().toISOString().slice(0, 10),
    dateDisplay: dateMatch || '',
    description: stripTags(desc),
    ogDescription: stripTags(ogDesc),
    version: 1,
    status: 'active',
    assetType: 'stock'
  };
}

function extractHeader(html) {
  const ticker = stripTags(first(html, /class="ticker-symbol"[^>]*>([^<]+)/i) || '');
  const nameRaw = stripTags(first(html, /class="ticker-name"[^>]*>([\s\S]*?)</i) || '');
  const nameParts = nameRaw.split(/[—·]/);
  const name = (nameParts[0] || ticker).trim();
  const exchange = (nameParts[1] || '').trim();
  const sector = (nameParts[2] || '').trim();

  const priceText = first(html, /class="ticker-price"[^>]*>([\s\S]*?)</i) || '';
  let price = extractPrice(priceText);
  if (!price) {
    const bigPrice = first(html, /font-size:\s*2\.2rem[^>]*>\$?([\d,.]+)/i);
    if (bigPrice) price = parseFloat(bigPrice.replace(/,/g, ''));
  }
  if (!price) {
    const headerPrice = first(html, /ticker-header[\s\S]*?\$([\d,.]+)/i);
    if (headerPrice) price = parseFloat(headerPrice.replace(/,/g, ''));
  }
  const changePctMatch = (priceText || html.slice(0, 5000)).match(/([-+]?\d+\.?\d*)%/);
  const changePct = changePctMatch ? parseFloat(changePctMatch[1]) : 0;

  const metrics = {};
  const metricBlocks = all(html, /class="ticker-metric"[\s\S]*?<div class="tm-value"[^>]*>([\s\S]*?)<\/div>\s*<div class="tm-label"[^>]*>([\s\S]*?)<\/div>/gi);
  for (const m of metricBlocks) {
    const val = stripTags(m[1]);
    const label = stripTags(m[2]).toLowerCase();
    if (label.includes('market cap') || label.includes('mcap')) metrics.marketCap = val;
    else if (label.includes('volume')) metrics.volume = val;
    else if (label.includes('fwd p/e') || label.includes('p/e')) metrics.fwdPE = val;
    else if (label.includes('beta')) metrics.beta = parseFloat(val) || undefined;
    else if (label.includes('52w') || label.includes('range')) metrics.range52w = val;
    else if (label.includes('short')) metrics.shortInterest = val;
    else if (label.includes('div') && label.includes('yield')) metrics.divYield = val;
    else if (label.includes('target') || label.includes('cible')) metrics.analystTarget = val;
    else if (label.includes('peg')) metrics.pegRatio = val;
    else if (label.includes('ev/')) metrics.evEbitda = val;
  }

  const badges = [];
  const badgeMatches = all(html, /class="badge badge-(\w+)"[^>]*>([^<]+)/gi);
  for (const m of badgeMatches) {
    if (m[2].toLowerCase().includes('score') || m[2].toLowerCase().includes('grade')) continue;
    badges.push({ text: stripTags(m[2]), color: m[1] });
  }

  return {
    ticker: ticker || path.basename(path.dirname(process.argv[2] || '')),
    name, exchange, sector,
    price, changePct,
    badges: badges.slice(0, 6),
    metrics,
    halal: html.includes('Halal') || html.includes('halal')
  };
}

function extractVerdict(html) {
  const section = sectionById(html, 'verdict') || sectionByH2(html, 'Verdict');
  const score = parseInt(first(html, /data:\[\{value:(\d+)\}\]/) || '0', 10);
  const summary = stripTags(first(section, /class="verdict-summary"[^>]*>([\s\S]*?)<\//i) || '');

  const whyBuy = [];
  const whyAvoid = [];

  const proSection = between(section, 'verdict-pro', '</div>');
  const conSection = between(section, 'verdict-con', '</div>');
  const proLis = all(proSection, /<li[^>]*>([\s\S]*?)<\/li>/gi);
  const conLis = all(conSection, /<li[^>]*>([\s\S]*?)<\/li>/gi);
  proLis.forEach(m => whyBuy.push(stripTags(m[1])));
  conLis.forEach(m => whyAvoid.push(stripTags(m[1])));

  if (!whyBuy.length) {
    const allLis = all(section, /<li[^>]*>([\s\S]*?)<\/li>/gi);
    const mid = Math.ceil(allLis.length / 2);
    allLis.forEach((m, i) => (i < mid ? whyBuy : whyAvoid).push(stripTags(m[1])));
  }

  const biasMatch = first(section, /(?:biais|bias)[^<]*?<[^>]*>([\w\-]+)/i);
  const convictionMatch = first(section, /(?:conviction)[^<]*?<[^>]*>([^<]+)/i);

  return {
    score: score || 70,
    conviction: convictionMatch || 'Moderate',
    bias: (biasMatch || 'Neutral').includes('ull') ? 'Bullish' : (biasMatch || '').includes('ear') ? 'Bearish' : 'Neutral',
    confidence: '',
    summary: summary || '',
    whyBuy: whyBuy.length ? whyBuy : ['[MIGRATE: extract from HTML]'],
    whyAvoid: whyAvoid.length ? whyAvoid : ['[MIGRATE: extract from HTML]']
  };
}

function extractBusiness(html) {
  const section = sectionById(html, 'activite') || sectionByH2(html, 'Activit') || sectionByH2(html, 'What.*Does');
  const paragraphs = all(section, /<p[^>]*>([\s\S]*?)<\/p>/gi);
  const overview = paragraphs.map(m => `<p>${stripTags(m[1])}</p>`).join('') || '<p>[MIGRATE: extract from HTML]</p>';
  return { overview };
}

function extractNews(html) {
  const section = sectionById(html, 'news') || sectionByH2(html, 'Actualit|News|Catalys');
  const items = [];
  const newsItems = all(section, /class="news-item"[^>]*>([\s\S]*?)<\/div>/gi);
  for (const m of newsItems) {
    const dateMatch = first(m[1], /class="news-date"[^>]*>([^<]+)/i);
    const titleMatch = first(m[1], /class="news-title"[^>]*>([\s\S]*?)<\//i);
    if (titleMatch) {
      items.push({
        date: stripTags(dateMatch || ''),
        title: stripTags(titleMatch),
        impact: m[1].includes('positif') || m[1].includes('positive') || m[1].includes('green') ? 'positive'
          : m[1].includes('négatif') || m[1].includes('negative') || m[1].includes('red') ? 'negative' : 'neutral',
        source: ''
      });
    }
  }
  if (!items.length) {
    const lis = all(section, /<li[^>]*>([\s\S]*?)<\/li>/gi);
    lis.forEach(m => items.push({
      date: '',
      title: stripTags(m[1]).slice(0, 200),
      impact: 'neutral',
      source: ''
    }));
  }
  return items.length ? items : undefined;
}

function extractFundamentals(html) {
  const section = sectionById(html, 'fondamentaux') || sectionByH2(html, 'Fondamentaux|Fundamentals');
  const rows = [];
  const trs = all(section, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const tr of trs) {
    const tds = all(tr[1], /<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (tds.length >= 2) {
      const metric = stripTags(tds[0][1]);
      const value = stripTags(tds[1][1]);
      if (metric && value && !metric.toLowerCase().includes('metric')) {
        const signal = tds.length >= 3 ? stripTags(tds[2][1]) : '';
        const colorMatch = tr[1].match(/color:\s*#(22c55e|16a34a)/i) ? 'green'
          : tr[1].match(/color:\s*#(ef4444|dc2626)/i) ? 'red'
          : tr[1].match(/color:\s*#(3b82f6)/i) ? 'blue' : undefined;
        rows.push({ metric, value, signal: signal || undefined, signalColor: colorMatch });
      }
    }
  }

  const sourceRefs = extractSourceRefs(section);
  return { rows: rows.length ? rows : [{ metric: '[MIGRATE]', value: '[MIGRATE]' }], sourceRefs: sourceRefs.length ? sourceRefs : undefined };
}

function extractEarnings(html) {
  const section = sectionById(html, 'earnings') || sectionByH2(html, 'Earnings|Résultats');
  if (!section) return undefined;

  const quarters = [];
  const trs = all(section, /<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const tr of trs) {
    const tds = all(tr[1], /<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (tds.length >= 3) {
      const q = stripTags(tds[0][1]);
      if (q.match(/Q[1-4]\s*\d{4}/i)) {
        quarters.push({
          quarter: q,
          epsActual: parseFloat(stripTags(tds[1][1]).replace('$', '')) || 0,
          epsEstimate: parseFloat(stripTags(tds[2][1]).replace('$', '')) || 0,
          surprise: tds.length >= 4 ? stripTags(tds[3][1]) : '',
          revActual: tds.length >= 5 ? stripTags(tds[4][1]) : ''
        });
      }
    }
  }
  return quarters.length ? { quarters } : undefined;
}

function extractTechnicals(html) {
  const section = sectionById(html, 'technique') || sectionByH2(html, 'Technique|Technical');

  const findVal = (label) => {
    const patterns = [
      new RegExp(label + '[\\s\\S]*?<\\/td>\\s*<td[^>]*>\\$?([\\d,.]+)', 'i'),
      new RegExp(label + '[^<]*<\\/[^>]*>\\s*<td[^>]*>([^<]+)', 'i'),
      new RegExp(label + '[^<]*<\\/strong>\\s*<\\/td>\\s*<td[^>]*>\\$?([\\d,.]+)', 'i'),
      new RegExp(label + '[\\s\\S]*?<\\/td>\\s*<td[^>]*>[^\\d$]*\\$?([\\d,.]+)', 'i'),
    ];
    for (const re of patterns) {
      const m = section.match(re);
      if (m) {
        const v = parseFloat(stripTags(m[1]).replace(/[$,]/g, ''));
        if (v > 0) return v;
      }
    }
    return 0;
  };

  const rsi14 = findVal('RSI');
  const ema20 = findVal('EMA\\s*20') || findVal('EMA20');
  const ema50 = findVal('EMA\\s*50') || findVal('EMA50');
  const ema200 = findVal('EMA\\s*200') || findVal('EMA200');
  const macd = findVal('MACD');
  const atr14 = findVal('ATR');

  const supports = [];
  const resistances = [];
  const supportMatch = section.match(/Support[^:]*:\s*([\d$.,\s/–-]+)/i);
  const resistanceMatch = section.match(/Resist[^:]*:\s*([\d$.,\s/–-]+)/i);
  if (supportMatch) {
    supportMatch[1].match(/[\d.]+/g)?.forEach(v => supports.push(parseFloat(v)));
  }
  if (resistanceMatch) {
    resistanceMatch[1].match(/[\d.]+/g)?.forEach(v => resistances.push(parseFloat(v)));
  }

  const wyckoffMatch = first(section, /Wyckoff[^<]*<\/[^>]*>\s*<td[^>]*>([^<]+)/i);
  const setupNote = '';

  const badges = [];
  const badgeMatches = all(section, /class="badge badge-(\w+)"[^>]*>([^<]+)/gi);
  badgeMatches.forEach(m => badges.push(stripTags(m[2])));

  return {
    rsi14: rsi14 || 50,
    ema20: ema20 || 0,
    ema50: ema50 || 0,
    ema200: ema200 || 0,
    macd: macd || 0,
    atr14: atr14 || 0,
    wyckoff: wyckoffMatch ? stripTags(wyckoffMatch) : undefined,
    supports: supports.slice(0, 3),
    resistances: resistances.slice(0, 3),
    badges,
    setupNote,
    radarValues: { rsi: Math.min(100, Math.round(rsi14)), trend: 50, volume: 50, momentum: 50, volatility: 50, support: 50 }
  };
}

function extractRisks(html) {
  const section = sectionById(html, 'risques') || sectionByH2(html, 'Risques|Risk');

  const scoreMatch = section.match(/(\d+)\s*\/\s*10/);
  const riskScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;
  const profileMatch = first(section, /Profil[^:]*:\s*([^<]+)/i) || first(section, /Profile[^:]*:\s*([^<]+)/i);

  const riskCards = [];
  const cardMatches = all(section, /class="risk-card[^"]*"[^>]*>([\s\S]*?)(?=<div class="risk-card|<\/div>\s*<\/div>\s*$)/gi);
  for (const cm of cardMatches) {
    const title = stripTags(first(cm[1], /<h4[^>]*>([^<]+)/i) || '');
    const severity = first(cm[1], /risk-card-(critical|high|medium|low)/i) || 'medium';
    const points = [];
    const lis = all(cm[1], /<li[^>]*>([\s\S]*?)<\/li>/gi);
    lis.forEach(m => points.push(stripTags(m[1])));

    const probMatch = cm[1].match(/width:\s*(\d+)%/);
    const impactMatch = cm[1].match(/width:\s*(\d+)%[\s\S]*?width:\s*(\d+)%/);

    if (title) {
      riskCards.push({
        title,
        severity,
        points: points.length ? points : ['[MIGRATE: extract from HTML]'],
        probability: probMatch ? parseInt(probMatch[1], 10) : 50,
        impact: impactMatch ? parseInt(impactMatch[2], 10) : 50
      });
    }
  }

  const pedagogy = '';
  const pedBox = first(section, /pedagogy-box[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

  return {
    riskScore,
    riskProfile: profileMatch ? stripTags(profileMatch) : riskScore <= 3 ? 'Low' : riskScore <= 5 ? 'Moderate' : riskScore <= 7 ? 'High' : 'Very High',
    riskSummary: '',
    riskCards: riskCards.length ? riskCards : [{ title: '[MIGRATE]', severity: 'medium', points: ['[MIGRATE]'] }],
    pedagogy: pedBox ? stripTags(pedBox) : ''
  };
}

function extractTradeIdea(html) {
  const section = sectionById(html, 'trade') || sectionByH2(html, 'Trade Idea');
  if (!section) {
    return { entry: 0, stop: 0, tp1: 0, rr: '1:1', status: 'active' };
  }

  const entryMatch = section.match(/Entry[^$]*\$?([\d,.]+)/i);
  const stopMatch = section.match(/Stop[^$]*\$?([\d,.]+)/i);
  const tp1Match = section.match(/Target\s*1[^$]*\$?([\d,.]+)/i) || section.match(/TP1?[^$]*\$?([\d,.]+)/i) || section.match(/Target[^$]*\$?([\d,.]+)/i);
  const tp2Match = section.match(/Target\s*2[^$]*\$?([\d,.]+)/i) || section.match(/TP2[^$]*\$?([\d,.]+)/i);
  const rrMatch = section.match(/(?:R\/R|Risk.*Reward|R:R)[^0-9]*([\d.:]+)/i);

  const statusMatch = section.match(/INVALIDAT/i) ? 'invalidated' : section.match(/STOPPED/i) ? 'stopped' : 'active';

  const catalysts = [];
  const invalidation = [];

  const catalystsSection = between(section, 'Catalyst', '</div>');
  const invalidSection = between(section, 'Invalidat', '</div>');

  all(catalystsSection, /<li[^>]*>([\s\S]*?)<\/li>/gi).forEach(m => catalysts.push(stripTags(m[1])));
  all(invalidSection, /<li[^>]*>([\s\S]*?)<\/li>/gi).forEach(m => invalidation.push(stripTags(m[1])));

  return {
    entry: entryMatch ? parseFloat(entryMatch[1].replace(/,/g, '')) : 0,
    stop: stopMatch ? parseFloat(stopMatch[1].replace(/,/g, '')) : 0,
    tp1: tp1Match ? parseFloat(tp1Match[1].replace(/,/g, '')) : 0,
    tp2: tp2Match ? parseFloat(tp2Match[1].replace(/,/g, '')) : undefined,
    rr: rrMatch ? rrMatch[1] : '1:1',
    status: statusMatch,
    catalysts: catalysts.length ? catalysts : undefined,
    invalidation: invalidation.length ? invalidation : undefined
  };
}

function extractGlobalScore(html) {
  const section = sectionById(html, 'score') || sectionByH2(html, 'Note Globale|Global.*Score|Global.*Assessment');

  const positive = [];
  const negative = [];

  const posSection = between(section, 'Positive', '</div>') || between(section, 'positif', '</div>');
  const negSection = between(section, 'Risks', '</div>') || between(section, 'négatif', '</div>') || between(section, 'Negative', '</div>');

  all(posSection, /<li[^>]*>([\s\S]*?)<\/li>/gi).forEach(m => positive.push(stripTags(m[1])));
  all(negSection, /<li[^>]*>([\s\S]*?)<\/li>/gi).forEach(m => negative.push(stripTags(m[1])));

  const mindsetMatch = first(section, /Mindset[^<]*<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i);

  return {
    profile: 'Speculative',
    keyTakeawaysPositive: positive.length ? positive.slice(0, 3) : ['[MIGRATE]'],
    keyTakeawaysNegative: negative.length ? negative.slice(0, 3) : ['[MIGRATE]'],
    mindsetTip: mindsetMatch ? stripTags(mindsetMatch) : ''
  };
}

function extractSourceRefs(section) {
  const refs = [];
  const matches = all(section, /class="source-ref"[^>]*href="([^"]*)"[^>]*>[\s\S]*?class="source-name"[^>]*>([^<]+)/gi);
  matches.forEach(m => refs.push({ name: stripTags(m[2]), url: m[1], date: '' }));
  return refs;
}

// ─── Main migration ───────────────────────────────────────────────────────

function migrate(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const meta = extractMeta(html);
  const header = extractHeader(html);
  const verdict = extractVerdict(html);
  const business = extractBusiness(html);
  const news = extractNews(html);
  const fundamentals = extractFundamentals(html);
  const earnings = extractEarnings(html);
  const technicals = extractTechnicals(html);
  const risks = extractRisks(html);
  const tradeIdea = extractTradeIdea(html);
  const globalScore = extractGlobalScore(html);

  const data = { meta, header, verdict, business };
  if (news && news.length) data.news = news;
  data.fundamentals = fundamentals;
  if (earnings) data.earnings = earnings;
  data.technicals = technicals;
  data.risks = risks;
  data.tradeIdea = tradeIdea;
  data.globalScore = globalScore;

  return data;
}

function reportQuality(data) {
  const issues = [];
  if (!data.header.price) issues.push('price = 0 — manual fix needed');
  if (!data.technicals.ema20) issues.push('EMA20 = 0 — manual fix needed');
  if (!data.technicals.ema50) issues.push('EMA50 = 0 — manual fix needed');
  if (!data.technicals.ema200) issues.push('EMA200 = 0 — manual fix needed');
  if (!data.tradeIdea.entry) issues.push('trade entry = 0 — manual fix needed');
  if (data.verdict.whyBuy[0] === '[MIGRATE: extract from HTML]') issues.push('verdict whyBuy not extracted');
  if (data.risks.riskCards[0] && data.risks.riskCards[0].title === '[MIGRATE]') issues.push('risk cards not extracted');

  const total = 10;
  const ok = total - issues.length;
  return { pct: Math.round(ok / total * 100), issues };
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const batchMode = args.includes('--batch');
  const positional = args.filter(a => !a.startsWith('--'));

  let files;
  if (batchMode) {
    const analysesDir = path.join(ROOT, 'analyses');
    files = fs.readdirSync(analysesDir)
      .filter(d => {
        const p = path.join(analysesDir, d, 'index.html');
        return fs.existsSync(p) && !d.startsWith('_') && !d.startsWith('.');
      })
      .filter(d => !fs.existsSync(path.join(DATA_DIR, `${d}.json`)))
      .map(d => path.join(analysesDir, d, 'index.html'));
    console.log(`[BATCH] Found ${files.length} articles without JSON (skipping already-migrated)`);
  } else {
    files = positional.map(f => path.resolve(f));
  }

  if (!files.length) {
    console.log(`
migrate-html-to-json.js — Convert legacy HTML analyses to structured JSON

Usage:
  node tools/migrate-html-to-json.js analyses/ALT/index.html         # migrate one
  node tools/migrate-html-to-json.js analyses/ALT/index.html --dry   # preview
  node tools/migrate-html-to-json.js --batch                          # migrate ALL without JSON
  node tools/migrate-html-to-json.js --batch --dry                    # preview ALL

Output: data/analyses-data/{TICKER}.json
`);
    process.exit(0);
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let totalOk = 0;
  let totalIssues = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`[ERROR] File not found: ${file}`);
      continue;
    }

    try {
      const data = migrate(file);
      const ticker = data.header.ticker;
      const quality = reportQuality(data);
      const outPath = path.join(DATA_DIR, `${ticker}.json`);

      if (dryRun) {
        console.log(`[DRY] ${ticker} (${data.meta.grade}) — ${quality.pct}% extracted`);
        if (quality.issues.length) {
          quality.issues.forEach(i => console.log(`  ⚠ ${i}`));
        }
      } else {
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[MIGRATED] ${ticker} → ${outPath} (${quality.pct}% coverage)`);
        if (quality.issues.length) {
          quality.issues.forEach(i => console.log(`  ⚠ ${i}`));
        }
      }

      totalOk++;
      totalIssues += quality.issues.length;
    } catch (e) {
      console.error(`[ERROR] ${file}: ${e.message}`);
    }
  }

  console.log(`\n[DONE] ${totalOk}/${files.length} processed. ${totalIssues} issues need manual review.`);
}

main();
