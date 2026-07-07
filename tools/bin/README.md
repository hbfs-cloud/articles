# `dtx` — moteur de stratégie systematic-tss, réutilisable et autoportant

Binaire Go qui expose le **vrai moteur** de systematic-tss (scanners + position managers + régime +
sizing + VIX — le code exact de prod) en CLI **JSON-in / JSON-out**. Une seule logique de décision
(`engine.Strategy.Apply`) sert au live, au replay et au natif → parité garantie, zéro dérive.
**On ne ré-implémente jamais la logique ailleurs. On l'appelle.**

## Les 3 chemins

| Quoi | Où |
|---|---|
| **Code source** | `systematic-tss`, branche `origin/feat/dtx-binaries` : `cmd/dtx/` + `internal/engine/universe_provider.go`. Rebuild binaire : `scripts/build-dtx.sh`. Rebuild bundle : `scripts/build-dtx-bundle.py <configs…>`. |
| **Binaires locaux** | `trading-desk` : `tools/bin/dtx-darwin-arm64` (mac) + `tools/bin/dtx-linux-amd64` (cloud), en **git-lfs**. Wrapper : `tools/tss_engine.py`. Provenance : `tools/bin/PROVENANCE.json`. Bundle data : `tools/bin/dtx-data/` (git-lfs). |
| **Routine cloud** | tout est présent au checkout (`git lfs pull`) : binaire + `dtx-data/`. **Zéro réseau/token** en mode injecté ; en mode natif, seul le fetch OHLCV appelle Yahoo (le cache s'écrit en `/tmp`, pas dans le repo → **checkout read-only OK**). |

## Les 2 modes de données

- **Injecté** (`--bars fichier.json`) — TU fournis les bars. **Offline, déterministe, 100 % portable**
  (binaire + JSON). Le mode pour un autre projet, une routine cloud, ou tes propres données (dailytickers,
  univers point-in-time).
- **Natif** (omets `--bars`) — dtx **résout l'univers depuis le YAML** (`region`/`min_market_cap`/
  `min_volume`/`stocks/etfs`/`blacklist`) **et fetch l'OHLCV** (Yahoo), exactement comme `cmd/backtest`.
  **Prouvé par parité champ-à-champ** (US highvol + EU dax). **Autoportant** : dtx trouve son bundle de
  données via `--data-dir`, sinon `$DTX_DATA_DIR`, sinon un dossier `dtx-data/` **à côté du binaire**
  (le cas par défaut ici). Le cache OHLCV s'écrit dans un dossier temporaire (`$DTX_WRITABLE_CACHE_DIR`
  ou `os.MkdirTemp`), **jamais dans le bundle** → fonctionne sur un checkout read-only.

### Le bundle `dtx-data/` (9,2 Mo)
Univers + instruments compactés (champs strippés au strict nécessaire + minifiés, élagués par
market-cap — behavior-preserving, vérifié par parité). Couvre les **17 configs du desk** :
régions **US / UK / DE / JP / IN** (+ ETF US), brokers **alpaca / saxo / trading212** (IBKR se construit
depuis les frozen, aucun fichier requis). Étendre à d'autres régions/brokers :
`scripts/build-dtx-bundle.py config/portfolio_xxx.yaml …` puis recopier dans `tools/bin/dtx-data/`.

## Utilisation ailleurs

Copie `dtx-<plateforme>` (+ `dtx-data/` à côté si tu veux le natif). JSON in, JSON out. Rien à installer.

### Format des bars (commun aux 3 sous-commandes, mode injecté)
```json
{ "AAPL": [ {"date":"2024-01-02","open":185.0,"high":187.1,"low":184.2,"close":186.4,"volume":48000000}, ... ],
  "SPY":  [ ... ] }
```

### `dtx decide` — primitive live : État(N) → Actions(N+1)
`Action(N+1) = Strategy(Bars(N), Positions(N), Orders(N), Balances(N), State(N-1))`
```
dtx decide --portfolio p.yaml --asof 2024-06-15 \
           [--bars bars.json] --positions pos.json --orders ord.json --balances bal.json \
           [--state state_prev.json]        # absent au 1er run ; [--data-dir DIR] en natif
```
→ `{ "state": {…}, "actions": { "CREATE":[OrderRequest…], "UPDATE":[…], "CANCEL":[…] } }`.
`state` = à PERSISTER et re-passer au run suivant. `OrderRequest` = {OrderID, Symbol, Side, OrderType,
Qty, LimitPrice, StopPrice, StopLoss, TakeProfit, OCOGroupID, TimeInForce, TrailingStop…}.
**Le binaire ne trade pas** — il calcule les actions ; l'appelant les exécute. **Tous** les modes
(trend/highvol, index-rotation/stockbox, regime-ensemble, lev-trend, crypto).

### `dtx replay` — la même primitive bouclée sur l'historique → métriques
```
dtx replay --portfolio p.yaml [--bars bars.json] [--from YYYY-MM-DD --to YYYY-MM-DD] [--data-dir DIR]
```
→ `{ final_equity, total_trades, win_rate, cagr_pct, max_dd_pct, sharpe, r2, … }`. Pas un backtester
séparé : `decide` rejoué + broker simulé → parité live↔replay. **Caveat** : sur un univers = constituants
COURANTS, le CAGR est optimiste (biais survivorship) ; la vérité non-biaisée exige un univers point-in-time.

### `dtx regime` — régime marché depuis le panier macro
```
dtx regime --asof 2024-06-15 [--bars macro_bars.json] [--data-dir DIR]
```

## Wrapper Python
```python
import sys; sys.path.insert(0, "tools")
from tss_engine import TssEngine
eng = TssEngine()                        # trouve dtx-<plateforme> à côté du wrapper ; fail-closed si absent
m   = eng.replay(bars, "portfolio_us_highvol.yaml")
out = eng.decide(bars, positions, orders, balances, state=prev, portfolio_yaml_path="p.yaml", asof="2024-06-15")
reg = eng.regime(macro_bars, asof="2024-06-15")
```

## Limites connues (franches)
- `dtx-linux-amd64` : ELF valide mais **jamais exécuté** (pas de runtime Linux au build) — à confirmer
  au 1er run cloud. Le darwin est vérifié.
- **Parité natif** re-prouvée sur **US highvol + EU dax** ; JP/IN/UK/ETF reposent sur la même garantie
  « champs consommés » sans run de parité individuel. Une config **saxo non-whitelist** (ex. ultra_v4)
  n'est pas testée (3 instruments saxo peuvent être élagués hors univers).
- Bundle : régions **MA** (Casablanca/BVC, API réseau) et **crypto/forex** (inline YAML) non incluses.
- Mode natif : fetch Yahoo → sujet aux 429 (rate-limit) ; le déterminisme du replay suppose un cache chaud.
