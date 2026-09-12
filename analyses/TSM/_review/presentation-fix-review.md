# Revue de présentation — correctif TSM

Date de contrôle : 2026-09-12. Portée : le diff de `tools/render-analysis.js` et le rendu
`analyses/TSM/index.html`, sans réexécuter de collecte ni modifier la thèse.

**Verdict : PASS (présentation seulement).** Le nouveau rendu supprime bien la section et
l'entrée de navigation sociales quand les seules valeurs sont des placeholders explicitement
indisponibles. Les données et la thèse restent inchangées.

## Contrôles passants

- La matrice de couverture est maintenant un vrai `<table class="coverage-matrix">` dans le
  HTML ; le contenu des 23 lignes est identique à l'échappement antérieur et aucun fait ou
  chiffre de la thèse n'a été modifié.
- La correction de libellé du bloc de comparaison enlève la liste spécifique `AVGO / QQQ /
  SOXX` non soutenue par le tableau, sans modifier les séries ni les conclusions.
- Les colonnes de propagation sont maintenant `Corrélation`, `Bêta` et `R²`, conformes à la
  méthode réellement décrite : OLS des rendements logarithmiques du comparateur sur TSM,
  `beta=covariance/variance`, `R²=corrélation²`. Elles ne prétendent donc plus être des
  mesures « hors QQQ » ou résiduelles.
- `node tools/qa-content.js analyses/TSM/index.html --strict` : 29 PASS, 0 avertissement,
  0 erreur. `node tools/check-ai-tells.js analyses/TSM/index.html --strict` : PASS (4 770 mots).
- `socialPlatforms()` exclut uniquement une ligne dont `trend` est `indisponible`/`N/D` (ou
  équivalent) **et** dont `mentions` commence par ce même placeholder. Une donnée réelle à
  zéro est donc conservée. Le HTML TSM courant ne contient ni `#social` ni `href="#social"`;
  la matrice de couverture conserve séparément la déclaration d'indisponibilité.

## Observation sur la jauge de risque

`#riskGaugeChart` est encore rendu avec la valeur éditoriale `riskScore: 6`. Ce n'est pas une
valeur zéro issue d'une facette absente et il n'y a pas de radar de risque vide (`riskRadarValues`
est absent). La valeur correspond au jugement éditorial déjà revu, avec ses risques et signaux
observables affichés à côté; elle ne constitue donc pas une jauge issue de données manquantes.

## Empreintes du contrôle

- HTML courant : `d055ee514498e42204a49d8204d77d59240a7af89637708eadfce7d16d7e8ef5`
- Données TSM : `8c8a6c8c7a6af7a0eb210636c91ad715f877be17bffdd24f86bd9ce8fd4ad574`
- Preuves TSM : `a89ddde51e070f7662ad526046155a75b71c0fbff644827e5aa04cb7f1ffb868`
