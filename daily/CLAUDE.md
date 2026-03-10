# Market Watch - Daily Instructions

## 2bis. BRIEFING QUOTIDIEN (Daily Briefing)


### Objectif
Briefing matinal quotidien publié à 7h00 couvrant tous les marchés (US, Europe, Asie-Pacifique, Crypto). Langue : anglais intermediate par défaut (sauf demande contraire). Style concis, actionnable, données à jour.

### Référence
Le daily du **25 février 2026** (`daily/20260225/`) est la référence pour la structure HTML, les classes CSS, les ECharts, et le style visuel d'un briefing semaine.

### Template HTML Obligatoire (CRITIQUE)

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="en" data-tags="crypto,macro,trade-idea,formation" data-tab="daily">
```
- `lang` : langue (fr, en, ar)
- `data-tags` : tags pertinents du briefing
- `data-tab="daily"` : toujours "daily"

#### CSS — Thème Light (`report.css`)
```html
<link rel="stylesheet" href="/assets/report.css">
```
**JAMAIS** de dossier `assets/` local. **JAMAIS** de `report-dark.css` pour le daily.

#### Brand Bar (OBLIGATOIRE)
```html
<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo">
      <img src="/logo.svg" alt="" width="36" height="36">
      <span class="brand-title">MarketWatch</span>
    </a>
    <div class="brand-actions">
      <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
    </div>
  </div>
</nav>
```

#### Hero Section — `<section class="hero-section">`
```html
<section class="hero-section">
  <div class="container">
    <div class="hero-date">{Jour} {Date} • {Édition}</div>
    <h1 class="hero-title">{Titre du briefing}</h1>
    <p class="hero-subtitle">{Sous-titre}</p>
    <div class="hero-badges">
      <span class="hero-badge">{Badge}</span>
    </div>
    <div id="article-clickable-tags" class="card-tags"></div>
  </div>
</section>
```

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE — 6 items)
```html
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#alerte" class="fnav-item" data-section="alerte"><i class="fas fa-bullhorn"></i><span>Flash Info</span></a>
    <a href="#dashboard" class="fnav-item" data-section="dashboard"><i class="fas fa-tachometer-alt"></i><span>Dashboard</span></a>
    <a href="#explications" class="fnav-item" data-section="explications"><i class="fas fa-lightbulb"></i><span>Explications</span></a>
    <a href="#sentiment" class="fnav-item" data-section="sentiment"><i class="fas fa-brain"></i><span>Sentiment</span></a>
    <a href="#formation" class="fnav-item" data-section="formation"><i class="fas fa-graduation-cap"></i><span>Formation</span></a>
    <a href="#trade" class="fnav-item" data-section="trade"><i class="fas fa-crosshairs"></i><span>Trade Idea</span></a>
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>
```
Adapter les 6 items aux sections principales du briefing. Le JS gère toggle, smooth scroll, IntersectionObserver.

#### Footer (OBLIGATOIRE)
```html
<footer class="article-footer">
  &copy; 2026 Market Watch. Données via MarketWatch Gateway.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>
```
**TOUJOURS** `class="article-footer"`. Jamais d'autre classe de footer.

#### Scripts (OBLIGATOIRE — avant `</body>`)
```html
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
```

#### Charts — ECharts
Utiliser ECharts pour les visualisations (bar, radar, gauge, line). Conteneur : `<div id="chartId" class="echart-box" style="width:100%; height:300px;"></div>`

### Sections Obligatoires — Jour de Semaine (Lun-Ven) & Samedi

1. **Brand Bar** — Logo MARKET WATCH + switcher langue
2. **Hero Section** — Titre du jour + badges clés (3-5) + date
3. **Navigation Grid** — Liens internes vers chaque section (icônes + labels)
4. **Alerte du Jour** — Événement #1 en `.alert-banner` (rouge si critique, orange si important)
5. **Dashboard Rapide** — Grille 4×4 `.dashboard-grid` avec `.dash-card` :
   - S&P 500, Nasdaq, Dow, Russell 2000, BTC, Or, Pétrole, VIX
   - Chaque carte : label, valeur, variation (`.up` / `.down`), badge couleur
6. **Bilan de la Veille / Semaine** — Tableau récap de la séance précédente
   - Indices US, secteurs top/bottom, volumes
   - ECharts: barplot secteurs ou heatmap performance
7. **Agenda du Jour & Semaine** — Grille calendrier `.calendar-days-grid` (Lun→Ven)
   - Événements macro (CPI, FOMC, PMI), earnings, IPO
   - Codage couleur : critical (rouge), important (jaune), normal (gris)
8. **Marchés US** — Récap détaillé de la dernière séance
   - Tableau indices (SPY, QQQ, DIA, IWM) : prix, variation, volume, 52W
   - Top 3 / Bottom 3 performers du jour
   - Rotation sectorielle (table + ECharts barplot)
   - Commentaire : catalyseurs, flux, breadth
9. **Marchés Europe** — DAX, CAC 40, FTSE 100, STOXX 600
   - Tableau indices avec variations
   - **Top 3 / Bottom 3 performers** du jour (actions individuelles : Moncler +15%, etc.)
   - Earnings européens marquants (Air Liquide, Danone, LVMH, etc.)
   - Faits marquants de la séance européenne
10. **Marchés Asie-Pacifique** — Nikkei, Hang Seng, ASX 200, KOSPI, Shanghai
    - Tableau indices avec variations
    - **Top 3 / Bottom 3 performers** du jour (actions individuelles ou secteurs)
    - Faits marquants (Chine, Japon, politique monétaire BOJ/PBOC)
11. **Crypto** — BTC, ETH, SOL, XRP, alts majeurs
    - Tableau : prix, variation 24h, variation 7j, dominance
    - Niveaux clés (support/résistance)
    - ECharts: line chart BTC + ETH 7 jours
    - News crypto marquantes
12. **Géopolitique** — 2-3 fronts actifs avec impact marché
    - Format `.geo-alert` par front
    - Impact : quel marché, quel secteur, quel scénario
13. **Métaux Précieux** (si mouvement significatif) — Or, Argent, Platine
    - Niveaux, variation, drivers (USD, real rates, safe-haven)
14. **Formation du Jour** — Leçon pédagogique liée à l'actualité
    - Titre accrocheur, explication claire, exemple concret
    - Format `.pedagogy-box` avec sous-sections
    - ~300-500 mots, niveau beginner accessible
15. **Idées de Trading** — 2-3 setups swing argumentés
    - Format `.trade-idea` (dark card) : ticker, direction, entrée/stop/TP1/TP2, R:R
    - Thèse en 2-3 phrases, catalyseur, horizon
16. **Ce qu'il faut Surveiller** — Checklist des 5-8 événements/niveaux à suivre
    - Format liste avec icônes (horloge, oeil, alerte)
17. **Sources & Disclaimer** — Sources organisées + disclaimer légal

### Spécificités Samedi (post-séance vendredi)

Le samedi est un **briefing complet** qui couvre la séance de vendredi :
- **Toutes les sections standard** ci-dessus (US, Europe, Asie-Pacifique, Crypto, etc.)
- **Section supplémentaire : Bilan Hebdomadaire** — Récap de la semaine complète (Lun→Ven)
  - Performance 5 jours de tous les indices
  - Secteurs gagnants/perdants de la semaine
  - ECharts : barplot performance hebdomadaire
- **Section supplémentaire : Preview Semaine Prochaine** — Earnings, macro, événements clés
- Le hero utilise un gradient **violet/indigo** pour distinguer visuellement du weekday
- Titre format : "Saturday Briefing — [Date]" (pas "Weekend Edition")

### Spécificités Dimanche (marchés fermés — Crypto & Géopolitique)

Le dimanche est le **seul jour** avec format réduit crypto-only :
- **Pas de sections US/Europe/Asie-Pacifique** (marchés fermés, déjà couverts samedi)
- **Sections obligatoires** :
  1. Hero (gradient violet/indigo) + badges crypto
  2. Dashboard Rapide (crypto-only : BTC, ETH, SOL, XRP, dominance, fear/greed)
  3. **Crypto Deep Dive** — Analyse technique détaillée BTC, ETH, alts (ECharts)
  4. Géopolitique — Impacts attendus sur l'ouverture lundi
  5. Preview Lundi — Catalyseurs, niveaux clés, earnings
  6. Formation du Jour — Sujet plus long/approfondi (ex: "Volume Profile", "Options Basics")
  7. Idées de Trading — Crypto-only ou swing moyen terme
  8. Sources & Disclaimer
- Titre format : "Weekend Briefing — Sunday [Date] (Crypto & Geopolitics)"

### ECharts Recommandés
- **Barplot horizontal** : Performance sectorielle / indices
- **Line chart** : BTC & ETH 7 jours / indices intraday
- **Gauge** : VIX, Fear & Greed
- **Heatmap** : Calendrier de la semaine avec performance par jour
- **Radar** : Profil de risque du marché (6 axes)

### Directives
- Données à jour via MCP Gateway (GetMarketOverview, QueryData)
- WebSearch pour actualités, calendrier économique, géopolitique
- Chaque chiffre doit être sourcé et daté
- Ton : professionnel mais accessible, pas de jargon non expliqué
- Mobile-first : tableaux responsive, grilles adaptatives
- **CSS** : `/assets/report.css` (thème light). **PAS** `report-dark.css`.
- Toujours inclure GTM (GTM-T5Z595CW), Inter font, Font Awesome 6.4.0
- ECharts pour les charts (préféré). ApexCharts acceptable en complément.
- **Brand Bar** : toujours `<nav class="brand-bar">` avec `brand-bar-inner` et logo MW
- **Footer** : toujours `<footer class="article-footer">`
- **FAB** : toujours 6 items dans `.fnav`
- **Tags** : toujours `data-tags` sur `<html>` + `data-tab="daily"` + `<div id="article-clickable-tags">`
- **Scripts** : toujours `/assets/core.js` + `/assets/tag-renderer.js` avant `</body>`

### Post-Publication (OBLIGATOIRE — NE JAMAIS SAUTER)

Après génération du fichier HTML, ces 4 étapes sont **BLOQUANTES**. Si l'une échoue, NE PAS passer à la suivante :

1. **Vérifier la taille** : `wc -c daily/YYYYMMDD/index.html` — doit être > 30KB (sinon article tronqué/incomplet)
2. **Indexer** : `node tools/add_card.js daily/YYYYMMDD/index.html` — vérifier que `data/daily.json` et `data/search_data.js` apparaissent dans `git status`
3. **Mettre à jour le radar** : Écrire `data/radar.json` avec les données actuelles (risques, events, opportunités, régime)
4. **Commit & Push** :
   ```bash
   git add daily/YYYYMMDD/ data/daily.json data/search_data.js data/radar.json
   git commit -m "feat: briefing quotidien DD mois YYYY — {titre court}"
   git push origin main
   ```

**Si `add_card.js` échoue** : vérifier que le HTML est valide, que le `<html>` a `data-tab="daily"` et `data-tags`, et que le hero contient un `<h1>`.

---

