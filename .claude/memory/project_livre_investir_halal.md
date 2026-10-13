---
name: livre-investir-halal
description: 2026-10-10 — livre PDF « Investir halal, sans se raconter d'histoires » publié sur /series/livre-investir-halal/ (141 p.) ; carte livre avec bouton de téléchargement via balises dt:download ; méthode généralisée le 2026-10-13 en skill livre-pdf + kit tools/book/ (livres et livres blancs).
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

**Méthode réutilisable (2026-10-13).** Tout le procédé (inventaire des séries, backtests, faits datés,
relectures adverses, design, paquet, publication) est le skill `.claude/skills/livre-pdf/SKILL.md`, avec
le kit `tools/book/` (build.py, checks.py, stats.py, frfig.py, gabarits de livre et de livre blanc).
Le kit reconstruit l'édition 1.0 à l'identique (141 p., texte identique page par page).

**Édition 1.1 (13 octobre 2026, commit 4bcdd12af, 142 p.)** : huit schémas redessinés (texte à 8,6 pt imprimés
au lieu de 6,8-7,8 ; `bt/diagrams.py` à corps 13,2 unités, l'ancien gardé en `diagrams.v1.0.py`), six termes expliqués
à leur première apparition, historique des éditions en annexe C ; `checks.py --strict` : 0 bloquant, 0 majeur.
PDF en ligne vérifié octet pour octet. Pas de notification Telegram pour cette correction typographique.

**Édition 1.2 (13 octobre 2026, commit 9e3615fc6, 144 p.)** : carnets du site présentés comme portefeuilles modèles
(sans argent engagé), totaux « à mise fixe » (gains non réinvestis, convention de `tools/lib/mode-stats.js`), carnet C
corrigé (94 trades, 47,9 %, total gonflé par 23 trades comptés à 100 % alors que trois tournaient en même temps).
`book.extra.css` remet `break-inside: auto` sur les tableaux : la règle du kit qui rend insécable tout tableau de
8 lignes au plus laissait des demi-pages blanches sur ce livre à longues cellules (148 p. au lieu de 142).
Publiée avec « Investir en bon père de famille » (`series/livre-bon-pere-de-famille/`, 81 p.) et « Jouer gros sans se
ruiner » (`series/livre-jouer-gros/`, 85 p.) ; sources `.agent/livre-pere-famille/` et `.agent/livre-agressif/`,
publication par `.agent/livres-communs/publier_livres.py [agressif|pere|halal]`. Telegram `learning` 2099.

**How to apply:** nouvelle édition → sources dans `.agent/livre-halal/` (non versionné, `book.json` présent) :
`cd bt && python3 backtests.py && python3 refs_annex.py && cd ../../.. && python3 tools/book/build.py .agent/livre-halal --pdf && python3 tools/book/checks.py .agent/livre-halal --strict`, copier
`book.pdf`, régénérer `couverture.png`, mettre à jour le nombre de pages (texte + `dt:download-label`),
puis `node tools/add_card.js series/livre-investir-halal/index.html`. Chiffres uniquement depuis
`results.json` ou une source nommée et datée ; aucun jargon interne.

**Livre « 2 063 signaux » (13 octobre 2026, commit e12f90bb5).** Livre phare tiré de l'historique du dépôt (« un truc qui tape ») : chaque ligne publiée par le scanner du 15 février au 13 octobre 2026 rejouée sur les cours. Sources `.agent/livre-signaux/` (registre `bt/registre.cjs`, mesures `bt/mesure.cjs`, chiffres `bt/backtests.py` → `results.json`), publié sur `/series/livre-2063-signaux/` (69 p.). Conclusions qui tiennent après deux tours de relecture : idées du jour −0,21 %/trade contre +0,63 % pour l'indice (retard démontré seulement avec la règle sévère), fiches un peu meilleures mais à la limite du hasard et tenues par juin 2026. Éditeur « DailyTickers, articles.dailytickers.com », pas de déclaration d'intérêts (choix de l'utilisateur). Deux pièges de kit corrigés dans `tools/book/build.py` : la fourchette « X à X » coupait un intervalle symétrique, le signe moins des textes bruts changeait « au-dessus ».
