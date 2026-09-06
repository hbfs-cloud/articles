#!/usr/bin/env node
'use strict';

/**
 * regime-reconcile — une seule vérité de régime, et un contradicteur qui peut bloquer.
 *
 *   node tools/regime-reconcile.js --dir scanner/YYYYMMDD [--refdate YYYY-MM-DD] [--json]
 *
 * Le scanner collecte DEUX sources de régime en vague 1 (`_data/regime_systematic.json` et
 * `_data/regime_marketdata.json`) et n'en compare AUCUNE. En août 2026 elles ne parlaient même
 * pas la même langue : DtxRegime rendait `RISK_ON` / 0.79 sur une échelle 0-1 où haut = risk-on,
 * pendant que la facette marketdata rendait `risk_on` / 0 sur une échelle 0-100 de DÉFENSIVITÉ
 * où 0 = plein risk-on. Deux chiffres opposés pour le même état : n'importe quel câblage naïf
 * publiait une inversion de signe.
 *
 * Autorité : MARKETDATA (décision propriétaire 2026-09-06), via `overview.regime` — le seul de
 * ses deux moteurs qui soit comparable à DtxRegime. systematic devient le contradicteur
 * informatif et ne bloque plus rien : `max_bullish_divergence_pts: null` dans scanner-filters.
 * Un désaccord de label ou un écart de score sont signalés dans les notes, pour que le texte
 * publié n'affiche pas une conviction que la seconde source ne partage pas.
 *
 * Sortie : bloc `regime` canonique à écrire dans signals.json —
 *   { regime, regimeScore, regimeScoreScale: "bullish_0_100", ... }
 */

const fs = require('fs');
const path = require('path');

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

/**
 * ⚠️ marketdata expose DEUX moteurs de régime, de sens OPPOSÉ, et son propre schéma d'outil
 * dit « do not mix the two numerically » :
 *
 *   overview.regime  — switcher 5 états, regime_score 0-1, 1 = RISK-ON   ← l'autorité
 *   facets=regime    — classifieur probabiliste, 0-100 de DÉFENSIVITÉ, 0 = risk-on
 *
 * Le 2026-09-05, un contrôle branché sur le second a produit un faux écart de 21 points contre
 * DtxRegime et bloqué un scan pour rien : marketdata disait 0 (= plein risk-on sur son échelle),
 * lu comme 0/100 bullish. Les deux moteurs concordent en réalité à 1,8 point (0,772 vs 0,79).
 * On lit donc `overview` en priorité, et on ne retombe sur la facette `regime` que faute de mieux,
 * en inversant explicitement son échelle.
 */
function findOverviewRegime(root) {
  let found = null;
  const walk = value => {
    if (found || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const isRegimeItem = value.type === 'regime'
      || (value.regime_score !== undefined && (value.regime !== undefined || value.sma_regime !== undefined));
    if (isRegimeItem && Number(value.regime_score) <= 1) { found = value; return; }
    for (const key of Object.keys(value)) walk(value[key]);
  };
  walk(root);
  return found;
}

function readMarketdata(dir) {
  // 1) source canonique : le bloc regime embarqué dans overview (0-1, haut = risk-on)
  const overviewPath = path.join(dir, '_data', 'overview.json');
  if (fs.existsSync(overviewPath)) {
    const item = findOverviewRegime(unwrap(JSON.parse(fs.readFileSync(overviewPath, 'utf8'))));
    if (item) {
      const label = canonLabel(item.regime || item.state || item.current_state);
      const bullish = toBullish100(item.regime_score, 'bullish_0_1');
      if (label && bullish != null) {
        return {
          ok: true, authoritative: true, label, bullish, raw: item.regime_score, scale: 'bullish_0_1',
          engine: 'overview.regime', confidence: item.confidence ?? null,
          probabilities: null, warnings: item.warnings || [],
        };
      }
    }
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
  if (!dirArg) { console.error('usage: node tools/regime-reconcile.js --dir scanner/YYYYMMDD [--refdate D] [--json]'); process.exit(2); }
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

  const sys = readSystematic(dir);
  const md = readMarketdata(dir);
  const blockers = [], notes = [];

  // Autorité = marketdata (décision propriétaire 2026-09-06). systematic devient le
  // contradicteur informatif : il n'a plus de pouvoir de blocage.
  if (!md.ok) blockers.push(`autorité marketdata indisponible — ${md.why}`);
  else if (!md.authoritative) {
    blockers.push('overview.regime absent du staging — seul le moteur `facets=regime` est disponible, '
      + "et son échelle est INVERSE : publier son score écrirait " + md.bullish.toFixed(0) + '/100 '
      + "là où l'autorité en dirait tout autre chose. Collecter GetMarketContext(facets=overview) "
      + 'et relancer.');
  }
  if (!sys.ok) notes.push(`contradicteur systematic indisponible — ${sys.why}`);
  if (sys.ok && refdate && sys.dataAsof && sys.dataAsof !== refdate) {
    blockers.push(`systematic data_asof=${sys.dataAsof} != refdate ${refdate}`);
  }
  if (sys.ok && sys.sessionsBehind != null && Number(sys.sessionsBehind) !== 0) {
    blockers.push(`systematic sessions_behind=${sys.sessionsBehind} (attendu 0)`);
  }

  if (!md.ok) {
    notes.push(`contradicteur indisponible — ${md.why}. Le régime est publié sans contre-épreuve.`);
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
    for (const w of (md.warnings || [])) notes.push(`avertissement marketdata : ${w}`);
  }

  const out = {
    ok: blockers.length === 0,
    authority: `marketdata (${md.engine || 'inconnu'})`,
    regime: md.ok ? md.label : null,
    regimeScore: md.ok && md.bullish != null ? +md.bullish.toFixed(1) : null,
    regimeScoreScale: cfg.canonical_scale || 'bullish_0_100',
    dataAsof: sys.dataAsof || null,
    crossCheck: sys.ok ? { source: 'systematic.DtxRegime', label: sys.label, bullish: +sys.bullish.toFixed(1) } : null,
    blockers, notes,
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
module.exports = { canonLabel, toBullish100, readSystematic, readMarketdata };
