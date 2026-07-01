---
name: scripted-modes-tss-order-parity
description: Les modes scriptés (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) doivent RÉPLIQUER les ordres BUY/SELL du lendemain de systematic-tss, pas re-dériver avec nos scanners JS. Parité 0% actuelle.
metadata:
  type: feedback
---

**Architecture (clarifiée par le user 2026-07-01) :** deux natures de "signaux" selon le mode.
- **Modes quality** (turbo/dynamic/balanced/orbit/fortress/A+) : signaux = CANDIDATS de setup issus de RunScreener+quality. A+ a son propre sub-skill (aplus-setups).
- **Modes scriptés** (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) : signaux = **les ordres BUY/SELL concrets à placer pour l'open du lendemain**, qui doivent **répliquer fidèlement systematic-tss** (le système est la source de vérité). Pas de notion "BUY-IF" — ce sont des ordres fermes (LIMIT/MARKET/STOP), entrées BUY + sorties SELL/stops des positions tenues.

**Découverte (parité vérifiée 2026-07-01) : 0% d'overlap d'ordres sur les 6 modes scriptés.** Nos scanners JS ont DIVERGÉ de leur PM systematic-tss :
- Bull : `candlestick-scanner.js` gate **8× dur** rejette ce que le PM score-based accepte (ex ADSE vol 7.8× → TSS place un BUY LIMIT, nous 0). **La mémoire `bull-8x-parity` est FAUSSE au niveau ORDRE.**
- Momentum : scoring off-scale (135-160) → gate minScore inerte.
- ETF : on entre en surachat (RSI 83-89) que le PM ne prend pas (il avait tout liquidé au 29/06).
- Book-state : nos modes en `test`/cold-start (book vide) → TSS place surtout des stops/sorties sur des positions qu'on ne tient pas.
- **momentum-rotation + eu-trend(trendline) sont EU-only** dans systematic-tss ; pas de config US. Le user veut momentum/trendline en **EU ET US**.

**Technique de vérif (CLÉ) :** `cmd/backtest` systematic-tss tourne HORS-LIGNE sans Infisical (dont le cert btw.cloud.hbfs-cloud.net est expiré) via un `.env` VIDE + unset des vars Infisical : `env -u INFISICAL_CLIENT_ID -u INFISICAL_CLIENT_SECRET -u INFISICAL_API_URL -u INFISICAL_PROJECT_ID /tmp/bt --env /tmp/empty.env --config <cfg> --start ... --end ... --export-snapshots <dir>`. Le snapshot le plus récent → `pending_orders` = les ordres pré-open (Symbol/OrderType/Side/LimitPrice/Qty). Données US cachées OK ; données EU (secmaster FR/DE) renvoient 404 hors-ligne → EU non backtestable sans l'infra data.

**Fix cible :** câbler les modes scriptés sur les ordres systematic-tss (`cmd/backtest --end <dernier jour> → pending_orders` → nos ordres du lendemain), pas nos scanners JS. Le book converge en plaçant fidèlement ses ordres chaque jour.

**How to apply :** Ne PAS juger la parité d'un mode scripté au compte de signaux ni au niveau pattern (ab-scan) — comparer les ORDRES pré-open du PM. Configs US qui tournent offline : `portfolio_us_americanbulls`(bull), `portfolio_us_highvol`(highvol), `pre-live/portfolio_etf_us`(etf). Lié à [[bull-8x-parity]] (à corriger) et [[runscreener-dsl-calibration]].
