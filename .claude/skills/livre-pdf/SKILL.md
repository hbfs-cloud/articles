---
name: livre-pdf
description: Méthode complète pour produire un livre PDF ou un livre blanc marketing au gabarit DailyTickers — inventaire des séries du site, backtests reproductibles, faits externes datés, rédaction lisible par un enfant de 10 ans, build HTML→PDF, contrôles automatiques, relectures adverses par agents (QA senior, contradicteur, débutant, intermédiaire, expert, design, conformité), paquet de scripts, publication dans l'onglet Séries avec bouton de téléchargement. Éprouvée sur « Investir halal, sans se raconter d'histoires » (141 p., 10 oct. 2026). Trigger keywords: livre, livre PDF, ebook, guide PDF, livre blanc, white paper, lead magnet, PDF marketing, nouvelle édition du livre, stratégies agressives, père de famille, investir halal.
version: 1.0.0
user-invocable: true
argument-hint: "[livre|livre-blanc] <sujet> — ex. « livre stratégies agressives », « livre-blanc DCA »"
---

# Livre PDF et livre blanc — méthode DailyTickers

Le kit exécutable est dans `tools/book/` et ce fichier en est le mode d'emploi. La première édition qui l'a éprouvé est
« Investir halal, sans se raconter d'histoires » : sources dans `.agent/livre-halal/` (non versionné), publication sur
`series/livre-investir-halal/`, commit 755a7dd48. Le kit reconstruit ce livre à l'identique : 141 pages, 130 signets, même
texte page par page. Chaque règle ci-dessous vient d'une erreur réellement trouvée pendant cette première édition.

## Deux formats

| | Livre | Livre blanc |
|---|---|---|
| But | Référence complète, A → Z, du débutant à l'expert | Convaincre et faire agir sur UNE idée, aimant à lecteurs |
| Taille | 90-150 pages (le premier : 141), 12-18 chapitres + annexes | 8-28 pages, 4-7 sections |
| `book.json` | `"format": "livre"` (défaut) | `"format": "livre-blanc"` |
| Structure | sommaire en deux passes, pages de partie, un chapitre par page, glossaire, annexes méthode | couverture à chiffre dominant, sections enchaînées, chiffres-chocs (`.stat`), comparaisons (`.versus`), citations, appel à l'action et quatrième de couverture (`back.html`) |
| Relectures | 1 à 6 de la liste C de `templates/prompts-agents.md` | 1, 2, le lecteur cible (3, 4 ou 5), 6 et 7 (conformité) |
| Paquet de scripts | oui (ZIP sur la page) | facultatif ; la méthode tient en une page |

Un livre blanc peut se tirer d'un livre : même `results.json`, on garde les 3 à 5 résultats les plus forts.

## Non négociables

1. **Aucun chiffre de test écrit à la main.** Tout rendement, recul, probabilité ou compte de séances sort de
   `bt/results.json` par `{{bt:chemin|format}}`. Un chiffre externe porte sa source et sa date dans la phrase. Une règle de
   conduite qui n'a pas été testée est présentée comme une règle d'expérience. Le contradicteur a bloqué « chaque règle a
   été testée » sur la couverture : c'était faux.
2. **Les chiffres des séries du site ne sont pas des preuves.** Ils disent quoi recalculer. Erreurs reprises des sources
   puis corrigées dans le livre halal : MSCI World Islamic 2010-2020, le seuil AAOIFI (30 % de la capitalisation, pas des
   actifs), des tickers inversés, un nisab périmé, LVMH (7 % de vins et spiritueux, pas 10-15 %), et les « réels » de
   l'incident IA de juin 2026, faux 6 fois sur 7.
3. **Aucun terme interne** dans le PDF ni dans sa page de présentation : MCP, Gateway, pipeline, noms de scripts ou
   d'outils, noms de modes (Turbo, Dynamic, Balanced, Fortress, DTX…). `checks.py` bloque. On décrit la donnée (« le
   catalogue de notre moteur systématique »), jamais l'infrastructure.
4. **Lisible par un enfant de 10 ans, utile à un expert.** Chaque mot technique est expliqué dans la phrase où il
   apparaît, puis repris au glossaire. Les phrases font moins de 40 mots. Chaque chapitre a son résumé en tête et son
   « que retenir » à la fin. Les passages pour experts vont dans `.expert`.
5. **Tout ce qui périme est daté** : fiscalité, frais, encours, prix de l'or, nisab, tarifs d'outils, capacités de l'IA,
   avec « au JJ mois AAAA ». Le livre doit rester vrai dans deux ans ou dire ce qui aura bougé.
6. **Pas de « toujours / jamais / aucune preuve publiée » sans avoir cherché le contre-exemple.** Le livre halal disait
   « aucun gérant halal actif n'a battu son indice » : faux, Amana Growth l'a fait sur dix ans.
7. **Les divergences sont exposées, pas tranchées** : écoles juridiques, méthodes de calcul, positions d'experts. On
   renvoie vers un référent et on dit qui est ce référent.
8. **Les relectures sont décrites telles qu'elles ont eu lieu** : « relectures adverses par agents d'IA », jamais
   « cinq relecteurs indépendants ».
9. **Données** : règle MCP HARD STOP et contrat de date de `CLAUDE.md`. Jamais de prix de mémoire. Le web sert aux
   sources officielles, et chaque fait web est daté.
10. **Livre blanc = communication promotionnelle** : correcte, claire et non trompeuse. Chaque bénéfice chiffré est
    accompagné de son revers avec la même visibilité (rendement ET pire recul). On signale les performances passées et
    simulées, on ne promet rien et on n'invente ni urgence ni témoignage. L'appel à l'action pointe vers une page qui
    existe et tient la promesse. Voir la relecture 7.

## Cahier des charges type (demande d'origine, à reprendre au cadrage)

Livre de A à Z, avec images, illustrations, cas pratiques et outils gratuits. Tout ce qui est affirmé est backtesté, avec
les vrais chiffres de ce qu'on peut espérer. Le livre est concis et actionnable, utilisable du débutant à l'expert en
trading systématique. Il démonte les mythes. Chaque chapitre a un résumé au début et un « que retenir » à la fin. Le
premier chapitre porte sur le bon sens, un chapitre traite de l'usage de l'IA et un chapitre technique final explique les
outils. Le style est moderne, conforme à la charte du site (plugin impeccable), et le livre se situe au niveau d'un
« 5 étoiles sur Amazon, indémontable ». Il ne fait pas 300 pages et reste valable dans deux ans.

Côté relectures, la demande prévoit un contradicteur, une war room retail (débutant, intermédiaire, expert) et un QA
senior.

## Déroulé

### 0. Cadrage (avant tout appel de données)
- Dossier de travail `.agent/<slug>/` (copie durable) ou le scratchpad, puis `book.json` à partir de
  `tools/book/templates/book.json.example`. Fixer : format, public, promesse en une phrase, cible de pages, plan numéroté.
- Plan type d'un livre : lire ce livre (front) → bon sens → fondamentaux du sujet → mythes → vrais chiffres → reculs →
  frais et fiscalité → mise en œuvre (produits, portefeuille, courtier, ordres) → approfondissements → IA → outils →
  technique → annexes (liste de contrôle, références, méthode, glossaire).
- Fiche des personnages des cas pratiques (prénom, âge, pays, montants). Le relecteur intermédiaire a trouvé un « Karim »
  avec deux portefeuilles différents.
- Demander à l'utilisateur seulement ce qui change le livre : public confessionnel ou non, pays couverts, format.

### 1. Inventaire des sources du site
Lancer en parallèle et en arrière-plan un agent par lot d'environ 20 séries, plus un pour `tech/` (consigne A). Chaque
lot écrit `ledger-*.md`. Ensuite, un agent de condensé par registre de plus de 300 Ko (consigne B) écrit `digest-*.md`,
organisé par chapitre du plan, avec une section finale « contradictions et chiffres douteux ». Pendant ce temps, on
écrit les chapitres fondés sur ses propres tests.

### 2. Données et tests (`bt/`)
- Cours : yfinance `auto_adjust=True` vers `data/*.csv` + `data/provenance.json` (série, nom, première et dernière date,
  lignes, date d'extraction). Prix du jour, or, change : MCP `QueryData` avec `end_date`. Rejeux de stratégies du moteur :
  `DtxReplay` + `DtxCatalog`, en citant le cycle de vie, l'éligibilité au réel et les coûts, avec `request_id`. Un rejeu
  n'est jamais présenté comme un résultat réel. Les carnets scellés se citent depuis `tech/track-record/` et
  `data/invalid-cohorts.json` (le livre halal attribuait six trades à la mauvaise stratégie).
- Un seul script, `bt/backtests.py`, qui importe `tools/book/stats.py` et écrit TOUTES les clés de `results.json`. Ses
  8 règles de méthode sont en tête de `stats.py` :
  - exécution à la séance suivante ;
  - années civiles complètes ;
  - √252 contre √365 ;
  - recul avec ses dates ;
  - cours figés détectés par `stale_runs` (la réparation de la ligne USD de Londres a fait passer le pire recul de
    −47,6 % à −50,1 %) ;
  - frais explicites ;
  - aucune clé ajoutée à la main ;
  - `diff_results` après chaque changement, puis relecture des phrases concernées.
- Figures : `bt/charts.py` (matplotlib) et `bt/diagrams.py` (SVG pur) avec `tools/book/frfig.py`. Toutes sont relancées
  à chaque build. Aucune figure faite hors script : quatre figures de la première édition ont dû être reprises pour être reproductibles.

### 3. Faits externes, datés et archivés
- **Fiscalité par pays**, à vérifier à la source au moment d'écrire, car elle change chaque loi de finances. Exemples
  vérifiés le 10 octobre 2026 : en France, PFU 31,4 % et prélèvements sociaux 18,6 % depuis la LFSS 2026 ; en Belgique,
  TOB à 1,32 % pour un fonds capitalisant enregistré (la règle était inversée dans le premier jet). Dater chaque taux.
- **Fonds** : justETF et la fiche émetteur. Relever le nom exact, l'indice, le TER, l'encours avec sa date, la
  réplication, la distribution et les lignes cotées en euros. Ne jamais présenter comme achetable un fonds américain sans
  document d'informations clés.
- **Courtiers** : site officiel, page tarifs, avec la date. Saxo n'a pas de droits de garde, le premier jet disait
  l'inverse.
- **Études** (AMF, ESMA, SPIVA, Morningstar, articles académiques) : chiffre exact, année, lien. Une étude citée de
  mémoire est une étude à revérifier.
- **Textes religieux** (si le public l'exige) :
  - archiver le texte source dans `refs/`. Hadiths : sunnah.com via `urllib` avec un User-Agent de navigateur, car
    WebFetch renvoie 403. Coran : `api.quran.com` v4, traduction 31 (Hamidullah) ;
  - n'afficher que la parole, sans la chaîne de transmission ;
  - vérifier l'arabe par sous-chaîne normalisée, sans diacritiques ni ponctuation ;
  - dans l'annexe, séparer les textes cités dans le livre des repères complémentaires.

### 4. Rédaction (`chapters/NN-slug.html`)
Modèles : `templates/chapter-example.html` pour un livre, `templates/section-livre-blanc-example.html` pour un livre
blanc. Encadrés : `.resume`, `.retenir`, `.cas` (avec `.steps`), `.mythe` (avec `.verdict` chiffré), `.outil`,
`.attention`, `.expert`, `.note-islam`, `.kpis`, `.check`. Pour le livre blanc : `.stat`, `.versus`, `.pull`, `.cta`.

Les renvois « chapitre N » se vérifient sur le sommaire final. La voix suit `EDITORIAL_STYLE.md` : un point de vue,
des faits que seul quelqu'un qui a creusé peut écrire, aucun tic d'IA. Le débutant doit pouvoir agir avec le seul
livre : ouvrir un compte, savoir quoi taper, savoir quoi faire quand le marché baisse de 30 %.

### 5. Build et contrôles automatiques (à chaque itération)
```bash
python3 tools/book/build.py <dossier> --pdf          # réseau requis (Google Fonts) : dangerouslyDisableSandbox
python3 tools/book/checks.py <dossier> [--strict]     # écrit book.txt, numbers_audit.md, checks-report.json
python3 tools/book/previews.py <dossier>/book.pdf     # puis Read sur previews/p*.png
```
`checks.py` bloque sur :
- le jargon interne, les accolades, `None`/`nan`, les balises imprimées ;
- les entrées du sommaire sans page ;
- un PDF réduit par Chromium (plus de texte courant à 11 pt), la police Times ;
- les valeurs périmées de `stale_strings`, l'absence d'avertissement « pas un conseil » (et, pour un livre blanc, des
  mentions de performances passées et de perte en capital) ;
- les tics d'IA (`tools/check-ai-tells.js --strict`).

Il signale en MAJEUR :
- les termes non expliqués ;
- le texte de figure sous 8,5 pt à l'impression, les couleurs de texte sous 4,5:1 ;
- les pages presque vides en milieu de chapitre, une mesure hors de 65-90 caractères ;
- une taille hors cible.

`--strict` rend les MAJEURS bloquants : c'est l'exigence avant publication.

### 6. Relectures adverses (agents en parallèle, en arrière-plan)
Consignes C1 à C7 de `tools/book/templates/prompts-agents.md`. Elles portent sur `book.txt`, que relit `checks.py`.
Ensuite, appliquer la procédure D :
1. vérifier soi-même chaque bloquant ;
2. corriger avec `ctx.py` puis `patch.py`, ou dans `backtests.py` si c'est un chiffre ;
3. ajouter les valeurs remplacées à `stale_strings` ;
4. rebâtir et relancer les contrôles.

Si les agents tombent sur une limite d'usage, les relancer : ils ne reprennent pas seuls. Sur le premier livre, les cinq
relectures ont rendu 30 bloquants (QA 7, contradicteur 7, débutant 5, intermédiaire 6, expert 5) et plus de 100 majeurs. Une
seule passe ne suffit pas, c'est normal.

### 7. Finition design
Lancer l'agent `impeccable:impeccable-finish-reviewer` avec la consigne C6. `book.css` intègre déjà ses 12 correctifs
de la première édition :
- mesure de 86 caractères (marges 20/26/22/28 mm, 11 pt) ;
- sommaire avec folios, en deux passes ;
- pied de page en police système 8,6 pt (Chromium ne charge pas les polices web dans le pied : sinon, Times 5,6 pt) ;
- tableaux sécables avec en-tête répété ;
- diagrammes coupés sur les mots ;
- chiffres français dans les figures ;
- couleurs de texte AA ;
- plancher de 8,6 pt ;
- `<sup>` des traductions retirés ;
- encadrés distincts ;
- numéros de chapitre serif 30 pt ;
- `th.num` en Inter.

Ne jamais remettre `white-space: nowrap` sur les cellules : un tableau trop large fait réduire TOUTES les pages par
Chromium (126 pages tombées à 80).

### 8. Paquet reproductible (livre)
`<slug>-scripts.zip` contient :
- `telecharger.py`, avec la date de fin = lendemain de l'extraction ;
- le script de réparation ;
- `backtests.py` et `results.json` ;
- `provenance.json` et le détail des corrections ;
- un `LISEZMOI.txt` : comment refaire, pourquoi les chiffres peuvent bouger un peu (dividendes réajustés, crypto qui
  cote le week-end), droits d'usage des données.

Tester dans un dossier vide et comparer tous les résultats avec ceux du livre avant de publier.

### 9. Publication
1. **Page de présentation.** `series/<slug>/index.html` sur le modèle de `series/livre-investir-halal/index.html`
   (conventions HTML de `CLAUDE.md`), avec les balises :
   - `<meta name="dt:kind" content="Livre">` (ou « Livre blanc ») ;
   - `dt:download` vers `/series/<slug>/<fichier>.pdf` ;
   - `dt:download-label` (« Télécharger le PDF · N pages ») ;
   - `dt:download-meta`.

   `tools/gen-series-catalog.js` lit ces balises et la carte de l'onglet Séries affiche le bouton.
2. **Couverture.** `couverture.png` = page 1 du PDF rendue avec PyMuPDF.
3. **Mise à jour** : nombre de pages et chiffres clés de la page, recoupés avec `results.json`.
4. **Contrôles** : `node tools/qa-content.js <page> --strict`, puis `node tools/check-ai-tells.js <page> --strict`.
5. **Indexation** : lire `data/series.json`, puis `node tools/add_card.js series/<slug>/index.html`,
   `node tools/gen-series-catalog.js`, `node tools/test-publication-catalogs.js`.
6. **Rendu local** de la page et de `?tab=series`, sur ordinateur et sur mobile.
7. **Commit des seuls fichiers concernés, puis push.** En cas de refus SSH, passer en HTTPS.
8. **Vérification en ligne : attendre la FIN du déploiement Pages avant toute requête sur le PDF.** Une requête
   prématurée met un 404 en cache Cloudflare pendant environ 10 minutes. Contrôler avec `?nc=1`, puis comparer octet par
   octet avec `cmp`.
9. **Telegram** : alias `learning` pour les séries pédagogiques (vérifier l'alias), en français, HTML, texte seul et
   autosuffisant.
   **Substack** : en anglais, sans aucun lien vers le site.
10. **Mémoire** : double écriture (`.claude/memory/` + MCP memory), avec ce qui a été publié et ce qui reste ouvert.

## Livre blanc : écrire pour convaincre sans tromper
- **Arc** : problème chiffré qui concerne le lecteur → idée reçue démontée par un test → preuve → limite → méthode en
  étapes → passage à l'action. Une idée par section, un chiffre qui l'ouvre, sa limite juste dessous.
- **Couverture** (`templates/cover-livre-blanc.html`) :
  - un titre qui nomme le bénéfice, un sous-titre qui dit comment c'est prouvé ;
  - un chiffre dominant tiré de `results.json`, avec sa source et son revers ;
  - les avertissements.
- **Quatrième** (`templates/back-livre-blanc.html`) : un seul appel à l'action vers une page gratuite qui existe, qui
  est DailyTickers, et l'avertissement complet (perte en capital, performances passées et simulées, date des données).
- **Interdits** : « garanti », période choisie sans le dire, comparaison sur des bases différentes, faux compte à
  rebours, « places limitées », témoignage inventé, capture d'écran de gains, produit non accessible présenté comme
  achetable.
- **Distribution** : page de présentation avec téléchargement, carte Séries, Telegram et une note Substack anglaise
  autonome. Pas de collecte d'email sans dispositif conforme existant.

## Angles par thème (à confirmer au cadrage)
- **Stratégies agressives** : levier et risque de ruine (calcul et simulation), concentration et momentum, distribution
  des reculs, nombre d'observations, survivants, coûts et glissement, fiscalité du court terme. Mettre côte à côte les
  rejeux et les carnets scellés réels, et citer les études AMF/ESMA sur les pertes des particuliers. Le lecteur expert
  et le contradicteur pèsent le plus (« ça marche sur la période choisie »). Si le public est musulman : levier, vente à
  découvert et options sont exclus par la norme AAOIFI 21.
- **Stratégies de père de famille** : versements réguliers, allocation par horizon, enveloppes, frais sur 25 ans, risque
  de séquence, règles de rééquilibrage identiques d'un chapitre à l'autre, phase de retrait, comportement dans les
  baisses. Le lecteur intermédiaire et le débutant pèsent le plus. La migration depuis l'existant doit être traitée.

## Pièges connus

| Symptôme | Cause | Parade |
|---|---|---|
| `KeyError` sur `{{bt:series.ISDW.L…}}` | point dans la clé | `lookup()` recolle les segments (déjà dans build.py) |
| `refs/hadith_matn.json` manquant | script d'annexe pas lancé | lancer le générateur des références AVANT build.py |
| PDF de 126 → 80 pages, corps à 8 pt | tableau en `nowrap` plus large que la page | checks.py le bloque ; retirer le `nowrap` |
| Sommaire décalé d'une page | couverture comptée | couverture rendue à part (build.py) |
| Pied de page en Times 5,6 pt | polices web absentes du pied | police système 11,5 px (build.py) |
| `<sup foot_note…>` imprimé | balise échappée dans la traduction | regex SUP (build.py) |
| Mots coupés, texte 7 pt dans les schémas | coupe par caractères, viewBox 680 | `frfig.wrap`, viewBox ≤ 520 ou corps ≥ 13 unités |
| « 47.6 », « Nov » dans les figures | texte vectorisé en chemins | `svg.fonttype = "none"` (frfig.style) ; build francise |
| Pire recul « novembre 2008 » | cours figés de Londres | `stale_runs` + réparation documentée |
| Livre ≠ paquet de scripts | clés ajoutées à la main dans results.json | tout dans backtests.py, test en dossier vide |
| Chiffre périmé qui survit à la correction | cité à plusieurs endroits | `stale_strings` + checks.py sur le texte du PDF |
| Agents de relecture morts en route | limite d'usage | les relancer (v2) ; ils ne reprennent pas seuls |
| PDF en 404 après le push | requête avant la fin du déploiement, 404 en cache CDN | attendre le déploiement ; vérifier avec `?nc=` |
| Numéro de section seul en bas de page (livre blanc) | coupure dans le `h1` | `break-inside: avoid` (whitepaper.css) |

## Le kit `tools/book/`
| Fichier | Rôle |
|---|---|
| `build.py` | chapitres → `book.html` → `book.pdf`, sommaire en deux passes, couverture et quatrième, signets, `build-report.json` |
| `book.css` / `whitepaper.css` | charte du livre (revue impeccable intégrée) / surcouche du livre blanc |
| `checks.py` | contrôles automatiques + `book.txt` pour les relecteurs + `numbers_audit.md` |
| `previews.py` | aperçus PNG pour le contrôle visuel |
| `stats.py` | briques de backtest et 8 règles de méthode |
| `frfig.py` | style des graphiques, chiffres français, schémas SVG lisibles |
| `ctx.py`, `patch.py` | appliquer une relecture : contexte exact, puis remplacement unique et vérifié |
| `templates/` | `book.json.example`, couvertures, quatrième, chapitre et section types, consignes des agents |
