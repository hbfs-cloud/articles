# Demande MCP marketdata — couverture EU pour scanner PEA (à l'owner du MCP)

> Brief technique prêt à envoyer à l'équipe data / owner du MCP `marketdata`.
> Contexte : on veut construire un scanner **EU small-cap PEA-éligible** 100% MCP (pas de fetch local).
> Diagnostic mené le 2026-07-11 via QueryData/RunScreener/GetReferentialData.

---

## TL;DR

Le MCP sert **très bien** l'EU **en per-ticker** (`QueryData` : prix, mcap, devise EUR, 52w, float, et
surtout le **domicile** via `profile.country`). Mais **deux trous indépendants** rendent impossible la
construction d'un *scanner* EU sans fabriquer de données — ce que notre règle interdit (MCP HARD STOP,
zéro fabrication). Il ne s'agit **pas** d'un incident réseau : `GetStatus` = healthy (22 773 symbols,
bar_service ready, build 2026-07-08). C'est une **couverture données EU insuffisante**.

## Ce qui MARCHE aujourd'hui (à conserver)

`QueryData(symbols="AIR.PA", types="quote,profile,stats,metadata")` renvoie correctement pour l'EU :
- `quote` : price, marketCap, volume, 52w, devise EUR
- `profile` : **country/domicile** (AIR.PA→Netherlands, ALO.PA→France, VLA.PA→France…) — c'est le
  **seul discriminant PEA fiable** exposé, et il est correct
- `stats` : float, shares, beta
- `metadata` : venue + currency (mais **pas** de country ici)

## Blocker 1 — Pas d'historique OHLCV EU

`QueryData(symbols="AIR.PA", types="bars_daily")` ne renvoie que **~3 séances** (earliest bar =
2026-07-08). Conséquence : **aucun indicateur calculable** (RSI/MACD/EMA/ATR/breakout, momentum 12-1,
volatilité réalisée) ni niveau entry/stop (1.5×ATR)/target. Un scanner momentum/technique est impossible.

**Repro :** `QueryData(symbols="AIR.PA,SAP.DE,ASML.AS", types="bars_daily", days=400)` → ~3 barres au lieu
de ~250+.

## Blocker 2 — Pas d'énumération de l'univers EU

Impossible de *lister* les titres EU pour seeder un univers :
- `RunScreener(region="eu", pass_expr="close > 0", force_async=true)` → **0 candidat** pour TOUT
  `pass_expr`. Cause : gate 200 barres (log : « 3764/3764 symbols skipped: insufficient history <200 bars
  before as_of »). ⚠️ Sur le chemin **switcher** un warning est émis, mais sur le chemin **custom
  pass_expr** c'est **0 SILENCIEUX** (pas de warning `warnings[]`) — trompeur.
- `RunAutoScreener(region="eu")` → même gate 200 barres.
- `GetReferentialData(region="eu")` → **ignore la région** et renvoie la **DB US** (NVDA, GOOGL… ; 0 ticker
  EU ; pas de colonne country). Donc aucun moyen d'énumérer l'univers EU + son domicile.

## Ce dont on a besoin (par priorité)

1. **[RACINE] Backfill de l'historique OHLCV EU à ≥ 250 barres quotidiennes** (idéalement 2–5 ans, comme
   l'US) dans **le cache du screener ET dans `QueryData bars_daily`**. Débloque à la fois le gate 200-barres
   du screener ET le calcul des indicateurs/ATR. C'est le fix racine — sans lui rien d'autre ne sert.
   **Critère d'acceptation :** `QueryData(symbols="AIR.PA", types="bars_daily", days=400)` renvoie ≥ 250
   barres ; `RunScreener(region="eu", pass_expr="close>0")` renvoie > 0.

2. **`RunScreener(region="eu")` opérationnel** une fois les barres présentes, **ET** émission d'un
   `warnings[]` explicite sur le chemin **custom pass_expr** quand des symboles sont skippés (aujourd'hui
   0 silencieux). **Critère :** un pass_expr technique (`rsi14 < 40 && close > ema200`) renvoie des
   candidats EU, et tout skip massif est signalé dans `warnings[]`.

3. **Vraie énumération EU** : soit un **filtre `region` réellement appliqué** sur `GetReferentialData`
   (aujourd'hui ignoré), soit une **reference-list EU dédiée** — **avec une colonne `country`/HQ** pour
   filtrer le domicile PEA (UE/EEE, exclure UK/US et cross-listings) dès l'énumération.
   **Critère :** un appel d'énumération EU renvoie une liste de tickers EU avec leur pays de domicile.

4. **Exposer `country` dans les rows candidats du screener** (et idéalement dans `metadata`). Aujourd'hui
   le domicile n'est dispo que via `QueryData profile` — un appel **par ticker**, OK pour l'enrichissement
   mais pas pour énumérer/filtrer un univers PEA en une passe.

5. **Combler des gaps secmaster EU** repérés au passage :
   - `STLA.MI` → aucun quote/metadata
   - `BC8.DE` (Bechtle) → `marketCap = 0`
   - `VWS.CO` (Vestas) → marketCap semble libellé en **DKK** au lieu d'EUR

## Note d'éligibilité PEA (pour cadrer le besoin #3/#4)

L'éligibilité PEA se juge sur le **domicile de la société** (pays du siège ∈ UE/EEE), **pas** la place de
cotation. Ex. `NVD.DE` cote à Francfort mais = NVIDIA (US) → **non PEA-éligible**. D'où l'importance d'une
colonne `country`/HQ **au niveau de l'énumération**, pas seulement en per-ticker.

## Impact / statut côté articles

Tant que #1 (backfill OHLCV EU) n'est pas livré, le mode scanner `eu_smallcap` reste **bloqué** (spec
figée `docs/specs/eu-smallcap-pea-scanner.md`, workflow prêt à rejouer). Dès que l'EU est backfillé +
énumérable, on active le mode sans autre dev côté MCP. Idem `etf_eu` et tout mode EU (momentum EU).
