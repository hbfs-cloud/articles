---
name: iso-cache-and-resync
description: Cache marketdata daté PIT-safe (price-cache.js) + système de resync iso (verify-iso.js + manifeste) alignant les scanners JS sur systematic-tss. 6 modes iso. Root bug récurrent = seuils hardcodés au lieu de lire scanner_filters.params.
metadata:
  type: project
---

Chantier 2026-07-06 : rendre le cache marketdata JS point-in-time et aligner les scanners scriptés à l'iso avec systematic-tss.

**Cache daté (`tools/lib/price-cache.js`)** : arbo `data/.price-cache/<YYYY-MM-DD>/<interval>/<market>/<ticker>.json` (array de bars), **troncature anti-look-ahead** (bar.date≤date), 2 formats (array scanners + date-keyed sweep via readHistory/writeHistory), TTL 12h le jour même seulement, fallback legacy lecture-seule. Marchés US/CVA/FX/CRYPTO. Câblé dans les 10 scanners + sweep + bvc + pit-*. Tue la pollution inter-dates (bugs SNA \$402 casablanca + SLS/highvol). `.price-cache/<date>` est gitignoré.

**Resync (`tools/verify-iso.js` + `data/iso-alignment.json`)** : diff candidats JS↔Go par mode, manifeste avec `tss_git_sha` + `config_sha256`, `--check-drift` alerte quand Go évolue. Mapping mode→config Go : highvol→portfolio_us_highvol.yaml (highvol-breakout-corr), etf→config/pre-live/portfolio_etf_us.yaml (etf-momentum), etf_eu→portfolio_etf_eu.yaml, forex→majeures, hybrid→trend-hybrid-af (délègue au fractal, non isolable par le harnais), stockbox→index-rotation (oracle `cmd/stockbox-overlap`, pas scanner-debug). Bug harnais corrigé : writeManifest MERGE par mode (n'écrase plus).

**Root bug récurrent (important)** : les scanners JS **hardcodaient les seuils DÉFAUT de Go** au lieu de lire `scanner_filters.params` de la config → divergence silencieuse. Ex etf_eu : `recovery_max_rsi` 48 (hardcodé) vs 45 (config) + `extreme_skip_neutral/early_riskoff` absents → classait des ETF que Go rejette. Fix : charger les params du YAML Go (js-yaml) par univers + fallback embarqué. **À vérifier sur tout scanner porté.** highvol : `passesSectorMcap` lisait un mcap faux (fetch live ticker-metadata.json).

**État** : 6 modes iso (highvol/forex/etf/etf_eu 100% mesuré, hybrid iso-logique, stockbox 8/8). Nouveau mode `stockbox` (top-8 Nasdaq momentum, live). Commit 6f8b1a9c8. Track-record data (backtest-*, trade-chain) NON committé (churn de test — régénérer par sweep propre + vérif chaîne SHA avant commit).

Lié : [[verify-iso-by-running]], [[scripted-modes-scorecard]], [[market-namespaced-price-cache]].
