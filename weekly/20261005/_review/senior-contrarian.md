# Weekly 20261005 — Senior QA + Contrarian

Snapshot relu, sans nouveau fetch : article `01c436992d5c443972522f30f7d767783f40359c721bbb47df06d1770d7783f4`.
Socle `e4578b968a82a30bb411c083764f56157d3a79c6409880923763c620471fba1f`.
Focus `8e95d884f6e030a5fefed69696eac85ac5c91c9b0183a291f646a1034c3ceaff`.
Sélection `1ac4239a40061998574889780d3ff9435a7c00419c8d634d5349ecd64397ea03`.
Claims `f590a448766187c5b2a67c3fc96abfe97926e70bdcfaa29098e7a7aa502f848b`, et ce hash d’article y est recopié.
Clôture de référence : vendredi 2026-10-02. Base de semaine : vendredi 2026-09-25.
Reviewers : Camille Fournier (Senior QA), Théo Lambert (Contrarian).

## Senior QA
- Schéma : 18 sections, 10 ECharts, FAB, brand-bar, footer, tags, GTM, `report.css`, `core.js`, `tag-renderer.js`. PASS.
- Preuves : `validate-content-claims` PASS, 154 claims. Fraîcheur socle et focus PASS. Les deux run-plans PASS. Horizon PASS (IPC le 14 octobre, décision de taux le 28 octobre, PPI non nommé). `qa-content --strict` 22/0/0. `check-ai-tells --strict` sans tic. Hiérarchie PASS. Taille 39,7 Ko.
- Arithmétique : les variations partent de la clôture du 2026-09-25 et finissent au 2026-10-02, barres `completed_only`. Le S&P à −0,2 %, la technologie à +1,8 % et les services collectifs à +0,8 % sont les deux seuls grands secteurs verts. La santé à −2,6 % est bien la dernière. PASS.
- Corrections déjà dans ce snapshot, rejouées avec les gates : l’allocation ne dit plus que la technologie est seule à avoir gagné ; le superlatif d’intérêt vendeur est borné aux relevés du dossier ; la ligne NVR ne décrit plus un stock de terrains absent du snapshot ; le scénario baissier ne donne un allègement qu’après confirmation de jeudi ; le compte rendu n’affirme pas des désaccords non lus ; les scénarios ne sont plus appelés des probabilités.
- Catalyseur : le filtre systémique est vide, le leader est le compte rendu du 7 octobre 14h00 New York, l’occurrence en double est comptée une fois. PepsiCo reste la plus grosse publication du calendrier filtré, pas une mégacapitalisation. PASS.
- Limites déclarées et tenues : intérêt vendeur arrêté au 15 septembre, shelf Delta sans montant résiduel, chiffres macro passés non qualifiés contre le consensus, cotes de prédiction hors Fed. PASS.

## Contrarian
- La vente de durée est mesurée, pas racontée : obligations longues, or, argent, banques, logement et or producteur baissent ensemble, le pétrole non, la technologie tient. Le `no_setup` suit. Entrer lundi achèterait le texte de mercredi.
- « Ne monte pas » sur le comptant de volatilité correspond au booléen `vix_rising: false`, avec 15,31 sous la moyenne 15,72. Le booléen n’est pas imprimé ; les deux niveaux le sont. Pas un choc de volatilité.
- Le couple 0,57 % de rendement attendu contre 2,78 % de drawdown attendu est une sortie de modèle, et la page le dit. Ce n’est pas un fait de marché.
- Constellation à 5,4 % du flottant est le plus haut des relevés du dossier. PepsiCo à 1,9 % est le seul autre pourcentage imprimé. Delta, à 4,0 % sur le même règlement, n’est pas affiché. Le superlatif reste vrai sur les relevés collectés. Ce n’est pas un squeeze.
- Le shelf Delta du 10 juillet 2026 est une capacité ouverte, pas une dilution constatée. Le 25-NSE PepsiCo n’est pas lu comme une radiation : le titre a des barres jusqu’au 2 octobre. Aucun nom de président de la Fed.
- Toll Brothers reste étiqueté « haut de gamme ». C’est le motif du lien, pas une mesure. Ça ne déplace ni un chiffre ni un ordre.
- Le discours de Christopher Waller à 04h30 heure de New York le 8 octobre est l’heure de la source. Elle est inhabituelle, elle n’est pas inventée.

## Verdict : PASS — zéro blocker.
