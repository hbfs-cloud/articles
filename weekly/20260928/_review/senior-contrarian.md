# Weekly 20260928 — Senior QA + Contrarian

Snapshot : socle `weekly/20260928/_data` + focus `weekly/20260928/_focus`, clôture de référence 2026-09-25.
Article : `weekly/20260928/index.html`. Reviewers : Camille Fournier (Senior QA), Théo Lambert (Contrarian).

## Senior QA
- Schéma : 18 sections présentes (verdict → sources), FAB, brand-bar, footer, tags, GTM, scripts core/tag-renderer. PASS.
- Preuves : `validate-content-claims` PASS (77 claims liés à un artefact haché + pointeur JSON ; littéraux déclarés). Aucune valeur numérique non liée. PASS.
- Arithmétique : les performances hebdomadaires partent de la clôture du 2026-09-18 et finissent au 2026-09-25 (barres certifiées `completed_only`). Recalcul cohérent avec les séries. PASS.
- Graphiques : 10 ECharts, mêmes séries que le texte via le registre `CHART_SPECS`, aucune saisie parallèle. PASS.
- QA/anti-IA : `qa-content --strict` 22/0/0 ; `check-ai-tells --strict` sans tic ; taille 35,1 Ko > seuil. PASS.
- Régression : régime lu au bon pointeur (`facets/regime/dtx_regime`), VIX 14,82 sous SMA 15,93. PASS.

## Contrarian
- event_leader MU : honnête. MU est le seul nom du filtre systémique ; son amplitude implicite est ABSENTE du calendrier d'options collecté et n'est PAS inventée — le dossier l'indique explicitement (alerte données + section Résultats + Sources PARTIEL). La table earnings ne liste que les publications datées (ACN, NKE, JBL, CCL, MKC, JEF, FDS), avec leurs amplitudes réelles. Pas de sur-affirmation.
- Cadre macro : la semaine est correctement présentée comme dominée par la macro (PCE, ISM, NFP), MU en single-name. Aucune prévision calibrée présentée ; probabilités qualitatives déclarées comme telles.
- Blast radius : chaîne mémoire/IA cohérente économiquement (pairs mémoire vs clients aval). Corrélation ≠ lien commercial rappelé implicitement par la séparation des rôles.
- Verdict : « attendre la confirmation » — conservateur, aligné sur le risque événementiel réel de fin de semaine. Pas de claim plus fort que la preuve.

## Verdict : PASS — zéro blocker.
