export const meta = {
  name: 'senior-review',
  description: 'Senior multi-persona QA harness — runs a panel of senior reviewers (QA / Quant / Trader / Risk-Compliance / Editor) over each artifact, applies fixes, and gates PASS/FIX/BLOCK before publish. Reusable across all DailyTickers processes.',
  phases: [
    { title: 'Panel', detail: 'senior personas review each artifact (type-aware), fix in place' },
    { title: 'Gate', detail: 'release-gate synthesis per artifact: PASS / FIXED / BLOCK' },
  ],
}

// args = { artifacts: [{ path, type, label? }], applyFixes?: true }
// type ∈ analyses | daily | weekly | retro | scanner | series | tech | landing | generic
const ARTIFACTS = (args && args.artifacts) || []
const APPLY = !args || args.applyFixes !== false  // default: reviewers FIX in place

// ---- Senior personas (each may EDIT the file to fix issues, then report) ----
const P = {
  qa: { label:'QA Senior (front-end / release)', mandate:`Audit HTML/release conventions and FIX in place: GTM-T5Z595CW present; brand-bar + brand-nav (Hebdo/Daily/Analyses/Scanner/Radar/Séries); correct data-tab; <link> /assets/report.css (no local assets/, no report-dark.css); Font Awesome 6.4.0; footer.article-footer (never report-footer/site-footer); FAB present where required; ECharts containers all have a matching echarts.init with unique ids and a resize handler (no orphan/empty charts); core.js + tag-renderer.js before </body>; #article-clickable-tags present; no broken internal links (no /index.html, no 404 to non-existent sibling parts); no inline <style> overriding global classes; mobile-responsive (auto-fit/minmax, no fixed grids); ticker-header uses .tm-value/.tm-label (value before label); NO template placeholder bugs (no "N/A"/"Negative"/"Loss" in data tables, no "22/10" risk gauge, no "74.00%" yields); French accents UTF-8 direct where lang=fr.` },
  quant: { label:'Quant Senior (data integrity)', mandate:`Verify EVERY hard number against fresh ground truth and FIX wrong ones. ToolSearch "select:mcp__claude_ai_DailyTickers__QueryData,mcp__claude_ai_DailyTickers__CheckJobStatus" and re-fetch the relevant data (quote, technicals, earnings_quarterly, stats, financials, bars_daily) for any ticker/figure cited. Check: prices/levels, market cap, P/E, EV/EBITDA, PEG, beta, margins, EPS beats (actual vs estimate), index/sector/commodity moves, and all computed ratios (R/R, %, win rate, profit factor) recompute correctly. Flag and correct any fabricated, stale, or internally-inconsistent number. For performance reporting (retro/scanner), confirm headline stats reconcile with the underlying table — never let a phantom win/return stand.` },
  trader: { label:'Trader Senior (setup / actionability)', mandate:`Judge tradeability. For analyses/scanner setups: entry/stop/TP coherent vs price + EMAs + ATR; R/R = (TP1-entry)/(entry-stop) >= 1.5 AT AN ACTIONABLE ENTRY within ~3% of the live price (NOT a far un-triggered pullback — that is the fatal "fictional R/R" defect); stop technically placed; not chasing an extended name (>~5-8% above EMA20); invalidation sensible; earnings/event proximity flagged; position-sizing sane for the beta/ATR. For daily/weekly: directional calls and "trade of the week" must be defensible and risk-framed. FIX the trade levels if R/R is fictional; downgrade the call if it is a chase.` },
  risk: { label:'Risk & Compliance Senior', mandate:`Stress risk + compliance and FIX. Dilution/flags: verify via SEC EDGAR (WebSearch) there is no active ATM / S-3 equity / M&A stock deal / mandatory convertible / heavy SBC misrepresented as "clean" — correct the disclosure honestly. Confirm the disclaimer / "not financial advice" block is present. No over-claiming, no invented geopolitical/macro events (we are June 2026 — verify), balanced bull AND bear, prudent language on manipulation/sentiment. Catalyst must not be macro-inverted (e.g. oil shock vs an airline). Flag concentration/correlation issues for any basket.` },
  editor: { label:'Editor Senior (FT/Economist desk)', mandate:`Edit for clarity, structure and credibility, FIX in place: headline/title accurate to the content; sections coherent and in the right order; at least one inline .source-ref per content section (add where missing using verified URLs — Yahoo/Finviz/SEC/IEA/Goldman patterns); tone = serious retail, FT/Economist + terminal precision (no hype, no crypto-bro, no filler); French accents correct; no contradictions; cross-links valid. Do NOT invent facts to fill gaps — flag instead.` },
}
// Which personas run per artifact type
const MATRIX = {
  analyses: ['qa','quant','trader','risk','editor'],
  scanner:  ['qa','quant','trader','risk','editor'],
  retro:    ['qa','quant','trader','editor'],
  daily:    ['qa','quant','trader','risk','editor'],
  weekly:   ['qa','quant','trader','risk','editor'],
  series:   ['qa','quant','risk','editor'],
  tech:     ['qa','quant','editor'],
  landing:  ['qa','editor'],
  generic:  ['qa','quant','editor'],
}

const REVIEW_SCHEMA = { type:'object', required:['persona','score','severity','fixed'], properties:{
  persona:{type:'string'}, score:{type:'number'}, severity:{type:'string', enum:['none','minor','major','critical']},
  fixed:{type:'array', items:{type:'string'}}, blocking:{type:'array', items:{type:'string'}}, notes:{type:'string'} } }
const GATE_SCHEMA = { type:'object', required:['path','decision','composite'], properties:{
  path:{type:'string'}, label:{type:'string'}, decision:{type:'string', enum:['PASS','FIXED','BLOCK']},
  composite:{type:'number'}, blocking:{type:'array', items:{type:'string'}}, summary:{type:'string'} } }

function reviewPrompt(a, pk){
  const p = P[pk]
  return `SENIOR REVIEW — you are the **${p.label}** reviewing the DailyTickers ${a.type} artifact at ${a.path}. Read it in full. Be rigorous and senior-level: your job is to catch what a junior missed and to PROTECT the brand and the reader.
${p.mandate}
${APPLY ? 'You MAY edit the file directly to FIX issues you can fix cleanly (Edit/Write). Do not rewrite wholesale; make surgical corrections.' : 'Do NOT edit; report only.'}
Return JSON: persona:"${pk}", score (0-100, your quality score for your dimension), severity (worst issue: none/minor/major/critical), fixed (array of fixes you applied), blocking (array of issues that should BLOCK publish if unfixed), notes (1-2 lines).`
}
function gatePrompt(a, reviews){
  return `You are the RELEASE GATE for ${a.path} (${a.type}${a.label?', '+a.label:''}). The senior panel returned: ${JSON.stringify(reviews,null,0)}.
Decide: composite (0-100, the weakest critical dimension caps it), and decision = "BLOCK" if any unresolved critical/blocking issue remains, "FIXED" if issues existed but were fixed in place (clean to publish), "PASS" if it was already clean. List any remaining blocking[] items and a one-line summary. Be willing to BLOCK — a senior desk does not ship broken or unverifiable work.`
}

phase('Panel')
const results = await pipeline(
  ARTIFACTS,
  async (a) => {
    const personas = MATRIX[a.type] || MATRIX.generic
    const reviews = await parallel(personas.map(pk => () =>
      agent(reviewPrompt(a, pk), { label:`rev:${a.label||a.path.split('/').slice(-2)[0]}:${pk}`, phase:'Panel', schema:REVIEW_SCHEMA })
    ))
    return { a, reviews: reviews.filter(Boolean) }
  },
  (panel) => agent(gatePrompt(panel.a, panel.reviews), { label:`gate:${panel.a.label||panel.a.path.split('/').slice(-2)[0]}`, phase:'Gate', schema:GATE_SCHEMA })
)
const gates = results.filter(Boolean)
const blocked = gates.filter(g=>g.decision==='BLOCK')
log(`Senior review done. PASS:${gates.filter(g=>g.decision==='PASS').length} FIXED:${gates.filter(g=>g.decision==='FIXED').length} BLOCK:${gates.filter(g=>g.decision==='BLOCK').length}${blocked.length?' -> '+blocked.map(g=>g.path).join(','):''}`)
return { gates, blocked }
