#!/usr/bin/env node
'use strict';

/**
 * regime-reconcile — canonical marketdata regime, with explicit source contracts.
 *
 * node tools/regime-reconcile.js --dir scanner/YYYYMMDD --refdate YYYY-MM-DD [--json]
 *
 * Authority: switcher_analyzer on declared 0-1_risk_on, either historical overview.regime
 * or exact facets.regime.dtx_regime in regime_authority.json. The compact path requires
 * model_status=ok and exact, contiguous coverage of all six US benchmarks at refdate.
 * The context_conditional parent uses the inverse defensiveness scale and is NEVER
 * authoritative. A malformed authority cannot silently fall through to an older source.
 * Systematic, when available, remains a separate configured comparison.
 * Output score is bullish_0_100; model degradation warnings remain visible.
 */

const fs = require('fs');
const path = require('path');
const { isUSTradingDay, usTradingDaysBetween } = require('./lib/market-calendar');
const { loadScannerScope } = require('./lib/scanner-scope');

const ROOT = path.resolve(__dirname, '..');
const FILTERS = path.join(ROOT, 'data', 'scanner-filters.json');

const LABEL_CANON = {
  RISK_ON: 'RISK-ON', 'RISK-ON': 'RISK-ON', RISKON: 'RISK-ON',
  NEUTRAL: 'NEUTRAL',
  EARLY_RISK_OFF: 'EARLY RISK-OFF', 'EARLY-RISK-OFF': 'EARLY RISK-OFF', 'EARLY RISK-OFF': 'EARLY RISK-OFF',
  RISK_OFF: 'RISK-OFF', 'RISK-OFF': 'RISK-OFF', CRISIS: 'RISK-OFF',
  RECOVERY: 'RECOVERY',
};
const RANK = { 'RISK-OFF': 0, 'EARLY RISK-OFF': 1, NEUTRAL: 2, RECOVERY: 3, 'RISK-ON': 4 };

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}

function canonLabel(raw) {
  if (raw == null) return null;
  const k = String(raw).toUpperCase().trim().replace(/\s+/g, '_');
  return LABEL_CANON[k] || LABEL_CANON[String(raw).toUpperCase().trim()] || null;
}

/** Ramène n'importe quelle convention connue vers 0-100 « haut = risk-on ». */
function toBullish100(score, scaleHint) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const s = Number(score);
  if (scaleHint === 'defensiveness_0_100') return 100 - s;
  if (scaleHint === 'bullish_0_1') return s * 100;
  if (scaleHint === 'bullish_0_100') return s;
  return null; // jamais de devinette : une échelle non déclarée est une échelle inconnue
}

function unwrap(v) { return v && v.result && typeof v.result === 'object' ? v.result : v; }

function readSystematic(dir) {
  const p = path.join(dir, '_data', 'regime_systematic.json');
  if (!fs.existsSync(p)) return { ok: false, why: 'regime_systematic.json absent' };
  const r = unwrap(JSON.parse(fs.readFileSync(p, 'utf8')));
  const label = canonLabel(r.regime);
  // DtxRegime publie regime_score sur 0-1.
  const bullish = toBullish100(r.regime_score, 'bullish_0_1');
  if (!label || bullish == null) return { ok: false, why: `payload systematic illisible (regime=${r.regime}, score=${r.regime_score})` };
  return {
    ok: true, label, bullish, raw: r.regime_score, scale: 'bullish_0_1',
    dataAsof: r.data_asof || r.last_data_date || null,
    sessionsBehind: r.sessions_behind ?? null,
    vix: r.vix_level ?? null,
    components: {
      spx: r.spx_score ?? null, vix: r.vix_score ?? null, credit: r.credit_score ?? null,
      dxy: r.dxy_score ?? null, tlt: r.tlt_score ?? null, liquidity: r.liquidity_score ?? null,
    },
  };
}

/** Authority may be overview.regime or the exact compact facets.regime.dtx_regime.
 * The parent context_conditional regime is informative only, on the inverse scale.
 * A present but invalid authority file never falls through to another source.
 */
const US_BENCHMARKS = Object.freeze({ spx: '^GSPC', vix: '^VIX', dxy: 'DX-Y.NYB', hyg: 'HYG', lqd: 'LQD', tlt: 'TLT' });
const isoDay = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const day = value.slice(0, 10);
  return new Date(day).toISOString().slice(0, 10) === day ? day : null;
};
function authorityWarnings(item) {
  const warnings = Array.isArray(item.warnings) ? [...item.warnings] : [];
  const cfg = item.dtx_config || {};
  if (cfg.total_return === false || cfg.total_return_status) warnings.push(`Dividendes / total return : ${cfg.total_return_status || 'total_return=false; barres non ajustées des dividendes.'}`);
  if (cfg.vix_score_degraded) warnings.push(`VIX : ${cfg.vix_score_degraded}`);
  const btc = item.dtx_detail?.benchmark_coverage?.btc;
  if (btc && btc.end !== isoDay(item.as_of)) warnings.push(`BTC : couverture arrêtée au ${btc.end}, référence US ${isoDay(item.as_of)}; composante de liquidité décalée.`);
  if (item.dtx_detail?.liquidity_included && !btc) warnings.push('BTC : couverture de la composante de liquidité absente.');
  return [...new Set(warnings)];
}
function compactAuthority(root, refdate) {
  const facet = root.facets?.regime;
  const item = facet?.dtx_regime;
  const issues = [];
  if (!refdate || isoDay(refdate) !== refdate) issues.push('refdate exacte requise pour la voie compacte');
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, authoritative: false, why: 'facets.regime.dtx_regime absent ou invalide' };
  if (root.status !== 'completed' || facet.status !== 'completed') issues.push('réponse/facette non completed');
  if (item.engine !== 'switcher_analyzer') issues.push('engine doit être switcher_analyzer');
  if (item.model !== 'dtx') issues.push('model doit être dtx');
  if (item.scale !== '0-1_risk_on') issues.push('scale doit être 0-1_risk_on');
  if (item.model_status !== 'ok') issues.push('model_status doit être ok');
  if (item.region !== 'US') issues.push('region doit être US');
  const label = canonLabel(item.regime);
  if (!label) issues.push('label de régime inconnu');
  if (typeof item.regime_score !== 'number' || !Number.isFinite(item.regime_score) || item.regime_score < 0 || item.regime_score > 1) issues.push('regime_score doit être numérique entre 0 et 1');
  if (isoDay(item.as_of) !== refdate || isoDay(facet.as_of) !== refdate) issues.push('as_of du modèle/de la facette différent de refdate');
  for (const [key, symbol] of Object.entries(US_BENCHMARKS)) {
    const c = item.dtx_detail?.benchmark_coverage?.[key];
    if (!c) { issues.push(`couverture ${key} absente`); continue; }
    if (item.benchmarks?.[key] !== symbol || c.symbol !== symbol) issues.push(`benchmark ${key} incorrect`);
    if (c.calendar !== 'us_equity' || c.end !== refdate || c.contiguous !== true || c.missing_sessions !== 0) issues.push(`couverture ${key} non exacte/contiguë à refdate`);
    if (!Number.isInteger(c.bars) || c.bars <= 0 || c.bars !== c.expected_sessions) issues.push(`couverture ${key}: bars/expected_sessions incohérents`);
    try {
      if (isoDay(c.start) !== c.start || !isUSTradingDay(c.start) || !isUSTradingDay(c.end) || c.start > c.end
        || usTradingDaysBetween(c.start, c.end) + 1 !== c.expected_sessions) issues.push(`couverture ${key}: calendrier de séances incohérent`);
    } catch (e) { issues.push(`couverture ${key}: calendrier invalide (${e.message})`); }
  }
  if (item.dtx_detail?.liquidity_included === true) {
    const btc = item.dtx_detail.benchmark_coverage?.btc;
    // BTC trades 24/7. Its bar must be the last UTC day fully completed BEFORE as_of,
    // not the equity reference session or a newer day captured when the tool was called.
    const asOf = new Date(item.as_of);
    const expectedEnd = Number.isFinite(asOf.getTime())
      ? new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()) - 86400000).toISOString().slice(0, 10) : null;
    if (!btc) issues.push('couverture btc absente alors que liquidité incluse');
    else {
      if (item.benchmarks?.btc !== 'BTC-USD' || btc.symbol !== 'BTC-USD') issues.push('benchmark btc incorrect');
      if (btc.calendar !== 'daily_247' || btc.contiguous !== true || btc.missing_sessions !== 0) issues.push('couverture btc non quotidienne/contiguë');
      if (!expectedEnd || btc.end !== expectedEnd) issues.push(`couverture btc: dernière journée UTC complète attendue ${expectedEnd}, reçue ${btc.end}`);
      const validDates = isoDay(btc.start) === btc.start && isoDay(btc.end) === btc.end && btc.start <= btc.end;
      const expectedCount = validDates ? (Date.parse(btc.end) - Date.parse(btc.start)) / 86400000 + 1 : null;
      if (!validDates || !Number.isInteger(btc.bars) || btc.bars <= 0 || btc.bars !== btc.expected_sessions || btc.expected_sessions !== expectedCount) issues.push('couverture btc: dates/comptes de journées UTC incohérents');
    }
  }
  if (issues.length) return { ok: false, authoritative: false, why: issues.join(' | '), warnings: authorityWarnings(item) };
  return { ok: true, authoritative: true, label, bullish: item.regime_score * 100,
    raw: item.regime_score, scale: 'bullish_0_1', engine: 'facets.regime.dtx_regime',
    modelEngine: item.engine, model: item.model, modelStatus: item.model_status,
    dataAsof: isoDay(item.as_of), confidence: item.confidence ?? null, probabilities: null,
    benchmarkCoverage: item.dtx_detail.benchmark_coverage, warnings: authorityWarnings(item) };
}

function findOverviewRegime(root) {
  let found = null;
  const walk = value => {
    if (found || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const isRegimeItem = value.type === 'regime'
      || (value.regime_score !== undefined && (value.regime !== undefined || value.sma_regime !== undefined));
    if (isRegimeItem && Number(value.regime_score) <= 1) { found = value; return; }
    for (const key of Object.keys(value)) if (key !== 'facets') walk(value[key]);
  };
  walk(root);
  return found;
}

function readMarketdata(dir, refdate = null) {
  // 1) source canonique : le bloc regime embarqué dans overview (0-1, haut = risk-on)
  // `regime_authority` est l'appel REQUIS de la vague 1 ; `overview` est l'ancien appel
  // détaché, conservé en second parce qu'il peut porter le même bloc quand il aboutit.
  const candidates = ['regime_authority.json', 'overview.json']
    .map(name => path.join(dir, '_data', name))
    .filter(fs.existsSync);
  for (const overviewPath of candidates) {
    let root;
    try { root = unwrap(JSON.parse(fs.readFileSync(overviewPath, 'utf8'))); }
    catch (e) { return { ok: false, authoritative: false, why: `autorité illisible : ${e.message}` }; }
    // Presence of the compact envelope selects exactly this contract. Do not recursively
    // pick the parent score (often zero) or a nested decoy, or fall back to old overview.
    if (Object.prototype.hasOwnProperty.call(root || {}, 'facets')) {
      if (path.basename(overviewPath) !== 'regime_authority.json') return { ok: false, authoritative: false, why: 'voie compacte requise dans regime_authority.json' };
      return compactAuthority(root, refdate);
    }
    const item = findOverviewRegime(root);
    if (item) {
      const label = canonLabel(item.regime || item.state || item.current_state);
      const validScore = typeof item.regime_score === 'number' && Number.isFinite(item.regime_score) && item.regime_score >= 0 && item.regime_score <= 1;
      // Preserve the original overview payload, whose historical contract predates
      // model_status/benchmark_coverage. Its declared engine and scale remain mandatory.
      if (label && validScore && item.engine === 'switcher_analyzer' && item.scale === '0-1_risk_on'
        && (!refdate || isoDay(item.as_of) === refdate)) {
        return {
          ok: true, authoritative: true, label, bullish: item.regime_score * 100, raw: item.regime_score, scale: 'bullish_0_1',
          engine: 'overview.regime', modelEngine: item.engine, dataAsof: isoDay(item.as_of), confidence: item.confidence ?? null,
          probabilities: null, warnings: authorityWarnings(item),
        };
      }
    }
    return { ok: false, authoritative: false, why: `${path.basename(overviewPath)} ne porte pas une autorité overview valide à refdate; aucun repli silencieux` };
  }

  // 2) repli : la facette `regime`, d'échelle INVERSE. Jamais mélangée avec la précédente.
  const p = path.join(dir, '_data', 'regime_marketdata.json');
  if (!fs.existsSync(p)) return { ok: false, why: 'ni overview.regime ni regime_marketdata.json' };
  const root = unwrap(JSON.parse(fs.readFileSync(p, 'utf8')));
  const f = (root.facets && root.facets.regime) || root.regime || root;
  const label = canonLabel(f.regime || f.current_state);
  // Contrat cible (alignement demandé au propriétaire marketdata) : mêmes champs que
  // DtxRegime, donc `regime` + `regime_score` 0-1 haut = risk-on. Tant que l'ancien
  // schéma `regime.v1` circule, on lit son échelle DÉCLARÉE — jamais une supposition.
  // L'ordre des tests compte : « defensiveness » d'abord. Un `/0-1/` naïf matche à
  // l'intérieur de « 0-100 » et classait l'échelle défensivité en bullish_0_1 — donc
  // lisait 0 comme « plein risk-off » alors que 0 veut dire « plein risk-on ».
  let bullish = null, scale = null;
  const declared = String(f.scale || '');
  if (f.regime_score != null) {
    if (/defensiveness/i.test(declared)) scale = 'defensiveness_0_100';
    else if (Number(f.regime_score) <= 1) scale = 'bullish_0_1';
    else scale = 'bullish_0_100';
    bullish = toBullish100(f.regime_score, scale);
  }
  // `authoritative: false` — ce moteur n'est PAS celui que l'autorité désigne. Le laisser
  // fournir le score publié reviendrait à écrire 100/100 là où overview.regime dit 77,2 :
  // un repli silencieux qui change le chiffre d'un facteur 1,3. On le rend disponible pour
  // information, jamais comme source du régime publié.
  return {
    ok: Boolean(label), authoritative: false,
    label, bullish, raw: f.regime_score ?? null, scale,
    engine: 'facets=regime (échelle INVERSE, repli non-autoritaire)',
    confidence: f.current_state_confidence ?? f.confidence ?? null,
    probabilities: f.probabilities || null,
    warnings: f.warnings || [],
    why: label ? null : `label marketdata illisible (${f.regime || f.current_state})`,
  };
}

function main() {
  const dirArg = arg('--dir');
  if (!dirArg) { console.error('usage: node tools/regime-reconcile.js --dir scanner/YYYYMMDD [--refdate D] [--scope=scanner/YYYYMMDD/_scope.json] [--json]'); process.exit(2); }
  const dir = path.resolve(ROOT, dirArg);
  if (!dir.startsWith(ROOT)) { console.error('chemin hors dépôt refusé'); process.exit(2); }
  const refdate = arg('--refdate');
  const filters = JSON.parse(fs.readFileSync(FILTERS, 'utf8'));
  const cfg = filters.regime_labels || {};
  // `??` traiterait un `null` explicite comme « absent » et retomberait sur 15 : c'est ce qui
  // maintenait le blocage après le passage de la tolérance à null. Un null CONFIGURÉ veut dire
  // « pas de seuil », pas « valeur par défaut ».
  const tol = Object.prototype.hasOwnProperty.call(cfg, 'max_bullish_divergence_pts')
    ? cfg.max_bullish_divergence_pts
    : 15;

  const scope = loadScannerScope(ROOT);
  if (scope.active && (path.resolve(ROOT, path.dirname(scope.audit.path)) !== fs.realpathSync(dir) || scope.audit.refdate !== refdate)) {
    throw new Error('Scope must match the reconciled scanner directory and refdate');
  }
  const sys = scope.active ? { ok: false, excluded: true, why: 'DTX explicitement exclu par le périmètre autorisé' } : readSystematic(dir);
  const md = readMarketdata(dir, refdate);
  const blockers = [], notes = [];

  // Autorité = marketdata (décision propriétaire 2026-09-06). systematic devient le
  // contradicteur informatif : il n'a plus de pouvoir de blocage.
  if (!md.ok) blockers.push(`autorité marketdata indisponible — ${md.why}`);
  else if (!md.authoritative) {
    blockers.push('autorité overview.regime ou facets.regime.dtx_regime absente du staging — '
      + 'le moteur context_conditional reste non autoritaire; collecter la source requise et relancer.');
  }
  if (sys.excluded) notes.push(`contradicteur systematic exclu — ${sys.why}; ancien fichier non lu.`);
  else if (!sys.ok) notes.push(`contradicteur systematic indisponible — ${sys.why}`);
  if (sys.ok && refdate && sys.dataAsof && sys.dataAsof !== refdate) {
    blockers.push(`systematic data_asof=${sys.dataAsof} != refdate ${refdate}`);
  }
  if (sys.ok && sys.sessionsBehind != null && Number(sys.sessionsBehind) !== 0) {
    blockers.push(`systematic sessions_behind=${sys.sessionsBehind} (attendu 0)`);
  }

  if (!md.ok) {
    notes.push(`autorité indisponible — ${md.why}. Aucun régime publiable.`);
  } else if (sys.ok) {
    if (md.label !== sys.label) {
      notes.push(`⚠ désaccord de label : marketdata=${md.label} vs systematic=${sys.label} — le régime publié reste celui de marketdata, mais dis-le dans le texte.`);
    }
    if (md.bullish == null) {
      notes.push('score marketdata sans échelle exploitable.');
    } else {
      const gap = Math.abs(md.bullish - sys.bullish);
      const verdict = tol == null ? 'informatif, non bloquant'
        : gap > tol ? `AU-DELÀ de la tolérance ${tol}` : `dans la tolérance ${tol}`;
      notes.push(`écart de score ${gap.toFixed(1)} pts — ${verdict} (marketdata ${md.bullish.toFixed(1)} vs systematic ${sys.bullish.toFixed(1)} sur 100 bullish).`);
      if (tol != null && gap > tol) blockers.push(`écart de score ${gap.toFixed(1)} pts > tolérance ${tol}`);
    }
    if (md.confidence != null && Number(md.confidence) < 0.6) {
      notes.push(`confiance marketdata ${md.confidence} — le contradicteur n'a pas d'avis tranché ; ne pas surjouer la conviction dans le texte publié.`);
    }
  }
  for (const w of (md.warnings || [])) notes.push(`avertissement marketdata : ${w}`);

  const out = {
    ok: blockers.length === 0,
    authority: `marketdata (${md.engine || 'inconnu'})`,
    regime: md.ok && md.authoritative ? md.label : null,
    regimeScore: md.ok && md.authoritative && md.bullish != null ? +md.bullish.toFixed(1) : null,
    regimeScoreScale: cfg.canonical_scale || 'bullish_0_100',
    dataAsof: md.dataAsof || null,
    crossCheck: sys.ok ? { source: 'systematic.DtxRegime', label: sys.label, bullish: +sys.bullish.toFixed(1) } : null,
    blockers, notes, scope: scope.audit,
  };

  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(out.ok ? 0 : 1); }

  console.log(`[regime] autorité ${out.authority} — ${out.regime} ${out.regimeScore}/100 (${out.regimeScoreScale}), data_asof ${out.dataAsof || 'inconnu'}`);
  if (out.crossCheck) console.log(`[regime] contradicteur ${out.crossCheck.source} — ${out.crossCheck.label} ${out.crossCheck.bullish ?? '?'}/100`);
  for (const n of notes) console.log(`  · ${n}`);
  for (const b of blockers) console.log(`  ✗ ${b}`);
  console.log(out.ok ? '[regime] RÉCONCILIÉ' : '[regime] BLOQUÉ — ne pas publier ce régime');
  process.exit(out.ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { canonLabel, toBullish100, readSystematic, readMarketdata, compactAuthority, authorityWarnings };
