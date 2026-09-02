#!/usr/bin/env node
'use strict';

/**
 * parity-check.js — Go (systematic-tss) ↔ articles mode parity drift detector
 *
 * Un mode articles adossé au moteur revendique de refléter une stratégie Go backtestée de
 * systematic-tss. Ce script re-dérive la comparaison mécaniquement pour qu'une édition d'un
 * côté ou de l'autre (sweep de config Go, retouche du mode) soit attrapée au lieu de dériver
 * en silence pendant des mois, comme l'état pré-v10.2.
 *
 * ⚠️ REFACTOR 2026-08-12 — catalogue réduit de 25 à 5 modes (best, turbo, dynamic, balanced,
 * fortress). Les blocs de parité highvol / etf / etf_eu / bull ont été SUPPRIMÉS : ces modes
 * n'existent plus dans data/modes-config.json, donc chacune de leurs lignes lisait `undefined`
 * côté articles et sortait en DRIFT « extraction échouée » — 23 fausses dérives par nuit qui
 * masquaient les vraies. Ne pas les réintroduire sans mode correspondant dans modes-config.
 *
 * Périmètre actuel :
 *   - best : SEUL mode assetClass 'dtx'. Ses signaux viennent du pool du moteur
 *     (data/dtx/best.json → dtx-pool-bridge → sweep), et sa contrepartie Go est
 *     config/dtx/portfolio_best.yaml. La poche PORTEUSE (uhv_tp999, 70%) porte les paramètres
 *     que le tracker articles ré-implémente (capacité, horizon, trailing, markup) → c'est elle
 *     qu'on compare. Les poches ep / etf_us / mx ont leurs propres réglages internes au moteur,
 *     que le tracker n'a aucun moyen d'appliquer par position : hors périmètre.
 *   - best, câblage : la vraie régression du refactor n'était pas un paramètre mais un CÂBLAGE
 *     (universeFilter resté à "book_honest" → sweep rejetait 18/18 signaux par égalité stricte,
 *     sans log). Des lignes de cohérence câblage vérifient donc aussi id yaml ↔ portfolioId du
 *     staging ↔ universeFilter ↔ id du mode.
 *   - turbo / dynamic / balanced / fortress : modes scannés maison, aucune contrepartie Go —
 *     GAP documenté, pas une dérive. La ligne de couverture les liste explicitement pour qu'un
 *     futur mode 'dtx' non couvert sorte en DRIFT au lieu de passer inaperçu.
 *
 * Exceptions délibérées (NE PAS « corriger » la map pour les faire comparer) :
 *   - best atrStopMult / maxStopPct = 0 face à base_stop_atr 2.5 / dynamic_max_loss : voulu
 *     depuis le 2026-08-07 — 0 signifie « ne pas toucher au stop porté par le signal », que
 *     dtx-pool-bridge remplit avec le stopLoss DU MOTEUR. Le plafond du tracker préemptait le
 *     moteur (12 trades sur 18 sortis à exactement -15,00%). Comparer = régression.
 *
 * Usage:
 *   node tools/parity-check.js               # exit 1 if any real DRIFT found
 *   node tools/parity-check.js --warn-only    # always exit 0, DRIFT rows still printed
 *
 * If ../systematic-tss doesn't exist (cloud/CI runners don't have read access to that repo),
 * prints a one-line notice and exits 0 — this check is a local/dev safety net, not a hard gate.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GO_ROOT = path.resolve(ROOT, '..', 'systematic-tss');
const WARN_ONLY = process.argv.includes('--warn-only');

if (!fs.existsSync(GO_ROOT)) {
  console.log('systematic-tss absent — parity check skipped');
  process.exit(0);
}

// ─── Minimal regex-based YAML scalar/block extractor ───────────────────────
// These config files are simple (scalars + one level of nested maps/lists), so a full
// YAML parser is overkill — we only need a handful of key lookups, indentation-scoped
// so that e.g. "risk_on:" inside dynamic_max_loss doesn't get confused with the
// "risk_on:" inside dynamic_max_positions a few lines below it.

function stripComment(line) {
  const idx = line.indexOf(' #');
  return idx === -1 ? line : line.slice(0, idx);
}

function indentOf(line) {
  return line.match(/^[ \t]*/)[0].length;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Locates `key:` (optionally dash-prefixed, i.e. a YAML list item's own key) and returns
// { inlineValue, blockLines } where blockLines are the following lines indented strictly
// more than the key line (its nested map/list), stopping at the first sibling/dedent.
function findBlock(text, key) {
  const lines = text.split('\n');
  const keyRe = new RegExp(`^([ \\t]*)(?:-[ \\t]*)?${escapeRe(key)}:[ \\t]*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(keyRe);
    if (!m) continue;
    const baseIndent = m[1].length;
    const inlineValue = stripComment(m[2]).trim();
    const blockLines = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') continue;
      if (indentOf(l) <= baseIndent) break;
      blockLines.push(l);
    }
    return { inlineValue, blockLines };
  }
  return null;
}

function getScalar(text, key) {
  const b = findBlock(text, key);
  if (!b || !b.inlineValue) return null;
  return b.inlineValue.replace(/^["']|["']$/g, '');
}

function getNestedScalar(text, parentKey, childKey) {
  const b = findBlock(text, parentKey);
  if (!b) return null;
  return getScalar(b.blockLines.join('\n'), childKey);
}

// All direct numeric scalar children of a block, e.g. dynamic_max_loss: {risk_on: 0.35, ...}
function getBlockNumericValues(text, key) {
  const b = findBlock(text, key);
  if (!b) return null;
  const values = [];
  for (const l of b.blockLines) {
    const m = stripComment(l).match(/^[ \t]*[\w.]+:[ \t]*([\d.]+)[ \t]*$/);
    if (m) values.push(parseFloat(m[1]));
  }
  return values.length ? values : null;
}

// Go's dynamic_max_loss / max_loss_pct are fractions (0.15 = 15%); articles' maxStopPct is a
// plain percent number (15). The v10.2 alignment used the TIGHTEST (min) regime value as the
// static hard-cap, since maxStopPct can't be regime-adaptive the way Go's dynamic dict is.
// IMPORTANT: check the top-level dynamic_max_loss block FIRST. Some configs (e.g. etf_us.yaml)
// also have an unrelated nested `max_loss_pct` under `early_exit:` (a different concept — an
// early stop-out for fast losers, not the position's overall max stop) — a flat-scalar-first
// lookup would silently grab that instead, since findBlock() isn't indentation-anchored to the
// allocation's top level.
function maxLossPctFromGo(text) {
  const blockVals = getBlockNumericValues(text, 'dynamic_max_loss');
  if (blockVals) return Math.min(...blockVals) * 100;
  const flat = getScalar(text, 'max_loss_pct');
  if (flat !== null) return parseFloat(flat) * 100;
  return null;
}

// Découpe l'allocation (poche) `- name: <name>` d'un book multi-poches. Sans ça, findBlock()
// remonte la PREMIÈRE occurrence de la clé dans tout le fichier : sur portfolio_best.yaml
// (4 poches qui déclarent toutes base_stop_atr, timeout_days, trail_atr_mult…), on comparerait
// silencieusement la mauvaise poche.
function allocationBlock(text, name) {
  const lines = text.split('\n');
  const startRe = new RegExp(`^([ \\t]*)-[ \\t]*name:[ \\t]*["']?${escapeRe(name)}["']?[ \\t]*$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe);
    if (!m) continue;
    const indent = m[1].length;
    const out = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') { out.push(l); continue; }
      if (indentOf(l) < indent) break;                                   // dédent → fin des allocations
      if (indentOf(l) === indent && /^[ \t]*-[ \t]*name:/.test(l)) break; // poche suivante
      out.push(l);
    }
    return out.join('\n');
  }
  return null;
}

// Go stocke les seuils en fraction (0.12) ; articles en pourcent nu (12).
function pctFromFraction(v) {
  return v === null || v === undefined ? null : +(parseFloat(v) * 100).toFixed(6);
}

// Sérialise un dict par régime pour le comparer d'un bloc (Go: minuscules, articles: mêmes clés).
function regimeDictFromGo(text, key) {
  const b = findBlock(text, key);
  if (!b) return null;
  const pairs = [];
  for (const l of b.blockLines) {
    const m = stripComment(l).match(/^[ \t]*([\w.]+):[ \t]*([\d.]+)[ \t]*$/);
    if (m) pairs.push(`${m[1].toLowerCase()}=${parseFloat(m[2])}`);
  }
  return pairs.length ? pairs.sort().join(',') : null;
}

function regimeDictFromArticles(dict) {
  if (!dict || typeof dict !== 'object') return null;
  const pairs = Object.entries(dict).map(([k, v]) => `${String(k).toLowerCase()}=${Number(v)}`);
  return pairs.length ? pairs.sort().join(',') : null;
}

function approxEqual(a, b, eps = 1e-6) {
  const na = typeof a === 'number' ? a : parseFloat(a);
  const nb = typeof b === 'number' ? b : parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) < eps;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// ─── File readers ───────────────────────────────────────────────────────────

function readGoFile(relPath) {
  const full = path.join(GO_ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}
function readArticlesFile(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}
function readArticlesJSON(relPath) {
  const text = readArticlesFile(relPath);
  return text ? JSON.parse(text) : null;
}

// ─── Row helper ─────────────────────────────────────────────────────────────

function row(mode, label, goVal, artVal, opts = {}) {
  const { gap = false, note = '', goSource = '', artSource = '' } = opts;
  let status;
  let finalNote = note;
  if (gap) {
    status = 'GAP';
  } else if (goVal === null || goVal === undefined || artVal === null || artVal === undefined) {
    status = 'DRIFT';
    finalNote = finalNote || 'extraction échouée (fichier/clé introuvable)';
  } else if (approxEqual(goVal, artVal)) {
    status = 'OK';
  } else {
    status = 'DRIFT';
  }
  return { mode, label, goVal, artVal, status, note: finalNote, goSource, artSource };
}

// ─── PARITY_MAP — declarative mode → Go file → param pairs ──────────────────
// Each entry's `run(ctx)` returns the comparison rows for that mode. The extraction logic is
// intentionally explicit per param rather than hidden behind a generic engine — these Go yaml
// files are hand-tuned artifacts, not a uniform schema, and being explicit here means a broken
// mapping shows up as a clear DRIFT/extraction-failure row instead of a silent false OK.

const modesConfig = readArticlesJSON('data/modes-config.json');
const modes = (modesConfig && modesConfig.modes) || {};

const PARITY_MAP = [
  {
    id: 'best',
    goFile: 'config/dtx/portfolio_best.yaml',
    run(ctx) {
      const { text } = ctx.go('config/dtx/portfolio_best.yaml');
      const art = modes.best || {};
      if (!text) {
        return [row('best', 'file', null, null, {
          gap: true,
          note: 'config/dtx/portfolio_best.yaml absent localement (clone systematic-tss partiel) — comparaison impossible',
        })];
      }
      const carrier = allocationBlock(text, 'uhv_tp999');
      const rows = [];

      // ── Câblage : c'est ici qu'a cassé le refactor du 2026-08-12 ─────────────
      rows.push(row('best', 'yaml portfolios[].id ↔ mode id (modes-config)',
        getScalar(text, 'id'), 'best'));
      const staging = readArticlesJSON('data/dtx/best.json');
      rows.push(row('best', 'staging data/dtx/best.json portfolioId ↔ yaml id',
        getScalar(text, 'id'), staging ? staging.portfolioId : null,
        { note: staging ? '' : 'staging data/dtx/best.json absent (gitignore ? ingestion non jouée ?)' }));
      // universeFilter est comparé par ÉGALITÉ STRICTE dans sweep.js (t.universe === config.universeFilter)
      // et dtx-pool-bridge tague universe = id du mode : toute autre valeur = 0 trade, sans log.
      rows.push(row('best', 'universeFilter ↔ id du mode (partition dtx-pool-bridge)',
        'best', art.universeFilter,
        { note: 'égalité stricte dans sweep.js — une valeur périmée rejette 100% des signaux en silence' }));
      rows.push(row('best', 'assetClass ↔ pool moteur', 'dtx', art.assetClass));
      rows.push(row('best', 'filterName ↔ STRATEGY_FILTERS_MAP sweep.js',
        (() => {
          const sweep = ctx.articles('tools/sweep.js');
          return sweep && /STRATEGY_FILTERS_MAP\['dtx_engine'\]/.test(sweep) ? 'dtx_engine' : null;
        })(),
        art.filterName,
        { note: 'filtre stratégie déclaré côté sweep — absent = tous les signaux du moteur filtrés' }));

      if (!carrier) {
        rows.push(row('best', 'allocation uhv_tp999', null, null,
          { note: 'poche porteuse uhv_tp999 introuvable dans le yaml — la structure du book a changé' }));
        return rows;
      }

      // ── Paramètres de la poche PORTEUSE (70%) que le tracker ré-implémente ───
      rows.push(row('best', 'uhv.dynamic_max_positions.risk_on ↔ portfolioSize',
        getNestedScalar(carrier, 'dynamic_max_positions', 'risk_on'), art.portfolioSize));
      rows.push(row('best', 'uhv.dynamic_max_positions ↔ regimeParams.maxPositions',
        regimeDictFromGo(carrier, 'dynamic_max_positions'),
        regimeDictFromArticles(art.regimeParams && art.regimeParams.maxPositions)));
      rows.push(row('best', 'uhv.timeout_days ↔ horizon',
        getScalar(carrier, 'timeout_days'), art.horizon));
      rows.push(row('best', 'uhv.max_correlation ↔ correlationCap',
        getScalar(carrier, 'max_correlation'), art.correlationCap));
      rows.push(row('best', 'uhv.trail_trigger_pct (×100) ↔ trailTriggerPct',
        pctFromFraction(getScalar(carrier, 'trail_trigger_pct')), art.trailTriggerPct));
      rows.push(row('best', 'uhv.trail_atr_mult ↔ trailMultR',
        getScalar(carrier, 'trail_atr_mult'), art.trailMultR));
      rows.push(row('best', 'uhv.limit_price_markup ((x-1)×100) ↔ limitMarkupPct',
        (() => { const v = getScalar(carrier, 'limit_price_markup'); return v !== null ? +((parseFloat(v) - 1) * 100).toFixed(6) : null; })(),
        art.limitMarkupPct));
      // ÉCART VOULU (2026-08-12). `scanner_filters.min_score` est le filtre INTERNE du moteur,
      // appliqué à SON scan de candidats AVANT qu'il n'émette le moindre ordre — et il est
      // déclaré PAR POCHE : uhv_tp999=50, ep=40 puis 50, mx=0, etf_us aucun. Un `minScore`
      // unique côté tracker ne peut pas en être le miroir : best agrège les quatre poches.
      // Surtout, le re-seuiller en aval ne filtre PAS la même grandeur. Mesure sur les 18 ordres
      // du 2026-08-12 (data/dtx/best.json) : le `Score=` écrit dans le motif se partitionne
      // EXACTEMENT selon le nombre de features que le moteur n'a pas pu calculer —
      //   0 feature manquante  → 95        (NN)
      //   1 feature manquante  → 62, 70    (NIQ, RNW)
      //   3 features manquantes→ 16..31    (IAUX BTG TIC OWL STGW DV OTF TGB)
      // Un seuil à 50 rejetait 8 ordres sur 8 à features incomplètes et ZÉRO ordre à features
      // complètes : ce n'était pas un filtre de qualité mais un filtre de complétude de données,
      // qui jetait des décisions que le moteur avait déjà prises et validées avec SON seuil.
      // Le tracker ne re-seuille donc pas (minScore 0) ; il classe par engineNotional et garde
      // tous ses garde-fous de risque. Voir data/modes-config.json → best._scoreGateReason.
      rows.push(row('best', 'uhv.scanner_filters.min_score ↔ minScore',
        getNestedScalar(carrier, 'scanner_filters', 'min_score'), art.minScore,
        { gap: true, note: 'seuil INTERNE au moteur, par poche (uhv 50 / ep 40-50 / mx 0 / etf aucun), '
          + 'appliqué avant émission ; le Score= des ordres mesure la complétude des features, pas la qualité' }));
      // ── SORTIES PAR POCHE (R2, fermé le 2026-08-12) ─────────────────────────
      // Avant : une seule ligne comparait la poche porteuse au `partialTPGain` du mode, et sortait
      // en DRIFT perpétuel. C'était la bonne alarme pour la mauvaise raison — le vrai défaut n'est
      // pas qu'un chiffre diffère, c'est que le tracker portait UN jeu de sorties là où le livre en
      // a QUATRE (uhv aucun · ep 20 · etf_us aucun · mx 25, sortie TOTALE dans les quatre cas, pas
      // partielle). Le tracker applique désormais la règle de chaque poche par position, depuis
      // data/dtx-sleeve-exits.json. Cette table étant une TRANSCRIPTION du yaml, c'est elle qu'on
      // compare, poche par poche : si le moteur change un take-profit et que la transcription ne
      // suit pas, la ligne concernée sort en DRIFT au lieu de passer inaperçue.
      const sleeveExits = readArticlesJSON('data/dtx-sleeve-exits.json');
      const sxs = (sleeveExits && sleeveExits.sleeves) || {};
      // `take_profit_pct: 999` = seuil injoignable, transcrit en `null` (« aucune prise de profit »).
      const goTP = (blk) => {
        const v = getScalar(blk, 'take_profit_pct');
        if (v == null) return null;              // clé absente = poche sans take-profit
        const n = Number(v);
        return Number.isFinite(n) && n >= 999 ? null : n;
      };
      const goInt = (blk, key) => {
        const v = getScalar(blk, key);
        const n = v == null ? null : Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const fmt = (v) => (v == null ? 'aucun' : String(v));
      for (const name of ['uhv_tp999', 'ep', 'etf_us', 'mx']) {
        const blk = allocationBlock(text, name);
        const art2 = sxs[name] || null;
        if (!blk) {
          rows.push(row('best', `poche ${name} — introuvable dans le yaml`, null, null,
            { note: 'la structure du book a changé — la table des sorties ne couvre plus cette poche' }));
          continue;
        }
        if (!art2) {
          rows.push(row('best', `poche ${name} — absente de dtx-sleeve-exits.json`, 'présente au yaml', null,
            { note: 'poche du livre sans transcription : ses positions retomberaient sur les sorties du MODE' }));
          continue;
        }
        rows.push(row('best', `${name}.take_profit_pct ↔ sleeve takeProfitPct`,
          fmt(goTP(blk)), fmt(art2.takeProfitPct != null ? art2.takeProfitPct : null),
          { note: 'sortie TOTALE (pm_base.go exitReason=TAKE_PROFIT), appliquée par position' }));
        rows.push(row('best', `${name}.timeout_days ↔ sleeve timeoutDays`,
          fmt(goInt(blk, 'timeout_days')), fmt(art2.timeoutDays != null ? art2.timeoutDays : null),
          { note: 'aucun ⇒ le tracker retombe sur horizon du mode, déclaré comme SON garde-fou' }));
      }
      // Le mode ne doit plus porter de prise PARTIELLE : aucune des 4 poches n'en fait.
      rows.push(row('best', 'aucune poche ne prend de profit partiel ↔ partialTPGain',
        0, art.partialTPGain,
        { note: 'les take-profit du livre sont des sorties totales, par poche — pas un seuil de mode' }));

      // ── Écarts VOULUS (voir en-tête) ────────────────────────────────────────
      rows.push(row('best', 'uhv.base_stop_atr ↔ atrStopMult',
        getScalar(carrier, 'base_stop_atr'), art.atrStopMult,
        { gap: true, note: '0 = le tracker honore le stop DU MOTEUR (décision 2026-08-07)' }));
      rows.push(row('best', 'uhv.dynamic_max_loss (min ×100) ↔ maxStopPct',
        maxLossPctFromGo(carrier), art.maxStopPct,
        { gap: true, note: '0 = pas de replafonnement du stop moteur (décision 2026-08-07)' }));

      return rows;
    },
  },
];

// ─── Couverture — aucun mode ne doit sortir du radar en silence ──────────────
// Un mode assetClass 'dtx' SANS bloc de parité = DRIFT : par construction il rejoue une
// stratégie Go et doit être comparé. Un mode scanné maison (turbo/dynamic/balanced/fortress)
// n'a pas de contrepartie Go → GAP documenté.
const SCRIPTED_NO_GO_COUNTERPART = new Set(['turbo', 'dynamic', 'balanced', 'fortress']);

function coverageRows() {
  const covered = new Set(PARITY_MAP.map(m => m.id));
  const out = [];
  for (const [id, cfg] of Object.entries(modes)) {
    if (covered.has(id)) continue;
    const isDtx = cfg && cfg.assetClass === 'dtx';
    out.push(row('(couverture)', `mode « ${id} » sans bloc de parité`,
      isDtx ? 'bloc attendu' : '—', isDtx ? null : '—',
      {
        gap: !isDtx,
        note: isDtx
          ? "mode assetClass 'dtx' non couvert — ajouter son bloc dans PARITY_MAP"
          : (SCRIPTED_NO_GO_COUNTERPART.has(id)
            ? 'mode scanné maison, aucune contrepartie Go — hors périmètre par nature'
            : 'mode non-dtx inconnu de la liste documentée — vérifier s\'il doit être couvert'),
      }));
  }
  for (const m of PARITY_MAP) {
    if (!modes[m.id]) {
      out.push(row('(couverture)', `bloc de parité « ${m.id} » orphelin`, 'mode attendu', null,
        { note: 'bloc de parité sans mode correspondant dans modes-config.json — supprimer le bloc' }));
    }
  }
  return out;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const goCache = new Map();
const articlesCache = new Map();
const ctx = {
  go(relPath) {
    if (!goCache.has(relPath)) goCache.set(relPath, { text: readGoFile(relPath), usedPath: relPath });
    return goCache.get(relPath);
  },
  articles(relPath) {
    if (!articlesCache.has(relPath)) articlesCache.set(relPath, readArticlesFile(relPath));
    return articlesCache.get(relPath);
  },
};

const allRows = [];
for (const mode of PARITY_MAP) {
  try {
    allRows.push(...mode.run(ctx));
  } catch (e) {
    allRows.push(row(mode.id, 'run() threw', null, null, { note: e.message }));
  }
}
allRows.push(...coverageRows());

// ─── Print table ─────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined) return '(none)';
  return String(v);
}

const modeW = Math.max(4, ...allRows.map(r => r.mode.length));
const labelW = Math.max(5, ...allRows.map(r => r.label.length));
const goW = Math.max(2, ...allRows.map(r => fmt(r.goVal).length));
const artW = Math.max(9, ...allRows.map(r => fmt(r.artVal).length));

function pad(s, w) { return String(s).padEnd(w); }

console.log('');
console.log('Parity check — systematic-tss (Go) ↔ articles (modes du catalogue)');
console.log('='.repeat(80));
console.log(pad('MODE', modeW) + '  ' + pad('PARAM', labelW) + '  ' + pad('GO', goW) + '  ' + pad('ARTICLES', artW) + '  STATUS');
console.log('-'.repeat(modeW) + '  ' + '-'.repeat(labelW) + '  ' + '-'.repeat(goW) + '  ' + '-'.repeat(artW) + '  ------');

for (const r of allRows) {
  console.log(
    pad(r.mode, modeW) + '  ' + pad(r.label, labelW) + '  ' + pad(fmt(r.goVal), goW) + '  ' + pad(fmt(r.artVal), artW) + '  ' + r.status +
    (r.note ? `  (${r.note})` : '')
  );
}

const driftRows = allRows.filter(r => r.status === 'DRIFT');
const gapRows = allRows.filter(r => r.status === 'GAP');
const okRows = allRows.filter(r => r.status === 'OK');

console.log('-'.repeat(80));
console.log(`Total: ${allRows.length} | OK: ${okRows.length} | DRIFT: ${driftRows.length} | GAP (documented, non-blocking): ${gapRows.length}`);
console.log('');

if (driftRows.length > 0) {
  console.log(`${driftRows.length} real DRIFT row(s) found:`);
  driftRows.forEach(r => console.log(`  - [${r.mode}] ${r.label}: Go=${fmt(r.goVal)} vs articles=${fmt(r.artVal)}${r.note ? ` — ${r.note}` : ''}`));
  console.log('');
}

if (driftRows.length > 0 && !WARN_ONLY) {
  process.exit(1);
}
process.exit(0);
