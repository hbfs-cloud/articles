/**
 * News & SEC filings tracker
 * Monitors news, SEC EDGAR filings, earnings for watchlist tickers
 * Sends alerts on significant events
 */

import * as cache from './cache.js';

const SEC_BASE = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_FILINGS = 'https://data.sec.gov/submissions';

// ══════════════════════════════════════
// SEC EDGAR — Filing Search
// ══════════════════════════════════════

export async function getRecentFilings(ticker, types = ['10-K', '10-Q', '8-K', '4'], limit = 10) {
  const key = `sec:${ticker}:${types.join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    // First get CIK from ticker
    const cik = await getCIK(ticker);
    if (!cik) return { ticker, filings: [], error: 'CIK not found' };

    const url = `${EDGAR_FILINGS}/CIK${cik.padStart(10, '0')}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DailyTickers MCP contact@dailytickers.com' }
    });
    if (!res.ok) return { ticker, filings: [] };

    const data = await res.json();
    const recent = data.filings?.recent || {};
    const filings = [];

    const forms = recent.form || [];
    const dates = recent.filingDate || [];
    const descriptions = recent.primaryDocDescription || [];
    const accessions = recent.accessionNumber || [];

    for (let i = 0; i < Math.min(forms.length, 50); i++) {
      if (types.includes(forms[i]) || types.includes('*')) {
        filings.push({
          type: forms[i],
          date: dates[i],
          description: descriptions[i] || '',
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${forms[i]}&dateb=&owner=include&count=5`,
          accession: accessions[i]
        });
      }
      if (filings.length >= limit) break;
    }

    const result = { ticker, company: data.name, cik, filings };
    cache.set(key, result, 3600); // 1 hour cache
    return result;
  } catch (err) {
    return { ticker, filings: [], error: err.message };
  }
}

async function getCIK(ticker) {
  const key = `cik:${ticker}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'DailyTickers MCP contact@dailytickers.com' }
    });
    const data = await res.json();

    for (const entry of Object.values(data)) {
      if (entry.ticker === ticker.toUpperCase()) {
        const cik = String(entry.cik_str);
        cache.set(key, cik, 86400 * 30); // cache 30 days
        return cik;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════
// INSIDER TRANSACTIONS (Form 4)
// ══════════════════════════════════════

export async function getInsiderActivity(ticker) {
  const filings = await getRecentFilings(ticker, ['4'], 20);
  return {
    ticker,
    insiderFilings: filings.filings,
    summary: {
      totalFilings: filings.filings.length,
      recentDays: filings.filings.length > 0 ? daysSince(filings.filings[0].date) : null
    }
  };
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ══════════════════════════════════════
// NEWS AGGREGATOR
// ══════════════════════════════════════

export async function aggregateNews(tickers, limit = 5) {
  const allNews = [];

  for (const ticker of tickers) {
    try {
      // Use Yahoo search API for news
      const key = `news:${ticker}`;
      const cached = cache.get(key);
      let news;

      if (cached) {
        news = cached;
      } else {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&quotesCount=0&newsCount=${limit}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
          const data = await res.json();
          news = (data.news || []).map(n => ({
            ticker,
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null
          }));
          cache.set(key, news, 300);
        } else {
          news = [];
        }
      }

      allNews.push(...news);
    } catch {
      // skip errors
    }
  }

  // Sort by date descending
  allNews.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
    const db = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
    return db - da;
  });

  return allNews;
}

// ══════════════════════════════════════
// NEWS MONITOR (check for new articles)
// ══════════════════════════════════════

const seenUrls = new Set();
let onNewsCallback = null;

export function onNewArticle(callback) {
  onNewsCallback = callback;
}

export async function checkForNewNews(tickers) {
  const news = await aggregateNews(tickers, 3);
  const newArticles = [];

  for (const article of news) {
    if (article.link && !seenUrls.has(article.link)) {
      seenUrls.add(article.link);
      newArticles.push(article);
    }
  }

  if (newArticles.length > 0 && onNewsCallback) {
    for (const article of newArticles) {
      onNewsCallback(article);
    }
  }

  return newArticles;
}

// ══════════════════════════════════════
// EARNINGS CALENDAR
// ══════════════════════════════════════

export async function getUpcomingEarnings(tickers) {
  const results = [];

  for (const ticker of tickers) {
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;

      const data = await res.json();
      const cal = data?.quoteSummary?.result?.[0]?.calendarEvents;
      if (!cal?.earnings) continue;

      const earningsDate = cal.earnings.earningsDate?.[0]?.fmt;
      if (!earningsDate) continue;

      results.push({
        ticker,
        earningsDate,
        epsEstimate: cal.earnings.earningsAverage?.raw,
        revenueEstimate: cal.earnings.revenueAverage?.raw,
        epsTrend: {
          current: cal.earnings.earningsAverage?.raw,
          weekAgo: cal.earnings.earningsAverage?.raw // simplified
        }
      });
    } catch {
      // skip
    }
  }

  // Sort by earnings date
  results.sort((a, b) => new Date(a.earningsDate) - new Date(b.earningsDate));
  return results;
}
