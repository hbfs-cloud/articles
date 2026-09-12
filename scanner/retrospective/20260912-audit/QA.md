# Audit de la rétrospective — référence 11 septembre 2026

**PASS pour publication de l’analyse méthodologique et des trajectoires hypothétiques.**
Aucune certification d’exécution ni de performance de portefeuille n’est délivrée.

## Conclusion vérifiée

Les six publications exigeaient une confirmation VWAP que le simulateur ne rejouait pas.
Les 17 propositions des deux derniers scans portent explicitement un VWAP observé nul ;
aucune confirmation horodatée n’est attestée. Cela ne prouve pas qu’aucun trade n’a eu lieu.
L’allocation automatique des deux derniers paniers était rejetée dans les publications originales.

Les 56 propositions et leurs niveaux sont conservés. Les 23 issues mûres du modèle de niveaux
restent à -0,295 R moyen et PF 0,60 ; 95,9 % de la perte nette vient du lot du 24 août.
Sans ce lot, le modèle reste légèrement négatif. Le Pullback dépend fortement de FTNT.
Les gaps et les coûts aggravent le déficit sans l’expliquer entièrement. Aucun filtre VWAP,
seuil optimisé, portefeuille ou lien causal rentable n’est inventé.

## Contrôles et portée

- Deux revues indépendantes Senior/Contrarian et Retail/Data : PASS sur les cinq empreintes ci-dessous.
- Réconciliation des 56 lignes, 32 entrées hypothétiques, 23 issues mûres, 24 no-fill et 27 horizons non mûrs.
- Nouveau calcul identique à la version completed pour tous les outcomes et agrégats, hors timestamp
  de génération et métadonnées de provenance/mode. La QA numérique `qa-retro` de cette base passe.
  La nouvelle page est un audit narratif : elle n’utilise pas le format de tables de `qa-retro`.
- Quatorze références de sources, signaux, cohortes et résultats : empreintes recalculées conformes.
- Tests du garde d’exécution, mutations de certification/disclosure, normaliseur intraday et supplément : PASS.
- `validate-workflows --workflow retro` : PASS, deux plans sources existants validés.
- `validate-article`, `qa-content --strict` (22 contrôles) et `check-ai-tells --strict` : PASS.
- Chrome 1440/390 : zéro débordement, erreur JS, ancre cassée ou tableau non enveloppé ; texte 16px.
  Inspection visuelle desktop/mobile et capture finale liée au SHA HTML ci-dessous.
- Filtre QA du workflow CI et référence du hook corrigés pour inclure les sous-dossiers de rétro.
  Contrôle des chemins publics et exclusion des descendants privés : PASS.
- Le contrôle content-ux global conserve l’échec préexistant du cachebuster tech/track-record ;
  aucun succès global n’est revendiqué.

## Correction durable

`build-period-retro.js` exige désormais `--levels-only` et déclare `execution_certified:false`.
Le rendu futur signale les conditions d’activation non vérifiées ; la QA refuse une certification
positive ou l’absence de cette information. Ce garde ne calcule pas le VWAP et ne reconstitue pas
une autorisation historique manquante. La commande rétro documente cette limite.

Les publications 20260912 et 20260912-completed restent intactes. Les données brutes et rapports
internes demeurent hors publication. Aucun réglage de stratégie, broker ou allocation n’a été modifié.

## Empreintes finales

| Fichier | SHA-256 |
|---|---|
| index.html | `6599efe68154ac6faae2ab6acdb235bcdf5fcbb42c18943a6059bd5950d5ba19` |
| retro-results.json | `5f46b62a7048ae796da0eaf9d29d11819dd23c98f0327605cca4271bfb6ebff9` |
| diagnostics.json | `6f4a452f1b5e8f9ed3255330ea5f77ece24cce7fd508b231c2afd2e92af4188e` |
| audit-findings.json | `449bdc7aab368597026dd64e252b49ed1c7f6a9bad32d226e66cceb3b6998102` |
| cohort-manifest.json | `b9dcfe61a348202396adb92f43b3dec93e1382387c5ab3fa827611830eac36be` |
