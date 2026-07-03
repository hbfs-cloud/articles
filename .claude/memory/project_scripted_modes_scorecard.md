---
name: scripted-modes-scorecard
description: Verdict de fiabilité des modes scriptés (gate liquidité ON). bull=AmericanBulls=artefact (pausing). highvol/etf/etf_eu=KEEP. momentum/trendline/casablanca=à trancher/requalifier.
metadata:
  type: project
---

Mission fiabilisation backtest (2026-07-03) — biais racine = univers tradeable = top-N par mcap
ACTUELLE appliqué à toutes les dates → survivorship + look-ahead (on ne trade que les survivants +
microcaps qui ont explosé APRÈS). Fix : gate liquidité point-in-time (médiane dollar-volume 60
barres ≤ D > $5M), porté du frère systematic-tss (`applyEstablishedLiquidityGate`). Commit 401cbd1ff
(candlestick-scanner). Reste à câbler aux autres scanners.

**Scorecard honnête (systematic-tss 5Y, gate ON) → verdict modes articles :**
- **bull** (candlestick_only = AmericanBulls) : **+435% → -10% CAGR** honnête. Absent du scorecard Go.
  Filtre liquidité mort dans le code (min_avg_dollar_volume jamais lu). = **ARTEFACT** →
  **pausing** 2026-07-03 (commit 21ec5d965), review 2026-08-03. Edge = microcaps look-ahead.
- **highvol** (highvol_breakout) : CAGR **105.8%** / Sharpe **2.05** / WR 56.9% / DD 36%. = **KEEP, champion.**
- **etf** (etf_momentum) : 68.5% / SR 2.14 / DD 15.9% — PASS 5/5. **KEEP** (ETF liquides = pas de biais).
- **etf_eu** (etf_momentum) : 74.8% / SR 2.24 / R² 0.97 — PASS 5/5. **KEEP.**
- **momentum** (momentum_rotation) : déjà `pausing`. **DIVERGENCE** : scorecard Go fév. donne EU
  momentum-rotation 58.3% CAGR / SR 1.47 PASS, mais la mission dit « virer TOUTE la famille
  momentum-rotation (+100%→~0) ». Soit le fév. est pré-gate, soit la mission est plus large. NE PAS
  stopper sans arbitrage user + backtest gaté frais.
- **trendline** (trendline_breakout) + **casablanca** (adaptive_fractal) : pas dans le scorecard Go
  par ce nom. casablanca = famille trend-hybrid-af (KEEP per mission) mais marché marocain. À
  **REQUALIFIER** via backtest gaté avant toute décision. Ne pas toucher.

**Règle** : disabling d'un mode = Mode Status State Machine (`set-mode-status.js`, pausing→stopped),
JAMAIS supprimer les données/trades scellés. Toujours projeter l'impact + laisser le user choisir.
Lié : [[frozen-portfolio-aware]], [[segment-replay-absolute-dd]].
