---
title: "Gate Event Risk and Add Kill Switches"
subtitle: "Known events and system health should override the urge to deploy capital."
series_id: "retail-systematic-desk"
module_id: "portfolio-risk"
module_title: "Control the Portfolio Before the Trade"
module_episode: 3
episode_number: 30
scheduled_at: "2027-03-26T12:00:00.000Z"
send_email: false
---
*Part 3 of 3 in Control the Portfolio Before the Trade. Lesson 30 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 30 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

A kill switch is a rule that stops the desk from taking on anything new once a line you drew in advance gets crossed. It is not a guarantee. Orders may not cancel; positions may not close.

Earnings dates, macro releases, a trading halt, a broker whose connection goes quiet — each changes execution risk far faster than a model that recalculates once a day. Those belong in the plan before an order exists, not in your judgement at the moment of placing it.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Input from last Friday:** the accepted factor-exposure stress map.

**Friday deliverable:** an event-and-kill-state runbook, owned by the desk operator and kept in the review bundle.

## Build this

Keep a calendar where every entry carries its source and how confident that source is. Define four separate actions, because collapsing them into one switch is how desks flatten a book they meant to freeze: halt new risk, cancel resting orders, reduce, flatten. Add a reduce-only mode, one named person allowed to lift the state, and a way to revoke the trading credentials by hand that does not run through the software you are trying to stop.

A rehearsal, with invented counts: 26 events on the coming fortnight, 22 confirmed against a filing, 4 known only from a secondhand mention. Those 4 veto entries in 4 names. The veto gets written as an event veto — never as "the strategy rejected it" — or next quarter's research reads a rejection that never happened. Then the outage drill: 9 cancel requests go out, 7 read back cancelled, 2 return unknown. Unknown is neither done nor failed. It freezes automatic repair and pages a human.

### Minimum record

- `event_type`
- `event_time`
- `entry_veto`
- `kill_state`
- `broker_action`
- `verification_state` — what the broker confirmed back, not what you sent
- `resume_rule`

## Test it before moving on

Three drills: a date you only half trust, a confirmed release, a broker outage mid-session. Every requested change must be read back from the broker before the runbook believes it happened.

**Operating limit:** kill states are declared before the session and lifted by a person, never by the code that tripped them. Paper drills only.

## Release decision

**GO:** accept when all three drills behave and the retained rows carry every field.

**NO-GO:** an unusually attractive candidate is not a reason to step around a kill state. That is the exact moment the switch exists for. On confirming a corporate event from the filing itself: [SEC: Form 8-K](https://www.sec.gov/info/edgar/forms/form8-k.pdf). On when the market is open at all: [NYSE: Hours and Calendars](https://www.nyse.com/markets/hours-calendars). Educational, not investment advice.

**Next Friday:** the accepted runbook goes into Simulate the Broker Before Connecting One.
