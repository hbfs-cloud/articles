---
name: project-modes-expansion-and-redesign
description: Programme 2026-06 — ajouter modes crypto/metals/forex + refonte A→Z du site (impeccable) incl scanner/status
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cc653cd-e658-47d7-96ef-f273b4affc3e
---

Programme lancé 2026-06-14 (deux volets, à séquencer) :

**Volet A — Nouveaux modes multi-actifs (data/backend)** :
- **crypto** : dédié crypto (BTC/ETH/alts). Spécificité : marché **24/7**, pas de sessions, volatilité haute, données via Binance (déjà utilisé widget/live-tracker). Univers + screener dédiés.
- **metals** : or/argent/cuivre/... + **minières associées** (GOLD, NEM, FCX, etc.). Corrélations métal↔minières fortes (attention au cluster, cf [[project-fortress-mandate]]).
- **forex** : paires FX. Spécificité : **sessions** (Asie/Londres/NY), pas de "scanner du soir pour D+1" classique.
- Touche : `modes-config.json`, `sweep.js`, screeners, univers (americanbull-universe.json analogues), API `portfolio/v1`, gen-status-page. Chaque classe a ses horaires/conventions de date (cf [[feedback-scanner-date]] qui est equities-centric).

**Volet B — Refonte design A→Z via skill `impeccable`** :
- `PRODUCT.md` écrit (registre=product, système unifié brand+product, retail sérieux multilingue en/fr/ar/es/zh, voix FT/Economist+terminal, anti: crypto-bro/SaaS-générique/Bloomberg-overload/cream-AI).
- Principes: clarté avant densité, confiance par précision, un système 5 langues mobile-first (RTL arabe), perf honnête, multi-actifs cohérent.
- DESIGN.md à générer (`/impeccable document` sur report.css existant = baseline).
- Cibles: `index.html` (landing 6 tabs), `scanner/status` (dashboard modes), articles. CSS unique `/assets/report.css`.
- A11y prioritaire: mobile-first dense (explicite), RTL arabe, P&L colorblind-safe, WCAG AA, reduced-motion.
- Config live mode: `.impeccable/live/config.json` (index.html + scanner/status/index.html).

La multiplication des modes (volet A) change le dashboard scanner/status → la refonte (volet B) doit anticiper N modes par classe d'actif (grouper par classe : Actions / Crypto / Métaux / Forex).

**MAJ 2026-06-14 (corrections post-refonte) :**
- **Identité = BLEU AZUR du logo**, PAS terracotta. Le logo `/logo.svg` est `#50b4ee` (≈ `oklch(73.5% 0.125 237)`). La 1ère passe avait pris un accent terracotta (hue 28) → rejeté par l'utilisateur ("on devrait être plutôt bleu comme le logo"). Accent token = `oklch(46% 0.13 237)` (assombri pour AA sur surfaces claires), `--accent-wk`/`--accent-ink` même hue. Rotation pure de hue (28→237) sur report.css + style.css + sidebar.css + index.html + gen-status-page.js inline + scanner/status, préservant L/C donc le contraste WCAG-AA déjà QA. Bénéfices : l'accent ne collait plus à la loss-red (hue 25) ; tag "theme" lane corrigée en violet (300) au lieu d'être mappée sur l'accent. theme-color = `#50b4ee`. NB : hue 237 (azur cyan du logo) ≠ hue ~264 (bleu SaaS générique #2563eb anti-réf) — distinct.
- **Modes draft cachés du public** : crypto/metals/forex sont `status:draft` (pas opérationnels). Cachés du dashboard (`gen-status-page.js` : filtre `NON_PUBLIC_STATUSES={stopped,draft}`) ET de l'API publique (`gen-api.js` : filtre `draft` seulement, garde stopped tkl/alpha). Réapparaissent automatiquement une fois promus via `set-mode-status.js` (draft → test/deploying). Dashboard à classe unique (equity) → pas de labels de classe (`showClassLabels = populatedClasses.length>1`).
- Reste à faire (#7, reporté) : tuner crypto/metals/forex au mandat ≥3×SPY/DD≤8% AVANT de les passer en draft→test (cf [[project-mode-success-criteria]]).
