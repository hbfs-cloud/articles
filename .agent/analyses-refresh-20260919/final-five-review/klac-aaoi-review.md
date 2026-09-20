# KLAC et AAOI — revue finale locale des sources, du contrarian et du retail

**Date de revue :** 20 septembre 2026. Cette note est une revue en lecture seule des candidats locaux du run `20260919-update`. Elle n'est ni une attestation AQ, ni une autorisation de publication, ni une recommandation ou un ordre.

## Empreintes et contrôles rejoués

| Dossier | Analyse SHA-256 | Evidence SHA-256 | Contrôles locaux actuels | Décision de publication |
| --- | --- | --- | --- | --- |
| KLAC | `91aea77c367daeeadfbbc055e92788c37a8004e69f694b9e7fc12a2111769389` | `486f733c1354424062a50e3987cf595265445d97b9fdb30f2097b5a188b03978` | evidence : PASS (282 claims) ; pré-revue éditoriale stricte : 0 erreur, 0 avertissement ; QA HTML stricte : 30/30 | **BLOCK** |
| AAOI | `ded1e92a53d99a4c004752b3fe089bd39b46aca199da1997704c768e490d6577` | `8366965a6939b792a8ad78d9839b6bb4f20da3f09902715a0b1520f69f8fbdf7` | evidence : PASS (274 claims) ; pré-revue éditoriale stricte : 0 erreur, 0 avertissement ; QA HTML stricte : 30/30 | **BLOCK** |

Les PASS ci-dessus établissent que les artefacts locaux actuels se rendent et que les pointeurs, entrées et empreintes déclarés par le validateur se résolvent. Ils ne lèvent pas un gate de source absent et ne valent pas AQ finale.

## KLAC

### Lecture sémantique des claims et des sources

- Le candidat est bien `no-trade`. La clôture du 18 septembre à 176,99 $, le rebond journalier et les rendements relatifs sont reliés aux barres datées ; les marges et multiples sont explicitement présentés comme provenant d'un fournisseur dont la période des dénominateurs n'est pas fournie. Cette réserve est matériellement importante : `38,40x` EBITDA et `47,87x` résultat ne doivent pas être lus comme des multiples de période comptable certifiée.
- Le manifeste primaire courant conserve et hache 32 documents, dont le 10-K `0000319201-26-000027`, l'exhibit 99.1 du 8-K `0000319201-26-000024`, le 8-K de dividende et le 8-K du 12 juin `0001193125-26-269375`. La revue Senior courante confirme que l'index humain a été synchronisé aux 32 entrées et que leurs hashes correspondent au manifeste.
- La formulation capitalistique est prudente et cohérente : 1,3065 milliard d'actions est un dénominateur MCP, non un pont pleinement dilué ; 4,90 Md$ de trésorerie contre 6,15 Md$ de dette ne permet pas de qualifier le bilan de « net cash » ; l'absence d'ATM dans le corpus ciblé ne prouve pas l'absence de capacité future. Les Form 4/144 et les ventes secondaires ne sont pas transformés en financement de la société.
- Limite sémantique résiduelle : le `primary-manifest.json` KLAC est surtout un inventaire bibliographique haché et ne porte pas d'extraits chiffrés typés comparables à ceux d'AAOI. Les claims financiers restent correctement reliés aux artefacts MCP hashés, mais le hash du primaire seul n'apporte pas une vérification automatique phrase-par-phrase d'une affirmation narrative tirée d'un dépôt SEC.

### Contrarian et retail

Le sens contrarian tient : une marge forte et un rôle industriel ne suffisent pas à neutraliser le risque de compression de multiple, de commandes reportées, d'export et de concentration clients. La sous-performance sur 21 séances face à SMH est décrite comme un fait de marché, sans être convertie en prévision.

La protection retail est suffisante pour un dossier archivé : le rendu affiche « AUCUN ORDRE ACTIF », les anciens niveaux sont dans un disclosure fermé, daté de la clôture de référence du 27 août, sans R/R actif. Ils ne peuvent pas être réemployés comme entrée, stop ou objectifs au 18 septembre. Une réouverture exigerait un nouveau prix, une structure observable et la vérification des événements ; elle ne peut pas reposer sur le contrat historique.

### Blocage final

`RankBeta` reste requis et a échoué en HTTP 403. La sélection de comparables et les statistiques locales ne remplacent pas l'univers large obligatoire. La couverture de capacité de financement primaire demeure elle aussi non exhaustive. **Conclusion KLAC : qualité locale PASS, source/publication BLOCK.**

## AAOI

### Lecture sémantique des claims et des sources

- Le candidat est également `no-trade`. Son raisonnement refuse justement de déduire une amélioration par action de la seule croissance des revenus : le 10-Q Q2 documente 191,922 M$ de revenus trimestriels, tandis que l'EBITDA fournisseur négatif est traité comme incompatible avec un scénario de valorisation. Le sidecar utilise `non_applicable` et `NON_POSITIVE_EBITDA`, sans EV, multiple, objectif ou downside fabriqué.
- Les chiffres de capital les plus sensibles sont correctement qualifiés par le 10-Q `0001437749-26-026278` et le 424B5 `0001104659-26-099685` archivés et hashés. La lecture directe du 10-Q confirme le warrant client Amazon : 7 945 399 actions au strike de 23,6956 $, dont 1 324 233 exerçables à l'émission et 6 621 166 conditionnelles à 4 Md$ d'achats sur dix ans. Le 424B5 fournit une base de 84 906 289 actions au 20 août et exclut 1 090 055 RSU et 629 463 PSU.
- L'ATM jusqu'à 600 M$ est présenté comme une capacité, jamais comme une vente réalisée, du cash reçu ou une capacité restante certifiée. De même, l'illustration de 4 647 561 actions à 129,10 $ reste une hypothèse du prospectus. La fiche n'additionne pas ces instruments dans un total fully diluted fictif et conserve explicitement ce pont au statut BLOCK.
- Les relations de comparables sont convenablement bornées : 18 séries et les corrélations/bêtas locaux sont descriptifs, chaque transmission économique est conditionnelle et ne devient ni client, ni contrat, ni causalité. La relation Amazon est elle-même encadrée par la condition d'achats du warrant.
- Réserve de provenance connue : les extracteurs AAOI pointent vers des `claim_extracts` datés (ligne et needle) dans le manifeste. Le validateur vérifie l'intégrité des cinq documents et la résolution du pointeur, mais ne rejoue pas automatiquement que chaque needle/ligne du manifeste est encore présent dans le HTML primaire. La revue indépendante antérieure a contrôlé ces chiffres à la source ; cette absence de test automatique reste un défaut de robustesse du processus, pas un motif pour remplacer les valeurs.
- Dérive documentaire à corriger avant revue de release : le README et la revue de clôture AAOI mentionnent encore 239 claims, la revue indépendante 240, alors que le validateur actuel passe 274 claims pour l'evidence hashé ci-dessus. Les artefacts sont cohérents au contrôle courant, mais ces comptes rendus ne décrivent plus l'état exact et doivent être mis à jour lors de la prochaine régénération.

### Contrarian et retail

Le cas baissier est concret : une croissance de volume peut ne pas devenir marge ni cash par action, alors que les engagements de capacité, l'ATM potentiel, le warrant et la concentration des dix principaux clients à 99 % augmentent la sensibilité aux retards, au prix et au financement. L'article évite de traiter la capacité industrielle comme demande confirmée et conserve les contradictions entre revenus, rentabilité et dénominateur dilué.

Le dispositif retail est cohérent avec ce risque : profil élevé, aucun ordre actif, aucune cible de valorisation et niveaux historiques enfermés dans une archive non exécutable, liée au snapshot du 28 août. Aucun stop ni objectif archivé n'est présenté comme testé sur la fenêtre actuelle. Une décision future devrait d'abord réconcilier le capital pleinement dilué, les émissions ATM éventuelles, les événements émetteur et la liquidité observable.

### Blocage final

RankBeta demeure HTTP 403 et le calendrier CIEN est `UNAVAILABLE`; ces sources obligatoires empêchent de certifier transmission et calendrier comparable. Le pont pleinement dilué au 18 septembre est toujours non réconcilié, et le contrat de trading historique est expiré et non rejoué. **Conclusion AAOI : qualité locale PASS, source/publication BLOCK.**

## Décision de cette revue

Les contrôles locaux de preuve, de densité éditoriale et de HTML sont passants pour les deux candidats identifiés par leurs hashes. Les dossiers restent toutefois bloqués pour toute publication ou AQ finale par les gates de sources explicites ci-dessus. Cette note ne crée aucun PASS AQ et ne modifie ni les analyses, ni leurs générateurs, ni leurs preuves.

### Addendum — régénération autonome AAOI

Après la revue, le générateur AAOI a été rendu autonome et l'evidence a été régénérée. Le SHA de `AAOI.json` reste identique à celui du tableau (`ded1e92a53d99a4c004752b3fe089bd39b46aca199da1997704c768e490d6577`) ; seul `evidence.json` devient `11a4ae0371d38df50c79340ad38c1b7a189bb74b085bbc4bf0e8260f0576dae7`. Le validateur courant passe toujours `274 claims`. Les constats et blocages de cette revue restent applicables.
