---
name: signals-desk
description: Chef d'orchestre des signaux — lit le régime/contexte live, sélectionne les MEILLEURES familles de setups (swing/squeeze/earnings/rotation/macro) selon le contexte, sort les meilleurs signaux du jour classés, fait le bilan des signaux précédents, et poste le digest sur Telegram. Un seul point d'entrée, mains libres. Trigger keywords : meilleurs signaux, signaux du jour, desk signaux, best setups, pick les meilleurs, signaux auto, run signaux, signal desk.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : 'ne poste pas' pour dry-run, ou une contrainte d'univers] — sinon sélection auto + post Telegram"
license: Apache 2.0
---

# Signals Desk — sélection contextuelle des meilleurs setups + bilan + post

**Un seul run** : lit le contexte, choisit les bonnes briques parmi les 5 générateurs (`swing-signals`, `squeeze-radar`, `earnings-reaction`, `sector-rotation`, `macro-event-playbook`), classe les meilleurs signaux, fait le bilan, poste. Pas besoin de les lancer un par un.

## ⛔ Règles non négociables (les mêmes que les briques)
- **Preflight MCP** : `GetStatus`/`GetHealth` d'abord. Bloqué / stale >48h / incohérent → **STOP**, alerte, ne rien poster (`feedback_mcp_hard_stop`). Régime **dérivé des données live** (`rule/derive-regime-from-live-data`).
- **Zéro hallucination** — chaque chiffre via MCP de la session (`feedback_no_hallucination`).
- **Idées ≠ données desk** — ce sont des idées publiées → alias Telegram public OK ; ne JAMAIS y mettre positions/equity/P&L/ordres réels (`rule/never-send-sensitive-data-to-public-telegram`). Vérifier la destination avant envoi.
- **Telegram `format:"html"` `<b>`** (jamais `**`), `&`→`&amp;`.

## Étape 1 — Contexte (le cerveau)
`GetMarketContext(facets="overview")` + `RunAutoScreener` intensité → **régime** (risk-on/off + score), VIX, indices/breadth, pétrole/or/taux. `QueryData types="economic_events"` + `GetEarningsCalendarFiltered(days_ahead=7)` → **proximité d'un événement macro** (CPI/Fed/jobs ±3 séances ?) et **densité earnings** (saison ?).

## Étape 2 — Sélection des familles (matrice contexte → briques)
Choisir 2-3 familles à activer, PAS les cinq :

| Contexte live | Familles prioritaires | Réglage |
|---|---|---|
| **RISK-ON, VIX bas, pas d'event ≤3j** | `swing-signals` (momentum+continuation) + `sector-rotation` (leaders RS) | taille normale |
| **RISK-OFF / EARLY, VIX ↑** | `swing-signals` volet **oversold-quality/défensif** + `sector-rotation` (tilt défensif) | demi-taille, breakout-only |
| **Event macro ≤3 séances (CPI/Fed)** | `macro-event-playbook` (scénarios + de-risk) EN PREMIER, puis 1-2 swings max | demi-taille, ne pas être long en aveugle le facteur menacé |
| **Saison earnings dense** | `earnings-reaction` (PRÉ à surveiller + POST drift) + swings | gap-risk explicite |
| **Noms à fort short + catalyseur détectés** | ajouter `squeeze-radar` (1-2 max) | quart de taille |

Appliquer chaque brique retenue **selon sa propre recette** (ne pas ré-inventer — suivre le .md de la brique : screener, validation niveaux, anti-dilution, earnings ±3j).

## Étape 3 — Classement unifié (cross-familles)
Réunir tous les candidats validés, dédupliquer, puis **classer** sur un score commun :
- **R/R** (≥1,5 obligatoire, plus haut = mieux) · **qualité de tendance** (stack MM, RSI non étendu) · **catalyseur** (earnings/flux/squeeze) · **force relative** (perf_rank secteur) · **confiance** (basse/moyenne/haute) · **actionnable au spot** (entrée ≤3%, pas de chase).
Garder les **3-5 meilleurs** (pas plus — digest). Si rien de propre : le dire (« pas de setup propre aujourd'hui, on attend »), ne pas forcer.

## Étape 4 — Cohérence panier↔thèse (Strategist, BLOQUANT)
Réduire le panier final à son facteur net (béta/growth-value/duration/cyclique-défensif/concentration). **BLOQUE** si le narratif contredit le book, ou si le book est long le facteur exact qu'un event proche menace sans le signaler (`feedback_harness_portfolio_coherence`). Corriger (repondérer/couper/narratif) avant de continuer.

## Étape 5 — Bilan des signaux précédents
`list_notifications` + `get_context(workspace='dailystocks')` → derniers signaux postés (toutes familles) ; revalider au spot (`QueryData quote,technicals,bars_daily`) : marche / valide / cible touchée / stoppé / raté / non déclenché.

## Étape 6 — Digest + POST Telegram
Composer le message (gabarit `swing-signals` : bilan → signaux du jour avec **thèse 1 phrase + `▸ Achète si` + `▸ Skip si` + Stop (−%) · Cibles (+% vs prix) · R/R**), zéro tic IA (`EDITORIAL_STYLE.md`), finir « Idées de trading, pas un conseil ». **Poster** via `send_message(to='alerts', format='html', ...)` — c'est le job de ce skill (contrairement aux briques qui demandent). **Sauf** : (a) argument « ne poste pas » → dry-run, montrer seulement ; (b) STOP MCP ou BLOCK Strategist → ne pas poster, remonter le problème.

## Étape 7 — Log
`remember(workspace='dailystocks', type='project', name='signals-YYYYMMDD', ...)` avec les signaux émis (tickers + niveaux + thèse + famille) → bilan automatique au prochain run.

## Automatisation
Pensé pour tourner **mains libres** (cron/routine cloud pré-marché). Pour planifier : skill `schedule` / `RemoteTrigger` (voir `project_cloud_routine_automerge`). En run planifié, l'étape 6 poste directement (pas de confirmation).

Voir aussi : `swing-signals`, `squeeze-radar`, `earnings-reaction`, `sector-rotation`, `macro-event-playbook`, `senior-review` (passe Strategist), `mcp-gateway-tools`.
