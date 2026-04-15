export const tradingTheme = {
  name: 'Trading Dark',
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  background: '#0a0e1a',
  surface: '#111827',
  surfaceLight: '#1f2937',
  text: '#ffffff',
  textMuted: '#94a3b8',
  gradient: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
  gradientAlt: 'linear-gradient(135deg, #3b82f6 0%, #f59e0b 100%)',
  fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    .reveal { font-family: 'Inter', system-ui, sans-serif; }
    .reveal h1, .reveal h2, .reveal h3 { font-weight: 800; letter-spacing: -0.02em; }
    .reveal h1 { font-size: 2.6em; }
    .reveal h2 { font-size: 1.8em; margin-bottom: 0.4em; }
    .reveal h3 { font-size: 1.2em; }
    .reveal p { font-size: 0.85em; line-height: 1.6; }

    .slide-background { background: #0a0e1a !important; }
    .reveal .slides section { padding: 30px 50px 60px; }

    /* ── Animations ──────────────────────────────────────────────── */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeInLeft {
      from { opacity: 0; transform: translateX(-30px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeInRight {
      from { opacity: 0; transform: translateX(30px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
      50%       { box-shadow: 0 0 40px rgba(59,130,246,0.6); }
    }

    .animate { animation: fadeInUp 0.6s ease both; }
    .animate-left { animation: fadeInLeft 0.6s ease both; }
    .animate-right { animation: fadeInRight 0.6s ease both; }
    .animate-scale { animation: fadeInScale 0.6s ease both; }

    .d1 { animation-delay: 0.1s; }
    .d2 { animation-delay: 0.2s; }
    .d3 { animation-delay: 0.3s; }
    .d4 { animation-delay: 0.4s; }
    .d5 { animation-delay: 0.5s; }
    .d6 { animation-delay: 0.6s; }
    .d7 { animation-delay: 0.7s; }
    .d8 { animation-delay: 0.8s; }

    /* ── Badge ───────────────────────────────────────────────────── */
    .trading-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 16px; border-radius: 100px;
      background: rgba(59,130,246,0.15);
      border: 1px solid rgba(59,130,246,0.3);
      color: #93c5fd; font-size: 0.72em; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      margin-bottom: 14px;
    }

    /* ── Chapter Intro ───────────────────────────────────────────── */
    .chapter-intro-wrap {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; min-height: 80vh; gap: 20px;
    }
    .chapter-number {
      font-size: 7em; font-weight: 900; line-height: 1;
      background: linear-gradient(135deg, #3b82f6, #10b981);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; opacity: 0.9;
    }
    .chapter-title {
      font-size: 2.2em; font-weight: 800; color: #ffffff;
      letter-spacing: -0.02em; margin: 0;
    }
    .chapter-subtitle {
      font-size: 0.9em; color: #94a3b8; max-width: 640px;
      line-height: 1.5; margin: 0;
    }
    .chapter-progress {
      display: flex; gap: 8px; margin-top: 10px;
    }
    .progress-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: rgba(255,255,255,0.15);
    }
    .progress-dot.active {
      background: linear-gradient(135deg, #3b82f6, #10b981);
      animation: pulseGlow 2s ease-in-out infinite;
    }

    /* ── Metric Card ─────────────────────────────────────────────── */
    .metric-card {
      background: linear-gradient(145deg, #111827 0%, #1f2937 100%);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: 14px; padding: 18px 22px;
      text-align: left; position: relative; overflow: hidden;
    }
    .metric-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0;
      height: 3px; background: linear-gradient(90deg, #3b82f6, #10b981);
    }
    .metric-card .label {
      color: #94a3b8; font-size: 0.7em; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
    }
    .metric-card .value { color: #fff; font-size: 1.7em; font-weight: 800; line-height: 1.1; }
    .metric-card .delta { font-size: 0.75em; font-weight: 600; margin-top: 4px; }
    .metric-card .delta.positive { color: #10b981; }
    .metric-card .delta.negative { color: #ef4444; }

    /* ── Data Table ──────────────────────────────────────────────── */
    .data-table {
      width: 100%; border-collapse: separate; border-spacing: 0;
      font-size: 0.62em; border-radius: 10px; overflow: hidden;
      border: 1px solid rgba(59,130,246,0.2);
    }
    .data-table thead th {
      background: rgba(59,130,246,0.15); color: #93c5fd;
      padding: 10px 14px; text-align: left; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.9em;
    }
    .data-table tbody td {
      padding: 8px 14px; border-bottom: 1px solid rgba(59,130,246,0.08);
      color: #e2e8f0;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: rgba(59,130,246,0.06); }
    .data-table .positive { color: #10b981; font-weight: 600; }
    .data-table .negative { color: #ef4444; font-weight: 600; }

    /* ── Grids ───────────────────────────────────────────────────── */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

    /* ── Tags ────────────────────────────────────────────────────── */
    .tag { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 0.7em; font-weight: 600; }
    .tag-blue   { background: rgba(59,130,246,0.2); color: #93c5fd; }
    .tag-green  { background: rgba(16,185,129,0.2); color: #34d399; }
    .tag-amber  { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .tag-red    { background: rgba(239,68,68,0.2); color: #f87171; }

    /* ── Timeline / Steps ────────────────────────────────────────── */
    .timeline { position: relative; padding-left: 36px; text-align: left; }
    .timeline::before {
      content: ''; position: absolute; left: 12px; top: 0; bottom: 0;
      width: 2px; background: linear-gradient(180deg, #3b82f6, #10b981);
    }
    .timeline-item { position: relative; margin-bottom: 20px; }
    .timeline-item::before {
      content: ''; position: absolute; left: -30px; top: 6px;
      width: 16px; height: 16px; border-radius: 50%;
      background: #3b82f6; border: 3px solid #0a0e1a;
      box-shadow: 0 0 0 2px #3b82f6;
    }
    .timeline-item .step-number {
      position: absolute; left: -30px; top: 4px;
      width: 16px; height: 16px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #10b981);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.45em; font-weight: 800; color: #fff;
      border: 2px solid #0a0e1a;
    }
    .timeline-item h4 { color: #fff; margin: 0 0 4px; font-weight: 700; font-size: 0.95em; }
    .timeline-item p  { color: #94a3b8; margin: 0; font-size: 0.82em; line-height: 1.4; }

    /* ── Highlight / Concept boxes ───────────────────────────────── */
    .highlight-box {
      background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.08));
      border-left: 4px solid #3b82f6; border-radius: 0 12px 12px 0;
      padding: 18px 22px; text-align: left; margin: 12px 0;
    }
    .highlight-box p { color: #cbd5e1; font-size: 0.85em; line-height: 1.6; margin: 0; }

    .tip-box {
      background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.05));
      border: 1px solid rgba(16,185,129,0.3); border-radius: 12px;
      padding: 20px 24px; text-align: left;
    }
    .tip-box .tip-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 10px;
    }
    .tip-box .tip-icon {
      font-size: 1.4em; line-height: 1;
    }
    .tip-box .tip-label {
      font-size: 0.7em; font-weight: 700; color: #34d399;
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    .tip-box p { color: #d1fae5; font-size: 0.84em; line-height: 1.6; margin: 0; }

    .warning-box {
      background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05));
      border: 1px solid rgba(239,68,68,0.3); border-radius: 12px;
      padding: 20px 24px; text-align: left;
    }
    .warning-box .warning-header {
      display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
    }
    .warning-box .warning-icon { font-size: 1.4em; }
    .warning-box .warning-title { font-size: 1em; font-weight: 700; color: #f87171; }
    .warning-box p { color: #fecaca; font-size: 0.84em; line-height: 1.6; margin: 0; }

    /* ── Bullets ─────────────────────────────────────────────────── */
    .bullet-list { list-style: none; padding: 0; margin: 0; text-align: left; }
    .bullet-list li {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(59,130,246,0.08);
      font-size: 0.8em; color: #e2e8f0; line-height: 1.4;
    }
    .bullet-list li::before {
      content: '▸'; color: #3b82f6; font-size: 1.1em;
      flex-shrink: 0; margin-top: 1px; font-weight: 700;
    }

    /* ── Quote ───────────────────────────────────────────────────── */
    .quote-wrap {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; gap: 20px; min-height: 60vh;
    }
    .quote-mark { font-size: 5em; color: #3b82f6; line-height: 0.6; opacity: 0.5; }
    .quote-text {
      font-size: 1.6em; font-weight: 700; color: #fff;
      line-height: 1.3; max-width: 700px;
      font-style: italic;
    }
    .quote-source {
      font-size: 0.75em; color: #94a3b8; font-style: normal; max-width: 600px;
    }

    /* ── Comparison ──────────────────────────────────────────────── */
    .comparison-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
      text-align: left;
    }
    .comparison-col { border-radius: 14px; padding: 20px; }
    .comparison-col.positive {
      background: rgba(16,185,129,0.08);
      border: 1px solid rgba(16,185,129,0.25);
    }
    .comparison-col.negative {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
    }
    .comparison-col.neutral {
      background: rgba(59,130,246,0.08);
      border: 1px solid rgba(59,130,246,0.25);
    }
    .comparison-label {
      font-size: 0.7em; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 14px;
    }
    .comparison-col.positive .comparison-label { color: #34d399; }
    .comparison-col.negative .comparison-label { color: #f87171; }
    .comparison-col.neutral  .comparison-label { color: #93c5fd; }
    .comparison-items { list-style: none; padding: 0; margin: 0; }
    .comparison-items li {
      padding: 7px 0; font-size: 0.78em; color: #e2e8f0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;
    }
    .comparison-items li:last-child { border-bottom: none; }
    .comparison-col.positive .comparison-items li::before { content: '✓'; color: #10b981; font-weight: 700; flex-shrink: 0; }
    .comparison-col.negative .comparison-items li::before { content: '✗'; color: #ef4444; font-weight: 700; flex-shrink: 0; }
    .comparison-col.neutral  .comparison-items li::before { content: '→'; color: #3b82f6; font-weight: 700; flex-shrink: 0; }

    /* ── Quiz ────────────────────────────────────────────────────── */
    .quiz-wrap { text-align: left; }
    .quiz-question {
      font-size: 1.15em; font-weight: 700; color: #fff;
      margin-bottom: 20px; line-height: 1.3;
    }
    .quiz-options { list-style: none; padding: 0; margin: 0 0 16px; }
    .quiz-option {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 18px; border-radius: 10px; margin-bottom: 10px;
      border: 1px solid rgba(59,130,246,0.2);
      background: rgba(255,255,255,0.03);
      font-size: 0.8em; color: #e2e8f0; cursor: default; line-height: 1.4;
    }
    .quiz-option.correct {
      background: rgba(16,185,129,0.12);
      border-color: rgba(16,185,129,0.4);
      color: #d1fae5;
    }
    .quiz-letter {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(59,130,246,0.2); color: #93c5fd;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9em; flex-shrink: 0;
    }
    .quiz-option.correct .quiz-letter {
      background: rgba(16,185,129,0.3); color: #34d399;
    }
    .quiz-explanation {
      background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25);
      border-radius: 10px; padding: 14px 18px;
      font-size: 0.78em; color: #fde68a; line-height: 1.5;
    }
    .quiz-explanation strong { color: #f59e0b; }

    /* ── Summary ─────────────────────────────────────────────────── */
    .summary-wrap { text-align: left; }
    .summary-list { list-style: none; padding: 0; margin: 0; }
    .summary-list li {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 12px 16px; margin-bottom: 8px; border-radius: 10px;
      background: rgba(59,130,246,0.06);
      border: 1px solid rgba(59,130,246,0.12);
      font-size: 0.8em; color: #e2e8f0; line-height: 1.4;
    }
    .summary-icon {
      width: 24px; height: 24px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #10b981);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7em; font-weight: 800; color: #fff; flex-shrink: 0;
    }

    /* ── Concept ─────────────────────────────────────────────────── */
    .concept-wrap { text-align: left; }
    .concept-text {
      background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05));
      border-left: 4px solid #3b82f6; border-radius: 0 12px 12px 0;
      padding: 20px 24px; margin-top: 12px;
      font-size: 0.82em; color: #cbd5e1; line-height: 1.7;
    }

    /* ── Chart container ─────────────────────────────────────────── */
    .chart-container {
      background: #111827; border-radius: 16px; padding: 20px;
      border: 1px solid rgba(59,130,246,0.15);
    }

    /* ── Footer bar ──────────────────────────────────────────────── */
    .footer-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 10px 40px; display: flex; justify-content: space-between; align-items: center;
      background: rgba(10,14,26,0.92); border-top: 1px solid rgba(59,130,246,0.15);
      font-size: 0.55em; color: #64748b; z-index: 100;
      backdrop-filter: blur(10px);
    }
    .footer-brand { color: #3b82f6; font-weight: 700; letter-spacing: 0.04em; }
    .footer-slide { font-variant-numeric: tabular-nums; }

    /* ── Section title bar ───────────────────────────────────────── */
    .section-title {
      font-size: 1.5em; font-weight: 800; color: #fff;
      margin-bottom: 20px; display: flex; align-items: center; gap: 12px;
    }
    .section-title::after {
      content: ''; flex: 1; height: 2px;
      background: linear-gradient(90deg, rgba(59,130,246,0.5), transparent);
    }

    /* ── Trade Levels (from Remotion TradeLevel) ─────────────────── */
    .levels-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
      margin-top: 16px;
    }
    .trade-level {
      background: rgba(255,255,255,0.04); border-radius: 10px;
      padding: 14px 18px; text-align: left;
    }
    .trade-level-label {
      font-size: 0.65em; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
    }
    .trade-level-value { font-size: 1.3em; font-weight: 800; color: #fff; }
    .ticker-badge {
      display: inline-block; padding: 4px 16px; border-radius: 8px;
      background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3);
      color: #93c5fd; font-size: 0.8em; font-weight: 700; letter-spacing: 0.04em;
      margin-bottom: 14px;
    }

    /* ── Didactic Box (from Remotion DidacticBox) ────────────────── */
    .didactic-box {
      background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.04));
      border: 1px solid rgba(59,130,246,0.25); border-radius: 16px;
      padding: 28px 32px; text-align: left;
    }
    .didactic-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
    }
    .didactic-icon { font-size: 1.6em; }
    .didactic-label {
      font-size: 0.75em; font-weight: 700; color: #93c5fd;
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .didactic-text { color: #cbd5e1; font-size: 0.88em; line-height: 1.7; margin: 0; }
    .didactic-source {
      margin-top: 14px; font-size: 0.65em; color: #64748b; font-style: italic;
    }

    /* ── Chart Image / Finviz ───────────────────────────────────── */
    .chart-image-wrap { margin-top: 12px; text-align: center; }
    .chart-image-wrap img {
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      border: 1px solid rgba(59,130,246,0.15);
    }
    .chart-caption {
      margin-top: 10px; font-size: 0.6em; color: #64748b;
      font-style: italic; text-align: center;
    }

    /* ── Performance Table (from Remotion PerformanceRow) ────────── */
    .perf-table { margin-top: 12px; }
    .perf-row {
      display: flex; align-items: center; gap: 16px;
      padding: 10px 16px; border-radius: 8px; margin-bottom: 6px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(59,130,246,0.06);
    }
    .perf-row:hover { background: rgba(59,130,246,0.06); }
    .perf-ticker {
      font-size: 0.85em; font-weight: 800; color: #fff;
      min-width: 80px; font-family: 'JetBrains Mono', monospace;
    }
    .perf-name { flex: 1; font-size: 0.75em; color: #94a3b8; }
    .perf-value {
      font-size: 0.85em; font-weight: 700; min-width: 80px; text-align: right;
      font-family: 'JetBrains Mono', monospace;
    }
    .perf-value.positive { color: #10b981; }
    .perf-value.negative { color: #ef4444; }

    /* ── Event Timeline (from Remotion EventItem) ───────────────── */
    .event-timeline { margin-top: 12px; }
    .event-item {
      display: flex; align-items: center; gap: 16px;
      padding: 12px 16px; border-radius: 10px; margin-bottom: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(59,130,246,0.06);
    }
    .event-time {
      font-size: 0.7em; font-weight: 700; color: #93c5fd;
      min-width: 80px; font-family: 'JetBrains Mono', monospace;
    }
    .event-body { flex: 1; }
    .event-title { font-size: 0.82em; font-weight: 600; color: #e2e8f0; }
    .event-desc { font-size: 0.7em; color: #94a3b8; margin-top: 2px; }
    .event-impact {
      font-size: 0.6em; font-weight: 700; padding: 3px 10px;
      border-radius: 6px; text-transform: uppercase; letter-spacing: 0.06em;
      flex-shrink: 0;
    }

    /* ── Code Blocks (from Remotion CodeComparison) ──────────────── */
    .code-comparison {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;
    }
    .code-block {
      background: #0d1117; border-radius: 12px; padding: 18px;
      border: 1px solid rgba(59,130,246,0.12); overflow: hidden;
    }
    .code-block.full { margin-top: 12px; }
    .code-block pre {
      margin: 0; overflow-x: auto;
    }
    .code-block code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.65em; color: #e2e8f0; line-height: 1.6;
      white-space: pre;
    }
    .code-label {
      font-size: 0.6em; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 10px; padding: 3px 10px;
      border-radius: 4px; display: inline-block;
    }
    .code-label.positive { background: rgba(16,185,129,0.15); color: #34d399; }
    .code-label.negative { background: rgba(239,68,68,0.15); color: #f87171; }
    .code-lang {
      font-size: 0.55em; color: #64748b; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 8px; font-weight: 600;
    }

    /* ── Architecture Flow (from Remotion ArchitectureDiagram) ───── */
    .arch-flow {
      display: flex; flex-direction: column; align-items: center;
      gap: 20px; margin-top: 16px;
    }
    .arch-row {
      display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;
    }
    .arch-node {
      background: rgba(255,255,255,0.04); border: 2px solid rgba(59,130,246,0.3);
      border-radius: 14px; padding: 16px 22px; min-width: 160px;
      text-align: center;
    }
    .arch-icon { font-size: 1.5em; display: block; margin-bottom: 6px; }
    .arch-label { font-size: 0.8em; font-weight: 700; color: #fff; }
    .arch-detail { font-size: 0.65em; color: #94a3b8; margin-top: 4px; }
    .arch-hub {
      background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(16,185,129,0.1));
      border: 2px solid rgba(59,130,246,0.4); border-radius: 50%;
      width: 100px; height: 100px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px;
    }
    .arch-hub strong { font-size: 0.7em; color: #93c5fd; }

    /* ── Highlight (fullscreen key insight) ──────────────────────── */
    .highlight-box {
      background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.08));
      border-left: 4px solid #3b82f6; border-radius: 0 16px 16px 0;
      padding: 32px 40px; text-align: left;
    }
    .highlight-icon { font-size: 2.5em; margin-bottom: 12px; }
    .highlight-title { font-size: 1.4em; font-weight: 800; color: #fff; margin: 0 0 12px; }
    .highlight-text { font-size: 0.9em; color: #cbd5e1; line-height: 1.7; margin: 0; }
  `
};

// ── Light theme — bigger fonts, white background, high contrast ─────────
// Activated via config.theme = "light" in edu-data JSON.
export const tradingThemeLight = {
  ...tradingTheme,
  name: 'Trading Light',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceLight: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#475569',
  css: tradingTheme.css
    // ── Background ──
    .replace(/.slide-background \{ background: #0a0e1a !important; \}/, '.slide-background { background: #f8fafc !important; }')
    // ── Font sizes +40% across the board ──
    .replace(/\.reveal h1 \{ font-size: 2\.6em; \}/, '.reveal h1 { font-size: 3.6em; }')
    .replace(/\.reveal h2 \{ font-size: 1\.8em;/, '.reveal h2 { font-size: 2.5em;')
    .replace(/\.reveal h3 \{ font-size: 1\.2em; \}/, '.reveal h3 { font-size: 1.7em; }')
    .replace(/\.reveal p \{ font-size: 0\.85em;/, '.reveal p { font-size: 1.2em;')
    // ── Section padding (bigger margins) ──
    .replace(/\.reveal \.slides section \{ padding: 30px 50px 60px; \}/, '.reveal .slides section { padding: 40px 60px 70px; }')
    // ── Text colors → dark on light ──
    .replaceAll('color: #ffffff', 'color: #0f172a')
    .replaceAll('color: #fff', 'color: #0f172a')
    .replaceAll('color: #e2e8f0', 'color: #1e293b')
    .replaceAll('color: #cbd5e1', 'color: #334155')
    .replaceAll('color: #94a3b8', 'color: #64748b')
    .replaceAll('color: #93c5fd', 'color: #2563eb')
    .replaceAll('color: #d1fae5', 'color: #065f46')
    .replaceAll('color: #fecaca', 'color: #991b1b')
    .replaceAll('color: #fde68a', 'color: #92400e')
    .replaceAll('color: #34d399', 'color: #059669')
    .replaceAll('color: #f87171', 'color: #dc2626')
    .replaceAll('color: #fbbf24', 'color: #d97706')
    // ── Surface backgrounds ──
    .replaceAll('background: #0a0e1a', 'background: #f8fafc')
    .replaceAll('background: #111827', 'background: #ffffff')
    .replaceAll('background: #0d1117', 'background: #f1f5f9')
    .replace(/background: rgba\(10,14,26,0\.92\)/, 'background: rgba(248,250,252,0.95)')
    .replaceAll('background: rgba(255,255,255,0.03)', 'background: rgba(15,23,42,0.04)')
    .replaceAll('background: rgba(255,255,255,0.04)', 'background: rgba(15,23,42,0.05)')
    .replaceAll('background: rgba(255,255,255,0.15)', 'background: rgba(15,23,42,0.08)')
    // ── Gradient backgrounds: ensure dark text on light gradient ──
    .replaceAll('background: linear-gradient(145deg, #111827 0%, #1f2937 100%)', 'background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)')
    .replaceAll('background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.08))', 'background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05))')
    .replaceAll('background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.04))', 'background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02))')
    .replaceAll('background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.05))', 'background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))')
    .replaceAll('background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))', 'background: linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))')
    .replaceAll('background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05))', 'background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.03))')
    // ── Tip/warning box text ensure dark ──
    .replaceAll('color: #065f46', 'color: #064e3b')
    .replaceAll('color: #991b1b', 'color: #7f1d1d')
    // ── Borders ──
    .replaceAll('border: 1px solid rgba(59,130,246,0.08)', 'border: 1px solid rgba(59,130,246,0.15)')
    .replaceAll('border: 1px solid rgba(59,130,246,0.06)', 'border: 1px solid rgba(59,130,246,0.12)')
    .replaceAll('border-bottom: 1px solid rgba(59,130,246,0.08)', 'border-bottom: 1px solid rgba(59,130,246,0.12)')
    .replaceAll('border: 3px solid #0a0e1a', 'border: 3px solid #f8fafc')
    .replaceAll('border: 2px solid #0a0e1a', 'border: 2px solid #f8fafc')
    // ── Table & list font sizes +30% ──
    .replace(/font-size: 0\.62em;/, 'font-size: 0.88em;')
    .replace(/font-size: 0\.55em;[\s\S]*?color: #64748b;[\s\S]*?z-index: 100;/, 'font-size: 0.7em; color: #64748b; z-index: 100;')
    // ── Bullet / list item sizes ──
    .replaceAll('font-size: 0.8em; color: #e2e8f0', 'font-size: 1.05em; color: #1e293b')
    .replaceAll('font-size: 0.78em; color: #e2e8f0', 'font-size: 1.0em; color: #1e293b')
    .replaceAll('font-size: 0.82em; color: #cbd5e1', 'font-size: 1.1em; color: #334155')
    .replaceAll('font-size: 0.84em; color: #d1fae5', 'font-size: 1.1em; color: #065f46')
    .replaceAll('font-size: 0.84em; color: #fecaca', 'font-size: 1.1em; color: #991b1b')
    .replaceAll('font-size: 0.82em;', 'font-size: 1.1em;')
    .replaceAll('font-size: 0.85em;', 'font-size: 1.15em;')
    .replaceAll('font-size: 0.88em;', 'font-size: 1.15em;')
    .replaceAll('font-size: 0.75em;', 'font-size: 1.0em;')
    .replaceAll('font-size: 0.72em;', 'font-size: 0.95em;')
    .replaceAll('font-size: 0.7em;', 'font-size: 0.92em;')
    .replaceAll('font-size: 0.65em;', 'font-size: 0.88em;')
    .replaceAll('font-size: 0.6em;', 'font-size: 0.82em;')
    // ── Metric card value bigger ──
    .replace(/\.metric-card \.value \{[^}]*\}/, '.metric-card .value { color: #0f172a; font-size: 2.2em; font-weight: 800; line-height: 1.1; }')
    // ── Chapter intro bigger ──
    .replace(/\.chapter-title \{[^}]*\}/, '.chapter-title { font-size: 3.0em; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin: 0; }')
    .replace(/\.chapter-subtitle \{[^}]*\}/, '.chapter-subtitle { font-size: 1.3em; color: #64748b; max-width: 700px; line-height: 1.5; margin: 0; }')
    .replace(/\.chapter-number \{[^}]*\}/, '.chapter-number { font-size: 9em; font-weight: 900; line-height: 1; background: linear-gradient(135deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; opacity: 0.9; }')
    // ── Quote bigger ──
    .replace(/\.quote-text \{[^}]*\}/, '.quote-text { font-size: 2.0em; font-weight: 700; color: #0f172a; line-height: 1.3; max-width: 800px; font-style: italic; }')
    // ── Quiz bigger ──
    .replace(/\.quiz-question \{[^}]*\}/, '.quiz-question { font-size: 1.5em; font-weight: 700; color: #0f172a; margin-bottom: 24px; line-height: 1.3; }')
    .replace(/\.quiz-option \{[^}]*\}/, '.quiz-option { display: flex; align-items: center; gap: 16px; padding: 16px 22px; border-radius: 12px; margin-bottom: 12px; border: 2px solid rgba(59,130,246,0.2); background: rgba(59,130,246,0.03); font-size: 1.05em; color: #1e293b; cursor: default; line-height: 1.4; }')
    // ── Highlight bigger ──
    .replace(/\.highlight-title \{ font-size: 1\.4em;/, '.highlight-title { font-size: 2.0em;')
    .replace(/\.highlight-text \{ font-size: 0\.9em;/, '.highlight-text { font-size: 1.25em;')
    // ── Section title ──
    .replace(/\.section-title \{[^}]*\}/, '.section-title { font-size: 2.1em; font-weight: 800; color: #0f172a; margin-bottom: 24px; display: flex; align-items: center; gap: 14px; }')
    // ── Footer bar light ──
    .replace(/\.footer-brand \{ color: #3b82f6;/, '.footer-brand { color: #2563eb;')
};

