# AAOI — revue indépendante finale locale (19 septembre 2026)

## Verdict

**Clôture locale sous réserves de contrôle ; aucune AQ, aucune autorisation de publication et aucun ordre.**

Les corrections de la revue initiale sont présentes dans l'artefact courant : le dossier est
explicitement `no-trade`, les niveaux ne survivent que dans un panneau d'archive replié et libellé
« non exécutables », le scénario de valorisation est `non_applicable`, et les trois gates externes
restent visibles. Cette conclusion ne doit jamais être transformée en `PASS` de publication :
RankBeta est toujours HTTP 403, le calendrier CIEN est indisponible et le pont fully diluted au
18 septembre n'est pas réconcilié.

## Contrôles repris

- **Comparables et calculs.** Les 18 symboles affichés ont chacun une série distincte dans
  `comparison_bars.json` et sept claims reliés (les six métriques du blast radius et le rendement
  21 séances). Recalcul indépendant depuis les barres AAOI et pair : zéro écart sur corrélation,
  β `AAOI vs pair`, R², 124 observations et rendements 5/21 séances. La formule et la dépendance
  AAOI sont déclarées dans le sidecar. Ce sont des statistiques descriptives locales ; elles ne
  remplacent pas RankBeta.
- **Capital et primaires.** L'échantillon complet des chiffres affichés est exact : 84 906 289
  actions, 1 090 055 RSU, 629 463 PSU, ATM 600 M$, illustration 4 647 561 actions à 129,10 $ dans
  le 424B5; warrant Amazon de 7 945 399 actions à 23,6956 $, dont 1 324 233 exerçables et
  6 621 166 conditionnelles à 4 Md$ sur dix ans dans le 10-Q. La matrice les qualifie bien comme
  base/illustration historique ou instrument connu, sans les additionner à un dénominateur courant.
- **Archive.** Les niveaux proviennent du snapshot daté du 28 août, à la clôture de référence du
  27 août. Le contrat historique est présenté comme documenté, expiré et non rejoué. Le renderer
  affiche `AUCUN ORDRE ACTIF` et enferme les chiffres anciens sous le disclosure replié; aucun
  objectif, ratio rendement/risque ou stop historique ne sert de signal actuel.
- **EBITDA et valorisation.** `numeric-evidence.json` contient seulement
  `status: non_applicable` avec `NON_POSITIVE_EBITDA`; sa base est le champ EBITDA négatif
  hashé de `fundamentals.json`. Aucun EV, multiple, valeur des fonds propres, prix conditionnel ou
  downside n'est présent dans l'analyse ni le sidecar.
- **Snapshot contre calcul local.** EMA/RSI/ATR sont clairement des snapshots fournisseur et non
  des indicateurs recalculés. Les barres de 300 séances sont limitées à la continuité du close et
  aux rendements/corrélations locaux. Le short float affiche désormais 14,94 % avec sa date de
  règlement du 31 août, sans multiplication par 100; les RSU ne sont plus étiquetées `ATM`.
- **Rendu et lecture retail.** Le rendu sec est valide, sans tics IA; la version courante expose le
  profil de risque « Élevé » et sa justification. Les trois « Pourquoi acheter » sont devenus des
  arguments économiques conditionnels, assortis des réserves de commandes, rentabilité et cash.
  `core.js` exclut correctement les routes locales `_runs` du registre public, donc la bannière du
  contrat public expiré ne vient plus contredire cette révision locale.

## Réserve de contrôle à conserver

**P1 — les extraits SEC sont vérifiés dans cette revue, mais pas encore automatiquement par le
validateur.** Les claims capitalistiques pointent vers `claim_extracts` dans
`primary-manifest.json`. Le validateur vérifie le hash des cinq fichiers SEC et la présence des
artefacts, mais ne vérifie pas que chaque `line`/`needle` du manifest se retrouve réellement dans
le HTML primaire hashé. Un manifeste généré avec un extrait faux mais des fichiers primaires
inchangés peut donc passer le contrôle automatisé. Il faut ajouter cette vérification (document,
ligne/needle et valeur déclarée) et un test négatif avant de considérer la provenance SEC comme
cryptographiquement sémantique. Ce défaut ne contredit pas les chiffres AAOI revus ci-dessus,
contrôlés ici à la source.

Le test `validateValuationScenario` couvre bien le chemin relatif, le hash, le pointeur EBITDA,
les valeurs non numériques/positives et l'interdiction des sorties économiques. Dans le flux
complet, `validate-analysis-evidence.js` valide ensuite l'input `fundamentals.json` avec le
contrat de collecte : pas de contournement de source observé pour AAOI. Un test d'intégration
supplémentaire de ce chemin complet serait utile, mais n'est pas un écart de l'artefact courant.

## Vérifications exécutées

```text
node tools/validate-analysis-evidence.js analyses/AAOI/_runs/20260919-update/revision/evidence.json
PASS (240 claims)

node tools/test-analysis-valuation-evidence.js
PASS

node tools/render-analysis.js analyses/AAOI/_runs/20260919-update/revision/AAOI.json --dry
valid (AAOI, grade C+)

node tools/check-ai-tells.js analyses/AAOI/_runs/20260919-update/revision/index.html
no obvious AI tells
```

Ces passes attestent la cohérence locale et non une publication. RankBeta 403, CIEN indisponible
et fully diluted inconnu restent des conditions bloquantes pour toute AQ future.
