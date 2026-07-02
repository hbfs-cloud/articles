#!/bin/bash
set -e
cd /home/ci/projects/articles

# Calculate scan date (next trading session)
export SCAN_DATE=$(python3 -c "import datetime; today=datetime.date.today(); dow=today.weekday(); delta=3 if dow==4 else 2 if dow==5 else 1 if dow==6 else 1; print((today+datetime.timedelta(days=delta)).strftime('%Y%m%d'))")
echo "Scan date (next session): $SCAN_DATE"

# Export Anthopic API key
export ANTHROPIC_API_KEY=$(grep -E "^export ANTHROPIC_API_KEY=" ~/.profile | head -1 | cut -d= -f2- | tr -d "'") 2>/dev/null || echo "Warning: ANTHROPIC_API_KEY not found"

# Run the daily scanner via claude command
echo "Running claude --print with 'articles scan du jour'..."
timeout 1800 ~/.npm-global/bin/claude --print \
    --permission-mode bypassPermissions \
    --model claude-opus-4-6 \
    "articles scan du jour" > scanner/$SCAN_DATE/index.html 2>&1

# Check if HTML was generated
HTML_SIZE=$(wc -c < scanner/$SCAN_DATE/index.html)
echo "Generated HTML size: $HTML_SIZE bytes"

if [ $HTML_SIZE -gt 30000 ]; then
    echo "✅ HTML generated successfully (>30KB)"
else
    echo "⚠️  HTML may be too small, checking content..."
fi

# Index the scan
echo "Indexing via add_card.js..."
node tools/add_card.js scanner/$SCAN_DATE/index.html

# Commit and push
echo "Committing and pushing..."
git add scanner/$SCAN_DATE/index.html
git add data/scanner.json
git commit -m "scanner: daily scan $SCAN_DATE"
git push origin main

# Run publish-daily-card.sh pipeline
echo "Running publish-daily-card.sh pipeline..."
./tools/publish-daily-card.sh

echo "✅ Daily scan completed for $SCAN_DATE"