# REPRISE — état au 2026-08-11 fin de journée

> Lis ce fichier en premier dans une session neuve. Ce qui est soldé a été RETIRÉ : ce qui
> reste écrit ci-dessous est ce qui reste à faire ou à ne pas refaire.

## SOLDÉ AUJOURD'HUI — ne pas rouvrir

- **Aucun email n'est parti.** Vérifié en fin de session : `grep -c '"email"'
  data/publication-ledger.ndjson` → **0**. Les quatre Substack du jour sont publiés
  `send_email=false` : pages partageables, personne réveillé.
- **Les quatre Substack sont publiés**, section Boards (417757) :

  | Produit | URL | Email |
  |---|---|---|
  | signals | /p/three-signals-into-tomorrows-cpi | non |
  | aplus | /p/180-us-names-zero-a-setups-and-the | non |
  | retro | /p/the-same-ten-trades-score-213r-or | non |
  | **scanner** | **/p/ten-names-into-the-cpi-print** | **non** |

- **Le daily 20260811 n'est plus orphelin** : commité (`00f552578`) et au registre. La
  consigne « ne pas l'enregistrer » de la version précédente de ce fichier est PÉRIMÉE.
- **Cadences `insiders` / `macro` / `squeeze`** : clé `insiders` supprimée (aucun producteur,
  le cluster-buy a déjà le sien dans `filings-scanner.js`), `macro: 36` et `squeeze: 168`
  calées sur l'espacement mesuré. Détail : `.claude/memory/project_pas_de_produit_insiders.md`
  et `project_cadences_macro_squeeze.md`.
- **`earnings` et `macro` pouvaient ne JAMAIS être dus** — deux produits morts que personne ne
  voyait parce que le motif affiché était plausible. `earnings` lisait `market_cap` quand le
  socle écrit `market_cap_b` (en MILLIARDS) : densité éternellement nulle, motif « densité
  insuffisante » alors que 11 des 13 publications franchissaient le seuil. `macro` ne savait
  pas lire la forme `{results:[{data:["csv…"]}]}` de QueryData : « aucun événement de tier 1 »
  avec le CPI écrit en toutes lettres dans le fichier qu'il venait de lire. Les deux sont
  corrigés ET gardés par un **détecteur de dérive de schéma** (`requireFields` dans
  desk-plan) : un filtre qui rejette 100 % d'une entrée non vide parce que le champ qu'il lit
  n'existe sur aucun élément remonte désormais en `config_gaps`.
- **L'anti-doublon événementiel ne passe plus par l'horloge.** `--trigger <id>` sur le gate :
  quand l'appelant fournit l'identité de l'événement, elle REMPLACE la cadence. C'est ce qui
  rend possible la note du lendemain de FOMC quand PCE tombe à J+1 — 36 h l'auraient tuée.
  Vérifié en bac à sable : même déclencheur à −24 h ⇒ refus ; déclencheur suivant à −24 h ⇒
  accord ; sans déclencheur à −24 h ⇒ refus par cadence.

## CHANTIERS OUVERTS, PAR PRIORITÉ

1. **Câbler `downstream-split.sh` dans le workflow scanner** — le gain (8-12 min) n'est
   toujours pas matérialisé, le workflow appelle encore l'ancien downstream séquentiel.
2. **Tester le verrou de `downstream-split.sh`** — `timeout` n'existe pas sur macOS, le test
   n'a jamais tourné. Utiliser `gtimeout` ou une boucle en arrière-plan. Les variables
   `DOWNSTREAM_LOCK_MAX_TRIES` / `DOWNSTREAM_LOCK_POLL_S` existent précisément pour rendre ce
   test exécutable en secondes.
3. **`plans/squeeze.json` exige `$symbols` et aucune charnière ne le produit.** `desk-plan`
   sort le produit avec un `blocker` explicite, donc rien ne casse en silence — mais le
   produit reste inlançable. Il lui faut son équivalent d'`extract-universe.js`.
4. **Idem pour la rétro** : `tools/extract-retro-symbols.js` existe maintenant sur disque mais
   n'est pas suivi par git. Le vérifier, le tester, le commiter — ou le supprimer.

## PIÈGES — ne pas les refaire

- **Plusieurs sessions Claude travaillent sur ce dépôt en même temps.** Le 11/08, une session
  sœur a commité et poussé `b440490f7` pendant qu'une autre lisait les mêmes fichiers : `git
  status` est passé de « modifié » à « propre » entre deux commandes, et `git diff` a rendu du
  vide sans erreur. **Toujours `git pull --rebase` avant de commiter**, et ne jamais conclure
  d'un `git diff` vide que le travail a disparu — relire `git log` d'abord.
- **Un NUL littéral dans une source JS la rend binaire pour git.** `desk-plan.js` utilisait
  `` `${type}\x00${trigger}` `` comme clé de cache : valeur juste, octet fatal. Plus de diff,
  plus de merge, plus de relecture possible. Écrire la séquence d'échappement `\u0000`,
  jamais l'octet lui-même. Le piège se retend tout seul : la première rédaction de cette
  phrase-ci contenait un vrai NUL, et rendait ce fichier binaire à son tour.
- **Une étape rendue manuelle sans garde est une étape qui saute.** La coupure CALCUL/DIFFUSION
  avait fait disparaître l'ingestion `refresh-risk-metrics` : `gen-status-page` republiait la
  VaR de la veille sans le dire. `compute` la relance ET **échoue** si
  `data/risk-snapshots.json` dépasse 12 h (`RISK_MAX_AGE_H` pour un rejeu délibéré).
- **Ne jamais deviner un chemin de staging.** `downstream-split` préférait `_dtx11`, un dossier
  daté en dur que la collecte ne rafraîchit jamais, au `_dtx` que `scan-parallel.sh` écrit.
  C'est `$DIR/_dtx`, surchargeable par `DTX_STAGING_DIR`, jamais deviné.
- **`list_drafts` (Substack) MENT** — liste vide alors que les brouillons existent. Vérifier
  avec `update_draft(draft_id)`, qui répond juste. Les brouillons portent
  `should_send_email: true` par défaut : c'est le paramètre `send_email` de l'appel `publish`
  qui décide, et lui seul.
- **`desk-run.sh` est un script BASH.** `node tools/desk-run.sh` échoue sur une SyntaxError
  trompeuse qui ressemble à un bug de l'outil.
- **Appariement MCP fail-closed.** `QueryData` renvoie `symbols` = la liste DEMANDÉE mais
  `data` = seulement les séries TROUVÉES. Apparier par index attribuait les prix de SPY à
  MSFT. Un lot dont les longueurs diffèrent est JETÉ entier.
- **La DSL n'accepte pas `$2B`.** Le moteur renvoie `unknown name $2B` et le job échoue à la
  COMPILATION, rendant un vivier **vide** (pas dégradé). Littéraux numériques : `2e9`.
- **`/desk` et `/scanner` écrivent les MÊMES fichiers.** Deux `gen-status-page` simultanés
  corrompent sans lever d'erreur. Le verrou de `downstream-split.sh` est obligatoire.
- **Les jetons expirent en 60 min** et ne se renouvellent pas seuls. Réémettre entre les phases.
  Ne jamais coller un jeton en clair dans une commande : `/tmp/scan-env.sh` (chmod 600) puis
  `source`. Un hook pre-commit refuse tout JWT commité.

## DÉCISIONS À NE PAS REVISITER

- **Le panel adversarial est non négociable** avant publication (mémoire :
  `project_panel_non_negociable`). La cible des 5 min porte sur la collecte et la publication
  scriptées, pas sur le pipeline complet. ~30 min pour un `/scanner` complet est accepté.
- **Plancher R/R laissé à 0,7** (contrat versionné). Le plafond arithmétique du système est
  1,33 (stop ≥ 1,5×ATR, cible ≤ 2,0×ATR) ; à 1,3 zéro ligne survit sur 60. Les 10 lignes du
  11/08 vont de 0,81 à 0,98.
- **`overview` est hors du chemin critique** (`freshness.required=false`). Mesuré 63 s, puis
  298 s, puis deux dépassements de délai serveur. C'est du contexte, il n'alimente aucune
  sélection. Ne pas le repasser en requis.
- **`aplus` du 11/08 : une seule valeur retenue (PEG) est un RÉSULTAT, pas un échec.** Les
  quatre éliminatoires sont stricts. Ne pas « compléter » la cohorte.

## POINT DE VIGILANCE OUVERT — cadence du scanner

Le scanner porte une cadence de 12 h, calée sur un rythme soir-à-soir (24 h d'écart, large
marge). Le 11/08 il a été publié à 13h36 UTC, et la ligne `substack` enregistrée à 16h36 a
déplacé l'horloge d'autant : **la prochaine publication `scanner` sans déclencheur n'est
autorisée qu'à partir de 04h37 le 12/08**. Le scan du soir du 11/08 était de toute façon
bloqué par la ligne de 13h36 — l'enregistrement du canal n'a rien aggravé ce soir-là. Mais si
un scanner doit sortir dans une fenêtre bloquée, la bonne réponse n'est PAS de baisser la
cadence : c'est de passer un `--trigger scanner:<AAAAMMJJ>` comme le fait déjà `macro`, pour
que l'anti-doublon porte sur la séance visée et non sur l'horloge. `evalScanner` ne le fait
pas encore.
