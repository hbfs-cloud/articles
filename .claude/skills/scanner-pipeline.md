---
name: scanner-pipeline
description: Scanner daily pipeline + risk gating + parametric optimization. Auto-load when user says scanner, scan du jour, sweep, regime, risk gating, optimize-param, dilution, Sharia, or works in scanner/**, tools/sweep.js, tools/optimize-param.js. Includes Mountain Plateau methodology, anti-patterns, append-only pipeline.
user_invocable: false
---

# Scanner / Scan du jour

## ⛔ NO-SKIP POLICY (CRITICAL)

JAMAIS skipper une étape du pipeline (anti-dilution, MCP enrichment per ticker, risk gating, earnings/economic event proximity, validation) sans accord explicite du user. Token/temps ≠ raison valable. Si une étape semble trop coûteuse, demander explicitement avant. Default = exécution complète.

Ceci vaut pour CHAQUE candidat top-10 **et** chaque entrée `tkl_pool` — la liste exacte des checks
per-ticker obligatoires est en §"Phase 2 — Checks per-ticker OBLIGATOIRES".

## ⚡ Collecte scriptée (`run-collect.sh`) — OBLIGATOIRE depuis 2026-08-10

**Ne joue plus les salves MCP à la main.** L'agent émet un jeton, lance la collecte, lit les artefacts.
Le modèle déclare le besoin ; il ne transporte plus la donnée.

```bash
# 1. l'AGENT émet le jeton (max 60 min marketdata, 1440 systematic)
#    GetReadOnlyToken(minutes=60) / DtxMintReadOnlyToken(ttl_minutes=240)
#    → export MCP_TOKEN_MARKETDATA=… MCP_TOKEN_SYSTEMATIC=…
# 2. collecte parallèle + gate de fraîcheur en une commande
bash tools/run-collect.sh scanner-wave1 <dossier>/_data --var refdate=<derniere_cloture> [--var symbol=X]
```

Ce que ça règle mécaniquement, et qu'on oubliait :
- `$refdate` est substitué dans TOUS les arguments → le contrat de date devient structurel,
  plus aucun `end_date` oublié (cause des inversions de signe du weekly du 10/08) ;
- `harness.json` est un sous-produit de la collecte → une source collectée mais non déclarée
  devient impossible ;
- les appels d'une vague partent en parallèle → la règle R2 de `perf-parallel-mcp` est dans le
  moteur, plus dans un rappel de prompt.

Une variable référencée par le plan mais non fournie est une **erreur**, pas un vide : un
`end_date` absent renverrait « le monde d'aujourd'hui » au lieu de la date visée.

Reste à l'agent, et à lui seul : `RefreshBars` / `DtxRefreshBars` (vraies écritures), la
sélection, la rédaction, les gates adversariaux, la décision de publier.
Doctrine complète : skill `llm-script-boundary`.

## ⚡ EXÉCUTION RAPIDE (ORDRE CANONIQUE — cible : phase agent/MCP ≤ 5 min)

**⚠️ GARDE-COÛT (incident 2026-07-22, 4.3M tokens / 28 min pour un scan) : la Phase 2 validation NE se
fait JAMAIS en 1 agent/ticker.** Le per-ticker (anti-dilution/enrichment/earnings/technicals) = UNE salve
`QueryData` **multi-symbole** sur toute la shortlist (perf-parallel-mcp **R3+R7**), puis raisonnement sur
le pré-fetché (idéalement 1 agent). En Workflow : la salve MCP vit dans la phase `data`, **jamais**
`parallel(tickers.map(t => agent(…qui appelle le MCP…)))`. Le nb d'appels MCP scale avec les TYPES, pas les tickers.

Doctrine : **`perf-parallel-mcp`** (R1-R7). Le goulot historique = les ~150 appels MCP joués EN SÉRIE.
On ne retire **aucune** étape (no-skip) — on change la FORME : **isoler tout le MCP en salves parallèles,
scripter l'assemblage en node, backgrounder le pipeline lourd.** Les Phases 0-5 ci-dessous restent la
SPEC de ce que chaque étape fait ; cette section dicte l'ORDRE d'exécution rapide.

1. **Prep + manifeste** (Phase 0) : lire les inputs de prep, puis `node tools/scan-plan.js` → écrit
   `/tmp/scan-plan.json` (le plan de TOUS les appels MCP, en vagues). Lire ce fichier.
2. **SALVE 1 — contexte + univers** (UN seul message, tous les `tool_use` en //). Tirer
   `waves.wave1_context_universes` : preflight `GetStatus` + 4 `RunScreener` US + `RunAutoScreener` +
   `GetMarketContext` overview/regime + `economic_events` + `GetEarningsCalendarFiltered` + les 5
   screeners d'univers. **Dumper chaque réponse brute → `/tmp/mcp-raw/<key>.json`.** Preflight KO →
   MCP HARD STOP (alerter, ne rien fabriquer).
3. **SALVE dtx — PAR LOTS de ≤3** (`waves.wave_dtx_batches`) : l'origine dtx **sature en burst (502
   Cloudflare sur 12 appels simultanés, run 2026-07-22)**. Tirer un lot, attendre, lot suivant ; **retry
   un 502/5xx après ~60s**. Poller `DtxJobStatus` pour les DtxReplay. Dumper bruts → `/tmp/mcp-raw/dtx_*.json`.
   **⚠️ Ne PAS raisonner sur les payloads inline** : écrire chaque réponse en `/tmp/mcp-raw/` (Bash) et
   traiter via node/jq (les gros résultats sont déjà auto-sauvés en fichier). top_k ≤25 pour borner le contexte.
4. **Résoudre les barres** : `node tools/scan-plan.js --resolve-bars` → `/tmp/scan-plan-bars.json`
   (dédup cross-scanner des candidats des screeners). **SALVE 2** (//): tirer `wave2_static_bars` +
   `wave2_dynamic_bars` en `QueryData bars_daily` **multi-symboles** (lots ~15), forme POSITIONNELLE
   **`{symbols:[…ordre exact…], result:<brut>}`** → `/tmp/mcp-raw/bars_*.json`.
5. **Assembler (node, zéro MCP)** : `node tools/scan-ingest-all.js` → écrit candlestick/metals/hybrid
   staging (mécanique), les `price-stage-*`, les `<scanner>-bars-bundle.json`, et **ingère dtx**
   (`dtx-mcp-ingest.js`, garde sanity exit 7 respectée). Pour les scanners PRE-SCORÉS
   (highvol/momentum/factor/etf/forex/trendline-*), appliquer la **formule de score documentée**
   (Phase 1/1c) sur le `<scanner>-bars-bundle.json` **en local** (aucun round-trip) → écrire le
   `/tmp/<scanner>-stage.json` final.
6. **SALVE 3 — validation** (//, Phase 2) : `sec_filings/flags/insider/dark_pool/unusual_options/earnings`
   par candidat, batchés en un message ; `PortfolioRisk` correlation+sizing ; `GetMarketContext regime`
   pour le gating. Appliquer les gates Phase 2/2b sur données en main (no-skip intégral).
7. **fortress-pm** (Phase 5.5) : `Skill(skill="fortress-pm")` — ses fetchs (quote/technicals/regime) sont
   déjà batchables ; écrire `fortress_pool` AVANT gen-status-page.
8. **Pipeline node** : lancer `node tools/sweep.js` UNE fois (≈5-7 min, CPU-bound), puis
   `tools/publish-daily-card.sh --no-sweep --no-telegram` (le `--no-sweep` évite le DOUBLE sweep de 7 min
   — bug d'aujourd'hui ; `--no-telegram` = pas de notif token-based). Le Telegram part ENSUITE via le MCP
   notification connecté (`send_message` par l'AGENT, HTML, zéro terme interne). Surveiller la fin
   (fraîcheur staging dtx, QA 0 ❌) via un monitor ; ne pas rester bloqué dessus.
   ⚠️ Connector `marketdata` instable (redéploiements serveur) : se déregistre après quelques appels →
   l'utilisateur relance `/mcp`. Batcher au max ; gros payloads → fichiers `tool-results`, parser jq/node.
9. **signals-desk** : écrire le handoff `/tmp/scan-context.json` (regime, VIX, indices, earnings, données
   candidats DÉJÀ fetchées) puis `Skill(skill="signals-desk")` → il réutilise le handoff (zéro re-fetch)
   et poste le digest. (signals-desk reste invocable seul par ailleurs.)
10. **Rapport final** : modes générés vs skippés, gates G1-G4, dtx completeness, dtx suspects (exit 7),
    digest signals-desk. Ne jamais écrire « scan complet » si `qa-check` remonte un ❌.

**Invariants (perf n'assouplit rien)** : MCP HARD STOP, fail-closed (staging non écrit si brut
manquant/`mcp_ok:false` — jamais fabriqué), no-skip, zéro hallucination. Vérif A/B : le `signals.json`
et les `/tmp/*-stage.json` du chemin parallèle doivent être identiques au chemin série (mêmes pools,
mêmes `_scanRuns`).

## ✅ MCP DSL Syntax — Référence (source: `GetDSLDescription`, vérifié 2026-06-25)

### Séries numériques (utilisables dans pass_expr ET score_expr)
`close`, `open`, `high`, `low`, `vol` (alias `volume`), `hlc3`, `ema20`, `ema50`, `ema200`, `sma50`, `sma200`, `atr14`, `atrpct`, `rsi14`, `obvz`, `bbw`, `hhv20`, `llv20`, `hhv50`, `llv50`, `vwap`, `vwapstd`, `px` (alias `ref`)

### Context (pass_expr uniquement pour comparaisons)
`market_cap` (alias `marketcap`), `avg_volume`, `asset_type`, `sector`, `industry`, `country`, `exchange`, `market_cap_category`, `consensus_price`, `in_index`, `themes`, `tags`

### Fonctions numériques (pass_expr ET score_expr)
- `sma('close',50)`, `ema('close',20)`, `rsi('close',14)`, `atr(14)`, `hhv('close',50)`, `llv('close',20)`
- `pct_change('vwap',3)`, `change_pct(5)`, `gap_pct()`
- `avg_vol(20)`, `slope('close',20)`, `trend_strength(20)`, `tf('close',20)`
- `entropy('close',20)`, `skewness('close',20)`, `kurtosis('close',20)`, `autocorr_sign('close',5)`
- `security('SPY','1d','close',1)`, `pxof('SPY','1d','close')`, `benchmark('SPY')`
- `vix()`, `regime_score()` — macro, ex. `vix() > 20`, `regime_score() >= 0.75`
- `min(a,b)`, `max(a,b)`, `abs(x)`
- `near_sr_score()`, `vwap_band()`
- `days_until_earnings()` (ex. `days_until_earnings('AAPL') <= 3`), `days_until_economic_event('USD',3)`

### Fonctions booléennes (pass_expr UNIQUEMENT — crashent dans score_expr)
- `cross_up('ema20','ema50')`, `cross_down(...)`, `cross_up_lookback('ema20','ema50',5)`
- `rising('ema50',10)`, `falling('vwap',5)`
- `near_breakout(0.02)`, `near_sr(1.5)`, `near_poc(0.05)`
- `vol_spike45(1.5)`, `vol_spike45_lookback(2.0,10)`
- `is_cup_handle()`, `is_hammer()`, `is_doji()`, `is_bullish_engulfing()`, `is_bearish_engulfing()`
- `inrange('rsi14',45,70,10)`, `between(x,min,max)`
- `price_le(50)`, `price_ge(200)`
- `theme_match('ai')`
- `rank('sector',5)`, `is_near_earnings()`, `is_near_economic_event('USD',3,2)`

### Relative strength (⚠️ pass_expr uniquement — `perf_rel` plante dans score_expr malgré retour float)
- `perf_rank('sector','',20) <= 5` — rang dans le groupe (1=meilleur). **Max 3 arguments hors `kind`.**
- `perf_rel('sector', '', 20)` / `perf_rel('sector','',40) > 0` — delta perf vs groupe (%). **Pas de benchmark sauf `kind='etf'`.**
- `perf_rel('etf','ai','QQQ',20)` — avec benchmark explicite
- `rank('sector',5)` — booléen top N
- `roc_sector(20)` — return moyen du secteur

### Gotchas vérifiés
- ⚠️ `perf_rel(...)` dans score_expr → "too many arguments" même avec args valides. Utiliser uniquement dans pass_expr.
- ⚠️ `sma(close,50)` → INVALIDE, quotes obligatoires : `sma('close',50)`
- ⚠️ `ma(close,50)` → fonction inexistante
- ⚠️ `asset_type=='etf'` dans pass_expr → utiliser param `asset='etf'` séparé
- ⚠️ Booléens dans score_expr → convertir : `(vol_spike45(1.5) ? 20 : 0)`

RunScreener params : `pass_expr`, `score_expr`, `region` ('us'/'eu'), `asset` ('stock' default ou 'etf'), `top_k`, `force_async=true` recommandé.

**Langue par défaut : anglais intermediate.** Voir `scanner/CLAUDE.md` pour le template complet, sections, méthodologie.

**⚠️ Convention de date :** Scanner couvre la **prochaine séance de trading**. Généré après 22h30 : dossier = D+1. **Vendredi soir → lundi (D+3).**

### Phase 0 — Preparation

**Résolution de la date cible (règle complète)** :
- Jour de semaine avant 22h30 → aujourd'hui
- Jour de semaine après 22h30 → D+1
- Vendredi après 22h30 → lundi (D+3)
- Samedi → lundi · Dimanche → lundi

**Anti-doublon dossier** : lire `data/scanner.json` et **abandonner** s'il existe déjà une entrée à la
date cible (un scan par séance, jamais deux).

**Modes downstream = 6** : `turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`. Le pool TKL est
gaté **par mode** via `modes-config.json#tklPoolEnabled`.

1. **Lire scan précédent** (`ls scanner/ | sort | tail -1`) pour filtre anti-doublon (min 70% nouveaux
   tickers = **max 3 repeats sur 10**)
2. **Lire `data/scanner-positions.json`** pour tickers bloqués (positions ouvertes) — **zéro overlap**
   avec `open_positions`
3. **Lire `data/scanner-lessons.json`** — les 39 règles v2.0 sont le référentiel de sélection. La checklist complète est ci-dessous.
4. **Lire `data/retro-summary.json`** — grade trend, HR par stratégie × régime, meilleur/pire trade par régime. Identifier :
   - Quelle stratégie surperforme dans le régime actuel (ex: Pullback 80% HR en RISK-ON soutenu, Pre-Squeeze 70% en EARLY RISK-OFF)
   - Quelle stratégie sous-performe (ex: Breakout 0% en EARLY RISK-OFF, ForexMultiStrategy 0%)
   - Trajectoire des grades (tendance : amélioration ou plateau ?)
5. **Lire `data/scanner-filters.json`** pour sector_map + diversification rules
6. **Pre-flight gotchas** : lire
   `~/.claude/projects/-Users-marketwatchxyz-GolandProjects-articles/memory/feedback_pipeline_gotchas.md`
   (pièges à régression connus : fallback BSD `date -v`, `qa-check` lit `signals.json` et PAS le HTML,
   statut « Pending », comptage des ordres).

### Phase 0.8 — Récupération mémoire (`lessons-retrieve.js`)

**Toujours passer par le moteur de récupération, jamais lire `data/scanner-lessons.json` brut** :

```bash
node tools/lessons-retrieve.js --regime <REGIME>        # + --setups <list> / --mode <id> une fois connus
```

Il renvoie un payload JSON petit et **plafonné** — `active_rules`, `known_risks`, `similar_episodes`,
`deprecated_rules_ignored`, `retrieval_meta` : règles `status=active` uniquement, confidence effective
≥ 0.4, scope matché au régime/setups/mode courant, triées par confidence, **cap dur 3/3/3 par défaut**
quel que soit le nombre de règles éligibles.

**Les rétros alimentent le DÉBAT de sélection en Phase 2 — elles ne bloquent PAS les trades au moment
de publier.** Application pendant la sélection Phase 2 :
- `active_rules` (sévérités non-advisory : `selection_filter`, `hard_block`) → sert à **choisir de
  meilleurs candidats en amont** (favoriser stop ≥ 1.5× ATR, R/R ≥ seuil régime, RSI < 72, pas
  d'earnings ±3j, pas d'underwriter toxique). Le texte `rule` porte sa justification — l'incorporer au
  raisonnement de sélection.
- `known_risks` (matches `severity: advisory`) → biaise la sélection (ex. favoriser Momentum en RISK-ON,
  relever le poids Pre-Squeeze en EARLY RISK-OFF). Déviation OK avec rationale.
- `similar_episodes` → derniers trades clôturés sur le même régime × setup, avec mae/mfe/outcomes/
  r_multiple quand disponibles — à utiliser comme **couleur**, pas comme filtre dur.
- **Les règles `severity: hard_block` restent appliquées par `scanner-filters.json` + `validate-scan.js`
  au publish, indépendamment de la récupération.** Les faire remonter ici sert la visibilité/rationale,
  ce n'est PAS le mécanisme d'application : une règle hard_block absente d'`active_rules` (filtrée par
  scope ou confidence) est **quand même** appliquée en aval.
- Les règles `severity: infrastructure` sont appliquées en aval (sweep.js, signal-monitor.js,
  portfolio API).
- Croiser `_open_questions` **directement** dans `data/scanner-lessons.json` (non couvert par la
  récupération) : si une question vise le scan courant (`next_retro_check ≤ today`), tester l'hypothèse
  et la rapporter dans la QA Phase 6.

**La sortie de `validate-scan.js` peut émettre des advisories NON bloquantes** (déviations de règles
mémoire : stop < 1.5× ATR, RSI > 72, R/R sous le seuil régime). Ce sont des signaux pédagogiques pour
l'itération SUIVANTE du scan — pas des gates sur le scan courant.

**⚠️ Principe absolu — la mémoire ne peut JAMAIS inverser un signal quantitatif.** Les règles/risques/
épisodes récupérés peuvent seulement ajuster la confiance, le sizing, ou lever une alerte/un tag sur un
candidat **qui a déjà passé le crible quantitatif** (score, R/R, dilution, earnings, corrélation, gating
régime). Ils ne peuvent JAMAIS à eux seuls faire passer un signal de reject→select ou de select→reject,
et ne peuvent JAMAIS surcharger un `hard_block`. Chaque scan DOIT consigner ce que la mémoire a réellement
fait à la décision — bloc `_memoryImpact` obligatoire, voir §Phase 3.

### Phase 1 — MCP Data Collection

**Collecte MCP** : `RunAutoScreener` + **5 RunScreener DSL** (ci-dessous) + `GetMarketContext(facets='overview')` (trending, sectors, calendar — canonique, ex-GetMarketOverview, async seul, poller via `Jobs`) + `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` (canonique, ex-GetRegimeProbability) + `QueryData` (quote, **social_sentiment, insider_transactions, dark_pool, unusual_options, ftd_threshold, sec_filings, flags**) pour candidats  ⚠️ `capital_flow` N'EST PAS un data_type valide (renvoie « unknown data_type ») — smart-money = `dark_pool`/`unusual_options`/`trading_signals`

**⚠️ RunScreener — 5 queries obligatoires :**

🔴 **CRITIQUE (root cause du scan stub 20260701) — NE JAMAIS mettre `market_cap` dans `pass_expr`.**
Le screener évalue `market_cap` à **0** dans le contexte DSL → `market_cap > 10000000000` est **false pour TOUS** → **0 candidat silencieux** → scan mono-stratégie (Pullback-only) → 12 modes cassés. Vérifié 2026-07-01 : le DSL momentum "vérifié 06-25" renvoie **0** aujourd'hui ; en retirant `market_cap` il renvoie **40**. La mcap DOIT être **post-filtrée en code** sur les candidats retournés (chaque candidat porte `market_cap`), PAS gatée dans pass_expr.

**Réduction d'univers (perf)** : ne pas compter sur market_cap. Utiliser `vol > 1500000 and close > 10` dans pass_expr — filtre les penny/illiquides et garde les jobs US <30s en `force_async: true`.

**Post-filtrage OBLIGATOIRE en code sur les résultats** : `market_cap >= 2e9` + exclure ETF (`market_cap == 0` OU tickers IWX/FAI/IJR/BIL/VTEB/XHB/XLV/MUB/KRE/SHV/SGOV/MOAT/IUSV…) + exclure penny. Puis vérifier l'EMA-stack per-ticker via `QueryData types=technicals` si besoin.

🔴 **SMOKE-TEST OBLIGATOIRE** : après chaque query, si **< 10 candidats** (post-filtre) → le DSL est mal calibré, **ALERTER et ne PAS committer un scan mono-stratégie** sans le signaler explicitement. Voir mémoire `runscreener-dsl-calibration`.

1. **Momentum** (US, ~40 candidats) — corrigé + vérifié 2026-07-01 ✅ :
   ```
   pass_expr: "rsi14 > 53 and rsi14 < 70 and macd > 0 and vol > 1500000 and close > 10"
   score_expr: "rsi14 + (macd > 0 ? 15 : 0)"
   region: "us", top_k: 40, force_async: true   → puis post-filtre market_cap>=2e9 + no-ETF
   ```

2. **Pullback / Defensive** (US) — retirer market_cap du pass_expr :
   ```
   pass_expr: "rsi14 > 40 and rsi14 < 65 and ema20 > ema50 and atrpct < 2.5 and vol > 1500000 and close > 10"
   score_expr: "(65 - rsi14) * 1.5 + (2.5 - atrpct) * 20"
   region: "us", top_k: 25   → post-filtre market_cap>=2e9 + no-ETF
   ```

3. **Breakout** (US, ~40 candidats) — corrigé + vérifié 2026-07-01 ✅ (⚠️ `near_breakout(0.03)` = 1 seul argument, pas 2) :
   ```
   pass_expr: "near_breakout(0.03) and vol > 1500000 and rsi14 > 52 and rsi14 < 72 and close > 10"
   score_expr: "rsi14 + (vol_spike45(1.5) ? 20 : 0)"
   region: "us", top_k: 40, force_async: true   → post-filtre market_cap>=2e9 + no-ETF
   ```

4. **Oversold bounce** (US, 0 résultats si marché pas survendu — normal) — retirer market_cap :
   ```
   pass_expr: "rsi14 < 40 and ema50 > ema200 and vol > 1500000 and close > 10"
   score_expr: "(40 - rsi14) * 3 + obvz * 10"
   region: "us", top_k: 15   → post-filtre market_cap>=2e9 + no-ETF
   ```

Les queries 1+2 produisent **20-30 candidats** dans toutes les conditions de marché. Les queries 3+4 complètent l'univers quand les conditions le permettent (squeeze/survente). **Pool total attendu : 25-50 candidats US uniques** avant dedup + filtering Phase 2.

**⚠️ Safety check** : si TOUS les résultats RunScreener ont `market_cap < 500000000` → le screener est cassé → STOP + alerter le user. Ne JAMAIS ignorer des résultats full-penny-stock.

**Assemblage pool** : merge les 4 résultats US + RunAutoScreener → dedup par ticker → rejeter tout candidat avec market_cap < $2B → enrichir top 30 via QueryData

**Salve minimale (à jouer en parallèle, un seul message)** :

```
mcp__claude_ai_marketdata__GetMarketContext(facets="overview")   # async, seul (pas combinable) — canonique, ex-GetMarketOverview
mcp__claude_ai_marketdata__RunAutoScreener()
mcp__claude_ai_marketdata__RunScreener(expression="...", region="us")   # 3 DSL strategies
mcp__claude_ai_marketdata__RunScreener(expression="...", region="eu")
```

Attendre les jobs async via `Jobs(job_id=...)` (canonique, ex-CheckJobStatus/ListJobs → `Jobs(job_id=...)`
ou `Jobs(intent_id=...)`). Extraire :
- Régime (risk-on/risk-off/neutral), VIX, niveau SPX
- Top movers, variations sectorielles, thèmes en tendance
- Candidats screener avec leurs scores

### 📋 Manifeste de fraîcheur (skill `content-harness`, H2) — BLOQUANT

Tracer **chaque** source collectée dans `scanner/YYYYMMDD/harness.json` avec son `as_of` **RÉEL**.
Seuils de fraîcheur : régime **6 h**, quotes/calendriers **24 h**, insiders **96 h**, SEC **168 h**.

Avant la Phase 4 (publish) : `node tools/check-freshness.js scanner/YYYYMMDD/harness.json` —
**exit 1 = publication INTERDITE** (recollecter, jamais estimer). `--warn-only` est **interdit** en
pipeline. Une source collectée mais non déclarée dans le manifeste est un défaut de conformité : c'est
précisément ce que la collecte scriptée (`run-collect.sh`, §Collecte scriptée) rend impossible en
produisant `harness.json` comme sous-produit.

### ⚠️ Multi-List Output Format (OBLIGATOIRE depuis 2026-06-30)

Le scanner produit **5 listes** dans `signals.json` :
- `momentum[]` — top 10 momentum (EMA stack, RSI 55-80, vol surge)
- `breakout[]` — top 10 breakout (near_breakout, BBW squeeze, vol spike)
- `pullback[]` — top 10 pullback (RSI < 45, above EMA200, near support)
- `pre_squeeze[]` — top 10 pre-squeeze (low ATR%, tight BBW, above EMA50)
- `signals[]` — **composite top 10** (meilleur de chaque pool, diversifié secteur/géo)

Chaque signal dans les pools a la même shape que les signaux classiques (ticker, score, strategy, entry, stop, tp1, tp2, rr, thesis, sharia, region, etc.).

**Règles d'assemblage multi-list :**
1. Chaque screener alimente directement son pool (Momentum screener → `momentum[]`)
2. Les candidats passent la validation complète Phase 2 (dilution, earnings, Sharia, scoring)
3. Le `signals[]` composite est construit APRÈS les pools : pick les meilleurs de chaque pool en respectant la diversification (max 3/secteur, 8 actions US + 2 ETFs US)
4. Un ticker peut apparaître dans 1 pool + le composite, mais jamais dans 2 pools différents
5. `scanner-parser.js:loadSignals()` fusionne les pools dans `signals` pour backward compat (sweep.js, gen-api.js, etc.)

**HTML multi-list :** La page scanner affiche 5 sections :
- Section "Top 10 Composite" avec la table synthèse classique + setup cards
- 4 sections "Strategy Focus" (Momentum / Breakout / Pullback / Pre-Squeeze) avec mini-tables + thesis résumée
- Les setup cards détaillés ne sont générés que pour le Top 10 composite

### Phase 1c — Production des staging MCP (AGENT) — ⛔ AVANT `publish-daily-card.sh`

**9 scanners sont MCP-PRIMARY** (fetch Yahoo + univers local RETIRÉS, décret archi 2026-07-12 « le MCP fait foi »). Ils NE FETCHENT PLUS RIEN : chacun ingère (`--ingest <staging.json>`) un fichier produit **par l'AGENT** (toi). **Un subprocess `node` NE PEUT PAS appeler le MCP** (OAuth2 sur claude.ai, ZÉRO token) — seul l'AGENT (`/scanner` local ou `claude -p` cloud) voit `mcp__marketdata__*`. Donc tu produis les 9 staging **AVANT** de lancer `publish-daily-card.sh` ; le runner shell se contente de `if [ -f "$STAGE" ]` → `--ingest`, sinon **skip non-bloquant** (0 signal légitime ce run, JAMAIS de fetch local réintroduit, JAMAIS de données inventées).

**`candlestick` est le MODÈLE** (déjà câblé, `CANDLESTICK_STAGE` + `--ingest`). Chaque scanner flippé suit le même gate avec sa propre env-var (défaut `/tmp/<name>-stage.json`).

**Deux familles de staging :**
- **`candidates[]` PRE-SCORÉ** (l'AGENT calcule métriques + score, le scanner applique les gates hérités penny<5 / Sharia / R:R puis top-N) : `highvol`, `forex`, `momentum`, `etf`, `trendline-forex`, `trendline-indices`, `factor`.
- **`bars` map / `candidates[].bars`** (l'AGENT fournit les barres OHLCV brutes, le scanner score/détecte) : `candlestick` (`candidates:[{ticker,bars}]`), `metals` (`bars:{TICKER:[...]}`), `hybrid` (`bars:{TICKER:[...]}`).

Barres = **`QueryData(types=bars_daily)`** (forme array `[[date,o,h,l,c,v],...]` ascendante OU objet `[{date,open,high,low,close,volume}]` — les deux acceptées). Univers/candidats = **`RunScreener`** (rappel Phase 1 : JAMAIS `market_cap` en `pass_expr` → post-filtre en code). Toujours `mcp_ok:true` + `asof:"YYYY-MM-DD"`. **MCP down / couverture insuffisante → NE PAS écrire le staging** (le scanner skippera, 0 signal légitime) — ne JAMAIS fabriquer.

| Scanner | Env-var (défaut) | Appels MCP (AGENT) | Shape staging |
|---------|------------------|--------------------|---------------|
| `candlestick` | `CANDLESTICK_STAGE` (`/tmp/candlestick-stage.json`) | `RunScreener` US (univers) → `QueryData bars_daily` par ticker | `{mcp_ok,asof,regime?,universeFetched?,candidates:[{ticker,bars:[[date,o,h,l,c,v]…]}]}` |
| `highvol` | `HIGHVOL_STAGE` (`/tmp/highvol-stage.json`) | `RunScreener` US breakout + `QueryData bars_daily` → l'agent calcule metrics + score | `{mcp_ok,asof,regime?,vix:{level,trend},universeFetched?,candidates:[{ticker,name?,score,entry,stop,sharia?,region?,horizon?,metrics:{atrPct,distMA20,volRatio,rsi,bbPctB?,distMA200?,mom120?}}]}` |
| `metals` | `METALS_STAGE` (`/tmp/metals-stage.json`) | `RunScreener` métaux/mines + `QueryData bars_daily` | `{mcp_ok,asof?,minVolumeUsd?,names?:{TICKER:"…"},bars:{TICKER:[[date,o,h,l,c,v]…]}}` |
| `forex` | `FOREX_STAGE` (`/tmp/forex-stage.json`) | `QueryData bars_daily` sur paires FX + DX-Y.NYB → l'agent score 3 axes | `{mcp_ok,asof,dxyMom30?,dxySymbol?,universeFetched?,candidates:[{ticker,name?,score,price(\|entry),atr,sharia?,region?,horizon?,metrics:{rsi,atrPct,bbPctB,ret30d,ret14d,ret7d,momentumScore,mrScore,rsScore,distMA20,distMA50,distMA200}}]}` |
| `momentum` | `MOMENTUM_STAGE` (`/tmp/momentum-stage.json`) | `RunScreener` US + `QueryData bars_daily` → l'agent score mom 20/50/100 | `{mcp_ok,asof,regime?,universe?,universeFetched?,candidates:[{ticker,name?,score,entry,stop?,sharia?,region?,universe?,horizon?,metrics:{mom20,mom50,mom100,rsi,atr,…}}]}` |
| `etf` (US) | `ETF_STAGE` (`/tmp/etf-stage.json`) | `RunScreener` ETF US + `QueryData bars_daily` → l'agent score momentum | `{mcp_ok,asof?,regime?,universeFetched?,candidates:[{ticker,name?,score,entry,stop,cluster?,mom20?,rsi?,atrPct?,category?,sharia?,estDolVol?,estBars?}]}` |
| `trendline-forex` | `TRENDLINE_FOREX_STAGE` (`/tmp/trendline-forex-stage.json`) | `QueryData bars_daily` FX (daily) → l'agent score trend/breakout | `{mcp_ok,asof,regime?,universe?,universeFetched?,candidates:[{ticker,name?,score,entry,stop?,sharia?,region?,universe?,horizon?,metrics:{distMA200,rsi,atrPct,atr?,volRatio?,maAligned?}}]}` |
| `trendline-indices` | `TRENDLINE_INDICES_STAGE` (`/tmp/trendline-indices-stage.json`) | idem mais **barres 4h** (`QueryData` interval 4h), univers indices | même shape que `trendline-forex` |
| `hybrid` | `HYBRID_STAGE` (`/tmp/hybrid-stage.json`) | `QueryData bars_daily` sur mega-caps (breadth SMA200) | `{mcp_ok,asof,regime?,bars:{TICKER:[[date,o,h,l,c,v]…]}}` |
| `factor` | `FACTOR_STAGE` (`/tmp/factor-stage.json`) | `RunScreener` US + `QueryData bars_daily` → l'agent calcule le composite (momentum 12-1 / vol / maxDD) | `{mcp_ok,asof,regime?,universeFetched,universeEligible?,rebalance_day?,candidates:[{ticker,name?,sector?,market_cap?,sharia?,momentum_12_1,realized_vol,max_drawdown,composite,entry,rebalance_day?}]}` |

**Fail-closed uniforme** : staging absent / vide / malformé / `candidates` non-array (ou `bars` non-map) / `mcp_ok:false` → le scanner écrit son marqueur `_scanRuns[...]` incomplet et **NE FABRIQUE RIEN** (exit ≥ 2/3). C'est le comportement voulu : un run sans staging = 0 signal honnête, pas une régression déguisée en fetch local.

⚠️ **`metals` = swap, pas seulement `--ingest`** : `publish-daily-card.sh` appelait `fractal-scanner.js --universe metals`, or **fractal N'EST PAS flippé** (il fetche encore Yahoo + lit `data/metals-universe.json`). Le fix câble donc **`metals-scanner.js --ingest`** (le vrai binaire flippé) et laisse fractal (mode `adaptive_fractal`, Step 2d) intact sur sa voie locale.

### Phase 2 — Ticker Selection & Validation

#### Selection Rules (`scanner-filters.json`) — rappel compact
- Score ≥ **90** (seuil risk layer v4)
- Min **3** signaux de confluence par setup
- Univers : **8 actions cotées aux États-Unis + 2 ETFs cotés aux États-Unis**
- Max **3 par secteur** (selon `sector_map`)
- Max **3 repeats** depuis le scan précédent
- **Zéro overlap** avec `scanner-positions.json#open_positions`
- **Aucun earnings dans ±3 séances de bourse**

#### Phase 2 — Checks per-ticker OBLIGATOIRES

À exécuter pour **CHAQUE** candidat du top 10 **ET CHAQUE** entrée `tkl_pool` (no-skip intégral) :

- **Anti-dilution** : `QueryData(symbols=T, types='sec_filings,flags', days=180)` — disqualifier si
  dilution_risk_score ≥ 70, S-3 active, ATM, underwriter agressif, warrants ITM, PIPE récent.
- **Enrichissement per-ticker** :
  `QueryData(symbols=T, types='quote,social_sentiment,insider_transactions,dark_pool,unusual_options,trading_signals')`
- **Proximité earnings** : `GetEarningsCalendarFiltered(days_ahead=7)` **ET** le check DSL
  `days_until_earnings('T') <= 3` — **DISQUALIFIER** si dans ±3 séances de bourse (ou taguer
  « earnings risk »).
- **Proximité événement économique** (par devise du ticker) :
  `is_near_economic_event(currency, min_priority=2, within_days=3)` — écarter ou taguer.

⚠️ Ces checks se jouent en **UNE salve `QueryData` multi-symbole** sur toute la shortlist
(perf-parallel-mcp R3+R7), jamais en 1 agent par ticker (garde-coût, incident 2026-07-22).

**⚠️ Dilution Filter v2 MCP-driven (OBLIGATOIRE)** : `QueryData types=sec_filings,flags days=180` par candidat. Disqualification :
   - `flags.dilution_risk_score >= 70` ou `flags.shelf_active=true` + S-3 récent
   - `flags.atm_program_active=true` ou `flags.aggressive_underwriter=true` (Wainwright, Maxim, Dawson James, Roth, Ladenburg)
   - `flags.warrants_outstanding` ITM imminents (proximity < 0.20)
   - `flags.recent_pipe` (< 180j) ou `flags.reverse_split_recent` (< 180j)
   - Score 40-69 → **-15 pts + flag obligatoire dans Invalidations**

**⚠️ Risk Gating Post-Screener (OBLIGATOIRE — Risk Layer v1)** :
   - `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` (canonique, ex-GetRegimeProbability) : si `crisis > 0.30` ou `early_risk_off > 0.50` → top réduit à 5, breakout_only, taille × 0.5
   - `PortfolioRisk(action='correlation', symbols='T1,T2,...', lookback_days=60, method='pearson')` (canonique, ex-GetCorrelationMatrix — `symbols` en **CSV string, PAS un array**) : `max_pair.rho > 0.85` → drop le score le plus bas ; `avg_off_diagonal > 0.65` → forcer min 2 secteurs.
     ⚠️ **US-only** : mélanger des tickers EU (`.PA`) casse le calcul (« 0 common trading days »). L'endpoint est parfois cassé côté serveur (même sur large-caps US) → en cas d'échec, **FALLBACK concentration manuelle** : max 2/secteur + dispersion sectorielle. **NE JAMAIS inventer de rho.**
   - `GetEarningsCalendarFiltered` (days_ahead=7, min_expected_move=4) : ticker dans `exclusion_window` → DISQUALIFIER ou tag "earnings risk"
   - `PortfolioRisk(action='sizing', signals=[...], constraints={...}, mode='balanced')` (canonique, ex-OptimizeSizing — `signals` = JSON array, `constraints` = JSON object ; method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7 dans `constraints`). Utiliser le `risk_pct` renvoyé pour dimensionner les positions.

**Traçabilité obligatoire** : les résultats de ce gating alimentent `data.json#engine_meta.risk_gating`
(ensemble_confidence, crisis_prob_5d, max_pair_correlation, avg_off_diagonal_correlation, sizing). Un bloc
vide = le risk gating n'a pas tourné = **scan NON conforme** (garde `qa-check` « risk_gating non vide »).

**⚠️ Sharia Compliance Tagging (OBLIGATOIRE)** : conformité Sharia (secteur haram, dette/market cap > 33%, intérêts > 5% CA, ETFs levier/bonds). **Contrat DOM** : `data-sharia="true|false"` sur **LES DEUX** — la ligne `<tr>` de la table de synthèse **ET** le `<div class="setup-card">`. Voir `scanner/CLAUDE.md`.

#### ⚠️ TKL Pool — MÊME pipeline de validation (OBLIGATOIRE)

Les tickers du pool TKL DOIVENT passer la validation **identique** au top 10. Les seuls seuils relâchés
sont la capitalisation (**$10M** vs $500M) et l'ADV (**$2M** vs $10M). Voir `scanner-filters.json#tkl_pool`.

Pour TOUS les candidats TKL (batchés par groupes de **4-6**) :
```
mcp__claude_ai_marketdata__QueryData(symbols="TKL_TICKERS", types="sec_filings,flags,quote,insider_transactions,unusual_options,dark_pool,financials", days=180)
mcp__claude_ai_marketdata__QueryData(types="earnings_calendar", days=14)
```

**Règles de disqualification (identiques au top 10)** :
- Market cap < $10M → DROP
- ADV < $2M → DROP
- Anti-dilution : S-3/424B5 dans les 90 jours, `shelf_active`, `atm_program_active`,
  `aggressive_underwriter` → DROP
- Diluteur en série (plusieurs S-3/424B5 sur 12 mois) → DROP
- Earnings dans ±3 séances de bourse → DROP ou tag « earnings risk »
- Unusual options : `call_put_ratio < 0.4` **+** volume > 2× la normale (smart money short) → DROP

**Tagging Sharia (identique au top 10)** : secteur (financials/defense/alcool/tabac/jeu → false),
ratio dette/mcap > 33% → false ; taguer `sharia: true|false` dans les entrées `tkl_pool` de `signals.json`.

**Insider transactions** : flaguer les achats significatifs (**+5 pts**) ou ventes (**−5 pts** au score).

Cette validation **n'est PAS optionnelle** : elle tourne dans la Phase 2, immédiatement après la collecte
des résultats du screener TKL. **Aucun ticker TKL n'entre dans `signals.json` sans avoir passé tous les
checks.**

**Sélection multi-list :** 10 par pool stratégique (momentum, breakout, pullback, pre_squeeze) + 10 composite. Composite = meilleur de chaque pool diversifié (score ≥ **90**, confluence ≥ 3 signaux, 8 actions US + 2 ETFs US).

**⚠️ SCORING RULES (hard enforced by validate-scan.js since 2026-06-30) :**
- **Score max 98** — no perfect scores. Score reflects REALISTIC probability of TP1 hit.
- **R:R computed from TECHNICALS** — TP1 = nearest resistance/supply zone. NEVER reverse-engineer TP from a fixed R:R ratio. Each signal MUST have a unique R:R reflecting its individual technical setup.
- **Score inflation gate** — if >50% signals score ≥ 95, validation FAILS. In ERO, most signals should score 75-90.
- **Strategy caps by regime** — ERO: max 1 Pullback (need confidence ≥60%), 0 Breakout, max 4 Momentum. RISK-OFF: 0 Pullback, 0 Breakout, max 2 Momentum.
- **Penny stock block** — entry < $5 = auto-reject.
- **Candlestick signals** — allowed but MUST pass same stop (3-8%), sector, and Sharia gates as fundamental strategies.

**⚠️ Grille A+ empirique (cohorte 29 setups, juin 2026) — 4 ÉLIMINATOIRES obligatoires :**
Tout candidat A+ doit passer ces 4 gates. Échec sur 1 = plafond A (max 88/100).
1. **Guidance relevée** par le management au dernier trimestre (discriminant #1 : 100% des A+ l'ont)
2. **≥ 5 EPS beats consécutifs**
3. **PE forward < 35x** (exception documentée si monopole tech mondial + EPS growth >25% + PEG <2)
4. **Extension EMA20 ≤ 3%** (DECK lesson : 3.8% ext = seul A+ sous-performeur)

**Critères pondérés (score /100) :** PEG <1.5 (15pts), buyback actif (8pts), dividende (7pts), structure technique consolidation >3sem (20pts), R/R ≥2.5 (15pts), SEC 8-K/10-Q propre (15pts). A+ ≥ 92, A ≥ 88.
**Exclusion :** earnings dans 10 jours → "earnings play", pas swing A+.

### ⚠️ Phase 2b — VALIDATION GATE (OBLIGATOIRE AVANT Phase 3)

Après sélection des 10 candidats, CHAQUE signal passe la checklist v2.0.
- **HARD BLOCK** → disqualification immédiate, pas d'override
- **SELECTION FILTER** → disqualification sauf rationale documentée par signal
- **ADVISORY** → noter et ajuster sizing/thesis

**Si un signal est disqualifié, le remplacer par le candidat suivant et re-valider.**

### Pre-Flight Rule Checklist (scanner-lessons.json v2.0 — 39 règles)

#### HARD BLOCKS (auto-reject, aucun override)
- [ ] `stops-min-atr-multiple` : stop < 1.5× ATR(14) OU stop_pct < 3% OU stop_pct > 8% → REJECT (toutes stratégies y compris Candlestick)
- [ ] `rr-min-by-regime` : R/R < seuil régime → REJECT. Seuils H10 : RISK-ON 1.5, NEUTRAL 1.5, EARLY RISK-OFF/RISK-OFF 2.0. Seuils H15+ : NEUTRAL 1.7, ERO/RO 2.0
- [ ] `regime-score-label-lag` : label diverge ≥ 2 niveaux du score (ex: label RISK-ON + score < 50 = NEUTRAL effectif) → REJECT scan. Score < 40 = EARLY RISK-OFF quel que soit le label
- [ ] `stopped-ticker-cooldown` : ticker stoppé dans les 3 derniers scans OU ticker dans 3+ scans consécutifs → REJECT
- [ ] `regime-override-ensemble-block` : override régime diverge > 0.2 de l'ensemble + catalyseur binaire ≤ 48h → REJECT override
- [ ] `no-short-squeeze-strategy` : stratégie Short Squeeze → REJECT. Autorisées : Momentum, Pre-Squeeze, Breakout, Pullback, Candlestick
- [ ] `entry-price-spot-validation` : |entry - spot| / spot > 0.10 → REJECT (cache stale, pre-split)
- [ ] `degenerate-band-rejection` : |entry - stop| / ATR14 < 0.5 → REJECT. close > TP1 → REJECT (entry stale)

#### SELECTION FILTERS (reject sauf rationale documentée)
- [ ] `tp1-horizon-calibration` : H10 → TP1 ≤ 1.5R. H15+ → TP1 ≤ 2.0R. Linkage régime-horizon : RISK-ON/NEUTRAL = H10, EARLY RISK-OFF/RISK-OFF = H15
- [ ] `min-composite-score` : score < 80 → REJECT du top 10
- [ ] `limit-high-beta-ai-infra` : distance_50dma > 2× cap stratégie OU RSI > 72 → REJECT. Max 1 AI infra en RECOVERY/ERO
- [ ] `earnings-window-strict` : earnings ±3j bourse → REJECT
- [ ] `dilution-block-toxic-underwriters` : S-1/S-3/424B < 90j + underwriter toxique → REJECT
- [ ] `diversification-floor` : max 3/secteur (hard), 8 actions US + 2 ETFs US, max 3 repeats
- [ ] `high-score-low-rsi-conflict` : score ≥ 93 AND RSI < 55 → REJECT
- [ ] `rsi-no-mans-land-momentum` : Momentum AND RSI ∈ [40,50] → REJECT (sauf turbo)
- [ ] `tkl-momentum-quality-gate` : TKL pool AND (prix < $5 OU score < 88) → REJECT
- [ ] `energy-early-risk-off-block` : secteur Energy AND early_risk_off > 0.30 → REJECT
- [ ] `correlated-pool-exposure-cap` : score < 50 → max 1 crypto-momentum, max 2 metals
- [ ] `sector-regime-alignment` : secteur contre-thème dominant → score -= 10 à 15
- [ ] `winner-reentry-pullback-gate` : ticker top 3 rétro précédente AND pullback < 10% → REJECT
- [ ] `vix-defensive-tilt` : VIX > 28 → min 5/10 défensif/commodity/hedge. Suspendre tech momentum
- [ ] `open-portfolio-cap` : positions ouvertes ≥ 12 → max 5 nouveaux setups
- [ ] `breakout-early-risk-off-block` : early_risk_off > 0.40 AND Breakout → REJECT
- [ ] `regime-persistence-gate` : même régime 3+ sessions → caps Pullback (0% en ERO soutenu)
- [ ] `regime-rotation-penalty` : ≥ 2 changements régime en 5j → sizing ×0.7 + stops ×1.5 ATR
- [ ] `momentum-favored-risk-on` : RISK-ON soutenu ≥ 2j → Momentum 45%, Breakout 30%. EARLY RISK-OFF → Breakout 40%, Pullback 30%, Momentum 20%
- [ ] `pre-squeeze-early-risk-off` : EARLY RISK-OFF + compression vol → 25% Pre-Squeeze
- [ ] `pullback-regime-confidence-gate` : Pullback ET régime confidence < 60% → REJECT
- [ ] `mega-cap-regime-oscillation` : ≥ 2 rotations en 5j → mcap min $50B, commodity/small-cap max 1

#### ADVISORIES (biais sélection, déviation OK avec rationale)
- [ ] `repeat-pick-fatigue` : 3+ scans consécutifs → score -= 5 × (apparitions - 2)
- [ ] `trailing-stop-delay` : R/R ≥ 1:2.4 → trailing inactif avant 50% vers TP1
- [ ] `cyclicals-macro-context-gate` : Materials/Industrials breakout sans tailwind macro → score -= 10
- [ ] `same-day-strategy-cap` : EARLY RISK-OFF max 1 Pullback, tout régime max 2 même stratégie
- [ ] `gap-up-pullback-entry` : RISK-ON > 70 conf + gap-up > 1% → attendre pullback -0.3%
- [ ] `gap-up-preflight-phase2` : close > entry × 1.02 → ajuster entry au VWAP estimé J+1
- [ ] `high-atr-sizing-oscillating-regime` : ATR/prix > 4% + oscillation régime → sizing ×0.7

#### INFRASTRUCTURE (always-on, pas de check manuel)
- `vwap-entry-gate` : entry = min(open, VWAP) clamped day_low. Gap > 2% → VWAP pullback seul

### Phase 3 — Data Generation

**Titre carte OBLIGATOIRE** : `Top 10 A+ {REGIME} — {TICKER1}, ..., {TICKER10}` (composite)

**signals.json output format :**
```json
{
  "regime": "RISK-ON",
  "regimeScore": 86,
  "signals": [...],       // composite top 10 (fully enriched)
  "momentum": [...],      // top 10 momentum pool
  "breakout": [...],      // top 10 breakout pool
  "pullback": [...],      // top 10 pullback pool
  "pre_squeeze": [...],   // top 10 pre-squeeze pool
  "tkl_pool": [...],      // TKL momentum (separate pipeline)
  "crypto_pool": [...],   // crypto signals (separate pipeline)
  "metals_pool": [...],   // metals signals (separate pipeline)
  "forex_pool": [...]     // forex signals (separate pipeline)
}
```

**R/R et Horizon par régime (table harmonisée v2.0) :**
| Régime | Horizon | R/R min | TP1 max |
|--------|---------|---------|---------|
| RISK-ON | H10 | 1.5 | 1.5R |
| NEUTRAL | H10 | 1.5 | 1.5R |
| EARLY RISK-OFF | H15 | 2.0 | 2.0R |
| RISK-OFF | H15 | 2.0 | 2.0R |

⚠️ Le **seuil `rr-min-by-regime` consommé par `/scanner`** (source `scanner-lessons.json#rr-min-by-regime`)
est : **RISK-ON 1.5 · RECOVERY/NEUTRAL 1.7 · EARLY RISK-OFF/RISK-OFF 2.0**. Le R/R se calcule depuis le
**MIDPOINT de la zone d'entrée**, jamais depuis `entry_low`.

#### Artefacts générés
1. `scanner/YYYYMMDD/data.json` conforme **exactement** à `scanner/template/schema.json`
2. `scanner/YYYYMMDD/signals.json` (format simplifié pour les outils downstream)
3. Labels de stratégie **UNIQUEMENT** : Momentum, Breakout, Pullback, Pre-Squeeze

#### ⛔ Champs OBLIGATOIRES par signal (`top_10` + `tkl_pool`)

Requis pour les checks advisory de `validate-scan.js` et la consommation par le lessons-engine (Phase 0.8) :
- `extension: { rsi, atr, distance_50dma_pct }` — peuplé depuis les technicals MCP
  (`GetInstruments` instrument_technicals + instrument_support_resistance). RSI 0–100, ATR en unités de
  prix, `distance_50dma_pct = (price - ema50) / ema50 * 100`.
- `earnings_clear: true` — mettre `false` UNIQUEMENT si on décide de taguer-et-garder (rare) ; `true` par
  défaut signifie que le scan a été filtré contre la fenêtre earnings ±3j.
- `dilution_clear: true` — `false` UNIQUEMENT si on accepte un ticker flaggé avec rationale explicite
  (extrêmement rare) ; `true` par défaut = anti-dilution v2 passée.
- `region: "US"|"ETF"` — `US` pour les actions cotées aux États-Unis, `ETF` pour les ETFs cotés aux
  États-Unis. Toute autre valeur est bloquante à partir du 2026-08-29.
- `earnings_source: "8k_item_202"` — **BLOQUANT (gate G4)**. La date de résultats DOIT venir du dépôt
  **8-K item 2.02**, jamais du champ calendrier prévisionnel. Le **20260730** ce champ a laissé passer
  10 titres ayant déjà publié (F, AWK, EXR, REG, FE, CNC, IVZ + LYV/KKR/OWL/RAL le jour même).

#### ⛔ Bloc `_pipelineOrder` (OBLIGATOIRE, top-level — gate G4 bloquant depuis le 2026-07-31)

Preuve que le filtre résultats a tourné sur le vivier **COMPLET**, **AVANT** toute salve d'enrichissement
par ticker (doctrine `perf-parallel-mcp` R2 : calendrier + 8-K en **Vague 1**, enrichissement en Vague 3) :

```json
"_pipelineOrder": {
  "earnings_screened_at": "2026-07-30T20:05:00Z",
  "enrichment_started_at": "2026-07-30T20:18:00Z",
  "candidates_screened": 39,
  "method": "8-K item 2.02 filing dates sur le vivier complet, avant toute salve enrichissement"
}
```
- `earnings_screened_at` doit être **strictement antérieur** à `enrichment_started_at`, sinon publication
  refusée.
- `candidates_screened` doit couvrir le vivier complet (**≥ 2× le nombre de lignes publiées**), pas la
  sélection finale.
- Raison d'être : le **20260730**, le filtre résultats a tourné en Vague 3. F et PFE sont morts **après**
  avoir consommé leur enrichissement complet — ~15 min de reprise pure. La doctrine perf existait déjà et
  n'était pas appliquée ; ce gate la rend mécanique.

#### ⛔ Bloc `_memoryImpact` (OBLIGATOIRE, top-level dans `signals.json`)

Consigne ce que la récupération de la Phase 0.8 a **réellement** fait aux décisions de ce scan, pour audit
+ consommation par la rétro hebdo :

```json
"_memoryImpact": {
  "rules_applied": ["rule-id-1", "rule-id-2"],
  "decision_changed": false,
  "sizing_delta": 0,
  "reason": "1-2 sentences: which retrieved rule(s)/risk(s) nudged confidence, sizing, or added a tag, and on which ticker(s). If nothing from retrieval changed anything this scan, say so explicitly (e.g. \"no active_rules/known_risks materially changed the top 10 selection\")."
}
```
- `rules_applied` : ids issus d'`active_rules`/`known_risks` (sortie `lessons-retrieve.js`) qui ont
  réellement influencé une décision de sélection/sizing/tag sur ce scan. **Un array vide est valide.**
- `decision_changed` : `true` seulement si l'inclusion/exclusion d'un candidat a été influencée par la
  mémoire — et même alors, par le principe absolu (§Phase 0.8), la mémoire n'a pu agir qu'en
  départageur/filtre **APRÈS** le crible quantitatif, jamais comme seule raison d'ajouter un candidat.
- `sizing_delta` : multiplicateur numérique ou ajustement en points de pourcentage appliqué au sizing du
  fait d'une règle récupérée (0 si aucun).
- `reason` : texte libre, auditable par un humain.

#### ⚙️ VWAP entry gate (always-on, PAS grid-searché)

Validé **+29 % PnL, +16 pp WR, 2.5× PF** (commit `91596bd9`) :
- Entrée effective = `min(open_next_session, VWAP_next_session)` clampée à `day_low` (no-lookahead)
- Éviter les pièges de gap-up : si `open > entry_high × 1.02`, remplir uniquement au pullback VWAP
- Afficher la valeur VWAP dans la setup card **ET** la table de statut (commit `58bac3bb`)
- Appliqué uniformément dans `sweep.js`, `signal-monitor.js`, le how-to-trade de la status page et la
  portfolio API

### Phase 4 — Render & Publish (LOCAL — rien ne devient public ici)

```bash
node tools/render-scanner.js scanner/YYYYMMDD/ --strict   # bloque si data.json désaccentué/tronqué (garde qualité amont)
node tools/check-freshness.js scanner/YYYYMMDD/harness.json   # exit 1 = publication INTERDITE
node tools/qa-check.js                                        # lit signals.json, pas le HTML — 0 ❌ exigé
node tools/publish.js --type scanner --path scanner/YYYYMMDD/index.html --no-notify --no-push
```

⚠️ **`--no-push` est obligatoire, et ce n'est pas du confort.** Le panel adversarial passe en Phase 6,
donc APRÈS. Sans lui, la page est déjà en ligne quand le panel la refuse et la Phase 8 n'est plus qu'un
décor. `publish.js` indexe, valide le contenu et commite **en local** ; la mise en ligne est une décision
de Phase 8. N'ajoute aucun `git push` ici.

Si la validation de publish échoue (violations de filtres), **retourner en Phase 2** avec les violations
précises et re-sélectionner.

## ⚡ Downstream — coupure CALCUL / DIFFUSION (`tools/downstream-split.sh`, obligatoire depuis 2026-08-11)

**N'enchaîne plus le downstream en une seule coulée qui finit par un `git push`.** Le panel de la Phase 6
juge le contenu ; le downstream ne le modifie pas. Les deux tournent donc ENSEMBLE — 8 à 12 min de mur en
moins. Mais paralléliser le downstream *entier* serait une faute : il contient des actions irréversibles.
D'où la coupure, et l'ordre réel des phases :

```
Phase 4  publish.js --no-push --no-notify          ← indexe et commite EN LOCAL, rien de public
Phase 5A  bash tools/downstream-split.sh compute <DATE> <ASOF>   ┐ MÊME parallel()
Phase 6   les 7 relecteurs adversariaux                          ┘ que le calcul
Phase 7   arbitrage : corrections + rejeu conditionnel du compute
Phase 8   bash tools/downstream-split.sh distribute <DATE>  → image, push, Telegram
```

- `compute` = ingestion dtx (decide **et** replay), history-append, pont `dtx_pool`, `gen-status-page`,
  puis `gen-api` / `gen-mode-cards` / `daily-synthesis` en parallèle, et `qa-check`. **Local, idempotent,
  rejouable autant de fois qu'il faut.** Il prend un verrou : `/desk` et `/scanner` écrivent les mêmes
  fichiers, deux `gen-status-page` simultanés corrompent SANS lever d'erreur. S'il annonce qu'il attend,
  laisse-le attendre.
- `distribute` = `publish-daily-card.sh --no-sweep --no-telegram` (image + QA + push). **Après le verdict,
  jamais avant.** Coût d'un panel qui refuse : recalculer des fichiers locaux, 1 à 2 min. On ne retire pas
  un message déjà parti.
- **Ce que `compute` ne contient PAS, et pourquoi** : `update-tracking.js` et `sweep.js --quick` tournent
  déjà dans la **chaîne C de `scan-parallel.sh`** (Phase 1), en parallèle du vivier. Les relancer ici
  rejouerait 1 min 27 de sweep pour un résultat identique.
- **Ce que `compute` fait et que tu dois préparer** : il ingère `/tmp/risk-mcp.json`, que **toi seul** peux
  produire (le MCP est en OAuth2, un subprocess `node` ne l'atteint pas). Produis-le AVANT la Phase 5A. Si
  `data/risk-snapshots.json` a plus de **12 h**, **`compute` échoue** au lieu de publier la VaR de la veille
  en silence — c'est voulu, ne le contourne pas avec `RISK_MAX_AGE_H` sans savoir pourquoi tu le fais.

**Rejouer `compute` ou non — un seul critère, et il est mécanique.** Le constat du panel touche-t-il
`data.json` ou `signals.json` ?

```bash
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-before.txt
# … corrections du panel, re-render, re-validation …
shasum -a 256 scanner/YYYYMMDD/data.json scanner/YYYYMMDD/signals.json > /tmp/scan-hash-after.txt
diff /tmp/scan-hash-before.txt /tmp/scan-hash-after.txt   # différent → relancer compute
```

Niveau faux, R/R erroné, ticker retiré → les artefacts dérivés décrivent un scan qui n'existe plus,
**relance `compute`**. Tournure, lien, réserve éditoriale → ils sont intacts, ne le relance pas.
`qa-check.js` tranche de la même façon : il lit `signals.json`, pas le HTML.

⚠️ Les relecteurs de la Phase 6 **ne modifient aucun fichier** pendant que `compute` tourne — ils lisent et
rapportent, l'arbitrage corrige. La seule clé que `compute` réécrit dans `signals.json` est `dtx_pool`
(vivier du moteur scripté, hors sélection publiée) et cette écriture est atomique (tmp + rename) : aucun
relecteur ne peut lire un JSON tronqué.

**⚡ Doctrine « le MCP fait foi » (OAuth2, ZÉRO token) : un subprocess `node` NE PEUT PAS appeler le MCP.
Donc l'AGENT appelle le MCP, écrit des JSON, et les scripts INGÈRENT.** Ça évite les 3 bugs historiques :
risk-metrics auth-fail, Telegram token-fail, sweep re-run redondant.

### Carte détaillée du downstream — QUI lance QUOI

Ce bloc n'est **PAS** une liste à taper : c'est la carte de ce que les scripts enchaînent, annotée du
script responsable. Le sweep tourne **UNE SEULE** fois — `publish-daily-card.sh` reçoit `--no-sweep`.

```bash
# ── chaîne C de scan-parallel.sh (Phase 1), PAS downstream-split ─────────────
node tools/update-tracking.js                                                # Yahoo prices → exit triggers (pas de MCP)
node tools/sweep.js --quick                                                  # Append-only: closed trades + advisor_* (1m27 en --quick, 6m47 en complet)

# ── downstream-split.sh compute ─────────────────────────────────────────────

# ── refresh-risk-metrics : VOIE --ingest (MCP connecté). NE PAS utiliser MCP_GATEWAY_URL (auth-fail
#    "Authorization required", pas du JSON). L'AGENT produit risk-mcp.json AVANT :
#    1) GetMarketContext(facets="regime", model="ensemble", horizon_days=5) → bloc regimeProbability
#    2) pour CHAQUE mode AVEC positions ouvertes (voir scanner/status/history/<latest>.json) :
#       PortfolioRisk(action="var"/"stress") → modes{<id>}. Modes à 0 position = omis (→ no_positions auto).
#    Corrélation : souvent cassée serveur ("0 common trading days") et EU (.PA) casse le calc → US-only,
#    sinon fallback concentration manuelle (max 2/secteur). N'INVENTE JAMAIS de VaR.
node tools/refresh-risk-metrics.js --ingest /tmp/risk-mcp.json               # écrit data/risk-snapshots.json (non-stub)

node tools/gen-status-page.js                                                # Snapshot J + dashboard (6 modes)
node tools/gen-mode-cards.js                                                 # Per-mode PNG cards (6 modes)
node tools/gen-api.js                                                        # Refresh 100+ public JSON endpoints
node tools/daily-synthesis.js                                               # Per-mode synthesis: entries / exits / equity move
node tools/dtx-pool-bridge.js --folder YYYYMMDD --date YYYY-MM-DD            # dtx CREATE (6 modes systematic) → dtx_pool[] dans signals.json

# ── downstream-split.sh distribute ──────────────────────────────────────────
# Push + QA SANS notif token-based ; le sweep n'est PAS relancé :
bash tools/publish-daily-card.sh --no-sweep --no-telegram                    # image + git push + QA (Step 7)

# ── Telegram : VIA LE MCP notification connecté (envoyé par l'AGENT), pas par le shell.
#    send_message(to="alerts", format="html", body="<b>…</b>…", ...) — HTML uniquement (pas de **markdown**),
#    AUCUN terme interne (pas de "MCP"/"dtx"/noms de scripts), voix éditoriale (EDITORIAL_STYLE.md).
```

> ⚠️ **`candlestick`/mode « bull » = SUPPRIMÉ (été 2026).** Ne PAS le rappeler dans le pipeline (plus de `candlestick-scanner.js`, plus de staging candlestick). Idem `refresh-risk-metrics` sans token = stub inutile.
> ⚠️ **dtx (6 modes systematic) — DECIDE *ET* REPLAY OBLIGATOIRES (incident 2026-07-23).** Pour CHAQUE config (`DtxListConfigs`), l'AGENT appelle **les DEUX** : `DtxDecide(portfolio, asof=J+1, expected_data_date=<dernière clôture>, balances)` (→ ordres) **ET** `DtxReplay(portfolio, from=2021-01-01, to=J+1)` (→ courbe backtest + métriques). Puis ingest **avec les deux** : `node tools/dtx-mcp-ingest.js --portfolio <id> --decide <file> --replay <file> --from 2021-01-01 --to <statusSince> --asof YYYY-MM-DD`. **⛔ `--decide` SEUL ne suffit PAS** : sans `--replay`, le staging a `metrics`/`equity` vides (`stateless:true`), le bloc splice backtest+live de `gen-status-page` (L~902) est SAUTÉ, et le dashboard retombe sur un placeholder frozen figé (−1,24 % / 0 trade) — c'est exactement le bug du 23/07 (staging decide-only). **⚠️ SATURATION ORIGINE** : batcher les `DtxReplay`/`DtxDecide` par **lots de ≤3** (au-delà → 502 bad gateway), poller `DtxJobStatus`, back-off 60 s sur 502. 0 ordre CREATE = LÉGITIME (setup non déclenché), mais le REPLAY doit quand même être ingéré pour la courbe. Voir §"dtx refresh — MCP SEUL MOTEUR" step 3.
> ⚠️ **Aucune exécution broker dans /scanner.** Le pipeline s'arrête à la publication + dashboards + notification. `run-session` reste manuel — on ne trade JAMAIS du réel depuis le scanner.
> ⚠️ **Connector `marketdata` instable** (redéploiements serveur) : peut se déregistrer après quelques appels → l'utilisateur relance `/mcp`. Batcher agressivement (max de données par salve), les gros payloads débordent en fichiers `tool-results` → parser en jq/node, pas re-fetch. `capital_flow` n'est PAS un data_type valide — utiliser `dark_pool,unusual_options,trading_signals,insider_transactions`.

⚠️ Compléments `refresh-risk-metrics` (le reste est dans le commentaire de la carte ci-dessus) :
`MCP_GATEWAY_URL` direct reste réservé aux **routines cloud qui ONT un token injecté** ; en local il donne
"Authorization required" (pas du JSON) et écrit des nulls. **Jamais `--stub`** (schéma vide).

## Pipeline Quotidien (Append-only) — ⚠️ AUTOMATIQUE, NE JAMAIS DEMANDER

Après chaque scanner publié, lancer pipeline complet **sans demander confirmation** :

Source de vérité: tools/publish-daily-card.sh — si divergence, c'est le runner qui gagne.

⛔ **PRÉ-REQUIS (Phase 1c)** : les 10 lignes `--ingest` ci-dessous supposent que l'AGENT a **déjà écrit** les `/tmp/<name>-stage.json` via `mcp__marketdata__*` (voir §"Phase 1c — Production des staging MCP (AGENT)"). Dans `publish-daily-card.sh` chaque appel est gardé par `if [ -f "$<NAME>_STAGE" ]` (env-var surchargeable) → sinon **skip non-bloquant** (0 signal légitime, jamais de fetch local). `fractal` (Step 2d) reste NON flippé (voie locale).

```bash
node tools/update-tracking.js           # Tracking exits (prix Yahoo)
node tools/candlestick-scanner.js --ingest /tmp/candlestick-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME  # AB candlestick signals → bull[] in signals.json. MCP-PRIMARY : NE FETCH PLUS (Yahoo/allorigins + univers local retirés). L'AGENT produit d'abord le staging (mcp__marketdata__ RunScreener US + QueryData bars_daily → {mcp_ok:true,candidates:[{ticker,bars:[[date,o,h,l,c,v],...]}]}). --date = last trading day, --folder = scanner session folder
node tools/fractal-scanner.js --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 35 --top 30  # AF default → signals.json (adaptive_fractal strategy)
node tools/highvol-scanner.js --ingest /tmp/highvol-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 50 --top 20  # HighVol mode. MCP-PRIMARY : --ingest OBLIGATOIRE (staging AGENT). Absent → publish-daily-card.sh skip non-bloquant (0 signal légitime).
node tools/metals-scanner.js --ingest /tmp/metals-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 25 --top 15  # Metals scan. FLIPPÉ : metals-scanner.js --ingest (PLUS fractal-scanner --universe metals — fractal reste NON flippé, fetch local). Staging AGENT.
node tools/forex-scanner.js --ingest /tmp/forex-stage.json --output signals --date YYYYMMDD --min-score 20 --top 10  # Forex 3-axis (systematic-tss port: Momentum 40%/MeanRev 30%/RelStrength vs DXY 30%) → forex_pool. MCP-PRIMARY --ingest. No --folder/--regime flags (unsupported).
# Casablanca RETIRÉ 2026-07-11 (univers BVC bloqué/malformé, api.casablanca-bourse.com KO) — ne plus lancer, sinon échec chaque soir + alerte Telegram. casablanca_pool reste vide (géré). Réactivation = source BVC fiable + revalidation.
# node tools/casablanca-scanner.js --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 25 --top 15
# node tools/momentum-scanner.js --universe casablanca --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 5 --top 15
node tools/momentum-scanner.js --ingest /tmp/momentum-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 5 --top 20  # Momentum Rotation (US). MCP-PRIMARY : staging PRE-SCORÉ (candidates[] scorés côté agent).
node tools/etf-scanner.js --ingest /tmp/etf-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --top 10  # ETF Momentum (US). MCP-PRIMARY --ingest.
node tools/trendline-scanner.js --universe forex --ingest /tmp/trendline-forex-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 50 --top 10  # Trendline Breakout (forex). MCP-PRIMARY --ingest (TRENDLINE_FOREX_STAGE).
node tools/trendline-scanner.js --universe indices --interval 4h --ingest /tmp/trendline-indices-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 50 --top 10  # Trendline Breakout (indices 4h). Staging DISTINCT (TRENDLINE_INDICES_STAGE, barres 4h).
node tools/hybrid-scanner.js --ingest /tmp/hybrid-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME  # Hybrid breadth analysis → signals.json (MegaCap si narrow rally). MCP-PRIMARY --ingest.
# FACTOR (mode `factor`, sim-only) → factor_pool. 2 voies (voir "factor — voie MCP (--ingest)" §ci-dessous) :
#   VOIE MCP (POC #1 migration local→MCP, RECOMMANDÉE) : ÉTAPE AGENT d'abord (l'agent appelle mcp__marketdata__*
#     RunScreener US + QueryData bars_daily, calcule le composite, écrit /tmp/factor-stage.json), PUIS :
node tools/factor-scanner.js --ingest /tmp/factor-stage.json --output signals --date YYYYMMDD --folder FOLDER --top 15  # parse le staging (jamais de fetch), gates hérités (penny<5, sharia, rr), RE-DÉRIVE le pool via le même buildPool → factor_pool byte-identique à la voie locale. Staging absent/mcp_ok:false → marker incomplete + exit 3, RIEN fabriqué.
#   VOIE LOCALE (DEPRECATED, fallback Yahoo — si pas de staging MCP) : momentum 12-1 + low-vol (REELS, prix) + quality-proxy (-maxDD, prix) sur data/tkl-universe.json.
# node tools/factor-scanner.js --output signals --date YYYYMMDD --folder FOLDER --top 15  # fallback local
# Rebalance mensuel (21j) equal-weight top-15 + hysteresis buffer → panier FIGÉ hors jour de rebalance (turnover ~25%/mois, backtest 3.8y CAGR ~43% / maxDD ~11.6% / Sharpe ~1.60). Quality FONDAMENTALE (ROE/marges/levier) = hors portée (débloquable via QueryData fondamentaux dans le staging). No --regime flag pour la voie locale ; --regime optionnel pour --ingest (sanity rr, le facteur reste un rank pur).
node tools/sweep.js                     # Append-only: nouveaux trades fermés (le mode `factor` consomme factor_pool via assetClass us_factor).
# ⛔ Phase 5.5 OBLIGATOIRE (AI-driven, PAS un script node) : Skill(skill="fortress-pm")
#    → écrire fortress_pool dans scanner/YYYYMMDD/signals.json AVANT gen-status-page.
#    Sinon aplus/fortress fallback (fortress_fallback) et peuvent rendre vides / non-Halal. Voir §5.5.
node tools/refresh-risk-metrics.js --ingest /tmp/risk-mcp.json   # VaR + stress + regimeProb — VOIE --ingest (MCP connecté). L'AGENT écrit risk-mcp.json {regimeProbability, modes{}} via GetMarketContext(facets=regime) + PortfolioRisk. PAS de MCP_GATEWAY_URL en local (OAuth2 zéro token → auth-fail). Corrélation US-only (EU .PA casse) + souvent cassée serveur → fallback concentration manuelle.
# ── dtx (systematic-tss) refresh — portefeuilles câblés ─────────────────────────────────
#    Source mécanique: tools/dtx-scan.js#SCRIPTED_MODES / PORTFOLIO_TO_MODE.
#    Catalogue actif depuis 2026-08-12 : best (panier multi-poches).
# ⚠️ MCP = SEUL MOTEUR ("le MCP fait foi"). Binaire local + bundle SUPPRIMÉS (cut-over 2026-07-08).
# Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token). C'est une ÉTAPE AGENT à faire
# AVANT le pipeline shell (voir "dtx refresh — MCP SEUL MOTEUR" §ci-dessous) : pour chaque portefeuille câblé,
# l'AGENT appelle DtxReplay + DtxDecide (poll DtxJobStatus), écrit les JSON bruts, puis :
#   node tools/dtx-mcp-ingest.js --portfolio <id> --decide /tmp/<id>.decide.json --replay /tmp/<id>.replay.json --asof <J+1> --from 2021-01-01 --to <statusSince>
# → data/dtx/<id>.json (engineMode:"mcp"). Si un mode échoue au MCP → laisser le staging committé
# (gen-status-page le lit tel quel, ou fallback pool JS). publish-daily-card.sh Step 4d = simple garde
# (warn si staging manquant/stale) — NE régénère plus rien (plus de binaire). Jamais bloquant.
node tools/gen-status-page.js           # Snapshot J + Dashboard (lit fortress_pool + data/dtx/*.json)
node tools/gen-api.js                   # Refresh public JSONs (50 endpoints)
node tools/substack-publish.js scanner/YYYYMMDD/index.html  # OPTIONAL/non-blocking: Substack draft + Notes teaser (needs MCP_AUTH_TOKEN, else draft-only local); disable via SUBSTACK_DISABLE=1
# NB: PAS d'exécution broker dans /scanner. run-session (trading-executor) = outil MANUEL séparé,
# jamais dans le flux auto — on ne trade jamais du réel automatiquement depuis le scanner.
```

### factor — voie MCP (`--ingest`) — POC #1 migration data local→MCP

**Contexte.** `factor` est le **1er mode migré** vers le data-path MCP (`mcp__marketdata__*`) — spec
`docs/specs/migration-local-to-mcp.md` §5 (POC recommandé : `status=test`, **sim-only**, aucune parité
Go à casser, univers US couvert par le MCP, facteurs prix-only). La source LOCALE (`data/tkl-universe.json`
+ fetch Yahoo direct) est **DEPRECATED** mais reste un **fallback fonctionnel** (retrait = chantier séparé,
§6 : `tkl-universe.json` = candidat de retrait #1).

**Câblage (identique au pattern pead/dtx — un `node` NE PEUT PAS appeler le MCP, OAuth2 zéro token).**
C'est une **ÉTAPE AGENT** exécutée AVANT `factor-scanner.js` :

1. L'AGENT appelle `mcp__marketdata__GetStatus` (preflight : healthy + fraîcheur `bar_service_1d_ref_lag_sessions`/`max_last_bar_date`). **Si stale** (lag > 1-2 séances) → **`RefreshBars`** (fire-and-forget ~4 min) puis **poller `GetStatus`** jusqu'à rattrapage AVANT de continuer. **STOP** (MCP HARD STOP) seulement si le refresh ne rattrape pas.
2. `RunScreener(region:"us", asset:"stock", pass_expr:"vol>1500000 && close>10", score_expr:"vol(share)", force_async:true)` → poller `Jobs`.
   🔴 **JAMAIS `market_cap` dans `pass_expr`** (→ 0 candidat silencieux) : post-filtrer `market_cap>=2e9` **en code** côté agent.
3. `QueryData(types="bars_daily")` 5y ajusté sur le top univers → l'agent calcule momentum 12-1 + low-vol +
   `-maxDD`, z-score/winsorise ±3 le composite sur l'univers **éligible**, et écrit **`/tmp/factor-stage.json`**
   (shape : `docs/specs/examples/factor-stage.example.json` — `mcp_ok`, `candidates:[{ticker, momentum_12_1,
   realized_vol, max_drawdown, composite, entry, sharia, …}]`). ⛔ Zéro fabrication : chaque niveau vient d'un appel MCP réel.
4. `node tools/factor-scanner.js --ingest /tmp/factor-stage.json --output signals --folder YYYYMMDD` :
   PARSE le staging (jamais de fetch), applique les **gates hérités** (penny<5 rejeté, sharia passthrough,
   rr≥seuil régime en sanity), **RE-DÉRIVE le pool via le MÊME `buildPool()` que la voie locale** → `factor_pool`
   byte-identique (preuve de cohérence A/B), écrit `_scanRuns['factor']` (fusion NON destructive, dedup par ticker).

**⚠️ Bande stop 3-8% NON APPLICABLE à factor** : c'est une stratégie de ROTATION (rotation mensuelle = sortie,
aucun SL/TP par ligne). Le `stop = entry×0.75` est un filet disaster **informationnel** downstream, pas un stop de
trade — le clamper à 3-8% rejetterait tout le panier. Les gates réellement appliqués = penny + sharia + rr(sanity).

**Fail-closed** : staging absent / vide / malformé / `mcp_ok:false` / `error` → `_scanRuns['factor']`
`{incomplete:true, signals:0}` + **exit 3**, RIEN fabriqué (aligné `pead-scanner.js`).

### dtx refresh — MCP SEUL MOTEUR ("le MCP fait foi") — portefeuilles câblés

**Architecture (cut-over 2026-07-08).** Le serveur MCP dtx (`systematic.dailytickers.com`) est le
**SEUL moteur**. **Le binaire local + le bundle `tools/bin/dtx-data/` ont été SUPPRIMÉS** — plus aucun
fallback binaire. Le staging `data/dtx/<id>.json` (orders = `decide` CREATE, equity+metrics = `replay`)
alimente les portefeuilles câblés via `tools/dtx-scan.js#SCRIPTED_MODES` et `gen-status-page`
→ `DTX_STAGING_MAP`. Depuis le 2026-08-12, le portefeuille actif est `best` (panier multi-poches qui
remplace les six anciens portefeuilles scriptés).
**Books multi-sleeve** (`book_honest`, `hvep`) : `extractReplayMetrics` détecte `results.length>1 &&
combined`, stampe les vraies métriques `combined` et blende les courbes des sleeves (rebase 100k) — NE
publie PAS le sleeve dominant (ex. les 81 % highvol pour book_honest). Un **seul producteur** : l'ingest MCP
(`tools/dtx-mcp-ingest.js`), qui écrit le schéma canonique via les helpers partagés de `tools/dtx-scan.js`
(`buildStaging`/`extractReplayMetrics`/`writeStaging`/`mapOrder`) — `engineMode:"mcp"`.

**Contrainte dure (pas de token).** Un **subprocess `node` ne peut PAS** appeler le MCP (OAuth2 sur
claude.ai, règle ZÉRO token en .env). Seul l'**AGENT** (Claude Code en local ; `claude -p` dans le bot
cloud) détient `mcp__claude_ai_systematic__*`. Donc le staging est une **ÉTAPE AGENT, exécutée AVANT le
pipeline shell** (`publish-daily-card.sh` / `gen-status-page`) :
**agent → DtxReplay/DtxDecide (async → poll DtxJobStatus) → écrit les JSON bruts → `dtx-mcp-ingest.js` → staging**.

**🔄 Fraîcheur dtx.** `DtxDecide`/`DtxRegime`/`GetHealth` renvoient `data_asof`/`last_data_date`/`sessions_behind` ; un retard trop grand donne un statut `stale_data` (sans actions). Face à des bars dtx périmés, l'AGENT appelle **`DtxRefreshBars`** (fire-and-forget ~4 min, refresh full-univers de tous les portefeuilles) → **poller `GetHealth`** (`prefetch.running` repasse false, `last_data_date` avance, ~10 min de fenêtre) → puis re-`DtxDecide`. `expected_data_date` (contrat de date sur `DtxDecide`) recommandé en live pour refuser un « monde d'hier » silencieux. Ne backtester/décider JAMAIS sur des bars stale — force-refresh d'abord (cf. CLAUDE.md « FORCE-REFRESH avant stop »).

**Chaîne async (obligatoire).** `DtxDecide`/`DtxReplay` renvoient `{status:"async_pending", job_id}`.
Poller `DtxJobStatus(job_id)` jusqu'à `status:"done"` → lire `result` (isolé par job_id). Le cache serveur
étant chaud, beaucoup de jobs répondent quasi-inline, mais **toujours** passer par le poll.

**Prix du sweep — MCP SEUL AUSSI (fix 2026-07-17, « y'a pas de Yahoo »).** Le fallback réseau de
sweep.js est mort en cloud (`Fetched prices for 0/937` dans les runs committés) → AVANT le pipeline,
l'agent stage les bars : `node tools/price-cache-ingest.js --list-needed` → QueryData
`types=bars_daily, symbols=<lots de ~10>, days=70` (poll Jobs si async) → écrire chaque réponse
brute en `/tmp/price-stage-<NN>.json` au format `{"symbols":[...ordre exact de l'appel...],
"result":<sortie brute>}` → `publish-daily-card.sh` Step 2p2 (`price-cache-ingest.js`) écrit le
cache daté `data/.price-cache/<date>/` que `loadCachedPrice()` lit avant tout réseau. Sans staging
prix : zéro nouveau trade pour TOUS les modes ce soir-là (loggé bruyamment, jamais fabriqué).

**Tracking live (fix « 0 trades depuis D0 », 2026-07-16).** Le staging n'alimente PLUS seulement
l'affichage : `publish-daily-card.sh` **Step 2q** (`tools/dtx-pool-bridge.js`) convertit les ordres
CREATE du staging du jour en signaux `dtx_pool` dans `signals.json` (partition `universe=<modeId>`,
tp1 approximé à 2R — le moteur n'émet pas de TP). Les 6 modes scriptés ont `assetClass:'dtx'` +
`filterName:'dtx_engine'` + `universeFilter:<modeId>` dans modes-config → le **sweep** tracke
fills/exits/positions/trades (chemin append-only scellé, comme eu_smallcap/factor). Conséquence
directe : si l'agent ne régénère pas le staging (asof ≠ séance), le bridge skippe le mode
BRUYAMMENT et ce mode n'a AUCUN candidat ce soir-là → la fraîcheur du staging est maintenant
la condition d'existence des trades live, pas juste de l'affichage.

### ⛔ Preflight & complétude dtx — ANTI-SKIP SILENCIEUX (OBLIGATOIRE)

**Aucun skip silencieux.** Depuis le cut-over 2026-07-08 il n'y a plus de fallback binaire : si le MCP
ne produit pas le staging d'un mode scripté, la routine doit **échouer bruyamment** (alerte Telegram) et
le **rapport de fin** doit lister les modes SKIPPÉS. Le budget tokens/temps n'est jamais une raison de
skipper — soit régénérer, soit ALERTER + marquer le run incomplet.

**PREFLIGHT (tout en haut de l'étape dtx, AVANT tout `DtxReplay`/`DtxDecide`)** — appeler
`mcp__claude_ai_systematic__GetHealth`. Garder **DEUX** modes d'échec :
- **(a) connector ABSENT** : les outils `mcp__claude_ai_systematic__*` **n'existent pas** dans ce run
  (connector de niveau compte non chargé → token/login claude.ai expiré / compte déconnecté).
- **(b) GetHealth KO** : renvoie non-ok / timeout / erreur (serveur dtx down).

Dans l'un OU l'autre cas : **NE PAS régénérer** les modes, **NE PAS fabriquer** de staging (⛔ jamais de
données inventées), envoyer l'alerte Telegram
`send_message(to='alerts', format='html', body='⚠️ dtx MCP injoignable/connector absent au scan {date} — modes scriptés NON régénérés, staging conservé = stale')`
en nommant la **cause réelle** si connue (connector-absent vs serveur-down), consigner l'échec dans le
rapport, et **ne jamais continuer cette étape en silence**.

**Procédure AGENT PAR PORTEFEUILLE (Phase 5, AVANT `publish-daily-card.sh` / `gen-status-page`)** — si le
preflight passe, pour chaque portefeuille câblé retourné par `DtxListConfigs` et présent dans
`tools/dtx-scan.js#SCRIPTED_MODES` (actuellement `best`), `asof` = séance J+1, `from`=`2021-01-01`,
`to` = `statusSince` du mode (splice backtest↔live). Devise : utiliser celle retournée par
`DtxListConfigs` si disponible, sinon USD pour `best` :

1. `DtxReplay(portfolio=<id>, from=2021-01-01, to=<statusSince>)` → poll `DtxJobStatus` → écrire `result` dans `/tmp/<id>.replay.json`.
2. `DtxDecide(portfolio=<id>, asof=<J+1>, balances={base_currency:<cur>, cash_by_currency:{<cur>:100000}, total_equity:100000}, positions=[], orders=[])` → poll `DtxJobStatus` → écrire `result` dans `/tmp/<id>.decide.json`.
3. `node tools/dtx-mcp-ingest.js --portfolio <id> --decide /tmp/<id>.decide.json --replay /tmp/<id>.replay.json --asof <J+1> --from 2021-01-01 --to <statusSince>` → `data/dtx/<id>.json` (engineMode:"mcp").
4. **Échec par mode NON silencieux** : si un job (`DtxReplay`/`DtxDecide`/`DtxJobStatus`) échoue OU l'ingest KO pour un mode → **NE PAS ingérer** ce mode (laisser le staging committé = stale, jamais fabriqué) et **COLLECTER** le mode échoué. NE JAMAIS crasher le scan, NE JAMAIS fabriquer de données.
5. **⛔ SANITY GATE sur les métriques replay (données aberrantes ≠ échec technique — garde DÉTERMINISTE, en place)** : le MCP dtx est **sain** (diagnostic 2026-07-10 : interrogé en direct il reproduit les chiffres sains de la répétition ; les chiffres cassés du 2026-07-09 — us_highvol 1169tr/DD-63 %, etf_eu 3404tr/DD-89,6 % — ne sont PAS reproductibles côté serveur). Un run peut donc « réussir » techniquement mais avoir **capturé** un replay corrompu / param-drifté. La garde vit maintenant **dans le code** : `dtx-mcp-ingest.js` appelle `assertReplaySanity()` (`tools/dtx-scan.js`) contre les bornes de `config/dtx/_sanity-baselines.json` (`|max_dd|>50 %`, `sharpe<0`, `win_rate∉[15,92]`, `cagr<-5 %`, `total_trades` >2,2× ou <0,4× le baseline du mode). Si ça saute : le staging est écrit avec `metricsSuspect:true` + `_sanityWarning[…]`, **l'ingest sort en code 7**, et `qa-check.js` **échoue en dur** (`dtx: métriques replay saines`). **RÉACTION OBLIGATOIRE de l'agent** : si `dtx-mcp-ingest.js` sort ≠ 0 (code 7) ou que le staging du mode porte `metricsSuspect:true` → **NE PAS publier les métriques de ce mode**, **alerter Telegram `alerts`**, et re-appeler `DtxReplay(<id>, from=2021-01-01, to=<statusSince ou J-1>)` en re-vérifiant `total_trades` vs `config/dtx/_sanity-baselines.json` avant de ré-ingérer. Ne JAMAIS publier en silence un mode aberrant — c'est exactement le garbage que « le MCP fait foi » ne doit PAS laisser passer. Nouveau mode sans baseline ? les tripwires universels (DD/sharpe/win_rate/cagr) s'appliquent quand même ; ajouter sa ligne dans `_sanity-baselines.json` après un premier run sain.

**5bis. ⛔ GARDE ANTI-GEL (frozen-orders, exit 8) — `dtx-mcp-ingest.js`, en place depuis le 21/07/2026.**
Post-mortem : DtxDecide a renvoyé des CREATE **figés à J-9** ré-ingérés en silence du 09 au 21/07 — les
gardes de fraîcheur portaient sur les ENTRÉES, jamais sur la SORTIE moteur. La garde confronte désormais
la sortie à l'`asof` demandé **AVANT d'écrire** : (a) date de calcul stampée par le moteur ≠ `--asof`, OU
(b) batch CREATE **byte-identique** au staging d'une séance DIFFÉRENTE (prix/order_id/reason=Score varient
chaque jour). Si ça saute → **staging NON écrit** (contrairement à metricsSuspect qui écrit-puis-exit-7 : un
batch figé ne doit pas atteindre le bridge/sweep), **exit 8**, staging précédent conservé stale.
**RÉACTION AGENT** : re-appeler `DtxDecide(<id>, asof=<J+1>)`, vérifier que la réponse est bien recalculée,
**alerter Telegram `alerts`**, ré-ingérer. `scan-ingest-all.js` collecte les modes exit-8 (bucket « DTX
FIGÉ »). Ne JAMAIS ingérer un batch figé en silence. (N'affecte ni un premier run, ni un re-run du même
asof / `--pit`.)

**6. Historique live + drift (audit 21/07/2026 — tools/dtx-live-track.js).** Le point live QUOTIDIEN
de chaque mode scripté est appendu automatiquement par `gen-status-page.js` dans
`data/dtx-live-track.json` (append-only entre jours ; un run de mi-journée est écrasé par le run du
soir, jamais l'inverse ; backfill possible depuis les snapshots : `node tools/dtx-live-track.js
--backfill`). Pour le DRIFT backtest↔live, APRÈS l'ingest des stagings : pour chaque mode,
`DtxReplay(portfolio=<id>, from=2021-01-01, to=<J+1>)` → écrire le résultat dans
`/tmp/<id>.replay-live.json` → `node tools/dtx-live-track.js --drift`. Le calcul extrait le return du
segment [go-live → dernier point] DANS la courbe du replay complet (delta relatif — conforme à la
règle Segment Replay) et exige un point échantillonné strictement APRÈS le go-live (fail-closed : un
cache OHLCV serveur qui s'arrête avant la fenêtre produit le même « plat » qu'un zéro-fill — constat
du 21/07, replays fenêtrés en DATA FAILURE). Seuils : |drift| <2pp OK · 2-5 WATCH · >5 ALERT ; WATCH/
ALERT → le signaler dans le rapport + Telegram `alerts`. Gardes : `qa-check` warn si la série a >72h
de retard sur un mode ; affichage page status : ligne « Live history · N pts · Drift vs engine ».

**Alerte consolidée par mode** — après la boucle, si **AU MOINS un** mode a échoué : envoyer **UNE seule**
alerte Telegram consolidée `send_message(to='alerts', format='html', body=…)` listant **exactement** les
modes stale/manquants (+ la cause par mode si connue). C'est la preuve que le run est incomplet, pas un
pass silencieux.

**Complétude machine + rapport.** `publish-daily-card.sh` **Step 4d** est le **filet de fraîcheur
secondaire** (un subprocess `node` ne peut PAS appeler le MCP, donc il ne régénère rien) : il appelle
`writeStagingCompleteness(<J+1>)` (dans `tools/dtx-scan.js`) qui vérifie `stagingStatus()` par mode
(staging présent + `engineMode:"mcp"` + daté d'aujourd'hui) et **écrit** `data/dtx/_staging-completeness.json`
(`{scanDate, generatedAt, modes, generated[], skipped[], complete}`) + imprime un résumé LOUD. Ce marqueur
est **lu par `tools/qa-check.js`** qui **escalade** en **❌** tout mode stale/manquant d'un run daté
d'aujourd'hui (fail loud ; `qa-check` sans `--strict` reste non-crashant mais poste le ❌ dans Discord). Le
**rapport de fin DOIT** lister les modes scriptés **GÉNÉRÉS vs SKIPPÉS** — ne jamais écrire « scan complet »
si `qa-check` remonte le ❌ dtx. `node tools/dtx-scan.js --mode X` n'exécute plus de scan (guidance + exit 0).

**Gap résiduel honnête** : l'alerte Telegram passe par la **même connexion compte** que le MCP systematic.
Si `claude -p` est **totalement mort** (token compte expiré → le run ne démarre pas), il ne peut ni scanner
ni alerter — dans ce cas seul le **filet de fraîcheur** attrape le trou : le staging reste stale et
`qa-check` remonte le ❌ dtx **au run suivant** (marqueur non rafraîchi). C'est le seul garde-fou quand le
compte lui-même est déconnecté.

**Splice backtest↔live** via `PORTFOLIO_TO_MODE` (`--to` = `statusSince`). Le replay MCP n'est **pas**
byte-déterministe (le serveur re-fetch des adj-close plus frais que l'ancien bundle gelé) : la courbe
historique peut bouger légèrement jour à jour — **attendu, pas un bug**. Le MCP fait foi. La parité
MCP↔binaire n'est plus un critère (le binaire n'existe plus) ; le serveur a levé l'OOM des gros univers
(`us_highvol` 2403 titres, `stockbox_nasdaq` 5189 titres) via son garde-fou RAM (date-clamp).

### ⛔ Phase 5.5 — FORTRESS-PM A+ HALAL POOL — ÉTAPE OBLIGATOIRE (systématique, AVANT gen-status-page)

**NE PAS SKIPPER — SYSTÉMATIQUE À CHAQUE `/scanner` (local ET cloud).** Fortress est géré par le
PM (toi), pas par sweep.js. Cette étape est AI-driven (appels MCP), exécutée DANS le pipeline au
même titre que les scripts node. `Skill(skill="fortress-pm")` → lire et appliquer
`.claude/skills/fortress-pm.md` (§3.0 Sharia → §3.2 loose screen RunScreener → §3.3 les 4
éliminatoires : guidance relevée, ≥5 EPS beats, PE fwd <35x, extension EMA20 ≤3%).

**⚠️ LIVRABLE CRITIQUE — écrire `fortress_pool` dans `scanner/YYYYMMDD/signals.json` AVANT
`gen-status-page.js`.** Les modes **aplus** ET **fortress** consomment cette clé
(`poolFrom('fortress_pool')` dans `scanner-parser.js`) comme source dédiée de leurs panneaux
d'ordres. **Sans `fortress_pool` écrit :**
- `scanner-parser.js` tombe en **fallback** (`fortress_fallback` = signaux du scan score≥92 &
  `sharia===true`) — fail-closed mais fragile ; les jours sans signal Halal ≥92 stampé, aplus/fortress
  rendent **vides**.
- Un `fortress_pool` **présent mais vide `[]`** = "0 A+ Halal aujourd'hui" légitime (PAS de fallback) —
  acceptable, mais uniquement APRÈS avoir réellement tourné le screen + les 4 éliminatoires et l'avoir
  documenté (combien screenés / recalés / pourquoi).

**Format `fortress_pool` (chaque entrée) :** `{ticker, name, score, strategy:"FortressA+", region,
sector, entry, stop, tp1, tp2, rr, horizon, sharia:true, earnings_clear, dilution_clear, thesis}`.
La clé `strategy:"FortressA+"` est OBLIGATOIRE (le filtre `fortress_pm` matche `/^FortressA\+$/i` ;
sans elle les ordres ne s'affichent pas). `aplus` gate `minScore≥92` (A+ strict), `fortress` gate
`minScore≥85` (déploiement Halal). **ZÉRO haram** — chaque ticker MCP-factchecké, `sharia===true`,
jamais d'invention (⛔ MCP hard-stop si données incohérentes). Écrire via script (jamais à la main).

Le prompt opérationnel complet est dans `.claude/skills/fortress-pm.md` — le LIRE et l'APPLIQUER.

**Séquence DÉTERMINISTE — 7 étapes, dans cet ordre, TOUTES obligatoires :**

**F1. CHARGER LE BOOK** : Lire le BLOC §1 dans `.claude/skills/fortress-pm.md`. Ce bloc contient
les positions tenues, sorties, cash, et NET courant. C'est l'état mutable — le reste du prompt
(§0 à §9) sont les règles fixes.

**F2. RECALCULER LES PRIX LIVE** : Pour CHAQUE ticker du §1 (tenus + watchlist redéploiement) :
```
QueryData(symbol="{TICKER}", data_type="quote")        → prix live
QueryData(symbol="{TICKER}", data_type="technicals")   → EMA20, EMA10, EMA50, ATR14, RSI14
```
Recalculer l'extension EMA20 : `ext% = (price / ema20 - 1) × 100`.
Recalculer le trailing stop : EMA20 si en gain, sinon stop initial.
**ZÉRO FABRICATION** : si QueryData échoue pour un ticker → le signaler, ne JAMAIS inventer.

**F3. JAUGE RÉGIME** :
```
QueryData(data_type="regime")                           → label + composantes + VIX
QueryData(data_type="performance_rotations")            → leaders vs laggards par secteur/industrie
```
Déterminer le MODE DU JOUR : DEPLOY / PYRAMIDE / DEFEND / RISK-OFF / RECOVERY (cf. §4).
Déterminer l'état moteur : CŒUR ON (toujours) / SATELLITE ON ou OFF (risk_on/recovery seulement).

**F4. GÉRER CHAQUE LIGNE** : Pour chaque position tenue, selon le mode du jour + rotation de
son groupe :
- Groupe MÈNE → trail EMA20, tenir / pyramider si pullback
- Groupe BASCULE LAGGARD → resserrer stop, préparer sortie
- Profit-lock anti-give-back A+ : +20% latent → stop ≥ entrée×1.10 ; +30% → stop ≥ entrée×1.18 et partiel 1/3 si extension verticale/gap/volume extrême ; +40% → vendre 1/3 à 1/2 puis stop du solde ≥ max(stop courant, entrée×1.25, plus haut close×0.85)
- Sous EMA20 close → SORTIR
- RSI extrême (>75) → partiel 33% + serrage
- Stall ≥4 jours → serrage 50%
Appliquer les ordres via broker MCP (paper) : `rb_paper_close_position` pour les sorties,
`rb_paper_modify_orders` pour les trailing stops.

**F5. REDÉPLOYER LE CASH** (si slots cash > 1 ET mode = DEPLOY ou RECOVERY) :
Exécuter le Step 0 scan A+ (§3.0 → §3.7) dans cet ordre STRICT :
1. §3.0 SHARIA : exclure riba / haram / ratios non conformes → `GetInstruments(symbol="{TICKER}")`
2. §3.1 ROTATION : identifier les groupes leaders via F3
3. §3.2 POOL : `RunScreener(pass_expr="rsi14>48 && rsi14<60 && macd>0 && vol>2500000", top_k=90)`
   → poll `Jobs(job_id=...)` (canonique, ex-CheckJobStatus) → post-filtre market_cap 2-20G$, leaders only, pas déjà au book
4. §3.3 LES 4 ÉLIMINATOIRES par ticker survivant :
   - ① Guidance relevée : `QueryData(symbol="{T}", data_type="earnings")`
   - ② ≥5 EPS beats : `QueryData(symbol="{T}", data_type="earnings_quarterly", limit=8)`
   - ③ PE fwd <35 : `QueryData(symbol="{T}", data_type="stats")` → forwardPE
   - ④ Extension EMA20 ≤3% : calculé depuis F2
5. §3.4 FLAGS : `QueryData(symbol="{T}", data_type="news")` + dilution check
6. §3.5 SCORING /100 → A+ ≥ 92
7. §3.7 WAR-ROOM : panel adverse (quant/PM/risk/short), vote ≥3/4 pour passer
Entrées via broker MCP : `rb_paper_place_orders` avec sizing §1bis (tier conviction/standard/starter).
Si aucun A+ ne qualifie en risk_on → cash excédentaire en ETF Sharia (SPUS/HLAL/UMMA) via §6.

**F6. RÉÉCRIRE LE BLOC §1** : Mettre à jour la section `## 1. ÉTAT DU BOOK` dans
`.claude/skills/fortress-pm.md` avec le nouvel état : positions tenues (ticker/entrée/mark/note),
sorties, cash, NET, MaxDD, slots libres. **Écrire via l'outil Edit**, pas manuellement.

**F7. DIGEST + NOTIFICATION** : Produire le digest §8bis (format compact) et l'envoyer :
```
send_message(to="scanner-fortress", body="<digest HTML>", format="html")
```
Format Telegram obligatoire : `<b>` pas `**`, `\n` pas `<br>`.

**Fortress ne passe PAS par sweep.js** — ses trades sont gérés ici par le PM via broker MCP.

Après le push, envoyer les notifications per-mode via le **générateur dédié** puis **MCP Notification** :
```bash
# 1. Génère les messages per-mode (lit modes-config + portfolio/v1/<mode>/all.json + signals.json)
node tools/gen-scanner-notifications.js --out    # écrit data/scanner-notifications.json
```
```
# 2. Passe le tableau data/scanner-notifications.json#messages TEL QUEL à send_batch :
send_batch(messages = <contenu de data/scanner-notifications.json#messages>)
```
- Chaque message = `{ to, format:"html", body }` déjà prêt (alias pré-configuré, HTML, \n). **Ne rien reformater.**
- Le générateur gère honnêtement : **Bull 0-signal** explique le gate 8× haute-conviction (pas cassé), **Fortress** montre l'univers Halal (☪, sharia===true), modes pleins expliquent pourquoi 0 nouveau candidat.
- **NE PAS** rédiger les messages à la main — le générateur garantit cohérence avec la status page (mêmes stats/positions/régime).
- Alias : `scanner-turbo/dynamic/balanced/orbit/fortress` sont pré-configurés. `scanner-bull`/`scanner-aplus` : créer via `set_alias` OU router vers `alerts` OU filtrer avec `--modes`.
- Les MCPs (DailyTickers, Notification, Memory) sont enregistrés via OAuth2 — aucun token en .env nécessaire.

**Post-pipeline checklist OBLIGATOIRE** :
- QA check (`tools/qa-check.js`) doit afficher 0 ❌
- **Gates audit (docs/scanner-gates.md) — pass/fail NOMINATIF publié** : `validate-scan.js` passe
  G1 `entry_strategy_coherence`, G2 `etf_lookthrough_correlation_cap`, G3 `regime_score_drop`
  (+ G4 heartbeat via `gen-status-page.js`). Le scan publie le verdict nominatif des 4 gates
  (G1: PASS/FAIL, G2: …, G3: …, G4: …) dans sa section Méthode / QA de pipeline — un gate absent
  du rapport = run non conforme. Prérequis de génération `signals.json` : chaque signal ETF porte
  `lookthrough:{factor, clusters[]}` (décomposition top holdings via MCP), la racine porte
  `exited_factors:[]` si la thèse du jour sort un facteur, et la page affiche la zone d'entrée
  COMPLÈTE (`entry_low`–`entry`), jamais la seule borne basse.
- 🚫 **MODE « BULL » / candlestick — SUPPRIMÉ (été 2026).** Ne PLUS l'exécuter dans le pipeline : pas de `candlestick-scanner.js`, pas de staging candlestick, pas de marqueur `_candlestickScan` attendu. Le paragraphe ci-dessous est conservé UNIQUEMENT comme référence historique du gabarit `--ingest` (que `metals`/`hybrid`/`highvol` réutilisent). Ignorer pour un run /scanner normal.
- ⚠️ _(historique)_ **Mode Bull = haute-conviction, 0 signal est LÉGITIME les jours calmes** : `candlestick-scanner.js` ne qualifie un signal Bull que si un pattern chandelier a un **spike de volume ≥ 8× la moyenne 20j le jour du signal** (volume de CLÔTURE, parité systematic-tss config `americanbull` — PAS intraday J+1) + score ≥ 88 + dollar-volume ≥ $1M. Sur 5 ans : ~1 trade/sem (1061 trades, parité Go/JS validée). **Vérifié 2026-06-30** : sur 3512 tickers, 1 seul candidat (MESH) passe score+vol mais échoue la liquidité ($111k < $1M) → **0 ordre, identique au backtest Go**. Donc **0 signal Bull ≠ bug**. Le QA check vérifie le **marqueur `_candlestickScan`** (preuve que le scanner a tourné : `universeFetched`, `detectedPatterns`, `qualified`), PAS la présence de signaux. Le seuil 8× vit dans `data/scanner-filters.json#candlestick.min_vol_ratio_trading` (source de vérité, lu par sweep.js + gen-status-page.js). **Source des prix = `--source yahoo`** (défaut). **CRITIQUE** : `--date` = dernier jour de trading (pas la date du dossier si weekend). `--folder` = nom du dossier scanner (= prochaine séance). Le scanner DOIT tourner à chaque pipeline pour écrire le marqueur, même s'il qualifie 0.
- **QA check** (`tools/qa-check.js`, step 7 de `publish-daily-card.sh`) doit afficher **0 ❌**. Investiguer
  CHAQUE échec (pas seulement les ⚠️). `qa-check` lit `signals.json` (**PAS** le HTML) — idem pour la QA
  des strategy labels.
- `scanner/status/index.html` par mode : pas de "Pending (Nd/Md)" stale sur des trades dont `exitDate` est
  passé. Compteur « Orders to Place » cohérent avec les rangées affichées (le filtre n'applique que le jour
  d'exécution — commit `0fd444af`).
- `data/risk-snapshots.json` — **non-stub via `--ingest`** : `source:"ingest:mcp_connected"`,
  `regimeProbability` peuplé (depuis `GetMarketContext`), modes à 0 position = `{reason:"no_positions"}`
  (correct, pas un échec), modes AVEC positions = VaR agent-fed ou `awaiting_mcp` si non fourni.
- Les strategy labels de `signals.json` correspondent aux labels de setup de `data.json`.
- **Cohérence des stats** pour les **6 modes** (`turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl`) :
  - Hero stats (Closed Trades, WR, PF, Return, DD) dans `scanner/status/index.html` = valeurs `frozen_*`
    de `data/backtest-results.json`
  - Nombre de Trade History = hero "Closed Trades" (même filtre
    `closedTrades.filter(!_premature).length`)
  - Divergence → relancer `node tools/gen-status-page.js`
- **Cohérence API** : `portfolio/v1/{mode}/equity.json` contient des stats non-null pour les 6 modes après
  `gen-api.js`.
- **Intégrité des trades** dans `data/backtest-trades.json` :
  - Zéro trade expiré le jour même (`holdDays===1 && status==='expired' && entryDate===exitDate`)
  - Zéro trade expiré trop tôt (`holdDays < mode.horizon && status==='expired'`)
- **Timing du sweep** : `sweep.js` renvoie null pour les trades sans assez de données forward
  (`lastDate < expireDate`). C'est sûr — ils seront simulés au run suivant quand plus de barres OHLC
  arriveront.
- **TKL pool** : gate per-mode `modes-config.json#tklPoolEnabled` respecté. Backfill Time Machine présent
  dans `scanner/status/history/*.json` (commit `4a39aea3`).
- **BSD date fallback** : tout `date -d` dans un script shell doit avoir un fallback BSD `date -v`
  (helper `publish-daily-card.sh`).

## Phase 5b — Regime Recalibration (optionnel : hebdo OU sur bascule de régime)

Recalibration append-only des paramètres de mode. Détecte un changement significatif de régime vs
`data/modes-config.json#_regime` et propose de nouveaux params depuis les champs `advisor_*` :

```bash
node tools/regime-recalibrate.js                      # dry-run report
node tools/regime-recalibrate.js --apply              # apply (append to config-history.json)
node tools/regime-recalibrate.js --force --apply      # bypass stability gate
```

**Comportement** : détecte le régime dominant sur les 7 derniers runs scanner, exige **3 jours consécutifs
stables** au nouveau régime avant de déclencher. **N'écrase JAMAIS l'historique** — append d'une nouvelle
version dans `portfolio/v1/config-history.json` avec `_version` bumpé et tag `triggered_by`.
`modes-config.json` reçoit les nouveaux params avec la chaîne `_prevVersion`.

⚠️ Prérequis : `data/backtest-results.json` doit contenir des champs `advisor_<mode>` non-null. Si les
seuils stricts du sweep ne sont pas atteints, l'advisor retombe sur `advisor_<mode>_relaxed`. TKL a besoin
d'`advisor_tkl` peuplé (array `advTkl` de sweep.js — voir l'audit `.omc/audit-20260502/dev.md`).

## Phase 5c — Rolling Walk-Forward Sanity Check (optionnel, ad-hoc)

```bash
node tools/rolling-walk-forward.js                    # rolling 10-day window
node tools/rolling-walk-forward.js --days=20          # rolling 20-day window
```

Écrit `data/rolling-walk-forward.json` + un résumé markdown. Séries temporelles WR/PF/Ret glissantes sur
N jours par mode. Caveat : les tailles d'échantillon faibles (~9 semaines de données) limitent la puissance
statistique — à utiliser comme signal de **direction**, pas de niveau.

## Phase 6 — Validation multi-agents (skip UNIQUEMENT en interactif avec accord user)

**Deux invariants NON négociables, même en fast-path** : (1) le panel senior-review tourne **AVANT** le
push final de la session de scan ; (2) `data.json#engine_meta.risk_gating` doit porter les champs réels
(`ensemble_confidence`, `crisis_prob_5d`, `max_pair_correlation`, `avg_off_diagonal_correlation`, `sizing`)
— un bloc vide = le risk gating de Phase 2 n'a pas tourné = **scan NON conforme** (garde `qa-check`
« risk_gating non vide »).

Spawner **7 agents de validation en parallèle** :

| Agent | Role | Focus |
|-------|------|-------|
| Trader | Trade quality | Entry/stop/TP realism, R/R, tradability |
| Risk | Portfolio risk | Duplicates, diversification, correlation, DD exposure |
| Quant | Quantitative rigor | Score justification, R/R math, confluence independence |
| Analyst | Macro/fundamental | Regime coherence, catalysts, sector rotation logic |
| QA | Data integrity | Schema compliance, cross-file consistency, pipeline outputs |
| Dev | Code quality | HTML validity, script loading, performance |
| UX | User experience | Layout, mobile, charts, navigation, accessibility |

Chaque agent renvoie PASS/WARN/FAIL par zone de check, avec les correctifs requis.

⚠️ `--skip-validation` est **RÉSERVÉ à un run interactif avec accord explicite du user dans la session**.
**INTERDIT aux routines / runs autonomes** : la règle durable `analysis-senior-review-first` exige le panel
AVANT publication, jamais en rattrapage (violée par le run nocturne du **22/07** — `risk_gating` vide +
zéro panel, corrigé a posteriori).

## Phase 7 — Fix & Re-Verify (si la Phase 6 remonte des problèmes)

1. Collecter tous les items FAIL et WARN des 7 agents
2. Corriger `data.json` pour les problèmes de contenu (scores, R/R, strategy labels, erreurs factuelles)
3. Re-render HTML : `node tools/render-scanner.js scanner/YYYYMMDD/`
4. Re-jouer la validation publish
5. Re-spawner les agents en échec pour vérifier les correctifs
6. Itérer jusqu'à ce que tous les agents renvoient PASS (**max 3 itérations**)

## Phase 8 — Final Commit & Notify

C'est ici — et **seulement** ici — que quelque chose devient public. Tout ce qui précède est local et
défaisable ; à partir de cette ligne, plus rien ne se rétracte.

```bash
bash tools/downstream-split.sh distribute YYYYMMDD   # image + QA avant push + commit + push
```

`distribute` appelle `publish-daily-card.sh --no-sweep --no-telegram` : image, QA **avant** le push, commit,
push — mais **PAS le Telegram** (envoyé par l'AGENT via le MCP notification).

⚠️ Avec `--no-sweep`, `publish-daily-card.sh` ne stage que la carte, `scanner-metrics.json` et
`scanner-positions.json`. Les artefacts recalculés par `compute` doivent être ajoutés à la main, de façon
**CIBLÉE (jamais `-A`)** :

```bash
git add scanner/YYYYMMDD/ data/scanner.json data/scanner-history.json
git add scanner/status/ portfolio/v1/
git add data/backtest-results.json data/backtest-trades.json data/risk-snapshots.json data/dtx/
git commit -m "feat: scanner YYYYMMDD — auto-published"
git push origin main
```

Le `git push` de `distribute` emporte aussi le commit local laissé par `publish.js --no-push` en Phase 4 —
c'est voulu, il n'y a qu'un seul moment de mise en ligne. Si `--skip-downstream` a été utilisé, ni
`compute` ni `distribute` n'ont tourné : le commit + push ci-dessus est alors **entièrement à ta charge**.

## Error Handling (/scanner)

- **MCP screener renvoie vide** → utiliser les top movers de `GetMarketContext(facets="overview")` +
  sélection manuelle des candidats
- **Le screener DSL score tout à 0** → ignorer les résultats DSL, s'appuyer sur AutoScreener seul
- **Sweep timeout** → continuer le pipeline, le sweep n'est pas bloquant
- **Échec de la notification Telegram** → logger un warning, ne pas bloquer
- **`refresh-risk-metrics.js`** → **voie `--ingest` (MCP connecté)**. En local, un subprocess node ne peut
  pas s'authentifier au MCP OAuth2 (auth-fail) → l'AGENT fournit les données. La corrélation MCP peut être
  cassée côté serveur (« 0 common trading days », et des `.PA` EU mélangés cassent le calcul) → **US-only**
  + fallback concentration manuelle (max 2/secteur). **NE JAMAIS inventer de VaR/corrélation.**
- **Boucles de validation Phase 6 > 3** → stop, rapporter les problèmes restants au user
- **TKL pool vide** (backfill Time Machine manquant) → relancer le scanner avec `--date YYYYMMDD` pour
  peupler `scanner/status/history/YYYYMMDD.json`

## Optimisation Paramétrique — Méthode Plateau (ON-DEMAND)

```bash
node tools/optimize-param.js --mode balanced --all
node tools/optimize-param.js --mode balanced --param maxStopPct
node tools/optimize-param.js --mode balanced --param horizon --range 2,3,5,8,10
```

**Méthodologie "Mountain Plateau" (OBLIGATOIRE) :**
- **1 paramètre à la fois** — autres restent baseline
- **Plateau > pic** — zone stable (retour ≥ 85% du max), PAS le maximum
- **Centre du plateau** — valeur recommandée = centre zone stable
- **Stabilité ≥ 50%** — ignorer plateaux étroits (< 25% = overfitting)
- **Consistance cross-période** — vérifier sur sous-périodes
- **Assemblage** — combiner optima individuels, tester, ≥ 85% meilleur individuel
- **Fine-tuning** — micro-sweep ±1-2 steps
- **Validation** — full + stress + recent + param ±10%

**⚠️ ANTI-PATTERNS (INTERDITS) :**
- ❌ `sweep.js --full-sweep` pour config prod (26M combos = data snooping)
- ❌ Modifier plusieurs params simultanément
- ❌ CAGR max absolu (pic étroit = overfitting)
- ❌ Ignorer contradictions données réelles

**Ordre d'optimisation (impact décroissant) :**
1. portfolioSize / topN
2. maxStopPct / atrStopMult
3. horizon
4. dailyTrailPct / breakevenPct
5. filterName / minScore
6. rotation / partialTP / staleDays / entryGatePct

## Rétrospective Scanner

1. Lire tous scans de la semaine, extraire setups + OHLCV bars via `QueryData` (bars_daily)
2. Calculer outcomes : TP1 hit, stopped, pending, no-fill (VWAP gate)
3. Créer `scanner/retrospective/YYYYMMDD/index.html` (note A+ à F = 50% Setup HR + 50% Portfolio Sim)
4. Mettre à jour redirect `scanner/retrospective/index.html`
5. **Mettre à jour `data/retro-summary.json`** — ajouter la nouvelle rétro aux données agrégées. Ce fichier alimente les charts de tendance.
6. **Mettre à jour `data/scanner-lessons.json`** — ajouter/mettre à jour les règles issues des conclusions de la rétro. Bumper la version. Résoudre les open_questions si la rétro fournit des données.
6b. **Sortie obligatoire du moteur `lessons-engine.js`** (NE PAS éditer `scanner-lessons.json` à la main pour ces étapes — seul le moteur écrit confidence/status) :
   ```bash
   node tools/lessons-engine.js --decay                                                    # recalcule la confidence effective (idempotent, décrémente les market_truth non revalidées)
   node tools/lessons-engine.js --contradictions                                           # scan pairwise des règles actives à effets opposés sur un scope qui overlap → pénalité 30% + _open_questions
   # Pour CHAQUE règle testée par cette rétro (candidate en attente de validation OU active à revalider) :
   node tools/lessons-engine.js --validate <rule-id> --outcome <win|loss|neutral> \
     --evidence-json '{"sample_size":<n>,"wins":<w>,"losses":<l>,"expectancy":<e>,"tickers":[...],"clusters":[...]}'
   #   n/wins/losses/expectancy viennent des champs mae_pct/mfe_pct/outcomes{d1,d5,d20}/r_multiple des trades
   #   clôturés de la semaine (data/backtest-trades.json) — PAS d'estimation narrative.
   node tools/lessons-engine.js --report                                                   # vérifier l'état effectif (confidence, status, expires_at) après decay/validate/contradictions
   ```
   Puis **re-proposer les candidates prêtes à `--promote <rule-id>`** (celles dont l'evidence a franchi les gates depuis la dernière rétro) :
   ```bash
   node tools/lessons-engine.js --promote <rule-id>    # REFUSE et liste les gates manquants si sample_size<12, <3 tickers distincts, <2 clusters distincts, scope.regimes invalide, ou expectancy null — ne JAMAIS forcer
   ```
   **⚠️ Aucune promotion narrative** : `--promote` applique des gates anti-overfitting stricts (sample_size ≥ 12, ≥ 3 tickers distincts, ≥ 2 clusters distincts, scope.regimes cohérent, expectancy non-null). C'est le moteur qui décide, pas la rétro — si les gates ne sont pas atteints, la règle reste `candidate` même si la conviction qualitative est forte.

   **Miroir MCP memory (outcome linkage)** : pour chaque règle validée ci-dessus qui existe
   AUSSI côté memory.hbfs-cloud.com (workspace `dailystocks`, même sujet), appeler
   `report_usage(memory_id, outcome=confirmed|weakened|invalidated)` avec les mêmes chiffres
   R/MAE/MFE en evidence — `confirmed` réarme le decay serveur, `invalidated` déprécie.
   (Tools `report_usage`/`get_inbox`/`get_delta`/`ack_memory` exposés depuis le 2026-07-02 ;
   si absents de la session → skip avec note, ne pas bloquer la rétro.)
7. **Indexer + Push** :
   ```bash
   node tools/publish.js --type retro --path scanner/retrospective/YYYYMMDD/index.html
   ```

**⚠️ Checklist post-rétro (OBLIGATOIRE) :**
- [ ] **Notation aux niveaux publiés attestée** : `node tools/qa-retro.js scanner/retrospective/YYYYMMDD/`
      PASS (câblé dans `publish.js --type retro`) — chaque ligne notée respecte
      `|entrée_effective − entrée_publiée| <= 2%` (tolérance unique `tools/lib/fill-policy.js`)
      OU est NON REMPLI ; tout écart va en « Transparence process », jamais en rebasing silencieux
- [ ] **Bloc index rafraîchi** : `node tools/update-scanner-perf.js` exécuté APRÈS la mise à jour
      de retro-summary.json (assertions updated_at/compteur/note/lien/régime = exit 0), puis
      heartbeat G4 `fresh: true` dans `data/scanner-heartbeat.json` (via gen-status-page)
- [ ] **Boucle de promotion** : toute règle mémoire à confiance ≥ 0,70 ET n ≥ 5 est encodée en gate
      bloquant au scan suivant (scanner-filters.json + validate-scan.js + docs/scanner-gates.md)
- [ ] retro-summary.json contient la nouvelle rétro avec grade, HR, stats
- [ ] scanner-lessons.json bumped avec nouvelles règles ou mises à jour
- [ ] `lessons-engine.js --decay` puis `--contradictions` exécutés (pas d'édition manuelle de confidence/status)
- [ ] Chaque règle testée par la rétro a reçu un `--validate` avec evidence chiffrée (mae/outcomes/r_multiple des trades de la semaine)
- [ ] Candidates éligibles re-testées via `--promote` (gates du moteur, jamais de promotion à la main)
- [ ] Redirect `scanner/retrospective/index.html` pointe vers la dernière rétro
- [ ] Carte ajoutée via `add_card.js`

## Analyses Refresh (à chaque run scanner)

⚠️ **DEUX DATES DISTINCTES (garde anti-hallucination, diagnostic 2026-07-11)** :
- **"prix vérifié le X"** = `meta.lastCheckedDisplay` — re-grade MÉCANIQUE (prix courants). Bumpé à chaque
  refresh. NE bumpe PAS la date de publication.
- **"analyse régénérée le X"** = `meta.date` / `report-card-meta` — DEEP-refresh (contenu régénéré,
  fact-checké MCP par l'AGENT). Bumpé UNIQUEMENT sur une vraie régénération. Ne JAMAIS afficher une date
  d'analyse "fraîche" sans un vrai passage MCP (leçon IOVA/ALT/ALLR : hallucination de 52W/cash/mcap).

### Étape 1 — Grade Auto-Refresh (AUTOMATIQUE — CÂBLÉ dans publish-daily-card.sh Step 4a1 depuis 2026-07-11)
```bash
node tools/refresh-analyses.js --max-age 30 --commit
```
⚠️ Historique : cette étape n'était JAMAIS appelée par `/scanner` (uniquement documentée ici) → les analyses
gelaient (ALLR/IOVA/ALT figées au 01/07). Désormais **câblée dans `tools/publish-daily-card.sh` Step 4a1**
(non-bloquant). Rafraîchit toutes les analyses < 30 jours **+ force la watchlist** (`data/analyses-watchlist.json`,
lue automatiquement) :
- Fetch prix courants via MCP Gateway (fallback Yahoo/allorigins)
- Re-évalue le grade ; met à jour `meta.lastCheckedAt` + `meta.lastCheckedDisplay` ("prix vérifié le X")
- Si grade change → met à jour le JSON, re-rend le HTML, badge `⬇ A+ → A` sur la carte
- Si trade complété (prix > TP2) → marque `status: completed` sans dégrader le grade
- Ajoute `gradeHistory[]` ; `--dry` preview, `--tickers` pour forcer d'autres tickers
- **NE bumpe PAS `meta.date`** (publication) — c'est le rôle du DEEP-refresh (Étape 2, agent).

### Étape 2 — Watchlist Deep Refresh (MANUEL, tickers critiques)
Fichier : `data/analyses-watchlist.json` — liste de tickers dont l'analyse doit être régénérée complètement.
```json
{ "tickers": ["ALT", "IOVA", "ALLR"], "frequency": "each_scanner_run" }
```

### Process par ticker (watchlist uniquement)
1. **Archiver** l'analyse existante : `mv analyses/{TICKER}/index.html analyses/{TICKER}/archive/YYYYMMDD/index.html`
2. **Collecter données fraîches** via MCP (`GetInstruments` + `QueryData types=sec_filings,flags,insider_transactions,news`)
3. **Générer** la nouvelle analyse en français niveau intermédiaire
4. **Mettre à jour la modale Historique** avec lien vers la version archivée
5. **Publier** : `node tools/publish.js --type analysis --path analyses/{TICKER}/index.html --no-notify`

### Contraintes
- **Versioning** : toujours archiver avant d'écraser
- **Pas de doublons** : vérifier `data/analyses.json` avant `add_card.js`
- **Qualité** : même standard que les analyses manuelles
- **Parallélisable** : les analyses sont indépendantes, lancer les agents en parallèle
