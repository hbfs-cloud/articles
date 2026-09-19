# KLAC capital and post-10-K SEC filing review

**Review date:** 2026-09-19  
**Scope:** the post-10-K primary-document slice returned in
`data/sec_evidence.json` (SHA-256
`c53ebc553d83ec544fb972e72c8e091c82910ecbccc9830c2caa617ccdff8194`),
filed from 2026-08-07 through 2026-09-16.  The prior 10-K was filed 2026-08-06
(accession `0000319201-26-000027`).  The archive and hashes are in
[INDEX.md](INDEX.md).

This is a reconciliation of the discovered set, **not** an exhaustive EDGAR
search or a statement that KLAC has no shelf, ATM, or other equity-financing
capacity.  The local insider facet itself reports `data_insufficient`, 5.645%
coverage and 310 failed filings (SHA-256 `b499fae25c1ccf0d9c856655eab764843cd24d3144f6240424b2dba8c3c63ca4`).
No web market numbers were used.

## What the discovered post-10-K inventory contains

The 28 archived records are **19 Form 4s and 9 Form 144s**.  No Form S-3,
S-8, 424B, 8-K, or other form appears in this particular returned slice.  That
last fact is limited to the 28 records; it does not establish the absence of
an active registration statement, plan capacity, or a company financing.

The Form 4 transaction rows sum, by SEC transaction code, to:

| Code | Shares | What this can establish |
| --- | ---: | --- |
| A | 983,319.979 | Reported acquisitions/awards or vesting; it is not evidence of a primary capital raise. |
| F | 306,154.136 | Dispositions to cover tax withholding on vesting; the forms describe withholding rather than an open-market employee sale or issuer financing. |
| S | 310,279 | Reported secondary sales by reporting persons. |

These categories must not be netted into a corporate issuance number.  The
Form 4s document insider and employee-plan activity; they do not say that the
company received the proceeds from the `S` transactions.

## Form 144 notices reconciled to reported secondary sales

Every one of the nine Rule 144 notices has an exact match in this set to a
Form 4 `S` transaction by sale date, quantity and stated value.  Form 144 is a
notice of a proposed sale; the matching Form 4 is the evidence that the listed
sale was reported as completed.

| Sale date | Reporting person | Shares | Form 4 price | Stated value | Form 4 / Form 144 accessions |
| --- | --- | ---: | ---: | ---: | --- |
| 2026-08-07 | Virendra A. Kirloskar | 2,405 | $197.57 | $475,155.85 | `0001193125-26-342331` / `0001959173-26-005794` |
| 2026-08-07 | Mary Beth Wilkinson | 21,831 | $197.57 | $4,313,150.67 | `0001193125-26-342339` / `0001959173-26-005796` |
| 2026-08-10 | Virendra A. Kirloskar | 529 | $204.56 | $108,212.24 | `0001193125-26-344581` / `0001959173-26-005833` |
| 2026-08-10 | Mary Beth Wilkinson | 1,661 | $204.56 | $339,774.16 | `0001193125-26-344579` / `0001959173-26-005862` |
| 2026-08-11 | Richard P. Wallace | 87,568 | $198.95 | $17,421,653.60 | `0001193125-26-346811` / `0001959173-26-005866` |
| 2026-08-11 | Ahmad A. Khan | 33,180 | $198.95 | $6,601,161.00 | `0001193125-26-346812` / `0001959173-26-005869` |
| 2026-08-12 | Bren D. Higgins | 31,500 | $209.87 | $6,610,905.00 | `0001193125-26-349139` / `0001959173-26-005917` |
| 2026-08-13 | Brian Lorig | 59,586 | $208.13 | $12,401,634.18 | `0001193125-26-352187` / `0001959173-26-005963` |
| 2026-09-15 | Richard P. Wallace | 72,019 | $171.88 | $12,378,625.72 | `0001193125-26-393053` / `0001959173-26-006969` |

The nine reported sales total 310,279 shares and $60,650,272.42 at the values
reported in the matching filings.  This is a narrow, filing-derived gross-sale
total, not a net-insider-flow conclusion.  In particular, it excludes the
many unavailable/failed historical filings flagged by the insider facet and it
does not offset grants, vesting, tax withholding, purchases, or changes in
beneficial ownership.

The latest pair concerns the President and CEO, Richard P. Wallace: the Form 4
reports a 72,019-share sale on 2026-09-15 at $171.88 and states that it was
made under a Rule 10b5-1 plan adopted on 2025-11-19.  The paired Form 144
identifies restricted-stock vesting from issuer compensation as the source.
That disclosure supports a planned secondary-sale description; it does not
support an unqualified sentiment inference.

## Employee equity versus issuer financing

The Form 4 `A` activity and Form 4 `F` tax withholding are consistent with
employee compensation, awards and vesting.  The paired Form 144/Form 4 `S`
records identify sales for the accounts of officers or employees.  None of
those forms records corporate cash proceeds, a new company share sale, an ATM
draw, convertible financing, warrant financing, or a public offering.

The already-reviewed FY2026 10-K primary research records 4.997 million net
shares issued under employee plans and 18.241 million shares repurchased in
FY2026, and says 91.5 million shares were available for future awards under the
2023 Incentive Award Plan at 2026-06-30.  That plan availability is employee
equity-plan capacity, not proof of an active issuer financing facility or
present-day capacity as of this review.  Its source trail is retained in
`.agent/analyses-refresh-20260919/klac-primary-research.md` (SHA-256
`b24e3c7c79a9b1940eda4d3967ed9e4d24c1cefd1945506bedb0ddd69536c144`).

## Concrete corrections for `capitalStructure` and `filings`

1. Add a dated, bounded filing statement: “The local post-10-K discovery
   (2026-08-07–2026-09-16) contains 19 Form 4s and 9 Form 144s.  Nine Form 144
   notices exactly reconcile to reported Form 4 secondary sales of 310,279
   shares; this is insider/employee activity, not company financing.” Link to
   this archive rather than describing the observation as an exhaustive SEC
   screen.
2. Distinguish employee-plan mechanics from funding.  Keep the 10-K’s 91.5m
   award-plan availability and FY2026 plan-share/repurchase figures only with
   their dates, and label them employee compensation/share-plan facts.  Do not
   call that amount an ATM, shelf, cash runway, or equity raise.
3. Do not infer “no active equity capacity” from this set.  A conclusion about
   a current shelf, ATM, prospectus supplement, S-8, or other financing needs
   a separately complete EDGAR/registration-statement review.
4. Preserve the insider limitation in the retail rendering.  The MCP insider
   facet is incomplete, so the verified nine-sale subtotal must not be rendered
   as an all-insider total, a net flow, or a broad management-sentiment signal.

