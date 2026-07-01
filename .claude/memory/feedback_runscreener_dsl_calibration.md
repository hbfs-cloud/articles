---
name: runscreener-dsl-calibration
description: Le scan momentum/breakout renvoie 0 quand le DSL RunScreener est mal calibré (EMA-stack gating, mauvais nb d'args). RunScreener EST fiable — recalibrer le DSL, ne PAS basculer sur les scanners locaux.
metadata:
  type: feedback
---

**Root cause du "scan stub" (20260701, war-room 2026-07-01) :** la routine Scanner Nocturne a produit un scan Pullback-only (commit 6019d071 : *"momentum/breakout screeners returned 0 in extended market"*). Cause = **DSL RunScreener mal calibrés**, PAS un MCP défaillant ni une étape sautée. RunScreener est fiable et c'est le bon outil ; les scanners locaux (`momentum-scanner.js`, `fractal-scanner.js`) servent à autre chose (Yahoo parity backtest), pas à remplacer RunScreener.

**Les 2 erreurs de calibration DSL qui donnent 0 :**
1. **EMA-stack gating** — `ema(close,20)>ema(close,50)&&...` en `pass_expr` **retourne 0 candidats** (le stack de séries prix ne s'évalue pas comme attendu). Screener LOOSE puis vérifier l'EMA-stack per-ticker via QueryData.
2. **Mauvais nb d'arguments d'un helper** — `near_breakout(20, 0.03)` échoue (`too many arguments`) ; la signature est `near_breakout(0.03)` (1 arg = proximité). Un helper mal appelé fait échouer TOUT le job → 0.

**DSL validés 2026-07-01 (renvoient 40 candidats chacun) :**
- Momentum : `rsi14>53 && rsi14<70 && macd>0 && vol>1500000 && close>10`, score `rsi14 + (macd>0 ? 15 : 0)`
- Breakout : `near_breakout(0.03) && vol>1500000 && rsi14>52 && rsi14<72 && close>10`, score `rsi14 + (vol_spike45(1.5) ? 20 : 0)`

**Post-filtrage OBLIGATOIRE en code** (le DSL ne filtre pas la mcap) : `market_cap>=2e9` + exclure ETF (mc==0 ou tickers connus IJR/BIL/VTEB/XHB/XLV/MUB/KRE/SHV) + exclure penny (REPL 733M, SDOT 10M). `pass_expr` doit être booléen, `score_expr` numérique (helpers booléens type `vol_spike45`/`near_breakout`/`cross_up` ne marchent QUE dans pass_expr).

**Why:** un `pass_expr` trop strict ou un helper mal appelé → 0 silencieux → scan stub → modes mom_bo à 0 signal → badge sharia disparu → 12 modes "cassés". Toujours smoke-tester le DSL (attendre ≥10 candidats) AVANT de committer un scan.

**How to apply:** Dans la routine Scanner Nocturne + `scanner-pipeline`, tester chaque DSL momentum/breakout et si <10 candidats → alerter, ne PAS committer un scan mono-stratégie sans le signaler. Lié à [[screener-mcp-filter]] et [[aplus-screening-and-screener-dsl]].
