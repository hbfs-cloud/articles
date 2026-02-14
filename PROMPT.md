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
15. **Outlook** - 3 scénarios (haussier/central/baissier) avec probabilités + "Ce qu'il faut surveiller"
16. **Sources** - Toutes les sources organisées par catégorie avec liens

### Directives
- Utiliser des données à jour via le MCP Gateway MarketWatch
- Ne pas se focaliser uniquement sur le dernier prix mais l'évolution (barres 15m/daily)
- Les sujets de la semaine dernière ne sont pas forcément les plus importants à venir: être proactif
- Chaque section doit contenir des phrases explicatives et didactiques
- Les chiffres cités doivent être à jour et sourcés
- Boxes pédagogiques (pedagogy-box, didactic-box) pour expliquer les concepts
- Boxes d'alerte (alert-box) pour les risques importants
- Toujours inclure le disclaimer en fin de rapport

---

## 2. ANALYSE INDIVIDUELLE (Ticker Analysis)

### Objectif
Analyse complète d'un ticker spécifique, de niveau institutionnel, couvrant fondamentaux, technique, sentiment et trade ideas.

### 12 Sections Obligatoires

#### 1. Header
- Ticker, exchange, date
- Prix, variation jour, market cap, volume, float, short interest

#### 2. Activité
- Description de l'entreprise et de son business
- Segments principaux avec métriques clés
- Secteur et classification

#### 3. Actualités Récentes
- 4-6 news récentes avec dates
- Impact sur le cours

#### 4. Fondamentaux
- Table: Revenus, EBITDA, Résultat net, EPS, Marges, Cash, Dette, P/B, P/E, Target analystes
- Interprétation de chaque ligne

#### 5. Insiders & Institutions
- % insiders, noms des principaux
- % institutions, top 3 holders
- Mouvements récents (achats/ventes)

#### 6. Short Interest
- Actions short, % du float, days to cover, CTB
- Potentiel squeeze si > 20%

#### 7. Dérivés (Options)
- Call/Put OI, ratio, Max Pain, IV moyenne
- Biais directionnel

#### 8. Technique (Journalier)
- Table: RSI14, MACD, Signal, EMAs (20/50/200), ATR, OBV, Wyckoff phase
- Supports et résistances
- Structure et signal

#### 9. Secteur / Pairs
- Table de corrélation avec 4-5 pairs
- Performance relative YTD
- Positionnement dans le secteur

#### 10. Macro
- Table: BTC, ETH, SPX, VIX (ou actifs pertinents)
- Beta et corrélations
- Impact macro sur le titre

#### 11. Risques Clés
- Table: 5-6 risques avec niveau, impact, source
- Risques spécifiques au titre

#### 12. Trade Idea (Swing)
- Entrée, Stop, TP1/TP2/TP3, R/R
- Catalyseurs identifiés

### Note Globale
- Conviction (A+ à D), Biais, Confiance (%), Profil
- Key Takeaways (points positifs et risques)
- Mindset Tip

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

### Classes CSS Clés
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

### Couleurs
- Hausse: #16a34a (vert)
- Baisse: #dc2626 (rouge)
- Neutre: #64748b (gris)
- Or: #eab308
- Crypto: #f97316
- Info: #3b82f6
- Background: #f8fafc
- Text: #0f172a (primary), #475569 (body), #64748b (muted)
