---
title: "Four Ceilings for Position Size"
subtitle: "Stop distance is one ceiling; gap loss, liquidity, and shared exposures set the rest."
module_id: "market-checklist"
episode_number: 4
source_path: "series/marketwatch-checklist/part4-portfolio/index.html"
---
*Part 4 of 7 in The Market Checklist.*

::audience non_sub,free_sub
Each part stands on its own. This is 4 of 7 in The Market Checklist; earlier parts cover the groundwork but you can start here.
::end

Every new trade has four ceilings: the planned-stop loss, a stressed gap loss, concentration, and liquidity. You take the smallest one. Not the one you like — the smallest.

Work the stop ceiling with real numbers. Account of $100,000, risk budget of 1% per idea, so $1,000. Say the entry is $166 and the recent swing low sits at $159. Putting the stop exactly on the swing low is an invitation: those levels are obvious and they get hunted. Drop it half an ATR below instead — with a 14-day ATR of $4, that is $2 of cushion, so the stop goes at $157. Risk per share is $166 − $157 = $9. Position size is $1,000 ÷ $9 = 111 shares, or $18,426.

![Size decides what a bad night costs you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/position_sizing.png)

Which is 18.4% of the account, and in a defensive regime the cap per position is 15%. So the size drops to 90 shares, $14,940, 14.9%. You give up 21 shares. Real risk on 90 shares is $810, or 0.81% of capital. The stop math permitted 111. The rule permitted 90. Ninety wins.

Note what changed: not the trade, only the ceiling that bound it. Write down which ceiling set the final size, every time.

The gap ceiling is the one people skip. Freeze an adverse opening price before you review the candidate's permitted size, and record how you got it: event taxonomy, universe, lookback, sample count, tail statistic, worst observation, how you treated failures and delistings. Add a policy shock beyond the historical sample. If those inputs are missing, label the scenario insufficient and set the permitted overnight size to zero. Even a complete process yields a scenario-limited estimate, not a loss cap.

Concentration is where the illusion lives. Three energy names — a major, an explorer, a services company — feel like three independent bets. Measure them and the intra-sector correlation runs around 0.85. Functionally you hold about 1.5 positions on the price of oil, and if oil breaks they stop within minutes of each other. That is why the sector limit is three names, not a matter of taste. A geographic frame does similar work: five US, two European, one Asian, two thematic ETFs adds to ten, and ten is also about the number of positions one person can actually monitor.

There is a dated lesson behind that number. On 10 March 2026 the scan produced 13 qualifying setups instead of 10. The three extras were taken with whatever capital was left. They returned five stops and zero take-profits. Not bad luck — a construction error, sized by leftovers rather than by a ceiling.

Correlation estimates help expose duplication, but use them as diagnostics. State the window, return frequency, and data source, then add a plain factor map. Two positions with low historical correlation can still share one binary event.

**Sizing controls**

- Calculate the stop and gap ceilings from written scenarios, not from the size you want.
- Aggregate direct holdings, ETF overlap, options, and leverage before sizing.
- Group by shared drivers, not by ticker count.
- Cut risk per trade to 0.5–0.75% when volatility rises, rather than cutting the number of trades.
- Check spread, depth, and likely exit capacity.
- Record which ceiling bound the size.

Diversification reduces some concentration risk but cannot guarantee against loss. Correlations move toward one under stress. A broad ETF can trade away from its net asset value, and the liquidity you see on a calm afternoon can disappear. Where gap behavior is unknown or holdings are opaque, the valid size is zero until that changes.

Sources: [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk), [Investor.gov: Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation), [Investor.gov: Exchange-Traded Funds](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24).

Educational, not investment advice.
