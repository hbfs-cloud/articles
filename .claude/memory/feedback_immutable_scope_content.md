---
name: immutable-scope-content
description: Immutable = trade-chain (closed trades) ONLY — same-day published scans/articles ARE fixable if buggy
metadata:
  type: feedback
---

La règle Immutable Trades ([[immutable-trades]]) porte UNIQUEMENT sur les trades clôturés / la chaîne SHA `trade-chain.json` (et les agrégats scellés, cf [[frozen-append-only]]). Elle ne protège PAS un artefact de **contenu publié** (scan HTML, article, `signals.json` éditorial) : si c'est un bug détecté le jour même, on le corrige.

**Why:** j'ai refusé à tort de corriger le scan publié 20260702 en invoquant l'immutabilité. Correction du user (2026-07-03) : « y'a que les trades passés qu'on ne mute jamais ».

**How to apply:** Un scan/article publié le jour même avec un vrai bug → corriger. Ne bloquer que sur trades clôturés / stats scellées. Avant de muter `signals.json`, vérifier quand même le couplage sweep→trades (verify() de trade-integrity) pour ne pas désaligner des trades déjà scellés.
