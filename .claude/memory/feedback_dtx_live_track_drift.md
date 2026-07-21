---
name: dtx-live-track-drift
description: "Modes scriptés : historique live append-only + drift backtest↔live obligatoires — incident 2 semaines sans trace (13-21/07/2026)"
type: feedback
---

# Modes scriptés : l'historique live et le drift ne sont pas optionnels

**Incident (21/07/2026)** : deux semaines après le go-live des 6 modes dtx (13/07), la page
scanner/status n'avait accumulé AUCUN historique live et ne calculait AUCUN drift. Cause : le
segment « live » dépendait de la courbe equity du sweep, qui stagne dès qu'un mode n'a ni trade
clos ni point de scan (arrêtée au 15/07) ; et la promesse « backtest≈live » n'était vérifiée
nulle part.

## Règles

1. **Série live append-only** : `data/dtx-live-track.json`, un point réel par soirée de pipeline,
   écrit par `gen-status-page.js`. Immuable entre jours ; au sein d'une journée, seul le DERNIER
   point peut être rafraîchi (un run de mi-journée ne verrouille jamais le point du soir). Jamais
   de point interpolé — un trou = un soir sans pipeline, et il doit rester visible.
2. **Drift backtest↔live** : return live cumulé vs return du segment [go-live → J] extrait du
   replay moteur COMPLET (delta relatif — les fenêtres courtes isolées sont en DATA FAILURE côté
   serveur, et un return de segment absolu isolé n'est pas fiable). Seuils |d| : <2pp OK,
   2-5 WATCH, >5 ALERT. WATCH/ALERT → rapport + Telegram alerts.
3. **Fail-closed sur la couverture** : pas de drift sans point ÉCHANTILLONNÉ strictement après le
   go-live. Un cache OHLCV qui s'arrête avant la fenêtre produit le même « plat » qu'un vrai
   zéro-fill — end_date/final_equity ne prouvent rien.
4. **Garde anti-régression** : `qa-check` 25c warn si la série a >72h de retard sur un des 6 modes.
   Procédure nocturne : skill scanner-pipeline §dtx étape 6.

Lié : [[mcp-first-discipline]], [[segment-replay]], [[pipeline-gotchas]].
