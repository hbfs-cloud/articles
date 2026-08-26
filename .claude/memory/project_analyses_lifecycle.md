---
name: analyses-lifecycle
description: Système de cycle de vie des analyses (livré 2026-08-26) — statuts mécaniques sur clôtures (déclenché/validé/invalidé/fenêtre écoulée), endpoint data/analyses-status.json, garde-fou JS dans core.js (« niveaux non vérifiés » après 5 j), tour du soir via chaîne C
type: project
---

# Cycle de vie des analyses (livré 2026-08-26)

**Problème** (user) : « la plupart des gens se font avoir en lisant des analyses périmées » —
il fallait un statut clair par dossier, une mise à jour du soir quasi gratuite (clôtures dans une
fenêtre), et un garde-fou côté page si l'update n'a pas tourné.

## Pièces
- **`tools/analyses-lifecycle.js`** : chaque soir, rejoue le plan publié (`tradeIdea` entry/stop/
  tp1/tp2/horizon de `data/analyses-data/*.json`) sur les CLÔTURES quotidiennes (Yahoo v8, proxy
  allorigins en repli, barre du jour admise seulement après 21h05 UTC — clôtures réglées).
  Transitions déterministes : déclenchement (1re clôture dans la zone), `stopped` (clôture au stop,
  stop testé AVANT tp le même soir), `tp1-hit`/`tp2-hit`, `completed` (TP1 puis fenêtre close),
  `expired` (horizon en séances écoulé — « jamais déclenché » distingué). Longs et shorts par
  symétrie. Ne touche JAMAIS un statut terminal éditorial. Fail-closed : cotation KO → aucun
  horodatage, le dossier apparaît « non vérifié » côté client. Horodate
  `meta.levelsVerifiedAt`/`levelsCloseDate`, historise `meta.statusHistory`, régénère
  **`data/analyses-status.json`** (endpoint unique, 257 dossiers).
- **Garde-fou JS** (fin de `assets/core.js`, pages `data-tab="analyses"`, zéro re-render des 250+
  pages) : bandeau sous la brand-bar — rouge (invalidé/stop), vert (TP/complété), ambre (fenêtre
  écoulée), note discrète « niveaux vérifiés à la clôture du X » si frais. **Garde-fou** : fetch KO,
  dossier absent du registre, ou vérification > 5 jours → bandeau « Niveaux non vérifiés —
  considérez ce dossier comme potentiellement périmé ». Le doute bénéficie toujours au lecteur.
- **Câblage soir** : chaîne C de `scan-parallel.sh` (après le sweep) + Step 4a2 de
  `publish-daily-card.sh` (commit inclut analyses-data + analyses-status.json). Non-bloquant.

## Backfill initial (26/08)
53 transitions au premier passage (le stock avril-août assaini) : STRL stoppé 24/08 (496,66 < stop
504), EQX TP2 le 24/08, INV/JD/JNJ TP2, 19 « fenêtre écoulée », etc. 4 cotations KO fail-closed
(EURUSD/XAUUSD : slugs forex non-Yahoo — restent « non vérifiés », à mapper vers EURUSD=X si on veut
les suivre).

## Conventions
- Clôtures UNIQUEMENT (pas d'intraday) ; fenêtre = horizon en séances (max des nombres du champ
  `horizon`, défaut 20, borné 5-60 — un horizon exprimé en date type « jusqu'au 2 novembre » tombe
  sur la borne 60).
- Vocabulaire affiché : Dossier d'actualité / En attente de déclenchement / Thèse validée (TP1-TP2) /
  Clôturé (TP1 atteint) / Invalidé (stop touché) / Fenêtre écoulée / Dossier informatif.
- Suites possibles (non faites) : badge statut sur les cartes de la landing ; mapper les slugs
  forex ; série trimestrielle « Ce qui a survécu » qui exploite `statusHistory`.
