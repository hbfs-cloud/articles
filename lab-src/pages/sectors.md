---
title: Analyse Sectorielle
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour Market Watch</a>

# Analyse Sectorielle

<Alert status=info>
Plongez dans chaque secteur : capitalisation, valorisation, dividendes, croissance et composition. Les visualisations statiques offrent une vue d'ensemble instantanee, tandis que l'onglet Drill Down permet d'explorer un secteur en detail.
</Alert>

<!-- ═══════════════════════════════════════════════════ -->
<!-- STATIC QUERIES (no ${inputs}) — pre-rendered       -->
<!-- ═══════════════════════════════════════════════════ -->

```sql sector_summary
select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where sector is not null
group by sector
order by total_mcap desc
```

```sql sector_mcap_bar
select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where sector is not null
group by sector
order by total_mcap desc
```

```sql sector_avg_div
select
    sector,
    round(avg(dividend_yield), 2) as avg_div_yield
from market.stocks
where sector is not null and dividend_yield is not null
group by sector
order by avg_div_yield desc
```

```sql sector_avg_rev_growth
select
    sector,
    round(avg(revenue_growth), 1) as avg_rev_growth
from market.stocks
where sector is not null and revenue_growth is not null
group by sector
order by avg_rev_growth desc
```

```sql sector_heatmap
select
    sector,
    region,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where sector is not null and region is not null
group by sector, region
order by sector, region
```

```sql sector_boxplot
select
    sector,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    percentile_cont(0.50) within group (order by pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where sector is not null
  and pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
group by sector
order by median desc
```

```sql sector_list_dd
select distinct sector as value, sector as label
from market.stocks
where sector is not null
order by sector
```

<!-- ═══════════════════════════════════════════════════ -->
<!-- STATIC CONTENT                                      -->
<!-- ═══════════════════════════════════════════════════ -->

## Vue d'Ensemble Sectorielle

### Capitalisation par Secteur

<BarChart
    data={sector_mcap_bar}
    x=sector
    y=total_mcap
    xAxisTitle="Secteur"
    yAxisTitle="Capitalisation Totale ($)"
    title="Capitalisation Boursiere par Secteur"
    fmt=usd
    swapXY=true
    sort=false
/>

### Heatmap : Performance Moyenne par Secteur et Region

<Heatmap
    data={sector_heatmap}
    x=region
    y=sector
    value=avg_change
    valueFmt=num2
    title="Variation Moyenne (%) par Secteur et Region"
/>

### Distribution du P/E Forward par Secteur

<BoxPlot
    data={sector_boxplot}
    name=sector
    min=min
    intervalBottom=q1
    midpoint=median
    intervalTop=q3
    max=max
    title="Distribution du P/E Forward par Secteur"
    yAxisTitle="P/E Forward"
/>

<Grid cols=2>
<Group>

### Rendement Moyen en Dividende

<BarChart
    data={sector_avg_div}
    x=sector
    y=avg_div_yield
    xAxisTitle="Secteur"
    yAxisTitle="Dividend Yield Moy. (%)"
    title="Rendement Moyen en Dividende par Secteur"
    sort=false
/>

</Group>
<Group>

### Croissance Moyenne du CA

<BarChart
    data={sector_avg_rev_growth}
    x=sector
    y=avg_rev_growth
    xAxisTitle="Secteur"
    yAxisTitle="Croissance CA Moy. (%)"
    title="Croissance Moyenne du Chiffre d'Affaires"
    sort=false
/>

</Group>
</Grid>

### Tableau Recapitulatif par Secteur

<DataTable data={sector_summary} rows=15>
    <Column id=sector title="Secteur" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." fmt=num1 />
    <Column id=avg_div title="Div Yield Moy. (%)" fmt=num2 />
    <Column id=avg_rev_growth title="Croiss. CA Moy. (%)" fmt=num1 />
    <Column id=avg_margin title="Marge Nette Moy. (%)" fmt=num1 />
    <Column id=avg_roe title="ROE Moy. (%)" fmt=num1 />
    <Column id=avg_change title="Var. Moy. (%)" fmt=num2 />
</DataTable>

<!-- ═══════════════════════════════════════════════════ -->
<!-- INTERACTIVE TAB — Drill Down                        -->
<!-- ═══════════════════════════════════════════════════ -->

<Tabs>
    <Tab label="Drill Down">

<Dropdown name=selected_sector title="Choisir un Secteur">
    {#each sector_list_dd as row}
        <DropdownOption value={row.value} valueLabel={row.label} />
    {/each}
</Dropdown>

```sql dd_sector_stats
select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
where sector = '${inputs.selected_sector.value}'
```

```sql dd_top10
select
    symbol,
    name,
    market_cap,
    price,
    change_pct,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    roe,
    country
from market.stocks
where sector = '${inputs.selected_sector.value}'
order by market_cap desc
limit 10
```

```sql dd_mcap_bar
select
    symbol,
    market_cap
from market.stocks
where sector = '${inputs.selected_sector.value}'
order by market_cap desc
limit 15
```

<BigValue data={dd_sector_stats} value=nb_stocks title="Actions dans le secteur" emptySet="pass" />
<BigValue data={dd_sector_stats} value=total_mcap title="Capitalisation Totale" fmt=usd emptySet="pass" />
<BigValue data={dd_sector_stats} value=avg_pe title="P/E Forward Moy." emptySet="pass" />
<BigValue data={dd_sector_stats} value=avg_div title="Div Yield Moy. (%)" emptySet="pass" />
<BigValue data={dd_sector_stats} value=avg_change title="Var. Moy. (%)" emptySet="pass" />
<BigValue data={dd_sector_stats} value=avg_margin title="Marge Nette Moy. (%)" emptySet="pass" />

### Top Capitalisations du Secteur

<BarChart
    data={dd_mcap_bar}
    x=symbol
    y=market_cap
    xAxisTitle="Ticker"
    yAxisTitle="Capitalisation ($)"
    title="Top 15 par Capitalisation"
    fmt=usd
    sort=false
    emptySet="pass"
/>

### Top 10 Actions du Secteur

<DataTable data={dd_top10} rows=10 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=roe title="ROE %" fmt=num1 />
    <Column id=country title="Pays" />
</DataTable>

    </Tab>
</Tabs>

---

<LinkButton url="/">
    Accueil
</LinkButton>

<LinkButton url="/explorer">
    Explorateur d'Actions
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
