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
16. **Outlook** - 3 scénarios (haussier/central/baissier) avec probabilités + "Ce qu'il faut surveiller"
17. **Sources** - Toutes les sources organisées par catégorie avec liens

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

### Objectif
Analyse complète d'un ticker, lisible en 2 minutes. Style direct et punchy inspiré SLNH : headers avec emojis, bullet points courts, verdicts clairs par section. L'objectif est qu'un lecteur comprenne rapidement ce que fait la boîte, son setup, ses risques et si c'est un trade intéressant.

### 15 Sections Obligatoires

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

#### 13. Analyse des Risques (REFONTE COMPLÈTE — Style SLNH)
**Section critique** — format punchy avec risk-cards colorées.

Chaque risque = une `.risk-card` avec :
- Header emoji + titre clair
- 2-3 bullet points max, factuels et directs
- `.risk-verdict` en bas : verdict clair en 1 phrase
- Couleur de bordure selon sévérité : `-critical` (rouge), `-high` (orange), `-medium` (jaune), `-low` (vert)

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

#### 14. Trade Idea (`.trade-box`)
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

#### 15. Note Globale
- Conviction : A+ (très haute) à D (très faible)
- Biais : Haussier / Baissier / Neutre
- Confiance : % basé sur la qualité des données
- Profil : Spéculatif / Croissance / Value / Momentum / Contrarian
- **Key Takeaways** : 3 points positifs + 3 risques majeurs
- **Mindset Tip** : conseil psychologique pour le trader (FOMO, patience, sizing, etc.)

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
- `.alert-box` - Alerte important (rouge)
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
- `.risk-card` - Carte de risque style SLNH (bordure gauche colorée)
  - `.risk-card-critical` - Bordure rouge (#dc2626)
  - `.risk-card-high` - Bordure orange (#ea580c)
  - `.risk-card-medium` - Bordure jaune (#ca8a04)
  - `.risk-card-low` - Bordure verte (#16a34a)
  - `.risk-verdict` - Verdict en bas de la risk-card
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
- Background: #f8fafc
- Text: #0f172a (primary), #475569 (body), #64748b (muted)
