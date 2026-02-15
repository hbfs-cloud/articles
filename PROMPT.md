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

#### 13. Analyse des Risques (REFONTE UX — World-Class)
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
- Background: #f8fafc
- Text: #0f172a (primary), #475569 (body), #64748b (muted)

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
| **expert**    | Traders / Institutionnels | Article actuel complet, 15 sections, jargon technique, Wyckoff, Greeks, CTB, etc. |

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

#### Expert (15 sections — contenu actuel)
Identique au template Section 2 ci-dessus, sans changement.

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

### Sections de l'Article Scanner

#### Thème Dark
Le scanner utilise un thème dark (fond `#0f172a`, texte `#f1f5f9`) distinct du thème light des analyses individuelles.

#### Sections Obligatoires
1. **Hero** : Date, badge régime de marché (couleur selon régime), stats clés (nb setups, score moyen, stratégie dominante)
2. **Régime de Marché** : Description du régime détecté, composantes (VIX, SPX, DXY, crédit, liquidité, TLT), pondérations des stratégies
3. **Navigation Grid** : Liens internes vers chaque setup
4. **10 Setup Cards** : Pour chaque ticker :
   - Header avec ticker, nom, prix, variation
   - Badges : stratégie détectée, fiabilité, signal technique
   - **Description du setup** : ce qu'on voit techniquement (pattern, volumes, indicateurs)
   - **Confirmations** : ce qui valide le setup
   - **Invalidations** : ce qui annule le setup
   - **Alertes à placer** : niveaux de prix à surveiller
   - **Niveaux clés** : entrée, stop, target(s)
   - Score composite avec breakdown (technique, volume, momentum, risque)
   - Chart ApexCharts intégré
5. **Synthèse** : Tableau récapitulatif des 10 setups
6. **Méthodologie** : Explication du scoring et des stratégies
7. **Disclaimer** : Avertissement standard

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

| Tab | data-tab | Icône | Contenu |
|-----|----------|-------|---------|
| Hebdo | `weekly` | `fa-calendar-week` | Rapports hebdomadaires (tous visibles) |
| Analyses | `analyses` | `fa-chart-column` | Analyses individuelles avec filtre grade + recherche |
| Scanner | `scanner` | `fa-radar` | Scans quotidiens algorithmiques |
| Portfolio | `portfolio` | `fa-briefcase` | Stratégies systématiques |

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

## 8. CHARTING — Apache ECharts & ApexCharts

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
