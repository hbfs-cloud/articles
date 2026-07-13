---
name: status-hero-sealed-vs-live
description: scanner/status hero — pour les modes meaningful, le headline « Total Return » DOIT être le backtest scellé (frozen, invariant sealed-primary), PAS la forward-view incl. MtM. Le live/MtM des positions ouvertes s'affiche SÉPARÉMENT et labellisé. + piège points-de-return vs %-réel sur une base à +112%.
metadata:
  type: feedback
---

# Hero scanner/status : scellé au headline, live/MtM séparé (fix 2026-07-13, f7ed8c970)

**Incident** : le hero « Total Return » de turbo affichait **106.92 %** (forward-view incl. mark-to-market
des positions ouvertes) au lieu du **112.24 %** frozen scellé. La branche `forward` (`F = m.forward`) dans
`gen-status-page.js` n'était PAS gatée par `frozenMeaningful` (contrairement à la branche `pit`), donc elle
court-circuitait l'invariant DOCUMENTÉ « a sealed track record is ALWAYS the primary hero » (même famille
d'incident que 2026-07-02 : turbo 111→5.51%). Résultat : un chiffre « qui chute de 112 à 106 sans
explication », alarmant.

**Fix (f7ed8c970)** : gater `F` par `!frozenMeaningful` (miroir de `pit`) → headline des modes meaningful =
`m` frozen scellé (stable, = console gen-status, = backtest-results frozen_*). Le chiffre live incl. MtM est
affiché SÉPARÉMENT dans une ligne `.ps-live` labellisée (« Live incl. MtM », tooltip + caveat stop-sell),
jamais fondu dans « Total Return ». Guardrail `qa-check.js` (fwdPrimary gate par `!frozenMeaningful`) enforce
`hero==scellé` pour les meaningful → un régén ne peut plus déraper. Modes non-meaningful + dtx (label
« Live Return since … ») restent sur leur voie d'origine.

## Piège pédagogique : points-de-return ≠ %-réel
Un mode à **+112 % cumulé** dont le portefeuille bouge de **−2.5 %** voit son « Total Return » passer de
112.24 à 106.92 = **−5.32 POINTS** — mais la perte RÉELLE est **−2.5 %**, pas −5.3 %. Ex. turbo (mono-position
~pleine taille) : trade CAH vendu −2.2 % vendredi 10/07 → book ~−2.2 % → affiché −4.6 points sur la base +112.
Toujours raisonner en variation d'equity réelle (`equity_fin/equity_ini − 1`), pas en soustraction de points
de return. Source de vérité du live jour-par-jour : `data/pit-forward.json` (anchorDate/anchorValue + ec).
Le frozen scellé (`backtest-results.json frozen_*`) a une courbe qui s'arrête à sa date de gel (turbo :
26/06, 40 trades) — les trades post-gel vivent dans la forward-view, pas dans le frozen.
