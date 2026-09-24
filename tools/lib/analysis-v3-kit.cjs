'use strict';
// Outils partagés des générateurs de dossiers d'analyse v3 (refonte de la chaîne IA, 2026-09-24).
// Chaque dossier garde son générateur propre (faits, texte, provenance) ; ce module ne porte que la
// mécanique déterministe commune : lecture des artefacts collectés, indicateurs recalculés sur les
// barres certifiées, métriques des comparables, preuves et rendu d'aperçu. Aucun chiffre n'y est saisi.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = p => fs.readFileSync(path.join(root, p));
const read = p => JSON.parse(bytes(p));
const write = (p, v) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), JSON.stringify(v, null, 2) + '\n'); };
const esc = v => String(v).replace(/~/g, '~0').replace(/\//g, '~1');
const get = (o, p) => p.split('.').reduce((v, k) => v?.[k], o);
const fr = (n, d = 2) => (n < 0 ? '−' : '') + Math.abs(n).toFixed(d).replace('.', ',');
const usd = (n, d = 2) => fr(n, d) + ' $';
const pct = (a, b) => 100 * (a / b - 1);
const sgn = (n, d = 2) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d).replace('.', ',') + ' %';
const mean = a => a.reduce((n, x) => n + x, 0) / a.length;

// Chemin JSON-pointer du premier objet portant `type`.
function findPath(o, type, p = '') {
  if (o && typeof o === 'object') {
    if (o.type === type) return p;
    for (const [k, v] of Object.entries(o)) { const r = findPath(v, type, p + '/' + esc(k)); if (r !== undefined) return r; }
  }
}
const at = (o, ptr) => ptr === '' ? o : ptr.slice(1).split('/').reduce((v, k) => v?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], o);

function loadRun(dataDir, names) {
  const raw = {};
  for (const n of names) raw[n] = read(`${dataDir}/${n}.json`);
  return raw;
}

// Série principale : 300 séances certifiées, dernière = clôture de référence.
function mainSeries(rawBars, ticker, ref, minBars = 250) {
  const series = rawBars.results[0].data[0];
  if (series.symbol !== ticker || series.served_completed_end !== ref || series.bars.length < minBars) throw Error(`${ticker} : série certifiée au ${ref} requise`);
  const bars = series.bars, N = bars.length - 1, B = '/results/0/data/0/bars';
  const idx = d => { const i = bars.findIndex(b => b[0] === d); if (i < 0) throw Error('séance absente ' + d); return i; };
  return { series, bars, N, B, idx, close: bars[N][4], prev: bars[N - 1][4], source: series.source };
}

// Indicateurs recalculés : EMA amorcée par une moyenne simple, MACD 12/26 signal 9, RSI et ATR de
// Wilder sur 14 séances. Même convention que le dossier MTDR du 2026-09-24.
function ema(values, n) {
  const k = 2 / (n + 1); let e = mean(values.slice(0, n)); const out = new Array(n - 1).fill(null); out.push(e);
  for (let i = n; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}
function technicals(bars) {
  const c = bars.map(b => b[4]);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const macdLine = c.map((_, i) => (e12[i] == null || e26[i] == null) ? null : e12[i] - e26[i]).filter(x => x != null);
  const sig = ema(macdLine, 9);
  let gain = 0, loss = 0;
  for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
  gain /= 14; loss /= 14;
  for (let i = 15; i < c.length; i++) { const d = c[i] - c[i - 1]; gain = (gain * 13 + Math.max(d, 0)) / 14; loss = (loss * 13 + Math.max(-d, 0)) / 14; }
  const tr = bars.map((b, i) => i === 0 ? b[2] - b[3] : Math.max(b[2] - b[3], Math.abs(b[2] - bars[i - 1][4]), Math.abs(b[3] - bars[i - 1][4])));
  let atr = mean(tr.slice(1, 15));
  for (let i = 15; i < tr.length; i++) atr = (atr * 13 + tr[i]) / 14;
  const last = a => a[a.length - 1];
  return { ema20: last(ema(c, 20)), ema50: last(ema(c, 50)), ema200: last(ema(c, 200)), rsi14: 100 - 100 / (1 + gain / loss),
    macd: last(macdLine), macdSignal: last(sig), atr14: atr, convention: 'EMA amorcée par une moyenne simple ; MACD 12/26, signal 9 ; RSI et ATR de Wilder sur 14 séances ; barres certifiées' };
}

// Comparables : rendements log communs, corrélation, bêta du titre sur le comparable, R².
function comparables(cmpRows, bars) {
  const byDate = new Map(bars.map(b => [b[0], b])), M = {};
  for (const item of cmpRows) {
    const common = item.bars.filter(b => byDate.has(b[0])), x = [], y = [];
    for (let i = 1; i < common.length; i++) { x.push(Math.log(common[i][4] / common[i - 1][4])); y.push(Math.log(byDate.get(common[i][0])[4] / byDate.get(common[i - 1][0])[4])); }
    const mx = mean(x), my = mean(y); let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < x.length; i++) { xy += (x[i] - mx) * (y[i] - my); xx += (x[i] - mx) ** 2; yy += (y[i] - my) ** 2; }
    const corr = xy / Math.sqrt(xx * yy), cb = item.bars;
    M[item.symbol] = { correlation: +corr.toFixed(4), beta: +(xy / xx).toFixed(4), r2: +(corr * corr).toFixed(4), observations: x.length,
      return5d: +pct(cb.at(-1)[4], cb.at(-6)[4]).toFixed(2), return21d: +pct(cb.at(-1)[4], cb.at(-22)[4]).toFixed(2) };
  }
  const firstCommon = cmpRows[0].bars.find(b => byDate.has(b[0]))[0];
  return { M, firstCommon };
}

// Médiane du volume en dollars (close × volume) sur n séances.
function dollarAdv(bars, n = 20) {
  const v = bars.slice(-n).map(b => b[4] * b[5]).sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

// Préparation des preuves : chaque nombre (ou chaîne portant un chiffre) doit recevoir une provenance.
function writeEvidence({ ticker, ref, outJson, outEvidence, calcPath, generator, a, inputs, sourceFor, score, valuation, extra = {} }) {
  write(outJson, a);
  const inp = n => { const x = inputs.find(i => i.name === n); if (!x) throw Error('intrant inconnu ' + n); return x; };
  const claims = {}, strings = {}, methods = {};
  (function scan(v, p = '') {
    if (typeof v === 'number' || (typeof v === 'string' && /\d/.test(v))) {
      const pr = sourceFor(p);
      if (!pr) throw Error('provenance manquante ' + p);
      claims[p] = pr; methods[p] = pr.method; if (typeof v === 'string') strings[p] = v;
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, p ? p + '.' + k : k);
  })(a);
  const calc = { kind: 'deterministic_analysis_calculation_v1', ticker, reference_close: ref, analysis_sha256: sha(bytes(outJson)), generator_path: generator, generator_sha256: sha(bytes(generator)),
    kit_path: 'tools/lib/analysis-v3-kit.cjs', kit_sha256: sha(bytes('tools/lib/analysis-v3-kit.cjs')), inputs, score_components: score, valuation_scenario: valuation,
    values: a, string_numeric_claims: strings, claim_provenance: claims, methods, ...extra };
  write(calcPath, calc);
  const calcHash = sha(bytes(calcPath));
  write(outEvidence, { ticker, reference_close: ref, analysis_path: outJson, analysis_sha256: sha(bytes(outJson)),
    claims: Object.keys(claims).map(p => ({ path: p, value: get(a, p), as_of: ref, source_artifact: calcPath, source_sha256: calcHash,
      source_pointer: typeof get(a, p) === 'number' ? '/values/' + p.split('.').map(esc).join('/') : '/string_numeric_claims/' + esc(p) })) });
  return { claims: Object.keys(claims).length, inp };
}

// Constructeurs de provenance, liés à la liste d'intrants déclarée.
function provenance(inputs) {
  const inp = n => { const x = inputs.find(i => i.name === n); if (!x) throw Error('intrant inconnu ' + n); return x; };
  const dep = (n, p) => ({ input_path: inp(n).path, input_sha256: inp(n).sha256, source_pointer: p });
  const prov = (n, p, method, extra = []) => ({ ...dep(n, p), input_name: n, method, ...(extra.length ? { additional_inputs: extra } : {}) });
  return { dep, prov };
}
function input(name, p, kind) { return { name, path: p, sha256: sha(bytes(p)), ...(kind ? { kind } : {}) }; }

function renderPreview(a, out) {
  const { render } = require(path.join(root, 'tools/render-analysis.js'));
  fs.mkdirSync(path.dirname(path.join(root, out)), { recursive: true });
  fs.writeFileSync(path.join(root, out), render(a));
}


// Dates en toutes lettres pour la prose : « 18 septembre », ou « 18 septembre 2026 » si year.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const frDate = (d, year = false) => { const [y, m, j] = d.split('-'); return (+j === 1 ? '1er' : String(+j)) + ' ' + MOIS[+m - 1] + (year ? ' ' + y : ''); };

// Exécutabilité d'une entrée « clôture au-dessus du déclencheur, achat à l'ouverture suivante sous le
// plafond ». gap : part des séances ouvrant plus haut que la clôture précédente d'au moins le tampon
// (toute la série et soixante dernières séances). Historique : chaque clôture au-dessus du plus haut de
// la veille est traitée comme une activation, avec un tampon exprimé dans le même nombre d'ATR (ATR
// simple sur quatorze séances) ; l'entrée n'est possible que si la clôture reste dans le tampon et que
// l'ouverture suivante reste sous le plafond.
function execStats(bars, entry, cap, atr) {
  const buf = cap - entry, k = buf / atr;
  const gap = n => { let c = 0; for (let i = bars.length - n; i < bars.length; i++) if (bars[i][1] - bars[i - 1][4] > buf) c++; return 100 * c / n; };
  const tr = bars.map((x, i) => i ? Math.max(x[2] - x[3], Math.abs(x[2] - bars[i - 1][4]), Math.abs(x[3] - bars[i - 1][4])) : x[2] - x[3]);
  let breakouts = 0, closeAbove = 0, openAbove = 0, exec = 0;
  for (let i = 20; i < bars.length - 1; i++) {
    const lvl = bars[i - 1][2]; if (bars[i][4] <= lvl) continue;
    breakouts++; const c = lvl + k * mean(tr.slice(i - 14, i));
    if (bars[i][4] > c) { closeAbove++; continue; }
    if (bars[i + 1][1] < c) exec++; else openAbove++;
  }
  // Variante à tampon fixe en dollars, sur toute la série (dernière séance exclue faute d'ouverture suivante).
  let fixedBreakouts = 0, fixedExec = 0;
  for (let i = 1; i < bars.length - 1; i++) { const lvl = bars[i - 1][2]; if (bars[i][4] <= lvl) continue; fixedBreakouts++; if (bars[i][4] <= lvl + buf && bars[i + 1][1] < lvl + buf) fixedExec++; }
  return { buf, bufAtr: k, gapAll: gap(bars.length - 1), gap60: gap(60), breakouts, closeAbove, openAbove, exec, execPct: 100 * exec / breakouts, fixedBreakouts, fixedExec,
    method: 'Activations historiques = clôtures au-dessus du plus haut de la veille ; tampon = même nombre d’ATR (moyenne simple des vrais écarts sur quatorze séances) ; entrée possible si la clôture reste dans le tampon et si l’ouverture suivante reste sous le plafond.' };
}

const evidenceUrl = t => `https://articles.dailytickers.com/data/analyses-evidence/${t}.json`;

module.exports = { root, sha, bytes, read, write, esc, get, fr, usd, pct, sgn, mean, findPath, at, loadRun, mainSeries, technicals, comparables, dollarAdv,
  writeEvidence, provenance, input, renderPreview, evidenceUrl, frDate, execStats };
