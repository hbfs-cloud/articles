---
title: "Draw Hard System Boundaries"
subtitle: "Data collection, strategy decisions and broker actions should be separate services."
series_id: "retail-systematic-desk"
module_id: "boundaries"
module_title: "Separate Data, Decisions and Execution"
module_episode: 1
episode_number: 4
scheduled_at: "2026-09-25T12:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Separate Data, Decisions and Execution. Lesson 4 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 4 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Four walls, minimum. A fifth thing, the screen, explains the state of the desk and owns none of it.

| Layer | Owns | Must never |
|---|---|---|
| Facts | prices, calendars, filings | judge a candidate |
| Research | scores and shortlists | send an order |
| Decisions | the plan: what, how much, which stop | invent a price it did not receive |
| Execution | broker calls and fills | repair a missing field by guessing |
| Screen | the view | become the source of truth |

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

Why bother. A toy incident, times invented, shape ordinary: the price feed dies at 14:12. Facts stop arriving. The decision layer produces no plan and says exactly why. The screen turns amber and prints stale. The ledger, meaning the record of what is actually held, changes zero rows. An outage became an abstention instead of a fabrication, and that is the entire return on this week's work.

**Input from last Friday:** the accepted instrument eligibility table.

**Friday deliverable:** a service-boundary diagram, owned by the desk operator and kept in the review bundle.

## Build this

Draw the boxes, then draw the objects that travel between them, which matters more. Each arrow is a versioned contract: an agreed message shape with a number attached, so a reader can tell whether it received the old shape or the new one. A paragraph of prose sitting in a field is not a contract.

### Minimum record

facts snapshot, candidate record, decision plan, execution report, display projection.

## Test it before moving on

Point at every number on the screen and name the object it came from. Anything untraceable is a number the screen invented. Then switch off one layer at a time in a test environment. Kill the renderer: the ledger must show zero changed rows. Kill the broker: the decision layer must report unavailable, never a fill it never received. In a toy pass, 5 of 6 screen fields traced back cleanly; the sixth, an estimated total, had no owner, so it was deleted rather than explained.

**Operating limit:** paper only. No live broker credential belongs anywhere near this drawing.

Background worth reading once: [FINRA on books and records](https://www.finra.org/rules-guidance/key-topics/books-records), and [how an order actually gets executed](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order).

Educational, not investment advice.

## Release decision

**GO:** every screen field has a named owner, and each layer, disabled alone, degrades without touching the others.

**NO-GO:** one process that both invents a trade and certifies that it executed. Split it before anything else.

**Next Friday:** the diagram goes into Facts, Decisions and Orders Are Different Objects.
