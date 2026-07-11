# SPEC — Scanners factoriels low-turnover (momentum / quality / low-vol)

> **Statut** : proposition d'implémentation (draft spec, non implémentée).
> **Auteur** : DailyTickers / scanner desk. **Date** : 2026-07-11.
> **Scope (BORNE DURE)** : on construit vers le **systematic** MAIS on **s'arrête à la
> simulation + signaux** — sortie de type `scanner/status` (backtest / sweep / signaux /
> perf simulée). **AUCUN** concept paper/live, **AUCUN** ordre broker réel. Tout est
> embarquable dans `/scanner` + la page `scanner/status`. Zéro fabrication de données
> (règle MCP hard-stop du `CLAUDE.md`).

---

## 1. Problème / Contexte

### 1.1 Ce qui existe et le trou qu'on comble

Les 13 modes actuels (`data/modes-config.json`) sont **tous tactiques / haute-rotation** :
horizons courts (H8–H21), stops ATR serrés, rotation quotidienne, gating régime agressif.
Deux familles :

- **LLM/MCP-driven** (`turbo`, `dynamic`, `balanced`, `secured/Orbit`, `fortress`, `aplus`) —
  sélection discrétionnaire, gérée hors sweep pour fortress/aplus.
- **Scripted** (`highvol`, `hybrid`, `forex`, `etf`, `etf_eu`, `stockbox`) — ports fidèles
  de systematic-tss, signaux produits par un scanner node dédié
  (`tools/{highvol,fractal,forex,etf,stockbox,momentum}-scanner.js`) et P&L simulée soit
  par le moteur dtx (staging `data/dtx/*.json`), soit par `tools/sweep.js` (cas `hybrid`,
  qui « stays on sweep », cf. `DTX_STAGING_MAP` dans `tools/gen-status-page.js`).

**Aucun** mode n'est un **portefeuille factoriel académique à faible turnover** : rebalance
**mensuel**, sélection par **facteur pur** (momentum 12-1, quality, low-vol), équi-pondéré,
la **rotation EST la sortie** (pas de SL/TP par ligne). Le seul voisin structurel est
`stockbox` (index-rotation Nasdaq top-8, rebalance 21j, equal-weight, « rotation IS the exit,
no per-name stops » — cf. en-tête `tools/stockbox-scanner.js`), mais il est mono-facteur
(momentum 84j) et US mega-cap only.

### 1.2 Pourquoi ces 3 facteurs, pour CE profil

Profil cible : **retail EU peu capitalisé, multi-broker, agile, DevOps.** Edges réels
exploitables (à privilégier sur toute la spec) :

- **Capacity** : les facteurs marchent le mieux sur les **small/mid-caps** que les fonds ne
  peuvent pas jouer (capacité limitée) → terrain de jeu naturel du retail peu capitalisé.
- **Fiscal** : enveloppe **PEA / PEA-PME** (actions UE/EEE, PME-ETI pour le PEA-PME) →
  exonération d'impôt sur les plus-values après 5 ans. Un mode **low-turnover** minimise les
  frottements (spreads, commissions) et **maximise l'efficience fiscale** (peu d'allers-retours,
  gains capitalisés dans l'enveloppe).
- **API / automatisation** : un rebalance mensuel déterministe est trivial à scripter et à
  auditer — parfait pour un desk DevOps.
- **Barbell** : ces modes sont le **contrepoids lent** aux modes tactiques rapides. Les modes
  tactiques capturent l'alpha court-terme (momentum de rupture, squeeze, earnings) ; les modes
  factoriels capturent la **prime de facteur long-terme** avec un turnover 10–20× plus faible.
  Ensemble = barbell (une jambe rapide/convexe, une jambe lente/portante), pas deux paris
  corrélés.

### 1.3 Contraintes non négociables (héritées du repo)

- **MCP hard-stop** (`CLAUDE.md` §⛔) : si le MCP bloque ou renvoie des données incohérentes →
  STOP, jamais de substitution inventée.
- **Immutable trades** (`feedback_immutable_trades.md`) : `sweep.js` avorte sur violation de la
  chaîne SHA-256 (`data/trade-chain.json`). Un mode factoriel n'écrit **que** des nouveaux trades
  clôturés append-only.
- **PEA-eligibility = donnée, pas opinion** : l'éligibilité PEA/PEA-PME d'un titre doit venir
  d'une source vérifiable (référentiel MCP `GetReferentialData` / `GetInstruments` : pays,
  exchange, éligibilité), jamais devinée.
- **Pas de génération from scratch d'une config** : suivre le pattern « port ISO / verbatim »
  des modes scriptés (cf. `_comment` de `modes-config.json`).

---

## 2. Design

Trois modes, un seul moteur de scan (`tools/factor-scanner.js`), trois presets de facteur.
Ils suivent **exactement** le patron `stockbox` (le plus proche) : scanner node → pool dans
`signals.json` → sim P&L par `sweep.js` → rendu `scanner/status`.

| Mode id | label | Facteur | Univers | Lignes | Rebalance | Enveloppe |
|---|---|---|---|---|---|---|
| `fac_mom` | Momentum 12-1 | Momentum 12-1 (skip dernier mois) | PEA/PEA-PME EU | 12 | 21j (mensuel) | PEA |
| `fac_qual` | Quality | Quality composite (ratios) | PEA/PEA-PME EU | 12 | 21j (mensuel) | PEA |
| `fac_lowvol` | Low-Vol | Volatilité réalisée basse | PEA/PEA-PME EU | 15 | 21j (mensuel) | PEA |

> **Parcimonie volontaire** : les définitions de facteur sont **académiques et figées** (pas
> de tuning libre du cœur du signal). Seuls les *garde-fous* (taille univers, nb de lignes,
> disaster-stop) sont sujets à optimisation plateau. C'est le premier rempart anti-overfit
> (§4).

### 2.1 Données MCP requises (et rien d'autre)

Tout passe par la surface v5 consolidée (`mcp__claude_ai_marketdata__*`) + fallback Yahoo déjà
câblé dans les scanners (`tools/lib/price-cache.js`). **Aucune donnée fabriquée.**

**A. Univers PEA/PEA-PME (référentiel, mensuel, caché)**
- `GetInstruments(region='eu')` + `GetReferentialData` → liste des titres EU/EEE avec
  `country`, `exchange`, `market_cap`, `sector`, `industry`, `asset_type`.
- **Filtre PEA** : titres cotés sur une place UE/EEE éligible (Euronext Paris/Amsterdam/
  Bruxelles/Lisbonne, Xetra, Borsa Italiana, Bolsa Madrid, etc.), `asset_type == equity`.
- **Filtre PEA-PME** (sous-ensemble `fac_*` peut activer un flag) : `market_cap < 2e9` **ET**
  effectif/CA sous les seuils PME-ETI. À défaut de champ effectif fiable via MCP → approximer
  par `market_cap < 1e9` **et documenter la limite** (ne PAS inventer un critère effectif).
- **Liquidité (capacity-aware)** : `avg_volume × close ≥ 500 k€/jour` (small-cap mais tradable
  pour du retail). Filtre volontairement **bas** — c'est l'edge capacity, on VEUT les small-caps
  que les fonds ne touchent pas, tant qu'elles sont exécutables en petit.
- **Sortie** : deux nouveaux fichiers univers versionnés, régénérés mensuellement :
  `data/pea-universe.json` et `data/pea-pme-universe.json` (même forme que
  `data/etf-eu-universe.json` / `data/forex-universe.json`).
  ⚠️ Régénérés par une **étape AGENT** (le MCP est OAuth2, un subprocess node ne peut pas
  l'appeler — même contrainte que le staging dtx, cf. `scanner-pipeline.md`).

**B. Barres OHLCV (le cœur du signal factoriel)**
- Momentum & low-vol se calculent **uniquement sur les prix** → `QueryData(types=bars_daily)`
  (ou fallback Yahoo `adjClose` via `price-cache`, **total-return** comme stockbox pour la
  fidélité dividendes). Besoin de **≥ 260 barres** (12 mois + skip 1 mois + marge).
- **Cache DATÉ obligatoire** (`tools/lib/price-cache.js`, `1d`) → point-in-time, anti-look-ahead,
  replayable. **JAMAIS** de cache plat inline (leçon etf-scanner). ⚠️ **CORRECTION DE REVUE
  (2026-07-11)** : `MARKETS` n'expose **PAS** de clé `EU` (uniquement `US/CVA/FX/CRYPTO` — vérifié).
  Deux options : (a) ajouter une clé `MARKETS.EU` + le routage de fetch des symboles Yahoo EU
  (`.PA/.AS/.DE/.MI/.MC/…`), ou (b) réutiliser le mécanisme de fetch EU **déjà** employé par
  `momentum-scanner.js --universe eu` (qui lit `eu-universe.json` et fetch Yahoo en direct sans clé
  `MARKETS.EU`). Choisir (b) si le fetch EU existant suffit ; ne pas présupposer `MARKETS.EU`.

**C. Ratios fondamentaux (quality uniquement)**
- `QueryData(types=financials,stats)` — Yahoo `quoteSummary` en primaire, MCP en fallback
  (cf. `.claude/skills/mcp-gateway-tools.md` : « Fondamentaux → `QueryData types=financials,stats` »).
- Champs consommés (best-effort, chaque ratio **optionnel + skip-si-absent**, jamais inventé) :
  `returnOnEquity`, `grossMargins` / `operatingMargins`, `debtToEquity` (ou `totalDebt/`
  `totalEquity`), `earningsGrowth` / stabilité EPS. Un titre sans données quality suffisantes est
  **exclu** du pool `fac_qual` (fail-closed), pas noté au pif.

**D. Régime & garde-fous (déjà câblés)**
- `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` — le régime **ne filtre
  PAS** la sélection factorielle (facteur = rank pur, comme stockbox `abs_filter=0`), mais il
  pilote un **de-risking doux** au niveau du sizing global (cf. §2.4 disaster-stop / VIX kill).
- `PortfolioRisk(action='correlation', ...)` pour le rapport de diversification affiché (pas un
  gate de sélection — un portefeuille factoriel équi-pondéré assume sa concentration sectorielle
  mesurée).

### 2.2 Construction du score (par facteur)

Tous les scores sont calculés par `tools/factor-scanner.js` à partir des helpers existants
`tools/lib/fractal-indicators.js` (`calcSMA`, `calcRSI`, `calcATR`, `calcVolatility`,
`calcMomentum`, `calcAvgVolume`, …). **Rank pur, tie-break `symbol ASC`** (déterministe,
byte-for-byte, comme le comparateur Go de stockbox).

**`fac_mom` — Momentum 12-1 (académique)**
```
mom_12_1(sym) = adjClose[t-21] / adjClose[t-252] - 1
```
- `t-252` ≈ 12 mois, `t-21` ≈ skip du dernier mois (évite la réversion court-terme —
  c'est LE momentum de Jegadeesh-Titman, distinct du momentum de rupture des modes tactiques).
- Filtres de sanity (pas du tuning) : `adjClose > 0`, `≥ 253 barres`, exclure indices `^…`.
- Rank `mom_12_1` DESC → top 12.
- **Garde-fou** optionnel `abs_filter` : si `mom_12_1 ≤ 0` pour un titre du top → il est
  quand même tenu (rank pur, défaut `abs_filter=false` comme stockbox) **sauf** en régime
  RISK-OFF où `abs_filter=true` (n'entre que du momentum positif) → dégradation gracieuse,
  documentée.

**`fac_qual` — Quality composite**
```
quality_z(sym) = z(ROE) + z(margin) - z(leverage) + z(earnings_stability)
```
- Chaque terme = **z-score cross-sectionnel** sur l'univers du mois (moyenne/écart-type du mois
  courant — recalculé à chaque rebalance, pas de constante gelée).
- `leverage` en **négatif** (moins de dette = meilleure qualité).
- Termes manquants → le z-score du terme = 0 (neutre) **et** le titre doit avoir **≥ 2 termes
  sur 4** présents, sinon exclu (fail-closed).
- Rank `quality_z` DESC → top 12.

**`fac_lowvol` — Low-Vol**
```
vol_realized(sym) = stdev(daily_returns, 120) * sqrt(252)     // vol annualisée 6 mois
```
- Rank `vol_realized` **ASC** (les moins volatils d'abord) → top 15 (plus de lignes = le
  low-vol assume la diversification, moins de concentration idiosyncratique).
- Sanity : exclure titres à `< 121` barres ou `avg_volume` sous le plancher liquidité.
- Anti-piège : exclure les titres dont la vol basse vient d'un **manque de cotation**
  (jours sans volume > 20 % de la fenêtre) → faux low-vol illiquide.

### 2.3 Rebalance mensuel & nb de lignes

- **Cadence** : `rebalanceDays: 21` (mensuel bourse), **equalWeight: true** — identique aux
  clés déjà supportées par `stockbox` dans `modes-config.json` (`rebalanceDays`, `equalWeight`,
  `sizingMethod: "equal_weight"`).
- **Jour de rebalance** : le scan tourne tous les jours dans `/scanner`, mais le portefeuille
  factoriel ne **change ses positions que le jour de rebalance** (tous les 21 jours de bourse
  depuis `statusSince`). Les autres jours, le scanner ré-émet le **même** panier (holdings
  inchangés) → c'est ce qui garantit le low-turnover et l'efficience fiscale PEA.
- **Nb de lignes** : `portfolioSize = topN = 12` (mom/qual), `15` (low-vol). Equi-pondéré
  (1/N). Assez pour diversifier, assez concentré pour capter la prime (retail peu capitalisé :
  12–15 lignes = ~300–800 € par ligne sur un PEA modeste, exécutable).

### 2.4 Règles de sortie (rotation = exit)

**Principe (comme stockbox)** : la **rotation mensuelle EST la sortie**. Un titre qui quitte le
top-N au rebalance est vendu au rebalance suivant. Il n'y a **pas de SL/TP par ligne** dans la
stratégie.

- `trailingStop: false`, `partialTP: false`, pas de `atrStopMult` de stratégie.
- **Disaster-stop downstream uniquement** (filet, PAS un paramètre de la stratégie — même
  sémantique que le `_note` de stockbox dans `modes-config.json`) : `maxStopPct: 25` +
  `earlyExitLossPct`/`earlyExitDays` optionnel pour couper un titre qui s'effondre (-25 %) entre
  deux rebalances. Ce filet vit dans la sim `sweep.js`, pas dans le signal.
- **De-risking régime (global, pas par ligne)** : `vixKillThreshold` (ex. 35) → si dépassé au
  rebalance, réduire le nb de lignes tenues (via `regimeParams.maxPositions` par régime, clé déjà
  supportée, cf. `highvol`/`hybrid`). En RISK-OFF, `maxPositions` peut tomber à ~50 % → le reste
  en cash (dégradation gracieuse, jamais un short). **Documenté, jamais silencieux.**

### 2.5 Schéma — signaux (`signals.json`) & config (`modes-config.json`)

**Pools `signals.json`** — trois nouvelles clés, consommées par `poolFrom(key)` dans
`tools/lib/scanner-parser.js` (même mécanique que `forex_pool`, `metals_pool`, `crypto_pool`) :
```jsonc
{
  "fac_mom_pool":    [ /* setups */ ],
  "fac_qual_pool":   [ /* setups */ ],
  "fac_lowvol_pool": [ /* setups */ ]
}
```
Chaque setup (shape alignée sur les pools scriptés existants ; pas de SL/TP de stratégie →
`stop`/`tp1` portent le disaster-stop informatif seulement) :
```jsonc
{
  "ticker": "AIR.PA",
  "name": "Airbus",
  "score": 34.7,                 // valeur brute du facteur (mom% / quality_z / -vol)
  "rank": 1,
  "weight": 0.0833,              // 1/N
  "strategy": "FactorMomentum",  // "FactorQuality" | "FactorLowVol"
  "region": "eu",
  "sector": "Industrials",
  "entry": 168.4,                // spot au rebalance (VWAP/close), pas reverse-engineered
  "stop": 126.3,                 // disaster-stop -25% (informatif, downstream)
  "tp1": null, "tp2": null, "rr": null,  // pas de TP de stratégie
  "horizon": 21,
  "pea_eligible": true,
  "pea_pme_eligible": false,
  "sharia": false,               // tag calculé, jamais deviné
  "rebalance_day": true,         // false les jours hors-rebalance (panier inchangé)
  "thesis": "12-1 momentum rank #1 (top decile EU large-cap), PEA-eligible"
}
```

**Config `modes-config.json`** — trois entrées ; les clés **existent déjà dans le schéma**
(`rebalanceDays`/`equalWeight` sont présentes sur `stockbox`). ⚠️ **Mais « présentes » ≠
« consommées »** : `sweep.js` **ne lit pas** `rebalanceDays`/`equalWeight` (cf. correction §3.4) —
le consommateur de la rotation-comme-sortie reste **à écrire**. Aucune clé JSON nouvelle, mais bien
une **nouvelle logique de sim** requise. Config :
```jsonc
"fac_mom": {
  "status": "draft",                     // draft → test → live (state machine, cf. §4)
  "statusSince": "2026-07-11T00:00:00Z",
  "label": "Momentum 12-1", "color": "#0ea5e9",
  "goal": "EU factor momentum, low-turnover, PEA-efficient",
  "riskProfile": "Medium",
  "assetClass": "eu_equity",             // → bucket "scripted" (LLM_MODES ne le contient pas)
  "universe": "data/pea-universe.json",
  "universeFilter": "pea",
  "portfolioSize": 12, "topN": 12,
  "minScore": 0,                          // rank pur, pas de seuil
  "filterName": "factor_rotation",        // nouveau filtre → §3
  "rotation": "none",
  "horizon": 21,
  "rebalanceDays": 21, "equalWeight": true,
  "sizingMethod": "equal_weight", "targetRiskPct": 1,
  "trailingStop": false, "partialTP": false,
  "maxStopPct": 25, "atrStopMult": 2.5,   // filet disaster-stop downstream only
  "earlyExitLossPct": 25, "earlyExitDays": 5,
  "vixKillThreshold": 35,
  "regimeParams": { "maxPositions": { "risk_on":12,"recovery":12,"neutral":10,"early_risk_off":8,"risk_off":6 } },
  "regimeFilters": { "risk_on":"factor_rotation","early_risk_off":"factor_rotation","risk_off":"factor_rotation","neutral":"factor_rotation","recovery":"factor_rotation" },
  "crossModeDedup": false, "tklPoolEnabled": false,
  "_note": "factor_rotation: la ROTATION mensuelle EST la sortie (rebalance top-12 tous les 21j). AUCUN SL/TP par ligne. maxStopPct/earlyExit = filet disaster-stop downstream (sweep) uniquement, PAS un paramètre de la stratégie. Momentum 12-1 académique (skip dernier mois) — définition FIGÉE, non tunée."
}
```
`fac_qual` et `fac_lowvol` : idem, en changeant `label/color/goal`, `portfolioSize` (15 pour
low-vol), `filterName` reste `factor_rotation` (le facteur est porté par le pool/scanner, pas
par le filtre sweep). `fac_lowvol.riskProfile: "Low"`.

---

## 3. Intégration (fichiers concrets à toucher)

Ordre = pipeline. Chaque point cite le fichier réel.

### 3.1 `tools/factor-scanner.js` (NOUVEAU)
Calqué sur `tools/stockbox-scanner.js` + `tools/etf-scanner.js` (mêmes CLI flags
`--output signals --date --folder --regime`, même `price-cache` daté, mêmes helpers
`fractal-indicators`). Un seul script, `--factor {momentum|quality|lowvol}` sélectionne le
preset. Écrit `fac_{mom|qual|lowvol}_pool` dans `scanner/YYYYMMDD/signals.json`.
- **Détection du jour de rebalance** : `(tradingDaysSince(statusSince) % 21 === 0)`. Hors
  rebalance → relire le dernier panier committé et ré-émettre `rebalance_day:false` (holdings
  figés) pour que la sim ne « tourne » pas le portefeuille tous les jours.
- **Quality** a besoin des fondamentaux → étape MCP `QueryData(types=financials,stats)` par
  candidat du top-univers (agent, pas subprocess), avec cache journalier.
- **Zéro fabrication** : si un titre n'a ni barres suffisantes ni ratios → exclu + logué.

### 3.2 `data/modes-config.json`
Ajouter les 3 modes (schéma §2.5). **Ne JAMAIS éditer à la main** un JSON de données → passer
par le tooling d'écriture existant si présent, sinon un petit script d'ajout dédié.
Démarrer en `status: "draft"` (cf. state machine `tools/set-mode-status.js`, doc
`tools/lib/MODE_STATUS.md`) — pas `live` avant les gates §4.

### 3.3 `tools/lib/scanner-parser.js`
Ajouter les 3 pools dans `loadSignals()` via `poolFrom('fac_mom_pool')` etc. (3 lignes,
symétriques aux pools existants ligne ~137-141), et les propager dans l'objet retourné +
`module.exports`.

### 3.4 `tools/sweep.js` (moteur de sim P&L — SIM-ONLY)
- **`STRATEGY_FILTERS_MAP`** : ajouter la clé `'factor_rotation'` (Set des strategy-tags
  qu'elle **accepte** ; ici `FactorMomentum`/`FactorQuality`/`FactorLowVol` — ajouter aussi ces
  tags à la boucle `_set.add(...)` comme c'est fait pour `IndexRotation` ligne ~461-462, OU les
  déclarer dans le Set du filtre). Suivre exactement le patron `index_rotation` (ligne ~457).
- **`STRATEGY_META` / dérivation de score** : ajouter le mapping regex `factor_*` (comme
  `momentum_rotation: /momentum.?rotation/i`, `etf_momentum: /etf.?momentum/i` lignes ~174-175)
  pour que `buildSetups` tag correctement les setups des pools.
- **Pools → assetClass** : ces modes sont `eu_equity`, PAS une asset-class « exclue »
  (`ASSET_POOL_SOURCES` ligne ~283 concerne crypto/metals/forex/casablanca). Les pools factoriels
  alimentent **leurs modes dédiés** ; s'assurer que `simulatePortfolio` route
  `fac_*_pool → fac_*` mode (comme forex_pool → forex). Vérifier la logique
  `loaded.*Pool` / consommation par mode.
- **Rotation = exit** : la sim doit fermer une ligne quand elle sort du top-N au rebalance
  (pas de SL/TP). ⚠️ **CORRECTION DE REVUE (2026-07-11)** : contrairement à ce que laissait
  entendre une première version, **il n'existe PAS de chemin sweep « rotation-is-exit » à
  réutiliser**. `stockbox` déclare bien `rebalanceDays:21`/`equalWeight:true` dans
  `modes-config.json`, mais (a) **`sweep.js` ne lit NI `rebalanceDays` NI `equalWeight`** (aucune
  occurrence — vérifié) et (b) la **P&L de `stockbox` est produite par le moteur dtx**
  (`DTX_STAGING_MAP: stockbox → stockbox_nasdaq`), **pas par `sweep.js`**. Le seul mode « stays on
  sweep » (`hybrid`) est un mode **SL/TP par ligne**, pas une rotation equal-weight. ⇒ La
  mécanique mensuelle equal-weight / holdings persistants / rotation-comme-sortie doit être
  **CONSTRUITE dans `sweep.js`** (nouveau chemin `rebalanceDays`/`equalWeight`), ce n'est **pas**
  un simple câblage. Sans elle, un mode `horizon:21` + re-émission du panier serait simulé comme
  N positions per-name à horizon fixe — une **approximation**, pas une vraie rotation. Le
  disaster-stop (`maxStopPct`/`earlyExit*`) reste le filet existant.
- **Append-only + immutable** : les trades clôturés s'ajoutent à `data/backtest-trades.json`,
  chaîne SHA-256 `data/trade-chain.json` intacte. `sweep.js` avorte sinon (règle absolue).

### 3.5 `tools/gen-status-page.js` (page `scanner/status`)
- Les 3 modes tombent automatiquement dans le bucket **`scripted`** (ils ne sont pas dans
  `LLM_MODES`, ligne ~1820) → colonne « Scripted » de la page. **Rien à changer** pour le
  bucketing.
- **Panneau « Orders to Place »** : la sim vient de `sweep.js` (pas dtx) → même chemin que
  `hybrid` (« has NO config/dtx yaml → stays on sweep », cf. commentaire `DTX_STAGING_MAP`).
  **Ne PAS** ajouter les `fac_*` à `DTX_STAGING_MAP` tant qu'il n'existe pas de portefeuille dtx
  correspondant (voir §5 upgrade).
- **Nouvelles stats à afficher** (petit ajout de rendu, aligné sur l'esthétique existante,
  cf. skill `impeccable` / `PRODUCT.md` / `DESIGN.md`) :
  - **Turnover mensuel mesuré** (§4.2) — la métrique signature de ces modes.
  - **Prochain rebalance** (jours restants) + badge « panier figé » les jours hors-rebalance.
  - **Éligibilité PEA / PEA-PME** (badge par ligne) — l'edge fiscal, visible.
  - `assetClass: eu_equity` → devise `EUR` (adapter `curOf(cfg)` ligne ~927 qui ne gère
    aujourd'hui que MAD/USD → ajouter le cas EUR pour `eu_equity`).
- **Splice backtest↔live** : `statusSince` sert de point de bascule courbe historique↔live,
  comme les modes scriptés.

### 3.6 `.claude/skills/scanner-pipeline.md` + `data/scanner-notifications`
- Ajouter les 3 lignes `node tools/factor-scanner.js --factor … --output signals …` dans la
  section « Pipeline Quotidien (Append-only) », **avant** `sweep.js`.
- `tools/gen-scanner-notifications.js` : les modes factoriels génèrent un message honnête les
  jours hors-rebalance (« panier inchangé, prochain rebalance dans N j ») — ne pas spammer un
  « 0 signal » trompeur. Alias notif `scanner-fac-mom` etc. (ou router vers `alerts`).

### 3.7 `tools/gen-api.js`
Les 3 modes exposés automatiquement dans `portfolio/v1/<mode>/*.json` (mode générique) →
vérifier que le bloc `status` + equity + holdings sont peuplés depuis la sim sweep. Rien de
spécifique attendu au-delà du câblage mode standard.

---

## 4. Gates de sûreté

### 4.1 Backtest walk-forward (anti-overfit — LE gate central)

Un facteur académique se **valide out-of-sample par construction**, mais on l'ancre dans les
outils existants :

1. **Walk-forward roulant** : `tools/rolling-walk-forward.js` — WR/PF/return par mode sur
   fenêtres roulantes. Un mode factoriel doit être **stable** (pas de cliff), c'est le test de
   robustesse #1.
2. **A/B out-of-sample** : `tools/validate-config-change.js` (split OOS 70 %, walk-forward,
   `regimeFilters` inclus → chiffres alignés sur le chemin frozen). Tout changement de garde-fou
   (nb lignes, disaster-stop) doit **battre** la version courante en OOS avant application
   (règle `feedback_config_change_backtest.md` : backtest 30j obligatoire).
3. **Plateau, pas pic** (`tools/optimize-param.js`, méthode « Mountain Plateau ») : les **seuls**
   params optimisables sont `portfolioSize`, `maxStopPct`/`earlyExit`, `vixKillThreshold`,
   plancher liquidité. **1 param à la fois**, centre de plateau, stabilité ≥ 50 %. **Le cœur du
   facteur (252/21, définitions quality/low-vol) n'est JAMAIS tuné** — c'est la garantie
   anti data-snooping (leçon `feedback_regime_aware_eval.md` + anti-patterns scanner-pipeline).
4. **Point-in-time / anti-look-ahead** : `price-cache` daté obligatoire (fenêtre tronquée à la
   date de scan). Le momentum 12-1 lit `[t-252 … t-21]`, **jamais** `t` → pas de fuite.
   Univers PEA reconstruit au point-in-time (pas la composition d'aujourd'hui projetée dans le
   passé → survivorship bias documenté comme limite si l'historique d'appartenance n'est pas
   dispo).

### 4.2 Sanity gates (données aberrantes ≠ échec technique)

Réutiliser le patron `config/dtx/_sanity-baselines.json` + `assertReplaySanity()`
(`tools/dtx-scan.js`) — mais côté sim sweep :
- Ajouter une baseline par mode dans un `config/factor/_sanity-baselines.json` (bornes :
  `|max_dd| ≤ 40 %`, `sharpe ≥ 0`, `win_rate ∈ [30,75]` — un portefeuille factoriel long-only a
  un WR modéré, c'est normal, `total_trades` cohérent avec un turnover mensuel = **~12×N/an
  max**, un blow-up de trades = param drift).
- **Tripwire turnover** (spécifique low-turnover) : `turnover_mensuel > 40 %` des lignes →
  **alerte** (un mode « low-turnover » qui roule 60 % de son panier chaque mois est cassé). Le
  turnover est calculé = `|holdings(m) \ holdings(m-1)| / N`. C'est **la** métrique de contrôle
  identitaire de ces modes, affichée ET gatée.
- Si un gate saute → `qa-check.js` échoue en dur, staging marqué suspect, **alerte Telegram
  `alerts`**, ne PAS publier les métriques du mode (même discipline que dtx §5.5 du pipeline).

### 4.3 Immutabilité & intégrité
- `data/backtest-trades.json` append-only, chaîne SHA-256 `data/trade-chain.json` — `sweep.js`
  avorte sur violation. Un rebalance ne **réécrit jamais** un trade passé.
- `portfolioSize`/config historisés (`modes-config-history.json`) — jamais de batch-reset sans
  consentement (`feedback_sweep_psize_history.md`).

### 4.4 QA structurel & contenu
- `node tools/qa-check.js` doit afficher **0 ❌** (inclut désormais le tripwire turnover + sanity
  factoriel).
- `node tools/validate-scan.js` : les setups factoriels passent les mêmes règles de shape
  (score ≤ 98, entry = spot ±10 %, pas de penny sous plancher liquidité). Note : les gates
  R/R-par-régime et stop-ATR **ne s'appliquent pas** (pas de SL/TP de stratégie) → prévoir une
  **exemption explicite** `strategy ∈ {Factor*}` dans `validate-scan.js` (comme les exemptions
  existantes), sinon faux rejets.
- Publication éditoriale éventuelle (carte/analyse) → `tools/qa-content.js --strict` +
  `check-ai-tells.js` (voix `EDITORIAL_STYLE.md`), jamais de terme interne (« MCP », « sweep »)
  dans le contenu publié.

### 4.5 MCP hard-stop
Toute étape de collecte (univers PEA, barres, ratios quality, régime) : si le MCP bloque ou
renvoie des valeurs incohérentes (mcap 0 partout, NaN, stale > 48 h) → **STOP**, alerter, ne
jamais substituer. Le mode reste sur son dernier panier committé (dégradation gracieuse), marqué
stale, jamais rafraîchi avec de la donnée inventée.

---

## 5. Upgrade path (hors scope immédiat, noté pour cohérence)

Le chemin « faithful » ultérieur = porter les 3 facteurs en **portefeuilles dtx** (systematic-tss
Go) et les câbler comme les 5 modes scriptés : `config/dtx/portfolio_fac_*.yaml`,
`PORTFOLIO_TO_MODE` + `DTX_STAGING_MAP`, staging `data/dtx/fac_*.json` produit par l'agent via
`DtxReplay`/`DtxDecide`. **Ne PAS faire dans cette itération** : ça introduit une dépendance Go
et le moteur dtx n'a pas encore de stratégie factorielle low-turnover. La v1 vit **entièrement
en sim sweep** (comme `hybrid`), ce qui satisfait la borne SIM-ONLY sans nouvelle brique.

---

## 6. Critère de « FAIT » (definition of done)

- [ ] `tools/factor-scanner.js` produit `fac_{mom,qual,lowvol}_pool` dans un `signals.json`,
      déterministe (rank + tie-break symbol ASC), cache daté PIT, **jour de rebalance** respecté
      (panier figé hors rebalance), **zéro fabrication** (titres sans données → exclus + logués).
- [ ] 3 modes dans `data/modes-config.json` en `status:"draft"`, schéma §2.5, aucune clé
      non supportée par les consommateurs.
- [ ] `scanner-parser.js` charge les 3 pools ; **`sweep.js` reçoit un NOUVEAU chemin
      rotation-comme-sortie** (`rebalanceDays`/`equalWeight`/holdings persistants — **à écrire**,
      inexistant aujourd'hui : `sweep.js` ne consomme pas ces clés et `stockbox` est dtx-backed),
      append-only + chaîne SHA-256 intacte. Sim tourne une période complète avant tout commit.
- [ ] `scanner/status` affiche les 3 modes (bucket scripted) avec : equity/perf **simulée**,
      **turnover mensuel mesuré**, prochain rebalance, badges PEA/PEA-PME, devise EUR.
- [ ] **Walk-forward** (`rolling-walk-forward.js`) stable + **A/B OOS**
      (`validate-config-change.js`) sur ≥ 30 j pour tout garde-fou modifié ; cœur du facteur
      **non tuné** (parcimonie prouvée).
- [ ] Sanity gates (`config/factor/_sanity-baselines.json` + **tripwire turnover ≤ 40 %/mois**)
      câblés dans `qa-check.js` ; un blow-up → alerte + non-publication.
- [ ] `qa-check.js` = 0 ❌, `validate-scan.js` passe (avec exemption R/R-stop pour `Factor*`),
      MCP hard-stop respecté sur toute la collecte.
- [ ] **Barbell démontré** : rapport de corrélation (`PortfolioRisk`) montrant que les 3 modes
      factoriels sont **faiblement corrélés** aux modes tactiques (turbo/dynamic/…) sur la période
      — sinon ce n'est pas un barbell, juste un doublon lent.
- [ ] Pas de commit tant que la sim n'a pas tourné une période complète et que les gates passent
      (règle post-tâche `CLAUDE.md` : pas de push si génération incomplète).
```
