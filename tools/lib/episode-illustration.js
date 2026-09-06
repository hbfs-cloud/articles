'use strict';

// Vérifie qu'une illustration n'affirme rien que l'épisode ne dise déjà.
//
// La règle, en une phrase : LA PROSE PEUT ÊTRE RESTRUCTURÉE, LES CHIFFRES JAMAIS INTRODUITS.
//
// Elle vient d'un constat de terrain. Mettre une liste à puces en tableau ne crée aucune
// affirmation : les mots sont ceux de l'auteur, seule la mise en page change. Mettre un chiffre
// dans un graphique en crée une, parce qu'un graphique se lit comme une mesure. Sur ces épisodes,
// les faits datés vérifiables se sont révélés faux de façon systématique — « Meta a ouvert 26,4 %
// plus bas » était la variation de CLÔTURE — et une illustration aurait donné à l'erreur l'autorité
// du dessin.
//
// D'où la frontière : un titre de colonne, un intertitre, l'ordre des lignes relèvent de la mise en
// page et se décident librement. Tout GROUPE DE CHIFFRES qui apparaît dans une illustration doit se
// retrouver dans le texte de l'épisode. On ne peut donc illustrer qu'un calcul que l'épisode pose
// lui-même, et le graphique devient la lecture visuelle du paragraphe, pas une source parallèle.
//
// Ce que la règle NE couvre pas, et qu'il faut savoir : elle ne dit rien de la JUSTESSE du chiffre
// dans le texte. Un graphique fidèle à un texte faux reste faux. C'est le rôle de
// `audit-episode-claims.js` et des réécritures de `claim-rewrites.json`.

// Un « chiffre » = une valeur numérique, sous forme canonique (milliers retirés, décimale en point).
//
// LA VIRGULE EST AMBIGUË, ET S'EN REMETTRE AU HASARD COÛTE CHER. Une première version lisait tout
// `\d[\d.,]*`, si bien que le JSON `[60,40]` devenait le nombre « 60,40 » — la règle refusait un
// graphique parfaitement fidèle au texte. Un garde-fou qui crie faux se fait désactiver, et alors
// il ne protège plus de rien.
//
// Convention retenue : une virgule ne sépare des milliers que suivie d'exactement trois chiffres.
// Partout ailleurs elle borne le nombre. « 1,000 » est mille ; « 60,40 » est soixante puis quarante.
const NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

function canon(raw) {
  const forms = new Set();
  const c = raw.replace(/,/g, '');
  forms.add(c);
  if (c.includes('.')) forms.add(c.replace(/0+$/, '').replace(/\.$/, ''));  // 63.60 → 63.6, 5.0 → 5
  return forms;
}

// `generous` sert à lire le TEXTE SOURCE, où la décimale peut s'écrire à la française. « 63,6 »
// y compte alors aussi comme 63.6. Côté illustration on reste strict : mieux vaut refuser un
// graphique juste et le redéclarer que laisser passer un chiffre inventé.
function numbersIn(text, { generous = false } = {}) {
  const out = new Set();
  const s = String(text);
  for (const m of s.matchAll(NUM_RE)) for (const f of canon(m[0])) out.add(f);
  // Seule la virgule que le tokeniseur strict a coupée est relue en décimale — celle qui n'est
  // suivie que d'un ou deux chiffres. Étendre au-delà ferait accepter « 7 » parce que le texte
  // écrit « 7,000 », et la règle perdrait justement ce qu'elle protège.
  if (generous) for (const m of s.matchAll(/\d+,\d{1,2}(?!\d)/g)) for (const f of canon(m[0].replace(',', '.'))) out.add(f);
  return out;
}

// NE JAMAIS TOKENISER UNE SÉRIALISATION.
// Passer `JSON.stringify(data)` au tokeniseur de prose lisait `[100,110,99]` comme le nombre
// « 100110 » : la virgule de séparation JSON devenait un séparateur de milliers. Le garde-fou
// refusait alors des graphiques parfaitement fidèles, ce qui est la façon la plus sûre de se faire
// désactiver. On parcourt donc la STRUCTURE : les nombres sont pris tels quels, les chaînes seules
// passent par le tokeniseur, pour qui elles ont été écrites.
function numbersInValue(value, out = new Set()) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const f of canon(String(Math.abs(value)))) out.add(f);
  } else if (typeof value === 'string') {
    for (const n of numbersIn(value)) out.add(n);
  } else if (Array.isArray(value)) {
    for (const v of value) numbersInValue(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) numbersInValue(v, out);
  }
  return out;
}

// Vérifie qu'un fragment d'illustration n'apporte aucun chiffre absent du texte.
// `fragment` peut être une chaîne ou une structure ; les deux sont lus correctement.
// Retourne la liste des chiffres fautifs — vide si tout va bien.
function foreignNumbers(fragment, sourceText) {
  const known = numbersIn(sourceText, { generous: true });
  const found = typeof fragment === 'string' ? numbersIn(fragment) : numbersInValue(fragment);
  return [...found].filter(n => !known.has(n));
}

// Extrait le texte utile d'un épisode : sans front matter, sans URL (une URL contient des chiffres
// qui n'ont rien d'une mesure), sans les lignes de sources.
function proseOf(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^Sources?:.*$/gm, ' ');
}

module.exports = { numbersIn, numbersInValue, foreignNumbers, proseOf };
