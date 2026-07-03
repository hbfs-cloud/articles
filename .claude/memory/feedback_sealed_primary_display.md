---
name: sealed-primary-display
description: Le status page doit TOUJOURS afficher le sweep scellé (hash-chain) comme chiffre primaire d'un mode — jamais le carnet live. Garde-fou qa-check "SEALED-PRIMARY invariant".
metadata:
  type: feedback
---

Incident 2026-07-02 : une routine cloud (commit `a1e2642a9`, "Fable 5") a fait du **carnet
live pit-state** la couche PRIMAIRE du status page pour tous les modes, reléguant le track
record **scellé** (sweep frozen_*, chaîne SHA-256) en sous-bloc "Sim backtest". Résultat
affiché : turbo passé de **111.76% → 5.51%**, dynamic 75% → 24%, balanced 45% → 21%. Le user
l'a vécu comme une réécriture de l'historique ("foutage de gueule").

**La blockchain n'a PAS sauté** : `verifyTradeChain()` = 13/13 modes valides, 0 changement.
Les données étaient intactes. L'incident était **100% sur la couche d'affichage**, que la
chaîne ne protège pas.

**Règle (immuable)** : le chiffre en tête de chaque mode = son **sweep scellé** dès qu'il
existe un vrai track record. Un carnet live (échantillon récent) ne doit **JAMAIS** remplacer
un track record scellé. Une seule courbe = le portfolio (série nommée `Portfolio`), pas de
"Strategy"/"Sim backtest"/"LIVE BOOK".

**Why** : le sweep scellé (hash-chainé) est le track record de référence montré depuis des
mois ; le remplacer par un carnet live de quelques jours détruit la performance affichée et
la crédibilité, sans aucun signal explicite au user.

**How to apply** :
- `gen-status-page.js` : gate `frozenMeaningful = (m.trades>=10) || |m.ret|>=5` dans `panel()`
  ET dans `modeCharts`. `P` (pit-live primaire) seulement si `!frozenMeaningful`. Modes frais
  sans sweep (aplus/etf/momentum/…) gardent leur carnet live comme unique portfolio.
- Garde-fou bloquant : qa-check.js check 27b "SEALED-PRIMARY invariant" — pour tout mode à
  track record scellé, `hero Total Return == frozen.returnTotal` (TOL 1.0) ; et zéro label
  `LIVE BOOK`/`Sim backtest`/`name:'Strategy'` dans le HTML. Exit 1 si violé.
- Edge : orbit (secured, 13 trades scellés) affiche son sweep scellé (-1.69%), pas le live
  (+10.46%) — cohérent avec "un seul = portfolio comme avant".

Lié : [[immutable-trades]] (protège les données), ce feedback protège l'affichage.
