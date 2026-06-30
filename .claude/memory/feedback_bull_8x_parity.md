---
name: bull-8x-parity
description: "Bull mode 0 signals on quiet days is LEGITIMATE — high-conviction 8× volume gate, parity with systematic-tss. Never lower the threshold to force signals."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae4db5ff-a124-40d7-8586-81972e819812
---

Le mode **Bull** (candlestick/americanbulls) ne trade qu'un pattern chandelier confirmé par un **spike de volume ≥ 8× la moyenne 20j le jour du signal** (volume de CLÔTURE, `absCandleVolRatio` — PAS intraday J+1) + score ≥ 88 + dollar-volume ≥ $1M. C'est la **parité avec systematic-tss config `americanbull`** (`portfolio_us_americanbulls.yaml`: min_score 85, min_vol_ratio 8.0, min_avg_dollar_volume 1M).

**0 signal Bull les jours calmes est NORMAL et LÉGITIME, pas un bug.** Sur 5 ans : ~1 trade/semaine (1061 trades, parité Go/JS validée).

**Vérifié 2026-06-30** : via le backtest Go (`ab-scan-history` + filtres config trading), sur 3512 tickers, 1685 patterns bruts, mais **1 seul candidat** (MESH) passe score+vol(8×), et MESH échoue la liquidité ($111k dollar-volume < $1M, SPAC au NAV) → **0 ordre, identique au backtest Go**.

**Why:** Une **règle QA fausse** ("Mode Bull jamais à 0 signal") poussait à baisser le seuil 8× pour "produire des signaux", ce qui cassait la parité systematic-tss et générait des trades sur du bruit illiquide (SPACs). C'est la cause racine de 6 mois d'erreurs Bull.

**How to apply:**
- Ne JAMAIS baisser `min_vol_ratio` sous 8× pour le TRADING. Le 1× est réservé à la recherche/détection (équivalent Go `ab-scan-history` sans filtre).
- Le seuil 8× vit dans `data/scanner-filters.json#candlestick.min_vol_ratio_trading` (source unique, lu par sweep.js + gen-status-page.js + gen-api.js).
- Le QA (`qa-check.js`) vérifie le **marqueur `_candlestickScan`** (preuve que le scanner a tourné : universeFetched/detectedPatterns/qualified), PAS la présence de signaux.
- Pour vérifier vs Go : `cd ~/GolandProjects/systematic-tss && ./bin/ab-scan-history -ticker "$(cat univ)" -start DATE -min-score 40`, puis filtrer score≥85 ET vol≥8 ET dollar-volume≥$1M. On marche par **ordres/positions** (backtest), pas par patterns bruts.

Lié à [[candlestick-bull-pipeline]] et [[config-change-backtest]].
