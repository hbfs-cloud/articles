#!/usr/bin/env node
'use strict';

/**
 * score-contract.js — CONTRAT DE SCORE entre producteurs de signaux.
 *
 * ─── LE PROBLÈME (constaté, pas théorique) ────────────────────────────────────────────
 * Une quinzaine de producteurs écrivent leur `score` dans le MÊME fichier
 * `scanner/YYYYMMDD/signals.json`, la plupart dans le MÊME tableau `signals[]`. En aval,
 * sweep.js / pit-engine.js / gen-status-page.js / gen-scanner-notifications.js appliquent
 * un SEUL `minScore` par mode et trient par `b.score - a.score` — comme si tous les scores
 * vivaient sur la même échelle. Ils n'y vivent pas. Mesuré sur tout `scanner/<date>/signals.json` :
 *
 *   signals[]::Momentum / Breakout / Pullback   n=951   76 → 95     (conviction éditoriale 0-100)
 *   signals[]::ETFMomentum                      n=151   37 → 323    (somme pondérée, SANS borne)
 *   signals[]::IndexRotation                    n= 22  130 → 286    (momentum % × 100, SANS borne)
 *   signals[]::MomentumRotation                 n=104    5.6 → 241  (mom20*50+mom50*30+mom100*20)
 *   signals[]::Candlestick                      n= 80   72 → 183    (points additifs, base ≤80 +120)
 *   signals[]::TrendlineBreakout                n= 58   52 → 165    (SANS borne)
 *   signals[]::HighVolBreakout                  n= 50   62 → 130    (points additifs, ≤209)
 *   signals[]::AdaptiveFractal                  n=252   27 → 77     (composite qualité, plafond ~110)
 *   forex_pool                                  n=410   13.6 → 27.5 (points additifs, gate ≥8)
 *   metals_pool                                 n=227   25 → 34     (0-100 normalisé)
 *
 * Conséquences MÉCANIQUES d'un `minScore: 90` + tri par score sur ce mélange :
 *   1. Un ETFMomentum à 323 et un IndexRotation à 286 passent DEVANT toute conviction
 *      éditoriale à 95. Le tri ne classe pas la qualité, il classe l'échelle.
 *   2. Un AdaptiveFractal (max historique 77) ou un forex (max 27.5) est STRUCTURELLEMENT
 *      inéligible — jamais parce qu'il est mauvais, seulement parce qu'il compte en points.
 *   3. Un `minScore` déplacé de 90 à 85 ne veut pas dire la même chose selon la famille.
 * `validate-scan.js` connaissait déjà le symptôme (« scores hors échelle par construction »)
 * et se contentait d'EXCLURE les spécialistes de ses règles éditoriales — pendant que sweep,
 * lui, continuait à les classer ensemble.
 *
 * ─── ARBITRAGE (a) NORMALISER À LA SOURCE vs (b) DÉCLARER L'ÉCHELLE ──────────────────
 * (a) Réécrire chaque producteur pour émettre du 0-100.
 *     + Un seul `minScore` redevient littéralement lisible.
 *     − Change la VALEUR de `score` dans signals.json ⇒ change l'ordre de sélection ⇒ change
 *       les trades simulés par sweep. Les scans gelés (FROZEN_ONLY) et la chaîne SHA-256 de
 *       `data/backtest-trades.json` ne seraient plus reproductibles. 16 fichiers producteurs
 *       à toucher, chacun en parité revendiquée avec un moteur Go.
 *     − Surtout : un rescalage linéaire FABRIQUE une comparabilité qui n'existe pas. Un 90/100
 *       « conviction éditoriale » et un 90/100 « % de momentum rescalé » ne prédisent pas la
 *       même chose. On aurait masqué le bug sous une unité commune au lieu de le corriger.
 * (b) Chaque signal PORTE sa famille + sa plage déclarée ; toute comparaison inter-familles
 *     (seuil ou classement) devient une VIOLATION détectable, et la normalisation devient un
 *     acte explicite du consommateur.
 *     + Purement ADDITIF : aucune valeur de `score` existante n'est modifiée, aucun trade
 *       scellé n'est touché, aucun résultat de replay ne bouge.
 *     + Rend l'erreur IMPOSSIBLE À COMMETTRE EN SILENCE, ce qui est l'objectif demandé.
 *     − N'aligne pas magiquement les seuils : les modes qui mélangent des familles doivent
 *       être re-câblés (par famille) — mais au moins la dette est visible et chiffrée.
 *
 * ⇒ RETENU : (b), avec (a) disponible en OPT-IN explicite via `normalizeTo100()` — jamais
 *   appliqué d'office, et REFUSÉ (retourne null) pour les familles sans borne, parce qu'un
 *   squash arbitraire d'une échelle non bornée serait exactement la fabrication de donnée
 *   que le MCP HARD STOP interdit ailleurs.
 *
 * ─── LA RÈGLE ────────────────────────────────────────────────────────────────────────
 *   1. Tout signal appartient à UNE famille de score, résolue déterministiquement
 *      (champ `scoreFamily` explicite > pool `source` > label `strategy`). Inconnue = VIOLATION.
 *   2. Le score DOIT tomber dans la plage déclarée de sa famille. Dehors = VIOLATION BRUYANTE.
 *   3. Un seuil (`minScore`) ou un classement (`sort by score`) N'EST LÉGAL QU'À L'INTÉRIEUR
 *      d'une famille. Deux familles dans la même liste triée = VIOLATION.
 *      ⚠️  Même plage ≠ même sémantique : `editorial` et `adaptive_fractal` sont tous deux
 *      bornés 0-100 et restent NON comparables. La famille, pas l'échelle, fait foi.
 *   4. Pour comparer quand même : `partitionByFamily()` (sélection par famille, recommandé)
 *      ou `normalizeTo100()` (opt-in, uniquement familles bornées, jamais implicite).
 *
 * ─── MODES D'APPLICATION ─────────────────────────────────────────────────────────────
 *   env `SCORE_CONTRACT` = strict | warn (défaut) | off
 *     strict → `guard*()` LÈVE une ScoreContractError (utilisé par les gates de publication)
 *     warn   → hurle sur stderr (dédupé) + accumule dans le rapport, ne bloque pas. Défaut,
 *              parce que ~200 scans historiques sont DÉJÀ non conformes : un throw au
 *              chargement casserait tout replay sans corriger un seul scan passé.
 *     off    → silencieux (uniquement pour outillage d'analyse hors production)
 *   Les `assert*()` LÈVENT TOUJOURS, quel que soit le mode — ce sont les primitives.
 *
 * Usage (librairie) :
 *   const sc = require('./lib/score-contract');
 *   sc.assertScoreInRange(sig, 'etf-scanner');      // lève si hors plage déclarée
 *   sc.assertComparable(list, 'sweep:minScore');    // lève si la liste mélange des familles
 *   sc.guardSignal(sig, ctx); sc.guardComparable(list, ctx);   // respectent SCORE_CONTRACT
 *   const s100 = sc.normalizeTo100(sig);            // number | null (null = NON normalisable)
 *
 * Usage (CLI) :
 *   node tools/lib/score-contract.js --families            # table du registre
 *   node tools/lib/score-contract.js --audit               # audit de tout scanner/<date>/signals.json
 *   node tools/lib/score-contract.js --audit --since 20260701
 *   node tools/lib/score-contract.js --check scanner/20260807   # exit 1 si violation (gate)
 *   node tools/lib/score-contract.js --self-test
 *
 * SCOPE : SIM-ONLY, 100% code, zéro LLM, zéro I/O réseau. Même entrée → même sortie.
 * NE MODIFIE JAMAIS `score`. `stamp()` n'AJOUTE que des champs `score*` de métadonnée.
 */

// ─── Erreur dédiée ────────────────────────────────────────────────────────────────────

class ScoreContractError extends Error {
  constructor(message, violations) {
    super(message);
    this.name = 'ScoreContractError';
    this.violations = violations || [];
  }
}

// ─── Registre des familles ────────────────────────────────────────────────────────────
//
// Chaque entrée déclare :
//   id        identifiant stable de la famille (= valeur de `scoreFamily`)
//   producer  script qui émet ces scores (traçabilité)
//   unit      ce que le nombre MESURE (c'est ça qui rend deux familles incomparables)
//   min/max   PLAGE DÉCLARÉE — dérivée du CODE du producteur, pas d'un percentile observé.
//             Sortir de cette plage = le producteur est cassé → violation bruyante.
//   bounded   true  = borne haute structurelle (cap/clamp dans le code du producteur)
//             false = somme sans plafond ; `max` est alors une BORNE DE SANITÉ généreuse,
//                     franchie uniquement si le producteur déraille. Non normalisable.
//   pools     clés de pool de signals.json qui appartiennent à cette famille
//   strategies labels `strategy` (normalisés a-z0-9) rattachés à cette famille dans signals[]
//   observed  min/max constatés sur tout l'historique scanner/ au moment de l'écriture —
//             documentation seulement, JAMAIS utilisé par la garde.

const FAMILY_LIST = [
  {
    id: 'editorial',
    producer: 'curation /scanner (top 10 composite)',
    unit: 'conviction éditoriale 0-100 (score_limits.max_score = 98)',
    min: 0, max: 100, bounded: true,
    pools: [],
    strategies: ['momentum', 'breakout', 'pullback', 'presqueeze'],
    observed: { min: 71, max: 95, n: 976 },
  },
  {
    id: 'tkl_screener',
    producer: 'tkl_pool (screeners) — re-dérivé en [85,95] par sweep.buildSetups',
    unit: 'score screener 0-100 (souvent saturé à 99)',
    min: 0, max: 100, bounded: true,
    pools: ['tkl_pool'],
    strategies: [],
    observed: { min: 49, max: 99, n: 358 },
  },
  {
    id: 'dtx_engine',
    producer: 'tools/dtx-pool-bridge.js (moteur systematic-tss)',
    // Composite ADDITIF émis par le moteur, non borné par construction : il l'écrit lui-même
    // dans le motif de l'ordre (« BUY IOVA @ $6.50 | Score=114 | Risk=29.1% … »). La borne
    // [0,100] déclarée jusqu'au 2026-08-08 était une INFÉRENCE tirée d'un échantillon de 454
    // valeurs dont le maximum tombait à 100 — pas une propriété du producteur. Le 2026-08-10
    // le moteur a rendu 104, 109 et 114, et le contrat a bloqué la publication d'un scan dont
    // la donnée était pourtant fidèle. Aligné sur les autres producteurs additifs du fichier
    // (highvol_breakout, candlestick_pattern, adaptive_fractal) : bounded:false + plafond large.
    unit: 'composite additif du moteur — SANS BORNE déclarée par le producteur',
    min: 0, max: 200, bounded: false,
    // ABSENCE DE SCORE DÉCLARÉE (2026-08-12). Le moteur ne score QUE ses stratégies
    // breakout/momentum. Ses stratégies de ROTATION (« ROTATION_IN », « ROTATION_BUY: top-10
    // relative strength ») sélectionnent par classement de force relative et n'émettent aucun
    // score : 41 des 64 ordres BUY de data/dtx-engine-history.json (64 %) n'en ont pas.
    // Ce n'est pas un producteur cassé, c'est la forme réelle de la donnée. Jusqu'ici le trou
    // était bouché par un forfait 80 côté pont, qui plaçait des ordres JAMAIS évalués au 83e
    // centile de la distribution réelle (16..95) et inversait la sélection.
    // `unscorable` autorise `score: null` À CONDITION que le signal déclare `scoreSource:'none'`.
    // Un tel signal ne peut être ni seuillé ni classé au score — c'est justement le point :
    // il est admis uniquement par un mode qui ne trie pas au score (minScore <= 0) et classé
    // par le capital que le moteur lui a alloué (engineNotional). Un score null SANS
    // `scoreSource:'none'` reste une violation : on ne devine pas une absence.
    unscorable: true,
    pools: ['dtx_pool'],
    strategies: [],
    observed: { min: 30, max: 114, n: 510 },
  },
  {
    id: 'fortress_pm',
    producer: 'skill fortress-pm → fortress_pool',
    unit: 'conviction PM halal 0-100',
    min: 0, max: 100, bounded: true,
    pools: ['fortress_pool'],
    strategies: ['fortressa'],
    observed: { min: 85, max: 92, n: 26 },
  },
  {
    id: 'eu_smallcap',
    producer: 'agent MCP → eu_smallcap_pool',
    unit: 'conviction 0-100',
    min: 0, max: 100, bounded: true,
    pools: ['eu_smallcap_pool'],
    strategies: [],
    observed: { min: 73, max: 84, n: 13 },
  },
  {
    id: 'factor_composite',
    producer: 'tools/factor-scanner.js (displayScore: clamp(50 + composite*12, 1, 98))',
    unit: 'composite multi-facteur rescalé, monotone avec le rang',
    min: 1, max: 98, bounded: true,
    pools: ['factor_pool'],
    strategies: ['factorcomposite'],
    observed: null,
  },
  {
    id: 'pead_event',
    producer: 'tools/pead-scanner.js (60 + beats*4 + guidance + skew − dilution, cap 98)',
    unit: 'points événementiels post-earnings',
    min: 0, max: 98, bounded: true,
    pools: ['pead_pool'],
    strategies: ['pead'],
    observed: null,
  },
  {
    id: 'filings_event',
    producer: 'tools/filings-scanner.js (62 + insiders*5 + tier + upgrade, cap 98)',
    unit: 'points événementiels insider/filing',
    min: 0, max: 98, bounded: true,
    pools: ['filings_pool'],
    strategies: ['filings', 'insidercluster'],
    observed: null,
  },
  {
    id: 'gap_event',
    producer: 'tools/gap-scanner.js (58 + gap_tier + vol_tier, cap 98)',
    unit: 'points événementiels gap-and-go',
    min: 0, max: 98, bounded: true,
    pools: ['gap_pool'],
    strategies: ['gapgo', 'gap'],
    observed: null,
  },
  {
    id: 'crypto_momentum',
    producer: 'tools/crypto-scanner.js (clamp((r30*.4+r14*.25+r7*.15 + 50)/2, 0, 100))',
    unit: 'momentum normalisé 0-100',
    min: 0, max: 100, bounded: true,
    pools: ['crypto_pool'],
    strategies: ['cryptomomentum'],
    observed: { min: 45.45, max: 88.96, n: 116 },
  },
  {
    id: 'metals_momentum',
    producer: 'tools/metals-scanner.js (clamp((r30*.2+r14*.5+r7*.15 + 50)/2, 0, 100))',
    unit: 'momentum normalisé 0-100',
    min: 0, max: 100, bounded: true,
    pools: ['metals_pool'],
    strategies: ['metalsmomentum'],
    observed: { min: 25, max: 33.9, n: 227 },
  },
  {
    id: 'forex_multi',
    producer: 'tools/forex-scanner.js (parité scanner_forex.go, gate config min_score = 8)',
    unit: 'points additifs multi-stratégie (PAS une échelle 0-100)',
    min: 0, max: 60, bounded: false,
    pools: ['forex_pool'],
    strategies: ['forexmultistrategy'],
    observed: { min: 13.59, max: 27.5, n: 410 },
  },
  {
    id: 'momentum_rotation',
    producer: 'tools/momentum-scanner.js (mom20*50 + mom50*30 + mom100*20)',
    unit: 'rendement % pondéré — SANS BORNE, peut être négatif',
    min: -500, max: 1000, bounded: false,
    pools: [],
    strategies: ['momentumrotation'],
    observed: { min: 5.57, max: 241.14, n: 104 },
  },
  {
    id: 'casablanca_momrot',
    producer: 'tools/casablanca-scanner.js (même formule que momentum-scanner, univers BVC)',
    unit: 'rendement % pondéré — SANS BORNE, peut être négatif',
    min: -500, max: 1000, bounded: false,
    pools: ['casablanca_pool'],
    strategies: [],
    observed: { min: 20.33, max: 47.57, n: 15 },
  },
  {
    id: 'index_rotation',
    producer: 'tools/stockbox-scanner.js (momentum × 100)',
    unit: 'rendement % × 100 — SANS BORNE, peut être négatif',
    min: -500, max: 1000, bounded: false,
    pools: ['stockbox_pool'],
    strategies: ['indexrotation'],
    observed: { min: 129.85, max: 286.14, n: 24 },
  },
  {
    id: 'etf_momentum',
    producer: 'tools/etf-scanner.js (score du staging agent, formule momentum pondérée)',
    unit: 'momentum pondéré — SANS BORNE',
    min: -500, max: 1000, bounded: false,
    pools: [],
    strategies: ['etfmomentum'],
    observed: { min: 37.42, max: 323.18, n: 151 },
  },
  {
    id: 'trendline_breakout',
    producer: 'tools/trendline-scanner.js (score du staging agent)',
    unit: 'score de tendance — SANS BORNE',
    min: -500, max: 1000, bounded: false,
    pools: [],
    strategies: ['trendlinebreakout'],
    observed: { min: 51.8, max: 165, n: 58 },
  },
  {
    id: 'highvol_breakout',
    producer: 'tools/highvol-scanner.js (50 + bonus VIX/ATR/breakout/vol, ×1.10 en RISK-ON)',
    unit: 'points additifs (max structurel 190 × 1.10 = 209)',
    min: 0, max: 209, bounded: false,
    pools: [],
    strategies: ['highvolbreakout'],
    observed: { min: 62.36, max: 130, n: 50 },
  },
  {
    id: 'candlestick_pattern',
    producer: 'tools/candlestick-scanner.js + lib/candlestick-patterns.js',
    unit: 'points additifs (base pattern ≤80 + bonus ≤120 = 200)',
    min: 0, max: 200, bounded: false,
    pools: [],
    strategies: ['candlestick'],
    observed: { min: 72, max: 183, n: 80 },
  },
  {
    id: 'adaptive_fractal',
    producer: 'tools/fractal-scanner.js (0.30·reward + 0.20·timing + 0.25·riskAdj + 0.25·quality, ×1.1)',
    unit: 'composite qualité (plafond structurel ~110) — PAS une conviction',
    min: 0, max: 110, bounded: false,
    pools: [],
    strategies: ['adaptivefractal'],
    observed: { min: 27.5, max: 77.14, n: 252 },
  },
  {
    id: 'hybrid_megacap',
    producer: 'tools/hybrid-scanner.js (50 + bonus tendance/momentum/RSI)',
    unit: 'points additifs (max structurel 110)',
    min: 0, max: 110, bounded: false,
    pools: [],
    strategies: ['hybridmegacap', 'hybridaf', 'hybriddsl', 'megacap'],
    observed: null,
  },
];

const SCORE_FAMILIES = Object.freeze(Object.fromEntries(FAMILY_LIST.map(f => [f.id, Object.freeze(f)])));

// Sous-tags `source` observés dans la nature qui ne sont pas des clés de pool mais désignent
// sans ambiguïté un pool (le screener TKL tague sa sous-voie). Défense en profondeur : le
// chemin normal (scanner-parser.poolFrom) réécrit déjà `source = <clé de pool>`, mais un
// consommateur qui reçoit un signal brut ne doit pas tomber en `unknown_family` pour autant.
// N'y mettre QUE des tags dont l'appartenance au pool est exclusive (jamais `scanner_top10`,
// qui vit aussi bien dans fortress_pool que dans le composite éditorial).
const SOURCE_ALIASES = Object.freeze({
  tkl_momentum: 'tkl_pool',
  tkl_breakout: 'tkl_pool',
  tkl_pullback: 'tkl_pool',
  tkl_screener: 'tkl_pool',
  fortress_pm: 'fortress_pool',
});

// Index de résolution — construits une fois, figés.
const BY_POOL = new Map();
const BY_STRATEGY = new Map();
for (const f of FAMILY_LIST) {
  for (const p of f.pools) {
    if (BY_POOL.has(p)) throw new Error(`score-contract: pool "${p}" revendiqué par 2 familles`);
    BY_POOL.set(p, f.id);
  }
  for (const s of f.strategies) {
    if (BY_STRATEGY.has(s)) throw new Error(`score-contract: strategy "${s}" revendiquée par 2 familles`);
    BY_STRATEGY.set(s, f.id);
  }
}

// ─── Résolution de famille ────────────────────────────────────────────────────────────

const normLabel = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * familyOf(signal) → id de famille | null
 *
 * Ordre DÉTERMINISTE, du plus explicite au plus faible :
 *   1. `signal.scoreFamily` déclaré par le producteur (chemin cible)
 *   2. `signal.source` = clé de pool (crypto_pool, dtx_pool, …) — prioritaire sur `strategy`
 *      parce que le pool identifie le PRODUCTEUR, alors que `strategy` est un label réutilisé
 *      (ex: casablanca_pool porte strategy='AdaptiveFractal' mais l'échelle est celle de
 *      momentum-rotation, pas celle du fractal-scanner).
 *   3. label `strategy` normalisé
 * Aucune heuristique numérique : on ne DEVINE jamais une famille à partir de la valeur du
 * score (ce serait circulaire — c'est précisément ce que la garde doit vérifier).
 */
function familyOf(signal) {
  if (signal == null || typeof signal !== 'object') return null;
  if (signal.scoreFamily && SCORE_FAMILIES[signal.scoreFamily]) return signal.scoreFamily;
  const src = signal.source ? String(signal.source) : '';
  if (src && BY_POOL.has(src)) return BY_POOL.get(src);
  if (src && SOURCE_ALIASES[src] && BY_POOL.has(SOURCE_ALIASES[src])) return BY_POOL.get(SOURCE_ALIASES[src]);
  const strat = normLabel(signal.strategy);
  if (strat && BY_STRATEGY.has(strat)) return BY_STRATEGY.get(strat);
  return null;
}

function describeFamily(id) {
  const f = SCORE_FAMILIES[id];
  if (!f) return `${id} (famille inconnue)`;
  return `${f.id} [${f.min}..${f.max}${f.bounded ? '' : ', non borné'}] — ${f.unit}`;
}

// ─── Vérification (non levante) ───────────────────────────────────────────────────────

/**
 * checkSignal(signal, context) → { ok, family, violations: [{code, message, ticker, ...}] }
 * Ne lève jamais. Codes possibles :
 *   unknown_family  — impossible de rattacher le signal à une famille déclarée
 *   score_not_finite — score absent / NaN / non numérique
 *   score_out_of_range — score hors [min, max] de la famille déclarée
 */
function checkSignal(signal, context) {
  const ctx = context || 'unknown';
  const violations = [];
  const ticker = signal && signal.ticker ? String(signal.ticker) : '(sans ticker)';
  const family = familyOf(signal);

  if (!family) {
    violations.push({
      code: 'unknown_family', context: ctx, ticker, family: null, score: signal && signal.score,
      message: `${ticker}: aucune famille de score déclarée (source="${signal && signal.source || ''}", `
        + `strategy="${signal && signal.strategy || ''}") — un score sans famille ne peut être ni seuillé ni classé.`,
    });
    return { ok: false, family: null, violations };
  }

  const f = SCORE_FAMILIES[family];
  const score = signal.score;
  // Absence DÉCLARÉE (famille unscorable + scoreSource:'none') : donnée fidèle, pas producteur
  // cassé. On la laisse passer en la marquant `unscored` pour que les consommateurs la traitent
  // explicitement — jamais en lui inventant une valeur.
  if (score == null && f.unscorable && signal.scoreSource === 'none') {
    return { ok: true, family, unscored: true, violations };
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    violations.push({
      code: 'score_not_finite', context: ctx, ticker, family, score,
      message: `${ticker} [${family}]: score non numérique (${JSON.stringify(score)}) — rejeté, jamais réparé.`,
    });
    return { ok: false, family, violations };
  }
  if (score < f.min || score > f.max) {
    violations.push({
      code: 'score_out_of_range', context: ctx, ticker, family, score,
      message: `${ticker} [${family}]: score ${score} HORS de la plage déclarée [${f.min}, ${f.max}]`
        + `${f.bounded ? ' (borne structurelle du producteur)' : ' (borne de sanité — le producteur déraille)'}`
        + ` — producteur: ${f.producer}.`,
    });
    return { ok: false, family, violations };
  }
  return { ok: true, family, violations };
}

/**
 * checkComparable(signals, context) → { ok, families: [...], violations }
 * Une liste destinée à un SEUIL ou un CLASSEMENT par score doit être mono-famille.
 */
function checkComparable(signals, context) {
  const ctx = context || 'unknown';
  const violations = [];
  const list = Array.isArray(signals) ? signals : [];
  const counts = new Map();
  let unknown = 0;
  for (const s of list) {
    const fam = familyOf(s);
    if (!fam) { unknown++; continue; }
    counts.set(fam, (counts.get(fam) || 0) + 1);
  }
  // Une liste où cohabitent des signaux scorés et des signaux SANS score ne peut pas être
  // seuillée ni triée au score : c'est exactement le bug que le forfait 80 masquait.
  const nUnscored = list.filter(s => s && s.score == null && s.scoreSource === 'none').length;
  if (nUnscored > 0 && nUnscored < list.length) {
    violations.push({
      code: 'unscored_mixed_in_comparison', context: ctx, count: nUnscored, total: list.length,
      message: `${ctx}: ${nUnscored}/${list.length} signaux sans score (absence déclarée) dans une liste `
        + `seuillée/classée par score — un seuil les rejette tous ou les laisse tous passer selon `
        + `qu'on lise null comme 0 ou comme l'infini. Classer sur une clé présente partout.`,
    });
  }
  const families = [...counts.keys()].sort();
  if (unknown > 0) {
    violations.push({
      code: 'unknown_family_in_comparison', context: ctx, families, count: unknown,
      message: `${ctx}: ${unknown} signal(aux) sans famille déclarée dans une liste seuillée/classée par score.`,
    });
  }
  if (families.length > 1) {
    const detail = families.map(id => `${id}(n=${counts.get(id)}, [${SCORE_FAMILIES[id].min}..${SCORE_FAMILIES[id].max}])`).join(' + ');
    violations.push({
      code: 'cross_family_comparison', context: ctx, families, counts: Object.fromEntries(counts),
      message: `${ctx}: seuil/classement par score appliqué à ${families.length} familles à la fois — ${detail}. `
        + `Ces scores ne mesurent pas la même chose : le tri classe l'échelle, pas la qualité. `
        + `Utiliser partitionByFamily() (sélection par famille) ou normalizeTo100() explicitement.`,
    });
  }
  return { ok: violations.length === 0, families, violations };
}

// ─── Assertions (LÈVENT TOUJOURS) ─────────────────────────────────────────────────────

function assertScoreInRange(signal, context) {
  const r = checkSignal(signal, context);
  if (!r.ok) throw new ScoreContractError(`CONTRAT DE SCORE VIOLÉ — ${r.violations.map(v => v.message).join(' ; ')}`, r.violations);
  return r.family;
}

function assertComparable(signals, context) {
  const r = checkComparable(signals, context);
  if (!r.ok) throw new ScoreContractError(`CONTRAT DE SCORE VIOLÉ — ${r.violations.map(v => v.message).join(' ; ')}`, r.violations);
  return r.families[0] || null;
}

// ─── Mode d'application + rapport accumulé ────────────────────────────────────────────

function mode() {
  const m = String(process.env.SCORE_CONTRACT || 'warn').toLowerCase();
  return m === 'strict' || m === 'off' ? m : 'warn';
}

const _report = { violations: [], seen: new Set() };

function _emit(violations) {
  const m = mode();
  if (m === 'off' || !violations.length) return;
  if (m === 'strict') {
    throw new ScoreContractError(`CONTRAT DE SCORE VIOLÉ — ${violations.map(v => v.message).join(' ; ')}`, violations);
  }
  for (const v of violations) {
    _report.violations.push(v);
    // Dédup: une ligne par (code, context, famille(s)/ticker) — un replay charge ~200 scans,
    // on hurle une fois par cause distincte, pas 200 fois.
    const key = `${v.code}|${v.context}|${v.family || (v.families || []).join('+')}|${v.ticker || ''}`;
    if (_report.seen.has(key)) continue;
    _report.seen.add(key);
    console.error(`⛔ [score-contract] ${v.code} — ${v.message}`);
  }
}

/** guardSignal / guardComparable : respectent SCORE_CONTRACT (strict=throw, warn=hurle, off=muet). */
function guardSignal(signal, context) {
  const r = checkSignal(signal, context);
  if (!r.ok) _emit(r.violations);
  return r;
}
function guardComparable(signals, context) {
  const r = checkComparable(signals, context);
  if (!r.ok) _emit(r.violations);
  return r;
}

/** report() → snapshot des violations accumulées en mode warn (pour un récap de fin de run). */
function report() {
  const byCode = {};
  for (const v of _report.violations) byCode[v.code] = (byCode[v.code] || 0) + 1;
  return { mode: mode(), total: _report.violations.length, byCode, violations: _report.violations.slice() };
}
function resetReport() { _report.violations.length = 0; _report.seen.clear(); }

/** printSummary() → une ligne de récap en fin de run si des violations ont été accumulées. */
function printSummary(label) {
  const r = report();
  if (!r.total) return r;
  const codes = Object.entries(r.byCode).map(([c, n]) => `${c}=${n}`).join(' ');
  console.error(`⛔ [score-contract] ${label || 'run'} : ${r.total} violation(s) du contrat de score (${codes}). `
    + `SCORE_CONTRACT=strict pour bloquer, node tools/lib/score-contract.js --audit pour le détail.`);
  return r;
}

// ─── Métadonnée portée par le signal (option (b)) ─────────────────────────────────────

/**
 * stamp(signal) → le MÊME objet, enrichi de :
 *   scoreFamily     id de famille (ou null si non résolue)
 *   scoreScale      "min..max" déclaré, ou null
 *   scoreBounded    true si borne structurelle, false si somme sans plafond
 *   scoreUnit       ce que le nombre mesure
 * `score` n'est JAMAIS modifié. Idempotent.
 */
function stamp(signal) {
  if (signal == null || typeof signal !== 'object') return signal;
  const family = familyOf(signal);
  const f = family ? SCORE_FAMILIES[family] : null;
  signal.scoreFamily = family;
  signal.scoreScale = f ? `${f.min}..${f.max}` : null;
  signal.scoreBounded = f ? f.bounded : null;
  signal.scoreUnit = f ? f.unit : null;
  return signal;
}

// ─── Comparaison sanctionnée ──────────────────────────────────────────────────────────

/**
 * normalizeTo100(signal) → number 0..100 | null
 * Rescalage linéaire min→0 / max→100, UNIQUEMENT pour les familles à borne structurelle.
 * Retourne `null` (jamais une valeur inventée) si :
 *   • la famille est inconnue,
 *   • le score est hors plage (le producteur est cassé — on ne "répare" pas),
 *   • la famille n'est PAS bornée : squasher une somme sans plafond fabriquerait une
 *     comparabilité inexistante. Utiliser le rang intra-famille à la place.
 * ⚠️ Aligner les plages n'aligne PAS les sémantiques : deux familles normalisées à 0-100
 * restent des mesures différentes. `assertComparable` reste family-based, pas scale-based.
 */
function normalizeTo100(signal) {
  const family = familyOf(signal);
  if (!family) return null;
  const f = SCORE_FAMILIES[family];
  if (!f.bounded) return null;
  const s = signal.score;
  if (typeof s !== 'number' || !Number.isFinite(s)) return null;
  if (s < f.min || s > f.max) return null;
  if (f.max === f.min) return null;
  return ((s - f.min) / (f.max - f.min)) * 100;
}

/** partitionByFamily(signals) → Map<familyId|'__unknown__', signal[]> — la voie recommandée. */
function partitionByFamily(signals) {
  const out = new Map();
  for (const s of Array.isArray(signals) ? signals : []) {
    const key = familyOf(s) || '__unknown__';
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(s);
  }
  return out;
}

/**
 * rankWithinFamily(signals) → [{signal, family, rank, ofN, pct}]
 * Rang décroissant PAR FAMILLE (1 = meilleur de sa famille) + percentile 0-100. C'est le seul
 * classement inter-familles honnête : il compare des POSITIONS RELATIVES, pas des unités.
 * Tri stable et déterministe (score décroissant, puis ticker croissant).
 */
function rankWithinFamily(signals) {
  const out = [];
  for (const [family, list] of partitionByFamily(signals)) {
    const sorted = list.slice().sort((a, b) => (b.score - a.score) || String(a.ticker || '').localeCompare(String(b.ticker || '')));
    sorted.forEach((signal, i) => {
      out.push({
        signal, family: family === '__unknown__' ? null : family,
        rank: i + 1, ofN: sorted.length,
        pct: sorted.length > 1 ? ((sorted.length - 1 - i) / (sorted.length - 1)) * 100 : 100,
      });
    });
  }
  return out;
}

module.exports = {
  ScoreContractError,
  SCORE_FAMILIES,
  familyOf, describeFamily,
  checkSignal, checkComparable,
  assertScoreInRange, assertComparable,
  guardSignal, guardComparable,
  mode, report, resetReport, printSummary,
  stamp, normalizeTo100, partitionByFamily, rankWithinFamily,
};

// ─── CLI ──────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const argv = process.argv.slice(2);
  const has = f => argv.includes(f);
  const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
  const ROOT = path.join(__dirname, '..', '..');
  const SCANNER_DIR = path.join(ROOT, 'scanner');

  // Toutes les clés de signals.json qui portent des signaux (pools + composite + sous-pools).
  const POOL_KEYS = new Set([...BY_POOL.keys(), 'fortress_pool']);
  const STRATEGY_SUBPOOLS = ['momentum', 'breakout', 'pullback', 'pre_squeeze', 'bull'];

  // Parcourt un signals.json et rend [{signal, context}] avec le `source` implicite du pool.
  function collect(file) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const items = [];
    const add = (arr, poolKey) => {
      for (const s of arr || []) {
        // Le pool d'où il vient FAIT PARTIE de l'identité, et il est AUTORITAIRE : c'est
        // exactement ce que fait scanner-parser.poolFrom (`m.source = key`), qui écrase le
        // sous-tag éventuel du producteur. Copie superficielle pour ne jamais muter le fichier lu.
        const sig = poolKey ? Object.assign({}, s, { source: poolKey }) : s;
        items.push({ signal: sig, pool: poolKey || 'signals[]' });
      }
    };
    add(j.signals, null);
    for (const k of STRATEGY_SUBPOOLS) add(j[k], null);
    for (const k of Object.keys(j)) if (POOL_KEYS.has(k) || /_pool$/.test(k)) add(j[k], k);
    return items;
  }

  function auditFile(file, label) {
    const items = collect(file);
    const violations = [];
    for (const { signal, pool } of items) {
      const r = checkSignal(signal, `${label}:${pool}`);
      violations.push(...r.violations);
    }
    // Le composite signals[] est la liste que sweep/pit-engine/gen-status-page seuillent et
    // trient en bloc : c'est LÀ que la comparaison inter-familles se produit réellement.
    const composite = items.filter(i => i.pool === 'signals[]').map(i => i.signal);
    violations.push(...checkComparable(composite, `${label}:signals[] (seuil minScore + tri)`).violations);
    return { file, label, count: items.length, violations };
  }

  if (has('--families')) {
    console.log('CONTRAT DE SCORE — registre des familles\n');
    console.log('famille'.padEnd(22) + 'plage'.padEnd(16) + 'borné'.padEnd(8) + 'norm.'.padEnd(7) + 'unité');
    console.log('─'.repeat(120));
    for (const f of FAMILY_LIST) {
      console.log(
        f.id.padEnd(22)
        + `[${f.min}..${f.max}]`.padEnd(16)
        + (f.bounded ? 'oui' : 'NON').padEnd(8)
        + (f.bounded ? 'oui' : 'refus').padEnd(7)
        + f.unit
      );
    }
    console.log('\nRègle : un seuil ou un classement par score n\'est légal QU\'À L\'INTÉRIEUR d\'une famille.');
    console.log('Même plage ≠ même sémantique — la famille fait foi, pas l\'échelle.');
    process.exit(0);
  }

  if (has('--check')) {
    const target = val('--check');
    if (!target) { console.error('Usage: --check scanner/YYYYMMDD'); process.exit(2); }
    const abs = path.resolve(ROOT, target);
    const file = abs.endsWith('.json') ? abs : path.join(abs, 'signals.json');
    if (!fs.existsSync(file)) { console.error(`⛔ introuvable: ${file}`); process.exit(2); }
    const r = auditFile(file, path.basename(path.dirname(file)));
    if (!r.violations.length) {
      console.log(`✅ contrat de score respecté — ${r.count} signaux, ${r.label}`);
      process.exit(0);
    }
    console.error(`⛔ CONTRAT DE SCORE VIOLÉ — ${r.violations.length} violation(s) dans ${r.label} (${r.count} signaux)\n`);
    for (const v of r.violations) console.error(`   • [${v.code}] ${v.message}`);
    process.exit(1);
  }

  if (has('--audit')) {
    const since = val('--since');
    const dirs = fs.readdirSync(SCANNER_DIR)
      .filter(d => /^\d{8}$/.test(d))
      .filter(d => !since || d >= String(since).replace(/-/g, ''))
      .sort();
    const byCode = {};
    const byFamily = {};
    const crossFamilyDates = [];
    let files = 0, signals = 0, total = 0;
    for (const d of dirs) {
      const file = path.join(SCANNER_DIR, d, 'signals.json');
      if (!fs.existsSync(file)) continue;
      let r;
      try { r = auditFile(file, d); } catch (e) { console.error(`   (illisible ${d}: ${e.message})`); continue; }
      files++; signals += r.count; total += r.violations.length;
      for (const v of r.violations) {
        byCode[v.code] = (byCode[v.code] || 0) + 1;
        const fk = v.family || (v.families || []).join('+') || '(inconnue)';
        byFamily[fk] = (byFamily[fk] || 0) + 1;
        if (v.code === 'cross_family_comparison') crossFamilyDates.push({ date: d, families: v.families });
      }
    }
    if (has('--json')) {
      console.log(JSON.stringify({ files, signals, total, byCode, byFamily, crossFamilyDates }, null, 2));
      process.exit(total ? 1 : 0);
    }
    console.log(`\nAUDIT CONTRAT DE SCORE — ${files} scans, ${signals} signaux\n`);
    console.log(`Violations : ${total}`);
    for (const [c, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${c}`);
    if (Object.keys(byFamily).length) {
      console.log('\nPar famille / combinaison :');
      for (const [f, n] of Object.entries(byFamily).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${f}`);
    }
    if (crossFamilyDates.length) {
      console.log(`\n${crossFamilyDates.length} scan(s) où signals[] mélange des familles dans un même seuil/tri :`);
      for (const c of crossFamilyDates.slice(0, 15)) console.log(`   ${c.date}  ${c.families.join(' + ')}`);
      if (crossFamilyDates.length > 15) console.log(`   … +${crossFamilyDates.length - 15} autres`);
    }
    process.exit(total ? 1 : 0);
  }

  if (has('--self-test')) {
    // Le vrai self-test vit dans tools/score-contract.test.js ; ici un smoke minimal.
    const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
    ok(familyOf({ strategy: 'ETFMomentum' }) === 'etf_momentum', 'résolution par strategy');
    ok(familyOf({ source: 'crypto_pool', strategy: 'ETFMomentum' }) === 'crypto_momentum', 'le pool prime sur strategy');
    ok(familyOf({ strategy: 'Inventé' }) === null, 'label inconnu → null (fail-closed)');
    let threw = false;
    try { assertScoreInRange({ ticker: 'X', strategy: 'Momentum', score: 323 }, 't'); } catch (e) { threw = e instanceof ScoreContractError; }
    ok(threw, 'assertScoreInRange lève hors plage');
    threw = false;
    try { assertComparable([{ strategy: 'Momentum', score: 95 }, { strategy: 'ETFMomentum', score: 323 }], 't'); } catch (e) { threw = true; }
    ok(threw, 'assertComparable lève sur mélange de familles');
    ok(normalizeTo100({ strategy: 'ETFMomentum', score: 200 }) === null, 'famille non bornée → refus de normaliser');
    console.log('SELF-TEST OK — score-contract (smoke). Suite complète : node tools/score-contract.test.js');
    process.exit(0);
  }

  console.log('Usage: node tools/lib/score-contract.js [--families | --audit [--since YYYYMMDD] [--json] | --check <scanner/YYYYMMDD> | --self-test]');
  process.exit(0);
}
