---
name: config-declarative-silent-fallback
description: Une clé manquante dans modes-config.json dégrade en SILENCE au lieu d'échouer bruyamment — aplus n'a pas de regimeFilters.recovery et prend 0 entrée sur les 5 séances RECOVERY ; regimeParams et calendar ne sont passés à AUCUN des 3 sites d'appel de simulateTrade.
metadata:
  type: feedback
---

**Angle mort trouvé par le seul angle `code` du diagnostic de juillet 2026.** Deux manifestations,
une seule racine : **la config déclare une politique que le moteur n'applique pas, sans une seule
erreur.**

### 1. aplus est silencieusement éteint en régime RECOVERY

`data/modes-config.json` : `aplus.regimeFilters = {risk_on, neutral, early_risk_off, risk_off}` — la
clé **`recovery` MANQUE**. Dans `tools/sweep.js:1454-1459`, un override absent ne déclenche aucune
erreur : `activeFilter` reste le filtre de base, soit `filterName='fortress_pm'`, dont l'ensemble
d'exclusion contient **momentum, breakout, pullback** — c'est-à-dire **tout le pool éditorial**.

Vérifié empiriquement : sur les **5 séances RECOVERY** (27/07, 29/07, 31/07, 03/08, 04/08 — dont 4 des
6 dernières séances du dataset), **aplus a 0 entrée**, alors que fortress en prend 7, dynamic 3,
secured 3, turbo 3, balanced 1 et les modes dtx 10. Aucune erreur, aucun log, aucune alerte : **un
mode live à 5 positions et 50 000 USD est hors marché 11% du temps et personne ne le sait.**

### 2. Le bloc `regimeParams` déclaré en config n'est JAMAIS exécuté

Les 3 sites d'appel de `simulateTrade` (`tools/sweep.js:2055`, `2095`, `2727`) passent une **liste
blanche explicite** de champs de config. Ni `regimeParams` ni `calendar` n'y figurent. Le bloc
`sweep.js:929-935` (`if (config.regimeParams && config.regimeParams.maxLoss && setup.regime)`, parité
Go `dynamic_max_loss`) ne peut donc **jamais s'exécuter**, alors que **8 modes le déclarent**.

**Correction d'interprétation, importante :** pour les modes dtx, `regimeParams.maxLoss.risk_on = 35`
contre `maxStopPct` statique 15 (et `risk_off = 15`, identique au statique). **Activer le bloc
ÉLARGIRAIT les stops jusqu'à 35% en marché porteur, pas l'inverse.** Le code mort a donc **protégé** —
ce n'est **pas** une cause de perte. Le défaut est de **gouvernance**, pas de P&L.

Même mécanisme pour `calendar` : `dayFnsFor(config.calendar)` retombe sur les jours ouvrés, donc un
mode déclarant `calendar:'24/7'` voit son **horizon amputé sans avertissement**.

**Why:** Un régime non déclaré dégrade vers un filtre qui peut **tout bloquer** ; un bloc de risque
déclaré mais non câblé rend **toute revue de config mensongère** — on relit une politique qui n'existe
pas dans le moteur. Dans les deux cas le système ne ment pas activement : il se tait.

**How to apply:**
- **Fail loud, jamais fallback muet.** `regimeFilters` doit couvrir les **5 régimes** (`risk_on`,
  `neutral`, `recovery`, `early_risk_off`, `risk_off`) pour tout mode live ; une clé manquante doit
  lever, pas retomber sur le filtre de base. À tester dans `qa-check`.
- **Test de config morte :** pour chaque bloc déclaré dans `modes-config.json`, vérifier qu'il figure
  dans la liste blanche des 3 sites d'appel de `simulateTrade`. Tout champ déclaré et non passé doit
  être **supprimé de la config** ou **câblé** — jamais laissé décoratif.
- **Alerte de silence :** un mode `live` avec **0 entrée sur ≥3 séances consécutives** doit émettre un
  avertissement dans le QA du pipeline. C'est le seul symptôme observable d'un fallback muet.
  Lié à [[feedback-regime-aware-eval]] et [[scanner-silent-failures]].
