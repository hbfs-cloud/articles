---
name: runscreener-dsl-calibration
description: Le scan momentum/breakout renvoie 0 quand le DSL RunScreener est mal calibré (EMA-stack gating, mauvais nb d'args). RunScreener EST fiable — recalibrer le DSL, ne PAS basculer sur les scanners locaux.
metadata:
  type: feedback
---

**Root cause du "scan stub" (20260701, war-room 2026-07-01) :** la routine Scanner Nocturne a produit un scan Pullback-only (commit 6019d071 : *"momentum/breakout screeners returned 0 in extended market"*). Cause = **DSL RunScreener mal calibrés**, PAS un MCP défaillant ni une étape sautée. RunScreener est fiable et c'est le bon outil ; les scanners locaux (`momentum-scanner.js`, `fractal-scanner.js`) servent à autre chose (Yahoo parity backtest), pas à remplacer RunScreener.

**Les 3 erreurs de calibration DSL qui donnent 0 :**
0. **★ LE KILLER PROUVÉ 2026-07-01 : `market_cap` dans `pass_expr`.** Le screener évalue `market_cap` à **0** dans le contexte DSL → `market_cap > 10000000000` est false pour TOUS → 0 candidat silencieux. C'est EXACTEMENT ce qui a produit le stub 20260701 : le DSL momentum du skill (`market_cap>10e9 and rsi14>55 ... and ema20>ema50 and ema50>ema200 and vol>avg_volume*1.2`) renvoie **0** ; en retirant SEULEMENT `market_cap` → **40 candidats**. La mcap DOIT être post-filtrée en code, JAMAIS dans pass_expr. (⚠️ ces DSL étaient marqués "vérifié 06-25" — régression MCP ou vérif optimiste.)
1. **EMA-stack gating (form fonction)** — `ema(close,20)>ema(close,50)&&...` retourne 0 ; MAIS la form série nommée `ema20>ema50>ema200` marche (vérifié : 40 sans market_cap). LOOSE + vérif per-ticker QueryData reste plus sûr.
2. **Mauvais nb d'arguments d'un helper** — `near_breakout(20, 0.03)` échoue (`too many arguments`) ; la signature est `near_breakout(0.03)` (1 arg = proximité). Un helper mal appelé fait échouer TOUT le job → 0.

**DSL validés 2026-07-01 (renvoient 40 candidats chacun) :**
- Momentum : `rsi14>53 && rsi14<70 && macd>0 && vol>1500000 && close>10`, score `rsi14 + (macd>0 ? 15 : 0)`
- Breakout : `near_breakout(0.03) && vol>1500000 && rsi14>52 && rsi14<72 && close>10`, score `rsi14 + (vol_spike45(1.5) ? 20 : 0)`

**Post-filtrage OBLIGATOIRE en code** (le DSL ne filtre pas la mcap) : `market_cap>=2e9` + exclure ETF (mc==0 ou tickers connus IJR/BIL/VTEB/XHB/XLV/MUB/KRE/SHV) + exclure penny (REPL 733M, SDOT 10M). `pass_expr` doit être booléen, `score_expr` numérique (helpers booléens type `vol_spike45`/`near_breakout`/`cross_up` ne marchent QUE dans pass_expr).

**Why:** un `pass_expr` trop strict ou un helper mal appelé → 0 silencieux → scan stub → modes mom_bo à 0 signal → badge sharia disparu → 12 modes "cassés". Toujours smoke-tester le DSL (attendre ≥10 candidats) AVANT de committer un scan.

**How to apply:** Dans la routine Scanner Nocturne + `scanner-pipeline`, tester chaque DSL momentum/breakout et si <10 candidats → alerter, ne PAS committer un scan mono-stratégie sans le signaler. Lié à [[screener-mcp-filter]] et [[aplus-screening-and-screener-dsl]].
