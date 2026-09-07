# Revue des dernières éditions — 7 septembre 2026

Périmètre : les trois dernières éditions datées de chaque rubrique, leurs variantes existantes,
les cartes d’index et les défauts de génération/validation rencontrés. Corrections locales ; aucune
publication, notification, transaction, modification de configuration de stratégie, commit ou push
pendant la revue initiale.

Suite à la demande « publie » du 7 septembre, les rectificatifs et avertissements sont autorisés à la
publication sur le site. Cette publication ne lève pas les blocages de sélection documentés ci-dessous
et ne recertifie pas les archives. Aucun nouveau message Telegram ou article Substack n’est envoyé.

## Résultat

| Édition | Corrections principales | Vérification finale |
| --- | --- | --- |
| Daily 07/09 | Fenêtre PPI/CPI d’août, calendrier BCE/Fed, gain latent, minimum de clôture, VIX9D, classement COO/SAIL, lecture des contrats de prédiction | 184 claims ; QA, hiérarchie, horizon, style : passent |
| Daily 01/09 | Séance faussement positive, métaux, volatilité et propos Fed non étayés, horloge crypto | 37 claims ; mêmes contrôles : passent |
| Daily 30/08 | Pétrole présenté ferme malgré son recul, score de régime présenté comme probabilité, dominance BTC et variantes | 76 claims ; mêmes contrôles : passent |
| Weekly 07/09 | Proxy d’amplitude présenté comme P&L options, annonce/réaction Oracle, ouverture confondue avec plus bas, causalités et couvertures trop certaines, graphique et ancre | 230 claims ; mêmes contrôles : passent |
| Weekly 31/08 | Inflation européenne déplacée au mardi, multiples correctement rendus, plans historiques retrouvés ; neuf dates de résultats recoupées avec l’IR | 72 claims ; mêmes contrôles : passent |
| Weekly 24/08 | Semaine visée et PIB corrigés, crypto recalculée sur sa vraie fenêtre 14–20 août, cote Fed/flux/probabilités non prouvés retirés, chronologie SEC/Trésor | QA, hiérarchie, style : passent ; manifeste historique de claims absent |
| Scanner 08/09 | AMZN suspendu après lecture du 424B3 Globalstar ; correction des catégories PDBC/IBIT, du R/R, des arrondis ATR et des formulations de risque | Rendu et horizon passent ; validation du panier bloquée sur AMZN |
| Scanner 01/09 | Rectificatif AMZN, archive non recertifiée explicitée, PPI/CPI ajoutés à l’horizon, géométrie TP divulguée | 44 erreurs de preuves absentes subsistent ; règle VWAP historique conservée |
| Scanner 31/08 | Eurostat au 01/09, PPI/CPI dans l’horizon, géométrie TP et concentration clarifiées, qualification non prouvée retirée | Validation des signaux passe ; règle VWAP historique conservée |

Les **599 affirmations liées à un manifeste** passent le contrôle numérique. Ce chiffre ne couvre
pas toutes les phrases des articles, les graphiques, les variantes ni le weekly du 24 août.
Les corrections narratives ont fait l’objet d’une revue distincte.

## Rectificatif SEC Amazon

Le [424B3 du 18 août 2026](https://www.sec.gov/Archives/edgar/data/1018724/000110465926098339/tm2617924-6_424b3.htm)
prévoit des actions Amazon dans le cadre de l’acquisition de Globalstar. Le raisonnement de la
collecte initiale — absence d’émission d’actions plausible — était faux. Les quatre autres 424B5
examinés concernent bien de la dette ; leur nature ne permettait pas de classer ce 424B3 par analogie.

Pour la séance future du 8 septembre, `dilution_clear=false` et suspension explicite dans le titre,
les aperçus, la synthèse et le tableau. Le panier n’est pas présenté comme certifié. Les huit lignes
initiales sont conservées pour traçabilité, dont sept autres plans conditionnels. La revue ne rétablit
pas une couverture exhaustive des instruments dilutifs encore vivants sur cinq ans.

Preuves séparées : [revue SEC](../../scanner/20260908/_review/sec-review-20260907.json).
Les sources `_final`, les transactions scellées et les signaux historiques des 31 août et 1 septembre
restent inchangés. La chaîne des transactions est valide sur ses cinq modes.

## Corrections des outils

- `add_card.js` extrait le véritable titre H1, conserve les titres de suspension et normalise la date
  depuis la route. Corriger un ancien daily ne le remonte plus devant le dernier.
- `qa-check.js` contrôle la dernière édition réellement indexée, avec garde de fraîcheur et de séance,
  au lieu de chercher un dossier correspondant à la clôture de collecte. Le 4 septembre est la clôture
  de référence ; le 8 septembre est la séance visée après Labor Day.
- Le contrôle d’horizon accepte les dates compactes et ISO, ne réutilise plus le texte d’une autre
  page et distingue une réunion du FOMC d’une référence bibliographique à la Fed.
- Le contrôle de claims accepte l’ancrage au spot d’une somme de primes divisée par ce spot, tout en
  recalculant ses opérandes et en rejetant une fausse valeur ou un pointeur sans rapport.
- Les plans de collecte historiques sont récupérés **octet pour octet** depuis Git et conservés sous
  leur SHA-256. Le validateur vérifie ces octets contre les hashes d’origine. Aucun journal, harnais
  ou résultat de marché historique n’a été réécrit pour obtenir un résultat positif.
- Les défauts correspondants des constructeurs scanner/weekly et de leurs entrées éditoriales ont
  été corrigés pour éviter leur réintroduction.

Traçabilité des six plans récupérés : [archives de plans](../../data/plan-archive/README.md).
Tests de régression : indexation, dates, calendrier, preuves, claims et vérifications sémantiques passent.

## Vérifications et limites

- Nouvelle lecture MCP bornée au 4 septembre : les 42 clôtures de SPY, QQQ, DIA, IWM, GLD, USO et XLE
  correspondent aux données conservées dans chacun des deux articles du 7 septembre. Ce contrôle
  porte sur ces sept séries, pas sur l’intégralité du marché.
- Les neuf pages s’affichent sans erreur JavaScript ni débordement horizontal en 390 et 1440 pixels.
  Les connexions de marché externes et les outils analytiques étaient bloqués pour isoler le rendu ;
  le fonctionnement réseau du suivi live n’est pas certifié par ce test.
- Les sources manquantes du scanner du 1 septembre n’existent dans aucun commit de l’historique Git
  local accessible. Aucune preuve de remplacement n’a été fabriquée.
- Le gate d’horizon refuse encore la règle VWAP des deux scanners archivés. Ces anciennes règles
  d’entrée sont explicitement historiques et n’ont pas été réécrites rétrospectivement.
- Le weekly du 24 août ne possède pas de manifeste de claims : ses corrections sont vérifiées contre
  les données conservées et les sources primaires, sans annoncer une certification complète.
- Le test général `test-scanner-quality-gates.js` reste inexécutable faute de fixture
  `scanner/status/history/20260907.json`. Le contrôle global QA passe, avec avertissements existants
  sur l’ancienneté du benchmark SPY, du suivi `best` et du snapshot de statut.

Pièces de contrôle : [gates exécutés](20260907-editorial-audit-gates.json),
[barres relues](20260907-editorial-audit-bars.json), [contrôle navigateur](20260907-editorial-audit-browser.json).

Les changements préexistants dans le cache de collecte, les dossiers de staging du scanner du
8 septembre et `tools/_weekly-blast-20260907.js` ont été préservés.
