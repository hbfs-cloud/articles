---
title: "Persist State, Validity and Revisions"
subtitle: "A stateful strategy cannot be reconstructed safely from broker positions alone."
series_id: "retail-systematic-desk"
module_id: "decision-contract"
module_title: "Make Strategy Decisions Machine-Readable"
module_episode: 2
episode_number: 23
scheduled_at: "2027-02-05T13:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Make Strategy Decisions Machine-Readable. Lesson 23 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 23 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

Between two runs the engine has to remember things. When a position was opened. Where the trailing reference sits. Whether a cooldown is still counting down, or a risk halt is on. All of that together is the state.

<mark>Rebuilding it from what your broker shows is guesswork.</mark> The broker knows you hold 30 shares of SYM_K — an invented example — and nothing else. It does not know that those shares came from the second revision of a plan whose cooldown ends Thursday.

![A layer must fail loudly or not at all](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/layers_fail_safe.png)

**Input from last Friday:** the accepted versioned configuration schema.

**Friday deliverable:** one supersession record, meaning a written note that plan B replaces plan A and plan A is now dead, filed with the week's paperwork.

## Build this

Keep one state object per book, one book being one portfolio's worth of positions. Treat it as sealed: the engine that wrote it is the only thing allowed to look inside. Save it after a decision completes, never before, and hand it back untouched on the next run. Each plan carries an id, a revision number, its validity dates, and the id of the plan it supersedes. Broker snapshots live in a separate file as evidence, never as the source of truth.

### Minimum record

- `plan_id`
- `revision`
- `state`
- `valid_from`
- `valid_until`
- `supersedes_plan_id`

## Test it before moving on

Kill the process between two decisions, restart, and demand the same state back. Toy figures, invented for the drill: 12 stored keys went in, 12 came out identical, one of them a cooldown with two days left on it. Next, send revision 2 after revision 3 has already landed — refused, out of order. Last, take a plan whose validity ended yesterday and try to create an order from it. Refused, with the reason written to the log rather than swallowed.

**Operating limit:** the whole drill runs on paper with fabricated records. No account, no position size, no deployed configuration appears anywhere in it.

Background: [what brokers must keep, and for how long](https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements) and [the books-and-records idea in its regulatory form](https://www.finra.org/rules-guidance/key-topics/books-records).

Educational, not investment advice.

## Release decision

**GO:** state survives the restart byte for byte, out-of-order revisions bounce, and expired plans cannot arm anything.

**NO-GO:** do not reconstruct missing state from current holdings, and do not let a note in a chat thread stand in for a stored revision.

**Next Friday:** the accepted record carries into Use a Complete Machine-Readable Plan.

> Holdings tell you what you own, never why you own it.
