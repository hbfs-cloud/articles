---
name: project-dtx-mcp-wiring
description: CUT-OVER 2026-07-08 — dtx MCP hébergé = SEUL moteur ("le MCP fait foi"). Binaire local + bundle SUPPRIMÉS. Câblage agent→MCP→ingest. Cloud routine vérifiée (connector compte claude.ai reachable headless).
metadata:
  type: project
---

# dtx MCP wiring — MCP SEUL MOTEUR (cut-over 2026-07-08)

## ✅ CUT-OVER FINAL (2026-07-08) — le MCP fait foi, binaires supprimés
Décision utilisateur : **cut-over complet et décisif** vers le MCP hébergé comme **SEUL moteur** dtx.
- **SUPPRIMÉS du repo** (git rm) : `tools/bin/dtx-darwin-arm64` (17M), `tools/bin/dtx-linux-amd64` (18M),
  stray `tools/bin/dtx-linux-arm64` (17M, untracked → rm), bundle `tools/bin/dtx-data/` (9.9M),
  `tools/bin/PROVENANCE.json`, `tools/bin/README.md`, `tools/lib/dtx-engine.js` (wrapper binaire),
  et les 2 lignes LFS de `.gitattributes` (fichier supprimé, ne contenait que ça).
- **`tools/dtx-scan.js`** réécrit : ne spawn PLUS aucun binaire. Porte le schéma partagé
  (`buildStaging`/`extractReplayMetrics`/`writeStaging`/`mapOrder`/`goLiveFor`) + `stagingStatus()` +
  `--list`. Un `--mode`/`--all` affiche la marche à suivre MCP-ingest et sort en **0** (dégradation
  gracieuse, jamais bloquant, ne fabrique jamais et ne fallback jamais sur un binaire supprimé).
- **`publish-daily-card.sh` Step 4d** = garde de fraîcheur uniquement (`stagingStatus` par mode → warn si
  staging manquant/stale). Ne régénère plus rien.
- **5 modes câblés flippés `engineMode:"mcp"`** dans `data/dtx/*.json` (KEPT). Parité MCP↔binaire n'est
  PLUS un critère (le binaire n'existe plus). Le replay MCP dérive légèrement jour-à-jour (re-fetch
  adj-close plus frais) — **attendu, pas un bug**.
- **Vérif locale** : chaîne MCP→ingest re-testée end-to-end sur `etf_eu` (decide COFF/ECOF/ARKG
  554/4317/4686 ; replay final €1 774 706, 1102 tr, DD 29.67, Sharpe 2.08 ; ingest → engineMode:mcp OK) ;
  `gen-status-page` + `gen-api` (109 endpoints), qa-check **0 ❌** (45 checks, 39 ✅, 6 ⚠️ pré-existants),
  les 5 modes rendent `[dtx]`.
- **Cloud routine vérifiée** (voir `reference_dtx_mcp.md` §Cloud) : `mcp__claude_ai_systematic__*` est un
  connector de niveau COMPTE claude.ai (absent de `.mcp.json`/`~/.claude.json`) → un `claude -p` headless
  (exactement l'invocation du bot, même Mac + même compte) a appelé `GetHealth` avec succès. Prompt du
  schedule #1 renforcé pour appeler la chaîne dtx MCP + ingest.

Le chemin scripted-mode dtx (5 modes câblés : `us_highvol`, `forex`, `etf_us`, `etf_eu`,
`stockbox_nasdaq`) passe **EXCLUSIVEMENT** par le **MCP hébergé** `systematic.dailytickers.com`
(namespace agent `mcp__claude_ai_systematic__*`). Plus de fallback binaire.

## Contrainte dure (immuable)
Un subprocess `node` ne PEUT PAS appeler le MCP (OAuth2 sur claude.ai, règle ZÉRO token en .env).
Seul l'**AGENT** (`claude -p`, qui a les outils MCP enregistrés) l'appelle. Câblage :
**agent → `DtxReplay`/`DtxDecide` (poll `DtxJobStatus`) → écrit les JSON bruts → `node tools/dtx-mcp-ingest.js` → `data/dtx/<id>.json` (engineMode:mcp)**.

## Mécanisme (nouveau)
- `tools/dtx-mcp-ingest.js` — ingère une paire DtxDecide+DtxReplay et écrit le staging dans le
  **schéma EXACT** de `dtx-scan.js` (byte-compatible : `dtx-scan.js` exporte désormais
  `buildStaging`/`extractReplayMetrics`/`writeStaging`/`mapOrder`/`goLiveFor` — une seule source de
  vérité du schéma). Provenance : `engine="dtx (systematic-tss) — MCP"`, `engineMode="mcp"`.
  Byte-identité prouvée sur `etf_eu` (payload identique au binaire, seuls engine/engineMode/generatedAt/tookMs diffèrent).
- `PORTFOLIO_TO_MODE` splice le backtest (`--to`=`statusSince`) à la courbe live.

## Dégradation gracieuse (MCP-only, plus de binaire)
1. **MCP** (SEUL moteur) — agent, Phase 5, AVANT `publish-daily-card.sh`.
2. **Staging committé** — lecture seule si le MCP est injoignable pour un mode ce run (warn loggé,
   jamais bloquant, jamais de données inventées ; sinon fallback pool JS dans gen-status-page).
`publish-daily-card.sh` Step 4d = garde de fraîcheur (`stagingStatus` par mode : warn si absent/stale) —
ne régénère plus rien (binaire supprimé). Skill `scanner-pipeline.md` §"dtx refresh — MCP SEUL MOTEUR".
Les tables de parité MCP↔binaire ci-dessous sont **historiques** (le binaire n'existe plus, la parité
n'est plus un critère de flip).

## ✅ Re-vérif 2026-07-08 (nuit) — DÉBLOQUÉE + OOM levé + us_highvol flippé
`DtxJobStatus(job_id)` est désormais **exposé** (poll pending→running→done, `result` isolé par job_id).
Re-vérif complète des 5 modes exécutée (cache serveur chaud → les 10 jobs decide/replay ont répondu inline).

- **GetHealth** identique avant/après : `{ok:true, binary_ok:true, data_dir_ok:true, config_count:13, cache_writable:true}` (toujours pas de champ RAM/version surfacé).
- **OOM LEVÉ (le point clé du fix RAM)** : `us_highvol` (2403 titres) ET `stockbox_nasdaq` (5189 titres) → **decide OK, plus aucun `signal:killed` ni status=error**. Confirmé.

### Table de parité FINALE (2026-07-08 nuit)
| Mode | DtxDecide (orders) | DtxReplay | OOM levé ? | Verdict |
|------|--------------------|-----------|-----------|---------|
| `us_highvol` | ✅ EXACT (BEAM 118 @ 38.87, stop 28.11) | ✅ forme identique (635 tr, DD 27.68, Sharpe 1.84 **égaux** ; equity +2.1% = dérive adj-close) | **✅ OUI** | **MCP canonique** (flippé `engineMode:mcp`) |
| `etf_eu` | ✅ EXACT (COFF/ECOF/ARKG 554/4317/4686) | ~ proche (equity −0.3%, 1102 vs 1104 tr ; DD 29.67 vs 26.55 = +3.1pp) | n/a | **MCP canonique** (déjà flippé ; staging committé conservé) |
| `etf_us` | ❌ 4/7 divergent (RBLY/HOOY/LITP/AETH remplacent LAYS/BIS/JETU/NVOX) | ❌ equity +4.4%, −114 tr, DD 18.09 vs 30.81 | n/a | **binaire** |
| `forex` | ❌ divergent (USDJPY/USDCAD vs GBPJPY/AUDUSD) | ❌ equity −2.9%, −1 tr, Sharpe 2.2 vs 2.4 | n/a | **binaire** |
| `stockbox_nasdaq` | ❌ 2 vs 8 orders (ALAB/MRVL seulement) | ❌ equity −38%, −58 tr, DD 24.67 vs 31.6 | **✅ OUI** | **binaire** |

**Modes MCP-canoniques : 2/5** (`us_highvol` + `etf_eu`). Les 3 autres restent binaire car leur **decide
diverge** (rotation pilotée par données : le cache serveur, plus frais que le bundle gelé, choisit d'autres
noms). Critère de flip appliqué : decide EXACT **et** forme du replay (tr/DD/Sharpe) identique modulo dérive
adj-close sur l'equity absolue. `us_highvol` le remplit (decide exact + 635 tr/DD 27.68/Sharpe 1.84 égaux) ;
les 3 autres non. Downstream régénéré (gen-status-page + gen-api, 109 endpoints), qa-check = **0 ❌** (45 checks, 39 ✅, 6 ⚠️ pré-existants). Aucun nouveau scan publié.

**Note dérive** : le replay MCP n'est PAS byte-déterministe vs le bundle gelé — même `etf_eu`/`forex`,
« identiques » le matin, dérivent le soir (le serveur re-fetch des adj-close plus frais). Le binaire reste la
référence gelée reproductible ; le MCP est canonique-par-conception mais sa courbe historique bouge un peu jour
à jour. Attendu, pas un bug.

## 🚧 Re-vérif 2026-07-08 (soir) — BLOQUÉE [RÉSOLU, voir bloc ci-dessus] : serveur passé en async, tool de poll NON exposé
Tentative de re-vérif après le « fix RAM » serveur. Résultat : **impossible de re-vérifier ou de flipper
quoi que ce soit**, parité **inchangée** (seul `etf_eu` reste MCP-canonique). **→ Débloqué la même nuit
quand `DtxJobStatus` a été exposé (voir bloc ✅ ci-dessus).**

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
