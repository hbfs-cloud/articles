---
name: momentum-crash-loss-breakers
description: Les crashs momentum sont invisibles au régime macro (score risk-on + VIX calme pendant le crash) → seuls les coupe-circuits basés sur les pertes réelles du mode protègent, pas les gates de score/régime/VIX
metadata:
  type: project
---

**Finding définitif (2026-07-22, prouvé par MCP).** Le crash momentum juin-juillet 2026 (balanced −53% juin, fortress −27% juil, hybrid −66%, ~0% WR juillet sur presque tous les modes LLM) s'est produit avec un **régime MACRO parfaitement risk-on** : `DtxRegime` switcher 0.70-0.76 (RECOVERY/RISK_ON) sur 06-30→07-08, VIX ~15-17 non-rising, S&P au-dessus de toutes ses MM. Le macro était **structurellement aveugle** — c'était un retournement momentum-spécifique (les stocks momentum/breakout se retournent) que ni le score de régime, ni le label, ni le VIX ne voient.

**Conséquence pour la couche de risque des modes :**
- Un **gate de score/régime/VIX NE PEUT PAS protéger un crash momentum** (à 0.70-0.76 un floor:45 ne tire jamais). Toute « validation » d'un gate-score sur ce crash est un ARTEFACT (cf. le bug de feed ci-dessous).
- Le **SEUL mécanisme qui protège = les pertes RÉELLES du mode** : `circuitBreakerStops` (N SL consécutifs dans une fenêtre → pause), `ddBreakerPct` (drawdown roulant), `maxStopPct` (plafond par-trade, ⚠️ re-freeze). Auto-référentiels, dormants quand on gagne (une win reset le compteur) → n'agissent pas fév-mai par construction.

**Bug de feed associé (corrigé) :** `regimeScore` par scan était contaminé — sur 06-30→07-08 le scan a stocké le score de DÉFENSIVITÉ (0-100, BAS=risk-on, ex. 6.2) au lieu du switcher (0-1, HAUT=risk-on), **direction inverse**. Le feed mélange 3 échelles (0-1, 0-10, 0-100) et 2 directions. `_norm` (`sweep.js`, `v<=1?v*100:v`) gère 0-1 et 0-100 mais PAS 0-10/défensivité. Corrigé les 5 dates via `DtxRegime(expected_data_date=...)`. **Source à standardiser** (le code qui écrit `regimeScore` doit toujours produire le switcher 0-1, jamais la défensivité).

**Méthodologie de backtest de config (versioning point-in-time) :** la config est versionnée (`modes-config-history.json`) ; NE JAMAIS rejouer une config uniforme fév→juil (règle `Regime-Aware Eval`). Baseline fidèle = replay point-in-time versionné (reproduit `frozen_<mode>` byte-exact). Un coupe-circuit s'ajoute en **version FORWARD** (splice scanDate à D, préfixe frozen<D copié octet-pour-octet) → **fév-mai byte-identique par construction** (impossible de tuer les gagnants). Évaluer en **deltas relatifs A/B par segment** (stress vs preserve), jamais l'absolu d'un replay uniforme (`Segment Replay Absolute DD`). Harnais dans `/tmp/warroom2/backtest.js`.

**Bug reporting (corrigé) :** les héros frozen LLM sont restés GELÉS 3 semaines (26/06→21/07) — dashboard affichant le pic pendant que juillet chutait — car l'avance append-only ne tournait plus. Fixé par le commit `35a83c8a` (avance append-only) + garde-fou qa-check « frozen: avance append-only à jour » (❌ si des trades clôturés existent au-delà de la fin de la courbe frozen). Le préfixe frozen n'a JAMAIS été muté (vérifié git : 0 mutation, pics préservés).

**Fraîcheur / force-refresh (nouvelle doctrine) :** données stale ≠ hard-stop d'emblée → forcer `RefreshBars` (marketdata) / `DtxRefreshBars` (systematic), poller `GetStatus`/`GetHealth`, PUIS reprendre. Passer la date de séance en input (`expected_data_date` sur DtxDecide/DtxRegime, `end_date`/`as_of` sur marketdata) pour que le serveur refuse un « monde d'hier » en silence.
