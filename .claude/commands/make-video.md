# /make-video — Generate a complete YouTube video from a topic

End-to-end video production: topic → slides → TTS → render → thumbnails → YouTube upload.

## Input

The user describes a video topic in natural language, optionally with a language.

Examples:
- `/make-video une vidéo sur le RSI et les indicateurs techniques`
- `/make-video how options pricing works, in english`
- `/make-video les crypto-monnaies pour débutants en français`
- `/make-video debuter-trading` (existing series, skip content generation)

## Step 0 — Parse input

Extract from `$ARGUMENTS`:
- **Topic**: the subject of the video
- **Language**: `fr` (default) or `en` — detect from user's language or explicit mention
- **Series ID**: slugify the topic (e.g. `rsi-indicateurs-techniques`). If it matches an existing series, reuse its data.
- **Upload**: default YES. User can say "sans upload" / "no upload" to skip.
- **Duration target**: ~30-60 min unless user specifies (e.g. "une vidéo courte de 15 min")

## Step 1 — Generate content (if not existing)

Check if `videos/public/edu-data-{seriesId}.json` already exists. If yes, skip to Step 2.

If not, **generate the content yourself**. Create two JSON files:

### `videos/public/edu-data-{seriesId}.json`

```json
{
  "config": {
    "seriesTitle": "Title of the video",
    "seriesSubtitle": "One-line subtitle",
    "date": "Month Year",
    "language": "fr",
    "accentColor": "#3b82f6",
    "totalChapters": N
  },
  "slides": [ ... ]
}
```

**Slide types available** (mix them for variety):

| Type | Required fields | Use for |
|------|----------------|---------|
| `chapter-intro` | `chapter: { title, subtitle, partNumber, totalParts }` | Start of each chapter |
| `bullets` | `title`, `items: [string]` | Key points (4-6 items max) |
| `table` | `title`, `headers: [string]`, `rows: [[string]]` | Comparisons, data |
| `concept` | `title`, `definition`, `details` | Key term explanation |
| `tip` | `title`, `content` | Practical advice |
| `warning` | `title`, `content` | Risks, pitfalls |
| `steps` | `title`, `items: [string]` | Numbered process |
| `quote` | `quote`, `author` | Notable quote |
| `comparison` | `title`, `left: {label,items}`, `right: {label,items}` | Side by side |
| `quiz` | `question`, `options: [string]`, `correct: index`, `explanation` | Interactive quiz |
| `summary` | `title`, `items: [string]` | Chapter recap |

**Content guidelines** (from user feedback):
- Style dynamique, abordable, didactique — tout public
- Ajouter des quizzes pour couper le flux (1-2 par chapitre)
- Inclure des cas concrets, chiffres, exemples réels
- Éviter le jargon sans explication
- 4-6 chapitres pour ~30 min, 6-10 pour ~1h
- ~30-40 slides par chapitre
- Each slide gets an `audioFile` field: `"{seriesId}_s{index}.wav"`

### `videos/public/edu-narration-{seriesId}.json`

Array of narration segments, one per slide:
```json
[
  { "key": "{seriesId}_s0", "text": "Narration text spoken aloud...", "audioFile": "{seriesId}_s0.wav" },
  ...
]
```

**Narration guidelines**:
- Write as spoken French/English (natural, not read-aloud)
- No markdown, no special characters that break TTS
- Spell out abbreviations on first use
- ~15-40 seconds of speech per slide (40-100 words FR, 50-120 words EN)
- Chapter intros: announce chapter title and what will be covered
- Quiz slides: read the question, options, then reveal the answer with explanation

## Step 2 — Add YouTube metadata

Check if the series ID exists in `videos/scripts/make-video.mjs` YOUTUBE_META. If not, add it:

```javascript
'{seriesId}': {
  title: 'Video Title (Duration)',
  playlist: 'Formations Trading FR',  // or 'Trading Education EN'
  description: `Description with emojis and structure...`,
  tags: ['relevant', 'tags'],
  lang: 'fr',  // or 'en'
},
```

## Step 3 — Run the pipeline

```bash
cd /Users/marketwatchxyz/GolandProjects/articles/videos
node scripts/make-video.mjs {seriesId} --upload
```

Run in background. Monitor every 5 min with timestamps (HH:MM):
- Step 1/5: TTS (Edge-TTS, ~1 slide/sec)
- Step 2/5: Screenshots (Puppeteer, ~1 slide/sec)
- Step 3/5: FFmpeg segments (~6s per segment)
- Step 4/5: Concatenation (~5-15 min)
- Step 5/5: Chapters

## Step 4 — Thumbnails

After pipeline completes, extract thumbnails from the video:
```bash
ffmpeg -y -ss {timestamp} -i output/{seriesId}.mp4 -frames:v 1 -q:v 2 output/thumbnails-{seriesId}/chapter_N.png
```
One global thumbnail + one per chapter.

## Step 5 — YouTube upload

The pipeline handles upload if `--upload` flag is set. Verify:
- Video uploaded with title, description, chapters, tags
- Thumbnail set
- Added to playlist
- Report the YouTube URL

## Step 6 — Git commit

```bash
git add videos/public/edu-data-{seriesId}.json videos/public/edu-narration-{seriesId}.json videos/scripts/make-video.mjs .claude/commands/make-video.md
git commit -m "feat: video {seriesId} — {short title}"
git push origin main
```

Do NOT commit: .wav files, .mp4 files, thumbnails, youtube credentials.

## Technical reference

- Edge-TTS: `/opt/homebrew/bin/edge-tts`
- Voices: FR `fr-FR-HenriNeural`, EN `en-US-AndrewNeural` (rate: -5%)
- Video: 1920x1080, CRF 18, H264, 30fps, AAC 192k
- YouTube credentials: `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video/`
- Output: `videos/output/{seriesId}.mp4`

$ARGUMENTS
