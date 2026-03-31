---
title: Dashboard Global
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour DailyTickers</a>

<!-- ============================================================ -->
<!-- STATIC QUERIES (no ${inputs}) — pre-rendered with data       -->
<!-- ============================================================ -->

```sql total_stats
select
    count(*) as total_stocks,
    round(sum(market_cap) / 1e12, 2) as total_mcap_t,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change,
    round(avg(beta), 2) as avg_beta,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
```

```sql by_region
select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
group by region
order by total_mcap desc
```

```sql by_sector
select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
group by sector
order by total_mcap desc
```

```sql heatmap_data
select
    cast(sector as varchar) as y_val,
    cast(region as varchar) as x_val,
    round(avg(change_pct), 2) as val
from market.stocks
group by sector, region
```

```sql sector_mcap_bar
select
    sector,
    round(sum(market_cap) / 1e12, 2) as mcap_t
from market.stocks
group by sector
order by mcap_t desc
```

```sql pe_distribution
select
    case
        when pe_forward < 0 then 'Negatif'
        when pe_forward >= 0 and pe_forward < 10 then '0-10'
        when pe_forward >= 10 and pe_forward < 15 then '10-15'
        when pe_forward >= 15 and pe_forward < 20 then '15-20'
        when pe_forward >= 20 and pe_forward < 25 then '20-25'
        when pe_forward >= 25 and pe_forward < 30 then '25-30'
        when pe_forward >= 30 and pe_forward < 40 then '30-40'
        when pe_forward >= 40 and pe_forward < 60 then '40-60'
        when pe_forward >= 60 then '60+'
    end as pe_bucket,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null
group by pe_bucket
order by
    case pe_bucket
        when 'Negatif' then 0
        when '0-10' then 1
        when '10-15' then 2
        when '15-20' then 3
        when '20-25' then 4
        when '25-30' then 5
        when '30-40' then 6
        when '40-60' then 7
        when '60+' then 8
    end
```

```sql funnel_data
select 'Mega >1T$' as tier, count(*) as nb, 1 as sort_order from market.stocks where market_cap > 1000000000000
UNION ALL
select '500B-1T$' as tier, count(*) as nb, 2 as sort_order from market.stocks where market_cap > 500000000000 and market_cap <= 1000000000000
UNION ALL
select '100B-500B$' as tier, count(*) as nb, 3 as sort_order from market.stocks where market_cap > 100000000000 and market_cap <= 500000000000
UNION ALL
select '50B-100B$' as tier, count(*) as nb, 4 as sort_order from market.stocks where market_cap > 50000000000 and market_cap <= 100000000000
UNION ALL
select '<50B$' as tier, count(*) as nb, 5 as sort_order from market.stocks where market_cap <= 50000000000
order by sort_order
```

```sql bubble_data
select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
```

```sql cumulative_mcap_by_region
select
    cast(sector as varchar) as sector,
    region,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by sector, region
order by sector
```

```sql top_movers
select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct desc
limit 10
```

```sql worst_movers
select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct asc
limit 10
```

```sql top_by_upside
select
    symbol,
    name,
    price,
    target_price,
    round(((target_price - price) / price) * 100, 1) as upside_pct,
    recommendation,
    sector,
    region
from market.stocks
where target_price is not null
  and price is not null
  and price > 0
order by upside_pct desc
limit 10
```

```sql top_dividends
select symbol, name, price, dividend_yield, pe_forward, market_cap, sector, region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 10
```

```sql all_stocks
select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    revenue_growth,
    earnings_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by market_cap desc
```

```sql recommendation_dist
select
    recommendation as reco,
    count(*) as nb
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by
    case recommendation
        when 'strongBuy' then 1
        when 'buy' then 2
        when 'hold' then 3
        when 'sell' then 4
        when 'strongSell' then 5
        else 6
    end
```

```sql margin_by_sector
select
    sector,
    round(avg(gross_margin), 1) as gross_margin,
    round(avg(operating_margin), 1) as operating_margin,
    round(avg(profit_margin), 1) as profit_margin
from market.stocks
group by sector
order by profit_margin desc
```

```sql growth_vs_value
select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and revenue_growth is not null
```

```sql region_mcap_stacked
select
    cast(region as varchar) as region,
    cast(sector as varchar) as sector,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by region, sector
order by region, mcap_b desc
```

```sql pe_by_sector_box
select
    sector as name,
    round(percentile_cont(0.25) within group (order by pe_forward), 1) as q1,
    round(median(pe_forward), 1) as median_pe,
    round(percentile_cont(0.75) within group (order by pe_forward), 1) as q3,
    round(min(pe_forward), 1) as min_pe,
    round(max(pe_forward), 1) as max_pe
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
order by median_pe desc
```

<!-- ============================================================ -->
<!-- DASHBOARD CONTENT                                            -->
<!-- ============================================================ -->

# Radiographie des 145 Plus Grandes Capitalisations Mondiales

<Alert status=info>
Laboratoire financier interactif DailyTickers — {total_stats[0].total_stocks} actions, 11 secteurs, 4 zones geographiques. Toutes les donnees sont pre-calculees pour un chargement instantane.
</Alert>

## Metriques Cles

<Grid cols=5>
    <BigValue
        data={total_stats}
        value=total_stocks
        title="Actions couvertes"
        emptySet="pass"
    />
    <BigValue
        data={total_stats}
        value=total_mcap_t
        title="Cap. Totale (T$)"
        emptySet="pass"
    />
    <BigValue
        data={total_stats}
        value=avg_pe
        title="P/E Forward Moy."
        emptySet="pass"
    />
    <BigValue
        data={total_stats}
        value=avg_div_yield
        title="Div. Yield Moy. (%)"
        emptySet="pass"
    />
    <BigValue
        data={total_stats}
        value=avg_change
        title="Var. Moy. (%)"
        emptySet="pass"
    />
</Grid>

<Grid cols=3>
    <BigValue
        data={total_stats}
        value=avg_beta
        title="Beta Moyen"
        emptySet="pass"
    />
    <BigValue
        data={total_stats}
        value=avg_margin
        title="Marge Nette Moy. (%)"
        emptySet="pass"
    />
    <BigValue
        data={by_region}
        value=nb_stocks
        title="Regions"
        emptySet="pass"
    />
</Grid>

---

<Tabs>

<!-- ============================================================ -->
<!-- TAB 1: VUE GLOBALE                                           -->
<!-- ============================================================ -->

<Tab label="Vue Globale">

### Heatmap Secteur x Region — Variation Moyenne (%)

<Heatmap
    data={heatmap_data}
    x=x_val
    y=y_val
    value=val
    valueFmt=num2
    title="Performance Moyenne par Secteur et Region (%)"
    emptySet="pass"
/>

<Grid cols=2>

<div>

### Capitalisation par Secteur (T$)

<BarChart
    data={sector_mcap_bar}
    x=sector
    y=mcap_t
    xAxisTitle="Secteur"
    yAxisTitle="Cap. Totale (T$)"
    title="Poids des Secteurs"
    swapXY=true
    sort=false
    emptySet="pass"
/>

</div>

<div>

### Capitalisation par Region

<BarChart
    data={by_region}
    x=region
    y=total_mcap
    title="Repartition par Zone Geographique"
    fmt=usd
    emptySet="pass"
/>

</div>

</Grid>

### Capitalisation Sectorielle Empilee par Region (Mds$)

<BarChart
    data={region_mcap_stacked}
    x=region
    y=mcap_b
    series=sector
    title="Decomposition Sectorielle par Region"
    yAxisTitle="Capitalisation (Mds$)"
    type=stacked
    emptySet="pass"
/>

### Tableau Comparatif par Region

<DataTable data={by_region} rows=10 emptySet="pass">
    <Column id=region title="Region" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." />
    <Column id=avg_div_yield title="Div Yield Moy. (%)" />
    <Column id=avg_change title="Var Moy. (%)" />
</DataTable>

### Tableau Comparatif par Secteur

<DataTable data={by_sector} rows=15 emptySet="pass">
    <Column id=sector title="Secteur" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." />
    <Column id=avg_change title="Var Moy. (%)" />
    <Column id=avg_rev_growth title="Croiss. CA Moy. (%)" />
    <Column id=avg_margin title="Marge Nette Moy. (%)" />
</DataTable>

### Recommandations Analystes

<BarChart
    data={recommendation_dist}
    x=reco
    y=nb
    xAxisTitle="Recommandation"
    yAxisTitle="Nombre d'Actions"
    title="Distribution des Recommandations Analystes"
    emptySet="pass"
/>

</Tab>

<!-- ============================================================ -->
<!-- TAB 2: DISTRIBUTION                                          -->
<!-- ============================================================ -->

<Tab label="Distribution">

### Distribution du P/E Forward

<BarChart
    data={pe_distribution}
    x=pe_bucket
    y=nb_stocks
    xAxisTitle="Fourchette P/E Forward"
    yAxisTitle="Nombre d'Actions"
    title="Histogramme — P/E Forward"
    sort=false
    emptySet="pass"
/>

### P/E Forward par Secteur (Box Plot)

<DataTable data={pe_by_sector_box} rows=15 emptySet="pass">
    <Column id=name title="Secteur" />
    <Column id=min_pe title="Min" />
    <Column id=q1 title="Q1 (25e)" />
    <Column id=median_pe title="Mediane" />
    <Column id=q3 title="Q3 (75e)" />
    <Column id=max_pe title="Max" />
</DataTable>

### Pyramide des Capitalisations

<FunnelChart
    data={funnel_data}
    nameCol=tier
    valueCol=nb
    title="Repartition par Taille de Capitalisation"
    emptySet="pass"
/>

### Marges par Secteur (%)

<BarChart
    data={margin_by_sector}
    x=sector
    y={['gross_margin', 'operating_margin', 'profit_margin']}
    title="Marges Brute, Operationnelle et Nette par Secteur"
    yAxisTitle="Marge (%)"
    swapXY=true
    sort=false
    type=grouped
    emptySet="pass"
/>

### Top 10 Rendements en Dividende

<BarChart
    data={top_dividends}
    x=symbol
    y=dividend_yield
    xAxisTitle="Ticker"
    yAxisTitle="Dividend Yield (%)"
    title="Meilleurs Rendements en Dividende"
    sort=false
    emptySet="pass"
/>

<DataTable data={top_dividends} rows=10 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=dividend_yield title="Div Yield (%)" fmt=num2 />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

</Tab>

<!-- ============================================================ -->
<!-- TAB 3: TOP & FLOP                                            -->
<!-- ============================================================ -->

<Tab label="Top & Flop">

<Grid cols=2>

<div>

### Top 10 Hausses

<DataTable data={top_movers} rows=10 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

</div>

<div>

### Top 10 Baisses

<DataTable data={worst_movers} rows=10 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

</div>

</Grid>

### Top 10 Potentiel de Hausse (Upside Analystes)

<DataTable data={top_by_upside} rows=10 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix Actuel" fmt=usd />
    <Column id=target_price title="Target Analystes" fmt=usd />
    <Column id=upside_pct title="Upside (%)" fmt=num1 />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
</DataTable>

<BarChart
    data={top_by_upside}
    x=symbol
    y=upside_pct
    xAxisTitle="Ticker"
    yAxisTitle="Upside (%)"
    title="Top 10 Potentiel de Hausse selon les Analystes"
    sort=false
    emptySet="pass"
/>

</Tab>

<!-- ============================================================ -->
<!-- TAB 4: EXPLORER                                              -->
<!-- ============================================================ -->

<Tab label="Explorer">

### Nuage de Points : P/E Forward vs Variation (%)

<BubbleChart
    data={bubble_data}
    x=pe_forward
    y=change_pct
    size=market_cap
    series=sector
    xAxisTitle="P/E Forward"
    yAxisTitle="Variation (%)"
    title="Valorisation vs Performance — Taille = Capitalisation"
    tooltipTitle=symbol
    emptySet="pass"
/>

### Croissance du CA vs P/E Forward

<BubbleChart
    data={growth_vs_value}
    x=pe_forward
    y=revenue_growth
    size=market_cap
    series=sector
    xAxisTitle="P/E Forward"
    yAxisTitle="Croissance CA (%)"
    title="Growth vs Value — Taille = Capitalisation"
    tooltipTitle=symbol
    emptySet="pass"
/>

### Toutes les Actions ({total_stats[0].total_stocks})

<DataTable data={all_stocks} search=true rows=20 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=volume title="Volume" fmt=#,##0 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_trailing title="P/E Trail." fmt=num1 />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=beta title="Beta" fmt=num2 />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=earnings_growth title="Croiss. BPA %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=target_price title="Target" fmt=usd />
    <Column id=recommendation title="Reco." />
    <Column id=sector title="Secteur" />
    <Column id=region title="Region" />
    <Column id=country title="Pays" />
</DataTable>

<DownloadData data={all_stocks} text="Telecharger toutes les donnees (CSV)" />

</Tab>

</Tabs>

---

## Naviguer dans le Laboratoire

<Grid cols=5>

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

<LinkButton url="/earnings">
    Croissance & Rentabilite
</LinkButton>

</Grid>
