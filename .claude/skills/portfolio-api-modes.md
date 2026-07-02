---
name: portfolio-api-modes
description: Portfolio public API + trading modes config + regime recalibration. Auto-load when user touches portfolio/v1/**, data/modes-config.json, tools/gen-api.js, tools/regime-recalibrate.js, or mentions turbo/dynamic/balanced/secured/orbit/bull/aplus/highvol/casablanca/momentum/etf/etf_eu/trendline/fortress modes.
user_invocable: false
---

# Portfolio API — `/portfolio/v1/`

API publique servant signaux et equity des modes de trading.

- **Modes** : source de vérité = `data/modes-config.json` (paramètres ajustés par sweep + recalibrage régime). Modes live = ceux dont `status == "live"` — actuellement 13 : `turbo`, `dynamic`, `balanced`, `secured` (label Orbit), `bull`, `aplus`, `highvol`, `casablanca`, `momentum`, `etf`, `etf_eu`, `trendline`, `fortress`. Les autres (ex : `tkl`, `alpha`, `crypto`, `metals`, `forex`) sont `stopped`. Ne jamais hardcoder la liste : la lire depuis le JSON.
- **Endpoints par mode** : `/portfolio/v1/{mode}/[signals|positions|equity|orders|actions|trades|risk|winning-streaks|all].json`
- **Documentation** : `https://articles.dailytickers.com/integrations/portfolio/`
- **Génération** : `node tools/gen-api.js` (dépend de `backtest-trades.json` et `scanner-positions.json`)
- **Telegram topics** : turbo/dynamic→89, balanced→90, secured/fortress→91 (env: `TELEGRAM_TOPIC_<MODE>`)
- **Recalibration régime** : `node tools/regime-recalibrate.js` détecte changements régime (RECOVERY ↔ RISK-ON ↔ RISK-OFF) et propose nouveau set params depuis `data/backtest-results.json#advisor_*`. Append-only dans `portfolio/v1/config-history.json` — historique jamais écrasé.
