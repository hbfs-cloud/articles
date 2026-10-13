#!/usr/bin/env python3
"""Briques de backtest d'un livre : chaque chiffre publié sort d'UN script (bt/backtests.py) qui écrit bt/results.json.

    import sys; sys.path.insert(0, "<repo>/tools/book"); from stats import *
    s = load("../data", "ISDW.L"); R["tests"]["x"] = stats(s, "ISDW.L")

Règles de méthode, toutes issues d'erreurs relevées par les relecteurs d'« Investir halal » (octobre 2026) :
1. Un signal constaté à la clôture s'exécute à la clôture SUIVANTE : position = signal.shift(1) appliquée aux
   rendements du lendemain (next_session). Jamais de trade sur la clôture qui a produit le signal.
2. Années civiles : la première ne compte que si la série démarre dans les dix premiers jours de janvier ; la dernière
   est « en cours » si elle s'arrête avant le 20 décembre (exclue des meilleure/pire année). Dire « 13 années sur 18 ».
3. Volatilité annualisée : √252 pour une Bourse, √365 pour ce qui cote le week-end (crypto).
4. Pire recul : valeur ET dates (sommet, creux, retour au sommet) ; c'est la date qui se périme en premier.
5. Cours figés (même clôture plusieurs séances, volume nul) : les détecter (stale_runs) et les réparer depuis une
   autre ligne du même actif, ou exclure la période ; jamais publier un pire recul calculé sur une série figée.
   Même chose pour les cotations aberrantes d'une séance (spikes / repair_spikes), à lister dans l'annexe méthode.
6. Frais : un coût par aller-retour explicite dans chaque règle testée ; un test sans frais est un test faux.
7. Toutes les clés de results.json sont produites par le script : rien d'ajouté à la main, sinon le paquet publié
   ne reproduit pas le livre (relecteur expert : 41 clés dans results.json, 32 produites par le script).
8. Après chaque modification du script : diff des résultats avant/après (diff_results) et relecture de chaque
   phrase qui cite une valeur qui a bougé."""
import math, json, datetime
import pandas as pd, numpy as np

def load(data_dir, ticker, col="Close"):
    fn = ticker.replace("^", "IDX_").replace("=", "_") + ".csv"
    return pd.read_csv(f"{data_dir}/{fn}", index_col=0, parse_dates=True)[col].dropna()

def align(*series):
    df = pd.concat(series, axis=1, join="inner").dropna()
    return [df.iloc[:, i] for i in range(df.shape[1])]

def cagr(s):
    yrs = (s.index[-1] - s.index[0]).days / 365.25
    return (s.iloc[-1] / s.iloc[0]) ** (1 / yrs) - 1

def pct_round(x, n=1):
    """Arrondi qui n'invente jamais une ruine totale : −99,95 % reste −99,95 %, pas −100,0 %."""
    r = round(x, n)
    while abs(r) >= 100 and abs(x) < 100 and n < 6: n += 1; r = round(x, n)
    return r

def drawdown(s):
    """Pire recul avec ses trois dates. recovered=None si le sommet n'est pas encore retrouvé."""
    dd = s / s.cummax() - 1; trough = dd.idxmin(); peak = s[:trough].idxmax()
    after = s[trough:]; rec = after[after >= s[peak]]
    return {"max_dd_pct": pct_round(dd.min() * 100, 1), "peak": str(peak.date()), "trough": str(trough.date()),
            "recovered": str(rec.index[0].date()) if len(rec) else None,
            "recovery_days": (rec.index[0] - peak).days if len(rec) else None}

def calendar_years(s):
    y_end = s.resample("YE").last(); base = y_end.shift(1); base.iloc[0] = s.iloc[0]
    yearly = (y_end / base - 1).dropna()
    if s.index[0] > pd.Timestamp(s.index[0].year, 1, 10): yearly = yearly.iloc[1:]
    partial = s.index[-1] < pd.Timestamp(s.index[-1].year, 12, 20)
    return yearly, (yearly.iloc[:-1] if partial else yearly), partial

def stats(s, label, periods_per_year=252):
    s = s.dropna(); yearly, complete, partial = calendar_years(s)
    out = {"label": label, "from": str(s.index[0].date()), "to": str(s.index[-1].date()),
           "years": round((s.index[-1] - s.index[0]).days / 365.25, 2), "total_return_pct": round((s.iloc[-1] / s.iloc[0] - 1) * 100, 1),
           "cagr_pct": round(cagr(s) * 100, 2), "vol_annual_pct": round(s.pct_change().std() * math.sqrt(periods_per_year) * 100, 1),
           "yearly_pct": {str(k.year): round(v * 100, 1) for k, v in yearly.items()}, "derniere_annee_en_cours": bool(partial),
           "annees_completes": int(len(complete)), "annees_completes_positives": int((complete > 0).sum())}
    out.update(drawdown(s))
    if len(complete):
        out["worst_year"] = {"year": int(complete.idxmin().year), "pct": round(float(complete.min()) * 100, 1)}
        out["best_year"] = {"year": int(complete.idxmax().year), "pct": round(float(complete.max()) * 100, 1)}
    return out

def next_session(signal, prices, cost=0.001):
    """Équité d'une règle long/cash : signal booléen constaté à la clôture t, position prise à la clôture t+1,
    coût `cost` (fraction) à chaque changement de position."""
    pos = signal.astype(float).shift(1).fillna(0.0)
    r = prices.pct_change().fillna(0.0)
    trades = pos.diff().abs().fillna(0.0)
    eq = (1 + pos.shift(1).fillna(0.0) * r - trades.shift(1).fillna(0.0) * cost).cumprod()
    return eq, int(trades.sum())

def stale_runs(s, min_run=3):
    """Périodes où la clôture ne bouge pas pendant au moins min_run séances (cotation figée d'une ligne peu échangée)."""
    same = s.diff() == 0; runs = []; i = 1
    while i < len(s):
        if same.iloc[i]:
            j = i
            while j < len(s) and same.iloc[j]: j += 1
            if j - i + 1 >= min_run: runs.append({"from": str(s.index[i - 1].date()), "to": str(s.index[j - 1].date()), "sessions": j - i + 1})
            i = j
        else: i += 1
    return runs

def spikes(s, thr=0.2):
    """Cotations aberrantes d'une séance : saut de plus de thr suivi le lendemain d'un retour en sens inverse de plus
    de thr (ex. indice PutWrite du CBOE le 13 mars 2020 : +35 % puis −28 %). Renvoie les dates fautives."""
    r = s.pct_change()
    return [d for i, d in enumerate(s.index[1:-1], start=1)
            if abs(r.iloc[i]) > thr and abs(r.iloc[i + 1]) > thr and np.sign(r.iloc[i]) != np.sign(r.iloc[i + 1])]

def repair_spikes(s, thr=0.2):
    """Remplace chaque cotation aberrante par la moyenne géométrique de ses deux voisines ; renvoie (série, liste)."""
    s = s.copy(); bad = spikes(s, thr)
    for d in bad:
        i = s.index.get_loc(d); s.iloc[i] = math.sqrt(s.iloc[i - 1] * s.iloc[i + 1])
    return s, [str(d.date()) for d in bad]

def xirr(cash, dates, final, final_date):
    t = np.array([(d - dates[0]).days / 365.25 for d in dates]); tf = (final_date - dates[0]).days / 365.25
    f = lambda r: np.sum(-np.asarray(cash) / (1 + r) ** t) + final / (1 + r) ** tf
    lo, hi = -0.9, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(mid) > 0: lo = mid
        else: hi = mid
    return mid

def new_results(source):
    return {"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "source": source, "tests": {}}

def diff_results(old_path, new_path, tol=1e-9):
    """Liste les valeurs qui ont bougé entre deux results.json (chemin, ancien, nouveau)."""
    a = json.load(open(old_path)).get("tests", {}); b = json.load(open(new_path)).get("tests", {}); out = []
    def walk(x, y, p):
        if isinstance(x, dict) and isinstance(y, dict):
            for k in sorted(set(x) | set(y)): walk(x.get(k), y.get(k), f"{p}.{k}" if p else k)
        elif isinstance(x, list) and isinstance(y, list) and len(x) == len(y):
            for i, (u, v) in enumerate(zip(x, y)): walk(u, v, f"{p}.{i}")
        elif isinstance(x, (int, float)) and isinstance(y, (int, float)):
            if abs(x - y) > tol: out.append((p, x, y))
        elif x != y: out.append((p, x, y))
    walk(a, b, ""); return out
