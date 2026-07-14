---
name: scanner-no-broker-exec
description: JAMAIS d'exécution broker auto dans /scanner — run-session retiré du flux; Telegram scanner = canal daily
metadata:
  type: feedback
---

**Le pipeline `/scanner` ne DOIT JAMAIS exécuter d'ordres broker réels automatiquement.** L'étape `run-session` (trading-executor) a été **retirée** de la Phase 5 du skill `scanner-pipeline.md` ET de `.claude/commands/scanner.md` (2026-07-14, demande user). Le flux `/scanner` s'arrête à : sélection → publication article → downstream (sweep, gen-status-page, gen-api) → notification Telegram. Point.

`run-session` reste un **outil MANUEL séparé** (skill/commande autonome intacts) que l'utilisateur invoque délibérément — jamais dans un flux automatique.

**Notification Telegram du scanner → canal `daily`** (alias notification MCP). Le tool local `telegram-publish-notify.js` défère à la routine cloud (pas de token en local) ; pour un envoi manuel, utiliser `send_message(to='daily', format='html')`.

**Why:** on ne trade jamais du réel en auto — le risque d'exécuter des ordres sur du capital réel sans supervision humaine est inacceptable. Voir aussi [[independent-trading-desk]] et [[scanner-mode-change-full-pipeline]].
