---
title: "Find Correlation and Hidden Factor Bets"
subtitle: "Ten tickers can still be one concentrated position."
series_id: "retail-systematic-desk"
module_id: "portfolio-risk"
module_title: "Control the Portfolio Before the Trade"
module_episode: 2
episode_number: 29
scheduled_at: "2027-03-19T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Control the Portfolio Before the Trade. Lesson 29 of 45 in Build a Retail Systematic Desk, Safely.*

Ten tickers, one bet. That happens whenever the names share a driver underneath: the same interest-rate story, the same oil price, the same crowded growth trade. A shared driver like that is what people mean by a factor. Counting names never finds it. Measuring does.

Two numbers carry most of the work. Correlation says how often two names move the same way at the same time. Beta says how far one name travels when the whole market moves one percent. Both wander over time, so treat them as the input to a limit, never as proof of diversification.

![Diversification is measured in calm and spent in stress](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/correlation_breaks.png)

**Input from last Friday:** the accepted stressed sizing sheet.

**Friday deliverable:** a factor-exposure stress map, owned by the desk operator and kept in the review bundle.

## Build this

Sort the book into buckets: sector, theme, market beta, currency, and the events already sitting on the calendar. Beside every correlation, print two things the number alone hides — the window it was measured over, and how many overlapping observations existed. Then shock whole buckets rather than single names.

Invented figures, for illustration: 14 positions, correlations over 120 sessions. On the account statement it looks like 14 bets. The map shows 9 of them in one bucket, 61% of the book, all leaning on the same rate story. Shock that bucket by three standard deviations and the map returns a 7.4% book loss, against the 1.8% you would have projected by adding the individual stops. SYM_K overlaps the others on only 38 sessions, so it comes back flagged low-coverage instead of being quietly averaged in.

### Minimum record

- `exposure_bucket`
- `weight`
- `beta`
- `correlation_window` — the stretch measured, not a default
- `coverage` — overlapping observations behind the number
- `stress_loss`

## Test it before moving on

Build a book on purpose from many names driven by one thing. If the map still calls it diversified, it is counting rather than measuring. Then shorten the history until coverage thins out: stated confidence has to fall with it, visibly.

**Operating limit:** the map caps new exposure and nothing else. It never sizes a trade, and none of these buckets describe a live account.

## Release decision

**GO:** accept when the single-factor book is exposed and all six fields survive in the retained output.

**NO-GO:** never call a book diversified from ticker count. On reading dependence off data honestly: [NIST: Scatter Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm). On what concentration does to a portfolio: [FINRA: Concentration Risk](https://www.finra.org/investors/insights/concentration-risk). Educational, not investment advice.

**Next Friday:** the accepted map goes into Gate Event Risk and Add Kill Switches.
