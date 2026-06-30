---
name: TimesFM Forecast Service
description: TimesFM 2.5 evaluation results — 6 use cases tested, vol/volume best (8-8.5/10), price direction weak (6/10), earnings fail (2/10). Service on ser via Nomad.
type: project
---

TimesFM 2.5 (Google, 500M params) deployed as Docker service on ser via Nomad, accessible at `http://ser.tail5d09f.ts.net:8400`.

**Why:** Ajouter des prédictions AI zero-shot sur les séries temporelles OHLCV pour améliorer le scanner (confluence scoring), enrichir les analyses (chart forecast), anticiper les transitions de régime (VIX prédictif), et alimenter le portfolio API.

**Évaluation empirique (2026-04-05, 120 points) :**
- UC1 Close Forecast: 6/10 — 44% direction globale, seulement SPY/AMZN/META viable (62-75%)
- UC2 Volatilité: 8/10 — mean-reverting, 67-73% direction, pre_squeeze + sizing
- UC3 Volume: 8.5/10 — 69% direction, meilleur UC, filtre breakout
- UC4 Earnings/XReg: 2/10 — XReg non implémenté dans MCP, modèle pire autour earnings
- UC5 Multi-séries: 7.5/10 — rotation sectorielle, 0.4s/ticker, ranking relatif fiable
- UC6 Scoring: 5/10 — direction seule inutile, multi-facteur (CI_width+vol+secteur) utile

**How to apply:**
- Scanner pipeline: vol forecast (pre_squeeze), volume forecast (filtre breakout), CI pour TP calibration
- Analyses: bandes CI comme zones TP/SL, rotation sectorielle hebdo
- Régime: `regime.js` appelle `/v1/forecast/vix` pour ajuster le riskScore
- Exclure fenêtres earnings ±5j, ne pas utiliser direction comme signal primaire
- Lookback optimal: 20j pour direction, 150 bars pour vol/volume. Horizon max 10j.
