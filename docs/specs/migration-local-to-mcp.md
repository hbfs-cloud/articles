# Migration Plan — Local Scanners → MCP `marketdata` Data Path

**Statut : SPEC + POC #1 (`factor`) LIVRÉ. Aucun scanner supprimé, aucun univers legacy retiré.**
**Auteur : recon agent · Date : 2026-07-11**

> **✅ POC #1 — `factor` : voie MCP `--ingest` ACTIVE (2026-07-11).** `tools/factor-scanner.js` a
> désormais **deux voies** : (a) **VOIE MCP `--ingest <staging>`** (RECOMMANDÉE — l'agent appelle
> `mcp__marketdata__*` `RunScreener`+`QueryData`, écrit `/tmp/factor-stage.json`, le node le PARSE)
> et (b) **VOIE LOCALE Yahoo+`tkl-universe.json`** (conservée comme **fallback DEPRECATED**, non cassée).
> Les deux partagent le MÊME `buildPool()` → `factor_pool` byte-identique (cohérence A/B). Gates hérités
> appliqués côté ingest : penny<5, sharia passthrough, rr(sanity) ; fail-closed exit 3 + marker incomplet
> si staging absent/`mcp_ok:false`. Détail agent→MCP→`--ingest` : `scanner-pipeline.md` §"factor — voie
> MCP (`--ingest`)". Exemple de staging : `docs/specs/examples/factor-stage.example.json`.
> **Reste à faire (chantier séparé, gated)** : gate A/B régime-aware complet (backtest local↔MCP) avant
> de retirer `tkl-universe.json` + le fetcher Yahoo de `factor-scanner.js` (§6, candidat de retrait #1).

## 0. Décision-cadre & contraintes (immuables)

- **`mcp-only-data-path`** (mémoire `7b3d954f`, décision utilisateur, git `d74aabae1`, priority=CRITICAL) :
  la donnée marché (univers, prix, fondamentaux, screening) passe par
  `mcp__marketdata__*` (`RunScreener` / `QueryData` / `GetInstruments` / `GetMarketContext` /
  `RunBacktest`), **PAS** par les fetchers/univers LOCAUX (`data/*-universe.json`, Yahoo direct,
  `stockanalysis-fetcher`). Ces derniers sont **legacy à migrer/virer, mode par mode, gated — jamais de mass-delete**.
- **Contrainte dure OAuth2** : un subprocess `node` NE PEUT PAS appeler le MCP (zéro token en `.env`).
  ⇒ tout scanner qui a besoin du MCP devient une **ÉTAPE AGENT** : l'agent (`/scanner` ou sous-agent,
  `claude -p` en cloud) appelle le MCP → écrit un **pool JSON committé** dans `scanner/YYYYMMDD/signals.json`
  (ou un staging `data/…`) → le `node` downstream (`sweep.js`, `gen-status-page.js`) lit le pool committé.
  Pattern déjà en prod : **top-10 A+** (agent MCP), **staging dtx** (`dtx-mcp-ingest.js`),
  **pead/filings voie B** (`--ingest`).
- **MCP HARD STOP** (CLAUDE.md) : MCP bloqué ou données incohérentes ⇒ STOP, jamais de fabrication,
  jamais de re-fallback silencieux vers Yahoo.
- **EU BLOQUÉ** (mémoire `mcp-eu-coverage-gap` `3422e39c`, priority=HIGH) : `RunScreener region=eu`
  renvoie **0** (gate 200 barres, 3764/3764 skipped « insufficient history »), `bars_daily` EU ≈ **3 séances**,
  `GetReferentialData region=eu` ignore la région (renvoie la DB US). ⇒ **aucun scanner EU migrable
  tant que le MCP n'a pas backfillé l'EU** (≥250 barres OHLCV + énumération EU réelle).

## 1. Deux tiers de « mode » (à ne pas confondre)

L'inventaire ci-dessous distingue :

- **Config modes** (`data/modes-config.json.modes`, sizeables, avec `status`) : `turbo`, `dynamic`,
  `balanced`, `secured`(Orbit), `tkl`, `alpha`, `aplus`, `fortress`, `highvol`, `hybrid`, `forex`,
  `etf`, `etf_eu`, `stockbox`, `factor`, `pead`, `filings`, `gap`.
- **Sous-pools / filtres du composite** : `momentum`, `bull`(candlestick), `trendline`, `crypto`,
  `metals`, `casablanca` **ne sont PAS des clés `modes-config.modes`** — ce sont des pools/markers
  (`_scanRuns[...]`, `_candlestickScan`, `forex_pool`, `crypto_pool`, `factor_pool`) dans
  `signals.json`. Les scanners US génériques (momentum / candlestick / fractal / highvol / trendline /
  hybrid) **alimentent le `signals[]` composite partagé**, consommé par les config modes sizeables
  (turbo/dynamic/balanced/fortress/aplus) via les `filterName` de `sweep.js`.
- **5 modes « scriptés » dtx-câblés** (`highvol`, `forex`, `etf`, `etf_eu`, `stockbox`) : leur
  **equity/ordres autoritatifs viennent DÉJÀ du MCP dtx** (`systematic.dailytickers.com`, staging
  `data/dtx/<id>.json` via `dtx-mcp-ingest.js`). Le scanner JS local ne produit plus, pour ces 5, que
  le **marker de parité affiché** (le signal-pool JS-port). ⚠️ Nuance-clé pour le risque parité (§4).

> **dtx (systematic-tss) ≠ marketdata.** dtx = moteur de décision/backtest Go (déjà 100 % MCP).
> Cette migration porte sur le **chemin DATA** (univers + OHLCV + screening) actuellement Yahoo/local,
> à basculer vers `mcp__marketdata__*`. Les deux sont orthogonaux.

## 2. INVENTAIRE par scanner

| # | Scanner | (a) Source locale | (b) Fetch direct | (c) Mode/pool alimenté + status | (d) Parité Go | (e) Pipeline live ? |
|---|---------|-------------------|------------------|--------------------------------|---------------|---------------------|
| 1 | `momentum-scanner.js` | `americanbull-universe.json` (`tickers[]`) ; `--universe` → `eu`/`metals`/`forex`/`casablanca` | Yahoo `query1…/v8/chart` 2y 1d OHLCV | marker `momentum` → **composite `signals[]`** (turbo/dynamic/balanced/fortress/aplus **live**, tkl/alpha **stopped**) | port momentum (pas dans les 5 drift, mais port parité) | **OUI** (publish L110) |
| 2 | `etf-scanner.js` | `etf-us-universe.json` (~4000 US ETFs, ISO dump Go) **+** `etf-eu-universe.json` | Yahoo (US **et** EU passent par le pool US Yahoo) | **`etf` (live)** + **`etf_eu` (live)** ; **dtx-scripté** | **DRIFT connu (etf ET etf_eu)** | **OUI** (L114 US, L118 EU) |
| 3 | `highvol-scanner.js` | `americanbull-universe.json` + `data/ticker-metadata.json` (secteur/mcap) | Yahoo | **`highvol` (live)** ; **dtx-scripté** | port highvol | **OUI** (L89) |
| 4 | `fractal-scanner.js` | `americanbull`(défaut) + `crypto`/`metals`/`forex`/`casablanca` universes | Yahoo (`--source yahoo`) | défaut → fractal dans **composite `signals[]`** ; `--universe metals` → pool **metals** | port AdaptiveFractal | **OUI** (L85 americanbull, L93 metals) |
| 5 | `trendline-scanner.js` | `forex`/`americanbull`/`metals`/`etf` universes + **indices hardcodés** | Yahoo 1h/4h/1d | marker/pool **`trendline`** (filtre composite ; pas de clé config) | **DRIFT connu (trendline)** | **OUI** (L122 forex, L126 indices 4h) |
| 6 | `hybrid-scanner.js` | `americanbull-universe.json` | Yahoo | **`hybrid` (Hybrid-AF, live)** | port hybrid | **OUI** (L133) |
| 7 | `stockbox-scanner.js` | **`UNIVERSE` hardcodé** (Nasdaq) | Yahoo | **`stockbox` (live)** ; **dtx-scripté** | port stockbox | NON (shell) — equity via **dtx MCP staging** |
| 8 | `crypto-scanner.js` | `crypto-universe.json` | **Binance klines public** (pas de clé) | pool `crypto_pool` (**pas de clé config `crypto`**) | non-parité (data-only Go) | NON |
| 9 | `forex-scanner.js` | `forex-universe.json` (8 majors) | Yahoo chart daily | **`forex` (live)** ; **dtx-scripté** | port forex (ISO) | **OUI** (L100) |
| 10 | `metals-scanner.js` | `metals-universe.json` | Yahoo chart | pool **metals** (**pas de clé config `metals`**) — **superseded** par `fractal --universe metals` dans le shell | port metals | NON (fractal metals l'a remplacé) |
| 11 | `casablanca-scanner.js` | `casablanca-universe.json` | **BVC API directe** (`api.casablanca-bourse.com`) — **PAS Yahoo** | pool **casablanca** (**pas de clé config**) | **DRIFT connu (casablanca)** | NON (shell) |
| 12 | `candlestick-scanner.js` | `americanbull-universe.json` | Yahoo (défaut) **ou** `--source api` REST (`DT_API_KEY`) | **`bull`** (`_candlestickScan` → composite) | **DRIFT connu (bull)** | **OUI** (L81) |
| 13 | `factor-scanner.js` | `tkl-universe.json` | Yahoo 5y bars | **`factor` (test, sim-only)** → `factor_pool` | prix-only, **pas de parité Go** (nouveau, sim) | **OUI** (L140) |

Notes transverses :
- **`americanbull-universe.json`** est PARTAGÉ par 5 scanners (momentum, highvol, fractal, hybrid,
  candlestick) → **ne pourra être supprimé qu'après migration des 5** (§6).
- **`metals-universe.json`** partagé par `metals-scanner` (mort) et `fractal --universe metals` (vivant)
  et `momentum --universe metals` → ne supprimer qu'après migration de fractal-metals.
- **`forex-universe.json`** partagé par `forex-scanner`, `fractal --universe forex`,
  `trendline --universe forex`, `momentum --universe forex`.

## 3. MAPPING MCP + REFACTOR agent-staging par scanner

### 3.1 Appels MCP de remplacement (rappel des GOTCHES `scanner-pipeline`)

| Besoin local | Remplacement MCP | Gotcha |
|---|---|---|
| Énumération univers US + screening | `RunScreener` `region:"us"`, `asset:"stock"`/`"etf"`, `pass_expr`, `score_expr`, `top_k`, **`force_async:true`** → poller `Jobs` | 🔴 **JAMAIS `market_cap` dans `pass_expr`** (évalué à 0 → 0 candidat silencieux). Réduire l'univers via `vol > 1500000 and close > 10`. **Post-filtrer `market_cap >= 2e9` en code** + exclure ETF. Safety : si tous `< 5e8` → screener cassé → STOP. |
| OHLCV / quote / technicals per-ticker | `QueryData` (`types=quote,bars_daily,technicals`, + `sec_filings,flags` pour dilution) | Enrichir top ~30 seulement (coût). Bars US OK. |
| Secmaster / referential | `GetInstruments` / `GetReferentialData region=us` | `region=eu` **CASSÉ** (renvoie US). |
| Régime | `GetMarketContext(facets='regime')` | async, poller `Jobs`. |

### 3.2 Forme du staging (calquée sur `dtx-mcp-ingest.js` / `pead-scanner --ingest`)

Pour chaque scanner migré, deux voies possibles :

- **Voie B — étape AGENT (staging MCP)** — DÉFAUT pour tout ce qui a besoin de `RunScreener`/`QueryData`:
  1. l'AGENT appelle `RunScreener`(+`Jobs`) et `QueryData` → écrit le résultat brut dans un fichier
     (ex. `/tmp/<mode>-stage.json`);
  2. `node tools/<mode>-scanner.js --ingest /tmp/<mode>-stage.json --output signals --folder YYYYMMDD`
     PARSE le staging, applique la logique du scanner (score/parité), écrit le pool + `_scanRuns[<mode>]`
     dans `signals.json` (fusion non destructive, dedup par ticker), **jamais de fetch réseau**;
  3. `sweep.js` / `gen-status-page.js` lisent le pool committé.
  C'est exactement le contrat `pead-scanner.js` (`INGEST_PATH`, no-op silencieux si absent) et le
  contrat schéma-partagé de `dtx-mcp-ingest.js` (`buildStaging`/`writeStaging`, `engineMode:"mcp"`).

- **Voie A — fetch-direct SANS MCP (autorisé)** — pour les sources publiques hors périmètre marketdata:
  - `crypto-scanner.js` (**Binance public**, comme `gap-scanner` voie A) → **peut rester fetch-direct**,
    aucune migration MCP requise (le MCP n'apporte pas la donnée crypto klines).
  - `casablanca-scanner.js` (**BVC API**) → le MCP marketdata **n'a aucune couverture Casablanca** →
    reste fetch-direct BVC OU passe en voie-B seulement si/quand le MCP couvre la BVC (pas aujourd'hui).

### 3.3 Classement refactor

| Reste fetch-direct (pas de migration MCP) | DOIT devenir étape-agent (voie B, staging MCP) |
|---|---|
| `crypto-scanner.js` (Binance public) | `momentum`, `highvol`, `hybrid`, `candlestick`, `fractal`(US+metals), `trendline`, `stockbox`, `etf`(US), `forex`, `factor` |
| `casablanca-scanner.js` (BVC — MCP ne couvre pas) | `etf_eu` **BLOQUÉ EU** (voir §5) ; `momentum --universe eu` **BLOQUÉ EU** |

> `metals`/`forex`/`crypto` via `QueryData`/`RunScreener` : à valider — la couverture MCP des non-actions
> (FX majors, métaux, ETF thématiques) doit être confirmée par un `QueryData` de contrôle AVANT de migrer
> (sinon rester fetch-direct). Ne migrer que si le MCP renvoie des bars fraîches et complètes.

## 4. RISQUE PARITÉ + GATE (par mode)

Règles applicables (memory) : `feedback_config_change_backtest` (backtest 30j obligatoire, doit **battre**
l'actuel), `feedback_regime_aware_eval` (**par régime + walk-forward**, JAMAIS replay uniforme),
`feedback_segment_replay_absolute_dd` (n'utiliser que les **deltas relatifs A/B**), `feedback_immutable_trades`
(chaîne **SHA-256** des trades fermés intacte — `sweep.js` avorte sur violation).

**Gate obligatoire avant de basculer un mode (critères explicites) :**
1. `QueryData` de contrôle : bars MCP fraîches (< 48h) et complètes (≥ 200 barres) pour l'univers du mode.
2. **Backtest A/B** source locale (Yahoo) vs source MCP, **même modélisation, config complète des deux
   côtés**, **par régime** (risk-on / neutral / early-off / off) **+ walk-forward** — pas de replay uniforme.
3. Delta relatif A/B sur CAGR/maxDD/Sharpe/win-rate **dans la tolérance** (drift univers/mcap acceptable
   documenté) ; la source MCP **ne dégrade pas** les métriques régime-par-régime.
4. `qa-check.js` vert (marker `_scanRuns[<mode>]` présent post-migration) + chaîne SHA-256 intacte.
5. Un seul mode à la fois, **réversible** (revert = re-pointer sur le scanner Yahoo, univers legacy non
   supprimé).

**Risque parité par mode :**
- **FAIBLE** : `factor` (sim-only, `status=test`, **pas de parité Go**, prix-only, US couvert) — le POC idéal.
  `crypto` (fetch-direct conservé — hors migration).
- **MOYEN** : `momentum`, `highvol`, `hybrid`, `candlestick`(bull), `fractal`, `stockbox` — ports parité
  US, couverts par le MCP, mais alimentent des modes **live** ⇒ A/B obligatoire.
- **ÉLEVÉ** : `etf`, `etf_eu`, `trendline`, `casablanca`(bull) = **drift de parité DÉJÀ connu** (qa-check).
  Basculer la source data risque d'**amplifier** le drift ⇒ à traiter en dernier, A/B strict.
- **NUANCE dtx** : `highvol/forex/etf/etf_eu/stockbox` ont leur **equity/ordres autoritatifs via dtx MCP** ;
  migrer leur data locale ne change QUE le marker JS-port affiché, pas les chiffres du mode. Valeur de
  migration **plus faire**, mais utile pour cohérence « une seule source » + retrait Yahoo.

**Honnêteté :** `etf`/`etf_eu`/`trendline`/`casablanca` sont **trop couplés au drift de parité** pour
être migrés sans risque tant que le drift n'est pas d'abord réconcilié côté Go. Ne pas les migrer à la
légère.

## 5. ORDRE DE MIGRATION PHASÉ (gated, réversible, du plus sûr au plus risqué)

1. **`factor` — POC ✅ LIVRÉ (voie MCP `--ingest` active, local deprecated).** Pourquoi : `status=test` +
   **sim-only** (aucun capital, aucune parité Go à casser), univers US (`tkl-universe.json`) **entièrement
   couvert** par le MCP, facteurs prix-only (mapping direct `QueryData bars_daily` 5y). Un échec est sans
   conséquence de production. Le pattern **agent → `RunScreener`/`QueryData` → `--ingest` → `factor_pool`**
   est **implémenté et testé** (`tools/factor-scanner.js` : branche `ingestMain()`, fail-closed exit 3,
   fusion non destructive, `buildPool` partagé). **Reste** : gate A/B régime-aware (backtest local↔MCP)
   AVANT de retirer le legacy (§6) et avant de toucher un mode live. **Bonus dispo** : débloquer la
   « quality fondamentale » (TODO) en ajoutant les fondamentaux `QueryData` au staging.
2. **`stockbox`** — univers Nasdaq hardcodé (petit, US, couvert), déjà dtx-autoritatif (migrer la data ne
   déplace pas les chiffres du mode) ⇒ risque contenu.
3. **`highvol`** — US, dtx-autoritatif, americanbull couvert. A/B régime-aware.
4. **`momentum`** — cœur du composite ; migrer après highvol pour réutiliser le staging americanbull MCP.
5. **`candlestick`(bull)** — americanbull ; a déjà un `--source api` REST à convertir en voie-B propre.
   ⚠️ drift parité connu → A/B strict.
6. **`fractal`(americanbull)** puis **`fractal --universe metals`** (valider couverture métaux MCP d'abord).
7. **`hybrid`** — americanbull (réutilise staging), mode live.
8. **`forex`** — valider couverture FX MCP ; sinon rester Yahoo. dtx-autoritatif.
9. **`trendline`** — **drift connu** + indices/FX ⇒ tardif, A/B strict, valider couverture indices/FX MCP.
10. **`etf`(US)** — **drift connu**, gros univers (~4000) ⇒ tardif, A/B strict.

**BLOQUÉ (ne pas migrer avant backfill MCP EU confirmé) :**
- **`etf_eu`** (mode live) — dépend de la donnée EU. `RunScreener region=eu` = 0, bars EU ≈ 3.
  Reste sur `etf-eu-universe.json` + Yahoo jusqu'au backfill. **Migrer l'etf_eu vers le MCP CASSERAIT le mode.**
- **`momentum --universe eu`** (via `eu-universe.json`) — idem, EU non énumérable/sans historique.
- **Tout futur `eu_smallcap`/PEA** — reste en SPEC (`docs/specs/eu-smallcap-pea-scanner.md`).

**Conservés fetch-direct (hors migration, pas de suppression) :**
- **`crypto-scanner.js`** (Binance public, voie A).
- **`casablanca-scanner.js`** (BVC API — MCP ne couvre pas la place de Casablanca).

**Re-test de déblocage EU** : `RunScreener region=eu` renvoie des candidats **et** `QueryData bars_daily`
EU > 200 barres. Tant que ~3 barres / 0 candidat ⇒ EU reste BLOQUÉ (ne pas re-tenter).

## 6. RETRAIT LEGACY (APRÈS migration validée — dépendances croisées)

Aucune suppression avant que **tous** les consommateurs d'un artefact soient migrés + gate §4 passé.

| Artefact legacy | Supprimable seulement après migration de… |
|---|---|
| `americanbull-universe.json` | momentum **ET** highvol **ET** fractal(US) **ET** hybrid **ET** candlestick (les 5) |
| `metals-universe.json` | `fractal --universe metals` **ET** `momentum --universe metals` (+ retrait de `metals-scanner.js` mort) |
| `forex-universe.json` | `forex` **ET** `fractal --universe forex` **ET** `trendline --universe forex` **ET** `momentum --universe forex` |
| `etf-us-universe.json` | `etf`(US) |
| `etf-eu-universe.json` | `etf_eu` — **BLOQUÉ EU** (ne pas supprimer avant backfill + migration) |
| `eu-universe.json` | `momentum --universe eu` — **BLOQUÉ EU** |
| `tkl-universe.json` | `factor` (POC) — 1er candidat au retrait |
| `crypto-universe.json` | **NE PAS supprimer** (crypto reste fetch-direct Binance) |
| `casablanca-universe.json` | **NE PAS supprimer** (casablanca reste fetch-direct BVC) |
| Fetchers Yahoo (`fetchYahoo*` dans chaque scanner migré) | par-scanner, uniquement après bascule voie-B de CE scanner |
| `metals-scanner.js` (mort, non câblé) | retirer seulement après confirmation qu'aucune routine ne l'appelle (superseded par fractal metals) |

**Candidat de retrait #1 après POC :** `tkl-universe.json` + le fetcher Yahoo de `factor-scanner.js`,
une fois `factor` en voie-B validé.

---

## Résumé exécutif

- **13 scanners inventoriés** (momentum, etf, highvol, fractal, trendline, hybrid, stockbox, crypto,
  forex, metals, casablanca, candlestick, factor).
- **Premier mode POC : `factor` — ✅ LIVRÉ (2026-07-11).** Voie MCP `--ingest` active, voie locale Yahoo
  deprecated mais conservée en fallback. `status=test`, **sim-only** (aucune parité Go à casser), univers
  US couvert par le MCP, facteurs prix-only ⇒ valide le pattern agent-staging. Gate A/B régime-aware +
  retrait legacy = chantier séparé restant.
- **Restent fetch-direct (hors migration)** : `crypto` (Binance public), `casablanca` (BVC — non couvert MCP).
- **Modes BLOQUÉS (EU, jusqu'au backfill MCP)** : **`etf_eu`** et **`momentum --universe eu`** (+ tout
  `eu_smallcap`/PEA futur). Cause : `RunScreener region=eu`=0, bars EU ≈ 3 séances (`mcp-eu-coverage-gap`).
- **Plus risqués (drift parité connu, à faire en dernier, A/B strict)** : `etf`, `etf_eu`, `trendline`,
  `casablanca`(bull).
- **Gate par mode** : QueryData de contrôle → backtest A/B **par régime + walk-forward** (jamais replay
  uniforme, deltas relatifs only) → qa-check vert + chaîne SHA-256 intacte → un mode à la fois, réversible.
- **Fichier écrit** : `docs/specs/migration-local-to-mcp.md`.
