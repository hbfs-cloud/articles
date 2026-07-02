---
name: scanner-silent-failures
description: "Les scanners scriptés crashent parfois de façon transiente (réseau/cold-cache) et le runner est non-bloquant → 0 signal silencieux. Garde : markers _scanRuns + qa-check FAIL si marker absent."
metadata:
  type: feedback
---

# Échecs silencieux des scanners scriptés

**Incident (nuit du 20260702)** : highvol/etf/etf_eu/momentum/casablanca n'ont rien émis
— crash transient (réseau/cold-cache, non reproductible au re-run), masqué par les
`|| echo non-bloquant` du runner. Personne ne l'a vu ; la page status a perdu les
sections Orders de ces modes (hotfixes manuels 18dcb1d00/702bd4baa).

**Why:** Un pipeline non-bloquant sans preuve d'exécution transforme tout crash en
« jour calme ». Indistinguable d'un 0 signal légitime (règle bull 8×).

**How to apply:**
- Chaque scanner scripté écrit `_scanRuns{"<scanner>[:univers]"}: {at, universe, candidates, signals}`
  dans signals.json (merge, jamais d'écrasement). Clés : `highvol`, `etf`, `etf:etf_eu`,
  `momentum`, `momentum:casablanca`, `casablanca`, `trendline:*`, `fractal:*` (+ `_candlestickScan` bull).
- qa-check.js : marker absent pour un mode live scripté = **FAIL** ; marker présent avec
  0 signal = WARN (légitime). Réparation d'une nuit manquée : relancer les commandes
  exactes du runner (publish-daily-card.sh Steps 2c-2n) sur le folder concerné, puis
  sweep + gen-status-page.
- Lié : [[bull-8x-parity]], [[pipeline-gotchas]].
