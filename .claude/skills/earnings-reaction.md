---
name: earnings-reaction
description: Signaux earnings MCP-vérifiés — pré (calendrier + setups à surveiller, pas d'entrée dans le trou) et post (drift sur beat + guidance relevée, gap-and-go) avec niveaux et bilan. Trigger keywords : earnings, résultats, post-earnings, earnings drift, gap and go, beat, guidance relevée, saison des résultats, PEAD.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : 'à venir 5j' ou 'post-résultats' ou un secteur] — sinon les deux volets, US"
license: Apache 2.0
---

# Earnings-Reaction — jouer les résultats + bilan + publication

Deux volets : **PRÉ** (ce qui rapporte cette semaine + les setups à surveiller) et **POST** (le *post-earnings drift* : acheter la force après un beat + guidance relevée). MCP-vérifié.
Appliquer `.claude/skills/source-policy.md` et le harnais de la commande éditoriale qui porte la sortie
(`daily-focus` ou fiches `analyse`). Aucun appel ad hoc non harnaché ne peut gouverner les niveaux.

## ⛔ Règles non négociables
- **Zéro hallucination** — dates/réaction de marché via MCP; résultat et guidance vérifiés dans le release
  IR ou filing primaire, avec MCP comme source numérique de marché. Un snippet n'est pas une preuve.
- **Pas d'entrée swing dans le trou earnings** : pour un SWING classique on DROP ±3 séances (cf `swing-signals`). Ici c'est l'inverse — le trade EST l'événement → le risque de gap est explicite, **taille réduite**, jamais « faux caveat » mais jamais non plus minimiser le gap.
- **Idées ≠ données desk** ; **Telegram `format:"html"` `<b>`** ; **envoi sur demande**.

## ⚡ Exécution (doctrine `perf-parallel-mcp`)
Le goulot = les appels MCP en série. Isoler le MCP en salves parallèles (R2), batcher `QueryData`
multi-symboles (R3), preflight `GetStatus` 1× (R4). **Salve 1** (un seul message, tous les tool_use //) :
`GetEarningsCalendarFiltered(days_ahead=7, min_expected_move_pct=4)` + `QueryData(types="earnings_calendar")`,
`GetMarketContext(facets="overview", as_of=refdate)` seul, `GetMarketContext(facets="regime")` séparé,
et la revalidation des idées passées en `QueryData(types="bars_daily", end_date=refdate)`
batché. **Salve 2** (//, par ticker retenu, multi-symboles dédupés) : données historiques bornées à
`refdate` (`bars_daily`, earnings/fondamentaux/techniques) séparées des données RTH courantes horodatées
(`quote`, options) ; ne jamais étiqueter ces dernières comme clôture. **Salve 3** (//):
`QueryData(types="sec_filings,flags", end_date=refdate)`
(anti-dilution / surprise offering post-résultats). Sélection setup / niveaux / scoring = code local (zéro MCP).
Fail-closed + MCP HARD STOP conservés (la perf n'assouplit aucun invariant).

## Étapes
1. **Bilan** des idées earnings précédentes : statut au spot (a beat/raté, gap tenu ou refermé).
2. **Calendrier** : `GetEarningsCalendarFiltered(days_ahead=7, min_expected_move_pct=4)` + `QueryData types="earnings_calendar"` → qui rapporte, quand (BMO/AMC), move implicite.
3. **PRÉ — qualité du setup** (surveillance, pas d'entrée aveugle) : `QueryData types="earnings_quarterly,financials,analyst_actions,technicals"` → historique de **beats** (≥ combien de trimestres), **guidance** tendance, révisions analystes récentes (up = vent dans le dos), techniques avant le print. Tagger « à surveiller au réveil » — l'entrée se fait APRÈS la réaction.
4. **POST — drift (PEAD)** : après le print, données RTH horodatées ou dernière clôture bornée → si
   **beat + guidance relevée + gap tenu au-dessus de la résistance sur volume** → gap-and-go. Sans volume,
   VWAP et opening range RTH fiables, le statut reste `DATA_INSUFFICIENT`; aucun gap pré-market n'est un setup.
5. **Anti-dilution** rapide (`sec_filings,flags`) + confirmer aucune surprise (offering post-résultats).
6. **Cohérence + régime** (`GetMarketContext`) — un beat en régime hostile drift moins ; persona Strategist.
7. **Sortie digest** (gabarit `swing-signals`) : PRÉ (à surveiller) + POST (jouable, niveaux) + bilan.

## Format de sortie (schéma pivot)
En plus des niveaux (entry/stop/cible — inchangés), émettre pour chaque idée le méta-objet PIVOT commun au desk : `{ signal: 'bullish'|'bearish'|'neutral', confidence: 0-100, reasoning: string }` (contrat + validateur : `tools/lib/signal-schema.js`). `source='earnings'` dans le state partagé du desk (`tools/lib/signals-desk-state.js`). Confidence déterministe, dérivée de la réaction réelle (beat + guidance relevée + gap tenu sur volume ⇒ plus haute ; gap-risk avant print ⇒ prudente) — jamais inventée. Le desk agrège ces pivots (confidence-weighted). Voir signals-desk « Contrat des signaux ».

Voir aussi : `swing-signals`, `aplus-setups` (les 4 éliminatoires incluent guidance relevée + ≥5 beats), `mcp-gateway-tools`.
