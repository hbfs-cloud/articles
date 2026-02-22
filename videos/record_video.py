import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

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

class VideoRecorder:
    def __init__(self, html_path: str, output_dir: str):
        self.html_path = html_path if html_path.startswith("file://") else f"file://{os.path.abspath(html_path)}"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def capture_thumbnail(self, selector: str = ".hero-section") -> str:
        """Captures a high-quality thumbnail from the page."""
        output_path = self.output_dir / "thumbnail.png"
        
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
            
            await page.goto(self.html_path)
            await page.wait_for_load_state("networkidle")
            
            element = page.locator(selector).first
            if await element.count() > 0:
                await element.screenshot(path=str(output_path))
                print(f"  [Thumbnail] Saved to {output_path}")
            else:
                print(f"  [Thumbnail] Warning: Selector {selector} not found, taking full page.")
                await page.screenshot(path=str(output_path))
            
            await browser.close()
        return str(output_path)

    async def record_scrolling(self, scenes: list, durations: list) -> str:
        """Records the scrolling video based on scenes and audio durations."""
        raw_output = self.output_dir / "scrolling_raw.webm"
        
        async with async_playwright() as p:
            # Launch browser with video recording enabled
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

            # Inject CSS
            await page.add_style_tag(content=FOCUS_CSS)
            
            # Create overlay div
            await page.evaluate("""
                const overlay = document.createElement('div');
                overlay.id = 'focus-overlay';
                document.body.appendChild(overlay);
            """)

            # Wait for initial render
            await page.wait_for_timeout(2000)

            for i, scene in enumerate(scenes):
                scene_id = scene["id"]
                duration = durations[i]
                selector = scene.get("focus_selector")
                
                print(f"  [Recording] {scene_id} ({duration:.1f}s) -> {selector}")

                if not selector:
                    await page.wait_for_timeout(duration * 1000)
                    continue

                # Locate element (handle special cases if needed, but generic is better)
                # Check for text-based refinement if selector looks like one
                if "text=" in selector:
                     # Simple heuristic for text locators if we add them to JSON later
                     element = page.locator(selector) # Playwright handles text= syntax
                elif "div[style" in selector:
                     # Complex selectors passed directly
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

                # 2. Focus (Blur BG)
                await element.evaluate("el => el.classList.add('highlight-focus')")
                await page.evaluate("document.body.classList.add('focus-active')")

                # 3. Hold
                # Calculate hold time: Duration - (Scroll 1.5 + FadeIn 0.8 + FadeOut 0.8) = ~3.1s overhead
                # We want to match audio EXACTLY.
                # If we hold for (duration - 3.0), the total time spent on this scene visually is approx 'duration'.
                hold_time = max(duration - 3.0, 1.5)
                await page.wait_for_timeout(hold_time * 1000)

                # 4. Unfocus
                await page.evaluate("document.body.classList.remove('focus-active')")
                await element.evaluate("el => el.classList.remove('highlight-focus')")
                await page.wait_for_timeout(800)

            await context.close()
            await browser.close()

        # Rename the random-named file to standard name
        video_files = list(self.output_dir.glob("*.webm"))
        if not video_files:
            raise FileNotFoundError("No video recording found")
        
        # Get the most recent webm
        latest_video = max(video_files, key=os.path.getctime)
        if latest_video.name != "scrolling_raw.webm":
            if raw_output.exists():
                raw_output.unlink()
            latest_video.rename(raw_output)
        
        return str(raw_output)

# Async wrapper for calling from sync code
def run_recorder(html_path, output_dir, scenes, durations):
    recorder = VideoRecorder(html_path, output_dir)
    return asyncio.run(recorder.record_scrolling(scenes, durations))

def run_thumbnail(html_path, output_dir):
    recorder = VideoRecorder(html_path, output_dir)
    return asyncio.run(recorder.capture_thumbnail())
