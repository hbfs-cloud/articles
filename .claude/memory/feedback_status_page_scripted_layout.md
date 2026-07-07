---
name: status-page-scripted-layout
description: Le desktop grid de scanner/status (.lp-grid) cassait sur grand écran pour les modes scriptés — overlap positions/history + equity étirée
metadata:
  type: feedback
---

Bug reporté par le user (2026-07-07) : sur **grand écran** (≥1024px), les panels des modes
**scriptés** (highvol/etf/etf_eu/hybrid/forex) rendaient mal — "Live portfolio prend tout
l'écran", "Trade History mêlée aux Open Positions". En **rétrécissant la largeur, tout revenait
normal** (indice fort : bug uniquement dans le desktop grid, block-flow mobile OK).

**Deux causes racines, reproduites en vrai navigateur (Playwright 1440px), pas en lisant le code :**

1. **Overlap positions/history** : dans `assets/live-engine-ui.js` `reorganizePanel()`, le tagger
   texte testait `open`/`position` AVANT `history`. Le titre "Trade History … N open" contient le
   mot "open" → carte Trade History mal-taguée `data-grid="positions"` → posée sur la même
   `grid-row:7` que la vraie Open Positions → superposition. **Fix** : tester `history` avant
   `open/position` (match sur "history" seul, PAS le générique "trade" qui a des faux positifs).

2. **Equity étirée / "prend tout l'écran"** : le CSS `@media(min-width:1024px) .lp-grid` hardcodait
   `grid-row` 1→8 pour le jeu COMPLET de sections des modes quality. Les scriptés émettent un
   sous-ensemble clairsemé (souvent juste live+equity+orders+positions) → `equity{grid-row:2/span 5}`
   s'étirait sur 5 rangées vides (681px) et `align-items:stretch` gonflait la seule carte de droite
   (orders) à 681px. **Fix** : placement adaptatif JS `placeDesktopGrid(grid)` (recalcule le span
   equity = nb d'items visibles à droite, rangées denses séquentielles depuis les sections
   réellement présentes+visibles) + `align-items:start` (cartes = hauteur naturelle) + equity
   `align-self:stretch`. En <1024px, `placeDesktopGrid` NETTOIE les `grid-row` inline (block-flow).

**Why** : un grid à rangées hardcodées suppose que TOUTES les sections existent. Dès qu'un mode a un
jeu de sections différent, ça laisse des trous/overlaps invisibles au dev mais visibles à l'écran.

**How to apply** : toute grille de dashboard multi-mode doit être **content-adaptive** (compter les
items réellement présents/visibles, pas de rangées fixes). Et le tagging de sections par texte de
titre est fragile — préférer un `data-section` explicite, ou ordonner les tests du plus spécifique
au plus générique. TOUJOURS vérifier le layout en vrai navigateur à ≥1440px ET en mobile, jamais
au curl/lecture de code. Commit a653430b7. Lié à [[orders-hidden-date-comparison-bug]].
