# Market Watch Articles - Memory

## Résumé
Site de publication d'analyses financières (dailytickers.com) hébergé sur GitHub Pages. Publie des rapports hebdomadaires, briefings quotidiens, analyses par ticker, et scans algorithmiques. Automatisé via Discord bot + Claude Code.

## Architecture Clé
- **Hosting** : GitHub Pages, CNAME = `articles.dailytickers.com` (PAS `dailytickers.com` qui est la landing marketing)
- **URL articles** : `https://articles.dailytickers.com/` — toutes les URLs d'articles utilisent ce sous-domaine
- **URL marketing** : `https://dailytickers.com/` — landing page séparée, NE SERT PAS les articles
- **Framework** : Astro 5 (hybride — MDX pour nouveaux articles, legacy HTML copié dans dist/)
- **Build** : `npm run build` = `astro build` + `copy-legacy.mjs`
- **Automatisation** : Discord bot (`claude-discord-bot`) exécute `claude -p` via tmux
- **MCP Gateway** : `mcp__claude_ai_Gateway__*` pour données marché temps réel
- **Stack front** : Astro + HTML, Inter font, Font Awesome 6.4.0, ApexCharts + ECharts, Shiki syntax highlighting
- **GTM** : GTM-T5Z595CW sur toutes les pages
- **Landing** : 6 tabs (Hebdo, Daily, Analyses, Scanner, **Radar**, Séries) + Tech dans le footer. Filtres tags/grade/search + language switcher (FR/EN select dropdown)
- **Radar** : Canvas animé (style logo radar militaire), données `data/radar.json` (rédigé par Claude, pas mécanique). Mis à jour à chaque daily/weekly/scanner. 4 catégories : risk (rouge), event (ambre), opportunity (vert), regime (bleu). Blips cliquables → lien direct vers section article.
- **Components** : 36 composants Astro réutilisables dans `src/components/`
- **Layouts** : 8 layouts Astro (Base, Daily, Weekly, Analyses, Analysis, Scanner, Series, Tech)

## Structure des Publications
| Type | Dossier | Fréquence | Schedule |
|------|---------|-----------|----------|
| Weekly | `weekly/YYYYMMDD/` | Dimanche 18h | Bot schedule #3 |
| Daily | `daily/YYYYMMDD/` | Tous les jours 7h | Bot schedule #2 |
| Scanner | `scanner/YYYYMMDD/` | Lun-Ven 23h | Bot schedule #1 |
| Rétrospective | `scanner/retrospective/` | Vendredi 23h | Bot schedule #4 |
| Analyses | `analyses/{TICKER}/` | À la demande | Manuel |

## Décisions Importantes
- **Multilangue** : 5 langues (en, fr, ar, es, zh) — mêmes que dailytickers.com. Défaut = intermediate/en. `variants.json` manifest pour analyses
- **i18n landing** : `data-i18n` attributes + translations object dans index.html (pattern dailytickers.com). `setLang()` résout toutes les clés. `lang-banner.js` supprimé (inutile)
- **Tags système** : `data-tags` sur chaque `.report-card`, taxonomie region/sector/theme/content
- **Logo convention** : brand-bar = logo MW (`logo.svg`), cartes listing = logo parqet.com
- **CSS** : `report.css` partagé par type, customisation inline `<style>`
- **Daily samedi** : briefing complet (récap vendredi + bilan semaine + preview lundi)
- **Daily dimanche** : crypto-only + géopolitique (marchés fermés)
- **Formation progressive** : cursus 4 semaines cyclique dans les dailys
- **Mode Status State Machine** : 8 états (`draft→test→deploying→live→pausing→paused→stopped` + `liquidated` urgence) pour ramp-up, wind-down ou liquidation forcée sans perte historique. CLI `tools/set-mode-status.js`. Voir [Mode Status](project_mode_status_machine.md).

## Patterns Validés
- **Migration tool** : `node tools/migrate_astro.js --apply` fixe 433 articles en masse (brand-bar, CSS, GTM, footer, links, inline CSS cleanup)
- Nouveaux articles en MDX dans `src/content/`, anciens en HTML legacy copié par `copy-legacy.mjs`
- Toujours mettre à jour les compteurs de tabs via `node tools/add_card.js`
- `analysesCount` calculé dynamiquement par JS (pas de mise à jour manuelle)
- Archiver avant de remplacer (`archive/YYYYMMDD/`)
- Trade Idea obligatoire sur analyses de tickers tradables (pas indices/thématiques)
- Accents français obligatoires (UTF-8 direct préféré aux entités HTML)
- `report.css` contient TOUTES les classes : brand-bar, hero, compare-table, quote-block, takeaway-box, disclaimer-mega, bias-grid, layer-card, roadmap-grid, score-row, hof-card, next-cta, section-divider, setup-card, regime-grid, switcher-bar, modal, variant-switcher, chart-modal

## Live Price Tracking
- **Proxy CORS** : `api.allorigins.win/get` (PAS `/raw` — pas de CORS headers). Response: `{ contents: "..." }` → `JSON.parse(d.contents)`. Fallback: `corsproxy.io` (souvent 403).
- **`assets/live-tracker.js`** : Script partagé pour scanner + blood-in-the-streets. Détecte les setup cards, fetch Yahoo Finance, injecte badges % change + statut (Trending/Stopped/TP Hit/etc.)
- **`price-tracker.js`** (blood-in-the-streets spécifique) : dans `daily/20260307/blood-in-the-streets/`
- **Widget** : `widget/index.html` utilise aussi allorigins pour Yahoo + Binance direct pour crypto
- **Régime dynamique** : calculé côté client depuis VIX (<15=Risk-On, 15-20=Neutral, 20-28=Early Risk-Off, >28=Risk-Off)

## Widget System
- **Picks** : `/widget/?mode=tape|vertical|embed` — watchlist A+ depuis `mcp/watchlist.json`
- **Gallery** : `/widget/gallery.html` — multi-type (dashboard, regime, sector, movers, radar)
- **Embed** : iframe self-contained, responsive 380px+, dark/light theme
- **Data** : Yahoo Finance via allorigins, Binance direct, radar.json, watchlist.json

## Feedback
- [Modes independent](feedback_modes_independent.md) — Dynamic/Balanced/Secured = 3 stratégies alternatives indépendantes. Pas de cross-mode gating. Même ticker dans plusieurs modes = confirmation, pas doublon.
- [Dilution Check](feedback_dilution_check.md) — Toujours vérifier SEC filings (S-3, warrants, ATM, fonds toxiques) avant de recommander un ticker. Leçon INDO.
- [No Portfolio Section](feedback_no_portfolio.md) — Ne jamais ajouter de section Portfolio/positions dans les dailys. Pas dans le template.
- [No Delete SSD](feedback_no_delete_ssd.md) — Ne JAMAIS supprimer de données sur le disque externe sans validation explicite.
- [Video Style](feedback_video_style.md) — Vidéos éducatives en français, style dynamique/abordable/didactique, avec quizzes pour couper le flux. Tout public.
- [Video Voice](feedback_video_voice.md) — Voix consistante par langue (seed=42), jeune homme dynamique FR/EN. Même voix de 0 à la fin. Corriger prononciations anglicismes.
- [Scanner Date Convention](feedback_scanner_date.md) — Scanner dossier = prochaine séance de trading (D+1 après 22h30, D+3 le vendredi soir).
- [Pipeline Updates Format](feedback_pipeline_updates.md) — Toujours inclure l'heure (HH:MM) dans les updates de progression pipeline/batch.
- [No Hallucination](feedback_no_hallucination.md) — Ne JAMAIS inventer de données financières (52W, cash, mcap) ni d'événements. Toujours MCP/WebSearch. Leçon ALT/IOVA/ALLR juin 2026.
- [No Auto Video](feedback_no_auto_video.md) — Ne jamais lancer de vidéo sauf demande explicite dans la session courante.
- [No Skip](feedback_no_skip.md) — Jamais skipper une étape du pipeline /scanner (anti-dilution, MCP enrichment, risk gating, earnings/economic event proximity, validation) sans accord explicite.
- [No False Caveats](feedback_no_false_caveats.md) — Ne jamais inventer de faux problèmes (liquidité, slippage) pour tempérer des résultats — vérifier les chiffres d'abord.
- [Tiered Mcap Oscillation](feedback_tiered_mcap_oscillation.md) — War room 2026-06-19: $50B mcap floor remplacé par sizing tiered (<$2B reject, $2-10B ×0.5, $10-50B ×0.7). Revert si sub-$20B avg stop > -6% sur 3 retros.
- [Analyses Factcheck](feedback_analyses_factcheck.md) — Toujours fact-checker les analyses avec MCP avant publication. Fork agents hallucinent 52W range, cash, market cap.
- [add_card Ordering & Landing](feedback_addcard_ordering_and_landing.md) — Landing rend les cartes dans l'ORDRE du JSON (pas de tri date) + add_card APPEND pour weekly/series/tech (prepend pour daily/analyses) → nouvelles cartes hors 1ère page = "invisibles". Remonter en tête. + "Scanner Performance" hardcodé dans index.html.
- [Pipeline Gotchas](feedback_pipeline_gotchas.md) — Recurring scanner pipeline bugs + canonical fixes (BSD date, MCP stub, qa-check grep, Pending status, order count).
- [Sweep pSize History](feedback_sweep_psize_history.md) — portfolioSize varies over time (modes-config-history.json). Never batch-reset trades without explicit consent.
- [TKL Identity](feedback_tkl_identity.md) — TKL = momentum specialist avec DD maîtrisé, PAS "small-cap". Includes quality momentum names regardless of market cap.
- [Candlestick No MCP](feedback_candlestick_no_mcp.md) — candlestick-scanner.js uses local universe file, never MCP RunScreener for ticker listing.
- [Regime-Aware Eval](feedback_regime_aware_eval.md) — Never evaluate mode config changes by uniform full-period replay; configs are regime-aware (regimeFilters) + weekly-adaptive (configVersion). Analyze per-regime + walk-forward instead.
- [Mode Success Criteria](project_mode_success_criteria.md) — Modes must beat SPY ≥3× every week with max DD ≤8%. Optimize on the underperformance segment (balanced bad since ~Apr 20), not full history. Always project impact + let user choose before applying.
- [Fortress Mandate](project_fortress_mandate.md) — Fortress = participate in upside WITHOUT capping returns + always-on parachute vs sudden reversals (low DD). NOT a low-return preservation mode. Never recommend "breakout-only everywhere" (brides returns). Fix = participate WITH parachute (trailing locks gains + decorrelate cluster + de-risk on regime deterioration).
- [Segment-Replay Absolute DD](feedback_segment_replay_absolute_dd.md) — Absolute DD/return from replaying a config over a segment is UNRELIABLE (phantom MtM, configVersion-blend divergence). Use only relative A/B deltas (same modeling, full config both arms); trust frozen_* + append-only resweep for absolute. Caught: falsely flagged dynamic DD -16% (real -4.59%).
- [MCP Hard Stop](feedback_mcp_hard_stop.md) — Si MCP DailyTickers bloque ou renvoie des données bizarres → STOP IMMÉDIAT de toute génération. Leçon retro H1 2026 : fork a halluciné 100% du palmarès.
- [A+ Grading Empirical](feedback_aplus_grading_empirical.md) — 4 éliminatoires (guidance relevée, ≥5 EPS beats, PE fwd <35x, ext EMA20 ≤3%) + scoring /100. Validé cohorte 29 setups juin 2026.
- [Screener Mcap Filter](feedback_screener_mcap_filter.md) — RunScreener DSL MUST include market_cap>$2B filter or returns only penny stocks. Cloud routine v4 fix applied 2026-06-25.
- [Immutable Trades](feedback_immutable_trades.md) — ABSOLUTE RULE: never modify historical trades or stats. SHA-256 chain in trade-chain.json. sweep.js aborts on violation.
- [Config Change Backtest](feedback_config_change_backtest.md) — MANDATORY 30-day backtest before any config change to turbo/balanced/dynamic/fortress. Must beat current config to be applied.
- [Bull 8× Parity](feedback_bull_8x_parity.md) — Bull 0 signaux les jours calmes = LÉGITIME (gate volume 8× haute-conviction, parité systematic-tss vérifiée vs backtest Go: 0 ordre le 2026-06-30, seul MESH passe mais échoue liquidité). Ne JAMAIS baisser le seuil pour forcer des signaux. QA vérifie le marqueur `_candlestickScan`, pas la présence de signaux. Cause racine de 6 mois d'erreurs = règle QA fausse.

## Video Pipeline
- [Video Pipeline](project_video_pipeline.md) — Pipeline Remotion + Qwen3-TTS local + YouTube upload pour 7 séries éducatives. Processing séquentiel pour gérer l'espace disque.
- [Educational Kids Series](project_edu_kids.md) — Après les 7 vidéos trading : séries éducatives pour enfants/jeunes (CE2, CM1, 5ème, 4ème, Terminale, PCSI) en français avec quizzes.
- [Video Full List](project_video_full_list.md) — 58+ vidéos: 7 trading, 2 tech, 43 scolaire (toutes matières), 6 langues (EN/AR/ES enfants 8-15). Output sur SSD externe.

## Scanner Strategy & Modes
- [Mode 7 Alpha](project_mode7_alpha.md) — Concentrated Nasdaq swing (P2/H10/ATR3.0x/Trail 2.0R). Paper-ramp from Jun 4. Target: beat Nasdaq DD.
- [Sweep Bugs Round 3](project_sweep_bugs_round3.md) — Dead optimizer (key mismatch), score mutation, correlation sign, BE-as-loss. Found by 3-round war room.
- [v7.1 Config Overhaul](project_v7_config_overhaul.md) — DD breaker %, correlation gate, ATR widen, stale off everywhere, 12 how-to template fixes. War room audit.
- [v6.0 Mode Overhaul](project_v6_mode_overhaul.md) — Disabled stale tightening, widened ATR stops, filtered TKL junk, new Orbit mode. All backed by OOS trade autopsy.
- [Orbit Mode](project_orbit_mode.md) — H20/3.5×ATR swing mode replacing Secured. Internal ID=secured, label=Orbit. Deploying paper-ramp from Jun 3, review Jul 3.
- [Breakeven Analysis](project_breakeven_analysis.md) — Stale tightening caused 38-46% breakevens. +19-64% profit left on table per mode. Fix: disable stale, widen ATR.
- [AI Supply Chain Gap](project_ai_supply_chain_gap.md) — Scanner misses HPE/DELL/SMCI/FLEX/COHR/AAOI. Thematic watchlist needed for mid-cap AI infra.
- [Modes Expansion + Redesign](project_modes_expansion_and_redesign.md) — Volet A: nouveaux modes crypto/metals(+mines)/forex (data). Volet B: refonte A→Z via skill impeccable (PRODUCT.md écrit, registre=product unifié, FT/Economist+terminal, mobile-first dense + RTL arabe + P&L colorblind-safe). Dashboard scanner/status à repenser pour N modes groupés par classe d'actif.

## Routines Cloud
- [Routine Redesign v2](project_routine_redesign_v2.md) — Conductors replaced by simple Sonnet routines (crash detector, market pulse, rotation detector). Old conductors disabled 2026-06-24.

## Références Externes
- [Exa.ai API](reference_exa_api.md) — API de recherche sémantique, alternative à WebSearch pour deep research
- [Hetzner Cloud](reference_hetzner.md) — SSH access hetzner-cloud (user=ci, key=*_ci), hosts openclaw
- [OAuth2 Migration](project_oauth2_migration.md) — Tous MCPs via OAuth2 (DailyTickers, Memory, Telegram, Broker Sim). Zéro token en .env depuis 2026-06-20
- [MCP Gateway URL](reference_mcp_gateway.md) — OBSOLÈTE: remplacé par OAuth2. Voir [[oauth2-migration]]
- [A+ Screening & Screener DSL](reference_aplus_screening_and_screener_dsl.md) — Monthly "10 A+ setups" 5-axis recipe via MCP + RunScreener DSL gotchas (abs() unsupported, ema-stack pass_expr returns 0, candidates lack sma/sector) + pre-commit hook auto-regens search/sitemap/feed

## Ce Qui Ne Marche Pas
- **URL domaine** : `dailytickers.com/daily/...` → 404. Les articles sont sur `articles.dailytickers.com`
- `git add -A` risqué (peut inclure fichiers sensibles) → ajouter fichiers spécifiques
- Oublier le GTM tag → pages non trackées
- Logo société dans le ticker-header → toujours logo MW
- Ticker européen long (AIR.PA) dans parqet URL → utiliser ticker court (AIR)
- Inline CSS qui override les classes globales → migration script les supprime

## Infrastructure
- **GitHub Pages** : déploiement auto sur push main
- **Discord bot** : `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/`
- **Schedules** : `schedules.json` dans le bot (4 tâches actives)
- **Lab** : Evidence.dev dashboard dans `lab/` (DuckDB WASM, 146 stocks)
- **ser** : `ssh -i ~/.ssh/id_ed25519_ci ci@ser.tail5d09f.ts.net` — Ubuntu 22.04, 16 cores, 27GB RAM, Nomad + Docker. Héberge le forecast service.
- [TimesFM Forecast Service](project_timesfm.md) — Python FastAPI + TimesFM 2.0 sur ser (Nomad/Docker), 4 intégrations pipeline

## CLAUDE.md Organisation
- **Root CLAUDE.md** (13KB) : conventions transversales, workflows par commande (étapes numérotées), renvois vers sous-fichiers
- **Sous-CLAUDE.md** (daily 10KB, weekly 12KB, scanner 25KB) : templates HTML complets, sections obligatoires détaillées
- Pas de duplication entre root et sous-fichiers — root = workflows, sous = templates
- Total ~60KB (~15K tokens) — bien dans les limites de contexte

## Sessions Récentes

### 2026-06-14 — Gros batch contenu + rebuild A+ actionnable + harness senior
- Publié (live) : weekly/20260615, daily/20260615, scanner/retrospective/20260612 (outcomes réels via bars MCP), 2 tech (workflows-multi-agents, mcp-donnees-marche), 3 séries thématiques 6 parties (grandes-ipo, iran-petrole, acceleration-ia).
- **A+ refait 2×** : 1er batch (GE,DELL,HPE,PANW,ROST,AMKR,CRDO,ALAB,TGT,DAL) recalé par une war room profonde (0/10 A+ au spot : R/R fictif sur noms étendus = piège du plus gros mouvement ; dilution ratée PANW/HPE ; CRDO/ALAB ATM active). Remplacé par 10 **actionnables** (R/R≥1.5 au spot, non étendus) : IBKR,ALLY,BK,COLB,CSCO,FLEX,TER,D,MDLZ,RPRX. 10 vérifiés par war room + senior-harness → résultat HONNÊTE : 8 vrais A+ (CSCO,IBKR,ALLY,BK,COLB,FLEX,TER,RPRX) + 2 grade A (D = merger-arb + ATM $1,8 Md$ active ; MDLZ = fair-not-cheap) que le panel a refusé de gonfler. Commits a8bb381e + 17b93537.
- **Nouveaux skills** : `aplus-setups` (sélection A+ rigoureuse, actionable-au-spot) + `senior-review` (.claude/workflows/senior-review.js — harness QA/Quant/Trader/Risk/Editor, gate PASS/FIXED/BLOCK, à passer avant TOUTE publication). Leçons dans [A+ Screening](reference_aplus_screening_and_screener_dsl.md).
- Limite de session (reset 18h20 Paris) + MCP DailyTickers déconnecté en fin de run → vérif des 5 derniers A+ à finir au reset.

### 2026-05-22 — Mode Status State Machine (Phase 1+2+3 + liquidated + rename)
- Implémenté machine d'états 8 nodes pour modes scanner (`tools/lib/mode-status.js` + CLI `tools/set-mode-status.js`)
- Pipeline intégré : `gen-api`, `gen-status-page`, `gen-trading-plan`, `pit-engine` respectent status
- API publique : `portfolio/v1/status.json` + bloc `status` dans tous endpoints. OpenAPI v1.3.0
- États : `pausing` = sortie organique (SL/TP/horizon/trailing continuent), `deploying` = ramp-up paper-ramp, `liquidated` = force-close au marché immédiat
- Renames du jour : `test-to-live → deploying`, `live-to-pause → pausing` (plus concis)
- Première application : secured `live → pausing` (OOS PF=0.53 sur n=11). Review 2026-06-22
- Doc complète : `tools/lib/MODE_STATUS.md` dans le repo + [project_mode_status_machine.md](project_mode_status_machine.md) en memory

### 2026-03-10 — CLAUDE.md optimisation
- Root CLAUDE.md réduit de 46KB à 13KB (-68%), total 95KB→60KB (-37%)
- Éliminé doublons : brand-bar 4×→1×, footer 4×→1×, Polymarket 2×→1×
- Ajouté live-tracker.js aux 5 derniers scanners

### 2026-02-26 — Astro migration + mass fix 433 articles
- 36 Astro components, 8 layouts, migration script `migrate_astro.js`
- 100% pass rate on validation (0 errors, 0 warnings)
- [Candlestick→Bull Pipeline](feedback_candlestick_bull_pipeline.md) — /scanner must run candlestick-scanner before sweep/gen-status-page, else bull = 0 signals
- [Optimize-Param Static Artifact](feedback_optimize_param_static_artifact.md) — optimize-param overstates (static filters); always re-validate via validate-config-change.js (regime-aware+OOS) before applying
- [Substack Publishing](reference_substack_publishing.md) — Pas d'API officielle. Voie propre = MCP Substack Gateway OSS (respecte OAuth2/zéro-token). MVP: convertisseur HTML→draft + Notes auto via MCP; posts longs semi-manuels.
- [Config Change Forward-Only](feedback_config_change_forward_only.md) — Changement config mode (portfolioSize/topN/filter) DOIT être forward-only via _effectiveFrom + _prior*, sinon sweep backfille des positions fantômes. Injection live cappée aux slots restants. cfg2 doit porter les champs custom (shariaOnly) sinon dead code.
- [Sharia Sector Screen](feedback_sharia_sector_screen.md) — Filtre Halal par-mode (Fortress) doit screener par SECTEUR + liste SHARIA_EXCLUDED, pas juste sharia:false — sinon financières untagged (NNI/Nelnet) passent. isHaramForHalalMode() aux 2 sites (candidats + injection live).
- [Sweep Config Enforcement](feedback_sweep_config_enforcement.md) — Tout filtre par-mode que gen-status-page applique à l'affichage (universeFilter, shariaOnly, minScore) DOIT aussi être appliqué dans sweep.js (cfg2 + buildSetups + sélection candidats + injection live), sinon divergence display/backtest. 2 bugs trouvés: casablanca tenait des US, Fortress tenait NNI.
- [Stale Frozen API](feedback_stale_frozen_api.md) — gen-api.js skippait les modes absents du snapshot → fichiers portfolio/v1 gelés au dernier jour live (trades pending stales vs positions=0). reconcileStoppedMode() heal les modes stopped. Ne jamais skip sans réconcilier.
- [Backtest Gap Fills](feedback_backtest_gap_fills.md) — simulateTrade bookait exitPrice au niveau (stop/TP) même quand la barre gappait au-delà → biais optimiste unidirectionnel (28% des sorties stop, +48.5pp gonflé). Fix = min(stop,open)/max(tp,open). Forward-only (immutabilité). Re-baseline historique = accord user requis.
