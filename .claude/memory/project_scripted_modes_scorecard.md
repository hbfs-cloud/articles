---
name: scripted-modes-scorecard
description: Verdict de fiabilité des modes scriptés (gate liquidité ON). bull=AmericanBulls=artefact (pausing). highvol/etf/etf_eu=KEEP. momentum/trendline/casablanca=à trancher/requalifier.
metadata:
  type: project
---

Mission fiabilisation backtest (2026-07-03) — biais racine = univers tradeable = top-N par mcap
ACTUELLE appliqué à toutes les dates → survivorship + look-ahead (on ne trade que les survivants +
microcaps qui ont explosé APRÈS). Fix : gate liquidité point-in-time (médiane dollar-volume 60
barres ≤ D > $5M), porté du frère systematic-tss (`applyEstablishedLiquidityGate`). Commit 401cbd1ff
(candlestick-scanner). Reste à câbler aux autres scanners.

**Scorecard honnête (systematic-tss 5Y, gate ON) → verdict modes articles :**
- **bull** (candlestick_only = AmericanBulls) : **+435% → -10% CAGR** honnête. Absent du scorecard Go.
  Filtre liquidité mort dans le code (min_avg_dollar_volume jamais lu). = **ARTEFACT** →
  **pausing** 2026-07-03 (commit 21ec5d965), review 2026-08-03. Edge = microcaps look-ahead.
- **highvol** (highvol_breakout) : CAGR **105.8%** / Sharpe **2.05** / WR 56.9% / DD 36%. = **KEEP, champion.**
- **etf** (etf_momentum) : 68.5% / SR 2.14 / DD 15.9% — PASS 5/5. **KEEP** (ETF liquides = pas de biais).
- **etf_eu** (etf_momentum) : 74.8% / SR 2.24 / R² 0.97 — PASS 5/5. **KEEP.**
- **momentum** (momentum_rotation) : déjà `pausing`. **DIVERGENCE** : scorecard Go fév. donne EU
  momentum-rotation 58.3% CAGR / SR 1.47 PASS, mais la mission dit « virer TOUTE la famille
  momentum-rotation (+100%→~0) ». Soit le fév. est pré-gate, soit la mission est plus large. NE PAS
  stopper sans arbitrage user + backtest gaté frais.
- **trendline** (trendline_breakout) + **casablanca** (adaptive_fractal) : pas dans le scorecard Go
  par ce nom. casablanca = famille trend-hybrid-af (KEEP per mission) mais marché marocain. À
  **REQUALIFIER** via backtest gaté avant toute décision. Ne pas toucher.

**Règle** : disabling d'un mode = Mode Status State Machine (`set-mode-status.js`, pausing→stopped),
JAMAIS supprimer les données/trades scellés. Toujours projeter l'impact + laisser le user choisir.
Lié : [[frozen-stats-append-only-advance]], [[segment-replay-absolute-dd]].

## MAJ 2026-07-03 — Clean-slate + constat re-port
User a décidé clean-slate : **10 modes scriptés wipés** (bull/momentum/highvol/trendline/etf/etf_eu/
casablanca + crypto/metals/forex), archivés dans `archive/20260703/scripted-wipe/` (réversible).
PRÉSERVÉS : turbo/dynamic/balanced/secured/fortress/aplus/tkl/alpha (quality/LLM, pas des ports).
Chaîne SHA valide, frozen quality intacts.

**Constat re-port (architectural, important)** : le moteur articles NE PEUT PAS répliquer
fidèlement les stratégies Go. 4 écarts (audit workflow) : (1) params **régime-dépendants** (Go varie
positions/sizing/stops par régime ; articles = constant) ; (2) **pyramiding** non modélisé (ex
ultra-v5 189%→44%) ; (3) gate liquidité absent des scanners survivants (wiré highvol 2026-07-03,
reste etf/forex) ; (4) **pas de scan PIT historique** (articles accumule en marche avant, ne
re-scanne pas 2021-2026 → pas de backtest full-period sans backfill lourd). Donc re-port =
**approximation**, pas réplication. Configs fidèles staged dans `archive/20260703/reports-staging/`
(highvol/etf/forex infraOk ; ultra/hybrid infra à compléter).

**Voie en attente d'arbitrage user** : (a) forward-only gaté (draft modes qui accumulent un track
record honnête en marche avant), (b) étendre le moteur (params régime + pyramiding + backfill PIT),
(c) consommer les signaux Go directement (Go décide, articles affiche). Modes NON déployés tant que
non tranché.

## MAJ 2026-07-03 (suite) — Phase A moteur + gate 4 scanners + état re-port précis
User a choisi option (b) « étendre le moteur ». Fait :
- **Phase A regimeParams** (opt-in) dans sweep.js : A1 `regimeParams.maxPositions` par régime (simulatePortfolio),
  A2 `regimeParams.maxLoss` par régime (simulateTrade via normalizeRegime). Sans regimeParams → comportement
  inchangé. Parité Go dynamic_max_positions/dynamic_max_loss.
- **Gate liquidité établie** (médiane PIT 60j) désormais sur les **4 scanners** : candlestick (401cbd1ff),
  highvol (sync $3M, 73ef20633), **fractal + hybrid (367ddec5d)** — opt-in `--min-established-dollar-volume`
  défaut 0=OFF. Ferme l'écart (3) pour hybridaf.
- **highvol** ré-intégré en `draft` avec regimeParams (347927d6f), config archivée prouvée (PAS la sortie Sonnet).

**État re-port précis par mode (2026-07-03, MAJ soir — hybrid + forex DONE)** :
- highvol → **draft OK** (gate $3M, regimeParams). Commit 347927d6f. Attend Phase D.
- hybrid → **draft OK** (commit c7ad76114). Défaut corrigé : detectStrategy renvoyait 'momentum' pour
  Hybrid-AF/Hybrid-DSL. Ajout pattern `hybrid_af` (sweep) + redéf set filtre `hybrid_af` (admet
  adaptive_fractal+hybrid_megacap+hybrid_af only) + regex SF hybrid_af dans les 2 copies gen-status +
  filterLabel + SCRIPTED_FILTERS. universeFilter=null (americanbull aurait rejeté 100% — hybrid-scanner ne
  tague pas de champ universe). regimeParams. fractal+hybrid déjà dans le pipeline.
- forex → **draft OK** (commit dd38e6c15, workflow Sonnet + revue Fable). Pipeline L295 : générique
  fractal --universe forex REMPLACÉ par forex-scanner.js --output signals (3-axes fidèle, Yahoo direct,
  41 candidats dry-run). sweep consomme déjà forex_pool. Pas de regimeParams (config archivée sans
  variation régime + Go forex config indispo MCP down → non fabriqué ; réconcilier à Phase D).
- uk-selective → **infra absente** (univers/scanner LSE). Spec `docs/specs/uk-selective.md`. BLOQUÉ MCP.
- Phase D (backfill PIT) → spec `docs/specs/phase-d-backfill-pit.md`. BLOQUÉ MCP. **Vrai déblocage.**

**Vrai déblocage = Phase D (backfill scan PIT 2021-2026)** : sans lui aucun re-port draft ne se backteste sur
l'historique → impossible de prouver la fidélité. Prochain gros sous-projet data (spec prête, BLOQUÉ MCP).
Claims Sonnet à re-vérifier systématiquement (3× fausses ce jour : « sweep n'a pas highvol_breakout » → FAUX
L168/439 ; filterName hybridaf `adaptive_fractal` → devrait être `hybrid_af` ; universeFilter='americanbull'
pour hybrid → aurait rejeté 100% des signaux). Modèle de travail : cf [[fable-plans-sonnet-implements]].
