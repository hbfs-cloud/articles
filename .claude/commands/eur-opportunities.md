# /eur-opportunities — Opportunités actions en EUR

Produire une édition française de recherche swing, concise et exploitable, couvrant les grandes places européennes en EUR. Le nom de sortie, la date, l'horizon et les préférences viennent de l'invocation; conserver les éditions antérieures. Ce workflow spécialisé peut servir de daily spécial. Il utilise les conventions visuelles de `daily/CLAUDE.md`, sans prétendre avoir exécuté le harnais MCP du daily standard.

## Périmètre et autorisations

- Le workflow EUR bénéficie de l'autorisation utilisateur de collecter des données publiques alternatives au MCP. Cette exception est propre à ce workflow; `.claude/skills/source-policy.md` continue de régir provenance, traçabilité et absence d'invention. Les autres workflows ne sont pas modifiés.
- Une invocation de recherche autorise collecte, calculs, rédaction et vérifications locales. Une demande explicite de publication autorise ensuite la publication de l'édition validée. Ne pas redemander une autorisation déjà accordée pour cette édition.
- Aucune notification à autrui sans autorisation explicite. Aucun ordre, compte courtier, levier, vente à découvert ou produit dérivé. La création du skill n'installe aucun calendrier récurrent.
- Si la séance est finie, écrire la date exacte de clôture et traiter les plans comme préparation de la prochaine séance. Une donnée différée ou une bougie ouverte n'est pas une clôture confirmée.

## Outil et artefacts

Lire l'interface réellement disponible avant chaque première utilisation:

```bash
python3 tools/eur-opportunities.py --help
python3 tools/eur-opportunities.py universe --help
python3 tools/eur-opportunities.py collect --help
python3 tools/eur-opportunities.py study --help
python3 tools/eur-opportunities.py validate --help
```

Exécuter `universe`, puis `collect`, `validate` et `study` avec les paramètres de l'édition. `universe` prend l'export fournisseur brut, son URL et sa date effective; `study` exige un mapping fiscal daté comprenant taux, hypothèses et statut. La collecte utilise un dossier neuf et conserve chaque échec. Ne pas inventer de flags ou de capacités si le script ne les propose pas. Une fonction absente est à implémenter ou à vérifier séparément; ne pas fabriquer un résultat de validation.

Pour rendre une édition, préparer un `edition.json` avec sources, sections et jetons `[[claim:source:/pointeur:format]]`, puis utiliser `node tools/eur-evidence.js <dossier-external> <article-path>` pour rejouer les calculs et `node tools/render-eur-opportunities.js <edition.json>` pour générer HTML et `_data/claims.json`. Le graphique est recalculé depuis le classement mesuré, pas depuis une série éditoriale libre. Le gabarit est `tools/templates/eur-opportunities.html`. Vérifier les régressions avec `python3 -m unittest discover -s tools/tests -p test_eur_opportunities.py`.

Le dossier de travail conserve les réponses brutes, URL, heure de capture, date de référence, identité de chaque instrument, méthode de calcul, paramètres, observations et hashes. Geler le manifeste avant les revues. Une source nouvelle après ce gel exige un nouveau snapshot et la reprise des contrôles affectés. Les noms internes des fichiers ne constituent jamais une preuve de contenu ou de fraîcheur.

## Univers et couverture géographique

Découvrir la composition officielle la plus récente du fournisseur islamique retenu, avec son référentiel daté. Pour iShares, utiliser les identifiants et la date de composition exposés par la page officielle; ne pas figer la date d'une ancienne requête.

Sélectionner les lignes `Equity` dont la devise de marché est `EUR`. Conserver ISIN, ticker fournisseur, place, classe de titre, pays du risque et secteur. Pays du risque, domicile juridique, préfixe ISIN, place de cotation et devise sont des dimensions différentes. Une cotation EUR n'élimine pas le risque de change économique.

Présenter le nombre initial de lignes, les pays et marchés couverts, les échecs de collecte et les exclusions. Vérifier notamment la présence des grands marchés France, Allemagne, Espagne, Italie et Pays-Bas dans la découverte; ne pas imposer un achat dans chaque pays. Un panier fournisseur représente son univers sélectionné, pas toutes les actions européennes ni toutes les actions admissibles au sens religieux.

Valider tout mapping vers le fournisseur de prix par identité et place; un suffixe ajouté au ticker est une hypothèse. Dédupliquer les cotations et identifier les classes multiples. Une classe préférentielle n'est pas une action ordinaire: lire ses droits avant inclusion dans un plan limité aux actions ordinaires. Ne pas la qualifier automatiquement d'obligation ou de titre interdit à partir de son nom.

## Données et étude reproductible

Collecter les historiques pour l'univers découvert avec une fenêtre commune, ainsi que des références cohérentes en EUR. Identifier calendrier, fuseau, statut terminé de chaque barre, ajustements et opérations sur titres. Ne pas mélanger cours intrajournaliers et clôtures ou séries ajustées et non ajustées sans expliciter le traitement.

Pour le swing, dériver localement tendance, volatilité, liquidité, rendement relatif et niveaux nécessaires. Définir la sélection avant de regarder les résultats futurs des occurrences historiques. Documenter filtres, horizon, entrée simulée, gain, perte, sortie temporelle, coûts et traitement des gaps. Une étude utilisant les constituants actuels porte un biais de survivance à signaler.

Si un classement « probabilité × rendement » est demandé:

- Nommer `p historique` la fréquence réellement calculée sur un échantillon décrit. Afficher le nombre d'observations, les dates et l'incertitude; traiter explicitement les horizons qui se recouvrent.
- Séparer la fréquence de hausse à une échéance, la probabilité d'atteindre une cible avant un stop et le rendement espéré: ce sont des événements différents.
- Un produit `p × gain` ignore les pertes et coûts. Donner aussi une espérance cohérente comprenant gains, pertes et éventuelles sorties neutres, ou expliquer pourquoi le score n'est qu'un indicateur de classement.
- Ne jamais présenter une fréquence rétrospective comme probabilité future calibrée. Une estimation de probabilité future exige une méthode définie et une validation hors échantillon disponible.
- Si les données ne permettent pas un modèle crédible, proposer un classement de recherche clairement nommé et des conditions de surveillance. Ne pas inventer la probabilité réclamée pour remplir une colonne.

## Filtre islamique et financement

L'appartenance à une composition officielle datée permet une attribution au filtre du fournisseur. Elle n'est pas une certification individuelle AAOIFI, une garantie de conformité actuelle ni une preuve de zéro revenu accessoire interdit. Nommer le référentiel et ses tolérances; ne pas combiner les seuils et dénominateurs de méthodes différentes.

Pour recalculer un filtre, obtenir tous les postes nécessaires dans les comptes primaires, y compris la ventilation des revenus non permis et les intérêts pertinents. Ne pas remplacer le revenu d'intérêts par le résultat financier net ou par les intérêts encaissés du tableau des flux. Une analyse incomplète reste une attribution fournisseur avec limites explicites.

Le contrôle du capital porte sur les publications récentes et les instruments anciens encore vivants: comptes annuels/intermédiaires, notes de capital/dette, décisions d'AG, émissions, rachats et documents réglementaires de l'émetteur. Ne pas se limiter à une fenêtre de180jours. Lire les dépôts donnant accès au capital et leurs annexes; un registre étranger ne suffit pas s'il ne couvre que la dette locale de l'émetteur.

Pour chaque opération, distinguer:

- Autorisation générale, programme de financement activé, émission effectivement réalisée et instrument résiduel.
- Actions nouvelles, titres propres remis en circulation, achats salariés sur le marché et rémunération comptable.
- Dette classique, dette convertible et dilution du bénéfice opérationnel sans création de titres.

Quantifier la dilution brute et nette lorsqu'elle est calculable, le dénominateur, le prix de conversion, les échéances et les possibilités de règlement. Relier le financement à son objectif: investissement, acquisition, refinancement ou besoin de liquidité. Un refinancement peut retirer davantage d'actions potentielles qu'il n'en crée. Une autorisation ou un mot « convertible » ne provoque aucun veto automatique.

Observer la réaction du titre face à un indice ou secteur sur une fenêtre précisée. La réaction boursière ne prouve pas la causalité; un placement réussi ne prouve pas l'adhésion des actionnaires. Séparer ce jugement économique du filtre islamique. Ne pas présenter une collecte manquante comme un contrôle passé: compléter la preuve, limiter la conclusion ou retirer la recommandation concernée selon la matérialité du manque.

## Article et revues

Construire une vue360 autour du classement effectivement obtenu: contexte européen, concentrations pays/secteurs/facteurs, meilleurs dossiers, catalyseurs datés, thèses contraires et risques d'exécution. Les scénarios sont conditionnels; un événement annoncé n'est pas une réaction de prix certaine. L'absence de candidat suffisamment documenté est un résultat valable.

Pour chaque dossier exploitable, expliquer le déclencheur, l'invalidation et le risque déterminant avec niveaux sourcés si disponibles. Ne pas recommander de poursuivre un gap en se fondant sur une entrée historique. Calculer les scénarios de perte et signaler qu'un stop ne garantit pas le prix de sortie.

Effectuer sur le même snapshot une revue senior des preuves et calculs, une revue contrarian des causalités/omissions, et une revue retail de la lisibilité, des gaps, du risque agrégé et des conditions d'action. Utiliser des reviewers indépendants lorsque l'invocation ou le harnais l'exige et que la délégation est autorisée; sinon documenter les perspectives vérifiées sans inventer un panel indépendant.

Vérifier la hiérarchie, les liens, les tableaux et graphiques sur mobile et bureau, l'accessibilité et les références datées. Exécuter les contrôles de contenu applicables à l'article, notamment QA stricte, fraîcheur des preuves et cohérence des calculs. Les checks applicables sont ceux réellement installés dans le dépôt; ne pas annoncer un harnais `eur-opportunities` enregistré s'il n'existe pas.

## Décision de publication

Le rapport de `validate` atteste seulement les invariants qu'il contrôle réellement. Joindre les conclusions documentaires et éditoriales séparées. Corriger les erreurs importantes et reprendre les checks affectés avant publication. Une limite connue et correctement présentée n'est pas équivalente à une erreur cachée ou à une preuve obligatoire absente.

Publier selon le mécanisme existant du dépôt quand l'invocation l'autorise et que le résultat exact a été validé; indexer une seule fois et vérifier la page distante. Donner le lien final et les limites matérielles de l'édition. Conserver les sources brutes localement ou dans leur stockage prévu: leur présence dans un dossier article n'autorise pas leur redistribution publique intégrale.
