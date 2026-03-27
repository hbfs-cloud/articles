# /make-video — Generate & upload educational YouTube videos

Parse the input to extract the series ID and options, then run the video pipeline.

## Input parsing

The user provides a series name (in French or English) and optional flags:
- `debuter-trading` / `débuter trading` / `debuter` → series ID: `debuter-trading`
- `ai-singularity-fr` / `singularity fr` / `ia singularité` → series ID: `ai-singularity-fr`
- `ai-singularity-en` / `singularity en` → series ID: `ai-singularity-en`
- `swing-trading` / `swing` → series ID: `swing-trading`
- `maitrise-expert` / `maitrise` / `expert` → series ID: `maitrise-expert`
- `algo-million` / `algo` → series ID: `algo-million`
- `bourses-mena` / `mena` → series ID: `bourses-mena`

Optional flags from user input:
- `--skip-tts` or "sans tts" / "skip audio" → skip TTS generation (reuse existing)
- `--skip-render` or "sans render" / "skip screenshots" → skip Puppeteer screenshots
- `--upload` or "upload" / "met sur youtube" / "publie" → upload to YouTube after render
- `--no-upload` or "pas d'upload" → skip upload (default)

## Pipeline steps

1. **Navigate** to `videos/` directory in the articles project:
   ```bash
   cd /Users/marketwatchxyz/GolandProjects/articles/videos
   ```

2. **Check prerequisites**:
   - `public/edu-data-{seriesId}.json` must exist (slide content)
   - `public/edu-narration-{seriesId}.json` must exist (narration text)
   - If missing, tell the user to generate content first with `node scripts/generate-edu-content.mjs`

3. **Run the pipeline** (runs in background, monitor every 5 min with timestamps):
   ```bash
   node scripts/make-video.mjs {seriesId} [--skip-tts] [--skip-render] [--upload]
   ```

4. **Monitor progress** with timestamps (HH:MM format) every 5 minutes:
   - Step 1/5: TTS audio generation (Edge-TTS, ~1s per segment)
   - Step 2/5: Puppeteer screenshots (~1 slide/sec)
   - Step 3/5: FFmpeg segment compositing (~6s per segment)
   - Step 4/5: Concatenation (~5-15 min for 200+ segments)
   - Step 5/5: Chapter generation

5. **Post-pipeline** (if upload requested):
   - Extract thumbnails from video at chapter timestamps
   - Upload to YouTube with description, chapters, thumbnail, playlist
   - Report YouTube URL

6. **Git commit** the pipeline output metadata (chapters.txt) but NOT video/audio files.

## Available series

| ID | Title | Language | Slides |
|----|-------|----------|--------|
| debuter-trading | Bien Débuter en Trading | FR | 208 |
| ai-singularity-fr | AI Singularity | FR | ~200 |
| ai-singularity-en | AI Singularity | EN | ~200 |
| swing-trading | Swing Trading Rentable | FR | ~150 |
| maitrise-expert | Maîtrise Expert — VIX & Volatilité | FR | ~180 |
| algo-million | De Zéro au Million — Trading Algo | FR | ~160 |
| bourses-mena | Bourses MENA | FR | ~140 |

## Important notes

- Edge-TTS binary: `/opt/homebrew/bin/edge-tts`
- French voice: `fr-FR-HenriNeural`, English voice: `en-US-AndrewNeural`
- YouTube credentials: `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video/youtube-credentials.json`
- Video output: `videos/output/{seriesId}.mp4`
- Thumbnails: `videos/output/thumbnails-{seriesId}/`
- CRF 18 (professional quality), 1920x1080, 30fps

$ARGUMENTS
