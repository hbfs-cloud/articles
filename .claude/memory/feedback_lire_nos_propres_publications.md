---
name: feedback-lire-nos-propres-publications
description: "Avant d'écrire une thèse macro, lire les 3 derniers daily/weekly publiés. Deux thèses réfutées le même jour par notre propre archive."
metadata:
  node_type: memory
  type: feedback
---

# Lire nos propres publications AVANT d'écrire une thèse

**5 août 2026 — deux thèses de daily réfutées le même jour par nos propres articles.**

## Ce qui s'est passé

Thèse n°1 : « le marché a acheté une baisse de taux ». Notre daily du 03/08, publié deux séances
plus tôt, donnait **56,5% de probabilité d'une HAUSSE** en septembre contre 41,5% de statu quo.
Polymarket cote la baisse de septembre à 1,55%. Thèse à l'exact opposé du marché.

Thèse n°2 (réécriture) : « le brut perd 5%, donc l'impulsion inflationniste s'efface, donc la
probabilité de hausse tombe de 11 points ». Le même daily du 03/08 disait déjà, mot pour mot :
« ces 56,5% ne parlent pas d'inflation énergétique » et « si les faucons du comité étaient mus par
le prix du baril, un choc de **-6%** aurait dû faire reculer cette probabilité pendant le week-end.
**Elle n'a pas bougé.** Ce qui tient ces trois voix, ce n'est donc pas l'énergie, c'est le marché
du travail. » La première jambe de -6% sur le brut avait déplacé le contrat de zéro. Ma chaîne
causale était donc déjà testée et déjà invalidée, dans nos propres colonnes.

## La règle

**Avant d'écrire la moindre thèse macro, lire les 3 derniers daily/weekly publiés** — pas leur
résumé, le texte. Chercher explicitement : le sujet a-t-il déjà été traité, avons-nous publié un
chiffre ou une causalité qui contredit ce que je m'apprête à écrire, et si oui la contradiction
est-elle l'histoire ?

Corollaire : `grep` nos propres archives sur les entités de la thèse (Fed, pétrole, or, le ticker)
coûte trois secondes et aurait attrapé les deux cas.

Corollaire n°2 : **ne jamais publier une « correction » d'un brouillon que le lecteur n'a jamais
vu.** J'ai écrit une rétractation sur la diversification or/obligations qui corrigeait une phrase
existant seulement dans mon jet précédent — et qui décrivait faussement ce que nous avions
réellement imprimé. Cela fait fuiter la boucle de révision dans le produit.

## Coût

Deux réécritures complètes, deux blocages de panel, un daily non publiable en fin de journée.

Voir aussi : [[feedback_no_hallucination]], [[reference_aplus_screening_and_screener_dsl]]

## Récidive le même jour, 3e version (5 août 2026)

La v3 ne contredisait plus la note du 3 août : elle la citait **sélectivement**, ce qui est pire dans
un article dont le produit est justement l'honnêteté du bilan.

Lundi publiait DEUX affirmations et un seuil chiffré :
1. le niveau — « soit le baril se retourne, soit ces 56,5% sont trop hauts » (juste, la probabilité
   est tombée) ;
2. le mécanisme — « ce qui tient ces trois voix, c'est le marché du travail, pas l'énergie » ;
3. le seuil de rupture — « **si la probabilité d'une hausse en septembre recule sous 45% d'ici
   vendredi alors que le pétrole reste bas, alors le canal énergétique fonctionnait et nous avions
   tort de l'écarter** ».

J'ai titré « notre appel était juste » en ne citant que (1), alors que (2) était à un demi-point de (3).

**Règle complémentaire** : quand on marque au marché sa propre note, lister TOUTES ses affirmations
et TOUS ses seuils publiés, puis les arbitrer une par une. Ne jamais publier un bilan partiel — un
bilan qui ne retient que ce qui nous donne raison n'est pas un bilan.

**Deuxième récidive dans la même v3** : « aucune donnée d'emploi n'est sortie entre les deux séances »
était faux, et la réfutation venait de MON PROPRE appel `QueryData types=economic_events` du matin,
qui liste `2026-08-03 Euro Area Unemployment Rate`. Tirer une donnée puis écrire le contraire.

**Troisième** : une note qui rend des comptes doit reprendre le **livre vivant** de la note qu'elle
audite. Lundi laissait 10 lignes ouvertes et une règle de demi-taille conditionnée à l'emploi de
vendredi ; ma v3 ne cite pas un ticker alors que la variable directrice venait de bouger de 11 points.

**Quatrième, sourcing** : ne jamais changer d'instrument en cours d'audit. Lundi citait le WTI ;
j'ai publié USO, GLD et SLV en les appelant « pétrole », « or », « argent ». Mon « or +0,66%, du
bruit » est un artefact de GLD — le contrat faisait +2,48%, ce qui inversait mon propre argument.
