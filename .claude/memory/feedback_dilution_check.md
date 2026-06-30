---
name: Dilution & Toxic Financing Check
description: Always check for SEC dilution filings, warrants, and aggressive funds before recommending any ticker in scanner or analyses
type: feedback
---

Toujours vérifier les risques de dilution avant de recommander un ticker (scanner ou analyse détaillée).

**Why:** Le cas INDO — setup technique parfait sélectionné dans le scanner, mais dilution massive non détectée (prospectus SEC, warrants, fonds agressif type H.C. Wainwright). Le risque s'est concrétisé et a invalidé le trade.

**How to apply:**
- WebSearch "{TICKER} SEC S-3 prospectus dilution warrants" pour chaque candidat (surtout small/mid-caps)
- Red flags : shelf registration S-3, ATM offerings, warrants actifs, underwriters toxiques (H.C. Wainwright, Maxim Group, Roth Capital, Ladenburg Thalmann)
- Serial diluters → exclure immédiatement du scanner
- Si risque présent mais modéré → mention rouge dans Risks + impact sur score/stop
- Vérifier aussi `insider_transactions` et `news` MCP pour signaux de dilution
