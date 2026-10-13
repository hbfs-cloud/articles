#!/usr/bin/env python3
"""Aperçus PNG des pages d'un livre, pour le contrôle visuel (Read sur les images) et pour la relecture design.

Usage : python3 tools/book/previews.py <book.pdf> [--pages 1,2,37] [--dpi 80] [--out DOSSIER]
Sans --pages : couverture, sommaire, première page de chaque partie et de chaque chapitre (titre ≥ 20 pt),
pages contenant une figure ou un tableau (échantillon), dernière page. Sortie : previews/pNNN.png."""
import argparse, pathlib, fitz

ap = argparse.ArgumentParser()
ap.add_argument("pdf"); ap.add_argument("--pages"); ap.add_argument("--dpi", type=int, default=80); ap.add_argument("--out")
args = ap.parse_args()
pdf = pathlib.Path(args.pdf).resolve(); doc = fitz.open(str(pdf)); n = doc.page_count
out = pathlib.Path(args.out).resolve() if args.out else pdf.parent / "previews"
out.mkdir(parents=True, exist_ok=True)
for f in out.glob("p*.png"): f.unlink()
if args.pages:
    want = sorted({int(x) for x in args.pages.split(",") if x.strip()})
else:
    want = {1, 2, 3, n}
    figs = []
    for i, pg in enumerate(doc):
        big = max((s["size"] for b in pg.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]), default=0)
        if big >= 20: want.add(i + 1)                       # ouverture de partie ou de chapitre
        elif pg.get_drawings() and len(pg.get_drawings()) > 40: figs.append(i + 1)  # figure vectorielle ou tableau dense
    want |= set(figs[::max(1, len(figs) // 12)])
    want = sorted(want)
for p in want:
    if 1 <= p <= n: doc[p - 1].get_pixmap(dpi=args.dpi).save(str(out / f"p{p:03d}.png"))
print(f"{len(want)} aperçus dans {out} : {want}")
