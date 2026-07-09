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

**Presets de filtres (bibliothèque testée).** Les filtres concrets viennent de `config/signal-presets.yaml` (presets NOMMÉS/versionnés, ex. `Momentum_Explosion_v5.1`). Pour chaque preset pertinent au contexte : passer son `pass_expr`/`score_expr` à `RunScreener`, puis **dériver les niveaux du bracket ATR du preset** — entrée=`entry_expr`, stop=entrée−`sl_expr`, cible=entrée+`tp_expr` (R/R implicite = tp/sl) — au lieu de niveaux ad-hoc. **Taguer** chaque signal avec le nom du preset (= `family` dans le registre) → leçons PAR preset. Respecter le **CAVEAT timeframe** (RunScreener custom = daily ; un preset 1h/15m n'est pas honoré tel quel — l'accepter en daily OU router vers dtx/systematic). Préférer les presets `status: tested`.

## Étape 3 — Classement unifié (cross-familles) + BOUCLE D'AMÉLIORATION
**D'abord** consulter les leçons du track-record : `node tools/signals-ledger.js lessons` puis lire `data/signals-lessons.json` (win-rate + R moyen **par famille × régime**). Utiliser ça pour **pondérer** la sélection : sur-pondérer les familles qui gagnent dans le régime courant, sous-pondérer/écarter celles qui perdent. (Comme le principe absolu du scanner : les leçons ne peuvent qu'ajuster/pondérer, JAMAIS inverser un signal quantitatif ni créer une entrée de zéro — cf `feedback_regime_aware_eval`.)

Puis réunir tous les candidats validés, dédupliquer, et **classer** sur un score commun :
- **R/R** (≥1,5 obligatoire, plus haut = mieux) · **qualité de tendance** (stack MM, RSI non étendu) · **catalyseur** (earnings/flux/squeeze) · **force relative** (perf_rank secteur) · **confiance** · **actionnable au spot** (entrée ≤3%, pas de chase) · **biais leçons** (famille×régime performante).
Garder les **3-5 meilleurs** (pas plus — digest). Si rien de propre : le dire (« pas de setup propre aujourd'hui, on attend »), ne pas forcer.

## Étape 4 — Cohérence panier↔thèse (Strategist, BLOQUANT)
Réduire le panier final à son facteur net (béta/growth-value/duration/cyclique-défensif/concentration). **BLOQUE** si le narratif contredit le book, ou si le book est long le facteur exact qu'un event proche menace sans le signaler (`feedback_harness_portfolio_coherence`). Corriger (repondérer/couper/narratif) avant de continuer.

## Étape 5 — Bilan des signaux précédents (registre persistant)
Les signaux passés vivent dans `data/signals-ledger.json` (append-only). Chaque run :
1. Récupérer les prix des signaux **ouverts** : `node tools/signals-ledger.js report` → liste des `open` → `QueryData(symbols=..., types="quote,bars_daily", days=3)` (prix + high/low du jour).
2. Écrire `{TICKER:{price,high,low}}` dans un fichier et **sweeper** : `node tools/signals-ledger.js sweep --prices <f.json> --asof <J>` (maj statuts : triggered/tp1/tp2/stopped/expired + R réalisé ; ne touche jamais un terminal).
3. `node tools/signals-ledger.js lessons` → rafraîchit `data/signals-lessons.json` (voir étape 3).
Le bilan du message = les `open`/`closedRecent` du `report`. (Complément : `list_notifications`/`get_context` pour le contexte narratif.)

## Étape 5bis — HARNESS (senior-review, BLOQUANT avant post)
Passer le panier final + le message par le harness `senior-review` (type `basket`) : personas **Quant** (chiffres réconciliés MCP), **Trader** (R/R≥1,5 à une entrée actionnable, pas de chase), **Risk** (dilution, gap event), **Strategist** (cohérence panier↔thèse — déjà en étape 4, re-vérifiée), **AI-Forensics** (zéro tic IA, cf `EDITORIAL_STYLE.md`). Gate **PASS/FIX/BLOCK** :
- FIX → appliquer les corrections en place.
- **BLOCK → NE PAS POSTER**, remonter la raison. (Réutilise `.claude/workflows/senior-review.js` si dispo, sinon la passe multi-persona inline.)

## Étape 6 — Digest + POST Telegram
Composer le message (gabarit `swing-signals` : bilan → signaux du jour avec **thèse 1 phrase + `▸ Achète si` + `▸ Skip si` + Stop (−%) · Cibles (+% vs prix) · R/R**), zéro tic IA (`EDITORIAL_STYLE.md`), finir « Idées de trading, pas un conseil ». **Poster** via `send_message(to='alerts', format='html', ...)` — c'est le job de ce skill (contrairement aux briques qui demandent). **Sauf** : (a) argument « ne poste pas » → dry-run, montrer seulement ; (b) STOP MCP ou BLOCK Strategist → ne pas poster, remonter le problème.

## Étape 7 — Log (registre append-only)
Écrire les signaux émis dans un fichier JSON `[{date,family,ticker,entry,stop,tp1,tp2,rr,thesis,regime,confidence,status}]` puis `node tools/signals-ledger.js append --payload <f.json>` → alimente le track-record (dédup par id, jamais d'écrasement). Le prochain run les revalide (étape 5) et en tire des leçons (étape 3) = **boucle d'amélioration fermée**. Optionnel : `remember(workspace='dailystocks', type='project', ...)` pour le contexte cross-agent.

## Automatisation
Pensé pour tourner **mains libres** (cron/routine cloud pré-marché). Pour planifier : skill `schedule` / `RemoteTrigger` (voir `project_cloud_routine_automerge`). En run planifié, l'étape 6 poste directement (pas de confirmation).

Voir aussi : `swing-signals`, `squeeze-radar`, `earnings-reaction`, `sector-rotation`, `macro-event-playbook`, `senior-review` (passe Strategist), `mcp-gateway-tools`.
