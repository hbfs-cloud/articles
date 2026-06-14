# BrokerSim MCP v2 — Specification idéale

> Objectif : remplacer les 8+ fichiers JSON distribués par une base de données unique,
> immuable pour les trades clôturés, avec audit trail complet.

## 1. Problème actuel

### 8 fichiers JSON = base de données distribuée sans garanties

| Fichier | Écrit par | Lu par | Risque |
|---------|-----------|--------|--------|
| `backtest-trades.json` | sweep.js | 16 outils | **Corruption** (phantom NVDA, sim2_artifact) |
| `backtest-results.json` | sweep.js | gen-status-page, gen-api, qa-check | Désynchronisation |
| `scanner-positions.json` | update-tracking.js | gen-status-page, sweep, validate-scan, gen-trading-plan | Race condition |
| `scanner-metrics.json` | update-tracking.js | generate-scanner-image | Stale data |
| `risk-snapshots.json` | refresh-risk-metrics.js | gen-api | Stub silencieux |
| `scanner/status/history/*.json` | gen-status-page.js | gen-api | Dépendance chaînée |
| `portfolio/v1/{mode}/*.json` | gen-api.js | daily-synthesis, gen-trading-plan | Cascade d'erreurs |
| `modes-config.json` | manuel | tous | Pas d'historique de modification |

### Incidents récurrents
- **Trade phantom** : sweep.js crée un trade par erreur (NVDA -9.4%), le trade survit à tous les re-runs car `shouldPurge` ne touche pas les trades clôturés → return Dynamic régresse de 82% à 73%.
- **sim2_artifact** : statut inventé pour contourner un bug, crée une dépendance invisible dans 3 outils.
- **Écrasement historique** : sweep re-run batch réinitialise des trades manuellement ajustés.
- **Incohérence inter-fichiers** : gen-status-page lit des trades de backtest-trades.json mais scanner-positions.json a des prix plus récents.

## 2. Domain Model

```
Workspace (org)
├── Account (1 par mode : turbo, dynamic, balanced, secured, fortress, bull)
│   ├── Cash balance
│   ├── Position[] (positions ouvertes)
│   │   ├── symbol, qty, avg_cost, current_price
│   │   ├── unrealized_pnl, unrealized_pnl_pct
│   │   ├── sl_price, tp1_price, tp2_price, trail_config
│   │   └── signal_id (lien vers le signal d'origine)
│   ├── Order[] (ordres actifs)
│   │   ├── ENTRY, SL, TP1, TP2, TRAILING_STOP
│   │   └── lifecycle: placed → filled/cancelled/expired/rejected
│   └── Trade[] (historique clôturé, IMMUABLE)
│       ├── entry_order_id, exit_order_id
│       ├── entry_date, exit_date, hold_days
│       ├── entry_price, exit_price, pnl_pct
│       ├── exit_reason: sl|tp1|tp2|trailing|expired|manual
│       └── audit_log[]
│
├── Signal[] (signaux émis par le scanner, IMMUABLE)
│   ├── scan_date, ticker, score, strategy
│   ├── entry, stop, tp1, tp2, rr, horizon
│   ├── regime, region, sharia
│   ├── extension: { rsi, atr, distance_50dma_pct }
│   ├── pattern: { name, strength, confirmed }
│   └── outcome: { hit_tp1, hit_sl, max_favorable, max_adverse, resolved_at }
│
├── EquitySnapshot[] (1 par jour par account)
│   ├── date, cash, positions_value, total_equity
│   ├── daily_return_pct
│   └── drawdown_from_peak
│
└── AuditLog[] (append-only)
    ├── timestamp, actor (sweep|tracking|manual|recalibrate)
    ├── entity_type (trade|order|position|signal|config)
    ├── entity_id
    ├── action (created|updated|closed|cancelled)
    ├── before: {}, after: {}
    └── reason: string
```

## 3. API Specification (5 nouveaux + 4 existants conservés)

> Principe : 1 tool par domaine, le comportement est déterminé par la **présence des champs**
> (pas de param `action`). Le LLM lit la description du tool et sait quels champs passer.
> Les 4 tools CRUD comptes restent tels quels (déjà implémentés, usage rare).

### Vue d'ensemble

| # | Tool | Type | Usage | Remplace |
|---|------|------|-------|----------|
| 1 | **`emit_signals`** | Nouveau | Quotidien (scanner) | signals.json |
| 2 | **`place_orders`** | Remplace place_order | Quotidien (sweep) | backtest-trades.json (W) |
| 3 | **`update_prices`** | Nouveau | Quotidien (tracking) | scanner-positions.json |
| 4 | **`get_dashboard`** | Nouveau | Quotidien (status/api) | backtest-results.json (R) + audit + config |
| 5 | **`backtest`** | Enrichi | Hebdomadaire | create/run_backtest existants |
| — | `list_accounts` | Existant | Setup only | — |
| — | `create_account` | Existant | Setup only | — |
| — | `reset_account` | Existant | Rare | — |
| — | `delete_account` | Existant | Rare | — |

### 3.1 `emit_signals`

**Description MCP** : *Record scanner signals or query/evaluate past signals. Pass `signals` to write, `scan_date_from` to query, `evaluate: true` for aggregate stats.*

```json
// ── WRITE : signals présent → enregistre un batch. Idempotent par (scan_date, ticker).
{
  "scan_date": "2026-06-15",
  "regime": "NEUTRAL",
  "regime_score": 62,
  "signals": [
    {
      "ticker": "ARM", "score": 91, "strategy": "Momentum",
      "entry": 375, "stop": 352, "tp1": 414, "tp2": 453,
      "rr": "1:1.7", "horizon": 10, "region": "US", "sharia": true,
      "thesis": "...",
      "extension": { "rsi": 58.2, "atr": 12.5, "distance_50dma_pct": 3.2 },
      "pattern": null,
      "earnings_clear": true, "dilution_clear": true
    }
  ],
  "tkl_pool": []
}
// → { signal_ids: ["sig_a1"], scan_id: "scan_20260615" }

// ── QUERY : scan_date_from sans signals → recherche.
{
  "scan_date_from": "2026-06-01",
  "scan_date_to": "2026-06-12",
  "ticker": "NVDA",              // optionnel
  "strategy": "Momentum",        // optionnel
  "include_outcome": true         // optionnel — ajoute hit_tp1/hit_sl/max_favorable
}
// → Signal[] avec outcomes calculés

// ── EVALUATE : evaluate=true → stats agrégées (hit rates, PnL par stratégie/régime).
{
  "scan_date_from": "2026-06-01",
  "scan_date_to": "2026-06-12",
  "evaluate": true
}
// → { total: 85, resolved: 42, hit_tp1: 18, hit_sl: 15,
//     by_strategy: { Momentum: {total:30, wr:40, pnl_avg:1.2}, ... }, by_regime: {...} }
```

**Routing** : `signals` → write | `evaluate` → aggregate | sinon → query.

### 3.2 `place_orders`

**Description MCP** : *Place, cancel, or modify orders on a simulation account. Supports bulk, OCO attached orders (SL/TP/trailing auto-linked to entry).*

Remplace l'ancien `place_order` (singulier). Un seul order dans le tableau = même chose.

```json
// ── PLACE : orders présent → placement atomique.
{
  "account_id": "acc_turbo",
  "orders": [
    {
      "signal_id": "sig_a1",
      "symbol": "ARM",
      "side": "BUY",
      "order_type": "LIMIT",
      "qty": 27,
      "price": 375,
      "time_in_force": "GTC",
      "not_before": "2026-06-16",
      "attached_orders": [
        { "type": "STOP", "stop_price": 352, "label": "sl" },
        { "type": "LIMIT", "price": 414, "label": "tp1" },
        { "type": "TRAILING_STOP", "trail_pct": 3.5, "activation_price": 400, "label": "trailing" }
      ],
      "metadata": { "scan_date": "2026-06-15", "strategy": "Momentum",
                     "horizon_days": 10, "vwap_ref": 372.50 }
    }
  ]
}
// → { order_ids: ["ord_1","ord_sl","ord_tp","ord_trail"], fills: [...] }
//
// attached_orders = OCO automatique :
//   entry rempli → SL + TP + trailing activés
//   premier exit touché → les autres annulés
// C'est simulateTrade() de sweep.js codé une seule fois côté serveur.

// ── CANCEL : cancel_ids présent → annulation.
{
  "account_id": "acc_turbo",
  "cancel_ids": ["ord_xyz", "ord_abc"]
}
// → { cancelled: 2 }

// ── MODIFY : modify présent → ajustement d'un ordre existant.
{
  "account_id": "acc_turbo",
  "modify": {
    "order_id": "ord_trail",
    "new_price": 360,
    "reason": "trailing tightened after 5d grace"
  }
}
// → { modified: true, previous_price: 352 }
```

**Routing** : `orders` → place | `cancel_ids` → cancel | `modify` → modify.

### 3.3 `update_prices`

**Description MCP** : *Feed latest prices for open positions. Automatically triggers SL/TP exits and creates closed trades atomically.*

Outil simple, pas de routing — il fait une seule chose.

```json
{
  "prices": [
    { "symbol": "ARM", "price": 382.50, "timestamp": "2026-06-19T20:00:00Z" },
    { "symbol": "LRCX", "price": 365.20, "timestamp": "2026-06-19T20:00:00Z" }
  ]
}
// → {
//   updated: 2,
//   triggers: [
//     { "order_id": "ord_sl1", "symbol": "ARM", "type": "STOP",
//       "trigger_price": 352, "fill_price": 351.80, "trade_id": "trd_xyz" }
//   ]
// }
// Side effect : SL touché → position fermée + trade créé ATOMIQUEMENT.
// Remplace le cycle : update-tracking.js → Yahoo → scanner-positions.json → gen-status-page.
```

### 3.4 `get_dashboard`

**Description MCP** : *Read portfolio state, trades, equity, positions for one or all modes. Use `include` to select data blocks.*

Un seul outil de lecture qui remplace `get_portfolio` + `get_trades` + `get_positions` + `get_equity` + `get_mode_dashboard`.

```json
// ── MULTI-MODE : modes (pluriel) → dashboard complet pour scanner/status.
{
  "modes": ["turbo", "dynamic", "balanced", "secured", "fortress", "bull"],
  "include": ["stats", "positions", "recent_trades", "pending_orders", "equity"]
}
// → {
//   modes: {
//     turbo: {
//       status: "live",
//       stats: { return: 111.34, wr: 50, pf: 7.53, dd: -3.48, trades: 38,
//                sharpe: 5.65, sortino: 8.12, calmar: 104.59 },
//       positions: [{ ticker: "UNH", entry: 478, current: 491, pnl_pct: 2.71,
//                     days: 8, sl: 455, tp1: 524, signal_date: "2026-06-05" }],
//       recent_trades: [{ ticker: "LLY", pnl_pct: 9.87, status: "tp1", exit_date: "2026-06-08" }],
//       pending_orders: [{ ticker: "ARM", side: "BUY", price: 375, effective_date: "2026-06-16" }],
//       equity: [{ date: "2026-06-12", value: 211.34 }, ...]
//     }, ...
//   },
//   aggregate: { total_equity: 650000, best_mode: "turbo", worst_mode: "balanced" }
// }

// ── SINGLE MODE : mode (singulier) → détail d'un mode avec filtres.
{
  "mode": "turbo",
  "include": ["stats", "trades"],
  "scan_date_from": "2026-06-01",      // filtre trades
  "scan_date_to": "2026-06-12",
  "status": "sl",                       // optionnel — filtre trades par exit reason
  "oos_split_date": "2026-05-01",       // optionnel — IS/OOS split dans stats
  "include_audit": true                 // optionnel — audit trail par trade
}
// → {
//   mode: "turbo", status: "live",
//   stats: { ..., in_sample: {...}, out_sample: {...} },
//   trades: [{ ticker, scanDate, entryDate, exitDate, pnlPct, status, signal_id,
//              audit_log: [{ timestamp, actor, action, reason }] }]
// }

// ── IMPORT : import_trades présent → backfill depuis backtest-trades.json.
{
  "import_trades": {
    "account_label": "turbo",
    "trades": [
      { "ticker": "LLY", "scanDate": "2026-06-02", "entryDate": "2026-06-02",
        "exitDate": "2026-06-08", "actualEntry": 820.50, "exitPrice": 901.50,
        "status": "tp1", "pnlPct": 9.87, "holdDays": 6 }
    ],
    "source": "backfill"
  }
}
// → { imported: 34, skipped_duplicates: 0, errors: [] }

// ── CONFIG : config présent → lecture/écriture de la config d'un mode.
{
  "config": {
    "mode": "turbo",
    "set": {                                 // optionnel — si absent → lecture
      "portfolioSize": 1, "topN": 1, "horizon": 8
    },
    "reason": "v8.5 — widened ATR stops",    // requis si set
    "actor": "regime-recalibrate",           // requis si set
    "include_history": true                  // optionnel — versions précédentes
  }
}
// WRITE → { version: "v8.5-20260612", previous: "v8.4-20260611" }
// READ  → { mode, version, config: {...}, history: [{version, date, reason, actor}] }

// ── AUDIT : audit présent → log de toutes les mutations.
{
  "audit": {
    "from": "2026-06-01",
    "to": "2026-06-12",
    "entity_type": "trade",        // optionnel — trade|order|position|signal|config
    "entity_id": "...",            // optionnel
    "actor": "sweep"               // optionnel
  }
}
// → AuditEntry[] : { timestamp, actor, entity_type, entity_id, action, before, after, reason }
```

**Routing** : `modes` → multi-dashboard | `mode` → single detail | `import_trades` → backfill | `config` → config R/W | `audit` → audit log.

**Valeurs possibles pour `include`** : `stats`, `positions`, `trades`, `recent_trades`, `pending_orders`, `equity`.

### 3.5 `backtest`

**Description MCP** : *Create and run historical backtests with mode-specific rules (VWAP gate, portfolio size, trailing). Pass `name` to create, `run_id` to run, `delete_id` to delete.*

```json
// ── CREATE : name présent → créer un backtest.
{
  "name": "turbo-backtest-v8.5",
  "start_date": "2026-02-15",
  "end_date": "2026-06-12",
  "account_ids": ["acc_turbo"],
  "mode_config": {
    "portfolioSize": 1, "topN": 1, "horizon": 8,
    "trailingStop": true, "trailMultR": 1.5, "trailGraceDays": 2,
    "vwapGate": true, "rotation": "none"
  },
  "signals_source": "stored"
}
// → { backtest_id: "bt_xyz" }

// ── RUN : run_id présent → exécuter.
{ "run_id": "bt_xyz" }
// → { sharpe, sortino, max_dd, total_return, equity_curve, trade_log, fill_summary }

// ── DELETE : delete_id présent → supprimer.
{ "delete_id": "bt_xyz" }
// → { deleted: true }
```

**Routing** : `name` → create | `run_id` → run | `delete_id` → delete.


## 4. Integration Architecture

### Flux actuel → flux cible

```
ACTUEL:
scanner → signals.json → sweep.js → backtest-trades.json → gen-status-page → gen-api
                                   ↳ backtest-results.json ↗               ↳ portfolio/v1/
         update-tracking.js → scanner-positions.json ↗
                            ↳ scanner-metrics.json → generate-scanner-image

CIBLE (5 tools + 4 existants conservés):
scanner ──→ emit_signals ────────────────────────────────────→ BrokerSim DB
                                                                   │
sweep.js ──→ place_orders (entry + OCO: SL/TP/trailing) ─────────→│
                                                                   │
update-tracking.js ──→ update_prices ─────────────────────────────→│ (triggers auto)
                                                                   │
gen-status-page.js ←── get_dashboard(modes=[...]) ←───────────────┤
gen-api.js ←── get_dashboard(mode="turbo", include=["stats"]) ←───┤
scanner-image.js ←── get_dashboard(mode="turbo", include=["positions"]) ←┤
daily-synthesis.js ←── get_dashboard(modes=[...]) ←───────────────┤
gen-trading-plan.js ←── get_dashboard(mode, include=["positions","pending_orders"]) ←┤
qa-check.js ←── get_dashboard(mode, include=["trades","stats"]) ←─┤
rétrospective ←── emit_signals(evaluate=true) ←───────────────────┘
```

### Ce qui change dans chaque outil

| Outil | Aujourd'hui | Demain (tool appelé) |
|-------|-------------|---------------------|
| **sweep.js** | Simule trades, écrit backtest-trades.json | `place_orders` avec OCO attached_orders |
| **update-tracking.js** | Yahoo → scanner-positions.json | `update_prices` (triggers auto SL/TP) |
| **gen-status-page.js** | Lit 3 JSON files | `get_dashboard(modes=[...])` — 1 appel |
| **gen-api.js** | Lit history/*.json → portfolio/v1/ | `get_dashboard(mode, include=["stats","equity"])` ×6 |
| **gen-trading-plan.js** | Lit scanner-positions.json + portfolio/v1/ | `get_dashboard(mode, include=["positions","pending_orders"])` |
| **generate-scanner-image.js** | Lit scanner-metrics.json | `get_dashboard(mode, include=["positions","stats"])` |
| **daily-synthesis.js** | Lit portfolio/v1/*.json | `get_dashboard(modes=[...], include=["stats"])` |
| **qa-check.js** | Lit backtest-trades + results | `get_dashboard(mode, include=["trades","stats"])` |
| **regime-recalibrate.js** | Lit backtest-results#advisor | `get_dashboard` + `get_dashboard(config={set:...})` |
| **rétrospective** | Manuel — signals.json + QueryData | `emit_signals(evaluate=true)` — 1 appel |

## 5. Plan de Migration

### Phase 1 — Setup (1 jour)
1. Créer workspace `dailytickers-prod`
2. Créer 6 accounts (turbo/dynamic/balanced/secured/fortress/bull) avec les bons initial_cash
3. Backfill via `import_trades` depuis backtest-trades.json (500+ trades)
4. Backfill signaux via `emit_signals` depuis tous les signals.json historiques
5. Vérifier cohérence : `get_portfolio` doit matcher backtest-results.json#frozen_*

### Phase 2 — Dual-Write (1 semaine)
1. sweep.js écrit dans backtest-trades.json ET appelle `place_orders`
2. update-tracking.js écrit scanner-positions.json ET appelle `update_prices`
3. Ajouter script de réconciliation : compare JSON vs BrokerSim, alerte sur divergence
4. Les outils downstream lisent toujours les JSON (pas de changement pour eux)

### Phase 3 — Read Migration (1 semaine)
1. gen-status-page.js → `get_mode_dashboard`
2. gen-api.js → `get_portfolio`
3. qa-check.js → `get_trades` + `get_portfolio`
4. generate-scanner-image.js → `get_positions`
5. daily-synthesis.js → `get_portfolio`
6. Les JSON restent écrits mais ne sont plus la source de vérité

### Phase 4 — JSON Deprecation
1. Arrêter l'écriture dans backtest-trades.json, scanner-positions.json, scanner-metrics.json
2. Garder backtest-results.json en lecture seule (archive)
3. Supprimer le code de lecture JSON des outils
4. Ajouter un healthcheck BrokerSim dans publish-daily-card.sh

## 6. Gap analysis — BrokerSim actuel vs spec v2

### Bilan final : 12 tools → 11 tools (même surface, beaucoup plus de capacité)

**6 supprimés + 5 ajoutés = 11 tools**

### 6 tools à supprimer

| Tool à supprimer | Pourquoi | Remplacé par |
|------------------|----------|--------------|
| `place_order` | `place_orders` couvre le cas single (`orders=[1]`) | `place_orders` |
| `cancel_order` | Absorbé via `cancel_ids` | `place_orders` |
| `get_portfolio` | Remplacé par un outil plus riche | `get_dashboard` |
| `create_backtest` | Unifié dans un seul tool | `backtest` (champ `name`) |
| `run_backtest` | Unifié | `backtest` (champ `run_id`) |
| `delete_backtest` | Unifié | `backtest` (champ `delete_id`) |

### 6 tools conservés (usage rare — setup only)

`list_accounts`, `create_account`, `delete_account`, `reset_account`, `list_workspaces`, `create_workspace`

### 5 tools ajoutés

| Tool | Fonctionnalité | Priorité |
|------|----------------|----------|
| `emit_signals` | Tout nouveau : write + query + evaluate signaux | **P0** |
| `place_orders` | Bulk, OCO `attached_orders`, `signal_id`, cancel, modify | **P0** |
| `update_prices` | Tout nouveau : feed prix → triggers SL/TP atomiques | **P0** |
| `get_dashboard` | Multi-mode dashboard, `include` filter, trades, import, config, audit | **P0** |
| `backtest` | `mode_config` (VWAP gate, portfolio constraints), `signals_source` | P2 |

## 7. Bénéfices attendus

1. **Zéro corruption** : trades clôturés immuables en DB. Plus jamais de phantom trade.
2. **Source unique** : un seul endroit pour l'état des positions. Plus de désynchronisation entre 8 JSON files.
3. **Audit trail** : chaque mutation tracée avec actor/timestamp/reason. Debug en minutes, pas en heures.
4. **Atomicité** : `place_orders` + `attached_orders` = entry + SL + TP en une transaction. Plus de position sans stop.
5. **Évaluation auto** : `evaluate_signals` calcule les hit rates automatiquement. Rétrospective en 1 appel.
6. **Séparation des préoccupations** : sweep.js = décision, BrokerSim = exécution + stockage.
7. **Temps réel** : `update_prices` déclenche les exits automatiquement. Plus besoin de batch update-tracking.js.
