// Enrichissement complémentaire du vivier scanner 20260908.
//
// POURQUOI CE FICHIER EXISTE : `scanner/20260908/_data/vars.json` a été figé à 36 tickers
// alors que rejouer `tools/extract-universe.js` sur le MÊME dossier `_data` en rend 60.
// vars.json avait été produit AVANT l'arrivée de autoscreen_etf.json et des fichiers
// breakout/pullback recollectés : 24 candidats certifiés n'ont donc jamais été enrichis
// par la vague 2 — dont tous les ETF, CVX, et l'intégralité du vivier Pullback.
//
// PROVENANCE (MCP marketdata, build a51481d9, clôture de référence 2026-09-04) :
//   technicals lot 1   trace-81133c27-0f91-4bc3-a87a-6c7a93581a3d   (CVX GFL MTDR CRBG NTR)
//   technicals lot 2   trace-f3f56699-9fa7-444f-a95f-ca6e0df423b4   (ETF)
//   technicals lot 3   trace-f7cb9b9c-5191-4e80-8721-3f52676fd928   (vivier Pullback)
//   barres lot 1       trace-e458eb5c-bb67-4266-aa4c-d51ad531e46a   (130 j, completed_only)
//   barres lot 2       trace-2865dd49-f102-4674-8f04-887a5fec1dbe   (70 j, completed_only)
//   calendrier         trace-2fd53799-160b-4991-b349-150763c7e9a8 / trace-113f6f99…
//
// AUTOCONTRÔLE — CE QUI A CHANGÉ LE 2026-09-06.
// La version précédente recalculait ATR14 et RSI14 depuis les barres recopiées et les
// comparait au serveur. La revue dev a montré par bissection que ce contrôle est AVEUGLE
// au chiffre le plus dangereux : le close de la dernière barre n'entre pas dans son propre
// True Range (le TR utilise haut/bas courants et le close PRÉCÉDENT) — poids exactement
// zéro dans l'ATR — et ne pèse que 1/14 dans le RSI de Wilder. Résultat mesuré : NTR
// pouvait être recopié à 89,47 au lieu de 79,47 (+14,3%) en passant le contrôle. Or c'est
// ce nombre qui devient price, entry, stop et target. Le volume, lui, n'était jamais
// examiné du tout.
//
// Le contrôle porte donc désormais, en plus :
//   · close de la dernière barre CONTRE `last_price` des screeners de vague 1 — un artefact
//     certifié, déjà sur disque, collecté par une autre voie. Tolérance 0,01 (le centime).
//   · ATR resserré de 25% à 6% (déviation réelle observée ≤ 4,1% sur 28 barres).
//   · cohérence interne de chaque barre : low ≤ min(open,close) ≤ max(open,close) ≤ high,
//     volume fini et positif, dates strictement croissantes.
//   · dernière barre datée exactement de la clôture de référence.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REF = '2026-09-04';
const OUT = path.join(ROOT, 'scanner/20260908/_data2/supp_enrich.json');

// technicals rendus par le serveur (référence de contrôle)
const SERVER = {
  CVX:  { atr: 3.980649303805563,  rsi: 64.19851093360668,  macd: 5.082061109210542,   signal: 4.831402583750474,   ema20: 202.82656436647287, ema50: 195.3165266817683,  ema200: 180.07460950278585 },
  GFL:  { atr: 1.206062796662098,  rsi: 63.871751229208776, macd: 0.737969689285741,   signal: 0.5937317434345342,  ema20: 41.79634562798167,  ema50: 40.59249700680135,  ema200: 41.42094889833342 },
  MTDR: { atr: 1.7693285033590702, rsi: 63.86949216753786,  macd: 1.9168734379352728,  signal: 1.6629045327283705,  ema20: 56.44499950311196,  ema50: 54.5557448940427,   ema200: 51.87085887276786 },
  CRBG: { atr: 0.862958828830467,  rsi: 63.40822074708095,  macd: 0.4771076926515221,  signal: 0.36725321477506007, ema20: 32.94306650171078,  ema50: 31.804957711171124, ema200: 30.48473339813861 },
  NTR:  { atr: 2.1642730963743406, rsi: 70.97664800017147,  macd: 3.040843865450057,   signal: 2.244256292945341,   ema20: 73.96217533631473,  ema50: 70.8372124875276,   ema200: 67.08492506240681 },
  ILF:  { atr: 0.6285617496881747, rsi: 64.37398402421923,  macd: 0.41267891245218635, signal: 0.19786647662729892, ema20: 34.97084040845489,  ema50: 34.681220272926105, ema200: 33.17015744510611 },
  BNO:  { atr: 1.6467662031973613,  rsi: 66.12156031788078,  macd: 1.7355148563398188,  signal: 1.3802739325524087,  ema20: 52.55579071141506,  ema50: 50.46175045969409,  ema200: 43.67700262309226 },
  IBIT: { atr: 1.3224289215182985,  rsi: 67.33241875928141,  macd: 2.2613679726379914,  signal: 1.9586081050701245,  ema20: 42.1115155038498,   ema50: 39.817307542049974, ema200: 44.95078008310336 },
  PDBC: { atr: 0.27140671499870855, rsi: 67.86108293717726, macd: 0.4192259793380124,  signal: 0.374051490225316,   ema20: 18.39601097824633,  ema50: 17.845173884977847, ema200: 16.29956517320768 },
  AMZN: { atr: 6.6920181732362405, rsi: 49.54913376625234,  macd: 0.3392167271848052,  signal: 1.5186554060217599,  ema20: 259.59849678789055, ema50: 256.2536006859251,  ema200: 244.12713907946812 },
  XOM:  { atr: 3.400623456496789,  rsi: 50.99232402166115,  macd: 1.960863029309877,   signal: 2.5150653338070885,  ema20: 160.09339176608552, ema50: 155.88041211024643, ema200: 142.25103485449037 },
  KO:   { atr: 1.4609382264778028, rsi: 50.211461909266724, macd: 0.744619953580127,   signal: 1.1600168235010644,  ema20: 88.51294582680806,  ema50: 86.33301063036846,  ema200: 79.19960220487101 },
  DIS:  { atr: 2.2763694343348813, rsi: 50.46455716131571,  macd: 1.6359656435231216,  signal: 2.1060679708891485,  ema20: 105.97812527254003, ema50: 103.4160571182844,  ema200: 105.32884470263906 },
  PCAR: { atr: 2.903812366804598,  rsi: 42.791509932888836, macd: -1.3436138697433222, signal: -0.5477660656068517, ema20: 127.00188165278288, ema50: 126.39011991899588, ema200: 117.6446900546823 },
};

// calendrier certifié — aucune publication dans la fenêtre ±3 j autour du 2026-09-08
const NEXT_EARNINGS = {
  CVX: '2026-10-30', GFL: '2026-11-04', MTDR: '2026-10-27', CRBG: '2026-11-02', NTR: '2026-11-04',
  AMZN: null, XOM: null, KO: null, DIS: null, PCAR: null, // renseignés par la salve calendrier finale
  ILF: null, PDBC: null, BNO: null, IBIT: null,                                   // ETF : pas de résultats d'émetteur
};

const BARS = require('./_supp-enrich-20260908.bars.js');

// --- recalculs de contrôle -------------------------------------------------
function atr14(b) {
  const tr = [];
  for (let i = 1; i < b.length; i++) {
    const [, , h, l] = b[i], pc = b[i - 1][4];
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (tr.length < 14) return null;
  let a = tr.slice(0, 14).reduce((s, x) => s + x, 0) / 14;
  for (let i = 14; i < tr.length; i++) a = (a * 13 + tr[i]) / 14;
  return a;
}
function rsi14(b) {
  const ch = [];
  for (let i = 1; i < b.length; i++) ch.push(b[i][4] - b[i - 1][4]);
  if (ch.length < 14) return null;
  let g = 0, l = 0;
  for (let i = 0; i < 14; i++) { if (ch[i] > 0) g += ch[i]; else l -= ch[i]; }
  g /= 14; l /= 14;
  for (let i = 14; i < ch.length; i++) {
    const u = ch[i] > 0 ? ch[i] : 0, d = ch[i] < 0 ? -ch[i] : 0;
    g = (g * 13 + u) / 14; l = (l * 13 + d) / 14;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}

// --- ancre indépendante : le last_price des screeners certifiés -------------
const SCREEN_PRICE = {};
for (const f of ['screen_momentum_us', 'screen_breakout_us', 'screen_pullback_us', 'autoscreen_etf']) {
  const p = path.join(ROOT, 'scanner/20260908/_data', `${f}.json`);
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const c of (j.data?.items || []).flatMap(i => i.candidates || [])) {
    const px = c.last_price ?? c.entry_price;
    if (px != null && SCREEN_PRICE[c.symbol] == null) SCREEN_PRICE[c.symbol] = px;
  }
}

const out = { _generated_for: 'scanner/20260908', reference_close: REF, generated_by: 'tools/_supp-enrich-20260908.js', symbols: {}, checks: [], upstream_rounding_anomalies: [] };
let hardFail = 0;
const fail = (sym, msg) => { console.error(`  ✗ ${sym}: ${msg}`); hardFail++; };

for (const [sym, bars] of Object.entries(BARS)) {
  const s = SERVER[sym];
  if (!s) { fail(sym, 'aucun technicals serveur'); continue; }
  if (bars.length < 40) { fail(sym, `${bars.length} barres < 40 (fenêtre pivot non comparable entre voies d ingestion)`); continue; }

  // Cohérence interne et ordre des barres.
  // EPS : la source amont (yahoo) publie parfois un close 0,0001 au-dessus de son propre
  // haut — artefact d'arrondi, pas une erreur de recopie. Constaté sur PDBC 2026-08-11
  // (o=17,76 h=17,9099 l=17,7299 c=17,91). Une tolérance au dixième de centime laisse
  // passer l'arrondi tout en attrapant une inversion réelle de champs, qui se compte en
  // unités de prix. L'anomalie est signalée sans bloquer.
  const EPS = 0.001;
  let prev = '';
  for (const [d, o, h, l, c, v] of bars) {
    if (!(d > prev)) { fail(sym, `dates non strictement croissantes autour de ${d}`); break; }
    prev = d;
    const lo = Math.min(o, c), hi = Math.max(o, c);
    if (lo < l - EPS || hi > h + EPS) { fail(sym, `barre ${d} incohérente (o=${o} h=${h} l=${l} c=${c})`); break; }
    if (lo < l || hi > h) out.upstream_rounding_anomalies.push({ symbol: sym, date: d, open: o, high: h, low: l, close: c });
    if (!Number.isFinite(v) || v < 0) { fail(sym, `barre ${d} volume invalide (${v})`); break; }
  }

  const last = bars[bars.length - 1];
  if (last[0] !== REF) { fail(sym, `dernière barre ${last[0]} ≠ ${REF}`); continue; }

  const close = last[4];
  // ANCRE INDÉPENDANTE — le close recopié doit retomber au centime sur le last_price
  // d'un screener certifié, collecté par une autre voie et déjà sur disque.
  const anchor = SCREEN_PRICE[sym];
  if (anchor == null) { fail(sym, 'aucun last_price de screener pour ancrer le close — transcription invérifiable'); continue; }
  const closeDev = Math.abs(close - anchor);
  if (closeDev > 0.01) { fail(sym, `close recopié ${close} vs screener ${anchor} (écart ${closeDev.toFixed(4)} > 0,01)`); continue; }

  const myAtr = atr14(bars), myRsi = rsi14(bars);
  const atrDev = Math.abs(myAtr - s.atr) / s.atr * 100;
  const rsiDev = Math.abs(myRsi - s.rsi);
  const okAtr = atrDev < 6, okRsi = rsiDev < 8;
  if (!okAtr) fail(sym, `ATR recalculé ${myAtr.toFixed(4)} vs serveur ${s.atr.toFixed(4)} (${atrDev.toFixed(1)}% > 6%)`);
  if (!okRsi) fail(sym, `RSI recalculé ${myRsi.toFixed(2)} vs serveur ${s.rsi.toFixed(2)} (${rsiDev.toFixed(2)} pts > 8)`);

  out.checks.push({ symbol: sym, bars: bars.length,
    close, close_anchor: anchor, close_dev: +closeDev.toFixed(4),
    atr_server: +s.atr.toFixed(4), atr_recomputed: +myAtr.toFixed(4), atr_dev_pct: +atrDev.toFixed(1),
    rsi_server: +s.rsi.toFixed(2), rsi_recomputed: +myRsi.toFixed(2), rsi_dev_pts: +rsiDev.toFixed(2),
    pass: okAtr && okRsi });

  const w20 = bars.slice(-20);
  const adv20 = w20.reduce((a, x) => a + x[4] * x[5], 0) / 20;
  const consol = bars.slice(-16, -1).filter(x => (x[2] - x[3]) < 1.5 * s.atr).length;

  out.symbols[sym] = {
    close, reference_close: REF,
    atr: s.atr, atr_pct: +(s.atr / close * 100).toFixed(3),
    rsi: s.rsi, macd: s.macd, macd_signal: s.signal,
    ema20: s.ema20, ema50: s.ema50, ema200: s.ema200,
    dist_ema50_pct: +((close / s.ema50 - 1) * 100).toFixed(2),
    dist_ema200_pct: +((close / s.ema200 - 1) * 100).toFixed(2),
    adv20_usd: Math.round(adv20),
    consolidation_bars: consol,
    next_earnings: NEXT_EARNINGS[sym] ?? null,
    bars: bars,   // série COMPLÈTE : la fenêtre pivot doit être la même que pour la vague 2
  };
}

console.log('contrôle de transcription :');
for (const c of out.checks) {
  console.log(`  ${c.symbol.padEnd(5)} ${String(c.bars).padStart(3)} barres  close ${String(c.close).padStart(8)} vs screener ${String(c.close_anchor).padStart(8)} (Δ${c.close_dev})   ATR ${c.atr_dev_pct}%   RSI ${c.rsi_dev_pts} pts  ${c.pass ? 'OK' : '*** ÉCHEC ***'}`);
}
if (hardFail) { console.error(`\n${hardFail} contrôle(s) en échec — rien n'est écrit.`); process.exit(1); }

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
if(out.upstream_rounding_anomalies.length) console.log(`\n${out.upstream_rounding_anomalies.length} anomalie(s) d arrondi amont tolérée(s) : `+out.upstream_rounding_anomalies.map(a=>`${a.symbol} ${a.date}`).join(", "));
console.log(`\n${Object.keys(out.symbols).length} symboles enrichis → ${path.relative(ROOT, OUT)}`);
for (const [s, v] of Object.entries(out.symbols)) {
  console.log(`  ${s.padEnd(5)} ${String(v.close).padStart(8)}  ATR ${String(v.atr_pct).padStart(5)}%  RSI ${v.rsi.toFixed(0).padStart(3)}  MM50 ${(v.dist_ema50_pct >= 0 ? '+' : '') + v.dist_ema50_pct}%  ADV ${(v.adv20_usd / 1e6).toFixed(0).padStart(5)} M$  consol ${v.consolidation_bars}/15`);
}
