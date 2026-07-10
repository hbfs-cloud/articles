---
name: swing-signals
description: Génère des signaux swing court terme (5-10 séances) MCP-vérifiés + le bilan des signaux passés (J-1/J-2), passe la cohérence panier↔thèse (Strategist), et produit un message Telegram digest prêt à poster. Trigger keywords : swing, signaux swing, swings tactiques, trade court terme, bilan swing, quels signaux today, coups rapides, jouable aujourd'hui.
version: 1.0.0
user-invocable: true
argument-hint: "[optionnel : univers/secteur/contrainte, ex. 'US large caps' ou 'ajoute crypto'] — sinon US large/mid cap par défaut"
license: Apache 2.0
---

# Swing Signals — signaux court terme + bilan + publication

Produit, en une passe : (1) le **bilan** des signaux swing précédents (statut réel au spot), (2) les **nouveaux signaux du jour** validés en niveaux, (3) un **message Telegram digest** prêt à coller. Tout est **MCP-vérifié** — zéro chiffre inventé.

## ⛔ Règles non négociables
- **Zéro hallucination** : chaque prix/RSI/MM/ATR/earnings/dilution vient d'un appel MCP de la session courante. Un appel échoue → le dire, ne pas substituer. Voir `feedback_no_hallucination`, `feedback_mcp_hard_stop` (MCP incohérent/stale >48h → STOP).
- **Idées ≠ données desk** : ces signaux sont des **idées publiées** (comme les picks scanner) → OK sur alias Telegram public. Ne JAMAIS envoyer les positions/equity/P&L/ordres RÉELS du desk sur un alias public (`rule/never-send-sensitive-data-to-public-telegram`).
- **Telegram = `format:"html"`** avec balises `<b>`/`<i>` — JAMAIS de markdown `**` (rendu littéral). Échapper `&`→`&amp;`, `<`/`>` hors balises.
- **N'envoie sur Telegram que sur demande explicite.** Par défaut, montrer le message et attendre le « go ».

## Étapes

### 1. Rappel des plans passés
Récupère les plans swing J-1 et J-2 : `mcp__notification__list_notifications` (historique des messages postés) + `mcp__memory__get_context(query=..., workspace='dailystocks')`. Extrais VERBATIM par ticker : entrée, stop, cibles, thèse, date. Distingue **swings** (5-10 séances) et **accumulation** (6-12 mois — thèse « acheter sur repli »). Plan introuvable → écrire « introuvable », ne pas inventer.

### 2. Revalidation au spot (MCP)
Pour chaque ticker des plans : `QueryData(symbols=T, types="quote,technicals,bars_daily", days=40)`. Classe :
- **stoppé** / **cible touchée** / **encore valide** (≤3% de l'entrée, tendance intacte) / **étendu** (>~5% au-dessus → ne plus entrer) / **non déclenché** (entrée conditionnelle non armée) / **invalidé**.
- Pour l'accumulation « acheter sur repli » : dire si le repli est **venu** (zone d'achat) ou si c'est **parti sans** (raté → ne pas chaser).
- Donne prix actuel + % vs entrée/stop.

### 3. Screener du jour (2 passes)
`RunScreener` (region='US', asset='stock', top_k=15, force_async=true, poll `Jobs`) :
- **(a) momentum** : `pass_expr="rsi14>48 && rsi14<62 && macd>0 && close>ema20 && vol>sma('vol',20)"`, `score_expr="100-rsi14"`
- **(b) continuation** : `pass_expr="close>ema20 && ema20>ema50 && ema50>ema200 && (close-ema20)/ema20<=0.03 && rsi14>50 && rsi14<68"`, `score_expr="100-rsi14"`
- ⚠️ Le floor mcap n'est **pas** appliqué sur `pass_expr` custom → filtre ≥$2B À LA MAIN. Lire `warnings[]`.
- **Presets testés** : préférer les filtres nommés de `config/signal-presets.yaml` (ex. `Momentum_Explosion_v5.1`) — utiliser leur `pass_expr`/`score_expr` et dériver les niveaux du bracket ATR (`entry_expr`/`sl_expr`/`tp_expr`) plutôt que des exprs ad-hoc. Taguer le signal avec le nom du preset. Respecter le CAVEAT timeframe (RunScreener custom = daily).

### 4. Validation en niveaux (règle desk — sinon on jette)
Par candidat retenu :
- **Support/résistance depuis les barres** (le type `support_resistance` renvoie souvent vide → lire les swing highs/lows des 30-40 barres).
- **Entrée actionnable à ≤3% du spot** : achat-maintenant SEULEMENT si propre au-dessus de la MM20 et **pas étendu** (>~4% au-dessus MM20 = chase → refus, cf `feedback_no_false_caveats`/discipline Trader). Sinon **entrée sur repli** (MM20) ou **sur cassure** (> swing-high).
- **Stop** = sous le plus-bas de swing OU entrée − 1,5×ATR (prix concret). **PLANCHER DUR : distance
  (entrée−stop) ≥ 1,5×ATR14** — un stop plus serré est DANS LE BRUIT d'une séance normale (post-mortem
  10/07 : INTC stop 6 pts = 0,6×ATR, stop-out quasi certain sans invalidation de thèse) → élargir le
  stop ET recalculer le R/R, ou écarter. **ATR distordu** : si un gap >15 % existe dans les 90 dernières
  barres, l'ATR14 est gonflé/faussé — le dire dans le signal et raisonner le stop en % du prix.
- **Cibles** = prochaine résistance / mesure ; afficher le **% vs prix actuel**.
- **R/R** = (TP1−entrée)/(entrée−stop) **≥ 1,5** sinon « pas de R/R propre » → écarter ou reléguer en
  watch. **Le R/R AFFICHÉ dans le digest est CELUI-LÀ (TP1), jamais celui de TP2** (post-mortem 10/07 :
  HLT publié « R/R 2,0 » = TP2 alors que TP1 donnait 1,42 < 1,5 — le signal n'aurait pas dû sortir).
  Le calcul est ARITHMÉTIQUE sur les niveaux publiés, pas déclaratif : re-vérifier avant d'écrire.
- **Earnings** : `GetEarningsCalendarFiltered` + `QueryData types="calendar"` → **DROP si ±3 séances**,
  et **FLAG OBLIGATOIRE dans le signal si les earnings tombent dans l'horizon de détention** (swing
  5-10 séances : toute date ≤ J+12 se mentionne — post-mortem 10/07 : BA/HLT/CARR portaient tous
  earnings 28/07 non signalés, INTC 23/07 non signalé).
- **Dilution** : `QueryData types="sec_filings,flags"` → DROP si S-3/ATM/offering réel (cf `feedback_dilution_check`).
- **Claim de données porteur de thèse** (dark pool %, put/call, flux inhabituel) : le chiffre DOIT être
  tracé à un appel MCP de LA session (citer l'outil) — invérifiable sur le feed = la thèse tombe, le
  signal est écarté ou re-fondé sur ce qui est vérifiable (post-mortem 10/07 : INTC « dark pool 46 % »
  invérifiable, `types=dark_pool` renvoyait vide).
- **Invalidation par gap (plans conditionnels)** : tout signal publié le soir porte sa règle de gap —
  un gap adverse pré-open > 1×ATR14 qui TRAVERSE la zone d'entrée = plan **invalidé d'office** au bilan
  suivant (jamais de « limit sur repli d'ouverture » remplie dans un couteau qui tombe — post-mortem
  10/07 : INTC a gappé −2,8 % sous sa zone d'entrée 112).

### 5. Cohérence panier↔thèse (persona Strategist — avant publication)
Régime live : `GetMarketContext(facets="overview")` (régime, VIX, indices, pétrole). Réduis le panier à son **facteur net** (béta / growth-value / duration / cyclique-défensif / concentration). **BLOQUE** si :
- le **narratif contredit le book** (ex. dire « risk-off » avec un book long béta/croissance — l'incident du 2026-07-08, cf `feedback_harness_portfolio_coherence`), OU
- le book est **long le facteur exact** qu'un événement proche (CPI/Fed/pétrole) menace, sans le signaler.
Correctif : repondérer / couper les noms qui contredisent, OU corriger le narratif — thèse et positions doivent s'accorder. Flag l'événement proche + demi-taille si pertinent.

### 6. Sortie — message Telegram digest
Format (bilan J-2 accumulation → bilan J-1 swings → signaux du jour). Par signal du jour : **thèse en 1 phrase** + `▸ Achète si` (condition d'entrée) + `▸ Skip si` (invalidation) + `Stop X (−x%) · Cibles Y (+y% vs prix) / Z (+z%) · R/R`. Concis, humain, zéro tic IA (cf `EDITORIAL_STYLE.md`), finir par « Idées de trading, pas un conseil — gère ta taille ».

Gabarit HTML (émettre en `format:"html"`, alias public `alerts` ou celui demandé, sur « go » uniquement) :
```
📊 <b>Bilan &amp; signaux — [date]</b>

🕌 <b>Portefeuille accumulation ([date pose], horizon)</b>
[socle + 1 ligne/nom : % move + repli/étendu/zone d'achat]

⚡ <b>Swings du [J-1] — statut</b>
[1 ligne/nom : prix + %, verdict (marche / valide / raté / non déclenché)]

🎯 <b>Swings du jour — [régime] · [caveat événement]</b>
🟢 <b>TICKER</b> (secteur) — [thèse 1 phrase]
▸ Achète si : [condition] <b>[niveau]</b>.
▸ Skip si : [invalidation].
Stop [x] (−x %) · Cibles [y] (+y %) / [z] (+z %) · R/R [n]

⚠️ [ce qui casse le lot]
<i>Idées de trading, pas un conseil — gère ta taille.</i>
```

## Après publication (optionnel)
Loguer les signaux émis (tickers + entrées/stops/cibles + thèse + date) via `remember(workspace='dailystocks', type='project', ...)` pour que le bilan du lendemain (étape 1-2) soit automatique.

Voir aussi : skill `senior-review` (passe Strategist formelle), `aplus-setups`, `mcp-gateway-tools` (DSL screener), `scanner-pipeline`.
