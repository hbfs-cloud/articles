---
title: Valorisations
description: Analyse des multiples de valorisation, dividendes et metriques fondamentales
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour DailyTickers</a>

# Lab de Valorisation

<Alert status=info>
Distributions statistiques, comparaisons sectorielles et screening interactif des multiples de valorisation (P/E, Price-to-Book, Dividend Yield) sur les plus grandes capitalisations mondiales.
</Alert>

<!-- ============================================== -->
<!-- STATIC QUERIES (no ${inputs}) for pre-rendering -->
<!-- ============================================== -->

```sql val_summary_static
select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where pe_forward is not null and pe_forward > 0
```

<BigValue data={val_summary_static} value=nb_stocks title="Actions analysees" />
<BigValue data={val_summary_static} value=avg_pe_forward title="P/E Forward Moy." />
<BigValue data={val_summary_static} value=avg_pe_trailing title="P/E Trailing Moy." />
<BigValue data={val_summary_static} value=avg_ptb title="Price/Book Moy." />
<BigValue data={val_summary_static} value=avg_div_yield title="Div Yield Moy. (%)" />
<BigValue data={val_summary_static} value=avg_roe title="ROE Moy. (%)" />

---

## Distributions Statistiques

### Distribution du P/E Forward

```sql hist_pe_forward
select
    pe_forward
from market.stocks
where pe_forward > 0 and pe_forward < 200
```

<Histogram
    data={hist_pe_forward}
    x=pe_forward
    xAxisTitle="P/E Forward"
    title="Distribution du P/E Forward"
/>

### Distribution du Dividend Yield

```sql hist_div_yield
select
    dividend_yield
from market.stocks
where dividend_yield is not null and dividend_yield > 0
```

<Histogram
    data={hist_div_yield}
    x=dividend_yield
    xAxisTitle="Dividend Yield (%)"
    title="Distribution du Rendement en Dividende"
/>

### Distribution du Price-to-Book

```sql hist_ptb
select
    price_to_book
from market.stocks
where price_to_book > 0 and price_to_book < 50
```

<Histogram
    data={hist_ptb}
    x=price_to_book
    xAxisTitle="Price-to-Book"
    title="Distribution du Price-to-Book"
/>

---

## Analyse Sectorielle des Multiples

### P/E Forward par Secteur (BoxPlot)

```sql boxplot_pe_sector
select
    sector as name,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    median(pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
```

<BoxPlot
    data={boxplot_pe_sector}
    name=name
    min=min
    intervalBottom=q1
    midpoint=median
    intervalTop=q3
    max=max
    title="P/E Forward par Secteur"
    yAxisTitle="P/E Forward"
    swapXY=true
/>

### Dividend Yield par Region (BoxPlot)

```sql boxplot_div_region
select
    region as name,
    min(dividend_yield) as min,
    percentile_cont(0.25) within group (order by dividend_yield) as q1,
    median(dividend_yield) as median,
    percentile_cont(0.75) within group (order by dividend_yield) as q3,
    max(dividend_yield) as max
from market.stocks
where dividend_yield is not null and dividend_yield > 0
group by region
```

<BoxPlot
    data={boxplot_div_region}
    name=name
    min=min
    intervalBottom=q1
    midpoint=median
    intervalTop=q3
    max=max
    title="Dividend Yield par Region"
    yAxisTitle="Dividend Yield (%)"
    swapXY=true
/>

---

## Cartographie Valorisation vs Rendement

```sql bubble_pe_div
select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null
```

<BubbleChart
    data={bubble_pe_div}
    x=pe_forward
    y=dividend_yield
    size=market_cap
    series=sector
    xAxisTitle="P/E Forward"
    yAxisTitle="Dividend Yield (%)"
    title="P/E Forward vs Rendement en Dividende (taille = capitalisation)"
    tooltipTitle=symbol
/>

---

## Classements

### Top 20 Rendements en Dividende

```sql top20_dividends_static
select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 20
```

<BarChart
    data={top20_dividends_static}
    x=symbol
    y=dividend_yield
    xAxisTitle="Ticker"
    yAxisTitle="Dividend Yield (%)"
    title="Top 20 Dividend Yields"
    sort=false
/>

### Top 20 P/E les Plus Bas (actions sous-evaluees)

```sql top20_cheapest_pe_static
select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    price_to_book,
    market_cap,
    sector,
    recommendation
from market.stocks
where pe_forward > 0
order by pe_forward asc
limit 20
```

<BarChart
    data={top20_cheapest_pe_static}
    x=symbol
    y=pe_forward
    xAxisTitle="Ticker"
    yAxisTitle="P/E Forward"
    title="Top 20 - P/E Forward les Plus Bas"
    sort=false
/>

---

## Tableau Complet de Valorisation

```sql valuation_table_static
select
    symbol,
    name,
    price,
    pe_trailing,
    pe_forward,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by pe_forward asc nulls last
```

<DataTable data={valuation_table_static} search=true rows=25>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=pe_trailing title="P/E Trailing" fmt=num1 />
    <Column id=pe_forward title="P/E Forward" fmt=num1 />
    <Column id=price_to_book title="Price/Book" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=roa title="ROA %" fmt=num1 />
    <Column id=target_price title="Target" fmt=usd />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=country title="Pays" />
</DataTable>

---

## Screener Interactif

<Tabs>
    <Tab label="Screener Valorisation">

<Slider name=pe_max title="P/E Forward Max" min=0 max=200 step=5 defaultValue=200 />
<Slider name=div_min title="Dividend Yield Min (%)" min=0 max=10 step=0.5 defaultValue=0 />
<Slider name=ptb_max title="Price-to-Book Max" min=0 max=50 step=1 defaultValue=50 />

<ButtonGroup name=reco_filter title="Recommandation" defaultValue="all">
    <ButtonGroupItem valueLabel="Toutes" value="all" default />
    <ButtonGroupItem valueLabel="Strong Buy" value="strong_buy" />
    <ButtonGroupItem valueLabel="Buy" value="buy" />
    <ButtonGroupItem valueLabel="Hold" value="hold" />
</ButtonGroup>

```sql screener_results
select
    symbol,
    name,
    price,
    pe_forward,
    pe_trailing,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    market_cap,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
where pe_forward > 0
  and pe_forward <= ${inputs.pe_max}
  and coalesce(dividend_yield, 0) >= ${inputs.div_min}
  and price_to_book > 0
  and price_to_book <= ${inputs.ptb_max}
  and (
    '${inputs.reco_filter}' = 'all'
    or recommendation = '${inputs.reco_filter}'
  )
order by pe_forward asc
```

```sql screener_stats
select
    count(*) as nb_matches,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
where pe_forward > 0
  and pe_forward <= ${inputs.pe_max}
  and coalesce(dividend_yield, 0) >= ${inputs.div_min}
  and price_to_book > 0
  and price_to_book <= ${inputs.ptb_max}
  and (
    '${inputs.reco_filter}' = 'all'
    or recommendation = '${inputs.reco_filter}'
  )
```

```sql screener_bubble
select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward <= ${inputs.pe_max}
  and pe_forward < 200
  and coalesce(dividend_yield, 0) >= ${inputs.div_min}
  and dividend_yield is not null
  and price_to_book > 0
  and price_to_book <= ${inputs.ptb_max}
  and (
    '${inputs.reco_filter}' = 'all'
    or recommendation = '${inputs.reco_filter}'
  )
```

<Grid cols=3>
    <BigValue data={screener_stats} value=nb_matches title="Resultats" emptySet="pass" />
    <BigValue data={screener_stats} value=avg_pe title="P/E Forward Moy." emptySet="pass" />
    <BigValue data={screener_stats} value=avg_div title="Div Yield Moy. (%)" emptySet="pass" />
</Grid>

<BubbleChart
    data={screener_bubble}
    x=pe_forward
    y=dividend_yield
    size=market_cap
    series=sector
    xAxisTitle="P/E Forward"
    yAxisTitle="Dividend Yield (%)"
    title="Resultats du Screener (taille = capitalisation)"
    tooltipTitle=symbol
    emptySet="pass"
/>

<DataTable data={screener_results} search=true rows=25 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=pe_trailing title="P/E Trail" fmt=num1 />
    <Column id=price_to_book title="P/B" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=target_price title="Target" fmt=usd />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=country title="Pays" />
</DataTable>

<DownloadData data={screener_results} filename="screener_valorisations" emptySet="pass" />

    </Tab>
</Tabs>

---

<LinkButton url="/">
    Accueil
</LinkButton>

<LinkButton url="/explorer">
    Explorateur d'Actions
</LinkButton>

<LinkButton url="/sectors">
    Analyse Sectorielle
</LinkButton>

<LinkButton url="/regions">
    Analyse Geographique
</LinkButton>

<LinkButton url="/earnings">
    Croissance & Rentabilite
</LinkButton>
