---
name: modes-config-baseline
description: "Baseline config + identité des modes LIVE (turbo/dynamic/balanced v10.1/secured=Orbit/fortress) + mandat fortress + leçons régime-agnostiques réutilisables (stale-tightening, DD-breaker %, correlation gate, sweep fixes)."
metadata:
  type: project
---

# Baseline config des modes scriptés

Historique consolidé des refontes v6→v10.1 (juin-juillet 2026). Les modes LIVE actuels décrits ici
sont turbo / dynamic / balanced / secured(label "Orbit") / fortress. Le passé trade-by-trade est
compressé ; on garde l'identité de config courante + les leçons réutilisables.

## (a) Identité & paramètres des modes LIVE

| Mode | ID interne | Profil | Params clés |
|------|-----------|--------|-------------|
| **Turbo** | `turbo` | Risque extrême, day-trade | P=1, H5, ATR 2.5×, maxStop 7 + `inverse_atr`, rotation agressive, stale OFF, dailyTrail 0 |
| **Dynamic** | `dynamic` | Risque haut, swing momentum | P=1, H8, ATR 2.5×, maxStop 7 + `inverse_atr`, momentum-only, stale OFF |
| **Balanced** | `balanced` | Risque moyen, investisseur retail | P=3, H5, **config v10.1-20260701** (voir ci-dessous) |
| **Orbit** | `secured` | Swing patient (ID reste `secured`) | H20, ATR **3.5×**, no BE lock, stale OFF, partial TP 30% à TP1, 2 slots (50% each), minScore 88, filtre mom_bo, CB=3. LIVE (label user-facing "Orbit" ; `#orbit` alias JS → `secured` dans gen-status-page.js ; `#secured` back-compat) |
| **Fortress** | `fortress` | Ultra-low DD AVEC upside | P=4 half-sized, H8, ATR 2.5×, maxStop 8, VIX kill 20, stale OFF, breakout_only en défensif — voir mandat (b) |

- **crossModeDedup = false** : les modes sont des stratégies INDÉPENDANTES (pas de gating cross-mode ;
  même ticker dans plusieurs modes = confirmation). Voir [[modes-independent]].
- Tout changement de config passe par `modes-config-history.json` + le gate `validate-config-change.js`.
- `buildTagline()` dans `gen-status-page.js` auto-génère le how-to depuis la config (plus de texte stale
  hardcodé ; corrige les 12 bugs how-to où `maxStopPct=0` rendait "stop at -0%").

### Balanced v10.1-20260701 (fix P4 — root cause = CONFIG, PAS régime)
Sous-perf balanced diagnostiquée (2026-07-01) comme **config, prouvée par le jumeau** : même ticker/jour/régime,
balanced posait un stop ~2× plus large que fortress (NVDA 06-03 : balanced −9.4% vs fortress −4.0%).
Mécanisme = `sweep.js:684` `effectiveMaxStop = maxStopPct>0 ? maxStopPct : 100` → `maxStopPct=0` = stop
NON capé (100%), combiné à `filterName=momentum_only` (noms high-ATR NVDA/ANET/FCX, stops structurels 7-9%)
+ `sizingMethod=FIXED` (perte 9% prise à taille pleine). turbo/dynamic survivaient au même stop large car
`maxStopPct=7 + inverse_atr` (stop large → position plus petite → risque $ borné) — **le garde-fou que
balanced n'a jamais eu**.

Fix appliqué (décision user GO) : `atrStopMult 0→1.8`, `maxStopPct 5→7`, `trailingStop true` + `trailMultR 2.0`
+ `trailGraceDays 3`, **`sizingMethod inverse_atr`**, `targetRiskPct 1`. Validé gate 30j regime-aware :
full-period **+18.35% vs −13.95%**, MaxDD **−4.16% (≤8%)**, PF 2.09 vs 0.65, WR 55.8% vs 31.7%, OOS
walk-forward +6.7% vs −11.25%, amélioration dans TOUS les régimes. La variante P2 (sans inverse_atr) a un
meilleur return brut mais **viole DD≤8%** → preuve que le **sizing normalisé EST le fix**, pas la respiration
de stop seule. fortress/turbo/dynamic POST-avril restent PF≥1.8 réalisé = régime, pas config → **ne rien
changer** (toute proposition DÉGRADE, gate = WAIT).

## (b) MANDAT FORTRESS (préservé intégralement — clarifié user 2026-06-14, vision "expert senior patrimoine")

Fortress minimise le drawdown **sans brider les returns**. Ce n'est PAS un mode low-return de pure
préservation. C'est un mode **régime-adaptatif** :
- Quand le marché est **euphorique**, il **participe à la hausse** (prend le momentum/upside, ne laisse pas
  d'argent sur la table).
- Mais il garde **toujours en tête qu'un retournement peut arriver n'importe quand** → il reste protégé
  pour limiter le DD.
- Il **sait se mettre en défensif quand il le faut** (régime qui se dégrade).

**Erreur à NE PAS refaire** : recommander "breakout_only partout / ne plus prendre de momentum" — ça
**bride le return**, l'inverse du mandat. De même, "fortress est low-return by design, accepte-le" est FAUX.

**Bonne approche = "participer AVEC parachute"** :
1. Garder l'upside (momentum/mom_bo en risk-on confirmé).
2. **Verrouiller les gains** (trailing stop — était OFF, c'est une lacune) pour qu'un retournement ne rende
   pas les gains d'euphorie.
3. **Éviter le pari unique corrélé** (le cluster IA/momentum de juin 2026 a causé -34% / 100% stop-out car
   4 slots = 1 seul pari). Vrai cap corrélation/thème/beta, pas seulement GICS.
4. **De-risk proactif quand le régime se dégrade** (le label RISK-ON a laggé en juin pendant que le score
   chutait → entrées dans un marché qui tournait). Idéalement : regime-score override du label (code).

Critère de succès : cf [[project-mode-success-criteria]] (≥3× SPY/semaine, DD≤8%). Pour fortress, l'accent
est DD bas SANS sacrifier l'upside. Évaluer par tronçon + walk-forward (cf [[feedback-regime-aware-eval]]),
jamais en replay uniforme. Cause racine juin 2026 : effondrement par cluster corrélé (NVDA/PLTR/AMZN/GOOGL/ANET
entrés 1-4 juin en RISK-ON, tous stop-out le 5 juin à -2.58% SPY) ; les modes mono-position (turbo/dynamic)
ont survécu, les diversifiés (balanced/fortress) non.

## (c) Leçons réutilisables (régime-agnostiques)

- **Stale tightening = le #1 tueur de perf** : remonter le stop à l'entrée après N jours de grâce a causé
  **38-46% de breakevens** (turbo 46%, dynamic 41%, fortress 38%) et laissé **+11 à +64% de profit sur la
  table** (STM aurait fait +11.45% au lieu de 0%, GOOGL +14.99%, AVGO +11.37%, ARM +6.27%). **DÉSACTIVÉ
  partout** (`staleGraceDays→0`, `staleRaiseRate→0`), stops élargis (`atrStopMult→2.5`, `maxStopPct→0/ATR-only
  ou capé) pour compenser. Voir [[modes-config-baseline]] pour le détail chiffré.
- **DD-breaker doit être en % pas en points** : bug — à equity=150, une chute de 4pt (2.7% réel) déclenchait
  le breaker 4% → death-spirals de 14 jours d'inactivité. Fix : `currentDD = ((peak - prior) / peak) * 100`.
- **Correlation gate — bug de signe** : `Math.abs(rho) > cap` rejetait les diversifiers (corrélation négative
  = hedge). Débat design non tranché : Round 2 → `rho > cap` (garde les hedges) ; Round 3 experts → remettre
  `Math.abs` (−0.9 = risque de queue sans alpha). Retenir : c'est une décision design, pas un bug net.
- **Sweep.js — fixes critiques** (war room Round 3) :
  - **FIX-1 (prérequis de tout)** : le grid-search optimizer était DEAD CODE — clé pré-sim 18 champs vs clé
    grid 16 champs → lookup toujours undefined, tous les `advisor_` étaient des valeurs stale préservées
    (d'où les backtests absurdes). Fix : aligner les clés (`_1.5_0`). Sans FIX-1 l'optimizer ne valide rien.
  - **FIX-2** : mutation de score sur objets partagés (`cand.score -= 5` sur l'original → un ETF perd -5 par
    mode = -30 au tour de turbo). Fix : cloner `{ ...cand, score: adjScore }`.
  - **FIX-3** : breakevens comptés comme pertes (`pnlPct <= 0`) → WR/PF déflatés. Fix : `pnlPct < 0` strict.
  - **FIX-4** : equity curve double-entry sur startDate. Fix : initialiser un array vide.
  - **FIX-5** : topN appliqué avant filtrage cooldown (top-1 en cooldown = zéro entrée) → trier par score,
    élargir le pool à topN×3 ; cooldowns ajoutés pour BE/expired/rotated (pas seulement SL).
- **Signal fort, exécution destructrice** : le générateur de signal est solide (+11% moyen 20d sur score≥90,
  ~69% WR) ; c'est la couche d'exécution (stops, DD-breaker, correlation gate, stale) qui détruisait l'alpha.
- **Le score ne prédit pas le WR** : score ≥93 → WR 41% vs score 90-92 → WR 22%. Haut score ≠ haut win-rate.
- **`validate-config-change.js`** enforce la règle [[config-change-backtest]] : gate 30j regime-aware +
  veto dur DD>8% + OOS walk-forward + per-régime, sur deltas A/B relatifs (chemin frozen sweep, PAS l'approx
  statique d'optimize-param qui surestime). Passage OBLIGATOIRE avant tout changement turbo/balanced/dynamic/
  fortress. S'applique aux FUTURS trades (passé immutable, jamais de re-sweep). Lié à [[regime-aware-eval]],
  [[segment-replay-absolute-dd]], [[mode-success-criteria]].

## (d) Stubs d'historique (bits morts/stoppés)

- **Parité v10.2** (réaligner les modes scriptés sur les configs Go 5y : highvol/etf/etf_eu/casablanca/trendline)
  → programme abandonné, dépassé par la bascule vers le moteur MCP dtx (v15). Gap connu à l'époque :
  pit-engine.js = moteur de sortie GÉNÉRIQUE, ne portait pas les logiques sur-mesure des PMs Go.
- **momentum US** : backtest Go 5y (2021-07→2026-07) négatif — CAGR −5.31%, MaxDD 67%, PF **0.92** vs SPY
  +12.98% → mode passé `pausing` (2026-07-02) puis **stopped**. Ne pas repasser live sans re-validation
  positive des params live EXACTS vs SPY.
- **alpha** (mode 7, Nasdaq swing concentré P2/H10/ATR3.0×/trail 2.0R grace 5d, backtest 14 sem +107% mais
  seulement 35 trades) → **stopped**.
- **ai-supply-chain thematic watchlist** : idée non réalisée — le screener DSL rate la supply-chain IA mid-cap
  (HPE +94%, DELL +111%, SMCI/MU +80%, optics/power/networking jamais scannés). Fix proposé jamais implémenté
  (watchlist curée + force-scan sous score 85). Orbit (H20/3.5×ATR) captait partiellement ces moves.
