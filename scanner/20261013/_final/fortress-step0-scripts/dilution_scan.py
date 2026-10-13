"""Découverte dilution sur 5 ans depuis l'index EDGAR des soumissions (filingDate <= refdate).
Formulaires d'émission (S-1/S-3/S-4/424B*/F-*) et 8-K items 3.02/3.03 (+1.01/2.01 pour les opérations).
La classification finale ouvre le document primaire (étape séparée)."""
import json, sys
from lib import *

START = '2021-10-12'
EQ_FORMS = ('S-1', 'S-1/A', 'S-3', 'S-3/A', 'S-3ASR', 'S-4', 'S-4/A', 'F-1', 'F-3', 'F-4', 'S-8', 'S-8 POS',
            '424B1', '424B2', '424B3', '424B4', '424B5', '424B7', 'POSASR', 'EFFECT', 'SC 13D', 'SC 13D/A',
            'SCHEDULE 13D', 'SCHEDULE 13D/A', 'DEFM14A', 'PREM14A')

out = {}
for t in sys.argv[1].split(','):
    d = load('edgar_submissions_' + t)['data']
    r = d['filings_recent']
    rows = [dict(zip(r.keys(), vals)) for vals in zip(*r.values())]
    oldest = min(x['filingDate'] for x in rows)
    hits = []
    for x in rows:
        fd = x['filingDate']
        if fd < START or fd > REFDATE:
            continue
        items = (x.get('items') or '')
        is8k = x['form'] in ('8-K', '8-K/A')
        flag = None
        if x['form'] in EQ_FORMS:
            flag = 'form'
        if is8k and any(i in items.split(',') for i in ('3.02', '3.03', '1.01', '2.01', '2.02', '8.01')):
            flag = '8-K'
        if flag:
            hits.append({'form': x['form'], 'filingDate': fd, 'reportDate': x.get('reportDate'), 'items': items,
                         'accessionNumber': x['accessionNumber'], 'primaryDocument': x.get('primaryDocument'),
                         'primaryDocDescription': x.get('primaryDocDescription')})
    out[t] = {'oldest_in_recent_index': oldest, 'window': [START, REFDATE], 'covered': oldest <= START,
              'history_files': d.get('filings_files'), 'hits': hits}
    print('=====', t, 'oldest recent', oldest, 'covered', oldest <= START, 'files', [f['name'] for f in d.get('filings_files') or []])
    for h in hits:
        if h['form'] in ('8-K', '8-K/A') and set(h['items'].split(',')) <= {'2.02', '9.01', '7.01', '8.01', '5.02', '5.07', '5.03'} and '8.01' not in h['items']:
            continue
        print(' ', h['filingDate'], h['form'], h['items'], h['accessionNumber'], h['primaryDocument'], h['primaryDocDescription'])
json.dump(out, open(os.path.join(HERE, '..', 'fortress-step0-derived-dilution-index.json'), 'w'), indent=1)
