'use strict';

// Graphiques d'exemple chiffré : la lecture visuelle d'un calcul que l'épisode pose lui-même.
//
// Distincts des schémas de `schematics.js`, qui illustrent un MÉCANISME avec des valeurs inventées
// pour la démonstration et le disent en pied de figure. Ici les valeurs sont celles du texte, et le
// pied de figure le dit aussi — parce que les deux se lisent différemment et qu'un lecteur qui les
// confond finit par prendre une illustration pédagogique pour une mesure de marché.
//
// Exemple type. L'épisode 4 de The ETF Toolkit écrit : cible 60/40, le compte dérive à 7 000 $
// d'actions et 3 000 $ d'obligations soit 70/30, on verse 1 000 $ en obligations et on retombe à
// 63,6/36,4. Trois états, une seule idée — la dérive se corrige sans rien vendre. En quatre lignes
// de texte c'est un effort de lecture ; en trois barres empilées c'est immédiat.
//
// ⚠️ AUCUNE FONCTION DANS UNE OPTION ECHARTS ICI.
// Le rendu passe l'option au navigateur via `JSON.stringify`, qui SUPPRIME les fonctions sans rien
// dire. Une première version formatait les étiquettes avec `o => o.value + unit` : les fonctions
// disparaissaient et les graphiques sortaient sans leurs unités, sans que rien n'échoue. Tout
// formatage se fait donc soit par gabarit de chaîne ECharts (`'{c}%'`), soit en calculant le texte
// ici et en le posant sur le point de donnée.
//
// Chaque famille reçoit des données DÉCLARÉES dans `episode-illustrations.json` et vérifiées par
// `episode-illustration.js` : aucun chiffre ici qui ne soit dans l'épisode.

const AXIS = '#94a3b8';
const GRID = '#e2e8f0';
const INK = '#0f172a';
const MUTED = '#64748b';
// Bleu maison en tête ; l'ambre marque l'état problématique, le vert l'état corrigé.
const SERIES_COLORS = ['#50b4ee', '#f59e0b', '#10b981', '#64748b', '#8b5cf6'];

const baseGrid = { left: 64, right: 28, top: 40, bottom: 46, containLabel: true };

// Le signe moins typographique, pas le trait d'union : « −6,75 » se lit, « -6.75 » se subit.
const fmt = (v, unit) => `${v < 0 ? '−' : ''}${Math.abs(v)}${unit}`;

// Un axe calculé au plus juste affiche « 7.9125 », ce qui ne veut rien dire pour un lecteur.
// On monte au prochain palier propre — 1, 2, 2,5 ou 5 fois une puissance de dix.
function niceBound(v, dir) {
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  const pow = Math.pow(10, Math.floor(Math.log10(a)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const up = sign * dir > 0;                       // s'éloigner de zéro, ou s'en rapprocher
  for (const s of up ? steps : [...steps].reverse()) {
    const cand = s * pow;
    if (up ? cand >= a : cand <= a) return sign * cand;
  }
  return sign * (up ? 10 * pow : pow);
}

// Barres empilées : une composition qui change d'état. `states` = [{name, parts:[v,…], caption?}].
function stackedStates({ states, parts, unit = '', total = true }) {
  return {
    grid: baseGrid,
    legend: { data: parts, bottom: 0, textStyle: { color: MUTED, fontSize: 12 }, itemWidth: 12, itemHeight: 12 },
    xAxis: {
      type: 'category', data: states.map(s => s.name),
      axisLabel: { color: INK, fontSize: 13, fontWeight: 600, lineHeight: 16, interval: 0 },
      axisLine: { lineStyle: { color: AXIS } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', axisLabel: { color: MUTED, fontSize: 12, formatter: `{value}${unit}` },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: parts.map((p, i) => ({
      name: p, type: 'bar', stack: 'x', barMaxWidth: 88,
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
      data: states.map(s => ({
        value: s.parts[i],
        // Étiquette calculée ici : ECharts ne sait pas mettre un signe moins typographique seul.
        label: { show: true, position: 'inside', formatter: fmt(s.parts[i], unit), color: i === 0 ? '#06283a' : '#fff', fontSize: 13, fontWeight: 700 },
      })),
    })).concat(total && states.some(s => s.caption) ? [{
      // Une légende au sommet de chaque pile : sans elle, deux barres de hauteurs voisines se
      // comparent mal et le lecteur doit relire le texte pour savoir laquelle est le problème.
      name: '', type: 'bar', stack: 'x', barMaxWidth: 88, itemStyle: { color: 'transparent' }, silent: true,
      data: states.map(s => ({
        value: 0,
        label: { show: true, position: 'top', formatter: s.caption || '', color: MUTED, fontSize: 12, fontWeight: 600 },
      })),
    }] : []),
  };
}

// Barres simples comparées : `bars` = [{name, value, highlight?}].
function comparison({ bars, unit = '', zero = true, note = null }) {
  const vals = bars.map(b => b.value);
  const min = Math.min(...vals, 0), max = Math.max(...vals);
  return {
    grid: { ...baseGrid, bottom: note ? 62 : 46 },
    xAxis: {
      type: 'category', data: bars.map(b => b.name),
      axisLabel: { color: INK, fontSize: 13, fontWeight: 600, interval: 0, lineHeight: 16 },
      axisLine: { lineStyle: { color: AXIS } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: min < 0 ? niceBound(min, 1) : (zero ? 0 : niceBound(Math.min(...vals), -1)),
      max: niceBound(max, 1),
      axisLabel: { color: MUTED, fontSize: 12, formatter: `{value}${unit}` },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: [{
      type: 'bar', barMaxWidth: 82,
      data: bars.map((b, i) => ({
        value: b.value,
        itemStyle: { color: b.highlight ? SERIES_COLORS[1] : SERIES_COLORS[i === bars.length - 1 && bars.length > 1 ? 2 : 0] },
        // `position: top` place l'étiquette d'une barre négative sous zéro ; on la remonte.
        label: { show: true, position: b.value < 0 ? 'bottom' : 'top', formatter: fmt(b.value, unit), color: INK, fontSize: 14, fontWeight: 600 },
      })),
    }],
    graphic: note ? [{ type: 'text', left: 'center', bottom: 4, style: { text: note, fill: MUTED, fontSize: 12, fontWeight: 500 } }] : [],
  };
}

// Trajectoires comparées dans le temps : `lines` = [{name, data:[…]}] sur `x`.
function paths({ x, lines, unit = '', xName = '' }) {
  return {
    grid: { ...baseGrid, right: 74, bottom: 52 },
    legend: { data: lines.map(l => l.name), bottom: 0, textStyle: { color: MUTED, fontSize: 12 }, itemWidth: 18 },
    xAxis: {
      type: 'category', data: x, name: xName, nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: MUTED, fontSize: 12 },
      axisLabel: { color: MUTED, fontSize: 12 }, axisLine: { lineStyle: { color: AXIS } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', scale: true,
      axisLabel: { color: MUTED, fontSize: 12, formatter: `{value}${unit}` },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: lines.map((l, i) => ({
      name: l.name, type: 'line', smooth: false, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 3, color: SERIES_COLORS[i % SERIES_COLORS.length] },
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
      // Chaque point étiqueté : la lecture d'un exemple chiffré porte sur les valeurs, pas sur la
      // pente. Le dernier point est décalé pour ne pas sortir du cadre.
      data: l.data.map((v, j) => ({
        value: v,
        label: { show: true, position: j === l.data.length - 1 ? 'right' : 'top', formatter: fmt(v, unit), color: INK, fontSize: 12, fontWeight: 600 },
      })),
    })),
  };
}

// Décomposition d'un écart en contributions successives : `steps` = [{name, value}], `start`/`end`.
function waterfall({ start, steps, end, unit = '' }) {
  const names = [start.name, ...steps.map(s => s.name), end.name];
  const base = [0];
  let run = start.value;
  for (const s of steps) { base.push(s.value < 0 ? run + s.value : run); run += s.value; }
  base.push(0);
  const shown = [start.value, ...steps.map(s => Math.abs(s.value)), end.value];
  const isEdge = i => i === 0 || i === shown.length - 1;
  return {
    grid: baseGrid,
    xAxis: {
      type: 'category', data: names, axisLabel: { color: INK, fontSize: 12, fontWeight: 600, interval: 0, lineHeight: 15 },
      axisLine: { lineStyle: { color: AXIS } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', axisLabel: { color: MUTED, fontSize: 12, formatter: `{value}${unit}` }, splitLine: { lineStyle: { color: GRID } } },
    series: [
      { type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, data: base, silent: true },
      {
        type: 'bar', stack: 'w', barMaxWidth: 72,
        data: shown.map((v, i) => ({
          value: v,
          itemStyle: { color: isEdge(i) ? SERIES_COLORS[0] : (steps[i - 1].value < 0 ? SERIES_COLORS[1] : SERIES_COLORS[2]) },
          label: {
            show: true, position: 'top', color: INK, fontSize: 13, fontWeight: 600,
            formatter: isEdge(i) ? fmt(v, unit) : `${steps[i - 1].value > 0 ? '+' : '−'}${v}${unit}`,
          },
        })),
      },
    ],
  };
}

const FAMILIES = { stackedStates, comparison, paths, waterfall };

module.exports = { FAMILIES, SERIES_COLORS, niceBound };
