---
name: stale-frozen-api
description: gen-api.js skip les modes absents du snapshot → leurs fichiers portfolio/v1 publiés restent gelés (stale) et ne se corrigent jamais. Les modes stopped doivent être réconciliés explicitement.
metadata:
  type: feedback
---

Quand un mode passe **stopped**, sweep.js + gen-status-page.js le retirent des nouveaux snapshots. Mais **gen-api.js skippait tout mode absent du snapshot** (`if (!mode) continue`) → ses fichiers `portfolio/v1/<mode>/trades.json` etc. restaient **gelés au dernier jour live** (quand il portait des trades `pending` en mark-to-market). Résultat: `positions.json`=0 (vidé par un run ultérieur) mais `trades.json` montrait encore 14 pending → **API auto-contradictoire, jamais auto-corrigée**.

**Fix (2026-07-01, gen-api.js):**
- `reconcileStoppedMode(id)`: pour un mode stopped/liquidated absent du snapshot, HEAL les fichiers publiés — pending→liquidated (exitDate=statusSince, pnl/exitPrice inchangés, 0 rewrite), vide positions/orders/actions, rafraîchit le status sur les 8 endpoints.
- Main loop appelle reconcileStoppedMode au lieu de skip.
- writeMode() terminalise aussi si un mode stopped est encore dans un snapshot frais.
- Bonus trouvé: metals/forex stopped publiaient un BUY order stale (VOR) + status block faux.

**Why:** Un mode stopped ne doit avoir AUCUNE position ouverte nulle part. Skip = fichiers publiés figés qui divergent silencieusement.

**How to apply:** Après tout changement de status vers stopped/liquidated, vérifier que `portfolio/v1/<mode>/trades.json` pending-count === positions.json === 0. Ne JAMAIS skip un mode dans gen-api sans réconcilier ses fichiers publiés. Respecter l'immutabilité: seul pending→closed est une transition légitime (pas un rewrite de trades scellés). Lié à [[sweep-config-enforcement]] et [[mode-status-machine]].
