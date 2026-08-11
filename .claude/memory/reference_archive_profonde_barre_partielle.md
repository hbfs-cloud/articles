---
name: reference_archive_profonde_barre_partielle
description: "Le service de données sert une séance partielle en fenêtre profonde et la déclare complète — mesuré le 2026-08-11 sur GLD, écart 0,8%"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 34ba4040-0756-44f8-8b39-ebb5aab81545
  modified: 2026-08-11T22:32:39.833Z
---

**`QueryData(types=bars_daily)` peut servir une barre PARTIELLE en fenêtre profonde,
avec `sessions_complete: true`.** Mesuré le 2026-08-11 sur GLD, deux appels à trente
secondes d'écart :

- `days=2` → clôture du 10/08 = **402,54**, volume 11 057 000, barre du 11/08 présente
- `days=5` → clôture du 10/08 = **399,39**, volume 5 869 555 (53 % du vrai), pas de 11/08

Soit 0,79 % d'écart sur la même clôture. Ce n'est **pas** un effet de `end_date` (présent
dans les deux), **pas** un rafraîchissement en cours (`GetStatus` disait `ready`,
progression 100 %, `ref_lag_sessions: 0`, témoins au 11/08), et **pas** global : dans une
même réponse profonde, TLT était à jour quand GLD ne l'était pas.

**Mécanisme** : sans fenêtre, la lecture vient du cache chaud, qui se corrige. Avec une
fenêtre profonde, elle vient de l'archive sur disque, écrite une fois lors du premier
backfill du symbole — si ce backfill a eu lieu pendant une séance ouverte, la barre
partielle y reste indéfiniment. Le rafraîchissement quotidien ne la révise pas.

**Conséquence pour nous** : tous nos plans lisent en fenêtre profonde (`limit` 90-130 avec
`end_date`, imposé par le contrat de date point-in-time). Une note a porté une performance
de l'or fausse de 0,8 % — en titre. Aucun champ de la réponse ne permettait de le voir.

**Parade côté collecte** (non implémentée) : recouper la dernière clôture de chaque série
profonde contre un appel court, ou refuser une dernière barre dont le volume est
anormalement bas face à sa moyenne récente. La première est plus sûre, une requête par vague.

Dossier pour le propriétaire du service : `.claude/mcp-marketdata-bug-archive-profonde.md`.
Voir [[feedback_appariement_mcp_fail_closed]].
