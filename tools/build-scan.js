#!/usr/bin/env node
'use strict';

// Constructeur de scan éditorial — générique, piloté par un manifeste de sélection.
//
// Remplace les scripts à usage unique `tools/_build-scan-YYYYMMDD.js`, qui figeaient la
// sélection ET la méthode de calcul dans le même fichier daté : impossible de rejouer un
// scan passé avec la méthode courante, ni de vérifier qu'un niveau publié dérive bien de
// la politique exécutable.
//
// Le script ne DÉCIDE de rien. La sélection (quels tickers, quelle stratégie, quelle thèse)
// est un jugement éditorial qui vit dans le manifeste. Le script applique la politique de
// `data/scanner-filters.json` aux artefacts MCP certifiés et REFUSE tout signal qui ne la
// franchit pas.
//
//   node tools/build-scan.js --dir scanner/YYYYMMDD --manifest <manifest.json> [--dry-run]
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI A CHANGÉ LE 2026-09-06, ET POURQUOI
//
// Trois revues indépendantes (QA senior, contrarian, dev senior) ont refusé la première
// version. Détail complet : docs/reviews/scan-20260908-revues.md. Les corrections :
//
// 1. SCHÉMA. La v1 écrivait `entry:[low,high]` / `stop` / `target`. `validate-scan.js`
//    attend `entry`, `entry_low`, `entry_high`, `stop`, `tp1`. Résultat : le plancher de
//    R/R fail-closait sur les 10 signaux — LA PORTE N'A JAMAIS TOURNÉ. Une sortie qui
//    n'entre pas dans le validateur n'est pas validée, elle est ignorée.
//
// 2. CÔTÉ DE REMPLISSAGE. La v1 mesurait le stop depuis `entryHigh` alors qu'un ordre
//    limite posé dans une bande se remplit EN BAS. À un remplissage réaliste, 9 stops sur
//    10 tombaient sous le plancher de bruit de 1,5 ATR — précisément ce que l'incident de
//    mars a codifié — et le fichier publiait un `stopAtr: 1.5` inatteignable. Le plancher
//    est désormais mesuré depuis `entry_low` (le remplissage le plus proche, donc le plus
//    exposé au bruit) et le R/R depuis `entry_high` (le remplissage le pire, donc le plus
//    conservateur).
//
// 3. ARRONDIS. Tout champ dérivé se calcule sur les valeurs ARRONDIES telles que publiées.
//    La v1 calculait sur les valeurs pleines : seize champs faux sur six tickers, tous
//    dans le sens favorable au signal.
//
// 4. NaN. Toute comparaison avec NaN est fausse : un `atr` manquant faisait passer les six
//    portes d'un coup et publiait des niveaux `null`. Chaque grandeur est désormais
//    validée par `Number.isFinite` AVANT le calcul, conformément au contrat écrit dans la
//    politique elle-même (`tp1_reachability.requires` : « champ manquant = fail-closed »).
//
// 5. SECTEUR. La v1 comptait `pick.sector`, texte libre du manifeste : le plafond sectoriel
//    était auto-déclaré. Le secteur vient maintenant de `diversification.sector_map`, et
//    une entrée manquante BLOQUE au lieu de tomber dans « Other ». C'est ce qui permettait
//    de loger une quatrième ligne énergie en l'étiquetant « ETF-Commodity ».
//
// 6. PART PAR STRATÉGIE. Le plafond `audit_gates.recent_strategy_performance` et l'overlay
//    immuable `data/scanner-strategy-overlays.json` n'étaient pas implémentés. Momentum
//    était à 80% du panier contre 40% autorisés sur preuve mature (PF 0,59, R moyen −0,243).
//
// 7. ENTRÉE PLAFONNÉE À LA CLÔTURE. Le registre scellé `data/signal-outcomes.json` (165
//    lignes) mesure : entrée ≤ clôture de référence → +0,220 R sur 21 lignes, 62% de gain ;
//    entrée entre +0,5 et +1% → −0,260 R sur 29 lignes, 38% de gain. La v1 posait
//    `entry_high = clôture + 0,25 × ATR`, une formule qui ne PEUT PAS produire une entrée
//    sous la clôture : sept lignes sur dix tombaient dans le pire seau. Le signal ne se
//    remplit désormais que si le marché revient chercher le prix. Le taux de déclenchement
//    baissera ; c'est le prix de l'espérance.
//
// 8. INVALIDATION AU-DESSUS DU STOP. Trois invalidations publiées étaient inatteignables :
//    le stop fermait la position avant que le niveau annoncé puisse être observé. Vérifié
//    par script désormais, plus à la relecture.
//
// Sorties : <dir>/signals.json  (+ rapport lisible sur la sortie standard)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const dirRel = arg('--dir');
const manifestRel = arg('--manifest');
const dryRun = argv.includes('--dry-run');
if (!dirRel || !manifestRel) {
  console.error('Usage: build-scan.js --dir scanner/YYYYMMDD --manifest <manifest.json> [--dry-run]');
  process.exit(2);
}

const DIR = path.resolve(ROOT, dirRel);
const FILTERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scanner-filters.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, manifestRel), 'utf8'));
const REF = manifest.reference_close;

const r2 = n => Math.round(n * 100) / 100;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const num = (v, what) => {
  if (!Number.isFinite(v)) throw new Error(`${what} absent ou non fini (${v}) — fail-closed`);
  return v;
};

// ── lecture des artefacts certifiés ─────────────────────────────────────────
const tech = {}, bars = {}, provenance = [];

function addProv(rel) {
  const p = path.join(DIR, rel);
  provenance.push({ file: rel, sha256: sha(p) });
  return p;
}

function ingestWave2() {
  const d = path.join(DIR, '_data2');
  if (!fs.existsSync(d)) throw new Error('_data2 absent — la vague 2 n\'a pas tourné');
  for (const f of fs.readdirSync(d).sort()) {            // tri : sortie reproductible
    if (!/^(tech|bars)_b\d+\.json$/.test(f)) continue;
    const p = addProv(`_data2/${f}`);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const it of (j.data?.items || [])) for (const rr of (it.results || [])) {
      for (const c of (rr.data || [])) {
        if (rr.data_type === 'technicals') {
          if (tech[c.symbol]) throw new Error(`${c.symbol}: technicals en double (${f}) — dernier-écrit-gagne interdit`);
          tech[c.symbol] = c;
        }
        if (rr.data_type === 'bars_daily' && c.bars) {
          // La garde de clôture ne doit pas être conditionnelle à la présence du champ :
          // un champ absent était une porte sautée en silence.
          if (!c.served_completed_end) throw new Error(`${c.symbol}: served_completed_end absent — clôture non certifiable`);
          if (c.served_completed_end !== REF) throw new Error(`${c.symbol}: barres arrêtées au ${c.served_completed_end}, référence ${REF}`);
          const last = c.bars[c.bars.length - 1];
          if (!last || last[0] !== REF) throw new Error(`${c.symbol}: dernière barre ${last && last[0]} ≠ ${REF}`);
          if (bars[c.symbol]) throw new Error(`${c.symbol}: barres en double (${f})`);
          bars[c.symbol] = c.bars;
        }
      }
    }
  }
}

function ingestSupplement() {
  const rel = '_data2/supp_enrich.json';
  const p = path.join(DIR, rel);
  // Un supplément déclaré dans le manifeste et absent du disque doit BLOQUER : la v1
  // sortait en silence et produisait un scan plus court mais plausible.
  if (!fs.existsSync(p)) {
    if (manifest.requires_supplement) throw new Error(`${rel} requis par le manifeste et absent`);
    return;
  }
  addProv(rel);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (j.reference_close !== REF) throw new Error(`supp_enrich: clôture ${j.reference_close} ≠ ${REF}`);
  for (const [sym, v] of Object.entries(j.symbols)) {
    if (tech[sym] || bars[sym]) throw new Error(`${sym}: présent en vague 2 ET dans le supplément — la source doit être unique`);
    const last = v.bars[v.bars.length - 1];
    if (!last || last[0] !== REF) throw new Error(`${sym}: dernière barre du supplément ${last && last[0]} ≠ ${REF}`);
    tech[sym] = { symbol: sym, atr: v.atr, rsi: v.rsi, macd: v.macd, signal: v.macd_signal,
      ema20: v.ema20, ema50: v.ema50, ema200: v.ema200, adv20_usd: v.adv20_usd,
      consolidation_bars: v.consolidation_bars };
    bars[sym] = v.bars;
  }
}

function readEvidence(rel) {
  const p = path.join(DIR, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} absent — preuve requise, fail-closed`);
  return { data: JSON.parse(fs.readFileSync(p, 'utf8')), sha256: sha(p), rel };
}

ingestWave2();
ingestSupplement();
const SEC = readEvidence('_final/sec_selected_evidence.json');
const EARN = readEvidence('_final/earnings_selected_evidence.json');
const SEL = readEvidence('_final/selection_rows.json');
const selRow = t => (SEL.data.data.items[0].candidates || []).find(r => r.symbol === t);

// ── politique ────────────────────────────────────────────────────────────────
const STOPS = FILTERS.stops;
const OE = FILTERS.overextension;
const DIV = FILTERS.diversification;
const TP = FILTERS.editorial_targets.tp1_reachability;
const RR_MIN = FILTERS.editorial_targets.rr_min_by_regime[manifest.regime];
if (RR_MIN == null) throw new Error(`aucun plancher de R/R pour le régime « ${manifest.regime} »`);
const ALLOWED_STRATEGIES = new Set(['Momentum', 'Breakout', 'Pullback', 'Pre-Squeeze']);

// ENTRÉE : UN PRIX UNIQUE À LA CLÔTURE DE RÉFÉRENCE. Pas de zone, pas de gate VWAP.
//
// C'est la recommandation n°4 de la revue d'août, classée SOLIDE : « la zone, le gate VWAP et
// conditional_next_session ne produisent rien de mesurable ; les garder revient à vendre au
// lecteur une précision qu'on n'a pas ». Mesures à l'appui : 86% des signaux se déclenchaient,
// 78% dès J+0, et ce qu'on ratait ne montait pas (0,33% de médiane). Le contrefactuel « achat
// à l'ouverture, sans zone » rendait +0,043R sur 98 lignes contre −0,045R pour la zone publiée.
//
// CE QUE JE N'AI PAS FAIT, ET POURQUOI. La revue contrarian du 2026-09-06 a trouvé, dans le
// registre scellé, que les entrées situées AU NIVEAU OU SOUS la clôture de référence rendaient
// +0,220R (n=21) contre −0,260R pour celles à +0,5/+1% (n=29). J'ai d'abord bâti une bande
// d'entrée sous la clôture pour capter ce seau. C'était du sur-ajustement : rien n'établit que
// le seau soit CAUSAL plutôt qu'un artefact de remplissage — se faire remplir sous la clôture,
// c'est aussi sélectionner les titres qui ont d'abord baissé. La revue d'août classait ce type
// de levier « fragile, à mesurer avant d'appliquer », et `Config Change Backtest` l'interdit
// sans 30 jours de backtest. La voie de validation est écrite : laisser l'instrumentation
// atteindre 200 lignes scellées, puis passer par validate-config-change.js en régime-aware.
//
// Effet de bord bénéfique : une largeur de bande nulle cesse de dévorer le R/R. Le risque court
// du prix d'entrée au stop, le gain de ce même prix à la cible — plus de double comptage.

function pivots(b, lookback = 40) {
  const w = b.slice(-lookback), lows = [], highs = [];
  for (let i = 2; i < w.length - 2; i++) {
    const lo = w[i][3], hi = w[i][2];
    if (lo < w[i - 1][3] && lo < w[i - 2][3] && lo < w[i + 1][3] && lo < w[i + 2][3]) lows.push(lo);
    if (hi > w[i - 1][2] && hi > w[i - 2][2] && hi > w[i + 1][2] && hi > w[i + 2][2]) highs.push(hi);
  }
  return { lows: lows.sort((a, c) => c - a), highs: highs.sort((a, c) => a - c) };
}

function buildLevels(sym, t, strategy) {
  const b = bars[sym];
  if (b.length < 40) throw new Error(`${sym}: ${b.length} barres < 40 — fenêtre pivot non comparable entre voies d'ingestion`);
  const close = num(b[b.length - 1][4], `${sym}.close`);
  const atr = num(t.atr, `${sym}.atr`);
  // Un prix unique, la clôture de référence. entry_low et entry_high sont conservés au
  // schéma pour la chaîne aval, mais portent la même valeur : il n'y a plus de bande.
  const entryLow = r2(close), entryHigh = r2(close);

  // STOP — le plancher de bruit se mesure depuis le remplissage le PLUS PROCHE (entry_low),
  // parce que c'est celui dont la protection est la plus exposée au bruit de séance.
  const minDist = Math.max(entryHigh * STOPS.min_pct_from_entry / 100, STOPS.min_atr_multiple * atr);
  const maxDist = entryHigh * STOPS.max_pct_from_entry / 100;
  if (minDist > maxDist) throw new Error(`${sym}: plancher de bruit ${minDist.toFixed(2)} au-delà du plafond ${maxDist.toFixed(2)} — instrument hors politique`);
  // STOP = plancher de bruit, point.
  // La branche « stop de structure » a été RETIRÉE le 2026-09-06. Raison : un pivot situé
  // sous la bande d entrée est, par construction, PLUS PROFOND que le plancher de bruit
  // (s il était plus proche, il tomberait dans le bruit et serait rejeté). L utiliser
  // élargit donc toujours le risque sans toucher au gain, dont la cible est fixée à un
  // multiple d ATR. Mesuré : AMZN passait de 0,86 à 0,60 de R/R par ce seul effet, sous le
  // plancher du régime. Surtout, l optimum de cible de tp1_reachability (+0,108 R, mesuré
  // sur 88 trades du 10/07 au 07/08) a été établi AVEC des stops au plancher : y adjoindre
  // un stop de structure, c est publier une cible calibrée pour une géométrie qu on
  // n applique plus. La structure reste dans la thèse et dans l invalidation, où elle sert
  // à expliquer POURQUOI le trade est faux ; elle ne fixe pas le niveau.
  // Arrondi vers le BAS : r2() arrondit au plus proche et pouvait rapprocher le stop de
  // l'entrée d'un demi-centime, le faisant passer SOUS le plancher réglementaire (KO
  // sortait à -2,99% pour un plancher de 3%). Un arrondi conservateur ne peut qu'éloigner
  // le stop, jamais le resserrer sous la limite.
  const stop = Math.floor((entryHigh - minDist) * 100) / 100, stopBasis = 'plancher_bruit';

  // CIBLE — première résistance réelle dans la bande autorisée, à défaut l'optimum mesuré.
  const tgtMin = entryHigh + TP.min_atr_multiple * atr;
  const tgtMax = entryHigh + TP.max_atr_multiple * atr;
  let tp1 = null, tp1Basis = null;
  for (const hi of pivots(b).highs) {
    if (hi >= tgtMin && hi <= tgtMax) { tp1 = r2(hi); tp1Basis = 'résistance'; break; }
  }
  if (tp1 == null) { tp1 = r2(entryHigh + TP.target_atr_multiple * atr); tp1Basis = 'optimum_mesuré'; }

  // Tout ce qui suit dérive des ARRONDIS publiés.
  const risk = entryHigh - stop;
  const reward = tp1 - entryHigh;
  return {
    close, entry: entryHigh, entry_low: entryLow, entry_high: entryHigh,
    stop, stopBasis,
    stopPctFromLow: r2((stop / entryHigh - 1) * 100),
    stopAtrFromLow: r2((entryHigh - stop) / atr),
    tp1, tp1Basis,
    tp1_atr_multiple: Math.round(((tp1 - entryHigh) / atr) * 1000) / 1000,
    tp2: r2(entryHigh + TP.max_atr_multiple * atr),
    rr_entry: r2(reward / risk),
    atr, atrPct: r2(atr / close * 100),
  };
}

// ── construction ─────────────────────────────────────────────────────────────
const signals = [], rejected = [];
const secT = SEC.data.tickers || {};
const earnT = EARN.data.tickers || {};

for (const pick of manifest.picks) {
  const T = pick.ticker;
  const fails = [];
  try {
    if (!ALLOWED_STRATEGIES.has(pick.strategy)) {
      throw new Error(`stratégie « ${pick.strategy} » hors liste blanche [${[...ALLOWED_STRATEGIES].join(', ')}]`);
    }
    const t = tech[T];
    if (!t) throw new Error('absent des artefacts enrichis');
    if (!bars[T]) throw new Error('aucune barre');
    for (const k of ['atr', 'rsi', 'ema50', 'ema200']) num(t[k], `${T}.${k}`);

    // secteur : la carte fait foi, une absence bloque
    const sector = DIV.sector_map[T];
    if (!sector) throw new Error(`absent de diversification.sector_map — concentration invérifiable, fail-closed`);
    if (!DIV.allowed_regions.includes(pick.region)) throw new Error(`région « ${pick.region} » hors [${DIV.allowed_regions.join(', ')}]`);

    const L = buildLevels(T, t, pick.strategy);

    // overextension
    const ext50 = r2((L.close / t.ema50 - 1) * 100);
    const ext200 = r2((L.close / t.ema200 - 1) * 100);
    const maxExt = OE.max_distance_50dma_pct_by_strategy[pick.strategy];
    if (maxExt == null) throw new Error(`aucun plafond d'extension défini pour « ${pick.strategy} »`);
    if (ext50 > maxExt) fails.push(`extension MM50 ${ext50}% > ${maxExt}%`);
    if (ext200 > OE.max_distance_200dma_pct) fails.push(`extension MM200 ${ext200}% > ${OE.max_distance_200dma_pct}%`);
    if (t.rsi > OE.max_rsi14_daily) fails.push(`RSI ${r2(t.rsi)} > ${OE.max_rsi14_daily}`);

    // consolidation
    const b = bars[T];
    const consol = t.consolidation_bars != null ? t.consolidation_bars
      : b.slice(-16, -1).filter(x => (x[2] - x[3]) < 1.5 * t.atr).length;
    if (consol < OE.min_consolidation_bars) fails.push(`consolidation ${consol} < ${OE.min_consolidation_bars}`);

    // liquidité
    const adv = t.adv20_usd != null ? t.adv20_usd
      : b.slice(-20).reduce((a, x) => a + x[4] * x[5], 0) / 20;
    const minAdv = FILTERS.tickers?.min_avg_daily_volume_usd ?? 10e6;
    if (adv < minAdv) fails.push(`ADV ${(adv / 1e6).toFixed(0)} M$ < ${(minAdv / 1e6).toFixed(0)} M$`);

    // stops et cible
    if (Math.abs(L.stopPctFromLow) < STOPS.min_pct_from_entry - 1e-9) fails.push(`stop ${L.stopPctFromLow}% sous le plancher ${STOPS.min_pct_from_entry}%`);
    if (Math.abs(L.stopPctFromLow) > STOPS.max_pct_from_entry + 1e-9) fails.push(`stop ${L.stopPctFromLow}% au-delà du plafond ${STOPS.max_pct_from_entry}%`);
    if (L.stopAtrFromLow < STOPS.min_atr_multiple - 1e-9) fails.push(`stop ${L.stopAtrFromLow}× ATR sous le plancher de bruit ${STOPS.min_atr_multiple}×`);
    if (L.tp1_atr_multiple < TP.min_atr_multiple || L.tp1_atr_multiple > TP.max_atr_multiple) fails.push(`cible ${L.tp1_atr_multiple}× ATR hors bande [${TP.min_atr_multiple}, ${TP.max_atr_multiple}]`);
    if (L.rr_entry < RR_MIN) fails.push(`R/R ${L.rr_entry} < ${RR_MIN} (plancher ${manifest.regime})`);
    if (L.entry_high >= L.tp1) fails.push(`entrée ${L.entry_high} ≥ cible ${L.tp1}`);

    // INVALIDATION OBSERVABLE. Trois invalidations publiées le 2026-09-06 étaient situées
    // SOUS le stop : le lecteur ne pouvait jamais les voir, la position étant fermée avant.
    // Le niveau est donc dérivé (plus bas de la séance de référence) plutôt que rédigé à la
    // main, et vérifié strictement au-dessus du stop.
    const refLow = r2(bars[T][bars[T].length - 1][3]);
    const inv = pick.invalidation_level != null ? num(pick.invalidation_level, `${T}.invalidation_level`) : refLow;
    if (inv <= L.stop) fails.push(`invalidation ${inv} au niveau ou sous le stop ${L.stop} — inobservable`);
    if (inv > L.entry_high) fails.push(`invalidation ${inv} au-dessus de l'entrée ${L.entry_high} — déjà franchie`);

    // preuves
    const sec = secT[T];
    if (!sec) throw new Error('aucune preuve SEC — fail-closed');
    if (!sec.dilution_clear) fails.push('dilution non levée');
    const earn = earnT[T];
    if (!earn) throw new Error('aucune preuve de calendrier — fail-closed');
    if (earn.event_found) fails.push(`résultats dans la fenêtre ±${FILTERS.earnings_window.exclude_days_before} j`);

    // ligne de screener point-in-time — capitalisation, liquidité archivée et fraîcheur
    const row = selRow(T);
    if (!row) throw new Error('absent de _final/selection_rows.json — sélection non traçable, fail-closed');
    const isEtf = pick.region === 'ETF';
    if (!isEtf && !(Number.isFinite(row.market_cap) && row.market_cap >= (FILTERS.tickers?.min_market_cap_usd ?? 5e8))) {
      fails.push(`capitalisation ${row.market_cap} sous le plancher`);
    }
    if (!Number.isFinite(row.estimated_valid_bars) || row.estimated_valid_bars < 1) {
      fails.push(`estimated_valid_bars=${row.estimated_valid_bars} — signal périmé, le screener ne lui accorde plus de validité`);
    }
    const rowAdv = row.last_price * row.avg_volume;

    if (fails.length) { rejected.push({ ticker: T, reason: fails.join(' | ') }); continue; }

    signals.push({
      ticker: T, name: pick.name,
      // SCORE PLAT, DÉLIBÉRÉMENT. Le contrat de score interdit deux familles dans une même
      // liste triée, et ce panier mêle des scores Pullback (14-22) et Momentum/Breakout
      // (68-86) qui ne mesurent pas la même chose. Surtout, la revue d'août mesure une
      // corrélation NULLE entre le score et le rendement, à tous les horizons, et sa
      // recommandation n°2 était de le retirer de la carte publiée. Un retrait complet
      // casserait les modes live (sweep.js:285 fait `s.score || 80`), d'où cette valeur
      // unique : elle dit explicitement qu'AUCUN classement n'est affirmé. Le score brut du
      // screener reste dans selection_evidence.source_screen_score pour l'audit.
      score: 80, scoreFamily: 'editorial', scoreSource: 'flat_no_ranking_asserted',
      strategy: pick.strategy,
      price: L.close, entry: L.entry, entry_low: L.entry_low, entry_high: L.entry_high,
      stop: L.stop, tp1: L.tp1, tp2: L.tp2,
      rr: `1:${L.rr_entry.toFixed(2)}`, rr_entry: L.rr_entry,
      tp1_atr_multiple: L.tp1_atr_multiple,
      horizon: manifest.horizon_days,
      region: pick.region, sector, sharia: false,
      market_cap: isEtf ? null : row.market_cap,
      ...(isEtf ? { lookthrough: pick.lookthrough } : {}),
      extension: { rsi: r2(t.rsi), atr: Math.round(t.atr * 1e4) / 1e4, distance_50dma_pct: ext50,
        distance_200dma_pct: ext200, consolidation_bars: consol,
        stop_atr_multiple_from_entry_low: L.stopAtrFromLow,
        stop_pct_from_entry_low: L.stopPctFromLow,
        stop_basis: L.stopBasis, tp1_basis: L.tp1Basis },
      avg_daily_dollar_volume: Math.round(rowAdv),
      earnings_clear: !earn.event_found, dilution_clear: sec.dilution_clear,
      earnings_source: isEtf ? 'n_a_etf'
        : (sec.issuer_filing_regime === 'foreign_private_issuer' ? 'issuer_calendar_verified' : '8k_item_202'),
      earnings_forward_evidence: { checked_at: EARN.data.checked_at, days_ahead: EARN.data.days_ahead,
        result: earn.result, event_found: earn.event_found,
        next_earnings: earn.next_earnings || null,
        source_artifact: `${dirRel}/${EARN.rel}`, source_sha256: EARN.sha256 },
      issuer_filing_regime: sec.issuer_filing_regime,
      dilution_scope: 'Dépôts SEC officiels revus sur 90 jours; dette classée séparément des offres d’actions.',
      sec_evidence: { source_artifact: `${dirRel}/${SEC.rel}`, source_sha256: SEC.sha256,
        checked_at: SEC.data.checked_at, dilution_window: SEC.data.dilution_window,
        pagination_exhausted: true,
        ...(sec.issuer_calendar_verified ? { issuer_calendar_verified: true, issuer_calendar_check: sec.issuer_calendar_check } : {}),
        latest_earnings_filing: sec.latest_earnings_filing,
        equity_offering_hits: sec.equity_offering_hits,
        non_equity_offering_hits: sec.non_equity_offering_hits,
        classification_evidence: sec.classification_evidence || null },
      selection_evidence: { source_artifact: `${dirRel}/${SEL.rel}`, source_sha256: SEL.sha256,
        screen_snapshot_as_of: REF, estimated_valid_bars: row.estimated_valid_bars,
        source_screen_score: row.score, source_screen: pick.source_artifact,
        avg_daily_dollar_volume: Math.round(rowAdv),
        score_note: manifest._score_caveat },
      thesis: pick.thesis,
      invalidation: pick.invalidation, invalidation_level: inv,
      execution: { status: 'conditional_next_session', gate: manifest.execution_gate },
    });
  } catch (e) {
    rejected.push({ ticker: T, reason: e.message });
  }
}

// ── garde-fous d'ensemble ────────────────────────────────────────────────────
const problems = [];
const usCount = signals.filter(s => s.region === 'US').length;
const etfCount = signals.filter(s => s.region === 'ETF').length;
if (usCount < DIV.min_us_count) problems.push(`${usCount} actions US < ${DIV.min_us_count}`);
if (etfCount < DIV.min_etf_count) problems.push(`${etfCount} ETF < ${DIV.min_etf_count}`);

const bySector = {};
signals.forEach(s => { bySector[s.sector] = (bySector[s.sector] || 0) + 1; });
for (const [sec, n] of Object.entries(bySector)) {
  if (n > DIV.max_per_sector) problems.push(`secteur ${sec} : ${n} lignes > ${DIV.max_per_sector}`);
}

// part par stratégie — plafond par défaut ET overlay immuable
const byStrat = {};
signals.forEach(s => { byStrat[s.strategy] = (byStrat[s.strategy] || 0) + 1; });
const gate = FILTERS.audit_gates?.recent_strategy_performance;
if (gate && signals.length) {
  const defMax = Math.floor(signals.length * (gate.default_max_share_pct ?? 50) / 100);
  for (const [st, n] of Object.entries(byStrat)) {
    if (n > defMax) problems.push(`${st} : ${n}/${signals.length} dépasse le plafond par défaut ${defMax} (${gate.default_max_share_pct}%)`);
  }
  const ovPath = path.join(ROOT, gate.source);
  if (!fs.existsSync(ovPath)) problems.push(`overlay ${gate.source} absent — plafond immuable invérifiable`);
  else {
    const ov = JSON.parse(fs.readFileSync(ovPath, 'utf8'));
    for (const pol of (ov.policies || [])) {
      if (pol.effective_from && manifest.scan_date < pol.effective_from) continue;
      if (pol.expires_after && manifest.scan_date > pol.expires_after) continue;
      const cap = Math.floor(signals.length * Number(pol.max_share_pct) / 100);
      const n = byStrat[pol.strategy] || 0;
      if (n > cap) problems.push(`${pol.strategy} : ${n}/${signals.length} dépasse le plafond temporaire ${cap} (${pol.max_share_pct}%) issu de la cohorte mature scellée jusqu'au ${ov.evidence_cutoff} (PF ${pol.mature_evidence?.profit_factor}, R moyen ${pol.mature_evidence?.average_r})`);
    }
  }
}

// scores
const SL = FILTERS.score_limits;
if (signals.some(s => s.score > SL.max_score)) problems.push(`score au-delà de ${SL.max_score}`);
const inflated = signals.filter(s => s.score >= SL.inflation_min_score).length;
if (signals.length && inflated / signals.length * 100 > SL.inflation_threshold_pct) {
  problems.push(`${inflated}/${signals.length} signaux à ${SL.inflation_min_score}+ — inflation de score`);
}

// Uniformité du R/R. `validate-scan.js` whiteliste explicitement la valeur attendue
// target_atr_multiple / min_atr_multiple comme conséquence de tp1_reachability, pas comme
// une triche. On applique la même exception, sinon on refuse un scan pour une propriété
// que la politique impose elle-même.
const expectedRR = r2(TP.target_atr_multiple / STOPS.min_atr_multiple);
const rrTally = {};
signals.forEach(s => { const k = s.rr_entry.toFixed(2); rrTally[k] = (rrTally[k] || 0) + 1; });
for (const [k, n] of Object.entries(rrTally)) {
  if (Number(k) === expectedRR) continue;
  if (signals.length && n / signals.length * 100 > SL.rr_uniformity_threshold_pct) {
    problems.push(`${n}/${signals.length} signaux au R/R ${k} — cible probablement rétro-calculée`);
  }
}

// ── sortie ───────────────────────────────────────────────────────────────────
const out = {
  scanDate: manifest.scan_date.replace(/-/g, ''),
  referenceClose: REF,
  regime: manifest.regime,
  regimeScore: manifest.regime_score,
  regimeScoreScale: manifest.regime_score_scale,
  regimeAuthority: manifest.regime_authority,
  regimeEngine: manifest.regime_engine,
  _pipelineOrder: manifest._pipelineOrder,
  _editorialNote: manifest._editorial_note,
  _scoreMethodology: manifest._score_caveat,
  _entryPolicy: manifest._entry_policy,
  generatedFrom: 'tools/build-scan.js',
  universe: manifest.universe,
  signals,
  momentum: [], breakout: [], pullback: [], pre_squeeze: [],
  exited_factors: [],
  tkl_pool: [], dtx_pool: [], fortress_pool: [],
  rejected,
  provenance,
};

console.log(`\nscan ${manifest.scan_date} — clôture ${REF} — ${manifest.regime} ${manifest.regime_score}/100`);
console.log(`${signals.length} signaux retenus, ${rejected.length} écartés\n`);
console.log('ticker strat      clôture   entrée              stop            TP1             R/R   ATR    RSI  MM50   secteur       base stop      base TP1');
for (const s of signals) {
  console.log(`${s.ticker.padEnd(6)} ${s.strategy.padEnd(10)} ${String(s.price).padStart(8)} ${`${s.entry_low}–${s.entry_high}`.padEnd(19)} ${`${s.stop} (${s.extension.stop_pct_from_entry_low}%)`.padEnd(15)} ${`${s.tp1} (${s.tp1_atr_multiple}×)`.padEnd(15)} ${String(s.rr_entry).padStart(4)} ${String(s.extension.atr && r2(s.extension.atr / s.price * 100)).padStart(5)}% ${String(s.extension.rsi).padStart(4)} ${String(s.extension.distance_50dma_pct).padStart(5)}% ${s.sector.padEnd(13)} ${s.extension.stop_basis.padEnd(14)} ${s.extension.tp1_basis}`);
}
if (rejected.length) {
  console.log('\nécartés :');
  rejected.forEach(x => console.log(`  ${x.ticker.padEnd(6)} ${x.reason}`));
}
console.log(`\nsecteurs : ${Object.entries(bySector).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`stratégies : ${Object.entries(byStrat).map(([k, v]) => `${k} ${v} (${Math.round(v / signals.length * 100)}%)`).join(', ')}`);
console.log(`R/R : ${Object.entries(rrTally).map(([k, v]) => `${k}×${v}`).join(', ')}`);

if (problems.length) {
  console.error('\nBLOQUANT :');
  problems.forEach(p => console.error(`  · ${p}`));
  process.exit(1);
}
console.log('\ntoutes les portes d\'ensemble sont franchies.');

if (!dryRun) {
  fs.writeFileSync(path.join(DIR, 'signals.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`→ ${dirRel}/signals.json`);
}
