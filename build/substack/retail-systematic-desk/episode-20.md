---
title: "Test the Sector, Leaders and Blast Radius"
subtitle: "Peers can confirm context without becoming proof of causality."
series_id: "retail-systematic-desk"
module_id: "certification"
module_title: "Turn Candidates Into Conditional Plans"
module_episode: 2
episode_number: 20
scheduled_at: "2027-01-15T13:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Turn Candidates Into Conditional Plans. Lesson 20 of 45 in Build a Retail Systematic Desk, Safely.*

Every number below is invented to show the shape of the work. Made-up tickers, made-up history, no market data.

In the toy run, SYM_A arrived from certification with a peer file of 41 companies: 6 direct competitors, 4 suppliers, 3 customers, 12 same-sector names of similar size, and 16 that were only there because a screener had grouped them. Twenty-two had enough shared history to compare at all. Nine of those moved in step with SYM_A most of the time. Then I subtracted the part of each move that the whole market already explains, which is what people mean by residualising. Two were left.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

Seven names changed status without changing behaviour. They were riding the same tide as everything else.

**Input from last Friday:** the accepted candidate certification sheet.

**Friday deliverable:** a peer map that names its yardstick, owned by the desk operator and filed in the review bundle, the folder holding everything a reviewer would need to redo the work.

## Build this

Sort peers by the economic link first: who competes, who supplies, who buys. Measure second. Write down the yardstick you subtract, how returns are computed, the window, what happens to missing days, and how much history two series actually share. The candidate's own calendar stays in charge of the conclusion. A peer can agree with you; it cannot be your reason.

### Minimum record

- `peer_id`
- `economic_role`
- `factor_model`
- `return_convention`
- `window`
- `residual_method`
- `coverage`

## Test it before moving on

Push a fake market-wide rally through the synthetic series and watch what breaks. Raw co-movement for SYM_K climbed from 0.31 to 0.78 in the toy run; the residual number barely moved, 0.29. A screen that shows the 0.78 and calls it conviction is a broken screen. Run the same check on thin data: SYM_D shared 61 days inside a 250-day window, so the map has to print "thin" beside it instead of a rank.

**Operating limit:** this map sizes nothing, names no real security and never leaves paper. Plumbing under test, not an edge.

Background reading: [NIST: Quantitative Techniques](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35.htm); [SEC: Asset Allocation, Diversification, and Rebalancing](https://www.sec.gov/investor/pubs/assetallocation.htm)

Educational, not investment advice.

## Release decision

**GO:** accept the peer map once the rally test passes and the retained file carries all seven fields.

**NO-GO:** never turn one proxy move into an automatic instruction for another security.

**Next Friday:** carry the accepted peer map into Turn Price Levels Into Conditional Plans.
