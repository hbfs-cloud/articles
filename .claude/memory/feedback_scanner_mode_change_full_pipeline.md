---
name: scanner-mode-change-full-pipeline
description: "Changer l'ensemble des modes scanner = tracer TOUT le pipeline + vérifier le dashboard RENDU (pas juste le boot-smoke) — ne pas se faire rappeler les checks"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 326b0558-edd5-46c0-971d-9389f3e9b3a0
---

Quand on change l'**ensemble des modes** du scanner (ajout/retrait/renommage, ex. cut-over dtx v15), ce n'est JAMAIS suffisant de régénérer le site : il faut tracer et mettre à jour **tout le pipeline**, de sa propre initiative — l'utilisateur ne doit pas avoir à rappeler ces checks.

**Why:** au cut-over dtx-v15 (6 stratégies), j'ai régénéré `scanner/status` + `portfolio/v1` mais laissé le reste pointer sur les anciens modes → (1) `/scanner` aurait rafraîchi les mauvais modes, (2) le dashboard live était **cassé** (grille vide) et (3) l'entrée vers scanner/status avait disparu de la landing. Deux rappels utilisateur pour le voir.

**How to apply — checklist quand le SET de modes change :**
1. `data/modes-config.json` (statuts live/stopped).
2. `tools/gen-status-page.js` : `DTX_STAGING_MAP` **ET** les défauts CLIENT hardcodés — `var activeMode='…'` et `var DEFAULT_FAVS=[…]` (les rendre dynamiques via `Object.keys(modes)`, sinon la page s'ouvre sur un mode supprimé → grille vide côté navigateur). Idem `LLM_MODES`, `DEFAULT_FAVS` ligne ~2650.
3. `tools/dtx-scan.js` : `PORTFOLIO_TO_MODE` / `SCRIPTED_MODES` ; multi-sleeve books → `extractReplayMetrics` doit lire le bloc `combined`, pas `results[0]`.
4. `tools/dtx-mcp-ingest.js` : ne doit PAS exiger de yaml local (le MCP fait foi) — `--currency`/`--name`.
5. `config/dtx/_sanity-baselines.json` + purge des yamls legacy locaux.
6. Skill `.claude/skills/scanner-pipeline.md` (la liste des modes que l'agent suit).
7. `index.html` landing : la carte "⚡ Scanner Live" (→ /scanner/status/) doit rester visible (sous-filtre défaut = "scan" la masquait).

**⚠️ Vérif RENDU, pas juste boot.** Le smoke puppeteer de `gen-status-page` ne détecte que les erreurs JS au boot — il ne voit PAS "s'ouvre sur un mode supprimé → grille vide". Après régénération d'une page **client-rendered**, vérifier que le dashboard **affiche** bien les modes attendus (`grep activeMode/DEFAULT_FAVS` dans le HTML généré ; idéalement charger la page servie). WebFetch lit le HTML statique (tous les modes sont dans le DOM même si masqués) → ne pas s'y fier pour juger le rendu navigateur. Voir [[dtx-architecture]].
