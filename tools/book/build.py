#!/usr/bin/env python3
"""Assemble un livre PDF au gabarit DailyTickers : chapitres HTML → book.html → book.pdf (Playwright) + signets (PyMuPDF).

Usage : python3 tools/book/build.py <dossier_du_livre> [--pdf] [--out DOSSIER]
        (Google Fonts se charge au rendu : réseau requis pour --pdf.)

Le dossier du livre contient :
  book.json            configuration (titre, pied de page, métadonnées) — modèle : tools/book/templates/book.json.example
  chapters/NN-*.html   un <section class="chapter" data-part="…"> par fichier ; data-front="1" (non numéroté),
                       data-annex="A" (annexe). <h1> = titre, <div class="resume">, <div class="retenir">,
                       <figure data-fig="nom">légende</figure> = fig/nom.svg inséré au build.
  cover.html           couverture (rendue à part, sans pied de page) ; {{logo_datauri}} = /logo.svg du site.
  bt/results.json      résultats des tests : {{bt:chemin.vers.valeur|format}} est substitué au build.
  refs/quran.json, refs/hadith_matn.json   optionnels : {{q:2:275|ar|fr}}, {{h:muslim:1513|ar|fr|ref}}.
  book.extra.css       optionnel, ajouté après tools/book/book.css.
  back.html            optionnel : quatrième de couverture (appel à l'action, à propos, avertissement), en dernière page.

Deux formats (book.json "format") : "livre" (défaut : sommaire, pages de partie, un chapitre par page) et
"livre-blanc" (8-28 pages : pas de sommaire ni de pages de partie, sections enchaînées, chiffres-chocs, appel à
l'action ; ajoute tools/book/whitepaper.css). "toc" et "chapter_break" forcent l'un ou l'autre comportement.

Rendu en deux passes : la première relève la page de chaque titre, la seconde imprime ces folios dans le sommaire.
La couverture est fusionnée en tête ; la pagination commence au sommaire. Écrit aussi build-report.json
(pages, signets, entrées du sommaire sans page) que tools/book/checks.py relit."""
import re, json, pathlib, sys, base64, argparse

KIT = pathlib.Path(__file__).resolve().parent
REPO = KIT.parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("book_dir"); ap.add_argument("--pdf", action="store_true"); ap.add_argument("--out")
args = ap.parse_args()
ROOT = pathlib.Path(args.book_dir).resolve()
OUT = pathlib.Path(args.out).resolve() if args.out else ROOT
OUT.mkdir(parents=True, exist_ok=True)
CFG = {"title": "Livre DailyTickers", "footer": None, "author": "DailyTickers", "subject": "", "lang": "fr",
       "results": "bt/results.json", "results_key": "tests", "toc_title": "Sommaire", "part_label": "Partie",
       "annex_label": "Annexes", "annex_title": "Pour aller vérifier", "cover": "cover.html", "output": "book.pdf",
       "margins": {"top": "20mm", "bottom": "22mm", "left": "28mm", "right": "26mm"}}
if (ROOT / "book.json").exists(): CFG.update(json.load(open(ROOT / "book.json")))
CFG["footer"] = CFG["footer"] or f"{CFG['title']} · DailyTickers"
WP = CFG.get("format", "livre") == "livre-blanc"
CFG.setdefault("toc", not WP); CFG.setdefault("parts", not WP); CFG.setdefault("chapter_break", not WP)

res_path = ROOT / CFG["results"]
R = json.load(open(res_path)) if res_path.exists() else {}
R = R.get(CFG["results_key"], R) if CFG["results_key"] else R
chapters = sorted((ROOT / "chapters").glob("*.html"))

def lookup(path):
    # les clés peuvent contenir un point (ISDW.L, 0.3%) : on recolle les segments tant que la clé n'existe pas
    cur = R; segs = path.split("."); i = 0
    while i < len(segs):
        if isinstance(cur, list): cur = cur[int(segs[i])]; i += 1; continue
        for j in range(len(segs), i, -1):
            key = ".".join(segs[i:j])
            if key in cur: cur = cur[key]; i = j; break
        else: raise KeyError(f"{{{{bt:{path}}}}} introuvable dans {CFG['results']} (segment {segs[i]})")
    return cur
def fr_num(v, fmt):
    if fmt == "int": s = f"{round(v):,}".replace(",", " ")
    elif fmt == "pct1": s = f"{v:+.1f}".replace(".", ",") + " %"
    elif fmt == "pct1u": s = f"{v:.1f}".replace(".", ",") + " %"
    elif fmt == "pct0": s = f"{v:+.0f} %"
    elif fmt == "pct0u": s = f"{v:.0f} %"
    elif fmt == "x": s = f"{v:.2f}".replace(".", ",") + " ×"
    elif fmt == "d1": s = f"{v:.1f}".replace(".", ",")
    elif fmt == "d2": s = f"{v:.2f}".replace(".", ",")
    elif fmt == "plus100": s = f"{round(100 + v):,}".replace(",", " ") + " €"
    else: s = str(v)
    return s.replace("-", "−")

def load_refs(name):
    p = ROOT / "refs" / name
    return json.load(open(p)) if p.exists() else None
QURAN = load_refs("quran.json"); HADITH = load_refs("hadith_matn.json")
SUP = re.compile(r"(?:<|&lt;)sup[^>&]*(?:>|&gt;).*?(?:<|&lt;)/sup(?:>|&gt;)", re.S)  # appels de note des traductions (bruts ou échappés)
def subst(html):
    def rep(m):
        path, fmt = (m.group(1).split("|") + ["raw"])[:2]
        return fr_num(lookup(path), fmt)
    html = re.sub(r"\{\{bt:([^}]+)\}\}", rep, html)
    if QURAN:
        def verse(m):
            v = QURAN["verses"][m.group(1)]; t = v["arabic"] if m.group(2) == "ar" else v["fr"]
            return SUP.sub("", t)
        html = re.sub(r"\{\{q:([\d:]+)\|(ar|fr)\}\}", verse, html)
    if HADITH:
        html = re.sub(r"\{\{h:([a-z]+:[\da-z]+)\|(ar|fr|ref)\}\}", lambda m: HADITH[m.group(1)][m.group(2)], html)
    return SUP.sub("", html)

def clean_title(t):
    t = re.sub(r'<span class="level[^>]*>.*?</span>', "", t, flags=re.S)
    return re.sub(r"\s+", " ", re.sub("<[^>]+>", "", t)).strip()

MONTHS = {"Jan": "janv.", "Feb": "févr.", "Mar": "mars", "Apr": "avr.", "May": "mai", "Jun": "juin", "Jul": "juil.", "Aug": "août", "Sep": "sept.", "Oct": "oct.", "Nov": "nov.", "Dec": "déc."}
def fr_svg_text(svg):
    """Typographie française dans les textes des figures : virgule décimale, signe moins, mois abrégés, taille plancher 9,5 unités."""
    def txt(m):
        t = m.group(2)
        t = re.sub(r"(?<=\d)\.(?=\d)", ",", t); t = re.sub(r"(?<![\w])-(?=\d)", "−", t)
        t = re.sub(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b", lambda k: MONTHS[k.group(1)], t)
        return m.group(1) + t + m.group(3)
    svg = re.sub(r"(<text[^>]*>)([^<]*)(</text>)", txt, svg)
    svg = re.sub(r"font-size:\s*([0-9.]+)px", lambda m: f"font-size: {max(float(m.group(1)), 9.5):g}px", svg)
    return svg
def inline_figs(html):
    def rep(m):
        name = m.group(1); svg = (ROOT / "fig" / f"{name}.svg").read_text()
        svg = re.sub(r"<\?xml[^>]*\?>|<!DOCTYPE[^>]*>", "", svg)
        svg = re.sub(r"font-family:\s*'?DejaVu Sans'?", "font-family: Inter, sans-serif", svg)
        return f'<figure class="fig" data-src="{name}">{fr_svg_text(svg)}<figcaption>{m.group(2)}</figcaption></figure>'
    return re.sub(r'<figure data-fig="([^"]+)">(.*?)</figure>', rep, html, flags=re.S)

NUMCELL = re.compile(r"^[−+]?\d[\d\s ]*([,.]\d+)?(\s?(%|×|€|k€|\$|pts?|j))?$")
def tidy_tables(html):
    """<thead>/<tbody> (en-tête répété quand la table se coupe) et class="num" sur les cellules purement numériques."""
    def table(m):
        t = m.group(0)
        if "<thead>" not in t:
            t = re.sub(r"(<table[^>]*>\s*)(<tr>\s*<th.*?</tr>)", r"\1<thead>\2</thead><tbody>", t, count=1, flags=re.S)
            if "<tbody>" in t: t = re.sub(r"(<caption>.*?</caption>\s*)?</table>$", lambda k: "</tbody>" + (k.group(1) or "") + "</table>", t, flags=re.S)
        t = re.sub(r"<td>([^<]*)</td>", lambda k: f'<td class="num">{k.group(1)}</td>' if NUMCELL.match(k.group(1).strip()) else k.group(0), t)
        return t
    return re.sub(r"<table>.*?</table>", table, html, flags=re.S)

def lift_levels(h):
    """Les puces de niveau sortent du <h1> (serif) vers une ligne sous le titre."""
    m = re.search(r"<h1([^>]*)>(.*?)</h1>", h, flags=re.S)
    if not m: return h
    chips = re.findall(r'<span class="level[^>]*>.*?</span>', m.group(2), flags=re.S)
    if not chips: return h
    title = re.sub(r'\s*<span class="level[^>]*>.*?</span>', "", m.group(2), flags=re.S)
    return h[:m.start()] + f"<h1{m.group(1)}>{title}</h1><div class=\"levels\">{''.join(chips)}</div>" + h[m.end():]

body = []; toc = []; chap_no = 0; part_seen = set()
for f in chapters:
    h = lift_levels(tidy_tables(subst(inline_figs(f.read_text()))))
    m = re.search(r'<section class="chapter"([^>]*)>', h); attrs = m.group(1) if m else ""
    part = re.search(r'data-part="([^"]+)"', attrs); part = part.group(1) if part else None
    title = re.search(r"<h1[^>]*>(.*?)</h1>", h, flags=re.S).group(1)
    is_front = 'data-front="1"' in attrs
    annex = re.search(r'data-annex="([^"]+)"', attrs); annex = annex.group(1) if annex else None
    if annex:
        if CFG["annex_label"] not in part_seen and CFG["parts"]:
            part_seen.add(CFG["annex_label"]); pid = f"part-{len(part_seen)}"
            body.append(f'<section class="part" id="{pid}"><div class="part-num">{CFG["annex_label"]}</div><h1>{CFG["annex_title"]}</h1></section>'); toc.append(("part", pid, CFG["annex_label"], None))
        cid = f"ch-{f.stem}"; h = h.replace('<section class="chapter"', f'<section class="chapter" id="{cid}"', 1)
        h = re.sub(r"<h1([^>]*)>", f'<h1\\1><span class="chap-num annex">Annexe {annex}</span>', h, count=1)
        toc.append(("chap", cid, "Annexe " + annex + " · " + clean_title(title), None))
        for s in re.finditer(r'<h2 id="([^"]+)"[^>]*>(.*?)</h2>', h, flags=re.S): toc.append(("sec", s.group(1), clean_title(s.group(2)), None))
        body.append(h); continue
    if part and part not in part_seen and CFG["parts"]:
        part_seen.add(part); pid = f"part-{len(part_seen)}"
        body.append(f'<section class="part" id="{pid}"><div class="part-num">{CFG["part_label"]} {len(part_seen)}</div><h1>{part}</h1></section>')
        toc.append(("part", pid, part, None))
    if not is_front: chap_no += 1
    cid = f"ch-{f.stem}"
    h = h.replace('<section class="chapter"', f'<section class="chapter" id="{cid}"', 1)
    if not is_front:
        h = re.sub(r"<h1([^>]*)>", f'<h1\\1><span class="chap-num">{chap_no}</span>', h, count=1)
    toc.append(("chap", cid, clean_title(title), chap_no if not is_front else None))
    for s in re.finditer(r'<h2 id="([^"]+)"[^>]*>(.*?)</h2>', h, flags=re.S):
        toc.append(("sec", s.group(1), clean_title(s.group(2)), None))
    body.append(h)

def toc_html(pages):
    if not CFG["toc"]: return ""
    out = [f'<section class="toc" id="toc"><h1>{CFG["toc_title"]}</h1><ol>']
    for kind, hid, t, n in toc:
        pg = pages.get(hid, "")
        if kind == "part": out.append(f'<li class="toc-part"><a href="#{hid}"><span class="t">{t}</span><span class="pg">{pg}</span></a></li>')
        elif kind == "chap": out.append(f'<li class="toc-chap"><a href="#{hid}"><span class="n">{n if n else ""}</span><span class="t">{t}</span><span class="pg">{pg}</span></a></li>')
        else: out.append(f'<li class="toc-sec"><a href="#{hid}"><span class="t">{t}</span><span class="pg">{pg}</span></a></li>')
    out.append("</ol></section>"); return "".join(out)

css = (KIT / "book.css").read_text()
if WP: css += "\n" + (KIT / "whitepaper.css").read_text()
if not CFG["chapter_break"]: css += "\n.chapter { break-before: auto; } .chapter + .chapter { margin-top: 12mm; }"
if (ROOT / "book.extra.css").exists(): css += "\n" + (ROOT / "book.extra.css").read_text()
cover = (ROOT / CFG["cover"]).read_text() if (ROOT / CFG["cover"]).exists() else ""
if "{{logo_datauri}}" in cover:
    cover = cover.replace("{{logo_datauri}}", "data:image/svg+xml;base64," + base64.b64encode((REPO / "logo.svg").read_bytes()).decode())
cover = subst(cover)  # la couverture porte aussi des {{bt:…}} (chiffre dominant d'un livre blanc)
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Noto+Naskh+Arabic:wght@400;500&display=swap" rel="stylesheet">'
def page(inner): return f'<!doctype html><html lang="{CFG["lang"]}"><head><meta charset="utf-8"><title>{CFG["title"]}</title>{FONTS}<style>{css}</style></head><body>{inner}</body></html>'
back = (ROOT / "back.html").read_text() if (ROOT / "back.html").exists() else ""
if back: body.append(subst(back))
(OUT / "book.html").write_text(page(cover + toc_html({}) + "".join(body)))
print("chapters:", len(chapters), "toc entries:", len(toc))

if args.pdf:
    from playwright.sync_api import sync_playwright
    import fitz
    MARG = CFG["margins"]
    # Le pied de page de Chromium ne voit pas les polices web : police système, 11,5 px (8,6 pt), jamais Times 5,6 pt.
    FOOT = (f"<div style=\"font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11.5px;letter-spacing:0.01em;width:100%;padding:0 {MARG['right']} 0 {MARG['left']};display:flex;justify-content:space-between;color:#64748b\">"
            f"<span>{CFG['footer']}</span><span style=\"font-variant-numeric:tabular-nums\"><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>")
    def render(pg, inner, path, footer):
        (OUT / "_render.html").write_text(page(inner))
        pg.goto((OUT / "_render.html").resolve().as_uri(), wait_until="networkidle"); pg.wait_for_timeout(800)
        pg.pdf(path=str(path), format="A4", print_background=True, display_header_footer=footer, header_template="<div></div>", footer_template=FOOT, margin=MARG)
    def locate(doc):
        """Page (1-based, dans le corps) de chaque entrée du sommaire : recherche monotone, après les pages du sommaire."""
        titles = [t for k, h, t, n in toc]
        toc_pages = {i for i, p in enumerate(doc) if sum(1 for t in titles[:60] if p.search_for(t[:50])) >= 12}
        start = max(toc_pages) + 1 if toc_pages else 0; found = {}
        for kind, hid, t, n in toc:
            needle = t.split(" · ", 1)[-1][:60]  # « Annexe A · titre » : seul le titre figure sur la page
            for i in range(start, len(doc)):
                if doc[i].search_for(needle): found[hid] = i + 1; start = i; break
        return found
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page()
        render(pg, toc_html({}) + "".join(body), OUT / "_pass1.pdf", True)
        pages = locate(fitz.open(str(OUT / "_pass1.pdf")))
        render(pg, toc_html(pages) + "".join(body), OUT / "_body.pdf", True)
        if cover: render(pg, cover, OUT / "_cover.pdf", False)
        b.close()
    bodydoc = fitz.open(str(OUT / "_body.pdf"))
    if cover: doc = fitz.open(str(OUT / "_cover.pdf")); doc.insert_pdf(bodydoc); offset = 1
    else: doc = bodydoc; offset = 0
    pages2 = locate(bodydoc)
    outline = []
    for kind, hid, t, n in toc:
        if hid not in pages2: continue
        lvl = 1 if kind == "part" else (2 if kind == "chap" else 3)
        outline.append([lvl, t if not n else f"{n}. {t}", pages2[hid] + offset])  # la couverture précède le corps
    fixed = []; last = 0
    for lvl, t, p in outline:
        if lvl > last + 1: lvl = last + 1
        fixed.append([lvl, t, p]); last = lvl
    doc.set_toc(fixed); doc.set_metadata({"title": CFG["title"], "author": CFG["author"], "subject": CFG["subject"], "creationDate": fitz.get_pdf_now()})
    out_pdf = OUT / CFG["output"]
    doc.save(str(out_pdf), garbage=3, deflate=True)
    missing = [t for k, h, t, n in toc if h not in pages2]
    report = {"pdf": str(out_pdf), "format": CFG.get("format", "livre"), "pages": len(doc), "bookmarks": len(fixed), "toc_entries": len(toc), "toc_missing": missing, "cover": bool(cover)}
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print("pages:", len(doc), "bookmarks:", len(fixed), "toc sans page:", missing[:5])
    for f in ("_pass1.pdf", "_body.pdf", "_cover.pdf", "_render.html"): (OUT / f).unlink(missing_ok=True)
