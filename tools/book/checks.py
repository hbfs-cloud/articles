#!/usr/bin/env python3
"""Contrôles automatiques d'un livre au gabarit DailyTickers, à lancer après chaque build et avant toute relecture.

Usage : python3 tools/book/checks.py <dossier_du_livre> [--out DOSSIER] [--strict] [--no-ai-tells]

Lit chapters/, fig/, book.html, book.pdf et build-report.json (dans --out ou le dossier du livre) et écrit :
  book.txt            texte intégral du PDF balisé « ===== PAGE n ===== » (c'est ce que lisent les relecteurs)
  numbers_audit.md    chaque nombre écrit en dur dans les chapitres, avec son contexte (hors {{bt:…}})
  checks-report.json  tous les constats, par gravité

Gravités : BLOQUANT (sortie 1), MAJEUR (sortie 1 avec --strict), INFO. Les règles viennent des défauts réellement
trouvés sur « Investir halal » (octobre 2026) : jargon interne, résidus de gabarit, pied de page en Times, page
réduite par Chromium, figures illisibles à l'impression, termes non expliqués, chiffres périmés après relecture.
Réglages par livre dans book.json : forbidden_terms, allow_terms, stale_strings, jargon_terms, target_pages."""
import re, json, pathlib, sys, html, argparse, statistics, subprocess, collections

KIT = pathlib.Path(__file__).resolve().parent
REPO = KIT.parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("book_dir"); ap.add_argument("--out"); ap.add_argument("--strict", action="store_true"); ap.add_argument("--no-ai-tells", action="store_true")
args = ap.parse_args()
ROOT = pathlib.Path(args.book_dir).resolve()
OUT = pathlib.Path(args.out).resolve() if args.out else ROOT
CFG = json.load(open(ROOT / "book.json")) if (ROOT / "book.json").exists() else {}
findings = []
def add(sev, check, msg, where=""): findings.append({"severity": sev, "check": check, "where": where, "message": msg})

# ---------- 1. Jargon interne : ce qui ne doit jamais apparaître dans un contenu publié (CLAUDE.md) ----------
FORBIDDEN = {
    r"\bMCP\b": "jargon interne", r"\bGateway\b": "jargon interne", r"\bpipeline\b": "jargon interne",
    r"\b(?:QueryData|RunScreener|GetMarketContext|Dtx[A-Z]\w+|GetStatus)\b": "nom d'outil interne",
    r"\b[\w-]+\.(?:js|sh|py)\b": "nom de script", r"CLAUDE\.md|add_card|modes-config": "fichier interne",
    r"\b(?:Turbo|Dynamic|Balanced|Fortress|Secured|Orbit|TKL)\b": "nom de mode interne",
    r"\bDTX\b": "nom de moteur interne", r"\bTime Machine\b": "jargon interne", r"\bkill switch\b": "anglicisme : « coupe-circuit »",
}
for p in CFG.get("forbidden_terms", []): FORBIDDEN[p] = "terme interdit (book.json)"
for p in CFG.get("allow_terms", []): FORBIDDEN.pop(p, None)

# ---------- 2. Lisibilité : terme technique expliqué à sa première apparition (sinon MAJEUR) ----------
TERMS = {  # terme (regex, insensible à la casse) : indices qui comptent comme une explication à ±400 caractères
 r"\bETF\b": ["fonds coté", "fonds indiciel"], r"\bUCITS\b": ["européen", "norme", "agrément", "label"], r"\bsukuk\b": ["certificat", "obligation"],
 r"\bdrawdown\b": [], r"\bvolatilit": ["amplitude", "bouge", "varie"], r"\bcorr[ée]lation": ["même jour", "ensemble", "mêmes jours", "tomber"],
 r"\brééquilibr": ["revenir", "dosage", "proportion"], r"\bmoyenne mobile\b": ["moyenne des", "200", "10 mois", "derniers"], r"\bstop\b": ["vendre automatiquement", "vend", "ordre"],
 r"\bbacktest": ["rejou", "test", "données passées", "historique"], r"\bCAGR\b": [], r"\bSharpe\b": ["rendement", "risque"], r"\bfacteur de profit\b": ["gains", "pertes"],
 r"\btaux de réussite\b": ["gagnant", "trades"], r"\beffet de levier\b": ["emprunt", "multiplie", "dette"], r"\bCFD\b": ["contrat", "différence", "pari"], r"\bforex\b": ["devises", "monnaies"],
 r"\bcapitalisation\b": ["valeur en Bourse", "valeur totale", "prix de toutes les actions"], r"\bdividende": ["verse", "part du bénéfice", "argent"], r"\bliquidit": ["vendre vite", "échang", "acheteurs", "disponible"],
 r"\bPEA\b": ["plan d'épargne en actions"], r"\bCTO\b": ["compte-titres"], r"\bTER\b": ["frais"], r"\bISIN\b": ["identifiant", "code"], r"\briba\b": ["intérêt", "usure"], r"\bgharar\b": ["incertitude", "aléa"],
 r"\bmaysir\b": ["jeu", "hasard"], r"\bzakat\b": ["2,5", "aumône", "purif"], r"\bnisab\b": ["seuil", "85 g"], r"\bAAOIFI\b": ["organisme", "norme", "comptab"], r"\bordre limit": ["prix maximal", "prix maximum", "fixez"],
 r"\bordre au marché\b": ["prix qu'il y a", "immédiat"], r"\bspread\b": ["écart", "fourchette"], r"\bindice\b": ["panier", "liste", "mesure"], r"\bréplication physique\b": ["détient", "achète réellement"],
 r"\bcapitalisant\b": ["réinvesti", "garde les dividendes"], r"\bdistribuant\b": ["verse", "reverse"], r"\bmomentum\b": ["tendance", "monte", "monté"], r"\bR/R\b": ["gain", "risque"], r"\bATR\b": ["amplitude", "bouge"],
 r"\bRSI\b": ["indicateur", "surach", "tendu"], r"\bVIX\b": ["peur", "volatilité", "assurance"], r"\bAPI\b": ["programme", "interroger", "accès"], r"\bLLM\b": ["modèle", "intelligence artificielle"],
 r"\bwalk-forward\b": ["fenêtre", "jamais vu"], r"\bsurvivorship\b": ["survivant", "disparu", "radié"], r"\boverfitting\b": ["sur-ajust", "après coup", "réglé"], r"\bgap\b": ["saut", "écart", "ouverture"],
 r"\bmédiane\b": ["moitié", "milieu"], r"\bmarge\b": ["emprunt", "prêt", "levier"], r"\boption": ["droit d'acheter", "droit de vendre", "contrat"], r"\bvente à découvert\b": ["emprunt", "vendre ce qu'on n'a pas", "baisse"],
 r"\brisque de ruine\b": ["tout perdre", "plus rien", "capital"], r"\bKelly\b": ["mise", "fraction", "taille"], r"\btrailing\b": ["suiveur", "suit", "remonte"],
}
for p, cues in CFG.get("jargon_terms", {}).items(): TERMS[p] = cues
EXCL = CFG.get("jargon_exclude", ["glossaire", "annexe"])
chapters = sorted((ROOT / "chapters").glob("*.html"))
if not chapters: add("BLOQUANT", "structure", "aucun chapitre dans chapters/")
seen = set(); longs = []
for f in chapters:
    if any(x in f.name for x in EXCL): continue
    txt = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"\{\{[^}]+\}\}", "0", f.read_text()))); low = txt.lower()
    for pat, cues in TERMS.items():
        if pat in seen: continue
        m = re.search(pat, txt, flags=re.I)
        if not m: continue
        seen.add(pat)
        window = low[max(0, m.start() - 400): m.end() + 400]
        if not cues: add("MAJEUR", "jargon", f"« {m.group(0)} » : terme à remplacer par des mots simples", f.name)
        elif not any(c.lower() in window for c in cues):
            add("MAJEUR", "jargon", f"« {m.group(0)} » première apparition sans explication : …{' '.join(txt[max(0, m.start()-70):m.end()+70].split())}…", f.name)
    for sent in re.split(r"(?<=[.!?])\s+", " ".join(txt.split())):
        n = len(sent.split())
        if n > 40: longs.append((n, f.name, sent[:100]))
if longs:
    longs.sort(reverse=True)
    add("INFO", "phrases", f"{len(longs)} phrases de plus de 40 mots ; les plus longues : " + " | ".join(f"{n} mots [{fn}] {s}…" for n, fn, s in longs[:5]))

# ---------- 3. Nombres écrits en dur (pour le relecteur QA : chacun doit avoir une source) ----------
rows = []
for f in chapters:
    txt = re.sub(r"\{\{bt:[^}]+\}\}", "⟨bt⟩", f.read_text())
    txt = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", txt)).split())
    for m in re.finditer(r"(?<![\w⟨])[−+-]?\d[\d  .,]*\d?(?:\s?(?:%|€|\$|Md\$|M\$|ans?|mois|jours?|séances?|trades?|lignes?|g|points?))?", txt):
        s = m.group(0).strip()
        if re.fullmatch(r"\d{1,2}", s) and int(s) < 13 and not m.group(0).endswith(("%", "€", "$")): continue  # petits ordinaux
        if re.fullmatch(r"(19|20)\d\d", s): continue  # années seules
        rows.append((f.name, s, txt[max(0, m.start() - 90): m.end() + 60]))
(OUT / "numbers_audit.md").write_text("\n".join(["# Nombres écrits en dur (hors {{bt:…}})", "", "| Chapitre | Nombre | Contexte |", "|---|---|---|"] +
                                               [f"| {a} | {b} | …{c.replace('|', '¦')}… |" for a, b, c in rows]))
add("INFO", "nombres", f"{len(rows)} nombres écrits en dur listés dans numbers_audit.md (à confronter aux sources)")

# ---------- 4. Figures : présence, texte non vectorisé, taille imprimée, contraste ----------
def contrast(hexc):
    hexc = hexc.lstrip("#")
    if len(hexc) == 3: hexc = "".join(c * 2 for c in hexc)
    if len(hexc) != 6: return 21
    def lin(c):
        c = int(c, 16) / 255; return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(hexc[i:i + 2]) for i in (0, 2, 4)); L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return 1.05 / (L + 0.05)
mm = lambda v: float(str(v).replace("mm", ""))
marg = CFG.get("margins", {"left": "28mm", "right": "26mm"})
TEXT_W_PT = (210 - mm(marg.get("left", "28mm")) - mm(marg.get("right", "26mm"))) * 72 / 25.4
used = set()
for f in chapters: used.update(re.findall(r'<figure data-fig="([^"]+)"', f.read_text()))
for name in sorted(used):
    p = ROOT / "fig" / f"{name}.svg"
    if not p.exists(): add("BLOQUANT", "figures", f"figure absente : fig/{name}.svg", name); continue
    svg = p.read_text()
    texts = re.findall(r"<text\b[^>]*>", svg)
    if not texts and re.search(r'<path[^>]+id="[A-Za-z]+[-_]', svg):
        add("MAJEUR", "figures", "texte vectorisé en chemins : typographie et taille non corrigeables (matplotlib : svg.fonttype='none')", name)
    vb = re.search(r'viewBox="[\d.\s-]+?\s([\d.]+)\s+[\d.]+"', svg)
    W = float(vb.group(1)) if vb else None
    small = []; bad = set()
    for t in texts:
        fs = re.search(r'font-size(?:="|:\s*)([\d.]+)', t)
        if fs and W:
            eff = max(float(fs.group(1)), 9.5) * TEXT_W_PT / W  # le build relève tout corps sous 9,5 unités
            if eff < 8.0: small.append(round(eff, 1))
        col = re.search(r'fill(?:="|:\s*)(#[0-9a-fA-F]{3,6})', t)
        # texte très clair (< 1,6:1) = texte posé sur un aplat foncé, hors champ de ce contrôle
        if col and 1.6 <= contrast(col.group(1)) < 4.5: bad.add(col.group(1))
    if small: add("MAJEUR", "figures", f"{len(small)} textes à {min(small)} pt une fois la figure à la largeur de page (plancher 8,5 pt) : corps ≥ {8.5 * W / TEXT_W_PT:.1f} unités pour une largeur de {W:g}", name)
    if bad: add("MAJEUR", "figures", f"couleur de texte sous 4,5:1 sur blanc : {', '.join(sorted(bad))} (utiliser #b91c1c, #b45309, #047857, #64748b)", name)

# ---------- 5. HTML assemblé : résidus de gabarit ----------
bh = OUT / "book.html"
if not bh.exists(): add("BLOQUANT", "build", "book.html absent : lancer tools/book/build.py")
else:
    h = bh.read_text()
    for pat, why in [(r"\{\{", "accolade de substitution non remplacée"), (r"<td>\s*</td>", "cellule vide")]:
        n = len(re.findall(pat, h))
        if n: add("BLOQUANT" if "accolade" in why else "INFO", "html", f"{n} × {why}")

# ---------- 6. PDF : ce que le lecteur voit ----------
pdfp = OUT / CFG.get("output", "book.pdf")
rep = json.load(open(OUT / "build-report.json")) if (OUT / "build-report.json").exists() else {}
if not pdfp.exists(): add("BLOQUANT", "pdf", f"{pdfp.name} absent : lancer tools/book/build.py --pdf")
else:
    import fitz
    doc = fitz.open(str(pdfp)); n = doc.page_count
    with open(OUT / "book.txt", "w") as fh:
        for i, pg in enumerate(doc): fh.write(f"\n\n===== PAGE {i + 1} =====\n" + pg.get_text())
    full = "\n".join(pg.get_text() for pg in doc)
    WP = CFG.get("format", "livre") == "livre-blanc"
    lo, hi = CFG.get("target_pages", [8, 28] if WP else [60, 180])
    if not lo <= n <= hi: add("MAJEUR", "pdf", f"{n} pages, hors de la cible {lo}-{hi}")
    if rep.get("toc_missing"): add("BLOQUANT", "sommaire", f"entrées du sommaire sans page : {rep['toc_missing'][:5]}")
    for pat, why in [(r"\{\{|\}\}", "accolades"), (r"\bNone\b|\bnan\b|\bNaN\b|\bundefined\b", "valeur vide"), (r"sup foot|&lt;|&gt;|&amp;", "balise ou entité imprimée")]:
        hits = re.findall(pat, full)
        if hits: add("BLOQUANT", "résidus", f"{len(hits)} × {why} dans le texte du PDF ({hits[:3]})")
    for pat, why in FORBIDDEN.items():
        hits = sorted(set(re.findall(pat, full)))
        if hits:
            pages = [i + 1 for i, pg in enumerate(doc) if re.search(pat, pg.get_text())][:6]
            add("BLOQUANT", "jargon interne", f"{why} : {hits[:5]} (pages {pages})")
    # avertissements obligatoires d'un contenu financier : présents, et lisibles (pas seulement en mentions légales)
    flat = " ".join(full.split()).lower()
    if "pas un conseil" not in flat: add("BLOQUANT", "conformité", "mention « Ceci n'est pas un conseil en investissement » absente")
    if WP and not re.search(r"performances? passées?", flat): add("BLOQUANT", "conformité", "livre blanc : mention sur les performances passées absente (couverture ou quatrième)")
    if WP and not re.search(r"perte en capital|perdre (?:tout|une partie)", flat): add("BLOQUANT", "conformité", "livre blanc : risque de perte en capital non mentionné")
    if re.search(r"\bgaranti(?:e|s|es)?\b", flat) and not re.search(r"(?:pas|aucun|jamais|rien) (?:de |d')?(?:rendement |gain |résultat )?garanti", flat):
        add("MAJEUR", "conformité", "le mot « garanti » apparaît sans négation proche : vérifier qu'aucun gain n'est promis")
    for s in CFG.get("stale_strings", []):
        if s in full:
            pages = [i + 1 for i, pg in enumerate(doc) if s in pg.get_text()][:6]
            add("BLOQUANT", "périmé", f"« {s} » encore présent (pages {pages}) : valeur remplacée après relecture")
    sizes = collections.Counter(); tiny = collections.Counter(); tiny_pages = collections.defaultdict(set); fonts = set(); body_lines = []
    for i, pg in enumerate(doc):
        if i == 0 and rep.get("cover", True): continue
        for b in pg.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                big = {s["font"] for s in l["spans"] if s["size"] >= 9.5}
                if l["spans"] and all(10.8 <= s["size"] <= 11.2 for s in l["spans"] if s["text"].strip()):
                    body_lines.append(len("".join(s["text"] for s in l["spans"])))
                for s in l["spans"]:
                    if not s["text"].strip(): continue
                    sz = round(s["size"], 1); sizes[sz] += len(s["text"]); fonts.add(s["font"])
                    # petites capitales synthétisées par Chromium (étiquettes .lab) : minuscules réduites à côté d'une
                    # capitale de la même police à taille normale ; ce n'est pas un texte trop petit
                    if sz < 7.9 and not (s["font"] in big and s["text"].strip().replace(" ", "").isalpha()):
                        tiny[sz] += 1; tiny_pages[sz].add(i + 1)
    body_sz = sizes.most_common(1)[0][0] if sizes else 0
    if sizes and not any(10.8 <= k <= 11.2 for k in sizes):
        add("BLOQUANT", "mise en page", f"aucun texte courant à 11 pt (corps le plus fréquent {body_sz} pt) : Chromium a réduit les pages, un élément dépasse la largeur imprimable (souvent un tableau en white-space:nowrap)")
    if tiny: add("MAJEUR", "mise en page", "textes sous 7,9 pt (souvent des figures) : " + " ; ".join(f"{k} pt ×{v}, pages {sorted(tiny_pages[k])[:8]}" for k, v in tiny.most_common(5)))
    if any("Times" in f for f in fonts): add("BLOQUANT", "polices", "police Times dans le PDF : pied de page ou police web non chargée (réseau coupé au build ?)")
    low = []
    for i in range(3, n - 1):
        blocks = doc[i].get_text("blocks")
        if not blocks: continue
        fill = (max(b[3] for b in blocks) - min(b[1] for b in blocks)) / doc[i].rect.height
        nxt = max((s["size"] for b in doc[i + 1].get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]), default=0)
        if fill < 0.3 and nxt < 20: low.append(i + 1)  # page presque vide qui n'est pas une fin de chapitre
    if low: add("MAJEUR", "mise en page", f"pages presque vides au milieu d'un chapitre : {low[:10]} (tableau ou encadré insécable trop grand)")
    lens = sorted(x for x in body_lines if x > 60)  # lignes pleines du texte courant seulement
    if lens:
        med = lens[len(lens) // 2]
        if not 65 <= med <= 92: add("MAJEUR", "mise en page", f"mesure médiane {med} caractères par ligne (livre : 65-90)")
        add("INFO", "mise en page", f"{n} pages, corps {body_sz} pt, mesure médiane {med} caractères, {rep.get('bookmarks', '?')} signets")

# ---------- 7. Tics d'écriture IA (outil du site) ----------
if not args.no_ai_tells and bh.exists() and (REPO / "tools/check-ai-tells.js").exists():
    r = subprocess.run(["node", str(REPO / "tools/check-ai-tells.js"), str(bh), "--strict"], capture_output=True, text=True)
    if r.returncode != 0: add("BLOQUANT", "tics IA", (r.stdout.strip().splitlines() or ["échec"])[-1][:300])

order = {"BLOQUANT": 0, "MAJEUR": 1, "INFO": 2}
findings.sort(key=lambda x: order[x["severity"]])
(OUT / "checks-report.json").write_text(json.dumps(findings, ensure_ascii=False, indent=1))
for x in findings: print(f"[{x['severity']}] {x['check']}{' · ' + x['where'] if x['where'] else ''} — {x['message']}")
cnt = collections.Counter(x["severity"] for x in findings)
print(f"\n{cnt.get('BLOQUANT', 0)} bloquant(s), {cnt.get('MAJEUR', 0)} majeur(s), {cnt.get('INFO', 0)} info(s) — rapport : {OUT / 'checks-report.json'}")
sys.exit(1 if cnt.get("BLOQUANT") or (args.strict and cnt.get("MAJEUR")) else 0)
