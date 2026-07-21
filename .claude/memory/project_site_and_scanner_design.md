---
name: site-and-scanner-design
description: "Direction design site + scanner/status : thème clair UNIQUE (dark reverté, ne pas re-tenter), reskin premium scopé, bilingue FR/EN, sync tags 3 sources, sous-onglets scanner, scan éditorial ≤40 candidats, refonte impeccable (product unifié, mobile-first dense, RTL, colorblind-safe)."
metadata:
  type: project
---

# Direction design — site & scanner/status

Consolidation des décisions design juin-juillet 2026 (reskin scanner, langue/nav, scan éditorial, refonte).

## Thème : UN SEUL thème clair (PAS de dark)
Une tentative de dark mode (tokens flip + toggle) a été **revertée** — rendu mauvais (texte dark-on-dark,
charts non thémés) et le user a tranché « un seul thème propre fait le job ». **Ne PAS re-tenter le dark**
(scanner/status ni ailleurs) sans demande explicite. Si un jour on ré-ouvre : passe sérieuse obligatoire
(LP table, ECharts theme-aware via palette JS + re-render, contrastes AA) — pas un simple flip de tokens.

## Reskin premium scanner/status — 3 leviers (SCOPÉS dans le `<style>` inline de `gen-status-page.js`)
Aucune modif de `report.css` global → zéro impact landing/articles. Régénéré par le générateur donc survit
aux runs nocturnes (commits `3477590fe`, `a5a90b42f`, `fffd48f93`).
1. **Cartes premium** — retrait des **side-stripe borders** colorées par mode (le tell AI n°1) sur
   `.section-card`/`.perf-hero`/`.ps` (override `border:...!important`) + élévation douce (ombre basse-opacité
   + lift au hover). L'identité du mode reste sur l'onglet actif, pas peinte sur chaque bord.
2. **Fond gris cool** — re-définition des tokens `--bg`/`--surface-2`/`--border` sur `body` (hue 250) pour
   sortir du blanc chaud limite-cream (anti-réf) → cartes blanches + ombre ressortent.
3. **Rythme d'espacement** généreux **desktop uniquement** (`@media min-width:768px`) — mobile reste dense
   (mandat PRODUCT.md « mobile-first dense »).

**Ne PAS re-faire (faux problèmes vérifiés)** : « unifier la palette de charts » est inutile — l'equity chart
ECharts est déjà cohérent (ligne = couleur du mode = identité ; gris homogène #94a3b8/#e2e8f0/#f1f5f9 ; rouge
pour le drawdown). Les hex « variés » sont les couleurs d'identité par mode (modes-config), pas des couleurs
de chart. ECharts rend en canvas → les `var(--)` CSS n'y marchent pas. Le badge cyan `#0891b2` et le violet
fortress `#6d28d9` sont des encadrés thématiques délibérés (Orbit=satellite/cyan, Fortress=bouclier/violet).
La direction premium n'a pas encore été appliquée aux autres surfaces (landing `index.html`, articles).

## Langue : bilingue FR/EN ASSUMÉ (décidé 2026-07-11)
- Contenu de fait bilingue : FR-majoritaire en Analyses/Séries/Tech, EN-majoritaire en Daily/Scanner.
- **ES et ZH = 0 fichier → RETIRÉS du sélecteur** (une option qui vide l'onglet est pire que son absence).
  AR ~10 fichiers = bonus optionnel, pas mis en avant. Sélecteur = **FR / EN / Tous** (+ AR bonus).
- Défaut = `navigator.language` (FR pour visiteur FR, EN sinon) au lieu de `currentLangFilter='all'` (qui
  entremêlait FR/EN au 1er chargement = le problème perçu). **Ne plus produire de variantes ES/ZH** tant que
  ce n'est pas une priorité business (option C multilingue écartée). i18n : le chrome (`data-i18n`) reste
  traduit ; le CONTENU des cartes reste dans sa langue.

## Tags : triple source de vérité à synchroniser
Taxonomie CLAUDE.md ↔ `assets/core.js#tagMeta` ↔ `index.html#tagMeta`. 16 tags officiels manquaient des 2
registres (gold/momentum/value/biotech/…) → chips en fallback (mauvaise couleur/label) + jamais filtrables.
**RÈGLE : tout tag de la taxonomie DOIT être dans les 2 registres avec la bonne `cat`**, sinon pas de filtre
sidebar. Voir [[systematic-north-star]].

## Onglet Scanner : sous-filtre Scans / Rétrospectives / Statut
101 scans + 20 rétros + 1 statut empilés = le « boxon » visuel → sous-filtre **Scans / Rétros / Statut** dans
l'onglet Scanner (garde tout au même endroit, navigable).

## Scan éditorial : ≤40 candidats bruts, ~10 publiés
Le scanner **éditorial** génère jusqu'à ~40 candidats bruts : top-10 par stratégie (momentum/breakout/pullback)
+ pool combiné. Le set **publié** = top-N curé (~10 setup cards). Les règles de sélection (cap secteur,
planchers région) décrivent le set PUBLIÉ, pas le pool brut. `validate-scan.js` appliquait par erreur des
règles « set publié » au pool brut → faux positifs. Corrigé 2026-07-03 (`data/scanner-filters.json` +
`tools/validate-scan.js`) :
- **scan_size** : `exact:10` → `max_total:40` + `max_per_strategy:10` (`exact` gardé en back-compat ;
  `scan_size` n'est lu que par validate-scan).
- **stops.min_pct** : comparaison à 2 décimales (2.998 % = « 3.00 % » pass ; les vrais stops <3 % restent
  flaggés).
- **max_per_sector** : passé en **advisory** (non bloquant), cohérent avec les planchers région. Voir
  [[immutable-trades]].

## Refonte design A→Z (skill `impeccable` — direction cible)
- **Registre = product unifié** (système unifié brand+product), retail sérieux, voix **FT/Economist +
  précision terminal**. Anti-réfs : crypto-bro néon, SaaS générique, Bloomberg overload, cream/sand AI.
- **Identité = BLEU AZUR du logo** `#50b4ee` (≈ `oklch(73.5% 0.125 237)`), PAS terracotta (1ère passe hue 28
  rejetée). Accent token `oklch(46% 0.13 237)` (assombri pour AA), rotation pure de hue (28→237) préservant
  L/C donc le contraste WCAG-AA déjà QA. Bénéfice : l'accent ne colle plus à la loss-red (hue 25) ; lane tag
  "theme" corrigée en violet (300). theme-color `#50b4ee`. NB : hue 237 (azur logo) ≠ hue ~264 (bleu SaaS
  #2563eb anti-réf).
- **A11y prioritaire** : mobile-first dense (explicite), RTL arabe, P&L colorblind-safe, WCAG AA,
  reduced-motion. Principes : clarté avant densité, confiance par précision, perf honnête.
- CSS unique `/assets/report.css`. Cibles : `index.html` (landing 6 tabs), `scanner/status` (dashboard),
  articles. Config live mode : `.impeccable/live/config.json`. Dashboard **groupé par classe d'actif**
  (Actions / Crypto / Métaux / Forex) — anticiper N modes par classe. `showClassLabels =
  populatedClasses.length>1` (mono-classe = pas de labels de classe). Voir `PRODUCT.md`, `DESIGN.md`.

## Note historique (volet A abandonné)
Les modes multi-actifs crypto/metals/forex proposés en juin 2026 (status `draft`, cachés du public via
`NON_PUBLIC_STATUSES={stopped,draft}` dans gen-status-page.js et filtre `draft` dans gen-api.js) sont
aujourd'hui **STOPPED** — jamais tunés au mandat ≥3×SPY/DD≤8%.
