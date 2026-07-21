---
name: perf-parallel-mcp
description: Doctrine de performance transverse pour TOUS les skills/commands qui appellent le MCP. Isoler les appels MCP en salves parallèles, batcher QueryData multi-symboles, scripter l'assemblage en node, backgrounder le pipeline. Auto-load quand un skill fait du fetch MCP en volume (scanner, signals, swing, squeeze, earnings, rotation, macro, fortress, daily, weekly, analyses). Le vrai goulot n'est jamais le calcul — c'est le round-trip MCP joué en série.
user_invocable: false
---

# ⚡ Doctrine perf — MCP en salves parallèles (transverse, OBLIGATOIRE)

**Le goulot d'un skill MCP n'est pas le CPU, c'est le round-trip joué EN SÉRIE.** Un skill qui tire 40
appels MCP l'un après l'autre à 3-8 s pièce = 3-5 min de temps mort pur. Les mêmes 40 appels en 3-4
salves parallèles = ~30-60 s. Aucune feature n'est retirée : on ne réduit PAS le nombre d'appels métier
(no-skip), on écrase le **temps mural**.

Appliquer ces 6 règles à toute phase MCP d'un skill. Elles sont cumulatives.

## R1 — Isoler le MCP (phase dédiée, pas d'entrelacement)
Rassembler TOUS les appels MCP d'une étape en amont, AVANT tout travail node/édito. Un skill se lit :
**(a) preflight → (b) 1-N salves MCP parallèles → (c) assemblage node/décision (zéro MCP) → (d) sortie.**
Ne jamais alterner « un fetch, un calcul, un fetch » : ça re-sérialise tout.

## R2 — Une salve = UN message, N tool_use en parallèle
Le levier #1. Tous les appels **indépendants** partent dans le MÊME message assistant (plusieurs blocs
tool_use) → ils s'exécutent concurremment. Ne JAMAIS émettre un seul appel puis attendre puis le suivant
quand ils ne dépendent pas l'un de l'autre.
- **Vague 1** (aucune dépendance) : tous les `RunScreener`/`RunAutoScreener`, `GetMarketContext`
  (overview+regime), `GetEarningsCalendarFiltered`, `economic_events`, `GetStatus` — en UNE salve.
- **Vague 2** (dépend des candidats de V1) : toutes les barres + enrichissements — en UNE salve.
- **Vague 3** (validation) : `sec_filings/flags/insider/dark_pool/unusual_options` par candidat — UNE salve.
Entre deux vagues il y a une barrière (V2 a besoin des tickers de V1) ; DANS une vague, tout est parallèle.

## R3 — Batcher QueryData multi-symboles
`QueryData(types="bars_daily", symbols="A,B,C,…")` accepte un CSV. Grouper ~10-20 symboles par appel au
lieu d'un appel par ticker. **Dédupliquer cross-usage** : un symbole demandé par 3 scanners = **un seul
fetch**, fan-out ensuite. Idem `quote`/`technicals` (multi-symbols) et les types batchables.

## R4 — Preflight UNE fois, async en parallèle
`GetStatus`/`GetHealth` : un seul preflight en tête (MCP HARD STOP si down/stale >48h — jamais fabriquer).
Pour les jobs async (`force_async:true`, `DtxReplay/DtxDecide`, gros screeners) : **lancer TOUS les jobs
d'abord** (récupérer les `job_id`), PUIS poller `Jobs`/`DtxJobStatus` — ne jamais lancer-poller-lancer en
série. Le cache serveur est chaud : beaucoup répondent quasi-inline, mais toujours passer par le poll.

## R5 — Scripter l'assemblage en node (le MCP ne sort que du brut)
Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token) — invariant. Donc : l'agent tire le
MCP et **déverse la réponse brute** dans un fichier (`/tmp/mcp-raw/<clé>.json`), puis un **script node**
fait tout le reste (parse, calcul, dérivation staging, merge). Contrat **POSITIONNEL** obligatoire (repris
de `price-cache-ingest.js --stage`) : `{symbols:[…ordre exact de l'appel…], result:<brut>}` et
l'assembleur exige `data.length === symbols.length`, **refuse de deviner** un mapping. L'agent ne fait pas
d'arithmétique de staging à la main quand un script peut la faire — c'est plus rapide, déterministe,
testable A/B.

## R6 — Backgrounder le pipeline node long
Ce qui ne bloque pas la décision agent tourne en tâche de fond (`run_in_background`) : sweep (~5 min),
gen-status-page, gen-api, media. Le budget « temps ressenti » du skill = **phase MCP seule**. Surveiller la
fin via un monitor (fraîcheur staging, QA), ne pas rester bloqué dessus.

## Invariants NON négociables (la perf ne les assouplit JAMAIS)
- **MCP HARD STOP** : bloqué/stale/incohérent → STOP, alerter, ne rien fabriquer. La parallélisation ne
  masque pas un preflight KO — elle vient APRÈS le preflight.
- **Fail-closed** : réponse brute manquante/`mcp_ok:false`/couverture insuffisante → staging NON écrit
  (skip non-bloquant en aval), **jamais inventé**.
- **No-skip** : mêmes étapes/gates qu'avant. On change la FORME d'exécution (parallèle + node), pas le fond.
- **Zéro hallucination** : chaque chiffre tracé à un appel MCP réel de la session.

## Gabarit d'application dans un skill
Ajouter en tête de la phase de collecte du skill un bloc court :
```
## ⚡ Exécution (voir perf-parallel-mcp)
Preflight GetStatus (1×). Puis SALVE 1 (un seul message, appels //) : <liste des screeners/context>.
SALVE 2 (barres, //, multi-symboles dédupés) : <QueryData bars_daily lots>. SALVE 3 (validation //) :
<flags/filings/…>. Assemblage : <script node>. Pipeline long : background. Fail-closed + HARD STOP conservés.
```
Nommer les salves CONCRÈTES du skill (pas juste « paralléliser ») — c'est ce qui fait que l'agent le fait.
