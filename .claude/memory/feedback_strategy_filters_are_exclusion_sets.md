---
name: strategy-filters-are-exclusion-sets
description: STRATEGY_FILTERS_MAP (sweep.js:497) est un jeu d'ENSEMBLES D'EXCLUSION, pas d'admission, et le filtre s'applique AVANT le test minScore — donc « le mélange d'échelles de score a dilué le pool » est faux. Ce qui reste : le champ `score` non borné est une dette technique.
metadata:
  type: feedback
---

**Hypothèse séduisante et FAUSSE**, réfutée lors du post-mortem de juillet 2026 — elle va se
re-proposer, autant la clouer.

**L'hypothèse :** « le mélange d'échelles de score (ETFMomentum médiane 208, max 323, vs Momentum 89)
a dilué le pool des modes historiques et fait entrer des signaux hors échelle ».

**Pourquoi c'est faux, dans le code :**
- `tools/sweep.js:497` — `STRATEGY_FILTERS_MAP` est un jeu d'**ENSEMBLES D'EXCLUSION**, pas
  d'admission. `'all'` (le filtre de turbo) **exclut nommément** `etf_momentum`, `candlestick`,
  `momentum_rotation`, `highvol_breakout`, `trendline_breakout`, `adaptive_fractal`.
- `tools/sweep.js:1473-1474` applique `.filter(t => !activeFilter.has(t.strategy))` **AVANT** le test
  `score >= minScore` : ces stratégies **ne rencontrent jamais** le seuil 90.

**Dans les données :** les trades de turbo sont **100% momentum/breakout/pullback** ; ceux de
dynamic/balanced/secured aussi. Le pool qualité reste à **exactement 10 signaux/scan** pendant toute
l'explosion de débit. Et la **seule fuite réelle** — 6 trades fortress en
`highvol_breakout`/`trendline_breakout`, bien présents dans le fichier scellé — a **RAPPORTÉ +25,4%
cumulé**.

**Ce qui survit, et seulement cela — à traiter comme dette technique, pas comme diagnostic :**
- le champ `score` est une **somme pondérée non bornée** (`tools/casablanca-scanner.js:119`) comparée
  ailleurs à des notes /100 ;
- la cohérence repose sur une **table de tags maintenue à la main** dans `sweep.js`, **doublée d'une
  regex jumelle** dans `gen-status-page.js`.

**Corollaire, même famille :** le contrat sur le champ `strategy` est bien rompu — le fallback
`return 'momentum'` (`tools/sweep.js:189`) est réel, et `stockbox_pit`, `etf_us`, `book_honest`
portent `strategy='momentum'` issu du parsing des `reasons` brutes du moteur. **Mais l'impact P&L est
nul** : le filtre `'dtx_engine'` est un ensemble **VIDE** déclaré exprès après la boucle
`ROTATION_ONLY` (`sweep.js:544-548`), et `tools/dtx-pool-bridge.js` pose
`tp1 = entry + 2×(entry−stop)`, donc `rrRatio = 2,0 ≥ 1,5` et le gate R/R ne rejette rien. Le tag brut
`'IndexRotation'` ajouté par `ROTATION_ONLY` est un no-op (`detectStrategy` ne produit jamais cette
chaîne). L'isolation est assurée par `ASSET_POOL_SOURCES` et `universeFilter`. **Défaut de robustesse
réel, coût P&L nul — à corriger sans urgence.**

**Why:** Confondre « ensemble d'exclusion » et « ensemble d'admission » inverse complètement la
lecture d'un filtre et produit un diagnostic qui *sonne* juste (« des scores 323 face à un seuil 90 »)
alors que les stratégies concernées ne franchissent jamais l'étape du seuil. Deux registres jumeaux
maintenus à la main (sweep + gen-status-page) rendent l'erreur facile à re-commettre.

**How to apply:**
- Avant d'accuser un seuil de score, **vérifier l'ordre des opérations** : filtre stratégie puis
  seuil, ou l'inverse. Ici c'est filtre **d'abord**.
- Toute affirmation de « dilution du pool » doit être testée sur la **composition réelle des trades
  scellés** du mode, pas sur la distribution des signaux émis.
- Dette à traiter un jour : borner/normaliser `score` sur /100 à la source, et **dériver** la table de
  tags de `gen-status-page.js` depuis celle de `sweep.js` au lieu d'en maintenir une regex jumelle.
