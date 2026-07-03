---
name: scanner-cloud-reliability-backlog
description: Backlog fiabilisation /scanner + routines cloud (audit 2026-07-03). 11 items priorisés. Batch1 DONE (calendrier/forex/discovery), reste #4-#11.
metadata:
  type: project
---

Objectif user (loop 2026-07-03) : /scanner + toutes les routines cloud fonctionnent et génèrent un
scanner/status RÉALISTE (modes LLM fiabilisés + scriptés inspirés systematic-tss). Modèle de travail :
[[fable-plans-sonnet-implements]].

Audit read-only (workflow, 2026-07-03) → 11 findings priorisés. État :

**DONE (batch1, commit 1f4e810ac)** :
- #1 qa-check.js : lastWeekdayStr() via market-calendar.isUSTradingDay (week-end + fériés NYSE). Corrige 2 faux ❌ du 03/07 (Independence Day). Hard-gate débloqué.
- #2 publish-daily-card.sh:77 : fractal-scanner --universe forex REMPLACÉ par forex-scanner.js --output signals (remplit forex_pool que sweep lit). Corrige le gap doc/runner du commit forex dd38e6c15 (le skill/config disaient forex-scanner mais le RUNNER n'avait pas été touché — leçon : toujours vérifier le vrai runner, pas juste le skill).
- #3 notify-scanner-status.js + gen-mode-cards.js : listes hardcodées (7 modes) → lecture dynamique modes-config.json (11). Routage Telegram conservateur (mode sans topic → skip+log, draft non notifiés).

**DONE (batch2 en cours de revue)** : #4 alerte dégradation MCP (❌ si var95_5d absent+positions ouvertes ; ⚠️ visible si régime fallback), #9 waivers qa-content (.qa-content-waivers.json), #10 badge date turbo (equityCurve[-1].date).

**TODO (sensible / à venir)** :
- #5 re-seal fortress/dynamic/balanced : frozen fortress figé au 06-26, ≥7 trades clôturés réels (JACK +16.53%, NIQ +10.34%…) hors hero. RE-SEAL = APPEND-ONLY (jamais réécrire un point scellé, la chaîne SHA avorte sinon). SENSIBLE (incident début session « tu m'as réécrit l'historique ») → projeter l'impact (delta trades/return/DD) + VALIDATION USER avant tout write frozen. Lié à #8.
- #8 fortress : 73 clôturés ≤06-26 mais frozen.trades=69 → écart non expliqué (hypothèse : capacité portfolio-aware P4 historique). Investiguer AVANT re-seal.
- #6 pit-engine.js : jamais invoqué par cron/nightly (manuel). Décider : automatiser vs documenter comme manuel assumé.
- #7 deploy.yml GitHub Pages ~23% échec : (1) race backend GitHub (rien à corriger) ; (2) double artifact github-pages → envisager debounce (déployer sur dernier push d'une rafale). Ne JAMAIS gh run rerun (doublon) → nouveau commit.
- #11 code-review-graph MCP absent de l'env (consigne CLAUDE.md racine) → vérifier infra ou acter obsolète.

Règle transverse confirmée par l'audit : l'invariant SEALED-PRIMARY tient, aucune hallucination détectée, drafts sans track record publié. Le risque principal = écart « documenté comme fait » vs « réellement câblé dans le runner de prod » (cf #2).
