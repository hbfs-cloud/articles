# Revalidation Retail War Room finale — scanner du 21 septembre 2026

**Verdict : PASS — zéro blocker retail sur le gel revalidé.**

## Périmètre et intégrité du gel

Revue documentaire locale du scanner prévu pour le **21 septembre 2026**, sur la clôture de référence du **18 septembre 2026**. Aucun appel broker, ordre, compte ou LIVE n’a été effectué.

- SHA-256 de `scanner/20260921/_reviews/snapshot.json` vérifié : `442cd9f585c92d6e949dab747418f196fb298897ccf90b1d92368d66d5ad0adc`.
- Les 16 artefacts hashés du snapshot, dont `signals.json`, `data.json`, `index.html`, les preuves de sélection/risque et le pont DTX, correspondent tous à leur SHA-256 et taille scellés.
- Les gates déclarés sont tous PASS, y compris `validate_scan` (9 signaux), horizon/risque, qualité scanner, contenu DTX et QA strict (0 erreur ; 6 avertissements déclarés).
- Le blob Git exact `cc93778f821aab6f271821edf12d19164a67980e` établit l’ancien `index.html` : SHA-256 `4f6ec61b4fc8a6c6e06f41d64659d346bbb41a3fd0b5d869cdabd9d2e088f9bf`, 48 862 octets. Il diff uniquement avec le fichier courant, SHA-256 `91af45227f3e41b4c5ac87d5f97c44a46ad2f5212eb2b8b76e9b768250595411`, 48 861 octets, sur deux normalisations de whitespace : (1) à la ligne 84, les deux espaces d’une ligne vide sont supprimés ; (2) l’EOF, auparavant sans saut de ligne, reçoit un saut de ligne terminal. Les 385 lignes logiques restent identiques après `rstrip` ; les lignes avec whitespace terminal passent de 1 à 0.

## Neuf plans éditoriaux : actionnabilité et langage retail

Chaque ligne est un plan conditionnel à cours limité, au prix unique publié, **valable le 21 septembre seulement**. Si le marché ouvre au-dessus du prix sans retour, il n’y a pas de poursuite ; si le prix n’est pas touché, le plan expire et n’est pas reporté. Les neuf lignes portent un stop sous l’entrée, deux objectifs au-dessus et une invalidation de clôture sous l’entrée.

| Ticker | Famille | Entrée | Stop | TP1 / TP2 | R/R TP1 | Invalidation lisible |
|---|---|---:|---:|---:|---:|---|
| QRVO | Breakout | 117,18 | 110,13 | 124,23 / 126,58 | 1,00 | clôture sous le plus bas de référence |
| EBAY | Breakout | 111,84 | 106,67 | 117,00 / 118,72 | 1,00 | clôture sous le plus bas de référence |
| DGX | Breakout | 246,45 | 238,72 | 254,18 / 256,75 | 1,00 | clôture sous le plus bas de référence |
| IFF | Pullback | 82,96 | 80,27 | 85,65 / 86,54 | 1,00 | clôture sous le plus bas de référence |
| SEIC | Pullback | 105,20 | 102,04 | 108,94 / 109,28 | 1,18 | clôture sous le plus bas de référence |
| AWK | Pullback | 135,90 | 131,82 | 139,90 / 141,23 | 0,98 | clôture sous le plus bas de référence |
| RVTY | Momentum | 143,45 | 136,50 | 150,39 / 152,71 | 1,00 | clôture sous le plus bas de référence |
| PDBC | Momentum | 19,66 | 19,07 | 20,16 / 20,24 | 0,85 | clôture sous le plus bas de référence |
| IBIT | Momentum | 46,02 | 43,93 | 48,11 / 48,80 | 1,00 | clôture sous le plus bas de référence |

- Parité contrôlée : 9/9 respectent `stop < entrée < TP1 < TP2`, avec invalidation sous l’entrée.
- Les 9/9 affichent explicitement le garde-fou no-chase et l’absence de report. L’horizon éditorial est de dix séances ; la validité de l’ordre limité reste bornée au 21 septembre.
- Les R/R sous 1 ne sont pas masqués : PDBC est à 0,85 et AWK à 0,98. Cela réduit leur attrait apparent ; ce ne sont pas des objectifs à interpréter comme garantis.
- IBIT est une exposition bitcoin à facteur unique. PDBC regroupe énergie, agriculture et métaux industriels. Le lecteur ne doit pas assimiler les neuf lignes à neuf risques indépendants.

## Risque de gap, slippage et concentration

Un stop est un seuil de gestion du risque, pas une garantie de prix d’exécution : une ouverture en gap ou une liquidité dégradée peut produire une sortie nettement moins favorable. Cette limite vaut pour tous les plans éditoriaux et doit rester visible à la lecture des niveaux.

Le calendrier disponible s’arrête au 25 septembre alors que l’horizon maximal atteint le 2 octobre ; cette couverture incomplète est un risque contextuel déclaré, non une absence d’événement. Les corrélations reposent sur 120 rendements communs et ne prouvent aucune indépendance statistique.

## Sept lignes DTX : information pilot/research uniquement

Les lignes **AWAY, BSOL, CRPT, MSST, MSTY, SSK et TSOL** sont séparées des neuf plans éditoriaux. Elles sont classées **pilot/research, information-only** : elles ne sont ni une recommandation, ni une instruction d’exécution, ni une autorisation broker ou LIVE. Cette revue ne fournit aucun sizing.

- Le snapshot fixe leur fenêtre au 21 septembre, de 13:30 à 19:55 UTC ; il atteste `api_orders_at_review: 0`. Le registre `portfolio/v1/best/orders.json` scellé contient également zéro ordre avant cette fenêtre.
- Les sept candidates restent concentrées dans des produits liés à la crypto et/ou thématiques, parfois à exposition amplifiée. Cette concentration augmente le risque de mouvements corrélés.
- Le stop de catastrophe indiqué pour chacune est à **-20 %** sous l’entrée. Il ne protège pas contre un gap ni contre le slippage et représente une distance de risque substantielle.
- Les métriques de replay DTX sont des éléments de recherche ; elles ne sont pas des performances réalisées. Le tracker scellé séparé ne doit pas être confondu avec ce replay.

## Blockers

Aucun. La preuve Git établit que les deux changements HTML sont des normalisations de whitespace seulement ; ils ne modifient ni les niveaux, ni le contenu, ni l’actionnabilité des neuf plans, ni le statut informationnel des lignes DTX.
