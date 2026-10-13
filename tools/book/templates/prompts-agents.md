# Consignes des agents — livre et livre blanc

Gabarits éprouvés sur « Investir halal » (octobre 2026). Remplacer les variables : `{BASE}` (dossier du livre),
`{REPO}` (racine du site), `{PUBLIC}` (lecteur visé, ex. « investisseur particulier en Europe, du débutant à
l'expert »), `{SUJET}`, `{PAGES}`, `{ORDRE_CHAPITRES}` (liste numérotée réelle, vérifiée sur le sommaire). Les agents
tournent en arrière-plan et en parallèle ; chacun écrit un fichier et rend seulement chemin + compteurs.

---

## A. Inventaire des sources du site (un agent par lot d'environ 20 séries)

> You are building a research ledger for a book. Repo: {REPO} (static HTML site, French). Read data/series-catalog.json;
> take the `series` entries with index {I} to {J} inclusive. For EACH series, open its index page and EVERY chapter page
> (paths in `href`, relative to repo root). Extract from the actual text (never invent): slug | title | chapters | thesis ;
> KEY NUMBERS with exact context and period, marked "(source given: …)" or "(no source named)" ; BACKTESTS (rule, universe,
> period, result, caveats) ; TOOLS (name + what for + cost) ; MYTHS debunked ; TAKEAWAYS (short quotes) ; CASES (ticker,
> numbers, outcome) ; CONTRADICTIONS with other series of the batch. {AJOUT_THEMATIQUE}
> Write the full ledger to {BASE}/ledger-series-{K}.md. Final message: only the file path, series covered, pages read,
> pages that failed to open.

Le dernier lot couvre aussi les dossiers `series/` absents du catalogue (« hors catalogue »). Les guides `tech/` ont leur
propre lot (`data/tech-catalog.json`). Pour un livre blanc, un seul agent sur les séries du sujet suffit.

## B. Condensé par chapitre (un agent par registre de plus de 300 Ko)

> Read the whole file {BASE}/ledger-…md in sequential chunks with offset/limit until 100 % is read. Produce a CONDENSED
> digest for a book author at {BASE}/digest-….md, in French, 600-900 lines, max 1 800. Keep EXACT numbers, dates, tickers,
> names, quotes and sources; drop narrative and repetition. Organise by the book chapters that will use it: {ORDRE_CHAPITRES}.
> Last section, mandatory: « Contradictions et chiffres douteux » — everything unsourced, inconsistent, persona-based or
> internal jargon the book must not repeat. Final message: only path, line count, confirmation that 100 % was read.

Un chiffre des séries n'est jamais une preuve : il indique quoi recalculer.

---

## C. Relectures (sur book.txt balisé par page, écrit par tools/book/checks.py)

Règle commune, à recopier dans chaque consigne : *tu ne modifies AUCUN fichier du livre, tu produis un rapport.
Chaque remarque cite la page et le passage exact. Un relecteur qui ne trouve rien a mal lu ; un relecteur qui invente une
erreur est écarté. Classe BLOQUANT / MAJEUR / MINEUR, propose la correction prête à coller. Lis book.txt EN ENTIER par
tranches de 900 lignes. Message final : chemin du rapport + nombre de bloquants/majeurs/mineurs, rien d'autre.*

Fichiers communs : `{BASE}/book.txt`, `{BASE}/book.html`, `{BASE}/numbers_audit.md`, `{BASE}/bt/results.json` (clé
`tests`), `{BASE}/bt/backtests.py`, `{BASE}/data/provenance.json`, `{BASE}/refs/` le cas échéant, les `digest-*.md`.

### 1. QA senior (livre et livre blanc)
Vérifie : (1) chaque nombre vient de results.json (même valeur, même arrondi), d'une source nommée et datée, ou est
injustifié — sans source ni calcul = BLOQUANT, arrondi différent entre deux endroits = MAJEUR ; (2) cohérence interne (même
fait, deux valeurs ; renvois « chapitre N » contre l'ordre réel {ORDRE_CHAPITRES} ; sommaire contre titres et folios ;
légendes contre figures) ; (3) références citées contre les textes archivés ; (4) jargon interne interdit (« MCP »,
« Gateway », noms de scripts, « pipeline », noms de modes du site, « Time Machine ») — « DailyTickers » seul est permis ;
(5) langue, typographie française, tics d'écriture IA ; (6) résidus (« {{ », None, nan, cellules vides, mots coupés dans les
figures). Termine par un tableau des 10 chiffres les plus importants avec leur preuve (fichier + clé) ou « NON TROUVÉ ».
Rapport : `{BASE}/reviews/qa-senior.md`.

### 2. Contradicteur (livre et livre blanc)
Démonte la thèse partout où elle est fragile : période choisie (et si l'on part d'un autre sommet, ou si la décennie
suivante ressemble à 1966-1982 ou au Japon après 1990 ?) ; survivants ; devise, dividendes, frais ; échantillons minuscules
et hypothèses d'exécution des tests ; conclusions « ça ne marche pas » aussi fragiles que celles qu'elles attaquent ;
résultats simulés présentés comme réels ; « toujours / jamais / aucune preuve publiée » (cherche le contre-exemple) ;
divergences d'écoles tranchées au lieu d'être exposées ; tout ce qui sera faux à la prochaine loi de finances sans date ;
conflits d'intérêts (le document cite les carnets et séries de l'éditeur). Pour chaque faiblesse, la phrase honnête de
remplacement. Rapport : `{BASE}/reviews/contrarian.md`.

### 3. Lecteur débutant (livre ; livre blanc si le public est débutant)
« Tu n'as jamais investi, tu lis comme un enfant de 10 ans curieux. » Signale chaque mot non expliqué dans la phrase même ou
la précédente (et s'il est au glossaire), chaque phrase à relire trois fois, chaque endroit où tu ne sais pas QUOI FAIRE
(quel bouton, quel montant, quand), ce qui fait peur sans raison ou donne une fausse impression de facilité, les tableaux et
figures illisibles. Test final, OUI avec la page ou NON avec ce qui manque : {TESTS_DEBUTANT} (ex. ouvrir un compte, passer
le premier ordre en sachant quoi taper, savoir quoi faire le jour où ça baisse de 30 %). Rapport :
`{BASE}/reviews/retail-debutant.md`, score /100 de compréhension.

### 4. Lecteur intermédiaire (livre)
« Tu as déjà un portefeuille de fonds indiciels et un compte-titres, tu vis en France avec des proches en Belgique,
Allemagne, Royaume-Uni, Suisse. » Chaque chapitre t'apprend-il quelque chose de NOUVEAU et ACTIONNABLE ? Tableaux de fonds
(ISIN, frais, domicile, réplication, distribution, places et devises de cotation, encours datés ; un fonds coté aux
États-Unis n'est en général pas achetable par un particulier de l'UE) ; fiscalité par pays datée et exacte ; passage de
l'existant à la nouvelle stratégie (quoi vendre, dans quel ordre, quel impôt) ; règles de rééquilibrage cohérentes entre
chapitres ; frais de courtier et de change datés ; ce qui sera périmé dans deux ans. Termine par « 5 choses apprises » et
« 5 choses qui manquent ». Rapport : `{BASE}/reviews/retail-intermediaire.md`, score /100 d'utilité.

### 5. Lecteur expert (livre ; livre blanc si le sujet est technique)
« Tu trades en systématique, tu codes, tu connais les biais de backtest. » Relis backtests.py : le code fait-il ce que dit le
texte ? Biais d'anticipation (trade sur la clôture qui produit le signal), survivants, données figées ou ajustées, frais,
années incomplètes, nombre d'observations ; rejeux et carnets réels contre leurs sources publiées (`{REPO}/tech/track-record/`,
catalogue du moteur : cycle de vie, éligibilité au réel, coûts) ; simplifications fausses en rigueur ; chapitre technique
(fuseaux, ajustements, données révisées, droits d'usage des données, idempotence des ordres) ; tout ce qui dépend d'une
donnée du jour sans date. Termine par un tableau « chiffre du document / valeur source / écart » pour les 15 chiffres les
plus visibles. Rapport : `{BASE}/reviews/retail-expert.md`, score /100 de rigueur.

### 6. Finition design (livre et livre blanc) — agent `impeccable:impeccable-finish-reviewer`
> Review the finished build of a {PAGES}-page A4 PDF ({SUJET}, French) against {REPO}/DESIGN.md and {REPO}/PRODUCT.md.
> Report only. Build: {REPO}/tools/book/book.css (+ whitepaper.css for a white paper), {BASE}/cover.html, {BASE}/book.html,
> {BASE}/fig/*.svg, {BASE}/previews/p*.png (render more with tools/book/previews.py). Assess in order of impact: hierarchy and
> rhythm (measure in characters per line, widows, headings stranded, tables or boxes split), tables (mono right-aligned
> numbers, headers, captions), figures (fonts, printed size ≥ 8.5 pt, French number format, colour-blind-safe gains/losses),
> boxes (too many species, distinction), cover/TOC/footer legibility, accessibility (contrast ratios with numbers, size
> floors), anything that reads as an AI template. Write {BASE}/reviews/impeccable.md: ordered must-fix list (what/where,
> why, exact CSS or build change), then nice-to-have, then a one-paragraph verdict.

### 7. Conformité de la communication (livre blanc, et toute page de lancement)
« Tu es responsable conformité d'un éditeur financier européen. » Le document est une communication à caractère
promotionnel : il doit être correct, clair et non trompeur (MiFID II, art. 24(3) ; vérifier la doctrine AMF en vigueur au
moment de la relecture). Signale : bénéfice affiché sans le risque avec la même visibilité (un chiffre de rendement sans son
pire recul à côté) ; performance passée ou simulée non signalée comme telle ; période choisie pour flatter ; promesse ou mot
« garanti » ; urgence ou rareté artificielles ; témoignages ou cas présentés comme réels sans l'être ; comparaison avec un
indice ou un concurrent sur des bases différentes ; appel à l'action vers une page qui ne tient pas la promesse ; produit
non accessible au lecteur européen présenté comme achetable ; avertissements absents de la couverture ou de la dernière page.
Rapport : `{BASE}/reviews/conformite.md`.

---

## D. Après les rapports
1. Lire chaque rapport en entier ; vérifier soi-même chaque bloquant contre la source (un relecteur peut se tromper).
2. Corriger dans les sources : `python3 tools/book/ctx.py {BASE} "passage"` puis `patch.apply(...)`. Une valeur qui change
   dans un test se corrige dans backtests.py, jamais dans results.json ni dans le texte.
3. Ajouter chaque valeur périmée à `stale_strings` de book.json, rebâtir, relancer `checks.py`.
4. Si plus de 5 bloquants au total, relancer une seconde série de relectures sur la nouvelle version ; sinon, le dire au
   lecteur final (« les correctifs n'ont pas été relus une seconde fois »).
