---
name: feedback-segment-replay-absolute-dd
description: "Le DD/return ABSOLU d'un replay de config sur un segment n'est pas fiable — n'utiliser que les deltas relatifs A/B; valider l'absolu via le frozen réel + resweep"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

Le **niveau ABSOLU** de drawdown/return produit par `optimize-vs-spy.js` (ou tout replay d'une config sur un segment de scans) **n'est PAS fiable** et peut diverger fortement du track record réel (`frozen_*` dans backtest-results.json).

**Preuve (2026-06-14)** : j'ai affirmé que dynamic avait un DD de -16 à -18% → FAUX. Le frozen réel est -4.59%. Le -18% venait du replay de la config COURANTE de dynamic (partialTPGain=10 + disableTP2 + few trades) sur le segment : ça produit **1 seul trade clôturé** + un creux de **-18% en mark-to-market non réalisé** sur une position ouverte que le mode n'a jamais réellement tenue ainsi (la config a évolué — configVersion-blended). Artefact pur.

**Pourquoi** : (1) le replay applique une config uniformément sur des scans qu'elle n'a jamais réellement tradés (cf [[feedback-regime-aware-eval]]) ; (2) le DD inclut le MtM non réalisé de positions ouvertes — un seul nom high-beta en pS=1 down 18% = -18% de DD papier même si le trade récupère ; (3) exit logic complexe (partialTPGain/disableTP2) + peu de trades amplifie l'écart.

**Règles** :
- N'utiliser le replay-segment que pour des **comparaisons relatives A/B** (config courante vs proposée, MÊME modélisation des params) — le *delta* est informatif, pas le niveau absolu.
- Toujours passer la config COMPLÈTE dans les deux bras (sinon le delta lui-même est faussé : minimal-params donnait -5.5%, full-params -18% pour la même config dynamic).
- Pour un chiffre de DD/return absolu fiable : utiliser `frozen_*` (réel) et **valider tout changement via le resweep append-only** (qui reflète le comportement go-forward réel ; les trades clôturés gardent leur configVersion).
- Bug corrigé au passage dans optimize-vs-spy : `--eval-config` annulait les `regimeFilters` (confond) — préserver la config live sauf override explicite.
