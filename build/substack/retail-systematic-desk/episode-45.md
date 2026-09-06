---
title: "Promote From Replay to Live in Stages"
subtitle: "The capstone is a controlled operating process, not an autonomous bot."
series_id: "retail-systematic-desk"
module_id: "ai-lifecycle"
module_title: "Constrain AI and Promote Slowly"
module_episode: 3
episode_number: 45
scheduled_at: "2027-07-09T12:00:00.000Z"
send_email: false
---
*Part 3 of 3 in Constrain AI and Promote Slowly. Lesson 45 of 45 in Build a Retail Systematic Desk, Safely.*

Forty-four weeks, and the thing you have built is not a robot that trades for you. It is a routine you run, with brakes you installed yourself and can reach in the dark. That distinction is the whole course.

Nothing jumps from a backtest to real money. It walks: replay on old data, then watching live data without acting, then paper orders, then shadow mode where real decisions are recorded but never sent, and only then a small live pilot with a hard ceiling. Each step has an entry rule written before results arrive, a fixed observation window, a way back, and one named person who owns it. Write the promotion evidence first. Deciding what counts as success after seeing the numbers is how every desk fools itself.

![The smooth curve is the one you fitted](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/forward_vs_backtest.png)

**Input from last Friday:** the accepted review attestation.

**Friday deliverable:** a staged promotion dossier — the folder that says, per stage, what has to be true before the next one opens.

## Build this

The unglamorous half first. Keys scoped to one account. Secrets in a store, not in a file next to the code, with a rotation date somebody actually holds. Paper and live in separate processes, separate keys. Outbound traffic limited to the broker. Tokens stripped from logs. Backups restored at least once, because an untested backup is a rumour. A clock check, since a system quietly running four minutes behind is a different system. And a revoke path you can trigger from a phone.

Toy dossier, invented figures: 5 stages, 5 drills, 3 closed, 1 open on restart recovery, 1 not yet attempted. That is not four fifths ready. It is one stage from the end and stationary until the last two drills close.

### Minimum record

- `stage`
- `entry_criteria`
- `evidence_window`
- `security_gates`
- `rollback`
- `manual_revoke`
- `owner`
- `promotion_verdict`

## Test it before moving on

Rehearse the bad nights. Stale data with a market open. The same intent arriving twice. A fill without its protection attached. A crash mid-run, then restart. Each drill closes with evidence someone else can read, or the stage stays shut.

**Operating limit:** the dossier ends in paper mode. Nothing here is a live configuration or a claim about returns.

## Release decision

**GO:** accept the dossier when every required drill has closed and all eight fields are retained.

**NO-GO:** no system promotes itself. Widening real-money scope is a human decision, taken awake, on evidence — and the operational side deserves the same care as the market side ([FINRA: Cybersecurity](https://www.finra.org/rules-guidance/key-topics/cybersecurity); [NIST: What are Control Charts?](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc31.htm)). Educational, not investment advice.

**Next Friday:** nothing new arrives. Run what you built, keep it in paper, and let the record decide when it earns more.
