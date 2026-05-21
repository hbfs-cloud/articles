---
name: portfolio-api-modes
description: Portfolio public API + 6 trading modes config + regime recalibration. Auto-load when user touches portfolio/v1/**, data/modes-config.json, tools/gen-api.js, tools/regime-recalibrate.js, or mentions turbo/dynamic/balanced/secured/fortress/tkl modes.
user_invocable: false
---

# Portfolio API — `/portfolio/v1/`

API publique servant signaux et equity des 6 modes.

- **Modes (6)** : `turbo`, `dynamic`, `balanced`, `secured`, `fortress`, `tkl` — paramètres dans `data/modes-config.json` (ajustés par sweep + recalibrage régime)
- **Endpoints par mode** : `/portfolio/v1/{mode}/[signals|positions|equity|orders|actions|trades|risk|winning-streaks|all].json`
- **Documentation** : `https://articles.dailytickers.com/integrations/portfolio/`
- **Génération** : `node tools/gen-api.js` (dépend de `backtest-trades.json` et `scanner-positions.json`)
- **Telegram topics** : turbo/dynamic→89, balanced→90, secured/fortress→91, **tkl→1064** (env: `TELEGRAM_TOPIC_<MODE>`)
- **Recalibration régime** : `node tools/regime-recalibrate.js` détecte changements régime (RECOVERY ↔ RISK-ON ↔ RISK-OFF) et propose nouveau set params depuis `data/backtest-results.json#advisor_*`. Append-only dans `portfolio/v1/config-history.json` — historique jamais écrasé.
