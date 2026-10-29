"""EDGAR (source primaire SEC) : CIK, concept XBRL Assets, et index des soumissions.
Usage : python3 edgar_fetch.py cik|assets|submissions TICKER[,TICKER...]
Chaque réponse brute est persistée dans fortress-step0-raw/edgar_<kind>_<TICKER>.json avec URL, date de lecture et SHA-256.
"""
import json, sys, time, hashlib, urllib.request, os, datetime
from lib import RAW

UA = 'DailyTickers research contact@dailytickers.com'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    time.sleep(0.15)
    return body


def save(name, url, body, parsed):
    env = {'source': 'SEC EDGAR', 'url': url, 'fetched_at': datetime.datetime.utcnow().isoformat() + 'Z',
           'sha256_body': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'data': parsed}
    with open(os.path.join(RAW, name + '.json'), 'w') as f:
        json.dump(env, f, indent=1)


def cik_map(tickers):
    url = 'https://www.sec.gov/files/company_tickers.json'
    body = get(url)
    data = json.loads(body)
    sub = {v['ticker']: v for v in data.values() if v['ticker'] in tickers}
    save('edgar_company_tickers_subset', url, body, sub)
    return sub


def load_cik():
    with open(os.path.join(RAW, 'edgar_company_tickers_subset.json')) as f:
        return json.load(f)['data']


if __name__ == '__main__':
    kind, tick = sys.argv[1], sys.argv[2].split(',')
    if kind == 'cik':
        m = cik_map(set(tick))
        for t in tick:
            print(t, m.get(t))
        sys.exit(0)
    m = load_cik()
    for t in tick:
        cik = str(m[t]['cik_str']).zfill(10)
        if kind == 'assets':
            url = f'https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/us-gaap/Assets.json'
        elif kind == 'submissions':
            url = f'https://data.sec.gov/submissions/CIK{cik}.json'
        elif kind == 'companyfacts':
            url = f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json'
        else:
            raise SystemExit('kind inconnu')
        try:
            body = get(url)
            parsed = json.loads(body)
            if kind == 'submissions':
                # garder l'index récent + la liste des fichiers d'historique (pas de troncature des champs)
                parsed = {'cik': parsed.get('cik'), 'name': parsed.get('name'), 'sic': parsed.get('sic'),
                          'sicDescription': parsed.get('sicDescription'), 'tickers': parsed.get('tickers'),
                          'fiscalYearEnd': parsed.get('fiscalYearEnd'),
                          'filings_recent': parsed['filings']['recent'], 'filings_files': parsed['filings'].get('files')}
            if kind == 'companyfacts':
                # sous-ensemble : bilan, dette porteuse d'intérêt, rachats (us-gaap et ifrs-full) ; sha256 du corps complet conservé
                keep = {'Assets', 'LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermDebtCurrent', 'DebtCurrent',
                        'ConvertibleNotesPayable', 'ConvertibleDebtNoncurrent', 'ConvertibleNotesPayableCurrent', 'SeniorNotes',
                        'LongTermNotesPayable', 'NotesPayable', 'LongTermLineOfCredit', 'LineOfCredit', 'SecuredDebt', 'UnsecuredDebt',
                        'LongTermDebtAndCapitalLeaseObligations', 'OtherLongTermDebtNoncurrent', 'ShortTermBorrowings', 'CommercialPaper',
                        'LongTermDebtAndCapitalLeaseObligationsCurrent', 'DebtInstrumentCarryingAmount', 'LongTermDebtFairValue',
                        'PaymentsForRepurchaseOfCommonStock', 'Borrowings', 'NoncurrentPortionOfNoncurrentBorrowings',
                        'CurrentPortionOfNoncurrentBorrowings', 'CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings',
                        'NoncurrentBorrowings', 'CurrentBorrowings', 'ShorttermBorrowings', 'LongtermBorrowings',
                        'SecuredLongTermDebt', 'NotesPayableRelatedPartiesClassifiedNoncurrent', 'NotesPayableRelatedPartiesClassifiedCurrent',
                        'ConvertibleNotesPayableRelatedPartiesNoncurrent', 'Liabilities'}
                parsed = {'cik': parsed.get('cik'), 'entityName': parsed.get('entityName'),
                          'facts': {tax: {k: v for k, v in tags.items() if k in keep} for tax, tags in parsed.get('facts', {}).items() if tax in ('us-gaap', 'ifrs-full')},
                          'taxonomies': sorted(parsed.get('facts', {}).keys())}
                save(f'edgar_companyfacts_subset_{t}', url, body, parsed)
                print('OK', t, url, len(body))
                continue
            save(f'edgar_{kind}_{t}', url, body, parsed)
            print('OK', t, url, len(body))
        except Exception as e:
            print('ERR', t, url, e)
