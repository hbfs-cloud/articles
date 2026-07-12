# Demande MCP marketdata — couvrir crypto (Binance) + Casablanca/BVC (à l'owner)

> Objectif : le MCP marketdata devient la **source unique** de toute la donnée marché. Deux classes
> d'actifs restent aujourd'hui hors MCP et forcent un fetch-direct local — on veut les rapatrier dans le MCP.
> Structure = les mêmes exigences que le brief EU (résolu v111) : énumération + OHLCV profond + screener +
> quote/secmaster + fraîcheur.

---

## Contexte

Après la résolution EU (v111), il reste **2 sources fetch-direct** dans nos scanners, faute de couverture MCP :
- **crypto** → aujourd'hui via l'API publique **Binance** (OHLCV) + un univers local `data/crypto-universe.json`.
- **casablanca (BVC)** → aujourd'hui via l'API **Bourse de Casablanca** + `data/casablanca-universe.json`.

Tant que le MCP ne les couvre pas, ces 2 scanners ne peuvent pas passer MCP-primary. Dès que les critères
ci-dessous sont remplis, on bascule et on supprime le fetch-direct + les univers locaux.

---

## A. CRYPTO (Binance) — ce qu'il faut dans le MCP

Le MCP expose déjà un type `crypto` (market-level) et `RunScreener(asset='crypto')` — **à confirmer/compléter**
pour un usage scanner de bout en bout :

1. **Énumération de l'univers crypto** : lister les paires tradables (au moins USDT/USD majeures + mid-caps),
   avec un identifiant symbol stable. Critère : un appel d'énumération renvoie ≥ N paires (ex. top 100-200 par
   volume) avec leur symbole.
2. **OHLCV profond + frais** : `QueryData(symbols=<paire>, types=bars_daily, days=1500)` → **2-3 ans**
   d'historique quotidien, dernière barre ≤24h (le crypto trade 7j/7 — fraîcheur intraday idéalement).
   Critère : `bars_daily` sur BTC/ETH + une mid-cap renvoie ≥ 500 barres, dernière barre = J ou J-1.
3. **Screener crypto opérationnel** : `RunScreener(asset='crypto', pass_expr=<rsi14/ema/macd/vol…>)` renvoie
   des candidats rankés (indicateurs calculés sur les barres crypto). Critère : un `pass_expr` momentum
   renvoie > 0 candidats crypto, `warnings[]` si skips.
4. **Quote + métriques** : `QueryData(types=quote)` sur une paire → prix, volume 24h, market_cap (si dispo),
   change 24h. (Pas de « domicile » requis — hors PEA.)
5. **Format symbole** : décider d'un format canonique (ex. `BTC-USD` ou `BTCUSDT`) et le documenter, pour
   qu'on mappe proprement (comme le format Yahoo pour l'EU).

**Note** : si le MCP délègue déjà à Binance en interne, l'essentiel est (2) la profondeur d'historique dans le
store screener/`RunBacktest` (même leçon que l'EU : `QueryData` peut être profond mais le backtest doit lire
ce profond) et (3) le screener crypto.

## B. CASABLANCA / BVC — ce qu'il faut dans le MCP

Marché frontière (Bourse de Casablanca, ~75 valeurs). Aujourd'hui **aucune couverture MCP** → onboarding complet :

1. **Univers BVC** : liste des sociétés cotées BVC avec symbole + `country='Morocco'` (utile pour le tag
   halal/Sharia et la classification). Critère : une énumération renvoie les ~75 tickers BVC.
2. **OHLCV profond + frais** : `QueryData(bars_daily)` sur les tickers BVC → 2-5 ans d'historique quotidien,
   dernière barre ≤ 48h (marché moins liquide → tolérance). Critère : `bars_daily` sur 3 valeurs BVC
   (ex. les blue chips marocaines) renvoie ≥ 250 barres.
3. **Screener** : `RunScreener(region=<MA/AFRICA?> , …)` sur l'univers BVC → candidats + indicateurs.
   (Définir la clé région : `MA`, `AFRICA`, ou un flag dédié.) Critère : un `pass_expr` simple renvoie > 0.
4. **Quote + secmaster** : prix, market_cap (en MAD, préciser la devise), volume, secteur/industrie
   (pour la diversification + le tag Sharia). Critère : `QueryData(types=quote,profile)` sur une valeur BVC
   renvoie prix + mcap + devise MAD + secteur.
5. **Devise** : exposer la devise **MAD** proprement (comme EUR pour l'EU), pour l'affichage et le sizing.

**Réalité** : BVC est un marché de niche ; si l'onboarding complet est lourd, un **MVP** = énumération +
`bars_daily` profond + `quote` (sans screener natif, on filtre en code) débloque déjà la bascule MCP-primary.

---

## Critère commun (leçon EU v111)

Pour CHAQUE classe, le point qui débloque réellement un scanner : **l'historique OHLCV profond doit être lu
par le moteur de screener/`RunBacktest`, pas seulement par `QueryData` on-demand** (c'était le blocker #3 de
l'EU). Test d'acceptation type : `RunBacktest(<ticker de la classe>, from=<2-3 ans>)` produit des trades
répartis sur toutes les années, pas seulement la dernière.

## Impact côté articles

Dès qu'une classe passe ces critères, on bascule son scanner en MCP-primary et on supprime le fetch-direct +
l'univers local (`data/crypto-universe.json` / `data/casablanca-universe.json`). Ce sont les **2 dernières
sources non-MCP** — après ça, 100% de la donnée marché passe par le MCP (marketdata + dtx).
