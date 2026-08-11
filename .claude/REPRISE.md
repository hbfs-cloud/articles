# REPRISE — session du 2026-08-11

> Lis ce fichier en premier dans une session neuve, puis supprime-le une fois les points traités.

## À VÉRIFIER EN PREMIER (deux risques concrets)

### 1. ✅ RÉSOLU — le scanner EST enregistré

Fausse alerte de ma part : le workflow avait bien passé le `--record` à 13h36.
`{"type":"scanner","channels":["web"]}` est dans `data/publication-ledger.ndjson`.

Nuance non corrigée volontairement : la ligne déclare `["web"]` alors que le Telegram du
scanner a bien été envoyé. Ajouter une seconde ligne ferait un doublon ; réécrire la ligne
violerait le caractère append-only du registre — mis en place précisément parce qu'un
read-modify-write perdait des écritures. Un canal sous-déclaré est une imprécision ; une
ligne réécrite est une brèche.

⚠️ `desk-run.sh` est un script BASH. `node tools/desk-run.sh` échoue sur une SyntaxError
trompeuse qui ressemble à un bug de l'outil.

**Seul écart restant, et il ne doit PAS être enregistré :** `daily/20260811/index.html`
existe sur disque mais n'a jamais été publié (dossier non suivi par git, aucun commit).
L'enregistrer masquerait un produit réellement dû. Le fichier est un artefact orphelin.

### 2. Aucun email ne doit être parti
Le workflow `desk-produire-20260811` (run `wf_24eac3d9-1dc`) tournait sans jeton
d'autorisation — c'est voulu. Vérifier qu'aucune ligne `email` n'a été écrite :

```bash
grep -c '"email"' data/publication-ledger.ndjson 2>/dev/null || echo 0
```


### 3. ✅ RÉSOLU — les trois Substack sont publiés (11/08 14:28 UTC)

| Produit | URL | Email |
|---|---|---|
| signals | /p/three-signals-into-tomorrows-cpi | **non** |
| aplus | /p/180-us-names-zero-a-setups-and-the | **non** |
| retro | /p/the-same-ten-trades-score-213r-or | **non** |

Publiés avec `send_email=false` : les pages existent et sont partageables, personne n'a été
réveillé. ⚠️ Les brouillons portaient `should_send_email: true` par défaut — c'est le
paramètre `send_email` de l'appel `publish` qui décide, et il a été posé à `false` sur les
trois.

⚠️ **`list_drafts` a menti** : il renvoyait une liste VIDE alors que les trois brouillons
existaient. Ne jamais conclure à l'absence d'un brouillon sur ce seul outil — vérifier avec
`update_draft(draft_id)`, qui répond correctement.

## ÉTAT DU WORKFLOW EN COURS

`desk-produire-20260811` — signals + retro + aplus, panel puis distribution web/Telegram.
Reprise si besoin :
```
Workflow({scriptPath: '~/.claude/projects/-Users-melouadi-code-articles/34ba4040-.../workflows/scripts/desk-produire-20260811-wf_24eac3d9-1dc.js',
          resumeFromRunId: 'wf_24eac3d9-1dc'})
```
⚠️ **La reprise rejoue depuis le cache si les prompts sont inchangés** — un run précédent a
rendu en 14 ms avec 0 jeton en rejouant un vieil échec. Pour forcer une exécution réelle,
MODIFIER le prompt de l'agent concerné dans le script (et n'y mettre aucun accent grave :
ça casse le gabarit de chaîne).

Artefacts écrits, non publiés au moment de la coupure :
- `daily/20260811/index.html` (54 Ko) — signaux du jour
- `scanner/20260612/retro/index.html` (32,5 Ko) — rétro, corrigée par le panel
- `analyses/aplus-20260811/index.html` (34 Ko) — **une seule valeur retenue : PEG**

Sur `aplus` : une seule valeur sur tout le marché est un RÉSULTAT, pas un échec. Les quatre
éliminatoires sont stricts et la consigne était de publier moins plutôt que de dégrader la
grille. Ne pas « compléter » la cohorte.

## DÉCISIONS PRISES AUJOURD'HUI, À NE PAS REVISITER

- **Le panel adversarial est non négociable** avant publication (mémoire :
  `project_panel_non_negociable`). La cible des 5 min porte sur la collecte et la
  publication scriptées, pas sur le pipeline complet. ~30 min pour un `/scanner` complet
  est accepté. Ne jamais proposer de le retirer pour tenir un chrono.
- **Plancher R/R laissé à 0,7** (contrat versionné). 1,3 avait été demandé puis abandonné :
  le plafond arithmétique du système est 1,33 (stop ≥ 1,5×ATR, cible ≤ 2,0×ATR), et à 1,3
  zéro ligne survit sur 60. Les 10 lignes publiées le 11/08 vont de 0,81 à 0,98.
- **`overview` est hors du chemin critique** (`freshness.required=false`). Mesuré 63 s,
  puis 298 s, puis deux dépassements de délai serveur. C'est du contexte, il n'alimente
  aucune sélection. Ne pas le repasser en requis, ne pas retenter un force-refresh dessus.

## CE QUI A ÉTÉ CONSTRUIT (tout est poussé)

| Outil | Rôle |
|---|---|
| `tools/lib/mcp-client.js` | transport MCP partagé, jetons PAR SERVEUR |
| `tools/collect.js` | collecte déclarative, vagues parallèles, `$refdate`, `--var`, cache par appel, vagues détachées |
| `tools/run-collect.sh` | enveloppe : jeton + collecte + gate de fraîcheur |
| `tools/extract-universe.js` | charnière entre deux vagues |
| `tools/scan-parallel.sh` | 3 chaînes parallèles |
| `tools/downstream-split.sh` | CALCUL (parallélisable) / DIFFUSION (après panel) + verrou |
| `tools/dtx-replay-cache.js` | ne rejoue un backtest que si >7j, config changée, ou `--force` |
| `tools/panel-size.js` | dimensionne le panel sur la couverture des gates |
| `tools/publication-gate.js` | cadence + quota 1 email/24 h tous types |
| `tools/desk-plan.js` / `desk-run.sh` / `desk-verify.js` | l'orchestrateur `/desk` |
| `plans/*.json` | 12 plans de collecte déclaratifs |

Gains mesurés : cours du sweep >10 min → 6 s · sweep complet 6 min 47 → `--quick` 1 min 27
(14/14 blocs `frozen_*` identiques) · backtests dtx 393 s → ~50 s · vague gouvernante du
vivier 104 s → 7,5 s · collecte `/desk` complète en 52 s.

## CHANTIERS OUVERTS, PAR PRIORITÉ

1. **Câbler `downstream-split.sh` dans le workflow scanner** — le gain (8-12 min) n'est pas
   encore matérialisé, le workflow actuel appelle encore l'ancien downstream séquentiel.
2. **Tester le verrou de `downstream-split.sh`** — `timeout` n'existe pas sur macOS, le test
   n'a pas pu tourner. Utiliser `gtimeout` ou une boucle en arrière-plan.
3. ✅ **RÉSOLU (11/08) — pas de producteur `insiders`, la clé est SUPPRIMÉE.** Décision
   prise après avoir mesuré `GetInsiderActivity` au lieu de la supposer : 0 à 2 noms par
   séance (1 le 10/08, 2 à 12h37, 0 à 15h25), 100 symboles couverts sur 944 — l'outil
   qualifie lui-même un résultat vide de « coverage statement » —, **zéro achat** sur
   toutes les observations, et un agrégat qui étiquette « net_selling −158 M$ » une
   levée-revente d'options le jour même (CVX/Hess, 03/08). Le signal qui vaut quelque
   chose, le cluster-buy code P, a déjà son producteur : `tools/filings-scanner.js`
   (stratégie InsiderCluster → `filings_pool`). Ne pas remettre la clé, ne pas ajouter de
   bloc « initiés » au daily. Détail : `.claude/memory/project_pas_de_produit_insiders.md`.
   Au passage, le contrôle en dur de `desk-plan.js` est devenu générique : il interroge
   `publication-gate.js --cadences --json` et signale TOUTE cadence orpheline.
4. ✅ **RÉSOLU (11/08) — `macro: 36` et `squeeze: 168` ajoutés à `CADENCE_H`.** Les deux
   valeurs sont calées sur l'espacement MESURÉ de leur déclencheur, pas choisies au doigt
   mouillé. `macro` : calendrier réel 13/02/2026 → 05/02/2027 (219 événements, 44 tier 1 sur
   42 jours), écarts min 1 j / médiane 5 j — 36 h coupe les 5 paires à 1 j (FOMC→PCE,
   FOMC→CPI : une seule fenêtre de positionnement) et laisse passer les 48 h ; 48 h donnerait
   le même résultat à heure fixe mais perd 2 notes dès que le run dérive de 23h30 à 21h00,
   72 h avale 4 NFP. `squeeze` : 24 fenêtres FINRA en 2026, 119 jours déclencheurs, jusqu'à
   7 publications d'affilée du même jeu — 168 h rend exactement 1 publication par fenêtre,
   et reste sous les 216 h qui bloqueraient la publication FINRA suivante. Détail :
   `.claude/memory/project_cadences_macro_squeeze.md`.
5. **Compléter `plans/scanner-dtx.json`** — il ne demande des backtests que pour 4
   portefeuilles sur 6. `hvep` et `stockbox_pit` ont vu leur ingestion sautée (correctement,
   le garde-fou a joué) et ont dû être collectés à la main.
6. **Le Substack du scanner n'a jamais été fait.**

## PIÈGES RENCONTRÉS AUJOURD'HUI — ne pas les refaire

- **Appariement MCP fail-closed.** `QueryData` renvoie `symbols` = la liste DEMANDÉE mais
  `data` = seulement les séries TROUVÉES. Apparier par index attribuait les prix de SPY à
  MSFT — corruption silencieuse. Un lot dont les longueurs diffèrent est JETÉ entier.
- **La DSL n'accepte pas `$2B`.** `CLAUDE.md` le prescrivait comme filtre obligatoire ; le
  moteur renvoie `unknown name $2B` et le job échoue à la COMPILATION, rendant un vivier
  **vide** (pas dégradé). Corrigé en littéraux numériques.
- **`/desk` et `/scanner` écrivent les MÊMES fichiers** (`data/`, `scanner/status/`,
  `portfolio/v1/`). Deux `gen-status-page` simultanés corrompent sans lever d'erreur. Le
  verrou existe désormais dans `downstream-split.sh` — ne pas les lancer en parallèle sans lui.
- **Les jetons expirent en 60 min** et ne se renouvellent pas seuls. Un run qui attend
  beaucoup les voit périmer ; réémettre entre les phases.
- **Ne pas coller un jeton en clair** dans une commande : écrire `/tmp/scan-env.sh` une fois
  (chmod 600) puis `source`. Un hook pre-commit refuse tout JWT commité.
