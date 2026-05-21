---
name: live-tracker-widgets
description: Live price tracker + embeddable widgets + CORS proxy convention. Auto-load when user edits assets/live-tracker.js, widget/**, mentions allorigins, Yahoo Finance proxy, live ticker, setup card prices, or widget gallery.
user_invocable: false
---

# Live Price Tracker (`assets/live-tracker.js`)

Script partagé pour prix temps réel sur setup cards. **OBLIGATOIRE pour scanner.**
```html
<script src="/assets/live-tracker.js"></script>
```
- Yahoo Finance via `api.allorigins.win/get` + Binance pour crypto
- Classification : TP2 Hit (or) → TP1 Hit (vert) → Trending (vert) → Entry Zone (ambre) → Underwater (rouge clair) → Near Stop (rouge) → Stopped (gris/grayscale)
- Cache sessionStorage 5 min, max 6 requêtes parallèles

## Proxy CORS — Convention Projet
**TOUJOURS** `api.allorigins.win/get` (pas `/raw` — pas de headers CORS) :
```javascript
var url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(yahooUrl);
fetch(url).then(r => r.json()).then(d => {
  var yahoo = JSON.parse(d.contents); // /get wraps dans { contents: "..." }
});
```
Fallback : `corsproxy.io` (peut retourner 403). **JAMAIS** `allorigins.win/raw`.

# Widgets (`/widget/`)
- **Galerie** : `/widget/gallery.html` — 6 types avec previews et embed code
- **Types** : `picks` (watchlist), `dashboard` (indicateurs), `regime` (VIX-based), `sector` (rotation), `movers` (top/flop), `radar` (risques)
- Régime dynamique : VIX < 15 RISK-ON, 15-20 NEUTRAL, 20-28 EARLY RISK-OFF, > 28 RISK-OFF
- Proxy : allorigins `/get` + Binance directe. Cache sessionStorage 5 min, polling 30s.
