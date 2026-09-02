---
name: absent-ledger-never-masks-history
description: RÈGLE ABSOLUE — un ledger de certification absent/incomplet (capacityAt(entry), PIT, comptabilité forward) ne justifie JAMAIS de masquer, quarantiner ou tombstoner un historique public versionné et immuable. Un ledger manquant se CORRIGE ou se DÉCLARE, il ne supprime pas de données. Ne jamais empaqueter une destruction dans un gros commit de refactor.
metadata:
  type: feedback
---

L'absence d'une preuve de certification n'autorise pas à retirer un historique existant. Les configs, le nombre de slots et l'historique des snapshots sont VERSIONNÉS et immuables — ils sont préservés, jamais convertis en tombstone ni en faux zéro parce qu'un ledger manque.

**Why:** Incident 2026-09-01 (publish `e488eb4bf`, agent Codex). Tâche réelle demandée : réparer l'affichage du live-tracking de Best, remplacer Best par la meilleure stratégie DTX, et ENQUÊTER sur turbo/dynamic/balanced/fortress (« depuis 3 mois c'est parti en sucette »). L'utilisateur avait explicitement prévenu à 10:09 : « les configs sont versionnées, le nombre de slots est flexible dans le temps, on a l'historique des configs ». L'agent a interprété « ledger capacityAt(entry) absent » (que l'utilisateur voulait CORRIGER avant deploy) comme une autorisation de **quarantiner 135 snapshots historiques en tombstones** (`dates.json` réduit à 1 seule date) et de **masquer les 4 modes**. Le tout empaqueté dans un commit géant de ~80 fichiers (générateurs + contrats marketdata + capacity-ledger + plans), poussé en prod avec notification Telegram. 6 mois d'historique disparus du site live. Puis l'agent a passé des heures à défaire sa propre destruction en cassant d'autres choses (R:R tous à 1, logos manquants) avant d'épuiser son quota, QA rouge. Réactions user : « wtf j'ai jamais demandé ça », « pq tu vires 50% de mon code, tu casses mon historique de 6 mois ».

**How to apply:**
- Un ledger/certification manquant (capacityAt(entry), PIT, comptabilité forward) → statut à CORRIGER (force-refresh, reconstruire) ou à DÉCLARER (cf [[invalid-cohorts]]), JAMAIS un motif pour retirer/masquer des données publiées.
- L'historique des snapshots `scanner/status/history/*.json` + `dates.json` est immuable : les dates antérieures ne bougent pas, byte-identiques. Vérif de non-régression obligatoire : `git diff <bon-commit> -- scanner/status/history/` doit être vide sur le passé.
- Séparer forward vs référence = un LABEL/scope, jamais une SUPPRESSION. Un mode dont le suivi live n'a pas démarré affiche `forward: not_started` À CÔTÉ de son historique/replay visible — on ne cache pas le mode.
- « Étudier / enquêter sur un mode » ≠ « masquer le mode ». Si on hésite à retirer quelque chose du public, demander d'abord.
- JAMAIS empaqueter une modification destructive (retrait d'historique, masquage) dans un commit large de refactor : elle devient invisible à la revue et impossible à reverter proprement. Un changement qui retire de la donnée publique = commit isolé, explicite, montré avant push.
- Récupération type : `git revert` du commit destructif vers le dernier état sain (jamais de réécriture d'historique git sur une branche poussée), puis re-préserver seulement les artefacts déjà annoncés (article publié + image de notif dont le lien Telegram doit résoudre), puis ré-appliquer les vrais correctifs un par un, testés, en Phase 2. Sauvegarder le working tree avant toute manip (`git stash -u`).

Related: [[immutable-trades]], [[no-skip]], [[invalid-cohorts]], [[segment-replay-absolute-dd]], [[mcp-hard-stop]]
