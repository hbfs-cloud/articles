# Compaction mémoire MCP — petits workspaces (2026-08-26)

Mandat modifié en cours de route par l'utilisateur : posture agressive, "en cas de doute j'évince".
Éviction = soft-delete côté serveur (audit conservé) + corps complet sauvegardé ci-dessous.

Règles de survie appliquées : type `user` (intouchable), `priority: critical`, `requires_ack: true`,
mise à jour depuis 2026-08-19, ou doctrine/projet encore vivant propre au workspace.
Règles d'éviction : doublon de `dailystocks` (lecture seule, jamais écrit), instantané daté < 2026-08-01,
état de système disparu/référence morte, doublon interne (garder la version la plus complète).

---

## Workspace `articles` (23 actives → cible : très maigre)

Toutes les entrées dataient de fin juin 2026 (created_at 2026-06-25/26/29/30, updated_at 2026-07-02),
donc antérieures au 2026-08-01 → éligibles à l'éviction sauf protection explicite (user / critical).

### Évincées (20)

| id | nom | type | raison | survivant |
|---|---|---|---|---|
| ebe20a9e-7e3a-4c35-b7be-9ac527349df0 | candlestick-scanner-data-source | fact | État de système disparu — contredit la règle actuelle CLAUDE.md "Candlestick No MCP: candlestick-scanner.js utilise le fichier univers local, JAMAIS MCP RunScreener" | — |
| ebd9a175-63a0-4e02-a466-c6f43c44701c | candlestick-signal | fact | Instantané marché daté (juin 2026), périmé | — |
| ad927990-aff6-494a-b27b-300f24ade168 | crisis-mode-status | fact | Instantané d'état ("OFF"), périmé | — |
| 66f5f8b7-8999-409f-9d9a-81ebc9c3f883 | current-regime | fact | Instantané marché ("EARLY RISK-OFF"), périmé | — |
| a903127e-61e2-4207-b4e2-44887834b995 | defensive-tilt | fact | Instantané d'allocation, périmé | — |
| 7f5c5123-9736-4347-b740-6ed1d3a9f627 | market-indices | fact | Instantané marché daté (S&P 7440 etc.), périmé | — |
| 50ea3f6a-6056-4e6a-9a0f-d6e8af596f5f | mcp-gateway-url | fact | État de système disparu — "Gateway"/MCP_GATEWAY_URL sont des noms morts (CLAUDE.md: "ex-Gateway/DailyTickers — morts", namespace actuel mcp__claude_ai_marketdata__*) | — |
| 510dcd98-f6fa-477e-96f7-4e5c57eb2c07 | optimize-sizing-adds | fact | Instantané ("GM et EME ajoutés"), périmé | — |
| 189aacee-a739-4d44-a0ec-a2d6b5e28646 | optimize-sizing-drops | fact | Instantané (AEP/FCX droppés par corrélation), périmé | — |
| 12e5865b-ca80-4c96-b079-2a57885f11fb | project-configuration | fact | Doublon interne de `direct-merge-to-main` (règle critical conservée) + doublon dailystocks/git-commit-directly-on-main | direct-merge-to-main (articles) |
| c548a359-80d3-46a6-99e9-d6d585179f3d | qa-check-for-candlestick-signals | fact | Doublon conceptuel de dailystocks/candlestick-bull-pipeline + dailystocks/bull-8x-parity (cette dernière apporte une nuance absente ici : 0 signal un jour calme = légitime) | dailystocks/candlestick-bull-pipeline, dailystocks/bull-8x-parity |
| 6f2eb490-bf3f-46c6-a0ff-0cd271ca456f | scanner-20260630-regime | fact | Instantané daté (30/06/2026), périmé | — |
| d807afa8-75fc-421a-983b-eb92380ebd6f | sharia-compliant-pick | fact | Instantané pick ("NVS"), périmé | — |
| 60730004-7fff-4b2f-9f93-b23d35f2cad7 | sizing-multiplier | fact | Instantané ("1.0"), périmé | — |
| 3ec19ed6-dd41-4f06-ba00-7f9b322abc87 | tkl-pool-status | fact | Instantané ("empty"), périmé | — |
| 555f3c7a-30cb-48c7-b065-11021c6983f3 | top-10-picks | fact | Instantané picks datés, périmé | — |
| de198e2f-2384-4362-a321-79bdef662a47 | mcp-gateway-host | reference | État de système disparu — même raison que mcp-gateway-url (host "Gateway" mort) | — |
| bacd9b2a-d828-4f19-b336-fe48a18707f3 | nvs-stock-info | reference | Instantané setup de trade (entry/stop/TP NVS juin 2026), périmé | — |
| e0f190b1-a728-43f2-b829-9306c215776c | breakout-strategy-status | rule | Instantané de statut ("BLOCKED"), priority normal, périmé | — |
| d90df751-eb6d-4827-9593-f05c16f2beae | pullback-strategy-status | rule | Instantané de statut ("BLOCKED"), priority normal, périmé | — |

### Survivantes (3)

- **f06bbbb3-8890-4f77-a050-1560490271ea** `mohamed-elouadi` (type `user`) — INTOUCHABLE.
- **9ee3cfb3-a4a8-4423-9ee7-e47186b6c620** `bull-mode-non-zero-signal-rule` (type `rule`, **priority: critical**) — protégée malgré chevauchement avec dailystocks/bull-8x-parity (qui nuance : 0 signal jour calme = légitime, à vérifier côté métier).
- **3c6f63ee-a5de-4151-8870-5494d87d74e8** `direct-merge-to-main` (type `rule`, **priority: critical**) — protégée malgré chevauchement avec dailystocks/git-commit-directly-on-main.

### Corps complet des entrées évincées (audit)

**candlestick-scanner-data-source** (fact)
> Body: "The candlestick scanner sources data from the DailyTickers MCP gateway (bars_daily via QueryData, batched, JSON-RPC) with Yahoo as a fallback"
> Tags: candlestick-scanner, data-source · created 2026-06-26

**candlestick-signal** (fact)
> Body: "NBP (THREE_OUTSIDE_UP, score 170, 9.3x volume)"
> Tags: candlestick · created 2026-06-29

**crisis-mode-status** (fact)
> Body: "OFF"
> Tags: crisis-mode · created 2026-06-25

**current-regime** (fact)
> Body: "EARLY RISK-OFF"
> Tags: market-regime · created 2026-06-25

**defensive-tilt** (fact)
> Body: "6/10 in utilities/staples/healthcare"
> Tags: defensive-tilt · created 2026-06-29

**market-indices** (fact)
> Body: "S&P 7,440 (+1.18%), NASDAQ +2.07%, VIX 17.65, Gold $4,030, WTI $70.42"
> Tags: market-indices · created 2026-06-29

**mcp-gateway-url** (fact)
> Body: "The MCP gateway URL is sourced from the environment variable MCP_GATEWAY_URL"
> Tags: environment-variable, mcp-gateway · created 2026-06-26

**optimize-sizing-adds** (fact)
> Body: "GM and EME"
> Tags: optimization · created 2026-06-29

**optimize-sizing-drops** (fact)
> Body: "AEP (corr 0.78 with AEE) and FCX (corr 0.78 with BHP)"
> Tags: correlation · created 2026-06-29

**project-configuration** (fact)
> Body: "DailyTickers utilise une configuration où les merges sont effectués directement sur la branche main"
> Tags: configuration, dailytickers · created 2026-06-26

**qa-check-for-candlestick-signals** (fact)
> Body: "A QA check (qa-check.js) is in place to guard against zero candlestick signals in the latest scan for live/deploying candlestick_only mode"
> Tags: candlestick-signals, qa-check · created 2026-06-26

**scanner-20260630-regime** (fact)
> Body: "EARLY RISK-OFF 6th consecutive session (ERO 44.6%, risk_on 35.2%, crisis 15.4%)"
> Tags: market-regime · created 2026-06-29

**sharia-compliant-pick** (fact)
> Body: "NVS"
> Tags: sharia-compliant · created 2026-06-25

**sizing-multiplier** (fact)
> Body: "1.0"
> Tags: sizing-multiplier · created 2026-06-25

**tkl-pool-status** (fact)
> Body: "empty"
> Tags: tkl-pool · created 2026-06-25

**top-10-picks** (fact)
> Body: "AEE, BHP, BUD, KOF, MDLZ, NVS, GM, IX, EME, MAR"
> Tags: stock-picks · created 2026-06-29

**mcp-gateway-host** (reference)
> Body: "The MCP gateway host is mcp.dailytickers.com"
> Tags: host, mcp-gateway · created 2026-06-26

**nvs-stock-info** (reference)
> Body: "EU Healthcare, entry $154-156, stop $150.50, TP1 $164, TP2 $169, PE fwd 15.6x, div 3.1%"
> Tags: nvs, stock-info · created 2026-06-25

**breakout-strategy-status** (rule)
> Body: "BLOCKED"
> Tags: breakout-strategy · created 2026-06-25

**pullback-strategy-status** (rule)
> Body: "BLOCKED"
> Tags: pullback-strategy · created 2026-06-25

---
