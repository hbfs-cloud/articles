# DailyTickers - Weekly Instructions

## Article de Référence

**`weekly/20260223/index.html`** est la référence pour le format, la structure HTML, et le style visuel. Tout nouveau weekly DOIT suivre ce modèle.

## GARDE-FOUS CRITIQUES (lire AVANT de générer)

### Date et Dossier
- Le weekly couvre **la semaine À VENIR** (lundi→vendredi), pas la semaine passée
- Dossier = `weekly/YYYYMMDD/` où YYYYMMDD = **lundi** de la semaine couverte
- Exemple : publié dimanche 1er mars → semaine couverte 2-6 mars → dossier `weekly/20260302/`
- **JAMAIS** créer un doublon qui chevauche une semaine déjà couverte
- **Vérifier `ls weekly/`** avant de créer le dossier

### Layout Interdit
- **FAB obligatoire** : Le weekly utilise le FAB flottant (fnav) comme tous les autres types d'articles. PAS de Navigation Grid inline.
- **PAS de `hero-brand-link` / `hero-brand-logo`** dans le hero
- **PAS de `<a>` ni `<img>` dans le `hero-section`** (sauf le bouton historique)
- Reproduire EXACTEMENT le layout de `weekly/20260223/index.html`

### Qualité minimum
- Taille HTML > **100KB** (si < 100KB → sections manquantes)
- **18 sections obligatoires** toutes présentes (voir liste ci-dessous)
- Données à jour via MCP Gateway (pas de données inventées)

## 1. RAPPORT HEBDOMADAIRE (Weekly Report)


### Objectif
Rapport de niveau institutionnel à destination de retail qui couvre tous les grands marchés US, EU, Asia, sur tous les assets (Stocks, ETF, Gold, Silver, Crypto). Vision globale macro, micro et géopolitique pour la semaine à venir.
**Langue par défaut : anglais, niveau intermédiaire** (sauf demande contraire).

### Template HTML Obligatoire (CRITIQUE)

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="en" dir="ltr" data-level="intermediate" data-tags="us,eu,asia,crypto,commodity,geopolitique,macro,earnings,trade-idea" data-tab="weekly">
```
- `lang` : langue (fr, en, ar)
- `dir` : direction texte (ltr ou rtl pour arabe)
- `data-level` : "intermediate" (par défaut)
- `data-tags` : tags pertinents du rapport
- `data-tab="weekly"` : toujours "weekly"

#### CSS — Thème Light (`report.css`)
```html
<link rel="stylesheet" href="/assets/report.css">
```
**JAMAIS** de dossier `assets/` local.

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

#### Hero Section — `<div class="hero-section">`
```html
<div class="hero-section">
  <div class="container">
    <h1>{Titre de la semaine}</h1>
    <p>{Sous-titre / résumé}</p>
    <div class="hero-badges">
      <span class="hero-badge">{Badge}</span>
    </div>
    <div id="article-clickable-tags" class="card-tags"></div>
    <button onclick="document.getElementById('weeklyHistoryModal').style.display='flex'">
      <i class="fa-solid fa-clock-rotate-left"></i> Historique des rapports
    </button>
  </div>
</div>
```

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE)
Le weekly utilise le FAB flottant comme tous les autres types d'articles. 6 items : Alerts, Markets, Metals & Crypto, Allocation & Trades, Outlook, Sources.

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

### Sections Obligatoires (dans l'ordre)

1. **Hero Section** - Titre accrocheur + badges clés + date de la semaine
2. **FAB Navigation** - Menu flottant avec 6 raccourcis vers les sections principales
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
Table `.data-table` avec colonnes : Secteur | Leader | Perf 1W | Perf 1M | Flow (In/Out) | TFM Signal
- Top 3 secteurs en inflows + Bottom 3 en outflows
- Badge 🟢 In / 🔴 Out pour les flux
- **MCP Forecast Rotation Signal (OPTIONNEL)** : appeler `Forecast` sur les 10 ETFs sectoriels (XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLC, XLRE, XLU) avec `context_length=200, horizon=10`. Afficher le **ranking relatif** (pas les valeurs absolues) dans la colonne "Forecast Signal". Top 3 = ▲, Bottom 3 = ▼, autres = ~.
  - ⚠️ Afficher uniquement le rang (▲/▼/~), **jamais les % de retour absolus** (non calibrés)
  - Timing : 10 ETFs en ~8s (2 appels de 5 tickers)
  - Exemple : "XLF ▲ | XLU ▲ | XLE ▼" dans la colonne TFM Signal

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

### Polymarket
Voir section Polymarket dans le CLAUDE.md racine. Intégrer dans : Géopolitique, Outlook, Macro, Crypto, Matrice des Risques.

---

### Directives
- Utiliser des données à jour via le MCP Gateway DailyTickers
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
- **CSS** : `/assets/report.css` (thème light). PAS de CSS local.
- **Brand Bar** : toujours `<nav class="brand-bar">` avec `brand-bar-inner` et logo MW `/logo.svg`
- **Footer** : toujours `<footer class="article-footer">`
- **Tags** : toujours `data-tags` sur `<html>` + `data-tab="weekly"` + `<div id="article-clickable-tags">`
- **Scripts** : toujours `/assets/core.js` + `/assets/tag-renderer.js` avant `</body>`

### Post-Publication (OBLIGATOIRE — NE JAMAIS SAUTER)

Après génération du fichier HTML, ces 4 étapes sont **BLOQUANTES**. Si l'une échoue, NE PAS passer à la suivante :

1. **Vérifier la taille** : `wc -c weekly/YYYYMMDD/index.html` — doit être > 100KB (sinon sections manquantes)
2. **Indexer** : `node tools/add_card.js weekly/YYYYMMDD/index.html` — vérifier que `data/weekly.json` et `data/search_data.js` apparaissent dans `git status`
   - **INTERDIT** de modifier `data/weekly.json` manuellement ou via Write/Edit. TOUJOURS utiliser `add_card.js` qui gère l'escaping JSON correctement.
3. **Mettre à jour le radar** : Écrire `data/radar.json` avec les données actuelles (risques, events, opportunités, régime)
4. **Commit & Push** :
   ```bash
   git add weekly/YYYYMMDD/ data/weekly.json data/search_data.js data/radar.json
   git commit -m "feat: weekly YYYYMMDD — {titre court}"
   git push origin main
   ```

**Si `add_card.js` échoue** : vérifier que le HTML est valide, que le `<html>` a `data-tab="weekly"` et `data-tags`, et que le hero contient un `<h1>`.

---

