#!/usr/bin/env python3
"""Affiche le contexte source de chaque occurrence d'un passage dans les chapitres, avant de le corriger.

Usage : python3 tools/book/ctx.py <dossier_du_livre> "47,6" "kill switch" ...
Sert à appliquer un rapport de relecture : on lit le passage exact dans le HTML (balises et {{bt:…}} compris),
puis on écrit le remplacement avec patch.py."""
import sys, glob, re, os

book, pats = sys.argv[1], sys.argv[2:]
for f in sorted(glob.glob(os.path.join(book, "chapters", "*.html"))) + [os.path.join(book, "cover.html")]:
    if not os.path.exists(f): continue
    s = open(f).read()
    for p in pats:
        for m in re.finditer(re.escape(p), s):
            a = max(0, m.start() - 160); b = min(len(s), m.end() + 200)
            print(f"### {os.path.basename(f)} [{p}]\n{s[a:b]}\n")
