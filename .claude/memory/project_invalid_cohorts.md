---
name: invalid-cohorts-marking
description: Marquer (jamais supprimer) les trades scellés issus d'un filtre inopérant via data/invalid-cohorts.json ; fenêtre active scanDate 2026-06-16 → 2026-07-13
type: project
---

# Cohortes de trades invalides — marquage déclaratif

## Règle

Un trade clôturé est immuable (chaîne SHA-256 `data/trade-chain.json`, `sweep.js` avorte sur
violation). Quand une série de trades s'avère **non exploitable statistiquement** — filtre de
sélection inopérant, bug de scoring, univers corrompu — on ne la supprime pas et on ne la retouche
pas : on la **déclare**.

- Registre : `data/invalid-cohorts.json` (fenêtre de dates + champ `scanDate|entryDate|exitDate`
  + modes concernés + raison + preuve chiffrée).
- Lecture : `tools/lib/invalid-cohorts.js` (`partitionTrades`, `isInvalidTrade`, `summarize`).
- Branchement : `tools/lib/mode-stats.js` → `computeStatsFromTrades`, la source unique de la
  comptabilité des modes (donc `sweep.js`, `gen-status-page.js`, `gen-api.js` en héritent).
- Rapport d'impact : `node tools/invalid-cohort-report.js [--mode X] [--json]`.

## Marquage systématique, exclusion opt-in

Toute stat produite porte désormais `invalidCohortTrades`, `invalidCohorts[]`,
`invalidCohortExcluded`. Les trades marqués restent **dans** le calcul par défaut :
la comptabilité est point-in-time et publiée (`portfolio/v1/*`, equity curves scellées),
donc filtrer par défaut réécrirait silencieusement un track record.

L'exclusion s'active explicitement : `opts.excludeInvalidCohorts = true` ou
`EXCLUDE_INVALID_COHORTS=1`. Parité vérifiée le 2026-08-07 : sortie par défaut byte-identique
à la version pré-changement sur les 14 modes ayant des trades.

## Cohorte active : `filtre-inoperant-20260616-20260713`

`scanDate` ∈ [2026-06-16 … 2026-07-13], bornes incluses, tous modes.

**Raison** : sur cette fenêtre, le seuil de score configuré ne mordait sur aucun candidat —
aucune sélection réelle n'a eu lieu. Les entrées sont un tirage non filtré du pool, pas un
échantillon de la stratégie annoncée.

**Preuve** (scores réellement observés dans `data/backtest-trades.json` vs seuil configuré) :
`hybrid` minScore=25 alors que le score minimum observé est 65.15 ; `book_honest`, `hvep`,
`stockbox_pit`, `etf_us`, `us_highvol`, `ep` minScore=50 alors que le score minimum observé est
80.00 (les 11 trades de `stockbox_pit` portent exactement 80.00). Aucun rejet possible.

**Impact** : 93 trades marqués sur 394 scellés. -2,97 %/trade de moyenne dans la fenêtre (n=93)
contre +0,42 %/trade hors fenêtre (n=301).

**Borne haute** : 2026-07-13 = date du cut-over dtx v15 (cost-honest) qui a re-statué les modes
scriptés. Ne pas étendre sans preuve que le filtre est resté inopérant après.

## Conséquence pratique

Avant de conclure qu'un mode a une espérance négative, vérifier si le signe tient **hors**
cohorte. Exemple 2026-08-07 : `us_highvol` affiche -0,38 %/trade (n=4) mais ses deux perdants
sont tous les deux dans la fenêtre — hors cohorte il est à +8,41 % (n=2). Pauser sur ce motif
aurait été auto-contradictoire.
