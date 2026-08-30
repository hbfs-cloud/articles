#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const rel = (file) => path.join("weekly/20260831", file);
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const sha = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, file)))
    .digest("hex");

const sources = {
  indices: rel("_data/bars_indices.json"),
  sectors: rel("_data/bars_sectors.json"),
  crypto: rel("_data/bars_crypto.json"),
  options: rel("_data/options_sentiment.json"),
  regime: rel("_data/regime_systematic.json"),
  earnings: rel("_data/earnings_calendar.json"),
  systemic: rel("_data/earnings_systemic.json"),
  economic: rel("_data/economic_events.json"),
  fundamentals: rel("_focus/focus_fundamentals.json"),
  technicals: rel("_focus/focus_technicals.json"),
  focusBars: rel("_focus/focus_bars.json"),
  blastBars: rel("_focus/blast_bars.json"),
  avgoOptions: "analyses/AVGO/_data/options.json",
};
const data = Object.fromEntries(
  Object.entries(sources).map(([name, file]) => [name, read(file)]),
);
const hashes = Object.fromEntries(
  Object.entries(sources).map(([name, file]) => [name, sha(file)]),
);
const claims = [];

function pointerGet(value, pointer) {
  return pointer
    .slice(1)
    .split("/")
    .reduce(
      (node, raw) => node[raw.replace(/~1/g, "/").replace(/~0/g, "~")],
      value,
    );
}

function numericClaim(id, source, pointer, render) {
  const value = pointerGet(data[source], pointer);
  if (!Number.isFinite(Number(value)))
    throw new Error(`Claim ${id}: non-numeric value at ${source}${pointer}`);
  const normalizedRender = { ...render, scale: render.scale ?? 1 };
  const scaled = Number(value) * normalizedRender.scale;
  const sign = normalizedRender.sign === "always" && scaled >= 0 ? "+" : "";
  const rendered = `${normalizedRender.prefix || ""}${sign}${scaled.toFixed(normalizedRender.decimals)}${normalizedRender.suffix || ""}`;
  claims.push({
    id,
    source_artifact: sources[source],
    source_sha256: hashes[source],
    source_pointer: pointer,
    source_value: value,
    render: normalizedRender,
    rendered_text: rendered,
  });
  return `<span data-claim="${id}">${rendered}</span>`;
}

function formulaClaim(id, source, formula, render) {
  if (formula.operation !== "sum_divide_pct")
    throw new Error(`Claim ${id}: unsupported formula`);
  const operands = formula.operand_pointers.map((pointer) => ({
    pointer,
    value: Number(pointerGet(data[source], pointer)),
  }));
  const denominator = Number(pointerGet(data[source], formula.denominator_pointer));
  if (!operands.every((item) => Number.isFinite(item.value)) || !Number.isFinite(denominator) || denominator === 0)
    throw new Error(`Claim ${id}: invalid formula operands`);
  const value = operands.reduce((sum, item) => sum + item.value, 0) / denominator * 100;
  const normalizedRender = { ...render, scale: render.scale ?? 1 };
  const scaled = value * normalizedRender.scale;
  const rendered = `${normalizedRender.prefix || ""}${scaled.toFixed(normalizedRender.decimals)}${normalizedRender.suffix || ""}`;
  claims.push({
    id,
    source_artifact: sources[source],
    source_sha256: hashes[source],
    source_pointer: formula.denominator_pointer,
    source_value: denominator,
    formula: {
      operation: formula.operation,
      operands,
      denominator_pointer: formula.denominator_pointer,
      result: value,
    },
    render: normalizedRender,
    rendered_text: rendered,
  });
  return `<span data-claim="${id}">${rendered}</span>`;
}

function queryResults(document) {
  return (document.data?.items || []).flatMap((item) => item.results || []);
}

function queryBlock(source, type) {
  const resultIndex = queryResults(data[source]).findIndex(
    (result) => result.data_type === type,
  );
  if (resultIndex < 0) throw new Error(`Missing ${type} in ${source}`);
  const item = data[source].data.items.findIndex((entry) =>
    (entry.results || []).some((result) => result.data_type === type),
  );
  const local = data[source].data.items[item].results.findIndex(
    (result) => result.data_type === type,
  );
  return {
    data: data[source].data.items[item].results[local].data,
    item,
    result: local,
  };
}

function rowClaim(id, source, type, symbol, field, render) {
  const block = queryBlock(source, type);
  const row = block.data.findIndex((value) => value.symbol === symbol);
  if (row < 0) throw new Error(`Missing ${symbol} in ${source}/${type}`);
  return numericClaim(
    id,
    source,
    `/data/items/${block.item}/results/${block.result}/data/${row}/${field}`,
    render,
  );
}

function nestedRowClaim(id, source, type, symbol, suffix, render) {
  const block = queryBlock(source, type);
  const row = block.data.findIndex((value) => value.symbol === symbol);
  if (row < 0) throw new Error(`Missing ${symbol} in ${source}/${type}`);
  return numericClaim(
    id,
    source,
    `/data/items/${block.item}/results/${block.result}/data/${row}/${suffix}`,
    render,
  );
}

function marketBlock(source) {
  return (
    data[source].results.find((result) => result.data_type === "bars_daily") ||
    data[source].results[0]
  );
}

function marketClaim(id, source, symbol, render) {
  const root = marketBlock(source);
  const row = root.symbols.indexOf(symbol);
  const bar = root.data[row].bars.length - 1;
  return numericClaim(
    id,
    source,
    `/results/${data[source].results.indexOf(root)}/data/${row}/bars/${bar}/4`,
    render,
  );
}

function eventIndex(symbol, source = "earnings") {
  return data[source].events.findIndex((event) => event.symbol === symbol);
}

function earningsMoveClaim(id, symbol) {
  const row = eventIndex(symbol, "earnings");
  return numericClaim(id, "earnings", `/events/${row}/implied_move_pct`, {
    decimals: 1,
    suffix: " %",
  });
}

function arrayBarMap(source) {
  const root = marketBlock(source);
  return Object.fromEntries(
    root.symbols.map((symbol, index) => [
      symbol,
      root.data[index].bars.map((bar) => ({
        date: bar[0],
        open: bar[1],
        high: bar[2],
        low: bar[3],
        close: bar[4],
        volume: bar[5],
      })),
    ]),
  );
}

function queryBarMap(source) {
  const block = queryBlock(source, "bars_daily").data;
  return Object.fromEntries(
    block.map((row) => [
      row.symbol,
      row.bars.map((bar) =>
        Array.isArray(bar)
          ? {
              date: bar[0],
              open: bar[1],
              high: bar[2],
              low: bar[3],
              close: bar[4],
              volume: bar[5],
            }
          : {
              date: bar.date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.adj_close ?? bar.close,
              volume: bar.volume,
            },
      ),
    ]),
  );
}

const marketBars = {
  ...arrayBarMap("indices"),
  ...arrayBarMap("sectors"),
  ...arrayBarMap("crypto"),
};
const focusBars = queryBarMap("focusBars");
const blastBars = queryBarMap("blastBars");

function pct(symbol, sessions, map = blastBars) {
  const rows = map[symbol] || [];
  if (rows.length <= sessions) return null;
  return (rows.at(-1).close / rows.at(-1 - sessions).close - 1) * 100;
}

function correlation(aSymbol, bSymbol, map = blastBars) {
  const a = new Map((map[aSymbol] || []).map((row) => [row.date, row.close]));
  const b = new Map((map[bSymbol] || []).map((row) => [row.date, row.close]));
  const dates = [...a.keys()].filter((date) => b.has(date)).sort();
  const x = [];
  const y = [];
  for (let i = 1; i < dates.length; i += 1) {
    const prev = dates[i - 1];
    const now = dates[i];
    x.push(Math.log(a.get(now) / a.get(prev)));
    y.push(Math.log(b.get(now) / b.get(prev)));
  }
  if (x.length < 20) return null;
  const avg = (values) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = avg(x);
  const my = avg(y);
  const cov = x.reduce((sum, value, i) => sum + (value - mx) * (y[i] - my), 0);
  const sx = Math.sqrt(x.reduce((sum, value) => sum + (value - mx) ** 2, 0));
  const sy = Math.sqrt(y.reduce((sum, value) => sum + (value - my) ** 2, 0));
  return sx && sy ? cov / (sx * sy) : null;
}

function movingAverage(rows, period) {
  return rows.map((row, index) => {
    if (index + 1 < period) return [row.date, null];
    const window = rows.slice(index + 1 - period, index + 1);
    return [
      row.date,
      window.reduce((sum, item) => sum + item.close, 0) / period,
    ];
  });
}

const roles = {
  AVGO: ["Catalyseur", 0],
  NVDA: ["Leader GPU", 1],
  AMD: ["Alternative GPU", 1],
  MRVL: ["ASIC et réseau", 1],
  ANET: ["Réseau IA", 1],
  CRDO: ["Interconnexion", 1],
  CIEN: ["Optique", 1],
  TSM: ["Fonderie", 2],
  MU: ["Mémoire", 2],
  KLAC: ["Équipement", 2],
  DELL: ["Serveurs", 3],
  HPE: ["Serveurs", 3],
  CEG: ["Électricité", 4],
  VST: ["Électricité", 4],
  GEV: ["Réseau électrique", 4],
  SOXX: ["Indice semis", 2],
};
const blastMetrics = Object.keys(roles).map((symbol) => ({
  symbol,
  role: roles[symbol][0],
  order: roles[symbol][1],
  correlation: symbol === "AVGO" ? 1 : correlation("AVGO", symbol),
  performance5d: pct(symbol, 5),
  performance21d: pct(symbol, 21),
}));

const avgoFinancial = queryBlock("fundamentals", "financials").data.find(
  (row) => row.symbol === "AVGO",
);
const avgoStats = queryBlock("fundamentals", "stats").data.find(
  (row) => row.symbol === "AVGO",
);
const avgoSurprises = queryBlock(
  "fundamentals",
  "earnings_surprises",
).data.find((row) => row.symbol === "AVGO");
const avgoReactions = queryBlock(
  "fundamentals",
  "earnings_reactions",
).data.find((row) => row.symbol === "AVGO");
const avgoTechnical = queryBlock("technicals", "technicals").data.find(
  (row) => row.symbol === "AVGO",
);
const avgoQuote = queryBlock("technicals", "quote").data.find(
  (row) => row.symbol === "AVGO",
);
const economic = data.economic.results.find(
  (result) => result.data_type === "economic_events",
).data.events;
const weekEvents = economic.filter(
  (event) =>
    event.event_time.slice(0, 10) >= "2026-08-31" &&
    event.event_time.slice(0, 10) <= "2026-09-04",
);

const derivedPath = rel("_data/derived-weekly.json");
const derived = {
  schema_version: 1,
  reference_close: "2026-08-28",
  methodology: {
    correlation:
      "Pearson correlation of aligned daily log returns from collected adjusted bars; raw, not market-neutralised.",
    performance: "Close-to-close return over 5 and 21 completed US sessions.",
    moving_averages:
      "Simple moving averages calculated from the same daily close series.",
  },
  blast_metrics: blastMetrics,
  avgo_moving_averages: {
    ema20_last_from_mcp: avgoTechnical.ema20,
    ema50_last_from_mcp: avgoTechnical.ema50,
    sma20_series: movingAverage(focusBars.AVGO, 20),
    sma50_series: movingAverage(focusBars.AVGO, 50),
  },
};
fs.writeFileSync(
  path.join(ROOT, derivedPath),
  JSON.stringify(derived, null, 2) + "\n",
);
sources.derived = derivedPath;
data.derived = derived;
hashes.derived = sha(derivedPath);

const money = { decimals: 2, suffix: " $" };
const pctOne = { decimals: 1, suffix: " %" };
const compactB = { scale: 1 / 1e9, decimals: 1, suffix: " Md$" };
const compactT = { scale: 1 / 1e12, decimals: 2, suffix: " T$" };
const avgoPrice = rowClaim(
  "avgo_price",
  "technicals",
  "quote",
  "AVGO",
  "price",
  money,
);
const avgoMcap = rowClaim(
  "avgo_mcap",
  "technicals",
  "quote",
  "AVGO",
  "marketCap",
  compactT,
);
const avgoRsi = rowClaim(
  "avgo_rsi",
  "technicals",
  "technicals",
  "AVGO",
  "rsi",
  { decimals: 1 },
);
const avgoEma20 = rowClaim(
  "avgo_ema20",
  "technicals",
  "technicals",
  "AVGO",
  "ema20",
  money,
);
const avgoEma50 = rowClaim(
  "avgo_ema50",
  "technicals",
  "technicals",
  "AVGO",
  "ema50",
  money,
);
const avgoRevenue = rowClaim(
  "avgo_revenue",
  "fundamentals",
  "financials",
  "AVGO",
  "totalRevenue",
  compactB,
);
const avgoGrowth = rowClaim(
  "avgo_growth",
  "fundamentals",
  "financials",
  "AVGO",
  "revenueGrowth",
  { scale: 100, decimals: 1, suffix: " %" },
);
const avgoDebt = rowClaim(
  "avgo_debt",
  "fundamentals",
  "financials",
  "AVGO",
  "totalDebt",
  compactB,
);
const avgoCash = rowClaim(
  "avgo_cash",
  "fundamentals",
  "financials",
  "AVGO",
  "totalCash",
  compactB,
);
const avgoEvRevenue = rowClaim(
  "avgo_ev_revenue",
  "fundamentals",
  "stats",
  "AVGO",
  "enterpriseToRevenue",
  { decimals: 1, suffix: "x" },
);
const avgoBeta = rowClaim(
  "avgo_beta",
  "fundamentals",
  "stats",
  "AVGO",
  "beta",
  { decimals: 2 },
);
const avgoMedianReaction = nestedRowClaim(
  "avgo_median_reaction",
  "fundamentals",
  "earnings_reactions",
  "AVGO",
  "summary/median_abs_move_percent",
  { decimals: 1, suffix: " %" },
);

const marketCards = [
  ["SPY", "Grandes capitalisations", marketClaim("spy_close", "indices", "SPY", money)],
  ["QQQ", "Croissance", marketClaim("qqq_close", "indices", "QQQ", money)],
  ["IWM", "Petites caps", marketClaim("iwm_close", "indices", "IWM", money)],
  ["GLD", "Or", marketClaim("gld_close", "indices", "GLD", money)],
  ["TLT", "Taux longs", marketClaim("tlt_close", "indices", "TLT", money)],
  ["IBIT", "Bitcoin coté", marketClaim("ibit_close", "crypto", "IBIT", money)],
];
const marketCardsHtml = marketCards
  .map(
    ([ticker, label, value]) =>
      `<div class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${ticker} · ${label}</div></div>`,
  )
  .join("");

const eventRows = [
  [
    "Lundi",
    "Inflation zone euro",
    "Préparer les scénarios ; aucune anticipation AVGO.",
  ],
  [
    "Mardi",
    "ISM industrie · DELL, PANW, MDB, CRDO après clôture",
    "Lire matériel, données et cybersécurité séparément.",
  ],
  [
    "Mercredi",
    "AVGO, SNOW et HPE après clôture",
    "AVGO devient le test systémique du calcul sur mesure et du réseau.",
  ],
  [
    "Jeudi",
    "Allocations, ISM services, Fed · CIEN avant, ZS après",
    "Confirmer ou rejeter la diffusion des investissements IA.",
  ],
  [
    "Vendredi",
    "Rapport emploi US",
    "Les taux peuvent renverser toute lecture micro.",
  ],
];
const eventRowsHtml = eventRows
  .map(
    (row) =>
      `<tr><td><strong>${row[0]}</strong></td><td>${row[1]}</td><td>${row[2]}</td></tr>`,
  )
  .join("");

const earningsSymbols = [
  "DELL",
  "PANW",
  "MDB",
  "CRDO",
  "AVGO",
  "SNOW",
  "HPE",
  "CIEN",
  "ZS",
];
const descriptions = {
  DELL: "Serveurs et marge IA",
  PANW: "Budgets cyber",
  MDB: "Données applicatives",
  CRDO: "Interconnexion IA",
  AVGO: "ASIC sur mesure + réseau",
  SNOW: "Consommation cloud",
  HPE: "Infrastructure entreprise",
  CIEN: "Optique datacenter",
  ZS: "Sécurité cloud",
};
const allEarnings = [
  ...data.earnings.events,
  ...data.systemic.events.filter(
    (item) =>
      !data.earnings.events.some((current) => current.symbol === item.symbol),
  ),
];
const avgoOptionRoot = data.avgoOptions.data.items[0].results.find(
  (result) => result.data_type === "options_chain",
).data[0];
const avgoEventExpiry = "2026-09-04";
const avgoAtmStrike = 370;
const avgoCallIndex = avgoOptionRoot.contracts.findIndex(
  (contract) => contract.expiry === avgoEventExpiry && contract.strike === avgoAtmStrike && contract.option_type === "call",
);
const avgoPutIndex = avgoOptionRoot.contracts.findIndex(
  (contract) => contract.expiry === avgoEventExpiry && contract.strike === avgoAtmStrike && contract.option_type === "put",
);
if (avgoCallIndex < 0 || avgoPutIndex < 0)
  throw new Error("Missing AVGO post-earnings ATM straddle");
const avgoMoveValue = (
  avgoOptionRoot.contracts[avgoCallIndex].mid + avgoOptionRoot.contracts[avgoPutIndex].mid
) / avgoOptionRoot.spot * 100;
const avgoMove = formulaClaim("avgo_indicative_move", "avgoOptions", {
  operation: "sum_divide_pct",
  operand_pointers: [
    `/data/items/0/results/0/data/0/contracts/${avgoCallIndex}/mid`,
    `/data/items/0/results/0/data/0/contracts/${avgoPutIndex}/mid`,
  ],
  denominator_pointer: "/data/items/0/results/0/data/0/spot",
}, { decimals: 1, suffix: " %" });
const earningDay = {
  DELL: "Mardi",
  PANW: "Mardi",
  MDB: "Mardi",
  CRDO: "Mardi",
  AVGO: "Mercredi",
  SNOW: "Mercredi",
  HPE: "Mercredi",
  CIEN: "Jeudi",
  ZS: "Jeudi",
};
const earningsRowsHtml = earningsSymbols
  .map((symbol) => {
    const event = allEarnings.find((item) => item.symbol === symbol);
    const validMove =
      event?.implied_move_status === "available" &&
      event.implied_move_expiration >= event.report_date;
    const move =
      symbol === "AVGO"
        ? `<span class="badge badge-yellow">≈ ${avgoMove} · INDICATIF</span>`
        : !validMove
          ? '<span class="badge badge-yellow">NON MESURABLE</span>'
        : earningsMoveClaim(`${symbol.toLowerCase()}_move`, symbol);
    const when = `${earningDay[symbol]} · ${event.report_time === "AMC" ? "après clôture" : "avant ouverture"}`;
    return `<tr class="${symbol === "AVGO" ? "focus-row" : ""}"><td><strong>${symbol}</strong></td><td>${when}</td><td>${descriptions[symbol]}</td><td>${move}</td></tr>`;
  })
  .join("");

const reactionLabels = [
  "Dernière",
  "Précédente",
  "Antérieure A",
  "Antérieure B",
  "Antérieure C",
  "Antérieure D",
];
const reactionRows = avgoReactions.reactions
  .slice(0, 6)
  .map((item, index) => {
    const move = nestedRowClaim(
      `avgo_reaction_${index}_move`,
      "fundamentals",
      "earnings_reactions",
      "AVGO",
      `reactions/${index}/move_percent`,
      { decimals: 1, sign: "always", suffix: " %" },
    );
    const gap = nestedRowClaim(
      `avgo_reaction_${index}_gap`,
      "fundamentals",
      "earnings_reactions",
      "AVGO",
      `reactions/${index}/gap_percent`,
      { decimals: 1, sign: "always", suffix: " %" },
    );
    const volume = nestedRowClaim(
      `avgo_reaction_${index}_volume`,
      "fundamentals",
      "earnings_reactions",
      "AVGO",
      `reactions/${index}/volume_ratio`,
      { decimals: 1, suffix: "x" },
    );
    return `<tr><td>${reactionLabels[index]}</td><td class="${item.move_percent >= 0 ? "positive" : "negative"}">${move}</td><td>${gap}</td><td>${volume}</td></tr>`;
  })
  .join("");
const avgoLastReaction = nestedRowClaim(
  "avgo_last_reaction_text",
  "fundamentals",
  "earnings_reactions",
  "AVGO",
  "reactions/0/move_percent",
  { decimals: 1, sign: "always", suffix: " %" },
);

const transmission = {
  1: "Premier cercle",
  2: "Deuxième cercle",
  3: "Troisième cercle",
  4: "Quatrième cercle",
};
const blastRows = blastMetrics
  .filter((item) => item.symbol !== "AVGO")
  .sort((a, b) => a.order - b.order || a.symbol.localeCompare(b.symbol))
  .map(
    (item) =>
      `<tr><td><strong>${item.symbol}</strong></td><td>${item.role}</td><td>${transmission[item.order]}</td></tr>`,
  )
  .join("");

const technicalSymbols = [
  "AVGO",
  "DELL",
  "MDB",
  "SNOW",
  "PANW",
  "CRDO",
  "HPE",
  "CIEN",
];
const technicalRowsHtml = technicalSymbols
  .map((symbol) => {
    const quote = queryBlock("technicals", "quote").data.find(
      (row) => row.symbol === symbol,
    );
    const technical = queryBlock("technicals", "technicals").data.find(
      (row) => row.symbol === symbol,
    );
    const state =
      quote.price > technical.ema20
        ? "Au-dessus de la moyenne courte"
        : "Sous la moyenne courte";
    const key = symbol.toLowerCase();
    const price = rowClaim(
      `${key}_technical_price`,
      "technicals",
      "quote",
      symbol,
      "price",
      money,
    );
    const ema = rowClaim(
      `${key}_technical_ema`,
      "technicals",
      "technicals",
      symbol,
      "ema20",
      money,
    );
    const rsi = rowClaim(
      `${key}_technical_rsi`,
      "technicals",
      "technicals",
      symbol,
      "rsi",
      { decimals: 1 },
    );
    return `<tr class="${symbol === "AVGO" ? "focus-row" : ""}"><td><strong>${symbol}</strong></td><td>${price}</td><td>${ema}</td><td>${rsi}</td><td><span class="status-dot ${quote.price > technical.ema20 ? "pass" : "warn"}"></span>${state}</td></tr>`;
  })
  .join("");

const chartPayload = {
  marketBars,
  avgo: focusBars.AVGO,
  avgoSma20: derived.avgo_moving_averages.sma20_series,
  avgoSma50: derived.avgo_moving_averages.sma50_series,
  reactions: avgoReactions.reactions.slice(0, 8).reverse(),
  blast: blastMetrics.map(({ symbol, role, order }) => ({
    symbol,
    role,
    order,
  })),
  validMoves: earningsSymbols.map((symbol) => {
    const event = allEarnings.find((item) => item.symbol === symbol);
    const valid =
      event?.implied_move_status === "available" &&
      event.implied_move_expiration >= event.report_date &&
      symbol !== "AVGO";
    return symbol === "AVGO"
      ? { symbol, value: avgoMoveValue, indicative: true }
      : { symbol, value: valid ? event.implied_move_pct : null, indicative: false };
  }),
};

let html = `<!DOCTYPE html>
<html lang="fr" dir="ltr" data-level="expert" data-tags="us,macro,earnings,ai,semis,cloud,cybersecurity,crypto,gold,etf" data-tab="weekly">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DailyTickers | Hebdo : AVGO, diffusion de l’IA et emploi US</title>
<meta name="description" content="Revue hebdomadaire experte : AVGO devient le test systémique des puces IA sur mesure et du réseau. Rayon de propagation, résultats, emploi US et plan d’action.">
<meta property="og:title" content="AVGO, diffusion de l’IA et emploi US"><meta property="og:description" content="Ce que Broadcom doit confirmer, qui bougera avec lui et comment agir sans poursuivre les écarts d’ouverture."><meta property="og:image" content="https://assets.parqet.com/logos/symbol/AVGO?format=jpg"><meta property="og:url" content="https://articles.dailytickers.com/weekly/20260831/"><meta property="og:type" content="article">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/report.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
.weekly-brief{--ink:#0f172a;--muted:#64748b;--line:#dbe3ee;--blue:#2563eb;--amber:#d97706}.weekly-brief .content-card{border-radius:8px;padding:clamp(1rem,2.4vw,2rem);margin-bottom:1.25rem}.weekly-brief .content-card h2{font-size:clamp(1.35rem,2.4vw,1.9rem);margin-bottom:1rem}.weekly-brief .decision-board{display:grid;grid-template-columns:1.1fr .9fr;gap:1rem;margin-bottom:1.25rem}.weekly-brief .decision-main,.weekly-brief .decision-side{border:1px solid var(--line);border-radius:8px;padding:1rem;background:#fff}.weekly-brief .decision-main{border-left:5px solid var(--amber);background:#fffbeb}.weekly-brief .decision-label{font-size:.72rem;font-weight:800;text-transform:uppercase;color:#92400e}.weekly-brief .decision-main h2{margin:.35rem 0 .55rem;font-size:clamp(1.3rem,3vw,2rem)}.weekly-brief .decision-main p,.weekly-brief .decision-side p{margin:.35rem 0;line-height:1.55}.weekly-brief .decision-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin-top:.9rem}.weekly-brief .mini-stat{border-top:1px solid #f1d59d;padding-top:.55rem}.weekly-brief .mini-stat strong{display:block;font-size:1.05rem}.weekly-brief .mini-stat span{font-size:.72rem;color:var(--muted)}.weekly-brief .check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}.weekly-brief .check-item{display:flex;gap:.55rem;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding:.55rem 0;font-size:.82rem;line-height:1.4}.weekly-brief .check-item i{margin-top:.15rem}.weekly-brief .check-item.pass i{color:#16a34a}.weekly-brief .check-item.warn i{color:#d97706}.weekly-brief .check-item.block i{color:#dc2626}.weekly-brief .chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.weekly-brief .chart-panel{border:1px solid var(--line);border-radius:8px;padding:.8rem;min-width:0;background:#fff}.weekly-brief .chart-panel.wide{grid-column:1/-1}.weekly-brief .chart-title{font-size:.86rem;font-weight:800;margin:0 0 .35rem}.weekly-brief .chart-note{font-size:.72rem;color:var(--muted);line-height:1.45;margin:.35rem 0 0}.weekly-brief .chart-host{width:100%;height:320px;min-width:0}.weekly-brief .section-lead{font-size:1rem;line-height:1.65;color:#334155;max-width:920px}.weekly-brief .evidence-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;margin:1rem 0}.weekly-brief .evidence{border:1px solid var(--line);border-radius:8px;padding:.75rem;background:#fff}.weekly-brief .evidence strong{display:block;font-size:1.05rem}.weekly-brief .evidence span{font-size:.7rem;color:var(--muted)}.weekly-brief .focus-row{background:#eff6ff}.weekly-brief .positive{color:#15803d;font-weight:700}.weekly-brief .negative{color:#b91c1c;font-weight:700}.weekly-brief .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:.4rem}.weekly-brief .status-dot.pass{background:#16a34a}.weekly-brief .status-dot.warn{background:#d97706}.weekly-brief .sequence{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.5rem;margin:1rem 0}.weekly-brief .sequence-step{border-top:4px solid #94a3b8;background:#f8fafc;padding:.7rem;border-radius:0 0 8px 8px;font-size:.76rem;line-height:1.45}.weekly-brief .sequence-step strong{display:block;margin-bottom:.25rem}.weekly-brief .sequence-step.systemic{border-color:#2563eb;background:#eff6ff}.weekly-brief .tier-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;margin-top:1rem}.weekly-brief .tier{border-left:4px solid #94a3b8;padding:.55rem .75rem;background:#f8fafc}.weekly-brief .tier strong{display:block;font-size:.8rem}.weekly-brief .tier span{font-size:.75rem;color:#475569}.weekly-brief .coverage-strip{display:flex;gap:.55rem;flex-wrap:wrap;margin-top:.8rem}.weekly-brief .coverage-strip span{border:1px solid var(--line);border-radius:999px;padding:.3rem .55rem;font-size:.7rem;font-weight:700}.weekly-brief table td,.weekly-brief table th{vertical-align:top}.weekly-brief .risk-callout{border-left:4px solid #dc2626;background:#fef2f2;padding:.85rem 1rem;border-radius:0 8px 8px 0;margin:1rem 0}.weekly-brief .action-callout{border-left:4px solid #2563eb;background:#eff6ff;padding:.85rem 1rem;border-radius:0 8px 8px 0;margin:1rem 0}.weekly-brief .source-meta{font-size:.72rem;color:#64748b}.weekly-brief .no-setup{border-radius:8px}.weekly-brief .metrics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem}.weekly-brief .metric-value{font-family:Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums}
@media(max-width:860px){.weekly-brief .decision-board,.weekly-brief .chart-grid{grid-template-columns:1fr}.weekly-brief .chart-panel.wide{grid-column:auto}.weekly-brief .evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.weekly-brief .sequence{grid-template-columns:1fr}.weekly-brief .tier-list{grid-template-columns:repeat(2,minmax(0,1fr))}.weekly-brief .chart-host{height:290px}}
@media(max-width:560px){.weekly-brief .decision-stats,.weekly-brief .check-grid,.weekly-brief .metrics-grid,.weekly-brief .evidence-grid,.weekly-brief .tier-list{grid-template-columns:1fr}.weekly-brief .content-card{padding:1rem}.weekly-brief .chart-host{height:270px}.weekly-brief .chart-panel{padding:.55rem}.weekly-brief .data-table{font-size:.74rem}}
</style>
</head><body class="weekly-brief">
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<section class="hero-section"><div class="container"><div class="hero-date">Semaine du 31 août au 4 septembre 2026 · données arrêtées au 28 août</div><h1 class="hero-title">AVGO devient le vrai test de diffusion de l’IA</h1><p class="hero-subtitle">NVIDIA a confirmé la demande de calcul. Broadcom doit maintenant montrer que les puces sur mesure et le réseau suivent, pendant que Dell, Snowflake, HPE, Ciena et la cyber testent le reste de la chaîne. Vendredi, l’emploi américain peut tout revaloriser par les taux.</p><div class="hero-badges"><span class="hero-badge">AVGO mercredi après clôture</span><span class="hero-badge">Rayon de propagation multi-secteurs</span><span class="hero-badge">Emploi vendredi</span></div><div id="article-clickable-tags" class="card-tags"></div></div></section>
<main class="container" id="main-content">

<nav class="report-jump-nav" aria-label="Sommaire de l’hebdo"><a href="#verdict"><i class="fas fa-gavel"></i> Synthèse</a><a href="#semaine"><i class="fas fa-calendar-week"></i> Calendrier</a><a href="#avgo"><i class="fas fa-microchip"></i> AVGO</a><a href="#blast"><i class="fas fa-diagram-project"></i> Pairs</a><a href="#earnings"><i class="fas fa-bolt"></i> Résultats</a><a href="#macro"><i class="fas fa-chart-line"></i> Marchés</a><a href="#crypto"><i class="fab fa-bitcoin"></i> Crypto/or</a><a href="#risques"><i class="fas fa-shield-halved"></i> Plan</a></nav>

<section id="verdict" class="decision-board" aria-label="Décision de la semaine">
  <div class="decision-main"><div class="decision-label">Décision prioritaire</div><h2>ATTENDRE AVGO, puis négocier la preuve</h2><p><strong>Aucune poursuite avant publication.</strong> La qualité fondamentale est élevée, mais AVGO cote sous ses moyennes courtes et l’historique montre des écarts d’ouverture violents dans les deux sens.</p><div class="decision-stats"><div class="mini-stat"><strong>${avgoPrice}</strong><span>clôture AVGO</span></div><div class="mini-stat"><strong>${avgoRsi}</strong><span>RSI quotidien</span></div><div class="mini-stat"><strong>${avgoMedianReaction}</strong><span>médiane absolue après résultats</span></div></div></div>
  <div class="decision-side"><div class="decision-label">Contrôle systématique</div><div class="check-grid"><div class="check-item pass"><i class="fas fa-circle-check"></i><span><strong>Données</strong><br>Dernière clôture complète validée.</span></div><div class="check-item block"><i class="fas fa-circle-xmark"></i><span><strong>Événement</strong><br>Résultats AVGO mercredi après clôture.</span></div><div class="check-item warn"><i class="fas fa-triangle-exclamation"></i><span><strong>Tendance</strong><br>Cours sous les deux moyennes courtes.</span></div><div class="check-item warn"><i class="fas fa-triangle-exclamation"></i><span><strong>Options</strong><br>Ordre de grandeur disponible; confiance faible.</span></div><div class="check-item warn"><i class="fas fa-triangle-exclamation"></i><span><strong>Valorisation</strong><br>${avgoEvRevenue} les revenus.</span></div><div class="check-item pass"><i class="fas fa-circle-check"></i><span><strong>Qualité</strong><br>Quatre dépassements EPS consécutifs.</span></div></div></div>
</section>

<section class="content-card" id="semaine"><h2><i class="fas fa-calendar-week"></i> La semaine en une séquence</h2><p class="section-lead">Le marché va tester la chaîne IA par morceaux. Le bon signal n’est pas qu’un seul titre monte, mais que les prévisions deviennent cohérentes du calcul jusqu’au logiciel, puis résistent au choc macro de vendredi.</p><div class="sequence"><div class="sequence-step"><strong>Lundi</strong>Inflation européenne<br>Préparation</div><div class="sequence-step"><strong>Mardi</strong>DELL · PANW · MDB · CRDO<br>Premiers signaux</div><div class="sequence-step systemic"><strong>Mercredi</strong>AVGO · SNOW · HPE<br>Test systémique</div><div class="sequence-step"><strong>Jeudi</strong>CIEN · ZS · ISM services<br>Confirmation</div><div class="sequence-step"><strong>Vendredi</strong>Emploi US<br>Verdict des taux</div></div><div class="chart-panel"><div class="chart-title">Intensité des catalyseurs par séance</div><div id="eventChart" class="chart-host"></div><p class="chart-note">Hauteur qualitative : nombre et portée des événements suivis, pas une probabilité de hausse ou de baisse.</p></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Jour</th><th>Événements</th><th>Ce qu’un investisseur doit faire</th></tr></thead><tbody>${eventRowsHtml}</tbody></table></div></section>

<section class="content-card" id="bilan"><h2><i class="fas fa-rotate-left"></i> Ce que la semaine passée a invalidé</h2><p>La technologie a repris le leadership alors que les actifs réels ont reculé et que la crypto est restée dispersée. La leçon est méthodologique : un récit multi-actifs ne doit jamais survivre à l’absence de confirmation par les prix.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Thèse précédente</th><th>Observation</th><th>Conséquence</th></tr></thead><tbody><tr><td>Leadership uniforme des actifs réels</td><td>Métaux et pétrole ont manqué de suivi.</td><td>Attendre une reprise relative avant de renforcer.</td></tr><tr><td>Pression durable sur la technologie</td><td>La technologie a repris la tête.</td><td>Donner priorité aux résultats et à la réaction du prix.</td></tr><tr><td>Appétit pour le risque crypto homogène</td><td>Les proxys ont divergé.</td><td>Analyser chaque sous-jacent séparément.</td></tr></tbody></table></div></section>

<section class="content-card" id="avgo"><h2><i class="fas fa-microchip"></i> AVGO : le dossier central</h2><p class="section-lead">Broadcom combine accélérateurs sur mesure, réseau et logiciels d’infrastructure. Cette publication dira si l’économie IA se diffuse au-delà des GPU généralistes. Le dossier reste fondamentalement fort ; le calendrier pré-résultats reste bloqué.</p><div class="evidence-grid"><div class="evidence"><strong>${avgoMcap}</strong><span>capitalisation</span></div><div class="evidence"><strong>${avgoRevenue}</strong><span>revenus douze mois</span></div><div class="evidence"><strong>${avgoGrowth}</strong><span>croissance des revenus</span></div><div class="evidence"><strong>${avgoCash}</strong><span>trésorerie</span></div><div class="evidence"><strong>${avgoDebt}</strong><span>dette comptable</span></div><div class="evidence"><strong>${avgoEma20}</strong><span>moyenne courte</span></div><div class="evidence"><strong>${avgoEma50}</strong><span>moyenne intermédiaire</span></div><div class="evidence"><strong>${avgoBeta}</strong><span>bêta publiée</span></div></div><div class="chart-grid"><div class="chart-panel"><div class="chart-title">AVGO · prix et moyennes mobiles</div><div id="avgoPriceChart" class="chart-host"></div><p class="chart-note">Le prix arrive sous les moyennes courte et intermédiaire. L’écart d’ouverture rend ces repères secondaires jusqu’à la reconstruction d’une base.</p></div><div class="chart-panel"><div class="chart-title">Réactions après résultats</div><div id="reactionChart" class="chart-host"></div><p class="chart-note">Mouvements clôture à clôture autour des dates SEC. La distribution est parfaitement partagée entre hausses et baisses.</p></div></div><div class="chart-grid"><div class="chart-panel"><div class="chart-title">Qualité opérationnelle et risque financier</div><div id="qualityRadar" class="chart-host"></div><p class="chart-note">Échelle de lecture, pas un score testé historiquement : croissance et marges fortes, mais dette et multiple exigent des prévisions solides.</p></div><div class="chart-panel"><div class="chart-title">Réactions récentes AVGO</div><div class="table-responsive"><table class="data-table"><thead><tr><th>Recensement</th><th>Réaction</th><th>Écart d’ouverture</th><th>Volume</th></tr></thead><tbody>${reactionRows}</tbody></table></div><div class="risk-callout"><strong>Contradiction utile :</strong> quatre dépassements EPS consécutifs n’ont pas empêché une réaction de ${avgoLastReaction} lors de la dernière publication. Dépasser les attentes ne suffit pas ; les prévisions et le prix post-publication gouvernent.</div></div></div></section>

<section class="content-card" id="blast"><h2><i class="fas fa-diagram-project"></i> Rayon de surveillance AVGO</h2><p class="section-lead">Cette carte part des liens économiques documentés : calcul et réseau, fabrication, serveurs, puis électricité. Les performances relatives et corrélations brutes ont été contrôlées en revue contrarienne, mais ne sont pas publiées comme preuve de causalité. Chaque titre doit confirmer par ses propres prévisions et son propre prix.</p><div class="chart-panel"><div class="chart-title">Carte économique : où chercher la confirmation</div><div id="blastChart" class="chart-host" style="height:390px"></div><p class="chart-note">Les étages décrivent la proximité dans la chaîne de valeur, pas un ordre garanti de réaction ni une recommandation d’achat.</p></div><div class="tier-list"><div class="tier"><strong>Proximité directe · calcul et réseau</strong><span>NVDA, AMD, MRVL, ANET, CRDO, CIEN</span></div><div class="tier"><strong>Relais industriel · fabrication</strong><span>TSM, MU, KLAC, SOXX</span></div><div class="tier"><strong>Infrastructure · serveurs</strong><span>DELL, HPE</span></div><div class="tier"><strong>Investissement final · électricité</strong><span>CEG, VST, GEV</span></div></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Titre</th><th>Rôle</th><th>Proximité économique</th></tr></thead><tbody>${blastRows}</tbody></table></div><div class="action-callout"><strong>Lecture actionnable :</strong> utiliser MRVL, ANET, CRDO et CIEN comme contrôles indépendants du réseau et des ASIC. DELL/HPE puis CEG/VST/GEV sont des signaux économiques plus éloignés. Leur divergence ne prouve ni n’annule à elle seule la thèse AVGO.</div></section>

<section class="content-card" id="earnings"><h2><i class="fas fa-bolt"></i> Résultats : attentes et contrôles</h2><div class="chart-grid"><div class="chart-panel"><div class="chart-title">Amplitudes implicites et estimation AVGO</div><div id="earningsChart" class="chart-host"></div><p class="chart-note">AVGO : ordre de grandeur tiré du straddle ATM de la première échéance complète après les résultats. Le filtre standard avait choisi une échéance trop courte. La chaîne dédiée est liquide au strike ATM, mais des spreads hétérogènes et deux anomalies ailleurs dans la surface imposent une confiance faible.</p></div><div class="chart-panel"><div class="chart-title">Contrôle avant toute entrée</div><ul class="checklist"><li>Publication terminée et prévisions disponibles.</li><li>Écart d’ouverture observé en séance régulière avec volume réel.</li><li>Tenue du VWAP et de la zone d’ouverture.</li><li>Pairs de premier ordre cohérents.</li><li>Taux et QQQ non contradictoires.</li><li>Invalidation structurelle et rendement/risque recalculés.</li></ul></div></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Titre</th><th>Publication</th><th>Test économique</th><th>Amplitude implicite</th></tr></thead><tbody>${earningsRowsHtml}</tbody></table></div></section>

<section class="content-card" id="macro"><h2><i class="fas fa-chart-line"></i> Marché, secteurs et volatilité</h2><div class="metrics-grid">${marketCardsHtml}</div><p class="section-lead">Le régime systématique reste <strong>${data.regime.regime === "RISK_ON" ? "APPÉTIT POUR LE RISQUE" : data.regime.regime}</strong> avec un score de ${numericClaim("regime_score", "regime", "/regime_score", { scale: 100, decimals: 0, suffix: " %" })}. Le VIX principal clôture à ${numericClaim("vix_level", "options", "/items/1/level", { decimals: 2 })}, avec une courbe encore en contango. Le risque immédiat n’est pas la panique ; c’est une hausse trop étroite qui échoue sur les résultats ou l’emploi.</p><div class="chart-grid"><div class="chart-panel"><div class="chart-title">Indices et couvertures · base commune</div><div id="marketChart" class="chart-host"></div><p class="chart-note">QQQ et SPY tiennent mieux que les petites capitalisations. GLD et TLT servent de contrôles inter-marchés.</p></div><div class="chart-panel"><div class="chart-title">Rotation sectorielle · semaine passée</div><div id="sectorChart" class="chart-host"></div><p class="chart-note">Une confirmation de l’appétit pour le risque exige plus que la technologie : participation des cycliques et amélioration d’IWM.</p></div></div><div class="chart-panel"><div class="chart-title">Matrice de risque de la semaine</div><div id="riskChart" class="chart-host"></div><p class="chart-note">Position qualitative basée sur probabilité et impact. Ce graphique structure les décisions ; il ne prétend pas fournir des probabilités calibrées.</p></div></section>

<section class="content-card" id="crypto"><h2><i class="fab fa-bitcoin"></i> Crypto, or et bêta élevée</h2><p class="section-lead">Les séries publiées utilisent des véhicules américains alignés sur la clôture actions. Le week-end crypto ne prédit pas mécaniquement l’ouverture US. La confirmation utile reste collective : Bitcoin, Ether et leurs proxys cotés doivent raconter la même histoire.</p><div class="chart-grid"><div class="chart-panel"><div class="chart-title">Proxys crypto américains · base commune</div><div id="cryptoChart" class="chart-host"></div><p class="chart-note">IBIT, ETHA et SOLZ sont comparés sur les mêmes séances. Une divergence SOL ne valide pas à elle seule l’appétit pour le risque crypto.</p></div><div class="chart-panel"><div class="chart-title">Allocation tactique indicative</div><div id="allocationChart" class="chart-host"></div><p class="chart-note">Réserve de liquidités élevée avant AVGO et l’emploi. Cette grille est une inclinaison de risque, pas une allocation personnalisée.</p></div></div><div class="coverage-strip"><span>Or : surveiller GLD face à TLT</span><span>Bitcoin : confirmer avec IBIT</span><span>Ether : confirmer avec ETHA</span><span>Bêta élevée : jamais avant le sous-jacent</span></div></section>

<section class="content-card" id="geopolitique"><h2><i class="fas fa-earth-americas"></i> Géopolitique et politique commerciale</h2><p>Aucun choc géopolitique unique ne domine le calendrier vérifié. Le risque pertinent pour le dossier reste une restriction nouvelle sur les puces, serveurs ou équipements de datacenter, ou une hausse simultanée du pétrole, du dollar et de la volatilité.</p><div class="risk-callout"><strong>Contrôle contrarien :</strong> sans annonce officielle nouvelle dans le jeu de preuves, ce risque reste conditionnel. Il ne justifie ni achat défensif automatique ni vente anticipée de la chaîne IA.</div></section>

<section class="content-card" id="risques"><h2><i class="fas fa-shield-halved"></i> Plan d’action et invalidations</h2><div class="no-setup"><strong>AUCUNE ENTRÉE AVANT AVGO</strong><p>Les niveaux historiques ne sont pas des ordres actifs avant un événement capable de déplacer le titre de plusieurs ATR. L’ouverture post-résultats doit reconstruire le VWAP, la zone d’ouverture et le rendement/risque.</p></div><div class="scenario-grid"><div class="scenario-card neutral"><h3>Scénario central · diffusion partielle</h3><p>AVGO publie correctement mais les prévisions et les prix divergent entre réseau, serveurs, logiciel et cyber.</p><p><strong>Action :</strong> traiter chaque sous-secteur séparément et conserver des liquidités.</p></div><div class="scenario-card bullish"><h3>Alternative haussière · chaîne cohérente</h3><p>AVGO relève fortement ses prévisions, son écart d’ouverture tient et plusieurs contrôles économiques confirment sans hausse des taux.</p><p><strong>Action :</strong> construire progressivement après une base, sans acheter l’ouverture verticale.</p></div><div class="scenario-card bearish"><h3>Alternative baissière · révision du cycle</h3><p>Prévisions AVGO faibles, écart d’ouverture vendu, faiblesse large des semis, puis emploi fort et taux en hausse.</p><p><strong>Action :</strong> refuser le rattrapage et réduire la bêta IA corrélée.</p></div></div><div class="risk-callout"><strong>Invalidation du biais constructif :</strong> AVGO sous son point bas post-résultats, SOXX et QQQ en divergence négative, et taux longs en hausse. Dans ce scénario, une “bonne entreprise” reste un mauvais trade.</div><h3>Carte technique pré-événements</h3><div class="table-responsive"><table class="data-table"><thead><tr><th>Titre</th><th>Clôture</th><th>Moyenne courte</th><th>RSI</th><th>État</th></tr></thead><tbody>${technicalRowsHtml}</tbody></table></div></section>

<section class="content-card" id="trades"><h2><i class="fas fa-crosshairs"></i> Plans et conditions d’activation</h2><p>Aucun plan directionnel n’est actif avant la publication AVGO. Les candidats ne deviennent éligibles qu’après une base régulière, un VWAP observable et une confirmation par leur propre sous-secteur.</p><div class="action-callout"><strong>Ordre de surveillance économique :</strong> AVGO pour ses prévisions, MRVL/ANET/CRDO/CIEN pour le réseau et les ASIC, DELL/HPE pour les serveurs, puis CEG/VST/GEV pour l’investissement électrique. Cet ordre organise la vérification ; il ne prédit pas la chronologie des prix.</div></section>

<section class="content-card" id="outlook"><h2><i class="fas fa-compass"></i> Perspective</h2><p>Le scénario central reste une diffusion partielle : de bons chiffres sur certains maillons, mais pas une validation uniforme de toute la chaîne. La conviction ne doit monter qu’avec la cohérence des prévisions, des réactions de prix et des taux.</p><div class="pedagogy-box"><strong>Règle simple :</strong> le résultat dit ce qui s’est passé ; les prévisions disent ce qui peut arriver ; le prix dit ce que le marché accepte déjà de payer.</div></section>

<section class="content-card" id="sources"><h2><i class="fas fa-book"></i> Sources, qualité et limites</h2><p>Instantané observé dimanche, chiffres de marché arrêtés à la dernière clôture US complète. Les prix, résultats, réactions historiques, fondamentaux et techniques viennent de collectes datées et contrôlées. Les barres ajustées alignées servent aussi à une revue statistique contrarienne, jamais à transformer la carte économique en causalité.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Bloc</th><th>Qualité</th><th>Limite appliquée</th></tr></thead><tbody><tr><td>Barres actions/ETF</td><td><span class="badge badge-green">VALIDÉ</span></td><td>Dernière clôture servie, séance partielle exclue.</td></tr><tr><td>Résultats AVGO</td><td><span class="badge badge-green">VALIDÉ</span></td><td>Date issue du calendrier financier filtré ; fenêtre après clôture.</td></tr><tr><td>Options AVGO</td><td><span class="badge badge-yellow">AVEC RÉSERVE</span></td><td>Straddle ATM post-résultats calculable; surface globale hétérogène, donc estimation indicative.</td></tr><tr><td>Rayon de surveillance</td><td><span class="badge badge-blue">DOCUMENTÉ</span></td><td>Liens économiques; aucune chronologie de prix ni causalité affirmée.</td></tr><tr><td>Crypto du week-end</td><td><span class="badge badge-yellow">CONTRÔLE</span></td><td>Ne prédit pas l’ouverture US ; ETF alignés utilisés pour les comparaisons.</td></tr></tbody></table></div><p class="source-meta">Le calendrier couvre huit événements macro pour la semaine. Sources primaires : BLS, Réserve fédérale, ISM et calendrier économique consolidé. Données absentes ou mal formées non remplacées par zéro.</p><div class="source-refs"><a class="source-ref" href="https://www.bls.gov/schedule/news_release/empsit.htm" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span class="source-name">BLS · rapport emploi</span></a><a class="source-ref" href="https://www.federalreserve.gov/newsevents/calendar.htm" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span class="source-name">Réserve fédérale · calendrier</span></a><a class="source-ref" href="/analyses/AVGO/"><i class="fa-solid fa-file-lines"></i><span class="source-name">Dossier AVGO complet</span></a></div><div class="disclaimer"><strong>Avertissement :</strong> contenu informatif, pas un conseil financier. Les résultats peuvent créer un écart d’ouverture supérieur au risque théorique et rendre un niveau d’invalidation inopérant.</div></section>
</main>
<footer class="article-footer">&copy; 2026 DailyTickers · données arrêtées au 28 août 2026 · contenu informatif.<br><a href="/" title="Accueil"><i class="fas fa-house"></i></a></footer>
<script>
const P=${JSON.stringify(chartPayload)};
const palette=['#2563eb','#0f766e','#d97706','#dc2626','#7c3aed','#0891b2','#64748b','#16a34a'];
const charts=[];
function mount(id,option){const host=document.getElementById(id);if(!host||typeof echarts==='undefined')return;const chart=echarts.init(host);chart.setOption(option);charts.push(chart);}
function normalized(symbol,rows){if(!rows?.length)return[];const base=rows[0].close;return rows.map(row=>[row.date,+(row.close/base*100).toFixed(2)]);}
function lastRows(symbol,n=80){return (P.marketBars[symbol]||[]).slice(-n);}
function aligned(symbols,n=80){const rows=Object.fromEntries(symbols.map(symbol=>[symbol,lastRows(symbol,n)]));const start=symbols.map(symbol=>rows[symbol][0]?.date).filter(Boolean).sort().at(-1);return Object.fromEntries(symbols.map(symbol=>[symbol,normalized(symbol,rows[symbol].filter(row=>row.date>=start))]));}
mount('eventChart',{tooltip:{trigger:'axis'},grid:{left:35,right:18,top:20,bottom:38},xAxis:{type:'category',data:['Lun.','Mar.','Mer.','Jeu.','Ven.']},yAxis:{type:'value',min:0,max:5,show:false},series:[{type:'bar',barMaxWidth:52,data:[{value:2,itemStyle:{color:'#94a3b8'}},{value:4,itemStyle:{color:'#64748b'}},{value:5,itemStyle:{color:'#2563eb'}},{value:4,itemStyle:{color:'#0f766e'}},{value:5,itemStyle:{color:'#d97706'}}],label:{show:true,position:'top',formatter:p=>['Macro','4 résultats','AVGO + 2','Macro + 2','Emploi'][p.dataIndex]}}]});
mount('avgoPriceChart',{tooltip:{trigger:'axis'},legend:{bottom:0},grid:{left:48,right:18,top:20,bottom:45},xAxis:{type:'time'},yAxis:{type:'value',scale:true},series:[{name:'AVGO',type:'line',showSymbol:false,data:P.avgo.map(r=>[r.date,r.close]),itemStyle:{color:'#2563eb'},lineStyle:{width:2,color:'#2563eb'}},{name:'MM20 simple',type:'line',showSymbol:false,data:P.avgoSma20,itemStyle:{color:'#d97706'},lineStyle:{width:1.4,color:'#d97706'}},{name:'MM50 simple',type:'line',showSymbol:false,data:P.avgoSma50,itemStyle:{color:'#7c3aed'},lineStyle:{width:1.4,color:'#7c3aed'}}]});
mount('reactionChart',{tooltip:{trigger:'axis'},grid:{left:45,right:15,top:20,bottom:48},xAxis:{type:'category',data:P.reactions.map(r=>r.announced_date.slice(0,7)),axisLabel:{rotate:35}},yAxis:{type:'value',axisLabel:{formatter:'{value}%'}},series:[{type:'bar',data:P.reactions.map(r=>({value:+r.move_percent.toFixed(2),itemStyle:{color:r.move_percent>=0?'#16a34a':'#dc2626'}})),label:{show:true,position:p=>p.value>=0?'top':'bottom',formatter:p=>(p.value>0?'+':'')+p.value+'%'}}]});
mount('qualityRadar',{tooltip:{},radar:{indicator:[{name:'Croissance',max:100},{name:'Marge brute',max:100},{name:'Marge op.',max:100},{name:'Bilan',max:100},{name:'Valorisation',max:100},{name:'Momentum',max:100}],radius:'64%'},series:[{type:'radar',data:[{value:[${(avgoFinancial.revenueGrowth * 100).toFixed(1)},${(avgoFinancial.grossMargins * 100).toFixed(1)},${(avgoFinancial.operatingMargins * 100).toFixed(1)},42,32,${Math.max(0, Math.min(100, avgoTechnical.rsi)).toFixed(1)}],name:'AVGO',areaStyle:{color:'rgba(37,99,235,.18)'},lineStyle:{color:'#2563eb'}}]}]});
const blastTierNames={1:'Calcul & réseau',2:'Fabrication',3:'Serveurs',4:'Électricité'};
const blastNodes=[{name:'AVGO',role:'Catalyseur central',itemStyle:{color:'#2563eb'}},...Object.entries(blastTierNames).map(([order,name])=>({name,role:'Proximité économique '+order,itemStyle:{color:palette[+order]}})),...P.blast.filter(x=>x.symbol!=='AVGO').map(x=>({name:x.symbol,role:x.role,itemStyle:{color:palette[x.order]}}))];
const blastLinks=[...Object.entries(blastTierNames).map(([order,name])=>({source:'AVGO',target:name,value:P.blast.filter(x=>x.order===+order).length})),...P.blast.filter(x=>x.symbol!=='AVGO').map(x=>({source:blastTierNames[x.order],target:x.symbol,value:1}))];
mount('blastChart',{tooltip:{formatter:p=>p.dataType==='node'?'<strong>'+p.data.name+'</strong><br>'+(p.data.role||'Lien économique'):'Lien économique documenté, non causal'},series:[{type:'sankey',data:blastNodes,links:blastLinks,left:8,right:64,top:12,bottom:12,nodeWidth:16,nodeGap:10,draggable:false,emphasis:{focus:'adjacency'},lineStyle:{color:'source',opacity:.22,curveness:.45},label:{fontSize:11,color:'#334155',distance:6,formatter:'{b}'}}]});
mount('earningsChart',{tooltip:{trigger:'axis',formatter:items=>items.map(p=>'<strong>'+p.name+'</strong><br>'+(P.validMoves[p.dataIndex].indicative?'Estimation indicative : ≈ ':'Mouvement implicite : ')+p.value+'%').join('')},grid:{left:40,right:15,top:22,bottom:45},xAxis:{type:'category',data:P.validMoves.map(x=>x.symbol)},yAxis:{type:'value',axisLabel:{formatter:'{value}%'}},series:[{type:'bar',data:P.validMoves.map(x=>x.value==null?{value:0,itemStyle:{color:'#cbd5e1'},label:{show:true,position:'top',formatter:'N/D'}}:{value:+x.value.toFixed(1),itemStyle:{color:x.indicative?'#d97706':'#0f766e'},label:{show:true,position:'top',formatter:p=>(P.validMoves[p.dataIndex].indicative?'≈ ':'')+p.value+'%'}})}]});
const marketSymbols=['SPY','QQQ','IWM','GLD','TLT'];const marketAligned=aligned(marketSymbols);
mount('marketChart',{tooltip:{trigger:'axis'},legend:{type:'scroll',bottom:0},grid:{left:45,right:15,top:20,bottom:48},xAxis:{type:'time'},yAxis:{type:'value',scale:true,name:'Base 100'},series:marketSymbols.map((s,i)=>({name:s,type:'line',showSymbol:false,data:marketAligned[s],lineStyle:{width:s==='QQQ'?2.4:1.5,color:palette[i]}}))});
const sectorSymbols=['XLK','XLC','XLF','XLY','XLI','XLE','XLV','XLP','XLU','XLRE'];
const sectorData=sectorSymbols.map(s=>{const r=lastRows(s,7);return{name:s,value:r.length>5?+(r.at(-1).close/r.at(-6).close*100-100).toFixed(2):0}}).sort((a,b)=>a.value-b.value);
mount('sectorChart',{tooltip:{trigger:'axis'},grid:{left:48,right:28,top:15,bottom:30},xAxis:{type:'value',axisLabel:{formatter:'{value}%'}},yAxis:{type:'category',data:sectorData.map(x=>x.name)},series:[{type:'bar',data:sectorData.map(x=>({value:x.value,itemStyle:{color:x.value>=0?'#16a34a':'#dc2626'}})),label:{show:true,position:'right',formatter:p=>(p.value>0?'+':'')+p.value+'%'}}]});
mount('riskChart',{tooltip:{formatter:p=>'<strong>'+p.data.fullName+'</strong><br>'+p.data.action},grid:{left:62,right:42,top:28,bottom:58},xAxis:{type:'value',min:.5,max:3.5,interval:1,name:'Probabilité →',nameLocation:'middle',nameGap:34,axisLabel:{formatter:v=>({1:'Faible',2:'Moyenne',3:'Élevée'})[v]||''}},yAxis:{type:'value',min:.5,max:3.5,interval:1,name:'Impact →',axisLabel:{formatter:v=>({1:'Faible',2:'Moyen',3:'Élevé'})[v]||''}},series:[{type:'scatter',symbolSize:68,data:[{name:'Emploi\\nfort',fullName:'Emploi fort',value:[2.1,2.8],action:'Taux en hausse : réduire la duration',itemStyle:{color:'#dc2626'}},{name:'AVGO\\ndéçoit',fullName:'AVGO déçoit',value:[1.5,2.8],action:'Refuser les achats de sympathie',itemStyle:{color:'#b91c1c'}},{name:'Dépassement\\nvendu',fullName:'Dépassement vendu',value:[2.8,1.8],action:'Attendre une base',itemStyle:{color:'#d97706'}},{name:'Diffusion\\ncomplète',fullName:'Diffusion complète',value:[2.1,1.8],action:'Ajouter par étapes',itemStyle:{color:'#16a34a'}},{name:'Choc\\ngéopolitique',fullName:'Choc géopolitique',value:[.8,2.8],action:'Réduire la bêta corrélée',itemStyle:{color:'#7c3aed'}}],label:{show:true,position:'inside',color:'#fff',fontSize:10,fontWeight:700,formatter:p=>p.data.name}}]});
const cryptoSymbols=['IBIT','ETHA','SOLZ'];const cryptoAligned=aligned(cryptoSymbols);
mount('cryptoChart',{tooltip:{trigger:'axis'},legend:{bottom:0},grid:{left:45,right:15,top:20,bottom:48},xAxis:{type:'time'},yAxis:{type:'value',scale:true,name:'Base 100'},series:cryptoSymbols.map((s,i)=>({name:s,type:'line',showSymbol:false,data:cryptoAligned[s],lineStyle:{width:2,color:palette[i]}}))});
mount('allocationChart',{tooltip:{trigger:'item',formatter:'{b}: {c}%'},legend:{bottom:0},series:[{type:'pie',radius:['45%','72%'],center:['50%','45%'],avoidLabelOverlap:true,label:{formatter:'{b}\\n{c}%'},data:[{name:'Grandes capitalisations',value:35,itemStyle:{color:'#2563eb'}},{name:'Liquidités',value:30,itemStyle:{color:'#64748b'}},{name:'IA sélective',value:15,itemStyle:{color:'#0f766e'}},{name:'Taux/or',value:10,itemStyle:{color:'#d97706'}},{name:'Crypto tactique',value:10,itemStyle:{color:'#7c3aed'}}]}]});
window.addEventListener('resize',()=>charts.forEach(chart=>chart.resize()));
</script><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script><script src="/assets/sidebar.js"></script></body></html>`;

html = html
  .replace(/<style>\n\.weekly-brief[\s\S]*?<\/style>\n/, "")
  .replaceAll(
    'class="table-responsive"',
    'class="table-responsive" style="overflow-x:auto;max-width:100%"',
  );
const articlePath = path.join(__dirname, "index.html");
fs.writeFileSync(articlePath, html);
const articleSha = crypto
  .createHash("sha256")
  .update(Buffer.from(html))
  .digest("hex");
fs.writeFileSync(
  path.join(__dirname, "_data/claims.json"),
  JSON.stringify(
    {
      schema_version: 1,
      reference_close: "2026-08-28",
      article_path: "weekly/20260831/index.html",
      article_sha256: articleSha,
      claims,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built ${path.relative(ROOT, articlePath)} (${Buffer.byteLength(html)} bytes, ${claims.length} exact claims, 10 charts)`,
);
