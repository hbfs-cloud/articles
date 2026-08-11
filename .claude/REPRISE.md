# REPRISE — session du 2026-08-11

> Lis ce fichier en premier dans une session neuve, puis supprime-le une fois les points traités.

## À VÉRIFIER EN PREMIER (deux risques concrets)

### 1. Le scanner du 11/08 n'a pas de ligne de registre
`scanner/20260811/` est **publié et en ligne**, mais son `--record` n'a jamais été passé.
Sans elle, `/desk` le croit non publié et **le republiera** — page en double, notification
en double. C'est le mode de panne que `/desk` identifie lui-même comme le plus probable :
pas le contournement, l'oubli.

```bash
bash tools/desk-run.sh --verify                      # doit sortir en 0
bash tools/desk-run.sh --record scanner --channels web,telegram   # si absent
```

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
3. **Écrire le producteur `insiders`** — `publication-gate.js` lui donne une cadence de 20 h
   mais aucun producteur n'existe. La donnée `insiders_7d` est déjà dans le socle, coût
   marginal quasi nul. Sinon supprimer la clé : une cadence qui pointe vers rien est un
   mensonge dans la config.
4. **`macro` et `squeeze` absents de `CADENCE_H`** — seul leur déclencheur événementiel les
   retient, pas de barrière anti-doublon.
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
