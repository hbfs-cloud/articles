# DailyTickers - Series Instructions

## Séries Éducatives Multi-Chapitres

### Objectif
Séries pédagogiques de 4-8 parties sur un thème (Swing Mode, Patrimoine en Europe, Lire un Chart, etc.). Chaque partie est un article autonome relié aux autres par une barre de navigation série.

### Article de Référence
**`series/swing-mode/part1-setup/index.html`** est la référence pour la structure HTML, la series-bar, et le style visuel.

### Template HTML Obligatoire (CRITIQUE)

#### Balise `<html>` — Attributs Obligatoires
```html
<html lang="fr" data-tags="us,tech,finance" data-tab="analyses">
```
- `lang` : langue (fr, en, ar)
- `data-tags` : tags pertinents au sujet de la série
- `data-tab="analyses"` : les séries apparaissent dans le tab "analyses"

#### CSS — Thème Light (`report.css`)
```html
<link rel="stylesheet" href="/assets/report.css">
```
**JAMAIS** de dossier `assets/` local.

Chaque série définit sa couleur thème dans un bloc `<style>` en `<head>` :
```html
<style>
  /* Swing Mode = indigo #6366f1, Lire un Chart = orange #ea580c, etc. */
  .hero-badge-indigo { background: rgba(99,102,241,0.1); color: #6366f1; border: 1px solid rgba(99,102,241,0.2); }
  /* ... autres styles spécifiques à la série ... */
</style>
```

#### Brand Bar (OBLIGATOIRE)
```html
<nav class="brand-bar">
  <div class="brand-bar-inner">
    <a href="/" class="brand-logo">
      <img src="/logo.svg" alt="" width="36" height="36">
      <span class="brand-title">DailyTickers</span>
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
  <div class="hero-date"><i class="fa-solid fa-arrow-trend-up"></i> Série {Nom} — Partie {N} sur {Total}</div>
  <h1 class="hero-title">{Titre de la partie}</h1>
  <p class="hero-subtitle">{Description courte}</p>
  <div class="hero-badges">
    <span class="hero-badge hero-badge-{couleur}"><i class="fa-solid fa-{icon}"></i> {Badge}</span>
  </div>
  <div id="article-clickable-tags" class="card-tags"></div>
</section>
```

#### Series Bar — Navigation Inter-Chapitres (OBLIGATOIRE)
Placée **immédiatement après** le hero :
```html
<div class="series-bar">
  <div class="series-bar-inner">
    <span class="series-arrow disabled"><i class="fas fa-chevron-left"></i></span>
    <span class="series-title">{Nom de la série}</span>
    <div class="series-steps">
      <a href="/series/{slug}/part1-{slug}/" class="series-step current">
        <span class="series-num">1</span>
        <span class="series-label">{Titre Part 1}</span>
      </a>
      <a href="/series/{slug}/part2-{slug}/" class="series-step">
        <span class="series-num">2</span>
        <span class="series-label">{Titre Part 2}</span>
      </a>
      <!-- ... toutes les parties ... -->
    </div>
    <span class="series-counter">{N}/{Total}</span>
    <a href="/series/{slug}/part{N+1}-{slug}/" class="series-arrow">
      <i class="fas fa-chevron-right"></i>
    </a>
  </div>
</div>
```
- La partie courante a `class="series-step current"`
- La flèche gauche est `disabled` sur la partie 1
- La flèche droite est `disabled` sur la dernière partie

#### Tags Cliquables (OBLIGATOIRE)
```html
<div id="article-clickable-tags" class="card-tags"></div>
```
Placé dans le hero. Peuplé par `/assets/tag-renderer.js`.

#### FAB — Navigation Flottante (OBLIGATOIRE)
```html
<div class="fnav" id="floatingNav">
  <div class="fnav-menu" id="fnavMenu">
    <a href="#section1" class="fnav-item" data-section="section1"><i class="fas fa-bookmark"></i><span>{Section 1}</span></a>
    <!-- ... 6-8 items selon les sections ... -->
  </div>
  <button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation">
    <i class="fas fa-bars" id="fnavIcon"></i>
    <span class="fnav-btn-label" id="fnavLabel">Menu</span>
  </button>
</div>
```

#### Footer (OBLIGATOIRE)
```html
<footer class="article-footer">
  &copy; 2026 DailyTickers. Données via DailyTickers Gateway.
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
- `pedagogy-box` pour les explications pédagogiques
- `takeaway-box` pour les résumés de points clés
- `compare-table` pour les comparatifs
- `next-cta` en fin d'article pour le lien vers la partie suivante
- ECharts pour les visualisations

### Directives
- **CSS** : `/assets/report.css` (thème light) + `<style>` pour couleur thème série
- **Brand Bar** : toujours `<nav class="brand-bar">` avec `brand-bar-inner`
- **Series Bar** : obligatoire après le hero, avec toutes les parties listées
- **Footer** : toujours `<footer class="article-footer">`
- **FAB** : obligatoire
- **Tags** : `data-tags` sur `<html>` + `data-tab="analyses"` + `<div id="article-clickable-tags">`
- **Scripts** : `/assets/core.js` + `/assets/tag-renderer.js` avant `</body>`
- Lancer `node tools/add_card.js series/{slug}/{part}/index.html` après création

---
