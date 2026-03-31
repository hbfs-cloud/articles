# DailyTickers - Scanner Instructions

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
5. `gen-status-page.js` — Régénère scanner/status/index.html (text-only, 3 tabs avec tableaux de trades)
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
│   ├── index.html                # Default = intermediate/en
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

### Collecte des Données
1. **`RunAutoScreener`** : Détection du régime de marché + candidats auto-adaptatifs
2. **`RunScreener`** avec DSL personnalisé : 3 stratégies complémentaires
   - Oversold bounce : `rsi14<35 && vol>sma(vol,20)*1.5`
   - Momentum expansion : `close>sma(close,20) && vol>sma(vol,20)*2 && rsi14>50 && rsi14<75`
   - Breakout squeeze : `close>sma(close,50) && atr(14)>atr(28)*1.2`
3. **`QueryData`** types: quote,insider_transactions pour les 10 tickers retenus (validation prix spot + détection achats insiders)
4. **WebSearch** pour les catalyseurs récents de chaque ticker

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

### Filtres Anti-Dilution & Fonds Agressifs (OBLIGATOIRE — BLOQUANT)

**Avant de retenir un ticker dans le top 10, vérifier OBLIGATOIREMENT les risques de dilution massive. Un ticker qui échoue à ces filtres est DISQUALIFIÉ même avec un score élevé.**

#### Checks SEC (via WebSearch "site:sec.gov {TICKER} S-1 S-3 424B")
- **Prospectus de dilution** : dépôt S-1, S-3, 424B récent (< 90 jours) → **DISQUALIFIER**
- **ATM program (At-The-Market)** : accord permettant l'émission continue d'actions → **DISQUALIFIER si actif**
- **Warrants** : vérifier s'il existe des warrants exerçables à court terme (PIPE, SPAC legacy) → **-15 pts score ou DISQUALIFIER**
- **Shelf registration** : dépôt S-3ASR ou shelf registration déclenché → **avertissement obligatoire**

#### Fonds Agressifs & Short Interest Toxique
- **Vérifier le short interest** : si > 30% du float → flag "High Short Interest" obligatoire dans les invalidations
- **Fonds agressifs (Wainwright, Maxim, Dawson James, etc.)** : si le ticker a eu une offre récente via ces banques → **DISQUALIFIER** (ces fonds revendent immédiatement, écrasant le cours)
- **PIPE récent** : Private Investment in Public Equity dans les 6 mois → **DISQUALIFIER** (actions déjà en circulation à discount)
- **Reverse split récent** (< 6 mois) → **DISQUALIFIER** (signe de détresse financière)

#### Procédure de vérification
```
Pour chaque ticker candidat :
1. WebSearch "{TICKER} SEC filing dilution warrant 2025 2026"
2. WebSearch "{TICKER} prospectus offering site:sec.gov"
3. Si micro-cap (< $500M market cap) : vérification OBLIGATOIRE du float et short interest
4. Résultat : mentionner dans la section Invalidations si risque identifié
```

#### Exemple (cas INDO)
INDO avait un fund agressif (Wainwright) + warrants → dilution massive concrétisée.
Ce risque n'apparaissait PAS sur la fiche technique classique. Seule la vérification SEC active permet de le détecter.

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

#### Titre de la Carte Scanner (OBLIGATOIRE)

Le `<h2>` de chaque carte scanner dans `data/scanner.json` DOIT suivre ce format exact :

```
Top 10 A+ {REGIME} — {TICKER1}, {TICKER2}, {TICKER3}, ..., {TICKER10}
```

- **{REGIME}** : le régime détecté en MAJUSCULES — **UNIQUEMENT ces 5 valeurs** : `RISK-ON`, `EARLY RISK-OFF`, `RISK-OFF`, `NEUTRAL`, `RECOVERY`
  - ⚠️ **INTERDIT** : `DEEP RISK-OFF`, `STRONG RISK-ON`, `EXTREME RISK-OFF`, `MODERATE NEUTRAL`, ou tout autre label inventé
  - Si le marché est très baissier → `RISK-OFF` (pas "DEEP RISK-OFF")
  - Si début de détérioration → `EARLY RISK-OFF`
- **{TICKERS}** : les 10 tickers séparés par des virgules, dans l'ordre du scan
- **Jamais** de titre générique ("Daily Scanner", "Scan du jour", etc.)

**Exemples conformes** :
- `Top 10 A+ EARLY RISK-OFF — MRVL, HIMS, CF, IOT, ADBE, LLY, TLT, SQQQ, DBA, SAP`
- `Top 10 A+ RISK-OFF — XOM, EQNR, RTX, KR, ADM, TTE, GLD, EWY, SH, UNG`

Le `<div class="report-card-meta">` doit contenir la date au format `{Day}, {Month} {DD}, {YYYY}` (en anglais) ou `{Jour} {DD} {Mois} {YYYY}` (en français).

#### Mise à jour Index.html

Lors de l'ajout de la carte scanner dans `index.html`, **mentionner la couverture géographique** dans la description :

```html
<p style="font-size:0.85rem; color:var(--text-muted);">
    {Description du régime}. {Stratégies}. 10 setups analysés : {Tickers US} (US), {Tickers EU} (Europe), {Tickers Asia} (Asie), {ETFs}.
</p>
```

**Exemple** :
> "Rotation défensive confirmée. Hausse VIX +4.2%. 10 setups analysés : XOM, HRL, UNH (US), SAP, BBVA (EU), EWJ (Asie), GLD, XLE (ETFs)."

### Template HTML Obligatoire (CRITIQUE)

Chaque scanner DOIT suivre exactement cette structure HTML. Référence : `scanner/20260219/index.html`.

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="en" data-tags="us,eu,asia,commodity,etf,technique,trade-idea,macro,energy,financials,healthcare" data-tab="scanner">
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
   - Badges : stratégie détectée, fiabilité, signal technique, badge géographique (US/EU/Asia/ETF)
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
  4. La carte dans `scanner.json` DOIT avoir le style rétrospective : bordure colorée selon la note, badges RÉTROSPECTIVE + NOTE, bouton gradient
- **NE PAS** supprimer les anciennes rétrospectives — elles restent dans l'index `scanner.json` triées par date avec les scans

### Feedback Loop
Les leçons de chaque rétrospective sont utilisées pour affiner les scans suivants :
- Si une stratégie sous-performe → réduire son poids dans `RunAutoScreener`
- Si un secteur génère trop de faux signaux → ajuster les filtres
- Si les stops sont trop serrés → élargir les seuils ATR
- Mentionner explicitement dans le prochain scan : "Suite à la rétrospective du DD/MM, nous avons ajusté..."

### Post-Publication (OBLIGATOIRE — NE JAMAIS SAUTER)

Après génération du fichier HTML, ces 5 étapes sont **BLOQUANTES**. Si l'une échoue, NE PAS passer à la suivante :

1. **Vérifier la taille** : `wc -c scanner/YYYYMMDD/index.html` — doit être > 30KB (sinon article tronqué/incomplet)
2. **Indexer** : `node tools/add_card.js scanner/YYYYMMDD/index.html` — vérifier que `data/scanner.json` et `data/search_data.js` apparaissent dans `git status`
   - **INTERDIT** de modifier `data/scanner.json` manuellement ou via Write/Edit. TOUJOURS utiliser `add_card.js` qui gère l'escaping JSON correctement.
3. **Mettre à jour le watchlist** : Écrire `mcp/watchlist.json` avec les 10 picks du scan
4. **Mettre à jour le radar** : Écrire `data/radar.json` avec les données actuelles
5. **Commit & Push** :
   ```bash
   git add scanner/YYYYMMDD/ data/scanner.json data/search_data.js mcp/watchlist.json data/radar.json
   git commit -m "feat: scanner YYYYMMDD — {régime}, 10 setups A+"
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

### 3 Modes Optimaux (resultats 20/03/2026)

1. **Maximum Growth** : P4/Top4/all/aggressive/H5 -> +18.88%, DD -1.13%, Sharpe 16.71, 18 trades
2. **Risk-Adjusted** : P5/Top5/no_sq/daily_max1/H5 -> +13.41%, DD -0.24%, Calmar 542, 19 trades
3. **Zero Drawdown** : P3/Top2/momentum_only/aggressive/H20/PTP/Trail -> +7.42%, DD 0%, WR 77.8%, 9 trades

### Usage

    node tools/sweep.js          # Full (98k combos, ~5 min)
    node tools/sweep.js --quick  # Quick (720 combos, ~30s)
    node tools/sweep.js --verbose # Debug output

### Outputs
- data/backtest-results.json : Resultats complets (top 20, optimal par metrique)
- data/portfolio-history.json : Equity curve du combo optimal

### Page publique
series/scanner-strategy/index.html — Guide des 3 modes avec ECharts, tabs, et instructions.

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
| `gen-status-page.js` | `backtest-trades.json`, `modes-config.json`, `backtest-results.json` | `scanner/status/index.html` (text-only, 3 tabs) | Step 5 |

**Single source of truth** : la page HTML et les tableaux sont generes depuis les memes fichiers JSON. Jamais de valeurs hardcodees.

**scanner/status/index.html** contient :
- Hero + 3 tabs (Growth, Calmar, Conservative) avec KPIs, config, equity chart ECharts
- Tableau historique des trades par mode (ticker, date, strategy, entry, exit, P&L, duree, statut)
- Tableau comparatif des 3 modes
- Pas d'images (tout en texte/HTML)

**Images PNG** (`gen-3-cards.js`) : utilisees uniquement pour Telegram/Discord, pas affichees sur la page status.
Noms timestampes (`mode-growth-{ts}.png`) avec `manifest.json` pour le cache busting.

**update-tracking.js** produit dans `scanner-metrics.json` :
- `return_total`, `profit_factor`, `total_days`, `scans_count`, `return_dd_ratio`
- `portfolio_history`, `drawdown_history` (arrays pour equity/DD curves)
- `working_capital_pct`, `pending_orders_pct`, `available_cash_pct`

**Service Worker** : supprime (sw.js = stub auto-unregister). Pas de cache SW.

### Lancer manuellement le sweep seul

    node tools/sweep.js && node tools/gen-3-cards.js && node tools/gen-status-page.js
