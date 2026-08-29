# Review panel - retro 20260814

Final review date: 2026-08-29

## Scope

- `scanner/20260814/retro/index.html`
- `scanner/20260814/retro/retro-results.json`
- `scanner/20260814/retro/harness.json`
- `scanner/20260814/retro-harness.json`

## Final verdicts

- Quantitative review: PASS
- Contrarian review: PASS
- Editorial review: PASS

## Corrections required by the panel

- AMRX same-bar ambiguity resolved conservatively: 50% at TP1 and 50% at breakeven on 2026-08-14, for +0.429 R and +0.215% portfolio contribution.
- Initial panel metrics were superseded after the horizon audit: the canonical expiry is 2026-08-28, not 2026-08-27.
- Corrected metrics: PEB +0.489 R at expiry, M stopped at -1.00 R on 2026-08-28, portfolio -1.041%, profit factor 0.31 and maximum daily drawdown -1.14%.
- Harness generation timestamps moved after the final deterministic result.
- Bear case wording changed from one winning trade to one target reached, preserving the distinction between positive expiry and TP1 attainment.

All three reviewers re-opened the corrected artifacts and returned PASS.

## Horizon correction review

After the user reported the truncated range, the panel re-ran against the canonical scanner convention:

- Expiry equals `addBusinessDays(scan_date, horizon)`.
- The 2026-08-14 scan therefore expires on 2026-08-28.
- D0 is executable, so the replay observes eleven daily bars from D0 through D+10.
- Macy's stops on the final session; PEB exits at the final close.

Quantitative review: PASS. Contrarian review: PASS. Editorial/provenance review: PASS.
