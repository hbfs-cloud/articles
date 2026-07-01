---
name: balanced-p4-underperf-fix
description: Sous-perf balanced = CONFIG (maxStopPct=0 non-capé + sizingMethod FIXED sur noms high-ATR), PAS régime. Fix P4 appliqué v10.1-20260701. fortress/turbo/dynamic = régime, ne rien changer.
metadata:
  type: project
---

**Diagnostic A→Z (2026-07-01, workflow contexte-vierge, READ-ONLY sur trades immutables) :**
Point de bascule commun = frontière **configVersion v1→v2 (~18 avril)**, PAS une frontière de régime. Le win-rate baisse partout (marché plus choppy post-avril) mais **un seul mode passe PF<1 : balanced.** turbo/dynamic/fortress restent PF≥1.8 réalisé.

**Root cause balanced = CONFIG (preuve du jumeau) :** même ticker/jour/régime, balanced pose un stop ~2× plus large que fortress (NVDA 06-03 : balanced −9.4% vs fortress −4.0%). Mécanisme = `sweep.js:684` `effectiveMaxStop = maxStopPct>0 ? maxStopPct : 100` → **`maxStopPct=0` = stop NON capé (100%)**, combiné à `filterName=momentum_only` (noms high-ATR NVDA/ANET/FCX, stops structurels 7-9%) + **`sizingMethod=FIXED`** (pas de `inverse_atr` ni `targetRiskPct` → perte 9% prise à taille pleine). turbo/dynamic survivent au même stop large car ils ont `maxStopPct=7 + inverse_atr` (stop large → position plus petite → risque $ borné). C'est **le garde-fou que balanced n'a jamais eu**.

**Fix P4 appliqué (v10.1-20260701, décision user GO) :** `atrStopMult 0→1.8`, `maxStopPct 5→7`, `trailingStop true` + `trailMultR 2.0` + `trailGraceDays 3`, **`sizingMethod inverse_atr`**, `targetRiskPct 1`. Validé via `validate-config-change.js` (gate 30j regime-aware) : full-period **+18.35% vs −13.95%**, MaxDD **−4.16% (≤8%)**, PF 2.09 vs 0.65, WR 55.8% vs 31.7%, **OOS walk-forward +6.7% vs −11.25%**, amélioration dans TOUS les régimes. La variante P2 (sans inverse_atr) a un meilleur return brut mais **viole DD≤8%** → preuve que le sizing normalisé EST le fix, pas la respiration de stop seule.

**fortress/turbo/dynamic = RÉGIME, pas config :** fortress POST-avril PF 1.81, pertes plafonnées 4-5% (breakout_only), parachute intact — le −21.68% MtM est un artefact phantom. Toute proposition de changement DÉGRADE (gate = WAIT). **Ne rien changer.**

**How to apply :** `validate-config-change.js` est terminé et enforce désormais la règle [[config-change-backtest]] : gate 30j regime-aware + veto dur DD>8% + OOS + per-régime, deltas A/B relatifs (chemin frozen sweep, pas l'approx statique d'optimize-param). Toujours passer par ce gate avant tout changement de config turbo/balanced/dynamic/fortress. S'applique aux FUTURS trades (passé immutable, jamais de re-sweep). Lié à [[regime-aware-eval]], [[segment-replay-absolute-dd]], [[mode-success-criteria]].
