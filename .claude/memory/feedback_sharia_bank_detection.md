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

**2e trou (même thème) — ETF non screenés (commit 8f568dae0)** : XLP (Consumer Staples SPDR,
contient PM/MO tabac) est entré dans aplus (shariaOnly). Le filtre screenait les ACTIONS par secteur
mais ne regardait jamais les CONSTITUANTS d'un ETF ; SHARIA_EXCLUDED n'attrapait que XLF/XLV/bond/
leveraged, pas broad/sector/commodity (XLP/SPY/QQQ/USO/GLD/GDX...). Fix : en shariaOnly, **tout ETF
est haram sauf whitelist de fonds certifiés Sharia** (SPUS/HLAL/UMMA/ISDW...). Détection via tags
SECTOR_MAP 'ETF-*' + `isEtf(ticker,s)` (fallback asset_type du signal) ; ~50 ETF miners/thématiques/
énergie/REIT/biotech ajoutés au SECTOR_MAP (GDX/TAN/ARKG/JETS/IBB/VNQ) pour les entrées futures sans
asset_type. Re-sweep → XLP sorti (pending, comme IBN), chaîne SHA intacte.

**Book fortress clôturé = haram pré-mandat (DÉCISION USER EN ATTENTE)** : les trades CLÔTURÉS de
fortress contiennent des noms haram entrés avant le mandat Halal (LMT/RTX/BA/MS/SCHW/SAN/USO/GDX/
FXI/SMH/TAN...). Immuables (chaîne SHA) — ne PAS modifier. 3 options proposées : date-scope le mandat
/ filtrer l'affichage du track-record / statu quo. Le gate shariaOnly n'affecte que les entrées
nouvelles+pending, jamais l'historique scellé (c'est pour ça que MS/SCHW sont dans l'historique alors
qu'ils sont dans SHARIA_EXCLUDED).

**Why** : la détection Halal échoue silencieusement (1) sur les émetteurs sans data secteur dans
SECTOR_MAP (banques/assureurs non-US) et (2) sur les ETF dont on ne peut screener les constituants.
Gate permissif + détection trouée = haram qui passe. **How to apply** : mode shariaOnly = tester
explicitement banques non-US (IBN/ING/MUFG) ET ETF (XLP/SPY/GDX) ; toute nouvelle source de tickers
doit résoudre secteur+asset_type avant le gate ; ne jamais autoriser un ETF non certifié Sharia.
Lié à [[fortress-pm-systematic-pipeline-step]].
