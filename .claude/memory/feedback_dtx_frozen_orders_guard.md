---
name: dtx-frozen-orders-guard
description: 2026-07-21 — garde anti-gel dans dtx-mcp-ingest.js (exit 8). Post-mortem : DtxDecide a renvoyé des CREATE figés à J-9 ré-ingérés en silence du 09 au 21/07 (les gardes de fraîcheur portaient sur les ENTRÉES, jamais sur la SORTIE moteur). La garde confronte la sortie à l'asof AVANT d'écrire ; batch figé = non écrit, exit 8, staging précédent conservé stale.
metadata:
  type: feedback
---

# Garde anti-gel DtxDecide (frozen-orders, exit 8)

**Incident** : du 09 au 21/07/2026, `DtxDecide` a renvoyé des ordres CREATE **figés à J-9**, ré-ingérés en
staging chaque soir sans détection. Cause de la cécité : tous les contrôles de fraîcheur (MCP HARD STOP,
sanity) portaient sur les **entrées** (prix/NaN/stale >48h) ou sur les **métriques replay** — **jamais sur
la SORTIE du moteur**. Un `200 OK` au corps gelé passait tous les gardes. Root cause corrigée côté MCP le
21/07 ; cette garde est le **tripwire de régression**.

**Garde** (`tools/dtx-mcp-ingest.js`, AVANT `writeStaging`) — trip si l'une des deux :
- (a) date de calcul stampée dans le payload decide (`state.asof`/…) ≠ `--asof` demandé ;
- (b) batch CREATE **byte-identique** au staging d'une séance DIFFÉRENTE (`prior.asof !== asof`) — les
  prix/`order_id`/`reason=Score` varient chaque jour, donc un batch NON VIDE identique sur deux asof
  distincts n'a pas été recalculé.

**Réaction** : **staging NON écrit** (contrairement à `metricsSuspect` qui écrit-puis-exit-7 : un batch
figé ne doit PAS atteindre `dtx-pool-bridge`/sweep → pas de trades fantômes), **`process.exit(8)`**, staging
précédent conservé **stale** (Step 4d / `qa-check` le remontent). `scan-ingest-all.js` collecte les modes
exit-8 dans un bucket « DTX FIGÉ » (exitCode 8) + alerte Telegram `alerts`.

**N'affecte NI** un premier run (pas de précédent) **NI** un re-run du même asof (`prior.asof === asof`, ex.
`--pit`) — pas de faux positif.

**Why** : « le MCP fait foi » ne doit jamais laisser passer une sortie moteur gelée ; la fraîcheur doit se
vérifier sur la SORTIE, pas seulement l'entrée. **How to apply** : tout ingest de décision moteur confronte
sa sortie à la séance demandée avant d'écrire ; jamais d'ingestion silencieuse d'un batch non recalculé.
Voir [[perf-parallel-mcp]], [[dtx-live-track-drift]].
