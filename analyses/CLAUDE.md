# DailyTickers - Analyses Instructions

## 2. ANALYSE INDIVIDUELLE (Ticker Analysis)


### Référence
**L'analyse TARA (`analyses/TARA/`) et CDIO (`analyses/CDIO/`)** sont les références pour la charte graphique, la structure HTML, les classes CSS, les ECharts, le switcher langue/niveau, et les 6 variantes. Toute nouvelle analyse doit suivre ce modèle en termes de qualité, longueur (~1000-1600+ lignes pour expert/fr), structure des sections, et style visuel.
**Langue par défaut : anglais, niveau intermédiaire** (sauf demande contraire).

### Template HTML Obligatoire (CRITIQUE)

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="en" data-tags="us,tech,ai,trade-idea,speculative" data-tab="analyses" data-grade="A+" data-level="intermediate">
```
- `lang` : langue (fr, en, ar)
- `data-tags` : tags pertinents (voir taxonomie CLAUDE.md racine)
- `data-tab="analyses"` : toujours "analyses"
- `data-grade` : note globale (A+, A, B+, B, C, D)
- `data-level` : "intermediate" (par défaut), "expert" ou "beginner"

#### CSS — Thème Light (`report.css`)
```html
<link rel="stylesheet" href="/assets/report.css">
```
**JAMAIS** de dossier `assets/` local.

#### Brand Bar (OBLIGATOIRE)
```html
<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo">
      <img src="/logo.svg" alt="" width="36" height="36">
      <span class="brand-title">DailyTickers</span>
    </a>
    <div class="brand-actions">
      <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
    </div>
  </div>
</nav>
```

#### Hero Section — `<header class="ticker-header">`
- Logo MW (`/logo.svg`) — JAMAIS logo société
- Switcher langue (drapeaux FR/EN/AR) + niveau (Expert/Beginner)
- Ticker symbol, exchange, date
- Prix actuel + variation
- Métriques : MCap, Volume, Float, Short Interest, Beta, 52W Range
- Badges : secteur, thème
- Bouton Historique
- Tags : `<div id="article-clickable-tags" class="card-tags"></div>`

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE)
```html
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#verdict" class="fnav-item" data-section="verdict"><i class="fas fa-gavel"></i><span>Verdict</span></a>
    <a href="#fondamentaux" class="fnav-item" data-section="fondamentaux"><i class="fas fa-chart-line"></i><span>Fondamentaux</span></a>
    <a href="#technique" class="fnav-item" data-section="technique"><i class="fas fa-chart-area"></i><span>Technique</span></a>
    <a href="#risques" class="fnav-item" data-section="risques"><i class="fas fa-shield-halved"></i><span>Risques</span></a>
    <a href="#social" class="fnav-item" data-section="social"><i class="fas fa-satellite-dish"></i><span>Social</span></a>
    <a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Trade Idea</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>
```
Adapter les items aux sections de l'analyse. ~6-12 items selon la complexité. JS : toggle, smooth scroll, IntersectionObserver.

#### Footer (OBLIGATOIRE)
```html
<footer class="article-footer">
  &copy; 2026 DailyTickers. Data via DailyTickers Gateway.
  Not financial advice.
  <br><a href="/" title="Home"><i class="fas fa-house"></i></a>
</footer>
```
**TOUJOURS** `class="article-footer"`. Jamais d'autre classe.

#### Scripts (OBLIGATOIRE — avant `</body>`)
```html
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
```

### Objectif
Analyse complète d'un ticker, lisible en 2 minutes. Style direct et punchy inspiré SLNH : headers avec emojis, bullet points courts, verdicts clairs par section. L'objectif est qu'un lecteur comprenne rapidement ce que fait la boîte, son setup, ses risques et si c'est un trade intéressant.

### ECharts Obligatoires par Section

**IMPORTANT** : Chaque analyse ticker doit inclure ces visualisations ECharts interactives :

1. **Section 1 (Hero)** : ECharts **Gauge** — Score global de conviction (0-100)
2. **Section 3 (Verdict Express)** : ECharts **Radar** — Profil fondamental (6 axes: Marges, ROE, Croissance Rev, Cash Flow, Valuation, Momentum)
3. **Section 5 (Analyse Technique)** :
   - ECharts **Candlestick** — Prix OHLCV + volume derniers 90 jours (interactif, zoom, tooltip)
   - ECharts **Heatmap** — Calendrier de performance quotidienne 90j
4. **Section 6 (Performance & Benchmarks)** :
   - ECharts **Line** — Comparaison vs SPY/QQQ/Sector ETF (YTD + 1Y)
   - ECharts **Boxplot** — Distribution des returns vs peers (quartiles)
5. **Section 8 (Risques)** :
   - ECharts **Radar** — Profil de risque (6 axes: Dilution, Burn Rate, Beta, Short Interest, Insider Selling, Macro Risk)
   - ECharts **Gauge** — Score de risque global (0-10)
6. **Section 11 (Comparaison Concurrents)** :
   - ECharts **Parallel Coordinates** — Comparaison multi-facteurs (revenus, marges, P/E, croissance, beta)
   - ECharts **Treemap** — Capitalisation boursière du secteur (taille = market cap, couleur = YTD %)
7. **Section 13 (Bottom Estimation - EXPERT)** :
   - ECharts **Gauge** — Probabilité de bottom (0-100%)
   - ECharts **Calendar Heatmap** — Performance quotidienne 90j pour patterns saisonniers
   - ECharts **Bar Horizontal** — Barres de confluence technique

**Résultat** : ~8-10 charts ECharts par analyse = expérience ultra-visuelle et interactive

### Règles AI Forecast (CRITIQUE)

1. **NE JAMAIS mentionner le nom du modèle** (TimesFM, etc.) dans l'article. Utiliser "AI model", "AI forecast", "our AI model" — le lecteur ne doit pas voir le nom technique.
2. **Section AI Forecast** : titre = `AI Price Forecast` (pas "AI Forecast — TimesFM"). Icône `fa-brain`, pas `fa-robot`.
3. **Didactique obligatoire** : ajouter un `didactic-box` expliquant en termes simples comment le forecast fonctionne (ex: "Our AI model analyzes X days of price history to project the most likely path over the next Y trading days. The shaded band shows the range where the price is expected to land with 90% confidence.").
4. **Forecast cross-sections** : Le forecast doit enrichir TOUTES les sections pertinentes :
   - **Performance & Benchmarks** : ajouter une `didactic-box` liant le momentum historique au forecast (ex: "Despite +25% momentum, the AI projects flat consolidation — the rally may need to digest gains.")
   - **Capital Flow** : lier les flux au forecast dans l'alert-box
   - **Trade Idea** : calibrer les niveaux entry/TP sur les données forecast (bands, direction)
5. **Disclaimer** : "AI forecast model" (pas de nom de modèle)

### Règles Trade Idea (DESIGN)

La section Trade Idea doit être lisible et propre :
1. **Price ladder** : grid avec cards à bordure gauche colorée (bleu=entry, rouge=stop, vert=TP, violet=R:R)
   ```html
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;">
       <div style="border-left:4px solid #3b82f6;padding:1rem;background:#f8fafc;border-radius:0 8px 8px 0;">
           <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;font-weight:600;">Entry Zone</div>
           <div style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0.25rem 0;">$91 – $92</div>
           <div style="font-size:0.78rem;color:#64748b;">Pullback to support</div>
       </div>
   </div>
   ```
2. **Séparation claire** entre thesis, catalysts, invalidation, timeline
3. **Pas de `.trade-levels` CSS** — utiliser le pattern grid ci-dessus
4. **Mobile-first** : minmax(160px, 1fr), font-sizes lisibles

### Règles FAB Navigation (CONFORMITÉ)

Le FAB doit suivre le pattern IOVA (référence) :
1. **8 items minimum** : Verdict, Fundamentals, Technical, Risks, Social, Options, Trade Idea, Forecast
2. **JS pattern** : `fnavMenu.style.display = fnavOpen ? 'flex' : 'none'` — JAMAIS `classList.toggle('active')`
3. **Fermeture** : `fnavMenu.style.display = 'none'` au clic sur un item
4. **Labels en anglais** pour les articles en anglais

### 17 Sections Obligatoires

#### 1. Header (`.ticker-header`)
- **IMPORTANT** : Le brand link doit **TOUJOURS** utiliser le logo DailyTickers (`https://articles.dailytickers.com/logo.svg`), **JAMAIS** le logo de la société (parqet.com). Le logo société est réservé aux cartes de listing dans index.html uniquement.
- Ticker, exchange, date, lien retour site (`href="/"`)
- Brand link : `<img src="https://articles.dailytickers.com/logo.svg" alt="MW">` + texte "MARKET WATCH", `color:#0f172a`, pas de `filter:brightness` sur le logo
- Prix actuel, variation jour, variation semaine
- Métriques clés en `.ticker-metrics` : MCap, Volume, Float, Short Interest, Beta, 52W Range
- Badges : secteur, exchange, thème
- Bouton **Historique** : `border:1px solid #cbd5e1; color:#64748b` → ouvre modal avec versions datées
- **Chart Finviz cliquable** : juste après le header, avant `<div class="container">`
  ```html
  <div style="max-width:900px; margin:0 auto; padding:0 1rem;">
      <div onclick="openChartModal()" style="cursor:pointer; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
          <img src="https://charts2.finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p=d&s=l" alt="{TICKER} Chart" style="width:100%; display:block;">
          <div style="background:#f8fafc; padding:6px 12px; font-size:0.7rem; color:#64748b;">
              <span><i class="fa-solid fa-chart-line"></i> Cliquer pour agrandir</span>
          </div>
      </div>
  </div>
  ```
- **Modal Chart** avant `</body>` : fond dark `#0f172a`, chart agrandi + 3 liens (Finviz, TradingView, Yahoo Finance), fermeture par clic overlay ou Escape

#### 2. Verdict Express (`.score-card` + `.verdict-grid`)
**Section la plus importante** — doit suffire à elle seule pour comprendre le titre.
- **Score-card** : Note globale (A+ à D), conviction, biais, confiance %
- **Ce que fait la boîte** : 2-3 phrases max, business model clair
- **Setup actuel** : haussier / baissier / neutre avec justification courte (alert-box)
- **Verdict-grid** (2 colonnes) :
  - 3 raisons d'acheter (`.verdict-pro`) — bullet points avec emojis verts
  - 3 raisons d'éviter (`.verdict-con`) — bullet points avec emojis rouges

#### 3. Activité
- Business model en 2-3 phrases
- Segments principaux avec métriques
- Secteur, classification, thème d'investissement
- Ce qui différencie l'entreprise (moat ou absence de moat)

#### 4. Actualités Récentes (`.news-list`)
- 4-6 news récentes avec dates et source
- Format `.news-item` : date + titre + impact (positif/négatif/neutre)
- Impact sur le cours en 1 phrase

#### 5. Fondamentaux
- Table `.data-table` : Revenus, EBITDA, Résultat net, EPS, Marges (brute, opé, nette), Cash, Dette, P/B, P/E, Target analystes
- Interprétation clé de chaque métrique importante
- Comparaison sectorielle si pertinent
- Alert-box si cash runway < 12 mois

#### 6. Insiders & Institutions
- % insiders, noms des principaux + rôles
- % institutions, top 3-5 holders avec % détenu
- Mouvements récents (achats/ventes) avec montants
- Signal : insiders achètent = bullish, vendent = bearish

#### 7. Structure du Capital & Dilution (CRITIQUE)
**Section dédiée à la structure capitalistique** — crucial pour les small/mid caps.
Utiliser des `.risk-card` pour chaque élément :
- **Actions en circulation** vs authorized shares (marge de dilution)
- **Warrants** : nombre, strike price, date d'expiration, dilution potentielle %
- **Preferred Stock** : séries, conversion ratio, droits de liquidation
- **Convertibles** : montant, taux de conversion, trigger price
- **ATM Programs** : montant autorisé, montant utilisé, reste disponible
- **Shelf Registrations** : S-3 actifs, montant enregistré
- **Historique de dilution** : nb de shares il y a 1/2/5 ans vs aujourd'hui
- Verdict : risque de dilution faible / modéré / élevé / critique

##### Warrants — Analyse Détaillée (OBLIGATOIRE si warrants détectés)
**Collecte automatique** : `WebSearch "{TICKER} SEC EDGAR warrants"` + `WebSearch "{TICKER} warrants strike price expiration"` + `QueryData types=flags,sec_filings` + vérifier les prospectus S-1/S-3 pour les conditions exactes.

**Tableau obligatoire** pour chaque série de warrants :
```html
<table class="data-table">
  <thead>
    <tr><th>Série</th><th>Type</th><th>Strike ($)</th><th>Shares</th><th>Émission</th><th>Expiration</th><th>Dilution %</th><th>Impact</th></tr>
  </thead>
  <tbody>
    <tr><td>Series A</td><td>Public</td><td>$11.50</td><td>5,000,000</td><td>Jan 2024</td><td>Jan 2029</td><td>8.2%</td><td class="text-red">Élevé</td></tr>
    <!-- ... -->
  </tbody>
</table>
```

**Métriques obligatoires par série** :
- **Type** : Public / Private / Underwriter / Compensation / Pre-funded
- **Strike price** : prix d'exercice ($) — comparer au cours actuel (ITM/OTM/ATM)
- **Volume** : nombre de shares sous-jacentes
- **Date d'émission** : quand les warrants ont été émis
- **Date d'expiration** : deadline d'exercice
- **Dilution potentielle (%)** : shares warrants / (outstanding + shares warrants) × 100
- **Statut** : ITM (In The Money) si strike < cours / OTM / Expiré
- **Cashless exercise** : oui/non — si oui, dilution réduite mais toujours présente
- **Acceleration clause** : conditions de forçage d'exercice anticipé (souvent si cours > X$ pendant Y jours)

**ECharts Timeline** (si ≥ 2 séries) : barre horizontale montrant la période de vie de chaque série de warrants (émission → expiration) avec le strike price annoté. Couleur : vert si OTM loin, orange si proche ATM, rouge si ITM.

**Impact global** : calculer la dilution totale si TOUS les warrants sont exercés. Afficher en `.alert-box` rouge si > 15%, orange si 5-15%, vert si < 5%.

**Sources** : SEC EDGAR (S-1, S-3, prospectus), DEF 14A (proxy), 10-K notes (shareholders equity), rapports trimestriels 10-Q.

#### 8. Short Interest & Squeeze
- Actions short, % du float, days to cover, CTB (cost to borrow)
- Historique SI sur 3-6 mois (tendance)
- Analyse du potentiel squeeze : score et conditions requises
- Dark pool activity si disponible
- CTB élevé = shorts sous pression = potentiel squeeze

#### 9. Dérivés (Options)
- Call/Put OI, ratio C/P, Max Pain, IV moyenne
- Biais directionnel (skew)
- Unusual options activity si détectée
- Impact du max pain sur le prix court terme

#### 10. Technique (Journalier)
- Table : RSI14, MACD, Signal, EMAs (20/50/200), ATR, OBV
- Phase Wyckoff (Accumulation / Markup / Distribution / Markdown)
- Supports et résistances clés (3 niveaux chaque)
- Structure de prix : tendance, pattern, divergences
- Signal global : achat / vente / neutre

#### 11. Secteur / Pairs
- Table de corrélation avec 4-5 pairs du secteur
- Performance relative YTD vs pairs et indice sectoriel
- Positionnement : leader / suiveur / retardataire
- Beta sectoriel

#### 12. Macro
- Table : BTC, ETH, SPX, VIX, DXY, TLT (ou actifs pertinents)
- Beta et corrélations avec indices macro
- Régime de marché actuel (risk-on / risk-off / neutre)
- Impact macro spécifique sur le titre

#### 13. Bottom Estimation & Setups Avancés (EXPERT ONLY)
**Section réservée au mode expert** — analyse de précision pour l'estimation des points bas et la détection de setups en formation.

**a) Estimation du Bottom (`.content-card`)**

**ECharts Gauge** : Probabilité de bottom (0-100%) avec couleur selon conviction (rouge <30%, orange 30-60%, vert >60%)

**ECharts Heatmap** : Calendrier de performance derniers 90 jours (calendar heatmap) pour identifier patterns saisonniers

**ECharts Bar Horizontal** : Barres de confluence montrant la convergence de niveaux techniques

Utiliser toutes les données disponibles pour triangler une zone de bottom probable :

- **Volume Profile** : identifier le Point of Control (POC) et les Value Areas (VA High/Low) via `QueryData` types=volume_profile. Le bottom probable se situe souvent au VAL ou en dessous.
- **Support & Résistance** : `QueryData` types=support_resistance — croiser les niveaux S/R avec le volume profile
- **Fibonacci Retracements** : calculer les niveaux 0.382, 0.5, 0.618, 0.786 depuis le dernier swing high
- **Moyennes mobiles clés** : SMA 200, EMA 50, VWAP — zones de confluence
- **RSI historique** : identifier les niveaux de RSI auxquels le titre a historiquement rebondi (RSI floor)
- **ATR-based target** : projeter un bottom via ATR × multiplicateur depuis le dernier support
- **Options Max Pain** : `QueryData` types=options_chain — le max pain agit comme un aimant
- **Analyse Wyckoff** : phase actuelle (Spring ? Test ? Sign of Strength ?)
- **Divergences** : RSI/MACD bullish divergences sur daily et weekly

**Format de sortie** :
```html
<div class="bottom-estimate">
    <h4>Zone de Bottom Estimée</h4>
    <div class="bottom-levels">
        <div class="bottom-level bottom-optimistic">
            <span class="label">Scénario Optimiste</span>
            <span class="price">${prix}</span>
            <span class="basis">Confluence SMA200 + Fib 0.382</span>
        </div>
        <div class="bottom-level bottom-base">
            <span class="label">Scénario Central</span>
            <span class="price">${prix}</span>
            <span class="basis">POC + Fib 0.618 + RSI floor</span>
        </div>
        <div class="bottom-level bottom-pessimistic">
            <span class="label">Scénario Pessimiste</span>
            <span class="price">${prix}</span>
            <span class="basis">VAL + Fib 0.786 + Spring Wyckoff</span>
        </div>
    </div>
    <div class="bottom-confidence">Confiance : {N}% — basée sur {N} confluences</div>
</div>
```

**Barres de confluence** : plus il y a de niveaux techniques qui convergent vers une zone, plus la confiance est élevée. Afficher visuellement les confluences avec des barres horizontales (ECharts bar chart horizontal).

**b) Setups en Formation**

Lister les setups techniques en cours de formation (pas encore déclenchés) :
- **Pattern en formation** : triangle, wedge, cup & handle, head & shoulders (inverse), flag
- **Accumulation Wyckoff** : PS, SC, AR, ST, Spring — identifier la phase
- **Compression de volatilité** : Bollinger Bands squeeze, ATR en contraction → breakout imminent
- **Divergences en construction** : RSI/MACD qui divergent du prix
- **Volume dry-up** : volume qui décroît dans un range = accumulation silencieuse

Pour chaque setup :
```html
<div class="setup-card">
    <div class="setup-header">
        <span class="setup-pattern">{Pattern}</span>
        <span class="setup-status badge badge-blue">En formation</span>
        <span class="setup-timeframe">{Timeframe}</span>
    </div>
    <div class="setup-body">
        <p><strong>Trigger :</strong> {condition de déclenchement}</p>
        <p><strong>Target :</strong> {objectif si déclenché}</p>
        <p><strong>Invalidation :</strong> {condition d'annulation}</p>
    </div>
    <div class="setup-progress">
        <div class="progress-bar" style="width:{N}%"></div>
        <span>Formation : {N}% complète</span>
    </div>
</div>
```

#### 14. Détection de Manipulations & Signaux Sociaux (EXPERT ONLY)
**Section critique** — analyse forensique des anomalies de marché et surveillance des réseaux sociaux.

**a) Anomalies de Marché & Manipulations Potentielles**

Collecter et croiser les données suivantes :
- `QueryData` types=dark_pool — activité dark pool anormale
- `QueryData` types=ftd_threshold — Failures-to-Deliver (FTD) élevés = manipulation potentielle
- `QueryData` types=ctb,ctb_history — Cost to Borrow anormal (spikes = squeeze en préparation ou manipulation short)
- `QueryData` types=unusual_options — options unusuelles (gros blocks, sweeps) = informed trading
- `QueryData` types=insider_transactions — insiders qui vendent massivement avant une annonce
- `QueryData` types=bars_intraday — spikes de volume intraday inexpliqués (dark pool prints, block trades)

**Signaux de manipulation à détecter** :

| Signal | Données | Interprétation |
|--------|---------|----------------|
| **Spoofing/Layering** | Spikes de volume sans mouvement de prix | Ordres fictifs pour manipuler le carnet |
| **Wash Trading** | Volume anormalement élevé vs float | Échanges entre entités liées |
| **Short Ladder Attack** | Baisses rapides sur faible volume | Shorts coordonnés avec petits lots |
| **FTD Accumulation** | FTDs > 0.5% du float | Naked shorting potentiel |
| **Dark Pool Divergence** | Dark pool price vs lit market | Accumulation/distribution cachée |
| **Insider Front-Running** | Insiders trade avant news | Délit d'initié potentiel |
| **Options Sweeps** | Gros block calls/puts OTM | Informed trading avant catalyseur |

**Format de sortie** :
```html
<div class="manipulation-alert">
    <div class="alert-header">
        <i class="fa-solid fa-magnifying-glass-dollar"></i>
        <h4>Anomalie Détectée : {Type}</h4>
        <span class="badge badge-{severity}">{Sévérité}</span>
    </div>
    <div class="alert-body">
        <p><strong>Données :</strong> {chiffres factuels}</p>
        <p><strong>Interprétation :</strong> {ce que ça pourrait signifier}</p>
        <p><strong>Historique :</strong> {est-ce récurrent ou nouveau ?}</p>
    </div>
</div>
```

**IMPORTANT** : Ne jamais accuser directement. Utiliser des formulations prudentes : "pattern compatible avec...", "anomalie qui pourrait suggérer...", "historiquement associé à...". Citer les données factuelles et laisser le lecteur tirer ses conclusions.

**b) Analyse Tendances Réseaux Sociaux (MULTI-PLATEFORME OBLIGATOIRE)**

Collecter via :
- `QueryData` types=sentiment_stocktwits,sentiment_reddit,sentiment_youtube — sentiment multi-plateforme
- `QueryData` types=stocktwits_messages — messages récents pour analyse qualitative
- WebSearch "{TICKER} reddit wallstreetbets mentions" — historique Reddit/WSB, score bullish, upvotes
- WebSearch "{TICKER} stock Twitter X fintwit" — activité X/Twitter, cashtag $TICKER
- WebSearch "{TICKER} google trends stock interest" — spikes de recherche Google, corrélation avec le prix
- WebSearch "{TICKER} stock forum discussion hype" — InvestorsHub, Seeking Alpha, Yahoo Finance forums
- Vérifier ChartExchange (`chartexchange.com/symbol/{exchange}-{ticker}/trends/reddit/`) et ApeWisdom (`apewisdom.io/stocks/{TICKER}/`) pour les données Reddit quantitatives

**6 Plateformes à couvrir systématiquement** :

| Plateforme | Icône FA | Données à collecter |
|------------|----------|---------------------|
| **StockTwits** | `fa-brands fa-rocketchat` | Messages/24h, ratio bull/bear, comptes actifs, thèmes dominants |
| **Reddit / WSB** | `fa-brands fa-reddit` | Mentions/24h, upvotes, score bullish (ApeWisdom), ranking WSB |
| **X / Twitter** | `fa-brands fa-x-twitter` | Cashtag activity, FinTwit mentions, influencers, spikes |
| **Google Trends** | `fa-brands fa-google` | Search interest spikes, corrélation avec les mouvements de prix |
| **YouTube** | `fa-brands fa-youtube` | Nombre de vidéos récentes, titres clickbait, thumbnails pump |
| **Forums** | `fa-solid fa-building` | InvestorsHub, Seeking Alpha, Yahoo Finance — qualité des discussions |

**Éléments à analyser** :

| Métrique | Source | Signal |
|----------|--------|--------|
| **Volume de mentions** | StockTwits, Reddit, YouTube, X | Spike soudain = attention (pump ou catalyseur réel) |
| **Ratio Bull/Bear** | StockTwits sentiment | > 80% bulls après +50% = euphorie dangereuse |
| **Comptes suspects** | Reddit, StockTwits, X | Comptes récents qui postent massivement = pump coordonné |
| **YouTube pumpers** | YouTube sentiment | Vidéos "NEXT 100X" avec thumbnails clickbait = red flag |
| **Google Trends spike** | Google Trends | Spike de recherche sans catalyseur fondamental = buzz artificiel |
| **Cashtag velocity** | X/Twitter | $TICKER trending soudainement = attention retail massive |
| **Divergence prix/sentiment** | Croisement données | Prix monte mais sentiment neutre = institutionnel. Prix stable mais sentiment explose = pump retail |

**Détection Pump & Dump** :

Critères d'alerte (au moins 3 sur 6 = alerte P&D) :
1. Volume de mentions multiplié par > 5x en 48h sans news fondamentale
2. Comptes de moins de 30 jours représentent > 40% des posts
3. Promesses de rendement spécifiques ("going to $X")
4. Prix a déjà monté de > 30% quand le buzz commence (= distribution)
5. Float faible (< 20M shares) facilitant la manipulation
6. Absence de couverture institutionnelle/analyste

**Format de sortie** :
```html
<div class="social-radar">
    <h4><i class="fa-solid fa-satellite-dish"></i> Radar Social — Analyse Multi-Plateforme</h4>
    <!-- Grid de 6 cartes : une par plateforme -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem;">
        <div class="social-metric-card">
            <i class="fa-brands fa-rocketchat"></i>
            <div class="platform">StockTwits</div>
            <div class="mentions">{N} msgs/48h</div>
            <span class="badge badge-{color}">{trend}</span>
            <div class="detail">{ratio bull/bear}</div>
        </div>
        <div class="social-metric-card">
            <i class="fa-brands fa-reddit"></i>
            <div class="platform">Reddit / WSB</div>
            <div class="mentions">{N} mentions/24h</div>
            <span class="badge badge-{color}">{trend}</span>
            <div class="detail">Bullish score {N}/100 • {N} upvotes</div>
        </div>
        <div class="social-metric-card">
            <i class="fa-brands fa-x-twitter"></i>
            <div class="platform">X / Twitter</div>
            <div class="mentions">{cashtag activity}</div>
            <span class="badge badge-{color}">{trend}</span>
            <div class="detail">{FinTwit mentions, spikes}</div>
        </div>
        <div class="social-metric-card">
            <i class="fa-brands fa-google"></i>
            <div class="platform">Google Trends</div>
            <div class="mentions">{spike info}</div>
            <span class="badge badge-{color}">{trend}</span>
            <div class="detail">{corrélation prix}</div>
        </div>
        <div class="social-metric-card">
            <i class="fa-brands fa-youtube"></i>
            <div class="platform">YouTube</div>
            <div class="mentions">{nb vidéos récentes}</div>
            <span class="badge badge-{color}">{trend}</span>
            <div class="detail">{clickbait check}</div>
        </div>
        <div class="social-metric-card">
            <i class="fa-solid fa-building"></i>
            <div class="platform">Analystes</div>
            <div class="mentions">{N} couvrent</div>
            <span class="badge badge-{color}">{consensus}</span>
            <div class="detail">Targets: ${min}-${max}</div>
        </div>
    </div>
    <div class="pump-dump-score">
        <h4>Score Pump & Dump : {N}/6</h4>
        <div class="pd-checklist">
            <div class="pd-item {pass|fail}"><i class="fa-solid fa-{check|xmark}"></i> {Critère}</div>
            <!-- 6 critères -->
        </div>
        <div class="pd-verdict badge badge-{green|orange|red}">{Clean | Suspect | Alerte P&D}</div>
    </div>
</div>
```

**Verdicts possibles** :
- **Score 0-1/6** → `badge-green` "Clean" — Activité sociale normale
- **Score 2-3/6** → `badge-purple` "Suspect" — Surveiller de près, ne pas FOMO
- **Score 4-6/6** → `badge-red` "Alerte P&D" — Très probablement une tentative de pump & dump

**c) SEC Filings & Détection de Fonds Hostiles (EXPERT ONLY)**

**Collecte obligatoire** :
- `QueryData` types=sec_filings symbols={TICKER} days=90 — dépôts SEC récents
- WebSearch "{TICKER} SEC filing 13D 13G activist investor hostile fund" — recherche de Schedule 13D (activiste) vs 13G (passif)
- WebSearch "{TICKER} short seller report Hindenburg Citron Muddy Waters Kerrisdale" — rapports de short sellers activistes
- `QueryData` types=insider_transactions — corrélation avec les dépôts

**Filings à surveiller** :

| Filing | Signification | Signal |
|--------|---------------|--------|
| **Schedule 13D** | Investisseur > 5% avec **intention d'influencer** la direction | **ALERTE HOSTILE** — activiste, prise de contrôle potentielle, proxy fight |
| **Schedule 13G** | Investisseur > 5% **passif** | Neutre à positif — accumulation institutionnelle sans intention hostile |
| **Schedule 13G/A** | Amendement d'un 13G existant | Vérifier si le % augmente ou diminue |
| **Form 4** | Transactions insiders (CEO, CFO, board) | Ventes massives avant news = red flag. Achats = signal positif |
| **8-K** | Événement matériel (offering, acquisition, changement direction) | Vérifier le contenu : dilutif ? Restructuration ? |
| **S-3 / S-1** | Registration statement (nouvelle émission d'actions) | Signal de dilution potentielle |
| **DEF 14A (Proxy)** | Assemblée générale, votes | Proxy fight = activiste en cours |
| **SC TO-T** | Tender Offer (OPA) | Prise de contrôle hostile en cours |

**Short Sellers Activistes à surveiller** :
- Hindenburg Research (fermé jan 2025, mais archives toujours actives)
- Citron Research (Andrew Left — problèmes légaux SEC)
- Muddy Waters Research (Carson Block)
- Kerrisdale Capital
- Spruce Point Capital
- Grizzly Research
- Iceberg Research
- Blue Orca Capital

**Format de sortie** :
```html
<h3><i class="fa-solid fa-file-shield"></i> SEC Filings & Surveillance Fonds Hostiles</h3>
<div class="data-table">
    <table>
        <thead><tr><th>Date</th><th>Filing</th><th>Émetteur</th><th>Détail</th><th>Signal</th></tr></thead>
        <tbody>
            <tr><td>{date}</td><td><span class="badge badge-{color}">{type}</span></td><td>{nom}</td><td>{détail}</td><td>{interprétation}</td></tr>
        </tbody>
    </table>
</div>
<div class="pedagogy-box">
    <h4><i class="fa-solid fa-shield-halved"></i> Verdict Fonds Hostiles</h4>
    <p><strong>{Aucun fonds hostile détecté / Activiste identifié / Short seller report publié}</strong> — {détail et implications}</p>
</div>
```

**IMPORTANT** : Toujours vérifier la **nature du filing** (13D = hostile, 13G = passif). Un 13G qui se convertit en 13D est un signal d'alerte majeur. Les rapports de short sellers doivent être mentionnés avec les contre-arguments si disponibles.

**d) Synthèse Intégrité du Marché**

Pedagogy-box finale combinant les trois sous-sections :
- "Le marché de {TICKER} est {propre / sous surveillance / suspect}"
- Résumé des anomalies détectées (ou absence d'anomalie)
- Status SEC filings : présence/absence de fonds hostiles, short seller reports
- Conseil actionnable : "Trader normalement" / "Taille réduite, stops serrés" / "Éviter jusqu'à normalisation"

---

#### 15. Analyse des Risques (REFONTE UX — World-Class)
**Section critique** — format premium avec risk-summary, risk-grid et risk-cards enrichies.

**Structure obligatoire** :

```html
<div id="risques" class="content-card">
    <h2>Analyse des Risques</h2>

    <!-- 1. Risk Summary (header dark avec gauge) -->
    <div class="risk-summary">
        <div class="risk-gauge" style="border-color:{COLOR};">
            <div class="risk-gauge-score" style="color:{COLOR};">{N}/10</div>
            <div class="risk-gauge-label">Risque</div>
        </div>
        <div class="risk-summary-detail">
            <h3>Profil de risque : {Faible|Modéré|Élevé|Très Élevé}</h3>
            <p>{Résumé 1-2 phrases du profil de risque global}</p>
            <div class="risk-tags">
                <span class="risk-tag risk-tag-{severity}">{Tag court}</span>
                <!-- 3-5 tags max -->
            </div>
        </div>
    </div>

    <!-- 2. Risk Grid (2 colonnes responsive) -->
    <div class="risk-grid">

        <div class="risk-card risk-card-{critical|high|medium|low}">
            <div class="risk-card-header">
                <div class="risk-card-icon"><i class="fa-solid fa-{icon}"></i></div>
                <h4>{Titre du risque}</h4>
                <span class="risk-severity">{Critique|Élevé|Moyen|Faible}</span>
            </div>
            <div class="risk-card-body">
                <ul>
                    <li>{Point factuel}</li>
                    <!-- 2-4 bullet points -->
                </ul>
                <div class="risk-meters">
                    <div class="risk-meter">
                        <div class="risk-meter-label">Probabilité</div>
                        <div class="risk-meter-bar"><div class="risk-meter-fill" style="width:{N}%;"></div></div>
                    </div>
                    <div class="risk-meter">
                        <div class="risk-meter-label">Impact</div>
                        <div class="risk-meter-bar"><div class="risk-meter-fill" style="width:{N}%;"></div></div>
                    </div>
                </div>
            </div>
            <div class="risk-verdict"><i class="fa-solid fa-{icon}"></i> {Verdict en 1 phrase}</div>
        </div>
        <!-- ... autres risk-cards ... -->

    </div>

    <div class="pedagogy-box">
        <h4>{Synthèse / Pourquoi le prix est X}</h4>
        <p>{Explication 3-4 phrases}</p>
    </div>
</div>
```

**Score gauge** : 1-3 = Faible (#22c55e), 4-5 = Modéré (#3b82f6), 6-7 = Élevé (#f59e0b), 8-10 = Très Élevé (#ef4444)

**Severity classes** : `.risk-card-critical` (rouge), `.risk-card-high` (orange/amber), `.risk-card-medium` (bleu), `.risk-card-low` (vert)

**Verdict icons** : critical → `fa-skull-crossbones`, high → `fa-triangle-exclamation`, medium → `fa-circle-info`, low → `fa-circle-check`

**Risk-card icons** (Font Awesome, adapter au contenu) :
- Prix/Corrélation → `fa-chart-line`
- Géopolitique → `fa-globe`
- Valorisation → `fa-scale-balanced`
- Cash/Dilution/Finance → `fa-money-bill-trend-up`
- Concurrence → `fa-building`
- Tech/Pipeline/FDA → `fa-flask`
- Cyclicité → `fa-arrows-spin`
- Management → `fa-user-tie`
- Spin-off → `fa-code-branch`
- Liquidité → `fa-water`
- Short/Squeeze → `fa-arrow-down-up-across-line`
- Crypto/Mining → `fa-microchip`
- Rally/Momentum → `fa-rocket`

**8 Catégories de risque obligatoires à évaluer** :

**a) Dilution & Warrants**
- Nombre de warrants, strikes, dates d'expiration
- Dilution potentielle en % du float
- Impact mécanique : à quel prix les warrants s'exercent et créent de la pression vendeuse
- Verdict : dilution imminente ou non

**b) Fonds Toxiques / Death Spiral — VÉRIFICATION OBLIGATOIRE**
- Présence de PIPE deals, convertibles toxiques, prospectus de dilution récent (S-1, S-3, 424B dans les 90 jours)
- **Banques d'investissement agressives** — si présentes dans un deal récent, c'est un signal rouge majeur :
  - WC Wainwright, Maxim Group, Dawson James, Ladenburg Thalmann, Aegis Capital
  - Ces fonds accompagnent systématiquement les offres dilutives et revendent immédiatement
  - WebSearch : `"{TICKER} Wainwright" OR "{TICKER} Maxim Group" OR "{TICKER} Dawson James" offering 2025 2026`
- Fonds connus pour shorter après financement : Hudson Bay Capital, Armistice Capital, Sabby Management, Empery Asset Management
- **ATM program actif** : vérifier SEC filing via WebSearch `"{TICKER}" site:sec.gov "at-the-market"`
- **Reverse split** dans les 12 mois → signal de détresse critique
- Verdict : présence ou absence de fonds toxiques + niveau de risque de dilution imminente

> **CAS INDO** : L'action n'affichait aucun signal technique négatif sur la fiche. Mais WC Wainwright + warrants actifs = dilution concrétisée. Ce type de risque N'APPARAÎT PAS dans les données de prix classiques. Seule la vérification SEC active permet de le détecter.

**c) ATM Offerings & Shelf Registrations**
- Programme ATM actif ? Montant autorisé vs utilisé
- S-3 shelf registration actif ? Capacité restante
- Historique d'utilisation (fréquence, montants)
- Verdict : risque d'ATM surprise ou non

**d) Short Interest & Pression Vendeuse**
- SI % du float, tendance, CTB
- Shorts institutionnels identifiés si possible
- Mécaniques : fails-to-deliver, threshold list
- Verdict : pression short en augmentation ou diminution

**e) Cash Burn & Viabilité**
- Cash actuel, burn rate trimestriel
- Runway en mois au rythme actuel
- Timeline vers breakeven ou prochain financement
- Verdict : viable X mois, besoin de financement avant Y

**f) Execution Risk**
- Projets annoncés vs livrés (track record)
- Dépendance à des événements futurs (approbation FDA, contrat, etc.)
- Management : expérience, turnover, crédibilité
- Verdict : exécution fiable ou risquée

**g) Régulation / Légal**
- Enquêtes en cours, litiges, risques réglementaires
- Changements de régulation anticipés
- Verdict : risque légal faible / modéré / élevé

**h) Concentration / Dépendance**
- Dépendance à 1 client, 1 produit, 1 marché, 1 actif
- Risque de corrélation (ex: BTC pour les miners)
- Diversification des revenus
- Verdict : concentration élevée / modérée / faible

Terminer par un **résumé des risques** en pedagogy-box : "Pourquoi le prix est bas / élevé" en 3-4 phrases.

#### 16. Trade Idea (`.trade-box`)
Format visuel avec classes CSS dédiées :
- `.trade-levels` grid avec 4 cartes :
  - `.trade-entry` : prix d'entrée + zone
  - `.trade-stop` : stop loss + % de perte
  - `.trade-tp` : target(s) + % de gain
  - `.trade-rr` : ratio risk/reward
- **Thèse** en `.pedagogy-box` : pourquoi ce trade, en 2-3 phrases
- **Catalyseurs** : liste à puces des événements déclencheurs
- **Invalidation** en `.alert-box` : conditions qui annulent le trade
- **Timeline** : horizon du trade (swing, position, long terme)

#### 17. Note Globale
- Conviction : A+ (très haute) à D (très faible)
- Biais : Haussier / Baissier / Neutre
- Confiance : % basé sur la qualité des données
- Profil : Spéculatif / Croissance / Value / Momentum / Contrarian
- **Key Takeaways** : 3 points positifs + 3 risques majeurs
- **Mindset Tip** : conseil psychologique pour le trader (FOMO, patience, sizing, etc.)

### Historisation des Analyses (OBLIGATOIRE)

Quand on **régénère** une analyse qui existe déjà :

1. **Archiver l'ancienne version** :
   - Créer le dossier `analyses/{TICKER}/archive/{YYYYMMDD}/` (date de l'ancienne analyse)
   - Déplacer `analyses/{TICKER}/index.html` → `analyses/{TICKER}/archive/{YYYYMMDD}/index.html`
   - Copier `analyses/{TICKER}/assets/report.css` → `analyses/{TICKER}/archive/{YYYYMMDD}/report.css`
   - Le CSS de l'archive utilisera également `/assets/report.css`

2. **Mettre à jour la modale Historique** dans le **nouveau** `index.html` :
   - Ajouter une entrée dans `#historyList` pour chaque version archivée
   - Format d'une entrée :
   ```html
   <a href="archive/{YYYYMMDD}/" style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; border:1px solid #e2e8f0; border-radius:10px; text-decoration:none; color:#0f172a; transition:all 0.2s;">
       <div style="width:40px; height:40px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
           <i class="fa-solid fa-file-lines" style="color:#64748b;"></i>
       </div>
       <div>
           <div style="font-weight:600; font-size:0.9rem;">{DD} {Mois} {YYYY}</div>
           <div style="font-size:0.75rem; color:#64748b;">Analyse {TICKER} — Version précédente</div>
       </div>
   </a>
   ```
   - Les entrées sont triées par date décroissante (plus récente en premier)
   - L'analyse courante est toujours marquée comme "Version actuelle" (non cliquable, badge vert)

3. **Structure du bouton Historique** (dans le header) :
   ```html
   <button onclick="document.getElementById('historyModal').style.display='flex'"
       style="background:none; border:1px solid #cbd5e1; color:#64748b; cursor:pointer;
       margin-left:0.75rem; padding:4px 10px; border-radius:6px; font-size:0.75rem;">
       <i class="fa-solid fa-clock-rotate-left"></i> Historique
   </button>
   ```

4. **Structure de la modale Historique** :
   ```html
   <div id="historyModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5);
       z-index:1000; align-items:center; justify-content:center;"
       onclick="if(event.target===this)this.style.display='none'">
       <div style="background:white; border-radius:16px; padding:2rem; max-width:420px; width:90%;
           box-shadow:0 25px 50px rgba(0,0,0,0.25);">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
               <h3 style="margin:0; font-size:1.2rem; color:#0f172a;">Historique — {TICKER}</h3>
               <button onclick="document.getElementById('historyModal').style.display='none'"
                   style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;">&times;</button>
           </div>
           <div id="historyList" style="display:flex; flex-direction:column; gap:0.75rem;">
               <!-- Version actuelle (non cliquable) -->
               <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem;
                   border:1px solid #22c55e; border-radius:10px; background:#f0fdf4;">
                   <div style="width:40px; height:40px; border-radius:8px; background:#dcfce7;
                       display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                       <i class="fa-solid fa-star" style="color:#22c55e;"></i>
                   </div>
                   <div>
                       <div style="font-weight:600; font-size:0.9rem;">{DD} {Mois} {YYYY} <span
                           style="background:#22c55e; color:white; font-size:0.65rem; padding:2px 6px;
                           border-radius:4px; margin-left:6px;">ACTUEL</span></div>
                       <div style="font-size:0.75rem; color:#64748b;">Analyse {TICKER} — Version actuelle</div>
                   </div>
               </div>
               <!-- Versions archivées (liens cliquables) -->
               <!-- ... entrées archive/{YYYYMMDD}/ ... -->
           </div>
       </div>
   </div>
   ```

### Polymarket — Signal Complémentaire (quand pertinent)

Intégrer les données Polymarket dans les sections Macro, Risques, ou Social Radar quand un marché prédictif pertinent existe pour le ticker ou son secteur.

**Quand utiliser** :
- Événement binaire impactant le ticker (approbation FDA, contrat gouvernemental, earnings)
- Contexte macro avec marché Polymarket liquide (Fed, récession, tariffs)
- Secteur impacté par un événement géopolitique pricé sur Polymarket

**Collecte** : `WebSearch "polymarket {ticker ou événement}" site:polymarket.com`

**Format** : Utiliser un `didactic-box` avec titre "Polymarket Signal", probabilité, volume, lien source-ref, et interprétation vs consensus. Voir format dans le CLAUDE.md racine, section "Polymarket".

**Placement** : dans la section la plus pertinente (Macro, Risques, Social Radar, ou Actualités).

---

### Directives Analyse Ticker
- **Lisibilité** : un lecteur doit comprendre le titre en 2 minutes avec le Verdict Express seul
- **Honnêteté** : ne pas minimiser les risques, surtout dilution et cash burn
- **Données** : tous les chiffres doivent être à jour via MCP Gateway
- **Style** : headers directs, emojis en headers de risk-cards, bullet points courts, pas de paragraphes longs
- **Mobile** : utiliser les classes CSS responsive (auto-fit, minmax), jamais de grid fixe inline
- **Pas de `<style>` inline** : tout doit être dans report.css avec les classes ticker-analysis
- **Charts obligatoires** : chaque analyse et chaque metric-card dans le weekly doivent être cliquables
  - **US Stocks/ETFs** → Finviz : `https://charts2.finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p=d&s=l`
  - **Crypto** (BTC-USD, ETH-USD, SOL-USD...) → TradingView iframe embed (COINBASE:{SYMBOL}USD)
  - **Non-US Stocks** → Yahoo Finance chart (pas de Finviz)
  - **Modal** : fond dark #0f172a, 3 liens externes (Finviz/TradingView/Yahoo Finance)
- **Weekly : metric-cards cliquables** : chaque metric-card avec un ticker doit avoir `onclick="openChartModal('SYMBOL','Label')"` et `cursor:pointer`
- **Logos tickers (index.html uniquement)** : utiliser `https://assets.parqet.com/logos/symbol/{TICKER}?format=jpg` avec fallback gradient+initiales — **NE PAS** utiliser le logo société dans le header des pages d'analyses individuelles (toujours logo MW : `dailytickers.com/logo.svg`)
- **Liens** : jamais de `/index.html` — GitHub Pages résout automatiquement
- **Landing page** : chaque nouvelle analyse doit être ajoutée dans index.html avec logo, chart button, et lien
- **Alert-banner** : toujours forcer `color: white !important` sur le texte et les `<p>` internes
- **Historisation** : toujours archiver l'ancienne version avant de régénérer (voir section Historisation ci-dessus)
- **Sources inline obligatoires** : chaque donnée chiffrée ou factuelle doit avoir un lien cliquable vers sa source, directement dans le texte (pas seulement en fin d'article). Voir la directive "Sources Inline & Références" ci-dessous.

### Sources Inline & Références — RÈGLE OBLIGATOIRE

**Principe** : Chaque donnée chiffrée, chaque fait, chaque citation dans l'analyse doit être **traçable** via un lien cliquable vers la source originale, **directement à l'endroit où l'information apparaît** dans le texte.

**Ne pas se limiter à un bloc "Sources" en fin d'article.** Le lecteur doit pouvoir vérifier n'importe quel chiffre sans scroller.

#### Classe CSS `.source-ref`

Ajouter dans `report.css` :
```css
.source-ref {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: #64748b;
    text-decoration: none;
    border-bottom: 1px dotted #cbd5e1;
    padding-bottom: 1px;
    transition: color 0.2s, border-color 0.2s;
    margin-left: 0.25rem;
}
.source-ref:hover {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
}
.source-ref .source-icon {
    font-size: 0.6rem;
    opacity: 0.7;
}
.source-ref .source-name {
    font-weight: 500;
}
.source-ref .source-date {
    opacity: 0.6;
    font-style: italic;
}
```

#### Utilisation dans le HTML

**Inline après un chiffre ou un fait** :
```html
<p>POET a levé <strong>$150M</strong> via un registered direct offering sursouscrit
<a href="https://finance.yahoo.com/news/poet-technologies-closes-150m-offering" class="source-ref" target="_blank" rel="noopener">
    <i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>
    <span class="source-name">Yahoo Finance</span>
    <span class="source-date">· oct 2025</span>
</a>, portant sa trésorerie à $300M+.</p>
```

**Après un tableau ou une section de données** :
```html
<div class="source-refs" style="display:flex; flex-wrap:wrap; gap:0.5rem 1rem; margin-top:0.75rem; padding-top:0.5rem; border-top:1px solid #e2e8f0;">
    <a href="https://fintel.io/so/us/poet" class="source-ref" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>
        <span class="source-name">Fintel 13F</span>
        <span class="source-date">· fév 2026</span>
    </a>
    <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=POET" class="source-ref" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>
        <span class="source-name">SEC EDGAR</span>
        <span class="source-date">· fév 2026</span>
    </a>
    <a href="https://finance.yahoo.com/quote/POET/" class="source-ref" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square source-icon"></i>
        <span class="source-name">Yahoo Finance</span>
        <span class="source-date">· live</span>
    </a>
</div>
```

#### Quand utiliser `.source-ref`

| Contexte | Placement | Exemple |
|----------|-----------|---------|
| **Chiffre clé dans un paragraphe** | Inline, juste après le chiffre | "Revenue $298K `[source-ref]`" |
| **Tableau de données** | `.source-refs` sous le tableau | Sources: SEC EDGAR, Yahoo Finance |
| **Fait d'actualité / News** | Inline dans le texte de la news | "Partenariat avec Mitsubishi `[source-ref]`" |
| **Données techniques** (S/R, volume) | `.source-refs` sous le chart | Sources: DailyTickers Gateway |
| **SEC Filings** | Inline dans chaque ligne du tableau | Lien vers le filing exact sur SEC.gov |
| **Sentiment social** | Inline ou sous la carte plateforme | Lien vers StockTwits, Reddit, etc. |
| **Données institutionnelles (13F)** | Inline dans le tableau | Lien vers Fintel, WhaleWisdom |

#### Sources courantes et URLs

| Source | URL Pattern | Usage |
|--------|-------------|-------|
| **Yahoo Finance** | `finance.yahoo.com/quote/{TICKER}/` | Quote, stats, financials |
| **SEC EDGAR** | `sec.gov/cgi-bin/browse-edgar?CIK={TICKER}` | Filings officiels |
| **Fintel** | `fintel.io/so/us/{ticker}` | 13F, short interest, CTB |
| **StockTwits** | `stocktwits.com/symbol/{TICKER}` | Sentiment social |
| **ChartExchange** | `chartexchange.com/symbol/nasdaq-{ticker}/` | Reddit trends, dark pool |
| **Finviz** | `finviz.com/quote.ashx?t={TICKER}` | Overview, chart, news |
| **WhaleWisdom** | `whalewisdom.com/stock/{ticker}` | 13F holdings |
| **TipRanks** | `tipranks.com/stocks/{ticker}/forecast` | Analyst consensus |
| **MarketBeat** | `marketbeat.com/stocks/NASDAQ/{TICKER}/` | Insider trades, analysts |
| **Reddit WSB** | `reddit.com/r/wallstreetbets/search/?q={TICKER}` | WSB mentions |

#### Directives Sources

- **OBLIGATOIRE** : au minimum 1 `source-ref` par section `content-card`
- **IDÉAL** : 2-4 `source-ref` par section (inline + bloc sous tableau)
- **target="_blank" rel="noopener"** : toujours, pour ouvrir dans un nouvel onglet
- **Date de référence** : toujours indiquer la date ou "live" pour les données temps réel
- **Ne pas inventer d'URLs** : utiliser uniquement des URLs vérifiées ou les patterns ci-dessus
- **Le bloc Sources en fin d'article reste obligatoire** : il sert de récapitulatif, mais ne remplace pas les refs inline
- **Beginner** : moins de source-refs (1 par section max, pour ne pas surcharger), mais toujours présentes
- **Expert** : source-refs abondantes (2-4 par section)

---

