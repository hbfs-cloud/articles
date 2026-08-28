# DailyTickers - Scanner Instructions

## ⭐ Nouveau Pipeline (Future Scans) — JSON → HTML

### Flow
1. Claude génère `scanner/YYYYMMDD/data.json` (structure JSON uniquement)
2. `node tools/render-scanner.js scanner/YYYYMMDD/` génère `index.html`
3. `node tools/add_card.js scanner/YYYYMMDD/index.html`
4. `./tools/publish-daily-card.sh`

### Avantages
- -85% tokens LLM (JSON vs HTML brut)
- Structure garantie (plus de dérive de template)
- Design modifiable sans régénérer les données

### Ce que Claude doit générer (data.json)
Refer to `scanner/template/schema.json` for the full documented schema with all fields.

Claude génère UNIQUEMENT le `data.json`. Pas de HTML. Le renderer s'occupe de tout le reste.

Les champs obligatoires minimum :
- `date`, `session_label`, `regime`, `regime_score`, `regime_color`, `tags`
- `kpis` (vix, spx, avg_score, dominant_patterns)
- `intro`, `strategy`, `regime_prose`, `regime_strategy_weights`
- `market_snapshot`, `pedagogy`, `macro_calendar`, `sector_rotation`, `macro_thesis`
- `setups[]` — chaque setup requiert : `ticker`, `name`, `description`, `logo_gradient`, `price`, `change_pct`, `score`, `pattern`, `region`, `region_flag`, `region_label`, `sharia`, `radar_scores`, `entry_low`, `entry_high`, `stop`, `tp1`, `tp2`, `rr`, `horizon_days`, `thesis`, `confirmations[]`, `invalidations[]`

---

## 🖼️ IMAGE QUOTIDIENNE DISCORD/TELEGRAM — PROCÉDURE COMPLÈTE

### Flux Post-Scan (OBLIGATOIRE après chaque scan publié)

```bash
./tools/publish-daily-card.sh
```

Pipeline complet en 6 étapes (~6 min) :
1. `update-tracking.js` — Met à jour métriques + positions (prix live Yahoo)
2. `generate-scanner-image.js --telegram` — Génère image quotidienne + publie Telegram
3. `sweep.js` — Re-run backtest optimizer (126k combos, ~5 min)
4. `gen-3-cards.js` — Régénère les 3 PNG de mode avec timestamps (self-contained depuis backtest-trades.json)
5. `gen-status-page.js` — Régénère scanner/status/index.html (text-only, 5 tabs avec tableaux de trades)
6. `git commit + push` — Tout est poussé en un seul commit

Options :
- `--no-sweep` : skip étapes 3-5 (rapide, tracking + image seulement)
- `--dry-run` : skip publication Telegram

### Configuration Telegram (une seule fois)

Créer `/home/ci/projects/articles/.env` :
```
TELEGRAM_BOT_TOKEN=xxxx:yyyy
TELEGRAM_CHAT_ID=-100xxxxxxxxxx   # ID du groupe (avec le -100 au début)
```

Pour obtenir le Chat ID : ajoute `@userinfobot` au groupe Telegram, tape `/start`.

### Format de l'image (template validé 20/03/2026)

Structure en 5 blocs verticaux :
1. **Header brand** : Logo MW + date + régime + macro context + rappel N-1
2. **Guide lecteurs** : 4 points : Méthode · Rotation · Stats · Signal
3. **Top 3 signaux** : Charts FinViz + score + entry/stop/TP1/TP2/RR/horizon
4. **Portfolio Top 5** + Rotation en cours (J+1/J+2/J+3) + Capital
5. **Stats D0** : Return total · Max DD · Win Rate · Profit Factor · Equity curve
6. **Positions ouvertes** : symbole + return%, 5/ligne, fond coloré
7. **Footer** : disclaimer + URL scan + copyright

### Règles métier intégrées dans l'image

- **Short Squeeze exclu** de tous les signaux
- **Anti-doublon** : si ticker déjà ouvert → inéligible pour nouvelle entrée
- **Rotation max 2/j** : exit les 2 plus faibles scores si meilleurs candidats
- **Contrainte horaire** : exec à l'ouverture J+1 (15h30 Paris) ; sans cash → J+3
- **Stats depuis D0** (15 fév 2026), pas depuis 30j
- **MtM inclus** : return = réalisé + positions ouvertes

### Charts

Source : **FinViz** (candle + SMA50/200, RSI, MACD, Volume)
URL pattern : `https://finviz.com/chart.ashx?t=TICKER&ty=c&ta=1&p=d&s=l`
Fetch direct en HTTPS (PNG), pas besoin de Puppeteer pour les charts.
Fallback : placeholder coloré si le fetch échoue.

### Open Graph / Partage réseaux sociaux

Chaque page scanner inclut les meta OG :
```html
<meta property="og:title" content="Scanner MW — DATE — TOP TICKERS">
<meta property="og:description" content="Régime + stats clés">
<meta property="og:image" content="https://articles.dailytickers.com/scanner-daily-card.png">
<meta name="twitter:card" content="summary_large_image">
```

L'image `scanner-daily-card.png` est commitée dans le repo et accessible publiquement.
Lorsque quelqu'un partage le lien sur Telegram/WhatsApp, l'image s'affiche automatiquement en preview.

Pour ajouter un bouton de partage dans l'article HTML :
```html
<a href="https://t.me/share/url?url=URL&text=TEXT" target="_blank">Partager sur Telegram</a>
<a href="https://wa.me/?text=TEXT%20URL" target="_blank">Partager sur WhatsApp</a>
```

### Dépendances npm

```bash
npm install puppeteer form-data
```

---

## Article de Référence

**`scanner/20260219/index.html`** est la référence absolue pour le format, la structure HTML, les ECharts, et le style visuel. Tout nouveau scan DOIT suivre ce modèle exactement.

## 5. SCANNER QUOTIDIEN

> **Pour les nouveaux scans, générer `data.json` puis lancer le renderer. Voir section ⭐ ci-dessus.**

### Objectif
Article quotidien généré par le scanner algorithmique. Détecte automatiquement les meilleurs setups du jour en fonction du régime de marché (Risk-On, Neutral, Early Risk-Off, Risk-Off, Recovery). Supporte le multilangue et multi-niveau comme les analyses individuelles.
**Langue par défaut : anglais, niveau intermédiaire** (sauf demande contraire).

### Convention de Date (OBLIGATOIRE)

Le scanner tourne le soir pour la **prochaine séance de trading**. La date du dossier `YYYYMMDD` = la date de la séance couverte, PAS la date de génération :

| Génération | Séance couverte | Dossier |
|------------|----------------|---------|
| Lundi soir (après 22h30) | **Mardi** (D+1) | `scanner/YYYYMMDD/` du mardi |
| Mardi soir | **Mercredi** (D+1) | du mercredi |
| Mercredi soir | **Jeudi** (D+1) | du jeudi |
| Jeudi soir | **Vendredi** (D+1) | du vendredi |
| **Vendredi soir** | **Lundi** (**D+3**) | du lundi suivant |

**Règle simple :** Si l'heure locale est ≥ 22h30, le scanner est pour le **prochain jour de trading ouvrable**. Vendredi soir → lundi (weekend = marchés fermés).

### Structure URL
```
scanner/
├── YYYYMMDD/
│   ├── signals.json              # ⚠️ SOURCE DE VÉRITÉ — structured data (OBLIGATOIRE)
│   ├── index.html                # Default = intermediate/en (rendered from signals.json)
│   ├── variants.json             # Manifest des variantes
│   ├── expert/
│   │   ├── en/index.html
│   │   └── ar/index.html
│   └── beginner/
│       ├── fr/index.html
│       ├── en/index.html
│       └── ar/index.html
```

**IMPORTANT** : Ne PAS créer de dossier `assets/` local. Utiliser exclusivement le CSS global via `/assets/report.css`.

### signals.json — Source de Vérité (OBLIGATOIRE)

**Chaque scan DOIT produire `scanner/YYYYMMDD/signals.json` AVANT le HTML.**
Tous les outils downstream (sweep.js, gen-status-page.js, update-tracking.js, generate-scanner-image.js) lisent ce JSON en priorité. Le HTML est pour l'affichage humain uniquement.

> ⛔ **fortress-pm = étape SYSTÉMATIQUE du pipeline (local ET cloud), PAS optionnelle.** À chaque
> `/scanner`, après `sweep.js` et AVANT `gen-status-page.js`, invoquer `Skill(skill="fortress-pm")`
> et écrire la clé **`fortress_pool`** dans `signals.json` (candidats A+ Halal MCP-factcheckés,
> `strategy:"FortressA+"`, `sharia:true`). C'est la source dédiée des panneaux d'ordres des modes
> **aplus** (gate score≥92) et **fortress** (gate score≥85). Sans elle, `scanner-parser.js` tombe en
> `fortress_fallback` et ces modes peuvent rendre vides. `fortress_pool` présent mais `[]` = 0 A+ Halal
> légitime (aucun fallback). Détails : `.claude/skills/scanner-pipeline.md` §5.5 + `.claude/skills/fortress-pm.md`.

```json
{
  "scanDate": "2026-04-14",
  "regime": "EARLY RISK-OFF",
  "regimeScore": 42,
  "signals": [
    {
      "ticker": "NVDA",
      "name": "NVIDIA Corp",
      "score": 93,
      "strategy": "Momentum",
      "entry": 120.50,
      "stop": 115.00,
      "tp1": 130.00,
      "tp2": 140.00,
      "rr": "1:2.2",
      "horizon": 10,
      "region": "US",
      "sharia": true,
      "thesis": "AI capex cycle acceleration with cloud revenue inflection..."
    },
    {
      "ticker": "GS",
      "name": "Goldman Sachs",
      "score": 88,
      "strategy": "Breakout",
      "entry": 586.00,
      "stop": 568.00,
      "tp1": 608.00,
      "tp2": 632.00,
      "rr": "1:2.2",
      "horizon": 10,
      "region": "US",
      "sharia": false,
      "thesis": "M&A advisory revenue surge post-rate-cut expectations..."
    }
  ]
}
```

**Champs obligatoires par signal** : `ticker`, `score`, `strategy`, `entry`, `stop`, `tp1`, `rr`, `sharia`
**Champs optionnels** : `tp2`, `name`, `horizon`, `region`, `thesis`
**Types** : `entry`/`stop`/`tp1`/`tp2` = **nombres** (pas de "$"). `sharia` = **boolean**.

**Multi-List Format (OBLIGATOIRE depuis 2026-06-30)** :
```json
{
  "scanDate": "2026-06-30",
  "regime": "RISK-ON",
  "regimeScore": 86,
  "signals": [ ... ],           // composite top 10 (fully enriched)
  "momentum": [ ... ],          // top 10 momentum pool
  "breakout": [ ... ],          // top 10 breakout pool
  "pullback": [ ... ],          // top 10 pullback pool
  "pre_squeeze": [ ... ],       // top 10 pre-squeeze pool
  "tkl_pool": [ ... ],          // TKL momentum (separate pipeline)
  "crypto_pool": [ ... ],       // crypto signals
  "metals_pool": [ ... ],       // metals signals
  "forex_pool": [ ... ]         // forex signals
}
```
- Chaque pool contient des signaux avec la **même shape** que les `signals[]` classiques
- `signals[]` = composite top 10 (meilleur de chaque pool, diversifié secteur/géo)
- Un ticker peut apparaître dans 1 pool + le composite, mais jamais dans 2 pools différents
- `scanner-parser.js:loadSignals()` fusionne automatiquement les pools dans `signals` pour backward compat (dedup par ticker)

**Section `tkl_pool`** (alimentée par les screeners TKL) :
- `tkl_pool` contient jusqu'à 20 signaux supplémentaires (small/mid-cap momentum)
- sweep.js et gen-status-page.js lisent `signals` + `tkl_pool` pour le mode TKL
- Le HTML du scanner n'affiche que les 10 `signals` (top A+)
- **Scores tkl_pool**: Claude écrit le score brut renvoyé par le screener (souvent 99 = "passed"). `sweep.js buildSetups` les normalise automatiquement à parse-time en composite [85,95] = `85 + stratBonus*0.4 + rrBonus` (rrBonus = clamp((rr-1.5)*4, 0, 6)). Pas besoin de recalibrer manuellement côté Claude.
- **regime cohérence (CRITIQUE)** : `signals.json#regime` DOIT être identique à `data.json#regime` (ex: tous les deux `RECOVERY` ou tous les deux `RISK-ON`). Mismatch ⇒ pipeline downstream lit signals.json et ignore le label canonique de data.json.
- **Backfill historique tkl_pool** : si un scan ancien a `tkl_pool: []`, utiliser `mcp__dailytickers__RunScreener` avec `as_of=YYYY-MM-DDT22:00:00Z` et le DSL TKL-Momentum, dédup vs main top10, sharia filter.
- Champ `source` : `tkl_momentum`, `tkl_breakout`, ou `tkl_volume_surge`

**Workflow** :
1. Claude génère `signals.json` avec les pools stratégiques + composite top 10 + `tkl_pool`
2. Claude génère `data.json` pour le renderer HTML (ou `index.html` directement)
3. Les outils downstream lisent `signals.json` directement via `scanner-parser.js`
4. sweep.js consomme `signals` + `tkl_pool` pour alimenter le mode TKL

### Collecte des Données
1. **`RunAutoScreener`** : Détection du régime de marché + candidats auto-adaptatifs
2. **`RunScreener`** avec DSL personnalisé : 3 stratégies complémentaires
   - Oversold bounce : `rsi14<35 && vol>sma(vol,20)*1.5`
   - Momentum expansion : `close>sma(close,20) && vol>sma(vol,20)*2 && rsi14>50 && rsi14<75`
   - Breakout squeeze : `close>sma(close,50) && atr(14)>atr(28)*1.2`
2b. **`RunScreener` — TKL Pool** (screeners momentum small/mid-cap, alimentent le mode TKL)
   Ces screeners élargissent l'univers au-delà des large-caps. Les résultats sont ajoutés dans `signals.json` (section `tkl_pool`) mais ne comptent PAS dans les 10 setups conditionnels du scanner HTML.

   - **TKL-Momentum** (small/mid-caps en tendance avec volume) :
     ```
     pass_expr: market_cap >= 500000000 && market_cap < 50000000000 && close > ema20 && ema20 > ema50 && avg_volume > 300000 && rising('ema20', 10) && trend_strength(20) > 0.2 && change_pct(20) > 0.03
     score_expr: change_pct(10) * 100 + trend_strength(30) * 40 + near_sr_score() * 20
     top_k: 20
     ```
   - **TKL-Breakout** (near 52w high, volume spike, pure breakout) :
     ```
     pass_expr: market_cap >= 500000000 && close >= hhv('close', 50) * 0.97 && avg_volume > 200000 && vol > avg_vol(20) * 1.3 && rsi14 > 50 && rsi14 < 85 && close > ema50
     score_expr: (close / hhv('close', 50)) * 50 + trend_strength(20) * 30 + (vol / avg_vol(20)) * 20
     top_k: 20
     ```
   - **TKL-Volume-Surge** (accumulation + surge volume, tous market caps) :
     ```
     pass_expr: avg_volume > 200000 && vol > avg_vol(20) * 2 && close > ema20 && rsi14 > 45 && rsi14 < 80 && change_pct(5) > 0.02
     score_expr: (vol / avg_vol(20)) * 40 + trend_strength(20) * 30 + change_pct(10) * 100
     top_k: 20
     ```

   **Déduplication** : fusionner les 3 résultats, supprimer les doublons (garder le meilleur score), exclure les tickers déjà dans le top 10 A+. Prendre les 20 meilleurs comme `tkl_pool`.

2c. **TKL Pool Validation (OBLIGATOIRE — MÊME PIPELINE QUE LE TOP 10)**
   Les TKL passent le **même** process de validation que les 10 A+. Seuls les seuils mcap/ADV sont relâchés (voir `scanner-filters.json#tkl_pool`).

   **Seuils TKL :**
   - Market cap ≥ **$10M** (vs $500M pour le top 10)
   - ADV ≥ **$2M** (vs $10M pour le top 10)

   **Pour TOUS les TKL candidats (batched par 4-6) :**
   ```
   QueryData symbols={TKL_BATCH} types=sec_filings,flags,quote,insider_transactions,unusual_options,dark_pool,financials days=180
   QueryData types=earnings_calendar days=14
   ```

   **Règles de disqualification (identiques au top 10) :**
   - Market cap < $10M → DROP
   - ADV < $2M → DROP
   - Anti-dilution : S-3/424B5 < 90j, shelf_active, atm_program_active, aggressive_underwriter → DROP
   - Serial diluter (multiple S-3/424B5 en 12 mois) → DROP
   - Earnings ±3 jours → DROP ou tag "earnings risk"
   - Smart money short (call_put_ratio < 0.4 + vol > 2× normal) → DROP

   **Sharia tagging (identique au top 10) :**
   - Secteur haram → `sharia: false`
   - Debt/mcap > 33% → `sharia: false`
   - Sinon → `sharia: true`
   - **Toujours tagger** (jamais `sharia: null` dans le JSON final)

   **Insiders :** achat significatif → +5 pts, vente massive → -5 pts

   ⚠️ Cette validation est NON optionnelle. Aucun ticker TKL n'entre dans `signals.json` sans avoir passé tous ces checks. Le pipeline downstream (sweep, gen-status-page, gen-api) lit le `tkl_pool` validé.

3. **`QueryData`** types **OBLIGATOIRES** pour les 10 tickers retenus :
   - `quote,insider_transactions,social_sentiment,capital_flow` — base validation
   - `dark_pool` — détection accumulation institutionnelle (alpha signal majeur)
   - `unusual_options` — flux smart money / informed flow
   - `ftd_threshold` — Failure-to-Deliver list (squeeze precursor)
   - `sec_filings,flags` — remplace les 2 WebSearch dilution (voir section Anti-Dilution v2)
4. **`GetRegimeProbability`** (model=ensemble, horizon=5) : régime probabiliste 4-state pour gating des entrées
5. **`GetMarketOverview`** : trending topics, sector variations, calendrier macro
6. **WebSearch** : catalyseurs récents (réservé aux infos non couvertes par MCP)

### Risk Gating Post-Screener (OBLIGATOIRE — Risk Layer v1)
Avant de figer le top 10, appliquer ces 4 vérifs MCP-driven :

1. **`GetRegimeProbability`** :
   - Si `crisis > 0.30` ou `early_risk_off > 0.50` → réduire le top à 5, mode = breakout_only uniquement, taille position × 0.5
   - Si `current_state_confidence < 0.30` → flag "régime incertain" dans la section Invalidations
2. **`GetCorrelationMatrix`** sur les top 10 (window 60j, pearson) :
   - Si `max_pair.rho > 0.85` entre 2 candidats → garder le score le plus haut, drop l'autre
   - Si `avg_off_diagonal > 0.65` → portefeuille trop concentré → diversifier (forcer min 2 secteurs)
3. **`GetEarningsCalendarFiltered`** (days_ahead=7, min_expected_move_pct=4) :
   - Si un candidat a `report_date` dans la fenêtre `exclusion_window` (±3j earnings) → DISQUALIFIER ou tag "earnings risk" obligatoire
4. **`OptimizeSizing`** post-screening (mode=balanced, method=vol_target, max_position_risk_pct=1.0, max_pairwise_correlation=0.7) :
   - Utiliser le `risk_pct` retourné par OptimizeSizing pour caler les Stop/TP au lieu de l'allocation simple
   - Si OptimizeSizing rejette un candidat (`dropped_for_correlation`) → drop du top 10

### Filtre Anti-Doublon Position Ouverte (OBLIGATOIRE — BLOQUANT)

**Avant de retenir un ticker dans le top scan, vérifier `data/scanner-positions.json` :**
- Si le ticker est déjà présent dans `open_positions` → **DISQUALIFIER immédiatement**
- Logique : on ne prend jamais une deuxième entrée sur un ticker déjà en portefeuille
- Cette règle prévaut sur le score composite — même un score 99 est éliminé si le ticker est déjà ouvert
- Appliquer aussi aux **scans court terme** (même si l'horizon précédent n'est pas terminé)

**Procédure :**
```
1. Lire data/scanner-positions.json → extraire la liste des tickers ouverts
2. Pour chaque candidat du screening : si ticker dans la liste → SKIP
3. Continuer avec les candidats restants
```

### Filtre Stratégie (OBLIGATOIRE)

**Short Squeeze EXCLU** de tous les scans (décision 20/03/2026).
Stratégies autorisées : **Momentum, Pre-Squeeze, Breakout, Pullback** — **CES 4 LABELS UNIQUEMENT**.
Si le régime impose Short Squeeze → remplacer par Pre-Squeeze ou Momentum.

**LABELS INTERDITS** (ne jamais utiliser) : `Trend Follow`, `Defensive`, `Defensive Momentum`, `Defensive Yield`, `Reversal`, `Momentum Breakout`, ou tout autre label inventé.
- `Trend Follow` → utiliser **Momentum**
- `Defensive` / `Defensive Momentum` → utiliser **Momentum** (si momentum présent) ou **Pullback** (si repli)
- `Defensive Yield` → utiliser **Pullback**
- `Momentum Breakout` → utiliser **Breakout**
- Tout autre cas → forcer **Momentum** ou **Pullback** selon le profil technique

### Filtres Anti-Dilution & Fonds Agressifs (OBLIGATOIRE — BLOQUANT) — v2 MCP-driven

**Avant de retenir un ticker dans le top 10, vérifier OBLIGATOIREMENT les risques de dilution massive. Un ticker qui échoue à ces filtres est DISQUALIFIÉ même avec un score élevé.**

#### Source primaire : `QueryData types=sec_filings,flags`
Remplace les 2 WebSearch précédents (plus rapide, structuré, sans hallucination).

```
QueryData symbols={TICKER} types=sec_filings,flags days=180
```

Retourne un payload structuré avec `recent_filings[]` (form, filed_at, headline, dilution_flag, shelf_amount_usd) + `dilution_risk_score`.

**Règles de disqualification automatiques (du payload `flags`) :**
- `flags.shelf_active=true` ET `recent_filings` contient S-3 < 90j → **DISQUALIFIER**
- `flags.atm_program_active=true` → **DISQUALIFIER**
- `flags.warrants_outstanding=true` ET `flags.warrants_strike_proximity < 0.20` → **DISQUALIFIER** (warrants ITM imminents)
- `flags.recent_pipe=true` (< 180j) → **DISQUALIFIER**
- `flags.reverse_split_recent=true` (< 180j) → **DISQUALIFIER**
- `flags.aggressive_underwriter=true` (Wainwright, Maxim, Dawson James, Roth Capital, Ladenburg Thalmann détectés) → **DISQUALIFIER**
- `dilution_risk_score >= 70` → **DISQUALIFIER** (composite multi-signaux)
- `dilution_risk_score 40-69` → **-15 pts score + flag obligatoire dans Invalidations**

#### Source secondaire : `QueryData types=ftd_threshold` (squeeze precursor)
- `flags.on_threshold_list=true` AND `ftds_5d > avg_volume_20d × 0.5` → flag "FTD pressure" + considérer pre-squeeze label
- Sur micro/small-caps, FTD spike = squeeze risk (peut être positif intraday mais évite holds H8+)

#### Source tertiaire : `QueryData types=dark_pool,unusual_options`
- `dark_pool.accumulation_score > 70` → flag "institutional accumulation" en Confirmations (positif)
- `unusual_options.smart_money_score > 70` ET `call_put_ratio > 2.0` → flag "smart money long" (positif)
- Inversement : `unusual_options.call_put_ratio < 0.4` ET volume > 2× normal → "smart money short" → DISQUALIFIER

#### Procédure simplifiée (v2)
```
Pour chaque ticker candidat (1 seul appel MCP par ticker) :
QueryData symbols={TICKER} types=sec_filings,flags,ftd_threshold,dark_pool,unusual_options days=180

Décision automatique selon le payload :
  - flags.dilution_risk_score >= 70 OR aggressive_underwriter → DROP
  - flags.dilution_risk_score 40-69 → SCORE -15
  - dark_pool.accumulation_score > 70 OR unusual_options.smart_money_score > 70 → CONFIRM
  - flags.on_threshold_list=true → tag "FTD pressure" (neutre selon contexte)
```

**Fallback WebSearch** : uniquement si `sec_filings` retourne vide pour un micro-cap (< $500M market cap), garder l'ancienne procédure WebSearch comme filet de sécurité.

#### Exemple (cas INDO)
INDO avait un fund agressif (Wainwright) + warrants → dilution massive concrétisée.
Ce risque n'apparaissait PAS sur la fiche technique classique. Seule la vérification SEC active permet de le détecter.

---

### Sharia Compliance Tagging (OBLIGATOIRE — sur chaque setup)

**Chaque setup du scanner DOIT être taggé `data-sharia="true"` ou `data-sharia="false"`** dans le HTML. Ce flag permet aux outils downstream (sweep.js, gen-status-page.js) de filtrer et d'afficher un badge HALAL/CONV.

#### Critères Sharia (AAOIFI / MSCI Islamic Index Standards)

Un ticker est **NON sharia-compliant** (`data-sharia="false"`) s'il remplit **au moins un** de ces critères :

**1. Activité principale haram (secteur entier exclu) :**
- Banques & services financiers conventionnels (revenus basés sur l'intérêt/riba) — JPM, GS, BAC, BBVA, etc.
- Assurances conventionnelles (non takaful) — UNH, CI, ALL, PGR, etc.
- Défense & armement — LMT, RTX, NOC, GD, BA (segment défense), HII, etc.
- Alcool — BUD, DEO, STZ, SAM, TAP, etc.
- Tabac — PM, MO, BTI
- Jeux d'argent & paris — DKNG, MGM, WYNN, LVS, CZR
- Divertissement adulte / pornographie

**2. Ratios financiers (seuils AAOIFI) :**
- **Dette totale / Capitalisation boursière > 33%** → non compliant
- **Intérêts perçus + revenus non-conformes / Revenu total > 5%** → non compliant
- **Trésorerie + créances portant intérêt / Capitalisation boursière > 33%** → non compliant
- Source : `QueryData` types=financials,stats ou Yahoo `quoteSummary?modules=financialData,balanceSheetHistory`

**3. Instruments financiers exclus :**
- ETFs obligataires / treasuries (TLT, TBT, SHY, IEF, AGG, BND, HYG, LQD, JNK, MUB, etc.)
- ETFs à levier (TQQQ, SQQQ, UPRO, SPXU, SOXL, SOXS, LABU, LABD, etc.) — gharar (incertitude excessive)
- ETFs inversés (SH, SDS, PSQ, QID, etc.)
- Options pures, futures, CFDs (pas d'instruments dérivés dans le scanner de toute façon)

**4. ETFs mixtes :**
- ETFs sectoriels contenant majoritairement des non-compliants → vérifier la composition
- XLF (financials) → `data-sharia="false"`
- XLV (healthcare avec assureurs UNH, CI) → `data-sharia="false"`
- XLE, XLK, SMH, GLD, SLV, GDX, USO → généralement compliants, vérifier au cas par cas

#### Procédure de vérification par ticker

```
Pour chaque ticker candidat retenu dans le top 10 :
1. Vérifier le secteur GICS — si finance/assurance/défense/alcool/tabac/jeux → data-sharia="false"
2. Si le secteur est OK, vérifier les ratios :
   - QueryData types=financials,stats pour le ticker
   - Total Debt / Market Cap : doit être < 33%
   - Interest Income / Total Revenue : doit être < 5%
   - Cash + Interest-bearing receivables / Market Cap : doit être < 33%
3. Si un ratio est indisponible (micro-cap, ETF) → WebSearch "{TICKER} sharia compliant MSCI islamic"
4. Résultat → data-sharia="true" ou "false" sur le <tr> synthese ET le setup-card <div>
```

#### Implémentation HTML

**Table synthèse** — attribut sur chaque `<tr>` :
```html
<tr data-sharia="true"><td>1</td><td><strong>NVDA</strong></td>...</tr>
<tr data-sharia="false"><td>2</td><td><strong>GS</strong></td>...</tr>
```

**Setup card** — attribut sur le `<div>` :
```html
<div class="setup-card" id="setup-NVDA" data-ticker="NVDA" data-sharia="true" data-entry="..." ...>
```

**Badge visuel dans le setup card** (à côté des badges stratégie/région) :
```html
<!-- Sharia compliant -->
<span class="badge badge-green" style="font-size:.7rem">☪ Halal</span>
<!-- Non compliant -->
<span class="badge" style="background:#94a3b8;color:#fff;font-size:.7rem">CONV</span>
```

#### Utilisation par les outils downstream

- **sweep.js `--sharia`** : filtre les setups `data-sharia="false"` + fallback sur SHARIA_EXCLUDED pour les vieux scans non taggés
- **gen-status-page.js** : affiche un badge HALAL (vert) ou CONV (gris) à côté de chaque ticker dans les tableaux
- **scanner-parser.js** : parse `data-sharia` et l'inclut dans l'objet signal (`sharia: true|false|null`)

---

### MCP Forecast — Filtre Post-Screener (OPTIONNEL, après sélection top 10)

Après avoir sélectionné les tickers retenus, utiliser `ForecastRaw` (MCP `http://ser.tail5d09f.ts.net:8400/mcp/`) sur les séries dérivées (PAS le prix brut) pour enrichir chaque setup.

**⚠️ Ne jamais utiliser la direction du MCP Forecast comme signal principal. C'est un filtre de confirmation.**

#### Filtre Volume (UC3 — score 8.5/10, précision 69%)
```python
# Pour chaque ticker retenu :
ForecastRaw(volume_series[-150:], horizon=10)
→ pred_avg > avg20 × 1.1  → "volume favorable" → confirmer le setup ✅
→ CI_hi > avg20 × 1.5     → "spike possible dans 10j" → surveiller ⚠️
→ pred_avg < avg20 × 0.9  → "volume faible attendu → faux breakout probable" → skip ou réduire ❌
```

#### Filtre Volatilité ATR (UC2 — score 8/10, précision 67–73%)
```python
# ATR(14) series[-150:] → ForecastRaw horizon=10
→ ATR_forecast > ATR_now × 1.15 → expansion vol attendue → éviter les entrées (ou stops larges)
→ ATR_forecast < ATR_now × 0.85 → contraction vol attendue → setup squeeze crédible
→ RVOL_forecast < RVOL_now × 0.80 → compression pre_squeeze confirmée par le modèle
```

#### Signal de régime (ForecastVix — toujours)
```python
ForecastVix(horizon=5)
→ VIX prédit > 30 → réduire les tailles de 50%, élargir tous les stops
→ VIX prédit en hausse → biais défensif pour la sélection
→ Régime = "STABLE" + VIX < 25 → conditions normales
```

#### Ce qu'on N'utilise PAS dans le scanner
- Direction prix brut (`predicted_direction` de `Forecast`) → 44% global = bruit
- `confidence` → fixe à 0.95 sur tous, non informatif
- Quarterly revenue/earnings → données insuffisantes (<10 trimestres Yahoo)
- Tickers à earnings dans ±3j → exclure du forecast prix (DIR chute à 40%)

---

### Insider Transactions — Signal Spécial (OBLIGATOIRE)

**Objectif** : Détecter les achats significatifs d'insiders (CEO, CFO, Board) comme signal de conviction supplémentaire.

**Collecte** : `QueryData` types=insider_transactions pour **tous** les candidats retenus après le screening initial.

**Critères de signification** :
- Achat open market (pas exercice d'options ni conversion) > $50K
- Achat par un C-level (CEO, CFO, COO, CTO) ou Board member
- Cluster d'achats : 2+ insiders achètent dans une fenêtre de 30 jours
- Achat après une baisse > 15% = signal contrarian fort

**Impact sur le score** :
- Achat significatif d'un insider → **+5 points** au score composite
- Cluster d'achats (2+ insiders) → **+10 points** et badge `🏷️ Insider Buy`
- Ventes massives d'insiders → **-5 points** et mention dans les invalidations

**Affichage dans le setup card** :
- Si insider buy détecté → ajouter dans la section **Confirmations** (bloc vert) :
  - "Insider buying: {Nom} ({Rôle}) bought {N} shares (${Montant}) on {Date}"
- Si vente significative → ajouter dans la section **Invalidations** (bloc rouge) :
  - "Insider selling: {Nom} ({Rôle}) sold {N} shares (${Montant}) on {Date}"
- Badge spécial `badge-green` sur le setup card header : "Insider Buy" si achat significatif détecté

**Exemples de signaux forts** :
- CEO achète $200K d'actions après un drop de 20% → signal contrarian très fort
- 3 board members achètent la même semaine → cluster bullish
- CFO vend 80% de ses actions → red flag majeur

### Polymarket — Signal Complémentaire pour Catalyseurs

Quand un setup a un catalyseur lié à un événement binaire (earnings beat/miss, approbation réglementaire, événement géopolitique), vérifier si un marché Polymarket existe.

**Collecte** : `WebSearch "polymarket {catalyseur}" site:polymarket.com`

**Utilisation** :
- Si un marché Polymarket pertinent existe avec volume > $100K → mentionner dans les **Catalyseurs** du setup
- Format : "Polymarket prices {événement} at {X}% (${volume})" dans le texte du catalyseur
- Lien source-ref vers le marché
- Si la probabilité Polymarket diverge fortement du consensus marché → signal d'alerte

**Exemple** :
```html
<p><strong>Catalyseur :</strong> Fed rate cut expected June — Polymarket prices at 62% ($4.2M volume)
<a href="https://polymarket.com/event/fed-rate-cut-june" class="source-ref" target="_blank" rel="noopener">
    <i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>
    <span class="source-name">Polymarket</span></a></p>
```

---

### Univers US Stocks & ETFs

**OBLIGATOIRE** : Le scanner éditorial couvre uniquement les titres cotés aux États-Unis. Le top 10
contient 8 actions US et 2 ETFs cotés aux États-Unis. Ne lancer aucun screener EU/APAC, aucun fallback
EU et aucun staging ETF EU.

#### Univers de Screening

**Actions cotées aux États-Unis** :
- Actions ordinaires et ADRs liquides retournés par `RunScreener(region="us")`
- Capitalisation post-filtrée ≥ $2B, prix > $10 et volume > 1,5M pour le vivier principal
- `region: "US"` dans le signal publié

**ETFs cotés aux États-Unis** :
- **Secteurs** : XLF (Financials), XLE (Energy), XLK (Tech), XLV (Healthcare), XLI (Industrials), XLY (Consumer Discretionary), XLP (Consumer Staples), XLRE (Real Estate), XLU (Utilities), XLB (Materials)
- **Thématiques** : ARKK (Innovation), ICLN (Clean Energy), TAN (Solar), LIT (Lithium), BOTZ (Robotics), HACK (Cybersecurity), CLOU (Cloud), JETS (Airlines), DRIV (Auto)
- **Commodités** : GLD (Gold), SLV (Silver), USO (Oil), UNG (Natural Gas), DBA (Agriculture)
- **Crypto** : BITO (Bitcoin ETF), ETHE (Ethereum ETF)

#### Méthodologie de Sélection

1. **Screening US** : utiliser `RunScreener(region="us")` pour les actions et le staging `ETF_STAGE` pour les ETFs US
2. **Critères A+** :
   - Score composite ≥ 85/100
   - Confluence technique : ≥ 3 signaux alignés (RSI, volume, S/R, pattern)
   - Catalyseur identifiable (earnings, news, breakout technique)
   - Liquidité suffisante (volume moyen > $10M/jour pour actions, > $50M/jour pour ETFs)
3. **Diversification** : exactement 8 actions US + 2 ETFs US parmi les 10 candidats retenus
4. **Horizon J+1** : Setups avec potentiel de mouvement dans les prochaines 24-48h (pas swing long terme)

#### Présentation dans le Scanner

Pour chaque setup, **ajouter le badge d'univers correspondant** :

```html
<div class="setup-badges">
    <span class="badge badge-blue">US</span>
    <span class="badge badge-green">ETF</span>
    <span class="badge badge-{color}">{Stratégie}</span>
</div>
```

**Exemple de répartition idéale sur 10 setups** :
- 8 actions cotées aux États-Unis
- 2 ETFs cotés aux États-Unis

#### Titre de la Carte Scanner (OBLIGATOIRE)

Le `<h2>` de chaque carte scanner dans `data/scanner.json` DOIT suivre ce format exact :

```
Top 10 conditionnel {REGIME} — {TICKER1}, {TICKER2}, {TICKER3}, ..., {TICKER10}
```

- **{REGIME}** : le régime détecté en MAJUSCULES — **UNIQUEMENT ces 5 valeurs** : `RISK-ON`, `EARLY RISK-OFF`, `RISK-OFF`, `NEUTRAL`, `RECOVERY`
  - ⚠️ **INTERDIT** : `DEEP RISK-OFF`, `STRONG RISK-ON`, `EXTREME RISK-OFF`, `MODERATE NEUTRAL`, ou tout autre label inventé
  - Si le marché est très baissier → `RISK-OFF` (pas "DEEP RISK-OFF")
  - Si début de détérioration → `EARLY RISK-OFF`
- **{TICKERS}** : les 10 tickers séparés par des virgules, dans l'ordre du scan
- **Jamais** de titre générique ("Daily Scanner", "Scan du jour", etc.)

**Exemples conformes** :
- `Top 10 conditionnel EARLY RISK-OFF — MRVL, HIMS, CF, IOT, ADBE, LLY, TLT, SQQQ, DBA, SAP`
- `Top 10 conditionnel RISK-OFF — XOM, EQNR, RTX, KR, ADM, TTE, GLD, EWY, SH, UNG`

Le `<div class="report-card-meta">` doit contenir la date au format `{Day}, {Month} {DD}, {YYYY}` (en anglais) ou `{Jour} {DD} {Mois} {YYYY}` (en français).

#### Mise à jour Index.html

Lors de l'ajout de la carte scanner dans `index.html`, **mentionner la composition US** dans la description :

```html
<p style="font-size:0.85rem; color:var(--text-muted);">
    {Description du régime}. {Stratégies}. 10 setups analysés : {8 actions US}, {2 ETFs US}.
</p>
```

**Exemple** :
> "Rotation défensive confirmée. Hausse VIX +4.2%. 10 setups analysés : XOM, HRL, UNH, JPM, LLY, CAT, NVDA, COST (actions US), GLD, XLE (ETFs US)."

### Template HTML Obligatoire (CRITIQUE)

Chaque scanner DOIT suivre exactement cette structure HTML. Référence : `scanner/20260219/index.html`.

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="en" data-tags="us,commodity,etf,technique,trade-idea,macro,energy,financials,healthcare" data-tab="scanner">
```
- `lang` : langue de l'article (fr, en, ar)
- `data-tags` : tags pertinents (voir taxonomie dans CLAUDE.md racine)
- `data-tab="scanner"` : toujours "scanner"

#### CSS — Thème Light (`report.css`)
```html
<link rel="stylesheet" href="/assets/report.css">
```
**JAMAIS** `report-dark.css` pour le scanner. **JAMAIS** de dossier `assets/` local.

#### Brand Bar (OBLIGATOIRE — avec menu principal)
```html
<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo">
      <img src="/logo.svg" alt="" width="36" height="36">
      <span class="brand-title">DailyTickers</span>
    </a>
    <div class="brand-nav">
      <a href="/?tab=weekly">Hebdo</a>
      <a href="/?tab=daily">Daily</a>
      <a href="/?tab=analyses">Analyses</a>
      <a href="/?tab=scanner">Scanner</a>
      <a href="/?tab=radar">Radar</a>
      <a href="/?tab=series">S&eacute;ries</a>
    </div>
    <div class="brand-actions">
      <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
    </div>
  </div>
</nav>
```
**Le lien actif est auto-highlight via CSS** (`data-tab` sur `<html>` → sélecteur CSS). Pas de `class="active"` en dur.

#### Hero Section — `<div class="ticker-header">`
Le hero du scanner utilise `ticker-header` (pas `hero-section`) :
- Logo MW (jamais logo société)
- Switcher langue (drapeaux FR/EN/AR) + niveau (Expert/Beginner)
- Titre : "Scanner DailyTickers — {Date}"
- Métriques : Régime, Score Moyen, Nb Setups, Stratégie Dominante
- Badges : régime couleur, stratégies
- Tags cliquables : `<div id="article-clickable-tags" class="card-tags"></div>`

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE — 6 items)
```html
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#regime" class="fnav-item" data-section="regime"><i class="fas fa-gauge"></i><span>Régime</span></a>
    <a href="#overview" class="fnav-item" data-section="overview"><i class="fas fa-list"></i><span>Vue d'Ensemble</span></a>
    <a href="#synthese" class="fnav-item" data-section="synthese"><i class="fas fa-chart-pie"></i><span>Synthèse</span></a>
    <a href="#performance" class="fnav-item" data-section="performance"><i class="fas fa-chart-bar"></i><span>Performance</span></a>
    <a href="#methodo" class="fnav-item" data-section="methodo"><i class="fas fa-flask"></i><span>Méthodologie</span></a>
    <a href="#disclaimer" class="fnav-item" data-section="disclaimer"><i class="fas fa-triangle-exclamation"></i><span>Disclaimer</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>
```
**TOUJOURS 6 items.** Le JS gère le toggle, le smooth scroll, et l'IntersectionObserver pour l'item actif.

#### Footer (OBLIGATOIRE)
```html
<footer class="article-footer">
  &copy; 2026 DailyTickers. Données via DailyTickers Gateway.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>
```
**TOUJOURS** `class="article-footer"`. Jamais `report-footer`, `footer-bar`, `site-footer`, etc.

#### Scripts (OBLIGATOIRE — avant `</body>`)
```html
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script src="/assets/live-tracker.js"></script>
```

**`live-tracker.js`** dynamise les setup cards avec les prix temps réel :
- Badge sous chaque prix : % évolution depuis l'article + prix actuel
- Statut automatique : Trending, Entry Zone, Stopped, TP1/TP2 Hit, Underwater, Near Stop
- Picks invalidés (stopped) marqués visuellement en grayscale
- Source : Yahoo Finance via `api.allorigins.win/get` + Binance pour crypto
- Cache `sessionStorage` 5 min, auto-refresh 30s

### Sections de l'Article Scanner

#### Thème
Le scanner utilise le **thème light standard** (fond `#f8fafc`, texte `#0f172a`) via `/assets/report.css`. **JAMAIS de thème dark.**

#### Charts — ECharts UNIQUEMENT
**IMPORTANT** : Utiliser exclusivement **ECharts** pour tous les graphiques. **Ne PAS mélanger** ApexCharts et ECharts. Pas de sparklines ApexCharts.
- Conteneur : `<div id="chartId" class="echart-box" style="width:100%; height:300px;"></div>`
- Initialisation dans un `<script>` en fin de page

#### Sections Obligatoires
1. **Hero** (`ticker-header`) : Date, badge régime de marché (couleur selon régime), stats clés (nb setups, score moyen, stratégie dominante), tags cliquables
2. **Régime de Marché** (`id="regime"`) : Description du régime détecté, composantes (VIX, SPX, DXY, crédit, liquidité, TLT), pondérations des stratégies
   - **ECharts Pie (donut)** : Répartition des stratégies (%)
   - **ECharts Gauge** : Score moyen des setups (0-100)
   - `pedagogy-box` expliquant la sélection
3. **Vue d'Ensemble Visuelle** (`id="overview"`) :
   - **ECharts Radar** : Profil agrégé des 10 setups (axes: Technique, Volume, Momentum, Risque, R/R, Conviction)
   - **ECharts Treemap** : Répartition sectorielle des 10 setups (taille = score, couleur = variation)
   - **ECharts Heatmap** : Matrice de corrélations entre les 10 tickers (si applicable)
4. **Navigation Grid** : Liens internes vers chaque setup (grille cliquable)
5. **10 Setup Cards** (`id="setup-{TICKER}"` pour chaque) :
   - Header avec ticker, nom, prix, variation
   - Badges : stratégie détectée, fiabilité, signal technique, badge d'univers (US/ETF)
   - **ECharts Gauge** : Score composite 0-100 (`id="gaugeSetup{TICKER}"`)
   - **ECharts Radar** : Profil du setup 6 axes (`id="radarSetup{TICKER}"`)
   - **Thèse d'investissement** : paragraphe explicatif du setup
   - **Confirmations** (OBLIGATOIRE — fond vert) :
     ```html
     <div style="background:#f0fdf4; border:1px solid #86efac; padding:1rem; border-radius:12px;">
       <h4 style="color:#16a34a;">Confirmations</h4>
       <ul><li>...</li><li>...</li><li>...</li><li>...</li></ul>
     </div>
     ```
   - **Invalidations** (OBLIGATOIRE — fond rouge) :
     ```html
     <div style="background:#fef2f2; border:1px solid #fecaca; padding:1rem; border-radius:12px;">
       <h4 style="color:#dc2626;">Invalidations</h4>
       <ul><li>...</li><li>...</li><li>...</li><li>...</li></ul>
     </div>
     ```
   - **Niveaux Clés** (OBLIGATOIRE — grille CSS) :
     ```html
     <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:1rem;">
       <div><strong>Entrée :</strong> ${prix}-${prix}</div>
       <div><strong>Stop Loss :</strong> ${prix}</div>
       <div><strong>Target 1 :</strong> ${prix}</div>
       <div><strong>Target 2 :</strong> ${prix}</div>
       <div><strong>R/R :</strong> 1:{ratio}</div>
       <div><strong>Horizon :</strong> {N}-{N} jours</div>
     </div>
     ```
   - **4 items min** dans Confirmations ET Invalidations
   - **6 entrées** dans Niveaux Clés (Entrée, Stop, TP1, TP2, R/R, Horizon)
6. **Synthèse** (`id="synthese"`) — ⚠️ **NE JAMAIS CHANGER CET ID** (le parser gen-status-page.js en dépend) :
   - Tableau récapitulatif `.data-table` des 10 setups (Ticker, Score, Stratégie, Entry, Stop, TP1, R/R)
   - **ECharts Bar** : Scores composites comparatifs (horizontal bar chart)
   - **ECharts Sankey** (optionnel) : Flux Secteur → Stratégie → Setup
7. **Performance** (`id="performance"`) : Résumé des métriques globales
8. **Méthodologie** (`id="methodo"`) — **5 sous-sections obligatoires** dans des `pedagogy-box` :
   1. Détection du Régime de Marché
   2. Screening Multi-Stratégie
   3. Scoring Composite (4 Facteurs)
   4. Critères de Sélection A+
   5. Validation & Ranking
   - Plus un bloc "Sources de données" en fin de section
9. **Disclaimer** (`id="disclaimer"`) : Avertissement standard dans `.content-card`

#### Niveaux de Complexité
- **Expert** : Toutes les sections, jargon technique complet, Wyckoff, RSI divergences, volume profile
- **Beginner** :
  - Langage simple : "le prix rebondit" au lieu de "RSI en survente"
  - Pas de jargon technique non expliqué
  - Score simplifié en étoiles (1-5)
  - Moins de métriques, plus d'explications
  - "Acheter si..." / "Éviter si..." au lieu de "Entry zone" / "Stop loss"

### Directives Scanner
- Un scan par jour ouvré (lun-ven)
- 10 setups maximum par scan
- Diversification sectorielle obligatoire
- Inclure le régime de marché dans le titre et le badge hero
- **ECharts UNIQUEMENT** : Gauge + Radar par setup, Pie + Gauge pour régime, Treemap + Bar pour synthèse. PAS d'ApexCharts.
- Score composite 0-100 pour chaque setup
- **Niveaux Clés OBLIGATOIRES** dans chaque setup card (Entry, Stop, TP1, TP2, R/R, Horizon)
- **Confirmations/Invalidations OBLIGATOIRES** avec fond coloré (vert/rouge) dans chaque setup card
- Ajouter la carte dans le tab Scanner via `node tools/add_card.js scanner/YYYYMMDD/index.html`
- **OBLIGATOIRE — Feedback rétrospective** : Avant de générer un nouveau scan, **lire TOUTES les rétrospectives existantes** (tous les dossiers `scanner/retrospective/YYYYMMDD/`) pour :
  - Lister tous les dossiers datés dans `scanner/retrospective/` et lire chaque `index.html`
  - Pour chaque rétro : extraire la note globale, hit rates par stratégie, top/flop setups
  - **Cumuler les enseignements** : une stratégie qui sous-performe dans 2+ rétros consécutives doit être fortement réduite
  - **Priorité** : la rétro la plus récente a le plus de poids, mais les patterns récurrents des rétros antérieures sont tout aussi importants
  - Identifier les secteurs qui génèrent trop de faux signaux (pattern récurrent across rétros)
  - Ajuster les seuils ATR (stops trop serrés/larges — vérifier si le problème persiste entre rétros)
  - Mentionner en introduction du scan : "Suite aux rétrospectives (notes X, Y, Z), nous avons ajusté [...]"
  - Éviter de recommander des tickers qui ont été des flops dans les rétrospectives récentes
  - Favoriser les stratégies et patterns qui montrent le meilleur hit rate cumulé sur l'ensemble des rétros

---

## 5bis. RÉTROSPECTIVE SCANNER HEBDOMADAIRE


### Objectif
Article de rétrospective publié chaque vendredi soir (23h) qui passe en revue **tous les scans des 10 derniers jours**, évalue la qualité des setups, mesure l'écart entre prévisions et résultats réels, et note le scanner globalement. Les enseignements sont réutilisés pour affiner les prochains scans.

### Structure URL
```
scanner/
├── retrospective/
│   ├── index.html                # Redirect → dernier YYYYMMDD/
│   ├── variants.json
│   ├── YYYYMMDD/                 # Chaque rétro a son dossier daté
│   │   └── index.html
│   └── YYYYMMDD/                 # Toutes les rétros sont conservées
│       └── index.html
```
**IMPORTANT** : On ne remplace JAMAIS une rétrospective précédente. Chaque rétro a son propre dossier daté (date de publication). Le `index.html` racine est un simple redirect vers la plus récente.

**IMPORTANT** : Pas de dossier `assets/` local. Utiliser `/assets/report.css`.

### Template HTML — Même structure que le Scanner
La rétrospective utilise le **même template HTML** que le scanner (brand-bar, footer, FAB, tags, scripts). Voir la section "Template HTML Obligatoire" ci-dessus. Les seules différences :
- `data-tags` inclut `retrospective`
- Hero avec badge note globale (A+ à F) au lieu de badge régime
- Style spécial pour la carte rétrospective (bordure dorée `#f59e0b`)

### Collecte des Données

1. **Lister les scans des 10 derniers jours** : Lire tous les `scanner/YYYYMMDD/index.html` publiés dans les 10 derniers jours
2. **Extraire de chaque scan** :
   - Régime de marché détecté
   - Les 10 setups avec : ticker, stratégie, entry, stop, target(s), R/R, score, direction (long/short)
3. **Collecter les prix actuels** via MCP :
   - `QueryData` types=quote,bars_daily symbols={tous les tickers des scans}
   - Pour chaque ticker : prix à la date du scan (entry day), high/low depuis, prix actuel
4. **Calculer les résultats** :
   - **Hit rate** : % de setups dont le TP1 a été atteint
   - **Stop rate** : % de setups dont le stop a été touché
   - **En cours** : setups ni TP ni stop touchés
   - **P&L moyen** : rendement moyen si entrée au prix indiqué
   - **R/R réalisé** vs R/R prévu
   - **Meilleur setup** et **Pire setup** de la période
5. **Analyser les patterns** :
   - Quelle stratégie (oversold, momentum, breakout) a le meilleur taux de réussite ?
   - Quel régime de marché a produit les meilleurs setups ?
   - Y a-t-il un biais sectoriel ? Géographique ?
   - Les scores composites corrèlent-ils avec les résultats ?

### Sections Obligatoires

1. **Hero** : "Rétrospective Scanner — Semaine du DD/MM au DD/MM", badge avec note globale (A+ à F)
2. **Dashboard Rapide** :
   - Note globale du scanner (A+ à F) avec critères
   - Hit rate TP1 (%), Hit rate TP2 (%), Stop rate (%)
   - P&L moyen, Meilleur trade, Pire trade
   - ECharts Gauge : Taux de réussite global
3. **Tableau Récapitulatif** : Table avec TOUS les setups des 10 jours
   - Colonnes : Date | Ticker | Stratégie | Entry | Stop | TP1 | TP2 | Résultat | P&L | Statut (TP1 ✅, TP2 ✅, Stop ❌, En cours ⏳)
   - Codage couleur : vert (TP atteint), rouge (stop touché), gris (en cours)
4. **Analyse par Stratégie** :
   - Oversold bounce : hit rate, P&L moyen, commentaire
   - Momentum expansion : hit rate, P&L moyen, commentaire
   - Breakout squeeze : hit rate, P&L moyen, commentaire
   - ECharts Bar : Comparaison des hit rates par stratégie
5. **Analyse par Régime** :
   - Quel régime a dominé la période ?
   - Corrélation régime → performance des setups
6. **Top 3 Setups** : Les 3 meilleurs setups avec analyse détaillée de pourquoi ils ont fonctionné
7. **Flop 3 Setups** : Les 3 pires setups avec analyse de ce qui n'a pas fonctionné
8. **Leçons & Améliorations** :
   - Ce que le scanner a bien fait
   - Ce que le scanner a raté
   - Ajustements proposés pour les prochains scans (pondérations, filtres, seuils)
   - Pedagogy-box : leçon pour le lecteur tirée des résultats
9. **Historique des Notes** : Tableau des rétrospectives précédentes avec note, hit rate, P&L moyen
10. **Sources & Disclaimer**

### Notation du Scanner (Système Unifié)

La note combine **2 piliers** en une note composite unique :

**Pilier 1 — Setup Quality (50%)** : Hit Rate TP1 sur positions résolues (le pick individuel est-il bon ?)
**Pilier 2 — Portfolio Return (50%)** : P&L simulé avec les paramètres optimaux de `sweep.js` sur la période de la rétro (en tradant ces picks avec discipline, quel résultat ?)

Chaque pilier donne un score numérique (1-7), la moyenne arrondie = note finale.

| Note | Score | Setup HR (Pilier 1) | Portfolio Return (Pilier 2) |
|------|-------|--------------------|-----------------------------|
| **A+** | 7 | > 70% | > +8% |
| **A** | 6 | 60-70% | +5% à +8% |
| **B+** | 5 | 50-60% | +3% à +5% |
| **B** | 4 | 40-50% | +1% à +3% |
| **C** | 3 | 30-40% | 0% à +1% |
| **D** | 2 | 20-30% | -1% à 0% |
| **F** | 1 | < 20% | < -1% |

**Calcul** : `Note finale = round((score_pilier1 + score_pilier2) / 2)` → lookup dans la table.

**Provisoire** : Si < 50% des positions sont résolues, la note est marquée `*` (provisoire). Le Pilier 2 (portfolio sim) est toujours calculable car sweep.js simule avec horizon fixe + exit à expiration.

**Scans spéciaux** (VIX Deflation, complémentaires soirée, thématiques) : exclus du calcul de la note par défaut. Mentionnés dans la rétro en grisé avec statistiques séparées.

**Données Pilier 2** : Extraire l'equity curve de `data/backtest-results.json` pour la sous-période de la rétro. Le mode utilisé est `optimal_sharpe` (meilleur ratio rendement/risque). Afficher aussi le max drawdown de la période.

### Gestion des Versions
- Chaque rétrospective est dans `scanner/retrospective/YYYYMMDD/index.html` (date de publication)
- `scanner/retrospective/index.html` = redirect HTTP vers la **dernière** rétrospective
- Lors de la création d'une nouvelle rétrospective :
  1. Créer `scanner/retrospective/YYYYMMDD/index.html`
  2. Mettre à jour le redirect dans `scanner/retrospective/index.html` (`<meta http-equiv="refresh" content="0;url=/scanner/retrospective/YYYYMMDD/">`)
  3. Lancer `node tools/add_card.js scanner/retrospective/YYYYMMDD/index.html` — la carte aura un href unique, les anciennes rétros restent dans l'index
  3b. **Attester la notation aux niveaux publiés** : `node tools/qa-retro.js scanner/retrospective/YYYYMMDD/`
      DOIT passer (câblé dans `publish.js --type retro`) — ligne notée = |écart| ≤ 2% (tolérance unique
      `tools/lib/fill-policy.js`) OU NON REMPLI ; écart → « Transparence process », jamais de rebasing.
      Puis **rafraîchir le bloc index** : `node tools/update-scanner-perf.js` après mise à jour de
      `data/retro-summary.json` (5 assertions = exit 0). Détail : `docs/scanner-gates.md`.
  4. La carte dans `scanner.json` DOIT avoir le style rétrospective : bordure colorée selon la note, badges RÉTROSPECTIVE + NOTE, bouton gradient
- **NE PAS** supprimer les anciennes rétrospectives — elles restent dans l'index `scanner.json` triées par date avec les scans

### Feedback Loop — Synthèse Automatisée des Règles (OBLIGATOIRE)

Chaque rétrospective DOIT mettre à jour `data/scanner-lessons.json` — fichier machine-readable lu par `/scanner` Phase 0 step 8 et appliqué pendant la sélection.

**Au moment de générer la rétro :**

1. **Lire `data/scanner-lessons.json` existant** : 12 règles actuelles avec champs `id`, `from_retros`, `rule`, `rationale`, `applies_to`, `enforced_by`, `validation`, `status`, `severity`.

2. **Pour chaque nouveau pattern observé dans la semaine** :
   - Si pattern récurrent (≥ 2 rétros) → créer/promote la règle en `severity: blocking` et ajouter `from_retros: [...]`
   - Si pattern isolé (1 seule rétro) → créer en `severity: advisory`, à confirmer à la prochaine rétro
   - Si pattern contredit une règle existante → marquer l'ancienne `status: deprecated` avec `superseded_by` pointant la nouvelle

3. **Pour chaque règle existante** : vérifier si toujours pertinente. Une règle qui n'a pas été déclenchée sur 4 rétros consécutives peut passer en `status: dormant`.

4. **Cibler les `enforced_by`** :
   - `blocking` rules → encodées dans `scanner-filters.json` + `validate-scan.js` (Claude ne peut pas les contourner)
   - `advisory` rules → appliquées par Claude pendant Phase 2 sélection
   - Si une `blocking` rule ne peut pas encore être encodée dans validate-scan.js, marquer `validation: "pending-implementation"` + ouvrir une issue

5. **Open questions** : ajouter dans `_open_questions[]` les hypothèses à tester au prochain scan (champs `id`, `question`, `next_retro_check`).

6. **Bump `_version`** : `v{major}.{minor}-{YYYYMMDD}`. Major bump si breaking change (règle supprimée ou superseded). Minor sinon.

7. **`_source_retros`** : append la nouvelle rétro à la liste chronologique.

8. **Commit avec la rétro** : `scanner-lessons.json` change AVEC le HTML, dans le même commit.

**Pendant /scanner (Phase 0.8 + Phase 2)** : Claude lit `scanner-lessons.json` au démarrage, applique blocking rules en filtre dur, biaise sélection selon advisory rules, et reporte en Phase 6 QA si une open_question target la scan en cours.

Cette synthèse est **non-optionnelle** — elle évite la dérive du process et capitalise les apprentissages historiques sans relire toutes les rétros à chaque /scanner.

### Post-Publication (OBLIGATOIRE — NE JAMAIS SAUTER)

Après génération du fichier HTML, ces 5 étapes sont **BLOQUANTES**. Si l'une échoue, NE PAS passer à la suivante :

0. **Gates audit (docs/scanner-gates.md)** : `node tools/validate-scan.js scanner/YYYYMMDD/` passe
   G1–G3 (`entry_strategy_coherence`, `etf_lookthrough_correlation_cap`, `regime_score_drop`) ;
   le scan publie le **pass/fail nominatif** des 4 gates (G4 = heartbeat gen-status-page) dans sa
   section Méthode. Prérequis `signals.json` : `lookthrough:{factor, clusters[]}` sur chaque ETF,
   `exited_factors:[]` à la racine, zone d'entrée COMPLÈTE (`entry_low`–`entry`) affichée sur la page.
1. **Vérifier la taille** : `wc -c scanner/YYYYMMDD/index.html` — doit être > 30KB (sinon article tronqué/incomplet)
2. **Indexer** : `node tools/add_card.js scanner/YYYYMMDD/index.html` — vérifier que `data/scanner.json` et `data/search_data.js` apparaissent dans `git status`
   - **INTERDIT** de modifier `data/scanner.json` manuellement ou via Write/Edit. TOUJOURS utiliser `add_card.js` qui gère l'escaping JSON correctement.
3. **Mettre à jour le watchlist** : Écrire `mcp/watchlist.json` avec les 10 picks du scan
4. **Mettre à jour le radar** : Écrire `data/radar.json` avec les données actuelles
5. **Commit & Push** :
   ```bash
   git add scanner/YYYYMMDD/ data/scanner.json data/search_data.js mcp/watchlist.json data/radar.json
   git commit -m "feat: scanner YYYYMMDD — {régime}, 10 setups conditionnels"
   git push origin main
   ```

**Si `add_card.js` échoue** : vérifier que le HTML est valide, que le `<html>` a `data-tab="scanner"` et `data-tags`, et que le hero contient un `<h1>`.

---


---

## 6. SWEEP OPTIMIZER (tools/sweep.js)

### Objectif
Grid search exhaustif pour trouver les parametres optimaux du scanner. Teste 98 000 combinaisons sur 8 dimensions avec validation walk-forward.

### Dimensions du Grid Search

| Dimension | Valeurs testees |
|-----------|----------------|
| Portfolio size | 1, 2, 3, 4, 5, 8, 10, 15, 20 |
| Top N signaux/scan | 1, 2, 3, 4, 5 |
| Score minimum | 0, 80, 85, 88, 90, 92, 95 |
| Horizon (jours) | 5, 10, 15, 20, 30 |
| Filtre strategie | all, no_sq, no_sq_pb, momentum_only, breakout_only |
| Rotation | none, daily_max1, daily_max2, aggressive |
| Partial TP | false, true (50% a TP1, trail le reste) |
| Trailing Stop | false, true (stop breakeven apres TP1, trail a 1.5R) |

### 5 Modes Optimaux (resultats 12/04/2026, sweep 13M combos)

1. **Turbo** : P1/Top1/mom_bo/none/H3/Trail=2%/BE=0.5%/PTP=50% -> +52.47%, DD -6.61%, WR 50%, PF 21.26x, 18 trades
2. **Dynamic** : P1/Top1/breakout_only/daily_max1/H3/Trail=3%/BE=1% -> +44.62%, DD -7.59%, WR 58.8%, PF 8.44x, 17 trades
3. **Balanced** : P1/Top1/momentum_only/aggressive/H8/ATR=1x -> +35%, DD -4%, WR 60%, PF 4.68x, R²=0.924, 10 trades
4. **Secured** : P3/Top1/breakout_only/none/H10/MaxSt=5% -> +18.57%, DD -2.2%, WR 68.4%, PF 4.12x, 19 trades
5. **Fortress** : P3/Top1/breakout_only/none/H10/MaxSt=5%/positionSizePct=0.5 -> +9.29%, DD -1.11%, WR 68.4%, PF 4.12x, 19 trades

### Choix des filtres (validation empirique sur 6 filtres x 5 profils)

| Filtre | Best use case | Raison |
|--------|--------------|--------|
| **mom_bo** | Turbo (H3, extreme) | Momentum+breakout = max return sur horizon court |
| **momentum_only** | Balanced (H8, risk-adjusted) | Meilleur R²=0.924, DD -4% vs -2.61% breakout sur H8 |
| **breakout_only** | Dynamic (H3), Secured/Fortress (H10) | Seul filtre avec DD<3% sur H10 (all/no_sq/momentum=5.85% DD) |

Les filtres momentum/all/no_sq ajoutent des signaux squeeze/momentum qui gagnent sur H3-H5 mais se retournent sur H10, gonflant le DD de -2.2% a -5.85%. breakout_only est le seul viable pour capital preservation.

### Usage

    node tools/sweep.js          # Full (98k combos, ~5 min)
    node tools/sweep.js --quick  # Quick (720 combos, ~30s)
    node tools/sweep.js --verbose # Debug output

### Outputs
- data/backtest-results.json : Resultats complets (top 20, optimal par metrique)
- data/portfolio-history.json : Equity curve du combo optimal

### Page publique
series/scanner-strategy/index.html — Guide des 5 modes avec ECharts, tabs, et instructions.

---

## 7. PIPELINE POST-SCAN (tools/publish-daily-card.sh)

Tout est automatise dans `publish-daily-card.sh` (voir section "Flux Post-Scan" en haut).

### Dependances

    npm install puppeteer form-data  # deja installe

### Configuration Telegram
.env dans la racine articles (gitignored) :

    TELEGRAM_BOT_TOKEN=xxxx:yyyy
    TELEGRAM_CHAT_ID=-100xxxxxxxxxx

### Scripts et source de donnees

| Script | Input | Output | Quand |
|--------|-------|--------|-------|
| `update-tracking.js` | scans HTML + Yahoo Finance | `scanner-metrics.json`, `scanner-positions.json` | Step 1 |
| `generate-scanner-image.js` | `scanner-metrics.json`, `scanner-positions.json` | `scanner-daily-card.html` + PNG Telegram | Step 2 |
| `sweep.js` | tous les scans + Yahoo OHLCV | `backtest-results.json`, `backtest-trades.json`, `portfolio-history.json` | Step 3 |
| `gen-3-cards.js` | `backtest-trades.json`, `modes-config.json` | `scanner/status/mode-{id}-{ts}.png` + `manifest.json` | Step 4 |
| `gen-status-page.js` | `backtest-trades.json`, `modes-config.json`, `backtest-results.json` | `scanner/status/index.html` (text-only, 5 tabs) | Step 5 |

**Single source of truth** : la page HTML et les tableaux sont generes depuis les memes fichiers JSON. Jamais de valeurs hardcodees.

**scanner/status/index.html** contient :
- Hero + 6 tabs (Turbo, Dynamic, Balanced, Secured, Fortress, TKL) avec KPIs, config, equity chart ECharts
- Tableau historique des trades par mode (ticker, date, strategy, entry, exit, P&L, duree, statut)
- Tableau comparatif des 6 modes
- Pas d'images (tout en texte/HTML)
- TKL (Thami Kabbaj-Like) : 30 positions, momentum small/mid-cap, no horizon limit, trailing stop

**Images PNG** (`gen-3-cards.js`) : utilisees uniquement pour Telegram/Discord, pas affichees sur la page status.
Noms timestampes (`mode-growth-{ts}.png`) avec `manifest.json` pour le cache busting.

**update-tracking.js** produit dans `scanner-metrics.json` :
- `return_total`, `profit_factor`, `total_days`, `scans_count`, `return_dd_ratio`
- `portfolio_history`, `drawdown_history` (arrays pour equity/DD curves)
- `working_capital_pct`, `pending_orders_pct`, `available_cash_pct`

**Service Worker** : supprime (sw.js = stub auto-unregister). Pas de cache SW.

### Lancer manuellement le sweep seul

    node tools/sweep.js && node tools/gen-3-cards.js && node tools/gen-status-page.js
