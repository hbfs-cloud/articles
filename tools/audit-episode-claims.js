#!/usr/bin/env node
'use strict';

// Extrait et classe toute affirmation chiffrée des épisodes de série.
//
// Constat qui motive l'outil : 78 des 129 épisodes citent des pourcentages, et une partie n'est
// adossée à rien. L'épisode 2 de gap-risk avance « en moyenne 0,35 % pour le tracker S&P, 0,48 %
// pour le Nasdaq » et « 85 % des week-ends laissent un écart de 2,3 % » en citant quatre pages
// pédagogiques SEC, OCC et CFTC — dont aucune ne publie ces chiffres.
//
// Trois classes, parce qu'elles appellent trois traitements différents :
//
//   VÉRIFIABLE   une entité nommée, une date nommée, un pourcentage → confrontable aux barres.
//                C'est la seule classe qu'une machine peut trancher, et c'est la plus fréquente.
//   AGRÉGAT      une statistique de population (« 68 % des séances », « en moyenne 0,35 % »)
//                sans étude citée. Ni vérifiable ni sourcée : à calculer soi-même ou à couper.
//   INSTITUTION  une règle ou un horaire (« 4:00 à 9:30 ET », « quatre fois par an ») que les
//                sources citées couvrent réellement.
//
// L'outil ne corrige rien : il produit l'inventaire sur lequel décider. Une machine ne sait pas
// si une source « couvre » une affirmation — mais elle sait dire lesquelles sont testables.
//
//   EXEMPLE CHIFFRÉ  un PARAGRAPHE nommant une entité, une date et plusieurs prix : un cas
//                    d'école déroulé. C'est la classe la plus dangereuse et elle a longtemps
//                    manqué, parce qu'elle ne tient jamais dans une seule phrase.
//
//   node tools/audit-episode-claims.js
//   node tools/audit-episode-claims.js --series gap-risk-survival --json /tmp/claims.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const onlySeries = arg('--series');
const jsonOut = arg('--json');

// `--dir` permet d'auditer la sortie CONSTRUITE et pas seulement la source : sans cela, on ne peut
// pas vérifier qu'une correction a bien retiré ce qu'elle visait, et on croit avoir corrigé.
const SERIES_DIR = path.join(ROOT, arg('--dir', 'data/substack/series'));

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const MONTH_RE = Object.keys(MONTHS).join('|');

// Entités nommées dont on sait retrouver la série. La table est explicite : deviner un symbole
// depuis un nom propre est exactement la façon dont on finit par vérifier le mauvais instrument.
const TICKERS = {
  meta: 'META', facebook: 'META', netflix: 'NFLX', nvidia: 'NVDA', apple: 'AAPL', amazon: 'AMZN',
  microsoft: 'MSFT', google: 'GOOGL', alphabet: 'GOOGL', tesla: 'TSLA', intel: 'INTC',
  broadcom: 'AVGO', oracle: 'ORCL', salesforce: 'CRM', dell: 'DELL', boeing: 'BA',
  qqq: 'QQQ', tqqq: 'TQQQ', spy: 'SPY', iwm: 'IWM', gld: 'GLD', dia: 'DIA',
};
const ENTITY_RE = Object.keys(TICKERS).join('|');

// Marqueurs d'agrégat : ce qui décrit une population plutôt qu'un événement.
const AGGREGATE = /\b(average|averaging|median|typically|typical|roughly|about|approximately|around|per year|a year|of sessions|of weekends|of the time|on average|run largest|ratio near)\b/i;

function classify(sentence) {
  const hasNumber = /\d+(?:[.,]\d+)?\s?%|\$\s?\d/.test(sentence);
  if (!hasNumber) return null;

  const dateM = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})\\s+(\\d{4})\\b|\\b(${MONTH_RE})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i').exec(sentence);
  const entM = new RegExp(`\\b(${ENTITY_RE})\\b`, 'i').exec(sentence);
  const pcts = [...sentence.matchAll(/([−–—-]?\s?\d+(?:[.,]\d+)?)\s?%/g)].map(m => Number(String(m[1]).replace(/[−–—]/g, '-').replace(/\s/g, '').replace(',', '.')));

  if (dateM && entM && pcts.length) {
    const day = Number(dateM[1] || dateM[5]);
    const month = MONTHS[String(dateM[2] || dateM[4]).toLowerCase()];
    const year = Number(dateM[3] || dateM[6]);
    return {
      kind: 'verifiable',
      symbol: TICKERS[entM[1].toLowerCase()],
      entity: entM[1],
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      percents: pcts,
    };
  }
  if (AGGREGATE.test(sentence) && pcts.length) return { kind: 'aggregate', percents: pcts };
  if (/\b\d{1,2}:\d{2}\b|\bfour times a year\b|\bquarterly\b|\bper quarter\b/i.test(sentence)) return { kind: 'institutional', percents: pcts };
  return { kind: 'other', percents: pcts };
}

// LE CLASSEUR PAR PHRASE NE VOIT PAS UN EXEMPLE DÉROULÉ, ET C'EST CE QUI A COÛTÉ LE PLUS CHER.
//
// L'épisode 04 de gap-risk-survival présentait deux trades comme réalisés, résultat compris. Les
// deux étaient inventés : Nvidia n'a jamais imprimé son objectif (plus haut de séance 39,48 pour un
// objectif à 39,5), et le week-end bitcoin de janvier 2024 n'a produit aucun gap — le comptant a
// BAISSÉ. Aucune de ces fabrications n'apparaissait dans l'inventaire, parce qu'elles s'étalent sur
// quatre phrases : le nom dans la première, la date dans la deuxième, les prix dans la troisième,
// le résultat dans la quatrième. Le classeur exigeait les trois dans une seule.
//
// Un exemple chiffré est donc reconnu AU PARAGRAPHE : une entité nommée, une date, et au moins
// trois grandeurs. Chacun est vérifiable contre les barres, et chacun doit l'être — c'est la forme
// qui porte le plus d'autorité auprès du lecteur, donc celle qui doit en mériter le plus.
function workedExamples(text, episode) {
  const out = [];
  for (const para of text.split(/\n\n+/)) {
    const p = para.replace(/\s+/g, ' ').trim();
    if (p.length < 80) continue;
    const ent = new RegExp(`\\b(${ENTITY_RE}|bitcoin|ethereum|gold|oil|treasur\\w+|payrolls?)\\b`, 'i').exec(p);
    const date = new RegExp(`\\b(${MONTH_RE})\\s+\\d{1,2},?\\s+\\d{4}\\b|\\b\\d{1,2}\\s+(${MONTH_RE})\\s+\\d{4}\\b|\\b(${MONTH_RE})\\s+\\d{4}\\b|\\b\\d{4}\\b`, 'i').exec(p);
    if (!ent || !date) continue;
    const nums = p.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) || [];
    if (nums.length < 3) continue;
    // Un RÉSULTAT annoncé (« made », « printed », « came back ») rend le paragraphe falsifiable au
    // sens fort : il ne décrit plus une géométrie, il affirme qu'elle s'est produite.
    const outcome = /\b(printed|made|came back|returned|paid|hit|reached|delivered|gained|lost)\b/i.test(p);
    out.push({ episode, kind: 'worked_example', entity: ent[1], outcome, figures: nums.slice(0, 10), sentence: p.slice(0, 300) });
  }
  return out;
}

const series = onlySeries ? [onlySeries]
  : fs.readdirSync(SERIES_DIR).filter(d => fs.statSync(path.join(SERIES_DIR, d)).isDirectory()
      && fs.readdirSync(path.join(SERIES_DIR, d)).some(f => f.endsWith('.md')));
const findings = [];

for (const s of series) {
  const base = path.join(SERIES_DIR, s);
  for (const file of fs.readdirSync(base).filter(f => f.endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(base, file), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
    const body = raw.replace(/^\|.*$/gm, ' ').replace(/^Sources?:.*$/gm, ' ');
    findings.push(...workedExamples(body, `${s}/${file}`));
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const c = classify(sentence.replace(/\s+/g, ' ').trim());
      if (!c) continue;
      findings.push({ episode: `${s}/${file}`, ...c, sentence: sentence.replace(/\s+/g, ' ').trim().slice(0, 240) });
    }
  }
}

const by = k => findings.filter(f => f.kind === k);
console.log(`[claims] ${series.length} série(s) · ${findings.length} affirmation(s) chiffrée(s)`);
console.log(`  exemples chiffrés (paragraphe) : ${by('worked_example').length}  dont ${by('worked_example').filter(f => f.outcome).length} annonçant un RÉSULTAT`);
console.log(`  vérifiables (entité + date + %) : ${by('verifiable').length}`);
console.log(`  agrégats sans étude citée       : ${by('aggregate').length}`);
console.log(`  institutionnelles               : ${by('institutional').length}`);
console.log(`  autres                          : ${by('other').length}`);

const eps = [...new Set(by('aggregate').map(f => f.episode))];
console.log(`\népisodes portant au moins un agrégat non sourcé : ${eps.length}`);

// Un exemple qui annonce son résultat est la forme la plus persuasive et la plus falsifiable :
// à confronter aux barres EN PRIORITÉ, avant tout agrégat.
const outcomes = by('worked_example').filter(f => f.outcome);
if (outcomes.length) {
  console.log(`\nexemples annonçant un résultat — à confronter aux barres (${outcomes.length}) :`);
  for (const f of outcomes) console.log(`  ${f.episode}  [${f.entity}]  ${f.figures.join(' ')}`);
}

if (jsonOut) {
  fs.writeFileSync(path.resolve(ROOT, jsonOut), JSON.stringify({ findings }, null, 2) + '\n');
  console.log(`[claims] inventaire → ${jsonOut}`);
}
