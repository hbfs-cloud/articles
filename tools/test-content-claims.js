#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate } = require('./validate-content-claims');
const { stableStringify } = require('./lib/workflow-contract');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-claims-'));
try {
  const article = '<!doctype html><main><p>Move: <span data-claim="move">+2.5%</span></p></main>';
  const source = JSON.stringify({ move: 2.5 });
  fs.writeFileSync(path.join(root, 'article.html'), article);
  fs.writeFileSync(path.join(root, 'source.json'), source);
  const plan = '{}'; fs.writeFileSync(path.join(root, 'plan.json'), plan);
  const resolvedInput = { artifact: 'article', refdate: '2026-08-28', waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData' }] }] };
  const inputHash = crypto.createHash('sha256').update(stableStringify(resolvedInput)).digest('hex');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: inputHash,
    sources: [{ name: 'source', sha256: crypto.createHash('sha256').update(source).digest('hex'), required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: inputHash, resolved_input: resolvedInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: crypto.createHash('sha256').update(source).digest('hex') }] }],
  }));
  const manifest = { reference_close: '2026-08-28', article_path: 'article.html', article_sha256: crypto.createHash('sha256').update(article).digest('hex'), claims: [{
    id: 'move', rendered_text: '+2.5%', source_artifact: 'source.json', source_sha256: crypto.createHash('sha256').update(source).digest('hex'), source_pointer: '/move', source_value: 2.5,
    render: { scale: 1, decimals: 1, sign: 'always', suffix: '%' },
  }] };
  assert.deepStrictEqual(validate(manifest, root), []);
  const badArticle = '<main><p>Unbound 42</p></main>';
  fs.writeFileSync(path.join(root, 'article.html'), badArticle);
  manifest.article_sha256 = crypto.createHash('sha256').update(badArticle).digest('hex');
  assert(validate(manifest, root).some(error => error.includes('unbound numeric')));
  fs.writeFileSync(path.join(root, 'article.html'), article.replace('+2.5%', '+999.0%'));
  manifest.article_sha256 = crypto.createHash('sha256').update(article.replace('+2.5%', '+999.0%')).digest('hex');
  manifest.claims[0].rendered_text = '+999.0%';
  assert(validate(manifest, root).some(error => error.includes('deterministic rendering')));

  // ── opérations ajoutées le 2026-09-06 ────────────────────────────────────
  // Une variation en pourcentage et un multiple de volume sont les deux formes dont un hebdo est
  // fait. Tant qu'elles n'étaient pas déclarables, la seule façon de passer le contrôle était de
  // ne pas instrumenter ces chiffres — donc de les publier non liés à leur source.
  const perfSource = JSON.stringify({ bars: [{ c: 100, v: 10 }, { c: 100, v: 20 }, { c: 110, v: 90 }] });
  const perfHash = crypto.createHash('sha256').update(perfSource).digest('hex');
  fs.writeFileSync(path.join(root, 'source.json'), perfSource);
  const perfInput = { artifact: 'article', refdate: '2026-08-28', waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData' }] }] };
  const perfInputHash = crypto.createHash('sha256').update(stableStringify(perfInput)).digest('hex');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: perfInputHash,
    sources: [{ name: 'source', sha256: perfHash, required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: perfInputHash, resolved_input: perfInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: perfHash }] }],
  }));

  const build = (html, claims) => {
    fs.writeFileSync(path.join(root, 'article.html'), html);
    return { reference_close: '2026-08-28', article_path: 'article.html', article_sha256: crypto.createHash('sha256').update(html).digest('hex'), claims };
  };
  const claim = (id, text, formula, render, extra = {}) => ({
    id, rendered_text: text, source_artifact: 'source.json', source_sha256: perfHash,
    source_pointer: formula.numerator_pointer, source_value: 110, render,
    formula: { ...formula, result: extra.result },
  });

  // (110 / 100 − 1) × 100 = +10.0%
  assert.deepStrictEqual(validate(build(
    '<!doctype html><main><p>Perf <span data-claim="perf">+10.0%</span></p></main>',
    [claim('perf', '+10.0%', { operation: 'ratio_pct', numerator_pointer: '/bars/2/c', denominator_pointer: '/bars/0/c' },
      { scale: 1, decimals: 1, sign: 'always', suffix: '%' }, { result: 10 })],
  ), root), []);

  // 90 / moyenne(10, 20) = 6.0 fois
  assert.deepStrictEqual(validate(build(
    '<!doctype html><main><p>Volume <span data-claim="vol">6.0</span> fois</p></main>',
    [{ ...claim('vol', '6.0', { operation: 'ratio_to_mean', numerator_pointer: '/bars/2/v', window: 2, offset: 1 }, { scale: 1, decimals: 1 }, { result: 6 }), source_pointer: '/bars/2/v', source_value: 90 }],
  ), root), []);

  // Une formule qui ne produit PAS le nombre déclaré doit être rejetée : c'est le seul garde-fou
  // contre un auteur qui écrirait d'abord le chiffre voulu, puis une formule pour l'habiller.
  assert(validate(build(
    '<!doctype html><main><p>Perf <span data-claim="perf">+42.0%</span></p></main>',
    [claim('perf', '+42.0%', { operation: 'ratio_pct', numerator_pointer: '/bars/2/c', denominator_pointer: '/bars/0/c' },
      { scale: 1, decimals: 1, sign: 'always', suffix: '%' }, { result: 42 })],
  ), root).some(error => error.includes('formula result differs')));

  // Une opération inconnue ne doit jamais retomber sur la valeur brute du pointeur.
  assert(validate(build(
    '<!doctype html><main><p>Perf <span data-claim="perf">110.0</span></p></main>',
    [claim('perf', '110.0', { operation: 'exponentiate', numerator_pointer: '/bars/2/c', denominator_pointer: '/bars/0/c' },
      { scale: 1, decimals: 1 }, { result: 110 })],
  ), root).length > 0);

  // Un dénominateur nul est un refus, pas un Infinity rendu à l'écran.
  assert(validate(build(
    '<!doctype html><main><p>Perf <span data-claim="perf">+10.0%</span></p></main>',
    [claim('perf', '+10.0%', { operation: 'ratio_pct', numerator_pointer: '/bars/2/c', denominator_pointer: '/bars/0/missing' },
      { scale: 1, decimals: 1, sign: 'always', suffix: '%' }, { result: 10 })],
  ), root).length > 0);

  // ── rendu français ───────────────────────────────────────────────────────
  const { renderValue } = require('./validate-content-claims');
  assert.strictEqual(renderValue(10.674, { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' }), '+10,67 %');
  assert.strictEqual(renderValue(-2.7448, { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' }), '−2,74 %');
  assert.strictEqual(renderValue(1016.59, { scale: 1, decimals: 2, format: 'fr' }), '1 016,59');
  assert.strictEqual(renderValue(457.36, { scale: 1, decimals: 0, format: 'fr' }), '457');
  // Un format inconnu ne retombe pas silencieusement sur l'anglais : il refuse.
  assert.strictEqual(renderValue(1, { scale: 1, decimals: 0, format: 'de' }), null);

  // Le texte français est bien reconnu comme numérique : s'il échappait au détecteur, un chiffre
  // non lié passerait inaperçu là précisément où la page est rédigée.
  assert(validate(build(
    '<!doctype html><main><p>Perf −2,74 % hors claim</p></main>', []), root).some(e => e.includes('unbound numeric')));

  assert.deepStrictEqual(validate(build(
    '<!doctype html><main><p>Perf <span data-claim="perf">+10,00 %</span></p></main>',
    [claim('perf', '+10,00 %', { operation: 'ratio_pct', numerator_pointer: '/bars/2/c', denominator_pointer: '/bars/0/c' },
      { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' }, { result: 10 })],
  ), root), []);

  // ── dates de calendrier ──────────────────────────────────────────────────
  assert.strictEqual(renderValue('2026-09-10T14:15:00+02:00', { format: 'fr_date' }), 'jeudi 10 septembre 2026');
  assert.strictEqual(renderValue('2026-09-10T08:30:00-04:00', { format: 'fr_date', parts: 'weekday_day_month' }), 'jeudi 10 septembre');
  assert.strictEqual(renderValue('2026-09-11', { format: 'fr_date', parts: 'day_month' }), '11 septembre');
  assert.strictEqual(renderValue('2026-09-01', { format: 'fr_date', parts: 'weekday_day_month' }), 'mardi 1er septembre');
  assert.strictEqual(renderValue('2026-09-02', { format: 'fr_date', parts: 'weekday_day_month' }), 'mercredi 2 septembre');
  // Une date qui n'existe pas ne doit pas être « corrigée » en silence vers le 1er octobre.
  assert.strictEqual(renderValue('2026-09-31', { format: 'fr_date' }), null);
  assert.strictEqual(renderValue('pas une date', { format: 'fr_date' }), null);
  assert.strictEqual(renderValue(20260910, { format: 'fr_date' }), null);

  const dateSource = JSON.stringify({ events: [{ event_time: '2026-09-10T14:15:00+02:00' }] });
  const dateHash = crypto.createHash('sha256').update(dateSource).digest('hex');
  fs.writeFileSync(path.join(root, 'source.json'), dateSource);
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: perfInputHash,
    sources: [{ name: 'source', sha256: dateHash, required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: perfInputHash, resolved_input: perfInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: dateHash }] }],
  }));
  const dateClaim = text => [{
    id: 'ecb', rendered_text: text, source_artifact: 'source.json', source_sha256: dateHash,
    source_pointer: '/events/0/event_time', source_value: '2026-09-10T14:15:00+02:00',
    render: { format: 'fr_date', parts: 'weekday_day_month' },
  }];
  assert.deepStrictEqual(validate(build(
    '<!doctype html><main><p>BCE <span data-claim="ecb">jeudi 10 septembre</span></p></main>', dateClaim('jeudi 10 septembre')), root), []);
  // Décaler la date publiée d'un jour doit être refusé — c'est le mode d'échec qu'on vise.
  assert(validate(build(
    '<!doctype html><main><p>BCE <span data-claim="ecb">mercredi 9 septembre</span></p></main>', dateClaim('mercredi 9 septembre')), root)
    .some(e => e.includes('deterministic rendering')));

  // ── Contournements du gate, fermés le 2026-09-06 ─────────────────────────
  // Chacun a été EXÉCUTÉ contre le validateur avant correction : ils passaient tous, sans mensonge
  // apparent, provenance authentique et pointeur vérifiable à la main. Un contrôle contournable
  // est pire qu'aucun contrôle — il donne une garantie qu'il ne tient pas.
  const litSource = JSON.stringify({ bars: [[0, 0, 0, 0, 100, 10], [0, 0, 0, 0, 100, 20], [0, 0, 0, 0, 110, 90]] });
  const litHash = crypto.createHash('sha256').update(litSource).digest('hex');
  fs.writeFileSync(path.join(root, 'source.json'), litSource);
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({
    reference_close: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'), input_sha256: perfInputHash,
    sources: [{ name: 'source', sha256: litHash, required: true }],
  }));
  fs.writeFileSync(path.join(root, '_collect.json'), JSON.stringify({
    reference_date: '2026-08-28', plan: 'plan.json', plan_sha256: crypto.createHash('sha256').update(plan).digest('hex'),
    input_sha256: perfInputHash, resolved_input: perfInput,
    waves: [{ calls: [{ as: 'source', server: 'marketdata', tool: 'QueryData', ok: true, output_sha256: litHash }] }],
  }));
  const c2 = (id, text, extra) => ({
    id, rendered_text: text, source_artifact: 'source.json', source_sha256: litHash,
    source_pointer: '/bars/2/4', source_value: 110, render: { scale: 1, decimals: 2, format: 'fr' }, ...extra,
  });
  const fails = (html, claims, needle) => {
    const errs = validate(build(html, claims), root);
    assert(errs.length > 0, `attendu un refus : ${needle}`);
    return errs;
  };

  // A1 — une échelle arbitraire transformait 106,40 en « 1 850,00 »
  fails('<!doctype html><main><p><span data-claim="x">1 912,68</span></p></main>',
    [c2('x', '1 912,68', { render: { scale: 17.387, decimals: 2, format: 'fr' } })], 'scale arbitraire');

  // A2 — un suffixe libre faisait passer de la prose chiffrée jamais inspectée
  fails('<!doctype html><main><p><span data-claim="x">110,00 % — meilleure semaine depuis 2020</span></p></main>',
    [c2('x', '110,00 % — meilleure semaine depuis 2020', { render: { scale: 1, decimals: 2, suffix: ' % — meilleure semaine depuis 2020', format: 'fr' } })], 'suffixe libre');

  // A4 — dénominateur pris dans une autre colonne (le plus bas au lieu de la clôture)
  fails('<!doctype html><main><p><span data-claim="x">+10,00 %</span></p></main>',
    [c2('x', '+10,00 %', { source_pointer: '/bars/2/4', render: { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' },
      formula: { operation: 'ratio_pct', numerator_pointer: '/bars/2/4', denominator_pointer: '/bars/0/3', result: 10 } })], 'colonnes différentes');

  // A4 bis — dénominateur POSTÉRIEUR au numérateur (performance inversée)
  fails('<!doctype html><main><p><span data-claim="x">−9,09 %</span></p></main>',
    [c2('x', '−9,09 %', { source_pointer: '/bars/0/4', render: { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' },
      formula: { operation: 'ratio_pct', numerator_pointer: '/bars/0/4', denominator_pointer: '/bars/2/4', result: -9.0909 } })], 'ordre inversé');

  // A3 — la fenêtre de moyenne est reconstruite, plus énumérée : mélanger prix et volumes échoue
  fails('<!doctype html><main><p><span data-claim="x">10,70</span></p></main>',
    [c2('x', '10,70', { source_pointer: '/bars/2/5', source_value: 90,
      formula: { operation: 'ratio_to_mean', numerator_pointer: '/bars/2/5', mean_pointers: ['/bars/0/4', '/bars/1/4'], result: 10.7 } })], 'mean_pointers libre');

  // A3 bis — la forme légitime (fenêtre décrite) passe : 90 / moyenne(10, 20) = 6
  assert.deepStrictEqual(validate(build(
    '<!doctype html><main><p><span data-claim="x">6,00</span></p></main>',
    [c2('x', '6,00', { source_pointer: '/bars/2/5', source_value: 90,
      formula: { operation: 'ratio_to_mean', numerator_pointer: '/bars/2/5', window: 2, offset: 1, result: 6 } })],
  ), root), []);

  // A5 — aria-hidden ne masque rien à l'écran, il ne doit rien masquer au contrôle
  fails('<!doctype html><main><p>Objectif <span aria-hidden="true">+42 % d\'ici décembre</span></p></main>', [], 'aria-hidden');

  // A6 — chiffres non ASCII, visibles à l'écran comme des chiffres
  for (const bad of ['Objectif ٤٢ %', 'Objectif ４２ %', 'une hausse de ½ point', 'une perte de ²⁵ %']) {
    assert(fails(`<!doctype html><main><p>${bad}</p></main>`, [], bad).some(e => e.includes('unbound numeric')), bad);
  }

  // A9 — sans `formula.result`, l'assertion de formule ne se déclenchait jamais
  fails('<!doctype html><main><p><span data-claim="x">+10,00 %</span></p></main>',
    [c2('x', '+10,00 %', { render: { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' },
      formula: { operation: 'ratio_pct', numerator_pointer: '/bars/2/4', denominator_pointer: '/bars/0/4' } })], 'result absent');

  // A10 — le pointeur affiché doit être celui du numérateur, sinon un relecteur suit une fausse piste
  fails('<!doctype html><main><p><span data-claim="x">+10,00 %</span></p></main>',
    [c2('x', '+10,00 %', { source_pointer: '/bars/2/5', source_value: 90, render: { scale: 1, decimals: 2, sign: 'always', suffix: ' %', format: 'fr' },
      formula: { operation: 'ratio_pct', numerator_pointer: '/bars/2/4', denominator_pointer: '/bars/0/4', result: 10 } })], 'pointeur détourné');

  // A11 — `/bars/length` publiait le nombre de barres comme une mesure
  fails('<!doctype html><main><p><span data-claim="x">3,00</span></p></main>',
    [c2('x', '3,00', { source_pointer: '/bars/length', source_value: 3 })], 'propriété length');

  // literals — non déclaré refusé, déclaré-mais-absent refusé aussi
  fails('<!doctype html><main><p><span data-literal="x">+14,2 % sur le mois</span></p></main>', [], 'littéral non déclaré');
  {
    const html = '<!doctype html><main><p>rien</p></main>';
    const man = build(html, []); man.literals = ['S&P 500'];
    assert(validate(man, root).some(e => e.includes('declared literal is absent')));
  }

  console.log('content claims tests: PASS');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
