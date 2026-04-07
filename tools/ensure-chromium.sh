#!/bin/bash
# Ensure ARM64-compatible Chromium is available for Puppeteer (Hetzner aarch64)
CHROME_PATH="/home/ci/.cache/ms-playwright/chromium-1217/chrome-linux/chrome"
if [ ! -f "$CHROME_PATH" ]; then
  echo "Installing playwright chromium (arm64)..."
  npx playwright install chromium
  echo "Done."
else
  echo "Chromium already present: $CHROME_PATH"
fi
