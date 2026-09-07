---
name: measure-recovery-from-pre-event-baseline
description: "Une reprise, un effacement ou un repli se mesure depuis le cours d'AVANT l'événement, jamais depuis la clôture d'après-chute. Incident or/argent du daily 07/09/2026 : l'or encore à −3,75 % présenté comme revenu à l'équilibre, avec 128/128 claims valides."
metadata:
  type: feedback
---

Incident `/daily 20260907`, **introduit en corrigeant un autre défaut** (donc à surveiller aussi dans les
passes de correction, pas seulement en première rédaction).

J'ai écrit que l'or avait « effacé sa chute » du 28 août — dans le hero **et** dans un titre de section.

Barres réelles (`bars_indices`, GLD) :

| Date | Clôture | |
|---|---|---|
| 27/08 | **422,60** | ← cours d'avant la chute |
| 28/08 | 408,89 | la chute, −3,24 % |
| 01/09 | **396,75** | **plus bas ENCORE** |
| 03/09 | 410,22 | rebond |
| 04/09 | 406,77 | **−3,75 % vs 27/08** |

J'avais mesuré la « reprise » depuis **408,89**, la clôture d'*après* la chute → +0,33 % et l'illusion d'un
aller-retour complet. Depuis 422,60, l'or finit à −3,75 % et n'est **jamais** revenu à moins de 2,9 % de son
point de départ. Idem argent : **−4,70 %** depuis 62,77. Rien n'avait été effacé.

**Aggravant** : la fenêtre glissante « 5 séances » démarrait elle aussi sur la clôture d'après-chute
(index 9), donc le −0,52 % publié mesurait *depuis le bas du trou* et faisait passer le métal pour inchangé.

## Pourquoi aucun gate ne l'a vu

C'est le piège du **dénominateur choisi** — celui que `validate-content-claims` garde dans les *formules*
(`ratio_pct` exige même série, même colonne, dénominateur d'index antérieur) mais **pas dans la prose**.
Chaque chiffre était exact et lié à son pointeur ; le gate a passé 128/128. Seule une relecture de type
humain l'a attrapé.

**Why** : sur un actif qui a chuté puis rebondi partiellement, le choix du point de départ décide de la
conclusion. Prendre la clôture d'après-chute transforme une baisse toujours en cours en retour à
l'équilibre, sans qu'aucun chiffre soit faux individuellement.

**How to apply** : pour toute affirmation de reprise / effacement / rattrapage / repli — (1) le dénominateur
est la dernière clôture **avant** l'événement, nommée explicitement dans le texte ; (2) chercher un plus bas
**postérieur** à la première chute et le publier s'il existe ; (3) si une fenêtre glissante (5 j, 20 j)
démarre à l'intérieur de l'événement, le dire ou changer de fenêtre ; (4) ne jamais écrire « effacé »,
« rattrapé » ou « revenu » sans avoir recalculé depuis le cours d'avant.

Voir [[prediction-market-read-the-drift-not-the-level]], [[no-hallucination]].
