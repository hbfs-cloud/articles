---
title: Analyse Geographique
---

<a href="/" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; color:#475569; text-decoration:none; font-size:0.85rem; margin-bottom:1rem;">← Retour DailyTickers</a>

# Analyse Geographique

<Alert status=info>
Explorez la repartition geographique des plus grandes capitalisations mondiales. Les visualisations statiques montrent les flux Region-Secteur, les heatmaps et les classements par pays. L'onglet Par Region permet d'explorer une zone en detail.
</Alert>

<!-- ═══════════════════════════════════════════════════ -->
<!-- STATIC QUERIES (no ${inputs}) — pre-rendered       -->
<!-- ═══════════════════════════════════════════════════ -->

```sql sankey_flows
select
    region as source,
    sector as target,
    count(*) as amount
from market.stocks
where region is not null and sector is not null
group by region, sector
order by amount desc
```

```sql heatmap_region_sector
select
    region,
    sector,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, sector
```

```sql mcap_by_region_sector
select
    region,
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, total_mcap desc
```

```sql country_summary
select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where country is not null
group by country
order by total_mcap desc
```

```sql top15_countries_mcap
select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where country is not null
group by country
order by total_mcap desc
limit 15
```

```sql funnel_region
select
    region,
    count(*) as nb_stocks
from market.stocks
where region is not null
group by region
order by nb_stocks desc
```

```sql region_overview
select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null
group by region
order by total_mcap desc
```

```sql region_list_btn
select distinct region as value, region as label
from market.stocks
where region is not null
order by region
```

<!-- ═══════════════════════════════════════════════════ -->
<!-- STATIC CONTENT                                      -->
<!-- ═══════════════════════════════════════════════════ -->

## Flux Region vers Secteur

<SankeyDiagram
    data={sankey_flows}
    sourceCol=source
    targetCol=target
    valueCol=amount
    title="Repartition des Actions : Region vers Secteur"
/>

## Heatmap : Performance Moyenne par Region et Secteur

<Heatmap
    data={heatmap_region_sector}
    x=sector
    y=region
    value=avg_change
    valueFmt=num2
    title="Variation Moyenne (%) : Region x Secteur"
/>

## Capitalisation par Region et Secteur

<BarChart
    data={mcap_by_region_sector}
    x=region
    y=total_mcap
    series=sector
    type=stacked
    xAxisTitle="Region"
    yAxisTitle="Capitalisation Totale ($)"
    title="Capitalisation par Region (empile par Secteur)"
    fmt=usd
/>

<Grid cols=2>
<Group>

### Nombre d'Actions par Region

<FunnelChart
    data={funnel_region}
    nameCol=region
    valueCol=nb_stocks
    title="Repartition des Actions par Region"
/>

</Group>
<Group>

### Top 15 Pays par Capitalisation

<BarChart
    data={top15_countries_mcap}
    x=country
    y=total_mcap
    xAxisTitle="Pays"
    yAxisTitle="Capitalisation Totale ($)"
    title="Top 15 Pays par Capitalisation"
    fmt=usd
    swapXY=true
    sort=false
/>

</Group>
</Grid>

### Synthese par Region

<DataTable data={region_overview} rows=10>
    <Column id=region title="Region" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." fmt=num1 />
    <Column id=avg_div title="Div Yield Moy. (%)" fmt=num2 />
    <Column id=avg_change title="Var. Moy. (%)" fmt=num2 />
</DataTable>

### Detail par Pays

<DataTable data={country_summary} search=true rows=20>
    <Column id=country title="Pays" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." fmt=num1 />
    <Column id=avg_div title="Div Yield Moy. (%)" fmt=num2 />
    <Column id=avg_change title="Var. Moy. (%)" fmt=num2 />
</DataTable>

<!-- ═══════════════════════════════════════════════════ -->
<!-- INTERACTIVE TAB — Par Region                        -->
<!-- ═══════════════════════════════════════════════════ -->

<Tabs>
    <Tab label="Par Region">

<ButtonGroup name=region_select title="Region">
    {#each region_list_btn as row}
        <ButtonGroupItem value={row.value} valueLabel={row.label} />
    {/each}
</ButtonGroup>

```sql rg_stats
select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${inputs.region_select.value}'
```

```sql rg_sector_breakdown
select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${inputs.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc
```

```sql rg_sector_mcap
select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region = '${inputs.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc
```

```sql rg_top_stocks
select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    sector,
    country
from market.stocks
where region = '${inputs.region_select.value}'
order by market_cap desc
limit 20
```

<BigValue data={rg_stats} value=nb_stocks title="Actions" emptySet="pass" />
<BigValue data={rg_stats} value=total_mcap title="Capitalisation Totale" fmt=usd emptySet="pass" />
<BigValue data={rg_stats} value=avg_pe title="P/E Forward Moy." emptySet="pass" />
<BigValue data={rg_stats} value=avg_div title="Div Yield Moy. (%)" emptySet="pass" />
<BigValue data={rg_stats} value=avg_change title="Var. Moy. (%)" emptySet="pass" />

### Repartition Sectorielle

<BarChart
    data={rg_sector_mcap}
    x=sector
    y=total_mcap
    title="Capitalisation par Secteur dans la Region"
    fmt=usd
    swapXY=true
    sort=false
    emptySet="pass"
/>

<DataTable data={rg_sector_breakdown} rows=12 emptySet="pass">
    <Column id=sector title="Secteur" />
    <Column id=nb_stocks title="Nb Actions" />
    <Column id=total_mcap title="Cap. Totale" fmt=usd />
    <Column id=avg_pe title="P/E Fwd Moy." fmt=num1 />
    <Column id=avg_change title="Var. Moy. (%)" fmt=num2 />
</DataTable>

### Top 20 Actions de la Region

<DataTable data={rg_top_stocks} rows=20 emptySet="pass">
    <Column id=symbol title="Ticker" />
    <Column id=name title="Nom" />
    <Column id=price title="Prix" fmt=usd />
    <Column id=change_pct title="Var %" fmt=num2 />
    <Column id=market_cap title="Cap." fmt=usd />
    <Column id=pe_forward title="P/E Fwd" fmt=num1 />
    <Column id=dividend_yield title="Div %" fmt=num2 />
    <Column id=revenue_growth title="Croiss. CA %" fmt=num1 />
    <Column id=profit_margin title="Marge Nette %" fmt=num1 />
    <Column id=sector title="Secteur" />
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

<LinkButton url="/sectors">
    Analyse Sectorielle
</LinkButton>

<LinkButton url="/valuations">
    Lab de Valorisation
</LinkButton>

<LinkButton url="/earnings">
    Croissance & Rentabilite
</LinkButton>
