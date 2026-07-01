---
name: live-engine-headless-debug
description: Les bugs de rendu du live-engine (scanner/status) NE se reproduisent PAS en Playwright headless (fetch allorigins + WS Yahoo bloqués). Tester au vrai viewport user OU demander un dump DOM console. Ne jamais dire "ça marche" sur un test headless pour un bug live-engine.
metadata:
  type: feedback
---

**Incident (2026-07-01, résolu après des HEURES de boucle) :** Trade History étirée à ~803px (730px de vide) sur fortress/aplus/bull/trendline. Cause introuvable pendant des heures car **irreproductible en Playwright headless**.

**Root cause :** `assets/live-engine-ui.js` `reorganizePanel(modeId)` enveloppe les sections du panel dans une grille 2-col `.lp-grid` (`@media min-width:1024`, cols ~816px+680px) et assigne `data-grid="positions"`/`"history"` à Open Positions + Trade History (~ligne 597-599). MAIS **aucune règle CSS ne place ces data-grid** → auto-flow côte à côte + `align-items:stretch` → Trade History collapsée (71px naturel) étirée à la hauteur d'Open Positions (803px). Fix : `.lp-grid>[data-grid="positions"],[data-grid="history"]{grid-column:1/-1;align-self:start}` (pleine largeur, hauteur naturelle ; `align-items:stretch` global gardé car l'equity span en a besoin).

**LEÇON CRITIQUE (why irreproductible headless) :**
1. Le bug n'apparaît qu'à **viewport large > ~1496px** (816+680) pour que la grille passe en 2-col. Mon test à 1400px → grille 1-col → pas de stretch.
2. `reorganizePanel` ne s'exécute QUE quand le **live-engine tourne** : il dépend du fetch `allorigins` + du **WebSocket Yahoo** (`wss://streamer.finance.yahoo.com/`), tous deux **CORS-bloqués / bloqués en headless**. En headless le live-engine ne wrappe jamais le panel → `.lp-grid` absente → bug absent.

**How to apply :** pour tout bug de rendu CLIENT piloté par le live-engine (`live-engine.js`/`live-engine-ui.js`, tmUpdateLive, reorganizePanel, updateScenarioBar) :
- Le comptage de lignes/hauteur en Playwright headless **MENT** (le live-engine ne tourne pas). Ne JAMAIS conclure "ça marche" sur cette base.
- Reproduire soit (a) au **vrai viewport user** en appelant manuellement `reorganizePanel(mode)` après load, soit (b) en demandant à l'user un **dump DOM console** (`getComputedStyle` du parent + hauteurs) sur sa page réelle — c'est ce qui a débloqué (parent = `.lp-grid`, `display:grid`, `cols:816px 680px`, `align:stretch`).
- Penser aux différences headless↔vrai navigateur : WebSocket, fetch cross-origin, viewport, cache navigateur, **délai deploy GitHub Pages ~10min + push-en-rafale qui annule les deploys**.
