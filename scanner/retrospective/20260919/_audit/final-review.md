# Revue finale indépendante — rétro scanner 14–18 septembre 2026

Date de revue : 2026-09-19. Portée strictement documentaire et locale : aucune
modification des artefacts de rétro, aucune conclusion de performance et aucune
autorisation de publication.

## Snapshot contrôlé

SHA-256 composite du snapshot (concaténation des six lignes `shasum -a 256`, dans
l’ordre ci-dessous) :
`0e684ee5ff8fcdf4a3fc41030abd483eab036c7c7ef35ae6102038f84616fa34`.

| Artefact | SHA-256 |
|---|---|
| `index.html` | `fd78f101f4fb3cc81ea821cf3619791c92edae5e903846c1f71941357f4b0f37` |
| `cohort-manifest.json` | `65a81943a8a90e81ca2ca320d73c4b2e376665c4b96e61a394c19fa857d00d0b` |
| `retro-results.json` | `ccaed268927afbc19a74e8877dd8539fecc02ffae3ea9b98af6c0f4bd8759019` |
| `diagnostics.json` | `0cb89a2f6edfd0f91d02ad65f0bb143456d7e7d2eba32cd388367f0d8a7d1b65` |
| `collections-v2/week/harness.json` | `0650e931b8305112c0434e13093579d155330cd3866242cac7590c6727f34816` |
| `crosscheck-5m/harness.json` | `851d7eebc6e04c0a82a39bae1a2c7487771380350bc5f69b07ef216bc3b3effc` |

Les huit archives liées par le manifeste (`signals.json` et `index.html` des 14,
15, 16 et 17 septembre) correspondent toutes à leurs SHA-256 déclarés. Le
18 septembre est correctement déclaré absent des archives : il ne devient pas
un cinquième scan.

## Verdict

**PASS comme bilan documentaire provisoire local.** Aucun blocker ne subsiste
pour ce périmètre, car la page et les JSON refusent explicitement de produire un
résultat de performance, une exécution certifiée ou une publication.

Les blockers suivants restent réels pour une éventuelle certification de
performance ultérieure : les 35 horizons à dix séances sont non mûrs ; le moteur
ne rejoue pas le contrat d’exécution publié ; et la chronologie de disponibilité
publique des archives n’est pas prouvée par le seul historique Git. Ces limites
sont bien énoncées, elles ne sont pas contournées.

## Senior QA

- Réconciliation : 4 scans (14–17/09), 35 propositions et 28 titres uniques.
  Les journées font 8 + 9 + 10 + 8 = 35 ; les sous-totaux 27 actions + 8 ETF,
  25 RECOVERY + 10 RISK-ON et 12 Breakout + 9 Pullback + 14 Momentum concordent.
- Maturité : `mature_filled=0`, `resolved=0`, `non_mature=35`. Hit rate, R
  moyen/médian, profit factor, drawdown et dépendance aux gagnants sont `null`.
  Le zéro technique de rendement moyen est correctement exclu du texte.
- Le calcul de référence est exact : `(close 18/09 ÷ open 14/09 − 1)` donne SPY
  +0,3346508564 %, QQQ +2,5763155276 % et IWM −1,2035201224 %. Le texte le borne
  explicitement à une fenêtre lundi-ouverture/vendredi-clôture, hors coûts et
  dividendes, et dit qu’il ne mesure ni alpha ni portefeuille investi.
- Les deux harnais passent le contrôle de fraîcheur ; `validate-workflows --workflow retro`
  passe. Le contrôle éditorial strict ne trouve aucun tic IA.

## Contrarian

- Les 24 « fills » sont exclusivement un diagnostic de niveaux : 15 utilisent
  `fill_policy=chase`, alors que les archives demandent un LIMIT de séance sans
  poursuite. Le texte ne les présente pas comme des fills, et interdit toute
  lecture de performance ou de sélection gagnante. C’est le point méthodologique
  déterminant et il est traité correctement.
- Le corpus de risques courant ne gouverne aucun résultat. QCOM reste dans la
  cohorte du 15/09 malgré l’incohérence documentée exclusion 14 → sélection 15
  → exclusions 16/17 : aucune suppression a posteriori, ni causalité inventée.
- Les quatre conflits daily/intraday du 18/09 sont conservés. Le supplément 5m
  indépendant contient, pour EMR, JNJ, REXR et XOP, 78 bougies RTH continues
  (13:30–19:55Z, zéro trou et zéro doublon). Il retrouve respectivement les
  extrêmes 149,99/147,12 ; 272,11/267,1975 ; 38,80/38,10 ; 193,16/190,55.
  Aucun cours daily n’a été remplacé. Cela confirme le conflit de sources, pas
  la justesse d’une des deux séries.

## Retail war room

- Un lecteur qui respecte le LIMIT ne peut pas être assimilé aux 15 scénarios
  achetés jusqu’à 2 % au-dessus du niveau. Les 11 absences d’entrée sur la
  première bougie ne prouvent pas non plus une absence de fill sur toute la
  séance.
- File d’attente, volumes réellement servis, spreads, gaps et activation
  intraday publiée ne sont pas observés. Les sorties 50 % au TP1 et le runner à
  break-even restent des conventions de modèle. La page l’explique sans les
  transformer en transactions.

## Suggestions non bloquantes

1. À maturité, rejouer chaque publication avec une règle LIMIT/no-chase et des
   preuves horodatées d’activation ; conserver séparément toute simulation de
   niveaux.
2. Définir avant ce rerun une convention unique pour le décompte des dix séances
   et pour la résolution daily/15m/5m des extrêmes incompatibles ; ne corriger
   aucune série historique silencieusement.
3. Ajouter une preuve de mise en ligne horodatée si l’objectif devient de
   certifier ce qu’un lecteur pouvait réellement voir au moment du scan.
