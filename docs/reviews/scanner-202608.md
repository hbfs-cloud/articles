# Revue critique du scanner — 3 août → 1er septembre 2026

19 scans publiés, 165 signaux, 136 tickers. Chaque signal rejoué barre par barre contre les
clôtures réelles jusqu'au 4 septembre, au pire prix de remplissage autorisé (`entry_high`), stop
prioritaire sur la cible en cas d'ambiguïté intrajournalière. 99 signaux ont vu leur horizon
s'écouler, 85 se sont déclenchés.

Méthode et mesures reproductibles : `node tools/signal-outcomes.js --bars <staging> --report`.
Ledger : `data/signal-outcomes.json`.

---

## Le chiffre qui résume le mois

**Espérance −0,045R sur 85 signaux déclenchés. Taux de gain 45 %.**

IC95 : [−0,24 ; +0,15]. Sur un mois complet, l'espérance en R est indistinguable de zéro.

Mais zéro n'est pas la bonne référence, et ce chiffre seul induit en erreur. Mesuré contre
l'indice sur les mêmes fenêtres, le scanner **choisit bien** : les titres retenus rendent
+0,72 % tenus quand SPY perd 0,46 %, et 58 % d'entre eux battent l'indice. C'est la
**conversion** du choix en trade publié qui rend le résultat nul — et une part majoritaire de
cet écart s'explique par la convention de mesure au pire prix, pas par une perte réelle
(détail en §« Contre quoi se mesure-t-on ? »).

La formulation juste n'est donc pas « le scanner est mauvais », c'est :

> **le scanner a un edge de sélection plausible, une conversion qui l'annule, une hiérarchie
> publiée qui ne discrimine rien — et aucun instrument pour s'en apercevoir.**

Ce dernier point est le vrai sujet de cette revue.

## Ce que le dépôt ne mesurait pas

Le repo mesure très sérieusement les modes de portefeuille : `sweep.js`, `frozen_*`,
`trade-chain.json` avec chaîne SHA-256, cohortes invalides déclarées, immutabilité des trades
scellés. Rien de tout cela ne couvre les **setups éditoriaux publiés** — ceux que lit le lecteur.

Il a fallu reconstruire les 165 issues à la main pour écrire cette revue. C'est la cause racine
de la dérive : un mois entier de publication sans qu'aucun artefact du dépôt ne puisse répondre à
« est-ce que nos signaux gagnent ? ». Les garde-fous existants valident la **forme** (schéma,
fraîcheur, R/R recalculé, dilution, résultats ±3 séances) et jamais le **résultat**.

`tools/signal-outcomes.js` comble ce trou. Lignes scellées à horizon écoulé, immuables, checksum
— même doctrine que `trade-chain.json`.

## Tes deux intuitions, mises à l'épreuve

### « On attend un setup parfait avant de rentrer » — infirmé

| Mesure | Valeur |
|---|---|
| Signaux déclenchés | **86 %** (85/99) |
| Déclenchés dès la séance J+0 | **78 %** |
| Hausse manquée sur les non-déclenchés (médiane) | **0,33 %** |
| Entrées situées au-dessus de la clôture de référence | 41 % |

On ne rate presque rien : on entre sur 86 % des lignes, et 4 fois sur 5 dès la première séance.
Ce qu'on rate ne montait pas (0,33 % médian).

Le problème est **l'inverse de ce que tu pensais** : la zone d'entrée n'est pas trop exigeante,
elle est décorative. Contrefactuel, mêmes stops et mêmes cibles :

| Politique d'entrée | n | Espérance |
|---|---|---|
| Zone publiée, remplissage au pire prix | 85 | −0,045R |
| Achat à l'ouverture de la séance, sans zone | 98 | **+0,043R** |

Acheter bêtement à l'ouverture fait marginalement mieux, avec 13 signaux de plus. Les écarts se
recouvrent largement — la lecture honnête n'est pas « l'ouverture est meilleure », c'est **« toute
la mécanique de zone, de gate VWAP et de `conditional_next_session` ne produit aucun bénéfice
mesurable »**. Elle coûte 14 % de signaux et beaucoup de cérémonial dans l'article.

### « On gère mal la sortie » — vrai comme constat, faux comme levier

Le constat est juste. Trois seaux, dont un qui fuit :

| Sortie | n | Part | R moyen | MFE médian offert |
|---|---|---|---|---|
| Stop | 31 | 36 % | −1,00R | 0,14R |
| Cible TP1 | 26 | 31 % | +1,06R | 1,19R |
| **Horizon** | **28** | **33 %** | **−0,02R** | **0,66R** |

Un tiers des positions offrent 0,66R de gain latent médian et finissent à zéro. La part médiane
du mouvement favorable réellement encaissée est de **50 %**.

Sauf que — et c'est le résultat qui compte — **aucune politique de sortie ne récupère cet
argent.** Testé sur exactement les mêmes barres :

| Politique | Espérance | Δ |
|---|---|---|
| Baseline (actuel) | −0,045R | — |
| Stop à breakeven après +0,5R | −0,062R | −0,017 |
| Time-stop J+3 si négatif | −0,002R | +0,043 |
| Trailing 1,5×ATR après +0,5R | −0,026R | +0,019 |
| Moitié à TP1, reste suivi | −0,052R | −0,007 |
| Cible portée à 2,5×ATR | −0,061R | −0,016 |
| Combo BE + partielle + suivi | −0,061R | −0,016 |

Tout est dans le bruit, la moitié dégrade. Le breakeven, réflexe classique, est le pire : il
transforme des trades qui respiraient en sorties à zéro (taux de gain 45 % → 32 %).

La raison est visible dans le tableau des stops : **74 % des signaux stoppés n'ont jamais offert
0,3R**. Ils n'ont pas été mal gérés, ils étaient faux dès l'entrée. On ne répare pas une mauvaise
sélection avec une bonne sortie.

## Contre quoi se mesure-t-on ? Le test décisif

L'espérance en R compare le scanner à zéro. Ce n'est pas la bonne référence. Les deux vraies
questions sont : bat-on l'indice, et si oui, où se perd le gain entre le choix du titre et le
trade publié ? Décomposition sur les 85 mêmes signaux, fenêtres identiques :

| | Rendement/trade | IC95 |
|---|---|---|
| a. Achat à l'ouverture, tenu tout l'horizon | **+0,72 %** | [−0,56 ; 1,99] |
| b. Achat à l'ouverture, stop + cible | +0,21 % | [−0,92 ; 1,34] |
| c. Achat en zone (`entry_high`), tenu | −0,28 % | [−1,48 ; 0,92] |
| d. **Publié** : zone + stop + cible | −0,32 % | [−1,44 ; 0,79] |
| **SPY, exactement les mêmes fenêtres** | **−0,46 %** | [−0,68 ; −0,24] |

**Le marché n'était pas porteur sur ces fenêtres** : SPY perd 0,46 % et n'est positif que 21 %
du temps. Les titres retenus, eux, rendent +0,72 % tenus, et **58 % battent SPY** sur leur propre
fenêtre. Alpha de sélection : **+1,18 %** [−0,10 ; +2,45] — le signal positif le plus fort de
tout le jeu de données, à la limite de la significativité.

Décomposition entrée/sortie, à 2×2 :

| Effet isolé | Impact | IC95 | |
|---|---|---|---|
| **Entrée** (ouverture − zone), sans gestion | **+1,00 %** | [0,71 ; 1,28] | **significatif** |
| **Entrée** (ouverture − zone), avec gestion | **+0,54 %** | [0,12 ; 0,95] | **significatif** |
| Sortie (tenu − géré), entrée ouverture | +0,51 % | [−0,25 ; 1,26] | non |
| Sortie (tenu − géré), entrée zone | +0,04 % | [−0,63 ; 0,72] | non |

C'est le **seul effet significatif de toute la revue, et c'est l'entrée** — pas la sortie.

### Nuance qui empêche d'en faire un scandale

Une part majoritaire de cet écart vient de la **convention de mesure**, pas d'une perte réelle.
En ne changeant QUE le prix de remplissage, gestion identique :

| Remplissage | Rendement/trade |
|---|---|
| Haut de zone (convention publiée, « pire prix autorisé ») | −0,32 % |
| Milieu de zone | **+0,02 %** |
| Bas de zone | +0,36 % |

La zone ne fait que **0,79 %** de large en médiane. Un exécutant qui remplit au milieu est donc à
l'équilibre, pas en perte. La convention du pire prix est saine pour auditer — elle ne doit pas
être confondue avec une mesure de ce que le lecteur obtient.

Ce qui reste après cette correction : 64 entrées sur 85 sont au-dessus de la clôture de
référence. Celles au-delà de +0,5 % rendent −0,81 %, celles en-dessous +1,15 % (intervalles
larges et chevauchants — direction, pas preuve). C'est le **chase**, et `validate-scan.js` s'en
inquiétait déjà par écrit sans jamais pouvoir le mesurer.

## Ce qui fuit : la conversion, pas le choix

### Le score : sans information, et toxique seulement en interaction

Mesuré sur le **R éditorial** (stop 1,5×ATR, cible 1,5×ATR, horizon 10), l'espérance décroît de
façon monotone quand le score monte :

| Bande de score | n | Espérance | Taux de gain |
|---|---|---|---|
| < 85 | 21 | **+0,159R** | 57 % |
| 85–89 | 13 | −0,045R | 46 % |
| 90–94 | 43 | −0,118R | 40 % |
| 95–100 | 8 | **−0,185R** | 38 % |

Corrélation score / R éditorial : **−0,062**, monotone décroissante sur quatre bandes.

Mais mesuré sur le **rendement brut à terme**, sans stop ni cible, le score ne porte
**aucune information** — à aucun horizon :

| | J+1 | J+3 | J+5 | J+10 |
|---|---|---|---|---|
| Corrélation score / rendement | −0,108 | **−0,004** | +0,037 | +0,016 |

À J+3, la bande `<85` rend +0,40 % et la bande `≥90` +0,28 % : écart de 0,12 pp,
IC95 [−1,12 ; 1,36]. Rien.

**La chaîne causale n'est donc pas « le score prédit la baisse ».** Elle est : le score
sélectionne des titres étendus et volatils (RSI > 65 et ATR > 4 % sont les pires bandes) ;
confrontés à une géométrie symétrique et serrée de 1,5×ATR, ils touchent le stop avant la cible
plus souvent ; le R éditorial se dégrade. C'est une interaction **score × géométrie**, pas un
pouvoir prédictif inversé.

Conséquence pratique, et elle est importante : le défaut est **spécifique à la publication
éditoriale** (horizon 10, géométrie 1,5×ATR). Il ne se transporte pas aux modes, qui tiennent
3 à 4 jours avec leurs propres sorties.

**Le score reste néanmoins impropre à ce qu'on lui fait faire** : on le présente au lecteur comme
une hiérarchie de conviction alors qu'il ne discrimine rien. C'est un défaut de conception
indépendant de toute significativité.

Même direction sur les deux autres axes :

- **RSI au scan** : < 50 → +0,110R · > 65 → −0,128R
- **ATR en % du prix** : < 2 % → −0,010R · > 4 % → −0,117R

On sélectionne pour l'extension et la volatilité, et ces deux traits sont associés à de moins
bons résultats. Les garde-fous `overextension` existants (RSI ≤ 72, distance MM50 ≤ 20 % en
Momentum, ≤ 25 % en Breakout) sont très au-dessus de la zone où les résultats se dégradent.

### Breakout est le poste le plus coûteux

| Stratégie | n | Espérance | Stop | Cible | Horizon |
|---|---|---|---|---|---|
| Pullback | 8 | +0,252R | 13 % | 50 % | 38 % |
| Momentum | 52 | −0,055R | 35 % | 29 % | 37 % |
| **Breakout** | **22** | **−0,220R** | **55 %** | 27 % | 18 % |

23 des 25 Breakout ont leur entrée au-dessus de la clôture de référence : on achète la cassure.
Un stop sur 1,8. Retirer Breakout fait passer l'ensemble de −0,045R à **+0,016R**.

`data/scanner-filters.json` interdit déjà Breakout en régime EARLY RISK-OFF et RISK-OFF
(`max_count: 0`). La mesure suggère que le problème n'est pas le régime mais la stratégie.

## Ce que le changement du 10 août a réellement fait

La bascule `tp1_reachability` (cible ramenée à 1,5×ATR) est **le seul changement du mois qui a
aidé** :

| Période | n | Espérance | Gain | R/R médian | Stops | Horizon |
|---|---|---|---|---|---|---|
| Avant 10/08 | 38 | −0,181R | 34 % | 1,56 | 42 % | 45 % |
| Depuis 10/08 | 47 | **+0,065R** | 53 % | 0,93 | 32 % | 23 % |

Effet secondaire à connaître : le stop s'est resserré en même temps (1,78 → 1,50×ATR médian), si
bien que le R/R affiché est tombé à ~1,0. Sur le papier c'est un mauvais ratio ; en pratique il
est plus que compensé par le taux de gain, passé de 34 % à 53 %. **Ne pas revenir en arrière** en
lisant le seul R/R.

## Le régime : deux moteurs, quatre unités, zéro réconciliation

Le scanner collecte **deux** sources de régime en vague 1 et n'en compare aucune. En août elles
ne parlaient pas la même langue :

| Source | Clôture du 04/09 | Échelle |
|---|---|---|
| `DtxRegime` (systematic) | `RISK_ON`, 0,79 | 0–1, haut = risk-on |
| `GetMarketContext` (marketdata) | `risk_on`, 0 | 0–100 défensivité, *0 = plein risk-on* |

Deux chiffres opposés pour le même état. Et le champ publié a changé d'unité **quatre fois en
un mois** : `0.81` le 21/08, `81` le 24/08, `0.562` le 25/08, `79` à partir du 27/08.

`regimeScoreScale` existait pour documenter l'échelle, mais c'était du **texte libre**, et
`validate-scan.js` **devinait** l'échelle quand le champ manquait. Un `0.81` déclaré
`"0-1 (1=risk-on, systematic)"` était lu comme un score bullish sur 100, donc RISK-OFF.

### Deux scans sont partis en production en violant une règle bloquante existante

```
20260821 → regime_score_coherence : label "RISK-ON" vs score 0.81 lu comme RISK-OFF
20260825 → regime_score_coherence : label "RISK-ON" vs score 0.562 lu comme RISK-OFF
```

La règle date du **18/06**, `entry_strategy_coherence` du **19/07** ; ces scans ont été commités
les **25 et 29/08**. Le gate `validate-scan.js`, déclaré bloquant par le contrat de commande, a
donc été sauté ou son échec ignoré. C'est le constat le plus grave de cette revue : les
garde-fous fonctionnaient, on est passé outre.

*Nuance importante, dans l'autre sens :* les 44 violations que `20260901` affiche aujourd'hui
sont **toutes** des `*_artifact_evidence` pointant vers `scanner/20260901/_final/`, un staging
que la règle de publication interdit précisément de commiter. Ce n'est pas un scan défectueux,
c'est un validateur non rejouable après coup — défaut réel, mais d'une autre nature, et à ne pas
confondre avec les deux cas ci-dessus.

### Corrigé dans cette passe

- `regimeScoreScale` devient un **énuméré fermé** (`bullish_0_100`, `bullish_0_1`,
  `defensiveness_0_100`), l'absence de déclaration est bloquante, l'heuristique de devinette est
  supprimée. Grandfathering via `scale_enum_active_from` pour ne pas rejuger l'archive.
- `tools/regime-reconcile.js` : systematic fait autorité (`source-policy.md` §1), marketdata
  devient contradicteur, désaccord de label ou écart > 15 pts = refus. Il bloque aujourd'hui.
- L'autorité et sa raison sont inscrites dans `data/scanner-filters.json` plutôt que dans une
  tête.

L'argument décisif pour l'autorité n'est pas la qualité du signal mais l'**auditabilité** :
`DtxRegime` est rejouable point-in-time (`asof`, `expected_data_date`, `sessions_behind` — vérifié
en rejouant le 14/08), la facette marketdata est current-only. Une source qu'on ne peut pas
réauditer après publication ne peut pas soutenir un article.

## Ce que je propose

Deux catégories, à ne pas confondre.

### Solide — à faire

1. **Instrumenter en continu.** `tools/signal-outcomes.js` est livré. Le brancher en fin de
   pipeline scanner et publier l'espérance glissante sur `scanner/status`. Sans ça, la prochaine
   dérive prendra encore un mois à se voir.
2. **Retirer le score /100 de la carte publiée, ou le recalibrer.** Publier une hiérarchie
   anti-corrélée aux résultats est le défaut le plus grave de cette revue — il induit le lecteur
   en erreur sur la conviction relative.
3. **Passer Breakout en observation** (généré, mesuré, non publié) jusqu'à ce que son espérance
   repasse positive sur 40 lignes.
4. **Alléger le cérémonial d'entrée.** La zone, le gate VWAP et `conditional_next_session` ne
   produisent rien de mesurable. Les garder tels quels revient à vendre au lecteur une précision
   qu'on n'a pas.

### Fragile — à mesurer avant d'appliquer

Tout ce qui suit repose sur n < 100 et des IC qui enjambent zéro. Les appliquer maintenant serait
du sur-ajustement, et la règle `Config Change Backtest` du dépôt l'interdit :

- resserrer `overextension` vers RSI ≤ 65 et distance MM50 ≤ 6 % ;
- ajouter un time-stop J+3 (seule variante de sortie non dégradante, +0,043) ;
- rééquilibrer vers Pullback, meilleur seau mais n = 8.

Voie de validation : laisser tourner l'instrumentation, réévaluer à 200 lignes scellées, puis
passer par `validate-config-change.js` en régime-aware comme l'exige
`feedback_regime_aware_eval`.

## Limites de cette revue

- 85 signaux déclenchés à horizon écoulé : aucune conclusion n'atteint le seuil de significativité
  à 95 %. Les motifs monotones (score, RSI, ATR) sont plus informatifs que n'importe quel IC isolé,
  mais ils ne sont pas des preuves.
- Barres journalières uniquement : la séquence intrajournalière est inconnue. Convention
  conservatrice retenue (stop avant cible le même jour), ce qui sous-estime légèrement les
  résultats de façon homogène sur toutes les politiques comparées.
- Le gate VWAP publié n'est pas testable sur des barres journalières ; son effet réel reste inconnu.
- Un mois, un seul régime dominant (RISK-ON). Rien ici ne dit comment le scanner se comporte en
  régime dégradé.
