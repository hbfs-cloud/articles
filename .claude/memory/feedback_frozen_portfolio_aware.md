---
name: frozen-portfolio-aware
description: Les stats frozen_* d'un mode viennent de simulatePortfolio (portfolio-aware). JAMAIS les recomputer via computeStatsFromTrades (config-aveugle, ignore portfolioSize).
metadata:
  type: feedback
---

`computeStatsFromTrades(trades, portfolioSize, ...)` **IGNORE portfolioSize** — prouvé : sortie
identique pour size 1/3/10/44. C'est un agrégateur à plat de TOUS les trades bruts, PAS un
simulateur de portefeuille. Il ne modélise ni la capacité (positions concurrentes) ni le sizing,
qui ont VARIÉ dans le temps (dynamic pSize 1→2→3, balanced 1→4, horizons 2→15 ; voir
modes-config-history).

**Règle** : les `frozen_*` (track record scellé) DOIVENT provenir de `simulatePortfolio`
(config-aware, période par période) et être **préservés byte-for-byte** au sweep (append-only).
Ne JAMAIS les recomputer via `computeStatsFromTrades` — c'est un replay uniforme, non fiable pour
l'absolu (règle [[segment-replay-absolute-dd]]).

**Incident 2026-07-02/03** : des routines (65027b777 « advance frozen », 2a7b5c277 « courbe
déterministe ») ont remplacé la préservation par un recompute `computeStatsFromTrades(priorEC:[])`.
Effet : dynamic 91.18%→75.45% (compte 44 trades bruts au lieu des ~35 réellement détenus),
balanced 49.64%→45.42%, orbit DD -5.96%→**-10.15% fantôme**. La chaîne SHA était intacte (données
OK) — seul l'agrégat a divergé. **Piège** : l'auteur du recompute avait un rationnel plausible
(« le 91% est un phantom +15.7pts ») — c'était FAUX : le vrai DD de dynamic est -4.59% (documenté
dans [[segment-replay-absolute-dd]]). Ne pas se fier au commit message ; vérifier via l'historique
portfolioSize + simulatePortfolio.

**Fix (commit 54610df85)** : sweep.js re-préserve le frozen (fin du recompute config-aveugle) +
`frozen_*` restaurés aux valeurs portfolio-aware pré-régression (dynamic 91.18/-4.59DD/35t, etc.).

Lié : [[sealed-primary-display]] (couche affichage), [[segment-replay-absolute-dd]] (règle absolu).
