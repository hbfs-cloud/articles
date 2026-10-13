#!/usr/bin/env python3
"""Figures d'un livre au gabarit DailyTickers : graphiques matplotlib et schémas SVG lisibles à l'impression.

    import sys; sys.path.insert(0, "<repo>/tools/book"); import frfig
    frfig.style()                                   # rcParams : 9,5 pt, texte SVG éditable, palette du site
    fig, ax = plt.subplots(); ...; ax.yaxis.set_major_formatter(frfig.fr_fmt(1)); frfig.save(fig, "../fig/nom")
    frfig.diagram(520, 240, body, "../fig/schema")  # schéma SVG pur ; frfig.lines()/box() coupent sur les mots

Règles tirées de la revue de finition d'« Investir halal » (octobre 2026) :
- le texte d'une figure doit rester ≥ 8,5 pt une fois la figure ramenée à la largeur du texte (≈ 442 pt avec les
  marges du gabarit) : corps_en_unités ≥ 8,5 × largeur_viewBox / 442. Pour un viewBox de 520 : 10 unités ;
  pour 680 : 13,1 (les schémas à 680 et 11,5 unités sortaient à 7,5 pt). D'où VIEWBOX_MAX = 520 ici ;
- texte en chiffres français (virgule, signe moins, mois en minuscules) : le build corrige les <text>, encore faut-il
  que le texte en soit un (svg.fonttype = "none") ;
- couleurs de texte ≥ 4,5:1 sur blanc ; un gain et une perte se distinguent aussi par le signe, jamais par la seule couleur ;
- retour à la ligne sur les mots, jamais au milieu (« coût / e » imprimé dans la première édition) ;
- chaque figure sort d'un script relancé à chaque build : aucune figure faite à la main ou hors script."""
import html

INK = "#0f172a"; INK2 = "#334155"; MUTED = "#64748b"; LINE = "#e2e8f0"; GRID = "#e2e8f0"; ACC = "#2563eb"; SOFT = "#eff6ff"
TEAL = "#0f766e"; AMB = "#b45309"; NEG = "#b91c1c"; POS = "#047857"; VIO = "#6d28d9"; GREY = "#94a3b8"  # GREY : traits seulement, jamais du texte
VIEWBOX_MAX = 520
MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

def style():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9.5, "xtick.labelsize": 9.5, "ytick.labelsize": 9.5, "legend.fontsize": 9.5,
                         "axes.labelsize": 9.5, "axes.edgecolor": "#cbd5e1", "axes.labelcolor": INK2, "xtick.color": "#475569", "ytick.color": "#475569",
                         "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6,
                         "svg.fonttype": "none", "axes.unicode_minus": True, "figure.dpi": 100})
    return plt

def fr_num(v, d=1):
    s = f"{v:,.{d}f}".replace(",", " ").replace(".", ",")
    return s.replace("-", "−")
def fr_fmt(d=0, suffix=""):
    from matplotlib.ticker import FuncFormatter
    return FuncFormatter(lambda v, _: fr_num(v, d) + suffix)
def fr_date(ts): return f"{ts.day} {MONTHS[ts.month - 1]} {ts.year}"

def save(fig, path, w=6.6, h=3.4):
    """6,6 pouces = 475 pt de large : à la largeur du texte, 9,5 px restent ≈ 8,8 pt."""
    import matplotlib.pyplot as plt
    fig.set_size_inches(w, h); fig.tight_layout(); fig.savefig(path if path.endswith(".svg") else path + ".svg"); plt.close(fig)

F = 'font-family="Inter, sans-serif"'
def esc(s): return html.escape(s)
def wrap(text, n):
    """Coupe sur les espaces, jamais dans un mot ; n = largeur approximative en caractères."""
    out, cur = [], ""
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > n: out.append(cur); cur = w
        else: cur = (cur + " " + w).strip()
    if cur: out.append(cur)
    return out
def lines(x, y, txt, n, fs=11, fill=INK2, anchor="start", lh=None, weight=None):
    lh = lh or fs + 3; wt = f' font-weight="{weight}"' if weight else ""
    return "".join(f'<text x="{x}" y="{y + i * lh}" text-anchor="{anchor}" {F} font-size="{fs}"{wt} fill="{fill}">{esc(l)}</text>' for i, l in enumerate(wrap(txt, n)))
def box(x, y, w, h, title, body, n=None, fill="#fff", stroke=LINE, tcol=INK, fs=11):
    n = n or max(8, int(w / (fs * 0.55)))
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
    s += lines(x + 10, y + 20, title, n, fs=fs + 1.5, fill=tcol, weight=700)
    return s + lines(x + 10, y + 20 + (len(wrap(title, n))) * (fs + 4.5), body, n, fs=fs)
def arrow(x1, y1, x2, y2, col=MUTED): return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="1.6" marker-end="url(#ah)"/>'
def diagram(w, h, body, path):
    if w > VIEWBOX_MAX: raise ValueError(f"viewBox de {w} : le texte sortirait sous 8,5 pt ; rester ≤ {VIEWBOX_MAX} ou grossir le corps")
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs><marker id="ah" markerWidth="8" '
            f'markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="{MUTED}"/></marker></defs>')
    open(path if path.endswith(".svg") else path + ".svg", "w").write(head + body + "</svg>")
