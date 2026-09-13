---
name: scanner-execution-not-certified
description: Au 13/09/2026 les performances publiées des modes scanner sont hypothétiques (aucun fill attesté) ET brutes (sweep.js ne modélise aucun coût) — régler des paramètres contre ce chiffre ajuste du bruit biaisé à la hausse.
type: project
---

Établi le 2026-09-13 en croisant `scanner/retrospective/20260912-audit/audit-findings.json` et le code :

- `execution_certified:false` — 56 propositions, 0 confirmation d'activation attestée, 17
  enregistrements VWAP nuls, allocation automatique rejetée les 31/08 et 01/09.
- `loss_concentration_24_aug_pct: 95.9` — une séance porte 96 % des pertes (défaut de corrélation,
  pas de sélection).
- `stop_gap_excess_loss_r: 0.909` — près d'un R perdu AU-DELÀ du stop : les stops sont franchis par
  des écarts d'ouverture, pas touchés.
- `pullback_without_ftnt_mean_r: −0.388` — la variante pullback est négative sans son unique gagnant.
- `tools/sweep.js` (3 327 lignes), `validate-config-change.js` et `pit-engine.js` : **zéro**
  occurrence de slippage / commission / frais / spread / borrow.

**Ordre de travail retenu :** P0 terme de coût dans sweep.js + champs TCA sur l'enregistrement de
trade (prix au signal, prix de décision, prix exécuté, spread, volume à l'ordre — le schéma actuel
n'a que actualEntry/vwap/exitPrice) ; P1 dimensionner sur le risque de gap et rejouer la séance du
24/08 contre la porte de corrélation ; P2 supprimer la variante pullback ; P3 remplacer le gate
« backtest 30 jours qui bat la config » par la règle de décision de
[[zero-euro-data-stack-brevan-howard]] (§20). `validate-config-change.js` a déjà walk-forward + 70 %
hors échantillon + regime-aware : il lui manque les coûts et une période finale jamais utilisée.
