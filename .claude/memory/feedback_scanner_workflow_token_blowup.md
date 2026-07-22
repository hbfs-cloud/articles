---
name: scanner-workflow-token-blowup
description: Un fan-out d'agents (1 par ticker) où chaque agent appelle le MCP multiplie le coût par N — 4.3M tokens pour un scan. Batcher le MCP AVANT le fan-out, raisonner sur le pré-fetché.
metadata:
  type: feedback
---

**Incident (2026-07-22).** Un workflow `/scanner` a été structuré avec `parallel(tickers.map(t => agent(…)))` : ~14 agents de validation, **un par ticker**, chacun refaisant sa propre salve MCP (`GetInstruments` + 3-4 `QueryData` : sec_filings/flags/quote/enrichment) + relisant les fichiers, tous en `effort:'high'`. Résultat : **4.3M tokens, 28 min, pour UN scan** — et un résultat maigre (5 retenus sur 14, top-10 incomplet).

**Cause racine.** Un fan-out de N agents multiplie le coût par N. Quand chaque branche appelle le MCP, on retombe EXACTEMENT dans le round-trip-MCP-en-série que la doctrine perf élimine — en pire (N contextes d'agent). Le nombre de round-trips MCP doit scaler avec le nombre de **TYPES de données**, PAS avec le nombre de tickers.

**Règle (codifiée dans perf-parallel-mcp R7 + scanner-pipeline garde-coût) :**
- **Batch AVANT le fan-out** : 1 salve `QueryData(symbols="T1,…,T14", types="quote,sec_filings,flags,social_sentiment,insider_transactions,dark_pool,unusual_options,trading_signals", days=180)` (+ `GetInstruments` multi si besoin) = **~2-4 appels au total** pour toute la shortlist. Dump brut → fichier.
- **Fan-out APRÈS, SANS MCP** : les agents (si fan-out) reçoivent le JSON pré-fetché, ne rappellent jamais le MCP. Souvent mieux : **UN seul agent** raisonne sur le lot (le verdict garde/rejette per-ticker n'a pas besoin d'un contexte par ticker).
- **En Workflow** : salve MCP dans UNE phase `data` (ou l'agent principal) ; `validate`/`generate` consomment le pré-fetché. JAMAIS `parallel(tickers.map(t => agent(…MCP…)))`.
- **Effort** : ne pas mettre un fan-out large en `effort:'high'` sur des sous-tâches mécaniques.

**Why:** la doctrine `perf-parallel-mcp` (R3) disait déjà « batcher QueryData multi-symbole », mais ne couvrait PAS l'amplification par fan-out d'agents — une faille d'orchestration Workflow introduite en voulant paralléliser. Voir [[scanner-pipeline-fixes-20260722]].

**How to apply:** avant d'écrire un `parallel(items.map(agent(...)))` dans un Workflow, vérifier qu'aucune branche n'appelle le MCP. Si oui → sortir la salve MCP en amont (batchée multi-symbole), passer le pré-fetché aux branches, ou remplacer le fan-out par un seul agent.
