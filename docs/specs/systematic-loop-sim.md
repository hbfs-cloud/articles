# Spec — Boucle systématique unifiée (signal → sizing → simulation → signaux)

**Type** : document chapeau (architecture). Les specs filles (`phase-d-backfill-pit.md`,
`uk-selective.md`, futurs modes) s'y rattachent.
**Statut** : draft d'architecture — implémentable par incréments. **NE PAS committer sans revue.**
**Auteur (plan)** : desk systematic · **Implémenteur cible** : Opus (infra), Sonnet (wiring)

---

## ⛔ Borne de scope (IMPÉRATIVE — lire avant tout)

On construit **vers le systematic** mais on **s'ARRÊTE À LA SIMULATION + SIGNAUX**. La sortie de cette
boucle est **exactement** celle d'aujourd'hui : backtest / sweep / signaux / performance **simulée**,
rendue dans la cmd `/scanner` et la page `scanner/status`.

**HORS SCOPE, sans exception :**
- Aucun ordre réel, aucun broker paper NI live. Les connecteurs `mcp__claude_ai_Broker_Live__*`,
  `mcp__claude_ai_Broker_Paper__*`, `mcp__simulator__sim_place_order`, et
  `tools/trading-executor/run-session.js` (exécution) **ne font pas partie de cette boucle**.
- Aucun état broker de la state-machine : **`deploying`** (ramp-up paper), **`liquidated`**
  (force-close marché) sont **exclus**. On réutilise `tools/lib/mode-status.js` mais **restreint** au
  sous-ensemble de simulation (§7.1).
- Le mot **« live »** dans ce document = **« sim-live »** = *le mode publie des signaux et accumule un
  track-record forward simulé*. Ce n'est **jamais** une exécution en argent réel.

**Livrable = données + pages, pas des trades.** Tout doit être embarquable dans `/scanner` et
`scanner/status/index.html`. Si un incrément nécessite un broker, il est hors de cette spec.

---

## 1. Problème / Contexte

Le repo a déjà toutes les pièces d'une boucle systématique, mais **elles ne partagent pas un contrat
unique**. Trois familles cohabitent sans schéma commun :

1. **Modes scriptés « cœur »** (`highvol`, `etf`, `etf_eu`, `forex`, `stockbox`) — pilotés par le moteur
   systematic-tss via le **MCP dtx** (`mcp__claude_ai_systematic__*`), staging `data/dtx/<id>.json`,
   lus par `tools/gen-status-page.js` (`DTX_STAGING_MAP`).
2. **Modes discrétionnaires-quant** (`turbo`, `dynamic`, `balanced`, `secured`/Orbit, `aplus`,
   `fortress`, `hybrid`) — pilotés par les scanners JS (`tools/*-scanner.js`) → `signals.json` →
   `tools/sweep.js` (track-record frozen, append-only) → `scanner/status`.
3. **Signaux desk** (idées court terme) — `data/signals-ledger.json` via `tools/signals-ledger.js`,
   orchestrés par le skill `signals-desk`, leçons dans `data/signals-lessons.json`.

Chacune a **sa** notion de « signal », de « position », de « perf », **ses** gates, **son** rendu. Résultat :
- pas de définition unique de « ce mode est prêt à publier » ;
- les gardes de sûreté (walk-forward, sanity dtx, immutabilité SHA, `qa-check`, `senior-review`) sont
  **appliquées à des endroits différents**, parfois manuellement, parfois oubliées ;
- impossible d'allouer proprement **entre** modes (barbell / vol-target) faute de contrat de perf commun.

**Objectif de la spec** : définir **un funnel unique** `signal → sizing → SIMULATION → signaux` avec (a)
un **contrat de données** partagé par les trois familles, (b) **les mêmes gates de sûreté à CHAQUE
itération**, (c) une **couche portefeuille barbell** entre modes, et (d) un **critère de fin de build**
(« viable et sûr ») univoque. **Sans jamais dépasser la simulation.**

### 1.1 Profil cible & edges (ce que la boucle doit servir)

Retail **UE peu capitalisé, multi-broker, agile, DevOps**. La boucle doit exploiter les edges accessibles
à ce profil — et **rien qu'eux** :

| Edge | Traduction dans la boucle |
|---|---|
| **Capacity (small-caps)** | Univers small/mid autorisé côté satellite ; le gate $-volume PIT (`calcDollarVolumePercentile`) filtre l'illiquide **sans** exiger un mcap floor institutionnel. |
| **Fiscal (PEA / PEA-PME)** | Flag d'éligibilité par signal/mode (`pea_eligible`, `pea_pme_eligible`) — porté dans le contrat (§4), rendu comme filtre `scanner/status`. Aucune donnée inventée : dérivé de l'`exchange`/`country`/`isin` MCP. |
| **API / automatisation** | Tout se pilote par `/scanner` + scripts node + MCP OAuth2. Zéro saisie manuelle, zéro token en clair. |
| **Event-driven** | `GetEarningsCalendarFiltered` + `days_until_earnings()` / `days_until_economic_event()` gatent les entrées ; les familles `earnings-reaction`, `macro-event-playbook`, `squeeze-radar` alimentent le satellite. |

### 1.2 ⛔ MCP Hard Stop (rappel non négociable)

Toute étape data passe par MCP réel. Si MCP **bloque** (auth/timeout/réseau) ou renvoie **incohérent**
(prix aberrants, NaN, stale > 48 h) : **STOP immédiat**, ne rien fabriquer, alerter, suspendre. Vaut pour
`marketdata`, `systematic`/dtx. Réf : `feedback_mcp_hard_stop`, préflight `GetStatus`/`GetHealth`.

---

## 2. Vue d'ensemble du funnel

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │  0. PREFLIGHT (obligatoire à chaque itération)                 │
                 │     GetStatus / GetHealth (marketdata + dtx) → sinon HARD STOP │
                 └──────────────────────────────────────────────────────────────┘
                                            │
   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   │ 1. SIGNAL     │──▶│ 2. SIZING     │──▶│ 3. SIMULATION │──▶│ 4. SIGNAUX     │
   │ (candidat)    │   │ (position     │   │ (perf simulée)│   │ (sortie)       │
   │               │   │  simulée)     │   │               │   │                │
   │ screener MCP  │   │ vol-target /  │   │ sweep frozen  │   │ signals.json   │
   │ + presets     │   │ inverse-ATR / │   │ append-only   │   │ scanner/status │
   │ + dtx decide  │   │ risk-parity   │   │ + dtx replay  │   │ portfolio/v1   │
   │ + desk        │   │ + barbell     │   │ + walk-fwd    │   │ signals-ledger │
   └───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
          │                    │                    │                   │
          ▼                    ▼                    ▼                   ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  GATES DE SÛRETÉ — appliqués À CHAQUE ITÉRATION (§6), aucun skip silencieux│
   │  G1 backtest walk-forward · G2 sanity · G3 immutable SHA · G4 qa-check 0❌ │
   │  G5 senior-review (adversarial numérique) · G6 barbell/vol-target coherence│
   └──────────────────────────────────────────────────────────────────────────┘
```

Une **itération** = un run `/scanner` (quotidien) OU un run de validation de config. Les **4 étapes** et
les **6 gates** sont les mêmes dans les deux cas ; seule la source des candidats change.

---

## 3. Design — données MCP requises

Tous les noms canoniques v5 (namespace `mcp__claude_ai_marketdata__*` et `mcp__claude_ai_systematic__*`).

### 3.1 marketdata (candidats + enrichment + risque)

| Outil | Rôle dans la boucle | Étape |
|---|---|---|
| `GetStatus` | Préflight santé + fraîcheur (< 48 h) | 0 |
| `RunScreener` (`pass_expr`/`score_expr`, `region`, `asset`, `top_k`, `force_async`) | Génère les candidats. **Ne JAMAIS mettre `market_cap` dans `pass_expr`** (éval à 0 → 0 candidat silencieux) — post-filtrer en code. DSL de réf : `scanner-pipeline.md`. | 1 |
| `RunAutoScreener` | Intensité marché + pool complémentaire | 1 |
| `GetMarketContext(facets='overview')` | Trending / secteurs / calendrier | 1 |
| `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` | Régime + proba (risk-on/early-ro/risk-off/…) → gate `regimeFilters` | 1,2 |
| `QueryData(types=...)` | Enrichment per-ticker : `quote,bars_daily,technicals,sec_filings,flags,insider_transactions,dark_pool,unusual_options,social_sentiment,capital_flow` | 1,3 |
| `GetEarningsCalendarFiltered(days_ahead, min_expected_move)` | Fenêtre earnings ±3 j → disqualif / tag | 1,2 |
| `PortfolioRisk(action='correlation', symbols, lookback_days, method)` | Matrice de corrélation → décorrélation (§5) | 2 |
| `PortfolioRisk(action='sizing', signals, constraints, mode)` | Vol-target / risk-parity sizing | 2 |
| `PortfolioRisk(action='var'|'stress')` | VaR 95 %/5 j + stress → `data/risk-snapshots.json` | 3 |

### 3.2 systematic / dtx (cœur factoriel — SEUL MOTEUR)

Rappel architecture (CLAUDE.md + `scanner-pipeline.md`) : **un subprocess `node` ne peut PAS appeler le
MCP** (OAuth2, zéro token) → le staging dtx est une **étape AGENT** avant le pipeline shell.

| Outil | Rôle | Étape |
|---|---|---|
| `GetHealth` | Préflight dtx — connector absent OU serveur KO → **pas de régénération, alerte, marquer run incomplet** | 0 |
| `DtxRegime(asof)` | Régime moteur (cohérence avec `GetMarketContext regime`) | 1 |
| `DtxDecide(portfolio, asof, balances{base_currency,cash_by_currency,total_equity}, positions, orders, state)` | Décisions du soir → `actions.CREATE/UPDATE/CANCEL` = ordres simulés | 1,2 |
| `DtxReplay(portfolio, from='2021-01-01', to=<statusSince>)` | Backtest → `cagr_pct, max_dd_pct, sharpe, r2, win_rate, total_trades, equity_dates[], equity_values[]` | 3 |
| `DtxJobStatus(job_id)` | Poll async (`async_pending` → `done`) obligatoire | 1,3 |

Ingest unique : `tools/dtx-mcp-ingest.js` → `data/dtx/<id>.json` (`engineMode:"mcp"`), via les helpers
partagés de `tools/dtx-scan.js` (`buildStaging`/`extractReplayMetrics`/`assertReplaySanity`). Mapping
portfolio→mode : `PORTFOLIO_TO_MODE` (`us_highvol→highvol`, `forex→forex`, `etf_us→etf`, `etf_eu→etf_eu`,
`stockbox_nasdaq→stockbox`).

### 3.3 Presets de filtres (bibliothèque versionnée)

`config/signal-presets.yaml` — presets **nommés/versionnés** (ex. `Momentum_Explosion_v5.1`) avec
`pass_expr`/`score_expr` + bracket ATR (`entry_expr`/`sl_expr`/`tp_expr`). Chaque signal est **tagué** avec
le nom du preset → leçons **par preset** (§6.5). Respecter le **caveat timeframe** (RunScreener custom =
daily ; preset 1h/15m non honoré tel quel).

---

## 4. Design — le CONTRAT DE DONNÉES (signal → position simulée → perf)

C'est le cœur de l'unification. Trois schémas chaînés, **partagés par les trois familles**. Objectif :
`sweep.js`, `gen-status-page.js`, `gen-api.js` et `signals-ledger.js` lisent la **même** forme.

### 4.1 `Signal` (candidat validé — sortie de l'étape 1)

Superset des shapes actuelles (`signals.json` pools + `signals-ledger.json`). Champs obligatoires en gras.

```jsonc
{
  "id": "20260709-TXN-momentum",     // <date>-<ticker>-<family|strategy>
  "date": "2026-07-09",              // séance couverte (D+1 après 22h30)
  "family": "momentum",              // momentum|breakout|pullback|pre_squeeze|swing|earnings|squeeze|rotation|macro|FortressA+|adaptive_fractal|highvol|forex|etf|...
  "source": "scanner",               // scanner | dtx | desk  (quelle famille l'a produit)
  "preset": "Momentum_Explosion_v5.1", // null si non issu d'un preset nommé
  "ticker": "TXN", "region": "us", "sector": "semis",
  "direction": "long",               // borne de scope : long-only par défaut côté sim
  "score": 91,                       // 0-98 (jamais 100 ; cf validate-scan)
  "entry": 302, "stop": 287, "tp1": 326, "tp2": 334,
  "rr": 1.6,                         // (tp1-entry)/(entry-stop) — RECALCULÉ par les gates
  "atr14": 9.8, "distance_50dma_pct": 1.4,
  "horizon": 10,                     // séances
  "regime": "risk-on",               // label régime du jour (dérivé data live)
  "thesis": "Semis qualité, stack MM complet, repli MM20",
  "sharia": true,                    // conformité Halal (secteur/dette/intérêts)
  "pea_eligible": false,             // edge fiscal FR — dérivé exchange/country/isin, jamais inventé
  "pea_pme_eligible": false,
  "earnings_clear": true,            // pas d'earnings ±3j (event-driven gate)
  "dilution_clear": true,            // SEC filings propres (S-3/ATM/warrants)
  "flow": { "insiders_30d": 0, "put_call": 0.72, "short_interest_trend": "flat", "dark_pool": null },
  "confidence": "med-high"
}
```

### 4.2 `SimPosition` (position simulée — sortie de l'étape 2)

Un `Signal` + son **sizing** dans un mode donné. **Aucun ordre réel** — c'est une intention chiffrée.

```jsonc
{
  "signalId": "20260709-TXN-momentum",
  "mode": "balanced",                 // mode qui « prend » la position (multi-mode = confirmation)
  "sizingMethod": "inverse_atr",      // inverse_atr | vol_target | risk_parity (cf modes-config)
  "targetRiskPct": 1.0,               // risque par position (% equity mode)
  "weight": 0.18,                     // poids issu de PortfolioRisk(action='sizing') ou barbell (§5)
  "sleeve": "satellite",              // core | satellite (barbell)
  "notional_pct": 12.0,               // % du book mode
  "asof": "2026-07-09"
}
```

Côté cœur dtx, la `SimPosition` **est** un ordre `CREATE` de `DtxDecide` (mappé par `mapOrder()` dans
`dtx-scan.js`). Côté satellite/desk, elle est dérivée du `Signal` + `PortfolioRisk(sizing)`.

### 4.3 `SimPerf` (performance simulée — sortie de l'étape 3)

Deux producteurs, **un** schéma de lecture pour `scanner/status` et l'API :

- **Cœur (dtx replay)** : métriques agrégées, **pas** de tableau per-trade → `data/dtx/<id>.json`
  (`equity_dates[]`, `equity_values[]`, `cagr_pct`, `max_dd_pct`, `sharpe`, `r2`, `win_rate`,
  `total_trades`, `engineMode:"mcp"`, `metricsSuspect?`).
- **Satellite/desk (sweep)** : trades fermés **append-only** + `frozen_*` dans `data/backtest-results.json`,
  chaîne SHA-256 dans `data/trade-chain.json`. Ledger desk : `data/signals-ledger.json` (statuts
  `triggered/tp1/tp2/stopped/expired/skipped` + `outcomeR`).

Schéma de perf **lu par le dashboard** (union) :
```jsonc
{
  "mode": "balanced",
  "engine": "sweep",                  // sweep | dtx
  "equity": { "dates": [...], "values": [...] },
  "metrics": { "cagr_pct": 0, "max_dd_pct": 0, "sharpe": 0, "win_rate": 0, "n_trades": 0, "pf": 0 },
  "sleeve": "satellite",
  "frozen": true,                     // sweep: scellé append-only ; dtx: engineMode==mcp
  "asof": "2026-07-09"
}
```

**Invariant SEALED-PRIMARY** (déjà testé par `qa-check`) : le hero `scanner/status` = **une seule**
courbe scellée (sweep OU dtx), jamais un mélange « Sim backtest » + « Strategy ».

---

## 5. Design — couche PORTEFEUILLE (barbell + vol-target + décorrélation)

Allocation **entre modes**, au-dessus du contrat §4. Fichier proposé : `data/portfolio-alloc.json`
(généré, non édité main), consommé par `gen-status-page.js` (bloc « Allocation ») et `gen-api.js`.

### 5.1 Barbell (cœur factoriel + satellite tactique)

- **Cœur factoriel (sleeve `core`)** = les modes **dtx** systematic (`highvol`, `etf`, `etf_eu`,
  `forex`, `stockbox`) — track-record long (2021→), faible discrétion, gate établi $-volume. C'est la
  masse stable du barbell.
- **Satellite tactique (sleeve `satellite`)** = modes scanner discrétionnaires-quant (`turbo`,
  `dynamic`, `balanced`, `secured`, `aplus`, `fortress`, `hybrid`) **+** signaux desk — court terme,
  event-driven, capacity small-cap. Petite poche à convexité.
- **Rien au milieu** : pas de mode « moyen » qui dilue. Chaque mode déclare `sleeve` dans
  `modes-config.json` (nouveau champ, défaut dérivé : dtx-wired → `core`, sinon `satellite`).

### 5.2 Vol-targeting / risk-parity entre modes

Poids `core`/`satellite` puis intra-sleeve par **vol-target** (poids ∝ 1/σ du mode) ou **risk-parity**
(contribution au risque égalisée), calculés via `PortfolioRisk(action='sizing', mode='vol_target')` sur
les equity curves §4.3. Cible de vol du barbell paramétrable (`config/portfolio-barbell.json` :
`{ target_vol_annual, core_floor, satellite_cap, per_mode_cap }`). **Aucun levier** (profil retail).

### 5.3 Concentration décorrélée

- Corrélation **inter-modes** via `PortfolioRisk(action='correlation')` sur les equity curves : deux
  modes `rho > 0.85` → le barbell **fond** le plus faible Sharpe dans l'autre (pas de double compte).
- Corrélation **intra-mode** déjà gérée (`correlationCap`, `sectorCapMax`, gates
  `correlated-pool-exposure-cap` de `scanner-lessons.json`).
- Objectif : **concentré mais décorrélé** — peu de lignes, faible corrélation deux-à-deux, pas de
  dispersion façon indice.

> ⚠️ Les métriques absolues d'un replay segment sont **non fiables** (`feedback_segment_replay_absolute_dd`).
> Toute décision d'allocation A/B se fait sur **deltas relatifs** (même modélisation les deux bras) ou
> sur les `frozen_*` scellés — jamais sur un DD absolu recalculé à la volée.

---

## 6. Gates de sûreté — À CHAQUE ITÉRATION (obligatoires, aucun skip silencieux)

Ordre d'exécution ; un échec = **on ne publie pas** l'artefact concerné (le reste peut passer).

### G0 — Préflight MCP (bloquant global)
`GetStatus` (marketdata) + `GetHealth` (dtx). Bloqué / stale > 48 h / connector absent → **HARD STOP**,
alerte Telegram `alerts`, run marqué incomplet. Jamais de fabrication (`feedback_mcp_hard_stop`).

### G1 — Backtest walk-forward (bloquant sur changement de config)
Tout changement de config d'un mode `core`/satellite passe `tools/validate-config-change.js` :
- fenêtre **30 j** (`WINDOW_DAYS`) qui **bat** l'actuel (return ↑, DD pas pire de +1 pt) ;
- **OOS** (`OOS_FRAC = 0.70`) qui ne dégrade pas ;
- delta full-period positif ; **DD full ≤ 8 %** (veto dur — critère mode-success).
Verdict `GO`/`WAIT` (`evalGate`). **Jamais** d'éval par replay uniforme plein-période
(`feedback_regime_aware_eval`) : regime-aware + walk-forward. Réf gate : `validate-config-change.js:evalGate`.

### G2 — Sanity (garde dtx + bornes métriques)
`dtx-mcp-ingest.js` appelle `assertReplaySanity()` (`tools/dtx-scan.js`) contre
`config/dtx/_sanity-baselines.json` : `|max_dd| > 50 %`, `sharpe < 0`, `win_rate ∉ [15,92]`,
`cagr < -5 %`, `total_trades` hors [0,4×…2,2×] baseline → staging `metricsSuspect:true`, **exit code 7**,
et `qa-check` échoue en dur. Réaction obligatoire : **ne pas publier** le mode, alerter, re-`DtxReplay`
avant ré-ingest. Tripwires universels (DD/sharpe/wr/cagr) même sans baseline. Étend le principe aux modes
sweep : rejet d'un mode dont les métriques sortent des bornes plausibles.

### G3 — Immutabilité (trades scellés)
`tools/lib/trade-integrity.js` : chaîne **SHA-256** dans `data/trade-chain.json`. `sweep.js` **avorte** sur
violation. Append-only : jamais réécrire un trade fermé ni ses stats (`feedback_immutable_trades`,
`feedback_sweep_psize_history` : `portfolioSize` historisé, pas de batch-reset sans consentement). Le
backfill PIT (spec fille) écrit dans un **namespace séparé** — jamais par-dessus le forward scellé.

### G4 — `qa-check` 0 ❌ (bloquant publication)
`node tools/qa-check.js` (30+ checks) **zéro ❌**. Checks-clés déjà en place : `scanner/status > 20KB` +
signaux présents, R:R ≥ 1.5 tous signaux, `distance_50dma ≤ cap`, SEALED-PRIMARY, staging dtx complet (5
modes frais), sanité métriques dtx, VaR présent si position ouverte, pas de `undefined`/cellule vide,
cohérence Pending↔Open. `--strict` = exit 1. Complément éditorial : `tools/qa-content.js --strict` +
`tools/check-ai-tells.js`.

### G5 — `senior-review` adversarial **numérique** (bloquant avant post/publish)
Harness `.claude/workflows/senior-review.js` (skill `senior-review`), personas Quant / Trader / Risk /
Strategist / **AI-Forensics**. **Checks numériques RECALCULÉS** (le harness recalcule, il ne relit pas —
post-mortem 10/07) pour chaque signal publié : (a) `R/R_TP1 = (tp1-entry)/(entry-stop) ≥ 1.5`,
(b) `(entry-stop)/ATR14 ≥ 1.5`, (c) earnings ≤ J+12 → flag présent, (d) chaque claim data tracé à un
appel MCP de la session, (e) ligne FLUX présente et cohérente. Gate **PASS / FIX / BLOCK** — BLOCK = ne
pas publier ce signal. AI-Forensics BLOCK le « style IA » (`EDITORIAL_STYLE.md`).

### G6 — Cohérence barbell / vol-target (bloquant portefeuille)
Le panier net (barbell §5) est réduit à son facteur (béta / growth-value / duration / cyclique-défensif /
concentration). **BLOQUE** si le narratif contredit le book, si un event proche menace le facteur net
sans flag, ou si la vol réalisée du barbell dépasse la cible `config/portfolio-barbell.json`
(`feedback_harness_portfolio_coherence`).

**Traçabilité des gates** : chaque itération écrit un reçu `data/loop-gates-<date>.json`
`{date, G0..G6: {status, detail}, modesGenerated[], modesSkipped[]}`, lu par le rapport de fin `/scanner`
et affiché en pied de `scanner/status`. **Un run avec un ❌ ne peut pas se dire « complet ».**

---

## 7. Intégration (fichiers concrets à toucher)

### 7.1 State-machine — sous-ensemble simulation (⚠. pas de broker)

Réutiliser `tools/lib/mode-status.js` mais **restreindre** le cycle de vie de cette boucle à :

```
draft ──▶ test ──▶ sim-live ──▶ pausing ──▶ paused ──▶ stopped
                       ▲            │
                       └── (resume)─┘  (paused ──▶ sim-live)
```

- `sim-live` = alias sémantique de l'état `live` **dans le contexte simulation** : le mode publie des
  signaux + accumule un track-record forward simulé. **Aucun argent.**
- **Exclus de cette boucle** : `deploying` (ramp paper broker) et `liquidated` (force-close marché) —
  ce sont des états d'exécution, hors scope §Borne.
- Implémentation : un helper `simTransitions` qui **dérive** une table depuis `VALID_TRANSITIONS` en
  (a) retirant `deploying`/`liquidated` ET (b) **rajoutant** l'arête directe `test → sim-live`.
  ⚠️ Retirer `deploying` **ne suffit pas** : dans la state-machine réelle `test` ne transite que vers
  `['deploying','draft']` (aucun `test → live` direct — la seule voie vers `live` passe par `deploying`).
  Un simple filtre échouerait donc le mode à `test` (cul-de-sac). Le wrapper doit donc **remapper**
  `test → sim-live` en court-circuitant le ramp paper `deploying`. `paused → sim-live` (resume) existe
  déjà (`paused: ['live','stopped']`). **Ne pas modifier** la state-machine générale (d'autres process
  l'utilisent) — on l'**enveloppe** ; le remap vit dans le helper sim, pas dans `mode-status.js`.

### 7.2 `/scanner` (skill `scanner-pipeline` + `publish-daily-card.sh`)
Le funnel §2 **est** le pipeline `/scanner` existant, formalisé. Points d'ancrage :
- Étape 1 : Phase 1 (RunScreener × N + presets + `RunAutoScreener`) + étape AGENT dtx (`DtxDecide`).
- Étape 2 : Phase 2 risk-gating (`PortfolioRisk` sizing/correlation) + barbell §5.
- Étape 3 : `tools/sweep.js` (satellite) + `dtx-mcp-ingest.js` (cœur) + `tools/refresh-risk-metrics.js`.
- Étape 4 : `tools/gen-status-page.js` + `tools/gen-api.js` + `signals-ledger.js` (desk).
- Gates G0–G6 câblés aux endroits §6 ; reçu `data/loop-gates-<date>.json` écrit en fin.

### 7.3 `modes-config.json`
Ajouter par mode (rétro-compatible, défauts dérivés) : **`sleeve`** (`core`/`satellite`),
**`engine`** (`dtx`/`sweep`), **`pea_eligible`**/**`pea_pme_eligible`** (indicatif univers).
Ne jamais éditer à la main les stats scellées. Historiser via `modes-config-history.json`.

### 7.4 `signals.json` (par scan) & `signals-ledger.json` (desk)
Aligner sur le schéma `Signal` §4.1 (superset — les champs déjà présents restent, on **ajoute**
`source`, `preset`, `sleeve`, `pea_eligible`, `flow`). `scanner-parser.js:loadSignals()` fusionne les
pools ; `signals-ledger.js` porte déjà `family`/`outcomeR` → ajouter `preset`/`source`.

### 7.5 `scanner/status` (`gen-status-page.js`)
Lit le contrat `SimPerf` §4.3 pour **tous** les modes (sweep + dtx, déjà le cas via `DTX_STAGING_MAP`).
Ajouts : bloc **Allocation barbell** (`data/portfolio-alloc.json`, core vs satellite + poids vol-target),
filtre **PEA/PEA-PME**, pied **reçu de gates** (`data/loop-gates-<date>.json`). Respecter l'invariant
SEALED-PRIMARY et les checks `qa-check`.

### 7.6 `sweep.js` & `gen-api.js`
`sweep.js` reste le producteur append-only du satellite (frozen, SHA chain). `gen-api.js` publie
`portfolio/v1/*` — ajouter l'endpoint/bloc **allocation barbell** + le champ `sleeve` par mode. Aucun
endpoint broker.

### 7.7 Leçons (boucle d'amélioration)
`tools/lessons-engine.js` (39 règles `scanner-lessons.json`, decay/validate/promote) pour le satellite ;
`signals-ledger.js lessons` → `signals-lessons.json` (win-rate + R **par famille × régime**, et **par
preset**) pour le desk. Les leçons **pondèrent** (jamais n'inversent ni ne créent) un signal quantitatif
(`feedback_regime_aware_eval`).

---

## 8. Critère de « fait » — VIABLE ET SÛR (clôt le build)

Le build de cette boucle est **terminé** quand, pour **chaque mode destiné à publier** (`sim-live`) et
pour le **portefeuille barbell** agrégé, **tous** les points ci-dessous sont verts **simultanément**, sur
un run réel piloté par MCP (jamais simulé/mocké) :

**Par mode**
1. **Walk-forward (G1)** : `validate-config-change.js` = `GO` — bat l'actuel sur 30 j **et** OOS
   (`OOS_FRAC 0.70`) **et** full-period ; **DD full ≤ 8 %**.
2. **Mode-success** : bat SPY **≥ 3×** sur la fenêtre récente, **max DD ≤ 8 %** (`data/bench-spy.json`).
3. **Sanity (G2)** : métriques replay/sweep **dans les bornes** `_sanity-baselines.json` ; aucun
   `metricsSuspect`.
4. **Immutabilité (G3)** : chaîne SHA `data/trade-chain.json` **intacte** (`sweep.js` ne bronche pas).
5. **Contrat** : `Signal`→`SimPosition`→`SimPerf` (§4) **complet et lu** par `gen-status-page` + `gen-api`.

**Au niveau portefeuille**
6. **Barbell (§5)** : sleeves `core`/`satellite` déclarés ; vol réalisée ≤ cible
   `portfolio-barbell.json` ; aucune paire de modes `rho > 0.85` non fondue.
7. **QA (G4)** : `qa-check.js --strict` = **0 ❌** ; `qa-content.js --strict` = 0 ; `check-ai-tells.js`
   propre sur tout contenu publié.
8. **Senior-review (G5)** : gate **PASS** (checks numériques recalculés OK, AI-Forensics OK).
9. **Cohérence (G6)** : panier net ↔ thèse cohérent, event proche flaggé.
10. **Reçu** : `data/loop-gates-<date>.json` daté du jour, `complete:true`, `modesSkipped:[]`.

**Et — condition de scope, non négociable —**
11. La sortie est **exclusivement** : `signals.json`, `scanner/status/index.html`, `portfolio/v1/*`,
    `signals-ledger.json`, notifications. **Zéro** appel broker (`rb_live_*`, `rb_paper_*`, `sim_place_order`),
    **zéro** état `deploying`/`liquidated`, **zéro** exécution. Si un incrément en exige un → il **sort**
    de cette spec.

Tant que **l'un** de ces 11 points est rouge, le build **n'est pas fait** : soit régénérer, soit
**alerter + marquer incomplet** — jamais publier en silence, jamais fabriquer de donnée.

---

## 9. Références (fichiers concrets)

- **Pipeline / gates** : `.claude/skills/scanner-pipeline.md`, `tools/qa-check.js`,
  `tools/validate-config-change.js`, `.claude/workflows/senior-review.js` (skill `senior-review`),
  `tools/qa-content.js`, `tools/check-ai-tells.js`.
- **Simulation** : `tools/sweep.js`, `tools/lib/trade-integrity.js`, `data/backtest-results.json`
  (`frozen_*`), `data/backtest-trades.json`, `data/trade-chain.json`.
- **dtx (cœur)** : `tools/dtx-scan.js`, `tools/dtx-mcp-ingest.js`, `data/dtx/*.json`,
  `config/dtx/_sanity-baselines.json`, `data/dtx/_staging-completeness.json`.
- **Modes / state** : `data/modes-config.json`, `data/modes-config-history.json`,
  `tools/lib/mode-status.js`, `tools/lib/MODE_STATUS.md`.
- **Rendu / API** : `tools/gen-status-page.js`, `tools/gen-api.js`, `portfolio/v1/*`.
- **Desk / leçons** : `data/signals-ledger.json`, `tools/signals-ledger.js`, `data/signals-lessons.json`,
  `tools/lessons-engine.js`, `data/scanner-lessons.json`, `config/signal-presets.yaml`, skill `signals-desk`.
- **Nouveaux (à créer)** : `data/portfolio-alloc.json`, `config/portfolio-barbell.json`,
  `data/loop-gates-<date>.json`.
- **Specs filles** : `docs/specs/phase-d-backfill-pit.md`, `docs/specs/uk-selective.md`.
- **Contexte produit** : `PRODUCT.md`, `DESIGN.md`, `EDITORIAL_STYLE.md`, CLAUDE.md (racine + sous-dossiers).
```
