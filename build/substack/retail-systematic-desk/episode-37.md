---
title: "Check Broker Capabilities Before Placement"
subtitle: "Account and venue support must be discovered for every execution run."
series_id: "retail-systematic-desk"
module_id: "broker-execution"
module_title: "Connect a Broker Without Losing Control"
module_episode: 1
episode_number: 37
scheduled_at: "2027-05-14T12:00:00.000Z"
send_email: false
---
*Part 1 of 3 in Connect a Broker Without Losing Control. Lesson 37 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 37 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Two accounts at the same broker do not do the same things. One accepts an entry with its protective exit attached, handled broker-side. The next accepts the entry and silently drops the exit. Fractional quantities, session hours, which exit types are native: all of it varies by account, by venue, occasionally by the week.

Discovery is therefore not setup work you do once. It runs at the start of every session and again immediately before anything is placed.

![Every order ends reconciled](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/order_state_machine.png)

Toy preflight, invented figures: 14 capabilities queried, 11 supported, 2 unsupported, 1 returning nothing at all. Unknown is not a soft yes. It is refused until somebody answers the question.

**Input from last Friday:** the accepted terminal run envelope.

**Friday deliverable:** a broker preflight report, owned by the desk operator and kept in the review bundle.

## Build this

Before the first real credential exists, the unglamorous half. Least privilege, meaning the key can trade this one account and do nothing else. Secrets in a store rather than a file beside the code. A rotation date in the calendar. Paper and live in separate processes with separate keys, so a mistyped flag cannot cross the line. Outbound traffic limited to the broker's endpoints. Tokens stripped from logs. And a revoke path that works from a phone at three in the morning.

Then query capabilities and account state at run start and again before every change, storing the answers with the run rather than in somebody's memory. Classify precisely: which capability, which account, which venue, which session.

Never approximate a protective exit in silence. A local imitation exists only while your process is alive, and that difference surfaces on exactly the day your process is not.

### Minimum record

- `account_id`
- `credential_scope`
- `revoke_path`
- `capability`
- `supported`
- `session_state`
- `safety_state`

## Test it before moving on

Hand a deliberately limited adapter a plan requiring broker-side protection. It must refuse before the entry, not after. Before is the entire test.

Then check the asymmetry: reducing or closing an existing position runs under a different contract, one that does not demand new protection. A system that cannot exit is worse than one that cannot enter.

Last, the clock. A price-capped order valid only in the regular session behaves differently when the run drifts past the close ([Investor.gov: Limit Orders](https://www.investor.gov/introduction-investing/investing-basics/glossary/limit-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)).

**Operating limit:** written against paper connections only, with no live credential, no account detail, no deployed configuration and no return figure. Educational, not investment advice.

## Release decision

**GO:** accept the preflight when the limited adapter refuses early and the retained output carries all seven fields.

**NO-GO:** if protection cannot be guaranteed before the fill, drop the candidate. Do not place the entry and improvise afterwards.

**Next Friday:** carry the accepted preflight into Make Placement Idempotent.
