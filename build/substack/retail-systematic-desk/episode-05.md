---
title: "Facts, Decisions and Orders Are Different Objects"
subtitle: "Keeping three records prevents explanations from mutating into instructions."
series_id: "retail-systematic-desk"
module_id: "boundaries"
module_title: "Separate Data, Decisions and Execution"
module_episode: 2
episode_number: 5
scheduled_at: "2026-10-02T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Separate Data, Decisions and Execution. Lesson 5 of 45 in Build a Retail Systematic Desk, Safely.*

A closing price is a fact. A ranked shortlist is an opinion. An order is an instruction that money obeys. Same evening, same symbol, three objects with three owners — and the accident to prevent is one quietly being promoted into the next.

Toy records, invented, trimmed to the fields that carry weight:

![A fact is not a decision, and a decision is not an order](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/decision_flow.png)

```
fact      f_1183   source vendor_a   observed 21:05   close of SYM_A
decision  d_402    reads f_1183      stop attached    valid until next open
order     o_77     reads d_402       limit, day       key d_402-1
```

That last field is an idempotency key: a label saying this is the same instruction, so a retry after a timeout cannot open the position twice. The validity line matters just as much. A decision expires. Last week's plan does not become current tonight because the quote looks familiar.

**Input from last Friday:** the accepted service-boundary diagram.

**Friday deliverable:** a three-schema contract pack, owned by the desk operator and kept in the review bundle.

## Build this

Three schemas, linked by identifiers instead of copied text. Facts carry where they came from and when they were observed. Decisions carry the reason, the gates passed, an expiry, and a pointer to the exact snapshot they read. Orders carry only fields your broker genuinely supports, plus the key above. Nothing downstream reads a sentence to work out a quantity.

### Minimum record

fact id and source; decision id and validity; order fingerprint and broker id.

## Test it before moving on

Break each object on purpose. Delete the source from a fact, the stop from a new long plan, the key from an order. Three tests, three red lights. In a toy suite of 14 contract tests those 3 are the ones nobody may wave through for now; the morning they go amber, the pack has stopped being a contract.

**Operating limit:** teaching skeletons on paper. Field names, not tuned settings, and no account details anywhere.

Ten minutes each: [order types, plainly stated](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders), and [FINRA on reading a trade confirmation](https://www.finra.org/investors/insights/checking-trade-confirmations) — which is exactly what your execution report should match, line for line.

Educational, not investment advice.

## Release decision

**GO:** the three deliberate breakages all fail, and every stored object matches the minimum record.

**NO-GO:** never read an operational instruction out of a human-readable reason when the structured field is absent.

**Next Friday:** the contract pack goes into Let Each Layer Fail Without Lying.
