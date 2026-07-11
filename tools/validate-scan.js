#!/usr/bin/env node
'use strict';

/**
 * validate-scan.js — pre-publish gate for scanner output
 *
 * Reads data/scanner-filters.json (hard rules) and asserts a scanner's
 * signals.json complies. Exits non-zero on violation. Wired into
 * publish-daily-card.sh BEFORE add_card.js so a non-compliant scan
 * never ships.
 *
 * Usage:
 *   node tools/validate-scan.js scanner/YYYYMMDD/
 *   node tools/validate-scan.js scanner/YYYYMMDD/signals.json
 *   node tools/validate-scan.js scanner/YYYYMMDD/index.html  (HTML fallback via parser)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/scanner-parser');
const { recentDilutionFilings } = require('./pre-scan-filter');

const ROOT = path.join(__dirname, '..');
const FILTERS_FILE = path.join(ROOT, 'data', 'scanner-filters.json');

function loadFilters() {
  return JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf8'));
}

function loadScanSignals(arg) {
  // arg can be: scanner/YYYYMMDD/, scanner/YYYYMMDD/signals.json, scanner/YYYYMMDD/index.html
  const abs = path.resolve(ROOT, arg);
  // Path traversal guard — reject anything that escapes ROOT
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (!abs.startsWith(rootWithSep) && abs !== ROOT) {
    throw new Error(`Path traversal detected: ${arg} resolves outside ${ROOT}`);
  }
  let dir = abs;
  if (fs.statSync(abs).isFile()) dir = path.dirname(abs);

  const dirName = path.basename(dir);
  const loaded = parser.loadSignals(dirName);
  if (!loaded || !loaded.signals.length) {
    throw new Error(`No signals found in ${dir}`);
  }
  // Les règles éditoriales (score ≤100, dilution, stops, diversification, scan_size…)
  // gatent le scan ÉDITORIAL. Les émissions des scanners spécialistes suivent leurs
  // propres règles (parité Go 5y : scores hors échelle par construction, stops ATR,
  // pas de screening SEC) — les inclure produit ~200 faux positifs dès que
  // validate-scan tourne APRÈS l'append nocturne (Steps 2c-2n). Les règles 17/18
  // (multi-pool, enum stratégie) lisent le fichier RAW et couvrent tout le monde.
  // Candlestick est aussi exclu de l'éditorial (stops pattern larges + small caps by design,
  // parité AB) : sa règle dédiée (15) lit le fichier RAW ci-dessous.
  const SPECIALIST_STRATEGIES = new Set(['highvolbreakout', 'etfmomentum', 'momentumrotation', 'trendlinebreakout', 'adaptivefractal', 'cryptomomentum', 'metalsmomentum', 'forexmultistrategy', 'fortressa', 'hybridmegacap', 'candlestick', 'indexrotation', 'factorcomposite']);
  const isSpecialist = s => SPECIALIST_STRATEGIES.has(String(s.strategy || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const editorial = loaded.signals.filter(s => !isSpecialist(s));
  const specialistCount = loaded.signals.length - editorial.length;
  if (specialistCount > 0) console.log(`[validate-scan] ${specialistCount} signaux spécialistes exclus des règles éditoriales (règles 17/18 = fichier raw, toujours globales)`);
  return { dir, dirName, signals: editorial, tklPool: loaded.tklPool || [], regime: loaded.regime || null, regimeScore: loaded.regimeScore ?? null };
}

// Raw signals.json (pre-merge, pre-dedup) — used by the pool-overlap / duplicate-ticker
// check below. scanner-parser.js:loadSignals() silently dedupes tickers when merging
// momentum/breakout/pullback/pre_squeeze/bull into `signals[]`, which is exactly the kind
// of orphan record we need to catch (see rule 17).
function loadRawSignalsJson(dir) {
  const jsonPath = path.join(dir, 'signals.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function loadOpenPositions() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json'), 'utf8'));
    return new Set((j.open_positions || []).map(p => String(p.ticker).toUpperCase()));
  } catch { return new Set(); }
}

function fail(violations) {
  console.error('\n❌ Scan validation FAILED — do NOT publish.\n');
  violations.forEach((v, i) => console.error(`  ${i + 1}. [${v.rule}] ${v.message}`));
  console.error(`\nTotal violations: ${violations.length}`);
  console.error('Fix scanner/YYYYMMDD/signals.json (or regenerate the scan), then re-run.\n');
  process.exit(1);
}

function ok(scanRef, signalCount) {
  console.log(`\n✅ Scan validation PASSED — ${signalCount} signals in ${scanRef}\n`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/validate-scan.js <scanner/YYYYMMDD/ or signals.json or index.html>');
    process.exit(2);
  }
  const skipEdgar = process.argv.includes('--skip-edgar');

  const filters = loadFilters();
  const { dir, dirName, signals, tklPool, regime, regimeScore } = loadScanSignals(arg);
  const openPositions = loadOpenPositions();

  const violations = [];
  const advisories = []; // advisories non-bloquants (déclaré tôt : utilisé par la règle 15 candlestick)
  const advisoriesFromEdgar = [];

  // 1. Scan size — éditorial uniquement : les signaux Candlestick sont appendés par
  // candlestick-scanner (mode bull), pas des picks éditoriaux — exclus du comptage.
  const editorialCount = signals.length; // candlestick + spécialistes déjà exclus au chargement
  const ss = filters.scan_size || {};
  // Design = top-N per strategy (momentum/breakout/pullback) + combined pool, up to max_total.
  // Legacy `exact` kept for backward-compat if a filter set still uses it.
  if (ss.exact != null && editorialCount !== ss.exact) {
    violations.push({
      rule: 'scan_size',
      message: `Expected exactly ${ss.exact} editorial signals, got ${editorialCount}.`
    });
  }
  if (ss.max_total != null && editorialCount > ss.max_total) {
    violations.push({
      rule: 'scan_size',
      message: `${editorialCount} editorial signals exceeds max_total ${ss.max_total}.`
    });
  }
  if (ss.max_per_strategy != null) {
    const byStrat = {};
    for (const s of signals) {
      const st = (s.strategy || '?').trim();
      byStrat[st] = (byStrat[st] || 0) + 1;
    }
    for (const [st, n] of Object.entries(byStrat)) {
      if (n > ss.max_per_strategy) {
        violations.push({
          rule: 'scan_size',
          message: `Strategy "${st}" has ${n} editorial signals (max ${ss.max_per_strategy} per strategy).`
        });
      }
    }
  }

  // 2. Regime label whitelist
  if (regime && filters.regime_labels?.allowed) {
    const r = String(regime).toUpperCase().trim();
    if (!filters.regime_labels.allowed.includes(r)) {
      violations.push({
        rule: 'regime_labels',
        message: `Regime "${regime}" not in allowed set: ${filters.regime_labels.allowed.join(', ')}`
      });
    }
  }

  // 2b. Regime score / label coherence (parachute) — DEUX ÉCHELLES dans l'archive :
  // scans <= juin 2026 = BULLISH 0-100 (65+ = RISK-ON) ; scans >= juillet 2026 =
  // DÉFENSIVITÉ 0-100 (0 = plein risk-on, convention MCP v5 facet regime).
  // Canon : défensivité + champ `regimeScoreScale` explicite dans signals.json.
  // Heuristique legacy (champ absent) : label bullish + score < 35 => défensivité ;
  // score >= 35 => bullish ; sinon ambigu => skip (pas de faux positif).
  if (regimeScore != null && regime) {
    const RANK = { 'RISK-OFF': 0, 'EARLY RISK-OFF': 1, 'NEUTRAL': 2, 'RECOVERY': 3, 'RISK-ON': 4 };
    const labelRank = RANK[String(regime).toUpperCase().trim()] ?? 2;
    const declaredScale = (loadRawSignalsJson(dir) || {}).regimeScoreScale || null;
    const scale = declaredScale
      || (labelRank >= 3 && regimeScore < 35 ? 'defensiveness'
        : regimeScore >= 35 ? 'bullish' : null);
    if (scale) {
      const bullishScore = scale === 'defensiveness' ? 100 - regimeScore : regimeScore;
      const scoreRegime = bullishScore >= 65 ? 'RISK-ON'
        : bullishScore >= 55 ? 'RECOVERY'
        : bullishScore >= 45 ? 'NEUTRAL'
        : bullishScore >= 38 ? 'EARLY RISK-OFF'
        : 'RISK-OFF';
      const scoreRank = RANK[scoreRegime] ?? 2;
      if (labelRank > scoreRank) {
        violations.push({
          rule: 'regime_score_coherence',
          message: `Regime label "${regime}" is more bullish than score ${regimeScore} (échelle ${scale}) implies (-> ${scoreRegime}). Use the more defensive label or justify the override.`
        });
      }
    }
  }

  // 3. Strategy whitelist + blacklist
  const allowedStrats = new Set(filters.strategies?.allowed || []);
  const forbiddenStrats = new Set(filters.strategies?.forbidden || []);
  for (const s of signals) {
    const strat = (s.strategy || '').trim();
    if (!strat) continue;
    if (forbiddenStrats.has(strat)) {
      violations.push({
        rule: 'strategies.forbidden',
        message: `${s.ticker}: strategy "${strat}" is forbidden (use Momentum/Pre-Squeeze/Breakout/Pullback).`
      });
    } else if (allowedStrats.size > 0 && !allowedStrats.has(strat)) {
      violations.push({
        rule: 'strategies.allowed',
        message: `${s.ticker}: strategy "${strat}" not in whitelist [${[...allowedStrats].join(', ')}].`
      });
    }
  }

  // 4. Anti-duplicate vs open positions
  if (filters.anti_duplicate?.behavior === 'disqualify') {
    for (const s of signals) {
      const t = String(s.ticker).toUpperCase();
      if (openPositions.has(t)) {
        violations.push({
          rule: 'anti_duplicate',
          message: `${s.ticker}: already in open_positions — never enter a 2nd position on the same ticker.`
        });
      }
    }
  }

  // 5. Stops sanity (min/max pct from entry)
  if (filters.stops) {
    const minPct = filters.stops.min_pct_from_entry;
    const maxPct = filters.stops.max_pct_from_entry;
    for (const s of signals) {
      if (typeof s.entry !== 'number' || typeof s.stop !== 'number') continue;
      const pct = Math.abs((s.entry - s.stop) / s.entry) * 100;
      const pctR = Math.round(pct * 100) / 100; // compare at 2-dp display precision: 2.998% shows as 3.00%, not a real sub-floor breach
      if (minPct != null && pctR < minPct) {
        violations.push({
          rule: 'stops.min_pct',
          message: `${s.ticker}: stop only ${pct.toFixed(2)}% from entry (min ${minPct}%) — too tight, will trigger intraday.`
        });
      }
      if (maxPct != null && pctR > maxPct) {
        violations.push({
          rule: 'stops.max_pct',
          message: `${s.ticker}: stop ${pct.toFixed(2)}% from entry (max ${maxPct}%) — too loose, breaks R/R math.`
        });
      }
    }
  }

  // 6. Risk overlay — sector concentration cap (max_per_sector)
  if (filters.diversification?.max_per_sector) {
    // SECTOR_MAP now lives in scanner-filters.json (source of truth). Fallback to empty map.
    const SECTOR_MAP = filters.diversification.sector_map || {};
    const sectorCount = {};
    for (const s of signals) {
      const sect = SECTOR_MAP[String(s.ticker).toUpperCase()] || 'Other';
      sectorCount[sect] = (sectorCount[sect] || 0) + 1;
    }
    const cap = filters.diversification.max_per_sector;
    // ADVISORY (not a hard gate): the cap describes the *published* curated selection
    // ("no 3 techs in one week"), but this validator sees the raw candidate pool (up to
    // max_total). Enforcing it hard on the pool false-flags normal candidate spread — same
    // class of issue as the old scan_size:exact rule. Kept advisory, consistent with the
    // region floors (min_us/min_eu…), so it still surfaces at curation time without blocking.
    for (const [sect, n] of Object.entries(sectorCount)) {
      if (n > cap) {
        advisories.push(`Sector "${sect}" has ${n} editorial candidates (soft cap ${cap})${sect === 'Other' ? ' — add to sector_map if this is a real sector' : ''} — curate the published top-N to avoid same-week concentration [sector_concentration]`);
      }
    }
  }

  // 7. Sharia ETF tag honesty (don't block — ensure tag matches blocklist)
  const blockedEtfs = new Set(filters.sharia?.blocked_etf_examples || []);
  for (const s of signals) {
    if (blockedEtfs.has(String(s.ticker).toUpperCase()) && s.sharia === true) {
      violations.push({
        rule: 'sharia.blocked_etf',
        message: `${s.ticker}: marked sharia=true but is in blocked_etf_examples (bond/leveraged/inverse ETF).`
      });
    }
  }

  // ── TKL POOL HARD CHECKS ──────────────────────────────────────────────────
  // TKL pool gets the same strategy + stops checks as top 10.
  for (const s of tklPool) {
    const strat = (s.strategy || '').trim();
    if (strat && forbiddenStrats.has(strat)) {
      violations.push({
        rule: 'tkl.strategies.forbidden',
        message: `TKL ${s.ticker}: strategy "${strat}" is forbidden.`
      });
    }
    if (typeof s.entry === 'number' && typeof s.stop === 'number' && filters.stops) {
      const pct = Math.abs((s.entry - s.stop) / s.entry) * 100;
      if (filters.stops.min_pct_from_entry != null && pct < filters.stops.min_pct_from_entry) {
        violations.push({
          rule: 'tkl.stops.min_pct',
          message: `TKL ${s.ticker}: stop ${pct.toFixed(2)}% from entry (min ${filters.stops.min_pct_from_entry}%).`
        });
      }
    }
    if (openPositions.has(String(s.ticker).toUpperCase())) {
      violations.push({
        rule: 'tkl.anti_duplicate',
        message: `TKL ${s.ticker}: already in open_positions.`
      });
    }
  }

  // ── SEC EDGAR DILUTION CHECK (TKL pool — hard block) ─────────────────────
  // MCP flags don't surface 424B5/S-3 as dilution signals. Cross-reference
  // SEC EDGAR directly for recent prospectus supplements on all TKL tickers.
  // Top 10 checked as advisory (Claude already ran MCP anti-dilution v2).
  if (!skipEdgar && (tklPool.length > 0 || signals.length > 0)) {
    console.log('  Checking SEC EDGAR for recent dilution filings...');
    const allTickers = [
      ...tklPool.map(s => ({ ticker: s.ticker, pool: 'tkl' })),
      ...signals.map(s => ({ ticker: s.ticker, pool: 'top10' })),
    ];
    for (const { ticker, pool } of allTickers) {
      try {
        const edgar = await recentDilutionFilings(ticker, filters);
        if (edgar.hits.length > 0) {
          const detail = edgar.hits.map(h => `${h.form} (${h.ageDays}d ago)`).join(', ');
          if (pool === 'tkl') {
            violations.push({
              rule: 'tkl.edgar_dilution',
              message: `TKL ${ticker}: recent SEC dilution filings — ${detail}. Remove from tkl_pool.`
            });
          } else {
            // Top 10 = advisory (Claude did MCP check; EDGAR is a safety net)
            advisoriesFromEdgar.push(`${ticker}: SEC EDGAR found ${detail} — verify dilution_clear [edgar_dilution]`);
          }
        }
      } catch { /* SEC EDGAR down — non-fatal, skip */ }
    }
  } else if (skipEdgar) {
    console.log('  Skipping SEC EDGAR dilution check (--skip-edgar).');
  }

  // ── HARD BLOCKS from scanner-lessons.json v2.0 ─────────────────────────────

  // 8. R/R minimum by regime (HARD BLOCK — promoted from advisory 2026-06-30)
  const RR_MIN_BY_REGIME = {
    'RISK-ON': 1.5, 'RECOVERY': 1.5, 'NEUTRAL': 1.5,
    'EARLY RISK-OFF': 2.0, 'RISK-OFF': 2.0
  };
  // Scope: stratégies ÉDITORIALES uniquement. Pour les spécialistes (HighVolBreakout,
  // ETFMomentum, MomentumRotation, TrendlineBreakout, AdaptiveFractal, Candlestick),
  // tp1 = déclencheur de prise PARTIELLE (partialTPGain) — le payoff réel inclut le
  // runner + trailing ; Go n'applique aucun gate R/R à ces stratégies (parité 5y).
  const RR_GATE_STRATEGIES = new Set(['momentum', 'breakout', 'pullback', 'pre-squeeze', 'presqueeze', 'pre_squeeze', 'hybridmegacap', 'hybrid_megacap']);
  if (regime) {
    const rrMin = RR_MIN_BY_REGIME[String(regime).toUpperCase().trim()] || 1.5;
    for (const s of signals) {
      const stratKey = String(s.strategy || '').toLowerCase().replace(/[\s-]/g, '');
      if (stratKey && !RR_GATE_STRATEGIES.has(stratKey)) continue;
      if (!s.rr) continue;
      const m = String(s.rr).match(/1:(\d+\.?\d*)/);
      if (!m) continue;
      const ratio = parseFloat(m[1]);
      if (ratio < rrMin) {
        violations.push({
          rule: 'rr_min_by_regime',
          message: `${s.ticker}: R/R 1:${ratio} < regime min 1:${rrMin} (${regime}) — hard block per scanner-lessons v2.0.`
        });
      }
    }
  }

  // 9. R/R uniformity check — if >60% signals have identical R:R string, scoring pipeline is broken
  {
    const rrCounts = {};
    for (const s of signals) {
      const rr = String(s.rr || '');
      rrCounts[rr] = (rrCounts[rr] || 0) + 1;
    }
    for (const [rr, count] of Object.entries(rrCounts)) {
      if (count > signals.length * 0.6 && signals.length >= 5) {
        violations.push({
          rule: 'rr_uniformity',
          message: `${count}/${signals.length} signals have identical R/R "${rr}" — scoring pipeline is reverse-engineering TP from fixed R:R instead of computing from technical levels.`
        });
      }
    }
  }

  // 10. Score ceiling check — no signal score should exceed 98 (perfect scores are unrealistic)
  for (const s of signals) {
    if (typeof s.score !== 'number') continue;
    if (s.score > 98) {
      violations.push({
        rule: 'score_ceiling',
        message: `${s.ticker}: score ${s.score} > 98 — perfect scores indicate a scoring ceiling bug. Max realistic score is 98.`
      });
    }
  }

  // 11. Score distribution check — if >50% signals have score >= 95, scoring is inflated
  {
    const highScoreCount = signals.filter(s => typeof s.score === 'number' && s.score >= 95).length;
    if (highScoreCount > signals.length * 0.5 && signals.length >= 5) {
      violations.push({
        rule: 'score_inflation',
        message: `${highScoreCount}/${signals.length} signals have score >= 95 — score inflation. In EARLY RISK-OFF, most signals should score 75-90.`
      });
    }
  }

  // 12. Market cap minimum for top 10 — reject penny stocks
  if (filters.tickers?.min_market_cap_usd) {
    const minMcap = filters.tickers.min_market_cap_usd;
    for (const s of signals) {
      if (typeof s.entry === 'number' && s.entry < 5) {
        violations.push({
          rule: 'penny_stock',
          message: `${s.ticker}: entry price $${s.entry} < $5 — penny stock territory. Minimum market cap $${(minMcap/1e6).toFixed(0)}M required.`
        });
      }
    }
  }

  // 13. Pullback regime gate — max 1 Pullback in ERO, blocked below 60% confidence
  if (regime && String(regime).toUpperCase().includes('EARLY RISK-OFF')) {
    const pullbacks = signals.filter(s => s.strategy === 'Pullback');
    if (pullbacks.length > 1) {
      violations.push({
        rule: 'pullback_regime_gate',
        message: `${pullbacks.length} Pullback signals in EARLY RISK-OFF (max 1). Pullback is blocked when regime confidence < 60%. Tickers: ${pullbacks.map(s => s.ticker).join(', ')}.`
      });
    }
  }

  // 14. Strategy cap per regime — Breakout blocked in ERO, Momentum capped
  if (regime && String(regime).toUpperCase().includes('EARLY RISK-OFF')) {
    const breakouts = signals.filter(s => s.strategy === 'Breakout');
    for (const s of breakouts) {
      violations.push({
        rule: 'breakout_ero_block',
        message: `${s.ticker}: Breakout in EARLY RISK-OFF — hard block per 3+ consecutive retro failures.`
      });
    }
    const momentums = signals.filter(s => s.strategy === 'Momentum');
    if (momentums.length > 4) {
      violations.push({
        rule: 'momentum_ero_cap',
        message: `${momentums.length} Momentum signals in ERO (max 4). Score < 50 for 2+ sessions triggers Momentum cap at 20%.`
      });
    }
  }

  // 15. Candlestick — règles dédiées (lues depuis le RAW : exclu de l'éditorial)
  const rawForCandle = loadRawSignalsJson(dir);
  const candleSignals = ((rawForCandle && rawForCandle.signals) || []).filter(x => (x.strategy || '') === 'Candlestick');
  for (const s of candleSignals) {
    if (s.strategy === 'Candlestick') {
      if (typeof s.entry === 'number' && typeof s.stop === 'number') {
        const stopPct = Math.abs((s.entry - s.stop) / s.entry) * 100;
        if (stopPct > 8) {
          // Advisory (pas hard block) : le stop bull = pattern + ATR (parité Go
          // americanbulls, base_stop_atr 1.5 + safety 3.0) et peut légitimement
          // dépasser 8% sur les noms volatils — la règle 8% vient de l'ère bull-pool LLM.
          advisories.push(`${s.ticker}: Candlestick stop ${stopPct.toFixed(1)}% from entry (>8%) — vérifier vs parité AB [candlestick_stop_max]`);
        }
      }
      if (!s.sector) {
        violations.push({
          rule: 'candlestick_missing_sector',
          message: `${s.ticker}: Candlestick signal missing sector — incomplete MCP enrichment.`
        });
      }
      if (s.sharia == null) {
        violations.push({
          rule: 'candlestick_missing_sharia',
          message: `${s.ticker}: Candlestick signal missing Sharia tag — must be true or false, never null.`
        });
      }
    }
  }

  // 16. entry-price-spot-validation — catches stale cache/pre-split prices
  for (const s of signals) {
    if (typeof s.entry !== 'number' || typeof s.extension?.atr !== 'number') continue;
    // Use last close from extension or fallback to entry (can't check without spot)
    // This rule is primarily enforced at Phase 2 with live MCP spot data.
    // validate-scan.js checks TP1 > entry > stop ordering as a proxy.
    if (s.tp1 && s.entry >= s.tp1) {
      violations.push({
        rule: 'entry_price_validation',
        message: `${s.ticker}: entry ${s.entry} >= TP1 ${s.tp1} — nonsensical setup (entry-price-spot-validation).`
      });
    }
    if (s.stop && s.entry <= s.stop) {
      violations.push({
        rule: 'entry_price_validation',
        message: `${s.ticker}: entry ${s.entry} <= stop ${s.stop} — inverted setup.`
      });
    }
  }

  // 9. degenerate-band-rejection (hard_block) — entry-stop band < 0.5× ATR
  for (const s of signals) {
    if (typeof s.entry !== 'number' || typeof s.stop !== 'number' || typeof s.extension?.atr !== 'number') continue;
    if (s.extension.atr <= 0) continue;
    const band = Math.abs(s.entry - s.stop);
    const atrMult = band / s.extension.atr;
    if (atrMult < 0.5) {
      violations.push({
        rule: 'degenerate_band',
        message: `${s.ticker}: entry-stop band ${band.toFixed(2)} = ${atrMult.toFixed(2)}× ATR (min 0.5×) — degenerate setup guaranteed to stop out.`
      });
    }
  }

  // 17. ticker-multi-pool / duplicate-in-signals (hard_block) — scanner/CLAUDE.md:
  // "Un ticker peut apparaître dans 1 pool + le composite, mais jamais dans 2 pools
  // différents". Checked on the RAW signals.json (before scanner-parser.js merges +
  // silently dedupes momentum/breakout/pullback/pre_squeeze/bull into `signals[]`) —
  // the silent dedup is exactly what hid the orphan-record bug this rule catches.
  {
    const raw = loadRawSignalsJson(dir);
    if (raw) {
      const STRATEGY_POOL_KEYS = ['momentum', 'breakout', 'pullback', 'pre_squeeze', 'bull'];
      const poolsByTicker = {};
      for (const key of STRATEGY_POOL_KEYS) {
        for (const s of raw[key] || []) {
          const t = String(s.ticker || '').toUpperCase();
          if (!t) continue;
          (poolsByTicker[t] = poolsByTicker[t] || []).push(key);
        }
      }
      for (const [ticker, pools] of Object.entries(poolsByTicker)) {
        const uniquePools = [...new Set(pools)];
        if (uniquePools.length > 1) {
          violations.push({
            rule: 'ticker_multi_pool',
            message: `${ticker}: present in ${uniquePools.length} strategy pools [${uniquePools.join(', ')}] — a ticker may live in at most 1 pool (+ the composite), never 2+ different pools.`
          });
        }
      }

      // Scope to EDITORIAL (composite top-10) signals only. Specialist scanner pools
      // (stockbox/highvol/etf/momentum/fractal/...) legitimately emit the same ticker
      // across independent modes — "même ticker dans plusieurs modes = confirmation".
      const SPECIALIST_NORM = new Set(['highvolbreakout', 'etfmomentum', 'momentumrotation', 'trendlinebreakout', 'adaptivefractal', 'cryptomomentum', 'metalsmomentum', 'forexmultistrategy', 'fortressa', 'hybridmegacap', 'candlestick', 'indexrotation']);
      const _isSpec = s => SPECIALIST_NORM.has(String(s.strategy || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
      const signalsTickerCounts = {};
      for (const s of raw.signals || []) {
        if (_isSpec(s)) continue;
        const t = String(s.ticker || '').toUpperCase();
        if (!t) continue;
        signalsTickerCounts[t] = (signalsTickerCounts[t] || 0) + 1;
      }
      const dupedInSignals = Object.entries(signalsTickerCounts).filter(([, n]) => n > 1).map(([t]) => t);
      if (dupedInSignals.length) {
        violations.push({
          rule: 'ticker_duplicate_in_signals',
          message: `Ticker(s) duplicated within signals[]: ${dupedInSignals.join(', ')} — each ticker must appear at most once in the composite top 10.`
        });
      }
    }
  }

  // 18. strategy-enum-whitelist (hard_block) — a signal's strategy label must be one of
  // the real, code-emitted strategy names. Catches typos / invented labels that slip
  // past rule 3 when strategies.allowed is left empty, and catches missing/empty
  // strategy fields (leçon TECH orphan score 152 — an unlabeled orphan record with an
  // impossible score went unnoticed because rule 3 skips falsy strategy values).
  const KNOWN_STRATEGY_ENUM = new Set([
    'Momentum', 'Breakout', 'Pullback',
    'Pre-Squeeze', 'PreSqueeze', 'pre_squeeze',
    'Candlestick', 'candlestick',
    'AdaptiveFractal', 'adaptive-fractal', 'adaptive_fractal',
    'MomentumRotation', 'momentum-rotation', 'momentum_rotation',
    'HighVolBreakout', 'highvol-breakout', 'highvol_breakout',
    'TrendlineBreakout', 'trendline-breakout', 'trendline_breakout',
    'ETFMomentum', 'etf-momentum', 'etf_momentum',
    'HybridMegaCap', 'HybridMegacap', 'Hybrid-MegaCap', 'Hybrid-AF', 'Hybrid-DSL', 'megacap', 'hybrid_megacap',
    'FortressA+',
    'CryptoMomentum', 'MetalsMomentum', 'ForexMultiStrategy',
    'IndexRotation', 'index-rotation', 'index_rotation',
  ]);
  for (const s of signals) {
    const strat = (s.strategy || '').trim();
    if (!KNOWN_STRATEGY_ENUM.has(strat)) {
      violations.push({
        rule: 'strategy_enum_whitelist',
        message: `${s.ticker}: strategy "${strat || '(empty)'}" is outside the known strategy enum — invented/typo'd label or missing strategy field.`
      });
    }
  }

  // ── ADVISORY CHECKS (warnings only, do NOT block publish) ─────────────────
  // Lessons from scanner-lessons.json v2.0 are SELECTION-TIME inputs at /scanner Phase 2.
  // validate-scan.js blocks hard errors above; advisory deviations are surfaced below
  // so Claude can iterate — but a passing scan with warnings still publishes.

  // 10. tp1-horizon-calibration — TP1 too far for horizon
  for (const s of signals) {
    if (typeof s.entry !== 'number' || typeof s.stop !== 'number' || typeof s.tp1 !== 'number') continue;
    const risk = Math.abs(s.entry - s.stop);
    if (risk <= 0) continue;
    const reward = Math.abs(s.tp1 - s.entry);
    const rMultiple = reward / risk;
    const horizon = s.horizon || 10;
    const maxR = horizon <= 10 ? 1.5 : 2.0;
    if (rMultiple > maxR + 0.1) {
      advisories.push(`${s.ticker}: TP1 at ${rMultiple.toFixed(1)}R > max ${maxR}R for H${horizon} [tp1_horizon_calibration]`);
    }
  }

  // 11. high-score-low-rsi-conflict — score >= 93 AND RSI < 55 = value trap
  for (const s of signals) {
    if (typeof s.score !== 'number' || typeof s.extension?.rsi !== 'number') continue;
    if (s.score >= 93 && s.extension.rsi < 55) {
      advisories.push(`${s.ticker}: score ${s.score} + RSI ${s.extension.rsi.toFixed(1)} < 55 — value trap pattern (0 winners/2 losers) [high_score_low_rsi]`);
    }
  }

  // 12. rsi-no-mans-land-momentum — Momentum + RSI 40-50 = no edge
  for (const s of signals) {
    if (s.strategy !== 'Momentum' || typeof s.extension?.rsi !== 'number') continue;
    if (s.extension.rsi >= 40 && s.extension.rsi <= 50) {
      advisories.push(`${s.ticker}: Momentum with RSI ${s.extension.rsi.toFixed(1)} in 40-50 no-man's-land — 7:1 loser ratio [rsi_no_mans_land]`);
    }
  }

  // Breakout in ERO — now a hard block (check 14 above), removed from advisory

  // 14. overextension — distance 50-DMA > 20% for Momentum/Breakout
  for (const s of signals) {
    if (typeof s.extension?.distance_50dma_pct !== 'number') continue;
    if (s.extension.distance_50dma_pct > 20 && ['Momentum', 'Breakout'].includes(s.strategy)) {
      advisories.push(`${s.ticker}: ${s.extension.distance_50dma_pct.toFixed(1)}% above 50-DMA — overextended for ${s.strategy} [limit_high_beta_ai_infra]`);
    }
  }

  // R/R minimum by regime — now a hard block (check 8 above), removed from advisory

  // Stop ATR multiple (advisory)
  if (filters.stops?.min_atr_multiple) {
    const minMult = filters.stops.min_atr_multiple;
    for (const s of signals) {
      if (typeof s.extension?.atr !== 'number' || !s.entry || !s.stop || s.extension.atr <= 0) continue;
      const r = Math.abs(s.entry - s.stop) / s.extension.atr;
      if (r < minMult) advisories.push(`${s.ticker}: stop ${r.toFixed(2)}× ATR (recommend ≥${minMult}×) [stops_atr_multiple]`);
    }
  }

  // RSI overextension (advisory)
  const maxRsi = filters.overextension?.max_rsi14_daily;
  if (maxRsi) for (const s of signals) {
    if (typeof s.extension?.rsi === 'number' && s.extension.rsi > maxRsi)
      advisories.push(`${s.ticker}: RSI ${s.extension.rsi.toFixed(1)} > ${maxRsi} (parabolic risk) [overextension_rsi]`);
  }

  // Distance 50-DMA by strategy (advisory)
  const maxByStrat = filters.overextension?.max_distance_50dma_pct_by_strategy;
  if (maxByStrat) for (const s of signals) {
    if (typeof s.extension?.distance_50dma_pct !== 'number') continue;
    const cap = maxByStrat[s.strategy]; if (cap == null) continue;
    if (s.extension.distance_50dma_pct > cap)
      advisories.push(`${s.ticker}: ${s.extension.distance_50dma_pct.toFixed(1)}% above 50-DMA > ${s.strategy} cap ${cap}% [overextension_50dma]`);
  }

  // Earnings + dilution flags (advisory — Claude's selection should set true; only flag if false)
  const allSignals = [...signals, ...tklPool];
  for (const s of allSignals) {
    const prefix = tklPool.includes(s) ? `TKL ${s.ticker}` : s.ticker;
    if (s.earnings_clear === false) advisories.push(`${prefix}: earnings_clear=false (±3d window) [earnings_window]`);
    if (s.dilution_clear === false) advisories.push(`${prefix}: dilution_clear=false [dilution_clear]`);
  }

  // Merge EDGAR-discovered advisories (top 10 only — TKL EDGAR hits are hard blocks above)
  advisories.push(...advisoriesFromEdgar);

  // Diversification floors (advisory — Claude's selection should hit these)
  if (filters.diversification) {
    const counts = { US: 0, EU: 0, APAC: 0, ETF: 0, Other: 0 };
    for (const s of signals) {
      const r = String(s.region || '').toUpperCase().trim();
      if (r === 'US') counts.US++;
      else if (['EU', 'UK', 'FR', 'DE', 'IT', 'ES', 'NL', 'CH'].includes(r)) counts.EU++;
      else if (['ASIA', 'APAC', 'CHINA', 'JAPAN', 'KOREA', 'HK', 'TW'].includes(r)) counts.APAC++;
      else if (r === 'ETF') counts.ETF++;
      else counts.Other++;
    }
    const floors = {
      US: filters.diversification.min_us_count,
      EU: filters.diversification.min_eu_count,
      APAC: filters.diversification.min_apac_count,
      ETF: filters.diversification.min_etf_count
    };
    for (const [region, floor] of Object.entries(floors)) {
      if (floor == null) continue;
      if (counts[region] < floor) advisories.push(`Region "${region}" has ${counts[region]} setups (recommend ≥${floor}) [diversification_floor]`);
    }
  }

  if (advisories.length) {
    console.warn(`\n⚠️  ${advisories.length} advisory note(s) from scanner-lessons.json (non-blocking — selection-time hints):`);
    advisories.forEach((a, i) => console.warn(`  ${i + 1}. ${a}`));
    console.warn('  → Claude should incorporate these at /scanner Phase 2 for the NEXT scan, not block this one.\n');
  }

  if (violations.length) fail(violations);
  ok(dirName, signals.length);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(2); });

module.exports = { loadFilters, loadScanSignals };
