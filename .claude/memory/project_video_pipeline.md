---
name: Video Production Pipeline
description: Remotion-based educational video pipeline with XTTS TTS, YouTube upload, sequential processing for disk space
type: project
---

Educational video production pipeline in `videos/` subdirectory using Remotion.

**Architecture:**
- `EducationalVideo.tsx`: Generic component supporting 12 slide types (bullets, concept, table, quiz, etc.)
- `ScannerVideo.tsx`: Scanner-specific component (already deployed)
- Audio-driven durations: each slide = audio length + 1.5s padding
- TTS: XTTS v2 on `ser` (ci@ser.tail5d09f.ts.net), queue-based (`/tmp/tts-queue/`)

**Pipeline scripts (videos/scripts/):**
- `generate-edu-content.mjs <series-id>` → generates `public/edu-data.json` + `public/edu-narration.json`
- `generate-edu-tts.mjs` → sends narration to TTS, downloads WAVs, computes durations
- `pipeline.mjs <series-id>` → full pipeline: content → TTS → render → thumbnail → YouTube upload → cleanup

**Series IDs:** debuter-trading, ai-singularity-fr, ai-singularity-en, swing-trading, maitrise-expert, algo-million, bourses-mena

**Why:** Sequential processing for disk space (35GB free, each video ~2-3GB rendered)

**How to apply:** Run `node scripts/pipeline.mjs <series-id>` for each video. Process one at a time to manage disk space. All videos and playlists are public on YouTube. Use `--concurrency=4` for Remotion renders.
