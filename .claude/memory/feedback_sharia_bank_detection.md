---
name: sharia-bank-detection
description: Le filtre Halal ne détectait pas les banques non-US (IBN=ICICI) comme haram — getSector renvoyait "Other", gate sweep permissif
metadata:
  type: feedback
---

Incident 2026-07-07 : **IBN (ICICI Bank = riba)** est entré dans le book **fortress** (mode
shariaOnly). Cause racine : `tools/lib/sharia-filter.js` `isHaramForHalalMode(IBN)` retournait
**false** car `getSector('IBN')` = `'Other'` (IBN absent de `SECTOR_MAP`) et `HARAM_SECTORS` ne
contenait que `'Finance'` (le label "Financial Services" ne mappait pas dessus). Le gate d'entrée
du sweep (`tools/sweep.js` ~L1559) est **permissif** (`.filter(t => !config.shariaOnly ||
!isHaramForHalalMode(t))`) → il repose entièrement sur la justesse de la détection.

⚠️ **NE PAS passer le gate en fail-closed** (sharia===true requis) : les positions Halal détenues
(DXCM/TT/AME/HLT/ASML) sont `sharia=undefined` (non-taguées mais licites) → un fail-closed viderait
le book à tort. Le fix doit être CIBLÉ sur la détection.

**Fix appliqué (commit 1cf7ac0ee)** :
- `getSector()` : fallback lazy-load sur `data/ticker-metadata.json` pour les tickers absents de
  `SECTOR_MAP` (IBN y a `sector:"Financials", industry:"Banks - Regional"` → mappé `'Finance'`).
- `labelToSector()` : mappe `Financials`/`Banks`/`Insurance`/`Financial Services`/`Diversified
  Financials` → `Finance`. NE matche PAS `Credit Services` (V/MA déjà `'Finance'` explicite).
- `isHaramForHalalMode()` honore aussi un label secteur/industrie porté par le signal.
- Vérifié : IBN/ING/MUFG/DB/BCS/BNS/JPM/V = haram=true ; DXCM/TT/AME/HLT/ASML/ABBV/FTNT/MNST/STM =
  false ; RTX (défense) = haram via `SHARIA_EXCLUDED`.

Re-sweep → IBN exclu à l'entrée → sorti du book (5 pending Halal conservés). Chaîne SHA intacte.
Aussi ce jour : `aplus.minScore` 92→85.

**Why** : la détection Halal par secteur échoue silencieusement sur les émetteurs sans data secteur
dans SECTOR_MAP (banques/assureurs non-US surtout). Un gate permissif + détection trouée = riba qui
passe. **How to apply** : quand on ajoute/évalue un mode shariaOnly, tester explicitement des banques
non-US (IBN/ING/MUFG) ; toute nouvelle source de tickers doit résoudre son secteur (ticker-metadata)
avant le gate. Hors-scope noté : XLP (ETF Consumer Staples avec noms tabac) dans les trades aplus —
screening des constituants d'ETF à évaluer séparément. Lié à [[fortress-pm-systematic-pipeline-step]].
