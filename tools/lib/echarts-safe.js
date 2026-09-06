'use strict';

// Refuse une option ECharts que la sérialisation détruirait en silence.
//
// Les rendus PNG passent l'option au navigateur via `JSON.stringify`. Or `JSON.stringify` SUPPRIME
// les fonctions sans le dire : une option dont les étiquettes sont formatées par
// `o => o.value + '%'` part complète et arrive amputée. Le graphique se dessine, rien n'échoue, et
// les unités ont disparu. Il a fallu regarder l'image de près pour s'en apercevoir.
//
// D'où ce garde-fou : une fonction dans une option est une erreur de construction, pas une
// préférence de style. Le formatage se fait par gabarit ECharts (`'{value}%'`, `'{c}%'`) ou en
// calculant le texte au moment de la construction et en le posant sur le point de donnée.

function findFunctions(node, trail = '', found = []) {
  if (typeof node === 'function') { found.push(trail || '(racine)'); return found; }
  if (Array.isArray(node)) {
    node.forEach((v, i) => findFunctions(v, `${trail}[${i}]`, found));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) findFunctions(v, trail ? `${trail}.${k}` : k, found);
  }
  return found;
}

// Lève si l'option contient une fonction. `label` nomme la figure dans le message.
function assertSerializable(option, label) {
  const fns = findFunctions(option);
  if (!fns.length) return;
  throw new Error(
    `${label}: ${fns.length} fonction(s) dans l'option ECharts — JSON.stringify les supprimerait ` +
    `en silence et la figure sortirait incomplète sans erreur.\n` +
    `    Chemins : ${fns.slice(0, 6).join(', ')}${fns.length > 6 ? ', …' : ''}\n` +
    `    Utiliser un gabarit ECharts ('{value}%', '{c}%') ou calculer le texte à la construction.`);
}

module.exports = { assertSerializable, findFunctions };
