---
name: parity-v10-2
description: "v10.2 (2026-07-02) : modes scriptés réalignés sur les configs Go 5y. Exceptions : bull (haute-conviction volontaire), momentum US (aucun backtest Go). Gap restant : pit-engine générique vs PMs Go sur-mesure."
metadata:
  type: project
---

# Parité systematic-tss v10.2 (2026-07-02)

Audit complet : les modes scriptés divergeaient des configs Go backtestées 5y qu'ils
prétendent refléter. Réalignés (forward-only, effectif 2026-07-03) :
- **highvol** P15/H14/trail 1.5R/TP30/corr 0.8/maxStop 15 (Go CAGR 114.8%)
- **etf** P7/ATR 2.5/maxStop 17 ; **etf_eu** P3/score 80/ATR 1.5 + blacklist 28 ETP
  (dans etf-scanner.js) + enfin câblé au nightly (Step 2k2)
- **casablanca** H90/P8/rotation daily_max1/maxStop 15 (l'edge momentum-rotation = hold long)
- **trendline** H25/ATR 2.5/score 50/pas de TP

**Exceptions documentées** : bull = variante haute-conviction volontaire (score 88, P3, H8 —
ne pas « réaligner » vers min_score 70/P5/H10 du yaml Go, cf [[bull-8x-parity]]) ;
momentum US = momentum-rotation jamais backtesté 5y sur univers US (seulement MA/EU/global) — flag ouvert.

**Gaps restants (non résolus)** :
- pit-engine.js est un moteur de sortie GÉNÉRIQUE — les logiques sur-mesure des PMs Go
  (confirmation J+1 AmericanBulls, trail-trigger +12% HighVol, early_exit/circuit_breaker ETF,
  tighten-after-5d MA, sizing dynamique par régime) ne sont pas portées.
- skip_months [9] de casablanca non implémenté.
- Aucun harnais de parité Go↔articles automatisé (tss-orders.js = comparateur dev-time seulement).
