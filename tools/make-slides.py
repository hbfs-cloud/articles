#!/usr/bin/env python3
"""
make-slides.py — Generate slide PNGs for Market Watch videos using Pillow.
No chromium, no drawtext. Pure Python.

Usage:
  python3 tools/make-slides.py --data '{"slides":[...]}' --outdir /tmp/mw-media/slug
  python3 tools/make-slides.py --data-file /tmp/slides.json --outdir /tmp/mw-media/slug

Slide object:
  { "type": "intro|content|outro",
    "header": "SECTION TITLE",
    "title": "Main headline",
    "bullets": ["line 1", "line 2", ...],
    "footer": "footer text",
    "accent": "#3b82f6"   # optional
  }

Outputs: slide-0.png, slide-1.png, ... in outdir
"""

import json, sys, os, textwrap, argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Colors ─────────────────────────────────────────────────────────────────────
BG_DARK      = (15, 23, 42)       # #0f172a
BG_CARD      = (22, 36, 59)       # #16243b
ACCENT_BLUE  = (59, 130, 246)     # #3b82f6
ACCENT_SKY   = (96, 165, 250)     # #60a5fa
ACCENT_GREEN = (34, 197, 94)      # #22c55e
ACCENT_RED   = (239, 68, 68)      # #ef4444
ACCENT_YT    = (255, 0, 0)
TEXT_WHITE   = (255, 255, 255)
TEXT_LIGHT   = (203, 213, 225)    # #cbd5e1
TEXT_MUTED   = (100, 116, 139)    # #64748b
TEXT_HEADER  = (148, 163, 184)    # #94a3b8

W, H = 1280, 720

# ── Fonts ──────────────────────────────────────────────────────────────────────
FONT_DIR  = Path("/usr/share/fonts/truetype/dejavu")
FONT_BOLD = str(FONT_DIR / "DejaVuSans-Bold.ttf")
FONT_REG  = str(FONT_DIR / "DejaVuSans.ttf")

def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    except:
        return ImageFont.load_default()

# ── Helpers ────────────────────────────────────────────────────────────────────
def wrap(text, font_obj, max_w, draw):
    """Wrap text to fit within max_w pixels."""
    words = str(text).split()
    lines = []
    line  = ""
    for word in words:
        test = (line + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font_obj)
        if bbox[2] > max_w and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines

def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2*radius, y0 + 2*radius], fill=fill)
    draw.ellipse([x1 - 2*radius, y0, x1, y0 + 2*radius], fill=fill)
    draw.ellipse([x0, y1 - 2*radius, x0 + 2*radius, y1], fill=fill)
    draw.ellipse([x1 - 2*radius, y1 - 2*radius, x1, y1], fill=fill)

# ── Slide renderers ────────────────────────────────────────────────────────────
def render_intro(slide, outpath):
    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Gradient overlay (manual horizontal bands)
    for y in range(H):
        t = y / H
        r = int(15 + (30 - 15) * t)
        g = int(23 + (58 - 23) * t)
        b = int(42 + (95 - 42) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Top label: MARKET WATCH
    mw_font  = font(16, bold=True)
    label    = "MARKET WATCH"
    lbbox    = draw.textbbox((0, 0), label, font=mw_font)
    lw       = lbbox[2] - lbbox[0]
    draw.text(((W - lw) // 2, 160), label, font=mw_font, fill=ACCENT_SKY)

    # Accent bar
    bar_w = 60
    draw.rectangle([(W // 2 - bar_w // 2, 190), (W // 2 + bar_w // 2, 194)], fill=ACCENT_BLUE)

    # Date
    date_str = slide.get("date", "")
    if date_str:
        df   = font(18)
        dbbox = draw.textbbox((0, 0), date_str, font=df)
        draw.text(((W - (dbbox[2] - dbbox[0])) // 2, 210), date_str, font=df, fill=TEXT_HEADER)

    # Title
    title    = slide.get("title", "Market Watch")
    tf       = font(44, bold=True)
    t_lines  = wrap(title, tf, W - 200, draw)
    t_y      = 280 - (len(t_lines) - 1) * 28
    for line in t_lines:
        tbbox = draw.textbbox((0, 0), line, font=tf)
        tw    = tbbox[2] - tbbox[0]
        draw.text(((W - tw) // 2, t_y), line, font=tf, fill=TEXT_WHITE)
        t_y  += 58

    # Badge
    badge    = slide.get("badge", "Market Watch")
    bf       = font(15, bold=True)
    bbbox    = draw.textbbox((0, 0), badge, font=bf)
    bw       = bbbox[2] - bbbox[0]
    bx       = (W - bw - 32) // 2
    by       = t_y + 40
    draw_rounded_rect(draw, [bx - 4, by - 6, bx + bw + 36, by + 30], 14, ACCENT_BLUE)
    draw.text((bx + 12, by), badge, font=bf, fill=TEXT_WHITE)

    img.save(outpath, "PNG")


def render_content(slide, outpath):
    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    accent = tuple(int(slide.get("accent", "#3b82f6").lstrip("#")[i:i+2], 16) for i in (0, 2, 4))

    # Header bar strip
    draw.rectangle([(0, 0), (W, 5)], fill=accent)

    # Top-left label
    lf = font(12, bold=True)
    draw.text((60, 22), "MARKET WATCH", font=lf, fill=ACCENT_SKY)

    # Section header
    header = slide.get("header", "")
    if header:
        hf   = font(26, bold=True)
        hbbox = draw.textbbox((0, 0), header.upper(), font=hf)
        draw.text((60, 60), header.upper(), font=hf, fill=TEXT_WHITE)
        hw   = hbbox[2] - hbbox[0]
        # Underline
        draw.rectangle([(60, 100), (60 + hw, 104)], fill=accent)

    # Bullets
    bf    = font(22)
    by    = 130
    max_w = W - 160
    for bullet in slide.get("bullets", [])[:6]:
        bullet = str(bullet).strip()
        if not bullet:
            continue
        lines = wrap(bullet, bf, max_w - 20, draw)
        line_h = 34
        block_h = len(lines) * line_h + 16
        # Card background
        draw_rounded_rect(draw, [60, by, W - 60, by + block_h], 8, BG_CARD)
        # Accent left border
        draw.rectangle([(60, by), (64, by + block_h)], fill=accent)
        # Text
        ty = by + 8
        for l in lines:
            draw.text((80, ty), l, font=bf, fill=TEXT_LIGHT)
            ty += line_h
        by += block_h + 10

    # Footer
    footer = slide.get("footer", "articles.market-watch.xyz")
    ff     = font(14)
    draw.text((60, H - 36), footer, font=ff, fill=TEXT_MUTED)

    img.save(outpath, "PNG")


def render_outro(slide, outpath):
    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Gradient
    for y in range(H):
        t = y / H
        r = int(15 + (30 - 15) * t)
        g = int(23 + (58 - 23) * t)
        b = int(42 + (95 - 42) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Icon area
    icon_f = font(64, bold=True)
    icon   = "📊"
    # Use a text icon or just a circle
    draw_rounded_rect(draw, [W//2 - 50, 160, W//2 + 50, 260], 20, ACCENT_BLUE)
    yf = font(30, bold=True)
    draw.text((W//2 - 14, 185), "MW", font=yf, fill=TEXT_WHITE)

    # Main text
    mf    = font(38, bold=True)
    main  = "Full analysis available"
    mbbox = draw.textbbox((0, 0), main, font=mf)
    mw    = mbbox[2] - mbbox[0]
    draw.text(((W - mw) // 2, 295), main, font=mf, fill=TEXT_WHITE)

    # URL
    uf    = font(28)
    url   = slide.get("url", "articles.market-watch.xyz")
    ubbox = draw.textbbox((0, 0), url, font=uf)
    uw    = ubbox[2] - ubbox[0]
    draw.text(((W - uw) // 2, 360), url, font=uf, fill=ACCENT_SKY)

    # Subtitle
    sf    = font(20)
    sub   = slide.get("subtitle", "Follow us on Telegram for daily signals")
    sbbox = draw.textbbox((0, 0), sub, font=sf)
    sw    = sbbox[2] - sbbox[0]
    draw.text(((W - sw) // 2, 420), sub, font=sf, fill=TEXT_HEADER)

    # Disclaimer
    df    = font(14)
    disc  = "© 2026 Market Watch — Not financial advice"
    dbbox = draw.textbbox((0, 0), disc, font=df)
    dw    = dbbox[2] - dbbox[0]
    draw.text(((W - dw) // 2, H - 50), disc, font=df, fill=TEXT_MUTED)

    img.save(outpath, "PNG")


def render_market_snapshot(slide, outpath):
    """Special slide for market data."""
    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    draw.rectangle([(0, 0), (W, 5)], fill=ACCENT_BLUE)
    lf = font(12, bold=True)
    draw.text((60, 22), "MARKET WATCH", font=lf, fill=ACCENT_SKY)

    hf = font(28, bold=True)
    draw.text((60, 60), "MARKET SNAPSHOT", font=hf, fill=TEXT_WHITE)
    draw.rectangle([(60, 102), (280, 106)], fill=ACCENT_BLUE)

    # 2-column grid
    items  = slide.get("items", [])
    cols   = 3
    cw     = (W - 120) // cols
    row_h  = 130
    pad    = 12

    for i, item in enumerate(items[:6]):
        col = i % cols
        row = i // cols
        x   = 60 + col * cw
        y   = 130 + row * row_h

        # Card
        draw_rounded_rect(draw, [x + pad, y, x + cw - pad, y + row_h - 10], 10, BG_CARD)

        # Label
        kf   = font(14)
        lbl  = str(item.get("label", ""))
        draw.text((x + pad + 12, y + 12), lbl, font=kf, fill=TEXT_MUTED)

        # Value
        vf   = font(26, bold=True)
        val  = str(item.get("value", ""))
        draw.text((x + pad + 12, y + 35), val, font=vf, fill=TEXT_WHITE)

        # Change
        chg  = str(item.get("change", ""))
        if chg:
            cf    = font(18)
            color = ACCENT_GREEN if not chg.startswith("-") else ACCENT_RED
            draw.text((x + pad + 12, y + 72), chg, font=cf, fill=color)

    ff = font(14)
    draw.text((60, H - 36), slide.get("footer", "articles.market-watch.xyz"), font=ff, fill=TEXT_MUTED)

    img.save(outpath, "PNG")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",      help="JSON string with slides array")
    parser.add_argument("--data-file", help="JSON file with slides array")
    parser.add_argument("--outdir",    required=True, help="Output directory")
    args   = parser.parse_args()

    if args.data_file:
        with open(args.data_file) as f:
            payload = json.load(f)
    elif args.data:
        payload = json.loads(args.data)
    else:
        print("❌ --data or --data-file required", file=sys.stderr)
        sys.exit(1)

    slides   = payload.get("slides", [])
    os.makedirs(args.outdir, exist_ok=True)
    rendered = []

    for i, slide in enumerate(slides):
        outpath = os.path.join(args.outdir, f"slide-{i}.png")
        stype   = slide.get("type", "content")

        if stype == "intro":
            render_intro(slide, outpath)
        elif stype == "outro":
            render_outro(slide, outpath)
        elif stype == "snapshot":
            render_market_snapshot(slide, outpath)
        else:
            render_content(slide, outpath)

        size = os.path.getsize(outpath)
        print(f"  ✅ slide-{i}.png ({size//1024}KB) [{stype}]")
        rendered.append(outpath)

    print(json.dumps({"slides": rendered}))


if __name__ == "__main__":
    main()
