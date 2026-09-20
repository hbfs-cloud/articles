# Revue Senior QA + Contrarian — weekly 20260921

**Verdict : PASS** — snapshot local contrôlé sans refetch. Aucun blocker factuel, causal, de qualité de données ou de rendu n’est ouvert sur l’artefact ci-dessous.

## Snapshot attesté

| Artefact | SHA-256 |
|---|---|
| `index.html` | `981787d010fc77c11179dc6e83443d41913789c9b4aa1dee36877502a4dc9ada` |
| `_data/claims.json` | `0c89f1346b5978834756ed8ab0918ac05a3478b43cd9b1837aa628050fd23a14` |
| `_data/harness.json` | `50d891950a904a3819cfc264ce0b9aa351ee6d011460ecc081286ffc2c4bba7b` |
| `_data/selection.json` | `ff96e9f14b859fd6bc90e8964117db73b3cb367b39f0b96717fd309ce093e5eb` |
| `_data/chart-data.json` | `4f113e69404c685f446559161b9f00c3bf4adcbb48c3ef0c1824480b498bbc79` |
| `_focus/harness.json` | `922ec00147472b2872b05fd04b88f34cebee4f2aeaf861dce03ad2fee1da315b` |
| `_focus/focus_events.json` | `eb3d16f211829f77170638f1ec8d6b2b5a68f83a1e8a17249a0e535d902fe4d5` |
| `_focus/chain_reactions_a.json` | `0117e10edf5a9597604287e0897a9beecb63d200d91bf6a2386c4a72b79f2cfa` |
| `_focus/chain_reactions_b.json` | `13c0458e1eaa9384bc32bd9ec9ffbb2579f70e886e8f420477b62400107ae936` |
| `_focus/blast_bars_a.json` | `679d6b7be7cef7f7283de083a714614b6b7259487a6d997439cbf10688f6184c` |
| `_focus/blast_bars_b.json` | `32b7a8e284723f9b234d3abf7e01a4c1e9c8146e7235f945ada7a186dac1b819` |

## Contrôles

- Les deux harnesses sont frais et les deux run-plans valident. Les sources obligatoires sont closes au 18 septembre 2026 quand une clôture est requise.
- `validate-content-claims` passe : les 78 claims de l’article sont uniques, présents une fois dans le HTML, hashés, et leurs pointeurs résolvent à la valeur déclarée.
- Le calendrier décisionnel ne contient plus l’item obsolète du 17 septembre : ses quatre cartes, désormais intitulées en français, pointent vers les 23, 24 et 25 septembre. Les prises de parole Fed non confirmées par le calendrier officiel sont exclues et cette divergence est explicitement signalée.
- La sélection justifie correctement COST : unique catalyseur systémique au-dessus de 250 Md$ dans le filtre, date du 24 septembre après clôture, avec échéance options postérieure. CTAS est un second focus, pas une substitution de leader.
- Le rayon de propagation est causalement lisible et non cosmétique : quatre comparables/distributeurs (WMT, KR, DG, DLTR) et quatre fournisseurs/produits de consommation (PG, PEP, CAG, KO), séparés dans les lots A/B et couverts chacun par barres et réactions en chaîne.
- L’anomalie COST est correctement contenue : la barre du 21 août est reconnue, les niveaux/ATR longs sont absents, la décision est `no_setup`, et le graphique COST/CTAS ne commence qu’au 11 septembre. Aucun calcul visible n’absorbe l’outlier à 14 610.
- Aucun fait chiffré visible n’est non sourcé. Les scénarios sont conditionnels et explicitement qualitatifs; les sources insuffisantes (XLE, corrélation longue GLD, historique COST) sont exclues, sans remplacement ni faux zéro.
- La simplification de vocabulaire ne modifie ni le mécanisme ni l’invalidation. Le max pain CTAS a été retiré, avec son claim : aucun vestige ne le transforme en cible implicite.
- Présentation : 18 sections, 9 ECharts décisionnels et une navigation flottante à six entrées. `qa-content --strict`, hiérarchie, horizon-risk et contrôle anti-tics passent; aucun blocker de structure ou de design n’a été trouvé.

## Notes non bloquantes

- Le jugement géopolitique est volontairement abstentionniste car le snapshot ne documente pas de catalyseur gouvernant. Cette sobriété est préférable à une causalité inventée.
- Une modification ultérieure du calendrier officiel ou une nouvelle clôture impose une nouvelle collecte et une nouvelle attestation; elle ne peut pas hériter de ce PASS.

## Vérifications exécutées

`check-freshness` sur les deux harnesses, les deux validations de run-plan, `validate-content-claims`, `validate-horizon-risk`, `qa-content --strict`, `check-ai-tells --strict` et `validate-content-hierarchy` : tous **PASS**.
