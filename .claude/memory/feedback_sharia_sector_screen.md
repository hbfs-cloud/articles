---
name: sharia-sector-screen
description: Le filtre Halal par-mode (Fortress) doit screener par SECTEUR + liste, pas seulement sharia:false — sinon des financières untagged (NNI/Nelnet) passent.
metadata:
  type: feedback
---

Le mode Fortress est **PM Halal** (`shariaOnly:true`). Un filtre basé uniquement sur `sharia !== false` LAISSE PASSER les tickers `sharia:null` (untagged). Les scanners momentum/breakout/trendline taggent `sharia:null` sans screen sectoriel → une financière comme **NNI (Nelnet, riba/net interest income)** est entrée dans le portefeuille Halal.

**Fix (sweep.js, 2026-07-01) : `isHaramForHalalMode(s)` = reject si :**
1. `s.sharia === false` (explicite), OU
2. ticker dans `SHARIA_EXCLUDED` (banques/assurance/défense/alcool/tabac/jeux — NNI + specialty finance ajoutés: SLM/NAVI/SOFI/ALLY/SYF/DFS/RKT/UWMC...), OU
3. `getSector(ticker)` dans `HARAM_SECTORS` (= {Finance}).

Appliqué aux DEUX sites : sélection de candidats (filtered) ET injection de positions live. ING (déjà dans la liste) + NNI (secteur Finance + liste) désormais exclus.

**Why:** Un mandat Halal est opt-out incomplet si on ne screene que le flag explicite. Les secteurs haram (Finance/Insurance/Defense) doivent être bloqués même sur signaux untagged. Idéalement le scanner source devrait tagger `sharia` (défense upstream).

**How to apply:** Pour tout mode `shariaOnly`, vérifier après sweep qu'aucune position n'est une banque/financière/défense. Ajouter les financières manquantes à `SHARIA_EXCLUDED`. Le SECTOR_MAP du sweep est incomplet (long tail → 'Other') — le screen sectoriel ne capte que les tickers mappés; la liste est le filet. Lié à [[fortress-mandate]] et [[dilution-check]].
