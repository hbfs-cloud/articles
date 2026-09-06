---
title: "Four Ceilings for Position Size"
subtitle: "Stop distance is one ceiling; gap loss, liquidity, and shared exposures set the rest."
module_id: "market-checklist"
episode_number: 4
source_path: "series/marketwatch-checklist/part4-portfolio/index.html"
---

*Part 4 of 7 in The Market Checklist.*

Size every new trade against four ceilings: planned-stop loss, stressed gap loss, concentration, and liquidity. Use the smallest permitted size. A stop-distance formula alone assumes an orderly exit near the stop; that assumption fails when a security gaps, halts, or has too little depth for the order.

Write the variables before calculating shares:

- **L:** the loss budget for this idea.
- **E:** the highest acceptable entry price.
- **S:** the price where the thesis is invalid under normal trading.
- **G:** a defensible adverse gap price based on the instrument’s event and historical scenario set.

Freeze `G` before reviewing the candidate's permitted size. Record the event taxonomy, universe, lookback, sample count, tail statistic, worst observation, and treatment of failures or delistings. Then add an explicit policy shock beyond the historical sample. If those inputs are unavailable, label the gap scenario insufficient and set the permitted overnight size to zero. Even a complete process produces a scenario-limited estimate, not a loss cap.

For a long position, the normal-stop ceiling is `L / (E - S)` and the gap-stress ceiling is `L / (E - G)`. Reverse the price distances for a short position. Both are scenario calculations, not promises about execution. Next apply a concentration ceiling based on total exposure to the issuer, sector, country, currency, duration, or common catalyst. Finally, cap the order at a size that can be entered and exited without relying on one favorable quote.

**Worked micro-example:** A trader proposes a software stock while already holding a technology ETF and another software company. The standalone stop calculation permits the largest size, but the gap calculation permits less. Looking through the ETF reveals more exposure to the same industry, making the concentration ceiling smaller still. That smallest ceiling controls. The decision does not require claiming that the holdings will move together. It recognizes that a shared earnings, rate, or regulatory shock could affect them at the same time.

Correlation estimates can help expose duplication, but use them as diagnostics. State the measurement window, return frequency, and data source. Then add a plain-language factor map. Two positions with low historical correlation may still share a binary event; two stocks in one sector may have different revenue, currency, or duration sensitivities.

**Sizing controls**

- Calculate stop and gap ceilings from written scenarios.
- Aggregate direct holdings, ETF overlap, options, and leverage.
- Group positions by shared drivers, not ticker count.
- Check spread, depth, and likely exit capacity.
- Record which ceiling set the final size.

Diversification reduces some concentration risk but cannot guarantee against loss. Correlations can change during stress, and a broad ETF can trade away from its net asset value. Liquidity visible in normal conditions can also disappear. For instruments with uncertain gap behavior or opaque holdings, the valid size may be zero until the uncertainty is resolved.

Sources: [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk), [Investor.gov: Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [Investor.gov: Exchange-Traded Funds](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24).

Educational, not investment advice.
