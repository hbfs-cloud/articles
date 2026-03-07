/**
 * Universe management
 * Pre-built symbol lists for US/EU/APAC/ETF/Crypto
 * + Yahoo Finance dynamic screener integration
 */

import * as cache from './cache.js';

const YF_SEARCH    = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_SCREENER  = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';
const HEADERS      = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

// ═══════════════════════════════════════════════════════
// PRE-BUILT UNIVERSES
// ═══════════════════════════════════════════════════════

export const UNIVERSES = {

  // S&P 500 + Nasdaq 100 representative — 200 symbols
  us_large: [
    'AAPL','MSFT','NVDA','AMZN','GOOGL','META','LLY','AVGO','TSLA','JPM',
    'V','UNH','XOM','WMT','MA','PG','JNJ','COST','HD','BAC',
    'NFLX','MRK','CRM','ABBV','CVX','AMD','TMO','ORCL','ACN','LIN',
    'MCD','ADBE','PEP','NOW','DHR','GE','AXP','ISRG','QCOM','TXN',
    'BKNG','IBM','NEE','UBER','MS','PM','RTX','T','BX','AMGN',
    'SPGI','GS','SYK','GILD','BLK','ETN','ELV','C','PFE','DE',
    'SCHW','VRTX','MDT','TMUS','CB','INTC','REGN','MMC','BSX','PANW',
    'CI','TT','ADP','INTU','MU','LRCX','ADI','KKR','SHW','BA',
    'FI','CMG','KLAC','SNPS','PGR','AMAT','ITW','ICE','PLD','HCA',
    'DUK','EOG','WM','SO','CDNS','ORLY','ZTS','MCO','RCL','MAR',
    'PYPL','MNST','CSX','NOC','CTAS','APH','EMR','TDG','USB','CMI',
    'MPC','TFC','NSC','PH','NKE','ODFL','ECL','AON','FTNT','PCAR',
    'GWW','CARR','WELL','KMI','OXY','CL','FDX','PAYX','AJG','SPG',
    'RSG','IDXX','NXPI','HES','MCK','HLT','SRE','TJX','AFL','ROST',
    'BDX','MCHP','GLW','EW','VRSK','WEC','YUM','PPG','ROK','LHX',
    'DG','KR','HSY','VICI','AMT','CCI','PSA','SBAC','EQIX','LULU',
    'APP','AXON','CRWD','SNOW','PLTR','SQ','COIN','MSTR','ARM','SMCI',
    'TTD','HIMS','DDOG','HOOD','RBLX','NET','CFLT','GTLB','BILL','ZS'
  ],

  // Russell 2000 representative — 60 symbols
  us_mid: [
    'DECK','EXP','SAIA','EXPO','LBRT','CELH','GMED','AAON','CSWI','STEP',
    'MGEE','SITE','TGTX','PRGS','HALO','ALKS','NTNX','SFM','CHRD','WHD',
    'UFPI','BCPC','CALM','PLXS','MDGL','OSCR','RXO','TMHC','NVT','BLBD',
    'ROIC','HRI','AMSF','SKYW','CAKE','CPNG','PLMR','MLAB','ALRM','VRRM',
    'FOUR','BIRK','CVNA','RIVN','LCID','JOBY','ACMR','PCTY','GTLS','FLNC'
  ],

  // STOXX 600 representative — 65 symbols
  eu: [
    // Netherlands
    'ASML.AS','HEIA.AS','INGA.AS','PHIA.AS','UNA.AS',
    // Germany
    'SAP.DE','SIE.DE','BAYN.DE','BMW.DE','VOW3.DE','BAS.DE','MUV2.DE',
    'DTE.DE','ADS.DE','EOAN.DE','MBG.DE','DBKN.DE','ALV.DE','IFX.DE',
    // France
    'MC.PA','OR.PA','TTE.PA','SAN.PA','BNP.PA','AIR.PA',
    'BN.PA','RI.PA','STM.PA','VIE.PA','LR.PA','PUB.PA','CA.PA',
    // Switzerland
    'NESN.SW','NOVN.SW','ROG.SW','ABBN.SW','ZURN.SW','SOON.SW',
    // UK
    'BP.L','SHEL.L','HSBA.L','LLOY.L','RIO.L','GSK.L','AZN.L',
    'ULVR.L','RR.L','BA.L','REL.L','PRU.L','NG.L','NWG.L',
    'VOD.L','WPP.L','IMB.L','TSCO.L','LSEG.L','STAN.L','BARC.L',
    // Italy
    'ENI.MI','ENEL.MI','ISP.MI','UCG.MI','ATL.MI',
    // Spain
    'ITX.MC','BBVA.MC','SAN.MC','IBE.MC','REP.MC',
    // Sweden
    'ERICB.ST','VOLVA.ST','SKF-B.ST','ALFA.ST'
  ],

  // APAC — 50 symbols
  apac: [
    // Japan (TSE)
    '7203.T','6758.T','9984.T','6861.T','8306.T','6501.T','9432.T',
    '7267.T','4063.T','6954.T','8058.T','8316.T','9433.T','7974.T',
    '4661.T','6367.T','6902.T','8411.T','7832.T','9022.T',
    // Korea
    '005930.KS','000660.KS','373220.KS','207940.KS','005490.KS',
    // Taiwan
    '2330.TW','2454.TW','2317.TW','2303.TW',
    // Hong Kong / China H
    '700.HK','9988.HK','1299.HK','939.HK','2318.HK','941.HK',
    '388.HK','1398.HK','2628.HK','3988.HK',
    // Australia (ASX)
    'BHP.AX','CBA.AX','CSL.AX','NAB.AX','WBC.AX','ANZ.AX','RIO.AX','WDS.AX'
  ],

  // Major ETFs — 55 symbols
  etf: [
    // Broad market
    'SPY','QQQ','IWM','DIA','VTI','VOO','VT',
    // International
    'VEA','VWO','EFA','EEM','FXI','EWJ','EWG','EWQ','EWU','EWY','EWT','EWH','MCHI','VGK','EZU',
    // US Sectors
    'XLF','XLE','XLK','XLV','XLI','XLC','XLY','XLP','XLRE','XLB','XLU',
    // Commodities
    'GLD','SLV','GDX','GDXJ','USO','UNG',
    // Bonds
    'TLT','IEF','SHY','HYG','LQD','EMB',
    // Thematic
    'ARKK','IBB','XBI','SOXX','SMH','KWEB','JETS','HACK','BOTZ','ICLN','TAN','PAVE','ITB','KRE',
    // Inverse/hedge
    'SH','SQQQ','UVXY'
  ],

  // Crypto via Yahoo Finance — 25 pairs
  crypto: [
    'BTC-USD','ETH-USD','BNB-USD','SOL-USD','XRP-USD','DOGE-USD',
    'ADA-USD','AVAX-USD','DOT-USD','LINK-USD','LTC-USD',
    'BCH-USD','UNI-USD','ATOM-USD','APT-USD','ARB-USD',
    'SUI-USD','TRX-USD','SHIB-USD','TON-USD','PEPE-USD',
    'INJ-USD','SEI-USD','WLD-USD','JUP-USD'
  ]
};

// Composite aliases
UNIVERSES.us   = [...UNIVERSES.us_large, ...UNIVERSES.us_mid];
UNIVERSES.all  = [...UNIVERSES.us_large, ...UNIVERSES.us_mid, ...UNIVERSES.eu, ...UNIVERSES.apac, ...UNIVERSES.etf];

// ═══════════════════════════════════════════════════════
// METADATA
// ═══════════════════════════════════════════════════════

export function get(name) {
  return UNIVERSES[name.toLowerCase()] || [];
}

export function list() {
  return Object.entries(UNIVERSES)
    .filter(([k]) => !['us', 'all'].includes(k))
    .map(([key, syms]) => ({
      key,
      count: syms.length,
      sample: syms.slice(0, 6).join(', ')
    }));
}

// ═══════════════════════════════════════════════════════
// DYNAMIC — Yahoo Finance search
// ═══════════════════════════════════════════════════════

export async function searchTickers(query, type = null, count = 20) {
  const cacheKey = `universe:search:${query}:${type}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${YF_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=${count}&newsCount=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];

  const data = await res.json();
  const results = (data.quotes || [])
    .filter(q => !type || q.quoteType?.toLowerCase() === type.toLowerCase())
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname,
      exchange: q.exchange,
      type: q.quoteType,
      region: exchangeToRegion(q.exchange)
    }));

  cache.set(cacheKey, results, 3600);
  return results;
}

// ═══════════════════════════════════════════════════════
// DYNAMIC — Yahoo Finance predefined screeners
// ═══════════════════════════════════════════════════════

export const YF_SCREENER_IDS = {
  most_actives:        'most_actives',
  day_gainers:         'day_gainers',
  day_losers:          'day_losers',
  undervalued_large:   'undervalued_large_caps',
  growth_tech:         'growth_technology_stocks',
  aggressive_small:    'aggressive_small_caps',
  high_yield_bond:     'high_yield_bond'
};

export async function fetchYahooScreener(scrId, count = 50) {
  const cacheKey = `universe:screener:${scrId}:${count}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${YF_SCREENER}?scrIds=${scrId}&count=${count}&start=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];

  const data = await res.json();
  const symbols = (data.finance?.result?.[0]?.quotes || [])
    .map(q => q.symbol)
    .filter(Boolean);

  cache.set(cacheKey, symbols, 600);
  return symbols;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function exchangeToRegion(exchange = '') {
  const eu   = ['PAR','XET','AMS','LSE','MIL','MCE','STO','OSL','CPH','HEL','BRU','LIS','VIE'];
  const apac = ['TKS','KSC','TAI','HKG','ASX','NSE','BSE','SHH','SHZ','NGM'];
  if (eu.some(e => exchange.includes(e)))   return 'EU';
  if (apac.some(e => exchange.includes(e))) return 'APAC';
  return 'US';
}
