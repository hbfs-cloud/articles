---
name: project_content_commands_harness
description: Décision 22/07/2026 — commandes éditoriales harnachées /daily /weekly /retro /analyse /series (+ /scanner raccordé) avec skill transverse content-harness, gate anti-stale check-freshness.js bloquant, war room retail, senior-review obligatoire. Corrige la sous-utilisation des tools marketdata/systematic.
type: project
---

# Commandes éditoriales harnachées (décision projet, 22/07/2026)

## Contexte
Constat user : « forte sous-utilisation » des tools des connecteurs marché (27 tools disponibles,
~5 utilisés en routine) et absence de commandes pour daily/weekly/retro/analyse/series — seul /scanner
avait un pipeline complet. Les règles anti-stale (MCP HARD STOP > 48h) existaient en prose sans être
bloquantes.

## Décision
1. **Skill transverse `.claude/skills/content-harness.md`** — phases H0→H6 communes : preflight
   (GetStatus/GetHealth, mémoire, anti-doublon), matrice de salves MCP COMPLÈTE par type de contenu
   (incl. tools sous-utilisés : ExplainSymbolMove, GetSymbolSignals, OptionsAnalytics, ScreenOptions,
   WatchlistDigest, GetInsiderActivity, PortfolioRisk, GetInstruments, RunBacktest, DtxRegime/DtxReplay),
   gate fraîcheur, war room retail (Bull/Bear-contrarian/Lecteur), QA locale, senior-review, publication.
2. **`tools/check-freshness.js`** — manifeste `harness.json` par artefact (chaque source avec `as_of`
   RÉEL renvoyé par l'appel) ; exit 1 BLOQUANT si source requise manquante, stale (> max_age_h) ou datée
   du futur (timestamp inventé). Budgets : régime 6h, quotes intraday 2h, clôtures 24h (72 lundi),
   calendriers 24h, insiders/CTB 96h, SEC 168h. `--warn-only` interdit en publication.
3. **Commandes** `.claude/commands/{daily,weekly,retro,analyse,series}.md` (+ `/scanner` raccordé au
   manifeste) — chaque commande spécifie ses salves concrètes, ses budgets, sa war room, son type de
   panel senior-review, sa publication (add_card/radar/Telegram html) et ses erreurs bloquantes.

## Règles durables
- Un contenu publié sans manifeste de fraîcheur validé = bug de process (même si les chiffres sont bons).
- La war room précède la RÉDACTION (l'angle se décide sur données, pas après coup) ; chaque article
  porte au moins une lecture non-consensuelle falsifiable et répond à « et donc ? » côté retail.
- ExplainSymbolMove avant de raconter un mouvement ; RunBacktest avant toute affirmation historique ;
  WatchlistDigest à chaque daily/weekly (IOVA/ALT/ALLR/EQX systématiques).
- Divergence régime marketdata vs dtx > 1 cran = à écrire dans l'article, pas à lisser.

## Références
- Incidents fondateurs : scan 20260722 publié avec risk_gating={} (garde qa-check 25d) ; données
  Tuesday présentées fraîches le Wednesday (règle d'horodatage) ; « 0/10 deserved A+ » (war room).
- Voir : `feedback_pipeline_gotchas`, `senior-review` skill, `perf-parallel-mcp`.
