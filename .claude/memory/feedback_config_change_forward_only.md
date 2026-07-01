---
name: config-change-forward-only
description: Un changement de config mode (portfolioSize/topN/filter) DOIT être forward-only via _effectiveFrom, sinon le sweep backfille des positions fantômes rétroactives.
metadata:
  type: feedback
---

Quand on change la config d'un mode (ex: Fortress portfolioSize 4→10), le sweep re-simule TOUT l'historique avec la nouvelle config → il **backfille des positions fantômes** datées avant le changement (positions qui n'auraient jamais existé sous l'ancienne capacité). Symptôme: "on a sauté à 8 positions cette nuit alors que les ordres passent demain".

**Fix (implémenté 2026-07-01 dans sweep.js) :**
- Le mécanisme `_effectiveFrom` gate maintenant AUSSI `portfolioSize`/`topN` (avant: seulement le strategy filter). Champs config explicites: `_effectiveFrom`, `_priorPortfolioSize`, `_priorTopN`, `_priorFilterName`. Avant la date effective → capacité PRIOR; après → nouvelle.
- **Injection live cappée aux slots RESTANTS** (`portfolioSize − alreadyPending`), pas à `portfolioSize` (sinon total pending > cap → phantom balanced 5>P3, momentum 9>P5).
- `cfg2` (passé à simulatePortfolio) DOIT porter tous les champs custom (`shariaOnly`, etc.) — sinon le filtre lit `undefined` = dead code (bug Sharia).

**Why:** Un changement forward-only ne doit JAMAIS réécrire l'historique réalisé ni gonfler les positions ouvertes. Les nouveaux slots se remplissent progressivement via ordres en séance, pas overnight.

**How to apply:** Tout changement de capacité/filtre d'un mode → ajouter `_effectiveFrom: "YYYY-MM-DD"` + `_prior*` dans modes-config.json. Vérifier après sweep que `pending <= portfolioSize` pour CHAQUE mode (qa-check le teste). Lié à [[config-change-backtest]] et [[fortress-mandate]].
