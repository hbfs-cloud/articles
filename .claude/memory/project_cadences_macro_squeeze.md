---
name: project_cadences_macro_squeeze
description: Décision du 2026-08-11 — cadences macro=36 h et squeeze=168 h dans publication-gate.js, calées sur l'espacement mesuré de leur déclencheur
metadata:
  type: project
---

**Décision du 2026-08-11 : `macro: 36` et `squeeze: 168` entrent dans `CADENCE_H`**
(`tools/publication-gate.js`). Les deux types en étaient absents. Un type absent de la table
sort à `0`, et `0` fait dire oui au gate à chaque appel : ce n'était pas une autorisation
tacite, c'était une barrière manquante. Seul le déclencheur événementiel de `desk-plan.js`
les retenait, et un déclencheur qui reste vrai plusieurs jours d'affilée republie la même
chose plusieurs jours d'affilée.

Les deux valeurs sont **mesurées**, pas estimées. Ne pas les changer sans refaire la mesure.

## `macro: 36` — J-1 d'un événement de tier 1

Source : `QueryData(types=economic_events, days=180)` le 2026-08-11 → 219 événements du
2026-02-13 au 2027-02-05. Le filtre `TIER1` de `desk-plan.js` en retient **44, sur 42 jours
distincts**.

| Mesure | Valeur |
|---|---|
| Écart entre jours déclencheurs | min **1 j**, médiane **5 j**, moyenne **8,3 j** |
| Paires à 1 j | **5** — FOMC→PCE (29/07, 28/10), FOMC→CPI (09/12), PCE→chômage EU→NFP (30/09→02/10) |
| Paires à 2 j | 3 · à 3 j | 2 · à 4 j | 8 |

Les paires à 1 j sont **une seule fenêtre de positionnement**, pas deux notes. La cadence
doit donc bloquer 24 h et laisser passer 48 h. Simulation sur les 42 jours réels, avec la
règle exacte du gate (`hoursSince(last) < cadence` ⇒ refus) :

| Cadence | Notes conservées | Ce qui saute |
|---|---|---|
| 24 h | 42/42 | rien — la barrière ne sert à rien |
| **36 h** | **38/42** | exactement les 4 suites de bloc |
| 48 h | 38/42 à heure FIXE, **36/42** si le run dérive de 23h30 à 21h00 | 2 notes légitimes en plus |
| 72 h | 34/42 | 4 NFP légitimes avalés |

36 h l'emporte sur 48 h parce que **le gate compare des horodatages, pas des dates** : deux
jours déclencheurs espacés de 2 j ne sont espacés que de 45,5 h si le `/desk` glisse de
23h30 à 21h00. 36 h garde 12 h de marge des deux côtés (bloque 24 h, laisse passer 48 h).

## `squeeze: 168` — fenêtre de publication FINRA

Source : `node tools/desk-plan.js --only squeeze --now <D>T23:30:00Z --json` sur les
**365 jours de 2026** (le vrai `finraWindow`, jamais une copie).

| Mesure | Valeur |
|---|---|
| Fenêtres | **24** |
| Jours déclencheurs | **119** — donc jusqu'à **7 publications d'affilée du MÊME jeu FINRA** |
| Largeur de fenêtre | 3 à 7 j calendaires (**144 h** entre premier et dernier jour de la plus large) |
| Écart début→début | min 13 j, max 19 j |
| Écart **fin → début suivant** | **min 9 j = 216 h** |

La cadence doit tenir dans `]144 h ; 216 h[` : au-dessous, une fenêtre sort deux fois
(mesuré : 144 h ⇒ 25 publications, une fenêtre à 2) ; au-dessus, un scan produit tardivement
dans sa fenêtre bloquerait la publication FINRA **suivante**, qui est une donnée neuve.
**168 h** tient au milieu et rend **exactement 1 publication par fenêtre sur les 24**, aucune
fenêtre perdue.

## Vérifications faites le jour de la décision

- `node --check` sur `publication-gate.js` et `desk-plan.js`.
- Registre factice en bac à sable (jamais le vrai `publication-ledger.ndjson`, append-only) :
  macro à −24 h ⇒ `publish_web=false` ; squeeze à −144 h ⇒ `publish_web=false` ;
  macro à −48 h et squeeze à −216 h ⇒ `publish_web=true`.
- `node tools/desk-plan.js` ⇒ `config_gaps: []`, la section « TROUS DE CONFIG » ne s'affiche
  plus.
