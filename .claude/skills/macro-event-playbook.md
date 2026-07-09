---
name: macro-event-playbook
description: Playbook événement/macro MCP-vérifié — positionnement avant CPI/Fed/OPEP/jobs, scénarios (chaud/froid), paniers réactifs (taux/pétrole/or/USD) et consignes de de-risk, + bilan du dernier événement. Trigger keywords : CPI, Fed, FOMC, macro, événement, playbook, OPEP, jobs, NFP, calendrier économique, positionnement, de-risk.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : l'événement ciblé, ex. 'CPI lundi'] — sinon le prochain événement priorité haute"
license: Apache 2.0
---

# Macro-Event Playbook — se positionner autour d'un événement + publication

Cadre le **prochain événement macro** (CPI/Fed/OPEP/jobs), ses **scénarios** et les **paniers réactifs**, avec des consignes de taille/de-risk. MCP-vérifié. Ce n'est PAS un stock-picker : c'est du positionnement de facteur.

## ⛔ Règles non négociables
- **Zéro hallucination** — dates d'événement, consensus, niveaux via MCP/WebSearch de la session (`feedback_no_hallucination`). Ne jamais inventer un chiffre de consensus.
- **Idées ≠ données desk** ; **Telegram `format:"html"` `<b>`** ; **envoi sur demande**.
- **On ne prédit pas l'événement** : on prépare des **réactions conditionnelles** (si chaud → X ; si froid → Y), pas un pari directionnel déguisé.

## Étapes
1. **Bilan** du dernier événement joué : le playbook a-t-il tenu ? (`QueryData types="economic_events,indices,rates,commodities"` autour de la date).
2. **Prochain événement** : `QueryData types="economic_events"` (priorité, date, heure) + `GetEarningsCalendarFiltered`/`is_near_economic_event` → l'événement dominant + son consensus (via news/WebSearch si absent).
3. **État du marché avant** : `GetMarketContext(facets="overview")` → régime, VIX (niveau de stress/attente), positionnement (`sentiment`, prediction-markets si dispo).
4. **Facteurs sensibles** : `QueryData types="rates,commodities,currencies,indices,regime"` → qui bouge sur cet événement (CPI → taux réels/duration/growth ; Fed → USD/financials/duration ; OPEP → énergie/pétrole ; jobs → cyclique).
5. **Scénarios conditionnels** : rédiger 2-3 branches (chaud / conforme / froid) et le **panier réactif** de chaque (long/short le facteur, ETF proxies), + le **de-risk** (réduire l'exposition au facteur menacé avant le print — cf la leçon `feedback_harness_portfolio_coherence` : ne pas être long en aveugle le facteur que l'événement menace).
6. **Cohérence** : persona Strategist — le positionnement proposé doit être cohérent avec le régime et honnête sur le risque de gap.
7. **Sortie digest** : événement + heure → scénarios (si X → faire Y) → de-risk → bilan. « Idées de trading, pas un conseil ».

Voir aussi : `sector-rotation`, `swing-signals`, `mcp-gateway-tools` (economic_events, GetMarketContext).
