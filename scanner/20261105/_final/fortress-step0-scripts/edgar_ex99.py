"""Ouvre l'index d'un dépôt EDGAR, repère l'exhibit 99.1 (communiqué de résultats) et persiste son texte avec URL + SHA-256.
Usage : python3 edgar_ex99.py TICKER ACCESSION LABEL"""
import sys, re, html, json
from edgar_fetch import get, save, load_cik

t, accn, label = sys.argv[1:4]
cik = str(load_cik()[t]['cik_str'])
base = f'https://www.sec.gov/Archives/edgar/data/{cik}/{accn.replace("-", "")}/'
idx = json.loads(get(base + 'index.json'))
docs = [x['name'] for x in idx['directory']['item']]
cands = [d for d in docs if re.search(r'(ex|exhibit)[-_]?99[-_.]?1|ex991|dex991|exhibit991', d, re.I) and d.lower().endswith(('.htm', '.html'))]
if not cands:
    cands = [d for d in docs if re.search(r'99', d) and d.lower().endswith(('.htm', '.html'))]
doc = cands[0]
body = get(base + doc)
txt = body.decode('utf-8', 'replace')
txt = re.sub(r'(?is)<(script|style).*?</\1>', ' ', txt)
txt = re.sub(r'(?s)<[^>]+>', ' ', txt)
txt = html.unescape(txt)
txt = re.sub(r'\s+', ' ', txt).strip()
save(f'edgar_doc_{t}_{label}', base + doc, body, {'accession': accn, 'primary_document': doc, 'index_documents': docs, 'text': txt})
print(t, label, base + doc, len(txt))
