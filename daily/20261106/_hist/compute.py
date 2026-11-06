# Jours de clôture du QQQ à -5 % ou pire depuis mars 1999 et ce qui a suivi.
# Écart au plus-haut mesuré sur l'historique disponible (moins d'un an avant mars 2000).
# Entrée : qqq_bars_adjusted.json (QueryData bars_daily, adjusted=true, 1999-03-10 -> 2026-11-04,
# collecté le 5 novembre 2026 par fenêtres de trois ans) + séance du 5 novembre lue dans le socle
# certifié du daily (_data/bars_indices.json, clôtures brutes des 4 et 5 novembre).
import json, hashlib, statistics as st, os
H = os.path.dirname(os.path.abspath(__file__))
b = json.load(open(os.path.join(H, 'qqq_bars_adjusted.json')))
d = [x['date'] for x in b]; c = [x['adj_close'] for x in b]
soc = json.load(open(os.path.join(H, '..', '_data', 'bars_indices.json')))
def find(o):
    if isinstance(o, dict):
        if o.get('symbol') == 'QQQ' and isinstance(o.get('bars'), list): return o['bars']
        for v in o.values():
            r = find(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = find(v)
            if r: return r
q = find(soc); assert q[-1][0] == '2026-11-05' and q[-2][0] == '2026-11-04'
today = q[-1][4] / q[-2][4] - 1
ev = []
for i in range(1, len(c)):
    r = c[i] / c[i-1] - 1
    if r <= -0.05:
        f = lambda k: (c[i+k] / c[i] - 1) if i + k < len(c) else None
        ev.append(dict(date=d[i], ret=r, dd_before=c[i-1] / max(c[max(0, i-252):i]) - 1, f21=f(21), f63=f(63), f252=f(252),
                       low63=(min(c[i:i+64]) / c[i] - 1) if i + 63 < len(c) else None, i=i))
eps = []; last = None
for e in ev:
    if last is None or e['i'] - last > 30: eps.append(e)
    last = e['i']
for e in eps:
    e['second_within_30'] = any(0 < x['i'] - e['i'] <= 30 for x in ev)
by_year = {}
for e in ev: by_year[e['date'][:4]] = by_year.get(e['date'][:4], 0) + 1
med = lambda k: st.median([e[k] for e in eps if e[k] is not None])
cnt = lambda k, pos: sum(1 for e in eps if e[k] is not None and (e[k] > 0) == pos)
out = dict(
    method='Clôtures ajustées du QQQ ; jour retenu si la clôture perd 5 % ou plus sur la veille ; épisode = premier de ces jours après au moins 30 séances sans ; 21, 63 et 252 séances après ; plus-bas des 63 séances suivantes rapporté à la clôture du jour.',
    input_sha256=hashlib.sha256(open(os.path.join(H, 'qqq_bars_adjusted.json'), 'rb').read()).hexdigest(),
    first_date=d[0], last_date=d[-1], sessions=len(d) + 1,
    today=dict(date='2026-11-05', ret=today, prev_close=q[-2][4], close=q[-1][4]),
    days_count=len(ev), days_by_year=by_year, last_day_before=ev[-1]['date'],
    episodes=[{k: v for k, v in e.items() if k != 'i'} for e in eps],
    stats=dict(n=len(eps), f21_median=med('f21'), f21_down=cnt('f21', False), f63_median=med('f63'),
               f252_median=med('f252'), f252_up=cnt('f252', True), low63_median=med('low63'),
               second_within_30=sum(e['second_within_30'] for e in eps)),
    worse_since=max(e['date'] for e in ev if e['ret'] <= today) if any(e['ret'] <= today for e in ev) else None)
json.dump(out, open(os.path.join(H, 'qqq_minus5_days.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in out.items() if k not in ('episodes',)}, ensure_ascii=False, indent=1))
print([(e['date'], round(e['dd_before']*100,1), e['second_within_30']) for e in eps])
