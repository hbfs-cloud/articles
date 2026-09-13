---
name: zero-euro-data-stack-brevan-howard
description: Document HOME « spec stack de données à 0 € » + dossier forensic Brevan Howard — apporte une règle de décision pour tout dataset/signal et une recette TCA gratuite complète ; n'apporte aucun alpha.
type: reference
---

Fichier : `~/zero-euro-data-stack-spec.html` **et** `~/brevan-howard-forensic-knowledge-base.html`
— byte-identiques, SHA-256 `8335a7626dc9e36959e5181ff395199491d33ec47d70709177b6e392c443f96e`
(un seul document enregistré sous deux noms). 83 titres, deux parties.

**Ce qu'il apporte vraiment :**
1. §20 *Règle de décision économique* — un dataset ou un signal n'est conservé que s'il (a) apporte
   une information absente des autres features, (b) reste utile avec son vrai délai de publication
   et ses coûts, (c) améliore le portefeuille hors échantillon. « Le nombre de sources n'est jamais
   un objectif. » À substituer au gate « backtest 30 jours ».
2. Recette TCA gratuite : `arrival_slippage_bps`, `implementation_shortfall_bps`,
   `vwap_slippage_bps`, `markout_1m/5m/30m`, `fill_rate`, `participation_rate`,
   `cost_by_time_of_day`, `cost_by_order_size`. « Avant de chercher un signal complexe, enregistrer
   chaque ordre. »
3. Contrôles : rien avant son `release_time`, splits/rolls traités, UTC + timezone de marché,
   quote vs trade vs prix synthétique séparés, backtest avec frais/spread/slippage/latence/liquidité,
   train/validation/période finale intouchée, stabilité par année, secteur, capitalisation, régime.
4. Signaux à tester en premier — ceux qui coûtent zéro chez nous car la donnée est déjà collectée :
   séparation overnight/intraday, positionnement options autour des strikes concentrés (max pain),
   short interest + volume hors carnet. Les flux ETF demandent une source qu'on n'a pas.

**Ce qu'il n'apporte PAS :** aucun alpha. Le document dit lui-même qu'aucun résultat audité ne relie
un fournisseur à un Sharpe ou à un P&L net, et que le code local prouve une surface d'intégration,
pas une stratégie. Plan d'ingénierie, pas stratégie à copier. Voir
[[scanner-execution-not-certified]].
