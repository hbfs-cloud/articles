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

## Contrat des signaux — SCHÉMA PIVOT + STATE + AGRÉGATION (déterministe, zéro LLM)
_Adopté de `virattt/ai-hedge-fund` (§2 idées #2/#3/#6 de `docs/research/ai-hedge-fund-ideas.md`) — mais 100 % code reproductible : le LLM ne sert (au plus) qu'à la narration édito finale, JAMAIS à produire un chiffre de confidence ni un verdict._

**Schéma PIVOT (#2) — `tools/lib/signal-schema.js`.** Chaque générateur (`swing-signals`, `squeeze-radar`, `earnings-reaction`, `sector-rotation`, `macro-event-playbook`) DOIT émettre, EN PLUS de ses niveaux (entry/stop/tp — inchangés), un méta-objet au contrat unique :
```
{ signal: 'bullish' | 'bearish' | 'neutral', confidence: 0-100 (entier), reasoning: string non vide }
```
Le pivot est une COUCHE de méta qui accompagne les niveaux, pas un remplacement. `validateSignal`/`normalizeSignal` REJETTENT un signal malformé (enum invalide, confidence non numérique, reasoning vide) — jamais de valeur par défaut fabriquée (anti-pattern `create_default_response()` du repo source = interdit ici, cf MCP HARD STOP). `value-quality-board.js` émet déjà exactement ce schéma. **Confidence auditables (#6a)** exposées par ce module : `valuationConfidence(gap)` = `min(|gap|/0.30 × 100, 100)` et `consensusConfidence(bull,bear,n)` = `max(bull,bear)/n × 100` — jamais une « confidence LLM opaque ».

**State partagé merge_dicts (#3) — `tools/lib/signals-desk-state.js`.** Le desk assemble les signaux via ce state (remplace toute glue ad-hoc) : chaque générateur écrit SA propre clé `source` → `state[ticker][source] = {signal,confidence,reasoning}`. Fusion `mergeState({...a,...b})` non destructive → N sources sans collision (`setSignal(state, ticker, source, pivot)` valide au schéma pivot puis merge ; fail-closed si malformé). L'agrégation = simple lecture du state.

**Agrégation confidence-weighted (#6b) — `aggregateTicker` / `aggregateAll`.** Verdict desk REPRODUCTIBLE par ticker, en code :
`weightedScore = Σ(valeur(signal_i) × confidence_i) / Σ(confidence_i) ∈ [-1,1]` (bullish=+1, bearish=−1, neutral=0) → `≥ +0.25` bullish, `≤ −0.25` bearish, sinon neutral ; confidence du verdict = moyenne des confidences des sources alignées. C'est l'INVERSE de l'anti-pattern du repo (convictions agrégées sans pondération, tranchées par un LLM non reproductible). Chaque chiffre du verdict est justifiable → colle à `EDITORIAL_STYLE`. Ce verdict alimente le classement (étape 3) et les digests (étape 6). CLI : `node tools/lib/signals-desk-state.js --in state.json`.

## ⚡ Exécution (doctrine `perf-parallel-mcp`)
Isoler le MCP en salves parallèles (R2), batcher `QueryData` multi-symboles (R3), preflight `GetStatus`
1× (R4). **Salve 1** (un message, // ) : `GetMarketContext` overview+regime + `RunAutoScreener` +
`economic_events` + `GetEarningsCalendarFiltered` + les `RunScreener` des presets retenus. **Salve 2**
(//): toutes les barres/quotes des candidats (dédupées, multi-symboles). **Salve 3** (//): flux §4bis
(insider/put-call/short-interest/13F) par candidat. Le classement/agrégation (state) est du **code local**
(zéro MCP). Fail-closed + HARD STOP conservés.

## Étape 1 — Contexte (le cerveau)
**Réutilisation handoff (appel depuis `/scanner`)** : si `/tmp/scan-context.json` existe ET est frais
(même séance), le CHARGER (regime, VIX, indices/breadth, earnings calendar, economic events, données
candidats déjà fetchées) et **SKIP les appels contexte redondants** — zéro re-fetch. Sinon (appel seul),
faire la collecte normale ci-dessous.
`GetMarketContext(facets="overview")` + `RunAutoScreener` intensité → **régime** (risk-on/off + score), VIX, indices/breadth, pétrole/or/taux. `QueryData types="economic_events"` + `GetEarningsCalendarFiltered(days_ahead=7)` → **proximité d'un événement macro** (CPI/Fed/jobs ±3 séances ?) et **densité earnings** (saison ?). Émettre ces appels EN UNE SALVE (//), pas en série.

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

Puis réunir tous les candidats validés dans le **state partagé** (`setSignal(state, ticker, source, {signal,confidence,reasoning})` par générateur — cf « Contrat des signaux » ci-dessus), et produire le **verdict desk par ticker** via `aggregateTicker`/`aggregateAll` (agrégation confidence-weighted déterministe : un même ticker signalé par swing + squeeze + rotation ⇒ un verdict pondéré unique, reproductible et auditable — remplace toute réconciliation manuelle). Dédupliquer, et **classer** sur un score commun — **qui intègre les FLUX (swing-signals §4bis, obligatoire depuis le 10/07)** : insiders 30j, put/call + max pain, tendance short interest, 13F trackés (avec leurs caveats lag/couverture). Flux contraires = le candidat descend ou sort du top ; flux porteurs = bonus, jamais un contournement d'un red flag :
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

**Alertes de suivi — OBLIGATOIRE À CHAQUE run `desk`/`signals-desk` (y compris le variant fire-and-forget), pas seulement au bilan.** `node tools/signal-alerts.js [--prices <f.json>] [--asof J]` compare le registre + les prix du jour à l'état du dernier run et empile les événements NOUVEAUX (entrée touchée / stop touché / TP1 / TP2) dans `data/signal-alerts-pending.json`, dédupliqués par `signal+event`. Le script **ne notifie pas** (le MCP Notification est en OAuth2 : un subprocess `node` ne peut pas l'appeler). La routine fait donc, à CHAQUE run :
1. `node tools/signal-alerts.js` → détecte, écrit le pending.
2. Lire les events `notified:false` : `node tools/signal-alerts.js --pending` (JSON — chaque event porte déjà `suggestedLine`, une ligne html prête, ex. `❌ <b>TICKER</b> — stop 42,10 touché, −1,20R.` ; c'est CE champ qu'on poste, pas un gabarit réinventé).
3. Pour chaque event non-notifié : `send_message(to='alerts', format='html', body=<suggestedLine ou digest groupé de plusieurs suggestedLine>, ...)` avec les mêmes boutons `actions` qu'un digest.
4. Marquer immédiatement : `node tools/signal-alerts.js --mark <key,key,...>` (ou `--mark-all` si tout a été posté d'un coup).
Sans l'étape 4, la même alerte repart au run suivant (doublon Telegram). `--dry` pour vérifier sans rien écrire. Si `tools/signal-alerts.js` n'existe pas encore sur la branche/déploiement courant, sauter l'étape sans bloquer le run (dégradation gracieuse) — elle s'active automatiquement dès que le script est présent.

**Adoption lue sur les boutons.** Le bilan **hebdo** ne se contente pas du R réalisé : pour chaque `messageId` des 7 derniers jours (`data/signals-telegram-messages.json`, cf étape 6), appeler `get_responses(message_id)` → `{responses:[{responder, value, created_at}]}` avec `value` ∈ `taken` / `skipped`. Croiser avec le registre donne les deux chiffres qui comptent : le **taux de prise** par famille × régime, et surtout l'écart entre ce qui gagne et ce qui est effectivement suivi (une famille rentable mais jamais prise = digest mal formulé ou entrée pas actionnable, pas un problème de stratégie). Zéro réponse sur un digest = information aussi, à ne pas lire comme un succès.

## Étape 5bis — HARNESS (senior-review, BLOQUANT avant post)
Passer le panier final + le message par le harness `senior-review` (type `basket`) : personas **Quant** (chiffres réconciliés MCP), **Trader** (R/R≥1,5 à une entrée actionnable, pas de chase), **Risk** (dilution, gap event), **Strategist** (cohérence panier↔thèse — déjà en étape 4, re-vérifiée), **AI-Forensics** (zéro tic IA, cf `EDITORIAL_STYLE.md`). **CHECKS NUMÉRIQUES OBLIGATOIRES du harness (post-mortem 10/07 — les règles §4 existaient mais un run les a violées trois fois : HLT R/R TP1 1,42 publié « 2,0 », INTC stop 0,6×ATR, earnings en fenêtre non flaggés ; le harness RECALCULE, il ne relit pas)** : pour CHAQUE signal du digest, recalculer depuis les niveaux publiés (a) R/R_TP1 = (TP1−entrée)/(entrée−stop) ≥ 1,5, (b) (entrée−stop)/ATR14 ≥ 1,5, (c) earnings ≤ J+12 → flag présent dans le texte, (d) chaque claim data (dark pool/put-call/flux) tracé à un appel MCP de la session, (e) la ligne FLUX du signal (swing-signals §4bis) présente ET cohérente avec les fetches (un signal publié avec put-skew + SI en hausse + distribution 13F non mentionnés = BLOCK) — un seul échec = **BLOCK du signal concerné** (les autres peuvent partir). Gate **PASS/FIX/BLOCK** :
- FIX → appliquer les corrections en place.
- **BLOCK → NE PAS POSTER**, remonter la raison. (Réutilise `.claude/workflows/senior-review.js` si dispo, sinon la passe multi-persona inline.)

## Étape 6 — Digest + POST Telegram (FORMAT EXACT, obligatoire)
Zéro tic IA (`EDITORIAL_STYLE.md`). **Émettre en `format:"html"`** avec balises `<b>`/`<i>` — JAMAIS de markdown `**` (rendu littéral), échapper `&`→`&amp;`, `<`/`>` hors balises. Suivre CE gabarit **au caractère près** (c'est le style validé, ne pas improviser un autre) :

```
📊 <b>Bilan &amp; signaux — [JJ mois]</b>

🕌 <b>Portefeuille accumulation ([date pose], horizon)</b>   ← seulement s'il y en a un en cours
[1 ligne/nom : emoji + TICKER + % move + statut court (repli/étendu/zone d'achat)]

⚡ <b>Signaux précédents — statut</b>
[1 ligne/nom : emoji + TICKER + prix (+/−%) + verdict (marche / valide / touché cible / stoppé / raté / non déclenché)]

🎯 <b>Signaux du jour — [régime] · [caveat événement s'il y en a]</b>

🟢 <b>TICKER</b> (secteur) — [thèse en 1 phrase].
▸ Achète si : [condition d'entrée] <b>[niveau]</b>.
▸ Skip si : [invalidation].
Stop [x] (−x %) · Cibles [y] (+y % vs prix) / [z] (+z %) · R/R [n]

[répéter le bloc 🟢/🟡 pour chaque signal, 3-5 max]

⚠️ [ce qui casse le lot — l'événement/risque principal]
<i>Idées de trading, pas un conseil — gère ta taille.</i>
```

**Pastilles (obligatoires, une par ligne de ticker)** : 🟢 solide/zone d'achat · 🟡 conditionnel/volatil · 🟠 étendu (parti sans repli, ne pas chaser) · 🔴 faible · ✅ marche · ❌ raté/stoppé · ⏸️ non déclenché.

**À NE PAS FAIRE (ce qui casse le style) :** pas de paragraphes de prose (thèse = **1 phrase** max) ; pas de section « Contexte » verbeuse séparée (le régime va dans le titre 🎯, le risque dans le ⚠️ final) ; pas de setups numérotés `1. / 2.` — chaque signal = **pastille + `<b>TICKER</b>` (secteur) + 1 phrase**, puis `▸ Achète si` / `▸ Skip si`, puis la ligne `Stop · Cibles · R/R`. Toujours des **pastilles couleur** devant chaque ticker (bilan ET signaux du jour), jamais des `▸` nus. Compact et scannable, exactement comme le gabarit.

**Poster** via `send_message(to='alerts', format='html', ...)` — c'est le job de ce skill (contrairement aux briques qui demandent). **Sauf** : (a) argument « ne poste pas » → dry-run, montrer seulement ; (b) STOP MCP ou BLOCK harness/Strategist → ne pas poster, remonter le problème.

**Boutons de feedback (OBLIGATOIRE sur tout post de signaux).** L'appel porte `actions` — deux boutons, libellés et valeurs EXACTS, jamais d'autre wording :
```
send_message(to='alerts', format='html', body=digest,
             actions=[{label:'👍 pris', value:'taken'}, {label:'👎 passé', value:'skipped'}])
```
Le clic est capté côté serveur (`value` → réponse). C'est la seule mesure de ce que les lecteurs prennent VRAIMENT : le registre dit si le signal a marché, les boutons disent s'il a été suivi. Un digest posté sans `actions` ne produit aucune donnée d'adoption — la semaine est perdue.

**Persister le `message_id`** retourné : `get_responses` en a besoin, il n'y a pas de recherche par date. Après l'envoi, appondre dans `data/signals-telegram-messages.json` :
```
node -e 'const f="data/signals-telegram-messages.json",fs=require("fs");
const d=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{messages:[]};
d.messages.push({date:"<JJ/MM ISO>",messageId:"<message_id>",kind:"signals-desk",tickers:["<TICKERS>"]});
fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n")'
```
(Filet de secours si le fichier a sauté : `list_notifications` retrouve les envois récents et leurs ids.)

## Étape 7 — Log (registre append-only)
Écrire les signaux émis dans un fichier JSON `[{date,family,ticker,entry,stop,tp1,tp2,rr,thesis,regime,confidence,status}]` puis `node tools/signals-ledger.js append --payload <f.json>` → alimente le track-record (dédup par id, jamais d'écrasement). Le prochain run les revalide (étape 5) et en tire des leçons (étape 3) = **boucle d'amélioration fermée**. Optionnel : `remember(workspace='dailystocks', type='project', ...)` pour le contexte cross-agent.

## Étape 8 — Git : PUSH DIRECT SUR MAIN
Les changements de ce skill sont **minuscules** (registre, leçons, file d'alertes, ids Telegram), **aucun scan scanner** → **push DIRECT sur `main`**, PAS de branche/PR :
```
git fetch origin main && git rebase origin/main   # ou merge ; garder les fichiers générés sur conflit
git add data/signals-ledger.json data/signals-lessons.json \
        data/signal-alerts-pending.json data/signals-telegram-messages.json   # fichiers SPÉCIFIQUES uniquement (jamais git add -A)
git commit -m "signals(ledger): <date> <matin|soir> — <n> signaux + sweep"
git push origin HEAD:main
```
Si le push est rejeté (divergence) → re-`fetch`/`rebase` et re-push. **NE PAS** créer de branche `claude/**` en comptant sur le workflow auto-merge scanner : son `qa-check --strict` est **spécifique au scanner** (attend un scan frais + complétude dtx) et **échouera** sur un run signals-desk (branche sans scan). Le push direct main est propre et déclenche `deploy.yml` (Pages).

## Automatisation
Pensé pour tourner **mains libres** (cron/routine cloud pré-marché). Pour planifier : skill `schedule` / `RemoteTrigger` (voir `project_cloud_routine_automerge`). En run planifié, l'étape 6 poste directement (pas de confirmation).

Voir aussi : `swing-signals`, `squeeze-radar`, `earnings-reaction`, `sector-rotation`, `macro-event-playbook`, `senior-review` (passe Strategist), `mcp-gateway-tools`.
