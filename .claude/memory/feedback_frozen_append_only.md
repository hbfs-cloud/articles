---
name: frozen-append-only
description: "Immutable trades = trades individuels, PAS les agrégats. frozen_* avance en append-only (priorEC préservé octet-par-octet) ; statusSince ne supprime jamais de trades enregistrés."
metadata:
  type: feedback
---

# Frozen stats : append-only, pas figées

**Incident (2026-07-02)** : le dashboard scanner/status affichait des stats figées au
26/06 (balanced ret 49.64%) alors que des trades continuaient de se clôturer — sweep.js
préservait `frozen_*` octet-par-octet « par immutabilité », et gen-status-page écrasait
les métriques fraîches par ces valeurs mortes. Perçu comme « la perf stagne ».

**Why:** La règle Immutable Trades protège les trades individuels clôturés et leur
préfixe d'equity curve — PAS les agrégats (ret/WR/PF/DD), qui doivent avancer quand la
liste append-only s'étend. Confondre les deux fige le produit.

**How to apply:**
- sweep.js avance désormais `frozen_*` via `computeStatsFromTrades(merged, …, {priorEC})` :
  préfixe copié verbatim + gardes `prefixOk`/`tradesOk`, fallback loud sur rejet.
- `statusSince` ne gate que les SCANS à simuler, jamais les trades déjà enregistrés
  (une promotion deploying→live effaçait le track record de test de bull/highvol/trendline).
  Un vrai reset de stratégie (cas Orbit) = purge explicite de backtest-trades.json + frozen_*.
- Lié : [[immutable-trades]], [[segment-replay-absolute-dd]].
