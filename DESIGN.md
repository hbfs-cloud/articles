# Design

> **Baseline** — capture du système visuel **actuel** (`assets/report.css`, 3953 lignes) au
> 2026-06-14, avant la refonte impeccable. Sert de point de départ. Les tensions avec
> `PRODUCT.md` (anti-références) sont notées `⚠︎ refonte` pour guider le redesign.

## Theme

Light, dense, data-first. Fond clair (`#f8fafc` / blanc), texte slate foncé, accent bleu.
Pas de dark mode actuellement (`scanner/CLAUDE.md` : « JAMAIS de thème dark »).

⚠︎ refonte : la combinaison **bleu #2563eb + slate** est précisément la direction "fintech SaaS
générique" listée en anti-référence. La refonte doit déplacer l'identité vers FT/Economist +
précision terminal (couleur portée par l'accent/typo, pas un bleu SaaS par défaut).

## Color palette

Palette Tailwind "slate + blue", en dur (seules 4 variables CSS existent : les couleurs P&L).

**Neutres (slate)**
- Ink / texte principal : `#0f172a` (slate-900)
- Texte secondaire : `#334155` (slate-700), `#475569` (slate-600)
- Muted : `#64748b` (slate-500), `#94a3b8` (slate-400)
- Bordures : `#e2e8f0` (slate-200) — la couleur la plus utilisée (55×)
- Surfaces : `#ffffff`, `#f8fafc` (slate-50), `#f1f5f9` (slate-100), `#1e293b` (slate-800, dark blocks)

**Accent (brand)**
- Primary : `#2563eb` (blue-600, 48×) — boutons, liens, focus
- Primary light : `#3b82f6` (blue-500), tint `#eff6ff`

**Sémantique (état)** — les 4 seules variables CSS :
- `--color-pos: #10b981` / `--color-pos-soft: #dcfce7` ; renfort `#16a34a`
- `--color-neg: #ef4444` / `--color-neg-soft: #fee2e2` ; renfort `#dc2626`
- Warning / ambre : `#f59e0b` (badges, événements importants)
- Tints douces : vert `#f0fdf4`, rouge `#fef2f2`, bleu `#eff6ff`

⚠︎ refonte : P&L porté par **couleur seule** (vert/rouge) → non colorblind-safe. Ajouter
signe/forme/intensité. Migrer les valeurs en dur vers un set de **tokens** (`--bg`, `--surface`,
`--ink`, `--muted`, `--border`, `--accent`, `--pos`, `--neg`) — prérequis du système unifié.

## Typography

- **Sans** : `Inter` (Google Fonts) — titres, UI, labels, body, data. Tout.
- **Mono** : `JetBrains Mono` (fallback `Fira Code`, `Cascadia Code`) — chiffres/data/code.
- Pairing sain (sans + mono). Pas de display font séparée.
- Poids très chargés : 700 (33×), 800 (28×), 600 (27×), 900 (6×). Beaucoup de gras lourd.

⚠︎ refonte : exploiter le mono pour **toute la data tabulaire** (alignement des chiffres,
`font-variant-numeric: tabular-nums`). Pour la voix FT/Economist, envisager un **serif éditorial**
sur les titres d'articles (axe de contraste serif+sans) — registre brand uniquement, pas le dashboard.

## Spacing & shape

- **Radius** : 12px (défaut, 30×), 16px (grandes cartes), 8px / 6px (petits), 99px (pills/badges).
- Échelle d'espacement non tokenisée (valeurs en dur, variables).

⚠︎ refonte : tokeniser une échelle d'espacement (rythme) ; varier l'espacement par section.

## Components (inventaire actuel ~150 classes)

- **Navigation** : `brand-bar` / `brand-bar-inner` / `brand-nav` (liens Hebdo/Daily/Analyses/
  Scanner/Radar/Séries, actif auto via `data-tab`), `brand-logo` (logo MW `/logo.svg`),
  `breadcrumb`, `fnav` (FAB flottant 6 items).
- **Cartes** : `content-card`, `dash-card` (label/value/change), `dashboard-grid`, `bias-card`,
  `setup-card` (scanner), `hof-card`. ⚠︎ refonte : risque de "identical card grids" — varier.
- **Data** : `data-table`, `compare-table`, `divmat-table`, `score-row`, `echart-box` (ECharts).
- **Badges** : `badge` + 5 couleurs (`-blue` région, `-green` secteur, `-purple` thème,
  `-orange`/`-red` contenu) — taxonomie tags region/sector/theme/content.
- **Feedback** : `alert-banner`, `alert-box`, `confirm-box`, `disclaimer-mega`, `takeaway-box`,
  `didactic-box`, `checklist`.
- **Éditorial** : `quote-block`, `code-block-wrapper` (Shiki/`astro-code`), `chart-modal`,
  `article-switcher`, `variant-switcher` (multilingue/multi-niveau).
- **Footer** : `article-footer` (jamais `report-footer`/`site-footer`).

État d'interaction (hover/focus/active/disabled/loading) : partiel — ⚠︎ refonte : compléter le
vocabulaire d'état (cf registre product : chaque composant interactif a default/hover/focus/
active/disabled/loading/error).

## Layout

- `.container` centré ; grilles responsive (`dashboard-grid`, `repeat(auto-fit, minmax(...))`).
- Charts : **ECharts uniquement** (`echart-box`, `echarts-responsive.js`) — pas d'ApexCharts.
- Mobile : responsive existant mais ⚠︎ refonte : objectif **mobile-first dense** (data lisible
  au pouce) + **RTL arabe** réel (layout/tables/charts mirrorés), aujourd'hui non géré.

## Stack & conventions

- HTML statique + `/assets/report.css` (CSS unique global) + `/assets/core.js` (vanilla) +
  `tag-renderer.js`, `live-tracker.js`, `echarts-responsive.js`. GitHub Pages.
- Fonts : Inter + Font Awesome 6.4.0. GTM-T5Z595CW.
- Multilingue : 5 langues (en/fr/ar/es/zh), `data-i18n` + `translations`.

## Direction de refonte (résumé)

1. **Tokeniser** report.css (couleurs/espacement/typo) — fondation du système unifié.
2. **Sortir du bleu-slate SaaS** → identité FT/Economist + terminal (accent distinctif, mono pour data).
3. **A11y** : P&L colorblind-safe, RTL arabe, mobile-first dense, WCAG AA, reduced-motion.
4. **Dashboard scanner/status** : repenser pour **N modes groupés par classe d'actif**
   (Actions / Crypto / Métaux / Forex) — anticipe le volet A.
5. Compléter les états d'interaction + empty/loading states (registre product).
