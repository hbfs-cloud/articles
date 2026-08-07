---
name: fortress-risk-layer-dropped
description: fortress tourne en live SANS couche de risque (atrStopMult=0, maxStopPct=0, ddBreakerPct=0) — supprimée en douce par 465b1fa5e (29/06) dont le message n'annonçait qu'un rollback de 2 paramètres de sélection. balanced réparé le 22/07, fortress jamais.
metadata:
  type: feedback
---

**Cause #4 du trou de performance juillet 2026.** Trouvée par les angles `process` et `git`.

`data/modes-config.json` aujourd'hui — fortress, statut **`live`** :
`{atrStopMult:0, maxStopPct:0, ddBreakerPct:0, circuitBreakerStops:3, breakevenPct:1, beGraceDays:0,
topN:10, portfolioSize:10}`. Soit : **aucun plafond de perte, aucun coupe-circuit de drawdown**, et un
verrou breakeven armé dès la barre d'entrée (cf. [[breakeven-arms-on-entry-bar]]).

**La suppression est passée en douce.** `git show 465b1fa5e -- data/modes-config.json` (29/06) : le
diff supprime
- balanced : `maxStopPct 7→0`, `ddBreakerPct 5→0`, `circuitBreakerStops/Window/Pause 4/5/3 → absents` ;
- fortress : `ddBreakerPct 3,5→0`, `circuitBreakerStops/Window/Pause 3/5/5 → absents`,
  `breakevenPct 0→1`.

Or le **message du commit ne mentionne QUE** « rollback balanced/fortress » de `filterName`/`horizon`
+ la chaîne SHA-256. Rien sur la couche de risque.

**Aveu daté** dans `d2f6f46f9` (22/07) : « balanced: +circuitBreakerStops 3/5/3 (n'avait AUCUN CB →
-53% juin non protégé) ». **balanced a été réparé, fortress a été oublié.**

**Conséquence mesurable :** fortress = **-32,1 pts sur 53 sorties depuis juin**, et c'est le mode qui
porte le **plus de sorties `breakeven` négatives (16)**. Le chiffre est modeste ; le risque, lui,
**n'est pas borné** — c'est le seul mode live à 10 positions sans plafond de perte ni coupe-circuit.

**Why:** Un message de commit qui sous-décrit son diff transforme une suppression de garde-fou en
changement invisible. La revue s'est faite sur le message, pas sur le diff, et l'oubli a survécu
6 semaines. Le mandat fortress est « participer au upside AVEC parachute » — sans plafond ni CB, le
parachute n'existe pas.

**How to apply:**
- **Invariant de config :** tout mode en `live` doit avoir `maxStopPct > 0` **et**
  (`ddBreakerPct > 0` ou `circuitBreakerStops > 0` avec sa fenêtre). Un `0` sur ces champs = valeur
  sentinelle « désactivé », jamais « par défaut ». À tester dans `qa-check`.
- Tout commit touchant `data/modes-config.json` doit **énumérer chaque champ de risque modifié** dans
  son message. Un diff de risque non mentionné = commit à refuser.
- Quand un correctif est appliqué à un mode, **vérifier ses jumeaux** : ici balanced et fortress
  avaient été cassés par le même commit ; seul le premier a été réparé.
  Lié à [[modes-config-baseline]] (mandat fortress) et [[config-change-backtest]].
