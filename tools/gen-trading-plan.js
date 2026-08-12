#!/usr/bin/env node
'use strict';

// gen-trading-plan.js — Generate a broker-specific trading plan DSL from scanner signals.
// Usage: node tools/gen-trading-plan.js --mode balanced --broker alpaca [--date 20260505] [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// ── CLI args ──
const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] || true) : null; }
const MODE = flag('mode') || 'balanced';
const BROKER_RAW = flag('broker') || 'paper';
const BROKER_ALIAS = { t212: 'trading212' };
const BROKER_LOOKUP = BROKER_ALIAS[BROKER_RAW] || BROKER_RAW;
const BROKER = BROKER_RAW;
let DATE = flag('date');
const DRY_RUN = args.includes('--dry-run');
const OUTPUT = flag('output');

// ── Load data ──
const modesConfig = JSON.parse(fs.readFileSync(path.join(DATA, 'modes-config.json'), 'utf8'));
const modeCfg = modesConfig.modes[MODE];
if (!modeCfg) { console.error(`Unknown mode: ${MODE}. Available: ${Object.keys(modesConfig.modes).join(', ')}`); process.exit(1); }

// ── Status gate ──
// draft / paused / stopped: no plan at all.
// pausing: exit-only plan (no new entries; SL/TP/horizon run normally).
// liquidated: force-close plan (no new entries; ALL open positions closed at market).
const ms = require('./lib/mode-status');
const MODE_STATUS = ms.isValidState(modeCfg.status) ? modeCfg.status : ms.DEFAULT_STATE;
const STATUS_ACCEPTS_ENTRIES = ms.acceptsNewEntries(MODE_STATUS);
const STATUS_EXITS_ONLY = ms.exitsOnly(MODE_STATUS);
const STATUS_LIQUIDATED = ms.forceLiquidate(MODE_STATUS);
if (MODE_STATUS === 'draft' || MODE_STATUS === 'paused' || MODE_STATUS === 'stopped') {
  console.error(`[gen-trading-plan] mode '${MODE}' is in status '${MODE_STATUS}' — no plan generated.`);
  if (!DRY_RUN) process.exit(0);
}
if (STATUS_EXITS_ONLY) {
  console.log(`[gen-trading-plan] mode '${MODE}' in status '${MODE_STATUS}' — exits-only plan (new entries suppressed).`);
}
if (STATUS_LIQUIDATED) {
  console.log(`[gen-trading-plan] mode '${MODE}' in status '${MODE_STATUS}' — FORCE LIQUIDATION (close all positions at market).`);
}

let brokerMap = { brokers: [], symbols: {} };
const brokerMapPath = path.join(DATA, 'broker-instruments.json');
if (fs.existsSync(brokerMapPath)) {
  brokerMap = JSON.parse(fs.readFileSync(brokerMapPath, 'utf8'));
} else {
  // Try loading per-broker instrument file
  const perBrokerPath = path.join(ROOT, 'tools/trading-executor/instruments', BROKER_LOOKUP + '.json');
  if (fs.existsSync(perBrokerPath)) {
    const raw = JSON.parse(fs.readFileSync(perBrokerPath, 'utf8'));
    brokerMap.brokers = [BROKER_LOOKUP];
    for (const inst of (raw.instruments || [])) {
      brokerMap.symbols[inst.internal_symbol || inst.broker_symbol] = {
        brokers: { [BROKER_LOOKUP]: { symbol: inst.broker_symbol, exchange: inst.exchange, tradable: inst.tradable, marginable: inst.marginable, shortable: inst.shortable, min_order_size: inst.min_order_size, price_increment: inst.price_increment, uic: inst.uic, isin: inst.isin, currency: inst.currency, asset_type: inst.asset_type } }
      };
    }
  }
}
if (!brokerMap.brokers.includes(BROKER_LOOKUP) && BROKER !== 'paper') {
  console.error(`Unknown broker: ${BROKER}. Available: ${brokerMap.brokers.join(', ')}, paper, t212`);
  process.exit(1);
}

const signalsPath = path.join(ROOT, 'portfolio/v1', MODE, 'signals.json');
const signals = JSON.parse(fs.readFileSync(signalsPath, 'utf8'));

let positions = [];
try {
  const pitState = JSON.parse(fs.readFileSync(path.join(DATA, 'pit-state.json'), 'utf8'));
  const modeState = pitState.modes?.[MODE];
  if (modeState?.positions?.length) {
    positions = modeState.positions.map(p => ({
      ticker: p.ticker,
      entry: p.actualEntry || p.entryPrice,
      entry_date: p.entryDate,
      entryDate: p.entryDate,
      scan_date: p.scanDate,
      current_price: p.actualEntry || p.entryPrice,
      stop: p.currentStop || p.actualStop,
      tp1: p.actualTp1,
      tp2: p.actualTp2,
      return_pct: null,
      mode: MODE,
    }));
  }
} catch (_) {
  try { positions = JSON.parse(fs.readFileSync(path.join(DATA, 'scanner-positions.json'), 'utf8')).open_positions || []; } catch (__) {}
}

const ordersPath = path.join(ROOT, 'portfolio/v1', MODE, 'orders.json');
let currentOrders = [];
let ordersScanDate = '';
try {
  const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
  currentOrders = ordersData.orders || [];
  ordersScanDate = ordersData.scanDate || '';
} catch (_) {}

// ── CHEMIN MOTEUR (assetClass:"dtx") ─────────────────────────────────────────
// Le reste de ce générateur est écrit pour le chemin SCANNER : il REFAIT le sizing depuis
// portfolioSize, fabrique un TP1 partiel depuis signal.tp1 et arme un trailing stop depuis la
// config du mode. Les ordres du moteur systematic-tss ne se traduisent pas comme ça : ils
// portent LEUR propre quantité, n'ont PAS de take-profit (la sortie est pilotée par le moteur)
// et leur stop ne doit pas être retouché. La traduction naïve produisait un plan FAUX —
// mesuré sur best/20260812 : BTG à 128 titres / 667 $ au lieu des 332 titres / 2 000 $ décidés
// par le moteur, et un take_profit_1 en LIMIT au prix 0 sur les 18 ordres.
// Un ordre moteur est donc traduit à l'identique (qty/orderType/limitPrice/stop), sans TP ni
// horizon fabriqués. Voir makeOrder() ci-dessous.
const IS_DTX = modeCfg.assetClass === 'dtx';
const engineOrders = currentOrders.filter(o => o && o.source === 'engine');
if (engineOrders.length && !IS_DTX) {
  // Filet : des ordres moteur dans un mode qui ne se déclare pas moteur = configuration
  // incohérente. Refuser plutôt que fabriquer un plan faux.
  console.error(`❌ ${MODE}: ${engineOrders.length} ordre(s) source:"engine" mais assetClass="${modeCfg.assetClass || 'scanner'}".`);
  console.error('   Le chemin moteur ne s\'arme que sur assetClass:"dtx". Aucun plan écrit.');
  process.exit(1);
}
if (IS_DTX) {
  const foreign = currentOrders.filter(o => o && o.source !== 'engine');
  if (foreign.length) {
    console.error(`❌ ${MODE} (dtx): ${foreign.length} ordre(s) sans source:"engine" dans un livre moteur — provenance incohérente. Aucun plan écrit.`);
    process.exit(1);
  }
}

if (!DATE) DATE = ordersScanDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Load raw scanner signals as fallback pool (mode signals.json is topN-filtered)
let rawSignals = [];
const scanDir = ordersScanDate || DATE;
const rawPath = path.join(ROOT, 'scanner', scanDir, 'signals.json');
try {
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  rawSignals = raw.signals || [];
} catch (_) {}

// ── Helpers ──
function brokerSymbol(ticker) {
  if (BROKER === 'paper') return ticker;
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  return entry.brokers[BROKER_LOOKUP].symbol;
}

function brokerInfo(ticker) {
  if (BROKER === 'paper') return { symbol: ticker };
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  const b = entry.brokers[BROKER_LOOKUP];
  const info = { symbol: b.symbol, exchange: b.exchange || '' };
  if (b.uic) info.uic = b.uic;
  if (b.isin) info.isin = b.isin;
  if (b.currency) info.currency = b.currency;
  if (b.asset_type) info.asset_type = b.asset_type;
  return info;
}

function brokerRestrictions(ticker) {
  if (BROKER === 'paper') return { tradable: true, marginable: true, shortable: true, min_order_size: 1, price_increment: 0.01 };
  const entry = brokerMap.symbols[ticker];
  if (!entry || !entry.brokers[BROKER_LOOKUP]) return null;
  const b = entry.brokers[BROKER_LOOKUP];
  return { tradable: b.tradable, marginable: b.marginable, shortable: b.shortable, min_order_size: b.min_order_size || 1, price_increment: b.price_increment || 0.01 };
}

function addBizDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function roundToIncrement(price, increment) {
  return Math.round(price / increment) * increment;
}

// ── Build plan ──
const now = new Date();
const todayISO = now.toISOString().slice(0, 10);
const targetISO = DATE.length === 8 ? `${DATE.slice(0,4)}-${DATE.slice(4,6)}-${DATE.slice(6,8)}` : todayISO;
const expiryDate = addBizDays(targetISO, modeCfg.horizon);
const nominalUsd = modeCfg.portfolioSize > 0 ? 10000 : 10000; // default capital
const positionPct = modeCfg.positionSizePct || +(100 / modeCfg.portfolioSize).toFixed(2);
const positionNominal = +(nominalUsd * positionPct / 100).toFixed(2);

const modePositions = positions;

// Identify close-now (horizon expired)
function bizDaysSince(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr + 'T12:00:00Z');
  const end = new Date();
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ── Orders from API ──
// Status gate: any state that doesn't accept new entries (pausing,
// liquidated, paused, stopped, draft) suppresses every BUY/ROTATE. Close-now
// exits below still run so open positions can be wound down.
const buyOrders = STATUS_ACCEPTS_ENTRIES ? currentOrders.filter(o => o.action === 'BUY') : [];
const rotateOrders = STATUS_ACCEPTS_ENTRIES ? currentOrders.filter(o => o.action === 'ROTATE') : [];

// ── Generate order entries ──
let orderSeq = 0;
function makeOrder(signal, action, rotation) {
  orderSeq++;
  const sym = brokerSymbol(signal.ticker);
  const restrictions = brokerRestrictions(signal.ticker);

  if (!sym) {
    return {
      id: `ORD-${String(orderSeq).padStart(3, '0')}`,
      action: 'SKIP',
      ticker: signal.ticker,
      reason: `Not available on ${BROKER}`,
    };
  }
  if (restrictions && !restrictions.tradable) {
    return {
      id: `ORD-${String(orderSeq).padStart(3, '0')}`,
      action: 'SKIP',
      ticker: signal.ticker,
      broker_symbol: sym,
      reason: `Not tradable on ${BROKER}`,
    };
  }

  const increment = restrictions?.price_increment || 0.01;

  // ── Chemin moteur : traduction 1:1, aucune donnée fabriquée ────────────────
  if (IS_DTX) return makeEngineOrder(signal, action, rotation, { sym, restrictions, increment });

  const entryPrice = roundToIncrement(signal.entry, increment);
  const stopPrice = roundToIncrement(signal.stop, increment);
  const tp1Price = roundToIncrement(signal.tp1, increment);
  const tp2Price = signal.tp2 ? roundToIncrement(signal.tp2, increment) : null;
  const shares = Math.max(restrictions?.min_order_size || 1, Math.floor(positionNominal / entryPrice));

  return {
    id: `ORD-${String(orderSeq).padStart(3, '0')}`,
    action: action,
    ticker: signal.ticker,
    broker_symbol: sym,
    broker: brokerInfo(signal.ticker),
    entry: {
      type: 'LIMIT',
      price: entryPrice,
      vwap_gate: {
        enabled: true,
        max_open_ratio: 1.01,
        description: 'Fill only if next open ≤ entry × 1.01. If gap-up above threshold, wait for VWAP pullback.',
      },
      size: {
        method: 'FIXED_NOMINAL',
        nominal_usd: positionNominal,
        shares: shares,
        pct_of_portfolio: positionPct,
      },
      valid_from: `${targetISO}T09:30:00-04:00`,
      valid_until: `${targetISO}T16:00:00-04:00`,
      time_in_force: 'DAY',
    },
    exit: {
      stop_loss: {
        type: 'STOP',
        price: stopPrice,
        trailing: modeCfg.trailingStop || false,
        daily_trail_pct: modeCfg.dailyTrailPct || 0,
        max_stop_pct: modeCfg.maxStopPct || 0,
        atr_stop_mult: modeCfg.atrStopMult || 0,
      },
      take_profit_1: {
        type: 'LIMIT',
        price: tp1Price,
        partial_exit_pct: (modeCfg.partialTPPct || 0.5) * 100,
        description: `Sell ${(modeCfg.partialTPPct || 0.5) * 100}% at TP1, move stop to breakeven on remainder`,
      },
      take_profit_2: tp2Price ? {
        type: 'LIMIT',
        price: tp2Price,
        partial_exit_pct: 100,
        description: 'Sell remaining position at TP2',
      } : null,
      ...(modeCfg.breakevenPct > 0 ? {
        breakeven: {
          trigger_pct: modeCfg.breakevenPct || 0,
          action: 'MOVE_STOP_TO_ENTRY',
          description: `When unrealized P&L ≥ ${modeCfg.breakevenPct || 0}%, move stop to entry price`,
        },
      } : {}),
      time_exit: {
        horizon_days: modeCfg.horizon,
        expiry_date: expiryDate,
        action: 'CLOSE_AT_MARKET_OPEN',
        description: `If still open after ${modeCfg.horizon} business days, close at next market open`,
      },
    },
    conditions: [
      {
        phase: 'PRE_ENTRY',
        check: 'GAP_UP',
        threshold_ratio: 1.02,
        if_true: 'WAIT_VWAP_PULLBACK',
        description: 'If open > entry × 1.02, do not market buy. Wait for price to pull back to VWAP.',
      },
      {
        phase: 'PRE_ENTRY',
        check: 'HALTED',
        if_true: 'SKIP_ORDER',
        description: 'If symbol is halted at market open, skip entirely.',
      },
      {
        phase: 'PRE_ENTRY',
        check: 'SPREAD',
        max_spread_pct: 0.5,
        if_true: 'DELAY_30S',
        description: 'If bid-ask spread > 0.5%, wait 30s for spread to tighten.',
      },
      {
        phase: 'POST_FILL',
        check: 'SLIPPAGE',
        max_slippage_pct: 1.0,
        if_exceeded: 'LOG_WARNING',
        description: 'Log warning if fill price > 1% worse than limit.',
      },
    ],
    rotation: rotation ? {
      close_ticker: rotation.close,
      close_broker_symbol: brokerSymbol(rotation.close),
      reason: rotation.reason || 'Score upgrade — rotate worst position for better signal',
    } : undefined,
    metadata: {
      score: signal.score,
      strategy: signal.strategy,
      rr: signal.rr,
      sharia: signal.sharia,
      thesis: signal.thesis,
    },
  };
}

/** Traduit un ordre du moteur systematic-tss en ordre de plan, À L'IDENTIQUE.
 *  Règles, dans l'ordre d'importance :
 *   1. la quantité est celle du moteur — jamais recalculée depuis portfolioSize/positionNominal ;
 *   2. aucun take-profit n'est fabriqué : le moteur ne publie pas de TP, la sortie lui appartient ;
 *   3. le stop est celui porté par l'ordre, non trailé et non replafonné ici (cf. modes-config
 *      best._changeReason : atrStopMult/maxStopPct sont à 0 précisément pour ça) ;
 *   4. pas d'horizon fabriqué : un ordre moteur ne se ferme pas au bout de modeCfg.horizon jours ;
 *   5. une donnée manquante ou inutilisable ⇒ SKIP explicite, jamais une valeur inventée. */
function makeEngineOrder(signal, action, rotation, { sym, restrictions, increment }) {
  const id = `ORD-${String(orderSeq).padStart(3, '0')}`;
  const skip = (reason) => ({ id, action: 'SKIP', ticker: signal.ticker, broker_symbol: sym, reason });

  const orderType = String(signal.orderType || '').toUpperCase();
  if (orderType !== 'LIMIT' && orderType !== 'MARKET') {
    return skip(`Type d'ordre moteur non traduisible: ${JSON.stringify(signal.orderType)}`);
  }

  const qty = signal.qty;
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    return skip(`Quantité moteur absente ou invalide (qty=${JSON.stringify(qty)}) — pas de sizing de substitution`);
  }
  const minSize = restrictions?.min_order_size || 1;
  if (qty < minSize) {
    return skip(`Quantité moteur ${qty} < taille minimale ${BROKER} (${minSize}) — l'arrondir fausserait le sizing du moteur`);
  }

  const rawEntry = signal.limitPrice != null ? signal.limitPrice : signal.entry;
  let entryPrice = null;
  if (orderType === 'LIMIT') {
    if (!Number.isFinite(rawEntry) || rawEntry <= 0) return skip(`Prix limite moteur absent ou invalide (${JSON.stringify(rawEntry)})`);
    entryPrice = roundToIncrement(rawEntry, increment);
    if (!(entryPrice > 0)) return skip(`Prix limite ${rawEntry} arrondi à 0 au pas de cotation ${increment}`);
  }

  const rawStop = signal.stopLoss != null ? signal.stopLoss : signal.stop;
  let stopPrice = null;
  if (Number.isFinite(rawStop) && rawStop > 0) {
    stopPrice = roundToIncrement(rawStop, increment);
    if (!(stopPrice > 0)) stopPrice = null;
  }

  const notional = entryPrice != null ? +(qty * entryPrice).toFixed(2) : null;

  return {
    id,
    action,
    ticker: signal.ticker,
    broker_symbol: sym,
    broker: brokerInfo(signal.ticker),
    source: 'engine',
    engine: {
      as_of: signal.engineAsOf || null,
      engine_mode: signal.engineMode || null,
      note: 'Ordre décidé par le moteur systematic-tss. Quantité, type et stop repris tels quels ; ce générateur ne les recalcule pas.',
    },
    entry: {
      type: orderType,
      price: entryPrice,
      // Pas de vwap_gate : le moteur a décidé un prix limite, un second filtre d'entrée
      // maison écarterait des ordres qu'il a validés.
      size: {
        method: 'ENGINE_QTY',
        shares: qty,
        nominal_usd: notional,
        pct_of_portfolio: null,
        description: 'Quantité imposée par le moteur — ne pas redimensionner côté exécution.',
      },
      valid_from: `${targetISO}T09:30:00-04:00`,
      valid_until: `${targetISO}T16:00:00-04:00`,
      time_in_force: 'DAY',
    },
    exit: {
      managed_by: 'engine',
      stop_loss: stopPrice != null ? {
        type: 'STOP',
        price: stopPrice,
        trailing: false,
        description: 'Stop porté par le moteur. Ne pas trailer ni replafonner côté exécution.',
      } : null,
      take_profit_1: null,
      take_profit_2: null,
      time_exit: null,
      description: 'Le moteur pilote les sorties (rotation/stop). Aucun TP ni horizon n\'est fabriqué ici ; la sortie arrive comme un ordre du plan suivant.',
    },
    conditions: [
      { phase: 'PRE_ENTRY', check: 'HALTED', if_true: 'SKIP_ORDER', description: 'If symbol is halted at market open, skip entirely.' },
      { phase: 'PRE_ENTRY', check: 'SPREAD', max_spread_pct: 0.5, if_true: 'DELAY_30S', description: 'If bid-ask spread > 0.5%, wait 30s for spread to tighten.' },
      { phase: 'POST_FILL', check: 'SLIPPAGE', max_slippage_pct: 1.0, if_exceeded: 'LOG_WARNING', description: 'Log warning if fill price > 1% worse than limit.' },
    ],
    rotation: rotation ? {
      close_ticker: rotation.close,
      close_broker_symbol: brokerSymbol(rotation.close),
      reason: rotation.reason || 'Rotation décidée par le moteur',
    } : undefined,
    metadata: {
      score: signal.score ?? null,
      strategy: signal.strategy || 'Engine',
      rr: signal.rr ?? null,
      sharia: signal.sharia ?? null,
      thesis: signal.thesis,
    },
  };
}

// Build orders — scanner picks first (priority 1), then remaining signals as fallbacks
//
// CAPACITÉ DU MODE (2026-08-12). `MAX_ORDERS` était la constante 5, sans rapport avec le nombre de
// places du compte. Conséquence mesurée sur les 4 modes scanner, tous à 10 000 $ de nominal :
//   turbo    portfolioSize 1  → 5 ordres à 10 000 $ = 50 000 $ pour UNE place (max_positions: 1)
//   dynamic  portfolioSize 1  → 5 ordres à 10 000 $ = 50 000 $ pour UNE place
//   balanced portfolioSize 3  → 5 ordres à 3 333 $  = 16 665 $ pour TROIS places
//   fortress portfolioSize 10 → 5 ordres à   50 $   = cohérent (5 < 10)
// Le plan se contredisait donc lui-même : il déclarait `max_positions` puis proposait davantage de
// positions, chacune dimensionnée comme si elle était seule. Rien ne l'appliquait — ni le plan, ni
// l'exécuteur, qui soumet TOUS les ordres `action: 'BUY'`.
//
// La capacité n'est pas un chiffre à inventer : le mode la déclare déjà (`portfolioSize`, qui sert
// aussi à calculer la taille de chaque position). On la lit.
//
// ⚠️ Les ordres de repêchage n'étaient PAS des remplaçants : ils sortaient en `action: 'BUY'`, donc
// indiscernables du pick principal pour l'exécuteur, qui les aurait tous envoyés. Si l'on veut de
// vrais remplaçants (« si le premier ne se remplit pas à l'ouverture, prendre le suivant »), cela
// demande une action distincte que l'exécuteur sait interpréter — comme la cascade `alternates` de
// la voie moteur — pas des ordres d'achat supplémentaires.
const MAX_ORDERS = Math.max(1, Math.min(5, Number(modeCfg.portfolioSize) || 5));
const orders = [];
const usedTickers = new Set();

for (const o of buyOrders) {
  // Le plafond de capacité vaut AUSSI pour les picks principaux : un topN mal réglé ne doit pas
  // pouvoir dépasser les places du compte par une autre porte. La voie moteur en est exemptée —
  // ses ordres portent les quantités décidées par le moteur et son livre a sa propre capacité,
  // que le plafond du scanner n'a pas à réinterpréter (il est gardé en aval par engine.js).
  if (!IS_DTX && orders.filter(x => x.action !== 'SKIP').length >= MAX_ORDERS) break;
  // Chemin moteur : l'ordre lui-même fait foi (il porte qty/orderType/stop du moteur).
  // signals.json est une vue topN enrichie côté scanner, sans ces champs.
  const sig = IS_DTX ? o : (signals.signals.find(s => s.ticker === o.ticker) || o);
  const order = makeOrder(sig, 'BUY', null);
  order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
  orders.push(order);
  usedTickers.add(o.ticker);
}
for (const o of rotateOrders) {
  const sig = IS_DTX ? o : (signals.signals.find(s => s.ticker === o.ticker) || o);
  const order = makeOrder(sig, 'ROTATE', { close: o.rotate_out || o.close, reason: o.reason });
  order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
  orders.push(order);
  usedTickers.add(o.ticker);
}

// Fallback: raw scanner signals (not topN-filtered), sorted by score.
// Suppressed whenever the mode is not accepting new entries.
// Chemin moteur : AUCUN repêchage. Le pool du moteur est fermé — y verser des signaux
// du scanner (scanner/<date>/signals.json est commun à tous les modes) enverrait au courtier
// des positions que le moteur n'a jamais décidées, sans quantité ni stop de sa main.
const fallbackSignals = (!STATUS_ACCEPTS_ENTRIES || IS_DTX)
  ? []
  : (rawSignals.length > 0 ? rawSignals : signals.signals)
      .filter(s => !usedTickers.has(s.ticker) && s.entry && s.stop && s.tp1)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

for (const sig of fallbackSignals) {
  if (orders.filter(o => o.action !== 'SKIP').length >= MAX_ORDERS) break;
  const order = makeOrder(sig, 'BUY', null);
  if (order.action !== 'SKIP') {
    order.priority = orders.filter(x => x.action !== 'SKIP').length + 1;
    orders.push(order);
  }
}

// ── Close-now positions ──
// In liquidated state, every open position is force-closed at market regardless
// of horizon / SL / TP. Otherwise the normal horizon-expired rule applies.
const closeNow = [];
for (const p of modePositions) {
  const held = bizDaysSince(p.scan_date || p.entry_date);
  if (STATUS_LIQUIDATED) {
    const sym = brokerSymbol(p.ticker);
    closeNow.push({
      action: 'CLOSE',
      ticker: p.ticker,
      broker_symbol: sym || p.ticker,
      broker: brokerInfo(p.ticker),
      reason: 'LIQUIDATION',
      held_days: held,
      horizon: modeCfg.horizon,
      current_pnl_pct: p.return_pct,
      execution: {
        type: 'MARKET',
        timing: 'AT_OPEN',
        description: 'Force-close at market open — mode liquidated, exit immediately regardless of P&L, SL, TP, or horizon',
      },
    });
    continue;
  }
  // Chemin moteur : pas de fermeture sur horizon. Le moteur tient ses positions au-delà de
  // modeCfg.horizon et publie lui-même la sortie ; couper à 14 jours liquiderait des positions
  // qu'il tient encore (même faute que le plafonnement de stop à -15% corrigé le 2026-08-07).
  if (IS_DTX) continue;
  if (held >= modeCfg.horizon) {
    const sym = brokerSymbol(p.ticker);
    closeNow.push({
      action: 'CLOSE',
      ticker: p.ticker,
      broker_symbol: sym || p.ticker,
      broker: brokerInfo(p.ticker),
      reason: 'HORIZON_EXPIRED',
      held_days: held,
      horizon: modeCfg.horizon,
      current_pnl_pct: p.return_pct,
      execution: {
        type: 'MARKET',
        timing: 'AT_OPEN',
        description: 'Close at market open — horizon expired, exit regardless of P&L',
      },
    });
  }
}

// ── Assemble full plan ──
const plan = {
  version: '1.0',
  dsl: 'dailytickers-trading-plan',
  generated_at: now.toISOString(),
  valid_for: targetISO,
  mode_status: ms.statusBlock(
    MODE_STATUS,
    modeCfg.statusSince || null,
    modeCfg.statusReason || null,
    modeCfg.statusNextReviewAt || null
  ),

  broker: {
    name: BROKER_LOOKUP,
    type: BROKER === 'paper' ? 'simulation' : brokerMap.symbols[Object.keys(brokerMap.symbols)[0]]?.brokers[BROKER_LOOKUP] ? 'live' : 'live',
    credentials: {
      api_key: '${BROKER_API_KEY}',
      api_secret: '${BROKER_API_SECRET}',
      base_url: BROKER_LOOKUP === 'alpaca' ? 'https://paper-api.alpaca.markets'
        : BROKER_LOOKUP === 'ibkr' ? 'https://localhost:5000/v1/api'
        : BROKER_LOOKUP === 'trading212' ? 'https://live.trading212.com/api/v0'
        : BROKER_LOOKUP === 'saxo' ? 'https://gateway.saxobank.com/openapi'
        : BROKER_LOOKUP === 'binance' ? 'https://api.binance.com'
        : 'http://localhost:9999',
      note: 'Replace ${BROKER_API_KEY} and ${BROKER_API_SECRET} with actual credentials. For paper trading, use sandbox URLs.',
    },
  },

  account: IS_DTX ? {
    // Le moteur a dimensionné sur SON capital ; republier un nominal maison et un % par ligne
    // laisserait croire que l'exécutant peut recalculer les quantités. Il ne le peut pas.
    nominal_usd: null,
    currency: 'USD',
    position_size_pct: null,
    // `portfolioSize` (15) est la capacité de la poche PORTEUSE, pas celle du livre : les quatre
    // poches ont chacune la leur (uhv 15 · ep 15 · etf_us 7 · mx 10) et le moteur les arbitre
    // lui-même avant d'émettre. Publier 15 face à 18 ordres rendait le plan contradictoire, et
    // aurait fait plafonner le livre par un chiffre qui ne le décrit pas. Même raison que
    // `nominal_usd: null` : ce que ce générateur ne sait pas, il ne l'affirme pas. Le garde de
    // capacité d'engine.js ignore explicitement un plafond non déclaré et borne alors sur le
    // buying power réel du courtier — la seule limite qui soit vraie à l'exécution.
    max_positions: null,
    sizing_source: 'engine',
  } : {
    nominal_usd: nominalUsd,
    currency: 'USD',
    position_size_pct: positionPct,
    max_positions: modeCfg.portfolioSize,
  },

  // Bloc mode : ces paramètres pilotent l'exécutant. Sur un livre moteur, la plupart
  // décrivent une gestion que le moteur assure lui-même — les publier reviendrait à demander
  // au courtier de trailer, de sortir en TP partiel et de couper à l'horizon par-dessus lui.
  mode: IS_DTX ? {
    name: MODE,
    asset_class: 'dtx',
    exits_managed_by: 'engine',
    engine: 'systematic-tss',
    horizon_days: null,
    filter: modeCfg.filterName,
    min_score: null,
    rotation: 'engine',
    breakeven_pct: 0,
    be_grace_days: 0,
    vix_kill: modeCfg.vixKillThreshold,
    trailing_stop: false,
    daily_trail_pct: 0,
    max_stop_pct: 0,
    atr_stop_mult: 0,
    stale_days: 0,
    entry_gate_pct: 0,
    partial_tp: false,
    partial_tp_pct: 0,
    sector_cap_max: modeCfg.sectorCapMax || 0,
    sizing_method: 'engine_qty',
    target_risk_pct: null,
    correlation_cap: modeCfg.correlationCap || 0,
    cross_mode_dedup: modeCfg.crossModeDedup || false,
    regime_filters: {},
    dd_breaker_pct: modeCfg.ddBreakerPct || 5,
    note: 'Sizing, stops et sorties viennent du moteur. L\'exécutant place les ordres tels quels et ne gère aucun TP, trailing ni horizon.',
  } : {
    name: MODE,
    horizon_days: modeCfg.horizon,
    filter: modeCfg.filterName,
    min_score: modeCfg.minScore,
    rotation: modeCfg.rotation,
    breakeven_pct: modeCfg.breakevenPct,
    be_grace_days: modeCfg.beGraceDays || 0,
    vix_kill: modeCfg.vixKillThreshold,
    trailing_stop: modeCfg.trailingStop || false,
    daily_trail_pct: modeCfg.dailyTrailPct || 0,
    max_stop_pct: modeCfg.maxStopPct || 0,
    atr_stop_mult: modeCfg.atrStopMult || 0,
    stale_days: modeCfg.staleDays || 0,
    entry_gate_pct: modeCfg.entryGatePct || 0,
    partial_tp: modeCfg.partialTP || false,
    partial_tp_pct: modeCfg.partialTPPct || 0.5,
    sector_cap_max: modeCfg.sectorCapMax || 0,
    sizing_method: modeCfg.sizingMethod || 'fixed',
    target_risk_pct: modeCfg.targetRiskPct || 1,
    correlation_cap: modeCfg.correlationCap || 0,
    cross_mode_dedup: modeCfg.crossModeDedup || false,
    regime_filters: modeCfg.regimeFilters || {},
    dd_breaker_pct: modeCfg.ddBreakerPct || 5,
  },

  session: {
    market: 'US_EQUITY',
    timezone: 'America/New_York',
    pre_market: '04:00',
    market_open: '09:30',
    market_close: '16:00',
    post_market: '20:00',
    extended_hours: false,
  },

  risk: {
    max_portfolio_heat_pct: (modeCfg.portfolioSize * (modeCfg.positionSizePct || 33.33) * 0.03).toFixed(1),
    max_single_loss_pct: 3,
    max_slippage_pct: 1.0,
    max_spread_pct: 0.5,
    circuit_breaker: {
      daily_loss_pct: modeCfg.ddBreakerPct || 5,
      action: 'HALT_ALL_ORDERS',
      description: `If portfolio drops ${modeCfg.ddBreakerPct || 5}% intraday, cancel all pending orders and alert.`,
    },
    correlation_limit: modeCfg.correlationCap || 0.85,
    max_sector_concentration: modeCfg.sectorCapMax || 3,
  },

  close_now: closeNow,
  orders: orders,

  error_handlers: {
    INSUFFICIENT_MARGIN: {
      action: 'REDUCE_SIZE',
      reduce_pct: 50,
      retry: true,
      max_retries: 1,
    },
    SYMBOL_NOT_FOUND: {
      action: 'SKIP',
      log_level: 'ERROR',
    },
    CONNECTION_LOST: {
      action: 'RECONNECT',
      max_retries: 10,
      backoff_ms: [1000, 2000, 5000, 10000, 30000],
      on_failure: 'CANCEL_PENDING_AND_ALERT',
    },
    PARTIAL_FILL: {
      action: 'KEEP_PARTIAL',
      adjust_exits: true,
      description: 'Keep partial fill. Adjust TP/SL quantities proportionally.',
    },
    ORDER_REJECTED: {
      action: 'LOG_AND_SKIP',
      log_level: 'WARN',
    },
    MARKET_HALTED: {
      action: 'WAIT_RESUME',
      timeout_min: 60,
      on_timeout: 'CANCEL_ORDER',
    },
    RATE_LIMITED: {
      action: 'BACKOFF',
      delay_ms: 5000,
      max_retries: 3,
    },
    DUPLICATE_ORDER: {
      action: 'SKIP',
      description: 'Order for this symbol already exists. Idempotent — skip.',
    },
  },

  lifecycle: {
    on_start: [
      { step: 'CHECK_MARKET_STATUS', description: 'Verify market is open or will open today' },
      { step: 'SYNC_ACCOUNT', description: 'Fetch current account balance, buying power, positions' },
      { step: 'RECONCILE_POSITIONS', description: 'Compare broker positions with expected positions. Alert on discrepancy.' },
      { step: 'CHECK_VIX', threshold: modeCfg.vixKillThreshold, action: 'HALT_IF_ABOVE', description: `If VIX > ${modeCfg.vixKillThreshold}, halt all new orders` },
      { step: 'LOG_STATE', description: 'Log initial account state for audit trail' },
    ],
    on_fill: IS_DTX ? [
      { step: 'PLACE_STOP', description: 'Place the engine stop only. No TP, no bracket — the engine owns the exit.' },
      { step: 'LOG_FILL', description: 'Record fill price, time, slippage, fees' },
      { step: 'NOTIFY', channel: 'telegram', description: 'Send fill notification to Telegram' },
    ] : [
      { step: 'PLACE_EXITS', description: 'Immediately place SL and TP1/TP2 bracket orders' },
      { step: 'LOG_FILL', description: 'Record fill price, time, slippage, fees' },
      { step: 'CHECK_BREAKEVEN', description: 'Start monitoring for breakeven trigger' },
      { step: 'NOTIFY', channel: 'telegram', description: 'Send fill notification to Telegram' },
    ],
    on_exit: [
      { step: 'CANCEL_REMAINING_EXITS', description: 'Cancel the other side (SL if TP hit, TP if SL hit)' },
      { step: 'LOG_EXIT', description: 'Record exit price, P&L, hold time' },
      { step: 'CHECK_ROTATION', description: 'If slot freed, check for pending rotation candidates' },
      { step: 'UPDATE_PORTFOLIO', description: 'Update local portfolio state file' },
    ],
    on_breakeven: [
      { step: 'MODIFY_STOP', description: 'Move stop loss to entry price (+ spread buffer)' },
      { step: 'LOG_BREAKEVEN', description: 'Record breakeven activation' },
    ],
    on_horizon_expiry: [
      { step: 'CLOSE_AT_MARKET', description: 'Submit market close order at next open' },
      { step: 'CANCEL_EXITS', description: 'Cancel any pending TP/SL orders for this position' },
    ],
    on_error: [
      { step: 'LOG_ERROR', description: 'Record error with full context' },
      { step: 'LOOKUP_HANDLER', description: 'Find matching error_handler and execute action' },
      { step: 'NOTIFY_IF_CRITICAL', description: 'Alert on CONNECTION_LOST, CIRCUIT_BREAKER, or unknown errors' },
    ],
    on_end: [
      { step: 'CANCEL_UNFILLED', description: 'Cancel any GTC orders that were not filled today' },
      { step: 'EXPORT_TRADES', description: 'Write execution log to trades-YYYYMMDD.json' },
      { step: 'SUMMARY', description: 'Print session summary: fills, skips, errors, P&L' },
    ],
  },

  broker_notes: {
    alpaca: {
      pdt_rule: 'Pattern Day Trader: max 3 day trades in 5 business days if account < $25K',
      fractional: 'Alpaca supports fractional shares — use exact nominal instead of rounding to whole shares',
      paper_url: 'https://paper-api.alpaca.markets',
      live_url: 'https://api.alpaca.markets',
      websocket: 'wss://stream.data.alpaca.markets/v2/iex',
      auth: 'Headers: APCA-API-KEY-ID + APCA-API-SECRET-KEY',
    },
    ibkr: {
      gateway: 'Requires IB Gateway or TWS running locally on port 5000',
      auth: 'Session-based — authenticate via Client Portal then use session token',
      order_types: 'Supports all order types including adaptive, pegged, TWAP',
      fractional: 'No fractional shares on IBKR',
      min_commission: '$1.00 per trade',
    },
    trading212: {
      api_limits: 'Very limited API — equity orders only, no bracket orders',
      fractional: 'Supports fractional shares down to 0.001',
      symbol_format: 'Append _US_EQ for US equities (e.g., GOOGL_US_EQ)',
      workaround: 'No native bracket orders — must monitor and place SL/TP separately',
    },
    saxo: {
      auth: 'OAuth2 — requires authorization code flow',
      symbol_format: 'Use Uic (unique instrument code) or SYMBOL:EXCHANGE format',
      order_types: 'Supports limit, stop, trailing stop, OCO',
      related_orders: 'Supports related orders (bracket) natively',
    },
    binance: {
      crypto_only: 'Binance only supports crypto pairs — not applicable for stock signals',
      symbol_format: 'Trading pairs like BTCUSDT, ETHUSDT',
    },
  }[BROKER_LOOKUP] || {},
};

// ── Output ──
const json = JSON.stringify(plan, null, 2);
const outPath = OUTPUT || path.join(ROOT, `data/trading-plans/${MODE}-${BROKER_LOOKUP}-${DATE}.json`);

if (DRY_RUN) {
  console.log(json);
  process.stderr.write(`✅ Dry run — plan for ${MODE}/${BROKER} with ${orders.length} orders, ${closeNow.length} close-now\n`);
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.log(`✅ Trading plan written: ${outPath}`);
  console.log(`   Mode: ${MODE} | Broker: ${BROKER} | Orders: ${orders.length} | Close: ${closeNow.length}`);
  console.log(`   Valid for: ${targetISO} | Horizon: ${modeCfg.horizon}d | Expiry: ${expiryDate}`);
}
