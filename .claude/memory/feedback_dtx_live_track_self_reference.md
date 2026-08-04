---
name: dtx live-track self-reference freeze (SEALED-PRIMARY)
description: Le hero/chart des modes dtx AVEC record scellé sweep doit venir du frozen sweep, jamais du tracker live ni du splice replay — boucle auto-référente corrigée le 2026-08-04
type: feedback
---
**Incident (découvert par qa-check au scan 20260804, présent depuis ~2026-07-30).** Pour les modes dtx,
`gen-status-page.js` (bloc splice ~L918) écrasait le hero avec le dernier point de `data/dtx-live-track.json`,
alors que `appendPoint` ré-écrivait chaque soir ce même point depuis le hero de la veille → **boucle
auto-référente** : book_honest figé à −1,24 % et stockbox_pit à −2,7 % pendant que le sweep scellé avançait
(−4,49 % / −6,13 %). En plus, le rescale du splice affichait le bout de courbe replay rebasé (656 vs 93,87)
dans le chart et `portfolio/v1/<mode>/equity.json`.

**Fix (commit 714dcd5)** : gate `!frozen &&` sur la condition du bloc splice dtx — un mode dtx AVEC
`frozen_<id>` suit le chemin frozen standard (comme turbo/dynamic) ; les modes dtx SANS frozen gardent le
splice backtest+live.

**Règles à ne jamais réintroduire** :
1. Un affichage "live" ne doit JAMAIS être alimenté par une valeur qu'il a lui-même produite la veille
   (vérifier la provenance de chaque point appendé : source = sweep/frozen, pas le rendu précédent).
2. SEALED-PRIMARY : dès qu'un `frozen_<mode>` existe, hero + bout de chart + equity.json = frozen, verbatim
   (tolérance 0,5) — le splice replay n'est légitime QUE pour les modes sans record scellé.
3. `update-tracking.js` (source prix externe morte en cloud) peut VIDER `scanner-positions.json` +
   `scanner-metrics.json` quand il récupère 0 prix — vérifier le diff avant commit, restaurer depuis HEAD,
   et à terme le migrer sur le cache de prix daté.
