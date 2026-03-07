/**
 * Local bar storage — SQLite backend
 * Persists OHLCV bars from Yahoo Finance & Binance locally.
 * Supports CSV export and lightweight Parquet-compatible output.
 *
 * Usage:
 *   import { BarsStorage } from './lib/storage.js';
 *   const storage = new BarsStorage('./data/bars.db');
 *   await storage.save('AAPL', '1d', bars);
 *   const cached = storage.get('AAPL', '1d');
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class BarsStorage {
  constructor(dbPath) {
    const dir = resolve(dbPath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bars (
        symbol    TEXT    NOT NULL,
        source    TEXT    NOT NULL DEFAULT 'yahoo',
        interval  TEXT    NOT NULL,
        time      TEXT    NOT NULL,
        open      REAL,
        high      REAL,
        low       REAL,
        close     REAL,
        volume    REAL,
        adj_close REAL,
        PRIMARY KEY (symbol, source, interval, time)
      );
      CREATE INDEX IF NOT EXISTS idx_bars_sym ON bars(symbol, source, interval, time);

      CREATE TABLE IF NOT EXISTS symbols_meta (
        symbol      TEXT    PRIMARY KEY,
        name        TEXT,
        exchange    TEXT,
        region      TEXT,
        type        TEXT,
        currency    TEXT,
        marketcap   REAL,
        sector      TEXT,
        updated_at  TEXT
      );
    `);
  }

  // ─── Save bars ───────────────────────────────────────────

  save(symbol, interval, bars, source = 'yahoo') {
    if (!bars || !bars.length) return 0;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bars (symbol, source, interval, time, open, high, low, close, volume, adj_close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveMany = this.db.transaction(rows => {
      for (const b of rows) {
        stmt.run(
          symbol.toUpperCase(), source, interval,
          b.time,
          b.open  ?? null,
          b.high  ?? null,
          b.low   ?? null,
          b.close ?? null,
          b.volume ?? null,
          b.adjClose ?? b.adj_close ?? null
        );
      }
    });

    saveMany(bars);
    return bars.length;
  }

  // ─── Retrieve bars ───────────────────────────────────────

  get(symbol, interval = '1d', { source = null, from = null, to = null } = {}) {
    let sql = 'SELECT * FROM bars WHERE symbol = ? AND interval = ?';
    const params = [symbol.toUpperCase(), interval];
    if (source) { sql += ' AND source = ?'; params.push(source); }
    if (from)   { sql += ' AND time >= ?';  params.push(from); }
    if (to)     { sql += ' AND time <= ?';  params.push(to); }
    sql += ' ORDER BY time ASC';
    return this.db.prepare(sql).all(...params);
  }

  // ─── Symbol metadata ─────────────────────────────────────

  saveMeta(meta) {
    this.db.prepare(`
      INSERT OR REPLACE INTO symbols_meta (symbol, name, exchange, region, type, currency, marketcap, sector, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meta.symbol?.toUpperCase(),
      meta.name    ?? null,
      meta.exchange ?? null,
      meta.region  ?? null,
      meta.type    ?? null,
      meta.currency ?? null,
      meta.marketcap ?? null,
      meta.sector  ?? null,
      new Date().toISOString()
    );
  }

  getMeta(symbol) {
    return this.db.prepare('SELECT * FROM symbols_meta WHERE symbol = ?').get(symbol.toUpperCase());
  }

  searchMeta({ region = null, type = null, minMarketcap = null, sector = null } = {}) {
    let sql = 'SELECT * FROM symbols_meta WHERE 1=1';
    const params = [];
    if (region)       { sql += ' AND region = ?';    params.push(region.toUpperCase()); }
    if (type)         { sql += ' AND type = ?';      params.push(type.toUpperCase()); }
    if (sector)       { sql += ' AND sector LIKE ?'; params.push(`%${sector}%`); }
    if (minMarketcap) { sql += ' AND marketcap >= ?'; params.push(minMarketcap * 1e6); }
    sql += ' ORDER BY marketcap DESC';
    return this.db.prepare(sql).all(...params);
  }

  // ─── Latest bar date ─────────────────────────────────────

  latestDate(symbol, interval = '1d', source = null) {
    let sql = 'SELECT MAX(time) AS t FROM bars WHERE symbol = ? AND interval = ?';
    const params = [symbol.toUpperCase(), interval];
    if (source) { sql += ' AND source = ?'; params.push(source); }
    return this.db.prepare(sql).get(...params)?.t ?? null;
  }

  countBars(symbol, interval = '1d') {
    return this.db.prepare('SELECT COUNT(*) AS n FROM bars WHERE symbol = ? AND interval = ?')
      .get(symbol.toUpperCase(), interval)?.n ?? 0;
  }

  // ─── Cleanup ──────────────────────────────────────────────

  /**
   * Delete intraday bars (1m,5m,15m,30m,1h) older than keepDays to limit disk usage.
   * Daily bars are kept forever (they are immutable historical data).
   */
  cleanOldIntraday(keepDays = 7) {
    const intradayIntervals = ['1m','2m','5m','15m','30m','60m','90m','1h','4h'];
    const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
    const stmt = this.db.prepare(
      `DELETE FROM bars WHERE interval = ? AND time < ?`
    );
    let deleted = 0;
    for (const intv of intradayIntervals) {
      const info = stmt.run(intv, cutoff);
      deleted += info.changes;
    }
    return deleted;
  }

  // ─── Statistics ──────────────────────────────────────────

  catalog() {
    return this.db.prepare(`
      SELECT symbol, source, interval,
             COUNT(*) AS bars,
             MIN(time) AS from_date,
             MAX(time) AS to_date
      FROM bars
      GROUP BY symbol, source, interval
      ORDER BY symbol, interval
    `).all();
  }

  storageStats() {
    const barCount    = this.db.prepare('SELECT COUNT(*) AS n FROM bars').get().n;
    const symbolCount = this.db.prepare('SELECT COUNT(DISTINCT symbol) AS n FROM bars').get().n;
    const metaCount   = this.db.prepare('SELECT COUNT(*) AS n FROM symbols_meta').get().n;
    return { barCount, symbolCount, metaCount };
  }

  // ─── Export CSV ───────────────────────────────────────────

  exportCSV(symbol, interval = '1d', outputPath = null) {
    const rows = this.get(symbol, interval);
    if (!rows.length) return null;

    const header = 'date,open,high,low,close,volume,adj_close';
    const lines  = rows.map(r =>
      `${r.time},${r.open ?? ''},${r.high ?? ''},${r.low ?? ''},${r.close ?? ''},${r.volume ?? ''},${r.adj_close ?? ''}`
    );
    const csv = [header, ...lines].join('\n');

    if (outputPath) {
      writeFileSync(outputPath, csv, 'utf8');
      return outputPath;
    }
    return csv;
  }

  // ─── Export Parquet-compatible (NDJSON — readable by DuckDB/Pandas) ──

  exportNDJSON(symbol, interval = '1d', outputPath = null) {
    const rows = this.get(symbol, interval);
    if (!rows.length) return null;

    const ndjson = rows
      .map(r => JSON.stringify({
        date:      r.time,
        open:      r.open,
        high:      r.high,
        low:       r.low,
        close:     r.close,
        volume:    r.volume,
        adj_close: r.adj_close
      }))
      .join('\n');

    if (outputPath) {
      writeFileSync(outputPath, ndjson, 'utf8');
      return outputPath;
    }
    return ndjson;
  }

  // Convert NDJSON to true Parquet via DuckDB if available
  // duckdb -c "COPY (SELECT * FROM read_ndjson('file.ndjson')) TO 'file.parquet' (FORMAT PARQUET)"
  parquetCommand(symbol, interval = '1d') {
    return `duckdb -c "COPY (SELECT * FROM read_ndjson('${symbol}_${interval}.ndjson')) TO '${symbol}_${interval}.parquet' (FORMAT PARQUET)"`;
  }
}

// ─── Singleton factory ───────────────────────────────────

let _instance = null;

export function getStorage(dbPath = null) {
  if (!_instance) {
    const path = dbPath || resolve(__dirname, '../data/bars.db');
    _instance = new BarsStorage(path);
  }
  return _instance;
}
