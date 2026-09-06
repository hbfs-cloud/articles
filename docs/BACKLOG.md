# Backlog — état au 2026-09-06

Ce fichier remplace les listes de tâches éparpillées dans les messages. Une ligne = un travail
identifié, avec sa raison et son critère de fin. Pas de « améliorer X » sans dire à quoi on saura
que c'est fait.

---

## 1. Bloquants — le scanner ne publie pas tant qu'ils tiennent

### 1.1 Vérifier que `regime_authority` ramène bien le bloc régime
`plans/scanner-wave1.json` collecte désormais `GetMarketContext(facets=overview, as_of=$refdate)`
en appel **requis**, parce que `overview.regime` porte l'autorité du régime publié depuis le
2026-09-06. L'ancien appel détaché rendait 181 octets vides, et `regime-reconcile` retombait
silencieusement sur `facets=regime` — moteur d'échelle **inverse** — ce qui aurait publié
**100/100 au lieu de 77,2**.
**Fini quand** : un run de vague 1 produit `_data/regime_authority.json` contenant un
`regime_score` ≤ 1, et `node tools/regime-reconcile.js --dir scanner/<date>` affiche
`autorité marketdata (overview.regime)` avec un score proche de 77.

### 1.2 Récupérer 4 `draft_id` Substack perdus
Semaines 2 à 5 du programme `retail-systematic-desk` — publications des 11, 18, 25 septembre et
2 octobre 2026, donc **les plus proches**. Incident documenté `SUBSTACK-RATE-429-001` : les
programmations ont été vérifiées mais les identifiants ont disparu du résultat local quand un lot
ultérieur a renvoyé 429. `list_drafts` ne remonte pas les brouillons programmés.
**Fini quand** : les 4 identifiants figurent dans `remote-receipts.json` et leurs corps révisés
sont écrits via `update_draft`.

### 1.3 Trancher la publication du scan du 8 septembre
La collecte est certifiée sur la clôture du 4 septembre. Un événement géopolitique majeur —
« U.S., Iran Exchange Attacks », 5 septembre 18:22Z — lui est **postérieur**. Publier des niveaux
calculés sur un monde d'avant sans le mentionner reproduirait exactement le « monde d'hier » que
le contrat de date existe pour empêcher.
**Fini quand** : décision prise — publier avec mention explicite de l'événement, ou recalculer
après ouverture des futures dimanche soir.

---

## 2. Grand nettoyage du dépôt

Demandé le 2026-09-06. À traiter dans cet ordre : mesurer d'abord, supprimer ensuite. La règle
projet « ne jamais supprimer sans validation explicite par item » s'applique — donc chaque lot de
suppression se présente en liste avant exécution.

### 2.1 Inventaire du code mort — PRÉALABLE À TOUT
Rien ne se supprime avant d'avoir la liste. `tools/` contient déjà des fossiles visibles :
`_build-scan-20260827.js`, `_build-scan-20260828.js`, `_build-scan-20260831.js`,
`_build-scan-20260901.js`, `_tmp-fix-impact.js`, `fix-scan-20260812.js` — des scripts de
construction à usage unique, datés, jamais rappelés.
**Fini quand** : un rapport liste, pour chaque fichier de `tools/`, ses appelants (skills,
commandes, hooks, autres scripts, CI) et son dernier commit utile. `refactor_tool` du graphe de
code fait ça mieux qu'un grep.

### 2.2 Supprimer les scripts à usage unique confirmés
Après 2.1, et par lots présentés à la validation.
**Fini quand** : `tools/` ne contient plus de script daté sans appelant, et la suite de tests
passe toujours.

### 2.3 Tests — combler le trou le plus dangereux d'abord
Le dépôt a des validateurs solides mais peu de tests unitaires. Priorité aux fonctions dont une
erreur silencieuse a déjà coûté cher :
- `tools/lib/marketdata-bars-contract.js` — certification des clôtures
- `tools/lib/dtx-content-gates.js` — `sessions_behind`, cohérence de contrat V2
- `tools/regime-reconcile.js` — les DEUX échelles, et le refus du repli non-autoritaire
- `tools/signal-outcomes.js` — remplissage, scellement, immutabilité
- `tools/validate-scan.js` — l'énuméré d'échelles fermé
**Fini quand** : `node --test` couvre ces cinq modules, chaque test partant d'un incident réel
de cette session.

### 2.4 Consolider la documentation
État actuel : `CLAUDE.md` racine (13 Ko) + 3 sous-`CLAUDE.md` + `.claude/skills/` + `PRODUCT.md`
+ `DESIGN.md` + `EDITORIAL_STYLE.md` + `SUBSTACK_MCP_PLAN.md` + `docs/`. Le plan Substack décrit
un scaffold Node qui n'existe plus (supprimé le 2026-09-05) alors que la production est en Go
dans un autre dépôt — il est **obsolète et trompeur**.
**Fini quand** : un seul point d'entrée par sujet, aucun document ne décrit un composant disparu,
et les renvois croisés sont vérifiés.

### 2.5 README propre
Il n'y a pas de README racine décrivant ce qu'est ce dépôt, ce qu'il produit, et comment on le
fait tourner. Un nouvel arrivant — humain ou agent — commence par `CLAUDE.md`, qui est un fichier
d'instructions, pas une présentation.
**Fini quand** : `README.md` répond à quoi/pourquoi/comment-lancer en une page, sans dupliquer
`CLAUDE.md`.

### 2.6 ADR — décisions d'architecture
Les décisions structurantes sont enfouies dans des commentaires de code et des fichiers mémoire.
Celles qui méritent un ADR rétroactif, parce qu'elles ont été rediscutées plusieurs fois :
- pourquoi le MCP est l'unique moteur (cut-over dtx, suppression du binaire local)
- la frontière LLM/script et les jetons TTL
- l'autorité du régime, et **pourquoi marketdata a deux moteurs de sens opposé**
- l'immutabilité des trades scellés et la chaîne SHA-256
- le contrat de canal par support (site FR / Substack EN / Telegram FR)
**Fini quand** : `docs/adr/NNNN-titre.md`, format court — contexte, décision, conséquences,
statut — un fichier par décision, référencés depuis le README.

### 2.7 Skills — audit du même défaut que les plans scanner
Les plans du scanner appelaient `RunScreener` sans `timeframe`, ce qui rendait un vivier vide en
`status: completed`. `plans/daily.json`, `aplus-screen.json`, `squeeze.json`,
`signals-desk.json` ont la même forme et n'ont pas été vérifiés.
**Fini quand** : chaque plan appelant un screener déclare son `timeframe` et son `job_max_ms`, et
un test le vérifie pour tous les plans d'un coup.

---

## 3. Suites de la revue du mois

`docs/reviews/scanner-202608.md`. Rien ici ne s'applique sans mesure préalable : n = 85, tous les
IC enjambent zéro.

### 3.1 Laisser tourner l'instrumentation jusqu'à 200 lignes scellées
`tools/signal-outcomes.js` est branché. C'est la condition d'entrée de tout le reste.

### 3.2 Sortir le score de la carte publiée, ou le recalibrer
Corrélation score/rendement ≈ **0 à tous les horizons** (−0,004 à J+3). On publie une hiérarchie
de conviction qui ne discrimine rien. Défaut de conception, indépendant de la significativité.
**Attention** : `sweep.js:285` fait `s.score || 80`. Retirer le champ mettrait les quatre modes
live à zéro candidat. Le retrait est **éditorial**, pas structurel.

### 3.3 Décider du sort de Breakout
−0,220R sur 22 lignes, 55 % de stops, 23 entrées sur 25 au-dessus de la clôture de référence.
Bloqué par `Config Change Backtest` : 30 jours de backtest obligatoires, et le pool est consommé
par les modes.

### 3.4 Resserrer `overextension`, tester le time-stop J+3
RSI > 65 → −0,128R ; ATR > 4 % → −0,117R. Le time-stop J+3 est la seule variante de sortie non
dégradante. À valider en régime-aware via `validate-config-change.js`.

---

## 4. Dette signalée au propriétaire marketdata

`docs/briefs/marketdata-daily-screener-timeout.md`. Corrigé pendant la session : le timeout du
screening journalier. Restent ouverts :
- `RunAutoScreener` toujours cassé (timeout 5 min) — contourné par une bascule sur `RunScreener`
- bornage d'univers non déclaré (5 501 sur 22 276 balayés, sans critère exposé)
- faux-vert de fraîcheur : `bars_daily_us_equity.status: ready` avec la clôture certifiée pendant
  que `bars_daily_universe` est à 0 % et 0 symbole chargé
- pas de `restarting_since` : un redémarrage se lit comme une panne
