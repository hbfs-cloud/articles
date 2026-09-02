# Market Watch Articles — Index Mémoire

> Index de pointeurs (1 ligne/mémoire). Le contenu vit dans les fichiers ; les faits repo hors CLAUDE.md sont dans [[repo-facts]]. Conventions/architecture site = **CLAUDE.md**.

## ⚙️ Invariants & architecture
- [Content Commands Harness](project_content_commands_harness.md) — 22/07/2026 — commandes /daily /weekly /retro /analyse /series + skill content-harness : salves MCP complètes (27 tools), harness.json + check-freshness.js BLOQUANT anti-stale, war room retail, senior-review obligatoire.
- [Cloud Routine Automerge](project_cloud_routine_automerge.md) — Les routines Claude cloud poussent leur run sur une branche claude/**, PAS sur main — auto-merge sur gate QA verte (.github/workflows/auto-merge-nig…
- [Dtx Architecture](project_dtx_mcp_wiring.md) — dtx = moteur systematic-tss via MCP hébergé SEUL (cut-over 2026-07-08, binaires+bundle SUPPRIMÉS). Câblage agent→MCP→ingest. v15 cost-honest = 6 str…
- [Mcp Only Data Path](project_mcp_only_data_path.md) — Décision archi 2026-07-11 — la donnée marché passe par le MCP marketdata, PAS les scripts/univers locaux. node subprocess ne peut pas appeler le MCP…
- [Mode Status Machine](project_mode_status_machine.md) — 8-state lifecycle for scanner modes (turbo/dynamic/balanced/secured/fortress/tkl). Lets us pause, ramp-up, or liquidate modes without code changes.
- [Invalid Cohorts](project_invalid_cohorts.md) — Trades scellés non exploitables = MARQUÉS via data/invalid-cohorts.json (lu par lib/invalid-cohorts.js → mode-stats.js), jamais supprimés. Exclusion opt-in. Cohorte active : scanDate 2026-06-16→2026-07-13, filtre de score inopérant, 93/394 trades.
- [Perf Parallel Mcp](project_perf_parallel_mcp.md) — 2026-07-21 — doctrine perf transverse pour TOUS les skills MCP. Le goulot = round-trip MCP en série. Règle : isoler le MCP en salves parallèles (1 m…
- [Systematic North Star](project_systematic_north_star.md) — Cap produit/desk — retail EU peu capitalisé, multi-broker API, DevOps ; max alpha risque maîtrisé → systematic. STOP à la simulation/signaux (scanne…
- [Dtx Mcp](reference_dtx_mcp.md) — Serveur MCP dtx (systematic.dailytickers.com) = SEUL moteur backtest/décision/régime systematic-tss ("le MCP fait foi") ; binaire local + bundle SUP…
- [Mcp Gateway Url Deprecated](reference_mcp_gateway.md) — OBSOLÈTE — MCP_GATEWAY_URL remplacé par OAuth2 depuis 2026-06-20. Voir [[project-cloud-routine-automerge]]

## 🔒 Intégrité données / immutabilité
- [Append Resim Prior Exit Config](feedback_append_resim_prior_exit_config.md) — sweep.js append re-sim must source pre-change scans from the PRIOR exit-config frozen key, else a forward-only exit change re-opens already-closed s…
- [Backtest Gap Fills](feedback_backtest_gap_fills.md) — simulateTrade bookait exitPrice au niveau (stop/TP) même quand la barre gappait au-delà → biais optimiste unidirectionnel. Fix = fill à l'open sur g…
- [Frozen Stats Append Only Advance](feedback_frozen_stats_append_only_advance.md) — Les agrégats scellés (frozen_*) sont APPEND-ONLY ET portfolio-aware : avancer le segment post-gel depuis les pnl scellés à chaque sweep, copier le p…
- [Immutable Trades](feedback_immutable_trades.md) — ABSOLUTE RULE — never modify historical closed trades or their sealed aggregate stats (SHA-256 chain enforced). SCOPE — same-day published content (…
- [Sealed Primary Display](feedback_sealed_primary_display.md) — Le status page hero affiche TOUJOURS le sweep scellé (hash-chain) comme chiffre primaire d'un mode — jamais le carnet live NI la forward-view incl. …
- [Segment Replay Absolute Dd](feedback_segment_replay_absolute_dd.md) — Le DD/return ABSOLU d'un replay de config sur un segment n'est pas fiable — n'utiliser que les deltas relatifs A/B; valider l'absolu via le frozen r…
- [Stale Frozen Api](feedback_stale_frozen_api.md) — gen-api.js skip les modes absents du snapshot → leurs fichiers portfolio/v1 publiés restent gelés (stale) et ne se corrigent jamais. Les modes stopp…
- [Sweep Psize History](feedback_sweep_psize_history.md) — Never assume portfolioSize is constant — check modes-config-history.json before comparing concurrent positions across time

## 🛰️ Scanner pipeline
- [Un champ déclaré doit être calculé](feedback_declared_fields_must_be_computed.md) — tp1_atr_multiple recopié à la main était faux sur 5 lignes sur 7, et le gate qui le lit était mort-né parce que scanner-parser.js strippait le champ. Tester tout nouveau gate DANS LES DEUX SENS ; « absent » n'est pas « 0 ».
- [Contrôle de dilution fail-closed pour les émetteurs européens](feedback_dilution_check_fail_closed_eu_issuers.md) — dilution_clear=false signifie « contrôle NON FAIT », jamais « risque faible » : la ligne ne se publie pas. .PA → eu_filings (AMF) ; .AS/.MC/.L/.BR → aucune source câblée, donc non publiables en éditorial.
- [Bull 8x Parity](feedback_bull_8x_parity.md) — Bull mode 0 signals on quiet days is LEGITIMATE — high-conviction 8× volume gate, parity with systematic-tss. Never lower the threshold to force sig…
- [Candlestick Bull Pipeline](feedback_candlestick_bull_pipeline.md) — The /scanner pipeline MUST run candlestick-scanner.js before sweep/gen-status-page, else the \"bull\" mode shows 0 signals
- [Candlestick No Mcp](feedback_candlestick_no_mcp.md) — candlestick-scanner.js must use local universe file, never MCP RunScreener for ticker listing
- [Live Engine Headless Debug](feedback_live_engine_headless_debug.md) — Les bugs de rendu du live-engine (scanner/status) NE se reproduisent PAS en Playwright headless (fetch allorigins + WS Yahoo bloqués). Tester au vra…
- [Market Namespaced Price Cache](feedback_market_namespaced_price_cache.md) — Le cache prix DOIT être namespacé par marché (US/ vs CVA/) — sinon collision de ticker (SNA = Snap-on US $402 vs Stokvis Nord BVC 73 MAD). bvc-fetch…
- [No Skip](feedback_no_skip.md) — Never skip any pipeline step (MCP enrichment, anti-dilution, risk gating, validation) without explicit user consent.
- [Scanner Pipeline Gotchas (lessons learned 2026 04 28)](feedback_pipeline_gotchas.md) — Recurring bugs in the scanner pipeline + their canonical fixes — check before re-introducing similar code paths
- [Runscreener Dsl Calibration](feedback_runscreener_dsl_calibration.md) — Le scan momentum/breakout renvoie 0 quand le DSL RunScreener est mal calibré. NE JAMAIS mettre market_cap dans pass_expr (évalue à 0 = killer silenc…
- [Scanner date convention](feedback_scanner_date.md) — Scanner folder date = next trading session, not generation date. After 22h30 use D+1, Friday evening use D+3 (Monday).
- [Mcp Primary Flip Requires Pipeline Wiring](feedback_scanner_flip_pipeline_wiring.md) — Un flip scanner MCP-primary (retrait fetch local) n'est PAS complet sans câbler le pipeline. Un node subprocess ne peut pas appeler le MCP → si publ…
- [Scanner Mode Change Full Pipeline](feedback_scanner_mode_change_full_pipeline.md) — Changer l'ensemble des modes scanner = tracer TOUT le pipeline + vérifier le dashboard RENDU (pas juste le boot-smoke) — ne pas se faire rappeler le…
- [Scanner Silent Failures](feedback_scanner_silent_failures.md) — Les scanners scriptés crashent parfois de façon transiente (réseau/cold-cache) et le runner est non-bloquant → 0 signal silencieux. Garde : markers …
- [Status Page Scripted Layout](feedback_status_page_scripted_layout.md) — Le desktop grid de scanner/status (.lp-grid) cassait sur grand écran pour les modes scriptés — overlap positions/history + equity étirée
- [Scanner Cloud Reliability Backlog](project_scanner_cloud_reliability.md) — Backlog fiabilisation /scanner + routines cloud (audit 2026-07-03). 11 items priorisés. Batch1 DONE (calendrier/forex/discovery), reste #4-#11.
- [Screener Reliability 20260702](reference_screener_reliability_20260702.md) — État de fiabilité RunScreener/RunAutoScreener (testé 2026-07-02) : DSL rising() en conjonction OK, mcap filter OK, AutoScreener régime OK. Gaps gate…

## 🧬 dtx moteur
- [Dtx Frozen Orders Guard](feedback_dtx_frozen_orders_guard.md) — 2026-07-21 — garde anti-gel dans dtx-mcp-ingest.js (exit 8). Post-mortem : DtxDecide a renvoyé des CREATE figés à J-9 ré-ingérés en silence du 09 au…
- [Dtx Live Track Drift](feedback_dtx_live_track_drift.md) — Modes scriptés : historique live append-only + drift backtest↔live obligatoires — incident 2 semaines sans trace (13-21/07/2026)
- [Dtx Oom Sequential And Scanruns](feedback_dtx_oom_sequential_and_scanruns.md) — dtx OOM sur gros univers equity = concurrence RAM → régénérer les modes UN À LA FOIS (solo passe). + bug _scanRuns=1 (number) fait crasher les scann…
- [Dtx Replay Sanity Guard](feedback_dtx_replay_sanity_guard.md) — Le MCP dtx est sain — les stats aberrantes viennent d'un replay capturé corrompu par la routine ; garde déterministe assertReplaySanity + qa-check b…

## 📊 Modes & config
- [Balanced Sl Bleed Not A Bug](feedback_balanced_sl_bleed_not_a_bug.md) — Balanced's "wall of stop-losses" is NOT a bug — it's legacy superseded-config trades + trailing-scratch mislabeling; same-day stops on vwapGate=fals…
- [Config Change Backtest](feedback_config_change_backtest.md) — MANDATORY 30-day backtest before any config change to turbo/balanced/dynamic/fortress
- [Config Change Forward Only](feedback_config_change_forward_only.md) — Un changement de config mode (portfolioSize/topN/filter) DOIT être forward-only via _effectiveFrom, sinon le sweep backfille des positions fantômes …
- [Portfolio modes are independent strategies — no cross Mode gating](feedback_modes_independent.md) — Turbo/Dynamic/Balanced/Secured/Fortress are 5 alternative strategies, not pieces of one portfolio. A ticker in multiple modes is a confirmation sign…
- [Optimize Param Static Artifact](feedback_optimize_param_static_artifact.md) — optimize-param.js uses STATIC filters and overstates gains — always re-validate with validate-config-change.js (regime-aware + OOS) before applying …
- [Regime Aware Eval](feedback_regime_aware_eval.md) — Never evaluate scanner mode config changes by uniform full-period replay — the system is regime-aware + weekly-adaptive
- [Scripted Modes Tss Order Parity](feedback_scripted_modes_tss_order_parity.md) — Les modes scriptés (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) doivent RÉPLIQUER les ordres BUY/SELL du lendemain de systematic-tss, pas re-dér…
- [Tiered Mcap Oscillation](feedback_tiered_mcap_oscillation.md) — War room decision (2026-06-19) — replaced $50B mcap floor with tiered sizing during regime oscillation
- [Tkl Identity](feedback_tkl_identity.md) — TKL mode is a momentum specialist with controlled max DD — NOT a small-cap mode. User corrected this assumption.
- [Verify Iso By Running](feedback_verify_iso_by_running.md) — Vérifier l'iso d'un scanner JS porté vs systematic-tss en LANÇANT le Go (backtest/scanner-debug/oracle dédié), jamais en lisant seulement le code. C…
- [Iso Cache And Resync](project_iso_cache_and_resync.md) — Cache marketdata daté PIT-safe (price-cache.js) + système de resync iso (verify-iso.js + manifeste) alignant les scanners JS sur systematic-tss. 6 m…
- [Mode Success Criteria](project_mode_success_criteria.md) — Objectif de perf des modes scanner — ≥3× SPY chaque semaine, max DD ≤ 8%, benchmark SPY
- [Modes Config Baseline](project_modes_config_baseline.md) — Baseline config + identité des modes LIVE (turbo/dynamic/balanced v10.1/secured=Orbit/fortress) + mandat fortress + leçons régime-agnostiques réutil…
- [Scripted Modes Scorecard](project_scripted_modes_scorecard.md) — Verdict de fiabilité des modes scriptés (gate liquidité ON). bull=AmericanBulls=artefact (pausing). highvol/etf/etf_eu=KEEP. momentum/trendline/casa…

## 🎯 Intelligence trading
- [Analysis Senior Review First](feedback_analysis_senior_review_first.md) — Senior-review AVANT publication + checklist MCP complète (buyback, 13F, FINRA, S-3 par type) — incident TLN 19/07/2026
- [Senior Review Args Shape](feedback_senior_review_args_shape.md) — senior-review attend artifacts=[{path,type,label}] : une chaîne = 0 agent lancé et faux PASS silencieux (02/08/2026)
- [Dilution Check Window](feedback_dilution_check_window.md) — CRITIQUE : le check anti-dilution n'est JAMAIS borné à 180j (warrant OpenAI 160M actions raté sur AMD, 02/08/2026) — days=1825 + ouvrir tout 8-K item 3.02/1.01 et Ex-4.x
- [Headline Framing Not Source](feedback_headline_framing_not_source.md) — le cadrage d'un titre sur la déclaration d'un TIERS n'est pas cette déclaration : test d'intérêt économique obligatoire (incident MU 03/08/2026, polarité inversée en argument portant)
- [Si Pct Recompute From Float](feedback_si_pct_recompute_from_float.md) — 07/08/2026 — shortPercentOfFloat Yahoo incohérent avec sharesShort/floatShares du même payload (PSIX 14.2% vs 23.9% réel) : recomputer le ratio + croiser FINRA daté, rattrapé par le panel.
- [Aplus Grading Empirical](feedback_aplus_grading_empirical.md) — Grille de notation A+ empirique validée sur 29 setups (juin 2026) — 4 éliminatoires + 6 critères pondérés /100
- [Harness Portfolio Coherence](feedback_harness_portfolio_coherence.md) — Le harness/war-room DOIT vérifier la cohérence panier↔thèse macro (persona Strategist), pas seulement valider chaque trade en isolation
- [Sharia Bank Detection](feedback_sharia_bank_detection.md) — Le gate shariaOnly est PERMISSIF → tout repose sur la détection. Screener par SECTEUR + liste SHARIA_EXCLUDED (pas juste sharia:false) : banques non…
- [Ai Hedge Fund Adoption](project_ai_hedge_fund_adoption.md) — 2026-07-11 — les 8 idées ai-hedge-fund adoptées (déterministe/sim-only). #4 sizing vol_corr est OPT-IN et NE bat PAS inverse_atr (A/B balanced/dynam…
- [Trading Memory](project_trading_memory.md) — Mémoire trading structurée (2026-07-02) : scanner-lessons.json = policy memory (class/status/confidence/evidence/half-life), lessons-engine (decay/p…
- [Aplus Screening And Screener Dsl](reference_aplus_screening_and_screener_dsl.md) — How to screen the monthly \"10 A+ setups\" via MCP + non-obvious RunScreener DSL gotchas + publish hook behavior

## 🛑 Sécurité / zéro fabrication
- [Dilution & Toxic Financing Check](feedback_dilution_check.md) — Always check for SEC dilution filings, warrants, and aggressive funds before recommending any ticker in scanner or analyses
- [Mcp Hard Stop](feedback_mcp_hard_stop.md) — If MCP DailyTickers blocks or returns weird data, stop ALL article generation/correction immediately. Never substitute with invented data.
- [Never delete SSD data without explicit approval](feedback_no_delete_ssd.md) — Ne jamais supprimer de données sur le disque externe (Extreme SSD) sans validation explicite de l'utilisateur
- [No False Caveats](feedback_no_false_caveats.md) — Ne jamais inventer de faux problèmes (liquidité, slippage, faisabilité) pour tempérer des résultats — vérifier les chiffres avant de caveat.
- [No Hallucination](feedback_no_hallucination.md) — Never fabricate financial data (prices, 52W ranges, cash, market cap, burn, dates) or geopolitical events. Fork agents hallucinate these — ALWAYS ve…
- [Scanner No Broker Exec](feedback_scanner_no_broker_exec.md) — JAMAIS d'exécution broker auto dans /scanner — run-session retiré du flux; Telegram scanner = canal daily

## ✍️ Édito & publication
- [Addcard Ordering And Landing](feedback_addcard_ordering_and_landing.md) — Landing renders tab cards in JSON array order (no date sort) + add_card appends (not prepends) for weekly/series/tech → new cards land beyond the fi…
- [Editorial Voice No Ai](feedback_editorial_voice.md) — Règle #1 de rédaction tout le site — concis, direct, actionnable, JAMAIS "style IA" (lisible enfant 10 ans sur Substack/Telegram)
- [Macro Date Verify Before Publish](feedback_macro_date_verify.md) — Toute date d'événement macro (CPI/FOMC/PPI/PCE/NFP…) citée dans un digest de signaux ou un daily DOIT être vérifiée AVANT publication ; jamais asser…
- [No portfolio section in dailys](feedback_no_portfolio.md) — Never add Portfolio Pulse or position tracking sections in daily briefings — not part of the template
- [Pipeline Progress Updates Format](feedback_pipeline_updates.md) — Include current time in pipeline/batch progress updates so user knows when each check happened
- [Refresh Body Stale](feedback_refresh_body_stale.md) — Le nightly refresh-analyses met à jour le header mais laisse le corps cassé (prix $0.00, placeholders, EMA copiées, banners TP1-HIT périmés). Gates …
- [Sweep Config Enforcement](feedback_sweep_config_enforcement.md) — Tout filtre par-mode que gen-status-page applique à l'affichage DOIT aussi être appliqué dans sweep.js (sélection candidats + injection live), sinon…
- [Substack Publishing](reference_substack_publishing.md) — Options d'intégration pour publier sur substack.com/@dailytickers — pas d'API officielle, MCP Substack Gateway OSS = voie propre.
- [Substack Mcp Tools](reference_substack_tools.md) — Substack MCP full toolset (maj 2026-07-03) — update_draft édite un post PUBLIÉ en place (même URL), delete_draft supprime les publiés, upload_image …

## 🎨 Site & design
- [Site And Scanner Design](project_site_and_scanner_design.md) — Direction design site + scanner/status : thème clair UNIQUE (dark reverté, ne pas re-tenter), reskin premium scopé, bilingue FR/EN, sync tags 3 sour…

## ☁️ Cloud & process
- [Fable Plans Sonnet Implements](feedback_fable_plans_sonnet_implements.md) — Modèle de travail permanent — Fable planifie/spécifie, Sonnet/Opus implémentent selon complexité, toujours dans des workflow dynamic.

## 🎬 Vidéo
- [No auto video generation](feedback_no_auto_video.md) — Never generate videos unless explicitly asked — do not auto-trigger /make-video from previous sessions
- [Remotion Concurrency](feedback_remotion_concurrency.md) — Use --concurrency flag when rendering Remotion videos to speed up render time
- [Video Style Preferences](feedback_video_style.md) — User wants French educational videos in dynamic, accessible, didactic style with quizzes
- [Video Voice Configuration — All 5 Languages LOCKED](feedback_video_voice.md) — Immutable voice config for all video languages. FR/EN/ES/ZH = Qwen3 CustomVoice eric. AR = Edge TTS ar-LB-RamiNeural.
- [Video Pipeline](project_video_pipeline.md) — Pipeline vidéo éducative Remotion + TTS local (traitement séquentiel pour l'espace disque, output sur SSD externe) + backlog complet (7 trading + 2 …

## 🧰 Infra & réfs externes
- [TimesFM Forecast Service](project_timesfm.md) — TimesFM 2.5 evaluation results — 6 use cases tested, vol/volume best (8-8.5/10), price direction weak (6/10), earnings fail (2/10). Service on ser v…
- [Exa.ai API Key](reference_exa_api.md) — API key for Exa.ai search/research API — alternative to WebSearch for deep research queries
- [Hetzner Cloud Server](reference_hetzner.md) — SSH access to hetzner-cloud (ci user, key id_ed25519_ci). Hosts articles repo + signal-monitor Nomad job + blog + openclaw. NOT ser (ser = forecast …
- [Repo Facts](reference_repo_facts.md) — Faits opérationnels du repo NON couverts par CLAUDE.md — hosts infra (ser/hetzner/discord-bot/schedules), proxy live-price (allorigins /get), widget…

- [Scanner pipeline fixes 2026-07-22](feedback_scanner_pipeline_fixes_20260722.md) — risk-metrics via --ingest MCP connecté, Telegram via MCP, no double-sweep, capital_flow invalide, corrélation US-only, connector flapping, bull supprimé
- [Momentum crash & loss-based breakers](project_momentum_crash_loss_breakers.md) — crash momentum invisible au macro (score risk-on + VIX calme) → coupe-circuits loss-based only ; feed regimeScore contaminé ; méthodo backtest versionné forward ; garde-fou anti-gel frozen ; force-refresh MCP
- [Scanner workflow token blowup](feedback_scanner_workflow_token_blowup.md) — fan-out 1 agent/ticker chacun appelant le MCP = 4.3M tokens ; batcher QueryData multi-symbole AVANT le fan-out, raisonner sur le pré-fetché (perf R7)
- [Frozen orphan trade (append limit)](feedback_frozen_orphan_trade.md) — un trade résolu sur/avant la pointe scellée devient orphelin (72 clos / 71 agrégé) ; non corrigeable sans réécrire le scellé → garder le frozen, ne jamais overwrite from-scratch
- [Sharia defense-revenue exclusion](feedback_sharia_defense_revenue.md) — defense/military revenue >5% ⇒ non-compliant even with clean debt (HXL incident 20260728)
- [Earnings date → ground truth = 8-K item 2.02](feedback_earnings_calendar_authoritative.md) — calendar/next_earnings feeds are insufficient (FTNT 20260729, then 10 same-window reporters hidden on 20260730: F, AWK, EXR, REG, FE, CNC, IVZ + LYV/KKR/OWL/RAL same-day)
- [marketdata path & coverage traps](feedback_marketdata_path_and_coverage_traps.md) — bars_daily windowed vs unwindowed lag a session; RefreshBars in market hours writes a partial bar; EU 29/07 gap unfixable; support_resistance/vwap/dark_pool empty; dilution_risk_score doesn't exist
- [Filtrer avant d enrichir (gate G4)](feedback_scanner_filter_before_enrich_order.md) — la doctrine perf existait et n etait pas suivie ; _pipelineOrder + earnings_source desormais bloquants dans validate-scan.js
- [PortfolioRisk sizing ignore les contraintes](feedback_portfoliorisk_sizing_ignores_constraints.md) — renvoie un livre à levier (132% brut, 3,5% de risque/ligne contre 1,0% demandé), 2 jours de suite ; n'utiliser QUE ses volatilités réalisées, jamais ses allocations
- [dtx multi-sleeve géré par l'ingest](feedback_marketdata_path_and_coverage_traps.md) — NE PAS écrire hvep/book_honest à la main : extractReplayMetrics() branche déjà sur combined et synthétise la courbe (correction du 31/07)
- [Vérifier les VALEURS macro, pas seulement les dates](feedback_macro_values_verify_not_just_dates.md) — le Core PCE du 30/07 qualifié à tort DEUX fois (« soft » puis « plus chaud ») alors qu'il sortait EN LIGNE (3,3% vs 3,3%) ; exiger actual + consensus + précédent + mois de référence avant tout qualificatif
- [Décomposer un résultat avant de le qualifier](feedback_decompose_headline_earnings_before_characterising.md) — 85% du bénéfice « record » d'Amazon et 69% de celui d'Alphabet étaient des écritures non monétaires ; le capex Microsoft « en baisse » était un changement de méthode comptable
- [Programme d'émission ACTIF ≠ nombre d'actions stable](feedback_active_issuance_program_not_share_count.md) — 3e récidive (INDO, bon de souscription AMD, puis CCJ) : un programme au fil de l'eau de 500 M$ actif jusqu'au 12/12/2026 invisible dans le nombre d'actions ; écrire « aucune dilution CONSTATÉE », jamais « aucune dilution »
- [Les correctifs du panel vivent dans le HTML, pas dans le JSON](feedback_panel_fixes_html_only_lost_on_rerender.md) — un `render-analysis.js` après panel écrase 40 correctifs en silence (CCJ 03/08) ; reporter dans le JSON source AVANT de re-rendre, récupération via journal.jsonl

- `feedback_lire_nos_propres_publications.md` — lire les 3 derniers daily/weekly avant toute thèse macro ; deux thèses réfutées le même jour par notre propre archive (5 août 2026)
- `project_dette_technique_analyses.md` — 7 défauts de gabarit corrigés dans le moteur mais non propagés (60 modals orphelins, 27 icônes vides, 39 tuiles N/A) ; le re-rendu global casse sur des champs manquants

### Post-mortem « trou de performance » — 7 août 2026 (4 enquêtes aveugles + 3 relectures adversariales)
- [Bloc de risque dtx cloné d'un mode arrêté](feedback_dtx_modes_cloned_risk_block.md) — CAUSE #1 : 6 modes dtx écrits en live le 13/07 avec le bloc de risque de `highvol` (stopped) ; maxStopPct=15 sur des stratégies de ROTATION sans stop moteur → 12 sorties à exactement -15,00% (exitPrice/entrée = 0,850000), -221,2 pts / -171,5 dédupliqués
- [hybrid : promotion illégale draft→live](feedback_hybrid_illegal_promotion.md) — CAUSE #2 : live le 06/07 hors machine à états, maxStopPct=20, ddBreaker=30, CB=0 ; AdaptiveFractal échappe à validate-scan ET au plancher R/R du sweep (MPLT rr 1:0.52, stop -19,3%, -65,57%) ; -144,6 pts sur 14 trades
- [Le verrou breakeven s'arme sur la barre d'entrée](feedback_breakeven_arms_on_entry_bar.md) — CAUSE #3 : `daysHeld++` avant la garde → `1 > 0` le jour même ; beGraceDays=0 sur turbo/dynamic/fortress transforme +12% en -0,6% (test unitaire) ; -66,0 pts réalisés contre 0,00 pt avant juillet
- [fortress tourne sans couche de risque](feedback_fortress_risk_layer_dropped.md) — CAUSE #4 : maxStopPct=0, ddBreakerPct=0, atrStopMult=0 en live ; supprimés en douce par 465b1fa5e (29/06) dont le message n'annonçait qu'un rollback de sélection ; balanced réparé le 22/07, fortress oublié
- [Rupture de convention de sortie au 01/07](feedback_exit_convention_break_20260701.md) — ANGLE MORT : le fill gap-through est forward-only ; pénalité sous le stop = EXACTEMENT 0 avant juillet, -116,2 pts après → tout avant/après sur backtest-trades.json mélange deux comptabilités (~20% de la perte)
- [Config déclarative, fallback silencieux](feedback_config_declarative_silent_fallback.md) — ANGLE MORT : aplus n'a pas `regimeFilters.recovery` → 0 entrée sur les 5 séances RECOVERY, sans une seule alerte ; `regimeParams`/`calendar` ne sont passés à AUCUN des 3 sites d'appel de simulateTrade (code mort qui a PROTÉGÉ, pas coûté)
- [La machine à états est contournée à grande échelle](feedback_mode_status_machine_bypassed.md) — ANGLE MORT : 18/40 transitions illégales, 6 modes `live` sans aucune entrée dans le journal (écrits, jamais transités) ; le motif n'est pas une date, c'est 9 modes en prod sans espérance validée (-457,4 pts / 62 sorties)
- [Le gate qualité ne couvre plus la moitié des signaux](feedback_validate_scan_specialist_exemption.md) — ANGLE MORT : 13 SPECIALIST_STRATEGIES exemptées AVANT toute règle → 865/1731 signaux (50%) hors des 47 règles, hard_block inclus. Le chiffre « 23% de couverture » n'est PAS reproductible
- [Une somme de pnlPct n'est pas un rendement](feedback_pnl_points_not_portfolio_return.md) — MÉTHODE : les 3 hypothèses soumises ont échoué au test adversarial (composition, 26-32% de doublons, 2 conventions, bêta) ; à périmètre constant dédupliqué et corrigé du bêta la dégradation réelle est ~1,7pp d'alpha/trade, pas 4,6
- [STRATEGY_FILTERS_MAP = ensembles d'EXCLUSION](feedback_strategy_filters_are_exclusion_sets.md) — RÉFUTÉE : la « dilution par mélange d'échelles de score » est impossible (filtre appliqué AVANT minScore) ; ne survit que la dette technique du champ `score` non borné + la table de tags jumelle
- [Les modes LLM ont été redéfinis, pas dérégulés](feedback_llm_modes_horizon_redefined.md) — turbo/dynamic étaient des stratégies à 2 jours (rotation agressive) portées à H8-H10 sans re-calibrer la sélection ; l'edge médian de +1,97% est rendu avant la sortie. Bascule datée à v7-20260604.
- [Le gate bloque sur un DD absolu que la référence viole](feedback_gate_absolute_dd_blocks_improvements.md) — turbo H=3 améliore rendement (−6,54→−0,33%) ET drawdown (−11,07→−9,96%) et se fait refuser sur un seuil ≤8% que l'actuel rate déjà
- [Calibrer l'horizon sur la détention réelle des gagnants](feedback_horizon_calibrate_on_realized_hold.md) — H ≈ médiane des gagnants +1 ; turbo 8→3, balanced 8→6, aplus 20→10 validés ; secured (mandat Orbit) et fortress (jamais converti) correctement refusés par le gate
- [Le stop du moteur est calé sur la volatilité](feedback_engine_stop_is_volatility_scaled.md) — −18% à −47% selon le titre (médiane −28,8%) ; le plafond fixe à −15% du tracker liquidait des positions que le moteur tenait encore : 12 sorties sur 18 à exactement −15,00%. Vérifiable par DtxDecide(asof=<date>).
- [Les agents d'un workflow partagent le scratchpad](feedback_workflow_agents_share_scratchpad.md) — collision de fichiers intermédiaires entre agents parallèles, silencieuse et présentée comme intentionnelle ; imposer un préfixe par agent ou n'écrire qu'un fichier final nommé par son identité
- [Des gates certifiaient vert sur du vide](feedback_gates_certify_green_on_nothing.md) — check-freshness validait un scan sans données (exit 0 sur 9 rôles bloqués), qa-check auditait une autre cible que celle demandée, et l'univers de corrélation d'un scan publié ne couvrait que 50% du panier. Un gate doit distinguer PASSE / ÉCHOUE / N'A PAS PU VÉRIFIER.
- [Contamination croisée de barres BKNG/CRWD](feedback_bar_cross_contamination_bkng_crwd.md) — deux tickers avec la même clôture au centime et le même prix limite à 13 décimales ; le garde-fou de cohérence ne contrôle que les métriques de backtest, pas les prix d'ordres.
- [Le gate R/R est décoratif](feedback_rr_gate_is_decorative.md) — sur 5 scans publiés, TP1 ≈ distance au stop × 1,55-1,80 : σ(R/R) tient à 0,016-0,077 pendant que σ(stop) atteint 1,61×ATR. La cible est fabriquée pour franchir le plancher, pas mesurée sur le graphique.
- [Le plancher de R/R impose des cibles inatteignables](feedback_rr_gate_forces_unreachable_targets.md) — backtest 96 trades : cible atteinte 12,5% du temps parce qu'elle est à 8,5% quand le prix ne va qu'à 4,4%. Ramener la cible à 1,5×ATR quadruple l'espérance, mais donne un R/R de 1,0 — incompatible avec le gate.
- [Le registre de dépôts du service est incomplet](feedback_sec_filings_registry_incomplete.md) — `sec_filings` renvoie VIDE sur BNY/NKLR/IOVA alors qu'EDGAR trouve 424B2, 424B3 et S-3ASR réels. Un retour vide de ce service est NON CONCLUANT, jamais négatif : le contrôle EDGAR direct de validate-scan fait foi.
- [Un seuil de taille n'est pas une preuve de complétude](feedback_size_threshold_is_not_completeness.md) — le weekly 20260810 bloqué deux fois pour des raisons opposées : compter les sections, pas les octets.
- [Un verrou rendu avant ses écrivains ne protège rien](feedback_verrou_rendu_avant_les_ecrivains.md) — le verrou de `downstream-split.sh` se libérait à +1,5 s pendant que `gen-api` écrivait `data/` et `portfolio/v1` jusqu'à +12 s : `trap … EXIT` ne couvre pas les tâches lancées en `&`. Corrigé + `tools/test-downstream-lock.sh`.
- [Le panel adversarial est non négociable](project_panel_non_negociable.md) — arbitré le 11/08 face à un objectif de latence ; relevé de ce qu'il rattrape en une journée.
- [Pas de produit « insiders » autonome](project_pas_de_produit_insiders.md) — clé de cadence retirée le 11/08, mesures MCP à l'appui : 0-2 noms par séance, 100 symboles sur 944, zéro achat, une levée-revente d'options étiquetée « net_selling -158 M$ ». Le cluster-buy a déjà son producteur (filings-scanner.js). desk-plan contrôle désormais les cadences orphelines de façon générique.
- [Cadences macro=36 h et squeeze=168 h](project_cadences_macro_squeeze.md) — les deux types étaient absents de CADENCE_H, donc à 0, donc jamais bloqués. Valeurs mesurées le 11/08 : calendrier réel (44 événements tier 1 sur 42 jours, 5 paires à 1 j) → 36 h ; 24 fenêtres FINRA 2026 / 119 jours déclencheurs / jusqu'à 7 sorties du même jeu → 168 h, seule valeur dans ]144 h ; 216 h[.
- [REPRISE session 11/08](../REPRISE.md) — à lire en premier dans une session neuve : deux vérifications urgentes, décisions à ne pas revisiter, chantiers ouverts.
- [Archive profonde : barre partielle déclarée complète](reference_archive_profonde_barre_partielle.md) — GLD au 10/08 vaut 402,54 en fenêtre courte et 399,39 en fenêtre profonde, avec sessions_complete:true dans les deux cas. Nos plans lisent en profond.
- [Mandat — site une page (différé)](project_mandat_single_page_site.md) — page statique unique du portefeuille dtx mandat (ordres/trades/equity/metrics + jauge 60-85%), plomberie et vigilances actées 2026-08-14
- [Token diet](feedback_token_diet.md) — tiering modèles workflows, panels scriptés d'abord, payloads MCP en fichiers, 1 session = 1 produit (2026-08-14)
- [Telegram court](feedback_telegram_court.md) — notifs courtes, sans liens, essentiel (2026-08-14)
- [Fortress à sec aout 2026](project_fortress_starvation_aug2026.md) — incident 0 entrée 07-16/08, étape fortress-pm perdue par le dédup commande/skill
- [Gate R/R aligné plancher éditorial](decision_rr_gate_aligned.md) — décision 16/08 : gate tracker par ère (1,5 avant 10/08, 0,7 depuis), voir MCP memory rr-gate-aligned-editorial-floor
- [Cycle de vie des analyses](project_analyses_lifecycle.md) — statuts sur clôtures + endpoint analyses-status.json + garde-fou JS core.js (2026-08-26)
- [Compaction mémoire MCP 2026-08-26](mcp-compaction-20260826/README.md) — 1159 → 395 mémoires actives (−66%), registres d'archive + index des évincées, soft-delete réversible
- [Ledger absent ≠ masquer l'historique](feedback_absent_ledger_never_masks_history.md) — incident e488 (2026-09-01) : Codex a tombstoné 135 snapshots + masqué 4 modes car capacityAt(entry) absent ; un ledger manquant se corrige/déclare, jamais ne supprime un historique versionné immuable ; ne jamais empaqueter une destruction dans un gros commit refactor
