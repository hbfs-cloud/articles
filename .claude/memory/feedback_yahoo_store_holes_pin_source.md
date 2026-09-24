---
name: yahoo-store-holes-pin-source
description: Le magasin de barres Yahoo du serveur peut être troué ou aberrant par symbole ; épingler source=tiingo sur l'appel de barres du plan, ou RefreshBars ciblé via jeton scope=refresh (mintable pour ce compte).
metadata:
  type: feedback
---

**Constaté le 2026-09-24 (/daily 20260924 et /analyse ORCL).** Trois défauts du magasin `bars_daily`
(source yahoo par défaut) en une matinée, chacun faisant rejeter un lot `completed_only` entier :

- DIA, 2026-09-22 : open 522,475 > high 522,47 (demi-cent) → tout `bars_indices` rejeté.
- COST/DRI/SNX : séances manquantes (COST 21 et 23/07, DRI 24/07) et barre COST aberrante le
  21/08 (clôture 14 610 au lieu de ~948) → `focus_bars` rejeté. Les `technicals` serveur de COST
  étaient faux (ATR 344, EMA50 1 125 pour un cours à 905).
- ORCL : 46 barres seulement, trou 2024-07-18 → 2026-07-21 → RankBeta (obligatoire) en échec.

**Remèdes qui ont marché.**
1. Ajouter `"source": "tiingo"` à l'appel de barres dans le plan (argument autorisé par le contrat) ;
   un appel à symboles fixes doit être whitelisté dans `static_symbol_calls` de
   `config/workflow-contracts.json`. `adjusted=true` n'existe que pour yahoo : passer en barres brutes.
2. Pour reconstruire un symbole côté serveur : `GetReadOnlyToken(scope='refresh')` fonctionne pour ce
   compte, puis `RefreshBars(symbols='ORCL')` via `tools/lib/mcp-client.js` avec
   `MCP_TOKEN_FILE_MARKETDATA` (fichier scratchpad, supprimé après). Ciblé seulement — jamais
   l'univers (cf [[no-full-refresh-before-scan]]). Effet de bord connu :
   [[refreshbars-breaks-correlation-path]].

**Why:** un lot `completed_only` échoue en bloc pour une seule barre ; sans ce réflexe, on croit à un
MCP hors service et on hard-stoppe à tort, ou on publie des indicateurs calculés sur un historique faux.

**How to apply:** sur un `close contract rejected` / `session continuity failed`, lire la barre en
cause, tester tiingo en `completed_only`, épingler la source dans le plan et le documenter dans la
note de l'appel ; ne jamais publier les `technicals` serveur d'un symbole dont l'historique yahoo est
troué — recalculer depuis les barres certifiées ou omettre.
