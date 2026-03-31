# DailyTickers - Portfolio Instructions

## 6. PORTFOLIO (Stratégies Systématiques)


### Objectif
Tab sur la landing page affichant les stratégies algorithmiques systématiques actives avec performance vs benchmarks.

### Structure
Le Portfolio est directement dans `index.html` (pas d'article séparé), dans le tab `#tab-portfolio`.

### Sections
1. **Benchmark Reference Bar** : S&P 500, STOXX 600, Gold, Silver, Bitcoin — avec prix et variation
2. **Tier 1** (priorité haute) : Stratégies à forte conviction
3. **Tier 2** (priorité moyenne) : Stratégies secondaires
4. **Tier 3** (exploration) : Stratégies expérimentales

### Format d'une Stratégie Card
```html
<div style="background:white; border-radius:12px; border:1px solid #e2e8f0; padding:1.5rem; position:relative;">
    <div style="position:absolute; top:12px; right:12px;">
        <span class="badge badge-{color}">{Tier}</span>
    </div>
    <h3 style="font-size:1.1rem; font-weight:700; margin:0 0 0.5rem;">{Nom Stratégie}</h3>
    <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 1rem;">{Description}</p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:8px;">
        <!-- Métriques : Type, CAGR, Sharpe, Max DD, Win Rate -->
    </div>
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid #f1f5f9; font-size:0.75rem; color:var(--text-muted);">
        vs {Benchmark} : <span class="up/down">{Delta}</span>
    </div>
</div>
```

### Métriques Obligatoires par Stratégie
- **Type d'asset** : US Stocks, EU Stocks, Crypto, Metals, Forex, etc.
- **CAGR** : Rendement annualisé
- **Sharpe** : Ratio de Sharpe
- **Max DD** : Drawdown maximum
- **Win Rate** : Taux de réussite
- **vs Benchmark** : Surperformance par rapport à l'indice de référence pertinent

### Directives Portfolio
- Comparer chaque stratégie au bon benchmark (S&P 500 pour US, STOXX 600 pour EU, BTC pour crypto, etc.)
- Tier badges colorés : Tier 1 = vert, Tier 2 = bleu, Tier 3 = violet
- Disclaimer obligatoire : "Les performances passées ne garantissent pas les résultats futurs"
- Pas d'article séparé, tout dans index.html
- **Mentionner les tests anti-overfit** dans la description du tab Portfolio

### Méthodologie & Validation Anti-Overfit (Projet systematic-tss)

Chaque stratégie suit un processus rigoureux de conception et de validation avant publication :

#### Phase 1 : Conception de la Stratégie
1. **Analyse d'opportunités** : Génération de `opportunities.csv` avec tous les candidats et forward returns (5j, 10j, 20j)
2. **Cluster Analysis** : Identification de 3 types d'opportunités (SHORT ≤5j, MEDIUM 10-60j, LONG runners)
3. **Discriminant Identification** : Score, RSI, VolRatio, ATRPct, DistMA20, Momentum — calcul du lift par rapport au baseline
4. **Régime-Specific Filters** : Filtres adaptés par régime de marché (RiskOn → momentum, Recovery → mean reversion, RiskOff → RSI oversold)
5. **Config YAML** : Tous les paramètres sont externalisés (pas de hardcoding)

#### Phase 2 : Optimisation des Paramètres
- **Principe du "Plateau de Montagne"** : Ne JAMAIS choisir le pic de performance, toujours choisir le CENTRE du plateau
- **Sweeps un-par-un** : Optimiser chaque paramètre individuellement, jamais en cascade
- **Critères de stabilité** : Voisins ±1 step < 15% de variation, pas de cliff (>50% de chute), consistance cross-période
- **Ordre d'impact** : Position sizing → Stop management → Timeout → Max positions → Scanner filters → Pyramiding

#### Phase 3 : Tests Anti-Overfit
1. **Perturbation Test (±15%)** : Tous les paramètres sont perturbés de ±15% — la stratégie doit maintenir un score ≥ 60
2. **Stress Test** : Performance pendant les périodes de haute volatilité (bear 2022, COVID 2020)
3. **Bull Test** : Ne doit pas sous-performer le buy & hold de >50% en marché haussier
4. **Monkey Test** : Doit battre des entrées aléatoires par >2x
5. **Cross-Period Validation** : Paramètres optimaux similaires entre 2021-2023 et 2024-2026
6. **Cliff Detection** : Identification des paramètres "binaires" où un petit changement détruit les résultats

#### Phase 4 : Métriques Minimales Requises
| Métrique | Minimum |
|----------|---------|
| CAGR | ≥ 40% |
| Max Drawdown | ≤ 30% |
| R² | ≥ 0.8 |
| Win Rate | ≥ 35% |
| Sharpe Ratio | ≥ 1.0 |

#### Phase 5 : Forward Testing
- Déploiement en paper trading ou petites positions
- Comparaison résultats live vs backtest
- Monitoring du slippage, des fills, et des coûts de transaction
- Validation sur minimum 3 mois de forward testing avant publication

#### Scoring Anti-Overfit
| Score | Verdict | Action |
|-------|---------|--------|
| 80+ | EXCELLENT | Publication autorisée |
| 60-79 | GOOD | Publication avec mention "robuste" |
| 40-59 | FAIR | Publication avec avertissement |
| 20-39 | POOR | Non publié ou expérimental uniquement |
| <20 | FAIL | Rejeté |

#### Anti-Patterns à Éviter
- ❌ Cascade modifications (changer 3 paramètres simultanément)
- ❌ Choisir le pic (max CAGR) → Choisir le centre du plateau
- ❌ Ignorer la consistance temporelle → Vérifier sur sous-périodes
- ❌ Sur-paramétrer → Moins de paramètres = plus robuste
- ❌ Data snooping → Tester 10 hypothèses, pas 100 combinaisons

---

