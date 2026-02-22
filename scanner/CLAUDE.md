# Market Watch - Scanner Instructions

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
- **OBLIGATOIRE — Feedback rétrospective** : Avant de générer un nouveau scan, **toujours lire la dernière rétrospective** (`scanner/retrospective/index.html`) pour :
  - Identifier les stratégies qui sous-performent et réduire leur poids
  - Identifier les secteurs qui génèrent trop de faux signaux
  - Ajuster les seuils ATR (stops trop serrés/larges)
  - Mentionner en introduction du scan : "Suite à la rétrospective du DD/MM, nous avons ajusté [X]"
  - Éviter de recommander des tickers qui ont récemment été des flops dans les rétrospectives
  - Favoriser les stratégies et patterns qui ont montré le meilleur hit rate

---

## 5bis. RÉTROSPECTIVE SCANNER HEBDOMADAIRE


### Objectif
Article de rétrospective publié chaque vendredi soir (23h) qui passe en revue **tous les scans des 10 derniers jours**, évalue la qualité des setups, mesure l'écart entre prévisions et résultats réels, et note le scanner globalement. Les enseignements sont réutilisés pour affiner les prochains scans.

### Structure URL
```
scanner/
├── retrospective/
│   ├── index.html                # Latest = dernier article de rétrospective
│   ├── assets/report.css         # CSS (thème light, comme le scanner)
│   ├── variants.json             # Manifest (incluant archive)
│   └── archive/
│       └── YYYYMMDD/             # Versions précédentes
│           └── index.html
```

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

### Notation du Scanner

| Note | Hit Rate TP1 | P&L Moyen | Critère |
|------|-------------|-----------|---------|
| **A+** | > 70% | > +3% | Exceptionnel |
| **A** | 60-70% | > +2% | Très bon |
| **B+** | 50-60% | > +1% | Bon |
| **B** | 40-50% | > 0% | Correct |
| **C** | 30-40% | -1% à 0% | Médiocre |
| **D** | 20-30% | < -1% | Mauvais |
| **F** | < 20% | < -3% | Échec |

### Gestion des Versions
- `scanner/retrospective/index.html` = toujours la **dernière** rétrospective
- Lors de la création d'une nouvelle rétrospective :
  1. Déplacer l'actuelle dans `scanner/retrospective/archive/YYYYMMDD/`
  2. Créer la nouvelle en `scanner/retrospective/index.html`
  3. Le bouton Historique dans le header permet de naviguer entre les versions
- Mettre à jour `variants.json` avec la liste des archives

### Feedback Loop
Les leçons de chaque rétrospective sont utilisées pour affiner les scans suivants :
- Si une stratégie sous-performe → réduire son poids dans `RunAutoScreener`
- Si un secteur génère trop de faux signaux → ajuster les filtres
- Si les stops sont trop serrés → élargir les seuils ATR
- Mentionner explicitement dans le prochain scan : "Suite à la rétrospective du DD/MM, nous avons ajusté..."

---

