---
name: gates-certify-green-on-nothing
description: Trois gates du dépôt validaient en vert des artefacts inexistants ou une autre cible que celle demandée — un contrôle qui échoue en silence vaut moins que pas de contrôle
metadata:
  type: feedback
---

Constaté le 2026-08-08, panel de 7 validateurs sur le scan bloqué du 20260810 (connecteur
marketdata en 404, aucune donnée collectée). Les trois défauts survivent entièrement à la panne.

## 1. `check-freshness.js` certifiait vert un scan sans aucune donnée

`node tools/check-freshness.js scanner/20260810/harness.json` → « 4 sources vérifiées,
0 bloquante(s) », **exit 0**, alors que les 9 fichiers de rôle sous `_wf/` portaient tous un
statut bloquant et qu'aucun ticker n'avait été collecté.

Le gate comparait des horodatages, ce qu'il annonce. Mais **un manifeste décrit une INTENTION de
collecte, il ne prouve pas qu'elle a abouti**. Pire : les statuts bloquants existaient bien, et
`grep -rln "_wf" tools/` renvoyait **zéro** — les agents consignaient correctement leur échec
dans le vide.

Corrigé : le gate lit désormais `<content>/_wf/*.json` et échoue sur tout statut bloquant. Un
fichier de rôle SANS champ `blocking` explicite est traité comme bloquant — l'absence de
déclaration ne vaut pas feu vert (`calendrier.json`, le fichier du gate G4 lui-même, était le
seul des 9 à ne pas porter ce champ). Option `--require-artifacts` pour la publication.
Vérifié : 5 harnais sains inchangés au bit près, seul le scan cassé bascule de 0 à 9 bloquantes.

## 2. `qa-check.js` avalait son argument de chemin

`node tools/qa-check.js scanner/20260810` auditait en réalité le scan du dernier jour ouvré
(20260807) et sortait 0. L'outil ne lisait `process.argv` que pour `--strict` et `--discord` ;
tout argument positionnel était ignoré **en silence**. Le scan visé n'a donc reçu aucune
couverture QA tout en affichant un exit 0.

Corrigé : refus explicite avec exit 2 et renvoi vers `validate-scan.js` pour cibler un scan.

## 3. L'univers de corrélation ≠ le panier publié

Scan **publié** du 20260807 : `engine_meta.risk_gating.correlation_universe` valait le crible
INITIAL (`ROST,JCI,NSC,V,PNC,EWS,VFLO,IOO`) alors que le panier publié était JCI, ROST, ITX.MC,
KBC.BR, LMT, CPER, EWS, NSC. **50% du panier n'a jamais été mesuré** ; les
`max_pair_correlation` et `avg_off_diagonal_correlation` affichés décrivaient un panier qui n'a
pas existé, et les deux règles de dé-concentration ne pouvaient pas mordre dessus.

Cause structurelle : `PortfolioRisk` est US-only, les lignes EU/APAC cassent le calcul. Ce n'est
pas une raison de publier une métrique partielle sans le dire. Contrôle ajouté à `validate-scan.js`.

## Et une leçon sur moi-même

La première version de ce troisième contrôle lisait une variable **hors portée** et son
`catch (_) {}` muet avalait la `ReferenceError` : le contrôle ne s'exécutait jamais et ne le
disait pas. J'ai écrit un échec silencieux en corrigeant des échecs silencieux. Le `catch`
pousse désormais une advisory « contrôle NON EXÉCUTÉ ».

**Why:** un gate qui sort 0 est lu comme « vérifié ». Quand il sort 0 parce qu'il n'a rien pu
vérifier — ou parce qu'il a vérifié autre chose — il ne protège pas, il **certifie**. C'est
strictement pire que son absence : sans gate, on doute ; avec un gate vert, on publie.

**How to apply:**
1. Tout gate doit distinguer trois états, jamais deux : PASSE / ÉCHOUE / **N'A PAS PU VÉRIFIER**.
   Le troisième doit être aussi bloquant que le second en publication.
2. Un `catch` dans un contrôle ne doit JAMAIS être muet. Au minimum, signaler « contrôle non
   exécuté » — sinon le contrôle disparaît sans laisser de trace.
3. Un outil qui ignore un argument doit le REFUSER. Ignorer, c'est répondre à côté avec
   assurance.
4. Une métadonnée d'échec (statut bloquant, fichier de rôle) n'a de valeur que si un consommateur
   la lit. Vérifier par `grep -rln` qu'au moins un outil la consulte, sinon c'est de la
   documentation.
5. Piège de liste vide : `anti-dilution.drop[]` et `calendrier.excluded_tickers[]` vides font
   répondre « faux » à tout test d'appartenance, dilueur sériel compris. Tester
   `status != OK` **avant** de lire ces tableaux.
