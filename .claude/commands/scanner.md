# /scanner — Full scanner pipeline (MCP → publish → downstream → QA)

End-to-end scanner pipeline for the next trading session.

**Ici = l'ORCHESTRATION** (séquence, commandes exactes, invariants bloquants). **Le détail vit dans le
skill `scanner-pipeline`** — DSL, dtx, carte du downstream, checklists, error handling, gotchas datés, le
« pourquoi » de chaque règle. Charger `Skill(skill="scanner-pipeline")` au démarrage ; `§X` = sa section.

## ⛔ INVARIANTS BLOQUANTS

1. **NO-SKIP** — rien n'est skippé sans accord explicite du user en session ; tokens/temps ≠ raison. →§NO-SKIP
2. **Contrat de date** — `refdate` dans TOUS les args, `expected_data_date` (dtx), `end_date`/`as_of` (marketdata) ; variable non fournie = erreur, jamais un vide. →§Collecte scriptée
3. **Freshness** — `check-freshness.js <dossier>/harness.json` **exit 1 = publication INTERDITE** ; `--warn-only` interdit en pipeline. →§Manifeste de fraîcheur
4. **`--no-push` obligatoire en Phase 4** — aucun `git push` avant la Phase 8. →§Phase 4
5. **Panel AVANT push** — les 7 relecteurs tournent avant la mise en ligne, jamais en rattrapage (`analysis-senior-review-first`, violée le 22/07). →§Phase 6
6. **`risk_gating` non vide** — `data.json#engine_meta.risk_gating` = ensemble_confidence, crisis_prob_5d, max_pair_correlation, avg_off_diagonal_correlation, sizing ; vide = scan NON conforme. →§Phase 6
7. **R/R depuis le MIDPOINT** (jamais `entry_low`), ≥ seuil régime : RISK-ON 1.5 · RECOVERY/NEUTRAL 1.7 · EARLY RISK-OFF/RISK-OFF 2.0. →§Phase 3
8. **VWAP entry gate** always-on : `min(open_next, VWAP_next)` clampé `day_low` ; `open > entry_high × 1.02` → pullback VWAP seul. →§Phase 3
9. **`_pipelineOrder` + `_memoryImpact`** top-level obligatoires dans `signals.json` (gate G4 : earnings screené sur le vivier COMPLET avant enrichissement). →§Phase 3
10. **`earnings_source: "8k_item_202"`** — jamais le calendrier prévisionnel (gate G4, incident 20260730). →§Phase 3
11. **La mémoire ne peut JAMAIS inverser un signal quantitatif** — ajuste confiance/sizing/tag après le crible quanti ; jamais reject↔select, jamais d'override d'un `hard_block`. →§Phase 0.8
12. **Zéro fabrication** — MCP HARD STOP (force-refresh d'abord), aucun VaR/rho/prix inventé, fail-closed sur staging manquant. →§Invariants

## Input

`$ARGUMENTS` :
- *(vide)* — auto-detect next trading day, pipeline complet avec validation
- `--date YYYYMMDD` — cible une date de scan précise
- `--skip-validation` — skip du panel 7 agents. **RÉSERVÉ à un run interactif avec accord explicite du
  user dans la session. INTERDIT aux routines / runs autonomes** (invariant 5).
- `--skip-downstream` — stop après publish (ni `compute` ni `distribute` : pas de sweep, status page, API,
  push, Telegram)
- `--dry-run` — `data.json` seulement, ni publish ni push

## Phase 0 — Collecte scriptée, date, anti-doublon, mémoire

Collecte **SCRIPTÉE** (obligatoire depuis 2026-08-10) : émets un jeton, lance la collecte, lis les
artefacts — ne joue plus les salves MCP à la main. → §Collecte scriptée

```bash
# 1. l'AGENT émet le jeton (max 60 min marketdata, 1440 systematic)
#    GetReadOnlyToken(minutes=60) / DtxMintReadOnlyToken(ttl_minutes=240)
#    → export MCP_TOKEN_MARKETDATA=… MCP_TOKEN_SYSTEMATIC=…
# 2. les TROIS chaînes en parallèle : A vivier+enrichissement · B dtx · C tracking+sweep
bash tools/scan-parallel.sh <YYYYMMDD> <derniere_cloture> <asof>
```

⛔ **La chaîne C (update-tracking + `sweep.js --quick`) fait partie du scan** — c'est le SEUL endroit
du pipeline qui fait tourner le sweep (`downstream-split.sh compute` ne le lance PAS, et `distribute`
appelle `publish-daily-card.sh --no-sweep`). Sauter scan-parallel = livre `backtest-trades.json` gelé
(incident : aucun sweep entre le 13/08 09:15 et le 16/08/2026 — modes sans nouvelles entrées, fortress
à sec). `run-collect.sh scanner-wave1` seul = chaîne A uniquement, N'EST PAS un substitut.

Reste à l'agent seul : `RefreshBars`/`DtxRefreshBars`, sélection, rédaction, gates adversariaux, décision
de publier.

1. Date cible : semaine avant 22h30 → aujourd'hui ; après 22h30 → D+1 ; vendredi soir → lundi (D+3) ;
   samedi/dimanche → lundi.
2. `data/scanner.json` → **abort si entrée déjà présente** à la date cible.
3. Scan précédent (`ls scanner/ | sort | tail -1`) → anti-doublon (min 70 % nouveaux = max 3 repeats /10).
4. `data/scanner-positions.json` (tickers bloqués, zéro overlap) + `data/scanner-filters.json`
   (sector_map + diversification).
5. Modes downstream = **5** (catalogue 2026-08-11) : `best` (dtx), `turbo`, `dynamic`, `balanced`,
   `fortress` (secured/tkl morts).
6. Pre-flight gotchas :
   `~/.claude/projects/-Users-marketwatchxyz-GolandProjects-articles/memory/feedback_pipeline_gotchas.md`.
7. Mémoire : `node tools/lessons-retrieve.js --regime <REGIME>` (`--setups`/`--mode` une fois connus),
   JAMAIS `scanner-lessons.json` brut. Alimente le **débat de sélection Phase 2**, ne bloque pas au
   publish ; les `hard_block` restent appliqués par `scanner-filters.json` + `validate-scan.js`
   indépendamment. Croiser `_open_questions` (`next_retro_check ≤ today`) → rapport en QA Phase 6.
   Invariant 11. → §Phase 0.8

## Phase 1 — MCP Data Collection

En parallèle, un seul message :

```
mcp__claude_ai_marketdata__GetMarketContext(facets="overview")   # async, seul (pas combinable) — canonique, ex-GetMarketOverview
mcp__claude_ai_marketdata__RunAutoScreener()
mcp__claude_ai_marketdata__RunScreener(expression="...", region="us")   # 3 DSL strategies
mcp__claude_ai_marketdata__RunScreener(expression="...", region="eu")
```

Poller via `Jobs(job_id=...)`. Extraire : régime, VIX, SPX ; movers, secteurs, thèmes ; candidats + scores.
DSL vérifié → §MCP DSL Syntax. 🔴 **Borner la capitalisation en littéraux numériques** (`market_cap>2e9`,
`avg_volume>1e7`) — la notation `$2B` n'est PAS du DSL valide (échec de compilation → vivier VIDE
silencieux, vérifié 2026-08-10) ; sans borne mcap le screener ne rend que des penny stocks. Manifeste de fraîcheur (`as_of` réel : régime 6 h, quotes/calendriers 24 h, insiders
96 h, SEC 168 h) → invariant 3, §Manifeste de fraîcheur.

## Phase 2 — Ticker Selection & Validation

Règles (`scanner-filters.json`) : score ≥ 90 · min 3 confluences · min 5 US + 2 EU + 1 APAC + 2 ETFs ·
max 3/secteur · max 3 repeats · zéro overlap positions ouvertes · aucun earnings ±3 séances.
39 règles (hard blocks / selection filters / advisories) → §Pre-Flight Rule Checklist ; gate par signal →
§Phase 2b.

**Checks per-ticker OBLIGATOIRES — CHAQUE candidat top-10 ET CHAQUE entrée `tkl_pool`** (une salve
multi-symbole, jamais 1 agent/ticker) :

```
mcp__claude_ai_marketdata__QueryData(symbols="TICKER", types="sec_filings,flags", days=180)
mcp__claude_ai_marketdata__QueryData(symbols="TICKER", types="quote,social_sentiment,insider_transactions,dark_pool,unusual_options,trading_signals")
mcp__claude_ai_marketdata__GetEarningsCalendarFiltered(days_ahead=7)   # + check DSL days_until_earnings('T') <= 3
```

Anti-dilution v2 (`dilution_risk_score ≥ 70`, shelf, ATM, underwriter agressif, warrants ITM, PIPE) →
disqualifier ; earnings ±3 séances → disqualifier/taguer ; événement économique par devise
`is_near_economic_event(currency, min_priority=2, within_days=3)` → écarter/taguer. → §Checks per-ticker

**Risk gating (OBLIGATOIRE) — avant de figer le top 10 :**

```
mcp__claude_ai_marketdata__GetMarketContext(facets="regime", model="ensemble", horizon_days=5)
mcp__claude_ai_marketdata__PortfolioRisk(action="correlation", symbols="TICK1,TICK2,...", lookback_days=60, method="pearson")
mcp__claude_ai_marketdata__GetEarningsCalendarFiltered(days_ahead=7, min_expected_move=4)
mcp__claude_ai_marketdata__PortfolioRisk(action="sizing", signals=[...], constraints={mode:"balanced", max_position_risk_pct:1.0, max_pairwise_correlation:0.7}, mode="balanced")
```

Seuils (`crisis > 0.30` / `early_risk_off > 0.50` → top 5 + breakout_only + taille ×0.5 ; `rho > 0.85` ;
`avg_off_diagonal > 0.65`), `symbols` en CSV **US-only** (`.PA` casse le calc), fallback concentration
manuelle si l'endpoint est cassé — **jamais de rho inventé**. Invariant 6. → §Risk Gating

**Sharia** : taguer chaque setup ; `data-sharia="true|false"` sur la ligne `<tr>` **ET** le
`<div class="setup-card">`. **TKL pool** : MÊME pipeline de validation (seuls seuils relâchés : mcap $10M,
ADV $2M), batché par 4-6, aucun ticker n'entre sans avoir tout passé. → §TKL Pool

## Phase 3 — Data Generation

`data.json` conforme à `scanner/template/schema.json` + `signals.json`. Labels de stratégie UNIQUEMENT :
Momentum, Breakout, Pullback, Pre-Squeeze. Invariants 7-10 ici. Champs obligatoires par signal
(`extension{rsi,atr,distance_50dma_pct}`, `earnings_clear`, `dilution_clear`, `region`, `earnings_source`),
schémas JSON de `_pipelineOrder`/`_memoryImpact` et sémantique des champs, détail du VWAP gate → **§Phase 3**.

## Phase 4 — Render & Publish (LOCAL — rien ne devient public ici)

```bash
node tools/render-scanner.js scanner/YYYYMMDD/ --strict   # bloque si data.json désaccentué/tronqué (garde qualité amont)
node tools/check-freshness.js scanner/YYYYMMDD/harness.json   # exit 1 = publication INTERDITE
node tools/qa-check.js                                        # lit signals.json, pas le HTML — 0 ❌ exigé
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify --no-push
```

Invariant 4. Si la validation publish échoue (violations de filtres) → retour Phase 2 avec les violations
précises, re-sélection.

## Phase 5 — Downstream Pipeline (skip avec `--skip-downstream`)

Coupure CALCUL / DIFFUSION (obligatoire depuis 2026-08-11) : la Phase 5A tourne dans le **même
`parallel()`** que le panel de Phase 6 ; la diffusion attend la Phase 8.

```bash
# AVANT : l'AGENT produit /tmp/risk-mcp.json (GetMarketContext regime + PortfolioRisk var/stress par mode
#         AVEC positions) — un subprocess node ne peut pas appeler le MCP (OAuth2, ZÉRO token).
bash tools/downstream-split.sh compute YYYYMMDD YYYY-MM-DD
```

- ⛔ **Phase 5.5 fortress-pm (AI-driven, OBLIGATOIRE, PAS scriptable)** : AVANT `compute`, invoquer
  `Skill(skill="fortress-pm")` et écrire la clé **`fortress_pool`** dans `signals.json`
  (candidats A+ Halal factcheckés, `strategy:"FortressA+"`, `sharia:true` ; `[]` = 0 légitime).
  Clé ABSENTE → `scanner-parser.js` retombe en `fortress_fallback` (top-10 sharia score≥92,
  quasi toujours vide) → les panneaux fortress/aplus s'assèchent. Incident : scans 13-17/08/2026
  sans la clé = fortress 0 ordre pendant une semaine. Détail : skill `scanner-pipeline` §Phase 5.5.
- `compute` = ingest dtx (decide **ET** replay), history-append, pont `dtx_pool`, `gen-status-page`,
  `gen-api`/`gen-mode-cards`/`daily-synthesis`, `qa-check`. Local, idempotent, rejouable ; il prend un
  **verrou** (s'il attend, laisse-le attendre). `risk-snapshots.json` > 12 h → il échoue (voulu, ne pas
  contourner avec `RISK_MAX_AGE_H`).
- **dtx : DECIDE *ET* REPLAY obligatoires** par config (incident 2026-07-23 : `--decide` seul = dashboard
  frozen), lots **≤3** (au-delà : 502), back-off 60 s, poll `DtxJobStatus`. → §dtx refresh
- Les relecteurs de Phase 6 **ne modifient aucun fichier** pendant que `compute` tourne.
- Carte annotée du downstream, Telegram via MCP notification, avertissements (candlestick supprimé, aucune
  exécution broker, connector marketdata instable, `capital_flow` invalide) → **§Downstream**.

**Rejouer `compute` ? critère mécanique** — le constat du panel touche-t-il `data.json`/`signals.json` ?

```bash
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-before.txt
# … corrections du panel, re-render, re-validation …
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-after.txt
diff /tmp/scan-hash-before.txt /tmp/scan-hash-after.txt   # différent → relancer compute
```

Niveau faux, R/R erroné, ticker retiré → **relance `compute`**. Tournure, lien, réserve éditoriale → non.

### Phase 5b/5c — optionnels (5b : hebdo ou bascule de régime · 5c : ad-hoc) → §Phase 5b, §Phase 5c

```bash
node tools/regime-recalibrate.js                      # dry-run report
node tools/regime-recalibrate.js --apply              # apply (append to config-history.json)
node tools/regime-recalibrate.js --force --apply      # bypass stability gate
node tools/rolling-walk-forward.js                    # rolling 10-day window
node tools/rolling-walk-forward.js --days=20          # rolling 20-day window
```

### Post-Pipeline Checklist

`qa-check` à **0 ❌** (investiguer chaque échec, pas seulement les ⚠️), pas de « Pending » stale, stats hero
= `frozen_*` sur les 6 modes, API non-null, intégrité des trades, `risk-snapshots.json` non-stub, gate TKL,
BSD date fallback. Conditions exactes → **§Post-pipeline checklist**.

## Phase 6 — Multi-Agent Validation (skip UNIQUEMENT en interactif avec accord user)

Invariants 5 et 6. Spawner **7 agents de validation en parallèle** — Trader, Risk, Quant, Analyst, QA, Dev,
UX — chacun renvoyant PASS/WARN/FAIL par zone de check avec les correctifs requis. Rôles et focus détaillés
→ **§Phase 6**.

## Phase 7 — Fix & Re-Verify (si la Phase 6 remonte des problèmes)

1. Collecter tous les FAIL et WARN des 7 agents
2. Corriger `data.json` (scores, R/R, strategy labels, erreurs factuelles)
3. Re-render : `node tools/render-scanner.js scanner/YYYYMMDD/`
4. Re-jouer la validation publish
5. Re-spawner les agents en échec pour vérifier les correctifs
6. Itérer jusqu'à PASS partout (**max 3 itérations**, puis stop + rapport au user)

## Phase 8 — Final Commit & Notify

C'est ici — et **seulement** ici — que quelque chose devient public.

```bash
bash tools/downstream-split.sh distribute YYYYMMDD   # image + QA avant push + commit + push
```

`distribute` appelle `publish-daily-card.sh --no-sweep --no-telegram` ; le Telegram part ensuite via le MCP
notification (AGENT, `format:"html"`, aucun terme interne). Avec `--no-sweep`, seuls la carte,
`scanner-metrics.json` et `scanner-positions.json` sont stagés → ajouter les artefacts de `compute`
**CIBLÉS (jamais `-A`)** :

```bash
git add scanner/YYYYMMDD/ data/scanner.json data/scanner-history.json
git add scanner/status/ portfolio/v1/
git add data/backtest-results.json data/backtest-trades.json data/risk-snapshots.json data/dtx/
git commit -m "feat: scanner YYYYMMDD — auto-published"
git push origin main
```

Le `git push` de `distribute` emporte aussi le commit local de la Phase 4 — un seul moment de mise en
ligne. Avec `--skip-downstream`, ni `compute` ni `distribute` n'ont tourné : commit + push entièrement à ta
charge. → §Phase 8

## Error Handling

Screener vide · scores DSL tous à 0 · EU vide · sweep timeout · Telegram KO · `refresh-risk-metrics`
auth-fail · boucles Phase 6 > 3 · TKL pool vide → conduites à tenir détaillées en **§Error Handling
(/scanner)**. Règle transverse : dégrader honnêtement, alerter bruyamment, **ne jamais fabriquer**.
