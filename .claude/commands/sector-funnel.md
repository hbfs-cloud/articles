# /sector-funnel — Analyse sectorielle en entonnoir, certifiée, 3 canaux

Exécute le skill **sector-funnel** : lis `.claude/skills/sector-funnel.md` et suis-le **EXACTEMENT**.

Secteur choisi **par les données** (force relative des 15 ETF sectoriels + catalyseur daté) →
entonnoir (observation → connu → thèse+falsification → **plan de trading** argumenté/concis/actionnable
→ invalidations) → panel **war room détail + QA senior + contrarian** (BLOCK = rien ne part) →
**3 livrables** : analyse complète FR (web), Telegram FR concis auto-suffisant, Substack EN concis
auto-suffisant (sans email).

**Exécuter** : `Workflow({ name: "sector-funnel", args: { refdate, date, sector?, avoid?, dryRun? } })`

## Avant de lancer (à la charge de l'agent)
1. `GetStatus` → vérifier fraîcheur et fixer `refdate` = `max_last_bar_date` (jamais deviné ; si lag > 1-2 séances → `RefreshBars` puis re-vérifier).
2. `date` = dossier `YYYYMMDD` du jour.
3. Lire les dernières entrées de `data/analyses.json` → remplir `avoid` avec les thèmes déjà couverts récemment (anti-doublon éditorial).
4. Après publication : `bash tools/desk-run.sh --record analyse --channels web,telegram,substack`.

## Arguments
``
- **vide** → choix data-driven du secteur, run complet + publication.
- **un secteur** (ex. `énergie`, `XLE`) → `args:{sector:"..."}` : impose le secteur, le reste inchangé.
- **`dry-run` / `ne poste pas`** → `args:{dryRun:true}` : 3 livrables produits sur disque, zéro publication.
- **`évite <thèmes>`** → `args:{avoid:"..."}`.

Garde-fous : zéro fabrication (chiffres = appels MCP de la session), gates scriptés en boucle,
BLOCK non levé = rien publié, `send_email=false` en dur (email = `--authorize-email` séparé),
token-diet (sonnet partout sauf writer/arbitre).
