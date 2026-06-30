---
name: feedback-regime-aware-eval
description: Never evaluate scanner mode config changes by uniform full-period replay — the system is regime-aware + weekly-adaptive
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

Ne JAMAIS évaluer un changement de config de mode scanner en simulant la config courante **uniformément sur toute la période historique**. C'est un contrefactuel invalide.

**Pourquoi :** Les configs de modes sont (1) **regime-aware** — `regimeFilters` dans modes-config.json switche le strategy filter selon le régime (ex: balanced = mom_bo en risk_on, breakout_only en risk_off) ; et (2) **adaptatives** — chaque trade frozen porte un `configVersion` correspondant à la config active à sa date ; les params sont recalibrés chaque semaine via les rétrospectives + resweep (regime-recalibrate.js, append-only dans modes-config-history.json). Le `frozen_return` (ex: balanced +54%) est le vrai track record de ce système évolutif, PAS un mélange à « démêler ».

Exemple d'erreur commise (2026-06-14) : avoir conclu « balanced v8.5 = -4.57% sur full history donc config cassée ». Faux — le v8.5 n'a jamais tourné en février-avril (c'était `momentum_only` pendant le rally momentum). Simuler v8.5 sur cette période n'a aucun sens.

**Comment faire à la place :**
- Analyser **par régime** : pour chaque régime, quel strategy filter a le meilleur WR/PF/return sur les trades pris DANS ce régime. Ça informe directement `regimeFilters` sans fallacy uniforme.
- Walk-forward (in-sample calibrate / out-of-sample validate), comme le fait déjà sweep.js (walk_forward split) et rolling-walk-forward.js.
- Changements **chirurgicaux et regime-spécifiques** (ex: changer seulement `regimeFilters.early_risk_off`), puis laisser la boucle retro/resweep continuer à adapter — ne pas remplacer une config en bloc sur base d'un replay uniforme.
- Les comparaisons same-day same-ticker entre modes (ex: NVDA -9.4% balanced naked-stop vs -4.0% fortress capped, même jour) restent valides — c'est une comparaison contrôlée, pas un contrefactuel.

Lié à [[feedback-sweep-psize-history]] (portfolioSize varie dans le temps, ne jamais batch-reset sans accord).
