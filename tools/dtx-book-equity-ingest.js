#!/usr/bin/env node
'use strict';
/**
 * dtx-book-equity-ingest.js — publie la courbe d'equity DU LIVRE, après l'avoir VÉRIFIÉE.
 *
 * POURQUOI (R6, fermé le 2026-08-12). `portfolio/v1/best/equity.json` publiait les statistiques
 * SERVIES du livre à côté d'une courbe qui n'était pas la sienne : celle du replay de la poche
 * porteuse, sous-échantillonnée aux dates de rebalancement. Un consommateur qui recalculait le
 * drawdown dessus obtenait 17,49 % au lieu de 27,2 %. L'écart était déclaré dans un
 * `curve_warning` — un pansement : un fichier qui publie une courbe ET des statistiques qui ne s'en
 * déduisent pas invite à l'erreur, quel que soit l'avertissement. Le moteur sert désormais la vraie
 * courbe (`DtxBookEquity`, systematic-tss v1.34.1).
 *
 * CE SCRIPT NE CROIT PAS L'ANNONCE, IL LA VÉRIFIE. Avant d'écrire quoi que ce soit, il recalcule
 * CAGR et max drawdown DEPUIS `equity_values` et les compare aux valeurs servies. Au-delà de la
 * tolérance (±0,05 pt), il REFUSE d'écrire et sort en 1 : une courbe qui ne reproduit pas ses
 * propres statistiques est exactement le défaut qu'on vient de corriger, et elle ne doit pas
 * remplacer le précédent défaut par un nouveau.
 *
 * Convention de CAGR imposée par le moteur (et non devinée) : le dénominateur est
 * `committed_capital` (155 000 sur best — les pourcentages des poches somment à 155), pas
 * `initial_capital`. Le script lit le champ et applique la formule du moteur.
 *
 * ACCÈS. Un subprocess node ne peut pas parler au MCP OAuth2 ; on utilise un jeton LECTURE SEULE
 * éphémère, minté par l'agent via `DtxMintReadOnlyToken` et passé par l'ENVIRONNEMENT — jamais
 * écrit sur disque, jamais commité (règle « ZÉRO TOKEN EN .env »).
 *
 * Usage :
 *   DTX_RO_TOKEN=<jeton> node tools/dtx-book-equity-ingest.js --portfolio best [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const ENDPOINT = 'https://systematic.dailytickers.com/mcp';
const TOL = 0.05; // point de pourcentage

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const PORTFOLIO = flag('portfolio') || 'best';
const DRY = argv.includes('--dry-run');
const TOKEN = process.env.DTX_RO_TOKEN;

function rpc(tool, args) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } });
  return new Promise((resolve, reject) => {
    const u = new URL(ENDPOINT);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'authorization': `Bearer ${TOKEN}`,
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        // Le serveur peut répondre en SSE : on récupère la dernière ligne `data:`.
        let payload = raw.trim();
        if (payload.startsWith('event:') || payload.includes('\ndata:')) {
          const lines = payload.split('\n').filter((l) => l.startsWith('data:'));
          payload = lines.length ? lines[lines.length - 1].slice(5).trim() : payload;
        }
        try {
          const j = JSON.parse(payload);
          if (j.error) return reject(new Error(`${tool}: ${JSON.stringify(j.error)}`));
          const c = j.result && j.result.content && j.result.content[0];
          resolve(c && c.text ? JSON.parse(c.text) : j.result);
        } catch (e) { reject(new Error(`${tool}: réponse illisible (${res.statusCode}) — ${payload.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** Max drawdown en % (pic à creux), sur la série telle quelle. */
function maxDrawdownPct(values) {
  let peak = -Infinity, worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak * 100;
    if (dd > worst) worst = dd;
  }
  return worst;
}

// CONVENTION D'ANNUALISATION — identifiée, pas devinée (2026-08-12).
// La courbe est une série de SÉANCES, pas de jours calendaires : le moteur annualise sur
// 252 séances. Départage mesuré sur best (1 405 points, 2 044 jours calendaires, CAGR servi 72,03) :
//
//   n/252        → 72,0334   écart 0,0034 pt   ← retenu
//   (n-1)/252    → 72,0999   écart 0,0699
//   jours/365,25 → 71,6873   écart 0,3427
//   jours/365    → 71,6238   écart 0,4062
//
// Le candidat retenu est 20× plus proche que le suivant : il n'y a pas d'ambiguïté. On le FIGE
// plutôt que de tester des variantes jusqu'à ce que l'une passe — un contrôle qui s'ajuste à son
// résultat ne contrôle plus rien.
const TRADING_DAYS_PER_YEAR = 252;

/** CAGR % selon la convention DU MOTEUR : (final / committed)^(1/années) - 1, années = n/252. */
function cagrPct(values, committed) {
  const final = values[values.length - 1];
  const years = values.length / TRADING_DAYS_PER_YEAR;
  if (!(years > 0) || !(committed > 0)) return null;
  return (Math.pow(final / committed, 1 / years) - 1) * 100;
}

async function main() {
  if (!TOKEN) {
    console.error('❌ DTX_RO_TOKEN absent. Minter un jeton readonly (DtxMintReadOnlyToken) et le passer par l\'environnement.');
    console.error('   Il ne doit être ni écrit sur disque ni commité.');
    process.exit(2);
  }

  const raw = await rpc('DtxBookEquity', { portfolio: PORTFOLIO });
  const book = raw[PORTFOLIO];
  if (!book || !Array.isArray(book.equity_values) || !book.equity_values.length) {
    console.error(`❌ DtxBookEquity n'a pas rendu de courbe pour "${PORTFOLIO}".`);
    process.exit(1);
  }
  const dates = book.equity_dates, values = book.equity_values;
  if (dates.length !== values.length) {
    console.error(`❌ courbe incohérente : ${dates.length} dates pour ${values.length} valeurs.`);
    process.exit(1);
  }

  // ── VÉRIFICATION — c'est le cœur de ce script ────────────────────────────────
  const ddCalc = maxDrawdownPct(values);
  const ddServed = Number(book.max_dd_pct);
  const cagrServed = Number(book.cagr_pct);
  const committed = Number(book.committed_capital) || Number(book.initial_capital);
  const cagrCalc = cagrPct(values, committed);
  const cagrErr = cagrCalc == null ? Infinity : Math.abs(cagrCalc - cagrServed);

  console.log(`Vérification de la courbe servie — ${PORTFOLIO} (moteur ${(raw._meta || {}).engine || '?'}, mesurée le ${book.measured_at})`);
  console.log(`  points            : ${values.length} (${dates[0]} → ${dates[dates.length - 1]}), résolution ${book.resolution}`);
  console.log(`  capital engagé    : ${committed}`);
  console.log(`  max drawdown      : servi ${ddServed} | recalculé ${ddCalc.toFixed(4)} | écart ${Math.abs(ddCalc - ddServed).toFixed(4)} pt`);
  console.log(`  CAGR              : servi ${cagrServed} | recalculé ${cagrCalc == null ? 'n/a' : cagrCalc.toFixed(4)} (n/${TRADING_DAYS_PER_YEAR}) | écart ${cagrErr.toFixed(4)} pt`);

  const ddOk = Math.abs(ddCalc - ddServed) <= TOL;
  const cagrOk = cagrErr <= TOL;
  if (!ddOk || !cagrOk) {
    console.error(`\n⛔ REFUS D'ÉCRIRE — la courbe ne reproduit pas ses propres statistiques (tolérance ${TOL} pt).`);
    console.error('   Publier une courbe qui ne se recoupe pas avec ses chiffres remplacerait un défaut par un autre.');
    process.exit(1);
  }
  console.log(`  ✅ critère d'acceptation satisfait (±${TOL} pt sur les deux).`);

  // Statistiques du MÊME millésime, pour que courbe et chiffres viennent du même run.
  const statsAll = await rpc('DtxStats', { portfolio: PORTFOLIO });
  const row = (statsAll && (statsAll[PORTFOLIO] || (statsAll.stats && statsAll.stats[PORTFOLIO]))) || null;

  const stagingPath = path.join(ROOT, 'data', 'dtx', `${PORTFOLIO}.json`);
  if (!fs.existsSync(stagingPath)) { console.error(`❌ staging ${stagingPath} absent.`); process.exit(1); }
  const staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
  const prev = staging.metrics || {};

  const metrics = {
    ...prev,
    cagr_pct: cagrServed,
    max_dd_pct: ddServed,
    sharpe: book.sharpe ?? prev.sharpe ?? null,
    ...(row ? {
      total_trades: row.trades ?? prev.total_trades ?? null,
      win_rate: row.win_rate ?? prev.win_rate ?? null,
      r2: row.r2 ?? prev.r2 ?? null,
      dd_p95_bootstrap21_pct: row.dd_p95_boot ?? prev.dd_p95_bootstrap21_pct ?? null,
      avg_exposure_pct: row.avg_exposure ?? prev.avg_exposure_pct ?? null,
    } : {}),
    from: dates[0],
    to: dates[dates.length - 1],
    initial_capital: Number(book.initial_capital) || prev.initial_capital || null,
    committed_capital: committed,
    // Publié pour qu'un consommateur puisse REFAIRE le calcul et retomber sur les mêmes chiffres,
    // au lieu de deviner la convention (jours calendaires → 71,69 au lieu de 72,03).
    trading_days_per_year: TRADING_DAYS_PER_YEAR,
    source: 'statistiques servies du livre (walk interleave, coûts inclus, univers figé) — courbe et chiffres du MÊME run',
    note: `Vérifié à l'ingestion : recalcul depuis equity_values reproduit CAGR ${cagrServed} et MaxDD ${ddServed} (±${TOL} pt). CAGR au dénominateur committed_capital=${committed}, annualisé sur ${TRADING_DAYS_PER_YEAR} séances (n/${TRADING_DAYS_PER_YEAR}) — convention du moteur, identifiée par départage.`,
    measured_at: book.measured_at || null,
    engine_version: (raw._meta || {}).engine || null,
    basis: book.basis || null,
  };

  staging.metrics = metrics;
  staging.metricsSource = 'book_served_stats';
  staging.equity = { dates, values };
  staging.equityResolution = book.resolution || 'daily';
  staging.equitySource = 'DtxBookEquity (courbe du livre, vérifiée à l\'ingestion)';
  staging.equityVerifiedAt = new Date().toISOString();

  if (DRY) { console.log('\n[DRY-RUN] rien écrit.'); return; }
  fs.writeFileSync(stagingPath, JSON.stringify(staging, null, 2), 'utf8');
  console.log(`\n→ ${path.relative(ROOT, stagingPath)} : courbe ${values.length} points + métriques du même millésime.`);
  if (prev.cagr_pct != null && prev.cagr_pct !== cagrServed) {
    console.log(`   ⚠️  millésime de statistiques : CAGR ${prev.cagr_pct} → ${cagrServed}, MaxDD ${prev.max_dd_pct} → ${ddServed}`);
  }
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
