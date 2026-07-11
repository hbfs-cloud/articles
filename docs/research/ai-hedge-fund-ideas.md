# Plan d'adoption — idées de `virattt/ai-hedge-fund` pour notre stack

_Source : recherche 5 angles (archi-agents, signaux-analystes, backtester-data, portfolio-risk, pièges-limites) sur https://github.com/virattt/ai-hedge-fund. Toutes les mécaniques citées sont `verified=true` (lues dans le code du repo)._

**Borne projet (immuable) :** on s'arrête à **la simulation + les signaux**. Pas de paper/live broker. Public cible = retail EU peu capitalisé (edges capacity / fiscal-PEA / API / event-driven). **Zéro fabrication** : nos chiffres viennent du MCP (QueryData / RunScreener / GetInstruments / OptionsAnalytics / PortfolioRisk), jamais d'un LLM qui devine. MCP HARD STOP en cas de données stale/incohérentes.

---

## 1. Ce qu'est — et n'est PAS — ai-hedge-fund

**Ce que c'est :** un proof-of-concept éducatif qui orchestre ~19 agents dans un **LangGraph `StateGraph`** (DAG réel, pas une boucle maison). Topologie fan-out/fan-in : `start_node → N analystes EN PARALLÈLE → risk_management_agent → portfolio_manager → END`. État partagé = `AgentState` (TypedDict à 3 champs avec reducers annotés : `messages` concaténé via `operator.add`, `data` et `metadata` fusionnés via `merge_dicts`). Chaque analyste écrit sous sa propre clé `data['analyst_signals'][agent_id]` → pas de collision, écriture parallèle sans lock.

Les analystes sont **13-14 personas d'investisseurs célèbres** (Buffett, Graham, Munger, Burry, Lynch, Fisher, Ackman, Cathie Wood, Druckenmiller, Damodaran, Pabrai, Taleb, Jhunjhunwala) + 4 agents « quant » (valuation, fundamentals, sentiment, technicals) + risk_manager + portfolio_manager.

**Le pattern-clé (à retenir) :** chaque persona est **~75 % code déterministe / ~25 % LLM**. Le gros du travail (`warren_buffett.py` ≈ 850 lignes) est du **scoring Python en dur** — ratios, seuils, DCF — qui produit un **score chiffré**. Le LLM n'intervient qu'à la fin pour **synthétiser des `facts` pré-calculés** en `{signal: bullish|bearish|neutral, confidence: 0-100, reasoning}`, avec **interdiction explicite d'inventer**. Le **risk_manager est 100 % code, zéro LLM** (sizing vol + corrélation + NLV). Le portfolio_manager pré-calcule `compute_allowed_actions()` (actions permises + quantité max par cash/marge) **puis** un LLM choisit une action *dans un menu déjà borné* — il ne peut structurellement pas sur-dimensionner.

**Ce que ce n'est PAS (verbatim README) :** *« for educational and research purposes only. Not intended for real trading… the system does not actually make any trades. »* Aucune exécution, aucun broker. Et — angle pièges — **le backtest LLM-in-the-loop est structurellement contaminé** : aucune `temperature`/`seed` fixe (non reproductible run-à-run), fallback silencieux `create_default_response()` qui avale les échecs LLM en valeurs par défaut, knowledge-leak du cutoff LLM (les personas « connaissent » l'issue des titres historiques), coût = jours × tickers × N personas × 1 appel LLM payant. **Rien de tout ça ne transpose chez nous.** Notre moteur dtx/systematic-tss (déterministe, replay reproductible) est supérieur pour tout backtest chiffré.

**En une phrase :** on ne vole PAS leur boucle LLM ni leur backtest ; on vole leur **séparation nette math/jugement** et leurs **grilles de scoring déterministes**, qu'on alimente en données MCP — ce qui les rend *plus* robustes chez nous que chez eux (nos chiffres sont vérifiés, pas hallucinés).

---

## 2. Idées à reprendre — priorisées (fort ROI / faible risque d'abord)

Légende effort : **S** = quelques heures · **M** = 1-2 jours · **L** = 3-5 jours.

### #1 — Panel de personas-investisseurs 100 % déterministe (QUICK WIN) — effort **M**
**Où ça s'embarque :** nouvel **axe de score dans le scanner** + **nouveau persona dans le harness `senior-review`** (le « Value/Quality Board »). Détaillé en §4.
**Quoi :** porter en Python pur les **grilles de seuils** des personas quant (pas les prompts LLM). Elles sont directement exposables via nos champs MCP :
- **Buffett** : ROE>15 %, dette/eq<0.5, op margin>15 %, current ratio>1.5.
- **Graham** : Graham Number = √(22.5 × EPS × BVPS), NCAV>mcap (net-net), stabilité EPS.
- **Lynch (GARP)** : PEG<1 excellent / 1-2 fair / >3 cher.
- **Munger** : ROIC>15 % sur ≥80 % des périodes, FCF/net income>1.1, capex<5 % du CA.
- **Burry (deep-value contrarian)** : FCF yield ≥15 %→+4, EV/EBIT<6x, net cash, insider net buying.
Chaque persona produit `{signal, confidence, reasoning}` où **le chiffre est calculé, le reasoning est un gabarit factuel** (pas de LLM requis ; si narration éditoriale voulue, LLM en synthèse-seulement avec interdiction d'inventer).
**Sim-only / zéro-hallu :** aucune décision d'ordre, juste un score consultatif ; toutes les entrées viennent de `QueryData`/`GetInstruments`/`GetSymbolSignals`. MCP HARD STOP si un ratio est stale.
**ROI :** très haut — enrichit *chaque* analyse ticker + le scanner sans nouveau moteur, colle à `feedback_aplus_grading_empirical`.

### #2 — Schéma de signal pivot uniforme `{signal, confidence, reasoning}` pour signals-desk — effort **S**
**Où :** contrat commun aux générateurs `squeeze-radar` / `earnings-reaction` / `sector-rotation` / `macro-event-playbook` / `swing-signals`, agrégé par **signals-desk**.
**Quoi :** adopter le schéma Pydantic-like minimal `signal ∈ {bullish, bearish, neutral}`, `confidence: 0-100`, `reasoning: str` comme **format pivot** de tous nos skills de signaux. Un contrat unique rend les générateurs interchangeables et l'agrégation triviale (aujourd'hui chacun a sa forme).
**Sim-only / zéro-hallu :** pur formatage, aucune donnée nouvelle.
**ROI :** haut, effort minimal — débloque #3 et #6.

### #3 — Reducer `merge_dicts` sur un state partagé pour le desk multi-signaux — effort **S/M**
**Où :** **signals-desk** (le chef d'orchestre).
**Quoi :** répliquer le pattern `data['analyst_signals'][agent_id] = …` : chaque générateur écrit **sa propre clé** dans un state commun `{ticker: {source: {sig, conf, reasoning}}}`. Fusion par `{**a, **b}` → N sources écrivent sans se marcher dessus, agrégation = simple lecture. Pas besoin de LangGraph : un dict + une convention de clés suffit en Node/JS.
**Sim-only / zéro-hallu :** structurel, neutre.
**ROI :** haut — remplace toute glue ad-hoc du desk par un contrat propre.

### #4 — Module de sizing vol-adjusted + corrélation-aware (100 % code) — effort **M**
**Où :** **couche de sizing du scanner** (remplace/affine le `tiered mcap` actuel) + input du **persona Risk du harness**.
**Quoi :** porter `risk_manager.py` verbatim (aucun LLM) :
- `base_limit = 20 %` × **multiplicateur de volatilité** (vol<15 %→×1.25 ; 15-30 %→scalé 1.0→0.625 ; 30-50 %→0.75→0.5 ; >50 %→×0.5 ; **clampé 5-25 %**)
- × **multiplicateur de corrélation** aux positions/picks existants (≥0.80→×0.70 ; 0.60-0.80→×0.85 ; 0.40-0.60→×1.00 ; <0.20→×1.10 pour dé-concentrer)
- `position_limit = NLV × combined_pct` ; `max_size = min(remaining_limit, cash)`.
C'est **plus fin que notre tiered mcap** (`<$2B reject / $2-10B ×0.5 / $10-50B ×0.7`) : eux dé-concentrent par **corrélation aux positions ouvertes**, pas seulement par taille. `PortfolioRisk` MCP expose déjà corrélation + VaR → branchable directement.
**Sim-only / zéro-hallu :** pur numérique, aligné `feedback_tiered_mcap_oscillation` + `feedback_segment_replay`. Toute la mécanique d'argent reste hors LLM.
**ROI :** haut — améliore la qualité de sizing des picks simulés ; à valider via `validate-config-change.js` (backtest 30j obligatoire avant tout changement de config mode, cf `feedback_config_change_backtest`).

### #5 — Valuation multi-méthodes pondérée comme axe de score analyses — effort **M/L**
**Où :** **skill analyses par ticker** (remplace un DCF unique fragile) + axe optionnel du scanner.
**Quoi :** porter `valuation.py` : **DCF multi-étages 35 % + Owner Earnings 35 % + EV/EBITDA médian historique 20 % + Residual Income (EBO) 10 %**, avec scénarios **bear/base/bull 20/60/20**, WACC = CAPM (rf 4.5 % + β×6 %, coût dette via interest coverage, tax shield 0.75, **clampé [6 %,20 %]**), croissance haute plafonnée 25 % (10 % si mcap>50 Md), terminal 3 %. Signal = `weighted_gap = (valeur_modèle − mcap)/mcap` : bullish >+15 %, bearish <−15 %. **Confidence explicable** = `min(|gap|/0.30 × 100, 100)`.
**Sim-only / zéro-hallu :** inputs = financials MCP ; la fourchette de scénarios remplace un point-estimate trompeur. Aucun chiffre inventé.
**ROI :** moyen-haut mais effort plus lourd (owner earnings + EBO à câbler sur nos champs). Excellent pour les analyses institutionnelles.

### #6 — Confidence explicables + agrégation confidence-weighted DÉTERMINISTE — effort **S/M**
**Où :** **signals-desk** (agrégation) + digests Telegram/Substack.
**Quoi :** deux briques. (a) **Formules de confidence auditables** : `min(|gap|/0.30 × 100, 100)` et `(max(bull,bear)/N) × 100` — bien mieux qu'une « confidence LLM opaque » pour justifier un chiffre publié. (b) **Correctif du gap qu'ils ont** : chez eux l'agrégation des convictions n'a **aucune pondération** (le LLM du PM tranche seul, non reproductible). Pour un desk systématique, on fait l'**inverse** : agrégation confidence-weighted (ou vote pondéré) **en code** → reproductible et auditable. C'est un anti-pattern du repo qu'on corrige à notre avantage.
**Sim-only / zéro-hallu :** déterministe par construction.
**ROI :** haut pour la crédibilité éditoriale (chaque chiffre justifiable), colle à `EDITORIAL_STYLE`.

### #7 — Menu d'actions pré-borné `compute_allowed_actions` avant tout décideur — effort **M**
**Où :** **gating du scanner** + tout futur agrégateur qui « choisit » (même sans LLM).
**Quoi :** répliquer l'idée : le **code** calcule d'abord l'ensemble des actions permises + quantité max (cash / limites risk / sizing tiered) ; si rien n'est actionnable → **`hold` pré-rempli sans appeler le décideur**. Le décideur (règle ou LLM édito) choisit *dans* un ensemble déjà filtré, **jamais au-delà**. + **fallback sûr = `hold` partout** en cas d'échec (dégradation sûre, jamais agressive). Renforce nos gates numériques et le MCP HARD STOP.
**Sim-only / zéro-hallu :** structurel.
**ROI :** moyen-haut — garde-fou générique réutilisable.

### #8 — Clé de cache qui encode le `end_date` (point-in-time) pour nos rétros — effort **S/M**
**Où :** staging `data/dtx/*.json` + enrichissements MCP des **rétrospectives**.
**Quoi :** leur seule garantie anti-look-ahead solide = **`end_date` dans la clé de cache** (chaque as-of date = entrée dédiée) + filtrage serveur `report_period_lte` / `filing_date_lte`. À reprendre pour éviter qu'un fork agent voie un filing postérieur à la date du setup (leçons **IOVA/INDO**). **NE PAS copier** leur cache 100 %-mémoire sans persistance (une entrée par (ticker, jour) → explosion mémoire + appels redondants) : notre staging fichier + cache OHLCV chaud du MCP dtx est supérieur.
**Sim-only / zéro-hallu :** renforce la rigueur PIT de nos rétros.
**ROI :** moyen — surtout un durcissement anti-look-ahead.

---

## 3. À adapter prudemment / à ÉVITER

**À adapter (prendre l'idée, changer le moteur) :**
- **LLM non déterministe → nos gates numériques.** Leur signal final dépend du roleplay LLM (pas de seed/temperature, non falsifiable OOS). Chez nous : le chiffre est calculé en Python à partir du MCP, le LLM ne sert (au plus) qu'à la narration édito sous interdiction d'inventer. Nos checks NUMÉRIQUES du harness restent la source de vérité.
- **Look-ahead → notre PIT.** Reprendre `end_date`-dans-la-clé + `*_lte` serveur, mais garder **notre convention de date scanner (D+1/D+3)** qui gère les jours fériés marché — leur `freq='B'` pandas ne les gère pas.
- **Backoff 429** : reprendre le retry structuré mais **ajouter jitter** (le leur = `60 + 30×attempt`, bloquant, sans jitter).
- **Sizing short/marge** (`available_margin = equity/margin_requirement − margin_used`) : intéressant *seulement si* on ajoute un jour du short simulé ; hors borne pour l'instant.

**À ÉVITER (contre-exemples documentés) :**
- **Backtest LLM-in-the-loop** : non reproductible + knowledge-leak du cutoff + coût par-jour prohibitif. → on garde **dtx/systematic-tss**.
- **Fallback silencieux `create_default_response()`** qui avale les échecs LLM en valeurs « safe ». C'est exactement ce que notre **MCP HARD STOP interdit** : on **stoppe**, on ne substitue jamais. À documenter comme contre-exemple dans les lessons.
- **Agrégation des convictions sans pondération** (tout au LLM) : non auditable → on fait l'inverse (§#6).
- **Fills idéalisés sans slippage/commission/liquidité** : à garder en tête si on compare des perfs — ne pas présenter une perf simulée sans ce caveat.
- **Fournisseur de données tiers unique payant** (financialdatasets.ai) : non pertinent, on a le MCP.

---

## 4. QUICK WIN proposé (à faire en premier) — « Value/Quality Board » déterministe

**Idée #1 + #2 combinées, effort M.** Un module `personas-board` (Node/JS, aucun LLM requis) qui, pour un ticker, tire ses fondamentaux via MCP (`QueryData`/`GetInstruments`/`GetSymbolSignals`) et fait **voter 5 personas déterministes** — Buffett, Graham, Lynch, Munger, Burry — chacun via sa grille de seuils (§#1), chacun sortant `{signal, confidence, reasoning}` au **schéma pivot** (§#2).

**Ce que ça donne concrètement :**
- **Dans le scanner** : un **nouvel axe de score** consultatif « Value/Quality » (ex. `4/5 personas bullish, conf moy. 72`) qui complète nos éliminatoires A+, sans toucher au moteur de sélection.
- **Dans le harness `senior-review`** : un **nouveau persona reviewer « Value Board »** à checks NUMÉRIQUES (au même titre que Quant/Trader/Risk) — il flague une analyse qui affirme « qualité Buffett » alors que ROE<15 % ou dette/eq>0.5. Gate PASS/FIX/BLOCK.
- **Sur une analyse ticker** : un encart « ce qu'en penseraient 5 écoles d'investissement », **chiffré et vérifiable**, excellent pour l'édito FT/Economist et parfait anti-slop (chaque verdict est un fait calculé, pas une opinion d'IA).

**Pourquoi c'est le bon premier pas :** fort ROI, risque quasi nul (consultatif, aucune décision d'ordre), 100 % sim-only, 100 % zéro-hallucination (chiffres MCP), réutilise trois surfaces existantes (scanner, harness, analyses) sans nouveau moteur, et pose le **schéma pivot** qui débloque #3 et #6. Validation : passer 3-4 tickers connus, vérifier que les verdicts collent aux fondamentaux MCP, puis brancher le persona dans `senior-review`.

---

## Récap priorisé

| # | Idée | S'embarque dans | Effort | ROI |
|---|------|-----------------|--------|-----|
| 1 | Personas déterministes (grilles de seuils) | scanner (axe score) + harness (persona) | M | ★★★ |
| 2 | Schéma pivot `{signal, confidence, reasoning}` | signals-desk | S | ★★★ |
| 3 | `merge_dicts` state partagé multi-signaux | signals-desk | S/M | ★★★ |
| 4 | Sizing vol + corrélation (100 % code) | sizing scanner + persona Risk | M | ★★★ |
| 5 | Valuation multi-méthodes pondérée | analyses ticker | M/L | ★★☆ |
| 6 | Confidence explicables + agrégation pondérée déterministe | signals-desk + digests | S/M | ★★★ |
| 7 | `compute_allowed_actions` (menu pré-borné + hold sûr) | gating scanner | M | ★★☆ |
| 8 | Clé cache `end_date` (PIT) | staging dtx + rétros | S/M | ★★☆ |

**Quick win = #1 + #2 → « Value/Quality Board » déterministe** (5 personas votants, schéma pivot), branché dans scanner + harness senior-review + analyses. Aucun LLM décideur, zéro fabrication, sim-only.
