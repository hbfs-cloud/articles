---
name: rotation-indices
description: Page /rotation/ refondue le 5 novembre 2026 — rotation dans S&P 500, Nasdaq-100, Dow Jones et places étrangères (ETF à New York), graphiques animés séance par séance ; pièges de données rencontrés.
metadata:
  type: project
---

Livré le 5 novembre 2026 (demande du propriétaire : « charts qui montent de façon dynamique et fiable », rotations par thème, capitalisation, secteur, région, type de risque).

- **Collecteur** : `tools/gen-rotation-indices.js` → `data/rotation-indices.json` (page) ; `--snapshot` fige une copie pour un article (ex. `daily/20261105/rotation-indices.json`). Branché en fin de chaîne D de `tools/scan-marketdata-only.sh`, non bloquant. Fenêtre événement active dans `config/rotation/event.json` (base, label, until).
- **Composant** : `assets/rotation-race.js` (`DTRotation.race/lines/heat/bars`), réutilisable dans daily/weekly.
- **Pièges** :
  - indices locaux (^KS11, ^STOXX50E, ^GDAXI…) servis mais non certifiables (pas de calendrier de place) → ETF cotés à New York ; EWY = MSCI Korea, pas le Kospi exact ;
  - trou d'archive serveur du 21 au 24 juillet 2026 sur ~130 titres → fenêtre de 72 séances, pas de cumul depuis le 1er janvier ;
  - GetMarketUniverseConstituents : 32 instantanés paginés par utilisateur, puis blocage d'environ 4 h → compositions mises en cache 7 jours dans `config/rotation/membership.json` ;
  - la quote donne la capitalisation de toute la société pour chaque catégorie d'actions (GOOG/GOOGL, FOX/FOXA, NWS/NWSA) → liste explicite, jamais d'heuristique (HON/HONA est une scission 1 pour 1, deux sociétés) ;
  - bêta contre SPY sur 71 séances instable (AAPL corrélation 0,09) → volatilité réalisée ;
  - ECharts `realtimeSort` trie sur la longueur dessinée (valeur absolue) → barres décalées depuis le bord gauche, zéro en trait.
- **Daily** : les agrégats titre par titre ne passent pas `validate-content-claims.js` (aucune formule d'agrégat). La prose ne les chiffre pas : chaque phrase qualitative est vérifiée par une assertion dans `_build.cjs`, et les chiffres d'ETF passent par une collecte `daily-themes` (6 symboles au plus, 15 séances).

**Why:** une page « fiable » ne doit jamais publier un indice local non certifié ni un agrégat faussé par une double catégorie d'actions.
**How to apply:** pour réutiliser ces graphiques dans un article, figer un instantané avec `--snapshot`. Voir [[rotation-beta-page]].
