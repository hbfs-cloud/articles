---
title: "Make Placement Idempotent"
subtitle: "Every retry must reconcile first and remain blocked when broker acceptance is unknown."
series_id: "retail-systematic-desk"
module_id: "broker-execution"
module_title: "Connect a Broker Without Losing Control"
module_episode: 2
episode_number: 38
scheduled_at: "2027-05-21T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Connect a Broker Without Losing Control. Lesson 38 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 38 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

One day your connection drops mid-request and you will not know whether the broker received it. That is this week's problem. Idempotent placement means the same instruction can be sent twice and still produce one order, never two.

**Input from last Friday:** the security and capability preflight you signed off on.

![Seal the evidence, not the story](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/evidence_chain.png)

**Friday deliverable:** A durable intent and deduplication record, owned by the desk operator and kept with the week's evidence.

## Build this

Write down what you meant to do before you touch the network. That is the intent: which book, which plan, which revision of that plan, which candidate, and the time window the order is allowed to live in. From those fields compute a fingerprint, a short code derived from the meaning of the order rather than from the moment you clicked. Same meaning, same code. Sort the fields in a fixed order and round numbers the same way every time, or the code drifts and a retry looks like a fresh instruction.

Ask the broker for an idempotency key whenever it offers one: a token the broker itself remembers, so it refuses your second copy. A code you compute at home proves nothing about an order you never saw acknowledged.

Keep at least: `desk_id`, `plan_id`, `revision`, `candidate_id`, `execution_window`, `fingerprint`, `broker_key`, `dedup_status`.

## Test it before moving on

Send one intent five times, shuffling the JSON field order on each attempt, and drop a timeout into the middle. One fingerprint, one live order. Then bump the plan revision and confirm the code does change.

Illustration only, figures invented to show the shape of the log rather than any market: a toy run across SYM_A and SYM_K logs 214 attempts, 9 retries after timeouts, 8 of them folded onto an order that already existed, and 1 left sitting in `unknown`. That last one is the good news. It blocked itself instead of guessing.

**Operating limit:** paper only, published as teaching material, with no live sizing or account identifier anywhere in the record.

Further reading: [Investor.gov on how an order gets executed](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order) and [FINRA on books and records](https://www.finra.org/rules-guidance/key-topics/books-records).

Educational, not investment advice.

## Release decision

**GO:** the shuffled-retry test yields one order, and the unknown case blocks placement on its own.

**NO-GO:** a greyed-out button in the broker's web page is not a duplicate control. It protects the page, not the account.

**Next Friday:** carry this record into Reconcile Intent With Broker Reality.
