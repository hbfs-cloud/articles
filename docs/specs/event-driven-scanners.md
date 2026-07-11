# SPEC — Scanners event-driven (PEAD / filings / gap)

> **Statut** : draft d'implémentation. **Scope dur : SIM-ONLY.** On construit trois briques de génération
> de signaux + perf simulée, embarquées dans la commande `/scanner` et la page `scanner/status`. **Aucun
> concept paper/live, aucune exécution d'ordre, aucun appel broker.** La sortie de bout en bout est
> identique à celle des scanners existants : `signals.json` (pools) → `sweep.js` (backtest append-only) →
> `gen-status-page.js` (perf simulée) → `gen-api.js` (JSON publics). Le mot « déclenchement » dans ce
> document désigne **exclusivement** le déclenchement de la *génération de signaux* (horaire/webhook), pas
> l'envoi d'un ordre.
>
> **Règle MCP hard-stop (immuable).** Zéro fabrication. Toute donnée (EPS, guidance, gap, dépôt SEC/AMF,
> Form 4) vient du MCP `mcp__marketdata__*`. Si le MCP bloque ou renvoie des valeurs incohérentes →
> STOP, marquer le run incomplet, ne jamais estimer.

---

## 1. Problème / Contexte

### 1.1 Edge visé

Profil cible : **retail EU peu capitalisé, multi-broker, agile, DevOps.** Les scanners momentum/breakout
existants (`turbo`, `dynamic`, `balanced`…) jouent la structure technique mais ignorent trois sources
d'alpha que notre edge DevOps peut exploiter **parce qu'elles sont mécaniques, datées, et automatisables** :

| Edge | Exploitation event-driven |
|------|---------------------------|
| **Capacity** (small-caps) | Le PEAD et les gaps sont plus forts et plus persistants sur les small/mid caps que le grand capital ne peut pas jouer sans bouger le marché. Notre taille minuscule = aucune contrainte de liquidité. |
| **API / automatisation** | Le calendrier earnings, les dépôts SEC 8-K/S-1, les Form 4 et le gap pré-marché sont des **événements horodatés** : un scanner peut les capter à heure fixe (post-close, pré-open) sans discrétion humaine. |
| **Event-driven** | Le drift post-earnings (PEAD), la réaction aux filings et le gap-and-go sont des anomalies documentées, avec une fenêtre de décision courte — exactement ce qu'une routine cron/webhook capture mieux qu'un humain. |
| **Fiscal (PEA/PEA-PME)** | Les signaux EU éligibles PEA doivent être **taggables** (déjà porté par le pool EU) pour ne pas générer des idées non logeables dans l'enveloppe. Voir §2.2 (limites AMF). |

### 1.2 Ce qui existe déjà (à réutiliser, ne pas réinventer)

- **Pipeline pool-backed** : `data/modes-config.json` définit N modes, chacun avec `filterName`,
  `assetClass`, `minScore`, `status`. Un mode « asset-class » (ex. `forex`) tire ses candidats d'un pool
  dédié tagué `source='<class>_pool'` dans `scanner/YYYYMMDD/signals.json`.
- **Parser central** : `tools/lib/scanner-parser.js` → `loadSignals(dir)` lit `signals.json`, mappe les
  pools (`crypto_pool`, `metals_pool`, `forex_pool`, `casablanca_pool`, `fortress_pool`, `tkl_pool`) via
  `poolFrom(key)` qui stampe `source`. Les pools stratégiques `momentum/breakout/pullback/pre_squeeze/bull`
  sont mergés dans `signals[]` (dedup par ticker).
- **Backtest append-only** : `tools/sweep.js` consomme `loadSignals()`, simule les sorties, **n'écrit
  QUE des trades nouvellement fermés** dans `data/backtest-trades.json` (chaîne SHA-256 immuable
  `trade-chain.json`). Les modes sont pré-simulés via leur config frozen.
- **Page perf simulée** : `tools/gen-status-page.js` — `signalsFor(cfg)` filtre les signaux par
  `SF[cfg.filterName]` + gate asset-class (`s.source === ac+'_pool'`) ; `SCRIPTED_FILTERS`/`DTX_STAGING_MAP`
  routent les modes systematic. `filterLabel()` nomme le filtre.
- **Preuve de run** : `tools/qa-check.js` → `SCRIPT_SCANNER_MARKERS` vérifie que chaque scanner scripté
  live a écrit son marqueur `_scanRuns['<scanner>']` dans `signals.json` (0 signal = légitime, marqueur
  absent = crash silencieux = ❌).
- **Registre de signaux** (optionnel, track-record) : `tools/signals-ledger.js` + `data/signals-ledger.json`
  (append-only, statuts `open→triggered→tp1→tp2/stopped/expired`, R réalisé).

**Principe directeur** : les trois nouveaux scanners sont des **scripts node autonomes** sur le modèle de
`tools/momentum-scanner.js` / `tools/etf-scanner.js`. Ils s'insèrent dans le pipeline **exactement** comme
les scanners d'asset-class, sans nouveau moteur ni nouvelle mécanique de rendu.

### 1.3 Contrainte MCP / subprocess (rappel critique)

Un **subprocess `node` NE PEUT PAS** appeler le MCP `mcp__marketdata__*` (OAuth2, zéro token en `.env`).
Deux stratégies possibles pour l'alimentation en données, **à choisir par scanner** :

- **(A) Fetch direct sans MCP** (comme `momentum-scanner.js` qui lit Yahoo/BVC) : le scanner fait ses
  propres requêtes HTTP publiques. Applicable au **gap pré-marché** (bougies) mais **PAS** aux données
  earnings/filings propriétaires.
- **(B) Staging AGENT → ingest** (comme le refresh dtx) : l'**AGENT** (`/scanner` local ou `claude -p`
  cloud) appelle le MCP, écrit des JSON bruts, puis un script node d'ingest construit le pool. C'est la
  voie **obligatoire** pour PEAD (earnings) et filings (SEC/AMF), car ces données ne sont accessibles que
  via MCP.

Chaque brique ci-dessous précise laquelle elle utilise.

---

## 2. Design des trois briques

### 2.0 Convention commune

- **Date** : le scanner couvre la **prochaine séance** (dossier `scanner/YYYYMMDD/` = D+1 ; vendredi soir → lundi).
- **Long-only**, `entry`/`stop`/`tp1`/`tp2`/`rr` en absolu, `score` ≤ 98 (jamais parfait).
- **Sortie** : chaque scanner écrit **son pool** dans `scanner/YYYYMMDD/signals.json` + **un marqueur**
  `_scanRuns['<scanner>']` (voir §3.4). Shape d'un signal identique aux autres pools (voir §2.5).
- **Gates hérités** : stop ∈ [3 %, 8 %] et ≥ 1,5× ATR14, penny < $5 rejeté, R/R ≥ seuil régime, dilution
  check (`sec_filings,flags`), Sharia tag. Ces gates vivent déjà dans `validate-scan.js` /
  `scanner-lessons.json` — les scanners event-driven **doivent** les passer, pas les contourner.

---

### 2.1 Brique 1 — PEAD / earnings-drift

**But** : après un résultat, acheter la *force qui persiste* (Post-Earnings Announcement Drift). Anomalie :
un titre qui **beat + relève sa guidance + tient son gap au-dessus de la résistance sur volume** dérive dans
le sens du gap pendant ~5–20 séances. On ne joue **jamais** dans le trou (pas d'entrée avant le print).

#### Signal (conditions d'émission)

Émettre un signal `PEAD` pour un ticker qui, **au dernier print (≤ 3 séances)** :
1. **Beat EPS** (actual > estimate) ET **beat revenue** (défensif : au moins EPS).
2. **Guidance relevée** au trimestre (discriminant #1 des A+ — cf `feedback_aplus_grading_empirical`).
3. **Gap tenu** : `gap_pct() ≥ +3 %` le jour du print ET close du jour de print **au-dessus** de la
   résistance pré-print, ET **pas refermé** depuis (close courant > mid-gap).
4. **Volume de confirmation** : volume du jour de print ≥ 1,5× la moyenne 20j.
5. **Pas de re-print imminent** (le prochain earnings n'est pas dans la fenêtre de hold).
6. **Drift encore devant** : extension EMA20 ≤ ~8 % (on ne rentre pas après que tout le drift est fait).

**Fenêtre / horizon** : entrée D+1…D+3 post-print sur **tenue du gap ou repli au VWAP** ; hold H10–H15 ;
`stop` sous le plus-bas du jour de gap (clampé 3–8 %) ; `tp1` = prochaine résistance / mesure du gap ;
R/R ≥ 1,5 (RISK-ON/NEUTRAL) ou ≥ 2,0 (ERO/RISK-OFF).

**Sizing** : `inverse_atr` comme les modes equity ; **taille réduite** car le catalyseur est déjà passé
mais le gap-risk résiduel existe (jamais de « faux caveat », mais jamais minimiser non plus).

#### Données MCP requises (voie B — staging AGENT)

L'agent appelle, **avant** le script d'ingest :

| Appel MCP | Rôle |
|-----------|------|
| `GetEarningsCalendarFiltered(days_ahead=7, min_expected_move_pct=4, include_implied_move=true)` | Univers des prints récents/à venir + move implicite + fenêtre d'exclusion. |
| `QueryData(types="earnings_quarterly", symbols=…, limit=8)` | Historique de beats (≥ 5 consécutifs = qualité), surprise EPS/rev du dernier print. |
| `QueryData(types="analyst_actions,financials")` | Guidance relevée + révisions analystes post-print (up = vent dans le dos). |
| `QueryData(types="quote,bars_daily,technicals,vwap")` | Gap tenu, EMA20/ATR14/RSI14, VWAP d'entrée, extension. |
| `QueryData(types="unusual_options")` | Confirmation flux (call skew) — bonus de score, pas éliminatoire. |
| `QueryData(types="sec_filings,flags")` | Anti-dilution (offering post-résultats = disqualifiant). |
| `GetMarketContext(facets="regime")` | Un beat en régime hostile drift moins → pénalité de score. |

> **Réutilisation** : ce sont exactement les appels du skill `earnings-reaction.md` (volet POST). Le skill
> reste le workflow éditorial ; le scanner PEAD en est la **version scriptée** qui écrit un pool.

#### DSL / logique

Le **screening initial** (réduction d'univers) peut passer par `RunScreener` côté agent, mais le cœur PEAD
est une **logique node** appliquée aux JSON stagés (le DSL ne connaît pas la guidance). Pseudo-logique de
`tools/pead-scanner.js` (ingest) :

```
pour chaque ticker du calendrier avec print ≤ 3 séances :
  if !(eps_actual > eps_est) : drop
  if !guidance_raised : drop                      # depuis analyst_actions/financials stagés
  gap = (open_print / prev_close - 1)*100
  if gap < 3 : drop
  if close_now < mid_gap : drop                   # gap refermé
  if vol_print < 1.5 * avgvol20 : drop
  if ext_ema20 > 8 : drop
  if days_until_next_earnings < holdDays : drop
  score = 60 + beats_streak*4 + (guidance_raised?10:0)
        + (call_skew?6:0) + regime_bonus - dilution_penalty   # cap 98
  entry = min(open_Dp1_est, vwap) ; stop = min(low_gap_day, entry*0.95) clamp 3-8%
  tp1 = nearest_resistance ; rr = (tp1-entry)/(entry-stop)
  if rr < seuil_regime : drop
  émettre {..., strategy:'PEAD', source:'pead_pool'}
```

#### Backtest de validation

- **Named strategy proche** : `RunBacktest(strategy="momentum_expansion", symbols=<cohorte de beats>, from, to)`
  ne capte pas la guidance ; utiliser plutôt un **custom pass_expr** approximant le drift technique
  (`gap_pct() >= 3 && vol_spike45(1.5) && ext_ema20 <= 8`) via
  `RunBacktest(pass_expr="gap_pct() >= 3 && close > ema20 && vol > 1500000", symbols=…)` pour borner
  l'espérance **technique** ; la couche guidance/beat est validée **hors-DSL** par backtest event-study
  sur les cohortes historiques de beats (données `earnings_quarterly` + `bars_daily`).
- **Métrique cible** : sur cohorte de prints « beat + guidance up + gap tenu », drift moyen D+5/D+20 > 0
  et win-rate TP1 > 55 % en RISK-ON. Consigner dans `config/event-driven/_sanity-baselines.json` (voir §4.2).

---

### 2.2 Brique 2 — Filings scanner (8-K / S-1 / insider US + AMF EU)

**But** : capter les catalyseurs réglementaires datés — **cluster-buy d'insiders** (signal haussier
robuste), **8-K matériel** (contrat, M&A, résultat préliminaire), et **flag S-1/S-3** (dilution =
signal *négatif* → filtre, pas idée). C'est un scanner **hybride** : il produit des idées longues
(insider cluster-buy) **et** alimente le filtre anti-dilution des autres pools.

#### Signal

- **Insider cluster-buy (idée longue)** : ≥ 2 insiders distincts, transactions code **P (Purchase)**,
  fenêtre ≤ 30j, montant net acheteur significatif, sur un titre en base technique (au-dessus EMA50 ou en
  reclaim). `strategy:'InsiderCluster'`.
- **8-K catalyseur (idée longue, bonus)** : 8-K matériel récent + réaction prix positive tenue + volume →
  se rabat sur la logique gap/PEAD pour les niveaux. `strategy:'FilingCatalyst'`.
- **Dilution (négatif — PAS une idée)** : S-1/S-3/424B < 90j, ATM actif, underwriter toxique, warrants ITM
  imminents → **écrit dans un sous-objet `filings_flags`** consommé comme *disqualifiant* par les autres
  pools (déjà la sémantique de `flags.dilution_risk_score` dans `validate-scan.js`).

#### Données MCP requises (voie B) — **et surtout : ce qui n'est PAS accessible**

| Marché | Donnée | Accessible ? | Appel |
|--------|--------|--------------|-------|
| **US** | Cluster-buy insiders (ranking) | ✅ | `GetInsiderActivity(days=14, direction="buy", include_transactions=true)` (async → poll `Jobs`) |
| **US** | Form 4 individuels (event-study) | ✅ | `QueryData(types="insider_transactions", symbols=…)` (code P/S uniquement comptés) |
| **US** | 8-K / S-1 / S-3 / 424B | ✅ | `QueryData(types="sec_filings", form_types="8-K,S-1,S-3,424B", symbols=…)` |
| **US** | Flags dilution agrégés | ✅ | `QueryData(types="flags", symbols=…)` → `dilution_risk_score`, `atm_program_active`, `shelf_active`, `warrants_outstanding` |
| **US** | Score composite catalyseur | ✅ | `GetSymbolSignals(symbol=…)` → `insider_buy`, `analyst_upgrade`, `options_flow` (⚠️ `sec_filing`/`dilution` lisent *absent* sur ce chemin — non câblés) |
| **EU (.PA)** | Dépôts réglementés AMF (Info-Financière) | ⚠️ **partiel** | `QueryData(types="eu_filings", symbols="XXXX.PA")` — communiqués/OPA/franchissements de seuils |
| **EU** | **Transactions dirigeants (PDMR)** | ❌ **NON DISPONIBLE** | Le feed AMF Info-Financière **ne couvre pas** les déclarations PDMR/dirigeant (vérifié contre la table des sous-types AMF). **Il n'existe PAS d'analog EU à `insider_transactions`.** |
| **EU (hors .PA)** | Filings (Xetra, LSE, Euronext AMS/BRU…) | ❌ | `eu_filings` = **Euronext Paris `.PA` uniquement** (ISIN résolu depuis la staticdata FR). |
| **EU** | CTB / dark pool / short interest | ❌ (US-only) | `GetSymbolSignals` renvoie 0/0 par construction pour un listing EU. |

> **Conséquence de design (à écrire noir sur blanc dans l'implémentation)** :
> - L'**insider cluster-buy comme idée longue est un signal US-only.** Pour l'EU, le scanner filings ne
>   produit **que** le volet 8-K-like (`eu_filings` Paris) en *contexte/flag*, jamais un cluster-buy PDMR.
> - Le pool `filings_pool` porte un champ `market` (`us`|`eu`) ; les consommateurs EU/PEA ne reçoivent
>   jamais un signal insider fabriqué faute de donnée (**MCP hard-stop, zéro invention**).

#### DSL / logique

Pas de DSL RunScreener côté cluster-buy (donnée hors-bars). Logique node `tools/filings-scanner.js`
sur les JSON stagés :

```
# volet idées longues (US)
pour chaque ticker de GetInsiderActivity(direction=buy) :
  if insiders_distincts < 2 || net_usd < seuil : drop
  if !above_ema50(ticker) && !reclaim(ticker) : drop
  score = 62 + min(insiders_distincts,5)*5 + (net_usd_tier) + (analyst_upgrade?6:0)  # cap 98
  niveaux via technicals ; gates stop/rr/penny/sharia hérités
  émettre {strategy:'InsiderCluster', market:'us', source:'filings_pool'}

# volet flags dilution (US + EU.PA) — écrit filings_flags{ticker:{...}}, PAS un signal
pour chaque candidat des AUTRES pools :
  lire flags/sec_filings/eu_filings stagés → dilution_risk_score, atm_active, shelf_active…
  filings_flags[ticker] = {dilution_risk_score, disqualify:bool, reason}
```

#### Backtest de validation

- **Event-study insider** : cohorte de cluster-buys historiques (`insider_transactions` code P, ≥ 2
  insiders) → `QueryData(types="bars_daily")` → drift D+20 > 0, win-rate. **Pas** un `RunBacktest` DSL
  (le signal n'est pas dérivable des bars). Baseline consignée en §4.2.
- **Flags** : validés par la **non-régression** — un candidat flaggé disqualifiant qui aurait été un stop
  évité (compte des « dilutions ratées évitées » vs `data/backtest-trades.json`).

---

### 2.3 Brique 3 — Gap-and-go pré-marché

**But** : jouer la continuation d'un gap haussier au **pré-marché** (news/catalyseur overnight, momentum
pré-open) — la brique la plus « DevOps » car **entièrement mécanique et fetch-direct** (pas de donnée
propriétaire indispensable pour le screening de base).

#### Signal

Émettre `GapAndGo` pour un ticker qui, **au pré-marché du jour de séance** :
1. **Gap haussier** : `gap_pct() ≥ +4 %` vs close veille (paramétrable par régime).
2. **Volume pré-marché anormal** : pré-market vol ≥ X× la normale (proxy DevOps : bougies pré-open).
3. **Au-dessus d'un niveau clé** : gap au-dessus de la résistance veille / plus-haut récent (pas dans le vide).
4. **Float / liquidité** : dollar-volume normal ≥ $1M (garde penny/illiquide) — small-cap OK (edge capacity),
   penny < $5 rejeté.
5. **Pas de gap d'earnings non désiré** : si le gap = earnings, il **rejoint le pool PEAD** (dedup, un
   ticker jamais dans deux pools) — le pool gap ne prend que les gaps **non-earnings** (news/momentum).

**Fenêtre / horizon** : entrée sur **tenue au-dessus du VWAP d'ouverture / cassure du plus-haut pré-marché**
(logique documentée `vwap-entry-gate` + `gap-up-preflight-phase2` de `scanner-lessons.json`) ; horizon
court H5–H10 ; `stop` sous le VWAP d'ouverture ou plus-bas du gap ; R/R ≥ seuil régime.

> ⚠️ Ce scanner produit un **signal daté pour la séance à venir** ; l'« entrée pré-marché » est une
> *règle de niveau*, **jamais** un ordre. La perf est **simulée** par `sweep.js` comme tout autre pool.

#### Données requises (voie A — fetch direct, comme momentum-scanner)

- **Bougies journalières + pré/post** : Yahoo (via `tools/lib/price-cache` + fetch existant) pour gap,
  ATR14, EMA20, VWAP, plus-haut récent. **Aucun token MCP requis** → tourne en subprocess node pur.
- **Enrichissement optionnel (voie B, si agent dispo)** : `QueryData(types="quote,unusual_options,news")`
  pour distinguer gap-news d'un gap technique et booster le score. Dégradation gracieuse si absent.
- **Exclusion earnings** : `GetEarningsCalendarFiltered` (fenêtre) pour router les gaps d'earnings vers PEAD.

#### DSL / logique

```
# tools/gap-scanner.js — fetch direct
pour chaque ticker de l'univers local (data/*-universe.json) :
  gap = (preopen_or_open / prev_close - 1)*100
  if gap < 4 : continue
  if dollar_vol < 1_000_000 || price < 5 : continue
  if !above_prev_resistance : continue
  if is_earnings_gap(ticker) : continue        # → traité par PEAD, dedup
  entry = vwap_open_est ; stop = min(vwap_open_est*0.97, low_est) clamp 3-8%
  tp1 = mesure_du_gap|nearest_resistance ; rr = (tp1-entry)/(entry-stop)
  if rr < seuil_regime : continue
  score = 58 + gap_tier + vol_tier + (news_confirm?6:0)   # cap 98
  émettre {strategy:'GapAndGo', source:'gap_pool'}
```

#### Backtest de validation

- **RunBacktest DSL direct** (le signal EST dérivable des bars) :
  `RunBacktest(pass_expr="gap_pct() >= 4 && close > hhv('high',20) && vol > 1500000", symbols=<top gappers>, from, to)`
  → CAGR / Sharpe / max_dd / win-rate / profit_factor réels, per-year. C'est le backtest **le plus propre**
  des trois car sans dépendance guidance/filings.
- **Baseline** consignée en §4.2 ; un gap-and-go qui ne bat pas un buy-and-hold SPY sur la fenêtre = mode
  laissé en `draft`.

---

### 2.5 Schéma de sortie (`signals.json`)

Chaque scanner **ajoute sa clé de pool** au `signals.json` existant, sans toucher aux autres. Shape d'un
item de pool (identique aux pools actuels, cf `scanner-parser.mapSignal`) :

```json
{
  "ticker": "XXXX", "name": "XXXX", "score": 84,
  "strategy": "PEAD",                 // PEAD | InsiderCluster | FilingCatalyst | GapAndGo
  "source": "pead_pool",             // pead_pool | filings_pool | gap_pool
  "market": "us",                    // us | eu   (filings/gap : gate PEA côté EU)
  "region": "us", "sector": "Technology",
  "entry": 111.0, "stop": 106.5, "tp1": 121.6, "tp2": 128.9, "rr": 2.4,
  "horizon": 10, "sharia": true,
  "catalyst": { "type": "earnings_beat", "date": "2026-07-09",
                "detail": "EPS beat + guidance up, gap +5.2% tenu" },
  "thesis": "…"
}
```

Bloc racine ajouté à `signals.json` :

```json
{
  "regime": "…", "regimeScore": 82,
  "signals": [ … ], "momentum": [ … ], "breakout": [ … ],
  "pead_pool":    [ … ],
  "filings_pool": [ … ],
  "filings_flags": { "ABCD": { "dilution_risk_score": 78, "disqualify": true, "reason": "S-3 shelf active" } },
  "gap_pool":     [ … ],
  "_scanRuns": {
    "pead":    { "signals": 4, "universeFetched": 62, "at": "…" },
    "filings": { "signals": 2, "universeFetched": 25, "at": "…" },
    "gap":     { "signals": 6, "universeFetched": 3512, "at": "…" }
  }
}
```

---

## 3. Intégration

### 3.1 `/scanner` (pipeline quotidien)

Ajouter, dans la séquence append-only de `scanner-pipeline.md` (§ Pipeline Quotidien), **avant `sweep.js`** :

```bash
# ── Event-driven pools ────────────────────────────────────────────────────────
# GAP : fetch direct (voie A) — subprocess node pur, aucun token MCP
node tools/gap-scanner.js --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --min-gap 4 --top 15

# PEAD + FILINGS : voie B (staging AGENT → ingest). Étape AGENT AVANT le script :
#   agent → GetEarningsCalendarFiltered / QueryData(earnings_quarterly,analyst_actions,technicals,flags)
#           GetInsiderActivity(direction=buy) / QueryData(insider_transactions,sec_filings,eu_filings)
#        → écrit /tmp/pead-stage.json et /tmp/filings-stage.json (JSON bruts MCP)
node tools/pead-scanner.js    --ingest /tmp/pead-stage.json    --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --top 10
node tools/filings-scanner.js --ingest /tmp/filings-stage.json --output signals --date YYYYMMDD --folder FOLDER --regime REGIME --top 10
```

- **Gap** tourne partout (local + cloud `claude -p`), sans MCP → jamais bloquant.
- **PEAD/filings** : si l'étape AGENT MCP échoue → **NE PAS ingérer**, laisser le pool absent, **alerter**
  (`send_message(to='alerts', …)`), marquer le run incomplet. Jamais de pool fabriqué. (Même discipline
  anti-skip-silencieux que le refresh dtx.)
- **Dedup inter-pools** : un ticker gap-d'earnings va en `pead_pool`, jamais en `gap_pool` (règle dans
  `gap-scanner.js`). Un ticker jamais dans deux pools.

### 3.2 `tools/lib/scanner-parser.js`

Dans `loadSignals()`, ajouter les trois pools sur le modèle exact de `forex_pool` :

```js
const peadPool    = poolFrom('pead_pool');     // stampe source='pead_pool'
const filingsPool = poolFrom('filings_pool');
const gapPool     = poolFrom('gap_pool');
const filingsFlags = data.filings_flags || {};
// … return { …, peadPool, filingsPool, gapPool, filingsFlags };
```

**Ne PAS** merger ces pools dans `signals[]` composite (ce sont des modes dédiés, comme crypto/metals/forex).
`filings_flags` est exposé pour que la validation des autres pools puisse disqualifier un candidat dilué.

### 3.3 `data/modes-config.json` (nouveaux modes, en `draft`)

Ajouter trois modes **en `status:"draft"`** (jamais `live` sans backtest walk-forward — §4). Modèle
aligné sur les modes asset-class :

```json
"pead": {
  "status": "draft", "label": "PEAD", "goal": "Post-Earnings Drift",
  "assetClass": "pead", "filterName": "pead_drift", "minScore": 78,
  "portfolioSize": 3, "topN": 3, "horizon": 12,
  "maxStopPct": 8, "atrStopMult": 2, "sizingMethod": "inverse_atr", "targetRiskPct": 0.8,
  "regimeFilters": { "risk_on": "pead_drift", "risk_off": "none" }
},
"filings": {
  "status": "draft", "label": "Filings", "goal": "Insider & Catalyst",
  "assetClass": "filings", "filterName": "filings_catalyst", "minScore": 80,
  "portfolioSize": 3, "topN": 3, "horizon": 15, "maxStopPct": 8, "sizingMethod": "inverse_atr"
},
"gap": {
  "status": "draft", "label": "Gap&Go", "goal": "Premarket Gap Continuation",
  "assetClass": "gap", "filterName": "gap_and_go", "minScore": 75,
  "portfolioSize": 2, "topN": 2, "horizon": 6, "maxStopPct": 8, "sizingMethod": "inverse_atr"
}
```

> **Cohérence source↔assetClass** : `gen-status-page.signalsFor()` gate un mode asset-class sur
> `s.source === cfg.assetClass + '_pool'`. Donc `assetClass:"pead"` ⇒ le pool DOIT porter
> `source:"pead_pool"` (idem `filings`/`gap`). Respecter cette convention à la lettre.

### 3.4 `tools/gen-status-page.js`

1. **Filtres de stratégie** — ajouter au map `SF` (≈ ligne 885) :
   ```js
   pead_drift:      s => /^PEAD$/i.test(s),
   filings_catalyst:s => /^(InsiderCluster|FilingCatalyst)$/i.test(s),
   gap_and_go:      s => /^GapAndGo$/i.test(s),
   ```
2. **Labels** — ajouter à `filterLabel()` (≈ ligne 899) : `pead_drift:'PEAD Drift'`,
   `filings_catalyst:'Insider & Catalyst'`, `gap_and_go:'Gap & Go'`.
3. **Gate asset-class** — `signalsFor()` (≈ ligne 942-955) reconnaît déjà `source === ac+'_pool'` ; les
   trois nouvelles `assetClass` (`pead`/`filings`/`gap`) y passent sans code neuf (vérifier `curOf` = USD
   par défaut, OK). Étendre la liste des classes pool-backed si elle est en dur.
4. **Pas de dtx** : ces modes ne passent **pas** par `DTX_STAGING_MAP` (ce sont des JS-scanners, pas des
   configs systematic). Ils tombent dans le chemin « JS-scanner signal pool » (≈ ligne 1088) comme forex.

### 3.5 `tools/sweep.js`

`sweep.js` consomme `scannerParser.loadSignals(dir)`. Pour que les trois modes soient **pré-simulés
(backtest append-only)**, câbler leur pool dans l'assemblage de candidats **exactement comme forex_pool**
(source-tagué, sélection per-mode via `filterName` + `assetClass`, frozen config). Vérifier :
- Les trades event-driven atterrissent dans `data/backtest-trades.json` via le **même chemin append-only**
  (chaîne SHA-256 intacte — `sweep.js` avorte sur violation).
- Le splice frozen (`frozenKeyOfCfg`) fonctionne : tant que le mode est `draft`, il est pré-simulé mais
  **non affiché live** (statut gate `['live','pausing']` côté page — `sim-live`=`live`).

> ⛔ **Scope état — pas de `deploying`.** La borne systematic (north-star + `systematic-loop-sim.md §7.1`)
> **exclut** `deploying` (ramp paper-broker, `execMode='paper-ramp'`) et `liquidated` de cette boucle SIM.
> La promotion suit **`draft → test → sim-live`** (=`live`, alias sémantique sim), via le wrapper
> `simTransitions` qui court-circuite `deploying`. **Ne jamais** router un mode event-driven vers
> `deploying`/`liquidated`.

### 3.6 `scanner/status` + widgets + API

- `gen-status-page.js` rend automatiquement un panneau par mode `live`/`pausing` (`sim-live`). Tant que
  `draft`/`test`, les modes sont **pré-simulés mais masqués** — parfait pour la phase de validation SIM.
- `gen-api.js` : les endpoints per-mode se génèrent depuis `modes-config` → 3 nouveaux JSON publics quand
  les modes passent `test → sim-live` (=`live`). Rien à coder si la convention pool/source est respectée.
- **Registre de signaux (optionnel)** : pousser les signaux émis dans `data/signals-ledger.json` via
  `node tools/signals-ledger.js append --payload …` pour un track-record forward append-only indépendant
  du backtest sweep (statuts `open→triggered→tp1/tp2/stopped`, R réalisé). Utile pour la boucle
  d'amélioration (leçons par famille × régime).

### 3.7 Déclenchement horaire / webhook (design SIM-ONLY)

**Aucun ordre.** Les « déclencheurs » ne font que **régénérer des signaux + perf simulée** :

| Brique | Fenêtre naturelle | Mécanisme (design) |
|--------|-------------------|--------------------|
| **PEAD** | Post-close (après les prints AMC) + pré-open (prints BMO) | cron/schedule existant du bot (`schedules.json`) — étape AGENT MCP puis ingest. |
| **Filings** | Intra-journée (8-K/Form 4 arrivent en continu) | webhook possible (design) : un push SEC/EDGAR → relance `filings-scanner` **en mode génération de signaux seulement**. |
| **Gap** | Pré-marché (~13h30–15h30 Paris) | cron pré-open : `gap-scanner.js` fetch-direct, aucun MCP → tourne headless. |

Le webhook/cron **écrit `signals.json` + relance `gen-status-page`/`gen-api`**. Il **n'appelle jamais** un
outil `rb_paper_*` / `rb_live_*` / `sim_place_order`. La frontière est nette : *génération de signaux et de
perf simulée* d'un côté, *exécution* (hors scope) de l'autre.

---

## 4. Gates de sûreté

### 4.1 Backtest walk-forward AVANT toute promotion `draft → test → sim-live`

Règle projet (`feedback_config_change_backtest`, `feedback_regime_aware_eval`) : **jamais** un mode `live`
sans backtest qui bat sa baseline, évalué **par régime + walk-forward** (jamais replay uniforme plein-période).

- **Gap** : `RunBacktest(pass_expr=…)` direct + walk-forward par sous-périodes (RISK-ON/NEUTRAL/ERO).
  Critère : bat SPY buy-and-hold sur la fenêtre ET max_dd ≤ 8 % (`project_mode_success_criteria`).
- **PEAD** : event-study cohortes de beats + `RunBacktest` technique d'appoint. Critère : drift D+5/D+20 > 0
  et win-rate TP1 > 55 % en RISK-ON.
- **Filings** : event-study cluster-buy (drift D+20 > 0). Le volet flags est validé par non-régression
  (stops évités).

Promotion **sim-only** `draft → test → sim-live` (=`live`) via
`node tools/set-mode-status.js --mode <m> --to test|live --reason … --review YYYY-MM-DD` — **jamais**
`--to deploying` (état paper-broker hors scope, cf. §3.5 + `systematic-loop-sim.md §7.1`).

### 4.2 Sanity gate déterministe (données aberrantes)

Créer `config/event-driven/_sanity-baselines.json` (analogue à `config/dtx/_sanity-baselines.json`) avec,
par mode : bornes `max_dd`, `sharpe`, `win_rate`, `cagr`, `total_trades` (2,2× / 0,4× le baseline). Le
script d'ingest / le sweep marque `metricsSuspect:true` si franchies, et **`qa-check.js` échoue en dur**.
Tripwires universels si pas de baseline (`|max_dd|>50 %`, `sharpe<0`, `win_rate∉[15,92]`).

### 4.3 Immutabilité & append-only

- `sweep.js` : trades event-driven soumis à la **même chaîne SHA-256** (`trade-chain.json`) — jamais de
  réécriture d'un trade fermé. Le pré-sim frozen respecte `statusSince`.
- `data/signals-ledger.json` : append-only, un statut terminal n'est jamais réécrit.

### 4.4 QA (`tools/qa-check.js`)

Enregistrer les trois scanners dans `SCRIPT_SCANNER_MARKERS` :
```js
pead:    { keys: ['pead'] },
filings: { keys: ['filings'] },
gap:     { keys: ['gap'] },
```
→ un mode `live` dont le marqueur `_scanRuns['pead'|'filings'|'gap']` est absent du dernier `signals.json`
= ❌ (crash silencieux). **0 signal reste légitime** (jour sans catalyseur), marqueur présent = preuve de run.
Gap : garde `universeFetched ≥ 100` (source data OK) comme pour bull.

### 4.5 Anti-hallucination & no-skip (rappels durs)

- **Zéro fabrication** de données financières (`feedback_no_hallucination`) : EPS/guidance/gap/filing/Form 4
  = MCP uniquement. PEAD/filings sans staging MCP → pool absent + alerte, **jamais estimé**.
- **EU/PEA** : ne jamais émettre un signal insider EU (donnée PDMR inexistante, §2.2). Absence de donnée ≠
  absence de risque — on ne comble pas le trou.
- **No-skip** : aucune étape (dilution, earnings-window, Sharia, validation) skippée sans accord explicite.
- **Content QA** : si un article/carte scanner référence ces pools → `node tools/qa-content.js <path> --strict`.

---

## 5. Critère de « fait » (definition of done)

Le lot est **fait** quand, **sans jamais placer un ordre** :

1. **Trois scanners** livrés : `tools/gap-scanner.js` (voie A), `tools/pead-scanner.js` +
   `tools/filings-scanner.js` (voie B, ingest). Chacun écrit son pool + son marqueur `_scanRuns` dans
   `scanner/YYYYMMDD/signals.json`.
2. **Parser** : `tools/lib/scanner-parser.js` expose `peadPool`/`filingsPool`/`gapPool`/`filingsFlags`
   (source stampé, non merge composite).
3. **Modes** : `pead`/`filings`/`gap` en `draft` dans `data/modes-config.json` (convention
   `assetClass↔source` respectée).
4. **Status page** : `gen-status-page.js` a les entrées `SF` + `filterLabel` ; les modes sont pré-simulés
   (masqués tant que `draft`). `sweep.js` les pré-simule via le chemin frozen append-only.
5. **Backtests** : gap validé par `RunBacktest` DSL ; PEAD/filings par event-study MCP ; baselines écrites
   dans `config/event-driven/_sanity-baselines.json`. Aucun mode promu `sim-live` sans battre sa baseline
   (walk-forward par régime, max_dd ≤ 8 %).
6. **QA vert** : `tools/qa-check.js` reconnaît les trois marqueurs, 0 ❌ ; sanity gate déterministe câblé ;
   chaîne SHA-256 intacte.
7. **Pipeline** : `/scanner` (local + `claude -p` cloud) exécute les trois étapes ; échec MCP PEAD/filings
   → pool absent + alerte + run marqué incomplet (jamais fabriqué). Gap tourne headless sans MCP.
8. **Zéro exécution** : aucun appel `rb_paper_*`/`rb_live_*`/`sim_*` dans le code livré. La seule sortie est
   `signals.json` + perf simulée (sweep) + page/API `scanner/status`.

---

## 6. Fichiers concrets à toucher

| Fichier | Action |
|---------|--------|
| `tools/gap-scanner.js` | **Créer** — fetch direct (modèle `momentum-scanner.js`), écrit `gap_pool` + `_scanRuns['gap']`. |
| `tools/pead-scanner.js` | **Créer** — ingest staging MCP, écrit `pead_pool` + `_scanRuns['pead']`. |
| `tools/filings-scanner.js` | **Créer** — ingest staging MCP, écrit `filings_pool` + `filings_flags` + `_scanRuns['filings']`. |
| `tools/lib/scanner-parser.js` | Ajouter `poolFrom('pead_pool'|'filings_pool'|'gap_pool')` + `filings_flags` au retour de `loadSignals()`. |
| `data/modes-config.json` | Ajouter modes `pead`/`filings`/`gap` en `status:"draft"`. |
| `tools/gen-status-page.js` | Ajouter entrées `SF` + `filterLabel` ; vérifier gate asset-class + chemin JS-scanner. |
| `tools/sweep.js` | Câbler les 3 pools source-tagués dans l'assemblage candidats (modèle `forex_pool`). |
| `tools/qa-check.js` | Ajouter `pead`/`filings`/`gap` à `SCRIPT_SCANNER_MARKERS`. |
| `data/scanner-filters.json` | Ajouter seuils event-driven (min-gap, vol-ratio pré-marché, insider-cluster N/min-usd) — source de vérité lue par scanners + sweep. |
| `config/event-driven/_sanity-baselines.json` | **Créer** — bornes sanity par mode (analogue dtx). |
| `.claude/skills/scanner-pipeline.md` | Documenter les 3 étapes dans le pipeline quotidien + discipline anti-skip PEAD/filings. |
| `.claude/skills/earnings-reaction.md` | Renvoi croisé : le skill éditorial POST = version manuelle du scanner PEAD. |
| `tools/signals-ledger.js` | (optionnel) alimenter le track-record forward append-only des signaux émis. |
