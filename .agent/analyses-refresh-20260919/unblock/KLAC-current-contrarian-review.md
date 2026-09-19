# KLAC current revision — Contrarian and Retail review

## Scope and decision

Reviewed the actual revision, not the prior August dossier:

- JSON: `analyses/KLAC/_runs/20260919-update/revision/KLAC.json` — SHA-256 `0b3ff71d7bb4a47e024930c8b99e41839d4b5f20b6b99c9a37ebaa42ca835aa6`
- HTML: `analyses/KLAC/_runs/20260919-update/revision/index.html` — SHA-256 `749a5fdb2ff0cf6e5a623c426b00a065629ae24e0599150fafb2c1339716dde3`
- Deterministic calculations: `revision/calculations.json` — SHA-256 `c2c7144c5a8d3f91aa0b78caa4de3f98a5ef1d731f5c28f1984581998cdb4618`
- Run record: `data/_collect.json` — SHA-256 `11c1117cb30b57bef68f054e315b8e4c03daccef34c0d4cf4858314b96f2fcff`
- Primary archive/index: `primary/INDEX.md` — SHA-256 `32ec4c845d5f8f738115404df09f71eff38b7df6499e7e1177934b536904994c`; capital review: `primary/KLAC-capital-update.md` — SHA-256 `2ecba0e569679853cd129570aba53c2a8d58a22e30d3f393b9cf1a14aff1280c`.

**Decision: BLOCK for final certification.** This is a review of the revised
artifact only; it is not a publication or an AQ attestation. The current
`no-trade` decision is directionally appropriate, but the items below must be
resolved before a final PASS can be considered.

The refreshed bar issue is not repeated as a finding. The current daily bar
ends on 2026-09-18 at `$176.99`, volume `20,054,800`; the header, return,
Wilder indicators, and recalculated EMA values agree with
`revision/calculations.json`. All 26 calculation-input hashes match their
listed files. The primary split event is established separately by the June 12
SEC 8-K (`0001193125-26-269375`); this does not by itself establish the
adjustment basis of every MCP series.

## Findings

| Severity | Finding and precise evidence | Required correction |
| --- | --- | --- |
| **BLOCK** | The required `RankBeta` call remains failed. In `data/_collect.json`, `blast-radius.rank_beta` is `required: true`, `ok: false`, with “stock fetch failed for US: upstream HTTP status 403” (run call at lines 525–533). The revision correctly says the selected economic universe does not replace broad discovery, but it cannot pass the run plan. | Recover and re-run the declared US-universe `RankBeta` source, retain its artifact/provenance, and regenerate the revision from the accepted run. Do not substitute the 20 selected comparisons or local regressions for the required rank. |
| **BLOCK for final AQ attestation** | No current `data/analyses-evidence/KLAC.json` is present for the revised JSON. `revision/calculations.json` is reproducible and its 26 input hashes match, but it is not the required number-level evidence sidecar: it does not map every published number to an artifact, source pointer, as-of, and source hash. The command procedure requires that pair before attestation. | Generate the evidence sidecar after the content is final, with the revised JSON hash and an evidence record for every displayed numeric value; then perform the named independent reviews against that exact JSON/evidence hash pair. |
| **MAJOR — retail anchoring** | The document says “AUCUN ORDRE ACTIF”, but the visible trade section still uses a price-ladder design with a blue `$189.75` entry card, red `$176.45` stop, green `$214.80/$219.03` targets, percentage gains, and displayed R/R. At the current close, the archived stop is only `$0.5401` / `0.306%` below price and the archived entry is `6.724%` above it. Faded opacity and labels reduce the risk, but the retained `tradeIdea` numeric fields remain easy to read as a live setup. | Render the archived proposal outside the active trade component: use a collapsed “archive / not executable” disclosure, omit green target styling and current R/R presentation, and set active entry/stop/target fields to null or an explicit unavailable state. Preserve archival values only with their 2026-08-27 close date and a statement that they must never be used to place an order. |
| **MAJOR — valuation stress math is mislabeled** | The fundamentals note calls `25x` “a 30% multiple compression, rounded to the nearest five.” From the reported `38.398731x`, `25x` is actually a `34.894%` multiple reduction. A literal 30% reduction is `26.879x`. The displayed conditional price `$114.90` and `-35.08%` are consistent with the 25x scenario, so the issue is the risk description, not the arithmetic of that 25x result. | Either use `26.88x` (or a disclosed rounded convention that remains near it) for a true 30% stress, or rename the existing scenario as a `34.9%` rounded-multiple stress. Keep the cash, debt, shares, EBITDA period, and non-forecast caveat adjacent to the figure. |
| **MAJOR — unjustified dilution badge** | `capitalStructure.dilutionRisk` renders as “modéré”, while the same paragraph says no fully diluted bridge is available at the reference date, the current available amount is uncertified, and the post-10-K corpus cannot exclude active registered issuance capacity. The primary capital review properly makes only bounded conclusions, but the badge conveys a broader certainty than those inputs support. | Change the badge to “non évaluable avec ce corpus” / “incomplet” until a dated fully diluted bridge and a separate complete registration-statement review exist. If a moderate rating is retained, state its exact measured scope and explicitly exclude current shelf/ATM capacity from the rating. |
| **MODERATE — risk scale conflicts with its label** | JSON has `riskScore: 5` and `riskProfile: "High"`; the HTML says “Profil de risque : Élevé” while the 0–10 gauge renders 5. The gauge color bands place 5 at the blue/medium threshold, with orange/red reserved for higher values. A reader receives two incompatible severity signals. | Define the score scale in the article and make the textual profile, cards, and gauge use the same threshold. If “Élevé” is qualitative rather than score-derived, remove or relabel the numerical gauge so it cannot be interpreted as the same measure. |
| **MODERATE — split claim needs its proximal primary citation** | The revision prudently says that short-history adjustment remains unreconciled and makes no squeeze call. It also explains that a split changes units without economic dilution, but its capital and short source lists point only to the 10-K/MCP. The direct 10-for-1 event proof is the June 12 8-K (`0001193125-26-269375`), while the bar/short adjustment basis is still not certified. | Add the direct 8-K link and date wherever the split is invoked. State separately: “the corporate action is confirmed; adjusted/unadjusted basis of each MCP series remains unverified.” Do not infer a pre/post-split short trend until that basis is documented. |

## Contrarian and retail assessment

The revision materially improves the prior state in ways that should remain:

- It keeps the completed-bar close separate from the distinct `$176.75`
  post-close composite quote.
- It does not turn the repaired technical calculation, pattern-scanner signal,
  options snapshot, FINRA short volume, or selected-peer regressions into an
  executable order.
- The capital review correctly distinguishes employee awards, tax withholding,
  and 310,279 shares of matched secondary sales from corporate financing, and
  limits the conclusion to the reviewed filing slice.
- It identifies the next earnings date as provider-supplied and unconfirmed by
  the issuer, so an event veto remains necessary.

No additional current trade protocol is required while status is `no-trade`.
If a trade is later proposed, it must replace the archive display with a
fresh, quote-timestamped entry, observable confirmation, invalidation, stop,
targets, R/R, gap response, bid/ask and depth observation, maximum slippage,
risk-per-trade sizing, no-chase condition, and issuer-confirmed event veto.

Until the two BLOCK items are cleared, and the major presentation and
valuation fixes are incorporated into the same hashed artifact, this revision
must not receive a final PASS.

