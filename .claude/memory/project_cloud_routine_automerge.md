---
name: project-cloud-routine-automerge
description: Les routines Claude cloud (claude.ai/code/routines) poussent leur run sur une branche claude/**, PAS sur main ni via PR — auto-merge câblé via .github/workflows/auto-merge-nightly.yml (gate QA verte)
metadata:
  type: project
---

# Routines Claude cloud : branche `claude/**`, pas main — boucle d'auto-publication

**Découvert 2026-07-09.** La routine nocturne 23h n'est PAS le bot Discord local (`claude -p` /
LaunchAgent) comme longtemps supposé — c'est une **routine Claude cloud hébergée**
(`claude.ai/code/routines/trig_…`), qui tourne dans un **sandbox Anthropic**, clone le repo depuis le
remote git, exécute le prompt, puis **pousse son run sur une branche `claude/<random>`** (ex:
`claude/busy-darwin-f6efok`), auteur `Claude <noreply@anthropic.com>`. Elle **n'ouvre pas de PR** et
**ne pousse pas sur main**. GitHub Pages servant depuis `main`, sans intervention **rien ne va live**.

## Deux faits prouvés (run 2026-07-08 23:52 Paris → scan 20260709)
1. **Le connector MCP `mcp__claude_ai_systematic__*` EST présent dans le sandbox cloud** : les 5 modes
   scriptés ont été générés en `engineMode:mcp` (DtxReplay/DtxDecide via le MCP), pipeline complète
   (dtx → scanner → sweep → gen-api → gen-status-page, 139 fichiers). La migration dtx MCP marche donc
   en prod cloud, pas seulement en local. (L'ancien argument keychain/même-$HOME ne valait que pour le
   LaunchAgent local ; il ne transfère pas au sandbox cloud — mais empiriquement le connector est là.)
2. **`trade-chain.json` est resté append-only** (seule ligne modifiée = `"etf_eu": []` → peuplé), aucune
   entrée scellée mutée. Le marqueur `data/dtx/_staging-completeness.json` est **gitignored** (écrit sur
   disque + lu par qa-check dans le même run) → normal qu'il soit absent des commits.

## Boucle d'auto-publication (câblée)
`.github/workflows/auto-merge-nightly.yml` : trigger `push` sur `claude/**` → gate
`node tools/qa-check.js --strict` (données scanner/dtx) + `qa-content.js --strict` (articles modifiés
vs main) → si **0 ❌** : PR ouverte + `gh pr merge --merge --delete-branch` (trace + rollback via
revert) → push main → `deploy.yml` (Pages) + `qa-content.yml`. Si **rouge** : PR RETENUE, label
`qa-failed`, run rouge — jamais de publication silencieuse d'un run cassé.

**Parité CI sûre** : qa-check skip proprement le smoke puppeteer si absent (→ ⚠️, jamais ❌) et AUCUN
check ❌ ne dépend du MCP (var95/risk dégradent en ⚠️). Donc `--strict` en CI n'échoue que sur un vrai
❌ data/structure. Les tools sont en builtins node (pas de `npm ci` requis, cf `qa-content.yml`).

## ⚠️ À vérifier au prochain run nocturne (non encore prouvé)
Est-ce que le push de la routine sur `claude/**` **déclenche** bien le workflow Actions ? Si la routine
pousse avec un credential traité comme le `GITHUB_TOKEN` d'Actions, les workflows ne se re-déclenchent
pas (garde anti-boucle GitHub). Le plus probable = credential App/user → ça déclenche. Fallback si non :
`workflow_dispatch` ou merge manuel. Confirmer en regardant l'onglet Actions après le run 23h.

Voir [[reference-dtx-mcp]], [[feedback-no-silent-skipping]], [[never-assume-safe-without-verification]].
