#!/usr/bin/env node
'use strict';

// Construit data/substack/episode-illustrations.json : quelle figure va sur quel épisode.
//
// Le choix reste éditorial — c'est pourquoi il produit un manifeste relisible plutôt que de
// décider à la volée au moment du rendu. Deux règles apprises en regardant le résultat :
//   · l'ordre des motifs compte, le plus spécifique d'abord — une figure hors sujet est pire
//     qu'une absence de figure ;
//   · jamais deux fois la même image d'affilée dans une série, d'où le vivier de rotation. Les
//     21 épisodes d'ingénierie du desk pointaient tous vers « preuve » : le lecteur aurait vu la
//     même illustration vingt et une fois et aurait cessé de la regarder.
//
//   node tools/build-episode-illustration-map.js

const fs=require('fs'),path=require('path');
// Choix éditorial : la figure doit éclairer LE mécanisme de l'épisode, jamais décorer.
// Un épisode sans figure pertinente n'en reçoit pas — mieux vaut rien qu'un schéma hors sujet.
const BY_TITLE=[
  [/reward\/risk|headline reward|four tests|30-second|precise market claim/i,'rr_vs_winrate'],
  [/in R\b|distribution|biases against your records/i,'r_distribution'],
  [/hash the evidence|certify a candidate|independent evidence|freshness|one snapshot|replay without|explain every rejection|zero candidates|partial failures|discover capabilities|resolve identity|time as a first-class|corporate events|versioned configuration|persist state|kill switches|conditional plans|blast radius|execution routine|survive the open|event breakevens|stop may be inside/i,'evidence_chain'],
  // deuxième vague — l'ordre compte : la première règle qui matche gagne, donc le plus
  // spécifique d'abord. Une figure hors sujet est pire qu'une absence de figure.
  [/spread is one trade|every leg/i,'spread_legs'],
  [/state machine|idempotent|placement|reconcile|restarts|duplicates|broker capabilities|simulate the broker/i,'order_state_machine'],
  [/append-only|ledger|supersession|recovery/i,'append_only_ledger'],
  [/backtest|forward test|forward evidence|walk-forward|frozen point-in-time|replay to live/i,'forward_vs_backtest'],
  [/drawdown|pause protocol|retirement test/i,'drawdown_path'],
  [/scaling ladder|scale/i,'scaling_ladder'],
  [/market regime|regime$/i,'regime_map'],
  [/layer|boundaries|fail without lying|missing data|alerts|arithmetic|adversarial review|auditable/i,'layers_fail_safe'],
  [/inflation in layers|inflation and jobs|jobs report|growth release|series level/i,'inflation_layers'],
  [/SEC filing|short interest|verification ladder|analyst notes|timeline|options activity/i,'information_clock'],
  [/ETF|theme|wearing many tickers|economic exposure|sleeve|instrument to the exposure|portfolio job|contributions/i,'exposure_lookthrough'],
  [/transmission chain|gold, the dollar|real yields/i,'policy_transmission'],
  [/screen|ranking|technical structure|executable trade|executable order|entry idea|loss rules|failure rule|watchlist|setup another trader|scope|non-goals|kill criteria|boring first market/i,'decision_flow'],

  [/stop cannot fill|jump over your stop|gap/i,'gap_and_stop'],
  [/protection by the failure|stop-limit/i,'stop_vs_stop_limit'],
  [/yield curve|credit spread|bond contract|duration/i,'yield_curve_shapes'],
  [/option|payoff/i,'option_payoff'],
  [/etf wrapper|leverage compounds|fee|cost/i,'fee_drag'],
  [/correlation|hidden factor/i,'correlation_breaks'],
  [/seasonalit|calendar pattern|protocol cycle/i,'seasonality_caution'],
  [/decision.*first|fact|ledger|machine-readable plan|auditable|separate entry/i,'decision_flow'],
  [/siz(e|ing)|position size|ceilings|stress-loss/i,'position_sizing'],
  [/mandate|policy rate|QE and QT|FOMC|central-bank|balance sheet/i,'policy_transmission'],
  [/journal|review|MAE|dashboard|audit/i,'journal_loop'],
  [/beta/i,'high_beta'],
  [/economic calendar|risk map|release order|event-risk|pre-release/i,'calendar_certainty'],
];
const HEADERS={
  'gap-risk-survival':['What to check','What it tells you'],
  'trade-signal-check':['Test','What it rules out'],
  'market-checklist':['Step','What it decides'],
  'trading-plan-playbook':['Element','What it must specify'],
  'trading-journal-feedback-loop':['Field','Why it earns its place'],
  'options-risk':['Factor','Effect on the position'],
  'bonds-and-rates':['Concept','What it changes for you'],
  'central-bank-playbook':['Signal','How to read it'],
  'economic-calendar':['Release','What it actually measures'],
  'etf-toolkit':['Check','What it reveals'],
  'correlation-and-seasonality':['Test','What must survive it'],
  'high-beta-proxies':['Measure','What it constrains'],
  'portfolio-operator':['Decision','What it locks in'],
  'market-evidence':['Source','What it can prove'],
  'retail-systematic-desk':['Requirement','Why it is not optional'],
};

// Vivier de rotation par série : figures toutes défendables pour le sujet, dans un ordre choisi.
// Sert uniquement quand l'appariement par titre rendrait deux fois la même image d'affilée.
const POOL={
  'retail-systematic-desk':['evidence_chain','layers_fail_safe','decision_flow','order_state_machine','append_only_ledger','forward_vs_backtest','information_clock','regime_map','position_sizing','drawdown_path'],
  'market-checklist':['decision_flow','regime_map','position_sizing','rr_vs_winrate','journal_loop','order_state_machine'],
  'economic-calendar':['calendar_certainty','inflation_layers','information_clock','policy_transmission','decision_flow'],
  'etf-toolkit':['exposure_lookthrough','fee_drag','decision_flow','drawdown_path','position_sizing'],
  'portfolio-operator':['forward_vs_backtest','drawdown_path','scaling_ladder','position_sizing','decision_flow','journal_loop'],
  'market-evidence':['information_clock','evidence_chain','decision_flow','journal_loop'],
  'bonds-and-rates':['yield_curve_shapes','policy_transmission','exposure_lookthrough','position_sizing'],
  'central-bank-playbook':['policy_transmission','inflation_layers','calendar_certainty','decision_flow'],
  'options-risk':['option_payoff','spread_legs','position_sizing','rr_vs_winrate'],
  'gap-risk-survival':['gap_and_stop','stop_vs_stop_limit','position_sizing','evidence_chain','decision_flow'],
  'high-beta-proxies':['high_beta','correlation_breaks','position_sizing','policy_transmission'],
  'correlation-and-seasonality':['correlation_breaks','seasonality_caution','evidence_chain','decision_flow'],
  'trade-signal-check':['rr_vs_winrate','position_sizing','gap_and_stop','evidence_chain','decision_flow'],
  'trading-journal-feedback-loop':['journal_loop','r_distribution','drawdown_path','decision_flow'],
  'trading-plan-playbook':['decision_flow','position_sizing','regime_map','order_state_machine','journal_loop'],
};
const map={};
for(const d of fs.readdirSync('data/substack/series').sort()){
  const base=path.join('data/substack/series',d);
  if(!fs.existsSync(path.join(base,'manifest.json')))continue;
  const m=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
  // PAS DEUX FOIS LA MÊME FIGURE D'AFFILÉE DANS UNE SÉRIE.
  // Les épisodes 1 et 2 de gap-risk recevaient tous deux `gap_and_stop` : lus à une semaine
  // d'intervalle, le lecteur voit la même image et conclut qu'on recycle. On prend alors le
  // meilleur match suivant, et à défaut aucune figure — une répétition est pire qu'un blanc.
  const used=[];
  for(const e of (m.episodes||[])){
    const key=`${d}/${e.file}`;
    map[key]={table_headers:HEADERS[d]||['What to check','What it means'],figure_after:3};
    const matches=BY_TITLE.filter(([re])=>re.test(e.title)).map(([,id])=>id);
    // On écarte seulement la figure de l'épisode PRÉCÉDENT. Bloquer sur deux épisodes laissait
    // 43 épisodes sans illustration : une répétition à deux semaines d'écart passe inaperçue,
    // un blanc ne passe pas.
    const last=used[used.length-1];
    let pick=matches.find(id=>id!==last);
    // Quand tous les titres d'une série pointent vers la MÊME figure — c'est le cas des 21
    // épisodes d'ingénierie du desk, tous « preuve » —, on tourne sur un vivier propre à la série
    // plutôt que de répéter. Vingt et une fois la même image, le lecteur arrête de la regarder.
    if(!pick){
      const pool=POOL[d]||matches;
      pick=pool.find(id=>id!==last) || matches[0] || null;
    }
    map[key].figure=pick||undefined;
    used.push(pick);
  }
}
const withFig=Object.values(map).filter(v=>v.figure).length;
console.log('épisodes mappés:',Object.keys(map).length,'| avec figure:',withFig,'| sans:',Object.keys(map).length-withFig);
const counts={};Object.values(map).forEach(v=>{if(v.figure)counts[v.figure]=(counts[v.figure]||0)+1});
console.log('répartition:',Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+'×'+v).join(' '));
fs.writeFileSync('data/substack/episode-illustrations.json',
  '{\n  "_comment": "Carte épisode → schéma et en-têtes de tableau. Choix ÉDITORIAL, donc hors du code : une figure doit éclairer le mécanisme de l\\u0027épisode, jamais le décorer. Un épisode sans figure pertinente n\\u0027en reçoit pas — mieux vaut rien qu\\u0027un schéma hors sujet. Les en-têtes sont propres à chaque série parce que « What to check / What it means » ne convient pas à un catalogue de contraintes techniques.",\n'
  + JSON.stringify(map,null,2).slice(2));
console.log('→ data/substack/episode-illustrations.json');
