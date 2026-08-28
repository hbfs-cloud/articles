# Analysis Quality Rubric - 2026-08-28

Status: mandatory publication gate
Checklist schema: `AQ-1`
Applies to: new analyses, refreshed analyses, batch-generated dossiers, and archived-version replacements

## Purpose

This rubric defines the minimum editorial standard for a DailyTickers analysis. It is based on the strongest pre-replacement Claude dossiers in the repository and raises their standard where their sourcing or SEC treatment was incomplete.

Passing JSON validation or rendering correctly is not enough. An analysis passes only when it explains the company, the latest operating evidence, valuation, capital structure, market context, and a usable decision in company-specific language.

The security's fundamental grade and the trade state are separate outputs:

- **Fundamental grade:** business quality, growth, margins, balance sheet, valuation, governance, and capital risk.
- **Trade state:** active, watch, wait, rejected, or event-vetoed based on current price structure and timing.
- A high-quality company can be `wait` or `rejected`.
- A low-quality company can have a speculative setup without receiving a high fundamental grade.

## Editorial Benchmarks

The benchmark is not one template. It is the combination of the strongest properties found in these archived dossiers:

### AMKR - archived on 2026-08-28

Reference: `analyses/AMKR/archive/20260828/index.html`

This is the primary benchmark for a complete equity dossier:

- The verdict identifies the actual business mechanism: outsourced semiconductor assembly and test, advanced packaging, chiplets, and the TSMC Arizona agreement.
- It states the contradiction clearly: a strategically valuable AI bottleneck with thin margins, cyclicality, and a broken chart.
- Business segments are quantified and connected to the thesis.
- The latest quarter includes revenue, growth, EPS, margin change, business-line records, and explicit next-quarter guidance.
- Valuation is interpreted through sector economics rather than merely displayed.
- Capital structure distinguishes converts, capped calls, controlling-holder secondary sales, shelf capacity, and issuer dilution.
- Technical levels correspond to actual moving-average clusters, recent lows, resistance, ATR, and the pending Nvidia event.
- The trade plan distinguishes investor accumulation from trader confirmation and explains why each level exists.

The benchmark is its specificity and causal reasoning, not every factual assertion or source choice. Any refreshed version must reverify all figures against current primary sources.

### IOVA - 2026-08-14 archive

Reference: `analyses/IOVA/archive/20260814/index.html`

This is the benchmark for filing-led and retail war-room writing:

- It takes revenue, loss, cash, operating cash burn, equity issuance, and share-count changes directly from the filing.
- It explains why apparently stable cash can coexist with substantial operating burn.
- It separates the bull case from the author's base case using the same evidence.
- It explicitly says when consensus data cannot be sourced.
- It refuses a market entry after a large gap and explains how stale indicators limit the plan.

### GLW and COHR - 2026-07-20 archives

References:

- `analyses/GLW/archive/20260720/index.html`
- `analyses/COHR/archive/20260720/index.html`

These are benchmarks for segment economics and catalyst transmission:

- The AI linkage is traced through an identifiable product, customer, contract, or capacity bottleneck.
- Segment mix, margins, debt, customer concentration, and peer valuation are used to test the narrative.
- Risks are tied to the business model rather than generic volatility language.

### NVDA - 2026-06-23 archive

Reference: `analyses/NVDA/archive/20260623/index.html`

This is a benchmark for earnings-event framing:

- It combines growth, margins, valuation, expectations, earnings-surprise compression, options positioning, and geopolitical exposure.
- The event is treated as a distribution of outcomes rather than a guaranteed directional catalyst.

### RCAT - 2026-07-20 archive

Reference: `analyses/RCAT/archive/20260720/index.html`

This is a useful benchmark for speculative risk framing: product and customer dependence, valuation versus limited revenue, technical extension, dilution risk, and position-sizing implications appear in the same decision framework.

## Publication Gate

An analysis is publishable only when both conditions are true:

1. Every `BLOCK` checklist item is satisfied or explicitly marked not applicable with a documented reason.
2. The editorial score is at least **80/100**.

No score can override a blocker. Schema validation, AI-tell checks, visual rendering, and link checks remain additional gates.

| Category | Weight |
|---|---:|
| Verdict specificity and grade integrity | 15 |
| Business model and segments | 10 |
| Latest earnings and guidance | 15 |
| Valuation and expectations | 10 |
| SEC filings and capital structure | 15 |
| Technical and trade context | 15 |
| Contrarian and retail risk writing | 10 |
| Sources and point-in-time controls | 5 |
| Anti-boilerplate and editorial quality | 5 |

## Blocking Requirements

### 1. Verdict Specificity And Grade Integrity

A verdict must answer, in the first paragraph:

- What the company actually sells.
- Why the stock is relevant now.
- Which operating evidence supports the thesis.
- What the strongest contradiction is.
- What the reader should do now.

The verdict must contain at least two company-specific quantified facts and one explicit causal link. “AI beneficiary,” “read-through,” “quality company,” and “wait for confirmation” are labels, not a thesis.

**Block publication when:**

- The company name and ticker can be replaced with a peer without materially changing the verdict.
- The grade is justified by chart state, article inclusion, or price momentum rather than fundamentals and valuation.
- The stated bias conflicts with the evidence without an explanation.
- `whyBuy` contains a negative metric presented as a positive, or `whyAvoid` merely repeats the trade status.
- The score or grade cannot be reconstructed from the stated positives and negatives.

### 2. Business Model And Segments

Explain the product, customer, revenue model, cost structure, and position in the value chain in plain language. Use reported segments when they are economically meaningful.

At minimum, include:

- Major products or services and who pays for them.
- Revenue or operating mix by segment, geography, customer, or product where disclosed.
- The segment that drives the current thesis.
- The principal bottleneck: capacity, customer concentration, regulation, reimbursement, commodity input, working capital, or capital intensity.

**Block publication when:**

- The business section is a sector description rather than a company description.
- A material segment, customer concentration, financing arm, or loss-making division is omitted.
- Sector-inappropriate accounting is used, such as treating financing debt as ordinary operating leverage or valuing an unprofitable biotech on a conventional P/E.
- “No segment data” is asserted without checking the latest 10-K/10-Q or equivalent filing.

### 3. Latest Earnings And Guidance

The latest reported period must be analyzed from the company release, filed exhibit, 10-Q/10-K, or foreign equivalent. A four-quarter EPS table is supporting context, not a substitute.

Required evidence:

- Filing or release date and fiscal period.
- Revenue actual, year-over-year growth, and consensus comparison when reliably sourced.
- EPS or the sector-appropriate earnings measure.
- At least one margin, cash-flow, backlog, ARR, bookings, production, or unit-economics measure appropriate to the company.
- Management guidance with prior/consensus comparison, or an explicit statement that no quantitative guidance was issued.
- What changed in the bull and bear cases after the report.

**Block publication when:**

- The latest 8-K or earnings exhibit is listed but its results are not summarized.
- `nextEarnings` is “Not confirmed,” “unknown,” or stale while a company calendar or filing is available.
- Guidance is omitted, invented, or copied from an earlier quarter.
- A reported result is described as a beat without a dated consensus source.
- TTM growth or margins show a scaling/split anomaly that has not been reconciled.

### 4. Valuation And Expectations

Valuation must answer what expectations are embedded in the price. Use metrics appropriate to the business and compare them with relevant peers, history, or a scenario range.

Minimum standard:

- At least two usable valuation measures, or one primary measure plus a scenario model.
- A dated denominator and clear distinction between trailing, forward, GAAP, and non-GAAP values.
- A peer or historical comparison with an explanation of why the comparison is valid.
- A statement of what growth, margin, utilization, commodity price, or cash-flow outcome would justify the current multiple.

**Block publication when:**

- Valuation is `N/A` without a documented alternative method.
- A DCF or intrinsic-value output is shown without assumptions and sensitivity.
- EV/EBITDA, P/E, price/sales, NAV, or FCF yield is used despite being economically inappropriate.
- The verdict calls a stock cheap or expensive without a comparison and dated inputs.
- Grade A/A- is assigned while valuation output is strongly bearish and the conflict is not discussed.

### 5. SEC Filings And Capital Structure

SEC review is a finding, not a filing inventory. Each material filing entry must include exact form, filing date, accession number, direct EDGAR URL, security type, amount when disclosed, and operational consequence.

Required distinctions:

- Shelf registration capacity versus securities actually offered or sold.
- Primary issuance versus secondary holder sale.
- Common equity versus debt, convertible debt, mandatory convertible preferred, warrants, options, and employee compensation.
- ATM authorization, amount sold to date, remaining capacity, amendment, replacement, or termination.
- Issuer dilution versus non-dilutive refinancing or shareholder distribution.
- Outstanding shares, fully diluted exposure where material, cash, debt, maturity, covenants, going-concern language, and material weaknesses.

**Block publication when:**

- The finding says only “reviewed for liquidity, leverage, stock compensation and material risks.”
- A 424B filing is classified from its form or keyword hits without reading the cover and offering terms.
- A base shelf mentioning several security types is called an active warrant, ATM, or equity raise.
- Debt is described as equity dilution, or a secondary sale is described as issuer dilution.
- Multiple amendments to one program are counted as independent financing programs.
- “No ATM,” “no dilution,” “no material weakness,” or “no going concern” is inferred only from silence.
- Filing inventory count and opened/reviewed count are inconsistent.
- Shares outstanding are zero, implausible, or inconsistent with market capitalization without reconciliation.

### 6. Technical And Trade Context

The technical section must separate the last completed daily bar from intraday observations. Every price must carry an as-of date or timestamp.

Required evidence:

- Reference close date and exact intraday quote timestamp.
- Trend relative to relevant moving averages and current ATR/normal volatility.
- Actual support and resistance derived from pivots, gaps, moving averages, anchored VWAP, opening range, or volume structure.
- One activation condition, one structural invalidation, and targets tied to observed market structure.
- Event veto for imminent earnings, FDA decisions, financing, court rulings, or other binary events.
- R/R recalculated from the exact entry, stop, and targets.

**Block publication when:**

- Entry equals spot merely because spot is available.
- Support or resistance is empty while a trade plan is presented as actionable.
- Targets are produced only by applying the same fixed R multiple across a batch.
- A LIMIT, breakout, pullback, or VWAP instruction lacks a measurable confirmation condition.
- The quote is described as live without its exact timestamp.
- Premarket or extended-hours bars with zero/unreliable volume are used as volume confirmation.
- The stop is inside ordinary noise without justification, or so wide that the proposed setup is not retail-survivable.
- An event-vetoed setup still presents an executable entry.

### 7. Contrarian And Retail Risk Writing

Risk writing must explain how the thesis fails, not merely state that stocks are volatile.

Minimum standard:

- Three company-specific risks, each with mechanism, evidence, and observable warning sign.
- A strongest-opposing-case section using the same data as the base case.
- A retail war-room paragraph covering gap risk, liquidity, slippage, sizing implication, event timing, and what not to chase.
- Explicit concentration, customer, financing, accounting, regulatory, or execution risk where relevant.

**Block publication when:**

- Risk cards could be pasted into another ticker unchanged.
- Probability/impact percentages are decorative and unsupported.
- “The economic link can be genuine” or similar generic language substitutes for a company-specific failure path.
- Risk is described without a monitorable trigger or consequence.
- The analysis recommends action after an extreme move without addressing path dependency and gap survivability.

### 8. Sources And Point-In-Time Controls

Every material factual section needs proximate sourcing. Primary sources take precedence over aggregators.

Required source hierarchy:

1. Company filings, filed exhibits, investor relations releases, and official presentations.
2. SEC EDGAR, regulator, exchange, government, or official calendar.
3. Market-data provider for price, volume, options, short interest, and technical inputs.
4. Reputable reporting for context that primary sources cannot provide.

**Block publication when:**

- All section references are duplicated SEC links regardless of the section's actual data source.
- A source link points to an issuer landing page when a direct filing or release exists.
- Source date, market-data timestamp, fiscal period, or retrieval boundary is missing.
- News, consensus, options, insider, or short-interest claims have no matching source.
- A current fact depends on an archived or stale snapshot without disclosure.

### 9. Anti-Boilerplate And Editorial Quality

Reusable structure is allowed; reusable conclusions are not.

Allowed repeated text is limited to:

- The standard legal disclaimer.
- A concise point-in-time data boundary.
- A single legally precise caution that a shelf alone does not prove issuance.

**Block publication when:**

- Any non-allowlisted sentence of 55 or more characters appears in more than 10% of a publication batch.
- The same risk synthesis, mindset tip, catalyst, or invalidation appears across unrelated companies.
- The ticker can be swapped with a peer without making a sentence false.
- Headlines are paraphrased without explaining their financial consequence.
- The prose uses filler to conceal missing data.
- Contrarian review does not identify at least one concrete change or explicitly justify a clean pass.

## Machine-Checkable Checklist

Checklist line grammar:

```text
- [ ] <CHECK_ID> | <SEVERITY> | <REQUIREMENT>
```

`SEVERITY` is `BLOCK` or `SCORE`. A parser may require every `BLOCK` line to be checked. `N/A` is valid only when the review artifact contains a written reason and evidence.

- [ ] AQ-VRD-001 | BLOCK | Verdict names the company, product or service, current catalyst, strongest contradiction, and current action.
- [ ] AQ-VRD-002 | BLOCK | Verdict contains at least two company-specific quantified facts and one causal statement.
- [ ] AQ-VRD-003 | BLOCK | Fundamental grade and trade state are separately named and independently justified.
- [ ] AQ-VRD-004 | BLOCK | Every positive and negative bullet is directionally consistent with its heading.
- [ ] AQ-BIZ-001 | BLOCK | Business section explains product, customer, revenue model, cost structure, and value-chain position.
- [ ] AQ-BIZ-002 | BLOCK | Material segments or an evidenced no-segment explanation are present.
- [ ] AQ-BIZ-003 | BLOCK | Sector-specific accounting and KPIs are used.
- [ ] AQ-EAR-001 | BLOCK | Latest reported fiscal period, release date, and primary source are identified.
- [ ] AQ-EAR-002 | BLOCK | Latest revenue, growth, earnings metric, and one sector KPI are analyzed.
- [ ] AQ-EAR-003 | BLOCK | Latest guidance is quantified and compared, or absence of guidance is explicitly sourced.
- [ ] AQ-EAR-004 | BLOCK | Latest filed earnings exhibit or periodic report is reflected in the narrative.
- [ ] AQ-EAR-005 | BLOCK | Next earnings date is confirmed or explicitly unavailable after checking official sources.
- [ ] AQ-VAL-001 | BLOCK | At least two appropriate valuation measures or one measure plus a scenario model are present.
- [ ] AQ-VAL-002 | BLOCK | Valuation inputs are dated and trailing/forward plus GAAP/non-GAAP bases are explicit.
- [ ] AQ-VAL-003 | BLOCK | Peer, historical, or scenario comparison explains embedded expectations.
- [ ] AQ-SEC-001 | BLOCK | Latest periodic filing has exact form, date, accession, direct URL, and specific finding.
- [ ] AQ-SEC-002 | BLOCK | Every material offering filing identifies security, amount, issuer/holder, and current status.
- [ ] AQ-SEC-003 | BLOCK | Shelf, ATM, primary, secondary, debt, converts, warrants, and SBC are not conflated.
- [ ] AQ-SEC-004 | BLOCK | Shares outstanding and fully diluted exposure are reconciled or explicitly unavailable.
- [ ] AQ-SEC-005 | BLOCK | Going concern and material weakness conclusions come from affirmative filing text, not silence.
- [ ] AQ-SEC-006 | BLOCK | Inventoried, opened, and reviewed filing counts are internally consistent.
- [ ] AQ-TEC-001 | BLOCK | Reference close and intraday quote have explicit dates or timestamps.
- [ ] AQ-TEC-002 | BLOCK | Supports and resistances are populated and tied to observable structures, or no trade is issued.
- [ ] AQ-TEC-003 | BLOCK | Entry, confirmation, stop, targets, and invalidation each have a distinct rationale.
- [ ] AQ-TEC-004 | BLOCK | R/R arithmetic matches the published levels and is not a batch-wide fixed template.
- [ ] AQ-TEC-005 | BLOCK | Binary-event veto and stale/zero-volume data limitations are enforced.
- [ ] AQ-RSK-001 | BLOCK | At least three risks are company-specific and include mechanism, evidence, and warning sign.
- [ ] AQ-RSK-002 | BLOCK | Strongest contrarian case is developed with quantified evidence.
- [ ] AQ-RSK-003 | BLOCK | Retail war-room covers gap, liquidity, slippage, sizing implication, and no-chase condition.
- [ ] AQ-SRC-001 | BLOCK | Business, earnings, capital, and technical sections cite the source that actually supports them.
- [ ] AQ-SRC-002 | BLOCK | Primary sources are direct links with dates, accessions, periods, or timestamps as applicable.
- [ ] AQ-SRC-003 | BLOCK | Unsupported consensus, news, insider, options, or short-interest claims are removed or sourced.
- [ ] AQ-EDT-001 | BLOCK | No non-allowlisted sentence of 55+ characters appears in more than 10% of the batch.
- [ ] AQ-EDT-002 | BLOCK | Verdict, risk synthesis, catalysts, and invalidations remain true only for this ticker.
- [ ] AQ-EDT-003 | BLOCK | Data limitations are stated precisely and are not padded with generic filler.
- [ ] AQ-QA-001 | BLOCK | JSON/schema, rendering, link, AI-tell, freshness, contrarian, and retail-war-room checks pass.
- [ ] AQ-QA-002 | BLOCK | Reviewer records PASS or BLOCK per ticker with exact fixes for every blocker.
- [ ] AQ-QA-003 | SCORE | Editorial score is at least 80/100 after all blockers are cleared.

## Recurring Weaknesses In The Current 2026-08-28 Batch

Snapshot audited: 57 current `ai-chain` JSON dossiers dated 2026-08-28. These counts are diagnostic and may change as files are repaired.

- **Valuation is effectively absent:** 56/57 show `Intrinsic-value model: N/A` without replacing it with a company-appropriate peer, historical, NAV, FCF, or scenario framework.
- **SEC prose inventories forms instead of analyzing them:** 57/57 contain the same generic periodic-report finding; 55/57 contain the same generic current-report finding.
- **Sources are not mapped to claims:** 57/57 fundamentals source lists contain only SEC links even where market, consensus, technical, options, insider, or article data is discussed.
- **Risk synthesis is batch boilerplate:** all 57 use the same risk-synthesis text.
- **Legal cautions are massively duplicated:** “A registration statement alone is not treated as an issuance” appears 285 times. The caution is correct but should appear once in the relevant capital section, followed by the actual issuer-specific finding.
- **Headline handling is filler:** “Headline context only...” appears 214 times instead of explaining the financial consequence of a catalyst.
- **Earnings calendar remains incomplete:** 7/57 retain an unconfirmed next-earnings field.
- **Technical structures remain incomplete:** 6/57 have no supports and 4/57 have no resistances despite the batch presenting trade states.
- **Company-specific risk is diluted by repeated language:** the same “economic link can be genuine” sentence appears 65 times.
- **Grade/state separation improved but is not sufficient:** 57/57 now state that grade and trade state differ, yet several grades still lack a reconstructable company-specific quality and valuation argument.
- **Specific SEC errors remain high impact:** offering amendments may be counted as separate programs; generic shelf language may be mistaken for active warrants; debt, secondary sales, and issuer dilution require manual cover-page verification.
- **Data-integrity failures can contaminate the whole dossier:** split-adjusted shares, zero shares, implausible TTM growth, financing debt, negative equity, and sector-inappropriate ratios must block grade and trade publication until reconciled.

## Required Review Output

The mandatory reviewer returns findings ordered by severity, then one line per ticker:

```text
TICKER | PASS|BLOCK | failed_check_ids | exact required fix
```

The batch verdict is `PASS` only when every ticker passes every blocking check. A clean machine result cannot waive unsupported facts, weak causal reasoning, or generic editorial content.
