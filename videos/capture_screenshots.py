import asyncio
from playwright.async_api import async_playwright
import os

HTML_PATH = "file:///Users/marketwatchxyz/GolandProjects/articles/series/se-remettre-dune-perte/index.html"
OUTPUT_DIR = "/Users/marketwatchxyz/GolandProjects/articles/videos/se-remettre-dune-perte/images"

SCENES = {
    "scene_01": ".hero-section",
    "scene_02": ".story-grid",
    "scene_03": "#phasesFunnel", 
    "scene_04": "#asymmetryChart",
    "scene_05": ".error-grid",
    "scene_06": "FIX_ME", 
    "scene_07": "FIX_ME", 
    "scene_08": "#bearMarketsChart",
    "scene_09": "FIX_ME", 
    "scene_10": "FIX_ME", 
    "scene_11": ".cheat-grid",
    "scene_12": "FIX_ME" 
}

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        
        print(f"Loading {HTML_PATH}...")
        await page.goto(HTML_PATH)
        await page.wait_for_load_state("networkidle")
        
        try:
            # Wait for charts to render
            await page.wait_for_timeout(2000) 
        except:
            pass

        if not os.path.exists(OUTPUT_DIR):
            os.makedirs(OUTPUT_DIR)

        # Logic for specific scenes
        
        # Scene 06: Recovery Plan
        # Select the content card immediately following #recovery, then the timeline inside
        scene_06_locator = page.locator("#recovery + .content-card .step-timeline").first

        # Scene 07: 1% Rule Example
        # The specific blue box with the calculation
        scene_07_locator = page.locator("div[style*='background:#ecfeff']").first

        # Scene 09: Emotional Tools
        # The content card after #emotions divider
        scene_09_locator = page.locator("#emotions + .content-card")

        # Scene 10: Warning Signs
        # The red alert box under 'Addiction au trading'
        # We look for the box containing the specific text 'Vous vérifiez votre portefeuille'
        scene_10_locator = page.locator("div[style*='background:#fef2f2']").filter(has_text="Vous vérifiez votre portefeuille").first

        # Scene 12: Conclusion / End Card
        # The last part divider
        scene_12_locator = page.locator(".part-divider").last

        for scene_id, selector in SCENES.items():
            print(f"Capturing {scene_id}...")
            try:
                if scene_id == "scene_06":
                    element = scene_06_locator
                elif scene_id == "scene_07":
                    element = scene_07_locator
                elif scene_id == "scene_09":
                    element = scene_09_locator
                elif scene_id == "scene_10":
                    element = scene_10_locator
                elif scene_id == "scene_12":
                    element = scene_12_locator
                else:
                    element = page.locator(selector).first

                if await element.count() > 0:
                    # Scroll into view to ensure lazy loading (if any)
                    await element.scroll_into_view_if_needed()
                    await page.wait_for_timeout(500) # Short pause for stability
                    await element.screenshot(path=f"{OUTPUT_DIR}/{scene_id}.png") # Removed omit_background to capture context
                    print(f"  Saved {scene_id}.png")
                else:
                    print(f"  Error: Element not found for {scene_id}")
            except Exception as e:
                print(f"  Error capturing {scene_id}: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture())