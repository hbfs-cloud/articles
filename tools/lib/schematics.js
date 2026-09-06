'use strict';

// Schémas pédagogiques — bibliothèque de figures qui expliquent un MÉCANISME.
//
// Règle de fond, et elle n'est pas cosmétique : ces figures n'ont pas le droit de ressembler à une
// mesure de marché. Les 129 épisodes programmés avancent des statistiques dont la source citée ne
// les couvre pas — cinq chiffres sur les gaps du S&P attribués à « 2000-2024 » sous deux liens qui
// traitent l'un des types d'ordres, l'autre des séances étendues. Mettre ces chiffres en graphique
// les rendrait plus crédibles sans les rendre plus vrais. On illustre donc le raisonnement, jamais
// le chiffre non sourcé.
//
// Chaque figure porte en pied la mention « Schematic — illustrates the mechanism, not market data »
// et ses axes sont sans unité chiffrée quand la grandeur est arbitraire.

const INK = '#0f172a';
const MUTED = '#64748b';
const GRID = '#e2e8f0';
const BAD = '#dc2626';
const GOOD = '#16a34a';
const ACCENT = '#0ea5e9';
const WARN = '#f59e0b';

const base = () => ({
  animation: false,
  textStyle: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, color: INK },
  grid: { left: 56, right: 40, top: 34, bottom: 46 },
});
const noUnitAxis = name => ({ type: 'value', name, nameTextStyle: { fontSize: 10, color: MUTED }, axisLabel: { show: false }, splitLine: { lineStyle: { color: GRID } } });


// ── diagrammes de flux ──────────────────────────────────────────────────────
// Dessinés avec des primitives `graphic` plutôt qu'avec la série `graph` d'ECharts : en
// coordonnées cartésiennes, celle-ci rendait les boîtes correctement mais AVALAIT les flèches,
// et un diagramme de flux sans flèches ne dit plus dans quel sens il se lit. On garde le contrôle.
function flowDiagram({ nodes, links, caption, W = 1136, H = 300 }) {
  const g = [];
  const box = (n) => ({
    type: 'group', left: n.x - n.w / 2, top: n.y - n.h / 2,
    children: [
      { type: 'rect', shape: { x: 0, y: 0, width: n.w, height: n.h, r: 10 }, style: { fill: n.color } },
      { type: 'text', style: { text: n.label, fill: '#fff', font: '600 13px Inter, system-ui, sans-serif', align: 'center', verticalAlign: 'middle', lineHeight: 17 }, left: n.w / 2, top: n.h / 2 },
    ],
  });
  const arrow = (a, b) => {
    // trajet horizontal ou coudé selon la position relative des deux boîtes
    const from = { x: a.x + a.w / 2, y: a.y };
    const to = { x: b.x - b.w / 2, y: b.y };
    const pts = from.y === to.y
      ? [[from.x, from.y], [to.x, to.y]]
      : [[from.x, from.y], [(from.x + to.x) / 2, from.y], [(from.x + to.x) / 2, to.y], [to.x, to.y]];
    const head = 7;
    return [
      { type: 'polyline', shape: { points: pts }, style: { stroke: MUTED, lineWidth: 2, fill: 'none' } },
      { type: 'polygon', shape: { points: [[to.x, to.y], [to.x - head * 1.6, to.y - head], [to.x - head * 1.6, to.y + head]] }, style: { fill: MUTED } },
    ];
  };
  for (const l of links) g.push(...arrow(nodes[l[0]], nodes[l[1]]));
  for (const n of nodes) g.push(box(n));
  if (caption) g.push({ type: 'text', left: 'center', top: H - 24, style: { text: caption, fill: MUTED, font: '12px Inter, system-ui, sans-serif', align: 'center' } });
  return { animation: false, xAxis: { show: false }, yAxis: { show: false }, series: [], graphic: g };
}

const SCHEMATICS = {

  // Le stop se déclenche et ne trouve rien entre le seuil et la prochaine cotation.
  //
  // L'échelle est BORNÉE À LA MAIN. Laissée à l'automatique, elle partait de zéro : la chute de
  // 100 à 82 devenait deux segments presque à plat et la figure racontait le contraire de son
  // titre. Une illustration qui contredit sa légende est pire qu'une absence d'illustration.
  gap_and_stop: () => ({
    ...base(),
    grid: { left: 56, right: 40, top: 46, bottom: 46 },
    xAxis: { type: 'category', boundaryGap: true, data: ['', 'close', 'overnight', 'open', ''],
      axisLabel: { fontSize: 12, color: MUTED }, axisTick: { show: false }, axisLine: { lineStyle: { color: GRID } } },
    yAxis: { type: 'value', min: 74, max: 106, name: 'price', nameTextStyle: { fontSize: 10, color: MUTED },
      axisLabel: { fontSize: 11, color: MUTED, formatter: '{value}' }, splitLine: { lineStyle: { color: GRID } } },
    series: [
      // la séance d'avant, puis le trou, puis la réouverture
      { type: 'line', data: [99, 100, null, null, null], lineStyle: { width: 3, color: INK }, symbol: 'circle', symbolSize: 9, itemStyle: { color: INK },
        markArea: { silent: true, itemStyle: { color: 'rgba(220,38,38,0.07)' }, data: [[{ xAxis: 'close' }, { xAxis: 'open' }]] } },
      { type: 'line', data: [null, null, null, 82, 81], lineStyle: { width: 3, color: BAD }, symbol: 'circle', symbolSize: 9, itemStyle: { color: BAD } },
      { type: 'line', data: [null, 100, null, 82, null], lineStyle: { width: 2, type: 'dotted', color: MUTED }, symbol: 'none',
        markLine: { symbol: 'none', silent: true,
          data: [{ yAxis: 95, lineStyle: { color: WARN, type: 'dashed', width: 2 } }],
          label: { formatter: 'stop level 95 — where you planned to exit', position: 'insideEndBottom', fontSize: 12, color: WARN } } },
    ],
    graphic: [
      { type: 'text', left: 'center', top: 150, style: { text: 'no trade happens between 95 and 82', fill: BAD, fontSize: 14, fontWeight: 600, align: 'center' } },
      { type: 'text', left: 'center', top: 174, style: { text: 'planned loss 5 · actual loss 18', fill: MUTED, fontSize: 12, align: 'center' } },
    ],
  }),

  // Ce qu'un ordre stop et un stop-limite font une fois franchis.
  stop_vs_stop_limit: () => ({
    ...base(),
    grid: { left: 150, right: 60, top: 34, bottom: 46 },
    xAxis: noUnitAxis('outcome'),
    yAxis: { type: 'category', data: ['Stop-limit: no fill,\nposition still open', 'Stop: fills at the\nnext available price'], axisLabel: { fontSize: 11, lineHeight: 15 } },
    series: [{ type: 'bar', barWidth: 34, label: { show: true, position: 'right', fontSize: 11, color: INK },
      data: [
        { value: 40, itemStyle: { color: WARN }, label: { formatter: 'you keep the risk' } },
        { value: 85, itemStyle: { color: BAD }, label: { formatter: 'you take the gap' } },
      ] }],
  }),

  // Une courbe des taux et ses trois formes usuelles.
  yield_curve_shapes: () => ({
    ...base(),
    legend: { data: ['normal', 'flat', 'inverted'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 56, right: 40, top: 34, bottom: 56 },
    xAxis: { type: 'category', data: ['3m', '2y', '5y', '10y', '30y'], axisLabel: { fontSize: 11 } },
    yAxis: noUnitAxis('yield'),
    series: [
      { name: 'normal', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: GOOD }, data: [20, 34, 44, 52, 58] },
      { name: 'flat', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: MUTED }, data: [40, 42, 43, 43, 44] },
      { name: 'inverted', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: BAD }, data: [58, 50, 44, 40, 38] },
    ],
  }),

  // Le profil de gain d'une option achetée, à l'échéance.
  option_payoff: () => ({
    ...base(),
    xAxis: { type: 'category', data: ['', '', 'strike', '', '', ''], axisLabel: { fontSize: 11, color: MUTED }, axisTick: { show: false } },
    yAxis: noUnitAxis('profit / loss'),
    series: [{ type: 'line', step: false, symbol: 'none', lineStyle: { width: 3, color: ACCENT },
      data: [-20, -20, -20, 10, 40, 70],
      areaStyle: { color: 'rgba(14,165,233,0.10)' },
      markLine: { symbol: 'none', silent: true, data: [{ yAxis: 0, lineStyle: { color: MUTED, type: 'dashed' } }] } }],
    graphic: [{ type: 'text', left: 90, top: 'middle', style: { text: 'premium paid — the most\nyou can lose', fill: MUTED, fontSize: 11, lineHeight: 15 } }],
  }),

  // Ce que des frais annuels font à un capital sur la durée.
  fee_drag: () => ({
    ...base(),
    legend: { data: ['no fee', 'with an annual fee'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 56, right: 40, top: 34, bottom: 56 },
    xAxis: { type: 'category', data: ['start', '5y', '10y', '15y', '20y', '25y'], axisLabel: { fontSize: 11 } },
    yAxis: noUnitAxis('capital'),
    series: [
      { name: 'no fee', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: GOOD }, data: [100, 128, 163, 208, 265, 339] },
      { name: 'with an annual fee', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: BAD }, data: [100, 124, 154, 191, 237, 294],
        areaStyle: { color: 'rgba(220,38,38,0.08)' } },
    ],
    graphic: [{ type: 'text', right: 60, top: 90, style: { text: 'the gap widens with time,\nnot with performance', fill: MUTED, fontSize: 11, lineHeight: 15 } }],
  }),

  // Deux actifs peuvent être décorrélés en moyenne et tomber ensemble le jour qui compte.
  correlation_breaks: () => ({
    ...base(),
    xAxis: { type: 'category', data: ['calm', 'calm', 'calm', 'stress', 'calm', 'calm'], axisLabel: { fontSize: 11, color: MUTED } },
    yAxis: { ...noUnitAxis('correlation'), min: -0.4, max: 1, axisLabel: { show: true, fontSize: 10, color: MUTED } },
    series: [{ type: 'line', smooth: true, symbolSize: 9, lineStyle: { width: 3, color: ACCENT }, itemStyle: { color: ACCENT },
      data: [0.05, -0.1, 0.12, 0.88, 0.2, 0.08],
      markPoint: { symbolSize: 46, data: [{ coord: ['stress', 0.88], value: '↑' }], itemStyle: { color: BAD }, label: { fontSize: 14, color: '#fff' } } }],
    graphic: [{ type: 'text', left: 'center', top: 30, style: { text: 'diversification is measured in calm and spent in stress', fill: MUTED, fontSize: 12 } }],
  }),

  // Le chemin d'une décision : du fait à l'ordre, sans court-circuit.
  decision_flow: () => flowDiagram({
    nodes: [
      { x: 170, y: 130, w: 210, h: 70, label: 'Fact\nobserved, dated', color: MUTED },
      { x: 568, y: 130, w: 210, h: 70, label: 'Decision\nrule applied', color: ACCENT },
      { x: 966, y: 130, w: 210, h: 70, label: 'Order\nsized, protected', color: GOOD },
    ],
    links: [[0, 1], [1, 2]],
    caption: 'each object is separate — collapsing them is what makes a mistake impossible to trace',
  }),

  // Ce qu'une taille de position fait à une perte, à risque unitaire constant.
  position_sizing: () => ({
    ...base(),
    grid: { left: 70, right: 50, top: 34, bottom: 46 },
    xAxis: { type: 'category', data: ['1×', '2×', '3×', '4×', '5×'], name: 'position size', nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: 10, color: MUTED }, axisLabel: { fontSize: 11 } },
    yAxis: noUnitAxis('loss if the stop gaps'),
    series: [{ type: 'bar', barWidth: 40,
      data: [1, 2, 3, 4, 5].map((v, i) => ({ value: v, itemStyle: { color: i < 2 ? GOOD : i < 3 ? WARN : BAD } })),
      markLine: { symbol: 'none', silent: true, data: [{ yAxis: 2.6, lineStyle: { color: BAD, type: 'dashed', width: 2 } }],
        label: { formatter: 'the level you cannot recover from', position: 'insideEndTop', fontSize: 11, color: BAD } } }],
  }),

  // Une saisonnalité observée n'est pas une prévision.
  seasonality_caution: () => ({
    ...base(),
    xAxis: { type: 'category', data: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], axisLabel: { fontSize: 11 } },
    yAxis: noUnitAxis('average outcome'),
    series: [{ type: 'bar', data: [3, -1, 2, 4, 1, -2, 2, -1, -4, 3, 5, 4].map(v => ({ value: v, itemStyle: { color: v >= 0 ? GOOD : BAD } })) }],
    graphic: [{ type: 'text', left: 'center', top: 26, style: { text: 'a pattern over a few dozen observations is a hypothesis, not a rule', fill: MUTED, fontSize: 12 } }],
  }),

  // La transmission d'une décision de banque centrale, du taux au prix des actifs.
  policy_transmission: () => flowDiagram({
    nodes: [
      { x: 118, y: 130, w: 180, h: 64, label: 'Policy rate', color: INK },
      { x: 420, y: 70, w: 190, h: 60, label: 'Short yields', color: ACCENT },
      { x: 420, y: 196, w: 190, h: 60, label: 'Expectations', color: ACCENT },
      { x: 728, y: 130, w: 180, h: 64, label: 'Long yields', color: WARN },
      { x: 1010, y: 130, w: 180, h: 64, label: 'Asset prices', color: GOOD },
    ],
    links: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
    caption: 'the decision moves the near end; the far end moves on what the decision implies',
  }),

  // Un journal de bord : ce qui se mesure d'une série de décisions.
  journal_loop: () => flowDiagram({
    nodes: [
      { x: 200, y: 74, w: 190, h: 60, label: 'Plan', color: ACCENT },
      { x: 640, y: 74, w: 190, h: 60, label: 'Execute', color: INK },
      { x: 640, y: 196, w: 190, h: 60, label: 'Record', color: MUTED },
      { x: 200, y: 196, w: 190, h: 60, label: 'Revise', color: GOOD },
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 0]],
    caption: 'without the record, the loop is just repetition',
  }),

  // Un actif à bêta élevé amplifie dans les deux sens.
  high_beta: () => ({
    ...base(),
    legend: { data: ['the market', 'a high-beta proxy'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 56, right: 40, top: 34, bottom: 56 },
    xAxis: { type: 'category', data: ['', '', '', '', '', '', '', ''], axisLabel: { show: false } },
    yAxis: noUnitAxis('cumulative move'),
    series: [
      { name: 'the market', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: MUTED }, data: [0, 4, 7, 3, 8, 5, 9, 6] },
      { name: 'a high-beta proxy', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: ACCENT }, data: [0, 11, 19, 4, 22, 9, 26, 12] },
    ],
    graphic: [{ type: 'text', left: 'center', top: 26, style: { text: 'the amplification is symmetric — it is not an edge, it is a size decision', fill: MUTED, fontSize: 12 } }],
  }),

  // Un calendrier : ce qui est daté à l'avance et ce qui ne l'est pas.
  calendar_certainty: () => ({
    ...base(),
    grid: { left: 190, right: 60, top: 20, bottom: 40 },
    xAxis: noUnitAxis('how far ahead the date is known'),
    yAxis: { type: 'category', data: ['Unscheduled news', 'Company results', 'Central bank decision', 'Statistical release'], axisLabel: { fontSize: 11 } },
    series: [{ type: 'bar', barWidth: 26,
      data: [
        { value: 3, itemStyle: { color: BAD } },
        { value: 45, itemStyle: { color: WARN } },
        { value: 88, itemStyle: { color: GOOD } },
        { value: 95, itemStyle: { color: GOOD } },
      ] }],
    graphic: [{ type: 'text', left: 'center', bottom: 10, style: { text: 'what an authority publishes a year ahead should never be read from a data feed', fill: MUTED, fontSize: 12 } }],
  }),
};

module.exports = { SCHEMATICS, PALETTE: { INK, MUTED, GRID, BAD, GOOD, ACCENT, WARN } };
