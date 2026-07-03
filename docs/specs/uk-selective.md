# Spec — mode UK Selective-Momentum (natif LSE)

**Auteur (plan)** : Fable · **Implémenteur cible** : Opus (port scanner natif) + Sonnet (univers/wiring) · **Workflow** : dynamic
**Statut** : BLOQUÉ sur MCP marketdata (univers LSE réel requis) · **Cible Go** : CAGR 37.3% / DD 12.65% / Sharpe 2.19

## Pourquoi
Sleeve du `core-4` diversifié (20%). Le Go note qu'un simple clone du scanner US sur un autre marché
ÉCHOUE (magnitude US-concentrée) — uk-selective est une **stratégie NATIVE** qui marche. Donc port fidèle,
pas `fractal-scanner --universe uk`.

## Étapes
1. **Univers** (MCP REQUIS) : construire `data/uk-universe.json` — constituants LSE liquides (FTSE 350 ou
   sous-ensemble), tickers au format Yahoo (`HSBA.L`, `SHEL.L`…). Source via `GetInstruments region=uk`
   ou liste statique vérifiée.
2. **Scanner natif** : confirmer d'ABORD la vraie stratégie Go `uk-selective` (config systematic-tss
   `portfolio_core4.yaml` sleeve uk). Porter en `tools/uk-scanner.js` fidèle (PAS fractal générique).
   Émettre un tag reconnu par `detectStrategy` (sweep) + `universe` field pour le gate `universeFilter='uk'`.
3. **Gate établi** : $3.95M (valeur Go actuelle uk), lookback 60 — via le pattern déjà porté
   (`calcDollarVolumePercentile(bars, 60, 0.50)`).
4. **Mode draft** : `assetClass='uk_equity'`, `universeFilter='uk'`, params du sleeve Go, `regimeParams`.
   Wirer le scanner dans `.claude/skills/scanner-pipeline.md`.
5. **Validation** : via Phase D (backfill PIT UK).

## Gotchas
- **GBp vs GBP** : Yahoo cote les .L en pence (GBp). Attention échelle prix/entry/stop (÷100) — vérifier
  la cohérence avant de trader des niveaux.
- **Calendrier LSE** ≠ US (jours fériés UK). Le fetch Yahoo daily gère le calendrier natif.
- Confirmer que le fetch Yahoo (`query1.finance.yahoo.com`, style forex-scanner) fonctionne pour les .L.
- MCP HARD STOP en vigueur.

## Dépendance
Non déployable sans Phase D (`[[phase-d]]`) pour la validation full-period.
