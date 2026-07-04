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
- #5 RECLASSÉ (2026-07-03) : ce n'est PAS un simple "run sweep". `sweep.js` L2902-2913 préserve le
  frozen BYTE-FOR-BYTE (protection anti-réécriture voulue) → le lancer est un NO-OP pour le chiffre
  affiché (imprime [IMMUTABLE], n'ajoute qu'à la liste de trades). Fortress figé au 06-26 = conséquence
  de l'invariant SEALED-PRIMARY (ajouté pour l'incident pit-live 109→5%). TENSION : user veut UN seul
  chiffre réaliste/à-jour, mais recompute sweep=interdit (computeStatsFromTrades config-aveugle a déflaté
  dynamic 91→75 le 02/07) ET pit-primaire=rejoue l'incident. SEULE voie correcte = **extension
  append-only du frozen** : étendre la courbe scellée VERS L'AVANT avec les nouveaux trades clôturés
  (portfolio-aware, incrémental), sans toucher un point existant (préfixe scellé byte-identique → chaîne
  SHA reste valide). Changement moteur délicat = Fable spécifie / Opus implémente / vérif lourde (points
  existants inchangés, nouveaux points appended, return monte, DD ne baisse pas) / revue Fable + accord
  user. User a approuvé le principe (« re-seal les 3 ») mais l'exécution attend budget session + le vrai
  fix moteur. Projection: fortress +7 trades (JACK +16.53/NIQ +10.34/IRDM +3.36 réels), dynamic +1, balanced +2.
  **RÉSOLU par preview (2026-07-03, outil tools/extend-frozen.js DRY) : les 3 modes ABORTENT sur le garde-fou
  seam — le frozen NE PEUT PAS être recompute-étendu. dynamic recompute=177.25 vs scellé 191.18 (Δ-13.93 =
  reproduit EXACTEMENT le bug config-aveugle 91→75), balanced Δ-4.34, fortress Δ+0.14. Cause : carnet désynchronisé
  (73 clôturés vs 69 scellés / 43 vs 35 / 62 vs 60) + config changée (fortress P4→P10). Vérif indépendante 0
  blocker, zéro écriture, scellé intact. CONCLUSION : ne JAMAIS étendre le frozen par recompute. Le chiffre
  « courant » doit venir d'une couche FORWARD séparée (pit-engine) seedée à l'ancre scellée, PAS d'une réécriture.
  Outil extend-frozen.js gardé (untracked, --apply guardé) comme diagnostic. Décision direction en attente user.**
- #8 fortress : 73 clôturés ≤06-26 mais frozen.trades=69 → écart non expliqué (hypothèse : capacité portfolio-aware P4 historique). Investiguer AVANT re-seal.
- #6 pit-engine.js : jamais invoqué par cron/nightly (manuel). Décider : automatiser vs documenter comme manuel assumé.
- #7 deploy.yml GitHub Pages ~23% échec : (1) race backend GitHub (rien à corriger) ; (2) double artifact github-pages → envisager debounce (déployer sur dernier push d'une rafale). Ne JAMAIS gh run rerun (doublon) → nouveau commit.
- #11 code-review-graph MCP absent de l'env (consigne CLAUDE.md racine) → vérifier infra ou acter obsolète.

Règle transverse confirmée par l'audit : l'invariant SEALED-PRIMARY tient, aucune hallucination détectée, drafts sans track record publié. Le risque principal = écart « documenté comme fait » vs « réellement câblé dans le runner de prod » (cf #2).

## MAJ 2026-07-04 — diagnostic balanced/secured + archéologie
- **balanced** : stratégie user (P4, 9752c1866) INTACTE et gate-validée (+18.35% vs -13.95%, PF 2.09).
  La sous-perf mai-juin dans le scellé est PRÉ-fix (stops non-capés -8/-9% après désactivation du
  stale-tightening à v7-20260604). Rien à défaire.
- **secured/Orbit — root cause trouvée** : resserré H8→5 / trail ON→OFF / minScore 90→85 / filter
  all→breakout_only par la **recalibration régime v9.6 EARLY RISK-OFF** (commit war room 9cb428d6d,
  27/06) et **jamais desserré** au retour RISK-ON. Config live contredit le mandat Orbit documenté
  (H20/ATR3.5/trail ON, cf b1c6b98eb + project_orbit_mode.md). Résultat : 0 sortie trail/13, avg loss
  -6.15%, horizon coupe des gagnants pré-TP1 (GE -1.6pt vs balanced sur signal identique).
  **LEÇON : regime-recalibrate.js est un aller sans retour — pas de mécanisme de dé-recalibration au
  changement de régime.** À corriger structurellement.
- **NVS cv=NONE** : bloc d'injection positions réelles de sweep.js ne stampe jamais configVersion
  (oubli générique). Bonne valeur 26/06 = v9.4-20260616. Fix data+code en cours (workflow).
  Bug secondaire : FCX/GE/AVGO stampés v10.0 en look-ahead — à investiguer séparément.
- Gate 30j lancé sur 2 candidats secured (A staged H10/trail/atr1.8 ; B mandat Orbit complet) —
  chiffres pour arbitrage user, AUCUNE application sans son accord.

## MAJ 2026-07-04 (nuit) — chantier balanced/secured CLOS
- **NVS fixé** (608c65e2e) : code (injection stampe configVersion) + data (NVS=v9.4-20260616).
  balanced forward healthy → hero 50.76. secured healthy (ancre 07-02, 0 trade post-ancre).
- **secured : mandat Orbit RESTAURÉ** (d84581d15) : H20/ATR3.5/trail 2R/grace3/minScore 90.
  DÉROGATION EXPLICITE user au gate (WAIT artefact H20 : n=0 résolus sur 30j). Version v10.6-20260704.
  **Re-gate à la review 2026-08-01** — vérifier alors que les trades H20 résolus valident le mandat.
- **getConfigVersion fixé** : effectiveFrom 2026-06-29 ajouté à v10.0 (root-cause stamps look-ahead
  FCX/GE/AVGO). Trades clos NON re-stampés (immutabilité, décision user).
- Restes backlog : #6 pit-engine cron (pit-forward déjà câblé Step 4c — pit-engine legacy = rôle
  secondaire), #7 deploy debounce, #12 root-cause var95 (bar service, infra), Phase D backfill PIT
  (spec prête, LE gros déblocage), uk-selective (spec prête).
