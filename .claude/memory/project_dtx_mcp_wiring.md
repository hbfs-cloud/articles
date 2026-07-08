---
name: project-dtx-mcp-wiring
description: Wiring du chemin scripted-mode dtx vers le MCP hébergé (canonique) + binaire vendoré (fallback) + résultat de parité MCP↔binaire par mode (2026-07-08)
metadata:
  type: project
---

# dtx MCP wiring — canonique + fallback + parité (2026-07-08)

Le chemin scripted-mode dtx (5 modes câblés : `us_highvol`, `forex`, `etf_us`, `etf_eu`,
`stockbox_nasdaq`) est câblé pour préférer le **MCP hébergé** `systematic.dailytickers.com`
(namespace agent `mcp__claude_ai_systematic__*`), binaire vendoré = **fallback offline**.

## Contrainte dure (immuable)
Un subprocess `node` ne PEUT PAS appeler le MCP (OAuth2 sur claude.ai, règle ZÉRO token en .env).
Seul l'**AGENT** (`claude -p`, qui a les outils MCP enregistrés) l'appelle. Câblage :
**agent → `DtxDecide`/`DtxReplay` → écrit les JSON bruts → `node tools/dtx-mcp-ingest.js` → `data/dtx/<id>.json`**.

## Mécanisme (nouveau)
- `tools/dtx-mcp-ingest.js` — ingère une paire DtxDecide+DtxReplay et écrit le staging dans le
  **schéma EXACT** de `dtx-scan.js` (byte-compatible : `dtx-scan.js` exporte désormais
  `buildStaging`/`extractReplayMetrics`/`writeStaging`/`mapOrder`/`goLiveFor` — une seule source de
  vérité du schéma). Provenance : `engine="dtx (systematic-tss) — MCP"`, `engineMode="mcp"`.
  Byte-identité prouvée sur `etf_eu` (payload identique au binaire, seuls engine/engineMode/generatedAt/tookMs diffèrent).
- `PORTFOLIO_TO_MODE` splice le backtest (`--to`=`statusSince`) à la courbe live.

## Préférence (par mode), fail-safe
1. **MCP** (canonique) — agent, Phase 5, AVANT `publish-daily-card.sh`.
2. **Binaire vendoré** `dtx-scan --skip-if-no-tss` (bundle `tools/bin/dtx-data`, offline) — si MCP down/OOM/hors-agent.
3. **Staging committé** — lecture seule, jamais bloquant.
`publish-daily-card.sh` Step 4d détecte un staging `engineMode:"mcp"` daté d'aujourd'hui → le CONSERVE
(canonique) ; sinon régénère via binaire. Skill `scanner-pipeline.md` §"dtx refresh (MCP CANONIQUE)".

## 🚧 Re-vérif 2026-07-08 (soir) — BLOQUÉE : serveur passé en async, tool de poll NON exposé
Tentative de re-vérif après le « fix RAM » serveur. Résultat : **impossible de re-vérifier ou de flipper
quoi que ce soit**, parité **inchangée** (seul `etf_eu` reste MCP-canonique).

- **GetHealth** (avant/après) = `{ok:true, binary_ok:true, data_dir_ok:true, config_count:13, cache_writable:true}`.
  Aucun champ RAM/version/provenance surfacé par GetHealth (le schéma le promet — commit systematic-tss,
  go version, sha256 depuis PROVENANCE.json — mais l'output ne les contient pas). DtxListConfigs=13 OK.
  DtxRegime OK sync (asof 2026-07-08 : RISK_ON, score 0.76, VIX 16.13).
- **Cause racine du blocage** : le « fix RAM » a déplacé **DtxDecide ET DtxReplay** vers un **modèle de job
  asynchrone**. Chaque appel renvoie désormais `{"status":"async_pending","job_id":"…","poll":{"tool":
  "DtxJobStatus"}}` — y compris les modes qui répondaient en SYNC avant (etf_eu decide, forex replay).
  **Mais `DtxJobStatus` n'est PAS enregistré dans la surface d'outils du serveur `systematic`** : seuls 5
  outils existent (GetHealth, DtxListConfigs, DtxDecide, DtxReplay, DtxRegime) — vérifié par ToolSearch sur
  toutes les variantes de nom (DtxJobStatus/JobStatus/GetJob/DtxJob/DtxResult/DtxPoll/DtxJobResult…). Le
  `marketdata.Jobs` est un AUTRE serveur (ne connaît pas les job_id systematic). Ré-appeler DtxDecide à
  l'identique **ne renvoie PAS le résultat caché** → juste un nouveau job_id.
- **Conséquence** : aucun résultat decide/replay récupérable → parité non re-calculable, OOM non
  confirmable, **0 mode flippé**. Règle No-Hallucination / MCP Hard Stop : on ne fabrique pas de parité.
- **À faire côté serveur** avant de reprendre : exposer `DtxJobStatus` (ou repasser Decide/Replay en sync,
  ou renvoyer le résultat inline sur un ré-appel same-day idempotent). Dès que le poll existe : relancer les
  5 modes (asof=statusSince, balances flat `{CUR:100000}`, from=2021-01-01, to=go-live), ingérer, comparer.

## ⚠️ Résultat de parité MCP↔binaire (2026-07-08 matin) — MIXTE, périmé côté re-vérif (voir bloc ci-dessus)
| Mode | DtxDecide (orders) | DtxReplay (metrics) | Verdict |
|------|--------------------|---------------------|---------|
| `etf_eu` | ✅ match 3/3 (noms+qty+prix) | ✅ identique (1 779 587,59 ; 1104 tr ; DD 26,55) | **MCP canonique OK** (flippé engineMode:mcp) |
| `etf_us` | ✅ match 7/7 (prix ~4 déc.) | ❌ diverge (440K vs 530K ; 2668 vs 2652 tr) | garder binaire |
| `forex` | ❌ diverge (USDJPY/USDCAD vs GBPJPY/AUDUSD) | ✅ identique (147 278,29 ; 949 tr) | garder binaire |
| `us_highvol` | ❌ **OOM** `signal: killed` (2403 titres) | ⚠️ diverge (3,23M vs 3,04M ; mêmes 635 tr + même DD) | **binaire obligatoire** |
| `stockbox_nasdaq` | ❌ **OOM** `signal: killed` (5189 titres) | ✅ quasi-identique (2,031M vs 2,037M=0,26% ; DD identique) | **binaire obligatoire** |

## Cause des écarts (comprise)
1. **Dérive adjusted-close** : le serveur a un cache OHLCV plus frais que le bundle gelé → re-ajustements
   dividendes/splits sur actions/ETF US décalent les fills sur 5,5 ans (forex + ETF EU sans dividende = identiques).
   Confirmé : le replay `forex` chevauche jusqu'à 07-06 est **byte-identique**, seul le decide J+2 diverge (recence).
2. **OOM `decide`** : `decide` charge tout l'univers actions (2,4–5,2k titres) en RAM → le garde-fou RAM du
   serveur tue `us_highvol` et `stockbox_nasdaq`. Ces 2 modes **doivent** rester binaire tant que la RAM serveur
   n'augmente pas. (Appels concurrents aggravent l'OOM — lancer les gros univers séquentiellement.)

**Bilan honnête** : le MCP n'est PAS un remplacement drop-in aujourd'hui (2/5 OOM sur decide, 2/5 dérive replay).
Seul `etf_eu` est un match complet propre. Le câblage (MCP-préféré + fallback binaire par mode) est en place et
prêt ; le staging live des 4 autres modes reste sur le binaire (non-régression du dashboard).
