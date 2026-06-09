# DailyTickers — Audit Complet & Plan d'Action

> Audit réalisé le 9 juin 2026 par un panel de 5 experts (Security, QA Senior, Trader Senior, Risk Manager, Hedge Fund Director).
> 27 agents, 102 findings, 21 vérifiés indépendamment, 19 confirmés critical/high.

## Scores Globaux

| Dimension | Score /10 |
|-----------|-----------|
| Sécurité | 4 |
| UI/UX | 6 |
| Valeur Trading | 6 |
| Risk Management | 5 |
| Business Readiness | 3 |
| **Overall** | **5** |

---

## P0 — IMMÉDIAT (aujourd'hui)

- [ ] **[SEC-001] Pre-commit guard .env + rotation secrets** `improve` `1-2h`
  - `.env` contient API key Anthropic + token Telegram en clair
  - Un `git add -A` du Discord bot suffit à les exposer publiquement
  - Rotate Anthropic key (console.anthropic.com) + Telegram token (BotFather /revoke)
  - Ajouter au pre-commit hook : bloquer tout staging de `.env`
  - Installer gitleaks pour détection pattern-based
  - *Experts : Security (3 experts convergent)*

- [ ] **[SEC-002] Arrêter de déployer tout le repo sur GitHub Pages** `improve` `2-3h`
  - `deploy.yml` line 30 : `path: .` upload le repo entier
  - `tools/*.js`, `mcp/server/*.js`, `CLAUDE.md`, `package.json` sont publiquement accessibles
  - Vérifié : `/mcp/server/index.js` et `/tools/notify-scanner-status.js` retournent HTTP 200
  - Fix : créer étape `dist/` dans le workflow, copier uniquement les fichiers publics
  - *Experts : Security + Business Readiness*

---

## P1 — CETTE SEMAINE

- [ ] **[TRD-003/RISK-005/PROD-002] Pause Fortress & TKL + afficher warnings OOS** `improve` `1 jour`
  - Fortress : IS PF 6.65 → OOS PF 0.77 sur 24 trades (net loser)
  - TKL : IS PF 2.81 → OOS PF 0.80 sur 14 trades (net loser)
  - Status page affiche CAGR 95-1287% sans aucune référence OOS/overfit
  - Les données `oosWarn` sont calculées par `gen-status-page.js` (L462-473) mais jamais rendues
  - Fix : `set-mode-status.js --mode fortress --to pausing`, idem TKL
  - Ajouter gate OOS dans `canTransition()` : bloquer `deploying→live` si OOS PF < 1.0 pour n >= 20
  - *Experts : Trading + Risk + Business Readiness*

- [ ] **[TRD-022/TRD-015/RISK-005] Remplacer CAGR par rendements absolus** `remove` `3-4h`
  - Turbo 1225%, Dynamic 801%, Balanced 469% = annualisé sur 3.5 mois de bull market
  - Aucun fonds professionnel ne publie de CAGR annualisé sur < 6 mois
  - `equity.json` contient déjà le warning "No bear-market test" mais invisible sur la status page
  - Fix : afficher "+108.6% depuis Feb 26" au lieu de "1225% CAGR"
  - Ajouter badges "small n" et "bull-market only" sur les Sharpe > 3.0
  - *Experts : Trading + Risk + Business Readiness*

- [ ] **[RISK-002] Activer correlationCap TKL + cross-mode exposure limit** `improve` `4-6h`
  - TKL : `correlationCap=0` → `sweep.js` L1142 et `pit-engine.js` L545/672 skip les checks
  - `crossModeDedup=false` sur les 7 modes : même ticker dans 5 modes simultanément
  - Fix : TKL `correlationCap=0.7`, ajouter check cross-mode dans `gen-api.js` (warning si ticker > 3 modes)
  - *Expert : Risk Manager*

- [ ] **[TRD-008] Corriger TKL slots négatifs** `improve` `1-2h`
  - `slotsAvailable: -2` (12 positions dans un portfolio de 10 slots)
  - Combiné avec OOS PF 0.80, R2 0.498, corrélation max 0.81
  - Fix : fermer 2 positions lowest-conviction + transition `pausing` vu la perf OOS
  - *Experts : Trading + Risk*

- [ ] **[SEC/PROD] Privacy Policy + cookie consent GDPR** `add` `1 jour`
  - GTM (GTM-T5Z595CW) sur toutes les pages, Google Fonts transfère les IPs
  - Site cible EU (français) et MENA (arabe) — GDPR et lois similaires s'appliquent
  - Zéro page `/privacy/`, `/terms/`, `/legal/`
  - Fix : créer `legal/privacy.html` + `legal/terms.html` + cookie consent banner qui gate GTM
  - *Experts : Security + Business Readiness*

---

## P2 — CE MOIS

- [ ] **[SEC-004/005/006/008/014] CSP meta tag + SRI hashes CDN** `improve` `1 jour`
  - 0 CSP headers/meta. 0 `integrity` sur Font Awesome, ECharts, Google Fonts
  - 19 `innerHTML` : core.js (4), live-tracker.js (2), live-engine-ui.js (13)
  - Fix : CSP meta tag, `integrity=` + `crossorigin=anonymous` sur CDN, remplacer innerHTML par textContent où possible

- [ ] **[SEC-007/TRD-010/RISK-012] Self-hosted CORS proxy** `improve` `0.5-1 jour`
  - allorigins.win peut logger les tickers, modifier les prix, ou tomber sans préavis
  - corsproxy.io déjà retiré (403 persistants)
  - Fix : Cloudflare Worker (~5 lignes, 100K req/jour gratuit) ou Hetzner (ser)

- [ ] **[TRD-017/RISK-011] Réconcilier labels régime** `improve` `0.5 jour`
  - 3 sources contradictoires : modes-config="RISK-ON", risk.json="early_risk_off", radar="CRISIS"
  - Fix : renommer `_regime` → `_optimizedForRegime`, ajouter `currentRegime` depuis l'ensemble model

- [ ] **[RISK-016/TRD-013] Gap-through-stop modeling** `improve` `0.5 jour + re-sweep`
  - `sweep.js` L580 et `pit-engine.js` L161 bookent l'exit au stop price, pas au bar open en gap-down
  - Sous-estime systématiquement les pertes
  - Fix : `Math.min(bar.open, currentStop)` quand bar ouvre sous le stop

- [ ] **[UX-008] RTL CSS pour landing arabe** `improve` `3-4h`
  - `setLang()` met `dir=rtl` mais 0 règle RTL dans style.css/sidebar.css
  - Sidebar reste à gauche, textes non alignés à droite

- [ ] **[UX-007] ARIA roles landing page** `improve` `1 jour`
  - 9 attributs ARIA pour 5343 lignes
  - Modals, tabs, search sans `role`/`aria-modal`
  - Card links tous identiques "Voir l'article" sans différenciation

- [ ] **[UX-006] Defer search_data.js** `improve` `0.5 jour`
  - 231KB chargé en synchrone dans `<head>` bloque le render
  - Fix : `defer` ou chargement dynamique sur CMD+K / clic search

- [ ] **[TRD-013/TRD-018] Transaction costs dans sweep.js** `add` `1 jour + re-sweep`
  - 0 commission, spread, ou market impact modélisé
  - Paper adapter modélise 5bps slippage mais ne feed pas les backtests
  - Fix : ajouter `commissionPerTrade`, `spreadBps`, `impactBps` dans modes-config.json

- [ ] **[TRD-006] Reprendre les dailys ou rebrand l'onglet** `improve` `0.5 jour`
  - Dernier daily : 17 avril 2026 (53 jours)
  - Onglet "Daily" vide = signal d'abandon
  - Fix : diagnostiquer le bot schedule #2 ou renommer "Briefings"

- [ ] **[TRD-020] Masquer Orbit de la vue publique** `improve` `2-3h`
  - Mode deploying : CAGR -45.3%, Sharpe -0.53, WR 0%, 0 closed trades
  - Fix : `publiclyVisible: false` pour modes < 20 closed trades, badge "Paper Testing"

- [ ] **[PROD-011] Pages About, Methodology, Track Record** `add` `2-3 jours`
  - Aucune page /about, /methodology, /track-record
  - Requis pour crédibilité institutionnelle (API publique + niveaux entrée/stop/target)

---

## P3 — BACKLOG

- [ ] **[PROD-007] Monetization tiered** `add` `2-3 semaines`
  - API key gating via Cloudflare Worker, free tier T+1, pro tier real-time + widgets, Stripe

- [ ] **[RISK-013/TRD-021] Dashboard agrégé cross-mode** `add` `1 semaine`
  - `portfolio/v1/aggregate-risk.json` : tickers uniques, exposure secteur, overlap cross-mode, VaR combiné

- [ ] **[TRD-003] Walk-forward anchored** `improve` `2-3 semaines`
  - Remplacer split 70/30 statique par rolling walk-forward (min 5 fenêtres)
  - 8.7M paramètres sur 73 scans = ratio 119,000:1, overfit structurel garanti

- [ ] **[RISK-016] Tail risk protection systématique** `add` `2-3 semaines`
  - Auto-deleverage si crisis probability > 25% pendant 2 jours consécutifs
  - Auto-pausing quand ddBreakerPct breach 3 jours consécutifs

- [ ] **[PROD-003] Consolider 7 modes → 3-4** `improve` `2-4 semaines`
  - Turbo ≈ Dynamic (horizon 8 vs 10, score 90 vs 88) → fusionner
  - Retirer Fortress (OOS PF 0.77), garder Balanced flagship, TKL si OOS s'améliore

- [ ] **[PROD-006] Structurer 54 séries en learning tracks** `improve` `2-3 semaines`
  - 334 articles sans progression, pas de tracking, pas de parcours
  - Créer /learn avec 4-5 tracks (Beginner → Quant → Islamic Finance)

- [ ] **[UX-009/010/011/015] Fixes mineurs qualité** `improve` `2-3h`
  - 404.html : accents manquants, lien weekly stale (20260216 → 20260608)
  - Icône `fa-chart-line-down` = Font Awesome Pro only → `fa-chart-line`
  - `sw.js` stub auto-unregister mais toujours enregistré L5338

- [ ] **[UX-012/021] Lazy loading images + contraste WCAG AA** `improve` `3-4h`
  - 0 `loading=lazy` sur les images de cartes
  - Sidebar count #64748b sur #f1f5f9 = 3.85:1 (fail AA), placeholder #cbd5e1 = 1.68:1

---

## Top 10 Forces à Garder

1. **Radar** — intelligence curatée AI, 4 catégories, importance scoring, deep-links. Différenciateur unique.
2. **API OpenAPI 3.0.3** — 8 endpoints/mode, Swagger UI, `/all.json` pour LLMs. Design SaaS-ready.
3. **State machine modes** — 8 états, CLI enforcement, historique append-only, intégration pipeline.
4. **Lessons system** — 21 règles machine-readable de 10 rétrospectives. Learning loop institutionnel automatisé.
5. **Anti-dilution SEC** — vérification S-3, 424B5, shelf registrations, toxic underwriters. Alpha-preserving.
6. **Risk framework** — 5 stress scenarios, HMM 4 states, VaR/ES position level, circuit/DD breakers.
7. **Qualité scanner articles** — régime, sector rotation, confirmations/invalidations, Sharia compliance.
8. **Breadth** — 909 articles, 54 séries, 248 analyses, i18n 5 langues, RSS.
9. **`.gitignore` bien configuré** — 0 fuite dans l'historique git malgré repo public + automation.
10. **Widget system** — ticker tape, watchlist, embed builder, gallery. Produit distribuable.

## Top 5 Risques si Rien ne Change

1. **Fuite secrets** — un `git add -A` expose l'API key Anthropic (coûts non plafonnés)
2. **Capital réel sur stratégies perdantes OOS** — Fortress/TKL perdent, status page affiche +1225% CAGR
3. **Architecture interne exposée** — `tools/`, `mcp/server/`, `CLAUDE.md` lisibles publiquement
4. **Overfitting structurel** — 8.7M params, 73 scans, ratio 119,000:1 = dégradation OOS garantie
5. **Non-conformité GDPR** — GTM + Google Fonts sans consentement, ciblage EU/MENA, 0 privacy policy

---

## Historique (avant audit)

- [x] Weekly report 20260216 - "La Grande Rotation & Genève : Semaine Charnière"
- [x] Mise à jour index.html (nouvelle carte + archive)
- [x] Création CLAUDE.md (instructions projet pour Claude)
- [x] Création PROMPT.md (templates weekly + analyse ticker)
- [x] Migration des prompts de TODO.md vers PROMPT.md et CLAUDE.md
- [x] Enrichissement weekly 20260216
- [x] Ajouter section analyses individuelles sur index.html
- [x] Premier article d'analyse individuelle : ASST
