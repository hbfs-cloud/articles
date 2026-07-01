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
- **Bull** : gate 8× CORRECT (le scanner Go americanbulls impose min_vol_ratio:8.0 en gate DUR — la mémoire `bull-8x-parity` est JUSTE). Vrai bug = notre candlestick-scanner appliquait un filtre liquidité P80≥\$1M INCONDITIONNEL que la config Go n impose pas → on droppait ADSE (\$104K). Fix: filtre P80 conditionnel (default OFF). ADSE reproduit rang #1, parité FULL. (ADSE 7.8× = décalage de date: 12.48× le 29/06 accepté par les deux.)
- Momentum : scoring off-scale (135-160) → gate minScore inerte.
- ETF : on entre en surachat (RSI 83-89) que le PM ne prend pas (il avait tout liquidé au 29/06).
- Book-state : nos modes en `test`/cold-start (book vide) → TSS place surtout des stops/sorties sur des positions qu'on ne tient pas.
- **momentum-rotation + eu-trend(trendline) sont EU-only** dans systematic-tss ; pas de config US. Le user veut momentum/trendline en **EU ET US**.

**Technique de vérif (CLÉ) :** `cmd/backtest` systematic-tss tourne HORS-LIGNE sans Infisical (dont le cert btw.cloud.hbfs-cloud.net est expiré) via un `.env` VIDE + unset des vars Infisical : `env -u INFISICAL_CLIENT_ID -u INFISICAL_CLIENT_SECRET -u INFISICAL_API_URL -u INFISICAL_PROJECT_ID /tmp/bt --env /tmp/empty.env --config <cfg> --start ... --end ... --export-snapshots <dir>`. Le snapshot le plus récent → `pending_orders` = les ordres pré-open (Symbol/OrderType/Side/LimitPrice/Qty). Données US cachées OK ; données EU (secmaster FR/DE) renvoient 404 hors-ligne → EU non backtestable sans l'infra data.

**⚠️ RÈGLE ARCHI (user 2026-07-01) : articles reste INDÉPENDANT de systematic-tss.** systematic-tss sert UNIQUEMENT à COMPARER/valider — JAMAIS une dépendance runtime. Donc le fix = **corriger nos scanners JS pour qu'ils produisent NATIVEMENT les mêmes ordres** (approche "ports fidèles"), pas consommer la sortie du moteur Go en prod. `tools/tss-orders.js` = harness de comparaison dev-time (run le backtest TSS offline → ordres de référence), pas un pont de production.

**Fix cible :** aligner l'entrée (candidats du scanner JS) sur les BUY du PM systematic-tss (ex Bull: filtre liquidité inconditionnel à retirer, gate 8× conservé) ; les sorties/stops sont gérés par notre position-management sur NOTRE book. Le book converge : si on place les mêmes entrées, on tient les mêmes positions → les sorties matchent. Valider chaque scanner contre `tss-orders.js`.

**⚠️ DATE DE DÉPART (opération quotidienne) :** le book s'accumule depuis l'**inception** (= `statusSince` du mode dans modes-config.json ; bull=2026-06-05, autres=2026-06-29). Chaque jour D, pour les ordres de **D+1**, on relance le backtest de `<inception>` → D. Sans start fixe, le book (positions/stops) diverge → ordres de sortie faux. `tools/tss-orders.js` lit `statusSince` en défaut de `--start` + mappe mode→config (MODE_CONFIG). Opération quotidienne : `node tools/tss-orders.js --mode <mode> --end <jour D>`.

**How to apply :** Ne PAS juger la parité d'un mode scripté au compte de signaux ni au niveau pattern (ab-scan) — comparer les ORDRES pré-open du PM. Configs US qui tournent offline : `portfolio_us_americanbulls`(bull), `portfolio_us_highvol`(highvol), `pre-live/portfolio_etf_us`(etf). Lié à [[bull-8x-parity]] (confirmée JUSTE) et [[runscreener-dsl-calibration]].
