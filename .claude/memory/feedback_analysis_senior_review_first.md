---
name: analysis-senior-review-first
description: "Senior-review AVANT publication + checklist MCP complète (buyback, 13F, FINRA, S-3 par type) — incident TLN 19/07/2026"
type: feedback
---

# Senior-review avant publication + collecte MCP complète (incident TLN)

**Incident (19/07/2026)** : l'analyse TLN a été publiée sans passer le harness `senior-review`.
Résultat, relevé par l'utilisateur puis confirmé par le panel (composite 78, verdict FIXED) :

- **Buyback absent** de l'analyse alors que c'est un critère scoré de la grille A+ (2,0 Md$
  autorisés jusqu'à fin 2028, 1,9 Md$ restants ≈ 10,7% de la mcap).
- **Divulgation dilution fausse** : « aucun S-3 actif » alors qu'un **S-3ASR de revente**
  des 2 399 998 actions ECP (~984 M$) était déposé le 18/06/2026 + un shelf S-3ASR evergreen
  effectif depuis août 2025. Le listing `sec_filings` du MCP ne l'avait pas remonté.
- **R/R fictif** : 1:1,6 affiché mais 1,0 au haut de la zone d'entrée publiée (358-366).
  Corrigé : zone 357-362, R/R 1,57 au pire fill.
- **Collision fenêtre earnings** : un ordre limite dormant pouvait s'exécuter tardivement et
  violer la règle « flat avant le print ». Corrigé : cutoff d'entrée (ordre retiré le 30/07).
- Angles manquants : 13F institutionnels, série FINRA du short, unusual options, peers secteur.

## Règles

1. **`senior-review` AVANT publication** de toute analyse/scan/rétro — jamais en rattrapage.
   Args du workflow : `{"artifacts":[{"path":"...","type":"analyses"}],"applyFixes":true}`.
2. **Checklist de collecte MCP d'une analyse ticker** (en plus du bloc standard) :
   buyback/autorisation restante (8-K résultats), `institutional_holdings` (13F),
   `short_interest` (série FINRA, pas le snapshot stats), `unusual_options`,
   peers du secteur (quote+stats+financials), et **vérification EDGAR par type de formulaire**
   `browse-edgar type=S-3` — le listing `sec_filings` peut manquer un S-3ASR récent.
3. **Le R/R d'une zone d'entrée s'atteste au PIRE fill de la zone** (borne haute pour un
   pullback), jamais au milieu ou à la borne favorable.
4. **Toute correction de niveaux déjà notifiés** (Telegram) exige une notification de mise à
   jour explicite sur le même alias — jamais de correction silencieuse.
5. Les fixes du panel se portent dans le **JSON source** (`data/analyses-data/*.json`), pas
   seulement dans le HTML — sinon le prochain re-render les efface.
