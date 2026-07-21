---
name: frozen-stats-append-only-advance
description: "Stats hero des modes LLM figées au 26/06 pendant un mois — le fix d'immutabilité du 02/07 avait retiré le recalcul sans câbler l'avancement append-only"
type: feedback
---

# Stats scellées ≠ stats mortes : l'avancement append-only est obligatoire

**Incident (21/07/2026)** : les heros des modes LLM (turbo/dynamic/balanced/…) affichaient
« stats as of 06/26 » un mois plus tard, alors que backtest-trades.json accumulait bien les
trades clos (turbo : 47 vs 40 dans frozen_turbo). Cause : le fix des 02-03/07 (qui a justement
empêché le recalcul config-blind full-period de dégonfler le track record scellé) préservait
frozen_* octet pour octet « pour toujours », avec un commentaire supposant que « l'agrégat
avance via les snapshots » — chaînon jamais câblé. Même famille structurelle que l'incident
dtx-live-track du même jour.

## Règles

1. **Immutable ≠ figé** : les points d'équité pré-gel sont intouchables (copiés octet pour
   octet via `opts.priorEC` de `computeStatsFromTrades`), mais le SEGMENT postérieur DOIT être
   construit à chaque sweep à partir des pnl SCELLÉS des nouveaux trades clos. Aucune
   resimulation des anciens trades — c'est le recalcul uniforme full-period qui est interdit,
   pas l'append.
2. **Garde d'intégrité** : après avancement, le préfixe de la nouvelle courbe doit être
   byte-identique à la courbe gelée — sinon fallback aux stats existantes + log bruyant.
3. **Vérité comptable assumée** : l'avancement du 21/07 a révélé le vrai mois de juillet —
   turbo 112,24 % → 100,57 % (7 trades, -11,67 pts, somme exacte des pnl scellés), dynamic
   91,2 → 71,1 %, balanced 49,6 → 40,5 % (DD -13,9 %, au-delà du critère ≤8 %). Un hero qui
   ne bouge plus n'est pas un bon signe, c'est un pipeline cassé.
4. **Symétrie de surveillance** : toute stat « scellée + vivante » (frozen_*, dtx-live-track)
   doit avoir un garde de fraîcheur dans qa-check. Un agrégat qui n'a pas avancé alors que des
   trades ont clos = ❌, pas un état normal.

Lié : [[status-hero-sealed-vs-live]], [[dtx-live-track-drift]], [[segment-replay]].
