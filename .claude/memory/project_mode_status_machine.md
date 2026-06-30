---
name: mode-status-machine
description: "8-state lifecycle for scanner modes (turbo/dynamic/balanced/secured/fortress/tkl). Lets us pause, ramp-up, or liquidate modes without code changes."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c3ddea7-0ebf-4f31-bbdb-d47bb5b10369
---

# Mode Status State Machine

**Why:** Scanner modes peuvent dégrader (ex. secured OOS PF=0.53 sur n=11 en mai 2026). Avant la machine d'états, la seule option était de DROP le mode (perte historique + refactor multi-fichiers). Maintenant on peut PAUSE intelligemment (`pausing`), liquider en urgence (`liquidated`), ou déployer progressivement un nouveau mode (`deploying`).

**How to apply:**
- Mode sous-performe (OOS WR < 30%, OOS PF < 1, DD breaker répété) → `live → pausing` (sortie organique).
- Urgence (compliance, panic, regime crisis) → `live → liquidated` (force-close immédiat).
- Nouveau mode candidat → `draft → test → deploying → live` (ramp-up paper-validé).

## États (8 total)

| État | Acceptes entries | Trading | Positions ouvertes | Public |
|------|------------------|---------|---------------------|--------|
| `draft` | non | none | n/a | hidden |
| `test` | oui | paper | paper-managed | visible |
| `deploying` | oui (au fil de l'eau) | paper-ramp | paper-managed | visible |
| `live` | oui | real | live-managed | visible |
| `pausing` | **non** | exit-only | **wind down via SL/TP/horizon/trailing** | visible |
| `liquidated` | **non** | liquidating | **force-close au marché à la prochaine séance** | visible |
| `paused` | non | none | doit être empty | visible |
| `stopped` | non | none | n/a | hidden |

### Sémantique critique

- **`pausing`** = sortie organique. New entries ET rotations bloquées (rotation = effectively new entry). SL/TP/horizon/trailing continuent normalement. Transition → `paused` une fois `positionCount === 0`. Durée : jours/semaines.
- **`deploying`** = ramp-up gradual paper-ramp. Validation conditions réelles avant flip → `live`.
- **`liquidated`** = urgence brutale. Toutes positions fermées au marché à la prochaine séance, indifférent à SL/TP/horizon/P&L. Durée : 1 séance. Cas d'usage : compliance breach, regime crisis, blackswan, décision manuelle.

## Transitions valides

```
draft     → test
test      → deploying | draft
deploying → live | test (rollback)
live      → pausing | liquidated
pausing   → paused | liquidated (escalade)
liquidated → paused | stopped
paused    → live (resume) | stopped
stopped   → (terminal)
```

## Fichiers clés

- **Code** : `tools/lib/mode-status.js` (machine + helpers), `tools/set-mode-status.js` (CLI)
- **Doc** : `tools/lib/MODE_STATUS.md` (full reference dans le repo, auto-load via CLAUDE.md)
- **Storage** : `data/modes-config.json` (état courant: `status` + `statusSince` + `statusReason` + `statusNextReviewAt` par mode), `data/modes-status-history.json` (log append-only)
- **API publique** : `portfolio/v1/status.json` (agrégé) + bloc `status` dans tous endpoints per-mode (signals/positions/trades/equity/orders/actions/all/risk)
- **OpenAPI** : v1.3.0+, schemas `ModeStatus` + `ModeStatusTransition`

## CLI

```bash
node tools/set-mode-status.js --mode <id> --to <state> \
  --reason "..." [--review YYYY-MM-DD] [--by manual] [--force]
```

Rejette transitions illégales sauf `--force`. Append automatique au log.

## Pipeline integration

- `gen-api.js` : émet `status` block sur tous endpoints, vide `orders.json` quand `acceptsNewEntries=false`, génère `portfolio/v1/status.json` avec `recentTransitions[]`
- `gen-status-page.js` : badge dans tab + banner dans panel quand state ≠ live (couleur rouge pour liquidated)
- `gen-trading-plan.js` :
  - draft/paused/stopped : skip
  - pausing : exits-only (close-now via horizon naturel + SL/TP par bracket orders)
  - liquidated : closeNow override = TOUTES positions au marché avec reason="LIQUIDATION"
- `pit-engine.js` : gate rotation+entries via `statusHalt`, respecte `statusSince` pour backtest reproductible. Passe de liquidation force-close positions à `bar.close` quand state=liquidated

## Première application : secured 2026-05-22

`live → pausing` car OOS WR=9.1% / PF=0.53 sur n=11. Review 2026-06-22. Voir [[modes-independent]] pour rappel qu'un mode dégradé n'invalide pas les autres modes (stratégies indépendantes).

## Renames history

- 2026-05-22 initial : `test-to-live`, `live-to-pause`
- 2026-05-22 renamed : `deploying`, `pausing` (plus concis, sémantique claire)
