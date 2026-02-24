# Market Watch - Weekly Instructions

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
- **Switcher langue/niveau** : ne JAMAIS inclure le switcher (boutons Expert/Beginner, FR/EN/AR) si les variantes correspondantes n'existent pas. Le switcher ne doit être présent que si toutes les pages cibles sont générées.

---

