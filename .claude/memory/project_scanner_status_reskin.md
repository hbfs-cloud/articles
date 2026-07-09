---
name: project-scanner-status-reskin
description: scanner/status — thème clair UNIQUE (pas de dark), reskin premium en 3 leviers scopés dans gen-status-page.js ; l'equity chart est déjà cohérent (ne pas "unifier")
metadata:
  type: project
---

# scanner/status — direction design (2026-07-09)

**Décision cadre : UN SEUL thème propre, PAS de dark mode.** Une tentative de dark (tokens flip +
toggle) a été **revertée** — le rendu était mauvais (texte dark-on-dark, charts non thémés) et le user
a tranché « pas besoin de mode dark, un seul thème propre fait le job ». **Ne pas re-tenter le dark** sur
scanner/status (ni ailleurs) sans demande explicite. La vieille note `scanner/CLAUDE.md` « JAMAIS de
dark » tient donc, mais pour la bonne raison (un seul thème soigné > deux thèmes bâclés).

## Reskin premium livré — 3 leviers (tous SCOPÉS dans le `<style>` inline de `tools/gen-status-page.js`)
Aucune modif de `report.css` global → zéro impact sur landing/articles. Régénéré par le générateur donc
survit aux runs nocturnes. Commits : `3477590fe`, `a5a90b42f`, `fffd48f93`.
1. **Cartes premium** — retrait des **side-stripe borders** colorées par le mode (le tell AI n°1) sur
   `.section-card` / `.perf-hero` / `.ps` (via override `border:...!important`) + **élévation douce**
   (ombre basse-opacité + lift au hover). L'identité du mode reste sur l'onglet actif, pas peinte sur
   chaque bord de carte.
2. **Fond gris cool** — re-définition des tokens `--bg`/`--surface-2`/`--border` **sur `body`** (hue 250)
   pour sortir du **blanc chaud limite-cream** (anti-réf) → les cartes blanches + l'ombre ressortent.
3. **Rythme d'espacement** généreux **desktop uniquement** (`@media min-width:768px`) — mobile reste
   dense (mandat PRODUCT.md « mobile-first dense »).

## Ne PAS re-faire (vérifié, faux problèmes)
- **« Unifier la palette de charts »** : inutile. L'equity chart ECharts est **déjà cohérent** (ligne =
  couleur du mode = identité, échelle de gris homogène #94a3b8/#e2e8f0/#f1f5f9, rouge pour le drawdown).
  Les hex « variés » (#8e44ad, #6366f1…) sont les **couleurs d'identité par mode** (modes-config), pas des
  couleurs de chart. ECharts rend en **canvas** → les `var(--)` CSS n'y marchent pas (valeurs concrètes).
- Le badge cyan `#0891b2` (ligne ~1257) + le violet fortress `#6d28d9` sont des **encadrés thématiques
  délibérés** (Orbit = satellite/cyan, Fortress = bouclier/violet), pas des incohérences.

## Reste à faire (si demandé)
- Appliquer la même direction premium aux **autres surfaces** (landing `index.html`, articles) — pas
  encore fait. Si on ré-ouvre un dark un jour, il faudra une passe sérieuse (LP table, ECharts theme-aware
  via palette JS + re-render, contrastes AA) — pas un simple flip de tokens.

Voir `PRODUCT.md` (registre product, anti-réfs cream/SaaS/Bloomberg), `DESIGN.md`, skill `impeccable`.
