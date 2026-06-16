'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const GO_CACHE_DIR = path.resolve(__dirname, '../../../systematic-tss/cache/stockanalysis/stock/US');
const JS_CACHE_DIR = path.resolve(__dirname, '../../cache/stockanalysis');

const DB_STOCK_URL = 'https://stockanalysis.com/api/screener/s/bd/name+marketCap+priceTargetChange+industry+sector+shortRatio+dollarVolume+high+premarketChangePercent+postmarketPrice+low52+relativeVolume+beta+open+close+postmarketChangePercent+premarketVolume+high52+daysGap+low+premarketPrice+preClose+postClose+averageVolume+changeFromOpen+enterpriseValue+marketCapCategory+psRatio+pFcfRatio+evSales+evEbitda+priceEbitda+fcfEvYield+peRatio+peRatio5Y+peRatio3Y+fcfYield+evFcf+evEarnings+pegRatio+pbRatio+peForward+psForward+pOcfRatio+evSalesForward+evEbit+earningsYield+ptbvRatio+rsi+atr+ma150+ma50ch+ma50vs200+ma150ch+ma20+rsiWeekly+ma200+ma200ch+ma20ch+ma50+rsiMonthly+exchange+employees+founded+fiscalYearEnd+optionable+sic+cusip+website+cik+inIndex+last10kFilingDate+ipoDate+employeesChange+country+usState+employeesChangePercent+lastReportDate+isSpac+tags+isin+earningsDate+earningsTime+earningsEpsEstimate+lastEarningsDate+earningsRevenueEstimate+earningsEpsEstimateGrowth+nextEarningsDate+earningsRevenueEstimateGrowth+low52ch+allTimeHighChange+allTimeLowChange+iprfo+allTimeLowDate+allTimeHighDate+high52ch+ipr+allTimeLow+allTimeHigh+ch3m+ch1y+ch10y+ch20y+ch5y+ch1m+chYTD+ch15y+ch3y+ch6m+ch1w+tr1w+tr6m+tr3y+tr15y+tr1m+trYTD+tr5y+tr20y+tr3m+tr1y+tr10y+cagr1y+cagr10y+cagr3y+cagr15y+cagr5y+cagr20y+priceTarget+analystCount+analystRatings+epsNextQuarter+revenueThisQuarter+revenueNextYear+eps5y+revenueNextQuarter+epsThisYear+epsThisQuarter+epsNextYear+revenueThisYear+revenue5y+dividendYield+dividendGrowth+payoutRatio+totalReturn+exDivDate+payoutFrequency+dividendGrowthYears+dps+lastDividend+divCAGR5+buybackYield+paymentDate+sharesYoY+sharesInstitutions+sharesInsiders+float+sharesOut+sharesQoQ+revenue+revenueGrowth3Y+revenueGrowthQuarters+revenueGrowth5Y+revenueGrowth+revenueGrowthQ+revenueGrowthYears+netIncomeGrowthQ+netIncomeGrowthYears+netIncomeGrowth5Y+netIncomeGrowth+netIncome+netIncomeGrowth3Y+netIncomeGrowthQuarters+eps+epsGrowth3Y+epsGrowthQuarters+epsGrowth5Y+epsGrowth+epsGrowthQ+epsGrowthYears+grossProfitGrowthQ+operatingIncome+operatingIncomeGrowth3Y+grossProfitGrowth+grossProfitGrowth5Y+operatingIncomeGrowthQ+ebitda+ebit+grossProfit+grossProfitGrowth3Y+operatingIncomeGrowth+operatingIncomeGrowth5Y+grossMargin+profitMargin+ebitMargin+fcfMargin+operatingMargin+pretaxMargin+ebitdaMargin+financingCF+fcf+fcfGrowth+fcfGrowth5Y+fcfGrowth3Y+fcfPerShare+capex+investingCF+operatingCF+netCF+adjustedFCF+fcfGrowthQ+rndByRevenue+sbcByRevenue+shareBasedComp+researchAndDevelopment+cash+debtGrowthQoQ+netCash+debt+debtGrowth3Y+netCashGrowth+debtGrowth+debtGrowth5Y+netCashByMarketCap+equity+tangibleBookValuePerShare+workingCapitalTurnover+netWorkingCapital+tangibleBookValue+liabilities+assets+bvPerShare+workingCapital+currentRatio+debtEbitda+quickRatio+debtFcf+debtEquity+interestCoverage+shortShares+shortFloat+roe+roce+roic5y+roa+roe5y+revPerEmployee+profitPerEmployee+roa5y+roic+lastSplitDate+lastSplitType+incomeTax+taxRate+taxByRevenue+pFFO+ffo+grahamUpside+lynchUpside+zScore+inventoryTurnover+assetTurnover+fScore+views+enterpriseValue+peForward+psRatio+pbRatio+pFcfRatio+sector+priceTargetChange+ch1w+ch1m+ch6m+chYTD+ch1y+ch3y+ch5y.json';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function findLatestGoCache() {
  if (!fs.existsSync(GO_CACHE_DIR)) return null;
  // Go priority: frozen > date-based
  const frozen = path.join(GO_CACHE_DIR, 'tickers-frozen.json');
  if (fs.existsSync(frozen)) return frozen;
  const files = fs.readdirSync(GO_CACHE_DIR)
    .filter(f => f.startsWith('tickers-') && f.endsWith('.json'))
    .sort();
  if (!files.length) return null;
  return path.join(GO_CACHE_DIR, files[files.length - 1]);
}

function findLocalCache() {
  if (!fs.existsSync(JS_CACHE_DIR)) return null;
  const files = fs.readdirSync(JS_CACHE_DIR)
    .filter(f => f.startsWith('tickers-') && f.endsWith('.json'))
    .sort();
  if (!files.length) return null;
  return path.join(JS_CACHE_DIR, files[files.length - 1]);
}

function parseCache(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return raw.data?.data || raw.data || raw;
}

function fetchFromAPI() {
  return new Promise((resolve, reject) => {
    const req = https.get(DB_STOCK_URL, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://stockanalysis.com/stocks/screener/',
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`StockAnalysis API HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function refresh() {
  try {
    const result = await fetchFromAPI();
    if (result.status !== 200 || !result.data?.data) {
      throw new Error('Invalid API response');
    }
    fs.mkdirSync(JS_CACHE_DIR, { recursive: true });
    const outFile = path.join(JS_CACHE_DIR, `tickers-${todayStr()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`[stockanalysis] Refreshed → ${outFile} (${Object.keys(result.data.data).length} tickers)`);
    return result.data.data;
  } catch (err) {
    console.warn(`[stockanalysis] API refresh failed (${err.message}), falling back to cache`);
    return null;
  }
}

async function loadUniverse({ minMarketCap = 300_000_000, forceRefresh = false } = {}) {
  let stocks = null;
  let source = '';

  if (forceRefresh) {
    stocks = await refresh();
    if (stocks) source = 'api';
  }

  if (!stocks) {
    const localFile = findLocalCache();
    if (localFile) {
      stocks = parseCache(localFile);
      source = `local:${path.basename(localFile)}`;
    }
  }

  if (!stocks) {
    const goFile = findLatestGoCache();
    if (goFile) {
      stocks = parseCache(goFile);
      source = `go:${path.basename(goFile)}`;
      // Copy to local cache for future runs
      fs.mkdirSync(JS_CACHE_DIR, { recursive: true });
      const localCopy = path.join(JS_CACHE_DIR, path.basename(goFile));
      if (!fs.existsSync(localCopy)) {
        fs.copyFileSync(goFile, localCopy);
      }
    }
  }

  if (!stocks) {
    throw new Error('No StockAnalysis data found (no API, no local cache, no Go cache)');
  }

  const tickers = [];
  for (const [ticker, data] of Object.entries(stocks)) {
    if (minMarketCap > 0 && (data.marketCap || 0) < minMarketCap) continue;
    tickers.push(ticker);
  }

  tickers.sort();
  console.log(`[stockanalysis] ${tickers.length} tickers (mcap >= ${(minMarketCap / 1e6).toFixed(0)}M) from ${source}`);
  return { tickers, stocks, source };
}

function getTickerData(stocks, ticker) {
  return stocks[ticker] || null;
}

module.exports = { loadUniverse, refresh, getTickerData, DB_STOCK_URL };
