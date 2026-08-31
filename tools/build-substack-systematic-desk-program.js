#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const programRoot = path.join(root, 'data', 'substack', 'programs', 'retail-systematic-desk');
const seriesRoot = path.join(root, 'data', 'substack', 'series', 'retail-systematic-desk');
const draftsRoot = path.join(root, 'data', 'substack-drafts', 'retail-systematic-desk');
const createdAt = '2026-08-31T18:00:00Z';

const sources = {
  risk: [
    ['Investor.gov: Five Questions to Ask Before You Invest', 'https://www.investor.gov/introduction-investing/getting-started/five-questions-ask-you-invest'],
    ['FINRA: Concentration Risk', 'https://www.finra.org/investors/insights/concentration-risk']
  ],
  orders: [
    ['Investor.gov: Types of Orders', 'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders'],
    ['FINRA: Extended-Hours Trading', 'https://www.finra.org/investors/insights/extended-hours-trading']
  ],
  sec: [
    ['Investor.gov: Using EDGAR to Research Investments', 'https://www.investor.gov/introduction-investing/getting-started/researching-investments/using-edgar-research-investments'],
    ['SEC: Form 8-K', 'https://www.sec.gov/info/edgar/forms/form8-k.pdf']
  ],
  stats: [
    ['NIST: Bootstrap Plot', 'https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm'],
    ['NIST: Process Modeling', 'https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm']
  ],
  market: [
    ['NYSE: Hours and Calendars', 'https://www.nyse.com/trade/hours-calendars'],
    ['Investor.gov: Executing an Order', 'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/executing-order']
  ],
  research: [
    ['Investor.gov: Researching Investments', 'https://www.investor.gov/introduction-investing/getting-started/researching-investments'],
    ['Investor.gov: How to Read a 10-K', 'https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k']
  ],
  testing: [
    ['CFTC: Trading Systems Advisory', 'https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html'],
    ['NIST: Bootstrap Plot', 'https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm']
  ],
  records: [
    ['Investor.gov: Broker-Dealer Record-Keeping Requirements', 'https://www.investor.gov/introduction-investing/investing-basics/glossary/broker-dealers-record-keeping-requirements'],
    ['FINRA: Checking Trade Confirmations', 'https://www.finra.org/investors/insights/checking-trade-confirmations']
  ]
};

const modules = [
  {
    id: 'mandate', title: 'Start With a Mandate, Not a Model', episodes: [
      {
        title: 'Freeze the Scope Before You Write Code',
        subtitle: 'A narrow mandate prevents a prototype from quietly becoming an uncontrolled trading desk.',
        lesson: 'Write down the market, holding period, permitted instruments, decision time, account constraints and maximum operational complexity. A first system for liquid US stocks at one daily decision point is easier to observe than a machine spanning options, crypto, premarket and several brokers. Scope is a risk control because every extra surface creates another clock, identifier and failure mode.',
        build: 'Create a one-page mandate with explicit inclusions and exclusions. Give every future feature a default answer of no until it has data coverage, a test plan and an owner. The mandate should also name the human who can pause the system and the condition that forces a return to paper mode.',
        contract: ['market and session', 'instrument types', 'holding horizon', 'allowed order families', 'paper or live mode', 'owner and kill path'],
        verify: 'Hand the mandate to another person and ask them to classify five hypothetical requests. They should agree on whether each request is in scope without asking what you meant. If they disagree, the specification is not operational yet.',
        stop: 'Do not build a scanner while the universe, decision clock or permitted products can still change during a run.', source: 'risk'
      },
      {
        title: 'Define Non-Goals and Kill Criteria',
        subtitle: 'A safe system states what it refuses to optimize and when it must stop.',
        lesson: 'Goals such as maximize return are too loose for engineering. Pair every objective with a constraint and a shutdown rule. Examples include no leverage in the first version, no order without protection, no action on stale data and no automatic promotion from paper to live. A kill criterion is not pessimism; it is the point where evidence no longer supports continued operation.',
        build: 'Add a non-goals section and a kill matrix to the mandate. Separate strategy failure, data failure, broker failure and process failure. Each row needs an observable trigger, immediate behavior, evidence to retain and the authority required to resume.',
        contract: ['failure family', 'observable trigger', 'automatic response', 'retained evidence', 'resume authority'],
        verify: 'Run a tabletop exercise for a stale close, a duplicate order response and a missing stop. The operator should know whether to abstain, cancel, reconcile or escalate without inventing a new rule in the moment.',
        stop: 'If any severe failure ends with keep watching rather than a deterministic action, the control is incomplete.', source: 'risk'
      },
      {
        title: 'Choose a Boring First Market',
        subtitle: 'The best learning environment is liquid, observable and operationally simple.',
        lesson: 'A first systematic build should minimize market plumbing, not maximize excitement. Start with instruments whose identity, session, corporate actions and execution constraints are well documented. Avoid mixing asset classes until the system can distinguish their calendars, quote conventions and settlement behavior. Complexity can be added later; ambiguous records are much harder to remove.',
        build: 'Create an eligibility table for the first universe. Record exchange, asset type, currency, regular session, price source, minimum liquidity evidence and whether corporate actions can be reconciled. Use canonical instrument identifiers internally even if the interface displays tickers.',
        contract: ['instrument id', 'listing venue', 'asset type', 'currency', 'session calendar', 'data coverage'],
        verify: 'Resolve a stock, an ETF and an intentionally unknown ticker. The first two must retain different asset types; the unknown symbol must remain unavailable rather than being guessed or uppercased into existence.',
        stop: 'Do not admit an instrument when identity or trading calendar depends on a free-text ticker alone.', source: 'market'
      }
    ]
  },
  {
    id: 'boundaries', title: 'Separate Data, Decisions and Execution', episodes: [
      {
        title: 'Draw Hard System Boundaries',
        subtitle: 'Data collection, strategy decisions and broker actions should be separate services.',
        lesson: 'A useful retail desk has at least four boundaries: market facts, candidate research, portfolio decisions and broker execution. The interface is a fifth layer that explains state but does not become the source of truth. This separation lets a data outage block new decisions without corrupting the ledger, and lets the user interface fail without changing an order.',
        build: 'Draw the services and the objects passed between them. Use versioned JSON contracts rather than prose. The research layer may enrich candidates; it may not place orders. The execution layer may enforce broker risk; it may not repair a missing strategy field by guessing.',
        contract: ['facts snapshot', 'candidate record', 'decision plan', 'execution report', 'display projection'],
        verify: 'For every field on the desktop, identify its authoritative object. Then disable one layer at a time in a test environment. A broken renderer must not alter data, and an unavailable broker must not cause the strategy layer to fabricate fills.',
        stop: 'If the same process both invents a trade and confirms that it executed correctly, split the responsibilities before proceeding.', source: 'records'
      },
      {
        title: 'Facts, Decisions and Orders Are Different Objects',
        subtitle: 'Keeping three records prevents explanations from mutating into instructions.',
        lesson: 'A price bar is a fact, a ranked candidate is a research result, and an order is an instruction. They have different owners and validity rules. A persuasive narrative cannot fill a missing quantity, and an old plan cannot become current because the latest quote looks similar. Treating these records as separate objects makes accidental escalation visible.',
        build: 'Define three schemas. Facts carry provenance and observation time. Decisions carry reasons, gates, validity and a snapshot reference. Orders carry exact broker-supported fields plus an idempotency key. Link them with identifiers instead of copying unstructured text downstream.',
        contract: ['fact id and source', 'decision id and validity', 'order fingerprint and broker id'],
        verify: 'Delete a required field from each object and run contract tests. A missing source should reject the fact, a missing stop should reject a new long plan, and a missing idempotency key should reject placement.',
        stop: 'Never parse operational instructions from a human-readable reason when structured fields are absent.', source: 'orders'
      },
      {
        title: 'Let Each Layer Fail Without Lying',
        subtitle: 'Partial failure should remain visible instead of becoming a clean but false result.',
        lesson: 'Real systems degrade unevenly. Daily bars may be current while options are unavailable; one symbol may fail while nine succeed. The correct response is not always to discard the whole batch, and it is never to replace absence with zero. Each layer needs required and optional inputs so downstream users know exactly what remains eligible.',
        build: 'Give every cell a status, quality, source, event time, observation time and warnings. At the decision boundary, mark which facets are required. Preserve successful cells and reject only the decisions whose required evidence failed.',
        contract: ['status', 'quality', 'source', 'observed_at', 'warnings', 'required_for_decision'],
        verify: 'Inject one missing optional facet and one missing required facet. The first result should be partial but usable; the second should be ineligible with a specific rejection reason. Neither may silently become a full success.',
        stop: 'Block release when the interface cannot distinguish zero, not applicable, unavailable and stale.', source: 'research'
      }
    ]
  },
  {
    id: 'data-health', title: 'Make Data Quality Executable', episodes: [
      {
        title: 'Discover Capabilities at Runtime',
        subtitle: 'A client should ask what a service can do instead of trusting last month\'s schema.',
        lesson: 'Data and broker services evolve. A hardcoded tool list, field name or supported order type eventually drifts from production. Runtime discovery converts that drift into an explicit compatibility decision. It also prevents the client from assuming that every account, venue or data source supports the same operations.',
        build: 'Add a bootstrap phase that records service version, health, visible capabilities and schemas. Cache the result only for the run. Compare required capabilities with what is actually advertised and fail before collecting data or constructing orders when the contract is incompatible.',
        contract: ['service version', 'capability name', 'schema hash', 'required flag', 'compatibility verdict'],
        verify: 'Remove one required capability from a test adapter. The run should stop during bootstrap with no downstream side effects. Adding an optional capability should not change prior decisions unless the configuration explicitly enables it.',
        stop: 'Do not use an old local schema as permission to call a capability the current service does not advertise.', source: 'records'
      },
      {
        title: 'Make Freshness a Blocking Field',
        subtitle: 'Collected now does not mean the underlying market observation is current.',
        lesson: 'A response timestamp only proves when the client received data. Trading requires the event date and the last completed market session. Weekend, holiday and delayed-source behavior make calendar arithmetic unsafe. The decision should compare the served close with the exact close it expected to trade.',
        build: 'Store requested date, served date, market state, partial-bar policy and age. Resolve the expected session from an exchange calendar. Required bars must be complete and must reach that session; otherwise return stale or data insufficient.',
        contract: ['expected_close', 'served_close', 'include_partial', 'market_state', 'freshness_ok'],
        verify: 'Test a normal weekday, a holiday, a weekend and an upstream response that stops several sessions early while returning HTTP 200. Only the genuinely current dataset may pass.',
        stop: 'A healthy transport response with stale market coverage is still a failed trading input.', source: 'market'
      },
      {
        title: 'Preserve Partial Failures in Batches',
        subtitle: 'One bad symbol must not erase nine valid cells or make the batch look complete.',
        lesson: 'Batching is efficient, but careless clients associate responses by array position or collapse any error into an empty result. Use canonical identity and per-cell status instead. A batch can be completed, partial or failed; the label should reflect what actually happened.',
        build: 'Key results by instrument id and facet. Include requested and returned ranges, missing intervals, truncation and pagination state. Concatenate pages only when their snapshot identifier matches.',
        contract: ['instrument_id', 'facet', 'requested_range', 'returned_range', 'pagination_token', 'snapshot_id'],
        verify: 'Request one stock, one ETF and one unknown symbol across price and company-only facets. Valid stock data should survive; ETF fundamentals may be not applicable; the unknown identity should be unavailable. Shuffle response order to prove the client does not rely on indexes.',
        stop: 'Reject any batch whose pages come from different snapshots or whose results cannot be tied to canonical instruments.', source: 'research'
      }
    ]
  },
  {
    id: 'identity-time', title: 'Treat Identity and Time as Data', episodes: [
      {
        title: 'Resolve Identity Before You Use a Ticker',
        subtitle: 'The same symbol can refer to different instruments across venues and time.',
        lesson: 'Tickers are display labels, not durable primary keys. Listings change, symbols are reused and the same shorthand can represent different asset types. A systematic desk needs an instrument master that retains venue, currency, type and effective dates.',
        build: 'Create a resolver that returns one canonical record or an explicit ambiguous or unavailable result. Persist the identifier throughout data, decisions and orders. Keep the ticker as presentation metadata.',
        contract: ['instrument_id', 'symbol', 'exchange', 'currency', 'asset_type', 'effective_from', 'effective_to'],
        verify: 'Test a renamed listing, an ETF and an ambiguous symbol. Historical records must continue to point to the instrument that existed at the time; no request may resolve by uppercase conversion alone.',
        stop: 'If the broker and market-data records cannot be joined without guessing, the instrument is not eligible.', source: 'research'
      },
      {
        title: 'Treat Time as a First-Class Field',
        subtitle: 'Event time, observation time and ingestion time answer different questions.',
        lesson: 'A filing may describe an earlier transaction, a quote may be observed after the market closes, and a dataset may be ingested much later. Using one date field for all three creates lookahead and false freshness. Every evidence item should state when the event happened and when the system could first know it.',
        build: 'Adopt explicit temporal names and require a temporal mode on each query. Point-in-time analysis filters by first availability, not by the date printed inside the document. Current-only composites must reject historical reconstruction requests.',
        contract: ['event_time', 'available_at', 'observed_at', 'ingested_at', 'temporal_mode'],
        verify: 'Construct a filing whose transaction date precedes its publication. A replay before publication must not see it; a replay after publication may. Repeat with a corrected dataset that arrived later.',
        stop: 'Do not substitute a current value when the requested historical snapshot is missing.', source: 'sec'
      },
      {
        title: 'Corporate Events Can Change the Instrument',
        subtitle: 'Splits, mergers and distributions are data transformations, not footnotes.',
        lesson: 'A price series can look continuous while shares, symbols or economic rights changed. Adjusted prices help historical return calculations but do not authorize a client to mutate live broker positions or orders. The broker may cancel, replace or adjust them first, so historical normalization and broker reconciliation are separate operations.',
        build: 'Maintain effective-dated corporate actions in a deduplicated event ledger. Normalize historical data through a tested transformation layer. For live state, pause the instrument, identify documented broker behavior, fetch broker-authoritative positions and orders, and apply an explicit repair only after reconciliation.',
        contract: ['action_type', 'effective_date', 'ratio_or_cash', 'source', 'position_effect', 'order_effect'],
        verify: 'Replay a split where the broker has already adjusted one order and canceled another. The client must not double-adjust either record; reconciliation must remain balanced and the sealed decision artifact must remain unchanged.',
        stop: 'Pause the instrument when a material corporate action cannot be reconciled across data and broker records.', source: 'sec'
      }
    ]
  },
  {
    id: 'snapshots', title: 'Build Reproducible Market Snapshots', episodes: [
      {
        title: 'Use One Snapshot for One Decision',
        subtitle: 'Mixing data cuts makes a precise-looking plan impossible to reproduce.',
        lesson: 'A candidate selected on one close and enriched with another can pass gates it never satisfied simultaneously. Freeze the cut used by the whole decision. Optional live observations may be attached later, but they must not rewrite the historical snapshot.',
        build: 'Issue a snapshot identifier at collection time. Bind every facet, derived feature and review to it. Store required failures separately from optional failures and keep the expected close in the top-level record.',
        contract: ['snapshot_id', 'captured_at', 'expected_close', 'source_versions', 'required_failures'],
        verify: 'Attempt to combine a price page from one snapshot with a filing page from another. The assembler should reject the merge. Replaying the original bundle should reproduce identical structured decisions.',
        stop: 'If two reviewers are looking at different cuts, neither review can certify the same plan.', source: 'research'
      },
      {
        title: 'Hash the Evidence, Not the Narrative',
        subtitle: 'Integrity comes from binding decisions to files and fields, not from confident prose.',
        lesson: 'A review cannot prove what it saw unless it is bound to a precise evidence set. Hash each input and aggregate the ordered hashes into one snapshot digest. A hash proves correspondence to a separately trusted checkpoint; by itself it proves neither completeness, truth nor original creation time.',
        build: 'Create a manifest listing each evidence path, digest, source and relevant JSON pointer. Retain the aggregate digest independently or sign it, enforce append-only access where practical, and test restoration. Refuse publication or execution when a required file differs after review.',
        contract: ['evidence_path', 'sha256', 'source', 'json_pointer', 'aggregate_sha256'],
        verify: 'Change one byte in a reviewed input and run the release gate. It must invalidate the attestation. Restore the byte and confirm the replay returns the original digest and result.',
        stop: 'Do not accept a reviewer statement that is not bound to the exact snapshot it reviewed.', source: 'records'
      },
      {
        title: 'Replay Without Re-Querying',
        subtitle: 'A reproducible run consumes a frozen bundle instead of asking the market again.',
        lesson: 'Re-querying after a bug or disagreement changes both data and diagnosis. A replay should be offline, deterministic and side-effect free. Byte equality is meaningful only when runtime, dependencies, serialization and randomness are controlled; otherwise the runner must explain the version difference.',
        build: 'Package normalized inputs, configuration version, code version, dependency lock, runtime metadata, fixed seed or recorded randomness, canonical serialization rules and expected outputs. Keep authentication and secrets outside the bundle. Add a runner that refuses network access and broker mutation.',
        contract: ['run_id', 'input_manifest', 'config_version', 'runtime_lock', 'randomness_record', 'expected_output_hash'],
        verify: 'Run the same bundle twice on a clean machine. Compare structured outputs before rendering. Then change only the renderer and prove the decision hash remains stable while presentation changes.',
        stop: 'A rerun that silently downloads fresh data is a new experiment, not a replay.', source: 'testing'
      }
    ]
  },
  {
    id: 'scanner', title: 'Build a Scanner That Can Say No', episodes: [
      {
        title: 'Screen Broad, Then Narrow With Evidence',
        subtitle: 'Cheap deterministic filters should precede expensive research.',
        lesson: 'A scanner is a funnel, not a recommendation engine. Begin with a defined universe and inexpensive eligibility checks. Only survivors receive deeper technical, event, filing and peer research. This keeps cost bounded and makes every rejection traceable.',
        build: 'Split the run into candidate discovery and governing evidence. Persist both stages. Use stable tie-breaks and per-candidate gates. Do not let a language model transport raw data or recalculate rankings.',
        contract: ['universe_version', 'candidate_id', 'rank', 'gate_results', 'evidence_status'],
        verify: 'Run the same snapshot twice and require identical candidates, ranks and reasons. Remove one expensive enrichment source and confirm only candidates requiring it become ineligible.',
        stop: 'Do not publish a ranked name until all evidence required by its setup has completed.', source: 'research'
      },
      {
        title: 'Zero Candidates Is a Valid Outcome',
        subtitle: 'Forcing a quota converts selectivity into hidden risk.',
        lesson: 'A scanner should return no setup when nothing passes. But an empty list is meaningful only after proving that the pipeline ran, the universe was populated and the filters behaved as intended. A crash and a calm day must never share the same output.',
        build: 'Emit run markers for every stage with input counts, output counts and status. When the result is empty, run an ablation check on suspect clauses and preserve warnings. The final object should distinguish no setup, data insufficient and pipeline failure.',
        contract: ['stage', 'ran_at', 'input_count', 'output_count', 'status', 'warnings'],
        verify: 'Test three fixtures: a legitimate empty screen, an empty universe and a failed enrichment. Only the first may return no setup. The other two must block with exact causes.',
        stop: 'Never fill a target list with lower-quality names merely because the interface expects cards.', source: 'testing'
      },
      {
        title: 'Explain Every Rejection',
        subtitle: 'A rejected candidate is useful feedback when the failed gate is explicit.',
        lesson: 'Opaque scores teach users to chase the top row. A better scanner exposes the controlling gate: stale data, event veto, weak liquidity, unreachable target, missing filing review or portfolio conflict. The reason should come from structured observations, not generated prose.',
        build: 'Store each gate as field, operator, threshold class, observed value, source and pass state. Public tutorials should use toy values and generic rule classes; production parameters remain private.',
        contract: ['field', 'operator', 'rule_class', 'observed', 'passed', 'source'],
        verify: 'For a fixture candidate, alter one observation at a time and confirm only the matching gate changes. The displayed value must equal the value used by the gate.',
        stop: 'If a user cannot tell whether a name failed on data, setup or risk, the scanner is not actionable.', source: 'research'
      }
    ]
  },
  {
    id: 'certification', title: 'Turn Candidates Into Conditional Plans', episodes: [
      {
        title: 'Certify a Candidate With Independent Evidence',
        subtitle: 'A chart pattern is one input, not a complete trade case.',
        lesson: 'Certification asks whether the setup survives technical, event, filing, liquidity and timing checks. These checks should be independent enough that repeating the same price feature under three names does not create false confirmation. Missing required evidence rejects the plan.',
        build: 'Create a checklist with required and optional facets. Capture the thesis, counter-thesis, catalyst, invalidation and data limitations. Keep hard levels in structured fields and the explanation in prose.',
        contract: ['setup_type', 'drivers', 'counter_case', 'catalysts', 'invalidation', 'limitations'],
        verify: 'Give the same snapshot to a correctness reviewer and a contrarian reviewer. They may interpret the evidence differently, but they must agree on the underlying observations and missing fields.',
        stop: 'Do not upgrade confidence because several derived indicators share the same underlying price series.', source: 'sec'
      },
      {
        title: 'Test the Sector, Leaders and Blast Radius',
        subtitle: 'Peers can confirm context without becoming proof of causality.',
        lesson: 'A company rarely trades in isolation. Compare direct peers, sector leadership, suppliers, customers and high-beta proxies, but separate economic links from statistical co-movement. Correlation after removing a broad-market factor is more informative than raw synchronized movement, yet it still does not prove causality.',
        build: 'Map peers by economic role, then measure comparable returns over aligned windows. Record the benchmark or factor model, return convention, estimation window, missing-data policy, residualization method, overlap and coverage. Keep the company\'s own event chronology in control of the conclusion.',
        contract: ['peer_id', 'economic_role', 'factor_model', 'return_convention', 'window', 'residual_method', 'coverage'],
        verify: 'Introduce a market-wide rally into synthetic peer series. Raw correlations should rise; market-neutral relationships may not. The interface should label weak coverage instead of ranking it as conviction.',
        stop: 'Never turn one proxy move into an automatic instruction for another security.', source: 'stats'
      },
      {
        title: 'Turn Price Levels Into Conditional Plans',
        subtitle: 'An entry is a market condition with an expiry, not a number to chase.',
        lesson: 'A useful plan says enter if, skip if and invalidate if. It distinguishes a trigger from a blind limit order and checks whether the target is reachable within the intended horizon. The plan also expires; old levels are historical references, not standing instructions.',
        build: 'Represent entry window, trigger, stop, targets, horizon, maximum slippage and validity as fields. Recalculate the plan after a material gap rather than moving every level to preserve the idea.',
        contract: ['valid_from', 'valid_until', 'entry_condition', 'stop', 'targets', 'max_slippage'],
        verify: 'Test a clean trigger, a gap beyond the allowed entry, an expired plan and a price that reaches the stop before activation. Only the first scenario may arm an order.',
        stop: 'Do not convert a limit into a market order or widen invalidation simply to obtain a fill.', source: 'orders'
      }
    ]
  },
  {
    id: 'decision-contract', title: 'Make Strategy Decisions Machine-Readable', episodes: [
      {
        title: 'Put Strategy Rules in Versioned Configuration',
        subtitle: 'Code should execute a declared contract, not hide tunable behavior.',
        lesson: 'Configuration makes strategy changes reviewable and forward-dated. It also lets the same engine run different mandates without hardcoded symbol or strategy lists. The public lesson is the contract pattern; actual parameters, weights and deployed combinations stay private.',
        build: 'Define a schema for universe reference, schedule, required features, risk ownership and output type. Version every change and record its effective date. Defaults must be conservative and new engine features should be opt-in.',
        contract: ['config_id', 'version', 'effective_from', 'universe_ref', 'schedule', 'feature_flags'],
        verify: 'Load an old and new configuration against the same frozen snapshot. The engine should report which version governed each decision and reject unknown fields or missing required values.',
        stop: 'Never edit historical configuration to make a prior result look as if it used today\'s rules.', source: 'testing'
      },
      {
        title: 'Persist State, Validity and Revisions',
        subtitle: 'A stateful strategy cannot be reconstructed safely from broker positions alone.',
        lesson: 'Strategy state may include entry dates, trailing references, cooldowns or risk halts. Treat it as an opaque object owned by the decision engine. A revised plan explicitly supersedes the previous one; two plans are never merged by convenience.',
        build: 'Persist state per portfolio with plan id, revision, validity and supersession reference. Store it only after a successful decision. Echo it unchanged on the next run and keep broker snapshots as separate evidence.',
        contract: ['plan_id', 'revision', 'state', 'valid_from', 'valid_until', 'supersedes_plan_id'],
        verify: 'Restart between two decisions and confirm the same state resumes. Submit an older revision after a newer one and require rejection. Expire a plan and prove it can no longer create an order.',
        stop: 'Do not infer missing strategy state from current holdings or an explanatory note.', source: 'records'
      },
      {
        title: 'Use a Complete Machine-Readable Plan',
        subtitle: 'Execution should receive quantities, protections and gates, not an investment story.',
        lesson: 'A complete plan carries candidate identity, side, quantity, broker intent, order type, protection, execution window, promotion policy and reason. At this stage quantities are synthetic fixtures only; portfolio sizing must pass later before paper deployment. Human-readable context explains the choice but never supplies missing operational fields.',
        build: 'Validate the entire plan before arming any group. Enforce unique identifiers, ordered ranks, one-winner constraints and protection for every new position. Reject the full plan when a required quantity or level is missing.',
        contract: ['group_id', 'candidate_id', 'rank', 'order', 'protection', 'execution', 'reason'],
        verify: 'Create malformed fixtures for duplicate ranks, absent stops and expired validity. Each should fail before any broker call. A valid single-candidate group should pass without requiring an alternate.',
        stop: 'Never complete a partially specified plan in the broker or user-interface layer.', source: 'orders'
      }
    ]
  },
  {
    id: 'backtesting', title: 'Backtest Without Fooling Yourself', episodes: [
      {
        title: 'Backtest on Frozen Point-in-Time Data',
        subtitle: 'A fast simulation is useless if it sees information the trader could not know.',
        lesson: 'Backtests need effective-dated membership, corporate actions and first-availability timestamps. Current fundamentals applied across history introduce lookahead even when price bars are correct. When a historical field is not point-in-time, label the approximation or exclude it.',
        build: 'Freeze an input bundle before each experiment. Store data coverage, unavailable ranges and configuration version. Separate the research notebook from the authoritative replay runner.',
        contract: ['as_of', 'available_at_filter', 'universe_version', 'coverage', 'approximation_flags'],
        verify: 'Insert a future filing and a later index constituent into a fixture. Neither may appear before its effective availability. Run the same bundle twice and compare trade records and metrics.',
        stop: 'Do not describe a backtest as historical proof when current-only enrichments governed past trades.', source: 'testing'
      },
      {
        title: 'Model Costs, Gaps and Partial Fills',
        subtitle: 'Close-to-close arithmetic is not an execution model.',
        lesson: 'A realistic simulator distinguishes order type, session, spread, slippage, volume and gaps. Stops may fill beyond their trigger; limit orders may not fill at all. Partial fills create positions that still require protection and reconciliation.',
        build: 'Implement market-state transitions and broker capability profiles. Simulate no fill, partial fill, gap-through stop, rejected order and delayed cancel. Keep assumptions visible and configurable.',
        contract: ['market_state', 'order_type', 'fill_qty', 'fill_price', 'cost_model', 'protection_state'],
        verify: 'Use synthetic bars where high and low cross several order levels. Define deterministic precedence and test it. Stress costs beyond the base assumption to see whether the result depends on optimistic execution.',
        stop: 'Do not promote a strategy whose edge disappears under modest execution stress.', source: 'orders'
      },
      {
        title: 'Use Baselines, Walk-Forward and Stress Tests',
        subtitle: 'A backtest matters only relative to simple alternatives and unseen periods.',
        lesson: 'Compare the proposal with cash, a broad benchmark, random timing under the same constraints and the current production rule. Calibrate on one period and validate on later data. Examine distributions, winner dependence and regime slices rather than one aggregate score.',
        build: 'Create an experiment matrix before running tests. Freeze the primary metric, secondary risks and materiality rule. Keep optimization and final validation in separate artifacts.',
        contract: ['hypothesis', 'baseline', 'in_sample', 'out_of_sample', 'stress_case', 'promotion_metric'],
        verify: 'Use block or cluster resampling that preserves relevant dependence, remove the largest winners, and report uncertainty intervals. Apply multiple-testing controls, keep a final untouched validation set, and label conclusions weak when sample size is small.',
        stop: 'Reject changes chosen after repeatedly inspecting the same out-of-sample period.', source: 'stats'
      }
    ]
  },
  {
    id: 'portfolio-risk', title: 'Control the Portfolio Before the Trade', episodes: [
      {
        title: 'Size at the Portfolio Level',
        subtitle: 'Per-trade loss is only one ceiling on position size.',
        lesson: 'A position can fit its nominal stop and still make the portfolio fragile. Stops can gap and fill with slippage, so a loss budget is a target rather than a guaranteed ceiling. Size must also respect cash, concentration, gross and net exposure, liquidity, currency and event clustering.',
        build: 'Calculate candidate size from nominal stop distance and stressed gap, slippage, liquidity and event scenarios, then apply portfolio caps. Round down to supported quantities. Record every ceiling and the scenario that governed.',
        contract: ['risk_budget_target', 'nominal_stop_loss', 'stressed_loss', 'liquidity_cap', 'concentration_cap', 'final_qty'],
        verify: 'Create two candidates with identical stops but different sector exposure and gap stress. Their quantities should differ for explicit reasons. Missing equity, currency conversion or stress inputs must block sizing.',
        stop: 'Never increase size merely because the broker reports unused buying power.', source: 'risk'
      },
      {
        title: 'Find Correlation and Hidden Factor Bets',
        subtitle: 'Ten tickers can still be one concentrated position.',
        lesson: 'Names from different industries may share the same growth, rate, commodity or broad-market factor. Measure pairwise dependence, but also group economic exposures and common event risk. Correlation is unstable, so it informs limits rather than certifying diversification.',
        build: 'Produce a portfolio map with sector, theme, beta, currency and event buckets. Show coverage and observation counts beside correlations. Add stress scenarios that shock common factors rather than isolated tickers.',
        contract: ['exposure_bucket', 'weight', 'beta', 'correlation_window', 'coverage', 'stress_loss'],
        verify: 'Construct a portfolio with many names driven by one factor. The dashboard should reveal concentration even if ticker count looks diversified. Reduce coverage and confirm confidence falls.',
        stop: 'Do not call a portfolio diversified from name count alone.', source: 'risk'
      },
      {
        title: 'Gate Event Risk and Add Kill Switches',
        subtitle: 'Known events and system health should override the urge to deploy capital.',
        lesson: 'Earnings, macro releases, halts and broker incidents can change execution risk faster than a daily model. Event gates belong in the plan before placement. Kill switches reduce further exposure when conditions cross predeclared boundaries; they do not guarantee cancellation, flattening or protection.',
        build: 'Maintain an event calendar with source and confidence. Define distinct halt-new-risk, cancel, reduce and flatten actions, reduce-only mode, explicit resume authority and an independent manual credential-revocation path. Keep event vetoes separate from strategy rejection.',
        contract: ['event_type', 'event_time', 'entry_veto', 'kill_state', 'broker_action', 'verification_state', 'resume_rule'],
        verify: 'Simulate an unconfirmed event date, a confirmed release and a broker outage. Every requested broker mutation must be read back. Ambiguous state blocks automatic repair, escalates to a human and remains distinct from a confirmed operational halt.',
        stop: 'Never bypass a kill state because a candidate appears unusually attractive.', source: 'sec'
      }
    ]
  },
  {
    id: 'simulation', title: 'Prove Execution in a Simulator', episodes: [
      {
        title: 'Simulate the Broker Before Connecting One',
        subtitle: 'The simulator is a contract test for the desk, not a return generator.',
        lesson: 'A broker simulator should expose the same order states and capability limits the execution client expects. Its job is to test transitions, rejection handling and protection, not to make fills look favorable. Keep strategy logic outside the adapter.',
        build: 'Implement a small capability matrix and deterministic order book. Support accepted, working, partial, filled, canceled, rejected and expired states. Make time and prices injectable for replay.',
        contract: ['capabilities', 'order_state', 'filled_qty', 'remaining_qty', 'timestamps'],
        verify: 'Run the client against two simulated brokers with different capabilities. The plan should be accepted only when required protection and order features are available.',
        stop: 'Do not add a broker workaround that changes the plan without surfacing a rejection.', source: 'orders'
      },
      {
        title: 'Build an Explicit Order State Machine',
        subtitle: 'Orders move through states; they do not jump from submitted to done.',
        lesson: 'Network timeouts, pending cancels and partial fills make binary status unsafe. Model allowed transitions and make unexpected transitions errors. A partial fill ends alternate selection and immediately creates a protection obligation for the filled quantity.',
        build: 'Draw states and transitions for submit, acknowledge, partial fill, fill, cancel request, cancel confirmation, rejection and expiry. Store every transition with source and time.',
        contract: ['order_id', 'previous_state', 'new_state', 'filled_qty', 'source', 'occurred_at'],
        verify: 'Replay duplicate acknowledgements, a fill during cancellation and a late response after timeout. The final state must reconcile without creating a second order.',
        stop: 'Never promote an alternate candidate after any fill, including a partial one.', source: 'orders'
      },
      {
        title: 'Test Restarts, Duplicates and Broken Networks',
        subtitle: 'A robust client assumes it will lose the response at the worst moment.',
        lesson: 'The hardest execution bug is uncertainty after a request may have reached the broker. A local fingerprint alone never proves non-execution. Durable pre-submit intent, broker idempotency keys where supported, complete paginated history and bounded reconciliation reduce risk; unresolved ambiguity must forbid automatic retry.',
        build: 'Persist request identity and business intent before submission. On timeout, inspect complete open, completed, fill and execution history across a bounded consistency window. Restore protections and group state after restart, but keep an explicit unknown state when broker evidence is incomplete.',
        contract: ['request_id', 'business_intent_id', 'broker_idempotency_key', 'submission_state', 'history_cursor', 'reconciled_at'],
        verify: 'Drop the response after acceptance, hide the order during an eventual-consistency window, then restart. The client must remain unknown and refuse a duplicate until authoritative evidence resolves the intent. Repeat after a partial fill.',
        stop: 'Do not use a fresh request identifier for a technical retry of identical intent.', source: 'records'
      }
    ]
  },
  {
    id: 'broker-execution', title: 'Connect a Broker Without Losing Control', episodes: [
      {
        title: 'Check Broker Capabilities Before Placement',
        subtitle: 'Account and venue support must be discovered for every execution run.',
        lesson: 'Order types, extended hours, fractional quantities and native protection vary by account and venue. Before any real credential is connected, establish least privilege, secret storage and rotation, paper/live isolation, controlled egress, redacted audit logs and an independent revoke path. A generic broker label is not enough.',
        build: 'Complete the security baseline, then fetch capabilities and account safety state at run start and again before mutation. Classify unsupported requirements precisely. Never downgrade a protected order to a weaker local approximation in silence.',
        contract: ['account_id', 'credential_scope', 'revoke_path', 'capability', 'supported', 'session_state', 'safety_state'],
        verify: 'Ask a limited adapter to execute a plan requiring unsupported protection. It must refuse before entry. A reduction or close may follow a separate contract that does not require new-position protection.',
        stop: 'If required-before-fill protection cannot be guaranteed, reject the candidate.', source: 'orders'
      },
      {
        title: 'Make Placement Idempotent',
        subtitle: 'Every retry must reconcile first and remain blocked when broker acceptance is unknown.',
        lesson: 'Idempotence starts with durable business intent, not only order fields. Scope the intent by portfolio, plan, revision, candidate or group and execution window, then derive a canonical fingerprint. Prefer a broker-supported idempotency key; a local hash never proves that an unseen order was not accepted.',
        build: 'Persist intent before the network call, define canonical field ordering and numeric precision, and keep request identity stable for identical retries. Search complete paginated order and execution history. An ambiguous result remains unknown and blocks automatic placement.',
        contract: ['portfolio_id', 'plan_id', 'revision', 'candidate_id', 'execution_window', 'fingerprint', 'broker_idempotency_key', 'dedup_status'],
        verify: 'Submit the same intent through retries with fields in different JSON order. It should produce one fingerprint and one broker order. A real plan revision should produce a distinct fingerprint.',
        stop: 'Do not rely on a user-interface button becoming disabled as the duplicate-order control.', source: 'records'
      },
      {
        title: 'Reconcile Intent With Broker Reality',
        subtitle: 'The broker record wins on fills, while the plan remains the source of intended behavior.',
        lesson: 'Reconciliation compares expected positions, open orders, fills and protections with broker facts. Differences need typed causes and bounded actions. A missing protection blocks new risk, but ambiguous broker state forbids automatic repair; the client may never invent a strategy decision.',
        build: 'Run reconciliation before new orders and after uncertain responses. Classify missing order, extra order, quantity drift, partial fill, protection gap and unknown state. Require exact target identifiers, verify every mutation by readback and escalate unresolved protection to a human or independent emergency revoke path.',
        contract: ['expected_state', 'broker_state', 'difference_type', 'repair_action', 'approval_state'],
        verify: 'Inject an extra broker order and a missing stop. The first should be escalated or canceled only under policy; the second should block new risk and trigger the defined protection path.',
        stop: 'Never treat absence from local state as proof that a broker order does not exist.', source: 'records'
      }
    ]
  },
  {
    id: 'ledger-operations', title: 'Keep an Audit Trail That Survives Incidents', episodes: [
      {
        title: 'Use an Append-Only Decision Ledger',
        subtitle: 'Corrections should add records, not rewrite the history they explain.',
        lesson: 'A useful ledger records what the system knew, decided and attempted at the time. Later corrections reference the original event and add a new version. A hash chain detects changes only relative to a trusted external checkpoint; it does not make the storage truthful or complete by itself.',
        build: 'Write events with sequence, timestamp, actor identity, object identifiers and previous-event hash. Retain signed or independently stored root hashes, restrict mutation access, test backup restoration and separate immutable events from derived views.',
        contract: ['sequence', 'event_type', 'actor', 'object_id', 'payload_hash', 'previous_hash', 'external_checkpoint', 'recorded_at'],
        verify: 'Alter a historical event and confirm chain verification fails. Rebuild a dashboard from the unmodified ledger and compare it with the stored projection.',
        stop: 'Do not repair a past decision by editing it in place.', source: 'records'
      },
      {
        title: 'Design Recovery and Supersession',
        subtitle: 'A restart must know which plan, revision and protection are active.',
        lesson: 'Recovery is part of the normal architecture. Persist active plan identity, group state, order fingerprints, broker identifiers, fills and protection state. A new revision replaces the old one atomically and records why.',
        build: 'Create a startup sequence: verify ledger, load active plan, fetch broker state, reconcile, restore monitoring, then permit new decisions. Expired plans remain visible but cannot execute.',
        contract: ['active_plan', 'revision', 'group_state', 'orders', 'fills', 'protection_state'],
        verify: 'Terminate the process between entry fill and local acknowledgement. With complete broker evidence and exact identifiers, recover the fill, place protection idempotently, verify it by readback and close the group. With incomplete evidence, remain unknown, block mutation and escalate manually.',
        stop: 'Never activate two plan revisions simultaneously or merge their candidates.', source: 'records'
      },
      {
        title: 'Make Every Run Auditable',
        subtitle: 'A quiet day and a crashed pipeline need different evidence.',
        lesson: 'Each scheduled run should leave a terminal record even when it does nothing. Include capabilities, data health, snapshot, decisions, gates, broker checks, actions and errors. A missing run marker is an operational incident, not no activity.',
        build: 'Create a run envelope with stage markers and a final status. Link structured outputs and hashes. Keep logs useful but do not depend on free text for accounting or execution state.',
        contract: ['run_id', 'started_at', 'completed_at', 'stage_markers', 'final_status', 'artifacts'],
        verify: 'Kill the process after each stage in separate tests. Monitoring should identify the last completed marker and the final record should remain absent until recovery closes the run.',
        stop: 'Do not mark a run completed because a wrapper process exited with code zero while required stages are missing.', source: 'records'
      }
    ]
  },
  {
    id: 'desktop-ux', title: 'Design a Decision-First Retail Desktop', episodes: [
      {
        title: 'Put the Decision and Controls First',
        subtitle: 'The first viewport should answer what, why, when and what blocks action.',
        lesson: 'A retail expert should not hunt through charts to learn whether a plan is active. Lead with status, validity, trigger, invalidation, risk state and next check. Detailed evidence belongs below, visible by default or through clear section navigation rather than one giant hidden disclosure.',
        build: 'Design a summary band, a systematic control checklist and a scenario panel. Use consistent states such as ready, wait, blocked, expired and data insufficient. Keep the authoritative values in structured data and render them once.',
        contract: ['decision_status', 'validity', 'trigger', 'invalidation', 'blocking_checks', 'next_observation'],
        verify: 'Give the page to a user for thirty seconds. They should identify whether action is allowed, the main risk and the condition that changes the status without scrolling through the full report.',
        stop: 'Do not use a grade, gauge or color as a substitute for the decision state.', source: 'risk'
      },
      {
        title: 'Make Missing Data Actionable',
        subtitle: 'Unavailable is useful only when the interface explains impact and recovery.',
        lesson: 'Empty cards waste attention. When data is missing, show which source or facet failed, whether it blocks the decision, the last valid observation and the next permitted recovery step. Suppress decorative sections that contribute nothing.',
        build: 'Create a missing-data component with status, scope, impact, last valid time and recovery owner. Distinguish not applicable from temporarily unavailable. Place blocking gaps in the summary checklist.',
        contract: ['facet', 'status', 'blocking', 'last_valid_at', 'recovery_action', 'owner'],
        verify: 'Render fixtures for stale prices, unavailable social data and not-applicable company fundamentals on an ETF. The user should not mistake any of them for a neutral signal.',
        stop: 'Do not calculate scores from missing values or fill blank sections with N/A tiles.', source: 'research'
      },
      {
        title: 'Use Alerts That Lead to Decisions',
        subtitle: 'An alert should identify impact, required action and urgency.',
        lesson: 'A stream of system messages trains users to ignore the desk. Alerts should be deduplicated, severity-based and tied to an operator decision. Informational market movement is different from a protection gap or an expired plan.',
        build: 'Define alert classes, ownership, deduplication keys and acknowledgement rules. Include the object affected, current state, consequence, action and deadline. Keep routine successes in the run history rather than notifications.',
        contract: ['severity', 'dedup_key', 'affected_object', 'consequence', 'required_action', 'deadline'],
        verify: 'Replay repeated stale-data events and one new protection failure. The stale warning should collapse under its deduplication window; the protection failure should remain distinct and urgent.',
        stop: 'Do not send an alert that cannot tell the recipient what decision is required.', source: 'records'
      }
    ]
  },
  {
    id: 'ai-lifecycle', title: 'Constrain AI and Promote Slowly', episodes: [
      {
        title: 'Keep the Language Model Out of Arithmetic',
        subtitle: 'Use AI for interpretation and review, while code owns numbers and state.',
        lesson: 'A language model can summarize evidence, challenge a thesis and improve explanations. It should not transport datasets, calculate position size, choose hidden thresholds or mutate broker state from prose. Deterministic scripts own arithmetic, schemas, hashes and release gates.',
        build: 'Mark each pipeline step as deterministic, interpretive or side-effecting. Feed the model a frozen structured snapshot. Validate its output against the same schema and recompute every hard number outside the model.',
        contract: ['input_snapshot', 'allowed_task', 'structured_output', 'numeric_recheck', 'side_effect_boundary'],
        verify: 'Ask the model to change a quantity in narrative text. The renderer may display commentary, but the order payload must remain unchanged. Remove a required field and ensure the model cannot repair it.',
        stop: 'Never allow persuasive prose to override a failed deterministic gate.', source: 'testing'
      },
      {
        title: 'Use Adversarial Review as a Release Gate',
        subtitle: 'Different reviewers should attack correctness, risk and usability on the same snapshot.',
        lesson: 'One review tends to repeat the author\'s assumptions. Use separate roles for data integrity, technical correctness, contrarian logic, execution safety and retail actionability. The weakest critical verdict controls release.',
        build: 'Give every reviewer the same hashed artifact and a blocking checklist. Findings need evidence references and severity. Apply fixes, rebuild the snapshot and repeat the reviews; an old approval cannot bless changed files.',
        contract: ['review_role', 'snapshot_hash', 'finding', 'severity', 'verdict', 'attested_at'],
        verify: 'Change a reviewed file after approval and run the gate. It must fail on hash mismatch. Add a contradictory portfolio exposure and confirm the system-level reviewer can block even if each item passes alone.',
        stop: 'Do not treat a style review or an AI phrase linter as proof of financial correctness.', source: 'testing'
      },
      {
        title: 'Promote From Replay to Live in Stages',
        subtitle: 'The capstone is a controlled operating process, not an autonomous bot.',
        lesson: 'Promotion should move through offline replay, read-only monitoring, paper trading, shadow execution and a tightly bounded live pilot. Each stage has objective evidence, an observation window, rollback and a human owner. Production also requires operational security; passing market tests is not enough.',
        build: 'Assemble the capstone and add least-privilege credentials, secret storage and rotation, paper/live isolation, controlled egress, redacted audit logs, clock monitoring, tested backup restoration and an independent manual revoke path. Define promotion evidence before collecting results.',
        contract: ['stage', 'entry_criteria', 'evidence_window', 'security_gates', 'rollback', 'manual_revoke', 'owner', 'promotion_verdict'],
        verify: 'Run incident drills for stale data, duplicate intent, missing protection and restart recovery. The system is not ready for the next stage until every required drill closes with auditable evidence.',
        stop: 'Never let the system promote itself or increase real-money scope without explicit human approval.', source: 'testing'
      }
    ]
  }
];

const orderedModuleIds = [
  'mandate', 'boundaries', 'data-health', 'identity-time', 'snapshots',
  'scanner', 'certification', 'decision-contract', 'backtesting', 'portfolio-risk',
  'simulation', 'ledger-operations', 'broker-execution', 'desktop-ux', 'ai-lifecycle'
];
modules.sort((left, right) => orderedModuleIds.indexOf(left.id) - orderedModuleIds.indexOf(right.id));

const weeklyArtifacts = [
  'signed mandate', 'kill-and-resume matrix', 'instrument eligibility table',
  'service-boundary diagram', 'three-schema contract pack', 'partial-failure fixture report',
  'capability bootstrap report', 'freshness gate test report', 'batch-integrity fixture pack',
  'effective-dated instrument record', 'temporal-field contract', 'corporate-action reconciliation runbook',
  'single-cut snapshot manifest', 'independently checkpointed evidence digest', 'offline replay bundle',
  'two-stage scanner run record', 'no-setup run record', 'gate-by-gate rejection report',
  'candidate certification sheet', 'factor-documented peer map', 'expiring conditional plan',
  'versioned strategy configuration schema', 'supersession state record', 'validated paper-plan fixture',
  'point-in-time backtest bundle', 'execution-stress fixture pack', 'locked validation protocol',
  'stressed portfolio sizing sheet', 'factor-exposure stress map', 'event-and-kill-state runbook',
  'deterministic broker simulator contract', 'order-state transition suite', 'uncertain-submit recovery test',
  'externally checkpointed decision ledger', 'restart-and-supersession drill report', 'terminal run envelope',
  'broker security and capability preflight', 'durable intent and deduplication record', 'broker reconciliation report',
  'decision-first desktop summary', 'missing-data impact component', 'action-owned alert policy',
  'AI side-effect boundary map', 'four-role review attestation', 'staged promotion dossier'
];

function addWeeks(localDate, weeks) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + weeks * 7)).toISOString().slice(0, 10);
}

function localDateAtUtc(localDate, localTime, timeZone) {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const rendered = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    guess += target - rendered;
  }
  return new Date(guess);
}

function episodeBody(module, episode, moduleEpisode, globalEpisode, previousArtifact, nextTitle) {
  const sourceLines = sources[episode.source].map(([label, url]) => `[${label}](${url})`).join('; ');
  const article = /^[aeiou]/i.test(episode.artifact) ? 'an' : 'a';
  return `*Part ${moduleEpisode} of 3 in ${module.title}. Lesson ${globalEpisode} of 45 in Build a Retail Systematic Desk, Safely.*

${episode.lesson}

**Input from last Friday:** ${previousArtifact ? `The accepted ${previousArtifact}.` : 'A blank repository and a named human owner.'}

**Friday deliverable:** ${article[0].toUpperCase()}${article.slice(1)} ${episode.artifact}, owned by the desk operator and retained in the review bundle.

## Build this

${episode.build}

### Minimum record

${episode.contract.map(item => `- \`${item}\``).join('\n')}

## Test it before moving on

${episode.verify}

**Operating limit:** The ${episode.artifact} is a public, paper-only engineering exercise with no production parameter, portfolio allocation or account detail; it is not a profitable strategy.

**Further reading for the ${episode.artifact} (context, not implementation evidence):** ${sourceLines}

Educational, not investment advice.

## Release decision

**GO:** Accept the ${episode.artifact} only when the test above passes and its retained output matches the minimum record.

**NO-GO:** ${episode.stop}

**Next Friday:** ${nextTitle ? `Carry the accepted ${episode.artifact} into ${nextTitle}.` : 'Keep the completed dossier in paper mode; any live promotion remains a separate human decision.'}`;
}

fs.mkdirSync(programRoot, { recursive: true });
fs.mkdirSync(seriesRoot, { recursive: true });
fs.mkdirSync(draftsRoot, { recursive: true });

const schedule = {
  start_local_date: '2026-09-04', weekday: 'Friday', local_time: '08:00',
  timezone: 'America/New_York', frequency: 'weekly', post_audience: 'everyone',
  send_email: false, email_audience: null
};
const flat = modules.flatMap(module => module.episodes.map((episode, index) => ({ module, episode, moduleEpisode: index + 1 })));
if (flat.length !== 45) throw new Error(`expected 45 episodes, found ${flat.length}`);
flat.forEach((item, index) => { item.episode.artifact = weeklyArtifacts[index]; });

const slots = flat.map((item, index) => {
  const number = index + 1;
  const localDate = addWeeks(schedule.start_local_date, index);
  const scheduledAt = localDateAtUtc(localDate, schedule.local_time, schedule.timezone).toISOString();
  const file = `episode-${String(number).padStart(2, '0')}.md`;
  const body = episodeBody(item.module, item.episode, item.moduleEpisode, number, flat[index - 1]?.episode.artifact, flat[index + 1]?.episode.title);
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(item.episode.title)}`,
    `subtitle: ${JSON.stringify(item.episode.subtitle)}`,
    'series_id: "retail-systematic-desk"',
    `module_id: ${JSON.stringify(item.module.id)}`,
    `module_title: ${JSON.stringify(item.module.title)}`,
    `module_episode: ${item.moduleEpisode}`,
    `episode_number: ${number}`,
    `scheduled_at: ${JSON.stringify(scheduledAt)}`,
    'send_email: false',
    '---', '', body, ''
  ].join('\n');
  fs.writeFileSync(path.join(seriesRoot, file), frontMatter);
  const payload = {
    title: item.episode.title,
    subtitle: item.episode.subtitle,
    body_markdown: body,
    audience: 'everyone',
    section_id: 417759,
    scheduled_at: scheduledAt,
    post_audience: 'everyone',
    send_email: false,
    email_audience: null,
    release_status: 'held_for_review',
    tags: ['Systematic Trading', 'Trading Systems', 'Risk Management']
  };
  fs.writeFileSync(path.join(draftsRoot, `week-${String(number).padStart(3, '0')}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  return {
    week: number,
    local_date: localDate,
    scheduled_at: scheduledAt,
    timezone: schedule.timezone,
    local_time: schedule.local_time,
    post_audience: 'everyone',
    send_email: false,
    email_audience: null,
    module_id: item.module.id,
    module_title: item.module.title,
    module_episode: item.moduleEpisode,
    module_episode_count: 3,
    title: item.episode.title,
    subtitle: item.episode.subtitle,
    target_file: `data/substack/series/retail-systematic-desk/${file}`,
    payload_file: `data/substack-drafts/retail-systematic-desk/week-${String(number).padStart(3, '0')}.json`,
    remote_status: 'held_for_review'
  };
});

const program = {
  schema_version: 'substack-program.v1',
  program_id: 'retail-systematic-desk',
  title: 'Build a Retail Systematic Desk, Safely',
  created_at: createdAt,
  language: 'en',
  section: { id: 417759, name: 'Analyses' },
  schedule,
  quality_contract: {
    min_words: 240,
    max_words: 500,
    self_contained: true,
    owned_website_references_forbidden: true,
    authoritative_citations_allowed: true,
    current_market_recommendations_forbidden: true,
    proprietary_strategy_details_forbidden: true,
    required_reviews: ['Senior QA', 'Contrarian', 'Retail War Room', 'AI Forensics']
  },
  confidentiality_contract: {
    public: ['architecture', 'contracts', 'state machines', 'tests', 'failure modes', 'generic pseudocode', 'retail UX'],
    forbidden: ['production universes', 'strategy names', 'filters', 'thresholds', 'ranking weights', 'deployed configurations', 'performance overlays', 'account details', 'live endpoints']
  },
  remote_contract: {
    receipts_path: 'data/substack/programs/retail-systematic-desk/remote-receipts.json',
    section_id: 417759,
    require_draft_validation: true,
    require_schedule_readback: true,
    send_email: false,
    email_audience: null
  },
  modules: modules.map(module => ({ id: module.id, title: module.title, expected_episodes: 3 })),
  episode_count: 45
};
const calendar = {
  schema_version: 'substack-program-calendar.v1',
  program_id: program.program_id,
  generated_at: createdAt,
  starts_at: slots[0].scheduled_at,
  ends_at: slots.at(-1).scheduled_at,
  episode_count: slots.length,
  slots
};
const manifest = {
  schema_version: 'substack-series.v1',
  series_id: program.program_id,
  title: program.title,
  channel: 'substack',
  language: 'en',
  section: program.section,
  delivery: { post_audience: 'everyone', send_email: false, email_audience: null },
  cadence: schedule,
  episodes: slots.map(slot => ({
    number: slot.week,
    file: path.basename(slot.target_file),
    title: slot.title,
    subtitle: slot.subtitle,
    scheduled_at: slot.scheduled_at,
    module_id: slot.module_id,
    module_episode: slot.module_episode
  })),
  rollout: { phase: 'held-for-review', authorized_episode_count: 0, held_as_drafts: slots.map(slot => slot.week) },
  publication_contract: program.quality_contract
};
const draftIndex = {
  schema_version: 'substack-draft-index.v1',
  program_id: program.program_id,
  count: slots.length,
  drafts: slots.map(slot => ({
    week: slot.week,
    payload_file: slot.payload_file,
    scheduled_at: slot.scheduled_at,
    post_audience: slot.post_audience,
    send_email: false,
    email_audience: null
  }))
};
const receipts = {
  schema_version: 'substack-remote-receipts.v1',
  program_id: program.program_id,
  section_id: 417759,
  send_email: false,
  email_audience: null,
  review_snapshot_sha256: null,
  episodes: [],
  summary: { total: 45, validated: 0, schedule_verified: 0 }
};

fs.writeFileSync(path.join(programRoot, 'program.json'), `${JSON.stringify(program, null, 2)}\n`);
fs.writeFileSync(path.join(programRoot, 'calendar.json'), `${JSON.stringify(calendar, null, 2)}\n`);
const receiptPath = path.join(programRoot, 'remote-receipts.json');
if (!fs.existsSync(receiptPath)) fs.writeFileSync(receiptPath, `${JSON.stringify(receipts, null, 2)}\n`);
fs.writeFileSync(path.join(seriesRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(draftsRoot, 'index.json'), `${JSON.stringify(draftIndex, null, 2)}\n`);
console.log(`Built ${slots.length} Friday episodes from ${calendar.starts_at} to ${calendar.ends_at}`);
