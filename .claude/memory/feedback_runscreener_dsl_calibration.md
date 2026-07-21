---
name: runscreener-dsl-calibration
description: Le scan momentum/breakout renvoie 0 quand le DSL RunScreener est mal calibré. NE JAMAIS mettre market_cap dans pass_expr (évalue à 0 = killer silencieux) → post-filtrer mcap>=$2B + ETF + penny EN CODE. RunScreener EST fiable — recalibrer le DSL, ne PAS basculer sur les scanners locaux.
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

## Historique (origine 2026-06-25) — pourquoi la mcap est un filtre obligatoire
Le skill `scanner-pipeline` Phase 1 disait « RunScreener (3 DSL) » sans spécifier les requêtes → chaque agent improvisait son DSL, parfois **sans filtre `market_cap`**, ce qui fait remonter uniquement des penny stocks (tout le marché est scanné, les tickers junk dominent via des scores de volatilité gonflés). Découvert quand la routine cloud a renvoyé **60 penny stocks** (YYGH $509K, BMGL $11M…) ; l'agent a ignoré le junk et **inventé ses propres picks** — fragile et non reproductible. Fix : le skill a désormais **5 requêtes DSL explicites** avec planchers mcap ($5B-$20B selon la stratégie) ; routine cloud passée en **v4** (`trig_016idAivWzRTwcoeGnUgJB2S`). ⚠️ La formulation d'origine « chaque pass_expr DOIT inclure un filtre market_cap » est **superséded** par le killer ci-dessus : le plancher mcap doit être appliqué en POST-FILTRE code, jamais dans `pass_expr`.

**SAFETY-STOP** : si TOUS les candidats renvoyés ont `mcap < $500M` → le screener est cassé → **STOP + alerter**, ne pas publier.

**Sizing tiéré** (rappel) : $2-10B ×0.5, $10-50B ×0.7, >$50B ×1.0 — cf [[tiered-mcap-oscillation]].

**Why:** un `pass_expr` trop strict, un helper mal appelé, ou une mcap dans le pass_expr → 0 silencieux → scan stub → modes mom_bo à 0 signal → badge sharia disparu → 12 modes "cassés". OU l'inverse (pas de plancher) → 60 penny junk → picks inventés. Toujours smoke-tester le DSL (attendre ≥10 candidats) AVANT de committer un scan.

**How to apply:** Dans la routine Scanner Nocturne + `scanner-pipeline`, tester chaque DSL momentum/breakout ; si <10 candidats → alerter, ne PAS committer un scan mono-stratégie sans le signaler ; si tous mcap<$500M → STOP. Lié à [[tiered-mcap-oscillation]], [[candlestick-no-mcp]], [[mcp-hard-stop]] et [[aplus-screening-and-screener-dsl]].
