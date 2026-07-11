#!/usr/bin/env node
'use strict';

/**
 * filings-scanner.js — Brique 2 (filings / insider), VOIE B (INGEST d'un JSON stagé).
 *
 * SCOPE DUR : SIM-ONLY. Ce script ne produit QUE des signaux + un pool consommé par
 * sweep.js (perf simulée) → gen-status-page → gen-api. AUCUN appel broker / sim / rb_*.
 *
 * ── Architecture no-token (voie B) ─────────────────────────────────────────────
 * Un subprocess `node` NE PEUT PAS appeler le MCP `mcp__marketdata__*` (OAuth2, zéro token
 * en .env). Seul l'AGENT (`/scanner` local ou `claude -p` cloud) appelle le MCP, écrit un
 * JSON brut, puis CE script l'INGÈRE. Il ne fetch RIEN de propriétaire — il PARSE le staging.
 *
 *   AGENT → GetInsiderActivity(days=14, direction="buy", include_transactions=true) (async → poll Jobs)
 *         → QueryData(types="insider_transactions", symbols=…)          (Form 4 code P/S)
 *         → QueryData(types="sec_filings", form_types="8-K,S-1,S-3,424B")
 *         → QueryData(types="flags", symbols=…)  → dilution_risk_score / atm / shelf / warrants
 *         → QueryData(types="eu_filings", symbols="XXXX.PA")            (contexte 8-K-like EU, Paris only)
 *         → QueryData(types="technicals,quote")                        (niveaux : price/ema50/atr14/resistance)
 *         → écrit /tmp/filings-stage.json (JSON brut MCP)
 *   node tools/filings-scanner.js --ingest /tmp/filings-stage.json --output signals \
 *        --date YYYYMMDD --folder FOLDER --regime REGIME --top 10
 *
 * ── Zéro fabrication (MCP HARD STOP) ───────────────────────────────────────────
 * EPS/guidance/gap/filing/Form 4 = MCP uniquement. Staging absent / illisible → pool
 * ABSENT (non créé), marqueur `_scanRuns['filings']` écrit avec `incomplete:true`, alerte
 * stderr, exit 0 (dégradation gracieuse, jamais bloquant). JAMAIS un pool estimé/inventé.
 *
 * ── Garde EU / PEA (§2.2) ──────────────────────────────────────────────────────
 * Le feed AMF Info-Financière NE COUVRE PAS les déclarations PDMR/dirigeant : il n'existe
 * PAS d'analog EU à `insider_transactions`. ⇒ L'insider cluster-buy est US-ONLY. Le pool
 * `filings_pool` porte `market:'us'|'eu'` ; les items EU ne portent QUE du contexte 8-K-like
 * (`eu_filings` Paris), JAMAIS un cluster-buy insider fabriqué. Cette garde est structurelle :
 * aucun chemin de code n'émet `strategy:'InsiderCluster'` avec `market:'eu'`.
 *
 * ── Deux volets ────────────────────────────────────────────────────────────────
 *  (1) IDÉES LONGUES (US only) :
 *      - InsiderCluster : ≥2 insiders distincts code P, fenêtre ≤30j, net_usd ≥ seuil,
 *        titre above_ema50 || reclaim. score = 62 + min(insiders,5)*5 + net_usd_tier
 *        + (analyst_upgrade?6:0), cap 98. Niveaux + gates hérités (stop 3–8% & ≥1.5×ATR,
 *        penny<$5 reject, R/R ≥ seuil régime, sharia).
 *      - FilingCatalyst : 8-K matériel + réaction prix positive tenue + volume (US) — niveaux
 *        via technicals. (EU.PA : FilingCatalyst market:'eu' contexte only, jamais insider.)
 *  (2) FLAGS DILUTION (US + EU.PA) — écrit `filings_flags{ticker:{dilution_risk_score,
 *      disqualify,reason}}` depuis flags/sec_filings/eu_filings stagés. PAS un signal :
 *      consommé comme disqualifiant par les autres pools (validate-scan.js).
 *
 * Sortie : filings_pool + filings_flags + _scanRuns['filings'] dans scanner/YYYYMMDD/signals.json
 * (FUSION NON DESTRUCTIVE — on ne touche à aucun autre pool).
 *
 * Usage :
 *   node tools/filings-scanner.js --ingest /tmp/filings-stage.json --output signals \
 *        --date 20260711 --folder 20260711 --regime RISK-ON --top 10
 *   node tools/filings-scanner.js --ingest /tmp/filings-stage.json --dry-run
 */

const fs = require('fs');
const path = require('path');
const { isHaramForHalalMode } = require('./lib/sharia-filter');

const ROOT = path.join(__dirname, '..');

// ─── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const hasFlag = name => args.includes(`--${name}`);

const INGEST_PATH = getArg('ingest', null);
const OUTPUT_MODE = getArg('output', 'stdout');
const SCAN_DATE = getArg('date', new Date().toISOString().slice(0, 10));
const SCAN_FOLDER = getArg('folder', null);
const REGIME = getArg('regime', null);
const TOP_N = parseInt(getArg('top', '10'), 10);
const DRY_RUN = hasFlag('dry-run');

// ─── Thresholds (source de vérité : data/scanner-filters.json, dégradation gracieuse) ──
function loadFilters() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scanner-filters.json'), 'utf8'));
  } catch { return {}; }
}
const FILTERS = loadFilters();
const ED = FILTERS.event_driven || {};       // bloc optionnel (non requis)
const INSIDER = ED.insider_cluster || {};
const STOPS = FILTERS.stops || {};
const DILUTION = FILTERS.dilution_blocklist || {};

const INSIDER_MIN_DISTINCT = INSIDER.min_distinct_insiders ?? 2;   // ≥2 insiders distincts (spec)
const INSIDER_MIN_NET_USD = INSIDER.min_net_usd ?? 250000;         // net acheteur significatif
const INSIDER_WINDOW_DAYS = INSIDER.window_days ?? 30;             // fenêtre ≤30j
const MIN_PRICE = ED.min_price ?? 5;                               // penny <$5 rejeté (gate hérité)
const STOP_MIN_PCT = STOPS.min_pct_from_entry ?? 3;
const STOP_MAX_PCT = STOPS.max_pct_from_entry ?? 8;
const STOP_ATR_MULT = STOPS.min_atr_multiple ?? 1.5;
const SCORE_CAP = (FILTERS.score_limits && FILTERS.score_limits.max_score) || 98;
const FILING_HORIZON = ED.filing_horizon ?? 15;                   // modes-config.filings.horizon
const DILUTION_DISQUALIFY_SCORE = ED.dilution_disqualify_score ?? 70;
const SEC_MAX_DAYS = DILUTION.max_recent_sec_filing_days ?? 90;
const SEC_FORMS = (DILUTION.filings_to_check || ['S-1', 'S-3', '424B']).map(f => f.toUpperCase());
const TOXIC_UNDERWRITERS = (DILUTION.underwriters || []).map(u => u.toLowerCase());
const SECTOR_MAP = (FILTERS.diversification && FILTERS.diversification.sector_map) || {};

// ─── Regime R/R gate (§2.2 : RISK-ON/NEUTRAL 1.5 ; ERO/RISK-OFF 2.0) ─────────
function regimeRRThreshold(regime) {
  const r = String(regime || '').toUpperCase().trim();
  if (r === 'RISK-OFF' || r === 'EARLY RISK-OFF') return 2.0;
  return 1.5; // RISK-ON | NEUTRAL | RECOVERY | inconnu (défensif = seuil standard)
}
const RR_THRESHOLD = regimeRRThreshold(REGIME);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function num(v) { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; }

function netUsdTier(netUsd) {
  if (netUsd >= 20_000_000) return 14;
  if (netUsd >= 5_000_000) return 10;
  if (netUsd >= 1_000_000) return 6;
  if (netUsd >= 500_000) return 3;
  return 0;
}

/**
 * Stop clampé : ∈ [3%,8%] de l'entry ET ≥ 1.5×ATR14 (gates hérités).
 * Retourne null si les contraintes sont inconciliables (ATR floor > 8% cap = trop volatil → drop).
 */
function clampStop(entry, rawStop, atr14) {
  let dist = entry - (num(rawStop) ?? entry * (1 - STOP_MAX_PCT / 100));
  const minAtrDist = atr14 ? atr14 * STOP_ATR_MULT : 0;
  const minPctDist = entry * (STOP_MIN_PCT / 100);
  dist = Math.max(dist, minAtrDist, minPctDist);
  const maxDist = entry * (STOP_MAX_PCT / 100);
  if (dist > maxDist + 1e-9) return null; // ATR floor ne rentre pas dans le cap 8% → drop
  return +(entry - dist).toFixed(2);
}

function sectorOf(ticker, staged) {
  return staged || SECTOR_MAP[ticker] || null;
}

// Normalise l'accès aux différentes formes de staging MCP tolérées.
function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

// ─── Volet (1a) : InsiderCluster — US ONLY ───────────────────────────────────
function buildInsiderSignals(stage) {
  const out = [];
  const rows = asArray(stage.insider_activity || stage.insider_cluster || stage.cluster_buys);
  for (const row of rows) {
    const ticker = row.ticker || row.symbol;
    if (!ticker) continue;

    // GARDE EU DURE : jamais d'insider EU (donnée PDMR inexistante côté MCP, §2.2).
    // On ne fait confiance ni au champ market ni au suffixe .PA/.AS/.DE/… : tout ce qui
    // n'est pas explicitement US est rejeté du volet insider (zéro fabrication).
    const market = String(row.market || 'us').toLowerCase();
    const looksEU = /\.(pa|as|de|br|mi|mc|l|sw|vi|st|ol|he|li|is)$/i.test(ticker);
    if (market !== 'us' || looksEU) continue;

    const insiders = num(row.insiders_distinct ?? row.distinct_insiders ?? row.insiders) ?? 0;
    const netUsd = num(row.net_usd ?? row.net_buy_usd ?? row.net) ?? 0;
    if (insiders < INSIDER_MIN_DISTINCT) continue;                 // ≥2 insiders distincts
    if (netUsd < INSIDER_MIN_NET_USD) continue;                    // net acheteur significatif

    // Fenêtre ≤30j — code P uniquement (Purchase). On vérifie sur les transactions stagées si
    // présentes ; sinon on fait confiance au champ agrégé (déjà filtré direction=buy par l'agent).
    const txs = asArray(row.transactions).filter(t => {
      const code = String(t.code || t.transaction_code || '').toUpperCase();
      return code === 'P' || code === '';
    });
    if (asArray(row.transactions).length && txs.length < INSIDER_MIN_DISTINCT) continue;

    // Base technique : above_ema50 || reclaim (spec). Sans technicals → pas de niveaux → drop
    // (zéro fabrication de niveaux).
    const tech = row.technicals || row.tech || {};
    const price = num(tech.price ?? row.price);
    if (price == null || price < MIN_PRICE) continue;              // penny <$5 rejeté
    const aboveEma50 = tech.above_ema50 === true || (num(tech.ema50) != null && price > num(tech.ema50));
    const reclaim = tech.reclaim === true;
    if (!aboveEma50 && !reclaim) continue;

    const atr14 = num(tech.atr14 ?? tech.atr);
    const supportRaw = num(tech.support ?? tech.low ?? tech.swing_low);
    const stop = clampStop(price, supportRaw != null ? supportRaw : price * (1 - STOP_MAX_PCT / 100), atr14);
    if (stop == null) continue;                                    // trop volatil pour un stop propre
    const risk = price - stop;
    if (risk <= 0) continue;

    const resistance = num(tech.resistance ?? tech.next_resistance);
    const tp1 = resistance != null && resistance > price ? resistance : +(price + risk * 2.0).toFixed(2);
    const rr = +((tp1 - price) / risk).toFixed(2);
    if (rr < RR_THRESHOLD) continue;                               // R/R ≥ seuil régime
    const tp2 = +(price + risk * (rr + 1)).toFixed(2);

    const analystUpgrade = row.analyst_upgrade === true || row.analyst_action === 'upgrade';
    let score = 62 + Math.min(insiders, 5) * 5 + netUsdTier(netUsd) + (analystUpgrade ? 6 : 0);
    score = Math.min(SCORE_CAP, Math.round(score));

    // Sharia — tag explicite si fourni, sinon null (untagged). Reject si haram avéré.
    const shariaTag = row.sharia != null ? row.sharia : null;
    const candidate = { ticker, sector: sectorOf(ticker, row.sector) };
    if (shariaTag === false || isHaramForHalalMode(candidate)) continue;

    const lastDate = txs.map(t => t.date).filter(Boolean).sort().reverse()[0]
      || row.last_buy_date || SCAN_DATE;

    out.push({
      ticker,
      name: row.name || ticker,
      score,
      strategy: 'InsiderCluster',
      source: 'filings_pool',
      market: 'us',
      region: 'US',
      sector: candidate.sector,
      entry: +price.toFixed(2),
      stop,
      tp1: +tp1.toFixed(2),
      tp2,
      rr: `1:${rr.toFixed(2)}`,
      horizon: FILING_HORIZON,
      sharia: shariaTag,
      catalyst: {
        type: 'insider_cluster',
        date: lastDate,
        detail: `${insiders} insiders distincts (code P), net +$${(netUsd / 1e6).toFixed(2)}M sur ≤${INSIDER_WINDOW_DAYS}j${analystUpgrade ? ', analyst upgrade' : ''}`,
      },
      thesis: `Cluster-buy d'insiders (${insiders} acheteurs, +$${(netUsd / 1e6).toFixed(2)}M net, code P) sur un titre ${aboveEma50 ? 'au-dessus EMA50' : 'en reclaim'}. Entrée $${price.toFixed(2)}, stop $${stop} (${((risk / price) * 100).toFixed(1)}%), R/R 1:${rr.toFixed(2)}.`,
    });
  }
  return out;
}

// ─── Volet (1b) : FilingCatalyst — 8-K US + contexte EU.PA (jamais insider) ───
function buildCatalystSignal(item, market) {
  const ticker = item.ticker || item.symbol;
  if (!ticker) return null;
  const tech = item.technicals || item.tech || {};
  const price = num(tech.price ?? item.price);
  // Niveaux via technicals UNIQUEMENT — sans price/résistance réels, pas de signal (zéro fabrication).
  if (price == null || price < MIN_PRICE) return null;
  const reaction = num(item.price_reaction_pct ?? item.reaction_pct);
  if (reaction == null || reaction <= 0) return null;              // réaction positive tenue requise
  if (item.vol_confirm === false) return null;                     // volume de confirmation

  const atr14 = num(tech.atr14 ?? tech.atr);
  const supportRaw = num(tech.support ?? tech.low ?? tech.swing_low);
  const stop = clampStop(price, supportRaw != null ? supportRaw : price * (1 - STOP_MAX_PCT / 100), atr14);
  if (stop == null) return null;
  const risk = price - stop;
  if (risk <= 0) return null;
  const resistance = num(tech.resistance ?? tech.next_resistance);
  const tp1 = resistance != null && resistance > price ? resistance : +(price + risk * 2.0).toFixed(2);
  const rr = +((tp1 - price) / risk).toFixed(2);
  if (rr < RR_THRESHOLD) return null;
  const tp2 = +(price + risk * (rr + 1)).toFixed(2);

  const shariaTag = item.sharia != null ? item.sharia : null;
  const cand = { ticker, sector: sectorOf(ticker, item.sector) };
  if (shariaTag === false || isHaramForHalalMode(cand)) return null;

  const catType = item.catalyst_type || item.type || '8-K';
  let score = 60 + Math.min(Math.round(reaction), 12) + (item.analyst_upgrade === true ? 6 : 0);
  score = Math.min(SCORE_CAP, Math.round(score));

  return {
    ticker,
    name: item.name || ticker,
    score,
    strategy: 'FilingCatalyst',
    source: 'filings_pool',
    market,                                                        // 'us' | 'eu' — jamais insider
    region: market === 'eu' ? 'EU' : 'US',
    sector: cand.sector,
    entry: +price.toFixed(2),
    stop,
    tp1: +tp1.toFixed(2),
    tp2,
    rr: `1:${rr.toFixed(2)}`,
    horizon: FILING_HORIZON,
    sharia: shariaTag,
    catalyst: {
      type: 'filing_catalyst',
      date: item.date || item.filing_date || SCAN_DATE,
      detail: `${catType} matériel, réaction +${reaction.toFixed(1)}% tenue${item.detail ? ` — ${String(item.detail).slice(0, 80)}` : ''}`,
    },
    thesis: `Catalyseur réglementaire (${catType}) avec réaction prix +${reaction.toFixed(1)}% confirmée en volume. Entrée $${price.toFixed(2)}, stop $${stop}, R/R 1:${rr.toFixed(2)}.`,
  };
}

function buildCatalystSignals(stage) {
  const out = [];
  // 8-K US
  for (const it of asArray(stage.filings_8k || stage.catalyst_8k)) {
    const sig = buildCatalystSignal(it, 'us');
    if (sig) out.push(sig);
  }
  // EU.PA — CONTEXTE 8-K-like UNIQUEMENT (jamais insider). Émis SEULEMENT si niveaux réels fournis.
  for (const it of asArray(stage.eu_filings)) {
    // sécurité : n'accepter que des tickers Paris explicitement EU, et ignorer tout champ insider.
    const ticker = it.ticker || it.symbol || '';
    if (!/\.pa$/i.test(ticker) && String(it.market || '').toLowerCase() !== 'eu') continue;
    const sig = buildCatalystSignal(it, 'eu');
    if (sig) out.push(sig);
  }
  return out;
}

// ─── Volet (2) : FLAGS DILUTION (US + EU.PA) — PAS un signal ──────────────────
function buildFilingsFlags(stage) {
  const flags = {};
  const setFlag = (ticker, score, disqualify, reason) => {
    if (!ticker) return;
    const prev = flags[ticker];
    // Garder le flag le plus sévère (score max, disqualify sticky).
    if (!prev || score > prev.dilution_risk_score || (disqualify && !prev.disqualify)) {
      flags[ticker] = {
        dilution_risk_score: Math.max(score, prev ? prev.dilution_risk_score : 0),
        disqualify: disqualify || (prev ? prev.disqualify : false),
        reason: reason || (prev ? prev.reason : ''),
      };
    }
  };

  // (a) flags agrégés MCP : {ticker:{dilution_risk_score, atm_program_active, shelf_active, warrants_outstanding}}
  const rawFlags = stage.flags || {};
  const flagEntries = Array.isArray(rawFlags)
    ? rawFlags.map(f => [f.ticker || f.symbol, f])
    : Object.entries(rawFlags);
  for (const [ticker, f] of flagEntries) {
    if (!ticker || !f) continue;
    const drs = num(f.dilution_risk_score) ?? 0;
    const reasons = [];
    if (f.atm_program_active === true) reasons.push('ATM program active');
    if (f.shelf_active === true) reasons.push('S-3 shelf active');
    if (num(f.warrants_outstanding) > 0) reasons.push(`${num(f.warrants_outstanding)} warrants outstanding`);
    const disqualify = drs >= DILUTION_DISQUALIFY_SCORE || f.atm_program_active === true || f.shelf_active === true;
    const reason = reasons.length ? reasons.join(', ') : (disqualify ? `dilution_risk_score ${drs}` : `dilution_risk_score ${drs} (bas)`);
    setFlag(ticker, drs, disqualify, reason);
  }

  // (b) sec_filings bruts (US) : S-1/S-3/424B <90j + underwriter toxique = disqualifiant.
  const secByTicker = stage.sec_filings || {};
  const secEntries = Array.isArray(secByTicker)
    ? secByTicker.map(f => [f.ticker || f.symbol, asArray(f.filings || f)])
    : Object.entries(secByTicker).map(([t, v]) => [t, asArray(v)]);
  const asofMs = Date.parse(SCAN_DATE.length === 8
    ? `${SCAN_DATE.slice(0, 4)}-${SCAN_DATE.slice(4, 6)}-${SCAN_DATE.slice(6, 8)}`
    : SCAN_DATE) || Date.now();
  for (const [ticker, filings] of secEntries) {
    for (const fil of asArray(filings)) {
      const form = String(fil.form || fil.form_type || '').toUpperCase();
      if (!SEC_FORMS.some(sf => form.startsWith(sf))) continue;
      const dt = Date.parse(fil.date || fil.filing_date || '');
      const daysAgo = Number.isFinite(dt) ? (asofMs - dt) / 86400000 : 0;
      if (Number.isFinite(dt) && daysAgo > SEC_MAX_DAYS) continue;   // trop vieux
      const underwriter = String(fil.underwriter || '').toLowerCase();
      const toxic = underwriter && TOXIC_UNDERWRITERS.some(u => underwriter.includes(u));
      const score = toxic ? 90 : 65;
      const reason = toxic
        ? `${form} <${SEC_MAX_DAYS}j via underwriter toxique (${fil.underwriter})`
        : `${form} récent (<${SEC_MAX_DAYS}j) — dilution potentielle`;
      setFlag(ticker, score, true, reason);
    }
  }

  // (c) eu_filings à caractère dilutif (augmentation de capital / OPA) — contexte EU.PA, disqualifiant.
  for (const it of asArray(stage.eu_filings)) {
    const ticker = it.ticker || it.symbol;
    const type = String(it.type || it.subtype || '').toLowerCase();
    if (/augmentation|capital|dilut|placement|absa|oceane|convertible/.test(type)) {
      setFlag(ticker, num(it.dilution_risk_score) ?? 72, true, `EU filing dilutif: ${it.type || type}`);
    }
  }

  return flags;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────
function readStage(p) {
  if (!p) return { ok: false, reason: 'aucun --ingest fourni' };
  if (!fs.existsSync(p)) return { ok: false, reason: `staging introuvable: ${p}` };
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (e) { return { ok: false, reason: `lecture staging échouée: ${e.message}` }; }
  let j;
  try { j = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: `staging JSON invalide: ${e.message}` }; }
  if (j && j.error) return { ok: false, reason: `staging MCP en erreur: ${j.error}` };
  return { ok: true, stage: j };
}

function resolveScanDir() {
  return SCAN_FOLDER || SCAN_DATE.replace(/-/g, '');
}

// Écrit le marqueur _scanRuns['filings'] SANS créer le pool (cas incomplet = zéro fabrication).
function writeIncompleteMarker(reason) {
  if (OUTPUT_MODE !== 'signals') return;
  const scanDir = resolveScanDir();
  const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — impossible d'écrire le marqueur incomplet.`);
    return;
  }
  const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  if (!signals._scanRuns) signals._scanRuns = {};
  signals._scanRuns.filings = {
    at: new Date().toISOString(),
    signals: 0,
    universeFetched: 0,
    flags: 0,
    incomplete: true,
    reason,
  };
  // NON DESTRUCTIF : on ne touche ni filings_pool ni filings_flags (pool laissé ABSENT).
  fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
}

function main() {
  console.log('🗂️  Filings Scanner (Brique 2 — insider/filings, VOIE B ingest)');
  console.log(`   Date: ${SCAN_DATE} | Folder: ${resolveScanDir()} | Regime: ${REGIME || 'auto'} | R/R≥${RR_THRESHOLD} | top: ${TOP_N}`);

  const st = readStage(INGEST_PATH);
  if (!st.ok) {
    // MCP HARD STOP : staging manquant/cassé → pool ABSENT + marqueur incomplet + alerte. Jamais estimé.
    console.error(`⚠️  Staging indisponible (${st.reason}).`);
    console.error('   → Pool filings ABSENT (zéro fabrication). Marqueur _scanRuns[\'filings\'] incomplete:true.');
    console.error('   → ALERTE requise côté agent : send_message(to="alerts", body="filings staging KO — run incomplet").');
    writeIncompleteMarker(st.reason);
    process.exit(0); // dégradation gracieuse : jamais bloquant pour le pipeline
  }

  const stage = st.stage;

  // Volet (1) idées longues
  const insiderSignals = buildInsiderSignals(stage);   // US-only par construction
  const catalystSignals = buildCatalystSignals(stage); // 8-K US + contexte EU.PA
  let poolAll = [...insiderSignals, ...catalystSignals];

  // Dedup interne au pool par ticker (garde le meilleur score).
  const byTicker = new Map();
  for (const s of poolAll) {
    const prev = byTicker.get(s.ticker);
    if (!prev || s.score > prev.score) byTicker.set(s.ticker, s);
  }
  poolAll = [...byTicker.values()].sort((a, b) => b.score - a.score);
  const top = poolAll.slice(0, TOP_N);

  // Volet (2) flags dilution
  const filingsFlags = buildFilingsFlags(stage);

  const usCount = top.filter(s => s.market === 'us').length;
  const euCount = top.filter(s => s.market === 'eu').length;
  const insiderCount = top.filter(s => s.strategy === 'InsiderCluster').length;

  console.log(`\n✅ ${top.length} signal(s) filings (dont ${insiderCount} InsiderCluster US, ${euCount} contexte EU), ${Object.keys(filingsFlags).length} flag(s) dilution.`);
  for (const s of top) {
    console.log(`  ${s.market === 'eu' ? '🇪🇺' : '🇺🇸'} ${s.ticker.padEnd(8)} ${s.strategy.padEnd(15)} score:${String(s.score).padStart(3)} E:${s.entry} S:${s.stop} TP1:${s.tp1} ${s.rr}`);
  }
  const disq = Object.entries(filingsFlags).filter(([, f]) => f.disqualify).map(([t]) => t);
  if (disq.length) console.log(`  🚫 disqualifiés (dilution): ${disq.join(', ')}`);

  // GARDE EU — assertion défensive : aucun InsiderCluster ne doit porter market:'eu'.
  const euInsiderLeak = top.find(s => s.strategy === 'InsiderCluster' && s.market !== 'us');
  if (euInsiderLeak) {
    console.error(`❌ INVARIANT VIOLÉ: insider EU émis (${euInsiderLeak.ticker}) — donnée PDMR inexistante. Abort.`);
    process.exit(1);
  }

  if (DRY_RUN) { console.log('\n🏷️  Dry run — aucun fichier écrit.'); return; }

  if (OUTPUT_MODE === 'signals') {
    const scanDir = resolveScanDir();
    const sigPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
    if (!fs.existsSync(sigPath)) { console.error(`❌ ${sigPath} introuvable`); process.exit(1); }
    const signals = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // FUSION NON DESTRUCTIVE — on ne touche qu'à filings_pool / filings_flags / _scanRuns['filings'].
    if (!Array.isArray(signals.filings_pool)) signals.filings_pool = [];
    const existing = new Set(signals.filings_pool.map(s => s.ticker));
    let added = 0;
    for (const s of top) {
      if (existing.has(s.ticker)) continue;
      signals.filings_pool.push(s);
      existing.add(s.ticker);
      added++;
    }

    if (!signals.filings_flags || typeof signals.filings_flags !== 'object') signals.filings_flags = {};
    for (const [ticker, f] of Object.entries(filingsFlags)) signals.filings_flags[ticker] = f;

    if (!signals._scanRuns) signals._scanRuns = {};
    signals._scanRuns.filings = {
      at: new Date().toISOString(),
      signals: top.length,
      added,
      universeFetched: asArray(stage.insider_activity || stage.cluster_buys).length
        + asArray(stage.filings_8k).length + asArray(stage.eu_filings).length,
      flags: Object.keys(filingsFlags).length,
      market: { us: usCount, eu: euCount },
      incomplete: false,
    };

    fs.writeFileSync(sigPath, JSON.stringify(signals, null, 2));
    console.log(`\n📁 Appended ${added} filings signals to filings_pool + ${Object.keys(filingsFlags).length} filings_flags in ${sigPath}`);
  }
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('❌', e.message); process.exit(1); }
}

module.exports = {
  buildInsiderSignals,
  buildCatalystSignals,
  buildFilingsFlags,
  clampStop,
  regimeRRThreshold,
  netUsdTier,
};
