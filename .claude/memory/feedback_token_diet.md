---
name: token-diet
description: Règles de sobriété tokens (2026-08-14) — workflows en tiering de modèles, panels scriptés d'abord, payloads MCP en fichiers, 1 session = 1 produit
type: feedback
---

# Token diet — règles opérationnelles (feedback user 2026-08-14)

**Constat chiffré (journée 13-14/08)** : ~3,5M tokens de subagents en 24h. Causes : workflows
tout-opus/high, panels qui refont des vérifs scriptées, payloads QueryData inline (15k chars pour
8 quotes), méga-session unique compactée en boucle.

**Why** : le user paie chaque token ; 60-70% de la dépense était évitable sans perte de qualité.

**How to apply** :
1. **Workflows — tiering de modèles OBLIGATOIRE** : `sonnet`+`effort:high` par défaut ;
   `opus` UNIQUEMENT pour writer/arbiter (jugement + rédaction) ; extraction/validation
   mécanique = `sonnet`+`effort:medium` voire `haiku`. Ne JAMAIS mettre opus sur un stage
   qui parse/valide/greppe.
2. **Panels — script d'abord, agent ensuite** : ne JAMAIS spawner un relecteur pour une
   vérification qu'un script couvre (R/R math, gates niveaux = `validate-scan.js` ; tics IA =
   `check-ai-tells.js` ; structure = `qa-content.js`). Panel de routine = 2 lenses de JUGEMENT
   max (data-accuracy vs source JSON + éditorial). Les 5-7 lenses = réservé aux grosses
   premières publications.
3. **Payloads MCP — fichiers, pas inline** : >2 symboles×types → collecte scriptée
   (`run-collect.sh`/`collect.js` → fichiers + parse node) au lieu d'appels MCP directs dont
   le JSON revient dans le contexte. Toujours `limit`, `types` minimaux, batcher. Les
   tool-results >20k chars débordent déjà en fichiers : les parser en node, jamais re-fetch.
4. **Prompts d'agents workflow** : passer les DONNÉES en JSON compact dans le prompt (déjà fait)
   mais ne PAS demander de relire CLAUDE.md/EDITORIAL_STYLE entiers quand 5 lignes de règles
   suffisent — copier les règles utiles dans le prompt.
5. **1 session = 1 produit** : ne pas enchaîner scanner+desk+substack+squeeze+aplus+earnings dans
   une seule méga-session (compactions répétées = tout le contexte re-payé). Sessions courtes.
6. **Séquencer les workflows lourds** (pas 3 en parallèle) — protège aussi le connector.
7. **Chantier à valider avec le user** : dégraisser `commands/scanner.md` (36k chars ≈ 9k tokens
   par invocation) et `skills/scanner-pipeline.md` (77k chars ≈ 19k) — forte duplication entre
   les deux ; viser commande = orchestration courte, skill = référence.
