#!/usr/bin/env node
'use strict';
/**
 * dtx-pool-bridge.js — compatibilité historique des décisions dtx vers `dtx_pool`.
 *
 * POURQUOI (fix "0 trades depuis D0", 2026-07-16). Depuis le cut-over « le MCP fait foi »
 * (2026-07-08, v15 2026-07-13), le staging data/dtx/<id>.json alimentait UNIQUEMENT l'affichage
 * (Orders to Place + splice equity de gen-status-page). AUCUN producteur ne convertissait les
 * ordres du moteur en trades trackés : sweep.js / pit-engine.js / pit-forward.js ignoraient
 * data/dtx/ → backtest-trades.json[<mode scripté>] restait vide à jamais pendant que les replays
 * tradaient. Ce pont ferme le trou en réutilisant le chemin ÉPROUVÉ des asset-pools (crypto/forex/
 * eu_smallcap…) : les ordres CREATE deviennent des signaux source-taggés `dtx_pool`, consommés
 * EXCLUSIVEMENT par les modes scriptés (assetClass 'dtx' via ASSET_POOL_SOURCES) et partitionnés
 * par mode via `universe: <modeId>` + universeFilter. Le sweep fait ensuite TOUT le reste :
 * fills sur prix réels, exits (config du mode), append-only scellé (trade-chain), positions,
 * equity → la status page vit sans aucun nouveau moteur parallèle.
 *
 * CONTRAT FORWARD CERTIFIÉ (2026-09-01). Un mode qui déclare
 * `forwardTracking.source=no_certified_fill_yet` ne passe JAMAIS par ce pont : une proposition
 * moteur n'est pas un fill, et le sweep synthétique ne peut pas certifier une exécution. Le pool
 * est alors vidé pour ce mode ; le plan reste visible séparément depuis le staging Contract V2.
 *
 * FIDÉLITÉ (honnêteté, pas de fabrication) :
 *   - entry/stop = ceux du moteur (order.entry|limitPrice / order.stopLoss), JAMAIS inventés.
 *   - tp1 : celui du moteur s'il en émet un, `null` sinon — JAMAIS dérivé. Le moteur dtx ne prend
 *     pas de profit sur sa poche porteuse (exits = rotation + stop). Le schéma setup du sweep
 *     accepte un candidat sans cible pour la source `dtx_pool` (depuis le 2026-08-12) : le tracker
 *     gère la sortie via la config du mode, il n'a jamais eu besoin d'un TP pour ça.
 *   - Un ordre sans stop exploitable (stop >= entry, ou manquant) est SKIPPÉ et loggé — jamais
 *     complété avec des niveaux inventés.
 *
 * FRAÎCHEUR : le staging DOIT être daté de la séance du scan (asof === --date). Un staging stale
 * est SKIPPÉ bruyamment (le mode n'aura simplement pas de candidats ce soir-là — dégradation
 * honnête, pas silencieuse : le résumé liste les modes skippés et l'exit code le reflète).
 *
 * Usage :
 *   node tools/dtx-pool-bridge.js --folder 20260717 --date 2026-07-17 [--dry-run] [--force]
 *
 * Exit codes : 0 = tous les stagings frais ingérés ; 3 = au moins un mode skippé (stale/manquant/
 * sans ordre valide) — NON bloquant pour le pipeline mais visible ; 2 = erreur d'usage.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGING_DIR = path.join(ROOT, 'data', 'dtx');
const MODES_CFG = path.join(ROOT, 'data', 'modes-config.json');

function parseArgs(argv) {
  const o = { folder: null, date: null, dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--folder') o.folder = argv[++i];
    else if (a === '--date') o.date = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
  }
  return o;
}

/**
 * Modes scriptés = modes-config avec assetClass 'dtx' (source de vérité du câblage).
 * `modeId` is the stable public namespace (staging filename + signal universe);
 * `portfolioId` is the engine namespace selected by dtxPortfolio.
 */
function scriptedModes() {
  const cfg = JSON.parse(fs.readFileSync(MODES_CFG, 'utf8')).modes || {};
  return Object.entries(cfg)
    .filter(([, modeCfg]) => modeCfg.assetClass === 'dtx' && modeCfg.status !== 'stopped')
    .map(([modeId, modeCfg]) => ({
      modeId,
      portfolioId: String(modeCfg.dtxPortfolio || modeId),
      configHash: String(modeCfg.dtxConfigHash || ''),
      forwardSource: modeCfg.forwardTracking && modeCfg.forwardTracking.source || null,
    }));
}

/** Un ordre CREATE BUY du staging → un signal pool (shape scanner-parser mapSignal). */
function orderToSignal(o, modeId, rank) {
  const ticker = String(o.symbol || '').replace(/=X$/, '');
  const entry = o.entry != null ? Number(o.entry) : (o.limitPrice != null ? Number(o.limitPrice) : null);
  const stop = o.stopLoss != null ? Number(o.stopLoss) : null;
  if (!ticker || !entry || !stop || !(entry > 0) || !(stop > 0) || stop >= entry) return null;
  // TP1 — CELUI DU MOTEUR, ou RIEN (2026-08-12). L'ancien défaut `entry + 2R` était une cible que
  // personne n'avait décidée : le moteur n'émet aucun take-profit sur sa poche porteuse (18/18
  // ordres à `takeProfit: null` le 12/08), ses sorties SONT la rotation et le stop, et le CAGR
  // servi vient précisément des gagnants qu'il ne coupe pas. Ce chiffre n'était pas décoratif —
  // il conditionnait l'admission au simulateur (`sweep.js` rejetait tout setup sans tp1 > entry)
  // et rendait le R/R de 100 % des lignes rigoureusement égal à 2, une constante fabriquée qui se
  // serait scellée dans la chaîne SHA-256 au premier trade clos. Le schéma du sweep accepte
  // désormais un setup sans cible pour cette source : `null` traverse la simulation, aucune sortie
  // TP ne s'arme, et le tracker gère la sortie avec les règles du mode.
  const tp1 = o.takeProfit != null && Number(o.takeProfit) > entry ? Number(o.takeProfit) : null;
  // SCORE — jamais fabriqué (2026-08-12). L'ancien forfait `score = 80` pour les ordres non
  // scorés inversait la sélection : sur les 18 ordres du 2026-08-12, il faisait passer les 7
  // ROTATION_IN (que le moteur ne score PAS) au-dessus de RNW 70 et NIQ 62, pendant que le
  // minScore=50 hérité de book_honest jetait 8 décisions RÉELLES du moteur (BTG 24, DV 16,
  // IAUX 31, OTF 16, OWL 20, STGW 19, TGB 16, TIC 23). Le score du moteur n'existe que pour
  // les stratégies breakout/momentum ; les stratégies de ROTATION n'en produisent aucun (la
  // sélection EST le classement top-N de force relative). Sur les 64 ordres BUY du registre
  // data/dtx-engine-history.json, 41 (64 %) n'ont aucun score. Un ordre sans score porte
  // désormais `score:null` + `scoreSource:'none'` : le gate du sweep le traite explicitement
  // (jamais admis par un nombre inventé).
  let score = o.score != null && !isNaN(o.score) ? Number(o.score) : null;
  if (score == null) {
    const m = /Score=(-?\d+(?:\.\d+)?)/.exec(o.reason || '');
    score = m ? Number(m[1]) : null;
  }
  return {
    ticker,
    // strategy = reason brut du moteur : detectStrategy() du sweep en tire le tag
    // (highvol-breakout → highvol_breakout, etc.) ; le filtre 'dtx_engine' n'exclut rien.
    strategy: String(o.reason || 'dtx-engine'),
    score,
    // Provenance du score : 'engine' = chiffre du moteur, 'none' = le moteur n'en produit pas
    // pour cette stratégie.
    scoreSource: score == null ? 'none' : 'engine',
    // CLASSEMENT DES CANDIDATS. Quand le tracker a moins de places que d'ordres (topN, et surtout
    // regimeParams.maxPositions : 3 en neutral, 15 en risk_on), il doit trancher. Inventaire de ce
    // que le moteur fournit réellement, sur les 64 ordres BUY du registre :
    //   · score            → 23/64 (36 %), et incomparable entre sous-stratégies (breakout 16..95
    //                        vs rotation non scorée) ;
    //   · priority         → null sur 64/64, aucune information ;
    //   · ordre d'émission → strictement alphabétique (BTG BWET DV GBUG…), donc aucune information :
    //                        s'en servir ferait entrer les positions par ordre de nom ;
    //   · qty × entry      → 64/64 (100 %), 16 valeurs distinctes sur les 18 ordres du 2026-08-12.
    // C'est le CAPITAL QUE LE MOTEUR A DÉCIDÉ D'ALLOUER — un chiffre qu'il produit lui-même, lu tel
    // quel. Quand les places manquent, servir d'abord les plus grosses allocations du moteur est ce
    // qui rapproche le plus le livre suivi du livre décidé. Ce montant sert UNIQUEMENT au classement :
    // le sizing des positions reste celui du mode (inverse_atr / targetRiskPct).
    engineNotional: o.qty != null && Number(o.qty) > 0 ? +(Number(o.qty) * entry).toFixed(2) : null,
    engineRank: rank, // ordre d'émission — conservé comme départage STABLE uniquement (non informatif)
    entry: +entry.toFixed(4),
    stop: +stop.toFixed(4),
    tp1,
    tp2: null,
    // Pas de cible ⇒ pas de R/R. `null` plutôt qu'un nombre : un R/R affiché est une promesse de
    // gain rapporté au risque, elle n'existe pas quand la sortie est une rotation.
    rr: tp1 != null ? +((tp1 - entry) / (entry - stop)).toFixed(2) : null,
    universe: modeId, // partition par mode (universeFilter === modeId)
    // SLEEVE (poche du livre : mx / etf_us / uhv_tp999 / ep) — PASS-THROUGH STRICT, jamais dérivé.
    // Le signals.json commité du 2026-08-12 portait ce champ sur les 18 entrées ; le staging
    // `data/dtx/best.json` ne le porte PAS (aucune des 15 clés d'un ordre CREATE ne le contient),
    // donc aucun outil de la chaîne ne peut le reproduire — il venait d'une saisie agent en amont.
    // On le fait TRANSITER dès que le staging le fournira, et on refuse de le deviner d'ici là :
    // « GDX est un ETF donc etf_us » est une inférence, pas une donnée. Conséquence assumée et
    // déclarée dans .claude/REPRISE.md : le DRIFT uhv_tp999 ↔ partialTPGain n'est pas
    // diagnosticable à la granularité de la poche tant que l'ingest ne porte pas ce tag.
    ...(o.sleeve ? { sleeve: String(o.sleeve) } : {}),
    source: 'dtx_pool',
  };
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.folder || !opts.date) {
    console.error('Usage: node tools/dtx-pool-bridge.js --folder YYYYMMDD --date YYYY-MM-DD [--dry-run] [--force]');
    process.exit(2);
  }
  const sigPath = path.join(ROOT, 'scanner', opts.folder, 'signals.json');
  if (!fs.existsSync(sigPath)) {
    console.error(`❌ ${sigPath} introuvable — le scan ${opts.folder} doit exister avant le bridge.`);
    process.exit(2);
  }

  const modes = scriptedModes();
  if (!modes.length) {
    console.log('Aucun mode scripté (assetClass dtx) dans modes-config.json — rien à faire.');
    process.exit(0);
  }

  const pool = [];
  const skipped = [];
  const withheld = [];
  const ingested = [];
  for (const { modeId, portfolioId, configHash, forwardSource } of modes) {
    if (forwardSource === 'no_certified_fill_yet') {
      withheld.push(`${modeId} (plan publié séparément ; aucune position synthétique)`);
      continue;
    }
    const p = path.join(STAGING_DIR, `${modeId}.json`);
    let stg;
    try { stg = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (_) { skipped.push(`${modeId} (staging manquant)`); continue; }
    const asof = String(stg.asof || '').slice(0, 10);
    if (stg.engineMode !== 'mcp') { skipped.push(`${modeId} (engineMode:${stg.engineMode || '—'} ≠ mcp)`); continue; }
    if (stg.mode !== modeId) {
      skipped.push(`${modeId} (mode public du staging:${stg.mode || '—'} ≠ ${modeId})`);
      continue;
    }
    if (stg.portfolioId !== portfolioId) {
      skipped.push(`${modeId} (portfolioId:${stg.portfolioId || '—'} ≠ moteur attendu ${portfolioId})`);
      continue;
    }
    if (!configHash || stg.configHash !== configHash) {
      skipped.push(`${modeId} (configHash:${stg.configHash || '—'} ≠ attendu ${configHash || 'non configuré'})`);
      continue;
    }
    if (asof !== opts.date) { skipped.push(`${modeId} (staging STALE asof:${asof} ≠ ${opts.date})`); continue; }
    if (stg.metricsSuspect === true) { skipped.push(`${modeId} (metricsSuspect — sanity gate)`); continue; }
    const validFromRaw = String(stg.decisionProvenance?.validFrom || '');
    const validUntilRaw = String(stg.decisionProvenance?.validUntil || '');
    const validFrom = validFromRaw.slice(0, 10);
    const validUntil = validUntilRaw.slice(0, 10);
    if (!validFrom || !validUntil) {
      skipped.push(`${modeId} (fenêtre Contract V2 absente)`);
      continue;
    }
    if (validFrom !== opts.date) {
      skipped.push(`${modeId} (plan valide le ${validFrom}, pas le ${opts.date})`);
      continue;
    }
    const validFromMs = Date.parse(validFromRaw);
    const validUntilMs = Date.parse(validUntilRaw);
    const nowMs = Date.now();
    if (!Number.isFinite(validFromMs) || !Number.isFinite(validUntilMs)
      || nowMs < validFromMs || nowMs > validUntilMs) {
      skipped.push(`${modeId} (plan hors fenêtre d’exécution exacte)`);
      continue;
    }
    const buys = (stg.orders || []).filter((o) => String(o.side || '').toUpperCase() === 'BUY');
    let kept = 0, dropped = 0;
    for (let i = 0; i < buys.length; i++) {
      const o = buys[i];
      const s = orderToSignal(o, modeId, i);
      if (s) { pool.push(s); kept++; }
      else { dropped++; console.log(`  ⚠️  [${modeId}] ordre skippé (niveaux inexploitables): ${o.symbol} entry:${o.entry ?? o.limitPrice ?? '—'} stop:${o.stopLoss ?? '—'}`); }
    }
    ingested.push(`${modeId}←${portfolioId} (${kept} ordre${kept > 1 ? 's' : ''}${dropped ? `, ${dropped} skippé(s)` : ''})`);
  }

  const data = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  data.dtx_pool = pool; // remplacement idempotent — le pool du jour reflète LE staging du jour
  if (!opts.dryRun) {
    // Écriture ATOMIQUE (tmp + rename). Depuis que le calcul du downstream tourne en
    // parallèle du panel adversarial, des relecteurs lisent signals.json PENDANT que ce
    // pont le réécrit. Un writeFileSync direct tronque le fichier puis le remplit : une
    // lecture tombant dans cette fenêtre récupère du JSON incomplet et fait échouer un
    // relecteur sur un défaut qui n'existe pas. rename() est atomique sur POSIX — un
    // lecteur voit l'ancien fichier entier ou le nouveau entier, jamais un état moyen.
    const tmp = `${sigPath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, sigPath);
  }

  console.log(`dtx-pool-bridge — scan ${opts.folder} (séance ${opts.date})${opts.dryRun ? ' [DRY-RUN]' : ''}`);
  console.log(`  ✅ ingérés : ${ingested.length ? ingested.join(' · ') : '—'}`);
  if (withheld.length) {
    console.log(`  🛡️  exclus volontairement du tracker synthétique : ${withheld.join(' · ')}`);
  }
  if (skipped.length) {
    console.log(`  ❗ SKIPPÉS (pas de candidats ce soir pour ces modes — dégradation honnête, jamais fabriquée) :`);
    for (const s of skipped) console.log(`     - ${s}`);
  }
  console.log(`  → ${pool.length} signaux dtx_pool écrits dans ${path.relative(ROOT, sigPath)}`);
  process.exit(skipped.length ? 3 : 0);
}

if (require.main === module) main();

module.exports = { scriptedModes, orderToSignal, main };
