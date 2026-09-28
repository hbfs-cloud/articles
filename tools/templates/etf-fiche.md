# Template — Fiche ETF UCITS (hors harnais MCP)

Type de fiche réutilisable pour les **ETF UCITS européens** (et tout fonds indiciel hors
couverture des données marché internes). À utiliser quand le sous-jacent n'a **ni fondamentaux
société ni dépôts SEC** : le harnais de preuve « company v3 » (`analysis-v3-r07.cjs`, us-gaap /
XBRL / blast-radius de pairs) **ne s'applique pas**.

## Ce que couvre ce template
- ETF UCITS actions/obligataires/sectoriels, cotés en Europe (Euronext, Xetra, LSE, Borsa Italiana…).
- Domiciles Luxembourg / Irlande, parts capitalisantes ou distribuantes.
- Réplication physique (complète ou échantillonnée) ou synthétique (swap).

## Ce que ce template N'EST PAS
- Pas une analyse d'action US (→ commande `/analyse` + harnais company v3).
- Pas un « trade idea » : un ETF de socle se **conserve / renforce / allège**, il ne se scalpe pas.
- Aucune donnée marché interne, aucun dépôt SEC, aucune attestation d'évidence company.

## Sources autorisées (RÉELLES, datées, jamais inventées)
| Donnée | Source primaire | Notes |
|--------|-----------------|-------|
| Indice, TER, encours (AUM), réplication, distribution, domicile, devise, date de lancement, nb de composants, top 10 holdings, répartition sectorielle & pays, performances (YTD/1a/3a/depuis lancement), volatilité | **justETF** — `https://www.justetf.com/en/etf-profile.html?isin=<ISIN>` | Source gouvernante de la composition et des perfs. |
| Recoupement TER / holdings / tracking difference | **Factsheet / KIID de l'émetteur** (Amundi, iShares/BlackRock, Vanguard…) | Lien de domaine émetteur si l'URL exacte du PDF n'est pas certaine — ne pas inventer d'URL profonde. |
| Dernier cours, bornes 52 semaines, tendance | **Yahoo Finance** — `https://finance.yahoo.com/quote/<YahooTicker>/` | Repères NON certifiés en interne → caveat obligatoire dans la section Technique. |

**Règle d'or** : toute donnée absente est marquée `indisponible` (jamais estimée). Chaque section porte
au moins une `source-ref` inline datée + un bloc `source-refs` récap.

## Structure des sections (id d'ancre FAB)
1. `verdict` — Verdict express : rôle en portefeuille, pour qui, forces / à accepter, verdict clair
   (conserver / renforcer / alléger selon profil — **pas un trade**).
2. `mandat` — Mandat & indice : ce que réplique l'indice, méthodologie, nb de composants.
3. `composition` — Top 10 holdings + répartition sectorielle + répartition géographique (tables `.data-table`)
   + ECharts (barres holdings, treemap secteurs).
4. `performance` — Perf YTD/1a/3a/depuis lancement + volatilité + ECharts barres ; tracking difference si publiée.
5. `couts` — TER, réplication détaillée, distribution, domicile & fiscalité (Acc = capitalisant ; retenue à
   la source selon domicile IE/LU), prêt de titres si divulgué.
6. `technique` — Dernier cours + 52W range + position dans le canal + tendance, **caveat Yahoo non certifié**.
7. `risques` — `risk-grid` de `risk-card` : marché, change (EUR vs USD), concentration, liquidité, suivi.
8. `portefeuille` — Diversification, complémentarité, **recouvrement** (ex. VWCG ↔ MEUD quasi-jumeaux ;
   satellite tech ↔ fonds monde).
9. `sources` — Bloc récap justETF / émetteur / Yahoo + mention « données publiques, hors circuit de
   certification interne ».

## Conventions HTML (identiques aux analyses — voir `analyses/CLAUDE.md`)
- `<html lang="fr" data-tags="etf,<region>,..." data-tab="analyses" data-grade="..." data-level="intermediate">`.
- brand-bar + `/logo.svg` + brand-nav ; ticker-header **plat** avec `tm-value` AVANT `tm-label` ; FAB `fnav` ;
  footer `article-footer` ; `/assets/report.css` ; GTM-T5Z595CW ; `core.js` + `tag-renderer.js` avant `</body>` ;
  `#article-clickable-tags`.
- **Finviz interdit** (non-US) → lien vers le graphe Yahoo Finance (pas d'image Finviz).
- Header : logo MW uniquement, **jamais** de logo émetteur. Métriques ticker-header = TER, AUM, indice,
  réplication, distribution, domicile.
- Voix FR institutionnelle, concise, **zéro tic IA**, **aucun terme interne** (pas de « MCP », « Gateway »,
  noms de scripts) : décrire la donnée (« composition justETF », « bornes Yahoo »), pas l'infra.

## Générateur
- Lib : `tools/lib/etf-fiche.cjs` → `buildHtml(data)` + `buildCard(data)`. Schéma `data` documenté en tête du fichier.
- Runner : `tools/gen-etf-fiche.cjs` — porte les objets `data` sourcés des 3 ETF (MEUD, QDVE, VWCG) et écrit
  `analyses/<T>/index.html` + `data/analyses-data/<T>.json`. Ajouter un ETF = ajouter un objet `data` + le
  pousser dans `ALL`.

## Gates applicables
- `node tools/qa-content.js analyses/<T>/index.html --strict` → doit passer (0 ❌). La section « Trade Idea »
  ressort en **⚠️ (non bloquant)** : normal, un ETF n'en a pas.
- `node tools/check-ai-tells.js analyses/<T>/index.html --strict` → doit passer (0 finding).
- **Ne pas** exécuter le harnais evidence/attestation company : hors périmètre ETF.

## Carte JSON (`data/analyses-data/<T>.json`)
`meta{version,name?,date,dateDisplay,levelsCloseDate,grade,status,assetType:"etf",tags,description,ogDescription,dataScope:"public-etf-no-mcp-harness"}`
+ `header{ticker,name,isin,exchange,yahooTicker,currency,price,changePct,badges,metrics{ter,aum,index,replication,distribution,domicile}}`
+ `card{title,subtitle,logo(isin),url,chartTicker}`. Indexation landing via `add_card.js` (faite par l'orchestrateur).
