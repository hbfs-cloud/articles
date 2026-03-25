---
name: ticker-video
description: Generate a 5-minute YouTube analysis video for any stock ticker. Handles data collection, slide generation, TTS, Remotion render, and YouTube upload.
user_invocable: true
---

# /ticker-video — Generate Ticker Analysis Video

Generate a complete 5-minute YouTube video for a stock ticker analysis.

Arguments: `<TICKER>` (e.g., `FCX`, `AAPL`, `TSLA`)

## Pipeline Steps

### Step 1: Data Collection
Use MCP tools to gather all data for the ticker:
```
mcp__market-watch__QueryData types=quote,stats,earnings_quarterly,holders,sentiment_overall,trading_signals,analyst_actions,insider_transactions,support_resistance,options_chain symbols={TICKER}
mcp__market-watch__QueryData types=bars_daily symbols={TICKER} limit=90
WebSearch "{TICKER} {COMPANY} latest earnings revenue analysis 2026"
WebSearch "{TICKER} SEC filing S-3 prospectus dilution warrants"
```

### Step 2: Download Finviz Chart
```bash
curl -L -H "User-Agent: Mozilla/5.0" -o videos/public/images/{ticker}-finviz.png "https://charts2.finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p=d&s=l"
```

### Step 3: Generate Slide Data
Write `videos/public/edu-data.json` with this structure:
- **config**: seriesTitle, seriesSubtitle, date, language (en), accentColor (#3b82f6), totalChapters (5), ticker, tickerName, tickerPrice, tickerChange, tickerLogo (parqet URL), tickerMarketCap, tickerDividend, tickerGrade, finvizChart
- **slides** (18 slides, 5 chapters):
  1. `title` — Ticker name, grade, subtitle
  2. `metric` — Conviction score gauge
  3. `bullets` — Bull vs Bear (🟢/🔴 prefixed items for two-column layout)
  4. `chapter-intro` — Business & Fundamentals
  5. `concept` — Business overview text
  6. `table` — Key metrics (P/E, Div Yield, EV/EBITDA, MCap, Beta, Book Value) with Signal column
  7. `tip` — Earnings beat / key insight
  8. `chapter-intro` — Technical Setup
  9. `concept` — Price action (title MUST contain "Price Action" for Finviz chart display)
  10. `bullets` — Support & Resistance levels (title must contain "Support" for visual ladder)
  11. `warning` — Overextension / key risk alert
  12. `chapter-intro` — Risks & Catalysts
  13. `bullets` — Key risks
  14. `bullets` — Upcoming catalysts
  15. `tip` — Options / sentiment insight
  16. `chapter-intro` — Trade Idea
  17. `highlight` — Trade levels (pipe-separated: Entry | Stop Loss | Target 1 | Target 2 | R/R)
  18. `summary` — Key takeaways (5 items)

Write `videos/public/edu-narration.json` — 18 narration segments (~750 words total for 5 min). Professional, punchy, conversational English.

### Step 4: Generate TTS
```bash
cd articles/videos && node scripts/generate-edu-tts.mjs --batch-size 3
```
Uses Qwen3-TTS VoiceDesign with ref_audio voice cloning from `public/audio/ref_voice_en.wav`.

### Step 5: Render Video
```bash
cd articles/videos && ./node_modules/.bin/remotion render src/index.tsx TickerAnalysis output/{ticker}-analysis.mp4 --concurrency=4
```
Renders at 1920x1080, 30fps using TickerAnalysis component (light mode, Ken Burns backgrounds).

### Step 6: Generate Thumbnail
```bash
./node_modules/.bin/remotion still src/index.tsx TickerAnalysis output/{ticker}-analysis-thumb.png --frame=30
```

### Step 7: Upload to YouTube
Create upload script or use `scripts/_upload-ticker.mjs` pattern:
- Title: `{TICKER} — {Company} | {Grade} Analysis | {Price}`
- Tags: ticker, company name, stock analysis, sector, trade idea, marketwatchxyz, market-watch.xyz
- Chapters from slide data (chapter-intro timestamps)
- Playlist: "Analyses EN"
- Privacy: public

### Step 8: Delete Previous Video (if re-uploading)
Use YouTube API to delete the old video by ID before uploading new one.

### Step 9: Commit & Push
```bash
git add videos/src/TickerAnalysis.tsx videos/public/edu-data.json videos/public/edu-narration.json
git commit -m "feat: {TICKER} analysis video — {Grade}, {Price}"
git push origin main
```

## Quality Checklist (QA)
Before uploading, render test frames and verify:
- [ ] Title slide shows: ticker badge, company name, grade, stats, background
- [ ] Metric slide: conviction score with animated ring
- [ ] Bull/Bear: two-column green/red layout
- [ ] Table: colored signal badges, readable
- [ ] Finviz chart: 95% width, visible and sharp
- [ ] S/R levels: visual price ladder with colored bars
- [ ] Warning: amber card, readable text (36px+)
- [ ] Trade idea: structured grid with colored entry/stop/target cards
- [ ] Bottom bar: MW | TICKER | Company | Price | Change
- [ ] Progress bar at top
- [ ] Ken Burns backgrounds on all slides
- [ ] No broken images or blank frames

## Component Location
- `videos/src/TickerAnalysis.tsx` — Remotion component
- `videos/src/Root.tsx` — Composition registration
- `videos/scripts/generate-edu-tts.mjs` — TTS pipeline
- `videos/scripts/pipeline.mjs` — Full pipeline (for educational videos)
