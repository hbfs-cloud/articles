#!/usr/bin/env node
/**
 * gen-rotation-beta.js — produit data/rotation-beta.json
 *
 * Source unique de la page "Rotations & Beta" (/rotation/). Deux blocs :
 *   1. Rotation sectorielle : 11 ETF SPDR, perf 1s/1m calculée sur barres réelles + valeurs-phares.
 *   2. Plus hauts beta par sous-jacent : BTC/ETH/SOL/Gold/Silver/Crude/AI/EURUSD via l'outil
 *      serveur RankBeta (<3s, régression sur le cache DuckDB — pas de sweep client, pas d'usine à gaz).
 *
 * Appelé par /scanner (étape scriptée) : le runner injecte le jeton read-only par
 * environnement secret (valeur jamais affichée, jamais en .env), puis lance :
 *      node tools/gen-rotation-beta.js
 * Dégradation gracieuse : si le jeton manque, le script sort en 0 avec un mode d'emploi (jamais bloquant).
 *
 * Contrat de date : passer REFDATE=YYYY-MM-DD pour borner la fraîcheur (facultatif ; sinon = maintenant).
 */
const fs = require('fs');
const path = require('path');
const { callTool, awaitJob, canCallDirectly } = require('./lib/mcp-client');

const OUT = path.join(__dirname, '..', 'data', 'rotation-beta.json');
const REFDATE = process.env.REFDATE || '';

// --- config : sous-jacents + seuil de corrélation (pour écarter les co-mouvements parasites) ---
const REFERENCES = [
  { key: 'btc',    label: 'Bitcoin',        ref: 'BTC-USD',   minCorr: 0.55 },
  { key: 'eth',    label: 'Ethereum',       ref: 'ETH-USD',   minCorr: 0.60 },
  { key: 'sol',    label: 'Solana',         ref: 'SOL-USD',   minCorr: 0.60 },
  { key: 'gold',   label: 'Or',             ref: 'GC=F',      minCorr: 0.60 },
  { key: 'silver', label: 'Argent',         ref: 'SI=F',      minCorr: 0.60 },
  { key: 'crude',  label: 'Pétrole (WTI)',  ref: 'CL=F',      minCorr: 0.60 },
  { key: 'ai',     label: 'IA / Semis',     ref: 'NVDA',      minCorr: 0.55 },
  { key: 'eurusd', label: 'Euro (EUR/USD)', ref: 'EURUSD=X',  minCorr: 0.50 },
];

// --- 11 secteurs SPDR + noms FR + valeurs-phares (top holdings, stables) ---
const SECTORS = [
  { etf: 'XLK',  name: 'Technologie',      bellwethers: ['NVDA', 'MSFT', 'AAPL'] },
  { etf: 'XLV',  name: 'Santé',            bellwethers: ['LLY', 'UNH', 'JNJ'] },
  { etf: 'XLF',  name: 'Financières',      bellwethers: ['JPM', 'V', 'MA'] },
  { etf: 'XLE',  name: 'Énergie',          bellwethers: ['XOM', 'CVX', 'COP'] },
  { etf: 'XLI',  name: 'Industrie',        bellwethers: ['GE', 'CAT', 'RTX'] },
  { etf: 'XLY',  name: 'Conso discrét.',   bellwethers: ['AMZN', 'TSLA', 'HD'] },
  { etf: 'XLP',  name: 'Conso de base',    bellwethers: ['COST', 'WMT', 'PG'] },
  { etf: 'XLC',  name: 'Communication',    bellwethers: ['META', 'GOOGL', 'NFLX'] },
  { etf: 'XLU',  name: 'Utilities',        bellwethers: ['NEE', 'SO', 'DUK'] },
  { etf: 'XLRE', name: 'Immobilier',       bellwethers: ['PLD', 'AMT', 'EQIX'] },
  { etf: 'XLB',  name: 'Matériaux',        bellwethers: ['LIN', 'SHW', 'FCX'] },
];

function usageAndExit() {
  console.log([
    '[gen-rotation-beta] Aucun jeton marketdata utilisable — étape sautée (non bloquant).',
    'Marche à suivre (agent) :',
    '  1. Émettre GetReadOnlyToken(minutes=60) depuis la session authentifiée.',
    '  2. Injecter sa valeur via un environnement secret non journalisé.',
    '  3. node tools/gen-rotation-beta.js',
  ].join('\n'));
  process.exit(0);
}

async function queryBars(symbols, days) {
  const res = await callTool('marketdata', 'QueryData', { symbols: symbols.join(','), types: 'bars_daily', days });
  let payload = res;
  if (res && res.job_id && res.status === 'pending') payload = await awaitJob('marketdata', res.job_id);
  const results = (payload && (payload.results || (payload.data && payload.data.items && payload.data.items[0] && payload.data.items[0].results))) || [];
  const bars = results.find(r => (r.data_type || '').startsWith('bars'));
  const map = {};
  if (bars && Array.isArray(bars.data)) {
    bars.symbols.forEach((s, i) => {
      const entry = bars.data[i];
      const arr = Array.isArray(entry) ? entry : (entry && entry.bars) || [];
      map[s] = arr; // rows: [date, o, h, l, c, v]
    });
  }
  return map;
}

function pct(a, b) { return (a > 0 && b > 0) ? +(((a - b) / b) * 100).toFixed(2) : null; }

async function rankBeta(cfg) {
  const res = await callTool('marketdata', 'RankBeta', {
    reference: cfg.ref, universe_asset: 'stock', universe_region: 'US',
    min_correlation: cfg.minCorr, min_dollar_adv: 5e6, min_price: 3,
    lookback_days: 90, top_k: 12, as_of: REFDATE || undefined,
  });
  const item = (res && (res.rows ? res : (res.data && res.data.items && res.data.items[0]))) || {};
  const rows = (item.rows || []).filter(r => Math.abs(r.correlation) >= cfg.minCorr)
    .sort((a, b) => b.beta - a.beta).slice(0, 6)
    .map(r => ({
      symbol: r.symbol,
      beta: +Number(r.beta).toFixed(2),
      correlation: +Number(r.correlation).toFixed(2),
      r2: +Number(r.r2).toFixed(2),
      last_price: r.last_price != null ? +Number(r.last_price).toFixed(2) : null,
      sector: r.sector || '', industry: r.industry || '',
    }));
  return { key: cfg.key, label: cfg.label, reference: cfg.ref, window: item.window || '90d', rows };
}

(async () => {
  if (!canCallDirectly('marketdata')) usageAndExit();

  // 1. Rotation sectorielle
  const barsMap = await queryBars(SECTORS.map(s => s.etf), 30);
  let asof = REFDATE;
  const sectors = SECTORS.map(s => {
    const b = barsMap[s.etf] || [];
    const closes = b.map(r => +r[4]).filter(Number.isFinite);
    const last = closes[closes.length - 1];
    const wk = closes[closes.length - 6];
    const mo = closes[0];
    if (b.length && !asof) asof = String(b[b.length - 1][0]).slice(0, 10);
    return {
      etf: s.etf, name: s.name, bellwethers: s.bellwethers,
      perf_1w: pct(last, wk), perf_1m: pct(last, mo),
      last: last != null ? +last.toFixed(2) : null,
    };
  }).sort((a, b) => (b.perf_1w ?? -999) - (a.perf_1w ?? -999));
  sectors.forEach(s => { s.dir = s.perf_1w == null ? 'flat' : (s.perf_1w > 0.15 ? 'up' : (s.perf_1w < -0.15 ? 'down' : 'flat')); });

  // 2. Plus hauts beta par sous-jacent (séquentiel, respecte la limite de requêtes)
  const references = [];
  for (const cfg of REFERENCES) {
    try { references.push(await rankBeta(cfg)); }
    catch (e) { console.error(`[gen-rotation-beta] RankBeta ${cfg.ref} KO: ${e.message}`); references.push({ key: cfg.key, label: cfg.label, reference: cfg.ref, window: '90d', rows: [] }); }
  }

  const out = {
    schema: 'rotation-beta.v1',
    updated: new Date().toISOString(),
    asof: asof || null,
    window: { beta: '90 jours', perf: '1 semaine & 1 mois' },
    note: 'Beta = régression des rendements quotidiens vs le sous-jacent (RankBeta serveur). Corrélation ≥ seuil pour écarter les co-mouvements parasites. Valeurs-phares = principales pondérations de l’ETF (non un classement de perf).',
    sectors,
    references,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  // Copie API sous portfolio/v1/ (même artefact, endpoint stable)
  const API = path.join(__dirname, '..', 'portfolio', 'v1', 'rotation.json');
  try { fs.writeFileSync(API, JSON.stringify(out, null, 2)); } catch (e) { console.error('[gen-rotation-beta] copie API KO:', e.message); }
  console.log(`[gen-rotation-beta] écrit ${path.relative(path.join(__dirname, '..'), OUT)} + portfolio/v1/rotation.json — ${sectors.length} secteurs, ${references.length} sous-jacents, asof ${out.asof}`);
})().catch(e => { console.error('[gen-rotation-beta] FATAL', e.message); process.exit(1); });
