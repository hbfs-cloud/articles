import asyncio
import json
import os
import re
import time
from playwright.async_api import async_playwright

HTML_PATH = 'file:///Users/marketwatchxyz/GolandProjects/articles/scanner/status/index.html'
OUTPUT_DIR = '/Users/marketwatchxyz/GolandProjects/articles/scanner/status'
MANIFEST_PATH = os.path.join(OUTPUT_DIR, 'manifest.json')

def clean_old(prefix):
    """Remove old timestamped images matching prefix-DIGITS.png"""
    pattern = re.compile(rf'^{re.escape(prefix)}-\d+\.png$')
    for f in os.listdir(OUTPUT_DIR):
        if pattern.match(f):
            os.unlink(os.path.join(OUTPUT_DIR, f))

def load_manifest():
    try:
        with open(MANIFEST_PATH) as f:
            return json.load(f)
    except Exception:
        return {}

def save_manifest(m):
    with open(MANIFEST_PATH, 'w') as f:
        json.dump(m, f, indent=2)

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=2)

        print(f'Loading {HTML_PATH}...')
        await page.goto(HTML_PATH)
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(1000)

        ts = str(int(time.time() * 1000))
        manifest = load_manifest()

        # 1. Capture Hero Sweep -> daily-card-{ts}.png
        print('Capturing daily-card...')
        clean_old('daily-card')
        filename = f'daily-card-{ts}.png'
        hero = page.locator('.hero-sweep')
        await hero.screenshot(path=os.path.join(OUTPUT_DIR, filename))
        manifest['daily-card'] = filename

        # 2. Capture Growth Mode
        print('Capturing mode-growth...')
        clean_old('mode-growth')
        await page.evaluate("switchMode('growth')")
        await page.wait_for_timeout(500)
        filename = f'mode-growth-{ts}.png'
        panel_growth = page.locator('#panel-growth')
        await panel_growth.screenshot(path=os.path.join(OUTPUT_DIR, filename))
        manifest['mode-growth'] = filename

        # 3. Capture Calmar Mode
        print('Capturing mode-calmar...')
        clean_old('mode-calmar')
        await page.evaluate("switchMode('calmar')")
        await page.wait_for_timeout(500)
        filename = f'mode-calmar-{ts}.png'
        panel_calmar = page.locator('#panel-calmar')
        await panel_calmar.screenshot(path=os.path.join(OUTPUT_DIR, filename))
        manifest['mode-calmar'] = filename

        # 4. Capture Zero Mode
        print('Capturing mode-zero...')
        clean_old('mode-zero')
        await page.evaluate("switchMode('zero')")
        await page.wait_for_timeout(500)
        filename = f'mode-zero-{ts}.png'
        panel_zero = page.locator('#panel-zero')
        await panel_zero.screenshot(path=os.path.join(OUTPUT_DIR, filename))
        manifest['mode-zero'] = filename

        save_manifest(manifest)
        await browser.close()
        print(f'Done capturing status images. Manifest: {manifest}')

if __name__ == '__main__':
    asyncio.run(capture())
