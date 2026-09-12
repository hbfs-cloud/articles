# Revue Retail War Room — scanner du 14 septembre 2026

**Verdict : PASS — plans conditionnels lisibles, sans promesse d’exécution ni de performance.**

## Artefacts lus

| Artefact | SHA-256 |
|---|---|
| `scanner/20260914/index.html` | `d972d46836be109cc66755d568ae948df501371184b7620330dd511e18d7ac71` |
| `scanner/20260914/data.json` | `12dc2cebdeb8f6eb3a6a3314043b7294cf6c4ed83f3f418ab94033091c705af0` |
| `scanner/20260914/signals.json` | `25728fe515937d52cf761ebf5699fd12806e7c5b8dd9025f04a123378ebce500` |


## Delta SEC et provenance — vérifié

Le rendu HTML est byte-identique au gel précédent (`d972d468…ac71`). Le diff de `data.json` se limite à `engine_meta.generated_at` et `pipeline_order.sec_screened_at`; le diff de `signals.json` ne modifie que les métadonnées de provenance/horodatage. Les huit géométries de plan, les règles retail, les textes et le régime affiché ne changent pas. Les reçus EMR et MTDR ont été recalculés sur le nouveau hash de signaux, sans changement de leurs niveaux.

## Constats vérifiés

- Le protocole public distingue le **prix limite plafond** du prix réellement payé : un remplissage inférieur modifie le risque et le R/R ; une ouverture au-dessus qui ne revient pas au plafond ne déclenche rien. La règle de non-poursuite est répétée dans les fiches.
- Le risque de gap est traité de façon opérationnelle : pas d’ordre préparé après une ouverture sous le stop ; le stop ne protège que la quantité effectivement achetée ; une clôture sous l’invalidation appelle une sortie discrétionnaire. Aucun stop n’est présenté comme une garantie de prix.
- Aucune quantité, allocation, budget disponible ou taille de position n’est calculé. Les sorties sont explicites : moitié allégée à T1, stop du solde remonté au prix moyen seulement après cette vente, solde vers T2, reliquat fermé après dix séances à compter du remplissage.
- Le calendrier inscrit la Fed du 16 septembre et rend explicites les marges de conduite choisies : pas de nouvelle entrée après 19 h 50 Paris et clôture avant 19 h 55 sans maintien autorisé écrit. La page précise que ce ne sont pas les horaires de la Fed.
- Les objections restent matérielles dans les huit fiches. Elles ne sont pas annulées par le régime « RECOVERY », lequel est explicitement décrit comme une synthèse, non une probabilité de gain. Le score fixe 80 reste dans `signals.json` comme compatibilité et n’est pas exposé comme KPI ou hiérarchie de conviction au lecteur.
- Chaque thèse distingue les EMA calculées sur 300 séances des SMA visibles dans Finviz, et avertit que les deux ne sont pas interchangeables.
- MTDR et XLE sont clairement des alternatives : corrélation de 0,84 sur 120 observations, avertissement d’énergie dans l’introduction, et instruction de ne pas les acheter ensemble. La table de rotation reprend le même arbitrage.

## Limites visibles, mais correctement déclarées

- Les objectifs sont principalement une géométrie ATR ; la page dit qu’ils ne prouvent pas une résistance observée. XLE affiche un R/R initial inférieur à 1, ce qui est expliqué au lieu d’être masqué.
- L’horizon de dix séances atteint le 25 septembre alors que le calendrier collecté s’arrête le 18 septembre ; la page limite explicitement la couverture de fin de fenêtre aux rendez-vous du registre primaire et ne prétend pas à une absence d’événements.

Aucun blocage retail ou contradiction matérielle constaté sur le gel lu. Cette revue ne certifie ni remplissage, ni contrôle de portefeuille, ni résultat futur.
