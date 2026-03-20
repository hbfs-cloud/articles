#!/bin/bash
# publish-daily-card.sh
# 
# Script de publication quotidienne du scanner Market Watch.
# Lance update-tracking.js, génère l'image, la publie sur Telegram.
#
# Usage:
#   ./tools/publish-daily-card.sh
#   ./tools/publish-daily-card.sh --dry-run
#
# Prérequis:
#   - .env contenant TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID
#   - puppeteer installé: npm install puppeteer
#   - form-data installé: npm install form-data
#
# Cron (chaque soir à 23h30):
#   30 23 * * 1-5 cd /home/ci/projects/articles && ./tools/publish-daily-card.sh >> /tmp/scanner-publish.log 2>&1

set -e
cd "$(dirname "$0")/.."

echo "=== Scanner Daily Card Publisher ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

# 1. Mise à jour des métriques et positions
echo ""
echo "📊 Step 1: Updating tracking data..."
node tools/update-tracking.js

# 2. Génération de l'image et publication Telegram
echo ""
echo "🖼️  Step 2: Generating image and publishing..."
if [ "$1" = "--dry-run" ]; then
  node tools/generate-scanner-image.js --dry-run
else
  node tools/generate-scanner-image.js --telegram
fi

# 3. Commit de la daily card HTML (pour le lien de partage)
echo ""
echo "📤 Step 3: Committing daily card..."
TODAY=$(date '+%Y%m%d')
if [ -f "scanner-daily-card.html" ]; then
  git add scanner-daily-card.html data/scanner-metrics.json data/scanner-positions.json
  git commit -m "chore: scanner daily card ${TODAY}" --allow-empty || true
  git push origin main
fi

echo ""
echo "✅ Done: $(date '+%H:%M:%S')"
