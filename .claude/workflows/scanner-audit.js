export const meta = {
  name: 'scanner-audit',
  description: 'Expert panel audit of scanner trading modes — hedge fund PM, risk manager, quant dev, alpha researcher',
  whenToUse: 'Run after config changes, when modes underperform, or to validate strategy integrity',
  phases: [
    { title: 'Data Collection', detail: 'Gather trades, configs, signals, OHLCV' },
    { title: 'Expert Analysis', detail: '4 experts analyze independently in parallel' },
    { title: 'War Room', detail: 'CIO synthesizes findings into prioritized action plan' },
  ],
}

const focusModes = args?.focus || 'all modes'
const round = args?.round || 1

phase('Data Collection')

const dataCollector = await agent(`You are a data engineer. Collect and summarize ALL relevant data for a trading system audit.

Read these files and produce a structured JSON summary:
1. data/modes-config.json — full config for all 6 modes
2. data/backtest-trades.json — per mode: count, last 10 trades with details, win/loss/BE stats
3. scanner/signals.json from the last 4 scan directories (ls scanner/ | grep digits | sort | tail -4)
4. data/backtest-results.json — frozen stats per mode
5. tools/sweep.js lines 434-540 (simulateTrade) and 973-1100 (simulatePortfolio)
6. data/scanner-positions.json — current open positions
7. Compute SPY return since Feb 26 from price cache

Focus analysis on: ${focusModes}
This is round ${round} of the audit.`, {
  label: 'data:collect',
  phase: 'Data Collection',
  model: 'sonnet'
})

log(`Data collected. Round ${round} — Focus: ${focusModes}. Launching 4 experts.`)

phase('Expert Analysis')

const DATA = JSON.stringify(dataCollector).slice(0, 80000)

const expertResults = await parallel([
  () => agent(`You are a hedge fund PM with 20 years experience. Audit this scanner system. Focus on: ${focusModes}. Round ${round}. Be BRUTAL — find why returns leak.

DATA:
${DATA}

Check: signal quality vs realized returns, stop placement, position sizing, entry timing. Show specific trade examples where alpha was lost. What should each mode's return be given the signal quality?`, {
    label: `expert:hedge-fund-pm:r${round}`,
    phase: 'Expert Analysis',
    model: 'opus'
  }),

  () => agent(`You are a quantitative risk manager. Audit risk controls. Focus on: ${focusModes}. Round ${round}.

DATA:
${DATA}

Check: circuit breaker firing dates, DD breaker blocking entries, VWAP gate rejection rate, SL cooldown duration, stale tightening damage, correlation risk, position sizing. Severity-rate each finding.`, {
    label: `expert:risk-manager:r${round}`,
    phase: 'Expert Analysis',
    model: 'opus'
  }),

  () => agent(`You are a senior quant dev. Audit sweep.js simulation code. Focus on: ${focusModes}. Round ${round}.

DATA:
${DATA}

Read tools/sweep.js. Check: simulateTrade entry/stop/TP logic, simulatePortfolio candidate selection, live injection code, equity curve computation, FROZEN_ONLY append logic. Report specific line numbers for any bugs.`, {
    label: `expert:quant-dev:r${round}`,
    phase: 'Expert Analysis',
    model: 'opus'
  }),

  () => agent(`You are an alpha researcher. Analyze signal-to-execution gap. Focus on: ${focusModes}. Round ${round}.

DATA:
${DATA}

For each recent signal: compute actual 5d/10d/20d returns from price cache. Compare realized vs potential. Decompose leakage: entry slippage, stop drag, horizon mismatch, filter waste. What's the theoretical max return if we just bought score>=90 at open and held 20 days?`, {
    label: `expert:alpha-researcher:r${round}`,
    phase: 'Expert Analysis',
    model: 'opus'
  }),
])

const [pmReport, riskReport, devReport, alphaReport] = expertResults

log(`4 experts done. Synthesizing in war room.`)

phase('War Room')

const warRoom = await agent(`You are the CIO. 4 experts audited the scanner. Synthesize into a PRIORITIZED action plan.

Focus: ${focusModes}. Round ${round}.

## Expert Reports
### PM: ${typeof pmReport === 'string' ? pmReport.slice(0, 15000) : JSON.stringify(pmReport).slice(0, 15000)}
### Risk: ${typeof riskReport === 'string' ? riskReport.slice(0, 15000) : JSON.stringify(riskReport).slice(0, 15000)}
### Dev: ${typeof devReport === 'string' ? devReport.slice(0, 15000) : JSON.stringify(devReport).slice(0, 15000)}
### Alpha: ${typeof alphaReport === 'string' ? alphaReport.slice(0, 15000) : JSON.stringify(alphaReport).slice(0, 15000)}

Output:
1. IMMEDIATE FIXES — exact file + line + change + expected impact
2. HIGH PRIORITY — this week
3. INVESTIGATE — needs more data
4. NO ACTION — acceptable

End with projected returns per mode if fixes applied.`, {
  label: `warroom:cio:r${round}`,
  phase: 'War Room',
  model: 'opus'
})

return { warRoom, round }
