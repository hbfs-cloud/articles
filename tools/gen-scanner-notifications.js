#!/usr/bin/env node
'use strict';

/**
 * gen-scanner-notifications.js
 *
 * Génère les notifications Telegram PAR MODE pour le scanner nocturne.
 * NE FAIT QUE GÉNÉRER — n'envoie rien. La routine cloud passe le tableau
 * produit à l'outil MCP Notification `send_batch`.
 *
 * Sources de données (toutes locales, ZÉRO token, reproductible en cloud) :
 *   - data/modes-config.json                 → liste des modes, status, config
 *   - portfolio/v1/<mode>/all.json           → stats, positions, closeNow, risk/regime
 *                                               (dérivé par gen-api.js du même snapshot
 *                                                que la page /scanner/status → cohérence garantie)
 *   - scanner/<latest>/signals.json          → le scan du jour (signaux + pools + régime)
 *
 * Chaque mode actif (status live|deploying) produit un objet :
 *   { to: "scanner-<alias>", format: "html", body: "<contenu HTML Telegram>" }
 *
 * Format Telegram OBLIGATOIRE : balises HTML (<b>, <i>, <a href>) + "\n",
 * JAMAIS de markdown (**bold**). Cf. CLAUDE.md « Format Telegram (OBLIGATOIRE) ».
 *
 * Usage :
 *   node tools/gen-scanner-notifications.js --dry-run           # imprime le JSON array
 *   node tools/gen-scanner-notifications.js --out               # écrit data/scanner-notifications.json
 *   node tools/gen-scanner-notifications.js 20260701 --dry-run  # scan précis
 *   node tools/gen-scanner-notifications.js --modes turbo,bull --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATUS_URL = 'https://articles.dailytickers.com/scanner/status/';

// ─── Mapping mode interne → alias Notification MCP (côté serveur) ──────────────
// Les 5 premiers alias sont pré-configurés (cf. CLAUDE.md). Orbit = id interne
// `secured`. bull/aplus suivent la convention scanner-<id> (à créer via set_alias
// si absents, sinon router vers `alerts`).
const ALIAS_MAP = {
  turbo:    'scanner-turbo',
  dynamic:  'scanner-dynamic',
  balanced: 'scanner-balanced',
  secured:  'scanner-orbit',     // Orbit = id interne secured
  fortress: 'scanner-fortress',
  bull:     'scanner-bull',
  aplus:    'scanner-aplus',
};

const MODE_EMOJI = {
  turbo: '🚀', dynamic: '🔥', balanced: '⚖️', secured: '🪐',
  fortress: '🏰', bull: '🐂', aplus: '💎',
};

const STATUS_LABEL = {
  live: 'Live',
  deploying: 'Déploiement (paper-ramp)',
};

// ─── Filtres stratégie (parité ANCRÉE avec SF de gen-status-page.js + STRATEGY_FILTERS_MAP
// de sweep.js). ⚠️ NE PAS utiliser de regex "substring" : `/momentum|breakout/i` matche
// "ETFMomentum", "MomentumRotation", "HighVolBreakout", "TrendlineBreakout" → les ETF/spécialistes
// (score 200-300) polluaient les candidats mom_bo surfacés (SBIO/SSK/BBC dans balanced). Les
// stratégies quality mécaniques sont EXACTEMENT "Momentum" et "Breakout" (ancrées ^...$). ──────
const SPECIALIST_RE = /^(MomentumRotation|HighVolBreakout|TrendlineBreakout|ETFMomentum|AdaptiveFractal|IndexRotation|candlestick|FortressA\+)$/i;
const STRAT_FILTER = {
  all:            s => s && !SPECIALIST_RE.test(s),
  no_sq:          s => !/short.?squeeze/i.test(s) && !SPECIALIST_RE.test(s),
  no_sq_pb:       s => !/short.?squeeze|pullback/i.test(s) && !SPECIALIST_RE.test(s),
  momentum_only:  s => /^Momentum$/i.test(s),
  breakout_only:  s => /^Breakout$/i.test(s),
  mom_bo:         s => /^(Momentum|Breakout)$/i.test(s),
  candlestick_only: s => /candlestick/i.test(s),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLatestScanDir() {
  const scannerDir = path.join(ROOT, 'scanner');
  return fs.readdirSync(scannerDir)
    .filter(d => /^\d{8}$/.test(d) && fs.existsSync(path.join(scannerDir, d, 'signals.json')))
    .sort().reverse()[0] || null;
}

function fmtDate(yyyymmdd) {
  if (!yyyymmdd) return '';
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

function regimeKey(regime) {
  return String(regime || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

// Nombre lisible : entier si entier, sinon 2 décimales (sans zéros superflus)
function num(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const v = +n;
  if (Number.isInteger(v)) return String(v);
  return (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
}

function sign(n) {
  return (+n >= 0 ? '+' : '') + num(n);
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ─── Chargement des données par mode ──────────────────────────────────────────
function loadModeData(modeKey) {
  return readJson(path.join(ROOT, 'portfolio', 'v1', modeKey, 'all.json')) || {};
}

// Sélection des signaux pertinents pour un mode donné, à partir du scan du jour.
// Renvoie { eligible: [...], context: string|null }.
function pickSignals(scan, cfg, modeKey) {
  const regime = regimeKey(scan.regime);
  const filterName = (cfg.regimeFilters && cfg.regimeFilters[regime]) || cfg.filterName || 'all';
  const minScore = cfg.minScore || 0;
  const topN = cfg.topN || cfg.portfolioSize || 3;

  // ── Bull : pool candlestick dédié (haute-conviction 8× volume) ──
  if (modeKey === 'bull') {
    const pool = (scan.bull || []).slice().sort((a, b) => b.score - a.score);
    return { eligible: pool.slice(0, topN), context: null, filterName, minScore };
  }

  // ── Fortress : PM Halal discrétionnaire → univers Sharia du jour ──
  if (modeKey === 'fortress') {
    const halal = (scan.signals || [])
      .filter(s => s.sharia === true)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(topN, 6));
    return { eligible: halal, context: null, filterName: 'sharia', minScore, discretionary: true };
  }

  // ── Modes equity mécaniques ──
  const strat = STRAT_FILTER[filterName] || STRAT_FILTER.all;
  const filtered = (scan.signals || [])
    .filter(s => strat(s.strategy || ''))
    .sort((a, b) => b.score - a.score);
  const eligible = filtered.filter(s => s.score >= minScore).slice(0, topN);

  let context = null;
  if (!eligible.length) {
    if (filtered.length) {
      const best = filtered[0];
      context = `Meilleur signal ${filterName} : ${best.ticker} (${num(best.score)}) — sous le seuil ${minScore}.`;
    } else {
      const overall = (scan.signals || []).slice().sort((a, b) => b.score - a.score)[0];
      context = overall
        ? `Scan dominé par d'autres setups — meilleur : ${overall.ticker} ${num(overall.score)} (${overall.strategy}), hors filtre ${filterName}.`
        : `Aucun signal exploitable aujourd'hui.`;
    }
  }
  return { eligible, context, filterName, minScore };
}

// ─── Rendu d'une ligne signal ─────────────────────────────────────────────────
function signalLine(s) {
  const bits = [`entrée ${num(s.entry)}`];
  if (s.stop) bits.push(`stop ${num(s.stop)}`);
  if (s.tp1) bits.push(`TP1 ${num(s.tp1)}`);
  const halal = s.sharia === true ? ' ☪' : '';
  const rr = s.rr ? `  R/R ${s.rr}` : '';
  return `🟢 <b>${s.ticker}</b> ${num(s.score)}${halal} · ${bits.join(' / ')}${rr}`;
}

// ─── Construction du corps HTML pour un mode ──────────────────────────────────
function buildBody(modeKey, cfg, data, scan, scanDir) {
  const emoji = MODE_EMOJI[modeKey] || '📊';
  const label = cfg.label || modeKey;
  const statusLbl = STATUS_LABEL[cfg.status] || cfg.status;
  const regime = scan.regime || '—';
  const regimeSc = scan.regimeScore != null ? ` (${num(scan.regimeScore)})` : '';

  const stats = data.stats || {};
  const positions = data.positions || [];
  const size = cfg.portfolioSize || positions.length;
  const closeNow = data.closeNow || [];
  const expiresTomorrow = data.expiresTomorrow || [];

  const L = [];

  // En-tête
  L.push(`${emoji} <b>${label} — Scanner ${fmtDate(scanDir)}</b>`);
  L.push(`Régime : <b>${regime}</b>${regimeSc}  ·  ${statusLbl}`);
  L.push('');

  // Performance depuis D0 (source = page status)
  if (stats.ret != null) {
    const parts = [`Rendement <b>${sign(stats.ret)}%</b>`];
    if (stats.dd != null) parts.push(`DD ${num(stats.dd)}%`);
    if (stats.wr != null) parts.push(`WR ${num(stats.wr)}%`);
    if (stats.pf != null) parts.push(`PF ${num(stats.pf)}x`);
    L.push(`📊 <b>Performance</b> — ${parts.join('  ·  ')}`);
    if (stats.trades != null) L.push(`<i>${stats.trades} trades · hold moyen ${num(stats.avgHold)}j</i>`);
    L.push('');
  }

  // Positions ouvertes
  L.push(`📂 <b>Positions ouvertes (${positions.length}/${size})</b>`);
  if (positions.length) {
    const sorted = positions.slice().sort((a, b) => (b.returnPct || 0) - (a.returnPct || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const posLine = p => {
      const arrow = (p.returnPct || 0) >= 0 ? '📈' : '📉';
      const rem = p.daysRemaining != null ? ` · ${p.daysRemaining}j` : '';
      return `${arrow} <b>${p.ticker}</b> ${sign(p.returnPct || 0)}%${rem}`;
    };
    if (positions.length === 1) {
      L.push(posLine(best));
    } else {
      L.push(`Meilleure : ${posLine(best)}`);
      L.push(`Pire : ${posLine(worst)}`);
    }
    if (closeNow.length) L.push(`⛔ À clôturer (horizon atteint) : ${closeNow.map(p => p.ticker).join(', ')}`);
    if (expiresTomorrow.length) L.push(`⏰ Décision J+1 : ${expiresTomorrow.map(p => p.ticker).join(', ')}`);
  } else {
    L.push('<i>Aucune position ouverte</i>');
  }
  L.push('');

  // Signaux du jour
  const slotsLeft = Math.max(0, size - positions.length);
  const sel = pickSignals(scan, cfg, modeKey);

  if (modeKey === 'bull') {
    L.push(`🎯 <b>Signaux du jour</b>`);
    if (sel.eligible.length) {
      sel.eligible.forEach(s => L.push(signalLine(s)));
    } else {
      // Cf. feedback_bull_8x_parity : 0 signal les jours calmes = NORMAL, pas un bug.
      L.push(`0 signal aujourd'hui — système haute-conviction, aucun spike volume 8× (normal les jours calmes).`);
      L.push(`<i>~1 trade/semaine sur 5 ans (parité systematic-tss). Pattern chandelier + volume clôture ≥ 8× moy. 20j + score ≥ 88 + $-volume ≥ 1M$.</i>`);
    }
  } else if (modeKey === 'fortress') {
    L.push(`☪ <b>Univers Halal du jour</b> <i>(PM discrétionnaire, Sharia-compliant uniquement)</i>`);
    if (sel.eligible.length) {
      sel.eligible.forEach(s => L.push(signalLine(s)));
    } else {
      L.push(`<i>Aucune idée Halal éligible dans le scan du jour.</i>`);
    }
  } else {
    const hdr = slotsLeft > 0
      ? `🎯 <b>Signaux du jour</b> <i>(${slotsLeft} slot${slotsLeft > 1 ? 's' : ''} libre${slotsLeft > 1 ? 's' : ''} · filtre ${sel.filterName}, min ${sel.minScore})</i>`
      : `🎯 <b>Signaux du jour</b> <i>(portefeuille complet — surveillance)</i>`;
    L.push(hdr);
    if (sel.eligible.length) {
      sel.eligible.forEach(s => L.push(signalLine(s)));
      if (slotsLeft === 0) L.push(`<i>Portefeuille plein : entrées à l'ouverture d'un slot.</i>`);
    } else {
      L.push(sel.context || `Aucun candidat éligible aujourd'hui.`);
    }
  }
  L.push('');

  // Lien statut
  L.push(`🔗 <a href="${STATUS_URL}#p-${modeKey}">Statut détaillé →</a>`);

  return L.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const doOut = argv.includes('--out');
  const modesArg = (argv.find(a => a.startsWith('--modes='))
    || (argv.includes('--modes') ? '--modes=' + argv[argv.indexOf('--modes') + 1] : ''))
    .replace('--modes=', '');
  const onlyModes = modesArg ? modesArg.split(',').map(s => s.trim()).filter(Boolean) : null;

  const scanDir = argv.find(a => /^\d{8}$/.test(a)) || getLatestScanDir();
  if (!scanDir) { console.error('ERROR: aucun scan trouvé (scanner/YYYYMMDD/signals.json)'); process.exit(1); }

  const scan = readJson(path.join(ROOT, 'scanner', scanDir, 'signals.json'));
  if (!scan) { console.error(`ERROR: signals.json introuvable pour ${scanDir}`); process.exit(1); }

  const cfgFile = readJson(path.join(ROOT, 'data', 'modes-config.json'));
  const modes = (cfgFile && cfgFile.modes) || {};

  const messages = [];
  const skipped = [];

  for (const [modeKey, cfg] of Object.entries(modes)) {
    const active = cfg.status === 'live' || cfg.status === 'deploying';
    if (!active) continue;
    if (onlyModes && !onlyModes.includes(modeKey)) continue;

    const alias = ALIAS_MAP[modeKey];
    if (!alias) { skipped.push(`${modeKey} (pas d'alias)`); continue; }

    const data = loadModeData(modeKey);
    const body = buildBody(modeKey, cfg, data, scan, scanDir);
    messages.push({ to: alias, format: 'html', body });
  }

  if (skipped.length) console.error(`[skip] modes actifs sans alias : ${skipped.join(', ')}`);

  if (doOut) {
    const outPath = path.join(ROOT, 'data', 'scanner-notifications.json');
    fs.writeFileSync(outPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      scanDate: scanDir,
      regime: scan.regime,
      count: messages.length,
      messages,
    }, null, 2), 'utf8');
    console.error(`✅ Écrit ${outPath} (${messages.length} messages)`);
  }

  if (dryRun || (!doOut)) {
    // stdout = JSON array pur (ce que la routine passerait à send_batch)
    process.stdout.write(JSON.stringify(messages, null, 2) + '\n');
  }

  console.error(`\n[gen-scanner-notifications] scan ${scanDir} · régime ${scan.regime} · ${messages.length} modes actifs`);
}

main();
