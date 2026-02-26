# Market Watch - Tech Instructions

## Articles Techniques

### Objectif
Guides techniques approfondis sur le trading, la finance, l'IA, les outils, et les concepts d'investissement. Format long (2000-5000+ lignes). Style pédagogique, exemples concrets, visualisations ECharts.

### Article de Référence
**`tech/ai-driven-dev/index.html`** est la référence pour la structure HTML, le style visuel, et le format.

### Template HTML Obligatoire (CRITIQUE)

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="fr" data-tags="ai,tech,architecture,security,opensource,education" data-tab="tech">
```
- `lang` : langue (fr, en, ar)
- `data-tags` : tags pertinents au sujet technique
- `data-tab="tech"` : toujours "tech"

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
      <span class="brand-title">MarketWatch</span>
    </a>
    <div class="brand-actions">
      <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
    </div>
  </div>
</nav>
```

#### Hero Section — `<header class="hero-section">`
```html
<header class="hero-section">
  <div class="hero-date">{CATEGORIE EN MAJUSCULES}</div>
  <h1>{Titre du guide}</h1>
  <p>{Description en 1-2 phrases}</p>
  <div id="article-clickable-tags" class="card-tags"></div>
</header>
```

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE)
```html
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#section1" class="fnav-item" data-section="section1"><i class="fas fa-bookmark"></i><span>{Titre Section 1}</span></a>
    <!-- ... autres sections ... -->
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>
```
Le nombre d'items FAB correspond aux sections principales du guide (6-10 items typiquement).

#### Footer (OBLIGATOIRE)
```html
<footer class="article-footer">
  &copy; 2026 Market Watch. Données via MarketWatch Gateway.
  Ceci n'est pas un conseil financier.
  <br><a href="/" title="Accueil"><i class="fas fa-house"></i></a>
</footer>
```
**TOUJOURS** `class="article-footer"`.

#### Scripts (OBLIGATOIRE — avant `</body>`)
```html
<script src="/assets/core.js"></script>
<script src="/assets/tag-renderer.js"></script>
```

### Structure du Contenu
- Chaque section dans un `<div id="section-id" class="content-card">`
- Utiliser `pedagogy-box` pour les explications
- Utiliser `alert-box` pour les avertissements
- Utiliser `data-table` pour les tableaux de données
- ECharts pour les visualisations (préféré)
- Code blocks avec coloration syntaxique si applicable

### Directives
- **CSS** : `/assets/report.css` (thème light). PAS de CSS local.
- **Brand Bar** : toujours `<nav class="brand-bar">` avec `brand-bar-inner`
- **Footer** : toujours `<footer class="article-footer">`
- **FAB** : obligatoire pour les articles longs (6+ sections)
- **Tags** : `data-tags` sur `<html>` + `data-tab="tech"` + `<div id="article-clickable-tags">`
- **Scripts** : `/assets/core.js` + `/assets/tag-renderer.js` avant `</body>`
- Lancer `node tools/add_card.js tech/{slug}/index.html` après création

---
