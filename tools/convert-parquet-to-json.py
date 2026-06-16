#!/usr/bin/env python3
"""Convert Go Parquet OHLCV cache to full-precision JSON for JS backtest parity."""
import json, os, sys, glob
import pyarrow.parquet as pq

PARQUET_DIR = '/Users/marketwatchxyz/GolandProjects/systematic-tss/cache/yahoo/2026-06-11/1d'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'cache', 'ab-ohlcv-parquet')

os.makedirs(OUT_DIR, exist_ok=True)

files = sorted(glob.glob(os.path.join(PARQUET_DIR, '*.parquet')))
print(f'Converting {len(files)} parquet files to {OUT_DIR}')

converted = 0
for f in files:
    ticker = os.path.basename(f).replace('.parquet', '')
    try:
        df = pq.read_table(f).to_pandas()
        bars = []
        for _, row in df.iterrows():
            d = str(row['date'])[:10]
            o, h, l, c = float(row['open']), float(row['high']), float(row['low']), float(row['close'])
            ac = float(row['adj_close']) if 'adj_close' in df.columns else c
            v = int(row['volume']) if row['volume'] == row['volume'] else 0
            if o > 0 and h > 0:
                bars.append({'d': d, 'o': o, 'h': h, 'l': l, 'c': c, 'ac': ac, 'v': v})
        out_path = os.path.join(OUT_DIR, f'{ticker}.json')
        with open(out_path, 'w') as fp:
            json.dump(bars, fp, separators=(',', ':'))
        converted += 1
    except Exception as e:
        print(f'  SKIP {ticker}: {e}', file=sys.stderr)

print(f'Done: {converted}/{len(files)} converted')
