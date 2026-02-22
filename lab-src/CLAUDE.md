# Market Watch - Lab-src Instructions

## 8. LAB — Evidence.dev Interactive Dashboard


### Architecture
Le Lab est un dashboard interactif construit avec [Evidence.dev](https://evidence.dev), un framework BI-as-code qui genere des sites statiques depuis Markdown + SQL (DuckDB-WASM).

```
lab/                              # Output statique (commite, servi par GH Pages)
├── index.html                    # Dashboard Overview
├── explorer/                     # Stock Explorer interactif
├── sectors/                      # Analyse sectorielle
├── regions/                      # Analyse geographique
├── valuations/                   # Lab de valorisation
├── earnings/                     # Croissance & rentabilite
└── _app/                         # Assets Evidence (JS, CSS, DuckDB WASM)

lab-src/                          # Source Evidence (pas servi par GH Pages)
├── pages/                        # 6 pages Markdown + SQL
│   ├── index.md                  # Dashboard Overview
│   ├── explorer.md               # Stock Explorer
│   ├── sectors.md                # Sectors Deep Dive
│   ├── regions.md                # Geographic Analysis
│   ├── valuations.md             # Valuation Lab
│   └── earnings.md               # Earnings Tracker
├── sources/market/
│   ├── connection.yaml           # type: csv
│   └── stocks.csv                # Dataset ~145 stocks
├── evidence.config.yaml          # Theme light, couleurs site
└── package.json                  # Dependencies Evidence
```

### Donnees (stocks.csv)
~145 stocks couvrant US, Europe, Asie avec colonnes :
symbol, name, price, change_pct, volume, market_cap, high_52w, low_52w, pe_trailing, pe_forward, dividend_yield, beta, price_to_book, revenue, revenue_growth, earnings_growth, gross_margin, operating_margin, profit_margin, roe, roa, target_price, recommendation, region, sector, country

### Refresh des donnees
1. Collecter via MCP Gateway : `QueryData` types=quote,stats,financials pour chaque batch (~7 batches de 20-25 symboles)
2. Mettre a jour `lab-src/sources/market/stocks.csv`
3. Rebuild :
```bash
cd lab-src
npx evidence sources
npx evidence build
rm -rf ../lab/*
cp -r build/* ../lab/
```

### Theme
- **Light** (default: light, switcher: false)
- Couleurs alignees sur le site : primary #2563eb, positive #16a34a, negative #dc2626, base #ffffff
- Font: Inter (herite du site)

### Composants Evidence utilises
BigValue, BarChart, ScatterPlot, DataTable, Column, Dropdown, DropdownOption, ButtonGroup, ButtonGroupItem, Alert, LinkButton, Details, Value

### Tab Lab dans index.html
- 6eme tab apres Portfolio : icone flask, label "Lab"
- Panel `#tab-lab` avec carte descriptive et lien vers `lab/`

---

