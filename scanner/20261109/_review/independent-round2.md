# Revues indépendantes du scan du 9 novembre 2026 (MAR), tour 2 (fil principal, 7 novembre 2026)

Relu : signals.json 6bdf5e8b…8531, index.html e7e148e0…1b9d. Senior QA BLOCK, Contrarian BLOCK, Retail War Room BLOCK.

## Arbitrage du fil principal

Le propriétaire a demandé ce scan (« il faut faire le scan du 9 ») : MAR est GARDÉ (option B). MAR est une vraie tendance (EMA20 > EMA50 > EMA200, +17,9 % sur l'EMA200, MACD au-dessus du signal) ; KWEB a été écarté d'abord pour son profil de retournement, son R/R sous 1, ses émetteurs étrangers et son inaccessibilité ; l'argument « achat lundi » était secondaire. Le dire en une phrase dans la méthodologie.

La page et le Telegram disent la divergence telle qu'elle est (phrase type) : « Notre hebdo et notre daily ne prévoient aucun nouvel achat lundi, actions comprises, et attendent le test du mercredi 11 novembre à 22 h 00. Ce scan suit ses propres règles, mécaniques, et va à rebours sur ce point : une seule ligne, à demi-taille. Si vous suivez l'hebdo et le daily, ne prenez pas cette ligne. » Liens /weekly/20261109/ et /daily/20261107/. Supprimer « les deux ne se contredisent pas ». Intertitre Telegram : « Et l'hebdo ? ».

## Bloquants

1. Divergence avec l'hebdo et le daily : ci-dessus (Senior QA, Contrarian, Retail).
2. PNR (rang 40, réadmis, preuve de date OK) absent des rejets, du manifeste et du décompte : l'ajouter (« [plafond de régime] rang 40, conforme, date déduite des dépôts ; un seul suivi de tendance admis, place prise par Marriott (rang 7) ») et corriger « six autres » → « sept autres » partout (Senior QA).
3. Objectif : 433,30 $ EST la résistance, le plus haut intraday du 2 novembre (jour du gap de résultats), refusé deux fois (2 nov., 5 nov. à 430,45) ; il faut un nouveau plus haut historique. Écrire « objectif au plus haut du 2 novembre, 433,30 $ (+4,04 %), déjà refusé deux fois : il faut un nouveau record ». Objectif à 1,6 fois la variation quotidienne moyenne (1,62 ATR), pas « une fois et demie » ; c'est le stop qui est à 1,5 ATR (Contrarian, Senior QA).
4. Taille (Retail) : retirer « 0,25 à 0,5 % du capital » du Telegram (non publié). Page et Telegram : « moitié de votre risque habituel par ligne ; comptez l'écart au stop 1,5 fois (15,60 $ × 1,5 = 23,40 $ par action) pour une ouverture sous le stop ; si vos lignes ouvertes risquent déjà 4 % du capital, n'ajoutez rien » (règles publiées dans le daily du 7 novembre). Exemple chiffré facultatif, en littéral.
5. Ordres de sortie et CPI (Retail) : « Stop de vente : ordre stop au marché à 400,87 $, à révocation. Objectif : vente à cours limité à 433,30 $, à révocation. Si votre courtier refuse deux ordres sur les mêmes titres, utilisez un ordre OCO (l'un annule l'autre) ; sinon posez le stop seul. Mardi, l'inflation sort à 14 h 30, une heure avant l'ouverture : le titre peut ouvrir sous le stop et la perte dépasser 15,60 $ par action. Prix d'achat non atteint lundi : pas d'achat, pas de nouvel essai mardi. »

## Corrections

- « date prouvée » → « déduite des dépôts officiels » partout (le T3 publié le 2 novembre, le T4 clôt le 31 décembre ; l'an dernier le T4 a été publié le 10 février) ; earnings_forward_evidence.result en conséquence.
- Thèse : les +4,30 % en cinq séances sont le gap de résultats du 2 novembre ; depuis, plateau (renversement le 5, trou le 6). Le dire.
- Intro : « Elle va au mieux classé des noms conformes, Marriott (rang 7), qui n'a cédé que 1,8 % jeudi ».
- QQQ −6,5 % / +1,4 % : absent du snapshot du scan → citer « selon notre daily du 7 novembre » avec lien, ou retirer.
- Plafond par famille levé : rendre le public_notice de _family-cap-waiver.json à côté de la dérogation au plancher.
- Invalidation : « chaque soir, regardez la clôture de 22 h (Paris) ; sous 405,50 $, vente le lendemain à l'ouverture de 15 h 30 — mardi, une heure après l'inflation : le prix de sortie peut être nettement plus bas ».
- Frise : ajouter le test du mercredi 11 à 22 h 00 (cité dans l'intro) et le détachement possible du dividende vers le 19-20 novembre (« non annoncé », environ 0,73 $, l'an dernier le 20 novembre 2025).
- Dividende expliqué en clair : le cours baisse mécaniquement du montant le jour du détachement, ce n'est pas un signal de vente.
- Telegram : « Lundi 9, après 15 h 30 (Paris) : achat stop-limite, déclenchement et limite à 416,47 $, valable la séance » ; « Si ni stop, ni objectif, ni clôture sous 405,50 $ : vente au marché vendredi 20 novembre avant 21 h 45 » ; « VIX, l'indice de la peur » ; ≤ 1 500 caractères.
- Gabarit : « 1 Setups », « 1 Stratégies », « 1 setup, classés par stratégie » au singulier ; titre « Rotation sectorielle » vide → remplir ou retirer ; encadré « Ordre d'exécution et hiérarchie des sorties » : ajouter la hiérarchie des sorties ; entry_display « annulez-le dès l'ouverture » à corriger (l'ordre se pose après l'ouverture).
- « Un titre qui ouvre loin au-dessus ne s'achète pas » → « Si le titre ouvre au-dessus, l'ordre limité n'achète que si le cours redescend à 416,47 $. Sinon, pas d'achat. »
- « 10 séances sur 299 ont fait pire en un jour » → « sur 299 séances, 10 ont perdu plus de 2,63 % en un jour ».
- Jargon visible : RISK-OFF → « aversion au risque » ; TP → Objectif ; R/R → « gain visé / perte risquée » ; Momentum/Breakout/Pullback → suivi de tendance/cassure/repli ; « étagère d'émission… écartée par sa forme » expliqué ; volume en dollars précisé (une seule source : 715 M$ ou 660 M$, dire laquelle).
- Méthodologie : la limite à une ligne vient du décrochage du score (63,4 → 37,7) ; une phrase honnête : l'esprit de ce garde-fou plaidait plutôt pour zéro ligne, nous en gardons une à demi-taille à la demande du propriétaire.
- Mentionner en une phrase le bilan du scan du 5 novembre (lignes sorties, dont trois en trou sous leur stop, selon le daily du 7 novembre, lien).
- Commentaires de justification de la date du 9 dans tools/lib/basket-minimum-waiver.js et family-cap-waiver.js.
- Recalculer le filters_sha256 de _audit/universe.json si l'outil le permet, ou noter l'écart (sector_map WCN ajouté après l'audit).
- Fraîcheur : écrire l'exception dans le manifeste et le commit (sonde de statut à 07:18Z, gates verts avec --now à l'heure de capture ; aucune séance depuis la clôture du 6 novembre, barres next_complete_available_at 2026-11-09T21:30Z).
- Rejouer l'aval après correction (aucune position avant la séance du 9).
