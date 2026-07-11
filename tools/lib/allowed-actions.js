#!/usr/bin/env node
'use strict';

/**
 * allowed-actions.js — MENU D'ACTIONS PRÉ-BORNÉ (compute_allowed_actions) + hold sûr.
 *
 * Idée #7 de docs/research/ai-hedge-fund-ideas.md (§2.7) : porter le garde-fou
 * `compute_allowed_actions()` du portfolio_manager de virattt/ai-hedge-fund — MAIS 100 %
 * CODE, ZÉRO LLM. Le principe structurel : le CODE calcule d'abord l'ENSEMBLE des actions
 * permises + la quantité max (cash / limites de risque / sizing) ; un éventuel décideur
 * (règle ou LLM éditorial) choisit alors DANS un menu déjà borné — il ne peut PAS
 * structurellement sur-dimensionner ni sortir de l'ensemble permis. Et si rien n'est
 * actionnable → `hold` pré-rempli SANS appeler le décideur.
 *
 * ─── SCOPE / BORNE (mémoire systematic-north-star) ───────────────────────────────────
 *   • SIM-ONLY : ce module ne place, n'annule, ne modifie AUCUN ordre. Aucun rb_paper_* /
 *     rb_live_* / sim_place_order. Il RETOURNE un menu consultatif + une quantité max.
 *     C'est une BORNE numérique, pas un exécuteur, pas un sélecteur.
 *   • LONG-ONLY : `short`/`cover` sont reconnus dans l'univers d'actions mais TOUJOURS
 *     exclus du menu (hors borne — cf §3 du doc : short/marge seulement si un jour on
 *     ajoute du short simulé). On ne les autorise jamais silencieusement.
 *   • 100 % DÉTERMINISTE : aucune source de hasard, aucun LLM. Même entrée → même sortie.
 *   • ZÉRO FABRICATION / DÉGRADATION SÛRE (renforce le MCP HARD STOP) : toute donnée
 *     manquante / NaN / incohérente ne déclenche JAMAIS un fallback silencieux qui
 *     substitue une valeur agressive (l'anti-pattern create_default_response interdit).
 *     Elle déclenche `safeHold()` : le menu se réduit à `['hold']` — la dégradation est
 *     TOUJOURS vers l'inaction, JAMAIS vers une action agressive.
 *
 * ─── CONTRAT ─────────────────────────────────────────────────────────────────────────
 *   computeAllowedActions(ctx) → {
 *     ticker, actions: string[]      // sous-ensemble borné de ACTIONS ; contient toujours 'hold'
 *     maxQty: { buy, sell },         // quantités max entières (0 si l'action n'est pas permise)
 *     bounds: { positionLimitUsd, buyBudgetUsd, cash, nlv, price },  // math traçable
 *     fallback: boolean,             // true = dégradé en hold sûr (donnée invalide)
 *     reason: string                 // gabarit factuel (jamais vide)
 *   }
 *   boundDecision(proposed, menu) → { action, quantity, clamped, reason }
 *     Clampe une décision proposée AU menu : action hors menu → 'hold' ; quantité >
 *     maxQty → ramenée à maxQty. Garantit qu'un pick « ne dépasse jamais le menu permis ».
 *   safeHold(ticker, reason) → menu ['hold'] déterministe (le fallback sûr universel).
 *
 * Usage (librairie) :
 *   const { computeAllowedActions, boundDecision, safeHold } = require('./lib/allowed-actions');
 *
 * Usage (CLI) :
 *   node tools/lib/allowed-actions.js --self-test     # smoke-test déterministe (menu vide→hold ; échec→hold)
 *   node tools/lib/allowed-actions.js --in ctx.json   # calcule le menu pour un contexte
 */

// Univers d'actions reconnu (calqué sur le repo source). `hold` est TOUJOURS permis.
// `short`/`cover` sont hors borne SIM long-only → jamais dans le menu (voir SCOPE).
const ACTIONS = Object.freeze(['buy', 'sell', 'short', 'cover', 'hold']);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isPosNum = (x) => isNum(x) && x > 0;
const isNonNegNum = (x) => isNum(x) && x >= 0;

/**
 * safeHold(ticker, reason) — LE fallback sûr universel.
 * Retourne un menu réduit à ['hold'], quantités nulles, fallback:true. Déterministe.
 * Toute dégradation (donnée manquante, exception, contexte incohérent) passe par ici :
 * on ne comble JAMAIS un trou par une action — on s'immobilise.
 */
function safeHold(ticker, reason) {
  return {
    ticker: ticker || null,
    actions: ['hold'],
    maxQty: { buy: 0, sell: 0 },
    bounds: { positionLimitUsd: 0, buyBudgetUsd: 0, cash: null, nlv: null, price: null },
    fallback: true,
    reason: reason || 'dégradation sûre : donnée insuffisante/incohérente → hold (jamais d\'action agressive)',
  };
}

/**
 * computeAllowedActions(ctx) — calcule le menu d'actions permises + quantité max.
 * Ne LÈVE JAMAIS : toute erreur interne retombe sur safeHold (dégradation sûre).
 *
 * ctx (tous les champs monétaires en devise du book) :
 *   price            number > 0   — prix courant / d'entrée du titre (REQUIS ; sinon → hold)
 *   cash             number ≥ 0   — cash disponible dans le book sim (défaut 0 → pas de buy)
 *   nlv              number > 0   — net liquidation value (base de la limite de position)
 *   positionLimitPct number 0..1  — fraction max de la NLV pour CE titre (couche sizing ; défaut 0.20)
 *   currentShares    number ≥ 0   — titres déjà détenus (base du sell ; défaut 0)
 *   openPositions    number ≥ 0   — positions ouvertes dans le book (défaut 0)
 *   maxPositions     number > 0   — nb max de positions (si atteint → pas de nouveau buy)
 *   riskOk           boolean      — porte de risque externe (VIX kill / DD breaker / gate) ; défaut true
 *   allowShort       boolean      — RESTE hors borne : ignoré, short/cover jamais permis ici
 */
function computeAllowedActions(ctx) {
  try {
    ctx = ctx || {};
    const ticker = ctx.ticker || null;

    // ── Validation fail-closed : sans prix valide, aucune math de sizing possible → hold.
    if (!isPosNum(ctx.price)) {
      return safeHold(ticker, `prix invalide/absent (${JSON.stringify(ctx.price)}) → impossible de borner une action → hold`);
    }
    const price = ctx.price;

    // Défauts SÛRS : en l'absence d'info, on penche vers l'inaction (cash 0, pas de titres).
    const cash = isNonNegNum(ctx.cash) ? ctx.cash : 0;
    const nlv = isPosNum(ctx.nlv) ? ctx.nlv : (cash > 0 ? cash : 0);
    const currentShares = isNonNegNum(ctx.currentShares) ? Math.floor(ctx.currentShares) : 0;
    const openPositions = isNonNegNum(ctx.openPositions) ? ctx.openPositions : 0;
    const maxPositions = isPosNum(ctx.maxPositions) ? ctx.maxPositions : Infinity;
    const riskOk = ctx.riskOk !== false; // défaut permissif ; false = porte de risque fermée
    // positionLimitPct : couche sizing. Clampé [0,1] ; défaut 0.20 (20 % NLV, base du repo source).
    let positionLimitPct = isNum(ctx.positionLimitPct) ? ctx.positionLimitPct : 0.20;
    positionLimitPct = Math.max(0, Math.min(1, positionLimitPct));

    // ── Limite de position + budget d'achat = min(limite risque, cash). ────────────────
    const positionLimitUsd = nlv * positionLimitPct;
    const buyBudgetUsd = Math.min(positionLimitUsd, cash);

    // ── BUY : permis si porte de risque ouverte, slot libre, budget ≥ 1 action. ────────
    const bookHasSlot = openPositions < maxPositions;
    let maxBuyQty = 0;
    if (riskOk && bookHasSlot && buyBudgetUsd > 0) {
      maxBuyQty = Math.floor(buyBudgetUsd / price);
    }

    // ── SELL : permis si on détient réellement des titres. maxQty = titres détenus. ────
    const maxSellQty = currentShares;

    // ── Assemblage du menu. `hold` toujours présent. ───────────────────────────────────
    const actions = [];
    if (maxBuyQty >= 1) actions.push('buy');
    if (maxSellQty >= 1) actions.push('sell');
    actions.push('hold'); // toujours permis, en dernier

    // Rien d'actionnable au-delà de hold → menu = ['hold'] PRÉ-REMPLI (pas de décideur appelé).
    const onlyHold = actions.length === 1;

    const reasonBits = [];
    if (maxBuyQty >= 1) reasonBits.push(`buy≤${maxBuyQty} (budget ${buyBudgetUsd.toFixed(0)} = min(limite ${positionLimitUsd.toFixed(0)}, cash ${cash.toFixed(0)}) / prix ${price})`);
    else if (!riskOk) reasonBits.push('buy exclu : porte de risque fermée (riskOk=false)');
    else if (!bookHasSlot) reasonBits.push(`buy exclu : book plein (${openPositions}/${maxPositions})`);
    else reasonBits.push(`buy exclu : budget ${buyBudgetUsd.toFixed(0)} < prix ${price} (0 action)`);
    if (maxSellQty >= 1) reasonBits.push(`sell≤${maxSellQty} (titres détenus)`);

    return {
      ticker,
      actions,
      maxQty: { buy: maxBuyQty, sell: maxSellQty },
      bounds: { positionLimitUsd, buyBudgetUsd, cash, nlv, price },
      fallback: false,
      reason: onlyHold
        ? `rien d'actionnable → hold pré-rempli. ${reasonBits.join(' ; ')}`
        : reasonBits.join(' ; '),
    };
  } catch (e) {
    // Dégradation sûre absolue : toute exception → hold, jamais une action agressive.
    return safeHold(ctx && ctx.ticker, `exception interne (${e && e.message}) → dégradation sûre vers hold`);
  }
}

/**
 * boundDecision(proposed, menu) — CLAMPE une décision proposée AU menu permis.
 * C'est l'application concrète de « un pick ne peut jamais dépasser le menu permis » :
 *   • action absente du menu (y compris short/cover, ou un buy sans budget) → 'hold'.
 *   • quantité > maxQty de l'action → ramenée à maxQty.
 *   • quantité ≤ 0 ou non numérique sur une action non-hold → 'hold' (rien à faire).
 * Ne lève jamais ; entrée douteuse → hold. Déterministe.
 *
 * @param {{action?:string, quantity?:number}} proposed  décision d'un décideur (règle/LLM édito)
 * @param {object} menu  sortie de computeAllowedActions
 * @returns {{action:string, quantity:number, clamped:boolean, reason:string}}
 */
function boundDecision(proposed, menu) {
  const hold = (reason) => ({ action: 'hold', quantity: 0, clamped: true, reason });
  try {
    if (!menu || !Array.isArray(menu.actions)) return hold('menu absent/invalide → hold');
    const p = proposed || {};
    const action = typeof p.action === 'string' ? p.action.toLowerCase().trim() : 'hold';

    if (action === 'hold') return { action: 'hold', quantity: 0, clamped: false, reason: 'hold demandé' };
    if (!ACTIONS.includes(action)) return hold(`action inconnue "${p.action}" → hold`);
    if (!menu.actions.includes(action)) {
      return hold(`action "${action}" hors du menu permis [${menu.actions.join(', ')}] → hold (borne #7)`);
    }
    const cap = (menu.maxQty && isNum(menu.maxQty[action])) ? menu.maxQty[action] : 0;
    if (cap < 1) return hold(`action "${action}" sans quantité permise (max ${cap}) → hold`);

    let qty = isNum(p.quantity) ? Math.floor(p.quantity) : cap; // pas de quantité → prend le max permis
    if (qty <= 0) return hold(`quantité ${p.quantity} ≤ 0 → hold`);
    const clamped = qty > cap;
    if (clamped) qty = cap;
    return {
      action,
      quantity: qty,
      clamped,
      reason: clamped
        ? `quantité ramenée au max permis ${cap} (borne #7 : ne peut dépasser le menu)`
        : `dans le menu permis (max ${cap})`,
    };
  } catch (e) {
    return hold(`exception (${e && e.message}) → dégradation sûre vers hold`);
  }
}

module.exports = { ACTIONS, computeAllowedActions, boundDecision, safeHold };

// ─── CLI / smoke-test ────────────────────────────────────────────────────────────────
if (require.main === module) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (argv.includes('--self-test')) {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

    // (1) Cas nominal : cash + prix sains → buy permis, quantité bornée par min(limite, cash)/prix.
    const m1 = computeAllowedActions({ ticker: 'AAA', price: 50, cash: 100000, nlv: 100000, positionLimitPct: 0.20 });
    assert(!m1.fallback, 'nominal ne doit pas être un fallback');
    assert(m1.actions.includes('buy') && m1.actions.includes('hold'), 'nominal doit permettre buy + hold');
    assert(m1.maxQty.buy === Math.floor(20000 / 50), `maxBuyQty attendu ${20000 / 50}, got ${m1.maxQty.buy}`); // limite 20k < cash
    // déterminisme : deux appels identiques → sortie byte-identique
    assert(JSON.stringify(m1) === JSON.stringify(computeAllowedActions({ ticker: 'AAA', price: 50, cash: 100000, nlv: 100000, positionLimitPct: 0.20 })), 'non déterministe');

    // (2) MENU VIDE → HOLD : cash 0 (rien à acheter) et aucun titre détenu → menu = ['hold'] pré-rempli.
    const m2 = computeAllowedActions({ ticker: 'BBB', price: 50, cash: 0, nlv: 0, currentShares: 0 });
    assert(JSON.stringify(m2.actions) === JSON.stringify(['hold']), 'cash 0 & 0 titre → menu doit être exactement [hold], got ' + JSON.stringify(m2.actions));
    assert(m2.maxQty.buy === 0 && m2.maxQty.sell === 0, 'menu vide → quantités nulles');

    // (2b) budget positif mais insuffisant pour 1 action (prix > budget) → pas de buy → hold.
    const m2b = computeAllowedActions({ ticker: 'HIGH', price: 30000, cash: 100000, nlv: 100000, positionLimitPct: 0.20 });
    assert(!m2b.actions.includes('buy'), 'prix > budget (20k) → buy exclu');
    assert(JSON.stringify(m2b.actions) === JSON.stringify(['hold']), 'prix > budget → menu = [hold]');

    // (3) ÉCHEC SIMULÉ (donnée invalide) → HOLD : prix NaN/absent → safeHold, jamais une action.
    for (const bad of [undefined, null, NaN, -5, 0, '50', {}]) {
      const mf = computeAllowedActions({ ticker: 'CCC', price: bad, cash: 100000, nlv: 100000 });
      assert(mf.fallback === true, 'prix invalide doit déclencher fallback : ' + JSON.stringify(bad));
      assert(JSON.stringify(mf.actions) === JSON.stringify(['hold']), 'échec → menu = [hold] : ' + JSON.stringify(bad));
    }
    // échec dur (ctx qui explose à la lecture) → toujours hold, jamais une exception propagée.
    const boom = computeAllowedActions(Object.defineProperty({}, 'price', { get() { throw new Error('boom'); } }));
    assert(boom.fallback === true && boom.actions[0] === 'hold', 'exception interne → safeHold');

    // (4) SELL borné aux titres détenus ; porte de risque fermée coupe le buy mais laisse hold+sell.
    const m4 = computeAllowedActions({ ticker: 'DDD', price: 10, cash: 100000, nlv: 100000, currentShares: 42, riskOk: false });
    assert(!m4.actions.includes('buy'), 'riskOk=false → pas de buy');
    assert(m4.actions.includes('sell') && m4.maxQty.sell === 42, 'sell borné aux 42 titres détenus');
    assert(m4.actions.includes('hold'), 'hold toujours présent');

    // (5) book plein → pas de nouveau buy.
    const m5 = computeAllowedActions({ ticker: 'EEE', price: 10, cash: 100000, nlv: 100000, openPositions: 8, maxPositions: 8 });
    assert(!m5.actions.includes('buy'), 'book plein → pas de buy');

    // (6) boundDecision : un pick ne peut JAMAIS dépasser le menu permis.
    //   a) buy sur-dimensionné → ramené au max permis.
    const b1 = boundDecision({ action: 'buy', quantity: 999999 }, m1);
    assert(b1.action === 'buy' && b1.quantity === m1.maxQty.buy && b1.clamped, 'buy sur-dimensionné doit être clampé au max menu');
    //   b) buy alors que le menu = [hold] → coercé en hold.
    const b2 = boundDecision({ action: 'buy', quantity: 100 }, m2);
    assert(b2.action === 'hold' && b2.quantity === 0, 'buy hors menu [hold] → hold');
    //   c) short/cover jamais dans le menu → hold (hors borne long-only).
    const b3 = boundDecision({ action: 'short', quantity: 10 }, m1);
    assert(b3.action === 'hold', 'short hors borne → hold');
    assert(!m1.actions.includes('short') && !m1.actions.includes('cover'), 'short/cover jamais permis');
    //   d) quantité omise → prend le max permis (pas de fabrication au-delà).
    const b4 = boundDecision({ action: 'sell' }, m4);
    assert(b4.action === 'sell' && b4.quantity === 42, 'sell sans qty → max permis 42');
    //   e) décision douteuse / menu absent → hold sûr.
    assert(boundDecision({ action: 'buy' }, null).action === 'hold', 'menu absent → hold');
    assert(boundDecision(null, m1).action === 'hold', 'proposed null → hold');

    // (7) safeHold est déterministe et bien hold-only.
    const sh = safeHold('ZZZ', 'test');
    assert(sh.fallback && JSON.stringify(sh.actions) === JSON.stringify(['hold']) && sh.maxQty.buy === 0, 'safeHold doit être hold-only');

    console.log('SELF-TEST OK — allowed-actions : menu pré-borné, menu vide→hold, échec→hold, boundDecision clampe au menu.');
    console.log('  nominal AAA :', JSON.stringify({ actions: m1.actions, maxQty: m1.maxQty }));
    console.log('  vide   BBB  :', JSON.stringify(m2.actions), '(hold pré-rempli)');
    console.log('  échec  CCC  : fallback→', JSON.stringify(computeAllowedActions({ price: null }).actions));
    process.exit(0);
  }

  const inFile = val('--in');
  if (inFile) {
    const fs = require('fs');
    const ctx = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    console.log(JSON.stringify(computeAllowedActions(ctx), null, 2));
    process.exit(0);
  }

  console.log('Usage: node tools/lib/allowed-actions.js --self-test');
  console.log('       node tools/lib/allowed-actions.js --in ctx.json');
  process.exit(0);
}
