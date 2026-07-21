---
name: sector-rotation
description: Rotation sectorielle & leaders de force relative (RS) MCP-vérifiés — quels secteurs surpondérer/sous-pondérer maintenant selon le régime + les leaders RS de chaque secteur favorisé, avec bilan de la rotation précédente. Trigger keywords : rotation, rotation sectorielle, force relative, RS, leaders, quel secteur, surpondérer, sous-pondérer, sector tilt.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : horizon ou région] — sinon US, vue tactique ~1-4 semaines"
license: Apache 2.0
---

# Sector Rotation — tilt sectoriel + leaders RS + publication

Vue **top-down** : quels secteurs sur/sous-pondérer *maintenant*, et dans les secteurs favorisés, les **leaders de force relative** (les swings bottom-up viennent de là). MCP-vérifié.

## ⛔ Règles non négociables
- **Zéro hallucination** — perfs/RS/régime via MCP (`feedback_no_hallucination`).
- **Régime dérivé des données live**, pas d'un label (`rule/derive-regime-from-live-data`) : `GetMarketContext facets=overview` + `RunAutoScreener` intensité.
- **Idées ≠ données desk** ; **Telegram `format:"html"` `<b>`** ; **envoi sur demande**.

## ⚡ Exécution (doctrine `perf-parallel-mcp`)
Le goulot = les appels MCP en série. Isoler le MCP en salves parallèles (R2), batcher `QueryData`
multi-symboles (R3), preflight `GetStatus` 1× (R4). **Salve 1** (un seul message, tous les tool_use //) :
`GetMarketContext(facets="overview")` + `QueryData(types="performance_rotations,indices,sentiment,rates,commodities,currencies")`
(régime + classement secteurs + bilan) + `RunScreener` leaders RS (`perf_rank`/`perf_rel`). **Salve 2** (//):
`QueryData(types="quote,technicals", symbols=…)` des leaders RS candidats (multi-symboles dédupés) pour confirmer la RS au spot.
**Salve 3** (//): pas de validation par titre ici — cohérence tilt↔régime en code local. Décision/scoring = code local (zéro MCP).
Fail-closed + MCP HARD STOP conservés (la perf n'assouplit aucun invariant).

## Étapes
1. **Bilan** de la rotation précédente : les secteurs surpondérés ont-ils sur-performé ? (`QueryData types="performance_rotations,indices"` + comparer aux ETF secteurs).
2. **Régime** : `GetMarketContext(facets="overview")` → régime, VIX, indices, breadth ; en **total-return** pour toute compa vs benchmark dividende (`rule/compare-rendement-total-return`).
3. **Classement secteurs** : `QueryData types="performance_rotations,sentiment,rates,commodities,currencies"` → momentum relatif par secteur + le fond macro (taux ↑ → value/financials ; risk-off → défensif/santé/staples ; pétrole ↑ → énergie ; etc.). Sortir un **tilt** clair : surpondérer X/Y, sous-pondérer Z.
4. **Leaders RS par secteur favorisé** : `RunScreener(score_expr incluant perf_rank('sector','',20))` ou `perf_rel` → top 2-3 noms en force relative dans chaque secteur retenu, filtrés cap ≥ $2B (floor manuel).
5. **Cohérence** : le tilt doit s'accorder avec le régime (pas « risk-on » + tilt 100% défensif). Persona Strategist (`feedback_harness_portfolio_coherence`). Flag l'événement proche (CPI/Fed).
6. **Sortie digest** : tilt (surpondérer / sous-pondérer, 1 raison chacun) → 2-3 leaders RS par secteur favorisé → bilan. « Idées de trading, pas un conseil ».

## Format de sortie (schéma pivot)
En plus du tilt et des leaders RS (inchangés), émettre pour chaque leader/secteur le méta-objet PIVOT commun au desk : `{ signal: 'bullish'|'bearish'|'neutral', confidence: 0-100, reasoning: string }` (contrat + validateur : `tools/lib/signal-schema.js`). `source='sector'` dans le state partagé du desk (`tools/lib/signals-desk-state.js`). Confidence déterministe, dérivée de la force relative réelle (perf_rank secteur, momentum relatif, cohérence macro) — jamais inventée. Le desk agrège ces pivots (confidence-weighted). Voir signals-desk « Contrat des signaux ».

Voir aussi : `swing-signals` (pour transformer un leader RS en entrée jouable), `macro-event-playbook`, `mcp-gateway-tools`.
