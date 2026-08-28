# Independent AQ-1 Batch Audit - 2026-08-28

Scope: hostile read-only review of the 57 current `data/analyses-data/*.json` dossiers. The review used the frozen copies in `/tmp/aq-batch-audit-20260828/json-snapshot-1`; no dossier was edited. This is an independent editorial audit, not the group attestation or its external review manifest.

## Findings

### CRITICAL - unsupported valuation labels contaminate grades and verdicts

- **CRWD | AQ-VAL-002, AQ-VAL-003, AQ-SRC-001:** `3185.2x` is presented as forward non-GAAP EV/EBITDA although the dossier provides neither a forward EBITDA denominator nor a source capable of establishing it. Remove the number; rebuild valuation from dated EV/ARR, EV/revenue and FCF yield, or publish the exact normalized EBITDA denominator and consensus source.
- **DDOG, NBIS, PANW | AQ-VAL-002, AQ-SRC-001:** `921.2x`, `240.0x` and `209.7x` EV/EBITDA outputs are not supported as forward non-GAAP measures. Recompute from identified, dated numerator and denominator inputs or replace with economically usable revenue, ARR, FCF or scenario valuation.
- **All 57 | AQ-SRC-001, AQ-SRC-003:** `shortInterest`, `options`, `social`, `performance` and `capitalFlow` all cite SEC filing URLs. Those filings cannot support the market-data claims in those sections. Attach the actual dated provider/source to every claim or remove the claim. This alone blocks every dossier.

### HIGH - grades are not reconciled with valuation

- **AMD, ANET, AVGO, FTNT, KLAC, MU, VICR | AQ-VRD-003, AQ-VAL-003:** grades from `A` to `B+` coexist with extreme or cycle-sensitive valuation outputs without a quantified reconciliation. Recalculate the multiples, identify the valuation date and denominator, then explain why the required growth/margin path supports the grade; otherwise lower the fundamental grade.
- **BE, MRVL | AQ-VRD-003, AQ-VAL-003:** `B`/`B+` grades do not explain how the stated `153.6x` and `79.6x` EV/EBITDA-like outputs can be underwritten. Replace bad denominators or make the premium a direct grade constraint.
- **All 57 | AQ-VAL-002:** forward/trailing and GAAP/non-GAAP labels are asserted without a reproducible denominator and dated market-value input. Add a valuation input table with date, share count, debt/cash adjustments, estimate period and source.

### HIGH - business labels are presented as reported segments when they are not

- **NVDA | AQ-BIZ-002, AQ-BIZ-003:** `Edge Computing` at `$7.2B` is an invented residual, not an issuer-reported segment. Replace it with NVIDIA's reported platform categories, or label it explicitly as a derived residual and show the arithmetic.
- **AG, CDE | AQ-BIZ-002:** commodity attribution and `held metal inventory` are not reportable operating segments. Use mine/asset reporting or label these as commodity exposure and inventory, not segments.
- **BMNR | AQ-BIZ-002, AQ-BIZ-003:** `ETH treasury and staking` and `Strategic investments` are valuation/capital-allocation buckets; projected annualized run rate is not GAAP segment revenue. Separate treasury NAV, staking income and operating revenue.
- **CLSK, MARA | AQ-BIZ-002:** `AI/HPC activity $0` is pre-revenue optionality, not a segment. Move it to catalysts/capex commitments and state that it contributes no reported revenue.
- **CRWV, EQX | AQ-BIZ-002:** `Contracted capacity pipeline` and `Growth pipeline` mix backlog/development assets with revenue-producing operations. Separate reported revenue categories from contracted backlog and unbuilt capacity.
- **DDOG, MDB, ORCL, S, SNOW | AQ-BIZ-002:** `Primary platform` and `Expansion channel` are template thesis buckets, not issuer segments. Replace them with issuer-disclosed revenue/KPI breakdowns or state that the issuer reports one segment.
- **LPLA, OKTA, PANW, TENB, ZS | AQ-BIZ-002:** business drivers, product families or ARR categories are rendered as segments. Relabel them and add any actual reportable-segment disclosure.
- **HPE | AQ-BIZ-002, AQ-BIZ-003:** `Cloud and AI` combines operating categories while financing debt requires separate treatment. Use HPE's exact segment names and isolate financing receivables/debt from operating leverage.
- **SNPS | AQ-BIZ-002:** `Ansys / simulation` must be identified as acquired activity and reconciled to the issuer's post-close reporting structure, not presented as an already comparable historical segment.

### HIGH - SEC review is incomplete despite exact-looking accessions

- **ALLR | AQ-SEC-002, AQ-SEC-006:** the dossier omits the reviewed capital-markets chain containing `S-3 0001213900-25-117592`, `S-3 0001213900-25-091740`, related `424B3` and `EFFECT` filings. Reconcile each filing to one program and state amount, security, issuer/holder and status.
- **AMD | AQ-SEC-002:** reconcile omitted `424B5 0001193125-26-348029` and establish whether it is issuer equity, debt, secondary distribution or another security before discussing dilution.
- **AVGO | AQ-SEC-002, AQ-SEC-006:** reconcile omitted `424B5 0001193125-25-210136`, `424B3 0001193125-25-207457`, `424B3 0001193125-25-207434` and their `EFFECT` notices. Group amendments under the underlying programs rather than counting them independently.
- **HUT | AQ-SEC-001, AQ-SEC-006:** accession `0001104659-26-071952` is a manual extra absent from the local SEC inventory. Verify the direct EDGAR document and record why it was added; remove it if the accession does not belong to HUT.
- **INTC | AQ-SEC-002:** reconcile omitted `S-3ASR 0000050863-26-000023`; do not infer active issuance from the shelf alone.
- **MSTR | AQ-SEC-002, AQ-SEC-006:** seven older `424B5` filings are omitted (`0001193125-25-272591`, `-263900`, `-263759`, `-263746`, `-263731`, `-263719`, `-262757`). Map each to the relevant common/preferred/debt program and reconcile capacity, sales and remaining authorization without double counting.
- **RZLV | AQ-SEC-002, AQ-SEC-006:** the dossier omits a material chain of `F-1`, `F-3`, `424B3` and `EFFECT` documents. Rebuild program-level issuance history from cover pages and offering terms.
- **SMCI | AQ-SEC-002:** reconcile omitted `S-3ASR 0001193125-26-263811` and state whether any takedown was actually offered or sold.

### HIGH - top-leader earnings are mostly accurate, but publication blockers remain

- **NVDA | AQ-EAR-001 to AQ-EAR-004:** the reported Q2 FY27 facts are internally consistent: revenue `$96.2B`, Data Center `$89.0B`, non-GAAP EPS `$2.22`, and Q3 revenue guidance `$108B +/-2%` excluding China Data Center compute. Keep those facts, replace the fabricated segment noted above, and source the `19.9x`/`30.4x` valuation denominators.
- **CRWD | AQ-EAR-003, AQ-VAL-002:** revenue `$1.47B`, ARR `$5.84B`, net-new ARR `$332.8M`, FCF `$377.4M` and non-GAAP EPS `$0.31` are consistent with the filed release. Quantify the newly issued outlook rather than merely mentioning it, and remove the contaminated `3185.2x` multiple.
- **OKTA | AQ-EAR-001 to AQ-EAR-004, AQ-BIZ-002:** revenue `$805M`, RPO `$4.858B`, cRPO `$2.585B`, FCF `$227M` and FY revenue guidance `$3.216B-$3.226B` are consistent. Relabel Workforce and Customer Identity as product franchises unless the filing calls them reportable segments, and source the forward valuation denominators.
- **CRM | AQ-EAR-001 to AQ-EAR-004, AQ-VAL-002:** revenue `$11.3B`, cRPO `$33.5B`, RPO `$66.3B`, non-GAAP operating margin `34.1%`, FCF `$1.1B` and FY revenue guidance `$46.1B-$46.4B` are consistent. Label subscription/support and professional services as revenue categories, state acquisition effects in guidance, and source the forward valuation inputs.
- **NVDA, CRWD, OKTA, CRM | AQ-SEC-001:** displayed latest filing mappings are internally exact against the local SEC inventory: NVDA `10-Q 0001045810-26-000075` / `8-K 0001045810-26-000073`; CRWD `10-Q 0001535527-26-000031` / `8-K 0001535527-26-000029`; OKTA `10-Q 0001660134-26-000069` / `8-K 0001660134-26-000068`; CRM `10-Q 0001108524-26-000190` / `8-K 0001108524-26-000187`. This narrow pass does not waive their other blockers.

### HIGH - invalid state and hidden template residue

- **32/57 | AQ-TEC-005, AQ-QA-001:** `meta.status` is `pending`, which is not a valid AQ-1 trade state and is not a retail decision. Convert it to `active`, `watch`, `wait`, `rejected` or `event-vetoed`, with evidence and timestamp.
- **All 57 | AQ-EDT-001, AQ-EDT-002:** the batch repeats non-allowlisted editorial conclusions above the 10% threshold: identical short-interest, macro, alpha, capital-flow and mindset language appears across the full set; generic cash/debt and intrinsic-value text dominates most files. Replace repeated conclusions with ticker-specific evidence or omit empty sections.
- **All 57 | AQ-QA-001:** the current strict checker rejects the frozen files because no external AQ manifest, score, two-reviewer record, full 38-check result or matching content hash is present. This audit is not that attestation, but publication still requires the separate machine gate after content fixes.

## Ticker Verdicts

Every ticker below is `BLOCK`; therefore none is marked `CLEAN`. The source mismatch and anti-boilerplate failures above apply to every row in addition to the ticker-specific fix.

| Ticker | Verdict | AQ ID | Severity | Exact fix |
|---|---|---|---|---|
| AAOI | BLOCK | AQ-SRC-001, AQ-SEC-002, AQ-QA-001 | HIGH | Replace SEC citations in market sections; quantify the `$600M` ATM amount sold and remaining from the latest program documents; replace `pending` with an evidenced trade state. |
| AG | BLOCK | AQ-BIZ-002, AQ-VAL-002, AQ-QA-001 | HIGH | Replace commodity/inventory pseudo-segments with mine or asset reporting, source valuation inputs, and resolve `pending`. |
| ALLR | BLOCK | AQ-SEC-002, AQ-SEC-006, AQ-EAR-005 | HIGH | Reconcile the omitted S-3/424B3/EFFECT chain by financing program and confirm the next earnings date from an official source. |
| AMD | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-SEC-002 | HIGH | Reconcile grade `A` with `81.2x` EV/EBITDA and `18.8x` EV/revenue using dated estimates; classify omitted `424B5 0001193125-26-348029`. |
| AMKR | BLOCK | AQ-BIZ-002, AQ-SRC-001, AQ-EDT-001 | HIGH | Quantify the three stated end-market buckets from issuer disclosure and replace generic market/flow conclusions with sourced AMKR-specific evidence. |
| ANET | BLOCK | AQ-BIZ-002, AQ-VRD-003, AQ-VAL-003 | HIGH | Relabel product/end-market buckets, then reconcile `A-` with `51.8x` EV/EBITDA and `22.8x` EV/revenue using explicit growth/margin expectations. |
| APLD | BLOCK | AQ-BIZ-002, AQ-SEC-002, AQ-QA-001 | HIGH | Verify exact reported segment taxonomy, map financing to each data-center asset, and replace `pending` with a valid event-aware state. |
| AVGO | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-SEC-006 | HIGH | Rebuild dated forward valuation and grade logic; reconcile the omitted 424B/EFFECT chain by underlying offering. |
| BE | BLOCK | AQ-VRD-003, AQ-VAL-002, AQ-SRC-001 | HIGH | Remove or reconstruct the unsupported `153.6x` multiple and explain whether product/install versus service/electricity economics support grade `B`. |
| BMNR | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-VAL-003 | HIGH | Separate operating revenue from ETH NAV, staking yield and investment marks; do not call projected run rate a reported segment result. |
| CAN | BLOCK | AQ-TEC-005, AQ-SRC-001, AQ-QA-001 | HIGH | Enforce the Sep. 3 event veto, replace `pending`, and attach actual price/options/short-interest sources. |
| CDE | BLOCK | AQ-BIZ-002, AQ-VAL-003, AQ-SRC-001 | HIGH | Replace commodity pseudo-segments with mine-level economics and show the gold/silver/copper assumptions behind valuation. |
| CEG | BLOCK | AQ-BIZ-002, AQ-VAL-003, AQ-SRC-001 | HIGH | Verify Generation/Customer reporting labels and source power-price, nuclear-output and market-data claims with dated inputs. |
| CIFR | BLOCK | AQ-BIZ-002, AQ-SEC-002, AQ-SRC-001 | HIGH | Separate current mining revenue from unbuilt HPC optionality and link capex/financing claims to exact contracts and filings. |
| CLSK | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-SRC-001 | HIGH | Remove `AI/HPC activity` from reported segments while revenue is zero; treat it as optionality and quantify committed capex and funding. |
| COIN | BLOCK | AQ-BIZ-003, AQ-VAL-003, AQ-QA-001 | HIGH | Reconcile transaction versus subscription economics with crypto-cycle sensitivity, source valuation/market data, and resolve `pending`. |
| CORZ | BLOCK | AQ-BIZ-002, AQ-SEC-002, AQ-SRC-001 | HIGH | Distinguish colocation revenue, contracted capacity and self-mining; tie build-out funding and customer concentration to primary documents. |
| CRM | BLOCK | AQ-EAR-003, AQ-VAL-002, AQ-QA-001 | HIGH | Preserve accurate earnings facts, quantify acquisition effects and current guidance comparisons, source forward denominators, and resolve `pending`. |
| CRWD | BLOCK | AQ-VAL-002, AQ-EAR-003, AQ-QA-001 | CRITICAL | Delete `3185.2x`, rebuild valuation on sourced ARR/revenue/FCF inputs, quantify outlook, and resolve `pending`. |
| CRWV | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-SRC-001 | HIGH | Move contracted capacity pipeline out of segments and reconcile backlog, capex, financing and recognized revenue with contract evidence. |
| DDOG | BLOCK | AQ-BIZ-002, AQ-VAL-002, AQ-SRC-001 | CRITICAL | Replace template thesis buckets with issuer KPIs and delete or reconstruct the unsupported `921.2x` valuation. |
| DELL | BLOCK | AQ-BIZ-003, AQ-VAL-003, AQ-TEC-005 | HIGH | Separate Dell Financial Services debt from operating leverage, explain the valuation/grade tradeoff, and enforce the earnings veto. |
| EQX | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-QA-001 | HIGH | Separate current operations, acquired pro-forma assets and development pipeline; do not mix them as comparable segment results; resolve `pending`. |
| FTNT | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-QA-001 | HIGH | Reconcile grade `A` with `43.2x` EV/EBITDA through dated billings/FCF assumptions and replace `pending`. |
| GEV | BLOCK | AQ-VAL-002, AQ-RSK-001, AQ-QA-001 | HIGH | Source backlog/margin valuation inputs, make project-loss and warranty risks monitorable by segment, and resolve `pending`. |
| HPE | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-QA-001 | HIGH | Use exact issuer segments, isolate financing debt/receivables, and replace the current `pending` state with an event-aware decision. |
| HUT | BLOCK | AQ-SEC-001, AQ-SEC-006, AQ-SRC-001 | HIGH | Directly verify accession `0001104659-26-071952`, document its provenance, and separate compute/power asset metrics from market claims. |
| INTC | BLOCK | AQ-SEC-002, AQ-BIZ-003, AQ-VAL-003 | HIGH | Reconcile `S-3ASR 0000050863-26-000023`, separate foundry losses from product economics, and source the turnaround valuation assumptions. |
| IREN | BLOCK | AQ-SEC-006, AQ-BIZ-002, AQ-QA-001 | HIGH | Resolve the filing-data veto before publishing grade or levels; separate mining economics from AI cloud capacity and replace `pending`. |
| KLAC | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-QA-001 | HIGH | Reconcile `A-` with `39.9x` EV/EBITDA and `17.8x` EV/revenue, source the cycle assumptions, and resolve `pending`. |
| LPLA | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-SRC-001 | HIGH | Relabel advisory, brokerage and client cash as revenue drivers where appropriate and source rate-sensitive cash-sweep assumptions. |
| LUNR | BLOCK | AQ-SEC-002, AQ-RSK-003, AQ-SRC-001 | HIGH | Reconcile ATM capacity/sales and mission-payment timing, then make gap, liquidity and binary mission risk actionable with sourced data. |
| MARA | BLOCK | AQ-BIZ-002, AQ-BIZ-003, AQ-SRC-001 | HIGH | Remove zero-revenue AI/HPC from segments and value mining, treasury and optionality separately with dated hash-price/power inputs. |
| MDB | BLOCK | AQ-BIZ-002, AQ-TEC-005, AQ-QA-001 | HIGH | Replace `Primary platform/Expansion channel` with issuer KPIs, enforce the Sep. 1 event veto, and resolve `pending`. |
| MRSH | BLOCK | AQ-BIZ-002, AQ-SRC-001, AQ-EDT-002 | HIGH | Verify the issuer's exact Risk & Insurance/Consulting taxonomy and remove unsupported `Marsh Management Consulting` labeling unless directly reported. |
| MRVL | BLOCK | AQ-VRD-003, AQ-VAL-002, AQ-EAR-005 | HIGH | Rebuild the `79.6x`/`24.8x` valuation from dated inputs, reconcile grade `B+`, and update the post-report calendar state rather than leaving earnings unconfirmed. |
| MSTR | BLOCK | AQ-SEC-002, AQ-SEC-006, AQ-BIZ-003 | HIGH | Map the seven omitted 424B5 filings to common/preferred/debt programs and separate software operations from BTC treasury NAV and financing. |
| MU | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-BIZ-003 | HIGH | Normalize grade `A` for the memory cycle, identify exact segment taxonomy, and state the HBM/utilization/margin assumptions that justify the multiple. |
| NBIS | BLOCK | AQ-VAL-002, AQ-BIZ-002, AQ-SRC-001 | CRITICAL | Delete or reconstruct `240.0x`, distinguish AI infrastructure revenue from investments/other businesses, and source capacity and backlog claims. |
| NOW | BLOCK | AQ-VAL-002, AQ-VAL-003, AQ-QA-001 | HIGH | Source the `50.7x` valuation denominator, quantify the growth/margin path embedded in it, and resolve `pending`. |
| NVDA | BLOCK | AQ-BIZ-002, AQ-VAL-002, AQ-SRC-001 | HIGH | Keep the verified Q2/Q3 facts, replace invented `Edge Computing`, and source the `19.9x`/`30.4x` forward valuation inputs. |
| OKTA | BLOCK | AQ-BIZ-002, AQ-VAL-002, AQ-QA-001 | HIGH | Relabel product franchises, source `7.1x`/`79.3x` denominators, preserve the verified Q2/FY guidance facts, and resolve `pending`. |
| ORCL | BLOCK | AQ-BIZ-002, AQ-SEC-002, AQ-QA-001 | HIGH | Replace template platform/channel buckets, reconcile the `$20B` ATM at program level, enforce event timing, and resolve `pending`. |
| PANW | BLOCK | AQ-BIZ-002, AQ-VAL-002, AQ-QA-001 | CRITICAL | Treat NGS ARR as a KPI rather than a segment, delete or rebuild `209.7x`, and replace `pending` with a supported state. |
| RZLV | BLOCK | AQ-SEC-002, AQ-SEC-006, AQ-QA-001 | HIGH | Reconstruct the omitted F-1/F-3/424B3/EFFECT chain by program, reconcile dilution and warrants, and resolve `pending`. |
| S | BLOCK | AQ-BIZ-002, AQ-EAR-005, AQ-SRC-001 | HIGH | Replace template platform/channel buckets, verify the next earnings date, and source ARR/valuation/market claims. |
| SBET | BLOCK | AQ-SEC-002, AQ-BIZ-003, AQ-QA-001 | HIGH | Reconcile warrant and equity dilution on a fully diluted basis, separate staking from affiliate economics, and resolve `pending`. |
| SMCI | BLOCK | AQ-SEC-002, AQ-TEC-005, AQ-QA-001 | HIGH | Reconcile `S-3ASR 0001193125-26-263811`, enforce the event/data veto, and replace `pending` without publishing executable levels prematurely. |
| SNOW | BLOCK | AQ-BIZ-002, AQ-VAL-003, AQ-QA-001 | HIGH | Replace template buckets with consumption/RPO/customer KPIs, source valuation expectations, enforce event timing, and resolve `pending`. |
| SNPS | BLOCK | AQ-BIZ-002, AQ-VAL-003, AQ-QA-001 | HIGH | Reconcile Ansys as acquired activity, rebuild `51.2x` valuation assumptions, verify post-report timing, and resolve `pending`. |
| STRL | BLOCK | AQ-VAL-003, AQ-RSK-001, AQ-QA-001 | HIGH | Explain why backlog conversion and margin assumptions support `A-`, add project-specific failure triggers, and resolve `pending`. |
| TENB | BLOCK | AQ-BIZ-002, AQ-EAR-005, AQ-QA-001 | HIGH | Relabel product families, confirm the earnings calendar from an official source, and replace `pending`. |
| TTMI | BLOCK | AQ-SEC-002, AQ-VAL-003, AQ-SRC-001 | HIGH | Verify the insider/filing catalyst with exact form, date and accession, then reconcile the `27.5x` valuation with end-market mix and margins. |
| VICR | BLOCK | AQ-VRD-003, AQ-VAL-003, AQ-SRC-001 | HIGH | Reconcile `B+` with `77.9x` EV/EBITDA and `18.9x` EV/revenue; quantify royalty versus brick economics with sourced inputs. |
| VST | BLOCK | AQ-VRD-003, AQ-BIZ-003, AQ-QA-001 | HIGH | Reconstruct the quality grade from retail/generation cash flows and leverage, source power/hedge assumptions, and resolve `pending`. |
| WULF | BLOCK | AQ-BIZ-002, AQ-SEC-002, AQ-SRC-001 | HIGH | Separate current mining from contracted HPC leasing, reconcile build-out financing and dilution, and source market/capacity claims. |
| ZS | BLOCK | AQ-BIZ-002, AQ-VAL-003, AQ-QA-001 | HIGH | Relabel product families, source forward valuation and ARR expectations, enforce event timing, and resolve `pending`. |

## Batch Verdict

**BLOCK - 57/57 dossiers fail at least one AQ-1 blocking requirement; 0/57 are CLEAN.**

The four earnings leaders contain substantially accurate direct earnings facts and exact latest 10-Q/8-K mappings, but that does not cure unsupported valuation labels, pseudo-segments, mismatched market-data sources or batch boilerplate. Publication should remain blocked until the dossier-specific fixes are made and a fresh external AQ manifest is generated against the resulting content hashes.
