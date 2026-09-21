const YAHOO_RT_MAX_AGE_MS = 90 * 1000;
const HYPERLIQUID_RT_MAX_AGE_MS = 45 * 1000;

export function yahooSubscriptionBatches(symbols) {
  const batches = [];
  for (let index = 0; index < symbols.length; index += 100) batches.push(symbols.slice(index, index + 100));
  return batches;
}

// Yahoo's PricingData.time is a protobuf sint64 in milliseconds, not seconds.
export function decodeYahooFrame(base64) {
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const cursor = { offset:0 }, quote = {};
  const varint = () => {
    let value = 0n, shift = 0n;
    while (cursor.offset < bytes.length && shift <= 63n) {
      const byte = bytes[cursor.offset++];
      value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) return value;
      shift += 7n;
    }
    throw new Error('Truncated Yahoo protobuf varint');
  };
  while (cursor.offset < bytes.length) {
    const key = Number(varint()), field = key >> 3, wire = key & 7;
    if (wire === 2) {
      const length = Number(varint()), end = cursor.offset + length;
      if (!Number.isSafeInteger(length) || end > bytes.length) throw new Error('Truncated Yahoo protobuf field');
      if (field === 1) quote.id = new TextDecoder().decode(bytes.subarray(cursor.offset, end));
      cursor.offset = end;
    } else if (wire === 5) {
      if (cursor.offset + 4 > bytes.length) throw new Error('Truncated Yahoo protobuf float');
      const value = new DataView(bytes.buffer, bytes.byteOffset + cursor.offset, 4).getFloat32(0, true);
      cursor.offset += 4;
      if (field === 2) quote.price = value;
      else if (field === 8) quote.changePercent = value;
    } else if (wire === 0) {
      const value = varint();
      if (field === 3) quote.time = Number((value >> 1n) ^ (-(value & 1n)));
      else if (field === 6) quote.quoteType = Number(value);
    } else if (wire === 1) {
      if (cursor.offset + 8 > bytes.length) throw new Error('Truncated Yahoo protobuf double');
      cursor.offset += 8;
    } else throw new Error('Unsupported Yahoo protobuf field');
  }
  return quote;
}

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
