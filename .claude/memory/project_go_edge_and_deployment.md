---
name: go-edge-and-deployment
description: Edge prouvé systematic-tss = volume-surge + range-expansion (le reste = bruit). highvol $3M = 89% CAGR. Décision déploiement highvol-concentré vs core-4 = arbitrage risque du user.
metadata:
  type: project
---

Finalisation systematic-tss (2026-07-03, commits Go 0e809320 + e2164c7d).

**Edge prouvé (data-driven, univers gaté honnête, US+DE)** : le SEUL signal stable =
**volume-surge + range-expansion**. Trend / momentum / RSI / distMA = **bruit** (le signe
s'inverse chaque année). Highvol survit *parce qu'*elle trade ce signal.

**Chiffres honnêtes (gate établi retail)** :
- **highvol** (gate $3M) : **89% CAGR / DD 27.7% / Sharpe 1.86** — Pareto-strict, le champion.
- **core-4** diversifié (highvol 50% + hybrid 20% + uk-selective 20% + forex 10%) :
  **70% CAGR / DD 23% / Sharpe 1.30** — `config/portfolio_core4.yaml`.

**Gate établi — valeurs Go ACTUELLES par stratégie** (elles ont bougé — TOUJOURS resync avant
port/deploy) : highvol **$3M**, portfolio_us/hybrid **$5M**, uk-selective **$3.95M**,
de_highvol $2M, large-cap sleeve $750M. `established_lookback_days: 60`. Côté articles : gate
highvol-scanner synced $5M→$3M (commit 73ef20633). ETF/forex NON gatés côté Go (liquides) — ne
pas en ajouter = fidèle.

**Multi-marché** : cloner le scanner US sur un autre marché ÉCHOUE (magnitude US-concentrée) ;
il faut une stratégie NATIVE (uk-selective marche : 50% / SR 1.81). → uk-selective nécessite un
univers UK + scanner natif côté articles (infra absente).

**DÉCISION (arbitrage risque du user, NON tranchée par l'agent)** :
- highvol concentré (89%/28%/1.86) = maximiser, encaisser 28% DD.
- core-4 diversifié (70%/23%/1.30) = « sommeil tranquille », assurance contre l'échec d'une
  strat en live. Recommandé vu le thème de la session (ne pas surfaire un chiffre unique).
→ On porte les DEUX en `draft` (draft n'engage rien) ; le user choisit lequel passe `live`.

**Réutilisable** : `scripts/edge_discovery.py` (Go) + colonne DollarVolume PIT — détection d'edge
tout-marché. Outil de référence pour valider tout futur signal.

Lié : [[scripted-modes-scorecard]], [[frozen-portfolio-aware]]. Moteur articles : regimeParams
(A1 positions + A2 stops par régime, opt-in) supporte désormais la fidélité Go.
