"""Ouvre un document primaire EDGAR et persiste son texte (HTML nettoyé) avec URL + SHA-256.
Usage : python3 edgar_doc.py TICKER ACCESSION PRIMARY_DOC LABEL"""
import sys, re, html, json
from edgar_fetch import get, save, load_cik

t, accn, doc, label = sys.argv[1:5]
cik = str(load_cik()[t]['cik_str'])
url = f'https://www.sec.gov/Archives/edgar/data/{cik}/{accn.replace("-", "")}/{doc}'
body = get(url)
txt = body.decode('utf-8', 'replace')
txt = re.sub(r'(?is)<(script|style).*?</\1>', ' ', txt)
txt = re.sub(r'(?s)<[^>]+>', ' ', txt)
txt = html.unescape(txt)
txt = re.sub(r'\s+', ' ', txt).strip()
save(f'edgar_doc_{t}_{label}', url, body, {'accession': accn, 'primary_document': doc, 'text': txt})
print(url, len(txt))
