---
name: mode-status-machine-bypassed
description: 18 des 40 transitions du journal sont ILLÉGALES au regard de MODE_STATUS.md, et 6 modes portent status:'live' SANS AUCUNE entrée dans le journal append-only. Le motif n'est pas une date — c'est 9 modes en production sans validation d'espérance.
metadata:
  type: feedback
---

**Angle mort `process` du diagnostic de juillet 2026, quantifié en passant les 40 transitions de
`data/modes-status-history.json` à la table de `tools/lib/MODE_STATUS.md` : 18/40 sont ILLÉGALES.**

- **Lot du 01/07** — `highvol`, `casablanca`, `momentum`, `etf`, `etf_eu`, `trendline` en
  **`test→live`**, alors que `test` n'autorise que `deploying` ou `draft`. Tous avec le même motif,
  **sans le moindre chiffre** : « Promotion normale (user request 2026-07-01) ».
- **Lot du 06/07** — `highvol`, `etf`, `etf_eu`, `hybrid`, `forex` en **`draft→live`** (cf.
  [[hybrid-illegal-promotion]]).
- **Pire :** 6 modes portent `status:'live'` dans `modes-config.json` **sans aucune entrée dans le
  journal** (`book_honest`, `us_highvol`, `hvep`, `stockbox_pit`, `etf_us`, `ep`). Ils n'ont jamais
  transité — **ils ont été écrits**. Le journal est **figé depuis le 11/07**.

**Les backtests disqualifiants existaient — ils ont juste été faits APRÈS la mise en live.** Deux des
promus du 01/07 ont dû être repausés en 24-48h : `momentum` (CAGR **-5,31%**, DD **67%**) et `bull`
(artefact survivorship, **+435% → -10%**).

**Correction d'un regroupement faux qui circulait :** « 9 modes ont été mis en live le 1er juillet et
ce sont eux qui portent la perte » est **factuellement faux**. Le lot du 01/07 comptait bien 9 modes
(secured, bull, aplus, highvol, casablanca, momentum, etf, etf_eu, trendline), mais **7 d'entre eux
n'ont AUCUN trade enregistré** — leur espérance n'est pas mesurable. Les vrais porteurs de perte sont
`hybrid` (live le 06/07) et les **6 modes dtx** (écrits en live le 13/07).

**Ce qui survit et qu'il faut retenir : ce n'est pas une date, c'est un motif.** 9 modes mis en
production entre juin et juillet sans validation d'espérance positive, portant **62 sorties pour
-457,4 pts**, contre **-127,0 pts pour les 125 sorties des 4 modes historiques** sur la même période.

**Why:** La machine à états n'a de valeur que si elle est le **seul** chemin vers `live`. Un
`status:'live'` écrit à la main dans le JSON contourne à la fois la table de transitions, le journal
append-only et l'exigence de preuve — et rend l'audit post-mortem impossible (on ne sait plus ni quand
ni pourquoi un mode est passé en production).

**How to apply:**
- **Aucune écriture manuelle de `status` / `statusSince` dans `modes-config.json`.** Passer
  exclusivement par `node tools/set-mode-status.js --mode X --to STATE --reason "..." --review
  YYYY-MM-DD`.
- **Garde de cohérence dans `qa-check` :** pour chaque mode, le `status` de `modes-config.json` doit
  correspondre à la **dernière entrée** de `modes-status-history.json`. Divergence = BLOQUANT.
- **Pas de promotion vers `live` sans preuve attachée** : le `reason` doit contenir des chiffres
  (CAGR, DD, Sharpe, période) issus d'un backtest **antérieur** à la promotion, pas une phrase
  générique. Un `--force` doit citer le backtest.
- Le chemin légal reste `draft → test → deploying → live`. Lié à [[mode-status-machine]],
  [[config-change-backtest]], [[dtx-modes-cloned-risk-block]].
