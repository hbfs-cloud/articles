---
name: prediction-markets-in-regime-facets
description: data/regime.json porte facets.prediction_markets (probabilités Polymarket) et facets.regime.transition_5d — collectés à chaque édition et presque jamais utilisés.
type: feedback
---

Le weekly 20260914 écrivait « sans inférer le sens de la décision » alors que son propre socle
certifié donnait le partage du FOMC du 16 : 78,5 % pour une hausse de 25 pb, 20,5 % pour un statu
quo, 0,4 % pour une baisse (volume de 27,8 M$ sur le contrat de hausse). Zéro occurrence de
« Polymarket » ou « marché de prédiction » dans la page, alors que le CLAUDE.md racine demande
explicitement de les intégrer dans Macro, Outlook et matrice des risques.

**Why:** c'est l'information la moins consensuelle du socle et elle change la forme du problème —
« on attend de voir » devient « le sens est price, reste la formulation ».

**How to apply:** pointeurs utiles de `_data/regime.json` :
`/facets/prediction_markets/items/<i>/yes_price` (render `scale:100`),
`/facets/regime/transition_5d/{crisis,early_risk_off,neutral,risk_on}` (dégradation à 5 séances),
`/facets/regime/current_state_confidence`. Et `_data/regime_systematic.json` porte `vix_sma14` +
`vix_rising`, les deux vrais chiffres de prudence quand le régime est risk-on.
