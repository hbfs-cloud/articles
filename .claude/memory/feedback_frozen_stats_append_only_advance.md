---
name: frozen-stats-append-only-advance
description: "Les agrégats scellés (frozen_*) sont APPEND-ONLY ET portfolio-aware : avancer le segment post-gel depuis les pnl scellés à chaque sweep, copier le préfixe pré-gel octet-par-octet, JAMAIS full-recompute config-aveugle (computeStatsFromTrades ignore portfolioSize)."
metadata:
  type: feedback
---

# Stats scellées ≠ stats mortes : append-only ET portfolio-aware

Un agrégat scellé (`frozen_*` : ret/WR/PF/DD + equity curve) est **immuable sur son préfixe
pré-gel** mais **vivant sur son segment post-gel**. Deux erreurs symétriques l'ont cassé :
le figer pour toujours (append-only jamais câblé) OU le recomputer full-period en aveugle de
la config (dégonfle le track record). Les deux sont interdites.

## Incident 1 — figé un mois (21/07/2026)
Les heros des modes LLM (turbo/dynamic/balanced/…) affichaient « stats as of 06/26 » un mois
plus tard, alors que `backtest-trades.json` accumulait bien les trades clos (turbo : 47 vs 40
dans `frozen_turbo`). Cause : le fix des 02-03/07 (qui empêchait le recalcul config-blind
full-period de dégonfler le track record) préservait `frozen_*` octet pour octet « pour
toujours », avec un commentaire supposant que « l'agrégat avance via les snapshots » — chaînon
jamais câblé. Même famille structurelle que l'incident [[dtx-live-track-drift]] du même jour.
L'avancement du 21/07 a révélé le vrai mois de juillet : **turbo 112,24 % → 100,57 %** (7
trades, −11,67 pts, somme exacte des pnl scellés), **dynamic 91,2 → 71,1 %**, **balanced 49,6 →
40,5 % (DD −13,9 %**, au-delà du critère ≤8 %). Un hero qui ne bouge plus n'est pas un bon
signe, c'est un pipeline cassé.

## Incident 2 — figé par confusion immutabilité (2026-07-02)
Le dashboard scanner/status affichait des stats figées au 26/06 (**balanced ret 49.64%**) alors
que des trades continuaient de se clôturer : `sweep.js` préservait `frozen_*` octet-par-octet
« par immutabilité » et `gen-status-page` écrasait les métriques fraîches par ces valeurs
mortes. Perçu comme « la perf stagne ». La règle Immutable Trades protège les trades
individuels clôturés et le **préfixe** d'equity curve — PAS les agrégats, qui doivent avancer
quand la liste append-only s'étend. Confondre les deux fige le produit.

## Incident 3 — full-recompute config-aveugle (2026-07-02/03)
`computeStatsFromTrades(trades, portfolioSize, …)` **IGNORE `portfolioSize`** — prouvé : sortie
identique pour size 1/3/10/44. C'est un agrégateur à plat de TOUS les trades bruts, PAS un
simulateur de portefeuille : il ne modélise ni la capacité (positions concurrentes) ni le
sizing, qui ont VARIÉ dans le temps (dynamic pSize 1→2→3, balanced 1→4, horizons 2→15 ; voir
`modes-config-history`). Des routines (commits `65027b777` « advance frozen », `2a7b5c277`
« courbe déterministe ») ont remplacé la préservation par un recompute
`computeStatsFromTrades(priorEC:[])`. Effet : **dynamic 91.18%→75.45%** (compte 44 trades bruts
au lieu des ~35 réellement détenus), **balanced 49.64%→45.42%**, **orbit DD −5.96%→−10.15%
fantôme**. La chaîne SHA était intacte (données OK) — seul l'agrégat a divergé. **Piège** :
l'auteur du recompute avait un rationnel plausible (« le 91% est un phantom +15.7pts ») —
c'était FAUX : le vrai DD de dynamic est **−4.59%** (documenté dans [[segment-replay-absolute-dd]]).
Ne pas se fier au commit message ; vérifier via l'historique `portfolioSize` + `simulatePortfolio`.

## Règles
1. **Immutable ≠ figé** : les points d'équité pré-gel sont intouchables (copiés octet pour
   octet via `opts.priorEC` de `computeStatsFromTrades`), mais le SEGMENT postérieur DOIT être
   construit à chaque sweep à partir des pnl SCELLÉS des nouveaux trades clos. Aucune
   resimulation des anciens trades — c'est le recalcul uniforme full-period qui est interdit,
   pas l'append. `sweep.js` avance `frozen_*` via `computeStatsFromTrades(merged, …, {priorEC})`.
2. **Provenance portfolio-aware** : la valeur de référence d'un `frozen_*` (le préfixe pré-gel)
   DOIT provenir de `simulatePortfolio` (config-aware, période par période) et être préservée
   byte-for-byte. Ne JAMAIS la (re)dériver via `computeStatsFromTrades` full-period — replay
   uniforme non fiable pour l'absolu. Fix de référence (commit `54610df85`) : sweep re-préserve
   le frozen (fin du recompute config-aveugle) + `frozen_*` restaurés aux valeurs
   portfolio-aware pré-régression (dynamic 91.18 / −4.59 DD / 35t, etc.).
3. **Garde d'intégrité** : après avancement, le préfixe de la nouvelle courbe doit être
   byte-identique à la courbe gelée (gardes `prefixOk`/`tradesOk`) — sinon fallback aux stats
   existantes + log bruyant.
4. **`statusSince` gate les SCANS, pas les trades enregistrés** : `statusSince` ne gate que les
   scans à simuler, jamais les trades déjà enregistrés (une promotion deploying→live effaçait le
   track record de test de bull/highvol/trendline). Un vrai reset de stratégie (cas Orbit) =
   purge explicite de `backtest-trades.json` + `frozen_*`.
5. **Symétrie de surveillance** : toute stat « scellée + vivante » (frozen_*, dtx-live-track)
   doit avoir un garde de fraîcheur dans `qa-check`. Un agrégat qui n'a pas avancé alors que des
   trades ont clos = ❌, pas un état normal.

Lié : [[immutable-trades]], [[sealed-primary-display]], [[dtx-live-track-drift]], [[segment-replay-absolute-dd]].
