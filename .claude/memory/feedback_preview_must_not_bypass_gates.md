---
name: preview-must-not-bypass-gates
description: Un chemin d'affichage (aperçu, prévisualisation) ne doit jamais court-circuiter un filtre d'éligibilité — et un zéro dû à un seuil doit se lire autrement qu'un zéro dû au calme
type: feedback
---

Le 2026-09-13, l'aperçu de week-end du dashboard scanner appelait
`signalsFor(cfg, {pending:true})`, dont le filtre portait
`options.pending || cfg.minScore <= 0 || s.score >= cfg.minScore`. Le court-circuit publiait
« 1 Order to Place : META » pour un signal à 80 face au seuil 90 de turbo, pendant que
l'instantané JSON du même scan (même fonction, sans le drapeau) portait 0 ordre. Le
propriétaire a signalé la disparition des ordres le lundi ; c'était en réalité le système
qui cessait de mentir.

Défaut jumeau, plus grave : « No new orders » ne distinguait pas un marché calme d'un seuil
que plus aucun signal n'atteint. Le scanner sort des scores plats à 80 depuis le 2026-09-08
(`scoreSource: 'flat_no_ranking_asserted'` — le producteur `build-scan.js` déclare
n'affirmer AUCUN classement) face à des seuils de 85 à 90 : zéro entrée éligible, tous modes,
dernière entrée scellée le 1er septembre. Deux semaines de silence qui ressemblait à du calme.

**Why:** un aperçu montre en avance ce qui VA se passer ; il n'invente pas une éligibilité.
Dès qu'il relâche un filtre « juste pour l'affichage », il promet ce que le système refusera,
et il masque la panne qu'il aurait dû révéler. Deux surfaces du même produit — la page HTML et
l'instantané JSON — se sont contredites pendant une journée sans qu'aucun gate ne morde.

**How to apply:** ne jamais paramétrer un filtre d'éligibilité par un drapeau d'affichage ;
l'aperçu change l'ÉTIQUETTE, jamais la sélection. Et tout état vide doit nommer sa cause :
« 8 signaux écartés par le seuil de score — meilleur 80 pour un minimum de 90 » plutôt qu'un
« aucun ordre » muet. Corollaire de vérification : quand deux surfaces publient la même
donnée, comparer HTML et JSON avant de croire l'une des deux. Voir
[[label-change-without-routing]].
