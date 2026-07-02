---
name: no-hallucinated-events
description: "Never fabricate financial data (prices, 52W ranges, cash, market cap) or geopolitical events. Always verify via MCP/WebSearch before writing."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6580fd4d-4c8a-4082-83d9-1579ac7940c8
---

Ne JAMAIS inventer ou halluciner des données financières ou des événements. Deux catégories critiques :

## 1. Données financières dans les analyses ticker
Lors de la génération d'analyses (ALT, IOVA, ALLR en juin 2026), le modèle a fabriqué :
- **52W ranges** complètement faux (IOVA "$19.89–$28.89" alors que c'est $1.66–$5.63)
- **Cash** (ALT "$225M" au lieu de $535M — confusion offre/cash total)
- **Cash/share** (ALT "$1.16" vs réel $2.75)
- **Runway** (ALT "7 trimestres" vs réel 21-27)
- **Market cap** (Pfizer "$250B+" vs $145B ; ALT "$544M" vs ~$525M)
- **Dates** (fondation ALT "2002" vs 1997, IOV-5001 IND "10 juin" vs 1er juin)

Le user a réagi très fortement ("tu as fumé ?") — c'est un problème de crédibilité existentiel pour les analyses.

**Why:** Le modèle n'a pas de données financières fiables dans son training. Tout chiffre financier inventé à partir du "feeling" du modèle est potentiellement catastrophiquement faux.

**How to apply:**
- **TOUTE donnée chiffrée** dans une analyse ticker doit provenir d'une source vérifiable : MCP QueryData, WebSearch, ou SEC EDGAR
- Ne JAMAIS écrire un 52W range, cash, market cap, burn rate, prix, ou date sans source
- Si MCP est déconnecté, **dire qu'on n'a pas l'info** plutôt qu'inventer
- Lancer un fact-check workflow adversarial après toute génération d'analyse
- Vérifier systématiquement : prix actuel, 52W range, market cap, cash, shares outstanding, dates d'événements clés

## 2. Événements géopolitiques/économiques
Ne JAMAIS citer un événement sans l'avoir vérifié via WebSearch ou MCP GetMarketOverview. Le modèle a un cutoff mai 2025 et confond ses connaissances d'entraînement avec la réalité 2026.

> ⚠️ Note 2026-07 (surface MCP v5) : `GetMarketOverview` est un alias serveur legacy (marche encore en
> HTTP direct) mais n'est plus découvrable via ToolSearch. Canonique : `GetMarketContext(facets='overview')`.
> Note ajoutée, historique non réécrit.

Voir aussi : [[feedback_no_skip]], [[feedback_no_false_caveats]]
