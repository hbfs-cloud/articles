---
name: reference-aplus-screening-and-screener-dsl
description: "How to screen the monthly \"10 A+ setups\" via MCP + non-obvious RunScreener DSL gotchas + publish hook behavior"
metadata: 
  node_type: memory
  type: reference
  originSessionId: deefddae-1fa7-42e0-842e-a1d73228bfbe
---

Recipe + gotchas for producing the monthly **"10 setups A+"** analyses batch (recurring feature; net-new tickers each month, the prior batch is kept). A+ = max confluence on 5 axes, NOT "biggest mover": (1) structure EMA20>50>200 rising + RSI 50-68, (2) catalyst = 4 consecutive earnings beats, (3) R/R ≥ 1.5 with defined SL, (4) clean flags / zero toxic dilution (SEC S-3/ATM/warrants), (5) reasonable or growth-justified valuation.

## MCP screening pipeline that worked (Jun 2026)
1. `RunScreener` (async → poll `CheckJobStatus`) to build a liquid pool, then post-filter in code. Candidate objects from **RunScreener** only carry: `symbol, last_price, market_cap, rsi, macd, atr, avg_volume/volume, change_24h`. Filter `market_cap>=2e9 && !excludeList`.
   > ⚠️ Note 2026-07 (surface MCP v5) : `CheckJobStatus`/`ListJobs` sont des alias serveur legacy (HTTP direct OK) mais plus découvrables via ToolSearch. Canonique : `Jobs(job_id=...)` / `Jobs(intent_id=...)`. Note ajoutée, historique non réécrit.
2. `QueryData types=earnings_quarterly` (comma-separated symbols, limit 8) → keep only 4/4 beats (actual>estimate every quarter).
3. `QueryData types=technicals` → **verify EMA20>EMA50>EMA200 here** (the real structure gate; several RSI-healthy names fail it — e.g. golden-cross-pending or turnaround names).
4. `QueryData types=stats` → valuation (pegRatio, enterpriseToEbitda, priceToBook, beta, shares, shortPercentOfFloat).
5. `QueryData types=flags` → `is_compliance_issue/is_halted_recently/is_ftd_threshold`.
6. SEC dilution: per-ticker `WebSearch "<co> SEC EDGAR S-3 ATM offering"` — recent IPOs (e.g. CRDO/ALAB) often have active ATM/S-3 + SBC dilution; disclose honestly, it's non-toxic growth dilution ≠ INDO death-spiral.

## RunScreener DSL gotchas (cost me several wasted jobs)
- `ema`/`sma` need **2 args**: `ema(close,20)` (one-arg `ema(20)` errors "not enough arguments").
- **`abs()` is NOT supported** in `score_expr` — using it makes the whole screen return 0 candidates silently (no error). Keep score_expr simple (e.g. `rsi14`).
- An `ema(close,20)>ema(close,50)&&...` **pass_expr returns 0 candidates** (the price-series EMA-stack doesn't evaluate as expected) — don't gate the screen on the EMA stack; screen loose (`rsi14>53 && rsi14<67 && macd>0 && vol>2e6`) and verify the EMA stack per-ticker via `QueryData types=technicals`.
- `support_resistance` returns empty header strings (no real levels) → derive Trade-Idea levels from EMA20/EMA50 + ATR instead.
- `RunAutoScreener` momentum picks are hot-movers/overbought junk (RSI 85, micro-caps) — useful only for the **regime** field, not for A+ selection.

## Publish hook (important)
A **pre-commit hook** auto-regenerates `assets/search-index.json`, `data/search_data.js`, `sitemap.xml`, `feed.xml` and stages them into the commit. `publish.js` does NOT do this; `add_card.js` rebuilds only the search index. So: run `add_card.js` per article (it skips series sub-parts part2+ via a guard, 1 card/series), edit `radar.json` by hand (Claude-authored), then a single `git commit` triggers the hook — no need to run feed/sitemap generators manually.

## War-room lesson (Jun 2026): an A+ must be ACTIONABLE at the spot price
A deep 4-lens war room (quant/alpha/risk/bear) downgraded ALL 10 of a freshly-screened A+ batch off A+ (0/10 kept; grades B→A). Root causes, all reusable:
- **R/R-at-spot trap (the big one).** Screening for the STRONGEST momentum/structure selects names already +5–17% above a rising EMA20. The advertised R/R≥1.5 then only holds at an un-triggered PULLBACK limit; at the LIVE price R/R collapses to ~0.4–1.0. That is the "biggest mover" trap in disguise. FIX: the A+ screen must require R/R≥1.5 **at an actionable entry near the current price** — reject names more than ~5–8% above EMA20 unless the article is explicitly framed as a limit-order/watchlist entry (and then it is not a "buy-now A+").
- **Dilution check must go beyond ATM/S-3.** Caught only by the war room: PANW's $25B cash-AND-stock CyberArk deal (+4–22% shares) + SBC ~17% of revenue; HPE's scheduled Series C MANDATORY CONVERTIBLE (~5–7% in 2027). Screen M&A stock deals + mandatory convertibles + heavy SBC, not just shelf/ATM.
- **Catalyst can be INVERTED by macro.** DAL's "cheap airline" thesis was inverted by the live Iran/Hormuz oil shock (>$2B Q2 fuel headwind, capacity cuts, below-Street guide). A trailing 4-beat streak is not a forward catalyst.
- **Basket/correlation.** "Standalone aero (GE) + standalone airline (DAL)" was actually one bet (corr 0.70); MS/KEY 0.60; the set was a high-beta cyclical bloc (~5–6 independent bets, not 10) — wrong tilt for a neutral/early-risk-off tape.
- **Genuine actionable A+ from the re-screen (R/R ~2.0 AT MARKET, clean, reasonable val):** IBKR (strongest — +5.7% over EMA20, beta 1.33, clean 424B5 shelf only), STX (AI/HDD catalyst, PEG 0.61, accelerating beats), COLB (defensive bank, 1.12x book, below resistance). CRDO/ALAB rightly rejected (nosebleed + active ATM/SBC).

Related: [[feedback_dilution_check]], [[feedback_pipeline_gotchas]], [[feedback_no_hallucination]], [[feedback_no_false_caveats]]

## War-room contre-screen (5 août 2026) — 9 défauts d'entonnoir, verdict ZÉRO A+ confirmé

Run `/aplus` sur ~188 candidats liquides US, 3 passages RSI complémentaires (44-60, 48-60, 59-70).
Entonnoir : 57 survivent structure+extension ≤3%, 12 les dépassements + fenêtre résultats, 4 la guidance,
0 les contrôles risque. Quatre agents adversariaux + un synthétiseur refaisant ses propres appels ont
**confirmé le zéro** mais trouvé neuf défauts de méthode. Les cinq premiers sont réutilisables partout.

1. **Plancher de liquidité en TITRES = biais de prix déguisé.** 1,2-2,5 M titres/jour a masqué FFIV
   (714k titres mais **294 M$/jour**), qui passe les 4 éliminatoires sans dépôt dilutif. Idem CASY
   (337k = 287 M$/j), MUSA (263k = 155 M$/j). ⇒ plancher en DOLLARS : `close*avg_volume > 20e6`.
2. **`macd>0` teste le NIVEAU de la ligne, pas le croisement** — ne sélectionne aucun momentum.
   BCS MACD 0,3011 sous signal 0,3907 ; CL 0,1180 sous 0,2633 : les deux finalistes décéléraient.
   ⇒ comparer `macd` à `signal` en code (les deux sont dans `QueryData types=technicals`).
3. **`earnings_quarterly` ne sert que 4 trimestres**, quel que soit `limit`/`days` (vérifié sur 6 titres).
   L'éliminatoire « ≥5 dépassements » n'est donc PAS vérifiable sur donnée. Sourcer le 5e explicitement
   et DIRE qu'il vient de la presse, ou assumer une règle 4/4. Ne jamais imprimer « 5 vérifiés ».
4. **Le flux de résultats peut être FAUX.** XOM 2T2026 servi à 4,11 contre 3,629 (dépassement) ; le
   communiqué du 30/07 donne 3,52 ajusté contre ~3,68 (MANQUE). Détecteur : somme des 4 trimestres 8,86 $
   contre PE historique 25,92 à 153,96 impliquant ~5,92 $. ⇒ **réconcilier Σ4T contre `trailingPE × prix`**
   pour tout titre ayant publié dans les ~15 derniers jours.
5. **R/R : tester la cible contre l'OFFRE RÉELLE, pas contre le plus haut 52 s.** J'ai écrit « CL est le
   seul dont le R/R 1,5 tient au cours ». Faux : la cible 98,31 traverse le palier 95,42 / 96,01 / 95,93 /
   95,46 ; vers la première résistance effective le R/R vaut **0,90**. Et le stop 88,68 se logeait 0,6% sous
   le plancher de range (89,25 / 89,36), donc dans le bruit, pas sous structure.
6. **Ordre des opérations.** CL relevait du rejet dur « catalyseur inversé par la macro » (défensive
   bêta 0,327 en risk-on confirmé) : élimination AVANT scoring, pas malus pondéré.
7. **Émetteurs non domestiques : `sec_filings` est AVEUGLE.** Pas de 8-K item 2.02 pour les 6-K/20-F
   (TNK, BUD, BCS) ni pour le régime MJDS 40-F (CM, BMO). Un retour vide = absence de DONNÉE, pas absence
   de dilution. Dater la publication et vérifier la dilution à la source presse/IR.
8. **Contrôle dilution non généralisé** : mené sur un seul finaliste au lieu de tous les survivants.
9. **Périmètre d'univers à écrire dans le skill** : les ETF sont structurellement inéligibles
   (`earnings_quarterly` et `calendar` vides ⇒ 2 éliminatoires sur 4 indéfinis) ; la grille est
   majoritairement incalculable sur l'Europe ; « 4 trimestres consécutifs » n'a pas de sens sur un
   émetteur à publication semestrielle ; la borne des 10 séances doit être déclarée inclusive ou exclusive
   (cas RNR, 8-K item 2.02 du 22/07, pile dessus).

**Leçon de régime, plus importante que les neuf.** Le zéro ne vient pas d'un filtre trop dur mais du
régime : en risk-on avancé à ATR comprimé, tout ce qui est structurellement propre est collé sous son
plus haut annuel, donc une cible à 1,5 R depuis un stop 1,5×ATR sort AU-DESSUS du plus haut 52 semaines.
Vérifié sur FFIV, BCS, EOG, BBY, FHN, AZZ, MSM, CRS, PSMT. Ce qui rouvre le jeu : une respiration qui
recrée de la distance sous le plus haut, ou une cassure confirmée en volume.

⚠️ Mémoire MCP indisponible au moment de l'écriture (`get_context` en timeout 60s ×2) : cette entrée n'est
persistée QUE côté git, la règle de double écriture reste à honorer quand le serveur répond.

## Run 7 août 2026 — zéro A+ confirmé une 2e fois, avec le chiffre qui tranche

421 candidats bruts (7 passages RSI complémentaires) → 343 après plancher DOLLARS + mcap → 305 après
exclusion des dossiers couverts → 199 sur `macd > signal` comparé par ticker → 89 sur l'empilement →
41 sur extension ≤3% → 32 sur PE fwd <35× → 31 sur la fenêtre résultats (borne INCLUSIVE) → 12 sur
4/4 dépassements → 7 après réconciliation Σ4T vs `trailingPE × prix` → 6 domestiques → **2 sur la
guidance relevée** → 1 après contrôles de risque → **0 au seuil de 92/100**.

Seul survivant des 4 éliminatoires : **BOKF** (144,47 ; EMA 141,34/137,79/126,39 empilées ; extension
+2,21% ; RSI 65,3 ; MACD 2,102 > signal 1,976 ; PE fwd 13,50 ; guidance crédits relevée >10%). Score
final **49/100**, tué par le R/R : le titre a touché son plus haut 52 s à 145,57 le 6/08 et clôturé à
**11,3% de l'amplitude**. Stop sous EMA20 à 140,90 (vérifié : 140,90 < 141,34) ⇒ risque 3,57 $.
Première offre réelle = le plus haut lui-même ⇒ **R/R 0,31**. Viser 2,5R impose 153,4 $, soit 5,4%
au-dessus du plus haut historique, dans une zone jamais testée. Ce n'est pas un R/R, c'est une
extrapolation.

### Nouveaux gotchas DSL (vérifiés ce run)
- **`sma` exige un nom de série ENTRE GUILLEMETS** : `sma('vol',20)`. Sans guillemets ⇒ 0 candidat avec
  `eval error` sur 1 217 symboles. (Complète la règle « 2 arguments ».)
- **`top_k` trie par RSI décroissant et tronque la bande basse** ⇒ faire des passages RSI ÉTROITS
  complémentaires, jamais une seule large.
- Plancher DOLLARS revalidé : **BOKF ne traite que 253 601 titres/jour (37 M$/j)**. Un plancher en titres
  aurait supprimé le seul nom passant les 4 éliminatoires. La règle #1 du 5 août tient.

### ⚠️ NOUVEAU — angle mort majeur : bloc technique CORROMPU ⇒ ticker INVISIBLE
Certains titres reviennent avec `rsi=0, atr=0, ema20=0, ema50=0, ema200=0` et un MACD absurde. Un RSI à 0
échoue MÉCANIQUEMENT toute bande RSI ⇒ le titre ne franchit aucun passage et n'est **jamais évalué** —
il n'est pas rejeté, il est invisible, et l'entonnoir ne le compte nulle part.
Cas vérifiés le 7/08 : **TEAM** (Atlassian, 694 M$/jour de volume, MACD 99,50 sur un titre à 110 $) et
**PAA**. ⇒ AJOUTER un contrôle systématique en tête d'entonnoir : compter les titres de l'univers liquide
dont `rsi` ou `atr` vaut 0, et les traiter comme « non évaluables » explicitement, jamais en silence.

### Leçon de régime, affinée
La distribution ESPÉRÉE a bien eu lieu le 6/08 (BOKF clôture à 11,3% de son amplitude sur son plus haut
annuel, PB 13,5%, SNX 12,8%, WMS 13,8% sur 1,94× le volume) — mais elle **n'a pas encore recréé de
distance exploitable**. Les noms qui ONT de la distance sous leur plus haut échouent chacun pour une
raison indépendante du régime : SNX R/R 0,70 contre la vraie offre, WMS guidance seulement confirmée le
jour même, STX conversion d'obligations en actions datée au 8 septembre (dilution DANS la fenêtre).
Ce qui rouvrirait le jeu : 2-4 séances de respiration ramenant BOKF vers son EMA50 (−4,6%) sans casser
l'empilement, ou une cassure confirmée en volume au-delà de 145,57.
