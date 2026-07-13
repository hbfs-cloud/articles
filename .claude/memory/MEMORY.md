# Market Watch Articles - Memory

- [MCP-only data path](project_mcp_only_data_path.md) — Décision 2026-07-11 : la donnée marché passe par le MCP marketdata, PAS les scripts/univers locaux (stockanalysis-fetcher, eu-universe.json, Yahoo direct) = legacy à migrer/virer. Contrainte : subprocess node ≠ MCP → tout mode data-MCP est une ÉTAPE AGENT (comme top-10/staging dtx). eu_smallcap construit 100% MCP.
- [Site Lang & Nav](project_site_lang_and_nav.md) — Décision 2026-07-11 : site **bilingue FR/EN assumé** (ES/ZH = 0 fichier → retirés du sélecteur ; défaut = navigator.language, plus 'all' qui entremêlait). Tags : 3 sources à synchroniser (CLAUDE.md ↔ core.js ↔ index.html), 16 tags manquaient → pas filtrables. Onglet Scanner → sous-filtre Scans/Rétros/Statut.
- [Systematic North Star](project_systematic_north_star.md) — Cap : retail EU peu capitalisé, multi-broker API, DevOps ; max alpha risque maîtrisé → systematic. 4 edges (capacity/fiscal PEA/API/event-driven). ⛔ STOP à la simulation+signaux (scanner/status), PAS de paper/live broker. Build gated harness+adversarial à CHAQUE loop.
- [MCP EU coverage → RÉSOLU + eu_smallcap draft](project_mcp_eu_coverage_gap.md) — 2026-07-12 : les 4 points MCP EU résolus + vérifiés live (v111 : deep backtest, country+market_cap dans les rows, GetReferentialData EU). Blocage PLUS côté MCP. Re-validation deep eu_smallcap = **KEEP_DRAFT** (CAGR +12% mais DD -27%, ne bat pas SPY risk-adjusted, perd 3/4 ans) → la STRATÉGIE momentum EU n'est pas viable, pas la data. Activer = trouver une meilleure stratégie EU.
- [ai-hedge-fund adoption](project_ai_hedge_fund_adoption.md) — 8 idées virattt adoptées (déterministe/sim-only) 2026-07-11 : Value/Quality Board, schéma pivot+state+agrégation pondérée, PIT cache key, valuation multi-méthodes, compute_allowed_actions. ⚠️ #4 sizing vol_corr = OPT-IN et NE bat PAS inverse_atr (A/B) → pas de flip live. Sizing live = inverse_atr, PAS tiered mcap.
- [Migration local→MCP rollout](project_migration_local_to_mcp.md) — 2026-07-12 : MCP = RÉFÉRENCE (décret archi, pas d'A/B vs local). 10 scanners basculés MCP-primary + pipeline câblé e2e (agent produit staging → shell --ingest). crypto/casablanca restent fetch-direct (MCP ne couvre pas → brief owner). Purge univers bloquée (fractal/gap lisent encore). Plan : docs/specs/migration-local-to-mcp.md.
- [Scanner flip needs pipeline wiring](feedback_scanner_flip_pipeline_wiring.md) — GOTCHA : retirer le fetch local d'un scanner sans câbler publish-daily-card.sh (--ingest) + le producteur agent Phase 1 = 0 signal en run auto (node ne peut pas appeler le MCP), masqué par `|| non-blocking`. Livrer flip+pipeline+e2e dans le même lot. Modèle = candlestick.
- [Macro date verify before publish](feedback_macro_date_verify.md) — Toute date macro (CPI/FOMC/PPI/PCE/NFP) dans un digest/daily DOIT être vérifiée AVANT publication ; jamais asserter un jour non vérifié. **RÉSOLU 2026-07-13 (v115)** : economic_events était un FAUX générateur synthétique (CPI hallucination) → remplacé par calendrier officiel curé (BLS/Fed/BEA), CPI 14/07 08:30 + FOMC 29/07 vérifiés, is_near_economic_event effectif (bug EqualFold US/USD + SetEconomicEvents custom-path corrigés). Vérifier via MCP en priorité.
- [Status hero sealed vs live](feedback_status_hero_sealed_vs_live.md) — Hero scanner/status : headline « Total Return » = backtest SCELLÉ (frozen, invariant sealed-primary), live/MtM positions ouvertes affiché SÉPARÉMENT (fix f7ed8c970, gate F par !frozenMeaningful + guardrail qa-check). + Piège : points-de-return ≠ %-réel (mode à +112% qui bouge -2.5% affiche -5.3 points). Live jour-par-jour = pit-forward.json ; frozen curve s'arrête à la date de gel (turbo 26/06/40 trades).

- [dtx MCP](reference_dtx_mcp.md) — **SEUL MOTEUR (cut-over 2026-07-08, "le MCP fait foi")** : backtest/décision/régime systematic-tss via MCP `systematic.dailytickers.com` (DtxListConfigs/DtxReplay/DtxDecide/DtxRegime + poll DtxJobStatus, cache OHLCV chaud). **Binaire local + bundle `tools/bin/dtx-data/` + `dtx-engine.js` SUPPRIMÉS** — plus aucun fallback binaire. Câblage : agent → DtxReplay/DtxDecide → `dtx-mcp-ingest.js` → staging engineMode:mcp. Cloud routine (`claude -p`) vérifiée : connector compte claude.ai reachable headless. **Durcissement anti-skip-silencieux (§"Durcissement…")** : 3 couches (preflight GetHealth agent + connector-absent guard → alerte 'alerts' ; complétude par-mode → alerte consolidée ; filet SHELL `writeStagingCompleteness` → `data/dtx/_staging-completeness.json` lu par `qa-check.js` qui escalade en ❌ tout mode stale/manquant). Rapport de fin = GÉNÉRÉS vs SKIPPÉS. Gap résiduel : compte mort = run ne démarre pas → seul le filet attrape au run suivant.
- [dtx OOM séquentiel + _scanRuns](feedback_dtx_oom_sequential_and_scanruns.md) — Gros univers equity (us_highvol 2403, stockbox 5189 titres) OOM en CONCURRENCE RAM → régénérer UN À LA FOIS (solo passe en ~1min, ≠ replay corrompu). Garde sanity étendu au staging stale (qa-check ré-évalue tout dtx/*.json). Bug _scanRuns=1 (number au lieu de {}) fait crasher highvol/etf-scanner → coercer en {} + relancer (--folder=date seule).
- [dtx Replay Sanity Guard](feedback_dtx_replay_sanity_guard.md) — Le MCP dtx est SAIN (diag 2026-07-10 : interrogé en direct il reproduit les chiffres sains) ; les stats aberrantes du 2026-07-09 (etf_eu DD-89,6 %, us_highvol 1169tr) = replay CAPTURÉ corrompu/param-drifté par la routine, pas un bug moteur. Garde déterministe : `config/dtx/_sanity-baselines.json` + `assertReplaySanity()` → `metricsSuspect`/`_sanityWarning` → ingest exit 7 + qa-check ❌ dur bloque la publication.
- [dtx MCP Wiring](project_dtx_mcp_wiring.md) — **CUT-OVER 2026-07-08 (MCP-only)** : `tools/dtx-mcp-ingest.js` (ingère DtxDecide+DtxReplay → staging via schéma partagé de `dtx-scan.js`) = SEUL producteur. `dtx-scan.js` ne spawn plus de binaire (`--mode` = guidance + exit 0 gracieux, garde `stagingStatus`/`--list`). `publish-daily-card.sh` Step 4d = garde de fraîcheur (warn si stale), ne régénère plus. 5 modes flippés `engineMode:mcp`. Vérif locale : etf_eu MCP→ingest→render OK, qa 0 ❌. Tables de parité MCP↔binaire = historiques (binaire supprimé). Cloud : schedule #1 renforcé, connector claude.ai headless prouvé (GetHealth).
- [dtx Engine Migration](project_dtx_engine_migration.md) — MIGRATION full décidée 2026-07-07 : scanners scriptés JS → binaire `dtx` (vrai moteur systematic-tss, JSON-in/out, mode injecté avec nos bars price-cache). Supprime la classe de bug parité iso. decide=ordres du jour (positions/orders=arrays, balances=objet), replay=metrics+equity. Book ~11 stratégies. Re-baseline track-record = phase consentie. **Phase 2.5 (2026-07-07) = CLOUD-VIABLE via DÉCOUPLAGE** : staging `data/dtx/*.json` versionné + `dtx-scan --skip-if-no-tss` fail-safe (natif tourne en amont/commit, cloud lit le staging committé) ; parité Go `cmd/backtest` == `dtx replay` champ-à-champ (4 books) ; linux-binary MOOT côté cloud (lit du JSON, n'exécute pas dtx). **Phase 2.6 (2026-07-07) = NATIF AUTOPORTANT** : dépendance `systematic-tss` CASSÉE via bundle vendorisé `tools/bin/dtx-data/` (9,9M lfs, repris du repo `trading`, PAS le brut 34M) + binaires MAJ Jul-7 (`43d53455`, support `--data-dir`). Prouvé sibling déplacé : 5 modes wired tournent natif (decide EXACT vs sibling) ; résidu = RÉSEAU (Yahoo OHLCV) seul, plus le sibling repo. etf_eu=0 trades (Yahoo ne sert pas l'OHLCV ETF EU, identique sibling).
- [Status Page Scripted Layout](feedback_status_page_scripted_layout.md) — le desktop grid .lp-grid cassait sur grand écran pour les modes scriptés (overlap positions/history car "Trade History … N open" mal-tagué positions ; equity étirée car grid-row hardcodé pour le jeu complet de sections). Fix = tagging history-avant-positions + placeDesktopGrid content-adaptive + align-items:start. Toujours vérifier en vrai navigateur ≥1440px.
- [Harness Portfolio Coherence](feedback_harness_portfolio_coherence.md) — le war-room/senior-review DOIT checker la cohérence PANIER↔THÈSE macro (persona Strategist ajoutée), pas juste valider chaque trade en isolation. Incident 07-08 : narratif risk-off + book risk-on (4 longs béta) démonté en 30s. Toute liste de trades passe la passe Strategist avant publication.
- [Sharia Bank Detection](feedback_sharia_bank_detection.md) — IBN (ICICI=riba) entré dans fortress car getSector="Other" + HARAM_SECTORS={'Finance'} seul → non détecté. Fix ciblé (ticker-metadata sector fallback + labelToSector), PAS de fail-closed (viderait le book Halal non-tagué). aplus.minScore 92→85.
- [Iso Cache & Resync](project_iso_cache_and_resync.md) — cache marketdata daté PIT-safe (price-cache.js) + verify-iso.js/manifeste alignant 6 modes scriptés sur systematic-tss ; root bug récurrent = seuils hardcodés au lieu de lire scanner_filters.params. Nouveau mode stockbox.
- [Verify iso by running](feedback_verify_iso_by_running.md) — prouver l'iso d'un port en LANÇANT le Go (backtest/scanner-debug/oracle), jamais en lisant le code ; comparer candidats-scanner par date, pas l'état (pending/positions).
- [Scripted Modes TSS Order Parity](feedback_scripted_modes_tss_order_parity.md) — Les modes scriptés (Bull/Momentum/HighVol/Trendline/ETF/Casablanca) = ordres BUY/SELL du lendemain qui doivent RÉPLIQUER systematic-tss NATIVEMENT (articles reste INDÉPENDANT ; tss = comparaison seule via tss-orders.js). Scanners alignés 2026-07-01: bull/highvol FULL, etf/casablanca partial, momentum/trendline EU=infra data. Bull: le vrai bug était un filtre liquidité inconditionnel (PAS le 8×, qui est correct — bull-8x-parity JUSTE). Technique backtest offline (.env vide, skip Infisical cert expiré).

## Résumé
Site de publication d'analyses financières (dailytickers.com) hébergé sur GitHub Pages. Publie des rapports hebdomadaires, briefings quotidiens, analyses par ticker, et scans algorithmiques. Automatisé via Discord bot + Claude Code.

## Architecture Clé
- **Hosting** : GitHub Pages, CNAME = `articles.dailytickers.com` (PAS `dailytickers.com` qui est la landing marketing)
- **URL articles** : `https://articles.dailytickers.com/` — toutes les URLs d'articles utilisent ce sous-domaine
- **URL marketing** : `https://dailytickers.com/` — landing page séparée, NE SERT PAS les articles
- **Framework** : AUCUN framework de build (Astro supprimé) — articles = HTML statique direct, publication via `node tools/publish.js`
- **Automatisation** : Discord bot (`claude-discord-bot`) exécute `claude -p` via tmux
- **MCP market-data** : `mcp__claude_ai_marketdata__*` pour données marché temps réel (ex `mcp__claude_ai_Gateway__*` / `mcp__claude_ai_DailyTickers__*` / `mcp__dailytickers__*` — namespaces morts)
- **Stack front** : HTML statique, Inter font, Font Awesome 6.4.0, ApexCharts + ECharts
- **GTM** : GTM-T5Z595CW sur toutes les pages
- **Landing** : 6 tabs (Hebdo, Daily, Analyses, Scanner, **Radar**, Séries) + Tech dans le footer. Filtres tags/grade/search + language switcher (FR/EN select dropdown)
- **Radar** : Canvas animé (style logo radar militaire), données `data/radar.json` (rédigé par Claude, pas mécanique). Mis à jour à chaque daily/weekly/scanner. 4 catégories : risk (rouge), event (ambre), opportunity (vert), regime (bleu). Blips cliquables → lien direct vers section article.
- **Components/Layouts** : OBSOLÈTE — les composants/layouts Astro (`src/`) n'existent plus ; conventions HTML dans CLAUDE.md + sub-CLAUDE.md par dossier

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
- **Migration tool (historique)** : `migrate_astro.js` avait fixé 433 articles en masse — l'ère Astro/MDX est terminée, tous les articles sont du HTML statique direct
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
- [Scanner mode change = full pipeline](feedback_scanner_mode_change_full_pipeline.md) — changer le SET de modes scanner = tracer TOUT le pipeline + vérifier le dashboard RENDU (pas juste boot-smoke).
- [Balanced SL-bleed = NOT a bug](feedback_balanced_sl_bleed_not_a_bug.md) — la "wall of stop-losses" balanced est du legacy de configs remplacées (0 trade sous v10.1 courant) + scratches de trailing mal-labellisés 'sl' ; les stops same-day sur modes vwapGate=false sont légitimes (HON 06-30 low 219.33 a percé le stop 220.7), PAS des artefacts → pas de guard entry-bar. Bug réel corrigé (a81b5255f) : open/pending fuyaient dans Trade History + closedTrades ledger → closed-only. Hero(60 frozen) vs history(64 ledger) divergent par design (immutabilité).
- [Fable plans, Sonnet/Opus implement](feedback_fable_plans_sonnet_implements.md) — modèle de travail permanent : Fable spécifie, Sonnet/Opus implémentent selon complexité, toujours en workflow dynamic. (miroir MCP en attente — memory MCP down 2026-07-03)
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
- [Balanced P4 Underperf](project_balanced_p4_underperf.md) — Sous-perf balanced = CONFIG (maxStopPct=0 non-capé + FIXED sizing sur high-ATR), pas régime. Fix P4 v10.1 (inverse_atr = garde-fou manquant). fortress/turbo/dynamic = régime, ne rien changer. validate-config-change enforce le gate 30j.
- [Live-Engine Headless Debug](feedback_live_engine_headless_debug.md) — Les bugs de rendu live-engine (lp-grid stretch, tmUpdateLive) NE se reproduisent PAS en Playwright headless (WS Yahoo + fetch CORS bloqués + viewport). Tester au vrai viewport OU dump DOM console user. Deploy Pages ~10min + push-rafale annule les deploys.
- [Market-Namespaced Price Cache](feedback_market_namespaced_price_cache.md) — Cache prix DOIT être namespacé par marché (US/ vs CVA/). Collision ticker : SNA = Snap-on US $402 vs Stokvis Nord BVC 73 MAD. bvc-fetcher lit le cache avant de fetcher → prix US pollué. Fix = CVA/ séparé + chart casablanca → casablanca-bourse.com.
- [Regime-Aware Eval](feedback_regime_aware_eval.md) — Never evaluate mode config changes by uniform full-period replay; configs are regime-aware (regimeFilters) + weekly-adaptive (configVersion). Analyze per-regime + walk-forward instead.
- [Mode Success Criteria](project_mode_success_criteria.md) — Modes must beat SPY ≥3× every week with max DD ≤8%. Optimize on the underperformance segment (balanced bad since ~Apr 20), not full history. Always project impact + let user choose before applying.
- [Fortress Mandate](project_fortress_mandate.md) — Fortress = participate in upside WITHOUT capping returns + always-on parachute vs sudden reversals (low DD). NOT a low-return preservation mode. Never recommend "breakout-only everywhere" (brides returns). Fix = participate WITH parachute (trailing locks gains + decorrelate cluster + de-risk on regime deterioration).
- [Segment-Replay Absolute DD](feedback_segment_replay_absolute_dd.md) — Absolute DD/return from replaying a config over a segment is UNRELIABLE (phantom MtM, configVersion-blend divergence). Use only relative A/B deltas (same modeling, full config both arms); trust frozen_* + append-only resweep for absolute. Caught: falsely flagged dynamic DD -16% (real -4.59%).
- [MCP Hard Stop](feedback_mcp_hard_stop.md) — Si MCP DailyTickers bloque ou renvoie des données bizarres → STOP IMMÉDIAT de toute génération. Leçon retro H1 2026 : fork a halluciné 100% du palmarès.
- [A+ Grading Empirical](feedback_aplus_grading_empirical.md) — 4 éliminatoires (guidance relevée, ≥5 EPS beats, PE fwd <35x, ext EMA20 ≤3%) + scoring /100. Validé cohorte 29 setups juin 2026.
- [Screener Mcap Filter](feedback_screener_mcap_filter.md) — RunScreener DSL MUST include market_cap>$2B filter or returns only penny stocks. Cloud routine v4 fix applied 2026-06-25.
- [Immutable Trades](feedback_immutable_trades.md) — ABSOLUTE RULE: never modify historical trades or stats. SHA-256 chain in trade-chain.json. sweep.js aborts on violation.
- [Append Re-sim Prior Exit Config](feedback_append_resim_prior_exit_config.md) — sweep append re-sim must source pre-change scans from the PRIOR exit-config frozen key. Incident: balanced 0 trades since 07-01 — v10.0→v10.1 exit change (H2→H8, wider stop) re-simulated the 06-30 seed under v10.1, HON never stopped, locked the 3rd slot, daily_max1 rotation (+5 margin) blocked everything. Fix = per-date frozenKey via exitConfigTransition(). balanced 0→3 real names (ABVX/NWG/AXP), other modes byte-identical. Also fixed loose mom_bo substring regex in gen-scanner-notifications (ETF SBIO/SSK leak).
- [Sealed-Primary Display](feedback_sealed_primary_display.md) — Le status page affiche TOUJOURS le sweep scellé comme chiffre primaire d'un mode, jamais le carnet live. Incident 2026-07-02 (turbo 111.76%→5.51% par routine). Garde-fou qa-check "SEALED-PRIMARY invariant" + gate frozenMeaningful dans gen-status-page.
- [Frozen Portfolio-Aware](feedback_frozen_portfolio_aware.md) — Les frozen_* viennent de simulatePortfolio (config-aware) et sont préservés byte-for-byte au sweep. JAMAIS recomputer via computeStatsFromTrades (ignore portfolioSize → replay uniforme). Incident 2026-07-02/03 : dynamic 91.18%→75.45%, orbit DD fantôme -10.15%. Vrai DD dynamic -4.59%.
- [Scripted Modes Scorecard](project_scripted_modes_scorecard.md) — Verdict fiabilité modes scriptés (gate liquidité ON) : bull=AmericanBulls=artefact (+435%→-10%, pausing 2026-07-03). highvol(105.8%/SR2.05)/etf/etf_eu=KEEP. momentum(divergence)/trendline/casablanca=à trancher/requalifier. Gate point-in-time porté du frère systematic-tss (commit 401cbd1ff).
- [Immutable Scope (content)](feedback_immutable_scope_content.md) — Immutable = trade-chain (trades clôturés) UNIQUEMENT. Un scan/article publié le jour même avec un vrai bug SE corrige (leçon 20260702).
- [Editorial Voice — No AI](feedback_editorial_voice.md) — Règle #1 rédaction tout le site : concis, direct, actionnable, JAMAIS style IA (bannir signposting/tics ; garder chiffres réels ; Substack/Telegram = niveau enfant 10 ans). Contrôle : `tools/check-ai-tells.js` + gate AI-Forensics (`senior-review`). Spec : `EDITORIAL_STYLE.md`.
- [Substack MCP Tools](reference_substack_tools.md) — update_draft édite un post PUBLIÉ en place (même URL), delete_draft supprime les publiés, upload_image → CDN Substack. Fini le churn ; format data-forward (board flux+niveaux) = défaut.
- [Scanner Editorial Design](project_scanner_editorial_design.md) — Éditorial = top-10 par stratégie + combiné, jusqu'à ~40 candidats ; validate-scan aligné 2026-07-03 (scan_size max_total:40, stops arrondi 2dp, max_per_sector advisory, sector_map +11).
- [Frozen Append-Only](feedback_frozen_append_only.md) — Immutable = trades individuels, PAS les agrégats : frozen_* avance en append-only (priorEC verbatim + gardes) ; statusSince ne supprime jamais de trades enregistrés (leçon dashboard figé au 26/06).
- [Refresh Body Stale](feedback_refresh_body_stale.md) — Nightly refresh laisse le corps cassé (prix \$0.00, placeholders, EMA copiées, TP1-HIT périmés). Gate obligatoire : qa-content --strict par analyse rafraîchie + pre-commit + CI qa-content.yml.
- [Scanner Silent Failures](feedback_scanner_silent_failures.md) — Scanners scriptés crashent transitoirement (réseau) sous `|| non-bloquant` → 0 signal silencieux. Garde : markers _scanRuns + qa-check FAIL si marker absent (incident 20260702).
- [Trading Memory](project_trading_memory.md) — Mémoire trading structurée : scanner-lessons=policy (class/confidence/evidence/half-life), lessons-engine (decay quotidien/promote gated/contradictions), lessons-retrieve (cap 3/3/3), _memoryImpact obligatoire, MAE/MFE/J+1-5-20 dans sweep. Aucune promotion narrative.
- [Momentum US Backtest](project_momentum_us_backtest.md) — Backtest Go 5y momentum-rotation US NÉGATIF (CAGR -5.31%, DD 67%, PF 0.92 vs SPY +12.98%). Mode momentum → pausing 2026-07-02, review 16/07. Cert Infisical expiré (workaround -env vide).
- [Parity v10.2](project_parity_v10_2.md) — Modes scriptés réalignés sur configs Go 5y (highvol P15/H14, etf_eu score 80+blacklist, casablanca H90+rotation, trendline H25). Exceptions : bull (voulu), momentum US (pas de backtest Go). Gap : pit-engine générique vs PMs Go.
- [Config Change Backtest](feedback_config_change_backtest.md) — MANDATORY 30-day backtest before any config change to turbo/balanced/dynamic/fortress. Must beat current config to be applied.
- [RunScreener DSL Calibration](feedback_runscreener_dsl_calibration.md) — Scan momentum/breakout renvoie 0 quand le DSL RunScreener est mal calibré (EMA-stack gating, near_breakout(2 args)). RunScreener EST fiable — recalibrer le DSL loose + post-filtrer mcap/ETF en code, NE PAS basculer sur scanners locaux. DSL validés inclus. Cause du scan stub 20260701.
- [Bull 8× Parity](feedback_bull_8x_parity.md) — Bull 0 signaux les jours calmes = LÉGITIME (gate volume 8× haute-conviction, parité systematic-tss vérifiée vs backtest Go: 0 ordre le 2026-06-30, seul MESH passe mais échoue liquidité). Ne JAMAIS baisser le seuil pour forcer des signaux. QA vérifie le marqueur `_candlestickScan`, pas la présence de signaux. Cause racine de 6 mois d'erreurs = règle QA fausse.

## Video Pipeline
- [Video Pipeline](project_video_pipeline.md) — Pipeline Remotion + Qwen3-TTS local + YouTube upload pour 7 séries éducatives. Processing séquentiel pour gérer l'espace disque.
- [Educational Kids Series](project_edu_kids.md) — Après les 7 vidéos trading : séries éducatives pour enfants/jeunes (CE2, CM1, 5ème, 4ème, Terminale, PCSI) en français avec quizzes.
- [Video Full List](project_video_full_list.md) — 58+ vidéos: 7 trading, 2 tech, 43 scolaire (toutes matières), 6 langues (EN/AR/ES enfants 8-15). Output sur SSD externe.

## Scanner Strategy & Modes
- [dtx v15 — 6 stratégies](project_dtx_v15_six_strategies.md) — 2026-07-13 cut-over: scanner réduit aux 6 stratégies dtx cost-honest; anciens scriptings stopped.
- [Mode 7 Alpha](project_mode7_alpha.md) — Concentrated Nasdaq swing (P2/H10/ATR3.0x/Trail 2.0R). Paper-ramp from Jun 4. Target: beat Nasdaq DD.
- [Sweep Bugs Round 3](project_sweep_bugs_round3.md) — Dead optimizer (key mismatch), score mutation, correlation sign, BE-as-loss. Found by 3-round war room.
- [v7.1 Config Overhaul](project_v7_config_overhaul.md) — DD breaker %, correlation gate, ATR widen, stale off everywhere, 12 how-to template fixes. War room audit.
- [v6.0 Mode Overhaul](project_v6_mode_overhaul.md) — Disabled stale tightening, widened ATR stops, filtered TKL junk, new Orbit mode. All backed by OOS trade autopsy.
- [Orbit Mode](project_orbit_mode.md) — Orbit = LABEL du mode `secured` (live), pas un mode séparé. Stratégie H20/3.5×ATR déployée en juin 2026 sur l'ID interne `secured` ; le paper-ramp historique est terminé, secured est `live` avec label "Orbit".
- [Breakeven Analysis](project_breakeven_analysis.md) — Stale tightening caused 38-46% breakevens. +19-64% profit left on table per mode. Fix: disable stale, widen ATR.
- [AI Supply Chain Gap](project_ai_supply_chain_gap.md) — Scanner misses HPE/DELL/SMCI/FLEX/COHR/AAOI. Thematic watchlist needed for mid-cap AI infra.
- [Modes Expansion + Redesign](project_modes_expansion_and_redesign.md) — Volet A: nouveaux modes crypto/metals(+mines)/forex (data). Volet B: refonte A→Z via skill impeccable (PRODUCT.md écrit, registre=product unifié, FT/Economist+terminal, mobile-first dense + RTL arabe + P&L colorblind-safe). Dashboard scanner/status à repenser pour N modes groupés par classe d'actif.

## Routines Cloud
- [Routine Redesign v2](project_routine_redesign_v2.md) — Conductors replaced by simple Sonnet routines (crash detector, market pulse, rotation detector). Old conductors disabled 2026-06-24.
- [Cloud routine auto-merge](project_cloud_routine_automerge.md) — les routines Claude cloud poussent sur une branche `claude/**` (pas main, pas de PR) ; MCP systematic PROUVÉ présent dans le sandbox cloud (run 20260709 : 5 modes engineMode:mcp) ; auto-merge câblé via `.github/workflows/auto-merge-nightly.yml` (gate qa-check+qa-content --strict → vert=PR+merge, rouge=PR retenue label qa-failed).

## Design
- [Scanner Status Reskin](project_scanner_status_reskin.md) — thème clair UNIQUE (dark reverté, ne pas re-tenter) ; reskin premium en 3 leviers scopés dans gen-status-page.js (cartes sans side-stripe + élévation, fond gris cool, rythme desktop) ; l'equity chart est déjà cohérent (ne pas "unifier") ; commits 3477590fe/a5a90b42f/fffd48f93.

## Références Externes
- [Screener Reliability 2026-07-02](reference_screener_reliability_20260702.md) — RunScreener DSL fiable (rising OK, mcap OK, as_of OK) ; gaps gateway : enable_backtest sans backtest_result, region=eu vide, AutoScreener sans floor mcap.
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
- [Go Edge & Deployment](project_go_edge_and_deployment.md) — Edge prouvé = volume-surge + range-expansion (reste = bruit). highvol $3M = 89% CAGR/SR 1.86. core-4 diversifié = 70%/SR 1.30. Gate Go par stratégie (highvol $3M, hybrid $5M, uk $3.95M). Décision highvol-concentré vs core-4 = risque user (on porte les 2 en draft).
