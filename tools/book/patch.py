#!/usr/bin/env python3
"""Corrections sûres dans les chapitres après relecture : remplacement exact, une seule occurrence, sinon refus.

En module :  sys.path.insert(0, "tools/book"); from patch import apply
             apply("chapters/04-vrais-chiffres.html", [("ancien passage exact", "nouveau passage"), ...])
Un remplacement dont l'ancien texte apparaît 0 ou plusieurs fois est refusé (« !! ») et le fichier n'en tient pas compte :
on ne corrige jamais à l'aveugle un passage qu'on n'a pas relu dans son contexte (voir ctx.py)."""
import sys

def apply(path, pairs):
    s = open(path).read(); ok = True
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print(f"!! {path}: {n} occurrence(s) de: {old[:90]!r}"); ok = False; continue
        s = s.replace(old, new)
    open(path, "w").write(s); print("ok" if ok else "partiel", path)
    return ok

if __name__ == "__main__":
    sys.exit("usage : from patch import apply (voir l'en-tête)")
