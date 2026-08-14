---
name: mandat-single-page-site
description: Projet différé (2026-08-14) — site ultra-simple une page présentant le portefeuille dtx « mandat » (ordres du jour, trades, equity curve, metrics, jauge de bande 60-85%)
type: project
---

# Mandat — site une page (différé, décidé le 2026-08-14)

**Demande user** : un site ultra-simple, UNE page, présentant uniquement le portefeuille **`mandat`**
du moteur systematic (« Mandat 70/30 — cœur BEST v2 (bande 60-85%) + panier SCHD/PDBC/GLD », créé
2026-08-12). Contenu : ordres du jour, trades passés, equity curve, metrics — dans l'esprit de
`scanner/status` mais épuré. Clarification importante : c'est bien **mandat**, PAS book_honest
(première formulation corrigée par le user).

## Design retenu (discussion 2026-08-14, rien d'implémenté)
- Page **statique unique** alimentée par des JSON commités, régénérée par la routine nocturne —
  ZÉRO appel MCP côté client (OAuth). Style terminal épuré de scanner/status.
- **Plomberie à ajouter** : mandat n'est PAS câblé dans le pipeline quotidien (seul `best` est stagé,
  `DTX_STAGING_MAP={best}`). Il faut : DtxDecide+DtxReplay quotidiens pour `mandat` → staging JSON
  dédié → historisation append-only (démarrage propre à J0, config toute fraîche) → `gen-mandat-page.js`.
- **Contenu clé** : ordres (decide), trades/positions, equity replay+live splice, metrics
  (CAGR/DD/Sharpe/WR), **jauge de la bande d'exposition 60-85%** (signature du portefeuille),
  répartition cœur/panier (SCHD/PDBC/GLD).
- **Vigilances actées** : ordres publiés POST-exécution ou en différé (le cœur best contient du
  small cap front-runnable ; les ETF s'en fichent) ; badge `as_of` + warning stale >24h dès la v1.
- **Question ouverte** : emplacement — `/mandat/` sur articles.dailytickers.com ou sous-domaine
  dédié `mandat.dailytickers.com` (le second isole mieux si c'est l'embryon d'une offre à part).

Effort estimé : petit-moyen (extension staging nocturne + script génération + page).
