---
name: market-namespaced-price-cache
description: Le cache prix DOIT être namespacé par marché (US/ vs CVA/) — sinon collision de ticker (SNA = Snap-on US $402 vs Stokvis Nord BVC 73 MAD). bvc-fetcher lit le cache d'abord → renvoyait le prix US pollué.
metadata:
  type: feedback
---

**Incident (2026-07-01) :** Le mode casablanca affichait SNA à **$402** au lieu de **~73 MAD**.
Cause racine = **collision de ticker dans un cache prix flat partagé**. `data/.price-cache/SNA_ohlcv.json`
contenait les données US (Snap-on, $402) écrites par un scanner US (Yahoo), et `bvc-fetcher.js` **lit
le cache AVANT de fetcher** (ligne ~74) → il renvoyait le prix US pour le ticker BVC "SNA" (Stokvis
Nord, isin MA0000012700, ~73 MAD). Les picks/scores du casablanca-scanner étaient donc faussés.

**Fix (validé) :** namespacer le cache **par marché**.
- `tools/lib/bvc-fetcher.js` : `CACHE_DIR = data/.price-cache/CVA/` (Casablanca).
- `tools/sweep.js` loadCachedPrice : fallback BVC lit `CVA/${ticker}_ohlcv.json`.
- Résultat : `CVA/SNA_ohlcv.json` close = 73 MAD (vrai BVC), isolé du cache US flat.

**Règle :** tout ticker peut exister sur plusieurs marchés (SNA, RDS, etc.). Un cache prix keyé par
ticker seul = collision garantie. Namespacer par marché (`US/`, `CVA/`, futur `EU/`…). Idem pour
tout nouveau fetcher (crypto/metals/forex) : ne jamais partager un namespace de cache avec les US.

**How to apply :** pour un mode scripté marché-étranger, TOUJOURS (1) cache séparé par marché,
(2) valider les prix contre le backtest Go de référence (`tss-orders.js --mode <m>` sort les prix MAD
du PM — casablanca Go tient RDS@164/HPS@610 MAD), (3) chart → site du marché (casablanca-bourse.com/
fr/live-market/instruments/<ticker>, ticker-based), pas FinViz (US-only). Lié à [[scripted-modes-tss-order-parity]].
