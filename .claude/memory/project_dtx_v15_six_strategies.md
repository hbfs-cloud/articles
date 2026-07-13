---
name: dtx-v15-six-strategies
description: 2026-07-13 cut-over — scanner dashboard/API réduits aux 6 stratégies dtx cost-honest ; anciens scriptings stopped
metadata: 
  node_type: memory
  type: project
  originSessionId: 326b0558-edd5-46c0-971d-9389f3e9b3a0
---

**2026-07-13 — dtx MCP v15 (cost-honest) cut-over.** Le moteur systematic-tss v15 (spread 10bp + stamp 50bp, participation 10%, TOTAL_RETURN, PIT membership NDX, frozen 2026-07-08) ne valide plus que **6 stratégies** viables. Le dashboard `scanner/status` + `portfolio/v1` ont été réduits à ces 6 ; **tous les anciens scriptings scanner** (turbo, dynamic, balanced, secured, fortress, aplus, hybrid, highvol, etf, etf_eu, forex, stockbox, tkl, alpha, factor, pead, filings, gap, eu_smallcap) passés en `status:stopped` (historique immuable conservé, `publiclyVisible:false`, cachés du dashboard via `NON_PUBLIC_STATUSES`).

Les 6 live (ids frais 1:1 mode==dtx portfolio==staging file), métriques v15 re-mesurées via `DtxReplay` from 2021 :
- `book_honest` 57.7%/DD21.2/Sh1.41/R²0.93 (blend hv30/sbp30/etf20/ep15) — LE CORE
- `us_highvol` 81.3/28.6/1.77/0.93
- `hvep` 75.9/28.2/1.83/0.95 (hv70+ep30)
- `stockbox_pit` 40.0/21.8/1.37/0.86 (index-rotation PIT)
- `etf_us` 37.1/20.2/1.43/0.74
- `ep` 26.6/25.2/1.08/0.95

Mécanique : `data/modes-config.json` (6 live + 19 stopped) ; `DTX_STAGING_MAP` dans `tools/gen-status-page.js` = identity sur les 6 ; staging v15 committée dans `data/dtx/<id>.json` (whitelist `data/dtx/.gitignore` mise à jour ; la cloud pipeline LIT la staging committée). Staging morte supprimée (forex, etf_eu, stockbox_nasdaq→renommé stockbox_pit, crypto/jp/uk/eu_dax/eu_uk/in/metals/us_ablite). Books multi-sleeve (book_honest, hvep) : `extractReplayMetrics` lit `results[0]` donc badges = vraies métriques combined, courbe = blend rebasé 100k (biais DD ~2-4pt vs badge, normal en biweekly). QA `qa-check` ❌0 (SEALED-PRIMARY ✅ car ids frais = 0 sealed sweep). Commit `scanner(dtx-v15)`.

Tuées cost-honest (honnêtes mais sous barre) : uk (stamp 0.5%), forex (-5%, edge<spread), etf_eu, jp, crypto, momentum_explosion, parallel_book, optimal_honest. Vérolées look-ahead retirées : tous les anciens "meilleurs candidats" (fonds_mohamed, arsenal_mindd, survivor, idx_sp500_rotation…). Voir [[dtx-mcp-only-engine]] et [[bull-8x-parity]].
