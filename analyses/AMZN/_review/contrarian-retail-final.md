# AMZN — revue contrarienne et retail AQ‑1.1

## Périmètre gelé

- Dossier : `data/analyses-data/AMZN.json` — `bf809f050b74bb5c60951de6b56d2f1b22afcd49988e1bfc7210a1171cc1a720`
- Preuves : `data/analyses-evidence/AMZN.json` — `cedf2e61912c080517b3a89ffe36ae6e2d894a0db77939157408f7a861da3024`
- Calculs : `analyses/AMZN/_data/calculations.json` — `97cf32a6591c2fb498d1b5f8f1f81a38e8e504cb0f9ec1a7b0024ddb21d8922c`
- Preview : `analyses/AMZN/_review/preview/index.html` — `d9d56b1b54383ef05ecdfe9932245175161b3cec281a8b977327705dd01aaa1b`
- Documents SEC : `analyses/AMZN/_review/primary-sec-manifest.json` — `fdbb0f268311354f7c4f1f7b5d49ab88c7407938d35a0b60c83cd599dfff84a4`

## Contrôles vérifiés

`validate-analysis-evidence` valide 323 claims. La pré-revue éditoriale stricte, `render-analysis --dry`, `qa-content` (29/29) et `check-ai-tells` passent sur le gel. Les 38 décisions AQ‑1 figurent avec leurs raisons et renvois dans [contrarian-retail-final.json](contrarian-retail-final.json).

Le delta depuis le gel précédent est contractuel : les impacts d’actualité sont désormais des enums `neutral` et leur prose est conservée dans `detail`; le financement et les limites de dilution sont dans `shareHistory` avec `dilutionRisk: unknown`; le régime `risk-on` est borné au snapshot courant; le risque est correctement 6/10; la série de surprises est exactement deux après le léger manque T4. Les trois claims retirés correspondaient au champ non prévu `blastRadius.reference`; aucun chiffre primaire ou conclusion de source n’a été ajouté.

## Verdict

**PASS — 88/100.** Les résultats, la guidance, les réévaluations privées, le capex/FCF, l’engagement OpenAI, le 424B5 de dette sterling préliminaire et les limites d’actions sont reliés aux sources primaires. La valorisation reste une lecture GAAP et une sensibilité explicitement hypothétique; le statut est `watch`, avec niveaux historiques non exécutables.

Limites qui restent déclarées : date de résultats officielle non confirmée, séries OLS incomplètes pour MSFT et COST, snapshots fournisseur parfois sans période, et sentiment social indisponible. La capture navigateur présente est liée au preview antérieur et n’est pas utilisée pour attester ce hash; elle doit être remplacée par la vérification visuelle finale séparée.
