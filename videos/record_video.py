import asyncio
import json
import os
import base64
from pathlib import Path
from playwright.async_api import async_playwright

# CSS for Blur Overlay
FOCUS_CSS = """
/* The backdrop that blurs everything */
#focus-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 255, 255, 0.1); /* Light tint */
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    z-index: 9998;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
    pointer-events: none;
}

/* The cloned element being highlighted */
#focus-clone {
    position: fixed;
    z-index: 9999;
    box-shadow: 0 0 40px rgba(0,0,0,0.3);
    border-radius: 8px;
    transition: all 0.5s ease-in-out;
    transform: scale(1.0); /* Start scale */
    opacity: 0;
}

#focus-clone.active {
    transform: scale(1.02);
    opacity: 1;
}

/* Active state for overlay */
body.focus-active #focus-overlay {
    opacity: 1;
}
"""

class VideoRecorder:
    def __init__(self, html_path: str, output_dir: str):
        self.html_path = html_path if html_path.startswith("file://") else f"file://{os.path.abspath(html_path)}"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def capture_thumbnail(self, selector: str = ".hero-section") -> str:
        output_path = self.output_dir / "thumbnail.png"
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
            await page.goto(self.html_path)
            await page.wait_for_load_state("networkidle")
            element = page.locator(selector).first
            if await element.count() > 0:
                await element.screenshot(path=str(output_path))
            else:
                await page.screenshot(path=str(output_path))
            await browser.close()
        return str(output_path)

    async def record_scrolling(self, scenes: list, durations: list) -> str:
        raw_output = self.output_dir / "scrolling_raw.webm"
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                record_video_dir=str(self.output_dir),
                record_video_size={"width": 1920, "height": 1080}
            )
            page = await context.new_page()

            print(f"  [Recording] Loading {self.html_path}...")
            await page.goto(self.html_path)
            await page.wait_for_load_state("networkidle")

            # Inject CSS & Elements
            await page.add_style_tag(content=FOCUS_CSS)
            await page.evaluate("""
                const overlay = document.createElement('div');
                overlay.id = 'focus-overlay';
                document.body.appendChild(overlay);
                
                const clone = document.createElement('img');
                clone.id = 'focus-clone';
                document.body.appendChild(clone);
            """)

            await page.wait_for_timeout(2000)

            for i, scene in enumerate(scenes):
                scene_id = scene["id"]
                duration = durations[i]
                selector = scene.get("focus_selector")
                
                print(f"  [Recording] {scene_id} ({duration:.1f}s) -> {selector}")

                if not selector:
                    await page.wait_for_timeout(duration * 1000)
                    continue

                # Locate element
                if "text=" in selector:
                     element = page.locator(selector)
                elif "div[style" in selector:
                     element = page.locator(selector).first
                else:
                     element = page.locator(selector).first

                if await element.count() == 0:
                    print(f"    Warning: Element not found: {selector}")
                    await page.wait_for_timeout(duration * 1000)
                    continue

                # 1. Scroll (Clear)
                await element.scroll_into_view_if_needed()
                await element.evaluate("el => el.scrollIntoView({block: 'center', behavior: 'smooth'})")
                await page.wait_for_timeout(1500)

                # 2. Capture Screenshot of Element for Overlay
                # We take a screenshot of just the element, encode it to base64, and put it in the #focus-clone img
                try:
                    # Get bounding box for positioning
                    box = await element.bounding_box()
                    if not box:
                        await page.wait_for_timeout(duration * 1000)
                        continue
                        
                    # Take screenshot buffer
                    png_bytes = await element.screenshot()
                    b64_img = base64.b64encode(png_bytes).decode('utf-8')
                    
                    # Update clone position and src
                    # Note: We use fixed positioning based on viewport coordinates (bounding_box gives viewport coords if scrolled?)
                    # No, bounding_box is relative to page usually? 
                    # Playwright bounding_box() returns x,y relative to the page top-left?
                    # Wait, if we use position: fixed, we need viewport coordinates.
                    # element.evaluate("el => el.getBoundingClientRect()") gives viewport coords.
                    
                    rect = await element.evaluate("el => { const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }")
                    
                    await page.evaluate(f"""
                        const clone = document.getElementById('focus-clone');
                        clone.src = 'data:image/png;base64,{b64_img}';
                        clone.style.top = '{rect['y']}px';
                        clone.style.left = '{rect['x']}px';
                        clone.style.width = '{rect['w']}px';
                        clone.style.height = '{rect['h']}px';
                    """)
                    
                    # 3. Apply Focus (Fade in overlay + Show clone)
                    await page.evaluate("document.body.classList.add('focus-active')")
                    await page.evaluate("document.getElementById('focus-clone').classList.add('active')")

                    # 4. Hold
                    # Overhead: Scroll(1.5) + Setup(0.2) + FadeIn(0.5) = ~2.2s
                    hold_time = max(duration - 2.5, 1.0)
                    await page.wait_for_timeout(hold_time * 1000)

                    # 5. Unfocus
                    await page.evaluate("document.body.classList.remove('focus-active')")
                    await page.evaluate("document.getElementById('focus-clone').classList.remove('active')")
                    await page.wait_for_timeout(500)
                    
                except Exception as e:
                    print(f"    Error focusing {selector}: {e}")
                    await page.wait_for_timeout(duration * 1000)

            await context.close()
            await browser.close()

        # Rename file
        video_files = list(self.output_dir.glob("*.webm"))
        if not video_files:
            raise FileNotFoundError("No video recording found")
        
        latest_video = max(video_files, key=os.path.getctime)
        if latest_video.name != "scrolling_raw.webm":
            if raw_output.exists():
                raw_output.unlink()
            latest_video.rename(raw_output)
        
        return str(raw_output)

def run_recorder(html_path, output_dir, scenes, durations):
    recorder = VideoRecorder(html_path, output_dir)
    return asyncio.run(recorder.record_scrolling(scenes, durations))

def run_thumbnail(html_path, output_dir):
    recorder = VideoRecorder(html_path, output_dir)
    return asyncio.run(recorder.capture_thumbnail())