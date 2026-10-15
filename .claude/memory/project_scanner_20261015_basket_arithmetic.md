---
name: scanner-20261015-basket-arithmetic
description: Scan du 15/10/2026 publié à 4 actions + 2 ETF sur dérogation du propriétaire — arithmétique des plafonds (grappe 2, famille 50 %), doublons de lignes encore ouvertes, étagère S-3ASR déposée dans la fenêtre, et pièges d'outillage rencontrés.
metadata:
  type: project
---

**Décisions du propriétaire (2026-10-15, ~10 h 55 Paris), pour ce seul scan.** (1) Une ligne publiée
encore ouverte (TJX et WMT, exécutées le 13/10) n'est pas republiée : « 5 actions + 2 ETF ». (2) Kroger
sort sur la politique telle qu'écrite : une étagère universelle S-3ASR déposée DANS la fenêtre de dilution
bloque même si elle n'a été tirée qu'en obligations (une étagère déposée avant la fenêtre et jamais tirée en
actions est seulement décrite, comme NVDA/AMGN/SN le 13/10). (3) Dérogation au plancher : 4 actions + 2 ETF,
date ajoutée à `ALLOWED_DATES` de `tools/lib/basket-minimum-waiver.js`.

**Arithmétique à vérifier AVANT de choisir le panier.** Les deux ETF sortent du crible `autoscreen_etf`,
donc famille Momentum. Plafond par famille = floor(50 % × lignes) : 8 lignes → 4/4, donc 6 actions + 2 ETF
exige au moins 2 actions Momentum ; 7 lignes → 3/3, donc 5 + 2 est IMPOSSIBLE sans un repli (Pullback). Le
gate G2 `etf_lookthrough` compte TOUTES les lignes par grappe (secteur pour une action, grappe look-through
pour un ETF), plafond 2 : avec un ETF santé et un ETF énergie, il ne reste qu'une place d'action dans chacun
de ces secteurs.

**Pièges d'outillage du run.**
- `plans/scanner-verify-candidates.json` : 12 symboles au plus par lot, 4 lots → élaguer à 48 AVANT la vérification, avec un motif écrit par nom.
- `plans/scanner-final-evidence.json` : `stockcsv` 6-8, `sec1..3` = 2 chacun, `sec4` 1-2 → il faut 7 symboles pour les lots SEC ; ajouter un remplaçant.
- `downstream-split.sh compute` lance `gen-mode-cards` en parallèle de `gen-api` : la carte lit `portfolio/v1/<mode>/positions.json` encore daté de la veille (« Positions indisponibles »). Relancer `node tools/gen-mode-cards.js` après le compute.
- `_symbol-exclusions.json` est lié par empreinte à la chaîne C (`data/scanner-positions.json`) : ne jamais le retoucher après coup.
- Contrôler le jour de la semaine de la fin d'horizon : « mardi 28 octobre » (faux, c'était un mercredi) est passé sous les validateurs et la revue Senior QA du premier tour ; seule la Retail War Room l'a vu.
- Un 8-K item 3.02 lu sur l'index EDGAR ne prouve pas « acquisition payée en actions » : écrire ce que disent les codes d'items tant que le document primaire n'est pas lu.

Voir [[project_scanner_20260924_owner_decisions]] (dérogation précédente) et [[feedback_scanner_filter_before_enrich_order]].
