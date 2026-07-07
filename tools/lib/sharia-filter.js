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
  // Commonly-screened thematic / miner / energy / REIT / biotech ETFs — none is Sharia-certified,
  // so bucketing them 'ETF-*' makes the Halal gate reject them (constituents unscreenable).
  'GDX':'ETF-Sector','GDXJ':'ETF-Sector','SIL':'ETF-Sector','SILJ':'ETF-Sector','XME':'ETF-Sector',
  'SLX':'ETF-Sector','COPX':'ETF-Sector','URA':'ETF-Sector','URNM':'ETF-Sector','LIT':'ETF-Sector',
  'REMX':'ETF-Sector','TAN':'ETF-Sector','ICLN':'ETF-Sector','XOP':'ETF-Sector','OIH':'ETF-Sector',
  'IBB':'ETF-Sector','KRE':'ETF-Sector','KBE':'ETF-Sector','IYR':'ETF-Sector','VNQ':'ETF-Sector',
  'SCHH':'ETF-Sector','JETS':'ETF-Sector','KWEB':'ETF-Broad','ARKK':'ETF-Sector','ARKG':'ETF-Sector',
  'ARKW':'ETF-Sector','ARKF':'ETF-Sector','BOTZ':'ETF-Sector','ROBO':'ETF-Sector','HACK':'ETF-Sector',
  'SKYY':'ETF-Sector','SLV.':'ETF-Commodity','UNG':'ETF-Commodity','DBA':'ETF-Commodity',
  'DBC':'ETF-Commodity','IAU':'ETF-Commodity','SGOL':'ETF-Commodity','PPLT':'ETF-Commodity',
  'SCHD':'ETF-Broad','VIG':'ETF-Broad','DVY':'ETF-Broad','VYM':'ETF-Broad','HDV':'ETF-Broad',
  'VT':'ETF-Broad','ACWI':'ETF-Broad','IEFA':'ETF-Broad','IEMG':'ETF-Broad','ITOT':'ETF-Broad',
  'VXX':'ETF-Leveraged','VIXY':'ETF-Leveraged','KWEB.':'ETF-Broad',
};

// Lazy-loaded per-ticker sector/industry metadata (data/ticker-metadata.json).
// Used ONLY as a fallback for tickers absent from the embedded SECTOR_MAP above —
// notably non-US banks/insurers (e.g. IBN=ICICI Bank, sector "Financials") whose
// sector we don't hardcode. Loaded once; tolerant of a missing/unreadable file.
const path = require('path');
let _tickerMeta;
function loadTickerMeta() {
  if (_tickerMeta !== undefined) return _tickerMeta;
  try {
    _tickerMeta = require(path.join(__dirname, '..', '..', 'data', 'ticker-metadata.json'));
  } catch (e) {
    _tickerMeta = {};
  }
  return _tickerMeta;
}

// Map a free-text sector/industry label (from ticker-metadata.json OR an incoming
// signal object) to an internal SECTOR_MAP bucket. Banking / insurance / financial-
// services labels → 'Finance' (haram: interest-based revenue / riba per AAOIFI).
// Returns null when the label is not a recognised haram-sector label.
// Covers: "Financials", "Financial Services", "Banks", "Bank", "Diversified
// Financials", "Insurance" — plus their metadata industry variants
// ("Banks - Regional", "Banks - Diversified", "Insurance - Life", ...).
// Deliberately does NOT match "Credit Services" (V/MA payment networks) here — those
// are already bucketed 'Finance' explicitly in SECTOR_MAP; keeping the keyword list
// narrow avoids over-broad false positives on non-financial industries.
function labelToSector(sector, industry) {
  const hay = `${sector || ''} ${industry || ''}`.toLowerCase();
  if (/\bbank\b|\bbanks\b|insurance|financial services|diversified financ|^financials?$|\bfinancials\b/.test(hay)
      || (sector || '').trim().toLowerCase() === 'financials') {
    return 'Finance';
  }
  return null;
}

function getSector(ticker) {
  if (!ticker) return 'Other';
  const tk = String(ticker).toUpperCase();
  const direct = SECTOR_MAP[ticker] || SECTOR_MAP[tk];
  if (direct) return direct;
  // Fallback: derive from ticker-metadata.json for tickers not in the embedded map
  // (e.g. IBN=ICICI Bank → sector "Financials" → 'Finance'/haram).
  const meta = loadTickerMeta()[tk] || loadTickerMeta()[ticker];
  if (meta) {
    const mapped = labelToSector(meta.sector, meta.industry);
    if (mapped) return mapped;
  }
  return 'Other';
}

// Sectors excluded by the AAOIFI Sharia screen. Used by per-mode shariaOnly modes (Fortress = PM
// Halal). Defense names live under 'Industrials' in SECTOR_MAP so they're caught by SHARIA_EXCLUDED,
// not this set; this catches mapped Finance/Insurance names even when a signal arrives sharia:null.
const HARAM_SECTORS = new Set(['Finance']);

// Certified Sharia-screened ETFs — the ONLY ETFs allowed to enter a shariaOnly mode. A plain ETF
// pools constituents we cannot screen per-issuer (XLP holds tobacco PM/MO, SPY/QQQ hold banks,
// USO/GLD are commodity/futures wrappers), so every non-certified fund is treated as haram below.
const SHARIA_COMPLIANT_ETFS = new Set([
  'SPUS', 'SPWO', 'SPRE', 'SPTE', 'SPSK', // SP Funds (S&P 500 Sharia / World / REIT / Tech / Sukuk)
  'HLAL', 'UMMA',                         // Wahed (FTSE USA Shariah / Dow Jones Islamic World)
  'ISDW', 'ISWD', 'ISDE', 'ISUS',         // iShares MSCI Islamic
  'WSHR',                                 // Wealthsimple Shariah World Equity
]);

// Is this ticker an ETF? Detected via the embedded SECTOR_MAP 'ETF-*' tags (SPY/XLP/SMH/GLD/USO/…)
// and, as a fallback, an asset-type field the signal/trade may carry (scanner enrichment). Physical
// tickers never resolve to an 'ETF-' bucket, so this stays tight.
function isEtf(ticker, s) {
  const sec = getSector(ticker);
  if (typeof sec === 'string' && sec.indexOf('ETF-') === 0) return true;
  if (s) {
    const at = String(s.assetType || s.asset_type || s.asset || s.quoteType || '').toLowerCase();
    if (at === 'etf' || at === 'fund') return true;
  }
  return false;
}

// Conservative haram check for Halal-mandated modes: reject if explicitly non-compliant, OR a known
// haram ticker (banks/insurance/defense/etc.), OR a mapped haram sector, OR a non-certified ETF.
// Untagged 'Other' single stocks pass (can't determine) — the scanner's own sector tagging is the
// upstream defense.
function isHaramForHalalMode(s) {
  const tk = (s.ticker || '').toUpperCase();
  if (s.sharia === false) return true;
  if (SHARIA_EXCLUDED.has(tk)) return true;
  if (HARAM_SECTORS.has(getSector(tk))) return true;
  // Signal may carry its own sector/industry label (from screener/enrichment) even
  // when the ticker isn't in SECTOR_MAP or ticker-metadata — map it too (banks/insurers).
  if (HARAM_SECTORS.has(labelToSector(s.sector, s.industry))) return true;
  // Non-certified ETFs are haram: their constituents can't be screened (XLP=tobacco, SPY=banks, …).
  if (isEtf(tk, s) && !SHARIA_COMPLIANT_ETFS.has(tk)) return true;
  return false;
}

module.exports = { SHARIA_EXCLUDED, HARAM_SECTORS, SECTOR_MAP, SHARIA_COMPLIANT_ETFS, getSector, isEtf, isHaramForHalalMode };
