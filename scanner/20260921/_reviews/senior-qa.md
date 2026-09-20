# Revue Senior QA — scanner 20260921

**VERDICT : PASS**

**Blockers : 0.** Revue locale du snapshot final, limitée à la publication scanner et au pont DTX informationnel. Aucun appel MCP, ordre, accès broker, action LIVE ou modification d’un artefact scellé n’a été effectué.

## Gel et provenance

Snapshot audité : `scanner/20260921/_reviews/snapshot.json` — SHA-256 `442cd9f585c92d6e949dab747418f196fb298897ccf90b1d92368d66d5ad0adc`.

Les **16/16** artefacts déclarés par ce snapshot correspondent exactement à leur SHA-256 et leur taille : `signals.json`, `data.json`, `index.html`, manifest/scope/exclusions, univers, sélection et preuves fondamentales, risk/fortress, le pont `data/dtx/etf_us.json`, les orders `best` et l’historique de statut. La chaîne de provenance est donc cohérente avec le gel du 20 septembre pour la séance du **2026-09-21** et la clôture de référence du **2026-09-18**.

La comparaison avec l’ancien blob Git `cc93778f…` confirme que la révision de `index.html` ne contient que deux normalisations de whitespace : la ligne 84 passe de deux espaces à vide et un newline est ajouté en fin de fichier. Les 385 lignes logiques sont identiques après `rstrip`; le bilan est de −1 octet, de l’ancien SHA-256 `4f6ec61b…` au SHA-256 scellé `91af45227f3e41b4c5ac87d5f97c44a46ad2f5212eb2b8b76e9b768250595411`. Aucun niveau, texte, donnée ou comportement du scanner n’est modifié.

Le schéma est `dailytickers.scanner-review-snapshot.v2`; il déclare explicitement un périmètre sans broker, compte, ordre ou changement de configuration LIVE. Les sources aval gardent la même provenance DTX : request `scanner-20260921-etf-us-evening-001`, run `run-cc53b6d8a9b1e4d123dbc61e`, call `call-f259e1950f98ad52f1dfcb30`, données attendues et reçues au 2026-09-18.

## Scanner éditorial

`signals.json` contient exactement **9** setups : QRVO, EBAY et DGX (Breakout); IFF, SEIC et AWK (Pullback); RVTY, PDBC et IBIT (Momentum). Les neuf ont `earnings_clear=true`, `dilution_clear=true` et un ordre éditorial `limit_order_single_price`; leur gate interdit la poursuite au-dessus du prix, le report et toute transformation en ordre au marché. La composition est sept actions US et deux ETF US.

Les gates déclarés dans le snapshot sont tous PASS : workflow scanner, deux harnais de fraîcheur, validation scan (9), horizon/risque, AI strict, qualité scanner, scope (9/9), contenu DTX, tests MCP daily bars et QA strict (0 erreur, 6 avertissements déclarés). Les limites connues restent explicitement non bloquantes pour cette revue : exclusions documentées dont NBTX, ainsi que les avertissements globaux de fraîcheur radar/benchmark/ancien live-track, OpenAPI et navigateur local.

## Pont DTX : contrat, mapping et fenêtre

Le mapping est cohérent de bout en bout : le mode public **`best`** consomme le portefeuille moteur **`etf_us`**. La décision `scanner/20260921/_dtx/decide_etf_us.json` est un **Contract V2.0**, avec `requested_asof`, `expected_data_date` et `data_asof` tous au 2026-09-18. Elle crée sept candidats informationnels `etf_us` — AWAY, BSOL, CRPT, MSST, MSTY, SSK et TSOL — que `data/dtx/etf_us.json` relaie sans ajout, suppression ni modification de niveau.

La fenêtre est bornée au **2026-09-21 13:30:00Z–19:55:00Z** (09:30–15:55 America/New_York). Avant cette fenêtre, `portfolio/v1/best/orders.json` et `scanner/status/history/20260920.json` contiennent chacun **0 order**; le statut historique reprend la même provenance, la même fenêtre et une liste `orders` vide. Les sept créations sont donc des candidats staged/informationnels, pas des ordres émis.

Les protections et le downstream sont traçables : les sept limites portent un stop engine-managed à 80 % du prix d’entrée, les groupes `slot-01` à `slot-07` sont distincts, les cancels/updates sont vides, et le statut aval porte encore `orders: []`. Le résumé de risque du moteur décrit 7 créations, 99,94 % de notionnel potentiel et 19,99 % de risque théorique jusqu’aux stops; il ne constitue ni un fill ni une autorisation d’exécution.

## Décision

PASS pour le snapshot publié et son bridge DTX **informationnel** : schéma, hashes, sélection, gates, Contract V2, fenêtre, mapping `best` ↔ `etf_us` et surfaces downstream sont cohérents. Ce PASS ne transforme pas les candidats staged en opérations broker/LIVE.
