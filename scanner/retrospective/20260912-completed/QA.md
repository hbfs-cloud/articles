# Rétro complétée — clôture du 11 septembre 2026

**PASS pour publication de la complétion et des statistiques à horizon mûr.**
La couverture nécessaire est complète : zéro `data_error`, zéro `open_unverified`, zéro ambiguïté.
Le bilan de la cohorte entière reste à établir après échéance des 27 horizons non mûrs.

## Résultat réconcilié

56 propositions sur six scans (24, 25, 27, 28, 31 août et 1er septembre), 49 tickers.
Les huit enregistrements review_only restent archivés et hors trading.
29 propositions ont atteint leur horizon : 23 fills clos et six no-fill. Les 27 autres comprennent
neuf fills et dix-huit no-fill. Ces groupes sont disjoints ; les compteurs de statut et de maturité
ne doivent pas être additionnés entre eux.

Sur les 23 résultats mûrs : sept TP1 ou mieux, seize stops, hit rate 30,4 %, R moyen -0,295,
profit factor 0,60. Sept sorties déjà observées sur un horizon non mûr restent dans le détail,
hors statistiques. Un trade et un reliquat TP1 restent ouverts.

## Complétion et limites

Le chemin MCP 15 minutes utilisait un cache non vide sans vérifier sa fin. Deux collectes MCP
5 minutes ont permis de remplacer 131 séances invalides sur 33 titres, en trois passes hashées.
Chaque séance remplacée comprend exactement 26 barres US ou 34 LSE, issues de groupes de trois
observations 5 minutes réelles. Aucun prix interpolé, aucune substitution par des barres daily.
Les données se terminent au plus tard à la clôture de référence. Le calendrier LSE tient compte
du 31 août férié ; les demi-séances de décembre non implémentées échouent explicitement.

Le journal public `data-repair.json` détaille les séances, sources et empreintes : 91 séances
présentent un chevauchement de prix différent de l'ancien cache invalide, au maximum 2,692 %.
Le remplacement est intégral ; les deux versions restent conservées. 391 corrections de borne
OHLC sont limitées au quantum de sérialisation MCP de 0,0001. Aucun défaut OHLC supérieur,
volume invalide ou observation future n'a été trouvé dans l'entrée finale.

Six séries tronquées du 10 septembre restent dans l'archive de mesure, hors périmètre gouvernant :
UBER, TSCO, FTNT, HPE, BMY, BSX du scan 24 août ont tous un horizon au 9 septembre. Elles ne sont
pas utilisées dans le calcul. La complétion porte sur les séances nécessaires, pas sur une réparation
globale du service fournisseur. Les données 5 minutes ont été collectées après la période ; elles
ne constituent pas une capture enregistrée le jour même. Les spreads, frais et slippage réels ne
sont pas prouvés par une simulation OHLCV.

La publication initiale et les niveaux historiques restent inchangés. Cette révision possède un
nouveau chemin ; elle n'efface pas la première preuve de couverture incomplète.

## Contrôles

- Contrat rétro et deux collectes supplémentaires : freshness et run-plan PASS.
- Tests parseur/calendrier/maturité, agrégation et mutations QA : PASS.
- `qa-retro` : 56 propositions réconciliées et 23 fills mûrs conformes, PASS.
- `validate-article` : PASS ; `qa-content --strict` : 22 contrôles PASS, zéro avertissement.
- Chrome 1440 et 390 pixels : zéro débordement, erreur JS ou ancre cassée, tableaux défilables,
  paragraphes 16px ; contraste hero corrigé et screenshot final revérifié.
- Revue Retail/Data : PASS, couverture gouvernante, provenance et conservation des séances valides.
- Revue Senior QA/Contrarian : PASS sur les quatre empreintes ci-dessous, calcul indépendant.
- Le contrôle global content-ux a un échec préexistant sur le cachebuster de tech/track-record,
  sans rapport avec cette modification ; il n'est pas présenté comme passé.
- `qa-check.js` cible uniquement le scanner quotidien courant et refuse une cible rétro : ce gate
  n'est pas applicable ici ; `qa-retro`, les contrôles article et la revue font foi.

## Empreintes du snapshot final

| Fichier | SHA-256 |
|---|---|
| index.html | `ebfd7f7463d1095d4211e97a7609be756bac5a3f75e2c29c5e2cac0dc956baad` |
| retro-results.json | `998663475c51d374ab9328245cccca511ae173c2d4f8394789e81852ab0767c7` |
| cohort-manifest.json | `b9dcfe61a348202396adb92f43b3dec93e1382387c5ab3fa827611830eac36be` |
| data-repair.json | `d368f46daf6b6a2ff087e760cb718ed244a221a204c1d825e4e56f9c9a2b3744` |
