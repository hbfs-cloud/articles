# SPEC — Scanner EU small-cap PEA-éligible (mode `eu_smallcap`)

> **Statut** : **DRAFT (masqué)** — infra complète et câblée, mais le **deep backtest EU ne bat pas la
> baseline**. Reste draft jusqu'à une stratégie EU viable. Détail : **§9 Journal de décision**.

> **Statut technique** : implémenté, prêt à implémenter.
> **Auteur** : DailyTickers / scanner-pipeline.
> **Livrable** : **perf simulée + signaux** (sortie type `scanner/status`). **AUCUNE exécution réelle,
> aucun concept paper/live broker.** Tout est embarquable dans la cmd `/scanner` + la page `scanner/status`.
> **Profil cible** : retail EU peu capitalisé, multi-broker, agile, DevOps.
> **Edges exploités** : *capacity* (small-caps que l'institutionnel ne peut pas jouer à l'échelle),
> *fiscal* (enveloppe PEA / PEA-PME), *API/automatisation* (scan nocturne scriptable), *event-driven*.

---

## 0. Borne de scope (impérative)

On construit **vers** le systematic (parité `systematic-tss`, sweep append-only, dashboard `scanner/status`)
mais on **s'arrête à la simulation + signaux** :

| Autorisé (in scope) | Interdit (out of scope) |
|---|---|
| Univers PEA-éligible, DSL screener, scoring momentum | Ordre broker paper OU live (Alpaca/IBKR/T212/Saxo/…) |
| Backtest / replay / sweep → **perf simulée** | `sim_*`, `rb_paper_*`, `rb_live_*`, `run-session`, `gen-trading-plan` |
| Pool de signaux dans `signals.json` | Toute persistance de position réelle |
| Affichage mode dans `scanner/status` | Toute notion de compte, cash réel, exécution |

Le mode se comporte exactement comme les modes **scriptés/JS-backed** déjà en place
(`momentum`, `casablanca`, `etf_eu`) : il produit un pool de signaux + une équité simulée via `sweep.js`.
Le pipeline `trading-executor/run-session.js` **ne doit jamais** être câblé à ce mode.

---

## 1. Problème / Contexte

### 1.1 Le trou actuel

`RunScreener region='eu'` renvoie **0 candidat** de façon silencieuse, avec en cause
`insufficient history <200 bars before as_of`. Deux racines cumulées :

1. **Gate 200-barres du screener EU.** Beaucoup de small-caps EU ont un historique Yahoo/secmaster
   clairsemé ou récent ; le screener exige ≥ 200 barres **avant `as_of`**. Si `as_of` tombe sur un
   jour où le cache EU n'a pas 200 barres alignées, la query renvoie 0 — comme le bug
   `market_cap`-dans-`pass_expr` (scan stub 20260701), l'échec est **silencieux** (0 résultat, pas
   d'erreur).
2. **Univers screener EU non fait pour le small-cap.** La query 5 EU actuelle du pipeline
   (`.claude/skills/scanner-pipeline.md`, Phase 1) vise la **diversification géo large-cap**
   (`vol > 500000`, post-filtre `market_cap >= 1e9`) — elle n'est pas calibrée pour le small/mid-cap.

**Constat clé (dtx).** `DtxListConfigs()` ne contient **AUCUN** portefeuille EU small-cap PEA :
seulement `eu_dax` (large-cap, EUR), `eu_uk` (mid-cap **UK / GBP → NON PEA-éligible post-Brexit**),
`etf_eu` (ETF). ⇒ **le moteur systematic n'a pas de sleeve small-cap PEA.** Ce mode est donc
**JS-scanner-backed** (comme `momentum`/`casablanca`), **pas** dtx-backed. Un futur
`portfolio_eu_smallcap.yaml` côté Go serait le endgame "vrai systematic" mais est **hors de ce repo**
et hors scope immédiat (§7.3).

### 1.2 Le fix (résumé — détaillé au §3)

- **Source primaire = scanner JS** (`momentum-scanner.js`) qui **fetch Yahoo en direct** avec son propre
  `MIN_BARS`, **contournant** la gate 200-barres du screener. L'univers vient d'un **dump gelé**
  PEA-filtré (`data/eu-smallcap-universe.json`), pas de `RunScreener`.
- **`RunScreener region='eu'` = source SECONDAIRE / enrichissement** : corriger `as_of` (dernier jour
  de bourse avec historique), **JAMAIS de `market_cap` dans `pass_expr`** (post-filtre en code), et
  **fallback movers** (`GetMarketContext(facets='overview')`) si la query renvoie < seuil.
- **MCP hard stop** : si les données EU sont stale/incohérentes → STOP, ne rien fabriquer (§6).

---

## 2. Objectif & critères d'edge

Le mode existe pour exploiter **quatre asymétries** qu'un retail EU peu capitalisé peut monétiser mais
pas un fonds :

| Edge | Mécanisme | Traduction concrète dans la spec |
|---|---|---|
| **Capacity** | Un small-cap €300M–€3Bn ne peut pas absorber un ticket institutionnel sans bouger le prix. Le retail entre/sort sans impact. | Univers borné `€200M ≤ mcap ≤ ~€5Bn` (§3.3) + gate liquidité **modeste** (ADV €300k–€1M, pas $10M comme le scanner US). |
| **Fiscal** | PEA/PEA-PME : plus-values **exonérées d'IR après 5 ans** (seuls prélèvements sociaux). Un fonds ne bénéficie pas de l'enveloppe ; le retail FR oui. | Univers **strictement PEA-éligible** (§4), fail-closed. La perf simulée s'affiche **brute** (le gain fiscal est un edge structurel du support, pas une donnée à fabriquer). |
| **API / automatisation** | Le retail DevOps scripte un scan nocturne + digest ; l'edge de vitesse/discipline est accessible. | Le mode s'intègre au pipeline `/scanner` existant, zéro action manuelle (§5). |
| **Event-driven** | Small-caps EU réagissent fort aux catalyseurs (résultats, inclusion indice, contrats). | Réutilisation des gates earnings/événement du pipeline (`GetEarningsCalendarFiltered`, `days_until_earnings()`), tag `event` (§3.4). |

**Livrable = perf simulée + signaux.** Pas d'exécution.

---

## 3. Design

### 3.1 Données MCP requises (namespace `mcp__claude_ai_marketdata__*`)

| Outil | Usage dans ce mode | Notes |
|---|---|---|
| `RunScreener` | Source **secondaire** EU momentum (enrichissement / cross-check) | `region='eu'`, `pass_expr` **sans** `market_cap`, `force_async=true` |
| `GetMarketContext(facets='overview')` | **Fallback movers** EU si screener renvoie < seuil + trending/sectors | canonique (ex-GetMarketOverview), async → poller via `Jobs` |
| `GetMarketContext(facets='regime')` | Régime pour gating (mêmes seuils que le pipeline) | `model='ensemble', horizon_days=5` |
| `QueryData` | Enrichissement per-ticker : `quote`, `technicals`, `sec_filings`, `flags`, `insider_transactions` | dilution + earnings + entry spot |
| `GetEarningsCalendarFiltered` | Gate earnings ±3j (règle pipeline) | `days_ahead=7` |
| `PortfolioRisk(action='correlation'\|'sizing')` | Corrélation intra-pool + sizing vol-target (simulé) | `symbols` en CSV |
| `GetInstruments` / `GetReferentialData` | **Vérif éligibilité PEA** : `country`, `exchange`, `sector` par ticker | voir §4 (verifiable vs à sourcer) |

> ⛔ **Un subprocess `node` ne peut PAS appeler le MCP** (OAuth2, ZÉRO token). Comme pour dtx, toute
> collecte MCP est une **étape AGENT** exécutée AVANT le pipeline shell. Le scanner JS lit ensuite les
> caches/univers gelés produits par l'agent. Ne jamais tenter d'appeler le MCP depuis un `.js` lancé en
> subprocess.

### 3.2 Logique DSL — `RunScreener` (source secondaire EU momentum small/mid-cap)

🔴 **Règle absolue (root cause du scan stub 20260701) : JAMAIS `market_cap` dans `pass_expr`.**
Le DSL évalue `market_cap` à **0** → toute comparaison `market_cap > X` est `false` pour TOUS → 0
candidat silencieux. La mcap est **post-filtrée en code** sur les candidats retournés (chacun porte
`market_cap`).

**Query EU small/mid-cap momentum** (à ajouter au pipeline, §5.2) :

```
pass_expr:  "rsi14 > 50 and rsi14 < 72 and ema20 > ema50 and macd > 0 and vol > 100000 and close > 3"
score_expr: "rsi14 + (macd > 0 ? 12 : 0) + obvz * 8"
region:     "eu"
top_k:      50
asset:      "stock"          # NE PAS mettre asset_type dans pass_expr
force_async: true            # → poller via Jobs
```

Post-traitement **en code** (ordre strict) :
1. **Correction as_of / gate 200-barres** : passer `as_of` = **dernier jour de bourse EU** (pas
   `today` par défaut). Si la query renvoie 0 avec `insufficient history` → NE PAS committer un pool
   vide ; passer au **fallback movers** (§3.5) et logger l'alerte.
2. **Post-filtre mcap small/mid** : `2e8 ≤ market_cap ≤ 5e9` (EUR-équivalent). Rejeter tout candidat
   hors bande. (Le seuil bas €200M évite les nano/penny ; le plafond €5Bn borne l'edge capacity.)
3. **Post-filtre liquidité modeste** : `avg_volume * close ≥ 300_000` (€/jour). **Ne PAS** appliquer le
   plancher US de $10M (tuerait l'univers small-cap — c'est justement l'edge capacity).
4. **Filtre PEA-éligibilité (fail-closed)** : §4. Tout ticker dont l'éligibilité n'est pas
   **positivement** confirmée est **exclu**.
5. **Exclure ETF** (`market_cap == 0` ou présent dans `etf-eu-universe.json`) — ce mode = actions vives.

**Gotchas DSL confirmés** (source `GetDSLDescription`, cf `scanner-pipeline.md`) :
`sma('close',50)` quotes obligatoires ; `perf_rel(...)` **plante dans `score_expr`** (pass_expr only) ;
booléens (`macd>0`) OK en score_expr via ternaire ; `asset_type=='etf'` interdit en pass_expr (param
`asset`).

**Smoke-test obligatoire** : après post-filtre, si **< 8 candidats** → DSL mal calibré OU univers EU
cassé → ALERTER, ne pas committer un pool mono-ticker sans le signaler.

### 3.3 Logique scanner JS (source PRIMAIRE) — réutiliser `momentum-scanner.js`

`tools/momentum-scanner.js` supporte déjà `--universe eu` (lit `data/eu-universe.json`, ligne ~68 de la
map `UNIVERSE_FILES`) et **tag chaque signal** `universe: <UNIVERSE_NAME>` + `region` (ligne ~296). Il
**fetch Yahoo en direct** avec son propre `MIN_BARS` → **contourne la gate 200-barres** du screener.
C'est la source de vérité des signaux.

**À faire (minimal) :** ajouter une entrée d'univers dédiée **PEA-filtrée** :

```js
// tools/momentum-scanner.js — map UNIVERSE_FILES (~L64-68)
const UNIVERSE_FILES = {
  americanbull: 'americanbull-universe.json',
  metals:       'metals-universe.json',
  forex:        'forex-universe.json',
  casablanca:   'casablanca-universe.json',
  eu:           'eu-universe.json',
  'eu-smallcap':'eu-smallcap-universe.json',   // ← NEW (dump PEA-filtré, §4.3)
};
```

Invocation pipeline :
```bash
node tools/momentum-scanner.js --universe eu-smallcap --universe-tag eu_smallcap \
  --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 5 --top 20
```

Le scanner écrit dans `signals.json` un pool tagué `universe:'eu_smallcap'`, `region:'EU'`. Le scoring
momentum (RSI stack, MACD, OBV z-score, dist MA) est **réutilisé tel quel** — pas de nouvelle stratégie
à écrire côté JS ; l'edge vient de **l'univers** (small-cap PEA) + **du support fiscal**, pas d'un signal
exotique.

> ⚠️ Si l'on préfère un scanner dédié (`tools/eu-smallcap-scanner.js`), il DOIT porter la **même** shape
> de sortie (`ticker, score, strategy, entry, stop, tp1, tp2, rr, thesis, sharia, region, universe`) que
> les autres pools (cf `scanner-parser.js:loadSignals`). Recommandation : **réutiliser
> `momentum-scanner.js`** (moins de surface, parité momentum déjà validée) plutôt qu'un nouveau tool.

### 3.4 Schéma d'un signal (shape `signals.json`)

Chaque signal du pool `eu_smallcap_pool[]` a la shape canonique des pools (parité
`scanner-parser.js`) :

```json
{
  "ticker": "ALO.PA",
  "score": 87,
  "strategy": "MomentumRotation",
  "entry": 18.42, "stop": 17.10, "tp1": 21.05, "tp2": 23.60, "rr": 2.0,
  "thesis": "Momentum reclaim MM50, small-cap indus EU, catalyseur résultats S1",
  "sharia": true,
  "region": "EU",
  "universe": "eu_smallcap",
  "peaEligible": true,          // ← NEW, obligatoire (§4)
  "peaPmeEligible": true,       // ← NEW, sous-catégorie (bonus fiscal small-cap)
  "peaProof": "euronext-pea-list-2026Q2",   // ← NEW, provenance de l'éligibilité (jamais fabriquée)
  "horizon": 21,
  "maxHoldDays": 21
}
```

`peaEligible`/`peaPmeEligible`/`peaProof` sont **nouveaux champs**. Un signal sans `peaEligible:true`
**prouvé** ne doit jamais entrer dans le pool (§4, fail-closed).

### 3.5 Fallback movers (anti-pool-vide)

Si `RunScreener region='eu'` **et** le scanner JS renvoient tous deux < 8 candidats (univers cassé,
Yahoo EU down, gate 200-barres) :
1. `GetMarketContext(facets='overview')` → `trending`/`movers` EU.
2. Croiser avec `eu-smallcap-universe.json` (garder uniquement les tickers PEA-éligibles connus).
3. Enrichir via `QueryData` (technicals) pour reconstruire entry/stop/tp.
4. **Tag `event`** + note "fallback movers" dans le pool + **alerte Telegram** (`to='alerts'`).
5. **Jamais fabriquer** un ticker/prix pour combler (MCP hard stop §6).

---

## 4. Règles d'éligibilité PEA (cœur de l'edge fiscal)

### 4.1 Rappel réglementaire (à encoder, pas à réinterpréter à chaque run)

**PEA** — éligible = **action d'une société dont le siège social est dans l'UE ou l'EEE**
(EEE = UE + Islande + Norvège + Liechtenstein). Conséquences dures :

- ⛔ **Royaume-Uni exclu** (post-Brexit, hors UE/EEE) → tout ticker `.L` **rejeté**. *(Le config dtx
  `eu_uk` n'est PAS PEA-éligible — ne jamais le confondre avec ce mode.)*
- ⛔ **Suisse exclue** (hors EEE) → tickers `.SW` **rejetés**.
- ⛔ **Émetteur US coté en Europe exclu** : `1NVDA.MI`, `NVD.DE`, `1GOOG.MI`, `1AAPL.MI`… sont des
  **actions US** cotées sur une place EU → **le siège social est US → NON PEA-éligible** malgré la place
  de cotation EU. **Piège n°1** de `eu-universe.json` (qui contient massivement ces lignes).
- ⛔ **Foncières / SIIC (secteur Real Estate)** exclues du PEA → rejeter `sector == 'Real Estate'`.

**PEA-PME** — sur-ensemble fiscal pour les **PME/ETI** : société < 5000 salariés **et** (CA ≤ €1,5Md
**ou** total bilan ≤ €2Md). C'est **exactement la cible capacity** → un small/mid-cap éligible PEA-PME
porte le **double edge** (capacity + niche fiscale PME). Tagué `peaPmeEligible:true` (bonus, non bloquant).

### 4.2 Vérifiable vs à sourcer (honnêteté des données)

| Critère | Vérifiable avec données dispo ? | Source |
|---|---|---|
| Place de cotation (venue) | ✅ Oui | suffixe Yahoo (`.PA/.AS/.DE/.MI/.MC/.BR/.LS/.HE/.ST/.CO/.OL/.IR/.VI/.WA…`) + `exchange` (`GetInstruments`) |
| Exclusion UK / CH | ✅ Oui | rejet suffixe `.L` (UK), `.SW` (CH) |
| Secteur (exclusion foncières) | ✅ Oui | `sector` (`GetReferentialData` / `ticker-metadata.json`) |
| Market cap (borne capacity) | ✅ Oui | `market_cap` post-filtre |
| **Siège social (UE/EEE)** — critère discriminant | ⚠️ **Partiel** | `country` du screener/`GetInstruments` reflète souvent la **place de cotation**, PAS le siège juridique → **faux positifs** (émetteur US coté à Milan) |
| **Seuils PEA-PME** (salariés, CA, bilan) | ❌ **Non fiable** via market data | à sourcer (listes émetteur / Euronext) |
| **Statut PEA/PEA-PME officiel** | ❌ Non déductible du prix | à sourcer |

**Décision de design** : le siège social et le statut PEA officiel **ne se déduisent pas du market
data** de façon fiable. On maintient un **référentiel d'éligibilité versionné**
(`data/pea-eligibility.json`, §4.3), **seedé depuis des sources d'autorité** (listes PEA/PEA-Pime
Euronext, référentiel émetteur), puis **confirmé** par les filtres vérifiables (venue/secteur/mcap).

### 4.3 Référentiel `data/pea-eligibility.json` (NEW) + générateur

```jsonc
{
  "updated": "2026-07-11",
  "source": "Euronext PEA/PEA-PME eligible lists + issuer HQ registry (sourced, NOT derived from prices)",
  "method": "seed from authority lists → cross-check venue/sector/mcap (verifiable) → fail-closed",
  "tickers": {
    "ALO.PA": { "peaEligible": true,  "peaPmeEligible": true,  "hqCountry": "FR", "proof": "euronext-pea-pme-2026Q2" },
    "NVD.DE": { "peaEligible": false, "reason": "US issuer listed in DE (siège US)" },
    "1NVDA.MI": { "peaEligible": false, "reason": "US issuer listed in MI" }
    // …
  }
}
```

- **Générateur** : `tools/gen-eu-smallcap-universe.js` (NEW) — part de `data/eu-universe.json`, applique :
  1. **rejet venue** UK(`.L`)/CH(`.SW`) ;
  2. **rejet émetteur non-EU/EEE** via `pea-eligibility.json` (fail-closed : absent ⇒ exclu) ;
  3. **rejet secteur** Real Estate ;
  4. **borne mcap** `[2e8, 5e9]` ;
  5. **gate liquidité** ADV ≥ €300k ;
  → écrit `data/eu-smallcap-universe.json` (`{updated, source, method, count, tickers[]}` — même forme
  que les autres univers, lisible par `momentum-scanner.js`).
- **Provenance obligatoire** : chaque `peaEligible:true` porte un `proof` (liste-source datée). **Jamais
  d'éligibilité fabriquée** — un ticker sans preuve = **exclu** (fail-closed), à l'inverse du filtre
  secteur/mcap US qui est *fail-open* (`passesSectorMcap` retourne `true` si metadata absente). Ici une
  fausse affirmation PEA est une **erreur fiscale/compliance**, donc défaut = exclusion.

### 4.4 Encodage dans `scanner-filters.json`

Ajouter un bloc `pea` (hard rules, vérifiées pre-publish par `validate-scan.js`) :

```jsonc
"pea": {
  "_comment": "Éligibilité PEA/PEA-PME — fail-closed. Un signal eu_smallcap sans peaEligible:true prouvé = REJECT.",
  "excluded_venues": [".L", ".SW"],
  "excluded_sectors": ["Real Estate"],
  "eea_countries": ["FR","DE","NL","IT","ES","BE","PT","IE","AT","FI","LU","GR","PL","CZ","DK","SE","NO","IS","LI","HU","RO","SK","SI","HR","EE","LV","LT","BG","MT","CY"],
  "smallcap_mcap_min_eur": 200000000,
  "smallcap_mcap_max_eur": 5000000000,
  "min_adv_eur": 300000,
  "require_proof": true,
  "_reason": "PEA = siège UE/EEE. UK/CH exclus. US-shares-listed-in-EU exclus (siège US). Foncières exclues."
}
```

---

## 5. Intégration

### 5.1 Nouveau mode dans `data/modes-config.json`

Ajouter la clé `eu_smallcap` sous `modes` (calquée sur `etf_eu`, adaptée equities/PEA). **Ne jamais
éditer le JSON à la main pour les stats** — seul `sweep.js`/pipeline écrit les résultats ; on ajoute ici
la **config statique** du mode. Status initial **`draft`** (validation Phase D/backtest requise avant
`test`/`live`) :

```jsonc
"eu_smallcap": {
  "status": "draft",
  "statusSince": "2026-07-11T00:00:00Z",
  "statusReason": "Nouveau mode EU small-cap PEA — draft, walk-forward requis avant test.",
  "label": "EU Small-Cap PEA",
  "color": "#7cc6a6",
  "goal": "EU small/mid-cap momentum, PEA/PEA-PME eligible (capacity + fiscal edge)",
  "riskProfile": "High",
  "assetClass": "equity_eu",
  "universe": "data/eu-smallcap-universe.json",
  "universeFilter": "eu_smallcap",
  "portfolioSize": 5,
  "topN": 5,
  "minScore": 80,
  "filterName": "eu_smallcap_momentum",
  "rotation": "none",
  "horizon": 21,
  "partialTP": true, "partialTPPct": 0.3, "partialTPGain": 12, "disableTP2": true,
  "trailingStop": true, "trailMultR": 2, "trailGraceDays": 3,
  "earlyExitLossPct": 6, "earlyExitDays": 5,
  "maxStopPct": 8, "atrStopMult": 1.8,
  "breakevenPct": 0, "staleDays": 0,
  "vwapGate": true, "ddBreakerPct": 8,
  "sectorCapMax": 2, "sizingMethod": "inverse_atr", "targetRiskPct": 1,
  "vixKillThreshold": 0, "correlationCap": 0.65, "crossModeDedup": false,
  "circuitBreakerStops": 4, "circuitBreakerWindow": 5, "circuitBreakerPause": 3,
  "regimeFilters": {
    "risk_on": "eu_smallcap_momentum", "early_risk_off": "eu_smallcap_momentum",
    "risk_off": "eu_smallcap_momentum", "neutral": "eu_smallcap_momentum",
    "recovery": "eu_smallcap_momentum"
  },
  "tklPoolEnabled": false
}
```

- **Devise** : le mode est EUR par nature. La devise dashboard est dérivée de `assetClass` dans
  `gen-status-page.js:curOf()` (~L927) — actuellement `casablanca→MAD`, sinon `USD`. **À étendre** :
  `curOf()` doit retourner `EUR` pour `assetClass === 'equity_eu'` (et idéalement `etf`/`etf_eu` déjà
  EUR — vérifier). *(Fichier à toucher : `tools/gen-status-page.js`.)*
- Ne **PAS** ajouter `eu_smallcap` au `DTX_STAGING_MAP` (gen-status-page ~L144) : mode **JS-backed**, pas
  dtx. Il tire ses stats du **sweep**, comme `momentum`/`casablanca`.

### 5.2 Câblage `/scanner` (skill `scanner-pipeline.md`)

- **Phase 1** — ajouter la **query EU small-cap momentum** (§3.2) à la liste RunScreener (source
  secondaire), avec le smoke-test < 8 candidats.
- **Pipeline quotidien** (section "Pipeline Quotidien (Append-only)") — ajouter la ligne scanner JS
  **après** `momentum-scanner` US, **avant** `sweep.js` :
  ```bash
  node tools/momentum-scanner.js --universe eu-smallcap --universe-tag eu_smallcap \
    --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-score 5 --top 20
  ```
- **Étape AGENT préalable** (comme dtx) : régénérer l'univers si stale —
  `node tools/gen-eu-smallcap-universe.js` (après refresh `pea-eligibility.json` sourcé par l'agent).
  Jamais bloquant : si l'univers est stale, warn + garder le dump committé (pas de fabrication).

### 5.3 Pool dans `signals.json`

- Nouvelle clé `eu_smallcap_pool[]` dans `scanner/YYYYMMDD/signals.json` (à côté de
  `momentum/breakout/pullback/pre_squeeze/crypto_pool/metals_pool/forex_pool/casablanca_pool`).
- **`tools/lib/scanner-parser.js`** (`loadSignals`, ~L137 `poolFrom`) — ajouter :
  ```js
  const euSmallcapPool = poolFrom('eu_smallcap_pool'); // source='eu_smallcap_pool'
  ```
  et le concaténer au retour (comme `casablancaPool`). Le tag `universe:'eu_smallcap'` (déjà écrit par le
  scanner) est **préservé** (`universe: s.universe || null`, ~L105).

### 5.4 Affichage `scanner/status` (`gen-status-page.js`)

Le mode doit apparaître comme panneau dédié, groupé avec les classes EU. Points de câblage
(fichier `tools/gen-status-page.js`) :

- **`signalsFor(cfg)` (~L944-955)** — la sélection asset-mode filtre `source === assetClass+'_pool'`
  **et** `universe === universeFilter`. Pour `eu_smallcap` : `assetClass='equity_eu'` → attend
  `source === 'equity_eu_pool'`. **Deux options** :
  - **(A) recommandée** : traiter `eu_smallcap` comme **mode universe-gated scripté** (comme
    `highvol`/`etf`), c.-à-d. gate **uniquement** sur `universe === 'eu_smallcap'` + `strategy` filter,
    **pas** sur `source == assetClass+'_pool'`. Ajouter `eu_smallcap` à la liste des `SCRIPTED_IDS`
    (~L1126) et **exclure** `equity_eu` de la logique `isAssetMode` (garder le pool-source gate réservé
    à crypto/metals/forex/casablanca).
  - (B) alternative : renommer le pool `equity_eu_pool` pour matcher `assetClass+'_pool'`. Moins
    lisible ; préférer (A).
- **`curOf(cfg)` (~L927)** — retourner `EUR` pour `assetClass==='equity_eu'` (§5.1).
- **Fallback candidates (~L1131)** : `_uf = cfg.universeFilter='eu_smallcap'` filtre déjà correctement
  les fallback si le mode n'est pas dans `SCRIPTED_IDS`. Choisir la cohérence avec l'option (A).
- **Groupement visuel** : afficher `eu_smallcap` dans le cluster "Europe / PEA" du dashboard (à côté de
  `etf_eu`), avec un **badge PEA/PEA-PME** sur les signaux (`peaEligible`/`peaPmeEligible`). Aucun texte
  interne/technique dans l'UI publiée (pas de "MCP", "sweep", "dtx" — décrire "momentum EU éligible PEA").

### 5.5 Sweep pour la perf simulée (`tools/sweep.js`)

`sweep.js` produit l'équité simulée append-only par mode (source de vérité des stats affichées). Points
de câblage :

- **`buildSetups` (~L199-241)** — le pool `eu_smallcap_pool` est déjà chargé via `scanner-parser`
  (§5.3) ; il propage `source:'eu_smallcap_pool'` + `universe:'eu_smallcap'` (~L241). Rien à changer si le
  pool suit la shape.
- **Registre asset-pool (~L281 `ALL_ASSET_POOL_SOURCES` / `excludeSources`)** — **NE PAS** ajouter
  `eu_smallcap_pool` à la liste des sources **exclues des portefeuilles equity** si l'on veut que le
  mode `eu_smallcap` (universe-gated) le consomme. La restriction per-mode se fait via
  `universeFilter` dans `simulatePortfolio` (~L1590 :
  `.filter(t => !config.universeFilter || (t.universe||'')===config.universeFilter)`). **Vérifier** :
  le pool doit passer le gate `universeFilter='eu_smallcap'` (tag universe OK) **et** ne pas être
  aspiré par les modes equity US génériques → si nécessaire, ajouter `eu_smallcap_pool` au registre
  d'exclusion des **autres** modes (belt-and-suspenders, comme casablanca ~L440-460) tout en
  l'autorisant pour `eu_smallcap`.
- **Immutabilité** : `sweep.js` avorte sur violation de la chaîne SHA-256 (`trade-chain.json`) — le
  nouveau mode **append-only** ne réécrit jamais de trades fermés (§6).
- **Devise** : les trades EUR ne doivent pas être mélangés aux stats USD agrégées ; la perf du mode est
  affichée dans sa propre devise (dérivée `assetClass`, §5.1).

### 5.6 API publique (`tools/gen-api.js`)

- Ajouter un endpoint per-mode `portfolio/v1/eu_smallcap.json` (mêmes champs que les autres modes :
  equity, stats, signals, `status` block). Le mode `draft`/`test` **doit** être respecté par `gen-api`
  (bloc status, pas de signaux "live") — cf machine d'états.
- **Aucun** endpoint d'exécution / trading-plan (out of scope §0).

---

## 6. Gates de sûreté

| Gate | Règle | Outil / fichier |
|---|---|---|
| **MCP hard stop** | Si MCP EU bloque OU données stale >48h / prix aberrants → **STOP**, ne rien fabriquer, alerte, tâche suspendue. Reprise après QueryData de contrôle frais. | CLAUDE.md §MCP HARD STOP |
| **No hallucination** | Jamais inventer mcap, siège social, éligibilité PEA, catalyseur. Univers/éligibilité **sourcés**. | `feedback_no_hallucination` |
| **PEA fail-closed** | Éligibilité non **prouvée** ⇒ ticker exclu (inverse du fail-open sector/mcap). | `pea-eligibility.json` + `validate-scan.js` |
| **Backtest walk-forward** | Avant `draft→test`, replay **walk-forward regime-aware** (jamais replay uniforme full-période) + battre un benchmark small-cap EU (proxy CAC Small / MSCI EMU Small). | `feedback_regime_aware_eval`, `feedback_config_change_backtest` |
| **Sanity replay** | DD/return absolu d'un segment = **non fiable** → n'utiliser que deltas relatifs A/B ; stats absolues = frozen sweep append-only. | `feedback_segment_replay_absolute_dd` |
| **Immutable trades** | Jamais modifier trades fermés ; chaîne SHA-256, `sweep.js` avorte. | `feedback_immutable_trades` |
| **Liquidité small-cap** | ADV plancher €300k **mais** flag si `entry_size / ADV` implique impact ; noter le risque de sortie (l'edge capacity a un coût de liquidité réel — pas de faux caveats, mais pas de déni). | `scanner-filters.json.pea` |
| **Dilution** | `QueryData types=sec_filings,flags` par candidat (S-3/ATM/warrants). Small-caps EU = risque dilution élevé. | pipeline Phase 2 |
| **Earnings window** | earnings ±3j bourse → REJECT ou tag "earnings play". | `GetEarningsCalendarFiltered` |
| **QA structurel** | `validate-scan.js` asserte le bloc `pea` (venue/secteur/mcap/proof) contre `signals.json` avant publish ; `qa-content.js --strict` si article éditorial. | `tools/validate-scan.js`, `tools/qa-content.js` |
| **Smoke-test pool** | < 8 candidats après filtres → alerter, ne pas committer un pool mono-ticker silencieux. | §3.2 |
| **No skip** | Aucune étape (univers, dilution, earnings, PEA, validation) skippée sans accord explicite. | `feedback_no_skip` |
| **No broker** | Aucun appel `sim_*`/`rb_paper_*`/`rb_live_*`/`run-session` sur ce mode. | §0 |

---

## 7. Critère de "fait" (Definition of Done)

### 7.1 Implémentation minimale (mode simulé + signaux visibles)

- [ ] `data/pea-eligibility.json` créé, **sourcé** (proof daté), fail-closed.
- [ ] `tools/gen-eu-smallcap-universe.js` créé → produit `data/eu-smallcap-universe.json` (venue/HQ/
      secteur/mcap/ADV filtrés, count > 0).
- [ ] `tools/momentum-scanner.js` : entrée univers `eu-smallcap` ajoutée ; scan produit un pool tagué
      `universe:'eu_smallcap'`, `region:'EU'` avec `peaEligible/peaPmeEligible/peaProof`.
- [ ] `tools/lib/scanner-parser.js` : `eu_smallcap_pool` parsé (source préservée).
- [ ] `data/modes-config.json` : mode `eu_smallcap` en `status:'draft'`.
- [ ] `data/scanner-filters.json` : bloc `pea` encodé ; `validate-scan.js` l'asserte.
- [ ] `tools/sweep.js` : le pool alimente **uniquement** `eu_smallcap` via `universeFilter` (vérif :
      n'apparaît dans aucun mode equity US).
- [ ] `tools/gen-status-page.js` : panneau EU Small-Cap PEA rendu, devise EUR, badges PEA, groupé
      "Europe/PEA" ; **aucun terme interne** dans l'UI.
- [ ] `tools/gen-api.js` : endpoint `portfolio/v1/eu_smallcap.json` (bloc status respecté).
- [ ] `.claude/skills/scanner-pipeline.md` : query EU small-cap + ligne pipeline + étape agent univers
      documentées.

### 7.2 Validation avant `draft → test`

- [ ] Backtest **walk-forward regime-aware** ≥ 12 mois : le mode **bat** un benchmark small-cap EU sur
      la période, DD acceptable (cible ≤ 12% pour un profil High small-cap).
- [ ] Sweep append-only tourne 5 sessions sans violation SHA-256, pool non vide ≥ 3 jours/5.
- [ ] Smoke-test : ≥ 8 candidats PEA-éligibles en régime normal ; fallback movers testé (pool jamais
      vide sans alerte).
- [ ] **Zéro** ticker `.L`/`.SW`/US-share-EU-listed/foncière dans le pool (audit sur 5 scans).
- [ ] `validate-scan.js` + `qa-content.js --strict` passent (exit 0).
- [ ] Revue `senior-review` (harness QA/Quant/Trader/Risk/Editor) = PASS/FIXED (pas BLOCK).

### 7.3 Endgame explicitement HORS scope (à documenter, pas à faire)

- [ ] *(futur)* `portfolio_eu_smallcap.yaml` côté `systematic-tss` (Go) → sleeve dtx `eu_smallcap`
      (`selective-momentum`, EUR, univers PEA), câblé via `DTX_STAGING_MAP`. **Nécessite le repo Go**
      (hors `articles`) — donc **hors de cette spec**. Tant qu'il n'existe pas, le mode reste JS-backed.
- [ ] *(explicitement jamais dans cette spec)* Tout broker paper/live, `run-session`,
      `gen-trading-plan`, ordres. Le livrable s'arrête à **perf simulée + signaux**.

---

## 8. Fichiers concrets à toucher (récap)

| Fichier | Action |
|---|---|
| `data/pea-eligibility.json` | **créer** (référentiel sourcé fail-closed) |
| `data/eu-smallcap-universe.json` | **créer** (généré) |
| `tools/gen-eu-smallcap-universe.js` | **créer** (générateur univers PEA) |
| `tools/momentum-scanner.js` | ajouter univers `eu-smallcap` (map `UNIVERSE_FILES`) |
| `tools/lib/scanner-parser.js` | parser `eu_smallcap_pool` (`poolFrom`) |
| `data/modes-config.json` | ajouter mode `eu_smallcap` (draft) |
| `data/scanner-filters.json` | ajouter bloc `pea` |
| `tools/validate-scan.js` | asserter le bloc `pea` sur `signals.json` |
| `tools/sweep.js` | isolation universeFilter / registre pool |
| `tools/gen-status-page.js` | `signalsFor` (SCRIPTED_IDS / asset-mode), `curOf` EUR, panneau + badges PEA |
| `tools/gen-api.js` | endpoint `portfolio/v1/eu_smallcap.json` |
| `.claude/skills/scanner-pipeline.md` | query EU small-cap + ligne pipeline + étape agent univers |

> **Ne pas** toucher : `DTX_STAGING_MAP` (mode non-dtx), `trading-executor/*`, `run-session.js`,
> `gen-trading-plan.js` (out of scope §0).

---

## 9. Journal de décision

### 9.1 2026-07-12 — Deep backtest EU (couverture résolue) → **KEEP DRAFT** (honnête)

Couverture EU débloquée (backfill MCP v111, `RunBacktest` lit l'historique EU profond). Deep backtest
lancé sur le **cycle complet** — les 13 noms PEA du pool `scanner/20260713/signals.json`
(REVO.MI, AFX.DE, PLX.PA, ALR.WA, UBI.PA, EDR.MC, MDV.WA, APR.WA, GVS.MI, BFF.MI, NANO.PA, TIP.MI,
FTK.DE), stratégie `momentum_expansion`, total-return ajusté, `from=2022-01-01 to=2026-07-12`
(job MCP `job-a86436a0`, GetStatus healthy avant run — zéro fabrication).

**Métriques deep (réelles, MCP)** :

| Métrique | eu_smallcap (pool) | SPY (baseline) | VGK (proxy EU) |
|---|---|---|---|
| CAGR | **+12.0 %** | +12.2 % | +9.3 % |
| Total return | +67.0 % | +68.0 % | +49.3 % |
| Max drawdown | **-27.4 %** | -24.5 % | -32.3 % |
| Sharpe | 0.35 | — | — |
| Profit factor | 1.44 | — | — |
| Win rate | 53 % (83 trades) | — | — |

**Par année (walk-forward, pas de replay uniforme)** :

| Année | eu_smallcap | VGK | SPY | Verdict année |
|---|---|---|---|---|
| 2023 | +11.2 % (DD -17.7 %) | +18.7 % | +26.7 % | perd vs les deux |
| 2024 | +34.6 % (DD -8.4 %) | +3.2 % | +25.6 % | gagne |
| 2025 | +2.1 % (DD -26.7 %) | +36.4 % | +18.0 % | perd lourdement |
| 2026 YTD | +9.3 % (DD -16.6 %) | +6.7 % | +11.1 % | bat VGK, perd vs SPY |

**Décision : reste DRAFT.** Le gate dur (config-change-backtest + mode-success-criteria +
regime-aware-eval) n'est pas franchi :
- **Sous SPY** en absolu (CAGR 12.0 % < 12.2 %) et perd **3 années sur 4** face à SPY.
- Ne dépasse VGK que sur le **CAGR plein-période** (+2.7 pts) mais perd **2 années sur 4** face au proxy
  EU, dont 2025 catastrophique (+2.1 % vs VGK +36.4 %) → **pas d'edge persistant** en walk-forward.
- **Échoue le gate risque** : maxDD réalisé **-27.4 %** (2025 : -26.7 %) contre cible mode **≤ 8 %**
  (>3× la limite). Sharpe 0.35 très faible. Loin de « battre SPY ≥ 3× ».
- **Breadth insuffisante** : à `minScore=80`, seulement **4/13** noms du pool qualifient
  (REVO 84, AFX 83, PLX 83, ALR 80) — le backtest ci-dessus inclut pourtant les 13 (généreux) et
  n'a quand même pas d'edge. **`minScore` NON abaissé** (l'anti-pattern 80→72 avait été corrigé,
  commit `3a6e580b4`).

Mode masqué, `assetClass=equity_eu` isolé des pools US, chaîne SHA-256 des trades intacte. Prochaine
revue **2026-08-11**.
