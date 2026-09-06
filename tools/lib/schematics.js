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

  // ── deuxième vague ────────────────────────────────────────────────────────
  // Ajoutée après avoir constaté que 75 des 129 épisodes n'avaient aucune figure pertinente :
  // treize schémas ne couvrent pas quinze séries. Chacun vise un mécanisme récurrent du corpus.

  // Un emballage n'est pas une exposition : ce qu'on détient vraiment est en dessous.
  exposure_lookthrough: () => ({
    ...base(),
    grid: { left: 170, right: 60, top: 20, bottom: 44 },
    xAxis: { ...noUnitAxis('share of the real exposure'), axisLabel: { show: false } },
    yAxis: { type: 'category', data: ['Everything else', 'Third bet', 'Second bet', 'The one bet you own'], axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', barWidth: 30, data: [
      { value: 8, itemStyle: { color: GRID } },
      { value: 12, itemStyle: { color: MUTED } },
      { value: 22, itemStyle: { color: ACCENT } },
      { value: 58, itemStyle: { color: BAD } },
    ] }],
    graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: 'many tickers, one exposure — count the bet, not the line items', fill: MUTED, fontSize: 12 } }],
  }),

  // Le décalage entre le moment où un fait existe et celui où il devient public.
  information_clock: () => flowDiagram({
    nodes: [
      { x: 150, y: 130, w: 200, h: 64, label: 'It happens', color: INK },
      { x: 470, y: 130, w: 200, h: 64, label: 'It is filed', color: ACCENT },
      { x: 790, y: 130, w: 200, h: 64, label: 'It is published', color: WARN },
      { x: 1040, y: 130, w: 170, h: 64, label: 'You read it', color: GOOD },
    ],
    links: [[0, 1], [1, 2], [2, 3]],
    caption: 'every step costs time — a position snapshot describes a past you can no longer trade',
  }),

  // Le drawdown décrit un chemin, pas un point d'arrivée.
  drawdown_path: () => ({
    ...base(),
    xAxis: { type: 'category', data: new Array(12).fill(''), axisLabel: { show: false } },
    yAxis: noUnitAxis('equity'),
    series: [{ type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: INK },
      data: [100, 112, 104, 118, 96, 88, 92, 84, 97, 108, 116, 122],
      areaStyle: { color: 'rgba(15,23,42,0.05)' },
      markLine: { symbol: 'none', silent: true, data: [{ yAxis: 118, lineStyle: { color: GOOD, type: 'dashed' } }, { yAxis: 84, lineStyle: { color: BAD, type: 'dashed' } }],
        label: { fontSize: 11 } } }],
    graphic: [{ type: 'text', left: 'center', top: 40, style: { text: 'same start, same finish — the path is what you had to live through', fill: MUTED, fontSize: 12 } }],
  }),

  // Une échelle de renforcement décidée à l'avance, pas au fil de l'émotion.
  scaling_ladder: () => ({
    ...base(),
    xAxis: { type: 'category', data: ['entry', 'proof 1', 'proof 2', 'proof 3'], axisLabel: { fontSize: 12 } },
    yAxis: noUnitAxis('position size'),
    series: [{ type: 'bar', barWidth: 46, data: [
      { value: 25, itemStyle: { color: ACCENT } },
      { value: 50, itemStyle: { color: ACCENT } },
      { value: 75, itemStyle: { color: GOOD } },
      { value: 100, itemStyle: { color: GOOD } },
    ], label: { show: true, position: 'top', fontSize: 11, formatter: '{c}%' } }],
    graphic: [{ type: 'text', left: 'center', top: 34, style: { text: 'each step is bought with evidence, and each one is written down before the trade', fill: MUTED, fontSize: 12 } }],
  }),

  // Le régime de marché est un filtre d'entrée, pas une prévision.
  regime_map: () => ({
    ...base(),
    grid: { left: 150, right: 60, top: 20, bottom: 44 },
    xAxis: { ...noUnitAxis('what the regime permits'), axisLabel: { show: false } },
    yAxis: { type: 'category', data: ['Risk-off', 'Neutral', 'Risk-on'], axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', barWidth: 34, label: { show: true, position: 'right', fontSize: 11, color: INK }, data: [
      { value: 25, itemStyle: { color: BAD }, label: { formatter: 'protect first' } },
      { value: 55, itemStyle: { color: WARN }, label: { formatter: 'smaller, fewer' } },
      { value: 90, itemStyle: { color: GOOD }, label: { formatter: 'full size allowed' } },
    ] }],
    graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: 'the regime sets the ceiling on risk — it never tells you which way the market goes', fill: MUTED, fontSize: 12 } }],
  }),

  // Chaque couche doit échouer sans mentir à celle du dessus.
  layers_fail_safe: () => flowDiagram({
    nodes: [
      { x: 160, y: 74, w: 210, h: 60, label: 'Data layer', color: MUTED },
      { x: 570, y: 74, w: 210, h: 60, label: 'Decision layer', color: ACCENT },
      { x: 980, y: 74, w: 210, h: 60, label: 'Execution layer', color: GOOD },
      { x: 570, y: 196, w: 260, h: 60, label: 'Fails loudly, returns nothing', color: BAD },
    ],
    links: [[0, 1], [1, 2], [0, 3]],
    caption: 'a layer that returns a plausible value when it failed is worse than one that stops',
  }),

  // L'inflation se lit en couches, pas en un seul chiffre.
  inflation_layers: () => ({
    ...base(),
    legend: { data: ['headline', 'core', 'the component that moved'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 56, right: 40, top: 34, bottom: 56 },
    xAxis: { type: 'category', data: ['', '', '', '', '', ''], axisLabel: { show: false } },
    yAxis: noUnitAxis('rate'),
    series: [
      { name: 'headline', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: INK }, data: [30, 34, 28, 40, 33, 44] },
      { name: 'core', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: ACCENT }, data: [31, 31, 30, 30, 29, 29] },
      { name: 'the component that moved', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: WARN, type: 'dashed' }, data: [28, 45, 20, 62, 40, 78] },
    ],
    graphic: [{ type: 'text', left: 'center', top: 26, style: { text: 'the headline is an average — the decision lives in the layer that moved it', fill: MUTED, fontSize: 12 } }],
  }),

  // Un écart n'est une seule opération que si chaque jambe est tenue.
  spread_legs: () => flowDiagram({
    nodes: [
      { x: 190, y: 74, w: 220, h: 60, label: 'Leg A filled', color: GOOD },
      { x: 190, y: 196, w: 220, h: 60, label: 'Leg B not filled', color: BAD },
      { x: 700, y: 130, w: 300, h: 70, label: 'You now hold a position\nyou never chose', color: WARN },
    ],
    links: [[0, 2], [1, 2]],
    caption: 'a spread is one trade only while both legs exist — otherwise it is a naked position',
  }),

  // Ce qu'un backtest prouve, et ce que seul le temps réel prouve.
  forward_vs_backtest: () => ({
    ...base(),
    legend: { data: ['backtest', 'forward, live'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 56, right: 40, top: 34, bottom: 56 },
    xAxis: { type: 'category', data: ['', '', '', '', '', '', '', ''], axisLabel: { show: false } },
    yAxis: noUnitAxis('cumulative result'),
    series: [
      { name: 'backtest', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: MUTED, type: 'dashed' }, data: [0, 9, 18, 27, 36, 45, 54, 63] },
      { name: 'forward, live', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 3, color: ACCENT }, data: [0, 4, 2, 9, 6, 12, 8, 15] },
    ],
    graphic: [{ type: 'text', left: 'center', top: 26, style: { text: 'the straight line is the one you fitted; the rough one is the one you will live', fill: MUTED, fontSize: 12 } }],
  }),

  // Un ordre a des états, et on ne saute pas d'état.
  order_state_machine: () => flowDiagram({
    nodes: [
      { x: 130, y: 130, w: 170, h: 58, label: 'Intended', color: MUTED },
      { x: 400, y: 130, w: 170, h: 58, label: 'Placed', color: ACCENT },
      { x: 670, y: 74, w: 170, h: 58, label: 'Filled', color: GOOD },
      { x: 670, y: 196, w: 170, h: 58, label: 'Rejected', color: BAD },
      { x: 960, y: 130, w: 190, h: 58, label: 'Reconciled', color: INK },
    ],
    links: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4]],
    caption: 'every order ends reconciled — an unknown state is an open risk nobody is watching',
  }),

  // Un registre en ajout seul : on corrige en ajoutant, jamais en effaçant.
  append_only_ledger: () => ({
    ...base(),
    grid: { left: 130, right: 60, top: 20, bottom: 44 },
    xAxis: { ...noUnitAxis('time'), axisLabel: { show: false } },
    yAxis: { type: 'category', data: ['Correction', 'Decision 3', 'Decision 2', 'Decision 1'], axisLabel: { fontSize: 12 } },
    series: [{ type: 'bar', barWidth: 26, data: [
      { value: 95, itemStyle: { color: GOOD } },
      { value: 72, itemStyle: { color: ACCENT } },
      { value: 48, itemStyle: { color: ACCENT } },
      { value: 24, itemStyle: { color: ACCENT } },
    ] }],
    graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: 'a mistake is superseded by a new entry — nothing is ever rewritten or removed', fill: MUTED, fontSize: 12 } }],
  }),

  // Le taux de réussite qu'un rapport gain/risque donné exige pour ne rien perdre.
  //
  // Figure née de l'incident du 2026-09-06 : un panier publié affichait un rapport voisin de 1
  // présenté comme une lecture du marché, alors qu'il sortait d'une formule. À 1 pour 1, il faut
  // avoir raison une fois sur deux avant frais — ce que la courbe rend évident et qu'une phrase
  // laisse passer.
  rr_vs_winrate: () => ({
    ...base(),
    grid: { left: 62, right: 50, top: 34, bottom: 50 },
    xAxis: { type: 'category', data: ['0.5', '0.7', '1.0', '1.5', '2.0', '3.0', '4.0'], name: 'reward / risk', nameLocation: 'middle', nameGap: 28, nameTextStyle: { fontSize: 11, color: MUTED }, axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', min: 0, max: 80, name: 'win rate needed to break even', nameTextStyle: { fontSize: 10, color: MUTED }, axisLabel: { fontSize: 11, color: MUTED, formatter: '{value}%' }, splitLine: { lineStyle: { color: GRID } } },
    series: [{ type: 'line', smooth: true, symbolSize: 10, lineStyle: { width: 3, color: ACCENT }, itemStyle: { color: ACCENT },
      data: [67, 59, 50, 40, 33, 25, 20],
      label: { show: true, fontSize: 11, formatter: '{c}%' },
      areaStyle: { color: 'rgba(14,165,233,0.08)' } }],
    graphic: [{ type: 'text', left: 'center', top: 30, style: { text: 'before costs — a one-to-one trade must be right half the time just to stand still', fill: MUTED, fontSize: 12 } }],
  }),

  // La distribution des résultats compte plus que leur moyenne.
  r_distribution: () => ({
    ...base(),
    xAxis: { type: 'category', data: ['−1R', '−0.5R', '0R', '+1R', '+2R', '+3R', '+6R'], axisLabel: { fontSize: 12 } },
    yAxis: noUnitAxis('how often'),
    series: [{ type: 'bar', barWidth: 46, data: [
      { value: 34, itemStyle: { color: BAD } },
      { value: 18, itemStyle: { color: BAD } },
      { value: 14, itemStyle: { color: MUTED } },
      { value: 16, itemStyle: { color: GOOD } },
      { value: 9, itemStyle: { color: GOOD } },
      { value: 5, itemStyle: { color: GOOD } },
      { value: 4, itemStyle: { color: GOOD } },
    ] }],
    graphic: [{ type: 'text', left: 'center', top: 30, style: { text: 'losing more often than you win can still be profitable — the right tail pays for the left', fill: MUTED, fontSize: 12 } }],
  }),

  // Ce qui se scelle est la preuve, pas le récit qu'on en fait.
  evidence_chain: () => flowDiagram({
    nodes: [
      { x: 150, y: 74, w: 210, h: 60, label: 'Raw source', color: MUTED },
      { x: 560, y: 74, w: 210, h: 60, label: 'Hashed, dated', color: ACCENT },
      { x: 970, y: 74, w: 210, h: 60, label: 'Decision', color: GOOD },
      { x: 560, y: 196, w: 250, h: 60, label: 'The story you tell', color: BAD },
    ],
    links: [[0, 1], [1, 2], [2, 3]],
    caption: 'seal the evidence, never the narrative — a hash proves where a number came from, not that it is right',
  }),
};

module.exports = { SCHEMATICS, PALETTE: { INK, MUTED, GRID, BAD, GOOD, ACCENT, WARN } };
