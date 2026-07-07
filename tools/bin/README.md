# `dtx` — moteur de stratégie systematic-tss, réutilisable

Binaire Go qui expose le **vrai moteur** de systematic-tss (scanners + position managers + régime +
sizing + VIX — le code exact de prod) sous forme de CLI **JSON-in / JSON-out**. Une seule logique de
décision (`engine.Strategy.Apply`) sert au live, au replay et au natif → parité garantie, zéro dérive.

**But** : ne JAMAIS ré-implémenter la logique de stratégie ailleurs. On l'appelle.

## Les 3 chemins (où tout se trouve)

| Quoi | Où |
|---|---|
| **Code source** | repo `systematic-tss`, branche `origin/feat/dtx-binaries` : `cmd/dtx/` (main, native.go, state_codec.go, capture_broker.go…) + `internal/engine/universe_provider.go` (résolution univers partagée avec `cmd/backtest`). Rebuild : `scripts/build-dtx.sh`. |
| **Binaires locaux** | repo `trading-desk`, `tools/bin/dtx-darwin-arm64` (mac) + `tools/bin/dtx-linux-amd64` (cloud/CI), stockés en **git-lfs**. Provenance : `tools/bin/PROVENANCE.json` (commit source + go version + sha256). Wrapper : `tools/tss_engine.py`. |
| **Routine cloud** | les binaires sont **committés (git-lfs)** dans `trading-desk` → présents à tout `git checkout` (+`git lfs pull`), **zéro réseau/token requis** en mode injecté. La routine appelle `tools/bin/dtx-linux-amd64` (via `tss_engine.py`). |

## Les 2 modes de données (choisir selon la portabilité voulue)

- **Injecté** (`--bars fichier.json`) — TU fournis les bars. **Offline, déterministe, 100 % portable**
  (juste le binaire + du JSON). C'est le mode pour un autre projet, une routine cloud, ou pour
  brancher tes propres données (dailytickers, univers point-in-time).
- **Natif** (omets `--bars`) — dtx **résout l'univers depuis les filtres du YAML** (`region`,
  `min_market_cap`, `min_volume`, `stocks/etfs`, `blacklist`) via `staticdata` **et fetch l'OHLCV
  lui-même** (Yahoo/Binance/BVC), exactement comme `cmd/backtest`. **Prouvé par parité** : `dtx replay`
  natif == `cmd/backtest` champ à champ (EU DAX : cagr 24.22 / sharpe 1.03 / equity 125/125 dates
  identiques). ⚠️ Ce mode **n'est PAS autoportant** : il exige le contexte data de systematic-tss
  (fichiers `data/instruments/<broker>.json` + `staticdata`) et un accès réseau ; **lance-le depuis la
  racine du repo systematic-tss**. Pour un autre projet → préfère le mode injecté.

## Utilisation ailleurs (mode injecté, portable)

Copie `dtx-<plateforme>`, donne-lui du JSON, récupère du JSON. Rien à installer.

### Format des bars (commun aux 3 sous-commandes)
```json
{ "AAPL": [ {"date":"2024-01-02","open":185.0,"high":187.1,"low":184.2,"close":186.4,"volume":48000000}, ... ],
  "SPY":  [ ... ] }
```
Dates ISO `YYYY-MM-DD`, liste chronologique par symbole (le binaire dédoublonne/trie).

### `dtx decide` — primitive live : État(N) → Actions(N+1)
`Action(N+1) = Strategy(Bars(N), Positions(N), Orders(N), Balances(N), State(N-1))`
```
dtx decide --portfolio p.yaml --asof 2024-06-15 \
           --bars bars.json --positions pos.json --orders ord.json --balances bal.json \
           --state state_prev.json     # absent au 1er run
```
→ `{ "state": {…}, "actions": { "CREATE":[OrderRequest…], "UPDATE":[…], "CANCEL":[…] } }`.
`state` = à PERSISTER et re-passer au run suivant. `OrderRequest` = {OrderID, Symbol, Side, OrderType,
Qty, LimitPrice, StopPrice, StopLoss, TakeProfit, OCOGroupID, TimeInForce, TrailingStop…}.
**Le binaire ne trade pas** — il calcule les actions ; l'appelant les exécute. Supporte **tous** les
modes (trend/highvol, index-rotation/stockbox, regime-ensemble, lev-trend, crypto).

### `dtx replay` — la même primitive bouclée sur l'historique → métriques
```
dtx replay --portfolio p.yaml [--bars bars.json] [--from YYYY-MM-DD --to YYYY-MM-DD]
```
→ `{ final_equity, total_trades, win_rate, cagr_pct, max_dd_pct, sharpe, r2, … }`. Pas un backtester
séparé : `decide` rejoué + broker simulé → parité live↔replay. **Caveat d'interprétation** : sur un
univers = constituants COURANTS, le CAGR est optimiste (biais survivorship) ; la vérité non-biaisée
exige un univers point-in-time.

### `dtx regime` — régime marché depuis le panier macro
```
dtx regime --asof 2024-06-15 [--bars macro_bars.json]
```
(macro = ^GSPC/^VIX/IWM/SPY/TLT/HYG/GLD…) → `{regime, regime_score, sma_regime, …}`.

## Wrapper Python (exemple)
```python
import sys; sys.path.insert(0, "tools")
from tss_engine import TssEngine
eng = TssEngine()                       # trouve dtx-<plateforme> à côté du wrapper, fail-closed si absent
m   = eng.replay(bars, "portfolio_us_highvol.yaml")
out = eng.decide(bars, positions, orders, balances, state=prev_state,
                 portfolio_yaml_path="portfolio.yaml", asof="2024-06-15")
reg = eng.regime(macro_bars, asof="2024-06-15")
```

## Rebuild (source systematic-tss)
```
cd systematic-tss && git checkout feat/dtx-binaries && bash scripts/build-dtx.sh
# → dist/dtx-{darwin-arm64,linux-amd64} + PROVENANCE.json (strippés, -trimpath -ldflags=-s -w)
# puis copier les binaires dans trading-desk/tools/bin/ (git-lfs)
```

## Limites connues (franches)
- `dtx-linux-amd64` : format ELF valide mais **jamais exécuté** (pas de runtime Linux au build) — à
  confirmer au 1er run cloud réel. Le darwin est vérifié à l'exécution.
- **Parité natif** mesurée sur **une seule config mono-allocation stocks** (EU DAX). Casablanca (MA/BVC),
  crypto et forex sont câblés (même code que `cmd/backtest`) mais **non exercés** par un run réel ;
  multi-allocations non testé.
- Mode natif : `CanHandle` dépend du CWD (`data/instruments/<broker>.json`) → lancer depuis la racine
  systematic-tss. (Hérité de `cmd/backtest`, pas propre à dtx.)
