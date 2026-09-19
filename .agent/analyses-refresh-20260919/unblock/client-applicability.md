# Applicabilité du client coté documenté — lot B001

Évaluation locale du 19 septembre 2026. Ce dossier étaye uniquement une branche
de collecte « client coté non applicable » : il ne certifie ni une analyse, ni une
source de marché, ni un setup. Une absence de client nommé reste révisable avec
chaque nouveau dépôt primaire.

## Règle de décision

La branche est autorisée seulement si la relation économique examinée ne constitue
pas un client coté documenté. Un pair, un fournisseur, un partenaire de recherche,
un licenciant, un ETF, un streamer ou un intermédiaire de marché ne peut pas être
inscrit comme client pour appeler `comparison_client_bars`. La carte économique et
les comparables restent requis dans le parcours principal.

## AG — First Majestic Silver

AG est un producteur de métaux dont les résultats dépendent de la production,
des teneurs, des récupérations, des coûts et des prix réalisés. La revue primaire
du lot ne nomme aucun acheteur coté ni contrat d'offtake coté attribuable aux
revenus de First Majestic. Les streamers et ETF de métaux peuvent être des
expositions économiques, mais ne prouvent pas qu'ils achètent la production d'AG.
Le Form 40-F 2025 rattache les états financiers et l'analyse de direction au
rapport annuel; l'Annual Information Form ne mentionne que des ventes de lingots
First Mint, sans identifier un client coté ni un offtaker coté.
Le dernier rapport annuel et les prochains dépôts doivent être relus avant toute
nouvelle collecte : une divulgation nominative de client ou d'offtake invaliderait
cette conclusion et imposerait le parcours `applicable`.

Sources primaires : [Form 40-F 2025](https://www.sec.gov/Archives/edgar/data/1308648/000106299326001765/form40f.htm)
et [Annual Information Form, Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1308648/000106299326001765/exhibit99-1.htm).
Preuve de travail conservée :
[revue des facettes AAOI/AG](../B001/AAOI-AG-facet-review.md) et
[client-evidence B001](../B001/client-evidence.md). Ces deux pièces distinguent
explicitement production/streaming des relations client et ne revendiquent pas
l'absence universelle d'acheteur.

## ALLR — Allarity Therapeutics

ALLR est un développeur clinique. La fabrication de stenoparib et le diagnostic
compagnon sont des étapes de préparation et de propriété intellectuelle, pas des
ventes commerciales à un client coté. Eisai est décrit dans l'annonce primaire
comme une relation de développement/licence; il ne peut donc pas être déclaré
client commercial sans contrat de vente distinct. Le dossier doit repasser au
parcours `applicable` si un futur dépôt établit un client commercial coté ou un
offtake documenté.

Sources primaires : [résultats et fabrication du 14 août 2026](https://allarity.com/press-release/allarity-therapeutics-reports-second-quarter-2026-results-and-completion-of-the-phase-3-ready-stenoparib-manufacturing-campaign/),
[Exhibit 99.1 du 15 septembre 2026](https://www.sec.gov/Archives/edgar/data/1860657/000121390026100350/ea030557001ex99-1.htm)
et [Form 10-Q déposé le 14 août 2026](https://www.sec.gov/Archives/edgar/data/1860657/000143774926027830/allr20260630_10q.htm).
La lecture et les limites sont détaillées dans la
[revue primaire AMD/ALLR](../B001/AMD-ALLR-primary-review.md).

## Utilisation contrôlée

Pour une collecte N/A, fournir exactement :

- `documented_client_applicability=not_applicable`;
- `documented_client_symbols=` vide;
- une raison précise, propre à l'émetteur;
- le chemin de ce dossier, ou une preuve équivalente spécifique et revue;
- le SHA-256 exact du fichier de preuve.

Le validateur refuse un symbole client dans cette branche, une justification courte,
un chemin hors dépôt, un fichier absent ou une empreinte différente. La preuve est
intégrée au manifeste d'entrée de la collecte et doit rester identique pendant les
revues ultérieures.
