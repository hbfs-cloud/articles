'use strict';
/**
 * price-cache.js — Helper de cache prix DATÉ, partagé, source unique de vérité.
 *
 * Corrige le BUG RACINE du cache plat (data/.price-cache/TICKER_ohlcv.json sans date) :
 * un re-run à une autre date écrasait/polluait les données d'une date passée
 * (ex: SNA casablanca $402 au lieu de 73 MAD ; highvol 07-06 fabriquant SLS au lieu de DAVE).
 *
 * Nouvelle arbo, calquée sur le cache Go (point-in-time, rejouable) :
 *   data/.price-cache/<YYYY-MM-DD>/<interval>/<market>/<ticker>.json
 *   → stocke l'ARRAY canonique de bars [{date,open,high,low,close,volume}, ...] trié asc.
 *
 * Règles de sûreté (le coeur du fix) :
 *  1. Scanner pour date D → lit le snapshot GELÉ …/D/… s'il existe (jamais re-fetch pour une date passée).
 *  2. Absent → fetch live (côté appelant) puis writeBars TRONQUE les bars à bar.date <= D
 *     (garde-fou anti-look-ahead au backfill) avant d'écrire dans …/D/.
 *  3. Forward (D = aujourd'hui) → troncature = no-op → zéro régression.
 *  4. D == aujourd'hui → TTL 12h pour rafraîchir la barre du jour ; D passé → snapshot immuable (pas de TTL).
 *
 * Compat descendante : si le fichier daté manque, fallback LECTURE seule sur l'ancien fichier plat
 * (…/${ticker}_ohlcv.json array, ou …/${ticker}.json date-keyed). On écrit TOUJOURS en daté.
 */

const fs = require('fs');
const path = require('path');

const PRICE_CACHE_ROOT = path.resolve(__dirname, '..', '..', 'data', '.price-cache');

const MARKETS = Object.freeze({
  US: 'US',         // equities + etf (défaut)
  CVA: 'CVA',       // Casablanca / BVC
  FX: 'FX',         // forex
  CRYPTO: 'CRYPTO', // binance
});

const TTL_MS = 12 * 60 * 60 * 1000; // 12h, uniquement pour date == aujourd'hui

// ---------------------------------------------------------------------------
// Helpers dates
// ---------------------------------------------------------------------------

/** Normalise une date en 'YYYY-MM-DD'. Accepte 'YYYY-MM-DD', 'YYYYMMDD', ou Date. Throw si invalide. */
function normalizeDate(date) {
  if (date == null) throw new Error('price-cache: date requise (YYYY-MM-DD ou YYYYMMDD)');
  if (date instanceof Date) {
    if (isNaN(date.getTime())) throw new Error('price-cache: objet Date invalide');
    return toISO(date);
  }
  const s = String(date).trim();
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    // ok tel quel, mais valide les composantes
    return assertValid(m[1], m[2], m[3], s);
  }
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) {
    return assertValid(m[1], m[2], m[3], `${m[1]}-${m[2]}-${m[3]}`);
  }
  throw new Error(`price-cache: format de date invalide '${s}' (attendu YYYY-MM-DD ou YYYYMMDD)`);
}

function assertValid(y, mo, d, iso) {
  const yi = +y, moi = +mo, di = +d;
  if (moi < 1 || moi > 12 || di < 1 || di > 31) {
    throw new Error(`price-cache: date hors bornes '${iso}'`);
  }
  const dt = new Date(Date.UTC(yi, moi - 1, di));
  if (dt.getUTCFullYear() !== yi || dt.getUTCMonth() !== moi - 1 || dt.getUTCDate() !== di) {
    throw new Error(`price-cache: date inexistante '${iso}'`);
  }
  return iso;
}

function toISO(dt) {
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Date du jour en heure locale, 'YYYY-MM-DD'. */
function todayISO() {
  return toISO(new Date());
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

function normOpts(opts = {}) {
  const date = normalizeDate(opts.date);
  const market = String(opts.market || MARKETS.US);
  const interval = String(opts.interval || '1d');
  return { date, market, interval };
}

/**
 * Chemin absolu du fichier de cache daté.
 * data/.price-cache/<date>/<interval>/<market>/<ticker>.json
 */
function cacheFile(ticker, opts = {}) {
  if (!ticker) throw new Error('price-cache: ticker requis');
  const { date, market, interval } = normOpts(opts);
  const safeTicker = sanitizeSegment(String(ticker));
  return path.join(PRICE_CACHE_ROOT, date, interval, market, `${safeTicker}.json`);
}

/** Empêche un ticker de casser l'arbo (séparateurs). Conserve les caractères usuels (=, ^, .). */
function sanitizeSegment(s) {
  return s.replace(/[\/\\]/g, '_');
}

// Chemins legacy (plats) — LECTURE seule.
function legacyArrayFile(ticker) {
  return path.join(PRICE_CACHE_ROOT, `${sanitizeSegment(String(ticker))}_ohlcv.json`);
}
function legacyKeyedFile(ticker) {
  return path.join(PRICE_CACHE_ROOT, `${sanitizeSegment(String(ticker))}.json`);
}

// ---------------------------------------------------------------------------
// Sérialisation bars
// ---------------------------------------------------------------------------

function readJSONSafe(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return undefined; // fichier absent OU JSON corrompu → traité comme "pas de donnée"
  }
}

/** Un bar valide a un champ date. Trie asc par date. Filtre les bars sans date. */
function sortBars(bars) {
  return bars
    .filter((b) => b && b.date != null && b.date !== '')
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Convertit un objet date-keyed {date:{o,h,l,c,v}} en array de bars trié asc. */
function keyedToArray(obj) {
  const out = [];
  for (const [date, v] of Object.entries(obj)) {
    if (!v || typeof v !== 'object') continue;
    out.push({
      date,
      open: v.open,
      high: v.high,
      low: v.low,
      close: v.close,
      volume: v.volume != null ? v.volume : 0,
    });
  }
  return sortBars(out);
}

/** Convertit un array de bars en objet date-keyed. */
function arrayToKeyed(bars) {
  const out = {};
  for (const b of sortBars(bars)) {
    out[b.date] = {
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume != null ? b.volume : 0,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// API principale
// ---------------------------------------------------------------------------

/**
 * Lit les bars pour (ticker, date, market, interval).
 * - Fichier daté présent : applique TTL 12h SEULEMENT si date == aujourd'hui ; sinon immuable.
 * - Fichier daté absent + allowLegacyFallback : lit l'ancien plat (array ou date-keyed) en LECTURE seule.
 * Retourne un array de bars trié asc, ou null.
 */
function readBars(ticker, opts = {}) {
  const { date, market, interval } = normOpts(opts);
  const allowLegacyFallback = opts.allowLegacyFallback !== false;
  const file = cacheFile(ticker, { date, market, interval });

  if (fs.existsSync(file)) {
    // TTL uniquement pour le jour courant (barre du jour susceptible d'évoluer).
    if (date === todayISO()) {
      try {
        const age = Date.now() - fs.statSync(file).mtimeMs;
        if (age > TTL_MS) return null; // stale → l'appelant re-fetch
      } catch (_) { /* stat KO → traiter comme lisible */ }
    }
    const data = readJSONSafe(file);
    if (Array.isArray(data)) return sortBars(data);
    if (data && typeof data === 'object') return keyedToArray(data); // tolérance
    return null; // corrompu
  }

  if (!allowLegacyFallback) return null;

  // Fallback legacy — LECTURE seule, jamais d'écriture ici.
  const arr = readJSONSafe(legacyArrayFile(ticker));
  if (Array.isArray(arr)) return sortBars(arr);
  if (arr && typeof arr === 'object') return keyedToArray(arr);

  const keyed = readJSONSafe(legacyKeyedFile(ticker));
  if (Array.isArray(keyed)) return sortBars(keyed);       // certains legacy (forex) sont des arrays
  if (keyed && typeof keyed === 'object') return keyedToArray(keyed);

  return null;
}

/**
 * Écrit les bars dans le fichier daté, en TRONQUANT à bar.date <= date (anti-look-ahead).
 * mkdir -p récursif. Retourne le nombre de bars écrites.
 */
function writeBars(ticker, bars, opts = {}) {
  const { date, market, interval } = normOpts(opts);
  if (!Array.isArray(bars)) throw new Error('price-cache: writeBars attend un array de bars');

  const truncated = sortBars(bars).filter((b) => String(b.date) <= date);
  const file = cacheFile(ticker, { date, market, interval });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(truncated), 'utf8');
  return truncated.length;
}

/** Version date-keyed de readBars (pour sweep.js). Retourne {} si null. */
function readHistory(ticker, opts = {}) {
  const bars = readBars(ticker, opts);
  if (!bars) return null;
  return arrayToKeyed(bars);
}

/** Écrit un objet date-keyed (convertit en array puis writeBars, avec troncature). Retourne le nb de bars. */
function writeHistory(ticker, history, opts = {}) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) {
    throw new Error('price-cache: writeHistory attend un objet date-keyed');
  }
  return writeBars(ticker, keyedToArray(history), opts);
}

module.exports = {
  PRICE_CACHE_ROOT,
  MARKETS,
  TTL_MS,
  cacheFile,
  readBars,
  writeBars,
  readHistory,
  writeHistory,
  // utilitaires exposés (tests / réutilisation)
  normalizeDate,
  todayISO,
  keyedToArray,
  arrayToKeyed,
};

// ---------------------------------------------------------------------------
// Selftest : node tools/lib/price-cache.js --selftest
// ---------------------------------------------------------------------------

if (require.main === module && process.argv.includes('--selftest')) {
  runSelftest();
}

function runSelftest() {
  const assert = require('assert');
  const os = require('os');
  const TICKER = '__SELFTEST_FAKE__';
  const D1 = '2026-07-03';
  const D2 = '2026-07-04';
  const opts1 = { date: D1, market: MARKETS.US, interval: '1d' };
  const opts2 = { date: D2, market: MARKETS.US, interval: '1d' };

  const f1 = cacheFile(TICKER, opts1);
  const f2 = cacheFile(TICKER, opts2);
  let failed = 0;
  const ok = (label) => console.log(`  ok  ${label}`);
  const cleanup = () => {
    for (const d of [D1, D2]) {
      try { fs.rmSync(path.join(PRICE_CACHE_ROOT, d), { recursive: true, force: true }); } catch (_) {}
    }
  };

  try {
    cleanup();

    // --- normalizeDate ---
    assert.strictEqual(normalizeDate('20260703'), '2026-07-03', 'normalize YYYYMMDD');
    assert.strictEqual(normalizeDate('2026-07-03'), '2026-07-03', 'normalize ISO');
    assert.throws(() => normalizeDate('2026-13-01'), 'reject mois 13');
    assert.throws(() => normalizeDate('nope'), 'reject garbage');
    assert.throws(() => normalizeDate(null), 'reject null');
    ok('normalizeDate (ISO, compact, throws)');

    // --- chemin daté ---
    assert.ok(f1.endsWith(path.join('2026-07-03', '1d', 'US', `${TICKER}.json`)), 'chemin daté correct');
    assert.notStrictEqual(f1, f2, 'chemins distincts par date');
    ok('cacheFile arbo datée');

    // --- écriture D1 : dataset "vérité" du 03, avec une barre FUTURE (04) qui DOIT être tronquée ---
    const barsD1 = [
      { date: '2026-07-01', open: 10, high: 11, low: 9, close: 10.5, volume: 100 },
      { date: '2026-07-02', open: 10.5, high: 12, low: 10, close: 11.8, volume: 120 },
      { date: '2026-07-03', open: 11.8, high: 13, low: 11.5, close: 12.9, volume: 130 },
      { date: '2026-07-04', open: 99, high: 99, low: 99, close: 99, volume: 999 }, // FUTUR → tronqué
    ];
    const nW1 = writeBars(TICKER, barsD1, opts1);
    assert.strictEqual(nW1, 3, `troncature: 3 bars écrites (got ${nW1})`);
    const readD1 = readBars(TICKER, opts1);
    assert.strictEqual(readD1.length, 3, 'relecture D1 = 3 bars');
    assert.strictEqual(readD1[readD1.length - 1].date, '2026-07-03', 'dernière barre D1 = 07-03');
    assert.ok(!readD1.some((b) => b.date === '2026-07-04'), 'aucune barre future dans D1');
    ok('writeBars troncature anti-look-ahead');

    // --- écriture D2 : nouveau snapshot, prix DIFFÉRENTS + barre du 04 ---
    const barsD2 = [
      { date: '2026-07-03', open: 11.8, high: 13, low: 11.5, close: 12.9, volume: 130 },
      { date: '2026-07-04', open: 12.9, high: 14, low: 12.7, close: 13.6, volume: 140 },
    ];
    const nW2 = writeBars(TICKER, barsD2, opts2);
    assert.strictEqual(nW2, 2, 'D2 = 2 bars écrites');

    // --- ISOLATION inter-dates : écrire D2 ne DOIT PAS toucher D1 ---
    const readD1b = readBars(TICKER, opts1);
    assert.strictEqual(readD1b.length, 3, 'D1 inchangé après écriture D2 (isolation)');
    assert.strictEqual(readD1b[readD1b.length - 1].date, '2026-07-03', 'D1 toujours borné au 07-03');
    const readD2 = readBars(TICKER, opts2);
    assert.strictEqual(readD2.length, 2, 'D2 = 2 bars');
    assert.strictEqual(readD2[readD2.length - 1].date, '2026-07-04', 'D2 va jusqu\'au 07-04');
    ok('isolation inter-dates (snapshots indépendants)');

    // --- readHistory / writeHistory (date-keyed, pour sweep.js) ---
    const hist = readHistory(TICKER, opts1);
    assert.ok(hist && hist['2026-07-03'] && !hist['2026-07-04'], 'readHistory date-keyed borné');
    assert.strictEqual(hist['2026-07-03'].close, 12.9, 'valeur close via readHistory');
    const D3 = '2026-07-05';
    const nH = writeHistory(TICKER, {
      '2026-07-04': { open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      '2026-07-06': { open: 5, high: 6, low: 4, close: 5.5, volume: 50 }, // FUTUR vs D3 → tronqué
    }, { date: D3, market: MARKETS.US, interval: '1d' });
    assert.strictEqual(nH, 1, 'writeHistory tronque le futur (1 bar)');
    try { fs.rmSync(path.join(PRICE_CACHE_ROOT, D3), { recursive: true, force: true }); } catch (_) {}
    ok('readHistory / writeHistory date-keyed + troncature');

    // --- immutabilité snapshot passé : pas de TTL sur date passée ---
    // Backdater le mtime de f1 loin dans le passé ; readBars doit TOUJOURS renvoyer les bars.
    const oldTime = new Date(Date.now() - 48 * 3600 * 1000);
    fs.utimesSync(f1, oldTime, oldTime);
    const readStale = readBars(TICKER, opts1);
    assert.ok(readStale && readStale.length === 3, 'date passée = snapshot immuable (pas de TTL)');
    ok('snapshot passé immuable (TTL ignoré)');

    // --- TTL actif pour aujourd\'hui ---
    const T = todayISO();
    const optsT = { date: T, market: MARKETS.US, interval: '1d' };
    writeBars(TICKER, [{ date: T, open: 1, high: 1, low: 1, close: 1, volume: 1 }], optsT);
    const fToday = cacheFile(TICKER, optsT);
    assert.ok(readBars(TICKER, optsT), 'aujourd\'hui frais = lisible');
    fs.utimesSync(fToday, oldTime, oldTime); // rendre stale
    assert.strictEqual(readBars(TICKER, { ...optsT, allowLegacyFallback: false }), null,
      'aujourd\'hui stale (>12h) = null (re-fetch)');
    try { fs.rmSync(path.join(PRICE_CACHE_ROOT, T), { recursive: true, force: true }); } catch (_) {}
    ok('TTL 12h actif pour la date du jour');

    // --- JSON corrompu → null, pas de throw ---
    fs.writeFileSync(f2, '{ this is not json', 'utf8');
    assert.strictEqual(readBars(TICKER, { ...opts2, allowLegacyFallback: false }), null, 'corrompu → null');
    ok('JSON corrompu → null (no throw)');

    // --- fallback legacy LECTURE seule ---
    const legacyOpts = { date: '2026-07-10', market: MARKETS.US, interval: '1d' };
    const legFile = legacyArrayFile(TICKER);
    let wroteLegacy = false;
    if (!fs.existsSync(legFile)) {
      fs.writeFileSync(legFile, JSON.stringify([
        { date: '2026-07-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      ]), 'utf8');
      wroteLegacy = true;
    }
    const legRead = readBars(TICKER, legacyOpts); // fichier daté absent → fallback
    assert.ok(legRead && legRead.length >= 1, 'fallback legacy array lu');
    assert.ok(!fs.existsSync(cacheFile(TICKER, legacyOpts)), 'fallback ne crée PAS de fichier daté');
    if (wroteLegacy) fs.rmSync(legFile, { force: true });
    ok('fallback legacy lecture seule (aucune écriture)');

    console.log('\n  SELFTEST PASS — isolation inter-dates + troncature OK\n');
  } catch (e) {
    failed = 1;
    console.error('\n  SELFTEST FAIL:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
  } finally {
    cleanup();
  }
  process.exit(failed);
}
