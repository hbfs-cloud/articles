---
name: livre-investir-halal
description: 2026-10-10 — livre PDF « Investir halal, sans se raconter d'histoires » publié sur /series/livre-investir-halal/ (141 p.) ; carte livre avec bouton de téléchargement via balises dt:download ; nouvelle édition = rebuild depuis .agent/livre-halal/ + add_card.
metadata:
  type: project
---

# Livre « Investir halal, sans se raconter d'histoires » (édition d'octobre 2026)

Publié le 10 octobre 2026 (commit 755a7dd48) sur `series/livre-investir-halal/` : PDF de 141 pages
(17 chapitres + 4 annexes), couverture, et `investir-halal-scripts.zip` (téléchargement des cours,
réparation des cours figés, tous les tests, `results.json`), qui reproduit les chiffres à l'identique.

**Carte « Livre » dans l'onglet Séries.** `tools/gen-series-catalog.js` lit, sur la page racine d'une
série, `<meta name="dt:download">` (fichier existant sous `/series/<slug>/`, .pdf/.epub/.zip),
`dt:download-label`, `dt:download-meta`, `dt:kind`, et ajoute `download` + `kind` à l'entrée du catalogue.
`seriesCatalogCard()` (index.html) rend alors un bouton « Télécharger » principal et un lien
« Présentation et sommaire ». Aucune autre série n'est touchée.

**Why:** l'utilisateur voulait le PDF en ligne avec un lien de téléchargement bien visible dans
`?tab=series`. Le carrousel Séries est rendu depuis `series-catalog.json`, pas depuis `series.json` :
modifier la carte de `series.json` n'aurait rien changé à l'écran.

**How to apply:** nouvelle édition → sources dans `.agent/livre-halal/` (non versionné) :
`cd bt && python3 backtests.py && python3 refs_annex.py && cd .. && python3 build.py --pdf`, copier
`book.pdf`, régénérer `couverture.png`, mettre à jour le nombre de pages (texte + `dt:download-label`),
puis `node tools/add_card.js series/livre-investir-halal/index.html`. Chiffres uniquement depuis
`results.json` ou une source nommée et datée ; aucun jargon interne.
