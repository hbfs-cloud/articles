#!/usr/bin/env bash
# setup-community.sh — Idempotent community setup script
#
# Ensures:
#   1. Discord #analyse-scanner is read-only (@everyone: view+read, no send, no react, no emoji)
#   2. A permanent Discord invite exists (saved to /tmp/discord-invite-code.txt)
#   3. Telegram env vars are set in ~/.profile
#   4. Website community CTAs updated with correct Telegram + Discord links
#   5. gen-status-page.js template updated with Discord link
#
# Usage:
#   bash tools/setup-community.sh
#   bash tools/setup-community.sh --dry-run
#
# Idempotent: safe to re-run at any time.

set -e
cd "$(dirname "$0")/.."

DRY_RUN=false
[[ "$*" == *"--dry-run"* ]] && DRY_RUN=true

# ── Config ────────────────────────────────────────────────────────────────────
GUILD_ID="1426972172915834900"
SCANNER_CHANNEL_ID="1483382014588747778"
TELEGRAM_INVITE="https://t.me/+gl06cNSLV2RiZmE0"
DISCORD_INVITE_FILE="/tmp/discord-invite-code.txt"

# Load Discord bot token
DISCORD_BOT_TOKEN="${DISCORD_BOT_TOKEN:-$(grep DISCORD_BOT_TOKEN ~/.profile 2>/dev/null | cut -d= -f2- | tr -d "'\"\n")}"
if [ -z "$DISCORD_BOT_TOKEN" ]; then
  DISCORD_BOT_TOKEN="$(env | grep DISCORD_BOT_TOKEN | cut -d= -f2)"
fi

if [ -z "$DISCORD_BOT_TOKEN" ]; then
  echo "❌ DISCORD_BOT_TOKEN not found — skipping Discord steps"
  DISCORD_BOT_TOKEN=""
fi

# ── Step 1: Discord #analyse-scanner — read-only ─────────────────────────────
echo ""
echo "🔒 Step 1: Ensuring #analyse-scanner is read-only for @everyone..."
# allow: VIEW_CHANNEL (1024) + READ_MESSAGE_HISTORY (65536) = 66560
# deny: ADD_REACTIONS (64) + SEND_MESSAGES (2048) + USE_EXTERNAL_EMOJIS (262144) = 264256
ALLOW=66560
DENY=264256

if [ -n "$DISCORD_BOT_TOKEN" ] && [ "$DRY_RUN" != true ]; then
  RESULT=$(curl -s -X PUT \
    "https://discord.com/api/v10/channels/${SCANNER_CHANNEL_ID}/permissions/${GUILD_ID}" \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"allow\": \"${ALLOW}\", \"deny\": \"${DENY}\", \"type\": 0}" \
    -w "\n%{http_code}" 2>/dev/null)
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  if [ "$HTTP_CODE" = "204" ]; then
    echo "  ✅ #analyse-scanner read-only confirmed (allow:$ALLOW deny:$DENY)"
  else
    echo "  ⚠️  Unexpected response: $HTTP_CODE — $(echo "$RESULT" | head -1)"
  fi
else
  echo "  (dry-run or no token: skipped)"
fi

# ── Step 2: Create/verify permanent Discord invite ───────────────────────────
echo ""
echo "🔗 Step 2: Getting permanent Discord invite..."

if [ -n "$DISCORD_BOT_TOKEN" ] && [ "$DRY_RUN" != true ]; then
  # Check existing invites first
  EXISTING=$(curl -s \
    "https://discord.com/api/v10/channels/${SCANNER_CHANNEL_ID}/invites" \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" 2>/dev/null)
  
  PERM_CODE=$(echo "$EXISTING" | python3 -c "
import json,sys
invites = json.loads(sys.stdin.read())
if isinstance(invites, list):
    for inv in invites:
        if inv.get('max_age') == 0 and inv.get('max_uses') == 0:
            print(inv['code'])
            break
" 2>/dev/null)

  if [ -z "$PERM_CODE" ]; then
    # Create new permanent invite
    RESP=$(curl -s -X POST \
      "https://discord.com/api/v10/channels/${SCANNER_CHANNEL_ID}/invites" \
      -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"max_age": 0, "max_uses": 0, "unique": false}' 2>/dev/null)
    PERM_CODE=$(echo "$RESP" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('code',''))" 2>/dev/null)
  fi

  if [ -n "$PERM_CODE" ]; then
    DISCORD_INVITE="https://discord.gg/${PERM_CODE}"
    echo "$PERM_CODE" > "$DISCORD_INVITE_FILE"
    echo "  ✅ Discord invite: $DISCORD_INVITE"
  else
    echo "  ⚠️  Could not get/create invite — using fallback"
    DISCORD_INVITE="https://discord.gg/eb4Ack9aPZ"
  fi
else
  DISCORD_INVITE="https://discord.gg/eb4Ack9aPZ"
  echo "  (dry-run: using existing invite code)"
fi

# ── Step 3: Update Telegram topics env vars in ~/.profile ────────────────────
echo ""
echo "📱 Step 3: Checking Telegram env vars in ~/.profile..."
declare -A TOPICS=(
  ["TELEGRAM_TOPIC_PORTFOLIO"]="72"
  ["TELEGRAM_TOPIC_DAILY"]="73"
  ["TELEGRAM_TOPIC_WEEKLY"]="74"
  ["TELEGRAM_TOPIC_ANALYSIS"]="75"
  ["TELEGRAM_TOPIC_LEARNING"]="76"
  ["TELEGRAM_TOPIC_GROWTH"]="89"
  ["TELEGRAM_TOPIC_CALMAR"]="90"
  ["TELEGRAM_TOPIC_CONSERVATIVE"]="91"
)

for VAR in "${!TOPICS[@]}"; do
  if ! grep -q "^export ${VAR}=" ~/.profile 2>/dev/null; then
    if [ "$DRY_RUN" != true ]; then
      echo "export ${VAR}=${TOPICS[$VAR]}" >> ~/.profile
      echo "  ✅ Added $VAR=${TOPICS[$VAR]} to ~/.profile"
    else
      echo "  (dry-run: would add $VAR=${TOPICS[$VAR]})"
    fi
  else
    echo "  ✅ $VAR already in ~/.profile"
  fi
done

# ── Step 4: Update website community CTA blocks ──────────────────────────────
echo ""
echo "🌐 Step 4: Updating website community CTA with Discord link..."

DISCORD_BTN='      <a href="'"$DISCORD_INVITE"'" target="_blank" rel="noopener" class="cta-btn dc-btn">
        <i class="fab fa-discord"></i>
        <span>
          <strong>Join Discord</strong>
          <small>Read-only · Live updates</small>
        </span>
      </a>'

DISCORD_FOOTER='&nbsp;&middot;&nbsp;
  <a href="'"$DISCORD_INVITE"'" target="_blank" rel="noopener" style="color:#5865F2"><i class="fab fa-discord"></i> Discord</a>'

# Update gen-status-page.js (source template)
if grep -q "community-links" tools/gen-status-page.js; then
  # Check if Discord button already present
  if ! grep -q 'dc-btn' tools/gen-status-page.js; then
    if [ "$DRY_RUN" != true ]; then
      python3 << PYEOF
with open('tools/gen-status-page.js', 'r') as f:
    content = f.read()

# Add Discord button after YouTube button
old = '''      <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" class="cta-btn yt-btn">
        <i class="fab fa-youtube"></i>
        <span>
          <strong>Watch on YouTube</strong>
          <small>Daily Briefing · Weekly Review · Analysis</small>
        </span>
      </a>
    </div>
  </div>
</div>'''

new = '''      <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" class="cta-btn yt-btn">
        <i class="fab fa-youtube"></i>
        <span>
          <strong>Watch on YouTube</strong>
          <small>Daily Briefing · Weekly Review · Analysis</small>
        </span>
      </a>
      <a href="${DISCORD_INVITE_PLACEHOLDER}" target="_blank" rel="noopener" class="cta-btn dc-btn">
        <i class="fab fa-discord"></i>
        <span>
          <strong>Join Discord</strong>
          <small>Read-only · Live updates</small>
        </span>
      </a>
    </div>
  </div>
</div>'''

content = content.replace(old, new)

# Add Discord to footer
old_footer = '''  <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" style="color:#94a3b8"><i class="fab fa-youtube"></i> YouTube</a>
</footer>'''
new_footer = '''  <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" style="color:#94a3b8"><i class="fab fa-youtube"></i> YouTube</a>
  &nbsp;&middot;&nbsp;
  <a href="${DISCORD_INVITE_PLACEHOLDER}" target="_blank" rel="noopener" style="color:#5865F2"><i class="fab fa-discord"></i> Discord</a>
</footer>'''
content = content.replace(old_footer, new_footer)

with open('tools/gen-status-page.js', 'w') as f:
    f.write(content)
print('gen-status-page.js updated')
PYEOF
      echo "  ✅ gen-status-page.js: Discord button added (placeholder)"
    else
      echo "  (dry-run: would add Discord button to gen-status-page.js)"
    fi
  fi
  
  # Replace placeholder with actual invite URL
  if [ "$DRY_RUN" != true ]; then
    sed -i "s|\${DISCORD_INVITE_PLACEHOLDER}|${DISCORD_INVITE}|g" tools/gen-status-page.js
    # Also update any existing discord.gg links
    sed -i "s|https://discord.gg/[A-Za-z0-9]*|${DISCORD_INVITE}|g" tools/gen-status-page.js
    echo "  ✅ gen-status-page.js: Discord invite URL = $DISCORD_INVITE"
  fi
fi

# Update the already-generated scanner/status/index.html directly
if [ -f "scanner/status/index.html" ]; then
  if [ "$DRY_RUN" != true ]; then
    # Add Discord button if missing
    if ! grep -q 'dc-btn' scanner/status/index.html; then
      python3 << PYEOF
with open('scanner/status/index.html', 'r') as f:
    content = f.read()

old = '''      <a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" class="cta-btn yt-btn">
        <i class="fab fa-youtube"></i>
        <span>
          <strong>Watch on YouTube</strong>
          <small>Daily Briefing · Weekly Review · Analysis</small>
        </span>
      </a>
    </div>
  </div>
</div>'''

new = old.replace('''    </div>
  </div>
</div>''', '''      <a href="DISCORD_URL" target="_blank" rel="noopener" class="cta-btn dc-btn">
        <i class="fab fa-discord"></i>
        <span>
          <strong>Join Discord</strong>
          <small>Read-only · Live updates</small>
        </span>
      </a>
    </div>
  </div>
</div>''')

content = content.replace(old, new)

# Footer
old_f = '<a href="https://www.youtube.com/@marketwatchxyz" target="_blank" rel="noopener" style="color:#94a3b8"><i class="fab fa-youtube"></i> YouTube</a>'
new_f = old_f + '\n  &nbsp;&middot;&nbsp;\n  <a href="DISCORD_URL" target="_blank" rel="noopener" style="color:#5865F2"><i class="fab fa-discord"></i> Discord</a>'
content = content.replace(old_f, new_f)

with open('scanner/status/index.html', 'w') as f:
    f.write(content)
print('scanner/status/index.html updated')
PYEOF
    fi
    # Update discord URL in status page
    sed -i "s|DISCORD_URL|${DISCORD_INVITE}|g" scanner/status/index.html
    sed -i "s|https://discord.gg/[A-Za-z0-9]*|${DISCORD_INVITE}|g" scanner/status/index.html
    echo "  ✅ scanner/status/index.html: Discord button added"
  fi
fi

# ── Step 5: Commit & push changes ────────────────────────────────────────────
echo ""
echo "📤 Step 5: Committing changes..."
if [ "$DRY_RUN" != true ]; then
  git add tools/gen-status-page.js scanner/status/index.html tools/setup-community.sh 2>/dev/null || true
  if git diff --cached --quiet; then
    echo "  ✅ No changes to commit"
  else
    git commit -m "feat: add Discord read-only invite to website CTA + footer"
    git push origin main
    echo "  ✅ Pushed to main"
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Community Setup Complete ✅                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  📱 Telegram: $TELEGRAM_INVITE"
echo "  💬 Discord:  $DISCORD_INVITE"
echo "  🔒 #analyse-scanner: read-only (@everyone view+read, no send/react)"
echo ""
echo "  Topics Telegram:"
echo "    72 → Portfolio Live | 73 → Daily News"
echo "    74 → Weekly Review  | 75 → Stock Analysis | 76 → Learning"
echo "    89 → Turbo | 90 → Dynamic | 91 → Balanced | 92 → Secured | 93 → Fortress"
