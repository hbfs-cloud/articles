import { decodeYahooFrame, effectiveQuote, hyperliquidCoin, isFresh, isHyperliquidWindow, QUOTE_MAX_AGE, yahooSubscriptionBatches } from './quote-routing.js?v=6';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const STORAGE = { tags: 'marketscope:tags', alerts: 'marketscope:alerts', firebase: 'marketscope:firebase', tagFilters: 'marketscope:tag-filters', sort: 'marketscope:sort', columns: 'marketscope:columns' };
const EXCLUDED_LISTS = new Set(['Les meilleurs mouvements', 'Plus empruntées']);
const COLUMN_DEFS = [
  { key:'instrument', label:'Instrument', locked:true },
  { key:'tags', label:'Tags' },
  { key:'market', label:'Marché' },
  { key:'setup', label:'Tendance' },
  { key:'price', label:'Prix' },
  { key:'change', label:'Variation 24 h' },
  { key:'perfWeek', label:'Variation 1 semaine' },
  { key:'perfMonth', label:'Variation 1 mois' },
  { key:'perf3Month', label:'Variation 3 mois' },
  { key:'alerts', label:'Alertes' }
];
const DEFAULT_COLUMNS = COLUMN_DEFS.map(column => column.key);
const storedTagState = storedTagFilter();
const state = {
  tagGroups: [], assets: [], filtered: [], tags: read(STORAGE.tags, {}), alerts: read(STORAGE.alerts, []),
  selectedTags: new Set(storedTagState.tags), sort: storedSort(),
  visibleColumns: storedColumns(), selected: null, firebase: null, firebaseApi: null, remoteTimer: null, analysisLoading: false,
  streamEnabled: true, streams: { yahoo:new Map(), hyperliquid:null },
  streamStatus: { yahoo:'idle', hyperliquid:'idle' }, reconnectTimers: { yahoo:null, hyperliquid:null },
  yahooAssets: new Map(), hyperliquidAssets: new Map(), yahooCloseCount: 0, quoteRenderPending: false
};
const SORT_LABELS = { change:'variation 24 h', perfWeek:'variation 1 semaine', perfMonth:'variation 1 mois', perf3Month:'variation 3 mois', price:'prix', ticker:'ticker', name:'nom', tags:'nombre de tags', market:'marché', setup:'tendance', relvol:'volume relatif', rsi:'RSI', ma200:'écart MA200' };

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function storedTagFilter() {
  const value = read(STORAGE.tagFilters, []);
  if (Array.isArray(value)) return { tags:value };
  return value && typeof value === 'object' ? { tags:Array.isArray(value.tags) ? value.tags : [] } : { tags:[] };
}
function storedSort() {
  const value = read(STORAGE.sort, {});
  const key = value?.key === 'lists' ? 'tags' : value?.key;
  return value && typeof value === 'object' ? { key:key || 'change', dir:value.dir === 'asc' ? 'asc' : 'desc' } : { key:'change', dir:'desc' };
}
function storedColumns() {
  const allowed = new Set(DEFAULT_COLUMNS), value = read(STORAGE.columns, DEFAULT_COLUMNS);
  const columns = Array.isArray(value) ? value.map(key => key === 'lists' ? 'tags' : key).filter(key => allowed.has(key)) : DEFAULT_COLUMNS;
  return new Set(['instrument', ...columns]);
}
function assetTags(asset) {
  return [...new Set([...(asset.sourceTags || []), ...(state.tags[asset.id] || [])])];
}
function marketFor(id, ticker, name) {
  const symbolId = String(id || '').toUpperCase(), symbol = String(ticker || '').toUpperCase();
  const text = `${symbolId} ${symbol} ${name}`.toUpperCase();
  if (/_US_/.test(symbolId)) return 'US';
  if (/_JP_|_HK_|_AU_|_SG_|6857/.test(symbolId)) return 'APAC';
  if (/^#|XAU|XAG|EURUSD/.test(symbolId) || /^(USA500|CRUDE)$/.test(symbol)) return 'MACRO';
  if (symbolId.includes('_CRYPTO') || /^(BTC|ETH|SOL|XRP)(?:[/-](?:USD|EUR))?$/.test(symbol)) return 'CRYPTO';
  return 'EU';
}
function numberFrom(text) {
  if (typeof text === 'number') return text;
  const cleaned = String(text).replace(/\s/g, '').replace(',', '.').replace(/[−–]/g, '-').replace(/[^0-9.+-]/g, '');
  return Number.parseFloat(cleaned) || 0;
}
function yahooSymbol(asset) {
  const id = asset.id.toUpperCase();
  const ticker = String(asset.ticker || '').toUpperCase();
  if (asset.market === 'CRYPTO') {
    const base = ticker.match(/^(BTC|ETH|SOL|XRP)/)?.[1] || id.match(/^(BTC|ETH|SOL|XRP)/)?.[1];
    if (base) return `${base}-USD`;
  }
  if (asset.market === 'MACRO') {
    if (/XAU|GOLD/.test(`${id} ${ticker}`)) return 'GC=F';
    if (/XAG|SILVER/.test(`${id} ${ticker}`)) return 'SI=F';
    if (/BRENT/.test(`${id} ${ticker}`)) return 'BZ=F';
    if (/CRUDE|OIL/.test(`${id} ${ticker}`)) return 'CL=F';
    if (/EURUSD|EURO \/ US DOLLAR/.test(`${id} ${ticker}`)) return 'EURUSD=X';
    if (/USA500|SPX/.test(`${id} ${ticker}`)) return '^GSPC';
    if (/VIX|VOLX/.test(`${id} ${ticker}`)) return '^VIX';
  }
  if (asset.market === 'US') return asset.ticker.replace(/\./g, '-');
  if (/_JP_/.test(id) || /^\d{4}$/.test(asset.ticker)) return `${asset.ticker}.T`;
  if (/_CA_/.test(id)) return `${asset.ticker}.TO`;
  if (/_FR_|P_EQ$/.test(id)) return `${asset.ticker}.PA`;
  if (/_DE_|D_EQ$/.test(id)) return `${asset.ticker}.DE`;
  if (/_GB_|L_EQ$/.test(id)) return `${asset.ticker}.L`;
  if (/_NL_/.test(id)) return `${asset.ticker}.AS`;
  if (/_IT_|M_EQ$/.test(id)) return `${asset.ticker}.MI`;
  return asset.ticker;
}
function logoSources(asset) {
  const symbol = yahooSymbol(asset), sources = [];
  if (asset.logoId) sources.push(`https://s3-symbol-logo.tradingview.com/${encodeURIComponent(asset.logoId)}--big.svg`);
  sources.push(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png`);
  sources.push(`https://img.anylogo.dev/ticker/${encodeURIComponent(symbol)}?size=64&variant=icon`);
  return sources;
}
function logoMarkup(asset) {
  const [source, ...fallbacks] = logoSources(asset);
  const initials = asset.ticker.replace(/[^a-z0-9]/gi,'').slice(0,3) || '•';
  return `<span class="logo-wrap"><span class="avatar">${esc(initials)}</span><img class="asset-logo" src="${esc(source)}" data-logo-fallbacks="${esc(JSON.stringify(fallbacks))}" alt="Logo ${esc(asset.name)}" loading="lazy"></span>`;
}
function tradingViewCandidates(asset) {
  const id = asset.id.toUpperCase(), ticker = asset.ticker.toUpperCase().replace('/', '');
  if (/_US_/.test(id) || asset.market === 'US') return [`NASDAQ:${ticker}`,`NYSE:${ticker}`,`AMEX:${ticker}`];
  if (/P_EQ$/.test(id) || /_FR_/.test(id)) return [`EURONEXT:${ticker}`];
  if (/D_EQ$/.test(id)) return [`XETR:${ticker}`,`FWB:${ticker}`];
  if (/L_EQ$/.test(id)) return [`LSE:${ticker}`,`LSE:${ticker}.`];
  if (/M_EQ$/.test(id)) return [`MIL:${ticker}`];
  if (/A_EQ$/.test(id)) return [`EURONEXT:${ticker}`];
  if (/S_EQ$/.test(id)) return [`SIX:${ticker}`];
  if (/_CA_/.test(id)) return [`TSX:${ticker}`];
  if (/_JP_/.test(id) || asset.market === 'APAC') return [`TSE:${ticker}`];
  if (asset.market === 'CRYPTO') { const base = ticker.replace(/EUR|USD|USDT/g,''); return [`BINANCE:${base}USDT`,`COINBASE:${base}USD`]; }
  if (/XAU|GOLD/.test(id)) return ['COMEX:GC1!','TVC:GOLD'];
  if (/XAG|SILVER/.test(id)) return ['COMEX:SI1!','TVC:SILVER'];
  if (/CRUDE|OIL|#QM/.test(id)) return ['NYMEX:CL1!','NYMEX:QM1!'];
  if (/EURUSD/.test(id)) return ['FX:EURUSD','OANDA:EURUSD'];
  if (/USA500|#ES/.test(id)) return ['SP:SPX','CME_MINI:ES1!'];
  if (/VIX/.test(id)) return ['CBOE:VIX'];
  return [];
}
function setupFor(asset) {
  const t = asset.tech; if (!t) return '';
  const above = t.close > t.ma20 && t.ma20 > t.ma50 && t.ma50 > t.ma200;
  if (t.close >= t.high3m * .985 && t.relVolume >= 1.2 && t.rsi >= 50) return 'breakout';
  if (t.close > t.ma200 && (Math.abs(t.close - t.ma20) / t.ma20 < .03 || Math.abs(t.close - t.ma50) / t.ma50 < .03) && t.rsi >= 38 && t.rsi <= 62) return 'pullback';
  if (above && t.macd > t.macdSignal && t.rsi >= 55 && t.recommend > .2) return 'momentum';
  return t.close > t.ma200 ? 'haussier' : t.close < t.ma200 ? 'baissier' : 'neutre';
}
function matchesSignal(asset, signal) {
  const t = asset.tech; if (!signal) return true; if (!t) return false;
  if (signal === 'analyzed') return true;
  if (signal === 'above200') return t.close > t.ma200;
  if (signal === 'relvol') return t.relVolume > 1.5;
  if (signal === 'oversold') return t.rsi < 30;
  return setupFor(asset) === signal;
}
async function loadTechnicals() {
  if (state.analysisLoading) return; state.analysisLoading = true;
  const button = $('#analyzeBtn'); button.disabled = true; button.textContent = '⌁ Analyse en cours…'; $('#analysisState').textContent = 'mise à jour…';
  try {
    const candidateMap = new Map(), tickers = [];
    for (const asset of state.assets) for (const candidate of tradingViewCandidates(asset)) if (!candidateMap.has(candidate)) { candidateMap.set(candidate, asset); tickers.push(candidate); }
    const columns = ['name','close','change','volume','relative_volume_10d_calc','RSI','MACD.macd','MACD.signal','SMA20','SMA50','SMA100','SMA200','Recommend.All','ATR','High.1M','High.3M','High.6M','VWAP','Perf.W','Perf.1M','Perf.3M','logoid','market_cap_basic','price_earnings_ttm','earnings_per_share_diluted_ttm','dividends_yield_current','total_revenue','revenue_growth_ttm_yoy','debt_to_equity','beta_1_year','sector','industry'];
    const response = await fetch('https://scanner.tradingview.com/global/scan', { method:'POST', body:JSON.stringify({symbols:{tickers,query:{types:[]}},columns,range:[0,tickers.length]}) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    for (const row of payload.data || []) {
      const asset = candidateMap.get(row.s); if (!asset) continue; const d = row.d;
      asset.tvSymbol = row.s; asset.logoId = d[21]; asset.tech = { close:d[1], change:d[2], volume:d[3], relVolume:d[4], rsi:d[5], macd:d[6], macdSignal:d[7], ma20:d[8], ma50:d[9], ma100:d[10], ma200:d[11], recommend:d[12], atr:d[13], high1m:d[14], high3m:d[15], high6m:d[16], vwap:d[17], perfWeek:d[18], perfMonth:d[19], perf3Month:d[20], obvDelta:(d[2] > 0 ? 1 : d[2] < 0 ? -1 : 0) * (d[3] || 0) };
      asset.fundamentals = { marketCap:d[22], pe:d[23], eps:d[24], dividendYield:d[25], revenue:d[26], revenueGrowth:d[27], debtToEquity:d[28], beta:d[29], sector:d[30], industry:d[31] };
    }
    const count = state.assets.filter(a => a.tech).length; $('#analysisState').textContent = `${count}/${state.assets.length} couverts`; toast(`${count} instruments analysés en données réelles`);
  } catch (error) { $('#analysisState').textContent = 'source indisponible'; toast(`Analyse technique indisponible : ${error.message}`); }
  finally { state.analysisLoading = false; button.disabled = false; button.textContent = '⌁ Actualiser l’analyse'; applyFilters(); if (state.selected) renderDetail(state.selected); }
}
function hash(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function seededSeries(key, length = 24) {
  let seed = hash(key), value = 50, out = [];
  for (let i = 0; i < length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; value = Math.max(5, value + ((seed / 4294967296) - .48) * 7); out.push(value); }
  return out;
}
function pathFor(values, width, height, pad = 3) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return values.map((v, i) => `${i ? 'L' : 'M'}${(pad + i * (width - pad * 2) / Math.max(1, values.length - 1)).toFixed(1)},${(height - pad - (v - min) * (height - pad * 2) / span).toFixed(1)}`).join(' ');
}
function spark(asset) {
  const values = seededSeries(asset.id, 18), negative = asset.change < 0;
  return `<svg class="spark ${negative ? 'negative' : ''}" viewBox="0 0 92 28" aria-hidden="true"><path d="${pathFor(values, 92, 28)}"/></svg>`;
}
function saveLocal() {
  localStorage.setItem(STORAGE.tags, JSON.stringify(state.tags));
  localStorage.setItem(STORAGE.alerts, JSON.stringify(state.alerts));
  updateCounts();
  scheduleRemoteSave();
}
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
}
function activeAlerts() {
  const now = Date.now();
  const current = state.alerts.filter(a => a.expiresAt > now);
  if (current.length !== state.alerts.length) { state.alerts = current; saveLocal(); }
  return current;
}
function updateCounts() {
  $('#visibleCount').textContent = state.filtered.length;
  $('#resultCount').textContent = `${state.filtered.length} instrument${state.filtered.length > 1 ? 's' : ''}`;
  $('#positiveCount').textContent = state.filtered.filter(asset => effectiveQuote(asset).change > 0).length;
  $('#analyzedCount').textContent = state.assets.filter(a => a.tech).length;
  $('#alertCount').textContent = activeAlerts().length;
}
function availableTags() {
  const counts = new Map();
  state.assets.forEach(asset => assetTags(asset).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a,b) => a[0].localeCompare(b[0], 'fr'));
}
function saveUiState() {
  localStorage.setItem(STORAGE.tagFilters, JSON.stringify({ tags:[...state.selectedTags] }));
  localStorage.setItem(STORAGE.sort, JSON.stringify(state.sort));
  localStorage.setItem(STORAGE.columns, JSON.stringify([...state.visibleColumns]));
  scheduleRemoteSave();
}
function renderTagFilter() {
  const tags = availableTags(), available = new Set(tags.map(([tag]) => tag));
  state.selectedTags.forEach(tag => { if (!available.has(tag)) state.selectedTags.delete(tag); });
  $('#tagChoices').innerHTML = tags.length ? tags.map(([tag,count]) => `<label class="tag-choice"><input type="checkbox" data-filter-tag="${esc(tag)}" ${state.selectedTags.has(tag) ? 'checked' : ''}><span><b>#${esc(tag)}</b><small>${count} instrument${count > 1 ? 's' : ''}</small></span></label>`).join('') : '<p class="tag-empty">Aucun tag pour le moment.</p>';
  const filterCount = state.selectedTags.size, badge = $('#tagFilterCount');
  badge.textContent = filterCount; badge.hidden = filterCount === 0;
  const active = $('#activeTagFilters'), chips = [];
  state.selectedTags.forEach(tag => chips.push(`<button type="button" data-remove-tag="${esc(tag)}">#${esc(tag)} <span>×</span></button>`));
  if (chips.length) chips.push('<button type="button" class="clear-active" data-clear-tags>Effacer les filtres tags</button>');
  active.innerHTML = chips.join(''); active.hidden = chips.length === 0;
  saveUiState();
}
function renderColumnPicker() {
  $('#columnChoices').innerHTML = COLUMN_DEFS.map(column => `<label class="column-choice ${column.locked ? 'locked' : ''}"><input type="checkbox" data-column-toggle="${column.key}" ${state.visibleColumns.has(column.key) ? 'checked' : ''} ${column.locked ? 'disabled' : ''}><span>${column.label}</span>${column.locked ? '<small>Toujours visible</small>' : ''}</label>`).join('');
  updateColumnPicker();
}
function updateColumnPicker() {
  const count = COLUMN_DEFS.filter(column => state.visibleColumns.has(column.key)).length;
  $('#columnCount').textContent = count;
  document.querySelectorAll('[data-column-toggle]').forEach(input => { input.checked = state.visibleColumns.has(input.dataset.columnToggle); });
  saveUiState();
}
function applyColumnVisibility() {
  document.querySelectorAll('[data-column]').forEach(cell => { cell.hidden = !state.visibleColumns.has(cell.dataset.column); });
  updateColumnPicker();
}
function sortValue(asset, key) {
  if (key === 'ticker') return asset.ticker;
  if (key === 'name') return asset.name;
  if (key === 'tags') return assetTags(asset).length;
  if (key === 'market') return asset.market;
  if (key === 'setup') return setupFor(asset) || '';
  if (key === 'price') return effectiveQuote(asset).price;
  if (key === 'change') return effectiveQuote(asset).change;
  if (key === 'perfWeek') return asset.tech?.perfWeek;
  if (key === 'perfMonth') return asset.tech?.perfMonth;
  if (key === 'perf3Month') return asset.tech?.perf3Month;
  if (key === 'relvol') return asset.tech?.relVolume;
  if (key === 'rsi') return asset.tech?.rsi;
  if (key === 'ma200') return asset.tech?.ma200 ? (asset.tech.close - asset.tech.ma200) / asset.tech.ma200 : null;
  return effectiveQuote(asset).change;
}
function compareAssets(a, b) {
  const av = sortValue(a, state.sort.key), bv = sortValue(b, state.sort.key), missingA = av == null || (typeof av === 'number' && !Number.isFinite(av)), missingB = bv == null || (typeof bv === 'number' && !Number.isFinite(bv));
  if (missingA !== missingB) return missingA ? 1 : -1;
  const base = typeof av === 'string' ? av.localeCompare(bv, 'fr', { sensitivity:'base' }) : (av - bv);
  return (state.sort.dir === 'asc' ? base : -base) || a.ticker.localeCompare(b.ticker, 'fr');
}
function updateSortUi() {
  const key = SORT_LABELS[state.sort.key] ? state.sort.key : 'change', dir = state.sort.dir === 'asc' ? 'asc' : 'desc';
  state.sort = { key, dir };
  document.querySelectorAll('[data-sort-column]').forEach(th => {
    const active = th.dataset.sortColumn === key; th.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
    const arrow = $('span', th); if (arrow) arrow.textContent = active ? (dir === 'asc' ? '↑' : '↓') : '↕';
  });
  $('#sortKey').value = key; $('#sortDirection').textContent = dir === 'asc' ? '↑' : '↓';
  $('#sortDirection').setAttribute('aria-label', `Tri ${dir === 'asc' ? 'croissant' : 'décroissant'} — inverser`);
  $('#sortStatus').textContent = `Triés par ${SORT_LABELS[key]}, ${dir === 'asc' ? 'croissant' : 'décroissant'}`;
  saveUiState();
}
function setSort(key, direction) {
  const defaultDirection = ['ticker','name','market','setup'].includes(key) ? 'asc' : 'desc';
  state.sort = { key, dir: direction || (state.sort.key === key ? (state.sort.dir === 'asc' ? 'desc' : 'asc') : defaultDirection) };
  applyFilters();
}
function applyFilters() {
  const q = $('#search').value.trim().toLowerCase(), market = $('#marketFilter').value, signal = $('#signalFilter').value;
  state.filtered = state.assets.filter(asset => {
    const tags = assetTags(asset);
    const haystack = `${asset.ticker} ${asset.name} ${tags.join(' ')}`.toLowerCase();
    const selectedTagMatch = !state.selectedTags.size || tags.some(tag => state.selectedTags.has(tag));
    return (!q || haystack.includes(q)) && (!market || asset.market === market) && matchesSignal(asset, signal) && selectedTagMatch;
  });
  state.filtered.sort(compareAssets);
  renderRows(); updateCounts(); updateSortUi();
}
function performanceCell(key, label, value) {
  const available = Number.isFinite(value), sign = available && value > 0 ? '+' : '', negative = available && value < 0;
  return `<td data-column="${key}" data-label="${label}" class="num performance ${negative ? 'negative' : available ? 'positive' : 'unavailable'}">${available ? `${sign}${value.toLocaleString('fr-FR',{maximumFractionDigits:2})} %` : '—'}</td>`;
}
function quoteSourceText(quote) {
  if (quote.source === 'hyperliquid') return 'Cours temps réel du perpétuel Hyperliquid xyz';
  if (quote.source === 'yahoo-rt') return 'Cours temps réel Yahoo';
  if (quote.source === 'yahoo-close') return `Clôture Yahoo${quote.sessionDate ? ` du ${new Date(`${quote.sessionDate}T12:00:00Z`).toLocaleDateString('fr-FR')}` : ''}`;
  return 'Instantané local — aucun cours temps réel ni close Yahoo disponible';
}
function quoteBadge(quote, detailed = false) {
  const stale = quote.realtime ? '' : '<span aria-hidden="true">⏳</span>';
  const label = quote.source === 'hyperliquid' && detailed ? 'HL RT · perp' : quote.label;
  return `<span class="quote-source ${esc(quote.source)}" title="${esc(quoteSourceText(quote))}">${stale}<span>${esc(label)}</span></span>`;
}
function quoteTimeText(quote) {
  if (quote.realtime && Number.isFinite(quote.at)) return `Mis à jour à ${new Date(quote.at).toLocaleTimeString('fr-FR')}`;
  return quoteSourceText(quote);
}
function updateDetailQuote(asset) {
  const quote = effectiveQuote(asset), price = quote.price, change = quote.change;
  const value = $('#detailQuote'), meta = $('#detailQuoteMeta'), changeValue = $('#detailQuoteChange');
  if (value) value.textContent = Number.isFinite(price) ? price.toLocaleString('fr-FR',{maximumFractionDigits:4}) : asset.price;
  if (meta) meta.innerHTML = `${quoteBadge(quote, true)}<span>${esc(quoteTimeText(quote))}</span>`;
  if (changeValue) {
    changeValue.textContent = `${change > 0 ? '+' : ''}${formatMetric(change,2)} %`;
    changeValue.classList.toggle('negative', change < 0);
  }
  const metricValue = $('[data-detail-quote-change] b'), metricLabel = $('[data-detail-quote-change] small');
  if (metricValue) metricValue.textContent = `${formatMetric(change,2)}%`;
  if (metricLabel) metricLabel.textContent = quote.source === 'hyperliquid' ? 'Variation vs close' : 'Variation 24 h';
}
function renderRows() {
  const alerts = activeAlerts();
  $('#rows').innerHTML = state.filtered.map(asset => {
    const tags = assetTags(asset), quote = effectiveQuote(asset), price = quote.price, change = quote.change, setup = setupFor(asset);
    const pills = tags.slice(0, 3).map(tag => `<button type="button" class="pill tag tag-row" data-row-tag="${esc(tag)}" aria-label="Afficher le tag ${esc(tag)}">#${esc(tag)}</button>`);
    if (tags.length > 3) pills.push(`<span class="pill tag-more">+${tags.length - 3}</span>`);
    const changeLabel = quote.source === 'hyperliquid' ? 'vs close' : '24 h';
    return `<tr data-id="${esc(asset.id)}" tabindex="0"><td data-column="instrument"><div class="asset">${logoMarkup(asset)}<span><b>${esc(asset.ticker)}</b><small>${esc(asset.name)}</small></span></div></td><td data-column="tags"><div class="pills">${pills.join('')}</div></td><td data-column="market"><span class="market">${asset.market}</span></td><td data-column="setup"><div class="signal-stack">${spark({...asset,change})}<span class="signal-badge ${esc(setup)}">${esc(setup || 'analyse…')}</span></div></td><td data-column="price" class="num quote-cell"><div class="price-stack"><span>${Number.isFinite(price) ? price.toLocaleString('fr-FR',{maximumFractionDigits:4}) : esc(asset.price)}</span>${quoteBadge(quote)}</div></td>${performanceCell('change',changeLabel,change)}${performanceCell('perfWeek','1 sem.',asset.tech?.perfWeek)}${performanceCell('perfMonth','1 mois',asset.tech?.perfMonth)}${performanceCell('perf3Month','3 mois',asset.tech?.perf3Month)}<td data-column="alerts"><button class="bell ${alerts.some(a => a.instrumentId === asset.id) ? 'active' : ''}" aria-label="Alertes ${esc(asset.ticker)}">♢</button></td></tr>`;
  }).join('');
  document.querySelectorAll('.asset-logo').forEach(image => image.addEventListener('error', () => {
    const fallbacks = JSON.parse(image.dataset.logoFallbacks || '[]'), next = fallbacks.shift();
    if (next) { image.dataset.logoFallbacks = JSON.stringify(fallbacks); image.src = next; } else image.remove();
  }));
  $('#empty').hidden = state.filtered.length > 0;
  applyColumnVisibility();
}
function refreshQuoteCells() {
  const rows = new Map([...$('#rows').querySelectorAll('tr[data-id]')].map(row => [row.dataset.id, row]));
  if (rows.size !== state.filtered.length) { applyFilters(); return; }
  for (const asset of state.filtered) {
    const row = rows.get(asset.id); if (!row) continue;
    const quote = effectiveQuote(asset), change = quote.change;
    const price = row.querySelector('.price-stack > span:first-child');
    if (price) price.textContent = Number.isFinite(quote.price) ? quote.price.toLocaleString('fr-FR',{maximumFractionDigits:4}) : asset.price;
    const badge = row.querySelector('.quote-source');
    if (badge && !badge.classList.contains(quote.source)) badge.outerHTML = quoteBadge(quote);
    const changeCell = row.querySelector('[data-column="change"]');
    if (changeCell) {
      changeCell.textContent = Number.isFinite(change) ? `${change > 0 ? '+' : ''}${change.toLocaleString('fr-FR',{maximumFractionDigits:2})} %` : '—';
      changeCell.classList.toggle('negative', change < 0);
      changeCell.classList.toggle('positive', Number.isFinite(change) && change >= 0);
      changeCell.classList.toggle('unavailable', !Number.isFinite(change));
      changeCell.dataset.label = quote.source === 'hyperliquid' ? 'vs close' : '24 h';
    }
    row.querySelector('.spark')?.classList.toggle('negative', change < 0);
  }
  if (state.sort.key === 'price' || state.sort.key === 'change') {
    state.filtered.sort(compareAssets);
    $('#rows').append(...state.filtered.map(asset => rows.get(asset.id)).filter(Boolean));
  }
  updateCounts();
}
function chartSvg(values) {
  const d = pathFor(values, 500, 190, 12), area = `${d} L488,190 L12,190 Z`;
  return `<svg class="detail-chart" viewBox="0 0 500 190" preserveAspectRatio="none" role="img" aria-label="Historique de prix"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#50b4ee" stop-opacity=".25"/><stop offset="1" stop-color="#50b4ee" stop-opacity="0"/></linearGradient></defs><path class="area" d="${area}"/><path class="line" d="${d}"/></svg>`;
}
function formatMetric(value, digits = 2) { return Number.isFinite(value) ? value.toLocaleString('fr-FR',{maximumFractionDigits:digits}) : '—'; }
function formatCompact(value) { return Number.isFinite(value) ? new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1,signDisplay:'exceptZero'}).format(value) : '—'; }
function compactValue(value) { return Number.isFinite(value) ? new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(value) : '—'; }
function webullUrl(asset) {
  const exchange = (asset.tvSymbol || '').split(':')[0].toLowerCase();
  return ['nasdaq','nyse','amex'].includes(exchange) ? `https://www.webull.com/quote/${exchange}-${encodeURIComponent(asset.ticker.toLowerCase())}` : `https://www.webull.com/search/${encodeURIComponent(yahooSymbol(asset))}`;
}
function secUrl(asset, type = '') {
  const params = new URLSearchParams({ action:'getcompany', CIK:asset.ticker, owner:'exclude' });
  if (type) params.set('type', type);
  return `https://www.sec.gov/edgar/browse/?${params}`;
}
function fundamentalCards(asset) {
  const f = asset.fundamentals || {};
  const card = (label, value, suffix = '') => `<div class="fundamental-card"><small>${label}</small><b>${value}${value !== '—' ? suffix : ''}</b></div>`;
  return `${card('Capitalisation',compactValue(f.marketCap))}${card('P/E TTM',formatMetric(f.pe,1))}${card('BPA dilué TTM',formatMetric(f.eps,2))}${card('Rendement dividende',formatMetric(f.dividendYield,2),' %')}${card('Chiffre d’affaires',compactValue(f.revenue))}${card('Croissance CA TTM',formatMetric(f.revenueGrowth,1),' %')}${card('Dette / capitaux',formatMetric(f.debtToEquity,1))}${card('Bêta 1 an',formatMetric(f.beta,2))}`;
}
function renderNewsItems(asset, items) {
  const container = $('#detailNews'); if (!container || state.selected?.id !== asset.id) return;
  if (!items.length) { container.innerHTML = '<p class="intel-empty">Actualités Yahoo indisponibles pour cet instrument. Utilisez les liens sources ci-dessous.</p>'; return; }
  container.innerHTML = items.slice(0,5).map(item => {
    const url = item.link || item.canonicalUrl?.url || item.clickThroughUrl?.url || '#', date = item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleDateString('fr-FR') : '';
    return `<a class="news-item" href="${esc(url)}" target="_blank" rel="noopener"><strong>${esc(item.title || 'Actualité')}</strong><span>${esc(item.publisher || 'Yahoo Finance')}${date ? ` · ${date}` : ''}</span></a>`;
  }).join('');
}
async function loadYahooNews(asset) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(yahooSymbol(asset))}&quotesCount=1&newsCount=6&enableFuzzyQuery=false`);
    if (!response.ok) throw new Error('Yahoo');
    const payload = await response.json(); renderNewsItems(asset, payload.news || []);
  } catch { renderNewsItems(asset, []); }
}
function setupText(setup) {
  return setup === 'breakout' ? 'Proche du plus haut 3 mois, avec volume confirmé.' : setup === 'pullback' ? 'Tendance au-dessus de la MA200, retour contrôlé vers MA20/50.' : setup === 'momentum' ? 'MA20 > MA50 > MA200, MACD positif et RSI porteur.' : setup === 'haussier' ? 'Prix au-dessus de la MA200, sans déclencheur fort.' : setup === 'baissier' ? 'Prix sous la MA200 : tendance longue fragile.' : 'Pas de setup directionnel confirmé.';
}
function renderDetail(asset, chart = null) {
  const personalTags = state.tags[asset.id] || [], tags = assetTags(asset), alerts = activeAlerts().filter(a => a.instrumentId === asset.id), t = asset.tech || {}, f = asset.fundamentals || {};
  const quote = effectiveQuote(asset), values = chart?.closes?.filter(Number.isFinite) || seededSeries(asset.id, 60), price = quote.price, change = quote.change, symbol = yahooSymbol(asset), setup = setupFor(asset) || 'en attente';
  const chartBlock = asset.market === 'US' ? `<figure class="finviz-figure"><img id="finvizChart" class="finviz-chart" src="https://finviz.com/chart.ashx?t=${encodeURIComponent(asset.ticker)}&ty=c&ta=1&p=d&s=l" alt="Graphique technique Finviz de ${esc(asset.ticker)}"><figcaption><span>Finviz · journalier · SMA20/50/200</span><span>${esc(asset.ticker)}</span></figcaption></figure>` : `${chartSvg(values)}<div class="chart-caption"><span>${chart ? 'Yahoo Finance · 1 an' : 'Historique Yahoo en chargement…'}</span><span>${esc(symbol)}</span></div>`;
  const metric = (label, value, digits = 2, suffix = '') => `<div class="metric"><small>${label}</small><b>${formatMetric(value,digits)}${Number.isFinite(value) ? suffix : ''}</b></div>`;
  const secBlock = asset.market === 'US' ? `<div class="filing-links"><a href="${secUrl(asset,'10-K')}" target="_blank" rel="noopener"><b>10-K</b><span>Rapport annuel</span></a><a href="${secUrl(asset,'10-Q')}" target="_blank" rel="noopener"><b>10-Q</b><span>Rapport trimestriel</span></a><a href="${secUrl(asset,'8-K')}" target="_blank" rel="noopener"><b>8-K</b><span>Événement courant</span></a></div><a class="source-link" href="${secUrl(asset)}" target="_blank" rel="noopener">Tous les dépôts officiels sur SEC EDGAR ↗</a>` : '<p class="intel-empty">SEC EDGAR concerne les émetteurs déposants aux États-Unis.</p>';
  $('#detailContent').innerHTML = `<p class="eyebrow">${asset.market} · ${esc(f.sector || 'Marché')}</p><div class="detail-heading">${logoMarkup(asset)}<div><h1>${esc(asset.ticker)}</h1><div class="secondary">${esc(asset.name)}</div></div></div><div class="detail-tags">${tags.map(tag => `<button type="button" data-detail-filter-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}</div><div id="detailQuote" class="quote">${Number.isFinite(price) ? price.toLocaleString('fr-FR',{maximumFractionDigits:4}) : esc(asset.price)}</div><div id="detailQuoteMeta" class="detail-quote-meta">${quoteBadge(quote, true)}<span>${esc(quoteTimeText(quote))}</span></div><div id="detailQuoteChange" class="change ${change < 0 ? 'negative' : ''}">${change > 0 ? '+' : ''}${formatMetric(change,2)} %</div>${chartBlock}<div class="setup-card"><strong class="signal-badge ${esc(setup)}">${esc(setup)}</strong><span>${esc(setupText(setup))}</span></div><div class="metrics extended">${metric('MA 20',t.ma20)}${metric('MA 50',t.ma50)}${metric('MA 100',t.ma100)}${metric('MA 200',t.ma200)}${metric('RSI 14',t.rsi,1)}${metric('MACD',t.macd,3)}${metric('Signal MACD',t.macdSignal,3)}${metric('Vol. relatif',t.relVolume,2,'×')}${metric('VWAP',t.vwap)}${metric('ATR 14',t.atr)}<div class="metric" data-detail-quote-change><small>${quote.source === 'hyperliquid' ? 'Variation vs close' : 'Variation 24 h'}</small><b>${formatMetric(change,2)}%</b></div>${metric('Variation 1 sem.',t.perfWeek,2,'%')}${metric('Variation 1 mois',t.perfMonth,2,'%')}${metric('Variation 3 mois',t.perf3Month,2,'%')}<div class="metric"><small>OBV Δ jour</small><b>${formatCompact(t.obvDelta)}</b></div></div><p class="analysis-source">TradingView Scanner · données quotidiennes. OBV Δ jour = contribution signée du volume, pas l’OBV cumulatif.</p><section class="intel-section"><div class="intel-heading"><div><span class="eyebrow">ENTREPRISE</span><h2>Fondamentaux</h2></div><span class="intel-source">TradingView · Yahoo · Webull</span></div><div class="fundamental-grid">${fundamentalCards(asset)}</div><p class="intel-context">${esc([f.sector,f.industry].filter(Boolean).join(' · ') || 'Classification indisponible')}</p></section><section class="intel-section"><div class="intel-heading"><div><span class="eyebrow">FLUX</span><h2>Actualités</h2></div><span class="intel-source">Yahoo Finance</span></div><div id="detailNews" class="news-list" aria-live="polite"><p class="intel-empty">Chargement des actualités…</p></div><div class="source-links"><a href="https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/news/" target="_blank" rel="noopener">Toutes les news Yahoo ↗</a><a href="${webullUrl(asset)}" target="_blank" rel="noopener">Voir sur Webull ↗</a></div></section><section class="intel-section"><div class="intel-heading"><div><span class="eyebrow">DOCUMENTS</span><h2>Dépôts SEC</h2></div><span class="intel-source">SEC EDGAR</span></div>${secBlock}</section><div class="section"><b>Ajouter un tag</b><div class="tag-input"><input id="newTag" maxlength="24" placeholder="ex. breakout, énergie"><button id="addTag" class="primary">Ajouter</button></div><div class="tag-list">${personalTags.map(tag => `<button data-personal-tag="${esc(tag)}" title="Retirer">#${esc(tag)} ×</button>`).join('')}</div></div><div class="section"><b>Alerte de prix avec durée de vie</b><div class="alert-grid"><select id="alertCondition"><option value="above">Au-dessus de</option><option value="below">En dessous de</option></select><input id="alertTarget" type="number" step="any" value="${Number.isFinite(price) ? price : ''}" aria-label="Prix cible"><select id="alertTtl"><option value="24">24 heures</option><option value="168">7 jours</option><option value="720">30 jours</option></select><button id="addAlert" class="primary">Créer l’alerte</button></div>${alerts.map(a => `<div class="alert-item"><span>${a.condition === 'above' ? '≥' : '≤'} ${a.target} · expire ${new Date(a.expiresAt).toLocaleDateString('fr-FR')}</span><button data-alert="${esc(a.id)}" aria-label="Supprimer">×</button></div>`).join('')}<p class="secondary">Les alertes fonctionnent tant que cette page reste ouverte.</p></div><div class="links"><a href="https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}" target="_blank" rel="noopener">Yahoo Finance ↗</a><a href="${webullUrl(asset)}" target="_blank" rel="noopener">Webull ↗</a>${asset.market === 'US' ? `<a href="https://finviz.com/quote.ashx?t=${encodeURIComponent(asset.ticker)}" target="_blank" rel="noopener">Finviz ↗</a>` : ''}</div>`;
  document.querySelectorAll('#detailContent .asset-logo').forEach(image => image.addEventListener('error', () => {
    const fallbacks = JSON.parse(image.dataset.logoFallbacks || '[]'), next = fallbacks.shift();
    if (next) { image.dataset.logoFallbacks = JSON.stringify(fallbacks); image.src = next; } else image.remove();
  }));
  const finviz = $('#finvizChart');
  if (finviz) finviz.addEventListener('error', () => { const figure = finviz.closest('figure'); figure.innerHTML = `${chartSvg(values)}<figcaption><span>Finviz indisponible · aperçu local</span><span>${esc(asset.ticker)}</span></figcaption>`; }, { once:true });
  bindDetailActions(asset);
  loadYahooNews(asset);
}
function bindDetailActions(asset) {
  $('#addTag').onclick = () => { const input = $('#newTag'), tag = input.value.trim().replace(/^#/,'').toLowerCase(); if (!tag) return; state.tags[asset.id] = [...new Set([...(state.tags[asset.id] || []), tag])]; input.value=''; saveLocal(); renderTagFilter(); applyFilters(); renderDetail(asset); };
  $('#newTag').onkeydown = e => { if (e.key === 'Enter') $('#addTag').click(); };
  document.querySelectorAll('[data-personal-tag]').forEach(button => button.onclick = () => { state.tags[asset.id] = (state.tags[asset.id] || []).filter(t => t !== button.dataset.personalTag); saveLocal(); renderTagFilter(); applyFilters(); renderDetail(asset); });
  document.querySelectorAll('[data-detail-filter-tag]').forEach(button => button.onclick = () => { filterByTag(button.dataset.detailFilterTag); closeDetail(); });
  $('#addAlert').onclick = async () => {
    const target = Number($('#alertTarget').value), ttl = Number($('#alertTtl').value); if (!Number.isFinite(target)) return toast('Prix cible invalide');
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    state.alerts.push({ id: crypto.randomUUID(), instrumentId: asset.id, condition: $('#alertCondition').value, target, createdAt: Date.now(), expiresAt: Date.now() + ttl * 3600000, triggered: false });
    saveLocal(); applyFilters(); renderDetail(asset); toast('Alerte enregistrée');
  };
  document.querySelectorAll('[data-alert]').forEach(button => button.onclick = () => { state.alerts = state.alerts.filter(a => a.id !== button.dataset.alert); saveLocal(); applyFilters(); renderDetail(asset); });
}
async function loadChart(asset) {
  const symbol = yahooSymbol(asset);
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`);
    if (!response.ok) throw new Error('chart');
    const result = (await response.json()).chart.result?.[0], quote = result?.indicators?.quote?.[0];
    if (!quote?.close) throw new Error('chart');
    renderDetail(asset, { closes: quote.close, volumes: quote.volume || [], highs: quote.high || [], lows: quote.low || [] });
  } catch { /* the offline chart is already visible */ }
}
function openDetail(id) {
  const asset = state.assets.find(a => a.id === id); if (!asset) return;
  state.selected = asset; renderDetail(asset); if (asset.market !== 'US') loadChart(asset);
  $('#detail').classList.add('open'); $('#detail').setAttribute('aria-hidden','false'); $('#scrim').hidden = false;
}
function closeDetail() { $('#detail').classList.remove('open'); $('#detail').setAttribute('aria-hidden','true'); $('#scrim').hidden = true; state.selected = null; }
function evaluateAlerts(asset) {
  if (!state.alerts.length) return;
  const price = effectiveQuote(asset).price;
  if (!Number.isFinite(price)) return;
  let triggered = false;
  for (const alert of activeAlerts().filter(a => a.instrumentId === asset.id && !a.triggered)) {
    if ((alert.condition === 'above' && price >= alert.target) || (alert.condition === 'below' && price <= alert.target)) {
      alert.triggered = true; triggered = true; const message = `${asset.ticker} ${alert.condition === 'above' ? 'a franchi' : 'est passé sous'} ${alert.target}`;
      toast(message); if ('Notification' in window && Notification.permission === 'granted') new Notification('MarketWatch', { body: message });
    }
  }
  if (triggered) saveLocal();
}
function scheduleQuoteRender() {
  if (state.quoteRenderPending) return;
  state.quoteRenderPending = true;
  setTimeout(() => {
    state.quoteRenderPending = false; refreshQuoteCells(); updateConnectionUi();
    if (state.selected) updateDetailQuote(state.selected);
  }, 2000);
}
function updateConnectionUi() {
  const yahooOpen = state.streamStatus.yahoo === 'open', hyperliquidOpen = state.streamStatus.hyperliquid === 'open';
  const live = yahooOpen || hyperliquidOpen;
  $('#marketState').classList.toggle('live', live);
  $('#streamBtn').classList.toggle('active', state.streamEnabled);
  $('#streamBtn').setAttribute('aria-pressed', String(state.streamEnabled));
  const sourceCounts = state.assets.reduce((counts, asset) => {
    const source = effectiveQuote(asset).source;
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const rtCount = (sourceCounts.hyperliquid || 0) + (sourceCounts['yahoo-rt'] || 0);
  $('#connectionState').textContent = rtCount ? (hyperliquidOpen && yahooOpen ? 'HL + Yahoo RT' : hyperliquidOpen ? 'Hyperliquid RT' : 'Yahoo RT') : yahooOpen || hyperliquidOpen ? 'Flux connecté' : state.yahooCloseCount ? 'Repli clôture' : state.streamEnabled ? 'Connexion…' : 'Flux désactivé';
  $('#connectionHint').textContent = `${rtCount} RT · ${sourceCounts['yahoo-close'] || 0} closes Yahoo${sourceCounts.snapshot ? ` · ${sourceCounts.snapshot} snapshots` : ''}`;
}
function scheduleReconnect(kind, connect) {
  if (!state.streamEnabled || state.reconnectTimers[kind]) return;
  state.reconnectTimers[kind] = setTimeout(() => { state.reconnectTimers[kind] = null; connect(); }, 5000);
}
function connectYahoo() {
  if (!state.streamEnabled) return;
  const batches = yahooSubscriptionBatches([...state.yahooAssets.keys()]);
  for (const [index, symbols] of batches.entries()) {
    if (state.streams.yahoo.has(index)) continue;
    try {
      const socket = new WebSocket('wss://streamer.finance.yahoo.com/');
      state.streams.yahoo.set(index, socket);
      state.streamStatus.yahoo = 'connecting';
      socket.onopen = () => {
        if (state.streams.yahoo.get(index) !== socket) return;
        socket.send(JSON.stringify({ subscribe:symbols }));
        state.streamStatus.yahoo = 'open'; updateConnectionUi();
      };
      socket.onmessage = event => {
        try {
          const incoming = decodeYahooFrame(event.data), assets = state.yahooAssets.get(incoming.id) || [];
          if (!assets.length || incoming.quoteType === 7 || !Number.isFinite(incoming.price) || incoming.price <= 0) return;
          const sourceAt = incoming.time;
          if (!isFresh({ price:incoming.price, at:sourceAt }, QUOTE_MAX_AGE.yahoo)) return;
          for (const asset of assets) {
            if (asset.yahooRt && sourceAt < asset.yahooRt.at) continue;
            asset.yahooRt = { price:incoming.price, change:incoming.changePercent, at:sourceAt };
            evaluateAlerts(asset);
          }
          scheduleQuoteRender();
        } catch { /* malformed Yahoo frame */ }
      };
      socket.onerror = () => { if (state.streams.yahoo.get(index) === socket) updateConnectionUi(); };
      socket.onclose = () => {
        if (state.streams.yahoo.get(index) !== socket) return;
        state.streams.yahoo.delete(index);
        state.streamStatus.yahoo = [...state.streams.yahoo.values()].some(stream => stream.readyState === WebSocket.OPEN) ? 'open' : 'closed';
        updateConnectionUi(); scheduleQuoteRender(); scheduleReconnect('yahoo', connectYahoo);
      };
    } catch { scheduleReconnect('yahoo', connectYahoo); }
  }
  updateConnectionUi();
}
function connectHyperliquid() {
  if (!state.streamEnabled || !isHyperliquidWindow() || state.streams.hyperliquid) return;
  try {
    const socket = new WebSocket('wss://api.hyperliquid.xyz/ws');
    state.streams.hyperliquid = socket; state.streamStatus.hyperliquid = 'connecting'; updateConnectionUi();
    socket.onopen = () => {
      if (state.streams.hyperliquid !== socket) return;
      state.streamStatus.hyperliquid = 'open';
      socket.send(JSON.stringify({ method:'subscribe', subscription:{ type:'allMids', dex:'xyz' } }));
      updateConnectionUi();
    };
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data); if (message.channel !== 'allMids' || !message.data?.mids) return;
        const receivedAt = Date.now();
        for (const [coin, assets] of state.hyperliquidAssets) {
          const price = Number(message.data.mids[coin]); if (!Number.isFinite(price)) continue;
          for (const asset of assets) { asset.hyperliquidRt = { price, at:receivedAt }; evaluateAlerts(asset); }
        }
        scheduleQuoteRender();
      } catch { /* malformed Hyperliquid frame */ }
    };
    socket.onerror = () => { state.streamStatus.hyperliquid = 'error'; updateConnectionUi(); };
    socket.onclose = () => {
      if (state.streams.hyperliquid !== socket) return;
      state.streams.hyperliquid = null; state.streamStatus.hyperliquid = 'closed'; updateConnectionUi(); scheduleQuoteRender(); scheduleReconnect('hyperliquid', connectHyperliquid);
    };
  } catch { state.streamStatus.hyperliquid = 'error'; updateConnectionUi(); scheduleReconnect('hyperliquid', connectHyperliquid); }
}
function reconcilePriceFeeds() {
  if (!state.streamEnabled) return;
  connectYahoo();
  if (isHyperliquidWindow()) connectHyperliquid();
  else if (state.streams.hyperliquid) {
    const socket = state.streams.hyperliquid; state.streams.hyperliquid = null; state.streamStatus.hyperliquid = 'idle'; socket.close();
  }
  updateConnectionUi();
}
function disconnectStreams() {
  state.streamEnabled = false;
  clearTimeout(state.reconnectTimers.yahoo); state.reconnectTimers.yahoo = null;
  const yahooStreams = [...state.streams.yahoo.values()]; state.streams.yahoo.clear(); state.streamStatus.yahoo = 'idle';
  yahooStreams.forEach(socket => socket.close());
  for (const kind of ['hyperliquid']) {
    clearTimeout(state.reconnectTimers[kind]); state.reconnectTimers[kind] = null;
    const socket = state.streams[kind]; state.streams[kind] = null; state.streamStatus[kind] = 'idle';
    if (socket) socket.close();
  }
  for (const asset of state.assets) { delete asset.yahooRt; delete asset.hyperliquidRt; }
  updateConnectionUi(); scheduleQuoteRender();
}
function toggleStream() {
  if (state.streamEnabled) { disconnectStreams(); toast('Flux temps réel désactivés · closes Yahoo conservées'); return; }
  state.streamEnabled = true; reconcilePriceFeeds(); toast('Flux automatiques activés');
}
async function sharePage() {
  const payload = { title: 'MarketWatch', text: 'Mon cockpit DailyTickers de surveillance marchés', url: location.href };
  try { if (navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(location.href); toast('Lien copié — prêt pour Telegram'); } } catch (error) { if (error.name !== 'AbortError') toast('Impossible de partager ce lien'); }
}
async function connectGoogle(event) {
  event.preventDefault(); const status = $('#syncStatus');
  try {
    const config = JSON.parse($('#firebaseConfig').value); if (!config.apiKey || !config.projectId) throw new Error('Configuration incomplète');
    status.textContent = 'Connexion à Google…';
    const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const app = appMod.initializeApp(config), auth = authMod.getAuth(app), provider = new authMod.GoogleAuthProvider();
    const credential = await authMod.signInWithPopup(auth, provider), db = dbMod.getFirestore(app);
    const ref = dbMod.doc(db, 'users', credential.user.uid, 'marketscope', 'state'); const snapshot = await dbMod.getDoc(ref);
    state.firebase = { uid: credential.user.uid, ref }; state.firebaseApi = dbMod; localStorage.setItem(STORAGE.firebase, JSON.stringify(config));
    if (snapshot.exists()) {
      const remote = snapshot.data(); state.tags = remote.tags || state.tags; state.alerts = remote.alerts || state.alerts;
      if (Array.isArray(remote.selectedTags)) state.selectedTags = new Set(remote.selectedTags);
      if (Array.isArray(remote.columns)) state.visibleColumns = new Set(['instrument', ...remote.columns.map(key => key === 'lists' ? 'tags' : key).filter(key => DEFAULT_COLUMNS.includes(key))]);
      if (remote.sort?.key) state.sort = { key:remote.sort.key === 'lists' ? 'tags' : remote.sort.key, dir:remote.sort.dir === 'asc' ? 'asc' : 'desc' };
      saveLocal(); renderTagFilter(); renderColumnPicker(); applyFilters();
    }
    else await dbMod.setDoc(ref, { tags:state.tags, alerts:state.alerts, selectedTags:[...state.selectedTags], columns:[...state.visibleColumns], sort:state.sort, updatedAt:Date.now() });
    status.textContent = `Synchronisé avec ${credential.user.email}`; $('#syncDialog').close(); $('#syncBtn').textContent = '✓ Google connecté'; toast('Synchronisation Google active');
  } catch (error) { status.textContent = `Échec : ${error.message}`; }
}
function scheduleRemoteSave() {
  if (!state.firebase || !state.firebaseApi) return; clearTimeout(state.remoteTimer);
  state.remoteTimer = setTimeout(() => state.firebaseApi.setDoc(state.firebase.ref, { tags:state.tags, alerts:state.alerts, selectedTags:[...state.selectedTags], columns:[...state.visibleColumns], sort:state.sort, updatedAt:Date.now() }).catch(() => toast('Synchronisation Google interrompue')), 600);
}
function registerWebMcp() {
  if (!document.modelContext?.registerTool) return;
  document.modelContext.registerTool({ name:'filter_watchlist', description:'Filtre le cockpit par texte, tag ou marché.', inputSchema:{type:'object',properties:{query:{type:'string'},tag:{type:'string'},market:{type:'string'}}}, annotations:{readOnlyHint:true}, execute: async input => { if (input.query != null) $('#search').value=input.query; if (input.tag != null) state.selectedTags = new Set([input.tag]); if (input.market != null) $('#marketFilter').value=input.market; renderTagFilter(); applyFilters(); return {content:[{type:'text',text:`${state.filtered.length} instruments visibles`}]} } });
  document.modelContext.registerTool({ name:'open_instrument', description:'Ouvre la fiche détaillée d’un ticker.', inputSchema:{type:'object',required:['ticker'],properties:{ticker:{type:'string'}}}, annotations:{readOnlyHint:true}, execute: async ({ticker}) => { const asset=state.assets.find(a=>a.ticker.toLowerCase()===ticker.toLowerCase()); if(!asset) throw new Error('Ticker introuvable'); openDetail(asset.id); return {content:[{type:'text',text:`Fiche ${asset.ticker} ouverte`}]} } });
}
function indexQuoteSources(closePayload) {
  state.yahooAssets = new Map(); state.hyperliquidAssets = new Map(); state.yahooCloseCount = 0;
  for (const asset of state.assets) {
    const symbol = yahooSymbol(asset);
    if (!state.yahooAssets.has(symbol)) state.yahooAssets.set(symbol, []);
    state.yahooAssets.get(symbol).push(asset);
    const close = closePayload?.quotes?.[symbol];
    if (Number.isFinite(close?.price)) {
      asset.yahooClose = { price:close.price, previousClose:close.previousClose, change:close.change, sessionDate:close.sessionDate };
      state.yahooCloseCount += 1;
    }
    const coin = hyperliquidCoin(asset, symbol);
    if (coin) {
      if (!state.hyperliquidAssets.has(coin)) state.hyperliquidAssets.set(coin, []);
      state.hyperliquidAssets.get(coin).push(asset);
    }
  }
}
async function init() {
  try {
    const [response, autoResponse, closesResponse] = await Promise.all([
      fetch('./data/watchlists.json'),
      fetch('./data/auto-universe.json').catch(() => null),
      fetch('./data/yahoo-closes.json', { cache:'no-cache' }).catch(() => null)
    ]);
    if (!response.ok) throw new Error('Données indisponibles');
    const [rawLists, rawAssets] = await response.json();
    const autoUniverse = autoResponse?.ok ? await autoResponse.json() : { assets:[] };
    const yahooCloses = closesResponse?.ok ? await closesResponse.json() : { quotes:{} };
    state.tagGroups = rawLists.filter(([name]) => !EXCLUDED_LISTS.has(name) && name !== 'Ma Liste de surveillance').map(([name,indexes]) => ({name,indexes}));
    const memberships = Array.from({length:rawAssets.length},()=>[]); state.tagGroups.forEach(group => group.indexes.forEach(index => memberships[index]?.push(group.name)));
    state.assets = rawAssets.map(([id,ticker,name,price,change], index) => ({ id,ticker,name,price,priceNumber:numberFrom(price),change:numberFrom(change),market:marketFor(id,ticker,name),sourceTags:memberships[index] })).filter(asset => asset.sourceTags.length);
    const byTicker = new Map(state.assets.map(asset => [asset.ticker.toUpperCase(), asset]));
    for (const incoming of autoUniverse.assets || []) {
      const key = String(incoming.ticker || '').toUpperCase(); if (!key) continue;
      const existing = byTicker.get(key);
      if (existing) {
        existing.sourceTags = [...new Set([...(existing.sourceTags || []), ...(incoming.tags || [])])];
        existing.analysisUrl = incoming.analysisUrl || existing.analysisUrl;
        existing.scannerUrl = incoming.scannerUrl || existing.scannerUrl;
        continue;
      }
      const asset = {
        id:incoming.id, ticker:incoming.ticker, name:incoming.name, price:incoming.price ?? '—',
        priceNumber:Number.isFinite(incoming.price) ? incoming.price : null,
        change:Number.isFinite(incoming.change) ? incoming.change : null,
        market:incoming.market || marketFor(incoming.id,incoming.ticker,incoming.name),
        sourceTags:incoming.tags || [], analysisUrl:incoming.analysisUrl, scannerUrl:incoming.scannerUrl
      };
      state.assets.push(asset); byTicker.set(key, asset);
    }
    indexQuoteSources(yahooCloses);
    $('#assetCount').textContent = state.assets.length; $('#tagCount').textContent = availableTags().length; renderTagFilter(); renderColumnPicker(); applyFilters(); registerWebMcp(); updateConnectionUi(); reconcilePriceFeeds(); loadTechnicals();
    const config = localStorage.getItem(STORAGE.firebase); if (config) $('#firebaseConfig').value = config;
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (error) { $('#rows').innerHTML = `<tr><td colspan="10">${esc(error.message)}</td></tr>`; }
}
['search','marketFilter','signalFilter'].forEach(id => $(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change', applyFilters));
document.querySelectorAll('[data-sort]').forEach(button => button.onclick = () => setSort(button.dataset.sort));
$('#sortKey').onchange = event => setSort(event.target.value, ['ticker','name','market','setup'].includes(event.target.value) ? 'asc' : 'desc');
$('#sortDirection').onclick = () => setSort(state.sort.key, state.sort.dir === 'asc' ? 'desc' : 'asc');
$('#tagChoices').onchange = event => { const checkbox = event.target.closest('[data-filter-tag]'); if (!checkbox) return; checkbox.checked ? state.selectedTags.add(checkbox.dataset.filterTag) : state.selectedTags.delete(checkbox.dataset.filterTag); renderTagFilter(); applyFilters(); };
$('#clearTagFilters').onclick = () => { state.selectedTags.clear(); renderTagFilter(); applyFilters(); };
$('#activeTagFilters').onclick = event => { const tag = event.target.closest('[data-remove-tag]'), clear = event.target.closest('[data-clear-tags]'); if (tag) state.selectedTags.delete(tag.dataset.removeTag); if (clear) state.selectedTags.clear(); if (tag || clear) { renderTagFilter(); applyFilters(); } };
$('#columnChoices').onchange = event => { const input = event.target.closest('[data-column-toggle]'); if (!input || input.disabled) return; input.checked ? state.visibleColumns.add(input.dataset.columnToggle) : state.visibleColumns.delete(input.dataset.columnToggle); applyColumnVisibility(); };
$('#showAllColumns').onclick = event => { event.preventDefault(); state.visibleColumns = new Set(DEFAULT_COLUMNS); applyColumnVisibility(); };
document.addEventListener('click', event => { [$('#tagFilter'), $('#columnPicker')].forEach(menu => { if (menu.open && !menu.contains(event.target)) menu.removeAttribute('open'); }); });
$('#analyzeBtn').onclick = loadTechnicals;
function filterByTag(tag) { state.selectedTags = new Set([tag]); renderTagFilter(); applyFilters(); $('#tagFilter').removeAttribute('open'); toast(`#${tag} · ${state.filtered.length} instruments`); }
$('#rows').addEventListener('click', event => { const tag = event.target.closest('[data-row-tag]'); if (tag) { event.stopPropagation(); filterByTag(tag.dataset.rowTag); return; } const row = event.target.closest('tr'); if (row) openDetail(row.dataset.id); });
$('#rows').addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr')) openDetail(event.target.dataset.id); });
$('#closeDetail').onclick = closeDetail; $('#scrim').onclick = closeDetail; document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
$('#streamBtn').onclick = toggleStream; $('#shareBtn').onclick = sharePage; $('#syncBtn').onclick = () => $('#syncDialog').showModal(); $('#connectGoogle').onclick = connectGoogle;
window.addEventListener('online', reconcilePriceFeeds);
setInterval(() => { activeAlerts(); reconcilePriceFeeds(); }, 60000);
setInterval(scheduleQuoteRender, 15000);
init();
