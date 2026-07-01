---
name: backtest-gap-fills
description: simulateTrade bookait exitPrice au niveau (stop/TP) même quand la barre gappait au-delà → biais optimiste unidirectionnel. Fix = fill à l'open sur gap.
metadata:
  type: feedback
---

**Bug P&L majeur (trade-sim audit 2026-07-01):** `sweep.js simulateTrade()` bookait `exitPrice = currentStop` (ou `actualTp1/2`) dès que `bar.low <= stop` (ou `bar.high >= tp`), **même quand la barre a GAPPÉ entièrement au-delà du niveau** (ouverture au-delà). Booker un fill à un prix qui n'a jamais tradé dans la séance = **optimisme unidirectionnel** : 28% des sorties stop ont ouvert sous leur stop (+48.5 points de P&L gonflé ; CRM booké +0.11% vs réel −4.43%). Gonfle rendement + WR de TOUS les modes, sous-estime le DD.

**Fix (long-only, symétrique):**
- stop: `exitPrice = Math.min(currentStop, bar.open)` — gap-down fille à l'open (pire, réaliste)
- TP1/TP2: `exitPrice = Math.max(actualTp, bar.open)` — gap-up fille à l'open (price improvement)
- LATENT-1: le blend partial-TP keye désormais sur `partialRealized>0` (pas le flag `partialTP`) — sinon un partial gain-based avec `partialTP:false` était silencieusement jeté.

**Immutabilité:** fix forward-only. Re-run sweep → toutes les chaînes SHA valides, 0 changement aux trades frozen clôturés (ils gardent leurs valeurs historiques ; seuls les futurs/pending utilisent les fills corrigés).

**Why:** Un backtest doit filler à un prix qui a réellement tradé. Filler au niveau sur un gap = surestimation systématique du track-record.

**How to apply:** Tout fill de sortie sur barre journalière doit borner au `bar.open` (min pour stop, max pour TP long). Appliquer le fix rétroactivement au track-record publié (baisserait les rendements affichés) nécessite l'ACCORD EXPLICITE user (règle immutable-trades / "never batch-reset without consent"). Lié à [[immutable-trades]] et [[config-change-backtest]].
