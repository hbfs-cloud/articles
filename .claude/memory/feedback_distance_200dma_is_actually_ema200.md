---
name: distance-200dma-is-actually-ema200
description: "Le champ distance_200dma_pct mesure l'écart à une moyenne EXPONENTIELLE 200 ; le plafond de 50 % de la politique est écrit en termes de moyenne 200 jours. La porte ne peut pas voir l'écart."
metadata:
  type: feedback
---

**Trouvé par la QA senior le 2026-09-15, sur le scan 20260915. Bloquant, et non détectable par les
gates.**

`tools/build-scan.js` et `tools/audit-scanner-universe.js` alimentent tous deux un champ nommé
`extension.distance_200dma_pct` avec `(close / ema200 − 1) × 100`. Or
`data/scanner-filters.json → overextension.max_distance_200dma_pct: 50` est écrit en termes de
moyenne 200 **jours**, et son propre `_comment` raisonne en DMA. Le gate `extension_200dma` rapporte
donc « passed » par construction : il compare une distance EMA à un plafond DMA.

**L'écart n'est pas théorique.** Sur Valero au 2026-09-14, à partir des mêmes 300 séances
certifiées :

- EMA200 = 259,70 → extension publiée **47,46 %** → sous le plafond de 50 %
- SMA200 = 244,89845 → extension réelle **56,37 %** → **au-dessus du plafond**

La moyenne simple recalculée localement est identique au `twoHundredDayAvg` du fournisseur à la
cinquième décimale (`_final/fund_selected.json`), ce qui lève toute ambiguïté sur laquelle des deux
le lecteur vérifiera sur son graphique.

Sur les dix lignes de ce scan, Valero était la **seule** que la substitution faisait basculer : les
neuf autres ressortent entre 4,12 % et 41,39 % en moyenne simple, toutes sous 50. C'est ce qui rend
le défaut durable — il ne mord qu'à l'occasion, donc il survit aux relectures.

**Ce qui a été fait le 2026-09-15** : Valero a été retiré du panier publié. On ne redéfinit pas la
mesure pour garder une ligne, et changer la métrique d'un gate est un changement de config qui exige
son propre backtest.

**Ce qui reste à faire** : trancher explicitement entre les deux options, et une seule fois.
Soit la politique déclare la métrique comme EMA200 et le plafond est re-calibré contre elle, soit
le code passe en SMA200. Dans les deux cas, renommer le champ et le libellé publié (« moyenne 200 »)
pour que le nombre publié soit celui que le lecteur peut vérifier. Un contrôle croisé contre
`twoHundredDayAvg` du fournisseur est le test de non-régression le plus simple.

Voir [[feedback-analyses-factcheck]] et [[feedback-segment-replay-absolute-dd]] : même famille de
défaut — une grandeur juste, une étiquette fausse, un gate qui ne peut pas s'en apercevoir.
