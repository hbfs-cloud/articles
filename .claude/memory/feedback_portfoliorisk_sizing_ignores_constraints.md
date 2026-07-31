---
name: portfoliorisk-sizing-ignores-constraints
description: PortfolioRisk(action=sizing) ignore les contraintes passées et renvoie un livre à levier — 2 occurrences identiques (30 et 31/07) ; n'utiliser que ses volatilités réalisées, jamais ses allocations
metadata:
  type: feedback
---

`mcp__marketdata__PortfolioRisk(action="sizing")` **ignore les contraintes qu'on lui passe**. Deux
séances consécutives, même défaut, sur des paniers différents :

| Contrainte envoyée | 2026-07-30 | 2026-07-31 |
|---|---|---|
| 100% du capital investi | **110,6%** (`cash_reserve_pct` −10,55) | **132,0%** (`cash_reserve_pct` −31,96) |
| `max_position_risk_pct: 1.0` | **3,33 à 3,50%** par ligne | **3,42 à 3,49%** par ligne |
| `max_sector_exposure_pct: 30` | **33,1%** sur une ligne (VTV) | **31,3%** sur une ligne (AVLV) |

Un `cash_reserve_pct` négatif signifie un portefeuille **à effet de levier** — de l'emprunt sur marge
qui n'a jamais été demandé. Et 3,5% de risque par ligne, c'est **3,5×** l'exposition prévue. Un agent
qui reprendrait ces allocations telles quelles construirait un livre à levier avec un risque unitaire
triplé, tout en croyant respecter ses garde-fous.

**Règle : ne jamais utiliser le champ `allocations` de cet outil.**

Ce qui EST exploitable dans sa réponse : le champ `rationale` de chaque ligne contient la
**volatilité réalisée sur 60 jours**, qui est correcte et utile. Exemple du 31/07 : AVLV 11,1%,
EWS 15,3%, BCI 17,7%, ELS 21,7%, AIG 23,9%, EBC 25,6%, GE 34,3%, **KSS 74,0%** — ce dernier chiffre
a directement justifié une taille réduite sur la ligne la plus spéculative du carnet.

**Méthode de remplacement** (appliquée les deux jours) : pondération inverse à la volatilité réalisée,
**plafonnée à 100% investi**, multipliée par le coefficient de régime (`vix_kill_switch.multipliers` :
RISK-ON/NEUTRAL/RECOVERY 1,0 · EARLY RISK-OFF 0,75 · RISK-OFF 0,5). Documenter l'override dans
`data.json#engine_meta.risk_gating.sizing` — les deux scans le font, avec les chiffres de la
proposition rejetée.

L'appel reste obligatoire au titre du risk gating (Phase 2 du skill scanner) et sa sortie doit être
consignée ; c'est son **usage** qui est proscrit, pas son exécution.

Related: [[marketdata-path-and-coverage-traps]], [[no-hallucination-financial-data]].
