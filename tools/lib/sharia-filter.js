// sharia-filter.js — Shared Sharia (Halal) compliance filter for DailyTickers scanner.
//
// Single source of truth for the haram-exclusion logic used by BOTH:
//   - tools/sweep.js       (backtest never HOLDS a haram ticker in a shariaOnly mode)
//   - tools/gen-status-page.js (Halal page never DISPLAYS/RECOMMENDS a haram ticker in signals/orders)
//
// Keeping these in one place prevents the divergence where the backtest excluded a ticker
// but the public page still printed a BUY order for it.

// FALLBACK Sharia exclusion list — used ONLY for old scans that don't have data-sharia attributes.
// New scans have data-sharia="true/false" on each <tr> in the synthese table (evaluated at generation
// time using real financial ratios per scanner/CLAUDE.md "Sharia Compliance Tagging" section).
const SHARIA_EXCLUDED = new Set([
  // Banks & financial services (interest-based revenue / riba)
  'JPM','BAC','GS','MS','C','WFC','USB','PNC','TFC','SCHW','BK','STT','AIG','MET','PRU',
  'BBVA','BNP','HSBC','DB','UBS','CS','ING','SAN','BNPQY','RY','TD','BMO','XLF',
  // Consumer/student-loan & specialty finance (net interest income / riba) — NNI=Nelnet (Nelnet Bank)
  'NNI','SLM','NAVI','SOFI','ALLY','SYF','DFS','COF','OMF','LC','UPST','RF','KEY','HBAN','FITB','CFG','MTB','CMA','ZION',
  'RKT','UWMC','NMIH','ESNT','MTG','RDN','PFSI','COOP','TREE','ENVA','WRLD','CURO','FCFS',
  // Insurance (conventional, non-takaful)
  'UNH','CI','HUM','ELV','ALL','PGR','TRV','AFL','MCK','XLV',
  // Defense & weapons
  'LMT','RTX','NOC','GD','BA','HII','LHX','LDOS','HEI','TXT','KTOS','ITA',
  // Alcohol, tobacco, gambling
  'BUD','DEO','STZ','SAM','TAP','PM','MO','BTI','DKNG','MGM','WYNN','LVS','CZR','GENI',
  // Bond/Treasury ETFs (interest-based instruments)
  'TLT','TBT','SHY','IEF','AGG','BND','GOVT','BNDX','HYG','LQD','JNK','MUB',
  // Leveraged & inverse ETFs (gharar — excessive uncertainty)
  'TQQQ','SQQQ','SPXU','UPRO','LABU','LABD','UVXY','SVXY','SOXL','SOXS','FAS','FAZ',
  'SH','SDS','QID','PSQ',
]);

// Sector lookup — embedded GICS-ish map for the scanner universe.
// Unknown tickers fall back to 'Other' (cap still enforced for the bucket).
const SECTOR_MAP = {
  // Tech
  'AAPL':'Tech','MSFT':'Tech','GOOGL':'Tech','GOOG':'Tech','META':'Tech','NFLX':'Tech',
  'CRM':'Tech','ORCL':'Tech','ADBE':'Tech','NOW':'Tech','INTU':'Tech','PANW':'Tech',
  'FTNT':'Tech','CRWD':'Tech','ZS':'Tech','SNOW':'Tech','PLTR':'Tech','DDOG':'Tech',
  'NET':'Tech','OKTA':'Tech','TEAM':'Tech','SHOP':'Tech','SQ':'Tech','PYPL':'Tech',
  // Semis
  'NVDA':'Semis','AMD':'Semis','AVGO':'Semis','TSM':'Semis','INTC':'Semis','MU':'Semis',
  'QCOM':'Semis','MRVL':'Semis','LRCX':'Semis','AMAT':'Semis','KLAC':'Semis','ASML':'Semis',
  'ARM':'Semis','SMCI':'Semis','ON':'Semis','ADI':'Semis','TXN':'Semis',
  // Consumer
  'AMZN':'Consumer','TSLA':'Consumer','HD':'Consumer','MCD':'Consumer','NKE':'Consumer',
  'SBUX':'Consumer','TGT':'Consumer','WMT':'Consumer','COST':'Consumer','LULU':'Consumer',
  'ABNB':'Consumer','UBER':'Consumer','LYFT':'Consumer','DASH':'Consumer','BKNG':'Consumer',
  // Health
  'UNH':'Health','LLY':'Health','PFE':'Health','MRK':'Health','ABBV':'Health','JNJ':'Health',
  'TMO':'Health','DHR':'Health','BMY':'Health','GILD':'Health','REGN':'Health','VRTX':'Health',
  'MRNA':'Health','BIIB':'Health','SRPT':'Health','AMGN':'Health',
  // Finance
  'JPM':'Finance','BAC':'Finance','WFC':'Finance','GS':'Finance','MS':'Finance','C':'Finance',
  'V':'Finance','MA':'Finance','BLK':'Finance','SCHW':'Finance','AXP':'Finance','COF':'Finance',
  'BRK-B':'Finance','BRK.B':'Finance',
  // Energy
  'XOM':'Energy','CVX':'Energy','COP':'Energy','OXY':'Energy','EOG':'Energy','SLB':'Energy',
  'PSX':'Energy','MPC':'Energy','VLO':'Energy','HAL':'Energy','BKR':'Energy','BTU':'Energy',
  // Industrials
  'CAT':'Industrials','BA':'Industrials','HON':'Industrials','UPS':'Industrials','UNP':'Industrials',
  'GE':'Industrials','DE':'Industrials','MMM':'Industrials','LMT':'Industrials','RTX':'Industrials',
  'NOC':'Industrials','GD':'Industrials','IOT':'Industrials',
  // Materials
  'FCX':'Materials','NEM':'Materials','GOLD':'Materials','MOS':'Materials','CF':'Materials',
  'NUE':'Materials','LIN':'Materials','APD':'Materials','SHW':'Materials',
  // Comms
  'DIS':'Comms','CMCSA':'Comms','T':'Comms','VZ':'Comms','TMUS':'Comms','CHTR':'Comms',
  // Crypto
  'BTC-USD':'Crypto','ETH-USD':'Crypto','SOL-USD':'Crypto','XRP-USD':'Crypto','COIN':'Crypto',
  'MSTR':'Crypto','MARA':'Crypto','RIOT':'Crypto','HUT':'Crypto','CLSK':'Crypto',
  // Broad ETFs
  'SPY':'ETF-Broad','QQQ':'ETF-Broad','DIA':'ETF-Broad','IWM':'ETF-Broad','EFA':'ETF-Broad',
  'EEM':'ETF-Broad','FXI':'ETF-Broad','VTI':'ETF-Broad','VOO':'ETF-Broad',
  'XLF':'ETF-Sector','XLK':'ETF-Sector','XLV':'ETF-Sector','XLE':'ETF-Sector','XLI':'ETF-Sector',
  'XLY':'ETF-Sector','XLP':'ETF-Sector','XLU':'ETF-Sector','XLB':'ETF-Sector','XLRE':'ETF-Sector',
  'XLC':'ETF-Sector','SMH':'ETF-Sector','SOXX':'ETF-Sector','XBI':'ETF-Sector','ITA':'ETF-Sector','ANET':'Tech',
  'GLD':'ETF-Commodity','SLV':'ETF-Commodity','USO':'ETF-Commodity','TLT':'ETF-Bond',
};

function getSector(ticker) {
  if (!ticker) return 'Other';
  return SECTOR_MAP[ticker] || SECTOR_MAP[String(ticker).toUpperCase()] || 'Other';
}

// Sectors excluded by the AAOIFI Sharia screen. Used by per-mode shariaOnly modes (Fortress = PM
// Halal). Defense names live under 'Industrials' in SECTOR_MAP so they're caught by SHARIA_EXCLUDED,
// not this set; this catches mapped Finance/Insurance names even when a signal arrives sharia:null.
const HARAM_SECTORS = new Set(['Finance']);
// Conservative haram check for Halal-mandated modes: reject if explicitly non-compliant, OR a known
// haram ticker (banks/insurance/defense/etc.), OR a mapped haram sector. Untagged 'Other' tickers
// pass (can't determine) — the scanner's own sector tagging is the upstream defense.
function isHaramForHalalMode(s) {
  const tk = (s.ticker || '').toUpperCase();
  if (s.sharia === false) return true;
  if (SHARIA_EXCLUDED.has(tk)) return true;
  if (HARAM_SECTORS.has(getSector(tk))) return true;
  return false;
}

module.exports = { SHARIA_EXCLUDED, HARAM_SECTORS, SECTOR_MAP, getSector, isHaramForHalalMode };
