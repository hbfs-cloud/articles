#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { validateCollectedArtifact } = require('./lib/evidence-gates');

const ROOT = path.resolve(__dirname, '..');

// Liste CLOSE des références autoritaires du dépôt. Une seule entrée aujourd'hui. Toute addition
// doit être un acte délibéré : c'est la seule voie par laquelle un chiffre publié peut se passer
// d'une provenance de collecte.
const REGISTRY_SOURCES = new Set(['data/scheduled-events.json']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
// Résolution de pointeur JSON. Sur un tableau, seuls les index numériques sont acceptés : sans
// cela, « /bars/length » publiait le nombre de barres comme s'il s'agissait d'une mesure, et
// « /__proto__/… » résolvait des propriétés héritées. Sur un objet, seule une propriété PROPRE
// répond.
const pointerGet = (value, pointer) => {
  if (pointer === '') return value;
  if (!String(pointer || '').startsWith('/')) return undefined;
  return pointer.slice(1).split('/').reduce((node, raw) => {
    if (node == null || typeof node !== 'object') return undefined;
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(node)) return /^\d+$/.test(key) ? node[Number(key)] : undefined;
    return Object.prototype.hasOwnProperty.call(node, key) ? node[key] : undefined;
  }, value);
};
// Détecteur de texte numérique. Élargi le 2026-09-06 à tous les chiffres Unicode : la version
// ASCII laissait passer « Objectif ٤٢ % », « ４２ % », « ½ point » et « ²⁵ % », qui s'affichent
// exactement comme des chiffres à l'écran.
// LIMITE CONNUE, non couverte : les nombres écrits en toutes lettres (« quatre points », « dix-huit
// pour cent ») échappent encore. Voir docs/BACKLOG.md §9 — ce n'est pas théorique, la page du
// 2026-09-07 en contient.
const hasNumber = text => /(?:^|[^A-Za-z])[-+]?(?:[\p{Nd}]{1,3}(?:[ ,.'][\p{Nd}]{3})+|[\p{Nd}]+)(?:[.,][\p{Nd}]+)?%?/u.test(text)
  || /[\p{No}]/u.test(text);
// Groupement français : espace fine insécable pour les milliers, virgule décimale, signe moins
// typographique. Écrit à la main plutôt que délégué à `toLocaleString`, pour que le rendu ne
// dépende pas de la version d'ICU de la machine qui contrôle.
const GROUP = ' ';
const MINUS = '−';
function frenchDigits(fixed) {
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  return frac ? `${grouped},${frac}` : grouped;
}

// Le rendu est la SEULE façon autorisée de transformer une valeur en texte publié. Le
// constructeur d'article importe cette fonction au lieu d'en avoir une à lui : deux
// implémentations du même formatage finissent toujours par diverger sur un cas limite, et la
// divergence se lit alors comme une erreur de chiffre.
// Une date de calendrier est une affirmation vérifiable au même titre qu'un prix, et c'est même
// celle qui coûte le plus cher quand elle est fausse : le 2026-08-25, un mouvement a été attribué
// à des résultats que la société n'avait pas publiés. Une date saisie à la main ne peut être
// contrôlée ; une date liée au calendrier collecté l'est. `fr_date` rend la date portée par la
// source, jamais celle que l'auteur croit se rappeler.
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function renderFrenchDate(value, parts) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, da] = match;
  const date = new Date(`${y}-${mo}-${da}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() + 1 !== Number(mo) || date.getUTCDate() !== Number(da)) return null;
  const jour = JOURS_FR[date.getUTCDay()];
  const mois = MOIS_FR[date.getUTCMonth()];
  // Le premier du mois prend l'ordinal en français. « annonce du mardi 1 septembre » se lit comme
  // une faute de frappe, ce qui jette le doute sur les chiffres voisins.
  const n = date.getUTCDate() === 1 ? '1er' : String(date.getUTCDate());
  if (parts === 'day_month') return `${n} ${mois}`;
  if (parts === 'weekday_day_month') return `${jour} ${n} ${mois}`;
  if (parts === undefined || parts === 'full') return `${jour} ${n} ${mois} ${y}`;
  return null;
}

// ÉCHELLES ET UNITÉS SONT DES LISTES CLOSES.
//
// Avant le 2026-09-06, `render.scale` acceptait n'importe quel nombre et `render.prefix`/`suffix`
// n'importe quel texte. Les deux ensemble annulaient tout l'intérêt du contrôle, sans exiger le
// moindre mensonge : la provenance restait authentique et un relecteur qui vérifiait le pointeur
// trouvait la bonne barre.
//
//   scale: 17.387…      transforme une clôture réelle de 106,40 en « 1 850,00 $ »
//   suffix: " % — sa meilleure semaine depuis 2020, 3 points au-dessus du consensus"
//                       fait passer de la prose chiffrée entièrement inventée, jamais inspectée
//                       parce que le détecteur saute tout ce qui vit sous un [data-claim].
//
// D'où deux listes fermées. Une unité absente de la liste est un refus, pas une extension à
// improviser : ajouter une entrée doit être un acte délibéré et relu.
const SCALES = new Set([1, 100, 0.01, 1e-3, 1e-6, 1e-9, 1e-12]);
const UNITS = new Set(['', '%', ' %', '$', ' $', '€', ' €', ' pts', ' fois', '×', ' ×', ' Md$', ' T$', ' M$', ' j']);

function renderValue(value, render) {
  if (render && render.format === 'fr_date') return renderFrenchDate(value, render.parts);
  if (typeof value !== 'number' || !Number.isFinite(value) || !render || !Number.isInteger(render.decimals)
    || render.decimals < 0 || render.decimals > 8 || typeof render.scale !== 'number') return null;
  if (render.format !== undefined && render.format !== 'fr') return null;
  if (!SCALES.has(render.scale)) return null;
  if (!UNITS.has(render.prefix || '') || !UNITS.has(render.suffix || '')) return null;
  const scaled = value * render.scale;
  if (render.format === 'fr') {
    const sign = scaled < 0 ? MINUS : (render.sign === 'always' ? '+' : '');
    return `${render.prefix || ''}${sign}${frenchDigits(Math.abs(scaled).toFixed(render.decimals))}${render.suffix || ''}`;
  }
  const sign = render.sign === 'always' && scaled >= 0 ? '+' : '';
  return `${render.prefix || ''}${sign}${scaled.toFixed(render.decimals)}${render.suffix || ''}`;
}

// Opérations autorisées dans un claim. La liste est volontairement close : une formule
// arbitraire rendrait le contrôle circulaire, puisque l'auteur pourrait décrire n'importe quel
// calcul menant au nombre qu'il a déjà écrit.
//
// `ratio_pct` et `ratio` ont été ajoutés le 2026-09-06. Sans eux, AUCUNE performance ne pouvait
// être liée à sa source : une variation est (a/b − 1) × 100 et un multiple de volume est a/b,
// deux formes qu'aucune somme-sur-dénominateur n'exprime. Un hebdo se compose presque
// entièrement de ces deux formes, et faute de pouvoir les déclarer, le contrôle poussait à ne
// pas les instrumenter du tout — c'est-à-dire à publier des chiffres non liés.
// Décompose « /a/b/results/0/data/3/bars/117/4 » en préfixe, index de ligne et colonne. Ce qui
// suit en dépend : deux pointeurs ne peuvent être comparés que s'ils désignent la même série et la
// même grandeur.
function splitSeriesPointer(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return null;
  const parts = pointer.split('/');
  if (parts.length < 4) return null;
  const column = parts[parts.length - 1];
  const index = Number(parts[parts.length - 2]);
  if (!/^\d+$/.test(parts[parts.length - 2]) || !Number.isInteger(index)) return null;
  return { prefix: parts.slice(0, -2).join('/'), index, column };
}

const num = (source, pointer) => {
  const value = pointerGet(source, pointer);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

function evaluateFormula(source, formula) {
  if (!formula || typeof formula.operation !== 'string') return null;

  if (formula.operation === 'sum_divide_pct') {
    if (!Array.isArray(formula.operands) || formula.operands.length < 2
      || typeof formula.denominator_pointer !== 'string') return null;
    const operands = formula.operands.map(item => pointerGet(source, item.pointer));
    const denominator = pointerGet(source, formula.denominator_pointer);
    if (!operands.every(value => typeof value === 'number' && Number.isFinite(value))
      || typeof denominator !== 'number' || !Number.isFinite(denominator) || denominator === 0) return null;
    return operands.reduce((sum, value) => sum + value, 0) / denominator * 100;
  }

  // (a / b − 1) × 100 — une variation entre deux observations de LA MÊME série.
  //
  // Les deux pointeurs doivent partager le même tableau et la même colonne, et le dénominateur
  // doit être antérieur. Sans cette contrainte (état antérieur au 2026-09-06), une « performance
  // de la semaine » pouvait diviser la clôture par le PLUS BAS de la séance de départ et publier
  // +7,47 % au lieu de +6,40 % — sans mensonge apparent, les deux pointeurs désignant des données
  // réelles. Sur un artefact de n nombres, environ n² valeurs étaient atteignables : la formule
  // n'était pas une preuve, c'était un oracle.
  if (formula.operation === 'ratio_pct' || formula.operation === 'ratio') {
    if (typeof formula.numerator_pointer !== 'string' || typeof formula.denominator_pointer !== 'string') return null;
    const A = splitSeriesPointer(formula.numerator_pointer);
    const B = splitSeriesPointer(formula.denominator_pointer);
    if (!A || !B || A.prefix !== B.prefix || A.column !== B.column || !(B.index < A.index)) return null;
    const a = num(source, formula.numerator_pointer);
    const b = num(source, formula.denominator_pointer);
    if (a === null || b === null || b === 0) return null;
    return formula.operation === 'ratio' ? a / b : (a / b - 1) * 100;
  }

  // Rapport d'une observation à la moyenne d'une fenêtre — le multiple de volume d'une séance.
  //
  // La fenêtre est DÉCRITE (`window`, `offset`) et RECONSTRUITE ici, jamais énumérée par l'auteur.
  // L'énumération paraissait plus sûre qu'une borne ; c'est l'inverse. Une borne offre O(n²)
  // fenêtres possibles, un sous-ensemble libre en offre 2ⁿ — de quoi atteindre la valeur voulue à
  // la décimale près, en mélangeant au besoin des prix et des volumes. Vérifié le 2026-09-06 :
  // cinq prix et un volume produisaient « 10,7 fois la moyenne des séances précédentes ».
  if (formula.operation === 'ratio_to_mean') {
    const { numerator_pointer: np, window, offset } = formula;
    if (typeof np !== 'string' || !Number.isInteger(window) || window < 2 || window > 500) return null;
    const off = offset === undefined ? 1 : offset;
    if (!Number.isInteger(off) || off < 1) return null;
    const A = splitSeriesPointer(np);
    if (!A) return null;
    const last = A.index - off, first = last - window + 1;
    if (first < 0) return null;
    const a = num(source, np);
    if (a === null) return null;
    let sum = 0;
    for (let i = first; i <= last; i++) {
      const v = num(source, `${A.prefix}/${i}/${A.column}`);
      if (v === null) return null;
      sum += v;
    }
    const mean = sum / window;
    return mean === 0 ? null : a / mean;
  }

  return null;
}

function validate(manifest, root = ROOT) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest must be an object'];
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(manifest.reference_close || ''))) errors.push('reference_close is invalid');
  const rel = manifest.article_path;
  if (!rel || path.isAbsolute(rel)) return ['article_path must be repository-relative'];
  const articlePath = path.resolve(root, rel);
  if (path.relative(root, articlePath).startsWith('..') || !fs.existsSync(articlePath)) return ['article_path is missing or escapes repository'];
  const bytes = fs.readFileSync(articlePath);
  if (sha256(bytes) !== manifest.article_sha256) errors.push('article_sha256 mismatch');
  const document = new JSDOM(bytes.toString('utf8')).window.document;
  const main = document.querySelector('main');
  if (!main) return [...errors, 'article must contain main'];
  const claims = Array.isArray(manifest.claims) ? manifest.claims : [];
  const byId = new Map();
  for (const claim of claims) {
    if (!claim || !/^[a-z0-9][a-z0-9_-]*$/.test(String(claim.id || ''))) { errors.push('claim id is invalid'); continue; }
    if (byId.has(claim.id)) errors.push(`duplicate manifest claim ${claim.id}`);
    byId.set(claim.id, claim);
  }
  const seen = new Set();
  for (const element of main.querySelectorAll('[data-claim]')) {
    const id = element.getAttribute('data-claim');
    if (seen.has(id)) errors.push(`duplicate article claim ${id}`);
    seen.add(id);
    const claim = byId.get(id);
    if (!claim) { errors.push(`article claim ${id} is absent from manifest`); continue; }
    if (element.textContent.trim() !== String(claim.rendered_text || '').trim()) errors.push(`${id}: rendered_text differs from article`);
  }
  for (const id of byId.keys()) if (!seen.has(id)) errors.push(`manifest claim ${id} is absent from article`);
  // Textes littéraux : chiffres qui ne mesurent rien. « S&P 500 » est un nom propre, une empreinte
  // SHA-256 est un identifiant. Exiger qu'ils soient liés à une source les rendrait impubliables,
  // et la seule issue serait de renommer l'indice — c'est-à-dire de dégrader le texte pour
  // satisfaire le contrôle.
  //
  // L'échappatoire est donc admise, mais DÉCLARÉE : le texte exact de chaque `[data-literal]` doit
  // figurer dans `manifest.literals`. Un chiffre mesuré ne peut pas s'y glisser sans que quelqu'un
  // l'ait écrit noir sur blanc dans une liste courte et relue — ce qui est précisément la
  // différence entre une exception et un trou.
  const literals = new Set(Array.isArray(manifest.literals) ? manifest.literals.map(v => String(v).trim()) : []);
  const declaredLiterals = new Set();
  for (const element of main.querySelectorAll('[data-literal]')) {
    const text = element.textContent.replace(/\s+/g, ' ').trim();
    if (!literals.has(text)) errors.push(`literal not declared in manifest.literals: ${text.slice(0, 60)}`);
    else declaredLiterals.add(text);
    if (element.querySelector('[data-claim]')) errors.push(`literal wraps a claim: ${text.slice(0, 60)}`);
  }
  for (const text of literals) if (!declaredLiterals.has(text)) errors.push(`declared literal is absent from article: ${text.slice(0, 60)}`);

  const walker = document.createTreeWalker(main, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    // `aria-hidden="true"` RETIRÉ de cette liste le 2026-09-06. L'attribut ne masque rien
    // visuellement — il ne masque qu'aux lecteurs d'écran. L'exclure du contrôle laissait publier
    // « Objectif +42 % d'ici décembre » à l'écran tout en le rendant invisible au gate, et
    // pénalisait au passage les utilisateurs de lecteurs d'écran. Un cas légitime passe par
    // `data-literal`, qui est déclaré.
    if (!parent || parent.closest('[data-claim],[data-literal],script,style,template')) continue;
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    if (text && hasNumber(text)) errors.push(`unbound numeric text: ${text.slice(0, 80)}`);
  }
  for (const claim of claims) {
    if (!claim || !claim.source_artifact || path.isAbsolute(claim.source_artifact)
      || !/^[a-f0-9]{64}$/.test(String(claim.source_sha256 || ''))
      || typeof claim.source_pointer !== 'string' || !claim.source_pointer.startsWith('/')) {
      errors.push(`${claim && claim.id || '?'}: source artifact/hash/pointer is invalid`); continue;
    }
    const sourcePath = path.resolve(root, claim.source_artifact);
    if (path.relative(root, sourcePath).startsWith('..') || !fs.existsSync(sourcePath)) { errors.push(`${claim.id}: source artifact is missing`); continue; }
    const sourceBytes = fs.readFileSync(sourcePath);
    if (sha256(sourceBytes) !== claim.source_sha256) { errors.push(`${claim.id}: source hash mismatch`); continue; }
    let source;
    try { source = JSON.parse(sourceBytes); } catch { errors.push(`${claim.id}: source is not valid JSON`); continue; }
    // DEUX CLASSES DE PROVENANCE.
    //
    // La première, historique : un artefact COLLECTÉ, dont la provenance est prouvée par le journal
    // de collecte et le harnais. C'est le cas de tout ce qui vient d'un marché.
    //
    // La seconde, ajoutée le 2026-09-06 : une RÉFÉRENCE AUTORITAIRE versionnée dans le dépôt. Une
    // date que la Réserve fédérale publie un an d'avance n'a pas besoin d'une provenance de
    // collecte — elle a besoin d'une citation. Et elle en a besoin précisément parce que le flux
    // de marché s'est révélé faux là-dessus : il datait le PPI d'août au 14 septembre quand la BLS
    // le publie le 10, et ignorait le FOMC des 15-16. Un artefact certifié peut être faux ; la
    // certification prouve l'origine, pas l'exactitude.
    //
    // Le contrat est strict : le fichier doit porter `sources` avec URL, autorité et date de
    // relevé, et le claim doit désigner laquelle l'appuie. Sans quoi cette classe deviendrait une
    // porte de sortie pour publier n'importe quoi sans provenance.
    const isRegistry = REGISTRY_SOURCES.has(claim.source_artifact);
    if (isRegistry) {
      const authority = source && source.sources && source.sources[claim.authority];
      if (!claim.authority || !authority) {
        errors.push(`${claim.id}: une référence de registre doit nommer son autorité via \`authority\` (présentes : ${Object.keys((source && source.sources) || {}).join(', ') || 'aucune'})`);
        continue;
      }
      for (const field of ['url', 'authority', 'fetched_at']) {
        if (!authority[field]) { errors.push(`${claim.id}: l'autorité « ${claim.authority} » n'a pas de ${field}`); }
      }
    } else {
      const collectedErrors = validateCollectedArtifact(sourcePath, claim.source_sha256, manifest.reference_close, root);
      if (collectedErrors.length) { errors.push(`${claim.id}: source collector provenance invalid: ${collectedErrors.join('; ')}`); continue; }
    }
    const observed = pointerGet(source, claim.source_pointer);
    if (JSON.stringify(observed) !== JSON.stringify(claim.source_value)) errors.push(`${claim.id}: source_value differs from source_pointer`);
    // `formula.result` DOIT être un nombre. Absent, `Math.abs(x - Number(undefined))` vaut NaN,
    // la comparaison `> 1e-10` est fausse, et l'assertion ne se déclenchait jamais — un garde-fou
    // muet, précisément celui que le test croyait éprouver.
    if (claim.formula && typeof claim.formula.result !== 'number') {
      errors.push(`${claim.id}: formula.result must be a number`); continue;
    }
    // Le pointeur affiché doit être celui du numérateur : c'est lui qu'un relecteur humain suivra.
    // Sans cette égalité, `source_pointer` pouvait désigner un volume pendant que la formule
    // portait sur des prix.
    if (claim.formula && claim.source_pointer !== claim.formula.numerator_pointer) {
      errors.push(`${claim.id}: source_pointer must be the formula numerator`); continue;
    }
    const formulaValue = claim.formula ? evaluateFormula(source, claim.formula) : observed;
    if (claim.formula && (!Number.isFinite(formulaValue)
      || Math.abs(formulaValue - claim.formula.result) > 1e-10)) {
      errors.push(`${claim.id}: formula result differs from source operands`);
    }
    const expectedText = renderValue(formulaValue, claim.render);
    if (expectedText == null || expectedText !== claim.rendered_text) errors.push(`${claim.id}: rendered_text is not the deterministic rendering of source_value`);
  }
  return [...new Set(errors)];
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: validate-content-claims.js <claims.json>'); process.exit(2); }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`[content-claims] invalid JSON: ${error.message}`); process.exit(1); }
  const errors = validate(manifest);
  if (errors.length) { console.error('[content-claims] FAIL'); errors.forEach(error => console.error(`  - ${error}`)); process.exit(1); }
  console.log(`[content-claims] PASS (${manifest.claims.length} claims)`);
}

module.exports = { renderValue, validate };
