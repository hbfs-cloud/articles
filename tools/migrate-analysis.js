#!/usr/bin/env node
/**
 * migrate-analysis.js — HTML → JSON migration for legacy analyses
 *
 * Extracts structured data from existing HTML analyses and produces JSON
 * conforming to tools/lib/analysis-schema.json for the new pipeline.
 *
 * Usage:
 *   node tools/migrate-analysis.js analyses/SHEL/index.html
 *   node tools/migrate-analysis.js analyses/SHEL/index.html --dry        # preview, don't write
 *   node tools/migrate-analysis.js --all                                 # migrate all legacy articles
 *   node tools/migrate-analysis.js --all --dry                           # preview all
 *   node tools/migrate-analysis.js --all --skip-existing                 # skip articles that already have JSON
 *   node tools/migrate-analysis.js --report                              # coverage report only
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT     = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'analyses-data');

// ─── Helpers ──────────────────────────────────────────────────────────────

function text($el) {
  return $el.text().replace(/\s+/g, ' ').trim();
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parsePrice(str) {
  if (!str) return 0;
  const m = str.replace(/,/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseChangePct(str) {
  if (!str) return 0;
  const m = str.match(/([+-]?\d+\.?\d*)%/);
  return m ? parseFloat(m[1]) : 0;
}

function parsePctVal(str) {
  if (!str) return 0;
  const m = str.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function guessAssetType(ticker, sector, exchange) {
  const t = (ticker || '').toUpperCase();
  const s = (sector || '').toLowerCase();
  const e = (exchange || '').toLowerCase();
  if (t === 'BTC' || t === 'ETH' || t.includes('COIN') || t === 'MSTR' || s.includes('crypto')) {
    if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ABTC', 'BTCC', 'FIAT', 'TRON', 'TRX', 'STABLECOINS'].includes(t)) return 'crypto';
  }
  if (['XAUUSD', 'XAU', 'XAG', 'BDRY'].includes(t) || s.includes('precious') || s.includes('commodity')) return 'commodity';
  if (t === 'EURUSD' || t.includes('USD') && t.length === 6 && !t.match(/^[A-Z]{1,4}$/)) return 'forex';
  if (['SPY', 'QQQ', 'XLE', 'KOSPI', 'STOXX600'].includes(t) || s.includes('index')) {
    if (['SPY', 'QQQ', 'XLE'].includes(t)) return 'etf';
    return 'index';
  }
  if (e.includes('etf') || s.includes('etf')) return 'etf';
  return 'stock';
}

function inferBiasEnum(raw) {
  const l = (raw || '').toLowerCase();
  if (l.includes('bullish') || l.includes('haussier') || l.includes('buy')) return 'Bullish';
  if (l.includes('bearish') || l.includes('baissier') || l.includes('sell')) return 'Bearish';
  return 'Neutral';
}

function inferConviction(raw) {
  const l = (raw || '').toLowerCase();
  if (l.includes('very high') || l.includes('très haute') || l.includes('très élevée')) return 'Very High';
  if (l.includes('high') || l.includes('haute') || l.includes('élevée')) return 'High';
  if (l.includes('low') || l.includes('faible') || l.includes('basse')) return 'Low';
  return 'Moderate';
}

function inferSeverity(raw) {
  const l = (raw || '').toLowerCase();
  if (l.includes('critical') || l.includes('critique')) return 'critical';
  if (l.includes('high') || l.includes('élevé') || l.includes('haut')) return 'high';
  if (l.includes('low') || l.includes('faible') || l.includes('bas')) return 'low';
  return 'medium';
}

function inferImpact(raw) {
  const l = (raw || '').toLowerCase();
  if (l.includes('positive') || l.includes('positif') || l.includes('bullish') || l.includes('✅') || l.includes('🟢')) return 'positive';
  if (l.includes('negative') || l.includes('négatif') || l.includes('bearish') || l.includes('❌') || l.includes('🔴')) return 'negative';
  return 'neutral';
}

function inferRiskProfile(score) {
  if (score <= 3) return 'Low';
  if (score <= 5) return 'Moderate';
  if (score <= 7) return 'High';
  return 'Very High';
}

function extractDateFromHtml($) {
  const title = $('title').text();
  const datePatterns = [
    /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  const months = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
    'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  const dataDate = $('html').attr('data-date');
  if (dataDate && /^\d{4}-\d{2}-\d{2}$/.test(dataDate)) return dataDate;

  for (const src of [title, $('meta[name="description"]').attr('content') || '']) {
    for (const pat of datePatterns) {
      const m = src.match(pat);
      if (m) {
        if (m[0].match(/^\d{4}-\d{2}-\d{2}$/)) return m[0];
        const month = months[(m[2] || m[1]).toLowerCase()];
        if (month) {
          const day = m[1].match(/^\d+$/) ? m[1].padStart(2, '0') : '15';
          const year = m[3] || m[2];
          return `${year}-${month}-${day}`;
        }
      }
    }
  }
  return new Date().toISOString().slice(0, 10);
}

// ─── Section extractors ──────────────────────────────────────────────────

function extractMeta($) {
  const html = $('html');
  const tags = (html.attr('data-tags') || '').split(',').filter(Boolean);
  const grade = html.attr('data-grade') || 'B';
  const lang = html.attr('lang') || 'en';
  const level = html.attr('data-level') || 'intermediate';
  const desc = $('meta[name="description"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const date = extractDateFromHtml($);

  const meta = {
    lang,
    tags,
    grade,
    date,
    description: desc.slice(0, 300),
    version: 1,
    status: 'active',
    assetType: 'stock'
  };
  if (ogDesc) meta.ogDescription = ogDesc.slice(0, 200);
  if (level && level !== 'intermediate') meta.level = level;
  return meta;
}

function extractHeader($) {
  const ticker = text($('.ticker-symbol').first());
  const nameRaw = text($('.ticker-name').first());
  const priceRaw = text($('.ticker-price').first());

  let name = '', exchange = '', sector = '';
  const nameParts = nameRaw.split(/[—–\-•·]/).map(s => s.trim()).filter(Boolean);
  if (nameParts.length >= 1) name = nameParts[0];
  if (nameParts.length >= 2) exchange = nameParts[1];
  if (nameParts.length >= 3) sector = nameParts[2];

  const price = parsePrice(priceRaw);
  const changePct = parseChangePct(priceRaw);

  const metrics = {};
  $('.ticker-metric, .ticker-metrics .ticker-metric').each((_, el) => {
    const val = text($(el).find('.tm-value'));
    const label = text($(el).find('.tm-label'));
    if (val && label) {
      const key = label.toLowerCase()
        .replace(/market\s*cap/i, 'marketCap')
        .replace(/volume/i, 'volume')
        .replace(/fwd?\s*p\/?e/i, 'fwdPE')
        .replace(/beta/i, 'beta')
        .replace(/52w\s*range/i, 'range52w')
        .replace(/short\s*int/i, 'shortInterest')
        .replace(/div.*yield/i, 'divYield')
        .replace(/analyst.*target/i, 'analystTarget')
        .replace(/peg/i, 'pegRatio')
        .replace(/ev.*ebitda/i, 'evEbitda')
        .replace(/p\/b/i, 'priceToBook')
        .replace(/revenue/i, 'revenue')
        .replace(/\s+/g, '');
      metrics[key] = val;
    }
  });

  const badges = [];
  $('.ticker-header .badge, .ticker-header [class*="badge"]').each((_, el) => {
    const t = text($(el));
    if (t) badges.push({ text: t, color: 'blue' });
  });

  const header = {
    ticker: ticker || path.basename(path.dirname('')),
    name: name || ticker,
    exchange: exchange || 'NYSE',
    sector: sector || '',
    price,
    changePct,
    metrics
  };
  if (badges.length) header.badges = badges;

  return header;
}

function extractVerdict($) {
  const section = $('#verdict');
  if (!section.length) return null;

  let score = 50, conviction = 'Moderate', bias = 'Neutral', confidence = '';
  const scoreCard = section.find('.score-card, .score-row, [class*="score"]').first();
  const scoreText = text(scoreCard);
  const scoreMatch = scoreText.match(/(\d+)\s*\/\s*100/);
  if (scoreMatch) score = parseInt(scoreMatch[1], 10);

  const gradeMatch = scoreText.match(/\b(A\+|A|B\+|B|C\+|C|D\+|D)\b/);

  section.find('.verdict-grid .verdict-pro li, [class*="buy"] li, [class*="bull"] li, [class*="pro"] li').each((_, el) => {
    bias = 'Bullish';
  });

  const sectionText = text(section);
  if (sectionText.match(/conviction.*(?:very\s*)?high|haute.*conviction/i)) conviction = 'High';
  if (sectionText.match(/confidence.*?(\d+%)/i)) confidence = sectionText.match(/confidence.*?(\d+%)/i)[1] + ' confidence';

  const biasMatch = sectionText.match(/bias\s*:?\s*(bullish|bearish|neutral|haussier|baissier)/i);
  if (biasMatch) bias = inferBiasEnum(biasMatch[1]);

  const convMatch = sectionText.match(/conviction\s*:?\s*(very\s*high|high|moderate|low|très\s*haute|haute|modérée|faible)/i);
  if (convMatch) conviction = inferConviction(convMatch[1]);

  const whyBuy = [], whyAvoid = [];
  section.find('.verdict-pro li, .verdict-grid .verdict-pro li').each((_, el) => {
    whyBuy.push(text($(el)));
  });
  section.find('.verdict-con li, .verdict-grid .verdict-con li').each((_, el) => {
    whyAvoid.push(text($(el)));
  });

  if (!whyBuy.length) {
    section.find('ul').each((_, ul) => {
      const listItems = $(ul).find('li');
      const heading = text($(ul).prev('h3, h4, p'));
      if (heading.match(/buy|achet|bull|pour|pro|✅|🟢/i)) {
        listItems.each((_, li) => whyBuy.push(text($(li))));
      } else if (heading.match(/avoid|évit|bear|contre|con|risk|❌|🔴/i)) {
        listItems.each((_, li) => whyAvoid.push(text($(li))));
      }
    });
  }

  let summary = '';
  section.find('p, .alert-box p').each((_, el) => {
    const t = text($(el));
    if (t.length > 60 && !summary) summary = t;
  });

  return {
    score: Math.min(100, Math.max(0, score)),
    conviction,
    bias,
    ...(confidence && { confidence }),
    ...(summary && { summary }),
    whyBuy: whyBuy.length >= 3 ? whyBuy.slice(0, 5) : whyBuy.concat(Array(3 - whyBuy.length).fill('See article for details')),
    whyAvoid: whyAvoid.length >= 2 ? whyAvoid.slice(0, 5) : whyAvoid.concat(Array(Math.max(0, 2 - whyAvoid.length)).fill('See article for details'))
  };
}

function extractBusiness($) {
  const section = $('#activite, #business');
  if (!section.length) {
    const desc = $('meta[name="description"]').attr('content') || '';
    return { overview: `<p>${desc}</p>` };
  }

  let overview = '';
  section.find('p').each((_, el) => {
    const t = $(el).html();
    if (t && t.length > 30 && !$(el).closest('.pedagogy-box, .didactic-box, .alert-box, .source-refs').length) {
      overview += `<p>${t.trim()}</p>`;
    }
  });

  const segments = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      segments.push({
        name: text($(cells[0])),
        revenue: text($(cells[1])),
        pct: cells.length >= 3 ? text($(cells[2])) : '',
        description: cells.length >= 4 ? text($(cells[3])) : ''
      });
    }
  });

  let moat = '';
  section.find('.pedagogy-box p, .didactic-box p').each((_, el) => {
    const t = text($(el));
    if (t.length > 20) moat = t;
  });

  const result = { overview: overview || '<p>See article for business overview.</p>' };
  if (segments.length) result.segments = segments;
  if (moat) result.moat = moat;
  return result;
}

function extractNews($) {
  const section = $('#news, #actualites');
  if (!section.length) return undefined;

  const news = [];
  section.find('.news-item, .news-list > div, li').each((_, el) => {
    const t = text($(el));
    if (t.length < 10) return;

    const dateMatch = t.match(/^([\w]{3}\s+\d{1,2}|\d{1,2}\s+[\wéû]+)/i);
    const impactEl = $(el).find('[class*="badge"], [class*="impact"]');
    const impactText = impactEl.length ? text(impactEl) : '';

    const sourceEl = $(el).find('.source-ref .source-name, [class*="source"]');
    const sourceLink = $(el).find('a[href]');

    news.push({
      date: dateMatch ? dateMatch[1] : '',
      title: t.replace(dateMatch ? dateMatch[0] : '', '').replace(impactText, '').trim().slice(0, 200),
      impact: inferImpact(impactText || t),
      ...(sourceEl.length && { source: text(sourceEl.first()) }),
      ...(sourceLink.length && sourceLink.attr('href')?.startsWith('http') && { sourceUrl: sourceLink.attr('href') })
    });
  });

  return news.length ? news.slice(0, 8) : undefined;
}

function extractFundamentals($) {
  const section = $('#fondamentaux, #fundamentals');
  if (!section.length) return { rows: [{ metric: 'See article', value: 'N/A' }] };

  const rows = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      const row = {
        metric: text($(cells[0])),
        value: text($(cells[1]))
      };
      if (cells.length >= 3) {
        const signal = text($(cells[2]));
        if (signal) {
          row.signal = signal;
          const color = $(cells[2]).find('[class*="badge"]').attr('class') || '';
          if (color.includes('green')) row.signalColor = 'green';
          else if (color.includes('red')) row.signalColor = 'red';
          else if (color.includes('blue')) row.signalColor = 'blue';
          else if (color.includes('amber') || color.includes('yellow')) row.signalColor = 'amber';
          else row.signalColor = 'gray';
        }
      }
      rows.push(row);
    }
  });

  const sourceRefs = extractSourceRefs(section, $);
  const result = { rows: rows.length ? rows : [{ metric: 'See article', value: 'N/A' }] };
  if (sourceRefs.length) result.sourceRefs = sourceRefs;
  return result;
}

function extractTechnicals($) {
  const section = $('#technique, #technicals, #technical');
  if (!section.length) return { rsi14: 50, ema20: 0, ema50: 0, ema200: 0 };

  const sectionText = text(section);
  const vals = {};

  const patterns = {
    rsi14:      /RSI\s*(?:\(?\s*14\s*\)?)?\s*[:\s]+(\d+\.?\d*)/i,
    ema20:      /EMA\s*20\s*[:\s]+\$?(\d[\d,.]*)/i,
    ema50:      /EMA\s*50\s*[:\s]+\$?(\d[\d,.]*)/i,
    ema200:     /EMA\s*200\s*[:\s]+\$?(\d[\d,.]*)/i,
    macd:       /MACD\s*[:\s]+([+-]?\d[\d,.]*)/i,
    macdSignal: /Signal\s*[:\s]+([+-]?\d[\d,.]*)/i,
    atr14:      /ATR\s*(?:\(?\s*14\s*\)?)?\s*[:\s]+\$?(\d[\d,.]*)/i,
  };

  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;
    const label = text($(cells[0])).toLowerCase();
    const value = text($(cells[1])).replace(/[$,]/g, '');

    if (label.includes('rsi')) vals.rsi14 = parseFloat(value) || 50;
    if (label.includes('ema') && label.includes('20')) vals.ema20 = parseFloat(value) || 0;
    if (label.includes('ema') && label.includes('50')) vals.ema50 = parseFloat(value) || 0;
    if (label.includes('ema') && label.includes('200')) vals.ema200 = parseFloat(value) || 0;
    if (label.includes('macd') && !label.includes('signal')) vals.macd = parseFloat(value) || 0;
    if (label.includes('signal')) vals.macdSignal = parseFloat(value) || 0;
    if (label.includes('atr')) vals.atr14 = parseFloat(value) || 0;
    if (label.includes('wyckoff') || label.includes('phase')) vals.wyckoff = text($(cells[1]));
  });

  // Also extract from inline grid cards (label + value divs)
  section.find('[style*="grid"] > div, [style*="flex"] > div').each((_, el) => {
    const card = $(el);
    const divs = card.find('div');
    if (divs.length < 2) return;
    const label = text(divs.first()).toLowerCase();
    const value = text(divs.eq(1)).replace(/[$,]/g, '');
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (label.match(/50.day|ema\s*50|sma\s*50/)) vals.ema50 = num;
    else if (label.match(/200.day|ema\s*200|sma\s*200/)) vals.ema200 = num;
    else if (label.match(/20.day|ema\s*20|sma\s*20/)) vals.ema20 = num;
    else if (label.match(/rsi/i)) vals.rsi14 = num;
    else if (label.match(/atr/i)) vals.atr14 = num;
  });

  // Fallback: extract from full text (paragraphs, badges, etc.)
  const fullText = text($('body'));
  for (const [key, pat] of Object.entries(patterns)) {
    if (!vals[key]) {
      const m = sectionText.match(pat) || fullText.match(pat);
      if (m) vals[key] = parseFloat(m[1].replace(/,/g, ''));
    }
  }

  // Extra text patterns for EMA values embedded in prose (strict: require "ma/ema/sma/moving average")
  const probeText = sectionText + ' ' + fullText;
  if (!vals.ema50) {
    const m = probeText.match(/\b50[-\s]day\s+(?:ma|ema|sma|moving\s*average)\b.*?\$?([\d,.]+)/i)
           || probeText.match(/\bEMA\s*50\b.*?\$?([\d,.]+)/i);
    if (m) vals.ema50 = parseFloat(m[1].replace(/,/g, ''));
  }
  if (!vals.ema200) {
    const m = probeText.match(/\b200[-\s]day\s+(?:ma|ema|sma|moving\s*average)\b.*?\$?([\d,.]+)/i)
           || probeText.match(/\bEMA\s*200\b.*?\$?([\d,.]+)/i);
    if (m) vals.ema200 = parseFloat(m[1].replace(/,/g, ''));
  }
  if (!vals.ema20) {
    const m = probeText.match(/\b20[-\s]day\s+(?:ma|ema|sma|moving\s*average)\b.*?\$?([\d,.]+)/i)
           || probeText.match(/\bEMA\s*20\b.*?\$?([\d,.]+)/i);
    if (m) vals.ema20 = parseFloat(m[1].replace(/,/g, ''));
  }
  if (!vals.rsi14) {
    const m = fullText.match(/RSI\s*(?:at|=|:)?\s*(\d+\.?\d*)/i);
    if (m) vals.rsi14 = parseFloat(m[1]);
  }

  const wyckoffMatch = sectionText.match(/(?:phase|wyckoff)\s*:?\s*(accumulation|markup|distribution|markdown)/i);
  if (wyckoffMatch && !vals.wyckoff) vals.wyckoff = wyckoffMatch[1].charAt(0).toUpperCase() + wyckoffMatch[1].slice(1).toLowerCase();

  const supports = [], resistances = [];
  const supMatch = sectionText.match(/support[s]?\s*:?\s*([\d$.,\s/–\-]+)/i);
  if (supMatch) {
    supMatch[1].match(/\d[\d,.]*\d/g)?.forEach(v => supports.push(parseFloat(v.replace(/,/g, ''))));
  }
  const resMatch = sectionText.match(/resist[aen]+ce[s]?\s*:?\s*([\d$.,\s/–\-]+)/i);
  if (resMatch) {
    resMatch[1].match(/\d[\d,.]*\d/g)?.forEach(v => resistances.push(parseFloat(v.replace(/,/g, ''))));
  }

  let setupNote = '';
  section.find('.pedagogy-box p, .didactic-box p, .alert-box p').each((_, el) => {
    const t = text($(el));
    if (t.length > 50 && !setupNote) setupNote = t;
  });

  const badges = [];
  section.find('.badge, [class*="badge"]').each((_, el) => {
    const t = text($(el));
    if (t && t.length > 3 && t.length < 30) badges.push(t);
  });

  const sourceRefs = extractSourceRefs(section, $);

  const result = {
    rsi14: vals.rsi14 || 50,
    ema20: vals.ema20 || 0,
    ema50: vals.ema50 || 0,
    ema200: vals.ema200 || 0,
    ...(vals.macd != null && { macd: vals.macd }),
    ...(vals.macdSignal != null && { macdSignal: vals.macdSignal }),
    ...(vals.atr14 && { atr14: vals.atr14 }),
    ...(vals.wyckoff && { wyckoff: vals.wyckoff }),
    ...(supports.length && { supports: supports.slice(0, 3) }),
    ...(resistances.length && { resistances: resistances.slice(0, 3) }),
    ...(setupNote && { setupNote }),
    ...(badges.length && { badges }),
    ...(sourceRefs.length && { sourceRefs })
  };

  return result;
}

function extractRisks($) {
  const section = $('#risques, #risks');
  if (!section.length) return { riskScore: 5, riskCards: [{ title: 'See article', severity: 'medium' }] };

  let riskScore = 5;
  const scoreMatch = text(section).match(/(\d+)\s*\/\s*10/);
  if (scoreMatch) riskScore = Math.min(10, Math.max(1, parseInt(scoreMatch[1], 10)));

  const riskProfile = inferRiskProfile(riskScore);

  let riskSummary = '';
  section.find('.risk-summary-detail p, .risk-summary p').each((_, el) => {
    const t = text($(el));
    if (t.length > 30 && !riskSummary) riskSummary = t;
  });

  const riskCards = [];
  section.find('.risk-card').each((_, el) => {
    const card = $(el);
    const title = text(card.find('h4, h3').first());
    const severity = inferSeverity(text(card.find('.risk-severity, [class*="severity"]').first()) || card.attr('class') || '');
    const icon = card.find('.risk-card-icon i, .fa-solid, .fas').first().attr('class')?.match(/fa-[\w-]+/)?.[0] || 'fa-triangle-exclamation';

    const points = [];
    card.find('li').each((_, li) => points.push(text($(li))));

    let probability = 50, impact = 50;
    const probFill = card.find('.risk-meter-fill').eq(0);
    const impFill = card.find('.risk-meter-fill').eq(1);
    if (probFill.length) {
      const w = probFill.attr('style')?.match(/width:\s*(\d+)/);
      if (w) probability = parseInt(w[1], 10);
    }
    if (impFill.length) {
      const w = impFill.attr('style')?.match(/width:\s*(\d+)/);
      if (w) impact = parseInt(w[1], 10);
    }

    const verdict = text(card.find('.risk-verdict').first());

    if (title) {
      riskCards.push({
        title,
        icon,
        severity,
        ...(points.length && { points }),
        probability,
        impact,
        ...(verdict && { verdict })
      });
    }
  });

  let pedagogy = '';
  section.find('.pedagogy-box p, .didactic-box p').each((_, el) => {
    const t = text($(el));
    if (t.length > 30 && !pedagogy) pedagogy = t;
  });

  const sourceRefs = extractSourceRefs(section, $);

  return {
    riskScore,
    riskProfile,
    ...(riskSummary && { riskSummary }),
    riskCards: riskCards.length ? riskCards : [{ title: 'See article for risk analysis', severity: 'medium' }],
    ...(pedagogy && { pedagogy }),
    ...(sourceRefs.length && { sourceRefs })
  };
}

function extractTradeIdea($) {
  const section = $('#trade, #trade-idea, #tradeidea');
  if (!section.length) return { entry: 0, stop: 0, tp1: 0, rr: 'N/A' };

  const sectionText = text(section);

  const entryMatch = sectionText.match(/entry\s*(?:zone|price)?\s*:?\s*\$?([\d,.]+)/i);
  const stopMatch = sectionText.match(/stop\s*(?:loss)?\s*:?\s*\$?([\d,.]+)/i);
  const tp1Match = sectionText.match(/(?:tp1|target\s*1|target)\s*:?\s*\$?([\d,.]+)/i);
  const tp2Match = sectionText.match(/(?:tp2|target\s*2)\s*:?\s*\$?([\d,.]+)/i);
  const rrMatch = sectionText.match(/(?:r\s*[\/:]\s*r|risk.*reward|r:r)\s*:?\s*([\d.]+\s*:\s*[\d.]+|[\d.]+)/i);
  const horizonMatch = sectionText.match(/(?:horizon|durée|timeframe)\s*:?\s*([\d]+-?\s*(?:day|days|jour|jours|week|weeks|semaine|month|mois)s?)/i);

  const entry = entryMatch ? parseFloat(entryMatch[1].replace(/,/g, '')) : 0;
  const stop = stopMatch ? parseFloat(stopMatch[1].replace(/,/g, '')) : 0;
  const tp1 = tp1Match ? parseFloat(tp1Match[1].replace(/,/g, '')) : 0;
  const tp2 = tp2Match ? parseFloat(tp2Match[1].replace(/,/g, '')) : undefined;
  const rr = rrMatch ? rrMatch[1].trim() : (entry && stop && tp1 ? `1:${((tp1 - entry) / (entry - stop)).toFixed(1)}` : 'N/A');

  let thesis = '';
  section.find('.pedagogy-box p, .didactic-box p, .trade-thesis p').each((_, el) => {
    const t = text($(el));
    if (t.length > 30 && !thesis) thesis = t;
  });

  const catalysts = [];
  section.find('ul li, .catalysts li').each((_, el) => {
    const t = text($(el));
    if (t.match(/catalyst|trigger|cataly|déclench/i) || catalysts.length < 4) {
      catalysts.push(t);
    }
  });

  const invalidation = [];
  section.find('.alert-box li, .invalidation li').each((_, el) => {
    invalidation.push(text($(el)));
  });
  if (!invalidation.length) {
    const invalMatch = sectionText.match(/invalidat\w+\s*:?\s*([^.]+\.)/i);
    if (invalMatch) invalidation.push(invalMatch[1].trim());
  }

  const result = {
    entry,
    stop,
    tp1,
    rr,
    status: 'active'
  };
  if (tp2) result.tp2 = tp2;
  if (horizonMatch) result.horizon = horizonMatch[1];
  if (thesis) result.thesis = thesis;
  if (entry && stop) result.stopPct = `${(((stop - entry) / entry) * 100).toFixed(1)}% risk`;
  if (entry && tp1) result.tp1Pct = `+${(((tp1 - entry) / entry) * 100).toFixed(1)}% upside`;
  if (entry && tp2) result.tp2Pct = `+${(((tp2 - entry) / entry) * 100).toFixed(1)}% upside`;
  if (catalysts.length) result.catalysts = catalysts.slice(0, 6);
  if (invalidation.length) result.invalidation = invalidation.slice(0, 4);

  return result;
}

function extractGlobalScore($) {
  const section = $('#score, #globalScore, #global-score, #note-globale');
  if (!section.length) return undefined;

  const sectionText = text(section);
  const profileMatch = sectionText.match(/profil[e]?\s*:?\s*([^\n<.]+)/i);

  const positive = [], negative = [];
  section.find('.verdict-pro li, [class*="positive"] li, [class*="green"] li, [class*="bull"] li').each((_, el) => {
    positive.push(text($(el)));
  });
  section.find('.verdict-con li, [class*="negative"] li, [class*="red"] li, [class*="bear"] li').each((_, el) => {
    negative.push(text($(el)));
  });

  if (!positive.length && !negative.length) {
    section.find('ul').each((_, ul) => {
      const heading = text($(ul).prev());
      const items = [];
      $(ul).find('li').each((_, li) => items.push(text($(li))));
      if (heading.match(/positif|positive|pro|bull|pour|✅|🟢|key.*positive|takeaway.*positive/i)) {
        positive.push(...items);
      } else if (heading.match(/négatif|negative|con|bear|contre|risk|❌|🔴|key.*negative|takeaway.*negative/i)) {
        negative.push(...items);
      }
    });
  }

  let mindsetTip = '';
  section.find('.pedagogy-box p, .didactic-box p, .alert-box p, .mindset p').each((_, el) => {
    const t = text($(el));
    if (t.length > 20 && !mindsetTip) mindsetTip = t;
  });

  const result = {};
  if (profileMatch) result.profile = profileMatch[1].trim();
  if (positive.length) result.keyTakeawaysPositive = positive.slice(0, 3);
  if (negative.length) result.keyTakeawaysNegative = negative.slice(0, 3);
  if (mindsetTip) result.mindsetTip = mindsetTip;

  return Object.keys(result).length ? result : undefined;
}

function extractEarnings($) {
  const section = $('#earnings, #resultats');
  if (!section.length) return undefined;

  const quarters = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 3) return;
    const quarter = text($(cells[0]));
    const actual = parseFloat(text($(cells[1])).replace(/[$,]/g, ''));
    const estimate = parseFloat(text($(cells[2])).replace(/[$,]/g, ''));
    if (quarter && !isNaN(actual)) {
      quarters.push({
        quarter,
        epsActual: actual,
        epsEstimate: isNaN(estimate) ? actual : estimate,
        ...(cells.length >= 4 && { surprise: text($(cells[3])) }),
        ...(cells.length >= 5 && { revActual: text($(cells[4])) }),
        ...(cells.length >= 6 && { revEstimate: text($(cells[5])) })
      });
    }
  });

  if (!quarters.length) return undefined;

  let beatStreak = 0;
  for (const q of quarters) {
    if (q.epsActual >= q.epsEstimate) beatStreak++;
    else break;
  }

  return {
    quarters,
    beatStreak,
    beatNote: `${beatStreak} consecutive beat${beatStreak > 1 ? 's' : ''}`
  };
}

function extractInsiders($) {
  const section = $('#insiders, #insider');
  if (!section.length) return undefined;

  const sectionText = text(section);
  const insiderPctMatch = sectionText.match(/insider[s]?\s*:?\s*(\d+\.?\d*\s*%)/i);
  const instPctMatch = sectionText.match(/institut\w+\s*:?\s*(\d+\.?\d*\s*%)/i);

  const topHolders = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      topHolders.push({
        name: text($(cells[0])),
        pct: text($(cells[1])),
        ...(cells.length >= 3 && { role: text($(cells[2])) })
      });
    }
  });

  const result = {};
  if (insiderPctMatch) result.insiderPct = insiderPctMatch[1];
  if (instPctMatch) result.institutionPct = instPctMatch[1];
  if (topHolders.length) result.topHolders = topHolders.slice(0, 5);

  const sourceRefs = extractSourceRefs(section, $);
  if (sourceRefs.length) result.sourceRefs = sourceRefs;

  return Object.keys(result).length ? result : undefined;
}

function extractCapitalStructure($) {
  const section = $('#capital, #capital-structure, #dilution');
  if (!section.length) return undefined;

  const sectionText = text(section);
  const sharesMatch = sectionText.match(/(?:outstanding|shares)\s*:?\s*([\d,.]+\s*[MB]?)/i);
  const authorizedMatch = sectionText.match(/authorized\s*:?\s*([\d,.]+\s*[MB]?)/i);

  let dilutionRisk = 'low';
  if (sectionText.match(/critical|critique|très\s*élevé/i)) dilutionRisk = 'critical';
  else if (sectionText.match(/high|élevé|haut/i)) dilutionRisk = 'high';
  else if (sectionText.match(/moderat|modéré|moyen/i)) dilutionRisk = 'moderate';

  const result = {};
  if (sharesMatch) result.sharesOutstanding = sharesMatch[1];
  if (authorizedMatch) result.sharesAuthorized = authorizedMatch[1];
  result.dilutionRisk = dilutionRisk;

  const sourceRefs = extractSourceRefs(section, $);
  if (sourceRefs.length) result.sourceRefs = sourceRefs;

  return Object.keys(result).length > 1 ? result : undefined;
}

function extractSectorComparison($) {
  const section = $('#peers, #sector, #comparaison, #competition');
  if (!section.length) return undefined;

  const peers = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      const peer = { ticker: text($(cells[0])) };
      if (cells.length >= 2) peer.name = text($(cells[1]));
      if (cells.length >= 3) peer.price = text($(cells[2]));
      if (cells.length >= 4) peer.pe = text($(cells[3]));
      if (cells.length >= 5) peer.ytd = text($(cells[4]));
      if (cells.length >= 6) peer.marketCap = text($(cells[5]));
      peers.push(peer);
    }
  });

  if (!peers.length) return undefined;

  const sectionText = text(section);
  let positioning = 'follower';
  if (sectionText.match(/leader/i)) positioning = 'leader';
  if (sectionText.match(/laggard|retard/i)) positioning = 'laggard';

  const sourceRefs = extractSourceRefs(section, $);

  return {
    peers,
    positioning,
    ...(sourceRefs.length && { sourceRefs })
  };
}

function extractMacro($) {
  const section = $('#macro, #context-macro, #macroeconomie');
  if (!section.length) return undefined;

  const indicators = [];
  section.find('.data-table tbody tr, table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      indicators.push({
        name: text($(cells[0])),
        value: text($(cells[1])),
        ...(cells.length >= 3 && { signal: text($(cells[2])) })
      });
    }
  });

  if (!indicators.length) return undefined;

  const sectionText = text(section);
  let regime = 'neutral';
  if (sectionText.match(/risk.on/i)) regime = 'risk-on';
  if (sectionText.match(/risk.off/i)) regime = 'risk-off';

  let impact = '';
  section.find('.pedagogy-box p, .alert-box p').each((_, el) => {
    const t = text($(el));
    if (t.length > 20 && !impact) impact = t;
  });

  const sourceRefs = extractSourceRefs(section, $);

  return {
    indicators,
    regime,
    ...(impact && { impact }),
    ...(sourceRefs.length && { sourceRefs })
  };
}

function extractSocial($) {
  const section = $('#social, #social-radar');
  if (!section.length) return undefined;

  const platforms = [];
  section.find('.social-metric-card, [style*="grid"] > div').each((_, el) => {
    const card = $(el);
    const platform = text(card.find('.platform, [class*="platform"]').first()) || text(card.find('div').eq(1));
    const iconEl = card.find('i[class*="fa-"]').first();
    const icon = iconEl.attr('class') || 'fa-solid fa-chart-simple';
    const mentions = text(card.find('.mentions, [class*="mention"]').first()) || text(card.find('div').eq(2));
    const badge = card.find('[class*="badge"]').first();
    const trend = text(badge);

    let trendColor = 'gray';
    const badgeClass = badge.attr('class') || '';
    if (badgeClass.includes('green')) trendColor = 'green';
    else if (badgeClass.includes('red')) trendColor = 'red';
    else if (badgeClass.includes('blue')) trendColor = 'blue';
    else if (badgeClass.includes('amber') || badgeClass.includes('purple')) trendColor = 'amber';

    const detail = text(card.find('.detail, [class*="detail"]').first()) || text(card.find('div').last());

    if (platform && platform.length > 1) {
      platforms.push({ platform, icon, mentions, trend, trendColor, detail });
    }
  });

  if (!platforms.length) return undefined;

  const sectionText = text(section);
  let pumpDumpScore;
  const pdMatch = sectionText.match(/pump\s*(?:&|and|et)?\s*dump\s*(?:score)?\s*:?\s*(\d)\s*\/\s*6/i);
  if (pdMatch) pumpDumpScore = parseInt(pdMatch[1], 10);

  const sourceRefs = extractSourceRefs(section, $);

  return {
    platforms,
    ...(pumpDumpScore != null && { pumpDumpScore }),
    ...(sourceRefs.length && { sourceRefs })
  };
}

function extractOptions($) {
  const section = $('#options, #derives, #derivés');
  if (!section.length) return undefined;

  const sectionText = text(section);
  const result = {};

  const pats = {
    callOI: /call\s*(?:oi|open\s*interest)\s*:?\s*([\d,.]+\s*[KMB]?)/i,
    putOI: /put\s*(?:oi|open\s*interest)\s*:?\s*([\d,.]+\s*[KMB]?)/i,
    cpRatio: /(?:c\/p|call.*put)\s*(?:ratio)?\s*:?\s*([\d.]+)/i,
    maxPain: /max\s*pain\s*:?\s*\$?([\d,.]+)/i,
    ivMean: /iv\s*(?:mean|avg|average)?\s*:?\s*([\d.]+\s*%?)/i,
  };

  for (const [key, pat] of Object.entries(pats)) {
    const m = sectionText.match(pat);
    if (m) result[key] = m[1];
  }

  const sourceRefs = extractSourceRefs(section, $);
  if (sourceRefs.length) result.sourceRefs = sourceRefs;

  return Object.keys(result).length ? result : undefined;
}

function extractShortInterest($) {
  const section = $('#short, #short-interest, #squeeze');
  if (!section.length) return undefined;

  const sectionText = text(section);
  const result = {};

  const pats = {
    siPct: /(?:short\s*interest|si)\s*:?\s*[\d,.]*\s*\(?(\d+\.?\d*\s*%)/i,
    daysToCover: /days?\s*to\s*cover\s*:?\s*([\d.]+)/i,
    ctb: /(?:ctb|cost\s*to\s*borrow)\s*:?\s*([\d.]+\s*%?)/i,
  };

  for (const [key, pat] of Object.entries(pats)) {
    const m = sectionText.match(pat);
    if (m) result[key] = m[1];
  }

  const sourceRefs = extractSourceRefs(section, $);
  if (sourceRefs.length) result.sourceRefs = sourceRefs;

  return Object.keys(result).length ? result : undefined;
}

function extractSourceRefs(section, $) {
  const refs = [];
  section.find('.source-ref, .source-refs a, a[class*="source"]').each((_, el) => {
    const a = $(el);
    const url = a.attr('href');
    const name = text(a.find('.source-name').length ? a.find('.source-name') : a);
    const dateEl = a.find('.source-date');
    const date = dateEl.length ? text(dateEl).replace(/^[·•\s]+/, '') : '';

    if (url && url.startsWith('http') && name) {
      refs.push({ name, url, ...(date && { date }) });
    }
  });
  return refs;
}

function extractArchiveHistory($, ticker) {
  const archiveDir = path.join(ROOT, 'analyses', ticker, 'archive');
  if (!fs.existsSync(archiveDir)) return undefined;

  const entries = [];
  const dirs = fs.readdirSync(archiveDir).filter(d => /^\d{8}$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const htmlPath = path.join(archiveDir, d, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    entries.push({
      date,
      dateDisplay: date,
      note: 'Previous version'
    });
  }
  return entries.length ? entries : undefined;
}

// ─── Main migration ──────────────────────────────────────────────────────

function migrateOne(htmlPath, dryRun) {
  const ticker = path.basename(path.dirname(htmlPath));
  const html = fs.readFileSync(htmlPath, 'utf8');

  if (html.length < 5000) {
    console.log(`  [SKIP] ${ticker} — HTML too small (${(html.length / 1024).toFixed(1)}KB)`);
    return null;
  }

  const $ = cheerio.load(html);

  const meta = extractMeta($);
  const header = extractHeader($);

  if (!header.ticker || header.ticker === '') {
    header.ticker = ticker;
  }

  meta.assetType = guessAssetType(header.ticker, header.sector, header.exchange);

  const verdict = extractVerdict($);
  const business = extractBusiness($);
  const news = extractNews($);
  const fundamentals = extractFundamentals($);
  const earnings = extractEarnings($);
  const insiders = extractInsiders($);
  const capitalStructure = extractCapitalStructure($);
  const shortInterest = extractShortInterest($);
  const options = extractOptions($);
  const technicals = extractTechnicals($);
  const sectorComparison = extractSectorComparison($);
  const macro = extractMacro($);
  const risks = extractRisks($);
  const social = extractSocial($);
  const tradeIdea = extractTradeIdea($);
  const globalScore = extractGlobalScore($);
  const archiveHistory = extractArchiveHistory($, ticker);

  const data = {
    meta,
    header,
    ...(verdict && { verdict: verdict }),
    business,
    ...(news && { news }),
    fundamentals,
    ...(earnings && { earnings }),
    ...(insiders && { insiders }),
    ...(capitalStructure && { capitalStructure }),
    ...(shortInterest && { shortInterest }),
    ...(options && { options }),
    technicals,
    ...(sectorComparison && { sectorComparison }),
    ...(macro && { macro }),
    risks,
    ...(social && { social }),
    tradeIdea,
    ...(globalScore && { globalScore }),
    ...(archiveHistory && { archiveHistory })
  };

  if (!data.verdict) {
    data.verdict = {
      score: 50,
      conviction: 'Moderate',
      bias: 'Neutral',
      whyBuy: ['See original article for details', 'See original article for details', 'See original article for details'],
      whyAvoid: ['See original article for details', 'See original article for details']
    };
  }

  const sections = Object.keys(data).filter(k => data[k] != null && k !== 'meta' && k !== 'header');

  if (dryRun) {
    console.log(`  [DRY] ${ticker} (${meta.grade}) — ${sections.length} sections extracted: ${sections.join(', ')}`);
    return ticker;
  }

  const outPath = path.join(DATA_DIR, `${ticker}.json`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  [OK] ${ticker} → ${outPath} (${sizeKb}KB, ${sections.length} sections)`);
  return ticker;
}

function report() {
  const analysesDir = path.join(ROOT, 'analyses');
  const dirs = fs.readdirSync(analysesDir).filter(d => {
    return fs.existsSync(path.join(analysesDir, d, 'index.html'));
  });

  const existing = new Set(
    fs.existsSync(DATA_DIR)
      ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      : []
  );

  const migrated = dirs.filter(d => existing.has(d));
  const pending = dirs.filter(d => !existing.has(d));

  console.log(`\n  === Migration Report ===`);
  console.log(`  Total HTML analyses:  ${dirs.length}`);
  console.log(`  Already have JSON:    ${migrated.length}`);
  console.log(`  Pending migration:    ${pending.length}`);
  console.log(`  Coverage:             ${((migrated.length / dirs.length) * 100).toFixed(1)}%`);
  console.log(`\n  Pending: ${pending.slice(0, 20).join(', ')}${pending.length > 20 ? ` ... (+${pending.length - 20} more)` : ''}`);
}

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const positional = args.filter(a => !a.startsWith('--'));

  const dryRun = flags.has('--dry');
  const all = flags.has('--all');
  const skipExisting = flags.has('--skip-existing');
  const reportOnly = flags.has('--report');

  if (reportOnly) {
    report();
    return;
  }

  if (!all && !positional.length) {
    console.log(`
migrate-analysis.js — HTML → JSON migration

Usage:
  node tools/migrate-analysis.js analyses/SHEL/index.html        # migrate one
  node tools/migrate-analysis.js analyses/SHEL/index.html --dry   # preview
  node tools/migrate-analysis.js --all                            # migrate all legacy
  node tools/migrate-analysis.js --all --dry                      # preview all
  node tools/migrate-analysis.js --all --skip-existing            # skip already-migrated
  node tools/migrate-analysis.js --report                         # coverage report
`);
    return;
  }

  let files;
  if (all) {
    const analysesDir = path.join(ROOT, 'analyses');
    const existing = new Set(
      fs.existsSync(DATA_DIR)
        ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
        : []
    );

    files = fs.readdirSync(analysesDir)
      .filter(d => fs.existsSync(path.join(analysesDir, d, 'index.html')))
      .filter(d => !skipExisting || !existing.has(d))
      .map(d => path.join(analysesDir, d, 'index.html'));

    console.log(`[MIGRATE] Found ${files.length} HTML analyses${skipExisting ? ` (skipping ${existing.size} with existing JSON)` : ''}`);
  } else {
    files = positional.map(f => path.resolve(f));
  }

  const results = { ok: 0, skip: 0, fail: 0 };

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`  [ERROR] File not found: ${file}`);
      results.fail++;
      continue;
    }
    try {
      const r = migrateOne(file, dryRun);
      if (r) results.ok++;
      else results.skip++;
    } catch (e) {
      const ticker = path.basename(path.dirname(file));
      console.log(`  [ERROR] ${ticker}: ${e.message}`);
      results.fail++;
    }
  }

  console.log(`\n[DONE] OK: ${results.ok}, Skipped: ${results.skip}, Errors: ${results.fail}`);
}

main();
