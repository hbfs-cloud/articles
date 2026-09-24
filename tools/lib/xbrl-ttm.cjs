'use strict';
// Agrégats GAAP sur douze mois glissants à partir des données XBRL officielles de la SEC
// (companyfacts). TTM = cumul de l'exercice en cours au dernier 10-Q + dernier exercice annuel (10-K)
// − cumul de la même période de l'exercice précédent. Chaque valeur retourne son pointeur JSON exact
// dans le fichier source, pour la provenance.
const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
function units(cf, tag, unit = 'USD') {
  for (const ns of ['us-gaap', 'dei']) {
    const f = cf.facts[ns] && cf.facts[ns][tag];
    if (f && f.units[unit]) return { ns, rows: f.units[unit], base: `/facts/${ns}/${tag}/units/${unit}` };
  }
  return null;
}
// Durée d'une ligne XBRL en jours (null pour une valeur de bilan).
const span = r => r.start ? days(r.start, r.end) : null;
// Départage à même date de fin : la période la plus longue d'abord (un 10-Q porte à la fois le trimestre
// seul et le cumul de l'exercice, qui finissent le même jour), puis le dépôt le plus récent. L'ordre des
// lignes dans companyfacts ne décide jamais.
function better(r, b) {
  if (r.end !== b.end) return r.end > b.end;
  const sr = span(r) || 0, sb = span(b) || 0;
  if (sr !== sb) return sr > sb;
  return String(r.filed || '') > String(b.filed || '');
}
function pick(u, pred) {
  let best = null;
  u.rows.forEach((r, i) => { if (pred(r) && (!best || better(r, best.r))) best = { r, i }; });
  return best && { value: best.r.val, end: best.r.end, start: best.r.start, form: best.r.form, accn: best.r.accn, pointer: `${u.base}/${best.i}/val` };
}
// Parmi les étiquettes candidates, retient celle dont la dernière période est la plus récente : une
// société change parfois d'étiquette (Revenues → RevenueFromContract…), et l'ancienne resterait
// sinon choisie avec des chiffres de plusieurs années.
const latest = list => list.filter(Boolean).sort((a, b) => String(b.parts ? b.parts[0].end : b.end).localeCompare(String(a.parts ? a.parts[0].end : a.end)))[0] || null;
function ttm(cf, tags, asOf) { return latest([].concat(tags).map(t => ttmOne(cf, t, asOf))); }
function instant(cf, tags, asOf) { return latest([].concat(tags).map(t => instantOne(cf, t, asOf))); }
function quarter(cf, tags, asOf) { return latest([].concat(tags).map(t => quarterOne(cf, t, asOf))); }
function ttmOne(cf, tags, asOf) {
  for (const tag of [].concat(tags)) {
    const u = units(cf, tag); if (!u) continue;
    const ann = pick(u, r => r.form && r.form.startsWith('10-K') && span(r) > 350 && span(r) < 380 && r.end <= asOf);
    const ytd = pick(u, r => r.form && r.form.startsWith('10-Q') && span(r) > 80 && span(r) < 300 && r.end <= asOf && (!ann || r.end > ann.end));
    if (!ann) continue;
    // Un exercice annuel trop ancien (étiquette abandonnée puis reprise) ne se combine pas avec un
    // cumul récent : on refuse plutôt que de fabriquer un agrégat de plusieurs années.
    if (ytd && days(ann.end, ytd.end) > 400) continue;
    // Sans cumul trimestriel postérieur, l'exercice annuel n'est retenu que s'il est récent : sinon
    // l'étiquette n'est plus publiée au trimestre et le chiffre ne couvrirait pas les douze derniers mois.
    if (!ytd) { if (days(ann.end, asOf) > 200) continue; return { tag, value: ann.value, parts: [ann], method: 'annual' }; }
    const len = days(ytd.start, ytd.end);
    const prior = pick(u, r => r.form && r.form.startsWith('10-Q') && span(r) && Math.abs(span(r) - len) < 10 && r.end < ytd.start && days(r.end, ytd.end) > 350 && days(r.end, ytd.end) < 380);
    if (!prior) continue;
    return { tag, value: ytd.value + ann.value - prior.value, parts: [ytd, ann, prior], method: 'ytd+annual-prior_ytd' };
  }
  return null;
}
function instantOne(cf, tags, asOf) {
  for (const tag of [].concat(tags)) {
    const u = units(cf, tag); if (!u) continue;
    const x = pick(u, r => !r.start && r.end <= asOf);
    // Une valeur de bilan de plus de deux cents jours n'est pas le dernier bilan publié : étiquette abandonnée.
    if (x && days(x.end, asOf) <= 200) return { tag, ...x };
  }
  return null;
}
function quarterOne(cf, tags, asOf) {
  for (const tag of [].concat(tags)) {
    const u = units(cf, tag); if (!u) continue;
    const x = pick(u, r => span(r) > 80 && span(r) < 100 && r.end <= asOf);
    if (x) return { tag, ...x };
  }
  return null;
}
module.exports = { units, ttm, instant, quarter, pick };
