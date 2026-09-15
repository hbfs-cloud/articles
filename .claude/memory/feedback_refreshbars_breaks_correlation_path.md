---
name: refreshbars-breaks-correlation-path
description: "RefreshBars par symbole répare bars_daily mais laisse le symbole avec ~4 observations dans PortfolioRisk(correlation) — vérifier avant de refresher un titre du panier"
metadata:
  type: feedback
---

**Découvert le 2026-09-15 (scan 20260915), par contraste, pas par déduction.**

`RefreshBars(symbols=…, timeframe='1d')` en mode `per_symbol` répare correctement l'archive
`bars_daily` : séances manquantes recomblées, bornes OHLC corrigées, `last_bar_complete=true`.
**Mais le même ré-ingest laisse le symbole avec environ quatre observations dans le chemin de
données de `PortfolioRisk(action='correlation')`**, qui répond alors
`only 4 common trading days across symbols, need >= 20` — et ce, quel que soit le partenaire de
paire et quelle que soit la fenêtre demandée.

Preuve par contraste, sur paires isolées le même matin :

| Rafraîchis ce jour-là | Corrélation | Jamais rafraîchis | Corrélation |
|---|---|---|---|
| SOLV, TSM, VLO, REXR, STT, XOP | ❌ « 4 common trading days » | META, AAPL, QCOM, ROIV, FAST, IBIT, KR | ✅ 60 à 120 obs |

Les barres, elles, restent intactes pour les mêmes symboles : 300 séances contiguës, dernière barre
= clôture de référence, zéro violation OHLC. C'est donc un défaut du chemin corrélation côté
serveur, déclenché par le ré-ingest ciblé — pas une perte de données.

**Conséquences pratiques.**

1. Avant de rafraîchir un symbole qui figure (ou peut figurer) au panier publié, savoir qu'on perdra
   sa corrélation pour la journée. Rafraîchir d'abord, sélectionner ensuite, ou l'inverse — mais pas
   les deux en aveugle.
2. Si la matrice est indisponible, la recalculer **localement depuis les mêmes barres certifiées**
   (`_derived/verified-technicals.json`), Pearson sur log-returns, et le DÉCLARER dans
   `editorial.risk_gating.correlation_source`. C'est une dérivation d'entrées certifiées, jamais un
   substitut de fait de marché. Ne pas reprendre une sortie d'un service dégradé.
3. À remonter au propriétaire du service marketdata : le chemin corrélation ne se reconstruit pas
   après un `RefreshBars` per_symbol.

Voir [[feedback-no-full-refresh-before-scan]] (ne jamais refresher l'univers complet) et
[[feedback-witness-vs-maxbar-partial-ingest]] (l'agrégat ment, le témoin par symbole fait foi).
