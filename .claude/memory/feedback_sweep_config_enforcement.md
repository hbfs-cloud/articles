---
name: sweep-config-enforcement
description: Tout filtre par-mode que gen-status-page applique à l'affichage DOIT aussi être appliqué dans sweep.js (sélection candidats + injection live), sinon divergence display/backtest.
metadata:
  type: feedback
---

Le **sweep** (backtest/trades) et la **status page** (affichage) doivent appliquer les MÊMES filtres par-mode, sinon les positions/trades simulés divergent de ce que le mode devrait tenir.

**Bugs trouvés (2026-07-01) où le sweep n'appliquait PAS un filtre que signalsFor applique :**
1. **shariaOnly** : `cfg2` (passé à simulatePortfolio) ne portait pas `shariaOnly` → filtre dead code → Fortress (Halal) tenait NNI/Nelnet (riba).
2. **universeFilter** : sweep.js n'appliquait JAMAIS `universeFilter` → casablanca (mode BVC, universeFilter=casablanca) tenait des actions US (SAH/SNA adaptive_fractal). Fix: ajouter `universe` au setup dans buildSetups + filtrer `(t.universe||'')===config.universeFilter` dans sélection candidats ET injection live.

**Règle :** `gen-status-page.js signalsFor()` applique {filterName→SF, universeFilter, minScore}. `sweep.js simulatePortfolio` DOIT appliquer les mêmes + shariaOnly. Tout nouveau champ config qui restreint la sélection doit être:
1. porté dans `cfg2` (l'objet passé à simulatePortfolio),
2. propagé dans le setup via `buildSetups` si basé sur une propriété du signal (universe, sharia, pattern),
3. appliqué dans le `.filter()` de sélection ET dans l'injection live (2 sites).

**How to apply:** Après tout ajout de filtre par-mode, vérifier: pour chaque mode univers/sharia-restreint, `pending <= portfolioSize` ET aucune position hors-univers/non-conforme. Comparer signalsFor (display) vs le filtre sweep. Lié à [[config-change-forward-only]] et [[sharia-bank-detection]].
