---
name: repo-facts
description: Faits opérationnels du repo NON couverts par CLAUDE.md — hosts infra (ser/hetzner/discord-bot/schedules), proxy live-price (allorigins /get), widget system, gotchas domaine/URL. Promu depuis la prose de MEMORY.md lors de la réduction de l'index à des pointeurs purs (2026-07-21).
metadata:
  type: reference
---

# Faits opérationnels (hors CLAUDE.md)

**Infra / hosts**
- **ser** : `ssh -i ~/.ssh/id_ed25519_ci ci@ser.tail5d09f.ts.net` — Ubuntu 22.04, 16 cores, 27GB RAM, Nomad + Docker. Héberge le **TimesFM forecast service** (voir [[timesfm]]). Hetzner : voir [[reference-hetzner]].
- **Discord bot** : `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/` — exécute `claude -p` via tmux. `schedules.json` = 4 tâches actives (scanner Lun-Ven 23h #1, daily 7h #2, weekly Dim 18h #3, rétro Ven 23h #4).
- **Lab** : dashboard Evidence.dev dans `lab/` (DuckDB WASM).
- **Déploiement** : GitHub Pages auto sur push `main` (~10 min ; une rafale de push annule les deploys en cours).

**Live price tracking (client-side)**
- Proxy CORS : `api.allorigins.win/get` (**PAS `/raw`** — pas de headers CORS). Réponse `{contents:"…"}` → `JSON.parse(d.contents)`. Fallback `corsproxy.io` (souvent 403).
- `assets/live-tracker.js` (partagé scanner + blood-in-the-streets), `price-tracker.js` (blood-in-the-streets), widget = allorigins pour Yahoo + Binance direct crypto.
- Régime client dérivé du VIX : <15 Risk-On · 15-20 Neutral · 20-28 Early Risk-Off · >28 Risk-Off.

**Widget system** : `/widget/?mode=tape|vertical|embed` (watchlist A+ depuis `mcp/watchlist.json`) ; `/widget/gallery.html` (dashboard/regime/sector/movers/radar) ; iframe self-contained responsive 380px+, dark/light.

**Gotchas (hors CLAUDE.md)**
- `dailytickers.com/daily/...` → **404** : les articles sont sur `articles.dailytickers.com`.
- Ticker EU long (AIR.PA) dans une URL parqet → utiliser le ticker court (AIR).
- CSS inline qui override les classes globales → à supprimer (les classes de `report.css` font foi).

**Why** : ces faits vivaient dans la prose de MEMORY.md (qui doit rester un index pur de pointeurs) et ne
sont pas dans CLAUDE.md. **How to apply** : réflexe infra/live-tracking/widget — vérifier ici avant de
ré-inventer un host, un proxy ou une convention d'URL.
