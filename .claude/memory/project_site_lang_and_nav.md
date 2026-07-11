---
name: site-lang-and-nav
description: Décision produit 2026-07-11 — site bilingue FR/EN ASSUMÉ (pas ES/ZH), défaut navigator.language, ES/ZH retirés du sélecteur. Onglet Scanner = sous-filtre Scans/Rétros/Statut.
metadata:
  type: project
---

# Structure site : langue bilingue FR/EN + navigation (décidé 2026-07-11)

Suite à un audit (le « boxon » catégories + « problème de langue ») :

**LANGUE — bilingue FR/EN ASSUMÉ.**
- Le contenu est de fait bilingue : FR-majoritaire en Analyses/Séries/Tech, EN-majoritaire en Daily/Scanner.
- ES et ZH = **0 fichier** sur tout le site → à RETIRER du sélecteur de langue (une option qui vide l'onglet
  est pire que son absence). AR ~10 fichiers = bonus, pas mis en avant.
- Sélecteur = **FR / EN / Tous** (+ AR bonus optionnel). Défaut = `navigator.language` (FR pour visiteur FR,
  EN sinon) au lieu de `currentLangFilter='all'` (qui entremêlait FR/EN au 1er chargement = LE problème perçu).
- ⚠️ Ne plus produire de variantes ES/ZH tant que ce n'est pas une priorité business (option C multilingue écartée).
- i18n : le chrome (data-i18n) reste traduit ; le CONTENU des cartes reste dans sa langue (FR ou EN).

**CATÉGORIES / TAGS.**
- Triple source de vérité des tags à garder synchronisée : taxonomie CLAUDE.md ↔ `assets/core.js#tagMeta`
  ↔ `index.html#tagMeta`. 16 tags officiels manquaient des 2 registres (gold/momentum/value/biotech/…) →
  chips en fallback (mauvaise couleur/label) + jamais filtrables. RÈGLE : tout tag de la taxonomie DOIT
  être dans les 2 registres avec la bonne `cat`, sinon pas de filtre sidebar. Voir [[systematic-north-star]].

**ONGLET SCANNER.**
- 101 scans + 20 rétros + 1 statut empilés = le « boxon » visuel → ajouter un **sous-filtre
  Scans / Rétrospectives / Statut** dans l'onglet Scanner (garde tout au même endroit, navigable).
