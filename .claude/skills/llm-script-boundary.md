---
name: llm-script-boundary
description: Frontière LLM/script. Doctrine transverse OBLIGATOIRE depuis le passage aux jetons MCP à TTL court. Définit ce qui doit être scripté (tout le déterministe) et le peu qui reste au modèle (jugement, rédaction, contradiction). Auto-load dès qu'on écrit ou refactore un skill, une commande ou un workflow.
user_invocable: false
---

# Frontière LLM / script — le modèle décide, il ne transporte pas

## Le changement qui rend ce document nécessaire

L'invariant historique du repo était :

> « Un subprocess `node` NE PEUT PAS appeler le MCP (OAuth2, ZÉRO token). »

Il imposait partout le même détour :

```
agent → salves MCP → JSON de staging → script --ingest
```

L'agent était **dans le chemin de données**. Chaque appel coûtait un aller-retour de
modèle, chaque valeur transitait par un contexte, et chaque recopie était une occasion
de se tromper — c'est exactement ainsi que sont nées les inversions de signe du weekly
du 10 août et la cotation de lundi étiquetée clôture de vendredi.

Avec un **jeton à TTL court délivré par le MCP**, l'invariant tombe. Le modèle obtient un
jeton en début de run, le passe par l'environnement, et sort du chemin de données.

```
agent → 1 jeton → script (N appels parallèles) → artefacts → agent (décide/rédige)
```

## La règle

**Le LLM ne fait QUE ce qui ne s'exprime pas comme une fonction déterministe.**

Si une étape produit toujours la même sortie pour la même entrée, elle appartient à un
script. Sans exception, quelle que soit sa simplicité apparente.

### Ce qui appartient au script — non négociable

| Étape | Pourquoi ce n'est pas au modèle |
|---|---|
| **Toute collecte MCP** | Transport pur. Zéro jugement. |
| **Arithmétique de gate** | R/R, ATR, extension, corrélation, tailles. Une soustraction ratée est un incident, pas une opinion. |
| **Filtrage par règle codifiée** | Résultats ±3 séances, dilution, capitalisation, secteur, doublons. |
| **Classement par score** | Le barème est écrit ; l'appliquer n'est pas un jugement. |
| **Manifeste de fraîcheur** | Sous-produit de la collecte (`tools/collect.js`), jamais rédigé à la main. |
| **Contrat de date** | `$refdate` propagé mécaniquement en `end_date` / `as_of` / `expected_data_date`. |
| **Assemblage, rendu, indexation, publication** | Déjà scripté, ne jamais le refaire en prose. |

### Ce qui reste au LLM — et rien d'autre

1. **Choisir entre candidats quasi équivalents**, avec la raison écrite. Le script réduit
   40 candidats à 12 conformes ; le modèle en garde 7 et dit pourquoi.
2. **Rédiger.** La voix éditoriale ne se script pas.
3. **Contredire.** Les gates adversariaux, la war room, la revue contrarian. C'est là que
   le modèle a le plus de valeur et c'est là qu'il faut dépenser le temps gagné ailleurs.
4. **Traiter l'inattendu.** Donnée absente, source qui se contredit, situation hors barème.
5. **Décider de publier ou non.**

## Comment on écrit un skill maintenant

```
Phase 0  preflight        script   (santé, anti-doublon, contrat de date)
Phase 1  collecte         script   tools/collect.js --plan plans/<skill>.json
Phase 2  filtres + calculs script   (gates déterministes, scoring, classement)
Phase 3  sélection        LLM      sur un vivier déjà conforme, avec justification
Phase 4  rédaction        LLM
Phase 5  gates            script   qa-content, check-ai-tells, check-freshness
Phase 6  revue adversariale LLM    senior-review / contrarian
Phase 7  publication      script
```

Quatre phases sur huit sont entièrement mécaniques. Deux sont du jugement, deux de
l'écriture et de la contestation. **Un skill dont la phase 1 ou 2 passe par le modèle est
un skill à refactorer.**

## Le manifeste de collecte

Un skill déclare son besoin dans `plans/<skill>.json` — il ne le décrit plus en prose dans
un prompt. Voir `plans/weekly.example.json`.

Trois bénéfices immédiats :

- **Le contrat de date devient structurel.** `$refdate` est substitué partout ; on ne peut
  plus « oublier » un `end_date` sur un appel.
- **Le manifeste de fraîcheur est mécanique.** Chaque appel portant un bloc `freshness`
  alimente `harness.json`. Une source collectée mais non déclarée devient impossible —
  c'était le défaut réel du weekly du 10 août.
- **La parallélisation est structurelle.** Une vague = un plafond de concurrence. La règle
  R2 de `perf-parallel-mcp` (« une salve = un message, N appels ») n'a plus besoin d'être
  rappelée au modèle : elle est dans le moteur.

## Les jetons réels — surfaces vérifiées le 2026-08-10

Deux outils, **un par serveur**, et les jetons **ne sont pas interchangeables** (le JWT
marketdata porte `aud=dailytickers-mcp`, celui de systematic `aud=dtx-mcp`). D'où
Les scripts lisent des jetons TTL par serveur, mais leur **valeur ne doit jamais apparaître dans une
commande, un log, le chat ou un fichier**. Utiliser l'environnement secret du runner, la saisie masquée
de `run-collect.sh`, ou `collect.js --token-bundle-stdin` pour un runner non interactif.

| | `GetReadOnlyToken(minutes)` | `DtxMintReadOnlyToken(ttl_minutes)` |
|---|---|---|
| Serveur | marketdata | systematic |
| TTL | 15 min par défaut, **max 60** | 15 min par défaut, **max 1440** |
| Surface | Outils autorises par le jeton et l'allowlist locale | Outils exposes par le jeton systematic courant et l'allowlist locale |

### Limites de capacité vérifiées à chaque run

Vérifié en appelant, pas déduit :

- **`RefreshBars`** est refuse au jeton marketdata read-only. **`DtxRefreshBars`** est expose seulement
  quand l'agent emet `DtxMintReadOnlyToken(scope="refresh")`; le scanner utilise ce scope minimal puis
  `dtx-refresh-if-stale.js`. Le token et sa valeur ne sont jamais affiches.
- **`DtxReplay` et `DtxDecide`** — la chaîne scanner les appelle dans sa vague systematic initiale:
  c'est aussi le test de capacité du jeton courant. Réponse non autorisée, outil absent ou contrat V2
  incomplet bloque le scanner avant staging; aucun fallback agent ni reconstitution n'est permis.
- **Toute écriture** — notification, substack, memory, brokers.

### Aucun jeton ne se renouvelle lui-même

`GetReadOnlyToken` n'est pas sur sa propre surface read-only — vérifié, il se refuse
lui-même. Un script qui voit son jeton expirer **ne peut pas en obtenir un autre** : il
échoue franchement et l'agent réémet. Conséquence pratique : un pipeline dont la collecte
dépasse 60 minutes doit être **découpé en segments**, avec un jeton par segment. Ne jamais
tenter de contourner — c'est une décision de sécurité du serveur, pas un obstacle.

## Sécurité du jeton

- Par **l'environnement uniquement** (`MCP_ACCESS_TOKEN`), jamais en argv — un argument est
  visible dans `ps`.
- Jamais écrit sur disque, jamais loggé, jamais commité. La règle « zéro token en .env »
  est **inchangée** : un jeton à TTL court n'est pas un secret persistant.
- Un jeton expirant dans moins de 30 secondes est refusé plutôt qu'utilisé : un run à
  moitié fait produit un staging partiel qu'on prendrait pour complet.
- `401/403` interrompt toute la salve. On redemande, on ne prolonge jamais.

## Dégradation

`tools/collect.js` sort en code 3 avec un message explicite si aucun jeton n'est
utilisable. **Le chemin historique agent → staging → `--ingest` reste valide** et les 14
scripts qui l'implémentent ne sont pas touchés. La migration se fait skill par skill,
jamais par un basculement global.

## Ce que ce refactor ne résout pas

Il rend les skills rapides et retire le modèle du transport. Il ne rend pas les gates plus
intelligents. Le temps gagné en phase 1 doit être **réinvesti en phase 6** — c'est le panel
adversarial qui a rattrapé la thèse fausse du 10 août, pas la vitesse de collecte.
