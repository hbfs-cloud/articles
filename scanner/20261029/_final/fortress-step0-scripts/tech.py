"""Techniques par survivant, calculées depuis les barres complètes (bars_daily completed_only) au 2026-10-28 (REFDATE)."""
import json, sys
from lib import *

out = {}
for name in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('21_bars300_')):
    env = load(name)
    for sym, v in qd_rows(env, 'bars_daily').items():
        row, cell = v['row'], v['cell'] or {}
        bars = [b for b in row.get('bars') or [] if b[0] <= REFDATE]
        rec = {
            'source_file': rel(os.path.join(RAW, name + '.json')),
            'cell_status': cell.get('status'), 'row_status': row.get('status'),
            'served_completed_end': row.get('served_completed_end'),
            'expected_completed_end': row.get('expected_completed_end'),
            'sessions_complete': row.get('sessions_complete'),
            'missing_ranges': (row.get('coverage') or {}).get('missing_ranges'),
            'n_bars': len(bars),
        }
        if not bars or row.get('served_completed_end') != REFDATE:
            rec['error'] = 'barres non certifiées au ' + REFDATE
            out[sym] = rec
            continue
        d = [b[0] for b in bars]; o = [b[1] for b in bars]; h = [b[2] for b in bars]
        l = [b[3] for b in bars]; c = [b[4] for b in bars]; vol = [b[5] for b in bars]
        e20, e50, e200 = ema(c, 20), ema(c, 50), ema(c, 200)
        rsi = rsi_wilder(c, 14)
        atr, trs = atr_wilder(h, l, c, 14)
        n = len(c) - 1
        def rising(series, lb=5):
            return series[n] is not None and series[n - lb] is not None and series[n] > series[n - lb]
        avg50 = sum(vol[n - 50:n]) / 50 if len(vol) > 50 else None  # 50 séances AVANT la dernière
        move = c[n] - c[n - 1]
        # volume anormal sur les 5 dernières séances (vol > 3x moy50 précédente ou |move| > 2 ATR)
        abn = []
        for k in range(n - 4, n + 1):
            a50 = sum(vol[k - 50:k]) / 50
            mv = c[k] - c[k - 1]
            atrk = atr[k - 1]
            flags = []
            if vol[k] > 3 * a50: flags.append(f'volume {vol[k]/a50:.2f}'.replace('.', ',') + ' × moy50')
            if atrk and abs(mv) > 2 * atrk: flags.append(f'variation {mv/atrk:+.2f}'.replace('.', ',') + ' ATR')
            if flags: abn.append({'date': d[k], 'flags': flags, 'close': c[k], 'volume': vol[k]})
        # consolidation : nb de séances consécutives (jusqu'à refdate) au-dessus de l'EMA50
        above50 = 0
        for k in range(n, 0, -1):
            if e50[k] is not None and c[k] > e50[k]: above50 += 1
            else: break
        # supports : plus bas des 10 et 20 dernières séances (hors séance du jour)
        low10 = min(l[n - 10:n]); low20 = min(l[n - 20:n])
        high20 = max(h[n - 20:n + 1]); high60 = max(h[n - 60:n + 1]); high250 = max(h[max(0, n - 250):n + 1])
        rec.update({
            'date': d[n], 'close': c[n], 'ema20': e20[n], 'ema50': e50[n], 'ema200': e200[n],
            'rsi14': rsi[n], 'atr14': atr[n], 'ext_ema20_pct': (c[n] / e20[n] - 1) * 100,
            'stack': e20[n] > e50[n] > e200[n] if e200[n] else None,
            'ema20_rising': rising(e20), 'ema20_5ago': e20[n - 5], 'ema50_5ago': e50[n - 5], 'ema200_5ago': e200[n - 5], 'ema50_rising': rising(e50), 'ema200_rising': rising(e200),
            'avg_volume_50': avg50, 'volume_last': vol[n], 'last_move_atr': move / atr[n - 1] if atr[n - 1] else None,
            'abnormal_last5': abn, 'sessions_above_ema50': above50,
            'low10': low10, 'low20': low20, 'high20': high20, 'high60': high60, 'high250': high250,
            'first_bar': d[0],
        })
        rec['ema_stack_rising'] = bool(rec['stack'] and rec['ema20_rising'] and rec['ema50_rising'] and rec['ema200_rising'])
        out[sym] = rec

json.dump(out, open(os.path.join(HERE, '..', 'fortress-step0-derived-technicals.json'), 'w'), indent=1)
for s, r in sorted(out.items()):
    if 'error' in r:
        print(s, r['error'], r['served_completed_end']); continue
    print(f"{s:5} n={r['n_bars']} c={r['close']:.2f} e20={r['ema20']:.2f} e50={r['ema50']:.2f} e200={r['ema200']:.2f} rsi={r['rsi14']:.1f} atr={r['atr14']:.2f} ext={r['ext_ema20_pct']:+.2f}% stack={r['stack']} rise={r['ema20_rising']},{r['ema50_rising']},{r['ema200_rising']} abn={[(a['date'],a['flags']) for a in r['abnormal_last5']]} miss={len(r['missing_ranges'] or [])} cell={r['cell_status']}")
