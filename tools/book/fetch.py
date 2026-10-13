#!/usr/bin/env python3
"""Télécharge des cours quotidiens (Yahoo Finance via yfinance, ajustés des dividendes) avec leur provenance.

Usage : python3 tools/book/fetch.py <dossier_data> --end AAAA-MM-JJ TICKER[::Nom] ...
Écrit <dossier_data>/<TICKER>.csv (^ → IDX_, = → _) et complète <dossier_data>/provenance.json : nom, fichier,
première et dernière date, nombre de séances, séances à clôture identique (cours figés possibles), date d'extraction.
--end est EXCLU par yfinance : passer le lendemain de la dernière séance voulue, et le noter dans le livre.
yfinance est un outil non officiel : usage personnel et ponctuel ; les cours appartiennent à leur fournisseur."""
import argparse, json, pathlib, datetime, warnings
warnings.filterwarnings("ignore")
import pandas as pd, yfinance as yf

ap = argparse.ArgumentParser(); ap.add_argument("data_dir"); ap.add_argument("--end", required=True); ap.add_argument("--start", default="1900-01-01")
ap.add_argument("--raw", action="store_true", help="cours non ajustés (auto_adjust=False)"); ap.add_argument("tickers", nargs="+")
a = ap.parse_args()
D = pathlib.Path(a.data_dir); D.mkdir(parents=True, exist_ok=True)
pp = D / "provenance.json"
prov = json.load(open(pp)) if pp.exists() else {"source": f"Yahoo Finance via yfinance {yf.__version__}", "series": {}}
for item in a.tickers:
    t, _, name = item.partition("::")
    try:
        df = yf.download(t, start=a.start, end=a.end, interval="1d", progress=False, auto_adjust=not a.raw)
        if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"])
        if not len(df): prov["series"][t] = {"name": name, "status": "VIDE"}; print(t, "VIDE"); continue
        fn = t.replace("^", "IDX_").replace("=", "_") + ".csv"; df.to_csv(D / fn)
        frozen = int((df["Close"].diff() == 0).sum())
        prov["series"][t] = {"name": name or prov["series"].get(t, {}).get("name", ""), "file": fn, "first": str(df.index[0].date()), "last": str(df.index[-1].date()),
                             "rows": len(df), "seances_cloture_identique": frozen, "auto_adjust": not a.raw,
                             "extrait_le": datetime.date.today().isoformat(), "fin_demandee_exclue": a.end}
        print(f"{t:12s} {df.index[0].date()} → {df.index[-1].date()} {len(df):6d} séances, {frozen} clôtures identiques")
    except Exception as e:
        prov["series"][t] = {"name": name, "status": "ERREUR " + str(e)[:120]}; print(t, "ERREUR", str(e)[:100])
json.dump(prov, open(pp, "w"), ensure_ascii=False, indent=1)
