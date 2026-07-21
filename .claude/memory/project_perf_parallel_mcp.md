---
name: perf-parallel-mcp
description: 2026-07-21 — doctrine perf transverse pour TOUS les skills MCP. Le goulot = round-trip MCP en série. Règle : isoler le MCP en salves parallèles (1 message = N tool_use), batcher QueryData multi-symboles, scripter l'assemblage en node, backgrounder le pipeline long. Invariants (HARD STOP/fail-closed/no-skip/zéro hallu) inchangés.
metadata:
  type: project
---

# Doctrine perf — MCP en salves parallèles (transverse)

Skill source de vérité : `.claude/skills/perf-parallel-mcp.md` (R1-R6 + invariants + gabarit).

**Problème** : un skill qui tire N appels MCP l'un après l'autre (3-8 s/appel) = minutes de temps mort.
Le CPU n'est jamais le goulot — le **round-trip série** l'est.

**Règles** : R1 isoler le MCP (phase dédiée) · R2 une salve = UN message, N tool_use // (levier #1) ·
R3 batcher `QueryData` multi-symboles + dédup cross-usage · R4 preflight `GetStatus` 1× + lancer tous les
jobs async PUIS poller · R5 scripter l'assemblage en node (le MCP ne sort que du brut, contrat POSITIONNEL
`{symbols,result}`) · R6 backgrounder le pipeline long (sweep ~5 min hors budget ressenti).

**Implémentation `/scanner` (référence)** : `tools/scan-plan.js` (manifeste des appels MCP en vagues) →
salves // → `/tmp/mcp-raw/<key>.json` → `tools/scan-ingest-all.js` (assemble tous les staging + ingest
dtx, garde sanity exit 7) → `publish-daily-card.sh` en background → `Skill(signals-desk)` via handoff
`/tmp/scan-context.json`. Cible : phase agent/MCP ≤ 5 min (le sweep ~5 min tourne en fond, non attendu).

**/scanner appelle signals-desk** (handoff, zéro re-fetch) mais signals-desk reste invocable seul.

**Propagé** à tous les skills MCP-heavy (bloc « ⚡ Exécution (voir perf-parallel-mcp) », additif) :
scanner-pipeline, signals-desk, swing/squeeze/earnings/sector/macro, aplus-setups, fortress-pm,
daily-weekly, run-session (broker : seules les LECTURES se parallélisent, les ORDRES restent séquentiels+confirmés).

**Why** : réponse au « /scanner super lent » (2026-07-21). **How to apply** : toute phase de collecte MCP
d'un skill = salves parallèles nommées concrètement, assemblage node, background. Ne JAMAIS re-sérialiser
(un fetch, un calcul, un fetch). Invariants MCP HARD STOP / fail-closed / no-skip / zéro hallucination
NON négociables — la perf vient APRÈS le preflight, ne le masque jamais. Voir [[dtx-live-track-drift]].
