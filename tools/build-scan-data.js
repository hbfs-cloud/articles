#!/usr/bin/env node
'use strict';

// signals.json + manifeste éditorial → data.json, l'artefact que consomme render-scanner.js.
//
// Générique et dérivé : tout ce qui est calculable vient de signals.json, tout ce qui relève
// du jugement vient du bloc `editorial` du manifeste. Aucun nombre n'est saisi ici.
//
// ATTENTION À L'ÉCHELLE DU RÉGIME. Convention du dépôt, et elle est piégeuse :
// `data.json#regime_score` vit sur 0-1 tandis que `signals.json#regimeScore` vit sur 0-100.
// Même grandeur, deux échelles. Le 2026-08-08, un data.json écrit à 85 au lieu de 0,85 a
// produit « confiance 8500,0 % » sur la page publiée. Le renderer refuse désormais toute
// valeur hors [0,1] — la conversion est faite ici, une seule fois, explicitement.
//
//   node tools/build-scan-data.js --dir scanner/YYYYMMDD --manifest <manifest.json>

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const dirRel = arg('--dir');
const manifestRel = arg('--manifest');
if (!dirRel || !manifestRel) {
  console.error('Usage: build-scan-data.js --dir scanner/YYYYMMDD --manifest <manifest.json>');
  process.exit(2);
}

const DIR = path.resolve(ROOT, dirRel);
const sig = JSON.parse(fs.readFileSync(path.join(DIR, 'signals.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(path.resolve(ROOT, manifestRel), 'utf8'));
const ed = man.editorial;
if (!ed) throw new Error('le manifeste ne porte pas de bloc `editorial` — rien à rédiger, fail-closed');

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dFR = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const jFR = iso => { const d = new Date(iso + 'T12:00:00Z'); return JOURS[d.getUTCDay()]; };
const nbFR = (n, dec = 2) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Le régime revient sur 0-1 pour data.json — voir l'avertissement d'en-tête.
const score01 = sig.regimeScore / 100;
if (!(score01 >= 0 && score01 <= 1)) throw new Error(`regime_score ${score01} hors de [0,1]`);

const COLORS = { 'RISK-ON': '#16a34a', 'NEUTRAL': '#64748b', 'RECOVERY': '#0ea5e9', 'EARLY RISK-OFF': '#f59e0b', 'RISK-OFF': '#dc2626' };

const setups = sig.signals.map(s => ({
  ticker: s.ticker, name: s.name,
  description: (ed.descriptions || {})[s.ticker] || '',
  logo_gradient: ['#0f172a', '#1e293b'],
  price: s.price,
  change_pct: null,
  score: s.score, pattern: s.strategy,
  region: s.region, region_flag: s.region === 'ETF' ? 'ETF' : 'US',
  region_label: s.region === 'ETF' ? 'ETF coté aux États-Unis' : 'États-Unis',
  sector: s.sector, sharia: false, extra_badges: [],
  entry_low: s.entry_low, entry_high: s.entry_high,
  entry_display: `${nbFR(s.entry, 2)} $ en ordre à cours limité, valable la séance. Pas de zone : si le prix n'est pas touché, il n'y a pas de trade.`,
  stop: s.stop, tp1: s.tp1, tp2: s.tp2,
  rr: s.rr, rr_entry: s.rr_entry,
  tp1_atr_multiple: s.tp1_atr_multiple,
  horizon_days: s.horizon,
  thesis: s.thesis,
  confirmations: (ed.confirmations || {})[s.ticker] || [],
  invalidations: [s.invalidation, `Niveau observable : ${nbFR(s.invalidation_level, 2)} $, strictement au-dessus du stop à ${nbFR(s.stop, 2)} $.`],
  // (le stop reste la protection ; l'invalidation ci-dessus est ce que le lecteur peut voir)
  market_cap: s.market_cap,
  earnings_clear: s.earnings_clear, dilution_clear: s.dilution_clear,
  earnings_source: s.earnings_source,
  issuer_filing_regime: s.issuer_filing_regime,
  dilution_scope: s.dilution_scope,
}));

const out = {
  _comment: `Scanner ${sig.scanDate} fondé sur la clôture US certifiée du ${sig.referenceClose}. Les niveaux sont conditionnels et ne deviennent actionnables qu'à la séance visée.`,
  date: man.scan_date,
  session_label: `Séance du ${jFR(man.scan_date)} ${dFR(man.scan_date)}`,
  url: `/scanner/${sig.scanDate}/`,
  regime: sig.regime,
  regime_score: score01,
  regime_color: COLORS[sig.regime] || '#64748b',
  tags: ed.tags,
  kpis: ed.kpis,
  alerts: ed.alerts,
  intro: ed.intro,
  strategy: ed.strategy,
  regime_prose: ed.regime_prose,
  regime_strategy_weights: (() => {
    const n = sig.signals.length || 1;
    const c = k => sig.signals.filter(s => s.strategy === k).length / n;
    return { momentum: c('Momentum'), breakout: c('Breakout'), pullback: c('Pullback'), presqueeze: c('Pre-Squeeze') };
  })(),
  market_snapshot: ed.market_snapshot,
  pedagogy: ed.pedagogy,
  score_methodology: sig._scoreMethodology,
  macro_calendar: ed.macro_calendar,
  sector_rotation: ed.sector_rotation,
  macro_thesis: ed.macro_thesis,
  engine_meta: {
    generated_at: ed.generated_at,
    regime: sig.regime,
    reference_close: sig.referenceClose,
    // Les identifiants d'outil et de moteur restent dans signals.json, qui est interne.
    // data.json alimente la page publiée, et CLAUDE.md interdit tout terme d'infrastructure
    // dans le contenu publié — on décrit la donnée, jamais la plomberie.
    regime_scale: 'score haussier ramené sur 0-1 pour cet artefact ; la page l\'affiche en pourcentage',
    marketdata_contract_status: 'certified',
    marketdata_completion_policy: 'completed_only',
    freshness: ed.freshness,
    risk_gating: ed.risk_gating,
    entry_policy: sig._entryPolicy,
    pipeline_order: sig._pipelineOrder,
  },
  disclaimer_extra: ed.disclaimer_extra,
  setups,
  scanDate: sig.scanDate,
};

fs.writeFileSync(path.join(DIR, 'data.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`data.json écrit — ${setups.length} setups, régime ${sig.regime} ${score01} (échelle 0-1)`);
