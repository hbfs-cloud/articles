---
name: sharia-bank-detection
description: Le gate shariaOnly est PERMISSIF → tout repose sur la détection. Screener par SECTEUR + liste SHARIA_EXCLUDED (pas juste sharia:false) : banques non-US (IBN/ICICI), financières untagged (NNI/Nelnet), constituants d'ETF. Aux DEUX sites. JAMAIS fail-closed.
metadata:
  type: feedback
---

Le gate d'entrée du sweep pour un mode `shariaOnly` (`tools/sweep.js` ~L1559) est **permissif** :
`.filter(t => !config.shariaOnly || !isHaramForHalalMode(t))`. Il repose ENTIÈREMENT sur la
justesse de `isHaramForHalalMode()`. Un filtre basé uniquement sur `sharia !== false` laisse
passer les tickers `sharia:null` (untagged) — les scanners momentum/breakout/trendline taggent
`sharia:null` sans screen sectoriel. La détection doit donc combiner secteur + liste + ETF, et
tourner aux **DEUX sites** : sélection de candidats (filtered) ET injection de positions live.

⚠️ **NE JAMAIS passer le gate en fail-closed** (`sharia===true` requis) : les positions Halal
licites détenues (DXCM/TT/AME/HLT/ASML) sont `sharia=undefined` (non-taguées mais licites) → un
fail-closed viderait le book à tort. Le fix doit être CIBLÉ sur la détection.

## `isHaramForHalalMode(s)` = reject si :
1. `s.sharia === false` (explicite), OU
2. ticker dans `SHARIA_EXCLUDED` (banques/assurance/défense/alcool/tabac/jeux — specialty
   finance ajoutée : NNI + SLM/NAVI/SOFI/ALLY/SYF/DFS/RKT/UWMC…), OU
3. `getSector(ticker)` dans `HARAM_SECTORS` (= {Finance}), OU un label secteur/industrie porté
   par le signal lui-même.

## Incident 1 — financière untagged (NNI, 2026-07-01)
**NNI (Nelnet, riba / net interest income)** est entré dans le book Fortress (Halal) via un
signal `sharia:null`. Fix : les 3 conditions ci-dessus ; ING (déjà listé) + NNI désormais exclus.

## Incident 2 — banque non-US (IBN, 2026-07-07, commit 1cf7ac0ee)
**IBN (ICICI Bank = riba)** est entré dans Fortress car `getSector('IBN')` = `'Other'` (IBN absent
de `SECTOR_MAP`) et `HARAM_SECTORS` ne contenait que `'Finance'` (le label « Financial Services »
n'y mappait pas). Fix :
- `getSector()` : fallback lazy-load sur `data/ticker-metadata.json` pour les tickers absents de
  `SECTOR_MAP` (IBN y a `sector:"Financials", industry:"Banks - Regional"` → mappé `'Finance'`).
- `labelToSector()` : mappe `Financials`/`Banks`/`Insurance`/`Financial Services`/`Diversified
  Financials` → `Finance`. NE matche PAS `Credit Services` (V/MA déjà `'Finance'` explicite).
- Vérifié haram=true : IBN/ING/MUFG/DB/BCS/BNS/JPM/V ; false : DXCM/TT/AME/HLT/ASML/ABBV/FTNT/
  MNST/STM ; RTX (défense) = haram via `SHARIA_EXCLUDED`.
- Re-sweep → IBN exclu à l'entrée → sorti du book (5 pending Halal conservés). Chaîne SHA intacte.
- Aussi ce jour : `aplus.minScore` 92→85.

## Incident 3 — ETF non screenés (commit 8f568dae0)
XLP (Consumer Staples SPDR, contient PM/MO tabac) est entré dans aplus (shariaOnly). Le filtre
screenait les ACTIONS par secteur mais ne regardait jamais les CONSTITUANTS d'un ETF ;
`SHARIA_EXCLUDED` n'attrapait que XLF/XLV/bond/leveraged, pas broad/sector/commodity (XLP/SPY/QQQ/
USO/GLD/GDX…). Fix : en shariaOnly, **tout ETF est haram sauf whitelist de fonds certifiés Sharia**
(SPUS/HLAL/UMMA/ISDW…). Détection via tags `SECTOR_MAP` 'ETF-*' + `isEtf(ticker,s)` (fallback
`asset_type` du signal) ; ~50 ETF miners/thématiques/énergie/REIT/biotech ajoutés au `SECTOR_MAP`
(GDX/TAN/ARKG/JETS/IBB/VNQ) pour les entrées futures sans asset_type. Re-sweep → XLP sorti
(pending), chaîne SHA intacte.

## Book Fortress clôturé = haram pré-mandat (DÉCISION USER EN ATTENTE)
Les trades CLÔTURÉS de Fortress contiennent des noms haram entrés avant le mandat Halal (LMT/RTX/
BA/MS/SCHW/SAN/USO/GDX/FXI/SMH/TAN…). Immuables (chaîne SHA) — ne PAS modifier. 3 options
proposées : date-scope le mandat / filtrer l'affichage du track-record / statu quo. Le gate
shariaOnly n'affecte que les entrées nouvelles + pending, jamais l'historique scellé (c'est pour
ça que MS/SCHW sont dans l'historique alors qu'ils sont dans `SHARIA_EXCLUDED`).

**Why** : la détection Halal échoue silencieusement (1) sur les émetteurs sans data secteur dans
`SECTOR_MAP` (banques/assureurs non-US), (2) sur les financières untagged, (3) sur les ETF dont
on ne screene pas les constituants. Gate permissif + détection trouée = haram qui passe. Le
`SECTOR_MAP` est incomplet (long tail → 'Other') — le screen sectoriel ne capte que les tickers
mappés ; **la liste `SHARIA_EXCLUDED` est le filet**. Idéalement le scanner source devrait tagger
`sharia` en amont.

**How to apply** : mode shariaOnly → tester explicitement banques non-US (IBN/ING/MUFG) ET ETF
(XLP/SPY/GDX) ; toute nouvelle source de tickers doit résoudre secteur + asset_type AVANT le gate ;
ajouter les financières manquantes à `SHARIA_EXCLUDED` ; ne jamais autoriser un ETF non certifié
Sharia ; ne jamais fail-closer le gate. Vérifier après sweep qu'aucune position n'est banque /
financière / défense.

Lié : [[modes-config-baseline]], [[fortress-pm-systematic-pipeline-step]], [[dilution-check]].
