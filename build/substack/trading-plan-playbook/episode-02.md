---
title: "Define a Setup Another Trader Could Reproduce"
subtitle: "Separate market context, eligibility conditions, the trigger, and invalidation."
module_id: "trading-plan-playbook"
episode_number: 2
source_path: "series/plan-de-trading/part2-edge-setups/index.html"
---
*Part 2 of 6 in Build a Trading Plan You Can Execute.*

Hand your setup to somebody else. If they take a different trade, or ask you what you meant by "strong",
the setup is not written yet. It is a feeling wearing the clothes of a rule.

Compare the two columns of the same idea. Vague: the trend is up. Written: the price closes above its
50-day average, and that average has been rising for 10 sessions. Vague: it broke out on volume. Written:
the price closes above the highest close of the last 20 sessions, and that day's volume is at least 1.5
times the average of the previous 20 sessions. Vague: it isn't stretched. Written: the price is no more
than 8% above its 20-day average. Each line on the right answers yes or no. Nothing on the left does.

![Size decides what a bad night costs you](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/position_sizing.png)

Keep three words apart, because people use them interchangeably and then argue past each other. A
**hypothesis** is why a behaviour might keep happening. A **setup** turns it into conditions you can check.
An **edge** is a favourable distribution measured from a real record, after costs, with the uncertainty
stated. One winning trade proves none of the three.

Write the specification in this order:

1. Eligible instruments and exclusions, including liquidity and event rules.
2. Context, using only data available before the decision.
3. Every required condition, in values you can recover from the record later.
4. The trigger, and the last moment it stays valid.
5. Invalidation, chosen without reference to the size you would like.
6. How fills, costs, exits and skipped signals get recorded.

A worked example, from a breakout template: the reference index must close above its 200-day average, or
the setup is switched off entirely. The stock closes above a rising 50-day average. It has consolidated for
at least 15 sessions, and the high of that consolidation was written down beforehand. Price is under 8%
above its 20-day average. Trigger: a daily close above that recorded high on volume of at least 1.5 times
the 20-day average, not an intraday spike that fades. Invalidation before entry: a close back under the
level. After entry: a close under the low of the consolidation. Target far enough away to give at least two
units of reward per unit of risk.

Seven boxes. All seven, or no trade. Five to seven is the working range: pile on fifteen conditions and you
will quietly tolerate breaking a few, which returns you to guessing.

Company facts deserve the same discipline. Use filed documents, not a summary somebody posted. SEC
materials describe Forms 10-K and 10-Q as periodic reports, and Form 8-K as the place current material
disclosures appear. Record the accession number or direct link and when it became public. A filing that
appeared afterwards cannot justify a decision you already made.

There is an arithmetic reason to run one setup rather than ten. Spread 100 trades across ten setups and
each gets 10 examples, which tells you nothing. Run the same 100 through one setup and you can measure it.

Before you accept a setup, check:

- Can every condition be marked true or false from data available at the time?
- Are skipped signals kept, not quietly deleted?
- Do costs and failed executions appear?
- Does invalidation come from the thesis, or from the share count you wanted?
- Would you still apply the rule after it produced an ugly result?

**Limitation:** reproducibility is not value. A rule can be perfectly clear and still lose money.
Participants, volatility, costs and market structure change, and a narrow sample can be dominated by one
company or one calm year. Treat the written setup as a claim to be tested, never a law.

Sources: [Investor.gov: Public Companies](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/public-companies); [Investor.gov: How to Read an 8-K](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/how-read-8)

Educational, not investment advice.
