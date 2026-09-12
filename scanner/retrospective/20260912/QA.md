# Rétrospective scanner — référence US 11 septembre 2026

## Verdict QA

**PASS pour la publication documentaire de couverture.** La page place dès le hero une alerte de
couverture incomplète, identifie sans ambiguïté les statistiques comme un sous-ensemble de 16
résultats sur 56 propositions, et ne donne ni note ni conclusion sur le scanner.

**BLOCKED pour un verdict de performance de cohorte.** La page et ce QA conservent la cohorte,
les résultats observables et les limites de preuve ; ils ne transforment pas les données manquantes
en gains ou pertes.

La plage retenue est les trois dernières semaines de séances terminées: du 24 août au 11 septembre
2026. Les six scans de trading certifiés sont 20260824, 20260825, 20260827, 20260828, 20260831 et
20260901. Le calcul utilise les scans du 24 août au 1 septembre; le 11 septembre est la clôture de
référence.

## Cohorte immuable

- 56 propositions de trading certifiées, 49 tickers uniques, six scans.
- Les horizons publiés sont enregistrés dans
  [_data/cohort-reconciliation.json](./_data/cohort-reconciliation.json) avant tout calcul.
- Les huit enregistrements du 8 septembre restent conservés séparément comme review_only, sans
  ordre certifié. Ils ne sont pas retirés de l'historique et ne sont pas introduits dans le
  dénominateur de trading.
- Les absences de 5 et 6 septembre sont le week-end, le 7 septembre est Labor Day. Le 8 septembre
  est le produit de surveillance review_only; aucun scan fermé n'est inventé.

## Contrôles passés

| Contrôle | Résultat | Preuve |
|---|---|---|
| Contrat rétro | PASS | node tools/validate-workflows.js --workflow retro |
| Parseur 15 minutes | PASS | node tools/test-intraday-retro-input.js |
| Collecte execution truth | PASS | six harnesses sous _data/collections-v2 |
| Reconciliation | PASS | 56 signaux des six dossiers, manifest de cohorte |
| Rendu générique | PASS | index.html et retro-results.json sous ce dossier |
| Structure publication | PASS | node tools/validate-article.js scanner/retrospective/20260912/index.html (18,3 KB, 6 sections) |
| Marquage publication | PASS | hero d’alerte, chrome DailyTickers, GTM, tags et retrait du lien privé vérifiés localement |

Les six collections courantes ont leur propre plan hashé et leur propre harness. Les tentatives
précédentes restent conservées dans collections-v2-attempt1 et collections-v2-attempt2. La
collection historique initiale sous collections/20260824 reste inchangée.

Le contrôle global npm run test:content-ux reste en échec avant la revue de cette rétro, sur
tech/track-record/index.html et son runtime tech absent ou non cache-busted. Le contrôle navigateur Chrome du snapshot final passe à 1440 et 390 pixels : zéro débordement, erreur JS ou ancre cassée, tables défilables et paragraphes de 16px. Le défaut UX global ne vise aucun fichier de cette rétrospective.

## Limite bloquante

La règle de calcul exige 26 barres 15 minutes RTH par séance US. Neuf lignes arrivées à horizon
n'ont pas cette couverture:

- Scan 25 août: NU, PCG, KDP et NUE.
- GLEN.L: cotation non-US sans contrat intraday de calendrier de marché certifié. Elle reste dans
  le dénominateur comme donnée indisponible; aucun filtre d'horaires New York ne lui est appliqué.
- Scan 27 août: CDE, KDP, PCG et NU.

Vingt-sept horizons ne sont pas encore mûrs à la référence. Vingt-et-une de ces lignes sont
open_unverified, car la couverture 15 minutes jusqu'au 11 septembre manque. Elles restent
distinctes des résultats clos et n'entrent dans aucun hit rate, R moyen ou profit factor.

Le probe isolé et lecture seule `_data/gap-probe-20260912.json` confirme la limite fournisseur :
NU, PCG, KDP, NUE et CDE s’arrêtent encore le 10 septembre vers 15:38Z avec neuf barres RTH,
puis zéro le 11, malgré une pagination terminale et le statut `completed`. Le diagnostic détaillé
est conservé dans `.agent/retro-gap-diagnosis.md`; aucune correction locale n’est possible.

Le sous-ensemble mesuré, exclusivement diagnostic, contient 16 fills résolus: quatre TP1 ou mieux,
douze stops, hit rate 25 %, R moyen -0,365 et profit factor 0,55. Ces chiffres ne sont pas une
performance de la cohorte de 56 et ne supportent aucun verdict.

## Corpus de risques courant

SEC, événements, actualités, analystes et initiés sont collectés après la période dans une vague
détachée. Ils sont non point-in-time et ne peuvent pas modifier fills, sorties, sélection ou
performance. Aucun enregistrement de risque n'est cité dans le rapport. Les résultats disponibles,
les indisponibilités et les empreintes sont consignés dans
[_data/current-risk-corpus-limits.json](./_data/current-risk-corpus-limits.json).

## Suites requises

Pour lever le blocage, il faut une source 15 minutes complète et certifiée pour chaque séance US
manquante, plus un contrat intraday propre au marché de GLEN.L. Sans ces preuves, le rapport reste
une archive de cohorte et de résultats partiels, pas une publication de performance.

## Snapshot final de publication

- QA coverage_review : PASS ; performance de cohorte certifiée : false. Les 16 fills sont comparés aux bornes publiées et à la tolérance commune de 2 %.
- Tests de mutations compteur et fill : PASS (modifications rejetées).
- Manifeste public de cohorte : [cohort-manifest.json](./cohort-manifest.json), copie exacte du rapprochement scellé.
- HTML SHA256 : 896656ea64f1fd15eab08670b55c5e27e57db10ffbfb787b81c3e8c34625d71b
- Résultats SHA256 : fd4c31e7427b106fdc73d73a3725345ea71a6fcb427bf4ca72733a8b0d892077
- Panel final indépendant contrarian et retail : PASS pour la publication documentaire, sans certification de performance de cohorte.
