import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
ARTICLE_SLUG = "se-remettre-dune-perte"
HTML_PATH = f"file:///Users/marketwatchxyz/GolandProjects/articles/series/{ARTICLE_SLUG}/index.html"
OUTPUT_DIR = f"{ARTICLE_SLUG}/output"
DURATIONS_FILE = f"{ARTICLE_SLUG}/durations.json"

# Scene Selectors (from capture_screenshots.py logic)
SCENE_SELECTORS = {
    "scene_01": ".hero-section",
    "scene_02": ".story-grid",
    "scene_03": "#phasesFunnel", 
    "scene_04": "#asymmetryChart",
    "scene_05": ".error-grid",
    "scene_06": "#recovery + .content-card .step-timeline", 
    "scene_07": "div[style*='background:#ecfeff']", 
    "scene_08": "#bearMarketsChart",
    "scene_09": "#emotions + .content-card", 
    "scene_10": "div[style*='background:#fef2f2']", # Specifically the warning box
    "scene_11": ".cheat-grid",
    "scene_12": ".part-divider:last-of-type" 
}

# CSS for Blur/Focus Effect
FOCUS_CSS = """
/* The backdrop that blurs everything */
#focus-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9998;
    opacity: 0;
    transition: opacity 0.8s ease-in-out;
    pointer-events: none;
}

/* The element being highlighted */
.highlight-focus {
    position: relative;
    z-index: 9999 !important;
    box-shadow: 0 0 30px rgba(0,0,0,0.15);
    transform: scale(1.02);
    transition: all 0.8s ease-in-out;
    background-color: white; /* Ensure transparency doesn't break effect */
    border-radius: 12px;
}

/* Active state for overlay */
body.focus-active #focus-overlay {
    opacity: 1;
}
"""

async def record_scrolling():
    # Load durations
    with open(DURATIONS_FILE) as f:
        durations = json.load(f)

    async with async_playwright() as p:
        # Launch browser with video recording enabled
        # Viewport 1920x1080 is standard HD
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=OUTPUT_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        print(f"Loading {HTML_PATH}...")
        await page.goto(HTML_PATH)
        await page.wait_for_load_state("networkidle")

        # Inject CSS
        await page.add_style_tag(content=FOCUS_CSS)
        
        # Create overlay div
        await page.evaluate("""
            const overlay = document.createElement('div');
            overlay.id = 'focus-overlay';
            document.body.appendChild(overlay);
        """)

        # Wait for initial render (charts etc)
        await page.wait_for_timeout(2000)

        # Iterate scenes
        sorted_scenes = sorted(durations.keys())
        
        for scene_id in sorted_scenes:
            duration = durations[scene_id]
            selector = SCENE_SELECTORS.get(scene_id)
            print(f"Recording {scene_id} ({duration}s) -> {selector}")

            if not selector:
                print(f"  Warning: No selector for {scene_id}, holding previous view.")
                await page.wait_for_timeout(duration * 1000)
                continue

            # Locate element
            # Handle specific complex selectors manually if needed
            if scene_id == "scene_10":
                 # Use text filter for precision
                 element = page.locator("div[style*='background:#fef2f2']").filter(has_text="Vous vérifiez votre portefeuille").first
            elif scene_id == "scene_06":
                 element = page.locator("#recovery + .content-card .step-timeline").first
            elif scene_id == "scene_12":
                 element = page.locator(".part-divider").last
            else:
                 element = page.locator(selector).first

            # Check if element exists
            if await element.count() == 0:
                print(f"  Error: Element not found for {scene_id}. Skipping focus.")
                await page.wait_for_timeout(duration * 1000)
                continue

            # 1. Scroll into view (Smooth)
            # 'block: center' puts it in the middle of the viewport
            await element.scroll_into_view_if_needed()
            # Custom smooth scroll for better control? Standard smooth is usually okay but let's ensure it finishes.
            await element.evaluate("el => el.scrollIntoView({block: 'center', behavior: 'smooth'})")
            
            # Wait for scroll to settle completely (page is CLEAR)
            await page.wait_for_timeout(1500)

            # 2. Apply Focus (Blur background)
            # The element gets 'highlight-focus' which puts it ABOVE the backdrop (z-index)
            # The body gets 'focus-active' which makes the backdrop visible
            await element.evaluate("el => el.classList.add('highlight-focus')")
            await page.evaluate("document.body.classList.add('focus-active')")

            # 3. Hold for duration
            # Duration includes the narration. We want to stay focused during the speech.
            # Total overhead so far: Scroll (1.5s) + Fade In (0.8s) = 2.3s
            # We un-focus at the end. Fade out takes 0.8s.
            # Total non-speech time: ~3.1s.
            # We want to match audio. Audio duration = duration.
            # We should hold for: duration - (scroll + fade_in + fade_out)
            # Let's say we want to START scrolling to next scene slightly after audio ends? 
            # Or exactly when it ends? 
            # Let's hold for most of the duration.
            
            hold_time = max(duration - 3.0, 1.5) 
            await page.wait_for_timeout(hold_time * 1000)

            # 4. Remove Focus (Return to clear page)
            await page.evaluate("document.body.classList.remove('focus-active')")
            await element.evaluate("el => el.classList.remove('highlight-focus')")
            
            # Wait for fade out to finish (clear page again)
            await page.wait_for_timeout(800)

        # Close context to save video
        await context.close()
        await browser.close()
        
        # Rename the recorded video (Playwright gives it a random name)
        # It's the only .webm file in the dir (if we cleared it, but we didn't)
        # We need to find the latest .webm
        files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".webm")]
        if files:
            # Find the newest file
            latest_file = max([os.path.join(OUTPUT_DIR, f) for f in files], key=os.path.getctime)
            new_path = os.path.join(OUTPUT_DIR, "scrolling_raw.webm")
            if os.path.exists(new_path):
                os.remove(new_path)
            os.rename(latest_file, new_path)
            print(f"Saved recording to {new_path}")
        else:
            print("Error: No video file found.")

if __name__ == "__main__":
    asyncio.run(record_scrolling())
