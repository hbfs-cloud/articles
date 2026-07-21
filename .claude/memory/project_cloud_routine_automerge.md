---
name: project-cloud-routine-automerge
description: Les routines Claude cloud poussent leur run sur une branche claude/**, PAS sur main — auto-merge sur gate QA verte (.github/workflows/auto-merge-nightly.yml). MCP systematic présent dans le sandbox cloud headless. OAuth2 = zéro token en .env (tous MCPs OAuth2 depuis 2026-06-20).
metadata:
  type: project
---

# Routines Claude cloud : branche `claude/**`, auto-merge, OAuth2

## Boucle d'auto-publication (câblée)
La routine nocturne 23h n'est PAS le bot Discord local — c'est une **routine Claude cloud hébergée**
(`claude.ai/code/routines/trig_…`) qui tourne dans un **sandbox Anthropic**, clone le repo depuis le remote,
exécute le prompt, puis **pousse son run sur une branche `claude/<random>`** (auteur
`Claude <noreply@anthropic.com>`). Elle **n'ouvre PAS de PR** et **ne pousse PAS sur main**. GitHub Pages
servant depuis `main`, sans le workflow rien ne va live.

`.github/workflows/auto-merge-nightly.yml` : trigger `push` sur `claude/**` → gate
`node tools/qa-check.js --strict` (données scanner/dtx) + `qa-content.js --strict` (articles modifiés vs main)
→ si **0 ❌** : PR ouverte + `gh pr merge --merge --delete-branch` (trace + rollback via revert) → push main →
`deploy.yml` (Pages) + `qa-content.yml`. Si **rouge** : PR RETENUE, label `qa-failed` — jamais de publication
silencieuse d'un run cassé. **Parité CI sûre** : qa-check skip proprement le smoke puppeteer si absent
(→ ⚠️, jamais ❌) et AUCUN check ❌ ne dépend du MCP (var95/risk dégradent en ⚠️) → `--strict` en CI n'échoue
que sur un vrai ❌ data/structure. Tools = builtins node (pas de `npm ci`).

## MCP systematic prouvé présent dans le sandbox cloud
Run 2026-07-08 23:52 : les 5 modes scriptés ont été générés en `engineMode:mcp` (DtxReplay/DtxDecide via
`mcp__claude_ai_systematic__*`), pipeline complète (dtx→scanner→sweep→gen-api→gen-status-page, 139 fichiers)
→ la migration dtx MCP marche en prod cloud, pas seulement en local (cf [[dtx-architecture]]). `trade-chain.json`
resté append-only (aucune entrée scellée mutée). Le connector MCP est un niveau COMPTE claude.ai, pas dans le
repo. Prompt du trigger patché 2026-07-09 (étape 11 = chaîne dtx MCP ; étape 15 = publish robuste :
`git fetch origin main` + reconcile en gardant les fichiers générés → push main, repli branche si rejeté).

## ⚠️ À vérifier — les IDs de trigger DÉRIVENT (revalider contre les triggers live)
Le push sur `claude/**` déclenche-t-il bien Actions ? (garde anti-boucle GitHub si credential=GITHUB_TOKEN ;
le plus probable = credential App/user → ça déclenche. Fallback : `workflow_dispatch` ou merge manuel.)
Éditer via l'outil `RemoteTrigger` (`action:get|update|run`, API `/v1/code/triggers`).

Liste des routines (v2, ~11 actives sur Opus, 4 connecteurs MCP marketdata/notification/memory/simulator —
**les IDs ci-dessous drift, vérifier live avant usage**) :
- Monitoring (prompts courts, no file write) : Crash Detector (`trig_01D93bitp7HU3a26L4xC6ZD3`, 9/13/17/21h,
  >3% intraday drop→alerte urgente, dedup/jour), Market Pulse (`trig_01E6dZ7jq7g4Fiz9Dk25Rv8C`, indices+crypto+
  regime+portfolio), Weekend Pulse (`trig_01UJz9m6BQYZbWi4XzpZkuVF`), Rotation Detector (`trig_01UTXmc1Z8PHjp5SfNHJ65xR`).
- Articles (pipeline complète + git) : Daily Briefing (`trig_01JHPdHZcMzJUEmo8eg4sAA4`, 7h), Scanner Nocturne
  (`trig_016idAivWzRTwcoeGnUgJB2S`, 23h lun-ven, cron `0 21 * * 1-5`, env CCR `env_01L5GnZwWrCtx6V4ENARkqTg`),
  Nightly Refresh (`trig_01MJRrjQ4C3HPJXiucWXbC57`), Weekly Review (`trig_015zVDa29WvDuKGjtXbp21ft`),
  Rétrospective (`trig_015aaWxMDUj43skqRJBzMhUJ`), A+ Monitor (`trig_0145xrZhSgPLTQMzg4JkCd9i`).
- Infra : Watchdog (`trig_01PNBVTsubT5Ch6w21pxq6Aw`, 10h, checke les outputs routines via git log+memory →
  résumé rouge/vert vers alerts).
- Désactivés : Conductors AM/PM/WE (prompts ~2000 mots, crashaient avant d'atteindre send_message), Delta Pre-Open.

## Invariant OAuth2 (zéro token) — depuis 2026-06-20
Tous les MCPs sont enregistrés via OAuth2 dans Claude Code / claude.ai. **Ne JAMAIS ajouter de token en .env,
ne JAMAIS exporter MCP_GATEWAY_URL.** Les scripts sont lancés par l'agent qui a accès aux MCPs ; un script qui
a besoin de données MCP utilise les outils MCP déjà enregistrés (→ mode data-MCP = étape agent, cf
[[mcp-only-data-path]]). Élimine les incidents de stub silencieux quand une env var est oubliée.

Voir [[feedback-no-silent-skipping]], [[never-assume-safe-without-verification]].
