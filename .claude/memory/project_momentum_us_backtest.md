---
name: momentum-us-backtest
description: "Backtest Go 5y momentum-rotation US (2021-07→2026-07) : CAGR -5.31%, MaxDD 67%, PF 0.92 vs SPY +12.98%. Mode momentum passé en pausing le 2026-07-02. Ne pas repasser live sans re-validation positive des params live exacts."
metadata:
  type: project
---

# Backtest 5y momentum-rotation US (2026-07-02)

Premier backtest réel du mode `momentum` (momentum-rotation sur univers US americanbull),
qui tournait live sans aucune validation 5y (la stratégie n'avait été backtestée que sur
MA/EU/global). Config : `systematic-tss/config/experimental/portfolio_us_momentum_rotation.yaml`
(bloc momentum-rotation de portfolio_ma.yaml porté sur l'univers/broker US d'americanbulls).

**Résultats (2021-07-02 → 2026-07-02, go build ./cmd/backtest)** :
- CAGR **-5,31%** (total -23,9%), MaxDD **67,15%**, Sharpe 0,14, R² 0,35
- 566 trades, WR 34,1%, **PF 0,921** (expectancy négative)
- Pire année 2023 : -49,8K$ sur 100K$. SPY même fenêtre : **+12,98% CAGR**.

**Caveat** : proxy worst-case (sizing flat 22%, H90, sans DD-breaker/inverse-ATR/caps du
mode live). Mais PF<1 = propriété de la logique de sélection — un risk-framework plus
strict perd juste plus lentement.

**Décision** : `momentum` live → **pausing** (2026-07-02, review 2026-07-16). Conditions
de retour live : backtest des paramètres live EXACTS (inverse-ATR 1%, H21, DD-breaker 8%,
sectorCap 2, corrCap 0.6) positif vs SPY. Sinon → stopped.

**Infra** : le binaire backtest exige Infisical (btw.cloud.hbfs-cloud.net) dont le cert
TLS est EXPIRÉ — contourné avec `-env <fichier vide>` (les backtests n'ont besoin que du
cache OHLCV local, 1.9GB). À réparer pour tout ce qui touche broker/live.
