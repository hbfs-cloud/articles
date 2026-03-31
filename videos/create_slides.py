#!/usr/bin/env python3
"""
Hand-crafted slide generator for DailyTickers YouTube videos.
Generates pixel-perfect infographic slides using Pillow + Inter font.
Design system matches https://articles.dailytickers.com/
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from typing import Optional

# ─── Resolution ───────────────────────────────────────────────────────────────
W, H = 1920, 1080

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
FONTS = BASE / "assets" / "fonts"
LOGO_PATH = BASE / "assets" / "logo.png"

# ─── Design System Colors ────────────────────────────────────────────────────
NAVY       = "#0f172a"
TEAL       = "#0891b2"
BLUE       = "#3b82f6"
RED        = "#ef4444"
GREEN      = "#10b981"
AMBER      = "#f59e0b"
PURPLE     = "#9333ea"
GRAY       = "#94a3b8"
GRAY_DARK  = "#64748b"
LIGHT      = "#e2e8f0"
BG         = "#f8fafc"
MINT       = "#f0fdfa"
SKY        = "#e0f2fe"
WHITE      = "#ffffff"
RED_BG     = "#fef2f2"
GREEN_BG   = "#f0fdf4"
BLUE_BG    = "#eff6ff"
AMBER_BG   = "#fffbeb"


class SlideRenderer:
    """Generates premium infographic slides matching DailyTickers design."""

    def __init__(self):
        self.fonts = self._load_fonts()
        self.logo = self._load_logo()

    def _load_fonts(self) -> dict:
        f = {}
        for weight, file in [("bold", "Inter-Bold.ttf"), ("medium", "Inter-Medium.ttf"),
                              ("regular", "Inter-Regular.ttf")]:
            for size in [52, 48, 44, 40, 36, 32, 28, 26, 24, 22, 20, 18, 16]:
                key = f"{weight}_{size}"
                try:
                    f[key] = ImageFont.truetype(str(FONTS / file), size)
                except Exception:
                    f[key] = ImageFont.load_default()
        return f

    def _load_logo(self) -> Optional[Image.Image]:
        if LOGO_PATH.exists():
            try:
                return Image.open(LOGO_PATH).convert("RGBA")
            except Exception:
                pass
        return None

    # ─── Drawing Helpers ──────────────────────────────────────────────────────

    def _new(self, bg=BG):
        img = Image.new("RGB", (W, H), bg)
        return img, ImageDraw.Draw(img)

    def _tw(self, text, font):
        return font.getlength(text)

    def _center(self, draw, text, font, y, fill=NAVY):
        x = (W - self._tw(text, font)) / 2
        draw.text((x, y), text, fill=fill, font=font)

    def _decos(self, draw):
        draw.ellipse([W - 320, -100, W + 80, 300], fill=MINT)
        draw.ellipse([-100, H - 280, 280, H + 100], fill=SKY)

    def _card(self, draw, x, y, w, h, accent=None):
        draw.rounded_rectangle([x + 4, y + 5, x + w + 4, y + h + 5], radius=20, fill=LIGHT)
        draw.rounded_rectangle([x, y, x + w, y + h], radius=20, fill=WHITE)
        if accent:
            draw.rounded_rectangle([x, y, x + w, y + 5], radius=2, fill=accent)

    def _panel(self, draw, x, y, w, h, accent=None, bg=WHITE):
        draw.rounded_rectangle([x + 3, y + 3, x + w + 3, y + h + 3], radius=14, fill=LIGHT)
        draw.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=bg)
        if accent:
            draw.rectangle([x, y + 10, x + 5, y + h - 10], fill=accent)

    def _watermark(self, img):
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, H - 48, W, H], fill=WHITE)
        draw.rectangle([0, H - 48, W, H - 46], fill=TEAL)
        if self.logo:
            s = self.logo.resize((26, 26), Image.Resampling.LANCZOS)
            img.paste(s, (W - 228, H - 37), s)
        draw.text((W - 195, H - 38), "dailytickers.com", fill=TEAL, font=self.fonts["medium_18"])
        return img

    def _arrow_r(self, draw, x, y, length=50, color=TEAL):
        draw.line([(x, y), (x + length - 12, y)], fill=color, width=3)
        draw.polygon([(x + length, y), (x + length - 14, y - 7), (x + length - 14, y + 7)], fill=color)

    def _badge(self, draw, cx, cy, r, text, bg_color, text_color=WHITE):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color)
        tw = self._tw(text, self.fonts["bold_24"])
        draw.text((cx - tw / 2, cy - 13), text, fill=text_color, font=self.fonts["bold_24"])

    def _hbar(self, draw, x, y, w, h, fill_color, pct=1.0, radius=8):
        bar_w = max(int(w * pct), radius * 2)
        draw.rounded_rectangle([x, y, x + bar_w, y + h], radius=radius, fill=fill_color)

    # ─── Scene 01: Title Card ─────────────────────────────────────────────────

    def scene_01(self):
        img, draw = self._new(bg=NAVY)

        # Subtle background lines
        for i in range(8):
            y = 100 + i * 130
            draw.line([(50 + i * 30, y), (W - 50 - i * 30, y - 40 + i * 10)],
                      fill="#0e4058", width=1)

        # Logo
        if self.logo:
            logo = self.logo.resize((64, 64), Image.Resampling.LANCZOS)
            img.paste(logo, ((W - 64) // 2, 220), logo)

        # Brand
        self._center(draw, "M A R K E T   W A T C H", self.fonts["medium_22"], 300, fill=TEAL)

        # Title
        self._center(draw, "Se Remettre d'une Perte", self.fonts["bold_52"], 400, fill=WHITE)

        # Separator
        lw = 180
        draw.rectangle([(W - lw) // 2, 475, (W + lw) // 2, 479], fill=TEAL)

        # Subtitle
        self._center(draw, "Bien Débuter en Bourse  —  Partie 6", self.fonts["regular_24"], 505, fill=GRAY)

        # Bottom
        self._center(draw, "dailytickers.com", self.fonts["medium_20"], H - 80, fill=TEAL)

        return img

    # ─── Scene 02: Famous Losses ──────────────────────────────────────────────

    def scene_02(self):
        img, draw = self._new()
        self._decos(draw)

        # Header
        self._center(draw, "Même les Légendes Perdent", self.fonts["bold_44"], 50)
        self._center(draw, "Ce qui compte, c'est la réaction", self.fonts["regular_24"], 105, fill=GRAY)

        # Main card
        self._card(draw, 80, 155, W - 160, 680, accent=TEAL)

        data = [
            ("Warren Buffett", "2008", "-$25 Milliards", "(-50%)", "Racheté au plus bas, fortune doublée"),
            ("George Soros", "1987", "-$800 Millions", "", "Gagné $1 Milliard en 1992"),
            ("Bill Ackman", "Valeant", "-$4 Milliards", "", "Récupéré +70% sur Chipotle en 2020"),
            ("S. Druckenmiller", "Dot-com", "-$3 Milliards", "", "+30%/an sur 30 ans de carrière"),
        ]

        for i, (name, period, loss, extra, comeback) in enumerate(data):
            y = 195 + i * 140
            # Alternating row bg
            if i % 2 == 0:
                draw.rounded_rectangle([110, y, W - 110, y + 125], radius=12, fill=BG)

            # Name & period
            draw.text((140, y + 15), name, fill=NAVY, font=self.fonts["bold_28"])
            draw.text((140, y + 52), period, fill=GRAY, font=self.fonts["regular_20"])

            # Loss pill
            loss_text = f"{loss} {extra}".strip()
            pill_w = self._tw(loss_text, self.fonts["bold_22"]) + 30
            draw.rounded_rectangle([520, y + 15, 520 + pill_w, y + 50], radius=10, fill=RED_BG)
            draw.text((535, y + 18), loss_text, fill=RED, font=self.fonts["bold_22"])

            # Arrow
            self._arrow_r(draw, 530 + pill_w + 10, y + 33, length=45)

            # Comeback
            come_x = 600 + pill_w
            draw.text((come_x, y + 18), comeback, fill=GREEN, font=self.fonts["medium_22"])

        # Insight box
        iy = 760
        draw.rounded_rectangle([160, iy, W - 160, iy + 60], radius=14, fill=BLUE_BG)
        draw.rectangle([160, iy + 6, 166, iy + 54], fill=BLUE)
        self._center(draw, "40 à 50% des trades des meilleurs pros sont perdants. La clé : gérer la perte.",
                      self.fonts["medium_22"], iy + 16, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 03: 3 Emotional Phases ─────────────────────────────────────────

    def scene_03(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "Les 3 Phases Émotionnelles Après une Perte",
                      self.fonts["bold_40"], 50)

        # Three panels
        pw, ph = 480, 520
        gap = 50
        start_x = (W - 3 * pw - 2 * gap) // 2
        panels = [
            ("PHASE 1", "CHOC", RED, RED_BG,
             ["Je refuse d'y croire", "Sensation d'irréalité",
              "Vérification compulsive"],
             "Minutes à heures", "NE PAS AGIR"),
            ("PHASE 2", "COLÈRE", AMBER, AMBER_BG,
             ["C'est la faute du marché",
              "Je cherche un coupable",
              "Envie de revanche"],
             "Heures à jours", "DANGER MAXIMUM"),
            ("PHASE 3", "ACCEPTATION", GREEN, GREEN_BG,
             ["OK, que s'est-il passé ?",
              "Analyse objective",
              "Prêt à agir rationnellement"],
             "Jours à semaines", "MOMENT D'AGIR"),
        ]

        for i, (phase, title, color, bg, bullets, timing, warning) in enumerate(panels):
            x = start_x + i * (pw + gap)
            y = 140

            # Panel
            self._panel(draw, x, y, pw, ph, accent=color, bg=bg)

            # Phase number circle
            self._badge(draw, x + pw // 2, y + 50, 30, str(i + 1), color)

            # Phase label
            tw = self._tw(phase, self.fonts["medium_20"])
            draw.text((x + (pw - tw) / 2, y + 90), phase, fill=GRAY_DARK, font=self.fonts["medium_20"])

            # Title
            tw = self._tw(title, self.fonts["bold_36"])
            draw.text((x + (pw - tw) / 2, y + 120), title, fill=color, font=self.fonts["bold_36"])

            # Separator
            draw.rectangle([x + 40, y + 170, x + pw - 40, y + 172], fill=LIGHT)

            # Bullets
            for j, bullet in enumerate(bullets):
                by = y + 195 + j * 40
                draw.ellipse([x + 30, by + 8, x + 42, by + 20], fill=color)
                draw.text((x + 55, by), bullet, fill=NAVY, font=self.fonts["regular_22"])

            # Timing
            draw.rounded_rectangle([x + 30, y + 340, x + pw - 30, y + 380],
                                    radius=10, fill=WHITE)
            tw = self._tw(timing, self.fonts["medium_20"])
            draw.text((x + (pw - tw) / 2, y + 347), timing, fill=GRAY_DARK, font=self.fonts["medium_20"])

            # Warning badge
            warn_w = self._tw(warning, self.fonts["bold_20"]) + 30
            wx = x + (pw - warn_w) / 2
            warn_bg = RED_BG if "DANGER" in warning else (GREEN_BG if "AGIR" in warning else AMBER_BG)
            warn_fg = RED if "DANGER" in warning else (GREEN if "AGIR" in warning else AMBER)
            draw.rounded_rectangle([wx, y + 400, wx + warn_w, y + 435], radius=10, fill=warn_bg)
            draw.text((wx + 15, y + 405), warning, fill=warn_fg, font=self.fonts["bold_20"])

            # Arrow between panels
            if i < 2:
                ax = x + pw + 8
                ay = y + ph // 2
                self._arrow_r(draw, ax, ay, length=gap - 16, color=TEAL)

        # Bottom note
        draw.rounded_rectangle([300, H - 105, W - 300, H - 60], radius=14, fill=BLUE_BG)
        draw.rectangle([300, H - 99, 306, H - 66], fill=BLUE)
        self._center(draw, "Connaître ces phases, c'est déjà les maîtriser",
                      self.fonts["medium_22"], H - 96, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 04: Loss Asymmetry ─────────────────────────────────────────────

    def scene_04(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "L'Asymétrie Mathématique des Pertes",
                      self.fonts["bold_44"], 45)
        self._center(draw, "Perdre 50% = besoin de +100% pour récupérer",
                      self.fonts["regular_24"], 100, fill=GRAY)

        # Main card
        self._card(draw, 80, 150, W - 160, 700, accent=TEAL)

        # Bar chart data
        data = [
            ("-10%", "+11.1%", 0.11, 0.12),
            ("-25%", "+33.3%", 0.28, 0.37),
            ("-50%", "+100%", 0.56, 1.0),
            ("-75%", "+300%", 0.83, 1.0),
            ("-90%", "+900%", 1.0, 1.0),
        ]

        chart_x = 250
        chart_w = 600
        chart_right = 1000
        bar_h = 40
        row_gap = 95

        # Column headers
        draw.text((chart_x, 175), "Perte", fill=RED, font=self.fonts["bold_22"])
        draw.text((chart_right + 50, 175), "Gain nécessaire", fill=TEAL, font=self.fonts["bold_22"])

        for i, (loss_label, gain_label, loss_pct, gain_pct) in enumerate(data):
            y = 220 + i * row_gap

            # Loss label
            draw.text((140, y + 8), loss_label, fill=NAVY, font=self.fonts["bold_28"])

            # Red bar (loss proportional)
            red_w = int(chart_w * loss_pct)
            self._hbar(draw, chart_x, y, red_w, bar_h, RED)

            # Arrow
            self._arrow_r(draw, chart_x + red_w + 15, y + bar_h // 2, length=40)

            # Teal bar (gain needed)
            teal_start = chart_right + 50
            max_teal = W - 200 - teal_start
            teal_w = int(max_teal * gain_pct)
            self._hbar(draw, teal_start, y, teal_w, bar_h, TEAL)

            # Gain label on bar
            draw.text((teal_start + 12, y + 7), gain_label, fill=WHITE, font=self.fonts["bold_22"])

        # Highlight the -50% row
        hy = 220 + 2 * row_gap - 5
        draw.rounded_rectangle([120, hy - 5, W - 100, hy + bar_h + 15],
                                radius=10, outline=AMBER, width=2)

        # Key insight
        iy = 710
        draw.rounded_rectangle([200, iy, W - 200, iy + 70], radius=16, fill=AMBER_BG)
        draw.rectangle([200, iy + 8, 206, iy + 62], fill=AMBER)
        self._center(draw, "Règle n°1 : Limiter ses pertes. La mathématique est impitoyable.",
                      self.fonts["bold_22"], iy + 20, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 05: 3 Fatal Mistakes ───────────────────────────────────────────

    def scene_05(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "3 Erreurs Mortelles Après une Perte",
                      self.fonts["bold_44"], 45)

        pw, ph = 520, 650
        gap = 40
        sx = (W - 3 * pw - 2 * gap) // 2

        mistakes = [
            ("REVENGE TRADING", RED,
             "Prendre un trade plus gros\npour 'se venger' du marché",
             "Résultat :", "Perte x2 à x5",
             ["Taille de position doublée", "Pas de stop-loss",
              "Décision émotionnelle"]),
            ("MARTINGALE", AMBER,
             "Doubler la mise à chaque\nperte en espérant récupérer",
             "Exemple :",
             "10 > 20 > 40 > 80 > 160 > 320\n= 630€ perdus pour gagner 10€",
             ["Ruine quasi certaine", "6 pertes = -63x la mise",
              "Interdit en gestion pro"]),
            ("VENTE PANIQUE", PURPLE,
             "Tout vendre au pire moment\nquand le marché baisse",
             "Statistique S&P 500 :",
             "Rater les 10 meilleurs jours\n= rendement divisé par 2",
             ["Cristallise les pertes", "Manque le rebond",
              "Achète haut, vend bas"]),
        ]

        for i, (title, color, desc, stat_label, stat_val, dangers) in enumerate(mistakes):
            x = sx + i * (pw + gap)
            y = 130

            self._panel(draw, x, y, pw, ph, accent=color)

            # Warning icon (triangle)
            tx = x + pw // 2
            draw.polygon([(tx, y + 30), (tx - 22, y + 68), (tx + 22, y + 68)],
                          fill=color)
            draw.text((tx - 5, y + 38), "!", fill=WHITE, font=self.fonts["bold_20"])

            # Title
            tw = self._tw(title, self.fonts["bold_28"])
            draw.text((x + (pw - tw) / 2, y + 85), title, fill=color, font=self.fonts["bold_28"])

            # Separator
            draw.rectangle([x + 30, y + 125, x + pw - 30, y + 127], fill=LIGHT)

            # Description
            for j, line in enumerate(desc.split("\n")):
                draw.text((x + 30, y + 145 + j * 30), line, fill=NAVY, font=self.fonts["regular_22"])

            # Stat box
            sy = y + 230
            draw.rounded_rectangle([x + 20, sy, x + pw - 20, sy + 140], radius=12, fill=BG)
            draw.text((x + 35, sy + 10), stat_label, fill=GRAY_DARK, font=self.fonts["medium_20"])
            for j, line in enumerate(stat_val.split("\n")):
                draw.text((x + 35, sy + 40 + j * 30), line, fill=color, font=self.fonts["bold_22"])

            # Danger bullets
            for j, danger in enumerate(dangers):
                dy = y + 400 + j * 45
                draw.ellipse([x + 30, dy + 6, x + 46, dy + 22], fill=RED_BG, outline=RED, width=1)
                draw.text((x + 55, dy), danger, fill=NAVY, font=self.fonts["regular_22"])

        return self._watermark(img)

    # ─── Scene 06: Recovery Plan ──────────────────────────────────────────────

    def scene_06(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "Plan de Retour en 3 Étapes",
                      self.fonts["bold_44"], 50)
        self._center(draw, "Comme un sportif qui reprend après une blessure",
                      self.fonts["regular_24"], 105, fill=GRAY)

        steps = [
            ("1", "PAUSE", BLUE, BLUE_BG,
             "48h minimum",
             ["Fermer toutes les apps", "Zéro transaction",
              "Respirer, prendre du recul", "Parler à quelqu'un"]),
            ("2", "ANALYSE", TEAL, MINT,
             "Comprendre la perte",
             ["Qu'ai-je acheté et pourquoi ?", "Mon stop était-il en place ?",
              "Écrire sur papier", "Identifier la leçon"]),
            ("3", "RETOUR", GREEN, GREEN_BG,
             "Progressif et contrôlé",
             ["Position = 50% taille normale", "Un seul trade à la fois",
              "Stop-loss obligatoire", "Objectif : confiance, pas profit"]),
        ]

        pw, ph = 480, 560
        gap = 50
        sx = (W - 3 * pw - 2 * gap) // 2

        for i, (num, title, color, bg, subtitle, bullets) in enumerate(steps):
            x = sx + i * (pw + gap)
            y = 170

            self._panel(draw, x, y, pw, ph, bg=bg)

            # Big number circle
            self._badge(draw, x + pw // 2, y + 55, 35, num, color)

            # Title
            tw = self._tw(title, self.fonts["bold_36"])
            draw.text((x + (pw - tw) / 2, y + 105), title, fill=color, font=self.fonts["bold_36"])

            # Subtitle
            tw = self._tw(subtitle, self.fonts["medium_22"])
            draw.text((x + (pw - tw) / 2, y + 155), subtitle, fill=GRAY_DARK, font=self.fonts["medium_22"])

            # Separator
            draw.rectangle([x + 40, y + 195, x + pw - 40, y + 197], fill=LIGHT)

            # Checklist
            for j, bullet in enumerate(bullets):
                by = y + 220 + j * 50
                # Checkmark circle
                draw.ellipse([x + 30, by + 4, x + 52, by + 26], fill=color)
                # Tick mark (two lines forming a check)
                draw.line([(x + 36, by + 15), (x + 41, by + 21)], fill=WHITE, width=2)
                draw.line([(x + 41, by + 21), (x + 48, by + 10)], fill=WHITE, width=2)
                draw.text((x + 65, by), bullet, fill=NAVY, font=self.fonts["regular_22"])

            # Arrow between steps
            if i < 2:
                ax = x + pw + 8
                ay = y + ph // 2
                self._arrow_r(draw, ax, ay, length=gap - 16, color=TEAL)

        # Bottom quote
        draw.rounded_rectangle([250, H - 100, W - 250, H - 55], radius=14, fill=BLUE_BG)
        draw.rectangle([250, H - 94, 256, H - 61], fill=BLUE)
        self._center(draw, "Ne vous précipitez pas. Mieux vaut revenir lentement que rechuter.",
                      self.fonts["medium_22"], H - 92, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 07: 1% Rule ────────────────────────────────────────────────────

    def scene_07(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "La Règle d'Or du 1%", self.fonts["bold_44"], 45)
        self._center(draw, "Ne jamais risquer plus de 1% de son capital par trade",
                      self.fonts["regular_24"], 100, fill=GRAY)

        # Left card: Table
        self._card(draw, 80, 165, 850, 450, accent=TEAL)

        # Table headers
        headers = ["Capital", "Risque 1%", "Perte max/trade"]
        hx = [140, 470, 680]
        for j, (header, x) in enumerate(zip(headers, hx)):
            draw.text((x, 195), header, fill=TEAL, font=self.fonts["bold_22"])
        draw.rectangle([130, 228, 900, 230], fill=LIGHT)

        rows = [
            ("5 000 €", "1%", "50 €"),
            ("10 000 €", "1%", "100 €"),
            ("25 000 €", "1%", "250 €"),
            ("50 000 €", "1%", "500 €"),
        ]
        for i, (cap, risk, loss) in enumerate(rows):
            y = 245 + i * 55
            if i % 2 == 0:
                draw.rounded_rectangle([130, y - 5, 900, y + 45], radius=8, fill=BG)
            draw.text((140, y + 5), cap, fill=NAVY, font=self.fonts["medium_24"])
            draw.text((490, y + 5), risk, fill=TEAL, font=self.fonts["bold_24"])
            draw.text((700, y + 5), loss, fill=RED, font=self.fonts["bold_24"])

        # Sub-note
        draw.text((140, 480), "Formule :", fill=GRAY_DARK, font=self.fonts["medium_20"])
        draw.text((260, 480), "Stop Loss = Capital x 1%", fill=NAVY, font=self.fonts["bold_22"])

        # Right card: Impact visualization
        self._card(draw, 990, 165, 850, 450, accent=GREEN)

        draw.text((1030, 195), "Impact de 10 pertes consécutives :", fill=NAVY, font=self.fonts["bold_22"])

        # Progress bar showing 90% remaining
        bar_x, bar_y = 1030, 260
        bar_w, bar_h = 780, 50
        # Full bar background
        draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
                                radius=12, fill=LIGHT)
        # Green portion (90.4%)
        green_w = int(bar_w * 0.904)
        draw.rounded_rectangle([bar_x, bar_y, bar_x + green_w, bar_y + bar_h],
                                radius=12, fill=GREEN)
        draw.text((bar_x + 15, bar_y + 11), "Capital restant : 90.4%",
                   fill=WHITE, font=self.fonts["bold_22"])
        # Red portion label
        draw.text((bar_x + green_w + 10, bar_y + 11), "-9.6%",
                   fill=RED, font=self.fonts["bold_22"])

        # Comparison
        draw.text((1030, 340), "Comparaison sans règle :", fill=NAVY, font=self.fonts["bold_22"])

        # Without rule
        draw.rounded_rectangle([1030, 380, 1810, 430], radius=12, fill=LIGHT)
        draw.rounded_rectangle([1030, 380, 1030 + int(780 * 0.3), 430],
                                radius=12, fill=RED)
        draw.text((1045, 390), "Capital : 30%", fill=WHITE, font=self.fonts["bold_20"])
        draw.text((1030 + int(780 * 0.3) + 10, 390), "-70% !!",
                   fill=RED, font=self.fonts["bold_22"])

        # Verdict
        draw.text((1030, 460), "Avec 1% :", fill=GREEN, font=self.fonts["bold_24"])
        draw.text((1200, 460), "Douloureux mais survivable", fill=GREEN, font=self.fonts["medium_24"])
        draw.text((1030, 495), "Sans règle :", fill=RED, font=self.fonts["bold_24"])
        draw.text((1200, 495), "Compte anéanti", fill=RED, font=self.fonts["medium_24"])

        # Bottom insight
        iy = 660
        draw.rounded_rectangle([200, iy, W - 200, iy + 65], radius=16, fill=GREEN_BG)
        draw.rectangle([200, iy + 7, 206, iy + 58], fill=GREEN)
        self._center(draw, "La règle du 1% est utilisée par toutes les banques d'investissement",
                      self.fonts["medium_22"], iy + 18, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 08: Bear Markets History ───────────────────────────────────────

    def scene_08(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "Les Bear Markets du S&P 500", self.fonts["bold_44"], 45)
        self._center(draw, "Le marché se remet TOUJOURS. La question : combien de temps ?",
                      self.fonts["regular_24"], 100, fill=GRAY)

        self._card(draw, 80, 155, W - 160, 640, accent=TEAL)

        data = [
            ("Krach 1929", -86, "25 ans", RED),
            ("Crise 1973-74", -48, "7 ans 4 mois", RED),
            ("Dot-com 2000-02", -49, "7 ans 2 mois", RED),
            ("Crise 2007-09", -57, "5 ans 7 mois", RED),
            ("COVID 2020", -34, "6 mois", GREEN),
            ("Inflation 2022", -25, "1 an 7 mois", AMBER),
        ]

        max_dd = 90
        bar_area_x = 450
        max_bar_w = 750
        row_h = 85

        # Column headers
        draw.text((130, 180), "Événement", fill=GRAY_DARK, font=self.fonts["medium_20"])
        draw.text((bar_area_x, 180), "Drawdown", fill=GRAY_DARK, font=self.fonts["medium_20"])
        draw.text((bar_area_x + max_bar_w + 20, 180), "Recovery", fill=GRAY_DARK, font=self.fonts["medium_20"])
        draw.rectangle([120, 208, W - 120, 210], fill=LIGHT)

        for i, (event, dd, recovery, rec_color) in enumerate(data):
            y = 220 + i * row_h

            if i % 2 == 0:
                draw.rounded_rectangle([110, y - 3, W - 110, y + row_h - 8],
                                        radius=10, fill=BG)

            # Event name
            draw.text((130, y + 12), event, fill=NAVY, font=self.fonts["bold_24"])

            # Drawdown bar
            bar_w = int(max_bar_w * abs(dd) / max_dd)
            self._hbar(draw, bar_area_x, y + 8, bar_w, 36, RED)

            # Percentage on bar
            dd_text = f"{dd}%"
            draw.text((bar_area_x + 12, y + 13), dd_text, fill=WHITE, font=self.fonts["bold_22"])

            # Recovery time pill
            rx = bar_area_x + max_bar_w + 20
            pill_w = self._tw(recovery, self.fonts["bold_22"]) + 24
            draw.rounded_rectangle([rx, y + 8, rx + pill_w, y + 44],
                                    radius=10, fill=rec_color + "22")
            draw.text((rx + 12, y + 13), recovery, fill=rec_color, font=self.fonts["bold_22"])

            # Highlight COVID (fastest)
            if "COVID" in event:
                star_x = rx + pill_w + 15
                draw.text((star_x, y + 8), "Éclair !", fill=GREEN, font=self.fonts["medium_20"])

        # Insight box
        iy = 755
        draw.rounded_rectangle([200, iy, W - 200, iy + 60], radius=14, fill=GREEN_BG)
        draw.rectangle([200, iy + 6, 206, iy + 54], fill=GREEN)
        self._center(draw, "Chaque crise semblait être la fin. Le marché est toujours revenu.",
                      self.fonts["medium_22"], iy + 16, fill=NAVY)

        return self._watermark(img)

    # ─── Scene 09: Emotional Tools ────────────────────────────────────────────

    def scene_09(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "3 Outils pour Gérer Ses Émotions",
                      self.fonts["bold_44"], 50)

        pw, ph = 520, 600
        gap = 40
        sx = (W - 3 * pw - 2 * gap) // 2

        tools = [
            ("JOURNAL DE TRADING", BLUE, BLUE_BG,
             "Écrivez chaque trade",
             [("Date", "Ticker", "Pourquoi", "Résultat"),
              ("15/01", "AAPL", "Breakout EMA", "+8%"),
              ("22/01", "TSLA", "FOMO Reddit", "-15%")],
             "Leçon apprise à chaque trade"),
            ("RÈGLE DES 3 TRADES", AMBER, AMBER_BG,
             "Après 3 pertes d'affilée",
             None,
             "Utilisée par les banques d'investissement"),
            ("PRENDRE SOIN DE SOI", GREEN, GREEN_BG,
             "Votre corps = votre outil n°1",
             None,
             "Un esprit sain dans un corps sain"),
        ]

        for i, (title, color, bg, subtitle, table_data, note) in enumerate(tools):
            x = sx + i * (pw + gap)
            y = 140

            self._panel(draw, x, y, pw, ph, accent=color, bg=bg)

            # Title
            tw = self._tw(title, self.fonts["bold_24"])
            draw.text((x + (pw - tw) / 2, y + 25), title, fill=color, font=self.fonts["bold_24"])

            # Subtitle
            tw = self._tw(subtitle, self.fonts["regular_20"])
            draw.text((x + (pw - tw) / 2, y + 60), subtitle, fill=GRAY_DARK, font=self.fonts["regular_20"])

            draw.rectangle([x + 30, y + 95, x + pw - 30, y + 97], fill=LIGHT)

            if i == 0 and table_data:
                # Mini table
                headers, *rows = table_data
                col_w = (pw - 60) // len(headers)
                for j, h in enumerate(headers):
                    draw.text((x + 30 + j * col_w, y + 110), h, fill=TEAL,
                              font=self.fonts["bold_18"])
                draw.rectangle([x + 25, y + 135, x + pw - 25, y + 137], fill=LIGHT)
                for ri, row in enumerate(rows):
                    ry = y + 150 + ri * 40
                    result_color = GREEN if "+" in row[3] else RED
                    for j, cell in enumerate(row):
                        c = result_color if j == 3 else NAVY
                        f = self.fonts["bold_18"] if j == 3 else self.fonts["regular_18"]
                        draw.text((x + 30 + j * col_w, ry), cell, fill=c, font=f)

                # Lesson
                draw.text((x + 30, y + 260), "Colonnes clés :", fill=GRAY_DARK,
                           font=self.fonts["medium_18"])
                lessons = ["Pourquoi ce trade ?", "Résultat réel vs attendu",
                           "Ce que j'ai appris", "Ce que je ferais différemment"]
                for j, lesson in enumerate(lessons):
                    ly = y + 295 + j * 35
                    draw.ellipse([x + 30, ly + 5, x + 44, ly + 19], fill=color)
                    draw.text((x + 55, ly), lesson, fill=NAVY, font=self.fonts["regular_20"])

            elif i == 1:
                # 3 X marks then STOP
                marks_y = y + 130
                for j in range(3):
                    mx = x + 80 + j * 120
                    # X mark
                    draw.ellipse([mx, marks_y, mx + 60, marks_y + 60], fill=RED_BG, outline=RED, width=2)
                    draw.line([(mx + 18, marks_y + 18), (mx + 42, marks_y + 42)], fill=RED, width=3)
                    draw.line([(mx + 42, marks_y + 18), (mx + 18, marks_y + 42)], fill=RED, width=3)
                    draw.text((mx + 10, marks_y + 65), f"Perte {j+1}", fill=GRAY_DARK,
                              font=self.fonts["regular_18"])

                # Arrow to STOP
                self._arrow_r(draw, x + 80 + 3 * 120 - 20, marks_y + 30, length=40, color=RED)

                # STOP box
                stop_x = x + 80 + 3 * 120 + 30
                draw.rounded_rectangle([stop_x, marks_y - 5, stop_x + 100, marks_y + 65],
                                        radius=12, fill=RED)
                draw.text((stop_x + 12, marks_y + 15), "STOP", fill=WHITE,
                           font=self.fonts["bold_28"])

                # Explanation
                draw.text((x + 30, marks_y + 120), "3 pertes d'affilée = arrêt", fill=NAVY,
                           font=self.fonts["bold_22"])
                draw.text((x + 30, marks_y + 155), "Pas de négociation.", fill=RED,
                           font=self.fonts["medium_22"])
                draw.text((x + 30, marks_y + 190), "Pas d'exception.", fill=RED,
                           font=self.fonts["medium_22"])
                draw.text((x + 30, marks_y + 235), "Reprenez le lendemain", fill=GREEN,
                           font=self.fonts["medium_22"])
                draw.text((x + 30, marks_y + 265), "avec une tête reposée.", fill=GREEN,
                           font=self.fonts["medium_22"])

            elif i == 2:
                # Checklist
                items = [
                    ("7-8h de sommeil", GREEN),
                    ("30 min de sport / jour", GREEN),
                    ("Parler à quelqu'un", BLUE),
                    ("Déconnecter le soir", TEAL),
                    ("Ne pas trader affamé", AMBER),
                    ("Méditer 10 min / jour", PURPLE),
                    ("Éviter l'alcool en tradant", RED),
                ]
                for j, (item, ic) in enumerate(items):
                    iy = y + 115 + j * 55
                    # Check circle
                    draw.ellipse([x + 30, iy + 3, x + 54, iy + 27], fill=ic)
                    draw.line([(x + 36, iy + 15), (x + 42, iy + 22)], fill=WHITE, width=2)
                    draw.line([(x + 42, iy + 22), (x + 50, iy + 10)], fill=WHITE, width=2)
                    draw.text((x + 65, iy), item, fill=NAVY, font=self.fonts["regular_22"])

            # Bottom note
            tw = self._tw(note, self.fonts["medium_18"])
            draw.text((x + (pw - tw) / 2, y + ph - 45), note, fill=GRAY_DARK,
                       font=self.fonts["medium_18"])

        return self._watermark(img)

    # ─── Scene 10: Warning Signs ──────────────────────────────────────────────

    def scene_10(self):
        img, draw = self._new()
        self._decos(draw)

        self._center(draw, "Investir ou Jouer ?", self.fonts["bold_44"], 40)
        self._center(draw, "Les 7 Signaux d'Alarme", self.fonts["bold_36"], 95, fill=AMBER)

        # Left column: warning signs
        self._card(draw, 80, 160, 1050, 660, accent=RED)

        signs = [
            "Vérifier son portfolio 20+ fois par jour",
            "Investir l'argent du loyer ou des courses",
            "Mentir à ses proches sur ses pertes",
            "Ressentir un rush en passant des ordres",
            "Emprunter pour investir",
            "Ne pas pouvoir s'arrêter de trader",
            "Le trading affecte votre sommeil",
        ]

        for i, sign in enumerate(signs):
            y = 195 + i * 78

            if i % 2 == 0:
                draw.rounded_rectangle([110, y - 5, 1100, y + 60], radius=10, fill=BG)

            # Red numbered circle
            draw.ellipse([130, y + 5, 170, y + 45], fill=RED)
            num_tw = self._tw(str(i + 1), self.fonts["bold_22"])
            draw.text((150 - num_tw / 2, y + 9), str(i + 1), fill=WHITE, font=self.fonts["bold_22"])

            # Text
            draw.text((190, y + 10), sign, fill=NAVY, font=self.fonts["regular_24"])

        # Right column: action box
        self._card(draw, 1180, 160, 660, 340, accent=GREEN)

        draw.text((1220, 195), "Que faire ?", fill=GREEN, font=self.fonts["bold_28"])
        draw.rectangle([1220, 233, 1800, 235], fill=LIGHT)

        actions = [
            ("3+ signaux :", "Demandez de l'aide", RED),
            ("Joueurs Info :", "09 74 75 13 13", TEAL),
            ("Ce n'est pas", "une faiblesse.", GREEN),
            ("C'est de", "l'intelligence.", GREEN),
        ]
        for j, (label, value, color) in enumerate(actions):
            ay = 255 + j * 55
            draw.text((1220, ay), label, fill=GRAY_DARK, font=self.fonts["medium_22"])
            draw.text((1420, ay), value, fill=color, font=self.fonts["bold_22"])

        # Right column: balance meter
        self._card(draw, 1180, 530, 660, 290, accent=AMBER)

        draw.text((1220, 565), "Investir", fill=GREEN, font=self.fonts["bold_28"])
        draw.text((1620, 565), "Jouer", fill=RED, font=self.fonts["bold_28"])

        # Spectrum bar
        bar_y = 620
        # Green to red gradient (simplified as 3 sections)
        sections = [(GREEN, 220), (AMBER, 220), (RED, 220)]
        bx = 1220
        for color, w in sections:
            draw.rounded_rectangle([bx, bar_y, bx + w, bar_y + 30], radius=6, fill=color)
            bx += w

        # Labels below
        draw.text((1220, bar_y + 40), "Stratégie", fill=GREEN, font=self.fonts["regular_18"])
        draw.text((1410, bar_y + 40), "Prudence", fill=AMBER, font=self.fonts["regular_18"])
        draw.text((1620, bar_y + 40), "Addiction", fill=RED, font=self.fonts["regular_18"])

        draw.text((1220, bar_y + 80), "Plan + Discipline + Patience", fill=NAVY,
                   font=self.fonts["medium_20"])
        draw.text((1220, bar_y + 110), "= Investissement serieux", fill=GREEN,
                   font=self.fonts["bold_20"])

        return self._watermark(img)

    # ─── Scene 11: 5 Golden Rules ─────────────────────────────────────────────

    def scene_11(self):
        img, draw = self._new(bg=NAVY)

        # Subtle decorative lines
        for i in range(6):
            y = 80 + i * 180
            draw.line([(40 + i * 20, y), (W - 40 - i * 20, y - 30)],
                      fill="#0e4058", width=1)

        # Header
        self._center(draw, "Les 5 Règles d'Or de l'Investisseur",
                      self.fonts["bold_44"], 45, fill=WHITE)

        # Gold separator
        lw = 250
        draw.rectangle([(W - lw) // 2, 105, (W + lw) // 2, 109], fill=AMBER)

        rules = [
            ("N'investissez JAMAIS l'argent dont vous avez besoin pour vivre", TEAL),
            ("Ne risquez JAMAIS plus de 1% par trade", RED),
            ("Diversifiez TOUJOURS votre portefeuille", BLUE),
            ("Tenez un JOURNAL de trading", PURPLE),
            ("N'agissez JAMAIS sous le coup de l'émotion — attendez 24h", AMBER),
        ]

        for i, (rule, accent) in enumerate(rules):
            y = 150 + i * 130

            # Card background
            draw.rounded_rectangle([150, y, W - 150, y + 110], radius=16,
                                    fill="#1e293b")

            # Left accent
            draw.rectangle([150, y + 10, 156, y + 100], fill=accent)

            # Number circle
            draw.ellipse([180, y + 25, 240, y + 85], fill=AMBER)
            num_tw = self._tw(str(i + 1), self.fonts["bold_32"])
            draw.text((210 - num_tw / 2, y + 34), str(i + 1), fill=NAVY, font=self.fonts["bold_32"])

            # Rule text
            draw.text((270, y + 35), rule, fill=WHITE, font=self.fonts["medium_26"])

        # Bottom subtitle
        self._center(draw, "Bien Débuter en Bourse  —  Série Complète",
                      self.fonts["regular_22"], H - 90, fill=TEAL)

        return img

    # ─── Scene 12: End Card ───────────────────────────────────────────────────

    def scene_12(self):
        img, draw = self._new(bg=NAVY)

        # Subtle lines
        for i in range(5):
            y = 150 + i * 180
            draw.line([(80 + i * 30, y), (W - 80 - i * 30, y - 50 + i * 15)],
                      fill="#0e4058", width=1)

        # Logo
        if self.logo:
            logo = self.logo.resize((80, 80), Image.Resampling.LANCZOS)
            img.paste(logo, ((W - 80) // 2, 260), logo)

        # Brand
        self._center(draw, "M A R K E T   W A T C H", self.fonts["bold_44"], 370, fill=WHITE)

        # Separator
        lw = 200
        draw.rectangle([(W - lw) // 2, 435, (W + lw) // 2, 439], fill=TEAL)

        # URL
        self._center(draw, "dailytickers.com", self.fonts["medium_28"], 465, fill=TEAL)

        # CTA button
        cta = "Abonnez-vous pour plus d'analyses"
        cta_w = self._tw(cta, self.fonts["medium_22"]) + 50
        cta_x = (W - cta_w) / 2
        draw.rounded_rectangle([cta_x, 540, cta_x + cta_w, 585], radius=22, fill=TEAL)
        self._center(draw, cta, self.fonts["medium_22"], 550, fill=WHITE)

        # Series link
        self._center(draw, "Retrouvez cette série et toutes nos analyses sur le site",
                      self.fonts["regular_20"], 630, fill=GRAY)

        # Disclaimer
        self._center(draw, "Contenu éducatif, pas un conseil d'investissement",
                      self.fonts["regular_18"], H - 80, fill=GRAY)

        return img

    # ─── Generate All ─────────────────────────────────────────────────────────

    def generate_all(self, output_dir: Path):
        """Generate all 12 slides and save to output_dir."""
        output_dir.mkdir(parents=True, exist_ok=True)

        scenes = [
            self.scene_01, self.scene_02, self.scene_03, self.scene_04,
            self.scene_05, self.scene_06, self.scene_07, self.scene_08,
            self.scene_09, self.scene_10, self.scene_11, self.scene_12,
        ]

        for i, scene_fn in enumerate(scenes):
            path = output_dir / f"scene_{i + 1:02d}.png"
            if path.exists():
                print(f"  [skip]   scene_{i + 1:02d}.png: already exists")
                continue
            print(f"  [slide]  scene_{i + 1:02d}.png: generating...")
            img = scene_fn()
            img.save(str(path), "PNG", quality=95)
            print(f"  [done]   scene_{i + 1:02d}.png ({img.size[0]}x{img.size[1]})")


# ─── Standalone usage ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "se-remettre-dune-perte" / "images"
    renderer = SlideRenderer()
    renderer.generate_all(out)
    print("\nAll slides generated.")
