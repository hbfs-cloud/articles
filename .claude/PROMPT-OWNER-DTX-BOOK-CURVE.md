> ## ✅ RÉSOLU — systematic-tss v1.34.1 (2026-08-12)
>
> L'owner a livré `DtxBookEquity(portfolio)` : courbe quotidienne du livre, embarquée au build avec
> les stats qu'elle produit. Vérifié côté articles par `tools/dtx-book-equity-ingest.js`, qui refuse
> d'écrire si le recalcul ne reproduit pas les chiffres servis : **CAGR 72,0334 vs 72,03 servi et
> MaxDD 27,1834 vs 27,18 — écart 0,0034 pt sur les deux**. Le critère d'acceptation ci-dessous est
> satisfait. Document conservé comme trace de la demande et de son argumentaire.
>
> Une précision découverte à l'ingestion : l'annualisation est en **séances** (années = points/252),
> pas en jours calendaires — recalculer en 365,25 j donne 71,69 et non 72,03. C'est publié dans
> `trading_days_per_year`, avec `committed_capital` (155 000, pas 100 000).

---

# Demande à l'owner de systematic-tss — servir la courbe d'equity du LIVRE `best`

*(prompt autoportant : à copier tel quel, il ne suppose aucun contexte de la conversation d'origine)*

---

## Le problème en une phrase

Le moteur sert les **statistiques** du livre `best` mais pas sa **courbe**, et la seule courbe
disponible décrit autre chose que ces statistiques — d'un facteur 1,6 sur le drawdown.

## Ce qui est publié aujourd'hui côté articles

`portfolio/v1/best/equity.json.engineBacktest` publie les statistiques **servies** du livre
(`metrics_source: "book_served_stats"`, période 2021-01-01 → 2026-08-12) :

```
CAGR 70,9 %   MaxDD 27,2 %   DD p95 (bootstrap 21j) 38,3 %   Sharpe 1,56   R² 0,90   3 638 trades
```

Mais le champ `equityCurve` du même fichier est la courbe de replay de la **poche porteuse**
(`uhv_tp999`), sous-échantillonnée aux dates de rebalancement (~13 jours calendaires, 159 points).
Un consommateur qui recalcule le drawdown dessus obtient **17,49 %** au lieu de 27,2 %.

L'écart est aujourd'hui *déclaré* dans le JSON, faute de mieux :

> `curve_warning`: « Do NOT recompute max drawdown from equityCurve — it is the sub-sampled replay
> curve of the carrying sleeve, not the served book. Recomputing yields ~17.5 % vs the authoritative
> 27.2 %. Use max_dd_pct above. »

C'est un pansement. Un fichier qui publie une courbe **et** des statistiques qui ne s'en déduisent
pas est un fichier qui invite à l'erreur, quel que soit l'avertissement.

## Ce que la surface MCP expose (vérifié)

`DtxReplay(portfolio="best")` rend :

- `results[]` — **quatre replays par poche, à capital fixe**, 158 points d'equity chacun :

  | poche | stratégie | CAGR | MaxDD | trades |
  |---|---|---|---|---|
  | `uhv_tp999` | highvol-breakout-corr | 54,74 | 27,33 | 651 |
  | `ep` | episodic-pivot | 11,75 | 28,60 | 374 |
  | `etf_us` | etf-momentum | 14,00 | 27,01 | 2 433 |
  | `mx` | momentum-explosion | 28,05 | 20,48 | 1 119 |

- `combined` — que le staging interdit explicitement d'utiliser :

  > « NE PAS reconstruire depuis `DtxReplay.combined` — il additionne des poches à capital fixe et
  > minore rendement comme risque. »

  Mesuré : la reconstruction rend **39,6 % de CAGR et 20,2 % de DD** quand le livre sert 70,9 % et
  27,2 %. Un livre à allocation dynamique ne se reconstitue pas en additionnant des poches rejouées
  à capital constant.

**Conclusion : la courbe qui produit les statistiques servies n'existe nulle part dans la surface
MCP.** Elle ne peut donc pas être reconstruite côté consommateur — toute tentative fabriquerait un
chiffre, ce que je refuse de faire.

## Ce que je demande

Servir la courbe d'equity **du livre** — celle dont dérivent les statistiques déjà servies —
c'est-à-dire après rééquilibrage réel entre poches, coûts inclus, univers figé.

Forme suggérée, à ajouter au résultat de `DtxReplay` (ou via un outil dédié type
`DtxBookEquity(portfolio, from?, to?)`) :

```json
{
  "book_equity": {
    "resolution": "daily",
    "dates":  ["2021-01-04", "..."],
    "values": [100000.0, "..."],
    "source": "book_served",
    "metrics": { "cagr_pct": 70.9, "max_dd_pct": 27.2, "sharpe": 1.56, "total_trades": 3638 }
  }
}
```

**Critère d'acceptation, non négociable** : recalculer le drawdown maximal et le CAGR à partir de
`book_equity.values` doit reproduire les statistiques servies à ±0,1 point (27,2 % et 70,9 %). Si
les deux ne se recoupent pas, c'est encore une courbe qui décrit autre chose que ses chiffres, et le
problème n'est pas réglé.

**Résolution** : quotidienne de préférence. À défaut, toute résolution est acceptable **à condition**
que le drawdown recalculé dessus reste conforme au critère ci-dessus — un sous-échantillonnage qui
rabote les creux (c'est précisément ce qui donne 17,5 % au lieu de 27,2 %) ne convient pas.

## Deux choses à ne pas faire

1. **Ne pas dériver la courbe de `combined`.** C'est la somme de poches à capital fixe : elle minore
   le rendement *et* le risque. Chiffré ci-dessus.
2. **Ne pas ajuster les statistiques servies pour qu'elles collent à la courbe de la poche
   porteuse.** Les statistiques sont justes ; c'est la courbe qui manque.

## Contexte d'usage (pourquoi ça compte)

Ces données alimentent une API publique (`portfolio/v1/best/`) et une page de suivi. Aujourd'hui,
tout consommateur qui trace la courbe et en déduit son propre risque sous-estime le drawdown de 10
points. L'avertissement textuel protège un lecteur attentif, pas un script.

Tant que la courbe n'est pas servie, la position côté articles reste : publier les statistiques
servies, publier la courbe disponible, et **dire** l'écart. Rien ne sera reconstruit.

---

### Références (dépôt `articles`)

- `portfolio/v1/best/equity.json` — champs `engineBacktest.*`, `curve_warning`, `equityCurve`
- `data/dtx/best.json` — bloc `metrics` et sa `note` interdisant la reconstruction
- `scanner/20260812/_dtx/replay_best.json` — payload `DtxReplay` archivé, dont sortent les 4 lignes
  du tableau ci-dessus
- `.claude/REPRISE.md` — section « Reste ouvert — R6 »
