/**
 * tools/lib/scanner-parser.js — Shared scanner signal loader.
 *
 * PRIMARY: reads `scanner/YYYYMMDD/signals.json` — zero parsing, direct JSON.
 * FALLBACK: parses HTML for legacy scans (pre-signals.json).
 *
 * IMPORTANT: loadSignals always returns NUMBERS for price fields (entry, stop, tp1, tp2).
 * Display formatting ("$120.50") is the caller's responsibility — data layer never adds "$".
 *
 * Signal shape: { ticker, score, strategy, entry, stop, tp1, tp2, rr, sharia, thesis }
 *   entry/stop/tp1/tp2 = number | null
 *   sharia = true | false | null (null = untagged legacy scan)
 */
'use strict';

const REGIME_RANK = { 'RISK-OFF': 0, 'EARLY RISK-OFF': 1, 'NEUTRAL': 2, 'RECOVERY': 3, 'RISK-ON': 4 };

function scoreToRegime(score) {
  if (score >= 65) return 'RISK-ON';
  if (score >= 55) return 'RECOVERY';
  if (score >= 45) return 'NEUTRAL';
  if (score >= 38) return 'EARLY RISK-OFF';
  return 'RISK-OFF';
}

function adjustRegimeLabel(label, score) {
  if (score == null || !label) return label;
  const implied = scoreToRegime(score);
  const labelRank = REGIME_RANK[String(label).toUpperCase().trim()] ?? 2;
  const scoreRank = REGIME_RANK[implied] ?? 2;
  return labelRank > scoreRank ? implied : label;
}

const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { isHaramForHalalMode } = require('./sharia-filter');
const scoreContract = require('./score-contract');

const SCANNER_DIR = path.join(__dirname, '..', '..', 'scanner');

// ─── Price helpers ──────────────────────────────────────────────────────────

function parsePrice(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s > 0 ? s : null;
  const clean = String(s).replace(/[$,\s]/g, '').replace(/[–—]/g, '-');
  const nums = clean.split('-').map(Number).filter(n => n > 0);
  if (!nums.length) return null;
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// ─── PRIMARY: load from signals.json ────────────────────────────────────────

/**
 * Load signals for a scan directory. Tries signals.json first, falls back to HTML.
 * @param {string} dir — directory name like "20260414" (relative to scanner/)
 * @returns {{ signals: Array, thesis: Object }} or null
 */
function extractRegimeFromHtml(html) {
  if (!html) return null;
  const m = html.match(/\b(EARLY RISK-OFF|RISK-OFF|RISK-ON|NEUTRAL|RECOVERY)\b/);
  return m ? m[1] : null;
}

function loadSignalsRaw(dir) {
  const jsonPath = path.join(SCANNER_DIR, dir, 'signals.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const thesis = {};
      const mapSignal = s => {
        if (s.thesis) thesis[s.ticker] = s.thesis;
        return {
          ticker: s.ticker,
          // `s.score || 0` écrasait en 0 une ABSENCE de score déclarée (moteur dtx : les
          // stratégies de rotation n'en produisent pas, 41 ordres sur 64). Un 0 est un score —
          // il se compare, il se trie, il se seuille — alors que l'absence ne doit rien de tout
          // cela : elle doit rester visible jusqu'au consommateur, qui la traite explicitement
          // (cf. passesScoreGate/compareCandidates dans sweep.js). Le 0 de repli est conservé
          // pour tous les autres producteurs, dont aucun signal historique n'en dépend
          // (mesuré : 0 signal sur 1868 avec score absent ou nul hors dtx).
          score: s.score != null ? s.score : (s.scoreSource === 'none' ? null : 0),
          // Métadonnées du moteur dtx — même leçon que `universe` : un champ absent de cette
          // liste blanche est SILENCIEUSEMENT perdu, et le consommateur retombe sur un défaut.
          ...(s.scoreSource ? { scoreSource: s.scoreSource } : {}),
          ...(s.engineNotional != null ? { engineNotional: s.engineNotional } : {}),
          ...(s.engineRank != null ? { engineRank: s.engineRank } : {}),
          // POCHE du livre moteur. Elle porte les SORTIES de la position (take-profit et horizon
          // diffèrent d'une poche à l'autre) : la perdre ici ferait retomber le tracker sur les
          // réglages du mode, faux pour trois poches sur quatre, sans qu'aucun message ne le dise.
          ...(s.sleeve ? { sleeve: s.sleeve } : {}),
          strategy: s.strategy || '',
          entry: parsePrice(s.entry),
          entry_low: parsePrice(s.entry_low),
          entry_high: parsePrice(s.entry_high),
          stop: parsePrice(s.stop),
          tp1: parsePrice(s.tp1),
          tp2: parsePrice(s.tp2),
          rr: s.rr || '',
          sharia: s.sharia != null ? s.sharia : null,
          thesis: s.thesis || '',
          // Preserve fields used by validate-scan.js blocking rules
          region: s.region || null,
          market_cap: s.market_cap != null ? Number(s.market_cap) : null,
          extension: s.extension || null,
          earnings_clear: s.earnings_clear,
          dilution_clear: s.dilution_clear,
          earnings_source: s.earnings_source || null,
          earnings_forward_evidence: s.earnings_forward_evidence || null,
          issuer_filing_regime: s.issuer_filing_regime || null,
          dilution_scope: s.dilution_scope || null,
          sec_evidence: s.sec_evidence || null,
          selection_evidence: s.selection_evidence || null,
          horizon: s.horizon,
          name: s.name,
          pattern: s.pattern || null,
          // universe tag used by gen-status-page signalsFor universeFilter (highvol=americanbull,
          // etf=etf). Stripping it dropped ALL signals for universe-filtered modes (0 signals bug).
          universe: s.universe || null,
          // sector — used by validate-scan.js candlestick_missing_sector rule and the
          // diversification.max_per_sector overlay. Was silently dropped here (not in this
          // whitelist), so candlestick-scanner.js's emitted sector never reached validate-scan
          // no matter what it wrote to signals.json.
          sector: s.sector || null,
          // tp1_atr_multiple — lu par le gate tp1_atr_multiple_coherence de validate-scan.js,
          // qui recalcule (tp1 − entry)/atr et refuse un écart > 0,01. Absent de cette liste,
          // le champ n'atteignait jamais le gate : la valeur ÉCRITE dans signals.json pouvait
          // être fausse sans que rien ne le dise (5 lignes sur 7 le 2026-08-10).
          tp1_atr_multiple: s.tp1_atr_multiple != null ? s.tp1_atr_multiple : null,
        };
      };
      const baseSignals = (data.signals || []).map(mapSignal);
      // Strategy-specific pools (multi-list format: momentum[], breakout[], etc.)
      const STRATEGY_POOLS = ['momentum', 'breakout', 'pullback', 'pre_squeeze', 'bull'];
      const strategyPools = {};
      const seenTickers = new Set(baseSignals.map(s => s.ticker));
      for (const pool of STRATEGY_POOLS) {
        strategyPools[pool] = (data[pool] || []).map(mapSignal);
      }
      // Merge strategy pools into signals for backward compat (dedup by ticker)
      const signals = [...baseSignals];
      for (const pool of STRATEGY_POOLS) {
        for (const s of strategyPools[pool]) {
          if (!seenTickers.has(s.ticker)) {
            signals.push(s);
            seenTickers.add(s.ticker);
          }
        }
      }
      const tklPool = (data.tkl_pool || []).map(s => {
        const m = mapSignal(s);
        m.source = 'tkl_pool';
        return m;
      });
      // Asset-class pools (crypto/metals/forex) — each tagged with its source for per-mode filtering.
      const poolFrom = key => (data[key] || []).map(s => { const m = mapSignal(s); m.source = key; return m; });
      const cryptoPool = poolFrom('crypto_pool');
      const metalsPool = poolFrom('metals_pool');
      const forexPool = poolFrom('forex_pool');
      const casablancaPool = poolFrom('casablanca_pool');
      // eu_smallcap_pool: EU small/mid-cap PEA-eligible momentum, PRODUCED BY THE AGENT VIA MCP
      // (like the top-10 / dtx staging — NEVER by a node subprocess). Universe-gated
      // (universe:'eu_smallcap') + source-tagged 'eu_smallcap_pool' so it feeds ONLY the
      // eu_smallcap mode and is excluded from every US equity portfolio (see sweep ASSET_POOL_SOURCES).
      // NOT merged into signals[] → validate-scan.js editorial rules never see it (correct: PEA
      // small-caps legitimately breach the $5 penny floor / mcap floor by design).
      const euSmallcapPool = poolFrom('eu_smallcap_pool');
      // factor_pool: low-turnover multi-factor US basket (factor-scanner.js). Self-contained
      // holdings for the `factor` mode (assetClass us_factor) — consumed like the asset pools.
      const factorPool = poolFrom('factor_pool');
      // Event-driven pools (pead/filings/gap) — SAME source-tagged pattern as forex_pool. Each
      // feeds ONLY its dedicated asset-class mode (assetClass pead/filings/gap), NEVER merged into
      // the signals[] composite. filings_flags = per-ticker dilution disqualifiers written by
      // filings-scanner.js, exposed so the OTHER pools' validation can reject a diluted candidate.
      const peadPool = poolFrom('pead_pool');
      const filingsPool = poolFrom('filings_pool');
      const gapPool = poolFrom('gap_pool');
      // dtx_pool: ordres CREATE du moteur systematic-tss (dtx-pool-bridge.js). Consommé
      // EXCLUSIVEMENT par les modes scriptés (assetClass 'dtx'), partitionné par mode via
      // `universe: <modeId>`. Même câblage source-taggé que les autres asset-pools.
      const dtxPool = poolFrom('dtx_pool');
      const filingsFlags = (data.filings_flags && typeof data.filings_flags === 'object') ? data.filings_flags : {};
      // Fortress-pm: source dédiée du mode Fortress + A+ (scan A+ Halal produit par le skill
      // fortress-pm, PAS le composite mom_bo). Tag strategy='FortressA+', exclu du mom_bo/all.
      // fortress_pool ABSENT (key missing — the fortress-pm skill didn't run/produce a pool for
      // this scan) → fallback to high-conviction scan signals (score>=92 AND sharia===true),
      // tagged FortressA+/source=fortress_fallback, so the Fortress/A+ panels aren't silently
      // empty on days the LLM skill step was skipped. fortress_pool PRESENT but EMPTY ([]) is a
      // legitimate "0 signals today" from the skill — NO fallback in that case (both fortress and
      // aplus consume this exact same array, so both stay consistent).
      const hasFortressPool = Object.prototype.hasOwnProperty.call(data, 'fortress_pool');
      let fortressPool, fortressPoolSource;
      if (hasFortressPool) {
        fortressPool = poolFrom('fortress_pool');
        fortressPoolSource = 'fortress_pool';
      } else {
        // Sharia compliance — FAIL-CLOSED: a Halal-mandated mode (aplus/fortress) must NEVER
        // surface a name that wasn't EXPLICITLY vetted Halal. The scanner now stamps an explicit
        // `sharia:true` on compliant rows (real ratio screen at generation), so we require
        // `s.sharia === true` here — sharia=null/false/undefined are rejected. isHaramForHalalMode()
        // stays as a second, redundant guard (shared source of truth with sweep.js/gen-status-page.js).
        // Consequence: on a scan where no score>=92 signal is stamped Halal, the fallback is EMPTY —
        // that is correct (0 A+ Halal today) and infinitely safer than leaking a haram name (SEZL/RTX/…).
        fortressPool = signals
          .filter(s => (s.score || 0) >= 92 && s.sharia === true && !isHaramForHalalMode(s))
          .map(s => ({ ...s, strategy: 'FortressA+', source: 'fortress_fallback' }));
        fortressPoolSource = 'fortress_fallback';
        console.log(`[scanner-parser] ${dir}: fortress_pool absent from scan (fortress-pm skill not run) — fallback to ${fortressPool.length} scan signal(s) with score>=92 & sharia-compliant (source=fortress_fallback)`);
      }
      // regimeScore: numeric regime strength (0-100). Used by the regime-score override
      // (proactive de-risk when the score deteriorates even if the label still says RISK-ON).
      const regimeScore = (data.regimeScore ?? data.regime_score ?? null);
      return { signals, strategyPools, tklPool, cryptoPool, metalsPool, forexPool, casablancaPool, euSmallcapPool, factorPool, peadPool, filingsPool, gapPool, dtxPool, filingsFlags, fortressPool, fortressPoolSource, thesis, regime: data.regime || 'EARLY RISK-OFF', regimeScore };  // fail-closed: null regime defaults to ERO (defensive)
    } catch (_) { /* fall through to HTML */ }
  }

  // FALLBACK: parse HTML (legacy scans without signals.json)
  const htmlPath = path.join(SCANNER_DIR, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const raw = parseScannerHtml(html);
  const thesisMap = parseThesisMap(html);
  // Normalize HTML-parsed signals to numbers
  const signals = raw.map(s => ({
    ...s,
    entry: parsePrice(s.entry),
    stop: parsePrice(s.stop),
    tp1: parsePrice(s.tp1),
    tp2: parsePrice(s.tp2),
    thesis: thesisMap[s.ticker] || '',
  }));
  const regime = extractRegimeFromHtml(html);
  return { signals, tklPool: [], cryptoPool: [], metalsPool: [], forexPool: [], casablancaPool: [], euSmallcapPool: [], factorPool: [], peadPool: [], filingsPool: [], gapPool: [], dtxPool: [], filingsFlags: {}, thesis: thesisMap, regime, regimeScore: null };
}

// ─── LEGACY: HTML parsers (kept for old scans without signals.json) ─────────

function parseSynthese(html) {
  if (!html) return [];
  const block = html.match(new RegExp(`id="(?:synthese|summary)"[\\s\\S]{0,${cfg.SYNTHESE_MATCH_LEN}}`));
  if (!block) return [];
  const rows = block[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const signals = [];
  for (const row of rows) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(c => decodeEntities(stripTags(c)).replace(/,/g, '.').trim());
    if (cells.length < 4) continue;
    const ticker = cells.find(c => cfg.RE_TICKER.test(c.trim()));
    if (!ticker) continue;
    const score = cells.map(c => parseFloat(c)).find(n => n >= cfg.SCORE_RANGE_VALID[0] && n <= cfg.SCORE_RANGE_VALID[1]);
    const stratRaw = cells.find(c => cfg.RE_STRATEGY.test(c)) || '';
    const pf = cells.filter(c => cfg.RE_PRICE_CELL.test(c.trim()));
    const rr = cells.find(c => cfg.RE_RR.test(c)) || '';
    const trAttrs = row.match(/<tr([^>]*)>/i);
    const shariaAttr = trAttrs && trAttrs[1] ? trAttrs[1].match(/data-sharia="(true|false)"/i) : null;
    const sharia = shariaAttr ? shariaAttr[1] === 'true' : null;
    signals.push({
      ticker: ticker.trim(), score: score || 0, strategy: stratRaw.trim(),
      entry: pf[0] || null, stop: pf[1] || null, tp1: pf[2] || null, tp2: pf[3] || null,
      rr, sharia,
    });
  }
  return signals;
}

function parseSetupCards(html) {
  if (!html) return [];
  const re = /class="setup-card"\s+id="setup-([A-Z]{1,5})"([^>]*)>/gi;
  const signals = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const ticker = m[1];
    const attrs = m[2];
    const pick = re2 => { const match = attrs.match(re2); return match ? parseFloat(match[1]) : null; };
    const entry = pick(/data-entry="([\d.]+)"/);
    const stop = pick(/data-stop="([\d.]+)"/);
    const tp1 = pick(/data-tp1="([\d.]+)"/);
    const tp2 = pick(/data-tp2="([\d.]+)"/);
    if (entry == null || stop == null || tp1 == null) continue;
    const shariaCard = attrs.match(/data-sharia="(true|false)"/i);
    const sharia = shariaCard ? shariaCard[1] === 'true' : null;
    signals.push({ ticker, score: 85, strategy: '', entry, stop, tp1, tp2, rr: '', sharia });
  }
  return signals;
}

function parseScannerHtml(html) {
  // Prefer setup-cards (data-* attributes are unambiguous).
  // Fall back to synthese table only when no cards present (very old scans).
  // Merge: cards give clean entry/stop/tp1/tp2/sharia; synthese fills score+strategy.
  const cards = parseSetupCards(html);
  if (cards.length) {
    const synth = parseSynthese(html);
    const synthMap = {};
    for (const s of synth) synthMap[String(s.ticker).toUpperCase()] = s;
    const merged = cards.map(c => {
      const s = synthMap[c.ticker.toUpperCase()] || {};
      return {
        ...c,
        score: s.score || c.score || 85,
        // Strip trailing " x2"/" X10" multiplier suffix only when it ends the string (word-boundary)
        strategy: (s.strategy || c.strategy || '').replace(/\s+x\d+\b\s*$/i, '').trim(),
        rr: s.rr || c.rr || '',
        sharia: c.sharia != null ? c.sharia : (s.sharia != null ? s.sharia : null),
      };
    });
    return merged.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  return parseSynthese(html).sort((a, b) => (b.score || 0) - (a.score || 0));
}

function parseThesisMap(html) {
  if (!html) return {};
  const map = {};
  const blocks = html.match(/id="setup-([A-Z]{1,5})"[\s\S]*?(?=id="setup-[A-Z]|id="synthese|id="summary|$)/gi) || [];
  for (const block of blocks) {
    const tm = block.match(/id="setup-([A-Z]{1,5})"/i);
    const thM = block.match(/Investment Thesis<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
    if (tm && thM && !map[tm[1]]) {
      let thesis = decodeEntities(stripTags(thM[1])).replace(/\s+/g, ' ').trim();
      if (thesis.length > cfg.THESIS_MAX_LEN) thesis = thesis.slice(0, cfg.THESIS_MAX_LEN - 3).replace(/\s+\S*$/, '') + '…';
      map[tm[1].toUpperCase()] = thesis;
    }
  }
  return map;
}

// ─── CONTRAT DE SCORE (tools/lib/score-contract.js) ─────────────────────────
// `loadSignals` est LE point de chargement partagé (sweep, pit-engine, gen-status-page,
// validate-scan, gen-scanner-notifications…). C'est donc ici qu'on tamponne la métadonnée
// d'échelle sur CHAQUE signal et qu'on hurle si un producteur sort de sa plage déclarée.
//
// Ce qui est fait :  ajout des champs `scoreFamily` / `scoreScale` / `scoreBounded` /
//                    `scoreUnit` (purement ADDITIF — `score` n'est jamais touché) + garde.
// Ce qui n'est PAS fait : aucun filtrage, aucun tri, aucune normalisation implicite. Aucun
//                    résultat de replay ne bouge du fait de ce module.
//
// La garde respecte l'env SCORE_CONTRACT (warn par défaut, strict = lève). Elle est
// DÉLIBÉRÉMENT posée en DEHORS du try/catch du parseur JSON : à l'intérieur, un throw serait
// avalé par le `catch (_) { fall through to HTML }` et la violation disparaîtrait en silence —
// exactement le mode de défaillance que ce contrat existe pour supprimer.
const CONTRACT_POOL_KEYS = [
  ['signals', 'signals[]'], ['tklPool', 'tkl_pool'], ['cryptoPool', 'crypto_pool'],
  ['metalsPool', 'metals_pool'], ['forexPool', 'forex_pool'], ['casablancaPool', 'casablanca_pool'],
  ['euSmallcapPool', 'eu_smallcap_pool'], ['factorPool', 'factor_pool'], ['peadPool', 'pead_pool'],
  ['filingsPool', 'filings_pool'], ['gapPool', 'gap_pool'], ['dtxPool', 'dtx_pool'],
  ['fortressPool', 'fortress_pool'],
];

function loadSignals(dir) {
  const loaded = loadSignalsRaw(dir);
  if (!loaded) return loaded;
  for (const [key, label] of CONTRACT_POOL_KEYS) {
    const arr = loaded[key];
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      scoreContract.stamp(s);
      scoreContract.guardSignal(s, `${dir}:${label}`);
    }
  }
  // `signals[]` est le composite que TOUS les consommateurs en aval seuillent (`minScore`) et
  // trient (`b.score - a.score`) en bloc. S'il mélange des familles, ce seuil et ce tri sont
  // dénués de sens — on le signale ici, une fois, au chargement.
  if (Array.isArray(loaded.signals)) {
    scoreContract.guardComparable(loaded.signals, `${dir}:signals[] (seuil minScore + tri)`);
  }
  return loaded;
}

module.exports = {
  loadSignals,
  loadSignalsRaw,
  parsePrice,
  parseSynthese,
  parseSetupCards,
  scoreToRegime,
  adjustRegimeLabel,
  parseScannerHtml,
  parseThesisMap,
  extractRegimeFromHtml,
  stripTags,
  decodeEntities,
};
