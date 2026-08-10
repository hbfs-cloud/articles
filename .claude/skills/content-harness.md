---
name: content-harness
description: Harnais transverse OBLIGATOIRE de tout contenu publié (daily, weekly, retrospective, analyse, series, scanner). Charge la matrice de salves MCP complète (marketdata + systematic), les gates de fraîcheur anti-stale (check-freshness.js bloquant), la war room retail avant rédaction, et le panel senior-review avant publication. Trigger keywords: harness, harnais, war room, freshness, stale data, salve MCP, collecte complète, gate publication, anti-stale.
user_invocable: false
---

# Content Harness — le harnais commun des pipelines éditoriaux

Toute commande de contenu (`/daily`, `/weekly`, `/retro`, `/analyse`, `/series`, `/scanner`) exécute
CES phases dans CET ordre. Aucune n'est optionnelle sans accord explicite du user dans la session.
La performance suit la doctrine `perf-parallel-mcp` (salves parallèles, un message = N tool_use) —
elle n'assouplit AUCUN invariant.

## H0 — Preflight (bloquant)
1. `GetStatus()` (marketdata) + `GetHealth()` (systematic si le contenu touche les modes scriptés).
   Down / erreur → **MCP HARD STOP** : signaler « MCP indisponible, tâche suspendue », ne rien produire.
2. Mémoire : `get_context(query=<tâche>, workspace='dailystocks')` + fichiers `.claude/memory/` pertinents.
3. Anti-doublon : lire le JSON d'index cible (`data/<tab>.json`) AVANT toute génération.
4. Créer le manifeste `harness.json` dans le dossier de l'artefact (voir H2) — il se remplit au fil de la collecte.

## H1 — Matrice de salves MCP (la surface COMPLÈTE, pas 3 tools sur 27)
Chaque salve = un seul message, tous les appels en parallèle. Poller les jobs async via `Jobs(job_id=…)`.
`✔` = obligatoire pour ce type de contenu ; `○` = si pertinent (le sauter se justifie en une ligne dans harness.json `skipped[]`).

| Tool (marketdata) | daily | weekly | retro | analyse | series |
|---|---|---|---|---|---|
| `GetMarketContext(facets='overview')` | ✔ | ✔ | ○ | ○ | ○ |
| `GetMarketContext(facets='regime', model='ensemble', horizon_days=5)` | ✔ | ✔ | ✔ | ✔ | ○ |
| `GetEarningsCalendarFiltered(days_ahead=2..7, min_expected_move=2)` | ✔ | ✔ | ✔ | ✔ | ○ |
| `GetInsiderActivity(days=3..7)` — global ou `symbols=` | ✔ | ✔ | ○ | ✔ | ○ |
| `OptionsAnalytics(action='sentiment', symbol=…)` — term structure VIX 9D/30D/3M/6M + P/C par symbole | ✔ | ✔ | ○ | ✔ | ○ |
| `QueryData(types='quote,social_sentiment,capital_flow,trading_signals', symbols=CSV)` | ✔ | ✔ | ✔ | ✔ | ○ |
| `QueryData(types='sec_filings,flags', days=180)` — anti-dilution | ○ (trade ideas) | ○ | ✔ (sur les fills) | ✔ | ○ |
| `GetInstruments(symbols=…)` — bundle complet (quote, technicals, short interest/CTB, options OI/max pain, sentiment multi-sources, S/R) | ○ | ○ | ✔ | ✔ | ○ |
| `GetSymbolSignals(symbol=…)` | ○ | ○ | ✔ | ✔ | ○ |
| `ExplainSymbolMove(symbol=…)` — attribution des movers AVANT de raconter un mouvement | ✔ (top/bottom) | ✔ | ✔ | ✔ | ○ |
| `PortfolioRisk(action='correlation'/'sizing'/'var')` — dès qu'on présente ≥2 lignes ensemble | ✔ | ✔ | ○ | ○ | ○ |
| `RunScreener` / `RunAutoScreener` | ○ | ✔ (rotation) | ○ | ○ (pairs) | ○ |
| `ScreenOptions` — flux options inhabituels sur les dossiers du jour | ○ | ○ | ○ | ✔ | ○ |
| `WatchlistDigest()` — refresh systématique watchlist (IOVA/ALT/ALLR/EQX…) | ✔ | ✔ | ○ | ○ | ○ |
| `RunBacktest` — toute affirmation « ça marche historiquement » se teste | ○ | ○ | ✔ | ○ | ✔ (perf) |
| `GetReferentialData` | ○ | ○ | ○ | ✔ | ○ |
| WebSearch (news datées, géopolitique, SEC) | ✔ | ✔ | ○ | ✔ | ○ |

| Tool (systematic/dtx) | usage |
|---|---|
| `DtxRegime(asof)` | ✔ daily/weekly : régime moteur systematic en CONTRÔLE CROISÉ du régime marketdata — divergence > 1 cran = à mentionner |
| `DtxListConfigs` / `DtxReplay` | ✔ retro & series performance : la courbe replay est la référence, jamais un chiffre de mémoire |
| `DtxJobStatus` | poll des jobs dtx |

**Gotchas connus** : gros batch `QueryData` peut être approval-gated (-32003) en session cloud → re-tenter
en petits lots, puis basculer sur `GetMarketContext`/`GetInstruments`/press datée. `PortfolioRisk`
correlation : `symbols` = CSV string, PAS un array. Moves implicites indisponibles hors séance options →
le DIRE dans l'article, jamais l'estimer.

### ⛔ TOUTE VALEUR DATÉE SE DEMANDE AVEC SA DATE (incident weekly 20260810)
`QueryData(types='indices,commodities,currencies,rates')` **sans `end_date` renvoie le DERNIER prix**, pas
la clôture. Lancée un lundi matin pour un article qui parle de la clôture de vendredi, la salve rapporte
du live que l'on étiquette ensuite « clôture du vendredi » : le 20260810 a produit **4 inversions de signe
et une section entière bâtie sur un fait faux**, rattrapées par le panel et pas par l'auteur.

**Règle : tout chiffre publié comme daté doit être demandé borné.**
- Cours et variations d'une séance de référence → `QueryData(types='bars_daily', end_date=<clôture>)`,
  jamais `indices`/`commodities`/`quote` nus. Ces types-là ne servent qu'à dire « en ce moment ».
- Fondamentaux / dépôts / résultats point-in-time → `end_date=D` ou `GetInstruments(as_of=D)`.
- Un `timestamp` de réponse postérieur à la clôture de référence = la valeur est du live. Soit on la
  réétiquette « en séance, <heure> », soit on la recollecte bornée. Jamais on ne garde le libellé « clôture ».
- **Contrôle avant rédaction** : comparer le `timestamp` renvoyé à `reference_close` du harness. Écart de
  plus d'une séance sur une valeur présentée comme la clôture = STOP.

### ⛔ FENÊTRE D'AGRÉGAT INCONNUE = NON PUBLIABLE TEL QUEL
`performance_rotations` renvoie des agrégats secteur/industrie/thème **sans déclarer sa fenêtre**. Les
étiqueter « semaine » sans confirmation est un défaut d'intégrité (relevé le 20260810). Soit la fenêtre est
établie, soit l'agrégat est publié comme « ordre de grandeur directionnel, fenêtre non confirmée ».

## H2 — Gate de fraîcheur (bloquant, `tools/check-freshness.js`)
Chaque source collectée est tracée dans `<dossier-artefact>/harness.json` avec son `as_of` RÉEL
(timestamp renvoyé par l'appel — jamais « now », jamais arrondi).

**Le manifeste doit couvrir les faits QUI PORTENT LA THÈSE, pas seulement les cotations.** Au 20260810, le
harness déclarait 9 sources de marché pendant que l'article reposait sur les payrolls de juillet, le vote
FOMC du 29/07 et des probabilités de marchés de prédiction — aucun des trois au manifeste, alors que le
texte revendiquait « neuf sources datées et vérifiées ». Revendication invérifiable.
Règle : tout fait non trivial qui soutient une conclusion entre au harness (macro, banque centrale,
géopolitique, marchés de prédiction, recherche documentaire), OU l'article déclare explicitement qu'il
sort du périmètre contrôlé. Pas de troisième option.

Puis :
```bash
node tools/check-freshness.js <dossier>/harness.json   # exit 1 = PUBLICATION INTERDITE
```
Budgets d'âge standard (les commandes peuvent durcir, jamais assouplir sans accord user) :
| source | max_age_h |
|---|---|
| régime (ensemble + switcher + dtx) | 6 |
| cotations intraday citées comme « en ce moment » | 2 |
| clôtures de la dernière séance | 24 (72 le lundi) |
| calendrier earnings / macro | 24 |
| term structure vol, options P/C | 24 |
| insiders, short interest / CTB | 96 |
| SEC filings (anti-dilution) | 168 |
| news citées | 24 (et TOUJOURS datées dans le texte) |
`--warn-only` est INTERDIT dans un pipeline de publication. Un timestamp futur = donnée inventée = STOP.
Règle d'honnêteté : tout chiffre affiché porte son moment (« clôture mardi », « ~12h20 Paris ») — un
prix d'hier présenté comme courant est un bug bloquant même si le gate passe.

### ⛔ EMPREINTE L2 — LES FLUX INSTITUTIONNELS SONT OBLIGATOIRES, PAS OPTIONNELS
Un daily ou un weekly sans un seul flux institutionnel échoue la couche 2 d'`EDITORIAL_STYLE.md`, quelle
que soit la qualité du reste. C'est le seul contenu qu'un prompt ne peut pas reproduire, donc c'est
précisément ce qui distingue une analyse d'un commentaire. Au 20260810 : **zéro occurrence** d'intérêt
ouvert, dark pool, flux d'options ou put-call dans 13 000 mots — BLOCK.
Collecte minimale : `QueryData(types='unusual_options,dark_pool,max_pain', symbols=<les noms de la thèse>)`
+ `short_interest`/`ctb` sur les titres où la thèse porte, `OptionsAnalytics(action='sentiment')` pour la
structure de vol. Un retour vide se DÉCLARE (« flux non disponibles sur ce nom »), il ne se contourne pas.

## H3 — War room retail (AVANT rédaction, pas après)
Débat court et tracé (3-6 bullets dans la réflexion, pas dans l'article) entre trois chapeaux :
1. **Bull** — la lecture consensus des données collectées.
2. **Bear/Contrarian** — qu'est-ce qui casse la thèse ? Quel signal contredit quoi (ex. régime RISK-ON
   le jour d'un print binaire, VIX calme vs vol sectorielle) ? L'article DOIT contenir au moins une
   lecture non-consensuelle **falsifiable** (niveau/date qui l'invalide).
3. **Lecteur retail** — qu'est-ce que je FAIS avec ça ? Chaque section clé répond à « et donc ? » :
   niveau, taille, invalidation, timing. Pas de « surveiller de près » sans niveau chiffré.
Sortie de la war room = l'angle du jour + ce qu'on refuse de faire (aussi important que ce qu'on fait).

## H4 — QA locale (bloquant)
```bash
node tools/qa-content.js <artefact> --strict     # exit 1 = STOP (scanner : tools/qa-check.js)
node tools/check-ai-tells.js <artefact> --strict # tout finding = réécrire
node tools/check-freshness.js <dossier>/harness.json
```
Interdits absolus dans le texte publié : vocabulaire d'outillage interne (noms de connecteurs, scripts,
pipeline), chiffres non collectés dans LA session, caveats inventés, dates sans jour de semaine vérifié.

## H5 — Panel senior (bloquant, AVANT add_card/commit)
```
Workflow({ scriptPath: ".claude/workflows/senior-review.js",
           args: { artifacts: [{path, type, label}], applyFixes: true } })
```
Matrice personas par type : voir skill `senior-review`. **BLOCK = on ne publie pas** — corriger ou
escalader au user avec la liste blocking[]. Relancer H4 après les fixes du panel (ils modifient le fichier).

## H6 — Publication
1. `node tools/add_card.js <artefact>` (ou `publish.js`/`publish-analysis.js` selon type) — après lecture
   anti-doublon H0. Weekly/series/tech : add_card APPEND → remonter la carte en tête.
2. `data/radar.json` mis à jour (daily/weekly/scanner).
3. Commit + push `main` (fichiers explicites, jamais `git add -A`).
4. Telegram via alias (`daily`, `weekly`, `analysis`, …) en `format:"html"` (balises `<b>`, jamais `**`).
5. Compte-rendu en chat : verdict panel, gates passés, ce que la war room a écarté.

## Erreurs bloquantes (récapitulatif)
| condition | action |
|---|---|
| MCP down / auth expirée / timeout | HARD STOP, signaler, ne rien substituer |
| check-freshness exit 1 | STOP — recollecter ou reporter |
| qa-content/qa-check exit 1 | STOP — corriger |
| check-ai-tells findings | réécrire les passages |
| senior-review BLOCK | ne pas publier, escalader |
| doublon d'URL dans l'index | ne pas add_card, signaler |
| chiffre sans source de session | supprimer le chiffre ou recollecter |
| valeur « clôture » dont le timestamp est postérieur à la clôture | recollecter bornée (`bars_daily` + `end_date`) ou réétiqueter « en séance » |
| fait porteur absent du harness | l'ajouter, ou déclarer explicitement qu'il sort du périmètre contrôlé |
| zéro flux institutionnel dans un daily/weekly | recollecter (`unusual_options`, `dark_pool`, `max_pain`, `short_interest`) — empreinte L2 obligatoire |
| densité : plus de ~4 000 mots sans faits nouveaux à proportion | couper, ne JAMAIS gonfler pour franchir un seuil de taille |
