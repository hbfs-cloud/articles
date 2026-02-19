---
title: Croissance & Rentabilite
description: Analyse de la croissance du chiffre d'affaires, des benefices et des marges de rentabilite
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour Market Watch</a>

# Croissance & Rentabilite

<Alert status=info>
Heatmaps de marges, distributions de croissance, entonnoir de rentabilite et screening interactif Growth vs Value sur les plus grandes capitalisations mondiales.
</Alert>

<!-- ============================================== -->
<!-- STATIC QUERIES (no ${inputs}) for pre-rendering -->
<!-- ============================================== -->

```sql earn_summary_static
select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks
```

<BigValue data={earn_summary_static} value=nb_stocks title="Actions analysees" />
<BigValue data={earn_summary_static} value=avg_rev_growth title="Croiss. CA Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_earn_growth title="Croiss. BPA Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_gross_margin title="Marge Brute Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_op_margin title="Marge Op. Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_profit_margin title="Marge Nette Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_roe title="ROE Moy. (%)" />
<BigValue data={earn_summary_static} value=avg_roa title="ROA Moy. (%)" />

---

## Heatmap des Marges par Secteur

```sql heatmap_margins
select sector, 'Brute' as margin_type, round(avg(gross_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Operationnelle' as margin_type, round(avg(operating_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Nette' as margin_type, round(avg(profit_margin),1) as val from market.stocks group by sector
```

<Heatmap
    data={heatmap_margins}
    x=margin_type
    y=sector
    value=val
    title="Marges Moyennes par Secteur (%)"
    xAxisTitle="Type de Marge"
    yAxisTitle="Secteur"
    valueFmt=num1
/>

---

## Croissance par Secteur

### Croissance Moyenne du CA par Secteur

```sql avg_rev_growth_sector
select
    sector,
    round(avg(revenue_growth), 1) as avg_revenue_growth
from market.stocks
where revenue_growth is not null
group by sector
order by avg_revenue_growth desc
```

<BarChart
    data={avg_rev_growth_sector}
    x=sector
    y=avg_revenue_growth
    xAxisTitle="Secteur"
    yAxisTitle="Croissance CA Moy. (%)"
    title="Croissance Moyenne du Chiffre d'Affaires par Secteur"
    swapXY=true
    sort=false
/>

### ROE Moyen par Secteur

```sql avg_roe_sector
select
    sector,
    round(avg(roe), 1) as avg_roe
from market.stocks
where roe is not null
group by sector
order by avg_roe desc
```

<BarChart
    data={avg_roe_sector}
    x=sector
    y=avg_roe
    xAxisTitle="Secteur"
    yAxisTitle="ROE Moy. (%)"
    title="ROE Moyen par Secteur"
    swapXY=true
    sort=false
/>

---

## Distributions Statistiques

### Distribution de la Croissance du CA

```sql hist_rev_growth
select
    revenue_growth
from market.stocks
where revenue_growth is not null
  and revenue_growth > -100
  and revenue_growth < 200
```

<Histogram
    data={hist_rev_growth}
    x=revenue_growth
    xAxisTitle="Croissance CA (%)"
    title="Distribution de la Croissance du Chiffre d'Affaires"
/>

### Distribution de la Marge Nette

```sql hist_profit_margin
select
    profit_margin
from market.stocks
where profit_margin is not null
```

<Histogram
    data={hist_profit_margin}
    x=profit_margin
    xAxisTitle="Marge Nette (%)"
    title="Distribution de la Marge Nette"
/>

---

## Entonnoir de Rentabilite

```sql funnel_profitability
select
    'Marge > 30%' as tier,
    count(*) as count,
    1 as sort_order
from market.stocks
where profit_margin > 30
UNION ALL
select
    'Marge 20-30%' as tier,
    count(*) as count,
    2 as sort_order
from market.stocks
where profit_margin > 20 and profit_margin <= 30
UNION ALL
select
    'Marge 10-20%' as tier,
    count(*) as count,
    3 as sort_order
from market.stocks
where profit_margin > 10 and profit_margin <= 20
UNION ALL
select
    'Marge 0-10%' as tier,
    count(*) as count,
    4 as sort_order
from market.stocks
where profit_margin >= 0 and profit_margin <= 10
UNION ALL
select
    'Marge Negative' as tier,
    count(*) as count,
    5 as sort_order
from market.stocks
where profit_margin < 0
order by sort_order
```

<FunnelChart
    data={funnel_profitability}
    nameCol=tier
    valueCol=count
    title="Entonnoir de Rentabilite - Niveaux de Marge Nette"
/>

---

## Classements

### Top 20 Croissance du CA

```sql top20_rev_growth_static
select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    profit_margin,
    sector
from market.stocks
where revenue_growth is not null
order by revenue_growth desc
limit 20
```

<BarChart
    data={top20_rev_growth_static}
    x=symbol
    y=revenue_growth
    xAxisTitle="Ticker"
    yAxisTitle="Croissance CA (%)"
    title="Top 20 - Croissance du Chiffre d'Affaires"
    sort=false
/>

### Top 20 ROE

```sql top20_roe_static
select
    symbol,
    name,
    roe,
    profit_margin,
    revenue_growth,
    sector
from market.stocks
where roe is not null
order by roe desc
limit 20
```

<BarChart
    data={top20_roe_static}
    x=symbol
    y=roe
    xAxisTitle="Ticker"
    yAxisTitle="ROE (%)"
    title="Top 20 - Retour sur Capitaux Propres (ROE)"
    sort=false
/>

---

## Tableau Detaille Croissance & Rentabilite

```sql earnings_table_static
select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
order by revenue_growth desc nulls last
```

<DataTable data={earnings_table_static} search=true rows=25>
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=revenue title="CA" fmt=usd />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=earnings_growth title="Croiss. BPA %" fmt=num1 />
    <Column id=gross_margin title="Marge Brute %" fmt=num1 />
    <Column id=operating_margin title="Marge Op. %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=roa title="ROA %" fmt=num1 />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=sector title="Secteur" />
    <Column id=country title="Pays" />
</DataTable>

---

## Screener Growth vs Value

<Tabs>
    <Tab label="Growth vs Value">

<ButtonGroup name=style_screener title="Style d'investissement" defaultValue="all">
    <ButtonGroupItem valueLabel="Toutes les actions" value="all" default />
    <ButtonGroupItem valueLabel="Growth (CA > 20%)" value="growth" />
    <ButtonGroupItem valueLabel="Value (Div > 2%)" value="value" />
    <ButtonGroupItem valueLabel="Profitable (Marge > 15%)" value="profitable" />
</ButtonGroup>

```sql growth_screener_results
select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where (
    '${inputs.style_screener}' = 'all'
    or ('${inputs.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${inputs.style_screener}' = 'value' and dividend_yield > 2)
    or ('${inputs.style_screener}' = 'profitable' and profit_margin > 15)
  )
order by
  case
    when '${inputs.style_screener}' = 'growth' then revenue_growth
    when '${inputs.style_screener}' = 'value' then dividend_yield
    when '${inputs.style_screener}' = 'profitable' then profit_margin
    else revenue_growth
  end desc nulls last
```

```sql growth_screener_stats
select
    count(*) as nb_matches,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where (
    '${inputs.style_screener}' = 'all'
    or ('${inputs.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${inputs.style_screener}' = 'value' and dividend_yield > 2)
    or ('${inputs.style_screener}' = 'profitable' and profit_margin > 15)
  )
```

```sql growth_screener_bar
select
    symbol,
    revenue_growth,
    profit_margin,
    sector
from market.stocks
where (
    '${inputs.style_screener}' = 'all'
    or ('${inputs.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${inputs.style_screener}' = 'value' and dividend_yield > 2)
    or ('${inputs.style_screener}' = 'profitable' and profit_margin > 15)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20
```

<Grid cols=4>
    <BigValue data={growth_screener_stats} value=nb_matches title="Resultats" emptySet="pass" />
    <BigValue data={growth_screener_stats} value=avg_rev_growth title="Croiss. CA Moy. (%)" emptySet="pass" />
    <BigValue data={growth_screener_stats} value=avg_margin title="Marge Nette Moy. (%)" emptySet="pass" />
    <BigValue data={growth_screener_stats} value=avg_roe title="ROE Moy. (%)" emptySet="pass" />
</Grid>

<BarChart
    data={growth_screener_bar}
    x=symbol
    y=revenue_growth
    xAxisTitle="Ticker"
    yAxisTitle="Croissance CA (%)"
    title="Top 20 du filtre selectionne"
    sort=false
    emptySet="pass"
/>

<DataTable data={growth_screener_results} search=true rows=25 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=revenue title="CA" fmt=usd />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=earnings_growth title="Croiss. BPA %" fmt=num1 />
    <Column id=gross_margin title="Marge Brute %" fmt=num1 />
    <Column id=operating_margin title="Marge Op. %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=roa title="ROA %" fmt=num1 />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=sector title="Secteur" />
    <Column id=country title="Pays" />
</DataTable>

<DownloadData data={growth_screener_results} filename="screener_growth_value" emptySet="pass" />

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

<LinkButton url="/valuations">
    Lab de Valorisation
</LinkButton>
