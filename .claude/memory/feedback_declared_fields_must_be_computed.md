---
name: declared-fields-must-be-computed
description: Un champ machine recopié à la main n'est pas une mesure — tp1_atr_multiple était faux sur 5 lignes sur 7 et le gate qui le lisait était mort-né parce que le parser strippait le champ
metadata:
  type: feedback
---

Scan `scanner/20260810`, revue de panel du 2026-08-11. Trois défauts de la même famille, dans
le même dossier.

## 1. Le champ que lit le gate était écrit à la main

`tp1_atr_multiple` alimente le gate G5 `tp1_reachability`. Il était RECOPIÉ par le rédacteur au
lieu d'être calculé. Résultat, 5 lignes sur 7 fausses :

| ticker | déclaré | réel `(tp1 − entry)/atr` |
|---|---|---|
| BNY | 1,50 | 1,61 |
| TTE.PA | 1,50 | **1,24** |
| SOLV | 1,50 | 1,72 |
| SHELL.AS | 1,50 | 1,70 |
| FTNT | 1,37 | 1,62 |

La prose de la MÊME fiche portait la bonne valeur (« à 1,24 fois l'amplitude ») : le texte disait
vrai, le champ machine disait 1,5. Un gate qui valide 1,5 sur une valeur réelle de 1,24 ne valide
rien.

## 2. Le gate de cohérence aurait été mort-né

En ajoutant `tp1_atr_multiple_coherence` à `validate-scan.js`, il passait sur un scan volontairement
corrompu. Cause : `tools/lib/scanner-parser.js` ne conserve que les champs d'une **liste blanche**,
et `tp1_atr_multiple` n'y était pas. Le champ n'atteignait jamais le gate. Même classe de bug que
`sector` et `universe`, tous deux corrigés pour la même raison et commentés dans ce fichier.

## 3. Un niveau absent vaut 0, et 0 est un nombre

`render-scanner.js` écrit `data-tp2="0"` quand la deuxième cible n'existe pas. `live-tracker.js`
testait `!isNaN(tp2)` : `parseFloat("0")` vaut 0, qui n'est pas NaN, donc `livePrice >= 0` →
**toute ligne sans TP2 affichait « TP2 Hit » dès la première cotation**.

**Why:** un champ dérivé recopié est une ASSERTION, pas une mesure — et une assertion se dégrade
silencieusement dès que le niveau bouge. Un contrôle qui lit cette assertion est tautologique. Et
un contrôle qui ne voit jamais son champ, parce qu'une couche intermédiaire l'a strippé, passe en
vert sans avoir rien mesuré : c'est pire qu'absent, ça rassure.

**How to apply:**
1. Tout champ dérivable (`tp1_atr_multiple`, `rr`, multiples de stop, largeurs de zone) est ÉCRIT
   par le calcul au moment de produire l'artefact, jamais saisi. Le producteur ne recopie rien.
2. Le contrôle recalcule et refuse un écart > 0,01. Ne jamais parser le champ texte pour le
   comparer à lui-même.
3. **Après avoir ajouté un gate, le tester DANS LES DEUX SENS** : corrompre volontairement la
   valeur et vérifier que la validation échoue. Un gate ajouté sans test négatif n'est pas un gate.
4. À chaque nouveau champ lu par un gate, vérifier la liste blanche de `scanner-parser.js`. Le
   pipeline a une couche de projection : ce qui n'y figure pas n'existe pas en aval.
5. Distinguer « absent » de « zéro » partout où un niveau est optionnel : tester `> 0`, pas
   `!isNaN`.

Voir [[rr-gate-forces-unreachable-targets]] pour le gate lui-même, et
[[dilution-check-fail-closed-eu-issuers]] pour l'autre défaut du même scan.
