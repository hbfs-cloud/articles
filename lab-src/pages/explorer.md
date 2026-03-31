---
title: Explorateur d'Actions
description: Filtrez et explorez les plus grandes capitalisations boursieres par secteur, region, valorisation et metriques cles
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour DailyTickers</a>

<!-- ============================================================ -->
<!-- STATIC QUERIES (no ${inputs}) - pre-rendered with all data   -->
<!-- ============================================================ -->

```sql all_stocks
select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
order by market_cap desc
```

```sql static_count
select count(*) as total from market.stocks
```

```sql static_avg_pe
select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where pe_forward is not null and pe_forward > 0
```

```sql static_total_mcap
select sum(market_cap) as total_mcap from market.stocks
```

```sql static_avg_div
select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where dividend_yield is not null and dividend_yield > 0
```

```sql static_avg_beta
select round(avg(beta), 2) as avg_beta
from market.stocks
where beta is not null
```

```sql static_median_pe
select round(median(pe_forward), 1) as median_pe
from market.stocks
where pe_forward is not null and pe_forward > 0
```

```sql bubble_all
select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and change_pct is not null
```

```sql pe_distribution
select
    case
        when pe_forward < 10 then '0-10'
        when pe_forward < 20 then '10-20'
        when pe_forward < 30 then '20-30'
        when pe_forward < 40 then '30-40'
        when pe_forward < 50 then '40-50'
        when pe_forward < 75 then '50-75'
        when pe_forward < 100 then '75-100'
        else '100+'
    end as pe_range,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null and pe_forward > 0
group by 1
order by
    case
        when pe_forward < 10 then 1
        when pe_forward < 20 then 2
        when pe_forward < 30 then 3
        when pe_forward < 40 then 4
        when pe_forward < 50 then 5
        when pe_forward < 75 then 6
        when pe_forward < 100 then 7
        else 8
    end
```

```sql top20_mcap
select
    symbol,
    name,
    market_cap,
    region,
    sector
from market.stocks
order by market_cap desc
limit 20
```

```sql top20_volume
select
    symbol,
    name,
    volume,
    price,
    change_pct,
    market_cap,
    sector
from market.stocks
where volume is not null and volume > 0
order by volume desc
limit 20
```

```sql reco_breakdown
select
    recommendation,
    count(*) as nb_stocks
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by nb_stocks desc
```

```sql top_gainers
select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct desc
limit 10
```

```sql top_losers
select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct asc
limit 10
```

```sql sector_mcap_treemap
select
    sector,
    sum(market_cap) as total_mcap,
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
group by sector
order by total_mcap desc
```

```sql region_breakdown
select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
group by region
order by total_mcap desc
```

```sql high_dividend
select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 15
```

```sql pe_vs_growth
select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null and pe_forward > 0 and pe_forward < 200
  and revenue_growth is not null
```

```sql beta_distribution
select
    case
        when beta < 0.5 then '< 0.5 (Defensif)'
        when beta < 0.8 then '0.5-0.8 (Faible)'
        when beta < 1.0 then '0.8-1.0 (Modere)'
        when beta < 1.2 then '1.0-1.2 (Marche)'
        when beta < 1.5 then '1.2-1.5 (Eleve)'
        else '> 1.5 (Agressif)'
    end as beta_range,
    count(*) as nb_stocks
from market.stocks
where beta is not null
group by 1
order by
    case
        when beta < 0.5 then 1
        when beta < 0.8 then 2
        when beta < 1.0 then 3
        when beta < 1.2 then 4
        when beta < 1.5 then 5
        else 6
    end
```

```sql upside_potential
select
    symbol,
    name,
    price,
    target_price,
    round((target_price - price) / price * 100, 1) as upside_pct,
    recommendation,
    pe_forward,
    sector,
    region
from market.stocks
where target_price is not null and price is not null and price > 0
order by upside_pct desc
limit 20
```

<!-- ============================================================ -->
<!-- FILTERED QUERIES (use ${inputs}) - for interactive tab       -->
<!-- ============================================================ -->

```sql sector_list
select distinct sector as value, sector as label
from market.stocks
order by sector
```

```sql filtered_stocks
select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
order by market_cap desc
```

```sql filtered_count
select count(*) as nb
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
```

```sql filtered_avg_pe
select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
```

```sql filtered_total_mcap
select sum(market_cap) as total_mcap
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
```

```sql filtered_avg_div
select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and dividend_yield is not null and dividend_yield > 0
```

```sql filtered_avg_change
select round(avg(change_pct), 2) as avg_change
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and change_pct is not null
```

```sql filtered_bubble
select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider})
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
  and change_pct is not null
```

```sql filtered_sector_breakdown
select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${inputs.sector_dd.value}' or '${inputs.sector_dd.value}' = '%')
  and (region like '${inputs.region_bg.value}' or '${inputs.region_bg.value}' = '%')
  and (pe_forward <= ${inputs.pe_slider} or pe_forward is null)
  and (market_cap >= ${inputs.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${inputs.div_slider} or (${inputs.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
group by sector
order by total_mcap desc
```

```sql search_results
SELECT symbol, name, price, change_pct, market_cap, pe_forward, dividend_yield, sector, region, country
FROM market.stocks
ORDER BY ${inputs.search_input.search('symbol')}
LIMIT 20
```

# Explorateur d'Actions

<Alert status=info>
Centre de commande pour explorer {static_count[0].total} actions dans 11 secteurs et 3 zones geographiques. Les onglets <b>Vue Globale</b> et <b>Classements</b> affichent des donnees statiques pre-rendues. L'onglet <b>Filtrage Interactif</b> permet de filtrer dynamiquement avec 6 criteres. L'onglet <b>Recherche</b> permet de trouver un titre par symbole.
</Alert>

## Metriques Globales

<BigValue data={static_count} value=total title="Actions Couvertes" />
<BigValue data={static_total_mcap} value=total_mcap title="Capitalisation Totale" fmt=usd />
<BigValue data={static_avg_pe} value=avg_pe title="P/E Forward Moyen" />
<BigValue data={static_median_pe} value=median_pe title="P/E Forward Median" />
<BigValue data={static_avg_div} value=avg_div title="Div. Yield Moyen (%)" />
<BigValue data={static_avg_beta} value=avg_beta title="Beta Moyen" />

<Tabs>
    <Tab label="Vue Globale">

## Nuage de Points : P/E Forward vs Variation Journaliere

_Chaque bulle represente une action. La taille reflete la capitalisation boursiere. La couleur distingue les regions._

<BubbleChart
    data={bubble_all}
    x=pe_forward
    y=change_pct
    size=market_cap
    series=region
    xAxisTitle="P/E Forward"
    yAxisTitle="Variation du Jour (%)"
    title="P/E Forward vs Performance — Toutes les Actions"
    tooltipTitle=symbol
/>

## Distribution des P/E Forward

_Combien d'actions se trouvent dans chaque tranche de P/E ? La majorite des grandes capitalisations se concentrent entre 10x et 40x les benefices._

<BarChart
    data={pe_distribution}
    x=pe_range
    y=nb_stocks
    xAxisTitle="Tranche P/E Forward"
    yAxisTitle="Nombre d'Actions"
    title="Distribution des P/E Forward"
    sort=false
/>

## Top 20 Capitalisations Mondiales

<BarChart
    data={top20_mcap}
    x=symbol
    y=market_cap
    series=region
    xAxisTitle="Ticker"
    yAxisTitle="Capitalisation ($)"
    title="Top 20 par Capitalisation Boursiere"
    fmt=usd
    sort=false
/>

## Capitalisation par Secteur

<BarChart
    data={sector_mcap_treemap}
    x=sector
    y=total_mcap
    title="Poids des Secteurs (Capitalisation Totale)"
    fmt=usd
    swapXY=true
    sort=false
/>

## Repartition par Region

<DataTable data={region_breakdown} rows=5>
    <Column id=region title="Region" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Forward Moy." fmt=num1 />
    <Column id=avg_div title="Div Yield Moy. (%)" fmt=num2 />
</DataTable>

## Distribution du Beta

_Le beta mesure la sensibilite d'une action au marche. Un beta superieur a 1 amplifie les mouvements, un beta inferieur a 1 les amortit._

<BarChart
    data={beta_distribution}
    x=beta_range
    y=nb_stocks
    xAxisTitle="Tranche de Beta"
    yAxisTitle="Nombre d'Actions"
    title="Distribution du Beta — Profil de Risque du Portefeuille"
    sort=false
/>

## P/E Forward vs Croissance du CA

_Les actions en haut a gauche (faible P/E, forte croissance) representent potentiellement les meilleures opportunites PEG._

<BubbleChart
    data={pe_vs_growth}
    x=pe_forward
    y=revenue_growth
    size=market_cap
    series=sector
    xAxisTitle="P/E Forward"
    yAxisTitle="Croissance CA (%)"
    title="Valorisation vs Croissance"
    tooltipTitle=symbol
/>

## Catalogue Complet — {static_count[0].total} Actions

<DownloadData data={all_stocks} queryName="market_stocks_all" />

<DataTable data={all_stocks} search=true rows=25>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num1 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=pe_trailing title="P/E Trail" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=beta title="Beta" fmt=num2 />
    <Column id=price_to_book title="P/Book" fmt=num1 />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=target_price title="Target" fmt=usd />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
    <Column id=country title="Pays" />
</DataTable>

    </Tab>
    <Tab label="Classements">

## Top 10 Hausses du Jour

<DataTable data={top_gainers} rows=10>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Variation %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

## Top 10 Baisses du Jour

<DataTable data={top_losers} rows=10>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Variation %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

## Top 20 Volumes Echanges

<BarChart
    data={top20_volume}
    x=symbol
    y=volume
    xAxisTitle="Ticker"
    yAxisTitle="Volume"
    title="Top 20 par Volume d'Echanges"
    sort=false
    fmt=#,##0
/>

<DataTable data={top20_volume} rows=20>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=sector title="Secteur" />
</DataTable>

## Recommandations Analystes

_Repartition des recommandations des analystes sell-side sur l'univers couvert._

<BarChart
    data={reco_breakdown}
    x=recommendation
    y=nb_stocks
    xAxisTitle="Recommandation"
    yAxisTitle="Nombre d'Actions"
    title="Repartition des Recommandations Analystes"
    sort=false
/>

<DataTable data={reco_breakdown} rows=10>
    <Column id=recommendation title="Recommandation" />
    <Column id=nb_stocks title="Nombre d'Actions" />
</DataTable>

## Top 15 Rendements en Dividende

<BarChart
    data={high_dividend}
    x=symbol
    y=dividend_yield
    xAxisTitle="Ticker"
    yAxisTitle="Dividend Yield (%)"
    title="Top 15 — Meilleurs Rendements en Dividende"
    sort=false
/>

<DataTable data={high_dividend} rows=15>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=dividend_yield title="Div. Yield %" fmt=num2 />
    <Column id=price title="Prix" fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

## Top 20 Potentiel de Hausse (vs Target Analystes)

_Ecart entre le prix actuel et l'objectif de cours consensus des analystes._

<BarChart
    data={upside_potential}
    x=symbol
    y=upside_pct
    xAxisTitle="Ticker"
    yAxisTitle="Potentiel de Hausse (%)"
    title="Top 20 — Plus Fort Potentiel de Hausse"
    sort=false
/>

<DataTable data={upside_potential} rows=20>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix Actuel" fmt=usd />
    <Column id=target_price title="Target Analystes" fmt=usd />
    <Column id=upside_pct title="Potentiel (%)" fmt=num1 />
    <Column id=recommendation title="Reco." />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

    </Tab>
    <Tab label="Filtrage Interactif">

_Utilisez les 6 filtres ci-dessous pour affiner votre selection. Le tableau, les graphiques et les metriques se mettent a jour en temps reel._

<Dropdown name=sector_dd title="Secteur" defaultValue="%">
    <DropdownOption value="%" valueLabel="Tous les secteurs" />
    {#each sector_list as row}
        <DropdownOption value={row.value} valueLabel={row.label} />
    {/each}
</Dropdown>

<ButtonGroup name=region_bg title="Region" defaultValue="%">
    <ButtonGroupItem valueLabel="Toutes" value="%" default />
    <ButtonGroupItem valueLabel="US" value="US" />
    <ButtonGroupItem valueLabel="Europe" value="Europe" />
    <ButtonGroupItem valueLabel="Asie" value="Asia" />
</ButtonGroup>

<Slider name=pe_slider title="P/E Forward Maximum" min=0 max=200 step=5 defaultValue=200 />

<Slider name=mcap_slider title="Capitalisation Minimum ($)" min=0 max=2000000000000 step=50000000000 fmt=usd0 defaultValue=0 />

<Slider name=div_slider title="Dividend Yield Minimum (%)" min=0 max=10 step=0.5 defaultValue=0 />

### Synthese de la Selection Filtree

<BigValue data={filtered_count} value=nb title="Actions" emptySet="pass" />
<BigValue data={filtered_total_mcap} value=total_mcap title="Cap. Totale" fmt=usd emptySet="pass" />
<BigValue data={filtered_avg_pe} value=avg_pe title="P/E Forward Moy." emptySet="pass" />
<BigValue data={filtered_avg_div} value=avg_div title="Div. Yield Moy. (%)" emptySet="pass" />
<BigValue data={filtered_avg_change} value=avg_change title="Var. Moy. (%)" emptySet="pass" />

### Nuage de Points Filtre

<BubbleChart
    data={filtered_bubble}
    x=pe_forward
    y=change_pct
    size=market_cap
    series=region
    xAxisTitle="P/E Forward"
    yAxisTitle="Variation du Jour (%)"
    title="P/E Forward vs Performance — Selection Filtree"
    tooltipTitle=symbol
    emptySet="pass"
/>

### Repartition Sectorielle (Selection Filtree)

<BarChart
    data={filtered_sector_breakdown}
    x=sector
    y=total_mcap
    title="Capitalisation par Secteur — Selection Filtree"
    fmt=usd
    swapXY=true
    sort=false
    emptySet="pass"
/>

### Tableau Detaille — Selection Filtree

<DownloadData data={filtered_stocks} queryName="filtered_stocks_export" emptySet="pass" />

<DataTable data={filtered_stocks} search=true rows=25 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=pe_trailing title="P/E Trail" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=beta title="Beta" fmt=num2 />
    <Column id=price_to_book title="P/Book" fmt=num1 />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=target_price title="Target" fmt=usd />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
    <Column id=country title="Pays" />
</DataTable>

    </Tab>
    <Tab label="Recherche">

_Tapez un symbole (ticker) pour trouver rapidement une action. Les resultats sont tries par pertinence._

<TextInput name=search_input title="Rechercher un Ticker" placeholder="Ex: AAPL, MSFT, NVDA..." />

### Resultats de Recherche

<DataTable data={search_results} rows=20 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
    <Column id=country title="Pays" />
</DataTable>

    </Tab>
</Tabs>

---

<LinkButton url="/">
    Accueil
</LinkButton>

<LinkButton url="/sectors">
    Analyse Sectorielle
</LinkButton>

<LinkButton url="/regions">
    Analyse Geographique
</LinkButton>

<LinkButton url="/valuations">
    Lab de Valorisation
</LinkButton>

<LinkButton url="/earnings">
    Croissance & Rentabilite
</LinkButton>
