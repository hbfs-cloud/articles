---
name: mcp-forecast-timesfm
description: TimesFM 2.5-200M forecast service rules. Auto-load when user mentions forecast, TimesFM, ForecastRaw, ForecastVix, Backtest, or edits tools/forecast*. Validated empirically (120 points, 15 tickers). Covers UC1-6, CI bands, scanner post-screener integration, weekly sectoral rotation.
user_invocable: false
---

# MCP Forecast — TimesFM 2.5-200M

Serveur : `http://ser.tail5d09f.ts.net:8400/mcp/`
Headers obligatoires : `Content-Type: application/json` + `Accept: application/json, text/event-stream`
Outils : `Forecast`, `ForecastVix`, `ForecastRaw`, `Backtest`
Contraintes : max **10 tickers/call**, `lookback_days` ≤ 60, `context_length` ≤ 200

## ⚠️ RÈGLES D'UTILISATION (validées — 120 points, 15 tickers, avril 2026)

**JAMAIS afficher la direction TimesFM comme une prévision certaine.**
- Direction globale = 44.2% (pire que le hasard) — pas un signal tradable seul
- Exception : AMZN, META, SPY → 62–75% DIR sur lookback=20j — utilisable comme filtre de confirmation uniquement

**Ce qui marche (≥ 7/10) :**
- **UC2 — Volatilité** : passer ATR(14) ou RVOL(14) à `ForecastRaw` → DIR 67–73% → sizing dynamique et filtre pre_squeeze
- **UC3 — Volume** : passer la série de volume à `ForecastRaw` → DIR 69% → filtre breakout/faux-breakout
- **UC5 — Rotation sectorielle** : `Forecast` sur 10 ETFs sectoriels → ranking relatif valide (0.4s/ticker)
- **ForecastVix** → sizing et régime de marché ✅

**Ce qui est partiel (5–6/10) :**
- **UC1 — Prix/Close** : bandes CI [q10–q90] utilisables comme zones TP/SL calibrées (~80% couverture réelle). Direction = non fiable sauf AMZN/META/SPY
- **UC6 — Scoring setup** : CI_width + vol + secteur combo utile. `confidence` fixe à 0.95 = inutilisable comme filtre

**Ce qui ne marche pas (2/10) :**
- **UC4 — Earnings/XReg** : XReg non implémenté dans ce wrapper. Le modèle est **pire** autour des earnings (DIR 40% vs 56% hors earnings). → **EXCLURE les fenêtres ±3j autour des earnings dates**
- Quarterly fundamentals (revenue, earnings) : Yahoo < 10 trimestres → "Insufficient data"
- Tickers énergie (XOM : 12%), biotech small cap (SRPT : 25%), TSLA (25%) : direction non fiable

## Utilisation par contexte

**Dans une analyse ticker (section Trade Idea) :**
```
1. context_length=200, lookback=20j (fenêtre optimale)
2. Ticker dans {AMZN, META, SPY, NVDA} → direction utilisable comme filtre
3. Tous tickers → CI [lo–hi] = zones TP/SL calibrées (afficher comme "zone de support/résistance probabiliste")
4. Vérifier earnings ±3j → si oui, suspendre le forecast prix sur ce ticker
5. Ne jamais écrire "TimesFM prédit une hausse" → écrire "CI probabiliste : [X – Y]"
```

**Dans le scanner (post-screener) :**
```
1. ForecastRaw(volume[-150:], horizon=10) → pred_avg > avg20 × 1.1 = volume favorable ✅
2. ForecastRaw(ATR14[-150:], horizon=10) → ATR_forecast > ATR × 1.15 = expansion attendue → éviter
3. ForecastRaw(RVOL14[-150:], horizon=10) → RVOL < × 0.80 = compression probable → squeeze crédible
```

**Dans le weekly (rotation sectorielle) :**
```
Forecast({'tickers': [10 ETFs], 'context': 200, 'horizon': 10})
→ Trier par predicted_return_pct → ranking relatif (NE PAS citer les valeurs absolues)
→ Top 3 = biais long de la semaine | Bottom 3 = biais short / éviter
```

**ForecastVix :**
```
VIX prédit > 30 → doubler les bandes CI sur tous les forecasts prix
VIX prédit en hausse → réduire les tailles de position (sizing ∝ 1/ATR_forecast)
```

## AI Forecast — MCP (`mcp__forecast__*`)
Outils : `Forecast` (multi-ticker), `ForecastRaw` (série brute custom), `ForecastVix` (régime VIX), `Backtest` (validation accuracy).
Service Python + TimesFM sur `ser` (Nomad/Docker, port 8400). Graceful degradation partout — si service down, pipeline continue sans forecast.
**⚠️ XReg/covariates NON implémentées** dans le MCP (modèle TimesFM le supporte mais le wrapper ne l'expose pas → UC4 = FAIL).

### Évaluation empirique (120 points, 15 tickers, 8 fenêtres)

| Use Case | Score | Verdict |
|----------|-------|---------|
| UC1 — Close Forecast (prix) | 6/10 | PARTIEL — 44% direction globale, seulement indices/mega-caps (SPY 62%, AMZN/META 75%) |
| UC2 — Volatilité (ATR/RVOL) | 8/10 | FORT — vol mean-reverting, 67-73% direction, meilleur UC pour pre_squeeze |
| UC3 — Volume | 8.5/10 | TRÈS FORT — 69% direction, filtre breakout actionnable |
| UC4 — Earnings/XReg | 2/10 | FAIL — XReg non implémenté, modèle -16pp autour des earnings |
| UC5 — Multi-séries/Rotation | 7.5/10 | BON — ranking sectoriel cohérent, 0.4s/ticker, spread/ratio |
| UC6 — Scoring de setups | 5/10 | PARTIEL — direction seule = inutile, multi-facteur (CI_width + vol + secteur) = utile |

### Règles d'utilisation (OBLIGATOIRE)

**✅ UTILISER pour :**
- **Bandes CI** = zones TP/SL calibrées (q10-q90 couvre ~80% des réalisations)
- **Volatilité forecast** (ATR/RVOL) = pre_squeeze, sizing dynamique, alerte expansion vol
- **Volume forecast** = filtre faux breakout, confirmation volume, post-screener enrichi
- **Rotation sectorielle** = ranking relatif ETFs sectoriels (hebdo), spread/ratio forecast
- **Filtre de concordance** sur SPY, AMZN, META uniquement (≥62% précision)

**❌ NE PAS UTILISER pour :**
- Direction comme signal primaire (44% global = pire que le hasard)
- Horizon > 10j (bandes trop larges)
- Biotech/small-caps catalytiques (sauts FDA imprévisibles)
- Fenêtres earnings ±5j (exclure ces périodes)
- Confidence brute du modèle (toujours 0.95 = non discriminant, utiliser CI_width à la place)

### Architecture scanner (post-screener)
```
Pour chaque ticker retenu :
1. ForecastRaw(volume[-150:], horizon=10) → pred_avg > avg20×1.1 = volume favorable ✅
2. ForecastRaw(ATR[-150:], horizon=10) → RVOL_forecast < RVOL_now×0.80 = squeeze ✅
3. Forecast({tickers, horizon=10}) → CI haute = TP max réaliste
4. Si mega-cap/indice : direction = filtre confirmation
5. CI_width < 5% = confirmer | > 10% = réduire taille 50%
```

### Architecture rotation (weekly)
```
Chaque lundi :
1. Forecast({tickers: 10_ETFs_sectoriels, context: 200, horizon: 10})
2. Trier par predicted_return_pct → top 3 = biais long, bottom 3 = éviter
3. Spread (XLE/SPY, XLK/SPY) via ForecastRaw → axe macro
```

### Fenêtre optimale
- **Lookback** : 20j pour direction (67% sur mega-caps), 150 bars pour vol/volume
- **Horizon** : 5-10j max
