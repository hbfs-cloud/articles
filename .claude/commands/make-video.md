# /make-video — Produce a complete YouTube video from any topic

End-to-end autonomous video production pipeline.
Input: a topic in natural language. Output: a published YouTube video.

## Input

`$ARGUMENTS` — Examples:
- `une vidéo sur le RSI et les indicateurs techniques`
- `how options pricing works, in english`
- `les 10 meilleurs ETF pour 2026`
- `analyse technique de NVDA et AMD`
- `debuter-trading` (existing series — skip content generation)

## Step 0 — Parse & research

Extract from `$ARGUMENTS`:
- **Topic**: the video subject
- **Language**: `fr` (default) or `en`
- **Series ID**: slugify topic (e.g. `rsi-indicateurs-techniques`)
- **Upload**: YES by default. "sans upload" / "no upload" to skip.
- **Duration**: ~30-60 min unless specified

### Research the topic

Before generating content, gather real data:

1. **Check existing articles** for relevant content:
   - `grep -rl "{topic keywords}" daily/ weekly/ scanner/ analyses/ series/ tech/`
   - Read the most relevant articles to extract data, insights, examples
   - Reuse real trade setups, market data, and analysis from our publications

2. **MCP Gateway** — pull live market data when the topic involves specific tickers/markets:
   - `GetMarketOverview` for macro context
   - `QueryData` types=quote,social_sentiment,capital_flow for specific tickers
   - `GetInstruments` for deep ticker analysis
   - `RunAutoScreener` if the topic is about screening/stock picking

3. **Finviz charts** — for any ticker-specific content, note the Finviz chart URLs to reference in slides:
   ```
   https://charts2.finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p=d&s=l
   ```

4. **WebSearch** — for recent events, statistics, or data not in our articles/MCP

## Step 1 — Generate content

Check if `videos/public/edu-data-{seriesId}.json` exists. If yes, skip to Step 2.

Create two JSON files using research data:

### `videos/public/edu-data-{seriesId}.json`

```json
{
  "config": {
    "seriesTitle": "Title",
    "seriesSubtitle": "Subtitle",
    "date": "Month Year",
    "language": "fr",
    "accentColor": "#3b82f6",
    "totalChapters": N
  },
  "slides": [ ... ]
}
```

### Slide types (20 types disponibles)

**Fondamentaux** (contenu texte) :

| Type | Fields | Use for |
|------|--------|---------|
| `chapter-intro` | `chapter: { title, subtitle, partNumber, totalParts }` | Début de chapitre |
| `bullets` | `title`, `items: [string]` | Points clés (4-6 items) |
| `concept` | `title`, `text` | Explication d'un terme/concept |
| `tip` | `title`, `text` | Conseil pratique, pro tip |
| `warning` | `title`, `text` | Risques, pièges, erreurs courantes |
| `quote` | `text`, `source` | Citation (Buffett, Munger, Taleb...) |
| `summary` | `title`, `items: [string]` | Récap de chapitre |
| `highlight` | `title`, `text`, `icon` | Point clé plein écran |
| `quiz` | `question`, `choices: [string]`, `correctIndex`, `explanation` | Quiz interactif |

**Données & comparaisons** :

| Type | Fields | Use for |
|------|--------|---------|
| `table` | `title`, `headers: [string]`, `rows: [[string]]` | Tableau de données |
| `comparison` | `title`, `left: {label,items}`, `right: {label,items}` | Côte à côte |
| `metric-row` | `title`, `metrics: [{label,value,delta?,trend?}]` | KPI cards (3-4 métriques) |
| `trade-levels` | `title`, `ticker?`, `levels: [{type,label,value}]` | Niveaux entry/stop/TP |
| `performance` | `title`, `tickers: [{symbol,name?,perf}]` | Classement performances |
| `event-timeline` | `title`, `events: [{time,title,description?,impact}]` | Calendrier événements |

**Visuel & technique** :

| Type | Fields | Use for |
|------|--------|---------|
| `steps` | `title`, `steps: [{number?,title,description}]` | Processus numéroté |
| `didactic` | `title`, `text`, `icon?`, `source?` | Box éducative "Le saviez-vous" |
| `chart-image` | `title`, `imageUrl`/`finvizUrl`, `caption?` | Chart Finviz ou image externe |
| `code` | `title`, `code`/`before`+`after`, `language?` | Code ou before/after |
| `architecture` | `title`, `nodes: [{icon?,label,detail?}]`, `hub?` | Diagramme de flux |

Every slide gets: `"audioFile": "{seriesId}_s{index}.wav"`

### Content quality rules

**Style** (from user feedback):
- Dynamique, abordable, didactique — tout public
- Quizzes pour couper le flux (1-2 par chapitre minimum)
- Cas concrets avec chiffres réels (pas de placeholder)
- Si ticker mentionné → données réelles via MCP/articles
- Éviter le jargon sans explication immédiate

**Structure**:
- 4-6 chapitres pour ~30 min, 6-10 pour ~1h
- ~25-35 slides par chapitre
- Varier les types de slides (pas 10 bullets d'affilée)
- Commencer chaque chapitre par chapter-intro, finir par summary
- Au moins 1 quiz par chapitre

**Données réelles obligatoires quand pertinent**:
- Cours actuels des tickers mentionnés (via MCP QueryData)
- Performances historiques (articles weekly/daily)
- Statistiques de marché (VIX, volumes, ratios P/E)
- Charts Finviz dans les descriptions de slides (mentionner le ticker dans le texte, le chart sera visible via la slide)
- Setups scanner récents comme exemples concrets
- Données social sentiment si on parle d'un ticker populaire

### Brand integration dans les slides

Le thème vidéo (`src/video/theme.js`) reprend déjà les codes visuels du site :
- Background dark : `#0a0e1a` (proche du scanner/analyses dark mode)
- Primary blue : `#3b82f6` (identique au site)
- Success green : `#10b981`, Warning amber : `#f59e0b`, Danger red : `#ef4444`
- Font : Inter (identique au site)
- Footer bar : `dailytickers.com` + titre série + numéro slide
- Logo et trademark DailyTickers visibles sur chaque slide

### `videos/public/edu-narration-{seriesId}.json`

```json
[
  { "key": "{seriesId}_s0", "text": "Narration text...", "audioFile": "{seriesId}_s0.wav" },
  ...
]
```

**Narration rules**:
- Écrire comme du parlé naturel (pas du lu)
- Pas de markdown, pas de caractères spéciaux
- Épeler les abréviations au premier usage
- ~15-40s de parole par slide (40-100 mots FR, 50-120 mots EN)
- Chapter intros : annoncer le titre et ce qu'on va voir
- Quiz : lire la question, les options, puis révéler la réponse
- Utiliser des transitions naturelles entre slides ("Passons maintenant à...", "Regardons de plus près...")
- Voix jeune homme dynamique — pas professoral

**Prononciations** (corrections TTS connues):
- "ETF" → "É-Té-Effe"
- "S&P 500" → "S and P 500" (en) / "S and P cinq cent" (fr)
- "RSI" → "R-S-I"
- "MACD" → "M-A-C-D"
- "P/E ratio" → "price to earnings ratio" (en) / "ratio cours sur bénéfice" (fr)
- Éviter les parenthèses dans le texte TTS — reformuler en phrases

## Step 2 — YouTube metadata

Check if the series ID exists in `videos/scripts/make-video.mjs` YOUTUBE_META. If not, add it with:

```javascript
'{seriesId}': {
  title: 'Titre accrocheur (Durée)',
  playlist: 'Formations Trading FR',  // ou 'Trading Education EN'
  description: `Description structurée avec emojis...`,
  tags: ['relevant', 'tags', 'dailytickers.com'],
  lang: 'fr',
},
```

**Description template** :
```
🎓 [Accroche 1 ligne]

📚 Au programme :
• Chapitre 1 : ...
• Chapitre 2 : ...
[...]

🧠 X quizzes interactifs
💡 Cas concrets : [exemples]
📊 Données de marché en temps réel

⚠️ Ceci n'est pas un conseil financier.
🌐 https://articles.dailytickers.com
```

## Step 3 — Run pipeline

```bash
cd /Users/marketwatchxyz/GolandProjects/articles/videos
node scripts/make-video.mjs {seriesId} --upload
```

Run in background. Monitor every 5 min with timestamps (HH:MM).

## Step 4 — Thumbnails

Extract from video at chapter timestamps:
```bash
mkdir -p output/thumbnails-{seriesId}
ffmpeg -y -ss {timestamp} -i output/{seriesId}.mp4 -frames:v 1 -q:v 2 output/thumbnails-{seriesId}/chapter_N.png
```

## Step 5 — Git commit & push

```bash
git add videos/public/edu-data-{seriesId}.json videos/public/edu-narration-{seriesId}.json videos/scripts/make-video.mjs
git commit -m "feat: video {seriesId} — {titre court}"
git push origin main
```

Ne PAS commiter : .wav, .mp4, thumbnails, youtube credentials.

## Technical reference

| Paramètre | Valeur |
|-----------|--------|
| Edge-TTS | `/opt/homebrew/bin/edge-tts` |
| Voix FR | `fr-FR-RemyMultilingualNeural` (rate -5%) — gère le code-switching FR↔EN |
| Voix EN | `en-US-AndrewMultilingualNeural` (rate -5%) |
| Résolution | 1920x1080 |
| Codec | H264 CRF 18, AAC 192k, 30fps |
| YouTube creds | `/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video/` |
| Output | `videos/output/{seriesId}.mp4` |
| Brand colors | Primary `#3b82f6`, Success `#10b981`, Warning `#f59e0b`, Danger `#ef4444` |
| Logo | `/public/logo.svg` — shield DailyTickers |
| Finviz | `https://charts2.finviz.com/chart.ashx?t={TICKER}&ty=c&ta=1&p=d&s=l` |

$ARGUMENTS
