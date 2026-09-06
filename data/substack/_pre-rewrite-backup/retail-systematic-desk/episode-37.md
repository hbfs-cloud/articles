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

Order types, extended hours, fractional quantities and native protection vary by account and venue. Before any real credential is connected, establish least privilege, secret storage and rotation, paper/live isolation, controlled egress, redacted audit logs and an independent revoke path. A generic broker label is not enough.

**Input from last Friday:** The accepted terminal run envelope.

**Friday deliverable:** A broker security and capability preflight, owned by the desk operator and retained in the review bundle.

## Build this

Complete the security baseline, then fetch capabilities and account safety state at run start and again before mutation. Classify unsupported requirements precisely. Never downgrade a protected order to a weaker local approximation in silence.

### Minimum record

- `account_id`
- `credential_scope`
- `revoke_path`
- `capability`
- `supported`
- `session_state`
- `safety_state`

## Test it before moving on

Ask a limited adapter to execute a plan requiring unsupported protection. It must refuse before entry. A reduction or close may follow a separate contract that does not require new-position protection.

**Operating limit:** The broker security and capability preflight is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the broker security and capability preflight (context, not implementation evidence):** [Investor.gov: Types of Orders](https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders); [FINRA: Extended-Hours Trading](https://www.finra.org/investors/insights/extended-hours-trading)

Educational, not investment advice.

## Release decision

**GO:** Accept the broker security and capability preflight only when the test above passes and its retained output matches the minimum record.

**NO-GO:** If required-before-fill protection cannot be guaranteed, reject the candidate.

**Next Friday:** Carry the accepted broker security and capability preflight into Make Placement Idempotent.
