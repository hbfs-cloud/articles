---
name: no-hallucination
description: "Never fabricate financial data (prices, 52W ranges, cash, market cap, burn, dates) or geopolitical events. Fork agents hallucinate these — ALWAYS verify via MCP/WebSearch and fact-check every analysis before publishing."
metadata:
  type: feedback
---

Ne JAMAIS inventer ou halluciner des données financières ou des événements. Deux catégories critiques.

## 1. Données financières dans les analyses ticker
Lors de la génération d'analyses (ALT, IOVA, ALLR — session 2026-06-18, juin 2026), des fork agents ont fabriqué des chiffres. **3 analyses = 31 erreurs factuelles (9 critiques)** :
- **52W ranges** complètement faux : IOVA « $19.89–$28.89 » alors que réel **$1.66–$5.63** (52W entièrement inventé)
- **Cash** : ALT « $225M » au lieu de **$535M** — confusion taille d'offre / cash total
- **Cash/share** : ALT « $1.16 » vs réel **$2.75**
- **Runway** : ALT « 7 trimestres » vs réel **21-27**
- **Market cap** : Pfizer (via ALLR) « $250B+ » surestimé de **$100B+** vs réel ~**$145B** ; ALT « $544M » vs ~**$525M**
- **Niveaux de support / S-R inventés** (ALT)
- **Prévalence MASH** fausse (ALT)
- **Dates** : fondation ALT « 2002 » vs **1997** ; IOV-5001 IND « 10 juin » vs **1er juin**

Le user a réagi très fortement (« tu as fumé ? ») — c'est un problème de crédibilité existentiel.

**Why:** Le modèle n'a pas de données financières fiables dans son training. Tout chiffre financier inventé à partir du « feeling » du modèle est potentiellement catastrophiquement faux. Les **fork agents** qui génèrent des analyses hallucinent particulièrement les 52W ranges, positions de cash, market caps, et niveaux de support/résistance.

**How to apply:**
- **TOUTE donnée chiffrée** dans une analyse ticker doit provenir d'une source vérifiable : MCP QueryData, WebSearch, ou SEC EDGAR. Ne JAMAIS écrire un 52W range, cash, market cap, burn rate, prix, ou date sans source.
- Si MCP est déconnecté, **dire qu'on n'a pas l'info** plutôt qu'inventer (cf [[mcp-hard-stop]]).
- **Fact-check OBLIGATOIRE après toute génération d'analyse**, surtout par un fork agent :
  1. Lancer le workflow adversarial `fact-check-analyses`, OU
  2. au minimum : appeler `GetInstruments` + `QueryData(types=quote)` pour le ticker et vérifier manuellement price, 52W range, market cap, cash position, shares outstanding, revenue, niveaux S/R, dates d'événements clés.
- Ne JAMAIS faire confiance aux 52W ranges, chiffres de cash, ou market caps de concurrents générés par un fork agent — ce sont les plus fréquemment hallucinés.

## 2. Événements géopolitiques / économiques
Ne JAMAIS citer un événement sans l'avoir vérifié via WebSearch ou MCP `GetMarketContext(facets='overview')`. Le modèle a un cutoff (mai 2025) et confond ses connaissances d'entraînement avec la réalité 2026.

> ⚠️ Note 2026-07 (surface MCP v5) : `GetMarketOverview` est un alias serveur legacy (marche encore en HTTP direct) mais n'est plus découvrable via ToolSearch. Canonique : `GetMarketContext(facets='overview')`. Note ajoutée, historique non réécrit.

Voir aussi : [[immutable-trades]], [[mcp-hard-stop]], [[feedback_no_skip]], [[feedback_no_false_caveats]]
