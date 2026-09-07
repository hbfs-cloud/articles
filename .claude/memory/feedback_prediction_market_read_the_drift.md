---
name: prediction-market-read-the-drift-not-the-level
description: "Une cote de marché de prédiction ne se publie jamais sans sa dérive (price_change_7d / price_change_24h) : lire le niveau seul a inversé la thèse centrale du daily du 07/09/2026. Corollaires : yes_price est un point milieu, volume est cumulé depuis la création, les queues à spread large ne se chiffrent pas."
metadata:
  type: feedback
---

Incident `/daily 20260907`. Thèse centrale publiée en première version : « hausse de taux à 48,5 % pour la
réunion du 16 septembre, un risque que les actions ignorent ». **Contresens complet.**

`off_hours.json /facets/predictions/observations/*/metadata` porte `price_change_7d` et
`price_change_24h` **dans le même objet que le prix** :

| Contrat | cote | 24 h | 7 j |
|---|---|---|---|
| Statu quo | 0,505 | +0,01 | **+0,03** |
| Hausse 25 bp | 0,485 | −0,01 | **−0,04** |

Une semaine plus tôt la hausse était **favorite** (~52,5 contre 47,5) et les deux venaient de se croiser.
Le marché s'**éloignait** de la hausse depuis sept jours ; j'ai publié qu'il s'en rapprochait. Le panel
Contrarian l'a attrapé, pas les gates.

## Trois corollaires vérifiés le même jour

1. **`yes_price` est un point milieu construit** — `yes + no = 1,0000` exactement sur tous les contrats.
   Les carnets réels sont bid/ask `0,50 / 0,51` et `0,48 / 0,49` : 50,5 contre 48,5 est *indistinguable*.
   « Pile ou face » est la seule lecture honnête, et personne ne peut acheter le statu quo à 50,5 %.
2. **`volume` est cumulé depuis la création** (23,5 M$) ; la liquidité du jour est `volume_24h`
   (296 091 $), soit 79× moins. Publier le cumulé pour prouver qu'« un marché est liquide » est trompeur.
3. **Les queues ont des `spread_bps` de 1 818 à 6 667** (baisses, hausse 50 bp+). Une décimale sur une
   probabilité dont la fourchette vaut 100 % du milieu n'est pas une mesure : regrouper en « plus cotées
   de façon exploitable », sans chiffre.

## Piège de fenêtre

La fenêtre de sept jours **contenait le rapport sur l'emploi** (NFP du 04/09). Une dérive mesurée sur une
fenêtre qui contient un événement macro majeur n'est pas attribuable à un autre récit sans preuve — il faut
le dire dans le texte.

## Aussi : le facet peut se déclarer incomplet

`regime.json /facets/prediction_markets` portait `status: "partial"`, `scan_truncated: true` et
`warnings: ["market scan reached the 500-market safety limit"]`. À divulguer au lecteur ; `matched_markets`
n'est pas autoritaire quand le balayage est tronqué.

**Why** : un niveau de probabilité est une photo ; la décision du lecteur dépend du sens du mouvement.
Publier le niveau sans la dérive permet de raconter exactement l'inverse de ce que fait le marché, avec des
chiffres tous exacts et tous liés à leur pointeur — `validate-content-claims` ne peut rien y voir.

**How to apply** : avant de publier une cote de prédiction, (1) publier le sens du mouvement dans la même
phrase que le niveau ; (2) publier bid/ask et dire que le niveau est un point milieu ; (3) `volume_24h`
pour la liquidité courante, jamais `volume` ; (4) ne pas chiffrer une queue dont `spread_bps` dépasse
~500 ; (5) vérifier si la fenêtre de dérive contient un événement macro et le signaler ; (6) relayer
`status`/`scan_truncated`.

Voir [[measure-recovery-from-pre-event-baseline]], [[certification-is-not-truth]],
[[macro-values-verify-not-just-dates]].
