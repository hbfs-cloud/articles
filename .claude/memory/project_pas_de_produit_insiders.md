---
name: project_pas_de_produit_insiders
description: Décision du 2026-08-11 — pas de produit « insiders » autonome ; la clé de cadence est retirée de publication-gate.js, mesures MCP à l'appui
metadata:
  type: project
---

**Décision du 2026-08-11 : « insiders » n'est PAS un type de publication.** La clé
`insiders: 20` a été retirée de `CADENCE_H` dans `tools/publication-gate.js`. Le contrôle
en dur de `desk-plan.js` (`tools/insiders-digest.js` manquant) est remplacé par un contrôle
générique des **cadences orphelines**. Ne pas remettre la clé.

## Pourquoi — mesuré sur GetInsiderActivity le 2026-08-11 (clôture de référence 2026-08-10)

Quatre balayages marché, paramètres réels du socle et au-delà :

| Appel | Résultat |
|---|---|
| `days=7, limit=25` (socle, 10/08 21:53) | **1** nom — ANET, 282 M$ de VENTES |
| `days=7, limit=25` (socle, 11/08 12:37) | **2** noms — PINS, DINO, ventes |
| `days=7, limit=25` (11/08 15:25) | **0** nom |
| `days=7, max_symbols=200` (plafond dur, 15:26) | **1** nom — CVX |
| `days=30, max_symbols=200` (15:26) | **5** noms, **tous** `net_selling` |

1. **Volume nul.** 0 à 2 noms par séance. Un produit quotidien n'a rien à dire, et doubler
   la couverture au plafond dur (200) rend UN nom de plus sur 7 jours.
2. **Couverture partielle assumée par l'outil lui-même** : 100 (ou 200) symboles balayés
   sur 944. Sa note dit textuellement « ZERO RESULTS HERE IS A COVERAGE STATEMENT, NOT AN
   ABSENCE OF INSIDER ACTIVITY ». Publier « pas de mouvement d'initiés cette semaine » sur
   cette base serait une affirmation que la donnée ne porte pas.
3. **Zéro achat, sur toutes les observations.** Or l'alpha documenté de la donnée Form 4
   est le *cluster-buy*, pas la vente. Dans un univers de grandes capitalisations, la vente
   est massivement mécanique (plans programmés, levées d'options).
4. **L'agrégat induit en erreur.** CVX est étiqueté `direction: net_selling`, `-158 M$`.
   Le détail transaction par transaction (`include_transactions=true`) montre John B. Hess,
   administrateur, exerçant ~784 k options à 48-138 $ le 03/08 et revendant ~711 k titres à
   ~194 $ le même jour : une levée-revente, pas un désengagement. Le même agrégat annonce
   `sells_count: 2` là où `transactions[]` contient 8 ventes. Le vérifier exige la passe
   par symbole, qui est une source différente et plus lente.
5. **Instabilité intra-journée.** Le même appel rend PINS + DINO à 12h37 puis une liste
   vide à 15h25, alors que la dernière activité de PINS (07/08) est toujours dans la
   fenêtre de 7 jours. Toutes les réponses portent `grade: "C"` et
   `warnings: ["limited_results"]`.

## Où vit le signal insider, et il y vit déjà

Le seul usage actionnable est **ciblé**, pas panoramique, et il est déjà câblé :

- `tools/filings-scanner.js` — stratégie **InsiderCluster** : ≥2 initiés distincts, code P
  (achat au marché), fenêtre ≤30 j, seuil en $ net, titre au-dessus de l'EMA50 ou en
  reclaim. Score `62 + min(insiders,5)*5 + tier + upgrade`, pool `filings_pool`
  (`tools/lib/score-contract.js`), sortie dans le scanner avec entrée/stop/R:R suivis.
  Garde structurelle : jamais d'insider EU (donnée PDMR inexistante côté MCP).
- `plans/analyse.json` (`insider_transactions` par ticker), skills `swing-signals`
  (≥2 acheteurs = porteur), `aplus-setups`, `retro`.

Un digest marché ferait donc doublon d'un signal qui a déjà un producteur, avec une donnée
strictement plus faible. **Ne pas ajouter de bloc « initiés » au daily non plus** : ce
serait la même donnée d'un cran plus bas.

## Ce qui reste vrai après la suppression

`plans/socle.json` continue de collecter `insiders_7d` en **contexte** (`required: false`),
mutualisé avec `plans/scanner-wave1.json`. Aucun lecteur ne le consomme aujourd'hui.

`desk-plan.js` interroge désormais `publication-gate.js --cadences --json` et signale toute
cadence déclarée qui ne correspond à aucun produit connu (PRODUCTS / EXCLUDED / PROPOSED).
Le contrôle inverse — un produit sans cadence — existait déjà et continue de signaler
`macro` et `squeeze`.
