# Revue contrarienne éditoriale — scanner du 14 septembre 2026

**Périmètre.** Lecture indépendante de `scanner/20260914/index.html`, `_selection.json`, `data.json`, `signals.json`, `calendar-corrections.json`, `_basket/correlation.json`, et des reçus finaux de calendrier/SEC. Aucun calcul, niveau ni source n’a été modifié pendant cette revue.

## Snapshot final revu

| Artefact | SHA-256 |
|---|---|
| `index.html` | `d972d46836be109cc66755d568ae948df501371184b7620330dd511e18d7ac71` |
| `_selection.json` | `64d3542d9258ee8a979547178dfad7f4ffbab272bc562a984361b0b0dd9cf86a` |
| `data.json` | `12dc2cebdeb8f6eb3a6a3314043b7294cf6c4ed83f3f418ab94033091c705af0` |
| `signals.json` | `25728fe515937d52cf761ebf5699fd12806e7c5b8dd9025f04a123378ebce500` |
| `calendar-corrections.json` | `a401e0564d3b5818f249584480972e36ccea50bf54d75020892b2349e44bb1a0` |
| `_basket/correlation.json` | `ca6c0e955178d91e26fcc3530bda810a88fe5be928e03adb293592eeecbc1219` |
| `_final/earnings_selected_evidence.json` | `1a31f1661eeba59935fbcf1b8ae8de394cf334507dd00f008490a4f0bf4af53a` |

## Delta de provenance enregistré

Le diff contre `pre-registered-final` ne modifie ni les huit thèses, ni les niveaux, ni le rendu HTML. Il met à jour des horodatages et des empreintes de reçus de sélection/SEC après enregistrement des plans publics ; les dates de référence, fenêtres de dilution, décisions et texte public restent identiques.

## Verdict — PASS éditorial conditionnel

Le rendu décrit huit plans conditionnels pour le lundi 14 septembre, sans allocation, position ouverte, garantie de fill ou promesse de performance. Les objections initiales sur les échéances, la géométrie des objectifs et la concentration énergie sont résolues dans le snapshot ci-dessus. Le verdict ne certifie ni l’exécution, ni la disponibilité d’informations après la borne documentaire du 18 septembre.

## Contrôles substantiels passés

- Les huit niveaux HTML correspondent aux valeurs de `data.json` : META 648,03 / 615,97 / 680,08 / 690,76 ; AAPL 332,27 / 320,20 / 344,57 / 348,36 ; EMR 152,19 / 146,52 / 157,86 / 159,75 ; MTDR 61,05 / 58,45 / 63,65 / 64,52 ; JNJ 265,58 / 257,28 / 273,87 / 276,64 ; NWSA 29,44 / 28,44 / 30,43 / 30,76 ; XLE 65,14 / 63,18 / 66,95 / 67,55 ; BITO 10,37 / 9,90 / 10,84 / 10,99.
- La page explique que T1 est surtout une construction à 1,5 ATR et T2 à 2 ATR, avec un plancher de stop de 3 %. Elle ne présente plus cette géométrie comme une résistance observée. Les rapports T1 exacts sont META 0,9997 ; AAPL 1,0191 ; EMR 1,0000 ; MTDR 1,0000 ; JNJ 0,9988 ; NWSA 0,9900 ; XLE 0,9235 ; BITO 1,0000. Dire que quatre lignes sur huit visent moins qu’elles ne risquent est donc correct avant l’arrondi.
- L’ordre est limité, à un prix unique et valable seulement le 14 septembre. Une ouverture au-dessus sans retour ne crée pas de position. L’invalidation de clôture est explicitement distincte du stop dur intrajournalier ; l’horizon commence à un fill éventuel et finit après dix séances.
- MTDR et XLE sont présentés comme des alternatives, jamais comme une diversification : leur corrélation maximale est 0,841305 sur 120 rendements logarithmiques. La page ne leur attribue ni pondération ni bénéfice de portefeuille.
- Les huit thèses ont désormais un mécanisme et une objection propres : conversion du cash/capex chez META, demande contre disponibilité chez AAPL, dispersion des segments chez EMR, pétrole-intégration-levier chez MTDR, sous-performance défensive et litiges chez JNJ, BFR/cyclicité chez NWSA, concentration énergie chez XLE, et base-roulement-gap de week-end chez BITO. Les chiffres projetés de MTDR et les rendez-vous produits d’AAPL restent formulés comme conditionnels.
- Le score uniforme de 80 est limité à une compatibilité éditoriale. Il n’est ni une probabilité, ni une conviction, ni un classement entre stratégies.
- Le correctif PPI est visible : le registre primaire BLS établit le 10 septembre, et non le 14 septembre du flux brut. Le fichier de correction conserve les empreintes du brut et du registre.
- Les prochaines dates de résultats de META, AAPL, EMR, MTDR, JNJ et NWSA sont archivées dans `_final/earnings_selected_evidence.json` et toutes postérieures à l’horizon. JNJ renvoie aussi à son calendrier IR. Les ETF sont distingués de ces émetteurs.
- XLE n’avance plus une date de composition et BITO n’avance plus une date précise de roulement : les deux fiches décrivent le mécanisme et sa limite, sans précision invérifiable.

## Limites non bloquantes à conserver

- Le calendrier collecté va jusqu’au 18 septembre alors que l’horizon théorique se termine le 25 septembre. Le texte le dit clairement : au-delà, seul le registre primaire couvre des rendez-vous connus ; il ne prouve pas l’absence de tout événement corporate ou macroéconomique.
- Les corrélations sont historiques sur 120 observations et instables par nature. Elles servent à empêcher l’empilement MTDR–XLE, pas à estimer un risque de portefeuille.
- Les moyennes EMA et graphiques Finviz sont des supports techniques. Ils ne remplacent ni une série de prix archivée, ni une règle d’exécution, ni un contrôle de gap avant l’ordre.
