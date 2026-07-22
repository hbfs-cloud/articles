# /series — Épisode de série harnaché (workflow dédié → données réelles → panel → publish)

Produit un épisode dans `series/` via le skill **`content-harness`**. Quatre séries ont un workflow
exécutable dédié (source de vérité) : `journal-performance-series.js`, `plan-de-trading-series.js`,
`portfolio-lifecycle-series.js`, `salarie-investisseur-series.js` (`.claude/workflows/`). Une série
sans workflow = rédaction manuelle sous le même harnais.

## Arguments
`$ARGUMENTS`
- `<nom-serie>` (ex. `journal-performance`) → prochain épisode de la série.
- `<nom-serie> --episode N` → épisode explicite.
- vide → lister les séries et le prochain épisode dû de chacune, puis demander.
- `dry-run` → tout sauf publication.

## Phase 0 — Preflight (H0)
`date -u` ; `GetStatus()` (HARD STOP si down) ; `get_context(query='serie <nom>', workspace='dailystocks')` ;
lire `data/series.json` (anti-doublon épisode + continuité de numérotation/nav inter-épisodes) ;
créer `series/<slug>/harness.json`.

## Phase 1 — Collecte (H1, selon la série)
- **Journal de performance / lifecycle** : les chiffres viennent des GÉNÉRATEURS (`data/backtest-results.json`
  frozen_*, `data/backtest-trades.json`, `portfolio/v1/*`) et des modes scriptés via `DtxReplay`
  (courbe replay = référence). JAMAIS un chiffre de perf retapé à la main. `RunBacktest` pour toute
  affirmation « historiquement, X marche » — on la teste ou on ne l'écrit pas.
- **Plan de trading / pédagogie** : exemples ancrés dans le marché RÉEL de la semaine —
  `GetMarketContext(facets='overview'|'regime')`, `QueryData(types='quote,trading_signals')`,
  `OptionsAnalytics` (term structure pour les épisodes volatilité), `GetEarningsCalendarFiltered`
  (épisodes earnings). Un exemple inventé est un bug : le lecteur doit pouvoir vérifier chaque niveau.
- **Salarié investisseur** : données macro/taux réelles datées (WebSearch + overview), fiscalité vérifiée
  par WebSearch avec source datée.
Tout dans `harness.json` avec `as_of` réels.

## Phase 2 — Gate fraîcheur (H2, bloquant)
`node tools/check-freshness.js series/<slug>/harness.json` — un épisode pédagogique cite peu de données
chaudes mais celles qu'il cite sont fraîches ou explicitement datées (« au 22 juillet 2026 »).

## Phase 3 — War room retail (H3)
Le chapeau Retail DOMINE ici : qu'est-ce que le lecteur sait FAIRE à la fin de l'épisode qu'il ne
savait pas faire avant ? Bear vérifie : promesses de perf interdites, biais de survivant, exemples
cherry-pickés (montrer aussi un cas qui a échoué). Continuité : relire l'épisode précédent, tenir les
promesses faites (« on verra au prochain épisode… »).

## Phase 4 — Rédaction / workflow
Série à workflow : `Workflow({scriptPath: ".claude/workflows/<serie>.js", args:{...}})` puis relecture
du rendu. Sinon : HTML conforme aux conventions (brand-bar, FAB, `/assets/report.css`, `data-tab="series"`,
tags taxonomie, nav épisode précédent/suivant des DEUX côtés).

## Phase 5-6 — QA + Panel (H4-H5, bloquants)
`qa-content --strict` + `check-ai-tells --strict` + `check-freshness`, puis senior-review
`type:"series"` (QA·Quant·Risk·Editor), applyFixes ; BLOCK = pas de publication ; re-QA après fixes.

## Phase 7 — Publication (H6)
1. `node tools/add_card.js series/<slug>/<episode>/index.html` — **add_card APPEND pour series** :
   remonter la carte en tête + vérifier la nav de l'épisode précédent (lien « suivant » à ajouter).
2. Commit + push `main` ; Telegram alias `learning` en `format:"html"` ; compte-rendu chat.

## Garde-fous
- Zéro promesse de rendement ; pédagogie = exemples réels vérifiables, y compris les échecs.
- Perfs passées du desk : uniquement frozen stats des générateurs, avec période exacte.
- MCP HARD STOP + interdits `content-harness` (jargon interne, chiffres hors session).
