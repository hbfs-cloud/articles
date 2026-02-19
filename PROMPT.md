# PROMPT.md - Templates d'Analyse Market Watch

## 1. RAPPORT HEBDOMADAIRE (Weekly Report)

### Objectif
Rapport de niveau institutionnel à destination de retail qui couvre tous les grands marchés US, EU, Asia, sur tous les assets (Stocks, ETF, Gold, Silver, Crypto). Vision globale macro, micro et géopolitique pour la semaine à venir.

### Sections Obligatoires (dans l'ordre)

1. **Hero Section** - Titre accrocheur + badges clés + date de la semaine
2. **Navigation Grid** - Liens internes vers chaque section
3. **Alerte Banner** - Le sujet #1 de la semaine en rouge
4. **Calendrier de la Semaine** - Grille Lun-Ven avec événements, earnings, données macro. Codage couleur: critical (rouge), important (jaune), normal.
5. **Synthèse Exécutive** - Metric cards (S&P 500, Nasdaq, Dow, Russell, Or, Argent, BTC, VIX) + le paradoxe de la semaine
6. **Bilan Semaine Précédente** - Tableau anticipations vs résultats + score de validation
7. **Contexte Macro & Marchés** - Inflation/CPI, Fed, marchés actions US (table indices), Europe & International (table EFA, EEM, FXI, DAX, CAC), Obligations, Matières premières
8. **Métaux Précieux** - Or, Argent, prévisions institutionnelles, explication didactique
9. **Crypto** - BTC, ETH, altcoins, facteurs du bear/bull, niveaux critiques
10. **Earnings** - Table des earnings de la semaine + focus sur le plus important
11. **Géopolitique** - 2-3 fronts actifs (Ukraine, Venezuela, Chine, etc.) avec impact marché
12. **Rotation Sectorielle / Dynamique** - Gagnants vs perdants, flux de capitaux
13. **Matrice des Risques** - 5-6 risques avec probabilité et impact + signaux faibles / cygnes noirs
14. **Allocation Tactique** - Donut chart + table avec rationale et changements vs semaine précédente
15. **Trades de la Semaine** (NOUVEAU) - 3 positions longues swing argumentées (voir détail ci-dessous)
16. **Leaders Thématiques & Sectoriels** - Top tickers par thème/secteur, saisonnalités, corrélations clés (voir détail ci-dessous)
17. **Outlook** - 3 scénarios (haussier/central/baissier) avec probabilités + "Ce qu'il faut surveiller"
18. **Sources** - Toutes les sources organisées par catégorie avec liens

### Section 16 — Leaders Thématiques & Sectoriels (Détail)

Vue synthétique des forces en présence sur le marché. **Format ultra-light** pour ne pas saturer le contexte : uniquement tickers + métriques essentielles.

#### Collecte des Données
- `GetReferentialData` category=theme → liste des thèmes
- `GetReferentialData` theme={theme} pour les 5-6 thèmes les plus actifs (AI, Cloud, Cybersecurity, Clean Energy, etc.)
- `GetReferentialData` category=sector → rotation sectorielle
- `GetReferentialData` sector={sector} pour les 3 secteurs les plus forts et 3 les plus faibles
- `QueryData` types=seasonality symbols={top tickers}
- `GetReferentialData` correlated_with={SPY,BTC-USD,GLD,TLT}

#### Sous-sections

**a) Leaders par Thème (table ultra-compacte)**
Table `.data-table` avec colonnes : Thème | #1 Ticker | Perf 1M | #2 Ticker | Perf 1M | #3 Ticker | Perf 1M
- 6-8 thèmes max (AI, Semiconductors, Cloud, Cybersecurity, Clean Energy, Cannabis, Space, etc.)
- Uniquement le ticker + perf 1M, pas de description longue
- Badge vert/rouge pour la tendance du thème

**b) Rotation Sectorielle — Podium (table ultra-compacte)**
Table `.data-table` avec colonnes : Secteur | Leader | Perf 1W | Perf 1M | Flow (In/Out)
- Top 3 secteurs en inflows + Bottom 3 en outflows
- Badge 🟢 In / 🔴 Out pour les flux

**c) Saisonnalités Actives**
Table `.data-table` avec colonnes : Ticker | Pattern | Win Rate | Avg Return | Période
- 4-6 patterns saisonniers actifs cette semaine (ex: "AAPL tend à monter 72% du temps en mars")
- Données via `QueryData` types=seasonality
- Ne retenir que les patterns avec win rate > 65%

**d) Corrélations Clés (matrice compacte)**
Table `.data-table` avec colonnes : Pair | Corrélation | Signal
- 8-10 paires les plus pertinentes (SPY/QQQ, BTC/ETH, GLD/SLV, USD/TLT, etc.)
- Mentionner les décorrélations anormales (si BTC et SPY divergent soudainement = signal)
- Signal : "Normal", "Divergence", "Breakout corrélation"

#### Directives Section 16
- **COMPACT** : uniquement tickers + chiffres, pas de paragraphes explicatifs (sauf 1 pedagogy-box de synthèse à la fin)
- Ne pas répéter les données déjà présentes dans la section Rotation Sectorielle (#12) — complémentaire
- Pedagogy-box finale : "Ce que les leaders nous disent" (3 phrases max sur ce que la configuration actuelle signale)

---

### Section 15 — Trades de la Semaine (Détail)

Chaque rapport hebdomadaire doit proposer **3 trades en position longue (swing)**, motivés et argumentés.

#### Format par trade
- **Titre** : Ticker + Nom + Thème (ex: "NEM — Newmont Corp — Gold Miner")
- **Grille visuelle** (4 cartes metric-card) :
  - Entrée (zone de prix, bleu)
  - Stop Loss (niveau + % de perte, rouge)
  - Target 1 (niveau + % de gain, vert)
  - Target 2 (extension, violet)
- **Thèse** (pedagogy-box) : 1 paragraphe expliquant le raisonnement macro + technique + catalyseur. Doit inclure le R/R.
- **Catalyseurs** : événements de la semaine qui peuvent déclencher le mouvement

#### Critères de sélection
- Alignés avec la macro dominante (rotation, régime risk-on/off, thèmes)
- Signal technique récent (BUY AmericanBulls, RSI, breakout S/R)
- Données à jour via MCP Gateway (quote, trading_signals, support_resistance)
- R/R minimum 1:1.5
- Diversifiés (pas 3 trades sur le même secteur)

#### Bilan des Trades S-1
Si le rapport précédent contenait des trades, **inclure un bilan obligatoire** en début de section :

```html
<h3>Bilan Trades Semaine Précédente</h3>
<table class="data-table">
    <thead><tr><th>Trade</th><th>Entrée</th><th>Résultat</th><th>P/L</th><th>Statut</th></tr></thead>
    <tbody>
        <tr><td>NEM</td><td>$122-126</td><td>$130</td><td class="up">+5%</td><td><span class="badge badge-green">TP1 touché</span></td></tr>
        <!-- ... -->
    </tbody>
</table>
```

Statuts possibles : TP1 touché, TP2 touché, Stop touché, En cours, Invalidé.
Inclure un **score de fiabilité** (ex: "2/3 trades gagnants, score +8% cumulé").

### Directives
- Utiliser des données à jour via le MCP Gateway MarketWatch
- Ne pas se focaliser uniquement sur le dernier prix mais l'évolution (barres 15m/daily)
- Les sujets de la semaine dernière ne sont pas forcément les plus importants à venir: être proactif
- Chaque section doit contenir des phrases explicatives et didactiques
- Les chiffres cités doivent être à jour et sourcés
- Boxes pédagogiques (pedagogy-box, didactic-box) pour expliquer les concepts
- Boxes d'alerte (alert-box) pour les risques importants
- Toujours inclure le disclaimer en fin de rapport
- Les Top & Bottom Performers doivent montrer la **performance de toute la semaine** (5 jours), pas juste la dernière séance
- Les liens internes ne doivent **jamais** contenir `/index.html` — GitHub Pages résout automatiquement

---

## 2. ANALYSE INDIVIDUELLE (Ticker Analysis)

### Référence
**L'analyse POET (`analyses/POET/`) est la référence absolue** pour la charte graphique, la structure HTML, les classes CSS, les ECharts, le switcher langue/niveau, et les 6 variantes (expert/fr, expert/en, expert/ar, beginner/fr, beginner/en, beginner/ar). Toute nouvelle analyse doit suivre ce modèle en termes de qualité, longueur (~1600+ lignes pour expert/fr), structure des sections, et style visuel.

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

### 17 Sections Obligatoires

#### 1. Header (`.ticker-header`)
- Ticker, exchange, date, lien retour site (`href="/"`)
- Brand link : `color:#0f172a`, pas de `filter:brightness` sur le logo
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

**b) Fonds Toxiques / Death Spiral**
- Présence de PIPE deals, convertibles toxiques
- Fonds connus pour shorter après financement (Hudson Bay, Armistice, etc.)
- Historique de financements dilutifs avec ces fonds
- Verdict : présence ou absence de fonds toxiques

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
   - Le CSS de l'archive peut être copié tel quel ou être un lien relatif `../../assets/report.css`

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
- **Logos tickers** : utiliser `https://assets.parqet.com/logos/symbol/{TICKER}?format=jpg` avec fallback gradient+initiales
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
| **Données techniques** (S/R, volume) | `.source-refs` sous le chart | Sources: MarketWatch Gateway |
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

## 3. CONVENTIONS DE FORMAT

### HTML Structure
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <!-- GTM, favicon, CSS, fonts, chart libs -->
</head>
<body>
    <!-- GTM noscript -->
    <div class="hero-section">...</div>
    <div class="container">
        <div class="nav-grid">...</div>
        <div class="content-card" id="section-id">...</div>
        <!-- ... sections ... -->
        <footer>...</footer>
    </div>
    <!-- Chart scripts -->
</body>
</html>
```

### Classes CSS Clés — Weekly
- `.content-card` - Conteneur de section principal
- `.data-table` - Tables de données
- `.metric-grid` / `.metric-card` - Grilles de métriques
- `.risk-matrix` / `.risk-item` (.risk-high, .risk-medium, .risk-low)
- `.pedagogy-box` - Explication pédagogique (bleu)
- `.didactic-box` - Explication didactique (vert)
- `.alert-box` - Alerte important (fond rose clair #fef2f2, texte sombre. JAMAIS color:white sur les h4/p)
- `.geo-alert` - Alerte géopolitique (rouge avec animation)
- `.alert-banner` - Bannière d'alerte animée
- `.badge` (.badge-red, .badge-blue, .badge-green, .badge-purple)
- `.up` / `.down` / `.neutral` - Couleurs de variation
- `.calendar-days-grid` - Grille calendrier responsive

### Classes CSS Clés — Ticker Analysis
- `.ticker-header` - Hero dark pour pages ticker (gradient slate)
- `.ticker-symbol` / `.ticker-name` / `.ticker-price` / `.ticker-meta` - Éléments du header
- `.ticker-metrics` / `.ticker-metric` - Grille de métriques dans le header (auto-fit responsive)
- `.score-card` - Carte de score globale (conviction, biais, confiance)
- `.verdict-grid` - Grille 2 colonnes pour/contre
- `.verdict-pro` / `.verdict-con` - Colonnes arguments positifs/négatifs
- `.news-list` / `.news-item` - Liste de news avec dates
- `.risk-summary` - Header dark avec gauge score + tags
  - `.risk-gauge` - Cercle avec score /10
  - `.risk-summary-detail` - Texte profil + tags
  - `.risk-tags` / `.risk-tag` - Tags de risque colorés (`.risk-tag-critical/high/medium/low`)
- `.risk-grid` - Grille 2 colonnes responsive
- `.risk-card` - Carte de risque enrichie (bordure gauche colorée)
  - `.risk-card-critical` (rouge), `.risk-card-high` (orange), `.risk-card-medium` (bleu), `.risk-card-low` (vert)
  - `.risk-card-header` - Header avec icône + titre + badge sévérité
  - `.risk-card-icon` - Icône Font Awesome colorée
  - `.risk-severity` - Badge de sévérité (Critique/Élevé/Moyen/Faible)
  - `.risk-card-body` - Corps avec bullet points + meters
  - `.risk-meters` / `.risk-meter` - Barres de probabilité et impact
  - `.risk-meter-bar` / `.risk-meter-fill` - Barre de progression visuelle
  - `.risk-verdict` - Footer coloré avec icône et verdict
- `.trade-box` - Conteneur Trade Idea (fond slate-50)
- `.trade-levels` - Grille des niveaux de trade (4 colonnes)
  - `.trade-level.trade-entry` - Fond bleu (entrée)
  - `.trade-level.trade-stop` - Fond rouge (stop loss)
  - `.trade-level.trade-tp` - Fond vert (take profit)
  - `.trade-level.trade-rr` - Fond violet (risk/reward)

### Couleurs
- Hausse: #16a34a (vert)
- Baisse: #dc2626 (rouge)
- Neutre: #64748b (gris)
- Or: #eab308
- Crypto: #f97316
- Info: #3b82f6
- Background: #f8fafc (TOUJOURS light, jamais de dark theme)
- Text: #0f172a (primary), #475569 (body), #64748b (muted)

### Responsive Design — RÈGLES CRITIQUES

**PROBLÈME FRÉQUENT** : Tableaux avec text wrap, badges qui débordent, polices trop grandes sur mobile.

#### Breakpoints
- **Desktop** : > 768px (par défaut)
- **Tablet** : ≤ 768px
- **Mobile** : ≤ 480px

#### Tableaux (CRITIQUE)
**TOUJOURS** appliquer ces règles pour TOUS les tableaux :

```css
/* Desktop - taille normale */
.data-table {
    font-size: 0.95rem;
}

/* Tablet - réduction modérée */
@media (max-width: 768px) {
    .data-table,
    table {
        font-size: 0.8rem !important;
    }
    .data-table th,
    .data-table td {
        padding: 0.5rem 0.75rem !important;
    }
}

/* Mobile - réduction agressive */
@media (max-width: 480px) {
    .data-table,
    table {
        font-size: 0.7rem !important;
        table-layout: fixed !important;
        width: 100% !important;
    }
    .data-table th,
    .data-table td {
        padding: 0.35rem 0.5rem !important;
        white-space: normal !important;
        word-wrap: break-word !important;
    }
    /* Badges dans tableaux - plus petits */
    .data-table .badge {
        font-size: 0.55rem !important;
        padding: 0.1rem 0.3rem !important;
    }
}
```

**OBLIGATOIRE** : Wrapper tous les tableaux avec `overflow-x: auto` :
```html
<div style="overflow-x:auto; margin-top:1.5rem;">
    <table class="data-table">
        ...
    </table>
</div>
```

#### Grilles
**TOUJOURS** utiliser `minmax(min(100%, XXXpx), 1fr)` pour éviter débordement :

```css
/* BON ✓ */
.grid-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr));
    gap: 2rem;
}

/* MAUVAIS ✗ - déborde sur mobile */
.grid-cards {
    grid-template-columns: repeat(3, 1fr); /* Fixe, pas responsive */
}
```

#### Cartes (report-card, content-card, setup-card)
```css
@media (max-width: 768px) {
    .report-card,
    .content-card,
    .setup-card {
        padding: 1.25rem !important;
        border-radius: 16px;
    }
}

@media (max-width: 480px) {
    .report-card,
    .content-card,
    .setup-card {
        padding: 0.75rem !important;
        border-radius: 12px;
        margin-bottom: 0.75rem !important;
    }
}
```

#### Badges
```css
@media (max-width: 480px) {
    .badge {
        padding: 0.15rem 0.4rem !important;
        font-size: 0.6rem !important;
    }
}
```

#### Navigation & Metric Grids
```css
/* Desktop */
.nav-grid,
.metric-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
}

/* Tablet */
@media (max-width: 768px) {
    .nav-grid,
    .metric-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 0.75rem !important;
    }
}

/* Mobile */
@media (max-width: 480px) {
    .nav-grid {
        gap: 0.35rem !important;
    }
    .nav-item {
        padding: 0.5rem 0.25rem !important;
        font-size: 0.7rem !important;
    }
    .metric-grid {
        gap: 0.35rem !important;
    }
    .metric-card {
        padding: 0.5rem !important;
    }
    .metric-value {
        font-size: 1rem !important;
    }
    .metric-label {
        font-size: 0.6rem !important;
    }
}
```

#### Typography
```css
@media (max-width: 480px) {
    h2 { font-size: 1rem !important; }
    h3 { font-size: 0.9rem !important; }
    h4 { font-size: 0.85rem !important; }
    p, li { font-size: 0.8rem !important; line-height: 1.5 !important; }
}
```

#### Landing Page Cards (index.html)
```css
.grid-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr));
    gap: 2rem;
}

@media (max-width: 768px) {
    .grid-cards {
        gap: 1.5rem !important;
        grid-template-columns: 1fr !important;
    }
    .report-card {
        padding: 1.5rem !important;
    }
}

@media (max-width: 480px) {
    .grid-cards {
        gap: 1rem !important;
        padding: 0 0.5rem !important;
    }
    .report-card {
        padding: 1rem !important;
        border-radius: 12px !important;
    }
    .report-card h3 {
        font-size: 1.1rem !important;
    }
    .report-card .date {
        font-size: 0.75rem !important;
    }
}
```

#### Test sur Mobile
Avant de valider un article :
1. ✓ Ouvrir Chrome DevTools → Toggle device toolbar (Cmd+Shift+M)
2. ✓ Tester iPhone SE (375px) et iPhone 12 Pro (390px)
3. ✓ Vérifier : pas de débordement horizontal, pas de text wrap dans badges, tableaux lisibles
4. ✓ Scroller horizontalement les tableaux si nécessaire (overflow-x:auto)

---

## 4. MULTILANGUE & MULTI-COMPLEXITÉ

### Architecture URL

```
analyses/AAPL/
├── index.html                    # Default = expert/fr (rétrocompatible)
├── assets/report.css             # CSS partagé (toutes variantes)
├── variants.json                 # Manifest des variantes disponibles
├── expert/
│   ├── fr/index.html             # Français expert (copie du root)
│   ├── en/index.html             # English expert
│   ├── ar/index.html             # العربية expert
│   ├── de/index.html             # Deutsch expert
│   └── es/index.html             # Español expert
├── intermediate/
│   ├── fr/index.html
│   └── en/index.html
└── beginner/
    ├── fr/index.html
    └── en/index.html
```

- **URL propres** : `articles.market-watch.xyz/analyses/AAPL/expert/en` (pas de trailing slash ni index.html)
- **Default** : `analyses/AAPL/` → toujours expert/fr (rétrocompatible avec les 141 articles existants)
- **CSS partagé** : toutes les variantes linkent vers `../../assets/report.css` (ou `../../../assets/report.css` selon le niveau)

### variants.json (Manifest)

Chaque dossier ticker contient un `variants.json` listant les variantes disponibles :

```json
{
  "ticker": "AAPL",
  "default": { "level": "expert", "lang": "fr" },
  "variants": [
    { "level": "expert", "lang": "fr", "path": "expert/fr" },
    { "level": "expert", "lang": "en", "path": "expert/en" },
    { "level": "expert", "lang": "ar", "path": "expert/ar" },
    { "level": "intermediate", "lang": "fr", "path": "intermediate/fr" },
    { "level": "beginner", "lang": "fr", "path": "beginner/fr" }
  ],
  "grade": "B+",
  "date": "2026-02-15"
}
```

### ACCENTS & ORTHOGRAPHE FRANÇAISE — RÈGLE CRITIQUE

**OBLIGATOIRE** : Tout contenu en langue française (lang="fr") **DOIT** utiliser les accents corrects. C'est une erreur bloquante de produire du français sans accents.

**Accents courants à ne JAMAIS oublier** :
- é (é aigu) : été, élevé, spéculatif, réseaux, événement, énergie, résumé, sécurité, intégrité, évaluation, actualités, légitimité, phénomène, précédent, différent, créé, débutant, données, archivées, généralement, électricité, présenté, intérieur, géants, intéressant, numéro, mentionné, décevant, prévisions, sécrètement, négatif, spécial, modéré, développé, également
- è (è grave) : très, accès, après, succès, critère, critères, deuxième, troisième, lumière, première
- ê (ê circon.) : être, même, fenêtre, intérêt, prêt, forêt
- à (à grave) : à, déjà, là, voilà
- ô (ô circon.) : contrôle, rôle, côté, hôpital
- ç (cédille) : ça, français, façon, reçu, leçon, façade
- ù (ù grave) : où
- î (î circon.) : connaître, apparaître, maîtrise

**Vérification obligatoire** : Après génération, scanner le HTML pour les mots français courants sans accent (ex: `etait` au lieu de `était`, `reseaux` au lieu de `réseaux`, `Donnees` au lieu de `Données`). Corriger systématiquement.

**Dans les attributs HTML** : utiliser les entités HTML si nécessaire (`&eacute;`, `&egrave;`, etc.) mais le charset UTF-8 permet les caractères directs dans le contenu.

---

### Langues Supportées

| Code | Drapeau | Nom        | Direction |
|------|---------|------------|-----------|
| fr   | 🇫🇷     | Français   | ltr       |
| en   | 🇬🇧     | English    | ltr       |
| ar   | 🇸🇦     | العربية    | rtl       |
| de   | 🇩🇪     | Deutsch    | ltr       |
| es   | 🇪🇸     | Español    | ltr       |
| zh   | 🇨🇳     | 中文       | ltr       |
| ja   | 🇯🇵     | 日本語     | ltr       |

### Niveaux de Complexité

| Niveau        | Public cible              | Contenu                                                    |
|---------------|---------------------------|------------------------------------------------------------|
| **beginner**  | Débutants en bourse       | Langage simple, explications de chaque concept, pas de jargon. Sections simplifiées (6-8 au lieu de 15). Pas d'options, pas de Wyckoff. Focus sur "Qu'est-ce que c'est" et "Acheter ou pas". |
| **intermediate** | Investisseurs particuliers | Toutes les sections mais explications supplémentaires pour les concepts techniques. Jargon avec définitions. |
| **expert**    | Traders / Institutionnels | Article actuel complet, 17 sections, jargon technique, Wyckoff, Greeks, CTB, bottom estimation, manipulation detection, social radar. |

### Sections par Niveau

#### Beginner (6-8 sections)
1. Header (simplifié : prix, variation, MCap)
2. Verdict Express (verdict clair : Acheter / Attendre / Éviter)
3. L'Entreprise (qu'est-ce qu'elle fait, en termes simples)
4. Actualités (2-3 news les plus importantes)
5. Santé Financière (revenus, est-ce rentable, tendance)
6. Risques Principaux (3 risques max, expliqués simplement)
7. Faut-il Investir ? (recommandation claire avec zones de prix)
8. Sources

#### Intermediate (12 sections)
1-6 : Identique à Expert mais avec des `pedagogy-box` supplémentaires
7. Structure du Capital (simplifié)
8. Short Interest (avec explication du concept)
9. Technique (RSI, supports/résistances, tendance — pas de Wyckoff)
10. Secteur
11. Trade Idea
12. Note Globale + Sources

#### Expert (17 sections — contenu actuel)
Identique au template Section 2 ci-dessus. Inclut les sections avancées 13 (Bottom Estimation & Setups) et 14 (Manipulations & Signaux Sociaux) qui sont **exclusives au mode expert**.

### Switcher Langue/Niveau (Template HTML)

Le switcher est placé **dans le ticker-header**, juste après le brand link :

```html
<!-- Language & Level Switcher -->
<div class="article-switcher">
    <div class="level-switcher">
        <a href="/analyses/AAPL/beginner/fr" class="level-tab" data-level="beginner">
            <i class="fa-solid fa-seedling"></i> Beginner
        </a>
        <a href="/analyses/AAPL/intermediate/fr" class="level-tab" data-level="intermediate">
            <i class="fa-solid fa-chart-simple"></i> Intermediate
        </a>
        <a href="/analyses/AAPL/expert/fr" class="level-tab active" data-level="expert">
            <i class="fa-solid fa-chart-line"></i> Expert
        </a>
    </div>
    <div class="lang-switcher">
        <a href="/analyses/AAPL/expert/fr" class="lang-flag active" title="Français">🇫🇷</a>
        <a href="/analyses/AAPL/expert/en" class="lang-flag" title="English">🇬🇧</a>
        <a href="/analyses/AAPL/expert/ar" class="lang-flag" title="العربية">🇸🇦</a>
    </div>
</div>
```

Le switcher est **dynamique** : il lit `variants.json` via fetch et génère les liens automatiquement. Script à inclure avant `</body>` :

```html
<script>
(function() {
    var currentLevel = document.documentElement.dataset.level || 'expert';
    var currentLang = document.documentElement.lang || 'fr';
    var ticker = document.querySelector('.ticker-symbol').textContent.trim();
    var basePath = '/analyses/' + ticker + '/';

    fetch(basePath + 'variants.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var switcher = document.querySelector('.article-switcher');
            if (!switcher || !data.variants) return;

            // Build level tabs
            var levels = {};
            data.variants.forEach(function(v) {
                if (!levels[v.level]) levels[v.level] = [];
                levels[v.level].push(v.lang);
            });

            var levelHtml = '';
            var levelIcons = { beginner: 'fa-seedling', intermediate: 'fa-chart-simple', expert: 'fa-chart-line' };
            var levelOrder = ['beginner', 'intermediate', 'expert'];
            levelOrder.forEach(function(lvl) {
                if (!levels[lvl]) return;
                var targetLang = levels[lvl].indexOf(currentLang) !== -1 ? currentLang : levels[lvl][0];
                var active = lvl === currentLevel ? ' active' : '';
                var href = basePath + lvl + '/' + targetLang;
                levelHtml += '<a href="' + href + '" class="level-tab' + active + '" data-level="' + lvl + '">'
                    + '<i class="fa-solid ' + (levelIcons[lvl] || 'fa-circle') + '"></i> '
                    + lvl.charAt(0).toUpperCase() + lvl.slice(1) + '</a>';
            });

            // Build lang flags
            var langFlags = { fr:'🇫🇷', en:'🇬🇧', ar:'🇸🇦', de:'🇩🇪', es:'🇪🇸', zh:'🇨🇳', ja:'🇯🇵' };
            var langNames = { fr:'Français', en:'English', ar:'العربية', de:'Deutsch', es:'Español', zh:'中文', ja:'日本語' };
            var langHtml = '';
            var currentLevelLangs = data.variants.filter(function(v) { return v.level === currentLevel; });
            currentLevelLangs.forEach(function(v) {
                var active = v.lang === currentLang ? ' active' : '';
                langHtml += '<a href="' + basePath + v.level + '/' + v.lang + '" class="lang-flag' + active
                    + '" title="' + (langNames[v.lang] || v.lang) + '">' + (langFlags[v.lang] || v.lang) + '</a>';
            });

            switcher.innerHTML = '<div class="level-switcher">' + levelHtml + '</div>'
                + '<div class="lang-switcher">' + langHtml + '</div>';
        })
        .catch(function() { /* No variants.json = single variant article, hide switcher */ });
})();
</script>
```

### CSS Switcher (ajouter à report.css)

```css
.article-switcher {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 1rem 0;
    padding: 0.5rem 0.75rem;
    background: rgba(255,255,255,0.08);
    border-radius: 10px;
    flex-wrap: wrap;
}
.level-switcher {
    display: flex;
    gap: 0.25rem;
    background: rgba(0,0,0,0.15);
    border-radius: 8px;
    padding: 3px;
}
.level-tab {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
    text-decoration: none;
    transition: all 0.2s;
    white-space: nowrap;
}
.level-tab:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.08); }
.level-tab.active { background: rgba(255,255,255,0.15); color: #fff; }
.lang-switcher {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}
.lang-flag {
    font-size: 1.3rem;
    text-decoration: none;
    opacity: 0.5;
    transition: opacity 0.2s, transform 0.2s;
    cursor: pointer;
}
.lang-flag:hover { opacity: 0.8; transform: scale(1.15); }
.lang-flag.active { opacity: 1; transform: scale(1.1); }
```

### RTL Support (Arabe)

Pour les pages `ar`, ajouter :
```html
<html lang="ar" dir="rtl" data-level="expert">
```
Et dans le CSS :
```css
[dir="rtl"] .ticker-header,
[dir="rtl"] .content-card,
[dir="rtl"] .verdict-grid { direction: rtl; text-align: right; }
[dir="rtl"] .article-switcher { flex-direction: row-reverse; }
```

### Discord Bot — Commande Analyse Multilingue

**Syntaxe** : `TICKER [level] [lang1,lang2,...]`

Exemples :
- `AAPL` → expert fr (défaut)
- `AAPL expert fr,en,ar` → 3 langues en expert
- `AAPL beginner fr,en` → 2 langues en beginner
- `AAPL expert,intermediate fr,en` → 4 variantes (2 niveaux × 2 langues)

**Parsing dans bot.js** :
```javascript
function parseAnalyseCommand(text) {
    var parts = text.trim().split(/\s+/);
    var ticker = parts[0].toUpperCase();
    var levels = ['expert'];
    var langs = ['fr'];

    for (var i = 1; i < parts.length; i++) {
        var p = parts[i].toLowerCase();
        if (['beginner','intermediate','expert'].some(l => p.includes(l))) {
            levels = p.split(',').filter(l => ['beginner','intermediate','expert'].includes(l));
        } else if (p.match(/^[a-z]{2}(,[a-z]{2})*$/)) {
            langs = p.split(',');
        }
    }

    return { ticker, levels, langs };
}
```

**Prompt généré** (envoyé à Claude Code) :
```
analyse AAPL level=expert langs=fr,en,ar
```

Le CLAUDE.md du projet articles doit interpréter cette syntaxe et générer toutes les variantes demandées.

### Index Page — Filtres Langue/Niveau/Grade

Le `index.html` principal inclut des filtres au-dessus de la grille des analyses individuelles :

```html
<div class="filter-bar">
    <div class="filter-group">
        <label>Grade</label>
        <div class="filter-chips" id="gradeFilter">
            <button class="filter-chip active" data-grade="all">Tous</button>
            <button class="filter-chip" data-grade="A">A</button>
            <button class="filter-chip" data-grade="B">B</button>
            <button class="filter-chip" data-grade="C">C</button>
            <button class="filter-chip" data-grade="D">D</button>
            <button class="filter-chip" data-grade="F">F</button>
        </div>
    </div>
</div>
```

Script de filtrage :
```javascript
document.querySelectorAll('.filter-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var group = this.closest('.filter-chips');
        group.querySelectorAll('.filter-chip').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        filterCards();
    });
});

function filterCards() {
    var gradeFilter = document.querySelector('#gradeFilter .filter-chip.active').dataset.grade;
    document.querySelectorAll('.grid-cards .report-card[data-grade]').forEach(function(card) {
        var grade = card.dataset.grade;
        var gradeMatch = gradeFilter === 'all' || grade.startsWith(gradeFilter);
        card.style.display = gradeMatch ? '' : 'none';
    });
}
```

---

## 5. SCANNER QUOTIDIEN

### Objectif
Article quotidien généré par le scanner algorithmique. Détecte automatiquement les meilleurs setups du jour en fonction du régime de marché (Risk-On, Neutral, Early Risk-Off, Risk-Off, Recovery). Supporte le multilangue et multi-niveau comme les analyses individuelles.

### Structure URL
```
scanner/
├── YYYYMMDD/
│   ├── index.html                # Default = expert/fr
│   ├── assets/report.css         # CSS spécifique (thème dark)
│   ├── variants.json             # Manifest des variantes
│   ├── expert/
│   │   ├── en/index.html
│   │   └── ar/index.html
│   └── beginner/
│       ├── fr/index.html
│       ├── en/index.html
│       └── ar/index.html
```

### Collecte des Données
1. **`RunAutoScreener`** : Détection du régime de marché + candidats auto-adaptatifs
2. **`RunScreener`** avec DSL personnalisé : 3 stratégies complémentaires
   - Oversold bounce : `rsi14<35 && vol>sma(vol,20)*1.5`
   - Momentum expansion : `close>sma(close,20) && vol>sma(vol,20)*2 && rsi14>50 && rsi14<75`
   - Breakout squeeze : `close>sma(close,50) && atr(14)>atr(28)*1.2`
3. **`QueryData`** types: quote pour les 10 tickers retenus
4. **WebSearch** pour les catalyseurs récents de chaque ticker

### Diversification Géographique & Setups A+ Europe/Asie/ETFs

**OBLIGATOIRE** : Le scanner doit inclure des setups de qualité A+ sur les marchés européens, asiatiques et les ETFs, pas uniquement des actions US.

#### Objectif
Détecter les meilleures opportunités J+1 (next day) sur tous les marchés majeurs pour une vision globale et diversifiée.

#### Univers de Screening

**Marchés Européens** :
- **Actions individuelles** : DAX (Allemagne), CAC 40 (France), FTSE 100 (UK), IBEX 35 (Espagne), FTSE MIB (Italie)
- **ETFs Europe** : VGK (Vanguard FTSE Europe), EWG (iShares Germany), EWQ (iShares France), EWU (iShares UK), EWP (iShares Spain), EWI (iShares Italy)
- **Exemples tickers** : SAP, Siemens, TotalEnergies, BBVA, UniCredit, ASML, LVMH, Airbus, Stellantis, Nestlé

**Marchés Asiatiques** :
- **Actions individuelles** : KOSPI (Corée), Nikkei 225 (Japon), Hang Seng (Hong Kong), SSE (Shanghai)
- **ETFs Asie** : EWJ (iShares Japan), EWY (iShares South Korea), EWH (iShares Hong Kong), FXI (iShares China), MCHI (iShares MSCI China)
- **Exemples tickers** : Samsung, TSMC, Sony, Toyota, Alibaba, Tencent, POSCO, SK Hynix

**ETFs Sectoriels & Thématiques** (US & Global) :
- **Secteurs** : XLF (Financials), XLE (Energy), XLK (Tech), XLV (Healthcare), XLI (Industrials), XLY (Consumer Discretionary), XLP (Consumer Staples), XLRE (Real Estate), XLU (Utilities), XLB (Materials)
- **Thématiques** : ARKK (Innovation), ICLN (Clean Energy), TAN (Solar), LIT (Lithium), BOTZ (Robotics), HACK (Cybersecurity), CLOU (Cloud), JETS (Airlines), DRIV (Auto)
- **Commodités** : GLD (Gold), SLV (Silver), USO (Oil), UNG (Natural Gas), DBA (Agriculture)
- **Crypto** : BITO (Bitcoin ETF), ETHE (Ethereum ETF)

#### Méthodologie de Sélection

1. **Screening multi-région** : Utiliser `RunScreener` avec les symboles des 3 zones (US, EU, Asia, ETFs)
2. **Critères A+** :
   - Score composite ≥ 85/100
   - Confluence technique : ≥ 3 signaux alignés (RSI, volume, S/R, pattern)
   - Catalyseur identifiable (earnings, news, breakout technique)
   - Liquidité suffisante (volume moyen > $10M/jour pour actions, > $50M/jour pour ETFs)
3. **Diversification** : Minimum 2 setups Europe + 1 setup Asie + 2 ETFs parmi les 10 candidats retenus
4. **Horizon J+1** : Setups avec potentiel de mouvement dans les prochaines 24-48h (pas swing long terme)

#### Présentation dans le Scanner

Pour chaque setup Europe/Asie/ETF, **ajouter un badge géographique** :

```html
<div class="setup-badges">
    <span class="badge badge-blue">Europe 🇪🇺</span>  <!-- EU -->
    <span class="badge badge-purple">Asia 🌏</span>   <!-- Asie -->
    <span class="badge badge-green">ETF 📊</span>     <!-- ETF -->
    <span class="badge badge-{color}">{Stratégie}</span>
</div>
```

**Exemple de répartition idéale sur 10 setups** :
- 5 US (stocks individuelles)
- 2 Europe (actions ou ETFs Europe)
- 1 Asie (action ou ETF Asie)
- 2 ETFs thématiques/sectoriels

#### Mise à jour Index.html

Lors de l'ajout de la carte scanner dans `index.html`, **mentionner la couverture géographique** dans la description :

```html
<p style="font-size:0.85rem; color:var(--text-muted);">
    {Description du régime}. {Stratégies}. 10 setups analysés : {Tickers US} (US), {Tickers EU} (Europe), {Tickers Asia} (Asie), {ETFs}.
</p>
```

**Exemple** :
> "Rotation défensive confirmée. Hausse VIX +4.2%. 10 setups analysés : XOM, HRL, UNH (US), SAP, BBVA (EU), EWJ (Asie), GLD, XLE (ETFs)."

### Sections de l'Article Scanner

#### Thème
Le scanner utilise le **thème light standard** (fond `#f8fafc`, texte `#0f172a`) comme toutes les autres pages. **JAMAIS de thème dark.**

#### Sections Obligatoires
1. **Hero** : Date, badge régime de marché (couleur selon régime), stats clés (nb setups, score moyen, stratégie dominante)
2. **Régime de Marché** : Description du régime détecté, composantes (VIX, SPX, DXY, crédit, liquidité, TLT), pondérations des stratégies
   - **ECharts Pie** : Répartition des stratégies (%)
   - **ECharts Gauge** : Score moyen des setups (0-100)
3. **Vue d'Ensemble Visuelle** (NOUVELLE SECTION OBLIGATOIRE) :
   - **ECharts Radar** : Profil agrégé des 10 setups (axes: Technique, Volume, Momentum, Risque, R/R, Conviction)
   - **ECharts Treemap** : Répartition sectorielle des 10 setups (taille = score, couleur = variation)
   - **ECharts Heatmap** : Matrice de corrélations entre les 10 tickers (si applicable)
4. **Navigation Grid** : Liens internes vers chaque setup
5. **10 Setup Cards** : Pour chaque ticker :
   - Header avec ticker, nom, prix, variation
   - Badges : stratégie détectée, fiabilité, signal technique
   - **ECharts Gauge** : Score composite 0-100 (visuel)
   - **ECharts Radar** : Profil du setup (6 axes: technique, volume, momentum, risque, liquidité, conviction)
   - **Description du setup** : ce qu'on voit techniquement (pattern, volumes, indicateurs)
   - **Confirmations** : ce qui valide le setup
   - **Invalidations** : ce qui annule le setup
   - **Alertes à placer** : niveaux de prix à surveiller
   - **Niveaux clés** : entrée, stop, target(s)
   - **ApexCharts Bar** : Prix + volume derniers 30 jours (bar chart avec volume)
6. **Synthèse** :
   - Tableau récapitulatif des 10 setups
   - **ECharts Bar** : Scores composites comparatifs (horizontal bar chart)
   - **ECharts Sankey** (optionnel) : Flux Secteur → Stratégie → Setup
7. **Méthodologie** : Explication du scoring et des stratégies
8. **Disclaimer** : Avertissement standard

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
- Charts ApexCharts pour chaque setup (bar chart avec volume)
- Score composite 0-100 pour chaque setup
- Ajouter la carte dans le tab Scanner de index.html

---

## 6. PORTFOLIO (Stratégies Systématiques)

### Objectif
Tab sur la landing page affichant les stratégies algorithmiques systématiques actives avec performance vs benchmarks.

### Structure
Le Portfolio est directement dans `index.html` (pas d'article séparé), dans le tab `#tab-portfolio`.

### Sections
1. **Benchmark Reference Bar** : S&P 500, STOXX 600, Gold, Silver, Bitcoin — avec prix et variation
2. **Tier 1** (priorité haute) : Stratégies à forte conviction
3. **Tier 2** (priorité moyenne) : Stratégies secondaires
4. **Tier 3** (exploration) : Stratégies expérimentales

### Format d'une Stratégie Card
```html
<div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:1.5rem; position:relative;">
    <div style="position:absolute; top:12px; right:12px;">
        <span class="badge badge-{color}">{Tier}</span>
    </div>
    <h3 style="font-size:1.1rem; font-weight:700; margin:0 0 0.5rem;">{Nom Stratégie}</h3>
    <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 1rem;">{Description}</p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:8px;">
        <!-- Métriques : Type, CAGR, Sharpe, Max DD, Win Rate -->
    </div>
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid #f1f5f9; font-size:0.75rem; color:var(--text-muted);">
        vs {Benchmark} : <span class="up/down">{Delta}</span>
    </div>
</div>
```

### Métriques Obligatoires par Stratégie
- **Type d'asset** : US Stocks, EU Stocks, Crypto, Metals, Forex, etc.
- **CAGR** : Rendement annualisé
- **Sharpe** : Ratio de Sharpe
- **Max DD** : Drawdown maximum
- **Win Rate** : Taux de réussite
- **vs Benchmark** : Surperformance par rapport à l'indice de référence pertinent

### Directives Portfolio
- Comparer chaque stratégie au bon benchmark (S&P 500 pour US, STOXX 600 pour EU, BTC pour crypto, etc.)
- Tier badges colorés : Tier 1 = vert, Tier 2 = bleu, Tier 3 = violet
- Disclaimer obligatoire : "Les performances passées ne garantissent pas les résultats futurs"
- Pas d'article séparé, tout dans index.html

---

## 7. LANDING PAGE (index.html)

### Tabs Système
La landing page utilise un système de tabs :

| Tab | data-tab | Icône | Count ID | Contenu |
|-----|----------|-------|----------|---------|
| Hebdo | `weekly` | `fa-calendar-week` | `weeklyCount` | Rapports hebdomadaires (tous visibles) |
| Daily | `daily` | `fa-sun` | `dailyCount` | Briefings quotidiens |
| Analyses | `analyses` | `fa-chart-column` | `analysesCount` | Analyses individuelles avec filtre grade + recherche |
| Scanner | `scanner` | `fa-satellite-dish` | `scannerCount` | Scans quotidiens algorithmiques |
| Portfolio | `portfolio` | `fa-briefcase` | — | Stratégies systématiques |

### IMPORTANT — Compteurs de Tabs
Chaque tab (sauf Portfolio) affiche un badge compteur (`<span class="tab-count" id="{id}">N</span>`).
**À chaque ajout d'un article (daily, scanner, weekly, analyse), le compteur correspondant DOIT être mis à jour dans `index.html`.**
- `weeklyCount` = nombre de cartes dans `#tab-weekly`
- `dailyCount` = nombre de cartes dans `#tab-daily`
- `scannerCount` = nombre de cartes dans `#tab-scanner`
- `analysesCount` = calculé dynamiquement par JS (pas besoin de le mettre à jour manuellement)

### URL State
- Tab actif dans URL : `?tab=analyses`, `?tab=scanner`, `?tab=portfolio`
- Grade filter dans URL : `?grade=A`
- Combinable : `?tab=analyses&grade=B`
- Default (pas de param) = tab weekly

### Recherche
- Filtre uniquement sur le **symbole ticker** (pas nom, ni description, ni exchange)
- Champ de recherche dans le tab analyses uniquement

### OG Meta Tags
Toutes les pages (landing, weekly, analyses, scanner) incluent des OG tags :
```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://market-watch.xyz/favicon.ico">
<meta property="og:url" content="https://articles.market-watch.xyz/...">
<meta property="og:type" content="article">
```

### Charts Interactifs
- **US Stocks/ETFs** → Finviz embed dans modal
- **Indices** (VIX, DXY, TNX, SPX, NDX, DJI) → TradingView widget embed
- **Crypto** → TradingView COINBASE:{SYMBOL}USD
- **Modal** : fond dark `#0f172a`, 3 liens externes (Finviz/TradingView/Yahoo Finance)

---

## 8. LAB — Evidence.dev Interactive Dashboard

### Architecture
Le Lab est un dashboard interactif construit avec [Evidence.dev](https://evidence.dev), un framework BI-as-code qui genere des sites statiques depuis Markdown + SQL (DuckDB-WASM).

```
lab/                              # Output statique (commite, servi par GH Pages)
├── index.html                    # Dashboard Overview
├── explorer/                     # Stock Explorer interactif
├── sectors/                      # Analyse sectorielle
├── regions/                      # Analyse geographique
├── valuations/                   # Lab de valorisation
├── earnings/                     # Croissance & rentabilite
└── _app/                         # Assets Evidence (JS, CSS, DuckDB WASM)

lab-src/                          # Source Evidence (pas servi par GH Pages)
├── pages/                        # 6 pages Markdown + SQL
│   ├── index.md                  # Dashboard Overview
│   ├── explorer.md               # Stock Explorer
│   ├── sectors.md                # Sectors Deep Dive
│   ├── regions.md                # Geographic Analysis
│   ├── valuations.md             # Valuation Lab
│   └── earnings.md               # Earnings Tracker
├── sources/market/
│   ├── connection.yaml           # type: csv
│   └── stocks.csv                # Dataset ~145 stocks
├── evidence.config.yaml          # Theme light, couleurs site
└── package.json                  # Dependencies Evidence
```

### Donnees (stocks.csv)
~145 stocks couvrant US, Europe, Asie avec colonnes :
symbol, name, price, change_pct, volume, market_cap, high_52w, low_52w, pe_trailing, pe_forward, dividend_yield, beta, price_to_book, revenue, revenue_growth, earnings_growth, gross_margin, operating_margin, profit_margin, roe, roa, target_price, recommendation, region, sector, country

### Refresh des donnees
1. Collecter via MCP Gateway : `QueryData` types=quote,stats,financials pour chaque batch (~7 batches de 20-25 symboles)
2. Mettre a jour `lab-src/sources/market/stocks.csv`
3. Rebuild :
```bash
cd lab-src
npx evidence sources
npx evidence build
rm -rf ../lab/*
cp -r build/* ../lab/
```

### Theme
- **Light** (default: light, switcher: false)
- Couleurs alignees sur le site : primary #2563eb, positive #16a34a, negative #dc2626, base #ffffff
- Font: Inter (herite du site)

### Composants Evidence utilises
BigValue, BarChart, ScatterPlot, DataTable, Column, Dropdown, DropdownOption, ButtonGroup, ButtonGroupItem, Alert, LinkButton, Details, Value

### Tab Lab dans index.html
- 6eme tab apres Portfolio : icone flask, label "Lab"
- Panel `#tab-lab` avec carte descriptive et lien vers `lab/`

---

## 9. CHARTING — Apache ECharts & ApexCharts

### Bibliothèques Utilisées
- **Apache ECharts** (`echarts.min.js`) : Radar, Treemap, Line, Pie, Gauge — principalement dans les weekly reports
- **ApexCharts** (`apexcharts.min.js`) : Bar, Line, Area, Donut — principalement dans les analyses et scanner

### Types de Charts Utilisés

#### ECharts (weekly reports)
| Type | Usage | Section |
|------|-------|---------|
| `radar` | Score multi-facteurs (technique, fondamental, sentiment) | Synthèse, Risques |
| `treemap` | Rotation sectorielle / Heatmap secteurs | Rotation Sectorielle |
| `line` | Indices performance, prévisions analystes, yield curve | Macro, Outlook |
| `pie` | Allocation tactique (donut) | Allocation |

#### ApexCharts (analyses, scanner)
| Type | Usage | Section |
|------|-------|---------|
| `bar` | Volume, comparaison peers, scores | Scanner setups, Technique |
| `line` | Prix historiques, performance | Technique |
| `area` | Intraday, trends | Technique |
| `donut` | Répartition holders, allocation | Insiders |

### Potentiel ECharts Non Exploité
ECharts offre des types de charts avancés qui pourraient enrichir les articles :
- **Candlestick** : Charts OHLCV interactifs (alternative aux images Finviz)
- **Heatmap** : Corrélation matrix, calendrier de performance
- **Sankey** : Flux de capitaux (sector rotation flows)
- **Gauge** : Score de risque, RSI gauge, conviction gauge
- **Graph/Force** : Relations entre tickers (corrélation network)
- **Sunburst** : Hiérarchie secteur → industrie → ticker
- **Boxplot** : Distribution des returns, volatilité
- **Parallel** : Comparaison multi-facteurs entre tickers
- **Calendar** : Performance heatmap par jour
- **Map** : Exposition géographique du portfolio
- **3D** : Surface plots pour options (volatility surface)

### Directives Charting
- Toujours inclure les libs dans `<head>` : `<script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>` et/ou `<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>`
- Charts responsives : utiliser `window.addEventListener('resize', ...)` avec ECharts
- Thème cohérent : palette de couleurs alignée avec le design global
- Interactivité : tooltips, zoom, click events sur les data points
- Fallback : message "Chart not available" si les données manquent
