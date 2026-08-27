'use strict';

// Engine — state machine that interprets a DSL trading plan and drives a broker adapter.
// Phases: INIT → PRE_MARKET → OPEN_SESSION → MONITOR → CLOSE_SESSION → DONE

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { MarketDataEngine } = require('./market-data/engine');

const PHASES = ['INIT', 'PRE_MARKET', 'OPEN_SESSION', 'MONITOR', 'CLOSE_SESSION', 'DONE'];

const ORDER_STATES = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  PARTIAL: 'PARTIAL',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  SKIPPED: 'SKIPPED',
};

class Engine extends EventEmitter {
  constructor(plan, adapter, opts = {}) {
    super();
    if (plan && (plan.contract_version === '2.0' || plan.execution_plan)) {
      throw new Error(
        'Refusing DtxDecide Contract V2 plan in legacy trading-executor. ' +
        'V2 plans must be executed by a dedicated broker-mcp DTX V2 client that implements ' +
        'tools/trading-executor/DTX_DECIDE_V2_CONTRACT.md.'
      );
    }
    this.plan = plan;
    this.adapter = adapter;
    this.verbose = opts.verbose || false;
    this.logDir = opts.logDir || './logs';
    this.phase = 'INIT';
    this.running = false;
    this.trades = [];
    this.orderState = new Map(); // orderId → { state, brokerOrderId, fills, ... }
    this.positionState = new Map(); // ticker → { qty, avgPrice, unrealizedPnl, exitOrders }
    this.sectorCount = new Map(); // sector → count of open/submitted positions
    this.errors = [];
    this.log = [];
    this._monitorInterval = null;
    this.marketData = opts.marketData || null;
    this._entryPhaseLog = new Map();
    this._lastBars = new Map();
    // Capacité — état du garde (R5). `_accountSnapshot` est rempli en INIT ; `_committedNotional`
    // suit le notionnel ENGAGÉ (positions reprises au courtier + entrées soumises), parce que
    // « déjà soumis » consomme du buying power aussi sûrement que « déjà rempli ».
    this._accountSnapshot = null;
    this._committedNotional = 0;
    this._capacitySkips = [];
  }

  /**
   * GARDE DE CAPACITÉ — refuse une entrée qui dépasserait le compte (R5, 2026-08-12).
   *
   * Mesuré avant correction : `gen-trading-plan --mode best` rendait 18 ordres pour 23 197 $ de
   * notionnel sur un compte à 10 000 $, dans un plan déclarant lui-même `max_positions: 15` — donc
   * incohérent avec ses propres ordres. Rien ici ne le voyait : aucun contrôle de buying power,
   * aucun plafond de notionnel, aucune application de max_positions à la soumission. Les ordres
   * partaient tous, et c'est le courtier qui tranchait (ou pas).
   *
   * Trois plafonds, tous appliqués, le plus contraignant gagne :
   *   · max_notional_usd — plafond de la liste blanche versionnée, reporté sur le plan ;
   *   · nominal_usd      — capital déclaré du plan ;
   *   · buying_power     — ce que le courtier dit réellement disponible.
   * Plus max_positions, compté sur positions ouvertes + entrées soumises.
   *
   * Un plafond ABSENT n'est pas un plafond infini par accident : `null`/`undefined` est traité comme
   * « non déclaré » et ignoré explicitement, et le journal dit lequel a mordu. Un plan moteur porte
   * `nominal_usd: null` volontairement — c'est alors le buying power du courtier qui borne.
   *
   * @returns {{ok: boolean, reason: string|null}}
   */
  _checkCapacity(order, refPrice) {
    const acct = this.plan.account || {};
    const shares = Number(order.entry?.size?.shares);
    // Prix de référence : le prix réellement visé au moment de la soumission (voie VWAP), sinon
    // celui du plan, sinon reconstitué depuis le notionnel. Un ordre MARKET sans aucun de ces trois
    // n'est pas mesurable — et il est refusé plus bas, pas laissé passer.
    const price = Number(refPrice) || Number(order.entry?.price) || Number(order.entry?.size?.nominal_usd) / (shares || 1);
    const notional = Number.isFinite(shares) && Number.isFinite(price) && shares > 0 && price > 0
      ? shares * price
      : null;

    // Compte des positions : ouvertes chez le courtier + entrées déjà soumises non annulées.
    const submitted = [...this.orderState.values()].filter(os =>
      os.state === ORDER_STATES.SUBMITTED || os.state === ORDER_STATES.PARTIAL || os.state === ORDER_STATES.FILLED).length;
    const openPositions = this.positionState.size;
    const maxPositions = Number(acct.max_positions);
    if (Number.isFinite(maxPositions) && maxPositions > 0 && (openPositions + submitted) >= maxPositions) {
      return { ok: false, reason: `plafond de positions atteint (${openPositions} ouvertes + ${submitted} soumises ≥ max_positions ${maxPositions})` };
    }

    if (notional == null) {
      // Sans quantité ni prix exploitables on ne peut RIEN affirmer sur la capacité. On refuse :
      // laisser passer un ordre dont on ne sait pas mesurer le coût vide le garde de son sens.
      return { ok: false, reason: `notionnel non mesurable (shares=${order.entry?.size?.shares}, price=${order.entry?.price}) — refus par prudence` };
    }

    // `Number(null)` vaut 0 et passe isFinite : sans ce filtre, un champ NON DÉCLARÉ devenait un
    // plafond de 0 $ et refusait tout. C'est exactement le cas d'un plan moteur, qui porte
    // `nominal_usd: null` à dessein — le garde l'aurait vidé de ses 18 ordres pour la mauvaise
    // raison, en affichant « dépasse nominal_usd ». Non déclaré = pas de plafond de cette source.
    const declared = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const ceilings = [];
    const capWl = declared(acct.max_notional_usd);
    if (capWl != null) ceilings.push(['max_notional_usd (liste blanche)', capWl]);
    const capPlan = declared(acct.nominal_usd);
    if (capPlan != null) ceilings.push(['nominal_usd (plan)', capPlan]);
    const bp = declared(this._accountSnapshot && this._accountSnapshot.buying_power);
    if (bp != null) ceilings.push(['buying_power (courtier)', bp]);

    if (!ceilings.length) {
      return { ok: false, reason: 'aucun plafond de capacité connu (ni liste blanche, ni plan, ni courtier) — refus par prudence' };
    }

    for (const [label, cap] of ceilings) {
      if (this._committedNotional + notional > cap) {
        return {
          ok: false,
          reason: `dépasse ${label} — engagé ${this._committedNotional.toFixed(0)} $ + ${notional.toFixed(0)} $ > ${cap.toFixed(0)} $`,
        };
      }
    }
    return { ok: true, reason: null, notional };
  }

  /** Applique le garde ; journalise et marque l'ordre SKIPPED si refusé. `true` = on peut soumettre. */
  _admitEntry(order, os, refPrice) {
    const v = this._checkCapacity(order, refPrice);
    if (!v.ok) {
      this._log('WARN', `${order.ticker}: entrée refusée par le garde de capacité — ${v.reason}`);
      this._capacitySkips.push({ order: order.id, ticker: order.ticker, reason: v.reason });
      os.state = ORDER_STATES.SKIPPED;
      return false;
    }
    this._committedNotional += v.notional;
    return true;
  }

  _log(level, msg, data) {
    const entry = { ts: new Date().toISOString(), level, msg, data };
    this.log.push(entry);
    if (this.verbose || level === 'ERROR' || level === 'WARN') {
      const icon = { INFO: 'ℹ️', WARN: '⚠️', ERROR: '❌', FILL: '✅', TRADE: '💰', PHASE: '🔄' }[level] || '•';
      console.log(`${icon} [${entry.ts.slice(11, 19)}] ${msg}`, data ? JSON.stringify(data).slice(0, 200) : '');
    }
  }

  async run() {
    this.running = true;
    this._log('PHASE', `Engine starting — mode=${this.plan.mode.name} broker=${this.plan.broker.name}`);

    try {
      await this._phaseInit();
      await this._phasePreMarket();
      await this._phaseOpenSession();
      await this._phaseMonitor();
      await this._phaseClose();
    } catch (err) {
      this._log('ERROR', 'Fatal engine error', { error: err.message, stack: err.stack });
      throw err;
    } finally {
      this.phase = 'DONE';
      await this._exportLog();
    }
  }

  // ── Phase: INIT ──
  async _phaseInit() {
    this.phase = 'INIT';
    this._log('PHASE', 'Phase: INIT — connecting to broker');

    await this.adapter.connect();
    const account = await this.adapter.getAccount();
    this._accountSnapshot = account; // buying power réel — un des trois plafonds du garde de capacité
    this._log('INFO', 'Account connected', {
      balance: account.balance,
      buying_power: account.buying_power,
      currency: account.currency,
    });

    // Reconcile existing positions
    const brokerPositions = await this.adapter.getPositions();
    this._log('INFO', `Broker has ${brokerPositions.length} open positions`);

    for (const bp of brokerPositions) {
      this.positionState.set(bp.symbol, {
        qty: bp.qty,
        avgPrice: bp.avg_price,
        unrealizedPnl: bp.unrealized_pnl,
        side: bp.side,
        brokerManaged: true,
      });
      // Le capital déjà immobilisé compte dans le plafond : une session qui repart sur un compte
      // chargé n'a pas la capacité d'un compte vide.
      const held = Number(bp.qty) * Number(bp.avg_price);
      if (Number.isFinite(held) && held > 0) this._committedNotional += held;
    }
    if (this._committedNotional > 0) {
      this._log('INFO', `Capacité : ${this._committedNotional.toFixed(0)} $ déjà engagés en positions reprises`);
    }

    // Init order states
    for (const order of this.plan.orders) {
      this.orderState.set(order.id, {
        state: order.action === 'SKIP' ? ORDER_STATES.SKIPPED : ORDER_STATES.PENDING,
        brokerOrderId: null,
        fills: [],
        exitOrders: [],
        ticker: order.ticker,
        brokerSymbol: order.broker_symbol,
      });
    }

    if (this.marketData) {
      const entrySymbols = this.plan.orders
        .filter(o => o.action === 'BUY' || o.action === 'ROTATE')
        .map(o => o.broker_symbol);
      if (entrySymbols.length > 0) {
        await this.marketData.start(entrySymbols);
        this.marketData.subscribe('5m', (bar) => {
          this._lastBars.set(bar.symbol, bar);
        });
        this._log('INFO', `MarketData started for ${entrySymbols.length} symbols (VWAP + 5m bars)`);
      }
    }
  }

  // ── Phase: PRE_MARKET ──
  async _phasePreMarket() {
    this.phase = 'PRE_MARKET';
    this._log('PHASE', 'Phase: PRE_MARKET — running checks');

    for (const step of (this.plan.lifecycle.on_start || [])) {
      switch (step.step) {
        case 'CHECK_MARKET_STATUS': {
          const status = await this.adapter.getMarketStatus();
          if (status === 'closed' && !this._isWeekday()) {
            this._log('WARN', 'Market closed today — aborting');
            this.running = false;
            return;
          }
          this._log('INFO', `Market status: ${status}`);
          break;
        }
        case 'CHECK_VIX': {
          try {
            const vix = await this.adapter.getQuote('VIX');
            if (vix && step.threshold && vix.last > step.threshold) {
              this._log('WARN', `VIX ${vix.last} > kill threshold ${step.threshold} — halting new orders`);
              for (const [id, os] of this.orderState) {
                if (os.state === ORDER_STATES.PENDING) os.state = ORDER_STATES.SKIPPED;
              }
            } else {
              this._log('INFO', `VIX check passed: ${vix?.last || 'N/A'} < ${step.threshold}`);
            }
          } catch (_) {
            this._log('WARN', 'VIX check failed — proceeding without');
          }
          break;
        }
        case 'CHECK_REGIME': {
          const regimeFilters = this.plan.mode.regime_filters;
          if (!regimeFilters || Object.keys(regimeFilters).length === 0) break;
          try {
            const vix = await this.adapter.getQuote('VIX');
            let regime = 'neutral';
            if (vix?.last < 15) regime = 'risk_on';
            else if (vix?.last < 20) regime = 'neutral';
            else if (vix?.last < 25) regime = 'early_risk_off';
            else regime = 'risk_off';

            const allowedFilter = regimeFilters[regime];
            if (allowedFilter && allowedFilter !== 'all') {
              this._log('INFO', `Regime: ${regime} → filter=${allowedFilter}`);
              for (const [id, os] of this.orderState) {
                if (os.state !== ORDER_STATES.PENDING) continue;
                const order = this.plan.orders.find(o => o.id === id);
                if (!order?.metadata?.strategy) continue;
                const strategy = order.metadata.strategy.toLowerCase();
                const pass = allowedFilter === 'mom_bo' ? (strategy.includes('momentum') || strategy.includes('breakout'))
                  : allowedFilter === 'momentum_only' ? strategy.includes('momentum')
                  : allowedFilter === 'breakout_only' ? strategy.includes('breakout')
                  : true;
                if (!pass) {
                  os.state = ORDER_STATES.SKIPPED;
                  this._log('INFO', `${os.ticker}: skipped by regime filter (${regime}→${allowedFilter}, strategy=${strategy})`);
                }
              }
            }
          } catch (_) {
            this._log('WARN', 'Regime check failed — proceeding without filter');
          }
          break;
        }
        case 'SYNC_ACCOUNT':
        case 'RECONCILE_POSITIONS':
        case 'LOG_STATE':
          this._log('INFO', `Pre-market: ${step.step}`);
          break;
      }
    }

    // Auto regime check if regime_filters defined but CHECK_REGIME not in lifecycle steps
    const hasRegimeStep = (this.plan.lifecycle.on_start || []).some(s => s.step === 'CHECK_REGIME');
    if (!hasRegimeStep && this.plan.mode.regime_filters && Object.keys(this.plan.mode.regime_filters).length > 0) {
      try {
        const vix = await this.adapter.getQuote('VIX');
        let regime = 'neutral';
        if (vix?.last < 15) regime = 'risk_on';
        else if (vix?.last < 20) regime = 'neutral';
        else if (vix?.last < 25) regime = 'early_risk_off';
        else regime = 'risk_off';

        const allowedFilter = this.plan.mode.regime_filters[regime];
        if (allowedFilter && allowedFilter !== 'all') {
          this._log('INFO', `Auto regime check: ${regime} → filter=${allowedFilter}`);
          for (const [id, os] of this.orderState) {
            if (os.state !== ORDER_STATES.PENDING) continue;
            const order = this.plan.orders.find(o => o.id === id);
            if (!order?.metadata?.strategy) continue;
            const strategy = order.metadata.strategy.toLowerCase();
            const pass = allowedFilter === 'mom_bo' ? (strategy.includes('momentum') || strategy.includes('breakout'))
              : allowedFilter === 'momentum_only' ? strategy.includes('momentum')
              : allowedFilter === 'breakout_only' ? strategy.includes('breakout')
              : true;
            if (!pass) {
              os.state = ORDER_STATES.SKIPPED;
              this._log('INFO', `${os.ticker}: skipped by auto regime filter (${regime}→${allowedFilter}, strategy=${strategy})`);
            }
          }
        }
      } catch (_) {
        this._log('WARN', 'Auto regime check failed — proceeding without filter');
      }
    }
  }

  // ── Phase: OPEN_SESSION ──
  async _phaseOpenSession() {
    this.phase = 'OPEN_SESSION';
    this._log('PHASE', 'Phase: OPEN_SESSION — executing close-now + placing orders');

    // 1. Close expired positions first
    for (const close of (this.plan.close_now || [])) {
      try {
        this._log('TRADE', `Closing ${close.ticker} — ${close.reason}`, { held: close.held_days });
        const result = await this.adapter.closePosition(close.broker_symbol);
        this.trades.push({
          type: 'CLOSE',
          ticker: close.ticker,
          reason: close.reason,
          result,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        await this._handleError('CLOSE_FAILED', err, { ticker: close.ticker });
      }
    }

    // 2. Process rotation orders (close first, then buy)
    const rotations = this.plan.orders.filter(o => o.action === 'ROTATE' && o.rotation);
    for (const rot of rotations) {
      const os = this.orderState.get(rot.id);
      if (os.state !== ORDER_STATES.PENDING) continue;

      try {
        // Close the rotation target
        this._log('TRADE', `Rotation: closing ${rot.rotation.close_ticker} for ${rot.ticker}`);
        await this.adapter.closePosition(rot.rotation.close_broker_symbol);

        // Place the buy
        await this._placeEntryVWAP(rot);
      } catch (err) {
        await this._handleError('ROTATION_FAILED', err, { order: rot.id });
      }
    }

    // 3. Place buy orders
    // Seed sector counts from already-open positions
    for (const [ticker] of this.positionState) {
      const order = this.plan.orders.find(o => o.broker_symbol === ticker || o.ticker === ticker);
      if (order?.metadata?.sector) {
        this.sectorCount.set(order.metadata.sector, (this.sectorCount.get(order.metadata.sector) || 0) + 1);
      }
    }

    const buys = this.plan.orders.filter(o => o.action === 'BUY');
    for (const order of buys) {
      const os = this.orderState.get(order.id);
      if (os.state !== ORDER_STATES.PENDING) continue;

      // Sector cap check
      const sectorCap = this.plan.mode.sector_cap_max;
      if (sectorCap > 0 && order.metadata?.sector) {
        const current = this.sectorCount.get(order.metadata.sector) || 0;
        if (current >= sectorCap) {
          this._log('WARN', `${order.ticker}: sector cap reached (${order.metadata.sector}: ${current}/${sectorCap}) — skipping`);
          os.state = ORDER_STATES.SKIPPED;
          continue;
        }
      }

      try {
        await this._placeEntryVWAP(order);
        // Increment sector count on successful submission
        if (order.metadata?.sector) {
          this.sectorCount.set(order.metadata.sector, (this.sectorCount.get(order.metadata.sector) || 0) + 1);
        }
      } catch (err) {
        await this._handleError(err.code || 'ORDER_FAILED', err, { order: order.id });
      }
    }
  }

  async _placeEntry(order) {
    const os = this.orderState.get(order.id);

    // Pre-entry condition checks
    for (const cond of (order.conditions || []).filter(c => c.phase === 'PRE_ENTRY')) {
      switch (cond.check) {
        case 'GAP_UP': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.last > order.entry.price * (cond.threshold_ratio || 1.02)) {
              this._log('WARN', `${order.ticker}: gap-up detected (${quote.last} > ${order.entry.price * cond.threshold_ratio}). ${cond.if_true}`);
              if (cond.if_true === 'SKIP_ORDER') { os.state = ORDER_STATES.SKIPPED; return; }
              if (cond.if_true === 'WAIT_VWAP_PULLBACK') {
                // Check VWAP gate: if enabled and price > entry × max_open_ratio, place limit at entry
                if (order.entry.vwap_gate?.enabled) {
                  const maxOpenRatio = order.entry.vwap_gate.max_open_ratio || 1.01;
                  if (quote.last > order.entry.price * maxOpenRatio) {
                    this._log('INFO', `VWAP gate: placing limit at ${order.entry.price} instead of market (gap-up detected)`);
                    order.entry.type = 'LIMIT';
                  }
                }
              }
            }
          } catch (_) {}
          break;
        }
        case 'HALTED': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.halted) {
              this._log('WARN', `${order.ticker}: trading halted — skipping`);
              os.state = ORDER_STATES.SKIPPED;
              return;
            }
          } catch (_) {}
          break;
        }
        case 'SPREAD': {
          try {
            const quote = await this.adapter.getQuote(order.broker_symbol);
            if (quote && quote.bid && quote.ask) {
              const spreadPct = ((quote.ask - quote.bid) / quote.bid) * 100;
              if (spreadPct > (cond.max_spread_pct || 0.5)) {
                this._log('WARN', `${order.ticker}: spread ${spreadPct.toFixed(2)}% > ${cond.max_spread_pct}% — delaying`);
                await this._sleep(30000);
              }
            }
          } catch (_) {}
          break;
        }
      }
    }

    // Entry gate — skip if current price has moved too far above entry
    const entryGatePct = this.plan.mode.entry_gate_pct;
    if (entryGatePct > 0) {
      try {
        const quote = await this.adapter.getQuote(order.broker_symbol);
        if (quote?.last) {
          const gatePrice = order.entry.price * (1 + entryGatePct / 100);
          if (quote.last > gatePrice) {
            this._log('WARN', `${order.ticker}: entry gate failed (${quote.last} > gate ${gatePrice.toFixed(2)}) — skipping`);
            os.state = ORDER_STATES.SKIPPED;
            return;
          }
        }
      } catch (_) {}
    }

    // Inverse ATR sizing
    if (this.plan.mode.sizing_method === 'inverse_atr' && order.entry.size.shares) {
      try {
        const quote = await this.adapter.getQuote(order.broker_symbol);
        if (quote && quote.atr14) {
          const riskPerShare = quote.atr14 * (this.plan.mode.atr_stop_mult || 2);
          const capitalPerPos = this.plan.account.nominal_usd / (this.plan.account.max_positions || 1);
          const riskBudget = capitalPerPos * (this.plan.mode.target_risk_pct || 1) / 100;
          const atrShares = Math.floor(riskBudget / riskPerShare);
          if (atrShares > 0 && atrShares !== order.entry.size.shares) {
            this._log('INFO', `${order.ticker}: ATR sizing ${order.entry.size.shares} → ${atrShares} shares (ATR14=${quote.atr14.toFixed(2)}, risk=${riskBudget.toFixed(0)})`);
            order.entry.size.shares = atrShares;
          }
        }
      } catch (_) { /* fallback to fixed size */ }
    }

    // Garde de capacité — APRÈS le sizing (ATR peut changer la quantité), juste avant la soumission.
    if (!this._admitEntry(order, os)) return;

    // Submit order
    this._log('INFO', `Placing ${order.action} ${order.ticker} @ ${order.entry.price} x${order.entry.size.shares}`);
    const brokerOrder = await this.adapter.placeOrder({
      symbol: order.broker_symbol,
      side: 'buy',
      type: order.entry.type.toLowerCase(),
      qty: order.entry.size.shares,
      limit_price: order.entry.price,
      time_in_force: (order.entry.time_in_force || 'DAY').toLowerCase(),
    });

    os.brokerOrderId = brokerOrder.id;
    os.state = ORDER_STATES.SUBMITTED;
    this._log('INFO', `Order ${order.id} submitted → broker ID: ${brokerOrder.id}`);
  }

  // ── VWAP-based 3-phase entry ──
  async _placeEntryVWAP(order) {
    // Fallback: no marketData or unrecognized strategy → use simple entry
    const strategy = (order.metadata?.strategy || '').toUpperCase();
    if (!this.marketData || !['MOMENTUM', 'BREAKOUT', 'PULLBACK'].includes(strategy)) {
      return this._placeEntry(order);
    }

    const os = this.orderState.get(order.id);
    const symbol = order.broker_symbol;

    // Pre-entry condition checks (HALTED, SPREAD) — mirror _placeEntry
    for (const cond of (order.conditions || []).filter(c => c.phase === 'PRE_ENTRY')) {
      switch (cond.check) {
        case 'HALTED': {
          try {
            const q = await this.adapter.getQuote(symbol);
            if (q && q.halted) {
              this._log('WARN', `${order.ticker}: trading halted — skipping`);
              os.state = ORDER_STATES.SKIPPED;
              return;
            }
          } catch (_) {}
          break;
        }
        case 'SPREAD': {
          try {
            const q = await this.adapter.getQuote(symbol);
            if (q && q.bid && q.ask) {
              const spreadPct = ((q.ask - q.bid) / q.bid) * 100;
              if (spreadPct > (cond.max_spread_pct || 0.5)) {
                this._log('WARN', `${order.ticker}: spread ${spreadPct.toFixed(2)}% > ${cond.max_spread_pct}% — delaying`);
                await this._sleep(30000);
              }
            }
          } catch (_) {}
          break;
        }
      }
    }

    // Entry gate check
    const entryGatePct = this.plan.mode.entry_gate_pct;
    if (entryGatePct > 0) {
      try {
        const q = await this.adapter.getQuote(symbol);
        if (q?.last) {
          const gatePrice = order.entry.price * (1 + entryGatePct / 100);
          if (q.last > gatePrice) {
            this._log('WARN', `${order.ticker}: entry gate failed (${q.last} > gate ${gatePrice.toFixed(2)}) — skipping`);
            os.state = ORDER_STATES.SKIPPED;
            return;
          }
        }
      } catch (_) {}
    }

    const entry = order.entry.price;
    const stop = order.exit?.stop_loss?.price || entry * 0.95;
    const avgVol = order.metadata?.avg_volume || 0;
    const MAX_POLLS = 600; // 2.5h at 15s interval
    const POLL_INTERVAL = 15000;

    this._log('INFO', `${order.ticker}: VWAP entry loop start (strategy=${strategy}, entry=${entry})`);

    let lastPhase = -99;

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      const phase = this._getEntryPhase();

      if (phase === 0) {
        this._log('WARN', `${order.ticker}: past deadline (phase=0) — skipping`);
        os.state = ORDER_STATES.SKIPPED;
        return;
      }

      if (phase !== lastPhase && phase > 0) {
        this._log('INFO', `${order.ticker}: entering phase ${phase} (${this._minutesSinceOpen()}min since open, strategy=${strategy})`);
        lastPhase = phase;
      }

      let tick, vwapData, bar5m;
      try {
        tick = this.marketData.getQuote(symbol);
        vwapData = this.marketData.getVWAP(symbol);
        bar5m = this._lastBars.get(symbol);
      } catch (_) {}

      const price = tick?.price || 0;
      const vwap = vwapData?.vwap || 0;
      const cumVol = vwapData?.cumVol || 0;

      let triggered = false;
      let triggerReason = '';
      let orderType = 'LIMIT';
      let limitPrice = price;

      if (strategy === 'MOMENTUM') {
        if (phase === 1) {
          // 5min green candle + price ≤ entry × 1.02
          const greenCandle = bar5m && bar5m.close > bar5m.open;
          if (greenCandle && price > 0 && price <= entry * 1.02) {
            triggered = true;
            triggerReason = `Phase1 MOMENTUM: green candle + price ${price} ≤ entry×1.02 ${(entry * 1.02).toFixed(2)}`;
            orderType = 'LIMIT';
            limitPrice = price;
          }
        } else if (phase === 2) {
          // price ≤ entry
          if (price > 0 && price <= entry) {
            triggered = true;
            triggerReason = `Phase2 MOMENTUM: price ${price} ≤ entry ${entry}`;
            orderType = 'LIMIT';
            limitPrice = price;
          }
        } else if (phase === 3) {
          // price < entry × 1.02 → market, else skip
          if (price > 0 && price < entry * 1.02) {
            triggered = true;
            triggerReason = `Phase3 MOMENTUM: deadline market (price=${price})`;
            orderType = 'MARKET';
          } else {
            this._log('WARN', `${order.ticker}: Phase3 MOMENTUM gap-up trap (price=${price} ≥ entry×1.02) — skipping`);
            os.state = ORDER_STATES.SKIPPED;
            return;
          }
        }
      } else if (strategy === 'BREAKOUT') {
        if (phase === 1) {
          // price > entry AND volume confirm AND no false breakout
          const volConfirm = avgVol > 0 ? cumVol > avgVol * 1.5 : true;
          const falseBreakout = bar5m && bar5m.high > entry && bar5m.close < stop;
          if (price > entry && volConfirm && !falseBreakout) {
            triggered = true;
            triggerReason = `Phase1 BREAKOUT: price ${price} > entry ${entry}, vol confirm (cumVol=${cumVol}, avgVol=${avgVol})`;
            orderType = 'LIMIT';
            limitPrice = price;
          }
        } else if (phase === 2) {
          // price in [stop, entry]
          if (price > 0 && price >= stop && price <= entry) {
            triggered = true;
            triggerReason = `Phase2 BREAKOUT: price ${price} in [stop ${stop}, entry ${entry}]`;
            orderType = 'LIMIT';
            limitPrice = stop;
          }
        } else if (phase === 3) {
          if (price > 0 && price < entry * 1.02) {
            triggered = true;
            triggerReason = `Phase3 BREAKOUT: deadline market (price=${price})`;
            orderType = 'MARKET';
          } else {
            this._log('WARN', `${order.ticker}: Phase3 BREAKOUT skip (price=${price} ≥ entry×1.02)`);
            os.state = ORDER_STATES.SKIPPED;
            return;
          }
        }
      } else if (strategy === 'PULLBACK') {
        if (phase === 1) {
          // price < VWAP AND 5min green candle (VWAP reclaim)
          const greenCandle = bar5m && bar5m.close > bar5m.open;
          if (vwap > 0 && price < vwap && greenCandle) {
            triggered = true;
            triggerReason = `Phase1 PULLBACK: price ${price} < VWAP ${vwap} + green candle (VWAP reclaim)`;
            orderType = 'LIMIT';
            limitPrice = price;
          }
        } else if (phase === 2) {
          // price ≤ entry AND price < VWAP
          if (price > 0 && price <= entry && vwap > 0 && price < vwap) {
            triggered = true;
            triggerReason = `Phase2 PULLBACK: price ${price} ≤ entry ${entry} and < VWAP ${vwap}`;
            orderType = 'LIMIT';
            limitPrice = price;
          }
        } else if (phase === 3) {
          if (price > 0 && price < entry * 1.01) {
            triggered = true;
            triggerReason = `Phase3 PULLBACK: deadline market (price=${price})`;
            orderType = 'MARKET';
          } else {
            this._log('WARN', `${order.ticker}: Phase3 PULLBACK skip (price=${price} ≥ entry×1.01)`);
            os.state = ORDER_STATES.SKIPPED;
            return;
          }
        }
      }

      if (triggered) {
        this._log('INFO', `${order.ticker}: VWAP trigger — ${triggerReason}`);

        // Inverse ATR sizing
        if (this.plan.mode.sizing_method === 'inverse_atr' && order.entry.size.shares) {
          try {
            const q = await this.adapter.getQuote(symbol);
            if (q && q.atr14) {
              const riskPerShare = q.atr14 * (this.plan.mode.atr_stop_mult || 2);
              const capitalPerPos = this.plan.account.nominal_usd / (this.plan.account.max_positions || 1);
              const riskBudget = capitalPerPos * (this.plan.mode.target_risk_pct || 1) / 100;
              const atrShares = Math.floor(riskBudget / riskPerShare);
              if (atrShares > 0 && atrShares !== order.entry.size.shares) {
                this._log('INFO', `${order.ticker}: ATR sizing ${order.entry.size.shares} → ${atrShares} shares`);
                order.entry.size.shares = atrShares;
              }
            }
          } catch (_) {}
        }

        // Garde de capacité — même point qu'en voie non-VWAP : après sizing, avant soumission.
        if (!this._admitEntry(order, os, orderType === 'LIMIT' ? limitPrice : undefined)) return;

        this._log('INFO', `Placing ${order.action} ${order.ticker} @ ${orderType === 'MARKET' ? 'MARKET' : limitPrice} x${order.entry.size.shares}`);
        const brokerOrder = await this.adapter.placeOrder({
          symbol,
          side: 'buy',
          type: orderType.toLowerCase(),
          qty: order.entry.size.shares,
          limit_price: orderType === 'LIMIT' ? limitPrice : undefined,
          time_in_force: (order.entry.time_in_force || 'DAY').toLowerCase(),
        });
        os.brokerOrderId = brokerOrder.id;
        os.state = ORDER_STATES.SUBMITTED;
        this._log('INFO', `Order ${order.id} submitted → broker ID: ${brokerOrder.id}`);
        return;
      }

      await this._sleep(POLL_INTERVAL);
    }

    this._log('WARN', `${order.ticker}: VWAP entry loop exhausted (${MAX_POLLS} polls) — skipping`);
    os.state = ORDER_STATES.SKIPPED;
  }

  // ── Phase: MONITOR ──
  async _phaseMonitor() {
    this.phase = 'MONITOR';
    this._log('PHASE', 'Phase: MONITOR — watching fills and managing positions');

    const submittedOrders = [...this.orderState.entries()].filter(([, os]) => os.state === ORDER_STATES.SUBMITTED);
    if (submittedOrders.length === 0) {
      this._log('INFO', 'No submitted orders to monitor');
      return;
    }

    // Poll loop — check fills every 5 seconds
    const MAX_POLLS = 720; // 1 hour max
    let polls = 0;

    while (this.running && polls < MAX_POLLS) {
      polls++;
      let allTerminal = true;

      for (const [orderId, os] of this.orderState) {
        if (os.state !== ORDER_STATES.SUBMITTED && os.state !== ORDER_STATES.PARTIAL) continue;
        allTerminal = false;

        try {
          const status = await this.adapter.getOrderStatus(os.brokerOrderId);

          if (status.status === 'filled') {
            os.state = ORDER_STATES.FILLED;
            os.fills.push({ price: status.filled_avg_price, qty: status.filled_qty, ts: status.filled_at });
            this._log('FILL', `${os.ticker} FILLED @ ${status.filled_avg_price} x${status.filled_qty}`);

            // Execute on_fill lifecycle
            await this._onFill(orderId, os, status);
          } else if (status.status === 'partially_filled') {
            os.state = ORDER_STATES.PARTIAL;
            this._log('INFO', `${os.ticker} partial fill: ${status.filled_qty}/${status.qty}`);
          } else if (status.status === 'cancelled' || status.status === 'expired') {
            os.state = ORDER_STATES.CANCELLED;
            this._log('WARN', `${os.ticker} order ${status.status}`);
          } else if (status.status === 'rejected') {
            os.state = ORDER_STATES.REJECTED;
            this._log('ERROR', `${os.ticker} order rejected: ${status.reject_reason || 'unknown'}`);
          }
        } catch (err) {
          await this._handleError('MONITOR_FAILED', err, { orderId });
        }
      }

      // Check breakeven on filled positions
      for (const [ticker, pos] of this.positionState) {
        const daysHeld = pos.fillTs ? (Date.now() - pos.fillTs) / (1000 * 60 * 60 * 24) : 999;
        const graceMet = daysHeld > (pos.beGraceDays || 0);

        if (!pos.breakeven_active && pos.entryPrice && pos.breakeven_pct && graceMet) {
          try {
            const quote = await this.adapter.getQuote(ticker);
            if (quote && quote.last) {
              const pnlPct = ((quote.last - pos.entryPrice) / pos.entryPrice) * 100;
              if (pnlPct >= pos.breakeven_pct) {
                this._log('TRADE', `${ticker}: breakeven triggered (${pnlPct.toFixed(1)}% ≥ ${pos.breakeven_pct}%, held ${daysHeld.toFixed(1)}d)`);
                await this._onBreakeven(ticker, pos);
                pos.breakeven_active = true;
              }
            }
          } catch (_) {}
        }

        // Trailing stop — also gated by grace period
        if (pos.entryPrice && this.plan.mode.daily_trail_pct > 0 && graceMet) {
          try {
            const quote = await this.adapter.getQuote(ticker);
            if (quote?.last) await this._checkTrailingStop(ticker, pos, quote);
          } catch (_) {}
        }

        // Stale days detection
        const staleDays = this.plan.mode.stale_days;
        if (staleDays > 0 && pos.entryPrice) {
          try {
            const quote = await this.adapter.getQuote(ticker);
            if (quote?.last && pos.highWaterMark) {
              const pnlFromHigh = ((quote.last - pos.highWaterMark) / pos.highWaterMark) * 100;
              if (Math.abs(pnlFromHigh) < 1 && quote.last < pos.highWaterMark) {
                if (!pos.staleSince) pos.staleSince = new Date();
                const staleForDays = (new Date() - pos.staleSince) / (1000 * 60 * 60 * 24);
                if (staleForDays >= staleDays) {
                  this._log('TRADE', `${ticker}: stale for ${staleForDays.toFixed(1)} days — closing`);
                  const order = this.plan.orders.find(o => o.broker_symbol === ticker || o.ticker === ticker);
                  const symbol = order?.broker_symbol || ticker;
                  try {
                    await this.adapter.closePosition(symbol);
                    this.trades.push({ type: 'CLOSE', ticker, reason: 'STALE_EXIT', result: {}, ts: new Date().toISOString() });
                  } catch (err) {
                    this._log('ERROR', `Failed to close stale position ${ticker}: ${err.message}`);
                  }
                }
              } else {
                pos.staleSince = null;
              }
            }
          } catch (_) {}
        }
      }

      // Check circuit breaker
      try {
        const account = await this.adapter.getAccount();
        const dayPnlPct = ((account.balance - account.last_equity) / account.last_equity) * 100;
        if (this.plan.risk.circuit_breaker && dayPnlPct < -this.plan.risk.circuit_breaker.daily_loss_pct) {
          this._log('ERROR', `CIRCUIT BREAKER: portfolio down ${dayPnlPct.toFixed(1)}% today`);
          await this._cancelAllPending();
          break;
        }
      } catch (_) {}

      if (allTerminal) break;
      await this._sleep(5000);
    }
  }

  async _onFill(orderId, os, fillStatus) {
    const order = this.plan.orders.find(o => o.id === orderId);
    if (!order || !order.exit) return;

    const filledPrice = fillStatus.filled_avg_price;
    const filledQty = fillStatus.filled_qty;

    // Track position
    this.positionState.set(os.brokerSymbol, {
      qty: filledQty,
      entryPrice: filledPrice,
      fillTs: Date.now(),
      breakeven_pct: order.exit.breakeven?.trigger_pct,
      beGraceDays: this.plan.mode.be_grace_days || 0,
      breakeven_active: false,
      exitOrders: [],
    });

    // Place bracket exits
    try {
      // Stop loss
      if (order.exit.stop_loss) {
        let stopPrice = order.exit.stop_loss.price;
        const maxStopPct = this.plan.mode.max_stop_pct;
        if (maxStopPct > 0) {
          const maxStopPrice = filledPrice * (1 - maxStopPct / 100);
          if (stopPrice < maxStopPrice) {
            this._log('INFO', `${os.ticker}: clamping stop from ${stopPrice} to ${maxStopPrice.toFixed(2)} (maxStop ${maxStopPct}%)`);
            stopPrice = maxStopPrice;
          }
        }
        const slOrder = await this.adapter.placeOrder({
          symbol: os.brokerSymbol,
          side: 'sell',
          type: 'stop',
          qty: filledQty,
          stop_price: stopPrice,
          time_in_force: 'gtc',
        });
        os.exitOrders.push({ type: 'SL', brokerOrderId: slOrder.id });
        this._log('INFO', `SL placed for ${os.ticker} @ ${stopPrice} → ${slOrder.id}`);
      }

      // Take profit 1 (partial)
      const partialPct = this.plan.mode.partial_tp ? (this.plan.mode.partial_tp_pct != null ? this.plan.mode.partial_tp_pct * 100 : 50) : 50;
      if (order.exit.take_profit_1) {
        const tp1Qty = Math.floor(filledQty * partialPct / 100);
        if (tp1Qty > 0) {
          const tp1Order = await this.adapter.placeOrder({
            symbol: os.brokerSymbol,
            side: 'sell',
            type: 'limit',
            qty: tp1Qty,
            limit_price: order.exit.take_profit_1.price,
            time_in_force: 'gtc',
          });
          os.exitOrders.push({ type: 'TP1', brokerOrderId: tp1Order.id, qty: tp1Qty });
          this._log('INFO', `TP1 placed for ${os.ticker} @ ${order.exit.take_profit_1.price} x${tp1Qty} → ${tp1Order.id}`);
        }
      }

      // Take profit 2 (remaining)
      if (order.exit.take_profit_2) {
        const tp1Qty = Math.floor(filledQty * partialPct / 100);
        const tp2Qty = filledQty - tp1Qty;
        if (tp2Qty > 0) {
          const tp2Order = await this.adapter.placeOrder({
            symbol: os.brokerSymbol,
            side: 'sell',
            type: 'limit',
            qty: tp2Qty,
            limit_price: order.exit.take_profit_2.price,
            time_in_force: 'gtc',
          });
          os.exitOrders.push({ type: 'TP2', brokerOrderId: tp2Order.id, qty: tp2Qty });
          this._log('INFO', `TP2 placed for ${os.ticker} @ ${order.exit.take_profit_2.price} x${tp2Qty} → ${tp2Order.id}`);
        }
      }
    } catch (err) {
      this._log('ERROR', `Failed to place exit orders for ${os.ticker}: ${err.message}`);
    }

    this.trades.push({
      type: 'ENTRY',
      ticker: os.ticker,
      price: filledPrice,
      qty: filledQty,
      orderId,
      ts: new Date().toISOString(),
    });
  }

  async _onBreakeven(symbol, pos) {
    // Find the SL exit order and modify it to entry price
    for (const [orderId, os] of this.orderState) {
      if (os.brokerSymbol !== symbol) continue;
      const slExit = os.exitOrders.find(e => e.type === 'SL');
      if (slExit) {
        try {
          await this.adapter.modifyOrder(slExit.brokerOrderId, { stop_price: pos.entryPrice });
          this._log('TRADE', `Breakeven: moved SL to ${pos.entryPrice} for ${symbol}`);
        } catch (err) {
          this._log('ERROR', `Failed to modify SL for breakeven: ${err.message}`);
        }
      }
    }
  }

  async _checkTrailingStop(symbol, pos, quote) {
    if (!quote?.last || !pos.entryPrice) return;
    const trailPct = this.plan.mode.daily_trail_pct;

    // Track high water mark
    if (!pos.highWaterMark || quote.last > pos.highWaterMark) {
      pos.highWaterMark = quote.last;
    }

    // Trailing stop = highWaterMark × (1 - trailPct/100)
    const trailStop = pos.highWaterMark * (1 - trailPct / 100);

    // Only trail UP — never move stop down
    if (!pos.currentStop || trailStop > pos.currentStop) {
      for (const [, os] of this.orderState) {
        if (os.brokerSymbol !== symbol) continue;
        const slExit = os.exitOrders.find(e => e.type === 'SL');
        if (slExit) {
          try {
            await this.adapter.modifyOrder(slExit.brokerOrderId, { stop_price: trailStop });
            pos.currentStop = trailStop;
            this._log('TRADE', `Trailing stop: ${symbol} moved to ${trailStop.toFixed(2)} (HWM: ${pos.highWaterMark.toFixed(2)}, trail: ${trailPct}%)`);
          } catch (err) {
            this._log('WARN', `Failed to trail stop for ${symbol}: ${err.message}`);
          }
        }
      }
    }
  }

  // ── Phase: CLOSE ──
  async _phaseClose() {
    this.phase = 'CLOSE_SESSION';
    this._log('PHASE', 'Phase: CLOSE_SESSION — cleaning up');
    await this._cancelAllPending();
  }

  async _cancelAllPending() {
    for (const [orderId, os] of this.orderState) {
      if (os.state === ORDER_STATES.SUBMITTED && os.brokerOrderId) {
        try {
          await this.adapter.cancelOrder(os.brokerOrderId);
          os.state = ORDER_STATES.CANCELLED;
          this._log('INFO', `Cancelled unfilled order ${orderId} (${os.ticker})`);
        } catch (err) {
          this._log('WARN', `Failed to cancel ${orderId}: ${err.message}`);
        }
      }
    }
  }

  // ── Error handling ──
  async _handleError(code, err, context) {
    this._log('ERROR', `${code}: ${err.message}`, context);
    this.errors.push({ code, message: err.message, context, ts: new Date().toISOString() });

    const handler = this.plan.error_handlers?.[code];
    if (!handler) return;

    switch (handler.action) {
      case 'SKIP':
      case 'LOG_AND_SKIP':
        break;
      case 'RECONNECT':
        for (let i = 0; i < (handler.max_retries || 3); i++) {
          const delay = handler.backoff_ms?.[Math.min(i, handler.backoff_ms.length - 1)] || 5000;
          this._log('INFO', `Reconnect attempt ${i + 1} in ${delay}ms`);
          await this._sleep(delay);
          try {
            await this.adapter.connect();
            this._log('INFO', 'Reconnected successfully');
            return;
          } catch (_) {}
        }
        this._log('ERROR', 'All reconnect attempts failed');
        this.running = false;
        break;
      case 'REDUCE_SIZE':
        break;
      case 'BACKOFF':
        await this._sleep(handler.delay_ms || 5000);
        break;
    }
  }

  // ── Shutdown ──
  async shutdown() {
    this.running = false;
    if (this._monitorInterval) clearInterval(this._monitorInterval);
    await this._cancelAllPending();
    await this._exportLog();
    try { await this.adapter.disconnect(); } catch (_) {}
    if (this.marketData) {
      try { await this.marketData.stop(); } catch (_) {}
    }
    this._log('PHASE', 'Engine shut down');
  }

  // ── Export ──
  async _exportLog() {
    fs.mkdirSync(this.logDir, { recursive: true });
    const ts = new Date().toISOString().slice(0, 10);
    const logPath = path.join(this.logDir, `execution-${this.plan.mode.name}-${this.plan.broker.name}-${ts}.json`);
    const summary = {
      plan: { mode: this.plan.mode.name, broker: this.plan.broker.name, date: this.plan.valid_for },
      orders: Object.fromEntries(this.orderState),
      trades: this.trades,
      errors: this.errors,
      // Capacité : ce que le garde a refusé, et sous quel plafond. Un ordre écarté silencieusement
      // se lit comme un ordre qui n'a jamais existé — ici il laisse une trace nommée.
      capacity: {
        committed_notional_usd: +this._committedNotional.toFixed(2),
        max_notional_usd: this.plan.account?.max_notional_usd ?? null,
        nominal_usd: this.plan.account?.nominal_usd ?? null,
        buying_power: this._accountSnapshot?.buying_power ?? null,
        max_positions: this.plan.account?.max_positions ?? null,
        skipped: this._capacitySkips,
      },
      log: this.log,
    };
    fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));
    this._log('INFO', `Execution log: ${logPath}`);

    // Print summary
    const filled = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.FILLED).length;
    const skipped = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.SKIPPED).length;
    const rejected = [...this.orderState.values()].filter(os => os.state === ORDER_STATES.REJECTED).length;
    console.log(`\n📊 Session Summary — ${this.plan.mode.name} / ${this.plan.broker.name}`);
    console.log(`   Filled: ${filled} | Skipped: ${skipped} | Rejected: ${rejected} | Errors: ${this.errors.length}`);
    console.log(`   Trades: ${this.trades.length} | Log: ${logPath}`);
    if (this._capacitySkips.length) {
      console.log(`   ⛔ Capacité — ${this._capacitySkips.length} entrée(s) refusée(s) (engagé ${this._committedNotional.toFixed(0)} $) :`);
      for (const s of this._capacitySkips) console.log(`      - ${s.ticker}: ${s.reason}`);
    }
  }

  _minutesSinceOpen() {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const openMinutes = 9 * 60 + 30;
    const nowMinutes = et.getHours() * 60 + et.getMinutes();
    return nowMinutes - openMinutes;
  }

  _getEntryPhase() {
    const mins = this._minutesSinceOpen();
    if (mins < 0) return -1;   // pre-market
    if (mins < 45) return 1;   // Phase 1: sniper (9:30-10:15 ET)
    if (mins < 120) return 2;  // Phase 2: pragmatic (10:15-11:30 ET)
    if (mins < 150) return 3;  // Phase 3: deadline (11:30-12:00 ET)
    return 0;                   // past deadline
  }

  _isWeekday() {
    const d = new Date().getDay();
    return d !== 0 && d !== 6;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = { Engine, ORDER_STATES };
