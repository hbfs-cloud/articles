---
title: "Design Recovery and Supersession"
subtitle: "A restart must know which plan, revision and protection are active."
series_id: "retail-systematic-desk"
module_id: "ledger-operations"
module_title: "Keep an Audit Trail That Survives Incidents"
module_episode: 2
episode_number: 35
scheduled_at: "2027-04-30T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Keep an Audit Trail That Survives Incidents. Lesson 35 of 45 in Build a Retail Systematic Desk, Safely.*

Supersession is a long word for a plain rule. When a new version of the plan takes over, the old version stops existing, all at once. Half a swap is the dangerous state: you inherit the old exit level and the new position size, a combination nobody designed and nobody reviewed.

Recovery is that rule seen from the other side. A process coming back from a crash must be able to say which revision was in charge, what is actually working in the market, and whether every open position still carries its protective exit.

![You correct by adding, never by erasing](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/append_only_ledger.png)

**Input from last Friday:** the accepted checkpointed decision ledger.

**Friday deliverable:** a restart drill report, owned by the desk operator and kept in the review bundle.

## Build this

Fix the startup order and never vary it. Verify the ledger. Load the active revision. Ask the broker what it is actually holding. Reconcile the two pictures. Restore monitoring. Only then allow a new decision. A plan whose validity has expired stays readable and cannot act.

Reconciliation lives or dies on exact identifiers. Matching on "same symbol, roughly the same quantity" will invent a pairing eventually, and it will do it on the day two similar orders are open at once.

### Minimum record

- `active_plan`
- `revision`
- `group_state`
- `orders`
- `fills`
- `protection_state`

## Test it before moving on

Kill the process in the narrow window between the entry filling at the broker and your own system writing that fill down. Restart it.

With complete evidence, meaning the fill visible in broker history under identifiers that match exactly, the system recovers the fill, places the protective exit, reads it back from the broker, and closes the group. Read-back is not ceremony: an exit you sent is not an exit that exists ([Investor.gov: Stop Orders](https://www.investor.gov/introduction-investing/investing-basics/glossary/stop-orders)).

With incomplete evidence, it stays `unknown`, blocks every change and calls a human. A toy drill of 12 kills at randomised moments (invented figures): 9 resolved on their own, 3 escalated. Three hands-on escalations out of twelve reads like a healthy result to me, not a defect. A drill that always self-heals is usually a drill that is not aiming at the awkward moments.

**Operating limit:** paper drill, public architecture, no live account, no deployed setting, no return figure implied anywhere. Educational, not investment advice. On the general habit of doubting what an automated system claims to have done: [CFTC: Advisory on Automated Trading Systems](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html).

## Release decision

**GO:** accept the report when both branches behave and the retained output carries all six fields.

**NO-GO:** never leave two revisions active at the same time, and never merge candidates across them.

**Next Friday:** carry the accepted report into Make Every Run Auditable.
