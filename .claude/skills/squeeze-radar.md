---
name: squeeze-radar
description: Radar short-squeeze — croise short interest FINRA, coût d'emprunt (CTB) et flux options inhabituels pour sortir des candidats squeeze MCP-vérifiés, avec timing d'entrée/sortie et bilan des précédents. Trigger keywords : squeeze, short squeeze, short interest, radar squeeze, cost to borrow, CTB, days to cover, gamma squeeze.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : univers/cap mini, ex. '>$1B' ou 'small caps'] — sinon US, cap ≥ $300M"
license: Apache 2.0
---

# Squeeze Radar — candidats short-squeeze + bilan + publication

Sort des candidats **short-squeeze** avec un vrai edge donnée (FINRA + coût d'emprunt + options), le **timing** (entrée ~10j post-settlement, sortie ~30 séances, cf `decision/short-squeeze-strategy` + `docs/strategies/SHORT_SQUEEZE.md`), et le **bilan** des candidats précédents.

## ⛔ Règles non négociables
- **Zéro hallucination** : tout chiffre vient d'un appel MCP de la session (`feedback_no_hallucination`, `feedback_mcp_hard_stop`).
- **Dilution = tueur de squeeze** : les noms à fort short diluent souvent (ATM/S-3). Check dilution OBLIGATOIRE et **DROP** si S-3/ATM/underwriter toxique actif (`feedback_dilution_check`). Un squeeze sur un diluteur en série = piège.
- **Idées ≠ données desk** ; **Telegram `format:"html"` `<b>`** ; **envoi sur demande seulement** (cf skill `swing-signals`).
- **Taille réduite** : un squeeze est haute-volatilité → demi/quart de taille, stop discipliné.

## Étapes
1. **Bilan des candidats passés** : `list_notifications` + `get_context(workspace='dailystocks')` → statut au spot (`QueryData quote,bars_daily`) : a-t-il squeezé (+X%), fait pschitt, ou stoppé ?
2. **Univers short** : `RunScreener(pass_expr="...", ...)` stratégie **short_squeeze** (réel short interest Fintel/ChartExchange), OU `QueryData types="short_interest"` (FINRA bi-mensuel, `days=730`) sur une watchlist → garder **SI% float élevé** (>~15-20%) + **days-to-cover élevé** (>~5).
3. **Confirmation coût d'emprunt** : `QueryData types="ctb,ctb_history"` → CTB élevé et/ou **en hausse** = pression réelle. `short_interest` `source_note` pour la fraîcheur.
4. **Catalyseur + flux** : `QueryData types="unusual_options,dark_pool,news"` → call-buying inhabituel / accumulation dark-pool / catalyseur daté. Pas de catalyseur = pas d'entrée (un short élevé seul ne squeeze pas).
5. **Anti-dilution** (bloquant) : `QueryData types="sec_filings,flags"` + `GetInstruments` → DROP diluteurs.
6. **Timing & niveaux** : entrée ~10 séances après la date de settlement FINRA ; stop sous le plus-bas de base ; cible = résistance / mesure ; sortie ~30 séances OU quand SI%/CTB retombent. R/R affiché.
7. **Cohérence + régime** : `GetMarketContext(facets="overview")` — les squeezes marchent mieux en risk-on/liquidité ; flag si régime hostile. Persona Strategist (`feedback_harness_portfolio_coherence`).
8. **Sortie digest** (gabarit `swing-signals`) : bilan → candidats (SI% / DTC / CTB / catalyseur / entrée-stop-cible-RR) → « idées de trading, pas un conseil ».

## Format de sortie (schéma pivot)
En plus des niveaux (entry/stop/cible — inchangés), émettre pour chaque candidat le méta-objet PIVOT commun au desk : `{ signal: 'bullish'|'bearish'|'neutral', confidence: 0-100, reasoning: string }` (contrat + validateur : `tools/lib/signal-schema.js`). `source='squeeze'` dans le state partagé du desk (`tools/lib/signals-desk-state.js`). Confidence déterministe, dérivée du faisceau réel (SI% float, days-to-cover, CTB↑, call-buying, catalyseur daté) — jamais inventée ; un squeeze reste haute-vol ⇒ confidence prudente. Le desk agrège ces pivots (confidence-weighted). Voir signals-desk « Contrat des signaux ».

Voir aussi : `swing-signals`, `mcp-gateway-tools`, `decision/short-squeeze-strategy`.
