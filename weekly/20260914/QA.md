# Weekly 14–18 septembre 2026 — livraison

**PASS local avec limites documentées.** Clôture de référence : 11 septembre. Aucun trade validé (`no_setup`). Publication autorisée par l’utilisateur ; aucune notification à des tiers.

## Validation

- Socle gouvernant : 13 sources, plan et fraîcheur PASS. Focus : 11 sources, plan et fraîcheur PASS. Le contexte optionnel `overview` déprécié ne gouverne aucun chiffre.
- 42 claims : valeur, pointeur, empreinte et rendu validés. Les données des graphiques sont calculées par `_build.cjs` à partir des sources conservées ; huit empreintes d’entrées vérifiées.
- `validate-content-claims`, `check-ai-tells --strict`, `validate-horizon-risk`, `validate-content-hierarchy` : PASS.
- `qa-content --strict` : 20 contrôles PASS, aucune erreur, un avertissement `min-size` assumé. La page fait 28 950 octets, 19 sections, 2 106 mots, sans paragraphe répété. La dérogation du mécanisme existant `.qa-content-waivers.json` cible exclusivement le proxy de taille pour cette édition. Aucun contrôle de données n’est dispensé.
- Sept ECharts rendus et exportés sans canvas vide : `_img/charts.json`. Captures desktop 1440 px et mobile 390 px : `_review/`. Aucun débordement, erreur JavaScript, titre hors écran ou ancre cassée. Tables adaptées ; menu ouvre et ferme aux deux tailles. Le premier test mobile cliquait pendant l’animation ; le test stabilisé est PASS.
- Senior QA par le principal, Contrarian par le worker rétro, Retail par le rédacteur initial après l’intégration du principal : revues du même snapshot final, sans refetch séparé. Détails et limites de rôle dans `_review/reviews.json`, empreintes dans `_review/snapshot.json`.

## Arbitrages de sources

- Trip.com : mardi 15 septembre après clôture selon le dépôt SEC, contre BMO dans le calendrier agrégé.
- PPI : publication août le 10 septembre selon le BLS, contre entrée agrégée erronée le 14 ; elle est exclue de la semaine à venir.
- ZEW : mardi 15 à 11 h 05 Paris selon le calendrier officiel, contre 11 h dans l’agrégateur.
- La décision Fed et sa conférence sont deux rendez-vous ; le doublon de la décision est éliminé. Les sources officielles sont conservées dans `_data/primary-calendar.json` et liées dans l’article.
- Les options de TCOM/LEN expirent le 18 septembre, après leurs publications ; l’amplitude de LEN comprend notamment macro, Fed et résultats. Aucun mouvement futur garanti n’est inféré.

## Limites

Le panorama de prix couvre les ETF américains collectés ; Europe et Asie ne sont pas couvertes quantitativement. Le bilan de l’hypothèse Oracle de l’édition précédente reste non évalué, faute de barres correspondantes. Les deux calendriers agrégés bruts et la sélection initiale sont conservés intacts, avec corrections primaires séparées. Les rendements hebdomadaires comparent le 4 au 11 septembre, soit quatre séances après Labor Day, et excluent distributions/frais.

## Reproduction

Depuis la racine : `node weekly/20260914/_build.cjs`, puis les gates du runbook Weekly. Les graphiques s’exportent avec `node tools/render-charts-png.js --article weekly/20260914/index.html --out weekly/20260914/_img`. Le renderer est borné à cette édition ; aucune refonte des outils globaux n’a été engagée.
