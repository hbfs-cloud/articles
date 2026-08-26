# Compaction de la mémoire MCP — 2026-08-26

Demande user : « il faut compacter la mémoire du mcp memory de tout les workspaces »
puis « vire tout ce qui est expiré ou plus utile, on doit garder un truc light ».

## Résultat

| Workspace | Avant | Après | Évincées |
|---|---|---|---|
| dailystocks | 1096 | 364 | 739 |
| articles | 23 | 3 | 21 |
| dailytickers | 9 | 1 | 9 |
| aplus-portfolio | 5 | 2 | 6 |
| global | 9 | 8 | 1 |
| hbfs | 10 | 10 | 0 (projet distinct, non touché) |
| madrassah | 7 | 7 | 0 (projet distinct, non touché) |
| 16 workspaces de test (`qa-*`, `tmp-*`, `e2e-policy-test`) | 0 | 0 | déjà vides — aucun outil ne permet de supprimer un workspace |

**Total : 1159 → 395 mémoires actives (−66 %).**

## Méthode

L'éviction est un **soft-delete** : le serveur conserve chaque entrée avec son motif
(`eviction_reason`) et son horodatage. Restauration d'une entrée :
`update_memory(memory_id, is_active=true)`.

Chaque famille évincée a laissé un **registre d'archive** actif dans le workspace, qui dit ce
qui a été retiré, ce qui a été gardé, et pourquoi :

- `archive-auto-capture-juin-juillet-2026` (type fact)
- `archive-retros-operationnelles-juin-juillet-2026` (type retro)
- `archive-chantiers-livres-mai-juillet-2026` (type project)
- `archive-regles-redondantes-et-perimees-2026` (type rule)
- `archive-decisions-operationnelles-juin-juillet-2026` (type decision)
- `archive-feedbacks-bruit-et-doublons-2026` (type feedback)
- `workspace-deprecie-utiliser-dailystocks` (dans `articles` et `dailytickers`)

`dailystocks-fact.md` (ce dossier) contient l'index détaillé **id + nom + description** des
mémoires de type `fact` évincées, plus la liste de celles qui ont été protégées.

## Critères appliqués

**Évincé** — instantanés datés (runs de conducteur, monitors d'un jour, picks d'une séance,
logs de refresh, états de portefeuille), chantiers livrés et vérifiés, rapports de correctifs
déployés, décisions opérationnelles déjà appliquées, doublons partiels (garder la version la
plus complète), règles décrivant un état de service qui a changé, artefacts de test
(`learning-backend-*`), fragments d'auto-capture d'une ligne sans contexte.

**Jamais évincé** — type `user`, `priority: critical`, `requires_ack: true`, tout ce qui a été
mis à jour depuis le 2026-08-19, l'intention humaine (décisions, corrections et clarifications
du user), et la doctrine qui gouverne encore un comportement.

## Consolidations (contenu préservé, pas perdu)

- **`doctrine-entree-risque-et-style-user`** (decision, priority high) : 21 règles et décisions
  d'une ligne sur la sélection, l'entrée, le sizing, l'exécution et le style de trading,
  reprises **mot pour mot** en une seule mémoire lisible d'un coup.

## Reste à faire (non fait, volontairement)

Le workspace `dailystocks` garde ~97 mémoires de type `fact` issues d'auto-captures aux slugs
tronqués (`d-cision-humaine-2026-07-09-…`, `r-gle-dure-critical-…`). Elles ont été PROTÉGÉES
parce qu'elles portent de l'intention humaine ou de la doctrine, mais elles mériteraient d'être
relues et fusionnées en quelques décisions thématiques — un travail qui exige de lire chaque
corps, pas seulement l'index.

Les workspaces `hbfs` et `madrassah` (projet SaaS scolaire, 17 mémoires) n'ont pas été touchés :
ce sont des spécifications de chantiers livrés sur un projet dont je ne suis pas juge.
