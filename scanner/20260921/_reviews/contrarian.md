# Revue contrarian — scanner 20260921

**VERDICT : PASS**

**Blockers : 0 dans le périmètre du snapshot.** Ce verdict valide la traçabilité et l’honnêteté de la publication/scanner informationnelle; il ne valide ni une performance investissable ni une exécution réelle.

## Intégrité et périmètre

Snapshot audité : `scanner/20260921/_reviews/snapshot.json` — SHA-256 `442cd9f585c92d6e949dab747418f196fb298897ccf90b1d92368d66d5ad0adc`. Les **16/16** hashes et tailles référencés correspondent aux artefacts présents. La revue n’a pas rejoué MCP, émis d’ordre, appelé de broker ni changé une configuration LIVE.

La comparaison avec l’ancien blob Git `cc93778f…` établit un diff exclusivement whitespace de `index.html` : deux espaces supprimés sur la ligne 84 et ajout du newline EOF. Les 385 lignes logiques sont identiques après `rstrip`; le fichier perd un octet et passe de SHA-256 `4f6ec61b…` à `91af45227f3e41b4c5ac87d5f97c44a46ad2f5212eb2b8b76e9b768250595411`. Il ne peut donc pas expliquer une variation de sélection, de niveaux, de gates ou de performance.

La décision est correctement qualifiée dans le snapshot comme **pilot/research**, sortie scanner informationnelle, sans autorisation broker/live. Cette restriction est matériellement corroborée avant la fenêtre du 21 septembre : `portfolio/v1/best/orders.json` et `scanner/status/history/20260920.json` contiennent chacun zéro ordre, malgré sept créations staged dans le plan Contract V2.

## Performance : écart à ne pas masquer

Le replay MCP de `etf_us` couvre 2021-01-01 à 2026-09-18 et affiche **CAGR 37,21 %**, **drawdown maximal 23,48 %**, **Sharpe 1,43** et **2 580 trades**. Ce n’est pas la performance scellée du suivi public : l’historique `best` indique **−1,61 % réalisé sur 6 trades**. Les deux séries ont des horizons, méthodes et tailles d’échantillon incompatibles; les présenter comme une même preuve de rendement serait matériellement trompeur. Le snapshot les sépare explicitement, ce qui évite un blocker de publication, sans lever le risque de modèle.

## Concentration, taille de perte et exécution

Les sept lignes DTX — AWAY, BSOL, CRPT, MSST, MSTY, SSK, TSOL — sont concentrées dans des expositions crypto-liées ou thématiques/levier. Les sept sont des BUY LIMIT `etf_us`, avec des stops catastrophe uniformes à **−20 %**. Le résumé de risque V2 quantifie 99,94 % de notionnel potentiel et 19,99 % de risque théorique jusqu’aux stops sur une base 100 000 USD.

Cette géométrie ne limite pas le risque de gap : le stop engine-managed n’est pas requis avant fill, le délai post-fill prévu est de cinq secondes, et les champs `gap_up_pct`, `gap_down_pct` et `max_slippage_bps` sont à zéro. Une ouverture discontinue, une liquidité déficiente ou un glissement peut donc réaliser une perte plus forte que le niveau théorique. C’est un risque économique grave, mais pas un blocker de ce gel car les lignes sont explicitement informationnelles, aucune taille n’est exécutée et les surfaces d’orders demeurent vides avant la fenêtre.

## Drifts et réserves non corrigés

Le snapshot déclare **cinq drifts de parité de configuration Go-to-articles**, conservés comme avertissements; aucune correction du risque LIVE/broker n’a été faite. Ils restent à traiter en amont de toute prétention à une parité opérationnelle, même s’ils ne modifient pas les données datées du scanner. Restent aussi déclarés : données radar/benchmark/ancien live-track obsolètes, un manque documentaire OpenAPI et indisponibilité de Chrome local. Aucun de ces avertissements ne falsifie le snapshot hashé; chacun interdit toutefois d’élever ce PASS au rang de validation d’exécution.

## Décision

PASS uniquement parce qu’aucun blocker n’affecte le snapshot, ses hashes, son statut pilot/research ou son absence d’orders avant la fenêtre. Le replay, la concentration thématique/crypto, les stops à −20 %, le gap/slippage et les cinq drifts non corrigés demeurent des réserves substantielles, non des résultats de trading réalisés.
