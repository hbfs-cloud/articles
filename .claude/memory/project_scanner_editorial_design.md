---
name: scanner-editorial-design
description: Scan editorial = top-10 per strategy (momentum/breakout/pullback) + combined, up to ~40 candidates; validate-scan rules aligned 2026-07-03
metadata:
  type: project
---

Le scanner **éditorial** génère jusqu'à ~40 candidats bruts : top-10 par stratégie (momentum, breakout, pullback) + pool combiné. Le set **publié** = top-N curé (~10 setup cards). Les règles de sélection (cap secteur, planchers région) décrivent le set PUBLIÉ, pas le pool brut.

`validate-scan.js` appliquait par erreur des règles « set publié » au pool brut → faux positifs. Corrigé 2026-07-03 (`data/scanner-filters.json` + `tools/validate-scan.js`) :
- **scan_size** : `exact:10` → `max_total:40` + `max_per_strategy:10` (le validateur teste les deux ; `exact` gardé en back-compat).
- **stops.min_pct** : comparaison à 2 décimales (2.998 % s'affiche « 3.00 % » = pass ; les vrais stops < 3 % restent flaggés — vérifié 20260701 : 2.13/2.36/2.52 % toujours pris).
- **max_per_sector** : passé en **advisory** (non bloquant), cohérent avec les planchers région déjà en advisory. `sector_map` étendu (+11 : EA/TTWO/AMCR/ILMN/COGT/CI/IBN/MNST/F/NXPI/BP).

Résultat : 20260702 PASSE ; aucune régression (20260630/01 échouent sur leurs propres règles pré-existantes). `scan_size` n'est lu que par validate-scan (1 consommateur). Cf [[immutable-scope-content]].
