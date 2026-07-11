---
name: ai-hedge-fund-adoption
description: 2026-07-11 — les 8 idées ai-hedge-fund adoptées (déterministe/sim-only). #4 sizing vol_corr est OPT-IN et NE bat PAS inverse_atr (A/B balanced/dynamic) → aucun flip live sans nouveau backtest gagnant. Live sizing = inverse_atr, PAS tiered mcap.
metadata:
  type: project
---

# Adoption ai-hedge-fund (virattt) — 8 idées livrées, déterministes, sim-only

Source : docs/research/ai-hedge-fund-ideas.md. Principe volé = séparation math/jugement + grilles
déterministes (PAS la boucle LLM ni leur backtest non reproductible). Tout est alimenté par le MCP.

## Livré (commits 2026-07-11)
- **#1 Value/Quality Board** (5 personas déterministes Buffett/Graham/Lynch/Munger/Burry) — `9d624ecb4`
  (tools/lib/value-quality-board.js + persona board dans senior-review.js).
- **#2 schéma pivot** {signal,confidence,reasoning} + **#3 state merge_dicts** multi-signaux + **#6**
  confidence explicables + agrégation pondérée déterministe — `ff3d913ee` (tools/lib/signal-schema.js,
  tools/lib/signals-desk-state.js, 5 générateurs annotés).
- **#8 clé cache PIT end_date** (anti-look-ahead rétros) — `ff3d913ee` (dtx-scan.js stagingPathFor →
  `<id>@<asof>.json`, dtx-mcp-ingest --pit, stockanalysis-fetcher asof-keyed, lessons anti-look-ahead).
- **#4 sizing vol+corr** (opt-in) — `f8e1e6bde` + fix `f0d3bf02a` (align corrélation cand/pos sur barres
  PIT partagées). **#7 menu compute_allowed_actions** (hold sûr) — `a2b2e059f`. **#5 valuation
  multi-méthodes** pondérée — `7cb9ae67d` (tools/lib/valuation-multi.js, émet au schéma pivot).

## ⚠️ Constat #4 à retenir (décision user en attente)
- Le sizing LIVE actuel de balanced/dynamic/turbo est **`inverse_atr`**, PAS le "tiered mcap" supposé par
  le doc. L'A/B réel = **vol_corr vs inverse_atr**.
- Backtest A/B (validate-config-change.js, 95 scans réels, walk-forward OOS depuis 2026-06-01, par régime) :
  **vol_corr NE BAT PAS inverse_atr** — balanced +16,23% vs +18,61% (FULL), +0,94% vs +1,19% (OOS) →
  verdict **WAIT**. dynamic idem (négatif des deux côtés).
- Donc `sizingMethod:'vol_corr'` reste **OPT-IN** (branche gated sweep.js, AUCUN mode basculé). **Ne
  flipper un mode vers vol_corr qu'après un nouveau backtest A/B 30j par régime + walk-forward qui BAT le
  sizing courant** (règles [[config-change-backtest]] + regime-aware-eval + segment-replay-absolute-dd).

## Contre-exemples documentés (à NE PAS copier)
Backtest LLM-in-the-loop (non reproductible), fallback silencieux create_default_response (viole MCP HARD
STOP), agrégation de convictions sans pondération. Voir [[mcp-only-data-path]] + north-star sim-only.
