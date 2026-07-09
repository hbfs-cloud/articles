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

## ⛔ Règles non négociables
- **Zéro hallucination** — dates/EPS/guidance/réaction via MCP uniquement (`feedback_no_hallucination`, `feedback_analyses_factcheck` : les forks hallucinent 52W/cash/mcap).
- **Pas d'entrée swing dans le trou earnings** : pour un SWING classique on DROP ±3 séances (cf `swing-signals`). Ici c'est l'inverse — le trade EST l'événement → le risque de gap est explicite, **taille réduite**, jamais « faux caveat » mais jamais non plus minimiser le gap.
- **Idées ≠ données desk** ; **Telegram `format:"html"` `<b>`** ; **envoi sur demande**.

## Étapes
1. **Bilan** des idées earnings précédentes : statut au spot (a beat/raté, gap tenu ou refermé).
2. **Calendrier** : `GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=4)` + `QueryData types="earnings_calendar"` → qui rapporte, quand (BMO/AMC), move implicite.
3. **PRÉ — qualité du setup** (surveillance, pas d'entrée aveugle) : `QueryData types="earnings_quarterly,financials,analyst_actions,technicals"` → historique de **beats** (≥ combien de trimestres), **guidance** tendance, révisions analystes récentes (up = vent dans le dos), techniques avant le print. Tagger « à surveiller au réveil » — l'entrée se fait APRÈS la réaction.
4. **POST — drift (PEAD)** : après le print, `QueryData types="quote,bars_daily,technicals,unusual_options"` → si **beat + guidance relevée + gap tenu au-dessus de la résistance sur volume** → gap-and-go. Entrée sur tenue du gap / repli au VWAP, stop sous le plus-bas du jour de gap, cible = mesure du gap / prochaine résistance, R/R ≥ 1,5.
5. **Anti-dilution** rapide (`sec_filings,flags`) + confirmer aucune surprise (offering post-résultats).
6. **Cohérence + régime** (`GetMarketContext`) — un beat en régime hostile drift moins ; persona Strategist.
7. **Sortie digest** (gabarit `swing-signals`) : PRÉ (à surveiller) + POST (jouable, niveaux) + bilan.

Voir aussi : `swing-signals`, `aplus-setups` (les 4 éliminatoires incluent guidance relevée + ≥5 beats), `mcp-gateway-tools`.
