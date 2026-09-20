const YAHOO_RT_MAX_AGE_MS = 5 * 60 * 1000;
const HYPERLIQUID_RT_MAX_AGE_MS = 45 * 1000;

const HYPERLIQUID_MACRO = {
  'GC=F': 'xyz:GOLD',
  'SI=F': 'xyz:SILVER',
  'BZ=F': 'xyz:BRENTOIL',
  'CL=F': 'xyz:CL',
  'EURUSD=X': 'xyz:EUR',
  '^GSPC': 'xyz:SP500',
  '^VIX': 'xyz:VIX'
};

function newYorkParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function isHyperliquidWindow(date = new Date()) {
  const parts = newYorkParts(date);
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return true;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes < 4 * 60 || minutes >= 20 * 60;
}

export function hyperliquidCoin(asset, yahooSymbol) {
  if (asset.market === 'MACRO') return HYPERLIQUID_MACRO[yahooSymbol] || null;
  if (asset.market !== 'US') return null;
  const ticker = String(asset.ticker || '').trim().toUpperCase();
  return /^[A-Z0-9]+$/.test(ticker) ? `xyz:${ticker}` : null;
}

export function isFresh(quote, maxAgeMs, now = Date.now()) {
  return Number.isFinite(quote?.price) && quote.price > 0 && Number.isFinite(quote?.at) && now >= quote.at && now - quote.at <= maxAgeMs;
}

function percentFrom(reference, price) {
  return Number.isFinite(reference) && reference > 0 && Number.isFinite(price) && price > 0 ? (price / reference - 1) * 100 : null;
}

export function effectiveQuote(asset, now = Date.now(), hyperliquidWindow = isHyperliquidWindow(new Date(now))) {
  const yahooLive = isFresh(asset.yahooRt, YAHOO_RT_MAX_AGE_MS, now);
  const hyperliquidLive = isFresh(asset.hyperliquidRt, HYPERLIQUID_RT_MAX_AGE_MS, now);

  if (hyperliquidWindow && hyperliquidLive) {
    return {
      price: asset.hyperliquidRt.price,
      change: percentFrom(asset.yahooClose?.price, asset.hyperliquidRt.price),
      source: 'hyperliquid', label: 'HL RT', realtime: true, at: asset.hyperliquidRt.at
    };
  }
  if (yahooLive) {
    return {
      price: asset.yahooRt.price,
      change: Number.isFinite(asset.yahooRt.change) ? asset.yahooRt.change : percentFrom(asset.yahooClose?.price, asset.yahooRt.price),
      source: 'yahoo-rt', label: 'Yahoo RT', realtime: true, at: asset.yahooRt.at
    };
  }
  if (Number.isFinite(asset.yahooClose?.price) && asset.yahooClose.price > 0) {
    return {
      price: asset.yahooClose.price,
      change: Number.isFinite(asset.yahooClose.change) ? asset.yahooClose.change : percentFrom(asset.yahooClose.previousClose, asset.yahooClose.price),
      source: 'yahoo-close', label: 'Yahoo close', realtime: false,
      at: asset.yahooClose.at || null, sessionDate: asset.yahooClose.sessionDate || null
    };
  }
  const snapshotPrice = Number.isFinite(asset.tech?.close) ? asset.tech.close : asset.priceNumber;
  const snapshotChange = Number.isFinite(asset.tech?.change) ? asset.tech.change : asset.change;
  return {
    price: snapshotPrice, change: snapshotChange, source: 'snapshot', label: 'Snapshot', realtime: false, at: null
  };
}

export const QUOTE_MAX_AGE = Object.freeze({ yahoo: YAHOO_RT_MAX_AGE_MS, hyperliquid: HYPERLIQUID_RT_MAX_AGE_MS });
