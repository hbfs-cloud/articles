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
const crypto = require('crypto');
const parser = require('./lib/scanner-parser');
const { recentDilutionFilings } = require('./pre-scan-filter');
const { computeAllowedActions, boundDecision } = require('./lib/allowed-actions');
const scoreContract = require('./lib/score-contract');

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
  // Un scan RETIRÉ avant diffusion porte `_withdrawn` dans son signals.json et un tableau
  // `signals` vide : valider ses lignes éditoriales n'a pas de sens puisqu'il n'en publie
  // aucune. On le dit en clair plutôt que de laisser remonter une pile d'appels, qui donne
  // à un retrait délibéré l'apparence d'un plantage de l'outil.
  try {
    const rawSig = JSON.parse(fs.readFileSync(path.join(dir, 'signals.json'), 'utf8'));
    if (rawSig && rawSig._withdrawn && !(rawSig.signals || []).length) {
      console.log(`↩︎  ${dirName} : scan RETIRÉ avant diffusion le ${String(rawSig._withdrawn.at || '').slice(0, 10)} — aucune ligne éditoriale à valider.`);
      console.log(`   motif : ${rawSig._withdrawn.reason || '(non précisé)'}`);
      process.exit(0);
    }
  } catch { /* pas de signals.json lisible : on laisse le chemin d'erreur normal opérer */ }

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

function loadOpenPositions(scanDateIso) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-positions.json'), 'utf8'));
    return new Set((j.open_positions || [])
      // Positions created by this same scan are tracking output, not pre-existing
      // exposure. Unknown dates remain fail-closed and are treated as prior positions.
      .filter(p => !p.scan_date || !scanDateIso || String(p.scan_date) < scanDateIso)
      .map(p => String(p.ticker).toUpperCase()));
  } catch { return new Set(); }
}

function loadStrategyOverlay(sourceFile) {
  try {
    return JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  } catch {
    return null;
  }
}

function validateHashBoundArtifact(evidence, ticker, label) {
  const errors = [];
  const rel = evidence && evidence.source_artifact;
  const expectedHash = evidence && evidence.source_sha256;
  if (!rel || typeof rel !== 'string' || path.isAbsolute(rel) || !/^[a-f0-9]{64}$/.test(String(expectedHash || ''))) {
    return [`${ticker}: ${label} requires repository-relative source_artifact and source_sha256`];
  }
  const abs = path.resolve(ROOT, rel);
  const relative = path.relative(ROOT, abs);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return [`${ticker}: ${label} source artifact is missing or escapes the repository (${rel})`];
  }
  const bytes = fs.readFileSync(abs);
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) errors.push(`${ticker}: ${label} source hash mismatch`);
  const escaped = String(ticker).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`(?:^|[^A-Z0-9.-])${escaped}(?:$|[^A-Z0-9.-])`, 'i').test(bytes.toString('utf8'))) {
    errors.push(`${ticker}: ${label} source artifact does not contain the ticker`);
  }
  return errors;
}

function readEvidenceArtifact(evidence) {
  try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, evidence.source_artifact), 'utf8')); }
  catch { return null; }
}

function findTickerRow(value, ticker) {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findTickerRow(item, ticker); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (String(value.symbol || value.ticker || '').toUpperCase() === String(ticker).toUpperCase()) return value;
  for (const child of Object.values(value)) { const found = findTickerRow(child, ticker); if (found) return found; }
  return null;
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
  const scanDateIso = /^\d{8}$/.test(dirName)
    ? `${dirName.slice(0, 4)}-${dirName.slice(4, 6)}-${dirName.slice(6, 8)}`
    : null;
  const openPositions = loadOpenPositions(scanDateIso);

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

  // 1b. Strategy concentration + immutable recent-performance overlays.
  // The temporary policy is hash-bound to a mature-cohort audit so a later
  // retrospective rewrite cannot silently change a historical validation.
  {
    const gate = filters.audit_gates?.recent_strategy_performance;
    const active = gate && (!gate.active_from || !scanDateIso || scanDateIso >= gate.active_from);
    if (active) {
      const source = path.resolve(ROOT, gate.source || 'data/retro-summary.json');
      const overlay = loadStrategyOverlay(source);
      if (!overlay) {
        violations.push({
          rule: 'recent_strategy_performance',
          message: `Strategy overlay ${path.relative(ROOT, source)} is missing or invalid; concentration cannot be validated fail-closed.`
        });
      } else {
        const counts = signals.reduce((acc, s) => {
          const key = String(s.strategy || '').trim();
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        const defaultShare = gate.default_max_share_pct ?? 50;
        const defaultMax = Math.max(1, Math.floor(editorialCount * defaultShare / 100));
        for (const [strategy, count] of Object.entries(counts)) {
          if (count > defaultMax) {
            violations.push({
              rule: 'strategy_concentration',
              message: `${strategy}: ${count}/${editorialCount} exceeds the default concentration cap ${defaultMax} (${defaultShare}%).`
            });
          }
        }

        const evidencePath = overlay.evidence_source && path.resolve(ROOT, overlay.evidence_source);
        if (!evidencePath || !fs.existsSync(evidencePath) || !overlay.evidence_sha256) {
          violations.push({
            rule: 'recent_strategy_performance',
            message: 'Strategy overlay lacks an existing evidence_source or evidence_sha256; fail-closed.'
          });
        } else {
          const actualHash = crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
          if (actualHash !== overlay.evidence_sha256) {
            violations.push({
              rule: 'recent_strategy_performance',
              message: `Strategy overlay evidence hash mismatch for ${overlay.evidence_source}; expected ${overlay.evidence_sha256}, got ${actualHash}.`
            });
          }
        }
        for (const policy of overlay.policies || []) {
          if (policy.status !== 'active') continue;
          if (scanDateIso && policy.effective_from && scanDateIso < policy.effective_from) continue;
          if (scanDateIso && policy.expires_after && scanDateIso > policy.expires_after) continue;
          const maxShare = Number(policy.max_share_pct);
          if (!Number.isFinite(maxShare)) continue;
          const maxCount = Math.max(1, Math.floor(editorialCount * maxShare / 100));
          const count = counts[String(policy.strategy)] || 0;
          if (count > maxCount) {
            violations.push({
              rule: 'recent_strategy_performance',
              message: `${policy.strategy}: ${count}/${editorialCount} exceeds temporary cap ${maxCount} from immutable mature-cohort evidence through ${overlay.evidence_cutoff} (PF ${policy.mature_evidence?.profit_factor}, average R ${policy.mature_evidence?.average_r}). This cap does not validate substitutes.`
            });
          }
        }
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
    const compactDate = String(dirName).replace(/-/g, '').slice(0, 8);
    const effectiveDate = String(filters.diversification.effective_from || '').replace(/-/g, '');
    const hardCapActive = !effectiveDate || (/^\d{8}$/.test(compactDate) && compactDate >= effectiveDate);
    for (const [sect, n] of Object.entries(sectorCount)) {
      if (hardCapActive && sect === 'Other') {
        violations.push({
          rule: 'sector_mapping_missing',
          message: `${n} published signal(s) lack an explicit sector_map entry — concentration cannot be verified fail-closed.`
        });
      }
      if (n > cap) {
        const message = `Sector "${sect}" has ${n} published candidates (cap ${cap}) — reduce concentration before publication.`;
        if (hardCapActive) violations.push({ rule: 'sector_concentration', message });
        else advisories.push(`${message} [sector_concentration]`);
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
          const signal = signals.find(s => String(s.ticker).toUpperCase() === String(ticker).toUpperCase());
          const classifiedNonEquity = new Set((signal?.sec_evidence?.non_equity_offering_hits || [])
            .filter(h => h.verified_from_primary_filing === true)
            .map(h => `${h.form}:${h.date}`));
          const unexplainedHits = edgar.hits.filter(h => !classifiedNonEquity.has(`${h.form}:${h.date}`));
          const detail = unexplainedHits.map(h => `${h.form} (${h.ageDays}d ago)`).join(', ');
          if (!unexplainedHits.length) continue;
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
  // Planchers lus depuis la CONFIG (`editorial_targets`), plus en dur : le gate et la config
  // vivaient séparément et pouvaient diverger sans que rien ne le dise. Abaissés le 2026-08-10,
  // cf. `tp1_reachability` et la mémoire rr-gate-forces-unreachable-targets.
  const ET = filters.editorial_targets || {};
  const RR_MIN_BY_REGIME = ET.rr_min_by_regime
    || { 'RISK-ON': 0.7, 'RECOVERY': 0.7, 'NEUTRAL': 0.7, 'EARLY RISK-OFF': 0.9, 'RISK-OFF': 0.9 };
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
      // Le R/R est RECALCULÉ, jamais lu. Avant le 2026-08-08 ce gate parsait le champ texte
      // `rr` — il validait donc l'affirmation du producteur, contrôle tautologique qui n'a
      // rejeté aucune ligne sur 48 publiées. Le même jour, qa-check (qui recalcule) échouait
      // là où celui-ci passait, sur le même scan.
      // Base de calcul = `entry`, la borne HAUTE de la zone, donc le pire remplissage. C'est
      // la convention de fill-policy.js (le chase se mesure à cette borne), celle de qa-check,
      // et celle que reproduisent au centième les 8 lignes publiées le 2026-08-07.
      if (s.entry == null || s.stop == null || s.tp1 == null) {
        violations.push({
          rule: 'rr_min_by_regime',
          message: `${s.ticker}: entry/stop/tp1 manquant — R/R non recalculable, fail-closed.`
        });
        continue;
      }
      const risk = s.entry - s.stop;
      if (risk <= 0) {
        violations.push({
          rule: 'rr_min_by_regime',
          message: `${s.ticker}: risque nul ou négatif (entry ${s.entry} ≤ stop ${s.stop}).`
        });
        continue;
      }
      const ratio = Math.round(((s.tp1 - s.entry) / risk) * 100) / 100;
      if (ratio < rrMin) {
        const claimed = String(s.rr || '').match(/1:(\d+\.?\d*)/);
        const gap = claimed && Math.abs(parseFloat(claimed[1]) - ratio) > 0.02
          ? ` (le champ rr annonce 1:${claimed[1]} — écart de ${(parseFloat(claimed[1]) - ratio).toFixed(2)}, typiquement un calcul au milieu de zone au lieu du haut)`
          : '';
        violations.push({
          rule: 'rr_min_by_regime',
          message: `${s.ticker}: R/R recalculé 1:${ratio} < minimum de régime 1:${rrMin} (${regime}) — hard block${gap}.`
        });
      }
    }
  }

  // 8bis. ATTEIGNABILITÉ DE LA CIBLE — gate principal depuis le 2026-08-10.
  // Le plancher de R/R ne disait rien de la capacité du titre à ATTEINDRE sa cible : sur les
  // 21 scans publiés du 10/07 au 07/08, la cible était à 8,48% en moyenne quand le meilleur
  // gain latent moyen n'était que de 4,38%. Elle n'a été touchée que 12,5% du temps, pour un
  // R/R annoncé de 1,70 qui en exigeait 37%. En ne changeant QUE la cible, 1,5×ATR porte
  // l'espérance de +0,025 R à +0,108 R sur 88 trades.
  // Fail-closed : sans `extension.atr`, la cible n'est pas vérifiable, donc pas publiable.
  {
    const reach = ET.tp1_reachability;
    const activeFrom = reach && reach._active_from;
    const inScope = reach && (!activeFrom || dirName >= String(activeFrom).replace(/-/g, ''));
    if (inScope) {
      const lo = reach.min_atr_multiple ?? 1.0, hi = reach.max_atr_multiple ?? 2.0;
      for (const s of signals) {
        const stratKey = String(s.strategy || '').toLowerCase().replace(/[\s-]/g, '');
        if (stratKey && !RR_GATE_STRATEGIES.has(stratKey)) continue;
        const atr = s.extension && s.extension.atr;
        if (!Number.isFinite(atr) || atr <= 0) {
          violations.push({
            rule: 'tp1_reachability',
            message: `${s.ticker}: extension.atr absent ou nul — distance à la cible non vérifiable, fail-closed.`
          });
          continue;
        }
        if (s.entry == null || s.tp1 == null) continue;   // déjà signalé par le gate R/R
        const mult = (s.tp1 - s.entry) / atr;
        if (mult < lo || mult > hi) {
          const why = mult > hi
            ? `hors de portée sur l'horizon — sur 88 trades mesurés, une cible au-delà de ${hi}×ATR n'est atteinte que 12 à 21% du temps`
            : `trop proche pour justifier le risque pris`;
          violations.push({
            rule: 'tp1_reachability',
            message: `${s.ticker}: cible à ${mult.toFixed(2)}×ATR, hors de la bande [${lo} ; ${hi}] — ${why}.`
          });
        }

        // Le champ MACHINE doit dire la même chose que le calcul. Sur le scan du
        // 2026-08-10, `tp1_atr_multiple` était faux sur 5 lignes sur 7 (BNY annonçait
        // 1,5 pour 1,61 réel, TTE.PA 1,5 pour 1,24, SOLV 1,5 pour 1,72, SHELL.AS 1,5
        // pour 1,70, FTNT 1,37 pour 1,62). Un gate qui valide une valeur RECOPIÉE ne
        // valide rien : la valeur écrite doit être le résultat du calcul, à 0,01 près.
        if (s.tp1_atr_multiple != null) {
          const gap = Math.abs(Number(s.tp1_atr_multiple) - mult);
          if (!Number.isFinite(gap) || gap > 0.01) {
            violations.push({
              rule: 'tp1_atr_multiple_coherence',
              message: `${s.ticker}: tp1_atr_multiple annonce ${s.tp1_atr_multiple} pour ${mult.toFixed(3)} recalculé depuis (tp1 − entry)/atr — écart de ${gap.toFixed(3)} > 0,01. Le champ doit être ÉCRIT par le calcul, jamais recopié.`
            });
          }
        }
      }
    }
  }

  // 9. R/R uniformity check — if >60% signals have identical R:R string, scoring pipeline is broken.
  // Exception (2026-08-20) : depuis le 2026-08-10, tp1_reachability fixe la cible à un multiple
  // d'ATR FIXE (target_atr_multiple) et stops.min_atr_multiple fixe le stop plancher au même
  // multiple — un R/R uniforme égal à target_atr_multiple/min_atr_multiple est donc la
  // CONSÉQUENCE MÉCANIQUE ATTENDUE de la politique documentée (evidence-based, cf. commentaire
  // tp1_reachability ci-dessus), pas un signe de triche. Le gate ne doit s'alarmer QUE si la
  // valeur uniforme observée NE correspond PAS à ce ratio attendu (là, quelque chose d'autre
  // cloche — reverse-engineering réel depuis un R:R fixe non dérivé de la politique).
  {
    const expectedAtrRatio = ET.tp1_reachability?.target_atr_multiple != null && filters.stops?.min_atr_multiple
      ? Math.round((ET.tp1_reachability.target_atr_multiple / filters.stops.min_atr_multiple) * 100) / 100
      : null;
    const expectedRRString = expectedAtrRatio != null ? `1:${expectedAtrRatio.toFixed(2)}` : null;
    const rrCounts = {};
    for (const s of signals) {
      const rr = String(s.rr || '');
      rrCounts[rr] = (rrCounts[rr] || 0) + 1;
    }
    for (const [rr, count] of Object.entries(rrCounts)) {
      if (count > signals.length * 0.6 && signals.length >= 5) {
        if (expectedRRString && rr === expectedRRString) continue; // conséquence attendue de tp1_reachability, pas une alerte
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

  // 12. Liquidity and market-cap evidence for the governed US-only scanner.
  if (filters.tickers?.min_market_cap_usd) {
    const minMcap = filters.tickers.min_market_cap_usd;
    const minAdv = filters.tickers.min_avg_daily_volume_usd || 0;
    const compactDate = String(dirName).replace(/-/g, '').slice(0, 8);
    const effectiveDate = String(filters.diversification?.effective_from || '').replace(/-/g, '');
    const hardEvidenceActive = !effectiveDate || (/^\d{8}$/.test(compactDate) && compactDate >= effectiveDate);
    let referenceClose = null;
    try {
      const scanData = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
      referenceClose = scanData.engine_meta?.reference_close || scanData.engine_meta?.freshness?.marketdata_bars || null;
    } catch { /* missing reference close is handled fail-closed below */ }
    for (const s of signals) {
      const isEtf = String(s.region || '').toUpperCase() === 'ETF';
      if (typeof s.entry === 'number' && s.entry < 5) {
        violations.push({
          rule: 'penny_stock',
          message: `${s.ticker}: entry price $${s.entry} < $5 — penny stock territory. Minimum market cap $${(minMcap/1e6).toFixed(0)}M required.`
        });
      }
      if (!hardEvidenceActive) continue;
      if (!isEtf && (!Number.isFinite(s.market_cap) || s.market_cap < minMcap)) {
        violations.push({
          rule: 'market_cap_evidence',
          message: `${s.ticker}: market_cap=${s.market_cap ?? 'missing'}; a verified value >= $${(minMcap / 1e6).toFixed(0)}M is required.`
        });
      }
      const evidence = s.selection_evidence || {};
      const adv = Number(evidence.avg_daily_dollar_volume);
      for (const message of validateHashBoundArtifact(evidence, s.ticker, 'selection evidence')) {
        violations.push({ rule: 'selection_artifact_evidence', message });
      }
      const selectionArtifact = readEvidenceArtifact(evidence);
      const selectionRow = selectionArtifact && findTickerRow(selectionArtifact, s.ticker);
      const artifactAdv = selectionRow && Number(selectionRow.last_price) * Number(selectionRow.avg_volume);
      if (!selectionRow || (!isEtf && Number(selectionRow.market_cap) !== Number(s.market_cap))
        || !Number.isFinite(artifactAdv) || Math.abs(artifactAdv - adv) > Math.max(1, Math.abs(adv) * 0.01)) {
        violations.push({ rule: 'selection_semantic_evidence', message: `${s.ticker}: market cap/ADV do not reconcile to the bound screener row.` });
      }
      if (!Number.isFinite(adv) || adv < minAdv) {
        violations.push({
          rule: 'liquidity_evidence',
          message: `${s.ticker}: archived average daily dollar volume ${Number.isFinite(adv) ? `$${Math.round(adv)}` : 'missing'} is below the $${(minAdv / 1e6).toFixed(0)}M floor.`
        });
      }
      if (!referenceClose || String(evidence.screen_snapshot_as_of || '') !== String(referenceClose) || !Number.isFinite(Number(evidence.estimated_valid_bars)) || Number(evidence.estimated_valid_bars) < 1) {
        violations.push({
          rule: 'selection_freshness_evidence',
          message: `${s.ticker}: source screen ${evidence.screen_snapshot_as_of || 'missing'} must match governed reference close ${referenceClose || 'missing'} with estimated_valid_bars >= 1.`
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

  // 19. allowed-actions BORNE (idée #7 — compute_allowed_actions + hold sûr) ─────────────
  // Garde-fou STRUCTUREL, pas un nouveau sélecteur : chaque signal éditorial est un pick
  // d'ENTRÉE (il propose donc un `buy`). On calcule d'abord — EN CODE, avant tout décideur —
  // le menu d'actions permises pour ce titre à un budget sim consultatif (min(limite de
  // position, cash)/prix), puis on borne le pick À ce menu via boundDecision(). Un pick ne
  // peut jamais dépasser le menu : si le menu pré-borné ne contient pas `buy` (prix ≤ 0 /
  // budget insuffisant pour ≥1 action), le pick sort de l'ensemble permis → HARD BLOCK.
  //   • SIM-ONLY : aucune donnée de book réel, aucun ordre — budget par défaut généreux
  //     ($20k = 20% d'une NLV sim de $100k) : les picks sains (prix ≥ $5, déjà exigé par la
  //     règle 12) passent TOUS → borne additive, ZÉRO régression sur un scan valide.
  //   • DÉGRADATION SÛRE (renforce le MCP HARD STOP) : un entry price manquant/invalide ne
  //     fabrique jamais un buy — computeAllowedActions dégrade en `hold` (fallback). On ne
  //     bloque alors PAS (donnée absente ≠ pick agressif) mais on le SIGNALE en advisory :
  //     l'échec de donnée mène à hold, jamais à une action agressive.
  {
    const SIM_NLV = 100000, SIM_CASH = 100000, SIM_POS_PCT = 0.20; // budget sim consultatif
    for (const s of signals) {
      const menu = computeAllowedActions({
        ticker: s.ticker,
        price: (typeof s.entry === 'number') ? s.entry : undefined,
        cash: SIM_CASH,
        nlv: SIM_NLV,
        positionLimitPct: SIM_POS_PCT,
      });
      if (menu.fallback) {
        // Donnée d'entrée dégradée → menu réduit à hold. Safe-degrade, non-bloquant.
        advisories.push(`${s.ticker}: allowed-actions dégradé en hold — ${menu.reason} [allowed_actions_hold]`);
        continue;
      }
      // Le pick propose un buy ; on le borne au menu permis. Hors menu → hold = pick illégal.
      const bounded = boundDecision({ action: 'buy', quantity: 1 }, menu);
      if (bounded.action !== 'buy') {
        violations.push({
          rule: 'allowed_actions_bound',
          message: `${s.ticker}: entry pick propose un BUY mais le menu d'actions pré-borné ne permet que [${menu.actions.join(', ')}] (${menu.reason}) — un pick ne peut jamais dépasser le menu permis (borne #7).`
        });
      }
    }
  }

  // 20. score-contract (hard_block) — CONTRAT DE SCORE entre producteurs de signaux.
  // Lu sur le fichier RAW (comme 17/18) : c'est la SEULE règle qui couvre aussi les scanners
  // spécialistes, précisément parce que leurs scores « hors échelle par construction » sont ce
  // que le contrat encadre. Deux violations distinctes, toutes deux bloquantes :
  //   (a) score_out_of_range / unknown_family — un producteur sort de la plage qu'il déclare,
  //       ou émet un signal qu'on ne sait rattacher à aucune famille : ni seuillable, ni classable.
  //   (b) cross_family_comparison — signals[] mélange des familles d'échelle. C'est le composite
  //       que sweep/pit-engine/gen-status-page seuillent (`minScore`) et trient (`b.score-a.score`)
  //       EN BLOC : y mélanger de l'ETFMomentum (37→323) avec de la conviction éditoriale (76→95),
  //       c'est classer l'échelle et non la qualité, et rendre AdaptiveFractal (max 77) ou forex
  //       (max 27.5) structurellement inéligible à un minScore de 90.
  // Un scan conforme ne coûte rien (le composite éditorial est mono-famille — vérifié sur les
  // scans du 20260731 au 20260807). Détail : node tools/lib/score-contract.js --check <dir>
  {
    const rawSc = loadRawSignalsJson(dir);
    if (!rawSc) {
      violations.push({ rule: 'score_contract', message: 'signals.json brut illisible — contrat de score invérifiable (fail-closed).' });
    } else {
      const POOL_SUBLISTS = ['momentum', 'breakout', 'pullback', 'pre_squeeze', 'bull'];
      const composite = [];
      const seen = [];
      for (const s of rawSc.signals || []) { composite.push(s); seen.push({ s, label: 'signals[]' }); }
      for (const k of POOL_SUBLISTS) for (const s of rawSc[k] || []) { composite.push(s); seen.push({ s, label: `${k}[]` }); }
      for (const k of Object.keys(rawSc)) {
        if (!/_pool$/.test(k) || !Array.isArray(rawSc[k])) continue;
        // La clé de pool est AUTORITAIRE pour l'identité (parité scanner-parser.poolFrom).
        for (const s of rawSc[k]) seen.push({ s: Object.assign({}, s, { source: k }), label: k });
      }
      for (const { s, label } of seen) {
        const r = scoreContract.checkSignal(s, `${dirName}:${label}`);
        for (const v of r.violations) violations.push({ rule: 'score_contract', message: v.message });
      }
      const cmp = scoreContract.checkComparable(composite, `${dirName}:signals[] (seuil minScore + tri)`);
      for (const v of cmp.violations) violations.push({ rule: 'score_contract', message: v.message });
    }
  }

  // ── ADVISORY CHECKS (warnings only, do NOT block publish) ─────────────────
  // Lessons from scanner-lessons.json v2.0 are SELECTION-TIME inputs at /scanner Phase 2.
  // validate-scan.js blocks hard errors above; advisory deviations are surfaced below
  // so Claude can iterate — but a passing scan with warnings still publishes.

  // ── Gates G1-G3 (audit scanner 13-19/07/2026, tag lecon-20260717) ─────────────
  // Encodage des règles mémoire entry-strategy-coherence, etf-lookthrough-correlation-cap
  // et regime-score-label-lag (extension décrochage). Détail + contrat d'enrichissement :
  // docs/scanner-gates.md. Portée : le top publié (signals[] du signals.json RAW), pas le
  // pool candidat élargi. `active_from` grandfathere les scans déjà publiés avant l'audit.
  const ag = filters.audit_gates || {};
  const scanISO = /^\d{8}$/.test(dirName) ? `${dirName.slice(0, 4)}-${dirName.slice(4, 6)}-${dirName.slice(6, 8)}` : null;
  if (ag.active_from && scanISO && scanISO >= ag.active_from) {
    const rawGates = loadRawSignalsJson(dir);
    if (!rawGates || !Array.isArray(rawGates.signals)) {
      violations.push({ rule: 'audit_gates', message: 'signals.json brut illisible — gates G1-G3 inapplicables (fail-closed).' });
    } else {
      const published = rawGates.signals.filter(s => (s.strategy || '') !== 'Candlestick');

      // G0 entry-zone-unambiguous (2026-08-11) : la zone d'entrée doit être LISIBLE PAR
      // UNE MACHINE, sans convention supposée.
      //
      // Constat qui motive ce gate : au 12 juin, LRCX portait entry=350 dans
      // signals.json, data-entry="345" sur la page publiée, et « zone 350 » dans la prose
      // — trois nombres, trois sources, aucune faisant autorité. Impossible de savoir si
      // `entry` désignait le milieu ou une borne. Conséquence : qa-retro ne pouvait pas
      // mesurer un chase (le chase se mesure AU-DESSUS de la zone), donc AUCUNE rétro
      // n'était attestable — 55 scans du 20260416 au 20260708 sont dans ce cas et le
      // resteront : on ne réécrit pas un enregistrement publié pour se donner raison.
      //
      // Une zone est non ambiguë si entry_high existe, OU si entry_low existe et
      // entry > entry_low (auquel cas `entry` EST la borne haute). Sinon on refuse
      // le scan : un scan publié aujourd'hui doit rester notable dans trois mois.
      for (const s of published) {
        const hasHigh = typeof s.entry_high === 'number';
        const derivable = typeof s.entry_low === 'number' && typeof s.entry === 'number' && s.entry > s.entry_low;
        if (hasHigh || derivable) continue;
        violations.push({
          rule: 'entry_zone_unambiguous',
          message: `${s.ticker}: zone d'entrée ambiguë — ni entry_high, ni (entry_low < entry). Avec le seul champ \`entry\` (${s.entry}), on ne peut pas savoir si c'est le milieu ou la borne haute, donc la rétro ne pourra pas mesurer le chase. Porter entry_low ET entry_high.`
        });
      }

      // G1 entry-strategy-coherence : une ligne Momentum/Breakout s'achète en stop-buy
      // AU-DESSUS du niveau de cassure — min(zone d'entrée) >= close de la veille.
      const g1 = ag.entry_strategy_coherence;
      if (g1) {
        const tol = (g1.tolerance_pct ?? 0) / 100;
        for (const s of published) {
          if (!(g1.strategies || []).includes(s.strategy)) continue;
          const zoneMin = typeof s.entry_low === 'number' ? s.entry_low : s.entry;
          if (typeof zoneMin !== 'number' || typeof s.price !== 'number') {
            violations.push({
              rule: 'entry_strategy_coherence',
              message: `${s.ticker}: ${s.strategy} sans entry_low/price exploitables — min(zone) >= close veille invérifiable (fail-closed).`
            });
            continue;
          }
          if (zoneMin < s.price * (1 - tol)) {
            violations.push({
              rule: 'entry_strategy_coherence',
              message: `${s.ticker}: ${s.strategy} avec min(zone) ${zoneMin} < close veille ${s.price} — retirer la ligne ou requalifier Pullback.`
            });
          }
        }
      }

      // G2 etf-lookthrough-correlation-cap : chaque ETF est décomposé sur ses top
      // holdings (enrichissement MCP au scan → champ `lookthrough`) AVANT le cap de
      // 2 par cluster ; un ETF factoriel dont le facteur est déclaré en sortie dans
      // la thèse du jour (`exited_factors`) est retiré (cas MTUM 14/07, SPMO 16/07).
      const g2 = ag.etf_lookthrough;
      if (g2) {
        const SECTOR_MAP = filters.diversification?.sector_map || {};
        const exited = (rawGates.exited_factors || []).map(x => String(x).toLowerCase());
        const clusterMembers = {};
        for (const s of published) {
          const isEtf = String(s.region || '').toUpperCase() === 'ETF' || String(s.sector || '').toUpperCase() === 'ETF';
          let clusters;
          if (isEtf) {
            const lt = s.lookthrough;
            if (!lt || !Array.isArray(lt.clusters) || !lt.clusters.length) {
              violations.push({
                rule: 'etf_lookthrough',
                message: `${s.ticker}: ETF sans champ lookthrough {factor, clusters[]} (décomposition top holdings via MCP à l'enrichissement) — fail-closed.`
              });
              continue;
            }
            if (lt.factor && exited.includes(String(lt.factor).toLowerCase())) {
              violations.push({
                rule: 'etf_factor_exit',
                message: `${s.ticker}: ETF factoriel "${lt.factor}" alors que la thèse du jour le déclare en sortie (exited_factors) — retirer.`
              });
            }
            clusters = lt.clusters;
          } else {
            clusters = [SECTOR_MAP[String(s.ticker).toUpperCase()] || s.sector || 'Other'];
          }
          for (const c of clusters) {
            const key = String(c).toLowerCase().trim();
            (clusterMembers[key] = clusterMembers[key] || []).push(s.ticker);
          }
        }
        const cap = g2.max_per_cluster ?? 2;
        for (const [c, members] of Object.entries(clusterMembers)) {
          if (c === 'other') continue;
          if (members.length > cap) {
            violations.push({
              rule: 'etf_lookthrough_correlation_cap',
              message: `Cluster "${c}": ${members.length} expositions dans le top publié (cap ${cap}, ETF décomposés sur leurs holdings) — ${members.join(', ')}.`
            });
          }
        }
      }

      // G3 regime-score-label-lag (extension) : décrochage de confiance > drop_pts sur
      // window_sessions séances → poids Momentum plafonné quelle que soit l'étiquette,
      // et les ETF factoriels momentum sortent du panier.
      const g3 = ag.regime_score_drop;
      if (g3) {
        // ⚠️ DEUX ÉCHELLES dans l'archive (cf. canon §2b) : BULLISH 0-100 (65+ = RISK-ON)
        // et DÉFENSIVITÉ 0-100 (0 = plein risk-on, convention MCP v5 facet regime).
        // Ce gate compare des scores ENTRE scans : il DOIT donc ramener chaque valeur sur
        // une échelle commune (bullish) AVANT de mesurer un décrochage, sinon un scan
        // écrit en défensivité (ex. 3.4) face à un historique bullish (69-72) produit un
        // faux décrochage de ~69 pts et bloque la publication à tort.
        const norm = (v, scale) => {
          if (typeof v !== 'number') return null;
          const pct = v <= 1 ? v * 100 : v;              // 0-1 → 0-100
          return scale === 'defensiveness' ? 100 - pct : pct; // → toujours bullish
        };
        const win = g3.window_sessions ?? 5;
        const prevDirs = fs.readdirSync(path.join(ROOT, 'scanner'))
          .filter(d => /^\d{8}$/.test(d) && d < dirName).sort().slice(-(win - 1));
        const hist = [];
        for (const d of prevDirs) {
          try {
            const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'scanner', d, 'signals.json'), 'utf8'));
            // échelle absente (tout l'historique <= 20260731) => bullish, comportement inchangé
            const v = norm(j.regimeScore, j.regimeScoreScale || null);
            if (v != null) hist.push(v);
          } catch { /* scan sans signals.json : ignoré */ }
        }
        const curScale = (loadRawSignalsJson(dir) || {}).regimeScoreScale || null;
        const cur = norm(regimeScore, curScale);
        if (cur != null && hist.length) {
          const peak = Math.max(...hist, cur);
          const drop = peak - cur;
          if (drop > (g3.drop_pts ?? 15)) {
            const capN = Math.max(1, Math.floor(published.length * (g3.momentum_cap_pct ?? 20) / 100));
            const moms = published.filter(s => s.strategy === 'Momentum');
            if (moms.length > capN) {
              violations.push({
                rule: 'regime_score_drop_momentum_cap',
                message: `Décrochage de confiance ${drop.toFixed(0)} pts sur ${hist.length + 1} séances (pic ${peak} → ${cur}) : Momentum plafonné à ${capN}/${published.length} quelle que soit l'étiquette "${regime}" — ${moms.length} présents (${moms.map(s => s.ticker).join(', ')}).`
              });
            }
            for (const s of published) {
              if (s.lookthrough && String(s.lookthrough.factor || '').toLowerCase() === 'momentum') {
                violations.push({
                  rule: 'etf_factor_exit',
                  message: `${s.ticker}: ETF factoriel momentum pendant un décrochage de ${drop.toFixed(0)} pts — retirer (regime-score-label-lag).`
                });
              }
            }
          }
        }
      }
    }
  }

  // ── Gate G4 pipeline-order (incident 20260730) ───────────────────────────────
  // La doctrine perf (.claude/skills/perf-parallel-mcp.md, R2) place le filtre
  // résultats en Vague 1, AVANT l'enrichissement par ticker. Rien ne le forçait :
  // le 30/07 il a tourné en Vague 3, et F + PFE sont morts APRÈS avoir consommé
  // leur salve d'enrichissement complète (~15 min de reprise). Ce gate exige la
  // preuve de l'ordre, pas la bonne volonté. `active_from` grandfathere les scans
  // antérieurs — on ne réécrit pas l'histoire d'un scan déjà publié.
  const g4 = (filters.audit_gates || {}).pipeline_order;
  if (g4 && scanISO && (!g4.active_from || scanISO >= g4.active_from)) {
    const rawOrder = loadRawSignalsJson(dir);
    const po = rawOrder && rawOrder._pipelineOrder;
    const pub = rawOrder && Array.isArray(rawOrder.signals)
      ? rawOrder.signals.filter(s => (s.strategy || '') !== 'Candlestick') : [];
    if (!po || typeof po !== 'object') {
      violations.push({
        rule: 'pipeline_order',
        message: 'signals.json sans bloc _pipelineOrder {earnings_screened_at, enrichment_started_at, candidates_screened} — ordre filtre-avant-enrichissement invérifiable (fail-closed).'
      });
    } else {
      const tScreen = Date.parse(po.earnings_screened_at || '');
      const tEnrich = Date.parse(po.enrichment_started_at || '');
      if (!Number.isFinite(tScreen) || !Number.isFinite(tEnrich)) {
        violations.push({
          rule: 'pipeline_order',
          message: '_pipelineOrder: earnings_screened_at / enrichment_started_at absents ou non ISO-8601 — ordre invérifiable (fail-closed).'
        });
      } else if (tScreen >= tEnrich) {
        violations.push({
          rule: 'pipeline_order',
          message: `_pipelineOrder: filtre résultats (${po.earnings_screened_at}) postérieur ou simultané à l'enrichissement (${po.enrichment_started_at}) — le vivier a été enrichi avant d'être filtré. Rejouer la Vague 1 avant la Vague 3.`
        });
      }
      const screened = Number(po.candidates_screened);
      const ratio = g4.min_screened_ratio ?? 2;
      if (!Number.isFinite(screened) || screened < pub.length * ratio) {
        violations.push({
          rule: 'pipeline_order',
          message: `_pipelineOrder.candidates_screened=${po.candidates_screened} — le filtre résultats doit couvrir le vivier COMPLET (≥ ${ratio}× les ${pub.length} lignes publiées), pas la sélection finale.`
        });
      }
      if (g4.require_source_per_signal) {
        // Sources recevables selon la NATURE de la ligne. Un ETF n'a pas de résultats à publier
        // et aucun dépôt 8-K n'existe hors SEC : exiger "8k_item_202" partout rendrait le gate
        // insatisfiable pour les ETF et les cotations européennes. Les dents restent là où elles
        // comptent — pour une ACTION AMÉRICAINE, seul le dépôt 8-K item 2.02 est recevable, le
        // calendrier prévisionnel ayant laissé passer 10 titres déjà publiés le 20260730.
        const OK_ETF = new Set(['n_a_etf', '8k_item_202']);
        const OK_NON_US = new Set(['issuer_calendar_verified', '8k_item_202']);
        for (const s of pub) {
          const src = String(s.earnings_source || '');
          const region = String(s.region || '').toUpperCase().trim();
          const isEtf = region === 'ETF' || String(s.sector || '').toUpperCase().startsWith('ETF') || !!s.lookthrough;
          let allowed, expected;
          if (isEtf) { allowed = OK_ETF; expected = 'n_a_etf (aucun résultat à publier)'; }
          else if ((region && region !== 'US') || s.issuer_filing_regime === 'foreign_private_issuer') { allowed = OK_NON_US; expected = 'issuer_calendar_verified (émetteur privé étranger, aucun 8-K item 2.02)'; }
          else { allowed = new Set(['8k_item_202']); expected = '8k_item_202 (dépôt SEC item 2.02, JAMAIS le calendrier prévisionnel)'; }
          if (!allowed.has(src)) {
            violations.push({
              rule: 'pipeline_order',
              message: `${s.ticker}: earnings_source="${src || 'absent'}" invalide — attendu ${expected}.`
            });
          }
        }
      }
    }
  }

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

  // Final-basket event and filing evidence. A boolean is not evidence: new scans must
  // carry the exact forward query and accession-level SEC/issuer coverage.
  const allSignals = [...signals, ...tklPool];
  {
    const compactDate = String(dirName).replace(/-/g, '').slice(0, 8);
    const effectiveDate = String(filters.diversification?.effective_from || '').replace(/-/g, '');
    const hardEvidenceActive = !effectiveDate || (/^\d{8}$/.test(compactDate) && compactDate >= effectiveDate);
    if (hardEvidenceActive) for (const s of signals) {
      const isEtf = String(s.region || '').toUpperCase() === 'ETF';
      const forward = s.earnings_forward_evidence || {};
      if (!forward.checked_at || Number(forward.days_ahead) < 7 || forward.event_found !== false || !forward.source_artifact) {
        violations.push({
          rule: 'earnings_forward_evidence',
          message: `${s.ticker}: exact final-basket earnings evidence is missing, shorter than 7 days, or reports an event.`
        });
      }
      for (const message of validateHashBoundArtifact(forward, s.ticker, 'earnings evidence')) {
        violations.push({ rule: 'earnings_artifact_evidence', message });
      }
      const earningsArtifact = readEvidenceArtifact(forward);
      const earningsCoverage = earningsArtifact && earningsArtifact.coverage && earningsArtifact.coverage[s.ticker];
      const expectedCoverage = isEtf ? 'no issuer earnings (ETF)' : 'no earnings found in next 7 days';
      if (!earningsArtifact || !earningsArtifact.coverage || earningsCoverage !== expectedCoverage) {
        violations.push({ rule: 'earnings_semantic_evidence', message: `${s.ticker}: bound earnings artifact does not prove the stated no-event window.` });
      }
      if (isEtf) continue;
      const sec = s.sec_evidence || {};
      if (sec.pagination_exhausted !== true || !Array.isArray(sec.equity_offering_hits) || !Array.isArray(sec.non_equity_offering_hits)) {
        violations.push({
          rule: 'sec_evidence',
          message: `${s.ticker}: accession-level SEC evidence must include exhausted pagination plus separate equity/non-equity offering arrays.`
        });
      }
      for (const message of validateHashBoundArtifact(sec, s.ticker, 'SEC evidence')) {
        violations.push({ rule: 'sec_artifact_evidence', message });
      }
      const secArtifact = readEvidenceArtifact(sec);
      const secCoverage = secArtifact && secArtifact.coverage && secArtifact.coverage[s.ticker];
      if (!secCoverage || JSON.stringify(secCoverage.latest_earnings_filing || {}) !== JSON.stringify(sec.latest_earnings_filing || {})
        || JSON.stringify(secCoverage.equity_offering_hits || []) !== JSON.stringify(sec.equity_offering_hits || [])
        || JSON.stringify(secCoverage.non_equity_offering_hits || []) !== JSON.stringify(sec.non_equity_offering_hits || [])) {
        violations.push({ rule: 'sec_semantic_evidence', message: `${s.ticker}: SEC classifications/accession do not reconcile to the bound artifact.` });
      }
      if (sec.equity_offering_hits?.length || s.dilution_clear !== true) {
        violations.push({
          rule: 'dilution_evidence',
          message: `${s.ticker}: recent equity offering evidence is non-empty or dilution_clear is not true.`
        });
      }
      if (s.issuer_filing_regime === 'foreign_private_issuer') {
        if (sec.issuer_calendar_verified !== true || s.earnings_source !== 'issuer_calendar_verified') {
          violations.push({
            rule: 'foreign_issuer_evidence',
            message: `${s.ticker}: foreign private issuer requires an exact issuer-calendar check and issuer_calendar_verified source.`
          });
        }
      } else {
        const filing = sec.latest_earnings_filing || {};
        if (filing.form !== '8-K' || !/^\d{10}-\d{2}-\d{6}$/.test(String(filing.accession || '')) || !filing.date) {
          violations.push({
            rule: 'earnings_accession_evidence',
            message: `${s.ticker}: domestic issuer requires the latest earnings 8-K date and accession number.`
          });
        }
      }
    }
  }

  // Legacy flags remain visible as advisories for older/specialist pools.
  for (const s of allSignals) {
    const prefix = tklPool.includes(s) ? `TKL ${s.ticker}` : s.ticker;
    if (s.earnings_clear === false) advisories.push(`${prefix}: earnings_clear=false (±3d window) [earnings_window]`);
    if (s.dilution_clear === false) advisories.push(`${prefix}: dilution_clear=false [dilution_clear]`);
  }

  // Merge EDGAR-discovered advisories (top 10 only — TKL EDGAR hits are hard blocks above)
  advisories.push(...advisoriesFromEdgar);

  // Production universe and composition. Historical scans before effective_from keep
  // their original regional contract; new scans are US-listed stocks + US-listed ETFs only.
  if (filters.diversification) {
    const compactDate = String(dirName).replace(/-/g, '');
    const effectiveDate = String(filters.diversification.effective_from || '').replace(/-/g, '');
    const contractActive = !effectiveDate || (/^\d{8}$/.test(compactDate) && compactDate >= effectiveDate);
    if (contractActive) {
      const allowed = new Set((filters.diversification.allowed_regions || ['US', 'ETF']).map(r => String(r).toUpperCase()));
      const counts = { US: 0, ETF: 0 };
      for (const s of signals) {
        const region = String(s.region || '').toUpperCase().trim();
        const ticker = String(s.ticker || '').toUpperCase().trim();
        const foreignListing = /\.(AS|BR|DE|F|L|LS|MC|MI|PA|ST|SW|TO|V)$/.test(ticker);
        if (!allowed.has(region) || foreignListing) {
          violations.push({
            rule: 'us_listed_universe',
            message: `${s.ticker}: region "${region || '(missing)'}" or exchange suffix is outside the US stocks/US ETFs scanner universe.`
          });
          continue;
        }
        counts[region] = (counts[region] || 0) + 1;
      }
      const floors = {
        US: filters.diversification.min_us_count,
        ETF: filters.diversification.min_etf_count
      };
      for (const [region, floor] of Object.entries(floors)) {
        if (floor == null) continue;
        if ((counts[region] || 0) < floor) {
          violations.push({
            rule: 'us_universe_composition',
            message: `Region "${region}" has ${counts[region] || 0} setups; at least ${floor} required.`
          });
        }
      }
    }
  }

  // ── L'univers de corrélation doit être le panier RÉELLEMENT publié ─────────────────────
  // Constaté sur le scan PUBLIÉ du 20260807 : engine_meta.risk_gating.correlation_universe
  // valait « ROST,JCI,NSC,V,PNC,EWS,VFLO,IOO » — le crible INITIAL — alors que le panier
  // publié était JCI, ROST, ITX.MC, KBC.BR, LMT, CPER, EWS, NSC. Quatre des huit titres
  // publiés (CPER, ITX.MC, KBC.BR, LMT) n'ont jamais été mesurés, et trois titres mesurés
  // (V, PNC, VFLO, IOO) n'ont jamais été publiés. Les max_pair_correlation et
  // avg_off_diagonal_correlation affichés décrivaient donc un panier qui n'a pas existé —
  // et les deux règles de dé-concentration (rho > 0,85 ; moyenne hors-diagonale > 0,65)
  // ne pouvaient pas mordre sur la moitié du panier.
  // Le contrat courant est US-only, donc toute ligne publiée doit être couverte.
  // Ce n'est PAS une raison de publier une métrique partielle sans le dire.
  // NOTE — la première version de ce contrôle lisait une variable `raw` HORS PORTÉE et son
  // `catch` muet avalait la ReferenceError : le contrôle ne s'exécutait jamais et ne le disait
  // pas. Exactement le défaut qu'il est censé combattre. Le catch signale désormais.
  try {
    const dataPath = path.join(dir, 'data.json');
    const dataJson = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : null;
    const rg = (dataJson && dataJson.engine_meta && dataJson.engine_meta.risk_gating) || {};
    const uni = rg.correlation_universe;
    if (uni && Array.isArray(allSignals) && allSignals.length) {
      const inUni = new Set(String(uni).match(/[A-Z][A-Z0-9.\-]{0,7}/g) || []);
      const published = allSignals.map(x => x.ticker).filter(Boolean);
      const missing = published.filter(t => !inUni.has(t));
      if (missing.length) {
        const pct = Math.round((published.length - missing.length) / published.length * 100);
        advisories.push(
          `correlation_universe ne couvre que ${pct}% du panier publié — non mesurés : ${missing.join(', ')}. ` +
          `Les métriques de corrélation décrivent un autre panier que celui publié. ` +
          `Recalculer sur la liste FINALE, ou déclarer explicitement la couverture partielle. [correlation_universe_coverage]`);
      }
    }
  } catch (e) {
    // Jamais bloquant, mais JAMAIS muet : un contrôle qui échoue en silence vaut moins que
    // pas de contrôle du tout, parce qu'il fait croire qu'il a tourné.
    advisories.push(`correlation_universe : contrôle NON EXÉCUTÉ (${e.message}) [correlation_universe_coverage]`);
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

module.exports = { loadFilters, loadScanSignals, loadOpenPositions, loadStrategyOverlay };
