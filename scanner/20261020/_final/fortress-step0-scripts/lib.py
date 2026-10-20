"""Fortress STEP 0 — helpers de lecture des réponses MCP brutes (aucune valeur saisie à la main)."""
import json, os, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, '..', 'fortress-step0-raw'))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
REFDATE = '2026-10-19'


def rel(path):
    return os.path.relpath(path, REPO)


def load(name):
    with open(os.path.join(RAW, name + '.json')) as f:
        return json.load(f)


def sha(name):
    with open(os.path.join(RAW, name + '.json'), 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def qd_results(env):
    """Retourne results[] d'une réponse QueryData sync ou async (job)."""
    r = env['response']
    if isinstance(r, dict) and 'results' in r:
        return r['results']
    items = (r.get('data') or {}).get('items') or []
    out = []
    for it in items:
        out.extend(it.get('results') or [])
    return out


def qd_rows(env, data_type):
    rows = {}
    for res in qd_results(env):
        if res.get('data_type') != data_type:
            continue
        cells = {c.get('symbol'): c for c in res.get('cells') or []}
        data = res.get('data')
        if isinstance(data, list):
            for row in data:
                sym = row.get('symbol') or row.get('instrument_id')
                rows[sym] = {'row': row, 'cell': cells.get(sym)}
        elif isinstance(data, dict):
            rows['_market'] = {'row': data, 'cell': None}
    return rows


def ema(values, n):
    k = 2 / (n + 1)
    out = []
    e = None
    for i, v in enumerate(values):
        if i < n - 1:
            out.append(None)
            continue
        if e is None:
            e = sum(values[i - n + 1:i + 1]) / n
        else:
            e = v * k + e * (1 - k)
        out.append(e)
    return out


def rsi_wilder(closes, n=14):
    out = [None] * len(closes)
    if len(closes) <= n:
        return out
    gains = [max(closes[i] - closes[i - 1], 0) for i in range(1, len(closes))]
    losses = [max(closes[i - 1] - closes[i], 0) for i in range(1, len(closes))]
    ag = sum(gains[:n]) / n
    al = sum(losses[:n]) / n
    out[n] = 100 - 100 / (1 + ag / al) if al > 0 else 100.0
    for i in range(n + 1, len(closes)):
        ag = (ag * (n - 1) + gains[i - 1]) / n
        al = (al * (n - 1) + losses[i - 1]) / n
        out[i] = 100 - 100 / (1 + ag / al) if al > 0 else 100.0
    return out


def atr_wilder(highs, lows, closes, n=14):
    trs = [highs[0] - lows[0]]
    for i in range(1, len(closes)):
        trs.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    out = [None] * len(closes)
    if len(trs) < n:
        return out, trs
    a =sum(trs[:n]) / n
    out[n - 1] = a
    for i in range(n, len(trs)):
        a = (a * (n - 1) + trs[i]) / n
        out[i] = a
    return out, trs
