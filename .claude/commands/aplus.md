# /aplus — Setups A+ harnachés (screen → grille éliminatoire → war room → panel → publish)

Produit ou vérifie des setups **A+** via le skill **`aplus-setups`** (`.claude/skills/aplus-setups.md`, à
lire et suivre EXACTEMENT) en appliquant le skill transverse **`content-harness`**. Chaque ticker retenu
sort en `data/analyses-data/{TICKER}.json` → `tools/publish-analysis.js`. Skills compagnons :
`perf-parallel-mcp` (salves), `mcp-gateway-tools` (DSL screener), `senior-review` (panel), `aplus-setups`.

**Définition, à ne jamais relâcher** : un A+ est une confluence maximale sur 5 axes **actionnable AU COURS
ACTUEL**. Pas le plus fort mouvement, pas un beau graphique qui a déjà couru. Un A+ dont le R/R ne tient
qu'à une limite de repli non déclenchée n'est pas un A+ aujourd'hui — c'est une ligne de watchlist. Cette
erreur exacte a produit un verdict de war room « 0/10 méritaient A+ ».

## Arguments
`$ARGUMENTS`
- vide ou `screen` → construire la sélection du mois depuis un univers liquide (~10 tickers).
- `verify TICKER[,TICKER…]` → passer des tickers donnés à la grille, sans rien publier.
- `warroom TICKER[,TICKER…]` → panel contradictoire seul sur des candidats déjà notés.
- `rebuild` → refaire la série complète (remplace la cohorte du mois).
- `dry-run` / `ne publie pas` → tout sauf add_card, commit, push et Telegram.

## Phase 0 — Preflight (H0)
`date -u` ; `GetStatus()` (HARD STOP si down) ; `get_context(query='setups A+', workspace='dailystocks')` ;
lire `.claude/memory/reference_aplus_screening_and_screener_dsl.md` (leçons de war room) ; lister les
tickers DÉJÀ couverts (`ls analyses/`, cohorte du mois en cours, cohorte du mois précédent) pour ne pas
les re-proposer ; créer un manifeste `data/analyses-data/{TICKER}.harness.json` par candidat retenu.

## Phase 1 — Collecte (H1, salves parallèles — doctrine `perf-parallel-mcp`)
**Salve 1 (régime + pool)**, un seul message, tool_use en parallèle :
- `RunAutoScreener` → n'utiliser QUE `regime` / `risk_tolerance`. Ses candidats sont des hot-movers
  surachetés : les ignorer pour l'A+.
- `RunScreener` pool liquide en `force_async` → poller `Jobs(job_id)`. **Pièges DSL vérifiés** :
  `ema(close,20)` prend 2 arguments ; `abs()` n'existe pas dans `score_expr` et renvoie 0 candidat en
  SILENCE ; un `pass_expr` qui exige l'empilement des moyennes renvoie 0 — vérifier l'empilement par
  ticker, pas dans le filtre. Bande RSI **48-60** (une bande 53-67 biaise vers les titres déjà étirés).
  Post-filtrer en code : `market_cap ≥ 2-3 Md$`, retirer les tickers déjà couverts.

**Salve 2 (vérification, multi-symboles dédupés en CSV)** :
`QueryData(types='earnings_quarterly,technicals,stats,quote', symbols='A,B,C,…')` sur tous les candidats.

**Salve 3 (risque, par candidat)** :
- `QueryData(types='flags,news')` + `GetInsiderActivity`.
- **Anti-dilution** — le contrôle le plus souvent raté, 4 récidives (INDO, bon de souscription AMD,
  programme au fil de l'eau CCJ, rémunération en titres AMZN). Poser DEUX questions distinctes :
  1. *Y a-t-il eu dilution ?* → nombre d'actions dans le temps.
  2. *Y a-t-il une capacité d'émission OUVERTE ?* → programme au fil de l'eau, prospectus préalable,
     enregistrement automatique (vérifier s'il couvre les ACTIONS et pas seulement la dette),
     convertibles obligatoires, bons, rémunération en titres > 15% du CA.
  La seconde ne se lit pas dans la première. Écrire **« aucune dilution constatée »**, jamais « aucune
  dilution ». Émetteur étranger (40-F/F-10) : le filtre américain est aveugle, vérifier à la source.
- **Action sur titre en attente (leçon FOXA)** : `WebSearch "<société> acquisition merger split spinoff
  secondary"`. REJET si une opération binaire peut ouvrir un écart à travers le stop — y compris la
  société en position d'ACQUÉREUR (FOXA a perdu 17% en écart en annonçant un rachat de 22 Md$).
- **Volume anormal** : volume du jour > 3× la moyenne 50 jours, ou mouvement > 2×ATR, sans catalyseur
  bénin connu = flux informé → rétrograder ou rejeter.
- `DtxRegime` + `GetMarketContext(facets='regime')` — la note vit dans un régime.

## Phase 2 — Grille (déterministe, code local, ZÉRO appel MCP, zéro chiffre LLM)
**4 éliminatoires — absence = plafond A (88 max), aucun passe-droit** :
1. Guidance relevée explicitement au dernier trimestre (discriminant n°1 : 100% des A+ l'ont).
2. ≥ 5 dépassements de BPA consécutifs.
3. PE prévisionnel < 35× (exception UNIQUEMENT monopole mondial + croissance BPA > 25% + PEG < 2, à
   documenter — cas validé : ASML).
4. Extension EMA20 ≤ 3%.

Puis le scoring /100 pondéré (PEG 15, buyback 8, dividende 7, structure 20, R/R 15, catalyseur SEC 15).
**Exclusion automatique** : résultats dans les 10 séances → « earnings play », pas swing A+.
Modules : `tools/lib/valuation-multi.js` et `tools/lib/value-quality-board.js` (fail-closed — un intrant
manquant donne `na`, jamais une valeur estimée).

**Contrôles de cohérence obligatoires avant d'écrire la moindre ligne** :
- **Échelle de prix (leçon KLAC)** : entrée/stop/cible dans la MÊME échelle que le cours vivant. Un écart
  de ×2 ou ×10 = fractionnement, cotation non ajustée ou faute de frappe (KLAC : entrée à 2120 $ sur un
  titre à 212 $). Vérifier aussi ATR, moyennes et amplitude 52 semaines.
- **Justification du stop (leçon CCJ + AMZN, deux fois le même jour)** : si le texte dit « stop sous la
  moyenne X », COMPARER les deux nombres. Sur CCJ le stop annoncé « sous l'EMA20 » était au-dessus ;
  sur AMZN le stop « sous l'EMA50 » était 6,18 $ au-dessus. Un lecteur qui applique la consigne à la
  lettre change le R/R du simple au double.
- **Valeurs par défaut du flux** : un bêta à 1,00 avec `shortPercentOfFloat=0` est un null déguisé. Ne
  jamais construire une phrase de risque dessus — recalculer le bêta réalisé.
- **Attribution d'un mouvement** : avant d'écrire qu'une hausse ou une baisse est propre au dossier, la
  MESURER contre les pairs et le secteur sur la même fenêtre.

## Phase 3 — Gate fraîcheur + panier (H2)
`node tools/check-freshness.js data/analyses-data/{TICKER}.harness.json` par candidat (quote 24h,
financials 168h, SEC 168h, régime 6h). Exit 1 = recollecter, jamais publier.
Puis **cohérence du panier** : `PortfolioRisk(action='correlation')` sur la sélection. Viser des paris
réellement indépendants — aéronautique + compagnie aérienne à 0,70 de corrélation, c'est un seul pari
cyclique pétrole/taux. Ajuster au régime : pas de bloc cyclique à bêta élevé dans un marché neutre ou en
bascule défensive.

## Phase 4 — War room contradictoire (H3, BLOQUANTE — c'est le gate anti-sur-notation)
Panel adversarial **par ticker** via `Workflow`, 4 angles : quant / gérant / risque / vendeur à découvert.
Chacun **refait ses propres appels MCP** — ne jamais lui faire confiance sur parole, ni l'inverse.
Chaque juré vérifie les 4 éliminatoires, les 6 critères pondérés, et le score /100.
**Vote « A+ mérité » uniquement si score ≥ 92 ET les 4 éliminatoires passent.** Par défaut NON si un seul
éliminatoire échoue ou si le score est < 92. On garde A+ seulement si ≥ 3 voix sur 4 ET aucune erreur
critique. Ajouter une re-passe « candidats manqués » et une revue de corrélation du panier.

## Phase 5 — JSON + rendu
`data/analyses-data/{TICKER}.json` conforme `tools/lib/analysis-schema.json` (référence : `MATX.json`).
Chaque plan publié porte un vrai stop ET l'échelle de gestion anti-restitution : +1R → seuil ; +2R →
allègement ou trailing ; +20% latent → plancher `entrée × 1,10` ; +30% → plancher `entrée × 1,18` et
vendre 1/3 si le mouvement est vertical ; +40% → vendre 1/3 à 1/2, stop ≥ `max(stop, entrée × 1,25,
plus haute clôture × 0,85)`. Le stop ne monte que sur clôture confirmée, jamais sur mèche intraday.
Banques : métriques bancaires (marge d'intérêt, ROTCE, CET1, valeur comptable), pas marge brute/EBITDA.
Jamais de `N/A` publié ; jauge de risque 1-10. Valider : `publish-analysis.js … --dry`.

## Phase 6 — QA + panel senior (H4-H5, bloquants)
`node tools/qa-content.js <html> --strict` + `check-ai-tells --strict` + `check-freshness`, puis
senior-review `type:"analyses"` avec `artifacts:[{path, type, label}]` (**objets, pas des chaînes** —
une chaîne fait tomber le workflow à 0 agent et renvoie un PASS vide, donc faux).
BLOCK = ne pas publier. Re-passer la QA après correctifs.

⚠️ **Après le panel, NE PAS re-rendre depuis le JSON.** Le panel corrige le HTML ; `render-analysis.js`
l'écrase en silence, sans erreur ni code de sortie. Reporter d'abord ses correctifs dans le JSON source
(récupérables dans le `fixed[]` du `journal.jsonl` du workflow), puis indexer avec `add_card.js` sur le
HTML validé.

## Phase 7 — Publication (H6)
1. Par ticker : `node tools/publish-analysis.js data/analyses-data/{TICKER}.json --commit`, ou
   `--batch F1.json F2.json …`. Si le HTML porte des correctifs de panel non reportés : `add_card.js` seul.
2. `data/radar.json` mis à jour à la main (rédigé, pas mécanique) : ajouter les A+ en `opportunity`.
3. Commit fichiers explicites + push `main`.
4. Telegram alias `analysis` en `format:"html"` — registre ultra-simple, lisible par un enfant de 10 ans :
   note, niveaux, invalidation, lien `https://articles.dailytickers.com/analyses/{TICKER}/`.
5. Compte-rendu chat : combien de candidats screenés, combien ont survécu à chaque éliminatoire, verdict
   war room par ticker, ce que le panel a corrigé.

## Garde-fous (non négociables)
- **Ne jamais forcer le compte.** Si trois tickers seulement méritent A+, en publier trois. Une cohorte
  de dix dont six sont des A déguisés vaut moins que trois vrais.
- Rejets durs à mémoriser : guidance non relevée, < 5 dépassements, PE prév. > 35× sans exception
  documentée, extension > 3%, R/R valable seulement sur un repli non déclenché, programme d'émission
  actif / opération en titres / convertible obligatoire / rémunération en titres > 15% du CA,
  EMA50 < EMA200 ou moyennes plates, cours au-dessus de l'objectif moyen des analystes ou au plus haut
  après une pointe d'un jour, valorisation extrême avec croissance de BPA plate ou négative, catalyseur
  inversé par la macro, résultats dans les 10 séances.
- R/R calculé à une entrée prenable **maintenant**, à moins de 3% du cours. Sinon ce n'est pas un A+.
- MCP HARD STOP intégral : jamais de substitution, jamais d'estimation, jamais un chiffre de mémoire.
- Interdits `content-harness` : aucun vocabulaire d'outillage interne dans le contenu publié.
