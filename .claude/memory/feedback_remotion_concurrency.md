---
name: remotion-concurrency
description: Use --concurrency flag when rendering Remotion videos to speed up render time
type: feedback
---

Toujours utiliser `--concurrency` lors du render Remotion pour paralléliser les frames.

**Why:** Un render de 11100 frames (6 min vidéo) a pris ~60 min sans concurrency. Avec `--concurrency=4` ça devrait prendre ~15 min.

**How to apply:** `npx remotion render MarketWatchScanner --concurrency=4 --output output/video.mp4`
