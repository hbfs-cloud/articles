#!/bin/bash
set -e
cd /home/ci/projects/articles

# Calculate scan date (next trading session)
export SCAN_DATE=$(python3 -c "import datetime; today=datetime.date.today(); dow=today.weekday(); delta=3 if dow==4 else 2 if dow==5 else 1 if dow==6 else 1; print((today+datetime.timedelta(days=delta)).strftime('%Y%m%d'))")
echo "Scan date (next session): $SCAN_DATE"

# Export Anthopic API key
export ANTHROPIC_API_KEY=$(grep -E "^export ANTHROPIC_API_KEY=" ~/.profile | head -1 | cut -d= -f2- | tr -d "'") 2>/dev/null || echo "Warning: ANTHROPIC_API_KEY not found"

# Export broker-simulator service token (same source as ANTHROPIC_API_KEY). Without it the
# articles->broker-sim parallel-run (reconcile + publish) is a silent no-op; warn loudly so a
# missing token is visible in the nightly log instead of being swallowed by || true / || echo.
export BROKERSIM_SERVICE_TOKEN=$(grep -E "^export BROKERSIM_SERVICE_TOKEN=" ~/.profile | head -1 | cut -d= -f2- | tr -d "'") 2>/dev/null || true
if [ -z "$BROKERSIM_SERVICE_TOKEN" ]; then
    echo "WARNING: parallel-run disabled — BROKERSIM_SERVICE_TOKEN not set (reconcile + publish will skip)"
fi

# Bootstrap-once: auto-onboard any pilot mode whose mirror:<mode> account has no fills yet but
# does have pit-state data (seeds its frozen history exactly once; skips forever after). This is
# how a NEW mode self-onboards the first night its sim account exists — no manual step. The tool
# always exits 0, so a missing token / sim outage never aborts the nightly.
echo "Bootstrapping broker-simulator mirror accounts (once per new mode)..."
node tools/export-to-simulator.js --sync || true

# Catch the broker-simulator up to the last completed session (enter pending mirror-orders
# at the next-open + replay intraday SL/TP), THEN reconcile articles vs the sim BEFORE the new
# scan mutates pit-state. Both are non-blocking (|| true): a sim outage/breach never aborts the
# nightly — the Discord alert from reconcile is the signal.
echo "Running broker-simulator mirror engine for the last session..."
node tools/run-mirror.js || true
echo "Reconciling broker-simulator parallel-run..."
node tools/reconcile-simulator.js || true

# Auto cutover decision (self-reverting): read the freshly-appended reconciliation log and, per
# mode, flip data/source-of-truth.json to "sim" after CUTOVER_DAYS consecutive zero-divergence
# days (auto-revert to "articles" on any fresh divergence). The read-switch in gen-api.js /
# gen-status-page.js consumes this with a HARD FALLBACK to pit-state. Non-blocking (exit 0).
echo "Computing broker-simulator cutover decision..."
node tools/cutover-decision.js || true

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